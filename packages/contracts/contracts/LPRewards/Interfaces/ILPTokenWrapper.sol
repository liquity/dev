// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;


interface ILPTokenWrapper {
    function stake(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}
