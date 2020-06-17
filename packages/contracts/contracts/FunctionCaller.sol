pragma solidity ^0.5.16;

import './Interfaces/ICDPManager.sol';
import './Interfaces/ISortedCDPs.sol';
import './Interfaces/IPriceFeed.sol';
import './DeciMath.sol';

// Proxy contract - used for calculating gas of read-only functions in gas calculation scripts.  Not part of the application.
contract FunctionCaller {

    uint number = 1;

    ICDPManager cdpManager;
    address cdpManagerAddress;

    ISortedCDPs sortedCDPs;
    address sortedCDPsAddress;

    IPriceFeed priceFeed;
    address priceFeedAddress;

    // --- Dependency setters ---

    function setCDPManagerAddress(address _cdpManagerAddress) public {
        cdpManagerAddress = _cdpManagerAddress;
        cdpManager = ICDPManager(_cdpManagerAddress);
    }
    
    function setSortedCDPsAddress(address _sortedCDPsAddress) public {
        cdpManagerAddress = _sortedCDPsAddress;
        sortedCDPs = ISortedCDPs(_sortedCDPsAddress);
    }

     function setPriceFeedAddress(address _priceFeedAddress) public {
        priceFeedAddress = _priceFeedAddress;
        priceFeed = IPriceFeed(_priceFeedAddress);
    }

    // --- PriceFeed functions ---

     function priceFeed_getPrice() public returns(uint) {
        return priceFeed.getPrice();
    }

    // --- CDPManager functions ---
    function cdpManager_getCurrentICR (address _address, uint _price) public returns(uint) {
        return cdpManager.getCurrentICR(_address, _price);  
    }

    function cdpManager_getApproxHint (uint _CR, uint _numTrials) public returns(address) {
        return cdpManager.getApproxHint(_CR, _numTrials);
    }

    // --- SortedCDPs functions ---

    function sortedCDPs_findInsertPosition(uint _ICR, uint _price, address _prevId, address _nextId) public returns(address, address) {
        return sortedCDPs.findInsertPosition(_ICR, _price, _prevId, _nextId);
    }

    // --- DeciMath public functions ---

    // function decimath_accurateMulDiv(uint x, uint y, uint z) public returns(uint fraction) {
    //     return DeciMath.accurateMulDiv(x ,y, z);
    // }

    function getMin(uint _a, uint _b) public view returns(uint) {
        return DeciMath.getMin(_a, _b);
    }

    function decimath_decMul(uint _x, uint _y) public returns (uint prod) {
        return DeciMath.decMul(_x, _y);
    }
   
    function decimath_decDiv(uint _x, uint _y) public returns (uint quotient) {
        return DeciMath.decDiv(_x, _y);
    }

    function decimath_div_toDuint(uint _x, uint _y) public returns (uint quotient) {
        // console.log("0. gas left: %s", gasleft());
        uint quotient = DeciMath.div_toDuint(_x, _y); // 1097 gas
        // console.log("1. gas left: %s", gasleft());
        return quotient;
    }

    function decimath_mul_uintByDuint( uint _x, uint _y_duint)public returns (uint prod) {
        //  console.log("0. gas left: %s", gasleft());
        uint z = DeciMath.mul_uintByDuint(_x, _y_duint);  // 967 gas
        //  console.log("1. gas left: %s", gasleft());
        return z;
    }
    
    //  ---- Funcs for checking write-to-storage costs ---

    function repeatedlySetVal (uint _n) public returns (uint, uint) {
        for (uint i = 2; i < _n + 2; i ++) {
            number = i;
        }
    }
    
    function repeatedlySetValThenClearIt (uint _n) public returns (uint, uint) {
        for (uint i = 2; i < _n + 2; i ++) {
            number = i;
        }
        number = 0;
    }

   // --- gas costs: Internal vs raw code ---

   function internalStorageCheck () internal returns (bool) {
       return (number == 42);
   }

   // Check storage by way of an internal functional call
   function callInternalStorageCheck () public returns (bool) {
       return internalStorageCheck();
   }

    // Check storage directly
   function rawStorageCheck () public returns (bool) {
       return (number == 42);
   }
}