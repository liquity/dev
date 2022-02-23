// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

interface IVSTAStaking {
	// --- Events --

	event TreasuryAddressChanged(address _treausury);
	event SentToTreasury(address indexed _asset, uint256 _amount);
	event VSTATokenAddressSet(address _VSTATokenAddress);
	event VSTTokenAddressSet(address _vstTokenAddress);
	event TroveManagerAddressSet(address _troveManager);
	event BorrowerOperationsAddressSet(address _borrowerOperationsAddress);
	event ActivePoolAddressSet(address _activePoolAddress);

	event StakeChanged(address indexed staker, uint256 newStake);
	event StakingGainsAssetWithdrawn(
		address indexed staker,
		address indexed asset,
		uint256 AssetGain
	);
	event StakingGainsVSTWithdrawn(address indexed staker, uint256 VSTGain);
	event F_AssetUpdated(address indexed _asset, uint256 _F_ASSET);
	event F_VSTUpdated(uint256 _F_VST);
	event TotalVSTAStakedUpdated(uint256 _totalVSTAStaked);
	event AssetSent(address indexed _asset, address indexed _account, uint256 _amount);
	event StakerSnapshotsUpdated(address _staker, uint256 _F_Asset, uint256 _F_VST);

	function vstaToken() external view returns (IERC20Upgradeable);

	// --- Functions ---

	function setAddresses(
		address _VSTATokenAddress,
		address _vstTokenAddress,
		address _troveManagerAddress,
		address _borrowerOperationsAddress,
		address _activePoolAddress,
		address _treasury
	) external;

	function stake(uint256 _VSTAamount) external;

	function unstake(uint256 _VSTAamount) external;

	function increaseF_Asset(address _asset, uint256 _AssetFee) external;

	function increaseF_VST(uint256 _VSTAFee) external;

	function getPendingAssetGain(address _asset, address _user) external view returns (uint256);

	function getPendingVSTGain(address _user) external view returns (uint256);
}
