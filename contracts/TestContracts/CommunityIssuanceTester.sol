// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "../VSTA/CommunityIssuance.sol";

contract CommunityIssuanceTester is CommunityIssuance {
	using SafeMathUpgradeable for uint256;

	function obtainVSTA(uint256 _amount) external {
		vstaToken.transfer(msg.sender, _amount);
	}

	function getLastUpdateTokenDistribution(address stabilityPool)
		external
		view
		returns (uint256)
	{
		return _getLastUpdateTokenDistribution(stabilityPool);
	}

	function unprotectedIssueVSTA(address stabilityPool) external returns (uint256) {
		return _issueVSTA(stabilityPool);
	}
}
