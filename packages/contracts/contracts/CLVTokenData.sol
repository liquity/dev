pragma solidity 0.5.16;

import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

/* Stores the CLV user data: token balances and spending allowances. 
The functions only get/set balances and allowances, and increase/decrease balances.
The bulk of the token logic resides in CLVToken.sol */

contract CLVTokenData is Ownable {
    using SafeMath for uint;

    // User data for CLV token
    mapping (address => uint256) public balances;
    mapping (address => mapping (address => uint256)) public allowances;

    // CLV token logic contract address
    address public clvTokenAddress;

    constructor() public {
        clvTokenAddress = _msgSender();
    }

    // --- Balance functions --- 

    function getBalance(address _account) external view returns (uint) { 
        return balances[_account];
    }

    function setBalance(address _account, uint256 _newBalance) external {
        _requireCallerIsCLVToken();
        balances[_account] = _newBalance;
    }

    function addToBalance(address _account, uint256 _value) external {
        _requireCallerIsCLVToken();
        balances[_account] = balances[_account].add(_value);
    }

    function subFromBalance(address _account, uint256 _value) external {
        _requireCallerIsCLVToken();
        balances[_account] = balances[_account].sub(_value, 'ERC20: subtracted amount exceeds balance'); 
    }

    // --- Allowance functions ---
    
    function getAllowance(address _owner, address _spender) external view returns (uint) {
        return allowances[_owner][_spender];
    }

    function setAllowance(address _owner, address _spender, uint256 _allowance) external {
        _requireCallerIsCLVToken();
        allowances[_owner][_spender] = _allowance;
    }

    // --- 'require' functions ---

    function _requireCallerIsCLVToken() internal view {
        require(_msgSender() == clvTokenAddress, "CLVTokenData: Caller is not the CLVToken contract");
    }
}