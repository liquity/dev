// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../TroveManager.sol";


contract TroveManagerNoBootstrap is TroveManager {
    function _requireAfterBootstrapPeriod() internal view override {}
}
