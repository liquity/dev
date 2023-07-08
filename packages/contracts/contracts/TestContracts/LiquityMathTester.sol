// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Dependencies/LiquityMath.sol";

/* Tester contract for math functions in Math.sol library. */

contract LiquityMathTester {

    function callMax(uint _a, uint256 _b) external pure returns (uint) {
        return LiquityMath._max(_a, _b);
    }

    // Non-view wrapper for gas test
    function callDecPowTx(uint _base, uint256 _n) external returns (uint) {
        return LiquityMath._decPow(_base, _n);
    }

    // External wrapper
    function callDecPow(uint _base, uint256 _n) external pure returns (uint) {
        return LiquityMath._decPow(_base, _n);
    }
}
