pragma solidity ^0.5.11;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "./Interfaces/ICDPManager.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/IDeployedAggregator.sol";
import "@nomiclabs/buidler/console.sol";

contract PriceFeed is Ownable, IPriceFeed {
    using SafeMath for uint256;

    uint256 constant DIGITS = 1e18;
    uint256 public price = 200 * DIGITS;

    address public cdpManagerAddress;
    address public poolManagerAddress;
    address public priceAggregatorAddress;

    ICDPManager cdpManager;
    IDeployedAggregator priceAggregator;

    event PriceUpdated(uint256 _newPrice);
    event CDPManagerAddressChanged(address _cdpManagerAddress);
    event PoolManagerAddressChanged(address _poolManagerAddress);

    // --- Dependency setters ---

    function setCDPManagerAddress(address _cdpManagerAddress) public onlyOwner {
        cdpManagerAddress = _cdpManagerAddress;
        cdpManager = ICDPManager(_cdpManagerAddress);
        emit CDPManagerAddressChanged(_cdpManagerAddress);
    }

    function setPoolManagerAddress(address _poolManagerAddress) public onlyOwner {
        poolManagerAddress = _poolManagerAddress;
        emit PoolManagerAddressChanged(_poolManagerAddress);
    }

     // --- Modifiers ---

      modifier onlyCDPManagerOrPoolManager {
        require(
            _msgSender() == cdpManagerAddress || 
            _msgSender() == poolManagerAddress,
            "PriceFeed: only callable by CDPMaanger or PoolManager");
        _;
    }

    // --- Functions ---

    // Manual price setter for owner. TODO: remove this function before mainnet deployment.
    function setPrice(uint256 _price) public onlyOwner returns (bool) {
        price = _price;
        cdpManager.checkTCRAndSetRecoveryMode(price);
        emit PriceUpdated(price);
        return true;
    }

    function getPrice() public view returns (uint256) {
        // console.log("00. gas left: %s", gasleft());
        // console.log("01. gas left: %s", gasleft());
        return price;
    }

    // --- Chainlink functionality ---

    function setAggregator(address _priceAggregatorAddress) public onlyOwner {
        priceAggregatorAddress = _priceAggregatorAddress;
        priceAggregator = IDeployedAggregator(_priceAggregatorAddress);
    }

    // TODO: convert received Chainlink price to precision-18 before setting state variable
    function updatePrice() public onlyCDPManagerOrPoolManager returns (uint256) {
        price = getLatestPrice();
        emit PriceUpdated(price);
        return price;
    }

    function getLatestPrice() public view returns (uint256) {
        int256 intPrice = priceAggregator.currentAnswer();
        require(
            intPrice >= 0,
            "Price response from aggregator is negative int"
        );

        return uint256(intPrice);
    }

    function getLatestAnswerID() public view returns (uint256) {
        return priceAggregator.latestCompletedAnswer();
    }

    // Get the block timestamp at which the reference price was last updated
    function getLatestTimestamp() public view returns (uint256) {
        return priceAggregator.updatedHeight();
    }
}
