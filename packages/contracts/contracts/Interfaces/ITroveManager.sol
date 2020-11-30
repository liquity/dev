// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

// Common interface for the CDP Manager.
interface ITroveManager {
    
    // --- Events ---

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);

    event PriceFeedAddressChanged(address _newPriceFeedAddress);

    event LUSDTokenAddressChanged(address _newLUSDTokenAddress);

    event ActivePoolAddressChanged(address _activePoolAddress);
    
    event DefaultPoolAddressChanged(address _defaultPoolAddress);

    event StabilityPoolAddressChanged(address _stabilityPoolAddress);

    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);

    event SortedTrovesAddressChanged(address _sortedTrovesAddress);

    event LQTYStakingAddressChanged(address _lqtyStakingAddress);

    event CDPCreated(address indexed _borrower, uint arrayIndex);

    event CDPUpdated(address indexed _borrower, uint _debt, uint _coll, uint stake, uint8 operation);

    event CDPLiquidated(address indexed _borrower, uint _debt, uint _coll, uint8 operation);

    // --- Functions ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
        address _collSurplusPoolAddress,
        address _priceFeedAddress,
        address _lusdTokenAddress,
        address _sortedTrovesAddress,
        address _lqtyStakingAddress
    ) external;

    function getCDPOwnersCount() external view returns (uint);

    function getTroveFromCDPOwnersArray(uint _index) external view returns (address);

    function getCurrentICR(address _borrower, uint _price) external view returns (uint);

    function liquidate(address _borrower) external;

    function liquidateTroves(uint _n) external;

    function batchLiquidateTroves(address[] calldata _troveArray) external;

    function checkRecoveryMode() external view returns (bool);

    function redeemCollateral(
        uint _LUSDAmount,
        address _firstRedemptionHint,
        address _partialRedemptionHint,
        uint _partialRedemptionHintICR,
        uint _maxIterations
    ) external; 

    function updateStakeAndTotalStakes(address _borrower) external returns (uint);

    function updateCDPRewardSnapshots(address _borrower) external;

    function addCDPOwnerToArray(address _borrower) external returns (uint index);

    function applyPendingRewards(address _borrower) external;

    function getPendingETHReward(address _borrower) external view returns (uint);

    function getPendingLUSDDebtReward(address _borrower) external view returns (uint);

     function hasPendingRewards(address _borrower) external view returns (bool);

    function getEntireDebtAndColl(address _borrower) external view returns (
        uint debt, 
        uint coll, 
        uint pendingLUSDDebtReward, 
        uint pendingETHReward
    );

    function getEntireSystemColl() external view returns (uint);

    function getEntireSystemDebt() external view returns (uint);

    function getTCR() external view returns (uint TCR);

    function closeCDP(address _borrower) external;

    function removeStake(address _borrower) external;

    function getBorrowingFee(uint LUSDDebt) external view returns (uint);

    function decayBaseRateFromBorrowing() external;

    function getCDPStatus(address _borrower) external view returns (uint);
    
    function getCDPStake(address _borrower) external view returns (uint);

    function getCDPDebt(address _borrower) external view returns (uint);

    function getCDPColl(address _borrower) external view returns (uint);

    function setCDPStatus(address _borrower, uint num) external;

    function increaseCDPColl(address _borrower, uint _collIncrease) external returns (uint);

    function decreaseCDPColl(address _borrower, uint _collDecrease) external returns (uint); 

    function increaseCDPDebt(address _borrower, uint _debtIncrease) external returns (uint); 

    function decreaseCDPDebt(address _borrower, uint _collDecrease) external returns (uint); 
}
