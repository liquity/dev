// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../DefaultPool.sol";

contract DefaultPoolTester is DefaultPool {
    
    function unprotectedIncrease1USDDebt(uint _amount) external {
        ONEUSDDebt  = ONEUSDDebt.add(_amount);
    }

    function unprotectedPayable() external payable {
        ONE = ONE.add(msg.value);
    }
}
