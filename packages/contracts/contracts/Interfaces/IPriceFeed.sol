// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface IPriceFeed {

    function getPrice() external view returns (uint);
}
