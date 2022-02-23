// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "../Dependencies/CheckContract.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract TokenScript is CheckContract {
	using SafeERC20Upgradeable for IERC20Upgradeable;
	string public constant NAME = "TokenScript";

	IERC20Upgradeable immutable token;

	constructor(address _tokenAddress) {
		checkContract(_tokenAddress);
		token = IERC20Upgradeable(_tokenAddress);
	}

	function transfer(address recipient, uint256 amount) external {
		token.transfer(recipient, amount);
	}

	function allowance(address owner, address spender) external view {
		token.allowance(owner, spender);
	}

	function approve(address spender, uint256 amount) external {
		token.approve(spender, amount);
	}

	function transferFrom(
		address sender,
		address recipient,
		uint256 amount
	) external {
		token.transferFrom(sender, recipient, amount);
	}

	function increaseAllowance(address spender, uint256 addedValue) external {
		token.safeIncreaseAllowance(spender, addedValue);
	}

	function decreaseAllowance(address spender, uint256 subtractedValue) external {
		token.safeDecreaseAllowance(spender, subtractedValue);
	}
}
