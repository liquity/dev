// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface ICommunityIssuance { 
    // --- Events ---
    event GrowthTokenAddressSet(address _growthTokenAddress);
    
    event PoolManagerAddressSet(address _poolManagerAddress);

    // --- Functions ---
    function setGrowthTokenAddress(address _growthTokenAddress) external;

    function setPoolManagerAddress(address _poolManagerAddress) external;

    function activateContract() external;

    function issueLQTY() external returns (uint);

    function sendLQTY(address _account, uint _LQTYamount) external;
}
