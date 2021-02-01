// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/ILUSDToken.sol";
import "./Interfaces/ICollSurplusPool.sol";
import './Interfaces/ILUSDToken.sol';
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/ILQTYStaking.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";

contract BorrowerOperations is LiquityBase, Ownable, CheckContract, IBorrowerOperations {

    // --- Connected contract declarations ---

    ITroveManager public troveManager;

    address stabilityPoolAddress;

    address gasPoolAddress;

    ICollSurplusPool collSurplusPool;

    ILQTYStaking public lqtyStaking;
    address public lqtyStakingAddress;

    ILUSDToken public lusdToken;

    // A doubly linked list of Troves, sorted by their sorted by their collateral ratios
    ISortedTroves public sortedTroves;

    /* --- Variable container structs  ---

    Used to hold, return and assign variables inside a function, in order to avoid the error:
    "CompilerError: Stack too deep". */

     struct LocalVariables_adjustTrove {
        uint price;
        uint collChange;
        uint rawDebtChange;
        bool isCollIncrease;
        uint debt;
        uint coll;
        uint oldICR;
        uint newICR;
        uint LUSDFee;
        uint newDebt;
        uint newColl;
        uint stake;
    }

    enum BorrowerOperation {
        openTrove,
        closeTrove,
        addColl,
        withdrawColl,
        withdrawLUSD,
        repayLUSD,
        adjustTrove
    }

    event TroveCreated(address indexed _borrower, uint arrayIndex);
    event TroveUpdated(address indexed _borrower, uint _debt, uint _coll, uint stake, BorrowerOperation operation);
    event LUSDBorrowingFeePaid(address indexed _borrower, uint _LUSDFee);

    // --- Dependency setters ---

    function setAddresses(
        address _troveManagerAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
        address _gasPoolAddress,
        address _collSurplusPoolAddress,
        address _priceFeedAddress,
        address _sortedTrovesAddress,
        address _lusdTokenAddress,
        address _lqtyStakingAddress
    )
        external
        override
        onlyOwner
    {
        checkContract(_troveManagerAddress);
        checkContract(_activePoolAddress);
        checkContract(_defaultPoolAddress);
        checkContract(_stabilityPoolAddress);
        checkContract(_gasPoolAddress);
        checkContract(_collSurplusPoolAddress);
        checkContract(_priceFeedAddress);
        checkContract(_sortedTrovesAddress);
        checkContract(_lusdTokenAddress);
        checkContract(_lqtyStakingAddress);

        troveManager = ITroveManager(_troveManagerAddress);
        activePool = IActivePool(_activePoolAddress);
        defaultPool = IDefaultPool(_defaultPoolAddress);
        stabilityPoolAddress = _stabilityPoolAddress;
        gasPoolAddress = _gasPoolAddress;
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        lusdToken = ILUSDToken(_lusdTokenAddress);
        lqtyStakingAddress = _lqtyStakingAddress;
        lqtyStaking = ILQTYStaking(_lqtyStakingAddress);

        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit GasPoolAddressChanged(_gasPoolAddress);
        emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit LUSDTokenAddressChanged(_lusdTokenAddress);
        emit LQTYStakingAddressChanged(_lqtyStakingAddress);

        _renounceOwnership();
    }

    // --- Borrower Trove Operations ---

    function openTrove(uint _maxFeePercentage, uint _LUSDAmount, address _upperHint, address _lowerHint) external payable override {
        if (_LUSDAmount > 0) {_requireValidMaxFeePercentage(_maxFeePercentage);}
        _requireTroveisNotActive(msg.sender);

        uint price = priceFeed.fetchPrice();

        uint LUSDFee;
        uint rawDebt = _LUSDAmount;

        bool isRecoveryMode = _checkRecoveryMode(price);

        if (!isRecoveryMode && _LUSDAmount > 0) {
            LUSDFee = _triggerBorrowingFee(_LUSDAmount, _maxFeePercentage);
            rawDebt = rawDebt.add(LUSDFee);
        }

        // ICR is based on the composite debt, i.e. the requested LUSD amount + LUSD borrowing fee + LUSD gas comp.
        uint compositeDebt = _getCompositeDebt(rawDebt);
        assert(compositeDebt > 0);
        
        uint ICR = LiquityMath._computeCR(msg.value, compositeDebt, price);
        uint NICR = LiquityMath._computeNominalCR(msg.value, compositeDebt);

        if (isRecoveryMode) {
            _requireICRisAboveCCR(ICR);
        } else {
            _requireICRisAboveMCR(ICR);
            uint newTCR = _getNewTCRFromTroveChange(msg.value, true, compositeDebt, true, price);  // bools: coll increase, debt increase
            _requireNewTCRisAboveCCR(newTCR); 
        }

        // Set the trove struct's properties
        troveManager.setTroveStatus(msg.sender, 1);
        troveManager.increaseTroveColl(msg.sender, msg.value);
        troveManager.increaseTroveDebt(msg.sender, compositeDebt);

        troveManager.updateTroveRewardSnapshots(msg.sender);
        uint stake = troveManager.updateStakeAndTotalStakes(msg.sender);

        sortedTroves.insert(msg.sender, NICR, _upperHint, _lowerHint);
        uint arrayIndex = troveManager.addTroveOwnerToArray(msg.sender);
        emit TroveCreated(msg.sender, arrayIndex);

        // Move the ether to the Active Pool, and mint the LUSDAmount to the borrower
        _activePoolAddColl(msg.value);
        if (_LUSDAmount > 0) {_withdrawLUSD(msg.sender, _LUSDAmount, rawDebt);}
        // Move the LUSD gas compensation to the Gas Pool
        _withdrawLUSD(gasPoolAddress, LUSD_GAS_COMPENSATION, LUSD_GAS_COMPENSATION);

        emit TroveUpdated(msg.sender, compositeDebt, msg.value, stake, BorrowerOperation.openTrove);
        emit LUSDBorrowingFeePaid(msg.sender, LUSDFee);
    }

    // Send ETH as collateral to a trove
    function addColl(address _upperHint, address _lowerHint) external payable override {
        _adjustTrove(msg.sender, 0, 0, false, _upperHint, _lowerHint, 0);
    }

    // Send ETH as collateral to a trove. Called by only the Stability Pool.
    function moveETHGainToTrove(address _borrower, address _upperHint, address _lowerHint) external payable override {
        _requireCallerIsStabilityPool();
        _adjustTrove(_borrower, 0, 0, false, _upperHint, _lowerHint, 0);
    }

    // Withdraw ETH collateral from a trove
    function withdrawColl(uint _collWithdrawal, address _upperHint, address _lowerHint) external override {
        _adjustTrove(msg.sender, _collWithdrawal, 0, false, _upperHint, _lowerHint, 0);
    }

    // Withdraw LUSD tokens from a trove: mint new LUSD tokens to the owner, and increase the trove's debt accordingly
    function withdrawLUSD(uint _maxFeePercentage, uint _LUSDAmount, address _upperHint, address _lowerHint) external override {
        _adjustTrove(msg.sender, 0, _LUSDAmount, true, _upperHint, _lowerHint, _maxFeePercentage);
    }

    // Repay LUSD tokens to a Trove: Burn the repaid LUSD tokens, and reduce the trove's debt accordingly
    function repayLUSD(uint _LUSDAmount, address _upperHint, address _lowerHint) external override {
        _adjustTrove(msg.sender, 0, _LUSDAmount, false, _upperHint, _lowerHint, 0);
    }

    function adjustTrove(uint _maxFeePercentage, uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease, address _upperHint, address _lowerHint) external payable override {
        _adjustTrove(msg.sender, _collWithdrawal, _debtChange, _isDebtIncrease, _upperHint, _lowerHint, _maxFeePercentage);
    }

    /*
    * _adjustTrove(): Alongside a debt change, this function can perform either a collateral top-up or a collateral withdrawal. 
    *
    * It therefore expects either a positive msg.value, or a positive _collWithdrawal argument.
    *
    * If both are positive, it will revert.
    */
    function _adjustTrove(address _borrower, uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease, address _upperHint, address _lowerHint, uint _maxFeePercentage) internal {
        if (_isDebtIncrease) {_requireValidMaxFeePercentage(_maxFeePercentage);} 
        _requireSingularCollChange(_collWithdrawal);
        _requireNonZeroAdjustment(_collWithdrawal, _debtChange);
        _requireTroveisActive(_borrower);
        
        /*
        * The adjustment is considered a withdrawal if it removes ETH collateral, and/or issues new LUSD debt. 
        * The caller may make a withdrawal only from their own trove.
        */
        bool isWithdrawal = _collWithdrawal != 0 || _isDebtIncrease; 
        if (isWithdrawal) {_requireCallerIsBorrower(_borrower);}

        LocalVariables_adjustTrove memory vars;

        vars.price = priceFeed.fetchPrice();
        bool isRecoveryMode = _checkRecoveryMode(vars.price);

        troveManager.applyPendingRewards(_borrower);

        // Get the collChange based on whether or not ETH was sent in the transaction
        (vars.collChange, vars.isCollIncrease) = _getCollChange(msg.value, _collWithdrawal);

        vars.rawDebtChange = _debtChange;

        // If the adjustment incorporates a debt increase and system is in Normal Mode, then trigger a borrowing fee
        if (_isDebtIncrease) {
            _requireNonZeroDebtChange(_debtChange);
           
            if (!isRecoveryMode) {
                vars.LUSDFee = _triggerBorrowingFee(_debtChange, _maxFeePercentage);
                vars.rawDebtChange = vars.rawDebtChange.add(vars.LUSDFee); // The raw debt change includes the fee
            }
        }

        vars.debt = troveManager.getTroveDebt(_borrower);
        vars.coll = troveManager.getTroveColl(_borrower);
        
        // Get the trove's old ICR before the adjustment, and what its new ICR will be after the adjustment
        vars.oldICR = LiquityMath._computeCR(vars.coll, vars.debt, vars.price);
        vars.newICR = _getNewICRFromTroveChange(vars.coll, vars.debt, vars.collChange, vars.isCollIncrease, vars.rawDebtChange, _isDebtIncrease, vars.price);

        /*
        * When the adjust is a withdrawal, make sure it is a valid change for the trove's ICR and for the system TCR, given the
        * current system mode.
        */
        if (isWithdrawal) { 
            assert(_collWithdrawal <= vars.coll); 
            uint newTCR = _getNewTCRFromTroveChange(vars.collChange, vars.isCollIncrease, vars.rawDebtChange, _isDebtIncrease, vars.price);
            _requireValidNewICRandValidNewTCR(isRecoveryMode, vars.oldICR, vars.newICR, newTCR);
        }

        // When the adjustment is a debt repayment, check it's a valid amount and that the caller has enough LUSD
        if (!_isDebtIncrease && _debtChange > 0) {
            _requireValidLUSDRepayment(vars.debt, vars.rawDebtChange);
            _requireSufficientLUSDBalance(_borrower, vars.rawDebtChange);
        }

        (vars.newColl, vars.newDebt) = _updateTroveFromAdjustment(_borrower, vars.collChange, vars.isCollIncrease, vars.rawDebtChange, _isDebtIncrease);
        vars.stake = troveManager.updateStakeAndTotalStakes(_borrower);

        // Re-insert trove in to the sorted list
        uint newNICR = _getNewNominalICRFromTroveChange(vars.coll, vars.debt, vars.collChange, vars.isCollIncrease, vars.rawDebtChange, _isDebtIncrease);
        sortedTroves.reInsert(_borrower, newNICR, _upperHint, _lowerHint);

        emit TroveUpdated(_borrower, vars.newDebt, vars.newColl, vars.stake, BorrowerOperation.adjustTrove);
        emit LUSDBorrowingFeePaid(msg.sender,  vars.LUSDFee);

        // Use the unmodified _debtChange here, as we don't send the fee to the user
        _moveTokensAndETHfromAdjustment(msg.sender, vars.collChange, vars.isCollIncrease, _debtChange, _isDebtIncrease, vars.rawDebtChange);
    }

    function closeTrove() external override {
        _requireTroveisActive(msg.sender);
        uint price = priceFeed.fetchPrice();
        _requireNotInRecoveryMode(price);

        troveManager.applyPendingRewards(msg.sender);

        uint coll = troveManager.getTroveColl(msg.sender);
        uint debt = troveManager.getTroveDebt(msg.sender);

        _requireSufficientLUSDBalance(msg.sender, debt.sub(LUSD_GAS_COMPENSATION));

        troveManager.removeStake(msg.sender);
        troveManager.closeTrove(msg.sender);

        emit TroveUpdated(msg.sender, 0, 0, 0, BorrowerOperation.closeTrove);

        // Burn the repaid LUSD from the user's balance and the gas compensation from the Gas Pool
        _repayLUSD(msg.sender, debt.sub(LUSD_GAS_COMPENSATION));
        _repayLUSD(gasPoolAddress, LUSD_GAS_COMPENSATION);

        // Send the collateral back to the user
        activePool.sendETH(msg.sender, coll);
    }

    /**
     * Claim remaining collateral from a redemption or from a liquidation with ICR > MCR in Recovery Mode
     */
    function claimCollateral() external override {
        // send ETH from CollSurplus Pool to owner
        collSurplusPool.claimColl(msg.sender);
    }

    // --- Helper functions ---

    function _triggerBorrowingFee(uint _debtChange, uint _maxFeePercentage) internal returns (uint) {  
        troveManager.decayBaseRateFromBorrowing(); // decay the baseRate state variable
        uint LUSDFee = troveManager.getBorrowingFee(_debtChange);

        _requireUserAcceptsFee(LUSDFee, _debtChange, _maxFeePercentage);
        
        // Send fee to LQTY staking contract
        lqtyStaking.increaseF_LUSD(LUSDFee);
        lusdToken.mint(lqtyStakingAddress, LUSDFee);

        return LUSDFee;
    }

    function _getUSDValue(uint _coll, uint _price) internal pure returns (uint) {
        uint usdValue = _price.mul(_coll).div(DECIMAL_PRECISION);

        return usdValue;
    }

    function _getCollChange(
        uint _collReceived,
        uint _requestedCollWithdrawal
    )
        internal
        pure
        returns(uint collChange, bool isCollIncrease)
    {
        if (_collReceived != 0) {
            collChange = _collReceived;
            isCollIncrease = true;
        } else {
            collChange = _requestedCollWithdrawal;
        }
    }

    // Update trove's coll and debt based on whether they increase or decrease
    function _updateTroveFromAdjustment
    (
        address _borrower,
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease
    )
        internal
        returns (uint, uint)
    {
        uint newColl = (_isCollIncrease) ? troveManager.increaseTroveColl(_borrower, _collChange)
                                        : troveManager.decreaseTroveColl(_borrower, _collChange);
        uint newDebt = (_isDebtIncrease) ? troveManager.increaseTroveDebt(_borrower, _debtChange)
                                        : troveManager.decreaseTroveDebt(_borrower, _debtChange);

        return (newColl, newDebt);
    }

    function _moveTokensAndETHfromAdjustment
    (
        address _borrower,
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease,
        uint _rawDebtChange
    )
        internal
    {
        if (_isDebtIncrease) {
            _withdrawLUSD(_borrower, _debtChange, _rawDebtChange);
        } else {
            _repayLUSD(_borrower, _debtChange);
        }

        if (_isCollIncrease) {
            _activePoolAddColl(_collChange);
        } else {
            activePool.sendETH(_borrower, _collChange);
        }
    }

    // Send ETH to Active Pool and increase its recorded ETH balance
    function _activePoolAddColl(uint _amount) internal {
        (bool success, ) = address(activePool).call{value: _amount}("");
        require(success, "BorrowerOps: Sending ETH to ActivePool failed");
    }

    // Issue the specified amount of LUSD to _account and increases the total active debt (_rawDebtIncrease potentially includes a LUSDFee)
    function _withdrawLUSD(address _account, uint _LUSDAmount, uint _rawDebtIncrease) internal {
        activePool.increaseLUSDDebt(_rawDebtIncrease);
        lusdToken.mint(_account, _LUSDAmount);
    }

    // Burn the specified amount of LUSD from _account and decreases the total active debt
    function _repayLUSD(address _account, uint _LUSD) internal {
        activePool.decreaseLUSDDebt(_LUSD);
        lusdToken.burn(_account, _LUSD);
    }

    // --- 'Require' wrapper functions ---

    function _requireSingularCollChange(uint _collWithdrawal) internal view {
        require(msg.value == 0 || _collWithdrawal == 0, "BorrowerOperations: Cannot withdraw and add coll");
    }

    function _requireCallerIsBorrower(address _borrower) internal view {
        require(msg.sender == _borrower, "BorrowerOps: Caller must be the borrower for a withdrawal");
    }

    function _requireNonZeroAdjustment(uint _collWithdrawal, uint _debtChange) internal view {
        require(msg.value != 0 || _collWithdrawal != 0 || _debtChange != 0, "BorrowerOps: There must be either a collateral change or a debt change");
    }

    function _requireTroveisActive(address _borrower) internal view {
        uint status = troveManager.getTroveStatus(_borrower);
        require(status == 1, "BorrowerOps: Trove does not exist or is closed");
    }

    function _requireTroveisNotActive(address _borrower) internal view {
        uint status = troveManager.getTroveStatus(_borrower);
        require(status != 1, "BorrowerOps: Trove is active");
    }

    function _requireNonZeroDebtChange(uint _debtChange) internal pure {
        require(_debtChange > 0, "BorrowerOps: Debt increase requires non-zero debtChange");
    }
   
    function _requireNotInRecoveryMode(uint _price) internal view {
        require(!_checkRecoveryMode(_price), "BorrowerOps: Operation not permitted during Recovery Mode");
    }

    function _requireValidNewICRandValidNewTCR(bool _isRecoveryMode, uint _oldICR, uint _newICR, uint _newTCR) internal pure {
        _requireICRisAboveMCR(_newICR);

        if (!_isRecoveryMode) {
            // When the system is in Normal Mode, check that this operation would not push the system into Recovery Mode
            _requireNewTCRisAboveCCR(_newTCR);
        } else {
            // When the system is in Recovery Mode, check that this operation would not worsen the trove's ICR (and by extension, would not worsen the TCR)
            _requireNewICRisAboveOldICR(_newICR, _oldICR);
        }  
    }

    function _requireICRisAboveMCR(uint _newICR) internal pure {
        require(_newICR >= MCR, "BorrowerOps: An operation that would result in ICR < MCR is not permitted");
    }

    function _requireICRisAboveCCR(uint _newICR) internal pure {
        require(_newICR >= CCR, "BorrowerOps: In Recovery Mode new troves must have ICR >= CCR");
    }

    function _requireNewICRisAboveOldICR(uint _newICR, uint _oldICR) internal pure {
        require(_newICR >= _oldICR, "BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode");
    }

    function _requireNewTCRisAboveCCR(uint _newTCR) internal pure {
        require(_newTCR >= CCR, "BorrowerOps: An operation that would result in TCR < CCR is not permitted");
    }

    function _requireValidCollWithdrawal(uint _collWithdrawal, uint _troveColl) internal pure {
        require(_collWithdrawal <= _troveColl, "BorrowerOps: Collateral withdrawal must not be larger than the trove's collateral");
    }

    function _requireValidLUSDRepayment(uint _currentDebt, uint _debtRepayment) internal pure {
        require(_debtRepayment <= _currentDebt.sub(LUSD_GAS_COMPENSATION), "BorrowerOps: Amount repaid must not be larger than the Trove's debt");
    }

    function _requireCallerIsStabilityPool() internal view {
        require(msg.sender == stabilityPoolAddress, "BorrowerOps: Caller is not Stability Pool");
    }

     function _requireSufficientLUSDBalance(address _borrower, uint _debtRepayment) internal view {
        require(lusdToken.balanceOf(_borrower) >= _debtRepayment, "BorrowerOps: Caller doesnt have enough LUSD to close their trove");
    }

    // --- ICR and TCR getters ---

    // Compute the new collateral ratio, considering the change in coll and debt. Assumes 0 pending rewards.
    function _getNewNominalICRFromTroveChange
    (
        uint _coll,
        uint _debt,
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease
    )
        pure
        internal
        returns (uint)
    {
        (uint newColl, uint newDebt) = _getNewTroveAmounts(_coll, _debt, _collChange, _isCollIncrease, _debtChange, _isDebtIncrease);

        uint newNICR = LiquityMath._computeNominalCR(newColl, newDebt);
        return newNICR;
    }

    // Compute the new collateral ratio, considering the change in coll and debt. Assumes 0 pending rewards.
    function _getNewICRFromTroveChange
    (
        uint _coll,
        uint _debt,
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease,
        uint _price
    )
        pure
        internal
        returns (uint)
    {
        (uint newColl, uint newDebt) = _getNewTroveAmounts(_coll, _debt, _collChange, _isCollIncrease, _debtChange, _isDebtIncrease);

        uint newICR = LiquityMath._computeCR(newColl, newDebt, _price);
        return newICR;
    }

    function _getNewTroveAmounts(
        uint _coll,
        uint _debt,
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease
    )
        internal
        pure
        returns (uint, uint)
    {
        uint newColl = _coll;
        uint newDebt = _debt;

        newColl = _isCollIncrease ? _coll.add(_collChange) :  _coll.sub(_collChange);
        newDebt = _isDebtIncrease ? _debt.add(_debtChange) : _debt.sub(_debtChange);

        return (newColl, newDebt);
    }

    function _getNewTCRFromTroveChange
    (
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease,
        uint _price
    )
        internal
        view
        returns (uint)
    {
        uint totalColl = getEntireSystemColl();
        uint totalDebt = getEntireSystemDebt();

        totalColl = _isCollIncrease ? totalColl.add(_collChange) : totalColl.sub(_collChange);
        totalDebt = _isDebtIncrease ? totalDebt.add(_debtChange) : totalDebt.sub(_debtChange);

        uint newTCR = LiquityMath._computeCR(totalColl, totalDebt, _price);
        return newTCR;
    }

    function getCompositeDebt(uint _debt) external pure override returns (uint) {
        return _getCompositeDebt(_debt);
    }
}
