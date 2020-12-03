// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IBorrowerOperations.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

/* 
* A sorted doubly linked list with nodes sorted in descending order.
* 
* Nodes map to active Troves in the system - the ID property is the address of a Trove owner. 
* Nodes are ordered according to their current individual collateral ratio (ICR).
* 
* The list optionally accepts insert position hints.
* 
* ICRs are computed dynamically at runtime, and not stored on the Node. This is because ICRs of active Troves 
* change dynamically as liquidation events occur.
* 
* The list relies on the fact that liquidation events preserve ordering: a liquidation decreases the ICRs of all active Troves, 
* but maintains their order. A node inserted based on current ICR will maintain the correct position, 
* relative to it's peers, as rewards accumulate, as long as it's raw collateral and debt have not changed.
* Thus, Nodes remain sorted by current ICR.
* 
* Nodes need only be re-inserted upon a Trove operation - when the owner adds or removes collateral or debt 
* to their position.
*
* The list is a modification of the following audited SortedDoublyLinkedList:
* https://github.com/livepeer/protocol/blob/master/contracts/libraries/SortedDoublyLL.sol
* 
*
* Changes made in the Liquity implementation:
*
* - Keys have been removed from nodes
*
* - Ordering checks for insertion are performed by comparing an ICR argument to the current ICR, calculated at runtime. 
*   The list relies on the property that ordering by ICR is maintained as the ETH:USD price varies.
*
* - Public functions with parameters have been made internal to save gas, and given an external wrapper function for external access
*/
contract SortedTroves is Ownable, ISortedTroves {
    using SafeMath for uint256;

    event TroveManagerAddressChanged(address _newTrovelManagerAddress);
    event BorrowerOperationsAddressChanged(address _borrowerOperationsAddress);

    address public borrowerOperationsAddress;

    ITroveManager public troveManager;
    address public TroveManagerAddress;

    // Information for a node in the list
    struct Node {
        bool exists;
        address nextId;                  // Id of next node (smaller ICR) in the list
        address prevId;                  // Id of previous node (larger ICR) in the list
    }

    // Information for the list
    struct Data {
        address head;                        // Head of the list. Also the node in the list with the largest ICR
        address tail;                        // Tail of the list. Also the node in the list with the smallest ICR
        uint256 maxSize;                     // Maximum size of the list
        uint256 size;                        // Current size of the list
        mapping (address => Node) nodes;     // Track the corresponding ids for each node in the list
    }

    Data public data;

    // --- Dependency setters --- 

    function setParams(uint256 _size, address _TroveManagerAddress, address _borrowerOperationsAddress) external override onlyOwner {
        require(_size > 0, "SortedTroves: Size can’t be zero");

        data.maxSize = _size;

        TroveManagerAddress = _TroveManagerAddress;
        troveManager = ITroveManager(_TroveManagerAddress);
        borrowerOperationsAddress = _borrowerOperationsAddress;

        emit TroveManagerAddressChanged(_TroveManagerAddress);
        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);

        _renounceOwnership();
    }

    /*
     * @dev Add a node to the list
     * @param _id Node's id
     * @param _ICR Node's ICR
     * @param _prevId Id of previous node for the insert position
     * @param _nextId Id of next node for the insert position
     */

    function insert (address _id, uint256 _ICR, uint _price, address _prevId, address _nextId) external override {
        _requireCallerIsBOorTroveM();
        _insert (_id, _ICR, _price, _prevId, _nextId);
    }
    
    function _insert(address _id, uint256 _ICR, uint _price, address _prevId, address _nextId) internal {
        // List must not be full
        require(!isFull());  
        // List must not already contain node
        require(!contains(_id));  
        // Node id must not be null
        require(_id != address(0));  
        // ICR must be non-zero
        require(_ICR > 0); 

        address prevId = _prevId; 
        address nextId = _nextId; 

        if (!validInsertPosition(_ICR, _price, prevId, nextId)) {
            // Sender's hint was not a valid insert position
            // Use sender's hint to find a valid insert position
            (prevId, nextId) = findInsertPosition(_ICR, _price, prevId, nextId);   
        }
        
         data.nodes[_id].exists = true;  
    
        if (prevId == address(0) && nextId == address(0)) {
            // Insert as head and tail
            data.head = _id; 
            data.tail = _id; 
        } else if (prevId == address(0)) { 
            // Insert before `prevId` as the head
            data.nodes[_id].nextId = data.head; 
            data.nodes[data.head].prevId = _id;  
            data.head = _id; 
        } else if (nextId == address(0)) {
            // Insert after `nextId` as the tail
            data.nodes[_id].prevId = data.tail;
            data.nodes[data.tail].nextId = _id;
            data.tail = _id;
        } else { 
            // Insert at insert position between `prevId` and `nextId`
            data.nodes[_id].nextId = nextId; 
            data.nodes[_id].prevId = prevId; 
            data.nodes[prevId].nextId = _id; 
            data.nodes[nextId].prevId = _id; 
        }

        data.size = data.size.add(1); 
    }

    function remove(address _id) external override {
        _requireCallerIsTroveManager();
        _remove(_id);
    }

    /*
     * @dev Remove a node from the list
     * @param _id Node's id
     */
    function _remove(address _id) internal {
        // List must contain the node
        require(contains(_id)); 

        if (data.size > 1) { 
            // List contains more than a single node
            if (_id == data.head) { 
                // The removed node is the head
                // Set head to next node
                data.head = data.nodes[_id].nextId; 
                // Set prev pointer of new head to null
                data.nodes[data.head].prevId = address(0); 
            } else if (_id == data.tail) {
                // The removed node is the tail
                // Set tail to previous node
                data.tail = data.nodes[_id].prevId;
                // Set next pointer of new tail to null
                data.nodes[data.tail].nextId = address(0);
            } else {
                // The removed node is neither the head nor the tail
                // Set next pointer of previous node to the next node
                data.nodes[data.nodes[_id].prevId].nextId = data.nodes[_id].nextId;
                // Set prev pointer of next node to the previous node
                data.nodes[data.nodes[_id].nextId].prevId = data.nodes[_id].prevId;
            }
        } else {
            // List contains a single node
            // Set the head and tail to null
            data.head = address(0);
            data.tail = address(0);
        }

        delete data.nodes[_id]; 
        data.size = data.size.sub(1); 
    }

    /*
     * @dev Re-insert the node at a new position, based on its new ICR
     * @param _id Node's id
     * @param _newICR Node's new ICR
     * @param _prevId Id of previous node for the new insert position
     * @param _nextId Id of next node for the new insert position
     */
    function reInsert(address _id, uint256 _newICR, uint _price, address _prevId, address _nextId) external override {
        _requireCallerIsBOorTroveM();
        // List must contain the node
        require(contains(_id));

        // Remove node from the list
        _remove(_id);

        if (_newICR > 0) {
            // Insert node if it has a non-zero ICR
            _insert(_id, _newICR, _price, _prevId, _nextId);
        }
    }

    /*
     * @dev Checks if the list contains a node
     */
    function contains(address _id) public view override returns (bool) {
        return data.nodes[_id].exists;
    }

    /*
     * @dev Checks if the list is full
     */
    function isFull() public view override returns (bool) {
        return data.size == data.maxSize;
    }

    /*
     * @dev Checks if the list is empty
     */
    function isEmpty() public view override returns (bool) {
        return data.size == 0;
    }

    /*
     * @dev Returns the current size of the list
     */
    function getSize() external view override returns (uint256) {
        return data.size;
    }

    /*
     * @dev Returns the maximum size of the list
     */
    function getMaxSize() external view override returns (uint256) {
        return data.maxSize;
    }

    /*
     * @dev Returns the first node in the list (node with the largest ICR)
     */
    function getFirst() external view override returns (address) {
        return data.head;
    }

    /*
     * @dev Returns the last node in the list (node with the smallest ICR)
     */
    function getLast() external view override returns (address) {
        return data.tail;
    }

    /*
     * @dev Returns the next node (with a smaller ICR) in the list for a given node
     * @param _id Node's id
     */
    function getNext(address _id) external view override returns (address) {
        return data.nodes[_id].nextId;
    }

    /*
     * @dev Returns the previous node (with a larger ICR) in the list for a given node
     * @param _id Node's id
     */
    function getPrev(address _id) external view override returns (address) {
        return data.nodes[_id].prevId;
    }

    /*
     * @dev Check if a pair of nodes is a valid insertion point for a new node with the given ICR
     * @param _ICR Node's ICR
     * @param _prevId Id of previous node for the insert position
     * @param _nextId Id of next node for the insert position
     */
    function validInsertPosition(uint256 _ICR, uint _price, address _prevId, address _nextId) public view override returns (bool) {
        if (_prevId == address(0) && _nextId == address(0)) {
            // `(null, null)` is a valid insert position if the list is empty
            return isEmpty();
        } else if (_prevId == address(0)) {
            // `(null, _nextId)` is a valid insert position if `_nextId` is the head of the list
            return data.head == _nextId && _ICR >= troveManager.getCurrentICR(_nextId, _price);
        } else if (_nextId == address(0)) {
            // `(_prevId, null)` is a valid insert position if `_prevId` is the tail of the list
            return data.tail == _prevId && _ICR <= troveManager.getCurrentICR(_prevId, _price);
        } else {
            // `(_prevId, _nextId)` is a valid insert position if they are adjacent nodes and `_ICR` falls between the two nodes' ICRs
            return data.nodes[_prevId].nextId == _nextId && 
                   troveManager.getCurrentICR(_prevId, _price) >= _ICR && 
                   _ICR >= troveManager.getCurrentICR(_nextId, _price);
        }
    }

    /*
     * @dev Descend the list (larger ICRs to smaller ICRs) to find a valid insert position
     * @param _ICR Node's ICR
     * @param _startId Id of node to start descending the list from
     */
    function _descendList(uint256 _ICR, uint _price, address _startId) internal view returns (address, address) {
        // If `_startId` is the head, check if the insert position is before the head
        if (data.head == _startId && _ICR >= troveManager.getCurrentICR(_startId, _price)) {
            return (address(0), _startId);
        }

        address prevId = _startId;
        address nextId = data.nodes[prevId].nextId;

        // Descend the list until we reach the end or until we find a valid insert position
        while (prevId != address(0) && !validInsertPosition(_ICR, _price, prevId, nextId)) {
            prevId = data.nodes[prevId].nextId;
            nextId = data.nodes[prevId].nextId;
        }

        return (prevId, nextId);
    }

    /*
     * @dev Ascend the list (smaller ICRs to larger ICRs) to find a valid insert position
     * @param _ICR Node's ICR
     * @param _startId Id of node to start ascending the list from
     */
    function _ascendList(uint256 _ICR, uint _price, address _startId) internal view returns (address, address) {       
        // If `_startId` is the tail, check if the insert position is after the tail
        if (data.tail == _startId && _ICR <= troveManager.getCurrentICR(_startId, _price)) {
            return (_startId, address(0));
        }

        address nextId = _startId;
        address prevId = data.nodes[nextId].prevId;

        // Ascend the list until we reach the end or until we find a valid insertion point
        while (nextId != address(0) && !validInsertPosition(_ICR, _price, prevId, nextId)) {
            nextId = data.nodes[nextId].prevId;
            prevId = data.nodes[nextId].prevId;
        }

        return (prevId, nextId);
    }

    /*
     * @dev Find the insert position for a new node with the given ICR
     * @param _ICR Node's ICR
     * @param _prevId Id of previous node for the insert position
     * @param _nextId Id of next node for the insert position
     */
    function findInsertPosition(uint256 _ICR, uint _price, address _prevId, address _nextId) public view override returns (address, address) {
        address prevId = _prevId;
        address nextId = _nextId;

        if (prevId != address(0)) {
            if (!contains(prevId) || _ICR > troveManager.getCurrentICR(prevId, _price)) {
                // `prevId` does not exist anymore or now has a smaller ICR than the given ICR
                prevId = address(0);
            }
        }

        if (nextId != address(0)) {
            if (!contains(nextId) || _ICR < troveManager.getCurrentICR(nextId, _price)) {
                // `nextId` does not exist anymore or now has a larger ICR than the given ICR
                nextId = address(0);
            }
        }

        if (prevId == address(0) && nextId == address(0)) {
            // No hint - descend list starting from head
            return _descendList(_ICR, _price, data.head);
        } else if (prevId == address(0)) {
            // No `prevId` for hint - ascend list starting from `nextId`
            return _ascendList(_ICR, _price, nextId);
        } else if (nextId == address(0)) {
            // No `nextId` for hint - descend list starting from `prevId`
            return _descendList(_ICR, _price, prevId);
        } else {
            // Descend list starting from `prevId`
            return _descendList(_ICR, _price, prevId);
        }
    }

    // --- 'require' functions ---

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == TroveManagerAddress, "SortedTroves: Caller is not the TroveManager");
    }

    function _requireCallerIsBOorTroveM() internal view {
        require(msg.sender == borrowerOperationsAddress || msg.sender == TroveManagerAddress,
                "SortedTroves: Caller is neither BO nor TroveM");
    }
}
