// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

interface ISTBLStaking {

    // --- Events --
    
    event STBLTokenAddressSet(address _stblTokenAddress);
    event XBRLTokenAddressSet(address _xbrlTokenAddress);
    event TroveManagerAddressSet(address _troveManager);
    event BorrowerOperationsAddressSet(address _borrowerOperationsAddress);
    event ActivePoolAddressSet(address _activePoolAddress);

    event StakeChanged(address indexed staker, uint256 newStake);
    event StakingGainsWithdrawn(address indexed staker, uint256 XBRLGain, uint256 ETHGain);
    event F_ETHUpdated(uint256 _F_ETH);
    event F_XBRLUpdated(uint256 _F_XBRL);
    event TotalSTBLStakedUpdated(uint256 _totalSTBLStaked);
    event EtherSent(address _account, uint256 _amount);
    event StakerSnapshotsUpdated(address _staker, uint256 _F_ETH, uint256 _F_XBRL);

    // --- Functions ---

    function setAddresses
    (
        address _stblTokenAddress,
        address _xbrlTokenAddress,
        address _troveManagerAddress, 
        address _borrowerOperationsAddress,
        address _activePoolAddress
    )  external;

    function stake(uint256 _STBLamount) external;

    function unstake(uint256 _STBLamount) external;

    function increaseF_ETH(uint256 _ETHFee) external; 

    function increaseF_XBRL(uint256 _STBLFee) external;  

    function getPendingETHGain(address _user) external view returns (uint);

    function getPendingXBRLGain(address _user) external view returns (uint);
}
