pragma solidity 0.6.11;
import "../Interfaces/IGrowthToken.sol";
import "../Interfaces/ICommunityIssuance.sol";
import "../Dependencies/Math.sol";
import "../Dependencies/SafeMath.sol";

//TODO: Decide upon and implement GT community issuance schedule.
contract CommunityIssuance is ICommunityIssuance {
    using SafeMath for uint;

    // --- Data ---

    uint constant public SECONDS_IN_ONE_MINUTE = 60;
    
    /* The issuance factor determines the curvature of the issuance curve.
    
    Minutes in one year: 60*24*365 = 525600
   
    For 50% of remaining tokens issued each year, with minutes as time units, we have:
    
    F ** 525600 = 0.5

    Re-arranging:

    525600 * ln(F) = ln(0.5)
    F = 0.5 ** (1/525600)
    F = 0.999998681227695000 */
    uint constant public ISSUANCE_FACTOR = 999998681227695000;

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
        deploymentTime = block.timestamp;
    }

    function setGrowthTokenAddress(address _growthTokenAddress) external override {
        _requireCallerIsCommunityIssuanceDeployer();
        _requireContractIsNotActive();
        
        growthTokenAddress = _growthTokenAddress;
        growthToken = IGrowthToken(growthTokenAddress);
        emit GrowthTokenAddressSet(_growthTokenAddress);
    }

    function setPoolManagerAddress(address _poolManagerAddress) external override {
        _requireCallerIsCommunityIssuanceDeployer();
        _requireContractIsNotActive();
        
        poolManagerAddress = _poolManagerAddress;
        emit PoolManagerAddressSet(_poolManagerAddress);
    }

    function activateContract() external override {
        _requireCallerIsCommunityIssuanceDeployer();
        _requireContractIsNotActive();

        // The community LQTY supply cap is the starting balance of the Community Issuance contract
        supplyCap = growthToken.balanceOf(address(this));
        active = true;
    }

    function issueLQTY() external override returns (uint) {
        // check caller is PM
        _requireCallerIsPoolManager();
        _requireContractIsActive();

        uint latestTotalLQTYIssued = supplyCap.mul(_getCumulativeIssuanceFraction()).div(1e18);
        uint issuance = latestTotalLQTYIssued.sub(totalLQTYIssued);
      
        totalLQTYIssued = latestTotalLQTYIssued;
        return issuance;
    }

    /* Gets 1-f^t    where: f < 1

    f: issuance factor that determines the shape of the curve
    t:  time passed since last LQTY issuance event  */
    function _getCumulativeIssuanceFraction() internal view returns (uint) {
        // Get the time passed since deployment
        uint timePassedInMinutes = block.timestamp.sub(deploymentTime).div(SECONDS_IN_ONE_MINUTE);

        // f^t
        uint power = Math._decPow(ISSUANCE_FACTOR, timePassedInMinutes);

        //  (1 - f^t)
        uint cumulativeIssuanceFraction = (uint(1e18).sub(power));
        assert(cumulativeIssuanceFraction >= 0 && cumulativeIssuanceFraction <= 1e18);

        return cumulativeIssuanceFraction;
    } 

    function sendLQTY(address _account, uint _LQTYamount) external override {
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
        require(active == true, "CommunityIssuance: Contract must be active");
    }

    function _requireContractIsNotActive() internal view {
        require(active == false, "CommunityIssuance: Contract must not be active");
    }
}