// SPDX-License-Identifier: MIT
// Adapted from https://github.com/DecenterApps/defisaver-contracts/

pragma solidity 0.6.11;

import "../Interfaces/ISubscription.sol";
import "../Dependencies/SafeMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/console.sol";

contract Subscriptions is Ownable, ISubscription {
    using SafeMath for uint256;

    event Subscribed(address indexed user);
    event Unsubscribed(address indexed user);
    event Updated(address indexed user);
    event ParamUpdates(address indexed user, uint128 minRatio);
    
    struct TroveOwner {
        address user;
        uint128 minRatio;
    }
    TroveOwner[] public subscribers;

    struct SubPosition {
        uint arrPos;
        bool subscribed;
    }
    mapping (address => SubPosition) public subscribersPos;

    /// @dev Returns subscribtion information about a user
    /// @param _user The actual address that owns the Trove
    /// @return Subscription information about the user if exists
    function getMinRatio(address _user) public view returns (uint) {
        SubPosition storage subInfo = subscribersPos[_user];
        TroveOwner storage trove = subscribers[subInfo.arrPos];
        return trove.minRatio;
    }

    /// @dev Checks if the user is subscribed
    /// @param _user The actual address that owns the Trove
    /// @return If the user is subscribed
    function isSubscribed(address _user) public view returns (bool) {
        SubPosition storage subInfo = subscribersPos[_user];
        return subInfo.subscribed;
    }

    /// @dev Called by the DSProxy contract which owns the Trove
    /// @notice Adds the users poistion in the list of subscriptions so it can be monitored
    /// @param _minRatio Minimum ratio below which repay is triggered
    function subscribe(uint128 _minRatio) external {
        SubPosition storage subInfo = subscribersPos[msg.sender];

        TroveOwner memory subscription = TroveOwner({
            user: msg.sender,
            minRatio: _minRatio
        });

         if (subInfo.subscribed) {
            subscribers[subInfo.arrPos] = subscription;

            emit Updated(msg.sender);
            emit ParamUpdates(msg.sender, _minRatio);
        } else {
            subscribers.push(subscription);
            
            subInfo.arrPos = subscribers.length.sub(1);
            subInfo.subscribed = true;

            emit Subscribed(msg.sender);
        }
    }

    /// @notice Called by the users DSProxy
    /// @dev Owner who subscribed cancels his subscription
    function unsubscribe() external {
        _unsubscribe(msg.sender);
    }

    /// @dev Internal method to remove a subscriber from the list
    /// @param _user The actual address that owns the Trove
    function _unsubscribe(address _user) internal {
        require(subscribers.length > 0, "Must have subscribers in the list");

        SubPosition storage subInfo = subscribersPos[_user];

        require(subInfo.subscribed, "Must first be subscribed");

        address lastOwner = subscribers[subscribers.length - 1].user;

        SubPosition storage subInfoLast = subscribersPos[lastOwner];
        subInfoLast.arrPos = subInfo.arrPos;

        subscribers[subInfo.arrPos] = subscribers[subscribers.length - 1];
        subscribers.pop(); // remove last element and reduce arr length

        subInfo.subscribed = false;
        subInfo.arrPos = 0;

        emit Unsubscribed(msg.sender);
    }
}
