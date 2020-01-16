pragma solidity ^0.5.11;

// Common interface for the SortedCDPs Doubly Linked List.
interface ISortedCDPs {
// --- Events ---
event SortedCDPsAddressChanged(address _sortedDoublyLLAddress);

// --- Functions ---
    function setCDPManager(address _CDPManagerAddress) external;

    function setMaxSize(uint256 _size) external;

    function insert(address _id, uint256 _ICR, address _prevId, address _nextId) external;

    function remove(address _id) external;

    function reInsert(address _id, uint256 _newICR, address _prevId, address _nextId) external;

    function contains(address _id) external view returns (bool);

    function isFull() external view returns (bool);

    function isEmpty() external view returns (bool);

    function getSize() external view returns (uint256);

    function getMaxSize() external view returns (uint256);

    function getFirst() external view returns (address);

    function getLast() external view returns (address);

    function getNext(address _id) external view returns (address);

    function getPrev(address _id) external view returns (address);

    function validInsertPosition(uint256 _ICR, address _prevId, address _nextId) external view returns (bool);
}