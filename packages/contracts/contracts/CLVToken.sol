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
    string constant internal _NAME = "LUSD Stablecoin";
    string constant internal _SYMBOL = "LUSD";
    string constant internal _VERSION = "1";
    uint8 constant internal _DECIMALS = 18;
    
    // --- Necessary for EIP 2612 ---
    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 constant internal _PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
    mapping (address => uint256) private _nonces;
    
    // User data for CLV token
    mapping (address => mapping (address => uint256)) public allowances;    
    mapping (address => uint256) public balances;
    
    // --- Addresses ---
    address public immutable cdpManagerAddress;
    address public immutable stabilityPoolAddress;
    address public immutable borrowerOperationsAddress;
    
    constructor( 
        address _cdpManagerAddress,
        address _stabilityPoolAddress,
        address _borrowerOperationsAddress
    ) public Ownable() {  
        cdpManagerAddress = _cdpManagerAddress;
        emit CDPManagerAddressChanged(_cdpManagerAddress);

        stabilityPoolAddress = _stabilityPoolAddress;
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);

        borrowerOperationsAddress = _borrowerOperationsAddress;        
        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        
        _renounceOwnership();
    }

    function mint(address _account, uint256 _amount) external override {
        _requireCallerIsBorrowerOperations();
        _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) external override {
        _requireCallerIsBOorCDPMorSP();
        _burn(_account, _amount);
    }

    function sendToPool(address _sender,  address _poolAddress, uint256 _amount) external override {
        _requireCallerIsStabilityPool();
        _transfer(_sender, _poolAddress, _amount);
    }

    function returnFromPool(address _poolAddress, address _receiver, uint256 _amount) external override {
        _requireCallerIsCDPMorSP();
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
            recipient != stabilityPoolAddress,
            "LUSD: Provided transfer recipient is not appropriate"
        );
        require(
            recipient != cdpManagerAddress && 
            recipient != borrowerOperationsAddress,
            "LUSD: Use repay function instead to clear your debt"
        );
    }

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "CLVToken: Caller is not BorrowerOperations");
    }

    function _requireCallerIsBOorCDPMorSP() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == cdpManagerAddress ||
            msg.sender == stabilityPoolAddress,
            "CLVToken: Caller is neither BorrowerOperations nor CDPManager nor StabilityPool");
    }

    function _requireCallerIsStabilityPool() internal view {
        require(msg.sender == stabilityPoolAddress, "CLVToken: Caller is not the StabilityPool");
    }

    function _requireCallerIsCDPMorSP() internal view {
        require(
            msg.sender == cdpManagerAddress || msg.sender == stabilityPoolAddress,
            "CLVToken: Caller is neither CDPManager nor StabilityPool");
    }

    // --- OPENZEPPELIN ERC20 FUNCTIONALITY ---

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return balances[account];
    }

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _requireValidRecipient(recipient);
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return getAllowance(owner, spender);
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        _transfer(sender, recipient, amount);
        uint newAllowance = getAllowance(sender, msg.sender).sub(amount, "ERC20: transfer amount exceeds allowance");
        _approve(sender, msg.sender, newAllowance);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) external override returns (bool) {
        uint newAllowance = getAllowance(msg.sender, spender).add(addedValue);
        _approve(msg.sender, spender, newAllowance);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) external override returns (bool) {
        uint newAllowance = getAllowance(msg.sender, spender).sub(subtractedValue, "ERC20: decreased allowance below zero");
        _approve(msg.sender, spender, newAllowance);
        return true;
    }

    // --- OPENZEPPELIN EIP 2612 FUNCTIONALITY ---

    function domainSeparator() external view override returns (bytes32) {    
        return keccak256(abi.encode( 
               keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
               keccak256(bytes(_NAME)), 
               keccak256(bytes(_VERSION)), 
               _chainID(), address(this)));
    }

    function permit
    (
        address owner, 
        address spender, 
        uint amount, 
        uint deadline, 
        uint8 v, 
        bytes32 r, 
        bytes32 s
    ) 
        external 
        override 
    {            
        require(deadline == 0 || deadline >= now, 'LUSD: EXPIRED');
        bytes32 digest = keccak256(abi.encodePacked(uint16(0x1901), 
                         this.domainSeparator(), keccak256(abi.encode(
                         _PERMIT_TYPEHASH, owner, spender, amount, 
                         _nonces[owner]++, deadline))));
        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress != address(0) && 
                recoveredAddress == owner, 'LUSD: BAD_SIG');
        _approve(owner, spender, amount);
    }

    function nonces(address owner) public view override returns (uint256) { // FOR EIP 2612
        return _nonces[owner];
    }

    function _chainID() private pure returns (uint256 chainID) {
        assembly {
            chainID := chainid()
        }
    }

    // --- Helper functions ---

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != sender, "ERC20: transfer sender and recipient are the same");
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
        require(spender != owner, "ERC20: approver and spender are the same address");
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");
        allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    // --- Optional functions ---

    function name() external view override returns (string memory) {
        return _NAME;
    }

    function symbol() external view override returns (string memory) {
        return _SYMBOL;
    }

    function decimals() external view override returns (uint8) {
        return _DECIMALS;
    }

    function version() external view override returns (string memory) {
        return _VERSION;
    }

    function permitTypeHash() external view override returns (bytes32) {
        return _PERMIT_TYPEHASH;
    }
}
