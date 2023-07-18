// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Dependencies/IERC20.sol";
import "../Dependencies/IERC2612.sol";

interface IXBRLToken is IERC20, IERC2612 {

    // --- Events ---

    event TroveManagerAddressAdded(address _troveManagerAddress);
    event StabilityPoolAddressAdded(address _newStabilityPoolAddress);
    event BorrowerOperationsAddressAdded(address _newBorrowerOperationsAddress);

    event XBRLTokenBalanceUpdated(address _user, uint256 _amount);

    // --- Functions ---
    function mintList(address contractAddress) external view returns (bool);
    function burnList(address contractAddress) external view returns (bool);

    function mint(address _account, uint256 _amount) external;

    function burn(address _account, uint256 _amount) external;

    function increaseAllowance(address spender, uint256 addedValue) external returns (bool);

    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool);

    function sendToPool(address _sender,  address poolAddress, uint256 _amount) external;

    function returnFromPool(address poolAddress, address user, uint256 _amount ) external;
}
