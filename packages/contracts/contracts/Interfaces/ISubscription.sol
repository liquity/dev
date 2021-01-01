// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

abstract contract ISubscription {
    function subscribe(uint128 _minRatio) public virtual;
    function unsubscribe() public virtual;
}
