pragma solidity 0.5.16;


import "./Interfaces/ICDPManager.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/IDeployedAggregator.sol";
import "./Interfaces/AggregatorInterface.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract PriceFeed is Ownable, IPriceFeed {
    using SafeMath for uint256;

    uint256 constant DIGITS = 1e18;
    uint256 public price = 200 * DIGITS;

    address public cdpManagerAddress;
    address public poolManagerAddress;
    
    // Mainnet Chainlink aggregator
    address public priceAggregatorAddress;
    IDeployedAggregator public priceAggregator;

    // Testnet Chainlink aggregator
    address public priceAggregatorAddress_Testnet;
    AggregatorInterface public priceAggregator_Testnet;

    event PriceUpdated(uint256 _newPrice);
    event CDPManagerAddressChanged(address _cdpManagerAddress);
    event PoolManagerAddressChanged(address _poolManagerAddress);

    // --- Dependency setters ---

    function setCDPManagerAddress(address _cdpManagerAddress) external onlyOwner {
        cdpManagerAddress = _cdpManagerAddress;
        emit CDPManagerAddressChanged(_cdpManagerAddress);
    }

    function setPoolManagerAddress(address _poolManagerAddress) external onlyOwner {
        poolManagerAddress = _poolManagerAddress;
        emit PoolManagerAddressChanged(_poolManagerAddress);
    }

    // Mainnet Chainlink address setter
    function setAggregator(address _priceAggregatorAddress) external onlyOwner {
        priceAggregatorAddress = _priceAggregatorAddress;
        priceAggregator = IDeployedAggregator(_priceAggregatorAddress);
    }

    // Testnet Chainlink address setter
    function setAggregator_Testnet(address _priceAggregatorAddress) external onlyOwner {
        priceAggregator_Testnet = AggregatorInterface(_priceAggregatorAddress);
    }

    // --- Functions ---

    function getPrice() external view returns (uint256) {
        return price;
    }

    // --- DEVELOPMENT FUNCTIONALITY - TODO: remove before mainnet deployment.  ---

    // Manual external price setter. 
    function setPrice(uint256 _price) external returns (bool) {
        price = _price;
        emit PriceUpdated(price);
        return true;
    }

    // --- MAINNET FUNCTIONALITY ---

    // TODO: convert received Chainlink price to precision-18 before setting state variable
    function updatePrice() external returns (uint256) {
        _requireCallerIsCDPManagerOrPoolManager();
        price = getLatestPrice();
        emit PriceUpdated(price);
        return price;
    }

    function getLatestPrice() public view returns (uint256) {
        int256 intPrice = priceAggregator.currentAnswer();
        require(intPrice >= 0, "Price response from aggregator is negative int");

        return uint256(intPrice);
    }

    function getLatestAnswerID() external view returns (uint256) {
        return priceAggregator.latestCompletedAnswer();
    }

    // Get the block timestamp at which the reference price was last updated
    function getLatestTimestamp() external view returns (uint256) {
        return priceAggregator.updatedHeight();
    }

    // ---- ROPSTEN FUNCTIONALITY - TODO: Remove before Mainnet deployment ----

    function updatePrice_Testnet() external returns (uint256) {
        price = getLatestPrice_Testnet();
        emit PriceUpdated(price);
        return price;
    }

    function getLatestPrice_Testnet() public view returns (uint256) {
        int256 intPrice = priceAggregator_Testnet.latestAnswer();
        require( intPrice >= 0, "Price response from aggregator is negative int");

        return uint256(intPrice).mul(10000000000);
    }

    // Get the block timestamp at which the reference data was last updated
    function getLatestTimestamp_Testnet() external view returns (uint256) {
        uint256 latestTimestamp = priceAggregator_Testnet.latestTimestamp();

        return latestTimestamp;
    }

    // Get the past price from 'n' rounds ago
    function getPreviousPrice_Testnet(uint256 _n) external view returns (uint256) {
        uint256 latestAnswerID = priceAggregator_Testnet.latestRound();
        require(_n <= latestAnswerID, "Not enough history");

        int256 prevPrice = priceAggregator_Testnet.getAnswer(latestAnswerID - _n);
        require(prevPrice >= 0, "Price response from aggregator is negative int");

        return uint256(prevPrice).mul(10000000000);
    }

    // Get the block timestamp from the round that occurred 'n' rounds ago
    function getPreviousTimestamp_Testnet(uint256 _n) external view returns (uint256) {
        uint256 latestAnswerID = priceAggregator_Testnet.latestRound();
        require(_n <= latestAnswerID, "Not enough history");

        return priceAggregator_Testnet.getTimestamp(latestAnswerID - _n);
    }

    // --- 'require' functions ---

    function _requireCallerIsCDPManagerOrPoolManager() internal view {
        require(_msgSender() == cdpManagerAddress ||_msgSender() == poolManagerAddress,
            "PriceFeed: Caller is neither CDPManager nor PoolManager"
        );
    }
}

