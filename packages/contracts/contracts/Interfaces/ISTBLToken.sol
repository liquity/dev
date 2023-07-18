// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Dependencies/IERC20.sol";
import "../Dependencies/IERC2612.sol";

interface ISTBLToken is IERC20, IERC2612 { 
   
    // --- Events ---
    
    event CommunityIssuanceAddressSet(address _communityIssuanceAddress);
    event STBLStakingAddressSet(address _stblStakingAddress);
    event LockupContractFactoryAddressSet(address _lockupContractFactoryAddress);

    // --- Functions ---
    
    function sendToSTBLStaking(address _sender, uint256 _amount) external;

    function getDeploymentStartTime() external view returns (uint256);

    function getXbrlWethLpRewardsEntitlement() external view returns (uint256);

    function getStblWethLpRewardsEntitlement() external view returns (uint256);
}
