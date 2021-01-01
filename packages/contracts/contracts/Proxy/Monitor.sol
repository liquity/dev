// SPDX-License-Identifier: MIT
// Adapted from https://github.com/DecenterApps/defisaver-contracts/

pragma solidity 0.6.11;

import "../Dependencies/LiquityMath.sol";
import "../Dependencies/SafeMath.sol";
import "../Dependencies/Ownable.sol";
import "./Subscriptions.sol";
import "./MonitorProxy.sol";

contract Monitor is Ownable {
    using SafeMath for uint256;

    enum Method { Repay } 

    uint public MAX_GAS_PRICE = 400000000000; // 400 gwei
    uint public REPAY_GAS_COST = 2500000;

    Subscriptions public subscriptionsContract;
    MonitorProxy public monitorProxy;

    address public saverProxy;
    
    // modifier onlyApproved() {
    //     require(BotRegistry(BOT_REGISTRY_ADDRESS).botList(msg.sender), "Not auth bot");
    //     _;
    // }

    /// @param _monitorProxy actually authorized to call DSProxy
    /// @param _subscriptions Subscriptions contract for Troves
    /// @param _saverProxy Contract that actually does Repay
    constructor(address _monitorProxy, address _subscriptions, address _saverProxy) public {
        monitorProxy = MonitorProxy(_monitorProxy);
        subscriptionsContract = Subscriptions(_subscriptions);
        saverProxy = _saverProxy;
    }

    /// @notice Calculates gas cost (in Eth) of tx
    /// @dev Gas price is limited to MAX_GAS_PRICE 
    // to prevent attack of draining user Trove
    /// @param _gasAmount Amount of gas used for the tx
    function calcGasCost(uint _gasAmount) public view returns (uint) {
        uint gasPrice = tx.gasprice <= MAX_GAS_PRICE ? tx.gasprice : MAX_GAS_PRICE;

        return gasPrice.mul(_gasAmount);
    }

    /// @notice Bots call this method to repay for user when conditions are met
    /// @param _user The actual address that owns the Trove
    function repayFor(
        // TODO
        //SaverExchangeCore.ExchangeData memory _exData,
        address _user
    ) public payable /*onlyApproved*/ {

        (bool isAllowed, uint ratioBefore) = canCall(Method.Repay, _user);
        require(isAllowed); // check if conditions are met

        uint256 gasCost = calcGasCost(REPAY_GAS_COST);

        // TODO 
        // monitorProxy.callExecute{value: msg.value}(
        //     _user,
        //     saverProxy,
        //     abi.encodeWithSignature(
        //         "repay((address,address,uint256,uint256,uint256,address,address,bytes,uint256),uint256)",
        //         //_exData,
        //         gasCost
        //     )
        // );
    }

    function getICR(address _user) public view returns(uint256) {
        /* TODO
        address lendingPoolAddress = ILendingPoolAddressesProvider(AAVE_LENDING_POOL_ADDRESSES).getLendingPool();
        (,,uint256 totalBorrowsETH,,uint256 availableBorrowsETH,,,) = ILendingPool(lendingPoolAddress).getUserAccountData(_user);
        if (totalBorrowsETH == 0) return uint256(0);
        */
        uint debt = 42;
        uint coll = 42;
        uint price = 42;
        return LiquityMath._computeCR(coll, debt, price);

    }

    /// @notice Checks Repay could be triggered for the Trove
    /// @dev Called by Monitor to enforce the min/max check
    /// @param _method Type of action to be called
    /// @param _user The actual address that owns the Trove
    /// @return Boolean if it can be called and the ratio
    function canCall(Method _method, address _user) public view returns(bool, uint) {
        bool subscribed = subscriptionsContract.isSubscribed(_user);
        uint minRatio = subscriptionsContract.getMinRatio(_user);

        // check if Trove owner is subscribed
        if (!subscribed) return (false, 0);

        uint currentICR = getICR(_user);

        if (_method == Method.Repay) {
            return (currentICR < minRatio, currentICR);
        }
    }

    /// @notice Allows owner to change gas cost for repay operation, but only up to 3 millions
    /// @param _gasCost New gas cost for repay method
    function changeRepayGasCost(uint _gasCost) public onlyOwner {
        require(_gasCost < 3000000);

        REPAY_GAS_COST = _gasCost;
    }

    /// @notice Allows owner to change max gas price
    /// @param _maxGasPrice New max gas price
    function changeMaxGasPrice(uint _maxGasPrice) public onlyOwner {
        require(_maxGasPrice < 500000000000);

        MAX_GAS_PRICE = _maxGasPrice;
    }
}