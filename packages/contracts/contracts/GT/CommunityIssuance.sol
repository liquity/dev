pragma solidity 0.5.16;
import "../Interfaces/IGrowthToken.sol";

//TODO: Decide upon and implement GT community issuance schedule.
contract CommunityIssuance {

    // --- Data ---

    address communityIssuanceDeployer;

    address public growthTokenAddress;
    IGrowthToken growthToken;

    // --- Events ---

    event GrowthTokenAddressSet(address _growthTokenAddress);

    // --- Modifiers ---

    modifier onlyCommunityIssuanceDeployer() {
        require(msg.sender == communityIssuanceDeployer, "GTStaking: caller is not deployer");
        _;
    }

    // --- Functions ---

    constructor() public {
        communityIssuanceDeployer = msg.sender;
    }

    function setGrowthTokenAddress(address _growthTokenAddress) external onlyCommunityIssuanceDeployer {
        growthTokenAddress = _growthTokenAddress;
        growthToken = IGrowthToken(growthTokenAddress);
        emit GrowthTokenAddressSet(_growthTokenAddress);
    }
}