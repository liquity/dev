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
    event CommunityIssuanceAddressChanged(address _newCommunityIssuanceAddress);

    event P_Updated(uint _P);
    event S_Updated(uint _S);
    event G_Updated(uint _G);

    event FrontEndRegistered(address indexed _frontEnd, uint _kickbackRate);

    event DepositSnapshotUpdated(address indexed _depositor, uint _P, uint _S, uint _G);
    event FrontEndSnapshotUpdated(address indexed _frontEnd, uint _P, uint _G);

    event UserDepositChanged(address indexed _depositor, uint _newDeposit);
    event FrontEndStakeChanged(address indexed _frontEnd, uint _newFrontEndStake, address _depositor);

    event ETHGainWithdrawn(address indexed _depositor, uint _ETH, uint _CLVLoss);
    event LQTYPaidToDepositor(address indexed _depositor, uint _LQTY);
    event LQTYPaidToFrontEnd(address indexed _frontEnd, uint _LQTY);

    event EtherSent(address _to, uint _amount);

    // --- Functions ---
    
    function setAddresses(
        address _borrowerOperationsAddress,
        address _cdpManagerAddress,
        address _activePoolAddress,
        address _clvTokenAddress,
        address _communityIssuanceAddress
    ) external;

    function provideToSP(uint _amount, address _frontEndTag) external;
    function withdrawFromSP(uint _amount) external;
    function withdrawETHGainToTrove(address _hint) external;

    function registerFrontEnd(uint _kickbackRate) external;

    function offset(uint _debt, uint _coll) external payable;

    function getETH() external view returns (uint);
    function getTotalCLVDeposits() external view returns (uint);

    function getDepositorETHGain(address _user) external view returns (uint);
    function getDepositorLQTYGain(address _depositor) external view returns (uint);
    function getFrontEndLQTYGain(address _frontEnd) external view returns (uint);

    function getCompoundedCLVDeposit(address _depositor) external view returns (uint);
    function getCompoundedFrontEndStake(address _frontEnd) external view returns (uint);
    function getFrontEndTag(address _depositor) external view returns (address);
}
