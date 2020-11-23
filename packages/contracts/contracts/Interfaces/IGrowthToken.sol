// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/IERC20.sol";

interface IGrowthToken is IERC20 { 
   
    // --- Events ---
    
    event CommunityIssuanceAddressSet(address _communityIssuanceAddress);

    event LQTYStakingAddressSet(address _lqtyStakingAddress);
    
    event LockupContractFactoryAddressSet(address _lockupContractFactoryAddress);

    // --- Functions ---
    
    function sendToLQTYStaking(address _sender, uint256 _amount) external;
}
