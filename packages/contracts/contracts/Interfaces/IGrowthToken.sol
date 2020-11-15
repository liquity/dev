pragma solidity 0.6.11;
interface IGrowthToken { 
    // --- Events ---
    event CommunityIssuanceAddressSet(address _communityIssuanceAddress);

    event LockupContractFactoryAddressSet(address _lockupContractFactoryAddress);

    // --- Functions ---
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount) external returns (bool);

    function allowance(address owner, address spender) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    function increaseAllowance(address spender, uint256 addedValue) external returns (bool);

    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool);
}