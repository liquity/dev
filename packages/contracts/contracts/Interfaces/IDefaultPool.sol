// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./IPool.sol";


interface IDefaultPool is IPool {
    // --- Events ---
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event DefaultPoolDebtUpdated(uint _LUSDDebt);
    event DefaultPoolCollateralUpdated(uint _ETH);

    // --- Functions ---
    function sendCollateralToActivePool(uint _amount) external;
}
