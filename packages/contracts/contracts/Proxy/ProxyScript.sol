// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/IBorrowerOperations.sol";

contract ProxyScript {

    address public borrowerOperationsAddress;
    
    constructor (address _borrowerOperationsAddress) public {  
        borrowerOperationsAddress = _borrowerOperationsAddress;        
    }

    function open(uint _amt) external payable {
        IBorrowerOperations(borrowerOperationsAddress).openTrove{value: msg.value}(_amt, address(0));
    }

}
