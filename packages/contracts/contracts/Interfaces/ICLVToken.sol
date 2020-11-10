// SPDX-License-Identifier: MIT

pragma solidity >=0.5.16;

import "../Dependencies/IERC20.sol";

interface ICLVToken is IERC20 { 
    // --- Events ---
    event PoolManagerAddressChanged( address _newPoolManagerAddress);

    event CLVTokenBalanceUpdated(address _user, uint _amount);

    // --- Functions ---
    function setPoolManagerAddress(address _poolManagerAddress) external;

    function mint(address _account, uint256 _amount) external;

    function burn(address _account, uint256 _amount) external;

    function sendToPool(address _sender,  address poolAddress, uint256 _amount) external;

    function returnFromPool(address poolAddress, address user, uint256 _amount ) external;
}
