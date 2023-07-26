// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../STBL/STBLToken.sol";

contract STBLTokenTester is STBLToken {
    constructor
    (
        address _communityIssuanceAddress, 
        address _stblStakingAddress,
        address _lockupFactoryAddress,
        address _bountyAddress,
        address _xbrlWethLpRewardsAddress,
        address _xbrlStblLpRewardsAddress,
        address _momentZeroMultisigAddress,
        address _sixMonthsMultisigAddress,
        address _oneYearMultisigAddress
    )  
        STBLToken 
    (
        _communityIssuanceAddress,
        _stblStakingAddress,
        _lockupFactoryAddress,
        _bountyAddress,
        _xbrlWethLpRewardsAddress,
        _xbrlStblLpRewardsAddress,
        _momentZeroMultisigAddress,
        _sixMonthsMultisigAddress,
        _oneYearMultisigAddress
    )
    {} 

    function unprotectedMint(address account, uint256 amount) external {
        // No check for the caller here

        _mint(account, amount);
    }

    function unprotectedSendToSTBLStaking(address _sender, uint256 _amount) external {
        // No check for the caller here
        
        if (_isFirstSixMonths()) {_requireSenderIsNotSixMonthsMultisig(_sender);}
        if (_isFirstYear()) {_requireSenderIsNotOneYearMultisig(_sender);}
        _transfer(_sender, stblStakingAddress, _amount);
    }

    function callInternalApprove(address owner, address spender, uint256 amount) external {
        _approve(owner, spender, amount);
    }

    function callInternalTransfer(address sender, address recipient, uint256 amount) external {
        _transfer(sender, recipient, amount);
    }

    function getChainId() external view returns (uint256 chainID) {
        //return _chainID(); // it’s private
        assembly {
            chainID := chainid()
        }
    }
}