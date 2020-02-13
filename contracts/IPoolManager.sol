pragma solidity ^0.5.11;

// Common interface for the ETH/CLV pools.
interface IPoolManager {
     // --- Events ---
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

    event OverstayPenaltyClaimed(address claimant, uint claimantReward, address depositor, uint remainder);

    // --- Functions ---
    function setCDPManagerAddress(address _cdpManagerAddress) external;

    function setPriceFeed(address _priceFeedAddress) external;

    function setCLVToken(address _CLVAddress) external;

    function setStabilityPool(address _stabilityPoolAddress) external;

    function setActivePool(address _activePoolAddress) external;

    function setDefaultPool(address _defaultPoolAddress) external;

    function getAccurateMulDiv(uint x, uint y, uint z) external pure returns(uint);
    
    function getBalance() external view returns(uint);
    
    function getActiveDebt() external view returns(uint);
    
    function getActiveColl() external view returns(uint);
    
    function getClosedDebt() external view returns (uint);
    
    function getLiquidatedColl() external view returns(uint);

    function getStabilityPoolCLV() external view returns (uint);

    function getMin(uint a, uint b) external pure returns(uint);

    function addColl() external payable returns(bool);

    function withdrawColl(address _account, uint _ETH) external returns (bool);

    function withdrawCLV(address _account, uint _CLV) external returns(bool);
    
    function repayCLV(address _account, uint _CLV) external returns(bool);

    function liquidate(uint _CLV, uint _ETH) external returns(bool);

    // function pullFromActivePool(uint _CLV, uint _ETH) external returns (bool);

    // function returnToActivePool(uint _CLV, uint _ETH) external returns (bool);
  
    function applyPendingRewards(uint _CLV, uint _ETH) external returns(bool);

    function redeemCollateral(address _account, uint _CLV, uint _ETH) external returns(bool);

    // --- StabilityPool Functions ---
    function provideToSP(uint _amount) external returns(bool);

    function withdrawFromSP(uint _amount) external returns(bool);

    function withdrawFromSPtoCDP(address _user) external returns(bool);

    function withdrawPenaltyFromSP(address _address) external returns(bool);

    function offset(uint _debt, uint _coll) external payable returns(uint[2] memory);
}