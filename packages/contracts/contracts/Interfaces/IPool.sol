// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

// Common interface for the Pools.
interface IPool {
    
    // --- Events ---
    
    event CollateralBalanceUpdated(uint _newBalance);
    event DebtBalanceUpdated(uint _newBalance);
    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event CollateralSent(address _to, uint _amount);

    // --- Functions ---
    
    function getCollateral() external view returns (uint);

    function getDebt() external view returns (uint);

    function increaseDebt(uint _amount) external;

    function decreaseDebt(uint _amount) external;
}
