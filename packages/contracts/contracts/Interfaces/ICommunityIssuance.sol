// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface ICommunityIssuance { 
    // --- Events ---
    event GrowthTokenAddressSet(address _growthTokenAddress);
    
    event StabilityPoolAddressSet(address _stabilityPoolAddress);

    // --- Functions ---
    function setGrowthTokenAddress(address _growthTokenAddress) external;

    function setStabilityPoolAddress(address _stabilityPoolAddress) external;

    function activateContract() external;

    function issueLQTY() external returns (uint);

    function sendLQTY(address _account, uint _LQTYamount) external;
}
