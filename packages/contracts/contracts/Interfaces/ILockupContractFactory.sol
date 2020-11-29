// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;
    
interface ILockupContractFactory {
    
    // --- Events ---

    event LQTYTokenAddressSet(address _lqtyTokenAddress);

    // --- Functions ---

    function setLQTYTokenAddress(address _lqtyTokenAddress) external;

    function deployOneYearLockupContract(address beneficiary, uint initialEntitlement) external;

    function deployCustomDurationLockupContract(address beneficiary, uint entitlement, uint lockupDuration) external;

    function lockOneYearContracts(address[] calldata addresses) external;

    function lockCustomDurationContracts(address[] calldata addresses) external;

    function isRegisteredOneYearLockup(address _addr) external view returns (bool);

    function isRegisteredCustomDurationLockup(address _contractAddress) external view returns (bool);
}
