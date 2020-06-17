pragma solidity ^0.5.15;

import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

/* Stores the CLV user data: token balances and spending allowances.Functions are setters, 
addition and subtraction. Actual token logic resides in CLVToken.sol */

contract CLVTokenData is Ownable {
    using SafeMath for uint;

    // User data for CLV token
    mapping (address => uint256) public balances;
    mapping (address => mapping (address => uint256)) public allowances;

    // CLV token logic contract address
    address clvTokenAddress;

    constructor() public {
        clvTokenAddress = _msgSender();
    }

    // --- Modifiers ---
    
    modifier onlyCLVTokenAddress {
        require(_msgSender() == clvTokenAddress, "CLVTokenData: Caller is not the CLVToken contract");
        _;
    }

    // --- Balance functions --- 

    function getBalance(address account) external view returns(uint) { 
        return balances[account];
    }

    function setBalance(address account, uint256 newBalance) external  onlyCLVTokenAddress {
        balances[account] = newBalance;
    }

    function addToBalance(address account, uint256 value) external onlyCLVTokenAddress {
        balances[account] = balances[account].add(value);
    }

    function subFromBalance(address account, uint256 value) external onlyCLVTokenAddress {
        balances[account] = balances[account].sub(value, 'ERC20: subtracted amount exceeds balance'); 
    }

    // --- Allowance functions ---
    
    function getAllowance(address owner, address spender) external view returns(uint) {
        return allowances[owner][spender];
    }

    function setAllowance(address owner, address spender, uint256 allowance) external onlyCLVTokenAddress {
        allowances[owner][spender] = allowance;
    }
}