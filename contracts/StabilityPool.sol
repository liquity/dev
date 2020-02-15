pragma solidity ^0.5.11;

import './IStabilityPool.sol';
import '@openzeppelin/contracts/ownership/Ownable.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

contract StabilityPool is Ownable, IStabilityPool {
    using SafeMath for uint256;

    address public poolManagerAddress;
    address public defaultPoolAddress;
    address public activePoolAddress;
    uint256 public ETH;  // deposited ether tracker

    // Total CLV held in the pool. Changes when users deposit/withdraw, and when CDP debt is offset.
    uint256 public CLV;  
    // Total user CLV deposits. Used in proportional reward calculation in PoolManager. 
    //  Only changes when users deposit/withdraw.
    uint256 public totalCLVDeposits; 

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
    
    function setDefaultPoolAddress(address _defaultPoolAddress) public onlyOwner {
        defaultPoolAddress = _defaultPoolAddress; 
        emit DefaultPoolAddressChanged(defaultPoolAddress);
    }

    // Redundant function. Needed only to satisfy IPool interface
    function setStabilityPoolAddress(address _defaultPoolAddress) public onlyOwner {
    }

    // --- Getters for public variables. Required by IPool interface ---
    function getActivePoolAddress() public view returns(address) {
        return activePoolAddress;
    }

    function getStabilityPoolAddress() public view returns(address){
        return address(this);
    }

    function getDefaultPoolAddress() public view returns(address){
        return defaultPoolAddress;
    }
   
    function getPoolManagerAddress() public view returns(address) {
        return poolManagerAddress;
    }

    function getETH() public view returns(uint) {
        return ETH;
    }

    function getCLV() public view returns(uint) {
        return CLV;
    }

    function getTotalCLVDeposits() public view returns(uint) {
        return totalCLVDeposits;
    }

    // --- Pool functionality ---
    function sendETH(address _account, uint _amount) public onlyPoolManager returns(bool){
        ETH = ETH.sub(_amount);
        (bool success, ) = _account.call.value(_amount)("");  // use call.value()('') as per Consensys latest advice 
        require (success == true, 'StabilityPool: transaction reverted');
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

    function increaseTotalCLVDeposits(uint _amount) public onlyPoolManager () {
        totalCLVDeposits = totalCLVDeposits.add(_amount);
    }

    function decreaseTotalCLVDeposits(uint _amount) public onlyPoolManager () {
        totalCLVDeposits = totalCLVDeposits.sub(_amount);
    }

    /* Returns the raw ether balance at StabilityPool address.  
    Not necessarily equal to the ETH state variable - ether can be forcibly sent to contracts. */
    function getRawETHBalance() public view returns(uint) {
        return address(this).balance;
    }

    modifier onlyPoolManager {
        require(_msgSender() == poolManagerAddress, "StabilityPool: Only the poolManager is authorized");
        _;
    }

    modifier onlyPoolManagerOrPool {
        require(
            _msgSender() == poolManagerAddress || 
            _msgSender() == activePoolAddress || 
            _msgSender() == defaultPoolAddress, 
            "StabilityPool: only receive ETH from Pool or PoolManager");
        _;
    }

    function () external payable onlyPoolManagerOrPool {
        ETH = ETH.add(msg.value);
    }
}
