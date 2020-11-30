// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IPriceFeedTestnet.sol";
import "./Dependencies/AggregatorV3Interface.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract PriceFeedTestnet is Ownable, IPriceFeedTestnet {
    using SafeMath for uint256;
    
    uint256 private _price = 200 * DIGITS;
    uint256 constant DIGITS = 1e18;
    
    address public priceAggregatorAddress;
    AggregatorV3Interface public priceAggregator;

    // --- Dependency setters ---
    /**
     * Network: Kovan
     * Aggregator: ETH/USD
     * Address: 0x9326BFA02ADD2366b30bacB125260Af641031331
     */
    function setAddresses(
        address _priceAggregatorAddress
    )
        external
        override
        onlyOwner
    {
        priceAggregatorAddress = _priceAggregatorAddress;
        if (priceAggregatorAddress != address(0)) {
            priceAggregator = AggregatorV3Interface(_priceAggregatorAddress);
        }
        _renounceOwnership();
    }

    // --- Functions ---

    function getPrice() external view override returns (uint256) {
        if (priceAggregatorAddress != address(0)) {
            (uint scaled, uint8 dec) = getLatestPrice();
            scaled = scaled.mul(10000000000);
            require(scaled % 10 == DIGITS, "Bad price precision");
            return scaled;
        }
        return _price;
    }

    // Manual external price setter.
    function setPrice(uint256 price) external override returns (bool) {
        _price = price;
        return true;
    }

    /**
     * Returns the latest price
     * https://docs.chain.link/docs/get-the-latest-price
     */
    function getLatestPrice() public view override
    returns (uint price, uint8 decimals) {
        (uint80 roundID, int answer,
        uint startedAt, uint timeStamp,
        uint80 answeredInRound) = priceAggregator.latestRoundData();
        // If the round is not complete yet, timestamp is 0
        require(timeStamp > 0 && timeStamp <= block.timestamp, "Bad timeStamp");
        require(price >= 0, "Negative price");
        decimals = priceAggregator.decimals();
        price = uint256(answer);
    }
}
