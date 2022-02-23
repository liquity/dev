// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IVSTToken.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/IVSTAStaking.sol";
import "./Interfaces/IStabilityPoolManager.sol";
import "./Dependencies/VestaBase.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/SafetyTransfer.sol";

contract BorrowerOperations is VestaBase, CheckContract, IBorrowerOperations {
	using SafeMathUpgradeable for uint256;
	using SafeERC20Upgradeable for IERC20Upgradeable;

	string public constant NAME = "BorrowerOperations";

	// --- Connected contract declarations ---

	ITroveManager public troveManager;

	IStabilityPoolManager stabilityPoolManager;

	address gasPoolAddress;

	ICollSurplusPool collSurplusPool;

	IVSTAStaking public VSTAStaking;
	address public VSTAStakingAddress;

	IVSTToken public VSTToken;

	// A doubly linked list of Troves, sorted by their collateral ratios
	ISortedTroves public sortedTroves;

	bool public isInitialized;

	/* --- Variable container structs  ---

    Used to hold, return and assign variables inside a function, in order to avoid the error:
    "CompilerError: Stack too deep". */

	struct LocalVariables_adjustTrove {
		address asset;
		uint256 price;
		uint256 collChange;
		uint256 netDebtChange;
		bool isCollIncrease;
		uint256 debt;
		uint256 coll;
		uint256 oldICR;
		uint256 newICR;
		uint256 newTCR;
		uint256 VSTFee;
		uint256 newDebt;
		uint256 newColl;
		uint256 stake;
	}

	struct LocalVariables_openTrove {
		address asset;
		uint256 price;
		uint256 VSTFee;
		uint256 netDebt;
		uint256 compositeDebt;
		uint256 ICR;
		uint256 NICR;
		uint256 stake;
		uint256 arrayIndex;
	}

	struct ContractsCache {
		ITroveManager troveManager;
		IActivePool activePool;
		IVSTToken VSTToken;
	}

	enum BorrowerOperation {
		openTrove,
		closeTrove,
		adjustTrove
	}

	event TroveUpdated(
		address indexed _asset,
		address indexed _borrower,
		uint256 _debt,
		uint256 _coll,
		uint256 stake,
		BorrowerOperation operation
	);

	// --- Dependency setters ---

	function setAddresses(
		address _troveManagerAddress,
		address _stabilityPoolManagerAddress,
		address _gasPoolAddress,
		address _collSurplusPoolAddress,
		address _sortedTrovesAddress,
		address _vstTokenAddress,
		address _VSTAStakingAddress,
		address _vestaParamsAddress
	) external override initializer {
		require(!isInitialized, "Already initialized");
		checkContract(_troveManagerAddress);
		checkContract(_stabilityPoolManagerAddress);
		checkContract(_gasPoolAddress);
		checkContract(_collSurplusPoolAddress);
		checkContract(_sortedTrovesAddress);
		checkContract(_vstTokenAddress);
		checkContract(_VSTAStakingAddress);
		checkContract(_vestaParamsAddress);
		isInitialized = true;

		__Ownable_init();

		troveManager = ITroveManager(_troveManagerAddress);
		stabilityPoolManager = IStabilityPoolManager(_stabilityPoolManagerAddress);
		gasPoolAddress = _gasPoolAddress;
		collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
		sortedTroves = ISortedTroves(_sortedTrovesAddress);
		VSTToken = IVSTToken(_vstTokenAddress);
		VSTAStakingAddress = _VSTAStakingAddress;
		VSTAStaking = IVSTAStaking(_VSTAStakingAddress);

		setVestaParameters(_vestaParamsAddress);

		emit TroveManagerAddressChanged(_troveManagerAddress);
		emit StabilityPoolAddressChanged(_stabilityPoolManagerAddress);
		emit GasPoolAddressChanged(_gasPoolAddress);
		emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
		emit SortedTrovesAddressChanged(_sortedTrovesAddress);
		emit VSTTokenAddressChanged(_vstTokenAddress);
		emit VSTAStakingAddressChanged(_VSTAStakingAddress);
	}

	// --- Borrower Trove Operations ---

	function openTrove(
		address _asset,
		uint256 _tokenAmount,
		uint256 _maxFeePercentage,
		uint256 _VSTAmount,
		address _upperHint,
		address _lowerHint
	) external payable override {
		vestaParams.sanitizeParameters(_asset);

		ContractsCache memory contractsCache = ContractsCache(
			troveManager,
			vestaParams.activePool(),
			VSTToken
		);
		LocalVariables_openTrove memory vars;
		vars.asset = _asset;

		_tokenAmount = getMethodValue(vars.asset, _tokenAmount, false);
		vars.price = vestaParams.priceFeed().fetchPrice(vars.asset);
		bool isRecoveryMode = _checkRecoveryMode(vars.asset, vars.price);

		_requireValidMaxFeePercentage(vars.asset, _maxFeePercentage, isRecoveryMode);
		_requireTroveisNotActive(vars.asset, contractsCache.troveManager, msg.sender);

		vars.VSTFee;
		vars.netDebt = _VSTAmount;

		if (!isRecoveryMode) {
			vars.VSTFee = _triggerBorrowingFee(
				vars.asset,
				contractsCache.troveManager,
				contractsCache.VSTToken,
				_VSTAmount,
				_maxFeePercentage
			);
			vars.netDebt = vars.netDebt.add(vars.VSTFee);
		}
		_requireAtLeastMinNetDebt(vars.asset, vars.netDebt);

		// ICR is based on the composite debt, i.e. the requested VST amount + VST borrowing fee + VST gas comp.
		vars.compositeDebt = _getCompositeDebt(vars.asset, vars.netDebt);
		assert(vars.compositeDebt > 0);

		vars.ICR = VestaMath._computeCR(_tokenAmount, vars.compositeDebt, vars.price);
		vars.NICR = VestaMath._computeNominalCR(_tokenAmount, vars.compositeDebt);

		if (isRecoveryMode) {
			_requireICRisAboveCCR(vars.asset, vars.ICR);
		} else {
			_requireICRisAboveMCR(vars.asset, vars.ICR);
			uint256 newTCR = _getNewTCRFromTroveChange(
				vars.asset,
				_tokenAmount,
				true,
				vars.compositeDebt,
				true,
				vars.price
			); // bools: coll increase, debt increase
			_requireNewTCRisAboveCCR(vars.asset, newTCR);
		}

		// Set the trove struct's properties
		contractsCache.troveManager.setTroveStatus(vars.asset, msg.sender, 1);
		contractsCache.troveManager.increaseTroveColl(vars.asset, msg.sender, _tokenAmount);
		contractsCache.troveManager.increaseTroveDebt(vars.asset, msg.sender, vars.compositeDebt);

		contractsCache.troveManager.updateTroveRewardSnapshots(vars.asset, msg.sender);
		vars.stake = contractsCache.troveManager.updateStakeAndTotalStakes(vars.asset, msg.sender);

		sortedTroves.insert(vars.asset, msg.sender, vars.NICR, _upperHint, _lowerHint);
		vars.arrayIndex = contractsCache.troveManager.addTroveOwnerToArray(vars.asset, msg.sender);
		emit TroveCreated(vars.asset, msg.sender, vars.arrayIndex);

		// Move the ether to the Active Pool, and mint the VSTAmount to the borrower
		_activePoolAddColl(vars.asset, contractsCache.activePool, _tokenAmount);
		_withdrawVST(
			vars.asset,
			contractsCache.activePool,
			contractsCache.VSTToken,
			msg.sender,
			_VSTAmount,
			vars.netDebt
		);
		// Move the VST gas compensation to the Gas Pool
		_withdrawVST(
			vars.asset,
			contractsCache.activePool,
			contractsCache.VSTToken,
			gasPoolAddress,
			vestaParams.VST_GAS_COMPENSATION(vars.asset),
			vestaParams.VST_GAS_COMPENSATION(vars.asset)
		);

		emit TroveUpdated(
			vars.asset,
			msg.sender,
			vars.compositeDebt,
			_tokenAmount,
			vars.stake,
			BorrowerOperation.openTrove
		);
		emit VSTBorrowingFeePaid(vars.asset, msg.sender, vars.VSTFee);
	}

	// Send ETH as collateral to a trove
	function addColl(
		address _asset,
		uint256 _assetSent,
		address _upperHint,
		address _lowerHint
	) external payable override {
		_adjustTrove(
			_asset,
			getMethodValue(_asset, _assetSent, false),
			msg.sender,
			0,
			0,
			false,
			_upperHint,
			_lowerHint,
			0
		);
	}

	// Send ETH as collateral to a trove. Called by only the Stability Pool.
	function moveETHGainToTrove(
		address _asset,
		uint256 _amountMoved,
		address _borrower,
		address _upperHint,
		address _lowerHint
	) external payable override {
		_requireCallerIsStabilityPool();
		_adjustTrove(
			_asset,
			getMethodValue(_asset, _amountMoved, false),
			_borrower,
			0,
			0,
			false,
			_upperHint,
			_lowerHint,
			0
		);
	}

	// Withdraw ETH collateral from a trove
	function withdrawColl(
		address _asset,
		uint256 _collWithdrawal,
		address _upperHint,
		address _lowerHint
	) external override {
		_adjustTrove(_asset, 0, msg.sender, _collWithdrawal, 0, false, _upperHint, _lowerHint, 0);
	}

	// Withdraw VST tokens from a trove: mint new VST tokens to the owner, and increase the trove's debt accordingly
	function withdrawVST(
		address _asset,
		uint256 _maxFeePercentage,
		uint256 _VSTAmount,
		address _upperHint,
		address _lowerHint
	) external override {
		_adjustTrove(
			_asset,
			0,
			msg.sender,
			0,
			_VSTAmount,
			true,
			_upperHint,
			_lowerHint,
			_maxFeePercentage
		);
	}

	// Repay VST tokens to a Trove: Burn the repaid VST tokens, and reduce the trove's debt accordingly
	function repayVST(
		address _asset,
		uint256 _VSTAmount,
		address _upperHint,
		address _lowerHint
	) external override {
		_adjustTrove(_asset, 0, msg.sender, 0, _VSTAmount, false, _upperHint, _lowerHint, 0);
	}

	function adjustTrove(
		address _asset,
		uint256 _assetSent,
		uint256 _maxFeePercentage,
		uint256 _collWithdrawal,
		uint256 _VSTChange,
		bool _isDebtIncrease,
		address _upperHint,
		address _lowerHint
	) external payable override {
		_adjustTrove(
			_asset,
			getMethodValue(_asset, _assetSent, true),
			msg.sender,
			_collWithdrawal,
			_VSTChange,
			_isDebtIncrease,
			_upperHint,
			_lowerHint,
			_maxFeePercentage
		);
	}

	/*
	 * _adjustTrove(): Alongside a debt change, this function can perform either a collateral top-up or a collateral withdrawal.
	 *
	 * It therefore expects either a positive msg.value, or a positive _collWithdrawal argument.
	 *
	 * If both are positive, it will revert.
	 */
	function _adjustTrove(
		address _asset,
		uint256 _assetSent,
		address _borrower,
		uint256 _collWithdrawal,
		uint256 _VSTChange,
		bool _isDebtIncrease,
		address _upperHint,
		address _lowerHint,
		uint256 _maxFeePercentage
	) internal {
		ContractsCache memory contractsCache = ContractsCache(
			troveManager,
			vestaParams.activePool(),
			VSTToken
		);
		LocalVariables_adjustTrove memory vars;
		vars.asset = _asset;

		require(
			msg.value == 0 || msg.value == _assetSent,
			"BorrowerOp: _AssetSent and Msg.value aren't the same!"
		);

		vars.price = vestaParams.priceFeed().fetchPrice(vars.asset);
		bool isRecoveryMode = _checkRecoveryMode(vars.asset, vars.price);

		if (_isDebtIncrease) {
			_requireValidMaxFeePercentage(vars.asset, _maxFeePercentage, isRecoveryMode);
			_requireNonZeroDebtChange(_VSTChange);
		}
		_requireSingularCollChange(_collWithdrawal, _assetSent);
		_requireNonZeroAdjustment(_collWithdrawal, _VSTChange, _assetSent);
		_requireTroveisActive(vars.asset, contractsCache.troveManager, _borrower);

		// Confirm the operation is either a borrower adjusting their own trove, or a pure ETH transfer from the Stability Pool to a trove
		assert(
			msg.sender == _borrower ||
				(stabilityPoolManager.isStabilityPool(msg.sender) && _assetSent > 0 && _VSTChange == 0)
		);

		contractsCache.troveManager.applyPendingRewards(vars.asset, _borrower);

		// Get the collChange based on whether or not ETH was sent in the transaction
		(vars.collChange, vars.isCollIncrease) = _getCollChange(_assetSent, _collWithdrawal);

		vars.netDebtChange = _VSTChange;

		// If the adjustment incorporates a debt increase and system is in Normal Mode, then trigger a borrowing fee
		if (_isDebtIncrease && !isRecoveryMode) {
			vars.VSTFee = _triggerBorrowingFee(
				vars.asset,
				contractsCache.troveManager,
				contractsCache.VSTToken,
				_VSTChange,
				_maxFeePercentage
			);
			vars.netDebtChange = vars.netDebtChange.add(vars.VSTFee); // The raw debt change includes the fee
		}

		vars.debt = contractsCache.troveManager.getTroveDebt(vars.asset, _borrower);
		vars.coll = contractsCache.troveManager.getTroveColl(vars.asset, _borrower);

		// Get the trove's old ICR before the adjustment, and what its new ICR will be after the adjustment
		vars.oldICR = VestaMath._computeCR(vars.coll, vars.debt, vars.price);
		vars.newICR = _getNewICRFromTroveChange(
			vars.coll,
			vars.debt,
			vars.collChange,
			vars.isCollIncrease,
			vars.netDebtChange,
			_isDebtIncrease,
			vars.price
		);
		require(
			_collWithdrawal <= vars.coll,
			"BorrowerOp: Trying to remove more than the trove holds"
		);

		// Check the adjustment satisfies all conditions for the current system mode
		_requireValidAdjustmentInCurrentMode(
			vars.asset,
			isRecoveryMode,
			_collWithdrawal,
			_isDebtIncrease,
			vars
		);

		// When the adjustment is a debt repayment, check it's a valid amount and that the caller has enough VST
		if (!_isDebtIncrease && _VSTChange > 0) {
			_requireAtLeastMinNetDebt(
				vars.asset,
				_getNetDebt(vars.asset, vars.debt).sub(vars.netDebtChange)
			);
			_requireValidVSTRepayment(vars.asset, vars.debt, vars.netDebtChange);
			_requireSufficientVSTBalance(contractsCache.VSTToken, _borrower, vars.netDebtChange);
		}

		(vars.newColl, vars.newDebt) = _updateTroveFromAdjustment(
			vars.asset,
			contractsCache.troveManager,
			_borrower,
			vars.collChange,
			vars.isCollIncrease,
			vars.netDebtChange,
			_isDebtIncrease
		);
		vars.stake = contractsCache.troveManager.updateStakeAndTotalStakes(vars.asset, _borrower);

		// Re-insert trove in to the sorted list
		uint256 newNICR = _getNewNominalICRFromTroveChange(
			vars.coll,
			vars.debt,
			vars.collChange,
			vars.isCollIncrease,
			vars.netDebtChange,
			_isDebtIncrease
		);
		sortedTroves.reInsert(vars.asset, _borrower, newNICR, _upperHint, _lowerHint);

		emit TroveUpdated(
			vars.asset,
			_borrower,
			vars.newDebt,
			vars.newColl,
			vars.stake,
			BorrowerOperation.adjustTrove
		);
		emit VSTBorrowingFeePaid(vars.asset, msg.sender, vars.VSTFee);

		// Use the unmodified _VSTChange here, as we don't send the fee to the user
		_moveTokensAndETHfromAdjustment(
			vars.asset,
			contractsCache.activePool,
			contractsCache.VSTToken,
			msg.sender,
			vars.collChange,
			vars.isCollIncrease,
			_VSTChange,
			_isDebtIncrease,
			vars.netDebtChange
		);
	}

	function closeTrove(address _asset) external override {
		ITroveManager troveManagerCached = troveManager;
		IActivePool activePoolCached = vestaParams.activePool();
		IVSTToken VSTTokenCached = VSTToken;

		_requireTroveisActive(_asset, troveManagerCached, msg.sender);
		uint256 price = vestaParams.priceFeed().fetchPrice(_asset);
		_requireNotInRecoveryMode(_asset, price);

		troveManagerCached.applyPendingRewards(_asset, msg.sender);

		uint256 coll = troveManagerCached.getTroveColl(_asset, msg.sender);
		uint256 debt = troveManagerCached.getTroveDebt(_asset, msg.sender);

		_requireSufficientVSTBalance(
			VSTTokenCached,
			msg.sender,
			debt.sub(vestaParams.VST_GAS_COMPENSATION(_asset))
		);

		uint256 newTCR = _getNewTCRFromTroveChange(_asset, coll, false, debt, false, price);
		_requireNewTCRisAboveCCR(_asset, newTCR);

		troveManagerCached.removeStake(_asset, msg.sender);
		troveManagerCached.closeTrove(_asset, msg.sender);

		emit TroveUpdated(_asset, msg.sender, 0, 0, 0, BorrowerOperation.closeTrove);

		// Burn the repaid VST from the user's balance and the gas compensation from the Gas Pool
		_repayVST(
			_asset,
			activePoolCached,
			VSTTokenCached,
			msg.sender,
			debt.sub(vestaParams.VST_GAS_COMPENSATION(_asset))
		);
		_repayVST(
			_asset,
			activePoolCached,
			VSTTokenCached,
			gasPoolAddress,
			vestaParams.VST_GAS_COMPENSATION(_asset)
		);

		// Send the collateral back to the user
		activePoolCached.sendAsset(_asset, msg.sender, coll);
	}

	/**
	 * Claim remaining collateral from a redemption or from a liquidation with ICR > MCR in Recovery Mode
	 */
	function claimCollateral(address _asset) external override {
		// send ETH from CollSurplus Pool to owner
		collSurplusPool.claimColl(_asset, msg.sender);
	}

	// --- Helper functions ---

	function _triggerBorrowingFee(
		address _asset,
		ITroveManager _troveManager,
		IVSTToken _VSTToken,
		uint256 _VSTAmount,
		uint256 _maxFeePercentage
	) internal returns (uint256) {
		_troveManager.decayBaseRateFromBorrowing(_asset); // decay the baseRate state variable
		uint256 VSTFee = _troveManager.getBorrowingFee(_asset, _VSTAmount);

		_requireUserAcceptsFee(VSTFee, _VSTAmount, _maxFeePercentage);

		// Send fee to VSTA staking contract
		_VSTToken.mint(_asset, VSTAStakingAddress, VSTFee);
		VSTAStaking.increaseF_VST(VSTFee);

		return VSTFee;
	}

	function _getUSDValue(uint256 _coll, uint256 _price) internal pure returns (uint256) {
		uint256 usdValue = _price.mul(_coll).div(DECIMAL_PRECISION);

		return usdValue;
	}

	function _getCollChange(uint256 _collReceived, uint256 _requestedCollWithdrawal)
		internal
		pure
		returns (uint256 collChange, bool isCollIncrease)
	{
		if (_collReceived != 0) {
			collChange = _collReceived;
			isCollIncrease = true;
		} else {
			collChange = _requestedCollWithdrawal;
		}
	}

	// Update trove's coll and debt based on whether they increase or decrease
	function _updateTroveFromAdjustment(
		address _asset,
		ITroveManager _troveManager,
		address _borrower,
		uint256 _collChange,
		bool _isCollIncrease,
		uint256 _debtChange,
		bool _isDebtIncrease
	) internal returns (uint256, uint256) {
		uint256 newColl = (_isCollIncrease)
			? _troveManager.increaseTroveColl(_asset, _borrower, _collChange)
			: _troveManager.decreaseTroveColl(_asset, _borrower, _collChange);
		uint256 newDebt = (_isDebtIncrease)
			? _troveManager.increaseTroveDebt(_asset, _borrower, _debtChange)
			: _troveManager.decreaseTroveDebt(_asset, _borrower, _debtChange);

		return (newColl, newDebt);
	}

	function _moveTokensAndETHfromAdjustment(
		address _asset,
		IActivePool _activePool,
		IVSTToken _VSTToken,
		address _borrower,
		uint256 _collChange,
		bool _isCollIncrease,
		uint256 _VSTChange,
		bool _isDebtIncrease,
		uint256 _netDebtChange
	) internal {
		if (_isDebtIncrease) {
			_withdrawVST(_asset, _activePool, _VSTToken, _borrower, _VSTChange, _netDebtChange);
		} else {
			_repayVST(_asset, _activePool, _VSTToken, _borrower, _VSTChange);
		}

		if (_isCollIncrease) {
			_activePoolAddColl(_asset, _activePool, _collChange);
		} else {
			_activePool.sendAsset(_asset, _borrower, _collChange);
		}
	}

	// Send ETH to Active Pool and increase its recorded ETH balance
	function _activePoolAddColl(
		address _asset,
		IActivePool _activePool,
		uint256 _amount
	) internal {
		if (_asset == ETH_REF_ADDRESS) {
			(bool success, ) = address(_activePool).call{ value: _amount }("");
			require(success, "BorrowerOps: Sending ETH to ActivePool failed");
		} else {
			IERC20Upgradeable(_asset).safeTransferFrom(
				msg.sender,
				address(_activePool),
				SafetyTransfer.decimalsCorrection(_asset, _amount)
			);

			_activePool.receivedERC20(_asset, _amount);
		}
	}

	// Issue the specified amount of VST to _account and increases the total active debt (_netDebtIncrease potentially includes a VSTFee)
	function _withdrawVST(
		address _asset,
		IActivePool _activePool,
		IVSTToken _VSTToken,
		address _account,
		uint256 _VSTAmount,
		uint256 _netDebtIncrease
	) internal {
		_activePool.increaseVSTDebt(_asset, _netDebtIncrease);
		_VSTToken.mint(_asset, _account, _VSTAmount);
	}

	// Burn the specified amount of VST from _account and decreases the total active debt
	function _repayVST(
		address _asset,
		IActivePool _activePool,
		IVSTToken _VSTToken,
		address _account,
		uint256 _VST
	) internal {
		_activePool.decreaseVSTDebt(_asset, _VST);
		_VSTToken.burn(_account, _VST);
	}

	// --- 'Require' wrapper functions ---

	function _requireSingularCollChange(uint256 _collWithdrawal, uint256 _amountSent)
		internal
		view
	{
		require(
			_collWithdrawal == 0 || _amountSent == 0,
			"BorrowerOperations: Cannot withdraw and add coll"
		);
	}

	function _requireCallerIsBorrower(address _borrower) internal view {
		require(
			msg.sender == _borrower,
			"BorrowerOps: Caller must be the borrower for a withdrawal"
		);
	}

	function _requireNonZeroAdjustment(
		uint256 _collWithdrawal,
		uint256 _VSTChange,
		uint256 _assetSent
	) internal view {
		require(
			msg.value != 0 || _collWithdrawal != 0 || _VSTChange != 0 || _assetSent != 0,
			"BorrowerOps: There must be either a collateral change or a debt change"
		);
	}

	function _requireTroveisActive(
		address _asset,
		ITroveManager _troveManager,
		address _borrower
	) internal view {
		uint256 status = _troveManager.getTroveStatus(_asset, _borrower);
		require(status == 1, "BorrowerOps: Trove does not exist or is closed");
	}

	function _requireTroveisNotActive(
		address _asset,
		ITroveManager _troveManager,
		address _borrower
	) internal view {
		uint256 status = _troveManager.getTroveStatus(_asset, _borrower);
		require(status != 1, "BorrowerOps: Trove is active");
	}

	function _requireNonZeroDebtChange(uint256 _VSTChange) internal pure {
		require(_VSTChange > 0, "BorrowerOps: Debt increase requires non-zero debtChange");
	}

	function _requireNotInRecoveryMode(address _asset, uint256 _price) internal view {
		require(
			!_checkRecoveryMode(_asset, _price),
			"BorrowerOps: Operation not permitted during Recovery Mode"
		);
	}

	function _requireNoCollWithdrawal(uint256 _collWithdrawal) internal pure {
		require(
			_collWithdrawal == 0,
			"BorrowerOps: Collateral withdrawal not permitted Recovery Mode"
		);
	}

	function _requireValidAdjustmentInCurrentMode(
		address _asset,
		bool _isRecoveryMode,
		uint256 _collWithdrawal,
		bool _isDebtIncrease,
		LocalVariables_adjustTrove memory _vars
	) internal view {
		/*
		 *In Recovery Mode, only allow:
		 *
		 * - Pure collateral top-up
		 * - Pure debt repayment
		 * - Collateral top-up with debt repayment
		 * - A debt increase combined with a collateral top-up which makes the ICR >= 150% and improves the ICR (and by extension improves the TCR).
		 *
		 * In Normal Mode, ensure:
		 *
		 * - The new ICR is above MCR
		 * - The adjustment won't pull the TCR below CCR
		 */
		if (_isRecoveryMode) {
			_requireNoCollWithdrawal(_collWithdrawal);
			if (_isDebtIncrease) {
				_requireICRisAboveCCR(_asset, _vars.newICR);
				_requireNewICRisAboveOldICR(_vars.newICR, _vars.oldICR);
			}
		} else {
			// if Normal Mode
			_requireICRisAboveMCR(_asset, _vars.newICR);
			_vars.newTCR = _getNewTCRFromTroveChange(
				_asset,
				_vars.collChange,
				_vars.isCollIncrease,
				_vars.netDebtChange,
				_isDebtIncrease,
				_vars.price
			);
			_requireNewTCRisAboveCCR(_asset, _vars.newTCR);
		}
	}

	function _requireICRisAboveMCR(address _asset, uint256 _newICR) internal view {
		require(
			_newICR >= vestaParams.MCR(_asset),
			"BorrowerOps: An operation that would result in ICR < MCR is not permitted"
		);
	}

	function _requireICRisAboveCCR(address _asset, uint256 _newICR) internal view {
		require(
			_newICR >= vestaParams.CCR(_asset),
			"BorrowerOps: Operation must leave trove with ICR >= CCR"
		);
	}

	function _requireNewICRisAboveOldICR(uint256 _newICR, uint256 _oldICR) internal pure {
		require(
			_newICR >= _oldICR,
			"BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode"
		);
	}

	function _requireNewTCRisAboveCCR(address _asset, uint256 _newTCR) internal view {
		require(
			_newTCR >= vestaParams.CCR(_asset),
			"BorrowerOps: An operation that would result in TCR < CCR is not permitted"
		);
	}

	function _requireAtLeastMinNetDebt(address _asset, uint256 _netDebt) internal view {
		require(
			_netDebt >= vestaParams.MIN_NET_DEBT(_asset),
			"BorrowerOps: Trove's net debt must be greater than minimum"
		);
	}

	function _requireValidVSTRepayment(
		address _asset,
		uint256 _currentDebt,
		uint256 _debtRepayment
	) internal view {
		require(
			_debtRepayment <= _currentDebt.sub(vestaParams.VST_GAS_COMPENSATION(_asset)),
			"BorrowerOps: Amount repaid must not be larger than the Trove's debt"
		);
	}

	function _requireCallerIsStabilityPool() internal view {
		require(
			stabilityPoolManager.isStabilityPool(msg.sender),
			"BorrowerOps: Caller is not Stability Pool"
		);
	}

	function _requireSufficientVSTBalance(
		IVSTToken _VSTToken,
		address _borrower,
		uint256 _debtRepayment
	) internal view {
		require(
			_VSTToken.balanceOf(_borrower) >= _debtRepayment,
			"BorrowerOps: Caller doesnt have enough VST to make repayment"
		);
	}

	function _requireValidMaxFeePercentage(
		address _asset,
		uint256 _maxFeePercentage,
		bool _isRecoveryMode
	) internal view {
		if (_isRecoveryMode) {
			require(
				_maxFeePercentage <= vestaParams.DECIMAL_PRECISION(),
				"Max fee percentage must less than or equal to 100%"
			);
		} else {
			require(
				_maxFeePercentage >= vestaParams.BORROWING_FEE_FLOOR(_asset) &&
					_maxFeePercentage <= vestaParams.DECIMAL_PRECISION(),
				"Max fee percentage must be between 0.5% and 100%"
			);
		}
	}

	// --- ICR and TCR getters ---

	// Compute the new collateral ratio, considering the change in coll and debt. Assumes 0 pending rewards.
	function _getNewNominalICRFromTroveChange(
		uint256 _coll,
		uint256 _debt,
		uint256 _collChange,
		bool _isCollIncrease,
		uint256 _debtChange,
		bool _isDebtIncrease
	) internal pure returns (uint256) {
		(uint256 newColl, uint256 newDebt) = _getNewTroveAmounts(
			_coll,
			_debt,
			_collChange,
			_isCollIncrease,
			_debtChange,
			_isDebtIncrease
		);

		uint256 newNICR = VestaMath._computeNominalCR(newColl, newDebt);
		return newNICR;
	}

	// Compute the new collateral ratio, considering the change in coll and debt. Assumes 0 pending rewards.
	function _getNewICRFromTroveChange(
		uint256 _coll,
		uint256 _debt,
		uint256 _collChange,
		bool _isCollIncrease,
		uint256 _debtChange,
		bool _isDebtIncrease,
		uint256 _price
	) internal pure returns (uint256) {
		(uint256 newColl, uint256 newDebt) = _getNewTroveAmounts(
			_coll,
			_debt,
			_collChange,
			_isCollIncrease,
			_debtChange,
			_isDebtIncrease
		);

		uint256 newICR = VestaMath._computeCR(newColl, newDebt, _price);
		return newICR;
	}

	function _getNewTroveAmounts(
		uint256 _coll,
		uint256 _debt,
		uint256 _collChange,
		bool _isCollIncrease,
		uint256 _debtChange,
		bool _isDebtIncrease
	) internal pure returns (uint256, uint256) {
		uint256 newColl = _coll;
		uint256 newDebt = _debt;

		newColl = _isCollIncrease ? _coll.add(_collChange) : _coll.sub(_collChange);
		newDebt = _isDebtIncrease ? _debt.add(_debtChange) : _debt.sub(_debtChange);

		return (newColl, newDebt);
	}

	function _getNewTCRFromTroveChange(
		address _asset,
		uint256 _collChange,
		bool _isCollIncrease,
		uint256 _debtChange,
		bool _isDebtIncrease,
		uint256 _price
	) internal view returns (uint256) {
		uint256 totalColl = getEntireSystemColl(_asset);
		uint256 totalDebt = getEntireSystemDebt(_asset);

		totalColl = _isCollIncrease ? totalColl.add(_collChange) : totalColl.sub(_collChange);
		totalDebt = _isDebtIncrease ? totalDebt.add(_debtChange) : totalDebt.sub(_debtChange);

		uint256 newTCR = VestaMath._computeCR(totalColl, totalDebt, _price);
		return newTCR;
	}

	function getCompositeDebt(address _asset, uint256 _debt)
		external
		view
		override
		returns (uint256)
	{
		return _getCompositeDebt(_asset, _debt);
	}

	function getMethodValue(
		address _asset,
		uint256 _amount,
		bool canBeZero
	) private view returns (uint256) {
		bool isEth = _asset == address(0);

		require(
			(canBeZero || (isEth && msg.value != 0)) || (!isEth && msg.value == 0),
			"BorrowerOp: Invalid Input. Override msg.value only if using ETH asset, otherwise use _tokenAmount"
		);

		if (_asset == address(0)) {
			_amount = msg.value;
		}

		return _amount;
	}
}
