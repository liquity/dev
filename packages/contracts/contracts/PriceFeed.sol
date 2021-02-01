// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/ITellorCaller.sol";
import "./Dependencies/AggregatorV3Interface.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/BaseMath.sol";
import "./Dependencies/LiquityMath.sol";
import "./Dependencies/console.sol";

/*
* PriceFeed for mainnet deployment, to be connected to Chainlink's live ETH:USD aggregator reference contract,
* and Tellor's TellorMaster contract.
*
*/
contract PriceFeed is Ownable, CheckContract, BaseMath, IPriceFeed {
    using SafeMath for uint256;

    AggregatorV3Interface public priceAggregator;  // Mainnet Chainlink aggregator
    ITellorCaller public tellorCaller;  // Wrapper contract that calls the Tellor system

    // Core Liquity contracts
    address borrowerOperationsAddress;
    address troveManagerAddress;

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

    uint public lastGoodPrice;

    struct ChainlinkResponse {
        uint80 roundId;
        int256 answer;
        uint256 timestamp;
        bool success;
        uint8 digits;
    }

    struct TellorResponse {
        bool ifRetrieve;
        uint256 value;
        uint256 timestamp;
        bool success;
    }

    enum Status {usingChainlink, usingTellor, bothOraclesSuspect, usingTellorChainlinkFrozen, tellorBrokenChainlinkFrozen}
    Status public status;

    event LastGoodPriceUpdated(uint _lastGoodPrice);
    event StatusChanged(Status newStatus);

    // --- Dependency setters ---
    
    function setAddresses(
        address _priceAggregatorAddress,
        address _tellorCallerAddress
    )
        external
        onlyOwner
    {
        checkContract(_priceAggregatorAddress);
        checkContract(_tellorCallerAddress);
       
        priceAggregator = AggregatorV3Interface(_priceAggregatorAddress);
        tellorCaller = ITellorCaller(_tellorCallerAddress);

        // Explicitly set initial system status
        status = Status.usingChainlink;

        // Get an initial price from Chainlink to serve as first reference for lastGoodPrice
        ChainlinkResponse memory chainlinkResponse = _getCurrentChainlinkResponse();
        
        require(!_chainlinkIsBroken(chainlinkResponse) && !_chainlinkIsFrozen(chainlinkResponse), 
            "PriceFeed: Chainlink must be working and current");

        _storeChainlinkData(chainlinkResponse);

        _renounceOwnership();
    }

    // --- Functions ---

    /*
    * fetchPrice():
    * Returns the latest price obtained from the Oracle. Uses a main oracle (Chainlink) and a fallback oracle(Tellor) 
    * in case Chainlink fails. If both fail, it uses the last good price seen by Liquity.
    *
    */
    function fetchPrice() external override returns (uint) {
        // Get current price data from chainlink
        ChainlinkResponse memory chainlinkResponse = _getCurrentChainlinkResponse();
    
        // --- Case 1: System fetched last price from Chainlink  ---
        if (status == Status.usingChainlink) {
            console.log("case 1");
            // Get previous round price data from Chainlink
            ChainlinkResponse memory prevChainlinkResponse = _getPrevChainlinkResponse(chainlinkResponse.roundId);

            // If Chainlink is broken, or price has deviated too much from its last value, try Tellor
            if (_chainlinkIsBroken(chainlinkResponse) ||  
                _chainlinkPriceChangeAboveMax(chainlinkResponse, prevChainlinkResponse)) 
            {
                console.log("chainlink is broken or price deviation > max");
               TellorResponse memory tellorResponse = _getCurrentTellorResponse();

                // If Tellor is broken then both oracles are suspect, and we just use the last good price
                if (_tellorIsBroken(tellorResponse)) {
                    console.log("tellor is broken");

                    _changeStatus(Status.bothOraclesSuspect);
                    return lastGoodPrice; 
                }
                /*
                * If Tellor is only frozen but otherwise returning valid data, just use the last good price.
                * Tellor may need to be tipped to return current data.
                */
                if (_tellorIsFrozen(tellorResponse)) {
                    console.log("tellor is frozen");
                    _changeStatus(Status.usingTellor);
                    return lastGoodPrice;
                }
                
                // If Chainlink is broken and Tellor is working, switch to Tellor and return current Tellor price
                _changeStatus(Status.usingTellor);
                uint scaledTellorPrice = _scaleTellorPriceByDigits(tellorResponse.value);
                _storeLastGoodPrice(scaledTellorPrice);
                return scaledTellorPrice;
            }

            // If Chainlink is frozen, try Tellor
            if (_chainlinkIsFrozen(chainlinkResponse)) {
                console.log("chainlink is frozen");
                TellorResponse memory tellorResponse = _getCurrentTellorResponse();
               
                // If Tellor is broken too, remember Chainlink froze & Tellor broke, and use last good price
                if (_tellorIsBroken(tellorResponse)) {
                    console.log("tellor is broken");
                    _changeStatus(Status.tellorBrokenChainlinkFrozen);
                    return lastGoodPrice;     
                }

                // If Tellor is not broken then remember Chainlink froze, and switch to Tellor
                _changeStatus(Status.usingTellorChainlinkFrozen);
               
                if (_tellorIsFrozen(tellorResponse)) {  
                    console.log("tellor is frozen");
                    return lastGoodPrice;
                }

                // If Tellor is working, use it
                console.log("tellor is working");
                uint scaledTellorPrice = _scaleTellorPriceByDigits(tellorResponse.value);
                _storeLastGoodPrice(scaledTellorPrice);
                return scaledTellorPrice;
            }

            // If Chainlink is working, return its current price
            console.log("chainlink is working");
            uint scaledChainlinkPrice = _storeChainlinkData(chainlinkResponse);
            return scaledChainlinkPrice;    
        }

        // --- Case 2: The system fetched last price from Tellor --- 
        if (status == Status.usingTellor) {
            console.log("case 2");
            // Get Tellor price data
            TellorResponse memory tellorResponse = _getCurrentTellorResponse();
          
            // If both Tellor and Chainlink are live and reporting similar prices, switch back to Chainlink
            if (_bothOraclesLiveAndSimilarPrice(chainlinkResponse, tellorResponse)) {
                console.log("both chainlink and tellor are working");
                _changeStatus(Status.usingChainlink);
                uint scaledChainlinkPrice = _storeChainlinkData(chainlinkResponse);
                return scaledChainlinkPrice;
            }

            if (_tellorIsBroken(tellorResponse)) {
                console.log("tellor is broken");
                _changeStatus(Status.bothOraclesSuspect);
                return lastGoodPrice; 
            }

            /*
            * If Tellor is only frozen but otherwise returning valid data, just use the last good price.
            * Tellor may need to be tipped to return current data.
            */
            if (_tellorIsFrozen(tellorResponse)) {
                console.log("tellor is frozen");
                return lastGoodPrice;}
            
            // Otherwise, use Tellor price
            console.log("tellor is working");
            uint scaledTellorPrice = _scaleTellorPriceByDigits(tellorResponse.value);
            _storeLastGoodPrice(scaledTellorPrice);
            return scaledTellorPrice;
        }

        // --- Case 3: Both oracles were suspect at the last price fetch ---
        if (status == Status.bothOraclesSuspect) {
            console.log("case 3");
            // Get current price data from Tellor
            TellorResponse memory tellorResponse = _getCurrentTellorResponse();
           
            /*
            * If both oracles are now back online and close together in price, we assume that they are reporting
            * accurately, and so we switch back to Chainlink.
            */
            if (_bothOraclesLiveAndSimilarPrice(chainlinkResponse, tellorResponse)) {
                console.log("both chainlink and tellor are working");
                _changeStatus(Status.usingChainlink);
                uint scaledChainlinkPrice = _storeChainlinkData(chainlinkResponse);
                return scaledChainlinkPrice;
            } 

            // Otherwise, return the last good price
            return lastGoodPrice;
        }

        // --- Case 4: Using Tellor, and Chainlink is frozen ---
        if (status == Status.usingTellorChainlinkFrozen) {
            console.log("case 4");
            // Get current price data from Tellor
            TellorResponse memory tellorResponse = _getCurrentTellorResponse();

            if (_chainlinkIsBroken(chainlinkResponse)) {
                // If Chainlink is broken and Tellor is broken then bothOraclesSuspect, and use last good price
                if (_tellorIsBroken(tellorResponse)) {
                    console.log("chainlink is broken, tellor is broken");
                    _changeStatus(Status.bothOraclesSuspect);
                    return lastGoodPrice;
                }
                // If Chainlink is broken and Tellor is frozen, switch purely to Tellor, and use last good price now
                if (_tellorIsFrozen(tellorResponse)) {
                    console.log("chainlink is broken, tellor is frozen");
                    _changeStatus(Status.usingTellor);
                    return lastGoodPrice;
                }
            }

            // If Chainlink is now live, switch back to it
            if (!_chainlinkIsFrozen(chainlinkResponse)) {
                console.log("chainlink is live");
                _changeStatus(Status.usingChainlink);
                uint scaledChainlinkPrice = _storeChainlinkData(chainlinkResponse);
                return scaledChainlinkPrice;
            }

            // if Chainlink is frozen and Tellor is broken, remember Tellor broke, and use last good price
           if (_tellorIsBroken(tellorResponse)) {
               console.log("chainlink is frozen, tellor is broken");
                _changeStatus(Status.tellorBrokenChainlinkFrozen);
                return lastGoodPrice;
           }

            // if Chainlink is frozen and Tellor is live, keep using Tellor (no status change)
            console.log("chainlink is frozen, tellor is live");
            uint scaledTellorPrice = _scaleTellorPriceByDigits(tellorResponse.value);
            _storeLastGoodPrice(scaledTellorPrice);
            return scaledTellorPrice;
        }

        // --- Case 5: Tellor is broken, Chainlink is frozen ---
         if (status == Status.tellorBrokenChainlinkFrozen) { 
             console.log("case 5");
            // If Chainlink breaks too, now both oracles are suspect
            if (_chainlinkIsBroken(chainlinkResponse)) {
                console.log("chainlink is broken");
                _changeStatus(Status.bothOraclesSuspect);
                return lastGoodPrice;
            }

            // If Chainlink remains frozen, use last good price
            if (_chainlinkIsFrozen(chainlinkResponse)) {
                console.log("chainlink is frozen");
                return lastGoodPrice;
            }

            // If Chainlink is live, switch back to it
            console.log("chainlink is live");
            _changeStatus(Status.usingChainlink);
            uint scaledChainlinkPrice = _storeChainlinkData(chainlinkResponse);
            return scaledChainlinkPrice;
        }
    }

    // --- Helper functions --- 

    function _chainlinkIsBroken(ChainlinkResponse memory _response) internal view returns (bool) {
        // Check for response call reverted
        if (!_response.success) {return true;}
        // Check for an invalid roundId that is 0
        if (_response.roundId == 0) {return true;}
        // Check for an invalid timeStamp that is 0, or in the future
        if (_response.timestamp == 0 || _response.timestamp > block.timestamp) {return true;}
        // Check for non-positive price
        if (_response.answer <= 0) {return true;} 
       
        return false;
    }

    function _chainlinkIsFrozen(ChainlinkResponse memory _response) internal view returns (bool) {
         // Check whether the oracle has frozen
        if ((block.timestamp.sub(_response.timestamp) > TIMEOUT)) {return true;}

        return false;
    }

    function _chainlinkPriceChangeAboveMax(ChainlinkResponse memory _currentResponse, ChainlinkResponse memory _prevResponse) internal view returns (bool) {
        uint currentScaledPrice = _scaleChainlinkPriceByDigits(uint256(_currentResponse.answer), _currentResponse.digits);
        uint prevScaledPrice = _scaleChainlinkPriceByDigits(uint256(_prevResponse.answer), _prevResponse.digits);
        
        uint deviation = LiquityMath._getAbsoluteDifference(currentScaledPrice, prevScaledPrice).mul(DECIMAL_PRECISION).div(prevScaledPrice);
         
        return deviation > MAX_PRICE_DEVIATION_FROM_PREVIOUS;
    }

    function _tellorIsBroken(TellorResponse memory _response) internal view returns (bool) {
        // Check for response call reverted
        if (!_response.success) {return true;}
        // Check for an invalid timeStamp that is 0, or in the future
        if (_response.timestamp == 0 || _response.timestamp > block.timestamp) {return true;}
        // Check for zero price
        if (_response.value == 0) {return true;} 
        
        return false;
    }

     function _tellorIsFrozen(TellorResponse  memory _tellorResponse) internal view returns (bool) {
        return block.timestamp.sub(_tellorResponse.timestamp) > TIMEOUT;
    }

    function _bothOraclesLiveAndSimilarPrice(ChainlinkResponse memory _chainlinkResponse, TellorResponse memory _tellorResponse) internal view returns (bool) {
        // Return false if either oracle is broken or frozen
        if 
        (
            _tellorIsBroken(_tellorResponse) || 
            _tellorIsFrozen(_tellorResponse) || 
            _chainlinkIsBroken(_chainlinkResponse) ||
            _chainlinkIsFrozen(_chainlinkResponse)
        )
        {
            console.log("both oracles not live");
            return false;
        }

        uint scaledChainlinkPrice = _scaleChainlinkPriceByDigits(uint256(_chainlinkResponse.answer), _chainlinkResponse.digits);
        uint scaledTellorPrice = _scaleTellorPriceByDigits(_tellorResponse.value);
        
        // Get the relative price difference between the oracles
        uint minPrice = LiquityMath._min(scaledTellorPrice, scaledChainlinkPrice);
        uint maxPrice = LiquityMath._max(scaledTellorPrice, scaledChainlinkPrice);
        uint percentPriceDifference = maxPrice.sub(minPrice).mul(DECIMAL_PRECISION).div(minPrice);
        
        /*
        * return true if the relative price difference is small: if so, we assume both oracles are probably reporting 
        * the honest market price, as it is unlikely that both have been broken/hacked and are still in-sync.
        */
        return percentPriceDifference < MAX_PRICE_DIFFERENCE_FOR_RETURN;
    }
   
    function _scaleChainlinkPriceByDigits(uint _price, uint _answerDigits) internal pure returns (uint) {
        /* 
        * Convert the price returned by the Oracle to an 18-digit decimal for use by Liquity.
        * Currently, the main Oracle (Chainlink) uses an 8-digit price, but we also handle the possibility of
        * future changes.
        */
        uint price;
        if (_answerDigits > TARGET_DIGITS) { 
            // Scale the returned price value down to Liquity's target precision 
            price = _price.div(10 ** (_answerDigits - TARGET_DIGITS));
        }
        else if (_answerDigits < TARGET_DIGITS) {
            // Scale the returned price value up to Liquity's target precision
            price = _price.mul(10 ** (TARGET_DIGITS - _answerDigits));
        } 
        return price;
    }

    function _scaleTellorPriceByDigits(uint _price) internal pure returns (uint) {
        return _price.mul(10**(TARGET_DIGITS - TELLOR_DIGITS));
    }

    function _changeStatus(Status _status) internal {
        status = _status;
        emit StatusChanged(_status);
    }

    function _storeLastGoodPrice(uint _lastGoodPrice) internal {
        lastGoodPrice = _lastGoodPrice;
        emit LastGoodPriceUpdated(_lastGoodPrice);
    }

    function _storeChainlinkData(ChainlinkResponse memory chainlinkResponse) internal returns (uint) {
        uint scaledChainlinkPrice = _scaleChainlinkPriceByDigits(uint256(chainlinkResponse.answer), chainlinkResponse.digits);
        _storeLastGoodPrice(scaledChainlinkPrice);

        return scaledChainlinkPrice;
    }

    // --- Oracle response wrapper functions ---

    function _getCurrentTellorResponse() internal view returns (TellorResponse memory tellorResponse) {
        try tellorCaller.getTellorCurrentValue(ETHUSD_TELLOR_REQ_ID) returns 
        (
            bool ifRetrieve,
            uint256 value,
            uint256 _timestampRetrieved
        ) 
        {
            // If call to Tellor succeeds, return the response and success = true
            (tellorResponse.ifRetrieve,
            tellorResponse.value,
            tellorResponse.timestamp,
            tellorResponse.success) = (ifRetrieve, value, _timestampRetrieved, true);

            return (tellorResponse);
        }catch {
             // If call to Tellor reverts, return a zero response with success = false
            return (tellorResponse);
        }
    }

    function _getCurrentChainlinkResponse() internal view returns (ChainlinkResponse memory chainlinkResponse) {
        // First, try to get current digits:
        try priceAggregator.decimals() returns (uint8 decimals) {
            // If call to Chainlink succeeds, record the current digits
            chainlinkResponse.digits = decimals;
        } catch {
            // If call to Chainlink aggregator reverts, return a zero response with success = false
            return chainlinkResponse;
        }
        
        // Secondly, try to get latest price data:
        try priceAggregator.latestRoundData() returns 
        (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 timestamp,
            uint80 answeredInRound
        )
        {
            // If call to Chainlink succeeds, return the response and success = true
            (chainlinkResponse.roundId,
            chainlinkResponse.answer,
            chainlinkResponse.timestamp)  = (roundId, answer, timestamp);
            chainlinkResponse.success = true;
            return chainlinkResponse;
        } catch {
            // If call to Chainlink aggregator reverts, return a zero response with success = false
            return chainlinkResponse;
        }
    }

    function _getPrevChainlinkResponse(uint80 _currentRoundId) internal view returns (ChainlinkResponse memory prevChainlinkResponse) {
        /* 
        * First, try to get current digits.
        * NOTE:  Chainlink only offers a current decimals() value - there is no way to obtain the decimals used in a previous round,
        * so we use the current digits, and assume/hope they have not changed between two consecutive rounds checked by Liquity
        * in a price fetch.
        */
        try priceAggregator.decimals() returns (uint8 decimals) {
            // If call to Chainlink succeeds, record the current digits
            prevChainlinkResponse.digits = decimals;
        } catch {
            // If call to Chainlink aggregator reverts, return a zero response with success = false
            return prevChainlinkResponse;
        }
        
        // Secondly, try to get the price data from the previous round:
        try priceAggregator.getRoundData(_currentRoundId - 1) returns 
        (
            uint80 roundId,
            int256 answer,
            uint256 startedAt, 
            uint256 timestamp,
            uint80 answeredInRound
        )
        {
            // If call to Chainlink succeeds, return the response and success = true
            (prevChainlinkResponse.roundId,
            prevChainlinkResponse.answer,
            prevChainlinkResponse.timestamp)  = (roundId, answer, timestamp);
            prevChainlinkResponse.success = true;
            return prevChainlinkResponse;
        } catch {
            // If call to Chainlink aggregator reverts, return a zero response with success = false
            return prevChainlinkResponse;
        }
    }
}

