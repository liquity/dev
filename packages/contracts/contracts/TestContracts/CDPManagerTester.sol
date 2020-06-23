pragma solidity ^0.5.16;

import "../CDPManager.sol";
import "../Math.sol";

/* Tester contract inherits from CDPManager, and provides public functions 
for testing the parent's internal functions. */

contract CDPManagerTester is CDPManager {

    function computeICR(uint _coll, uint _debt, uint _price) external pure returns (uint) {
        return Math._computeICR(_coll, _debt, _price);
    }

}