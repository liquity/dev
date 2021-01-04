// SPDX-License-Identifier: MIT
// Adapted from https://github.com/DecenterApps/defisaver-contracts/

pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import "../Dependencies/DappSys/DSProxy.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "./Subscriptions.sol";

contract SaverProxy {

    address immutable borrowerOperationsAddress;
    
    constructor (address _borrowerOperationsAddress) public {  
        borrowerOperationsAddress = _borrowerOperationsAddress;        
    }

    function open(uint _amt) external payable {
        IBorrowerOperations(borrowerOperationsAddress).openTrove{value: msg.value}(_amt, address(0));
    }

    function repay(Subscriptions.TroveOwner memory _params, uint _gasCost) public payable {

		/*
        address lendingPoolCore = ILendingPoolAddressesProvider(AAVE_LENDING_POOL_ADDRESSES).getLendingPoolCore();
		address lendingPool = ILendingPoolAddressesProvider(AAVE_LENDING_POOL_ADDRESSES).getLendingPool();
		address payable user = payable(getUserAddress());

        //get how much debt to sell to recover collateralization

		// redeem collateral
		address aTokenCollateral = ILendingPool(lendingPoolCore).getReserveATokenAddress(_data.srcAddr);
		// uint256 maxCollateral = IAToken(aTokenCollateral).balanceOf(address(this)); 
		// don't swap more than maxCollateral
		// _data.srcAmount = _data.srcAmount > maxCollateral ? maxCollateral : _data.srcAmount;
		IAToken(aTokenCollateral).redeem(_data.srcAmount);

		uint256 destAmount = _data.srcAmount;
		if (_data.srcAddr != _data.destAddr) {
			// swap
			(, destAmount) = _sell(_data);
			destAmount -= getFee(destAmount, user, _gasCost, _data.destAddr);
		} else {
			destAmount -= getGasCost(destAmount, user, _gasCost, _data.destAddr);
		}

		// payback
		if (_data.destAddr == ETH_ADDR) {
			ILendingPool(lendingPool).repay{value: destAmount}(_data.destAddr, destAmount, payable(address(this)));
		} else {
			approveToken(_data.destAddr, lendingPoolCore);
			ILendingPool(lendingPool).repay(_data.destAddr, destAmount, payable(address(this)));
		}
        */
	}

    /// @notice Returns the owner of the DSProxy that called the contract
    function getUserAddress() internal view returns (address) {
        DSProxy proxy = DSProxy(payable(address(this)));

        return proxy.owner();
    }

}
