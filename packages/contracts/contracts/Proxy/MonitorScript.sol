// SPDX-License-Identifier: MIT
// Adapted from https://github.com/DecenterApps/defisaver-contracts/

pragma solidity 0.6.11;

import "../Interfaces/DSProxyInterface.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/console.sol";
import "../Dependencies/IERC20.sol";

contract MonitorScript is Ownable {

    address public monitor;

    modifier onlyMonitor() {
        require (msg.sender == monitor);
        _;
    }

    /// @notice Only monitor contract is able to call execute on users proxy
    /// @param _owner Address of Trove owner (end user's DSProxy's address)
    /// @param _liquityScript Address of LiquityScript
    /// @param _data Data to send to LiquityScript
    function callExecute(address _owner, address _liquityScript, bytes memory _data) public payable onlyMonitor {
        // msg.sender here is the monitor contract address 

        // execute reverts if calling specific method fails
        DSProxyInterface(_owner).execute{value: msg.value}(_liquityScript, _data);

        // return if anything left
        if (address(this).balance > 0) {
            msg.sender.transfer(address(this).balance);
        }
    }

    /// @notice Allowed users are able to set Monitor contract without any waiting period first time
    /// @param _monitor Address of Monitor contract
    function setMonitor(address _monitor) public onlyOwner {
        require(monitor == address(0));
        monitor = _monitor;
    }

     /// @notice In case something is left in contract, owner is able to withdraw it
    /// @param _token address of token to withdraw balance
    function withdrawToken(address _token) public onlyOwner {
        uint balance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).transfer(msg.sender, balance);
    }

    /// @notice In case something is left in contract, owner is able to withdraw it
    function withdrawEth() public onlyOwner {
        uint balance = address(this).balance;
        msg.sender.transfer(balance);
    }
}
