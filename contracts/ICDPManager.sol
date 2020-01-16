pragma solidity ^0.5.11;

// Common interface for the CDP Manager.
interface ICDPManager {
    // --- Events ---
    event PoolManagerAddressChanged(address _newPoolManagerAddress);

    event PriceFeedAddressChanged(address _newPriceFeedAddress);

    event CLVTokenAddressChanged(address _newCLVTokenAddress);

    event SortedCDPsAddressChanged(address _sortedCDPsAddress);

    event CDPCreated(address _user, uint arrayIndex);

    event CDPUpdated(address _user, uint _debt, uint _coll, uint stake, uint arrayIndex);

    event CDPClosed(address _user);

    event CollateralAdded(address _user, uint _amountAdded);

    event CollateralWithdrawn(address _user, uint _amountWithdrawn);

    event CLVWithdrawn(address _user, uint _amountWithdrawn);

    event CLVRepayed(address _user, uint _amountRepayed);

    event CollateralRedeemed(address _user, uint exchangedCLV, uint redeemedETH);

    // --- Functions ---
    function setPoolManager(address _poolManagerAddress) external;

    function setPriceFeed(address _priceFeedAddress) external;

    function setCLVToken(address _clvTokenAddress) external;

    function setSortedCDPs(address _sortedCDPsAddress) external;

    function getMCR() external pure returns(uint);

    function getAccurateMulDiv(uint _x, uint _y, uint _z) external pure returns(uint);

    function sortedCDPsContains(address _id) external view returns(bool);

    function sortedCDPsIsEmpty() external view returns(bool);

    function sortedCDPsIsFull() external view returns (bool);

    function sortedCDPsgetSize() external view returns(uint);

    function sortedCDPsGetMaxSize() external view returns(uint);

    function sortedCDPsGetFirst() external view returns (address); 

    function sortedCDPsGetLast() external view returns (address); 

    function sortedCDPsGetNext(address user) external view returns (address); 

    function sortedCDPsGetPrev(address user) external view returns (address); 

    function getCollRatio(address _user) external view returns(uint);

    function getApproxHint(uint CR, uint numTrials) external view returns(address);

    function userCreateCDP() external returns(bool);

    function addColl(address _user) external payable returns(bool);

    function withdrawColl(uint _amount) external returns(bool);

    function withdrawCLV(uint _amount) external returns(bool);

    function repayCLV(uint _amount) external returns(bool);

    function liquidate(address _user) external returns(bool);

    function liquidateCDPs(uint _n) external returns(bool);

    function mockAddCDP() external returns(bool);

    function redeemCollateral(uint _CLVAmount) external returns(bool);
}