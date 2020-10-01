pragma solidity 0.5.16;

import "../Interfaces/IPool.sol";
import "./Ownable.sol";
import "./SafeMath.sol";
import "./console.sol";


contract Pool is Ownable, IPool {
    using SafeMath for uint256;

    address public poolManagerAddress;
    address public cdpManagerAddress;
    uint256 internal ETH;  // deposited ether tracker
    uint256 internal CLVDebt;

    // --- Events ---

    event CDPManagerAddressChanged(address _cdpManagerAddress);

    // --- Modifiers ---

    modifier onlyPoolManager {
        require(_msgSender() == poolManagerAddress, "Pool: Caller is not the PoolManager");
        _;
    }

    modifier onlyPoolManagerOrCDPManager {
        require(
            _msgSender() == poolManagerAddress ||
            _msgSender() == cdpManagerAddress,
            "Pool: Caller is neither the PoolManager nor CDPManager");
        _;
    }

    // --- Getters for public variables. Required by IPool interface ---

    function getETH() external view returns (uint) {
        return ETH;
    }

    function getCLVDebt() external view returns (uint) {
        return CLVDebt;
    }

    // --- Pool functionality ---

    function sendETH(address _account, uint _amount) external onlyPoolManager {
        _sendETH(_account, _amount);
    }

    function _sendETH(address _account, uint _amount) internal {
        ETH = ETH.sub(_amount);
        emit EtherSent(_account, _amount);

        (bool success, ) = _account.call.value(_amount)(""); //  use call.value()('') as per Consensys latest advice
        require(success, "Pool: sending ETH failed");
    }

    function increaseCLVDebt(uint _amount) external onlyPoolManager () {
        CLVDebt  = CLVDebt.add(_amount);
    }

    function decreaseCLVDebt(uint _amount) external onlyPoolManager () {
        CLVDebt = CLVDebt.sub(_amount);
    }

    function _fallback() internal {
        require(msg.data.length == 0);
        ETH = ETH.add(msg.value);
    }
}
