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
    event OverstayPenaltyClaimed(address claimant, uint claimantReward, address depositor, uint remainder);

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

    // return the accumulated change, for the user, for the duration that this deposit was held

    function getCurrentETHGain(address _user) internal view returns(uint) {
        uint userDeposit = deposit[_user];
        uint snapshotETH = snapshot[_user].ETH;
        uint rewardPerUnitStaked = S_ETH.sub(snapshotETH);
        return DeciMath.accurateMulDiv(userDeposit, rewardPerUnitStaked, DIGITS);
    }

    function getCurrentCLVLoss(address _user) internal view returns(uint) {
        uint userDeposit = deposit[_user];
        uint snapshotCLV = snapshot[_user].CLV;
        uint rewardPerUnitStaked = S_CLV.sub(snapshotCLV);
        return DeciMath.accurateMulDiv(userDeposit, rewardPerUnitStaked, DIGITS);
    }

    // --- Internal  StabilityPool functions --- 

    /* Cancels out the specified _debt against the CLV contained in the Stability Pool (as far as possible)  
    and transfers the CDP's ETH collateral from ActivePool to StabilityPool. 
    Returns the amount of debt that could not be cancelled, and the corresponding ether.
    Only callable from close() and closeCDPs() functions in CDPManager */
    function offset(uint _debt, uint _coll) external payable onlyCDPManager returns (uint[2] memory) 
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
    
    // Deposit _amount CLV from _address, to the Stability Pool.
    function depositCLV(address _address, uint _amount) internal returns(bool) {
        require(deposit[_address] == 0, "PoolManager: user already has a StabilityPool deposit");
        require(CLV.balanceOf(_address) >= _amount, "PoolManager: user has insufficient CLV balance to make deposit");
        
        // Transfer the CLV tokens from the user to the Stability Pool's address, and update its recorded CLV
        CLV.sendToPool(_address, stabilityPoolAddress, _amount);
        stabilityPool.increaseCLV(_amount);
        stabilityPool.increaseTotalCLVDeposits(_amount);
        
        // Record the deposit made by user
        deposit[_address] = _amount;
    
        // Record new individual snapshots of the running totals S_CLV and S_ETH for the user
        snapshot[_address].CLV = S_CLV;
        snapshot[_address].ETH = S_ETH;

        emit UserSnapshotUpdated(S_CLV, S_ETH);
        emit UserDepositChanged(_address, _amount);
        return true;
    }

   // Transfers _address's entitled CLV (CLVDeposit - CLVLoss) and their ETHGain, to _address.
    function retrieveToUser(address payable _address) internal returns(uint[2] memory) {
        uint userDeposit = deposit[_address];

        uint ETHShare = getCurrentETHGain(_address);
        uint CLVLoss = getCurrentCLVLoss(_address);
        uint CLVShare;

        // If user's deposit is an 'overstay', they retrieve 0 CLV
        if (CLVLoss > userDeposit) {
            CLVShare = 0;
        } else {
            CLVShare = userDeposit - CLVLoss;
        }

        // update deposit and snapshots
        deposit[_address] = 0;

        snapshot[_address].CLV = S_CLV;
        snapshot[_address].ETH = S_ETH;

        emit UserDepositChanged(_address, deposit[_address]);
        emit UserSnapshotUpdated(S_CLV, S_ETH);

        // send CLV to user and decrease CLV in Pool
        CLV.returnFromPool(stabilityPoolAddress, _address, getMin(CLVShare, stabilityPool.getCLV()));
        stabilityPool.decreaseCLV(CLVShare);
        stabilityPool.decreaseTotalCLVDeposits(userDeposit);

        // send ETH to user
        stabilityPool.sendETH(_address, ETHShare);

        uint[2] memory shares = [CLVShare, ETHShare];
        return shares;
    }

    // Transfers _address's entitled CLV (CLVDeposit - CLVLoss) to _address, and their ETHGain to their CDP.
    function retrieveToCDP(address payable _address) internal returns(uint[2] memory) {
        uint userDeposit = deposit[_address];
        require(cdpManager.hasActiveCDP(_address), "Address must have an active CDP");

        uint ETHShare = getCurrentETHGain(_address);
        uint CLVLoss = getCurrentCLVLoss(_address);
        uint CLVShare;

        // If user's deposit is an 'overstay', they retrieve 0 CLV
        if (CLVLoss > userDeposit) {
            CLVShare = 0;
        } else {
            CLVShare = userDeposit - CLVLoss;
        }

        // update deposit and snapshots
        deposit[_address] = 0;

        snapshot[_address].CLV = S_CLV;
        snapshot[_address].ETH = S_ETH;

        emit UserDepositChanged(_address, deposit[_address]);
        emit UserSnapshotUpdated(S_CLV, S_ETH);

        // send CLV to user and decrease CLV in Pool
        CLV.returnFromPool(stabilityPoolAddress, _address, getMin(CLVShare, stabilityPool.getCLV()));
        stabilityPool.decreaseCLV(CLVShare);
        stabilityPool.decreaseTotalCLVDeposits(userDeposit);

        // send ETH to CDP
        cdpManager.sendETHGainToCDP(_address, ETHShare);
        stabilityPool.sendETH(activePoolAddress, ETHShare);
        
        uint[2] memory shares = [CLVShare, ETHShare];
        return shares;
    }

    // --- Public StabilityPool Functions ---

    /* Sends ETHGain to user's address, and updates their deposit, 
    setting newDeposit = (oldDeposit - CLVLoss) + amount. */
    function provideToSP(uint _amount) external returns(bool) {
        address payable user = _msgSender();

        uint[2] memory returnedVals = retrieveToUser(user);

        uint returnedCLV = returnedVals[0];

        uint newDeposit = returnedCLV + _amount;
        depositCLV(msg.sender, newDeposit);

        return true;
    }

    /* Withdraws _amount of CLV and the caller’s entire ETHGain from the 
    Stability Pool, and updates the caller’s reduced deposit. 

    If  _amount is 0, the user only withdraws their ETHGain, no CLV.

    In all cases, ETHGain is sent to user, and CLVLoss is applied to their deposit. */
    function withdrawFromSP(uint _amount) external returns(bool) {
        address payable user = _msgSender();
        uint userDeposit = deposit[user];
        uint CLVLoss = getCurrentCLVLoss(user);

        require(userDeposit >= CLVLoss, 'PoolManager: User must have net-positive CLV to withdraw');
        require(userDeposit > 0, 'PoolManager: User must have a non-zero deposit');

        // retrieve all CLV and ETH for the user
        uint[2] memory returnedVals = retrieveToUser(user);

        uint returnedCLV = returnedVals[0];

        uint newDeposit; 

        // if requested withdrawal amount is greater than available CLV, simply withdraw it all.
        if (_amount > returnedCLV) { 
            newDeposit = 0; 
        } else {
            newDeposit = (returnedCLV - _amount);
        }
        depositCLV(msg.sender, newDeposit);

        return true;
    }

    /* Transfers the caller’s entire ETHGain from the Stability Pool to the caller’s CDP. 
    Applies their CLVLoss to the deposit. */
    function withdrawFromSPtoCDP() external returns(bool) {
        address payable user = _msgSender();
        uint userDeposit = deposit[user];
        uint CLVLoss = getCurrentCLVLoss(user);

        require(userDeposit >= CLVLoss, 'PoolManager: User must have net-positive CLV to withdraw');
        require(userDeposit > 0, 'PoolManager: User must have a non-zero deposit');

        // retrieve all CLV to user's CLV balance, and ETH to their CDP
        uint[2] memory returnedVals = retrieveToCDP(user);

        uint returnedCLV = returnedVals[0];

        // update deposit, applying CLVLoss
        depositCLV(msg.sender, returnedCLV);

        return true;
    }

    /* Withdraws a 'penalty' fraction of an overstayed depositor's ETHGain.  
    
    Callable by anyone when _depositor's CLVLoss > deposit. */
    function withdrawPenaltyFromSP(address payable _address) external returns(bool) {
        address payable claimant = _msgSender();
        address payable depositor = _address;
        require(claimant != depositor, "PoolManager: depositor may not claim their own penalty");
        
        uint CLVLoss = getCurrentCLVLoss(depositor);
        uint depositAmount = deposit[depositor];
        require(CLVLoss > depositAmount, "PoolManager: depositor has not overstayed");

        uint ETHGain = getCurrentETHGain(depositor);

        /* Depositor is penalised for overstaying - i.e. letting CLVLoss grow larger than their deposit.
       
        Their ETH entitlement is reduced to ETHGain * (deposit/CLVLoss).
        The claimant retrieves ETHGain * (1 - deposit/CLVLoss). */
        uint ratio = DeciMath.accurateMulDiv(depositAmount, DIGITS, CLVLoss);
        uint claimantReward = (ETHGain.mul(DIGITS.sub(ratio))).div(DIGITS);
        uint remainder = ETHGain.sub(claimantReward);
        
        // update deposit and snapshots
        deposit[depositor] = 0;
        snapshot[depositor].CLV = S_CLV;
        snapshot[depositor].ETH = S_ETH;

        emit UserDepositChanged(depositor, deposit[depositor]);
        emit UserSnapshotUpdated(S_CLV, S_ETH);

        // send reward to claimant, and remainder to depositor
        stabilityPool.sendETH(claimant, claimantReward);
        stabilityPool.sendETH(depositor, remainder);
        emit OverstayPenaltyClaimed(claimant, claimantReward, depositor, remainder);

        return true;
    }
}    