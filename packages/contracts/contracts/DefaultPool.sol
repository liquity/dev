pragma solidity 0.5.16;

import './Interfaces/IPool.sol';
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract DefaultPool is Ownable, IPool {
    using SafeMath for uint256;

    address public poolManagerAddress;
    address public stabilityPoolAddress;
    address public activePoolAddress;
    uint256 public ETH;  // deposited ether tracker
    uint256 public CLVDebt;  // total outstanding CDP debt

    // --- Dependency setters ---

    function setAddresses(
        address _poolManagerAddress,
        address _activePoolAddress,
        address _stabilityPoolAddress
    )
        external
        onlyOwner
    {
        poolManagerAddress = _poolManagerAddress;
        activePoolAddress = _activePoolAddress;
        stabilityPoolAddress = _stabilityPoolAddress;

        emit PoolManagerAddressChanged(poolManagerAddress);
        emit ActivePoolAddressChanged(activePoolAddress);
        emit StabilityPoolAddressChanged(stabilityPoolAddress);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    function getETH() external view returns (uint) {
        return ETH;
    }

    function getCLVDebt() external view returns (uint) {
        return CLVDebt;
    }

    // --- Pool functionality ---

    function sendETH(address _account, uint _amount) external {
        _requireCallerIsPoolManager();
        ETH = ETH.sub(_amount); 
         emit EtherSent(_account, _amount);  

        (bool success, ) = _account.call.value(_amount)("");  // use call.value()('') as per Consensys latest advice 
        require(success, "DefaultPool: sending ETH failed");     
    }

    function increaseCLVDebt(uint _amount) external {
        _requireCallerIsPoolManager();
        CLVDebt = CLVDebt.add(_amount);
    }

    function decreaseCLVDebt(uint _amount) external {
        _requireCallerIsPoolManager();
        CLVDebt = CLVDebt.sub(_amount); 
    }

    /* Returns the raw ether balance at DefaultPool address.  
    Not necessarily equal to the ETH state variable - ether can be forcibly sent to contracts. */
    function getRawETHBalance() external view returns (uint) {
        return address(this).balance;
    }

    // --- 'require' functions ---

    function _requireCallerIsPoolManager() internal view {
        require(_msgSender() == poolManagerAddress, "ActivePool: Caller is not the PoolManager");
    }

     function _requireCallerIsPoolManagerOrPool() internal view {
        require(
            _msgSender() == poolManagerAddress || 
            _msgSender() == stabilityPoolAddress || 
            _msgSender() == activePoolAddress, 
            "DefaultPool: Caller is neither the PoolManager nor a Pool");
    }

    // --- Fallback function ---

    function () external payable {
        _requireCallerIsPoolManagerOrPool();
        require(msg.data.length == 0);
        ETH = ETH.add(msg.value);
    }
}
