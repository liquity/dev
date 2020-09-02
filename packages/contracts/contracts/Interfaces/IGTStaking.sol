pragma solidity 0.5.16;

interface IGTStaking {

    function addETHFee() external payable; 

    function addLQTYFee(uint _LQTYFee) external;  
}