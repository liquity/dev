// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../DefaultPool.sol";

contract DefaultPoolTester is DefaultPool {
    
    function unprotectedIncreaseXBRLDebt(uint256 _amount) external {
        XBRLDebt += _amount;
    }

    function unprotectedPayable() external payable {
        ETH += msg.value;
    }
}
