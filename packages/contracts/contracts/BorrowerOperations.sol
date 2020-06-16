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

    // --- Events --- 

    event CDPManagerAddressChanged(address _newCDPManagerAddress);
    event PoolManagerAddressChanged(address _newPoolManagerAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event PriceFeedAddressChanged(address  _newPriceFeedAddress);
    event SortedCDPsAddressChanged(address _sortedCDPsAddress);

    event CDPCreated(address indexed _user, uint arrayIndex);
    event CDPUpdated(address indexed _user, uint _debt, uint _coll, uint stake);
   
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

    function openLoan(uint _CLVAmount, address _hint) public payable returns (bool) {
        address user = _msgSender(); 
        uint price = priceFeed.getPrice(); 

        requireValueIsGreaterThan20Dollars(msg.value, price);
        
        uint ICR = computeICR(msg.value, _CLVAmount, price);  

        if (_CLVAmount > 0) {
            requireNotInRecoveryMode();
            requireICRisAboveMCR(ICR);

            requireNewTCRisAboveCCR(int(msg.value), int(_CLVAmount), price); 
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
        return true;
    }

    // Send ETH as collateral to a CDP
    function addColl(address _user, address _hint) public payable returns (bool) {
        bool isFirstCollDeposit;

        uint price = priceFeed.getPrice();
        uint status = cdpManager.getCDPStatus(_user);
    
        // If non-existent or closed, open a new trove
        if (status == 0 || status == 2 ) {
            requireValueIsGreaterThan20Dollars(msg.value, price);

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
        return true;
    }
    
    // Withdraw ETH collateral from a CDP
    function withdrawColl(uint _amount, address _hint) public returns (bool) {
        address user = _msgSender();
        uint status = cdpManager.getCDPStatus(user);
        requireCDPisActive(status);
        requireNotInRecoveryMode();
       
        uint price = priceFeed.getPrice();
        cdpManager.applyPendingRewards(user);

        uint debt = cdpManager.getCDPDebt(user);
        uint coll = cdpManager.getCDPColl(user);
        
        requireCollAmountIsWithdrawable(coll, _amount, price);

        uint newICR = getNewICRFromTroveChange(coll, debt, -int(_amount), 0, price);
        requireICRisAboveMCR(newICR);
        
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
        return true;
    }
    
    // Withdraw CLV tokens from a CDP: mint new CLV to the owner, and increase the debt accordingly
    function withdrawCLV(uint _amount, address _hint) public returns (bool) {
        address user = _msgSender();
        uint status = cdpManager.getCDPStatus(user);
        requireCDPisActive(status);
        requireNonZeroAmount(_amount); 
        requireNotInRecoveryMode();
        
        uint price = priceFeed.getPrice();
        cdpManager.applyPendingRewards(user);

        uint coll = cdpManager.getCDPColl(user);
        uint debt = cdpManager.getCDPDebt(user);

        uint newICR = getNewICRFromTroveChange(coll, debt, 0, int(_amount), price);
        requireICRisAboveMCR(newICR);

        requireNewTCRisAboveCCR(0, int(_amount), price);
        
        // Increase the CDP's debt
        uint newDebt = cdpManager.increaseCDPDebt(user, _amount);
       
        // Update CDP's position in sortedCDPs
        sortedCDPs.reInsert(user, newICR, price, _hint, _hint);

        // Mint the given amount of CLV to the owner's address and add them to the ActivePool
        poolManager.withdrawCLV(user, _amount);
        
        uint stake = cdpManager.getCDPStake(user);
        emit CDPUpdated(user, newDebt, coll, stake); 
        return true; 
    }
    
    // Repay CLV tokens to a CDP: Burn the repaid CLV tokens, and reduce the debt accordingly
    function repayCLV(uint _amount, address _hint) public returns (bool) {
        address user = _msgSender();
        uint status = cdpManager.getCDPStatus(user);
        requireCDPisActive(status);

        uint price = priceFeed.getPrice();
        cdpManager.applyPendingRewards(user);

        uint debt = cdpManager.getCDPDebt(user);
        requireCLVRepaymentAllowed(debt, -int(_amount));
        
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
        return true;
    }

    function closeLoan() public returns (bool) {
        address user = _msgSender();
        uint status = cdpManager.getCDPStatus(user);
        requireCDPisActive(status);
        requireNotInRecoveryMode();

        cdpManager.applyPendingRewards(user);
        
        uint coll = cdpManager.getCDPColl(user);
        uint debt = cdpManager.getCDPDebt(user);

        cdpManager.removeStake(user);
        cdpManager.closeCDP(user);
    
        // Tell PM to burn the debt from the user's balance, and send the collateral back to the user
        poolManager.repayCLV(user, debt);
        poolManager.withdrawColl(user, coll);

        emit CDPUpdated(user, 0, 0, 0);
        return true; 
    }

    /* If ether is sent, the operation is considered as an increase in ether, and the first parameter 
    _collWithdrawal is ignored  */
    function adjustLoan(uint _collWithdrawal, int _debtChange, address _hint) public payable returns (bool) {
        requireCDPisActive(cdpManager.getCDPStatus(_msgSender()));
        requireNotInRecoveryMode();
        
        uint price = priceFeed.getPrice();
     
        cdpManager.applyPendingRewards(_msgSender());

        // If Ether is sent, grab the amount. Otherwise, grab the specified collateral withdrawal
        int collChange = (msg.value != 0) ? int(msg.value) : -int(_collWithdrawal);

        uint debt = cdpManager.getCDPDebt(_msgSender());
        uint coll = cdpManager.getCDPColl(_msgSender());
       
        uint newICR = getNewICRFromTroveChange(coll, debt, collChange, _debtChange, price);
       
        // --- Checks --- 
        requireICRisAboveMCR(newICR);
        requireNewTCRisAboveCCR(collChange, _debtChange, price);
        requireCLVRepaymentAllowed(debt, _debtChange);
        requireCollAmountIsWithdrawable(coll, _collWithdrawal, price);

        //  --- Effects --- 
        (uint newColl, uint newDebt) = updateTroveFromAdjustment(_msgSender(), collChange, _debtChange);
        
        uint stake = cdpManager.updateStakeAndTotalStakes(_msgSender());
       
        // Close a CDP if it is empty, otherwise, re-insert it in the sorted list
        if (newDebt == 0 && newColl == 0) {
            cdpManager.closeCDP(_msgSender());
        } else {
            sortedCDPs.reInsert(_msgSender(), newICR, price, _hint, _hint);
        }

        //  --- Interactions ---
        moveTokensAndETHfromAdjustment(_msgSender(), collChange, _debtChange);   
    
        emit CDPUpdated(_msgSender(), newDebt, newColl, stake); 
        return true;
    }

    // --- Helper functions --- 

    /* Converts the magnitude of an int to a uint
    TODO:  check validity for num in region (num > 2**255) or (num < -2**255) */
    function intToUint(int num) internal pure returns (uint) {
        if (num < 0) {
            return uint(-num);
        } else {
            return uint(num);
        }
    }

    function getUSDValue(uint _coll, uint _price) internal view returns (uint) {
        uint usdValue = _price.mul(_coll).div(1e18);

        return usdValue;
    }

    // Update trove's coll and debt based on whether they increase or decrease
    function updateTroveFromAdjustment(address _user, int _collChange, int _debtChange ) internal returns (uint, uint) {
        uint newColl = (_collChange > 0) ? cdpManager.increaseCDPColl(_user, intToUint(_collChange)) 
                                         : cdpManager.decreaseCDPColl(_user, intToUint(_collChange));
        uint newDebt = (_debtChange > 0) ? cdpManager.increaseCDPDebt(_user, intToUint(_debtChange)) 
                                         : cdpManager.decreaseCDPDebt(_user, intToUint(_debtChange));

        return (newColl, newDebt);
    }

    function moveTokensAndETHfromAdjustment(address _user, int _collChange, int _debtChange) internal {
        if (_collChange > 0 ) {
            poolManager.addColl.value(intToUint(_collChange))();
        } else if (_collChange < 0) {
            poolManager.withdrawColl(_user, intToUint(_collChange));
        }

        if (_debtChange > 0){
            poolManager.withdrawCLV(_user, intToUint(_debtChange));
        } else if (_debtChange < 0) {
            poolManager.repayCLV(_user, intToUint(_debtChange));
        }
    }
    
    // --- 'Require' wrapper functions ---

    function requireCDPisActive(uint status) internal view {
        require(status == 1, "CDPManager: CDP does not exist or is closed");
    }

    function requireNotInRecoveryMode() internal view {
        require(checkRecoveryMode() == false, "CDPManager: Operation not permitted during Recovery Mode");
    }

    function requireICRisAboveMCR(uint _newICR)  internal view {
        require(_newICR >= MCR, "CDPManager: An operation that would result in ICR < MCR is not permitted");
    }

    function requireNewTCRisAboveCCR(int _collChange, int _debtChange, uint _price) internal view {
        uint newTCR = getNewTCRFromTroveChange(_collChange, _debtChange, _price);
        require(newTCR >= CCR, "CDPManager: An operation that would result in TCR < CCR is not permitted");
    }

    function requireCLVRepaymentAllowed(uint _currentDebt, int _debtChange) internal pure {
        if (_debtChange < 0) {
            require(intToUint(_debtChange) <= _currentDebt, "CDPManager: Amount repaid must not be larger than the CDP's debt");
        }
    }

    function requireValueIsGreaterThan20Dollars(uint _amount, uint _price) internal view {
         require(getUSDValue(_amount, _price) >= MIN_COLL_IN_USD,  
            "CDPManager: Collateral must have $USD value >= 20");
    }

    function requireNonZeroAmount(uint _amount) internal pure {
        require(_amount > 0, "CDPManager: Amount must be larger than 0");
    }

    function requireCollAmountIsWithdrawable(uint _currentColl, uint _collWithdrawal, uint _price) 
    internal 
    view 
    {
        if (_collWithdrawal > 0) {
            require(_collWithdrawal <= _currentColl, "CDPManager: Insufficient balance for ETH withdrawal");
            
            uint newColl = _currentColl.sub(_collWithdrawal);
            require(getUSDValue(newColl, _price) >= MIN_COLL_IN_USD || newColl == 0,
                "CDPManager: Remaining collateral must have $USD value >= 20, or be zero");
        }
    }

    // --- ICR and TCR checks ---

    // Compute the new collateral ratio, considering the change in coll and debt. Assumes 0 pending rewards.
    function getNewICRFromTroveChange(uint _coll, uint _debt, int _collChange, int _debtChange, uint _price) 
    view
    internal 
    returns(uint)
    {
        uint newColl = _coll;
        uint newDebt = _debt;

        if (_collChange > 0) {
            newColl = _coll.add(intToUint(_collChange));
        } else if (_collChange < 0) {
            newColl = _coll.sub(intToUint(_collChange));
        }

        if (_debtChange > 0) {
            newDebt = _debt.add(intToUint(_debtChange));
        } else if (_debtChange < 0) {
            newDebt = _debt.sub(intToUint(_debtChange));
        }

        return computeICR(newColl, newDebt, _price);
    }

    function getNewTCRFromTroveChange(int _collChange, int _debtChange, uint _price) internal view returns (uint) {
        uint totalColl = activePool.getETH().add(defaultPool.getETH());
        uint totalDebt = activePool.getCLV().add(defaultPool.getCLV());
       
        if (_collChange > 0) {
            totalColl = totalColl.add(intToUint(_collChange));
        } else if (_collChange < 0) {
            totalColl = totalColl.sub(intToUint(_collChange));
        }

        if (_debtChange > 0) {
            totalDebt = totalDebt.add(intToUint(_debtChange));
        } else if (_debtChange < 0) {
            totalDebt = totalDebt.sub(intToUint(_debtChange));
        }

        uint newTCR = computeICR(totalColl, totalDebt, _price);
        return newTCR;
    }

    // --- Common helper functions, duplicated in CDPManager ---

    function checkRecoveryMode() internal view returns (bool){
        uint price = priceFeed.getPrice();

        uint activeColl = activePool.getETH();
        uint activeDebt = activePool.getCLV();
        uint liquidatedColl = defaultPool.getETH();
        uint closedDebt = defaultPool.getCLV();

        uint totalCollateral = activeColl.add(liquidatedColl);
        uint totalDebt = activeDebt.add(closedDebt); 

        uint TCR = computeICR(totalCollateral, totalDebt, price); 
        
        if (TCR < CCR) {
            return true;
        } else {
            return false;
        }
    }

    function computeICR(uint _coll, uint _debt, uint _price) view internal returns(uint) {
        // Check if the total debt is higher than 0, to avoid division by 0
        if (_debt > 0) {

            // Pure division to decimal
            uint newCollRatio = _coll.mul(_price).div(_debt);

            return newCollRatio;
        }
        // Return the maximal value for uint256 if the CDP has a debt of 0
        else {
            return (2**256) - 1; 
        }
    }
}




