// SPDX-License-Identifier: MIT

import "../Dependencies/IPriceFeedBase.sol";

pragma solidity 0.6.11;

interface IPriceFeedTest is IPriceFeedBase {

    function setPrice(uint _price) external returns (bool);
    
}
