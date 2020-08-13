pragma solidity 0.5.16;

import "./SafeMath.sol";

contract LiquityBase {
    using SafeMath for uint;

    // Minimum collateral ratio for individual troves
    uint constant public MCR = 1100000000000000000; 

    // Critical system collateral ratio. If the total system collateral (TCR) falls below the CCR, Recovery Mode is triggered.
    uint constant public  CCR = 1500000000000000000; 
    
    // The minimum virtual debt assigned to all troves: 10 CLV.
    uint constant public MIN_VIRTUAL_DEBT = 10e18;   

    // The minimum value of collateral allowed for a new deposit, in USD.
    uint constant public MIN_COLL_IN_USD = 20000000000000000000;
    

    // --- Gas compensation functions ---

    /* Return the amount of ETH to be drawn from a trove's collateral and sent as gas compensation. 
    Given by the maximum of { $10 worth of ETH,  dollar value of 0.5% of collateral } */
    function _getGasCompensation(uint _entireColl, uint _price) internal view returns (uint) {
        // uint minETHComp = _getMinVirtualDebtInETH(_price);

        // if (_entireColl <= minETHComp) { return _entireColl; }

        // uint _0pt5percentOfColl = _entireColl.div(200);

        // uint compensation = Math._max(minETHComp, _0pt5percentOfColl);
        // return compensation;
        return 0;
    }

    // Returns the ETH amount that is equal, in $USD value, to the minVirtualDebt 
    function _getMinVirtualDebtInETH(uint _price) internal pure returns (uint minETHComp) {
        minETHComp = MIN_VIRTUAL_DEBT.mul(1e18).div(_price);
        return minETHComp;
    }

    // Returns the composite debt (actual debt + virtual debt) of a trove, for the purpose of ICR calculation
    function _getCompositeDebt(uint _debt) internal pure returns (uint) {
        // return _debt.add(MIN_VIRTUAL_DEBT);
        return _debt;
    }
}