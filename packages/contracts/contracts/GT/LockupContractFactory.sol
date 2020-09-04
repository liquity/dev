pragma solidity 0.5.16;
import "../Dependencies/SafeMath.sol";
import "./OneYearLockupContract.sol";
import "./CustomDurationLockupContract.sol";

contract LockupContractFactory {
    using SafeMath for uint;
     
    // --- Data ---
    uint constant public ONE_YEAR_IN_SECONDS = 31536000;

    uint public factoryDeploymentTimestamp;
    address public factoryDeployer;

    address public growthTokenAddress;
    IGrowthToken GrowthToken;
    
    mapping (address => address) oneYearLockupContractToDeployer;
    mapping (address => address) customDurationLockupContractToDeployer;

    // --- Events ---

    event GrowthTokenAddressSet(address _growthTokenAddress);
    event OYLCDeployed(address _OYLCAddress, address _beneficiary, uint _entitlement);
    event CDLCDeployed(address _CDLCAddress, address _beneficiary, uint _initialEntitlement);
    
    // --- Modifiers ---

    modifier onlyFactoryDeployer () {
        require(msg.sender == factoryDeployer, "LockupContractFactory: caller is not Factory deployer");
        _;
    }

    // --- Functions ---

    constructor () public {
        factoryDeploymentTimestamp = block.timestamp;
        factoryDeployer = msg.sender;
    }

    function setGrowthTokenAddress(address _growthTokenAddress) external onlyFactoryDeployer {
        growthTokenAddress = _growthTokenAddress;
        GrowthToken = IGrowthToken(growthTokenAddress);
        emit GrowthTokenAddressSet(_growthTokenAddress);
    }

    function deployOneYearLockupContract(address beneficiary, uint initialEntitlement) external  {
        _requireGTAddressIsSet();
        OneYearLockupContract oneYearLockupContract = new OneYearLockupContract(
                                                        growthTokenAddress, 
                                                        beneficiary, 
                                                        initialEntitlement);

        oneYearLockupContractToDeployer[address(oneYearLockupContract)] = msg.sender;
        emit OYLCDeployed(address(oneYearLockupContract), beneficiary, initialEntitlement);
    }

    function deployCustomDurationLockupContract(address beneficiary, uint initialEntitlement, uint lockupDuration) external {
        _requireGTAddressIsSet();
        _requireFactoryIsAtLeastOneYearOld();
    
        CustomDurationLockupContract customDurationLockupContract = new CustomDurationLockupContract( 
                                                                        growthTokenAddress, 
                                                                        beneficiary, 
                                                                        initialEntitlement, 
                                                                        lockupDuration);

        customDurationLockupContractToDeployer[address(customDurationLockupContract)] = msg.sender;
        emit CDLCDeployed(address(customDurationLockupContract),  beneficiary, initialEntitlement);
    }

    // Simultaneously lock a set of OYLCs that were originally deployed by the caller, through this Factory.
    function lockOneYearContracts(address[] calldata addresses) external {
        for (uint i = 0; i < addresses.length; i++ ) {
            address addr = addresses[i];
            OneYearLockupContract oneYearlockupContract = OneYearLockupContract(addr);
            
            _requireIsRegisteredOneYearLockup(addr);
            _requireCallerIsOriginalDeployerofOYLC(addr);

            bool success = oneYearlockupContract.lockContract();
            require(success, "LockupContractFactory: Failed to lock the contract");
        }
    }

    // Simultaneously lock a set of CDLCs that were originally deployed by the caller, through this Factory.
    function lockCustomDurationContracts(address[] calldata addresses) external {
        for (uint i = 0; i < addresses.length; i++ ) {
            address addr = addresses[i];
            CustomDurationLockupContract customDurationLockupContract = CustomDurationLockupContract(addr);
            
            _requireIsRegisteredCustomDurationLockup(addr);
            _requireCallerIsOriginalDeployerofCDLC(addr);

            bool success = customDurationLockupContract.lockContract();
            require(success, "LockupContractFactory: Failed to lock the contract");
        }
    }

    function isRegisteredOneYearLockup(address _addr) external view returns (bool) {
        _isRegisteredOneYearLockup(_addr);
    }

    function _isRegisteredOneYearLockup(address addr) internal view returns (bool) {
        bool isRegistered = oneYearLockupContractToDeployer[addr] != address(0);
        return isRegistered;
    }

    function isRegisteredCustomDurationLockup(address _addr) external view returns (bool) {
        _isRegisteredCustomDurationLockup(_addr);
    }

    function _isRegisteredCustomDurationLockup(address addr) internal view returns (bool) {
        bool isRegistered = customDurationLockupContractToDeployer[addr] != address(0);
        return isRegistered;
    }

    // --- 'require'  functions ---

    function _requireGTAddressIsSet() internal view {
        require(growthTokenAddress != address(0), "LockupContractFactory: GT Address is not set");
    }

    function _requireFactoryIsAtLeastOneYearOld() internal view {
        require(block.timestamp.sub(factoryDeploymentTimestamp) >= ONE_YEAR_IN_SECONDS,
        "Factory must be at least one year old");
    }

    function _requireIsRegisteredOneYearLockup(address _contractAddress) internal view {
        require(_isRegisteredOneYearLockup(_contractAddress), 
        "LockupContractFactory: is not the address of a registered OneYearLockupContract");
    }

    function _requireIsRegisteredCustomDurationLockup(address _contractAddress) internal view {
        require(_isRegisteredCustomDurationLockup(_contractAddress), 
        "LockupContractFactory: is not the address of a registered CustomDurationLockupContract");
    }

    function _requireCallerIsOriginalDeployerofOYLC(address _contractAddress) internal view {
        address deployerAddress = oneYearLockupContractToDeployer[_contractAddress];
        require(deployerAddress == msg.sender,
        "LockupContractFactory: OneYearLockupContract was not deployed by the caller");
    }

     function _requireCallerIsOriginalDeployerofCDLC(address _contractAddress) internal view {
        address deployerAddress = customDurationLockupContractToDeployer[_contractAddress];
        require(deployerAddress == msg.sender,
        "LockupContractFactory: customDurationLockupContract was not deployed by the caller");
    }
}