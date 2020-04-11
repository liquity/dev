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
    
    event UserSnapshotUpdated(int128 _CLV, int128 _ETH);
    event S_CLVUpdated(int128 _S_CLV);
    event S_ETHUpdated(int128 _S_ETH);
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

    // Error trackers for the offset calculation
    uint lastETHError_Offset;
    uint lastCLVLossError_Offset;

    // A deposit is placed in a cohort that corresponds to the most recent liquidation offset with the Stability Pool. 

    mapping (uint => address[]) public cohorts;
    mapping (address => uint) public userToCohort;

    uint public currentCohort;
    uint public oldestActiveCohort;

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
        uint TCR = totalCollateral.mul(price).div(totalDebt);
        return TCR;
    }

    // Return the total active debt (in CLV) in the system
    function getActiveDebt() public view returns (uint) {
        return activePool.getCLV();
    }    
    
    // Return the total active collateral (in ETH) in the system
    function getActiveColl() public view returns (uint) {
        return activePool.getETH();
    } 
    
    // Return the amount of closed debt (in CLV)
    function getClosedDebt() public view returns (uint) {
        return defaultPool.getCLV();
    }    
    
    // Return the amount of closed collateral (in ETH)
    function getLiquidatedColl() public view returns (uint) {
        return defaultPool.getETH();
    }
    
    // Return the total CLV in the Stability Pool
    function getStabilityPoolCLV() public view returns (uint) {
        return stabilityPool.getCLV();
    }
    
    // Add the received ETH to the total active collateral
    function addColl() public payable onlyCDPManager returns (bool) {
        // Send ETH to Active Pool and increase its recorded ETH balance
       (bool success, ) = activePoolAddress.call.value(msg.value)("");
       require (success == true, 'PoolManager: transaction to activePool reverted');
       return success;
    }
    
    // Transfer the specified amount of ETH to _account and updates the total active collateral
    function withdrawColl(address _account, uint _ETH) public onlyCDPManager returns (bool) {
        activePool.sendETH(_account, _ETH);
        return true;
    }
    
    // Issue the specified amount of CLV to _account and increases the total active debt
    function withdrawCLV(address _account, uint _CLV) public onlyCDPManager returns (bool) {
        activePool.increaseCLV(_CLV);  // 9500
        CLV.mint(_account, _CLV);  // 37500
         
        return true;
    }
    
    // Burn the specified amount of CLV from _account and decreases the total active debt
    function repayCLV(address _account, uint _CLV) public onlyCDPManager returns (bool) {
        activePool.decreaseCLV(_CLV);
        CLV.burn(_account, _CLV);
        return true;
    }           
    
    // Update the Active Pool and the Default Pool when a CDP gets closed
    function liquidate(uint _CLV, uint _ETH) public onlyCDPManager returns (bool) {
        // Transfer the debt & coll from the Active Pool to the Default Pool
        defaultPool.increaseCLV(_CLV);
        activePool.decreaseCLV(_CLV);
        activePool.sendETH(defaultPoolAddress, _ETH);

        return true;
    }

    // Update the Active Pool and the Default Pool when a CDP obtains a default share
    function applyPendingRewards(uint _CLV, uint _ETH) public onlyCDPManager returns (bool) {
        // Transfer the debt & coll from the Default Pool to the Active Pool
        defaultPool.decreaseCLV(_CLV);  
        activePool.increaseCLV(_CLV); 
        defaultPool.sendETH(activePoolAddress, _ETH); 
 
        return true;
    }

    // Burn the received CLV, transfers the redeemed ETH to _account and updates the Active Pool
    function redeemCollateral(address _account, uint _CLV, uint _ETH) public onlyCDPManager returns (bool) {
        // Update Active Pool CLV, and send ETH to account
        activePool.decreaseCLV(_CLV);  
        activePool.sendETH(_account, _ETH); 

        CLV.burn(_account, _CLV); 
        return true;
    }

    // Return the accumulated change, for the user, for the duration that this deposit was held
    function getCurrentETHGain(address _user) public view returns(uint) {
        uint snapshotETH = snapshot[_user].ETH;  
        uint ETHGainPerUnitStaked = S_ETH.sub(snapshotETH); 

        if (ETHGainPerUnitStaked == 0) { return 0; }
      
        uint userDeposit = deposit[_user];

        return userDeposit.mul(ETHGainPerUnitStaked).div(1e18);
    }

    function getCurrentCLVLoss(address _user) internal view returns(uint) {
        uint snapshotCLV = snapshot[_user].CLV; 
        uint CLVLossPerUnitStaked = S_CLV.sub(snapshotCLV); 

        if (CLVLossPerUnitStaked == 0) { return 0; }
    
        uint userDeposit = deposit[_user];

        return userDeposit.mul(CLVLossPerUnitStaked).div(1e18);
    }


    // --- Formula-based  CLV Share adjustment with overstay ---

    // function getCLVShare(uint deposit, uint CLVLoss) internal view returns(uint) {
    //     uint normalCLVShare = deposit.sub(CLVLoss);
    //     uint maxCLVShareWithOverstay = getMaxCLVShareWithOverstay(deposit, CLVLoss);
    //     return DeciMath.getMin(normalCLVShare, maxCLVShareWithOverstay);
    // }

    // function getMaxCLVShareWithOverstay(uint deposit, uint CLVLoss) internal view returns (uint) {

    //     uint totalCLVDeposits = stabilityPool.getTotalCLVDeposits();
    //     uint rawCLV = stabilityPool.getCLV();

    //     /* Correct for the expected small positive error in S_CLV
    //      TODO: 1Calculate a lower upper bound for the error in S_CLV, 1e9 is generous. */
        
    //     console.log("S_CLV is %s", S_CLV);

    //     uint corrected_S_CLV;
    //     if (S_CLV > 0) { corrected_S_CLV = S_CLV.sub(1e9); }

    //     // /* wrong - totalCLVLoss needs to be tracked, not given by aggregate, as the multiplier includes deposits
    //     // that came before CLV loss happened.  The total CLVLoss is sum(d(S-s0)), not sum(d)*S */
    //     // uint totalCLVLoss = totalCLVDeposits.mul(corrected_S_CLV).div(1e18);
     
    //     console.log("totalCLVLoss %s", totalCLVLoss);
    //     console.log("totalCLVDeposits %s", totalCLVDeposits);

    //     /* with no overstayers in the system, (totalCLVDeposits - totalCLVLoss) == rawCLV in the Pool.
    
    //     With an overstayer present, (totalCLVDeposits - totalCLVLoss) > rawCLV in the Pool. totalCLVDeposits is bigger
    //     than it should be, because the CLV contributed by the deposit has already been 'used up', yet the deposit
    //     remains included in the total. */
    //     uint correctionFraction;
    //     uint maxCLVShare;
    //     uint normalShare;

    //     /* handle the case where an overstay "hangover" equals or exceeds the total CLV deposits.  In this case,
    //     just set max withdrawal share to 0. */
    //     if (totalCLVLoss >= totalCLVDeposits) {
    //         // maxCLVShare = 0;
    //     } else {
    //         correctionFraction = rawCLV.mul(1e18).div(totalCLVDeposits.sub(totalCLVLoss));
    //         normalShare = deposit.sub(CLVLoss);

    //         console.log("rawCLV is %s", rawCLV);
    //         console.log("totalCLVDeposits.sub(totalCLVLoss) is %s", totalCLVDeposits.sub(totalCLVLoss));
    //         console.log("correctionFraction is %s", correctionFraction);
    //         console.log("normal share is %s", normalShare);
    //         console.log("normalShare.mul(correctionFraction).div(1e18) is %s", normalShare.mul(correctionFraction).div(1e18));


    //         maxCLVShare = DeciMath.getMin(normalShare, normalShare.mul(correctionFraction).div(1e18));
    //     }
    //     return (maxCLVShare);
    // }
    
    // --- Internal StabilityPool functions --- 

    // Deposit _amount CLV from _address, to the Stability Pool.
    function depositCLV(address _address, uint _amount) internal returns(bool) {
        require(deposit[_address] == 0, "PoolManager: user already has a StabilityPool deposit");
    
        // Transfer the CLV tokens from the user to the Stability Pool's address, and update its recorded CLV
        CLV.sendToPool(_address, stabilityPoolAddress, _amount);
        stabilityPool.increaseCLV(_amount);
        stabilityPool.increaseTotalCLVDeposits(_amount);
        
        // Record the deposit made by user
        deposit[_address] = _amount;

        // Record the cohort in which the deposit is made, and add the depositor to the current cohort array
        userToCohort[_address] = currentCohort;
        cohorts[currentCohort].push(_address);
    
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

        uint ETHShare;
        uint CLVLoss;

        if (userDeposit == 0) { return [ETHShare, CLVLoss];}

        ETHShare = getCurrentETHGain(_address);
        CLVLoss = getCurrentCLVLoss(_address);

        uint CLVShare;
    
        uint totalCLVDeposits = stabilityPool.decreaseTotalCLVDeposits(userDeposit);
        
        /* If user's deposit is an 'overstay', they retrieve 0 CLV, and any 'excess' CLV Loss is fed
        back to the reward sum, so that it can be applied to all active deposits */
        if (CLVLoss > userDeposit) {
            CLVShare = 0;

            // add the excess CLVLoss back to the Pool
            uint overstayedCLVLoss = CLVLoss.sub(userDeposit);
            uint overstayedCLVLossPerUnitStaked = overstayedCLVLoss.mul(1e18).div(totalCLVDeposits);
            S_CLV = S_CLV.add(overstayedCLVLossPerUnitStaked);

        } else {
            CLVShare = poolContainsOverstays() ? userDeposit.sub(CLVLoss) : 0;
        }

        // Update deposit
        deposit[_address] = 0;

        /* If deposit was in the oldest cohort, there is a chance it was the last active deposit in that cohort - in which case, we update
        the oldest active cohort */
        if (userToCohort[_address] == oldestActiveCohort) { updateOldestActiveCohort(); }

        emit UserDepositChanged(_address, deposit[_address]);

        // Send CLV to user, decrease CLV in Pool, and decrease total CLV Loss
        CLV.returnFromPool(stabilityPoolAddress, _address, DeciMath.getMin(CLVShare, stabilityPool.getCLV()));
        stabilityPool.decreaseCLV(CLVShare);
        
        // Send ETH to user
        stabilityPool.sendETH(_address, ETHShare);

        uint[2] memory shares = [CLVShare, ETHShare];
        return shares;
    }

    // Transfer _address's entitled CLV (userDeposit - CLVLoss) to _address, and their ETHGain to their CDP.
    function retrieveToCDP(address _address, address _hint) internal returns(uint[2] memory) {
        uint userDeposit = deposit[_address];  
        require(userDeposit > 0, 'PoolManager: User must have a non-zero deposit');  
        
        uint ETHShare = getCurrentETHGain(_address); 
        uint CLVLoss = getCurrentCLVLoss(_address); 
      
        uint CLVShare;  

        uint totalCLVDeposits = stabilityPool.decreaseTotalCLVDeposits(userDeposit);
      
        // If user's deposit is an 'overstay', they retrieve 0 CLV
        if (CLVLoss > userDeposit) {
            CLVShare = 0;

            // add the excess CLVLoss back to the Pool
            uint overstayedCLVLoss = CLVLoss.sub(userDeposit);
            uint overstayedCLVLossPerUnitStaked = overstayedCLVLoss.mul(1e18).div(totalCLVDeposits);
            S_CLV = S_CLV.add(overstayedCLVLossPerUnitStaked);

        } else {
            CLVShare = poolContainsOverstays() ? userDeposit.sub(CLVLoss) : 0;
        }

        // Update deposit
        deposit[_address] = 0; 
   
        /* If deposit was in the oldest cohort, there is a chance it was the last active deposit in that cohort - in which case, we update
        the oldest active cohort */
        if (userToCohort[_address] == oldestActiveCohort) {updateOldestActiveCohort();}

        emit UserDepositChanged(_address, deposit[_address]); 
      
        // Send CLV to user and decrease CLV in StabilityPool
        CLV.returnFromPool(stabilityPoolAddress, _address, DeciMath.getMin(CLVShare, stabilityPool.getCLV())); // 45000 gas
        stabilityPool.decreaseCLV(CLVShare);

        // Pull ETHShare from StabilityPool, and send to CDP
        stabilityPool.sendETH(address(this), ETHShare); 
        cdpManager.addColl.value(ETHShare)(_address, _hint); 
   
        uint[2] memory shares = [CLVShare, ETHShare]; 
        return shares;
    }

    // --- External StabilityPool Functions ---

    /* Send ETHGain to user's address, and updates their deposit, 
    setting newDeposit = (oldDeposit - CLVLoss) + amount. */
    function provideToSP(uint _amount) external returns(bool) {
        uint price = priceFeed.getPrice();
        cdpManager.checkTCRAndSetRecoveryMode(price);

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
        uint price = priceFeed.getPrice();
        cdpManager.checkTCRAndSetRecoveryMode(price);

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
    function withdrawFromSPtoCDP(address _user, address _hint) external onlyCDPManagerOrUserIsSender(_user) returns(bool) {
        uint price = priceFeed.getPrice();  
   
        cdpManager.checkTCRAndSetRecoveryMode(price); 
        uint userDeposit = deposit[_user]; 
       
        if (userDeposit == 0) { return false; } 
        
        // Retrieve all CLV to user's CLV balance, and ETH to their CDP
        uint[2] memory returnedVals = retrieveToCDP(_user, _hint); 
 
        uint returnedCLV = returnedVals[0];
        
        // Update deposit, applying CLVLoss
        depositCLV(_user, returnedCLV); 
        return true;
    }

    /* Withdraw a 'penalty' fraction of an overstayed depositor's ETHGain.  
    
    Callable by anyone when _depositor's CLVLoss > deposit. */
    function withdrawPenaltyFromSP(address _address) external returns(bool) {
        uint price = priceFeed.getPrice();
        cdpManager.checkTCRAndSetRecoveryMode(price);

        address claimant = _msgSender();
        address depositor = _address;
        
        uint CLVLoss = getCurrentCLVLoss(depositor);
        uint depositAmount = deposit[depositor];
        require(CLVLoss > depositAmount, "PoolManager: depositor has not overstayed");

        uint ETHGain = getCurrentETHGain(depositor);

        /* Depositor is penalised for overstaying - i.e. letting CLVLoss grow larger than their deposit.
       
        Depositor's ETH entitlement is reduced to ETHGain * (deposit/CLVLoss).
        The claimant retrieves ETHGain * (1 - deposit/CLVLoss). */
       
        uint depositorRemainder = ETHGain.mul(depositAmount).div(CLVLoss);
        uint claimantReward = ETHGain.sub(depositorRemainder);
        
        // Update deposit and snapshots
        deposit[depositor] = 0;
  
        emit UserDepositChanged(depositor, deposit[depositor]);
   
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
    function offset(uint _debt, uint _coll) external payable onlyCDPManager returns (uint[2] memory) {    
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
        uint collToAdd = _coll.mul(debtToOffset).div(_debt);
        
        /* 
        Update the running total S_CLV by adding the ratio between the distributed debt and the CLV in the pool.
        Update the running total S_ETH by adding the ratio between the distributed collateral and the ETH in the pool */

        // Division with corrections
        uint CLVLossNumerator = debtToOffset.mul(1e18).sub(lastCLVLossError_Offset);
        uint ETHNumerator = collToAdd.mul(1e18).add(lastETHError_Offset);
       
        uint CLVLossPerUnitStaked = (CLVLossNumerator.div(totalCLVDeposits)).add(1);  // Add 1 to make the error in the quotient positive
        uint ETHGainPerUnitStaked = ETHNumerator.div(totalCLVDeposits); // Error in quotient is negative

        lastCLVLossError_Offset = (CLVLossPerUnitStaked.mul(totalCLVDeposits)).sub(CLVLossNumerator);
        lastETHError_Offset = ETHNumerator.sub(ETHGainPerUnitStaked.mul(totalCLVDeposits));  

        S_CLV = S_CLV.add(CLVLossPerUnitStaked); 
        emit S_CLVUpdated(S_CLV); 

        S_ETH = S_ETH.add(ETHGainPerUnitStaked);
        emit S_ETHUpdated(S_ETH); 

        // Cancel the liquidated CLV debt with the CLV in the stability pool
        activePool.decreaseCLV(debtToOffset);  
        stabilityPool.decreaseCLV(debtToOffset); 
        currentCohort = currentCohort.add(1);
       
        // Send ETH from Active Pool to Stability Pool
        activePool.sendETH(stabilityPoolAddress, collToAdd);  

        // Burn the debt that was successfully offset
        CLV.burn(stabilityPoolAddress, debtToOffset); 

        // Return the amount of debt & coll that could not be offset against the Stability Pool due to insufficiency
        remainder[0] = _debt.sub(debtToOffset);
        remainder[1] = _coll.sub(collToAdd);
        return remainder;
    }

    //  --- Cohort functionality ---

    // If the pool contains overstays, overstays will be found in the oldest active cohort. O(n) reads.
    function poolContainsOverstays() public view returns (bool) {
        return cohortContainsOverstays(oldestActiveCohort);
    }

    /* Check whether a cohort's active deposits are all overstayers by checking the first active deposit we find.  
    As rewards are issued proportionally, all deposits within a cohort will become overstayers upon the same liquidation.
    
    O(n) reads.
     */
    function cohortContainsOverstays(uint cohort) internal view returns (bool) {
        console.log("cohort length: %s", cohorts[cohort].length);
        for (uint i = 0; i < cohorts[cohort].length; i++) {
            address user = cohorts[cohort][i];
            console.log("user: %s, i: %s", user, i);
            // If the user has been added to a more recent cohort, or has zero deposit, skip them
            if (userToCohort[user] != cohort || deposit[user] == 0) { continue; }

            uint CLVLoss = getCurrentCLVLoss(user);
            console.log("clv loss: %s", CLVLoss);
            uint userDeposit = deposit[user];
             console.log("userDeposit: %s", userDeposit);

            // If one deposit within a cohort is an overstay, they all are
            if (CLVLoss >  userDeposit) {
                return true;
            } else if (CLVLoss <= userDeposit) {
                return false;
            }
         return false;
        }
    }

    /* Search the oldest active cohort for an active and correctly-placed deposit.  
    
    If none, update the oldest active cohort.
    
    In practice, called at every withdrawal -- So, if the current oldest cohort contains no actives,
    the next cohort will, as the withdrawal has, at most, removed one deposit from the current oldest cohort.
    
    O(n) reads. */ 
    function updateOldestActiveCohort() public returns (uint) {
        uint length = cohorts[oldestActiveCohort].length;
         
         for (uint i = 0; i < length; i++) {
            address user = cohorts[oldestActiveCohort][i];
        
            // Check deposit is active, and is currently in this cohort
            if ( deposit[user] > 0 && userToCohort[user] == i) { 
                return oldestActiveCohort;
            }
        }
        oldestActiveCohort = oldestActiveCohort.add(1);
        return oldestActiveCohort;
    }

    // O(n) operations (and O(n) gas refunds)
    function clearOldestActiveCohort() public returns (bool) {
        if (cohortContainsOverstays(oldestActiveCohort)) {
            clearOverstayCohort(oldestActiveCohort);
            
            oldestActiveCohort = oldestActiveCohort.add(1);
            return true;
        }
        return false;
    }

    /* Clear all overstayers from a cohort, and feed their excess ETHGain and CLVLoss back to the pool.  
    O(n) operations (and O(n) gas refunds). */
    function clearOverstayCohort(uint cohort) internal returns (bool) {
        uint totalCLVDeposits;
        uint totalExcessCLVLoss;
        uint totalExcessETHGain;

        for (uint i = 0; i < cohorts[cohort].length; i++) {
            address user = cohorts[cohort][i];
            uint userDeposit = deposit[user];

            uint CLVLoss = getCurrentCLVLoss(user);
            uint ETHGain = getCurrentETHGain(user);
            
            // Compute the overstayer's entitled ETHGain, and their excess ETHGain and CLVLoss
            uint excessCLVLoss = CLVLoss.sub(userDeposit);
            totalExcessCLVLoss = totalExcessCLVLoss.add(excessCLVLoss);
        
            uint entitledETHGain  = ETHGain.mul(userDeposit).div(CLVLoss);
            uint excessETHGain = ETHGain.sub(entitledETHGain);
            totalExcessETHGain = totalExcessETHGain.add(excessETHGain);

            deposit[user] = 0;
          
            emit UserDepositChanged(user, 0);

            // send entitled ETH gain to the overstayer
            stabilityPool.sendETH(user, entitledETHGain);
        }

        uint newTotalCLVDeposits = stabilityPool.decreaseTotalCLVDeposits(totalCLVDeposits);

        uint totalExcessCLVLossPerUnitStaked = totalExcessCLVLoss.mul(1e18).div(newTotalCLVDeposits);
        uint totalExcessETHGainPerUnitStaked = totalExcessETHGain.mul(1e18).div(newTotalCLVDeposits);
        
        // Redistribute excess CLVLoss ETHGain to Pool
        S_CLV = S_CLV.add(totalExcessCLVLossPerUnitStaked);
        S_ETH = S_ETH.add(totalExcessETHGainPerUnitStaked);

        return true;
    }

    function () external payable onlyStabilityPoolorActivePool {}
}    