pragma solidity 0.5.16;

interface IGTStaking {

    function addETHFee() external payable; 

    function addLUSDFee(uint _LQTYFee) external;  
}