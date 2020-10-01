pragma solidity >=0.5.16;

// Common interface for the ETH/CLV pools.
interface IPoolManager {
     // --- Events ---

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);

    event CDPManagerAddressChanged(address _newCDPManagerAddress);

    event PriceFeedAddressChanged(address _newPriceFeedAddress);

    event CLVTokenAddressChanged(address _newCLVTokenAddress);

    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);

    event ActivePoolAddressChanged(address _newActivePoolAddress);

    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);

    event UserSnapshotUpdated(uint _P, uint _S);

    event P_Updated(uint _P);

    event S_Updated(uint _S);

    event UserDepositChanged(address indexed _user, uint _amount);

    event OverstayPenaltyClaimed(address claimant, uint claimantReward, address depositor, uint remainder);

    // --- Functions ---
    function setAddresses(
        address _borrowerOperationsAddress,
        address _cdpManagerAddress,
        address _priceFeedAddress,
        address _CLVAddress,
        address _stabilityPoolAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _gasPoolAddress
    ) external;

    function getBalance() external view returns (uint);
    
    function getActiveDebt() external view returns (uint);
    
    function getActiveColl() external view returns (uint);
    
    function getClosedDebt() external view returns (uint);
    
    function getLiquidatedColl() external view returns (uint);

    function getStabilityPoolCLV() external view returns (uint);

    function getCurrentETHGain(address _user) external view returns (uint);

    function addColl() external payable;

    function withdrawColl(address _account, uint _ETH) external;

    function withdrawCLV(address _account, uint _CLV) external;
    
    function repayCLV(address _account, uint _CLV) external;

    function lockCLVGasCompensation(uint _CLV) external;

    function refundCLVGasCompensation(uint _CLV) external;

    function sendCLVGasCompensation(address _user, uint _CLV) external;

    function liquidate(uint _CLV, uint _ETH) external;
  
    function movePendingTroveRewardsToActivePool(uint _CLV, uint _ETH) external;

    function redeemCollateral(address _account, uint _CLV, uint _ETH) external;

    function redeemCloseLoan(address _account, uint _CLV, uint _ETH) external;

    // --- StabilityPool Functions ---
    function provideToSP(uint _amount) external;

    function withdrawFromSP(uint _amount) external;

    function withdrawFromSPtoCDP(address _user, address _hint) external;

    function offset(uint _debt, uint _coll) external payable;
}