// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "./IPool.sol";

interface IDefaultPool is IPool {
	// --- Events ---
	event TroveManagerAddressChanged(address _newTroveManagerAddress);
	event DefaultPoolVSTDebtUpdated(address _asset, uint256 _VSTDebt);
	event DefaultPoolAssetBalanceUpdated(address _asset, uint256 _balance);

	// --- Functions ---
	function sendAssetToActivePool(address _asset, uint256 _amount) external;
}
