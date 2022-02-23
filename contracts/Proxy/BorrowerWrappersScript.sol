// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "../Dependencies/VestaMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/ITroveManager.sol";
import "../Interfaces/IStabilityPoolManager.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/IVSTAStaking.sol";
import "./BorrowerOperationsScript.sol";
import "./ETHTransferScript.sol";
import "./VSTAStakingScript.sol";

contract BorrowerWrappersScript is
	BorrowerOperationsScript,
	ETHTransferScript,
	VSTAStakingScript
{
	using SafeMathUpgradeable for uint256;

	struct Local_var {
		address _asset;
		uint256 _maxFee;
		address _upperHint;
		address _lowerHint;
		uint256 netVSTAmount;
	}

	string public constant NAME = "BorrowerWrappersScript";

	ITroveManager immutable troveManager;
	IStabilityPoolManager immutable stabilityPoolManager;
	IPriceFeed immutable priceFeed;
	IERC20 immutable vstToken;
	IERC20 immutable vstaToken;

	constructor(
		address _borrowerOperationsAddress,
		address _troveManagerAddress,
		address _VSTAStakingAddress
	)
		BorrowerOperationsScript(IBorrowerOperations(_borrowerOperationsAddress))
		VSTAStakingScript(_VSTAStakingAddress)
	{
		checkContract(_troveManagerAddress);
		ITroveManager troveManagerCached = ITroveManager(_troveManagerAddress);
		troveManager = troveManagerCached;

		IStabilityPoolManager stabilityPoolCached = troveManagerCached.stabilityPoolManager();
		checkContract(address(stabilityPoolCached));
		stabilityPoolManager = stabilityPoolCached;

		IPriceFeed priceFeedCached = troveManagerCached.vestaParams().priceFeed();
		checkContract(address(priceFeedCached));
		priceFeed = priceFeedCached;

		address vstTokenCached = address(troveManagerCached.vstToken());
		checkContract(vstTokenCached);
		vstToken = IERC20(vstTokenCached);

		address vstaTokenCached = address(IVSTAStaking(_VSTAStakingAddress).vstaToken());
		checkContract(vstaTokenCached);
		vstaToken = IERC20(vstaTokenCached);

		IVSTAStaking vstaStakingCached = troveManagerCached.vstaStaking();
		require(
			_VSTAStakingAddress == address(vstaStakingCached),
			"BorrowerWrappersScript: Wrong VSTAStaking address"
		);
	}

	function claimCollateralAndOpenTrove(
		address _asset,
		uint256 _maxFee,
		uint256 _VSTAmount,
		address _upperHint,
		address _lowerHint
	) external payable {
		uint256 balanceBefore = address(this).balance;

		// Claim collateral
		borrowerOperations.claimCollateral(_asset);

		uint256 balanceAfter = address(this).balance;

		// already checked in CollSurplusPool
		assert(balanceAfter > balanceBefore);

		uint256 totalCollateral = balanceAfter.sub(balanceBefore).add(msg.value);

		// Open trove with obtained collateral, plus collateral sent by user
		borrowerOperations.openTrove{ value: _asset == address(0) ? totalCollateral : 0 }(
			_asset,
			totalCollateral,
			_maxFee,
			_VSTAmount,
			_upperHint,
			_lowerHint
		);
	}

	function claimSPRewardsAndRecycle(
		address _asset,
		uint256 _maxFee,
		address _upperHint,
		address _lowerHint
	) external {
		Local_var memory vars = Local_var(_asset, _maxFee, _upperHint, _lowerHint, 0);
		uint256 collBalanceBefore = address(this).balance;
		uint256 VSTABalanceBefore = vstaToken.balanceOf(address(this));

		// Claim rewards
		stabilityPoolManager.getAssetStabilityPool(vars._asset).withdrawFromSP(0);

		uint256 collBalanceAfter = address(this).balance;
		uint256 VSTABalanceAfter = vstaToken.balanceOf(address(this));
		uint256 claimedCollateral = collBalanceAfter.sub(collBalanceBefore);

		// Add claimed ETH to trove, get more VST and stake it into the Stability Pool
		if (claimedCollateral > 0) {
			_requireUserHasTrove(vars._asset, address(this));
			vars.netVSTAmount = _getNetVSTAmount(vars._asset, claimedCollateral);
			borrowerOperations.adjustTrove{
				value: vars._asset == address(0) ? claimedCollateral : 0
			}(
				vars._asset,
				claimedCollateral,
				vars._maxFee,
				0,
				vars.netVSTAmount,
				true,
				vars._upperHint,
				vars._lowerHint
			);
			// Provide withdrawn VST to Stability Pool
			if (vars.netVSTAmount > 0) {
				stabilityPoolManager.getAssetStabilityPool(_asset).provideToSP(vars.netVSTAmount);
			}
		}

		// Stake claimed VSTA
		uint256 claimedVSTA = VSTABalanceAfter.sub(VSTABalanceBefore);
		if (claimedVSTA > 0) {
			vstaStaking.stake(claimedVSTA);
		}
	}

	function claimStakingGainsAndRecycle(
		address _asset,
		uint256 _maxFee,
		address _upperHint,
		address _lowerHint
	) external {
		Local_var memory vars = Local_var(_asset, _maxFee, _upperHint, _lowerHint, 0);

		uint256 collBalanceBefore = address(this).balance;
		uint256 VSTBalanceBefore = vstToken.balanceOf(address(this));
		uint256 VSTABalanceBefore = vstaToken.balanceOf(address(this));

		// Claim gains
		vstaStaking.unstake(0);

		uint256 gainedCollateral = address(this).balance.sub(collBalanceBefore); // stack too deep issues :'(
		uint256 gainedVST = vstToken.balanceOf(address(this)).sub(VSTBalanceBefore);

		// Top up trove and get more VST, keeping ICR constant
		if (gainedCollateral > 0) {
			_requireUserHasTrove(vars._asset, address(this));
			vars.netVSTAmount = _getNetVSTAmount(vars._asset, gainedCollateral);
			borrowerOperations.adjustTrove{
				value: vars._asset == address(0) ? gainedCollateral : 0
			}(
				vars._asset,
				gainedCollateral,
				vars._maxFee,
				0,
				vars.netVSTAmount,
				true,
				vars._upperHint,
				vars._lowerHint
			);
		}

		uint256 totalVST = gainedVST.add(vars.netVSTAmount);
		if (totalVST > 0) {
			stabilityPoolManager.getAssetStabilityPool(_asset).provideToSP(totalVST);

			// Providing to Stability Pool also triggers VSTA claim, so stake it if any
			uint256 VSTABalanceAfter = vstaToken.balanceOf(address(this));
			uint256 claimedVSTA = VSTABalanceAfter.sub(VSTABalanceBefore);
			if (claimedVSTA > 0) {
				vstaStaking.stake(claimedVSTA);
			}
		}
	}

	function _getNetVSTAmount(address _asset, uint256 _collateral) internal returns (uint256) {
		uint256 price = priceFeed.fetchPrice(_asset);
		uint256 ICR = troveManager.getCurrentICR(_asset, address(this), price);

		uint256 VSTAmount = _collateral.mul(price).div(ICR);
		uint256 borrowingRate = troveManager.getBorrowingRateWithDecay(_asset);
		uint256 netDebt = VSTAmount.mul(VestaMath.DECIMAL_PRECISION).div(
			VestaMath.DECIMAL_PRECISION.add(borrowingRate)
		);

		return netDebt;
	}

	function _requireUserHasTrove(address _asset, address _depositor) internal view {
		require(
			troveManager.getTroveStatus(_asset, _depositor) == 1,
			"BorrowerWrappersScript: caller must have an active trove"
		);
	}
}
