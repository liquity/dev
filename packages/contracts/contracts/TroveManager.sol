// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IPool.sol";
import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/ICLVToken.sol";
import "./Interfaces/ISortedCDPs.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/ILQTYStaking.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract TroveManager is LiquityBase, Ownable, ITroveManager {

    // --- Connected contract declarations ---

    address public borrowerOperationsAddress;

    IPool public activePool;

    IPool public defaultPool;

    IStabilityPool public stabilityPool;

    ICollSurplusPool collSurplusPool;

    ICLVToken public clvToken;

    IPriceFeed public priceFeed;

    ILQTYStaking public lqtyStaking;
    address public lqtyStakingAddress;

    // A doubly linked list of CDPs, sorted by their sorted by their collateral ratios
    ISortedCDPs public sortedCDPs;

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
    struct CDP {
        uint debt;
        uint coll;
        uint stake;
        Status status;
        uint128 arrayIndex;
    }

    mapping (address => CDP) public CDPs;

    uint public totalStakes;

    // Snapshot of the value of totalStakes, taken immediately after the latest liquidation
    uint public totalStakesSnapshot;

    // Snapshot of the total collateral across the ActivePool and DefaultPool, immediately after the latest liquidation.
    uint public totalCollateralSnapshot;

    /*
    * L_ETH and L_CLVDebt track the sums of accumulated liquidation rewards per unit staked. During its lifetime, each stake earns:
    *
    * An ETH gain of ( stake * [L_ETH - L_ETH(0)] )
    * A CLVDebt increase  of ( stake * [L_CLVDebt - L_CLVDebt(0)] )
    *
    * Where L_ETH(0) and L_CLVDebt(0) are snapshots of L_ETH and L_CLVDebt for the active CDP taken at the instant the stake was made
    */
    uint public L_ETH;
    uint public L_CLVDebt;

    // Map addresses with active troves to their RewardSnapshot
    mapping (address => RewardSnapshot) public rewardSnapshots;

    // Object containing the ETH and CLV snapshots for a given active trove
    struct RewardSnapshot { uint ETH; uint CLVDebt;}

    // Array of all active trove addresses - used to to compute an approximate hint off-chain, for the sorted list insertion
    address[] public CDPOwners;

    // Error trackers for the trove redistribution calculation
    uint public lastETHError_Redistribution;
    uint public lastCLVDebtError_Redistribution;

    /* 
    * --- Variable container structs for liquidations ---
    *
    * These structs are used to hold, return and assign variables inside the liquidation functions,
    * in order to avoid the error: "CompilerError: Stack too deep". 
    **/

    struct LocalVariables_OuterLiquidationFunction {
        uint price;
        uint CLVInStabPool;
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
        uint remainingCLVInStabPool;
        uint i;
        uint ICR;
        address user;
        bool backToNormalMode;
        uint entireSystemDebt;
        uint entireSystemColl;
    }

    struct LiquidationValues {
        uint entireCDPDebt;
        uint entireCDPColl;
        uint collGasCompensation;
        uint CLVGasCompensation;
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
        uint totalCLVGasCompensation;
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
        uint totalCLVToRedeem;
        uint totalETHDrawn;
        uint ETHFee;
        uint ETHToSendToRedeemer;
        uint decayedBaseRate;
    }

    struct SingleRedemptionValues {
        uint CLVLot;
        uint ETHLot;
    }

    // --- Events ---

    event Liquidation(uint _liquidatedDebt, uint _liquidatedColl, uint _collGasCompensation, uint _CLVGasCompensation);
    event Redemption(uint _attemptedCLVAmount, uint _actualCLVAmount, uint _ETHSent, uint _ETHFee);

    enum TroveManagerOperation {
        applyPendingRewards,
        liquidateInNormalMode,
        liquidateInRecoveryMode,
        partiallyLiquidateInRecoveryMode,
        redeemCollateral
    }

    event CDPCreated(address indexed _borrower, uint _arrayIndex);
    event CDPUpdated(address indexed _borrower, uint _debt, uint _coll, uint _stake, TroveManagerOperation _operation);
    event CDPLiquidated(address indexed _borrower, uint _debt, uint _coll, TroveManagerOperation _operation);

    // --- Dependency setter ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
        address _collSurplusPoolAddress,
        address _priceFeedAddress,
        address _clvTokenAddress,
        address _sortedCDPsAddress,
        address _lqtyStakingAddress
    )
        external
        override
        onlyOwner
    {
        borrowerOperationsAddress = _borrowerOperationsAddress;
        activePool = IPool(_activePoolAddress);
        defaultPool = IPool(_defaultPoolAddress);
        stabilityPool = IStabilityPool(_stabilityPoolAddress);
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
        clvToken = ICLVToken(_clvTokenAddress);
        sortedCDPs = ISortedCDPs(_sortedCDPsAddress);
        lqtyStakingAddress = _lqtyStakingAddress;
        lqtyStaking = ILQTYStaking(_lqtyStakingAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit CLVTokenAddressChanged(_clvTokenAddress);
        emit SortedCDPsAddressChanged(_sortedCDPsAddress);
        emit LQTYStakingAddressChanged(_lqtyStakingAddress);

        _renounceOwnership();
    }

    // --- Getters ---

    function getCDPOwnersCount() external view override returns (uint) {
        return CDPOwners.length;
    }

    function getTroveFromCDPOwnersArray(uint _index) external view override returns (address) {
        return CDPOwners[_index];
    }

    // --- CDP Liquidation functions ---

    // Single liquidation function. Closes the trove if its ICR is lower than the minimum collateral ratio. 
    function liquidate(address _borrower) external override {
        _requireCDPisActive(_borrower);

        address[] memory borrowers = new address[](1);
        borrowers[0] = _borrower;
        batchLiquidateTroves(borrowers);
    }

    // --- Inner single liquidation functions ---

    // Liquidate one trove, in Normal Mode.
    function _liquidateNormalMode(address _borrower, uint _CLVInStabPool) internal returns (LiquidationValues memory V) {
        LocalVariables_InnerSingleLiquidateFunction memory L;

        (V.entireCDPDebt,
        V.entireCDPColl,
        L.pendingDebtReward,
        L.pendingCollReward) = getEntireDebtAndColl(_borrower);

        _movePendingTroveRewardsToActivePool(L.pendingDebtReward, L.pendingCollReward);
        _removeStake(_borrower);

        V.collGasCompensation = _getCollGasCompensation(V.entireCDPColl);
        V.CLVGasCompensation = CLV_GAS_COMPENSATION;
        uint collToLiquidate = V.entireCDPColl.sub(V.collGasCompensation);

        (V.debtToOffset,
        V.collToSendToSP,
        V.debtToRedistribute,
        V.collToRedistribute) = _getOffsetAndRedistributionVals(V.entireCDPDebt, collToLiquidate, _CLVInStabPool);

        _closeCDP(_borrower);
        emit CDPLiquidated(_borrower, V.entireCDPDebt, V.entireCDPColl, TroveManagerOperation.liquidateInNormalMode);

        return V;
    }

    // Liquidate one trove, in Recovery Mode.
    function _liquidateRecoveryMode(address _borrower, uint _ICR, uint _CLVInStabPool, uint _TCR) internal returns (LiquidationValues memory V) {
        LocalVariables_InnerSingleLiquidateFunction memory L;
        
        if (CDPOwners.length <= 1) { return V; } // don't liquidate if last trove

        (V.entireCDPDebt,
        V.entireCDPColl,
        L.pendingDebtReward,
        L.pendingCollReward) = getEntireDebtAndColl(_borrower);

        _movePendingTroveRewardsToActivePool(L.pendingDebtReward, L.pendingCollReward);

        V.collGasCompensation = _getCollGasCompensation(V.entireCDPColl);
        // In case of a partial liquidation, V.CLVGasCompensation will be overwritten to zero, in the third branch below
        V.CLVGasCompensation = CLV_GAS_COMPENSATION;
        L.collToLiquidate = V.entireCDPColl.sub(V.collGasCompensation);

        // If ICR <= 100%, purely redistribute the CDP across all active CDPs
        if (_ICR <= _100pct) {
            _removeStake(_borrower);

            V.debtToOffset = 0;
            V.collToSendToSP = 0;
            V.debtToRedistribute = V.entireCDPDebt;
            V.collToRedistribute = L.collToLiquidate;

            _closeCDP(_borrower);
            emit CDPLiquidated(_borrower, V.entireCDPDebt, V.entireCDPColl, TroveManagerOperation.liquidateInRecoveryMode);

        // If 100% < ICR < MCR, offset as much as possible, and redistribute the remainder
        } else if ((_ICR > _100pct) && (_ICR < MCR)) {
            _removeStake(_borrower);

            (V.debtToOffset,
            V.collToSendToSP,
            V.debtToRedistribute,
            V.collToRedistribute) = _getOffsetAndRedistributionVals(V.entireCDPDebt, L.collToLiquidate, _CLVInStabPool);

            _closeCDP(_borrower);
            emit CDPLiquidated(_borrower, V.entireCDPDebt, V.entireCDPColl, TroveManagerOperation.liquidateInRecoveryMode);

        /* 
        * If 110% <= ICR < current TCR (accounting for the preceding liquidations in the current sequence)
        * and there is CLV in the Stability Pool, only offset it as much as possible, with no redistribution.
        */
        } else if ((_ICR >= MCR) && (_ICR < _TCR)) {
            assert(_CLVInStabPool != 0);

            _removeStake(_borrower);
            
            V = _getFullOrPartialOffsetVals(_borrower, V.entireCDPDebt, V.entireCDPColl, _CLVInStabPool);

            _closeCDP(_borrower);
        }
        else if (_ICR >= _TCR) {
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
        uint _CLVInStabPool
    )
        internal
        pure
        returns (uint debtToOffset, uint collToSendToSP, uint debtToRedistribute, uint collToRedistribute)
    {
        if (_CLVInStabPool > 0) {
        /* 
        * Offset as much debt & collateral as possible against the Stability Pool, and redistribute the remainder
        * between all active troves.
        *
        *  If the trove's debt is larger than the deposited CLV in the Stability Pool:
        *
        *  - Offset an amount of the trove's debt equal to the CLV in the Stability Pool
        *  - Send a fraction of the trove's collateral to the Stability Pool, equal to the fraction of its offset debt
        *
        */
            debtToOffset = LiquityMath._min(_debt, _CLVInStabPool);
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
        uint _entireCDPDebt,
        uint _entireCDPColl,
        uint _CLVInStabPool
    )
        internal
        returns (LiquidationValues memory V)
    {
        V.entireCDPDebt = _entireCDPDebt;
        V.entireCDPColl = _entireCDPColl;

        // When Stability Pool can fully absorb the trove's debt, perform a full offset
        if (_entireCDPDebt <= _CLVInStabPool) {
            V.collGasCompensation = _getCollGasCompensation(_entireCDPColl);
            V.CLVGasCompensation = CLV_GAS_COMPENSATION;

            V.debtToOffset = _entireCDPDebt;
            V.collToSendToSP = _entireCDPColl.sub(V.collGasCompensation);
            V.debtToRedistribute = 0;
            V.collToRedistribute = 0;

            emit CDPLiquidated(_borrower, _entireCDPDebt, _entireCDPColl, TroveManagerOperation.liquidateInRecoveryMode);
        }
        /* 
        * When trove's debt is greater than the Stability Pool, perform a partial liquidation: offset as much as possible,
        * and do not redistribute the remainder. The trove remains active, with a reduced collateral and debt.
        *
        * ETH gas compensation is based on and drawn from the collateral fraction that corresponds to the partial offset. 
        * CLV gas compensation is left untouched. 
        *
        * Since ETH gas comp is drawn purely from the *liquidated* portion, the trove is left with the same ICR as before the 
        * liquidation.
        */
        else if (_entireCDPDebt > _CLVInStabPool) {
            // Remaining debt in the trove is lower-bounded by the trove's gas compensation
            V.partialNewDebt = LiquityMath._max(_entireCDPDebt.sub(_CLVInStabPool), CLV_GAS_COMPENSATION);
          
            V.debtToOffset = _entireCDPDebt.sub(V.partialNewDebt);

            uint collFraction = _entireCDPColl.mul(V.debtToOffset).div(_entireCDPDebt);
            V.collGasCompensation = _getCollGasCompensation(collFraction);
          
            V.CLVGasCompensation = 0;  // CLV gas compensation remains untouched

            V.collToSendToSP = collFraction.sub(V.collGasCompensation);
            V.collToRedistribute = 0;
            V.debtToRedistribute = 0;

            V.partialAddr = _borrower;
            V.partialNewColl = _entireCDPColl.sub(collFraction);

            // Get the partial trove's neighbours, so we can re-insert it later to the same position
            V.partialUpperHint = sortedCDPs.getPrev(_borrower);  
            V.partialLowerHint = sortedCDPs.getNext(_borrower);
        }
    }

    /* 
    * Liquidate a sequence of troves. Closes a maximum number of n under-collateralized CDPs,
    * starting from the one with the lowest collateral ratio in the system, and moving upwards
    */
    function liquidateCDPs(uint _n) external override {
        LocalVariables_OuterLiquidationFunction memory L;

        LiquidationTotals memory T;

        L.price = priceFeed.getPrice();
        L.CLVInStabPool = stabilityPool.getTotalCLVDeposits();
        L.recoveryModeAtStart = checkRecoveryMode();

        // Perform the appropriate liquidation sequence - tally the values, and obtain their totals
        if (L.recoveryModeAtStart == true) {
            T = _getTotalsFromLiquidateCDPsSequence_RecoveryMode(L.price, L.CLVInStabPool, _n);
        } else if (L.recoveryModeAtStart == false) {
            T = _getTotalsFromLiquidateCDPsSequence_NormalMode(L.price, L.CLVInStabPool, _n);
        }

        // Move liquidated ETH and CLV to the appropriate pools
        stabilityPool.offset(T.totalDebtToOffset, T.totalCollToSendToSP);
        _redistributeDebtAndColl(T.totalDebtToRedistribute, T.totalCollToRedistribute);

        // Update system snapshots and the final partially liquidated trove, if there is one
        _updateSystemSnapshots_excludeCollRemainder(T.partialNewColl.add(T.totalCollGasCompensation));
        _updatePartiallyLiquidatedTrove(T.partialAddr, T.partialNewDebt, T.partialNewColl, T.partialUpperHint, T. partialLowerHint, L.price);

        L.liquidatedDebt = T.totalDebtInSequence.sub(T.partialNewDebt);
        L.liquidatedColl = T.totalCollInSequence.sub(T.totalCollGasCompensation).sub(T.partialNewColl);
        emit Liquidation(L.liquidatedDebt, L.liquidatedColl, T.totalCollGasCompensation, T.totalCLVGasCompensation);

        // Send gas compensation to caller
        _sendGasCompensation(msg.sender, T.totalCLVGasCompensation, T.totalCollGasCompensation);
    }

    /*
    * This function is used when the liquidateCDPs sequence starts during Recovery Mode. However, it
    * handle the case where the system *leaves* Recovery Mode, part way through the liquidation sequence
    */
    function _getTotalsFromLiquidateCDPsSequence_RecoveryMode
    (
        uint _price,
        uint _CLVInStabPool,
        uint _n
    )
        internal
        returns(LiquidationTotals memory T)
    {
        LocalVariables_LiquidationSequence memory L;
        LiquidationValues memory V;

        L.remainingCLVInStabPool = _CLVInStabPool;
        L.backToNormalMode = false;
        L.entireSystemDebt = activePool.getCLVDebt().add(defaultPool.getCLVDebt());
        L.entireSystemColl = activePool.getETH().add(defaultPool.getETH());

        L.i = 0;
        while (L.i < _n) {
            L.user = sortedCDPs.getLast();
            L.ICR = getCurrentICR(L.user, _price);

            if (L.backToNormalMode == false) {
                // Break the loop if ICR is greater than MCR and Stability Pool is empty
                if (L.ICR >= MCR && L.remainingCLVInStabPool == 0) { break; }

                uint TCR = LiquityMath._computeCR(L.entireSystemColl, L.entireSystemDebt, _price);
        
                V = _liquidateRecoveryMode(L.user, L.ICR, L.remainingCLVInStabPool, TCR);

                // Update aggregate trackers
                L.remainingCLVInStabPool = L.remainingCLVInStabPool.sub(V.debtToOffset);
                L.entireSystemDebt = L.entireSystemDebt.sub(V.debtToOffset);
                L.entireSystemColl = L.entireSystemColl.sub(V.collToSendToSP);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);

                // Break the loop if it was a partial liquidation
                if (V.partialAddr != address(0)) {break;}

                L.backToNormalMode = !_checkPotentialRecoveryMode(L.entireSystemColl, L.entireSystemDebt, _price);
            }
            else if (L.backToNormalMode == true && L.ICR < MCR) {
                V = _liquidateNormalMode(L.user, L.remainingCLVInStabPool);

                L.remainingCLVInStabPool = L.remainingCLVInStabPool.sub(V.debtToOffset);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);

            }  else break;  // break if the loop reaches a CDP with ICR >= MCR

            // Break the loop if it reaches the first CDP in the sorted list
            if (L.user == sortedCDPs.getFirst()) { break; }

            L.i++;
        }
    }

    function _getTotalsFromLiquidateCDPsSequence_NormalMode
    (
        uint _price,
        uint _CLVInStabPool,
        uint _n
    )
        internal
        returns(LiquidationTotals memory T)
    {
        LocalVariables_LiquidationSequence memory L;
        LiquidationValues memory V;

        L.remainingCLVInStabPool = _CLVInStabPool;

        L.i = 0;
        while (L.i < _n) {
            L.user = sortedCDPs.getLast();
            L.ICR = getCurrentICR(L.user, _price);

            if (L.ICR < MCR) {
                V = _liquidateNormalMode(L.user, L.remainingCLVInStabPool);

                L.remainingCLVInStabPool = L.remainingCLVInStabPool.sub(V.debtToOffset);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);

            } else break;  // break if the loop reaches a CDP with ICR >= MCR

            // Break the loop if it reaches the first CDP in the sorted list
            if (L.user == sortedCDPs.getFirst()) { break; }
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
        L.CLVInStabPool = stabilityPool.getTotalCLVDeposits();
        L.recoveryModeAtStart = checkRecoveryMode();

        // Perform the appropriate liquidation sequence - tally values and obtain their totals.
        if (L.recoveryModeAtStart == true) {
           T = _getTotalFromBatchLiquidate_RecoveryMode(L.price, L.CLVInStabPool, _troveArray);
        } else if (L.recoveryModeAtStart == false) {
            T = _getTotalsFromBatchLiquidate_NormalMode(L.price, L.CLVInStabPool, _troveArray);
        }

        // Move liquidated ETH and CLV to the appropriate pools
        stabilityPool.offset(T.totalDebtToOffset, T.totalCollToSendToSP);
        _redistributeDebtAndColl(T.totalDebtToRedistribute, T.totalCollToRedistribute);

        // Update system snapshots and the final partially liquidated trove, if there is one
        _updateSystemSnapshots_excludeCollRemainder(T.partialNewColl.add(T.totalCollGasCompensation));
        _updatePartiallyLiquidatedTrove(T.partialAddr, T.partialNewDebt, T.partialNewColl, T.partialUpperHint, T. partialLowerHint, L.price);

        L.liquidatedDebt = T.totalDebtInSequence.sub(T.partialNewDebt);
        L.liquidatedColl = T.totalCollInSequence.sub(T.totalCollGasCompensation).sub(T.partialNewColl);
        emit Liquidation(L.liquidatedDebt, L.liquidatedColl, T.totalCollGasCompensation, T.totalCLVGasCompensation);

        // Send gas compensation to caller
        _sendGasCompensation(msg.sender, T.totalCLVGasCompensation, T.totalCollGasCompensation);
    }

    /* 
    * This function is used when the batch liquidation sequence starts during Recovery Mode. However, it
    * handle the case where the system *leaves* Recovery Mode, part way through the liquidation sequence
    */
    function _getTotalFromBatchLiquidate_RecoveryMode
    (
        uint _price,
        uint _CLVInStabPool,
        address[] memory _troveArray)
        internal
        returns(LiquidationTotals memory T)
    {
        LocalVariables_LiquidationSequence memory L;
        LiquidationValues memory V;

        L.remainingCLVInStabPool = _CLVInStabPool;
        L.backToNormalMode = false;
        L.entireSystemDebt = activePool.getCLVDebt().add(defaultPool.getCLVDebt());
        L.entireSystemColl = activePool.getETH().add(defaultPool.getETH());

        L.i = 0;
        for (L.i = 0; L.i < _troveArray.length; L.i++) {
            L.user = _troveArray[L.i];
            L.ICR = getCurrentICR(L.user, _price);

            if (L.backToNormalMode == false) {

                // Skip this trove if ICR is greater than MCR and Stability Pool is empty
                if (L.ICR >= MCR && L.remainingCLVInStabPool == 0) { continue; }

                uint TCR = LiquityMath._computeCR(L.entireSystemColl, L.entireSystemDebt, _price);

                V = _liquidateRecoveryMode(L.user, L.ICR, L.remainingCLVInStabPool, TCR);

                // Update aggregate trackers
                L.remainingCLVInStabPool = L.remainingCLVInStabPool.sub(V.debtToOffset);
                L.entireSystemDebt = L.entireSystemDebt.sub(V.debtToOffset);
                L.entireSystemColl = L.entireSystemColl.sub(V.collToSendToSP);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);

                // Break the loop if it was a partial liquidation
                if (V.partialAddr != address(0)) { break; }

                L.backToNormalMode = !_checkPotentialRecoveryMode(L.entireSystemColl, L.entireSystemDebt, _price);
            }

            else if (L.backToNormalMode == true && L.ICR < MCR) {
                V = _liquidateNormalMode(L.user, L.remainingCLVInStabPool);
                L.remainingCLVInStabPool = L.remainingCLVInStabPool.sub(V.debtToOffset);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);
            }
        }
    }

    function _getTotalsFromBatchLiquidate_NormalMode
    (
        uint _price,
        uint _CLVInStabPool,
        address[] memory _troveArray
    )
        internal
        returns(LiquidationTotals memory T)
    {
        LocalVariables_LiquidationSequence memory L;
        LiquidationValues memory V;

        L.remainingCLVInStabPool = _CLVInStabPool;

        for (L.i = 0; L.i < _troveArray.length; L.i++) {
            L.user = _troveArray[L.i];
            L.ICR = getCurrentICR(L.user, _price);

            if (L.ICR < MCR) {
                V = _liquidateNormalMode(L.user, L.remainingCLVInStabPool);
                L.remainingCLVInStabPool = L.remainingCLVInStabPool.sub(V.debtToOffset);

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
        T2.totalCLVGasCompensation = T1.totalCLVGasCompensation.add(V.CLVGasCompensation);
        T2.totalDebtInSequence = T1.totalDebtInSequence.add(V.entireCDPDebt);
        T2.totalCollInSequence = T1.totalCollInSequence.add(V.entireCDPColl);
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
        address _lowerHint,
        uint _price
    ) 
        internal 
    {
        if ( _borrower == address(0)) { return; }

        CDPs[_borrower].debt = _newDebt;
        CDPs[_borrower].coll = _newColl;
        CDPs[_borrower].status = Status.active;

        _updateCDPRewardSnapshots(_borrower);
        _updateStakeAndTotalStakes(_borrower);

        uint ICR = getCurrentICR(_borrower, _price);

        /* 
        * Insert to sorted list and add to CDPOwners array. The partially liquidated trove has the same
        * ICR as it did before the liquidation, so insertion is O(1): in principle, its ICR does not change.
        * In practice, due to rounding error, its ICR can change slightly - so re-insert, with its previous neighbours
        * as hints.
        */
        sortedCDPs.insert(_borrower, ICR, _price, _upperHint, _lowerHint);
        _addCDPOwnerToArray(_borrower);
        emit CDPUpdated(_borrower, _newDebt, _newColl, CDPs[_borrower].stake, TroveManagerOperation.partiallyLiquidateInRecoveryMode);
    }

    function _sendGasCompensation(address _liquidator, uint _CLV, uint _ETH) internal {
        if (_CLV > 0) {
            clvToken.returnFromPool(GAS_POOL_ADDRESS, _liquidator, _CLV);
        }

        if (_ETH > 0) {
            activePool.sendETH(_liquidator, _ETH);
        }
    }

    // Move a CDP's pending debt and collateral rewards from distributions, from the Default Pool to the Active Pool
    function _movePendingTroveRewardsToActivePool(uint _CLV, uint _ETH) internal {
        defaultPool.decreaseCLVDebt(_CLV);
        activePool.increaseCLVDebt(_CLV);
        defaultPool.sendETH(address(activePool), _ETH);
    }

    // --- Redemption functions ---

    // Redeem as much collateral as possible from _borrower's CDP in exchange for CLV up to _maxCLVamount
    function _redeemCollateralFromCDP(
        address _borrower,
        uint _maxCLVamount,
        uint _price,
        address _partialRedemptionHint,
        uint _partialRedemptionHintICR
    )
        internal returns (SingleRedemptionValues memory V)
    {
        // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the CDP minus the gas compensation
        V.CLVLot = LiquityMath._min(_maxCLVamount, CDPs[_borrower].debt.sub(CLV_GAS_COMPENSATION));

        // Get the ETHLot of equivalent value in USD
        V.ETHLot = V.CLVLot.mul(1e18).div(_price);

        // Decrease the debt and collateral of the current CDP according to the CLV lot and corresponding ETH to send
        uint newDebt = (CDPs[_borrower].debt).sub(V.CLVLot);
        uint newColl = (CDPs[_borrower].coll).sub(V.ETHLot);

        if (newDebt == CLV_GAS_COMPENSATION) {
            // No debt left in the CDP (except for the gas compensation), therefore the trove gets closed
            _removeStake(_borrower);
            _closeCDP(_borrower);
            _redeemCloseLoan(_borrower, CLV_GAS_COMPENSATION, newColl);

        } else {
            uint newICR = LiquityMath._computeCR(newColl, newDebt, _price);

            // Check if the provided hint is fresh. If not, we bail since trying to reinsert without a good hint will almost
            // certainly result in running out of gas.
            if (newICR != _partialRedemptionHintICR) {
                V.CLVLot = 0;
                V.ETHLot = 0;
                return V;
            }

            sortedCDPs.reInsert(_borrower, newICR, _price, _partialRedemptionHint, _partialRedemptionHint);

            CDPs[_borrower].debt = newDebt;
            CDPs[_borrower].coll = newColl;
            _updateStakeAndTotalStakes(_borrower);
        }
        emit CDPUpdated(
            _borrower,
            newDebt, newColl,
            CDPs[_borrower].stake,
            TroveManagerOperation.redeemCollateral
        );
        return V;
    }

    /* 
    * Called when a full redemption occurs, and closes the trove.
    * The redeemer swaps (debt - 10) CLV for (debt - 10) worth of ETH, so the 10 CLV gas compensation left corresponds to the remaining debt.
    * In order to close the trove, the 10 CLV gas compensation is burned, and 10 debt is removed from the active pool.
    * The debt recorded on the trove's struct is zero'd elswhere, in _closeCDP.
    * Any surplus ETH left in the trove, is sent to the Coll surplus pool, and can be later claimed by the borrower.
    */ 
    function _redeemCloseLoan(address _borrower, uint _CLV, uint _ETH) internal {
        clvToken.burn(GAS_POOL_ADDRESS, _CLV);
        // Update Active Pool CLV, and send ETH to account
        activePool.decreaseCLVDebt(_CLV);

        // send ETH from Active Pool to CollSurplus Pool
        collSurplusPool.accountSurplus(_borrower, _ETH);
        activePool.sendETH(address(collSurplusPool), _ETH);
    }

    function _isValidFirstRedemptionHint(address _firstRedemptionHint, uint _price) internal view returns (bool) {
        if (_firstRedemptionHint == address(0) ||
            !sortedCDPs.contains(_firstRedemptionHint) ||
            getCurrentICR(_firstRedemptionHint, _price) < MCR
        ) {
            return false;
        }

        address nextCDP = sortedCDPs.getNext(_firstRedemptionHint);
        return nextCDP == address(0) || getCurrentICR(nextCDP, _price) < MCR;
    }

    /* Send _CLVamount CLV to the system and redeem the corresponding amount of collateral from as many CDPs as are needed to fill the redemption
    * request.  Applies pending rewards to a CDP before reducing its debt and coll.
    *
    * Note that if _amount is very large, this function can run out of gas, specially if traversed troves are small. This can be easily avoided by 
    * splitting the total _amount in appropriate chunks and calling the function multiple times.
    * 
    * Param `_maxIterations` can also be provided, so the loop through CDPs is capped (if it’s zero, it will be ignored).This makes it easier to 
    * avoid OOG for the frontend, as only knowing approximately the average cost of an iteration is enough, without needing to know the “topology” 
    * of the trove list. It also avoids the need to set the cap in stone in the contract, nor doing gas calculations, as both gas price and opcode 
    * costs can vary.
    * 
    * All CDPs that are redeemed from -- with the likely exception of the last one -- will end up with no debt left, therefore they will be closed.
    * If the last CDP does have some remaining debt, it has a finite ICR, and the reinsertion could be anywhere in the list, therefore it requires a hint. 
    * A frontend should use getRedemptionHints() to calculate what the ICR of this CDP will be after redemption, and pass a hint for its position 
    * in the sortedCDPs list along with the ICR value that the hint was found for.
    * 
    * If another transaction modifies the list between calling getRedemptionHints() and passing the hints to redeemCollateral(), it
    * is very likely that the last (partially) redeemed CDP would end up with a different ICR than what the hint is for. In this case the
    * redemption will stop after the last completely redeemed CDP and the sender will keep the remaining CLV amount, which they can attempt
    * to redeem later.
    */
    function redeemCollateral(
        uint _CLVamount,
        address _firstRedemptionHint,
        address _partialRedemptionHint,
        uint _partialRedemptionHintICR,
        uint _maxIterations
    )
        external
        override
    {
        uint activeDebt = activePool.getCLVDebt();
        uint defaultedDebt = defaultPool.getCLVDebt();

        RedemptionTotals memory T;

        _requireAmountGreaterThanZero(_CLVamount);
        _requireCLVBalanceCoversRedemption(msg.sender, _CLVamount);

        // Confirm redeemer's balance is less than total systemic debt
        assert(clvToken.balanceOf(msg.sender) <= (activeDebt.add(defaultedDebt)));

        uint remainingCLV = _CLVamount;
        uint price = priceFeed.getPrice();
        address currentBorrower;

        if (_isValidFirstRedemptionHint(_firstRedemptionHint, price)) {
            currentBorrower = _firstRedemptionHint;
        } else {
            currentBorrower = sortedCDPs.getLast();
            // Find the first trove with ICR >= MCR
            while (currentBorrower != address(0) && getCurrentICR(currentBorrower, price) < MCR) {
                currentBorrower = sortedCDPs.getPrev(currentBorrower);
            }
        }

        // Loop through the CDPs starting from the one with lowest collateral ratio until _amount of CLV is exchanged for collateral
        if (_maxIterations == 0) { _maxIterations = uint(-1); }
        while (currentBorrower != address(0) && remainingCLV > 0 && _maxIterations > 0) {
            _maxIterations--;
            // Save the address of the CDP preceding the current one, before potentially modifying the list
            address nextUserToCheck = sortedCDPs.getPrev(currentBorrower);

            _applyPendingRewards(currentBorrower);

            SingleRedemptionValues memory V = _redeemCollateralFromCDP(
                currentBorrower,
                remainingCLV,
                price,
                _partialRedemptionHint,
                _partialRedemptionHintICR
            );

            if (V.CLVLot == 0) break; // Partial redemption hint got out-of-date, therefore we could not redeem from the last CDP

            T.totalCLVToRedeem  = T.totalCLVToRedeem.add(V.CLVLot);
            T.totalETHDrawn = T.totalETHDrawn.add(V.ETHLot);

            remainingCLV = remainingCLV.sub(V.CLVLot);
            currentBorrower = nextUserToCheck;
        }

        // Decay the baseRate due to time passed, and then increase it according to the size of this redemption
        _updateBaseRateFromRedemption(T.totalETHDrawn, price);

        // Calculate the ETH fee and send it to the LQTY staking contract
        T.ETHFee = _getRedemptionFee(T.totalETHDrawn);
        activePool.sendETH(lqtyStakingAddress, T.ETHFee);
        lqtyStaking.increaseF_ETH(T.ETHFee);

        T.ETHToSendToRedeemer = T.totalETHDrawn.sub(T.ETHFee);

        // Burn the total CLV that is cancelled with debt, and send the redeemed ETH to msg.sender
        _activePoolRedeemCollateral(msg.sender, T.totalCLVToRedeem, T.ETHToSendToRedeemer);

        emit Redemption(_CLVamount, T.totalCLVToRedeem, T.totalETHDrawn, T.ETHFee);
    }

    // Burn the received CLV, transfer the redeemed ETH to _redeemer and updates the Active Pool
    function _activePoolRedeemCollateral(address _redeemer, uint _CLV, uint _ETH) internal {
        // Update Active Pool CLV, and send ETH to account
        clvToken.burn(_redeemer, _CLV);
        activePool.decreaseCLVDebt(_CLV);

        activePool.sendETH(_redeemer, _ETH);
    }

    // --- Helper functions ---


    // Return the current collateral ratio (ICR) of a given CDP. Takes a trove's pending coll and debt rewards from redistributions into account.
    function getCurrentICR(address _borrower, uint _price) public view override returns (uint) {
        uint pendingETHReward = getPendingETHReward(_borrower);
        uint pendingCLVDebtReward = getPendingCLVDebtReward(_borrower);

        uint currentETH = CDPs[_borrower].coll.add(pendingETHReward);
        uint currentCLVDebt = CDPs[_borrower].debt.add(pendingCLVDebtReward);

        uint ICR = LiquityMath._computeCR(currentETH, currentCLVDebt, _price);
        return ICR;
    }

    function applyPendingRewards(address _borrower) external override {
        _requireCallerIsBorrowerOperations();
        return _applyPendingRewards(_borrower);
    }

    // Add the borrowers's coll and debt rewards earned from redistributions, to their CDP
    function _applyPendingRewards(address _borrower) internal {
        if (hasPendingRewards(_borrower)) {
            _requireCDPisActive(_borrower);

            // Compute pending rewards
            uint pendingETHReward = getPendingETHReward(_borrower);
            uint pendingCLVDebtReward = getPendingCLVDebtReward(_borrower);

            // Apply pending rewards to trove's state
            CDPs[_borrower].coll = CDPs[_borrower].coll.add(pendingETHReward);
            CDPs[_borrower].debt = CDPs[_borrower].debt.add(pendingCLVDebtReward);

            _updateCDPRewardSnapshots(_borrower);

            // Transfer from DefaultPool to ActivePool
            _movePendingTroveRewardsToActivePool(pendingCLVDebtReward, pendingETHReward);

            emit CDPUpdated(
                _borrower, 
                CDPs[_borrower].debt, 
                CDPs[_borrower].coll, 
                CDPs[_borrower].stake, 
                TroveManagerOperation.applyPendingRewards
            );
        }
    }

    // Update borrower's snapshots of L_ETH and L_CLVDebt to reflect the current values
    function updateCDPRewardSnapshots(address _borrower) external override {
        _requireCallerIsBorrowerOperations();
       return _updateCDPRewardSnapshots(_borrower);
    }

    function _updateCDPRewardSnapshots(address _borrower) internal {
        rewardSnapshots[_borrower].ETH = L_ETH;
        rewardSnapshots[_borrower].CLVDebt = L_CLVDebt;
    }

    // Get the borrower's pending accumulated ETH reward, earned by their stake
    function getPendingETHReward(address _borrower) public view override returns (uint) {
        uint snapshotETH = rewardSnapshots[_borrower].ETH;
        uint rewardPerUnitStaked = L_ETH.sub(snapshotETH);

        if ( rewardPerUnitStaked == 0 ) { return 0; }

        uint stake = CDPs[_borrower].stake;

        uint pendingETHReward = stake.mul(rewardPerUnitStaked).div(1e18);

        return pendingETHReward;
    }

     // Get the borrower's pending accumulated CLV reward, earned by their stake
    function getPendingCLVDebtReward(address _borrower) public view override returns (uint) {
        uint snapshotCLVDebt = rewardSnapshots[_borrower].CLVDebt;
        uint rewardPerUnitStaked = L_CLVDebt.sub(snapshotCLVDebt);

        if ( rewardPerUnitStaked == 0 ) { return 0; }

        uint stake =  CDPs[_borrower].stake;

        uint pendingCLVDebtReward = stake.mul(rewardPerUnitStaked).div(1e18);

        return pendingCLVDebtReward;
    }

    function hasPendingRewards(address _borrower) public view override returns (bool) {
        /* 
        * A CDP has pending rewards if its snapshot is less than the current rewards per-unit-staked sum:
        * this indicates that rewards have occured since the snapshot was made, and the user therefore has
        * pending rewards 
        */
        return (rewardSnapshots[_borrower].ETH < L_ETH);
    }

    // Return the CDPs entire debt and coll, including pending rewards from redistributions.
    function getEntireDebtAndColl(
        address _borrower
    )
        public
        view
        override
        returns (uint debt, uint coll, uint pendingCLVDebtReward, uint pendingETHReward)
    {
        debt = CDPs[_borrower].debt;
        coll = CDPs[_borrower].coll;

        pendingCLVDebtReward = getPendingCLVDebtReward(_borrower);
        pendingETHReward = getPendingETHReward(_borrower);

        debt = debt.add(pendingCLVDebtReward);
        coll = coll.add(pendingETHReward);
    }

    function removeStake(address _borrower) external override {
        _requireCallerIsBorrowerOperations();
        return _removeStake(_borrower);
    }

    // Remove borrower's stake from the totalStakes sum, and set their stake to 0
    function _removeStake(address _borrower) internal {
        uint stake = CDPs[_borrower].stake;
        totalStakes = totalStakes.sub(stake);
        CDPs[_borrower].stake = 0;
    }

    function updateStakeAndTotalStakes(address _borrower) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        return _updateStakeAndTotalStakes(_borrower);
    }

    // Update borrower's stake based on their latest collateral value
    function _updateStakeAndTotalStakes(address _borrower) internal returns (uint) {
        uint newStake = _computeNewStake(CDPs[_borrower].coll);
        uint oldStake = CDPs[_borrower].stake;
        CDPs[_borrower].stake = newStake;
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

        if (totalStakes > 0) {
            /* 
            * Add distributed coll and debt rewards-per-unit-staked to the running totals.
            * Division uses a "feedback" error correction, to keep the cumulative error in
            * the  L_ETH and L_CLVDebt state variables low. 
            */
            uint ETHNumerator = _coll.mul(1e18).add(lastETHError_Redistribution);
            uint CLVDebtNumerator = _debt.mul(1e18).add(lastCLVDebtError_Redistribution);

            uint ETHRewardPerUnitStaked = ETHNumerator.div(totalStakes);
            uint CLVDebtRewardPerUnitStaked = CLVDebtNumerator.div(totalStakes);

            lastETHError_Redistribution = ETHNumerator.sub(ETHRewardPerUnitStaked.mul(totalStakes));
            lastCLVDebtError_Redistribution = CLVDebtNumerator.sub(CLVDebtRewardPerUnitStaked.mul(totalStakes));

            L_ETH = L_ETH.add(ETHRewardPerUnitStaked);
            L_CLVDebt = L_CLVDebt.add(CLVDebtRewardPerUnitStaked);
        }

        // Transfer coll and debt from ActivePool to DefaultPool
        activePool.decreaseCLVDebt(_debt);
        defaultPool.increaseCLVDebt(_debt);
        activePool.sendETH(address(defaultPool), _coll);
    }

    function closeCDP(address _borrower) external override {
        _requireCallerIsBorrowerOperations();
        return _closeCDP(_borrower);
    }

    function _closeCDP(address _borrower) internal {
        uint CDPOwnersArrayLength = CDPOwners.length;
        _requireMoreThanOneTroveInSystem(CDPOwnersArrayLength);

        CDPs[_borrower].status = Status.closed;
        CDPs[_borrower].coll = 0;
        CDPs[_borrower].debt = 0;

        rewardSnapshots[_borrower].ETH = 0;
        rewardSnapshots[_borrower].CLVDebt = 0;

        _removeCDPOwner(_borrower, CDPOwnersArrayLength);
        sortedCDPs.remove(_borrower);
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

    // Push the owner's address to the CDP owners list, and record the corresponding array index on the CDP struct
    function addCDPOwnerToArray(address _borrower) external override returns (uint index) {
        _requireCallerIsBorrowerOperations();
        return _addCDPOwnerToArray(_borrower);
    }

    function _addCDPOwnerToArray(address _borrower) internal returns (uint128 index) {
        require(CDPOwners.length < 2**128 - 1, "TroveManager: CDPOwners array has maximum size of 2^128 - 1");

        // Push the CDPowner to the array
        CDPOwners.push(_borrower);

        // Record the index of the new CDPowner on their CDP struct
        index = uint128(CDPOwners.length.sub(1));
        CDPs[_borrower].arrayIndex = index;

        return index;
    }

    /* 
    * Remove a CDP owner from the CDPOwners array, not preserving array order. Removing owner 'B' does the following:
    * [A B C D E] => [A E C D], and updates E's CDP struct to point to its new array index. 
    */
    function _removeCDPOwner(address _borrower, uint CDPOwnersArrayLength) internal {
        require(CDPs[_borrower].status == Status.closed, "TroveManager: CDP is still active");

        uint128 index = CDPs[_borrower].arrayIndex;
        uint length = CDPOwnersArrayLength;
        uint idxLast = length.sub(1);

        assert(index <= idxLast);

        address addressToMove = CDPOwners[idxLast];

        CDPOwners[index] = addressToMove;
        CDPs[addressToMove].arrayIndex = index;
        CDPOwners.pop();
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
        uint activeDebt = activePool.getCLVDebt();
        uint closedDebt = defaultPool.getCLVDebt();

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

        uint activeDebt = activePool.getCLVDebt();
        uint closedDebt = defaultPool.getCLVDebt();
        uint totalCLVSupply = activeDebt.add(closedDebt);

        /* Convert the drawn ETH back to CLV at face value rate (1 CLV:1 USD), in order to get
        * the fraction of total supply that was redeemed at face value. */
        uint redeemedCLVFraction = _ETHDrawn.mul(_price).div(totalCLVSupply);

        uint newBaseRate = decayedBaseRate.add(redeemedCLVFraction.div(BETA));

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

    function getBorrowingFee(uint _CLVDebt) external view override returns (uint) {
        return _CLVDebt.mul(baseRate).div(1e18);
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

    function _requireCDPisActive(address _borrower) internal view {
        require(CDPs[_borrower].status == Status.active, "TroveManager: Trove does not exist or is closed");
    }

    function _requireCLVBalanceCoversRedemption(address _redeemer, uint _amount) internal view {
        require(clvToken.balanceOf(_redeemer) >= _amount, "TroveManager: Requested redemption amount must be <= user's CLV token balance");
    }

    function _requireMoreThanOneTroveInSystem(uint CDPOwnersArrayLength) internal view {
        require (CDPOwnersArrayLength > 1 && sortedCDPs.getSize() > 1, "TroveManager: Only one trove in the system");
    }

    function _requireAmountGreaterThanZero(uint _amount) internal pure {
        require(_amount > 0, "TroveManager: Amount must be greater than zero");
    }

    // --- Trove property getters ---

    function getCDPStatus(address _borrower) external view override returns (uint) {
        return uint(CDPs[_borrower].status);
    }

    function getCDPStake(address _borrower) external view override returns (uint) {
        return CDPs[_borrower].stake;
    }

    function getCDPDebt(address _borrower) external view override returns (uint) {
        return CDPs[_borrower].debt;
    }

    function getCDPColl(address _borrower) external view override returns (uint) {
        return CDPs[_borrower].coll;
    }

    // --- Trove property setters, called by BorrowerOperations ---

    function setCDPStatus(address _borrower, uint _num) external override {
        _requireCallerIsBorrowerOperations();
        CDPs[_borrower].status = Status(_num);
    }

    function increaseCDPColl(address _borrower, uint _collIncrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        uint newColl = CDPs[_borrower].coll.add(_collIncrease);
        CDPs[_borrower].coll = newColl;
        return newColl;
    }

    function decreaseCDPColl(address _borrower, uint _collDecrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        uint newColl = CDPs[_borrower].coll.sub(_collDecrease);
        CDPs[_borrower].coll = newColl;
        return newColl;
    }

    function increaseCDPDebt(address _borrower, uint _debtIncrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        uint newDebt = CDPs[_borrower].debt.add(_debtIncrease);
        CDPs[_borrower].debt = newDebt;
        return newDebt;
    }

    function decreaseCDPDebt(address _borrower, uint _debtDecrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        uint newDebt = CDPs[_borrower].debt.sub(_debtDecrease);
        CDPs[_borrower].debt = newDebt;
        return newDebt;
    }
}
