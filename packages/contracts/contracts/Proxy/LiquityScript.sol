// SPDX-License-Identifier: MIT
// Adapted from https://github.com/DecenterApps/defisaver-contracts/

pragma solidity 0.6.11;

import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/ITroveManager.sol";
import "./Subscriptions.sol";

contract LiquityScript {
    using SafeMath for uint256;

    address immutable borrowerOperationsAddress;
    address immutable troveManagerAddress;
    
    constructor(address _borrowerOperationsAddress, address _troveManagerAddress) public {  
        borrowerOperationsAddress = _borrowerOperationsAddress;
        troveManagerAddress = _troveManagerAddress;
    }

    function openTrove(uint _maxFee, uint _amt) external payable {
        IBorrowerOperations(borrowerOperationsAddress).openTrove{value: msg.value}(_maxFee, _amt, msg.sender, msg.sender);
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
