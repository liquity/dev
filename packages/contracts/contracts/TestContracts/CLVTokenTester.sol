// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../CLVToken.sol";

contract CLVTokenTester is CLVToken {

    constructor
    (
        address _borrowerOperationsAddress,
        address _cdpManagerAddress,
        address _stabilityPoolAddress
    ) 
        public 
        CLVToken 
    (
        _borrowerOperationsAddress,
        _cdpManagerAddress,
        _stabilityPoolAddress
    )
    {} 

    function unprotectedMint(address _account, uint256 _amount) external {
        _mint(_account, _amount);
    }

    function unprotectedBurn(address _account, uint _amount) external {
        _burn(_account, _amount);
    }

    function unprotectedSendToPool(address _sender,  address _poolAddress, uint256 _amount) external {
        // No caller requirement here

        _transfer(_sender, _poolAddress, _amount);
    }

    function unprotectedReturnFromPool(address _poolAddress, address _receiver, uint256 _amount ) external {
        // No caller requirement here

         _transfer(_poolAddress, _receiver, _amount);
    }
}
