// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "../DefaultPool.sol";

contract DefaultPoolTester is DefaultPool {
	using SafeMathUpgradeable for uint256;

	function unprotectedIncreaseVSTDebt(address _asset, uint256 _amount) external {
		VSTDebts[_asset] = VSTDebts[_asset].add(_amount);
	}

	function unprotectedPayable(address _asset, uint256 amount) external payable {
		amount = _asset == address(0) ? msg.value : amount;
		assetsBalance[_asset] = assetsBalance[_asset].add(msg.value);
	}
}
