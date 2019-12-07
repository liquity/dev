pragma solidity ^0.5.11;

import './IPool.sol';
import '../node_modules/@openzeppelin/contracts/ownership/Ownable.sol';
import "../node_modules/@openzeppelin/contracts/math/SafeMath.sol";

contract ActivePool is Ownable, IPool {
    using SafeMath for uint256;

    address public poolManagerAddress;
    uint256 public ETH;  // deposited ether tracker
    uint256 public CLV;  // total outstanding CDP debt

    constructor() public {}

    function setPoolManagerAddress(address _poolManagerAddress) public onlyOwner {
        poolManagerAddress = _poolManagerAddress;
    }

    // --- Getters for public variables. Required by IPool interface ---
    function getETH() public view returns(uint) {
        return ETH;
    }

    function getCLV() public view returns(uint) {
        return CLV;
    }

    function getPoolManagerAddress() public view returns(address) {
        return poolManagerAddress;
    }

    // --- Pool functionality ---
    function sendETH(address payable _account, uint _amount) public onlyPoolManager returns(bool) {
        ETH = ETH.sub(_amount);
        (bool success, ) = _account.call.value(_amount)("");  // use call.value()('') as per Consensys latest advice 
        require (success == true, 'ActivePool: transaction reverted');
        return success;
    }

     function increaseETH(uint _amount) public onlyPoolManager () {
        ETH = ETH.add(_amount);
    }

    function increaseCLV(uint _amount) public onlyPoolManager () {
        CLV  = CLV.add(_amount);
    }

    function decreaseCLV(uint _amount) public onlyPoolManager () {
        CLV = CLV.sub(_amount);
    }

    /* Returns the raw ether balance at ActivePool address.  
    Not necessarily equal to the ETH state variable - ether can be forcibly sent to contracts. */
    function getRawETHBalance() public view returns(uint) {
        return address(this).balance;
    }

    modifier onlyPoolManager {
        require(_msgSender() == poolManagerAddress, "ActivePool: Only the poolManager is authorized");
        _;
    }

    function () external payable {}
}
