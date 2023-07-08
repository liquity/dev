// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Dependencies/BaseMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/CheckContract.sol";
import "../Dependencies/console.sol";
import "../Interfaces/ISTBLToken.sol";
import "../Interfaces/ISTBLStaking.sol";
import "../Dependencies/LiquityMath.sol";
import "../Interfaces/IXBRLToken.sol";

contract STBLStaking is ISTBLStaking, Ownable, CheckContract, BaseMath {

    // --- Data ---
    string constant public NAME = "STBLStaking";

    mapping( address => uint) public stakes;
    uint256 public totalSTBLStaked;

    uint256 public F_ETH;  // Running sum of ETH fees per-STBL-staked
    uint256 public F_XBRL; // Running sum of STBL fees per-STBL-staked

    // User snapshots of F_ETH and F_XBRL, taken at the point at which their latest deposit was made
    mapping (address => Snapshot) public snapshots; 

    struct Snapshot {
        uint256 F_ETH_Snapshot;
        uint256 F_XBRL_Snapshot;
    }
    
    ISTBLToken public stblToken;
    IXBRLToken public xbrlToken;

    address public troveManagerAddress;
    address public borrowerOperationsAddress;
    address public activePoolAddress;

    // --- Events ---

    event STBLTokenAddressSet(address _stblTokenAddress);
    event XBRLTokenAddressSet(address _xbrlTokenAddress);
    event TroveManagerAddressSet(address _troveManager);
    event BorrowerOperationsAddressSet(address _borrowerOperationsAddress);
    event ActivePoolAddressSet(address _activePoolAddress);

    event StakeChanged(address indexed staker, uint256 newStake);
    event StakingGainsWithdrawn(address indexed staker, uint256 XBRLGain, uint256 ETHGain);
    event F_ETHUpdated(uint _F_ETH);
    event F_XBRLUpdated(uint _F_XBRL);
    event TotalSTBLStakedUpdated(uint _totalSTBLStaked);
    event EtherSent(address _account, uint256 _amount);
    event StakerSnapshotsUpdated(address _staker, uint256 _F_ETH, uint256 _F_XBRL);

    // --- Functions ---

    function setAddresses
    (
        address _stblTokenAddress,
        address _xbrlTokenAddress,
        address _troveManagerAddress, 
        address _borrowerOperationsAddress,
        address _activePoolAddress
    ) 
        external 
        onlyOwner 
        override 
    {
        checkContract(_stblTokenAddress);
        checkContract(_xbrlTokenAddress);
        checkContract(_troveManagerAddress);
        checkContract(_borrowerOperationsAddress);
        checkContract(_activePoolAddress);

        stblToken = ISTBLToken(_stblTokenAddress);
        xbrlToken = IXBRLToken(_xbrlTokenAddress);
        troveManagerAddress = _troveManagerAddress;
        borrowerOperationsAddress = _borrowerOperationsAddress;
        activePoolAddress = _activePoolAddress;

        emit STBLTokenAddressSet(_stblTokenAddress);
        emit STBLTokenAddressSet(_xbrlTokenAddress);
        emit TroveManagerAddressSet(_troveManagerAddress);
        emit BorrowerOperationsAddressSet(_borrowerOperationsAddress);
        emit ActivePoolAddressSet(_activePoolAddress);

        _renounceOwnership();
    }

    // If caller has a pre-existing stake, send any accumulated ETH and XBRL gains to them. 
    function stake(uint _STBLamount) external override {
        _requireNonZeroAmount(_STBLamount);

        uint256 currentStake = stakes[msg.sender];

        uint256 ETHGain;
        uint256 XBRLGain;
        // Grab any accumulated ETH and XBRL gains from the current stake
        if (currentStake != 0) {
            ETHGain = _getPendingETHGain(msg.sender);
            XBRLGain = _getPendingXBRLGain(msg.sender);
        }
    
       _updateUserSnapshots(msg.sender);

        uint256 newStake = currentStake + _STBLamount;

        // Increase user’s stake and total STBL staked
        stakes[msg.sender] = newStake;
        totalSTBLStaked = totalSTBLStaked + _STBLamount;
        emit TotalSTBLStakedUpdated(totalSTBLStaked);

        // Transfer STBL from caller to this contract
        stblToken.sendToSTBLStaking(msg.sender, _STBLamount);

        emit StakeChanged(msg.sender, newStake);
        emit StakingGainsWithdrawn(msg.sender, XBRLGain, ETHGain);

         // Send accumulated XBRL and ETH gains to the caller
        if (currentStake != 0) {
            xbrlToken.transfer(msg.sender, XBRLGain);
            _sendETHGainToUser(ETHGain);
        }
    }

    // Unstake the STBL and send the it back to the caller, along with their accumulated XBRL & ETH gains. 
    // If requested amount > stake, send their entire stake.
    function unstake(uint _STBLamount) external override {
        uint256 currentStake = stakes[msg.sender];
        _requireUserHasStake(currentStake);

        // Grab any accumulated ETH and XBRL gains from the current stake
        uint256 ETHGain = _getPendingETHGain(msg.sender);
        uint256 XBRLGain = _getPendingXBRLGain(msg.sender);
        
        _updateUserSnapshots(msg.sender);

        if (_STBLamount > 0) {
            uint256 STBLToWithdraw = LiquityMath._min(_STBLamount, currentStake);

            uint256 newStake = currentStake - STBLToWithdraw;

            // Decrease user's stake and total STBL staked
            stakes[msg.sender] = newStake;
            totalSTBLStaked -= STBLToWithdraw;
            emit TotalSTBLStakedUpdated(totalSTBLStaked);

            // Transfer unstaked STBL to user
            stblToken.transfer(msg.sender, STBLToWithdraw);

            emit StakeChanged(msg.sender, newStake);
        }

        emit StakingGainsWithdrawn(msg.sender, XBRLGain, ETHGain);

        // Send accumulated XBRL and ETH gains to the caller
        xbrlToken.transfer(msg.sender, XBRLGain);
        _sendETHGainToUser(ETHGain);
    }

    // --- Reward-per-unit-staked increase functions. Called by Liquity core contracts ---

    function increaseF_ETH(uint _ETHFee) external override {
        _requireCallerIsTroveManager();
        uint256 ETHFeePerSTBLStaked;
     
        if (totalSTBLStaked > 0) {ETHFeePerSTBLStaked = _ETHFee * DECIMAL_PRECISION / totalSTBLStaked;}

        F_ETH += ETHFeePerSTBLStaked; 
        emit F_ETHUpdated(F_ETH);
    }

    function increaseF_XBRL(uint _XBRLFee) external override {
        _requireCallerIsBorrowerOperations();
        uint256 XBRLFeePerSTBLStaked;
        
        if (totalSTBLStaked > 0) {XBRLFeePerSTBLStaked = _XBRLFee * DECIMAL_PRECISION / totalSTBLStaked;}
        
        F_XBRL += XBRLFeePerSTBLStaked;
        emit F_XBRLUpdated(F_XBRL);
    }

    // --- Pending reward functions ---

    function getPendingETHGain(address _user) external view override returns (uint) {
        return _getPendingETHGain(_user);
    }

    function _getPendingETHGain(address _user) internal view returns (uint) {
        uint256 F_ETH_Snapshot = snapshots[_user].F_ETH_Snapshot;
        uint256 ETHGain = stakes[_user] * (F_ETH - F_ETH_Snapshot) / DECIMAL_PRECISION;
        return ETHGain;
    }

    function getPendingXBRLGain(address _user) external view override returns (uint) {
        return _getPendingXBRLGain(_user);
    }

    function _getPendingXBRLGain(address _user) internal view returns (uint) {
        uint256 F_XBRL_Snapshot = snapshots[_user].F_XBRL_Snapshot;
        uint256 XBRLGain = stakes[_user] * (F_XBRL - F_XBRL_Snapshot) / DECIMAL_PRECISION;
        return XBRLGain;
    }

    // --- Internal helper functions ---

    function _updateUserSnapshots(address _user) internal {
        snapshots[_user].F_ETH_Snapshot = F_ETH;
        snapshots[_user].F_XBRL_Snapshot = F_XBRL;
        emit StakerSnapshotsUpdated(_user, F_ETH, F_XBRL);
    }

    function _sendETHGainToUser(uint ETHGain) internal {
        emit EtherSent(msg.sender, ETHGain);
        (bool success, ) = msg.sender.call{value: ETHGain}("");
        require(success, "STBLStaking: Failed to send accumulated ETHGain");
    }

    // --- 'require' functions ---

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == troveManagerAddress, "STBLStaking: caller is not TroveM");
    }

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "STBLStaking: caller is not BorrowerOps");
    }

     function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "STBLStaking: caller is not ActivePool");
    }

    function _requireUserHasStake(uint currentStake) internal pure {  
        require(currentStake > 0, 'STBLStaking: User must have a non-zero stake');  
    }

    function _requireNonZeroAmount(uint _amount) internal pure {
        require(_amount > 0, 'STBLStaking: Amount must be non-zero');
    }

    receive() external payable {
        _requireCallerIsActivePool();
    }
}
