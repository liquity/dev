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

    // Use to convert an 8-digit precision uint -> 18-digit precision uint
    uint constant public DECIMAL_PRECISION_CONVERTER = 1e10;  

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
     * Returns the latest price obtained from the Chainlink ETH:USD aggregator reference contract.
     * https://docs.chain.link/docs/get-the-latest-price
     */
    function getPrice() public view override returns (uint) {
        (uint80 roundID, int priceAnswer,
        uint startedAt, uint timeStamp,
        uint80 answeredInRound) = priceAggregator.latestRoundData();
        
        require(timeStamp > 0 && timeStamp <= block.timestamp, "PriceFeed: price timestamp from aggregator is 0, or in future");
        require(priceAnswer >= 0, "PriceFeed: price answer from aggregator is negative");
       
        uint price = uint256(priceAnswer).mul(DECIMAL_PRECISION_CONVERTER);
        return price;
    }
}
