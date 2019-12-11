pragma solidity ^0.5.11;

// Common interface for the ETH/CLV pools.
interface IPool {
    
    // Events
    event ETHBalanceUpdated(uint _newBalance);

    event CLVBalanceUpdated(uint _newBalance);

    event PoolManagerAddressChanged(address _newAddress);

    event EtherSent(address _to, uint _amount);

    // Functions
    function getETH() external view returns(uint);
    
    function getCLV() external view returns(uint);
    
    function getPoolManagerAddress() external view returns(address);

    function setPoolManagerAddress(address _poolManagerAddress) external;

    function sendETH(address payable _account, uint _amount) external returns(bool);

    function increaseETH(uint _amount) external;

    function increaseCLV(uint _amount) external;

    function decreaseCLV(uint _amount) external;

    function getRawETHBalance() external view returns(uint);
}