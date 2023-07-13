// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Interfaces/ISTBLToken.sol";

/*
* The lockup contract architecture utilizes a single SixMonthsLockupContract, with an unlockTime. The unlockTime is passed as an argument 
* to the SixMonthsLockupContract's constructor. The contract's balance can be withdrawn by the beneficiary when block.timestamp > unlockTime. 
* At construction, the contract checks that unlockTime is at least six months later than the Liquity system's deployment time. 

* Within the six months from deployment, the deployer of the STBLToken (Liquity AG's address) may transfer STBL only to valid 
* SixMonthsLockupContract, and no other addresses (this is enforced in STBLToken.sol's transfer() function).
* 
* The above two restrictions ensure that until six months after system deployment, STBL tokens originating from Liquity AG cannot 
* enter circulating supply and cannot be staked to earn system revenue.
*/
contract SixMonthsLockupContract {
    
    // --- Data ---
    string constant public NAME = "SixMonthsLockupContract";

    uint256 public constant SIX_MONTHS_IN_SECONDS = 15552000;  // 60 * 60 * 24 * 180

    address public immutable beneficiary;

    ISTBLToken public stblToken;

    // Unlock time is the Unix point in time at which the beneficiary can withdraw.
    uint256 public unlockTime;

    // --- Events ---

    event SixMonthsLockupContractCreated(address _beneficiary, uint256 _unlockTime);
    event SixMonthsLockupContractEmptied(uint256 _STBLwithdrawal);

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
        _requireUnlockTimeIsAtLeastSixMonthsAfterSystemDeployment(_unlockTime);
        unlockTime = _unlockTime;
        
        beneficiary =  _beneficiary;
        emit SixMonthsLockupContractCreated(_beneficiary, _unlockTime);
    }

    function withdrawSTBL() external {
        _requireCallerIsBeneficiary();
        _requireLockupDurationHasPassed();

        ISTBLToken stblTokenCached = stblToken;
        uint256 STBLBalance = stblTokenCached.balanceOf(address(this));
        stblTokenCached.transfer(beneficiary, STBLBalance);
        emit SixMonthsLockupContractEmptied(STBLBalance);
    }

    // --- 'require' functions ---

    function _requireCallerIsBeneficiary() internal view {
        require(msg.sender == beneficiary, "SixMonthsLockupContract: caller is not the beneficiary");
    }

    function _requireLockupDurationHasPassed() internal view {
        require(block.timestamp >= unlockTime, "SixMonthsLockupContract: The lockup duration must have passed");
    }

    function _requireUnlockTimeIsAtLeastSixMonthsAfterSystemDeployment(uint256 _unlockTime) internal view {
        uint256 systemDeploymentTime = stblToken.getDeploymentStartTime();
        require(_unlockTime >= systemDeploymentTime + SIX_MONTHS_IN_SECONDS, "SixMonthsLockupContract: unlock time must be at least six months after system deployment");
    }
}
