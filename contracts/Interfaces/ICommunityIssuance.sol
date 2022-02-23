// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

interface ICommunityIssuance {
	// --- Events ---

	event VSTATokenAddressSet(address _VSTATokenAddress);
	event StabilityPoolAddressSet(address _stabilityPoolAddress);
	event TotalVSTAIssuedUpdated(address indexed stabilityPool, uint256 _totalVSTAIssued);

	// --- Functions ---

	function setAddresses(
		address _VSTATokenAddress,
		address _stabilityPoolAddress,
		address _adminContract
	) external;

	function issueVSTA() external returns (uint256);

	function sendVSTA(address _account, uint256 _VSTAamount) external;

	function addFundToStabilityPool(address _pool, uint256 _assignedSupply) external;

	function addFundToStabilityPoolFrom(
		address _pool,
		uint256 _assignedSupply,
		address _spender
	) external;

	function transferFundToAnotherStabilityPool(
		address _target,
		address _receiver,
		uint256 _quantity
	) external;

	function setWeeklyVstaDistribution(address _stabilityPool, uint256 _weeklyReward) external;
}
