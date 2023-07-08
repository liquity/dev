// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "./IPool.sol";


interface IActivePool is IPool {
    // --- Events ---
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolXBRLDebtUpdated(uint _XBRLDebt);
    event ActivePoolETHBalanceUpdated(uint _ETH);

    // --- Functions ---
    function sendETH(address _account, uint256 _amount) external;
}
