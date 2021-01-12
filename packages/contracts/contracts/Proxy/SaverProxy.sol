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

    function open(uint _amt) external payable {
        IBorrowerOperations(borrowerOperationsAddress).openTrove{value: msg.value}(_amt, msg.sender);
    }

    function repay( //Subscriptions.TroveOwner memory _params, //TODO rename redeemAdjust
                    uint _redemptionAmountLUSD,
                    address _firstRedemptionHint,
                    address _partialRedemptionHint,
                    uint _partialRedemptionHintICR,
                    uint _maxIterations 
                  ) public /*payable*/ {
                      
        address payable user = payable(getUserAddress());

        // uint ICR = _params.minRatio; // ICR target min coll ratio of user (e.g. 1.5)
        // uint d = ITroveManager(troveManagerAddress).getTroveDebt(user); // user's debt
        // uint c = ITroveManager(troveManagerAddress).getTroveColl(user); // user's coll
        // uint n = d.mul(ICR).sub(c).div(ICR + 1);
       
        ITroveManager(troveManagerAddress).redeemCollateral(_redemptionAmountLUSD, 
                                                            _firstRedemptionHint, 
                                                            _partialRedemptionHint, 
                                                            _partialRedemptionHintICR, 
                                                            _maxIterations); 
        
        // TODO msg.value should be redeemed collateral from above
        // IBorrowerOperations(borrowerOperations).adjustTrove{value: msg.value}(0, n, false, user);
	}

    //function boost

    /// @notice Returns the owner of the DSProxy that called the contract
    function getUserAddress() internal view returns (address) {
        DSProxy proxy = DSProxy(payable(address(this)));
        return proxy.owner();
    }
}
