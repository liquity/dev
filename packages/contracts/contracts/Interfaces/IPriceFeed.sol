// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface IPriceFeed {
    
    // --- Events ---
    
    event PriceUpdated(uint _newPrice);
    event CDPManagerAddressChanged(address _cdpManagerAddress);

    // --- Functions ---
    
     function setAddresses(
        address _cdpManagerAddress,
        address _priceAggregatorAddress,
        address _priceAggregatorAddressTestnet
    ) external;

    function setPrice(uint _price) external returns (bool);

    function getPrice() external view returns (uint);
}
