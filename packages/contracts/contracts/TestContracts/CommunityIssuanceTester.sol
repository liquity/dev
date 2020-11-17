pragma solidity 0.6.11;
import "../GT/CommunityIssuance.sol";

// CommunityIssuance Tester
contract CommunityIssuanceTester is CommunityIssuance {
    function obtainGT(uint _amount) external {
        growthToken.transfer(msg.sender, _amount);
    }

    function setDeploymentTime() external {
        deploymentTime = block.timestamp;
    }

    function getCumulativeIssuanceFraction() external view returns (uint) {
       return _getCumulativeIssuanceFraction();
    }

    function unprotectedIssueLQTY() external returns (uint) {
        // No checks on caller address
       
        uint latestTotalLQTYIssued = LQTYSupplyCap.mul(_getCumulativeIssuanceFraction()).div(1e18);
        uint issuance = latestTotalLQTYIssued.sub(totalLQTYIssued);
      
        totalLQTYIssued = latestTotalLQTYIssued;
        return issuance;
    }
}