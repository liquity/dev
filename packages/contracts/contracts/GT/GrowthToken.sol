// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/IERC20.sol";
import "../Dependencies/SafeMath.sol";
import "../Interfaces/ILockupContractFactory.sol";
import "../Dependencies/console.sol";

/**
Based upon OpenZeppelin's last ERC20 contract for Solidity 0.5.x:
https://github.com/OpenZeppelin/openzeppelin-contracts/blob/54ee1c7ff59462bc300c0dc96cb71eb1e3cbdb45/contracts/token/ERC20/ERC20.sol

Functionality added specific to the GrowthToken:

-Supply hard-capped at 100 million
-CommunityIssuance and LockupContractFactory addresses set at deployment
-2/3 of supply is minted to deployer at deployment
-1/3 of supply minted to CommunityIssuance contract at deployment

-Until one year from deployment:
    -Deployer may only transfer tokens to OneYearLockupContracts that have been deployed via & registered in the 
    Factory 
    -approve(), increaseAllowance(), decreaseAllowance() revert when called by the deployer
    -transferFrom() reverts when deployer is the sender

After one year has passed since deployment of the GrowthToken, the restrictions on deployer operations are lifted
and the deployer has the same rights as any other address.
 */

contract GrowthToken is IERC20 {
    using SafeMath for uint256;

    // --- Data ---
    string constant internal NAME = "LQTY";
    string constant internal SYMBOL = "LQTY";
    uint8 constant internal DECIMALS = 18;

    uint public constant ONE_YEAR_IN_SECONDS = 31536000;

    uint public _100_MILLION = 1e26;  // non-constant, for use with SafeMath

    mapping (address => uint256) private _balances;

    mapping (address => mapping (address => uint256)) private _allowances;

    uint private _totalSupply;

    uint public deploymentStartTime;

    address public deployer;
    address public communityIssuanceAddress;

    address public lockupFactoryAddress;
    ILockupContractFactory lockupContractFactory;

    // --- Events ---

    event CommunityIssuanceAddressSet(address _communityIssuanceAddress);
    event LockupContractFactoryAddressSet(address _lockupContractFactoryAddress);

    // --- Functions ---

    constructor(address _communityIssuanceAddress, address _lockupFactoryAddress) public {
        deployer = msg.sender;
        deploymentStartTime  = block.timestamp;
        
        communityIssuanceAddress = _communityIssuanceAddress;
        lockupFactoryAddress = _lockupFactoryAddress;
        lockupContractFactory = ILockupContractFactory(_lockupFactoryAddress);
        
        // mint 2/3 to deployer
        uint deployerEntitlement = _100_MILLION.mul(2).div(3);
        _mint(msg.sender, deployerEntitlement);

        // mint 1/3 to CommunityIssuance
        uint communityEntitlement = _100_MILLION.mul(1).div(3);
        _mint(communityIssuanceAddress, communityEntitlement);
    }

    // --- Public functions ---

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        // Restrict the deployer's transfers in first year
        if (_callerIsDeployer() && _isFirstYear()) {
            _requireRecipientIsRegisteredOYLC(recipient);
        }

        // Otherwise, standard transfer functionality
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) public view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public override returns (bool) {
        if (_isFirstYear()) {_requireCallerIsNotDeployer();}

        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
        if (_isFirstYear()) {_requireSenderIsNotDeployer(sender);}
        
        _transfer(sender, recipient, amount);
        _approve(sender, msg.sender, _allowances[sender][msg.sender].sub(amount, "ERC20: transfer amount exceeds allowance"));
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) public override returns (bool) {
        if (_isFirstYear()) {_requireCallerIsNotDeployer();}
        
        _approve(msg.sender, spender, _allowances[msg.sender][spender].add(addedValue));
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public override returns (bool) {
        if (_isFirstYear()) {_requireCallerIsNotDeployer();}
        
        _approve(msg.sender, spender, _allowances[msg.sender][spender].sub(subtractedValue, "ERC20: decreased allowance below zero"));
        return true;
    }

    // --- Internal operations ---

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _balances[sender] = _balances[sender].sub(amount, "ERC20: transfer amount exceeds balance");
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");

        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: burn from the zero address");

        _balances[account] = _balances[account].sub(amount, "ERC20: burn amount exceeds balance");
        _totalSupply = _totalSupply.sub(amount);
        emit Transfer(account, address(0), amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _burnFrom(address account, uint256 amount) internal {
        _burn(account, amount);
        _approve(account, msg.sender, _allowances[account][msg.sender].sub(amount, "ERC20: burn amount exceeds allowance"));
    }

    // --- Helper functions ---

    function _callerIsDeployer() internal view returns (bool) {
        return (msg.sender == deployer);
    }

    function _isFirstYear() internal view returns (bool) {
        return (block.timestamp.sub(deploymentStartTime) < ONE_YEAR_IN_SECONDS);
    }

    // --- 'require' functions ---

    function _requireRecipientIsRegisteredOYLC(address _recipient) internal view {
        require(lockupContractFactory.isRegisteredOneYearLockup(_recipient), 
        "GrowthToken: recipient must be a OYLC registered in the Factory");
    }

    function _requireSenderIsNotDeployer(address _sender) internal view {
        require(_sender != deployer, "GrowthToken: sender must not be the deployer");
    }

    function _requireCallerIsNotDeployer() internal view {
        require(!_callerIsDeployer(), "GrowthToken: caller must not be the deployer");
    }

    // --- Optional functions ---

    function name() external view override returns (string memory) {
        return NAME;
    }

    function symbol() external view override returns (string memory) {
        return SYMBOL;
    }

    function decimals() external view override returns (uint8) {
        return DECIMALS;
    }
}