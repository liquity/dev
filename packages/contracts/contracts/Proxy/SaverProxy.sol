// SPDX-License-Identifier: MIT
// Adapted from https://github.com/DecenterApps/defisaver-contracts/

pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import "../Dependencies/DappSys/DSProxy.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/ITroveManager.sol";
import "../Interfaces/ITroveManager.sol";
import "./Subscriptions.sol";

contract SaverProxy {
    using SafeMath for uint256;

    address immutable borrowerOperationsAddress;
    address immutable troveManagerAddress;
    
    constructor(address _borrowerOperationsAddress, address _troveManagerAddress) public {  
        borrowerOperationsAddress = _borrowerOperationsAddress;
        troveManagerAddress = _troveManagerAddress;
    }

    function open(uint _maxFee, uint _amt) external payable {
        IBorrowerOperations(borrowerOperationsAddress).openTrove{value: msg.value}(_maxFee, _amt, msg.sender, msg.sender);
    }

    // borrowAndDeposit

    //stakeFor
      // stake LQTY

    //depositGainsFor
      // withdraw gains, sell ETH for LUSD, redeposit


    function repay( uint _redemptionAmountLUSD,
                    address _firstRedemptionHint,
                    address _upperPartialRedemptionHint,
                    address _lowerPartialRedemptionHint,
                    uint _partialRedemptionHintICR,
                    uint _maxIterations, uint _maxFee 
                  ) public {
             
        // if invoked by monitor->monitorProxy, then inside here
        // msg.sender here is the monitorProxy contract address 
        // inside TM msg.sender will be the address of invoking DSproxy
        uint ethReturned = ITroveManager(troveManagerAddress).redeemCollateral( _redemptionAmountLUSD, 
                                                                                _firstRedemptionHint, 
                                                                                _upperPartialRedemptionHint, 
                                                                                _lowerPartialRedemptionHint, 
                                                                                _partialRedemptionHintICR, 
                                                                                _maxIterations, _maxFee );

        IBorrowerOperations(borrowerOperationsAddress).adjustTrove{value: ethReturned}(0, 0, 0, false, address(this), address(this));
	}

    /// @notice Returns the owner of the DSProxy that called the contract
    function getUserAddress() internal view returns (address) {
        DSProxy proxy = DSProxy(payable(address(this)));
        return proxy.owner();
    }
}
