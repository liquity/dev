// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/SafeMath.sol";
import "../Dependencies/console.sol";
import "../Interfaces/IGrowthToken.sol";
import "../Interfaces/ILQTYStaking.sol";
import "../Dependencies/Math.sol";
import "../Interfaces/ICLVToken.sol";

contract LQTYStaking is ILQTYStaking {
    using SafeMath for uint;

    // --- Data ---
    address public deployer;

    mapping( address => uint) stakes;
    uint public totalLQTYStaked;

    uint public F_ETH;  // Running sum of ETH fees per-LQTY-staked
    uint public F_LUSD; // Running sum of LQTY fees per-LQTY-staked

    // User snapshots of F_ETH and F_LUSD, taken at the point at which their latest deposit was made
    mapping (address => Snapshot) snapshots; 

    struct Snapshot {
        uint F_ETH_Snapshot;
        uint F_LUSD_Snapshot;
    }
    
    IGrowthToken public growthToken;
    ICLVToken public clvToken;

    address public cdpManagerAddress;
    address public borrowerOperationsAddress;
    address public activePoolAddress;

    // --- Events ---

    event GrowthTokenAddressSet(address _growthTokenAddress);
    event CLVTokenAddressSet(address _clvTokenAddress);
    event CDPManagerAddressSet(address _cdpManager);
    event BorrowerOperationsAddressSet(address _borrowerOperationsAddress);
    event ActivePoolAddressSet(address _activePoolAddress);

    // --- Functions ---

     constructor() public {
        deployer = msg.sender;
    }

    function setGrowthTokenAddress(address _growthTokenAddress) external override {
        _requireCallerIsStakingContractDeployer();
        growthToken = IGrowthToken(_growthTokenAddress);
        emit GrowthTokenAddressSet(_growthTokenAddress);
    }

    function setCLVTokenAddress(address _clvTokenAddress) external override {
        _requireCallerIsStakingContractDeployer();
        clvToken = ICLVToken(_clvTokenAddress);
        emit GrowthTokenAddressSet(_clvTokenAddress);
    }

    function setCDPManagerAddress(address _cdpManagerAddress) external override {
        _requireCallerIsStakingContractDeployer();
        cdpManagerAddress = _cdpManagerAddress;
        emit CDPManagerAddressSet(_cdpManagerAddress);
    }

    function setBorrowerOperationsAddress(address _borrowerOperationsAddress) external override {
        _requireCallerIsStakingContractDeployer();
        borrowerOperationsAddress = _borrowerOperationsAddress;
        emit BorrowerOperationsAddressSet(_borrowerOperationsAddress);
    }

    function setActivePoolAddress(address _activePoolAddress) external override {
        _requireCallerIsStakingContractDeployer();
        activePoolAddress = _activePoolAddress;
        emit BorrowerOperationsAddressSet(_activePoolAddress);
    }

    // If caller has a pre-existing stake, send any accumulated ETH and LUSD gains to them. 
    function stake(uint _LQTYamount) external override {
        uint currentStake = stakes[msg.sender];

        uint ETHGain;
        uint LUSDGain;
        // Grab any accumulated ETH and LUSD gains from the current stake
        if (currentStake != 0) {
            ETHGain = _getPendingETHGain(msg.sender);
            LUSDGain = _getPendingLUSDGain(msg.sender);
        }
    
       _updateUserSnapshots(msg.sender);

        // Increase user’s stake and total LQTY staked
        stakes[msg.sender] = currentStake.add(_LQTYamount);
        totalLQTYStaked = totalLQTYStaked.add(_LQTYamount);

        // Transfer LQTY from caller to this contract
        growthToken.sendToLQTYStaking(msg.sender, _LQTYamount);

        // Send accumulated LUSD and ETH gains to the caller
        clvToken.transfer(msg.sender, LUSDGain);
        _sendETHGainToUser(ETHGain);
    }

    // Unstake the LQTY and send the it back to the caller, along with their accumulated LUSD & ETH gains. 
    // If requested amount > stake, send their entire stake.
    function unstake(uint _LQTYamount) external override {
        uint currentStake = stakes[msg.sender];
        _requireUserHasStake(currentStake);

        // Grab any accumulated ETH and LUSD gains from the current stake
        uint ETHGain = _getPendingETHGain(msg.sender);
        uint LUSDGain = _getPendingLUSDGain(msg.sender);
        
        _updateUserSnapshots(msg.sender);

        uint LQTYToWithdraw = Math._min(_LQTYamount, currentStake);

        // Decrease user's stake and total LQTY staked
        stakes[msg.sender] = currentStake.sub(LQTYToWithdraw);
        totalLQTYStaked = totalLQTYStaked.sub(LQTYToWithdraw);  

        // Transfer unstaked LQTY to user
        growthToken.transfer(msg.sender, LQTYToWithdraw);

        // Send accumulated LUSD and ETH gains to the caller
        clvToken.transfer(msg.sender, LUSDGain);
        _sendETHGainToUser(ETHGain);
    }

    // --- Reward-per-unit-staked increase functions. Called by Liquity core contracts ---

    function increaseF_ETH(uint _ETHFee) external override {
        _requireCallerIsCDPManager();
        uint ETHFeePerLQTYStaked;
     
        if (totalLQTYStaked > 0) {ETHFeePerLQTYStaked = _ETHFee.mul(1e18).div(totalLQTYStaked);}

        F_ETH = F_ETH.add(ETHFeePerLQTYStaked); 
    }

    function increaseF_LUSD(uint _LUSDFee) external override {
        _requireCallerIsBorrowerOperations();
        uint LUSDFeePerLQTYStaked;
        
        if (totalLQTYStaked > 0) {LUSDFeePerLQTYStaked = _LUSDFee.mul(1e18).div(totalLQTYStaked);}
        
        F_LUSD = F_LUSD.add(LUSDFeePerLQTYStaked);
    }

    // --- Pending reward functions ---

    function getPendingETHGain(address _user) external view override returns (uint) {
        return _getPendingETHGain(_user);
    }

    function _getPendingETHGain(address _user) internal view returns (uint) {
        uint F_ETH_Snapshot = snapshots[_user].F_ETH_Snapshot;
        uint ETHGain = stakes[_user].mul(F_ETH.sub(F_ETH_Snapshot)).div(1e18);
        return ETHGain;
    }

    function getPendingLUSDGain(address _user) external view override returns (uint) {
        return _getPendingLUSDGain(_user);
    }

    function _getPendingLUSDGain(address _user) internal view returns (uint) {
        uint F_LUSD_Snapshot = snapshots[_user].F_LUSD_Snapshot;
        uint LUSDGain = stakes[_user].mul(F_LUSD.sub(F_LUSD_Snapshot)).div(1e18);
        return LUSDGain;
    }

    // --- Internal helper functions ---

    function _updateUserSnapshots(address _user) internal {
        snapshots[_user].F_ETH_Snapshot = F_ETH;
        snapshots[_user].F_LUSD_Snapshot = F_LUSD;
    }

    function _sendETHGainToUser(uint ETHGain) internal returns (bool) {
        (bool success, ) = msg.sender.call{value: ETHGain}("");
        require(success, "LQTYStaking: Failed to send accumulated ETHGain");
    }

    // --- 'require' functions ---

    function  _requireCallerIsStakingContractDeployer() internal view {
        require(msg.sender == deployer, "LQTYStaking: caller is not deployer");
    }

    function _requireCallerIsCDPManager() internal view {
        require(msg.sender == cdpManagerAddress, "LQTYStaking: caller is not CDPM");
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

    receive() external payable {
        _requireCallerIsActivePool();
    }
}
