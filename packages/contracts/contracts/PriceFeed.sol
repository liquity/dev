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

    // TODO: convert received Chainlink price to precision-18 before setting state variable
    function updatePrice() external override returns (uint256) {
        _requireCallerIsCDPManager();
        price = getLatestPrice();
        emit PriceUpdated(price);
        return price;
    }

    function getLatestPrice() public view override returns (uint256) {
        int256 intPrice = priceAggregator.currentAnswer();
        require(intPrice >= 0, "Price response from aggregator is negative int");

        return uint256(intPrice);
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

    // --- 'require' functions ---

    function _requireCallerIsCDPManager() internal view {
        require(msg.sender == cdpManagerAddress,
            "PriceFeed: Caller is not CDPManager"
        );
    }
}
