// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IPriceFeedTestnet.sol";
import "./Dependencies/AggregatorV3Interface.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

/*
* PriceFeed placeholder for testnet and development. The price is simply set manually and saved in a state 
* variable. The contract does not connect to a live Chainlink price feed. 
*/
contract PriceFeedTestnet is Ownable, IPriceFeedTestnet {
    using SafeMath for uint256;
    
    uint256 private _price = 200 * 1e18;

    // Does nothing, since this contract does not connect to Chainlink aggregator on Testnet
    function setAddresses(
        address _priceAggregatorAddress 
    )
        external
        override
        onlyOwner
    {
        _renounceOwnership();
    }

    // --- Functions ---

    function getPrice() external view override returns (uint256) {
        return _price;
    }

    // Manual external price setter.
    function setPrice(uint256 price) external override returns (bool) {
        _price = price;
        return true;
    }
}
