pragma solidity ^0.5.0;

// A mock ETH:USD price oracle
contract ETHPriceFeed {
    uint price;  
    uint digits;
    
    constructor(uint _digits) public {
        digits = _digits;
        price = 200 * digits;
    }   
            
    function setPrice(uint _price) public returns (bool) {
        price = _price;
        return true;
    }    
    
    function getPrice() public view returns (uint) {
        return price;
    }    
}