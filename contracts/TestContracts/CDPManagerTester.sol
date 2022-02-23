// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "../TroveManager.sol";

/* Tester contract inherits from TroveManager, and provides external functions 
for testing the parent's internal functions. */

contract TroveManagerTester is TroveManager {
	function computeICR(
		uint256 _coll,
		uint256 _debt,
		uint256 _price
	) external pure returns (uint256) {
		return VestaMath._computeCR(_coll, _debt, _price);
	}

	function getCollGasCompensation(address _asset, uint256 _coll)
		external
		view
		returns (uint256)
	{
		return _getCollGasCompensation(_asset, _coll);
	}

	function getVSTGasCompensation(address _asset) external view returns (uint256) {
		return vestaParams.VST_GAS_COMPENSATION(_asset);
	}

	function getCompositeDebt(address _asset, uint256 _debt) external view returns (uint256) {
		return _getCompositeDebt(_asset, _debt);
	}

	function unprotectedDecayBaseRateFromBorrowing(address _asset) external returns (uint256) {
		baseRate[_asset] = _calcDecayedBaseRate(_asset);
		assert(baseRate[_asset] >= 0 && baseRate[_asset] <= DECIMAL_PRECISION);

		_updateLastFeeOpTime(_asset);
		return baseRate[_asset];
	}

	function minutesPassedSinceLastFeeOp(address _asset) external view returns (uint256) {
		return _minutesPassedSinceLastFeeOp(_asset);
	}

	function setLastFeeOpTimeToNow(address _asset) external {
		lastFeeOperationTime[_asset] = block.timestamp;
	}

	function setBaseRate(address _asset, uint256 _baseRate) external {
		baseRate[_asset] = _baseRate;
	}

	function callGetRedemptionFee(address _asset, uint256 _ETHDrawn)
		external
		view
		returns (uint256)
	{
		return _getRedemptionFee(_asset, _ETHDrawn);
	}

	function getActualDebtFromComposite(address _asset, uint256 _debtVal)
		external
		view
		returns (uint256)
	{
		return _getNetDebt(_asset, _debtVal);
	}

	function callInternalRemoveTroveOwner(address _asset, address _troveOwner) external {
		uint256 troveOwnersArrayLength = TroveOwners[_asset].length;
		_removeTroveOwner(_asset, _troveOwner, troveOwnersArrayLength);
	}
}
