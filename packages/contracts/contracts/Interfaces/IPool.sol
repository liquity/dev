pragma solidity >=0.5.16;

// Common interface for the Pools.
// @REVIEW: Most of the functions here are the same in all pools. Couldn’t they be in an inherited contract? Like `contract ActivePool is Pool` and `contract Pool is IPool`... If we have different modifiers, we could implement them in the base contract as internal functions and then use external wrappers with the modifiers in the final contracts.
interface IPool {
    // --- Events ---
    event ETHBalanceUpdated(uint _newBalance);

    event CLVBalanceUpdated(uint _newBalance);

    event PoolManagerAddressChanged(address _newAddress);

    event ActivePoolAddressChanged(address _newActivePoolAddress);

    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);

    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);

    event EtherSent(address _to, uint _amount);

    // --- Functions ---
    function getETH() external view returns (uint);
    
    function getCLVDebt() external view returns (uint);
    
    function sendETH(address _account, uint _amount) external;

    function increaseCLVDebt(uint _amount) external;

    function decreaseCLVDebt(uint _amount) external;

    function getRawETHBalance() external view returns (uint);
}