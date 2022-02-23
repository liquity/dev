// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "../Interfaces/ITroveManager.sol";
import "../Interfaces/ISortedTroves.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Dependencies/VestaMath.sol";

/* Wrapper contract - used for calculating gas of read-only and internal functions. 
Not part of the Vesta application. */
contract FunctionCaller {
	ITroveManager troveManager;
	address public troveManagerAddress;

	ISortedTroves sortedTroves;
	address public sortedTrovesAddress;

	IPriceFeed priceFeed;
	address public priceFeedAddress;

	// --- Dependency setters ---

	function setTroveManagerAddress(address _troveManagerAddress) external {
		troveManagerAddress = _troveManagerAddress;
		troveManager = ITroveManager(_troveManagerAddress);
	}

	function setSortedTrovesAddress(address _sortedTrovesAddress) external {
		troveManagerAddress = _sortedTrovesAddress;
		sortedTroves = ISortedTroves(_sortedTrovesAddress);
	}

	function setPriceFeedAddress(address _priceFeedAddress) external {
		priceFeedAddress = _priceFeedAddress;
		priceFeed = IPriceFeed(_priceFeedAddress);
	}

	// --- Non-view wrapper functions used for calculating gas ---

	function troveManager_getCurrentICR(
		address _asset,
		address _address,
		uint256 _price
	) external view returns (uint256) {
		return troveManager.getCurrentICR(_asset, _address, _price);
	}

	function sortedTroves_findInsertPosition(
		address _asset,
		uint256 _NICR,
		address _prevId,
		address _nextId
	) external view returns (address, address) {
		return sortedTroves.findInsertPosition(_asset, _NICR, _prevId, _nextId);
	}
}
