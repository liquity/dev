pragma solidity 0.5.16;

import "./Interfaces/ICLVToken.sol";
import "./CLVTokenData.sol";
import "./Dependencies/ERC20.sol";
import "./Dependencies/IERC20.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract CLVToken is IERC20, ICLVToken, Ownable {
    using SafeMath for uint256;
    
    address public poolManagerAddress;

    address public borrowerOperationsAddress;

    uint256 public _totalSupply;

    CLVTokenData public clvTokenData;
    address public tokenDataAddress;

    constructor() public {
        clvTokenData = new CLVTokenData();
        tokenDataAddress = address(clvTokenData);
    }    

    // --- Events ---

    event PoolManagerAddressChanged( address _newPoolManagerAddress);
    event BorrowerOperationsAddressChanged( address _newBorrowerOperationsAddress);
    event CLVTokenBalanceUpdated(address _user, uint _amount);

    // --- Functions ---

    function setPoolManagerAddress(address _poolManagerAddress) external onlyOwner {
        poolManagerAddress =  _poolManagerAddress;
        emit PoolManagerAddressChanged(_poolManagerAddress);
    }

    function setBorrowerOperationsAddress(address _borrowerOperationsAddress) external onlyOwner {
        borrowerOperationsAddress = _borrowerOperationsAddress;
        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
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

    // --- 'require' functions ---

    function _requireCallerIsPoolManager() internal view {
        require(_msgSender() == poolManagerAddress, "CLVToken: Caller is not the PoolManager");
    }

    function _requireCallerIsPMorBO() internal view {
        require(_msgSender() == poolManagerAddress || _msgSender() == borrowerOperationsAddress, 
        "CLVToken: Caller is not the PM or CDPM");
    }

   // --- OPENZEPPELIN ERC20 FUNCTIONALITY ---

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        uint balance = clvTokenData.getBalance(account); 
        return balance; 
    }

    function transfer(address recipient, uint256 amount) public returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return clvTokenData.getAllowance(owner, spender);
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
        _transfer(sender, recipient, amount);
        uint newAllowance = clvTokenData.getAllowance(sender, _msgSender()).sub(amount, "ERC20: transfer amount exceeds allowance");
        _approve(sender, _msgSender(), newAllowance);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        uint newAllowance = clvTokenData.getAllowance(_msgSender(),spender).add(addedValue);
        _approve(_msgSender(), spender, newAllowance);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        uint newAllowance = clvTokenData.getAllowance(_msgSender(), spender).sub(subtractedValue, "ERC20: decreased allowance below zero");
        _approve(_msgSender(), spender, newAllowance);
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        clvTokenData.subFromBalance(sender, amount);
        clvTokenData.addToBalance(recipient, amount);
        emit Transfer(sender, recipient, amount);
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");

        _totalSupply = _totalSupply.add(amount);
        clvTokenData.addToBalance(account, amount);
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: burn from the zero address");  
        clvTokenData.subFromBalance(account, amount);  
        
        _totalSupply = _totalSupply.sub(amount);  

        emit Transfer(account, address(0), amount); 
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        clvTokenData.setAllowance(owner, spender, amount);
        emit Approval(owner, spender, amount);
    }

    function _burnFrom(address account, uint256 amount) internal {
        _burn(account, amount);
        uint newAllowance = clvTokenData.getAllowance(account, _msgSender()).sub(amount, "ERC20: burn amount exceeds allowance");
        _approve(account, _msgSender(), newAllowance);
    }
}
