// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import './Interfaces/IPool.sol';
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract ActivePool is Ownable, IPool {
    using SafeMath for uint256;

    address public borrowerOperationsAddress;
    address public cdpManagerAddress;
    address public stabilityPoolAddress;
    address public defaultPoolAddress;
    uint256 internal ETH;  // deposited ether tracker
    uint256 internal CLVDebt;

    // --- Events ---

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event CDPManagerAddressChanged(address _newCDPManagerAddress);

    // --- Contract setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _cdpManagerAddress,
        address _stabilityPoolAddress,
        address _defaultPoolAddress
    )
        external
        onlyOwner
    {
        borrowerOperationsAddress = _borrowerOperationsAddress;
        cdpManagerAddress = _cdpManagerAddress;
        stabilityPoolAddress = _stabilityPoolAddress;
        defaultPoolAddress = _defaultPoolAddress;

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit CDPManagerAddressChanged(_cdpManagerAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    /* Returns the ETH state variable at ActivePool address.
       Not necessarily equal to the raw ether balance - ether can be forcibly sent to contracts. */
    function getETH() external view override returns (uint) {
        return ETH;
    }

    function getCLVDebt() external view override returns (uint) {
        return CLVDebt;
    }

    // --- Pool functionality ---

    function sendETH(address _account, uint _amount) external override {
        _requireCallerIsBOorCDPMorSP();
        ETH = ETH.sub(_amount);
        emit EtherSent(_account, _amount);

        (bool success, ) = _account.call{ value: _amount }("");
        require(success, "ActivePool: sending ETH failed");
    }

    function increaseCLVDebt(uint _amount) external override {
        _requireCallerIsBOorCDPM();
        CLVDebt  = CLVDebt.add(_amount);
    }

    function decreaseCLVDebt(uint _amount) external override {
        _requireCallerIsBOorCDPMorSP();
        CLVDebt = CLVDebt.sub(_amount);
    }

    // --- 'require' functions ---

    function _requireCallerIsBorrowerOperationsOrDefaultPool() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == defaultPoolAddress,
            "ActivePool: Caller is neither BO nor Default Pool");
    }

    function _requireCallerIsBOorCDPMorSP() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == cdpManagerAddress ||
            msg.sender == stabilityPoolAddress,
            "ActivePool: Caller is neither BorrowerOperations nor CDPManager nor StabilityPool");
    }

    function _requireCallerIsBOorCDPM() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == cdpManagerAddress,
            "ActivePool: Caller is neither BorrowerOperations nor CDPManager");
    }

    // --- Fallback function ---

    receive() external payable {
        _requireCallerIsBorrowerOperationsOrDefaultPool();
        ETH = ETH.add(msg.value);
    }
}
