// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface ILQTYStaking {

    // --- Events --

    event StakeChanged(address indexed staker, uint newStake);
    
    event StakingGainsWithdrawn(address indexed staker, uint LUSDGain, uint ETHGain);

    // --- Functions ---

    function setAddresses
    (
        address _lqtyTokenAddress,
        address _lusdTokenAddress,
        address _troveManagerAddress, 
        address _borrowerOperationsAddress,
        address _activePoolAddress
    )  external;

    function stake(uint _LQTYamount) external;

    function unstake(uint _LQTYamount) external;

    function increaseF_ETH(uint _ETHFee) external; 

    function increaseF_LUSD(uint _LQTYFee) external;  

    function getPendingETHGain(address _user) external view returns (uint);

    function getPendingLUSDGain(address _user) external view returns (uint);
}
