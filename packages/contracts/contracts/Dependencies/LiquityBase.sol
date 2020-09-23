pragma solidity 0.5.16;

import "./Math.sol";

/* Base contract for CDPManager and BorrowerOperations. Contains global system constants and
common functions. */
contract LiquityBase {
    using SafeMath for uint;

    uint constant public _100pct = 1000000000000000000; // 1e18

    // Minimum collateral ratio for individual troves
    uint constant public MCR = 1100000000000000000; // 110%

    // Critical system collateral ratio. If the total system collateral (TCR) falls below the CCR, Recovery Mode is triggered.
    uint constant public  CCR = 1500000000000000000; // 150%
    
    // The minimum virtual debt assigned to all troves: 10 CLV.
    uint constant public MIN_VIRTUAL_DEBT = 10e18;   

    // The minimum value of collateral allowed for a new deposit, in USD.
    uint constant public MIN_COLL_IN_USD = 20000000000000000000; // $20 with 18 decimals
    
    // --- Gas compensation functions ---

    /* Return the amount of ETH to be drawn from a trove's collateral and sent as gas compensation. 
    Given by the maximum of { $10 worth of ETH,  dollar value of 0.5% of collateral } */
    function _getGasCompensation(uint _entireColl, uint _price) internal view returns (uint) {
        
        // --- Enable gas compensation --- 
        // *******************************

        // uint minETHComp = _getMinVirtualDebtInETH(_price);

        // if (_entireColl <= minETHComp) { return _entireColl; }

        // @REVIEW: Are we sure we want to use SafeMath’s div? Solidity already asserts when dividing by zero. I don’t think it makes sense for constants.
        // uint _0pt5percentOfColl = _entireColl.div(200);

        // uint compensation = Math._max(minETHComp, _0pt5percentOfColl);
        // return compensation;

        // *******************************
        

        // --- Disable gas compensation ----
        // *******************************

        return 0;

        // *******************************
    }

    // Returns the composite debt (actual debt + virtual debt) of a trove, for the purpose of ICR calculation
    function _getCompositeDebt(uint _debt) internal pure returns (uint) {
        /* If trove has no actual outstanding debt, then it is unliquidateable, 
        and should have no virtual debt */
        if (_debt == 0) {return 0;}  

        // --- Enable virtual debt ---
        // *******************************

        // return _debt.add(MIN_VIRTUAL_DEBT);

        // *******************************


        // --- Disable virtual debt ---
        // *******************************

        return _debt;

        // *******************************
    }

      // Returns the ETH amount that is equal, in $USD value, to the minVirtualDebt 
    function _getMinVirtualDebtInETH(uint _price) internal pure returns (uint minETHComp) {
        // @REVIEW: Are we sure we want to use SafeMath’s div? Solidity already asserts when dividing by zero.
        minETHComp = MIN_VIRTUAL_DEBT.mul(1e18).div(_price);
        return minETHComp;
    }

    // Used only in tests. TODO: Move to CDPManagerTester
    function getActualDebtFromComposite(uint _debtVal) external pure returns (uint) {
        uint debtValMinusVirtual = _debtVal.sub(MIN_VIRTUAL_DEBT);
        uint compositeDebt = _getCompositeDebt(debtValMinusVirtual);

        // If gas comp is on, the actual debt is the debt value sans the virtual debt
        if (compositeDebt == _debtVal) {return debtValMinusVirtual;}
        
        // if gas comp if off, the actual debt is the original debt value
        if (compositeDebt == debtValMinusVirtual) {return _debtVal;}
    }
}