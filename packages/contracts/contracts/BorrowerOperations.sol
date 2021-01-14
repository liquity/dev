// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/ILUSDToken.sol";
import "./Interfaces/IActivePool.sol";
import "./Interfaces/IDefaultPool.sol";
import "./Interfaces/ICollSurplusPool.sol";
import './Interfaces/ILUSDToken.sol';
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/ILQTYStaking.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract BorrowerOperations is LiquityBase, Ownable, IBorrowerOperations {

    // --- Connected contract declarations ---

    ITroveManager public troveManager;

    IActivePool public activePool;

    IDefaultPool public defaultPool;

    address stabilityPoolAddress;

    address gasPoolAddress;

    ICollSurplusPool collSurplusPool;

    IPriceFeed public priceFeed;

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
        emit LUSDTokenAddressChanged(_lusdTokenAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit LUSDTokenAddressChanged(_lusdTokenAddress);
        emit LQTYStakingAddressChanged(_lqtyStakingAddress);

        _renounceOwnership();
    }

    // --- Borrower Trove Operations ---

    function openTrove(uint _LUSDAmount, address _upperHint, address _lowerHint) external payable override {
        uint price = priceFeed.getPrice();

        _requireTroveisNotActive(msg.sender);

        // Decay the base rate, and calculate the borrowing fee
        troveManager.decayBaseRateFromBorrowing();
        uint LUSDFee = troveManager.getBorrowingFee(_LUSDAmount);
        uint rawDebt = _LUSDAmount.add(LUSDFee);

        // ICR is based on the composite debt, i.e. the requested LUSD amount + LUSD borrowing fee + LUSD gas comp.
        uint compositeDebt = _getCompositeDebt(rawDebt);
        assert(compositeDebt > 0);
        uint ICR = LiquityMath._computeCR(msg.value, compositeDebt, price);
        uint NICR = LiquityMath._computeNominalCR(msg.value, compositeDebt);

        if (_checkRecoveryMode()) {
            _requireICRisAboveR_MCR(ICR);
        } else {
            _requireICRisAboveMCR(ICR);
            _requireNewTCRisAboveCCR(msg.value, true, compositeDebt, true, price);  // bools: coll increase, debt increase
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

        // Send the LUSD borrowing fee to the staking contract
        lusdToken.mint(lqtyStakingAddress, LUSDFee);
        lqtyStaking.increaseF_LUSD(LUSDFee);

        // Move the ether to the Active Pool, and mint the LUSDAmount to the borrower
        _activePoolAddColl(msg.value);
        _withdrawLUSD(msg.sender, _LUSDAmount, rawDebt);
        // Move the LUSD gas compensation to the Gas Pool
        _withdrawLUSD(gasPoolAddress, LUSD_GAS_COMPENSATION, LUSD_GAS_COMPENSATION);

        emit TroveUpdated(msg.sender, compositeDebt, msg.value, stake, BorrowerOperation.openTrove);
        emit LUSDBorrowingFeePaid(msg.sender, LUSDFee);
    }

    // Send ETH as collateral to a trove
    function addColl(address _upperHint, address _lowerHint) external payable override {
        _adjustTrove(msg.sender, 0, 0, false, _upperHint, _lowerHint);
    }

    // Send ETH as collateral to a trove. Called by only the Stability Pool.
    function moveETHGainToTrove(address _borrower, address _upperHint, address _lowerHint) external payable override {
        _requireCallerIsStabilityPool();
        _adjustTrove(_borrower, 0, 0, false, _upperHint, _lowerHint);
    }

    // Withdraw ETH collateral from a trove
    function withdrawColl(uint _collWithdrawal, address _upperHint, address _lowerHint) external override {
        _adjustTrove(msg.sender, _collWithdrawal, 0, false, _upperHint, _lowerHint);
    }

    // Withdraw LUSD tokens from a trove: mint new LUSD tokens to the owner, and increase the trove's debt accordingly
    function withdrawLUSD(uint _LUSDAmount, address _upperHint, address _lowerHint) external override {
        _adjustTrove(msg.sender, 0, _LUSDAmount, true, _upperHint, _lowerHint);
    }

    // Repay LUSD tokens to a Trove: Burn the repaid LUSD tokens, and reduce the trove's debt accordingly
    function repayLUSD(uint _LUSDAmount, address _upperHint, address _lowerHint) external override {
        _adjustTrove(msg.sender, 0, _LUSDAmount, false, _upperHint, _lowerHint);
    }

    /*
    * If ETH is sent, the operation is considered as a collateral increase, and the first parameter
    * _collWithdrawal must be zero
    */
    function adjustTrove(uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease, address _upperHint, address _lowerHint) external payable override {
        _adjustTrove(msg.sender, _collWithdrawal, _debtChange, _isDebtIncrease, _upperHint, _lowerHint);
    }

    function _adjustTrove(address _borrower, uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease, address _upperHint, address _lowerHint) internal {
        require(msg.value == 0 || _collWithdrawal == 0, "BorrowerOperations: Cannot withdraw and add coll");
        // The operation "isWithdrawal" if it removes collateral or LUSD, i.e. it removes funds and lowers the ICR
        bool isWithdrawal = _collWithdrawal != 0 || _isDebtIncrease;
        require(msg.sender == _borrower || !isWithdrawal, "BorrowerOps: User must be sender for withdrawals");
        require(msg.value != 0 || _collWithdrawal != 0 || _debtChange != 0, "BorrowerOps: There must be either a collateral change or a debt change");

        LocalVariables_adjustTrove memory L;

        _requireTroveisActive(_borrower);
        if (isWithdrawal) {_requireNotInRecoveryMode();}

        L.price = priceFeed.getPrice();

        troveManager.applyPendingRewards(_borrower);

        (L.collChange, L.isCollIncrease) = _getCollChange(msg.value, _collWithdrawal);

        L.rawDebtChange = _debtChange;
        if (_isDebtIncrease && _debtChange > 0) {
            // Decay the baseRate and get the fee
            troveManager.decayBaseRateFromBorrowing();
            L.LUSDFee = troveManager.getBorrowingFee(_debtChange);

            // The raw debt change includes the fee, if there was one
            L.rawDebtChange = L.rawDebtChange.add(L.LUSDFee);

            // Send fee to LQTY staking contract
            lqtyStaking.increaseF_LUSD(L.LUSDFee);
            lusdToken.mint(lqtyStakingAddress, L.LUSDFee);
        }

        L.debt = troveManager.getTroveDebt(_borrower);
        L.coll = troveManager.getTroveColl(_borrower);

        L.newICR = _getNewICRFromTroveChange(L.coll, L.debt, L.collChange, L.isCollIncrease, L.rawDebtChange, _isDebtIncrease, L.price);

        if (isWithdrawal) {_requireICRisAboveMCR(L.newICR);}
        if (_isDebtIncrease && _debtChange > 0) {
            _requireNewTCRisAboveCCR(L.collChange, L.isCollIncrease, L.rawDebtChange, _isDebtIncrease, L.price);
        }
        /*
         * We don’t check that the withdrawn coll isn’t greater than the current collateral in the trove because it would fail previously in:
         * - _getNewICRFromTroveChange, due to SafeMath
         * - _requireICRisAboveMCR
         */
        if (!_isDebtIncrease && _debtChange > 0) {_requireLUSDRepaymentAllowed(L.debt, L.rawDebtChange);}

        (L.newColl, L.newDebt) = _updateTroveFromAdjustment(_borrower, L.collChange, L.isCollIncrease, L.rawDebtChange, _isDebtIncrease);
        L.stake = troveManager.updateStakeAndTotalStakes(_borrower);

        // Re-insert trove it in the sorted list
        uint newNICR = _getNewNominalICRFromTroveChange(L.coll, L.debt, L.collChange, L.isCollIncrease, L.rawDebtChange, _isDebtIncrease);
        sortedTroves.reInsert(_borrower, newNICR, _upperHint, _lowerHint);

        // Pass unmodified _debtChange here, as we don't send the fee to the user
        _moveTokensAndETHfromAdjustment(msg.sender, L.collChange, L.isCollIncrease, _debtChange, _isDebtIncrease, L.rawDebtChange);

        emit TroveUpdated(_borrower, L.newDebt, L.newColl, L.stake, BorrowerOperation.adjustTrove);
        emit LUSDBorrowingFeePaid(msg.sender,  L.LUSDFee);
    }

    function closeTrove() external override {
        _requireTroveisActive(msg.sender);
        _requireNotInRecoveryMode();

        troveManager.applyPendingRewards(msg.sender);

        uint coll = troveManager.getTroveColl(msg.sender);
        uint debt = troveManager.getTroveDebt(msg.sender);

        troveManager.removeStake(msg.sender);
        troveManager.closeTrove(msg.sender);

        // Burn the debt from the user's balance, and send the collateral back to the user
        _repayLUSD(msg.sender, debt.sub(LUSD_GAS_COMPENSATION));
        activePool.sendETH(msg.sender, coll);
        // Refund gas compensation
        _repayLUSD(gasPoolAddress, LUSD_GAS_COMPENSATION);

        emit TroveUpdated(msg.sender, 0, 0, 0, BorrowerOperation.closeTrove);
    }

    function claimRedeemedCollateral(address _user) external override {
        // send ETH from CollSurplus Pool to owner
        collSurplusPool.claimColl(_user);
    }

    // --- Helper functions ---

    function _getUSDValue(uint _coll, uint _price) internal pure returns (uint) {
        uint usdValue = _price.mul(_coll).div(1e18);

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
        assert(success == true);
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

    function _requireTroveisActive(address _borrower) internal view {
        uint status = troveManager.getTroveStatus(_borrower);
        require(status == 1, "BorrowerOps: Trove does not exist or is closed");
    }

    function _requireTroveisNotActive(address _borrower) internal view {
        uint status = troveManager.getTroveStatus(_borrower);
        require(status != 1, "BorrowerOps: Trove is active");
    }

    function _requireNotInRecoveryMode() internal view {
        require(_checkRecoveryMode() == false, "BorrowerOps: Operation not permitted during Recovery Mode");
    }

    function _requireICRisAboveMCR(uint _newICR)  internal pure {
        require(_newICR >= MCR, "BorrowerOps: An operation that would result in ICR < MCR is not permitted");
    }

    function _requireICRisAboveR_MCR(uint _newICR) internal pure {
        require(_newICR >= R_MCR, "BorrowerOps: In Recovery Mode new troves must have ICR >= R_MCR");
    }

    function _requireNewTCRisAboveCCR
    (
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease,
        uint _price
    )
        internal
        view
    {
        uint newTCR = _getNewTCRFromTroveChange(_collChange, _isCollIncrease, _debtChange, _isDebtIncrease, _price);
        require(newTCR >= CCR, "BorrowerOps: An operation that would result in TCR < CCR is not permitted");
    }

    function _requireLUSDRepaymentAllowed(uint _currentDebt, uint _debtRepayment) internal pure {
        require(_debtRepayment <= _currentDebt.sub(LUSD_GAS_COMPENSATION), "BorrowerOps: Amount repaid must not be larger than the Trove's debt");
    }

    function _requireCallerIsStabilityPool() internal view {
        require(msg.sender == stabilityPoolAddress, "BorrowerOps: Caller is not Stability Pool");
    }

    // --- ICR and TCR checks ---

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
        uint totalColl = activePool.getETH().add(defaultPool.getETH());
        uint totalDebt = activePool.getLUSDDebt().add(defaultPool.getLUSDDebt());

        totalColl = _isCollIncrease ? totalColl.add(_collChange) : totalColl.sub(_collChange);
        totalDebt = _isDebtIncrease ? totalDebt.add(_debtChange) : totalDebt = totalDebt.sub(_debtChange);

        uint newTCR = LiquityMath._computeCR(totalColl, totalDebt, _price);
        return newTCR;
    }

    function getCompositeDebt(uint _debt) external pure override returns (uint) {
        return _getCompositeDebt(_debt);
    }

    // --- Recovery Mode and TCR functions ---

    function _checkRecoveryMode() internal view returns (bool) {
        uint TCR = _getTCR();

        if (TCR < CCR) {
            return true;
        } else {
            return false;
        }
    }

    function _getTCR() internal view returns (uint TCR) {
        uint price = priceFeed.getPrice();
        uint activeColl = activePool.getETH();
        uint activeDebt = activePool.getLUSDDebt();
        uint liquidatedColl = defaultPool.getETH();
        uint closedDebt = defaultPool.getLUSDDebt();

        uint totalCollateral = activeColl.add(liquidatedColl);
        uint totalDebt = activeDebt.add(closedDebt);

        TCR = LiquityMath._computeCR(totalCollateral, totalDebt, price);

        return TCR;
    }
}
