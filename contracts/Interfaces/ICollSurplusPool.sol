// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./IDeposit.sol";

interface ICollSurplusPool is IDeposit {
	// --- Events ---

	event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
	event TroveManagerAddressChanged(address _newTroveManagerAddress);
	event ActivePoolAddressChanged(address _newActivePoolAddress);

	event CollBalanceUpdated(address indexed _account, uint256 _newBalance);
	event AssetSent(address _to, uint256 _amount);

	// --- Contract setters ---

	function setAddresses(
		address _borrowerOperationsAddress,
		address _troveManagerAddress,
		address _activePoolAddress
	) external;

	function getAssetBalance(address _asset) external view returns (uint256);

	function getCollateral(address _asset, address _account) external view returns (uint256);

	function accountSurplus(
		address _asset,
		address _account,
		uint256 _amount
	) external;

	function claimColl(address _asset, address _account) external;
}
