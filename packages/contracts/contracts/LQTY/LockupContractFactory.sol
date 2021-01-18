// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/CheckContract.sol";
import "../Dependencies/SafeMath.sol";
import "../Interfaces/ILockupContractFactory.sol";
import "./LockupContract.sol";
import "../Dependencies/console.sol";

/*
* The LockupContractFactory deploys LockupContracts - its main purpose is to keep a registry of valid deployed 
* LockupContracts. 
* 
* This registry is checked by LQTYToken when the Liquity deployer attempts to transfer LQTY tokens. During the first year 
* since system deployment, the Liquity deployer is only allowed to transfer LQTY to valid LockupContracts that have been 
* deployed by and recorded in the LockupContractFactory. This ensures the deployer's LQTY can't be traded or staked in the
* first year, and can only be sent to a verified LockupContract which unlocks at least one year after system deployment.
*
* LockupContracts can of course be deployed directly, but only those deployed through and recorded in the LockupContractFactory 
* will be considered "valid" by LQTYToken. This is a convenient way to verify that the target address is a genuine 
* LockupContract.
*/

contract LockupContractFactory is ILockupContractFactory {
    using SafeMath for uint;

    // --- Data ---
    uint constant public SECONDS_IN_ONE_YEAR = 31536000;

    address public immutable deployer;

    address public lqtyTokenAddress;
    
    mapping (address => address) public lockupContractToDeployer;

    // --- Events ---

    event LQTYTokenAddressSet(address _lqtyTokenAddress);
    event LockupContractDeployed(address _lockupContractAddress, address _beneficiary, uint _unlockTime);

    // --- Functions ---

    constructor () public {
        deployer = msg.sender;
    }

    function setLQTYTokenAddress(address _lqtyTokenAddress) external override {
        _requireCallerIsFactoryDeployer();
        
        lqtyTokenAddress = _lqtyTokenAddress;
        emit LQTYTokenAddressSet(_lqtyTokenAddress);
    }

    function deployLockupContract(address _beneficiary, uint _unlockTime) external override {
        _requireLQTYAddressIsSet();
        LockupContract lockupContract = new LockupContract(
                                                        lqtyTokenAddress, 
                                                        _beneficiary, 
                                                        _unlockTime);

        lockupContractToDeployer[address(lockupContract)] = msg.sender;
        emit LockupContractDeployed(address(lockupContract), _beneficiary, _unlockTime);
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
        require(lqtyTokenAddress != address(0), "LCF: LQTY Address is not set");
    }
}
