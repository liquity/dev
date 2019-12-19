pragma solidity ^0.5.11;

import './IPool.sol';
import './IPoolManager.sol';
import './ICDPManager.sol';
import './IStabilityPool.sol';
import './IPriceFeed.sol';
import './ICLVToken.sol';
import './DeciMath.sol';
import '../node_modules/@openzeppelin/contracts/math/SafeMath.sol';
import '../node_modules/@openzeppelin/contracts/ownership/Ownable.sol';

// PoolManager maintains all pools 
contract PoolManager is Ownable, IPoolManager {
    using SafeMath for uint;

    uint constant DIGITS = 1e18;

    // --- Events ---
    event CDPManagerAddressChanged(address _newCDPManagerAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event CLVTokenAddressChanged(address _newCLVTokenAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    event UserSnapshotUpdated(uint _CLV, uint _ETH);
    event S_CLVUpdated(uint _S_CLV);
    event S_ETHUpdated(uint _S_ETH);
    event UserDepositChanged(address _user, uint _amount);
    event EntitledETHRetrieved(address user, uint entitledETH);

    // --- Connected contract declarations ---
    address public cdpManagerAddress;
    ICDPManager cdpManager = ICDPManager(cdpManagerAddress);

    IPriceFeed priceFeed;
    address public priceFeedAddress;

    ICLVToken CLV; 
    address public clvAddress;

    IStabilityPool public stabilityPool;
    address payable public stabilityPoolAddress;

    IPool public activePool;
    address payable public activePoolAddress;

    IPool public defaultPool;
    address payable public defaultPoolAddress;
   
   // --- Data structures ---
   
    mapping (address => uint) public deposit; 

      struct Snapshot {
        uint ETH;
        uint CLV;
    }
    
    uint public S_CLV; // A running total of the CLV fractions for gas-efficient share calculation
    uint public S_ETH; // A running total of the ETH fractions for gas-efficient share calculation
    mapping (address => Snapshot) public snapshot; // A map of individual snapshots of the S_CLV and the current StabilityPool.ETH values
    
     /* track the sum of users' total pending CLV and ETH changes earned by their deposit history.
    The total pending is updated whenever user increases their deposit, or make a partial withdrawal.
    
    During it's lifetime, each deposit earns:

    A CLV *loss* of ( deposit * [S_CLV - S_CLV(0)] )
    An ETH *gain* of ( deposit * [S_ETH - S_ETH(0)] )

    which is added to these running totals. */
    mapping (address => uint) public totalPendingCLVLoss;
    mapping (address => uint) public totalPendingETHGain;

    /* track the realised StabilityPool ETH gains a user has earned due to deposit withdrawals, but 
    chosen to not cash out */
    mapping (address => uint) public entitledETHGain;
    enum Destination { sendToUser, sendToCDP, keepInPool }
    
    // --- Modifiers ---
    modifier onlyCDPManager() {
        require(_msgSender() == cdpManagerAddress, "PoolManager: Caller is not the CDPManager");
        _;
    }

    constructor() public {}

    // --- Dependency setters ---
    function setCDPManagerAddress(address _cdpManagerAddress) public onlyOwner {
        cdpManagerAddress = _cdpManagerAddress;
        cdpManager = ICDPManager(_cdpManagerAddress);
        emit CDPManagerAddressChanged(_cdpManagerAddress);
    }

     function setPriceFeed(address _priceFeedAddress) public onlyOwner {
        priceFeedAddress = _priceFeedAddress;
        priceFeed = IPriceFeed(_priceFeedAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
    }

    function setCLVToken(address _CLVAddress) public onlyOwner {
        clvAddress = _CLVAddress;
        CLV = ICLVToken(_CLVAddress); 
        emit CLVTokenAddressChanged(_CLVAddress);
    }

    function setStabilityPool(address payable _stabilityPoolAddress) public onlyOwner {
        stabilityPoolAddress = _stabilityPoolAddress;
        stabilityPool = IStabilityPool(stabilityPoolAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
    }

    function setActivePool(address payable _activePoolAddress) public onlyOwner {
        activePoolAddress = _activePoolAddress;
        activePool = IPool(activePoolAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
    }

    function setDefaultPool(address payable _defaultPoolAddress) public onlyOwner {
        defaultPoolAddress = _defaultPoolAddress;
        defaultPool = IPool(defaultPoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
    }

    // --- Getters ---
    function getAccurateMulDiv(uint x, uint y, uint z) public pure returns(uint) {
        return DeciMath.accurateMulDiv(x, y, z);
    }

    // Returns the total collateral ratio of the system
    function getTCR() 
        view 
        public 
        returns (uint) 
    {
        uint activePoolETH = activePool.getETH();
        uint activePoolCLV = activePool.getCLV();
        uint price = priceFeed.getPrice();
        
        // Handle edge cases of div by 0
        if(activePoolETH == 0 && activePoolCLV == 0 ) { 
            return 1;
        }  else if (activePoolETH != 0 && activePoolCLV == 0 ) {
            return 2**256 - 1; // TCR is technically infinite
        }

        // calculate TCR
        return DeciMath.accurateMulDiv(activePoolETH, price, activePoolCLV);
    }
    
    // Returns the current ETH balance of the TokenPools contract
    function getBalance() 
        public
        view
        returns (uint)
    {
        return address(this).balance;
    } 
    
    // Returns the total active debt (in CLV) in the system
    function getActiveDebt() 
        public
        view
        returns (uint)
    {
        return activePool.getCLV();
    }    
    
    // Returns the total active collateral (in ETH) in the system
    function getActiveColl() 
        public
        view
        returns (uint)
    {
        return activePool.getETH();
    } 
    
    // Returns the amount of closed debt (in CLV)
    function getClosedDebt() 
        public
        view
        returns (uint)
    {
        return defaultPool.getCLV();
    }    
    
    // Returns the amount of closed collateral (in ETH)
    function getClosedColl() 
        public
        view
        returns (uint)
    {
        return defaultPool.getETH();
    }  
    
    // Returns the lower value from two given integers
    function getMin(uint a, uint b) 
        public
        pure
        returns (uint)
    {
        if (a <= b) return a;
        else return b;
    }    
    
    // Adds the received ETH to the total active collateral
    function addColl()
        public
        payable
        onlyCDPManager
        returns (bool)
    {
        // send ETH to Active Pool and increase its recorded ETH balance 
       (bool success, ) = activePoolAddress.call.value(msg.value)("");
       require (success == true, 'PoolManager: transaction to activePool reverted');
       return success;
    }
    
    // Transfers the specified amount of ETH to _account and updates the total active collateral 
    function withdrawColl(address payable _account, uint _ETH)
        public
        onlyCDPManager
        returns (bool)
    {
        activePool.sendETH(_account, _ETH);
        return true;
    }
    
    // Issues the specified amount of CLV to _account and increases the total active debt
    function withdrawCLV(address _account, uint _CLV)
        public
        onlyCDPManager
        returns (bool)
    {
        activePool.increaseCLV(_CLV);
        CLV.mint(_account, _CLV);
                
        return true;
    }
    
    // Burns the specified amount of CLV from _account and decreases the total active debt
    function repayCLV(address _account, uint _CLV)
        public
        onlyCDPManager
        returns (bool)
    {
        activePool.decreaseCLV(_CLV);
        CLV.burn(_account, _CLV);
        
        return true;
    }           
    
    // Updates the Active Pool and the Default Pool when a CDP gets closed
    function close(uint _CLV, uint _ETH)
        public
        onlyCDPManager
        returns (bool)
    {
        // Transfer the debt & coll from the Active Pool to the Default Pool
        defaultPool.increaseCLV(_CLV);
        activePool.decreaseCLV(_CLV);
        activePool.sendETH(defaultPoolAddress, _ETH);
        
        return true;
    }    
    
    // Updates the Active Pool and the Default Pool when a CDP obtains a default share
    function obtainDefaultShare(uint _CLV, uint _ETH)
        public
        onlyCDPManager
        returns (bool)
    {    
        // Transfer the debt & coll from the Default Pool to the Active Pool
        defaultPool.decreaseCLV(_CLV);
        activePool.increaseCLV(_CLV);
        defaultPool.sendETH(activePoolAddress, _ETH);
 
        return true;
    }
    
    // Burns the received CLV, transfers the redeemed ETH to _account and updates the Active Pool
    function redeemCollateral(address payable _account, uint _CLV, uint _ETH)
        public
        onlyCDPManager
        returns (bool)
    {    
        // Update Active Pool CLV, and send ETH to account
        activePool.decreaseCLV(_CLV);
        activePool.sendETH(_account, _ETH);
        
        CLV.burn(_account, _CLV);

        return true;
    }    

    // Deposits the specified amount to the Stability Pool using the algorithm from http://batog.info/papers/scalable-reward-distribution.pdf
    // Can be called directly by anybody, not just by the owner (CDP contract) 
    // TODO: Support multiple deposits by the same address
    function depositCLV( uint _amount) 
        public
        returns (bool)
    {
        address user = _msgSender();
        require(_amount > 0, "PoolManager: deposited amount must be larger than 0");
        require(CLV.balanceOf(user) >= _amount, "PoolManager: user has insufficient balance");
        
        // get cumulative changes earned by the most recent deposit
        uint recentCumulativeCLVChange = getCurrentCumulativeCLVChange(user, deposit[user]);
        uint recentCumulativeETHChange = getCurrentCumulativeETHChange(user, deposit[user]);

        // add cumulative changes to the total pending changes
        totalPendingCLVLoss[user] = totalPendingCLVLoss[user].add(recentCumulativeCLVChange);
        totalPendingETHGain[user] = totalPendingETHGain[user].add(recentCumulativeETHChange);

        // Transfer the CLV tokens from the user to the Stability Pool's address, and update its recorded CLV
        CLV.sendToPool(user, stabilityPoolAddress, _amount);
        stabilityPool.increaseCLV(_amount);
        stabilityPool.increaseTotalCLVDeposits(_amount);
        
        // Record the deposit made by user
        deposit[user] = deposit[user].add(_amount);
    
        // Record new individual snapshots of the running totals S_CLV and S_ETH for the user
        snapshot[user].CLV = S_CLV;
        snapshot[user].ETH = S_ETH;  // Should this be S_ETH?  Snapshot current accumulated proportional rewards?
        emit UserDepositChanged(user, _amount);
        return true;
    }   


    // return the accumulated proportional change, for the user, for the duration that this deposit was held
    function getCurrentCumulativeETHChange(address _user, uint _userDeposit) internal view returns(uint) {
       uint snapshotETH = snapshot[_user].ETH;
        uint rewardPerUnitStaked = S_ETH.sub(snapshotETH);
        return DeciMath.accurateMulDiv(_userDeposit, rewardPerUnitStaked, DIGITS);
    }

    function getCurrentCumulativeCLVChange(address _user, uint _userDeposit) internal view returns(uint) {
        uint snapshotCLV = snapshot[_user].CLV;
        uint rewardPerUnitStaked = S_CLV.sub(snapshotCLV);
        return DeciMath.accurateMulDiv(_userDeposit, rewardPerUnitStaked, DIGITS);
    }

    // TODO - rename.  "offsetAndLiquidate()" ?
    // Cancels out the specified _debt against the CLV contained in the Stability Pool (as far as possible)  
    // and transfers the CDP's ETH collateral from Active Pool to Stability Pool. 
    // Returns the amount of debt that could not be cancelled, and the corresponding ether.
    // Can only be called via the close(...) and closeCDPs(... ) functions in CDPManager
    function offset(uint _debt, uint _coll)
        public
        payable
        onlyCDPManager
        returns (uint[2] memory) // Note: it would be nicer to return this as a struct, but struct returns are still experimental
    {    
        uint[2] memory remainder;
        uint totalCLVDeposits = stabilityPool.getTotalCLVDeposits();
        uint CLVinPool = stabilityPool.getCLV();
        
        // When Stability Pool has no CLV or no deposits, return all debt and coll
        if (CLVinPool == 0 || totalCLVDeposits == 0 ) {
            remainder[0] = _debt;
            remainder[1] = _coll;
            return remainder;
        }
        
        // If the debt is larger than the deposited CLV, offset an amount of debt corresponding to the latter
        uint debtToOffset = getMin(_debt, CLVinPool);
        // Collateral to be added in proportion to the debt that is cancelled
        uint collToAdd =  DeciMath.accurateMulDiv(debtToOffset, _coll, _debt);
        
        // Update the running total S_CLV by adding the ratio between the distributed debt and the CLV in the pool
        S_CLV = S_CLV.add( DeciMath.accurateMulDiv(debtToOffset,  DIGITS, totalCLVDeposits) );
        emit S_CLVUpdated(S_CLV);
        // Update the running total S_ETH by adding the ratio between the distributed collateral and the ETH in the pool
        S_ETH = S_ETH.add( DeciMath.accurateMulDiv(collToAdd, DIGITS, totalCLVDeposits) );
        emit S_ETHUpdated(S_ETH);
        // Cancel the liquidated CLV debt with the CLV in the stability pool
        activePool.decreaseCLV(debtToOffset);  
        stabilityPool.decreaseCLV(debtToOffset); 
        // Send ETH from Active Pool to Stability Pool
        activePool.sendETH(stabilityPoolAddress, collToAdd);  
        
        // Burn the debt that was successfully offset
        CLV.burn(stabilityPoolAddress, debtToOffset);
        
        // Return the amount of debt & coll that could not be offset against the Stability Pool due to insufficiency
        remainder[0] = _debt.sub(debtToOffset);
        remainder[1] = _coll.sub(collToAdd);
        return remainder;
    }
    
    // Retrieves the caller's funds from the Stability Pool
    function retrieve(uint _amount, uint _destination ) 
        public
        returns (bool)
    {   
        address payable user = _msgSender();
        
        uint userDeposit = deposit[user];
        require(userDeposit > 0, "PoolManager: caller has no deposit");
        require (_amount <= userDeposit, "PoolManager: caller may not withdraw more than their deposit");
        // Calculate the CLV and ETH shares to be retrieved according http://batog.info/papers/scalable-reward-distribution.pdf

        uint fractionToRetrieve = (_amount.mul(DIGITS)).div(userDeposit);

        // get the cumulative changes for the user's most recent deposit value
        uint currentCLVLoss = getCurrentCumulativeCLVChange(user, userDeposit);
        uint currentETHGain = getCurrentCumulativeETHChange(user, userDeposit);
        // update totalPending CLV and ETH changes
        totalPendingCLVLoss[user] = totalPendingCLVLoss[user].add(currentCLVLoss);
        totalPendingETHGain[user] = totalPendingETHGain[user].add(currentETHGain);

        // get the fraction
        uint CLVShare = (fractionToRetrieve * userDeposit.sub(totalPendingCLVLoss[user])).div(DIGITS);
        uint ETHShare = (fractionToRetrieve * totalPendingETHGain[user]).div(DIGITS);
        
        /* update the total pending changes: reduce them by the right proportion, and add the remainder 
        // of the most recent cumulative change, that did not get fully paid out. */
        totalPendingCLVLoss[user] = ((DIGITS - fractionToRetrieve) * (totalPendingCLVLoss[user])).div(DIGITS);
        totalPendingETHGain[user] = ((DIGITS - fractionToRetrieve) * (totalPendingETHGain[user])).div(DIGITS);

        //update user's deposit record
        deposit[user] = ((DIGITS - fractionToRetrieve) * userDeposit).div(DIGITS);
        
        // record new snapshots 
        snapshot[user].CLV = S_CLV;
        snapshot[user].ETH = S_ETH;
        emit UserSnapshotUpdated(S_CLV, S_ETH);

        // TODO: Handle case where not enough CLV in pool to cover their share?
        CLV.returnFromPool(stabilityPoolAddress, user, getMin(CLVShare, stabilityPool.getCLV()));
        stabilityPool.decreaseCLV(CLVShare);
        stabilityPool.decreaseTotalCLVDeposits(_amount);

     /* Based on user's choices, redirect ETH to user's CDP, store for later retrieval, or send directly
     to user */
        sendETHShare(user, ETHShare, _destination);

        emit UserDepositChanged(user, deposit[user]);
        return true;
    }

    // send ETHShare to correct destination, according to user's choice
    function sendETHShare(address payable _user, uint ETHShare, uint _destination ) internal returns(bool) {
        bool userCDPisActive = cdpManager.hasActiveCDP(_user);

        uint sendToUser = uint(Destination.sendToUser);
        uint sendToCDP = uint(Destination.sendToCDP);
        uint keepInPool = uint(Destination.keepInPool);
        
        if (_destination == sendToCDP && userCDPisActive) {
            stabilityPool.sendETH(activePoolAddress, ETHShare);
            cdpManager.redirectETHBalanceToCDP(_user, ETHShare);

        } else if (_destination == keepInPool) {
            entitledETHGain[_user] = entitledETHGain[_user].add(ETHShare);

        } else if (_destination == sendToUser) {
            stabilityPool.sendETH(_user, ETHShare);
        }
        return true;
    }

    function retrieveEntitledETH() public returns(bool) {
        address payable user = _msgSender();
        uint entitledETH = entitledETHGain[user];
        entitledETHGain[user] = 0;
        stabilityPool.sendETH(user, entitledETH);
        emit EntitledETHRetrieved(user, entitledETH);
        return true;
    }
}    