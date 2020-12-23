// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./IPool.sol";


interface IDefaultPool is IPool {
    function sendETHToActivePool(uint _amount) external;
}
