// SPDX-License-Identifier: MIT
// Adapted from https://github.com/DecenterApps/defisaver-contracts/

pragma solidity 0.6.11;

import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/ITroveManager.sol";
import "./Subscriptions.sol";
import "./BorrowerOperationsScript.sol";
import "./TokenScript.sol";
import "./ETHTransferScript.sol";


contract LiquityScript is BorrowerOperationsScript, TokenScript, ETHTransferScript {
    using SafeMath for uint256;

    address immutable borrowerOperationsAddress;
    address immutable troveManagerAddress;

    constructor(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _lusdTokenAddress
    )
        BorrowerOperationsScript(IBorrowerOperations(_borrowerOperationsAddress))
        TokenScript(_lusdTokenAddress)
        public
    {
        borrowerOperationsAddress = _borrowerOperationsAddress;
        troveManagerAddress = _troveManagerAddress;
    }

    // TODO
    // stakeFor
    
    // borrowAndDeposit
    // borrowAndLeverage AKA immediately obtain additional ETH instead of LUSD being sent to your address
    
    // TODO use this in boost AKA automatic leverage increase in case of price increase
    function redeemAndTopUp(uint _redemptionAmountLUSD,
                            address _firstRedemptionHint,
                            address _upperPartialRedemptionHint,
                            address _lowerPartialRedemptionHint,
                            uint _partialRedemptionHintICR,
                            uint _maxIterations, uint _maxFee) public {

        // if invoked by monitor->monitorProxy, then inside here
        // msg.sender here is the monitorProxy contract address 
        // inside TM, msg.sender will be the address of invoking DSproxy
        uint ethReturned = ITroveManager(troveManagerAddress).redeemCollateral( _redemptionAmountLUSD, 
                                                                                _firstRedemptionHint, 
                                                                                _upperPartialRedemptionHint, 
                                                                                _lowerPartialRedemptionHint, 
                                                                                _partialRedemptionHintICR, 
                                                                                _maxIterations, _maxFee );

        IBorrowerOperations(borrowerOperationsAddress).adjustTrove{value: ethReturned}(0, 0, 0, false, address(this), address(this));
	}
}
