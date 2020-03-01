/* Interface for the mainnet deployed Chainlink aggregator reference contract. Differs from the aggregator interface
in the Chainlink npm package */
interface IDeployedAggregator {
  function latestCompletedAnswer (  ) external view returns ( uint256 );
  function currentAnswer (  ) external view returns ( int256 );
  function updatedHeight (  ) external view returns ( uint256 );
}