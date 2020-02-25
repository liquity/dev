pragma solidity ^0.5.11;

import './Interfaces/ICDPManager.sol';
import './Interfaces/ISortedCDPs.sol';
import '@nomiclabs/buidler/console.sol';
import './DeciMath.sol';

// Proxy contract - used for calculating gas of read-only functions in gas calculation scripts.  Not part of the application.

contract FunctionCaller {

    ICDPManager cdpManager;
    address cdpManagerAddress;

    ISortedCDPs sortedCDPs;
    address sortedCDPsAddress;

    // --- Dependency setters ---

    function setCDPManagerAddress(address _cdpManagerAddress) public {
        cdpManagerAddress = _cdpManagerAddress;
        cdpManager = ICDPManager(_cdpManagerAddress);
    }
    
     function setSortedCDPsAddress(address _sortedCDPsAddress) public {
        cdpManagerAddress = _sortedCDPsAddress;
        sortedCDPs = ISortedCDPs(_sortedCDPsAddress);
    }

    // --- CDPManager functions ---

    function cdpManager_getCurrentICR (address _address) public returns(uint) {
        cdpManager.getCurrentICR(_address);  
    }

    function cdpManager_getApproxHint (uint _CR, uint _numTrials) public returns(address) {
        return cdpManager.getApproxHint(_CR, _numTrials);
    }

    // --- SortedCDPs functions ---

    function sortedCDPs_findInsertPosition(uint _ICR, address _prevId, address _nextId) public returns(address, address) {
        return sortedCDPs.findInsertPosition(_ICR, _prevId, _nextId);
    }

    // --- DeciMath functions ---

    function decimath_accurateMulDiv(uint x, uint y, uint z) public returns(uint fraction) {
        return DeciMath.accurateMulDiv(x ,y, z);
    }

    function getMin(uint a, uint b) public returns(uint) {
        return DeciMath.getMin(a, b);
    }

    function decimath_decMul(uint x, uint y) public returns (uint prod) {
        return DeciMath.decMul(x, y);
    }
   
    function decimath_decDiv(uint x, uint y) public returns (uint quotient) {
        return DeciMath.decDiv(x, y);
    }

    function decimath_div_toDuint(uint x, uint y) public returns (uint quotient) {
        return DeciMath.div_toDuint(x, y);
    }

    function decimath_mul_uintByDuint( uint x, uint y_duint)public returns (uint prod) {
        return DeciMath.mul_uintByDuint(x, y_duint);
    }
}

