pragma solidity 0.5.16;

import '../Interfaces/ICDPManager.sol';
import '../Interfaces/ISortedCDPs.sol';
import '../Interfaces/IPriceFeed.sol';
import '../Dependencies/Math.sol';

/* Wrapper contract - used for calculating gas of read-only and internal functions. 
Not part of the Liquity application. */
contract FunctionCaller {

    uint number = 1;

    ICDPManager cdpManager;
    address public cdpManagerAddress;

    ISortedCDPs sortedCDPs;
    address public sortedCDPsAddress;

    IPriceFeed priceFeed;
    address public priceFeedAddress;

    // --- Dependency setters ---

    function setCDPManagerAddress(address _cdpManagerAddress) external {
        cdpManagerAddress = _cdpManagerAddress;
        cdpManager = ICDPManager(_cdpManagerAddress);
    }
    
    function setSortedCDPsAddress(address _sortedCDPsAddress) external {
        cdpManagerAddress = _sortedCDPsAddress;
        sortedCDPs = ISortedCDPs(_sortedCDPsAddress);
    }

     function setPriceFeedAddress(address _priceFeedAddress) external {
        priceFeedAddress = _priceFeedAddress;
        priceFeed = IPriceFeed(_priceFeedAddress);
    }

     // @REVIEW: What are these non-view wrappers used for? They throw compiler warnings
     // --- PriceFeed functions -  non-view wrappers ---

     function priceFeed_getPrice() external returns (uint) {
        return priceFeed.getPrice();
    }

    // --- CDPManager functions - non-view wrappers ---
    function cdpManager_getCurrentICR (address _address, uint _price) external returns (uint) {
        return cdpManager.getCurrentICR(_address, _price);  
    }

    // --- SortedCDPs functions -  non-view wrappers ---

    function sortedCDPs_findInsertPosition(uint _ICR, uint _price, address _prevId, address _nextId) external returns (address, address) {
        return sortedCDPs.findInsertPosition(_ICR, _price, _prevId, _nextId);
    }

    // --- Math functions -  non-view wrappers ---

    function _min(uint _a, uint _b) external returns (uint) {
        return Math._min(_a, _b);
    }


    //  ---- Funcs for checking write-to-storage costs ---

    function repeatedlySetVal (uint _n) external returns (uint, uint) {
        for (uint i = 2; i < _n + 2; i ++) {
            number = i;
        }
    }
    
    function repeatedlySetValThenClearIt (uint _n) external returns (uint, uint) {
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
   function callInternalStorageCheck () external returns (bool) {
       return internalStorageCheck();
   }

    // Check storage directly
   function rawStorageCheck () external returns (bool) {
       return (number == 42);
   }
}