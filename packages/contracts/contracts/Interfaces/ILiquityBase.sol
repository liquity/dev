// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./IPriceFeed.sol";


interface ILiquityBase {
    function priceFeed() external view returns (IPriceFeed);
}
