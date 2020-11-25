// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../LQTY/GrowthToken.sol";

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

    function unprotectedMint(address account, uint256 amount) external {
        // No check for the caller here

        _mint(account, amount);
    }

    function unprotectedSendToLQTYStaking(address _sender, uint256 _amount) external {
        // No check for the caller here
        
        if (_isFirstYear()) {_requireSenderIsNotDeployer(_sender);}
        _transfer(_sender, lqtyStakingAddress, _amount);
    }
}