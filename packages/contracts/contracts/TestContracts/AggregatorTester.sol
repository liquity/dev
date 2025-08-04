// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Aggregator.sol";

/* Tester contract inherits from Aggregator, and provides external functions 
for testing the parent's internal functions. */

contract AggregatorTester is Aggregator {

    function unprotectedDecayBaseRateFromBorrowing() external returns (uint) {
        baseRate = _calcDecayedBaseRate();
        assert(baseRate >= 0 && baseRate <= DECIMAL_PRECISION);
        
        _updateLastFeeOpTime();
        return baseRate;
    }

    function minutesPassedSinceLastFeeOp() external view returns (uint) {
        return _minutesPassedSinceLastFeeOp();
    }

    function setLastFeeOpTimeToNow() external {
        lastFeeOperationTime = block.timestamp;
    }

    function setBaseRate(uint _baseRate) external {
        baseRate = _baseRate;
    }

    function callGetRedemptionFee(uint _ETHDrawn) external view returns (uint) {
        getRedemptionFee(_ETHDrawn);
    }  

}
