pragma solidity ^0.5.11;

interface IPriceFeed { 
    // --- Functions ---
    function setPrice(uint _price) external returns(bool);
        
    function getPrice() external view returns(uint);
}
