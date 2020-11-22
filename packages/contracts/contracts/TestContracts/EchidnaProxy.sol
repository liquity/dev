// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../CDPManager.sol";
import "../BorrowerOperations.sol";
import "../StabilityPool.sol";
import "../CLVToken.sol";

contract EchidnaProxy {
    CDPManager cdpManager;
    BorrowerOperations borrowerOperations;
    StabilityPool stabilityPool;
    CLVToken clvToken;

    constructor(
        CDPManager _cdpManager,
        BorrowerOperations _borrowerOperations,
        StabilityPool _stabilityPool,
        CLVToken _clvToken
    ) public {
        cdpManager = _cdpManager;
        borrowerOperations = _borrowerOperations;
        stabilityPool = _stabilityPool;
        clvToken = _clvToken;
    }

    receive() external payable {
        // do nothing
    }

    // CDPManager

    function liquidatePrx(address _user) external {
        cdpManager.liquidate(_user);
    }

    function liquidateCDPsPrx(uint _n) external {
        cdpManager.liquidateCDPs(_n);
    }

    function batchLiquidateTrovesPrx(address[] calldata _troveArray) external {
        cdpManager.batchLiquidateTroves(_troveArray);
    }

    function redeemCollateralPrx(
        uint _CLVAmount,
        address _firstRedemptionHint,
        address _partialRedemptionHint,
        uint _partialRedemptionHintICR,
        uint _maxIterations
    ) external {
        cdpManager.redeemCollateral(_CLVAmount, _firstRedemptionHint, _partialRedemptionHint, _partialRedemptionHintICR, _maxIterations);
    }

    // Borrower Operations
    function openLoanPrx(uint _ETH, uint _CLVAmount, address _hint) external payable {
        borrowerOperations.openLoan{value: _ETH}(_CLVAmount, _hint);
    }

    function addCollPrx(uint _ETH, address _user, address _hint) external payable {
        borrowerOperations.addColl{value: _ETH}(_user, _hint);
    }

    function withdrawCollPrx(uint _amount, address _hint) external {
        borrowerOperations.withdrawColl(_amount, _hint);
    }

    function withdrawCLVPrx(uint _amount, address _hint) external {
        borrowerOperations.withdrawCLV(_amount, _hint);
    }

    function repayCLVPrx(uint _amount, address _hint) external {
        borrowerOperations.repayCLV(_amount, _hint);
    }

    function closeLoanPrx() external {
        borrowerOperations.closeLoan();
    }

    function adjustLoanPrx(uint _ETH, uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease, address _hint) external payable {
        borrowerOperations.adjustLoan{value: _ETH}(_collWithdrawal, _debtChange, _isDebtIncrease, _hint);
    }

    // Pool Manager
    function provideToSPPrx(uint _amount, address _frontEndTag) external {
        stabilityPool.provideToSP(_amount, _frontEndTag);
    }

    function withdrawFromSPPrx(uint _amount) external {
        stabilityPool.withdrawFromSP(_amount);
    }

    // CLV Token

    function transferPrx(address recipient, uint256 amount) external returns (bool) {
        return clvToken.transfer(recipient, amount);
    }

    function approvePrx(address spender, uint256 amount) external returns (bool) {
        return clvToken.approve(spender, amount);
    }

    function transferFromPrx(address sender, address recipient, uint256 amount) external returns (bool) {
        return clvToken.transferFrom(sender, recipient, amount);
    }

    function increaseAllowancePrx(address spender, uint256 addedValue) external returns (bool) {
        return clvToken.increaseAllowance(spender, addedValue);
    }

    function decreaseAllowancePrx(address spender, uint256 subtractedValue) external returns (bool) {
        return clvToken.decreaseAllowance(spender, subtractedValue);
    }
}
