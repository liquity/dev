// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../CLVToken.sol";

contract CLVTokenTester is CLVToken {

    constructor( 
        address _cdpManagerAddress,
        address _stabilityPoolAddress,
        address _borrowerOperationsAddress
    ) public CLVToken(_cdpManagerAddress,
                      _stabilityPoolAddress,
                      _borrowerOperationsAddress) {}

    function unprotectedMint(address _account, uint256 _amount) external {
        _mint(_account, _amount);
    }
}
