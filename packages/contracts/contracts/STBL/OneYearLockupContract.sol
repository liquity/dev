// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Interfaces/ISTBLToken.sol";

/*
* The lockup contract architecture utilizes a single OneYearLockupContract, with an unlockTime. The unlockTime is passed as an argument 
* to the OneYearLockupContract's constructor. The contract's balance can be withdrawn by the beneficiary when block.timestamp > unlockTime. 
* At construction, the contract checks that unlockTime is at least one year later than the Stabilio system's deployment time. 

* Within the first year from deployment, the deployer of the STBLToken (Stabilio AG's address) may transfer STBL only to valid 
* LockupContracts, and no other addresses (this is enforced in STBLToken.sol's transfer() function).
* 
* The above two restrictions ensure that until one year after system deployment, STBL tokens originating from Stabilio AG cannot 
* enter circulating supply and cannot be staked to earn system revenue.
*/
contract OneYearLockupContract {
    
    // --- Data ---
    string constant public NAME = "OneYearLockupContract";

    uint256 public constant ONE_YEAR_IN_SECONDS = 31536000;  // 60 * 60 * 24 * 365

    address public immutable beneficiary;

    ISTBLToken public stblToken;

    // Unlock time is the Unix point in time at which the beneficiary can withdraw.
    uint256 public unlockTime;

    // --- Events ---

    event OneYearLockupContractCreated(address _beneficiary, uint256 _unlockTime);
    event OneYearLockupContractEmptied(uint256 _STBLwithdrawal);

    // --- Functions ---

    constructor 
    (
        address _stblTokenAddress, 
        address _beneficiary, 
        uint256 _unlockTime
    )
    {
        stblToken = ISTBLToken(_stblTokenAddress);

        /*
        * Set the unlock time to a chosen instant in the future, as long as it is at least 1 year after
        * the system was deployed 
        */
        _requireUnlockTimeIsAtLeastOneYearAfterSystemDeployment(_unlockTime);
        unlockTime = _unlockTime;
        
        beneficiary =  _beneficiary;
        emit OneYearLockupContractCreated(_beneficiary, _unlockTime);
    }

    function withdrawSTBL() external {
        _requireCallerIsBeneficiary();
        _requireLockupDurationHasPassed();

        ISTBLToken stblTokenCached = stblToken;
        uint256 STBLBalance = stblTokenCached.balanceOf(address(this));
        stblTokenCached.transfer(beneficiary, STBLBalance);
        emit OneYearLockupContractEmptied(STBLBalance);
    }

    // --- 'require' functions ---

    function _requireCallerIsBeneficiary() internal view {
        require(msg.sender == beneficiary, "OneYearLockupContract: caller is not the beneficiary");
    }

    function _requireLockupDurationHasPassed() internal view {
        require(block.timestamp >= unlockTime, "OneYearLockupContract: The lockup duration must have passed");
    }

    function _requireUnlockTimeIsAtLeastOneYearAfterSystemDeployment(uint256 _unlockTime) internal view {
        uint256 systemDeploymentTime = stblToken.getDeploymentStartTime();
        require(_unlockTime >= systemDeploymentTime + ONE_YEAR_IN_SECONDS, "OneYearLockupContract: unlock time must be at least one year after system deployment");
    }
}
