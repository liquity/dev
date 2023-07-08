// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Dependencies/LiquitySafeMath128.sol";

/* Tester contract for math functions in LiquitySafeMath128.sol library. */

contract LiquitySafeMath128Tester {
    using LiquitySafeMath128 for uint128;

    function add(uint128 a, uint128 b) external pure returns (uint128) {
        return a.add(b);
    }

    function sub(uint128 a, uint128 b) external pure returns (uint128) {
        return a.sub(b);
    }
}
