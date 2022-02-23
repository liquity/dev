// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

// Common interface for the Trove Manager.
interface IBorrowerOperations {
	// --- Events ---

	event TroveManagerAddressChanged(address _newTroveManagerAddress);
	event StabilityPoolAddressChanged(address _stabilityPoolAddress);
	event GasPoolAddressChanged(address _gasPoolAddress);
	event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
	event SortedTrovesAddressChanged(address _sortedTrovesAddress);
	event VSTTokenAddressChanged(address _vstTokenAddress);
	event VSTAStakingAddressChanged(address _VSTAStakingAddress);

	event TroveCreated(address indexed _asset, address indexed _borrower, uint256 arrayIndex);
	event TroveUpdated(
		address indexed _asset,
		address indexed _borrower,
		uint256 _debt,
		uint256 _coll,
		uint256 stake,
		uint8 operation
	);
	event VSTBorrowingFeePaid(
		address indexed _asset,
		address indexed _borrower,
		uint256 _VSTFee
	);

	// --- Functions ---

	function setAddresses(
		address _troveManagerAddress,
		address _stabilityPoolAddress,
		address _gasPoolAddress,
		address _collSurplusPoolAddress,
		address _sortedTrovesAddress,
		address _vstTokenAddress,
		address _VSTAStakingAddress,
		address _vestaParamsAddress
	) external;

	function openTrove(
		address _asset,
		uint256 _tokenAmount,
		uint256 _maxFee,
		uint256 _VSTAmount,
		address _upperHint,
		address _lowerHint
	) external payable;

	function addColl(
		address _asset,
		uint256 _assetSent,
		address _upperHint,
		address _lowerHint
	) external payable;

	function moveETHGainToTrove(
		address _asset,
		uint256 _amountMoved,
		address _user,
		address _upperHint,
		address _lowerHint
	) external payable;

	function withdrawColl(
		address _asset,
		uint256 _amount,
		address _upperHint,
		address _lowerHint
	) external;

	function withdrawVST(
		address _asset,
		uint256 _maxFee,
		uint256 _amount,
		address _upperHint,
		address _lowerHint
	) external;

	function repayVST(
		address _asset,
		uint256 _amount,
		address _upperHint,
		address _lowerHint
	) external;

	function closeTrove(address _asset) external;

	function adjustTrove(
		address _asset,
		uint256 _assetSent,
		uint256 _maxFee,
		uint256 _collWithdrawal,
		uint256 _debtChange,
		bool isDebtIncrease,
		address _upperHint,
		address _lowerHint
	) external payable;

	function claimCollateral(address _asset) external;

	function getCompositeDebt(address _asset, uint256 _debt) external view returns (uint256);
}
