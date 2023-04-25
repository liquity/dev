// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../TroveManager.sol";
import "../BorrowerOperations.sol";
import "../StabilityPool.sol";
import "../ONEUSDToken.sol";

contract EchidnaProxy {
    TroveManager troveManager;
    BorrowerOperations borrowerOperations;
    StabilityPool stabilityPool;
    ONEUSDToken oneusdToken;

    constructor(
        TroveManager _troveManager,
        BorrowerOperations _borrowerOperations,
        StabilityPool _stabilityPool,
        ONEUSDToken _1usdToken
    ) public {
        troveManager = _troveManager;
        borrowerOperations = _borrowerOperations;
        stabilityPool = _stabilityPool;
        oneusdToken = _1usdToken;
    }

    receive() external payable {
        // do nothing
    }

    // TroveManager

    function liquidatePrx(address _user) external {
        troveManager.liquidate(_user);
    }

    function liquidateTrovesPrx(uint _n) external {
        troveManager.liquidateTroves(_n);
    }

    function batchLiquidateTrovesPrx(address[] calldata _troveArray) external {
        troveManager.batchLiquidateTroves(_troveArray);
    }

    function redeemCollateralPrx(
        uint _1USDAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint _partialRedemptionHintNICR,
        uint _maxIterations,
        uint _maxFee
    ) external {
        troveManager.redeemCollateral(_1USDAmount, _firstRedemptionHint, _upperPartialRedemptionHint, _lowerPartialRedemptionHint, _partialRedemptionHintNICR, _maxIterations, _maxFee);
    }

    // Borrower Operations
    function openTrovePrx(uint _ONE, uint _1USDAmount, address _upperHint, address _lowerHint, uint _maxFee) external payable {
        borrowerOperations.openTrove{value: _ONE}(_maxFee, _1USDAmount, _upperHint, _lowerHint);
    }

    function addCollPrx(uint _ONE, address _upperHint, address _lowerHint) external payable {
        borrowerOperations.addColl{value: _ONE}(_upperHint, _lowerHint);
    }

    function withdrawCollPrx(uint _amount, address _upperHint, address _lowerHint) external {
        borrowerOperations.withdrawColl(_amount, _upperHint, _lowerHint);
    }

    function withdraw1USDPrx(uint _amount, address _upperHint, address _lowerHint, uint _maxFee) external {
        borrowerOperations.withdraw1USD(_maxFee, _amount, _upperHint, _lowerHint);
    }

    function repay1USDPrx(uint _amount, address _upperHint, address _lowerHint) external {
        borrowerOperations.repay1USD(_amount, _upperHint, _lowerHint);
    }

    function closeTrovePrx() external {
        borrowerOperations.closeTrove();
    }

    function adjustTrovePrx(uint _ONE, uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease, address _upperHint, address _lowerHint, uint _maxFee) external payable {
        borrowerOperations.adjustTrove{value: _ONE}(_maxFee, _collWithdrawal, _debtChange, _isDebtIncrease, _upperHint, _lowerHint);
    }

    // Pool Manager
    function provideToSPPrx(uint _amount, address _frontEndTag) external {
        stabilityPool.provideToSP(_amount, _frontEndTag);
    }

    function withdrawFromSPPrx(uint _amount) external {
        stabilityPool.withdrawFromSP(_amount);
    }

    // 1USD Token

    function transferPrx(address recipient, uint256 amount) external returns (bool) {
        return oneusdToken.transfer(recipient, amount);
    }

    function approvePrx(address spender, uint256 amount) external returns (bool) {
        return oneusdToken.approve(spender, amount);
    }

    function transferFromPrx(address sender, address recipient, uint256 amount) external returns (bool) {
        return oneusdToken.transferFrom(sender, recipient, amount);
    }

    function increaseAllowancePrx(address spender, uint256 addedValue) external returns (bool) {
        return oneusdToken.increaseAllowance(spender, addedValue);
    }

    function decreaseAllowancePrx(address spender, uint256 subtractedValue) external returns (bool) {
        return oneusdToken.decreaseAllowance(spender, subtractedValue);
    }
}
