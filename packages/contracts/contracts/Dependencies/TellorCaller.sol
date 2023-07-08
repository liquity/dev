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
* The function comes from Tellor's own wrapper contract, 'UsingTellor.sol':
* https://github.com/tellor-io/usingtellor/blob/master/contracts/UsingTellor.sol
*
*/
contract TellorCaller is ITellorCaller {

    ITellor public immutable tellor;
    bytes32 public immutable ethUsdQueryId;
    bytes32 public immutable brlUsdQueryId;

    /**
     * @param _tellorMasterAddress Address of Tellor contract
     * @param _ethUsdQueryId Pre-calculated hash of query. See https://queryidbuilder.herokuapp.com/spotprice
     * @param _brlUsdqueryId Pre-calculated hash of query. See https://queryidbuilder.herokuapp.com/spotprice
     */
    constructor (address _tellorMasterAddress, bytes32 _ethUsdQueryId, bytes32 _brlUsdqueryId) {
        tellor = ITellor(_tellorMasterAddress);
        ethUsdQueryId = _ethUsdQueryId;
        brlUsdQueryId = _brlUsdqueryId;
    }

    /*
    * @dev Allows the user to get the latest value for the requestId specified
    * @return ifRetrieve bool true if it is able to retrieve a value, the value, and the value's timestamp
    * @return value the value retrieved
    * @return _timestampRetrieved the value's timestamp
    */
    function getTellorCurrentValue()
        external
        view
        override
        returns (
            bool ifRetrieve,
            uint256 ethUsdValue,
            uint256 brlUsdValue,
            uint256 _timestampRetrieved
        )
    {
        (, bytes memory _ethUsdValue, uint256 _ethUsdTime) =
            tellor.getDataBefore(ethUsdQueryId, block.timestamp - 15 minutes);
        (, bytes memory _brlUsdValue, uint256 _brlUsdTime) =
            tellor.getDataBefore(brlUsdQueryId, block.timestamp - 15 minutes);
        // If timestampRetrieved is 0, no data was found
        if(_ethUsdTime > 0 && _brlUsdTime > 0) {
            // Check that the data is not too old
            if(block.timestamp - _ethUsdTime < 24 hours && block.timestamp - _brlUsdTime < 24 hours) {
                // Use the helper function _sliceUint to parse the bytes to uint256
                return(true, _sliceUint(_ethUsdValue), _sliceUint(_brlUsdValue), _brlUsdTime);
            }
        }
        return (false, 0, 0, _brlUsdTime);
    }

    // Internal functions
    /**
     * @dev Convert bytes to uint256. Copy from `UsingTellor.sol`
     * @param _b bytes value to convert to uint256
     * @return _number uint256 converted from bytes
     */
    function _sliceUint(bytes memory _b)
        internal
        pure
        returns (uint256 _number)
    {
        for (uint256 _i = 0; _i < _b.length; _i++) {
            _number = _number * 256 + uint8(_b[_i]);
        }
    }
}
