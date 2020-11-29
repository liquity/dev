// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

// Common interface for the CDP Manager.
interface IBorrowerOperations {

    // --- Events ---

    event TroveManagerAddressChanged(address _newTroveManagerAddress);

    event ActivePoolAddressChanged(address _activePoolAddress);

    event DefaultPoolAddressChanged(address _defaultPoolAddress);

    event StabilityPoolAddressChanged(address _stabilityPoolAddress);

    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);

    event PriceFeedAddressChanged(address  _newPriceFeedAddress);

    event SortedCDPsAddressChanged(address _sortedCDPsAddress);

    event LUSDTokenAddressChanged(address _clvTokenAddress);

    event LQTYStakingAddressChanged(address _lqtyStakingAddress);

    event RedeemedCollateralClaimed(address indexed _user);

    // --- Functions ---

    function setAddresses(
        address _troveManagerAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
        address _collSurplusPoolAddress,
        address _priceFeedAddress,
        address _sortedCDPsAddress,
        address _clvTokenAddress,
        address _lqtyStakingAddress
    ) external;

    function openLoan(uint _CLVAmount, address _hint) external payable;

    function addColl(address _hint) external payable;

    function moveETHGainToTrove(address _user, address _hint) external payable;

    function withdrawColl(uint _amount, address _hint) external;

    function withdrawCLV(uint _amount, address _hint) external;

    function repayCLV(uint _amount, address _hint) external;

    function closeLoan() external;

    function adjustLoan(uint _collWithdrawal, uint _debtChange, bool isDebtIncrease, address _hint) external payable;

    function claimRedeemedCollateral(address _user) external;

    function getCompositeDebt(uint _debt) external pure returns (uint);
}
