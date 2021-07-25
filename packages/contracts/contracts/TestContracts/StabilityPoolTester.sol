// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../StabilityPool.sol";

contract StabilityPoolTester is StabilityPool {
    
    function unprotectedPayable() external payable {
        ETH = ETH.add(msg.value);
    }

    function setCurrentScale(uint128 _currentScale) external {
        currentScale = _currentScale;
    }

    function setTotalDeposits(uint _totalLUSDDeposits) external {
        totalLUSDDeposits = _totalLUSDDeposits;
    }
}
