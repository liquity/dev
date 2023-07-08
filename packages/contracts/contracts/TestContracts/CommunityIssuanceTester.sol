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
       
        uint latestTotalSTBLIssued = STBLSupplyCap.mul(_getCumulativeIssuanceFraction()).div(DECIMAL_PRECISION);
        uint issuance = latestTotalSTBLIssued.sub(totalSTBLIssued);
      
        totalSTBLIssued = latestTotalSTBLIssued;
        return issuance;
    }
}
