// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import './Interfaces/IPool.sol';
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

/* 
 * The Default Pool holds the ETH and LUSD debt (but not LUSD tokens) from liquidations that have been redistributed
 * to active troves but not yet "applied", i.e. not yet recorded on a recipient active trove's struct.
 * 
 * When a trove makes an operation that applies its pending ETH and LUSD debt, its pending ETH and LUSD debt is moved
 * from the Default Pool to the Active Pool.
 */
contract DefaultPool is Ownable, IPool {
    using SafeMath for uint256;

    address public cdpManagerAddress;
    address public activePoolAddress;
    uint256 internal ETH;  // deposited ETH tracker
    uint256 internal CLVDebt;  // debt 

    event TroveManagerAddressChanged(address _newTroveManagerAddress);

    // --- Dependency setters ---

    function setAddresses(
        address _cdpManagerAddress,
        address _activePoolAddress
    )
        external
        onlyOwner
    {
        cdpManagerAddress = _cdpManagerAddress;
        activePoolAddress = _activePoolAddress;

        emit TroveManagerAddressChanged(_cdpManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    /* 
    * Returns the ETH state variable.
    *
    * Not necessarily equal to the the contract's raw ETH balance - ether can be forcibly sent to contracts. 
    */
    function getETH() external view override returns (uint) {
        return ETH;
    }

    function getCLVDebt() external view override returns (uint) {
        return CLVDebt;
    }

    // --- Pool functionality ---

    function sendETH(address _account, uint _amount) external override {
        _requireCallerIsCDPMananger();
        ETH = ETH.sub(_amount);
        emit EtherSent(_account, _amount);

        (bool success, ) = _account.call{ value: _amount }(""); 
        require(success, "DefaultPool: sending ETH failed");
    }

    function increaseCLVDebt(uint _amount) external override {
        _requireCallerIsCDPMananger();
        CLVDebt = CLVDebt.add(_amount);
    }

    function decreaseCLVDebt(uint _amount) external override {
        _requireCallerIsCDPMananger();
        CLVDebt = CLVDebt.sub(_amount);
    }

    // --- 'require' functions ---

    function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "DefaultPool: Caller is not the ActivePool");
    }

    function _requireCallerIsCDPMananger() internal view {
        require(msg.sender == cdpManagerAddress, "DefaultPool: Caller is not the TroveManager");
    }

    // --- Fallback function ---

    receive() external payable {
        _requireCallerIsActivePool();
        ETH = ETH.add(msg.value);
    }
}
