// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import './Interfaces/IBorrowerOperations.sol';
import './Interfaces/IStabilityPool.sol';
import './Interfaces/IPool.sol';
import './Interfaces/IBorrowerOperations.sol';
import './Interfaces/ICDPManager.sol';
import './Interfaces/ICLVToken.sol';
import './Interfaces/ISortedCDPs.sol';
import './Interfaces/IPriceFeed.sol';
import "./Interfaces/ICommunityIssuance.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Math.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/SafeMath128.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";


contract StabilityPool is LiquityBase, Ownable, IStabilityPool {
    using SafeMath for uint256;
    using SafeMath128 for uint128;

    IBorrowerOperations public borrowerOperations;

    ICDPManager public cdpManager;

    ICLVToken public clvToken;

    IPool public activePool;
    address public activePoolAddress;

    // Needed to check if there are pending liquidations
    ISortedCDPs public sortedCDPs;
    IPriceFeed public priceFeed;

    ICommunityIssuance public communityIssuance;
    address public communityIssuanceAddress;

    uint256 internal ETH;  // deposited ether tracker

    // Total CLV held in the pool. Changes when users deposit/withdraw, and when CDP debt is offset.
    uint256 internal totalCLVDeposits;

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

       LQTY reward events occur are triggered by depositor operations (new deposit, topup, withdrawal) and liquidations.
       In each case, the LQTY reward is issued (G is updated), before other state changes are made. */
    mapping (uint => mapping(uint => uint)) public epochToScaleToG;

    // Error tracker for the error correction in the LQTY issuance calculation
    uint public lastLQTYError;
    // Error trackers for the error correction in the offset calculation
    uint public lastETHError_Offset;
    uint public lastCLVLossError_Offset;

    // --- Contract setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _cdpManagerAddress,
        address _activePoolAddress,
        address _clvTokenAddress,
        address _sortedCDPsAddress,
        address _priceFeedAddress,
        address _communityIssuanceAddress
    )
        external
        override
        onlyOwner
    {
        borrowerOperations = IBorrowerOperations(_borrowerOperationsAddress);
        cdpManager = ICDPManager(_cdpManagerAddress);
        activePool = IPool(_activePoolAddress);
        activePoolAddress = _activePoolAddress;
        clvToken = ICLVToken(_clvTokenAddress);
        sortedCDPs = ISortedCDPs(_sortedCDPsAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
        communityIssuanceAddress = _communityIssuanceAddress;
        communityIssuance = ICommunityIssuance(_communityIssuanceAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit CDPManagerAddressChanged(_cdpManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit CLVTokenAddressChanged(_clvTokenAddress);
        emit SortedCDPsAddressChanged(_sortedCDPsAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit CommunityIssuanceAddressChanged(_communityIssuanceAddress);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    function getETH() external view override returns (uint) {
        return ETH;
    }

    function getTotalCLVDeposits() external view override returns (uint) {
        return totalCLVDeposits;
    }

    // --- External Depositor Functions ---

    /* provideToSP():

    - Triggers a LQTY reward, shared between all depositors and front ends
    - Tags deposit with the front end tag param, if it's a new deposit
    - Sends all accumulated gains (LQTY, ETH) to depositor and front end
    - Increases deposit and front end stake, and takes new snapshots for each.
    */
    function provideToSP(uint _amount, address _frontEndTag) external override {
        _requireFrontEndIsRegisteredOrZero(_frontEndTag);
        _requireFrontEndNotRegistered(msg.sender);
        _requireNonZeroAmount(_amount);

        uint initialDeposit = deposits[msg.sender].initialValue;

        _triggerLQTYIssuance();

        if (initialDeposit == 0) {_setFrontEndTag(msg.sender, _frontEndTag);}
        uint depositorETHGain = getDepositorETHGain(msg.sender);
        uint compoundedCLVDeposit = getCompoundedCLVDeposit(msg.sender);
        uint CLVLoss = initialDeposit.sub(compoundedCLVDeposit); // Needed only for event log

        // First pay out any LQTY gains
        address frontEnd = deposits[msg.sender].frontEndTag;
        _payOutLQTYGains(msg.sender, frontEnd);

        // Update front end stake
        uint compoundedFrontEndStake = getCompoundedFrontEndStake(frontEnd);
        uint newFrontEndStake = compoundedFrontEndStake.add(_amount);
        _updateFrontEndStakeAndSnapshots(frontEnd, newFrontEndStake);
        emit FrontEndStakeChanged(frontEnd, newFrontEndStake, msg.sender);

        _sendCLVtoStabilityPool(msg.sender, _amount);

        uint newDeposit = compoundedCLVDeposit.add(_amount);
        _updateDepositAndSnapshots(msg.sender, newDeposit);
        emit UserDepositChanged(msg.sender, newDeposit);

        _sendETHGainToDepositor(msg.sender, depositorETHGain);

        emit ETHGainWithdrawn(msg.sender, depositorETHGain, CLVLoss); // CLV Loss required for event log
    }

    /* withdrawFromSP():

    - Triggers a LQTY reward, shared between all depositors and front ends
    - Removes deposit's front end tag if it is a full withdrawal
    - Sends all accumulated gains (LQTY, ETH) to depositor and front end
    - Decreases deposit and front end stake, and takes new snapshots for each.

    If _amount > userDeposit, the user withdraws all of their compounded deposit. */
    function withdrawFromSP(uint _amount) external override {
        _requireNoPendingLiquidations();
        uint initialDeposit = deposits[msg.sender].initialValue;
        _requireUserHasDeposit(initialDeposit);

        _triggerLQTYIssuance();

        uint depositorETHGain = getDepositorETHGain(msg.sender);

        uint compoundedCLVDeposit = getCompoundedCLVDeposit(msg.sender);
        uint CLVtoWithdraw = Math._min(_amount, compoundedCLVDeposit);
        uint CLVLoss = initialDeposit.sub(compoundedCLVDeposit); // Needed only for event log

        // First pay out any LQTY gains
        address frontEnd = deposits[msg.sender].frontEndTag;
        _payOutLQTYGains(msg.sender, frontEnd);

        // Update front end stake
        uint compoundedFrontEndStake = getCompoundedFrontEndStake(frontEnd);
        uint newFrontEndStake = compoundedFrontEndStake.sub(CLVtoWithdraw);
        _updateFrontEndStakeAndSnapshots(frontEnd, newFrontEndStake);
        emit FrontEndStakeChanged(frontEnd, newFrontEndStake, msg.sender);

        _sendCLVToDepositor(msg.sender, CLVtoWithdraw);

        // Update deposit
        uint newDeposit = compoundedCLVDeposit.sub(CLVtoWithdraw);
        _updateDepositAndSnapshots(msg.sender, newDeposit);
        emit UserDepositChanged(msg.sender, newDeposit);

        _sendETHGainToDepositor(msg.sender, depositorETHGain);

        emit ETHGainWithdrawn(msg.sender, depositorETHGain, CLVLoss);  // CLV Loss required for event log
    }

    /* withdrawETHGainToTrove:
    - Issues LQTY gain to depositor and front end
    - Transfers the depositor's entire ETH gain from the Stability Pool to the caller's CDP
    - Leaves their compounded deposit in the Stability Pool
    - Updates snapshots for deposit and front end stake */
    function withdrawETHGainToTrove(address _hint) external override {
        _requireNoPendingLiquidations();
        uint initialDeposit = deposits[msg.sender].initialValue;
        _requireUserHasDeposit(initialDeposit);
        _requireUserHasTrove(msg.sender);
        _requireUserHasETHGain(msg.sender);

        _triggerLQTYIssuance();

        uint depositorETHGain = getDepositorETHGain(msg.sender);

        uint compoundedCLVDeposit = getCompoundedCLVDeposit(msg.sender);
        uint CLVLoss = initialDeposit.sub(compoundedCLVDeposit); // Needed only for event log

        // First pay out any LQTY gains
        address frontEnd = deposits[msg.sender].frontEndTag;
        _payOutLQTYGains(msg.sender, frontEnd);

        // Update front end stake
        uint compoundedFrontEndStake = getCompoundedFrontEndStake(frontEnd);
        uint newFrontEndStake = compoundedFrontEndStake;
        _updateFrontEndStakeAndSnapshots(frontEnd, newFrontEndStake);
        emit FrontEndStakeChanged(frontEnd, newFrontEndStake, msg.sender);

        _updateDepositAndSnapshots(msg.sender, compoundedCLVDeposit);

        /* Emit events before transferring ETH gain to CDP.
         This lets the event log make more sense (i.e. so it appears that first the ETH gain is withdrawn
        and then it is deposited into the CDP, not the other way around). */
        emit ETHGainWithdrawn(msg.sender, depositorETHGain, CLVLoss);
        emit UserDepositChanged(msg.sender, compoundedCLVDeposit);

        // sendETHGainToTrove
        ETH = ETH.sub(depositorETHGain);
        emit ETHBalanceUpdated(ETH);
        emit EtherSent(msg.sender, depositorETHGain);

        borrowerOperations.moveETHGainToTrove{ value: depositorETHGain }(msg.sender, _hint);
    }

    // --- LQTY issuance functions ---

    function _triggerLQTYIssuance() internal {
        uint LQTYIssuance = communityIssuance.issueLQTY();
       _updateG(LQTYIssuance);
    }

    function _updateG(uint _LQTYIssuance) internal {
        uint totalCLV = totalCLVDeposits; // cached to save an SLOAD

        /* When total deposits is 0, G is not updated. In this case, the LQTY issued can not be obtained by later 
        depositors - it is missed out on, and remains in the balanceof the CommunityIssuance contract. */
        if (totalCLV == 0) {return;}

        uint LQTYPerUnitStaked;
        LQTYPerUnitStaked =_computeLQTYPerUnitStaked(_LQTYIssuance, totalCLV);

        uint marginalLQTYGain = LQTYPerUnitStaked.mul(P);
        epochToScaleToG[currentEpoch][currentScale] = epochToScaleToG[currentEpoch][currentScale].add(marginalLQTYGain);
    }

    function _computeLQTYPerUnitStaked(uint _LQTYIssuance, uint _totalCLVDeposits) internal returns (uint) {
        uint LQTYNumerator = _LQTYIssuance.mul(1e18).add(lastLQTYError);

        uint LQTYPerUnitStaked = LQTYNumerator.div(_totalCLVDeposits);
        lastLQTYError = LQTYNumerator.sub(LQTYPerUnitStaked.mul(_totalCLVDeposits));

        return LQTYPerUnitStaked;
    }

    // --- Liquidation functions ---

    /* Cancel out the specified _debt against the CLV contained in the Stability Pool (as far as possible)
    and transfers the CDP's ETH collateral from ActivePool to StabilityPool.
    Only called from liquidation functions in CDPManager. */
    function offset(uint _debtToOffset, uint _collToAdd) external payable override {
        _requireCallerIsCDPManager();
        uint totalCLV = totalCLVDeposits; // cached to save an SLOAD
        if (totalCLV == 0 || _debtToOffset == 0) { return; }

        _triggerLQTYIssuance();

        (uint ETHGainPerUnitStaked,
            uint CLVLossPerUnitStaked) = _computeRewardsPerUnitStaked(_collToAdd, _debtToOffset, totalCLV);

        _updateRewardSumAndProduct(ETHGainPerUnitStaked, CLVLossPerUnitStaked);

        _moveOffsetCollAndDebt(_collToAdd, _debtToOffset);
    }

    // --- Offset helper functions ---

    function _computeRewardsPerUnitStaked(
        uint _collToAdd,
        uint _debtToOffset,
        uint _totalCLVDeposits
    )
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
            /* Add 1 to make error in quotient positive. We want "slightly too much" CLV loss,
            which ensures the error in any given compoundedCLVDeposit favors the Stability Pool. */
            CLVLossPerUnitStaked = (CLVLossNumerator.div(_totalCLVDeposits)).add(1); 
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
        _decreaseCLV(_debtToOffset);

        // Send ETH from Active Pool to Stability Pool
        activePool.sendETH(address(this), _collToAdd);

        // Burn the debt that was successfully offset
        clvToken.burn(address(this), _debtToOffset);
    }

    function _decreaseCLV(uint _amount) internal {
        uint newTotalCLVDeposits = totalCLVDeposits.sub(_amount);
        totalCLVDeposits = newTotalCLVDeposits;
        emit CLVBalanceUpdated(newTotalCLVDeposits);
    }

    // --- Reward calculator functions for depositor and front end ---

    /* Return the ETH gain earned by the deposit. Given by the formula:  E = d0 * (S - S(0))/P(0)
       where S(0) and P(0) are the depositor's snapshots of the sum S and product P, respectively. */
    function getDepositorETHGain(address _depositor) public view override returns (uint) {
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
    function getDepositorLQTYGain(address _depositor) public view override returns (uint) {

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
    function getFrontEndLQTYGain(address _frontEnd) public view override returns (uint) {
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
    function getCompoundedCLVDeposit(address _depositor) public view override returns (uint) {
        uint initialDeposit = deposits[_depositor].initialValue;
        if (initialDeposit == 0) { return 0; }

        Snapshots memory snapshots = depositSnapshots[_depositor];

        uint compoundedDeposit = _getCompoundedStakeFromSnapshots(initialDeposit, snapshots);
        return compoundedDeposit;
    }

    /* Return the user's compounded deposit.  Given by the formula:  d = d0 * P/P(0)
    where P(0) is the depositor's snapshot of the product P. */
    function getCompoundedFrontEndStake(address _frontEnd) public view override returns (uint) {
        uint frontEndStake = frontEndStakes[_frontEnd];
        if (frontEndStake == 0) { return 0; }

        Snapshots memory snapshots = frontEndSnapshots[_frontEnd];

        uint compoundedFrontEndStake = _getCompoundedStakeFromSnapshots(frontEndStake, snapshots);
        return compoundedFrontEndStake;
    }

    function _getCompoundedStakeFromSnapshots(
        uint initialStake,
        Snapshots memory snapshots
    )
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

    // Transfer the CLV tokens from the user to the Stability Pool's address, and update its recorded CLV
    function _sendCLVtoStabilityPool(address _address, uint _amount) internal {
        clvToken.sendToPool(_address, address(this), _amount);
        uint newTotalCLVDeposits = totalCLVDeposits.add(_amount);
        totalCLVDeposits = newTotalCLVDeposits;
        emit CLVBalanceUpdated(newTotalCLVDeposits);
    }

    function _sendETHGainToDepositor(address _account, uint _amount) internal {
        if (_amount == 0) {return;}
        uint newETH = ETH.sub(_amount);
        ETH = newETH;
        emit ETHBalanceUpdated(newETH);
        emit EtherSent(_account, _amount);

        (bool success, ) = _account.call{ value: _amount }("");
        require(success, "StabilityPool: sending ETH failed");
    }

    // Send CLV to user and decrease CLV in Pool
    function _sendCLVToDepositor(address _depositor, uint CLVWithdrawal) internal {
        clvToken.returnFromPool(address(this), _depositor, CLVWithdrawal);
        _decreaseCLV(CLVWithdrawal);
    }

    // --- External Front End functions ---

    function registerFrontEnd(uint _kickbackRate) external override {
        _requireFrontEndNotRegistered(msg.sender);
        _requireUserHasNoDeposit(msg.sender);
        _requireValidKickbackRate(_kickbackRate);

        frontEnds[msg.sender].kickbackRate = _kickbackRate;
        frontEnds[msg.sender].registered = true;

        emit FrontEndRegistered(msg.sender, _kickbackRate);
    }

    // --- Stability Pool Deposit Functionality ---

    function getFrontEndTag(address _depositor) public view override returns (address) {
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

    // --- 'require' functions ---

    function _requireCallerIsActivePool() internal view {
        require( msg.sender == activePoolAddress, "StabilityPool: Caller is not ActivePool");
    }

    function _requireCallerIsCDPManager() internal view {
        require(msg.sender == address(cdpManager), "StabilityPool: Caller is not CDPManager");
    }

    function _requireNoPendingLiquidations() internal view {
        uint price = priceFeed.getPrice();
        address lowestTrove = sortedCDPs.getLast();
        uint ICR = cdpManager.getCurrentICR(lowestTrove, price);
        require(ICR >= MCR, "StabilityPool: Cannot withdraw while pending liquidations");
    }

    function _requireUserHasDeposit(uint _initialDeposit) internal pure {
        require(_initialDeposit > 0, 'StabilityPool: User must have a non-zero deposit');
    }

     function _requireUserHasNoDeposit(address _address) internal view {
        uint initialDeposit = deposits[_address].initialValue;
        require(initialDeposit == 0, 'StabilityPool: User must have no deposit');
    }

    function _requireNonZeroAmount(uint _amount) internal pure {
        require(_amount > 0, 'StabilityPool: Amount must be non-zero');
    }

    function _requireUserHasTrove(address _user) internal view {
        require(cdpManager.getCDPStatus(_user) == 1, "StabilityPool: caller must have an active trove to withdraw ETHGain to");
    }

    function _requireUserHasETHGain(address _user) internal view {
        uint ETHGain = getDepositorETHGain(_user);
        require(ETHGain > 0, "StabilityPool: caller must have non-zero ETH Gain");
    }

    function _requireFrontEndNotRegistered(address _address) internal view {
        require(frontEnds[_address].registered == false, "StabilityPool: must not already be a registered front end");
    }

     function _requireFrontEndIsRegisteredOrZero(address _address) internal view {
        require(frontEnds[_address].registered || _address == address(0),
            "StabilityPool: Tag must be a registered front end, or the zero address");
    }

    function  _requireValidKickbackRate(uint _kickbackRate) internal pure {
        require (_kickbackRate >= 0 && _kickbackRate <= 1e18, "StabilityPool: Kickback rate must be in range [0,1]");
    }

    function _requireETHSentSuccessfully(bool _success) internal pure {
        require(_success, "StabilityPool: Failed to send ETH to msg.sender");
    }

    // --- Fallback function ---

    receive() external payable {
        _requireCallerIsActivePool();
        ETH = ETH.add(msg.value);
    }
}
