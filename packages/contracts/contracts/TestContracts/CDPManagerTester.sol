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

    function getActualDebtFromComposite(uint _debtVal) external pure returns (uint) {
        return _getNetDebt(_debtVal);
    }
}
