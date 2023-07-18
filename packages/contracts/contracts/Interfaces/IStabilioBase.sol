// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "./IPriceFeed.sol";


interface IStabilioBase {
    function priceFeed() external view returns (IPriceFeed);
}
