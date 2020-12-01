// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IPriceFeedTestnet.sol";
import "./Dependencies/AggregatorV3Interface.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract PriceFeedTestnet is Ownable, IPriceFeedTestnet {
    using SafeMath for uint256;
    
    uint256 private _price = 200 * 1e18;

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
