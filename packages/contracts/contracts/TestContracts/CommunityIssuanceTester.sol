// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../STBL/CommunityIssuance.sol";

contract CommunityIssuanceTester is CommunityIssuance {
    function obtainSTBL(uint _amount) external {
        stblToken.transfer(msg.sender, _amount);
    }

    function getCumulativeIssuanceFraction() external view returns (uint) {
       return _getCumulativeIssuanceFraction();
    }

    function unprotectedIssueSTBL() external returns (uint) {
        // No checks on caller address
       
        uint256 latestTotalSTBLIssued = STBLSupplyCap * _getCumulativeIssuanceFraction() / DECIMAL_PRECISION;
        uint256 issuance = latestTotalSTBLIssued - totalSTBLIssued;
      
        totalSTBLIssued = latestTotalSTBLIssued;
        return issuance;
    }
}
