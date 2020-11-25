// SPDX-License-Identifier: MIT

import "../Dependencies/IPriceFeedBase.sol";

pragma solidity 0.6.11;

interface IPriceFeedTestnet is IPriceFeedBase {
    
    function setPrice(uint _price) external returns (bool);

    function getLatestTimestamp() external view returns (uint256);

    function getPreviousPrice(uint256 _n) external view returns (uint256);

    function getPreviousTimestamp(uint256 _n) external view returns (uint256);
}
