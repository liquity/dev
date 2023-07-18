// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Interfaces/ITellorCaller.sol";
import "usingtellor/contracts/interface/ITellor.sol";
/*
* This contract has a single external function that calls Tellor: getTellorCurrentValue().
*
* The function is called by the thUSD contract PriceFeed.sol. If any of its inner calls to Tellor revert,
* this function will revert, and PriceFeed will catch the failure and handle it accordingly.
*
* The function comes from Tellor's own wrapper contract, 'UsingTellor.sol' and 
* an example of how to integrate the Tellor oracle into a Stabilio-like system `TellorCaller.col`:
* https://github.com/tellor-io/usingtellor/blob/master/contracts/UsingTellor.sol
* https://github.com/tellor-io/tellor-caller-stabilio/blob/main/contracts/TellorCaller.sol
*
*/
contract TellorCaller is ITellorCaller {

    uint256 constant public DISPUTE_DELAY = 15 minutes; // 15 minutes delay

    ITellor public immutable tellor;
    bytes32 public immutable queryId;

    uint256 public lastStoredTimestamp;
    uint256 public lastStoredPrice;

    /**
     * @param _tellorMasterAddress Address of Tellor contract
     * @param _queryId Pre-calculated hash of query. See https://queryidbuilder.herokuapp.com/spotprice
     */
    constructor (address _tellorMasterAddress, bytes32 _queryId) {
        tellor = ITellor(_tellorMasterAddress);
        queryId = _queryId;
    }

    /*
    * @dev Allows the user to get the latest value for the requestId specified
    * @return ifRetrieve bool true if it is able to retrieve a value, the value, and the value's timestamp
    * @return value the value retrieved
    * @return _timestampRetrieved the value's timestamp
    */
    function getTellorCurrentValue()
        external
        override
        returns (
            bool ifRetrieve,
            uint256 value,
            uint256 _timestampRetrieved
        )
    {
        // retrieve most recent 15+ minute old value for a queryId. the time buffer allows time for a bad value to be disputed
        (, bytes memory data, uint256 timestamp) = 
            tellor.getDataBefore(queryId, block.timestamp - DISPUTE_DELAY);
        uint256 _value = abi.decode(data, (uint256));
        if (timestamp == 0 || _value == 0) return (false, _value, timestamp);
        if (timestamp > lastStoredTimestamp) {
            lastStoredTimestamp = timestamp;
            lastStoredPrice = _value;
            return (true, _value, timestamp);
        } else {
            return (true, lastStoredPrice, lastStoredTimestamp);
        }
    }

}
