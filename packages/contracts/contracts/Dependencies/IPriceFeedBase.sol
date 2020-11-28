// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface IPriceFeedBase {
    
    // --- Events ---
    
    event PriceUpdated(uint _newPrice);
    event CDPManagerAddressChanged(address _cdpManagerAddress);

    // --- Functions ---
    
    function setAddresses(
        address _cdpManagerAddress,
        address _priceAggregatorAddress
    ) external;

    function getPrice() external view returns (uint);
    
    function getLatestPrice() external view returns (uint, uint8);

    function updatePrice() external returns (uint256);
}
