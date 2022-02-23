// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "../VSTToken.sol";

contract VSTTokenTester is VSTToken {
	constructor(
		address _troveManagerAddress,
		address _stabilityPoolAddress,
		address _borrowerOperationsAddress
	) VSTToken(_troveManagerAddress, _stabilityPoolAddress, _borrowerOperationsAddress) {
		_burn(msg.sender, balanceOf(msg.sender));
	}

	function unprotectedMint(address _account, uint256 _amount) external {
		// No check on caller here

		_mint(_account, _amount);
	}

	function unprotectedBurn(address _account, uint256 _amount) external {
		// No check on caller here

		_burn(_account, _amount);
	}

	function unprotectedSendToPool(
		address _sender,
		address _poolAddress,
		uint256 _amount
	) external {
		// No check on caller here

		_transfer(_sender, _poolAddress, _amount);
	}

	function unprotectedReturnFromPool(
		address _poolAddress,
		address _receiver,
		uint256 _amount
	) external {
		// No check on caller here

		_transfer(_poolAddress, _receiver, _amount);
	}

	function callInternalApprove(
		address owner,
		address spender,
		uint256 amount
	) external {
		_approve(owner, spender, amount);
	}

	function getChainId() external view returns (uint256 chainID) {
		assembly {
			chainID := chainid()
		}
	}

	function getDigest(
		address owner,
		address spender,
		uint256 amount,
		uint256 nonce,
		uint256 deadline
	) external view returns (bytes32) {
		return
			keccak256(
				abi.encodePacked(
					uint16(0x1901),
					DOMAIN_SEPARATOR,
					keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, amount, nonce, deadline))
				)
			);
	}

	function recoverAddress(
		bytes32 digest,
		uint8 v,
		bytes32 r,
		bytes32 s
	) external pure returns (address) {
		return ecrecover(digest, v, r, s);
	}
}
