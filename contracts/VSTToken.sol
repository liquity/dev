// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./Dependencies/CheckContract.sol";
import "./Interfaces/IVSTToken.sol";

contract VSTToken is CheckContract, IVSTToken, Ownable {
	using SafeMath for uint256;

	address public immutable troveManagerAddress;
	IStabilityPoolManager public immutable stabilityPoolManager;
	address public immutable borrowerOperationsAddress;

	mapping(address => bool) public emergencyStopMintingCollateral;

	event EmergencyStopMintingCollateral(address _asset, bool state);

	constructor(
		address _troveManagerAddress,
		address _stabilityPoolManagerAddress,
		address _borrowerOperationsAddress
	) ERC20("Vesta Stable", "VST") {
		checkContract(_troveManagerAddress);
		checkContract(_stabilityPoolManagerAddress);
		checkContract(_borrowerOperationsAddress);

		troveManagerAddress = _troveManagerAddress;
		emit TroveManagerAddressChanged(_troveManagerAddress);

		stabilityPoolManager = IStabilityPoolManager(_stabilityPoolManagerAddress);
		emit StabilityPoolAddressChanged(_stabilityPoolManagerAddress);

		borrowerOperationsAddress = _borrowerOperationsAddress;
		emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
	}

	// --- Functions for intra-Vesta calls ---

	//
	function emergencyStopMinting(address _asset, bool status) external override onlyOwner {
		emergencyStopMintingCollateral[_asset] = status;
		emit EmergencyStopMintingCollateral(_asset, status);
	}

	function mint(
		address _asset,
		address _account,
		uint256 _amount
	) external override {
		_requireCallerIsBorrowerOperations();
		require(!emergencyStopMintingCollateral[_asset], "Mint is blocked on this collateral");

		_mint(_account, _amount);
	}

	function burn(address _account, uint256 _amount) external override {
		_requireCallerIsBOorTroveMorSP();
		_burn(_account, _amount);
	}

	function sendToPool(
		address _sender,
		address _poolAddress,
		uint256 _amount
	) external override {
		_requireCallerIsStabilityPool();
		_transfer(_sender, _poolAddress, _amount);
	}

	function returnFromPool(
		address _poolAddress,
		address _receiver,
		uint256 _amount
	) external override {
		_requireCallerIsTroveMorSP();
		_transfer(_poolAddress, _receiver, _amount);
	}

	// --- External functions ---

	function transfer(address recipient, uint256 amount) public override returns (bool) {
		_requireValidRecipient(recipient);
		return super.transfer(recipient, amount);
	}

	function transferFrom(
		address sender,
		address recipient,
		uint256 amount
	) public override returns (bool) {
		_requireValidRecipient(recipient);
		return super.transferFrom(sender, recipient, amount);
	}

	// --- 'require' functions ---

	function _requireValidRecipient(address _recipient) internal view {
		require(
			_recipient != address(0) && _recipient != address(this),
			"VST: Cannot transfer tokens directly to the VST token contract or the zero address"
		);
		require(
			!stabilityPoolManager.isStabilityPool(_recipient) &&
				_recipient != troveManagerAddress &&
				_recipient != borrowerOperationsAddress,
			"VST: Cannot transfer tokens directly to the StabilityPool, TroveManager or BorrowerOps"
		);
	}

	function _requireCallerIsBorrowerOperations() internal view {
		require(
			msg.sender == borrowerOperationsAddress,
			"VSTToken: Caller is not BorrowerOperations"
		);
	}

	function _requireCallerIsBOorTroveMorSP() internal view {
		require(
			msg.sender == borrowerOperationsAddress ||
				msg.sender == troveManagerAddress ||
				stabilityPoolManager.isStabilityPool(msg.sender),
			"VST: Caller is neither BorrowerOperations nor TroveManager nor StabilityPool"
		);
	}

	function _requireCallerIsStabilityPool() internal view {
		require(
			stabilityPoolManager.isStabilityPool(msg.sender),
			"VST: Caller is not the StabilityPool"
		);
	}

	function _requireCallerIsTroveMorSP() internal view {
		require(
			msg.sender == troveManagerAddress || stabilityPoolManager.isStabilityPool(msg.sender),
			"VST: Caller is neither TroveManager nor StabilityPool"
		);
	}
}
