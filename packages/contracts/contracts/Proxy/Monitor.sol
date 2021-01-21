// SPDX-License-Identifier: MIT
// Adapted from https://github.com/DecenterApps/defisaver-contracts/

pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import "../Interfaces/ITroveManager.sol";
import "../Interfaces/IPriceFeed.sol";

import "../Dependencies/SafeMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/console.sol";

import "./Subscriptions.sol";
import "./MonitorScript.sol";

contract Monitor is Ownable {
    using SafeMath for uint256;

    enum Method { Repay } 

    uint public MAX_GAS_PRICE = 400000000000; // 400 gwei
    uint public REPAY_GAS_COST = 2500000; // TODO calculate

    Subscriptions public subscriptionsContract;
    MonitorScript public monitorScript;
    ITroveManager public troveManager;
    IPriceFeed public priceFeed;
    address public liquityScript;
    
    // this can be a simple contract doing nothing but storing a list of approved addresses
    // modifier onlyApproved() {
    //     require(BotRegistry(BOT_REGISTRY_ADDRESS).botList(msg.sender), "Not auth bot");
    //     _;
    // }

    /// @param _monitorScript actually authorized to call DSProxy
    /// @param _subscriptions Subscriptions contract for Troves
    /// @param _liquityScript Contract that actually does Repay
    /// @param _troveManagerAddress TroveManager address
    /// @param _priceFeedAddress Oracle address
    constructor(
        address _monitorScript, 
        address _subscriptions, 
        address _liquityScript,
        address _troveManagerAddress,
        address _priceFeedAddress
    ) public {
        monitorScript = MonitorScript(_monitorScript);
        subscriptionsContract = Subscriptions(_subscriptions);
        liquityScript = _liquityScript;
        troveManager = ITroveManager(_troveManagerAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
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
    /// @param _params the address that owns the Trove, and minimum ICR 
    function repayFor(
        Subscriptions.TroveOwner memory _params, 
        uint _redemptionAmount,
        address _firstRedemptionHint, 
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint, 
        uint _partialRedemptionHintICR, 
        uint _maxIterations, uint _maxFee
    ) public payable /*onlyApproved*/ {

        (bool isAllowed, /* uint currentICR */) = canCall(Method.Repay, _params.user);
        require(isAllowed, "not allowed"); // check if conditions are met
 
        // the msg.sender inside of this call to saver will be the monitorScript
        // and the address(this) inside this call will be _params.user because
        // the call is being executed by monitorScript via DSproxy
        monitorScript.callExecute{value: msg.value}(
            _params.user,
            liquityScript,
            abi.encodeWithSignature(
                "repay(uint256,address,address,address,uint256,uint256,uint256)",
                _redemptionAmount, _firstRedemptionHint, 
                _upperPartialRedemptionHint, 
                _lowerPartialRedemptionHint, 
                _partialRedemptionHintICR,
                _maxIterations, _maxFee
            )
        );
    }

    function getICR(address _user) public view returns(uint) {
        uint price = priceFeed.getPrice();
        uint ICR = troveManager.getCurrentICR(_user, price);
        return ICR;
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
        else {
            return (false, 0);
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
