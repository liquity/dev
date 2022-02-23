// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./Interfaces/IActivePool.sol";
import "./Interfaces/IDefaultPool.sol";
import "./Interfaces/IStabilityPoolManager.sol";
import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/IDeposit.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/SafetyTransfer.sol";

/*
 * The Active Pool holds the collaterals and VST debt (but not VST tokens) for all active troves.
 *
 * When a trove is liquidated, it's collateral and VST debt are transferred from the Active Pool, to either the
 * Stability Pool, the Default Pool, or both, depending on the liquidation conditions.
 *
 */
contract ActivePool is
	OwnableUpgradeable,
	ReentrancyGuardUpgradeable,
	CheckContract,
	IActivePool
{
	using SafeERC20Upgradeable for IERC20Upgradeable;
	using SafeMathUpgradeable for uint256;

	string public constant NAME = "ActivePool";
	address constant ETH_REF_ADDRESS = address(0);

	address public borrowerOperationsAddress;
	address public troveManagerAddress;
	IDefaultPool public defaultPool;
	ICollSurplusPool public collSurplusPool;

	IStabilityPoolManager public stabilityPoolManager;

	bool public isInitialized;

	mapping(address => uint256) internal assetsBalance;
	mapping(address => uint256) internal VSTDebts;

	// --- Contract setters ---

	function setAddresses(
		address _borrowerOperationsAddress,
		address _troveManagerAddress,
		address _stabilityManagerAddress,
		address _defaultPoolAddress,
		address _collSurplusPoolAddress
	) external initializer {
		require(!isInitialized, "Already initialized");
		checkContract(_borrowerOperationsAddress);
		checkContract(_troveManagerAddress);
		checkContract(_stabilityManagerAddress);
		checkContract(_defaultPoolAddress);
		checkContract(_collSurplusPoolAddress);
		isInitialized = true;

		__Ownable_init();
		__ReentrancyGuard_init();

		borrowerOperationsAddress = _borrowerOperationsAddress;
		troveManagerAddress = _troveManagerAddress;
		stabilityPoolManager = IStabilityPoolManager(_stabilityManagerAddress);
		defaultPool = IDefaultPool(_defaultPoolAddress);
		collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);

		emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
		emit TroveManagerAddressChanged(_troveManagerAddress);
		emit StabilityPoolAddressChanged(_stabilityManagerAddress);
		emit DefaultPoolAddressChanged(_defaultPoolAddress);

		renounceOwnership();
	}

	// --- Getters for public variables. Required by IPool interface ---

	/*
	 * Returns the ETH state variable.
	 *
	 *Not necessarily equal to the the contract's raw ETH balance - ether can be forcibly sent to contracts.
	 */
	function getAssetBalance(address _asset) external view override returns (uint256) {
		return assetsBalance[_asset];
	}

	function getVSTDebt(address _asset) external view override returns (uint256) {
		return VSTDebts[_asset];
	}

	// --- Pool functionality ---

	function sendAsset(
		address _asset,
		address _account,
		uint256 _amount
	) external override nonReentrant callerIsBOorTroveMorSP {
		if (stabilityPoolManager.isStabilityPool(msg.sender)) {
			assert(address(stabilityPoolManager.getAssetStabilityPool(_asset)) == msg.sender);
		}

		uint256 safetyTransferAmount = SafetyTransfer.decimalsCorrection(_asset, _amount);
		if (safetyTransferAmount == 0) return;

		assetsBalance[_asset] = assetsBalance[_asset].sub(_amount);

		if (_asset != ETH_REF_ADDRESS) {
			IERC20Upgradeable(_asset).safeTransfer(_account, safetyTransferAmount);

			if (isERC20DepositContract(_account)) {
				IDeposit(_account).receivedERC20(_asset, _amount);
			}
		} else {
			(bool success, ) = _account.call{ value: _amount }("");
			require(success, "ActivePool: sending ETH failed");
		}

		emit ActivePoolAssetBalanceUpdated(_asset, assetsBalance[_asset]);
		emit AssetSent(_account, _asset, safetyTransferAmount);
	}

	function isERC20DepositContract(address _account) private view returns (bool) {
		return (_account == address(defaultPool) ||
			_account == address(collSurplusPool) ||
			stabilityPoolManager.isStabilityPool(_account));
	}

	function increaseVSTDebt(address _asset, uint256 _amount)
		external
		override
		callerIsBOorTroveM
	{
		VSTDebts[_asset] = VSTDebts[_asset].add(_amount);
		emit ActivePoolVSTDebtUpdated(_asset, VSTDebts[_asset]);
	}

	function decreaseVSTDebt(address _asset, uint256 _amount)
		external
		override
		callerIsBOorTroveMorSP
	{
		VSTDebts[_asset] = VSTDebts[_asset].sub(_amount);
		emit ActivePoolVSTDebtUpdated(_asset, VSTDebts[_asset]);
	}

	// --- 'require' functions ---

	modifier callerIsBorrowerOperationOrDefaultPool() {
		require(
			msg.sender == borrowerOperationsAddress || msg.sender == address(defaultPool),
			"ActivePool: Caller is neither BO nor Default Pool"
		);

		_;
	}

	modifier callerIsBOorTroveMorSP() {
		require(
			msg.sender == borrowerOperationsAddress ||
				msg.sender == troveManagerAddress ||
				stabilityPoolManager.isStabilityPool(msg.sender),
			"ActivePool: Caller is neither BorrowerOperations nor TroveManager nor StabilityPool"
		);
		_;
	}

	modifier callerIsBOorTroveM() {
		require(
			msg.sender == borrowerOperationsAddress || msg.sender == troveManagerAddress,
			"ActivePool: Caller is neither BorrowerOperations nor TroveManager"
		);

		_;
	}

	function receivedERC20(address _asset, uint256 _amount)
		external
		override
		callerIsBorrowerOperationOrDefaultPool
	{
		assetsBalance[_asset] = assetsBalance[_asset].add(_amount);
		emit ActivePoolAssetBalanceUpdated(_asset, assetsBalance[_asset]);
	}

	// --- Fallback function ---

	receive() external payable callerIsBorrowerOperationOrDefaultPool {
		assetsBalance[ETH_REF_ADDRESS] = assetsBalance[ETH_REF_ADDRESS].add(msg.value);
		emit ActivePoolAssetBalanceUpdated(ETH_REF_ADDRESS, assetsBalance[ETH_REF_ADDRESS]);
	}
}
