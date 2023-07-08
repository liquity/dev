// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "./ILiquityBase.sol";
import "./IStabilityPool.sol";
import "./IXBRLToken.sol";
import "./ISTBLToken.sol";
import "./ISTBLStaking.sol";


// Common interface for the Trove Manager.
interface ITroveManager is ILiquityBase {
    
    // --- Events ---

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event XBRLTokenAddressChanged(address _newXBRLTokenAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event StabilityPoolAddressChanged(address _stabilityPoolAddress);
    event GasPoolAddressChanged(address _gasPoolAddress);
    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event STBLTokenAddressChanged(address _stblTokenAddress);
    event STBLStakingAddressChanged(address _stblStakingAddress);

    event Liquidation(uint _liquidatedDebt, uint256 _liquidatedColl, uint256 _collGasCompensation, uint256 _XBRLGasCompensation);
    event Redemption(uint _attemptedXBRLAmount, uint256 _actualXBRLAmount, uint256 _ETHSent, uint256 _ETHFee);
    event TroveUpdated(address indexed _borrower, uint256 _debt, uint256 _coll, uint256 stake, uint8 operation);
    event TroveLiquidated(address indexed _borrower, uint256 _debt, uint256 _coll, uint8 operation);
    event BaseRateUpdated(uint _baseRate);
    event LastFeeOpTimeUpdated(uint _lastFeeOpTime);
    event TotalStakesUpdated(uint _newTotalStakes);
    event SystemSnapshotsUpdated(uint _totalStakesSnapshot, uint256 _totalCollateralSnapshot);
    event LTermsUpdated(uint _L_ETH, uint256 _L_XBRLDebt);
    event TroveSnapshotsUpdated(uint _L_ETH, uint256 _L_XBRLDebt);
    event TroveIndexUpdated(address _borrower, uint256 _newIndex);

    // --- Functions ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
        address _gasPoolAddress,
        address _collSurplusPoolAddress,
        address _priceFeedAddress,
        address _xbrlTokenAddress,
        address _sortedTrovesAddress,
        address _stblTokenAddress,
        address _stblStakingAddress
    ) external;

    function stabilityPool() external view returns (IStabilityPool);
    function xbrlToken() external view returns (IXBRLToken);
    function stblToken() external view returns (ISTBLToken);
    function stblStaking() external view returns (ISTBLStaking);

    function getTroveOwnersCount() external view returns (uint);

    function getTroveFromTroveOwnersArray(uint _index) external view returns (address);

    function getNominalICR(address _borrower) external view returns (uint);
    function getCurrentICR(address _borrower, uint256 _price) external view returns (uint);

    function liquidate(address _borrower) external;

    function liquidateTroves(uint _n) external;

    function batchLiquidateTroves(address[] calldata _troveArray) external;

    function redeemCollateral(
        uint256 _XBRLAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR,
        uint256 _maxIterations,
        uint256 _maxFee
    ) external; 

    function updateStakeAndTotalStakes(address _borrower) external returns (uint);

    function updateTroveRewardSnapshots(address _borrower) external;

    function addTroveOwnerToArray(address _borrower) external returns (uint index);

    function applyPendingRewards(address _borrower) external;

    function getPendingETHReward(address _borrower) external view returns (uint);

    function getPendingXBRLDebtReward(address _borrower) external view returns (uint);

     function hasPendingRewards(address _borrower) external view returns (bool);

    function getEntireDebtAndColl(address _borrower) external view returns (
        uint256 debt, 
        uint256 coll, 
        uint256 pendingXBRLDebtReward, 
        uint256 pendingETHReward
    );

    function closeTrove(address _borrower) external;

    function removeStake(address _borrower) external;

    function getRedemptionRate() external view returns (uint);
    function getRedemptionRateWithDecay() external view returns (uint);

    function getRedemptionFeeWithDecay(uint _ETHDrawn) external view returns (uint);

    function getBorrowingRate() external view returns (uint);
    function getBorrowingRateWithDecay() external view returns (uint);

    function getBorrowingFee(uint XBRLDebt) external view returns (uint);
    function getBorrowingFeeWithDecay(uint _XBRLDebt) external view returns (uint);

    function decayBaseRateFromBorrowing() external;

    function getTroveStatus(address _borrower) external view returns (uint);
    
    function getTroveStake(address _borrower) external view returns (uint);

    function getTroveDebt(address _borrower) external view returns (uint);

    function getTroveColl(address _borrower) external view returns (uint);

    function setTroveStatus(address _borrower, uint256 num) external;

    function increaseTroveColl(address _borrower, uint256 _collIncrease) external returns (uint);

    function decreaseTroveColl(address _borrower, uint256 _collDecrease) external returns (uint); 

    function increaseTroveDebt(address _borrower, uint256 _debtIncrease) external returns (uint); 

    function decreaseTroveDebt(address _borrower, uint256 _collDecrease) external returns (uint); 

    function getTCR(uint _price) external view returns (uint);

    function checkRecoveryMode(uint _price) external view returns (bool);
}
