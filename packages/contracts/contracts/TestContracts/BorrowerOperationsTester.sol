// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../BorrowerOperations.sol";

/* Tester contract inherits from BorrowerOperations, and provides external functions 
for testing the parent's internal functions. */

contract BorrowerOperationsTester is BorrowerOperations {

    function getNewICRFromTroveChange
    (
        uint _coll, 
        uint _debt, 
        uint _collChange, 
        bool isCollIncrease, 
        uint _debtChange, 
        bool isDebtIncrease, 
        uint _price
    ) 
    external
    pure
    returns (uint)
    {
        return _getNewICRFromTroveChange(_coll, _debt, _collChange, isCollIncrease, _debtChange, isDebtIncrease, _price);
    }

    function getNewTCRFromTroveChange
    (
        uint _collChange, 
        bool isCollIncrease,  
        uint _debtChange, 
        bool isDebtIncrease, 
        uint _price
    ) 
    external 
    view
    returns (uint) 
    {
        return _getNewTCRFromTroveChange(_collChange, isCollIncrease, _debtChange, isDebtIncrease, _price);
    }

    function getUSDValue(uint _coll, uint _price) external pure returns (uint) {
        return _getUSDValue(_coll, _price);
    }

    function pmAddColl(uint _amount) public {
        poolManager.addColl{value: _amount}(); 
    }

    function pmWithdrawColl(address _account, uint _ETH) public {
        poolManager.withdrawColl(_account, _ETH);
    }

    function pmWithdrawCLV(address _account, uint _CLVAmount, uint _CLVFee) public {
        poolManager.withdrawCLV(_account, _CLVAmount, _CLVFee);
    }

    function pmRepayCLV(address _account, uint _CLV) public {
        poolManager.repayCLV(_account, _CLV);
    }

    // Payable fallback function
    receive() external payable { }
}
