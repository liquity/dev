// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../CLVToken.sol";

contract CLVTokenTester is CLVToken {
    function unprotectedMint(address _account, uint256 _amount) external {
        _mint(_account, _amount);
    }
}
