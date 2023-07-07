// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../STBL/STBLStaking.sol";


contract STBLStakingTester is STBLStaking {
    function requireCallerIsTroveManager() external view {
        _requireCallerIsTroveManager();
    }
}
