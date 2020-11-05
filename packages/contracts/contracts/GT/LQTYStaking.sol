pragma solidity 0.5.16;

import "../Dependencies/SafeMath.sol";
import "../Dependencies/console.sol";
import "../Interfaces/IGrowthToken.sol";
import "../Dependencies/Math.sol";
import "../Interfaces/ICLVToken.sol";

contract LQTYStaking {
    using SafeMath for uint;

    // --- Data ---
    address public stakingContractDeployer;

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
    
    address public growthTokenAddress;
    IGrowthToken growthToken;

    address public clvTokenAddress;
    ICLVToken clvToken;

    address cdpManagerAddress;
    address borrowerOperationsAddress;

    // --- Events ---

    event GrowthTokenAddressSet(address _growthTokenAddress);
    event CLVTokenAddressSet(address _clvTokenAddress);
    event CDPManagerAddressSet(address _cdpManager);
    event BorrowerOperationsAddressSet(address _borrowerOperationsAddress);

    // --- Functions ---

     constructor() public {
        stakingContractDeployer = msg.sender;
    }

    function setGrowthTokenAddress(address _growthTokenAddress) external {
        _requireCallerIsStakingContractDeployer();
        growthTokenAddress = _growthTokenAddress;
        growthToken = IGrowthToken(growthTokenAddress);
        emit GrowthTokenAddressSet(_growthTokenAddress);
    }

    function setCLVTokenAddress(address _clvTokenAddress) external {
        _requireCallerIsStakingContractDeployer();
        clvTokenAddress = _clvTokenAddress;
        clvToken = ICLVToken(_clvTokenAddress);
        emit GrowthTokenAddressSet(_clvTokenAddress);
    }

    function setCDPManagerAddress(address _cdpManagerAddress) external {
        _requireCallerIsStakingContractDeployer();
        cdpManagerAddress = _cdpManagerAddress;
        emit CDPManagerAddressSet(_cdpManagerAddress);
    }

    function setBorrowerOperationsAddress(address _borrowerOperationsAddress) external {
        _requireCallerIsStakingContractDeployer();
        borrowerOperationsAddress = _borrowerOperationsAddress;
        emit BorrowerOperationsAddressSet(_borrowerOperationsAddress);
    }

    /* Staking expects that this StakingContract is allowed to spend at least _amount of 
    the caller's LQTY tokens.
    If caller has a pre-existing stake, send any accumulated ETH and LUSD gains to them. */
    function stake(uint _amount) external {

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
        stakes[msg.sender] = stakes[msg.sender].add(_amount);
        totalLQTYStaked = totalLQTYStaked.add(_amount);

        // Transfer LQTY from caller to this contract
        growthToken.transferFrom(msg.sender, address(this), _amount);

        // Send accumulated LUSD and ETH gains to the caller
        clvToken.transfer(msg.sender, LUSDGain);
        _sendETHGainToUser(msg.sender, ETHGain);
    }

    // Unstake the LQTY and send the it back to the caller, along with their accumulated LUSD & ETH gains. 
    // If requested amount > stake, send their entire stake.
    function unstake(uint _amount) external {
        uint currentStake = stakes[msg.sender];
        _requireUserHasStake(currentStake);

        // Grab any accumulated ETH and LUSD gains from the current stake
        uint ETHGain = _getPendingETHGain(msg.sender);
        uint LUSDGain = _getPendingLUSDGain(msg.sender);
        
        _updateUserSnapshots(msg.sender);

        uint stake = stakes[msg.sender];
        uint LQTYToWithdraw = Math._min(_amount, stake);

        // Decrease user's stake and total LQTY staked
        stakes[msg.sender] = stakes[msg.sender].sub(LQTYToWithdraw);
        totalLQTYStaked = totalLQTYStaked.sub(LQTYToWithdraw);  

        // Transfer unstaked LQTY to user
        growthToken.transfer(msg.sender, LQTYToWithdraw);

        // Send accumulated LUSD and ETH gains to the caller
        clvToken.transfer(msg.sender, LUSDGain);
        _sendETHGainToUser(msg.sender, ETHGain);
    }

    // --- Fee adding functions - called by Liquity core contracts ---

    function addETHFee() external payable {
        _requireCallerIsCDPManager();
        uint ETHFeePerLQTYStaked;
     
        if (totalLQTYStaked > 0) {ETHFeePerLQTYStaked = msg.value.mul(1e18).div(totalLQTYStaked);}

        F_ETH = F_ETH.add(ETHFeePerLQTYStaked); 
    }

    function addLUSDFee(uint _LUSDFee) external {
        _requireCallerIsBorrowerOperations();
        uint LUSDFeePerLQTYStaked;
        
        if (totalLQTYStaked > 0) {LUSDFeePerLQTYStaked = _LUSDFee.mul(1e18).div(totalLQTYStaked);}
        
        F_LUSD = F_LUSD.add(LUSDFeePerLQTYStaked);
    }

    // --- Pending reward functions ---

    function getPendingETHGain(address _user) external view returns (uint) {
        return _getPendingETHGain(_user);
    }

    function _getPendingETHGain(address _user) internal view returns (uint) {
        uint F_ETH_Snapshot = snapshots[_user].F_ETH_Snapshot;
        uint ETHGain = stakes[_user].mul(F_ETH.sub(F_ETH_Snapshot)).div(1e18);
        return ETHGain;
    }

    function getPendingLUSDGain(address _user) external view returns (uint) {
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

    function _sendETHGainToUser(address _user, uint ETHGain) internal returns (bool) {
        (bool success, ) = _user.call.value(ETHGain)("");
        require(success, "LQTYStaking: Failed to send accumulated ETHGain");
    }

    // --- 'require' functions ---

    function  _requireCallerIsStakingContractDeployer() internal view {
        require(msg.sender == stakingContractDeployer, "LQTYStaking: caller is not deployer");
    }

    function _requireCallerIsCDPManager() internal view {
        require(msg.sender == cdpManagerAddress, "LQTYStaking: caller is not CDPM");
    }

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "LQTYStaking: caller is not BorrowerOps");
    }

    function _requireUserHasStake(uint stake) internal pure {  
        require(stake > 0, 'LQTYStaking: User must have a non-zero stake');  
    }
}
