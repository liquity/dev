pragma solidity 0.5.16;

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/ICDPManager.sol";
import "./Interfaces/ICLVToken.sol";
import "./Interfaces/IPool.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/ISortedCDPs.sol";
import "./Interfaces/IPoolManager.sol";
import "./Interfaces/IGTStaking.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract BorrowerOperations is LiquityBase, Ownable, IBorrowerOperations {

    uint constant public MIN_COLL_IN_USD = 20000000000000000000;
   
    // --- Connected contract declarations ---

    ICDPManager public cdpManager;
    address public cdpManagerAddress;

    IPoolManager public poolManager;
    address public poolManagerAddress;

    IPool public activePool;
    address public activePoolAddress;

    IPool public defaultPool;
    address public defaultPoolAddress;

    IPriceFeed public priceFeed;
    address public priceFeedAddress;

    IGTStaking public gtStaking;
    address public gtStakingAddress;

    ICLVToken public clvToken;
    address public clvTokenAddress;


    // A doubly linked list of CDPs, sorted by their sorted by their collateral ratios
    ISortedCDPs public sortedCDPs;
    address public sortedCDPsAddress;

    /* --- Variable container structs  ---

    Used to hold, return and assign variables inside a function, in order to avoid the error: 
    "CompilerError: Stack too deep". */

     struct LocalVariables_adjustLoan {
        address user;
        uint price;
        uint collChange;
        uint rawDebtChange;
        bool isCollIncrease;
        uint debt;
        uint coll;
        uint newICR;
        uint CLVFee;
        uint newDebt;
        uint newColl;
        uint stake;
    }

    // --- Events --- 

    event CDPManagerAddressChanged(address _newCDPManagerAddress);
    event PoolManagerAddressChanged(address _newPoolManagerAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event PriceFeedAddressChanged(address  _newPriceFeedAddress);
    event SortedCDPsAddressChanged(address _sortedCDPsAddress);
    event GTStakingAddressChanged(address _gtStakingAddress);
    event CLVTokenAddressChanged(address _clvTokenAddress);

    enum BorrowerOperation {
        openLoan,
        closeLoan,
        addColl,
        withdrawColl,
        withdrawCLV,
        repayCLV,
        adjustLoan
    }

    event CDPCreated(address indexed _user, uint arrayIndex);
    event CDPUpdated(address indexed _user, uint _debt, uint _coll, uint stake, BorrowerOperation operation);

    // --- Dependency setters --- 

    function setAddresses(
        address _cdpManagerAddress,
        address _poolManagerAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _priceFeedAddress,
        address _sortedCDPsAddress,
        address _clvTokenAddress,
        address _gtStakingAddress
    )
        external
        onlyOwner
    {
        cdpManagerAddress = _cdpManagerAddress;
        cdpManager = ICDPManager(_cdpManagerAddress);
        poolManagerAddress = _poolManagerAddress;
        poolManager = IPoolManager(_poolManagerAddress);
        activePoolAddress = _activePoolAddress;
        activePool = IPool(_activePoolAddress);
        defaultPoolAddress = _defaultPoolAddress;
        defaultPool = IPool(_defaultPoolAddress);
        priceFeedAddress = _priceFeedAddress;
        priceFeed = IPriceFeed(priceFeedAddress);
        sortedCDPsAddress = _sortedCDPsAddress;
        sortedCDPs = ISortedCDPs(_sortedCDPsAddress);
        clvTokenAddress = _clvTokenAddress;
        clvToken = ICLVToken(_clvTokenAddress);
        gtStakingAddress = _gtStakingAddress;
        gtStaking = IGTStaking(_gtStakingAddress);

        emit CDPManagerAddressChanged(_cdpManagerAddress);
        emit PoolManagerAddressChanged(_poolManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit SortedCDPsAddressChanged(_sortedCDPsAddress);
        emit CLVTokenAddressChanged(_clvTokenAddress);
        emit GTStakingAddressChanged(_gtStakingAddress);

        _renounceOwnership();
    }

    // --- Borrower Trove Operations ---

    function openLoan(uint _CLVAmount, address _hint) external payable {
        address user = _msgSender(); 
        uint price = priceFeed.getPrice(); 
        _requireValueIsGreaterThan20Dollars(msg.value, price);
        _requireCDPisNotActive(user);
        
        uint CLVFee = cdpManager.getBorrowingFee(_CLVAmount);
        uint rawDebt = _CLVAmount.add(CLVFee);

        if (_CLVAmount > 0) {
            _requireNotInRecoveryMode();
            _requireNewTCRisAboveCCR(msg.value, true, rawDebt, true, price);  // coll increase, debt increase

            // Decay base rate and calculate the fee
            cdpManager.decayBaseRate();
            
            // Send the CLVFee to GT staking contract
            gtStaking.addLQTYFee(CLVFee);
            clvToken.mint(gtStakingAddress, CLVFee);
        }

        // Use the composite debt to calc the ICR
        uint compositeDebt = _getCompositeDebt(rawDebt);
        uint ICR = Math._computeCR(msg.value, compositeDebt, price);  
        
        _requireICRisAboveMCR(ICR);
        
        // Update loan properties
        cdpManager.setCDPStatus(user, 1);
        cdpManager.increaseCDPColl(user, msg.value);
        cdpManager.increaseCDPDebt(user, rawDebt);
        
        cdpManager.updateCDPRewardSnapshots(user); 
        uint stake = cdpManager.updateStakeAndTotalStakes(user); 
        
        sortedCDPs.insert(user, ICR, price, _hint, _hint); 
        uint arrayIndex = cdpManager.addCDPOwnerToArray(user);
        emit CDPCreated(user, arrayIndex);
        
        // Tell PM to move the ether to the Active Pool, and mint the CLVAmount to the borrower
        poolManager.addColl.value(msg.value)(); 
        poolManager.withdrawCLV(user, _CLVAmount, CLVFee); 
       
        emit CDPUpdated(user, rawDebt, msg.value, stake, BorrowerOperation.openLoan);
    }

    // Send ETH as collateral to a CDP
    function addColl(address _user, address _hint) external payable {
        _requireCDPisActive(_user);

        uint price = priceFeed.getPrice();
    
        cdpManager.applyPendingRewards(_user);
       
        // Update the CDP's coll and stake
        uint newColl = cdpManager.increaseCDPColl(_user, msg.value);
        uint stake = cdpManager.updateStakeAndTotalStakes(_user);
        uint newICR = cdpManager.getCurrentICR(_user, price);
   
        sortedCDPs.reInsert(_user, newICR, price, _hint, _hint);  
       
        // Tell PM to move the ether to the Active Pool
        poolManager.addColl.value(msg.value)();
  
        uint debt = cdpManager.getCDPDebt(_user);
        emit CDPUpdated(_user, debt, newColl, stake, BorrowerOperation.addColl);
    }
    
    // Withdraw ETH collateral from a CDP
    function withdrawColl(uint _collWithdrawal, address _hint) external {
        address user = _msgSender();
        _requireCDPisActive(user);
        _requireNotInRecoveryMode();
       
        uint price = priceFeed.getPrice();
        cdpManager.applyPendingRewards(user);

        uint debt = cdpManager.getCDPDebt(user);
        uint coll = cdpManager.getCDPColl(user);
        
        _requireCollAmountIsWithdrawable(coll, _collWithdrawal, price);

        uint newICR = _getNewICRFromTroveChange(coll, debt, _collWithdrawal, false, 0, false, price); // coll decrease, no debt change
        _requireICRisAboveMCR(newICR);
        
        // Update the CDP's coll and stake
        uint newColl = cdpManager.decreaseCDPColl(user, _collWithdrawal);
        uint stake = cdpManager.updateStakeAndTotalStakes(user);

        if (newColl == 0) { 
            cdpManager.closeCDP(user);  
        }  else { 
            sortedCDPs.reInsert(user, newICR, price, _hint, _hint);
        }

        // Remove _amount ETH from ActivePool and send it to the user
        poolManager.withdrawColl(user, _collWithdrawal);

        emit CDPUpdated(user, debt, newColl, stake, BorrowerOperation.withdrawColl);
    }
    
    // Withdraw CLV tokens from a CDP: mint new CLV to the owner, and increase the debt accordingly
    function withdrawCLV(uint _CLVAmount, address _hint) external {
        address user = _msgSender();
        _requireCDPisActive(user);
        _requireNonZeroAmount(_CLVAmount); 
        _requireNotInRecoveryMode();
        
        uint price = priceFeed.getPrice();
        cdpManager.applyPendingRewards(user);

        // Decay baseRate and get the fee
        cdpManager.decayBaseRate();
        uint CLVFee = cdpManager.getBorrowingFee(_CLVAmount);

        uint coll = cdpManager.getCDPColl(user);
        uint debt = cdpManager.getCDPDebt(user);

        uint rawdebtIncrease = _CLVAmount.add(CLVFee);

        uint newICR = _getNewICRFromTroveChange(coll, debt, 0, false, rawdebtIncrease, true, price);   // no coll change, debt increase
        _requireICRisAboveMCR(newICR);

        _requireNewTCRisAboveCCR(0, false, _CLVAmount, true, price);  // no coll change, debt increase

        // Send fee to GT staking contract
        gtStaking.addLQTYFee(CLVFee);
        clvToken.mint(gtStakingAddress, CLVFee);

        // Increase the CDP's debt
        uint newDebt = cdpManager.increaseCDPDebt(user, rawdebtIncrease);
       
        // Update CDP's position in sortedCDPs
        sortedCDPs.reInsert(user, newICR, price, _hint, _hint);

        // Mint the CLV amount (minus fee) to the borrower, and update the ActivePool
        poolManager.withdrawCLV(user, _CLVAmount, CLVFee); 
        
        uint stake = cdpManager.getCDPStake(user);
        emit CDPUpdated(user, newDebt, coll, stake, BorrowerOperation.withdrawCLV);
    }
    
    // Repay CLV tokens to a CDP: Burn the repaid CLV tokens, and reduce the debt accordingly
    function repayCLV(uint _CLVamount, address _hint) external {
        address user = _msgSender();
        _requireCDPisActive(user);

        uint price = priceFeed.getPrice();
        cdpManager.applyPendingRewards(user);

        uint debt = cdpManager.getCDPDebt(user);
        _requireCLVRepaymentAllowed(debt, _CLVamount);
        
        // Update the CDP's debt
        uint newDebt = cdpManager.decreaseCDPDebt(user, _CLVamount);
       
        uint newICR = cdpManager.getCurrentICR(user, price);
        
        // Update CDP's position in sortedCDPs
        sortedCDPs.reInsert(user, newICR, price, _hint, _hint);

        // Burn the received amount of CLV from the user's balance, and remove it from the ActivePool
        poolManager.repayCLV(user, _CLVamount);
        
        uint coll = cdpManager.getCDPColl(user);
        uint stake = cdpManager.getCDPStake(user);
        emit CDPUpdated(user, newDebt, coll, stake, BorrowerOperation.repayCLV);
    }

    function closeLoan() external {
        address user = _msgSender();
        _requireCDPisActive(user);
        _requireNotInRecoveryMode();

        cdpManager.applyPendingRewards(user);
        
        uint coll = cdpManager.getCDPColl(user);
        uint debt = cdpManager.getCDPDebt(user);

        cdpManager.removeStake(user);
        cdpManager.closeCDP(user);

        poolManager.closeLoan(user, debt, coll);

        emit CDPUpdated(user, 0, 0, 0, BorrowerOperation.closeLoan);
    }

    /* If ether is sent, the operation is considered as an increase in ether, and the first parameter 
    _collWithdrawal is ignored  */
    function adjustLoan(uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease, address _hint) external payable {
        LocalVariables_adjustLoan memory L;

        L.user = _msgSender();
        _requireCDPisActive(L.user);
        _requireNotInRecoveryMode();
        
        L.price = priceFeed.getPrice();
     
        cdpManager.applyPendingRewards(L.user);

        (L.collChange, L.isCollIncrease) = _getCollChange(msg.value, _collWithdrawal);

        L.rawDebtChange = _debtChange;
        if (_isDebtIncrease) {
            // Decay baseRate and get the fee
            cdpManager.decayBaseRate();
            L.CLVFee = cdpManager.getBorrowingFee(_debtChange);

            // Raw debt change includes the fee, if there was one
            L.rawDebtChange = L.rawDebtChange.add(L.CLVFee);

            // Send fee to GT staking contract 
            gtStaking.addLQTYFee(L.CLVFee);
            clvToken.mint(gtStakingAddress, L.CLVFee);
        }
     
        L.debt = cdpManager.getCDPDebt(L.user);
        L.coll = cdpManager.getCDPColl(L.user);
       
        L.newICR = _getNewICRFromTroveChange(L.coll, L.debt, L.collChange, L.isCollIncrease, L.rawDebtChange, _isDebtIncrease, L.price);
       
        // --- Checks --- 
        _requireICRisAboveMCR(L.newICR);
        _requireNewTCRisAboveCCR(L.collChange, L.isCollIncrease, L.rawDebtChange, _isDebtIncrease, L.price);
        _requireCollAmountIsWithdrawable(L.coll, _collWithdrawal, L.price);
        if (!_isDebtIncrease) {_requireCLVRepaymentAllowed(L.debt, L.rawDebtChange);}

        // --- Effects ---
        (L.newColl, L.newDebt) = _updateTroveFromAdjustment(L.user, L.collChange, L.isCollIncrease, L.rawDebtChange, _isDebtIncrease);
        
        L.stake = cdpManager.updateStakeAndTotalStakes(L.user);
       
        // Close a CDP if it is empty, otherwise, re-insert it in the sorted list
        if (L.newDebt == 0 && L.newColl == 0) {
            cdpManager.closeCDP(L.user);
        } else {
            sortedCDPs.reInsert(L.user, L.newICR, L.price, _hint, _hint);
        }

        //  --- Interactions ---

        // Pass unmodified _debtChange here, as we don't send the fee to the user
        _moveTokensAndETHfromAdjustment(L.user, L.collChange, L.isCollIncrease, _debtChange, _isDebtIncrease, L.CLVFee);   
    
        emit CDPUpdated(L.user, L.newDebt, L.newColl, L.stake, BorrowerOperation.adjustLoan);
    }

    // --- Helper functions --- 
    
    function _getUSDValue(uint _coll, uint _price) internal pure returns (uint) {
        uint usdValue = _price.mul(_coll).div(1e18);

        return usdValue;
    }

    function _getCollChange(uint _collReceived, uint _requestedCollWithdrawal) internal pure returns 
    (
        uint collChange,
        bool isCollIncrease
    ) 
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
        address _user, 
        uint _collChange, 
        bool _isCollIncrease, 
        uint _debtChange, 
        bool _isDebtIncrease 
    ) 
    internal 
    returns (uint, uint) 
    {
        uint newColl = (_isCollIncrease) ? cdpManager.increaseCDPColl(_user, _collChange)
                                        : cdpManager.decreaseCDPColl(_user, _collChange);
        uint newDebt = (_isDebtIncrease) ? cdpManager.increaseCDPDebt(_user, _debtChange)
                                        : cdpManager.decreaseCDPDebt(_user, _debtChange);

        return (newColl, newDebt);
    }

    function _moveTokensAndETHfromAdjustment
    (
        address _user, 
        uint _collChange, 
        bool _isCollIncrease, 
        uint _debtChange, 
        bool _isDebtIncrease, 
        uint _CLVFee
    ) 
    internal 
    {
        if (_isDebtIncrease) {
            poolManager.withdrawCLV(_user, _debtChange, _CLVFee);
        } else {
            poolManager.repayCLV(_user, _debtChange);
        }

        if (_isCollIncrease) {
            poolManager.addColl.value(_collChange)();
        } else {
            poolManager.withdrawColl(_user, (_collChange));
        }
    }
    
    // --- 'Require' wrapper functions ---

    function _requireCDPisActive(address _user) internal view {
        uint status = cdpManager.getCDPStatus(_user);
        require(status == 1, "BorrowerOps: CDP does not exist or is closed");
    }

    function _requireCDPisNotActive(address _user) internal view {
        uint status = cdpManager.getCDPStatus(_user);
        require(status != 1, "BorrowerOps: CDP is active");
    }

    function _requireNotInRecoveryMode() internal view {
        require(_checkRecoveryMode() == false, "BorrowerOps: Operation not permitted during Recovery Mode");
    }

    function _requireICRisAboveMCR(uint _newICR)  internal pure {
        require(_newICR >= MCR, "BorrowerOps: An operation that would result in ICR < MCR is not permitted");
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

    function _requireCLVRepaymentAllowed(uint _currentDebt, uint _debtRepayment) internal pure {
        require(_debtRepayment <= _currentDebt, "BorrowerOps: Amount repaid must not be larger than the CDP's debt");
    }

    function _requireValueIsGreaterThan20Dollars(uint _amount, uint _price) internal pure {
         require(_getUSDValue(_amount, _price) >= MIN_COLL_IN_USD,  
            "BorrowerOps: Collateral must have $USD value >= 20");
    }

    function _requireNonZeroAmount(uint _amount) internal pure {
        require(_amount > 0, "BorrowerOps: Amount must be larger than 0");
    }

    function _requireCollAmountIsWithdrawable(uint _currentColl, uint _collWithdrawal, uint _price)
    internal 
    pure 
    {
        require(_collWithdrawal <= _currentColl, "BorrowerOps: Insufficient balance for ETH withdrawal");

        uint remainingColl = _currentColl.sub(_collWithdrawal);
        if (remainingColl > 0) {_requireValueIsGreaterThan20Dollars(remainingColl, _price);}
    }

    // --- ICR and TCR checks ---

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
        uint newColl = _coll;
        uint newDebt = _debt;

        newColl = _isCollIncrease ? _coll.add(_collChange) :  _coll.sub(_collChange);
        newDebt = _isDebtIncrease ? _debt.add(_debtChange) : _debt.sub(_debtChange);

        uint compositeDebt = _getCompositeDebt(newDebt);
        uint newICR = Math._computeCR(newColl, compositeDebt, _price);
        return newICR;
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
        uint totalDebt = activePool.getCLVDebt().add(defaultPool.getCLVDebt());
       
        totalColl = _isCollIncrease ? totalColl.add(_collChange) : totalColl.sub(_collChange);
        totalDebt = _isDebtIncrease ? totalDebt.add(_debtChange) : totalDebt = totalDebt.sub(_debtChange);
        
        uint newTCR = Math._computeCR(totalColl, totalDebt, _price);
        return newTCR;
    }

    function getCompositeDebt(uint _debt) external pure returns (uint) {
        return _getCompositeDebt(_debt);
    }

    // --- Recovery Mode and TCR functions ---

    function _checkRecoveryMode() internal view returns (bool) {
        uint price = priceFeed.getPrice();
        uint TCR = _getTCR(price);
        
        if (TCR < CCR) {
            return true;
        } else {
            return false;
        }
    }
    
    function _getTCR(uint _price) internal view returns (uint TCR) { 
        uint activeColl = activePool.getETH();
        uint activeDebt = activePool.getCLVDebt();
        uint liquidatedColl = defaultPool.getETH();
        uint closedDebt = defaultPool.getCLVDebt();

        uint totalCollateral = activeColl.add(liquidatedColl);
        uint totalDebt = activeDebt.add(closedDebt); 

        TCR = Math._computeCR(totalCollateral, totalDebt, _price); 

        return TCR;
    }
}