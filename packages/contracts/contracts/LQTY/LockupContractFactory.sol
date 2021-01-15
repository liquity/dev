// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/CheckContract.sol";
import "../Dependencies/SafeMath.sol";
import "../Interfaces/ILockupContractFactory.sol";
import "./LockupContract.sol";
import "../Dependencies/console.sol";

contract LockupContractFactory is CheckContract, ILockupContractFactory {
    using SafeMath for uint;

    // --- Data ---
    uint constant public SECONDS_IN_ONE_YEAR = 31536000;

    address public immutable deployer;

    ILQTYToken public lqtyToken;
    
    mapping (address => address) public lockupContractToDeployer;

    // --- Events ---

    event LQTYTokenAddressSet(address _lqtyTokenAddress);
    event LockupContractDeployed(address _lockupContractAddress, address _beneficiary, uint _entitlement, uint _unlockTime);

    // --- Functions ---

    constructor () public {
        deployer = msg.sender;
    }

    function setLQTYTokenAddress(address _lqtyTokenAddress) external override {
        _requireCallerIsFactoryDeployer();
        checkContract(_lqtyTokenAddress);

        lqtyToken = ILQTYToken(_lqtyTokenAddress);
        emit LQTYTokenAddressSet(_lqtyTokenAddress);
    }

    function deployLockupContract(address _beneficiary, uint _initialEntitlement, uint _unlockTime) external override {
        _requireLQTYAddressIsSet();
        LockupContract lockupContract = new LockupContract(
                                                        address(lqtyToken), 
                                                        _beneficiary, 
                                                        _initialEntitlement,
                                                        _unlockTime);

        lockupContractToDeployer[address(lockupContract)] = msg.sender;
        emit LockupContractDeployed(address(lockupContract), _beneficiary, _initialEntitlement, _unlockTime);
    }

    function isRegisteredLockup(address _contractAddress) public view override returns (bool) {
        bool isRegistered = lockupContractToDeployer[_contractAddress] != address(0);
        return isRegistered;
    }

    // --- 'require'  functions ---

    function _requireCallerIsFactoryDeployer() internal view {
        require(msg.sender == deployer, "LCF: caller is not LCF deployer");
    }

    function _requireLQTYAddressIsSet() internal view {
        require(address(lqtyToken) != address(0), "LCF: LQTY Address is not set");
    }
}
