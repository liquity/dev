
contract MockTellor {

    // --- Mock price data ---

    bool didRetrieve = true; // default to a positive retrieval
    uint private price;
    uint private updateTime;

    bool private revertRequest;

    // --- Setters for mock price data ---

    function setPrice(uint _price) external {
        price = _price;
    }

      function setDidRetrieve(bool _didRetrieve) external {
        didRetrieve = _didRetrieve;
    }

    function setUpdateTime(uint _updateTime) external {
        updateTime = _updateTime;
    }

      function setRevertRequest() external {
        revertRequest = !revertRequest;
    }

    // --- Mock data reporting functions --- 

    function getTimestampbyRequestIDandIndex(uint _requestId, uint _count) external view returns (uint) {
        return updateTime;
    }

    function getNewValueCountbyRequestId(uint reqId) external view returns (uint) {
        if (revertRequest) {require (1 == 0, "Tellor request reverted");}
        return 1;
    }

    function retrieveData(uint256 _requestId, uint256 _timestamp) external view returns (uint256) {
        return price;
    }



}