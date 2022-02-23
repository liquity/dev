// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "../Dependencies/CheckContract.sol";
import "../Interfaces/IBorrowerOperations.sol";

contract BorrowerOperationsScript is CheckContract {
	IBorrowerOperations immutable borrowerOperations;

	constructor(IBorrowerOperations _borrowerOperations) {
		checkContract(address(_borrowerOperations));
		borrowerOperations = _borrowerOperations;
	}

	function openTrove(
		address _asset,
		uint256 _assetAmountSent,
		uint256 _maxFee,
		uint256 _VSTAmount,
		address _upperHint,
		address _lowerHint
	) external payable {
		borrowerOperations.openTrove{ value: getValueOrArg(_asset, _assetAmountSent) }(
			_asset,
			_assetAmountSent,
			_maxFee,
			_VSTAmount,
			_upperHint,
			_lowerHint
		);
	}

	function addColl(
		address _asset,
		uint256 _assetAmountSent,
		address _upperHint,
		address _lowerHint
	) external payable {
		borrowerOperations.addColl{ value: getValueOrArg(_asset, _assetAmountSent) }(
			_asset,
			_assetAmountSent,
			_upperHint,
			_lowerHint
		);
	}

	function withdrawColl(
		address _asset,
		uint256 _amount,
		address _upperHint,
		address _lowerHint
	) external {
		borrowerOperations.withdrawColl(_asset, _amount, _upperHint, _lowerHint);
	}

	function withdrawVST(
		address _asset,
		uint256 _maxFee,
		uint256 _amount,
		address _upperHint,
		address _lowerHint
	) external {
		borrowerOperations.withdrawVST(_asset, _maxFee, _amount, _upperHint, _lowerHint);
	}

	function repayVST(
		address _asset,
		uint256 _amount,
		address _upperHint,
		address _lowerHint
	) external {
		borrowerOperations.repayVST(_asset, _amount, _upperHint, _lowerHint);
	}

	function closeTrove(address _asset) external {
		borrowerOperations.closeTrove(_asset);
	}

	function adjustTrove(
		address _asset,
		uint256 _assetAmountSent,
		uint256 _maxFee,
		uint256 _collWithdrawal,
		uint256 _debtChange,
		bool isDebtIncrease,
		address _upperHint,
		address _lowerHint
	) external payable {
		borrowerOperations.adjustTrove{ value: getValueOrArg(_asset, _assetAmountSent) }(
			_asset,
			_assetAmountSent,
			_maxFee,
			_collWithdrawal,
			_debtChange,
			isDebtIncrease,
			_upperHint,
			_lowerHint
		);
	}

	function claimCollateral(address _asset) external {
		borrowerOperations.claimCollateral(_asset);
	}

	function getValueOrArg(address _asset, uint256 _assetAmountSent) private returns (uint256) {
		return _asset == address(0) ? msg.value : _assetAmountSent;
	}
}
