// SPDX-License-Identifier: MIT
// Adapted from https://github.com/DecenterApps/defisaver-contracts/

pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import "../Dependencies/DappSys/DSProxy.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/IStabilityPool.sol";
import "./Subscriptions.sol";

contract SaverProxy {

    address immutable borrowerOperationsAddress;
    address immutable borrowerOperationsAddress;
    
    constructor (address _borrowerOperationsAddress) public {  
        borrowerOperationsAddress = _borrowerOperationsAddress;        
    }

    function open(uint _amt) external payable {
        IBorrowerOperations(borrowerOperationsAddress).openTrove{value: msg.value}(_amt, msg.sender);
    }

    function repay(Subscriptions.TroveOwner memory _params, uint _ICR, uint _gasCost) public payable {
        address payable user = payable(getUserAddress());

        // determine how much debt to sell to recover collateralization to be above minimum
        // _ICR target min coll ratio of user (e.g. 1.5)
    
        uint d = // user's debt
        uint c = // user's coll
        uint n = d.mul(_ICR).sub(c).div(_ICR + 1)
	}

    /// @notice Returns the owner of the DSProxy that called the contract
    function getUserAddress() internal view returns (address) {
        DSProxy proxy = DSProxy(payable(address(this)));

        return proxy.owner();
    }

}
