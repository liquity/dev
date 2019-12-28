
pragma solidity ^0.5.11;

interface ICLVToken { 
    // --- Events ---
    event PoolManagerAddressChanged( address _newPoolManagerAddress);

    event CLVTokenBalanceUpdated(address _user, uint _amount);

    // --- Functions ---
    function setPoolManagerAddress(address _poolManagerAddress) external;

    function setName(bytes32 _name) external;

    function mint(address _account, uint256 _amount) external returns(bool);

    function burn(address _account, uint256 _amount) external returns(bool);

    function sendToPool(address _sender,  address poolAddress, uint256 _amount) external returns(bool);

    function returnFromPool(address poolAddress, address user, uint256 _amount ) external returns(bool);

    function totalSupply() external view returns(uint256);

    function balanceOf(address account) external view returns(uint256);

    function transfer(address recipient, uint256 amount) external returns(bool);

    function allowance(address owner, address spender) external view returns(uint256);

    function approve(address spender, uint256 amount) external returns(bool);

    function transferFrom(address sender, address recipient, uint256 amount) external returns(bool);

    function increaseAllowance(address spender, uint256 addedValue) external returns (bool);

    function decreaseAllowance(address spender, uint256 subtractedValue) external returns(bool);
}