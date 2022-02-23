// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "../StabilityPool.sol";

contract StabilityPoolTester is StabilityPool {
	using SafeMathUpgradeable for uint256;

	function unprotectedPayable() external payable {
		assetBalance = assetBalance.add(msg.value);
	}

	function setCurrentScale(uint128 _currentScale) external {
		currentScale = _currentScale;
	}

	function setTotalDeposits(uint256 _totalVSTDeposits) external {
		totalVSTDeposits = _totalVSTDeposits;
	}
}
