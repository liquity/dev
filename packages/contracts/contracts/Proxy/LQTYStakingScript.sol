// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/ILQTYStaking.sol";


contract LQTYStakingScript {
    ILQTYStaking immutable LQTYStaking;

    constructor(address _LQTYStakingAddress) public {
        LQTYStaking = ILQTYStaking(_LQTYStakingAddress);
    }
    function stake(uint _LQTYamount) external {
        LQTYStaking.stake(_LQTYamount);
    }
}
