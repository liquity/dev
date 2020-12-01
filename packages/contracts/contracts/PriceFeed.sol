// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IPriceFeed.sol";
import "./Dependencies/AggregatorV3Interface.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

/*
*
* Placeholder PriceFeed for development and testing.
*
* Will eventually be replaced by a contract that fetches the current price from the Chainlink ETH:USD aggregator
* reference contract, and does not save price in a state variable.
*
*/
contract PriceFeed is Ownable, IPriceFeed {
    using SafeMath for uint256;

    // Mainnet Chainlink aggregator
    address public priceAggregatorAddress;
    AggregatorV3Interface public priceAggregator;

    // --- Dependency setters ---

    function setAddresses(
        address _priceAggregatorAddress
    )
        external
        override
        onlyOwner
    {
        priceAggregatorAddress = _priceAggregatorAddress;
        priceAggregator = AggregatorV3Interface(_priceAggregatorAddress);
        _renounceOwnership();
    }

    /**
     * Returns the latest price
     * https://docs.chain.link/docs/get-the-latest-price
     */
    function getPrice() public view override
    returns (uint) {
        (uint80 roundID, int response,
        uint startedAt, uint timeStamp,
        uint80 answeredInRound) = priceAggregator.latestRoundData();
        // If the round is not complete yet, timestamp is 0
        require(timeStamp > 0 && timeStamp <= block.timestamp, "Bad timestamp");
        require(response >= 0, "Negative price");
        // decimals = priceAggregator.decimals();
        uint price = uint256(response);
        return price.mul(1e10);
    }
}
