pragma solidity ^0.5.16;

import "../BorrowerOperations.sol";

/* Tester contract inherits from BorrowerOperations, and provides external functions 
for testing the parent's internal functions. */
contract BorrowerOperationsTester is BorrowerOperations {

    function getNewICRFromTroveChange(uint _coll, uint _debt, int _collChange, int _debtChange, uint _price) 
    external
    pure
    returns (uint)
    {
        return _getNewICRFromTroveChange(_coll, _debt, _collChange, _debtChange, _price);
    }

    function getNewTCRFromTroveChange(int _collChange, int _debtChange, uint _price) 
    external 
    view
    returns (uint) 
    {
        return _getNewTCRFromTroveChange(_collChange,  _debtChange, _price);
    }
    
}