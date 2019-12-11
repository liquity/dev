pragma solidity ^0.5.11;
import "../node_modules/@openzeppelin/contracts/math/SafeMath.sol";
import '../node_modules/@openzeppelin/contracts/ownership/Ownable.sol';

// A mock ETH:USD price oracle
contract PriceFeed is Ownable {
    using SafeMath for uint;
    
    uint constant DIGITS = 1e18;
    uint public price = 200 * DIGITS;  
   
    constructor() public {
    }   
   
   event PriceUpdated(uint _newPrice);
   
    function setPrice(uint _price) public onlyOwner returns (bool) {
        price = _price.mul(DIGITS);
        emit PriceUpdated(price);
        return true;

    }    
    
    function getPrice() public view returns (uint) {
        return price;
    }  
}
