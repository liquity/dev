pragma solidity 0.5.16;

import "../DefaultPool.sol";


contract DefaultPoolTester is DefaultPool {
    function unprotectedIncreaseCLVDebt(uint _amount) external {
        CLVDebt  = CLVDebt.add(_amount);
    }

    function unprotectedPayable() external payable {
        ETH = ETH.add(msg.value);
    }
}
