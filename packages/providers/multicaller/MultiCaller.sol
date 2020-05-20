pragma solidity >=0.5.0;
pragma experimental ABIEncoderV2;

contract MultiCaller {
    struct CallRequest {
        address to;
        bytes data;
    }

    function performMultiple(CallRequest[] memory calls)
        public view returns (
            bytes[] memory results
        )
    {
        results = new bytes[](calls.length);

        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory result) = calls[i].to.staticcall(calls[i].data);
            require(success);
            results[i] = result;
        }
    }
}
