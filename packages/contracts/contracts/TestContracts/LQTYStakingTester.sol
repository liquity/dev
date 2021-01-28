// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../LQTY/LQTYStaking.sol";


contract LQTYStakingTester is LQTYStaking {
    function requireCallerIsTroveManager() external view {
        _requireCallerIsTroveManager();
    }
}
