// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./../TestContracts/PriceFeedTestnet.sol";

/*
* PriceFeed placeholder for testnet and development. The price is simply set manually and saved in a state 
* variable. The contract does not connect to a live Chainlink price feed. 
*/
contract ChainlinkTestnet {
    
    PriceFeedTestnet feed;
    uint price = 0;
    uint time = 0;

    constructor(PriceFeedTestnet _feed) public {
        feed = _feed;
    }

    function decimals() external pure returns(uint) {
        return 18;
    }

    function setTimestamp(uint _time) external {
        time = _time;
    }

    function setPrice(uint _price) external {
        price = _price;
    }

    function latestRoundData() external view returns
     (
        uint80 /* roundId */,
        int256 answer,
        uint256 /* startedAt */,
        uint256 timestamp,
        uint80 /* answeredInRound */
    )
    {
        if(price > 0) answer = int(price);
        else answer = int(feed.getPrice());
        
        if(time == 0 ) timestamp = now;
        else timestamp = time;
    }
}
