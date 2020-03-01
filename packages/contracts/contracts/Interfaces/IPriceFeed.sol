pragma solidity ^0.5.11;

interface IPriceFeed { 
    // --- Events ---
    event PriceUpdated(uint _newPrice);
    event CDPManagerAddressChanged(address _cdpManagerAddress);
    event PoolManagerAddressChanged(address _poolManagerAddress);

    // --- Functions ---
    function setCDPManagerAddress(address _cdpManagerAddress) external;

    function setPoolManagerAddress(address _poolManagerAddress) external;

    function setPrice(uint _price) external returns(bool);
        
    function getPrice() external view returns(uint);

    // --- Chainlink functions ---
    function setAggregator(address _priceAggregatorAddress) external;

    function updatePrice() external returns(uint256);

    function getLatestPrice() external view returns(uint256);

    function getLatestAnswerID() external view returns(uint256);

    function getLatestTimestamp() external view returns(uint256);

}
