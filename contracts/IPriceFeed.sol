pragma solidity ^0.5.11;

interface IPriceFeed { 
    // --- Events ---
    event PriceUpdated(uint _newPrice);

    event CDPManagerAddressChanged(address _cdpManagerAddress);

    // --- Functions ---
    function setCDPManagerAddress(address _cdpManagerAddress) external;

    function setPrice(uint _price) external returns(bool);
        
    function getPrice() external view returns(uint);
}
