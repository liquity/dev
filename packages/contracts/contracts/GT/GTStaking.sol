pragma solidity 0.5.16;

import "../Dependencies/SafeMath.sol";
import "../Interfaces/IGrowthToken.sol";
import "../Interfaces/ICLVToken.sol";

contract GTStaking {
    using SafeMath for uint;

    // --- Data ---
    address public stakingContractDeployer;

    mapping( address => uint) stakes;
    uint public totalGTStaked;

    uint public F_ETH;  // Running sum of ETH fees per-GT-staked
    uint public F_LQTY; // Running sum of GT fees per-GT-staked

    // User snapshots of F_ETH and F_LQTY, taken at the point at which their latest deposit was made
    mapping (address => Snapshot) snapshots; 

    struct Snapshot {
        uint F_ETH_Snapshot;
        uint F_LQTY_Snapshot;
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
    the caller's GT tokens.
    If caller has a pre-existing stake, send any accumulated ETH and LQTY gains to them. */
    function stake(uint _amount) external {

        uint currentStake = stakes[msg.sender];

        uint ETHGain;
        uint LQTYGain;
        // Grab any accumulated ETH and LQTY gains from the current stake
        if (currentStake != 0) {
            ETHGain = _getPendingETHGain(msg.sender);
            LQTYGain = _getPendingLQTYGain(msg.sender);
        }
    
       _updateUserSnapshots(msg.sender);

        // Increase user’s stake and total GT staked
        stakes[msg.sender] = stakes[msg.sender].add(_amount);
        totalGTStaked = totalGTStaked.add(_amount);

        // Transfer GT from caller to this contract
        growthToken.transferFrom(msg.sender, address(this), _amount);

        // Send accumulated LQTY and ETH gains to the caller
        clvToken.transfer(msg.sender, LQTYGain);
        _sendETHGainToUser(msg.sender, ETHGain);
    }

    function unstake(uint _amount) external {
        uint currentStake = stakes[msg.sender];

        uint ETHGain;
        uint LQTYGain;

        // Grab any accumulated ETH and LQTY gains from the current stake
        if (currentStake != 0) {
            ETHGain = _getPendingETHGain(msg.sender);
            LQTYGain = _getPendingLQTYGain(msg.sender);
        }

        _updateUserSnapshots(msg.sender);

        // Decrease user's stake and total GT staked
        stakes[msg.sender] = stakes[msg.sender].sub(_amount);
        totalGTStaked = totalGTStaked.sub(_amount);  

        // Transfer unstaked GT to user
        growthToken.transfer(msg.sender, _amount);

        // Send accumulated LQTY and ETH gains to the caller
        clvToken.transfer(msg.sender, LQTYGain);
        _sendETHGainToUser(msg.sender, ETHGain);
    }

    // --- Fee adding functions - called by Liquity core contracts ---

    function addETHFee() public payable {
        _requireCallerIsCDPManager();
        uint ETHFeePerGTStaked = msg.value.mul(1e18).div(totalGTStaked);
        F_ETH = F_ETH.add(ETHFeePerGTStaked);
    }

    function addLQTYFee(uint _LQTYFee) public {
        _requireCallerIsBorrowerOperations();
        uint LQTYFeePerGTStaked = _LQTYFee.mul(1e18).div(totalGTStaked);
        F_LQTY = F_LQTY.add(LQTYFeePerGTStaked);
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

    function getPendingLQTYGain(address _user) external view returns (uint) {
        return _getPendingLQTYGain(_user);
    }

    function _getPendingLQTYGain(address _user) internal view returns (uint) {
        uint F_LQTY_Snapshot = snapshots[_user].F_LQTY_Snapshot;
        uint LQTYGain = stakes[_user].mul(F_LQTY.sub(F_LQTY_Snapshot)).div(1e18);
        return LQTYGain;
    }

    // --- Internal helper functions ---

    function _updateUserSnapshots(address _user) internal {
        snapshots[_user].F_ETH_Snapshot = F_ETH;
        snapshots[_user].F_LQTY_Snapshot = F_LQTY;
    }

    function _sendETHGainToUser(address _user, uint ETHGain) internal returns (bool) {
        (bool success, ) = _user.call.value(ETHGain)("");
        require(success, "GTStaking: Failed to send accumulated ETHGain");
    }

    // --- 'require' functions ---

    function  _requireCallerIsStakingContractDeployer() internal view {
        require(msg.sender == stakingContractDeployer, "GTStaking: caller is not deployer");
    }

    function _requireCallerIsCDPManager() internal view {
        require(msg.sender == cdpManagerAddress, "GTStaking: caller is not CDPM");
    }

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "GTStaking: caller is not BorrowerOps");
    }
}
