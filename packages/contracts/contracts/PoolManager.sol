pragma solidity ^0.5.11;

import './Interfaces/IPool.sol';
import './Interfaces/IPoolManager.sol';
import './Interfaces/ICDPManager.sol';
import './Interfaces/IStabilityPool.sol';
import './Interfaces/IPriceFeed.sol';
import './Interfaces/ICLVToken.sol';
import './DeciMath.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/ownership/Ownable.sol';
import '@nomiclabs/buidler/console.sol';

// PoolManager maintains all pools 
contract PoolManager is Ownable, IPoolManager {
    using SafeMath for uint;

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
    event UserDepositChanged(address indexed _user, uint _amount);
    event OverstayPenaltyClaimed(address claimant, uint claimantReward, address depositor, uint remainder);

    // --- Connected contract declarations ---
    address public cdpManagerAddress;
    ICDPManager cdpManager = ICDPManager(cdpManagerAddress);

    IPriceFeed priceFeed;
    address public priceFeedAddress;

    ICLVToken CLV;
    address public clvAddress;

    IStabilityPool public stabilityPool;
    address public stabilityPoolAddress;

    IPool public activePool;
    address public activePoolAddress;

    IPool public defaultPool;
    address public defaultPoolAddress;
   
   // --- Data structures ---
   
    mapping (address => uint) public deposit;

    struct Snapshot {
        uint ETH;
        uint CLV;
    }
    
    /* Track the sums of accumulated rewards per unit staked: S_CLV and S_ETH. During it's lifetime, each deposit earns:

    A CLV *loss* of ( deposit * [S_CLV - S_CLV(0)] )
    An ETH *gain* of ( deposit * [S_ETH - S_ETH(0)] )
    
    Where S_CLV(0) and S_ETH(0) are snapshots of S_CLV and S_ETH taken at the instant the deposit was made */
    uint public S_CLV;
    uint public S_ETH;

    // Map users to their individual snapshots of S_CLV and the S_ETH
    mapping (address => Snapshot) public snapshot;

    // --- Modifiers ---
    modifier onlyCDPManager() {
        require(_msgSender() == cdpManagerAddress, "PoolManager: Caller is not the CDPManager");
        _;
    }

    modifier onlyCDPManagerOrUserIsSender(address _user) {
        require(_msgSender()  == cdpManagerAddress || _user == _msgSender(),
        "PoolManager: Target CDP must be _msgSender(), otherwise caller must be CDPManager");
        _;
    }
    modifier onlyStabilityPoolorActivePool {
        require(
            _msgSender() == stabilityPoolAddress ||  _msgSender() ==  activePoolAddress, 
            "PoolManager: Caller is neither StabilityPool nor ActivePool");
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

    function setStabilityPool(address _stabilityPoolAddress) public onlyOwner {
        stabilityPoolAddress = _stabilityPoolAddress;
        stabilityPool = IStabilityPool(stabilityPoolAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
    }

    function setActivePool(address _activePoolAddress) public onlyOwner {
        activePoolAddress = _activePoolAddress;
        activePool = IPool(activePoolAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
    }

    function setDefaultPool(address _defaultPoolAddress) public onlyOwner {
        defaultPoolAddress = _defaultPoolAddress;
        defaultPool = IPool(defaultPoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
    }

    // --- Getters ---

    // Return the current ETH balance of the PoolManager contract
    function getBalance() public view returns(uint) {
        return address(this).balance;
    } 
    
    // Return the total collateral ratio (TCR) of the system, based on the most recent ETH:USD price
    function getTCR() view public returns (uint) {
        uint totalCollateral = activePool.getETH();
        uint totalDebt = activePool.getCLV();
        uint price = priceFeed.getPrice();

        // Handle edge cases of div-by-0
        if(totalCollateral == 0 && totalDebt == 0 ) {
            return 1;
        }  else if (totalCollateral != 0 && totalDebt == 0 ) {
            return 2**256 - 1; // TCR is technically infinite
        }

        // Calculate TCR
        uint collToDebtRatio = DeciMath.div_toDuint(totalCollateral, totalDebt);
        uint TCR = DeciMath.mul_uintByDuint(price, collToDebtRatio);
        return TCR;
    }

    // Return the total active debt (in CLV) in the system
    function getActiveDebt()
        public
        view
        returns (uint)
    {
        return activePool.getCLV();
    }    
    
    // Return the total active collateral (in ETH) in the system
    function getActiveColl()
        public
        view
        returns (uint)
    {
        return activePool.getETH();
    } 
    
    // Return the amount of closed debt (in CLV)
    function getClosedDebt()
        public
        view
        returns (uint)
    {
        return defaultPool.getCLV();
    }    
    
    // Return the amount of closed collateral (in ETH)
    function getLiquidatedColl()
        public
        view
        returns (uint)
    {
        return defaultPool.getETH();
    }
    
    // Return the total CLV in the Stability Pool
    function getStabilityPoolCLV()
        public
        view
        returns (uint)
    {
        return stabilityPool.getCLV();
    }
    
    // Add the received ETH to the total active collateral
    function addColl()
        public
        payable
        onlyCDPManager
        returns (bool)
    {
        // Send ETH to Active Pool and increase its recorded ETH balance
       (bool success, ) = activePoolAddress.call.value(msg.value)("");
       require (success == true, 'PoolManager: transaction to activePool reverted');
       return success;
    }
    
    // Transfer the specified amount of ETH to _account and updates the total active collateral
    function withdrawColl(address _account, uint _ETH)
        public
        onlyCDPManager
        returns (bool)
    {
        activePool.sendETH(_account, _ETH);
        return true;
    }
    
    // Issue the specified amount of CLV to _account and increases the total active debt
    function withdrawCLV(address _account, uint _CLV)
        public
        onlyCDPManager
        returns (bool)
    {
        activePool.increaseCLV(_CLV);
        CLV.mint(_account, _CLV);
                
        return true;
    }
    
    // Burn the specified amount of CLV from _account and decreases the total active debt
    function repayCLV(address _account, uint _CLV)
        public
        onlyCDPManager
        returns (bool)
    {
        activePool.decreaseCLV(_CLV);
        CLV.burn(_account, _CLV);
        
        return true;
    }           
    
    // Update the Active Pool and the Default Pool when a CDP gets closed
    function liquidate(uint _CLV, uint _ETH)
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

    // Update the Active Pool and the Default Pool when a CDP obtains a default share
    function applyPendingRewards(uint _CLV, uint _ETH)
        public
        onlyCDPManager
        returns (bool)
    {
        // Transfer the debt & coll from the Default Pool to the Active Pool
        // console.log("00. gas left: %s", gasleft());
        defaultPool.decreaseCLV(_CLV);  // 8300 gas (no rewards)
        // console.log("01. gas left: %s", gasleft());
        activePool.increaseCLV(_CLV); // 8200 gas (no rewards)
        // console.log("02. gas left: %s", gasleft());
        defaultPool.sendETH(activePoolAddress, _ETH); // 16000 gas (no rewards)
        // console.log("03. gas left: %s", gasleft());

        return true;
    }

    // Burn the received CLV, transfers the redeemed ETH to _account and updates the Active Pool
    function redeemCollateral(address _account, uint _CLV, uint _ETH)
        public
        onlyCDPManager
        returns (bool)
    {
        // Update Active Pool CLV, and send ETH to account
        // console.log("00. gas left: %s", gasleft());
        activePool.decreaseCLV(_CLV);  // 10500 gas
        // console.log("01. gas left: %s", gasleft());
        activePool.sendETH(_account, _ETH); // 20300 gas
        // console.log("02. gas left: %s", gasleft());

        CLV.burn(_account, _CLV); // 22500 gas
        // console.log("03. gas left: %s", gasleft()); 

        return true;
    }

    // Return the accumulated change, for the user, for the duration that this deposit was held
    function getCurrentETHGain(address _user) internal view returns(uint) {
        uint userDeposit = deposit[_user];
        uint snapshotETH = snapshot[_user].ETH;  // duint
        uint ETHGainPerUnitStaked = S_ETH.sub(snapshotETH);  // duint

        return DeciMath.mul_uintByDuint(userDeposit, ETHGainPerUnitStaked); // uint
    }

    function getCurrentCLVLoss(address _user) internal view returns(uint) {
        uint userDeposit = deposit[_user];
        uint snapshotCLV = snapshot[_user].CLV; // duint
        uint CLVLossPerUnitStaked = S_CLV.sub(snapshotCLV); // duint

        return DeciMath.mul_uintByDuint(userDeposit, CLVLossPerUnitStaked); // uint
    }

    // --- Internal StabilityPool functions --- 

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
    function retrieveToUser(address _address) internal returns(uint[2] memory) {
        uint userDeposit = deposit[_address];

        uint ETHShare = getCurrentETHGain(_address);
        uint CLVLoss = getCurrentCLVLoss(_address);
        uint CLVShare;

        // If user's deposit is an 'overstay', they retrieve 0 CLV
        if (CLVLoss > userDeposit) {
            CLVShare = 0;
        } else {
            CLVShare = userDeposit.sub(CLVLoss);
        }

        // Update deposit and snapshots
        deposit[_address] = 0;

        snapshot[_address].CLV = S_CLV;
        snapshot[_address].ETH = S_ETH;

        emit UserDepositChanged(_address, deposit[_address]);
        emit UserSnapshotUpdated(S_CLV, S_ETH);

        // Send CLV to user and decrease CLV in Pool
        CLV.returnFromPool(stabilityPoolAddress, _address, DeciMath.getMin(CLVShare, stabilityPool.getCLV()));
        stabilityPool.decreaseCLV(CLVShare);
        stabilityPool.decreaseTotalCLVDeposits(userDeposit);

        // Send ETH to user
        stabilityPool.sendETH(_address, ETHShare);

        uint[2] memory shares = [CLVShare, ETHShare];
        return shares;
    }

    // Transfer _address's entitled CLV (userDeposit - CLVLoss) to _address, and their ETHGain to their CDP.
    function retrieveToCDP(address _address) internal returns(uint[2] memory) {
        uint userDeposit = deposit[_address];
        require(userDeposit > 0, 'PoolManager: User must have a non-zero deposit');
        
        uint ETHShare = getCurrentETHGain(_address);
        uint CLVLoss = getCurrentCLVLoss(_address);

        uint CLVShare;

        // If user's deposit is an 'overstay', they retrieve 0 CLV
        if (CLVLoss > userDeposit) {
            CLVShare = 0;
        } else {
            CLVShare = userDeposit.sub(CLVLoss);
        }

        // Update deposit and snapshots
        deposit[_address] = 0;

        snapshot[_address].CLV = S_CLV;
        snapshot[_address].ETH = S_ETH;

        emit UserDepositChanged(_address, deposit[_address]);
        emit UserSnapshotUpdated(S_CLV, S_ETH);

        // Send CLV to user and decrease CLV in StabilityPool
        CLV.returnFromPool(stabilityPoolAddress, _address, DeciMath.getMin(CLVShare, stabilityPool.getCLV()));
        stabilityPool.decreaseCLV(CLVShare);
        stabilityPool.decreaseTotalCLVDeposits(userDeposit);

        // Pull ETHShare from StabilityPool, and send to CDP
        stabilityPool.sendETH(address(this), ETHShare);
        //TODO: Potentially use getApproxHint() here
        cdpManager.addColl.value(ETHShare)(_address, _address);
        
        uint[2] memory shares = [CLVShare, ETHShare];
        return shares;
    }

    // --- External StabilityPool Functions ---

    /* Send ETHGain to user's address, and updates their deposit, 
    setting newDeposit = (oldDeposit - CLVLoss) + amount. */
    function provideToSP(uint _amount) external returns(bool) {
        cdpManager.checkTCRAndSetRecoveryMode();

        address user = _msgSender();
        uint[2] memory returnedVals = retrieveToUser(user);

        uint returnedCLV = returnedVals[0];

        uint newDeposit = returnedCLV + _amount;
        depositCLV(msg.sender, newDeposit);

        return true;
    }

    /* Withdraw _amount of CLV and the caller’s entire ETHGain from the 
    Stability Pool, and updates the caller’s reduced deposit. 

    If  _amount is 0, the user only withdraws their ETHGain, no CLV.
    If _amount > (userDeposit - CLVLoss), the user withdraws all their ETHGain and all available CLV.

    In all cases, the entire ETHGain is sent to user, and the CLVLoss is applied to their deposit. */
    function withdrawFromSP(uint _amount) external returns(bool) {
        cdpManager.checkTCRAndSetRecoveryMode();

        address user = _msgSender();
        uint userDeposit = deposit[user];
        require(userDeposit > 0, 'PoolManager: User must have a non-zero deposit');

        // Retrieve all CLV and ETH for the user
        uint[2] memory returnedVals = retrieveToUser(user);

        uint returnedCLV = returnedVals[0];

        // If requested withdrawal amount is less than available CLV, re-deposit the difference.
        if (_amount < returnedCLV) {
            depositCLV(user, returnedCLV.sub(_amount));
        }

        return true;
    }

    /* Transfer the caller’s entire ETHGain from the Stability Pool to the caller’s CDP. 
    Applies their CLVLoss to the deposit. */
    function withdrawFromSPtoCDP(address _user) external onlyCDPManagerOrUserIsSender(_user) returns(bool) {
        cdpManager.checkTCRAndSetRecoveryMode();

        uint userDeposit = deposit[_user];
        if (userDeposit == 0) { return false; }

        // Retrieve all CLV to user's CLV balance, and ETH to their CDP
        uint[2] memory returnedVals = retrieveToCDP(_user);

        uint returnedCLV = returnedVals[0];

        // Update deposit, applying CLVLoss
        depositCLV(_user, returnedCLV);

        return true;
    }

    /* Withdraw a 'penalty' fraction of an overstayed depositor's ETHGain.  
    
    Callable by anyone when _depositor's CLVLoss > deposit. */
    function withdrawPenaltyFromSP(address _address) external returns(bool) {
        cdpManager.checkTCRAndSetRecoveryMode();

        address claimant = _msgSender();
        address depositor = _address;
        
        uint CLVLoss = getCurrentCLVLoss(depositor);
        uint depositAmount = deposit[depositor];
        require(CLVLoss > depositAmount, "PoolManager: depositor has not overstayed");

        uint ETHGain = getCurrentETHGain(depositor);

        /* Depositor is penalised for overstaying - i.e. letting CLVLoss grow larger than their deposit.
       
        Depositor's ETH entitlement is reduced to ETHGain * (deposit/CLVLoss).
        The claimant retrieves ETHGain * (1 - deposit/CLVLoss). */
        uint ratio = DeciMath.div_toDuint(depositAmount, CLVLoss);  // duint
        uint depositorRemainder = DeciMath.mul_uintByDuint(ETHGain, ratio); // uint
        uint claimantReward = ETHGain.sub(depositorRemainder);
        
        // Update deposit and snapshots
        deposit[depositor] = 0;
        snapshot[depositor].CLV = S_CLV;
        snapshot[depositor].ETH = S_ETH;

        emit UserDepositChanged(depositor, deposit[depositor]);
        emit UserSnapshotUpdated(S_CLV, S_ETH);

        // Send reward to claimant, and remainder to depositor
        stabilityPool.sendETH(claimant, claimantReward);
        stabilityPool.sendETH(depositor, depositorRemainder);
        emit OverstayPenaltyClaimed(claimant, claimantReward, depositor, depositorRemainder);

        return true;
    }

     /* Cancel out the specified _debt against the CLV contained in the Stability Pool (as far as possible)  
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
        uint debtToOffset = DeciMath.getMin(_debt, CLVinPool);
        // Collateral to be added in proportion to the debt that is cancelled
        uint debtRatio =  DeciMath.div_toDuint(debtToOffset, _debt);
        uint collToAdd = DeciMath.mul_uintByDuint(_coll, debtRatio);
        
        // Update the running total S_CLV by adding the ratio between the distributed debt and the CLV in the pool
        uint CLVLossPerUnitStaked = DeciMath.div_toDuint(debtToOffset, totalCLVDeposits);
        S_CLV = S_CLV.add(CLVLossPerUnitStaked);
        emit S_CLVUpdated(S_CLV);
        // Update the running total S_ETH by adding the ratio between the distributed collateral and the ETH in the pool
        uint ETHGainPerUnitStaked = DeciMath.div_toDuint(collToAdd, totalCLVDeposits);
        S_ETH = S_ETH.add(ETHGainPerUnitStaked);
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

    function () external payable onlyStabilityPoolorActivePool {}
}    