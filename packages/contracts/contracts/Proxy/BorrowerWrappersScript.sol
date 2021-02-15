// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/SafeMath.sol";
import "../Dependencies/LiquityMath.sol";
import "../Dependencies/IERC20.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/ITroveManager.sol";
import "../Interfaces/IStabilityPool.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/ILQTYStaking.sol";
import "./BorrowerOperationsScript.sol";
import "./ETHTransferScript.sol";
import "./LQTYStakingScript.sol";
import "../Dependencies/console.sol";


contract BorrowerWrappersScript is BorrowerOperationsScript, ETHTransferScript, LQTYStakingScript {
    using SafeMath for uint;

    ITroveManager immutable troveManager;
    IStabilityPool immutable stabilityPool;
    IPriceFeed immutable priceFeed;
    IERC20 immutable lusdToken;
    IERC20 immutable lqtyToken;
    ILQTYStaking immutable lqtyStaking;

    constructor(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _priceFeedAddress,
        address _lusdTokenAddress,
        address _lqtyTokenAddress,
        address _lqtyStakingAddress
    )
        BorrowerOperationsScript(IBorrowerOperations(_borrowerOperationsAddress))
        LQTYStakingScript(_lqtyStakingAddress)
        public
    {
        troveManager = ITroveManager(_troveManagerAddress);
        stabilityPool = IStabilityPool(_stabilityPoolAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
        lusdToken = IERC20(_lusdTokenAddress);
        lqtyToken = IERC20(_lqtyTokenAddress);
        lqtyStaking = ILQTYStaking(_lqtyStakingAddress);
    }

    /*
    function claimCollateralAndOpenTrove(uint _maxFee, uint _LUSDAmount, address _upperHint, address _lowerHint) external {
        uint balanceBefore = address(this).balance;
        borrowerOperations.claimCollateral();
        uint balanceAfter = address(this).balance;

        require(balanceAfter > balanceBefore, "BorrowerWrappersScript: Nothing was claimed");

        uint claimedCollateral = balanceAfter.sub(balanceBefore);
        borrowerOperations.openTrove{ value: claimedCollateral }(_maxFee, _LUSDAmount, _upperHint, _lowerHint);
    }
    */

    function claimSPRewardsAndLoop(uint _maxFee, address _upperHint, address _lowerHint) external {
        uint collBalanceBefore = address(this).balance;
        uint lqtyBalanceBefore = lqtyToken.balanceOf(address(this));
        stabilityPool.withdrawFromSP(0);
        uint collBalanceAfter = address(this).balance;
        uint lqtyBalanceAfter = lqtyToken.balanceOf(address(this));
        uint claimedCollateral = collBalanceAfter.sub(collBalanceBefore);

        // Add claimed ETH to trove, get more LUSD and stake it into the Stability Pool
        if (claimedCollateral > 0) {
            uint LUSDAmount = getNetLUSDAmount(claimedCollateral);
            borrowerOperations.adjustTrove{ value: claimedCollateral }(_maxFee, 0, LUSDAmount, true, _upperHint, _lowerHint);
            stabilityPool.provideToSP(LUSDAmount, address(0));
        }

        // Stake claimed LQTY
        uint claimedLQTY = lqtyBalanceAfter.sub(lqtyBalanceBefore);
        if (claimedLQTY > 0) {
            lqtyStaking.stake(claimedLQTY);
        }
    }

    function claimStakingGainsAndLoop(uint _maxFee, address _upperHint, address _lowerHint) external {
        _requireUserHasTrove(address(this));

        uint collBalanceBefore = address(this).balance;
        uint lusdBalanceBefore = lusdToken.balanceOf(address(this));
        uint lqtyBalanceBefore = lqtyToken.balanceOf(address(this));
        lqtyStaking.unstake(0);

        uint gainedCollateral = address(this).balance.sub(collBalanceBefore); // stack too deep issues :'(
        uint gainedLUSD = lusdToken.balanceOf(address(this)).sub(lusdBalanceBefore);

        uint netLUSDAmount;
        if (gainedCollateral > 0) {
            netLUSDAmount = getNetLUSDAmount(gainedCollateral);
            borrowerOperations.adjustTrove{ value: gainedCollateral }(_maxFee, 0, netLUSDAmount, true, _upperHint, _lowerHint);
        }

        if (gainedCollateral > 0 || gainedLUSD > 0) {
            uint totalLUSD = gainedLUSD.add(netLUSDAmount);
            stabilityPool.provideToSP(totalLUSD, address(0));

            // Providing to Stability Pool also triggers LQTY claim, so stake it if any
            uint lqtyBalanceAfter = lqtyToken.balanceOf(address(this));
            uint claimedLQTY = lqtyBalanceAfter.sub(lqtyBalanceBefore);
            if (claimedLQTY > 0) {
                lqtyStaking.stake(claimedLQTY);
            }
        }

    }

    function getNetLUSDAmount(uint _collateral) internal returns (uint) {
        uint price = priceFeed.fetchPrice();
        uint ICR = troveManager.getCurrentICR(address(this), price);

        uint LUSDAmount = _collateral.mul(price).div(ICR);
        uint borrowingRate = troveManager.getBorrowingRateWithDecay();
        uint netDebt = LUSDAmount.mul(LiquityMath.DECIMAL_PRECISION).div(LiquityMath.DECIMAL_PRECISION.add(borrowingRate));

        return netDebt;
    }

    function _requireUserHasTrove(address _depositor) internal view {
        require(troveManager.getTroveStatus(_depositor) == 1, "BorrowerWrappersScript: caller must have an active trove");
    }
}