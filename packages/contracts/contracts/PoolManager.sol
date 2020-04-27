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
    event P_CLVUpdated(uint _P_CLV);
    event S_ETHUpdated(uint _S_ETH);
    event UserDepositChanged(address indexed _user, uint _amount);
    event ETHGainWithdrawn(address indexed _user, uint _ETH);
    event ETHGainWithdrawnToCDP(address indexed _CDPOwner, uint _ETH);

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
   
    mapping (address => uint) public deposits;

  

    struct Snapshot {
        uint ETH;
        uint CLV;
        uint scale;
    }

    /* Running product by which to multiply an initial deposit, in order to find the current compounded deposit, given
    a series of liquidations, each of which cancel some CLV debt with the deposit. 

    During its lifetime, a deposit's value evolves from d0 to (d0 * [ P_CLV / P_CLV(0)] ), where P_CLV(0) 
    is the snapshot of P_CLV taken at the instant the deposit was made.  18 DP decimal.  */
    uint public P_CLV = 1e18;

    // Every time the scale of P shifts by 1e18, the scale is incremented by 1
    uint public scale;

    /* Sum of accumulated ETH gains per unit staked.  During it's lifetime, each deposit d0 earns:
    An ETH *gain* of ( d0 * [S_ETH - S_ETH(0)] ), where S_ETH(0) is the snapshot of S_ETH taken at the instant
    the deposit was made. 18 DP decimal.  */
    // uint public S_ETH;

    // record the sum S at different scales
    mapping (uint => uint) public scaleToSum;

    // Map users to their individual snapshots of S_CLV and the S_ETH
    mapping (address => Snapshot) public snapshot;

    // Error trackers for the offset calculation
    uint lastETHError_Offset;
    uint lastCLVLossError_Offset;

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
    /* Return the accumulated ETH Gain for the user, for the duration that this deposit was held.

    Given by the formula:  E = d0 * (S_ETH - S_ETH(0))/P_CLV(0)
    
    where S_ETH(0), P_CLV(0) are snapshots of the sum S_ETH and product P_ETH, respectively.
    */

    function getCurrentETHGain(address _user) public view returns(uint) {
        uint userDeposit = deposits[_user];
        uint snapshot_S_ETH = snapshot[_user].ETH;  
        uint snapshot_P_CLV = snapshot[_user].CLV;
        uint snapshot_scale = snapshot[_user].scale;

        uint ETHGain;
        uint scaleDiff = scale.sub(snapshot_scale);

        if (scaleDiff == 0) { 
            ETHGain = userDeposit.mul(scaleToSum[scale].sub(snapshot_S_ETH)).div(snapshot_P_CLV).div(1e18);
        } else {
            console.log("PM::scale: %s", scale);
            uint firstPortion = scaleToSum[snapshot_scale].sub(snapshot_S_ETH);
            console.log("PM::scaleToSum[snapshot_scale]: %s", scaleToSum[snapshot_scale] );
            console.log("PM::first snapshot_S_ETH: %s", snapshot_S_ETH );
            uint secondPortion = scaleToSum[snapshot_scale.add(1)].div(1e18);
            console.log("PM::first portion: %s", firstPortion );
            console.log("PM::second portion: %s", secondPortion );

            ETHGain = userDeposit.mul(firstPortion.add(secondPortion)).div(snapshot_P_CLV).div(1e18);
        }

        return ETHGain;
    }

    /* Return the user's compounded deposit.  

    Given by the formula:  d = d0 * P_CLV/P_CLV(0)
    
    where P_CLV(0) is the snapshot of the product P_ETH.
    */
    function getCompoundedCLVDeposit(address _user) internal view returns(uint) {
        uint userDeposit = deposits[_user];
        uint snapshot_P_CLV = snapshot[_user].CLV; 
        uint snapshot_scale = snapshot[_user].scale;

        uint compoundedDeposit;
        uint scaleDiff = scale.sub(snapshot_scale);
        
        console.log(" snapshot[_user].CLV: %s",  snapshot[_user].CLV);

        /* Return a positive deposit if compounded deposit is greater than
        a particular tiny fraction of the initial deposit -- i.e. if ( d > d0 * 1e-9 ). Otherwise, return 0. */

        if ((scaleDiff == 0) && (P_CLV >= snapshot_P_CLV.div(1e9))) { 
            compoundedDeposit = userDeposit.mul(P_CLV).div(snapshot_P_CLV);

        } else if ((scaleDiff == 1) && (P_CLV >= snapshot_P_CLV.div(1e9))) {
            compoundedDeposit = userDeposit.mul(P_CLV).div(snapshot_P_CLV).div(1e18);

        } else {
            compoundedDeposit = 0;
        }
   
        return compoundedDeposit;
    }


    // --- Internal StabilityPool functions --- 

    // Deposit _amount CLV from _address, to the Stability Pool.
    function depositCLV(address _address, uint _amount) internal returns(bool) {
        require(deposits[_address] == 0, "PoolManager: user already has a StabilityPool deposit");
    
        // Transfer the CLV tokens from the user to the Stability Pool's address, and update its recorded CLV
        CLV.sendToPool(_address, stabilityPoolAddress, _amount);
        stabilityPool.increaseCLV(_amount);
        stabilityPool.increaseTotalCLVDeposits(_amount);
        
        // Record the deposit made by user
        deposits[_address] = _amount;
    
        // Record new individual snapshots of the running product P_CLV and sum S_ETH for the user
        snapshot[_address].CLV = P_CLV;
        snapshot[_address].ETH = scaleToSum[scale];
        snapshot[_address].scale = scale;

        emit UserSnapshotUpdated(snapshot[_address].CLV, snapshot[_address].ETH);
        emit UserDepositChanged(_address, _amount);
        return true;
    }

   // Transfers _address's entitled CLV (CLVDeposit - CLVLoss) and their ETHGain, to _address.
    function retrieveToUser(address _address) internal returns(uint[2] memory) {
        uint userDeposit = deposits[_address];

        uint ETHGain = getCurrentETHGain(_address);
        uint compoundedCLVDeposit = getCompoundedCLVDeposit(_address);
        deposits[_address] = 0;

        emit UserDepositChanged(_address, 0);

        // Send CLV to user and decrease CLV in Pool
        CLV.returnFromPool(stabilityPoolAddress, _address, DeciMath.getMin(compoundedCLVDeposit, stabilityPool.getCLV()));
    
        stabilityPool.decreaseCLV(compoundedCLVDeposit);
        stabilityPool.decreaseTotalCLVDeposits(compoundedCLVDeposit);
    
        // Send ETH to user
        stabilityPool.sendETH(_address, ETHGain);
        emit ETHGainWithdrawn(_address, ETHGain);

        uint[2] memory shares = [compoundedCLVDeposit, ETHGain];
        return shares;
    }

    // Transfer _address's entitled CLV (userDeposit - CLVLoss) to _address, and their ETHGain to their CDP.
    function retrieveToCDP(address _address, address _hint) internal returns(uint[2] memory) {
        uint userDeposit = deposits[_address];  
        require(userDeposit > 0, 'PoolManager: User must have a non-zero deposit');  
        
        uint ETHGain = getCurrentETHGain(_address);
        uint compoundedCLVDeposit = getCompoundedCLVDeposit(_address);
      
        deposits[_address] = 0; 
       
        emit UserDepositChanged(_address, 0); 
      
        // Send CLV to user and decrease CLV in StabilityPool
        CLV.returnFromPool(stabilityPoolAddress, _address, DeciMath.getMin(compoundedCLVDeposit, stabilityPool.getCLV()));
        
        stabilityPool.decreaseCLV(compoundedCLVDeposit);
        stabilityPool.decreaseTotalCLVDeposits(userDeposit); 
       
        // Pull ETHShare from StabilityPool, and send to CDP
        stabilityPool.sendETH(address(this), ETHGain); 
        cdpManager.addColl.value(ETHGain)(_address, _hint); 
        emit ETHGainWithdrawnToCDP(_address, ETHGain);
   
        uint[2] memory shares = [compoundedCLVDeposit, ETHGain]; 
        return shares;
    }

    // --- External StabilityPool Functions ---

    /* Send ETHGain to user's address, and updates their deposit, 
    setting newDeposit = (oldDeposit - CLVLoss) + amount. */
    function provideToSP(uint _amount) external returns(bool) {
        uint price = priceFeed.getPrice();
        cdpManager.checkTCRAndSetRecoveryMode(price);

        address user = _msgSender();

        // If user has no deposit, make one with _amount
        if (deposits[user] == 0) {
            depositCLV(user, _amount);
            return true;
        }

        /* If user already has a deposit, retrieve their ETH gain and current deposit,
         then make a new composite deposit */
        uint[2] memory returnedVals = retrieveToUser(user);
        uint returnedCLV = returnedVals[0];

        uint newDeposit = returnedCLV + _amount;
        depositCLV(user, newDeposit);

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
        uint userDeposit = deposits[user];
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
        uint userDeposit = deposits[_user]; 
       
        if (userDeposit == 0) { return false; } 
        
        // Retrieve all CLV to user's CLV balance, and ETH to their CDP
        uint[2] memory returnedVals = retrieveToCDP(_user, _hint); 
 
        uint returnedCLV = returnedVals[0];
        
        // Update deposit, applying CLVLoss
        depositCLV(_user, returnedCLV); 
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

        console.log("debtToOffset is %s", debtToOffset);

        // Collateral to be added in proportion to the debt that is cancelled 
        uint collToAdd = _coll.mul(debtToOffset).div(_debt);
        
    //      console.log("debtToOffset is %s", debtToOffset);
    //    console.log("lastCLVLossError_Offset is %s", lastCLVLossError_Offset);
        uint CLVLossNumerator = debtToOffset.mul(1e18).sub(lastCLVLossError_Offset);
        console.log("CLVLossNumerator is %s", CLVLossNumerator);

        uint ETHNumerator = collToAdd.mul(1e18).add(lastETHError_Offset);
       
    //    console.log("CLVLossNumerator is %s", CLVLossNumerator);
    //    console.log("totalCLVDeposits is %s", totalCLVDeposits);

        // compute the CLV and ETH rewards 
        uint CLVLossPerUnitStaked = (CLVLossNumerator.div(totalCLVDeposits)).add(1);  
        uint ETHGainPerUnitStaked = ETHNumerator.div(totalCLVDeposits); // Error in quotient is negative

        // console.log("CLVLossPerUnitStaked is %s", CLVLossPerUnitStaked);
        // console.log("ETHGainPerUnitStaked is %s", ETHGainPerUnitStaked);
        
        // Error corrections
        lastCLVLossError_Offset = (CLVLossPerUnitStaked.mul(totalCLVDeposits)).sub(CLVLossNumerator);
        lastETHError_Offset = ETHNumerator.sub(ETHGainPerUnitStaked.mul(totalCLVDeposits));  

        // console.log("CLVLossPerUnitStaked is %s", CLVLossPerUnitStaked);

        // Return 1 wei if product factor should be 0 from a full offset
        uint productFactor = CLVLossPerUnitStaked >= 1e18 ? 1 : uint(1e18).sub(CLVLossPerUnitStaked);
        console.log("CLVLossPerUnitStaked is %s", CLVLossPerUnitStaked );
        console.log("totalCLVDeposits is %s", totalCLVDeposits);
        console.log("product factor is %s", productFactor );
        // TODO: Error correction for P_CLV and marginalETHGain?
        
        // Update the sum:
        uint marginalETHGain = ETHGainPerUnitStaked.mul(P_CLV);
        // console.log("PM:: marginal ETH Gain:  %s", marginalETHGain);
        scaleToSum[scale] = scaleToSum[scale].add(marginalETHGain);
        // S_ETH = S_ETH.add(marginalETHGain);
        emit S_ETHUpdated(scaleToSum[scale]); 

        /* if multiplication by the product factor would round P to zero,
        increment the scale */
        if (P_CLV.mul(productFactor) < 1e18) {
            // uint marginalETHGain = ETHGainPerUnitStaked.mul(P_CLV);
            // scaleToSum[scale] = scaleToSum[scale].add(marginalETHGain);
            P_CLV = P_CLV.mul(productFactor);
            scale = scale.add(1);
         } else {
            // uint marginalETHGain = ETHGainPerUnitStaked.mul(P_CLV).div(1e18);
            // scaleToSum[scale] = scaleToSum[scale].add(marginalETHGain);
            P_CLV = P_CLV.mul(productFactor).div(1e18); 
        }

        emit P_CLVUpdated(P_CLV); 

        // Decrease totalCLVDeposits
        stabilityPool.decreaseTotalCLVDeposits(debtToOffset);
      
        // Cancel the liquidated CLV debt with the CLV in the stability pool
        // console.log("debtToOffset is %s", debtToOffset);
        // console.log("activePool.getCLV() is %s", activePool.getCLV());
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