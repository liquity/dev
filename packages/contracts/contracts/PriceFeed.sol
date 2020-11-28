// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/ICDPManager.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/IDeployedAggregator.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract PriceFeed is Ownable, IPriceFeed {
    using SafeMath for uint256;

    uint256 constant DIGITS = 1e18;
    uint256 public price = 200 * DIGITS;

    address public cdpManagerAddress;

    // Mainnet Chainlink aggregator
    address public priceAggregatorAddress;
    IDeployedAggregator public priceAggregator;

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
        
        // Mainnet Chainlink address setter
        priceAggregatorAddress = _priceAggregatorAddress;
        priceAggregator = IDeployedAggregator(_priceAggregatorAddress);

        emit CDPManagerAddressChanged(_cdpManagerAddress);

        _renounceOwnership();
    }

    function updatePrice() external override returns (uint256 price) {
        _requireCallerIsCDPManager();
        (uint price, uint8 decimal) = getLatestPrice();
        emit PriceUpdated(price);
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

    function getLatestAnswerID() external view override returns (uint256) {
        return priceAggregator.latestCompletedAnswer();
    }

    // Get the block timestamp at which the reference price was last updated
    function getLatestTimestamp() external view override returns (uint256) {
        return priceAggregator.updatedHeight();
    }

    function getPrice() external view override returns (uint256) {
        return price;
    }

<<<<<<< HEAD
=======
    function getLatestPrice_Testnet() public view override returns (uint256) {
        int256 intPrice = priceAggregator_Testnet.latestAnswer();
        require( intPrice >= 0, "Price response from aggregator is negative int");

        return uint256(intPrice).mul(1e10);
    }

    // Get the block timestamp at which the reference data was last updated
    function getLatestTimestamp_Testnet() external view override returns (uint256) {
        uint256 latestTimestamp = priceAggregator_Testnet.latestTimestamp();

        return latestTimestamp;
    }

    // Get the past price from 'n' rounds ago
    function getPreviousPrice_Testnet(uint256 _n) external view override returns (uint256) {
        uint256 latestAnswerID = priceAggregator_Testnet.latestRound();
        require(_n <= latestAnswerID, "Not enough history");

        int256 prevPrice = priceAggregator_Testnet.getAnswer(latestAnswerID - _n);
        require(prevPrice >= 0, "Price response from aggregator is negative int");

        return uint256(prevPrice).mul(1e10);
    }

    // Get the block timestamp from the round that occurred 'n' rounds ago
    function getPreviousTimestamp_Testnet(uint256 _n) external view override returns (uint256) {
        uint256 latestAnswerID = priceAggregator_Testnet.latestRound();
        require(_n <= latestAnswerID, "Not enough history");

        return priceAggregator_Testnet.getTimestamp(latestAnswerID - _n);
    }

>>>>>>> c9afec9ffb3b6d2c9f39d690dc6cf67fc6d67424
    // --- 'require' functions ---

    function _requireCallerIsCDPManager() internal view {
        require(msg.sender == cdpManagerAddress,
            "PriceFeed: Caller is not CDPManager"
        );
    }
}
