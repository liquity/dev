// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../PriceFeed.sol";

contract PriceFeedTester is PriceFeed {

    function setLastGoodPrice(uint256 _lastGoodPrice) external {
        lastGoodPrice = _lastGoodPrice;
    }

    function setStatus(Status _status) external {
        status = _status;
    }
}