pragma solidity >0.5.0;

import "./SortedDoublyLL.sol";
import "./Token.sol";
import "./PriceFeed.sol";
import "./PoolManager.sol";
import "./CDPManager.sol";

contract Master{
    uint constant DIGITS = 1e18; // Number of digits used for precision, e.g. when calculating redistribution shares. Equals "ether" unit.
    
    CLVToken CLV; 
    ETHPriceFeed PriceFeed;
    PoolManager Pools;
    CDPManager CDP;
    address public CLVAddress;
    address public PriceFeedAddress;
    address public PoolAddress;
    address public sortedCDPsAddress;
    
    constructor()
        public
    {
        // Create the CLV token contract
        CLV = new CLVToken("CLV");
        CLVAddress = address(CLV);
        
        // Create the ETHPriceFeed contract
        PriceFeed = new ETHPriceFeed(DIGITS);
        PriceFeedAddress = address(PriceFeed);
        
        // Create the Pool contract
        Pools = new PoolManager(DIGITS, PriceFeedAddress, CLVAddress);
        PoolAddress = address(Pools);

        // Create the StabilityPool contract
        CDP = new CDPManager(DIGITS, CLVAddress, PoolAddress, PriceFeedAddress);
        
        CLV.registerPool(PoolAddress);
    }
}