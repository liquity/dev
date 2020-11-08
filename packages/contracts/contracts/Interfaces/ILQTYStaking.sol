pragma solidity 0.5.16;

interface ILQTYStaking {

    function setActivePoolAddress(address _activePoolAddress) external;

    function increaseF_ETH(uint _ETHFee) external; 

    function increaseF_LUSD(uint _LQTYFee) external;  
}