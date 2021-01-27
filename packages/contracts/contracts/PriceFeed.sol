// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IPriceFeed.sol";
import "./Dependencies/AggregatorV3Interface.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";

/*
* PriceFeed for mainnet deployment, to be connected to Chainlink's live ETH:USD aggregator reference contract.
*/
contract PriceFeed is Ownable, CheckContract, IPriceFeed {
    using SafeMath for uint256;

    // Mainnet Chainlink aggregator
    AggregatorV3Interface public priceAggregator;

    // Use to convert to 18-digit precision uints
    uint8 constant public TARGET_DIGITS = 18;  

    // --- Dependency setters ---

    function setAddresses(
        address _priceAggregatorAddress
    )
        external
        onlyOwner
    {
        checkContract(_priceAggregatorAddress);

        priceAggregator = AggregatorV3Interface(_priceAggregatorAddress);
        _renounceOwnership();
    }

    /**
     * Returns the latest price obtained from the Chainlink ETH:USD aggregator reference contract.
     * https://docs.chain.link/docs/get-the-latest-price
     */
    function getPrice() public view override returns (uint) {
        (, int priceAnswer,, uint timeStamp,) = priceAggregator.latestRoundData();
    
        require(timeStamp > 0 && timeStamp <= block.timestamp, "PriceFeed: price timestamp from aggregator is 0, or in future");
        require(priceAnswer >= 0, "PriceFeed: price answer from aggregator is negative");
        
        uint answerDigits = priceAggregator.decimals();
        uint price = uint256(priceAnswer);
        
        // Currently the Aggregator returns an 8-digit precision, but we handle the case of future changes
        if (answerDigits > TARGET_DIGITS) { 
            price = price.div(10 ** uint(answerDigits - TARGET_DIGITS));
        }
        else if (answerDigits < TARGET_DIGITS) {
            price = price.mul(10 ** uint(TARGET_DIGITS - answerDigits));
        } 
        return price;
    }
}
