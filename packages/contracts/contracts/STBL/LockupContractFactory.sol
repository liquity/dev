// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Dependencies/CheckContract.sol";
import "../Dependencies/Ownable.sol";
import "../Interfaces/ILockupContractFactory.sol";
import "./TwoMonthsLockupContract.sol";
import "./SixMonthsLockupContract.sol";
import "./OneYearLockupContract.sol";
import "../Dependencies/console.sol";

/*
* The LockupContractFactory deploys LockupContracts - its main purpose is to keep a registry of valid deployed 
* LockupContracts. 
* 
* This registry is checked by STBLToken when the Stabilio deployer attempts to transfer STBL tokens. During the first two months, six months or one year
* since system deployment, the Stabilio deployer is only allowed to transfer STBL to valid LockupContracts that have been 
* deployed by and recorded in the LockupContractFactory. This ensures the deployer's STBL can't be traded or staked in the
* first two, six months and one year, and can only be sent to a verified TwoMonthsLockupContract, SixMonthsLockupContract or OneYearLockupContract which unlocks at least two motnhs, six months or one year after system deployment.
*
* LockupContracts can of course be deployed directly, but only those deployed through and recorded in the LockupContractFactory 
* will be considered "valid" by STBLToken. This is a convenient way to verify that the target address is a genuine TwoMonthsLockupContract,
* SixMonthsLockupContract or OneYearLockupContract.
*/

contract LockupContractFactory is ILockupContractFactory, Ownable, CheckContract {

    // --- Data ---
    string constant public NAME = "LockupContractFactory";

    uint256 constant public SECONDS_IN_ONE_YEAR = 31536000;

    address public stblTokenAddress;
    
    mapping (address => address) public twoMonthsLockupContractToDeployer;
    mapping (address => address) public sixMonthsLockupContractToDeployer;
    mapping (address => address) public oneYearLockupContractToDeployer;

    // --- Functions ---

    function setSTBLTokenAddress(address _stblTokenAddress) external override onlyOwner {
        checkContract(_stblTokenAddress);

        stblTokenAddress = _stblTokenAddress;
        emit STBLTokenAddressSet(_stblTokenAddress);

        _renounceOwnership();
    }

    function deployTwoMonthsLockupContract(address _beneficiary, uint256 _unlockTime) external override {
        address stblTokenAddressCached = stblTokenAddress;
        _requireSTBLAddressIsSet(stblTokenAddressCached);
        TwoMonthsLockupContract twoMonthsLockupContract = new TwoMonthsLockupContract(
                                                        stblTokenAddressCached,
                                                        _beneficiary, 
                                                        _unlockTime);

        twoMonthsLockupContractToDeployer[address(twoMonthsLockupContract)] = msg.sender;
        emit TwoMonthsLockupContractDeployedThroughFactory(address(twoMonthsLockupContract), _beneficiary, _unlockTime, msg.sender);
    }

    function deploySixMonthsLockupContract(address _beneficiary, uint256 _unlockTime) external override {
        address stblTokenAddressCached = stblTokenAddress;
        _requireSTBLAddressIsSet(stblTokenAddressCached);
        SixMonthsLockupContract sixMonthsLockupContract = new SixMonthsLockupContract(
                                                        stblTokenAddressCached,
                                                        _beneficiary, 
                                                        _unlockTime);

        sixMonthsLockupContractToDeployer[address(sixMonthsLockupContract)] = msg.sender;
        emit SixMonthsLockupContractDeployedThroughFactory(address(sixMonthsLockupContract), _beneficiary, _unlockTime, msg.sender);
    }

    function deployOneYearLockupContract(address _beneficiary, uint256 _unlockTime) external override {
        address stblTokenAddressCached = stblTokenAddress;
        _requireSTBLAddressIsSet(stblTokenAddressCached);
        OneYearLockupContract oneYearLockupContract = new OneYearLockupContract(
                                                        stblTokenAddressCached,
                                                        _beneficiary, 
                                                        _unlockTime);

        oneYearLockupContractToDeployer[address(oneYearLockupContract)] = msg.sender;
        emit OneYearLockupContractDeployedThroughFactory(address(oneYearLockupContract), _beneficiary, _unlockTime, msg.sender);
    }

    function isRegisteredTwoMonthsLockup(address _contractAddress) public view override returns (bool) {
        return twoMonthsLockupContractToDeployer[_contractAddress] != address(0);
    }

    function isRegisteredSixMonthsLockup(address _contractAddress) public view override returns (bool) {
        return sixMonthsLockupContractToDeployer[_contractAddress] != address(0);
    }

    function isRegisteredOneYearLockup(address _contractAddress) public view override returns (bool) {
        return oneYearLockupContractToDeployer[_contractAddress] != address(0);
    }

    // --- 'require'  functions ---
    function _requireSTBLAddressIsSet(address _stblTokenAddress) internal pure {
        require(_stblTokenAddress != address(0), "LCF: STBL Address is not set");
    }
}
