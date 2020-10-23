// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/ICDPManager.sol";
import "./Interfaces/IPool.sol";
import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/ICLVToken.sol";
import "./Interfaces/ISortedCDPs.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/ILQTYStaking.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract CDPManager is LiquityBase, Ownable, ICDPManager {

    // --- Connected contract declarations ---

    address public borrowerOperationsAddress;

    IPool public activePool;

    IPool public defaultPool;

    IStabilityPool public stabilityPool;

    ICLVToken public CLV;

    IPriceFeed public priceFeed;

    ILQTYStaking public lqtyStaking;
    address public lqtyStakingAddress;

    // A doubly linked list of CDPs, sorted by their sorted by their collateral ratios
    ISortedCDPs public sortedCDPs;

    // --- Data structures ---

    uint constant public SECONDS_IN_ONE_MINUTE = 60;
    uint constant public MINUTE_DECAY_FACTOR = 999832508430720967;  // 18 digit decimal. Corresponds to an hourly decay factor of 0.99

    /* BETA: 18 digit decimal. Parameter by which to divide the redeemed fraction,
    in order to calc the new base rate from a redemption. Corresponds to (1 / ALPHA) in the white paper. */
    uint constant public BETA = 2;

    uint public baseRate;

    /* Records the timestamp of the last fee operation. To avoid base-rate griefing, it is only updated by
    * fees that occur more than one hour after the last recorded value.  */
    uint public lastFeeOperationTime;

    enum Status { nonExistent, active, closed }

    // Store the necessary data for a Collateralized Debt Position (CDP)
    struct CDP {
        uint debt;
        uint coll;
        uint stake;
        Status status;
        uint128 arrayIndex;
    }

    mapping (address => CDP) public CDPs;

    uint public totalStakes;

    // snapshot of the value of totalStakes immediately after the last liquidation
    uint public totalStakesSnapshot;

    // snapshot of the total collateral in ActivePool and DefaultPool, immediately after the last liquidation.
    uint public totalCollateralSnapshot;

    /* L_ETH and L_CLVDebt track the sums of accumulated liquidation rewards per unit staked. During it's lifetime, each stake earns:
    *
    * An ETH gain of ( stake * [L_ETH - L_ETH(0)] )
    * A CLVDebt gain  of ( stake * [L_CLVDebt - L_CLVDebt(0)] )
    *
    * Where L_ETH(0) and L_CLVDebt(0) are snapshots of L_ETH and L_CLVDebt for the active CDP taken at the instant the stake was made
    */
    uint public L_ETH;
    uint public L_CLVDebt;

    // Map addresses with active CDPs to their RewardSnapshot
    mapping (address => RewardSnapshot) public rewardSnapshots;

    // Object containing the ETH and CLV snapshots for a given active CDP
    struct RewardSnapshot { uint ETH; uint CLVDebt;}

    // Array of all active CDP addresses - used to compute “approx hint” for list insertion
    address[] public CDPOwners;

    // Error trackers for the trove redistribution calculation
    uint public lastETHError_Redistribution;
    uint public lastCLVDebtError_Redistribution;

    /* --- Variable container structs for liquidations ---

    These structs are used to hold, return and assign variables inside the liquidation functions,
    in order to avoid the error: "CompilerError: Stack too deep". */

    struct LocalVariables_OuterLiquidationFunction {
        uint price;
        uint CLVInPool;
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
        uint remainingCLVInPool;
        uint i;
        uint ICR;
        address user;
        bool backToNormalMode;
        uint entireSystemDebt;
        uint entireSystemColl;
    }

    struct LocalVariables_BatchLiquidation {
        uint price;
        uint remainingCLVInPool;
        uint ICR;
        bool recoveryModeAtStart;
        bool backToNormalMode;
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

    enum CDPManagerOperation {
        applyPendingRewards,
        liquidateInNormalMode,
        liquidateInRecoveryMode,
        partiallyLiquidateInRecoveryMode,
        redeemCollateral
    }

    event CDPCreated(address indexed _user, uint _arrayIndex);
    event CDPUpdated(address indexed _user, uint _debt, uint _coll, uint _stake, CDPManagerOperation _operation);
    event CDPLiquidated(address indexed _user, uint _debt, uint _coll, CDPManagerOperation _operation);

    // --- Dependency setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
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
        priceFeed = IPriceFeed(_priceFeedAddress);
        CLV = ICLVToken(_clvTokenAddress);
        sortedCDPs = ISortedCDPs(_sortedCDPsAddress);
        lqtyStakingAddress = _lqtyStakingAddress;
        lqtyStaking = ILQTYStaking(_lqtyStakingAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
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

    /* Single liquidation function. Closes the CDP of the specified user if its individual
    collateral ratio is lower than the minimum collateral ratio. */
    function liquidate(address _user) external override {
        _requireCDPisActive(_user);

        address[] memory users = new address[](1);
        users[0] = _user;
        batchLiquidateTroves(users);
    }

    // --- Inner liquidation functions ---

    function _liquidateNormalMode(address _user, uint _ICR, uint _CLVInPool) internal
    returns (LiquidationValues memory V)
    {
        LocalVariables_InnerSingleLiquidateFunction memory L;

        // If ICR >= MCR, or is last trove, don't liquidate
        if (_ICR >= MCR || CDPOwners.length <= 1) { return V; }

        (V.entireCDPDebt,
        V.entireCDPColl,
        L.pendingDebtReward,
        L.pendingCollReward) = getEntireDebtAndColl(_user);

        _movePendingTroveRewardsToActivePool(L.pendingDebtReward, L.pendingCollReward);
        _removeStake(_user);

        V.collGasCompensation = _getCollGasCompensation(V.entireCDPColl);
        V.CLVGasCompensation = CLV_GAS_COMPENSATION;
        uint collToLiquidate = V.entireCDPColl.sub(V.collGasCompensation);

        (V.debtToOffset,
        V.collToSendToSP,
        V.debtToRedistribute,
        V.collToRedistribute) = _getOffsetAndRedistributionVals(V.entireCDPDebt, collToLiquidate, _CLVInPool);

        _closeCDP(_user);
        emit CDPLiquidated(_user, V.entireCDPDebt, V.entireCDPColl, CDPManagerOperation.liquidateInNormalMode);

        return V;
    }

    function _liquidateRecoveryMode(address _user, uint _ICR, uint _CLVInPool, uint _TCR) internal
    returns (LiquidationValues memory V)
    {
        LocalVariables_InnerSingleLiquidateFunction memory L;
        // If is last trove, don't liquidate
        if (CDPOwners.length <= 1) { return V; }

        (V.entireCDPDebt,
        V.entireCDPColl,
        L.pendingDebtReward,
        L.pendingCollReward) = getEntireDebtAndColl(_user);

        _movePendingTroveRewardsToActivePool(L.pendingDebtReward, L.pendingCollReward);

        V.collGasCompensation = _getCollGasCompensation(V.entireCDPColl);
        // in case of partial, it will be overriden to zero below
        V.CLVGasCompensation = CLV_GAS_COMPENSATION;
        L.collToLiquidate = V.entireCDPColl.sub(V.collGasCompensation);

        // If ICR <= 100%, purely redistribute the CDP across all active CDPs
        if (_ICR <= _100pct) {
            _removeStake(_user);

            V.debtToOffset = 0;
            V.collToSendToSP = 0;
            V.debtToRedistribute = V.entireCDPDebt;
            V.collToRedistribute = L.collToLiquidate;

            _closeCDP(_user);
            emit CDPLiquidated(_user, V.entireCDPDebt, V.entireCDPColl, CDPManagerOperation.liquidateInRecoveryMode);

        // if 100% < ICR < MCR, offset as much as possible, and redistribute the remainder
        } else if ((_ICR > _100pct) && (_ICR < MCR)) {
            _removeStake(_user);

            (V.debtToOffset,
            V.collToSendToSP,
            V.debtToRedistribute,
            V.collToRedistribute) = _getOffsetAndRedistributionVals(V.entireCDPDebt, L.collToLiquidate, _CLVInPool);

            _closeCDP(_user);
            emit CDPLiquidated(_user, V.entireCDPDebt, V.entireCDPColl, CDPManagerOperation.liquidateInRecoveryMode);

        /* If 110% <= ICR < current TCR (accounting for the preceding liquidations in the current sequence)
         * and there is CLV in the Stability Pool, only offset it as much as possible (no redistribution) */
        } else if ((_ICR >= MCR) && (_ICR < _TCR)) {
            if (_CLVInPool == 0) {
                LiquidationValues memory zeroVals;
                return zeroVals;
            }
            _removeStake(_user);

            V = _getPartialOffsetVals(_user, V.entireCDPDebt, V.entireCDPColl, _CLVInPool);

            _closeCDP(_user);
        }
        else if (_ICR >= _TCR) {
            LiquidationValues memory zeroVals;
            return zeroVals;
        }

        return V;
    }

    function _getOffsetAndRedistributionVals(
        uint _debt,
        uint _coll,
        uint _CLVInPool
    )
        internal
        pure
        returns (uint debtToOffset, uint collToSendToSP, uint debtToRedistribute, uint collToRedistribute)
    {
         // Offset as much debt & collateral as possible against the Stability Pool, and redistribute the remainder
        if (_CLVInPool > 0) {
        /* If the debt is larger than the deposited CLV, offset an amount of debt equal to the latter,
        and send collateral in proportion to the cancelled debt */
            debtToOffset = Math._min(_debt, _CLVInPool);
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

    function _getPartialOffsetVals(
        address _user,
        uint _entireCDPDebt,
        uint _entireCDPColl,
        uint _CLVInPool)
        internal
        returns (LiquidationValues memory V)
    {
        V.entireCDPDebt = _entireCDPDebt;
        V.entireCDPColl = _entireCDPColl;

        // When Pool can fully absorb the trove's debt, perform a full offset
        if (_entireCDPDebt <= _CLVInPool) {
            V.collGasCompensation = _getCollGasCompensation(_entireCDPColl);
            V.CLVGasCompensation = CLV_GAS_COMPENSATION;

            V.debtToOffset = _entireCDPDebt;
            V.collToSendToSP = _entireCDPColl.sub(V.collGasCompensation);
            V.debtToRedistribute = 0;
            V.collToRedistribute = 0;

            emit CDPLiquidated(_user, _entireCDPDebt, _entireCDPColl, CDPManagerOperation.liquidateInRecoveryMode);
        }
        /* When trove's debt is greater than the Pool, perform a partial liquidation:
        offset as much as possible, and do not redistribute the remainder.
        Gas compensation is based on and drawn from the collateral fraction that corresponds to the partial offset. */
        else if (_entireCDPDebt > _CLVInPool) {
            // Partially liquidated pool can’t fall under gas compensation amount of debt
            V.partialNewDebt = Math._max(_entireCDPDebt.sub(_CLVInPool), CLV_GAS_COMPENSATION);
            // V.partialNewDebt >= _entireCDPDebt - _CLVInPool =>
            // _entireCDPDebt - V.partialNewDebt <= _entireCDPDebt - (_entireCDPDebt - _CLVInPool) =>
            // _entireCDPDebt - V.partialNewDebt <= _CLVInPool =>
            // V.debtToOffset <= _CLVInPool
            V.debtToOffset = _entireCDPDebt.sub(V.partialNewDebt);
            uint collFraction = _entireCDPColl.mul(V.debtToOffset).div(_entireCDPDebt);
            V.collGasCompensation = _getCollGasCompensation(collFraction);
            // CLV gas compensation remains untouched, so minimum debt rests assured
            V.CLVGasCompensation = 0;

            V.collToSendToSP = collFraction.sub(V.collGasCompensation);
            V.collToRedistribute = 0;
            V.debtToRedistribute = 0;

            V.partialAddr = _user;
            V.partialNewColl = _entireCDPColl.sub(collFraction);
        }
    }

    /* Liquidate a sequence of troves. Closes a maximum number of n under-collateralized CDPs,
    starting from the one with the lowest collateral ratio in the system */
    function liquidateCDPs(uint _n) external override {
        LocalVariables_OuterLiquidationFunction memory L;

        LiquidationTotals memory T;

        L.price = priceFeed.getPrice();
        L.CLVInPool = stabilityPool.getTotalCLVDeposits();
        L.recoveryModeAtStart = checkRecoveryMode();

        // Perform the appropriate liquidation sequence - tally values and obtain their totals
        if (L.recoveryModeAtStart == true) {
            T = _getTotalFromLiquidationSequence_RecoveryMode(L.price, L.CLVInPool, _n);
        } else if (L.recoveryModeAtStart == false) {
            T = _getTotalsFromLiquidationSequence_NormalMode(L.price, L.CLVInPool, _n);
        }

        // Move liquidated ETH and CLV to the appropriate pools
        stabilityPool.offset(T.totalDebtToOffset, T.totalCollToSendToSP);
        _redistributeDebtAndColl(T.totalDebtToRedistribute, T.totalCollToRedistribute);

        // Update system snapshots and the final partially liquidated trove, if there is one
        _updateSystemSnapshots_excludeCollRemainder(T.partialNewColl.add(T.totalCollGasCompensation));
        _updatePartiallyLiquidatedTrove(T.partialAddr, T.partialNewDebt, T.partialNewColl, L.price);

        L.liquidatedDebt = T.totalDebtInSequence.sub(T.partialNewDebt);
        L.liquidatedColl = T.totalCollInSequence.sub(T.totalCollGasCompensation).sub(T.partialNewColl);
        emit Liquidation(L.liquidatedDebt, L.liquidatedColl, T.totalCollGasCompensation, T.totalCLVGasCompensation);

        // Send gas compensation to caller
        _sendGasCompensation(_msgSender(), T.totalCLVGasCompensation, T.totalCollGasCompensation);
    }

    function _getTotalFromLiquidationSequence_RecoveryMode(
        uint _price,
        uint _CLVInPool,
        uint _n)
        internal
        returns(LiquidationTotals memory T)
    {
        LocalVariables_LiquidationSequence memory L;
        LiquidationValues memory V;

        L.remainingCLVInPool = _CLVInPool;
        L.backToNormalMode = false;
        L.entireSystemDebt = activePool.getCLVDebt().add(defaultPool.getCLVDebt());
        L.entireSystemColl = activePool.getETH().add(defaultPool.getETH());

        L.i = 0;
        while (L.i < _n) {
            L.user = sortedCDPs.getLast();
            L.ICR = getCurrentICR(L.user, _price);

            // Attempt to close CDP
            if (L.backToNormalMode == false) {

                // Break the loop if ICR is greater than MCR and Stability Pool is empty
                if (L.ICR >= MCR && L.remainingCLVInPool == 0) { break; }

                uint TCR = Math._computeCR(L.entireSystemColl, L.entireSystemDebt, _price);

                V = _liquidateRecoveryMode(L.user, L.ICR, L.remainingCLVInPool, TCR);

                // Update aggregate trackers
                L.remainingCLVInPool = L.remainingCLVInPool.sub(V.debtToOffset);
                L.entireSystemDebt = L.entireSystemDebt.sub(V.debtToOffset);
                L.entireSystemColl = L.entireSystemColl.sub(V.collToSendToSP);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);

                // Break the loop if it was a partial liquidation
                if (V.partialAddr != address(0)) {break;}

                L.backToNormalMode = !_checkPotentialRecoveryMode(L.entireSystemColl, L.entireSystemDebt, _price);
            }
            else if (L.backToNormalMode == true && L.ICR < MCR) {
                V = _liquidateNormalMode(L.user, L.ICR, L.remainingCLVInPool);

                L.remainingCLVInPool = L.remainingCLVInPool.sub(V.debtToOffset);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);

            }  else break;  // break if the loop reaches a CDP with ICR >= MCR

            // Break the loop if it reaches the first CDP in the sorted list
            if (L.user == sortedCDPs.getFirst()) { break; }

            L.i++;
        }
    }

    function _getTotalsFromLiquidationSequence_NormalMode(
        uint _price,
        uint _CLVInPool,
        uint _n)
        internal
        returns(LiquidationTotals memory T)
    {
        LocalVariables_LiquidationSequence memory L;
        LiquidationValues memory V;

        L.remainingCLVInPool = _CLVInPool;

        L.i = 0;
        while (L.i < _n) {
            L.user = sortedCDPs.getLast();
            L.ICR = getCurrentICR(L.user, _price);

            if (L.ICR < MCR) {
                V = _liquidateNormalMode(L.user, L.ICR, L.remainingCLVInPool);

                L.remainingCLVInPool = L.remainingCLVInPool.sub(V.debtToOffset);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);

            } else break;  // break if the loop reaches a CDP with ICR >= MCR

            // Break the loop if it reaches the first CDP in the sorted list
            if (L.user == sortedCDPs.getFirst()) { break; }
            L.i++;
        }
    }

    /* Attempt to liquidate a custom set of troves provided by the caller.  Stops if a partial liquidation is
    performed, and thus leaves optimization of the order troves up to the caller.  */
    function batchLiquidateTroves(address[] memory _troveArray) public override {
        require(_troveArray.length != 0, "CDPManager: Calldata address array must not be empty");

        LocalVariables_OuterLiquidationFunction memory L;
        LiquidationTotals memory T;

        L.price = priceFeed.getPrice();
        L.CLVInPool = stabilityPool.getTotalCLVDeposits();
        L.recoveryModeAtStart = checkRecoveryMode();

        // Perform the appropriate liquidation sequence - tally values and obtain their totals
        if (L.recoveryModeAtStart == true) {
           T = _getTotalFromBatchLiquidate_RecoveryMode(L.price, L.CLVInPool, _troveArray);
        } else if (L.recoveryModeAtStart == false) {
            T = _getTotalsFromBatchLiquidate_NormalMode(L.price, L.CLVInPool, _troveArray);
        }

        // Move liquidated ETH and CLV to the appropriate pools
        stabilityPool.offset(T.totalDebtToOffset, T.totalCollToSendToSP);
        _redistributeDebtAndColl(T.totalDebtToRedistribute, T.totalCollToRedistribute);

        // Update system snapshots and the final partially liquidated trove, if there is one
        _updateSystemSnapshots_excludeCollRemainder(T.partialNewColl.add(T.totalCollGasCompensation));
        _updatePartiallyLiquidatedTrove(T.partialAddr, T.partialNewDebt, T.partialNewColl, L.price);

        L.liquidatedDebt = T.totalDebtInSequence.sub(T.partialNewDebt);
        L.liquidatedColl = T.totalCollInSequence.sub(T.totalCollGasCompensation).sub(T.partialNewColl);
        emit Liquidation(L.liquidatedDebt, L.liquidatedColl, T.totalCollGasCompensation, T.totalCLVGasCompensation);

        // Send gas compensation to caller
        _sendGasCompensation(_msgSender(), T.totalCLVGasCompensation, T.totalCollGasCompensation);
    }

    function _getTotalFromBatchLiquidate_RecoveryMode(
        uint _price,
        uint _CLVInPool,
        address[] memory _troveArray)
        internal
        returns(LiquidationTotals memory T)
    {
        LocalVariables_LiquidationSequence memory L;
        LiquidationValues memory V;
        uint troveArrayLength = _troveArray.length;

        L.remainingCLVInPool = _CLVInPool;
        L.backToNormalMode = false;
        L.entireSystemDebt = activePool.getCLVDebt().add(defaultPool.getCLVDebt());
        L.entireSystemColl = activePool.getETH().add(defaultPool.getETH());

        L.i = 0;
        for (L.i = 0; L.i < troveArrayLength; L.i++) {
            L.user = _troveArray[L.i];

            L.ICR = getCurrentICR(L.user, _price);

            // Attempt to close trove
            if (L.backToNormalMode == false) {

                // Skip this trove if ICR is greater than MCR and Stability Pool is empty
                if (L.ICR >= MCR && L.remainingCLVInPool == 0) { continue; }

                uint TCR = Math._computeCR(L.entireSystemColl, L.entireSystemDebt, _price);

                V = _liquidateRecoveryMode(L.user, L.ICR, L.remainingCLVInPool, TCR);

                // Update aggregate trackers
                L.remainingCLVInPool = L.remainingCLVInPool.sub(V.debtToOffset);
                L.entireSystemDebt = L.entireSystemDebt.sub(V.debtToOffset);
                L.entireSystemColl = L.entireSystemColl.sub(V.collToSendToSP);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);

                // Break the loop if it was a partial liquidation
                if (V.partialAddr != address(0)) { break; }

                L.backToNormalMode = !_checkPotentialRecoveryMode(L.entireSystemColl, L.entireSystemDebt, _price);
            }

            else if (L.backToNormalMode == true && L.ICR < MCR) {
                V = _liquidateNormalMode(L.user, L.ICR, L.remainingCLVInPool);
                L.remainingCLVInPool = L.remainingCLVInPool.sub(V.debtToOffset);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);
            }
        }
    }

    function _getTotalsFromBatchLiquidate_NormalMode(
        uint _price,
        uint _CLVInPool,
        address[] memory _troveArray
    )
        internal
        returns(LiquidationTotals memory T)
    {
        LocalVariables_LiquidationSequence memory L;
        LiquidationValues memory V;
        uint troveArrayLength = _troveArray.length;

        L.remainingCLVInPool = _CLVInPool;

        for (L.i = 0; L.i < troveArrayLength; L.i++) {
            L.user = _troveArray[L.i];
            L.ICR = getCurrentICR(L.user, _price);

            if (L.ICR < MCR) {
                V = _liquidateNormalMode(L.user, L.ICR, L.remainingCLVInPool);
                L.remainingCLVInPool = L.remainingCLVInPool.sub(V.debtToOffset);

                // Add liquidation values to their respective running totals
                T = _addLiquidationValuesToTotals(T, V);
            }
        }
    }

    // --- Liquidation helper functions ---

    function _addLiquidationValuesToTotals(LiquidationTotals memory T1, LiquidationValues memory V)
    internal pure returns(LiquidationTotals memory T2) {

        // Tally gas compensation
        T2.totalCollGasCompensation = T1.totalCollGasCompensation.add(V.collGasCompensation);
        T2.totalCLVGasCompensation = T1.totalCLVGasCompensation.add(V.CLVGasCompensation);

        // Tally the total initial debt and coll of troves impacted by the sequence
        T2.totalDebtInSequence = T1.totalDebtInSequence.add(V.entireCDPDebt);
        T2.totalCollInSequence = T1.totalCollInSequence.add(V.entireCDPColl);

        // Tally the debt and coll to offset
        T2.totalDebtToOffset = T1.totalDebtToOffset.add(V.debtToOffset);
        T2.totalCollToSendToSP = T1.totalCollToSendToSP.add(V.collToSendToSP);

        // Tally the debt and coll to redistribute
        T2.totalDebtToRedistribute = T1.totalDebtToRedistribute.add(V.debtToRedistribute);
        T2.totalCollToRedistribute = T1.totalCollToRedistribute.add(V.collToRedistribute);

        // Assign the address of the partially liquidated trove and debt/coll values
        T2.partialAddr = V.partialAddr;
        T2.partialNewDebt = V.partialNewDebt;
        T2.partialNewColl = V.partialNewColl;

        return T2;
    }

    // Update coll, debt, stake and snapshot of partially liquidated trove, and insert it back to the list
    function _updatePartiallyLiquidatedTrove(address _user, uint _newDebt, uint _newColl, uint _price) internal {
        if ( _user == address(0)) { return; }

        CDPs[_user].debt = _newDebt;
        CDPs[_user].coll = _newColl;
        CDPs[_user].status = Status.active;

        _updateCDPRewardSnapshots(_user);
        _updateStakeAndTotalStakes(_user);

        uint ICR = getCurrentICR(_user, _price);

        // Insert to sorted list and add to CDPOwners array
        sortedCDPs.insert(_user, ICR, _price, _user, _user);
        _addCDPOwnerToArray(_user);

        emit CDPUpdated(_user, _newDebt, _newColl, CDPs[_user].stake, CDPManagerOperation.partiallyLiquidateInRecoveryMode);
    }

    function _sendGasCompensation(address _user, uint _CLV, uint _ETH) internal {
        // Send CLV gas compensation to caller
        if (_CLV > 0) {
            CLV.returnFromPool(GAS_POOL_ADDRESS, _user, _CLV);
        }
        // Send ETH gas compensation to caller
        if (_ETH > 0) {
            activePool.sendETH(_user, _ETH);
        }
    }

    // Move a CDP's pending debt and collateral rewards from distributions, from the Default Pool to the Active Pool
    function _movePendingTroveRewardsToActivePool(uint _CLV, uint _ETH) internal {
        // Transfer the debt & coll from the Default Pool to the Active Pool
        defaultPool.decreaseCLVDebt(_CLV);
        activePool.increaseCLVDebt(_CLV);
        defaultPool.sendETH(address(activePool), _ETH);
    }

    // --- Redemption functions ---

    // Redeem as much collateral as possible from _cdpUser's CDP in exchange for CLV up to _maxCLVamount
    function _redeemCollateralFromCDP(
        address _cdpUser,
        uint _maxCLVamount,
        uint _price,
        address _partialRedemptionHint,
        uint _partialRedemptionHintICR
    )
        internal returns (SingleRedemptionValues memory V)
    {
        // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the CDP minus the gas compensation
        V.CLVLot = Math._min(_maxCLVamount, CDPs[_cdpUser].debt.sub(CLV_GAS_COMPENSATION));

        // Get the ETHLot of equivalent value in USD
        V.ETHLot = V.CLVLot.mul(1e18).div(_price);

        // Decrease the debt and collateral of the current CDP according to the CLV lot and corresponding ETH to send
        uint newDebt = (CDPs[_cdpUser].debt).sub(V.CLVLot);
        uint newColl = (CDPs[_cdpUser].coll).sub(V.ETHLot);

        // V.CLVLot <= CDPs[_cdpUser].debt - CLV_GAS_COMPENSATION =>
        // newDebt = CDPs[_cdpUser].debt - V.CLVLot >=
        //  >= CDPs[_cdpUser].debt - (CDPs[_cdpUser].debt - CLV_GAS_COMPENSATION) =>
        //  newDebt >= CLV_GAS_COMPENSATION
        if (newDebt == CLV_GAS_COMPENSATION) {
            // No debt left in the CDP (except for the gas compensation), therefore the trove is closed
            _removeStake(_cdpUser);
            _closeCDP(_cdpUser);
            _activePoolRedeemCloseLoan(_cdpUser, CLV_GAS_COMPENSATION, newColl);

        } else {
            uint newICR = Math._computeCR(newColl, newDebt, _price);

            // Check if the provided hint is fresh. If not, we bail since trying to reinsert without a good hint will almost
            // certainly result in running out of gas.
            if (newICR != _partialRedemptionHintICR) {
                V.CLVLot = 0;
                V.ETHLot = 0;
                return V;
            }

            sortedCDPs.reInsert(_cdpUser, newICR, _price, _partialRedemptionHint, _partialRedemptionHint);

            CDPs[_cdpUser].debt = newDebt;
            CDPs[_cdpUser].coll = newColl;
            _updateStakeAndTotalStakes(_cdpUser);
        }
        emit CDPUpdated(
            _cdpUser,
            newDebt, newColl,
            CDPs[_cdpUser].stake,
            CDPManagerOperation.redeemCollateral
        );
        return V;
    }

    /* Burn the remaining gas compensation CLV, transfers the remaining ETH to _account and updates the Active Pool
     * when after redemption there’s only gas compensation left as debt
     */
    function _activePoolRedeemCloseLoan(address _account, uint _CLV, uint _ETH) internal {
        /*
         * When the redemption drains all the trove and there’s only the gas compensation left.
         * The redeemer swaps (debt - 10) CLV for (debt - 10) worth of ETH, so the 10 CLV gas compensation left correspond to the remaining collateral.
         * In order to close the trove, the user should get the CLV refunded and use them to repay and close it,
         * but instead we do that all in one step.
         */
        CLV.burn(GAS_POOL_ADDRESS, _CLV);
        // Update Active Pool CLV, and send ETH to account
        activePool.decreaseCLVDebt(_CLV);

        activePool.sendETH(_account, _ETH);
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
     request.  Applies pending rewards to a CDP before reducing its debt and coll.

    Note that if _amount is very large, this function can run out of gas, specially if traversed troves are small. This can be easily avoided by splitting the total _amount
    in appropriate chunks and calling the function multiple times.
    Param `_maxIterations` can also be provided, so the loop through CDPs is capped. (If it’s zero it will be ignored)
    This makes it easier to avoid OOG for the frontend, as only knowing approximately the average cost of an iteration is enough, without needing to know the “topology” of the trove list.
    It also avoids the need to set the cap in stone in the contract, nor doing gas calculations, as both gas price and opcode costs can vary.

    All CDPs that are redeemed from -- with the likely exception of the last one -- will end up with no debt left, therefore they will be closed
    If the last CDP does have some remaining debt, the reinsertion could be anywhere in the
    list, therefore it requires a hint. A frontend should use getRedemptionHints() to calculate what the ICR of this CDP will be
    after redemption, and pass a hint for its position in the sortedCDPs list along with the ICR value that the hint was found for.

    If another transaction modifies the list between calling getRedemptionHints() and passing the hints to redeemCollateral(), it
    is very likely that the last (partially) redeemed CDP would end up with a different ICR than what the hint is for. In this case the
    redemption will stop after the last completely redeemed CDP and the sender will keep the remaining CLV amount, which they can attempt
    to redeem later.
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
        address redeemer = _msgSender();
        uint activeDebt = activePool.getCLVDebt();
        uint defaultedDebt = defaultPool.getCLVDebt();

        RedemptionTotals memory T;

        _requireAmountGreaterThanZero(_CLVamount);
        _requireCLVBalanceCoversRedemption(redeemer, _CLVamount);

        // Confirm redeemer's balance is less than total systemic debt
        assert(CLV.balanceOf(redeemer) <= (activeDebt.add(defaultedDebt)));

        uint remainingCLV = _CLVamount;
        uint price = priceFeed.getPrice();
        address currentCDPuser;

        // TODO: This is to jump into the first non undercollaterallized trove, right?
        if (_isValidFirstRedemptionHint(_firstRedemptionHint, price)) {
            currentCDPuser = _firstRedemptionHint;
        } else {
            currentCDPuser = sortedCDPs.getLast();

            while (currentCDPuser != address(0) && getCurrentICR(currentCDPuser, price) < MCR) {
                currentCDPuser = sortedCDPs.getPrev(currentCDPuser);
            }
        }

        // Loop through the CDPs starting from the one with lowest collateral ratio until _amount of CLV is exchanged for collateral
        if (_maxIterations == 0) { _maxIterations = uint(-1); }
        while (currentCDPuser != address(0) && remainingCLV > 0 && _maxIterations > 0) {
            _maxIterations--;
            // Save the address of the CDP preceding the current one, before potentially modifying the list
            address nextUserToCheck = sortedCDPs.getPrev(currentCDPuser);

            _applyPendingRewards(currentCDPuser);

            SingleRedemptionValues memory V = _redeemCollateralFromCDP(
                currentCDPuser,
                remainingCLV,
                price,
                _partialRedemptionHint,
                _partialRedemptionHintICR
            );

            if (V.CLVLot == 0) break; // Partial redemption hint got out-of-date, therefore we could not redeem from the last CDP

            T.totalCLVToRedeem  = T.totalCLVToRedeem.add(V.CLVLot);
            T.totalETHDrawn = T.totalETHDrawn.add(V.ETHLot);

            remainingCLV = remainingCLV.sub(V.CLVLot);
            currentCDPuser = nextUserToCheck;
        }

        // Decay the baseRate due to time passed, and increase the baserate due to this redemption
        _updateBaseRateFromRedemption(T.totalETHDrawn, price);

        // Calculate the ETH fee and send it to GT staking contract
        T.ETHFee = _getRedemptionFee(T.totalETHDrawn);

        // Move ETHFee -> LQTYStaking contract
        activePool.sendETH(lqtyStakingAddress, T.ETHFee);
        lqtyStaking.increaseF_ETH(T.ETHFee);

        T.ETHToSendToRedeemer = T.totalETHDrawn.sub(T.ETHFee);

        // Burn the total CLV that is cancelled with debt, and send the redeemed ETH to _msgSender()
        _activePoolRedeemCollateral(_msgSender(), T.totalCLVtoRedeem, T.totalETHtoSendToRedeemer);

        emit Redemption(_CLVamount, T.totalCLVToRedeem, T.totalETHDrawn, T.ETHFee);
    }

    // Burn the received CLV, transfers the redeemed ETH to _account and updates the Active Pool
    function _activePoolRedeemCollateral(address _account, uint _CLV, uint _ETH) internal {
        // Update Active Pool CLV, and send ETH to account
        CLV.burn(_account, _CLV);
        activePool.decreaseCLVDebt(_CLV);

        activePool.sendETH(_account, _ETH);
    }

    // --- Helper functions ---


    // Return the current collateral ratio (ICR) of a given CDP. Takes pending coll/debt rewards into account.
    function getCurrentICR(address _user, uint _price) public view override returns (uint) {
        uint pendingETHReward = getPendingETHReward(_user);
        uint pendingCLVDebtReward = getPendingCLVDebtReward(_user);

        uint currentETH = CDPs[_user].coll.add(pendingETHReward);
        uint currentCLVDebt = CDPs[_user].debt.add(pendingCLVDebtReward);

        uint ICR = Math._computeCR(currentETH, currentCLVDebt, _price);
        return ICR;
    }

    function applyPendingRewards(address _user) external override {
        _requireCallerIsBorrowerOperations();
        return _applyPendingRewards(_user);
    }

    // Add the user's coll and debt rewards earned from liquidations, to their CDP
    function _applyPendingRewards(address _user) internal {
        if (hasPendingRewards(_user)) {
            _requireCDPisActive(_user);

            // Compute pending rewards
            uint pendingETHReward = getPendingETHReward(_user);
            uint pendingCLVDebtReward = getPendingCLVDebtReward(_user);

            // Apply pending rewards to trove's state
            CDPs[_user].coll = CDPs[_user].coll.add(pendingETHReward);
            CDPs[_user].debt = CDPs[_user].debt.add(pendingCLVDebtReward);

            _updateCDPRewardSnapshots(_user);

            // Tell PM to transfer from DefaultPool to ActivePool
            _movePendingTroveRewardsToActivePool(pendingCLVDebtReward, pendingETHReward);

            emit CDPUpdated(_user, CDPs[_user].debt, CDPs[_user].coll, CDPs[_user].stake, CDPManagerOperation.applyPendingRewards);
        }
    }

    // Update user's snapshots of L_ETH and L_CLVDebt to reflect the current values
    function updateCDPRewardSnapshots(address _user) external override {
        _requireCallerIsBorrowerOperations();
       return _updateCDPRewardSnapshots(_user);
    }

    function _updateCDPRewardSnapshots(address _user) internal {
        rewardSnapshots[_user].ETH = L_ETH;
        rewardSnapshots[_user].CLVDebt = L_CLVDebt;
    }

    // Get the user's pending accumulated ETH reward, earned by its stake
    function getPendingETHReward(address _user) public view override returns (uint) {
        uint snapshotETH = rewardSnapshots[_user].ETH;
        uint rewardPerUnitStaked = L_ETH.sub(snapshotETH);

        if ( rewardPerUnitStaked == 0 ) { return 0; }

        uint stake = CDPs[_user].stake;

        uint pendingETHReward = stake.mul(rewardPerUnitStaked).div(1e18);

        return pendingETHReward;
    }

     // Get the user's pending accumulated CLV reward, earned by its stake
    function getPendingCLVDebtReward(address _user) public view override returns (uint) {
        uint snapshotCLVDebt = rewardSnapshots[_user].CLVDebt;
        uint rewardPerUnitStaked = L_CLVDebt.sub(snapshotCLVDebt);

        if ( rewardPerUnitStaked == 0 ) { return 0; }

        uint stake =  CDPs[_user].stake;

        uint pendingCLVDebtReward = stake.mul(rewardPerUnitStaked).div(1e18);

        return pendingCLVDebtReward;
    }

    function hasPendingRewards(address _user) public view override returns (bool) {
        /* A CDP has pending rewards if its snapshot is less than the current rewards per-unit-staked sum:
        this indicates that rewards have occured since the snapshot was made, and the user therefore has
        pending rewards */
        return (rewardSnapshots[_user].ETH < L_ETH);
    }

    // Returns the CDPs entire debt and coll, including distribution pending rewards.
    function getEntireDebtAndColl(
        address _user
    )
        public
        view
        override
        returns (uint debt, uint coll, uint pendingCLVDebtReward,  uint pendingETHReward)
    {
        debt = CDPs[_user].debt;
        coll = CDPs[_user].coll;

        pendingCLVDebtReward = getPendingCLVDebtReward(_user);
        pendingETHReward = getPendingETHReward(_user);

        debt = debt.add(pendingCLVDebtReward);
        coll = coll.add(pendingETHReward);
    }

    function removeStake(address _user) external override {
        _requireCallerIsBorrowerOperations();
        return _removeStake(_user);
    }

    // Remove use's stake from the totalStakes sum, and set their stake to 0
    function _removeStake(address _user) internal {
        uint stake = CDPs[_user].stake;
        totalStakes = totalStakes.sub(stake);
        CDPs[_user].stake = 0;
    }

    function updateStakeAndTotalStakes(address _user) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        return _updateStakeAndTotalStakes(_user);
    }

    // Update user's stake based on their latest collateral value
    function _updateStakeAndTotalStakes(address _user) internal returns (uint) {
        uint newStake = _computeNewStake(CDPs[_user].coll);
        uint oldStake = CDPs[_user].stake;
        CDPs[_user].stake = newStake;
        totalStakes = totalStakes.sub(oldStake).add(newStake);

        return newStake;
    }

    /* Calculate a new stake based on the snapshots of the totalStakes and totalCollateral
    taken at the last liquidation */
    function _computeNewStake(uint _coll) internal view returns (uint) {
        uint stake;
        if (totalCollateralSnapshot == 0) {
            stake = _coll;
        } else {
            /* The following condition holds true for 2 reasons:
             * Because don’t allow to close or liquidate the last trove.
             * Because when we close or liquidate a trove, we redistribute the pending rewards,
             * so if all troves were closed/liquidated, rewards would’ve been emptied
             * and totalCollateralSnapshot would be zero too.
             */
            assert(totalStakesSnapshot > 0);
            stake = _coll.mul(totalStakesSnapshot).div(totalCollateralSnapshot);
        }
        return stake;
    }

    function _redistributeDebtAndColl(uint _debt, uint _coll) internal {
        if (_debt == 0) { return; }

        if (totalStakes > 0) {
            /* Add distributed coll and debt rewards-per-unit-staked to the running totals.
            Division uses error correction. */
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
        defaultPool.increaseCLVDebt(_debt);
        activePool.decreaseCLVDebt(_debt);
        activePool.sendETH(address(defaultPool), _coll);
    }

    function closeCDP(address _user) external override {
        _requireCallerIsBorrowerOperations();
        return _closeCDP(_user);
    }

    function _closeCDP(address _user) internal {
        uint CDPOwnersArrayLength = CDPOwners.length;
        _requireMoreThanOneTroveInSystem(CDPOwnersArrayLength);

        CDPs[_user].status = Status.closed;
        CDPs[_user].coll = 0;
        CDPs[_user].debt = 0;

        rewardSnapshots[_user].ETH = 0;
        rewardSnapshots[_user].CLVDebt = 0;

        _removeCDPOwner(_user, CDPOwnersArrayLength);
        sortedCDPs.remove(_user);
    }

    // Updates snapshots of system stakes and system collateral, excluding a given collateral remainder from the calculation
    function _updateSystemSnapshots_excludeCollRemainder(uint _collRemainder) internal {
        totalStakesSnapshot = totalStakes;

        uint activeColl = activePool.getETH();
        uint liquidatedColl = defaultPool.getETH();
        totalCollateralSnapshot = activeColl.sub(_collRemainder).add(liquidatedColl);
    }

    // Push the owner's address to the CDP owners list, and record the corresponding array index on the CDP struct
    function addCDPOwnerToArray(address _user) external override returns (uint index) {
        _requireCallerIsBorrowerOperations();
        return _addCDPOwnerToArray(_user);
    }

    function _addCDPOwnerToArray(address _user) internal returns (uint128 index) {
        require(CDPOwners.length < 2**128 - 1, "CDPManager: CDPOwners array has maximum size of 2^128 - 1");

        // Push the CDPowner to the array
        CDPOwners.push(_user);

        // Record the index of the new CDPowner on their CDP struct
        index = uint128(CDPOwners.length.sub(1));
        CDPs[_user].arrayIndex = index;

        return index;
    }

    /* Remove a CDP owner from the CDPOwners array, not preserving order. Removing owner 'B' does the following:
    [A B C D E] => [A E C D], and updates E's CDP struct to point to its new array index. */
    function _removeCDPOwner(address _user, uint CDPOwnersArrayLength) internal {
        require(CDPs[_user].status == Status.closed, "CDPManager: CDP is still active");

        uint128 index = CDPs[_user].arrayIndex;
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

    /* Check whether or not the system *would be* in Recovery Mode,
    given an ETH:USD price, and total system coll and debt. */
    function _checkPotentialRecoveryMode(
        uint _entireSystemColl,
        uint _entireSystemDebt,
        uint _price
    )
        internal
        pure
    returns (bool)
    {
        uint TCR = Math._computeCR(_entireSystemColl, _entireSystemDebt, _price);
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

        TCR = Math._computeCR(entireSystemColl, entireSystemDebt, price);

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

    /* This function has two impacts on the baseRate state variable:
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

        // update the baseRate state variable
        baseRate = newBaseRate < 1e18 ? newBaseRate : 1e18;  // cap baseRate at maximum 100%
        assert(baseRate <= 1e18 && baseRate > 0);

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
    function decayBaseRateFromBorrowing() external override returns (uint) {
        _requireCallerIsBorrowerOperations();

        baseRate = _calcDecayedBaseRate();
        assert(baseRate >= 0 && baseRate <= 1e18);

        _updateLastFeeOpTime();
        return baseRate;
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
        uint decayFactor = Math._decPow(MINUTE_DECAY_FACTOR, minutesPassed);

        return baseRate.mul(decayFactor).div(1e18);
    }

    function _minutesPassedSinceLastFeeOp() internal view returns (uint) {
        return (block.timestamp.sub(lastFeeOperationTime)).div(SECONDS_IN_ONE_MINUTE);
    }

    // --- 'require' wrapper functions ---

    function _requireCallerIsBorrowerOperations() internal view {
        require(_msgSender() == borrowerOperationsAddress, "CDPManager: Caller is not the BorrowerOperations contract");
    }

    function _requireCDPisActive(address _user) internal view {
        require(CDPs[_user].status == Status.active, "CDPManager: Trove does not exist or is closed");
    }

    function _requireCLVBalanceCoversRedemption(address _user, uint _amount) internal view {
        require(clvToken.balanceOf(_user) >= _amount, "CDPManager: Requested redemption amount must be <= user's CLV token balance");
    }

    function _requireETHSentSuccessfully(bool _success) internal pure {
        require(_success, "CDPManager: Failed to send ETH to msg.sender");
    }

    function _requireMoreThanOneTroveInSystem(uint CDPOwnersArrayLength) internal view {
        require (CDPOwnersArrayLength > 1 && sortedCDPs.getSize() > 1, "CDPManager: Only one trove in the system");
    }

    function _requireAmountGreaterThanZero(uint _amount) internal pure {
        require(_amount > 0, "CDPManager: Amount must be greater than zero");
    }

    // --- Trove property getters ---

    function getCDPStatus(address _user) external view override returns (uint) {
        return uint(CDPs[_user].status);
    }

    function getCDPStake(address _user) external view override returns (uint) {
        return CDPs[_user].stake;
    }

    function getCDPDebt(address _user) external view override returns (uint) {
        return CDPs[_user].debt;
    }

    function getCDPColl(address _user) external view override returns (uint) {
        return CDPs[_user].coll;
    }

    // --- Trove property setters ---

    function setCDPStatus(address _user, uint _num) external override {
        _requireCallerIsBorrowerOperations();
        CDPs[_user].status = Status(_num);
    }

    function increaseCDPColl(address _user, uint _collIncrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        uint newColl = CDPs[_user].coll.add(_collIncrease);
        CDPs[_user].coll = newColl;
        return newColl;
    }

    function decreaseCDPColl(address _user, uint _collDecrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        uint newColl = CDPs[_user].coll.sub(_collDecrease);
        CDPs[_user].coll = newColl;
        return newColl;
    }

    function increaseCDPDebt(address _user, uint _debtIncrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        uint newDebt = CDPs[_user].debt.add(_debtIncrease);
        CDPs[_user].debt = newDebt;
        return newDebt;
    }

    function decreaseCDPDebt(address _user, uint _debtDecrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        uint newDebt = CDPs[_user].debt.sub(_debtDecrease);
        CDPs[_user].debt = newDebt;
        return newDebt;
    }
}
