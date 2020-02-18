pragma solidity ^0.5.11;

import './Interfaces/IPool.sol';
import '@openzeppelin/contracts/ownership/Ownable.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import "@nomiclabs/buidler/console.sol";

contract DefaultPool is Ownable, IPool {
    using SafeMath for uint256;

    address public poolManagerAddress;
    address public stabilityPoolAddress;
    address public activePoolAddress;
    uint256 public ETH;  // deposited ether tracker
    uint256 public CLV;  // total outstanding CDP debt

    constructor() public {}

    // --- Contract setters ---

    function setPoolManagerAddress(address _poolManagerAddress) public onlyOwner {
        poolManagerAddress = _poolManagerAddress;
        emit PoolManagerAddressChanged(poolManagerAddress);
    }

    function setActivePoolAddress(address _activePoolAddress) public onlyOwner {
        activePoolAddress = _activePoolAddress;
        emit ActivePoolAddressChanged(activePoolAddress);
    }

    function setStabilityPoolAddress(address _stabilityPoolAddress) public onlyOwner {
        stabilityPoolAddress = _stabilityPoolAddress;
        emit StabilityPoolAddressChanged(stabilityPoolAddress);
    }

    // --- Getters for public variables. Required by IPool interface ---

    function getETH() public view returns(uint) {
        return ETH;
    }

    function getCLV() public view returns(uint) {
        return CLV;
    }

    // --- Pool functionality ---

    function sendETH(address _account, uint _amount) public onlyPoolManager returns(bool) {
        ETH = ETH.sub(_amount);
        (bool success, ) = _account.call.value(_amount)("");  // use call.value()('') as per Consensys latest advice 
        require (success == true, 'DefaultPool: transaction reverted');
        emit ETHBalanceUpdated(ETH);
        emit EtherSent(_account, _amount);
        return success;
    }

    function increaseCLV(uint _amount) public onlyPoolManager () {
        CLV  = CLV.add(_amount);
        emit CLVBalanceUpdated(CLV);
    }

    function decreaseCLV(uint _amount) public onlyPoolManager () {
        CLV = CLV.sub(_amount);
        emit CLVBalanceUpdated(CLV);
    }

    /* Returns the raw ether balance at DefaultPool address.  
    Not necessarily equal to the ETH state variable - ether can be forcibly sent to contracts. */
    function getRawETHBalance() public view returns(uint) {
        return address(this).balance;
    }

    modifier onlyPoolManager {
        require(_msgSender() == poolManagerAddress, "DefaultPool: Only the poolManager is authorized");
        _;
    }

    modifier onlyPoolManagerOrPool {
        require(
            _msgSender() == poolManagerAddress || 
            _msgSender() == stabilityPoolAddress || 
            _msgSender() == activePoolAddress, 
            "DefaultPool: only receive ETH from Pool or PoolManager");
        _;
    }

    function () external payable onlyPoolManagerOrPool {
        ETH = ETH.add(msg.value);
    }
}
