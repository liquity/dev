pragma solidity 0.5.16;

import "../CDPManager.sol";
import "../Dependencies/Math.sol";

/* Tester contract inherits from CDPManager, and provides external functions 
for testing the parent's internal functions. */

contract CDPManagerTester is CDPManager {

    // function computeICR(uint _coll, uint _debt, uint _price) external pure returns (uint) {
    //     return Math._computeCR(_coll, _debt, _price);
    // }

    // function getMinVirtualDebtInETH(uint _price) external view returns (uint) {
    //     return _getMinVirtualDebtInETH(_price);
    // }

    //  function getGasCompensation(uint _coll, uint _price) external view returns (uint) {
    //     return _getGasCompensation(_coll, _price);
    // }

    // function getCompositeDebt(uint _debt) external view returns (uint) {
    //     return _getCompositeDebt(_debt);
    // }

    // function callDecayBaseRate() external returns (uint) {
    //     _decayBaseRate();
    // }

    // function hoursPassedSinceLastFeeOp() external view returns (uint) {
    //     return _hoursPassedSinceLastFeeOp();
    // }

    // function setLastFeeOpTimeToNow() external {
    //     lastFeeOperationTime = block.timestamp;
    // }

    //  function setBaseRate(uint _baseRate) external {
    //     baseRate = _baseRate;
    // }

    // function callGetBorrowingFee(uint _CLVDebt) external view returns (uint) {
    //     _getBorrowingFee(_CLVDebt);
    // }  

    // function callGetRedemptionFee(uint _ETHDrawn, uint _price) external view returns (uint) {
    //     _getRedemptionFee(_ETHDrawn, _price);
    // }  


    // Non-view wrapper for gas test
    function callDecPowTx(uint _base, uint _n) external returns (uint) {
        return Math._decPow(_base, _n);
    }

    // View wrapper
    function callDecPow(uint _base, uint _n) external view returns (uint) {
        return Math._decPow(_base, _n);
    }
}
