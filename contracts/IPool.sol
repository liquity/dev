pragma solidity ^0.5.11;

// Common interface for the ETH/CLV pools.
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
    function getETH() external view returns(uint);
    
    function getCLV() external view returns(uint);
    
    function getPoolManagerAddress() external view returns(address);
    
    function getActivePoolAddress() external view returns(address);

    function getStabilityPoolAddress() external view returns(address);

    function getDefaultPoolAddress() external view returns(address);

    function setPoolManagerAddress(address _poolManagerAddress) external;

    function setActivePoolAddress(address _activePoolAddress) external;

    function setStabilityPoolAddress(address _stabilityPoolAddress) external;

    function setDefaultPoolAddress(address _defaultPoolAddress) external;
    
    function sendETH(address payable _account, uint _amount) external returns(bool);

    function increaseCLV(uint _amount) external;

    function decreaseCLV(uint _amount) external;

    function getRawETHBalance() external view returns(uint);
}