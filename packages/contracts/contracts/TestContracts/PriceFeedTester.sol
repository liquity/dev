// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../PriceFeed.sol";

contract PriceFeedTester is PriceFeed {

    constructor (uint256 _tellorDigits) PriceFeed(_tellorDigits) {}
    
    function setLastGoodPrice(uint256 _lastGoodPrice) external {
        lastGoodPrice = _lastGoodPrice;
    }

    function setStatus(Status _status) external {
        status = _status;
    }
}