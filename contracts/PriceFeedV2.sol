// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
import "./Interfaces/IPriceFeed.sol";
import "@chainlink/contracts/src/v0.8/interfaces/FlagsInterface.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/BaseMath.sol";
import "./Dependencies/VestaMath.sol";

contract PriceFeedV2 is OwnableUpgradeable, CheckContract, BaseMath, IPriceFeed {
	using SafeMathUpgradeable for uint256;

	string public constant NAME = "PriceFeed";
	address public constant FLAG_ARBITRUM_SEQ_OFFLINE =
		0xa438451D6458044c3c8CD2f6f31c91ac882A6d91;

	FlagsInterface public chainlinkFlags;

	// Use to convert a price answer to an 18-digit precision uint
	uint256 public constant TARGET_DIGITS = 18;

	uint256 public constant TIMEOUT = 4 hours;

	// Maximum deviation allowed between two consecutive Chainlink oracle prices. 18-digit precision.
	uint256 public constant MAX_PRICE_DEVIATION_FROM_PREVIOUS_ROUND = 5e17; // 50%
	uint256 public constant MAX_PRICE_DIFFERENCE_BETWEEN_ORACLES = 5e16; // 5%

	bool public isInitialized;

	address public adminContract;

	IPriceFeed.Status public status;
	mapping(address => RegisterOracle) public registeredOracles;
	mapping(address => uint256) public lastGoodPrice;
	mapping(address => uint256) public lastGoodIndex;

	modifier isController() {
		require(msg.sender == owner() || msg.sender == adminContract, "Invalid Permission");
		_;
	}

	function setAddresses(address _chainlinkFlag, address _adminContract) external initializer {
		require(!isInitialized);
		checkContract(_chainlinkFlag);
		checkContract(_adminContract);
		isInitialized = true;

		__Ownable_init();

		adminContract = _adminContract;
		chainlinkFlags = FlagsInterface(_chainlinkFlag);
		status = Status.chainlinkWorking;
	}

	function setAdminContract(address _admin) external onlyOwner {
		require(_admin != address(0));
		adminContract = _admin;
	}

	function addOracle(
		address _token,
		address _chainlinkOracle,
		address _chainlinkIndexOracle
	) external override isController {
		AggregatorV3Interface priceOracle = AggregatorV3Interface(_chainlinkOracle);
		AggregatorV3Interface indexOracle = AggregatorV3Interface(_chainlinkIndexOracle);

		registeredOracles[_token] = RegisterOracle(priceOracle, indexOracle, true);

		(
			ChainlinkResponse memory chainlinkResponse,
			ChainlinkResponse memory prevChainlinkResponse,
			ChainlinkResponse memory chainlinkIndexResponse,
			ChainlinkResponse memory prevChainlinkIndexResponse
		) = _getChainlinkResponses(priceOracle, indexOracle);

		require(
			!_chainlinkIsBroken(chainlinkResponse, prevChainlinkResponse) &&
				!_chainlinkIsFrozen(chainlinkResponse),
			"PriceFeed: Chainlink must be working and current"
		);
		require(
			!_chainlinkIsBroken(chainlinkIndexResponse, prevChainlinkIndexResponse),
			"PriceFeed: Chainlink must be working and current"
		);

		_storeChainlinkPrice(_token, chainlinkResponse);
		_storeChainlinkIndex(_token, chainlinkIndexResponse);

		emit RegisteredNewOracle(_token, _chainlinkOracle, _chainlinkIndexOracle);
	}

	function fetchPrice(address _token) external override returns (uint256) {
		RegisterOracle storage oracle = registeredOracles[_token];
		require(oracle.isRegistered, "Oracle is not registered!");

		(
			ChainlinkResponse memory chainlinkResponse,
			ChainlinkResponse memory prevChainlinkResponse,
			ChainlinkResponse memory chainlinkIndexResponse,
			ChainlinkResponse memory prevChainlinkIndexResponse
		) = _getChainlinkResponses(oracle.chainLinkOracle, oracle.chainLinkIndex);

		uint256 lastTokenGoodPrice = lastGoodPrice[_token];
		uint256 lastTokenGoodIndex = lastGoodIndex[_token];

		bool isChainlinkOracleBroken = _chainlinkIsBroken(
			chainlinkResponse,
			prevChainlinkResponse
		) || _chainlinkIsFrozen(chainlinkResponse);

		bool isChainlinkIndexBroken = _chainlinkIsBroken(
			chainlinkIndexResponse,
			prevChainlinkIndexResponse
		);

		if (status == Status.chainlinkWorking) {
			if (isChainlinkOracleBroken || isChainlinkIndexBroken) {
				if (!isChainlinkOracleBroken) {
					lastTokenGoodPrice = _storeChainlinkPrice(_token, chainlinkResponse);
				}

				if (!isChainlinkIndexBroken) {
					lastTokenGoodIndex = _storeChainlinkIndex(_token, chainlinkIndexResponse);
				}

				_changeStatus(Status.chainlinkUntrusted);
				return _getIndexedPrice(lastTokenGoodPrice, lastTokenGoodIndex);
			}

			// If Chainlink price has changed by > 50% between two consecutive rounds
			if (_chainlinkPriceChangeAboveMax(chainlinkResponse, prevChainlinkResponse)) {
				return _getIndexedPrice(lastTokenGoodPrice, lastTokenGoodIndex);
			}

			lastTokenGoodPrice = _storeChainlinkPrice(_token, chainlinkResponse);
			lastTokenGoodIndex = _storeChainlinkIndex(_token, chainlinkIndexResponse);

			return _getIndexedPrice(lastTokenGoodPrice, lastTokenGoodIndex);
		}

		if (status == Status.chainlinkUntrusted) {
			if (!isChainlinkOracleBroken && !isChainlinkIndexBroken) {
				_changeStatus(Status.chainlinkWorking);
			}

			if (!isChainlinkOracleBroken) {
				lastTokenGoodPrice = _storeChainlinkPrice(_token, chainlinkResponse);
			}

			if (!isChainlinkIndexBroken) {
				lastTokenGoodIndex = _storeChainlinkIndex(_token, chainlinkIndexResponse);
			}

			return _getIndexedPrice(lastTokenGoodPrice, lastTokenGoodIndex);
		}

		return _getIndexedPrice(lastTokenGoodPrice, lastTokenGoodIndex);
	}

	function _getIndexedPrice(uint256 _price, uint256 _index) internal pure returns (uint256) {
		return _price.mul(_index).div(1 ether);
	}

	function _getChainlinkResponses(
		AggregatorV3Interface _chainLinkOracle,
		AggregatorV3Interface _chainLinkIndexOracle
	)
		internal
		view
		returns (
			ChainlinkResponse memory currentChainlink,
			ChainlinkResponse memory prevChainLink,
			ChainlinkResponse memory currentChainlinkIndex,
			ChainlinkResponse memory prevChainLinkIndex
		)
	{
		currentChainlink = _getCurrentChainlinkResponse(_chainLinkOracle);
		prevChainLink = _getPrevChainlinkResponse(
			_chainLinkOracle,
			currentChainlink.roundId,
			currentChainlink.decimals
		);

		if (address(_chainLinkIndexOracle) != address(0)) {
			currentChainlinkIndex = _getCurrentChainlinkResponse(_chainLinkIndexOracle);
			prevChainLinkIndex = _getPrevChainlinkResponse(
				_chainLinkIndexOracle,
				currentChainlinkIndex.roundId,
				currentChainlinkIndex.decimals
			);
		} else {
			currentChainlinkIndex = ChainlinkResponse(1, 1 ether, block.timestamp, true, 18);

			prevChainLinkIndex = currentChainlinkIndex;
		}

		return (currentChainlink, prevChainLink, currentChainlinkIndex, prevChainLinkIndex);
	}

	function _chainlinkIsBroken(
		ChainlinkResponse memory _currentResponse,
		ChainlinkResponse memory _prevResponse
	) internal view returns (bool) {
		return _badChainlinkResponse(_currentResponse) || _badChainlinkResponse(_prevResponse);
	}

	function _badChainlinkResponse(ChainlinkResponse memory _response)
		internal
		view
		returns (bool)
	{
		if (!_response.success) {
			return true;
		}
		if (_response.roundId == 0) {
			return true;
		}
		if (_response.timestamp == 0 || _response.timestamp > block.timestamp) {
			return true;
		}
		if (_response.answer <= 0) {
			return true;
		}

		return false;
	}

	function _chainlinkIsFrozen(ChainlinkResponse memory _response)
		internal
		view
		returns (bool)
	{
		return block.timestamp.sub(_response.timestamp) > TIMEOUT;
	}

	function _chainlinkPriceChangeAboveMax(
		ChainlinkResponse memory _currentResponse,
		ChainlinkResponse memory _prevResponse
	) internal pure returns (bool) {
		uint256 currentScaledPrice = _scaleChainlinkPriceByDigits(
			uint256(_currentResponse.answer),
			_currentResponse.decimals
		);
		uint256 prevScaledPrice = _scaleChainlinkPriceByDigits(
			uint256(_prevResponse.answer),
			_prevResponse.decimals
		);

		uint256 minPrice = VestaMath._min(currentScaledPrice, prevScaledPrice);
		uint256 maxPrice = VestaMath._max(currentScaledPrice, prevScaledPrice);

		/*
		 * Use the larger price as the denominator:
		 * - If price decreased, the percentage deviation is in relation to the the previous price.
		 * - If price increased, the percentage deviation is in relation to the current price.
		 */
		uint256 percentDeviation = maxPrice.sub(minPrice).mul(DECIMAL_PRECISION).div(maxPrice);

		// Return true if price has more than doubled, or more than halved.
		return percentDeviation > MAX_PRICE_DEVIATION_FROM_PREVIOUS_ROUND;
	}

	function _scaleChainlinkPriceByDigits(uint256 _price, uint256 _answerDigits)
		internal
		pure
		returns (uint256)
	{
		uint256 price;
		if (_answerDigits >= TARGET_DIGITS) {
			// Scale the returned price value down to Vesta's target precision
			price = _price.div(10**(_answerDigits - TARGET_DIGITS));
		} else if (_answerDigits < TARGET_DIGITS) {
			// Scale the returned price value up to Vesta's target precision
			price = _price.mul(10**(TARGET_DIGITS - _answerDigits));
		}
		return price;
	}

	function _changeStatus(Status _status) internal {
		status = _status;
		emit PriceFeedStatusChanged(_status);
	}

	function _storeChainlinkIndex(
		address _token,
		ChainlinkResponse memory _chainlinkIndexResponse
	) internal returns (uint256) {
		uint256 scaledChainlinkIndex = _scaleChainlinkPriceByDigits(
			uint256(_chainlinkIndexResponse.answer),
			_chainlinkIndexResponse.decimals
		);

		_storeIndex(_token, scaledChainlinkIndex);
		return scaledChainlinkIndex;
	}

	function _storeChainlinkPrice(address _token, ChainlinkResponse memory _chainlinkResponse)
		internal
		returns (uint256)
	{
		uint256 scaledChainlinkPrice = _scaleChainlinkPriceByDigits(
			uint256(_chainlinkResponse.answer),
			_chainlinkResponse.decimals
		);

		_storePrice(_token, scaledChainlinkPrice);
		return scaledChainlinkPrice;
	}

	function _storePrice(address _token, uint256 _currentPrice) internal {
		lastGoodPrice[_token] = _currentPrice;
		emit LastGoodPriceUpdated(_token, _currentPrice);
	}

	function _storeIndex(address _token, uint256 _currentIndex) internal {
		lastGoodIndex[_token] = _currentIndex;
		emit LastGoodIndexUpdated(_token, _currentIndex);
	}

	// --- Oracle response wrapper functions ---

	function _getCurrentChainlinkResponse(AggregatorV3Interface _priceAggregator)
		internal
		view
		returns (ChainlinkResponse memory chainlinkResponse)
	{
		if (chainlinkFlags.getFlag(FLAG_ARBITRUM_SEQ_OFFLINE)) {
			return chainlinkResponse;
		}

		try _priceAggregator.decimals() returns (uint8 decimals) {
			chainlinkResponse.decimals = decimals;
		} catch {
			return chainlinkResponse;
		}

		try _priceAggregator.latestRoundData() returns (
			uint80 roundId,
			int256 answer,
			uint256, /* startedAt */
			uint256 timestamp,
			uint80 /* answeredInRound */
		) {
			chainlinkResponse.roundId = roundId;
			chainlinkResponse.answer = answer;
			chainlinkResponse.timestamp = timestamp;
			chainlinkResponse.success = true;
			return chainlinkResponse;
		} catch {
			return chainlinkResponse;
		}
	}

	function _getPrevChainlinkResponse(
		AggregatorV3Interface _priceAggregator,
		uint80 _currentRoundId,
		uint8 _currentDecimals
	) internal view returns (ChainlinkResponse memory prevChainlinkResponse) {
		if (_currentRoundId == 0) {
			return prevChainlinkResponse;
		}

		unchecked {
			try _priceAggregator.getRoundData(_currentRoundId - 1) returns (
				uint80 roundId,
				int256 answer,
				uint256, /* startedAt */
				uint256 timestamp,
				uint80 /* answeredInRound */
			) {
				prevChainlinkResponse.roundId = roundId;
				prevChainlinkResponse.answer = answer;
				prevChainlinkResponse.timestamp = timestamp;
				prevChainlinkResponse.decimals = _currentDecimals;
				prevChainlinkResponse.success = true;
				return prevChainlinkResponse;
			} catch {
				return prevChainlinkResponse;
			}
		}
	}
}
