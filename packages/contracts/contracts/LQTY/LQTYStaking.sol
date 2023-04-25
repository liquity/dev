// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/BaseMath.sol";
import "../Dependencies/SafeMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/CheckContract.sol";
import "../Dependencies/console.sol";
import "../Interfaces/ILQTYToken.sol";
import "../Interfaces/ILQTYStaking.sol";
import "../Dependencies/LiquityMath.sol";
import "../Interfaces/I1USDToken.sol";

contract LQTYStaking is ILQTYStaking, Ownable, CheckContract, BaseMath {
    using SafeMath for uint;

    // --- Data ---
    string constant public NAME = "LQTYStaking";

    mapping( address => uint) public stakes;
    uint public totalLQTYStaked;

    uint public F_ONE;  // Running sum of ONE fees per-LQTY-staked
    uint public F_1USD; // Running sum of LQTY fees per-LQTY-staked

    // User snapshots of F_ONE and F_1USD, taken at the point at which their latest deposit was made
    mapping (address => Snapshot) public snapshots; 

    struct Snapshot {
        uint F_ONE_Snapshot;
        uint F_1USD_Snapshot;
    }
    
    ILQTYToken public lqtyToken;
    I1USDToken public oneusdToken;

    address public troveManagerAddress;
    address public borrowerOperationsAddress;
    address public activePoolAddress;

    // --- Events ---

    event LQTYTokenAddressSet(address _lqtyTokenAddress);
    event ONEUSDTokenAddressSet(address _1usdTokenAddress);
    event TroveManagerAddressSet(address _troveManager);
    event BorrowerOperationsAddressSet(address _borrowerOperationsAddress);
    event ActivePoolAddressSet(address _activePoolAddress);

    event StakeChanged(address indexed staker, uint newStake);
    event StakingGainsWithdrawn(address indexed staker, uint ONEUSDGain, uint ONEGain);
    event F_ONEUpdated(uint _F_ONE);
    event F_1USDUpdated(uint _F_1USD);
    event TotalLQTYStakedUpdated(uint _totalLQTYStaked);
    event OneSent(address _account, uint _amount);
    event StakerSnapshotsUpdated(address _staker, uint _F_ONE, uint _F_1USD);

    // --- Functions ---

    function setAddresses
    (
        address _lqtyTokenAddress,
        address _1usdTokenAddress,
        address _troveManagerAddress, 
        address _borrowerOperationsAddress,
        address _activePoolAddress
    ) 
        external 
        onlyOwner 
        override 
    {
        checkContract(_lqtyTokenAddress);
        checkContract(_1usdTokenAddress);
        checkContract(_troveManagerAddress);
        checkContract(_borrowerOperationsAddress);
        checkContract(_activePoolAddress);

        lqtyToken = ILQTYToken(_lqtyTokenAddress);
        oneusdToken = I1USDToken(_1usdTokenAddress);
        troveManagerAddress = _troveManagerAddress;
        borrowerOperationsAddress = _borrowerOperationsAddress;
        activePoolAddress = _activePoolAddress;

        emit LQTYTokenAddressSet(_lqtyTokenAddress);
        emit LQTYTokenAddressSet(_1usdTokenAddress);
        emit TroveManagerAddressSet(_troveManagerAddress);
        emit BorrowerOperationsAddressSet(_borrowerOperationsAddress);
        emit ActivePoolAddressSet(_activePoolAddress);

        _renounceOwnership();
    }

    // If caller has a pre-existing stake, send any accumulated ONE and 1USD gains to them. 
    function stake(uint _LQTYamount) external override {
        _requireNonZeroAmount(_LQTYamount);

        uint currentStake = stakes[msg.sender];

        uint ONEGain;
        uint ONEUSDGain;
        // Grab any accumulated ONE and 1USD gains from the current stake
        if (currentStake != 0) {
            ONEGain = _getPendingONEGain(msg.sender);
            ONEUSDGain = _getPending1USDGain(msg.sender);
        }
    
       _updateUserSnapshots(msg.sender);

        uint newStake = currentStake.add(_LQTYamount);

        // Increase user’s stake and total LQTY staked
        stakes[msg.sender] = newStake;
        totalLQTYStaked = totalLQTYStaked.add(_LQTYamount);
        emit TotalLQTYStakedUpdated(totalLQTYStaked);

        // Transfer LQTY from caller to this contract
        lqtyToken.sendToLQTYStaking(msg.sender, _LQTYamount);

        emit StakeChanged(msg.sender, newStake);
        emit StakingGainsWithdrawn(msg.sender, ONEUSDGain, ONEGain);

         // Send accumulated 1USD and ONE gains to the caller
        if (currentStake != 0) {
            oneusdToken.transfer(msg.sender, ONEUSDGain);
            _sendONEGainToUser(ONEGain);
        }
    }

    // Unstake the LQTY and send the it back to the caller, along with their accumulated 1USD & ONE gains. 
    // If requested amount > stake, send their entire stake.
    function unstake(uint _LQTYamount) external override {
        uint currentStake = stakes[msg.sender];
        _requireUserHasStake(currentStake);

        // Grab any accumulated ONE and 1USD gains from the current stake
        uint ONEGain = _getPendingONEGain(msg.sender);
        uint ONEUSDGain = _getPending1USDGain(msg.sender);
        
        _updateUserSnapshots(msg.sender);

        if (_LQTYamount > 0) {
            uint LQTYToWithdraw = LiquityMath._min(_LQTYamount, currentStake);

            uint newStake = currentStake.sub(LQTYToWithdraw);

            // Decrease user's stake and total LQTY staked
            stakes[msg.sender] = newStake;
            totalLQTYStaked = totalLQTYStaked.sub(LQTYToWithdraw);
            emit TotalLQTYStakedUpdated(totalLQTYStaked);

            // Transfer unstaked LQTY to user
            lqtyToken.transfer(msg.sender, LQTYToWithdraw);

            emit StakeChanged(msg.sender, newStake);
        }

        emit StakingGainsWithdrawn(msg.sender, ONEUSDGain, ONEGain);

        // Send accumulated 1USD and ONE gains to the caller
        oneusdToken.transfer(msg.sender, ONEUSDGain);
        _sendONEGainToUser(ONEGain);
    }

    // --- Reward-per-unit-staked increase functions. Called by Liquity core contracts ---

    function increaseF_ONE(uint _ONEFee) external override {
        _requireCallerIsTroveManager();
        uint ONEFeePerLQTYStaked;
     
        if (totalLQTYStaked > 0) {ONEFeePerLQTYStaked = _ONEFee.mul(DECIMAL_PRECISION).div(totalLQTYStaked);}

        F_ONE = F_ONE.add(ONEFeePerLQTYStaked); 
        emit F_ONEUpdated(F_ONE);
    }

    function increaseF_1USD(uint _1USDFee) external override {
        _requireCallerIsBorrowerOperations();
        uint ONEUSDFeePerLQTYStaked;
        
        if (totalLQTYStaked > 0) {ONEUSDFeePerLQTYStaked = _1USDFee.mul(DECIMAL_PRECISION).div(totalLQTYStaked);}
        
        F_1USD = F_1USD.add(ONEUSDFeePerLQTYStaked);
        emit F_1USDUpdated(F_1USD);
    }

    // --- Pending reward functions ---

    function getPendingONEGain(address _user) external view override returns (uint) {
        return _getPendingONEGain(_user);
    }

    function _getPendingONEGain(address _user) internal view returns (uint) {
        uint F_ONE_Snapshot = snapshots[_user].F_ONE_Snapshot;
        uint ONEGain = stakes[_user].mul(F_ONE.sub(F_ONE_Snapshot)).div(DECIMAL_PRECISION);
        return ONEGain;
    }

    function getPending1USDGain(address _user) external view override returns (uint) {
        return _getPending1USDGain(_user);
    }

    function _getPending1USDGain(address _user) internal view returns (uint) {
        uint F_1USD_Snapshot = snapshots[_user].F_1USD_Snapshot;
        uint ONEUSDGain = stakes[_user].mul(F_1USD.sub(F_1USD_Snapshot)).div(DECIMAL_PRECISION);
        return ONEUSDGain;
    }

    // --- Internal helper functions ---

    function _updateUserSnapshots(address _user) internal {
        snapshots[_user].F_ONE_Snapshot = F_ONE;
        snapshots[_user].F_1USD_Snapshot = F_1USD;
        emit StakerSnapshotsUpdated(_user, F_ONE, F_1USD);
    }

    function _sendONEGainToUser(uint ONEGain) internal {
        emit OneSent(msg.sender, ONEGain);
        (bool success, ) = msg.sender.call{value: ONEGain}("");
        require(success, "LQTYStaking: Failed to send accumulated ONEGain");
    }

    // --- 'require' functions ---

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == troveManagerAddress, "LQTYStaking: caller is not TroveM");
    }

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "LQTYStaking: caller is not BorrowerOps");
    }

     function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "LQTYStaking: caller is not ActivePool");
    }

    function _requireUserHasStake(uint currentStake) internal pure {  
        require(currentStake > 0, 'LQTYStaking: User must have a non-zero stake');  
    }

    function _requireNonZeroAmount(uint _amount) internal pure {
        require(_amount > 0, 'LQTYStaking: Amount must be non-zero');
    }

    receive() external payable {
        _requireCallerIsActivePool();
    }
}
