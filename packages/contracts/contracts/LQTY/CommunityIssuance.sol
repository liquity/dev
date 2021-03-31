// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/ILQTYToken.sol";
import "../Interfaces/ICommunityIssuance.sol";
import "../Dependencies/BaseMath.sol";
import "../Dependencies/LiquityMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/CheckContract.sol";
import "../Dependencies/SafeMath.sol";


contract CommunityIssuance is ICommunityIssuance, Ownable, CheckContract, BaseMath {
    using SafeMath for uint;

    // --- Data ---

    string constant public NAME = "CommunityIssuance";

    uint constant public SECONDS_IN_ONE_MINUTE = 60;

   /* The issuance factor F determines the curvature of the issuance curve.
    *
    * Minutes in one year: 60*24*365 = 525600
    *
    * For 50% of remaining tokens issued each year, with minutes as time units, we have:
    * 
    * F ** 525600 = 0.5
    * 
    * Re-arranging:
    * 
    * 525600 * ln(F) = ln(0.5)
    * F = 0.5 ** (1/525600)
    * F = 0.999998681227695000 
    */
    uint constant public ISSUANCE_FACTOR = 999998681227695000;

    /* 
    * The community LQTY supply cap is the starting balance of the Community Issuance contract.
    * It should be minted to this contract by LQTYToken, when the token is deployed.
    * 
    * Set to 32M (slightly less than 1/3) of total LQTY supply.
    */
    uint constant public LQTYSupplyCap = 32e24; // 32 million

    ILQTYToken public lqtyToken;

    address public stabilityPoolAddress;

    uint public totalLQTYIssued;
    uint public immutable deploymentTime;

    // --- Events ---

    event LQTYTokenAddressSet(address _lqtyTokenAddress);
    event StabilityPoolAddressSet(address _stabilityPoolAddress);
    event TotalLQTYIssuedUpdated(uint _totalLQTYIssued);

    // --- Functions ---

    constructor() public {
        deploymentTime = block.timestamp;
    }

    function setAddresses
    (
        address _lqtyTokenAddress, 
        address _stabilityPoolAddress
    ) 
        external 
        onlyOwner 
        override 
    {
        checkContract(_lqtyTokenAddress);
        checkContract(_stabilityPoolAddress);

        lqtyToken = ILQTYToken(_lqtyTokenAddress);
        stabilityPoolAddress = _stabilityPoolAddress;

        // When LQTYToken deployed, it should have transferred CommunityIssuance's LQTY entitlement
        uint LQTYBalance = lqtyToken.balanceOf(address(this));
        assert(LQTYBalance >= LQTYSupplyCap);

        emit LQTYTokenAddressSet(_lqtyTokenAddress);
        emit StabilityPoolAddressSet(_stabilityPoolAddress);

        _renounceOwnership();
    }

    function issueLQTY() external override returns (uint) {
        _requireCallerIsStabilityPool();

        uint latestTotalLQTYIssued = LQTYSupplyCap.mul(_getCumulativeIssuanceFraction()).div(DECIMAL_PRECISION);
        uint issuance = latestTotalLQTYIssued.sub(totalLQTYIssued);

        totalLQTYIssued = latestTotalLQTYIssued;
        emit TotalLQTYIssuedUpdated(latestTotalLQTYIssued);
        
        return issuance;
    }

    /* Gets 1-f^t    where: f < 1

    f: issuance factor that determines the shape of the curve
    t:  time passed since last LQTY issuance event  */
    function _getCumulativeIssuanceFraction() internal view returns (uint) {
        // Get the time passed since deployment
        uint timePassedInMinutes = block.timestamp.sub(deploymentTime).div(SECONDS_IN_ONE_MINUTE);

        // f^t
        uint power = LiquityMath._decPow(ISSUANCE_FACTOR, timePassedInMinutes);

        //  (1 - f^t)
        uint cumulativeIssuanceFraction = (uint(DECIMAL_PRECISION).sub(power));
        assert(cumulativeIssuanceFraction <= DECIMAL_PRECISION); // must be in range [0,1]

        return cumulativeIssuanceFraction;
    }

    function sendLQTY(address _account, uint _LQTYamount) external override {
        _requireCallerIsStabilityPool();

        lqtyToken.transfer(_account, _LQTYamount);
    }

    // --- 'require' functions ---

    function _requireCallerIsStabilityPool() internal view {
        require(msg.sender == stabilityPoolAddress, "CommunityIssuance: caller is not SP");
    }
}
