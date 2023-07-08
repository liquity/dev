// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

contract Destructible {
    
    receive() external payable {}
    
    function destruct(address payable _receiver) external {
        selfdestruct(_receiver);
    }
}
