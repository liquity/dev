// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

// Safemath functions for overflow protection on uint128 basic arithmetic operations.

library SafeMath128 {
    function add(uint128 a, uint128 b) internal pure returns (uint128) {
        uint128 c = a + b;
        require(c >= a, "SafeMath128: addition overflow");

        return c;
    }
   
    function sub(uint128 a, uint128 b) internal pure returns (uint128) {
        require(b <= a, "SafeMath128: subtraction overflow");
        uint128 c = a - b;

        return c;
    }
}