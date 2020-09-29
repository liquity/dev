pragma solidity >=0.5.16;

// Common interface for the CDP Manager.
interface IBorrowerOperations {

    // --- Events ---

    event CDPManagerAddressChanged(address _newCDPManagerAddress);

    event PoolManagerAddressChanged(address _newPoolManagerAddress);

    event ActivePoolAddressChanged(address _activePoolAddress);

    event DefaultPoolAddressChanged(address _defaultPoolAddress);

    event PriceFeedAddressChanged(address  _newPriceFeedAddress);
    
    event SortedCDPsAddressChanged(address _sortedCDPsAddress);

    // --- Functions ---

    function setCDPManager(address _CDPManagerAddress) external;

    function setPoolManager(address _poolManagerAddress) external;

     function setActivePool(address _activePoolAddress) external; 

    function setDefaultPool(address _defaultPoolAddress) external;

    function setPriceFeed(address _priceFeedAddress) external;

    function setSortedCDPs(address _sortedCDPsAddress) external;

    function setGTStaking(address _gtStakingAddress) external;

    function openLoan(uint _CLVAmount, address _hint) external payable;

    function addColl(address _user, address _hint) external payable;

    function withdrawColl(uint _amount, address _hint) external;

    function withdrawCLV(uint _amount, address _hint) external;

    function repayCLV(uint _amount, address _hint) external;

    function closeLoan() external;

    function adjustLoan(uint _collWithdrawal, uint _debtChange, bool isDebtIncrease, address _hint) external payable;

    function getCompositeDebt(uint _debt) external pure returns (uint);
}