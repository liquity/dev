// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/IERC20.sol";
import "../Dependencies/IERC2612.sol";

interface ICLVToken is IERC20, IERC2612 { 
    
    // --- Events ---
    event CDPManagerAddressChanged(address _cdpManagerAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);

    event CLVTokenBalanceUpdated(address _user, uint _amount);

    function mint(address _account, uint256 _amount) external;

    function burn(address _account, uint256 _amount) external;

    function sendToPool(address _sender,  address poolAddress, uint256 _amount) external;

    function returnFromPool(address poolAddress, address user, uint256 _amount ) external;
}
