// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./IPool.sol";


interface IActivePool is IPool {
    // --- Events ---
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolDebtUpdated(uint _Debt);
    event ActivePoolCollateralUpdated(uint _Collateral);

    // --- Functions ---
    function sendCollateral(address _account, uint _amount) external;
}
