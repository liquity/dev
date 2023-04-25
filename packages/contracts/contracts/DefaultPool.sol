// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import './Interfaces/IDefaultPool.sol';
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";

/*
 * The Default Pool holds the ONE and 1USD debt (but not 1USD tokens) from liquidations that have been redistributed
 * to active troves but not yet "applied", i.e. not yet recorded on a recipient active trove's struct.
 *
 * When a trove makes an operation that applies its pending ONE and 1USD debt, its pending ONE and 1USD debt is moved
 * from the Default Pool to the Active Pool.
 */
contract DefaultPool is Ownable, CheckContract, IDefaultPool {
    using SafeMath for uint256;

    string constant public NAME = "DefaultPool";

    address public troveManagerAddress;
    address public activePoolAddress;
    uint256 internal ONE;  // deposited ONE tracker
    uint256 internal ONEUSDDebt;  // debt

    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event DefaultPool1USDDebtUpdated(uint _1USDDebt);
    event DefaultPoolONEBalanceUpdated(uint _ONE);

    // --- Dependency setters ---

    function setAddresses(
        address _troveManagerAddress,
        address _activePoolAddress
    )
        external
        onlyOwner
    {
        checkContract(_troveManagerAddress);
        checkContract(_activePoolAddress);

        troveManagerAddress = _troveManagerAddress;
        activePoolAddress = _activePoolAddress;

        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    /*
    * Returns the ONE state variable.
    *
    * Not necessarily equal to the the contract's raw ONE balance - ether can be forcibly sent to contracts.
    */
    function getONE() external view override returns (uint) {
        return ONE;
    }

    function get1USDDebt() external view override returns (uint) {
        return ONEUSDDebt;
    }

    // --- Pool functionality ---

    function sendONEToActivePool(uint _amount) external override {
        _requireCallerIsTroveManager();
        address activePool = activePoolAddress; // cache to save an SLOAD
        ONE = ONE.sub(_amount);
        emit DefaultPoolONEBalanceUpdated(ONE);
        emit OneSent(activePool, _amount);

        (bool success, ) = activePool.call{ value: _amount }("");
        require(success, "DefaultPool: sending ONE failed");
    }

    function increase1USDDebt(uint _amount) external override {
        _requireCallerIsTroveManager();
        ONEUSDDebt = ONEUSDDebt.add(_amount);
        emit DefaultPool1USDDebtUpdated(ONEUSDDebt);
    }

    function decrease1USDDebt(uint _amount) external override {
        _requireCallerIsTroveManager();
        ONEUSDDebt = ONEUSDDebt.sub(_amount);
        emit DefaultPool1USDDebtUpdated(ONEUSDDebt);
    }

    // --- 'require' functions ---

    function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "DefaultPool: Caller is not the ActivePool");
    }

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == troveManagerAddress, "DefaultPool: Caller is not the TroveManager");
    }

    // --- Fallback function ---

    receive() external payable {
        _requireCallerIsActivePool();
        ONE = ONE.add(msg.value);
        emit DefaultPoolONEBalanceUpdated(ONE);
    }
}
