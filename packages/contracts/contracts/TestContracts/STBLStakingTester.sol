// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../STBL/STBLStaking.sol";


contract STBLStakingTester is STBLStaking {
    function requireCallerIsTroveManager() external view {
        _requireCallerIsTroveManager();
    }
}
