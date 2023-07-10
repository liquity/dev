// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "usingtellor/contracts/TellorPlayground.sol";


contract MockTellor is TellorPlayground {

    // --- Mock price data ---

    // bytes public immutable queryData;
    bytes32 public immutable queryId;

    constructor (bytes memory _queryData) {
        // queryData = _queryData;
        queryId = keccak256(_queryData);
    }

    // --- Setters for mock price data ---

    function setUpdateTime(uint256 _updateTime) external {
        timestamps[queryId].push(_updateTime);
    }

}

contract BrokenMockTellor {

    fallback() external { revert(); }

}
