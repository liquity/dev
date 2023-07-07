// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/ISTBLToken.sol";
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
    * The community STBL supply cap is the starting balance of the Community Issuance contract.
    * It should be minted to this contract by STBLToken, when the token is deployed.
    * 
    * Set to 32M (slightly less than 1/3) of total STBL supply.
    */
    uint constant public STBLSupplyCap = 32e24; // 32 million

    ISTBLToken public stblToken;

    address public stabilityPoolAddress;

    uint public totalSTBLIssued;
    uint public immutable deploymentTime;

    // --- Events ---

    event STBLTokenAddressSet(address _stblTokenAddress);
    event StabilityPoolAddressSet(address _stabilityPoolAddress);
    event TotalSTBLIssuedUpdated(uint _totalSTBLIssued);

    // --- Functions ---

    constructor() public {
        deploymentTime = block.timestamp;
    }

    function setAddresses
    (
        address _stblTokenAddress, 
        address _stabilityPoolAddress
    ) 
        external 
        onlyOwner 
        override 
    {
        checkContract(_stblTokenAddress);
        checkContract(_stabilityPoolAddress);

        stblToken = ISTBLToken(_stblTokenAddress);
        stabilityPoolAddress = _stabilityPoolAddress;

        // When STBLToken deployed, it should have transferred CommunityIssuance's STBL entitlement
        uint STBLBalance = stblToken.balanceOf(address(this));
        assert(STBLBalance >= STBLSupplyCap);

        emit STBLTokenAddressSet(_stblTokenAddress);
        emit StabilityPoolAddressSet(_stabilityPoolAddress);

        _renounceOwnership();
    }

    function issueSTBL() external override returns (uint) {
        _requireCallerIsStabilityPool();

        uint latestTotalSTBLIssued = STBLSupplyCap.mul(_getCumulativeIssuanceFraction()).div(DECIMAL_PRECISION);
        uint issuance = latestTotalSTBLIssued.sub(totalSTBLIssued);

        totalSTBLIssued = latestTotalSTBLIssued;
        emit TotalSTBLIssuedUpdated(latestTotalSTBLIssued);
        
        return issuance;
    }

    /* Gets 1-f^t    where: f < 1

    f: issuance factor that determines the shape of the curve
    t:  time passed since last STBL issuance event  */
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

    function sendSTBL(address _account, uint _STBLamount) external override {
        _requireCallerIsStabilityPool();

        stblToken.transfer(_account, _STBLamount);
    }

    // --- 'require' functions ---

    function _requireCallerIsStabilityPool() internal view {
        require(msg.sender == stabilityPoolAddress, "CommunityIssuance: caller is not SP");
    }
}
