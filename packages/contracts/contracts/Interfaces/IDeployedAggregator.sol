// SPDX-License-Identifier: MIT

import "../Dependencies/AggregatorV2V3Interface.sol";

pragma solidity 0.6.11;

/**
 * Interface for the mainnet deployed Chainlink aggregator reference contract. 
 * Differs from the aggregator interface in the Chainlink npm package
 */ 
 
interface IDeployedAggregator is AggregatorV2V3Interface {

  function latestCompletedAnswer() external view returns (uint256);

  function currentAnswer() external view returns (int256);
  
  function updatedHeight() external view returns (uint256);
}
