// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

interface ISTBLStaking {

    // --- Events --
    
    event STBLTokenAddressSet(address _stblTokenAddress);
    event XBRLTokenAddressSet(address _xbrlTokenAddress);
    event TroveManagerAddressSet(address _troveManager);
    event BorrowerOperationsAddressSet(address _borrowerOperationsAddress);
    event ActivePoolAddressSet(address _activePoolAddress);

    event StakeChanged(address indexed staker, uint newStake);
    event StakingGainsWithdrawn(address indexed staker, uint XBRLGain, uint ETHGain);
    event F_ETHUpdated(uint _F_ETH);
    event F_XBRLUpdated(uint _F_XBRL);
    event TotalSTBLStakedUpdated(uint _totalSTBLStaked);
    event EtherSent(address _account, uint _amount);
    event StakerSnapshotsUpdated(address _staker, uint _F_ETH, uint _F_XBRL);

    // --- Functions ---

    function setAddresses
    (
        address _stblTokenAddress,
        address _xbrlTokenAddress,
        address _troveManagerAddress, 
        address _borrowerOperationsAddress,
        address _activePoolAddress
    )  external;

    function stake(uint _STBLamount) external;

    function unstake(uint _STBLamount) external;

    function increaseF_ETH(uint _ETHFee) external; 

    function increaseF_XBRL(uint _STBLFee) external;  

    function getPendingETHGain(address _user) external view returns (uint);

    function getPendingXBRLGain(address _user) external view returns (uint);
}
