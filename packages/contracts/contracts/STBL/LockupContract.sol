// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Interfaces/ISTBLToken.sol";

/*
* The lockup contract architecture utilizes a single LockupContract, with an unlockTime. The unlockTime is passed as an argument 
* to the LockupContract's constructor. The contract's balance can be withdrawn by the beneficiary when block.timestamp > unlockTime. 
* At construction, the contract checks that unlockTime is at least one year later than the Liquity system's deployment time. 

* Within the first year from deployment, the deployer of the STBLToken (Liquity AG's address) may transfer STBL only to valid 
* LockupContracts, and no other addresses (this is enforced in STBLToken.sol's transfer() function).
* 
* The above two restrictions ensure that until one year after system deployment, STBL tokens originating from Liquity AG cannot 
* enter circulating supply and cannot be staked to earn system revenue.
*/
contract LockupContract {
    
    // --- Data ---
    string constant public NAME = "LockupContract";

    uint256 constant public SECONDS_IN_ONE_YEAR = 31536000; 

    address public immutable beneficiary;

    ISTBLToken public stblToken;

    // Unlock time is the Unix point in time at which the beneficiary can withdraw.
    uint256 public unlockTime;

    // --- Events ---

    event LockupContractCreated(address _beneficiary, uint256 _unlockTime);
    event LockupContractEmptied(uint256 _STBLwithdrawal);

    // --- Functions ---

    constructor 
    (
        address _stblTokenAddress, 
        address _beneficiary, 
        uint256 _unlockTime
    )
        public 
    {
        stblToken = ISTBLToken(_stblTokenAddress);

        /*
        * Set the unlock time to a chosen instant in the future, as long as it is at least 1 year after
        * the system was deployed 
        */
        _requireUnlockTimeIsAtLeastOneYearAfterSystemDeployment(_unlockTime);
        unlockTime = _unlockTime;
        
        beneficiary =  _beneficiary;
        emit LockupContractCreated(_beneficiary, _unlockTime);
    }

    function withdrawSTBL() external {
        _requireCallerIsBeneficiary();
        _requireLockupDurationHasPassed();

        ISTBLToken stblTokenCached = stblToken;
        uint256 STBLBalance = stblTokenCached.balanceOf(address(this));
        stblTokenCached.transfer(beneficiary, STBLBalance);
        emit LockupContractEmptied(STBLBalance);
    }

    // --- 'require' functions ---

    function _requireCallerIsBeneficiary() internal view {
        require(msg.sender == beneficiary, "LockupContract: caller is not the beneficiary");
    }

    function _requireLockupDurationHasPassed() internal view {
        require(block.timestamp >= unlockTime, "LockupContract: The lockup duration must have passed");
    }

    function _requireUnlockTimeIsAtLeastOneYearAfterSystemDeployment(uint256 _unlockTime) internal view {
        uint256 systemDeploymentTime = stblToken.getDeploymentStartTime();
        require(_unlockTime >= systemDeploymentTime + SECONDS_IN_ONE_YEAR, "LockupContract: unlock time must be at least one year after system deployment");
    }
}
