// SPDX-License-Identifier: MIT
pragma solidity 0.6.11;

import "./Interfaces/IRewarder.sol";
import "./Dependencies/BoringERC20.sol";
import "./Dependencies/BoringMath.sol";


// Based on:
// https://github.com/sushiswap/sushiswap/blob/master/contracts/mocks/RewarderMock.sol
contract SushiSwapOhmLqtyRewarder is IRewarder {
    using BoringMath for uint256;
    using BoringERC20 for IERC20;

    uint256 private immutable ohmRewardMultiplier;
    IERC20 private immutable ohmToken;
    uint256 private immutable lqtyRewardMultiplier;
    IERC20 private immutable lqtyToken;
    uint256 private constant REWARD_TOKEN_DIVISOR = 1e18;
    address private immutable MASTERCHEF_V2;

    constructor (
        uint256 _ohmRewardMultiplier,
        IERC20 _ohmToken,
        uint256 _lqtyRewardMultiplier,
        IERC20 _lqtyToken,
        address _MASTERCHEF_V2
    ) public {
        ohmRewardMultiplier = _ohmRewardMultiplier;
        ohmToken = _ohmToken;
        lqtyRewardMultiplier = _lqtyRewardMultiplier;
        lqtyToken = _lqtyToken;
        MASTERCHEF_V2 = _MASTERCHEF_V2;
    }

    function onSushiReward (uint256, address, address to, uint256 sushiAmount, uint256) onlyMCV2 override external {
        // OHM rewards
        uint256 ohmPendingReward = sushiAmount.mul(ohmRewardMultiplier) / REWARD_TOKEN_DIVISOR;
        uint256 ohmBal = ohmToken.balanceOf(address(this));
        uint256 ohmReward = ohmPendingReward > ohmBal ? ohmBal : ohmPendingReward;
        if (ohmReward > 0) {
            ohmToken.safeTransfer(to, ohmReward);
        }

        // LQTY rewards
        uint256 lqtyPendingReward = sushiAmount.mul(lqtyRewardMultiplier) / REWARD_TOKEN_DIVISOR;
        uint256 lqtyBal = lqtyToken.balanceOf(address(this));
        uint256 lqtyReward = lqtyPendingReward > lqtyBal ? lqtyBal : lqtyPendingReward;
        if (lqtyReward > 0) {
            lqtyToken.safeTransfer(to, lqtyReward);
        }
    }

    function pendingTokens(uint256, address, uint256 sushiAmount) override external view returns (IERC20[] memory rewardTokens, uint256[] memory rewardAmounts) {
        IERC20[] memory _rewardTokens = new IERC20[](2);
        _rewardTokens[0] = ohmToken;
        _rewardTokens[1] = lqtyToken;
        uint256[] memory _rewardAmounts = new uint256[](2);
        _rewardAmounts[0] = sushiAmount.mul(ohmRewardMultiplier) / REWARD_TOKEN_DIVISOR;
        _rewardAmounts[1] = sushiAmount.mul(lqtyRewardMultiplier) / REWARD_TOKEN_DIVISOR;
        return (_rewardTokens, _rewardAmounts);
    }

    modifier onlyMCV2 {
        require(
            msg.sender == MASTERCHEF_V2,
            "Only MCV2 can call this function."
        );
        _;
    }
}
