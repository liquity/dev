    pragma solidity ^0.5.11;

// Common interface for the ETH/CLV pools.
interface IPoolManager {

     // Events
    event CDPManagerAddressChanged(address _newCDPManagerAddress);

    event PriceFeedAddressChanged(address _newPriceFeedAddress);

    event CLVTokenAddressChanged(address _newCLVTokenAddress);

    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);

    event ActivePoolAddressChanged(address _newActivePoolAddress);

    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);

    event UserSnapshotUpdated(uint _CLV, uint _ETH);

    event S_CLVUpdated(uint _S_CLV);

    event S_ETHUpdated(uint _S_ETH);

    event UserDepositChanged(address _user, uint _amount);

    event EntitledETHRetrieved(address user, uint entitledETH);

    // Functions
    function setCDPManagerAddress(address _cdpManagerAddress) external;

    function setPriceFeed(address _priceFeedAddress) external;

    function setCLVToken(address _CLVAddress) external;

    function setStabilityPool(address payable _stabilityPoolAddress) external;

    function setActivePool(address payable _activePoolAddress) external;

    function setDefaultPool(address payable _defaultPoolAddress) external;

    function getAccurateMulDiv(uint x, uint y, uint z) external pure returns(uint);

    function getTCR() view external returns (uint); 
    
    function getBalance() external view returns(uint);
    
    function getActiveDebt() external view returns(uint);
    
    function getActiveColl() external view returns(uint);
    
    function getClosedDebt() external view returns (uint);
    
    function getClosedColl() external view returns(uint);

    function getMin(uint a, uint b) external pure returns(uint);

    function addColl() external payable returns(bool);

    function withdrawColl(address payable _account, uint _ETH) external returns (bool);

    function withdrawCLV(address _account, uint _CLV) external returns(bool);
    
    function repayCLV(address _account, uint _CLV) external returns(bool);

    function close(uint _CLV, uint _ETH) external returns(bool);

    function obtainDefaultShare(uint _CLV, uint _ETH) external returns(bool);

    function redeemCollateral(address payable _account, uint _CLV, uint _ETH) external returns(bool);

    function depositCLV( uint _amount) external returns(bool);

    function offset(uint _debt, uint _coll) external payable returns(uint[2] memory);

    function retrieve(uint _amount, uint _destination) external returns(bool);
}