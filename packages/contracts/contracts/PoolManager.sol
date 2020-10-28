pragma solidity 0.5.16;

import './Interfaces/IBorrowerOperations.sol';
import './Interfaces/IPool.sol';
import './Interfaces/IPoolManager.sol';
import './Interfaces/ICDPManager.sol';
import './Interfaces/IStabilityPool.sol';
import './Interfaces/IPriceFeed.sol';
import './Interfaces/ICLVToken.sol';
import './Dependencies/Math.sol';
import './Dependencies/SafeMath.sol';
import './Dependencies/SafeMath128.sol';
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

// PoolManager maintains all pools 
contract PoolManager is Ownable, IPoolManager {
    using SafeMath for uint;
    using SafeMath128 for uint128;

    address constant public GAS_POOL_ADDRESS = 0x00000000000000000000000000000000000009A5;

    // --- Connected contract declarations ---

    IBorrowerOperations public borrowerOperations;
    address public borrowerOperationsAddress;

    address public cdpManagerAddress;
    ICDPManager public cdpManager;

    IPriceFeed public priceFeed;

    ICLVToken public CLV;

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
        uint128 scale;
        uint128 epoch;
    }

    /* Product 'P': Running product by which to multiply an initial deposit, in order to find the current compounded deposit, 
    given a series of liquidations, each of which cancel some CLV debt with the deposit. 

    During its lifetime, a deposit's value evolves from d(0) to (d(0) * P / P(0) ), where P(0) 
    is the snapshot of P taken at the instant the deposit was made. 18 DP decimal.  */
    uint public P = 1e18;

     // Each time the scale of P shifts by 1e18, the scale is incremented by 1
    uint128 public currentScale; 

    // With each offset that fully empties the Pool, the epoch is incremented by 1
    uint128 public currentEpoch;  

    /* ETH Gain sum 'S': During it's lifetime, each deposit d(0) earns an ETH gain of ( d(0) * [S - S(0)] )/P(0), where S(0) 
    is the snapshot of S taken at the instant the deposit was made.
   
    The 'S' sums are stored in a nested mapping (epoch => scale => sum):

    - The inner mapping records the sum S at different scales
    - The outer mapping records the (scale => sum) mappings, for different epochs. */
    mapping (uint => mapping(uint => uint)) public epochToScaleToSum;

    // Map users to their individual snapshot structs
    mapping (address => Snapshot) public snapshot;

    // Error trackers for the error correction in the offset calculation
    uint public lastETHError_Offset;
    uint public lastCLVLossError_Offset;

    // --- Events ---

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event CDPManagerAddressChanged(address _newCDPManagerAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event CLVTokenAddressChanged(address _newCLVTokenAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);

    event UserSnapshotUpdated(address indexed _user, uint _P, uint _S);
    event P_Updated(uint _P);
    event S_Updated(uint _S);
    event UserDepositChanged(address indexed _user, uint _amount);
    event ETHGainWithdrawn(address indexed _user, uint _ETH, uint _CLVLoss);

    // --- Modifiers ---

    modifier onlyCDPManager() {
        require(_msgSender() == cdpManagerAddress, "PoolManager: Caller is not the CDPManager");
        _;
    }

     modifier onlyBorrowerOperations() {
        require(_msgSender() == borrowerOperationsAddress, "PoolManager: Caller is not the BorrowerOperations contract");
        _;
    }

    modifier onlyStabilityPool {
        require(
            _msgSender() == stabilityPoolAddress,
            "PoolManager: Caller is not StabilityPool");
        _;
    }

    // --- Dependency setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _cdpManagerAddress,
        address _priceFeedAddress,
        address _CLVAddress,
        address _stabilityPoolAddress,
        address _activePoolAddress,
        address _defaultPoolAddress
    )
    external
    onlyOwner
    {
        borrowerOperationsAddress = _borrowerOperationsAddress;
        borrowerOperations = IBorrowerOperations(_borrowerOperationsAddress);
        cdpManagerAddress = _cdpManagerAddress;
        cdpManager = ICDPManager(_cdpManagerAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
        CLV = ICLVToken(_CLVAddress);
        stabilityPoolAddress = _stabilityPoolAddress;
        stabilityPool = IStabilityPool(_stabilityPoolAddress);
        activePoolAddress = _activePoolAddress;
        activePool = IPool(_activePoolAddress);
        defaultPoolAddress = _defaultPoolAddress;
        defaultPool = IPool(_defaultPoolAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit CDPManagerAddressChanged(_cdpManagerAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit CLVTokenAddressChanged(_CLVAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);

        _renounceOwnership();
    }

    // --- Getters ---

    // Return the total active debt (in CLV) in the system
    function getActiveDebt() external view returns (uint) {
        return activePool.getCLVDebt();
    }    
    
    // Return the total active collateral (in ETH) in the system
    function getActiveColl() external view returns (uint) {
        return activePool.getETH();
    } 
    
    // Return the amount of closed debt (in CLV)
    function getClosedDebt() external view returns (uint) {
        return defaultPool.getCLVDebt();
    }    
    
    // Return the amount of closed collateral (in ETH)
    function getLiquidatedColl() external view returns (uint) {
        return defaultPool.getETH();
    }
    
    // Return the total CLV in the Stability Pool
    function getStabilityPoolCLV() external view returns (uint) {
        return stabilityPool.getTotalCLVDeposits();
    }
    
    // --- Pool interaction functions ---

    // Add the received ETH to the total active collateral
    function addColl() external payable onlyBorrowerOperations {
        // Send ETH to Active Pool and increase its recorded ETH balance
       (bool success, ) = activePoolAddress.call.value(msg.value)("");
       assert(success == true);
    }
    
    // Transfer the specified amount of ETH to _account and updates the total active collateral
    function withdrawColl(address _account, uint _ETH) external onlyBorrowerOperations {
        activePool.sendETH(_account, _ETH);
    }
    
    // Issue the specified amount of CLV to _account and increases the total active debt
    function withdrawCLV(address _account, uint _CLV) external onlyBorrowerOperations {
        _withdrawCLV(_account, _CLV);
    }

    function _withdrawCLV(address _account, uint _CLV) internal {
        activePool.increaseCLVDebt(_CLV);
        CLV.mint(_account, _CLV);
    }
    
    // Burn the specified amount of CLV from _account and decreases the total active debt
    function repayCLV(address _account, uint _CLV) external onlyBorrowerOperations {
        _repayCLV(_account, _CLV);
    }

    function _repayCLV(address _account, uint _CLV) internal {
        activePool.decreaseCLVDebt(_CLV);
        CLV.burn(_account, _CLV);
    }

    function lockCLVGasCompensation(uint _CLV) external onlyBorrowerOperations {
        _withdrawCLV(GAS_POOL_ADDRESS, _CLV);
    }

    function refundCLVGasCompensation(uint _CLV) external onlyBorrowerOperations {
        _repayCLV(GAS_POOL_ADDRESS, _CLV);
    }

    function sendCLVGasCompensation(address _user, uint _CLV) external onlyCDPManager {
        CLV.returnFromPool(GAS_POOL_ADDRESS, _user, _CLV);
    }

    // Update the Active Pool and the Default Pool when a CDP gets liquidated
    function liquidate(uint _CLV, uint _ETH) external onlyCDPManager {
        // Transfer the debt & coll from the Active Pool to the Default Pool
        defaultPool.increaseCLVDebt(_CLV);
        activePool.decreaseCLVDebt(_CLV);
        activePool.sendETH(defaultPoolAddress, _ETH);
    }

    // Move a CDP's pending debt and collateral rewards from distributions, from the Default Pool to the Active Pool
    function movePendingTroveRewardsToActivePool(uint _CLV, uint _ETH) external onlyCDPManager {
        // Transfer the debt & coll from the Default Pool to the Active Pool
        defaultPool.decreaseCLVDebt(_CLV);  
        activePool.increaseCLVDebt(_CLV); 
        defaultPool.sendETH(activePoolAddress, _ETH); 
    }

    // Burn the received CLV, transfers the redeemed ETH to _account and updates the Active Pool
    function redeemCollateral(address _account, uint _CLV, uint _ETH) external onlyCDPManager {
        // Update Active Pool CLV, and send ETH to account
        CLV.burn(_account, _CLV); 
        activePool.decreaseCLVDebt(_CLV);  

        activePool.sendETH(_account, _ETH); 
    }

    /*
      Burn the remaining gas compensation CLV, transfers the remaining ETH to _account and updates the Active Pool
     * It’s called by CDPManager when after redemption there’s only gas compensation left as debt
     */
    function redeemCloseLoan(address _account, uint _CLV, uint _ETH) external onlyCDPManager {
        /*
         * This is called by CDPManager when the redemption drains all the trove and there’s only the gas compensation left.
         * The redeemer swaps (debt - 10) CLV for (debt - 10) worth of ETH, so the 10 CLV gas compensation left correspond to the remaining collateral.
         * In order to close the trove, the user should get the CLV refunded and use them to repay and close it,
         * but instead we do that all in one step.
         */
        CLV.burn(GAS_POOL_ADDRESS, _CLV);
        // Update Active Pool CLV, and send ETH to account
        activePool.decreaseCLVDebt(_CLV);

        activePool.sendETH(_account, _ETH);
    }

    // Transfer the CLV tokens from the user to the Stability Pool's address, and update its recorded CLV
    function _sendCLVtoStabilityPool(address _address, uint _amount) internal {
        CLV.sendToPool(_address, stabilityPoolAddress, _amount);
        stabilityPool.increaseCLV(_amount);
    }

    // --- Reward calculator functions ---

    function getCurrentETHGain(address _user) external view returns (uint) {
        return _getCurrentETHGain(_user);
    }

    /* Return the ETH gain earned by the deposit. Given by the formula:  E = d0 * (S - S(0))/P(0)
    where S(0) and P(0) are the depositor's snapshots of the sum S and product P, respectively. */
    function _getCurrentETHGain(address _user) internal view returns (uint) {
        uint initialDeposit = initialDeposits[_user];

        if (initialDeposit == 0) { return 0; }

        Snapshot storage userSnapshot = snapshot[_user];
        uint scaleSnapshot = userSnapshot.scale;
        uint epochSnapshot = userSnapshot.epoch;

        uint ETHGain;

        /* Grab the reward sum from the epoch at which the deposit was made. The reward may span up to 
        one scale change.  
        If it does, the second portion of the reward is scaled by 1e18. 
        If the reward spans no scale change, the second portion will be 0. */
        uint firstPortion = epochToScaleToSum[epochSnapshot][scaleSnapshot].sub(userSnapshot.S);
        uint secondPortion = epochToScaleToSum[epochSnapshot][scaleSnapshot.add(1)].div(1e18);

        ETHGain = initialDeposit.mul(firstPortion.add(secondPortion)).div(userSnapshot.P).div(1e18);
        
        return ETHGain;
    }

    function getCompoundedCLVDeposit(address _user) external view returns (uint) {
        return _getCompoundedCLVDeposit(_user);
    }

    /* Return the user's compounded deposit.  Given by the formula:  d = d0 * P/P(0)
    where P(0) is the depositor's snapshot of the product P. */
    function _getCompoundedCLVDeposit(address _user) internal view returns (uint) {
        uint initialDeposit = initialDeposits[_user];

        if (initialDeposit == 0) { return 0; }

        Snapshot storage userSnapshot = snapshot[_user];
        uint snapshot_P = userSnapshot.P;
        uint128 scaleSnapshot = userSnapshot.scale;
        uint128 epochSnapshot = userSnapshot.epoch;

        // If deposit was made before a pool-emptying event, then it has been fully cancelled with debt -- so, return 0
        if (epochSnapshot < currentEpoch) { return 0; }

        uint compoundedDeposit;
        uint128 scaleDiff = currentScale.sub(scaleSnapshot);
    
        /* Compute the compounded deposit. If a scale change in P was made during the deposit's lifetime, 
        account for it. If more than one scale change was made, then the deposit has decreased by a factor of 
        at least 1e-18 -- so return 0.*/
        if (scaleDiff == 0) { 
            compoundedDeposit = initialDeposit.mul(P).div(snapshot_P);
        } else if (scaleDiff == 1) {
            compoundedDeposit = initialDeposit.mul(P).div(snapshot_P).div(1e18);
        } else {
            compoundedDeposit = 0;
        }

        // If compounded deposit is less than a billionth of the initial deposit, return 0
        // TODO: confirm the reason:
        // to make sure that any numerical error from floor-division always "favors the system"
        if (compoundedDeposit < initialDeposit.div(1e9)) { return 0; }

        return compoundedDeposit;
    }

    // --- Sender functions for CLV deposits and ETH gains ---

    function _sendETHGainToUser(address _address, uint ETHGain) internal {
        stabilityPool.sendETH(_address, ETHGain);
    }
    
    // Send ETHGain to CDP. Send in two steps: StabilityPool -> PoolManager -> user's CDP
    function _sendETHGainToCDP(address _address, uint _ETHGain, address _hint) internal {
        stabilityPool.sendETH(address(this), _ETHGain); 
        borrowerOperations.addColl.value(_ETHGain)(_address, _hint); 
    }

    // Send CLV to user and decrease CLV in Pool
    function _sendCLVToUser(address _address, uint CLVWithdrawal) internal {
        uint CLVinPool = stabilityPool.getTotalCLVDeposits();
        assert(CLVWithdrawal <= CLVinPool);

        CLV.returnFromPool(stabilityPoolAddress, _address, CLVWithdrawal); 
        stabilityPool.decreaseCLV(CLVWithdrawal);
    }

    // --- Stability Pool Deposit Functionality --- 

    // Record a new deposit
    function _updateDeposit(address _address, uint _amount) internal {
        Snapshot storage userSnapshot = snapshot[_address];
        if (_amount == 0) {
            initialDeposits[_address] = 0;
            delete snapshot[_address];
            emit UserSnapshotUpdated(_address, 0, 0);
            return;
        }

        initialDeposits[_address] = _amount;
    
        uint128 currentScaleCached = currentScale;
        uint128 currentEpochCached = currentEpoch;
        uint currentP = P;
        uint currentS = epochToScaleToSum[currentEpochCached][currentScaleCached];
        // Record new individual snapshots of the running product P and sum S for the user
        userSnapshot.P = currentP;
        userSnapshot.S = currentS;
        userSnapshot.scale = currentScaleCached;
        userSnapshot.epoch = currentEpochCached;

        emit UserSnapshotUpdated(_address, currentP, currentS);
    }
 
    // --- External StabilityPool Functions ---

    /* Send ETHGain to user's address, and updates their deposit, 
    setting newDeposit = compounded deposit + amount. */
    function provideToSP(uint _amount) external {
        address user = _msgSender();
        uint initialDeposit = initialDeposits[user];

        if (initialDeposit == 0) {
            _sendCLVtoStabilityPool(user, _amount);
            _updateDeposit(user, _amount);
        
            emit UserDepositChanged(user, _amount);

        } else { // If user already has a deposit, make a new composite deposit and retrieve their ETH gain
            uint compoundedCLVDeposit = _getCompoundedCLVDeposit(user);
            uint CLVLoss = initialDeposit.sub(compoundedCLVDeposit);
            uint ETHGain = _getCurrentETHGain(user);

            uint newDeposit = compoundedCLVDeposit.add(_amount);

            _sendCLVtoStabilityPool(user, _amount);
            _updateDeposit(user, newDeposit);

            _sendETHGainToUser(user, ETHGain);
            
            emit ETHGainWithdrawn(user, ETHGain, CLVLoss);
            emit UserDepositChanged(user, newDeposit); 
        }
    }

    /* Withdraw _amount of CLV and the caller’s entire ETH gain from the 
    Stability Pool, and updates the caller’s reduced deposit. 

    If  _amount is 0, the user only withdraws their ETH gain, no CLV.
    If _amount > userDeposit, the user withdraws all their ETH gain, and all of their compounded deposit.

    In all cases, the entire ETH gain is sent to user. */
    function withdrawFromSP(uint _amount) external {
        address user = _msgSender();
        _requireUserHasDeposit(user); 

        uint initialDeposit = initialDeposits[user];
        uint compoundedCLVDeposit = _getCompoundedCLVDeposit(user);
        uint CLVLoss = initialDeposit.sub(compoundedCLVDeposit);
        uint ETHGain = _getCurrentETHGain(user);

        uint CLVtoWithdraw = Math._min(_amount, compoundedCLVDeposit);
        uint CLVremainder = compoundedCLVDeposit.sub(CLVtoWithdraw);

        _sendCLVToUser(user, CLVtoWithdraw);
        _updateDeposit(user, CLVremainder);
      
        _sendETHGainToUser(user, ETHGain);

        emit ETHGainWithdrawn(user, ETHGain, CLVLoss);
        emit UserDepositChanged(user, CLVremainder); 
    }

    /* Transfer the caller's entire ETH gain from the Stability Pool to the caller's CDP, and leaves
    their compounded deposit in the Stability Pool.
     */
    function withdrawFromSPtoCDP(address _hint) external {
        address user = _msgSender();
        _requireUserHasDeposit(user);
        _requireUserHasTrove(user);

        uint initialDeposit = initialDeposits[user];
        uint compoundedCLVDeposit = _getCompoundedCLVDeposit(user);
        uint CLVLoss = initialDeposit.sub(compoundedCLVDeposit);
        uint ETHGain = _getCurrentETHGain(user);
       
        // Update the recorded deposit value, and deposit snapshots
        _updateDeposit(user, compoundedCLVDeposit);

        /* Emit events before transferring ETH gain to CDP.
         This lets the event log make more sense (i.e. so it appears that first the ETH gain is withdrawn 
        and then it is deposited into the CDP, not the other way around). */
        emit ETHGainWithdrawn(user, ETHGain, CLVLoss);
        emit UserDepositChanged(user, compoundedCLVDeposit); 

        _sendETHGainToCDP(user, ETHGain, _hint);
    }

     /* Cancel out the specified _debt against the CLV contained in the Stability Pool (as far as possible)  
    and transfers the CDP's ETH collateral from ActivePool to StabilityPool. 
    Only called from liquidation functions in CDPManager. */
    function offset(uint _debtToOffset, uint _collToAdd) 
    external 
    onlyCDPManager
    {    
        uint totalCLVDeposits = stabilityPool.getTotalCLVDeposits();
        if (totalCLVDeposits == 0 || _debtToOffset == 0) { return; }
        
        (uint ETHGainPerUnitStaked,
         uint CLVLossPerUnitStaked) = _computeRewardsPerUnitStaked(_collToAdd, _debtToOffset, totalCLVDeposits);

        _updateRewardSumAndProduct(ETHGainPerUnitStaked, CLVLossPerUnitStaked);

        _moveOffsetCollAndDebt(_collToAdd, _debtToOffset);
    }

    // --- Offset helper functions ---

    function _computeRewardsPerUnitStaked(uint _collToAdd, uint _debtToOffset, uint _totalCLVDeposits) 
    internal 
    returns (uint ETHGainPerUnitStaked, uint CLVLossPerUnitStaked) 
    {
        uint CLVLossNumerator = _debtToOffset.mul(1e18).sub(lastCLVLossError_Offset);
        uint ETHNumerator = _collToAdd.mul(1e18).add(lastETHError_Offset);

        // Compute the CLV and ETH rewards, and error corrections
        if (_debtToOffset >= _totalCLVDeposits) {
            CLVLossPerUnitStaked = 1e18;
            lastCLVLossError_Offset = 0;
        } else {
            CLVLossPerUnitStaked = (CLVLossNumerator.div(_totalCLVDeposits)).add(1); // add 1 to make error in quotient positive
             lastCLVLossError_Offset = (CLVLossPerUnitStaked.mul(_totalCLVDeposits)).sub(CLVLossNumerator);
        } 

        ETHGainPerUnitStaked = ETHNumerator.div(_totalCLVDeposits); 
        lastETHError_Offset = ETHNumerator.sub(ETHGainPerUnitStaked.mul(_totalCLVDeposits)); 

        return (ETHGainPerUnitStaked, CLVLossPerUnitStaked);
    }

    // Update the Stability Pool reward sum S and product P
    function _updateRewardSumAndProduct(uint _ETHGainPerUnitStaked, uint _CLVLossPerUnitStaked) internal {
        uint currentP = P;
        uint newP;

        // Make product factor 0 if there was a pool-emptying. Otherwise, it is (1 - CLVLossPerUnitStaked)
        uint newProductFactor = _CLVLossPerUnitStaked >= 1e18 ? 0 : uint(1e18).sub(_CLVLossPerUnitStaked);
     
        // Update the ETH reward sum at the current scale and current epoch
        uint128 currentScaleCached = currentScale;
        uint128 currentEpochCached = currentEpoch;
        uint currentS = epochToScaleToSum[currentEpochCached][currentScaleCached];
        uint marginalETHGain = _ETHGainPerUnitStaked.mul(currentP);
        uint newS = currentS.add(marginalETHGain);
        epochToScaleToSum[currentEpochCached][currentScaleCached] = newS;
        emit S_Updated(newS);

       // If the Pool was emptied, increment the epoch and reset the scale and product P
        if (newProductFactor == 0) {
            currentEpoch = currentEpochCached.add(1);
            currentScale = 0;
            newP = 1e18;
    
        // If multiplying P by a non-zero product factor would round P to zero, increment the scale 
        } else if (currentP.mul(newProductFactor) < 1e18) {
            newP = currentP.mul(newProductFactor);
            currentScale = currentScaleCached.add(1);
         } else {
            newP = currentP.mul(newProductFactor).div(1e18);
        }

        P = newP;
        emit P_Updated(newP);
    }

    function _moveOffsetCollAndDebt(uint _collToAdd, uint _debtToOffset) internal {
        // Cancel the liquidated CLV debt with the CLV in the stability pool
        activePool.decreaseCLVDebt(_debtToOffset);  
        stabilityPool.decreaseCLV(_debtToOffset); 
       
        // Send ETH from Active Pool to Stability Pool
        activePool.sendETH(stabilityPoolAddress, _collToAdd);  

        // Burn the debt that was successfully offset
        CLV.burn(stabilityPoolAddress, _debtToOffset); 
    }

    // --- 'require' wrapper functions ---

    function _requireUserHasDeposit(address _address) internal view {
        uint initialDeposit = initialDeposits[_address];  
        require(initialDeposit > 0, 'PoolManager: User must have a non-zero deposit');  
    }

    function _requireUserHasTrove(address _user) internal view {
        require(cdpManager.getCDPStatus(_user) == 1, "CDPManager: caller must have an active trove to withdraw ETHGain to");
    }

    function () external payable onlyStabilityPool {}
}
