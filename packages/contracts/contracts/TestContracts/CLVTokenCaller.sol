// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/ILUSDToken.sol";

contract LUSDTokenCaller {
    ILUSDToken LUSD;

    function setLUSD(ILUSDToken _LUSD) external {
        LUSD = _LUSD;
    }

    function clvMint(address _account, uint _amount) external {
        LUSD.mint(_account, _amount);
    }

    function clvBurn(address _account, uint _amount) external {
        LUSD.burn(_account, _amount);
    }

    function clvSendToPool(address _sender,  address _poolAddress, uint256 _amount) external {
        LUSD.sendToPool(_sender, _poolAddress, _amount);
    }

    function clvReturnFromPool(address _poolAddress, address _receiver, uint256 _amount ) external {
        LUSD.returnFromPool(_poolAddress, _receiver, _amount);
    }
}
