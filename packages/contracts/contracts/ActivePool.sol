pragma solidity 0.5.16;

import './Interfaces/IPool.sol';
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract ActivePool is Ownable, IPool {
    using SafeMath for uint256;

    address public poolManagerAddress;
    address public cdpManagerAddress;
    address public stabilityPoolAddress;
    address public defaultPoolAddress;
    uint256 public ETH;  // deposited ether tracker
    uint256 public CLVDebt;

    // --- Events ---

    event CDPManagerAddressChanged(address _cdpManagerAddress);

    // --- Contract setters ---

    function setAddresses(
        address _poolManagerAddress,
        address _cdpManagerAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress
    )
        external
        onlyOwner
    {
        poolManagerAddress = _poolManagerAddress;
        cdpManagerAddress = _cdpManagerAddress;
        defaultPoolAddress = _defaultPoolAddress;
        stabilityPoolAddress = _stabilityPoolAddress;

        emit PoolManagerAddressChanged(_poolManagerAddress);
        emit CDPManagerAddressChanged(_cdpManagerAddress);
        emit DefaultPoolAddressChanged(defaultPoolAddress);
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
        _requireCallerIsPoolManagerOrCDPManager();
        ETH = ETH.sub(_amount);  
        emit EtherSent(_account, _amount);  

        (bool success, ) = _account.call.value(_amount)(""); //  use call.value()('') as per Consensys latest advice 
        require(success, "ActivePool: sending ETH failed");
    }

    function increaseCLVDebt(uint _amount) external {
        _requireCallerIsPoolManager();
        CLVDebt  = CLVDebt.add(_amount); 
    }

    function decreaseCLVDebt(uint _amount) external {
        _requireCallerIsPoolManager();
        CLVDebt = CLVDebt.sub(_amount); 
    }

    /* Returns the raw ether balance at ActivePool address.  
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
            _msgSender() == defaultPoolAddress, 
            "ActivePool: Caller is neither the PoolManager nor a Pool");
    }

    function _requireCallerIsPoolManagerOrCDPManager() internal view {
        require(
            _msgSender() == poolManagerAddress || 
            _msgSender() == cdpManagerAddress, 
            "ActivePool: Caller is neither the PoolManager nor CDPManager");
    }

    // --- Fallback function ---

    function () external payable {
        _requireCallerIsPoolManagerOrPool();
        require(msg.data.length == 0);
        ETH = ETH.add(msg.value);
    }
}
