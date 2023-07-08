// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "./IPriceFeed.sol";


interface ILiquityBase {
    function priceFeed() external view returns (IPriceFeed);
}
