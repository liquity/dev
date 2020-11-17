// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface ILQTYStaking {

    function setGrowthTokenAddress(address _growthTokenAddress) external;

    function setCLVTokenAddress(address _clvTokenAddress) external;

    function setCDPManagerAddress(address _cdpManagerAddress) external;

    function setBorrowerOperationsAddress(address _borrowerOperationsAddress) external;

    function setActivePoolAddress(address _activePoolAddress) external;

    function stake(uint _LQTYamount) external;

    function unstake(uint _LQTYamount) external;

    function increaseF_ETH(uint _ETHFee) external; 

    function increaseF_LUSD(uint _LQTYFee) external;  

    function getPendingETHGain(address _user) external view returns (uint);

    function getPendingLUSDGain(address _user) external view returns (uint);
}
