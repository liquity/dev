// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../DefaultPool.sol";

contract DefaultPoolTester is DefaultPool {
    
    function unprotectedincreaseDebt(uint _amount) external {
        Debt  = Debt.add(_amount);
    }

    function unprotectedPayable() external payable {
        Collateral = Collateral.add(msg.value);
    }
}
