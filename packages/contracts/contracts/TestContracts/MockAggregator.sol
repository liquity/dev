// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/AggregatorV3Interface.sol";

contract MockAggregator is AggregatorV3Interface {
    
    // storage variables to hold the mock data
    uint8 private decimalsVal;
    int private price;
    uint private updateTime;

    enum Output { good, zeroTimestamp, futureTimestamp, negativePrice }

    Output output;
    
    // --- Functions ---

    function setDecimals(uint8 _decimals) external returns (bool) {
        decimalsVal = _decimals;
    }

    function setPrice(int _price) external returns (bool) {
        price = _price;
    }

    function setUpdateTime(uint _updateTime) external returns (bool) {
        updateTime = _updateTime;
    }

    // --- Getters that adhere to the AggregatorV3 interface ---

    function decimals() external override view returns (uint8) {
        return decimalsVal;
    }

    function latestRoundData()
        external
        override
        view
    returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) 
    {
        return (0, price, 0, updateTime, 0); 
    }

    // --- Unused, just here for compilation's sake ---

    function getRoundData(uint80)
    external
    override 
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ) {
        return (0,0,0,0,0);
    }
    function description() external override view returns (string memory) {
        return "";
    }
    function version() external override view returns (uint256) {
        return 1;
    }
}
