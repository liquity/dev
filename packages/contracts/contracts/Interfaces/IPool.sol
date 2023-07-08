// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

// Common interface for the Pools.
interface IPool {
    
    // --- Events ---
    
    event ETHBalanceUpdated(uint256 _newBalance);
    event XBRLBalanceUpdated(uint256 _newBalance);
    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event EtherSent(address _to, uint256 _amount);

    // --- Functions ---
    
    function getETH() external view returns (uint);

    function getXBRLDebt() external view returns (uint);

    function increaseXBRLDebt(uint256 _amount) external;

    function decreaseXBRLDebt(uint256 _amount) external;
}
