// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../ActivePool.sol";

contract ActivePoolTester is ActivePool {
    
    function unprotectedIncreaseXBRLDebt(uint _amount) external {
        XBRLDebt += _amount;
    }

    function unprotectedPayable() external payable {
        ETH += msg.value;
    }
}
