// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/ISortedTroves.sol";


contract SortedTrovesTester {
    ISortedTroves sortedTroves;

    function setSortedTroves(address _sortedTrovesAddress) external {
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
    }

    function insert(address _id, uint256 _ICR, uint _price, address _prevId, address _nextId) external {
        sortedTroves.insert(_id, _ICR, _price, _prevId, _nextId);
    }

    function remove(address _id) external {
        sortedTroves.remove(_id);
    }

    function reInsert(address _id, uint256 _newICR, uint _price, address _prevId, address _nextId) external {
        sortedTroves.reInsert(_id, _newICR, _price, _prevId, _nextId);
    }

    function getCurrentICR(address, uint) external pure returns (uint) {
        return 1;
    }
}
