pragma solidity ^0.5.11;

import './Interfaces/ICDPManager.sol';
import './Interfaces/ISortedCDPs.sol';
import './Interfaces/IPriceFeed.sol';
import '@nomiclabs/buidler/console.sol';
import './DeciMath.sol';
import './ABDKMath64x64.sol';

// Proxy contract - used for calculating gas of read-only functions in gas calculation scripts.  Not part of the application.
contract FunctionCaller {

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
        // console.log("0. gas left: %s", gasleft());
        uint quotient = DeciMath.div_toDuint(x, y); // 1097 gas
        // console.log("1. gas left: %s", gasleft());
        return quotient;
    }

    function decimath_mul_uintByDuint( uint x, uint y_duint)public returns (uint prod) {
        //  console.log("0. gas left: %s", gasleft());
        uint z = DeciMath.mul_uintByDuint(x, y_duint);  // 967 gas
        //  console.log("1. gas left: %s", gasleft());
        return z;
    }

    // --- ABDK Math Functions ---

    // mul
    function abdkMath_mul(int128 x, int128 y) public returns(int128) {
        // console.log("00. gas left: %s", gasleft());
        int128 z =  ABDKMath64x64.mul(x,y); // 147 gas
        // console.log("01. gas left: %s", gasleft());
        return z;
    }
    // div
    function abdkMath_div(int128 x, int128 y) public returns(int128) {
        // console.log("00. gas left: %s", gasleft());
        int128 z = ABDKMath64x64.div(x,y); // 202 gas
        // console.log("01. gas left: %s", gasleft());
        return z;
    }

    // mul dec by uint --> uint
    function abdkMath_mulu(int128 x, uint256 y) public returns(uint256) {
        // console.log("00. gas left: %s", gasleft());
        uint z = ABDKMath64x64.mulu(x,y);  // 243 gas
        // console.log("01. gas left: %s", gasleft());
        return z;
    }
    
    // div uint by uint --> dec
    function abdkMath_divu(uint256 x, uint256 y) public returns(int128) {
        // console.log("0. gas left: %s", gasleft());
        int128 z = ABDKMath64x64.divu(x,y);  // 303 gas
        // console.log("1. gas left: %s", gasleft());
        return z;
    }

     function abdkMath_fromUInt(uint256 x) public returns(int128) {
        // console.log("00. gas left: %s", gasleft());
        int128 z = ABDKMath64x64.fromUInt(x);  // 93 gas
        // console.log("01. gas left: %s", gasleft());
        return z;    
    }

     function abdkMath_toUInt(int128 x) public returns(int128) {
        // console.log("00. gas left: %s", gasleft());
        uint64 z = ABDKMath64x64.toUInt(x);  // 82 gas
        // console.log("01. gas left: %s", gasleft());
        return z;
    }

  // --- 'View' ABDKMath functions - return the computed result --- 

      // mul 64.64dec by 64.64dec
    function abdkMath_mul_view(int128 x, int128 y) public view returns(int128) {
        return ABDKMath64x64.mul(x,y);
    }
    // div 64.64dec by 64.64dec
    function abdkMath_div_view(int128 x, int128 y) public view returns(int128) {
        return ABDKMath64x64.div(x,y);
    }

    // mul 64.64dec by uint --> uint, rounded down
    function abdkMath_mulu_view(int128 x, uint256 y) public view returns(uint256) {
        uint z = ABDKMath64x64.mulu(x,y);  // 243 gas
        return z;
    }
    
    // div uint by uint --> 64.64dec
    function abdkMath_divu_view(uint256 x, uint256 y) public view returns(int128) {
        int128 z = ABDKMath64x64.divu(x,y);  // 303 gas
        return z;
    }

     // convert uint -> 64.64dec
     function abdkMath_fromUInt_view(uint256 x) public view returns(int128) {
        int128 z = ABDKMath64x64.fromUInt(x);  // 93 gas
        return z;
    }

    function abdkMath_toUInt_view(int128 x) public view returns(int128) {
        uint64 z = ABDKMath64x64.toUInt(x);  
        return z;
    }

}

