const testHelpers = require("../utils/testHelpers.js")

const MasterChefV2 = artifacts.require('MasterChefV2Mock')
const SushiSwapOhmLqtyRewarder = artifacts.require('SushiSwapOhmLqtyRewarder')
const ERC20 = artifacts.require('ERC20Mock')

const th = testHelpers.TestHelper
const { toBN, assertRevert, dec, ZERO_ADDRESS } = testHelpers.TestHelper

const OHM_MULTIPLIER = toBN(dec(1, 16))
const LQTY_MULTIPLIER = toBN(dec(1, 19))
const MASTERCHEF_SUSHI_PER_BLOCK = toBN(dec(1, 20))

contract('SushiSwapOhmLqtyRewarder', async accounts => {
  const [owner, alice, bob, carol, dennis] = accounts

  let rewarder, masterChef
  let lpToken, ohmToken, lqtyToken

  beforeEach(async () => {
    const initialAmount = dec(1, 24) // 1m

    lpToken = await ERC20.new('LP Token', 'LPT', owner, 0)
    ohmToken = await ERC20.new('OHM Token', 'OHM', owner, initialAmount)
    lqtyToken = await ERC20.new('LQTY Token', 'LQTY', owner, initialAmount)

    masterChef = await MasterChefV2.new()
    rewarder = await SushiSwapOhmLqtyRewarder.new(
      OHM_MULTIPLIER,
      ohmToken.address,
      LQTY_MULTIPLIER,
      lqtyToken.address,
      masterChef.address
    )
    await masterChef.init(lpToken.address, rewarder.address)

    // mint some LP tokens
    await lpToken.mint(alice, initialAmount)
    await lpToken.mint(bob, initialAmount)
    await lpToken.mint(carol, initialAmount)
    await lpToken.mint(dennis, initialAmount)
  })

  const blocksToSushi = blocks => toBN(blocks).mul(MASTERCHEF_SUSHI_PER_BLOCK)
  const sushiToOhm = sushiRewards => sushiRewards.mul(OHM_MULTIPLIER).div(toBN(dec(1, 18)))
  const sushiToLqty = sushiRewards => sushiRewards.mul(LQTY_MULTIPLIER).div(toBN(dec(1, 18)))
  const blocksToRewards = blocks => {
    const sushi = blocksToSushi(blocks)
    return [sushiToOhm(sushi), sushiToLqty(sushi)]
  }
  const rewardsToUser = (rewards, multiplier) => rewards.map(multiplier)

  const deposit = async (user, amount) => {
    await lpToken.approve(masterChef.address, amount, { from: user })
    await masterChef.deposit(0, amount, user, { from: user })
  }

  const checkRewards = async (blocks) => {
    const sushiRewards = await masterChef.pendingSushi(alice)
    const pendingRewards = await rewarder.pendingTokens(0, ZERO_ADDRESS, sushiRewards)
    assert.equal(sushiRewards.toString(), blocksToSushi(blocks))
    assert.equal(pendingRewards.rewardTokens[0], ohmToken.address)
    assert.equal(pendingRewards.rewardTokens[1], lqtyToken.address)
    assert.equal(pendingRewards.rewardAmounts[0].toString(), sushiToOhm(sushiRewards))
    assert.equal(pendingRewards.rewardAmounts[1].toString(), sushiToLqty(sushiRewards))
  }

  const checkBalances = async (user, ohmBalance, lqtyBalance, error = 0) => {
    th.assertIsApproximatelyEqual(await ohmToken.balanceOf(user), toBN(ohmBalance), error)
    th.assertIsApproximatelyEqual(
      await lqtyToken.balanceOf(user),
      toBN(lqtyBalance),
      error * LQTY_MULTIPLIER.div(OHM_MULTIPLIER).toNumber()
    )
  }

  const logPoolInfo = async () => {
    const poolInfo = await masterChef.poolInfo()
    th.logBN('Acc. sushi per share', poolInfo.accSushiPerShare.mul(toBN(dec(1, 6))))
    console.log('last reward block   :', poolInfo.lastRewardBlock.toString())
  }

  const logUserInfo = async (user) => {
    const userInfo = await masterChef.userInfo(user)
    th.logBN('amount    ', userInfo.amount)
    th.logBN('rewardDebt', userInfo.rewardDebt)
  }

  context('On MasterChef with funds', async () => {
    beforeEach(async () => {
      const initialAmount = dec(1, 24) // 1m
      // fund rewarder
      await ohmToken.transfer(rewarder.address, initialAmount, { from: owner })
      await lqtyToken.transfer(rewarder.address, initialAmount, { from: owner })
    })

    it('Alice deposits once and harvest', async () => {
      const amount = toBN(dec(10, 18))
      const blocks = 5

      await checkRewards(0)

      await deposit(alice, amount)

      await checkRewards(0)

      await th.fastForwardBlocks(blocks, web3.currentProvider)

      await checkRewards(blocks)

      // harvest
      await checkBalances(alice, 0, 0)
      await masterChef.harvest(0, alice, { from: alice })
      await checkBalances(alice, ...blocksToRewards(blocks + 1))
    })

    // This actually belongs to MasterChefV2, as the rewarder ignores the user, it only uses the recipient
    it('Alice deposits, Bob can’t harvest for her', async () => {
      const amount = toBN(dec(10, 18))
      const blocks = 5

      await checkRewards(0)

      await deposit(alice, amount)

      await checkRewards(0)

      await th.fastForwardBlocks(blocks, web3.currentProvider)

      await checkRewards(blocks)

      // harvest
      await checkBalances(alice, 0, 0)
      await masterChef.harvest(0, alice, { from: bob })
      await checkBalances(alice, 0, 0)
      await checkBalances(bob, 0, 0)
      await masterChef.harvest(0, bob, { from: bob })
      await checkBalances(alice, 0, 0)
      await checkBalances(bob, 0, 0)
    })

    it('Alice deposits twice', async () => {
      const amount = toBN(dec(10, 18))
      const blocks = 5

      await checkRewards(0)

      // deposit
      await lpToken.approve(masterChef.address, amount, { from: alice })
      const blockBeforeDeposit = await web3.eth.getBlockNumber()
      await masterChef.deposit(0, amount, alice, { from: alice })
      // await logUserInfo(alice)
      // await logPoolInfo()

      await th.fastForwardBlocks(blocks, web3.currentProvider)

      await checkRewards(blocks)

      // deposit
      await deposit(alice, amount)
      // await logUserInfo(alice)
      // await logPoolInfo()

      await checkRewards(blocks + 2)

      // harvest
      await checkBalances(alice, 0, 0)
      const blockBeforeHarvest = await web3.eth.getBlockNumber()
      await masterChef.harvest(0, alice, { from: alice })
      await checkBalances(alice, ...blocksToRewards(blockBeforeHarvest - blockBeforeDeposit))
      // await logUserInfo(alice)
      // await logPoolInfo()
    })

    it('Alice deposits once, withdraws and harvest', async () => {
      const amount = toBN(dec(10, 18))
      const blocks = 5

      await checkRewards(0)

      // deposit
      await lpToken.approve(masterChef.address, amount, { from: alice })
      const blockBeforeDeposit = await web3.eth.getBlockNumber()
      await masterChef.deposit(0, amount, alice, { from: alice })
      // await logUserInfo(alice)
      // await logPoolInfo()

      await checkRewards(0)

      await th.fastForwardBlocks(blocks, web3.currentProvider)

      await checkRewards(blocks)

      // withdraw
      const blockBeforeWithdraw = await web3.eth.getBlockNumber()
      await masterChef.withdraw(0, amount, alice, { from: alice })
      await checkBalances(alice, 0, 0)
      // await logUserInfo(alice)
      // await logPoolInfo()

      // harvest
      await masterChef.harvest(0, alice, { from: alice })
      await checkBalances(alice, ...blocksToRewards(blockBeforeWithdraw - blockBeforeDeposit))
      // await logUserInfo(alice)
      // await logPoolInfo()
    })

    it('Alice deposits once, then withdraws and harvest in 1 tx', async () => {
      const amount = toBN(dec(10, 18))
      const blocks = 5

      await checkRewards(0)

      await lpToken.approve(masterChef.address, amount, { from: alice })
      const blockBeforeDeposit = await web3.eth.getBlockNumber()
      await masterChef.deposit(0, amount, alice, { from: alice })
      // await logUserInfo(alice)
      // await logPoolInfo()

      await checkRewards(0)

      await th.fastForwardBlocks(blocks, web3.currentProvider)

      await checkRewards(blocks)

      // withdraw & harvest
      await checkBalances(alice, 0, 0)
      const blockBeforeWithdraw = await web3.eth.getBlockNumber()
      await masterChef.withdrawAndHarvest(0, amount, alice, { from: alice })
      await checkBalances(alice, ...blocksToRewards(blockBeforeWithdraw - blockBeforeDeposit))
      // await logUserInfo(alice)
      // await logPoolInfo()
    })

    it('Alice deposits once, withdraws and harvest to Bob', async () => {
      const amount = toBN(dec(10, 18))
      const blocks = 5

      await checkRewards(0)

      await lpToken.approve(masterChef.address, amount, { from: alice })
      const blockBeforeDeposit = await web3.eth.getBlockNumber()
      await masterChef.deposit(0, amount, alice, { from: alice })

      await checkRewards(0)

      await th.fastForwardBlocks(blocks, web3.currentProvider)

      await checkRewards(blocks)

      // withdraw
      const blockBeforeWithdraw = await web3.eth.getBlockNumber()
      await masterChef.withdraw(0, amount, alice, { from: alice })
      await checkBalances(alice, 0, 0)

      // harvest
      await masterChef.harvest(0, bob, { from: alice })
      await checkBalances(alice, 0, 0)
      await checkBalances(bob, ...blocksToRewards(blockBeforeWithdraw - blockBeforeDeposit))
    })

    /*
      | Action  | A d | B d | A w | C d | B w&h | A h | C h | D d | D h | A w | D w | A h | D h |
      | Blocks  |  14 |   4 |   2 |   2 |     4 |   1 |   2 |   3 |   4 |   5 |   6 |   1 |   1 |
      | Balance |  10 | 210 | 206 | 256 |    56 |  56 |  56 | 156 | 156 | 150 |  50 |  50 |  50 |
     */
    it('several users, mixed deposits and withdrawals', async () => {
      const periods = [14, 4, 2, 2, 4, 1, 2, 3, 4, 5, 6, 1, 1]
      const totals = [10, 210, 206, 256, 56, 56, 56, 156, 156, 150, 50, 50, 50]
      const multiplier = (balances) =>
            x => {
              const combinedArray = balances.map((bal, i) => [periods[i], totals[i], bal])
              const totalTime = toBN(combinedArray.reduce((total, next) => total + next[0], 0))
              return combinedArray.reduce(
                (total, next) => total.add(x.mul(toBN(next[0])).mul(toBN(next[2])).div(totalTime).div(toBN(next[1]))),
                toBN(0)
              )
            }

      // alice deposits
      const initialBlock = await web3.eth.getBlockNumber() + 2 // approve and deposit tx blocks
      await deposit(alice, toBN(dec(10, 18)))
      await checkBalances(alice, 0, 0)
      await th.fastForwardBlocks(12, web3.currentProvider)

      // bob deposits
      await deposit(bob, toBN(dec(200, 18)))
      await checkBalances(bob, 0, 0)
      await th.fastForwardBlocks(3, web3.currentProvider)

      // alice partially withdraws
      await masterChef.withdraw(0, toBN(dec(4, 18)), alice, { from: alice })
      await checkBalances(alice, 0, 0)

      // carol deposits
      await deposit(carol, toBN(dec(50, 18)))
      await checkBalances(carol, 0, 0)
      await th.fastForwardBlocks(1, web3.currentProvider)

      // bob withdraws and harvests
      const block1 = await web3.eth.getBlockNumber()
      await masterChef.withdrawAndHarvest(0, toBN(dec(200, 18)), bob, { from: bob })
      await checkBalances(
        bob,
        ...rewardsToUser(
          blocksToRewards(await web3.eth.getBlockNumber()  - initialBlock),
          multiplier([0, 200, 200, 200])
        ),
        1e8 // error
      )
      await th.fastForwardBlocks(3, web3.currentProvider)

      // alice and carol harvest
      await masterChef.harvest(0, alice, { from: alice })
      await checkBalances(
        alice,
        ...rewardsToUser(
          blocksToRewards(await web3.eth.getBlockNumber() - initialBlock),
          multiplier([10, 10, 6, 6, 6])
        ),
        1e8 // error
      )

      await masterChef.harvest(0, carol, { from: carol })
      await checkBalances(
        carol,
        ...rewardsToUser(
          blocksToRewards(await web3.eth.getBlockNumber() - initialBlock),
          multiplier([0, 0, 0, 50, 50, 50])
        ),
        1e8 // error
      )

      // dennis deposits
      await deposit(dennis, toBN(dec(100, 18)))
      await th.fastForwardBlocks(2, web3.currentProvider)

      // dennis harvests
      await masterChef.harvest(0, dennis, { from: dennis })
      await checkBalances(
        dennis,
        ...rewardsToUser(
          blocksToRewards(await web3.eth.getBlockNumber() - initialBlock),
          multiplier([0, 0, 0, 0, 0, 0, 0, 100])
        ),
        1e8 // error
      )
      await th.fastForwardBlocks(3, web3.currentProvider)

      // alice fully withdraws
      await masterChef.withdraw(0, toBN(dec(6, 18)), alice, { from: alice })
      await th.fastForwardBlocks(4, web3.currentProvider)

      // dennis withdraws
      await masterChef.withdraw(0, toBN(dec(100, 18)), dennis, { from: dennis })
      await th.fastForwardBlocks(5, web3.currentProvider)

      // alice and dennis harvest
      await masterChef.harvest(0, alice, { from: alice })
      await checkBalances(
        alice,
        ...rewardsToUser(
          blocksToRewards(await web3.eth.getBlockNumber() - initialBlock),
          multiplier([10, 10, 6, 6, 6, 6, 6, 6, 6, 0, 0])
        ),
        1e8 // error
      )

      await masterChef.harvest(0, dennis, { from: dennis })
      await checkBalances(
        dennis,
        ...rewardsToUser(
          blocksToRewards(await web3.eth.getBlockNumber() - initialBlock),
          multiplier([0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 0, 0])
        ),
        1e8 // error
      )
    })

    it('emergency withdrawal', async () => {
      const amount = toBN(dec(10, 18))
      const blocks = 5

      // deposit
      await deposit(alice, amount)

      await th.fastForwardBlocks(blocks, web3.currentProvider)

      await checkRewards(blocks)

      // emergency withdraw
      await checkBalances(alice, 0, 0)
      await masterChef.emergencyWithdraw(0, alice, { from: alice })
      await checkBalances(alice, 0, 0)
    })

  })

  context('On MasterChef without funds', async () => {
    it('Alice deposits once and harvest', async () => {
      const amount = toBN(dec(10, 18))
      const blocks = 5

      await checkRewards(0)

      await deposit(alice, amount)

      await checkRewards(0)

      await th.fastForwardBlocks(blocks, web3.currentProvider)

      await checkRewards(blocks)

      // harvest
      await checkBalances(alice, 0, 0)
      await masterChef.harvest(0, alice, { from: alice })
      // As there are no funds, no rewards are obtained
      await checkBalances(alice, 0, 0)
    })
  })

  context('Check access modifier', () => {
    it('Regular accounts can’t call onSushiReward', async () => {
      await assertRevert(
        rewarder.onSushiReward(0, ZERO_ADDRESS, alice, toBN(dec(1, 18)), 0, { from: owner }),
        'Only MCV2 can call this function.'
      )
    })
  })
})
