pragma solidity 0.5.16;

import './Interfaces/IBorrowerOperations.sol';
import './Interfaces/IPool.sol';
import './Interfaces/IPoolManager.sol';
import './Interfaces/ICDPManager.sol';
import './Interfaces/IStabilityPool.sol';
import './Interfaces/IPriceFeed.sol';
import './Interfaces/ICLVToken.sol';
import "./Interfaces/ICommunityIssuance.sol";
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

    ICommunityIssuance public communityIssuance;
    address public communityIssuanceAddress;
   
   // --- Data structures ---
   
    struct FrontEnd {
        uint kickbackRate;
        bool registered;
    }

    struct Deposit {
        uint initialValue;
        address frontEndTag;
    }

    struct Snapshots { 
        uint S; 
        uint P; 
        uint G; 
        uint128 scale;
        uint128 epoch;
    }

    mapping (address => Deposit) public deposits;  // depositor address -> Deposit struct
    mapping (address => Snapshots) public depositSnapshots;  // depositor address -> snapshots struct

    mapping (address => FrontEnd) public frontEnds;  // front end address -> FrontEnd struct
    mapping (address => uint) public frontEndStakes; // front end address -> last recorded total deposits, tagged with that front end
    mapping (address => Snapshots) public frontEndSnapshots; // front end address -> snapshots struct

    /* Product 'P': Running product by which to multiply an initial deposit, in order to find the current compounded deposit, 
    given a series of liquidations, each of which cancel some CLV debt with the deposit. 

    During its lifetime, a deposit's value evolves from d(0) to d(0) * P / P(0) , where P(0) 
    is the snapshot of P taken at the instant the deposit was made. 18-digit decimal.  */
    uint public P = 1e18;

     // Each time the scale of P shifts by 1e18, the scale is incremented by 1
    uint128 public currentScale; 

    // With each offset that fully empties the Pool, the epoch is incremented by 1
    uint128 public currentEpoch;  

    /* ETH Gain sum 'S': During it's lifetime, each deposit d(0) earns an ETH gain of ( d(0) * [S - S(0)] )/P(0), where S(0) 
    is the depositor's snapshot of S taken at the instant the deposit was made.  
    
    The 'S' sums are stored in a nested mapping (epoch => scale => sum):

    - The inner mapping records the sum S at different scales
    - The outer mapping records the (scale => sum) mappings, for different epochs. */
    mapping (uint => mapping(uint => uint)) public epochToScaleToSum;

    /* Similarly, the sum 'G' is used to calculate LQTY gains. During it's lifetime, each deposit d(0) earns a LQTY gain of 
    ( d(0) * [G - G(0)] )/P(0), where G(0) is the depositor's snapshot of G taken at the instant the deposit was made. 
    
    LQTY reward events are NOT coupled to liquidations, but rather, they are triggered by depositor operations 
    (topup, withdrawal, etc).

    */ 
    mapping (uint => mapping(uint => uint)) public epochToScaleToG;

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
    
    event FrontEndRegistered(address indexed _frontEnd, uint _kickbackRate);

    event DepositSnapshotUpdated(address indexed _depositor, uint _P, uint _S, uint _G);
    event FrontEndSnapshotUpdated(address indexed _frontEnd, uint _P, uint _G);
    
    event P_Updated(uint _P);
    event S_Updated(uint _S);
    event G_Updated(uint _G);

    event UserDepositChanged(address indexed _depositor, uint _newDeposit);
    event FrontEndStakeChanged(address indexed _frontEnd, uint _newFrontEndStake, address _depositor);

    event ETHGainWithdrawn(address indexed _depositor, uint _ETH, uint _CLVLoss);
    event LQTYPaidToDepositor(address indexed _depositor, uint _LQTY);
    event LQTYPaidToFrontEnd(address indexed _frontEnd, uint _LQTY);

    // --- Dependency setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _cdpManagerAddress,
        address _priceFeedAddress,
        address _CLVAddress,
        address _stabilityPoolAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _communityIssuanceAddress
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
        defaultPool = IPool(defaultPoolAddress);
        communityIssuanceAddress = _communityIssuanceAddress;
        communityIssuance = ICommunityIssuance(_communityIssuanceAddress);

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
    function addColl() external payable {
        _requireCallerIsBorrowerOperations();
    
        (bool success, ) = activePoolAddress.call.value(msg.value)("");
        assert(success == true);
    }
    
    // Transfer the specified amount of ETH to _account and updates the total active collateral
    function withdrawColl(address _account, uint _ETH) external {
        _requireCallerIsBorrowerOperations();
        activePool.sendETH(_account, _ETH);
    }
    
    // Issue the specified amount of CLV (minus the fee) to _account, and increase the total active debt
    function withdrawCLV(address _account, uint _CLVAmount, uint _CLVFee) public {
        _requireCallerIsBorrowerOperations();

        uint totalCLVDrawn = _CLVAmount.add(_CLVFee);
        activePool.increaseCLVDebt(totalCLVDrawn);  
        CLV.mint(_account, _CLVAmount);  
    }

    // Burn the specified amount of CLV from _account and decreases the total active debt
    function repayCLV(address _account, uint _CLV) external {
        _requireCallerIsBorrowerOperations();
        activePool.decreaseCLVDebt(_CLV);
        CLV.burn(_account, _CLV);
    }       

    function lockCLVGasCompensation(uint _CLVGasComp) external {
        _requireCallerIsBorrowerOperations();
        activePool.increaseCLVDebt(_CLVGasComp);  
        CLV.mint(GAS_POOL_ADDRESS, _CLVGasComp);  
    }

    function refundCLVGasCompensation(uint _CLVGasComp) external {
        _requireCallerIsBorrowerOperations();
        activePool.decreaseCLVDebt(_CLVGasComp);
        CLV.burn(GAS_POOL_ADDRESS, _CLVGasComp);
    }

    function sendCLVGasCompensation(address _user, uint _CLVGasComp) external {
        _requireCallerIsCDPManager();
        CLV.returnFromPool(GAS_POOL_ADDRESS, _user, _CLVGasComp);
    }

    // Update the Active Pool and the Default Pool when a CDP gets closed
    function liquidate(uint _CLV, uint _ETH) external {
        _requireCallerIsCDPManager();

        defaultPool.increaseCLVDebt(_CLV);
        activePool.decreaseCLVDebt(_CLV);
        activePool.sendETH(defaultPoolAddress, _ETH);
    }

    // Move a CDP's pending debt and collateral rewards from distributions, from the Default Pool to the Active Pool
    function movePendingTroveRewardsToActivePool(uint _CLV, uint _ETH) external {
        _requireCallerIsCDPManager();

        defaultPool.decreaseCLVDebt(_CLV);  
        activePool.increaseCLVDebt(_CLV); 
        defaultPool.sendETH(activePoolAddress, _ETH); 
    }

    // Burn the received CLV, transfer the redeemed ETH to _account and updates the Active Pool
    function redeemCollateral(address _account, uint _CLV, uint _ETH) external {
        _requireCallerIsCDPManager();
       
        CLV.burn(_account, _CLV); 
        activePool.decreaseCLVDebt(_CLV);  
        activePool.sendETH(_account, _ETH); 
    }

    /* This is called by CDPManager when the redemption fully cancels CLV with the trove owner's drawn debt, and there’s only the gas compensation left.
    The redeemer swaps (debt - 10) CLV for (debt - 10) worth of ETH, so the 10 CLV gas compensation left corresponds to the remaining debt.
    
    This 10 CLV gas compensation is burned. Therefore, the total CLV burned in a redemption equals the full debt of the trove.
    Since redeemed-from troves have >=110% ICR, a full redemption leaves the trove with some surplus ETH, which is sent out to the trove owner. */
    function redeemCloseLoan(address _account, uint _CLV, uint _ETH) external {
        _requireCallerIsCDPManager();
     
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

    // --- Reward calculator functions for depositor and front end ---

    /* Return the ETH gain earned by the deposit. Given by the formula:  E = d0 * (S - S(0))/P(0)
    where S(0) and P(0) are the depositor's snapshots of the sum S and product P, respectively. */
    function getDepositorETHGain(address _depositor) public view returns (uint) {
        uint initialDeposit = deposits[_depositor].initialValue;

        if (initialDeposit == 0) { return 0; }

        Snapshots memory snapshots = depositSnapshots[_depositor];

        uint ETHGain = _getETHGainFromSnapshots(initialDeposit, snapshots);
        return ETHGain;
    }

    function _getETHGainFromSnapshots(uint initialDeposit, Snapshots memory snapshots) internal view returns (uint) {
        /* Grab the reward sum from the epoch at which the stake was made. The reward may span up to one scale change.  
        If it does, the second portion of the reward is scaled by 1e18. 
        If the reward spans no scale change, the second portion will be 0. */
        
        uint128 epochSnapshot = snapshots.epoch;
        uint128 scaleSnapshot = snapshots.scale;
        uint S_Snapshot = snapshots.S;
        uint P_Snapshot = snapshots.P;

        uint firstPortion = epochToScaleToSum[epochSnapshot][scaleSnapshot].sub(S_Snapshot);
        uint secondPortion = epochToScaleToSum[epochSnapshot][scaleSnapshot.add(1)].div(1e18);

        uint ETHGain = initialDeposit.mul(firstPortion.add(secondPortion)).div(P_Snapshot).div(1e18);
        
        return ETHGain;
    }

    /* Return the LQTY gain earned by the deposit. Given by the formula:  LQTY = d0 * (G - G(0))/P(0)
    where G(0) and P(0) are the depositor's snapshots of the sum G and product P, respectively. 
    
    d0 is the last recorded deposit value. */
    function getDepositorLQTYGain(address _depositor) public view returns (uint) {
       
        uint initialDeposit = deposits[_depositor].initialValue;
        if (initialDeposit == 0) {return 0;}

        address frontEndTag = deposits[_depositor].frontEndTag;

        // If not tagged with a front end, depositor gets a 100% cut
        uint kickbackRate = frontEndTag == address(0) ? 1e18 : frontEnds[frontEndTag].kickbackRate;

        Snapshots memory snapshots = depositSnapshots[_depositor];  
      
        uint LQTYGain = kickbackRate.mul(_getLQTYGainFromSnapshots(initialDeposit, snapshots)).div(1e18);

        return LQTYGain;
    }

    /* Return the LQTY gain earned by the front end. Given by the formula:  E = D0 * (G - G(0))/P(0)
    where G(0) and P(0) are the depositor's snapshots of the sum G and product P, respectively.

    D0 is the last recorded value of the front end's total tagged deposits. */
    function getFrontEndLQTYGain(address _frontEnd) public view returns (uint) {
        uint frontEndStake = frontEndStakes[_frontEnd];
        if (frontEndStake == 0) { return 0; }

        uint kickbackRate = frontEnds[_frontEnd].kickbackRate;
        uint frontEndShare = uint(1e18).sub(kickbackRate);

        Snapshots memory snapshots = frontEndSnapshots[_frontEnd];  
    
        uint LQTYGain = frontEndShare.mul(_getLQTYGainFromSnapshots(frontEndStake, snapshots)).div(1e18);
        return LQTYGain;
    }

    function _getLQTYGainFromSnapshots(uint initialStake, Snapshots memory snapshots) internal view returns (uint) {
        /* Grab the reward sum from the epoch at which the stake was made. The reward may span up to one scale change.  
        If it does, the second portion of the reward is scaled by 1e18. 
        If the reward spans no scale change, the second portion will be 0. */

        uint128 epochSnapshot = snapshots.epoch;
        uint128 scaleSnapshot = snapshots.scale;
        uint G_Snapshot = snapshots.G;
        uint P_Snapshot = snapshots.P;

        uint firstPortion = epochToScaleToG[epochSnapshot][scaleSnapshot].sub(G_Snapshot);
        uint secondPortion = epochToScaleToG[epochSnapshot][scaleSnapshot.add(1)].div(1e18);

        uint LQTYGain = initialStake.mul(firstPortion.add(secondPortion)).div(P_Snapshot).div(1e18);
        
        return LQTYGain;
    }

    // --- Compounded deposit and compounded front end stake ---

    /* Return the user's compounded deposit.  Given by the formula:  d = d0 * P/P(0)
    where P(0) is the depositor's snapshot of the product P. */
    function getCompoundedCLVDeposit(address _depositor) public view returns (uint) {
        uint initialDeposit = deposits[_depositor].initialValue;
        if (initialDeposit == 0) { return 0; }

        Snapshots memory snapshots = depositSnapshots[_depositor]; 
       
        uint compoundedDeposit = _getCompoundedStakeFromSnapshots(initialDeposit, snapshots);
        return compoundedDeposit;
    }

    /* Return the user's compounded deposit.  Given by the formula:  d = d0 * P/P(0)
    where P(0) is the depositor's snapshot of the product P. */
    function getCompoundedFrontEndStake(address _frontEnd) public view returns (uint) {
        uint frontEndStake = frontEndStakes[_frontEnd];
        if (frontEndStake == 0) { return 0; }

        Snapshots memory snapshots = frontEndSnapshots[_frontEnd]; 
       
        uint compoundedFrontEndStake = _getCompoundedStakeFromSnapshots(frontEndStake, snapshots);
        return compoundedFrontEndStake;
    }

    function _getCompoundedStakeFromSnapshots(uint initialStake, Snapshots memory snapshots) 
    internal 
    view 
    returns (uint)
    {
        uint snapshot_P = snapshots.P;
        uint128 scaleSnapshot = snapshots.scale;
        uint128 epochSnapshot = snapshots.epoch;

        // If deposit was made before a pool-emptying event, then it has been fully cancelled with debt -- so, return 0
        if (epochSnapshot < currentEpoch) { return 0; }
       
        uint compoundedStake;
        uint128 scaleDiff = currentScale.sub(scaleSnapshot);
    
        /* Compute the compounded stake. If a scale change in P was made during the stake's lifetime, 
        account for it. If more than one scale change was made, then the stake has decreased by a factor of 
        at least 1e-18 -- so return 0.*/
        if (scaleDiff == 0) { 
            compoundedStake = initialStake.mul(P).div(snapshot_P);
        } else if (scaleDiff == 1) {
            compoundedStake = initialStake.mul(P).div(snapshot_P).div(1e18);
        } else {
            compoundedStake = 0;
        }

        // If compounded deposit is less than a billionth of the initial deposit, return 0
        // TODO: confirm the reason:
        // to make sure that any numerical error from floor-division always "favors the system"
        if (compoundedStake < initialStake.div(1e9)) {return 0;}

        return compoundedStake;
    }

    // --- Sender functions for CLV deposit,  ETH gains and LQTY gains ---

    function _sendETHGainToDepositor(address _depositor, uint ETHGain) internal {
        if (ETHGain == 0) {return;}
        stabilityPool.sendETH(_depositor, ETHGain);
    }
    
    // Send ETHGain to depositor's CDP. Send in two steps: StabilityPool -> PoolManager -> depositor's CDP
    function _sendETHGainToCDP(address _depositor, uint _ETHGain, address _hint) internal {
        stabilityPool.sendETH(address(this), _ETHGain); 
        borrowerOperations.addColl.value(_ETHGain)(_depositor, _hint); 
    }

    // Send CLV to user and decrease CLV in Pool
    function _sendCLVToDepositor(address _depositor, uint CLVWithdrawal) internal {
        uint CLVinPool = stabilityPool.getTotalCLVDeposits();
        assert(CLVWithdrawal <= CLVinPool);

        CLV.returnFromPool(stabilityPoolAddress, _depositor, CLVWithdrawal); 
        stabilityPool.decreaseCLV(CLVWithdrawal);
    }

    // --- External Front End functions ---

    function registerFrontEnd(uint _kickbackRate) external {
        _requireFrontEndNotRegistered(msg.sender);
        _requireValidKickbackRate(_kickbackRate);

        frontEnds[msg.sender].kickbackRate = _kickbackRate;
        frontEnds[msg.sender].registered = true;

        emit FrontEndRegistered(msg.sender, _kickbackRate);
    }

    // --- Stability Pool Deposit Functionality --- 

    function getFrontEndTag(address _depositor) public view returns (address) {
        return deposits[_depositor].frontEndTag;
    }
    
    function _setFrontEndTag(address _depositor, address _frontEndTag) internal {
        deposits[_depositor].frontEndTag = _frontEndTag;
    }

    // Record a new deposit
    function _updateDepositAndSnapshots(address _depositor, uint _newValue) internal {
        deposits[_depositor].initialValue = _newValue;

        if (_newValue == 0) {
            delete deposits[_depositor].frontEndTag;
            delete depositSnapshots[_depositor];
            emit DepositSnapshotUpdated(_depositor, 0, 0, 0);
            return;
        } 

        uint128 currentScaleCached = currentScale;
        uint128 currentEpochCached = currentEpoch;
        uint currentP = P;
        uint currentS = epochToScaleToSum[currentEpochCached][currentScaleCached];
        uint currentG = epochToScaleToG[currentEpochCached][currentScaleCached];

        // Record new individual snapshots of the running product P, sum S  and sum G, for the depositor
        depositSnapshots[_depositor].P = currentP;
        depositSnapshots[_depositor].S = currentS;
        depositSnapshots[_depositor].G = currentG;
        depositSnapshots[_depositor].scale = currentScaleCached;
        depositSnapshots[_depositor].epoch = currentEpochCached;
        
        emit DepositSnapshotUpdated(_depositor, currentP, currentS, currentG);
    }

    function _updateFrontEndStakeAndSnapshots(address _frontEnd, uint _newValue) internal {
        frontEndStakes[_frontEnd] = _newValue;

        if (_newValue == 0) {
            delete frontEndSnapshots[_frontEnd];
            emit FrontEndSnapshotUpdated(_frontEnd, 0, 0);
            return;
        } 

        uint128 currentScaleCached = currentScale;
        uint128 currentEpochCached = currentEpoch;
        uint currentP = P;
        uint currentG = epochToScaleToG[currentEpochCached][currentScaleCached];

        // Record new individual snapshots of the running product P and sum G for the front end
        frontEndSnapshots[_frontEnd].P = currentP;
        frontEndSnapshots[_frontEnd].G = currentG;
        frontEndSnapshots[_frontEnd].scale = currentScaleCached;
        frontEndSnapshots[_frontEnd].epoch = currentEpochCached;
        
        emit FrontEndSnapshotUpdated(_frontEnd, currentP, currentG);
    }

    function _payOutLQTYGains(address _depositor, address _frontEnd) internal {
        // Pay out front end's LQTY gain
        if (_frontEnd != address(0)) {
            uint frontEndLQTYGain = getFrontEndLQTYGain(_frontEnd);
            communityIssuance.sendLQTY(_frontEnd, frontEndLQTYGain);
            emit LQTYPaidToFrontEnd(_frontEnd, frontEndLQTYGain);
        }
        
        // Pay out depositor's LQTY gain
        uint depositorLQTYGain = getDepositorLQTYGain(_depositor);
        communityIssuance.sendLQTY(_depositor, depositorLQTYGain);

        emit LQTYPaidToDepositor(_depositor, depositorLQTYGain);
    }

    // --- External Depositor Functions ---
   
    /* provideToSP():

    - Triggers a LQTY reward, shared between all depositors and front ends
    - Tags deposit with the front end tag param, if it's a new deposit
    - Sends all accumulated gains (LQTY, ETH) to depositor and front end
    - Increases deposit and front end stake, and takes new snapshots for each.
    */
    function provideToSP(uint _amount, address _frontEndTag) external {
        _requireFrontEndIsRegisteredOrZero(_frontEndTag);
        _requireNonZeroAmount(_amount);

        address depositor = _msgSender();
        uint initialDeposit = deposits[depositor].initialValue;

        _triggerLQTYIssuance(); 

        if (initialDeposit == 0) {_setFrontEndTag(depositor, _frontEndTag);}  

        uint depositorETHGain = getDepositorETHGain(depositor);
        uint compoundedCLVDeposit = getCompoundedCLVDeposit(depositor);
        uint CLVLoss = initialDeposit.sub(compoundedCLVDeposit); // Needed only for event log

        // First pay out any LQTY gains 
        address frontEnd = deposits[depositor].frontEndTag;
        _payOutLQTYGains(depositor, frontEnd);
    
        // Update front end stake
        uint compoundedFrontEndStake = getCompoundedFrontEndStake(frontEnd);
        uint newFrontEndStake = compoundedFrontEndStake.add(_amount);
        _updateFrontEndStakeAndSnapshots(frontEnd, newFrontEndStake);
        emit FrontEndStakeChanged(frontEnd, newFrontEndStake, depositor);
        
        _sendCLVtoStabilityPool(depositor, _amount);

        uint newDeposit = compoundedCLVDeposit.add(_amount);
        _updateDepositAndSnapshots(depositor, newDeposit);
        emit UserDepositChanged(depositor, newDeposit);

        _sendETHGainToDepositor(depositor, depositorETHGain);

        emit ETHGainWithdrawn(depositor, depositorETHGain, CLVLoss); // CLV Loss required for event log 
    }

    /* withdrawFromSP(): 

    - Triggers a LQTY reward, shared between all depositors and front ends
    - Removes deposit's front end tag if it is a full withdrawal
    - Sends all accumulated gains (LQTY, ETH) to depositor and front end
    - Decreases deposit and front end stake, and takes new snapshots for each.

    If _amount > userDeposit, the user withdraws all of their compounded deposit. */
    function withdrawFromSP(uint _amount) external {
        address depositor = _msgSender();
        _requireUserHasDeposit(depositor); 
        uint initialDeposit = deposits[depositor].initialValue;
        
        _triggerLQTYIssuance();
        
        uint depositorETHGain = getDepositorETHGain(depositor);
        
        uint compoundedCLVDeposit = getCompoundedCLVDeposit(depositor);
        uint CLVtoWithdraw = Math._min(_amount, compoundedCLVDeposit);
        uint CLVLoss = initialDeposit.sub(compoundedCLVDeposit); // Needed only for event log
      
        // First pay out any LQTY gains 
        address frontEnd = deposits[depositor].frontEndTag;
        _payOutLQTYGains(depositor, frontEnd);
    
        // Update front end stake
        uint compoundedFrontEndStake = getCompoundedFrontEndStake(frontEnd);
        uint newFrontEndStake = compoundedFrontEndStake.sub(CLVtoWithdraw);
        _updateFrontEndStakeAndSnapshots(frontEnd, newFrontEndStake);
        emit FrontEndStakeChanged(frontEnd, newFrontEndStake, depositor);
        
        _sendCLVToDepositor(depositor, CLVtoWithdraw);

        // Update deposit
        uint newDeposit = compoundedCLVDeposit.sub(CLVtoWithdraw);
        _updateDepositAndSnapshots(depositor, newDeposit);  
        emit UserDepositChanged(depositor, newDeposit);
       
        _sendETHGainToDepositor(depositor, depositorETHGain);

        emit ETHGainWithdrawn(depositor, depositorETHGain, CLVLoss);  // CLV Loss required for event log
    }

    /* withdrawETHGainToTrove:
    - Issues LQTY gain to depositor and front end
    - Transfers the depositor's entire ETH gain from the Stability Pool to the caller's CDP
    - Leaves their compounded deposit in the Stability Pool
    - Updates snapshots for deposit and front end stake
    
    TODO: Remove _user depositor and just use _msgSender(). */
    function withdrawETHGainToTrove(address _hint) external {
        address depositor = _msgSender();
        _requireUserHasDeposit(depositor); 
        _requireUserHasTrove(depositor);
        _requireUserHasETHGain(depositor);

        uint initialDeposit = deposits[depositor].initialValue;

        _triggerLQTYIssuance();  
        
        uint depositorETHGain = getDepositorETHGain(depositor);
        
        uint compoundedCLVDeposit = getCompoundedCLVDeposit(depositor);
        uint CLVLoss = initialDeposit.sub(compoundedCLVDeposit); // Needed only for event log
      
        // First pay out any LQTY gains 
        address frontEnd = deposits[depositor].frontEndTag;
        _payOutLQTYGains(depositor, frontEnd);
    
        // Update front end stake
        uint compoundedFrontEndStake = getCompoundedFrontEndStake(frontEnd);
        uint newFrontEndStake = compoundedFrontEndStake;
        _updateFrontEndStakeAndSnapshots(frontEnd, newFrontEndStake);
        emit FrontEndStakeChanged(frontEnd, newFrontEndStake, depositor);
    
        _updateDepositAndSnapshots(depositor, compoundedCLVDeposit); 

        /* Emit events before transferring ETH gain to CDP.
         This lets the event log make more sense (i.e. so it appears that first the ETH gain is withdrawn 
        and then it is deposited into the CDP, not the other way around). */
        emit ETHGainWithdrawn(depositor, depositorETHGain, CLVLoss);
        emit UserDepositChanged(depositor, compoundedCLVDeposit); 

        _sendETHGainToCDP(depositor, depositorETHGain, _hint);
    }

    // --- LQTY issuance functions ---

    function _triggerLQTYIssuance() internal {
        uint LQTYIssuance = communityIssuance.issueLQTY();
       _updateG(LQTYIssuance); 
    }

    // TODO: handle total deposits == 0?
    function _updateG(uint _LQTYIssuance) internal {
        uint totalCLVDeposits = stabilityPool.getTotalCLVDeposits();

        /* When total deposits is 0, G is not updated. In this case, the LQTY issued
        can not be obtained by later depositors - it is missed out on, and remains in the balance 
        of the CommunityIssuance contract. */
        if (totalCLVDeposits == 0) {return;}

        uint LQTYPerUnitStaked;
        LQTYPerUnitStaked =_computeLQTYPerUnitStaked(_LQTYIssuance, totalCLVDeposits);

        uint marginalLQTYGain = LQTYPerUnitStaked.mul(P);
        epochToScaleToG[currentEpoch][currentScale] = epochToScaleToG[currentEpoch][currentScale].add(marginalLQTYGain);
    }

    // TODO: Error correction here?
    function _computeLQTYPerUnitStaked (uint LQTYIssuance, uint totalCLVDeposits) internal pure returns (uint) {
        return LQTYIssuance.mul(1e18).div(totalCLVDeposits);
    }

    // --- Liquidation functions ---

    /* Cancel out the specified _debt against the CLV contained in the Stability Pool (as far as possible)  
    and transfers the CDP's ETH collateral from ActivePool to StabilityPool. 
    Only called from liquidation functions in CDPManager. */
    function offset(uint _debtToOffset, uint _collToAdd) external payable {    
        _requireCallerIsCDPManager();
        uint totalCLVDeposits = stabilityPool.getTotalCLVDeposits();
        if (totalCLVDeposits == 0 || _debtToOffset == 0) { return; }

        _triggerLQTYIssuance();

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
        assert(_CLVLossPerUnitStaked <= 1e18);
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

    function _requireOnlyStabilityPool() internal view {
        require(_msgSender() == stabilityPoolAddress, "PoolManager: Caller is not StabilityPool");
    }

    function _requireCallerIsBorrowerOperations() internal view {
        require(_msgSender() == borrowerOperationsAddress, "PoolManager: Caller is not the BorrowerOperations contract");
    }

    function _requireCallerIsCDPManager() internal view {
        require(_msgSender() == cdpManagerAddress, "PoolManager: Caller is not the CDPManager");
    }

    function _requireUserHasDeposit(address _address) internal view {
        uint initialDeposit = deposits[_address].initialValue;  
        require(initialDeposit > 0, 'PoolManager: User must have a non-zero deposit');  
    }

    function _requireNonZeroAmount(uint _amount) internal pure {
        require(_amount > 0, 'PoolManager: Amount must be non-zero');
    }

    function _requireUserHasTrove(address _user) internal view {
        require(cdpManager.getCDPStatus(_user) == 1, "CDPManager: caller must have an active trove to withdraw ETHGain to");
    }

    function _requireUserHasETHGain(address _user) internal view {
        uint ETHGain = getDepositorETHGain(_user);
        require(ETHGain > 0, "PoolManager: caller must have non-zero ETH Gain");
    }

    function _requireFrontEndNotRegistered(address _address) internal view {
        require(frontEnds[_address].registered == false, "PoolManager: must not already be a registered front end");
    }

     function _requireFrontEndIsRegisteredOrZero(address _address) internal view {
        require(frontEnds[_address].registered || _address == address(0), 
            "PoolManager: Tag must be a registered front end, or the zero address");
    }

    function  _requireValidKickbackRate(uint _kickbackRate) internal pure {
        require (_kickbackRate >= 0 && _kickbackRate <= 1e18, "PoolManager: Kickback rate must be in range [0,1]");
    }

    function _requireETHSentSuccessfully(bool _success) internal pure {
        require(_success, "CDPManager: Failed to send ETH to msg.sender");
    }

    // --- Fallback function ---
    
    function() external payable {
        _requireOnlyStabilityPool();
    }
}    
