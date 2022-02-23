// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./BaseMath.sol";
import "./VestaMath.sol";
import "../Interfaces/IActivePool.sol";
import "../Interfaces/IDefaultPool.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/IVestaBase.sol";

/*
 * Base contract for TroveManager, BorrowerOperations and StabilityPool. Contains global system constants and
 * common functions.
 */
contract VestaBase is BaseMath, IVestaBase, OwnableUpgradeable {
	using SafeMathUpgradeable for uint256;
	address public constant ETH_REF_ADDRESS = address(0);

	IVestaParameters public override vestaParams;

	function setVestaParameters(address _vaultParams) public onlyOwner {
		vestaParams = IVestaParameters(_vaultParams);
		emit VaultParametersBaseChanged(_vaultParams);
	}

	// --- Gas compensation functions ---

	// Returns the composite debt (drawn debt + gas compensation) of a trove, for the purpose of ICR calculation
	function _getCompositeDebt(address _asset, uint256 _debt) internal view returns (uint256) {
		return _debt.add(vestaParams.VST_GAS_COMPENSATION(_asset));
	}

	function _getNetDebt(address _asset, uint256 _debt) internal view returns (uint256) {
		return _debt.sub(vestaParams.VST_GAS_COMPENSATION(_asset));
	}

	// Return the amount of ETH to be drawn from a trove's collateral and sent as gas compensation.
	function _getCollGasCompensation(address _asset, uint256 _entireColl)
		internal
		view
		returns (uint256)
	{
		return _entireColl / vestaParams.PERCENT_DIVISOR(_asset);
	}

	function getEntireSystemColl(address _asset) public view returns (uint256 entireSystemColl) {
		uint256 activeColl = vestaParams.activePool().getAssetBalance(_asset);
		uint256 liquidatedColl = vestaParams.defaultPool().getAssetBalance(_asset);

		return activeColl.add(liquidatedColl);
	}

	function getEntireSystemDebt(address _asset) public view returns (uint256 entireSystemDebt) {
		uint256 activeDebt = vestaParams.activePool().getVSTDebt(_asset);
		uint256 closedDebt = vestaParams.defaultPool().getVSTDebt(_asset);

		return activeDebt.add(closedDebt);
	}

	function _getTCR(address _asset, uint256 _price) internal view returns (uint256 TCR) {
		uint256 entireSystemColl = getEntireSystemColl(_asset);
		uint256 entireSystemDebt = getEntireSystemDebt(_asset);

		TCR = VestaMath._computeCR(entireSystemColl, entireSystemDebt, _price);

		return TCR;
	}

	function _checkRecoveryMode(address _asset, uint256 _price) internal view returns (bool) {
		uint256 TCR = _getTCR(_asset, _price);

		return TCR < vestaParams.CCR(_asset);
	}

	function _requireUserAcceptsFee(
		uint256 _fee,
		uint256 _amount,
		uint256 _maxFeePercentage
	) internal view {
		uint256 feePercentage = _fee.mul(vestaParams.DECIMAL_PRECISION()).div(_amount);
		require(feePercentage <= _maxFeePercentage, "Fee exceeded provided maximum");
	}
}
