pragma solidity 0.5.16;
import "../GT/CommunityIssuance.sol";

// Mock CommunityIssuance contract that allows EOAs to arbitrarily withdraw GT, for testing purposes
contract MockCommunityIssuance is CommunityIssuance {
    function obtainGT(uint _amount) external {
        growthToken.transfer(msg.sender, _amount);
    }
}