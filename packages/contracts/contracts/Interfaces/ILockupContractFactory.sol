pragma solidity 0.5.16;
    
interface ILockupContractFactory {
    
    // --- Events ---

    event GrowthTokenAddressSet(address _growthTokenAddress);

    // --- Functions ---

    function setGrowthTokenAddress(address _growthTokenAddress) external;

    function deployOneYearLockupContract(address beneficiary, uint initialEntitlement) external;

     function deployCustomDurationLockupContract(address beneficiary, uint entitlement, uint lockupDuration) external;

    function lockOneYearContracts(address[] calldata addresses) external;

    function isRegisteredOneYearLockup(address _addr) external view returns (bool);
}