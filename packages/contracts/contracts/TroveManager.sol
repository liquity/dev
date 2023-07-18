// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/IXBRLToken.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/ISTBLToken.sol";
import "./Interfaces/ISTBLStaking.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";

contract TroveManager is LiquityBase, Ownable, CheckContract, ITroveManager {
    string constant public NAME = "TroveManager";

    // --- Connected contract declarations ---

    address public borrowerOperationsAddress;

    IStabilityPool public override stabilityPool;

    address gasPoolAddress;

    ICollSurplusPool collSurplusPool;

    IXBRLToken public override xbrlToken;

    ISTBLToken public override stblToken;

    ISTBLStaking public override stblStaking;

    // A doubly linked list of Troves, sorted by their sorted by their collateral ratios
    ISortedTroves public sortedTroves;

    // --- Data structures ---

    uint256 constant public SECONDS_IN_ONE_MINUTE = 60;
    /*
     * Half-life of 12h. 12h = 720 min
     * (1/2) = d^720 => d = (1/2)^(1/720)
     */
    uint256 constant public MINUTE_DECAY_FACTOR = 999037758833783000;
    uint256 constant public REDEMPTION_FEE_FLOOR = DECIMAL_PRECISION / 1000 * 5; // 0.5%
    uint256 constant public MAX_BORROWING_FEE = DECIMAL_PRECISION / 100 * 5; // 5%

    // During bootsrap period redemptions are not allowed
    uint256 constant public BOOTSTRAP_PERIOD = 14 days;

    /*
    * BETA: 18 digit decimal. Parameter by which to divide the redeemed fraction, in order to calc the new base rate from a redemption.
    * Corresponds to (1 / ALPHA) in the white paper.
    */
    uint256 constant public BETA = 2;

    uint256 public baseRate;

    // The timestamp of the latest fee operation (redemption or new XBRL issuance)
    uint256 public lastFeeOperationTime;

    enum Status {
        nonExistent,
        active,
        closedByOwner,
        closedByLiquidation,
        closedByRedemption
    }

    // Store the necessary data for a trove
    struct Trove {
        uint256 debt;
        uint256 coll;
        uint256 stake;
        Status status;
        uint128 arrayIndex;
    }

    mapping (address => Trove) public Troves;

    uint256 public totalStakes;

    // Snapshot of the value of totalStakes, taken immediately after the latest liquidation
    uint256 public totalStakesSnapshot;

    // Snapshot of the total collateral across the ActivePool and DefaultPool, immediately after the latest liquidation.
    uint256 public totalCollateralSnapshot;

    /*
    * L_ETH and L_XBRLDebt track the sums of accumulated liquidation rewards per unit staked. During its lifetime, each stake earns:
    *
    * An ETH gain of ( stake * [L_ETH - L_ETH(0)] )
    * A XBRLDebt increase  of ( stake * [L_XBRLDebt - L_XBRLDebt(0)] )
    *
    * Where L_ETH(0) and L_XBRLDebt(0) are snapshots of L_ETH and L_XBRLDebt for the active Trove taken at the instant the stake was made
    */
    uint256 public L_ETH;
    uint256 public L_XBRLDebt;

    // Map addresses with active troves to their RewardSnapshot
    mapping (address => RewardSnapshot) public rewardSnapshots;

    // Object containing the ETH and XBRL snapshots for a given active trove
    struct RewardSnapshot { uint256 ETH; uint256 XBRLDebt;}

    // Array of all active trove addresses - used to to compute an approximate hint off-chain, for the sorted list insertion
    address[] public TroveOwners;

    // Error trackers for the trove redistribution calculation
    uint256 public lastETHError_Redistribution;
    uint256 public lastXBRLDebtError_Redistribution;

    /*
    * --- Variable container structs for liquidations ---
    *
    * These structs are used to hold, return and assign variables inside the liquidation functions,
    * in order to avoid the error: "CompilerError: Stack too deep".
    **/

    struct LocalVariables_OuterLiquidationFunction {
        uint256 price;
        uint256 XBRLInStabPool;
        bool recoveryModeAtStart;
        uint256 liquidatedDebt;
        uint256 liquidatedColl;
    }

    struct LocalVariables_InnerSingleLiquidateFunction {
        uint256 collToLiquidate;
        uint256 pendingDebtReward;
        uint256 pendingCollReward;
    }

    struct LocalVariables_LiquidationSequence {
        uint256 remainingXBRLInStabPool;
        uint256 i;
        uint256 ICR;
        address user;
        bool backToNormalMode;
        uint256 entireSystemDebt;
        uint256 entireSystemColl;
    }

    struct LiquidationValues {
        uint256 entireTroveDebt;
        uint256 entireTroveColl;
        uint256 collGasCompensation;
        uint256 XBRLGasCompensation;
        uint256 debtToOffset;
        uint256 collToSendToSP;
        uint256 debtToRedistribute;
        uint256 collToRedistribute;
        uint256 collSurplus;
    }

    struct LiquidationTotals {
        uint256 totalCollInSequence;
        uint256 totalDebtInSequence;
        uint256 totalCollGasCompensation;
        uint256 totalXBRLGasCompensation;
        uint256 totalDebtToOffset;
        uint256 totalCollToSendToSP;
        uint256 totalDebtToRedistribute;
        uint256 totalCollToRedistribute;
        uint256 totalCollSurplus;
    }

    struct ContractsCache {
        IActivePool activePool;
        IDefaultPool defaultPool;
        IXBRLToken xbrlToken;
        ISTBLStaking stblStaking;
        ISortedTroves sortedTroves;
        ICollSurplusPool collSurplusPool;
        address gasPoolAddress;
    }
    // --- Variable container structs for redemptions ---

    struct RedemptionTotals {
        uint256 remainingXBRL;
        uint256 totalXBRLToRedeem;
        uint256 totalETHDrawn;
        uint256 ETHFee;
        uint256 ETHToSendToRedeemer;
        uint256 decayedBaseRate;
        uint256 price;
        uint256 totalXBRLSupplyAtStart;
    }

    struct SingleRedemptionValues {
        uint256 XBRLLot;
        uint256 ETHLot;
        bool cancelledPartial;
    }

    event TroveUpdated(address indexed _borrower, uint256 _debt, uint256 _coll, uint256 _stake, TroveManagerOperation _operation);
    event TroveLiquidated(address indexed _borrower, uint256 _debt, uint256 _coll, TroveManagerOperation _operation);

     enum TroveManagerOperation {
        applyPendingRewards,
        liquidateInNormalMode,
        liquidateInRecoveryMode,
        redeemCollateral
    }


    // --- Dependency setter ---

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
    )
        external
        override
        onlyOwner
    {
        checkContract(_borrowerOperationsAddress);
        checkContract(_activePoolAddress);
        checkContract(_defaultPoolAddress);
        checkContract(_stabilityPoolAddress);
        checkContract(_gasPoolAddress);
        checkContract(_collSurplusPoolAddress);
        checkContract(_priceFeedAddress);
        checkContract(_xbrlTokenAddress);
        checkContract(_sortedTrovesAddress);
        checkContract(_stblTokenAddress);
        checkContract(_stblStakingAddress);

        borrowerOperationsAddress = _borrowerOperationsAddress;
        activePool = IActivePool(_activePoolAddress);
        defaultPool = IDefaultPool(_defaultPoolAddress);
        stabilityPool = IStabilityPool(_stabilityPoolAddress);
        gasPoolAddress = _gasPoolAddress;
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
        xbrlToken = IXBRLToken(_xbrlTokenAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        stblToken = ISTBLToken(_stblTokenAddress);
        stblStaking = ISTBLStaking(_stblStakingAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit GasPoolAddressChanged(_gasPoolAddress);
        emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit XBRLTokenAddressChanged(_xbrlTokenAddress);
        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit STBLTokenAddressChanged(_stblTokenAddress);
        emit STBLStakingAddressChanged(_stblStakingAddress);

        _renounceOwnership();
    }

    // --- Getters ---

    function getTroveOwnersCount() external view override returns (uint) {
        return TroveOwners.length;
    }

    function getTroveFromTroveOwnersArray(uint256 _index) external view override returns (address) {
        return TroveOwners[_index];
    }

    // --- Trove Liquidation functions ---

    // Single liquidation function. Closes the trove if its ICR is lower than the minimum collateral ratio.
    function liquidate(address _borrower) external override {
        _requireTroveIsActive(_borrower);

        address[] memory borrowers = new address[](1);
        borrowers[0] = _borrower;
        batchLiquidateTroves(borrowers);
    }

    // --- Inner single liquidation functions ---

    // Liquidate one trove, in Normal Mode.
    function _liquidateNormalMode(
        IActivePool _activePool,
        IDefaultPool _defaultPool,
        address _borrower,
        uint256 _XBRLInStabPool
    )
        internal
        returns (LiquidationValues memory singleLiquidation)
    {
        LocalVariables_InnerSingleLiquidateFunction memory vars;

        (singleLiquidation.entireTroveDebt,
        singleLiquidation.entireTroveColl,
        vars.pendingDebtReward,
        vars.pendingCollReward) = getEntireDebtAndColl(_borrower);

        _movePendingTroveRewardsToActivePool(_activePool, _defaultPool, vars.pendingDebtReward, vars.pendingCollReward);
        _removeStake(_borrower);

        singleLiquidation.collGasCompensation = _getCollGasCompensation(singleLiquidation.entireTroveColl);
        singleLiquidation.XBRLGasCompensation = XBRL_GAS_COMPENSATION;
        uint256 collToLiquidate = singleLiquidation.entireTroveColl - singleLiquidation.collGasCompensation;

        (singleLiquidation.debtToOffset,
        singleLiquidation.collToSendToSP,
        singleLiquidation.debtToRedistribute,
        singleLiquidation.collToRedistribute) = _getOffsetAndRedistributionVals(singleLiquidation.entireTroveDebt, collToLiquidate, _XBRLInStabPool);

        _closeTrove(_borrower, Status.closedByLiquidation);
        emit TroveLiquidated(_borrower, singleLiquidation.entireTroveDebt, singleLiquidation.entireTroveColl, TroveManagerOperation.liquidateInNormalMode);
        emit TroveUpdated(_borrower, 0, 0, 0, TroveManagerOperation.liquidateInNormalMode);
        return singleLiquidation;
    }

    // Liquidate one trove, in Recovery Mode.
    function _liquidateRecoveryMode(
        IActivePool _activePool,
        IDefaultPool _defaultPool,
        address _borrower,
        uint256 _ICR,
        uint256 _XBRLInStabPool,
        uint256 _TCR,
        uint256 _price
    )
        internal
        returns (LiquidationValues memory singleLiquidation)
    {
        LocalVariables_InnerSingleLiquidateFunction memory vars;
        if (TroveOwners.length <= 1) {return singleLiquidation;} // don't liquidate if last trove
        (singleLiquidation.entireTroveDebt,
        singleLiquidation.entireTroveColl,
        vars.pendingDebtReward,
        vars.pendingCollReward) = getEntireDebtAndColl(_borrower);

        singleLiquidation.collGasCompensation = _getCollGasCompensation(singleLiquidation.entireTroveColl);
        singleLiquidation.XBRLGasCompensation = XBRL_GAS_COMPENSATION;
        vars.collToLiquidate = singleLiquidation.entireTroveColl - singleLiquidation.collGasCompensation;

        // If ICR <= 100%, purely redistribute the Trove across all active Troves
        if (_ICR <= _100pct) {
            _movePendingTroveRewardsToActivePool(_activePool, _defaultPool, vars.pendingDebtReward, vars.pendingCollReward);
            _removeStake(_borrower);
           
            singleLiquidation.debtToOffset = 0;
            singleLiquidation.collToSendToSP = 0;
            singleLiquidation.debtToRedistribute = singleLiquidation.entireTroveDebt;
            singleLiquidation.collToRedistribute = vars.collToLiquidate;

            _closeTrove(_borrower, Status.closedByLiquidation);
            emit TroveLiquidated(_borrower, singleLiquidation.entireTroveDebt, singleLiquidation.entireTroveColl, TroveManagerOperation.liquidateInRecoveryMode);
            emit TroveUpdated(_borrower, 0, 0, 0, TroveManagerOperation.liquidateInRecoveryMode);
            
        // If 100% < ICR < MCR, offset as much as possible, and redistribute the remainder
        } else if ((_ICR > _100pct) && (_ICR < MCR)) {
             _movePendingTroveRewardsToActivePool(_activePool, _defaultPool, vars.pendingDebtReward, vars.pendingCollReward);
            _removeStake(_borrower);

            (singleLiquidation.debtToOffset,
            singleLiquidation.collToSendToSP,
            singleLiquidation.debtToRedistribute,
            singleLiquidation.collToRedistribute) = _getOffsetAndRedistributionVals(singleLiquidation.entireTroveDebt, vars.collToLiquidate, _XBRLInStabPool);

            _closeTrove(_borrower, Status.closedByLiquidation);
            emit TroveLiquidated(_borrower, singleLiquidation.entireTroveDebt, singleLiquidation.entireTroveColl, TroveManagerOperation.liquidateInRecoveryMode);
            emit TroveUpdated(_borrower, 0, 0, 0, TroveManagerOperation.liquidateInRecoveryMode);
        /*
        * If 110% <= ICR < current TCR (accounting for the preceding liquidations in the current sequence)
        * and there is XBRL in the Stability Pool, only offset, with no redistribution,
        * but at a capped rate of 1.1 and only if the whole debt can be liquidated.
        * The remainder due to the capped rate will be claimable as collateral surplus.
        */
        } else if ((_ICR >= MCR) && (_ICR < _TCR) && (singleLiquidation.entireTroveDebt <= _XBRLInStabPool)) {
            _movePendingTroveRewardsToActivePool(_activePool, _defaultPool, vars.pendingDebtReward, vars.pendingCollReward);
            assert(_XBRLInStabPool != 0);

            _removeStake(_borrower);
            singleLiquidation = _getCappedOffsetVals(singleLiquidation.entireTroveDebt, singleLiquidation.entireTroveColl, _price);

            _closeTrove(_borrower, Status.closedByLiquidation);
            if (singleLiquidation.collSurplus > 0) {
                collSurplusPool.accountSurplus(_borrower, singleLiquidation.collSurplus);
            }

            emit TroveLiquidated(_borrower, singleLiquidation.entireTroveDebt, singleLiquidation.collToSendToSP, TroveManagerOperation.liquidateInRecoveryMode);
            emit TroveUpdated(_borrower, 0, 0, 0, TroveManagerOperation.liquidateInRecoveryMode);

        } else { // if (_ICR >= MCR && ( _ICR >= _TCR || singleLiquidation.entireTroveDebt > _XBRLInStabPool))
            LiquidationValues memory zeroVals;
            return zeroVals;
        }

        return singleLiquidation;
    }

    /* In a full liquidation, returns the values for a trove's coll and debt to be offset, and coll and debt to be
    * redistributed to active troves.
    */
    function _getOffsetAndRedistributionVals
    (
        uint256 _debt,
        uint256 _coll,
        uint256 _XBRLInStabPool
    )
        internal
        pure
        returns (uint256 debtToOffset, uint256 collToSendToSP, uint256 debtToRedistribute, uint256 collToRedistribute)
    {
        if (_XBRLInStabPool > 0) {
        /*
        * Offset as much debt & collateral as possible against the Stability Pool, and redistribute the remainder
        * between all active troves.
        *
        *  If the trove's debt is larger than the deposited XBRL in the Stability Pool:
        *
        *  - Offset an amount of the trove's debt equal to the XBRL in the Stability Pool
        *  - Send a fraction of the trove's collateral to the Stability Pool, equal to the fraction of its offset debt
        *
        */
            debtToOffset = LiquityMath._min(_debt, _XBRLInStabPool);
            collToSendToSP = _coll * debtToOffset / _debt;
            debtToRedistribute = _debt - debtToOffset;
            collToRedistribute = _coll - collToSendToSP;
        } else {
            debtToOffset = 0;
            collToSendToSP = 0;
            debtToRedistribute = _debt;
            collToRedistribute = _coll;
        }
    }

    /*
    *  Get its offset coll/debt and ETH gas comp, and close the trove.
    */
    function _getCappedOffsetVals
    (
        uint256 _entireTroveDebt,
        uint256 _entireTroveColl,
        uint256 _price
    )
        internal
        pure
        returns (LiquidationValues memory singleLiquidation)
    {
        singleLiquidation.entireTroveDebt = _entireTroveDebt;
        singleLiquidation.entireTroveColl = _entireTroveColl;
        uint256 cappedCollPortion = _entireTroveDebt * MCR / _price;

        singleLiquidation.collGasCompensation = _getCollGasCompensation(cappedCollPortion);
        singleLiquidation.XBRLGasCompensation = XBRL_GAS_COMPENSATION;

        singleLiquidation.debtToOffset = _entireTroveDebt;
        singleLiquidation.collToSendToSP = cappedCollPortion - singleLiquidation.collGasCompensation;
        singleLiquidation.collSurplus = _entireTroveColl - cappedCollPortion;
        singleLiquidation.debtToRedistribute = 0;
        singleLiquidation.collToRedistribute = 0;
    }

    /*
    * Liquidate a sequence of troves. Closes a maximum number of n under-collateralized Troves,
    * starting from the one with the lowest collateral ratio in the system, and moving upwards
    */
    function liquidateTroves(uint256 _n) external override {
        ContractsCache memory contractsCache = ContractsCache(
            activePool,
            defaultPool,
            IXBRLToken(address(0)),
            ISTBLStaking(address(0)),
            sortedTroves,
            ICollSurplusPool(address(0)),
            address(0)
        );
        IStabilityPool stabilityPoolCached = stabilityPool;

        LocalVariables_OuterLiquidationFunction memory vars;

        LiquidationTotals memory totals;

        vars.price = priceFeed.fetchPrice();
        vars.XBRLInStabPool = stabilityPoolCached.getTotalXBRLDeposits();
        vars.recoveryModeAtStart = _checkRecoveryMode(vars.price);

        // Perform the appropriate liquidation sequence - tally the values, and obtain their totals
        if (vars.recoveryModeAtStart) {
            totals = _getTotalsFromLiquidateTrovesSequence_RecoveryMode(contractsCache, vars.price, vars.XBRLInStabPool, _n);
        } else { // if !vars.recoveryModeAtStart
            totals = _getTotalsFromLiquidateTrovesSequence_NormalMode(contractsCache.activePool, contractsCache.defaultPool, vars.price, vars.XBRLInStabPool, _n);
        }

        require(totals.totalDebtInSequence > 0, "TroveManager: nothing to liquidate");

        // Move liquidated ETH and XBRL to the appropriate pools
        stabilityPoolCached.offset(totals.totalDebtToOffset, totals.totalCollToSendToSP);
        _redistributeDebtAndColl(contractsCache.activePool, contractsCache.defaultPool, totals.totalDebtToRedistribute, totals.totalCollToRedistribute);
        if (totals.totalCollSurplus > 0) {
            contractsCache.activePool.sendETH(address(collSurplusPool), totals.totalCollSurplus);
        }

        // Update system snapshots
        _updateSystemSnapshots_excludeCollRemainder(contractsCache.activePool, totals.totalCollGasCompensation);

        vars.liquidatedDebt = totals.totalDebtInSequence;
        vars.liquidatedColl = totals.totalCollInSequence - totals.totalCollGasCompensation - totals.totalCollSurplus;
        emit Liquidation(vars.liquidatedDebt, vars.liquidatedColl, totals.totalCollGasCompensation, totals.totalXBRLGasCompensation);

        // Send gas compensation to caller
        _sendGasCompensation(contractsCache.activePool, msg.sender, totals.totalXBRLGasCompensation, totals.totalCollGasCompensation);
    }

    /*
    * This function is used when the liquidateTroves sequence starts during Recovery Mode. However, it
    * handle the case where the system *leaves* Recovery Mode, part way through the liquidation sequence
    */
    function _getTotalsFromLiquidateTrovesSequence_RecoveryMode
    (
        ContractsCache memory _contractsCache,
        uint256 _price,
        uint256 _XBRLInStabPool,
        uint256 _n
    )
        internal
        returns(LiquidationTotals memory totals)
    {
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;

        vars.remainingXBRLInStabPool = _XBRLInStabPool;
        vars.backToNormalMode = false;
        vars.entireSystemDebt = getEntireSystemDebt();
        vars.entireSystemColl = getEntireSystemColl();

        vars.user = _contractsCache.sortedTroves.getLast();
        address firstUser = _contractsCache.sortedTroves.getFirst();
        for (vars.i = 0; vars.i < _n && vars.user != firstUser; vars.i++) {
            // we need to cache it, because current user is likely going to be deleted
            address nextUser = _contractsCache.sortedTroves.getPrev(vars.user);

            vars.ICR = getCurrentICR(vars.user, _price);

            if (!vars.backToNormalMode) {
                // Break the loop if ICR is greater than MCR and Stability Pool is empty
                if (vars.ICR >= MCR && vars.remainingXBRLInStabPool == 0) { break; }

                uint256 TCR = LiquityMath._computeCR(vars.entireSystemColl, vars.entireSystemDebt, _price);

                singleLiquidation = _liquidateRecoveryMode(_contractsCache.activePool, _contractsCache.defaultPool, vars.user, vars.ICR, vars.remainingXBRLInStabPool, TCR, _price);

                // Update aggregate trackers
                vars.remainingXBRLInStabPool -= singleLiquidation.debtToOffset;
                vars.entireSystemDebt -= singleLiquidation.debtToOffset;
                vars.entireSystemColl -= singleLiquidation.collToSendToSP
                    + singleLiquidation.collGasCompensation
                    + singleLiquidation.collSurplus;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

                vars.backToNormalMode = !_checkPotentialRecoveryMode(vars.entireSystemColl, vars.entireSystemDebt, _price);
            }
            else if (vars.backToNormalMode && vars.ICR < MCR) {
                singleLiquidation = _liquidateNormalMode(_contractsCache.activePool, _contractsCache.defaultPool, vars.user, vars.remainingXBRLInStabPool);

                vars.remainingXBRLInStabPool -= singleLiquidation.debtToOffset;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

            }  else break;  // break if the loop reaches a Trove with ICR >= MCR

            vars.user = nextUser;
        }
    }

    function _getTotalsFromLiquidateTrovesSequence_NormalMode
    (
        IActivePool _activePool,
        IDefaultPool _defaultPool,
        uint256 _price,
        uint256 _XBRLInStabPool,
        uint256 _n
    )
        internal
        returns(LiquidationTotals memory totals)
    {
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;
        ISortedTroves sortedTrovesCached = sortedTroves;

        vars.remainingXBRLInStabPool = _XBRLInStabPool;

        for (vars.i = 0; vars.i < _n; vars.i++) {
            vars.user = sortedTrovesCached.getLast();
            vars.ICR = getCurrentICR(vars.user, _price);

            if (vars.ICR < MCR) {
                singleLiquidation = _liquidateNormalMode(_activePool, _defaultPool, vars.user, vars.remainingXBRLInStabPool);

                vars.remainingXBRLInStabPool -= singleLiquidation.debtToOffset;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

            } else break;  // break if the loop reaches a Trove with ICR >= MCR
        }
    }

    /*
    * Attempt to liquidate a custom list of troves provided by the caller.
    */
    function batchLiquidateTroves(address[] memory _troveArray) public override {
        require(_troveArray.length != 0, "TroveManager: Calldata address array must not be empty");

        IActivePool activePoolCached = activePool;
        IDefaultPool defaultPoolCached = defaultPool;
        IStabilityPool stabilityPoolCached = stabilityPool;

        LocalVariables_OuterLiquidationFunction memory vars;
        LiquidationTotals memory totals;

        vars.price = priceFeed.fetchPrice();
        vars.XBRLInStabPool = stabilityPoolCached.getTotalXBRLDeposits();
        vars.recoveryModeAtStart = _checkRecoveryMode(vars.price);

        // Perform the appropriate liquidation sequence - tally values and obtain their totals.
        if (vars.recoveryModeAtStart) {
            totals = _getTotalFromBatchLiquidate_RecoveryMode(activePoolCached, defaultPoolCached, vars.price, vars.XBRLInStabPool, _troveArray);
        } else {  //  if !vars.recoveryModeAtStart
            totals = _getTotalsFromBatchLiquidate_NormalMode(activePoolCached, defaultPoolCached, vars.price, vars.XBRLInStabPool, _troveArray);
        }

        require(totals.totalDebtInSequence > 0, "TroveManager: nothing to liquidate");

        // Move liquidated ETH and XBRL to the appropriate pools
        stabilityPoolCached.offset(totals.totalDebtToOffset, totals.totalCollToSendToSP);
        _redistributeDebtAndColl(activePoolCached, defaultPoolCached, totals.totalDebtToRedistribute, totals.totalCollToRedistribute);
        if (totals.totalCollSurplus > 0) {
            activePoolCached.sendETH(address(collSurplusPool), totals.totalCollSurplus);
        }

        // Update system snapshots
        _updateSystemSnapshots_excludeCollRemainder(activePoolCached, totals.totalCollGasCompensation);

        vars.liquidatedDebt = totals.totalDebtInSequence;
        vars.liquidatedColl = totals.totalCollInSequence - totals.totalCollGasCompensation - totals.totalCollSurplus;
        emit Liquidation(vars.liquidatedDebt, vars.liquidatedColl, totals.totalCollGasCompensation, totals.totalXBRLGasCompensation);

        // Send gas compensation to caller
        _sendGasCompensation(activePoolCached, msg.sender, totals.totalXBRLGasCompensation, totals.totalCollGasCompensation);
    }

    /*
    * This function is used when the batch liquidation sequence starts during Recovery Mode. However, it
    * handle the case where the system *leaves* Recovery Mode, part way through the liquidation sequence
    */
    function _getTotalFromBatchLiquidate_RecoveryMode
    (
        IActivePool _activePool,
        IDefaultPool _defaultPool,
        uint256 _price,
        uint256 _XBRLInStabPool,
        address[] memory _troveArray
    )
        internal
        returns(LiquidationTotals memory totals)
    {
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;

        vars.remainingXBRLInStabPool = _XBRLInStabPool;
        vars.backToNormalMode = false;
        vars.entireSystemDebt = getEntireSystemDebt();
        vars.entireSystemColl = getEntireSystemColl();

        for (vars.i = 0; vars.i < _troveArray.length; vars.i++) {
            vars.user = _troveArray[vars.i];
            // Skip non-active troves
            if (Troves[vars.user].status != Status.active) { continue; }
            vars.ICR = getCurrentICR(vars.user, _price);

            if (!vars.backToNormalMode) {

                // Skip this trove if ICR is greater than MCR and Stability Pool is empty
                if (vars.ICR >= MCR && vars.remainingXBRLInStabPool == 0) { continue; }

                uint256 TCR = LiquityMath._computeCR(vars.entireSystemColl, vars.entireSystemDebt, _price);

                singleLiquidation = _liquidateRecoveryMode(_activePool, _defaultPool, vars.user, vars.ICR, vars.remainingXBRLInStabPool, TCR, _price);

                // Update aggregate trackers
                vars.remainingXBRLInStabPool -= singleLiquidation.debtToOffset;
                vars.entireSystemDebt -= singleLiquidation.debtToOffset;
                vars.entireSystemColl -= singleLiquidation.collToSendToSP
                    + singleLiquidation.collGasCompensation
                    + singleLiquidation.collSurplus;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

                vars.backToNormalMode = !_checkPotentialRecoveryMode(vars.entireSystemColl, vars.entireSystemDebt, _price);
            }

            else if (vars.backToNormalMode && vars.ICR < MCR) {
                singleLiquidation = _liquidateNormalMode(_activePool, _defaultPool, vars.user, vars.remainingXBRLInStabPool);
                vars.remainingXBRLInStabPool -= singleLiquidation.debtToOffset;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

            } else continue; // In Normal Mode skip troves with ICR >= MCR
        }
    }

    function _getTotalsFromBatchLiquidate_NormalMode
    (
        IActivePool _activePool,
        IDefaultPool _defaultPool,
        uint256 _price,
        uint256 _XBRLInStabPool,
        address[] memory _troveArray
    )
        internal
        returns(LiquidationTotals memory totals)
    {
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;

        vars.remainingXBRLInStabPool = _XBRLInStabPool;

        for (vars.i = 0; vars.i < _troveArray.length; vars.i++) {
            vars.user = _troveArray[vars.i];
            vars.ICR = getCurrentICR(vars.user, _price);

            if (vars.ICR < MCR) {
                singleLiquidation = _liquidateNormalMode(_activePool, _defaultPool, vars.user, vars.remainingXBRLInStabPool);
                vars.remainingXBRLInStabPool -= singleLiquidation.debtToOffset;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);
            }
        }
    }

    // --- Liquidation helper functions ---

    function _addLiquidationValuesToTotals(LiquidationTotals memory oldTotals, LiquidationValues memory singleLiquidation)
    internal pure returns(LiquidationTotals memory newTotals) {

        // Tally all the values with their respective running totals
        newTotals.totalCollGasCompensation = oldTotals.totalCollGasCompensation + singleLiquidation.collGasCompensation;
        newTotals.totalXBRLGasCompensation = oldTotals.totalXBRLGasCompensation + singleLiquidation.XBRLGasCompensation;
        newTotals.totalDebtInSequence = oldTotals.totalDebtInSequence + singleLiquidation.entireTroveDebt;
        newTotals.totalCollInSequence = oldTotals.totalCollInSequence + singleLiquidation.entireTroveColl;
        newTotals.totalDebtToOffset = oldTotals.totalDebtToOffset + singleLiquidation.debtToOffset;
        newTotals.totalCollToSendToSP = oldTotals.totalCollToSendToSP + singleLiquidation.collToSendToSP;
        newTotals.totalDebtToRedistribute = oldTotals.totalDebtToRedistribute + singleLiquidation.debtToRedistribute;
        newTotals.totalCollToRedistribute = oldTotals.totalCollToRedistribute + singleLiquidation.collToRedistribute;
        newTotals.totalCollSurplus = oldTotals.totalCollSurplus + singleLiquidation.collSurplus;

        return newTotals;
    }

    function _sendGasCompensation(IActivePool _activePool, address _liquidator, uint256 _XBRL, uint256 _ETH) internal {
        if (_XBRL > 0) {
            xbrlToken.returnFromPool(gasPoolAddress, _liquidator, _XBRL);
        }

        if (_ETH > 0) {
            _activePool.sendETH(_liquidator, _ETH);
        }
    }

    // Move a Trove's pending debt and collateral rewards from distributions, from the Default Pool to the Active Pool
    function _movePendingTroveRewardsToActivePool(IActivePool _activePool, IDefaultPool _defaultPool, uint256 _XBRL, uint256 _ETH) internal {
        _defaultPool.decreaseXBRLDebt(_XBRL);
        _activePool.increaseXBRLDebt(_XBRL);
        _defaultPool.sendETHToActivePool(_ETH);
    }

    // --- Redemption functions ---

    // Redeem as much collateral as possible from _borrower's Trove in exchange for XBRL up to _maxXBRLamount
    function _redeemCollateralFromTrove(
        ContractsCache memory _contractsCache,
        address _borrower,
        uint256 _maxXBRLamount,
        uint256 _price,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR
    )
        internal returns (SingleRedemptionValues memory singleRedemption)
    {
        // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the Trove minus the liquidation reserve
        singleRedemption.XBRLLot = LiquityMath._min(_maxXBRLamount, Troves[_borrower].debt - XBRL_GAS_COMPENSATION);

        // Get the ETHLot of equivalent value in USD
        singleRedemption.ETHLot = singleRedemption.XBRLLot * DECIMAL_PRECISION / _price;

        // Decrease the debt and collateral of the current Trove according to the XBRL lot and corresponding ETH to send
        uint256 newDebt = Troves[_borrower].debt - singleRedemption.XBRLLot;
        uint256 newColl = Troves[_borrower].coll - singleRedemption.ETHLot;

        if (newDebt == XBRL_GAS_COMPENSATION) {
            // No debt left in the Trove (except for the liquidation reserve), therefore the trove gets closed
            _removeStake(_borrower);
            _closeTrove(_borrower, Status.closedByRedemption);
            _redeemCloseTrove(_contractsCache, _borrower, XBRL_GAS_COMPENSATION, newColl);
            emit TroveUpdated(_borrower, 0, 0, 0, TroveManagerOperation.redeemCollateral);

        } else {
            uint256 newNICR = LiquityMath._computeNominalCR(newColl, newDebt);

            /*
            * If the provided hint is out of date, we bail since trying to reinsert without a good hint will almost
            * certainly result in running out of gas. 
            *
            * If the resultant net debt of the partial is less than the minimum, net debt we bail.
            */
            if (newNICR != _partialRedemptionHintNICR || _getNetDebt(newDebt) < MIN_NET_DEBT) {
                singleRedemption.cancelledPartial = true;
                return singleRedemption;
            }

            _contractsCache.sortedTroves.reInsert(_borrower, newNICR, _upperPartialRedemptionHint, _lowerPartialRedemptionHint);

            Troves[_borrower].debt = newDebt;
            Troves[_borrower].coll = newColl;
            _updateStakeAndTotalStakes(_borrower);

            emit TroveUpdated(
                _borrower,
                newDebt, newColl,
                Troves[_borrower].stake,
                TroveManagerOperation.redeemCollateral
            );
        }

        return singleRedemption;
    }

    /*
    * Called when a full redemption occurs, and closes the trove.
    * The redeemer swaps (debt - liquidation reserve) XBRL for (debt - liquidation reserve) worth of ETH, so the XBRL liquidation reserve left corresponds to the remaining debt.
    * In order to close the trove, the XBRL liquidation reserve is burned, and the corresponding debt is removed from the active pool.
    * The debt recorded on the trove's struct is zero'd elswhere, in _closeTrove.
    * Any surplus ETH left in the trove, is sent to the Coll surplus pool, and can be later claimed by the borrower.
    */
    function _redeemCloseTrove(ContractsCache memory _contractsCache, address _borrower, uint256 _XBRL, uint256 _ETH) internal {
        _contractsCache.xbrlToken.burn(gasPoolAddress, _XBRL);
        // Update Active Pool XBRL, and send ETH to account
        _contractsCache.activePool.decreaseXBRLDebt(_XBRL);

        // send ETH from Active Pool to CollSurplus Pool
        _contractsCache.collSurplusPool.accountSurplus(_borrower, _ETH);
        _contractsCache.activePool.sendETH(address(_contractsCache.collSurplusPool), _ETH);
    }

    function _isValidFirstRedemptionHint(ISortedTroves _sortedTroves, address _firstRedemptionHint, uint256 _price) internal view returns (bool) {
        if (_firstRedemptionHint == address(0) ||
            !_sortedTroves.contains(_firstRedemptionHint) ||
            getCurrentICR(_firstRedemptionHint, _price) < MCR
        ) {
            return false;
        }

        address nextTrove = _sortedTroves.getNext(_firstRedemptionHint);
        return nextTrove == address(0) || getCurrentICR(nextTrove, _price) < MCR;
    }

    /* Send _XBRLamount XBRL to the system and redeem the corresponding amount of collateral from as many Troves as are needed to fill the redemption
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
    * redemption will stop after the last completely redeemed Trove and the sender will keep the remaining XBRL amount, which they can attempt
    * to redeem later.
    */
    function redeemCollateral(
        uint256 _XBRLamount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR,
        uint256 _maxIterations,
        uint256 _maxFeePercentage
    )
        external
        override
    {
        ContractsCache memory contractsCache = ContractsCache(
            activePool,
            defaultPool,
            xbrlToken,
            stblStaking,
            sortedTroves,
            collSurplusPool,
            gasPoolAddress
        );
        RedemptionTotals memory totals;

        _requireValidMaxFeePercentage(_maxFeePercentage);
        _requireAfterBootstrapPeriod();
        totals.price = priceFeed.fetchPrice();
        _requireTCRoverMCR(totals.price);
        _requireAmountGreaterThanZero(_XBRLamount);
        _requireXBRLBalanceCoversRedemption(contractsCache.xbrlToken, msg.sender, _XBRLamount);

        totals.totalXBRLSupplyAtStart = getEntireSystemDebt();
        // Confirm redeemer's balance is less than total XBRL supply
        assert(contractsCache.xbrlToken.balanceOf(msg.sender) <= totals.totalXBRLSupplyAtStart);

        totals.remainingXBRL = _XBRLamount;
        address currentBorrower;

        if (_isValidFirstRedemptionHint(contractsCache.sortedTroves, _firstRedemptionHint, totals.price)) {
            currentBorrower = _firstRedemptionHint;
        } else {
            currentBorrower = contractsCache.sortedTroves.getLast();
            // Find the first trove with ICR >= MCR
            while (currentBorrower != address(0) && getCurrentICR(currentBorrower, totals.price) < MCR) {
                currentBorrower = contractsCache.sortedTroves.getPrev(currentBorrower);
            }
        }

        // Loop through the Troves starting from the one with lowest collateral ratio until _amount of XBRL is exchanged for collateral
        if (_maxIterations == 0) { _maxIterations = type(uint256).max; }
        while (currentBorrower != address(0) && totals.remainingXBRL > 0 && _maxIterations > 0) {
            _maxIterations--;
            // Save the address of the Trove preceding the current one, before potentially modifying the list
            address nextUserToCheck = contractsCache.sortedTroves.getPrev(currentBorrower);

            _applyPendingRewards(contractsCache.activePool, contractsCache.defaultPool, currentBorrower);

            SingleRedemptionValues memory singleRedemption = _redeemCollateralFromTrove(
                contractsCache,
                currentBorrower,
                totals.remainingXBRL,
                totals.price,
                _upperPartialRedemptionHint,
                _lowerPartialRedemptionHint,
                _partialRedemptionHintNICR
            );

            if (singleRedemption.cancelledPartial) break; // Partial redemption was cancelled (out-of-date hint, or new net debt < minimum), therefore we could not redeem from the last Trove

            totals.totalXBRLToRedeem += singleRedemption.XBRLLot;
            totals.totalETHDrawn += singleRedemption.ETHLot;

            totals.remainingXBRL -= singleRedemption.XBRLLot;
            currentBorrower = nextUserToCheck;
        }
        require(totals.totalETHDrawn > 0, "TroveManager: Unable to redeem any amount");

        // Decay the baseRate due to time passed, and then increase it according to the size of this redemption.
        // Use the saved total XBRL supply value, from before it was reduced by the redemption.
        _updateBaseRateFromRedemption(totals.totalETHDrawn, totals.price, totals.totalXBRLSupplyAtStart);

        // Calculate the ETH fee
        totals.ETHFee = _getRedemptionFee(totals.totalETHDrawn);

        _requireUserAcceptsFee(totals.ETHFee, totals.totalETHDrawn, _maxFeePercentage);

        // Send the ETH fee to the STBL staking contract
        contractsCache.activePool.sendETH(address(contractsCache.stblStaking), totals.ETHFee);
        contractsCache.stblStaking.increaseF_ETH(totals.ETHFee);

        totals.ETHToSendToRedeemer = totals.totalETHDrawn - totals.ETHFee;

        emit Redemption(_XBRLamount, totals.totalXBRLToRedeem, totals.totalETHDrawn, totals.ETHFee);

        // Burn the total XBRL that is cancelled with debt, and send the redeemed ETH to msg.sender
        contractsCache.xbrlToken.burn(msg.sender, totals.totalXBRLToRedeem);
        // Update Active Pool XBRL, and send ETH to account
        contractsCache.activePool.decreaseXBRLDebt(totals.totalXBRLToRedeem);
        contractsCache.activePool.sendETH(msg.sender, totals.ETHToSendToRedeemer);
    }

    // --- Helper functions ---

    // Return the nominal collateral ratio (ICR) of a given Trove, without the price. Takes a trove's pending coll and debt rewards from redistributions into account.
    function getNominalICR(address _borrower) public view override returns (uint) {
        (uint256 currentETH, uint256 currentXBRLDebt) = _getCurrentTroveAmounts(_borrower);

        uint256 NICR = LiquityMath._computeNominalCR(currentETH, currentXBRLDebt);
        return NICR;
    }

    // Return the current collateral ratio (ICR) of a given Trove. Takes a trove's pending coll and debt rewards from redistributions into account.
    function getCurrentICR(address _borrower, uint256 _price) public view override returns (uint) {
        (uint256 currentETH, uint256 currentXBRLDebt) = _getCurrentTroveAmounts(_borrower);

        uint256 ICR = LiquityMath._computeCR(currentETH, currentXBRLDebt, _price);
        return ICR;
    }

    function _getCurrentTroveAmounts(address _borrower) internal view returns (uint, uint) {
        uint256 pendingETHReward = getPendingETHReward(_borrower);
        uint256 pendingXBRLDebtReward = getPendingXBRLDebtReward(_borrower);

        uint256 currentETH = Troves[_borrower].coll + pendingETHReward;
        uint256 currentXBRLDebt = Troves[_borrower].debt + pendingXBRLDebtReward;

        return (currentETH, currentXBRLDebt);
    }

    function applyPendingRewards(address _borrower) external override {
        _requireCallerIsBorrowerOperations();
        return _applyPendingRewards(activePool, defaultPool, _borrower);
    }

    // Add the borrowers's coll and debt rewards earned from redistributions, to their Trove
    function _applyPendingRewards(IActivePool _activePool, IDefaultPool _defaultPool, address _borrower) internal {
        if (hasPendingRewards(_borrower)) {
            _requireTroveIsActive(_borrower);

            // Compute pending rewards
            uint256 pendingETHReward = getPendingETHReward(_borrower);
            uint256 pendingXBRLDebtReward = getPendingXBRLDebtReward(_borrower);

            // Apply pending rewards to trove's state
            Troves[_borrower].coll += pendingETHReward;
            Troves[_borrower].debt += pendingXBRLDebtReward;

            _updateTroveRewardSnapshots(_borrower);

            // Transfer from DefaultPool to ActivePool
            _movePendingTroveRewardsToActivePool(_activePool, _defaultPool, pendingXBRLDebtReward, pendingETHReward);

            emit TroveUpdated(
                _borrower,
                Troves[_borrower].debt,
                Troves[_borrower].coll,
                Troves[_borrower].stake,
                TroveManagerOperation.applyPendingRewards
            );
        }
    }

    // Update borrower's snapshots of L_ETH and L_XBRLDebt to reflect the current values
    function updateTroveRewardSnapshots(address _borrower) external override {
        _requireCallerIsBorrowerOperations();
       return _updateTroveRewardSnapshots(_borrower);
    }

    function _updateTroveRewardSnapshots(address _borrower) internal {
        rewardSnapshots[_borrower].ETH = L_ETH;
        rewardSnapshots[_borrower].XBRLDebt = L_XBRLDebt;
        emit TroveSnapshotsUpdated(L_ETH, L_XBRLDebt);
    }

    // Get the borrower's pending accumulated ETH reward, earned by their stake
    function getPendingETHReward(address _borrower) public view override returns (uint) {
        uint256 snapshotETH = rewardSnapshots[_borrower].ETH;
        uint256 rewardPerUnitStaked = L_ETH - snapshotETH;

        if ( rewardPerUnitStaked == 0 || Troves[_borrower].status != Status.active) { return 0; }

        uint256 stake = Troves[_borrower].stake;

        uint256 pendingETHReward = stake * rewardPerUnitStaked / DECIMAL_PRECISION;

        return pendingETHReward;
    }
    
    // Get the borrower's pending accumulated XBRL reward, earned by their stake
    function getPendingXBRLDebtReward(address _borrower) public view override returns (uint) {
        uint256 snapshotXBRLDebt = rewardSnapshots[_borrower].XBRLDebt;
        uint256 rewardPerUnitStaked = L_XBRLDebt - snapshotXBRLDebt;

        if ( rewardPerUnitStaked == 0 || Troves[_borrower].status != Status.active) { return 0; }

        uint256 stake =  Troves[_borrower].stake;

        uint256 pendingXBRLDebtReward = stake * rewardPerUnitStaked / DECIMAL_PRECISION;

        return pendingXBRLDebtReward;
    }

    function hasPendingRewards(address _borrower) public view override returns (bool) {
        /*
        * A Trove has pending rewards if its snapshot is less than the current rewards per-unit-staked sum:
        * this indicates that rewards have occured since the snapshot was made, and the user therefore has
        * pending rewards
        */
        if (Troves[_borrower].status != Status.active) {return false;}
       
        return (rewardSnapshots[_borrower].ETH < L_ETH);
    }

    // Return the Troves entire debt and coll, including pending rewards from redistributions.
    function getEntireDebtAndColl(
        address _borrower
    )
        public
        view
        override
        returns (uint256 debt, uint256 coll, uint256 pendingXBRLDebtReward, uint256 pendingETHReward)
    {
        debt = Troves[_borrower].debt;
        coll = Troves[_borrower].coll;

        pendingXBRLDebtReward = getPendingXBRLDebtReward(_borrower);
        pendingETHReward = getPendingETHReward(_borrower);

        debt += pendingXBRLDebtReward;
        coll += pendingETHReward;
    }

    function removeStake(address _borrower) external override {
        _requireCallerIsBorrowerOperations();
        return _removeStake(_borrower);
    }

    // Remove borrower's stake from the totalStakes sum, and set their stake to 0
    function _removeStake(address _borrower) internal {
        uint256 stake = Troves[_borrower].stake;
        totalStakes -= stake;
        Troves[_borrower].stake = 0;
    }

    function updateStakeAndTotalStakes(address _borrower) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        return _updateStakeAndTotalStakes(_borrower);
    }

    // Update borrower's stake based on their latest collateral value
    function _updateStakeAndTotalStakes(address _borrower) internal returns (uint) {
        uint256 newStake = _computeNewStake(Troves[_borrower].coll);
        uint256 oldStake = Troves[_borrower].stake;
        Troves[_borrower].stake = newStake;

        totalStakes = totalStakes - oldStake + newStake;
        emit TotalStakesUpdated(totalStakes);

        return newStake;
    }

    // Calculate a new stake based on the snapshots of the totalStakes and totalCollateral taken at the last liquidation
    function _computeNewStake(uint256 _coll) internal view returns (uint) {
        uint256 stake;
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
            stake = _coll * totalStakesSnapshot / totalCollateralSnapshot;
        }
        return stake;
    }

    function _redistributeDebtAndColl(IActivePool _activePool, IDefaultPool _defaultPool, uint256 _debt, uint256 _coll) internal {
        if (_debt == 0) { return; }

        /*
        * Add distributed coll and debt rewards-per-unit-staked to the running totals. Division uses a "feedback"
        * error correction, to keep the cumulative error low in the running totals L_ETH and L_XBRLDebt:
        *
        * 1) Form numerators which compensate for the floor division errors that occurred the last time this
        * function was called.
        * 2) Calculate "per-unit-staked" ratios.
        * 3) Multiply each ratio back by its denominator, to reveal the current floor division error.
        * 4) Store these errors for use in the next correction when this function is called.
        * 5) Note: static analysis tools complain about this "division before multiplication", however, it is intended.
        */
        uint256 ETHNumerator = _coll * DECIMAL_PRECISION + lastETHError_Redistribution;
        uint256 XBRLDebtNumerator = _debt * DECIMAL_PRECISION + lastXBRLDebtError_Redistribution;

        // Get the per-unit-staked terms
        uint256 ETHRewardPerUnitStaked = ETHNumerator / totalStakes;
        uint256 XBRLDebtRewardPerUnitStaked = XBRLDebtNumerator / totalStakes;

        lastETHError_Redistribution = ETHNumerator - (ETHRewardPerUnitStaked * totalStakes);
        lastXBRLDebtError_Redistribution = XBRLDebtNumerator - (XBRLDebtRewardPerUnitStaked * totalStakes);

        // Add per-unit-staked terms to the running totals
        L_ETH += ETHRewardPerUnitStaked;
        L_XBRLDebt += XBRLDebtRewardPerUnitStaked;

        emit LTermsUpdated(L_ETH, L_XBRLDebt);

        // Transfer coll and debt from ActivePool to DefaultPool
        _activePool.decreaseXBRLDebt(_debt);
        _defaultPool.increaseXBRLDebt(_debt);
        _activePool.sendETH(address(_defaultPool), _coll);
    }

    function closeTrove(address _borrower) external override {
        _requireCallerIsBorrowerOperations();
        return _closeTrove(_borrower, Status.closedByOwner);
    }

    function _closeTrove(address _borrower, Status closedStatus) internal {
        assert(closedStatus != Status.nonExistent && closedStatus != Status.active);

        uint256 TroveOwnersArrayLength = TroveOwners.length;
        if (xbrlToken.mintList(borrowerOperationsAddress)) {
            _requireMoreThanOneTroveInSystem(TroveOwnersArrayLength);
         }

        Troves[_borrower].status = closedStatus;
        Troves[_borrower].coll = 0;
        Troves[_borrower].debt = 0;

        rewardSnapshots[_borrower].ETH = 0;
        rewardSnapshots[_borrower].XBRLDebt = 0;

        _removeTroveOwner(_borrower, TroveOwnersArrayLength);
        sortedTroves.remove(_borrower);
    }

    /*
    * Updates snapshots of system total stakes and total collateral, excluding a given collateral remainder from the calculation.
    * Used in a liquidation sequence.
    *
    * The calculation excludes a portion of collateral that is in the ActivePool:
    *
    * the total ETH gas compensation from the liquidation sequence
    *
    * The ETH as compensation must be excluded as it is always sent out at the very end of the liquidation sequence.
    */
    function _updateSystemSnapshots_excludeCollRemainder(IActivePool _activePool, uint256 _collRemainder) internal {
        totalStakesSnapshot = totalStakes;

        uint256 activeColl = _activePool.getETH();
        uint256 liquidatedColl = defaultPool.getETH();
        totalCollateralSnapshot = activeColl - _collRemainder + liquidatedColl;

        emit SystemSnapshotsUpdated(totalStakesSnapshot, totalCollateralSnapshot);
    }

    // Push the owner's address to the Trove owners list, and record the corresponding array index on the Trove struct
    function addTroveOwnerToArray(address _borrower) external override returns (uint256 index) {
        _requireCallerIsBorrowerOperations();
        return _addTroveOwnerToArray(_borrower);
    }

    function _addTroveOwnerToArray(address _borrower) internal returns (uint128 index) {
        /* Max array size is 2**128 - 1, i.e. ~3e30 troves. No risk of overflow, since troves have minimum XBRL
        debt of liquidation reserve plus MIN_NET_DEBT. 3e30 XBRL dwarfs the value of all wealth in the world ( which is < 1e15 USD). */

        // Push the Troveowner to the array
        TroveOwners.push(_borrower);

        // Record the index of the new Troveowner on their Trove struct
        index = uint128(TroveOwners.length - 1);
        Troves[_borrower].arrayIndex = index;

        return index;
    }

    /*
    * Remove a Trove owner from the TroveOwners array, not preserving array order. Removing owner 'B' does the following:
    * [A B C D E] => [A E C D], and updates E's Trove struct to point to its new array index.
    */
    function _removeTroveOwner(address _borrower, uint256 TroveOwnersArrayLength) internal {
        Status troveStatus = Troves[_borrower].status;
        // It’s set in caller function `_closeTrove`
        assert(troveStatus != Status.nonExistent && troveStatus != Status.active);

        uint128 index = Troves[_borrower].arrayIndex;
        uint256 length = TroveOwnersArrayLength;
        uint256 idxLast = length - 1;

        assert(index <= idxLast);

        address addressToMove = TroveOwners[idxLast];

        TroveOwners[index] = addressToMove;
        Troves[addressToMove].arrayIndex = index;
        emit TroveIndexUpdated(addressToMove, index);

        TroveOwners.pop();
    }

    // --- Recovery Mode and TCR functions ---

    function getTCR(uint256 _price) external view override returns (uint) {
        return _getTCR(_price);
    }

    function checkRecoveryMode(uint256 _price) external view override returns (bool) {
        return _checkRecoveryMode(_price);
    }

    // Check whether or not the system *would be* in Recovery Mode, given an ETH:USD price, and the entire system coll and debt.
    function _checkPotentialRecoveryMode(
        uint256 _entireSystemColl,
        uint256 _entireSystemDebt,
        uint256 _price
    )
        internal
        pure
    returns (bool)
    {
        uint256 TCR = LiquityMath._computeCR(_entireSystemColl, _entireSystemDebt, _price);

        return TCR < CCR;
    }

    // --- Redemption fee functions ---

    /*
    * This function has two impacts on the baseRate state variable:
    * 1) decays the baseRate based on time passed since last redemption or XBRL borrowing operation.
    * then,
    * 2) increases the baseRate based on the amount redeemed, as a proportion of total supply
    */
    function _updateBaseRateFromRedemption(uint256 _ETHDrawn,  uint256 _price, uint256 _totalXBRLSupply) internal returns (uint) {
        uint256 decayedBaseRate = _calcDecayedBaseRate();

        /* Convert the drawn ETH back to XBRL at face value rate (1 XBRL:1 USD), in order to get
        * the fraction of total supply that was redeemed at face value. */
        uint256 redeemedXBRLFraction = _ETHDrawn * _price / _totalXBRLSupply;

        uint256 newBaseRate = decayedBaseRate + (redeemedXBRLFraction / BETA);
        newBaseRate = LiquityMath._min(newBaseRate, DECIMAL_PRECISION); // cap baseRate at a maximum of 100%
        //assert(newBaseRate <= DECIMAL_PRECISION); // This is already enforced in the line above
        assert(newBaseRate > 0); // Base rate is always non-zero after redemption

        // Update the baseRate state variable
        baseRate = newBaseRate;
        emit BaseRateUpdated(newBaseRate);
        
        _updateLastFeeOpTime();

        return newBaseRate;
    }

    function getRedemptionRate() public view override returns (uint) {
        return _calcRedemptionRate(baseRate);
    }

    function getRedemptionRateWithDecay() public view override returns (uint) {
        return _calcRedemptionRate(_calcDecayedBaseRate());
    }

    function _calcRedemptionRate(uint256 _baseRate) internal pure returns (uint) {
        return LiquityMath._min(
            REDEMPTION_FEE_FLOOR + _baseRate,
            DECIMAL_PRECISION // cap at a maximum of 100%
        );
    }

    function _getRedemptionFee(uint256 _ETHDrawn) internal view returns (uint) {
        return _calcRedemptionFee(getRedemptionRate(), _ETHDrawn);
    }

    function getRedemptionFeeWithDecay(uint256 _ETHDrawn) external view override returns (uint) {
        return _calcRedemptionFee(getRedemptionRateWithDecay(), _ETHDrawn);
    }

    function _calcRedemptionFee(uint256 _redemptionRate, uint256 _ETHDrawn) internal pure returns (uint) {
        uint256 redemptionFee = _redemptionRate * _ETHDrawn / DECIMAL_PRECISION;
        require(redemptionFee < _ETHDrawn, "TroveManager: Fee would eat up all returned collateral");
        return redemptionFee;
    }

    // --- Borrowing fee functions ---

    function getBorrowingRate() public view override returns (uint) {
        return _calcBorrowingRate(baseRate);
    }

    function getBorrowingRateWithDecay() public view override returns (uint) {
        return _calcBorrowingRate(_calcDecayedBaseRate());
    }

    function _calcBorrowingRate(uint256 _baseRate) internal pure returns (uint) {
        return LiquityMath._min(
            BORROWING_FEE_FLOOR + _baseRate,
            MAX_BORROWING_FEE
        );
    }

    function getBorrowingFee(uint256 _XBRLDebt) external view override returns (uint) {
        return _calcBorrowingFee(getBorrowingRate(), _XBRLDebt);
    }

    function getBorrowingFeeWithDecay(uint256 _XBRLDebt) external view override returns (uint) {
        return _calcBorrowingFee(getBorrowingRateWithDecay(), _XBRLDebt);
    }

    function _calcBorrowingFee(uint256 _borrowingRate, uint256 _XBRLDebt) internal pure returns (uint) {
        return _borrowingRate * _XBRLDebt / DECIMAL_PRECISION;
    }


    // Updates the baseRate state variable based on time elapsed since the last redemption or XBRL borrowing operation.
    function decayBaseRateFromBorrowing() external override {
        _requireCallerIsBorrowerOperations();

        uint256 decayedBaseRate = _calcDecayedBaseRate();
        assert(decayedBaseRate <= DECIMAL_PRECISION);  // The baseRate can decay to 0

        baseRate = decayedBaseRate;
        emit BaseRateUpdated(decayedBaseRate);

        _updateLastFeeOpTime();
    }

    // --- Internal fee functions ---

    // Update the last fee operation time only if time passed >= decay interval. This prevents base rate griefing.
    function _updateLastFeeOpTime() internal {
        uint256 timePassed = block.timestamp - lastFeeOperationTime;

        if (timePassed >= SECONDS_IN_ONE_MINUTE) {
            lastFeeOperationTime = block.timestamp;
            emit LastFeeOpTimeUpdated(block.timestamp);
        }
    }

    function _calcDecayedBaseRate() internal view returns (uint) {
        uint256 minutesPassed = _minutesPassedSinceLastFeeOp();
        uint256 decayFactor = LiquityMath._decPow(MINUTE_DECAY_FACTOR, minutesPassed);

        return baseRate * decayFactor / DECIMAL_PRECISION;
    }

    function _minutesPassedSinceLastFeeOp() internal view returns (uint) {
        return (block.timestamp - lastFeeOperationTime) / SECONDS_IN_ONE_MINUTE;
    }

    // --- 'require' wrapper functions ---

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "TroveManager: Caller is not the BorrowerOperations contract");
    }

    function _requireTroveIsActive(address _borrower) internal view {
        require(Troves[_borrower].status == Status.active, "TroveManager: Trove does not exist or is closed");
    }

    function _requireXBRLBalanceCoversRedemption(IXBRLToken _xbrlToken, address _redeemer, uint256 _amount) internal view {
        require(_xbrlToken.balanceOf(_redeemer) >= _amount, "TroveManager: Requested redemption amount must be <= user's XBRL token balance");
    }

    function _requireMoreThanOneTroveInSystem(uint256 TroveOwnersArrayLength) internal view {
        require (TroveOwnersArrayLength > 1 && sortedTroves.getSize() > 1, "TroveManager: Only one trove in the system");
    }

    function _requireAmountGreaterThanZero(uint256 _amount) internal pure {
        require(_amount > 0, "TroveManager: Amount must be greater than zero");
    }

    function _requireTCRoverMCR(uint256 _price) internal view {
        require(_getTCR(_price) >= MCR, "TroveManager: Cannot redeem when TCR < MCR");
    }

    function _requireAfterBootstrapPeriod() internal view {
        uint256 systemDeploymentTime = stblToken.getDeploymentStartTime();
        require(block.timestamp >= systemDeploymentTime + BOOTSTRAP_PERIOD, "TroveManager: Redemptions are not allowed during bootstrap phase");
    }

    function _requireValidMaxFeePercentage(uint256 _maxFeePercentage) internal pure {
        require(_maxFeePercentage >= REDEMPTION_FEE_FLOOR && _maxFeePercentage <= DECIMAL_PRECISION,
            "Max fee percentage must be between 0.5% and 100%");
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

    function setTroveStatus(address _borrower, uint256 _num) external override {
        _requireCallerIsBorrowerOperations();
        Troves[_borrower].status = Status(_num);
    }

    function increaseTroveColl(address _borrower, uint256 _collIncrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        uint256 newColl = Troves[_borrower].coll + _collIncrease;
        Troves[_borrower].coll = newColl;
        return newColl;
    }

    function decreaseTroveColl(address _borrower, uint256 _collDecrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        uint256 newColl = Troves[_borrower].coll - _collDecrease;
        Troves[_borrower].coll = newColl;
        return newColl;
    }

    function increaseTroveDebt(address _borrower, uint256 _debtIncrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        uint256 newDebt = Troves[_borrower].debt + _debtIncrease;
        Troves[_borrower].debt = newDebt;
        return newDebt;
    }

    function decreaseTroveDebt(address _borrower, uint256 _debtDecrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        uint256 newDebt = Troves[_borrower].debt - _debtDecrease;
        Troves[_borrower].debt = newDebt;
        return newDebt;
    }
}
