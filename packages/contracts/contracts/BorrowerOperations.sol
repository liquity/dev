pragma solidity 0.5.16;

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/ICDPManager.sol";
import "./Interfaces/IPool.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/ISortedCDPs.sol";
import "./Interfaces/IPoolManager.sol";
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

    // A doubly linked list of CDPs, sorted by their sorted by their collateral ratios
    ISortedCDPs public sortedCDPs;
    address public sortedCDPsAddress;

    // --- Events --- 

    event CDPManagerAddressChanged(address _newCDPManagerAddress);
    event PoolManagerAddressChanged(address _newPoolManagerAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event PriceFeedAddressChanged(address  _newPriceFeedAddress);
    event SortedCDPsAddressChanged(address _sortedCDPsAddress);

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

    function setCDPManager(address _cdpManagerAddress) external onlyOwner {
        cdpManagerAddress = _cdpManagerAddress;
        cdpManager = ICDPManager(_cdpManagerAddress);
        emit CDPManagerAddressChanged(_cdpManagerAddress);
    }

    function setPoolManager(address _poolManagerAddress) external onlyOwner {
        poolManagerAddress = _poolManagerAddress;
        poolManager = IPoolManager(_poolManagerAddress);
        emit PoolManagerAddressChanged(_poolManagerAddress);
    }

    function setActivePool(address _activePoolAddress) external onlyOwner {
        activePoolAddress = _activePoolAddress;
        activePool = IPool(_activePoolAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
    }

    function setDefaultPool(address _defaultPoolAddress) external onlyOwner {
        defaultPoolAddress = _defaultPoolAddress;
        defaultPool = IPool(_defaultPoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
    }

    function setPriceFeed(address _priceFeedAddress) external onlyOwner {
        priceFeedAddress = _priceFeedAddress;
        priceFeed = IPriceFeed(priceFeedAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
    }

    function setSortedCDPs(address _sortedCDPsAddress) external onlyOwner {
        sortedCDPsAddress = _sortedCDPsAddress;
        sortedCDPs = ISortedCDPs(_sortedCDPsAddress);
        emit SortedCDPsAddressChanged(_sortedCDPsAddress);
    }

    // --- Borrower Trove Operations ---

    function openLoan(uint _CLVAmount, address _hint) external payable {
        address user = _msgSender(); 
        uint price = priceFeed.getPrice(); 

        _requireValueIsGreaterThan20Dollars(msg.value, price);
        _requireCDPisNotActive(user);
        
        uint compositeDebt = _getCompositeDebt(_CLVAmount);
        uint ICR = Math._computeCR(msg.value, compositeDebt, price);  

        if (_CLVAmount > 0) {
            _requireNotInRecoveryMode();
            _requireICRisAboveMCR(ICR);

            _requireNewTCRisAboveCCR(int(msg.value), int(_CLVAmount), price); 
        }
        
        // Update loan properties
        cdpManager.setCDPStatus(user, 1);
        cdpManager.increaseCDPColl(user, msg.value);
        cdpManager.increaseCDPDebt(user, _CLVAmount);
        
        cdpManager.updateCDPRewardSnapshots(user); 
        uint stake = cdpManager.updateStakeAndTotalStakes(user); 
        
        sortedCDPs.insert(user, ICR, price, _hint, _hint); 
        uint arrayIndex = cdpManager.addCDPOwnerToArray(user);
        emit CDPCreated(user, arrayIndex);
        
        // Tell PM to move the ether to the Active Pool, and mint CLV to the borrower
        poolManager.addColl.value(msg.value)(); 
        poolManager.withdrawCLV(user, _CLVAmount); 
       
        emit CDPUpdated(user, _CLVAmount, msg.value, stake, BorrowerOperation.openLoan);
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
    function withdrawColl(uint _amount, address _hint) external {
        address user = _msgSender();
        _requireCDPisActive(user);
        _requireNotInRecoveryMode();
       
        uint price = priceFeed.getPrice();
        cdpManager.applyPendingRewards(user);

        uint debt = cdpManager.getCDPDebt(user);
        uint coll = cdpManager.getCDPColl(user);
        
        _requireCollAmountIsWithdrawable(coll, _amount, price);

        uint newICR = _getNewICRFromTroveChange(coll, debt, -int(_amount), 0, price);
        _requireICRisAboveMCR(newICR);
        
        // Update the CDP's coll and stake
        uint newColl = cdpManager.decreaseCDPColl(user, _amount);
        uint stake = cdpManager.updateStakeAndTotalStakes(user);

        if (newColl == 0) { 
            cdpManager.closeCDP(user);  
        }  else { 
            sortedCDPs.reInsert(user, newICR, price, _hint, _hint);
        }

        // Remove _amount ETH from ActivePool and send it to the user
        poolManager.withdrawColl(user, _amount);

        emit CDPUpdated(user, debt, newColl, stake, BorrowerOperation.withdrawColl);
    }
    
    // Withdraw CLV tokens from a CDP: mint new CLV to the owner, and increase the debt accordingly
    function withdrawCLV(uint _amount, address _hint) external {
        address user = _msgSender();
        _requireCDPisActive(user);
        _requireNonZeroAmount(_amount); 
        _requireNotInRecoveryMode();
        
        uint price = priceFeed.getPrice();
        cdpManager.applyPendingRewards(user);

        uint coll = cdpManager.getCDPColl(user);
        uint debt = cdpManager.getCDPDebt(user);

        uint newICR = _getNewICRFromTroveChange(coll, debt, 0, int(_amount), price);
        _requireICRisAboveMCR(newICR);

        _requireNewTCRisAboveCCR(0, int(_amount), price);
        
        // Increase the CDP's debt
        uint newDebt = cdpManager.increaseCDPDebt(user, _amount);
       
        // Update CDP's position in sortedCDPs
        sortedCDPs.reInsert(user, newICR, price, _hint, _hint);

        // Mint the given amount of CLV to the owner's address and add them to the ActivePool
        poolManager.withdrawCLV(user, _amount);
        
        uint stake = cdpManager.getCDPStake(user);
        emit CDPUpdated(user, newDebt, coll, stake, BorrowerOperation.withdrawCLV);
    }
    
    // Repay CLV tokens to a CDP: Burn the repaid CLV tokens, and reduce the debt accordingly
    function repayCLV(uint _amount, address _hint) external {
        address user = _msgSender();
        _requireCDPisActive(user);

        uint price = priceFeed.getPrice();
        cdpManager.applyPendingRewards(user);

        uint debt = cdpManager.getCDPDebt(user);
        _requireCLVRepaymentAllowed(debt, -int(_amount));
        
        // Update the CDP's debt
        uint newDebt = cdpManager.decreaseCDPDebt(user, _amount);
       
        uint newICR = cdpManager.getCurrentICR(user, price);
        
        // Update CDP's position in sortedCDPs
        sortedCDPs.reInsert(user, newICR, price, _hint, _hint);

        // Burn the received amount of CLV from the user's balance, and remove it from the ActivePool
        poolManager.repayCLV(user, _amount);
        
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
    
        // Tell PM to burn the debt from the user's balance, and send the collateral back to the user
        poolManager.repayCLV(user, debt);
        poolManager.withdrawColl(user, coll);

        emit CDPUpdated(user, 0, 0, 0, BorrowerOperation.closeLoan);
    }

    /* If ether is sent, the operation is considered as an increase in ether, and the first parameter 
    _collWithdrawal is ignored  */
    function adjustLoan(uint _collWithdrawal, int _debtChange, address _hint) external payable {
        address user = _msgSender();
        _requireCDPisActive(user);
        _requireNotInRecoveryMode();
        
        uint price = priceFeed.getPrice();
     
        cdpManager.applyPendingRewards(user);

        // If Ether is sent, grab the amount. Otherwise, grab the specified collateral withdrawal
        int collChange = (msg.value != 0) ? int(msg.value) : -int(_collWithdrawal);

        uint debt = cdpManager.getCDPDebt(user);
        uint coll = cdpManager.getCDPColl(user);
       
        uint newICR = _getNewICRFromTroveChange(coll, debt, collChange, _debtChange, price);
       
        // --- Checks --- 
        _requireICRisAboveMCR(newICR);
        _requireNewTCRisAboveCCR(collChange, _debtChange, price);
        _requireCLVRepaymentAllowed(debt, _debtChange);
        _requireCollAmountIsWithdrawable(coll, _collWithdrawal, price);

        //  --- Effects --- 
        (uint newColl, uint newDebt) = _updateTroveFromAdjustment(user, collChange, _debtChange);
        
        uint stake = cdpManager.updateStakeAndTotalStakes(user);
       
        // Close a CDP if it is empty, otherwise, re-insert it in the sorted list
        if (newDebt == 0 && newColl == 0) {
            cdpManager.closeCDP(user);
        } else {
            sortedCDPs.reInsert(user, newICR, price, _hint, _hint);
        }

        //  --- Interactions ---
        _moveTokensAndETHfromAdjustment(user, collChange, _debtChange);   
    
        emit CDPUpdated(user, newDebt, newColl, stake, BorrowerOperation.adjustLoan);
    }

    // --- Helper functions --- 
    
    function _getUSDValue(uint _coll, uint _price) internal pure returns (uint) {
        uint usdValue = _price.mul(_coll).div(1e18);

        return usdValue;
    }

    // Update trove's coll and debt based on whether they increase or decrease
    function _updateTroveFromAdjustment(address _user, int _collChange, int _debtChange ) internal returns (uint, uint) {
        uint newColl = (_collChange > 0) ? cdpManager.increaseCDPColl(_user, Math._intToUint(_collChange)) 
                                         : cdpManager.decreaseCDPColl(_user, Math._intToUint(_collChange));
        uint newDebt = (_debtChange > 0) ? cdpManager.increaseCDPDebt(_user, Math._intToUint(_debtChange)) 
                                         : cdpManager.decreaseCDPDebt(_user, Math._intToUint(_debtChange));

        return (newColl, newDebt);
    }

    function _moveTokensAndETHfromAdjustment(address _user, int _collChange, int _debtChange) internal {
        if (_debtChange > 0){
            poolManager.withdrawCLV(_user, Math._intToUint(_debtChange));
        } else if (_debtChange < 0) {
            poolManager.repayCLV(_user, Math._intToUint(_debtChange));
        }

        if (_collChange > 0 ) {
            poolManager.addColl.value(Math._intToUint(_collChange))();
        } else if (_collChange < 0) {
            poolManager.withdrawColl(_user, Math._intToUint(_collChange));
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

    function _requireNewTCRisAboveCCR(int _collChange, int _debtChange, uint _price) internal view {
        uint newTCR = _getNewTCRFromTroveChange(_collChange, _debtChange, _price);
        require(newTCR >= CCR, "BorrowerOps: An operation that would result in TCR < CCR is not permitted");
    }

    function _requireCLVRepaymentAllowed(uint _currentDebt, int _debtChange) internal pure {
        if (_debtChange < 0) {
            require(Math._intToUint(_debtChange) <= _currentDebt, "BorrowerOps: Amount repaid must not be larger than the CDP's debt");
        }
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
        if (_collWithdrawal > 0) {
            require(_collWithdrawal <= _currentColl, "BorrowerOps: Insufficient balance for ETH withdrawal");
        }
    }

    // --- ICR and TCR checks ---

    // Compute the new collateral ratio, considering the change in coll and debt. Assumes 0 pending rewards. 
    function _getNewICRFromTroveChange(uint _coll, uint _debt, int _collChange, int _debtChange, uint _price) 
    pure
    internal 
    returns (uint)
    {
        uint newColl = _coll;
        uint newDebt = _debt;

        if (_collChange > 0) {
            newColl = _coll.add(Math._intToUint(_collChange));
        } else if (_collChange < 0) {
            newColl = _coll.sub(Math._intToUint(_collChange));
        }

        if (_debtChange > 0) {
            newDebt = _debt.add(Math._intToUint(_debtChange));
        } else if (_debtChange < 0) {
            newDebt = _debt.sub(Math._intToUint(_debtChange));
        }

        uint compositeDebt = _getCompositeDebt(newDebt);
        uint newICR = Math._computeCR(newColl, compositeDebt, _price);
        return newICR;
    }

    function _getNewTCRFromTroveChange(int _collChange, int _debtChange, uint _price) internal view returns (uint) {
        uint totalColl = activePool.getETH().add(defaultPool.getETH());
        uint totalDebt = activePool.getCLVDebt().add(defaultPool.getCLVDebt());
       
        if (_collChange > 0) {
            totalColl = totalColl.add(Math._intToUint(_collChange));
        } else if (_collChange < 0) {
            totalColl = totalColl.sub(Math._intToUint(_collChange));
        }

        if (_debtChange > 0) {
            totalDebt = totalDebt.add(Math._intToUint(_debtChange));
        } else if (_debtChange < 0) {
            totalDebt = totalDebt.sub(Math._intToUint(_debtChange));
        }

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