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

    // --- Chainlink Mainnet functions ---
    
    function updatePrice() external returns (uint256);

    function getLatestPrice() external view returns (uint256);

    function getLatestAnswerID() external view returns (uint256);

    function getLatestTimestamp() external view returns (uint256);

    // --- Chainlink Testnet functions ---
    
    function updatePrice_Testnet() external returns (uint256);

    function getLatestPrice_Testnet() external view returns (uint256);

    function getLatestTimestamp_Testnet() external view returns (uint256);

    function getPreviousPrice_Testnet(uint256 _n) external view returns (uint256);

    function getPreviousTimestamp_Testnet(uint256 _n) external view returns (uint256);
}
