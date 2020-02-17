pragma solidity ^0.5.11;

import "@openzeppelin/contracts/math/SafeMath.sol";
import '@openzeppelin/contracts/ownership/Ownable.sol';
import './Interfaces/ICDPManager.sol';

// A mock ETH:USD price oracle
contract PriceFeed is Ownable {
    using SafeMath for uint;
    
    uint constant DIGITS = 1e18;
    uint public price = 200 * DIGITS;  
   
    constructor() public {
    }   
   
    address cdpManagerAddress;
    ICDPManager cdpManager;

    event PriceUpdated(uint _newPrice);
    event CDPManagerAddressChanged(address _cdpManagerAddress);

    function setCDPManagerAddress(address _cdpManagerAddress) public onlyOwner {
        cdpManagerAddress = _cdpManagerAddress;
        cdpManager = ICDPManager(_cdpManagerAddress);
        emit CDPManagerAddressChanged(_cdpManagerAddress);
    }

    function setPrice(uint _price) public onlyOwner returns (bool) {
        price = _price.mul(DIGITS);
        cdpManager.checkTCRAndSetRecoveryMode();
        emit PriceUpdated(price);
        return true;

    }    
    
    function getPrice() public returns (uint) {
        return price;
    }  
}
