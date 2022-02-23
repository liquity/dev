// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "../Interfaces/IPriceFeed.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/*
 * PriceFeed placeholder for testnet and development. The price is simply set manually and saved in a state
 * variable. The contract does not connect to a live Chainlink price feed.
 */
contract PriceFeedTestnet is IPriceFeed {
	using SafeMath for uint256;

	uint256 private _price = 200 ether;
	uint256 private _index = 1 ether;

	struct MockOracleData {
		address chainLinkOracle;
		address chainLinkIndex;
		bool registed;
	}

	mapping(address => MockOracleData) public oracles;

	// --- Functions ---

	// View price getter for simplicity in tests
	function getPrice() external view returns (uint256) {
		return _price;
	}

	function getIndex() external view returns (uint256) {
		return _index;
	}

	function addOracle(
		address _token,
		address _chainlinkOracle,
		address _chainlinkIndex
	) external override {
		oracles[_token] = MockOracleData(_chainlinkOracle, _chainlinkIndex, true);
	}

	function fetchPrice(address _asset) external override returns (uint256) {
		// Fire an event just like the mainnet version would.
		// This lets the subgraph rely on events to get the latest price even when developing locally.
		emit LastGoodPriceUpdated(_asset, _price);
		emit LastGoodIndexUpdated(_asset, _price);
		return _price.mul(_index).div(1 ether);
	}

	// Manual external price setter.
	function setPrice(uint256 price) external returns (bool) {
		_price = price;
		return true;
	}

	function setIndex(uint256 index) external returns (bool) {
		_index = index;
		return true;
	}
}
