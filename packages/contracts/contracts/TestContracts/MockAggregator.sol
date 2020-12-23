// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/AggregatorV3Interface.sol";

contract MockAggregator is AggregatorV3Interface {
    
    uint8 private _path = 1;

    // --- Functions ---

    function setPath(uint8 path) external returns (bool) {
        _path = path;
        return true;
    }

    function decimals() external override view returns (uint8) {
        if (_path == 1) {
            return 18;
        } else if (_path == 2) {
            return 21;
        } else if (_path == 3) {
            return 17;
        }
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
    ) {
        if (_path > 0 && _path < 4) { // good output
            return (0, 1000, 0, 1, 0);
        } else if (_path == 4) { // zero timestamp
            return (0, 1, 0, 0, 0);
        } else if (_path == 5) { // negative price
            return (0, -5, 0, 1, 0);
        }
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
