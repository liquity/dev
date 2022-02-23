// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "../Dependencies/CheckContract.sol";
import "../Interfaces/IVSTAStaking.sol";

contract VSTAStakingScript is CheckContract {
	IVSTAStaking immutable vstaStaking;

	constructor(address _VSTAStakingAddress) {
		checkContract(_VSTAStakingAddress);
		vstaStaking = IVSTAStaking(_VSTAStakingAddress);
	}

	function stake(uint256 _VSTAamount) external {
		vstaStaking.stake(_VSTAamount);
	}
}
