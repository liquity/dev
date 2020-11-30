// SPDX-License-Identifier: MIT

import "../Dependencies/IPriceFeedTest.sol";

pragma solidity 0.6.11;

interface IPriceFeedTestnet is IPriceFeedTest {

    function getLatestTimestamp() external view returns (uint256);

    function getPreviousPrice(uint256 _n) external view returns (uint256);

    function getPreviousTimestamp(uint256 _n) external view returns (uint256);
}
