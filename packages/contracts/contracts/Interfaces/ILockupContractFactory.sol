// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;
    
interface ILockupContractFactory {
    
    // --- Events ---

    event STBLTokenAddressSet(address _stblTokenAddress);

    event TwoMonthsLockupContractDeployedThroughFactory(address _lockupContractAddress, address _beneficiary, uint256 _unlockTime, address _deployer);
    event SixMonthsLockupContractDeployedThroughFactory(address _lockupContractAddress, address _beneficiary, uint256 _unlockTime, address _deployer);
    event OneYearLockupContractDeployedThroughFactory(address _lockupContractAddress, address _beneficiary, uint256 _unlockTime, address _deployer);

    // --- Functions ---

    function setSTBLTokenAddress(address _stblTokenAddress) external;

    function deployTwoMonthsLockupContract(address _beneficiary, uint256 _unlockTime) external;

    function deploySixMonthsLockupContract(address _beneficiary, uint256 _unlockTime) external;

    function deployOneYearLockupContract(address _beneficiary, uint256 _unlockTime) external;

    function isRegisteredTwoMonthsLockup(address _addr) external view returns (bool);

    function isRegisteredSixMonthsLockup(address _addr) external view returns (bool);

    function isRegisteredOneYearLockup(address _addr) external view returns (bool);
}
