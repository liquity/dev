// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/IDeployedAggregator.sol";
import "./Interfaces/AggregatorInterface.sol";
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

    uint256 public price = 200 * 1e18;  // initial ETH:USD price of 200

    address public cdpManagerAddress;
    address public priceAggregatorAddress; // unused  
    address public priceAggregatorAddressTestnet; // unused

    event PriceUpdated(uint256 _newPrice);
    event TroveManagerAddressChanged(address _cdpManagerAddress);

    // --- Dependency setters ---

    function setAddresses(
        address _cdpManagerAddress,
        address _priceAggregatorAddress, // passed 0x0 in tests
        address _priceAggregatorAddressTestnet // passed 0x0 in tests
    )
        external
        override
        onlyOwner
    {
        cdpManagerAddress = _cdpManagerAddress;
        priceAggregatorAddress = _priceAggregatorAddress;
        priceAggregatorAddressTestnet = _priceAggregatorAddressTestnet;
      
        emit TroveManagerAddressChanged(_cdpManagerAddress);

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
}
