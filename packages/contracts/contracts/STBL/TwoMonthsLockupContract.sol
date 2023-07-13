// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Interfaces/ISTBLToken.sol";

/*
* The lockup contract architecture utilizes a single TwoMonthsLockupContract, with an unlockTime. The unlockTime is passed as an argument 
* to the TwoMonthsLockupContract's constructor. The contract's balance can be withdrawn by the beneficiary when block.timestamp > unlockTime. 
* At construction, the contract checks that unlockTime is at least two months later than the Liquity system's deployment time. 

* Within the two months from deployment, the deployer of the STBLToken (Liquity AG's address) may transfer STBL only to valid 
* TwoMonthsLockupContract, and no other addresses (this is enforced in STBLToken.sol's transfer() function).
* 
* The above two restrictions ensure that until two months after system deployment, STBL tokens originating from Liquity AG cannot 
* enter circulating supply and cannot be staked to earn system revenue.
*/
contract TwoMonthsLockupContract {
    
    // --- Data ---
    string constant public NAME = "TwoMonthsLockupContract";

    uint256 public constant TWO_MONTHS_IN_SECONDS = 5184000;  // 60 * 60 * 24 * 60

    address public immutable beneficiary;

    ISTBLToken public stblToken;

    // Unlock time is the Unix point in time at which the beneficiary can withdraw.
    uint256 public unlockTime;

    // --- Events ---

    event TwoMonthsLockupContractCreated(address _beneficiary, uint256 _unlockTime);
    event TwoMonthsLockupContractEmptied(uint256 _STBLwithdrawal);

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
        * Set the unlock time to a chosen instant in the future, as long as it is at least 6 months after
        * the system was deployed 
        */
        _requireUnlockTimeIsAtLeastTwoMonthsAfterSystemDeployment(_unlockTime);
        unlockTime = _unlockTime;
        
        beneficiary =  _beneficiary;
        emit TwoMonthsLockupContractCreated(_beneficiary, _unlockTime);
    }

    function withdrawSTBL() external {
        _requireCallerIsBeneficiary();
        _requireLockupDurationHasPassed();

        ISTBLToken stblTokenCached = stblToken;
        uint256 STBLBalance = stblTokenCached.balanceOf(address(this));
        stblTokenCached.transfer(beneficiary, STBLBalance);
        emit TwoMonthsLockupContractEmptied(STBLBalance);
    }

    // --- 'require' functions ---

    function _requireCallerIsBeneficiary() internal view {
        require(msg.sender == beneficiary, "TwoMonthsLockupContract: caller is not the beneficiary");
    }

    function _requireLockupDurationHasPassed() internal view {
        require(block.timestamp >= unlockTime, "TwoMonthsLockupContract: The lockup duration must have passed");
    }

    function _requireUnlockTimeIsAtLeastTwoMonthsAfterSystemDeployment(uint256 _unlockTime) internal view {
        uint256 systemDeploymentTime = stblToken.getDeploymentStartTime();
        require(_unlockTime >= systemDeploymentTime + TWO_MONTHS_IN_SECONDS, "TwoMonthsLockupContract: unlock time must be at least two months after system deployment");
    }
}
