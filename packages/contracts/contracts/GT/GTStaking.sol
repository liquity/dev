pragma solidity 0.5.16;
import "../Dependencies/SafeMath.sol";
import "../Interfaces/IGrowthToken.sol";
import "../Interfaces/ICLVToken.sol";


contract GTStaking {

    // --- Data ---

    mapping( address => uint) stakes;
    uint totalGTStaked;

    uint F_ETH;  // Running sum of ETH fees per-GT-staked
    uint F_LQTY; // Running sum of GT fees per-GT-staked

    // User snapshots of F_ETH and F_LQTY, taken at the point at which their latest deposit was made
    mapping (uint => Snapshot) snapshots; 

    struct Snapshot {
        uint F_ETH_Snapshot;
        uint F_LQTY_Snapshot;
    }
    
    address growthTokenAddress;
    IGrowthToken growthToken;

    address clvTokenAddress;
    ICLVToken clvToken;

    // --- Events ---

    event GrowthTokenAddressSet(address _growthTokenAddress);
    event CLVTokenAddressSet(address _clvTokenAddress);
    
    // --- Modifiers ---

    modifier onlyDeployer() {
        require(msg.sender == deployer, "GTStaking: caller is not deployer");
        _;
    }

    modifier onlyCDPManager() {
        require(msg.sender == cdpManagerAddress, "GTStaking: caller is not CDPM");
        _;
    }

    modifier onlyBorrowerOperations() {
        require(msg.sender == borrowerOperationsAddress, "GTStaking: caller is not BorrowerOps");
        _;
    }

    // --- Functions ---

    function setGrowthTokenAddress(address _growthTokenAddress) external onlyDeployer {
        growthTokenAddress = _growthTokenAddress;
        GrowthToken = IGrowthToken(growthTokenAddress);
        emit GrowthTokenAddressSet(_growthTokenAddress);
    }

    function setCLVTokenAddress(address _clvTokenAddress) external onlyDeployer {
        clvTokenAddress = _clvTokenAddress;
        clvToken = IGrowthToken(_clvTokenAddress);
        emit GrowthTokenAddressSet(_clvTokenAddress);
    }

    function setCDPManagerAddress(address _cdpManagerAddress) external onlyDeployer {
        cdpManagerAddress = _cdpManagerAddress;
        emit CDPManagerAddressSet(_cdpManagerAddress);
    }

    function setBorrowerOperationsAddress(address _cdpManagerAddress) external onlyDeployer {
        borrowerOperationsAddress = _borrowerOperationsAddress;
        emit CDPManagerAddressSet(_borrowerOperationsAddress);
    }

    /* Staking expects that this StakingContract is allowed to spend at least _amount of 
    the caller's GT tokens.
    If caller has a pre-existing stake, send any accumulated ETH and LQTY gains to them. */
    function stake(uint _amount) public {
        uint currentStake = stakes(msg.sender);

        // Grab any accumulated ETH and LQTY gains from the current stake
        if (currentStake != 0) {
            uint ETHGain = _getPendingETHGain(msg.sender);
            uint LQTYGain = _getPendingLQTYGain(msg.sender);
        }
    
       _updateUserSnapshots(msg.sender);

        // Increase user’s stake and total GT staked
        stakes[user] = stakes[user].add(_amount);
        totalGTStaked = totalGTStaked.add(_amount);

        // Transfer GT from caller to this contract
        growthToken.transferFrom(msg.sender, address(this), _amount);

        // Send accumulated LQTY and ETH gains to the caller
        clvToken.transfer(msg.sender, LQTYGain);
        _sendETHGainToUser(msg.sender, ETHGain);
    }

    function unstake(uint _amount) public {
        uint currentStake = stakes(msg.sender);

        // Grab any accumulated ETH and LQTY gains from the current stake
        if (currentStake != 0) {
            uint ETHGain = _getPendingETHGain(msg.sender);
            uint LQTYGain = _getPendingLQTYGain(msg.sender);
        }

        _updateUserSnapshots(msg.sender);

        // Decrease user's stake and total GT staked
        stakes[user] = stakes[user].sub(_amount);
        totalGTStaked = totalGTStaked.sub(_amount);  

        // Transfer unstaked GT to user
        growthToken.transfer(msg.sender, _amount);

        // Send accumulated LQTY and ETH gains to the caller
        clvToken.transfer(msg.sender, LQTYGain);
        _sendETHGainToUser(msg.sender);
    }

    function getPendingETHGain(address _user) external view returns (uint) {
        return _getPendingETHGain(user);
    }

    function _getPendingETHGain(address _user) internal view returns (uint) {
        uint F_ETH_Snapshot = snapshots[_user].F_ETH_Snapshot;
        uint ETHgain = stakes[user].mul(F_ETH.sub(F_ETH_Snapshot)).div(1e18);
        return ETHGain;
    }

    function getPendingLQTYGain(address _user) external view returns (uint) {
        return _getPendingLQTYGain(user);
    }

    function _getPendingLQTYGain(address _user) internal view returns (uint) {
        uint F_LQTY_Snapshot = snapshots[_user].F_LQTY_Snapshot;
        uint LQTYgain = stakes[_user].mul(F_LQTY.sub(F_LQTY_Snapshot)).div(1e18);
    }

    function _updateUserSnapshots(address _user) internal {
        snapshots[_user].F_ETH_Snapshot = F_ETH;
        snapshots[_user].F_LQTY_Snapshot = F_LQTY;
    }

    function _sendETHGainToUser(address _user, uint ETHGain) internal returns (bool) {
        (bool success, ) = _user.call.value(ETHGain)("");
        require(success, "GTStaking: Failed to send accumulated ETHGain");
    }

    function addETHFee() public payable onlyCDPManager {
        uint ETHFeePerGTStaked = msg.value.mul(1e18).div(totalGTStaked);
        F_ETH = F_ETH.add(ETHFeePerGTStaked);
    }


    function addLQTYFee(uint LQTYFee) public  onlyBorrowerOperations {
        uint LQTYFeePerGTStaked = LQTYFee.mul(1e18).div(totalGTStaked);
        F_LQTY = F_LQTY.add(LQTYFeePerGTStaked);
    }
}
