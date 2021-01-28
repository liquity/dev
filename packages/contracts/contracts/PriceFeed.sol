// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IPriceFeed.sol";
import "./Dependencies/AggregatorV3Interface.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/BaseMath.sol";
import "./Dependencies/LiquityMath.sol";
import "./Dependencies/ITellor.sol";
import "./Dependencies/console.sol";

/*
* PriceFeed for mainnet deployment, to be connected to Chainlink's live ETH:USD aggregator reference contract,
* and Tellor's TellorMaster contract.
*/

contract PriceFeed is Ownable, CheckContract, BaseMath, IPriceFeed {
    using SafeMath for uint256;

    // Mainnet Chainlink aggregator
    AggregatorV3Interface public priceAggregator;
    // Mainnet TellorMaster
    ITellor public tellor;

    uint constant public ETHUSD_TELLOR_REQ_ID = 1;

    // Use to convert a price answer to an 18-digit precision uint
    uint constant public TARGET_DIGITS = 18;  
    uint constant public TELLOR_DIGITS = 6;

    uint constant public TIMEOUT = 10800;  // 3 hours: 60 * 60 * 3
    
    // Maximum deviation allowed between two consecutive Chainlink oracle prices. 18-digit precision.
    uint constant public MAX_PRICE_DEVIATION_FROM_PREVIOUS =  5e17; // 50%

    /* 
    * The maximum relative price difference between two oracle responses allowed in order for the PriceFeed
    * to return to using the Chainlink oracle. 18-digit precision.
    */
    uint constant public MAX_PRICE_DIFFERENCE_FOR_RETURN = 3e16; // 3%

    uint public prevChainlinkDigits;
    uint public lastGoodPrice;

    struct ChainlinkResponse {
        uint80 roundId;
        int256 answer;
        uint256 startedAt;
        uint256 timestamp;
        uint80 answeredInRound;
    }

    struct TellorResponse {
        bool ifRetrieve;
        uint256 value;
        uint256 timestamp;
    }

    enum Status {usingChainlink, usingTellor, bothOraclesSuspect}

    Status status;

    // --- Dependency setters ---
    
    function setAddresses(
        address _priceAggregatorAddress,
        address _tellorMasterAddress
    )
        external
        onlyOwner
    {
        checkContract(_priceAggregatorAddress);

        priceAggregator = AggregatorV3Interface(_priceAggregatorAddress);
        tellor = ITellor(_tellorMasterAddress);

        _renounceOwnership();
    }

    // --- functions ---

    /*
    * Returns the latest price obtained from the Oracle. Uses a main oracle (Chainlink) and a fallback oracle(Tellor) 
    * in case Chainlink fails. 
    *
    */
    function getPrice() public override returns (uint) {
        // Get current price data from chainlink
        ChainlinkResponse memory chainlinkResponse;
        (chainlinkResponse.roundId,
        chainlinkResponse.answer, ,
        chainlinkResponse.timestamp,)  = priceAggregator.latestRoundData();

        uint8 currentChainlinkDigits = priceAggregator.decimals();

        // --- Case 1: Both oracles previously failed ---
        if (status == Status.bothOraclesSuspect) {
            // Get current price data from Tellor
            TellorResponse memory tellorResponse;
            (tellorResponse.ifRetrieve,
            tellorResponse.value,
            tellorResponse.timestamp) = getTellorCurrentValue(ETHUSD_TELLOR_REQ_ID);
            
            /*
            * If both oracles are now back online and close together in price, we assume that they are reporting
            * accurately, and so we switch back to Chainlink.
            */
            if (bothOraclesLiveAndSimilarPrice(chainlinkResponse, currentChainlinkDigits, tellorResponse)) {
                status = Status.usingChainlink;
                return  _scaleChainlinkPriceByDigits(uint256(chainlinkResponse.answer), currentChainlinkDigits);
            } else {
                return lastGoodPrice;
            }
        }

        // --- Case 2: The previous price was reported by Tellor --- 
        if (status == Status.usingTellor) {
            // get Tellor price data
            TellorResponse memory tellorResponse;
            (tellorResponse.ifRetrieve,
            tellorResponse.value,
            tellorResponse.timestamp) = getTellorCurrentValue(ETHUSD_TELLOR_REQ_ID);
            
            // If Tellor is only frozen but otherwise returning valid data, just use the last good price
            if (tellorIsFrozen(tellorResponse)) {return lastGoodPrice;}
            
            if (tellorIsBroken(tellorResponse)) {
                status = Status.bothOraclesSuspect; 
                return lastGoodPrice; 
            }
           
           // If both Tellor and Chainlink are live and reporting similar prices, switch back to Chainlink
            if (bothOraclesLiveAndSimilarPrice(chainlinkResponse, currentChainlinkDigits, tellorResponse)) {
                status = Status.usingChainlink;
                return _scaleChainlinkPriceByDigits(uint256(chainlinkResponse.answer), currentChainlinkDigits);
            }

            // Otherwise, use Tellor price
            uint scaledTellorPrice = _scaleTellorPriceByDigits(tellorResponse.value);
            lastGoodPrice = scaledTellorPrice;
            return _scaleTellorPriceByDigits(scaledTellorPrice);
        }

        // --- Case 3: Main was previously live ---
        if (status == Status.usingChainlink) {
            // Get previous round price data from chainlink
            ChainlinkResponse memory prevChainlinkResponse; 
            (prevChainlinkResponse.roundId,
            prevChainlinkResponse.answer, ,
            prevChainlinkResponse.timestamp,) = priceAggregator.getRoundData(chainlinkResponse.roundId - 1);

            // If Chainlink is broken or price deviated too much from previous, try Tellor
            if (chainlinkIsBroken(chainlinkResponse) || chainlinkPriceChangeAboveMax(chainlinkResponse, currentChainlinkDigits, prevChainlinkResponse, prevChainlinkDigits)) {
                    TellorResponse memory tellorResponse;
                    (tellorResponse.ifRetrieve,
                    tellorResponse.value,
                    tellorResponse.timestamp) = getTellorCurrentValue(ETHUSD_TELLOR_REQ_ID);
                    
                    // If Tellor is only frozen but otherwise returning valid data, just use the last good price
                    if (tellorIsFrozen(tellorResponse)) {return lastGoodPrice;}
                    
                    // If Tellor is broken then both oracles are suspect, and we just use the last good price
                    if (tellorIsBroken(tellorResponse)) {
                        status = Status.bothOraclesSuspect; 
                        return lastGoodPrice; 
                    }

                // If tellor is working, return Tellor price
                status = Status.usingTellor;
                uint scaledTellorPrice = _scaleTellorPriceByDigits(tellorResponse.value);
                lastGoodPrice = scaledTellorPrice;
                return scaledTellorPrice;
            }
        }

       // If Chainlink is working, return its current price
       return  _scaleChainlinkPriceByDigits(uint256(chainlinkResponse.answer), currentChainlinkDigits);
    }

    // --- Helper functions --- 

    function chainlinkIsBroken(ChainlinkResponse memory _response) internal view returns (bool) {
        // Check for an invalid timeStamp that is 0, or in the future
        if (_response.timestamp == 0 || _response.timestamp > block.timestamp) {return true;}
        // Check for non-positive price
        if (_response.answer <= 0) {return true;} 
        // Check whether the oracle has frozen
        if ((block.timestamp.sub(_response.timestamp) > TIMEOUT)) {return true;}

        return true;
    }

    function chainlinkPriceChangeAboveMax(ChainlinkResponse memory _currentResponse, uint _currentDigits, ChainlinkResponse memory _prevResponse, uint _prevDigits) internal pure returns (bool) {
        uint currentScaledPrice = _scaleChainlinkPriceByDigits(uint256(_currentResponse.answer), _currentDigits);
        uint prevScaledPrice = _scaleChainlinkPriceByDigits(uint256(_prevResponse.answer), _prevDigits);
       
        uint deviation = LiquityMath._getAbsoluteDifference(currentScaledPrice, prevScaledPrice).mul(DECIMAL_PRECISION).div(prevScaledPrice);
         
        return deviation > MAX_PRICE_DEVIATION_FROM_PREVIOUS;
    }

    function tellorIsFrozen(TellorResponse  memory _tellorResponse) internal view returns (bool) {
        return block.timestamp.sub(_tellorResponse.timestamp) > TIMEOUT;
    }

    function tellorIsBroken(TellorResponse memory _response) internal view returns (bool) {
          // Check for an invalid timeStamp that is 0, or in the future
        if (_response.timestamp == 0 || _response.timestamp > block.timestamp) {return true;}
        // Check for zero price
        if (_response.value == 0) {return true;} 
    }


    function bothOraclesLiveAndSimilarPrice(ChainlinkResponse memory _chainlinkResponse, uint _chainlinkDigits, TellorResponse memory _tellorResponse) internal view returns (bool) {
        // Check both oracles are live
        if (tellorIsBroken(_tellorResponse) || tellorIsFrozen(_tellorResponse) || chainlinkIsBroken(_chainlinkResponse)) {
            return false;
        }

        uint scaledMainPrice = _scaleChainlinkPriceByDigits(uint256(_chainlinkResponse.answer), _chainlinkDigits);
        uint scaledTellorPrice = _scaleTellorPriceByDigits(_tellorResponse.value);
        // Return true if the prices are close enough
        return scaledMainPrice.sub(scaledTellorPrice).mul(1e18).div(scaledMainPrice) < MAX_PRICE_DIFFERENCE_FOR_RETURN;
    }
   
    function _scaleChainlinkPriceByDigits(uint _price, uint _answerDigits) internal pure returns (uint) {
        uint price;
        
        /* Convert the price returned by the Oracle to an 18-digit decimal for use by Liquity.
        * Currently, the main Oracle (Chainlink) uses an 8-digit price, but we also handle the possibility of
        * future changes.
        */
        if (_answerDigits > TARGET_DIGITS) { 
            price = _price.div(10 ** (_answerDigits - TARGET_DIGITS));
        }
        else if (_answerDigits < TARGET_DIGITS) {
            price = _price.mul(10 ** (TARGET_DIGITS - _answerDigits));
        } 
        return price;
    }

    function _scaleTellorPriceByDigits(uint _price) internal pure returns (uint) {
        return _price.mul(10**(TARGET_DIGITS - TELLOR_DIGITS));
    }


    // --- Tellor functionality (as found in Tellor's UsingTellor.sol contract) ---

    /**
    * getTellorCurrentValue():  identical to getCurrentValue() in UsingTellor.sol
    *
    * @dev Allows the user to get the latest value for the requestId specified
    * @param _requestId is the requestId to look up the value for
    * @return ifRetrieve bool true if it is able to retreive a value, the value, and the value's timestamp
    * @return value the value retrieved
    * @return _timestampRetrieved the value's timestamp
    */
    function getTellorCurrentValue(uint256 _requestId)
        public
        view
        returns (
            bool ifRetrieve,
            uint256 value,
            uint256 _timestampRetrieved
        )
    {
        uint256 _count = tellor.getNewValueCountbyRequestId(_requestId);
        uint256 _time =
            tellor.getTimestampbyRequestIDandIndex(_requestId, _count - 1);
        uint256 _value = tellor.retrieveData(_requestId, _time);
        if (_value > 0) return (true, _value, _time);
        return (false, 0, _time);
    }
}
