// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IDefaultPool.sol";
import "./Interfaces/IActivePool.sol";
import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/ILUSDToken.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/ILQTYStaking.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract TroveManager is LiquityBase, Ownable, ITroveManager {

    // --- Connected contract declarations ---

    address public borrowerOperationsAddress;

    IActivePool public activePool;

    IDefaultPool public defaultPool;

    IStabilityPool public stabilityPool;

    ICollSurplusPool collSurplusPool;

    ILUSDToken public lusdToken;

    IPriceFeed public priceFeed;

    ILQTYStaking public lqtyStaking;
    address public lqtyStakingAddress;

    // A doubly linked list of Troves, sorted by their sorted by their collateral ratios
    ISortedTroves public sortedTroves;

    // --- Data structures ---

    uint constant public SECONDS_IN_ONE_MINUTE = 60;
    uint constant public MINUTE_DECAY_FACTOR = 999832508430720967;  // 18 digit decimal. Corresponds to an hourly decay factor of 0.99

    /* 
    * BETA: 18 digit decimal. Parameter by which to divide the redeemed fraction, in order to calc the new base rate from a redemption. 
    * Corresponds to (1 / ALPHA) in the white paper. 
    */
    uint constant public BETA = 2;

    uint public baseRate;

    // The timestamp of the latest fee operation (redemption or new LUSD issuance) 
    uint public lastFeeOperationTime;

    enum Status { nonExistent, active, closed }

    // Store the necessary data for a trove
    struct Trove {
        uint debt;
        uint coll;
        uint stake;
        Status status;
        uint128 arrayIndex;
    }

    mapping (address => Trove) public Troves;

    uint public totalStakes;

    // Snapshot of the value of totalStakes, taken immediately after the latest liquidation
    uint public totalStakesSnapshot;

    // Snapshot of the total collateral across the ActivePool and DefaultPool, immediately after the latest liquidation.
    uint public totalCollateralSnapshot;

    /*
    * L_ETH and L_LUSDDebt track the sums of accumulated liquidation rewards per unit staked. During its lifetime, each stake earns:
    *
    * An ETH gain of ( stake * [L_ETH - L_ETH(0)] )
    * A LUSDDebt increase  of ( stake * [L_LUSDDebt - L_LUSDDebt(0)] )
    *
    * Where L_ETH(0) and L_LUSDDebt(0) are snapshots of L_ETH and L_LUSDDebt for the active Trove taken at the instant the stake was made
    */
    uint public L_ETH;
    uint public L_LUSDDebt;

    // Map addresses with active troves to their RewardSnapshot
    mapping (address => RewardSnapshot) public rewardSnapshots;

    // Object containing the ETH and LUSD snapshots for a given active trove
    struct RewardSnapshot { uint ETH; uint LUSDDebt;}

    // Array of all active trove addresses - used to to compute an approximate hint off-chain, for the sorted list insertion
    address[] public TroveOwners;

    // Error trackers for the trove redistribution calculation
    uint public lastETHError_Redistribution;
    uint public lastLUSDDebtError_Redistribution;

    /* 
    * --- Variable container structs for liquidations ---
    *
    * These structs are used to hold, return and assign variables inside the liquidation functions,
    * in order to avoid the error: "CompilerError: Stack too deep". 
    **/

    struct LocalVariables_OuterLiquidationFunction {
        uint price;
        uint LUSDInStabPool;
        bool recoveryModeAtStart;
        uint liquidatedDebt;
        uint liquidatedColl;
    }

    struct LocalVariables_InnerSingleLiquidateFunction {
        uint collToLiquidate;
        uint pendingDebtReward;
        uint pendingCollReward;
    }

    struct LocalVariables_LiquidationSequence {
        uint remainingLUSDInStabPool;
        uint i;
        uint ICR;
        address user;
        bool backToNormalMode;
        uint entireSystemDebt;
        uint entireSystemColl;
    }

    struct LiquidationValues {
        uint entireTroveDebt;
        uint entireTroveColl;
        uint collGasCompensation;
        uint LUSDGasCompensation;
        uint debtToOffset;
        uint collToSendToSP;
        uint debtToRedistribute;
        uint collToRedistribute;
        address partialAddr;
        uint partialNewDebt;
        uint partialNewColl;
        address partialUpperHint;
        address partialLowerHint;
    }

    struct LiquidationTotals {
        uint totalCollInSequence;
        uint totalDebtInSequence;
        uint totalCollGasCompensation;
        uint totalLUSDGasCompensation;
        uint totalDebtToOffset;
        uint totalCollToSendToSP;
        uint totalDebtToRedistribute;
        uint totalCollToRedistribute;
        address partialAddr;
        uint partialNewDebt;
        uint partialNewColl;
        address partialUpperHint;
        address partialLowerHint;
    }

    // --- Variable container structs for redemptions ---

    struct RedemptionTotals {
        uint totalLUSDToRedeem;
        uint totalETHDrawn;
        uint ETHFee;
        uint ETHToSendToRedeemer;
        uint decayedBaseRate;
    }

    struct SingleRedemptionValues {
        uint LUSDLot;
        uint ETHLot;
    }

    // --- Events ---

    event Liquidation(uint _liquidatedDebt, uint _liquidatedColl, uint _collGasCompensation, uint _LUSDGasCompensation);
    event Redemption(uint _attemptedLUSDAmount, uint _actualLUSDAmount, uint _ETHSent, uint _ETHFee);

    enum TroveManagerOperation {
        applyPendingRewards,
        liquidateInNormalMode,
        liquidateInRecoveryMode,
        partiallyLiquidateInRecoveryMode,
        redeemCollateral
    }

    event TroveCreated(address indexed _borrower, uint _arrayIndex);
    event TroveUpdated(address indexed _borrower, uint _debt, uint _coll, uint _stake, TroveManagerOperation _operation);
    event TroveLiquidated(address indexed _borrower, uint _debt, uint _coll, TroveManagerOperation _operation);

    // --- Dependency setter ---

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
    )
        external
        override
        onlyOwner
    {
        borrowerOperationsAddress = _borrowerOperationsAddress;
        activePool = IActivePool(_activePoolAddress);
        defaultPool = IDefaultPool(_defaultPoolAddress);
        stabilityPool = IStabilityPool(_stabilityPoolAddress);
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
        lusdToken = ILUSDToken(_lusdTokenAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        lqtyStakingAddress = _lqtyStakingAddress;
        lqtyStaking = ILQTYStaking(_lqtyStakingAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit LUSDTokenAddressChanged(_lusdTokenAddress);
        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit LQTYStakingAddressChanged(_lqtyStakingAddress);

        _renounceOwnership();
    }

    // --- Getters ---

    function getTroveOwnersCount() external view override returns (uint) {
        return TroveOwners.length;
    }

    function getTroveFromTroveOwnersArray(uint _index) external view override returns (address) {
        return TroveOwners[_index];
    }

    // --- Trove Liquidation functions ---

    // Single liquidation function. Closes the trove if its ICR is lower than the minimum collateral ratio. 
    function liquidate(address _borrower) external override {
        _requireTroveisActive(_borrower);

        address[] memory borrowers = new address[](1);
        borrowers[0] = _borrower;
        batchLiquidateTroves(borrowers);
    }

    // --- Inner single liquidation functions ---

    // Liquidate one trove, in Normal Mode.
    function _liquidateNormalMode(address _borrower, uint _LUSDInStabPool) internal returns (LiquidationValues memory V) {
        LocalVariables_InnerSingleLiquidateFunction memory L;

        (V.entireTroveDebt,
        V.entireTroveColl,
        L.pendingDebtReward,
        L.pendingCollReward) = getEntireDebtAndColl(_borrower);

        _movePendingTroveRewardsToActivePool(L.pendingDebtReward, L.pendingCollReward);
        _removeStake(_borrower);

        V.collGasCompensation = _getCollGasCompensation(V.entireTroveColl);
        V.LUSDGasCompensation = LUSD_GAS_COMPENSATION;
        uint collToLiquidate = V.entireTroveColl.sub(V.collGasCompensation);

        (V.debtToOffset,
        V.collToSendToSP,
        V.debtToRedistribute,
        V.collToRedistribute) = _getOffsetAndRedistributionVals(V.entireTroveDebt, collToLiquidate, _LUSDInStabPool);

        _closeTrove(_borrower);
        emit TroveLiquidated(_borrower, V.entireTroveDebt, V.entireTroveColl, TroveManagerOperation.liquidateInNormalMode);

        return V;
    }

    // Liquidate one trove, in Recovery Mode.
    function _liquidateRecoveryMode(address _borrower, uint _ICR, uint _LUSDInStabPool, uint _TCR) internal returns (LiquidationValues memory V) {
        LocalVariables_InnerSingleLiquidateFunction memory L;
        
        if (TroveOwners.length <= 1) { return V; } // don't liquidate if last trove

        (V.entireTroveDebt,
        V.entireTroveColl,
        L.pendingDebtReward,
        L.pendingCollReward) = getEntireDebtAndColl(_borrower);

        _movePendingTroveRewardsToActivePool(L.pendingDebtReward, L.pendingCollReward);

        V.collGasCompensation = _getCollGasCompensation(V.entireTroveColl);
        // In case of a partial liquidation, V.LUSDGasCompensation will be overwritten to zero, in the third branch below
        V.LUSDGasCompensation = LUSD_GAS_COMPENSATION;
        L.collToLiquidate = V.entireTroveColl.sub(V.collGasCompensation);

        // If ICR <= 100%, purely redistribute the Trove across all active Troves
        if (_ICR <= _100pct) {
            _removeStake(_borrower);

            V.debtToOffset = 0;
            V.collToSendToSP = 0;
            V.debtToRedistribute = V.entireTroveDebt;
            V.collToRedistribute = L.collToLiquidate;

            _closeTrove(_borrower);
            emit TroveLiquidated(_borrower, V.entireTroveDebt, V.entireTroveColl, TroveManagerOperation.liquidateInRecoveryMode);

        // If 100% < ICR < MCR, offset as much as possible, and redistribute the remainder
        } else if ((_ICR > _100pct) && (_ICR < MCR)) {
            _removeStake(_borrower);

            (V.debtToOffset,
            V.collToSendToSP,
            V.debtToRedistribute,
            V.collToRedistribute) = _getOffsetAndRedistributionVals(V.entireTroveDebt, L.collToLiquidate, _LUSDInStabPool);

            _closeTrove(_borrower);
            emit TroveLiquidated(_borrower, V.entireTroveDebt, V.entireTroveColl, TroveManagerOperation.liquidateInRecoveryMode);

        /* 
        * If 110% <= ICR < current TCR (accounting for the preceding liquidations in the current sequence)
        * and there is LUSD in the Stability Pool, only offset it as much as possible, with no redistribution.
        */
        } else if ((_ICR >= MCR) && (_ICR < _TCR)) {
            assert(_LUSDInStabPool != 0);

            _removeStake(_borrower);
            
            V = _getFullOrPartialOffsetVals(_borrower, V.entireTroveDebt, V.entireTroveColl, _LUSDInStabPool);

            _closeTrove(_borrower);
        }
        else { // if (_ICR >= _TCR)
            LiquidationValues memory zeroVals;
            return zeroVals;
        }

        return V;
    }

    /* In a full liquidation, returns the values for a trove's coll and debt to be offset, and coll and debt to be 
    * redistributed to active troves. 
    */
    function _getOffsetAndRedistributionVals
    (
        uint _debt,
        uint _coll,
        uint _LUSDInStabPool
    )
        internal
        pure
        returns (uint debtToOffset, uint collToSendToSP, uint debtToRedistribute, uint collToRedistribute)
    {
        if (_LUSDInStabPool > 0) {
        /* 
        * Offset as much debt & collateral as possible against the Stability Pool, and redistribute the remainder
        * between all active troves.
        *
        *  If the trove's debt is larger than the deposited LUSD in the Stability Pool:
        *
        *  - Offset an amount of the trove's debt equal to the LUSD in the Stability Pool
        *  - Send a fraction of the trove's collateral to the Stability Pool, equal to the fraction of its offset debt
        *
        */
            debtToOffset = LiquityMath._min(_debt, _LUSDInStabPool);
            collToSendToSP = _coll.mul(debtToOffset).div(_debt);
            debtToRedistribute = _debt.sub(debtToOffset);
            collToRedistribute = _coll.sub(collToSendToSP);
        } else {
            debtToOffset = 0;
            collToSendToSP = 0;
            debtToRedistribute = _debt;
            collToRedistribute = _coll;
        }
    }

    /*
    *  If it is a full offset, get its offset coll/debt and ETH gas comp, and close the trove.
    *
    * If it is a partial liquidation, get its offset coll/debt and ETH gas comp, and its new coll/debt, and its re-insertion hints.
    */
    function _getFullOrPartialOffsetVals
    (
        address _borrower,
        uint _entireTroveDebt,
        uint _entireTroveColl,
        uint _LUSDInStabPool
    )
        internal
        returns (LiquidationValues memory V)
    {
        V.entireTroveDebt = _entireTroveDebt;
        V.entireTroveColl = _entireTroveColl;

        // When Stability Pool can fully absorb the trove's debt, perform a full offset
        if (_entireTroveDebt <= _LUSDInStabPool) {
            V.collGasCompensation = _getCollGasCompensation(_entireTroveColl);
            V.LUSDGasCompensation = LUSD_GAS_COMPENSATION;

            V.debtToOffset = _entireTroveDebt;
            V.collToSendToSP = _entireTroveColl.sub(V.collGasCompensation);
            V.debtToRedistribute = 0;
            V.collToRedistribute = 0;

            emit TroveLiquidated(_borrower, _entireTroveDebt, _entireTroveColl, TroveManagerOperation.liquidateInRecoveryMode);
        }
        /* 
        * When trove's debt is greater than the Stability Pool, perform a partial liquidation: offset as much as possible,
        * and do not redistribute the remainder. The trove remains active, with a reduced collateral and debt.
        *
        * ETH gas compensation is based on and drawn from the collateral fraction that corresponds to the partial offset. 
        * LUSD gas compensation is left untouched. 
        *
        * Since ETH gas comp is drawn purely from the *liquidated* portion, the trove is left with the same ICR as before the 
        * liquidation.
        */
        else { // if (_entireTroveDebt > _LUSDInStabPool)
            // Remaining debt in the trove is lower-bounded by the trove's gas compensation
            V.partialNewDebt = LiquityMath._max(_entireTroveDebt.sub(_LUSDInStabPool), LUSD_GAS_COMPENSATION);
          
            V.debtToOffset = _entireTroveDebt.sub(V.partialNewDebt);

            uint collFraction = _entireTroveColl.mul(V.debtToOffset).div(_entireTroveDebt);
            V.collGasCompensation = _getCollGasCompensation(collFraction);
          
            V.LUSDGasCompensation = 0;  // LUSD gas compensation remains untouched

            V.collToSendToSP = collFraction.sub(V.collGasCompensation);
            V.collToRedistribute = 0;
            V.debtToRedistribute = 0;

            V.partialAddr = _borrower;
            V.partialNewColl = _entireTroveColl.sub(collFraction);

            // Get the partial trove's neighbours, so we can re-insert it later to the same position
            V.partialUpperHint = sortedTroves.getPrev(_borrower);  
            V.partialLowerHint = sortedTroves.getNext(_borrower);
        }
    }

    /* 
    * Liquidate a sequence of troves. Closes a maximum number of n under-collateralized Troves,
    * starting from the one with the lowest collateral ratio in the system, and moving upwards
    */
    function liquidateTroves(uint _n) external override {
        LocalVariables_OuterLiquidationFunction memory L;

        LiquidationTotals memory T;

        L.price = priceFeed.getPrice();
        L.LUSDInStabPool = stabilityPool.getTotalLUSDDeposits();
        L.recoveryModeAtStart = checkRecoveryMode();

        // Perform the appropriate liquidation sequence - tally the values, and obtain their totals
        if (L.recoveryModeAtStart == true) {
            T = _getTotalsFromLiquidateTrovesSequence_RecoveryMode(L.price, L.LUSDInStabPool, _n);
        } else { // if L.recoveryModeAtStart == false
            T = _getTotalsFromLiquidateTrovesSequence_NormalMode(L.price, L.LUSDInStabPool, _n);
        }

        // Move liquidated ETH and LUSD to the appropriate pools
        stabilityPool.offset(T.totalDebtToOffset, T.totalCollToSendToSP);
        _redistributeDebtAndColl(T.totalDebtToRedistribute, T.totalCollToRedistribute);

        // Update system snapshots and the final partially liquidated trove, if there is one
        _updateSystemSnapshots_excludeCollRemainder(T.partialNewColl.add(T.totalCollGasCompensation));
        _updatePartiallyLiquidatedTrove(T.partialAddr, T.partialNewDebt, T.partialNewColl, T.partialUpperHint, T. partialLowerHint);

        L.liquidatedDebt = T.totalDebtInSequence.sub(T.partialNewDebt);
        L.liquidatedColl = T.totalCollInSequence.sub(T.totalCollGasCompensation).sub(T.partialNewColl);
        emit Liquidation(L.liquidatedDebt, L.liquidatedColl, T.totalCollGasCompensation, T.totalLUSDGasCompensation);

        // Send gas compensation to caller
        _sendGasCompensation(msg.sender, T.totalLUSDGasCompensation, T.totalCollGasCompensation);
    }

    /*
    * This function is used when the liquidateTroves sequence starts during Recovery Mode. However, it
    * handle the case where the system *leaves* Recovery Mode, part way through the liquidation sequence
    */
    function _getTotalsFromLiquidateTrovesSequence_RecoveryMode
    (
        uint _price,
        uint _LUSDInStabPool,
        uint _n
    )
        internal
        returns(LiquidationTotals memory T)
    {
        LocalVariables_LiquidationSequence memory L;
        LiquidationValues memory V;

        L.remainingLUSDInStabPool = _LUSDInStabPool;
        L.backToNormalMode = false;
        L.entireSystemDebt = activePool.getLUSDDebt().add(defaultPool.getLUSDDebt());
        L.entireSystemColl = activePool.getETH().add(defaultPool.getETH());

        L.i = 0;
        while (L.i < _n) {
            L.user = sortedTroves.getLast();
            L.ICR = getCurrentICR(L.user, _price);

            if (L.backToNormalMode == false) {
                // Break the loop if ICR is greater than MCR and Stability Pool is empty
                if (L.ICR >= MCR && L.remainingLUSDInStabPool == 0) { break; }

                uint TCR = LiquityMath._computeCR(L.entireSystemColl, L.entireSystemDebt, _price);
        
                V = _liquidateRecoveryMode(L.user, L.ICR, L.remainingLUSDInStabPool, TCR);

                // Update aggregate trackers
                L.remainingLUSDInStabPool = L.remainingLUSDInStabPool.sub(V.debtToOffset);
                L.entireSystemDebt = L.entireSystemDebt.sub(V.debtToOffset);
                L.entireSystemColl = L.entireSystemColl.sub(V.collToSendToSP);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);

                // Break the loop if it was a partial liquidation
                if (V.partialAddr != address(0)) {break;}

                L.backToNormalMode = !_checkPotentialRecoveryMode(L.entireSystemColl, L.entireSystemDebt, _price);
            }
            else if (L.backToNormalMode == true && L.ICR < MCR) {
                V = _liquidateNormalMode(L.user, L.remainingLUSDInStabPool);

                L.remainingLUSDInStabPool = L.remainingLUSDInStabPool.sub(V.debtToOffset);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);

            }  else break;  // break if the loop reaches a Trove with ICR >= MCR

            // Break the loop if it reaches the first Trove in the sorted list
            if (L.user == sortedTroves.getFirst()) { break; }
            L.i++;
        }
    }

    function _getTotalsFromLiquidateTrovesSequence_NormalMode
    (
        uint _price,
        uint _LUSDInStabPool,
        uint _n
    )
        internal
        returns(LiquidationTotals memory T)
    {
        LocalVariables_LiquidationSequence memory L;
        LiquidationValues memory V;

        L.remainingLUSDInStabPool = _LUSDInStabPool;

        L.i = 0;
        while (L.i < _n) {
            L.user = sortedTroves.getLast();
            L.ICR = getCurrentICR(L.user, _price);

            if (L.ICR < MCR) {
                V = _liquidateNormalMode(L.user, L.remainingLUSDInStabPool);

                L.remainingLUSDInStabPool = L.remainingLUSDInStabPool.sub(V.debtToOffset);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);

            } else break;  // break if the loop reaches a Trove with ICR >= MCR

            L.i++;
        }
    }

    /* 
    * Attempt to liquidate a custom list of troves provided by the caller. The liquidation sequence stops if
    * a partial liquidation is performed, so it's up to the caller to order the troves in the _troveArray parameter.
    */
    function batchLiquidateTroves(address[] memory _troveArray) public override {
        require(_troveArray.length != 0, "TroveManager: Calldata address array must not be empty");

        LocalVariables_OuterLiquidationFunction memory L;
        LiquidationTotals memory T;

        L.price = priceFeed.getPrice();
        L.LUSDInStabPool = stabilityPool.getTotalLUSDDeposits();
        L.recoveryModeAtStart = checkRecoveryMode();

        // Perform the appropriate liquidation sequence - tally values and obtain their totals.
        if (L.recoveryModeAtStart == true) {
           T = _getTotalFromBatchLiquidate_RecoveryMode(L.price, L.LUSDInStabPool, _troveArray);
        } else {  //  if L.recoveryModeAtStart == false
            T = _getTotalsFromBatchLiquidate_NormalMode(L.price, L.LUSDInStabPool, _troveArray);
        }

        // Move liquidated ETH and LUSD to the appropriate pools
        stabilityPool.offset(T.totalDebtToOffset, T.totalCollToSendToSP);
        _redistributeDebtAndColl(T.totalDebtToRedistribute, T.totalCollToRedistribute);

        // Update system snapshots and the final partially liquidated trove, if there is one
        _updateSystemSnapshots_excludeCollRemainder(T.partialNewColl.add(T.totalCollGasCompensation));
        _updatePartiallyLiquidatedTrove(T.partialAddr, T.partialNewDebt, T.partialNewColl, T.partialUpperHint, T. partialLowerHint);

        L.liquidatedDebt = T.totalDebtInSequence.sub(T.partialNewDebt);
        L.liquidatedColl = T.totalCollInSequence.sub(T.totalCollGasCompensation).sub(T.partialNewColl);
        emit Liquidation(L.liquidatedDebt, L.liquidatedColl, T.totalCollGasCompensation, T.totalLUSDGasCompensation);

        // Send gas compensation to caller
        _sendGasCompensation(msg.sender, T.totalLUSDGasCompensation, T.totalCollGasCompensation);
    }

    /* 
    * This function is used when the batch liquidation sequence starts during Recovery Mode. However, it
    * handle the case where the system *leaves* Recovery Mode, part way through the liquidation sequence
    */
    function _getTotalFromBatchLiquidate_RecoveryMode
    (
        uint _price,
        uint _LUSDInStabPool,
        address[] memory _troveArray)
        internal
        returns(LiquidationTotals memory T)
    {
        LocalVariables_LiquidationSequence memory L;
        LiquidationValues memory V;

        L.remainingLUSDInStabPool = _LUSDInStabPool;
        L.backToNormalMode = false;
        L.entireSystemDebt = activePool.getLUSDDebt().add(defaultPool.getLUSDDebt());
        L.entireSystemColl = activePool.getETH().add(defaultPool.getETH());

        L.i = 0;
        for (L.i = 0; L.i < _troveArray.length; L.i++) {
            L.user = _troveArray[L.i];
            L.ICR = getCurrentICR(L.user, _price);

            if (L.backToNormalMode == false) {

                // Skip this trove if ICR is greater than MCR and Stability Pool is empty
                if (L.ICR >= MCR && L.remainingLUSDInStabPool == 0) { continue; }

                uint TCR = LiquityMath._computeCR(L.entireSystemColl, L.entireSystemDebt, _price);

                V = _liquidateRecoveryMode(L.user, L.ICR, L.remainingLUSDInStabPool, TCR);

                // Update aggregate trackers
                L.remainingLUSDInStabPool = L.remainingLUSDInStabPool.sub(V.debtToOffset);
                L.entireSystemDebt = L.entireSystemDebt.sub(V.debtToOffset);
                L.entireSystemColl = L.entireSystemColl.sub(V.collToSendToSP);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);

                // Break the loop if it was a partial liquidation
                if (V.partialAddr != address(0)) { break; }

                L.backToNormalMode = !_checkPotentialRecoveryMode(L.entireSystemColl, L.entireSystemDebt, _price);
            }

            else if (L.backToNormalMode == true && L.ICR < MCR) {
                V = _liquidateNormalMode(L.user, L.remainingLUSDInStabPool);
                L.remainingLUSDInStabPool = L.remainingLUSDInStabPool.sub(V.debtToOffset);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);
            
            } else continue; // In Normal Mode skip troves with ICR >= MCR  
        }
    }

    function _getTotalsFromBatchLiquidate_NormalMode
    (
        uint _price,
        uint _LUSDInStabPool,
        address[] memory _troveArray
    )
        internal
        returns(LiquidationTotals memory T)
    {
        LocalVariables_LiquidationSequence memory L;
        LiquidationValues memory V;

        L.remainingLUSDInStabPool = _LUSDInStabPool;

        for (L.i = 0; L.i < _troveArray.length; L.i++) {
            L.user = _troveArray[L.i];
            L.ICR = getCurrentICR(L.user, _price);

            if (L.ICR < MCR) {
                V = _liquidateNormalMode(L.user, L.remainingLUSDInStabPool);
                L.remainingLUSDInStabPool = L.remainingLUSDInStabPool.sub(V.debtToOffset);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);
            }
        }
    }

    // --- Liquidation helper functions ---

    function _addLiquidationValuesToTotals(LiquidationTotals memory T1, LiquidationValues memory V)
    internal pure returns(LiquidationTotals memory T2) {

        // Tally all the values with their respective running totals
        T2.totalCollGasCompensation = T1.totalCollGasCompensation.add(V.collGasCompensation);
        T2.totalLUSDGasCompensation = T1.totalLUSDGasCompensation.add(V.LUSDGasCompensation);
        T2.totalDebtInSequence = T1.totalDebtInSequence.add(V.entireTroveDebt);
        T2.totalCollInSequence = T1.totalCollInSequence.add(V.entireTroveColl);
        T2.totalDebtToOffset = T1.totalDebtToOffset.add(V.debtToOffset);
        T2.totalCollToSendToSP = T1.totalCollToSendToSP.add(V.collToSendToSP);
        T2.totalDebtToRedistribute = T1.totalDebtToRedistribute.add(V.debtToRedistribute);
        T2.totalCollToRedistribute = T1.totalCollToRedistribute.add(V.collToRedistribute);

        // Assign the address of the partially liquidated trove, and its new debt and coll values
        T2.partialAddr = V.partialAddr;
        T2.partialNewDebt = V.partialNewDebt;
        T2.partialNewColl = V.partialNewColl;
        T2.partialUpperHint = V.partialUpperHint;
        T2.partialLowerHint = V.partialLowerHint;

        return T2;
    }

    // Update the properties of the partially liquidated trove, and insert it back to the list
    function _updatePartiallyLiquidatedTrove
    (
        address _borrower, 
        uint _newDebt, 
        uint _newColl, 
        address _upperHint,
        address _lowerHint
    )
        internal 
    {
        if ( _borrower == address(0)) { return; }

        Troves[_borrower].debt = _newDebt;
        Troves[_borrower].coll = _newColl;
        Troves[_borrower].status = Status.active;

        _updateTroveRewardSnapshots(_borrower);
        _updateStakeAndTotalStakes(_borrower);

        uint NICR = getNominalICR(_borrower);

        /* 
        * Insert to sorted list and add to TroveOwners array. The partially liquidated trove has the same
        * ICR as it did before the liquidation, so insertion is O(1): in principle, its ICR does not change.
        * In practice, due to rounding error, its ICR can change slightly - so re-insert, with its previous neighbours
        * as hints.
        */
        sortedTroves.insert(_borrower, NICR, _upperHint, _lowerHint);
        _addTroveOwnerToArray(_borrower);
        emit TroveUpdated(_borrower, _newDebt, _newColl, Troves[_borrower].stake, TroveManagerOperation.partiallyLiquidateInRecoveryMode);
    }

    function _sendGasCompensation(address _liquidator, uint _LUSD, uint _ETH) internal {
        if (_LUSD > 0) {
            lusdToken.returnFromPool(GAS_POOL_ADDRESS, _liquidator, _LUSD);
        }

        if (_ETH > 0) {
            activePool.sendETH(_liquidator, _ETH);
        }
    }

    // Move a Trove's pending debt and collateral rewards from distributions, from the Default Pool to the Active Pool
    function _movePendingTroveRewardsToActivePool(uint _LUSD, uint _ETH) internal {
        defaultPool.decreaseLUSDDebt(_LUSD);
        activePool.increaseLUSDDebt(_LUSD);
        defaultPool.sendETHToActivePool(_ETH);
    }

    // --- Redemption functions ---

    // Redeem as much collateral as possible from _borrower's Trove in exchange for LUSD up to _maxLUSDamount
    function _redeemCollateralFromTrove(
        address _borrower,
        uint _maxLUSDamount,
        uint _price,
        address _partialRedemptionHint,
        uint _partialRedemptionHintNICR
    )
        internal returns (SingleRedemptionValues memory V)
    {
        // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the Trove minus the gas compensation
        V.LUSDLot = LiquityMath._min(_maxLUSDamount, Troves[_borrower].debt.sub(LUSD_GAS_COMPENSATION));

        // Get the ETHLot of equivalent value in USD
        V.ETHLot = V.LUSDLot.mul(1e18).div(_price);

        // Decrease the debt and collateral of the current Trove according to the LUSD lot and corresponding ETH to send
        uint newDebt = (Troves[_borrower].debt).sub(V.LUSDLot);
        uint newColl = (Troves[_borrower].coll).sub(V.ETHLot);

        if (newDebt == LUSD_GAS_COMPENSATION) {
            // No debt left in the Trove (except for the gas compensation), therefore the trove gets closed
            _removeStake(_borrower);
            _closeTrove(_borrower);
            _redeemCloseTrove(_borrower, LUSD_GAS_COMPENSATION, newColl);

        } else {
            uint newNICR = LiquityMath._computeNominalCR(newColl, newDebt);

            // Check if the provided hint is fresh. If not, we bail since trying to reinsert without a good hint will almost
            // certainly result in running out of gas.
            if (newNICR != _partialRedemptionHintNICR) {
                V.LUSDLot = 0;
                V.ETHLot = 0;
                return V;
            }

            sortedTroves.reInsert(_borrower, newNICR, _partialRedemptionHint, _partialRedemptionHint);

            Troves[_borrower].debt = newDebt;
            Troves[_borrower].coll = newColl;
            _updateStakeAndTotalStakes(_borrower);
        }
        emit TroveUpdated(
            _borrower,
            newDebt, newColl,
            Troves[_borrower].stake,
            TroveManagerOperation.redeemCollateral
        );
        return V;
    }

    /* 
    * Called when a full redemption occurs, and closes the trove.
    * The redeemer swaps (debt - 10) LUSD for (debt - 10) worth of ETH, so the 10 LUSD gas compensation left corresponds to the remaining debt.
    * In order to close the trove, the 10 LUSD gas compensation is burned, and 10 debt is removed from the active pool.
    * The debt recorded on the trove's struct is zero'd elswhere, in _closeTrove.
    * Any surplus ETH left in the trove, is sent to the Coll surplus pool, and can be later claimed by the borrower.
    */ 
    function _redeemCloseTrove(address _borrower, uint _LUSD, uint _ETH) internal {
        lusdToken.burn(GAS_POOL_ADDRESS, _LUSD);
        // Update Active Pool LUSD, and send ETH to account
        activePool.decreaseLUSDDebt(_LUSD);

        // send ETH from Active Pool to CollSurplus Pool
        collSurplusPool.accountSurplus(_borrower, _ETH);
        activePool.sendETH(address(collSurplusPool), _ETH);
    }

    function _isValidFirstRedemptionHint(address _firstRedemptionHint, uint _price) internal view returns (bool) {
        if (_firstRedemptionHint == address(0) ||
            !sortedTroves.contains(_firstRedemptionHint) ||
            getCurrentICR(_firstRedemptionHint, _price) < MCR
        ) {
            return false;
        }

        address nextTrove = sortedTroves.getNext(_firstRedemptionHint);
        return nextTrove == address(0) || getCurrentICR(nextTrove, _price) < MCR;
    }

    /* Send _LUSDamount LUSD to the system and redeem the corresponding amount of collateral from as many Troves as are needed to fill the redemption
    * request.  Applies pending rewards to a Trove before reducing its debt and coll.
    *
    * Note that if _amount is very large, this function can run out of gas, specially if traversed troves are small. This can be easily avoided by 
    * splitting the total _amount in appropriate chunks and calling the function multiple times.
    * 
    * Param `_maxIterations` can also be provided, so the loop through Troves is capped (if it’s zero, it will be ignored).This makes it easier to 
    * avoid OOG for the frontend, as only knowing approximately the average cost of an iteration is enough, without needing to know the “topology” 
    * of the trove list. It also avoids the need to set the cap in stone in the contract, nor doing gas calculations, as both gas price and opcode 
    * costs can vary.
    * 
    * All Troves that are redeemed from -- with the likely exception of the last one -- will end up with no debt left, therefore they will be closed.
    * If the last Trove does have some remaining debt, it has a finite ICR, and the reinsertion could be anywhere in the list, therefore it requires a hint. 
    * A frontend should use getRedemptionHints() to calculate what the ICR of this Trove will be after redemption, and pass a hint for its position 
    * in the sortedTroves list along with the ICR value that the hint was found for.
    * 
    * If another transaction modifies the list between calling getRedemptionHints() and passing the hints to redeemCollateral(), it
    * is very likely that the last (partially) redeemed Trove would end up with a different ICR than what the hint is for. In this case the
    * redemption will stop after the last completely redeemed Trove and the sender will keep the remaining LUSD amount, which they can attempt
    * to redeem later.
    */
    function redeemCollateral(
        uint _LUSDamount,
        address _firstRedemptionHint,
        address _partialRedemptionHint,
        uint _partialRedemptionHintICR,
        uint _maxIterations
    )
        external
        override
    {
        uint activeDebt = activePool.getLUSDDebt();
        uint defaultedDebt = defaultPool.getLUSDDebt();

        RedemptionTotals memory T;

        _requireAmountGreaterThanZero(_LUSDamount);
        _requireLUSDBalanceCoversRedemption(msg.sender, _LUSDamount);

        // Confirm redeemer's balance is less than total systemic debt
        assert(lusdToken.balanceOf(msg.sender) <= (activeDebt.add(defaultedDebt)));

        uint remainingLUSD = _LUSDamount;
        uint price = priceFeed.getPrice();
        address currentBorrower;

        if (_isValidFirstRedemptionHint(_firstRedemptionHint, price)) {
            currentBorrower = _firstRedemptionHint;
        } else {
            currentBorrower = sortedTroves.getLast();
            // Find the first trove with ICR >= MCR
            while (currentBorrower != address(0) && getCurrentICR(currentBorrower, price) < MCR) {
                currentBorrower = sortedTroves.getPrev(currentBorrower);
            }
        }

        // Loop through the Troves starting from the one with lowest collateral ratio until _amount of LUSD is exchanged for collateral
        if (_maxIterations == 0) { _maxIterations = uint(-1); }
        while (currentBorrower != address(0) && remainingLUSD > 0 && _maxIterations > 0) {
            _maxIterations--;
            // Save the address of the Trove preceding the current one, before potentially modifying the list
            address nextUserToCheck = sortedTroves.getPrev(currentBorrower);

            _applyPendingRewards(currentBorrower);

            SingleRedemptionValues memory V = _redeemCollateralFromTrove(
                currentBorrower,
                remainingLUSD,
                price,
                _partialRedemptionHint,
                _partialRedemptionHintICR
            );

            if (V.LUSDLot == 0) break; // Partial redemption hint got out-of-date, therefore we could not redeem from the last Trove

            T.totalLUSDToRedeem  = T.totalLUSDToRedeem.add(V.LUSDLot);
            T.totalETHDrawn = T.totalETHDrawn.add(V.ETHLot);

            remainingLUSD = remainingLUSD.sub(V.LUSDLot);
            currentBorrower = nextUserToCheck;
        }

        // Decay the baseRate due to time passed, and then increase it according to the size of this redemption
        _updateBaseRateFromRedemption(T.totalETHDrawn, price);

        // Calculate the ETH fee and send it to the LQTY staking contract
        T.ETHFee = _getRedemptionFee(T.totalETHDrawn);
        activePool.sendETH(lqtyStakingAddress, T.ETHFee);
        lqtyStaking.increaseF_ETH(T.ETHFee);

        T.ETHToSendToRedeemer = T.totalETHDrawn.sub(T.ETHFee);

        // Burn the total LUSD that is cancelled with debt, and send the redeemed ETH to msg.sender
        _activePoolRedeemCollateral(msg.sender, T.totalLUSDToRedeem, T.ETHToSendToRedeemer);

        emit Redemption(_LUSDamount, T.totalLUSDToRedeem, T.totalETHDrawn, T.ETHFee);
    }

    // Burn the received LUSD, transfer the redeemed ETH to _redeemer and updates the Active Pool
    function _activePoolRedeemCollateral(address _redeemer, uint _LUSD, uint _ETH) internal {
        // Update Active Pool LUSD, and send ETH to account
        lusdToken.burn(_redeemer, _LUSD);
        activePool.decreaseLUSDDebt(_LUSD);

        activePool.sendETH(_redeemer, _ETH);
    }

    // --- Helper functions ---


    // Return the nominal collateral ratio (ICR) of a given Trove, without the price. Takes a trove's pending coll and debt rewards from redistributions into account.
    function getNominalICR(address _borrower) public view override returns (uint) {
        (uint currentETH, uint currentLUSDDebt) = _getCurrentTroveAmounts(_borrower);

        uint NICR = LiquityMath._computeNominalCR(currentETH, currentLUSDDebt);
        return NICR;
    }

    // Return the current collateral ratio (ICR) of a given Trove. Takes a trove's pending coll and debt rewards from redistributions into account.
    function getCurrentICR(address _borrower, uint _price) public view override returns (uint) {
        (uint currentETH, uint currentLUSDDebt) = _getCurrentTroveAmounts(_borrower);

        uint ICR = LiquityMath._computeCR(currentETH, currentLUSDDebt, _price);
        return ICR;
    }

    function _getCurrentTroveAmounts(address _borrower) internal view returns (uint, uint) {
        uint pendingETHReward = getPendingETHReward(_borrower);
        uint pendingLUSDDebtReward = getPendingLUSDDebtReward(_borrower);

        uint currentETH = Troves[_borrower].coll.add(pendingETHReward);
        uint currentLUSDDebt = Troves[_borrower].debt.add(pendingLUSDDebtReward);

        return (currentETH, currentLUSDDebt);
    }

    function applyPendingRewards(address _borrower) external override {
        _requireCallerIsBorrowerOperations();
        return _applyPendingRewards(_borrower);
    }

    // Add the borrowers's coll and debt rewards earned from redistributions, to their Trove
    function _applyPendingRewards(address _borrower) internal {
        if (hasPendingRewards(_borrower)) {
            _requireTroveisActive(_borrower);

            // Compute pending rewards
            uint pendingETHReward = getPendingETHReward(_borrower);
            uint pendingLUSDDebtReward = getPendingLUSDDebtReward(_borrower);

            // Apply pending rewards to trove's state
            Troves[_borrower].coll = Troves[_borrower].coll.add(pendingETHReward);
            Troves[_borrower].debt = Troves[_borrower].debt.add(pendingLUSDDebtReward);

            _updateTroveRewardSnapshots(_borrower);

            // Transfer from DefaultPool to ActivePool
            _movePendingTroveRewardsToActivePool(pendingLUSDDebtReward, pendingETHReward);

            emit TroveUpdated(
                _borrower, 
                Troves[_borrower].debt, 
                Troves[_borrower].coll, 
                Troves[_borrower].stake, 
                TroveManagerOperation.applyPendingRewards
            );
        }
    }

    // Update borrower's snapshots of L_ETH and L_LUSDDebt to reflect the current values
    function updateTroveRewardSnapshots(address _borrower) external override {
        _requireCallerIsBorrowerOperations();
       return _updateTroveRewardSnapshots(_borrower);
    }

    function _updateTroveRewardSnapshots(address _borrower) internal {
        rewardSnapshots[_borrower].ETH = L_ETH;
        rewardSnapshots[_borrower].LUSDDebt = L_LUSDDebt;
    }

    // Get the borrower's pending accumulated ETH reward, earned by their stake
    function getPendingETHReward(address _borrower) public view override returns (uint) {
        uint snapshotETH = rewardSnapshots[_borrower].ETH;
        uint rewardPerUnitStaked = L_ETH.sub(snapshotETH);

        if ( rewardPerUnitStaked == 0 ) { return 0; }

        uint stake = Troves[_borrower].stake;

        uint pendingETHReward = stake.mul(rewardPerUnitStaked).div(1e18);

        return pendingETHReward;
    }

     // Get the borrower's pending accumulated LUSD reward, earned by their stake
    function getPendingLUSDDebtReward(address _borrower) public view override returns (uint) {
        uint snapshotLUSDDebt = rewardSnapshots[_borrower].LUSDDebt;
        uint rewardPerUnitStaked = L_LUSDDebt.sub(snapshotLUSDDebt);

        if ( rewardPerUnitStaked == 0 ) { return 0; }

        uint stake =  Troves[_borrower].stake;

        uint pendingLUSDDebtReward = stake.mul(rewardPerUnitStaked).div(1e18);

        return pendingLUSDDebtReward;
    }

    function hasPendingRewards(address _borrower) public view override returns (bool) {
        /* 
        * A Trove has pending rewards if its snapshot is less than the current rewards per-unit-staked sum:
        * this indicates that rewards have occured since the snapshot was made, and the user therefore has
        * pending rewards 
        */
        return (rewardSnapshots[_borrower].ETH < L_ETH);
    }

    // Return the Troves entire debt and coll, including pending rewards from redistributions.
    function getEntireDebtAndColl(
        address _borrower
    )
        public
        view
        override
        returns (uint debt, uint coll, uint pendingLUSDDebtReward, uint pendingETHReward)
    {
        debt = Troves[_borrower].debt;
        coll = Troves[_borrower].coll;

        pendingLUSDDebtReward = getPendingLUSDDebtReward(_borrower);
        pendingETHReward = getPendingETHReward(_borrower);

        debt = debt.add(pendingLUSDDebtReward);
        coll = coll.add(pendingETHReward);
    }

    function removeStake(address _borrower) external override {
        _requireCallerIsBorrowerOperations();
        return _removeStake(_borrower);
    }

    // Remove borrower's stake from the totalStakes sum, and set their stake to 0
    function _removeStake(address _borrower) internal {
        uint stake = Troves[_borrower].stake;
        totalStakes = totalStakes.sub(stake);
        Troves[_borrower].stake = 0;
    }

    function updateStakeAndTotalStakes(address _borrower) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        return _updateStakeAndTotalStakes(_borrower);
    }

    // Update borrower's stake based on their latest collateral value
    function _updateStakeAndTotalStakes(address _borrower) internal returns (uint) {
        uint newStake = _computeNewStake(Troves[_borrower].coll);
        uint oldStake = Troves[_borrower].stake;
        Troves[_borrower].stake = newStake;
        totalStakes = totalStakes.sub(oldStake).add(newStake);

        return newStake;
    }

    // Calculate a new stake based on the snapshots of the totalStakes and totalCollateral taken at the last liquidation
    function _computeNewStake(uint _coll) internal view returns (uint) {
        uint stake;
        if (totalCollateralSnapshot == 0) {
            stake = _coll;
        } else {
            /*  
            * The following assert() holds true because:
            * - The system always contains >= 1 trove 
            * - When we close or liquidate a trove, we redistribute the pending rewards, so if all troves were closed/liquidated, 
            * rewards would’ve been emptied and totalCollateralSnapshot would be zero too.
            */
            assert(totalStakesSnapshot > 0);
            stake = _coll.mul(totalStakesSnapshot).div(totalCollateralSnapshot);
        }
        return stake;
    }

    function _redistributeDebtAndColl(uint _debt, uint _coll) internal {
        if (_debt == 0) { return; }

        /* 
        * Add distributed coll and debt rewards-per-unit-staked to the running totals.
        * Division uses a "feedback" error correction, to keep the cumulative error in
        * the  L_ETH and L_LUSDDebt state variables low. 
        */
        uint ETHNumerator = _coll.mul(1e18).add(lastETHError_Redistribution);
        uint LUSDDebtNumerator = _debt.mul(1e18).add(lastLUSDDebtError_Redistribution);

        uint ETHRewardPerUnitStaked = ETHNumerator.div(totalStakes);
        uint LUSDDebtRewardPerUnitStaked = LUSDDebtNumerator.div(totalStakes);

        lastETHError_Redistribution = ETHNumerator.sub(ETHRewardPerUnitStaked.mul(totalStakes));
        lastLUSDDebtError_Redistribution = LUSDDebtNumerator.sub(LUSDDebtRewardPerUnitStaked.mul(totalStakes));

        L_ETH = L_ETH.add(ETHRewardPerUnitStaked);
        L_LUSDDebt = L_LUSDDebt.add(LUSDDebtRewardPerUnitStaked);

        // Transfer coll and debt from ActivePool to DefaultPool
        activePool.decreaseLUSDDebt(_debt);
        defaultPool.increaseLUSDDebt(_debt);
        activePool.sendETH(address(defaultPool), _coll);
    }

    function closeTrove(address _borrower) external override {
        _requireCallerIsBorrowerOperations();
        return _closeTrove(_borrower);
    }

    function _closeTrove(address _borrower) internal {
        uint TroveOwnersArrayLength = TroveOwners.length;
        _requireMoreThanOneTroveInSystem(TroveOwnersArrayLength);

        Troves[_borrower].status = Status.closed;
        Troves[_borrower].coll = 0;
        Troves[_borrower].debt = 0;

        rewardSnapshots[_borrower].ETH = 0;
        rewardSnapshots[_borrower].LUSDDebt = 0;

        _removeTroveOwner(_borrower, TroveOwnersArrayLength);
        sortedTroves.remove(_borrower);
    }

    /* 
    * Updates snapshots of system total stakes and total collateral, excluding a given collateral remainder from the calculation. 
    * Used in a liquidation sequence.
    *
    * The calculation excludes two portions of collateral that are in the ActivePool: 
    *
    * 1) the total ETH gas compensation from the liquidation sequence
    * 2) The remaining collateral in a partially liquidated trove (if one occurred)
    *
    * The ETH as compensation must be excluded as it is always sent out at the very end of the liquidation sequence.
    *
    * The partially liquidated trove's remaining collateral stays in the ActivePool, but it is excluded here so the system 
    * can take snapshots before the partially liquidated trove's stake is updated (based on these snapshots). This ensures
    * the partial's new stake doesn't double-count its own remaining collateral.
    *
    */
    function _updateSystemSnapshots_excludeCollRemainder(uint _collRemainder) internal {
        totalStakesSnapshot = totalStakes;

        uint activeColl = activePool.getETH();
        uint liquidatedColl = defaultPool.getETH();
        totalCollateralSnapshot = activeColl.sub(_collRemainder).add(liquidatedColl);
    }

    // Push the owner's address to the Trove owners list, and record the corresponding array index on the Trove struct
    function addTroveOwnerToArray(address _borrower) external override returns (uint index) {
        _requireCallerIsBorrowerOperations();
        return _addTroveOwnerToArray(_borrower);
    }

    function _addTroveOwnerToArray(address _borrower) internal returns (uint128 index) {
        /* Max array size is 2**128 - 1, i.e. ~3e30 troves. No risk of overflow, since troves have minimum 10 LUSD
        debt. 3e31 LUSD dwarfs the value of all wealth in the world ( which is < 1e15 USD). */
    
        // Push the Troveowner to the array
        TroveOwners.push(_borrower);

        // Record the index of the new Troveowner on their Trove struct
        index = uint128(TroveOwners.length.sub(1));
        Troves[_borrower].arrayIndex = index;

        return index;
    }

    /* 
    * Remove a Trove owner from the TroveOwners array, not preserving array order. Removing owner 'B' does the following:
    * [A B C D E] => [A E C D], and updates E's Trove struct to point to its new array index. 
    */
    function _removeTroveOwner(address _borrower, uint TroveOwnersArrayLength) internal {
        // It’s set in caller function `_closeTrove`
        assert(Troves[_borrower].status == Status.closed);

        uint128 index = Troves[_borrower].arrayIndex;
        uint length = TroveOwnersArrayLength;
        uint idxLast = length.sub(1);

        assert(index <= idxLast);

        address addressToMove = TroveOwners[idxLast];

        TroveOwners[index] = addressToMove;
        Troves[addressToMove].arrayIndex = index;
        TroveOwners.pop();
    }

    // --- Recovery Mode and TCR functions ---

    function checkRecoveryMode() public view override returns (bool) {
        uint TCR = getTCR();

        if (TCR < CCR) {
            return true;
        } else {
            return false;
        }
    }

    // Check whether or not the system *would be* in Recovery Mode, given an ETH:USD price, and the entire system coll and debt.
    function _checkPotentialRecoveryMode(
        uint _entireSystemColl,
        uint _entireSystemDebt,
        uint _price
    )
        internal
        pure
    returns (bool)
    {
        uint TCR = LiquityMath._computeCR(_entireSystemColl, _entireSystemDebt, _price);
        if (TCR < CCR) {
            return true;
        } else {
            return false;
        }
    }

    function getTCR() public view override returns (uint TCR) {
        uint price = priceFeed.getPrice();
        uint entireSystemColl = getEntireSystemColl();
        uint entireSystemDebt = getEntireSystemDebt();

        TCR = LiquityMath._computeCR(entireSystemColl, entireSystemDebt, price);

        return TCR;
    }

    function getEntireSystemColl() public view override returns (uint entireSystemColl) {
        uint activeColl = activePool.getETH();
        uint liquidatedColl = defaultPool.getETH();

        return activeColl.add(liquidatedColl);
    }

    function getEntireSystemDebt() public view override returns (uint entireSystemDebt) {
        uint activeDebt = activePool.getLUSDDebt();
        uint closedDebt = defaultPool.getLUSDDebt();

        return activeDebt.add(closedDebt);
    }

    // --- Redemption fee functions ---

    /* 
    * This function has two impacts on the baseRate state variable:
    * 1) decays the baseRate based on time passed since last redemption or LUSD borrowing operation.
    * then,
    * 2) increases the baseRate based on the amount redeemed, as a proportion of total supply
    */
    function _updateBaseRateFromRedemption(uint _ETHDrawn,  uint _price) internal returns (uint) {
        uint decayedBaseRate = _calcDecayedBaseRate();

        uint activeDebt = activePool.getLUSDDebt();
        uint closedDebt = defaultPool.getLUSDDebt();
        uint totalLUSDSupply = activeDebt.add(closedDebt);

        /* Convert the drawn ETH back to LUSD at face value rate (1 LUSD:1 USD), in order to get
        * the fraction of total supply that was redeemed at face value. */
        uint redeemedLUSDFraction = _ETHDrawn.mul(_price).div(totalLUSDSupply);

        uint newBaseRate = decayedBaseRate.add(redeemedLUSDFraction.div(BETA));

        // Update the baseRate state variable
        baseRate = newBaseRate < 1e18 ? newBaseRate : 1e18;  // cap baseRate at a maximum of 100%
        assert(baseRate <= 1e18 && baseRate > 0); // Base rate is always non-zero after redemption

        _updateLastFeeOpTime();

        return baseRate;
    }

    function _getRedemptionFee(uint _ETHDrawn) internal view returns (uint) {
       return baseRate.mul(_ETHDrawn).div(1e18);
    }

    // --- Borrowing fee functions ---

    function getBorrowingFee(uint _LUSDDebt) external view override returns (uint) {
        return _LUSDDebt.mul(baseRate).div(1e18);
    }

    // Updates the baseRate state variable based on time elapsed since the last redemption or LUSD borrowing operation.
    function decayBaseRateFromBorrowing() external override {
        _requireCallerIsBorrowerOperations();

        baseRate = _calcDecayedBaseRate();
        assert(baseRate <= 1e18);  // The baseRate can decay to 0

        _updateLastFeeOpTime();
    }

    // --- Internal fee functions ---

    // Update the last fee operation time only if time passed >= decay interval. This prevents base rate griefing.
    function _updateLastFeeOpTime() internal {
        uint timePassed = block.timestamp.sub(lastFeeOperationTime);

        if (timePassed >= SECONDS_IN_ONE_MINUTE) {
            lastFeeOperationTime = block.timestamp;
        }
    }

    function _calcDecayedBaseRate() internal view returns (uint) {
        uint minutesPassed = _minutesPassedSinceLastFeeOp();
        uint decayFactor = LiquityMath._decPow(MINUTE_DECAY_FACTOR, minutesPassed);

        return baseRate.mul(decayFactor).div(1e18);
    }

    function _minutesPassedSinceLastFeeOp() internal view returns (uint) {
        return (block.timestamp.sub(lastFeeOperationTime)).div(SECONDS_IN_ONE_MINUTE);
    }

    // --- 'require' wrapper functions ---

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "TroveManager: Caller is not the BorrowerOperations contract");
    }

    function _requireTroveisActive(address _borrower) internal view {
        require(Troves[_borrower].status == Status.active, "TroveManager: Trove does not exist or is closed");
    }

    function _requireLUSDBalanceCoversRedemption(address _redeemer, uint _amount) internal view {
        require(lusdToken.balanceOf(_redeemer) >= _amount, "TroveManager: Requested redemption amount must be <= user's LUSD token balance");
    }

    function _requireMoreThanOneTroveInSystem(uint TroveOwnersArrayLength) internal view {
        require (TroveOwnersArrayLength > 1 && sortedTroves.getSize() > 1, "TroveManager: Only one trove in the system");
    }

    function _requireAmountGreaterThanZero(uint _amount) internal pure {
        require(_amount > 0, "TroveManager: Amount must be greater than zero");
    }

    // --- Trove property getters ---

    function getTroveStatus(address _borrower) external view override returns (uint) {
        return uint(Troves[_borrower].status);
    }

    function getTroveStake(address _borrower) external view override returns (uint) {
        return Troves[_borrower].stake;
    }

    function getTroveDebt(address _borrower) external view override returns (uint) {
        return Troves[_borrower].debt;
    }

    function getTroveColl(address _borrower) external view override returns (uint) {
        return Troves[_borrower].coll;
    }

    // --- Trove property setters, called by BorrowerOperations ---

    function setTroveStatus(address _borrower, uint _num) external override {
        _requireCallerIsBorrowerOperations();
        Troves[_borrower].status = Status(_num);
    }

    function increaseTroveColl(address _borrower, uint _collIncrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        uint newColl = Troves[_borrower].coll.add(_collIncrease);
        Troves[_borrower].coll = newColl;
        return newColl;
    }

    function decreaseTroveColl(address _borrower, uint _collDecrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        uint newColl = Troves[_borrower].coll.sub(_collDecrease);
        Troves[_borrower].coll = newColl;
        return newColl;
    }

    function increaseTroveDebt(address _borrower, uint _debtIncrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        uint newDebt = Troves[_borrower].debt.add(_debtIncrease);
        Troves[_borrower].debt = newDebt;
        return newDebt;
    }

    function decreaseTroveDebt(address _borrower, uint _debtDecrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        uint newDebt = Troves[_borrower].debt.sub(_debtDecrease);
        Troves[_borrower].debt = newDebt;
        return newDebt;
    }
}
