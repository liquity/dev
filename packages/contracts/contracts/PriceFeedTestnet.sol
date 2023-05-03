// SPDX-License-Identifier: MIT
pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import "./Interfaces/IPriceFeed.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/LiquityMath.sol";
import "./Dependencies/IStdReference.sol";

/*
* PriceFeed for testnet deployment, to be connected to Chainlink's live ONE:USD aggregator reference 
* contract.
*
* The PriceFeed uses Chainlink as primary oracle and no secondary oracle. 
* ** This contract is only for testnet purposes **
*/
contract PriceFeedTestnet is Ownable, CheckContract, IPriceFeed {
    using SafeMath for uint256;

    string constant public NAME = "PriceFeed";

    IStdReference public priceAggregator;

    /* 
    * The maximum relative price difference between two oracle responses allowed in order for the PriceFeed
    * to return to using the Chainlink oracle. 18-digit precision.
    */
    uint constant public MAX_PRICE_DIFFERENCE_BETWEEN_ORACLES = 5e16; // 5%

    // The last good price seen from an oracle by Liquity
    uint public lastGoodPrice;

    struct BandResponse {
        uint256 rate; // base/quote exchange rate, multiplied by 1e18.
        uint256 lastUpdated;
        bool success;
    }

    enum Status {
        bandWorking, 
        bandNotWorking
    }

    // The current status of the PricFeed, which determines the conditions for the next price fetch attempt
    Status public status;

    event LastGoodPriceUpdated(uint _lastGoodPrice);
    event PriceFeedStatusChanged(Status newStatus);

    // --- Dependency setters ---
    
    function setAddresses(
        address _priceAggregatorAddress
    )
        external
        onlyOwner
    {
        checkContract(_priceAggregatorAddress);
       
        priceAggregator = IStdReference(_priceAggregatorAddress);

        // Explicitly set initial system status
        status = Status.bandWorking;

        // Get an initial price from Band to serve as first reference for lastGoodPrice
        BandResponse memory bandResponse = _getBandResponse();
        
        _storeBandPrice(bandResponse);

        _renounceOwnership();
    }

    // --- Functions ---

    /*
    * fetchPrice():
    * Returns the latest price obtained from the Oracle. Called by Liquity functions that require a current price.
    *
    * Also callable by anyone externally.
    *
    * Non-view function - it stores the last good price seen by Liquity.
    *
    * Uses a main oracle (Chainlink) and if it fails it uses the last good price seen by Liquity.
    *
    */
    function fetchPrice() external override returns (uint) {
        // Get current and previous price data from Chainlink
        BandResponse memory bandResponse = _getBandResponse();

        if (status == Status.bandWorking) {
            if (_bandIsBroken(bandResponse)) {
                _changeStatus(Status.bandNotWorking);
                return lastGoodPrice; 
            }  

            return _storeBandPrice(bandResponse);
        }

        if (status == Status.bandNotWorking) {
            if (!_bandIsBroken(bandResponse)) {
                _changeStatus(Status.bandWorking);
                return _storeBandPrice(bandResponse);
            }
            return lastGoodPrice;
        }
    }

    // --- Helper functions ---

    /* Chainlink is considered broken if its current or previous round data is in any way bad. We check the previous round
    * for two reasons:
    *
    * 1) It is necessary data for the price deviation check in case 1,
    * and
    * 2) Chainlink is the PriceFeed's preferred primary oracle - having two consecutive valid round responses adds
    * peace of mind when using or returning to Chainlink.
    */
    function _bandIsBroken(BandResponse memory _response) internal view returns (bool) {
        if (!_response.success) {return true;}
        if (_response.lastUpdated == 0 || _response.lastUpdated > block.timestamp) {return true;}
        // Check for non-positive price
        if (_response.rate <= 0) {return true;}

        return false;
    }

    function _changeStatus(Status _status) internal {
        status = _status;
        emit PriceFeedStatusChanged(_status);
    }

    function _storeBandPrice(BandResponse memory _bandResponse) internal returns (uint) {
        lastGoodPrice = _bandResponse.rate;
        emit LastGoodPriceUpdated(lastGoodPrice);

        return lastGoodPrice;
    }

    // --- Oracle response wrapper functions ---

    function _getBandResponse() internal view returns (BandResponse memory bandResponse) {
        // Try to get the price data from the previous round:
        try priceAggregator.getReferenceData("ONE", "USD") returns (IStdReference.ReferenceData memory response) {

            // Return max of lastUpdatedBase and lastUpdatedQuote
            bandResponse.lastUpdated = response.lastUpdatedBase > response.lastUpdatedQuote ?
                response.lastUpdatedBase :
                response.lastUpdatedQuote;

            bandResponse.rate = response.rate;
            bandResponse.success = true;

            return bandResponse;
        } catch {
            return bandResponse;
        }
    }
}

