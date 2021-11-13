// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../ActivePool.sol";

contract ActivePoolTester is ActivePool {
    
    function unprotectedincreaseDebt(uint _amount) external {
        Debt  = Debt.add(_amount);
    }

    function unprotectedPayable() external payable {
        Collateral = Collateral.add(msg.value);
    }
}
