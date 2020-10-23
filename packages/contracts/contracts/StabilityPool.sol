// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import './Interfaces/IBorrowerOperations.sol';
import './Interfaces/IStabilityPool.sol';
import './Interfaces/IPool.sol';
import './Interfaces/IBorrowerOperations.sol';
import './Interfaces/ICDPManager.sol';
import './Interfaces/ICLVToken.sol';
import "./Dependencies/Math.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/SafeMath128.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract StabilityPool is Ownable, IStabilityPool {
    using SafeMath for uint256;
    using SafeMath128 for uint128;

    IBorrowerOperations public borrowerOperations;

    ICDPManager public cdpManager;

    ICLVToken public CLV;

    IPool public activePool;
    address public activePoolAddress;

    uint256 internal ETH;  // deposited ether tracker

    // Total CLV held in the pool. Changes when users deposit/withdraw, and when CDP debt is offset.
    uint256 internal totalCLVDeposits;

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

    // --- Contract setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _cdpManagerAddress,
        address _activePoolAddress,
        address _clvTokenAddress
    )
        external
        override
        onlyOwner
    {
        borrowerOperations = IBorrowerOperations(_borrowerOperationsAddress);
        cdpManager = ICDPManager(_cdpManagerAddress);
        activePool = IPool(_activePoolAddress);
        activePoolAddress = _activePoolAddress;
        CLV = ICLVToken(_clvTokenAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit CDPManagerAddressChanged(_cdpManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit CLVTokenAddressChanged(_clvTokenAddress);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    function getETH() external view override returns (uint) {
        return ETH;
    }

    function getTotalCLVDeposits() external view override returns (uint) {
        return totalCLVDeposits;
    }

    // --- Pool functionality ---

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

            _sendETH(user, ETHGain);

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

        _sendETH(user, ETHGain);

        emit ETHGainWithdrawn(user, ETHGain, CLVLoss);
        emit UserDepositChanged(user, CLVremainder);
    }

    /* withdrawETHGainToTrove:
    - Issues LQTY gain to depositor and front end
    - Transfers the depositor's entire ETH gain from the Stability Pool to the caller's CDP
    - Leaves their compounded deposit in the Stability Pool
    - Updates snapshots for deposit and front end stake
    */
    function withdrawETHGainToTrove(address _hint) external override {
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

        // sendETHGainToTrove
        ETH = ETH.sub(_ETHGain);
        emit ETHBalanceUpdated(ETH);
        emit EtherSent(_depositor, _ETHGain);

        borrowerOperations.addColl{ value: _ETHGain }(_depositor, _hint);
    }

    // Transfer the CLV tokens from the user to the Stability Pool's address, and update its recorded CLV
    function _sendCLVtoStabilityPool(address _address, uint _amount) internal {
        CLV.sendToPool(_address, address(this), _amount);
        uint newTotalCLVDeposits = totalCLVDeposits.add(_amount);
        totalCLVDeposits = newTotalCLVDeposits;
        emit CLVBalanceUpdated(newTotalCLVDeposits);
    }

    // Send CLV to user and decrease CLV in Pool
    function _sendCLVToUser(address _address, uint CLVWithdrawal) internal {
        assert(CLVWithdrawal <= totalCLVDeposits);

        CLV.returnFromPool(address(this), _address, CLVWithdrawal);
        _decreaseCLV(CLVWithdrawal);
    }

    // --- Stability Pool Deposit Functionality ---

    // Record a new deposit
    function _updateDeposit(address _address, uint _amount) internal {
        if (_amount == 0) {
            initialDeposits[_address] = 0;
            emit UserSnapshotUpdated(snapshot[_address].P, snapshot[_address].S);
            return;
        }

        initialDeposits[_address] = _amount;

        // Record new individual snapshots of the running product P and sum S for the user
        snapshot[_address].P = P;
        snapshot[_address].S = epochToScaleToSum[currentEpoch][currentScale];
        snapshot[_address].scale = currentScale;
        snapshot[_address].epoch = currentEpoch;

        emit UserSnapshotUpdated(snapshot[_address].P, snapshot[_address].S);
    }

    // --- LQTY issuance functions ---

    function _triggerLQTYIssuance() internal {
        uint LQTYIssuance = communityIssuance.issueLQTY();
       _updateG(LQTYIssuance);
    }

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
    function offset(uint _debtToOffset, uint _collToAdd) external payable override {
        _requireCallerIsCDPManager();
        uint totalCLV = totalCLVDeposits; // cached to save an SLOAD
        if (totalCLV == 0 || _debtToOffset == 0) { return; }

        (uint ETHGainPerUnitStaked,
         uint CLVLossPerUnitStaked) = _computeRewardsPerUnitStaked(_collToAdd, _debtToOffset, totalCLV);

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
        _decreaseCLV(_debtToOffset);

        // Send ETH from Active Pool to Stability Pool
        activePool.sendETH(address(this), _collToAdd);

        // Burn the debt that was successfully offset
        CLV.burn(address(this), _debtToOffset);
    }

    // --- 'require' wrapper functions ---

    function _requireUserHasDeposit(address _address) internal view {
        uint initialDeposit = initialDeposits[_address];
        require(initialDeposit > 0, 'PoolManager: User must have a non-zero deposit');
    }

    function _requireUserHasTrove(address _user) internal view {
        require(cdpManager.getCDPStatus(_user) == 1, "CDPManager: caller must have an active trove to withdraw ETHGain to");
    }

    function _sendETH(address _account, uint _amount) internal {
        uint newETH = ETH.sub(_amount);
        ETH = newETH;
        emit ETHBalanceUpdated(newETH);
        emit EtherSent(_account, _amount);

        (bool success, ) = _account.call{ value: _amount }("");
        require(success, "StabilityPool: sending ETH failed");
    }

    function _decreaseCLV(uint _amount) internal {
        uint newTotalCLVDeposits = totalCLVDeposits.sub(_amount);
        totalCLVDeposits = newTotalCLVDeposits;
        emit CLVBalanceUpdated(newTotalCLVDeposits);
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

    // --- 'require' functions ---
    function _requireCallerIsActivePool() internal view {
        require( _msgSender() == activePoolAddress, "StabilityPool: Caller is not ActivePool");
    }

    function _requireCallerIsCDPManager internal view {
        require(_msgSender() == address(cdpManager), "StabilityPool: Caller is not CDPManager");
    }

    function getCompoundedCLVDeposit(address _user) external view returns (uint) {
        return _getCompoundedCLVDeposit(_user);
    }

    /* Return the user's compounded deposit.  Given by the formula:  d = d0 * P/P(0)
    where P(0) is the depositor's snapshot of the product P. */
    function _getCompoundedCLVDeposit(address _user) internal view returns (uint) {
        uint initialDeposit = initialDeposits[_user];

        if (initialDeposit == 0) { return 0; }

        uint snapshot_P = snapshot[_user].P;
        uint128 scaleSnapshot = snapshot[_user].scale;
        uint128 epochSnapshot = snapshot[_user].epoch;

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
        if (compoundedDeposit < initialDeposit.div(1e9)) { return 0; }

        return compoundedDeposit;
    }

    // --- Fallback function ---

    receive() external payable {
        _requireCallerIsActivePool();
        ETH = ETH.add(msg.value);
    }
}
