// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../ActivePool.sol";


contract ActivePoolTester is ActivePool {
    function unprotectedIncreaseCLVDebt(uint _amount) external {
        CLVDebt  = CLVDebt.add(_amount);
    }

    function unprotectedPayable() external payable {
        ETH = ETH.add(msg.value);
    }
}
