// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import './Interfaces/IActivePool.sol';
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";

/*
 * The Active Pool holds the Collateral token and debt amount (but not debt tokens) for all active troves.
 *
 * When a trove is liquidated, it's Collateral and debt are transferred from the Active Pool, to either the
 * Stability Pool, the Default Pool, or both, depending on the liquidation conditions.
 *
 */
contract ActivePool is Ownable, CheckContract, IActivePool {
    using SafeMath for uint256;

    string constant public NAME = "ActivePool";

    address public borrowerOperationsAddress;
    address public troveManagerAddress;
    address public stabilityPoolAddress;
    address public defaultPoolAddress;
    uint256 internal Collateral;  // deposited Collateral tracker
    uint256 internal Debt;

    // --- Events ---

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolDebtUpdated(uint _Debt);
    event ActivePoolCollateralUpdated(uint _Collateral);

    // --- Contract setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _defaultPoolAddress
    )
        external
        onlyOwner
    {
        checkContract(_borrowerOperationsAddress);
        checkContract(_troveManagerAddress);
        checkContract(_stabilityPoolAddress);
        checkContract(_defaultPoolAddress);

        borrowerOperationsAddress = _borrowerOperationsAddress;
        troveManagerAddress = _troveManagerAddress;
        stabilityPoolAddress = _stabilityPoolAddress;
        defaultPoolAddress = _defaultPoolAddress;

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    /*
    * Returns the Collateral state variable.
    *
    */
    function getCollateral() external view override returns (uint) {
        return Collateral;
    }

    function getDebt() external view override returns (uint) {
        return Debt;
    }

    // --- Pool functionality ---

    function sendCollateral(address _account, uint _amount) external override {
        _requireCallerIsBOorTroveMorSP();
        Collateral = Collateral.sub(_amount);
        emit ActivePoolCollateralUpdated(Collateral);
        emit CollateralSent(_account, _amount);

        (bool success, ) = _account.call{ value: _amount }(""); //TODO this is an ERC20 transfer, not a call
        require(success, "ActivePool: sending Collateral failed");
    }

    function increaseDebt(uint _amount) external override {
        _requireCallerIsBOorTroveM();
        Debt  = Debt.add(_amount);
        ActivePoolDebtUpdated(Debt);
    }

    function decreaseDebt(uint _amount) external override {
        _requireCallerIsBOorTroveMorSP();
        Debt = Debt.sub(_amount);
        ActivePoolDebtUpdated(Debt);
    }

    // --- 'require' functions ---

    function _requireCallerIsBorrowerOperationsOrDefaultPool() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == defaultPoolAddress,
            "ActivePool: Caller is neither BO nor Default Pool");
    }

    function _requireCallerIsBOorTroveMorSP() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == troveManagerAddress ||
            msg.sender == stabilityPoolAddress,
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager nor StabilityPool");
    }

    function _requireCallerIsBOorTroveM() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == troveManagerAddress,
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager");
    }

    // --- Fallback function ---

    receive() external payable {
        _requireCallerIsBorrowerOperationsOrDefaultPool();
        Collateral = Collateral.add(msg.value);
        emit ActivePoolCollateralUpdated(Collateral);
    }
}
