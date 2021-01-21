// SPDX-License-Identifier: MIT
// Adapted from https://github.com/DecenterApps/defisaver-contracts/

pragma solidity 0.6.11;

import "../Dependencies/DappSys/DSGuardFactory.sol";
import "../Dependencies/DappSys/DSGuard.sol";
import "../Dependencies/DappSys/DSAuth.sol";
import "../Interfaces/ISubscription.sol";

/// @title SubscriptionsScript handles authorization and interaction with the Subscriptions contract
contract SubscriptionScript {

    address public immutable FACTORY_ADDRESS;
    address public immutable LQTY_SUBSCRIPTIONS_ADDRESS;
    address public immutable LQTY_MONITOR_PROXY_ADDRESS;

    constructor(address factoryAddress, address subscriptionsAddress, address monitorProxyAddress) public {
        FACTORY_ADDRESS = factoryAddress;
        LQTY_SUBSCRIPTIONS_ADDRESS = subscriptionsAddress;
        LQTY_MONITOR_PROXY_ADDRESS = monitorProxyAddress;
    }

    /// @notice Called in the context of DSProxy to authorize an address
    /// @param _contractAddr Address which will be authorized
    function givePermission(address _contractAddr) public {
        address currAuthority = address(DSAuth(address(this)).authority());
        DSGuard guard = DSGuard(currAuthority);

        if (currAuthority == address(0)) {
            guard = DSGuardFactory(FACTORY_ADDRESS).newGuard();
            DSAuth(address(this)).setAuthority(DSAuthority(address(guard)));
        }

        guard.permit(_contractAddr, address(this), bytes4(keccak256("execute(address,bytes)")));
    }

    /// @notice Called in the context of DSProxy to remove authority of an address
    /// @param _contractAddr Auth address which will be removed from authority list
    function removePermission(address _contractAddr) public {
        address currAuthority = address(DSAuth(address(this)).authority());
        
        // if there is no authority, that means that contract doesn't have permission
        if (currAuthority == address(0)) {
            return;
        }

        DSGuard guard = DSGuard(currAuthority);
        guard.forbid(_contractAddr, address(this), bytes4(keccak256("execute(address,bytes)")));
    }

    function proxyOwner() internal view returns(address) {
        return DSAuth(address(this)).owner();
    } 

    /// @notice Calls subscription contract and creates a DSGuard if non existent
    /// @param _minRatio Minimum ratio below which repay is triggered
    function subscribe(uint _minRatio) public {
        givePermission(LQTY_MONITOR_PROXY_ADDRESS);
        ISubscription(LQTY_SUBSCRIPTIONS_ADDRESS).subscribe(_minRatio);
    }

    /// @notice Calls subscription contract and updated existing parameters
    /// @dev If subscription is non existent this will create one
    /// @param _minRatio Minimum ratio below which repay is triggered
    function update(uint _minRatio) public {
        ISubscription(LQTY_SUBSCRIPTIONS_ADDRESS).subscribe(_minRatio);
    }

    /// @notice Calls the subscription contract to unsubscribe the caller
    function unsubscribe() public {
        removePermission(LQTY_MONITOR_PROXY_ADDRESS);
        ISubscription(LQTY_SUBSCRIPTIONS_ADDRESS).unsubscribe();
    }
}
