// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import './Interfaces/IPool.sol';
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract DefaultPool is Ownable, IPool {
    using SafeMath for uint256;

    address public cdpManagerAddress;
    address public activePoolAddress;
    uint256 internal ETH;  // deposited ether tracker
    uint256 internal CLVDebt;  // total outstanding CDP debt

    event CDPManagerAddressChanged(address _newCDPManagerAddress);

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

        emit CDPManagerAddressChanged(_cdpManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);

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
        _requireCallerIsCDPMananger();
        ETH = ETH.sub(_amount);
         emit EtherSent(_account, _amount);

        (bool success, ) = _account.call{ value: _amount }("");  // use call.value()('') as per Consensys latest advice
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
        require(_msgSender() == activePoolAddress, "DefaultPool: Caller is not the ActivePool");
    }

    function _requireCallerIsCDPMananger() internal view {
        require(_msgSender() == cdpManagerAddress, "DefaultPool: Caller is not the CDPManager");
    }

    // --- Fallback function ---

    receive() external payable {
        _requireCallerIsActivePool();
        ETH = ETH.add(msg.value);
    }
}
