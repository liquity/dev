// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./LiquityMath.sol";

/* Base contract for CDPManager and BorrowerOperations. Contains global system constants and
common functions. */
contract LiquityBase {
    using SafeMath for uint;

    address constant public GAS_POOL_ADDRESS = 0x00000000000000000000000000000000000009A5;

    uint constant public _100pct = 1000000000000000000; // 1e18 == 100%

    // Minimum collateral ratio for individual troves
    uint constant public MCR = 1100000000000000000; // 110%

    // Minimum collateral ratio for individual troves
    uint constant public R_MCR = 3000000000000000000; // 300%

    // Critical system collateral ratio. If the total system collateral (TCR) falls below the CCR, Recovery Mode is triggered.
    uint constant public  CCR = 1500000000000000000; // 150%

    // Amount of CLV to be locked in gas pool on opening loans
    uint constant public CLV_GAS_COMPENSATION = 10e18;

    uint constant public PERCENT_DIVISOR = 200; // dividing by 200 equals to applying 0.5%

    // --- Gas compensation functions ---

    // Returns the composite debt (actual debt + gas compensation) of a trove, for the purpose of ICR calculation
    function _getCompositeDebt(uint _debt) internal pure returns (uint) {
        return _debt.add(CLV_GAS_COMPENSATION);
    }

    function _getNetDebt(uint _debt) internal pure returns (uint) {
        return _debt.sub(CLV_GAS_COMPENSATION);
    }

    /* Return the amount of ETH to be drawn from a trove's collateral and sent as gas compensation.
    Given by the dollar value of 0.5% of collateral */
    function _getCollGasCompensation(uint _entireColl) internal pure returns (uint) {
        return _entireColl / PERCENT_DIVISOR;
    }
}
