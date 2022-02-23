// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../Interfaces/IStabilityPoolManager.sol";
import "../Interfaces/ICommunityIssuance.sol";
import "../Dependencies/BaseMath.sol";
import "../Dependencies/VestaMath.sol";
import "../Dependencies/CheckContract.sol";

contract CommunityIssuance is ICommunityIssuance, OwnableUpgradeable, CheckContract, BaseMath {
	using SafeMathUpgradeable for uint256;
	using SafeERC20Upgradeable for IERC20Upgradeable;

	string public constant NAME = "CommunityIssuance";
	uint256 public constant DISTRIBUTION_DURATION = 7 days / 60;
	uint256 public constant SECONDS_IN_ONE_MINUTE = 60;

	IERC20Upgradeable public vstaToken;
	IStabilityPoolManager public stabilityPoolManager;

	mapping(address => uint256) public totalVSTAIssued;
	mapping(address => uint256) public lastUpdateTime;
	mapping(address => uint256) public VSTASupplyCaps;
	mapping(address => uint256) public vstaDistributionsByPool;

	address public adminContract;

	bool public isInitialized;

	modifier activeStabilityPoolOnly(address _pool) {
		require(lastUpdateTime[_pool] != 0, "CommunityIssuance: Pool needs to be added first.");
		_;
	}

	modifier isController() {
		require(msg.sender == owner() || msg.sender == adminContract, "Invalid Permission");
		_;
	}

	modifier isStabilityPool(address _pool) {
		require(
			stabilityPoolManager.isStabilityPool(_pool),
			"CommunityIssuance: caller is not SP"
		);
		_;
	}

	modifier onlyStabilityPool() {
		require(
			stabilityPoolManager.isStabilityPool(msg.sender),
			"CommunityIssuance: caller is not SP"
		);
		_;
	}

	// --- Functions ---
	function setAddresses(
		address _vstaTokenAddress,
		address _stabilityPoolManagerAddress,
		address _adminContract
	) external override initializer {
		require(!isInitialized, "Already initialized");
		checkContract(_vstaTokenAddress);
		checkContract(_stabilityPoolManagerAddress);
		checkContract(_adminContract);
		isInitialized = true;
		__Ownable_init();

		adminContract = _adminContract;

		vstaToken = IERC20Upgradeable(_vstaTokenAddress);
		stabilityPoolManager = IStabilityPoolManager(_stabilityPoolManagerAddress);

		emit VSTATokenAddressSet(_vstaTokenAddress);
		emit StabilityPoolAddressSet(_stabilityPoolManagerAddress);
	}

	function setAdminContract(address _admin) external onlyOwner {
		require(_admin != address(0));
		adminContract = _admin;
	}

	function addFundToStabilityPool(address _pool, uint256 _assignedSupply)
		external
		override
		isController
	{
		_addFundToStabilityPoolFrom(_pool, _assignedSupply, msg.sender);
	}

	function removeFundFromStabilityPool(address _pool, uint256 _fundToRemove)
		external
		onlyOwner
		activeStabilityPoolOnly(_pool)
	{
		uint256 newCap = VSTASupplyCaps[_pool].sub(_fundToRemove);
		require(
			totalVSTAIssued[_pool] <= newCap,
			"CommunityIssuance: Stability Pool doesn't have enough supply."
		);

		VSTASupplyCaps[_pool] -= _fundToRemove;

		if (totalVSTAIssued[_pool] == VSTASupplyCaps[_pool]) {
			disableStabilityPool(_pool);
		}

		vstaToken.safeTransfer(msg.sender, _fundToRemove);
	}

	function addFundToStabilityPoolFrom(
		address _pool,
		uint256 _assignedSupply,
		address _spender
	) external override isController {
		_addFundToStabilityPoolFrom(_pool, _assignedSupply, _spender);
	}

	function _addFundToStabilityPoolFrom(
		address _pool,
		uint256 _assignedSupply,
		address _spender
	) internal {
		require(
			stabilityPoolManager.isStabilityPool(_pool),
			"CommunityIssuance: Invalid Stability Pool"
		);

		if (lastUpdateTime[_pool] == 0) {
			lastUpdateTime[_pool] = block.timestamp;
		}

		VSTASupplyCaps[_pool] += _assignedSupply;
		vstaToken.safeTransferFrom(_spender, address(this), _assignedSupply);
	}

	function transferFundToAnotherStabilityPool(
		address _target,
		address _receiver,
		uint256 _quantity
	)
		external
		override
		onlyOwner
		activeStabilityPoolOnly(_target)
		activeStabilityPoolOnly(_receiver)
	{
		uint256 newCap = VSTASupplyCaps[_target].sub(_quantity);
		require(
			totalVSTAIssued[_target] <= newCap,
			"CommunityIssuance: Stability Pool doesn't have enough supply."
		);

		VSTASupplyCaps[_target] -= _quantity;
		VSTASupplyCaps[_receiver] += _quantity;

		if (totalVSTAIssued[_target] == VSTASupplyCaps[_target]) {
			disableStabilityPool(_target);
		}
	}

	function disableStabilityPool(address _pool) internal {
		lastUpdateTime[_pool] = 0;
		VSTASupplyCaps[_pool] = 0;
		totalVSTAIssued[_pool] = 0;
	}

	function issueVSTA() external override onlyStabilityPool returns (uint256) {
		return _issueVSTA(msg.sender);
	}

	function _issueVSTA(address _pool) internal isStabilityPool(_pool) returns (uint256) {
		uint256 maxPoolSupply = VSTASupplyCaps[_pool];

		if (totalVSTAIssued[_pool] >= maxPoolSupply) return 0;

		uint256 issuance = _getLastUpdateTokenDistribution(_pool);
		uint256 totalIssuance = issuance.add(totalVSTAIssued[_pool]);

		if (totalIssuance > maxPoolSupply) {
			issuance = maxPoolSupply.sub(totalVSTAIssued[_pool]);
			totalIssuance = maxPoolSupply;
		}

		lastUpdateTime[_pool] = block.timestamp;
		totalVSTAIssued[_pool] = totalIssuance;
		emit TotalVSTAIssuedUpdated(_pool, totalIssuance);

		return issuance;
	}

	function _getLastUpdateTokenDistribution(address stabilityPool)
		internal
		view
		returns (uint256)
	{
		require(lastUpdateTime[stabilityPool] != 0, "Stability pool hasn't been assigned");
		uint256 timePassed = block.timestamp.sub(lastUpdateTime[stabilityPool]).div(
			SECONDS_IN_ONE_MINUTE
		);
		uint256 totalDistribuedSinceBeginning = vstaDistributionsByPool[stabilityPool].mul(
			timePassed
		);

		return totalDistribuedSinceBeginning;
	}

	function sendVSTA(address _account, uint256 _VSTAamount)
		external
		override
		onlyStabilityPool
	{
		uint256 balanceVSTA = vstaToken.balanceOf(address(this));
		uint256 safeAmount = balanceVSTA >= _VSTAamount ? _VSTAamount : balanceVSTA;

		if (safeAmount == 0) {
			return;
		}

		vstaToken.transfer(_account, safeAmount);
	}

	function setWeeklyVstaDistribution(address _stabilityPool, uint256 _weeklyReward)
		external
		isController
		isStabilityPool(_stabilityPool)
	{
		vstaDistributionsByPool[_stabilityPool] = _weeklyReward.div(DISTRIBUTION_DURATION);
	}
}
