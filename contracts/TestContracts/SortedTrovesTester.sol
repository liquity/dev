// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "../Interfaces/ISortedTroves.sol";

contract SortedTrovesTester {
	ISortedTroves sortedTroves;

	function setSortedTroves(address _sortedTrovesAddress) external {
		sortedTroves = ISortedTroves(_sortedTrovesAddress);
	}

	function insert(
		address _asset,
		address _id,
		uint256 _NICR,
		address _prevId,
		address _nextId
	) external {
		sortedTroves.insert(_asset, _id, _NICR, _prevId, _nextId);
	}

	function remove(address _asset, address _id) external {
		sortedTroves.remove(_asset, _id);
	}

	function reInsert(
		address _asset,
		address _id,
		uint256 _newNICR,
		address _prevId,
		address _nextId
	) external {
		sortedTroves.reInsert(_asset, _id, _newNICR, _prevId, _nextId);
	}

	function getNominalICR(address, address) external pure returns (uint256) {
		return 1;
	}

	function getCurrentICR(
		address,
		address,
		uint256
	) external pure returns (uint256) {
		return 1;
	}
}
