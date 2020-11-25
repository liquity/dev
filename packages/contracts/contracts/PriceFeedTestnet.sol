// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/ICDPManager.sol";
import "./Interfaces/IPriceFeedTestnet.sol";
import "./Interfaces/AggregatorInterface.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract PriceFeedTestnet is Ownable, IPriceFeedTestnet {
    using SafeMath for uint256;

    uint256 constant DIGITS = 1e18;
    uint256 public price = 200 * DIGITS;

    address public cdpManagerAddress;
    address public priceAggregatorAddress;
    AggregatorInterface public priceAggregator;

    event PriceUpdated(uint256 _newPrice);
    event CDPManagerAddressChanged(address _cdpManagerAddress);

    // --- Dependency setters ---

    function setAddresses(
        address _cdpManagerAddress,
        address _priceAggregatorAddress
    )
        external
        override
        onlyOwner
    {
        cdpManagerAddress = _cdpManagerAddress;

        priceAggregator = AggregatorInterface(_priceAggregatorAddress);
        priceAggregatorAddress = _priceAggregatorAddress;

        emit CDPManagerAddressChanged(_cdpManagerAddress);

        _renounceOwnership();
    }

    // --- Functions ---

    function getPrice() external view override returns (uint256) {
        return price;
    }

    // Manual external price setter.
    function setPrice(uint256 _price) external override returns (bool) {
        price = _price;
        emit PriceUpdated(price);
        return true;
    }

    function updatePrice() external override returns (uint256) {
        price = getLatestPrice();
        emit PriceUpdated(price);
        return price;
    }

    function getLatestPrice() public view override returns (uint256) {
        int256 intPrice = priceAggregator.latestAnswer();
        require( intPrice >= 0, "Price response from aggregator is negative int");

        return uint256(intPrice).mul(10000000000);
    }

    // Get the block timestamp at which the reference data was last updated
    function getLatestTimestamp() external view override returns (uint256) {
        uint256 latestTimestamp = priceAggregator.latestTimestamp();

        return latestTimestamp;
    }

    // Get the past price from 'n' rounds ago
    function getPreviousPrice(uint256 _n) external view override returns (uint256) {
        uint256 latestAnswerID = priceAggregator.latestRound();
        require(_n <= latestAnswerID, "Not enough history");

        int256 prevPrice = priceAggregator.getAnswer(latestAnswerID - _n);
        require(prevPrice >= 0, "Price response from aggregator is negative int");

        return uint256(prevPrice).mul(10000000000);
    }

    // Get the block timestamp from the round that occurred 'n' rounds ago
    function getPreviousTimestamp(uint256 _n) external view override returns (uint256) {
        uint256 latestAnswerID = priceAggregator.latestRound();
        require(_n <= latestAnswerID, "Not enough history");

        return priceAggregator.getTimestamp(latestAnswerID - _n);
    }

    // --- 'require' functions ---

    function _requireCallerIsCDPManager() internal view {
        require(msg.sender == cdpManagerAddress,
            "PriceFeed: Caller is not CDPManager"
        );
    }
}
