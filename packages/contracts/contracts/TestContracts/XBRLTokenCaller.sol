// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Interfaces/IXBRLToken.sol";

contract XBRLTokenCaller {
    IXBRLToken XBRL;

    function setXBRL(IXBRLToken _XBRL) external {
        XBRL = _XBRL;
    }

    function xbrlMint(address _account, uint256 _amount) external {
        XBRL.mint(_account, _amount);
    }

    function xbrlBurn(address _account, uint256 _amount) external {
        XBRL.burn(_account, _amount);
    }

    function xbrlSendToPool(address _sender,  address _poolAddress, uint256 _amount) external {
        XBRL.sendToPool(_sender, _poolAddress, _amount);
    }

    function xbrlReturnFromPool(address _poolAddress, address _receiver, uint256 _amount ) external {
        XBRL.returnFromPool(_poolAddress, _receiver, _amount);
    }
}
