// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/IBorrowerOperations.sol";

contract ProxyScript {

    IBorrowerOperations ibo; 
    
    constructor (address _borrowerOperationsAddress) public {  
        ibo = IBorrowerOperations(_borrowerOperationsAddress);        
    }

    function open(uint _amt) external payable {
        ibo.openTrove{value: msg.value}(_amt, msg.sender);
    }

}
