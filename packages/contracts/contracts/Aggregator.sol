// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IAggregator.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/ILUSDToken.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/ILQTYToken.sol";
import "./Interfaces/ILQTYStaking.sol";
import "./Interfaces/IRelayer.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
//import "./Dependencies/console.sol";

contract Aggregator is LiquityBase, Ownable, CheckContract, IAggregator {
    string constant public NAME = "Aggregator";

    // --- Connected contract declarations ---

    address public troveManagerAddress;

    ILUSDToken public override lusdToken;

    // --- Data structures ---

    uint constant public SECONDS_IN_ONE_MINUTE = 60;
    /*
     * Half-life of 12h. 12h = 720 min
     * (1/2) = d^720 => d = (1/2)^(1/720)
     */
    uint constant public MINUTE_DECAY_FACTOR = 999037758833783000;
    uint constant public REDEMPTION_FEE_FLOOR = DECIMAL_PRECISION / 1000 * 5; // 0.5%

    /*
    * BETA: 18 digit decimal. Parameter by which to divide the redeemed fraction, in order to calc the new base rate from a redemption.
    * Corresponds to (1 / ALPHA) in the white paper.
    */
    uint constant public BETA = 2;

    uint public override baseRate;

    // The timestamp of the latest fee operation (redemption only)
    uint public override lastFeeOperationTime;

    // per troveManager rate multiplier
    mapping (address => uint256) public rateMultiplier;
    // per troveManager minimum red fees
    mapping (address => uint256) public minRedemptionFee;
    // per troveManager debt target,  % of total debt
    mapping (address => uint256) public debtTarget;

    address[23] troveManagers;

    // --- Events ---
    event BaseRateUpdated(uint _baseRate);
    event LastFeeOpTimeUpdated(uint _lastFeeOpTime);

    // Just so test pass now. TODO: delete
    /*
    function setBaseRate(uint rate) external override returns (uint){
        _requireCallerIsTroveManager();
        baseRate = rate;
        return rate;
    }
    */

    // --- Dependency setter ---

    function setAddresses(
        address _troveManagerAddress,
        address _lusdTokenAddress
    )
        external
        override
        onlyOwner
    {
        checkContract(_troveManagerAddress);
        checkContract(_lusdTokenAddress);

        troveManagerAddress = _troveManagerAddress;
        lusdToken = ILUSDToken(_lusdTokenAddress);

        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit LUSDTokenAddressChanged(_lusdTokenAddress);

        _renounceOwnership();
    }

    // --- Redemption fee functions ---

    /*
    * This function has two impacts on the baseRate state variable:
    * 1) decays the baseRate based on time passed since last redemption or LUSD borrowing operation.
    * then,
    * 2) increases the baseRate based on the amount redeemed, as a proportion of total supply
    */
    function updateBaseRateFromRedemption(uint _ETHDrawn,  uint _price, uint _par, uint _totalLUSDSupply) external override returns (uint) {
        _requireCallerIsTroveManager();
        uint decayedBaseRate = _calcDecayedBaseRate();

        /* Convert the drawn ETH back to LUSD at face value rate (1 LUSD:1 USD), in order to get
        * the fraction of total supply that was redeemed at face value. */
        uint redeemedLUSDFraction = _ETHDrawn.mul(_price).mul(DECIMAL_PRECISION).div(_totalLUSDSupply.mul(_par));

        uint newBaseRate = decayedBaseRate.add(redeemedLUSDFraction.div(BETA));
        newBaseRate = LiquityMath._min(newBaseRate, DECIMAL_PRECISION); // cap baseRate at a maximum of 100%
        //assert(newBaseRate <= DECIMAL_PRECISION); // This is already enforced in the line above
        assert(newBaseRate > 0); // Base rate is always non-zero after redemption

        // Update the baseRate state variable
        baseRate = newBaseRate;
        emit BaseRateUpdated(newBaseRate);
        //emit BaseRateUpdated(_totalLUSDSupply);
        
        _updateLastFeeOpTime();

        return newBaseRate;
    }

    function getRedemptionRate() public view override returns (uint) {
        return _calcRedemptionRate(baseRate);
    }

    function getRedemptionRateWithDecay() public view override returns (uint) {
        return _calcRedemptionRate(_calcDecayedBaseRate());
    }

    function _calcRedemptionRate(uint _baseRate) internal pure returns (uint) {
        return LiquityMath._min(
            REDEMPTION_FEE_FLOOR.add(_baseRate),
            DECIMAL_PRECISION // cap at a maximum of 100%
        );
    }

    function getRedemptionFee(uint _ETHDrawn) public view override returns (uint) {
        return _calcRedemptionFee(getRedemptionRate(), _ETHDrawn);
    }

    function getRedemptionFeeWithDecay(uint _ETHDrawn) external view override returns (uint) {
        return _calcRedemptionFee(getRedemptionRateWithDecay(), _ETHDrawn);
    }

    function _calcRedemptionFee(uint _redemptionRate, uint _ETHDrawn) internal pure returns (uint) {
        uint redemptionFee = _redemptionRate.mul(_ETHDrawn).div(DECIMAL_PRECISION);
        require(redemptionFee < _ETHDrawn, "TroveManager: Fee would eat up all returned collateral");
        return redemptionFee;
    }


    // --- Internal fee functions ---

    // Update the last fee operation time only if time passed >= decay interval. This prevents base rate griefing.
    function _updateLastFeeOpTime() internal {
        uint timePassed = block.timestamp.sub(lastFeeOperationTime);

        if (timePassed >= SECONDS_IN_ONE_MINUTE) {
            lastFeeOperationTime = block.timestamp;
            emit LastFeeOpTimeUpdated(block.timestamp);
        }
    }

    function _calcDecayedBaseRate() internal view returns (uint) {
        uint minutesPassed = _minutesPassedSinceLastFeeOp();
        uint decayFactor = LiquityMath._decPow(MINUTE_DECAY_FACTOR, minutesPassed);

        return baseRate.mul(decayFactor).div(DECIMAL_PRECISION);
    }

    function _minutesPassedSinceLastFeeOp() internal view returns (uint) {
        return (block.timestamp.sub(lastFeeOperationTime)).div(SECONDS_IN_ONE_MINUTE);
    }
    
    // --- rate multiplier functions ---
    function relativeError(uint _measured,  uint _target) internal pure returns (uint) {
        return (_measured.sub(_target)).mul(DECIMAL_PRECISION).div(_target);
    }

    // --- 'require' wrapper functions ---

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == troveManagerAddress, "Aggregator: Caller is not TroveManager contract");
    }

}
