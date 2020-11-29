// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;


contract NonPayable {
    function forward(address _dest, bytes calldata _data) external payable {
        (bool success, ) = _dest.call{ value: msg.value }(_data);
        require(success, "NonPayable: forwarding failed");
    }

    receive() external payable {
        revert();
    }
}
