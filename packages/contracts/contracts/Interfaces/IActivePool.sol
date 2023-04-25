// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./IPool.sol";


interface IActivePool is IPool {
    // --- Events ---
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePool1USDDebtUpdated(uint _1USDDebt);
    event ActivePoolONEBalanceUpdated(uint _ONE);

    // --- Functions ---
    function sendONE(address _account, uint _amount) external;
}
