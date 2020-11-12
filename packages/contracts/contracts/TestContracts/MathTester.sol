pragma solidity 0.6.11;

import "../Dependencies/Math.sol";

/* Tester contract for math functions in Math.sol library. */

contract MathTester {
    // Non-view wrapper for gas test
    function callDecPowTx(uint _base, uint _n) external returns (uint) {
        return Math._decPow(_base, _n);
    }

    // External view wrapper
    function callDecPow(uint _base, uint _n) external view returns (uint) {
        return Math._decPow(_base, _n);
    }
}