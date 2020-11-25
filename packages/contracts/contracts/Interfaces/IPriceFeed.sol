// SPDX-License-Identifier: MIT

import "../Dependencies/IPriceFeedBase.sol";

pragma solidity 0.6.11;

interface IPriceFeed is IPriceFeedBase {

    function getLatestAnswerID() external view returns (uint256);

    function getLatestTimestamp() external view returns (uint256);
}
