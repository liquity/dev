pragma solidity ^0.5.16;

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/ICDPManager.sol";
import "./Interfaces/IPool.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/ISortedCDPs.sol";
import "./Interfaces/IPoolManager.sol";
import "./DeciMath.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract BorrowerOperations is Ownable, IBorrowerOperations {
    using SafeMath for uint;

    uint constant public MCR = 1100000000000000000; // Minimal collateral ratio.
    uint constant public  CCR = 1500000000000000000; // Critical system collateral ratio. If the total system collateral (TCR) falls below the CCR, Recovery Mode is triggered.
    uint constant public MIN_COLL_IN_USD = 20000000000000000000;

    // --- Connected contract declarations ---

    ICDPManager cdpManager;
    address public cdpManagerAddress;

    IPoolManager poolManager;
    address public poolManagerAddress;

    IPool activePool;
    address public activePoolAddress;

    IPool defaultPool;
    address public defaultPoolAddress;

    IPriceFeed priceFeed;
    address public priceFeedAddress;

    // A doubly linked list of CDPs, sorted by their sorted by their collateral ratios
    ISortedCDPs sortedCDPs;
    address public sortedCDPsAddress;

      // --- Events --- 

    event CDPManagerAddressChanged(address _newCDPManagerAddress);
    event PoolManagerAddressChanged(address _newPoolManagerAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event PriceFeedAddressChanged(address  _newPriceFeedAddress);
    event SortedCDPsAddressChanged(address _sortedCDPsAddress);

    event CDPCreated(address indexed _user, uint arrayIndex);
    event CDPUpdated(address indexed _user, uint _debt, uint _coll, uint stake);

    // --- Dependency setters --- 

    function setCDPManager(address _cdpManagerAddress) public onlyOwner {
        cdpManagerAddress = _cdpManagerAddress;
        cdpManager = ICDPManager(_cdpManagerAddress);
        emit CDPManagerAddressChanged(_cdpManagerAddress);
    }

    function setPoolManager(address _poolManagerAddress) public onlyOwner {
        poolManagerAddress = _poolManagerAddress;
        poolManager = IPoolManager(_poolManagerAddress);
        emit PoolManagerAddressChanged(_poolManagerAddress);
    }

    function setActivePool(address _activePoolAddress) public onlyOwner {
        activePoolAddress = _activePoolAddress;
        activePool = IPool(_activePoolAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
    }

    function setDefaultPool(address _defaultPoolAddress) public onlyOwner {
        defaultPoolAddress = _defaultPoolAddress;
        defaultPool = IPool(_defaultPoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
    }

    function setPriceFeed(address _priceFeedAddress) public onlyOwner {
        priceFeedAddress = _priceFeedAddress;
        priceFeed = IPriceFeed(priceFeedAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
    }

    function setSortedCDPs(address _sortedCDPsAddress) public onlyOwner {
        sortedCDPsAddress = _sortedCDPsAddress;
        sortedCDPs = ISortedCDPs(_sortedCDPsAddress);
        emit SortedCDPsAddressChanged(_sortedCDPsAddress);
    }

    // --- Borrower Trove Operations ---

    function openLoan(uint _CLVAmount, address _hint) public payable {
        address user = _msgSender(); 
        uint price = priceFeed.getPrice(); 

        _requireValueIsGreaterThan20Dollars(msg.value, price);
        
        uint ICR = _computeICR(msg.value, _CLVAmount, price);  

        if (_CLVAmount > 0) {
            _requireNotInRecoveryMode();
            _requireICRisAboveMCR(ICR);

            _requireNewTCRisAboveCCR(int(msg.value), int(_CLVAmount), price); 
        }
        
        // Update loan properties
        cdpManager.setCDPStatus(user, 1);
        cdpManager.increaseCDPColl(user, msg.value);
        cdpManager.increaseCDPDebt(user, _CLVAmount);
        
        cdpManager.updateRewardSnapshots(user); 
        uint stake = cdpManager.updateStakeAndTotalStakes(user); 
        
        sortedCDPs.insert(user, ICR, price, _hint, _hint); 
        uint arrayIndex = cdpManager.addCDPOwnerToArray(user);
        emit CDPCreated(user, arrayIndex);
        
        // Tell PM to move the ether to the Active Pool, and mint CLV to the borrower
        poolManager.addColl.value(msg.value)(); 
        poolManager.withdrawCLV(user, _CLVAmount); 
       
        emit CDPUpdated(user, _CLVAmount, msg.value, stake); 
    }

    // Send ETH as collateral to a CDP
    function addColl(address _user, address _hint) public payable {
        bool isFirstCollDeposit;

        uint price = priceFeed.getPrice();
        uint status = cdpManager.getCDPStatus(_user);
    
        // If non-existent or closed, open a new trove
        if (status == 0 || status == 2 ) {
            _requireValueIsGreaterThan20Dollars(msg.value, price);

            isFirstCollDeposit = true; 
            cdpManager.setCDPStatus(_user, 1);
        } 

        cdpManager.applyPendingRewards(_user);
       
        // Update the CDP's coll and stake
        uint newColl = cdpManager.increaseCDPColl(_user, msg.value);
        uint stake = cdpManager.updateStakeAndTotalStakes(_user);
        uint newICR = cdpManager.getCurrentICR(_user, price);
   
        if (isFirstCollDeposit) { 
            sortedCDPs.insert(_user, newICR, price, _hint, _hint);
            uint arrayIndex = cdpManager.addCDPOwnerToArray(_user);
            emit CDPCreated(_user, arrayIndex);
        } else {
            sortedCDPs.reInsert(_user, newICR, price, _hint, _hint);  
        }

        // Tell PM to move the ether to the Active Pool
        poolManager.addColl.value(msg.value)();
  
        uint debt = cdpManager.getCDPDebt(_user);
        emit CDPUpdated(_user, debt, newColl, stake);
    }
    
    // Withdraw ETH collateral from a CDP
    function withdrawColl(uint _amount, address _hint) public {
        address user = _msgSender();
        uint status = cdpManager.getCDPStatus(user);
        _requireCDPisActive(status);
        _requireNotInRecoveryMode();
       
        uint price = priceFeed.getPrice();
        cdpManager.applyPendingRewards(user);

        uint debt = cdpManager.getCDPDebt(user);
        uint coll = cdpManager.getCDPColl(user);
        
        _requireCollAmountIsWithdrawable(coll, _amount, price);

        uint newICR = _getNewICRFromTroveChange(coll, debt, -int(_amount), 0, price);
        _requireICRisAboveMCR(newICR);
        
        // Update the CDP's coll and stake
        cdpManager.decreaseCDPColl(user, _amount);
        uint stake = cdpManager.updateStakeAndTotalStakes(user);

        uint newColl = coll.sub(_amount);

        if (newColl == 0) { 
            cdpManager.closeCDP(user);  
        }  else { 
            sortedCDPs.reInsert(user, newICR, price, _hint, _hint);
        }

        // Remove _amount ETH from ActivePool and send it to the user
        poolManager.withdrawColl(user, _amount);

        emit CDPUpdated(user, debt, newColl, stake); 
    }
    
    // Withdraw CLV tokens from a CDP: mint new CLV to the owner, and increase the debt accordingly
    function withdrawCLV(uint _amount, address _hint) public {
        address user = _msgSender();
        uint status = cdpManager.getCDPStatus(user);
        _requireCDPisActive(status);
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
        emit CDPUpdated(user, newDebt, coll, stake); 
    }
    
    // Repay CLV tokens to a CDP: Burn the repaid CLV tokens, and reduce the debt accordingly
    function repayCLV(uint _amount, address _hint) public {
        address user = _msgSender();
        uint status = cdpManager.getCDPStatus(user);
        _requireCDPisActive(status);

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
        emit CDPUpdated(user, newDebt, coll, stake); 
    }

    function closeLoan() public {
        address user = _msgSender();
        uint status = cdpManager.getCDPStatus(user);
        _requireCDPisActive(status);
        _requireNotInRecoveryMode();

        cdpManager.applyPendingRewards(user);
        
        uint coll = cdpManager.getCDPColl(user);
        uint debt = cdpManager.getCDPDebt(user);

        cdpManager.removeStake(user);
        cdpManager.closeCDP(user);
    
        // Tell PM to burn the debt from the user's balance, and send the collateral back to the user
        poolManager.repayCLV(user, debt);
        poolManager.withdrawColl(user, coll);

        emit CDPUpdated(user, 0, 0, 0);
    }

    /* If ether is sent, the operation is considered as an increase in ether, and the first parameter 
    _collWithdrawal is ignored  */
    function adjustLoan(uint _collWithdrawal, int _debtChange, address _hint) public payable {
        _requireCDPisActive(cdpManager.getCDPStatus(_msgSender()));
        _requireNotInRecoveryMode();
        
        uint price = priceFeed.getPrice();
     
        cdpManager.applyPendingRewards(_msgSender());

        // If Ether is sent, grab the amount. Otherwise, grab the specified collateral withdrawal
        int collChange = (msg.value != 0) ? int(msg.value) : -int(_collWithdrawal);

        uint debt = cdpManager.getCDPDebt(_msgSender());
        uint coll = cdpManager.getCDPColl(_msgSender());
       
        uint newICR = _getNewICRFromTroveChange(coll, debt, collChange, _debtChange, price);
       
        // --- Checks --- 
        _requireICRisAboveMCR(newICR);
        _requireNewTCRisAboveCCR(collChange, _debtChange, price);
        _requireCLVRepaymentAllowed(debt, _debtChange);
        _requireCollAmountIsWithdrawable(coll, _collWithdrawal, price);

        //  --- Effects --- 
        (uint newColl, uint newDebt) = _updateTroveFromAdjustment(_msgSender(), collChange, _debtChange);
        
        uint stake = cdpManager.updateStakeAndTotalStakes(_msgSender());
       
        // Close a CDP if it is empty, otherwise, re-insert it in the sorted list
        if (newDebt == 0 && newColl == 0) {
            cdpManager.closeCDP(_msgSender());
        } else {
            sortedCDPs.reInsert(_msgSender(), newICR, price, _hint, _hint);
        }

        //  --- Interactions ---
        _moveTokensAndETHfromAdjustment(_msgSender(), collChange, _debtChange);   
    
        emit CDPUpdated(_msgSender(), newDebt, newColl, stake); 
    }

    // --- Helper functions --- 

    /* Converts the magnitude of an int to a uint
    TODO:  check validity for num in region (num > 2**255) or (num < -(2**255) ) */
    function _intToUint(int num) internal pure returns (uint) {
        if (num < 0) {
            return uint(-num);
        } else if (num >= 0) {
            return uint(num);
        }
    }

    function _getUSDValue(uint _coll, uint _price) internal view returns (uint) {
        uint usdValue = _price.mul(_coll).div(1e18);

        return usdValue;
    }

    // Update trove's coll and debt based on whether they increase or decrease
    function _updateTroveFromAdjustment(address _user, int _collChange, int _debtChange ) internal returns (uint, uint) {
        uint newColl = (_collChange > 0) ? cdpManager.increaseCDPColl(_user, _intToUint(_collChange)) 
                                         : cdpManager.decreaseCDPColl(_user, _intToUint(_collChange));
        uint newDebt = (_debtChange > 0) ? cdpManager.increaseCDPDebt(_user, _intToUint(_debtChange)) 
                                         : cdpManager.decreaseCDPDebt(_user, _intToUint(_debtChange));

        return (newColl, newDebt);
    }

    function _moveTokensAndETHfromAdjustment(address _user, int _collChange, int _debtChange) internal {
        if (_collChange > 0 ) {
            poolManager.addColl.value(_intToUint(_collChange))();
        } else if (_collChange < 0) {
            poolManager.withdrawColl(_user, _intToUint(_collChange));
        }

        if (_debtChange > 0){
            poolManager.withdrawCLV(_user, _intToUint(_debtChange));
        } else if (_debtChange < 0) {
            poolManager.repayCLV(_user, _intToUint(_debtChange));
        }
    }
    
    // --- 'Require' wrapper functions ---

    function _requireCDPisActive(uint status) internal view {
        require(status == 1, "BorrowerOps: CDP does not exist or is closed");
    }

    function _requireNotInRecoveryMode() internal view {
        require(_checkRecoveryMode() == false, "BorrowerOps: Operation not permitted during Recovery Mode");
    }

    function _requireICRisAboveMCR(uint _newICR)  internal view {
        require(_newICR >= MCR, "BorrowerOps: An operation that would result in ICR < MCR is not permitted");
    }

    function _requireNewTCRisAboveCCR(int _collChange, int _debtChange, uint _price) internal view {
        uint newTCR = _getNewTCRFromTroveChange(_collChange, _debtChange, _price);
        require(newTCR >= CCR, "BorrowerOps: An operation that would result in TCR < CCR is not permitted");
    }

    function _requireCLVRepaymentAllowed(uint _currentDebt, int _debtChange) internal pure {
        if (_debtChange < 0) {
            require(_intToUint(_debtChange) <= _currentDebt, "BorrowerOps: Amount repaid must not be larger than the CDP's debt");
        }
    }

    function _requireValueIsGreaterThan20Dollars(uint _amount, uint _price) internal view {
         require(_getUSDValue(_amount, _price) >= MIN_COLL_IN_USD,  
            "BorrowerOps: Collateral must have $USD value >= 20");
    }

    function _requireNonZeroAmount(uint _amount) internal pure {
        require(_amount > 0, "BorrowerOps: Amount must be larger than 0");
    }

    function _requireCollAmountIsWithdrawable(uint _currentColl, uint _collWithdrawal, uint _price) 
    internal 
    view 
    {
        if (_collWithdrawal > 0) {
            require(_collWithdrawal <= _currentColl, "BorrowerOps: Insufficient balance for ETH withdrawal");
            
            uint newColl = _currentColl.sub(_collWithdrawal);
            require(_getUSDValue(newColl, _price) >= MIN_COLL_IN_USD || newColl == 0,
                "BorrowerOps: Remaining collateral must have $USD value >= 20, or be zero");
        }
    }

    // --- ICR and TCR checks ---

    // Compute the new collateral ratio, considering the change in coll and debt. Assumes 0 pending rewards.
    function _getNewICRFromTroveChange(uint _coll, uint _debt, int _collChange, int _debtChange, uint _price) 
    view
    internal 
    returns(uint)
    {
        uint newColl = _coll;
        uint newDebt = _debt;

        if (_collChange > 0) {
            newColl = _coll.add(_intToUint(_collChange));
        } else if (_collChange < 0) {
            newColl = _coll.sub(_intToUint(_collChange));
        }

        if (_debtChange > 0) {
            newDebt = _debt.add(_intToUint(_debtChange));
        } else if (_debtChange < 0) {
            newDebt = _debt.sub(_intToUint(_debtChange));
        }

        return _computeICR(newColl, newDebt, _price);
    }

    function _getNewTCRFromTroveChange(int _collChange, int _debtChange, uint _price) internal view returns (uint) {
        uint totalColl = activePool.getETH().add(defaultPool.getETH());
        uint totalDebt = activePool.getCLV().add(defaultPool.getCLV());
       
        if (_collChange > 0) {
            totalColl = totalColl.add(_intToUint(_collChange));
        } else if (_collChange < 0) {
            totalColl = totalColl.sub(_intToUint(_collChange));
        }

        if (_debtChange > 0) {
            totalDebt = totalDebt.add(_intToUint(_debtChange));
        } else if (_debtChange < 0) {
            totalDebt = totalDebt.sub(_intToUint(_debtChange));
        }

        uint newTCR = _computeICR(totalColl, totalDebt, _price);
        return newTCR;
    }

    // --- Common helper functions, duplicated in CDPManager ---

    function _checkRecoveryMode() internal view returns (bool){
        uint price = priceFeed.getPrice();

        uint activeColl = activePool.getETH();
        uint activeDebt = activePool.getCLV();
        uint liquidatedColl = defaultPool.getETH();
        uint closedDebt = defaultPool.getCLV();

        uint totalCollateral = activeColl.add(liquidatedColl);
        uint totalDebt = activeDebt.add(closedDebt); 

        uint TCR = _computeICR(totalCollateral, totalDebt, price); 
        
        if (TCR < CCR) {
            return true;
        } else {
            return false;
        }
    }

    function _computeICR(uint _coll, uint _debt, uint _price) view internal returns(uint) {
        if (_debt > 0) {

            uint newCollRatio = _coll.mul(_price).div(_debt);

            return newCollRatio;
        }
        // Return the maximal value for uint256 if the CDP has a debt of 0
        else if (_debt == 0) {
            return (2**256) - 1; 
        }
    }
}