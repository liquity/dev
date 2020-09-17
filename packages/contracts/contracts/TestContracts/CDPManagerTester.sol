pragma solidity 0.5.16;

import "../CDPManager.sol";
import "../Dependencies/Math.sol";

/* Tester contract inherits from CDPManager, and provides external functions 
for testing the parent's internal functions. */

contract CDPManagerTester is CDPManager {

    function computeICR(uint _coll, uint _debt, uint _price) external pure returns (uint) {
        return Math._computeCR(_coll, _debt, _price);
    }

    function getMinVirtualDebtInETH(uint _price) external view returns (uint) {
        return _getMinVirtualDebtInETH(_price);
    }

     function getGasCompensation(uint _coll, uint _price) external view returns (uint) {
        return _getGasCompensation(_coll, _price);
    }

    function getCompositeDebt(uint _debt) external view returns (uint) {
        return _getCompositeDebt(_debt);
    }

    function callDecayBaseRate() external returns (uint) {
        decayBaseRate();
    }

    function callGetRedemptionFee(uint _ETHDrawn, uint _price) external returns (uint) {
        getRedemptionFee(_ETHDrawn, _price);
    }  

    function callGetBorrowingFee(uint _CLVDebt) external returns (uint) {
        getBorrowingFee(_CLVDebt);
    }

    function callDecPow(uint _base, uint _n) external returns (uint) {
        decayBaseRate();
    }
}
