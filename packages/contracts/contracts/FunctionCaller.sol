pragma solidity ^0.5.11;

import './Interfaces/ICDPManager.sol';
import './Interfaces/ISortedCDPs.sol';
import '@nomiclabs/buidler/console.sol';
import './DeciMath.sol';
import './ABDKMath64x64.sol';

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

    // --- DeciMath public functions ---

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

    //  --- DeciMath internal functions ---
    function decimath2_accurateMulDiv(uint x, uint y, uint z) public returns(uint fraction) {
        return DeciMath2.accurateMulDiv(x ,y, z);
    }

    function getMin2(uint a, uint b) public returns(uint) {
        return DeciMath2.getMin(a, b);
    }

    function decimath2_decMul(uint x, uint y) public returns (uint prod) {
        return DeciMath2.decMul(x, y);
    }
   
    function decimath2_decDiv(uint x, uint y) public returns (uint quotient) {
        return DeciMath2.decDiv(x, y);
    }

    function decimath2_div_toDuint(uint x, uint y) public returns (uint quotient) {
        return DeciMath2.div_toDuint(x, y);
    }

    function decimath2_mul_uintByDuint( uint x, uint y_duint)public returns (uint prod) {
        return DeciMath2.mul_uintByDuint(x, y_duint);
    }

    // --- ABDK Math Functions ---

    // mul
    function abdkMath_mul(int128 x, int128 y) public returns(int128) {
        return ABDKMath64x64.mul(x,y);
    }
    // div
    function abdkMath_div(int128 x, int128 y) public returns(int128) {
        return ABDKMath64x64.div(x,y);
    }

    // mul dec by uint --> uint
    function abdkMath_mulu(int128 x, uint256 y) public returns(uint256) {
        // console.log("0. gas left: %s", gasleft());
        uint z = ABDKMath64x64.mulu(x,y);  // 243 gas
        // console.log("1. gas left: %s", gasleft());
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
        // console.log("0. gas left: %s", gasleft());
        int128 z = ABDKMath64x64.fromUInt(x);  // 93 gas
        // console.log("1. gas left: %s", gasleft());
        return z;
  }
}

