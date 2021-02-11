// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/IERC20.sol";


contract TokenScript {
    IERC20 immutable token;

    constructor(address _tokenAddress) public {
        token = IERC20(_tokenAddress);
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        token.transfer(recipient, amount);
    }
}
