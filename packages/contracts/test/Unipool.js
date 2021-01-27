// original file: https://github.com/Synthetixio/Unipool/blob/master/test/Unipool.js

const { BN, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const Uni = artifacts.require('ERC20Mock');
const Lqty = artifacts.require('LQTYToken');
const Unipool = artifacts.require('Unipool');
const NonPayable = artifacts.require('NonPayable');

const _1e18 = new BN('10').pow(new BN('18'));

const almostEqualDiv1e18 = function (expectedOrig, actualOrig) {
  const expected = expectedOrig.div(_1e18);
  const actual = actualOrig.div(_1e18);
  this.assert(
    expected.eq(actual) ||
      expected.addn(1).eq(actual) || expected.addn(2).eq(actual) ||
      actual.addn(1).eq(expected) || actual.addn(2).eq(expected),
    'expected #{act} to be almost equal #{exp}',
    'expected #{act} to be different from #{exp}',
    expectedOrig.toString(),
    actualOrig.toString(),
  );
};

require('chai').use(function (chai, utils) {
  chai.Assertion.overwriteMethod('almostEqualDiv1e18', function (original) {
    return function (value) {
      if (utils.flag(this, 'bignumber')) {
        var expected = new BN(value);
        var actual = new BN(this._obj);
        almostEqualDiv1e18.apply(this, [expected, actual]);
      } else {
        original.apply(this, arguments);
      }
    };
  });
});

contract('Unipool', function ([_, wallet1, wallet2, wallet3, wallet4, bountyAddress, owner]) {
  describe('Unipool', async function () {
    beforeEach(async function () {
      this.uni = await Uni.new('Uniswap token', 'LPT', owner, 0);
      this.pool = await Unipool.new();

      const communityIssuance = await NonPayable.new();
      const lqtyStaking = await NonPayable.new();
      const lockupContractFactory = await NonPayable.new();
      this.lqty = await Lqty.new(
        communityIssuance.address,
        lqtyStaking.address,
        lockupContractFactory.address,
        bountyAddress,
        this.pool.address
      );
      this.started = await this.lqty.getDeploymentStartTime();
      this.lpRewardsEntitlement = await this.lqty.getLpRewardsEntitlement();
      this.DURATION = await this.pool.DURATION();
      this.rewardRate = this.lpRewardsEntitlement.div(this.DURATION);

      await this.pool.setAddresses(this.lqty.address, this.uni.address);

      await this.uni.mint(wallet1, web3.utils.toWei('1000'));
      await this.uni.mint(wallet2, web3.utils.toWei('1000'));
      await this.uni.mint(wallet3, web3.utils.toWei('1000'));
      await this.uni.mint(wallet4, web3.utils.toWei('1000'));

      await this.uni.approve(this.pool.address, new BN(2).pow(new BN(255)), { from: wallet1 });
      await this.uni.approve(this.pool.address, new BN(2).pow(new BN(255)), { from: wallet2 });
      await this.uni.approve(this.pool.address, new BN(2).pow(new BN(255)), { from: wallet3 });
      await this.uni.approve(this.pool.address, new BN(2).pow(new BN(255)), { from: wallet4 });
    });

    it('Two stakers with the same stakes wait DURATION', async function () {
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18('0');
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

      const stake1 = new BN(web3.utils.toWei('1'));
      await this.pool.stake(stake1, { from: wallet1 });
      const stakeTime1 = await time.latest();
      // time goes by... so slowly

      const stake2 = new BN(web3.utils.toWei('1'));
      await this.pool.stake(stake2, { from: wallet2 });
      const stakeTime2 = await time.latest();

      await time.increaseTo(stakeTime1.add(this.DURATION));

      const timeDiff = stakeTime2.sub(stakeTime1);
      const rewardPerToken = this.rewardRate.mul(timeDiff).mul(_1e18).div(stake1).add(this.rewardRate.mul(this.DURATION.sub(timeDiff)).mul(_1e18).div(stake1.add(stake2)));
      const halfEntitlement = this.lpRewardsEntitlement.div(new BN(2));
      const earnedDiff = halfEntitlement.mul(timeDiff).div(this.DURATION);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken);
      expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(halfEntitlement.add(earnedDiff));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(halfEntitlement.sub(earnedDiff));
    });

    it('Two stakers with the different (1:3) stakes wait DURATION', async function () {
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18('0');
      expect(await this.pool.balanceOf(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.balanceOf(wallet2)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

      const stake1 = new BN(web3.utils.toWei('1'));
      await this.pool.stake(stake1, { from: wallet1 });
      const stakeTime1 = await time.latest();

      const stake2 = new BN(web3.utils.toWei('3'));
      await this.pool.stake(stake2, { from: wallet2 });
      const stakeTime2 = await time.latest();

      await time.increaseTo(stakeTime1.add(this.DURATION));

      const timeDiff = stakeTime2.sub(stakeTime1);
      const rewardPerToken1 = this.rewardRate.mul(timeDiff).mul(_1e18).div(stake1);
      const rewardPerToken2 = this.rewardRate.mul(this.DURATION.sub(timeDiff)).mul(_1e18).div(stake1.add(stake2));
      const rewardPerToken = rewardPerToken1.add(rewardPerToken2);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken);
      expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).mul(stake1).div(_1e18));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.mul(stake2).div(_1e18));
    });

    it('Two stakers with the different (1:3) stakes wait DURATION and DURATION/2', async function () {
      //
      // 1x: +--------------+
      // 3x:      +---------+
      //

      const stake1 = new BN(web3.utils.toWei('1'));
      await this.pool.stake(stake1, { from: wallet1 });
      const stakeTime1 = await time.latest();

      await time.increaseTo(stakeTime1.add(this.DURATION.div(new BN(3))));

      const stake2 = new BN(web3.utils.toWei('3'));
      await this.pool.stake(stake2, { from: wallet2 });
      const stakeTime2 = await time.latest();

      const timeDiff = stakeTime2.sub(stakeTime1);
      const rewardPerToken1 = this.rewardRate.mul(timeDiff).mul(_1e18).div(stake1);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1);
      expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.mul(stake1).div(_1e18));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

      // Forward to week 3 and notifyReward weekly
      await time.increase(this.DURATION.mul(new BN(2)).div(new BN(3)));

      const rewardPerToken2 = this.rewardRate.mul(this.DURATION.sub(timeDiff)).mul(_1e18).div(stake1.add(stake2));
      const rewardPerToken = rewardPerToken1.add(rewardPerToken2);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken);
      expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).mul(stake1).div(_1e18));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.mul(stake2).div(_1e18));
    });

    it('Three stakers with the different (1:3:5) stakes wait different durations', async function () {
      //
      // 1x: +----------------+--------+
      // 3x:  +---------------+
      // 5x:         +-----------------+
      //

      const stake1 = new BN(web3.utils.toWei('1'));
      await this.pool.stake(stake1, { from: wallet1 });
      const stakeTime1 = await time.latest();


      const stake2 = new BN(web3.utils.toWei('3'));
      await this.pool.stake(stake2, { from: wallet2 });
      const stakeTime2 = await time.latest();

      await time.increaseTo(this.started.add(this.DURATION.div(new BN(3))));

      const stake3 = new BN(web3.utils.toWei('5'));
      await this.pool.stake(stake3, { from: wallet3 });
      const stakeTime3 = await time.latest();

      const timeDiff1 = stakeTime2.sub(stakeTime1);
      const timeDiff2 = stakeTime3.sub(stakeTime2);
      const rewardPerToken1 = this.rewardRate.mul(timeDiff1).mul(_1e18).div(stake1);
      const rewardPerToken2 = this.rewardRate.mul(timeDiff2).mul(_1e18).div(stake1.add(stake2));
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).mul(stake1).div(_1e18));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.mul(stake2).div(_1e18));

      await time.increaseTo(stakeTime1.add(this.DURATION.mul(new BN(2)).div(new BN(3))));

      await this.pool.exit({ from: wallet2 });
      const exitTime2 = await time.latest();

      const timeDiff3 = exitTime2.sub(stakeTime3);
      const rewardPerToken3 = this.rewardRate.mul(timeDiff3).mul(_1e18).div(stake1.add(stake2).add(stake3));
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3).mul(stake1).div(_1e18));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');
      expect(await this.lqty.balanceOf(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.add(rewardPerToken3).mul(stake2).div(_1e18));
      expect(await this.pool.earned(wallet3)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken3.mul(stake3).div(_1e18));

      await time.increaseTo(stakeTime1.add(this.DURATION));

      const timeDiff4 = this.DURATION.sub(exitTime2.sub(stakeTime1));
      const rewardPerToken4 = this.rewardRate.mul(timeDiff4).mul(_1e18).div(stake1.add(stake3));
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3).add(rewardPerToken4));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3).add(rewardPerToken4).mul(stake1).div(_1e18));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet3)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken3.add(rewardPerToken4).mul(stake3).div(_1e18));
    });

    it('Three stakers with gaps of zero total supply', async function () {
      //
      // 1x: +-------+               |
      // 3x:  +----------+           |
      // 5x:                +------+ |
      // 1x:                         |  +------...
      //                             +-> end of initial duration

      const stake1 = new BN(web3.utils.toWei('1'));
      await this.pool.stake(stake1, { from: wallet1 });
      const stakeTime1 = await time.latest();

      const stake2 = new BN(web3.utils.toWei('3'));
      await this.pool.stake(stake2, { from: wallet2 });
      const stakeTime2 = await time.latest();

      await time.increase(this.DURATION.div(new BN(6)));

      await this.pool.exit({ from: wallet1 });
      const exitTime1 = await time.latest();

      const timeDiff1 = stakeTime2.sub(stakeTime1);
      const timeDiff2 = exitTime1.sub(stakeTime2);
      const rewardPerToken1 = this.rewardRate.mul(timeDiff1).mul(_1e18).div(stake1);
      const rewardPerToken2 = this.rewardRate.mul(timeDiff2).mul(_1e18).div(stake1.add(stake2));
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.lqty.balanceOf(wallet1)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).mul(stake1).div(_1e18));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.mul(stake2).div(_1e18));

      await time.increase(this.DURATION.div(new BN(6)));

      await this.pool.exit({ from: wallet2 });
      const exitTime2 = await time.latest();

      const timeDiff3 = exitTime2.sub(exitTime1);
      const rewardPerToken3 = this.rewardRate.mul(timeDiff3).mul(_1e18).div(stake2);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');
      expect(await this.lqty.balanceOf(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.add(rewardPerToken3).mul(stake2).div(_1e18));

      await time.increase(this.DURATION.div(new BN(6)));

      const stake3 = new BN(web3.utils.toWei('5'));
      await this.pool.stake(stake3, { from: wallet3 });
      const stakeTime3 = await time.latest();

      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet3)).to.be.bignumber.equal('0');

      await time.increase(this.DURATION.div(new BN(6)));

      await this.pool.exit({ from: wallet3 });
      const exitTime3 = await time.latest();

      const timeDiff4 = exitTime3.sub(stakeTime3);
      const rewardPerToken4 = this.rewardRate.mul(timeDiff4).mul(_1e18).div(stake3);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3).add(rewardPerToken4));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet3)).to.be.bignumber.equal('0');
      expect(await this.lqty.balanceOf(wallet3)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken4.mul(stake3).div(_1e18));

      await time.increase(this.DURATION.div(new BN(2)));

      // check that we have reached initial duration
      expect(await time.latest()).to.be.bignumber.gte(stakeTime1.add(this.DURATION));

      const stake4 = new BN(web3.utils.toWei('1'));
      await this.pool.stake(stake4, { from: wallet4 });
      const stakeTime4 = await time.latest();

      await time.increase(this.DURATION.div(new BN(2)));

      const timeDiff5 = this.DURATION.sub(exitTime2.sub(stakeTime1).add(timeDiff4));
      const rewardPerToken5 = this.rewardRate.mul(timeDiff5).mul(_1e18).div(stake4);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3).add(rewardPerToken4).add(rewardPerToken5));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet3)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet4)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken5.mul(stake4).div(_1e18));
    });
  });

  describe('Unipool, before calling setAddresses', async function () {
    beforeEach(async function () {
      this.uni = await Uni.new('Uniswap token', 'LPT', owner, 0);
      this.pool = await Unipool.new();

      const communityIssuance = await NonPayable.new();
      const lqtyStaking = await NonPayable.new();
      const lockupContractFactory = await NonPayable.new();
      this.lqty = await Lqty.new(
        communityIssuance.address,
        lqtyStaking.address,
        lockupContractFactory.address,
        bountyAddress,
        this.uni.address
      );
      this.lpRewardsEntitlement = await this.lqty.getLpRewardsEntitlement();

      //await this.pool.setAddresses(this.lqty.address, this.uni.address);

      await this.uni.mint(wallet1, web3.utils.toWei('1000'));
      await this.uni.mint(wallet2, web3.utils.toWei('1000'));
      await this.uni.mint(wallet3, web3.utils.toWei('1000'));
      await this.uni.mint(wallet4, web3.utils.toWei('1000'));

      await this.uni.approve(this.pool.address, new BN(2).pow(new BN(255)), { from: wallet1 });
      await this.uni.approve(this.pool.address, new BN(2).pow(new BN(255)), { from: wallet2 });
      await this.uni.approve(this.pool.address, new BN(2).pow(new BN(255)), { from: wallet3 });
      await this.uni.approve(this.pool.address, new BN(2).pow(new BN(255)), { from: wallet4 });

      this.started = (await time.latest()).addn(10);
      await time.increaseTo(this.started);
    });

    // TODO

  });
});
