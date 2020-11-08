pragma solidity 0.5.16;

import "./Interfaces/ICLVToken.sol";
import "./Dependencies/IERC20.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract CLVToken is IERC20, ICLVToken, Ownable {
    using SafeMath for uint256;

    string constant internal NAME = "LUSD";
    string constant internal SYMBOL = "LUSD";
    uint8 constant internal DECIMALS = 18;

    // User data for CLV token
    mapping (address => uint256) public balances;
    mapping (address => mapping (address => uint256)) public allowances;

    address public poolManagerAddress;
    address public borrowerOperationsAddress;

    uint256 public _totalSupply;

    // --- Events ---

    event PoolManagerAddressChanged( address _newPoolManagerAddress);
    event BorrowerOperationsAddressChanged( address _newBorrowerOperationsAddress);
    event CLVTokenBalanceUpdated(address _user, uint _amount);

    // --- Functions ---

     function setAddresses(
        address _poolManagerAddress,
        address _borrowerOperationsAddress
    )
        external
        onlyOwner
    {
        borrowerOperationsAddress = _borrowerOperationsAddress;
        poolManagerAddress = _poolManagerAddress;
       
        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit PoolManagerAddressChanged(_poolManagerAddress);
        
        _renounceOwnership();
    }
  
    function mint(address _account, uint256 _amount) external  {
        _requireCallerIsPMorBO();
        _mint(_account, _amount); 
    }
    
    function burn(address _account, uint256 _amount) external {
        _requireCallerIsPoolManager();
        _burn(_account, _amount); 
    }
    
    function sendToPool(address _sender,  address _poolAddress, uint256 _amount) external {
        _requireCallerIsPoolManager();
        _transfer(_sender, _poolAddress, _amount);
    }
    
    function returnFromPool(address _poolAddress, address _receiver, uint256 _amount) external {
        _requireCallerIsPoolManager();
        _transfer(_poolAddress, _receiver, _amount);
    }

    // --- Balance functions ---

    function getBalance(address _account) external view returns (uint) {
        return balanceOf(_account);
    }

    function _addToBalance(address _account, uint256 _value) internal {
        balances[_account] = balances[_account].add(_value);
    }

    function _subFromBalance(address _account, uint256 _value) internal {
        balances[_account] = balances[_account].sub(_value, 'ERC20: subtracted amount exceeds balance');
    }

    // --- Allowance functions ---

    function getAllowance(address _owner, address _spender) public view returns (uint) {
        return allowances[_owner][_spender];
    }

    // --- 'require' functions ---

    function _requireCallerIsPoolManager() internal view {
        require(_msgSender() == poolManagerAddress, "CLVToken: Caller is not the PoolManager");
    }

    function _requireCallerIsPMorBO() internal view {
        require(_msgSender() == poolManagerAddress || _msgSender() == borrowerOperationsAddress, 
        "CLVToken: Caller is not the PM or BO");
    }

    // --- OPENZEPPELIN ERC20 FUNCTIONALITY ---

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return balances[account];
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return getAllowance(owner, spender);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        _transfer(sender, recipient, amount);
        uint newAllowance = getAllowance(sender, _msgSender()).sub(amount, "ERC20: transfer amount exceeds allowance");
        _approve(sender, _msgSender(), newAllowance);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) external returns (bool) {
        uint newAllowance = getAllowance(_msgSender(),spender).add(addedValue);
        _approve(_msgSender(), spender, newAllowance);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
        uint newAllowance = getAllowance(_msgSender(), spender).sub(subtractedValue, "ERC20: decreased allowance below zero");
        _approve(_msgSender(), spender, newAllowance);
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _subFromBalance(sender, amount);
        _addToBalance(recipient, amount);
        emit Transfer(sender, recipient, amount);
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");

        _totalSupply = _totalSupply.add(amount);
        _addToBalance(account, amount);
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: burn from the zero address");  
        _subFromBalance(account, amount);
        
        _totalSupply = _totalSupply.sub(amount);  

        emit Transfer(account, address(0), amount); 
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    // --- Optional functions ---

    function name() external view returns (string memory) {
        return NAME;
    }

    function symbol() external view returns (string memory) {
        return SYMBOL;
    }

    function decimals() external view returns (uint8) {
        return DECIMALS;
    }
}
