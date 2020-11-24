// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;


interface ICollSurplusPool {
    event CollBalanceUpdated(address _account, uint _newBalance);
    event EtherSent(address _to, uint _amount);
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event CDPManagerAddressChanged(address _newCDPManagerAddress);
    event ActivePoolAddressChanged(address _newActivePoolAddress);

    // --- Contract setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _cdpManagerAddress,
        address _activePoolAddress
    ) external;

    function getETH() external view returns (uint);

    function getCollateral(address _account) external view returns (uint);

    function accountSurplus(address _account, uint _amount) external;

    function claimColl(address _account) external;

    function useCollateralToReopenTrove(address _account) external returns (uint);
}
