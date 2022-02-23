// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "../Dependencies/CheckContract.sol";
import "../Interfaces/ITroveManager.sol";

contract TroveManagerScript is CheckContract {
	string public constant NAME = "TroveManagerScript";

	ITroveManager immutable troveManager;

	constructor(ITroveManager _troveManager) {
		checkContract(address(_troveManager));
		troveManager = _troveManager;
	}

	function redeemCollateral(
		address _asset,
		uint256 _VSTAmount,
		address _firstRedemptionHint,
		address _upperPartialRedemptionHint,
		address _lowerPartialRedemptionHint,
		uint256 _partialRedemptionHintNICR,
		uint256 _maxIterations,
		uint256 _maxFee
	) external {
		troveManager.redeemCollateral(
			_asset,
			_VSTAmount,
			_firstRedemptionHint,
			_upperPartialRedemptionHint,
			_lowerPartialRedemptionHint,
			_partialRedemptionHintNICR,
			_maxIterations,
			_maxFee
		);
	}
}
