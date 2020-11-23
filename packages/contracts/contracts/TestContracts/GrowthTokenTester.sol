// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../GT/GrowthToken.sol";

contract GrowthTokenTester is GrowthToken {
    constructor
    (
        address _communityIssuanceAddress, 
        address _lqtyStakingAddress, 
        address _lockupFactoryAddress
    ) 
        public 
        GrowthToken 
    (
        _communityIssuanceAddress,
        _lqtyStakingAddress,
        _lockupFactoryAddress
    )
    {} 

    function unprotectedSendToLQTYStaking(address _sender, uint256 _amount) external {
        // Don't require caller is LQTYStaking here
        
        if (_isFirstYear()) {_requireSenderIsNotDeployer(_sender);}
        _transfer(_sender, lqtyStakingAddress, _amount);
    }
}