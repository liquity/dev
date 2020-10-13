pragma solidity 0.5.16;
import "../Interfaces/IGrowthToken.sol";
import "../Dependencies/Math.sol";
import "../Dependencies/SafeMath.sol";

//TODO: Decide upon and implement GT community issuance schedule.
contract CommunityIssuance {
    using SafeMath for uint;

    // --- Data ---

    // Determines the curvature of the issuance curve
    uint constant public ISSUANCE_FACTOR = 2e18; 
    
    address public communityIssuanceDeployer;

    address public growthTokenAddress;
    IGrowthToken growthToken;

    address public poolManagerAddress;

    uint public supplyCap;

    uint public totalLQTYIssued;
    uint public deploymentTime;

    bool active;

    // --- Events ---

    event GrowthTokenAddressSet(address _growthTokenAddress);
    event PoolManagerAddressSet(address _poolManagerAddress);

    // --- Functions ---

    constructor() public {
        communityIssuanceDeployer = msg.sender;
    }

    function setGrowthTokenAddress(address _growthTokenAddress) external {
        _requireCallerIsCommunityIssuanceDeployer();
        _requireContractIsNotActive();
        
        growthTokenAddress = _growthTokenAddress;
        growthToken = IGrowthToken(growthTokenAddress);
        emit GrowthTokenAddressSet(_growthTokenAddress);
    }

    function setPoolManagerAddress(address _poolManagerAddress) external {
        _requireCallerIsCommunityIssuanceDeployer();
        _requireContractIsNotActive();
        
        poolManagerAddress = _poolManagerAddress;
        emit PoolManagerAddressSet(_poolManagerAddress);
    }

    function activateContract() external {
        _requireCallerIsCommunityIssuanceDeployer();
        _requireContractIsNotActive();

        // The community LQTY supply cap is the starting balance of the Community Issuance contract
        supplyCap = growthToken.balanceOf(address(this));
        active = true;
    }

    function issueLQTY() external returns (uint) {
        // check caller is PM
        _requireCallerIsPoolManager();
        _requireContractIsActive();

        uint latestTotalLQTYIssued = supplyCap.mul(_getCumulativeIssuanceFraction());
        uint issuance = latestTotalLQTYIssued.sub(totalLQTYIssued);
        
        totalLQTYIssued = latestTotalLQTYIssued;
        return issuance;
    }

    /* Get 1-f^(-t).
    f: issuance factor that determines the shape of the curve
    t:  time passed since last LQTY issuance event 
    */
    function _getCumulativeIssuanceFraction() internal view returns (uint) {
        uint timePassed = block.timestamp.sub(deploymentTime);

        // f^(-t)
        uint power = Math._decPow(ISSUANCE_FACTOR, timePassed);

        // 1-(1/(f^-t))
        return (uint(1e18).sub(uint(1e18).div(power)));
    } 

    function sendLQTY(address _account, uint _LQTYamount) external returns (uint) {
        _requireCallerIsPoolManager();
        _requireContractIsActive();

        growthToken.transfer(_account, _LQTYamount);
    }

    // --- 'require' functions ---

    function _requireCallerIsCommunityIssuanceDeployer() internal view {
        require(msg.sender == communityIssuanceDeployer, "CommunityIssuance: caller is not deployer");
    }

    function _requireCallerIsPoolManager() internal view {
        require(msg.sender == poolManagerAddress, "CommunityIssuance: caller is not PM");
    }

    function _requireContractIsActive() internal view {
        require(active == true, "CDLC: Contract must be inactive");
    }

    function _requireContractIsNotActive() internal view {
        require(active == false, "CDLC: Contract must not be active");
    }
}