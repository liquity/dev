// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Interfaces/ISTBLToken.sol";
import "../Interfaces/ICommunityIssuance.sol";
import "../Dependencies/BaseMath.sol";
import "../Dependencies/StabilioMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/CheckContract.sol";


contract CommunityIssuance is ICommunityIssuance, Ownable, CheckContract, BaseMath {
    // --- Data ---

    string constant public NAME = "CommunityIssuance";

    uint256 constant public SECONDS_IN_ONE_MINUTE = 60;

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
    uint256 constant public ISSUANCE_FACTOR = 999998681227695000;

    /* 
    * The community STBL supply cap is the starting balance of the Community Issuance contract.
    * It should be minted to this contract by STBLToken, when the token is deployed.
    * 
    * Set to 32M (slightly less than 1/3) of total STBL supply.
    */
    uint256 constant public STBLSupplyCap = 32e24; // 32 million

    ISTBLToken public stblToken;

    address public stabilityPoolAddress;

    uint256 public totalSTBLIssued;
    uint256 public immutable deploymentTime;

    // --- Functions ---

    constructor() {
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
        uint256 STBLBalance = stblToken.balanceOf(address(this));
        assert(STBLBalance >= STBLSupplyCap);

        emit STBLTokenAddressSet(_stblTokenAddress);
        emit StabilityPoolAddressSet(_stabilityPoolAddress);

        _renounceOwnership();
    }

    function issueSTBL() external override returns (uint) {
        _requireCallerIsStabilityPool();

        uint256 latestTotalSTBLIssued = STBLSupplyCap * _getCumulativeIssuanceFraction() / DECIMAL_PRECISION;
        uint256 issuance = latestTotalSTBLIssued - totalSTBLIssued;

        totalSTBLIssued = latestTotalSTBLIssued;
        emit TotalSTBLIssuedUpdated(latestTotalSTBLIssued);
        
        return issuance;
    }

    /* Gets 1-f^t    where: f < 1

    f: issuance factor that determines the shape of the curve
    t:  time passed since last STBL issuance event  */
    function _getCumulativeIssuanceFraction() internal view returns (uint) {
        // Get the time passed since deployment
        uint256 timePassedInMinutes = (block.timestamp - deploymentTime) / SECONDS_IN_ONE_MINUTE;

        // f^t
        uint256 power = StabilioMath._decPow(ISSUANCE_FACTOR, timePassedInMinutes);

        //  (1 - f^t)
        uint256 cumulativeIssuanceFraction = (uint(DECIMAL_PRECISION) - power);
        assert(cumulativeIssuanceFraction <= DECIMAL_PRECISION); // must be in range [0,1]

        return cumulativeIssuanceFraction;
    }

    function sendSTBL(address _account, uint256 _STBLamount) external override {
        _requireCallerIsStabilityPool();

        stblToken.transfer(_account, _STBLamount);
    }

    // --- 'require' functions ---

    function _requireCallerIsStabilityPool() internal view {
        require(msg.sender == stabilityPoolAddress, "CommunityIssuance: caller is not SP");
    }
}
