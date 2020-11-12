// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

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

    event CDPUpdated(address indexed _user, uint _debt, uint _coll, uint stake, uint8 operation);

    event CDPLiquidated(address indexed _user, uint _debt, uint _coll, uint8 operation);

    // --- Functions ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _poolManagerAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
        address _priceFeedAddress,
        address _clvTokenAddress,
        address _sortedCDPsAddress,
        address _lqtyStakingAddress
    ) external;

    function getCDPOwnersCount() external view returns (uint);

    function getTroveFromCDPOwnersArray(uint _index) external view returns (address);

    function getCurrentICR(address _user, uint _price) external view returns (uint);

    function liquidate(address _user) external;

    function liquidateCDPs(uint _n) external;

    function batchLiquidateTroves(address[] calldata _troveArray) external;

    function checkRecoveryMode() external view returns (bool);

    function redeemCollateral(
        uint _CLVAmount,
        address _firstRedemptionHint,
        address _partialRedemptionHint,
        uint _partialRedemptionHintICR
    ) external; 

    function updateStakeAndTotalStakes(address _user) external returns (uint);

    function updateCDPRewardSnapshots(address _user) external;

    function addCDPOwnerToArray(address _user) external returns (uint index);

    function applyPendingRewards(address _user) external;

    function getPendingETHReward(address _user) external view returns (uint);

    function getPendingCLVDebtReward(address _user) external view returns (uint);

    function getEntireSystemColl() external view returns (uint entireSystemColl);

    function getEntireSystemDebt() external view returns (uint entireSystemDebt);

    function getTCR() external view returns (uint TCR);

    function closeCDP(address _user) external;

    function removeStake(address _user) external;

    function getBorrowingFee(uint CLVDebt) external view returns (uint);

    function decayBaseRateFromBorrowing() external returns (uint);

    function getCDPStatus(address _user) external view returns (uint);
    
    function getCDPStake(address _user) external view returns (uint);

    function getCDPDebt(address _user) external view returns (uint);

    function getCDPColl(address _user) external view returns (uint);

    function setCDPStatus(address _user, uint num) external;

    function increaseCDPColl(address _user, uint _collIncrease) external returns (uint);

    function decreaseCDPColl(address _user, uint _collDecrease) external returns (uint); 

    function increaseCDPDebt(address _user, uint _debtIncrease) external returns (uint); 

    function decreaseCDPDebt(address _user, uint _collDecrease) external returns (uint); 
}