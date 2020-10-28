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

    // --- Connected contract declarations ---

    IBorrowerOperations public borrowerOperations;
    address public borrowerOperationsAddress;

    address public cdpManagerAddress;
    ICDPManager public cdpManager;

    IPriceFeed public priceFeed;
    address public priceFeedAddress;

    ICLVToken public CLV;
    address public clvAddress;

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
        bool active;
    }

    struct Deposit {
        uint initialValue;
        address frontEndTag;
        bool eligibleForLQTY;
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
    
    event DepositSnapshotUpdated(address indexed _user, uint _P, uint _S);
    event P_Updated(uint _P);
    event S_Updated(uint _S);
    event DepositChanged(address indexed _user, uint _amount);
    event ETHGainWithdrawn(address indexed _user, uint _ETH, uint _CLVLoss);

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
        priceFeedAddress = _priceFeedAddress;
        priceFeed = IPriceFeed(_priceFeedAddress);
        clvAddress = _CLVAddress;
        CLV = ICLVToken(_CLVAddress);
        stabilityPoolAddress = _stabilityPoolAddress;
        stabilityPool = IStabilityPool(stabilityPoolAddress);
        activePoolAddress = _activePoolAddress;
        activePool = IPool(activePoolAddress);
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

    // Return the current ETH balance of the PoolManager contract
    function getBalance() external view returns (uint) {
        return address(this).balance;
    } 
    
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
        return stabilityPool.getCLV();
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
    function withdrawCLV(address _account, uint _CLVAmount, uint _CLVFee) external {
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

    /*closeLoan(): Repay the debt, and sends collateral back to the trove closer.

    If they have an LQTY-eligible deposit at point of closing, then also:
    - Trigger a LQTY reward event
    - pay out their LQTY gain
    - pay pout their deposit's ETH gain
    - pay out their front end's LQTY gain (to their front end)
    - Make the deposit ineligible for further LQTY gains.
    */
    function closeLoan(address _troveCloser, uint _debtRepayment, uint _collWithdrawal) external {
        _requireCallerIsBorrowerOperations();

        activePool.decreaseCLVDebt(_debtRepayment);
        CLV.burn(_troveCloser, _debtRepayment);

        if (isEligibleForLQTY(_troveCloser)) {
            _triggerLQTYIssuance(); 

            uint troveCloserETHGain = _getDepositorETHGain(_troveCloser);
            uint compoundedCLVDeposit = _getCompoundedCLVDeposit(_troveCloser);

            address frontEnd = deposits[_troveCloser].frontEndTag;
            _payOutLQTYGains(_troveCloser, frontEnd);

            uint compoundedFrontEndStake = _getCompoundedFrontEndStake(frontEnd);
            uint newFrontEndStake = compoundedFrontEndStake.sub(compoundedCLVDeposit);
            _updateFrontEndStake(frontEnd, newFrontEndStake);

            _updateDepositAndSnapshots(_troveCloser, compoundedCLVDeposit);
            _removeTagAndEligibility(_troveCloser);

            _sendCollAndETHGain(_troveCloser, _collWithdrawal, troveCloserETHGain);
        } else {
            activePool.sendETH(_troveCloser, _collWithdrawal);
        }
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

    // Transfer the CLV tokens from the user to the Stability Pool's address, and update its recorded CLV
    function _sendCLVtoStabilityPool(address _address, uint _amount) internal {
        CLV.sendToPool(_address, stabilityPoolAddress, _amount);
        stabilityPool.increaseCLV(_amount);
    }

    // --- Reward calculator functions for depositor and front end ---

    function getDepositorETHGain(address _depositor) external view returns (uint) {
        return _getDepositorETHGain(_depositor);
    }

    /* Return the ETH gain earned by the deposit. Given by the formula:  E = d0 * (S - S(0))/P(0)
    where S(0) and P(0) are the depositor's snapshots of the sum S and product P, respectively. */
    function _getDepositorETHGain(address _depositor) internal view returns (uint) {
        uint initialDeposit = deposits[_depositor].initialValue;

        if (initialDeposit == 0) { return 0; }

        Snapshots memory snapshots = depositSnapshots[_depositor];

        uint ETHGain = _getETHGainFromSnapshots(initialDeposit, snapshots);
        return ETHGain;
    }

    function _getETHGainFromSnapshots(uint initialDeposit, Snapshots memory snapshots) internal view returns (uint) {
         /* Grab the reward sum from the epoch at which the stake was made. The reward may span up to 
        one scale change.  
        If it does, the second portion of the reward is scaled by 1e18. 
        If the reward spans no scale change, the second portion will be 0. */
        uint firstPortion = epochToScaleToSum[snapshots.epoch][snapshots.scale].sub(snapshots.S);
        uint secondPortion = epochToScaleToSum[snapshots.epoch][snapshots.scale.add(1)].div(1e18);

        // console.log("firstPortion: %s", firstPortion);
        // console.log("secondPortion: %s", secondPortion);
        // console.log("initialDeposit: %s", initialDeposit);
        // console.log("snapshots.P: %s", snapshots.P);


        uint ETHGain = initialDeposit.mul(firstPortion.add(secondPortion)).div(snapshots.P).div(1e18);
        
        return ETHGain;
    }

    function getDepositorLQTYGain(address _depositor) external view returns (uint) {
        return _getDepositorLQTYGain(_depositor);
    }

    /* Return the LQTY gain earned by the deposit. Given by the formula:  E = d0 * (G - G(0))/P(0)
    where G(0) and P(0) are the depositor's snapshots of the sum G and product P, respectively. 
    
    d0 is the last recorded deposit value. */
    function _getDepositorLQTYGain(address _depositor) internal view returns (uint) {
       
        uint initialDeposit = deposits[_depositor].initialValue;
        if (initialDeposit == 0 || isEligibleForLQTY(_depositor) == false) { return 0; }

        address frontEndTag = deposits[_depositor].frontEndTag;

        // If not tagged with a front end, depositor gets a 100% cut
        uint kickbackRate = frontEndTag == address(0) ? 1e18 : frontEnds[frontEndTag].kickbackRate;

        Snapshots memory snapshots = depositSnapshots[_depositor];  
      
        uint LQTYGain = kickbackRate.mul(_getLQTYGainFromSnapshots(initialDeposit, snapshots)).div(1e18);
        return LQTYGain;
    }

    function getFrontEndLQTYGain(address _frontEnd) external view returns (uint) {
        return _getFrontEndLQTYGain(_frontEnd);
    }

    /* Return the LQTY gain earned by the front end. Given by the formula:  E = D0 * (G - G(0))/P(0)
    where G(0) and P(0) are the depositor's snapshots of the sum G and product P, respectively.

    D0 is the last recorded value of the front end's total tagged deposits. */
    function _getFrontEndLQTYGain(address _frontEnd) internal view returns (uint) {
        uint frontEndStake = frontEndStakes[_frontEnd];
        if (frontEndStake == 0) { return 0; }

        uint kickbackRate = frontEnds[_frontEnd].kickbackRate;
        uint frontEndShare = uint(1e18).sub(kickbackRate);

        Snapshots memory snapshots = frontEndSnapshots[_frontEnd];  
    
        uint LQTYGain = frontEndShare.mul(_getLQTYGainFromSnapshots(frontEndStake, snapshots)).div(1e18);
        return LQTYGain;
    }

    function _getLQTYGainFromSnapshots(uint initialStake, Snapshots memory snapshots) internal view returns (uint) {
        /* Grab the reward sum from the epoch at which the stake was made. The reward may span up to 
        one scale change.  
        If it does, the second portion of the reward is scaled by 1e18. 
        If the reward spans no scale change, the second portion will be 0. */
        uint firstPortion = epochToScaleToG[snapshots.epoch][snapshots.scale].sub(snapshots.G);
        uint secondPortion = epochToScaleToG[snapshots.epoch][snapshots.scale.add(1)].div(1e18);

        // console.log("firstPortion: %s", firstPortion);
        // console.log("secondPortion: %s", secondPortion);
        // console.log("initialStake: %s", initialStake);
        // console.log("snapshots.G: %s", snapshots.G);

        uint LQTYGain = initialStake.mul(firstPortion.add(secondPortion)).div(snapshots.P).div(1e18);
        
        // console.log("LQTYGain: %s", LQTYGain);
        // console.log("snapshots.G: %s", snapshots.G);
        // console.log("snapshots.P: %s", snapshots.P);
        return LQTYGain;
    }

    // --- Compounded deposit and compounded front end stake ---

    function getCompoundedCLVDeposit(address _depositor) external view returns (uint) {
        return _getCompoundedCLVDeposit(_depositor);
    }

    /* Return the user's compounded deposit.  Given by the formula:  d = d0 * P/P(0)
    where P(0) is the depositor's snapshot of the product P. */
    function _getCompoundedCLVDeposit(address _depositor) internal view returns (uint) {
        uint initialDeposit = deposits[_depositor].initialValue;
        if (initialDeposit == 0) { return 0; }

        Snapshots memory snapshots = depositSnapshots[_depositor]; 
       
        uint compoundedDeposit = _getCompoundedStakeFromSnapshots(initialDeposit, snapshots);
        return compoundedDeposit;
    }

    function getCompoundedFrontEndStake(address _frontEnd) external view returns (uint) {
        return _getCompoundedFrontEndStake(_frontEnd);
    }

    /* Return the user's compounded deposit.  Given by the formula:  d = d0 * P/P(0)
    where P(0) is the depositor's snapshot of the product P. */
    function _getCompoundedFrontEndStake(address _frontEnd) internal view returns (uint) {
        uint frontEndStake = frontEndStakes[_frontEnd];
        if (frontEndStake == 0) { return 0; }

        Snapshots memory snapshots = frontEndSnapshots[_frontEnd]; 
       
        uint compoundedFrontEndStake = _getCompoundedStakeFromSnapshots(frontEndStake, snapshots);
        return compoundedFrontEndStake;
    }

    function _getCompoundedStakeFromSnapshots
    (
        uint initialStake, 
        Snapshots memory snapshots
    ) 
    internal 
    view 
    returns (uint)
    {
        // If stake was made before a pool-emptying event, then it has been fully cancelled with debt -- so, return 0
        if (snapshots.epoch < currentEpoch) {return 0;}

        uint compoundedStake;
        uint128 scaleDiff = currentScale.sub(snapshots.scale);
    
        /* Compute the compounded stake. If a scale change in P was made during the stake's lifetime, 
        account for it. If more than one scale change was made, then the stake has decreased by a factor of 
        at least 1e-18 -- so return 0.*/
        if (scaleDiff == 0) { 
            compoundedStake = initialStake.mul(P).div(snapshots.P);
        } else if (scaleDiff == 1) {
            compoundedStake = initialStake.mul(P).div(snapshots.P).div(1e18);
        } else {
            compoundedStake = 0;
        }

        // If compounded stake is less than a billionth of the initial deposit, return 0
        if (compoundedStake < initialStake.div(1e9)) {return 0;}

        return compoundedStake;
    }

    // --- Sender functions for CLV deposits and ETH gains ---

    function _sendETHGainToDepositor(address _depositor, uint ETHGain) internal {
        if (ETHGain == 0) {return;}
        stabilityPool.sendETH(_depositor, ETHGain);
    }
    
    // Send ETHGain to depositor's CDP. Send in two steps: StabilityPool -> PoolManager -> depositor's CDP
    function _sendETHGainToCDP(address _depositor, uint _ETHGain, address _hint) internal {
        stabilityPool.sendETH(address(this), _ETHGain); 
        borrowerOperations.addColl.value(_ETHGain)(_depositor, _hint); 
    }

    /* When a borrower-depositor closes their loan, this function pays out their withrawn collateral and 
    their deposit's accumulated ETH gain. 
    It first collects the ETH, then sends it all in one operation.  */
    function _sendCollAndETHGain(address _troveCloser, uint _collWithdrawal, uint _ETHGain) internal {
        _requireCallerIsBorrowerOperations();

        // Collect all the ETH to send
        activePool.sendETH(address(this), _collWithdrawal);
        stabilityPool.sendETH(address(this), _ETHGain);

         // Send all ETH the trove closer in one move
        uint totalETHToSend = _collWithdrawal.add(_ETHGain);
        (bool success, ) = _troveCloser.call.value(totalETHToSend)("");
        _requireETHSentSuccessfully(success);
    }

    // Send CLV to user and decrease CLV in Pool
    function _sendCLVToDepositor(address _depositor, uint CLVWithdrawal) internal {
        uint CLVinPool = stabilityPool.getCLV();
        assert(CLVWithdrawal <= CLVinPool);

        CLV.returnFromPool(stabilityPoolAddress, _depositor, CLVWithdrawal); 
        stabilityPool.decreaseCLV(CLVWithdrawal);
    }

    // --- External Front End functions ---

    function registerFrontEnd(uint _kickbackRate) external {
        _requireFrontEndNotRegistered(msg.sender);
        _requireValidKickbackRate(_kickbackRate);

        frontEnds[msg.sender].kickbackRate = _kickbackRate;
        frontEnds[msg.sender].active = true;
    }

    // --- Stability Pool Deposit Functionality --- 

    function isEligibleForLQTY(address _depositor) public view returns (bool) {
        return deposits[_depositor].eligibleForLQTY;
    }

    function getFrontEndTag(address _depositor) public view returns (address) {
        return deposits[_depositor].frontEndTag;
    }
    
    function _setTagAndEligibility(address _depositor, address _frontEndTag) internal {
        deposits[_depositor].frontEndTag = _frontEndTag;
           
        // If depositor also has an active trove, make their deposit eligible for LQTY
        if (cdpManager.getCDPStatus(_depositor) == 1) {
            deposits[_depositor].eligibleForLQTY = true;
        } 
    }

    function _removeTagAndEligibility(address _depositor) internal {
        deposits[_depositor].frontEndTag = address(0);
        deposits[_depositor].eligibleForLQTY = false;
    }

    // Record a new deposit
    function _updateDepositAndSnapshots(address _depositor, uint _newValue) internal {
        deposits[_depositor].initialValue = _newValue;

        if (_newValue == 0) {
            _removeTagAndEligibility(_depositor);
            emit DepositSnapshotUpdated(_depositor, depositSnapshots[_depositor].P, depositSnapshots[_depositor].S);
            return;
        }

        // Record new individual snapshots of the running product P and sum S for the depositor
        depositSnapshots[_depositor].P = P;
        depositSnapshots[_depositor].S = epochToScaleToSum[currentEpoch][currentScale];
        depositSnapshots[_depositor].G = epochToScaleToG[currentEpoch][currentScale];
        depositSnapshots[_depositor].scale = currentScale;
        depositSnapshots[_depositor].epoch = currentEpoch;

        emit DepositSnapshotUpdated(_depositor, depositSnapshots[_depositor].P, depositSnapshots[_depositor].S);
    }

    function _updateFrontEndStake(address _frontEnd, uint _newValue) internal {
        frontEndStakes[_frontEnd] = _newValue;

        if (_newValue == 0) {
            // TODO: emit event
            return;
        }

        // Record new individual snapshots of the running product P and sum G for the front end
        frontEndSnapshots[_frontEnd].P = P;
        frontEndSnapshots[_frontEnd].G = epochToScaleToG[currentEpoch][currentScale];
        frontEndSnapshots[_frontEnd].scale = currentScale;
        frontEndSnapshots[_frontEnd].epoch = currentEpoch;

        //TODO: emit event
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
        address depositor = _msgSender();
        uint initialDeposit = deposits[depositor].initialValue;

        _triggerLQTYIssuance(); 

        if (initialDeposit == 0) {_setTagAndEligibility(depositor, _frontEndTag);}  

        uint depositorETHGain = _getDepositorETHGain(depositor);
        uint compoundedCLVDeposit = _getCompoundedCLVDeposit(depositor);
        uint CLVLoss = initialDeposit.sub(compoundedCLVDeposit); // Needed only for event log

        if (isEligibleForLQTY(depositor)) {
            // First pay out any LQTY gains 
            address frontEnd = deposits[depositor].frontEndTag;
            _payOutLQTYGains(depositor, frontEnd);
        
            // Update front end stake
            uint compoundedFrontEndStake = _getCompoundedFrontEndStake(frontEnd);
            uint newFrontEndStake = compoundedFrontEndStake.add(_amount);
            _updateFrontEndStake(frontEnd, newFrontEndStake);
        }
        
        _sendCLVtoStabilityPool(depositor, _amount);

        uint newDeposit = compoundedCLVDeposit.add(_amount);
        _updateDepositAndSnapshots(depositor, newDeposit);

        _sendETHGainToDepositor(depositor, depositorETHGain);

        emit ETHGainWithdrawn(depositor, depositorETHGain, CLVLoss); // CLV Loss required for event log
        emit DepositChanged(depositor, newDeposit); 
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
        
        uint depositorETHGain = _getDepositorETHGain(depositor);
        
        uint compoundedCLVDeposit = _getCompoundedCLVDeposit(depositor);
        uint CLVtoWithdraw = Math._min(_amount, compoundedCLVDeposit);
        uint CLVLoss = initialDeposit.sub(compoundedCLVDeposit); // Needed only for event log
      
        if (isEligibleForLQTY(depositor)) {
            // First pay out any LQTY gains 
            address frontEnd = deposits[depositor].frontEndTag;
            _payOutLQTYGains(depositor, frontEnd);
        
            // Update front end stake
            uint compoundedFrontEndStake = _getCompoundedFrontEndStake(frontEnd);
            uint newFrontEndStake = compoundedFrontEndStake.sub(CLVtoWithdraw);
            _updateFrontEndStake(frontEnd, newFrontEndStake);
        }

        _sendCLVToDepositor(depositor, CLVtoWithdraw);

        // Update deposit
        uint newDeposit = compoundedCLVDeposit.sub(CLVtoWithdraw);
        _updateDepositAndSnapshots(depositor, newDeposit);  
       
        _sendETHGainToDepositor(depositor, depositorETHGain);

        emit ETHGainWithdrawn(depositor, depositorETHGain, CLVLoss);  // CLV Loss required for event log
        emit UserDepositChanged(depositor, newDeposit); 
    }

    function _payOutLQTYGains(address _depositor, address _frontEnd) internal {
        // Pay out front end's LQTY gain
        if (_frontEnd != address(0)) {
            uint frontEndLQTYGain = _getFrontEndLQTYGain(_frontEnd);
            // console.log("frontEndLQTYGain: %s", frontEndLQTYGain);
            communityIssuance.sendLQTY(_frontEnd, frontEndLQTYGain);
        }
        
        // Pay out depositor's LQTY gain
        uint depositorLQTYGain = _getDepositorLQTYGain(_depositor);
        // console.log("depositorLQTYGain %s", depositorLQTYGain);
        communityIssuance.sendLQTY(_depositor, depositorLQTYGain);
    }

    /* withdrawETHGainToTrove:
    - Issues LQTY gain to depositor and front end
    - Transfers the depositor's entire ETH gain from the Stability Pool to the caller's CDP
    - Leaves their compounded deposit in the Stability Pool
    - Updates snapshots for deposit and front end stake
    
    TODO: Remove _user depositor and just use _msgSender(). */
    function withdrawETHGainToTrove(address _depositor, address _hint) external {
        require(_depositor == _msgSender(), "PoolManager: A user may only withdraw ETH gains to their own trove" );
        _requireUserHasDeposit(_depositor); 
        _requireUserHasTrove(_depositor);

        uint initialDeposit = deposits[_depositor].initialValue;

        _triggerLQTYIssuance();  
        
        uint depositorETHGain = _getDepositorETHGain(_depositor);
        
        uint compoundedCLVDeposit = _getCompoundedCLVDeposit(_depositor);
        uint CLVLoss = initialDeposit.sub(compoundedCLVDeposit); // Needed only for event log
      
        if (isEligibleForLQTY(_depositor)) {
            // First pay out any LQTY gains 
            address frontEnd = deposits[_depositor].frontEndTag;
            _payOutLQTYGains(_depositor, frontEnd);
        
            // Update front end stake
            uint compoundedFrontEndStake = _getCompoundedFrontEndStake(frontEnd);
            uint newFrontEndStake = compoundedFrontEndStake;
            _updateFrontEndStake(frontEnd, newFrontEndStake);
        }

        _updateDepositAndSnapshots(_depositor, compoundedCLVDeposit); 

        /* Emit events before transferring ETH gain to CDP.
         This lets the event log make more sense (i.e. so it appears that first the ETH gain is withdrawn 
        and then it is deposited into the CDP, not the other way around). */
        emit ETHGainWithdrawn(_depositor, depositorETHGain, CLVLoss);
        emit UserDepositChanged(_depositor, compoundedCLVDeposit); 

        _sendETHGainToCDP(_depositor, depositorETHGain, _hint);
    }

    // --- LQTY issuance functions ---

    function _triggerLQTYIssuance() internal {
        uint totalCLVDeposits = stabilityPool.getCLV();
        if (totalCLVDeposits == 0) {return;} // Do nothing if the Pool is empty

        uint LQTYIssuance = communityIssuance.issueLQTY();
        _updateG(LQTYIssuance, totalCLVDeposits);
    }

    // TODO: handle total deposits == 0?
    function _updateG(uint _LQTYIssuance, uint totalCLVDeposits) internal {
        uint LQTYPerUnitStaked;
        LQTYPerUnitStaked =_computeLQTYPerUnitStaked(_LQTYIssuance, totalCLVDeposits);

        uint marginalLQTYGain = LQTYPerUnitStaked.mul(P);
        epochToScaleToG[currentEpoch][currentScale] = epochToScaleToG[currentEpoch][currentScale].add(marginalLQTYGain);
    }

    // TODO: Error correction here?
    function _computeLQTYPerUnitStaked (uint LQTYIssuance, uint totalCLVDeposits) internal view returns (uint) {
        return LQTYIssuance.mul(1e18).div(totalCLVDeposits);
    }

    // --- Liquidation functions ---

     /* Cancel out the specified _debt against the CLV contained in the Stability Pool (as far as possible)  
    and transfers the CDP's ETH collateral from ActivePool to StabilityPool. 
    Only called from liquidation functions in CDPManager. */
    function offset(uint _debtToOffset, uint _collToAdd) external payable {    
        _requireCallerIsCDPManager();
        uint totalCLVDeposits = stabilityPool.getCLV(); 
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
         // Make product factor 0 if there was a pool-emptying. Otherwise, it is (1 - CLVLossPerUnitStaked)
        uint newProductFactor = _CLVLossPerUnitStaked >= 1e18 ? 0 : uint(1e18).sub(_CLVLossPerUnitStaked);
     
        // Update the ETH reward sum at the current scale and current epoch
        uint marginalETHGain = _ETHGainPerUnitStaked.mul(P);
        epochToScaleToSum[currentEpoch][currentScale] = epochToScaleToSum[currentEpoch][currentScale].add(marginalETHGain);
        emit S_Updated(epochToScaleToSum[currentEpoch][currentScale]); 

       // If the Pool was emptied, increment the epoch and reset the scale and product P
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

    function _onlyStabilityPoolorActivePool() internal view {
        require(
            _msgSender() == stabilityPoolAddress ||  _msgSender() ==  activePoolAddress, 
            "PoolManager: Caller is neither StabilityPool nor ActivePool");
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

    function _requireUserHasTrove(address _user) internal view {
        require(cdpManager.getCDPStatus(_user) == 1, "CDPManager: caller must have an active trove to withdraw ETHGain to");
    }

    function _requireFrontEndNotRegistered(address _address) internal view {
        require(frontEnds[_address].active == false, "PoolManager: must not already be a registered front end");
    }

     function _requireFrontEndIsRegisteredOrZero(address _address) internal view {
        require(frontEnds[_address].active == true || _address == address(0), 
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
        _onlyStabilityPoolorActivePool();
    }
}    