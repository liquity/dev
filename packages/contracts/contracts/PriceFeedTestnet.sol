// SPDX-License-Identifier: MIT
pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import "./Interfaces/IPriceFeed.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/LiquityMath.sol";
import "./Dependencies/IStdReference.sol";

/*
* PriceFeed for testnet deployment, to be connected to Bands's live ONE:USD aggregator reference
* contract.
*
* The PriceFeed uses Band as the only oracle and no secondary oracle.
* ** This contract is only for testnet purposes **
*/
contract PriceFeedTestnet is Ownable, CheckContract, IPriceFeed {
    using SafeMath for uint256;

    string constant public NAME = "PriceFeed";

    IStdReference public priceAggregator;

    // The last good price seen from the oracle by Liquity
    uint public _lastGoodPrice;
    uint public lastGoodPriceUpdatedAt;

    uint constant public LAST_GOOD_PRICE_MAX_HOURS = 4 hours;

    struct BandResponse {
        uint256 rate; // base/quote exchange rate
        uint256 lastUpdatedBase;
        uint256 lastUpdatedQuote;
        bool success;
    }

    enum Status {
        bandWorking, 
        bandNotWorking
    }

    // The current status of the PricFeed.
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
        require(!_bandIsBroken(bandResponse), "Invalid Band response");
        
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
    * Uses a main oracle (Band) and if it fails it uses the last good price seen by Liquity.
    *
    */
    function fetchPrice() external override returns (uint) {
        // Get current price data from Band
        BandResponse memory bandResponse = _getBandResponse();

        if (status == Status.bandWorking) {
            if (_bandIsBroken(bandResponse)) {
                _changeStatus(Status.bandNotWorking);
                return lastGoodPrice();
            }

            return _storeBandPrice(bandResponse);
        }

        if (status == Status.bandNotWorking) {
            if (!_bandIsBroken(bandResponse)) {
                _changeStatus(Status.bandWorking);
                return _storeBandPrice(bandResponse);
            }
            return lastGoodPrice();
        }
    }

    function lastGoodPrice() public view returns (uint) {
        if (lastGoodPriceUpdatedAt.add(LAST_GOOD_PRICE_MAX_HOURS) < block.timestamp) {
            revert("PriceFeed: lastGoodPrice is too old");
        }
        return _lastGoodPrice;
    }

    // --- Helper functions ---

    /*
     * Band is considered broken if its data is in any way bad.
     */
    function _bandIsBroken(BandResponse memory _response) internal view returns (bool) {
        if (!_response.success) {return true;}
        if (_response.lastUpdatedBase == 0 || _response.lastUpdatedBase > block.timestamp) {return true;}
        if (_response.lastUpdatedQuote == 0 || _response.lastUpdatedQuote > block.timestamp) {return true;}
        // Check for non-positive price
        if (_response.rate <= 0) {return true;}

        return false;
    }

    function _changeStatus(Status _status) internal {
        status = _status;
        emit PriceFeedStatusChanged(_status);
    }

    function _storeBandPrice(BandResponse memory _bandResponse) internal returns (uint) {
        _lastGoodPrice = _bandResponse.rate;
        lastGoodPriceUpdatedAt = _bandResponse.lastUpdatedBase > _bandResponse.lastUpdatedQuote ? _bandResponse.lastUpdatedBase : _bandResponse.lastUpdatedQuote;
        emit LastGoodPriceUpdated(_lastGoodPrice);

        return _lastGoodPrice;
    }

    // --- Oracle response wrapper functions ---

    function _getBandResponse() internal view returns (BandResponse memory bandResponse) {
        // Try to get the price data from the previous round:
        try priceAggregator.getReferenceData("ONE", "USD") returns (IStdReference.ReferenceData memory response) {

            bandResponse.lastUpdatedBase = response.lastUpdatedBase;
            bandResponse.lastUpdatedQuote = response.lastUpdatedQuote;
            bandResponse.rate = response.rate;
            bandResponse.success = true;

            return bandResponse;
        } catch {
            return bandResponse;
        }
    }
}

