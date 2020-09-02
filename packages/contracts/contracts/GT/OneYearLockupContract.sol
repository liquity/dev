pragma solidity 0.5.16;

import "../Dependencies/SafeMath.sol";
import "../Interfaces/IGrowthToken.sol";

contract OneYearLockupContract {
    using SafeMath for uint;

    // --- Data ---

    uint constant public ONE_YEAR_IN_SECONDS = 31536000; 

    address public lockupDeployer;
    address public beneficiary;

    address public growthTokenAddress;
    IGrowthToken growthToken;

    uint public initialEntitlement;

    uint public lockupStartTime;

    // TODO: use an enum for {inactive, active, ended} ? Make a lockup contract non-reusable after
    // full withdrawal.
    bool public active;

    // --- Events ---

    event OYLCLocked(uint lockupStartTime);
    event OYLCUnlockedAndEmptied(uint unlockTime);

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
    uint _initialEntitlement
    )
    public 
    {
    lockupDeployer = msg.sender;

    growthTokenAddress = _growthTokenAddress;
    growthToken = IGrowthToken(_growthTokenAddress);

    beneficiary =  _beneficiary;
    initialEntitlement = _initialEntitlement;
    }

    function lockContract() public onlyLockupDeployer returns (bool) {
        _requireContractIsNotActive();
        _requireGTBalanceAtLeastEqualsEntitlement();

        active = true; 
        lockupStartTime = block.timestamp;
        emit OYLCLocked(lockupStartTime);
        return true;
    }

    function withdrawLockedGT() public onlyBeneficiary {
        _requireContractIsActive();
        _requireOneYearPassedSinceLockup();
        
        active = false;

        uint GTBalance = growthToken.balanceOf(address(this));
        growthToken.transfer(beneficiary, GTBalance);
        emit OYLCUnlockedAndEmptied(block.timestamp);
    }

    // --- 'require' functions ---

    function _requireContractIsActive() internal view returns (bool) {
        require(active == true, "OYLC: Contract must be inactive");
    }

    function _requireContractIsNotActive() internal view returns (bool) {
        require(active == false, "OYLC: Contract must not be active");
    }

    function _requireOneYearPassedSinceLockup() internal view returns (bool) {
        require(block.timestamp.sub(lockupStartTime) >= ONE_YEAR_IN_SECONDS, "OYLC: At least one year since lockup must have passed");
    }

    function _requireGTBalanceAtLeastEqualsEntitlement() internal view returns (bool) {
        uint GTBalance = growthToken.balanceOf(address(this));
        require(GTBalance >= initialEntitlement, "OYLC: GT balance of this OYLC must cover the initial entitlement");
    }
}