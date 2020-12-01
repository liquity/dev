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

    uint256 constant DIGITS = 1e18;

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
        // Mainnet Chainlink address setter
        // require(_priceAggregatorAddress != address(0), 
        //        "Must set a price aggregator address");
        priceAggregatorAddress = _priceAggregatorAddress;
        priceAggregator = AggregatorV3Interface(_priceAggregatorAddress);

        _renounceOwnership();
    }

    /**
     * Returns the latest price
     * https://docs.chain.link/docs/get-the-latest-price
     */
    function getLatestPrice() public view override
    returns (uint price, uint8 decimals) {
        (uint80 roundID, int response,
        uint startedAt, uint timeStamp,
        uint80 answeredInRound) = priceAggregator.latestRoundData();
        // If the round is not complete yet, timestamp is 0
        require(timeStamp > 0 && timeStamp <= block.timestamp, "Bad timestamp");
        require(price >= 0, "Negative price");
        decimals = priceAggregator.decimals();
        price = uint256(response);
    }

    function getPrice() external view override returns (uint256) {
        (uint scaled, uint8 dec) = getLatestPrice();
        scaled = scaled.mul(1e10);
        return scaled;
    }
}
