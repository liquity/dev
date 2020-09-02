pragma solidity 0.5.16;

import "../Dependencies/SafeMath.sol";
import "../Interfaces/IGrowthToken.sol";

contract CustomDurationLockupContract {
    using SafeMath for uint;

    // --- Data ---
    address public lockupDeployer;
    address public beneficiary;

    address public growthTokenAddress;
    IGrowthToken growthToken;

    uint public initialEntitlement;

    uint public lockupStartTime;
    uint public lockupDurationInSeconds;

    // TODO: use an enum for {inactive, active, ended} ? Make a lockup contract non-reusable after
    // full withdrawal.
    bool public active;

    // --- Events ---

    event CDLCLocked(uint lockupStartTime);
    event CDLCUnlockedAndEmptied(uint unlockTime);

    // --- Modifiers ---

    modifier onlyLockupDeployer () {
        require(msg.sender == lockupDeployer, "OYLC: caller is not OYLC deployer");
        _;
    }

    modifier onlyBeneficiary () {
        require(msg.sender == beneficiary, "OYLC: caller is not the beneficiary");
        _;
    }

    // --- Functions ---

    constructor 
    (
    address _growthTokenAddress, 
    address _beneficiary, 
    uint _initialEntitlement,
    uint _lockupDurationInSeconds
    )
    public 
    {
    lockupDeployer = msg.sender;

    growthTokenAddress = _growthTokenAddress;
    growthToken = IGrowthToken(_growthTokenAddress);

    beneficiary =  _beneficiary;
    initialEntitlement = _initialEntitlement;
    lockupDurationInSeconds = _lockupDurationInSeconds;
    }

    function lockContract() public onlyLockupDeployer returns (bool) {
        _requireContractIsNotActive();
        _requireGTBalanceAtLeastEqualsEntitlement();

        lockupStartTime = block.timestamp;
        active = true; 
        emit CDLCLocked(lockupStartTime);
        return true;
    }

    function withdrawLockedGT() public onlyBeneficiary {
        _requireContractIsActive();
        _requireLockupDurationHasPassed();
        
        uint GTBalance = growthToken.balanceOf(address(this));
        growthToken.transfer(msg.sender, GTBalance);
        
        active = false;
        emit CDLCUnlockedAndEmptied(block.timestamp);
    }

    // --- 'require' functions ---

    function _requireContractIsActive() internal view returns (bool) {
        require(active == true, "CDLC: Contract must be inactive");
    }

    function _requireContractIsNotActive() internal view returns (bool) {
        require(active == false, "CDLC: Contract must not be active");
    }

    function _requireLockupDurationHasPassed() internal view returns (bool) {
        require(block.timestamp.sub(lockupStartTime) >= lockupDurationInSeconds, "CDLC: The lockup duration must have passed");
    }

    function _requireGTBalanceAtLeastEqualsEntitlement() internal view returns (bool) {
        uint GTBalance = growthToken.balanceOf(address(this));
        require(GTBalance >= initialEntitlement, "CDLC: GT balance of this CDLC must cover the initial entitlement");
    }
}