// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "./IPool.sol";


interface IDefaultPool is IPool {
    // --- Events ---
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event DefaultPoolXBRLDebtUpdated(uint256 _XBRLDebt);
    event DefaultPoolETHBalanceUpdated(uint256 _ETH);

    // --- Functions ---
    function sendETHToActivePool(uint256 _amount) external;
}
