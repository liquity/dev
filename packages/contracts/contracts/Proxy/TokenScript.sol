// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Dependencies/CheckContract.sol";
import "../Dependencies/IERC20.sol";


contract TokenScript is CheckContract {
    string constant public NAME = "TokenScript";

    IERC20 immutable token;

    constructor(address _tokenAddress) {
        checkContract(_tokenAddress);
        token = IERC20(_tokenAddress);
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
       return token.transfer(recipient, amount);
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return token.allowance(owner, spender);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        return token.approve(spender, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        return token.transferFrom(sender, recipient, amount);
    }

    function increaseAllowance(address spender, uint256 addedValue) external returns (bool) {
        return token.increaseAllowance(spender, addedValue);
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
        return token.decreaseAllowance(spender, subtractedValue);
    }
}
