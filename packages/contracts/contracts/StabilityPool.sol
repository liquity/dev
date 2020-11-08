pragma solidity 0.5.16;

import './Interfaces/IStabilityPool.sol';
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract StabilityPool is Ownable, IStabilityPool {
    using SafeMath for uint256;

    address public poolManagerAddress;
    address public activePoolAddress;
    uint256 internal ETH;  // deposited ether tracker
    
    // Total CLV held in the pool. Changes when users deposit/withdraw, and when CDP debt is offset.
    uint256 internal totalCLVDeposits;

    // --- Contract setters ---

    function setAddresses(
        address _poolManagerAddress,
        address _activePoolAddress
    )
        external
        onlyOwner
    {
        poolManagerAddress = _poolManagerAddress;
        activePoolAddress = _activePoolAddress;

        emit PoolManagerAddressChanged(_poolManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    function getETH() external view returns (uint) {
        return ETH;
    }

    function getTotalCLVDeposits() external view returns (uint) {
        return totalCLVDeposits;
    }

    // --- Pool functionality ---

    function sendETH(address _account, uint _amount) external {
        _requireCallerIsPoolManager();
        ETH = ETH.sub(_amount);
        emit ETHBalanceUpdated(ETH);
        emit EtherSent(_account, _amount);

        (bool success, ) = _account.call.value(_amount)("");  // use call.value()('') as per Consensys latest advice 
        require(success, "StabilityPool: sending ETH failed");
    }

    function increaseCLV(uint _amount) external {
        _requireCallerIsPoolManager();
        totalCLVDeposits  = totalCLVDeposits.add(_amount);
        emit CLVBalanceUpdated(totalCLVDeposits);
    }

    function decreaseCLV(uint _amount) external {
        _requireCallerIsPoolManager();
        totalCLVDeposits = totalCLVDeposits.sub(_amount);
        emit CLVBalanceUpdated(totalCLVDeposits);
    }

    /* Returns the raw ether balance at StabilityPool address.  
    Not necessarily equal to the ETH state variable - ether can be forcibly sent to contracts. */
    function getRawETHBalance() external view returns (uint) {
        return address(this).balance;
    }

    // --- 'require' functions ---
     function _requireCallerIsPoolManager() internal view {
        require(_msgSender() == poolManagerAddress, "ActivePool: Caller is not the PoolManager");
    }

    function _requireCallerIsActivePool() internal view {
        require( _msgSender() == activePoolAddress, "StabilityPool: Caller is not ActivePool");
    }

    // --- Fallback function ---

    function () external payable {
        _requireCallerIsActivePool();
        ETH = ETH.add(msg.value);
    }
}
