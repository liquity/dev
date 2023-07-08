// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../ActivePool.sol";

contract ActivePoolTester is ActivePool {
    
    function unprotectedIncreaseXBRLDebt(uint _amount) external {
        XBRLDebt  = XBRLDebt.add(_amount);
    }

    function unprotectedPayable() external payable {
        ETH = ETH.add(msg.value);
    }
}
