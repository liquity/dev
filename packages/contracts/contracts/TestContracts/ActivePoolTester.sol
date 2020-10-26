pragma solidity 0.5.16;

import "../ActivePool.sol";


contract ActivePoolTester is ActivePool {
    function unprotectedIncreaseCLVDebt(uint _amount) external {
        CLVDebt  = CLVDebt.add(_amount);
    }

    function unprotectedPayable() external payable {
        ETH = ETH.add(msg.value);
    }
}
