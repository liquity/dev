    pragma solidity ^0.5.11;

// Common interface for the ETH/CLV pools.
interface ICDPManager {
    // --- Events ---
    event PoolManagerAddressChanged(address _newPoolManagerAddress);

    event PriceFeedAddressChanged(address _newPriceFeedAddress);

    event CLVTokenAddressChanged(address _newCLVTokenAddress);

    event CDPCreated(address _user);

    event CDPUpdated(address _user, uint _debt, uint _coll, uint ICR);

    event CDPClosed(address _user);

    event CollateralAdded(address _user, uint _amountAdded);

    event CollateralWithdrawn(address _user, uint _amountWithdrawn);

    event CLVWithdrawn(address _user, uint _amountWithdrawn);

    event CLVRepayed(address _user, uint _amountRepayed);

    event CollateralRedeemed(address _user, uint redeemedAmount);

    // --- Functions ---
    function setPoolManager(address _poolManagerAddress) external;

    function setPriceFeed(address _priceFeedAddress) external;

    function setCLVToken(address _clvTokenAddress) external;

    function getMCR() external pure returns(uint);

    function getAccurateMulDiv(uint _x, uint _y, uint _z) external pure returns(uint);

    function hasActiveCDP(address _user) external view returns(bool);

    function sortedCDPsContains(address _id) external view returns(bool);

    function sortedCDPsIsEmpty() external view returns(bool);

    function sortedCDPsIsFull() external view returns (bool);

    function sortedCDPsgetSize() external view returns(uint);

    function sortedCDPsGetMaxSize() external view returns(uint);
    
    function sortedCDPsGetKey(address user) external view returns(uint); 

    function sortedCDPsGetFirst() external view returns (address); 

    function sortedCDPsGetLast() external view returns (address); 

    function sortedCDPsGetNext(address user) external view returns (address); 

    function sortedCDPsGetPrev(address user) external view returns (address); 

    function getCollRatio(address _debtor) external view returns(uint);

    function userCreateCDP() external returns(bool);

    function addColl(address _owner) external payable returns(bool);

    function withdrawColl(uint _amount) external returns(bool);

    function withdrawCLV(uint _amount) external returns (bool);

    function repayCLV(uint _amount) external returns(bool);

    function close(address _debtor) external returns(bool);

    function closeCDPs(uint _n) external returns(bool);

    function mockAddCDP() external returns(bool);

    function obtainDefaultShare(address _user, uint _debtShare) external returns(bool);

    function redeemCollateral(uint _amount) external returns(bool);
}