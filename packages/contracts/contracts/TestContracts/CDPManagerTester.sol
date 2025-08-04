// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../TroveManager.sol";

/* Tester contract inherits from TroveManager, and provides external functions 
for testing the parent's internal functions. */

contract TroveManagerTester is TroveManager {

    function computeICR(uint _coll, uint _debt, uint _price) external view returns (uint) {
        uint par = relayer.par();
        return LiquityMath._computeCR(_coll, _actualDebt(_debt), _price, par);
    }

    function getCollGasCompensation(uint _coll) external pure returns (uint) {
        return _getCollGasCompensation(_coll);
    }

    function getLUSDGasCompensation() external pure returns (uint) {
        return LUSD_GAS_COMPENSATION;
    }

    function baseRate() external view returns (uint) {
        return aggregator.baseRate();
    }

    function lastFeeOperationTime() external view returns (uint) {
        return aggregator.lastFeeOperationTime();
    }

    function getRedemptionFeeWithDecay(uint _ETHDrawn) external view returns (uint) {
        return aggregator.getRedemptionFeeWithDecay(_ETHDrawn);
    }

    function getCompositeDebt(uint _debt) external pure returns (uint) {
        return _getCompositeDebt(_debt);
    }

    function getActualDebtFromComposite(uint _debtVal) external pure returns (uint) {
        return _getNetDebt(_debtVal);
    }

    function callInternalRemoveTroveOwner(address _troveOwner) external {
        uint troveOwnersArrayLength = TroveOwners.length;
        _removeTroveOwner(_troveOwner, troveOwnersArrayLength);
    }
}
