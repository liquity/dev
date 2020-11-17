// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../CDPManager.sol";
import "../Dependencies/Math.sol";

/* Tester contract inherits from CDPManager, and provides external functions 
for testing the parent's internal functions. */

contract CDPManagerTester is CDPManager {

    function computeICR(uint _coll, uint _debt, uint _price) external pure returns (uint) {
        return Math._computeCR(_coll, _debt, _price);
    }

    function getCollGasCompensation(uint _coll) external pure returns (uint) {
        return _getCollGasCompensation(_coll);
    }

    function getCLVGasCompensation() external pure returns (uint) {
        return CLV_GAS_COMPENSATION;
    }

    function getCompositeDebt(uint _debt) external pure returns (uint) {
        return _getCompositeDebt(_debt);
    }

    function unprotectedDecayBaseRateFromBorrowing() external returns (uint) {
        baseRate = _calcDecayedBaseRate();
        assert(baseRate >= 0 && baseRate <= 1e18);
        
        _updateLastFeeOpTime();
        return baseRate;
    }

    function minutesPassedSinceLastFeeOp() external view returns (uint) {
        return _minutesPassedSinceLastFeeOp();
    }

    function setLastFeeOpTimeToNow() external {
        lastFeeOperationTime = block.timestamp;
    }

    function setBaseRate(uint _baseRate) external {
        baseRate = _baseRate;
    }

    function callGetRedemptionFee(uint _ETHDrawn) external view returns (uint) {
        _getRedemptionFee(_ETHDrawn);
    }  

    function pmLiquidate(uint _CLV, uint _ETH) external {
        poolManager.liquidate(_CLV, _ETH);
    }

    function pmRedeemCollateral(address _account, uint _CLV, uint _ETH) external {
        poolManager.redeemCollateral(_account, _CLV, _ETH);
    }

    function pmMovePendingTroveRewardsToActivePool(uint _CLV, uint _ETH) external {
        poolManager.movePendingTroveRewardsToActivePool(_CLV, _ETH);
    }

    function getActualDebtFromComposite(uint _debtVal) external pure returns (uint) {
        return _getNetDebt(_debtVal);
    }
}
