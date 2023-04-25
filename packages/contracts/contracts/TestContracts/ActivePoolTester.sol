// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../ActivePool.sol";

contract ActivePoolTester is ActivePool {
    
    function unprotectedIncrease1USDDebt(uint _amount) external {
        ONEUSDDebt  = ONEUSDDebt.add(_amount);
    }

    function unprotectedPayable() external payable {
        ONE = ONE.add(msg.value);
    }
}
