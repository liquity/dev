// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "../Dependencies/CheckContract.sol";
import "../Interfaces/IStabilityPool.sol";

contract StabilityPoolScript is CheckContract {
	string public constant NAME = "StabilityPoolScript";

	IStabilityPool immutable stabilityPool;

	constructor(IStabilityPool _stabilityPool) {
		checkContract(address(_stabilityPool));
		stabilityPool = _stabilityPool;
	}

	function provideToSP(uint256 _amount) external {
		stabilityPool.provideToSP(_amount);
	}

	function withdrawFromSP(uint256 _amount) external {
		stabilityPool.withdrawFromSP(_amount);
	}

	function withdrawAssetGainToTrove(address _upperHint, address _lowerHint) external {
		stabilityPool.withdrawAssetGainToTrove(_upperHint, _lowerHint);
	}
}
