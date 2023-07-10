// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

interface ITellorCaller {
    function getTellorCurrentValue() external returns (bool, uint256, uint256);
}