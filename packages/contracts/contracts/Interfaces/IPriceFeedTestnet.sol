// SPDX-License-Identifier: MIT

import "./IPriceFeed.sol";

pragma solidity 0.6.11;

interface IPriceFeedTestnet is IPriceFeed {

    function setPrice(uint _price) external returns (bool);
}
