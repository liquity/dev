// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface IStabilityPool {
    // --- Events ---
    event ETHBalanceUpdated(uint _newBalance);
    event CLVBalanceUpdated(uint _newBalance);

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event CDPManagerAddressChanged(address _newCDPManagerAddress);
    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    event CLVTokenAddressChanged(address _newCLVTokenAddress);

    event P_Updated(uint _P);
    event S_Updated(uint _S);

    event UserDepositChanged(address indexed _user, uint _amount);
    event UserSnapshotUpdated(uint _P, uint _S);
    event ETHGainWithdrawn(address indexed _user, uint _ETH, uint _CLVLoss);
    event EtherSent(address _to, uint _amount);

    // --- Functions ---
    function getETH() external view returns (uint);

    function getTotalCLVDeposits() external view returns (uint);

    function setAddresses(
        address _borrowerOperationsAddress,
        address _cdpManagerAddress,
        address _activePoolAddress,
        address _clvTokenAddress
    ) external;

    function sendETHGainToTrove(address _depositor, uint _ETHGain, address _hint) external;
    function provideToSP(uint _amount, address _frontEndTag) external;

    function withdrawFromSP(uint _amount) external;
    function withdrawETHGainToTrove(address _hint) external;

    function registerFrontEnd(uint _kickbackRate) external;

    function offset(uint _debt, uint _coll) external;
}
