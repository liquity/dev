// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import "../Dependencies/IStdReference.sol";
import "../Dependencies/console.sol";

contract MockStdReference is IStdReference {
	uint256 rate; 
	uint256 lastUpdatedBase;
	uint256 lastUpdatedQuote;

	function setRate(uint256 _rate) external {
		rate = _rate;
	}

	function setUpdatedAt(uint256 _lastUpdatedBase, uint256 _lastUpdatedQuote) external {
		lastUpdatedBase = _lastUpdatedBase;
		lastUpdatedQuote = _lastUpdatedQuote;
	}

	function getReferenceData(string memory _base, string memory _quote) 
		external
		view
		override
		returns (ReferenceData memory)
	{
		return ReferenceData(rate, lastUpdatedBase, lastUpdatedQuote);
	}

	function getReferenceDataBulk(string[] memory _bases, string[] memory _quotes)
		external
		view
		override
		returns (ReferenceData[] memory)
	{
		ReferenceData[] memory results = new ReferenceData[](_bases.length);
		for (uint i = 0; i < _bases.length; i++) {
			results[i] = ReferenceData(rate, lastUpdatedBase, lastUpdatedQuote);
		}
		return results;
	}
}