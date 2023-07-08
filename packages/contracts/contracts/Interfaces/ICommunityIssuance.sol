// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

interface ICommunityIssuance { 
    
    // --- Events ---
    
    event STBLTokenAddressSet(address _stblTokenAddress);
    event StabilityPoolAddressSet(address _stabilityPoolAddress);
    event TotalSTBLIssuedUpdated(uint _totalSTBLIssued);

    // --- Functions ---

    function setAddresses(address _stblTokenAddress, address _stabilityPoolAddress) external;

    function issueSTBL() external returns (uint);

    function sendSTBL(address _account, uint _STBLamount) external;
}
