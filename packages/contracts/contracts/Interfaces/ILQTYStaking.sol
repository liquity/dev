// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface ILQTYStaking {

    // --- Events --

    event StakeChanged(address indexed _staker, uint _newStake);
    
    event StakingGainsWithdrawn(address indexed _staker, uint _LUSDGain);

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

    function increaseF_LUSD(uint _LUSDFee) external;  

    function getPendingLUSDGain(address _user) external view returns (uint);
}
