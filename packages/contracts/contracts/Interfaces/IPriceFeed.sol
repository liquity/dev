// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface IPriceFeed {

    function fetchPrice() external returns (uint);
}
