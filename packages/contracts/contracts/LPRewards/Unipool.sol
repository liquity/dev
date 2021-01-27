// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/LiquityMath.sol";
import "../Dependencies/SafeMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/CheckContract.sol";
import "../Interfaces/ILQTYToken.sol";
import "./Dependencies/SafeERC20.sol";
import "./Interfaces/ILPTokenWrapper.sol";
import "./Interfaces/IUnipool.sol";


// Adapted from: https://github.com/Synthetixio/Unipool/blob/master/contracts/Unipool.sol
contract LPTokenWrapper is ILPTokenWrapper {
    using SafeMath for uint256;
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
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        uniToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) public virtual override {
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        uniToken.safeTransfer(msg.sender, amount);
    }
}

contract Unipool is LPTokenWrapper, Ownable, CheckContract, IUnipool {
    uint256 public constant DURATION = 7 days;
    ILQTYToken lqtyToken;

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event LQTYTokenAddressChanged(address _lqtyTokenAddress);
    event UniTokenAddressChanged(address _uniTokenAddress);
    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    function setAddresses(
        address _lqtyTokenAddress,
        address _uniTokenAddress
    )
        external
        override
        onlyOwner
    {
        checkContract(_lqtyTokenAddress);
        checkContract(_uniTokenAddress);

        uniToken = IERC20(_uniTokenAddress);
        lqtyToken = ILQTYToken(_lqtyTokenAddress);

        _notifyRewardAmount(lqtyToken.getLpRewardsEntitlement());

        emit LQTYTokenAddressChanged(_lqtyTokenAddress);
        emit UniTokenAddressChanged(_uniTokenAddress);

        _renounceOwnership();
    }

    function lastTimeRewardApplicable() public view override returns (uint256) {
        return LiquityMath._min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view override returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable()
                    .sub(lastUpdateTime)
                    .mul(rewardRate)
                    .mul(1e18)
                    .div(totalSupply())
            );
    }

    function earned(address account) public view override returns (uint256) {
        return
            balanceOf(account)
                .mul(rewardPerToken().sub(userRewardPerTokenPaid[account]))
                .div(1e18)
                .add(rewards[account]);
    }

    // stake visibility is public as overriding LPTokenWrapper's stake() function
    function stake(uint256 amount) public override {
        require(amount > 0, "Cannot stake 0");

        _updateReward(msg.sender);

        super.stake(amount);

        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public override {
        require(amount > 0, "Cannot withdraw 0");

        _updateReward(msg.sender);

        super.withdraw(amount);

        emit Withdrawn(msg.sender, amount);
    }

    function exit() external override {
        withdraw(balanceOf(msg.sender));
        claimReward();
    }

    function claimReward() public override {
        _updateReward(msg.sender);

        uint256 reward = earned(msg.sender);
        if (reward > 0) {
            rewards[msg.sender] = 0;
            lqtyToken.transfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function _notifyRewardAmount(uint256 reward) internal {
        assert(reward > 0);
        assert(reward == lqtyToken.balanceOf(address(this)));
        assert(periodFinish == 0);

        _updateReward(address(0));

        rewardRate = reward.div(DURATION);

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(DURATION);
        emit RewardAdded(reward);
    }

    function _requireCallerIsLQTYToken() internal view {
        require(msg.sender == address(lqtyToken), "Unipool: Caller must be the LQTY token");
    }

    function _updateReward(address account) internal {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
    }
}
