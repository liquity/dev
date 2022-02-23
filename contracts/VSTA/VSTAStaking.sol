// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../Dependencies/BaseMath.sol";
import "../Dependencies/CheckContract.sol";
import "../Dependencies/VestaMath.sol";
import "../Interfaces/IVSTAStaking.sol";
import "../Interfaces/IDeposit.sol";
import "../Dependencies/SafetyTransfer.sol";

contract VSTAStaking is
	IVSTAStaking,
	PausableUpgradeable,
	OwnableUpgradeable,
	CheckContract,
	BaseMath,
	ReentrancyGuardUpgradeable
{
	using SafeMathUpgradeable for uint256;
	using SafeERC20Upgradeable for IERC20Upgradeable;

	bool public isInitialized;

	// --- Data ---
	string public constant NAME = "VSTAStaking";
	address constant ETH_REF_ADDRESS = address(0);

	mapping(address => uint256) public stakes;
	uint256 public totalVSTAStaked;

	mapping(address => uint256) public F_ASSETS; // Running sum of ETH fees per-VSTA-staked
	uint256 public F_VST; // Running sum of VSTA fees per-VSTA-staked

	// User snapshots of F_ETH and F_VST, taken at the point at which their latest deposit was made
	mapping(address => Snapshot) public snapshots;

	struct Snapshot {
		mapping(address => uint256) F_ASSET_Snapshot;
		uint256 F_VST_Snapshot;
	}

	address[] ASSET_TYPE;
	mapping(address => bool) isAssetTracked;
	mapping(address => uint256) public sentToTreasuryTracker;

	IERC20Upgradeable public override vstaToken;
	IERC20Upgradeable public vstToken;

	address public troveManagerAddress;
	address public borrowerOperationsAddress;
	address public activePoolAddress;
	address public treasury;

	// --- Functions ---
	function setAddresses(
		address _vstaTokenAddress,
		address _vstTokenAddress,
		address _troveManagerAddress,
		address _borrowerOperationsAddress,
		address _activePoolAddress,
		address _treasury
	) external override initializer {
		require(!isInitialized, "Already Initialized");
		require(_treasury != address(0), "Invalid Treausry Address");
		checkContract(_vstaTokenAddress);
		checkContract(_vstTokenAddress);
		checkContract(_troveManagerAddress);
		checkContract(_borrowerOperationsAddress);
		checkContract(_activePoolAddress);
		isInitialized = true;

		__Pausable_init();
		__ReentrancyGuard_init();
		__Ownable_init();
		_pause();

		vstaToken = IERC20Upgradeable(_vstaTokenAddress);
		vstToken = IERC20Upgradeable(_vstTokenAddress);
		troveManagerAddress = _troveManagerAddress;
		borrowerOperationsAddress = _borrowerOperationsAddress;
		activePoolAddress = _activePoolAddress;
		treasury = _treasury;

		isAssetTracked[ETH_REF_ADDRESS] = true;
		ASSET_TYPE.push(ETH_REF_ADDRESS);

		emit VSTATokenAddressSet(_vstaTokenAddress);
		emit VSTATokenAddressSet(_vstTokenAddress);
		emit TroveManagerAddressSet(_troveManagerAddress);
		emit BorrowerOperationsAddressSet(_borrowerOperationsAddress);
		emit ActivePoolAddressSet(_activePoolAddress);
	}

	// If caller has a pre-existing stake, send any accumulated ETH and VST gains to them.
	function stake(uint256 _VSTAamount) external override nonReentrant whenNotPaused {
		require(_VSTAamount > 0);

		uint256 currentStake = stakes[msg.sender];

		uint256 assetLength = ASSET_TYPE.length;
		uint256 AssetGain;
		address asset;

		for (uint256 i = 0; i < assetLength; i++) {
			asset = ASSET_TYPE[i];

			if (currentStake != 0) {
				AssetGain = _getPendingAssetGain(asset, msg.sender);

				if (i == 0) {
					uint256 VSTGain = _getPendingVSTGain(msg.sender);
					vstToken.transfer(msg.sender, VSTGain);

					emit StakingGainsVSTWithdrawn(msg.sender, VSTGain);
				}

				_sendAssetGainToUser(asset, AssetGain);
				emit StakingGainsAssetWithdrawn(msg.sender, asset, AssetGain);
			}

			_updateUserSnapshots(asset, msg.sender);
		}

		uint256 newStake = currentStake.add(_VSTAamount);

		// Increase user’s stake and total VSTA staked
		stakes[msg.sender] = newStake;
		totalVSTAStaked = totalVSTAStaked.add(_VSTAamount);
		emit TotalVSTAStakedUpdated(totalVSTAStaked);

		// Transfer VSTA from caller to this contract
		vstaToken.transferFrom(msg.sender, address(this), _VSTAamount);

		emit StakeChanged(msg.sender, newStake);
	}

	// Unstake the VSTA and send the it back to the caller, along with their accumulated VST & ETH gains.
	// If requested amount > stake, send their entire stake.
	function unstake(uint256 _VSTAamount) external override nonReentrant {
		uint256 currentStake = stakes[msg.sender];
		_requireUserHasStake(currentStake);

		uint256 assetLength = ASSET_TYPE.length;
		uint256 AssetGain;
		address asset;

		for (uint256 i = 0; i < assetLength; i++) {
			asset = ASSET_TYPE[i];

			// Grab any accumulated ETH and VST gains from the current stake
			AssetGain = _getPendingAssetGain(asset, msg.sender);

			if (i == 0) {
				uint256 VSTGain = _getPendingVSTGain(msg.sender);
				vstToken.transfer(msg.sender, VSTGain);
				emit StakingGainsVSTWithdrawn(msg.sender, VSTGain);
			}

			_updateUserSnapshots(asset, msg.sender);
			emit StakingGainsAssetWithdrawn(msg.sender, asset, AssetGain);

			_sendAssetGainToUser(asset, AssetGain);
		}

		if (_VSTAamount > 0) {
			uint256 VSTAToWithdraw = VestaMath._min(_VSTAamount, currentStake);

			uint256 newStake = currentStake.sub(VSTAToWithdraw);

			// Decrease user's stake and total VSTA staked
			stakes[msg.sender] = newStake;
			totalVSTAStaked = totalVSTAStaked.sub(VSTAToWithdraw);
			emit TotalVSTAStakedUpdated(totalVSTAStaked);

			// Transfer unstaked VSTA to user
			vstaToken.transfer(msg.sender, VSTAToWithdraw);

			emit StakeChanged(msg.sender, newStake);
		}
	}

	function pause() public onlyOwner {
		_pause();
	}

	function unpause() public onlyOwner {
		_unpause();
	}

	function changeTreasuryAddress(address _treasury) public onlyOwner {
		treasury = _treasury;
		emit TreasuryAddressChanged(_treasury);
	}

	// --- Reward-per-unit-staked increase functions. Called by Vesta core contracts ---

	function increaseF_Asset(address _asset, uint256 _AssetFee)
		external
		override
		callerIsTroveManager
	{
		if (paused()) {
			sendToTreasury(_asset, _AssetFee);
			return;
		}

		if (!isAssetTracked[_asset]) {
			isAssetTracked[_asset] = true;
			ASSET_TYPE.push(_asset);
		}

		uint256 AssetFeePerVSTAStaked;

		if (totalVSTAStaked > 0) {
			AssetFeePerVSTAStaked = _AssetFee.mul(DECIMAL_PRECISION).div(totalVSTAStaked);
		}

		F_ASSETS[_asset] = F_ASSETS[_asset].add(AssetFeePerVSTAStaked);
		emit F_AssetUpdated(_asset, F_ASSETS[_asset]);
	}

	function increaseF_VST(uint256 _VSTFee) external override callerIsBorrowerOperations {
		if (paused()) {
			sendToTreasury(address(vstToken), _VSTFee);
			return;
		}

		uint256 VSTFeePerVSTAStaked;

		if (totalVSTAStaked > 0) {
			VSTFeePerVSTAStaked = _VSTFee.mul(DECIMAL_PRECISION).div(totalVSTAStaked);
		}

		F_VST = F_VST.add(VSTFeePerVSTAStaked);
		emit F_VSTUpdated(F_VST);
	}

	function sendToTreasury(address _asset, uint256 _amount) internal {
		_sendAsset(treasury, _asset, _amount);
		sentToTreasuryTracker[_asset] += _amount;

		emit SentToTreasury(_asset, _amount);
	}

	// --- Pending reward functions ---

	function getPendingAssetGain(address _asset, address _user)
		external
		view
		override
		returns (uint256)
	{
		return _getPendingAssetGain(_asset, _user);
	}

	function _getPendingAssetGain(address _asset, address _user)
		internal
		view
		returns (uint256)
	{
		uint256 F_ASSET_Snapshot = snapshots[_user].F_ASSET_Snapshot[_asset];
		uint256 AssetGain = stakes[_user].mul(F_ASSETS[_asset].sub(F_ASSET_Snapshot)).div(
			DECIMAL_PRECISION
		);
		return AssetGain;
	}

	function getPendingVSTGain(address _user) external view override returns (uint256) {
		return _getPendingVSTGain(_user);
	}

	function _getPendingVSTGain(address _user) internal view returns (uint256) {
		uint256 F_VST_Snapshot = snapshots[_user].F_VST_Snapshot;
		uint256 VSTGain = stakes[_user].mul(F_VST.sub(F_VST_Snapshot)).div(DECIMAL_PRECISION);
		return VSTGain;
	}

	// --- Internal helper functions ---

	function _updateUserSnapshots(address _asset, address _user) internal {
		snapshots[_user].F_ASSET_Snapshot[_asset] = F_ASSETS[_asset];
		snapshots[_user].F_VST_Snapshot = F_VST;
		emit StakerSnapshotsUpdated(_user, F_ASSETS[_asset], F_VST);
	}

	function _sendAssetGainToUser(address _asset, uint256 _assetGain) internal {
		_assetGain = SafetyTransfer.decimalsCorrection(_asset, _assetGain);
		_sendAsset(msg.sender, _asset, _assetGain);
		emit AssetSent(_asset, msg.sender, _assetGain);
	}

	function _sendAsset(
		address _sendTo,
		address _asset,
		uint256 _amount
	) internal {
		if (_asset == ETH_REF_ADDRESS) {
			(bool success, ) = _sendTo.call{ value: _amount }("");
			require(success, "VSTAStaking: Failed to send accumulated AssetGain");
		} else {
			IERC20Upgradeable(_asset).safeTransfer(_sendTo, _amount);
		}
	}

	// --- 'require' functions ---

	modifier callerIsTroveManager() {
		require(msg.sender == troveManagerAddress, "VSTAStaking: caller is not TroveM");
		_;
	}

	modifier callerIsBorrowerOperations() {
		require(msg.sender == borrowerOperationsAddress, "VSTAStaking: caller is not BorrowerOps");
		_;
	}

	modifier callerIsActivePool() {
		require(msg.sender == activePoolAddress, "VSTAStaking: caller is not ActivePool");
		_;
	}

	function _requireUserHasStake(uint256 currentStake) internal pure {
		require(currentStake > 0, "VSTAStaking: User must have a non-zero stake");
	}

	receive() external payable callerIsActivePool {}
}
