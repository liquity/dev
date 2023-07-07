// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface ITellorCaller {
    function getTellorCurrentValue() external view returns (bool, uint256, uint256);
}