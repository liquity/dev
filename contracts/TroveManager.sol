// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./Interfaces/ITroveManager.sol";
import "./Dependencies/VestaBase.sol";
import "./Dependencies/CheckContract.sol";

contract TroveManager is VestaBase, CheckContract, ITroveManager {
	using SafeMathUpgradeable for uint256;
	string public constant NAME = "TroveManager";

	// --- Connected contract declarations ---

	address public borrowerOperationsAddress;

	IStabilityPoolManager public stabilityPoolManager;

	address gasPoolAddress;

	ICollSurplusPool collSurplusPool;

	IVSTToken public override vstToken;

	IVSTAStaking public override vstaStaking;

	// A doubly linked list of Troves, sorted by their sorted by their collateral ratios
	ISortedTroves public sortedTroves;

	// --- Data structures ---

	uint256 public constant SECONDS_IN_ONE_MINUTE = 60;
	/*
	 * Half-life of 12h. 12h = 720 min
	 * (1/2) = d^720 => d = (1/2)^(1/720)
	 */
	uint256 public constant MINUTE_DECAY_FACTOR = 999037758833783000;

	/*
	 * BETA: 18 digit decimal. Parameter by which to divide the redeemed fraction, in order to calc the new base rate from a redemption.
	 * Corresponds to (1 / ALPHA) in the white paper.
	 */
	uint256 public constant BETA = 2;

	mapping(address => uint256) public baseRate;

	// The timestamp of the latest fee operation (redemption or new VST issuance)
	mapping(address => uint256) public lastFeeOperationTime;

	mapping(address => mapping(address => Trove)) public Troves;

	mapping(address => uint256) public totalStakes;

	// Snapshot of the value of totalStakes, taken immediately after the latest liquidation
	mapping(address => uint256) public totalStakesSnapshot;

	// Snapshot of the total collateral across the ActivePool and DefaultPool, immediately after the latest liquidation.
	mapping(address => uint256) public totalCollateralSnapshot;

	/*
	 * L_ETH and L_VSTDebt track the sums of accumulated liquidation rewards per unit staked. During its lifetime, each stake earns:
	 *
	 * An ETH gain of ( stake * [L_ETH - L_ETH(0)] )
	 * A VSTDebt increase  of ( stake * [L_VSTDebt - L_VSTDebt(0)] )
	 *
	 * Where L_ETH(0) and L_VSTDebt(0) are snapshots of L_ETH and L_VSTDebt for the active Trove taken at the instant the stake was made
	 */
	mapping(address => uint256) public L_ASSETS;
	mapping(address => uint256) public L_VSTDebts;

	// Map addresses with active troves to their RewardSnapshot
	mapping(address => mapping(address => RewardSnapshot)) public rewardSnapshots;

	// Object containing the ETH and VST snapshots for a given active trove
	struct RewardSnapshot {
		uint256 asset;
		uint256 VSTDebt;
	}

	// Array of all active trove addresses - used to to compute an approximate hint off-chain, for the sorted list insertion
	mapping(address => address[]) public TroveOwners;

	// Error trackers for the trove redistribution calculation
	mapping(address => uint256) public lastETHError_Redistribution;
	mapping(address => uint256) public lastVSTDebtError_Redistribution;

	bool public isInitialized;

	modifier onlyBorrowerOperations() {
		require(
			msg.sender == borrowerOperationsAddress,
			"TroveManager: Caller is not the BorrowerOperations contract"
		);
		_;
	}

	modifier troveIsActive(address _asset, address _borrower) {
		require(
			isTroveActive(_asset, _borrower),
			"TroveManager: Trove does not exist or is closed"
		);
		_;
	}

	// --- Dependency setter ---

	function setAddresses(
		address _borrowerOperationsAddress,
		address _stabilityPoolManagerAddress,
		address _gasPoolAddress,
		address _collSurplusPoolAddress,
		address _vstTokenAddress,
		address _sortedTrovesAddress,
		address _vstaStakingAddress,
		address _vestaParamsAddress
	) external override initializer {
		require(!isInitialized, "Already initialized");
		checkContract(_borrowerOperationsAddress);
		checkContract(_stabilityPoolManagerAddress);
		checkContract(_gasPoolAddress);
		checkContract(_collSurplusPoolAddress);
		checkContract(_vstTokenAddress);
		checkContract(_sortedTrovesAddress);
		checkContract(_vstaStakingAddress);
		checkContract(_vestaParamsAddress);
		isInitialized = true;

		__Ownable_init();

		borrowerOperationsAddress = _borrowerOperationsAddress;
		stabilityPoolManager = IStabilityPoolManager(_stabilityPoolManagerAddress);
		gasPoolAddress = _gasPoolAddress;
		collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
		vstToken = IVSTToken(_vstTokenAddress);
		sortedTroves = ISortedTroves(_sortedTrovesAddress);
		vstaStaking = IVSTAStaking(_vstaStakingAddress);

		setVestaParameters(_vestaParamsAddress);

		emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
		emit StabilityPoolAddressChanged(_stabilityPoolManagerAddress);
		emit GasPoolAddressChanged(_gasPoolAddress);
		emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
		emit VSTTokenAddressChanged(_vstTokenAddress);
		emit SortedTrovesAddressChanged(_sortedTrovesAddress);
		emit VSTAStakingAddressChanged(_vstaStakingAddress);
	}

	// --- Getters ---

	function getTroveOwnersCount(address _asset) external view override returns (uint256) {
		return TroveOwners[_asset].length;
	}

	function getTroveFromTroveOwnersArray(address _asset, uint256 _index)
		external
		view
		override
		returns (address)
	{
		return TroveOwners[_asset][_index];
	}

	// --- Trove Liquidation functions ---

	// Single liquidation function. Closes the trove if its ICR is lower than the minimum collateral ratio.
	function liquidate(address _asset, address _borrower)
		external
		override
		troveIsActive(_asset, _borrower)
	{
		address[] memory borrowers = new address[](1);
		borrowers[0] = _borrower;
		batchLiquidateTroves(_asset, borrowers);
	}

	// --- Inner single liquidation functions ---

	// Liquidate one trove, in Normal Mode.
	function _liquidateNormalMode(
		address _asset,
		IActivePool _activePool,
		IDefaultPool _defaultPool,
		address _borrower,
		uint256 _VSTInStabPool
	) internal returns (LiquidationValues memory singleLiquidation) {
		LocalVariables_InnerSingleLiquidateFunction memory vars;

		(
			singleLiquidation.entireTroveDebt,
			singleLiquidation.entireTroveColl,
			vars.pendingDebtReward,
			vars.pendingCollReward
		) = getEntireDebtAndColl(_asset, _borrower);

		_movePendingTroveRewardsToActivePool(
			_asset,
			_activePool,
			_defaultPool,
			vars.pendingDebtReward,
			vars.pendingCollReward
		);
		_removeStake(_asset, _borrower);

		singleLiquidation.collGasCompensation = _getCollGasCompensation(
			_asset,
			singleLiquidation.entireTroveColl
		);
		singleLiquidation.VSTGasCompensation = vestaParams.VST_GAS_COMPENSATION(_asset);
		uint256 collToLiquidate = singleLiquidation.entireTroveColl.sub(
			singleLiquidation.collGasCompensation
		);

		(
			singleLiquidation.debtToOffset,
			singleLiquidation.collToSendToSP,
			singleLiquidation.debtToRedistribute,
			singleLiquidation.collToRedistribute
		) = _getOffsetAndRedistributionVals(
			singleLiquidation.entireTroveDebt,
			collToLiquidate,
			_VSTInStabPool
		);

		_closeTrove(_asset, _borrower, Status.closedByLiquidation);
		emit TroveLiquidated(
			_asset,
			_borrower,
			singleLiquidation.entireTroveDebt,
			singleLiquidation.entireTroveColl,
			TroveManagerOperation.liquidateInNormalMode
		);
		emit TroveUpdated(_asset, _borrower, 0, 0, 0, TroveManagerOperation.liquidateInNormalMode);
		return singleLiquidation;
	}

	// Liquidate one trove, in Recovery Mode.
	function _liquidateRecoveryMode(
		address _asset,
		IActivePool _activePool,
		IDefaultPool _defaultPool,
		address _borrower,
		uint256 _ICR,
		uint256 _VSTInStabPool,
		uint256 _TCR,
		uint256 _price
	) internal returns (LiquidationValues memory singleLiquidation) {
		LocalVariables_InnerSingleLiquidateFunction memory vars;
		if (TroveOwners[_asset].length <= 1) {
			return singleLiquidation;
		} // don't liquidate if last trove
		(
			singleLiquidation.entireTroveDebt,
			singleLiquidation.entireTroveColl,
			vars.pendingDebtReward,
			vars.pendingCollReward
		) = getEntireDebtAndColl(_asset, _borrower);

		singleLiquidation.collGasCompensation = _getCollGasCompensation(
			_asset,
			singleLiquidation.entireTroveColl
		);
		singleLiquidation.VSTGasCompensation = vestaParams.VST_GAS_COMPENSATION(_asset);
		vars.collToLiquidate = singleLiquidation.entireTroveColl.sub(
			singleLiquidation.collGasCompensation
		);

		// If ICR <= 100%, purely redistribute the Trove across all active Troves
		if (_ICR <= vestaParams._100pct()) {
			_movePendingTroveRewardsToActivePool(
				_asset,
				_activePool,
				_defaultPool,
				vars.pendingDebtReward,
				vars.pendingCollReward
			);
			_removeStake(_asset, _borrower);

			singleLiquidation.debtToOffset = 0;
			singleLiquidation.collToSendToSP = 0;
			singleLiquidation.debtToRedistribute = singleLiquidation.entireTroveDebt;
			singleLiquidation.collToRedistribute = vars.collToLiquidate;

			_closeTrove(_asset, _borrower, Status.closedByLiquidation);
			emit TroveLiquidated(
				_asset,
				_borrower,
				singleLiquidation.entireTroveDebt,
				singleLiquidation.entireTroveColl,
				TroveManagerOperation.liquidateInRecoveryMode
			);
			emit TroveUpdated(
				_asset,
				_borrower,
				0,
				0,
				0,
				TroveManagerOperation.liquidateInRecoveryMode
			);

			// If 100% < ICR < MCR, offset as much as possible, and redistribute the remainder
		} else if ((_ICR > vestaParams._100pct()) && (_ICR < vestaParams.MCR(_asset))) {
			_movePendingTroveRewardsToActivePool(
				_asset,
				_activePool,
				_defaultPool,
				vars.pendingDebtReward,
				vars.pendingCollReward
			);
			_removeStake(_asset, _borrower);

			(
				singleLiquidation.debtToOffset,
				singleLiquidation.collToSendToSP,
				singleLiquidation.debtToRedistribute,
				singleLiquidation.collToRedistribute
			) = _getOffsetAndRedistributionVals(
				singleLiquidation.entireTroveDebt,
				vars.collToLiquidate,
				_VSTInStabPool
			);

			_closeTrove(_asset, _borrower, Status.closedByLiquidation);
			emit TroveLiquidated(
				_asset,
				_borrower,
				singleLiquidation.entireTroveDebt,
				singleLiquidation.entireTroveColl,
				TroveManagerOperation.liquidateInRecoveryMode
			);
			emit TroveUpdated(
				_asset,
				_borrower,
				0,
				0,
				0,
				TroveManagerOperation.liquidateInRecoveryMode
			);
			/*
			 * If 110% <= ICR < current TCR (accounting for the preceding liquidations in the current sequence)
			 * and there is VST in the Stability Pool, only offset, with no redistribution,
			 * but at a capped rate of 1.1 and only if the whole debt can be liquidated.
			 * The remainder due to the capped rate will be claimable as collateral surplus.
			 */
		} else if (
			(_ICR >= vestaParams.MCR(_asset)) &&
			(_ICR < _TCR) &&
			(singleLiquidation.entireTroveDebt <= _VSTInStabPool)
		) {
			_movePendingTroveRewardsToActivePool(
				_asset,
				_activePool,
				_defaultPool,
				vars.pendingDebtReward,
				vars.pendingCollReward
			);
			assert(_VSTInStabPool != 0);

			_removeStake(_asset, _borrower);
			singleLiquidation = _getCappedOffsetVals(
				_asset,
				singleLiquidation.entireTroveDebt,
				singleLiquidation.entireTroveColl,
				_price
			);

			_closeTrove(_asset, _borrower, Status.closedByLiquidation);
			if (singleLiquidation.collSurplus > 0) {
				collSurplusPool.accountSurplus(_asset, _borrower, singleLiquidation.collSurplus);
			}

			emit TroveLiquidated(
				_asset,
				_borrower,
				singleLiquidation.entireTroveDebt,
				singleLiquidation.collToSendToSP,
				TroveManagerOperation.liquidateInRecoveryMode
			);
			emit TroveUpdated(
				_asset,
				_borrower,
				0,
				0,
				0,
				TroveManagerOperation.liquidateInRecoveryMode
			);
		} else {
			// if (_ICR >= MCR && ( _ICR >= _TCR || singleLiquidation.entireTroveDebt > _VSTInStabPool))
			LiquidationValues memory zeroVals;
			return zeroVals;
		}

		return singleLiquidation;
	}

	/* In a full liquidation, returns the values for a trove's coll and debt to be offset, and coll and debt to be
	 * redistributed to active troves.
	 */
	function _getOffsetAndRedistributionVals(
		uint256 _debt,
		uint256 _coll,
		uint256 _VSTInStabPool
	)
		internal
		pure
		returns (
			uint256 debtToOffset,
			uint256 collToSendToSP,
			uint256 debtToRedistribute,
			uint256 collToRedistribute
		)
	{
		if (_VSTInStabPool > 0) {
			/*
			 * Offset as much debt & collateral as possible against the Stability Pool, and redistribute the remainder
			 * between all active troves.
			 *
			 *  If the trove's debt is larger than the deposited VST in the Stability Pool:
			 *
			 *  - Offset an amount of the trove's debt equal to the VST in the Stability Pool
			 *  - Send a fraction of the trove's collateral to the Stability Pool, equal to the fraction of its offset debt
			 *
			 */
			debtToOffset = VestaMath._min(_debt, _VSTInStabPool);
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
	 *  Get its offset coll/debt and ETH gas comp, and close the trove.
	 */
	function _getCappedOffsetVals(
		address _asset,
		uint256 _entireTroveDebt,
		uint256 _entireTroveColl,
		uint256 _price
	) internal view returns (LiquidationValues memory singleLiquidation) {
		singleLiquidation.entireTroveDebt = _entireTroveDebt;
		singleLiquidation.entireTroveColl = _entireTroveColl;
		uint256 cappedCollPortion = _entireTroveDebt.mul(vestaParams.MCR(_asset)).div(_price);

		singleLiquidation.collGasCompensation = _getCollGasCompensation(_asset, cappedCollPortion);
		singleLiquidation.VSTGasCompensation = vestaParams.VST_GAS_COMPENSATION(_asset);

		singleLiquidation.debtToOffset = _entireTroveDebt;
		singleLiquidation.collToSendToSP = cappedCollPortion.sub(
			singleLiquidation.collGasCompensation
		);
		singleLiquidation.collSurplus = _entireTroveColl.sub(cappedCollPortion);
		singleLiquidation.debtToRedistribute = 0;
		singleLiquidation.collToRedistribute = 0;
	}

	/*
	 * Liquidate a sequence of troves. Closes a maximum number of n under-collateralized Troves,
	 * starting from the one with the lowest collateral ratio in the system, and moving upwards
	 */
	function liquidateTroves(address _asset, uint256 _n) external override {
		ContractsCache memory contractsCache = ContractsCache(
			vestaParams.activePool(),
			vestaParams.defaultPool(),
			IVSTToken(address(0)),
			IVSTAStaking(address(0)),
			sortedTroves,
			ICollSurplusPool(address(0)),
			address(0)
		);
		IStabilityPool stabilityPoolCached = stabilityPoolManager.getAssetStabilityPool(_asset);

		LocalVariables_OuterLiquidationFunction memory vars;

		LiquidationTotals memory totals;

		vars.price = vestaParams.priceFeed().fetchPrice(_asset);
		vars.VSTInStabPool = stabilityPoolCached.getTotalVSTDeposits();
		vars.recoveryModeAtStart = _checkRecoveryMode(_asset, vars.price);

		// Perform the appropriate liquidation sequence - tally the values, and obtain their totals
		if (vars.recoveryModeAtStart) {
			totals = _getTotalsFromLiquidateTrovesSequence_RecoveryMode(
				_asset,
				contractsCache,
				vars.price,
				vars.VSTInStabPool,
				_n
			);
		} else {
			// if !vars.recoveryModeAtStart
			totals = _getTotalsFromLiquidateTrovesSequence_NormalMode(
				_asset,
				contractsCache.activePool,
				contractsCache.defaultPool,
				vars.price,
				vars.VSTInStabPool,
				_n
			);
		}

		require(totals.totalDebtInSequence > 0, "TroveManager: nothing to liquidate");

		// Move liquidated ETH and VST to the appropriate pools
		stabilityPoolCached.offset(totals.totalDebtToOffset, totals.totalCollToSendToSP);
		_redistributeDebtAndColl(
			_asset,
			contractsCache.activePool,
			contractsCache.defaultPool,
			totals.totalDebtToRedistribute,
			totals.totalCollToRedistribute
		);
		if (totals.totalCollSurplus > 0) {
			contractsCache.activePool.sendAsset(
				_asset,
				address(collSurplusPool),
				totals.totalCollSurplus
			);
		}

		// Update system snapshots
		_updateSystemSnapshots_excludeCollRemainder(
			_asset,
			contractsCache.activePool,
			totals.totalCollGasCompensation
		);

		vars.liquidatedDebt = totals.totalDebtInSequence;
		vars.liquidatedColl = totals.totalCollInSequence.sub(totals.totalCollGasCompensation).sub(
			totals.totalCollSurplus
		);
		emit Liquidation(
			_asset,
			vars.liquidatedDebt,
			vars.liquidatedColl,
			totals.totalCollGasCompensation,
			totals.totalVSTGasCompensation
		);

		// Send gas compensation to caller
		_sendGasCompensation(
			_asset,
			contractsCache.activePool,
			msg.sender,
			totals.totalVSTGasCompensation,
			totals.totalCollGasCompensation
		);
	}

	/*
	 * This function is used when the liquidateTroves sequence starts during Recovery Mode. However, it
	 * handle the case where the system *leaves* Recovery Mode, part way through the liquidation sequence
	 */
	function _getTotalsFromLiquidateTrovesSequence_RecoveryMode(
		address _asset,
		ContractsCache memory _contractsCache,
		uint256 _price,
		uint256 _VSTInStabPool,
		uint256 _n
	) internal returns (LiquidationTotals memory totals) {
		LocalVariables_AssetBorrowerPrice memory assetVars = LocalVariables_AssetBorrowerPrice(
			_asset,
			address(0),
			_price
		);

		LocalVariables_LiquidationSequence memory vars;
		LiquidationValues memory singleLiquidation;

		vars.remainingVSTInStabPool = _VSTInStabPool;
		vars.backToNormalMode = false;
		vars.entireSystemDebt = getEntireSystemDebt(assetVars._asset);
		vars.entireSystemColl = getEntireSystemColl(assetVars._asset);

		vars.user = _contractsCache.sortedTroves.getLast(assetVars._asset);
		address firstUser = _contractsCache.sortedTroves.getFirst(assetVars._asset);
		for (vars.i = 0; vars.i < _n && vars.user != firstUser; vars.i++) {
			// we need to cache it, because current user is likely going to be deleted
			address nextUser = _contractsCache.sortedTroves.getPrev(assetVars._asset, vars.user);

			vars.ICR = getCurrentICR(assetVars._asset, vars.user, assetVars._price);

			if (!vars.backToNormalMode) {
				// Break the loop if ICR is greater than MCR and Stability Pool is empty
				if (vars.ICR >= vestaParams.MCR(_asset) && vars.remainingVSTInStabPool == 0) {
					break;
				}

				uint256 TCR = VestaMath._computeCR(
					vars.entireSystemColl,
					vars.entireSystemDebt,
					assetVars._price
				);

				singleLiquidation = _liquidateRecoveryMode(
					assetVars._asset,
					_contractsCache.activePool,
					_contractsCache.defaultPool,
					vars.user,
					vars.ICR,
					vars.remainingVSTInStabPool,
					TCR,
					assetVars._price
				);

				// Update aggregate trackers
				vars.remainingVSTInStabPool = vars.remainingVSTInStabPool.sub(
					singleLiquidation.debtToOffset
				);
				vars.entireSystemDebt = vars.entireSystemDebt.sub(singleLiquidation.debtToOffset);
				vars.entireSystemColl = vars
					.entireSystemColl
					.sub(singleLiquidation.collToSendToSP)
					.sub(singleLiquidation.collGasCompensation)
					.sub(singleLiquidation.collSurplus);

				// Add liquidation values to their respective running totals
				totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

				vars.backToNormalMode = !_checkPotentialRecoveryMode(
					_asset,
					vars.entireSystemColl,
					vars.entireSystemDebt,
					assetVars._price
				);
			} else if (vars.backToNormalMode && vars.ICR < vestaParams.MCR(_asset)) {
				singleLiquidation = _liquidateNormalMode(
					assetVars._asset,
					_contractsCache.activePool,
					_contractsCache.defaultPool,
					vars.user,
					vars.remainingVSTInStabPool
				);

				vars.remainingVSTInStabPool = vars.remainingVSTInStabPool.sub(
					singleLiquidation.debtToOffset
				);

				// Add liquidation values to their respective running totals
				totals = _addLiquidationValuesToTotals(totals, singleLiquidation);
			} else break; // break if the loop reaches a Trove with ICR >= MCR

			vars.user = nextUser;
		}
	}

	function _getTotalsFromLiquidateTrovesSequence_NormalMode(
		address _asset,
		IActivePool _activePool,
		IDefaultPool _defaultPool,
		uint256 _price,
		uint256 _VSTInStabPool,
		uint256 _n
	) internal returns (LiquidationTotals memory totals) {
		LocalVariables_LiquidationSequence memory vars;
		LiquidationValues memory singleLiquidation;
		ISortedTroves sortedTrovesCached = sortedTroves;

		vars.remainingVSTInStabPool = _VSTInStabPool;

		for (vars.i = 0; vars.i < _n; vars.i++) {
			vars.user = sortedTrovesCached.getLast(_asset);
			vars.ICR = getCurrentICR(_asset, vars.user, _price);

			if (vars.ICR < vestaParams.MCR(_asset)) {
				singleLiquidation = _liquidateNormalMode(
					_asset,
					_activePool,
					_defaultPool,
					vars.user,
					vars.remainingVSTInStabPool
				);

				vars.remainingVSTInStabPool = vars.remainingVSTInStabPool.sub(
					singleLiquidation.debtToOffset
				);

				// Add liquidation values to their respective running totals
				totals = _addLiquidationValuesToTotals(totals, singleLiquidation);
			} else break; // break if the loop reaches a Trove with ICR >= MCR
		}
	}

	/*
	 * Attempt to liquidate a custom list of troves provided by the caller.
	 */
	function batchLiquidateTroves(address _asset, address[] memory _troveArray) public override {
		require(_troveArray.length != 0, "TroveManager: Calldata address array must not be empty");

		IActivePool activePoolCached = vestaParams.activePool();
		IDefaultPool defaultPoolCached = vestaParams.defaultPool();
		IStabilityPool stabilityPoolCached = stabilityPoolManager.getAssetStabilityPool(_asset);

		LocalVariables_OuterLiquidationFunction memory vars;
		LiquidationTotals memory totals;

		vars.VSTInStabPool = stabilityPoolCached.getTotalVSTDeposits();
		vars.price = vestaParams.priceFeed().fetchPrice(_asset);

		vars.recoveryModeAtStart = _checkRecoveryMode(_asset, vars.price);

		// Perform the appropriate liquidation sequence - tally values and obtain their totals.
		if (vars.recoveryModeAtStart) {
			totals = _getTotalFromBatchLiquidate_RecoveryMode(
				_asset,
				activePoolCached,
				defaultPoolCached,
				vars.price,
				vars.VSTInStabPool,
				_troveArray
			);
		} else {
			//  if !vars.recoveryModeAtStart
			totals = _getTotalsFromBatchLiquidate_NormalMode(
				_asset,
				activePoolCached,
				defaultPoolCached,
				vars.price,
				vars.VSTInStabPool,
				_troveArray
			);
		}

		require(totals.totalDebtInSequence > 0, "TroveManager: nothing to liquidate");

		// Move liquidated ETH and VST to the appropriate pools
		stabilityPoolCached.offset(totals.totalDebtToOffset, totals.totalCollToSendToSP);
		_redistributeDebtAndColl(
			_asset,
			activePoolCached,
			defaultPoolCached,
			totals.totalDebtToRedistribute,
			totals.totalCollToRedistribute
		);
		if (totals.totalCollSurplus > 0) {
			activePoolCached.sendAsset(_asset, address(collSurplusPool), totals.totalCollSurplus);
		}

		// Update system snapshots
		_updateSystemSnapshots_excludeCollRemainder(
			_asset,
			activePoolCached,
			totals.totalCollGasCompensation
		);

		vars.liquidatedDebt = totals.totalDebtInSequence;
		vars.liquidatedColl = totals.totalCollInSequence.sub(totals.totalCollGasCompensation).sub(
			totals.totalCollSurplus
		);
		emit Liquidation(
			_asset,
			vars.liquidatedDebt,
			vars.liquidatedColl,
			totals.totalCollGasCompensation,
			totals.totalVSTGasCompensation
		);

		// Send gas compensation to caller
		_sendGasCompensation(
			_asset,
			activePoolCached,
			msg.sender,
			totals.totalVSTGasCompensation,
			totals.totalCollGasCompensation
		);
	}

	/*
	 * This function is used when the batch liquidation sequence starts during Recovery Mode. However, it
	 * handle the case where the system *leaves* Recovery Mode, part way through the liquidation sequence
	 */
	function _getTotalFromBatchLiquidate_RecoveryMode(
		address _asset,
		IActivePool _activePool,
		IDefaultPool _defaultPool,
		uint256 _price,
		uint256 _VSTInStabPool,
		address[] memory _troveArray
	) internal returns (LiquidationTotals memory totals) {
		LocalVariables_LiquidationSequence memory vars;
		LiquidationValues memory singleLiquidation;

		vars.remainingVSTInStabPool = _VSTInStabPool;
		vars.backToNormalMode = false;
		vars.entireSystemDebt = getEntireSystemDebt(_asset);
		vars.entireSystemColl = getEntireSystemColl(_asset);

		for (vars.i = 0; vars.i < _troveArray.length; vars.i++) {
			vars.user = _troveArray[vars.i];
			// Skip non-active troves
			if (Troves[vars.user][_asset].status != Status.active) {
				continue;
			}

			vars.ICR = getCurrentICR(_asset, vars.user, _price);

			if (!vars.backToNormalMode) {
				// Skip this trove if ICR is greater than MCR and Stability Pool is empty
				if (vars.ICR >= vestaParams.MCR(_asset) && vars.remainingVSTInStabPool == 0) {
					continue;
				}

				uint256 TCR = VestaMath._computeCR(
					vars.entireSystemColl,
					vars.entireSystemDebt,
					_price
				);

				singleLiquidation = _liquidateRecoveryMode(
					_asset,
					_activePool,
					_defaultPool,
					vars.user,
					vars.ICR,
					vars.remainingVSTInStabPool,
					TCR,
					_price
				);

				// Update aggregate trackers
				vars.remainingVSTInStabPool = vars.remainingVSTInStabPool.sub(
					singleLiquidation.debtToOffset
				);
				vars.entireSystemDebt = vars.entireSystemDebt.sub(singleLiquidation.debtToOffset);
				vars.entireSystemColl = vars
					.entireSystemColl
					.sub(singleLiquidation.collToSendToSP)
					.sub(singleLiquidation.collGasCompensation)
					.sub(singleLiquidation.collSurplus);

				// Add liquidation values to their respective running totals
				totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

				vars.backToNormalMode = !_checkPotentialRecoveryMode(
					_asset,
					vars.entireSystemColl,
					vars.entireSystemDebt,
					_price
				);
			} else if (vars.backToNormalMode && vars.ICR < vestaParams.MCR(_asset)) {
				singleLiquidation = _liquidateNormalMode(
					_asset,
					_activePool,
					_defaultPool,
					vars.user,
					vars.remainingVSTInStabPool
				);
				vars.remainingVSTInStabPool = vars.remainingVSTInStabPool.sub(
					singleLiquidation.debtToOffset
				);

				// Add liquidation values to their respective running totals
				totals = _addLiquidationValuesToTotals(totals, singleLiquidation);
			} else continue; // In Normal Mode skip troves with ICR >= MCR
		}
	}

	function _getTotalsFromBatchLiquidate_NormalMode(
		address _asset,
		IActivePool _activePool,
		IDefaultPool _defaultPool,
		uint256 _price,
		uint256 _VSTInStabPool,
		address[] memory _troveArray
	) internal returns (LiquidationTotals memory totals) {
		LocalVariables_LiquidationSequence memory vars;
		LiquidationValues memory singleLiquidation;

		vars.remainingVSTInStabPool = _VSTInStabPool;

		for (vars.i = 0; vars.i < _troveArray.length; vars.i++) {
			vars.user = _troveArray[vars.i];
			vars.ICR = getCurrentICR(_asset, vars.user, _price);

			if (vars.ICR < vestaParams.MCR(_asset)) {
				singleLiquidation = _liquidateNormalMode(
					_asset,
					_activePool,
					_defaultPool,
					vars.user,
					vars.remainingVSTInStabPool
				);
				vars.remainingVSTInStabPool = vars.remainingVSTInStabPool.sub(
					singleLiquidation.debtToOffset
				);

				// Add liquidation values to their respective running totals
				totals = _addLiquidationValuesToTotals(totals, singleLiquidation);
			}
		}
	}

	// --- Liquidation helper functions ---

	function _addLiquidationValuesToTotals(
		LiquidationTotals memory oldTotals,
		LiquidationValues memory singleLiquidation
	) internal pure returns (LiquidationTotals memory newTotals) {
		// Tally all the values with their respective running totals
		newTotals.totalCollGasCompensation = oldTotals.totalCollGasCompensation.add(
			singleLiquidation.collGasCompensation
		);
		newTotals.totalVSTGasCompensation = oldTotals.totalVSTGasCompensation.add(
			singleLiquidation.VSTGasCompensation
		);
		newTotals.totalDebtInSequence = oldTotals.totalDebtInSequence.add(
			singleLiquidation.entireTroveDebt
		);
		newTotals.totalCollInSequence = oldTotals.totalCollInSequence.add(
			singleLiquidation.entireTroveColl
		);
		newTotals.totalDebtToOffset = oldTotals.totalDebtToOffset.add(
			singleLiquidation.debtToOffset
		);
		newTotals.totalCollToSendToSP = oldTotals.totalCollToSendToSP.add(
			singleLiquidation.collToSendToSP
		);
		newTotals.totalDebtToRedistribute = oldTotals.totalDebtToRedistribute.add(
			singleLiquidation.debtToRedistribute
		);
		newTotals.totalCollToRedistribute = oldTotals.totalCollToRedistribute.add(
			singleLiquidation.collToRedistribute
		);
		newTotals.totalCollSurplus = oldTotals.totalCollSurplus.add(singleLiquidation.collSurplus);

		return newTotals;
	}

	function _sendGasCompensation(
		address _asset,
		IActivePool _activePool,
		address _liquidator,
		uint256 _VST,
		uint256 _ETH
	) internal {
		if (_VST > 0) {
			vstToken.returnFromPool(gasPoolAddress, _liquidator, _VST);
		}

		if (_ETH > 0) {
			_activePool.sendAsset(_asset, _liquidator, _ETH);
		}
	}

	// Move a Trove's pending debt and collateral rewards from distributions, from the Default Pool to the Active Pool
	function _movePendingTroveRewardsToActivePool(
		address _asset,
		IActivePool _activePool,
		IDefaultPool _defaultPool,
		uint256 _VST,
		uint256 _amount
	) internal {
		_defaultPool.decreaseVSTDebt(_asset, _VST);
		_activePool.increaseVSTDebt(_asset, _VST);
		_defaultPool.sendAssetToActivePool(_asset, _amount);
	}

	// --- Redemption functions ---

	// Redeem as much collateral as possible from _borrower's Trove in exchange for VST up to _maxVSTamount
	function _redeemCollateralFromTrove(
		address _asset,
		ContractsCache memory _contractsCache,
		address _borrower,
		uint256 _maxVSTamount,
		uint256 _price,
		address _upperPartialRedemptionHint,
		address _lowerPartialRedemptionHint,
		uint256 _partialRedemptionHintNICR
	) internal returns (SingleRedemptionValues memory singleRedemption) {
		LocalVariables_AssetBorrowerPrice memory vars = LocalVariables_AssetBorrowerPrice(
			_asset,
			_borrower,
			_price
		);

		// Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the Trove minus the liquidation reserve
		singleRedemption.VSTLot = VestaMath._min(
			_maxVSTamount,
			Troves[vars._borrower][vars._asset].debt.sub(vestaParams.VST_GAS_COMPENSATION(_asset))
		);

		// Get the ETHLot of equivalent value in USD
		singleRedemption.ETHLot = singleRedemption.VSTLot.mul(DECIMAL_PRECISION).div(_price);

		// Decrease the debt and collateral of the current Trove according to the VST lot and corresponding ETH to send
		uint256 newDebt = (Troves[vars._borrower][vars._asset].debt).sub(singleRedemption.VSTLot);
		uint256 newColl = (Troves[vars._borrower][vars._asset].coll).sub(singleRedemption.ETHLot);

		if (newDebt == vestaParams.VST_GAS_COMPENSATION(_asset)) {
			// No debt left in the Trove (except for the liquidation reserve), therefore the trove gets closed
			_removeStake(vars._asset, vars._borrower);
			_closeTrove(vars._asset, vars._borrower, Status.closedByRedemption);
			_redeemCloseTrove(
				vars._asset,
				_contractsCache,
				vars._borrower,
				vestaParams.VST_GAS_COMPENSATION(vars._asset),
				newColl
			);
			emit TroveUpdated(
				vars._asset,
				vars._borrower,
				0,
				0,
				0,
				TroveManagerOperation.redeemCollateral
			);
		} else {
			uint256 newNICR = VestaMath._computeNominalCR(newColl, newDebt);

			/*
			 * If the provided hint is out of date, we bail since trying to reinsert without a good hint will almost
			 * certainly result in running out of gas.
			 *
			 * If the resultant net debt of the partial is less than the minimum, net debt we bail.
			 */
			if (
				newNICR != _partialRedemptionHintNICR ||
				_getNetDebt(vars._asset, newDebt) < vestaParams.MIN_NET_DEBT(vars._asset)
			) {
				singleRedemption.cancelledPartial = true;
				return singleRedemption;
			}

			_contractsCache.sortedTroves.reInsert(
				vars._asset,
				vars._borrower,
				newNICR,
				_upperPartialRedemptionHint,
				_lowerPartialRedemptionHint
			);

			Troves[vars._borrower][vars._asset].debt = newDebt;
			Troves[vars._borrower][vars._asset].coll = newColl;
			_updateStakeAndTotalStakes(vars._asset, vars._borrower);

			emit TroveUpdated(
				vars._asset,
				vars._borrower,
				newDebt,
				newColl,
				Troves[vars._borrower][vars._asset].stake,
				TroveManagerOperation.redeemCollateral
			);
		}

		return singleRedemption;
	}

	/*
	 * Called when a full redemption occurs, and closes the trove.
	 * The redeemer swaps (debt - liquidation reserve) VST for (debt - liquidation reserve) worth of ETH, so the VST liquidation reserve left corresponds to the remaining debt.
	 * In order to close the trove, the VST liquidation reserve is burned, and the corresponding debt is removed from the active pool.
	 * The debt recorded on the trove's struct is zero'd elswhere, in _closeTrove.
	 * Any surplus ETH left in the trove, is sent to the Coll surplus pool, and can be later claimed by the borrower.
	 */
	function _redeemCloseTrove(
		address _asset,
		ContractsCache memory _contractsCache,
		address _borrower,
		uint256 _VST,
		uint256 _ETH
	) internal {
		_contractsCache.vstToken.burn(gasPoolAddress, _VST);
		// Update Active Pool VST, and send ETH to account
		_contractsCache.activePool.decreaseVSTDebt(_asset, _VST);

		// send ETH from Active Pool to CollSurplus Pool
		_contractsCache.collSurplusPool.accountSurplus(_asset, _borrower, _ETH);
		_contractsCache.activePool.sendAsset(
			_asset,
			address(_contractsCache.collSurplusPool),
			_ETH
		);
	}

	function _isValidFirstRedemptionHint(
		address _asset,
		ISortedTroves _sortedTroves,
		address _firstRedemptionHint,
		uint256 _price
	) internal view returns (bool) {
		if (
			_firstRedemptionHint == address(0) ||
			!_sortedTroves.contains(_asset, _firstRedemptionHint) ||
			getCurrentICR(_asset, _firstRedemptionHint, _price) < vestaParams.MCR(_asset)
		) {
			return false;
		}

		address nextTrove = _sortedTroves.getNext(_asset, _firstRedemptionHint);
		return
			nextTrove == address(0) ||
			getCurrentICR(_asset, nextTrove, _price) < vestaParams.MCR(_asset);
	}

	/* Send _VSTamount VST to the system and redeem the corresponding amount of collateral from as many Troves as are needed to fill the redemption
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
	 * redemption will stop after the last completely redeemed Trove and the sender will keep the remaining VST amount, which they can attempt
	 * to redeem later.
	 */
	function redeemCollateral(
		address _asset,
		uint256 _VSTamount,
		address _firstRedemptionHint,
		address _upperPartialRedemptionHint,
		address _lowerPartialRedemptionHint,
		uint256 _partialRedemptionHintNICR,
		uint256 _maxIterations,
		uint256 _maxFeePercentage
	) external override {
		require(
			block.timestamp >= vestaParams.redemptionBlock(_asset),
			"TroveManager: Redemption is blocked"
		);

		ContractsCache memory contractsCache = ContractsCache(
			vestaParams.activePool(),
			vestaParams.defaultPool(),
			vstToken,
			vstaStaking,
			sortedTroves,
			collSurplusPool,
			gasPoolAddress
		);
		RedemptionTotals memory totals;

		_requireValidMaxFeePercentage(_asset, _maxFeePercentage);
		totals.price = vestaParams.priceFeed().fetchPrice(_asset);
		_requireTCRoverMCR(_asset, totals.price);
		_requireAmountGreaterThanZero(_VSTamount);
		_requireVSTBalanceCoversRedemption(contractsCache.vstToken, msg.sender, _VSTamount);

		totals.totalVSTSupplyAtStart = getEntireSystemDebt(_asset);
		totals.remainingVST = _VSTamount;
		address currentBorrower;

		if (
			_isValidFirstRedemptionHint(
				_asset,
				contractsCache.sortedTroves,
				_firstRedemptionHint,
				totals.price
			)
		) {
			currentBorrower = _firstRedemptionHint;
		} else {
			currentBorrower = contractsCache.sortedTroves.getLast(_asset);
			// Find the first trove with ICR >= MCR
			while (
				currentBorrower != address(0) &&
				getCurrentICR(_asset, currentBorrower, totals.price) < vestaParams.MCR(_asset)
			) {
				currentBorrower = contractsCache.sortedTroves.getPrev(_asset, currentBorrower);
			}
		}

		// Loop through the Troves starting from the one with lowest collateral ratio until _amount of VST is exchanged for collateral
		if (_maxIterations == 0) {
			_maxIterations = type(uint256).max;
		}
		while (currentBorrower != address(0) && totals.remainingVST > 0 && _maxIterations > 0) {
			_maxIterations--;
			// Save the address of the Trove preceding the current one, before potentially modifying the list
			address nextUserToCheck = contractsCache.sortedTroves.getPrev(_asset, currentBorrower);

			_applyPendingRewards(
				_asset,
				contractsCache.activePool,
				contractsCache.defaultPool,
				currentBorrower
			);

			SingleRedemptionValues memory singleRedemption = _redeemCollateralFromTrove(
				_asset,
				contractsCache,
				currentBorrower,
				totals.remainingVST,
				totals.price,
				_upperPartialRedemptionHint,
				_lowerPartialRedemptionHint,
				_partialRedemptionHintNICR
			);

			if (singleRedemption.cancelledPartial) break; // Partial redemption was cancelled (out-of-date hint, or new net debt < minimum), therefore we could not redeem from the last Trove

			totals.totalVSTToRedeem = totals.totalVSTToRedeem.add(singleRedemption.VSTLot);
			totals.totalAssetDrawn = totals.totalAssetDrawn.add(singleRedemption.ETHLot);

			totals.remainingVST = totals.remainingVST.sub(singleRedemption.VSTLot);
			currentBorrower = nextUserToCheck;
		}
		require(totals.totalAssetDrawn > 0, "TroveManager: Unable to redeem any amount");

		// Decay the baseRate due to time passed, and then increase it according to the size of this redemption.
		// Use the saved total VST supply value, from before it was reduced by the redemption.
		_updateBaseRateFromRedemption(
			_asset,
			totals.totalAssetDrawn,
			totals.price,
			totals.totalVSTSupplyAtStart
		);

		// Calculate the ETH fee
		totals.ETHFee = _getRedemptionFee(_asset, totals.totalAssetDrawn);

		_requireUserAcceptsFee(totals.ETHFee, totals.totalAssetDrawn, _maxFeePercentage);

		// Send the ETH fee to the VSTA staking contract
		contractsCache.activePool.sendAsset(
			_asset,
			address(contractsCache.vstaStaking),
			totals.ETHFee
		);
		contractsCache.vstaStaking.increaseF_Asset(_asset, totals.ETHFee);

		totals.ETHToSendToRedeemer = totals.totalAssetDrawn.sub(totals.ETHFee);

		emit Redemption(
			_asset,
			_VSTamount,
			totals.totalVSTToRedeem,
			totals.totalAssetDrawn,
			totals.ETHFee
		);

		// Burn the total VST that is cancelled with debt, and send the redeemed ETH to msg.sender
		contractsCache.vstToken.burn(msg.sender, totals.totalVSTToRedeem);
		// Update Active Pool VST, and send ETH to account
		contractsCache.activePool.decreaseVSTDebt(_asset, totals.totalVSTToRedeem);
		contractsCache.activePool.sendAsset(_asset, msg.sender, totals.ETHToSendToRedeemer);
	}

	// --- Helper functions ---

	// Return the nominal collateral ratio (ICR) of a given Trove, without the price. Takes a trove's pending coll and debt rewards from redistributions into account.
	function getNominalICR(address _asset, address _borrower)
		public
		view
		override
		returns (uint256)
	{
		(uint256 currentAsset, uint256 currentVSTDebt) = _getCurrentTroveAmounts(
			_asset,
			_borrower
		);

		uint256 NICR = VestaMath._computeNominalCR(currentAsset, currentVSTDebt);
		return NICR;
	}

	// Return the current collateral ratio (ICR) of a given Trove. Takes a trove's pending coll and debt rewards from redistributions into account.
	function getCurrentICR(
		address _asset,
		address _borrower,
		uint256 _price
	) public view override returns (uint256) {
		(uint256 currentAsset, uint256 currentVSTDebt) = _getCurrentTroveAmounts(
			_asset,
			_borrower
		);

		uint256 ICR = VestaMath._computeCR(currentAsset, currentVSTDebt, _price);
		return ICR;
	}

	function _getCurrentTroveAmounts(address _asset, address _borrower)
		internal
		view
		returns (uint256, uint256)
	{
		uint256 pendingAssetReward = getPendingAssetReward(_asset, _borrower);
		uint256 pendingVSTDebtReward = getPendingVSTDebtReward(_asset, _borrower);

		uint256 currentAsset = Troves[_borrower][_asset].coll.add(pendingAssetReward);
		uint256 currentVSTDebt = Troves[_borrower][_asset].debt.add(pendingVSTDebtReward);

		return (currentAsset, currentVSTDebt);
	}

	function applyPendingRewards(address _asset, address _borrower)
		external
		override
		onlyBorrowerOperations
	{
		return
			_applyPendingRewards(
				_asset,
				vestaParams.activePool(),
				vestaParams.defaultPool(),
				_borrower
			);
	}

	// Add the borrowers's coll and debt rewards earned from redistributions, to their Trove
	function _applyPendingRewards(
		address _asset,
		IActivePool _activePool,
		IDefaultPool _defaultPool,
		address _borrower
	) internal {
		if (!hasPendingRewards(_asset, _borrower)) {
			return;
		}

		assert(isTroveActive(_asset, _borrower));

		// Compute pending rewards
		uint256 pendingAssetReward = getPendingAssetReward(_asset, _borrower);
		uint256 pendingVSTDebtReward = getPendingVSTDebtReward(_asset, _borrower);

		// Apply pending rewards to trove's state
		Troves[_borrower][_asset].coll = Troves[_borrower][_asset].coll.add(pendingAssetReward);
		Troves[_borrower][_asset].debt = Troves[_borrower][_asset].debt.add(pendingVSTDebtReward);

		_updateTroveRewardSnapshots(_asset, _borrower);

		// Transfer from DefaultPool to ActivePool
		_movePendingTroveRewardsToActivePool(
			_asset,
			_activePool,
			_defaultPool,
			pendingVSTDebtReward,
			pendingAssetReward
		);

		emit TroveUpdated(
			_asset,
			_borrower,
			Troves[_borrower][_asset].debt,
			Troves[_borrower][_asset].coll,
			Troves[_borrower][_asset].stake,
			TroveManagerOperation.applyPendingRewards
		);
	}

	// Update borrower's snapshots of L_ETH and L_VSTDebt to reflect the current values
	function updateTroveRewardSnapshots(address _asset, address _borrower)
		external
		override
		onlyBorrowerOperations
	{
		return _updateTroveRewardSnapshots(_asset, _borrower);
	}

	function _updateTroveRewardSnapshots(address _asset, address _borrower) internal {
		rewardSnapshots[_borrower][_asset].asset = L_ASSETS[_asset];
		rewardSnapshots[_borrower][_asset].VSTDebt = L_VSTDebts[_asset];
		emit TroveSnapshotsUpdated(_asset, L_ASSETS[_asset], L_VSTDebts[_asset]);
	}

	// Get the borrower's pending accumulated ETH reward, earned by their stake
	function getPendingAssetReward(address _asset, address _borrower)
		public
		view
		override
		returns (uint256)
	{
		uint256 snapshotAsset = rewardSnapshots[_borrower][_asset].asset;
		uint256 rewardPerUnitStaked = L_ASSETS[_asset].sub(snapshotAsset);

		if (rewardPerUnitStaked == 0 || !isTroveActive(_asset, _borrower)) {
			return 0;
		}

		uint256 stake = Troves[_borrower][_asset].stake;

		uint256 pendingAssetReward = stake.mul(rewardPerUnitStaked).div(DECIMAL_PRECISION);

		return pendingAssetReward;
	}

	// Get the borrower's pending accumulated VST reward, earned by their stake
	function getPendingVSTDebtReward(address _asset, address _borrower)
		public
		view
		override
		returns (uint256)
	{
		uint256 snapshotVSTDebt = rewardSnapshots[_borrower][_asset].VSTDebt;
		uint256 rewardPerUnitStaked = L_VSTDebts[_asset].sub(snapshotVSTDebt);

		if (rewardPerUnitStaked == 0 || !isTroveActive(_asset, _borrower)) {
			return 0;
		}

		uint256 stake = Troves[_borrower][_asset].stake;

		uint256 pendingVSTDebtReward = stake.mul(rewardPerUnitStaked).div(DECIMAL_PRECISION);

		return pendingVSTDebtReward;
	}

	function hasPendingRewards(address _asset, address _borrower)
		public
		view
		override
		returns (bool)
	{
		if (!isTroveActive(_asset, _borrower)) {
			return false;
		}

		return (rewardSnapshots[_borrower][_asset].asset < L_ASSETS[_asset]);
	}

	function getEntireDebtAndColl(address _asset, address _borrower)
		public
		view
		override
		returns (
			uint256 debt,
			uint256 coll,
			uint256 pendingVSTDebtReward,
			uint256 pendingAssetReward
		)
	{
		debt = Troves[_borrower][_asset].debt;
		coll = Troves[_borrower][_asset].coll;

		pendingVSTDebtReward = getPendingVSTDebtReward(_asset, _borrower);
		pendingAssetReward = getPendingAssetReward(_asset, _borrower);

		debt = debt.add(pendingVSTDebtReward);
		coll = coll.add(pendingAssetReward);
	}

	function removeStake(address _asset, address _borrower)
		external
		override
		onlyBorrowerOperations
	{
		return _removeStake(_asset, _borrower);
	}

	function _removeStake(address _asset, address _borrower) internal {
		uint256 stake = Troves[_borrower][_asset].stake;
		totalStakes[_asset] = totalStakes[_asset].sub(stake);
		Troves[_borrower][_asset].stake = 0;
	}

	function updateStakeAndTotalStakes(address _asset, address _borrower)
		external
		override
		onlyBorrowerOperations
		returns (uint256)
	{
		return _updateStakeAndTotalStakes(_asset, _borrower);
	}

	// Update borrower's stake based on their latest collateral value
	function _updateStakeAndTotalStakes(address _asset, address _borrower)
		internal
		returns (uint256)
	{
		uint256 newStake = _computeNewStake(_asset, Troves[_borrower][_asset].coll);
		uint256 oldStake = Troves[_borrower][_asset].stake;
		Troves[_borrower][_asset].stake = newStake;

		totalStakes[_asset] = totalStakes[_asset].sub(oldStake).add(newStake);
		emit TotalStakesUpdated(_asset, totalStakes[_asset]);

		return newStake;
	}

	// Calculate a new stake based on the snapshots of the totalStakes and totalCollateral taken at the last liquidation
	function _computeNewStake(address _asset, uint256 _coll) internal view returns (uint256) {
		uint256 stake;
		if (totalCollateralSnapshot[_asset] == 0) {
			stake = _coll;
		} else {
			/*
			 * The following assert() holds true because:
			 * - The system always contains >= 1 trove
			 * - When we close or liquidate a trove, we redistribute the pending rewards, so if all troves were closed/liquidated,
			 * rewards would’ve been emptied and totalCollateralSnapshot would be zero too.
			 */
			assert(totalStakesSnapshot[_asset] > 0);
			stake = _coll.mul(totalStakesSnapshot[_asset]).div(totalCollateralSnapshot[_asset]);
		}
		return stake;
	}

	function _redistributeDebtAndColl(
		address _asset,
		IActivePool _activePool,
		IDefaultPool _defaultPool,
		uint256 _debt,
		uint256 _coll
	) internal {
		if (_debt == 0) {
			return;
		}

		/*
		 * Add distributed coll and debt rewards-per-unit-staked to the running totals. Division uses a "feedback"
		 * error correction, to keep the cumulative error low in the running totals L_ETH and L_VSTDebt:
		 *
		 * 1) Form numerators which compensate for the floor division errors that occurred the last time this
		 * function was called.
		 * 2) Calculate "per-unit-staked" ratios.
		 * 3) Multiply each ratio back by its denominator, to reveal the current floor division error.
		 * 4) Store these errors for use in the next correction when this function is called.
		 * 5) Note: static analysis tools complain about this "division before multiplication", however, it is intended.
		 */
		uint256 ETHNumerator = _coll.mul(DECIMAL_PRECISION).add(
			lastETHError_Redistribution[_asset]
		);
		uint256 VSTDebtNumerator = _debt.mul(DECIMAL_PRECISION).add(
			lastVSTDebtError_Redistribution[_asset]
		);

		// Get the per-unit-staked terms
		uint256 ETHRewardPerUnitStaked = ETHNumerator.div(totalStakes[_asset]);
		uint256 VSTDebtRewardPerUnitStaked = VSTDebtNumerator.div(totalStakes[_asset]);

		lastETHError_Redistribution[_asset] = ETHNumerator.sub(
			ETHRewardPerUnitStaked.mul(totalStakes[_asset])
		);
		lastVSTDebtError_Redistribution[_asset] = VSTDebtNumerator.sub(
			VSTDebtRewardPerUnitStaked.mul(totalStakes[_asset])
		);

		// Add per-unit-staked terms to the running totals
		L_ASSETS[_asset] = L_ASSETS[_asset].add(ETHRewardPerUnitStaked);
		L_VSTDebts[_asset] = L_VSTDebts[_asset].add(VSTDebtRewardPerUnitStaked);

		emit LTermsUpdated(_asset, L_ASSETS[_asset], L_VSTDebts[_asset]);

		_activePool.decreaseVSTDebt(_asset, _debt);
		_defaultPool.increaseVSTDebt(_asset, _debt);
		_activePool.sendAsset(_asset, address(_defaultPool), _coll);
	}

	function closeTrove(address _asset, address _borrower)
		external
		override
		onlyBorrowerOperations
	{
		return _closeTrove(_asset, _borrower, Status.closedByOwner);
	}

	function _closeTrove(
		address _asset,
		address _borrower,
		Status closedStatus
	) internal {
		assert(closedStatus != Status.nonExistent && closedStatus != Status.active);

		uint256 TroveOwnersArrayLength = TroveOwners[_asset].length;
		_requireMoreThanOneTroveInSystem(_asset, TroveOwnersArrayLength);

		Troves[_borrower][_asset].status = closedStatus;
		Troves[_borrower][_asset].coll = 0;
		Troves[_borrower][_asset].debt = 0;

		rewardSnapshots[_borrower][_asset].asset = 0;
		rewardSnapshots[_borrower][_asset].VSTDebt = 0;

		_removeTroveOwner(_asset, _borrower, TroveOwnersArrayLength);
		sortedTroves.remove(_asset, _borrower);
	}

	function _updateSystemSnapshots_excludeCollRemainder(
		address _asset,
		IActivePool _activePool,
		uint256 _collRemainder
	) internal {
		totalStakesSnapshot[_asset] = totalStakes[_asset];

		uint256 activeColl = _activePool.getAssetBalance(_asset);
		uint256 liquidatedColl = vestaParams.defaultPool().getAssetBalance(_asset);
		totalCollateralSnapshot[_asset] = activeColl.sub(_collRemainder).add(liquidatedColl);

		emit SystemSnapshotsUpdated(
			_asset,
			totalStakesSnapshot[_asset],
			totalCollateralSnapshot[_asset]
		);
	}

	function addTroveOwnerToArray(address _asset, address _borrower)
		external
		override
		onlyBorrowerOperations
		returns (uint256 index)
	{
		return _addTroveOwnerToArray(_asset, _borrower);
	}

	function _addTroveOwnerToArray(address _asset, address _borrower)
		internal
		returns (uint128 index)
	{
		TroveOwners[_asset].push(_borrower);

		index = uint128(TroveOwners[_asset].length.sub(1));
		Troves[_borrower][_asset].arrayIndex = index;

		return index;
	}

	function _removeTroveOwner(
		address _asset,
		address _borrower,
		uint256 TroveOwnersArrayLength
	) internal {
		Status troveStatus = Troves[_borrower][_asset].status;
		assert(troveStatus != Status.nonExistent && troveStatus != Status.active);

		uint128 index = Troves[_borrower][_asset].arrayIndex;
		uint256 length = TroveOwnersArrayLength;
		uint256 idxLast = length.sub(1);

		assert(index <= idxLast);

		address addressToMove = TroveOwners[_asset][idxLast];

		TroveOwners[_asset][index] = addressToMove;
		Troves[addressToMove][_asset].arrayIndex = index;
		emit TroveIndexUpdated(_asset, addressToMove, index);

		TroveOwners[_asset].pop();
	}

	function getTCR(address _asset, uint256 _price) external view override returns (uint256) {
		return _getTCR(_asset, _price);
	}

	function checkRecoveryMode(address _asset, uint256 _price)
		external
		view
		override
		returns (bool)
	{
		return _checkRecoveryMode(_asset, _price);
	}

	function _checkPotentialRecoveryMode(
		address _asset,
		uint256 _entireSystemColl,
		uint256 _entireSystemDebt,
		uint256 _price
	) internal view returns (bool) {
		uint256 TCR = VestaMath._computeCR(_entireSystemColl, _entireSystemDebt, _price);

		return TCR < vestaParams.CCR(_asset);
	}

	function _updateBaseRateFromRedemption(
		address _asset,
		uint256 _ETHDrawn,
		uint256 _price,
		uint256 _totalVSTSupply
	) internal returns (uint256) {
		uint256 decayedBaseRate = _calcDecayedBaseRate(_asset);

		uint256 redeemedVSTFraction = _ETHDrawn.mul(_price).div(_totalVSTSupply);

		uint256 newBaseRate = decayedBaseRate.add(redeemedVSTFraction.div(BETA));
		newBaseRate = VestaMath._min(newBaseRate, DECIMAL_PRECISION);
		assert(newBaseRate > 0);

		baseRate[_asset] = newBaseRate;
		emit BaseRateUpdated(_asset, newBaseRate);

		_updateLastFeeOpTime(_asset);

		return newBaseRate;
	}

	function getRedemptionRate(address _asset) public view override returns (uint256) {
		return _calcRedemptionRate(_asset, baseRate[_asset]);
	}

	function getRedemptionRateWithDecay(address _asset) public view override returns (uint256) {
		return _calcRedemptionRate(_asset, _calcDecayedBaseRate(_asset));
	}

	function _calcRedemptionRate(address _asset, uint256 _baseRate)
		internal
		view
		returns (uint256)
	{
		return
			VestaMath._min(
				vestaParams.REDEMPTION_FEE_FLOOR(_asset).add(_baseRate),
				DECIMAL_PRECISION
			);
	}

	function _getRedemptionFee(address _asset, uint256 _assetDraw)
		internal
		view
		returns (uint256)
	{
		return _calcRedemptionFee(getRedemptionRate(_asset), _assetDraw);
	}

	function getRedemptionFeeWithDecay(address _asset, uint256 _assetDraw)
		external
		view
		override
		returns (uint256)
	{
		return _calcRedemptionFee(getRedemptionRateWithDecay(_asset), _assetDraw);
	}

	function _calcRedemptionFee(uint256 _redemptionRate, uint256 _assetDraw)
		internal
		pure
		returns (uint256)
	{
		uint256 redemptionFee = _redemptionRate.mul(_assetDraw).div(DECIMAL_PRECISION);
		require(
			redemptionFee < _assetDraw,
			"TroveManager: Fee would eat up all returned collateral"
		);
		return redemptionFee;
	}

	function getBorrowingRate(address _asset) public view override returns (uint256) {
		return _calcBorrowingRate(_asset, baseRate[_asset]);
	}

	function getBorrowingRateWithDecay(address _asset) public view override returns (uint256) {
		return _calcBorrowingRate(_asset, _calcDecayedBaseRate(_asset));
	}

	function _calcBorrowingRate(address _asset, uint256 _baseRate)
		internal
		view
		returns (uint256)
	{
		return
			VestaMath._min(
				vestaParams.BORROWING_FEE_FLOOR(_asset).add(_baseRate),
				vestaParams.MAX_BORROWING_FEE(_asset)
			);
	}

	function getBorrowingFee(address _asset, uint256 _VSTDebt)
		external
		view
		override
		returns (uint256)
	{
		return _calcBorrowingFee(getBorrowingRate(_asset), _VSTDebt);
	}

	function getBorrowingFeeWithDecay(address _asset, uint256 _VSTDebt)
		external
		view
		override
		returns (uint256)
	{
		return _calcBorrowingFee(getBorrowingRateWithDecay(_asset), _VSTDebt);
	}

	function _calcBorrowingFee(uint256 _borrowingRate, uint256 _VSTDebt)
		internal
		pure
		returns (uint256)
	{
		return _borrowingRate.mul(_VSTDebt).div(DECIMAL_PRECISION);
	}

	function decayBaseRateFromBorrowing(address _asset)
		external
		override
		onlyBorrowerOperations
	{
		uint256 decayedBaseRate = _calcDecayedBaseRate(_asset);
		assert(decayedBaseRate <= DECIMAL_PRECISION);

		baseRate[_asset] = decayedBaseRate;
		emit BaseRateUpdated(_asset, decayedBaseRate);

		_updateLastFeeOpTime(_asset);
	}

	// Update the last fee operation time only if time passed >= decay interval. This prevents base rate griefing.
	function _updateLastFeeOpTime(address _asset) internal {
		uint256 timePassed = block.timestamp.sub(lastFeeOperationTime[_asset]);

		if (timePassed >= SECONDS_IN_ONE_MINUTE) {
			lastFeeOperationTime[_asset] = block.timestamp;
			emit LastFeeOpTimeUpdated(_asset, block.timestamp);
		}
	}

	function _calcDecayedBaseRate(address _asset) internal view returns (uint256) {
		uint256 minutesPassed = _minutesPassedSinceLastFeeOp(_asset);
		uint256 decayFactor = VestaMath._decPow(MINUTE_DECAY_FACTOR, minutesPassed);

		return baseRate[_asset].mul(decayFactor).div(DECIMAL_PRECISION);
	}

	function _minutesPassedSinceLastFeeOp(address _asset) internal view returns (uint256) {
		return (block.timestamp.sub(lastFeeOperationTime[_asset])).div(SECONDS_IN_ONE_MINUTE);
	}

	function _requireVSTBalanceCoversRedemption(
		IVSTToken _vstToken,
		address _redeemer,
		uint256 _amount
	) internal view {
		require(
			_vstToken.balanceOf(_redeemer) >= _amount,
			"TroveManager: Requested redemption amount must be <= user's VST token balance"
		);
	}

	function _requireMoreThanOneTroveInSystem(address _asset, uint256 TroveOwnersArrayLength)
		internal
		view
	{
		require(
			TroveOwnersArrayLength > 1 && sortedTroves.getSize(_asset) > 1,
			"TroveManager: Only one trove in the system"
		);
	}

	function _requireAmountGreaterThanZero(uint256 _amount) internal pure {
		require(_amount > 0, "TroveManager: Amount must be greater than zero");
	}

	function _requireTCRoverMCR(address _asset, uint256 _price) internal view {
		require(
			_getTCR(_asset, _price) >= vestaParams.MCR(_asset),
			"TroveManager: Cannot redeem when TCR < MCR"
		);
	}

	function _requireValidMaxFeePercentage(address _asset, uint256 _maxFeePercentage)
		internal
		view
	{
		require(
			_maxFeePercentage >= vestaParams.REDEMPTION_FEE_FLOOR(_asset) &&
				_maxFeePercentage <= DECIMAL_PRECISION,
			"Max fee percentage must be between 0.5% and 100%"
		);
	}

	function isTroveActive(address _asset, address _borrower) internal view returns (bool) {
		return this.getTroveStatus(_asset, _borrower) == uint256(Status.active);
	}

	// --- Trove property getters ---

	function getTroveStatus(address _asset, address _borrower)
		external
		view
		override
		returns (uint256)
	{
		return uint256(Troves[_borrower][_asset].status);
	}

	function getTroveStake(address _asset, address _borrower)
		external
		view
		override
		returns (uint256)
	{
		return Troves[_borrower][_asset].stake;
	}

	function getTroveDebt(address _asset, address _borrower)
		external
		view
		override
		returns (uint256)
	{
		return Troves[_borrower][_asset].debt;
	}

	function getTroveColl(address _asset, address _borrower)
		external
		view
		override
		returns (uint256)
	{
		return Troves[_borrower][_asset].coll;
	}

	// --- Trove property setters, called by BorrowerOperations ---

	function setTroveStatus(
		address _asset,
		address _borrower,
		uint256 _num
	) external override onlyBorrowerOperations {
		Troves[_borrower][_asset].asset = _asset;
		Troves[_borrower][_asset].status = Status(_num);
	}

	function increaseTroveColl(
		address _asset,
		address _borrower,
		uint256 _collIncrease
	) external override onlyBorrowerOperations returns (uint256) {
		uint256 newColl = Troves[_borrower][_asset].coll.add(_collIncrease);
		Troves[_borrower][_asset].coll = newColl;
		return newColl;
	}

	function decreaseTroveColl(
		address _asset,
		address _borrower,
		uint256 _collDecrease
	) external override onlyBorrowerOperations returns (uint256) {
		uint256 newColl = Troves[_borrower][_asset].coll.sub(_collDecrease);
		Troves[_borrower][_asset].coll = newColl;
		return newColl;
	}

	function increaseTroveDebt(
		address _asset,
		address _borrower,
		uint256 _debtIncrease
	) external override onlyBorrowerOperations returns (uint256) {
		uint256 newDebt = Troves[_borrower][_asset].debt.add(_debtIncrease);
		Troves[_borrower][_asset].debt = newDebt;
		return newDebt;
	}

	function decreaseTroveDebt(
		address _asset,
		address _borrower,
		uint256 _debtDecrease
	) external override onlyBorrowerOperations returns (uint256) {
		uint256 newDebt = Troves[_borrower][_asset].debt.sub(_debtDecrease);
		Troves[_borrower][_asset].debt = newDebt;
		return newDebt;
	}
}
