pragma solidity ^0.5.11;

import "./Interfaces/ISortedCDPs.sol";
import "./Interfaces/ICDPManager.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@nomiclabs/buidler/console.sol";

/* 
A sorted doubly linked list with nodes sorted in descending order, based on current ICRs of active CDPs. 
Optionally accepts insert position hints.

ICRs are computed dynamically at runtime, and not stored on the Node. This is because ICRs of active CDPs 
change dynamically as liquidation events occur.

The list relies on the fact that liquidation events preserve ordering: a liquidation decreases the ICRs of all active CDPs, 
but maintains their order. A node inserted based on current ICR will maintain the correct position, 
relative to it's peers, as rewards accumulate. Thus, Nodes remain sorted by current ICR.

Nodes need only be re-inserted upon a CDP operation - when the owner adds or removes collateral or debt.

The list is a modification of the following audited SortedDoublyLinkedList:
https://github.com/livepeer/protocol/blob/master/contracts/libraries/SortedDoublyLL.sol

In our variant, keys have been removed, and all ICR checks in functions now compare an ICR argument to the current ICR, 
calculated at runtime. Data is stored in the 'data' state variable.
*/
contract SortedCDPs is Ownable, ISortedCDPs {
    using SafeMath for uint256;

    event CDPManagerAddressChanged(address _newCDPlManagerAddress);

    ICDPManager cdpManager;
    address CDPManagerAddress;

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

    Data data;

    function setCDPManager(address _CDPManagerAddress) public onlyOwner {
        CDPManagerAddress = _CDPManagerAddress;
        cdpManager = ICDPManager(_CDPManagerAddress);
        emit CDPManagerAddressChanged(_CDPManagerAddress);
    }

    /*
     * @dev Set the maximum size of the list
     * @param _size Maximum size
     */
    function setMaxSize(uint256 _size) public {
        // New max size must be greater than old max size
        require(_size > data.maxSize);

        data.maxSize = _size;
    }

    /*
     * @dev Add a node to the list
     * @param _id Node's id
     * @param _ICR Node's ICR
     * @param _prevId Id of previous node for the insert position
     * @param _nextId Id of next node for the insert position
     */
    function insert(address _id, uint256 _ICR, uint _price, address _prevId, address _nextId) public {
        // console.log("insert()");
        // console.log("00. gas left: %s", gasleft());
        // List must not be full
        require(!isFull());  // 1650 gas
        // console.log("01. gas left: %s", gasleft());
        // List must not already contain node
        require(!contains(_id));  // 900 gas
        // console.log("02. gas left: %s", gasleft());
        // Node id must not be null
        require(_id != address(0));  // 26 gas
        // console.log("03. gas left: %s", gasleft());
        // ICR must be non-zero
        require(_ICR > 0); // 16 gas
        // console.log("04. gas left: %s", gasleft());

        address prevId = _prevId; // 2 gas
        // console.log("05. gas left: %s", gasleft());
        address nextId = _nextId; // 3 gas
        // console.log("06. gas left: %s", gasleft());

        if (!validInsertPosition(_ICR, _price, prevId, nextId)) {
            // Sender's hint was not a valid insert position
            // Use sender's hint to find a valid insert position
            (prevId, nextId) = findInsertPosition(_ICR, _price, prevId, nextId);  // 20k gas with 0 traversals
        }
        // console.log("07. gas left: %s", gasleft());
        data.nodes[_id].exists = true;  // *** 20k gas for false --> true
        // console.log("08. gas left: %s", gasleft());

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
            // console.log("09. gas left: %s", gasleft());
            // Insert at insert position between `prevId` and `nextId`
            data.nodes[_id].nextId = nextId;
            // console.log("10. gas left: %s", gasleft());
            data.nodes[_id].prevId = prevId;
            // console.log("11. gas left: %s", gasleft());
            data.nodes[prevId].nextId = _id;
            // console.log("12. gas left: %s", gasleft());
            data.nodes[nextId].prevId = _id;
            // console.log("13. gas left: %s", gasleft());
        }

        data.size = data.size.add(1);  // 1700 gas
    }

    /*
     * @dev Remove a node from the list
     * @param _id Node's id
     */
    function remove(address _id) public {
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
    function reInsert(address _id, uint256 _newICR, uint _price, address _prevId, address _nextId) public {
        // List must contain the node
        require(contains(_id));

        // Remove node from the list
        remove(_id);

        if (_newICR > 0) {
            // Insert node if it has a non-zero ICR
            insert(_id, _price, _newICR, _prevId, _nextId);
        }
    }

    /*
     * @dev Checks if the list contains a node
     * @param _transcoder Address of transcoder
     */
    function contains(address _id) public view returns (bool) {
        return data.nodes[_id].exists;
    }

    /*
     * @dev Checks if the list is full
     */
    function isFull() public view returns (bool) {
        return data.size == data.maxSize;
    }

    /*
     * @dev Checks if the list is empty
     */
    function isEmpty() public view returns (bool) {
        return data.size == 0;
    }

    /*
     * @dev Returns the current size of the list
     */
    function getSize() public view returns (uint256) {
        return data.size;
    }

    /*
     * @dev Returns the maximum size of the list
     */
    function getMaxSize() public view returns (uint256) {
        return data.maxSize;
    }

    /*
     * @dev Returns the first node in the list (node with the largest ICR)
     */
    function getFirst() public view returns (address) {
        return data.head;
    }

    /*
     * @dev Returns the last node in the list (node with the smallest ICR)
     */
    function getLast() public view returns (address) {
        return data.tail;
    }

    /*
     * @dev Returns the next node (with a smaller ICR) in the list for a given node
     * @param _id Node's id
     */
    function getNext(address _id) public view returns (address) {
        return data.nodes[_id].nextId;
    }

    /*
     * @dev Returns the previous node (with a larger ICR) in the list for a given node
     * @param _id Node's id
     */
    function getPrev(address _id) public view returns (address) {
        return data.nodes[_id].prevId;
    }

    /*
     * @dev Check if a pair of nodes is a valid insertion point for a new node with the given ICR
     * @param _ICR Node's ICR
     * @param _prevId Id of previous node for the insert position
     * @param _nextId Id of next node for the insert position
     */
    function validInsertPosition(uint256 _ICR, uint _price, address _prevId, address _nextId) public view returns (bool) {
        if (_prevId == address(0) && _nextId == address(0)) {
            // `(null, null)` is a valid insert position if the list is empty
            return isEmpty();
        } else if (_prevId == address(0)) {
            // `(null, _nextId)` is a valid insert position if `_nextId` is the head of the list
            return data.head == _nextId && _ICR >= cdpManager.getCurrentICR(_nextId, _price);
        } else if (_nextId == address(0)) {
            // `(_prevId, null)` is a valid insert position if `_prevId` is the tail of the list
            return data.tail == _prevId && _ICR <= cdpManager.getCurrentICR(_prevId, _price);
        } else {
            // `(_prevId, _nextId)` is a valid insert position if they are adjacent nodes and `_ICR` falls between the two nodes' ICRs
            return data.nodes[_prevId].nextId == _nextId && 
                   cdpManager.getCurrentICR(_prevId, _price) >= _ICR && 
                   _ICR >= cdpManager.getCurrentICR(_nextId, _price);
        }
    }

    /*
     * @dev Descend the list (larger ICRs to smaller ICRs) to find a valid insert position
     * @param _ICR Node's ICR
     * @param _startId Id of node to start ascending the list from
     */
    function descendList(uint256 _ICR, uint _price, address _startId) private view returns (address, address) {
        // If `_startId` is the head, check if the insert position is before the head
        if (data.head == _startId && _ICR >= cdpManager.getCurrentICR(_startId, _price)) {
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
     * @param _startId Id of node to start descending the list from
     */
    function ascendList(uint256 _ICR, uint _price, address _startId) private view returns (address, address) {
        // If `_startId` is the tail, check if the insert position is after the tail
        if (data.tail == _startId && _ICR <= cdpManager.getCurrentICR(_startId, _price)) {
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
    function findInsertPosition(uint256 _ICR, uint _price, address _prevId, address _nextId) public view returns (address, address) {
        address prevId = _prevId;
        address nextId = _nextId;

        if (prevId != address(0)) {
            if (!contains(prevId) || _ICR > cdpManager.getCurrentICR(prevId, _price)) {
                // `prevId` does not exist anymore or now has a smaller ICR than the given ICR
                prevId = address(0);
            }
        }

        if (nextId != address(0)) {
            if (!contains(nextId) || _ICR < cdpManager.getCurrentICR(nextId, _price)) {
                // `nextId` does not exist anymore or now has a larger ICR than the given ICR
                nextId = address(0);
            }
        }

        if (prevId == address(0) && nextId == address(0)) {
            // No hint - descend list starting from head
            return descendList(_ICR, _price, data.head);
        } else if (prevId == address(0)) {
            // No `prevId` for hint - ascend list starting from `nextId`
            return ascendList(_ICR, _price, nextId);
        } else if (nextId == address(0)) {
            // No `nextId` for hint - descend list starting from `prevId`
            return descendList(_ICR, _price, prevId);
        } else {
            // Descend list starting from `prevId`
            return descendList(_ICR, _price, prevId);
        }
    }
}