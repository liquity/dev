pragma solidity ^0.5.16;

import "./Interfaces/IBorrowerOperations.sol";
import './Interfaces/IPool.sol';
import './Interfaces/IPoolManager.sol';
import './Interfaces/ICDPManager.sol';
import './Interfaces/IStabilityPool.sol';
import './Interfaces/IPriceFeed.sol';
import './Interfaces/ICLVToken.sol';
import './DeciMath.sol';
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

// PoolManager maintains all pools 
contract PoolManager is Ownable, IPoolManager {
    using SafeMath for uint;

    // --- Events ---

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event CDPManagerAddressChanged(address _newCDPManagerAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event CLVTokenAddressChanged(address _newCLVTokenAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    
    event UserSnapshotUpdated(uint _P, uint _S);
    event P_Updated(uint _P);
    event S_Updated(uint _S);
    event UserDepositChanged(address indexed _user, uint _amount);
    event ETHGainWithdrawn(address indexed _user, uint _ETH);
    event ETHGainWithdrawnToCDP(address indexed _CDPOwner, uint _ETH);

    // --- Connected contract declarations ---

    IBorrowerOperations borrowerOperations;
    address public borrowerOperationsAddress;

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
   
    mapping (address => uint) public initialDeposits;

    struct Snapshot {
        uint S;
        uint P;
        uint scale;
        uint epoch;
    }

    /* P: Running product by which to multiply an initial deposit, in order to find the current compounded deposit, 
    given a series of liquidations, each of which cancel some CLV debt with the deposit. 

    During its lifetime, a deposit's value evolves from d0 to (d0 * P / P(0) ), where P(0) 
    is the snapshot of P taken at the instant the deposit was made. 18 DP decimal.  */
    uint public P = 1e18;

    uint public currentScale;  // Each time the scale of P shifts by 1e18, the scale is incremented by 1

    uint public currentEpoch;  // With each offset that fully empties the Pool, the epoch is incremented by 1

    /* S: During it's lifetime, each deposit d0 earns an ETH gain of ( d0 * [S - S(0)] )/P(0), where S(0) 
    is the snapshot of S taken at the instant the deposit was made.
   
    The 'S' sums are stored in a nested mapping (epoch => scale => sum):

    - The inner mapping records the sum S at different scales
    - The outer mapping records the (scale => sum) mappings, for different epochs. */
    mapping (uint => mapping(uint => uint)) public epochToScaleToSum;

    // Map users to their individual snapshot structs
    mapping (address => Snapshot) public snapshot;

    // Error trackers for the error correction in the offset calculation
    uint lastETHError_Offset;
    uint lastCLVLossError_Offset;

    // --- Modifiers ---

    modifier onlyCDPManager() {
        require(_msgSender() == cdpManagerAddress, "PoolManager: Caller is not the CDPManager");
        _;
    }

     modifier onlyBorrowerOperations() {
        require(_msgSender() == borrowerOperationsAddress, "PoolManager: Caller is not the BorrowerOperations contract");
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

    function setBorrowerOperations(address _borrowerOperationsAddress) public onlyOwner {
        borrowerOperationsAddress = _borrowerOperationsAddress;
        borrowerOperations = IBorrowerOperations(_borrowerOperationsAddress);
        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
    }

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
        uint price = priceFeed.getPrice();

        uint activeColl = activePool.getETH();
        uint activeDebt = activePool.getCLV();
        uint liquidatedColl = defaultPool.getETH();
        uint closedDebt = defaultPool.getCLV();

        uint totalCollateral = activeColl.add(liquidatedColl);
        uint totalDebt = activeDebt.add(closedDebt); 

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
    function addColl() public payable onlyBorrowerOperations returns (bool) {
        // Send ETH to Active Pool and increase its recorded ETH balance
       (bool success, ) = activePoolAddress.call.value(msg.value)("");
       assert(success == true);
       return success;
    }
    
    // Transfer the specified amount of ETH to _account and updates the total active collateral
    function withdrawColl(address _account, uint _ETH) public onlyBorrowerOperations returns (bool) {
        activePool.sendETH(_account, _ETH);
        return true;
    }
    
    // Issue the specified amount of CLV to _account and increases the total active debt
    function withdrawCLV(address _account, uint _CLV) public onlyBorrowerOperations returns (bool) {
        activePool.increaseCLV(_CLV);  // 9500
        CLV.mint(_account, _CLV);  // 37500
         
        return true;
    }
    
    // Burn the specified amount of CLV from _account and decreases the total active debt
    function repayCLV(address _account, uint _CLV) public onlyBorrowerOperations returns (bool) {
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

    // Move a CDP's pending debt and collateral rewards from distributions, from the Default Pool to the Active Pool
    function moveDistributionRewardsToActivePool(uint _CLV, uint _ETH) public onlyCDPManager returns (bool) {
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

    /* Return the ETH gain earned by the deposit. Given by the formula:  E = d0 * (S - S(0))/P(0)
    where S(0), P(0) are the depositor's snapshots of the sum S and product P, respectively. */
    function getCurrentETHGain(address _user) public view returns(uint) {
        uint initialDeposit = initialDeposits[_user];

        if (initialDeposit == 0) { return 0; }

        uint snapshot_S = snapshot[_user].S;  
        uint snapshot_P = snapshot[_user].P;
        uint scaleSnapshot = snapshot[_user].scale;
        uint epochSnapshot = snapshot[_user].epoch;

        uint ETHGain;

        /* Grab the reward sum from the epoch at which the deposit was made. The reward may span up to 
        one scale change.  
        If it does, the second portion of the reward is scaled by 1e18. 
        If the reward spans no scale change, the second portion will be 0. */
        uint firstPortion = epochToScaleToSum[epochSnapshot][scaleSnapshot].sub(snapshot_S);
        uint secondPortion = epochToScaleToSum[epochSnapshot][scaleSnapshot.add(1)].div(1e18);

        ETHGain = initialDeposit.mul(firstPortion.add(secondPortion)).div(snapshot_P).div(1e18);
        
        return ETHGain;
    }

    /* Return the user's compounded deposit.  Given by the formula:  d = d0 * P/P(0)
    where P_(0) is the depositor's snapshot of the product P. */
    function getCompoundedCLVDeposit(address _user) public view returns(uint) {
        uint userDeposit = initialDeposits[_user];

        if (userDeposit == 0) { return 0; }

        uint snapshot_P = snapshot[_user].P; 
        uint scaleSnapshot = snapshot[_user].scale;
        uint epochSnapshot = snapshot[_user].epoch;
        
        // If deposit was made before a pool-emptying event, then it has been fully cancelled with debt -- so, return 0
        if (epochSnapshot < currentEpoch) { return 0; }

        uint compoundedDeposit;
        uint scaleDiff = currentScale.sub(scaleSnapshot);
    
        /* Compute the compounded deposit. If a scale change in P was made during the deposit's lifetime, 
        account for it.  If more than one scale change was made, then the deposit has decreased by a factor of 
        at least 1e-18 -- so return 0.*/
        if (scaleDiff == 0) { 
            compoundedDeposit = userDeposit.mul(P).div(snapshot_P);
        } else if (scaleDiff == 1) {
            compoundedDeposit = userDeposit.mul(P).div(snapshot_P).div(1e18);
        } else {
            compoundedDeposit = 0;
        }

        // If compounded deposit is less than a billionth of the initial deposit, return 0
        if (compoundedDeposit < userDeposit.div(1e9)) { return 0; }

        return compoundedDeposit;
    }

    // --- Internal Stability Pool functions --- 

    // Deposit _amount CLV from _address, to the Stability Pool.
    function depositCLV(address _address, uint _amount) internal returns(bool) {
        require(initialDeposits[_address] == 0, "PoolManager: user already has a StabilityPool deposit");
    
        // Transfer the CLV tokens from the user to the Stability Pool's address, and update its recorded CLV
        CLV.sendToPool(_address, stabilityPoolAddress, _amount);
        stabilityPool.increaseCLV(_amount);
       
        // Record the deposit made by user
        initialDeposits[_address] = _amount;
    
        // Record new individual snapshots of the running product P and sum S for the user
        snapshot[_address].P = P;
        snapshot[_address].S = epochToScaleToSum[currentEpoch][currentScale];
        snapshot[_address].scale = currentScale;
        snapshot[_address].epoch = currentEpoch;

        emit UserSnapshotUpdated(snapshot[_address].P, snapshot[_address].S);
        emit UserDepositChanged(_address, _amount);
        return true;
    }

   // Transfers _address's compounded deposit and ETH gain, to _address.
    function retrieveToUser(address _address) internal returns(uint compoundedCLVDeposit, uint ETHGain) {
        uint userDeposit = initialDeposits[_address];

        ETHGain = getCurrentETHGain(_address);
        compoundedCLVDeposit = getCompoundedCLVDeposit(_address);
        initialDeposits[_address] = 0;

        emit UserDepositChanged(_address, 0);

        // Send CLV to user and decrease CLV in Pool
        CLV.returnFromPool(stabilityPoolAddress, _address, DeciMath.getMin(compoundedCLVDeposit, stabilityPool.getCLV()));
    
        stabilityPool.decreaseCLV(compoundedCLVDeposit);
    
        // Send ETH to user
        stabilityPool.sendETH(_address, ETHGain);
        emit ETHGainWithdrawn(_address, ETHGain);

        return (compoundedCLVDeposit, ETHGain);
    }

    // Transfer _address's compounded deposit to _address, and their ETH gain to their CDP.
    function retrieveToCDP(address _address, address _hint) internal returns(uint compoundedCLVDeposit, uint ETHGain) {
        uint userDeposit = initialDeposits[_address];  
        require(userDeposit > 0, 'PoolManager: User must have a non-zero deposit');  
        
        ETHGain = getCurrentETHGain(_address);
        compoundedCLVDeposit = getCompoundedCLVDeposit(_address);
      
        initialDeposits[_address] = 0; 
       
        emit UserDepositChanged(_address, 0); 
      
        // Send CLV to user and decrease CLV in StabilityPool
        CLV.returnFromPool(stabilityPoolAddress, _address, DeciMath.getMin(compoundedCLVDeposit, stabilityPool.getCLV()));
        
        stabilityPool.decreaseCLV(compoundedCLVDeposit);
       
        // Pull ETHShare from StabilityPool, and send to CDP
        stabilityPool.sendETH(address(this), ETHGain); 
        borrowerOperations.addColl.value(ETHGain)(_address, _hint); 
        emit ETHGainWithdrawnToCDP(_address, ETHGain);
   
        return (compoundedCLVDeposit, ETHGain);
    }

    // --- External StabilityPool Functions ---

    /* Send ETHGain to user's address, and updates their deposit, 
    setting newDeposit = compounded deposit + amount. */
    function provideToSP(uint _amount) external returns(bool) {
        address user = _msgSender();

        // If user has no deposit, make one with _amount
        if (initialDeposits[user] == 0) {
            depositCLV(user, _amount);
            return true;
        }

        /* If user already has a deposit, retrieve their ETH gain and current deposit,
         then make a new composite deposit */
        (uint returnedCLV, ) = retrieveToUser(user);

        uint newDeposit = returnedCLV + _amount;
        depositCLV(user, newDeposit);

        return true;
    }

    /* Withdraw _amount of CLV and the caller’s entire ETH gain from the 
    Stability Pool, and updates the caller’s reduced deposit. 

    If  _amount is 0, the user only withdraws their ETH gain, no CLV.
    If _amount > userDeposit, the user withdraws all their ETH gain, and all of their compounded deposit.

    In all cases, the entire ETH gain is sent to user. */
    function withdrawFromSP(uint _amount) external returns(bool) {
        address user = _msgSender();
       
        // Retrieve CLV and ETH for the user
        (uint returnedCLV, ) = retrieveToUser(user);

        // If requested withdrawal amount is less than available CLV, re-deposit the difference.
        if (_amount < returnedCLV) {
            depositCLV(user, returnedCLV.sub(_amount));
        }

        return true;
    }

    /* Transfer the caller’s entire ETH gain from the Stability Pool to the caller’s CDP, and leaves
    their compounded deposit in the Stability Pool. */
    function withdrawFromSPtoCDP(address _user, address _hint) external onlyCDPManagerOrUserIsSender(_user) returns(bool) {
        uint userDeposit = initialDeposits[_user]; 
       
        if (userDeposit == 0) { return false; } 
        
        // Retrieve all CLV to user's CLV balance, and ETH to their CDP
        (uint returnedCLV, ) = retrieveToCDP(_user, _hint); 
        
        depositCLV(_user, returnedCLV); 
        return true;
    }

     /* Cancel out the specified _debt against the CLV contained in the Stability Pool (as far as possible)  
    and transfers the CDP's ETH collateral from ActivePool to StabilityPool. 
    Returns the amount of debt that could not be cancelled, and the corresponding ether.
    Only callable from close() and closeCDPs() functions in CDPManager */
  function offset(uint _debt, uint _coll,  uint CLVInPool) 
    external 
    payable 
    onlyCDPManager 
    returns (uint debtRemainder, uint collRemainder)  {    
        uint totalCLVDeposits = stabilityPool.getCLV(); 
        
        // If the debt is larger than the deposited CLV, offset an amount of debt corresponding to the latter
        uint debtToOffset = DeciMath.getMin(_debt, CLVInPool);  
  
        // Collateral to be added in proportion to the debt that is cancelled 
        uint collToAdd = _coll.mul(debtToOffset).div(_debt);
        
        (uint ETHGainPerUnitStaked,
         uint CLVLossPerUnitStaked) = computeRewardsPerUnitStaked(collToAdd, debtToOffset, totalCLVDeposits);

        updateRewardSumAndProduct(ETHGainPerUnitStaked, CLVLossPerUnitStaked);

        moveOffsetCollAndDebt(collToAdd, debtToOffset);

        // Return the amount of debt & coll that could not be offset against the Stability Pool due to insufficiency
        debtRemainder = _debt.sub(debtToOffset);
        collRemainder = _coll.sub(collToAdd);

        return (debtRemainder, collRemainder);
    }

    // --- Offset helper functions ---

    function computeRewardsPerUnitStaked(uint collToAdd, uint debtToOffset, uint totalCLVDeposits) 
    internal 
    returns(uint ETHGainPerUnitStaked, uint CLVLossPerUnitStaked) 
    {
        uint CLVLossNumerator = debtToOffset.mul(1e18).sub(lastCLVLossError_Offset);
        uint ETHNumerator = collToAdd.mul(1e18).add(lastETHError_Offset);

        // Compute the CLV and ETH rewards, and error corrections
        uint CLVLossPerUnitStaked;

        if (debtToOffset >= totalCLVDeposits) {
            CLVLossPerUnitStaked = 1e18;
            lastCLVLossError_Offset = 0;
        } else {
            CLVLossPerUnitStaked = (CLVLossNumerator.div(totalCLVDeposits)).add(1); // add 1 to make error in quotient positive
             lastCLVLossError_Offset = (CLVLossPerUnitStaked.mul(totalCLVDeposits)).sub(CLVLossNumerator);
        } 

        uint ETHGainPerUnitStaked = ETHNumerator.div(totalCLVDeposits); 
        lastETHError_Offset = ETHNumerator.sub(ETHGainPerUnitStaked.mul(totalCLVDeposits)); 

        return (ETHGainPerUnitStaked, CLVLossPerUnitStaked);
    }

    // Update the Stability Pool reward sum S and product P
    function updateRewardSumAndProduct(uint ETHGainPerUnitStaked, uint CLVLossPerUnitStaked) internal {
         // Make product factor 0 if there was a pool-emptying. Otherwise, it is (1 - CLVLossPerUnitStaked)
        uint newProductFactor = CLVLossPerUnitStaked >= 1e18 ? 0 : uint(1e18).sub(CLVLossPerUnitStaked);
     
        // Update the ETH reward sum at the current scale
        uint marginalETHGain = ETHGainPerUnitStaked.mul(P);
        epochToScaleToSum[currentEpoch][currentScale] = epochToScaleToSum[currentEpoch][currentScale].add(marginalETHGain);
        emit S_Updated(epochToScaleToSum[currentEpoch][currentScale]); 

       // If the pool was emptied, increment the epoch and reset the scale and product P
        if (newProductFactor == 0) {
            currentEpoch = currentEpoch.add(1);
            currentScale = 0;
            P = 1e18;
    
        // If multiplying P by a non-zero product factor would round P to zero, increment the scale 
        } else if (P.mul(newProductFactor) < 1e18) {
            P = P.mul(newProductFactor);
            currentScale = currentScale.add(1);
         } else {
            P = P.mul(newProductFactor).div(1e18); 
        }

        emit P_Updated(P); 
    }

    function moveOffsetCollAndDebt(uint collToAdd, uint debtToOffset) internal {
        // Cancel the liquidated CLV debt with the CLV in the stability pool
        activePool.decreaseCLV(debtToOffset);  
        stabilityPool.decreaseCLV(debtToOffset); 
       
        // Send ETH from Active Pool to Stability Pool
        activePool.sendETH(stabilityPoolAddress, collToAdd);  

        // Burn the debt that was successfully offset
        CLV.burn(stabilityPoolAddress, debtToOffset); 
    }

    function () external payable onlyStabilityPoolorActivePool {}
}    