// SPDX-License-Identifier: MIT

pragma solidity >=0.5.16;

interface IStabilityPool {
    // --- Events ---
    event ETHBalanceUpdated(uint _newBalance);

    event CLVBalanceUpdated(uint _newBalance);

    event PoolManagerAddressChanged(address _newPoolManagerAddress);

    event ActivePoolAddressChanged(address _newActivePoolAddress);

    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);

    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);

    event EtherSent(address _to, uint _amount);

    // --- Functions ---
    function getETH() external view returns (uint);
    
    function getTotalCLVDeposits() external view returns (uint);

    function setAddresses(
        address _borrowerOperationsAddress,
        address _poolManagerAddress,
        address _activePoolAddress
    ) external;

    function sendETH(address _account, uint _amount) external;

    function sendETHGainToTrove(address _depositor, uint _ETHGain, address _hint) external;

    function increaseCLV(uint _amount) external;

    function decreaseCLV(uint _amount) external;

    function getRawETHBalance() external view returns (uint);
}