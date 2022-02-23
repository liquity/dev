// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./Interfaces/ICollSurplusPool.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/SafetyTransfer.sol";

contract CollSurplusPool is OwnableUpgradeable, CheckContract, ICollSurplusPool {
	using SafeMathUpgradeable for uint256;
	using SafeERC20Upgradeable for IERC20Upgradeable;

	string public constant NAME = "CollSurplusPool";
	address constant ETH_REF_ADDRESS = address(0);

	address public borrowerOperationsAddress;
	address public troveManagerAddress;
	address public activePoolAddress;

	bool public isInitialized;

	// deposited ether tracker
	mapping(address => uint256) balances;
	// Collateral surplus claimable by trove owners
	mapping(address => mapping(address => uint256)) internal userBalances;

	// --- Contract setters ---

	function setAddresses(
		address _borrowerOperationsAddress,
		address _troveManagerAddress,
		address _activePoolAddress
	) external override initializer {
		require(!isInitialized, "Already initialized");
		checkContract(_borrowerOperationsAddress);
		checkContract(_troveManagerAddress);
		checkContract(_activePoolAddress);
		isInitialized = true;

		__Ownable_init();

		borrowerOperationsAddress = _borrowerOperationsAddress;
		troveManagerAddress = _troveManagerAddress;
		activePoolAddress = _activePoolAddress;

		emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
		emit TroveManagerAddressChanged(_troveManagerAddress);
		emit ActivePoolAddressChanged(_activePoolAddress);

		renounceOwnership();
	}

	/* Returns the Asset state variable at ActivePool address.
       Not necessarily equal to the raw ether balance - ether can be forcibly sent to contracts. */
	function getAssetBalance(address _asset) external view override returns (uint256) {
		return balances[_asset];
	}

	function getCollateral(address _asset, address _account)
		external
		view
		override
		returns (uint256)
	{
		return userBalances[_account][_asset];
	}

	// --- Pool functionality ---

	function accountSurplus(
		address _asset,
		address _account,
		uint256 _amount
	) external override {
		_requireCallerIsTroveManager();

		uint256 newAmount = userBalances[_account][_asset].add(_amount);
		userBalances[_account][_asset] = newAmount;

		emit CollBalanceUpdated(_account, newAmount);
	}

	function claimColl(address _asset, address _account) external override {
		_requireCallerIsBorrowerOperations();
		uint256 claimableCollEther = userBalances[_account][_asset];

		uint256 safetyTransferclaimableColl = SafetyTransfer.decimalsCorrection(
			_asset,
			userBalances[_account][_asset]
		);

		require(
			safetyTransferclaimableColl > 0,
			"CollSurplusPool: No collateral available to claim"
		);

		userBalances[_account][_asset] = 0;
		emit CollBalanceUpdated(_account, 0);

		balances[_asset] = balances[_asset].sub(claimableCollEther);
		emit AssetSent(_account, safetyTransferclaimableColl);

		if (_asset == ETH_REF_ADDRESS) {
			(bool success, ) = _account.call{ value: claimableCollEther }("");
			require(success, "CollSurplusPool: sending ETH failed");
		} else {
			IERC20Upgradeable(_asset).safeTransfer(_account, safetyTransferclaimableColl);
		}
	}

	function receivedERC20(address _asset, uint256 _amount) external override {
		_requireCallerIsActivePool();
		balances[_asset] = balances[_asset].add(_amount);
	}

	// --- 'require' functions ---

	function _requireCallerIsBorrowerOperations() internal view {
		require(
			msg.sender == borrowerOperationsAddress,
			"CollSurplusPool: Caller is not Borrower Operations"
		);
	}

	function _requireCallerIsTroveManager() internal view {
		require(msg.sender == troveManagerAddress, "CollSurplusPool: Caller is not TroveManager");
	}

	function _requireCallerIsActivePool() internal view {
		require(msg.sender == activePoolAddress, "CollSurplusPool: Caller is not Active Pool");
	}

	// --- Fallback function ---

	receive() external payable {
		_requireCallerIsActivePool();
		balances[ETH_REF_ADDRESS] = balances[ETH_REF_ADDRESS].add(msg.value);
	}
}
