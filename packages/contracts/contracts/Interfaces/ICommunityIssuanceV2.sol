// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface ICommunityIssuanceV2 {
    // --- Events ---
    event LQTYTokenAddressSet(address _lqtyTokenAddress);
    event StabilityPoolAddressSet(address _stabilityPoolAddress);
    event TotalLQTYIssuedUpdated(uint _totalLQTYIssued);

    // --- Functions ---

    function setParams(address _lqtyTokenAddress, address _stabilityPoolAddress, address _merkleDistributor, uint _migrationTimestamp) external;

    function issueLQTY() external returns (uint);

    function sendLQTY(address _account, uint _LQTYamount) external;
}
