// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

interface ITellorCaller {
    function getTellorCurrentValue() external view returns (bool, uint256, uint256, uint256);
}