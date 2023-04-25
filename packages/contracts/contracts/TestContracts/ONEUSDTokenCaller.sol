// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/I1USDToken.sol";

contract ONEUSDTokenCaller {
    I1USDToken ONEUSD;

    function set1USD(I1USDToken _1USD) external {
        ONEUSD = _1USD;
    }

    function oneusdMint(address _account, uint _amount) external {
        ONEUSD.mint(_account, _amount);
    }

    function oneusdBurn(address _account, uint _amount) external {
        ONEUSD.burn(_account, _amount);
    }

    function oneusdSendToPool(address _sender,  address _poolAddress, uint256 _amount) external {
        ONEUSD.sendToPool(_sender, _poolAddress, _amount);
    }

    function oneusdReturnFromPool(address _poolAddress, address _receiver, uint256 _amount ) external {
        ONEUSD.returnFromPool(_poolAddress, _receiver, _amount);
    }
}
