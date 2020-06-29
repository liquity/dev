pragma solidity >=0.5.16;

interface IStabilityPool {
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
    
    function getCLV() external view returns (uint);

    function setPoolManagerAddress(address _poolManagerAddress) external;

    function setActivePoolAddress(address _activePoolAddress) external;

    function setDefaultPoolAddress(address _defaultPoolAddress) external;
    
    function sendETH(address _account, uint _amount) external;

    function increaseCLV(uint _amount) external;

    function decreaseCLV(uint _amount) external;

    function getRawETHBalance() external view returns (uint);
}