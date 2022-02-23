// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "../PriceFeed.sol";

contract PriceFeedTester is PriceFeed {
	function setLastGoodPrice(uint256 _lastGoodPrice) external {
		lastGoodPrice[address(0)] = _lastGoodPrice;
	}

	function setStatus(Status _status) external {
		status = _status;
	}
}
