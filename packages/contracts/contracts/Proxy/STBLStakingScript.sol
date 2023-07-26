// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Dependencies/CheckContract.sol";
import "../Interfaces/ISTBLStaking.sol";


contract STBLStakingScript is CheckContract {
    ISTBLStaking immutable STBLStaking;

    constructor(address _stblStakingAddress) {
        checkContract(_stblStakingAddress);
        STBLStaking = ISTBLStaking(_stblStakingAddress);
    }

    function stake(uint256 _STBLamount) external {
        STBLStaking.stake(_STBLamount);
    }
}
