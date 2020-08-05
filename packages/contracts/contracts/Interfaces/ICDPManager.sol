pragma solidity >=0.5.16;
import "./ISortedCDPs.sol";
// Common interface for the CDP Manager.
interface ICDPManager {
    // --- Events ---

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);

    event PoolManagerAddressChanged(address _newPoolManagerAddress);

    event PriceFeedAddressChanged(address _newPriceFeedAddress);

    event CLVTokenAddressChanged(address _newCLVTokenAddress);

    event ActivePoolAddressChanged(address _activePoolAddress);
    
    event DefaultPoolAddressChanged(address _defaultPoolAddress);

    event StabilityPoolAddressChanged(address _stabilityPoolAddress);

    event SortedCDPsAddressChanged(address _sortedCDPsAddress);

    event CDPCreated(address indexed _user, uint arrayIndex);

    event CDPUpdated(address indexed _user, uint _debt, uint _coll, uint stake);

    event SizeListAddressChanged(uint _sizeRange, address _sizeListAddress);

    // --- Functions ---

    function setBorrowerOperations(address _borrowerOperationsAddress) external;

    function setPoolManager(address _poolManagerAddress) external;

    function setActivePool(address _activePoolAddress) external; 

    function setDefaultPool(address _defaultPoolAddress) external;

    function setStabilityPool(address _stabilityPoolAddress) external;

    function setCLVToken(address _clvTokenAddress) external;

     function setPriceFeed(address _priceFeedAddress) external;

    function setSortedCDPs(address _sortedCDPsAddress) external;

    function getallTrovesArrayCount() external view returns (uint);

    function getCurrentICR(address _user, uint _price) external view returns (uint);

    function getApproxHint(uint CR, uint numTrials) external view returns (address);

    function liquidate(address _user) external;

    function liquidateCDPs(uint _n) external;

    function checkRecoveryMode() external view returns (bool);

    function getRedemptionHints(uint _CLVamount, uint _price) external view returns (address, uint);

    function redeemCollateral(
        uint _CLVAmount,
        address _firstRedemptionHint,
        address _partialRedemptionHint,
        uint _partialRedemptionHintICR
    ) external; 

    function updateStakeAndTotalStakes(address _user) external returns (uint);

    function updateCDPRewardSnapshots(address _user) external;

    function applyPendingRewards(address _user) external;

    function closeCDP(address _user) external;

    function removeStake(address _user) external;

    function getCDPStatus(address _user) external view returns (uint);
    
    function getCDPStake(address _user) external view returns (uint);

    function getCDPDebt(address _user) external view returns (uint);

    function getCDPColl(address _user) external view returns (uint);

    function setCDPStatus(address _user, uint num) external;

    function increaseCDPColl(address _user, uint _collIncrease) external returns (uint);

    function decreaseCDPColl(address _user, uint _collDecrease) external returns (uint); 

    function increaseCDPDebt(address _user, uint _debtIncrease) external returns (uint); 

    function decreaseCDPDebt(address _user, uint _collDecrease) external returns (uint); 

    function getSizeListFromColl(uint _coll) external view returns (ISortedCDPs);

    function getSizeList(uint _sizeRange) external view returns (ISortedCDPs);

    function insertToFullSortedList(address _user, uint _ICR, uint _price, address _hint) external returns (uint);

    function insertToSizeList(address _user, uint _ICR, uint _price, uint _coll, address _hint) external;

    function reInsertToSizeList(address _user, uint _newICR, uint _price, uint _newColl, address _hint) external;
}