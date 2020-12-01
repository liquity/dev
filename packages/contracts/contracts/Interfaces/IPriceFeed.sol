// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface IPriceFeed {
    
    function setAddresses(
        address _priceAggregatorAddress
    ) external;

    function getPrice() external view returns (uint);
}
