// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/ICLVToken.sol";
import "./Dependencies/IERC20.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";

contract CLVToken is ICLVToken, Ownable {
    using SafeMath for uint256;
    uint256 public _totalSupply;

    string constant internal NAME = "LUSD Stablecoin";
    string constant internal SYMBOL = "LUSD";
    string constant internal VERSION = "1";
    uint8 constant internal DECIMALS = 18;
    
    // --- Necessary for EIP 2612 ---
    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 private immutable _PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
    
    // Mapping of ChainID to domain separators. This is a very gas efficient way
    // to not recalculate the domain separator on every call, while still
    // automatically detecting ChainID changes.
    mapping (uint256 => bytes32) private _domainSeparators;
    mapping (address => uint256) private _nonces;

    // User data for CLV token
    mapping (address => mapping (address => uint256)) public allowances;    
    mapping (address => uint256) public balances;

    // --- Addresses ---
    address public immutable cdpManagerAddress;
    address public immutable poolManagerAddress;
    address public immutable stabilityPoolAddress;
    address public immutable activePoolAddress;
    address public immutable defaultPoolAddress;
    address public immutable borrowerOperationsAddress;
    
    constructor( 
        address _cdpManagerAddress,
        address _poolManagerAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
        address _borrowerOperationsAddress
    ) public Ownable() {  
        cdpManagerAddress = _cdpManagerAddress;
        emit CDPManagerAddressChanged(_cdpManagerAddress);
        
        poolManagerAddress = _poolManagerAddress;
        emit PoolManagerAddressChanged(_poolManagerAddress);

        activePoolAddress = _activePoolAddress;
        emit ActivePoolAddressChanged( _activePoolAddress);

        defaultPoolAddress = _defaultPoolAddress;
        emit DefaultPoolAddressChanged(_defaultPoolAddress);

        stabilityPoolAddress = _stabilityPoolAddress;
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);

        borrowerOperationsAddress = _borrowerOperationsAddress;        
        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        
        _updateDomainSeparator();
        _renounceOwnership();
    }
  
    function mint(address _account, uint256 _amount) external override {
        _requireCallerIsPMorBO();
        _mint(_account, _amount); 
    }
    
    function burn(address _account, uint256 _amount) external override {
        _requireCallerIsPoolManager();
        _burn(_account, _amount); 
    }
    
    function sendToPool(address _sender,  address _poolAddress, uint256 _amount) external override {
        _requireCallerIsPoolManager();
        _transfer(_sender, _poolAddress, _amount);
    }
    
    function returnFromPool(address _poolAddress, address _receiver, uint256 _amount) external override {
        _requireCallerIsPoolManager();
        _transfer(_poolAddress, _receiver, _amount);
    }

    // --- Balance functions ---

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
    
    function _requireValidRecipient(address recipient) internal view {
        require(
            recipient != address(0) && 
            recipient != address(this) &&
            recipient != defaultPoolAddress, 
            "LUSD: Provided transfer recipient is not appropriate"
        );
        require(
            recipient != activePoolAddress &&
            recipient != cdpManagerAddress && 
            recipient != poolManagerAddress && 
            recipient != borrowerOperationsAddress,
            "LUSD: Use repay function instead to clear your debt"
        );
        require(
            recipient != stabilityPoolAddress || 
            _msgSender() == poolManagerAddress, 
            "LUSD: Sender must be PoolManager if recipient is StabilityPool"
        );
    }

    function _requireValidSpender(address spender) internal view {
        require(
            spender != address(0) && 
            spender != address(this) &&
            spender != activePoolAddress &&
            spender != defaultPoolAddress &&
            spender != cdpManagerAddress &&
            spender != poolManagerAddress && 
            spender != stabilityPoolAddress &&
            spender != borrowerOperationsAddress,
            "LUSD: Provided spender is not appropriate"
        );
    }

    function _requireCallerIsPoolManager() internal view {
        require(_msgSender() == poolManagerAddress, "LUSD: Caller is not the PoolManager");
    }

    function _requireCallerIsPMorBO() internal view {
        require(_msgSender() == poolManagerAddress || _msgSender() == borrowerOperationsAddress, 
        "LUSD: Caller is not the PM or BO");
    }

    // --- OPENZEPPELIN ERC20 FUNCTIONALITY ---

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }
    
    function nonces(address owner) public view override returns (uint256) { // FOR EIP 2612
        return _nonces[owner];
    }

    function balanceOf(address account) public view override returns (uint256) {
        return balances[account];
    }
    
    function allowance(address owner, address spender) external view override returns (uint256) {
        return getAllowance(owner, spender);
    }

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        _transfer(sender, recipient, amount);
        uint newAllowance = getAllowance(sender, _msgSender()).sub(amount, "ERC20: transfer amount exceeds allowance");
        _approve(sender, _msgSender(), newAllowance);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) external override returns (bool) {
        uint newAllowance = getAllowance(_msgSender(),spender).add(addedValue);
        _approve(_msgSender(), spender, newAllowance);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) external override returns (bool) {
        uint newAllowance = getAllowance(_msgSender(), spender).sub(subtractedValue, "ERC20: decreased allowance below zero");
        _approve(_msgSender(), spender, newAllowance);
        return true;
    }

    // --- OPENZEPPELIN EIP 2612 FUNCTIONALITY ---

    function permit(address owner, address spender, uint amount, 
                    uint deadline, uint8 v, bytes32 r, bytes32 s) 
    external 
    override 
    {            
        require(deadline == 0 || deadline >= now, 'LUSD: EXPIRED');
        bytes32 digest = keccak256(abi.encodePacked(uint16(0x1901), 
                      _domainSeparator(), keccak256(abi.encode(
                      _PERMIT_TYPEHASH, owner, spender, amount, 
                      _nonces[owner]++, deadline))));

        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress != address(0) && 
                recoveredAddress == owner, 'LUSD: BAD_SIG');
        _approve(owner, spender, amount);
    }

    // --- Helper functions ---

    // Returns the domain separator, updating it if chainID changes
    function _domainSeparator() private returns (bytes32) {
        bytes32 domainSeparator = _domainSeparators[_chainID()];
        if (domainSeparator != 0x00) {
            return domainSeparator;
        } else {
            return _updateDomainSeparator();
        }
    }
    function _updateDomainSeparator() private returns (bytes32 domainSeparator) {
        uint256 chainID = _chainID();
        domainSeparator = keccak256(abi.encode( 
            keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
            keccak256(bytes(NAME)), keccak256(bytes(VERSION)), chainID, address(this)));
            
        _domainSeparators[chainID] = domainSeparator;
    }
    function _chainID() private pure returns (uint256 chainID) {
        assembly {
            chainID := chainid()
        }
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != sender, "ERC20: transfer sender and recipient are the same");
        _requireValidRecipient(recipient);
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
        require(spender != owner, "ERC20: approver and spender are the same address");
        _requireValidSpender(spender);

        allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    // --- Optional functions ---

    function name() external view override returns (string memory) {
        return NAME;
    }

    function symbol() external view override returns (string memory) {
        return SYMBOL;
    }

    function version() external pure returns (string memory) {
        return VERSION;
    }

    function decimals() external view override returns (uint8) {
        return DECIMALS;
    }
}
