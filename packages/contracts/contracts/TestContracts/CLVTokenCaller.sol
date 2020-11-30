// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/ILUSDToken.sol";

contract LUSDTokenCaller {
    ILUSDToken LUSD;

    function setLUSD(ILUSDToken _LUSD) external {
        LUSD = _LUSD;
    }

    function lusdMint(address _account, uint _amount) external {
        LUSD.mint(_account, _amount);
    }

    function lusdBurn(address _account, uint _amount) external {
        LUSD.burn(_account, _amount);
    }

    function lusdSendToPool(address _sender,  address _poolAddress, uint256 _amount) external {
        LUSD.sendToPool(_sender, _poolAddress, _amount);
    }

    function lusdReturnFromPool(address _poolAddress, address _receiver, uint256 _amount ) external {
        LUSD.returnFromPool(_poolAddress, _receiver, _amount);
    }
}
