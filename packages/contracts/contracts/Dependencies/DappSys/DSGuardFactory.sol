// SPDX-License-Identifier: GPL3
// Copyright (C) 2017  DappHub, LLC
// Adapted from https://github.com/dapphub/ds-guard/blob/master/src/guard.sol

pragma solidity 0.6.11;

import './DSGuard.sol';

contract DSGuardFactory {
    mapping (address => bool) public isGuard;

    function newGuard() public returns (DSGuard guard) {
        guard = new DSGuard();
        guard.setOwner(msg.sender);
        isGuard[address(guard)] = true;
    }
}
