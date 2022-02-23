// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "../Interfaces/IVSTToken.sol";

contract VSTTokenCaller {
	IVSTToken VST;

	function setVST(IVSTToken _VST) external {
		VST = _VST;
	}

	function VSTMint(
		address _asset,
		address _account,
		uint256 _amount
	) external {
		VST.mint(_asset, _account, _amount);
	}

	function VSTBurn(address _account, uint256 _amount) external {
		VST.burn(_account, _amount);
	}

	function VSTSendToPool(
		address _sender,
		address _poolAddress,
		uint256 _amount
	) external {
		VST.sendToPool(_sender, _poolAddress, _amount);
	}

	function VSTReturnFromPool(
		address _poolAddress,
		address _receiver,
		uint256 _amount
	) external {
		VST.returnFromPool(_poolAddress, _receiver, _amount);
	}
}
