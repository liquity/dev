// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Dependencies/CheckContract.sol";
import "../Interfaces/ISTBLToken.sol";
import "../Interfaces/ILockupContractFactory.sol";
import "../Dependencies/console.sol";

/*
* Based upon OpenZeppelin's ERC20 contract:
* https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol
*  
* and their EIP2612 (ERC20Permit / ERC712) functionality:
* https://github.com/OpenZeppelin/openzeppelin-contracts/blob/53516bc555a454862470e7860a9b5254db4d00f5/contracts/token/ERC20/ERC20Permit.sol
* 
*
*  --- Functionality added specific to the STBLToken ---
* 
* 1) Transfer protection: blacklist of addresses that are invalid recipients (i.e. core Liquity contracts) in external 
* transfer() and transferFrom() calls. The purpose is to protect users from losing tokens by mistakenly sending STBL directly to a Liquity
* core contract, when they should rather call the right function.
*
* 2) sendToSTBLStaking(): callable only by Liquity core contracts, which move STBL tokens from user -> STBLStaking contract.
*
* 3) Supply hard-capped at 100 million
*
* 4) CommunityIssuance and LockupContractFactory addresses are set at deployment
*
* 5) The bug bounties / hackathons allocation of 2 million tokens is minted at deployment to an EOA

* 6) 32 million tokens are minted at deployment to the CommunityIssuance contract
*
* 7) The LP rewards allocation of (1 + 1/3) million tokens is minted at deployent to a Staking contract
*
* 8) (64 + 2/3) million tokens are minted at deployment to the Liquity multisig
*
* 9) Until one year from deployment:
* -Liquity multisig may only transfer() tokens to LockupContracts that have been deployed via & registered in the 
*  LockupContractFactory 
* -approve(), increaseAllowance(), decreaseAllowance() revert when called by the multisig
* -transferFrom() reverts when the multisig is the sender
* -sendToSTBLStaking() reverts when the multisig is the sender, blocking the multisig from staking its STBL.
* 
* After one year has passed since deployment of the STBLToken, the restrictions on multisig operations are lifted
* and the multisig has the same rights as any other address.
*/

contract STBLToken is CheckContract, ISTBLToken {

    // --- ERC20 Data ---

    string constant internal _NAME = "STBL";
    string constant internal _SYMBOL = "STBL";
    string constant internal _VERSION = "1";
    uint8 constant internal  _DECIMALS = 18;

    mapping (address => uint256) private _balances;
    mapping (address => mapping (address => uint256)) private _allowances;
    uint256 private _totalSupply;

    // --- EIP 2612 Data ---

    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 private constant _PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
    // keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant _TYPE_HASH = 0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f;

    // Cache the domain separator as an immutable value, but also store the chain id that it corresponds to, in order to
    // invalidate the cached domain separator if the chain id changes.
    bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;
    uint256 private immutable _CACHED_CHAIN_ID;

    bytes32 private immutable _HASHED_NAME;
    bytes32 private immutable _HASHED_VERSION;
    
    mapping (address => uint256) private _nonces;

    // --- STBLToken specific data ---

    uint256 public constant SIX_MONTHS_IN_SECONDS = 15552000;  // 60 * 60 * 24 * 180

    uint256 public constant ONE_YEAR_IN_SECONDS = 31536000;  // 60 * 60 * 24 * 365

    // uint256 for use with SafeMath
    uint256 internal _1_MILLION = 1e24;    // 1e6 * 1e18 = 1e24

    uint256 internal immutable deploymentStartTime;
    address public immutable momentZeroMultisigAddress;
    address public immutable sixMonthsMultisigAddress;
    address public immutable oneYearMultisigAddress;

    address public immutable communityIssuanceAddress;
    address public immutable stblStakingAddress;

    uint256 internal immutable lpRewardsEntitlement;

    ILockupContractFactory public immutable lockupContractFactory;

    // --- Functions ---

    constructor
    (
        address _communityIssuanceAddress, 
        address _stblStakingAddress,
        address _lockupFactoryAddress,
        address _bountyAddress,
        address _lpRewardsAddress,
        address _momentZeroMultisigAddress,
        address _sixMonthsMultisigAddress,
        address _oneYearMultisigAddress
    ) 
        public 
    {
        checkContract(_communityIssuanceAddress);
        checkContract(_stblStakingAddress);
        checkContract(_lockupFactoryAddress);

        momentZeroMultisigAddress = _momentZeroMultisigAddress;
        sixMonthsMultisigAddress = _sixMonthsMultisigAddress;
        oneYearMultisigAddress = _oneYearMultisigAddress;
        deploymentStartTime  = block.timestamp;
        
        communityIssuanceAddress = _communityIssuanceAddress;
        stblStakingAddress = _stblStakingAddress;
        lockupContractFactory = ILockupContractFactory(_lockupFactoryAddress);

        bytes32 hashedName = keccak256(bytes(_NAME));
        bytes32 hashedVersion = keccak256(bytes(_VERSION));

        _HASHED_NAME = hashedName;
        _HASHED_VERSION = hashedVersion;
        _CACHED_CHAIN_ID = _chainID();
        _CACHED_DOMAIN_SEPARATOR = _buildDomainSeparator(_TYPE_HASH, hashedName, hashedVersion);
        
        // --- Initial STBL allocations ---
     
        uint256 bountyEntitlement = _1_MILLION * 2; // Allocate 2 million for bounties/hackathons/community activies
        _mint(_bountyAddress, bountyEntitlement);

        uint256 depositorsAndFrontEndsEntitlement = _1_MILLION * 32; // Allocate 32 million to the algorithmic issuance schedule
        _mint(_communityIssuanceAddress, depositorsAndFrontEndsEntitlement);

        uint256 _lpRewardsEntitlement = _1_MILLION * 4 / 3;  // Allocate 1.33 million for LP rewards
        lpRewardsEntitlement = _lpRewardsEntitlement;
        _mint(_lpRewardsAddress, _lpRewardsEntitlement);

        uint256 momentZeroMultisigEntitlement = _1_MILLION * 15; // Allocate 15 million for multisig address - (Team/Investors)
        _mint(_momentZeroMultisigAddress, momentZeroMultisigEntitlement);

        // Allocate 25 million for Multisig in six months - (Team/Investors)
        uint256 sixMonthsMultisigEntitlement = _1_MILLION * 20;

        _mint(_sixMonthsMultisigAddress, sixMonthsMultisigEntitlement);
        
        // Allocate the remainder to the Multisig in one year - (Team/Investors): (100 - 2 - 32 - 1.33 - 15 - 10 - 20) million = 29.67 million
        uint256 oneYearMultisigEntitlement = _1_MILLION * 100
            - bountyEntitlement
            - depositorsAndFrontEndsEntitlement
            - _lpRewardsEntitlement
            - momentZeroMultisigEntitlement
            - sixMonthsMultisigEntitlement;

        _mint(_oneYearMultisigAddress, oneYearMultisigEntitlement);
    }

    // --- External functions ---

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function getDeploymentStartTime() external view override returns (uint256) {
        return deploymentStartTime;
    }

    function getLpRewardsEntitlement() external view override returns (uint256) {
        return lpRewardsEntitlement;
    }

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        if (_callerIsSixMonthsMultisig() && _isFirstSixMonths()) { _requireRecipientIsRegisteredSixMonthsLC(recipient); }
        if (_callerIsOneYearMultisig() && _isFirstYear()) { _requireRecipientIsRegisteredOneYearLC(recipient); }

        _requireValidRecipient(recipient);

        // Otherwise, standard transfer functionality
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        if (_isFirstSixMonths()) { _requireCallerIsNotSixMonthsMultisig(); }
        if (_isFirstYear()) { _requireCallerIsNotOneYearMultisig(); }

        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        if (_isFirstSixMonths()) { _requireSenderIsNotSixMonthsMultisig(sender); }
        if (_isFirstYear()) { _requireSenderIsNotOneYearMultisig(sender); }
        
        _requireValidRecipient(recipient);

        _transfer(sender, recipient, amount);
        uint256 currentAllowance = _allowances[sender][msg.sender];
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        _approve(sender, msg.sender, currentAllowance - amount);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) external override returns (bool) {
        if (_isFirstSixMonths()) { _requireCallerIsNotSixMonthsMultisig(); }
        if (_isFirstYear()) { _requireCallerIsNotOneYearMultisig(); }
        
        _approve(msg.sender, spender, _allowances[msg.sender][spender] + addedValue);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) external override returns (bool) {
        if (_isFirstSixMonths()) { _requireCallerIsNotSixMonthsMultisig(); }
        if (_isFirstYear()) { _requireCallerIsNotOneYearMultisig(); }
        
        uint256 currentAllowance = _allowances[msg.sender][spender];
        require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");
        _approve(msg.sender, spender, currentAllowance - subtractedValue);
        return true;
    }

    function sendToSTBLStaking(address _sender, uint256 _amount) external override {
        _requireCallerIsSTBLStaking();
        
        if (_isFirstSixMonths()) { _requireSenderIsNotSixMonthsMultisig(_sender); }
        if (_isFirstYear()) { _requireSenderIsNotOneYearMultisig(_sender); }

        _transfer(_sender, stblStakingAddress, _amount);
    }

    // --- EIP 2612 functionality ---

    function domainSeparator() public view override returns (bytes32) {    
        if (_chainID() == _CACHED_CHAIN_ID) {
            return _CACHED_DOMAIN_SEPARATOR;
        } else {
            return _buildDomainSeparator(_TYPE_HASH, _HASHED_NAME, _HASHED_VERSION);
        }
    }

    function permit
    (
        address owner, 
        address spender, 
        uint256 amount, 
        uint256 deadline, 
        uint8 v, 
        bytes32 r, 
        bytes32 s
    ) 
        external 
        override 
    {            
        require(deadline >= block.timestamp, 'STBL: expired deadline');
        bytes32 digest = keccak256(abi.encodePacked('\x19\x01', 
                         domainSeparator(), keccak256(abi.encode(
                         _PERMIT_TYPEHASH, owner, spender, amount, 
                         _nonces[owner]++, deadline))));
        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress == owner, 'STBL: invalid signature');
        _approve(owner, spender, amount);
    }

    function nonces(address owner) external view override returns (uint256) { // FOR EIP 2612
        return _nonces[owner];
    }

    // --- Internal operations ---

    function _chainID() private view returns (uint256 chainID) {
        assembly {
            chainID := chainid()
        }
    }

    function _buildDomainSeparator(bytes32 typeHash, bytes32 name, bytes32 version) private view returns (bytes32) {
        return keccak256(abi.encode(typeHash, name, version, _chainID(), address(this)));
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");
        require(_balances[sender] >= amount, "ERC20: transfer amount exceeds balance");

        _balances[sender] -= amount;
        _balances[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }
    
    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");

        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
    
    // --- Helper functions ---

    function _callerIsSixMonthsMultisig() internal view returns (bool) {
        return (msg.sender == sixMonthsMultisigAddress);
    }

    function _callerIsOneYearMultisig() internal view returns (bool) {
        return (msg.sender == oneYearMultisigAddress);
    }

    function _isFirstSixMonths() internal view returns (bool) {
        return ((block.timestamp - deploymentStartTime) < SIX_MONTHS_IN_SECONDS);
    }

    function _isFirstYear() internal view returns (bool) {
        return ((block.timestamp - deploymentStartTime) < ONE_YEAR_IN_SECONDS);
    }

    // --- 'require' functions ---
    
    function _requireValidRecipient(address _recipient) internal view {
        require(
            _recipient != address(0) && 
            _recipient != address(this),
            "STBL: Cannot transfer tokens directly to the STBL token contract or the zero address"
        );
        require(
            _recipient != communityIssuanceAddress &&
            _recipient != stblStakingAddress,
            "STBL: Cannot transfer tokens directly to the community issuance or staking contract"
        );
    }

    function _requireRecipientIsRegisteredSixMonthsLC(address _recipient) internal view {
        require(lockupContractFactory.isRegisteredSixMonthsLockup(_recipient), 
        "STBLToken: recipient must be a LockupContract registered in the Factory");
    }

    function _requireRecipientIsRegisteredOneYearLC(address _recipient) internal view {
        require(lockupContractFactory.isRegisteredOneYearLockup(_recipient), 
        "STBLToken: recipient must be a LockupContract registered in the Factory");
    }

    function _requireSenderIsNotSixMonthsMultisig(address _sender) internal view {
        require(_sender != sixMonthsMultisigAddress, "STBLToken: sender must not be the multisig");
    }

    function _requireSenderIsNotOneYearMultisig(address _sender) internal view {
        require(_sender != oneYearMultisigAddress, "STBLToken: sender must not be the multisig");
    }

    function _requireCallerIsNotSixMonthsMultisig() internal view {
        require(!_callerIsSixMonthsMultisig(), "STBLToken: caller must not be the multisig");
    }

    function _requireCallerIsNotOneYearMultisig() internal view {
        require(!_callerIsOneYearMultisig(), "STBLToken: caller must not be the multisig");
    }

    function _requireCallerIsSTBLStaking() internal view {
         require(msg.sender == stblStakingAddress, "STBLToken: caller must be the STBLStaking contract");
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
