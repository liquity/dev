// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "../Dependencies/VestaSafeMath128.sol";

/* Tester contract for math functions in VestaSafeMath128.sol library. */

contract VestaSafeMath128Tester {
	using VestaSafeMath128 for uint128;

	function add(uint128 a, uint128 b) external pure returns (uint128) {
		return a.add(b);
	}

	function sub(uint128 a, uint128 b) external pure returns (uint128) {
		return a.sub(b);
	}
}
