// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

// Common interface for the SortedCDPs Doubly Linked List.
interface ISortedCDPs {
// --- Events ---
event SortedCDPsAddressChanged(address _sortedDoublyLLAddress);
event BorrowerOperationsAddressChanged(address _borrowerOperationsAddress);

// --- Functions ---
    function setParams(uint256 _size, address _CDPManagerAddress, address _borrowerOperationsAddress) external;

    function insert(address _id, uint256 _ICR, uint price, address _prevId, address _nextId) external;

    function remove(address _id) external;

    function reInsert(address _id, uint256 _newICR, uint price, address _prevId, address _nextId) external;

    function contains(address _id) external view returns (bool);

    function isFull() external view returns (bool);

    function isEmpty() external view returns (bool);

    function getSize() external view returns (uint256);

    function getMaxSize() external view returns (uint256);

    function getFirst() external view returns (address);

    function getLast() external view returns (address);

    function getNext(address _id) external view returns (address);

    function getPrev(address _id) external view returns (address);

    function validInsertPosition(uint256 _ICR, uint _price, address _prevId, address _nextId) external view returns (bool);

    function findInsertPosition(uint256 _ICR, uint _price,  address _prevId, address _nextId) external view returns (address, address);
}
