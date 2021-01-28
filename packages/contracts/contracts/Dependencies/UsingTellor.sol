// SPDX-License-Identifier: MIT
pragma solidity 0.6.11;

import "./ITellor.sol";


/*
*
*/

contract UsingTellor {
    ITellor private tellor;

    /*Constructor*/
    /**
     * @dev the constructor sets the storage address and owner
     * @param _tellor is the TellorMaster address
     */
    constructor(address payable _tellor) public {
        tellor = ITellor(_tellor);
    }

    /**
     * @dev Retreive value from oracle based on requestId/timestamp
     * @param _requestId being requested
     * @param _timestamp to retreive data/value from
     * @return uint value for requestId/timestamp submitted
     */
    function retrieveData(uint256 _requestId, uint256 _timestamp)
        public
        view
        returns (uint256)
    {
        return tellor.retrieveData(_requestId, _timestamp);
    }

    /**
     * @dev Gets the 5 miners who mined the value for the specified requestId/_timestamp
     * @param _requestId to looku p
     * @param _timestamp is the timestamp to look up miners for
     * @return bool true if requestId/timestamp is under dispute
     */
    function isInDispute(uint256 _requestId, uint256 _timestamp)
        public
        view
        returns (bool)
    {
        return tellor.isInDispute(_requestId, _timestamp);
    }

    /**
     * @dev Counts the number of values that have been submited for the request
     * @param _requestId the requestId to look up
     * @return uint count of the number of values received for the requestId
     */
    function getNewValueCountbyRequestId(uint256 _requestId)
        public
        view
        returns (uint256)
    {
        return tellor.getNewValueCountbyRequestId(_requestId);
    }

    /**
     * @dev Gets the timestamp for the value based on their index
     * @param _requestId is the requestId to look up
     * @param _index is the value index to look up
     * @return uint timestamp
     */

    function getTimestampbyRequestIDandIndex(uint256 _requestId, uint256 _index)
        public
        view
        returns (uint256)
    {
        return tellor.getTimestampbyRequestIDandIndex(_requestId, _index);
    }

    /**
     * @dev Allows the user to get the latest value for the requestId specified
     * @param _requestId is the requestId to look up the value for
     * @return ifRetrieve bool true if it is able to retreive a value, the value, and the value's timestamp
     * @return value the value retrieved
     * @return _timestampRetrieved the value's timestamp
     */
    function getCurrentValue(uint256 _requestId)
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

    // slither-disable-next-line calls-loop
    function getIndexForDataBefore(uint256 _requestId, uint256 _timestamp)
        public
        view
        returns (bool found, uint256 index)
    {
        uint256 _count = tellor.getNewValueCountbyRequestId(_requestId);
        if (_count > 0) {
            uint256 middle;
            uint256 start = 0;
            uint256 end = _count - 1;
            uint256 _time;

            //Checking Boundaries to short-circuit the algorithm
            _time = tellor.getTimestampbyRequestIDandIndex(_requestId, start);
            if (_time >= _timestamp) return (false, 0);
            _time = tellor.getTimestampbyRequestIDandIndex(_requestId, end);
            if (_time < _timestamp) return (true, end);

            //Since the value is within our boundaries, do a binary search
            while (true) {
                middle = (end - start) / 2 + 1 + start;
                _time = tellor.getTimestampbyRequestIDandIndex(
                    _requestId,
                    middle
                );
                if (_time < _timestamp) {
                    //get imeadiate next value
                    uint256 _nextTime =
                        tellor.getTimestampbyRequestIDandIndex(
                            _requestId,
                            middle + 1
                        );
                    if (_nextTime >= _timestamp) {
                        //_time is correct
                        return (true, middle);
                    } else {
                        //look from middle + 1(next value) to end
                        start = middle + 1;
                    }
                } else {
                    uint256 _prevTime =
                        tellor.getTimestampbyRequestIDandIndex(
                            _requestId,
                            middle - 1
                        );
                    if (_prevTime < _timestamp) {
                        // _prevtime is correct
                        return (true, middle - 1);
                    } else {
                        //look from start to middle -1(prev value)
                        end = middle - 1;
                    }
                }
                //We couldn't found a value
                //if(middle - 1 == start || middle == _count) return (false, 0);
            }
        }
        return (false, 0);
    }

    /**
     * @dev Allows the user to get the first value for the requestId before the specified timestamp
     * @param _requestId is the requestId to look up the value for
     * @param _timestamp before which to search for first verified value
     * @return _ifRetrieve bool true if it is able to retreive a value, the value, and the value's timestamp
     * @return _value the value retrieved
     * @return _timestampRetrieved the value's timestamp
     */
    function getDataBefore(uint256 _requestId, uint256 _timestamp)
        public
        view
        returns (
            bool _ifRetrieve,
            uint256 _value,
            uint256 _timestampRetrieved
        )
    {
        (bool _found, uint256 _index) =
            getIndexForDataBefore(_requestId, _timestamp);
        if (!_found) return (false, 0, 0);
        uint256 _time =
            tellor.getTimestampbyRequestIDandIndex(_requestId, _index);
        _value = tellor.retrieveData(_requestId, _time);
        //If value is diputed it'll return zero
        if (_value > 0) return (true, _value, _time);
        return (false, 0, 0);
    }  
}