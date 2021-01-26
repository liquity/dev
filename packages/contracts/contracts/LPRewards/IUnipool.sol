// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;


interface IUnipool {
    function setAddresses(address _lqtyTokenAddress, address _uniTokenAddress) external;
    function lastTimeRewardApplicable() external view returns (uint256);
    function rewardPerToken() external view returns (uint256);
    function earned(address account) external view returns (uint256);
    function exit() external;
    function getReward() external;
    function notifyRewardAmount(uint256 reward) external;
}
