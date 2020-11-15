// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

// Common interface for the ETH/CLV pools.
interface IPoolManager {
     // --- Events ---

   event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event CDPManagerAddressChanged(address _newCDPManagerAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event CLVTokenAddressChanged(address _newCLVTokenAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    event FrontEndRegistered(address indexed _frontEnd, uint _kickbackRate);
    event DepositSnapshotUpdated(address indexed _depositor, uint _P, uint _S, uint _G);
    event FrontEndSnapshotUpdated(address indexed _frontEnd, uint _P, uint _G);
    event P_Updated(uint _P);
    event S_Updated(uint _S);
    event G_Updated(uint _G);
    event UserDepositChanged(address indexed _depositor, uint _newDeposit);
    event FrontEndStakeChanged(address indexed _frontEnd, uint _newFrontEndStake, address _depositor);
    event ETHGainWithdrawn(address indexed _depositor, uint _ETH, uint _CLVLoss);
    event LQTYPaidToDepositor(address indexed _depositor, uint _LQTY);
    event LQTYPaidToFrontEnd(address indexed _frontEnd, uint _LQTY);

    // --- Functions ---
    function setAddresses(
        address _borrowerOperationsAddress,
        address _cdpManagerAddress,
        address _priceFeedAddress,
        address _CLVAddress,
        address _stabilityPoolAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _communityIssuanceAddress
    ) external;

    function getActiveDebt() external view returns (uint);

    function getActiveColl() external view returns (uint);

    function getClosedDebt() external view returns (uint);

    function getLiquidatedColl() external view returns (uint);

    function getStabilityPoolCLV() external view returns (uint);

    function getDepositorETHGain(address _user) external view returns (uint);

    function getDepositorLQTYGain(address _depositor) external view returns (uint);

    function getFrontEndLQTYGain(address _frontEnd) external view returns (uint);

    function getCompoundedCLVDeposit(address _depositor) external view returns (uint);

    function getCompoundedFrontEndStake(address _frontEnd) external view returns (uint);

    function addColl() external payable;

    function getFrontEndTag(address _depositor) external view returns (address);

    function withdrawColl(address _account, uint _ETH) external;

    function withdrawCLV(address _account, uint _CLVAmount, uint _CLVFee) external;

    function repayCLV(address _account, uint _CLV) external;

    function lockCLVGasCompensation(uint _CLVGasComp) external;

    function refundCLVGasCompensation(uint _CLVGasComp) external;

    function sendGasCompensation(address _user, uint _CLV, uint _ETH) external;

    function liquidate(uint _CLV, uint _ETH) external;

    function movePendingTroveRewardsToActivePool(uint _CLV, uint _ETH) external;

    function redeemCollateral(address _account, uint _CLV, uint _ETH) external;

    function redeemCloseLoan(address _account, uint _CLV, uint _ETH) external;

    // --- StabilityPool Functions ---

    function provideToSP(uint _amount, address _frontEndTag) external;

    function withdrawFromSP(uint _amount) external;

    function withdrawETHGainToTrove(address _hint) external;

    function registerFrontEnd(uint _kickbackRate) external;

    function offset(uint _debt, uint _coll) external payable;
}
