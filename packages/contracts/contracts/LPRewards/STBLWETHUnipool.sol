// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Dependencies/StabilioMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/CheckContract.sol";
import "../Interfaces/ISTBLToken.sol";
import "./Dependencies/SafeERC20.sol";
import "./Interfaces/ILPTokenWrapper.sol";
import "./Interfaces/IUnipool.sol";
import "../Dependencies/console.sol";


// Adapted from: https://github.com/Synthetixio/Unipool/blob/master/contracts/Unipool.sol
// Some more useful references:
// Synthetix proposal: https://sips.synthetix.io/sips/sip-31
// Original audit: https://github.com/sigp/public-audits/blob/master/synthetix/unipool/review.pdf
// Incremental changes (commit by commit) from the original to this version: https://github.com/stabiliofi/dev/pull/271

// LPTokenWrapper contains the basic staking functionality
contract LPTokenWrapper is ILPTokenWrapper {
    using SafeERC20 for IERC20;

    IERC20 public uniToken;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    function stake(uint256 amount) public virtual override {
        _totalSupply += amount;
        _balances[msg.sender] += amount;
        uniToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) public virtual override {
        _totalSupply -= amount;
        _balances[msg.sender] -= amount;
        uniToken.safeTransfer(msg.sender, amount);
    }
}

/*
 * On deployment a new Uniswap pool will be created for the pair XBRL/ETH and its token will be set here.

 * Essentially the way it works is:

 * - Liquidity providers add funds to the Uniswap pool, and get UNIv2 LP tokens in exchange
 * - Liquidity providers stake those UNIv2 LP tokens into Unipool rewards contract
 * - Liquidity providers accrue rewards, proportional to the amount of staked tokens and staking time
 * - Liquidity providers can claim their rewards when they want
 * - Liquidity providers can unstake UNIv2 LP tokens to exit the program (i.e., stop earning rewards) when they want

 * Funds for rewards will only be added once, on deployment of STBL token,
 * which will happen after this contract is deployed and before this `setParams` in this contract is called.

 * If at some point the total amount of staked tokens is zero, the clock will be “stopped”,
 * so the period will be extended by the time during which the staking pool is empty,
 * in order to avoid getting STBL tokens locked.
 * That also means that the start time for the program will be the event that occurs first:
 * either STBL token contract is deployed, and therefore STBL tokens are minted to Unipool contract,
 * or first liquidity provider stakes UNIv2 LP tokens into it.
 */
contract STBLWETHUnipool is LPTokenWrapper, Ownable, CheckContract, IUnipool {
    string constant public NAME = "STBLWETHUnipool";

    uint256 public duration;
    ISTBLToken public stblToken;

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event STBLTokenAddressChanged(address _stblTokenAddress);
    event UniTokenAddressChanged(address _uniTokenAddress);
    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    // initialization function
    function setParams(
        address _stblTokenAddress,
        address _uniTokenAddress,
        uint256 _duration
    )
        external
        override
        onlyOwner
    {
        checkContract(_stblTokenAddress);
        checkContract(_uniTokenAddress);

        uniToken = IERC20(_uniTokenAddress);
        stblToken = ISTBLToken(_stblTokenAddress);
        duration = _duration;

        _notifyRewardAmount(stblToken.getStblWethLpRewardsEntitlement(), _duration);

        emit STBLTokenAddressChanged(_stblTokenAddress);
        emit UniTokenAddressChanged(_uniTokenAddress);

        _renounceOwnership();
    }

    // Returns current timestamp if the rewards program has not finished yet, end time otherwise
    function lastTimeRewardApplicable() public view override returns (uint256) {
        return StabilioMath._min(block.timestamp, periodFinish);
    }

    // Returns the amount of rewards that correspond to each staked token
    function rewardPerToken() public view override returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored +
            (((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate) * 1e18 / totalSupply());
    }

    // Returns the amount that an account can claim
    function earned(address account) public view override returns (uint256) {
        return
            ((balanceOf(account) * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18)
            + rewards[account];
    }

    // stake visibility is public as overriding LPTokenWrapper's stake() function
    function stake(uint256 amount) public override {
        require(amount > 0, "Cannot stake 0");
        require(address(uniToken) != address(0), "Liquidity Pool Token has not been set yet");

        _updatePeriodFinish();
        _updateAccountReward(msg.sender);

        super.stake(amount);

        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public override {
        require(amount > 0, "Cannot withdraw 0");
        require(address(uniToken) != address(0), "Liquidity Pool Token has not been set yet");

        _updateAccountReward(msg.sender);

        super.withdraw(amount);

        emit Withdrawn(msg.sender, amount);
    }

    // Shortcut to be able to unstake tokens and claim rewards in one transaction
    function withdrawAndClaim() external override {
        withdraw(balanceOf(msg.sender));
        claimReward();
    }

    function claimReward() public override {
        require(address(uniToken) != address(0), "Liquidity Pool Token has not been set yet");

        _updatePeriodFinish();
        _updateAccountReward(msg.sender);

        uint256 reward = earned(msg.sender);

        require(reward > 0, "Nothing to claim");

        rewards[msg.sender] = 0;
        stblToken.transfer(msg.sender, reward);
        emit RewardPaid(msg.sender, reward);
    }

    // Used only on initialization, sets the reward rate and the end time for the program
    function _notifyRewardAmount(uint256 _reward, uint256 _duration) internal {
        assert(_reward > 0);
        assert(_reward == stblToken.balanceOf(address(this)));
        assert(periodFinish == 0);

        _updateReward();

        rewardRate = _reward / _duration;

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + _duration;
        emit RewardAdded(_reward);
    }

    // Adjusts end time for the program after periods of zero total supply
    function _updatePeriodFinish() internal {
        if (totalSupply() == 0) {
            assert(periodFinish > 0);
            /*
             * If the finish period has been reached (but there are remaining rewards due to zero stake),
             * to get the new finish date we must add to the current timestamp the difference between
             * the original finish time and the last update, i.e.:
             *
             * periodFinish = block.timestamp + periodFinish - lastUpdateTime;
             *
             * If we have not reached the end yet, we must extend it by adding to it the difference between
             * the current timestamp and the last update (the period where the supply has been empty), i.e.:
             *
             * periodFinish = periodFinish + block.timestamp - lastUpdateTime;
             *
             * Both formulas are equivalent.
             */
            periodFinish = periodFinish + block.timestamp - lastUpdateTime;
        }
    }

    function _updateReward() internal {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
    }

    function _updateAccountReward(address account) internal {
        _updateReward();

        assert(account != address(0));

        rewards[account] = earned(account);
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
    }
}
