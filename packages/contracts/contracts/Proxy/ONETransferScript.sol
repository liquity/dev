// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;


contract ONETransferScript {
    function transferONE(address _recipient, uint256 _amount) external returns (bool) {
        (bool success, ) = _recipient.call{value: _amount}("");
        return success;
    }
}
