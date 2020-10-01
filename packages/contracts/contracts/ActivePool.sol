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
    // @REVIEW: We have getters for these 2 variables, so I would make them internal
    uint256 public ETH;  // deposited ether tracker
    uint256 public CLVDebt;

    // --- Events ---

    event CDPManagerAddressChanged(address _cdpManagerAddress);

    // --- Modifiers ---
   
    modifier onlyPoolManager {
        require(_msgSender() == poolManagerAddress, "ActivePool: Caller is not the PoolManager");
        _;
    }

    modifier onlyPoolManagerOrPool {
        require(
            _msgSender() == poolManagerAddress || 
            _msgSender() == stabilityPoolAddress || 
            _msgSender() == defaultPoolAddress, 
            "ActivePool: Caller is neither the PoolManager nor a Pool");
        _;
    }

    modifier onlyPoolManagerOrCDPManager {
        require(
            _msgSender() == poolManagerAddress || 
            _msgSender() == cdpManagerAddress, 
            "ActivePool: Caller is neither the PoolManager nor CDPManager");
        _;
    }

    // --- Contract setters ---

    function setPoolManagerAddress(address _poolManagerAddress) external onlyOwner {
        poolManagerAddress = _poolManagerAddress;
        emit PoolManagerAddressChanged(_poolManagerAddress);
    }

     function setCDPManagerAddress(address _cdpManagerAddress) external onlyOwner {
        cdpManagerAddress = _cdpManagerAddress;
        emit CDPManagerAddressChanged(_cdpManagerAddress);
    }

    function setDefaultPoolAddress(address _defaultPoolAddress) external onlyOwner {
        defaultPoolAddress = _defaultPoolAddress; 
        emit DefaultPoolAddressChanged(defaultPoolAddress);
    }

    function setStabilityPoolAddress(address _stabilityPoolAddress) external onlyOwner {
        stabilityPoolAddress = _stabilityPoolAddress;
        emit StabilityPoolAddressChanged(stabilityPoolAddress);
    }

    // --- Getters for public variables. Required by IPool interface ---

    function getETH() external view returns (uint) {
        return ETH;
    }

    function getCLVDebt() external view returns (uint) {
        return CLVDebt;
    }

    // --- Pool functionality ---

    function sendETH(address _account, uint _amount) public onlyPoolManagerOrCDPManager {
        ETH = ETH.sub(_amount);  
        emit EtherSent(_account, _amount);  

        (bool success, ) = _account.call.value(_amount)(""); //  use call.value()('') as per Consensys latest advice 
        require(success, "ActivePool: sending ETH failed");
    }

    function increaseCLVDebt(uint _amount) external onlyPoolManager () {
        CLVDebt  = CLVDebt.add(_amount); 
    }

    function decreaseCLVDebt(uint _amount) external onlyPoolManager () {
        CLVDebt = CLVDebt.sub(_amount); 
    }

    /* Returns the raw ether balance at ActivePool address.  
    Not necessarily equal to the ETH state variable - ether can be forcibly sent to contracts. */
    // @REVIEW: Like with a selfdestruct? What would be the side effect of having more ETH and using the real balance for computations?
    // @REVIEW: Why do we need this function? Contract balance can always be queried, right?
    function getRawETHBalance() external view returns (uint) {
        return address(this).balance;
    }

    function () external payable onlyPoolManagerOrPool {
        require(msg.data.length == 0);
        ETH = ETH.add(msg.value);
    }
}
