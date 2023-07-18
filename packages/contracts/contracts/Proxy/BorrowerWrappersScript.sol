// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Dependencies/StabilioMath.sol";
import "../Dependencies/IERC20.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/ITroveManager.sol";
import "../Interfaces/IStabilityPool.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/ISTBLStaking.sol";
import "./BorrowerOperationsScript.sol";
import "./ETHTransferScript.sol";
import "./STBLStakingScript.sol";
import "../Dependencies/console.sol";


contract BorrowerWrappersScript is BorrowerOperationsScript, ETHTransferScript, STBLStakingScript {

    string constant public NAME = "BorrowerWrappersScript";

    ITroveManager immutable troveManager;
    IStabilityPool immutable stabilityPool;
    IPriceFeed immutable priceFeed;
    IERC20 immutable xbrlToken;
    IERC20 immutable stblToken;
    ISTBLStaking immutable stblStaking;

    constructor(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _stblStakingAddress
    )
        BorrowerOperationsScript(IBorrowerOperations(_borrowerOperationsAddress))
        STBLStakingScript(_stblStakingAddress)
        public
    {
        checkContract(_troveManagerAddress);
        ITroveManager troveManagerCached = ITroveManager(_troveManagerAddress);
        troveManager = troveManagerCached;

        IStabilityPool stabilityPoolCached = troveManagerCached.stabilityPool();
        checkContract(address(stabilityPoolCached));
        stabilityPool = stabilityPoolCached;

        IPriceFeed priceFeedCached = troveManagerCached.priceFeed();
        checkContract(address(priceFeedCached));
        priceFeed = priceFeedCached;

        address xbrlTokenCached = address(troveManagerCached.xbrlToken());
        checkContract(xbrlTokenCached);
        xbrlToken = IERC20(xbrlTokenCached);

        address stblTokenCached = address(troveManagerCached.stblToken());
        checkContract(stblTokenCached);
        stblToken = IERC20(stblTokenCached);

        ISTBLStaking stblStakingCached = troveManagerCached.stblStaking();
        require(_stblStakingAddress == address(stblStakingCached), "BorrowerWrappersScript: Wrong STBLStaking address");
        stblStaking = stblStakingCached;
    }

    function claimCollateralAndOpenTrove(uint256 _maxFee, uint256 _XBRLAmount, address _upperHint, address _lowerHint) external payable {
        uint256 balanceBefore = address(this).balance;

        // Claim collateral
        borrowerOperations.claimCollateral();

        uint256 balanceAfter = address(this).balance;

        // already checked in CollSurplusPool
        assert(balanceAfter > balanceBefore);

        uint256 totalCollateral = balanceAfter - balanceBefore + msg.value;

        // Open trove with obtained collateral, plus collateral sent by user
        borrowerOperations.openTrove{ value: totalCollateral }(_maxFee, _XBRLAmount, _upperHint, _lowerHint);
    }

    function claimSPRewardsAndRecycle(uint256 _maxFee, address _upperHint, address _lowerHint) external {
        uint256 collBalanceBefore = address(this).balance;
        uint256 stblBalanceBefore = stblToken.balanceOf(address(this));

        // Claim rewards
        stabilityPool.withdrawFromSP(0);

        uint256 collBalanceAfter = address(this).balance;
        uint256 stblBalanceAfter = stblToken.balanceOf(address(this));
        uint256 claimedCollateral = collBalanceAfter - collBalanceBefore;

        // Add claimed ETH to trove, get more XBRL and stake it into the Stability Pool
        if (claimedCollateral > 0) {
            _requireUserHasTrove(address(this));
            uint256 XBRLAmount = _getNetXBRLAmount(claimedCollateral);
            borrowerOperations.adjustTrove{ value: claimedCollateral }(_maxFee, 0, XBRLAmount, true, _upperHint, _lowerHint);
            // Provide withdrawn XBRL to Stability Pool
            if (XBRLAmount > 0) {
                stabilityPool.provideToSP(XBRLAmount, address(0));
            }
        }

        // Stake claimed STBL
        uint256 claimedSTBL = stblBalanceAfter - stblBalanceBefore;
        if (claimedSTBL > 0) {
            stblStaking.stake(claimedSTBL);
        }
    }

    function claimStakingGainsAndRecycle(uint256 _maxFee, address _upperHint, address _lowerHint) external {
        uint256 collBalanceBefore = address(this).balance;
        uint256 xbrlBalanceBefore = xbrlToken.balanceOf(address(this));
        uint256 stblBalanceBefore = stblToken.balanceOf(address(this));

        // Claim gains
        stblStaking.unstake(0);

        uint256 gainedCollateral = address(this).balance - collBalanceBefore; // stack too deep issues :'(
        uint256 gainedXBRL = xbrlToken.balanceOf(address(this)) - xbrlBalanceBefore;

        uint256 netXBRLAmount;
        // Top up trove and get more XBRL, keeping ICR constant
        if (gainedCollateral > 0) {
            _requireUserHasTrove(address(this));
            netXBRLAmount = _getNetXBRLAmount(gainedCollateral);
            borrowerOperations.adjustTrove{ value: gainedCollateral }(_maxFee, 0, netXBRLAmount, true, _upperHint, _lowerHint);
        }

        uint256 totalXBRL = gainedXBRL + netXBRLAmount;
        if (totalXBRL > 0) {
            stabilityPool.provideToSP(totalXBRL, address(0));

            // Providing to Stability Pool also triggers STBL claim, so stake it if any
            uint256 stblBalanceAfter = stblToken.balanceOf(address(this));
            uint256 claimedSTBL = stblBalanceAfter - stblBalanceBefore;
            if (claimedSTBL > 0) {
                stblStaking.stake(claimedSTBL);
            }
        }

    }

    function _getNetXBRLAmount(uint256 _collateral) internal returns (uint) {
        uint256 price = priceFeed.fetchPrice();
        uint256 ICR = troveManager.getCurrentICR(address(this), price);

        uint256 XBRLAmount = _collateral * price / ICR;
        uint256 borrowingRate = troveManager.getBorrowingRateWithDecay();
        uint256 netDebt = XBRLAmount * StabilioMath.DECIMAL_PRECISION / (StabilioMath.DECIMAL_PRECISION + borrowingRate);

        return netDebt;
    }

    function _requireUserHasTrove(address _depositor) internal view {
        require(troveManager.getTroveStatus(_depositor) == 1, "BorrowerWrappersScript: caller must have an active trove");
    }
}
