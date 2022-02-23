const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")

const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const NonPayable = artifacts.require('NonPayable.sol')
const TroveManagerTester = artifacts.require("TroveManagerTester")

const th = testHelpers.TestHelper

const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const ZERO_ADDRESS = th.ZERO_ADDRESS
const assertRevert = th.assertRevert

/* NOTE: Some of the borrowing tests do not test for specific VST fee values. They only test that the
 * fees are non-zero when they should occur, and that they decay over time.
 *
 * Specific VST fee values will depend on the final fee schedule used, and the final choice for
 *  the parameter MINUTE_DECAY_FACTOR in the TroveManager, which is still TBD based on economic
 * modelling.
 * 
 */

contract('BorrowerOperations', async accounts => {
  const [
    owner, alice, bob, carol, dennis, whale,
    A, B, C, D, E, F, G, H,] = accounts;

  const [multisig] = accounts.slice(997, 1000)

  let priceFeed
  let vstToken
  let sortedTroves
  let troveManager
  let activePool
  let defaultPool
  let borrowerOperations
  let vstaStaking
  let vstaToken
  let vestaParams
  let erc20

  let contracts

  const getOpenTroveVSTAmount = async (totalDebt, asset) => th.getOpenTroveVSTAmount(contracts, totalDebt, asset)
  const getNetBorrowingAmount = async (debtWithFee, asset) => th.getNetBorrowingAmount(contracts, debtWithFee, asset)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
  const openTrove = async (params) => th.openTrove(contracts, params)
  const getTroveEntireColl = async (trove, asset) => th.getTroveEntireColl(contracts, trove, asset)
  const getTroveEntireDebt = async (trove, asset) => th.getTroveEntireDebt(contracts, trove, asset)
  const getTroveStake = async (trove, asset) => th.getTroveStake(contracts, trove, asset)

  let VST_GAS_COMPENSATION
  let MIN_NET_DEBT
  let BORROWING_FEE_FLOOR
  let VST_GAS_COMPENSATION_ERC20
  let MIN_NET_DEBT_ERC20
  let BORROWING_FEE_FLOOR_ERC20

  before(async () => {

  })

  const testCorpus = ({ withProxy = false }) => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      contracts.borrowerOperations = await BorrowerOperationsTester.new()
      contracts.troveManager = await TroveManagerTester.new()
      contracts = await deploymentHelper.deployVSTToken(contracts)
      const VSTAContracts = await deploymentHelper.deployVSTAContractsHardhat(accounts[0])

      await deploymentHelper.connectCoreContracts(contracts, VSTAContracts)
      await deploymentHelper.connectVSTAContractsToCore(VSTAContracts, contracts)

      if (withProxy) {
        const users = [alice, bob, carol, dennis, whale, A, B, C, D, E]
        await deploymentHelper.deployProxyScripts(contracts, VSTAContracts, owner, users)
      }

      priceFeed = contracts.priceFeedTestnet
      vstToken = contracts.vstToken
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      activePool = contracts.activePool
      defaultPool = contracts.defaultPool
      borrowerOperations = contracts.borrowerOperations
      hintHelpers = contracts.hintHelpers
      vestaParams = contracts.vestaParameters

      vstaStaking = VSTAContracts.vstaStaking
      vstaToken = VSTAContracts.vstaToken
      communityIssuance = VSTAContracts.communityIssuance
      erc20 = contracts.erc20;

      await vestaParams.sanitizeParameters(ZERO_ADDRESS);
      await vestaParams.sanitizeParameters(erc20.address);

      VST_GAS_COMPENSATION = await vestaParams.VST_GAS_COMPENSATION(ZERO_ADDRESS)
      MIN_NET_DEBT = await vestaParams.MIN_NET_DEBT(ZERO_ADDRESS)
      BORROWING_FEE_FLOOR = await vestaParams.BORROWING_FEE_FLOOR(ZERO_ADDRESS)

      VST_GAS_COMPENSATION_ERC20 = await vestaParams.VST_GAS_COMPENSATION(erc20.address)
      MIN_NET_DEBT_ERC20 = await vestaParams.MIN_NET_DEBT(erc20.address)
      BORROWING_FEE_FLOOR_ERC20 = await vestaParams.BORROWING_FEE_FLOOR(erc20.address)

      await vstaToken.unprotectedMint(multisig, dec(5, 24))

      let index = 0;
      for (const acc of accounts) {
        await vstaToken.approve(vstaStaking.address, await web3.eth.getBalance(acc), { from: acc })
        await erc20.mint(acc, await web3.eth.getBalance(acc))
        index++;

        if (index >= 20)
          break;
      }
    })

    it("addColl(): reverts when top-up would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      await openTrove({
        asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice }
      })
      await openTrove({
        asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: bob }
      })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode(ZERO_ADDRESS, price))
      assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).lt(toBN(dec(110, 16))))
      assert.isFalse(await troveManager.checkRecoveryMode(erc20.address, price))
      assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).lt(toBN(dec(110, 16))))

      const collTopUp = 1  // 1 wei top up

      await assertRevert(borrowerOperations.addColl(ZERO_ADDRESS, collTopUp, alice, alice, { from: alice, value: collTopUp }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
      await assertRevert(borrowerOperations.addColl(erc20.address, collTopUp, alice, alice, { from: alice }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("addColl(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
      const { collateral: aliceColl } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const { collateral: aliceCollAsset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(3, 18)), extraParams: { from: alice } })

      const activePool_ETH_Before = await activePool.getAssetBalance(ZERO_ADDRESS)
      const activePool_RawEther_Before = toBN(await web3.eth.getBalance(activePool.address))

      const activePool_ETH_Before_Asset = await activePool.getAssetBalance(erc20.address)
      const activePool_RawEther_Before_Asset = toBN(await erc20.balanceOf(activePool.address)).mul(toBN(10 ** 10))

      assert.isTrue(activePool_ETH_Before.eq(aliceColl))
      assert.isTrue(activePool_RawEther_Before.eq(aliceColl))

      assert.isTrue(activePool_ETH_Before_Asset.eq(aliceCollAsset))
      assert.isTrue(activePool_RawEther_Before_Asset.eq(aliceCollAsset))

      await borrowerOperations.addColl(ZERO_ADDRESS, dec(1, 'ether'), alice, alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.addColl(erc20.address, dec(1, 'ether'), alice, alice, { from: alice })

      const activePool_ETH_After = await activePool.getAssetBalance(ZERO_ADDRESS)
      const activePool_RawEther_After = toBN(await web3.eth.getBalance(activePool.address))
      const activePool_ETH_After_Asset = await activePool.getAssetBalance(erc20.address)
      const activePool_RawEther_After_Asset = toBN(await erc20.balanceOf(activePool.address))

      assert.isTrue(activePool_ETH_After.eq(aliceColl.add(toBN(dec(1, 'ether')))))
      assert.isTrue(activePool_RawEther_After.eq(aliceColl.add(toBN(dec(1, 'ether')))))
      assert.isTrue(activePool_ETH_After_Asset.eq(aliceCollAsset.add(toBN(dec(1, 'ether')))))
      assert.isTrue(activePool_RawEther_After_Asset.eq(aliceCollAsset.div(toBN(10 ** 10)).add(toBN(dec(1, 8)))))
    })

    it("addColl(), active Trove: adds the correct collateral amount to the Trove", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const alice_Trove_Before = await troveManager.Troves(alice, ZERO_ADDRESS)
      const coll_before = alice_Trove_Before[th.TROVE_COLL_INDEX]
      const status_Before = alice_Trove_Before[th.TROVE_STATUS_INDEX]

      const alice_Trove_Before_Asset = await troveManager.Troves(alice, erc20.address)
      const coll_before_Asset = alice_Trove_Before_Asset[th.TROVE_COLL_INDEX]
      const status_Before_Asset = alice_Trove_Before_Asset[th.TROVE_STATUS_INDEX]

      // check status before
      assert.equal(status_Before, 1)
      assert.equal(status_Before_Asset, 1)

      // Alice adds second collateral
      await borrowerOperations.addColl(ZERO_ADDRESS, dec(1, 'ether'), alice, alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.addColl(erc20.address, dec(1, 'ether'), alice, alice, { from: alice })

      const alice_Trove_After = await troveManager.Troves(alice, ZERO_ADDRESS)
      const coll_After = alice_Trove_After[th.TROVE_COLL_INDEX]
      const status_After = alice_Trove_After[th.TROVE_STATUS_INDEX]

      const alice_Trove_After_Asset = await troveManager.Troves(alice, erc20.address)
      const coll_After_Asset = alice_Trove_After_Asset[th.TROVE_COLL_INDEX]
      const status_After_Asset = alice_Trove_After_Asset[th.TROVE_STATUS_INDEX]

      // check coll increases by correct amount,and status remains active
      assert.isTrue(coll_After.eq(coll_before.add(toBN(dec(1, 'ether')))))
      assert.equal(status_After, 1)

      assert.isTrue(coll_After_Asset.eq(coll_before_Asset.add(toBN(dec(1, 'ether')))))
      assert.equal(status_After_Asset, 1)
    })

    it("addColl(), active Trove: Trove is in sortedList before and after", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // check Alice is in list before
      const aliceTroveInList_Before = await sortedTroves.contains(ZERO_ADDRESS, alice)
      const listIsEmpty_Before = await sortedTroves.isEmpty(ZERO_ADDRESS)

      const aliceTroveInList_Before_Asset = await sortedTroves.contains(erc20.address, alice)
      const listIsEmpty_Before_Asset = await sortedTroves.isEmpty(erc20.address)

      assert.equal(aliceTroveInList_Before, true)
      assert.equal(listIsEmpty_Before, false)

      assert.equal(aliceTroveInList_Before_Asset, true)
      assert.equal(listIsEmpty_Before_Asset, false)

      await borrowerOperations.addColl(ZERO_ADDRESS, dec(1, 'ether'), alice, alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.addColl(erc20.address, dec(1, 'ether'), alice, alice, { from: alice })

      // check Alice is still in list after
      const aliceTroveInList_After = await sortedTroves.contains(ZERO_ADDRESS, alice)
      const listIsEmpty_After = await sortedTroves.isEmpty(ZERO_ADDRESS)
      const aliceTroveInList_After_Asset = await sortedTroves.contains(erc20.address, alice)
      const listIsEmpty_After_Asset = await sortedTroves.isEmpty(erc20.address)

      assert.equal(aliceTroveInList_After, true)
      assert.equal(listIsEmpty_After, false)
      assert.equal(aliceTroveInList_After_Asset, true)
      assert.equal(listIsEmpty_After_Asset, false)
    })

    it("addColl(), active Trove: updates the stake and updates the total stakes", async () => {
      //  Alice creates initial Trove with 1 ether
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const alice_Trove_Before = await troveManager.Troves(alice, ZERO_ADDRESS)
      const alice_Stake_Before = alice_Trove_Before[th.TROVE_STAKE_INDEX]
      const totalStakes_Before = (await troveManager.totalStakes(ZERO_ADDRESS))

      const alice_Trove_Before_Asset = await troveManager.Troves(alice, erc20.address)
      const alice_Stake_Before_Asset = alice_Trove_Before_Asset[th.TROVE_STAKE_INDEX]
      const totalStakes_Before_Asset = (await troveManager.totalStakes(erc20.address))

      assert.isTrue(totalStakes_Before.eq(alice_Stake_Before))
      assert.isTrue(totalStakes_Before_Asset.eq(alice_Stake_Before_Asset))

      // Alice tops up Trove collateral with 2 ether
      await borrowerOperations.addColl(ZERO_ADDRESS, dec(2, 'ether'), alice, alice, { from: alice, value: dec(2, 'ether') })
      await borrowerOperations.addColl(erc20.address, dec(2, 'ether'), alice, alice, { from: alice })

      // Check stake and total stakes get updated
      const alice_Trove_After = await troveManager.Troves(alice, ZERO_ADDRESS)
      const alice_Stake_After = alice_Trove_After[th.TROVE_STAKE_INDEX]
      const totalStakes_After = (await troveManager.totalStakes(ZERO_ADDRESS))

      const alice_Trove_After_Asset = await troveManager.Troves(alice, erc20.address)
      const alice_Stake_After_Asset = alice_Trove_After_Asset[th.TROVE_STAKE_INDEX]
      const totalStakes_After_Asset = (await troveManager.totalStakes(erc20.address))

      assert.isTrue(alice_Stake_After.eq(alice_Stake_Before.add(toBN(dec(2, 'ether')))))
      assert.isTrue(totalStakes_After.eq(totalStakes_Before.add(toBN(dec(2, 'ether')))))

      assert.isTrue(alice_Stake_After_Asset.eq(alice_Stake_Before_Asset.add(toBN(dec(2, 'ether')))))
      assert.isTrue(totalStakes_After_Asset.eq(totalStakes_Before_Asset.add(toBN(dec(2, 'ether')))))
    })

    it("addColl(), active Trove: applies pending rewards and updates user's L_ETH, L_VSTDebt snapshots", async () => {
      // --- SETUP ---
      const { collateral: aliceCollBefore, totalDebt: aliceDebtBefore } =
        await openTrove({ extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const { collateral: bobCollBefore, totalDebt: bobDebtBefore } =
        await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      const { collateral: aliceCollBeforeAsset, totalDebt: aliceDebtBeforeAsset } =
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const { collateral: bobCollBeforeAsset, totalDebt: bobDebtBeforeAsset } =
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
      // --- TEST ---

      // price drops to 1ETH:100VST, reducing Carol's ICR below MCR
      await priceFeed.setPrice('100000000000000000000');

      // Liquidate Carol's Trove,
      await troveManager.liquidate(ZERO_ADDRESS, carol, { from: owner });
      await troveManager.liquidate(erc20.address, carol, { from: owner });

      // assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
      assert.isFalse(await sortedTroves.contains(erc20.address, carol))

      const L_ETH = await troveManager.L_ASSETS(ZERO_ADDRESS)
      const L_VSTDebt = await troveManager.L_VSTDebts(ZERO_ADDRESS)

      const L_Asset = await troveManager.L_ASSETS(erc20.address)
      const L_VSTDebt_Asset = await troveManager.L_VSTDebts(erc20.address)

      // check Alice and Bob's reward snapshots are zero before they alter their Troves
      const alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(alice, ZERO_ADDRESS)
      const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
      const alice_VSTDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

      const alice_rewardSnapshot_Before_Asset = await troveManager.rewardSnapshots(alice, erc20.address)
      const alice_ETHrewardSnapshot_Before_Asset = alice_rewardSnapshot_Before_Asset[0]
      const alice_VSTDebtRewardSnapshot_Before_Asset = alice_rewardSnapshot_Before_Asset[1]

      const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bob, ZERO_ADDRESS)
      const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
      const bob_VSTDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

      const bob_rewardSnapshot_Before_Asset = await troveManager.rewardSnapshots(bob, erc20.address)
      const bob_ETHrewardSnapshot_Before_Asset = bob_rewardSnapshot_Before_Asset[0]
      const bob_VSTDebtRewardSnapshot_Before_Asset = bob_rewardSnapshot_Before_Asset[1]

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_VSTDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_VSTDebtRewardSnapshot_Before, 0)

      assert.equal(alice_ETHrewardSnapshot_Before_Asset, 0)
      assert.equal(alice_VSTDebtRewardSnapshot_Before_Asset, 0)
      assert.equal(bob_ETHrewardSnapshot_Before_Asset, 0)
      assert.equal(bob_VSTDebtRewardSnapshot_Before_Asset, 0)

      const alicePendingETHReward = await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)
      const bobPendingETHReward = await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)
      const alicePendingVSTDebtReward = await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, alice)
      const bobPendingVSTDebtReward = await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, bob)

      const alicePendingETHRewardAsset = await troveManager.getPendingAssetReward(erc20.address, alice)
      const bobPendingETHRewardAsset = await troveManager.getPendingAssetReward(erc20.address, bob)
      const alicePendingVSTDebtRewardAsset = await troveManager.getPendingVSTDebtReward(erc20.address, alice)
      const bobPendingVSTDebtRewardAsset = await troveManager.getPendingVSTDebtReward(erc20.address, bob)

      for (reward of [alicePendingETHReward, bobPendingETHReward, alicePendingVSTDebtReward, bobPendingVSTDebtReward,
        alicePendingETHRewardAsset, bobPendingETHRewardAsset, alicePendingVSTDebtRewardAsset, bobPendingVSTDebtRewardAsset]) {
        assert.isTrue(reward.gt(toBN('0')))
      }

      // Alice and Bob top up their Troves
      const aliceTopUp = toBN(dec(5, 'ether'))
      const bobTopUp = toBN(dec(1, 'ether'))

      await borrowerOperations.addColl(ZERO_ADDRESS, aliceTopUp, alice, alice, { from: alice, value: aliceTopUp })
      await borrowerOperations.addColl(ZERO_ADDRESS, bobTopUp, bob, bob, { from: bob, value: bobTopUp })

      await borrowerOperations.addColl(erc20.address, aliceTopUp, alice, alice, { from: alice })
      await borrowerOperations.addColl(erc20.address, bobTopUp, bob, bob, { from: bob })

      // Check that both alice and Bob have had pending rewards applied in addition to their top-ups. 
      const aliceNewColl = await getTroveEntireColl(alice)
      const aliceNewDebt = await getTroveEntireDebt(alice)
      const bobNewColl = await getTroveEntireColl(bob)
      const bobNewDebt = await getTroveEntireDebt(bob)

      const aliceNewColl_Asset = await getTroveEntireColl(alice, erc20.address)
      const aliceNewDebt_Asset = await getTroveEntireDebt(alice, erc20.address)
      const bobNewColl_Asset = await getTroveEntireColl(bob, erc20.address)
      const bobNewDebt_Asset = await getTroveEntireDebt(bob, erc20.address)

      assert.isTrue(aliceNewColl.eq(aliceCollBefore.add(alicePendingETHReward).add(aliceTopUp)))
      assert.isTrue(aliceNewDebt.eq(aliceDebtBefore.add(alicePendingVSTDebtReward)))
      assert.isTrue(bobNewColl.eq(bobCollBefore.add(bobPendingETHReward).add(bobTopUp)))
      assert.isTrue(bobNewDebt.eq(bobDebtBefore.add(bobPendingVSTDebtReward)))

      assert.isTrue(aliceNewColl_Asset.eq(aliceCollBeforeAsset.add(alicePendingETHRewardAsset).add(aliceTopUp)))
      assert.isTrue(aliceNewDebt_Asset.eq(aliceDebtBeforeAsset.add(alicePendingVSTDebtRewardAsset)))
      assert.isTrue(bobNewColl_Asset.eq(bobCollBeforeAsset.add(bobPendingETHRewardAsset).add(bobTopUp)))
      assert.isTrue(bobNewDebt_Asset.eq(bobDebtBeforeAsset.add(bobPendingVSTDebtRewardAsset)))

      /* Check that both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
       to the latest values of L_ETH and L_VSTDebt */
      const alice_rewardSnapshot_After = await troveManager.rewardSnapshots(alice, ZERO_ADDRESS)
      const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
      const alice_VSTDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]

      const alice_rewardSnapshot_After_Asset = await troveManager.rewardSnapshots(alice, erc20.address)
      const alice_ETHrewardSnapshot_After_Asset = alice_rewardSnapshot_After_Asset[0]
      const alice_VSTDebtRewardSnapshot_After_Asset = alice_rewardSnapshot_After_Asset[1]

      const bob_rewardSnapshot_After = await troveManager.rewardSnapshots(bob, ZERO_ADDRESS)
      const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
      const bob_VSTDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]

      const bob_rewardSnapshot_After_Asset = await troveManager.rewardSnapshots(bob, erc20.address)
      const bob_ETHrewardSnapshot_After_Asset = bob_rewardSnapshot_After_Asset[0]
      const bob_VSTDebtRewardSnapshot_After_Asset = bob_rewardSnapshot_After_Asset[1]

      assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(alice_VSTDebtRewardSnapshot_After, L_VSTDebt), 100)
      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(bob_VSTDebtRewardSnapshot_After, L_VSTDebt), 100)

      assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After_Asset, L_Asset), 100)
      assert.isAtMost(th.getDifference(alice_VSTDebtRewardSnapshot_After_Asset, L_VSTDebt_Asset), 100)
      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After_Asset, L_Asset), 100)
      assert.isAtMost(th.getDifference(bob_VSTDebtRewardSnapshot_After_Asset, L_VSTDebt_Asset), 100)
    })

    it("addColl(), reverts if trove is non-existent or closed", async () => {
      // A, B open troves
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Carol attempts to add collateral to her non-existent trove
      try {
        const txCarol = await borrowerOperations.addColl(ZERO_ADDRESS, dec(1, 'ether'), carol, carol, { from: carol, value: dec(1, 'ether') })
        assert.isFalse(txCarol.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
        assert.include(error.message, "Trove does not exist or is closed")
      }

      // Carol attempts to add collateral to her non-existent trove
      try {
        const txCarol = await borrowerOperations.addColl(erc20.address, dec(1, 'ether'), carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
        assert.include(error.message, "Trove does not exist or is closed")
      }

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Bob gets liquidated
      await troveManager.liquidate(ZERO_ADDRESS, bob)
      await troveManager.liquidate(erc20.address, bob)

      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
      assert.isFalse(await sortedTroves.contains(erc20.address, bob))

      // Bob attempts to add collateral to his closed trove
      try {
        const txBob = await borrowerOperations.addColl(ZERO_ADDRESS, dec(1, 'ether'), bob, bob, { from: bob, value: dec(1, 'ether') })
        assert.isFalse(txBob.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
        assert.include(error.message, "Trove does not exist or is closed")
      }

      // Bob attempts to add collateral to his closed trove
      try {
        const txBob = await borrowerOperations.addColl(erc20.address, dec(1, 'ether'), bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
        assert.include(error.message, "Trove does not exist or is closed")
      }
    })

    it('addColl(): can add collateral in Recovery Mode', async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollBefore = await getTroveEntireColl(alice)
      const aliceCollAssetBefore = await getTroveEntireColl(alice, erc20.address)
      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await priceFeed.setPrice('105000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      const collTopUp = toBN(dec(1, 'ether'))
      await borrowerOperations.addColl(ZERO_ADDRESS, collTopUp, alice, alice, { from: alice, value: collTopUp })
      await borrowerOperations.addColl(erc20.address, collTopUp, alice, alice, { from: alice })

      // Check Alice's collateral
      const aliceCollAfter = (await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      assert.isTrue(aliceCollAfter.eq(aliceCollBefore.add(collTopUp)))

      const aliceCollAssetAfter = (await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX]
      assert.isTrue(aliceCollAssetAfter.eq(aliceCollAssetBefore.add(collTopUp)))
    })

    // --- withdrawColl() ---

    it("withdrawColl(): reverts when withdrawal would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral

      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode(ZERO_ADDRESS, price))
      assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).lt(toBN(dec(110, 16))))
      assert.isFalse(await troveManager.checkRecoveryMode(erc20.address, price))
      assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).lt(toBN(dec(110, 16))))

      const collWithdrawal = 1  // 1 wei withdrawal

      await assertRevert(borrowerOperations.withdrawColl(ZERO_ADDRESS, 1, alice, alice, { from: alice }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")

      await assertRevert(borrowerOperations.withdrawColl(erc20.address, 1, alice, alice, { from: alice }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    // reverts when calling address does not have active trove  
    it("withdrawColl(): reverts when calling address does not have active trove", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Bob successfully withdraws some coll
      const txBob = await borrowerOperations.withdrawColl(ZERO_ADDRESS, dec(100, 'finney'), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Carol with no active trove attempts to withdraw
      try {
        const txCarol = await borrowerOperations.withdrawColl(ZERO_ADDRESS, dec(1, 'ether'), carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }


      // Bob successfully withdraws some coll
      const txBobAsset = await borrowerOperations.withdrawColl(erc20.address, dec(100, 'finney'), bob, bob, { from: bob })
      assert.isTrue(txBobAsset.receipt.status)

      // Carol with no active trove attempts to withdraw
      try {
        const txCarolAsset = await borrowerOperations.withdrawColl(erc20.address, dec(1, 'ether'), carol, carol, { from: carol })
        assert.isFalse(txCarolAsset.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts when system is in Recovery Mode", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      // Withdrawal possible when recoveryMode == false
      const txAlice = await borrowerOperations.withdrawColl(ZERO_ADDRESS, 1000, alice, alice, { from: alice })
      assert.isTrue(txAlice.receipt.status)

      const txAliceAsset = await borrowerOperations.withdrawColl(erc20.address, 1000, alice, alice, { from: alice })
      assert.isTrue(txAliceAsset.receipt.status)

      await priceFeed.setPrice('105000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      //Check withdrawal impossible when recoveryMode == true
      try {
        const txBob = await borrowerOperations.withdrawColl(ZERO_ADDRESS, 1000, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try {
        const txBobAsset = await borrowerOperations.withdrawColl(erc20.address, 1000, bob, bob, { from: bob })
        assert.isFalse(txBobAsset.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts when requested ETH withdrawal is > the trove's collateral", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      const carolColl = await getTroveEntireColl(carol)
      const bobColl = await getTroveEntireColl(bob)

      const carolCollAsset = await getTroveEntireColl(carol, erc20.address)
      const bobCollAsset = await getTroveEntireColl(bob, erc20.address)

      // Carol withdraws exactly all her collateral
      await assertRevert(
        borrowerOperations.withdrawColl(ZERO_ADDRESS, carolColl, carol, carol, { from: carol }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )
      await assertRevert(
        borrowerOperations.withdrawColl(erc20.address, carolCollAsset, carol, carol, { from: carol }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )

      // Bob attempts to withdraw 1 wei more than his collateral
      try {
        const txBob = await borrowerOperations.withdrawColl(ZERO_ADDRESS, bobColl.add(toBN(1)), bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      try {
        const txBobAsset = await borrowerOperations.withdrawColl(erc20.address, bobCollAsset.add(toBN(1)), bob, bob, { from: bob })
        assert.isFalse(txBobAsset.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts when withdrawal would bring the user's ICR < MCR", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ ICR: toBN(dec(11, 17)), extraParams: { from: bob } }) // 110% ICR

      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(11, 17)), extraParams: { from: bob } }) // 110% ICR

      // Bob attempts to withdraws 1 wei, Which would leave him with < 110% ICR.
      try {
        const txBob = await borrowerOperations.withdrawColl(ZERO_ADDRESS, 1, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try {
        const txBobAsset = await borrowerOperations.withdrawColl(erc20.address, 1, bob, bob, { from: bob })
        assert.isFalse(txBobAsset.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts if system is in Recovery Mode", async () => {
      // --- SETUP ---

      // A and B open troves at 150% ICR
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } })


      await openTrove({ asset: erc20.address, ICR: toBN(dec(15, 17)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(15, 17)), extraParams: { from: alice } })

      const TCR = (await th.getTCR(contracts)).toString()
      const TCR_Asset = (await th.getTCR(contracts, erc20.address)).toString()
      assert.equal(TCR, '1500000000000000000')
      assert.equal(TCR_Asset, '1500000000000000000')

      // --- TEST ---

      // price drops to 1ETH:150VST, reducing TCR below 150%
      await priceFeed.setPrice('150000000000000000000');

      //Alice tries to withdraw collateral during Recovery Mode
      try {
        const txData = await borrowerOperations.withdrawColl(ZERO_ADDRESS, '1', alice, alice, { from: alice })
        assert.isFalse(txData.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
      try {
        const txDataAsset = await borrowerOperations.withdrawColl(erc20.address, '1', alice, alice, { from: alice })
        assert.isFalse(txDataAsset.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
    })

    it("withdrawColl(): doesn’t allow a user to completely withdraw all collateral from their Trove (due to gas compensation)", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceColl = (await troveManager.getEntireDebtAndColl(ZERO_ADDRESS, alice))[th.TROVE_COLL_INDEX]
      const aliceCollAsset = (await troveManager.getEntireDebtAndColl(erc20.address, alice))[th.TROVE_COLL_INDEX]

      // Check Trove is active
      const alice_Trove_Before = await troveManager.Troves(alice, ZERO_ADDRESS)
      const status_Before = alice_Trove_Before[th.TROVE_STATUS_INDEX]
      assert.equal(status_Before, 1)
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))

      const alice_Trove_Before_Asset = await troveManager.Troves(alice, erc20.address)
      const status_Before_Asset = alice_Trove_Before_Asset[th.TROVE_STATUS_INDEX]
      assert.equal(status_Before_Asset, 1)
      assert.isTrue(await sortedTroves.contains(erc20.address, alice))

      // Alice attempts to withdraw all collateral
      await assertRevert(
        borrowerOperations.withdrawColl(ZERO_ADDRESS, aliceColl, alice, alice, { from: alice }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )

      await assertRevert(
        borrowerOperations.withdrawColl(erc20.address, aliceCollAsset, alice, alice, { from: alice }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )
    })

    it("withdrawColl(): leaves the Trove active when the user withdraws less than all the collateral", async () => {
      // Open Trove 
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // Check Trove is active
      const alice_Trove_Before = await troveManager.Troves(alice, ZERO_ADDRESS)
      const status_Before = alice_Trove_Before[th.TROVE_STATUS_INDEX]
      assert.equal(status_Before, 1)
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))

      const alice_Trove_Before_Asset = await troveManager.Troves(alice, erc20.address)
      const status_Before_Asset = alice_Trove_Before_Asset[th.TROVE_STATUS_INDEX]
      assert.equal(status_Before_Asset, 1)
      assert.isTrue(await sortedTroves.contains(erc20.address, alice))

      // Withdraw some collateral
      await borrowerOperations.withdrawColl(ZERO_ADDRESS, dec(100, 'finney'), alice, alice, { from: alice })
      await borrowerOperations.withdrawColl(erc20.address, dec(100, 'finney'), alice, alice, { from: alice })

      // Check Trove is still active
      const alice_Trove_After = await troveManager.Troves(alice, ZERO_ADDRESS)
      const status_After = alice_Trove_After[th.TROVE_STATUS_INDEX]
      assert.equal(status_After, 1)
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))

      const alice_Trove_After_Asset = await troveManager.Troves(alice, erc20.address)
      const status_After_Asset = alice_Trove_After_Asset[th.TROVE_STATUS_INDEX]
      assert.equal(status_After_Asset, 1)
      assert.isTrue(await sortedTroves.contains(erc20.address, alice))
    })

    it("withdrawColl(): reduces the Trove's collateral by the correct amount", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollBefore = await getTroveEntireColl(alice)

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollBefore_Asset = await getTroveEntireColl(alice, erc20.address)

      // Alice withdraws 1 ether
      await borrowerOperations.withdrawColl(ZERO_ADDRESS, dec(1, 'ether'), alice, alice, { from: alice })
      await borrowerOperations.withdrawColl(erc20.address, dec(1, 'ether'), alice, alice, { from: alice })

      // Check 1 ether remaining
      const alice_Trove_After = await troveManager.Troves(alice, ZERO_ADDRESS)
      const aliceCollAfter = await getTroveEntireColl(alice)

      const alice_Trove_After_Asset = await troveManager.Troves(alice, erc20.address)
      const aliceCollAfter_Asset = await getTroveEntireColl(alice, erc20.address)

      assert.isTrue(aliceCollAfter.eq(aliceCollBefore.sub(toBN(dec(1, 'ether')))))
      assert.isTrue(aliceCollAfter_Asset.eq(aliceCollBefore_Asset.sub(toBN(dec(1, 'ether')))))
    })

    it("withdrawColl(): reduces ActivePool ETH and raw ether by correct amount", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // check before
      const activePool_ETH_before = await activePool.getAssetBalance(ZERO_ADDRESS)
      const activePool_RawEther_before = toBN(await web3.eth.getBalance(activePool.address))

      const activePool_ETH_before_Asset = await activePool.getAssetBalance(erc20.address)
      const activePool_RawEther_before_Asset = toBN(await erc20.balanceOf(activePool.address))

      await borrowerOperations.withdrawColl(ZERO_ADDRESS, dec(1, 'ether'), alice, alice, { from: alice })
      await borrowerOperations.withdrawColl(erc20.address, dec(1, 'ether'), alice, alice, { from: alice })

      // check after
      const activePool_ETH_After = await activePool.getAssetBalance(ZERO_ADDRESS)
      const activePool_RawEther_After = toBN(await web3.eth.getBalance(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(activePool_ETH_before.sub(toBN(dec(1, 'ether')))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_RawEther_before.sub(toBN(dec(1, 'ether')))))

      const activePool_ETH_After_Asset = await activePool.getAssetBalance(erc20.address)
      const activePool_RawEther_After_Asset = toBN(await erc20.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After_Asset.eq(activePool_ETH_before_Asset.sub(toBN(dec(1, 'ether')))))
      assert.isTrue(activePool_RawEther_After_Asset.eq(activePool_RawEther_before_Asset.sub(toBN(dec(1, 8)))))
    })

    it("withdrawColl(): updates the stake and updates the total stakes", async () => {
      //  Alice creates initial Trove with 2 ether
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice, value: toBN(dec(5, 'ether')) } })
      await openTrove({
        asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice }
      })
      const aliceColl = await getTroveEntireColl(alice)
      assert.isTrue(aliceColl.gt(toBN('0')))

      const aliceColl_Asset = await getTroveEntireColl(alice, erc20.address)
      assert.isTrue(aliceColl_Asset.gt(toBN('0')))

      const alice_Trove_Before = await troveManager.Troves(alice, ZERO_ADDRESS)
      const alice_Stake_Before = alice_Trove_Before[th.TROVE_STAKE_INDEX]
      const totalStakes_Before = (await troveManager.totalStakes(ZERO_ADDRESS))

      const alice_Trove_Before_Asset = await troveManager.Troves(alice, erc20.address)
      const alice_Stake_Before_Asset = alice_Trove_Before_Asset[th.TROVE_STAKE_INDEX]
      const totalStakes_Before_Asset = (await troveManager.totalStakes(erc20.address))

      assert.isTrue(alice_Stake_Before.eq(aliceColl))
      assert.isTrue(totalStakes_Before.eq(aliceColl))

      assert.isTrue(alice_Stake_Before_Asset.eq(aliceColl_Asset))
      assert.isTrue(totalStakes_Before_Asset.eq(aliceColl_Asset))

      // Alice withdraws 1 ether
      await borrowerOperations.withdrawColl(ZERO_ADDRESS, dec(1, 'ether'), alice, alice, { from: alice })
      await borrowerOperations.withdrawColl(erc20.address, dec(1, 'ether'), alice, alice, { from: alice })

      // Check stake and total stakes get updated
      const alice_Trove_After = await troveManager.Troves(alice, ZERO_ADDRESS)
      const alice_Stake_After = alice_Trove_After[th.TROVE_STAKE_INDEX]
      const totalStakes_After = (await troveManager.totalStakes(ZERO_ADDRESS))

      const alice_Trove_After_Asset = await troveManager.Troves(alice, erc20.address)
      const alice_Stake_After_Asset = alice_Trove_After_Asset[th.TROVE_STAKE_INDEX]
      const totalStakes_After_Asset = (await troveManager.totalStakes(erc20.address))

      assert.isTrue(alice_Stake_After.eq(alice_Stake_Before.sub(toBN(dec(1, 'ether')))))
      assert.isTrue(totalStakes_After.eq(totalStakes_Before.sub(toBN(dec(1, 'ether')))))

      assert.isTrue(alice_Stake_After_Asset.eq(alice_Stake_Before_Asset.sub(toBN(dec(1, 'ether')))))
      assert.isTrue(totalStakes_After_Asset.eq(totalStakes_Before_Asset.sub(toBN(dec(1, 'ether')))))
    })

    it("withdrawColl(): sends the correct amount of ETH to the user", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice, value: dec(2, 'ether') } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const alice_ETHBalance_Before = toBN(web3.utils.toBN(await web3.eth.getBalance(alice)))
      await borrowerOperations.withdrawColl(ZERO_ADDRESS, dec(1, 'ether'), alice, alice, { from: alice, gasPrice: 0 })

      const alice_ETHBalance_Before_Asset = toBN(web3.utils.toBN(await erc20.balanceOf(alice)))
      await borrowerOperations.withdrawColl(erc20.address, dec(1, 'ether'), alice, alice, { from: alice, gasPrice: 0 })

      const alice_ETHBalance_After = toBN(web3.utils.toBN(await web3.eth.getBalance(alice)))
      const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

      const alice_ETHBalance_After_Asset = toBN(web3.utils.toBN(await erc20.balanceOf(alice)))
      const balanceDiff_Asset = alice_ETHBalance_After_Asset.sub(alice_ETHBalance_Before_Asset)

      assert.isTrue(balanceDiff.eq(toBN(dec(1, 'ether'))))
      assert.isTrue(balanceDiff_Asset.eq(toBN(dec(1, 8))))
    })

    it("withdrawColl(): applies pending rewards and updates user's L_ETH, L_VSTDebt snapshots", async () => {
      // --- SETUP ---
      // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: alice, value: toBN(dec(100, 'ether')) } })
      await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: bob, value: toBN(dec(100, 'ether')) } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol, value: toBN(dec(10, 'ether')) } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(3, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      const aliceCollBefore = await getTroveEntireColl(alice)
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      const bobCollBefore = await getTroveEntireColl(bob)
      const bobDebtBefore = await getTroveEntireDebt(bob)


      const aliceCollBefore_Asset = await getTroveEntireColl(alice, erc20.address)
      const aliceDebtBefore_Asset = await getTroveEntireDebt(alice, erc20.address)
      const bobCollBefore_Asset = await getTroveEntireColl(bob, erc20.address)
      const bobDebtBefore_Asset = await getTroveEntireDebt(bob, erc20.address)

      // --- TEST ---

      // price drops to 1ETH:100VST, reducing Carol's ICR below MCR
      await priceFeed.setPrice('100000000000000000000');

      // close Carol's Trove, liquidating her 1 ether and 180VST.
      await troveManager.liquidate(ZERO_ADDRESS, carol, { from: owner });
      await troveManager.liquidate(erc20.address, carol, { from: owner });

      const L_ETH = await troveManager.L_ASSETS(ZERO_ADDRESS)
      const L_VSTDebt = await troveManager.L_VSTDebts(ZERO_ADDRESS)

      const L_ASSET = await troveManager.L_ASSETS(erc20.address)
      const L_VSTDebt_Asset = await troveManager.L_VSTDebts(erc20.address)

      // check Alice and Bob's reward snapshots are zero before they alter their Troves
      const alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(alice, ZERO_ADDRESS)
      const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
      const alice_VSTDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

      const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bob, ZERO_ADDRESS)
      const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
      const bob_VSTDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]


      const alice_rewardSnapshot_Before_Asset = await troveManager.rewardSnapshots(alice, erc20.address)
      const alice_ETHrewardSnapshot_Before_Asset = alice_rewardSnapshot_Before_Asset[0]
      const alice_VSTDebtRewardSnapshot_Before_Asset = alice_rewardSnapshot_Before_Asset[1]

      const bob_rewardSnapshot_Before_Asset = await troveManager.rewardSnapshots(bob, erc20.address)
      const bob_ETHrewardSnapshot_Before_Asset = bob_rewardSnapshot_Before_Asset[0]
      const bob_VSTDebtRewardSnapshot_Before_Asset = bob_rewardSnapshot_Before_Asset[1]

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_VSTDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_VSTDebtRewardSnapshot_Before, 0)

      assert.equal(alice_ETHrewardSnapshot_Before_Asset, 0)
      assert.equal(alice_VSTDebtRewardSnapshot_Before_Asset, 0)
      assert.equal(bob_ETHrewardSnapshot_Before_Asset, 0)
      assert.equal(bob_VSTDebtRewardSnapshot_Before_Asset, 0)

      // Check A and B have pending rewards
      const pendingCollReward_A = await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)
      const pendingDebtReward_A = await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, alice)
      const pendingCollReward_B = await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)
      const pendingDebtReward_B = await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, bob)
      for (reward of [pendingCollReward_A, pendingDebtReward_A, pendingCollReward_B, pendingDebtReward_B]) {
        assert.isTrue(reward.gt(toBN('0')))
      }

      const pendingCollReward_A_Asset = await troveManager.getPendingAssetReward(erc20.address, alice)
      const pendingDebtReward_A_Asset = await troveManager.getPendingVSTDebtReward(erc20.address, alice)
      const pendingCollReward_B_Asset = await troveManager.getPendingAssetReward(erc20.address, bob)
      const pendingDebtReward_B_Asset = await troveManager.getPendingVSTDebtReward(erc20.address, bob)
      for (reward of [pendingCollReward_A_Asset, pendingDebtReward_A_Asset, pendingCollReward_B_Asset, pendingDebtReward_B_Asset]) {
        assert.isTrue(reward.gt(toBN('0')))
      }


      // Alice and Bob withdraw from their Troves
      const aliceCollWithdrawal = toBN(dec(5, 'ether'))
      const bobCollWithdrawal = toBN(dec(1, 'ether'))

      await borrowerOperations.withdrawColl(ZERO_ADDRESS, aliceCollWithdrawal, alice, alice, { from: alice })
      await borrowerOperations.withdrawColl(ZERO_ADDRESS, bobCollWithdrawal, bob, bob, { from: bob })

      await borrowerOperations.withdrawColl(erc20.address, aliceCollWithdrawal, alice, alice, { from: alice })
      await borrowerOperations.withdrawColl(erc20.address, bobCollWithdrawal, bob, bob, { from: bob })

      // Check that both alice and Bob have had pending rewards applied in addition to their top-ups. 
      const aliceCollAfter = await getTroveEntireColl(alice)
      const aliceDebtAfter = await getTroveEntireDebt(alice)
      const bobCollAfter = await getTroveEntireColl(bob)
      const bobDebtAfter = await getTroveEntireDebt(bob)

      const aliceCollAfter_Asset = await getTroveEntireColl(alice, erc20.address)
      const aliceDebtAfter_Asset = await getTroveEntireDebt(alice, erc20.address)
      const bobCollAfter_Asset = await getTroveEntireColl(bob, erc20.address)
      const bobDebtAfter_Asset = await getTroveEntireDebt(bob, erc20.address)

      // Check rewards have been applied to troves
      th.assertIsApproximatelyEqual(aliceCollAfter, aliceCollBefore.add(pendingCollReward_A).sub(aliceCollWithdrawal), 10000)
      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.add(pendingDebtReward_A), 10000)
      th.assertIsApproximatelyEqual(bobCollAfter, bobCollBefore.add(pendingCollReward_B).sub(bobCollWithdrawal), 10000)
      th.assertIsApproximatelyEqual(bobDebtAfter, bobDebtBefore.add(pendingDebtReward_B), 10000)

      th.assertIsApproximatelyEqual(aliceCollAfter_Asset, aliceCollBefore_Asset.add(pendingCollReward_A_Asset).sub(aliceCollWithdrawal), 10000)
      th.assertIsApproximatelyEqual(aliceDebtAfter_Asset, aliceDebtBefore_Asset.add(pendingDebtReward_A_Asset), 10000)
      th.assertIsApproximatelyEqual(bobCollAfter_Asset, bobCollBefore_Asset.add(pendingCollReward_B_Asset).sub(bobCollWithdrawal), 10000)
      th.assertIsApproximatelyEqual(bobDebtAfter_Asset, bobDebtBefore_Asset.add(pendingDebtReward_B_Asset), 10000)

      /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
       to the latest values of L_ETH and L_VSTDebt */
      const alice_rewardSnapshot_After = await troveManager.rewardSnapshots(alice, ZERO_ADDRESS)
      const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
      const alice_VSTDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]

      const bob_rewardSnapshot_After = await troveManager.rewardSnapshots(bob, ZERO_ADDRESS)
      const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
      const bob_VSTDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]

      const alice_rewardSnapshot_After_Asset = await troveManager.rewardSnapshots(alice, erc20.address)
      const alice_ETHrewardSnapshot_After_Asset = alice_rewardSnapshot_After_Asset[0]
      const alice_VSTDebtRewardSnapshot_After_Asset = alice_rewardSnapshot_After_Asset[1]

      const bob_rewardSnapshot_After_Asset = await troveManager.rewardSnapshots(bob, erc20.address)
      const bob_ETHrewardSnapshot_After_Asset = bob_rewardSnapshot_After_Asset[0]
      const bob_VSTDebtRewardSnapshot_After_Asset = bob_rewardSnapshot_After_Asset[1]

      assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After_Asset, L_ASSET), 100)
      assert.isAtMost(th.getDifference(alice_VSTDebtRewardSnapshot_After_Asset, L_VSTDebt_Asset), 100)
      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After_Asset, L_ASSET), 100)
      assert.isAtMost(th.getDifference(bob_VSTDebtRewardSnapshot_After_Asset, L_VSTDebt_Asset), 100)
    })

    // --- withdrawVST() ---

    it("withdrawVST(): reverts when withdrawal would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode(ZERO_ADDRESS, price))
      assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).lt(toBN(dec(110, 16))))

      assert.isFalse(await troveManager.checkRecoveryMode(erc20.address, price))
      assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).lt(toBN(dec(110, 16))))

      const VSTwithdrawal = 1  // withdraw 1 wei VST

      await assertRevert(borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, VSTwithdrawal, alice, alice, { from: alice }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")

      await assertRevert(borrowerOperations.withdrawVST(erc20.address, th._100pct, VSTwithdrawal, alice, alice, { from: alice }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("withdrawVST(): decays a non-zero base rate", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraVSTAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ extraVSTAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const A_VSTBal = await vstToken.balanceOf(A)
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setBaseRate(erc20.address, dec(5, 16))

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws VST
      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(1, 18), A, A, { from: D })
      await borrowerOperations.withdrawVST(erc20.address, th._100pct, dec(1, 18), A, A, { from: D })

      // Check baseRate has decreased
      const baseRate_2 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_2.lt(baseRate_1))

      const baseRate_2_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_2_Asset.lt(baseRate_1_Asset))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E withdraws VST
      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(1, 18), A, A, { from: E })
      await borrowerOperations.withdrawVST(erc20.address, th._100pct, dec(1, 18), A, A, { from: E })

      const baseRate_3 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_3.lt(baseRate_2))

      const baseRate_3_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_3_Asset.lt(baseRate_2_Asset))
    })

    it("withdrawVST(): reverts if max fee > 100%", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await assertRevert(borrowerOperations.withdrawVST(ZERO_ADDRESS, dec(2, 18), dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.withdrawVST(ZERO_ADDRESS, '1000000000000000001', dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")

      await assertRevert(borrowerOperations.withdrawVST(erc20.address, dec(2, 18), dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.withdrawVST(erc20.address, '1000000000000000001', dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("withdrawVST(): reverts if max fee < 0.5% in Normal mode", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await assertRevert(borrowerOperations.withdrawVST(ZERO_ADDRESS, 0, dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.withdrawVST(ZERO_ADDRESS, 1, dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.withdrawVST(ZERO_ADDRESS, '4999999999999999', dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")

      await assertRevert(borrowerOperations.withdrawVST(erc20.address, 0, dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.withdrawVST(erc20.address, 1, dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.withdrawVST(erc20.address, '4999999999999999', dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("withdrawVST(): reverts if fee exceeds max fee percentage", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(70, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(80, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ extraVSTAmount: toBN(dec(180, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(70, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(80, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(180, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const totalSupply = await vstToken.totalSupply()

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      let baseRate = await troveManager.baseRate(ZERO_ADDRESS) // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))


      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      let baseRate_Asset = await troveManager.baseRate(erc20.address) // expect 5% base rate
      assert.equal(baseRate_Asset, dec(5, 16))

      // 100%: 1e18,  10%: 1e17,  1%: 1e16,  0.1%: 1e15
      // 5%: 5e16
      // 0.5%: 5e15
      // actual: 0.5%, 5e15


      // VSTFee:                  15000000558793542
      // absolute _fee:            15000000558793542
      // actual feePercentage:      5000000186264514
      // user's _maxFeePercentage: 49999999999999999

      const lessThan5pct = '49999999999999999'
      await assertRevert(borrowerOperations.withdrawVST(ZERO_ADDRESS, lessThan5pct, dec(3, 18), A, A, { from: A }), "Fee exceeded provided maximum")
      await assertRevert(borrowerOperations.withdrawVST(erc20.address, lessThan5pct, dec(3, 18), A, A, { from: A }), "Fee exceeded provided maximum")

      baseRate = await troveManager.baseRate(ZERO_ADDRESS) // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      baseRate_Asset = await troveManager.baseRate(erc20.address) // expect 5% base rate
      assert.equal(baseRate_Asset, dec(5, 16))
      // Attempt with maxFee 1%
      await assertRevert(borrowerOperations.withdrawVST(ZERO_ADDRESS, dec(1, 16), dec(1, 18), A, A, { from: B }), "Fee exceeded provided maximum")
      await assertRevert(borrowerOperations.withdrawVST(erc20.address, dec(1, 16), dec(1, 18), A, A, { from: B }), "Fee exceeded provided maximum")

      baseRate = await troveManager.baseRate(ZERO_ADDRESS)  // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      baseRate_Asset = await troveManager.baseRate(erc20.address)  // expect 5% base rate
      assert.equal(baseRate_Asset, dec(5, 16))
      // Attempt with maxFee 3.754%
      await assertRevert(borrowerOperations.withdrawVST(ZERO_ADDRESS, dec(3754, 13), dec(1, 18), A, A, { from: C }), "Fee exceeded provided maximum")
      await assertRevert(borrowerOperations.withdrawVST(erc20.address, dec(3754, 13), dec(1, 18), A, A, { from: C }), "Fee exceeded provided maximum")

      baseRate = await troveManager.baseRate(ZERO_ADDRESS)  // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      baseRate_Asset = await troveManager.baseRate(erc20.address)  // expect 5% base rate
      assert.equal(baseRate_Asset, dec(5, 16))
      // Attempt with maxFee 0.5%%
      await assertRevert(borrowerOperations.withdrawVST(ZERO_ADDRESS, dec(5, 15), dec(1, 18), A, A, { from: D }), "Fee exceeded provided maximum")
      await assertRevert(borrowerOperations.withdrawVST(erc20.address, dec(5, 15), dec(1, 18), A, A, { from: D }), "Fee exceeded provided maximum")
    })

    it("withdrawVST(): succeeds when fee is less than max fee percentage", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(70, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(80, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ extraVSTAmount: toBN(dec(180, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(70, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(80, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(180, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const totalSupply = await vstToken.totalSupply()

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      let baseRate = await troveManager.baseRate(ZERO_ADDRESS) // expect 5% base rate
      let baseRate_Asset = await troveManager.baseRate(erc20.address) // expect 5% base rate
      assert.isTrue(baseRate.eq(toBN(dec(5, 16))))
      assert.isTrue(baseRate_Asset.eq(toBN(dec(5, 16))))

      // Attempt with maxFee > 5%
      const moreThan5pct = '50000000000000001'
      const tx1 = await borrowerOperations.withdrawVST(ZERO_ADDRESS, moreThan5pct, dec(1, 18), A, A, { from: A })
      const tx1_Asset = await borrowerOperations.withdrawVST(erc20.address, moreThan5pct, dec(1, 18), A, A, { from: A })
      assert.isTrue(tx1.receipt.status)
      assert.isTrue(tx1_Asset.receipt.status)

      baseRate = await troveManager.baseRate(ZERO_ADDRESS) // expect 5% base rate
      baseRate_Asset = await troveManager.baseRate(erc20.address) // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      assert.equal(baseRate_Asset, dec(5, 16))

      // Attempt with maxFee = 5%
      const tx2 = await borrowerOperations.withdrawVST(ZERO_ADDRESS, dec(5, 16), dec(1, 18), A, A, { from: B })
      const tx2_Asset = await borrowerOperations.withdrawVST(erc20.address, dec(5, 16), dec(1, 18), A, A, { from: B })
      assert.isTrue(tx2.receipt.status)
      assert.isTrue(tx2_Asset.receipt.status)

      baseRate = await troveManager.baseRate(ZERO_ADDRESS) // expect 5% base rate
      baseRate_Asset = await troveManager.baseRate(erc20.address) // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      assert.equal(baseRate_Asset, dec(5, 16))

      // Attempt with maxFee 10%
      const tx3 = await borrowerOperations.withdrawVST(ZERO_ADDRESS, dec(1, 17), dec(1, 18), A, A, { from: C })
      const tx3_Asset = await borrowerOperations.withdrawVST(erc20.address, dec(1, 17), dec(1, 18), A, A, { from: C })
      assert.isTrue(tx3.receipt.status)
      assert.isTrue(tx3_Asset.receipt.status)

      baseRate = await troveManager.baseRate(ZERO_ADDRESS) // expect 5% base rate
      baseRate_Asset = await troveManager.baseRate(erc20.address) // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      assert.equal(baseRate_Asset, dec(5, 16))

      // Attempt with maxFee 37.659%
      const tx4 = await borrowerOperations.withdrawVST(ZERO_ADDRESS, dec(37659, 13), dec(1, 18), A, A, { from: D })
      const tx4_Asset = await borrowerOperations.withdrawVST(erc20.address, dec(37659, 13), dec(1, 18), A, A, { from: D })
      assert.isTrue(tx4.receipt.status)
      assert.isTrue(tx4_Asset.receipt.status)

      // Attempt with maxFee 100%
      const tx5 = await borrowerOperations.withdrawVST(ZERO_ADDRESS, dec(1, 18), dec(1, 18), A, A, { from: E })
      const tx5_Asset = await borrowerOperations.withdrawVST(erc20.address, dec(1, 18), dec(1, 18), A, A, { from: E })
      assert.isTrue(tx5.receipt.status)
      assert.isTrue(tx5_Asset.receipt.status)
    })

    it("withdrawVST(): doesn't change base rate if it is already zero", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.equal(baseRate_1, '0')
      assert.equal(baseRate_1_Asset, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws VST
      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(37, 18), A, A, { from: D })
      await borrowerOperations.withdrawVST(erc20.address, th._100pct, dec(37, 18), A, A, { from: D })

      // Check baseRate is still 0
      const baseRate_2 = await troveManager.baseRate(ZERO_ADDRESS)
      const baseRate_2_Asset = await troveManager.baseRate(erc20.address)
      assert.equal(baseRate_2, '0')
      assert.equal(baseRate_2_Asset, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens trove 
      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(12, 18), A, A, { from: E })
      await borrowerOperations.withdrawVST(erc20.address, th._100pct, dec(12, 18), A, A, { from: E })

      const baseRate_3 = await troveManager.baseRate(ZERO_ADDRESS)
      const baseRate_3_Asset = await troveManager.baseRate(erc20.address)
      assert.equal(baseRate_3, '0')
      assert.equal(baseRate_3_Asset, '0')
    })

    it("withdrawVST(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)
      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1.gt(toBN('0')))
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime(ZERO_ADDRESS)
      const lastFeeOpTime_1_Asset = await troveManager.lastFeeOperationTime(erc20.address)

      // 10 seconds pass
      th.fastForwardTime(10, web3.currentProvider)

      // Borrower C triggers a fee
      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(1, 18), C, C, { from: C })
      await borrowerOperations.withdrawVST(erc20.address, th._100pct, dec(1, 18), C, C, { from: C })

      const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime(ZERO_ADDRESS)
      const lastFeeOpTime_2_Asset = await troveManager.lastFeeOperationTime(erc20.address)

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))
      assert.isTrue(lastFeeOpTime_2_Asset.eq(lastFeeOpTime_1_Asset))

      // 60 seconds passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(60))
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1_Asset).gte(60))

      // Borrower C triggers a fee
      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(1, 18), C, C, { from: C })
      await borrowerOperations.withdrawVST(erc20.address, th._100pct, dec(1, 18), C, C, { from: C })

      const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime(ZERO_ADDRESS)
      const lastFeeOpTime_3_Asset = await troveManager.lastFeeOperationTime(erc20.address)

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
      assert.isTrue(lastFeeOpTime_3_Asset.gt(lastFeeOpTime_1_Asset))
    })


    it("withdrawVST(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)
      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_1.gt(toBN('0')))
      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      // 30 seconds pass
      th.fastForwardTime(30, web3.currentProvider)

      // Borrower C triggers a fee, before decay interval has passed
      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(1, 18), C, C, { from: C })
      await borrowerOperations.withdrawVST(erc20.address, th._100pct, dec(1, 18), C, C, { from: C })

      // 30 seconds pass
      th.fastForwardTime(30, web3.currentProvider)

      // Borrower C triggers another fee
      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(1, 18), C, C, { from: C })
      await borrowerOperations.withdrawVST(erc20.address, th._100pct, dec(1, 18), C, C, { from: C })

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await troveManager.baseRate(ZERO_ADDRESS)
      const baseRate_2_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_2.lt(baseRate_1))
      assert.isTrue(baseRate_2_Asset.lt(baseRate_1_Asset))
    })

    it("withdrawVST(): borrowing at non-zero base rate sends VST fee to VSTA staking contract", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 VSTA
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
      await vstaStaking.stake(dec(1, 18), { from: multisig })

      // Check VSTA VST balance before == 0
      const VSTAStaking_VSTBalance_Before = await vstToken.balanceOf(vstaStaking.address)
      assert.equal(VSTAStaking_VSTBalance_Before, '0')

      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1.gt(toBN('0')))
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws VST
      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(37, 18), C, C, { from: D })
      await borrowerOperations.withdrawVST(erc20.address, th._100pct, dec(37, 18), C, C, { from: D })

      // Check VSTA VST balance after has increased
      const VSTAStaking_VSTBalance_After = await vstToken.balanceOf(vstaStaking.address)
      assert.isTrue(VSTAStaking_VSTBalance_After.gt(VSTAStaking_VSTBalance_Before))
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("withdrawVST(): borrowing at non-zero base records the (drawn debt + fee) on the Trove struct", async () => {
        // time fast-forwards 1 year, and multisig stakes 1 VSTA
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
        await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
        await vstaStaking.stake(dec(1, 18), { from: multisig })

        await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
        await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

        await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

        const D_debtBefore = await getTroveEntireDebt(D, ZERO_ADDRESS)
        const D_debtBefore_Asset = await getTroveEntireDebt(D, erc20.address)

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)
        await troveManager.setBaseRate(erc20.address, dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow(erc20.address)

        // Check baseRate is now non-zero
        const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
        const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
        assert.isTrue(baseRate_1.gt(toBN('0')))
        assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        // D withdraws VST
        const withdrawal_D = toBN(dec(37, 18))
        const withdrawalTx = await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, toBN(dec(37, 18)), D, D, { from: D })
        const withdrawalTx_Asset = await borrowerOperations.withdrawVST(erc20.address, th._100pct, toBN(dec(37, 18)), D, D, { from: D })

        const emittedFee = toBN(th.getVSTFeeFromVSTBorrowingEvent(withdrawalTx))
        const emittedFee_Asset = toBN(th.getVSTFeeFromVSTBorrowingEvent(withdrawalTx_Asset))
        assert.isTrue(emittedFee.gt(toBN('0')))
        assert.isTrue(emittedFee_Asset.gt(toBN('0')))

        const newDebt = (await troveManager.Troves(D, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]
        const newDebt_Asset = (await troveManager.Troves(D, erc20.address))[th.TROVE_DEBT_INDEX]

        // Check debt on Trove struct equals initial debt + withdrawal + emitted fee
        th.assertIsApproximatelyEqual(newDebt, D_debtBefore.add(withdrawal_D).add(emittedFee), 10000)
        th.assertIsApproximatelyEqual(newDebt_Asset, D_debtBefore_Asset.add(withdrawal_D).add(emittedFee_Asset), 10000)
      })
    }

    it("withdrawVST(): Borrowing at non-zero base rate increases the VSTA staking contract VST fees-per-unit-staked", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 VSTA
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
      await vstaStaking.stake(dec(1, 18), { from: multisig })

      // Check VSTA contract VST fees-per-unit-staked is zero
      const F_VST_Before = await vstaStaking.F_VST()
      assert.equal(F_VST_Before, '0')

      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1.gt(toBN('0')))
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws VST
      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, toBN(dec(37, 18)), D, D, { from: D })
      await borrowerOperations.withdrawVST(erc20.address, th._100pct, toBN(dec(37, 18)), D, D, { from: D })

      // Check VSTA contract VST fees-per-unit-staked has increased
      const F_VST_After = await vstaStaking.F_VST()
      assert.isTrue(F_VST_After.gt(F_VST_Before))
    })

    it("withdrawVST(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 VSTA
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
      await vstaStaking.stake(dec(1, 18), { from: multisig })

      // Check VSTA Staking contract balance before == 0
      const VSTAStaking_VSTBalance_Before = await vstToken.balanceOf(vstaStaking.address)
      assert.equal(VSTAStaking_VSTBalance_Before, '0')

      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)
      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1.gt(toBN('0')))
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      let D_VSTBalanceBefore = await vstToken.balanceOf(D)

      // D withdraws VST
      const D_VSTRequest = toBN(dec(37, 18))
      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, D_VSTRequest, D, D, { from: D })

      // Check VSTA staking VST balance has increased
      let VSTAStaking_VSTBalance_After = await vstToken.balanceOf(vstaStaking.address)
      assert.isTrue(VSTAStaking_VSTBalance_After.gt(VSTAStaking_VSTBalance_Before))

      // Check D's VST balance now equals their initial balance plus request VST
      let D_VSTBalanceAfter = await vstToken.balanceOf(D)
      assert.isTrue(D_VSTBalanceAfter.eq(D_VSTBalanceBefore.add(D_VSTRequest)))

      //Asset:
      D_VSTBalanceBefore = await vstToken.balanceOf(D)
      await borrowerOperations.withdrawVST(erc20.address, th._100pct, D_VSTRequest, D, D, { from: D })

      VSTAStaking_VSTBalance_After = await vstToken.balanceOf(vstaStaking.address)
      assert.isTrue(VSTAStaking_VSTBalance_After.gt(VSTAStaking_VSTBalance_Before))

      D_VSTBalanceAfter = await vstToken.balanceOf(D)
      assert.isTrue(D_VSTBalanceAfter.eq(D_VSTBalanceBefore.add(D_VSTRequest)))

    })

    it("withdrawVST(): Borrowing at zero base rate changes VST fees-per-unit-staked", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.equal(baseRate_1, '0')

      // A artificially receives VSTA, then stakes it
      await vstaToken.unprotectedMint(A, dec(100, 18))
      await vstaStaking.stake(dec(100, 18), { from: A })

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // Check VSTA VST balance before == 0
      const F_VST_Before = await vstaStaking.F_VST()
      assert.equal(F_VST_Before, '0')

      // D withdraws VST
      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(37, 18), D, D, { from: D })

      // Check VSTA VST balance after > 0
      const F_VST_After = await vstaStaking.F_VST()
      assert.isTrue(F_VST_After.gt('0'))
    })

    it("withdrawVST(): Borrowing at zero base rate sends debt request to user", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.equal(baseRate_1, '0')
      assert.equal(baseRate_1_Asset, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      let D_VSTBalanceBefore = await vstToken.balanceOf(D)

      // D withdraws VST
      const D_VSTRequest = toBN(dec(37, 18))
      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(37, 18), D, D, { from: D })

      let D_VSTBalanceAfter = await vstToken.balanceOf(D)
      // Check D's trove debt == D's VST balance + liquidation reserve
      assert.isTrue(D_VSTBalanceAfter.eq(D_VSTBalanceBefore.add(D_VSTRequest)))

      D_VSTBalanceBefore = await vstToken.balanceOf(D)
      await borrowerOperations.withdrawVST(erc20.address, th._100pct, dec(37, 18), D, D, { from: D })

      D_VSTBalanceAfter = await vstToken.balanceOf(D)
      assert.isTrue(D_VSTBalanceAfter.eq(D_VSTBalanceBefore.add(D_VSTRequest)))
    })

    it("withdrawVST(): reverts when calling address does not have active trove", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Bob successfully withdraws VST
      const txBob = await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(100, 18), bob, bob, { from: bob })
      const txBob_Asset = await borrowerOperations.withdrawVST(erc20.address, th._100pct, dec(100, 18), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)
      assert.isTrue(txBob_Asset.receipt.status)

      // Carol with no active trove attempts to withdraw VST
      try {
        const txCarol = await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(100, 18), carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      try {
        const txCarol_Asset = await borrowerOperations.withdrawVST(erc20.address, th._100pct, dec(100, 18), carol, carol, { from: carol })
        assert.isFalse(txCarol_Asset.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawVST(): reverts when requested withdrawal amount is zero VST", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Bob successfully withdraws 1e-18 VST
      const txBob = await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, 1, bob, bob, { from: bob })
      const txBob_Asset = await borrowerOperations.withdrawVST(erc20.address, th._100pct, 1, bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)
      assert.isTrue(txBob_Asset.receipt.status)

      // Alice attempts to withdraw 0 VST
      try {
        const txAlice = await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, 0, alice, alice, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      try {
        const txAlice_Asset = await borrowerOperations.withdrawVST(erc20.address, th._100pct, 0, alice, alice, { from: alice })
        assert.isFalse(txAlice_Asset.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawVST(): reverts when system is in Recovery Mode", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      // Withdrawal possible when recoveryMode == false
      const txAlice = await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(100, 18), alice, alice, { from: alice })
      const txAlice_Asset = await borrowerOperations.withdrawVST(erc20.address, th._100pct, dec(100, 18), alice, alice, { from: alice })
      assert.isTrue(txAlice.receipt.status)
      assert.isTrue(txAlice_Asset.receipt.status)

      await priceFeed.setPrice('50000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      //Check VST withdrawal impossible when recoveryMode == true
      try {
        const txBob = await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, 1, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try {
        const txBob_Asset = await borrowerOperations.withdrawVST(erc20.address, th._100pct, 1, bob, bob, { from: bob })
        assert.isFalse(txBob_Asset.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawVST(): reverts when withdrawal would bring the trove's ICR < MCR", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(11, 17)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(11, 17)), extraParams: { from: bob } })

      // Bob tries to withdraw VST that would bring his ICR < MCR
      try {
        const txBob = await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, 1, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try {
        const txBob_Asset = await borrowerOperations.withdrawVST(erc20.address, th._100pct, 1, bob, bob, { from: bob })
        assert.isFalse(txBob_Asset.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawVST(): reverts when a withdrawal would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      // Alice and Bob creates troves with 150% ICR.  System TCR = 150%.
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      var TCR = (await th.getTCR(contracts)).toString()
      var TCR_Asset = (await th.getTCR(contracts, erc20.address)).toString()
      assert.equal(TCR, '1500000000000000000')
      assert.equal(TCR_Asset, '1500000000000000000')

      // Bob attempts to withdraw 1 VST.
      // System TCR would be: ((3+3) * 100 ) / (200+201) = 600/401 = 149.62%, i.e. below CCR of 150%.
      try {
        const txBob = await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(1, 18), bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try {
        const txBob_Asset = await borrowerOperations.withdrawVST(erc20.address, th._100pct, dec(1, 18), bob, bob, { from: bob })
        assert.isFalse(txBob_Asset.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawVST(): reverts if system is in Recovery Mode", async () => {
      // --- SETUP ---
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      // --- TEST ---

      // price drops to 1ETH:150VST, reducing TCR below 150%
      await priceFeed.setPrice('150000000000000000000');
      assert.isTrue((await th.getTCR(contracts)).lt(toBN(dec(15, 17))))
      assert.isTrue((await th.getTCR(contracts, erc20.address)).lt(toBN(dec(15, 17))))

      try {
        const txData = await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, '200', alice, alice, { from: alice })
        assert.isFalse(txData.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }

      try {
        const txData = await borrowerOperations.withdrawVST(erc20.address, th._100pct, '200', alice, alice, { from: alice })
        assert.isFalse(txData.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
    })

    it("withdrawVST(): increases the Trove's VST debt by the correct amount", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // check before
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      const aliceDebtBefore_Asset = await getTroveEntireDebt(alice, erc20.address)
      assert.isTrue(aliceDebtBefore.gt(toBN(0)))
      assert.isTrue(aliceDebtBefore_Asset.gt(toBN(0)))

      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, await getNetBorrowingAmount(100, ZERO_ADDRESS), alice, alice, { from: alice })
      await borrowerOperations.withdrawVST(erc20.address, th._100pct, await getNetBorrowingAmount(100, ZERO_ADDRESS), alice, alice, { from: alice })

      // check after
      const aliceDebtAfter = await getTroveEntireDebt(alice)
      const aliceDebtAfter_Asset = await getTroveEntireDebt(alice, erc20.address)
      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.add(toBN(100)))
      th.assertIsApproximatelyEqual(aliceDebtAfter_Asset, aliceDebtBefore.add(toBN(100)))
    })

    it("withdrawVST(): increases VST debt in ActivePool by correct amount", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice, value: toBN(dec(100, 'ether')) } })
      await openTrove({ asset: erc20.address, assetSent: toBN(dec(100, 'ether')), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const aliceDebtBefore = await getTroveEntireDebt(alice)
      const aliceDebtBefore_Asset = await getTroveEntireDebt(alice, erc20.address)
      assert.isTrue(aliceDebtBefore.gt(toBN(0)))
      assert.isTrue(aliceDebtBefore_Asset.gt(toBN(0)))

      // check before
      const activePool_VST_Before = await activePool.getVSTDebt(ZERO_ADDRESS)
      const activePool_VST_Before_Asset = await activePool.getVSTDebt(erc20.address)
      assert.isTrue(activePool_VST_Before.eq(aliceDebtBefore))
      assert.isTrue(activePool_VST_Before_Asset.eq(aliceDebtBefore_Asset))

      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, await getNetBorrowingAmount(dec(10000, 18), ZERO_ADDRESS), alice, alice, { from: alice })
      await borrowerOperations.withdrawVST(erc20.address, th._100pct, await getNetBorrowingAmount(dec(10000, 18), erc20.address), alice, alice, { from: alice })

      // check after
      const activePool_VST_After = await activePool.getVSTDebt(ZERO_ADDRESS)
      const activePool_VST_After_Asset = await activePool.getVSTDebt(erc20.address)
      th.assertIsApproximatelyEqual(activePool_VST_After, activePool_VST_Before.add(toBN(dec(10000, 18))))
      th.assertIsApproximatelyEqual(activePool_VST_After_Asset, activePool_VST_Before_Asset.add(toBN(dec(10000, 18))))
    })

    it("withdrawVST(): increases user VSTToken balance by correct amount", async () => {
      await openTrove({ extraParams: { value: toBN(dec(100, 'ether')), from: alice } })
      await openTrove({ asset: erc20.address, assetSent: toBN(dec(100, 'ether')), extraParams: { from: alice } })

      // check before
      let alice_VSTTokenBalance_Before = await vstToken.balanceOf(alice)
      assert.isTrue(alice_VSTTokenBalance_Before.gt(toBN('0')))

      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(10000, 18), alice, alice, { from: alice })

      let alice_VSTTokenBalance_After = await vstToken.balanceOf(alice)
      assert.isTrue(alice_VSTTokenBalance_After.eq(alice_VSTTokenBalance_Before.add(toBN(dec(10000, 18)))))
      alice_VSTTokenBalance_Before = await vstToken.balanceOf(alice)

      await borrowerOperations.withdrawVST(erc20.address, th._100pct, dec(10000, 18), alice, alice, { from: alice })

      alice_VSTTokenBalance_After = await vstToken.balanceOf(alice)
      assert.isTrue(alice_VSTTokenBalance_After.eq(alice_VSTTokenBalance_Before.add(toBN(dec(10000, 18)))))
    })

    // --- repayVST() ---
    it("repayVST(): reverts when repayment would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode(ZERO_ADDRESS, price))
      assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).lt(toBN(dec(110, 16))))

      assert.isFalse(await troveManager.checkRecoveryMode(erc20.address, price))
      assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).lt(toBN(dec(110, 16))))

      const VSTRepayment = 1  // 1 wei repayment

      await assertRevert(borrowerOperations.repayVST(ZERO_ADDRESS, VSTRepayment, alice, alice, { from: alice }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
      await assertRevert(borrowerOperations.repayVST(erc20.address, VSTRepayment, alice, alice, { from: alice }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("repayVST(): Succeeds when it would leave trove with net debt >= minimum net debt", async () => {
      // Make the VST request 2 wei above min net debt to correct for floor division, and make net debt = min net debt + 1 wei
      await borrowerOperations
        .openTrove(ZERO_ADDRESS, 0, th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('2')), ZERO_ADDRESS), A, A, { from: A, value: dec(100, 30) })

      await borrowerOperations
        .openTrove(erc20.address, dec(100, 30), th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT_ERC20.add(toBN('2')), erc20.address), A, A, { from: A })

      const repayTxA = await borrowerOperations.repayVST(ZERO_ADDRESS, 1, A, A, { from: A })
      const repayTxA_Asset = await borrowerOperations.repayVST(erc20.address, 1, A, A, { from: A })
      assert.isTrue(repayTxA.receipt.status)
      assert.isTrue(repayTxA_Asset.receipt.status)

      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, dec(20, 25), B, B, { from: B, value: dec(100, 30) })
      await borrowerOperations.openTrove(erc20.address, dec(100, 30), th._100pct, dec(20, 25), B, B, { from: B })

      const repayTxB = await borrowerOperations.repayVST(ZERO_ADDRESS, dec(19, 25), B, B, { from: B })
      const repayTxB_Asset = await borrowerOperations.repayVST(erc20.address, dec(19, 25), B, B, { from: B })
      assert.isTrue(repayTxB.receipt.status)
      assert.isTrue(repayTxB_Asset.receipt.status)
    })

    it("repayVST(): reverts when it would leave trove with net debt < minimum net debt", async () => {
      // Make the VST request 2 wei above min net debt to correct for floor division, and make net debt = min net debt + 1 wei
      await borrowerOperations
        .openTrove(ZERO_ADDRESS, 0, th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('2')), ZERO_ADDRESS), A, A, { from: A, value: dec(100, 30) })
      await borrowerOperations
        .openTrove(erc20.address, dec(100, 30), th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT_ERC20.add(toBN('2')), erc20.address), A, A, { from: A })

      const repayTxAPromise = borrowerOperations.repayVST(ZERO_ADDRESS, 2, A, A, { from: A })
      const repayTxAPromise_Asset = borrowerOperations.repayVST(erc20.address, 2, A, A, { from: A })
      await assertRevert(repayTxAPromise, "BorrowerOps: Trove's net debt must be greater than minimum")
      await assertRevert(repayTxAPromise_Asset, "BorrowerOps: Trove's net debt must be greater than minimum")
    })

    it("repayVST(): reverts when calling address does not have active trove", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      // Bob successfully repays some VST
      const txBob = await borrowerOperations.repayVST(ZERO_ADDRESS, dec(10, 18), bob, bob, { from: bob })
      const txBob_Asset = await borrowerOperations.repayVST(erc20.address, dec(10, 18), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)
      assert.isTrue(txBob_Asset.receipt.status)

      // Carol with no active trove attempts to withdrawVST
      try {
        const txCarol = await borrowerOperations.repayVST(ZERO_ADDRESS, dec(10, 18), carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try {
        const txCarol_Asset = await borrowerOperations.repayVST(erc20.address, dec(10, 18), carol, carol, { from: carol })
        assert.isFalse(txCarol_Asset.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("repayVST(): reverts when attempted repayment is > the debt of the trove", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebt = await getTroveEntireDebt(alice)
      const aliceDebt_Asset = await getTroveEntireDebt(alice, erc20.address)

      // Bob successfully repays some VST
      const txBob = await borrowerOperations.repayVST(ZERO_ADDRESS, dec(10, 18), bob, bob, { from: bob })
      const txBob_Asset = await borrowerOperations.repayVST(erc20.address, dec(10, 18), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)
      assert.isTrue(txBob_Asset.receipt.status)

      // Alice attempts to repay more than her debt
      try {
        const txAlice = await borrowerOperations.repayVST(ZERO_ADDRESS, aliceDebt.add(toBN(dec(1, 18))), alice, alice, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try {
        const txAlice_Asset = await borrowerOperations.repayVST(erc20.address, aliceDebt_Asset.add(toBN(dec(1, 18))), alice, alice, { from: alice })
        assert.isFalse(txAlice_Asset.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    //withdrawVST: reduces VST debt in Trove
    it("repayVST(): reduces the Trove's VST debt by the correct amount", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      const aliceDebtBefore_Asset = await getTroveEntireDebt(alice, erc20.address)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))
      assert.isTrue(aliceDebtBefore_Asset.gt(toBN('0')))

      await borrowerOperations.repayVST(ZERO_ADDRESS, aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt
      await borrowerOperations.repayVST(erc20.address, aliceDebtBefore_Asset.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt

      const aliceDebtAfter = await getTroveEntireDebt(alice)
      const aliceDebtAfter_Asset = await getTroveEntireDebt(alice, erc20.address)
      assert.isTrue(aliceDebtAfter.gt(toBN('0')))
      assert.isTrue(aliceDebtAfter_Asset.gt(toBN('0')))

      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.mul(toBN(9)).div(toBN(10)))  // check 9/10 debt remaining
      th.assertIsApproximatelyEqual(aliceDebtAfter_Asset, aliceDebtBefore_Asset.mul(toBN(9)).div(toBN(10)))  // check 9/10 debt remaining
    })

    it("repayVST(): decreases VST debt in ActivePool by correct amount", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      const aliceDebtBefore_Asset = await getTroveEntireDebt(alice, erc20.address)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))
      assert.isTrue(aliceDebtBefore_Asset.gt(toBN('0')))

      // Check before
      const activePool_VST_Before = await activePool.getVSTDebt(ZERO_ADDRESS)
      const activePool_VST_Before_Asset = await activePool.getVSTDebt(erc20.address)
      assert.isTrue(activePool_VST_Before.gt(toBN('0')))
      assert.isTrue(activePool_VST_Before_Asset.gt(toBN('0')))

      await borrowerOperations.repayVST(ZERO_ADDRESS, aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt
      await borrowerOperations.repayVST(erc20.address, aliceDebtBefore_Asset.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt

      // check after
      const activePool_VST_After = await activePool.getVSTDebt(ZERO_ADDRESS)
      const activePool_VST_After_Asset = await activePool.getVSTDebt(erc20.address)
      th.assertIsApproximatelyEqual(activePool_VST_After, activePool_VST_Before.sub(aliceDebtBefore.div(toBN(10))))
      th.assertIsApproximatelyEqual(activePool_VST_After_Asset, activePool_VST_Before_Asset.sub(aliceDebtBefore_Asset.div(toBN(10))))
    })

    it("repayVST(): decreases user VSTToken balance by correct amount", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      const aliceDebtBefore_Asset = await getTroveEntireDebt(alice, erc20.address)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))
      assert.isTrue(aliceDebtBefore_Asset.gt(toBN('0')))

      let alice_VSTTokenBalance_Before = await vstToken.balanceOf(alice)
      assert.isTrue(alice_VSTTokenBalance_Before.gt(toBN('0')))

      await borrowerOperations.repayVST(ZERO_ADDRESS, aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt

      let alice_VSTTokenBalance_After = await vstToken.balanceOf(alice)
      th.assertIsApproximatelyEqual(alice_VSTTokenBalance_After, alice_VSTTokenBalance_Before.sub(aliceDebtBefore.div(toBN(10))))
      alice_VSTTokenBalance_Before = await vstToken.balanceOf(alice)

      await borrowerOperations.repayVST(erc20.address, aliceDebtBefore_Asset.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt

      alice_VSTTokenBalance_After = await vstToken.balanceOf(alice)
      th.assertIsApproximatelyEqual(alice_VSTTokenBalance_After, alice_VSTTokenBalance_Before.sub(aliceDebtBefore_Asset.div(toBN(10))))
    })

    it('repayVST(): can repay debt in Recovery Mode', async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      const aliceDebtBefore = await getTroveEntireDebt(alice)
      const aliceDebtBefore_Asset = await getTroveEntireDebt(alice, erc20.address)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))
      assert.isTrue(aliceDebtBefore_Asset.gt(toBN('0')))

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await priceFeed.setPrice('105000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      const tx = await borrowerOperations.repayVST(ZERO_ADDRESS, aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })
      const tx_Asset = await borrowerOperations.repayVST(erc20.address, aliceDebtBefore_Asset.div(toBN(10)), alice, alice, { from: alice })
      assert.isTrue(tx.receipt.status)
      assert.isTrue(tx_Asset.receipt.status)

      // Check Alice's debt: 110 (initial) - 50 (repaid)
      const aliceDebtAfter = await getTroveEntireDebt(alice)
      const aliceDebtAfter_Asset = await getTroveEntireDebt(alice, erc20.address)
      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.mul(toBN(9)).div(toBN(10)))
      th.assertIsApproximatelyEqual(aliceDebtAfter_Asset, aliceDebtBefore_Asset.mul(toBN(9)).div(toBN(10)))
    })

    it("repayVST(): Reverts if borrower has insufficient VST balance to cover his debt repayment", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })

      const bobBalBefore = await vstToken.balanceOf(B)
      assert.isTrue(bobBalBefore.gt(toBN('0')))

      // Bob transfers all but 5 of his VST to Carol
      await vstToken.transfer(C, bobBalBefore.sub((toBN(dec(5, 18)))), { from: B })

      //Confirm B's VST balance has decreased to 5 VST
      const bobBalAfter = await vstToken.balanceOf(B)

      assert.isTrue(bobBalAfter.eq(toBN(dec(5, 18))))

      // Bob tries to repay 6 VST
      const repayVSTPromise_B = borrowerOperations.repayVST(ZERO_ADDRESS, toBN(dec(6, 18)), B, B, { from: B })
      const repayVSTPromise_B_Asset = borrowerOperations.repayVST(erc20.address, toBN(dec(6, 18)), B, B, { from: B })

      await assertRevert(repayVSTPromise_B, "Caller doesnt have enough VST to make repayment")
      await assertRevert(repayVSTPromise_B_Asset, "Caller doesnt have enough VST to make repayment")
    })

    // --- adjustTrove() ---

    it("adjustTrove(): reverts when adjustment would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode(ZERO_ADDRESS, price))
      assert.isFalse(await troveManager.checkRecoveryMode(erc20.address, price))
      assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).lt(toBN(dec(110, 16))))
      assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).lt(toBN(dec(110, 16))))

      const VSTRepayment = 1  // 1 wei repayment
      const collTopUp = 1

      await assertRevert(borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, VSTRepayment, false, alice, alice, { from: alice, value: collTopUp }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
      await assertRevert(borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, VSTRepayment, false, alice, alice, { from: alice, value: collTopUp }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("adjustTrove(): reverts if max fee < 0.5% in Normal mode", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })

      await assertRevert(borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, 0, 0, dec(1, 18), true, A, A, { from: A, value: dec(2, 16) }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, 1, 0, dec(1, 18), true, A, A, { from: A, value: dec(2, 16) }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, '4999999999999999', 0, dec(1, 18), true, A, A, { from: A, value: dec(2, 16) }), "Max fee percentage must be between 0.5% and 100%")

      await assertRevert(borrowerOperations.adjustTrove(erc20.address, dec(2, 16), 0, 0, dec(1, 18), true, A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.adjustTrove(erc20.address, dec(2, 16), 1, 0, dec(1, 18), true, A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.adjustTrove(erc20.address, dec(2, 16), '4999999999999999', 0, dec(1, 18), true, A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("adjustTrove(): allows max fee < 0.5% in Recovery mode", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: toBN(dec(100, 'ether')) } })
      await openTrove({ asset: erc20.address, assetSent: toBN(dec(100, 'ether')), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })

      await priceFeed.setPrice(dec(120, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, 0, 0, dec(1, 9), true, A, A, { from: A, value: dec(300, 18) })
      await borrowerOperations.adjustTrove(erc20.address, dec(300, 18), 0, 0, dec(1, 9), true, A, A, { from: A })
      await priceFeed.setPrice(dec(1, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, 1, 0, dec(1, 9), true, A, A, { from: A, value: dec(30000, 18) })
      await borrowerOperations.adjustTrove(erc20.address, dec(30000, 18), 1, 0, dec(1, 9), true, A, A, { from: A })
      await priceFeed.setPrice(dec(1, 16))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, '4999999999999999', 0, dec(1, 9), true, A, A, { from: A, value: dec(3000000, 18) })
      await borrowerOperations.adjustTrove(erc20.address, dec(3000000, 18), '4999999999999999', 0, dec(1, 9), true, A, A, { from: A })
    })

    it("adjustTrove(): decays a non-zero base rate", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1.gt(toBN('0')))
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(37, 18), true, D, D, { from: D })
      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check baseRate has decreased
      const baseRate_2 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_2.lt(baseRate_1))
      const baseRate_2_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_2_Asset.lt(baseRate_1_Asset))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E adjusts trove
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(37, 15), true, E, E, { from: D })
      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, dec(37, 15), true, E, E, { from: D })

      const baseRate_3 = await troveManager.baseRate(ZERO_ADDRESS)
      const baseRate_3_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_3.lt(baseRate_2))
      assert.isTrue(baseRate_3_Asset.lt(baseRate_2_Asset))
    })

    it("adjustTrove(): doesn't decay a non-zero base rate when user issues 0 debt", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // D opens trove 
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_1.gt(toBN('0')))
      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove with 0 debt
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, 0, false, D, D, { from: D, value: dec(1, 'ether') })
      await borrowerOperations.adjustTrove(erc20.address, dec(1, 'ether'), th._100pct, 0, 0, false, D, D, { from: D })

      // Check baseRate has not decreased 
      const baseRate_2 = await troveManager.baseRate(ZERO_ADDRESS)
      const baseRate_2_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_2.eq(baseRate_1))
      assert.isTrue(baseRate_2_Asset.eq(baseRate_1_Asset))
    })

    it("adjustTrove(): doesn't change base rate if it is already zero", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.equal(baseRate_1, '0')
      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.equal(baseRate_1_Asset, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(37, 18), true, D, D, { from: D })
      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check baseRate is still 0
      const baseRate_2 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.equal(baseRate_2, '0')
      const baseRate_2_Asset = await troveManager.baseRate(erc20.address)
      assert.equal(baseRate_2_Asset, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E adjusts trove
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(37, 15), true, E, E, { from: D })
      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, dec(37, 15), true, E, E, { from: D })

      const baseRate_3 = await troveManager.baseRate(ZERO_ADDRESS)
      const baseRate_3_Asset = await troveManager.baseRate(erc20.address)
      assert.equal(baseRate_3_Asset, '0')
    })

    it("adjustTrove(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1.gt(toBN('0')))
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime(ZERO_ADDRESS)
      const lastFeeOpTime_1_Asset = await troveManager.lastFeeOperationTime(erc20.address)

      // 10 seconds pass
      th.fastForwardTime(10, web3.currentProvider)

      // Borrower C triggers a fee
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(1, 18), true, C, C, { from: C })
      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, dec(1, 18), true, C, C, { from: C })

      const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime(ZERO_ADDRESS)
      const lastFeeOpTime_2_Asset = await troveManager.lastFeeOperationTime(erc20.address)

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))
      assert.isTrue(lastFeeOpTime_2_Asset.eq(lastFeeOpTime_1_Asset))

      // 60 seconds passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(60))

      // Borrower C triggers a fee
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(1, 18), true, C, C, { from: C })
      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, dec(1, 18), true, C, C, { from: C })

      const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime(ZERO_ADDRESS)
      const lastFeeOpTime_3_Asset = await troveManager.lastFeeOperationTime(erc20.address)

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
      assert.isTrue(lastFeeOpTime_3_Asset.gt(lastFeeOpTime_1_Asset))
    })

    it("adjustTrove(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // Borrower C triggers a fee, before decay interval of 1 minute has passed
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(1, 18), true, C, C, { from: C })

      // 1 minute passes
      th.fastForwardTime(60, web3.currentProvider)

      // Borrower C triggers another fee
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(1, 18), true, C, C, { from: C })

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_2.lt(baseRate_1))
    })

    it("adjustTrove(): borrowing at non-zero base rate sends VST fee to VSTA staking contract", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 VSTA
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
      await vstaStaking.stake(dec(1, 18), { from: multisig })

      // Check VSTA VST balance before == 0
      const VSTAStaking_VSTBalance_Before = await vstToken.balanceOf(vstaStaking.address)
      assert.equal(VSTAStaking_VSTBalance_Before, '0')

      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      await openTrove({ extraVSTAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check VSTA VST balance after has increased
      const VSTAStaking_VSTBalance_After = await vstToken.balanceOf(vstaStaking.address)
      assert.isTrue(VSTAStaking_VSTBalance_After.gt(VSTAStaking_VSTBalance_Before))
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("adjustTrove(): borrowing at non-zero base records the (drawn debt + fee) on the Trove struct", async () => {
        // time fast-forwards 1 year, and multisig stakes 1 VSTA
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
        await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
        await vstaStaking.stake(dec(1, 18), { from: multisig })

        await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
        await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

        await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
        const D_debtBefore = await getTroveEntireDebt(D)
        const D_debtBefore_Asset = await getTroveEntireDebt(D, erc20.address)

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)
        await troveManager.setBaseRate(erc20.address, dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow(erc20.address)

        // Check baseRate is now non-zero
        const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
        assert.isTrue(baseRate_1.gt(toBN('0')))

        const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
        assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        const withdrawal_D = toBN(dec(37, 18))

        // D withdraws VST
        const adjustmentTx = await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, withdrawal_D, true, D, D, { from: D })
        const adjustmentTx_Asset = await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, withdrawal_D, true, D, D, { from: D })

        const emittedFee = toBN(th.getVSTFeeFromVSTBorrowingEvent(adjustmentTx))
        assert.isTrue(emittedFee.gt(toBN('0')))

        const emittedFee_Asset = toBN(th.getVSTFeeFromVSTBorrowingEvent(adjustmentTx_Asset))
        assert.isTrue(emittedFee_Asset.gt(toBN('0')))

        const D_newDebt = (await troveManager.Troves(D, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]
        const D_newDebt_Asset = (await troveManager.Troves(D, erc20.address))[th.TROVE_DEBT_INDEX]

        // Check debt on Trove struct equals initila debt plus drawn debt plus emitted fee
        assert.isTrue(D_newDebt.eq(D_debtBefore.add(withdrawal_D).add(emittedFee)))
        assert.isTrue(D_newDebt_Asset.eq(D_debtBefore_Asset.add(withdrawal_D).add(emittedFee_Asset)))
      })
    }

    it("adjustTrove(): Borrowing at non-zero base rate increases the VSTA staking contract VST fees-per-unit-staked", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 VSTA
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
      await vstaStaking.stake(dec(1, 18), { from: multisig })

      // Check VSTA contract VST fees-per-unit-staked is zero
      const F_VST_Before = await vstaStaking.F_VST()
      assert.equal(F_VST_Before, '0')

      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      const F_VST_After = await vstaStaking.F_VST()
      assert.isTrue(F_VST_After.gt(F_VST_Before))

      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      const F_VST_After_Asset = await vstaStaking.F_VST()
      assert.isTrue(F_VST_After_Asset.gt(F_VST_After))
    })

    it("adjustTrove(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 VSTA
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
      await vstaStaking.stake(dec(1, 18), { from: multisig })

      // Check VSTA Staking contract balance before == 0
      const VSTAStaking_VSTBalance_Before = await vstToken.balanceOf(vstaStaking.address)
      assert.equal(VSTAStaking_VSTBalance_Before, '0')

      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      const D_VSTBalanceBefore = await vstToken.balanceOf(D)

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      const VSTRequest_D = toBN(dec(40, 18))
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, VSTRequest_D, true, D, D, { from: D })

      // Check VSTA staking VST balance has increased
      const VSTAStaking_VSTBalance_After = await vstToken.balanceOf(vstaStaking.address)
      assert.isTrue(VSTAStaking_VSTBalance_After.gt(VSTAStaking_VSTBalance_Before))

      // Check D's VST balance has increased by their requested VST
      const D_VSTBalanceAfter = await vstToken.balanceOf(D)
      assert.isTrue(D_VSTBalanceAfter.eq(D_VSTBalanceBefore.add(VSTRequest_D)))

      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, VSTRequest_D, true, D, D, { from: D })

      // Check VSTA staking VST balance has increased
      const VSTAStaking_VSTBalance_After_Asset = await vstToken.balanceOf(vstaStaking.address)
      assert.isTrue(VSTAStaking_VSTBalance_After_Asset.gt(VSTAStaking_VSTBalance_After))

      // Check D's VST balance has increased by their requested VST
      const D_VSTBalanceAfter_Asset = await vstToken.balanceOf(D)
      assert.isTrue(D_VSTBalanceAfter_Asset.eq(D_VSTBalanceAfter.add(VSTRequest_D)))
    })

    it("adjustTrove(): Borrowing at zero base rate changes VST balance of VSTA staking contract", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.equal(baseRate_1, '0')

      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.equal(baseRate_1_Asset, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // Check staking VST balance before > 0
      const VSTAStaking_VSTBalance_Before = await vstToken.balanceOf(vstaStaking.address)
      assert.isTrue(VSTAStaking_VSTBalance_Before.gt(toBN('0')))

      // D adjusts trove
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(37, 18), true, D, D, { from: D })
      const VSTAStaking_VSTBalance_After = await vstToken.balanceOf(vstaStaking.address)
      assert.isTrue(VSTAStaking_VSTBalance_After.gt(VSTAStaking_VSTBalance_Before))

      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, dec(37, 18), true, D, D, { from: D })
      const VSTAStaking_VSTBalance_After_Asset = await vstToken.balanceOf(vstaStaking.address)
      assert.isTrue(VSTAStaking_VSTBalance_After_Asset.gt(VSTAStaking_VSTBalance_After))
    })

    it("adjustTrove(): Borrowing at zero base rate changes VSTA staking contract VST fees-per-unit-staked", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: toBN(dec(100, 'ether')) } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ asset: erc20.address, assetSent: toBN(dec(100, 'ether')), extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.equal(baseRate_1, '0')

      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.equal(baseRate_1_Asset, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // A artificially receives VSTA, then stakes it
      await vstaToken.unprotectedMint(A, dec(100, 18))
      await vstaStaking.stake(dec(100, 18), { from: A })

      // Check staking VST balance before == 0
      const F_VST_Before = await vstaStaking.F_VST()
      assert.isTrue(F_VST_Before.eq(toBN('0')))

      // D adjusts trove
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(37, 18), true, D, D, { from: D })
      const F_VST_After = await vstaStaking.F_VST()
      assert.isTrue(F_VST_After.gt(F_VST_Before))

      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      const F_VST_After_Asset = await vstaStaking.F_VST()
      assert.isTrue(F_VST_After_Asset.gt(F_VST_After))
    })

    it("adjustTrove(): Borrowing at zero base rate sends total requested VST to the user", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: toBN(dec(100, 'ether')) } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })


      await openTrove({ asset: erc20.address, assetSent: toBN(dec(100, 'ether')), extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      const D_VSTBalBefore = await vstToken.balanceOf(D)
      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.equal(baseRate_1, '0')

      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.equal(baseRate_1_Asset, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      const VSTRequest_D = toBN(dec(40, 18))
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, VSTRequest_D, true, D, D, { from: D })

      const VSTBalanceAfter = await vstToken.balanceOf(D)
      assert.isTrue(VSTBalanceAfter.eq(D_VSTBalBefore.add(VSTRequest_D)))

      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, VSTRequest_D, true, D, D, { from: D })
      const VSTBalanceAfter_Asset = await vstToken.balanceOf(D)
      assert.isTrue(VSTBalanceAfter_Asset.eq(VSTBalanceAfter.add(VSTRequest_D)))

    })

    it("adjustTrove(): reverts when calling address has no active trove", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Alice coll and debt increase(+1 ETH, +50VST)
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.adjustTrove(erc20.address, dec(1, 'ether'), th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice })

      try {
        const txCarol = await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(50, 18), true, carol, carol, { from: carol, value: dec(1, 'ether') })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try {
        const txCarolAsset = await borrowerOperations.adjustTrove(ZERO_ADDRESS, dec(1, 'ether'), th._100pct, 0, dec(50, 18), true, carol, carol, { from: carol })
        assert.isFalse(txCarolAsset.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): reverts in Recovery Mode when the adjustment would reduce the TCR", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      const txAlice = await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })
      assert.isTrue(txAlice.receipt.status)

      const txAliceAsset = await borrowerOperations.adjustTrove(erc20.address, dec(1, 'ether'), th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice })
      assert.isTrue(txAliceAsset.receipt.status)

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      try { // collateral withdrawal should also fail
        const txAlice = await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, dec(1, 'ether'), 0, false, alice, alice, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try { // collateral withdrawal should also fail
        const txAlice = await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, dec(1, 'ether'), 0, false, alice, alice, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try { // debt increase should fail
        const txBob = await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(50, 18), true, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try { // debt increase should fail
        const txBob = await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, dec(50, 18), true, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try { // debt increase that's also a collateral increase should also fail, if ICR will be worse off
        const txBob = await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(111, 18), true, bob, bob, { from: bob, value: dec(1, 'ether') })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try { // debt increase that's also a collateral increase should also fail, if ICR will be worse off
        const txBob = await borrowerOperations.adjustTrove(erc20.address, dec(1, 'ether'), th._100pct, 0, dec(111, 18), true, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): collateral withdrawal reverts in Recovery Mode", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      // Alice attempts an adjustment that repays half her debt BUT withdraws 1 wei collateral, and fails
      await assertRevert(borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 1, dec(5000, 18), false, alice, alice, { from: alice }),
        "BorrowerOps: Collateral withdrawal not permitted Recovery Mode")

      await assertRevert(borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 1, dec(5000, 18), false, alice, alice, { from: alice }),
        "BorrowerOps: Collateral withdrawal not permitted Recovery Mode")
    })


    it("adjustTrove(): debt increase that would leave ICR < 150% reverts in Recovery Mode", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      const CCR = await vestaParams.CCR(ZERO_ADDRESS)
      const CCRERC20 = await vestaParams.CCR(erc20.address)

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
      const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)

      const aliceDebt = await getTroveEntireDebt(alice)
      const aliceColl = await getTroveEntireColl(alice)
      const aliceDebt_Asset = await getTroveEntireDebt(alice, erc20.address)
      const aliceColl_Asset = await getTroveEntireColl(alice, erc20.address)

      const debtIncrease = toBN(dec(50, 18))
      const collIncrease = toBN(dec(1, 'ether'))

      // Check the new ICR would be an improvement, but less than the CCR (150%)
      const newICR = await troveManager.computeICR(aliceColl.add(collIncrease), aliceDebt.add(debtIncrease), price)
      const newICR_Asset = await troveManager.computeICR(aliceColl_Asset.add(collIncrease), aliceDebt_Asset.add(debtIncrease), price)

      assert.isTrue(newICR.gt(ICR_A) && newICR.lt(CCR))
      assert.isTrue(newICR_Asset.gt(ICR_A_Asset) && newICR_Asset.lt(CCRERC20))

      await assertRevert(borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, debtIncrease, true, alice, alice, { from: alice, value: collIncrease }),
        "BorrowerOps: Operation must leave trove with ICR >= CCR")
      await assertRevert(borrowerOperations.adjustTrove(erc20.address, collIncrease, th._100pct, 0, debtIncrease, true, alice, alice, { from: alice }),
        "BorrowerOps: Operation must leave trove with ICR >= CCR")
    })

    it("adjustTrove(): debt increase that would reduce the ICR reverts in Recovery Mode", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const CCR = await vestaParams.CCR(ZERO_ADDRESS)
      const CCRERC20 = await vestaParams.CCR(erc20.address)

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await priceFeed.setPrice(dec(105, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      //--- Alice with ICR > 150% tries to reduce her ICR ---

      const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
      const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)

      // Check Alice's initial ICR is above 150%
      assert.isTrue(ICR_A.gt(CCR))
      assert.isTrue(ICR_A_Asset.gt(CCRERC20))

      const aliceDebt = await getTroveEntireDebt(alice)
      const aliceColl = await getTroveEntireColl(alice)
      const aliceDebt_Asset = await getTroveEntireDebt(alice, erc20.address)
      const aliceColl_Asset = await getTroveEntireColl(alice, erc20.address)

      const aliceDebtIncrease = toBN(dec(150, 18))
      const aliceCollIncrease = toBN(dec(1, 'ether'))

      const newICR_A = await troveManager.computeICR(aliceColl.add(aliceCollIncrease), aliceDebt.add(aliceDebtIncrease), price)
      const newICR_A_Asset = await troveManager.computeICR(aliceColl_Asset.add(aliceCollIncrease), aliceDebt_Asset.add(aliceDebtIncrease), price)

      // Check Alice's new ICR would reduce but still be greater than 150%
      assert.isTrue(newICR_A.lt(ICR_A) && newICR_A.gt(CCR))
      assert.isTrue(newICR_A_Asset.lt(ICR_A_Asset) && newICR_A_Asset.gt(CCRERC20))

      await assertRevert(borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, aliceDebtIncrease, true, alice, alice, { from: alice, value: aliceCollIncrease }),
        "BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode")
      await assertRevert(borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, aliceCollIncrease, aliceDebtIncrease, true, alice, alice, { from: alice }),
        "BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode")

      //--- Bob with ICR < 150% tries to reduce his ICR ---

      const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
      const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)

      // Check Bob's initial ICR is below 150%
      assert.isTrue(ICR_B.lt(CCR))
      assert.isTrue(ICR_B_Asset.lt(CCRERC20))

      const bobDebt = await getTroveEntireDebt(bob)
      const bobColl = await getTroveEntireColl(bob)
      const bobDebt_Asset = await getTroveEntireDebt(bob, erc20.address)
      const bobColl_Asset = await getTroveEntireColl(bob, erc20.address)

      const bobDebtIncrease = toBN(dec(450, 18))
      const bobCollIncrease = toBN(dec(1, 'ether'))

      const newICR_B = await troveManager.computeICR(bobColl.add(bobCollIncrease), bobDebt.add(bobDebtIncrease), price)
      const newICR_B_Asset = await troveManager.computeICR(bobColl_Asset.add(bobCollIncrease), bobDebt_Asset.add(bobDebtIncrease), price)

      // Check Bob's new ICR would reduce 
      assert.isTrue(newICR_B.lt(ICR_B))
      assert.isTrue(newICR_B_Asset.lt(ICR_B_Asset))

      await assertRevert(borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, bobDebtIncrease, true, bob, bob, { from: bob, value: bobCollIncrease }),
        " BorrowerOps: Operation must leave trove with ICR >= CCR")

      await assertRevert(borrowerOperations.adjustTrove(erc20.address, bobCollIncrease, th._100pct, 0, bobDebtIncrease, true, bob, bob, { from: bob }),
        " BorrowerOps: Operation must leave trove with ICR >= CCR")
    })

    it("adjustTrove(): A trove with ICR < CCR in Recovery Mode can adjust their trove to ICR > CCR", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const CCR = await vestaParams.CCR(ZERO_ADDRESS)
      const CCRERC20 = await vestaParams.CCR(erc20.address)

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await priceFeed.setPrice(dec(100, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
      const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
      // Check initial ICR is below 150%
      assert.isTrue(ICR_A.lt(CCR))
      assert.isTrue(ICR_A_Asset.lt(CCRERC20))

      const aliceDebt = await getTroveEntireDebt(ZERO_ADDRESS, alice)
      const aliceColl = await getTroveEntireColl(ZERO_ADDRESS, alice)
      const aliceDebt_Asset = await getTroveEntireDebt(erc20.address, alice)
      const aliceColl_Asset = await getTroveEntireColl(erc20.address, alice)

      const debtIncrease = toBN(dec(5000, 18))
      const collIncrease = toBN(dec(150, 'ether'))

      const newICR = await troveManager.computeICR(aliceColl.add(collIncrease), aliceDebt.add(debtIncrease), price)
      const newICR_Asset = await troveManager.computeICR(aliceColl_Asset.add(collIncrease), aliceDebt_Asset.add(debtIncrease), price)

      // Check new ICR would be > 150%
      assert.isTrue(newICR.gt(CCR))
      assert.isTrue(newICR_Asset.gt(CCRERC20))

      const tx = await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, debtIncrease, true, alice, alice, { from: alice, value: collIncrease })
      assert.isTrue(tx.receipt.status)

      const tx_Asset = await borrowerOperations.adjustTrove(erc20.address, collIncrease, th._100pct, 0, debtIncrease, true, alice, alice, { from: alice })
      assert.isTrue(tx_Asset.receipt.status)

      const actualNewICR = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
      assert.isTrue(actualNewICR.gt(CCR))

      const actualNewICR_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
      assert.isTrue(actualNewICR_Asset.gt(CCRERC20))
    })

    it("adjustTrove(): A trove with ICR < CCR in Recovery Mode can adjust their trove to ICR > CCR But collateral is blocked from minting, then unblock it", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const CCR = await vestaParams.CCR(ZERO_ADDRESS)
      const CCRERC20 = await vestaParams.CCR(erc20.address)

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await priceFeed.setPrice(dec(100, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
      const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
      // Check initial ICR is below 150%
      assert.isTrue(ICR_A.lt(CCR))
      assert.isTrue(ICR_A_Asset.lt(CCRERC20))

      const aliceDebt = await getTroveEntireDebt(ZERO_ADDRESS, alice)
      const aliceColl = await getTroveEntireColl(ZERO_ADDRESS, alice)
      const aliceDebt_Asset = await getTroveEntireDebt(erc20.address, alice)
      const aliceColl_Asset = await getTroveEntireColl(erc20.address, alice)

      const debtIncrease = toBN(dec(5000, 18))
      const collIncrease = toBN(dec(150, 'ether'))

      const newICR = await troveManager.computeICR(aliceColl.add(collIncrease), aliceDebt.add(debtIncrease), price)
      const newICR_Asset = await troveManager.computeICR(aliceColl_Asset.add(collIncrease), aliceDebt_Asset.add(debtIncrease), price)

      // Check new ICR would be > 150%
      assert.isTrue(newICR.gt(CCR))
      assert.isTrue(newICR_Asset.gt(CCRERC20))

      await contracts.vstToken.emergencyStopMinting(erc20.address, true);
      await contracts.vstToken.emergencyStopMinting(ZERO_ADDRESS, true);

      await assertRevert(borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, debtIncrease, true, alice, alice, { from: alice, value: collIncrease }),
        " Mint is blocked on this collateral")

      await assertRevert(borrowerOperations.adjustTrove(erc20.address, collIncrease, th._100pct, 0, debtIncrease, true, alice, alice, { from: alice }),
        " Mint is blocked on this collateral")

      await contracts.vstToken.emergencyStopMinting(erc20.address, false);
      await contracts.vstToken.emergencyStopMinting(ZERO_ADDRESS, false);

      const tx = await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, debtIncrease, true, alice, alice, { from: alice, value: collIncrease })
      assert.isTrue(tx.receipt.status)

      const tx_Asset = await borrowerOperations.adjustTrove(erc20.address, collIncrease, th._100pct, 0, debtIncrease, true, alice, alice, { from: alice })
      assert.isTrue(tx_Asset.receipt.status)

      const actualNewICR = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
      assert.isTrue(actualNewICR.gt(CCR))

      const actualNewICR_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
      assert.isTrue(actualNewICR_Asset.gt(CCRERC20))
    })

    it("adjustTrove(): A trove with ICR > CCR in Recovery Mode can improve their ICR", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const CCR = await vestaParams.CCR(ZERO_ADDRESS)
      const CCRERC20 = await vestaParams.CCR(erc20.address)

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await priceFeed.setPrice(dec(105, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      const initialICR = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
      const initialICR_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
      // Check initial ICR is above 150%
      assert.isTrue(initialICR.gt(CCR))
      assert.isTrue(initialICR_Asset.gt(CCRERC20))

      const aliceDebt = await getTroveEntireDebt(alice)
      const aliceColl = await getTroveEntireColl(alice)
      const aliceDebt_Asset = await getTroveEntireDebt(alice, erc20.address)
      const aliceColl_Asset = await getTroveEntireColl(alice, erc20.address)

      const debtIncrease = toBN(dec(5000, 18))
      const collIncrease = toBN(dec(150, 'ether'))

      const newICR = await troveManager.computeICR(aliceColl.add(collIncrease), aliceDebt.add(debtIncrease), price)
      const newICR_Asset = await troveManager.computeICR(aliceColl_Asset.add(collIncrease), aliceDebt_Asset.add(debtIncrease), price)

      // Check new ICR would be > old ICR
      assert.isTrue(newICR.gt(initialICR))
      assert.isTrue(newICR_Asset.gt(initialICR_Asset))

      const tx = await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, debtIncrease, true, alice, alice, { from: alice, value: collIncrease })
      assert.isTrue(tx.receipt.status)

      const tx_Asset = await borrowerOperations.adjustTrove(erc20.address, collIncrease, th._100pct, 0, debtIncrease, true, alice, alice, { from: alice })
      assert.isTrue(tx_Asset.receipt.status)

      const actualNewICR = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
      assert.isTrue(actualNewICR.gt(initialICR))

      const actualNewICR_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
      assert.isTrue(actualNewICR_Asset.gt(initialICR_Asset))
    })

    it("adjustTrove(): debt increase in Recovery Mode charges no fee", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(200000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(200000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      // B stakes VSTA
      await vstaToken.unprotectedMint(bob, dec(100, 18))
      await vstaStaking.stake(dec(100, 18), { from: bob })

      const VSTAStakingVSTBalanceBefore = await vstToken.balanceOf(vstaStaking.address)
      assert.isTrue(VSTAStakingVSTBalanceBefore.gt(toBN('0')))

      const txAlice = await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: dec(100, 'ether') })
      assert.isTrue(txAlice.receipt.status)

      const txAlice_Asset = await borrowerOperations.adjustTrove(erc20.address, dec(100, 'ether'), th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice })
      assert.isTrue(txAlice_Asset.receipt.status)

      // Check emitted fee = 0
      const emittedFee = toBN(await th.getEventArgByName(txAlice, 'VSTBorrowingFeePaid', '_VSTFee'))
      assert.isTrue(emittedFee.eq(toBN('0')))

      const emittedFee_Asset = toBN(await th.getEventArgByName(txAlice_Asset, 'VSTBorrowingFeePaid', '_VSTFee'))
      assert.isTrue(emittedFee_Asset.eq(toBN('0')))

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      // Check no fee was sent to staking contract
      const VSTAStakingVSTBalanceAfter = await vstToken.balanceOf(vstaStaking.address)
      assert.equal(VSTAStakingVSTBalanceAfter.toString(), VSTAStakingVSTBalanceBefore.toString())
    })

    it("adjustTrove(): reverts when change would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18))

      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      // Check TCR and Recovery Mode
      const TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')

      const TCR_Asset = (await th.getTCR(contracts, erc20.address)).toString()
      assert.equal(TCR_Asset, '1500000000000000000')

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      // Bob attempts an operation that would bring the TCR below the CCR
      try {
        const txBob = await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(1, 18), true, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try {
        const txBob_Asset = await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, dec(1, 18), true, bob, bob, { from: bob })
        assert.isFalse(txBob_Asset.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): reverts when VST repaid is > debt of the trove", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const bobOpenTx = (await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })).tx

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const bobOpenTx_Asset = (await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: bob } })).tx

      const bobDebt = await getTroveEntireDebt(bob)
      assert.isTrue(bobDebt.gt(toBN('0')))

      const bobDebt_Asset = await getTroveEntireDebt(bob, erc20.address)
      assert.isTrue(bobDebt_Asset.gt(toBN('0')))

      const bobFee = toBN(await th.getEventArgByIndex(bobOpenTx, 'VSTBorrowingFeePaid', 2))
      assert.isTrue(bobFee.gt(toBN('0')))

      const bobFee_Asset = toBN(await th.getEventArgByIndex(bobOpenTx_Asset, 'VSTBorrowingFeePaid', 2))
      assert.isTrue(bobFee_Asset.gt(toBN('0')))

      // Alice transfers VST to bob to compensate borrowing fees
      await vstToken.transfer(bob, bobFee, { from: alice })

      const remainingDebt = (await troveManager.getTroveDebt(ZERO_ADDRESS, bob)).sub(VST_GAS_COMPENSATION)

      // Bob attempts an adjustment that would repay 1 wei more than his debt
      await assertRevert(
        borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, remainingDebt.add(toBN(1)), false, bob, bob, { from: bob, value: dec(1, 'ether') }),
        "revert"
      )


      // Alice transfers VST to bob to compensate borrowing fees
      await vstToken.transfer(bob, bobFee_Asset, { from: alice })

      const remainingDebt_Asset = (await troveManager.getTroveDebt(erc20.address, bob)).sub(VST_GAS_COMPENSATION_ERC20)

      // Bob attempts an adjustment that would repay 1 wei more than his debt
      await assertRevert(
        borrowerOperations.adjustTrove(erc20.address, dec(1, 'ether'), th._100pct, 0, remainingDebt_Asset.add(toBN(1)), false, bob, bob, { from: bob }),
        "revert"
      )

    })

    it("adjustTrove(): reverts when attempted ETH withdrawal is >= the trove's collateral", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      const carolColl = await getTroveEntireColl(carol)
      const carolColl_Asset = await getTroveEntireColl(carol, erc20.address)

      // Carol attempts an adjustment that would withdraw 1 wei more than her ETH
      try {
        const txCarol = await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, carolColl.add(toBN(1)), 0, true, carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      try {
        const txCarol = await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, carolColl_Asset.add(toBN(1)), 0, true, carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): reverts when change would cause the ICR of the trove to fall below the MCR", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

      await priceFeed.setPrice(dec(100, 18))

      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(11, 17)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(11, 17)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(11, 17)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(11, 17)), extraParams: { from: bob } })

      // Bob attempts to increase debt by 100 VST and 1 ether, i.e. a change that constitutes a 100% ratio of coll:debt.
      // Since his ICR prior is 110%, this change would reduce his ICR below MCR.
      try {
        const txBob = await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(100, 18), true, bob, bob, { from: bob, value: dec(1, 'ether') })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      try {
        const txBob = await borrowerOperations.adjustTrove(erc20.address, dec(1, 'ether'), th._100pct, 0, dec(100, 18), true, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): With 0 coll change, doesnt change borrower's coll or ActivePool coll", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceCollBefore = await getTroveEntireColl(alice)
      const activePoolCollBefore = await activePool.getAssetBalance(ZERO_ADDRESS)

      const aliceCollBefore_Asset = await getTroveEntireColl(alice, erc20.address)
      const activePoolCollBefore_Asset = await activePool.getAssetBalance(erc20.address)

      assert.isTrue(aliceCollBefore.gt(toBN('0')))
      assert.isTrue(aliceCollBefore.eq(activePoolCollBefore))

      assert.isTrue(aliceCollBefore_Asset.gt(toBN('0')))
      assert.isTrue(aliceCollBefore_Asset.eq(activePoolCollBefore_Asset))

      // Alice adjusts trove. No coll change, and a debt increase (+50VST)
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: 0 })
      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice })

      const aliceCollAfter = await getTroveEntireColl(alice)
      const activePoolCollAfter = await activePool.getAssetBalance(ZERO_ADDRESS)

      const aliceCollAfter_Asset = await getTroveEntireColl(alice, erc20.address)
      const activePoolCollAfter_Asset = await activePool.getAssetBalance(erc20.address)

      assert.isTrue(aliceCollAfter.eq(activePoolCollAfter))
      assert.isTrue(activePoolCollAfter.eq(activePoolCollAfter))

      assert.isTrue(aliceCollAfter_Asset.eq(activePoolCollAfter_Asset))
      assert.isTrue(activePoolCollAfter_Asset.eq(activePoolCollAfter_Asset))
    })

    it("adjustTrove(): With 0 debt change, doesnt change borrower's debt or ActivePool debt", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceDebtBefore = await getTroveEntireDebt(alice)
      const activePoolDebtBefore = await activePool.getVSTDebt(ZERO_ADDRESS)

      const aliceDebtBefore_Asset = await getTroveEntireDebt(alice, erc20.address)
      const activePoolDebtBefore_Asset = await activePool.getVSTDebt(erc20.address)

      assert.isTrue(aliceDebtBefore.gt(toBN('0')))
      assert.isTrue(aliceDebtBefore.eq(activePoolDebtBefore))

      assert.isTrue(aliceDebtBefore_Asset.gt(toBN('0')))
      assert.isTrue(activePoolDebtBefore_Asset.eq(activePoolDebtBefore_Asset))

      // Alice adjusts trove. Coll change, no debt change
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, 0, false, alice, alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.adjustTrove(erc20.address, dec(1, 'ether'), th._100pct, 0, 0, false, alice, alice, { from: alice })

      const aliceDebtAfter = await getTroveEntireDebt(alice)
      const activePoolDebtAfter = await activePool.getVSTDebt(ZERO_ADDRESS)

      const aliceDebtAfter_Asset = await getTroveEntireDebt(alice, erc20.address)
      const activePoolDebtAfter_Asset = await activePool.getVSTDebt(erc20.address)

      assert.isTrue(aliceDebtAfter.eq(aliceDebtBefore))
      assert.isTrue(activePoolDebtAfter.eq(activePoolDebtBefore))

      assert.isTrue(aliceDebtAfter_Asset.eq(aliceDebtBefore_Asset))
      assert.isTrue(activePoolDebtAfter_Asset.eq(activePoolDebtBefore_Asset))
    })

    it("adjustTrove(): updates borrower's debt and coll with an increase in both", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const debtBefore = await getTroveEntireDebt(alice)
      const collBefore = await getTroveEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore.gt(toBN('0')))

      const debtBefore_Asset = await getTroveEntireDebt(alice, erc20.address)
      const collBefore_Asset = await getTroveEntireColl(alice, erc20.address)
      assert.isTrue(debtBefore_Asset.gt(toBN('0')))
      assert.isTrue(collBefore_Asset.gt(toBN('0')))

      // Alice adjusts trove. Coll and debt increase(+1 ETH, +50VST)
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, await getNetBorrowingAmount(dec(50, 18), ZERO_ADDRESS), true, alice, alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.adjustTrove(erc20.address, dec(1, 'ether'), th._100pct, 0, await getNetBorrowingAmount(dec(50, 18), ZERO_ADDRESS), true, alice, alice, { from: alice })

      const debtAfter = await getTroveEntireDebt(alice)
      const collAfter = await getTroveEntireColl(alice)

      const debtAfter_Asset = await getTroveEntireDebt(alice, erc20.address)
      const collAfter_Asset = await getTroveEntireColl(alice, erc20.address)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.add(toBN(dec(50, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter, collBefore.add(toBN(dec(1, 18))), 10000)

      th.assertIsApproximatelyEqual(debtAfter_Asset, debtBefore_Asset.add(toBN(dec(50, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter_Asset, collBefore_Asset.add(toBN(dec(1, 18))), 10000)
    })

    it("adjustTrove(): updates borrower's debt and coll with a decrease in both", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const debtBefore = await getTroveEntireDebt(alice)
      const collBefore = await getTroveEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore.gt(toBN('0')))

      const debtBefore_Asset = await getTroveEntireDebt(alice, erc20.address)
      const collBefore_Asset = await getTroveEntireColl(alice, erc20.address)
      assert.isTrue(debtBefore_Asset.gt(toBN('0')))
      assert.isTrue(collBefore_Asset.gt(toBN('0')))

      // Alice adjusts trove coll and debt decrease (-0.5 ETH, -50VST)
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, dec(500, 'finney'), dec(50, 18), false, alice, alice, { from: alice })
      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, dec(500, 'finney'), dec(50, 18), false, alice, alice, { from: alice })

      const debtAfter = await getTroveEntireDebt(alice)
      const collAfter = await getTroveEntireColl(alice)

      const debtAfter_Asset = await getTroveEntireDebt(alice, erc20.address)
      const collAfter_Asset = await getTroveEntireColl(alice, erc20.address)

      assert.isTrue(debtAfter.eq(debtBefore.sub(toBN(dec(50, 18)))))
      assert.isTrue(collAfter.eq(collBefore.sub(toBN(dec(5, 17)))))

      assert.isTrue(debtAfter_Asset.eq(debtBefore_Asset.sub(toBN(dec(50, 18)))))
      assert.isTrue(collAfter_Asset.eq(collBefore_Asset.sub(toBN(dec(5, 17)))))
    })

    it("adjustTrove(): updates borrower's  debt and coll with coll increase, debt decrease", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const debtBefore = await getTroveEntireDebt(alice)
      const collBefore = await getTroveEntireColl(alice)

      const debtBefore_Asset = await getTroveEntireDebt(alice, erc20.address)
      const collBefore_Asset = await getTroveEntireColl(alice, erc20.address)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore.gt(toBN('0')))
      assert.isTrue(debtBefore_Asset.gt(toBN('0')))
      assert.isTrue(collBefore_Asset.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt decrease (+0.5 ETH, -50VST)
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(50, 18), false, alice, alice, { from: alice, value: dec(500, 'finney') })
      await borrowerOperations.adjustTrove(erc20.address, dec(500, 'finney'), th._100pct, 0, dec(50, 18), false, alice, alice, { from: alice })

      const debtAfter = await getTroveEntireDebt(alice)
      const collAfter = await getTroveEntireColl(alice)
      const debtAfter_Asset = await getTroveEntireDebt(alice, erc20.address)
      const collAfter_Asset = await getTroveEntireColl(alice, erc20.address)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.sub(toBN(dec(50, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter, collBefore.add(toBN(dec(5, 17))), 10000)
      th.assertIsApproximatelyEqual(debtAfter_Asset, debtBefore_Asset.sub(toBN(dec(50, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter_Asset, collBefore_Asset.add(toBN(dec(5, 17))), 10000)
    })

    it("adjustTrove(): updates borrower's debt and coll with coll decrease, debt increase", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const debtBefore = await getTroveEntireDebt(alice)
      const collBefore = await getTroveEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore.gt(toBN('0')))

      const debtBefore_Asset = await getTroveEntireDebt(alice, erc20.address)
      const collBefore_Asset = await getTroveEntireColl(alice, erc20.address)
      assert.isTrue(debtBefore_Asset.gt(toBN('0')))
      assert.isTrue(collBefore_Asset.gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt increase (0.1 ETH, 10VST)
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, dec(1, 17), await getNetBorrowingAmount(dec(1, 18), ZERO_ADDRESS), true, alice, alice, { from: alice })
      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, dec(1, 17), await getNetBorrowingAmount(dec(1, 18), ZERO_ADDRESS), true, alice, alice, { from: alice })

      const debtAfter = await getTroveEntireDebt(alice)
      const collAfter = await getTroveEntireColl(alice)

      const debtAfter_Asset = await getTroveEntireDebt(alice)
      const collAfter_Asset = await getTroveEntireColl(alice)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.add(toBN(dec(1, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter, collBefore.sub(toBN(dec(1, 17))), 10000)
      th.assertIsApproximatelyEqual(debtAfter_Asset, debtBefore_Asset.add(toBN(dec(1, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter_Asset, collBefore_Asset.sub(toBN(dec(1, 17))), 10000)
    })

    it("adjustTrove(): updates borrower's stake and totalStakes with a coll increase", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const stakeBefore = await troveManager.getTroveStake(ZERO_ADDRESS, alice)
      const totalStakesBefore = await troveManager.totalStakes(ZERO_ADDRESS);
      assert.isTrue(stakeBefore.gt(toBN('0')))
      assert.isTrue(totalStakesBefore.gt(toBN('0')))


      const stakeBefore_Asset = await troveManager.getTroveStake(erc20.address, alice)
      const totalStakesBefore_Asset = await troveManager.totalStakes(erc20.address);
      assert.isTrue(stakeBefore_Asset.gt(toBN('0')))
      assert.isTrue(totalStakesBefore_Asset.gt(toBN('0')))

      // Alice adjusts trove - coll and debt increase (+1 ETH, +50 VST)
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

      const stakeAfter = await troveManager.getTroveStake(ZERO_ADDRESS, alice)
      const totalStakesAfter = await troveManager.totalStakes(ZERO_ADDRESS);

      assert.isTrue(stakeAfter.eq(stakeBefore.add(toBN(dec(1, 18)))))
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.add(toBN(dec(1, 18)))))

      await borrowerOperations.adjustTrove(erc20.address, dec(1, 'ether'), th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice })

      const stakeAfter_Asset = await troveManager.getTroveStake(erc20.address, alice)
      const totalStakesAfter_Asset = await troveManager.totalStakes(erc20.address);

      assert.isTrue(stakeAfter_Asset.eq(stakeBefore_Asset.add(toBN(dec(1, 18)))))
      assert.isTrue(totalStakesAfter_Asset.eq(totalStakesBefore_Asset.add(toBN(dec(1, 18)))))
    })

    it("adjustTrove():  updates borrower's stake and totalStakes with a coll decrease", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const stakeBefore = await troveManager.getTroveStake(ZERO_ADDRESS, alice)
      const totalStakesBefore = await troveManager.totalStakes(ZERO_ADDRESS);
      assert.isTrue(stakeBefore.gt(toBN('0')))
      assert.isTrue(totalStakesBefore.gt(toBN('0')))

      const stakeBefore_Asset = await troveManager.getTroveStake(erc20.address, alice)
      const totalStakesBefore_Asset = await troveManager.totalStakes(erc20.address);
      assert.isTrue(stakeBefore_Asset.gt(toBN('0')))
      assert.isTrue(totalStakesBefore_Asset.gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, dec(500, 'finney'), dec(50, 18), false, alice, alice, { from: alice })

      const stakeAfter = await troveManager.getTroveStake(ZERO_ADDRESS, alice)
      const totalStakesAfter = await troveManager.totalStakes(ZERO_ADDRESS);

      assert.isTrue(stakeAfter.eq(stakeBefore.sub(toBN(dec(5, 17)))))
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.sub(toBN(dec(5, 17)))))

      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, dec(500, 'finney'), dec(50, 18), false, alice, alice, { from: alice })

      const stakeAfter_Asset = await troveManager.getTroveStake(erc20.address, alice)
      const totalStakesAfter_Asset = await troveManager.totalStakes(erc20.address);

      assert.isTrue(stakeAfter_Asset.eq(stakeBefore_Asset.sub(toBN(dec(5, 17)))))
      assert.isTrue(totalStakesAfter_Asset.eq(totalStakesBefore_Asset.sub(toBN(dec(5, 17)))))
    })

    it("adjustTrove(): changes VSTToken balance by the requested decrease", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const alice_VSTTokenBalance_Before = await vstToken.balanceOf(alice)
      assert.isTrue(alice_VSTTokenBalance_Before.gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, dec(100, 'finney'), dec(10, 18), false, alice, alice, { from: alice })

      // check after
      const alice_VSTTokenBalance_After = await vstToken.balanceOf(alice)
      assert.isTrue(alice_VSTTokenBalance_After.eq(alice_VSTTokenBalance_Before.sub(toBN(dec(10, 18)))))

      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, dec(100, 'finney'), dec(10, 18), false, alice, alice, { from: alice })

      // check after
      const alice_VSTTokenBalance_After_Asset = await vstToken.balanceOf(alice)
      assert.isTrue(alice_VSTTokenBalance_After_Asset.eq(alice_VSTTokenBalance_After.sub(toBN(dec(10, 18)))))
    })

    it("adjustTrove(): changes VSTToken balance by the requested increase", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const alice_VSTTokenBalance_Before = await vstToken.balanceOf(alice)
      assert.isTrue(alice_VSTTokenBalance_Before.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt increase
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(100, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

      // check after
      const alice_VSTTokenBalance_After = await vstToken.balanceOf(alice)
      assert.isTrue(alice_VSTTokenBalance_After.eq(alice_VSTTokenBalance_Before.add(toBN(dec(100, 18)))))

      await borrowerOperations.adjustTrove(erc20.address, dec(1, 'ether'), th._100pct, 0, dec(100, 18), true, alice, alice, { from: alice })

      // check after
      const alice_VSTTokenBalance_After_Asset = await vstToken.balanceOf(alice)
      assert.isTrue(alice_VSTTokenBalance_After_Asset.eq(alice_VSTTokenBalance_After.add(toBN(dec(100, 18)))))
    })

    it("adjustTrove(): Changes the activePool ETH and raw ether balance by the requested decrease", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const activePool_ETH_Before = await activePool.getAssetBalance(ZERO_ADDRESS)
      const activePool_RawEther_Before = toBN(await web3.eth.getBalance(activePool.address))
      assert.isTrue(activePool_ETH_Before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_Before.gt(toBN('0')))

      const activePool_ETH_Before_Asset = await activePool.getAssetBalance(erc20.address)
      const activePool_RawEther_Before_Asset = toBN(await erc20.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_Before_Asset.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_Before_Asset.gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, dec(100, 'finney'), dec(10, 18), false, alice, alice, { from: alice })
      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, dec(100, 'finney'), dec(10, 18), false, alice, alice, { from: alice })

      const activePool_ETH_After = await activePool.getAssetBalance(ZERO_ADDRESS)
      const activePool_RawEther_After = toBN(await web3.eth.getBalance(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(activePool_ETH_Before.sub(toBN(dec(1, 17)))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_ETH_Before.sub(toBN(dec(1, 17)))))

      const activePool_ETH_After_Asset = await activePool.getAssetBalance(erc20.address)
      const activePool_RawEther_After_Asset = toBN(await erc20.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After_Asset.eq(activePool_ETH_Before_Asset.sub(toBN(dec(1, 17)))))
      assert.isTrue(activePool_RawEther_After_Asset.eq(activePool_ETH_Before_Asset.div(toBN(10 ** 10)).sub(toBN(dec(1, 7)))))
    })

    it("adjustTrove(): Changes the activePool ETH and raw ether balance by the amount of ETH sent", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const activePool_ETH_Before = await activePool.getAssetBalance(ZERO_ADDRESS)
      const activePool_RawEther_Before = toBN(await web3.eth.getBalance(activePool.address))
      assert.isTrue(activePool_ETH_Before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_Before.gt(toBN('0')))

      const activePool_ETH_Before_Asset = await activePool.getAssetBalance(erc20.address)
      const activePool_RawEther_Before_Asset = toBN(await erc20.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_Before_Asset.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_Before_Asset.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt increase
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(100, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.adjustTrove(erc20.address, dec(1, 'ether'), th._100pct, 0, dec(100, 18), true, alice, alice, { from: alice })

      const activePool_ETH_After = await activePool.getAssetBalance(ZERO_ADDRESS)
      const activePool_RawEther_After = toBN(await web3.eth.getBalance(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(activePool_ETH_Before.add(toBN(dec(1, 18)))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_ETH_Before.add(toBN(dec(1, 18)))))

      const activePool_ETH_After_Asset = await activePool.getAssetBalance(erc20.address)
      const activePool_RawEther_After_Asset = toBN(await erc20.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After_Asset.eq(activePool_ETH_Before_Asset.add(toBN(dec(1, 18)))))
      assert.isTrue(activePool_RawEther_After_Asset.eq(activePool_ETH_Before_Asset.div(toBN(10 ** 10)).add(toBN(dec(1, 8)))))
    })

    it("adjustTrove(): Changes the VST debt in ActivePool by requested decrease", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const activePooL_VSTDebt_Before = await activePool.getVSTDebt(ZERO_ADDRESS)
      assert.isTrue(activePooL_VSTDebt_Before.gt(toBN('0')))

      const activePooL_VSTDebt_Before_Asset = await activePool.getVSTDebt(erc20.address)
      assert.isTrue(activePooL_VSTDebt_Before_Asset.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt decrease
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(30, 18), false, alice, alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.adjustTrove(erc20.address, dec(1, 'ether'), th._100pct, 0, dec(30, 18), false, alice, alice, { from: alice })

      const activePooL_VSTDebt_After = await activePool.getVSTDebt(ZERO_ADDRESS)
      assert.isTrue(activePooL_VSTDebt_After.eq(activePooL_VSTDebt_Before.sub(toBN(dec(30, 18)))))

      const activePooL_VSTDebt_After_Asset = await activePool.getVSTDebt(erc20.address)
      assert.isTrue(activePooL_VSTDebt_After_Asset.eq(activePooL_VSTDebt_Before_Asset.sub(toBN(dec(30, 18)))))
    })

    it("adjustTrove(): Changes the VST debt in ActivePool by requested increase", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const activePooL_VSTDebt_Before = await activePool.getVSTDebt(ZERO_ADDRESS)
      assert.isTrue(activePooL_VSTDebt_Before.gt(toBN('0')))

      const activePooL_VSTDebt_Before_Asset = await activePool.getVSTDebt(erc20.address)
      assert.isTrue(activePooL_VSTDebt_Before_Asset.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt increase
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, await getNetBorrowingAmount(dec(100, 18), ZERO_ADDRESS), true, alice, alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.adjustTrove(erc20.address, dec(1, 'ether'), th._100pct, 0, await getNetBorrowingAmount(dec(100, 18), ZERO_ADDRESS), true, alice, alice, { from: alice })

      const activePooL_VSTDebt_After = await activePool.getVSTDebt(ZERO_ADDRESS)
      th.assertIsApproximatelyEqual(activePooL_VSTDebt_After, activePooL_VSTDebt_Before.add(toBN(dec(100, 18))))

      const activePooL_VSTDebt_After_Asset = await activePool.getVSTDebt(erc20.address)
      th.assertIsApproximatelyEqual(activePooL_VSTDebt_After_Asset, activePooL_VSTDebt_Before_Asset.add(toBN(dec(100, 18))))
    })

    it("adjustTrove(): new coll = 0 and new debt = 0 is not allowed, as gas compensation still counts toward ICR", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const aliceColl = await getTroveEntireColl(alice)
      const aliceDebt = await getTroveEntireColl(alice)
      const status_Before = await troveManager.getTroveStatus(ZERO_ADDRESS, alice)
      const isInSortedList_Before = await sortedTroves.contains(ZERO_ADDRESS, alice)

      assert.equal(status_Before, 1)  // 1: Active
      assert.isTrue(isInSortedList_Before)

      const aliceColl_Asset = await getTroveEntireColl(alice, erc20.address)
      const aliceDebt_Asset = await getTroveEntireColl(alice, erc20.address)
      const status_Before_Asset = await troveManager.getTroveStatus(erc20.address, alice)
      const isInSortedList_Before_Asset = await sortedTroves.contains(erc20.address, alice)

      assert.equal(status_Before_Asset, 1)  // 1: Active
      assert.isTrue(isInSortedList_Before_Asset)

      await assertRevert(
        borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, aliceColl, aliceDebt, true, alice, alice, { from: alice }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )

      await assertRevert(
        borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, aliceColl_Asset, aliceDebt_Asset, true, alice, alice, { from: alice }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )
    })

    it("adjustTrove(): Reverts if requested debt increase and amount is zero", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await assertRevert(borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, 0, true, alice, alice, { from: alice }),
        'BorrowerOps: Debt increase requires non-zero debtChange')
      await assertRevert(borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, 0, true, alice, alice, { from: alice }),
        'BorrowerOps: Debt increase requires non-zero debtChange')
    })

    it("adjustTrove(): Reverts if requested coll withdrawal and ether is sent", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await assertRevert(borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, dec(1, 'ether'), dec(100, 18), true, alice, alice, { from: alice, value: dec(3, 'ether') }),
        'BorrowerOperations: Cannot withdraw and add coll')
      await assertRevert(borrowerOperations.adjustTrove(erc20.address, dec(3, 'ether'), th._100pct, dec(1, 'ether'), dec(100, 18), true, alice, alice, { from: alice }),
        'BorrowerOperations: Cannot withdraw and add coll')
    })

    it("adjustTrove(): Reverts if it’s zero adjustment", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await assertRevert(borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, 0, false, alice, alice, { from: alice }),
        'BorrowerOps: There must be either a collateral change or a debt change')

      await assertRevert(borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, 0, false, alice, alice, { from: alice }),
        'BorrowerOps: There must be either a collateral change or a debt change')
    })

    it("adjustTrove(): Reverts if requested coll withdrawal is greater than trove's collateral", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const aliceColl = await getTroveEntireColl(alice)
      const aliceColl_Asset = await getTroveEntireColl(alice, erc20.address)

      // Requested coll withdrawal > coll in the trove
      await assertRevert(borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, aliceColl.add(toBN(1)), 0, false, alice, alice, { from: alice }))
      await assertRevert(borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, aliceColl.add(toBN(dec(37, 'ether'))), 0, false, bob, bob, { from: bob }))

      await assertRevert(borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, aliceColl_Asset.add(toBN(1)), 0, false, alice, alice, { from: alice }))
      await assertRevert(borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, aliceColl_Asset.add(toBN(dec(37, 'ether'))), 0, false, bob, bob, { from: bob }))
    })

    it("adjustTrove(): Reverts if borrower has insufficient VST balance to cover his debt repayment", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      const bobDebt = await getTroveEntireDebt(B)

      // Bob transfers some VST to carol
      await vstToken.transfer(C, dec(10, 18), { from: B })

      //Confirm B's VST balance is less than 50 VST
      const B_VSTBal = await vstToken.balanceOf(B)
      assert.isTrue(B_VSTBal.lt(bobDebt))

      const repayVSTPromise_B = borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, bobDebt, false, B, B, { from: B })

      // B attempts to repay all his debt
      await assertRevert(repayVSTPromise_B, "revert")

      await vstToken.transfer(C, B_VSTBal, { from: B })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: B } })

      const bobDebt_Asset = await getTroveEntireDebt(B, erc20.address)

      await vstToken.transfer(C, dec(10, 18), { from: B })

      const B_VSTBal_Asset = await vstToken.balanceOf(B)
      assert.isTrue(B_VSTBal_Asset.lt(bobDebt_Asset))

      const repayVSTPromise_B_Asset = borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, bobDebt_Asset, false, B, B, { from: B })

      await assertRevert(repayVSTPromise_B_Asset, "revert")
    })

    // --- Internal _adjustTrove() ---

    if (!withProxy) { // no need to test this with proxies
      it("Internal _adjustTrove(): reverts when op is a withdrawal and _borrower param is not the msg.sender", async () => {
        await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

        const txPromise_A = borrowerOperations.callInternalAdjustLoan(ZERO_ADDRESS, 0, alice, dec(1, 18), dec(1, 18), true, alice, alice, { from: bob })
        await assertRevert(txPromise_A, "BorrowerOps: Caller must be the borrower for a withdrawal")
        const txPromise_B = borrowerOperations.callInternalAdjustLoan(ZERO_ADDRESS, 0, bob, dec(1, 18), dec(1, 18), true, alice, alice, { from: owner })
        await assertRevert(txPromise_B, "BorrowerOps: Caller must be the borrower for a withdrawal")
        const txPromise_C = borrowerOperations.callInternalAdjustLoan(ZERO_ADDRESS, 0, carol, dec(1, 18), dec(1, 18), true, alice, alice, { from: bob })
        await assertRevert(txPromise_C, "BorrowerOps: Caller must be the borrower for a withdrawal")

        const txPromise_A_Asset = borrowerOperations.callInternalAdjustLoan(erc20.address, 0, alice, dec(1, 18), dec(1, 18), true, alice, alice, { from: bob })
        await assertRevert(txPromise_A_Asset, "BorrowerOps: Caller must be the borrower for a withdrawal")
        const txPromise_B_Asset = borrowerOperations.callInternalAdjustLoan(erc20.address, 0, bob, dec(1, 18), dec(1, 18), true, alice, alice, { from: owner })
        await assertRevert(txPromise_B_Asset, "BorrowerOps: Caller must be the borrower for a withdrawal")
        const txPromise_C_Asset = borrowerOperations.callInternalAdjustLoan(erc20.address, 0, carol, dec(1, 18), dec(1, 18), true, alice, alice, { from: bob })
        await assertRevert(txPromise_C_Asset, "BorrowerOps: Caller must be the borrower for a withdrawal")
      })
    }

    // --- closeTrove() ---

    it("closeTrove(): reverts when it would lower the TCR below CCR", async () => {
      await openTrove({ ICR: toBN(dec(300, 16)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(120, 16)), extraVSTAmount: toBN(dec(300, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(120, 16)), extraVSTAmount: toBN(dec(300, 18)), extraParams: { from: bob } })

      const price = await priceFeed.getPrice()

      // to compensate borrowing fees
      await vstToken.transfer(alice, dec(300, 18), { from: bob })

      assert.isFalse(await troveManager.checkRecoveryMode(ZERO_ADDRESS, price))

      await assertRevert(
        borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice }),
        "BorrowerOps: An operation that would result in TCR < CCR is not permitted"
      )

      await vstToken.transfer(alice, dec(300, 18), { from: bob })
      assert.isFalse(await troveManager.checkRecoveryMode(erc20.address, price))

      await assertRevert(
        borrowerOperations.closeTrove(erc20.address, { from: alice }),
        "BorrowerOps: An operation that would result in TCR < CCR is not permitted"
      )
    })

    it("closeTrove(): reverts when calling address does not have active trove", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Carol with no active trove attempts to close her trove
      try {
        const txCarol = await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      try {
        const txCarol = await borrowerOperations.closeTrove(erc20.address, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("closeTrove(): reverts when system is in Recovery Mode", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // Alice transfers her VST to Bob and Carol so they can cover fees
      const aliceBal = await vstToken.balanceOf(alice)
      await vstToken.transfer(bob, aliceBal.div(toBN(2)), { from: alice })
      await vstToken.transfer(carol, aliceBal.div(toBN(2)), { from: alice })

      // check Recovery Mode 
      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      // Bob successfully closes his trove
      const txBob = await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: bob })
      assert.isTrue(txBob.receipt.status)

      const txBob_Asset = await borrowerOperations.closeTrove(erc20.address, { from: bob })
      assert.isTrue(txBob_Asset.receipt.status)

      await priceFeed.setPrice(dec(100, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      // Carol attempts to close her trove during Recovery Mode
      await assertRevert(borrowerOperations.closeTrove(ZERO_ADDRESS, { from: carol }),
        "BorrowerOps: Operation not permitted during Recovery Mode")
      await assertRevert(borrowerOperations.closeTrove(erc20.address, { from: carol }),
        "BorrowerOps: Operation not permitted during Recovery Mode")
    })

    it("closeTrove(): reverts when trove is the only one in the system", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // Artificially mint to Alice so she has enough to close her trove
      await vstToken.unprotectedMint(alice, dec(100000, 18))

      // Check she has more VST than her trove debt
      const aliceBal = await vstToken.balanceOf(alice)
      const aliceDebt = await getTroveEntireDebt(alice)
      assert.isTrue(aliceBal.gt(aliceDebt))

      const aliceDebt_Asset = await getTroveEntireDebt(alice, erc20.address)
      assert.isTrue(aliceBal.gt(aliceDebt_Asset))

      // check Recovery Mode
      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      // Alice attempts to close her trove
      await assertRevert(borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice }), "TroveManager: Only one trove in the system")
      await assertRevert(borrowerOperations.closeTrove(erc20.address, { from: alice }), "TroveManager: Only one trove in the system")
    })

    it("closeTrove(): reduces a Trove's collateral to zero", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceCollBefore = await getTroveEntireColl(alice)
      const dennisVST = await vstToken.balanceOf(dennis)
      assert.isTrue(aliceCollBefore.gt(toBN('0')))
      assert.isTrue(dennisVST.gt(toBN('0')))

      const aliceCollBefore_Asset = await getTroveEntireColl(alice, erc20.address)
      assert.isTrue(aliceCollBefore_Asset.gt(toBN('0')))

      // To compensate borrowing fees
      await vstToken.transfer(alice, dennisVST.div(toBN(2)), { from: dennis })

      // Alice attempts to close trove
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice })
      await borrowerOperations.closeTrove(erc20.address, { from: alice })

      const aliceCollAfter = await getTroveEntireColl(alice)
      const aliceCollAfter_Asset = await getTroveEntireColl(alice, erc20.address)
      assert.equal(aliceCollAfter, '0')
      assert.equal(aliceCollAfter_Asset, '0')
    })

    it("closeTrove(): reduces a Trove's debt to zero", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceDebtBefore = await getTroveEntireColl(alice)
      const aliceDebtBefore_Asset = await getTroveEntireColl(alice, erc20.address)
      const dennisVST = await vstToken.balanceOf(dennis)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))
      assert.isTrue(aliceDebtBefore_Asset.gt(toBN('0')))
      assert.isTrue(dennisVST.gt(toBN('0')))

      // To compensate borrowing fees
      await vstToken.transfer(alice, dennisVST.div(toBN(2)), { from: dennis })

      // Alice attempts to close trove
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice })
      await borrowerOperations.closeTrove(erc20.address, { from: alice })

      const aliceCollAfter = await getTroveEntireColl(alice)
      const aliceCollAfter_Asset = await getTroveEntireColl(alice, erc20.address)
      assert.equal(aliceCollAfter, '0')
      assert.equal(aliceCollAfter_Asset, '0')
    })

    it("closeTrove(): sets Trove's stake to zero", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceStakeBefore = await getTroveStake(alice)
      assert.isTrue(aliceStakeBefore.gt(toBN('0')))

      const aliceStakeBefore_Asset = await getTroveStake(alice, erc20.address)
      assert.isTrue(aliceStakeBefore_Asset.gt(toBN('0')))

      const dennisVST = await vstToken.balanceOf(dennis)
      assert.isTrue(dennisVST.gt(toBN('0')))

      // To compensate borrowing fees
      await vstToken.transfer(alice, dennisVST.div(toBN(2)), { from: dennis })

      // Alice attempts to close trove
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice })
      await borrowerOperations.closeTrove(erc20.address, { from: alice })

      const stakeAfter = ((await troveManager.Troves(alice, ZERO_ADDRESS))[2]).toString()
      assert.equal(stakeAfter, '0')

      const stakeAfter_Asset = ((await troveManager.Troves(alice, erc20.address))[2]).toString()
      assert.equal(stakeAfter_Asset, '0')
    })

    it("closeTrove(): zero's the troves reward snapshots", async () => {
      // Dennis opens trove and transfers tokens to alice
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Liquidate Bob
      await troveManager.liquidate(ZERO_ADDRESS, bob)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
      await troveManager.liquidate(erc20.address, bob)
      assert.isFalse(await sortedTroves.contains(erc20.address, bob))

      // Price bounces back
      await priceFeed.setPrice(dec(200, 18))

      // Alice and Carol open troves
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // Price drops ...again
      await priceFeed.setPrice(dec(100, 18))

      // Get Alice's pending reward snapshots 
      const L_ETH_A_Snapshot = (await troveManager.rewardSnapshots(alice, ZERO_ADDRESS))[0]
      const L_VSTDebt_A_Snapshot = (await troveManager.rewardSnapshots(alice, ZERO_ADDRESS))[1]
      assert.isTrue(L_ETH_A_Snapshot.gt(toBN('0')))
      assert.isTrue(L_VSTDebt_A_Snapshot.gt(toBN('0')))


      const L_ETH_A_Snapshot_Asset = (await troveManager.rewardSnapshots(alice, erc20.address))[0]
      const L_VSTDebt_A_Snapshot_Asset = (await troveManager.rewardSnapshots(alice, erc20.address))[1]
      assert.isTrue(L_ETH_A_Snapshot_Asset.gt(toBN('0')))
      assert.isTrue(L_VSTDebt_A_Snapshot_Asset.gt(toBN('0')))

      // Liquidate Carol
      await troveManager.liquidate(ZERO_ADDRESS, carol)
      await troveManager.liquidate(erc20.address, carol)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
      assert.isFalse(await sortedTroves.contains(erc20.address, carol))

      // Get Alice's pending reward snapshots after Carol's liquidation. Check above 0
      const L_ETH_Snapshot_A_AfterLiquidation = (await troveManager.rewardSnapshots(alice, ZERO_ADDRESS))[0]
      const L_VSTDebt_Snapshot_A_AfterLiquidation = (await troveManager.rewardSnapshots(alice, ZERO_ADDRESS))[1]

      const L_ETH_Snapshot_A_AfterLiquidation_Asset = (await troveManager.rewardSnapshots(alice, erc20.address))[0]
      const L_VSTDebt_Snapshot_A_AfterLiquidation_Asset = (await troveManager.rewardSnapshots(alice, erc20.address))[1]

      assert.isTrue(L_ETH_Snapshot_A_AfterLiquidation.gt(toBN('0')))
      assert.isTrue(L_VSTDebt_Snapshot_A_AfterLiquidation.gt(toBN('0')))

      assert.isTrue(L_ETH_Snapshot_A_AfterLiquidation_Asset.gt(toBN('0')))
      assert.isTrue(L_VSTDebt_Snapshot_A_AfterLiquidation_Asset.gt(toBN('0')))

      // to compensate borrowing fees
      await vstToken.transfer(alice, await vstToken.balanceOf(dennis), { from: dennis })

      await priceFeed.setPrice(dec(200, 18))

      // Alice closes trove
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice })
      await borrowerOperations.closeTrove(erc20.address, { from: alice })

      // Check Alice's pending reward snapshots are zero
      const L_ETH_Snapshot_A_afterAliceCloses = (await troveManager.rewardSnapshots(alice, ZERO_ADDRESS))[0]
      const L_VSTDebt_Snapshot_A_afterAliceCloses = (await troveManager.rewardSnapshots(alice, ZERO_ADDRESS))[1]

      assert.equal(L_ETH_Snapshot_A_afterAliceCloses, '0')
      assert.equal(L_VSTDebt_Snapshot_A_afterAliceCloses, '0')

      const L_ETH_Snapshot_A_afterAliceCloses_Asset = (await troveManager.rewardSnapshots(alice, erc20.address))[0]
      const L_VSTDebt_Snapshot_A_afterAliceCloses_Asset = (await troveManager.rewardSnapshots(alice, erc20.address))[1]

      assert.equal(L_ETH_Snapshot_A_afterAliceCloses_Asset, '0')
      assert.equal(L_VSTDebt_Snapshot_A_afterAliceCloses_Asset, '0')
    })

    it("closeTrove(): sets trove's status to closed and removes it from sorted troves list", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // Check Trove is active
      const alice_Trove_Before = await troveManager.Troves(alice, ZERO_ADDRESS)
      const status_Before = alice_Trove_Before[th.TROVE_STATUS_INDEX]

      assert.equal(status_Before, 1)
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))

      const alice_Trove_Before_Asset = await troveManager.Troves(alice, erc20.address)
      const status_Before_Asset = alice_Trove_Before_Asset[th.TROVE_STATUS_INDEX]

      assert.equal(status_Before_Asset, 1)
      assert.isTrue(await sortedTroves.contains(erc20.address, alice))

      // to compensate borrowing fees
      await vstToken.transfer(alice, await vstToken.balanceOf(dennis), { from: dennis })

      // Close the trove
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice })

      const alice_Trove_After = await troveManager.Troves(alice, ZERO_ADDRESS)
      const status_After = alice_Trove_After[th.TROVE_STATUS_INDEX]

      assert.equal(status_After, 2)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))


      await vstToken.transfer(alice, await vstToken.balanceOf(dennis), { from: dennis })
      await borrowerOperations.closeTrove(erc20.address, { from: alice })

      const alice_Trove_After_Asset = await troveManager.Troves(alice, erc20.address)
      const status_After_Asset = alice_Trove_After_Asset[th.TROVE_STATUS_INDEX]

      assert.equal(status_After_Asset, 2)
      assert.isFalse(await sortedTroves.contains(erc20.address, alice))
    })

    it("closeTrove(): reduces ActivePool ETH and raw ether by correct amount", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const dennisColl = await getTroveEntireColl(dennis)
      const aliceColl = await getTroveEntireColl(alice)
      assert.isTrue(dennisColl.gt('0'))
      assert.isTrue(aliceColl.gt('0'))

      const dennisColl_Asset = await getTroveEntireColl(dennis, erc20.address)
      const aliceColl_Asset = await getTroveEntireColl(alice, erc20.address)
      assert.isTrue(dennisColl_Asset.gt('0'))
      assert.isTrue(aliceColl_Asset.gt('0'))

      // Check active Pool ETH before
      const activePool_ETH_before = await activePool.getAssetBalance(ZERO_ADDRESS)
      const activePool_ETH_before_Asset = await activePool.getAssetBalance(erc20.address)
      const activePool_RawEther_before = toBN(await web3.eth.getBalance(activePool.address))
      const activePool_RawEther_before_Asset = toBN(await erc20.balanceOf(activePool.address))

      assert.isTrue(activePool_ETH_before.eq(aliceColl.add(dennisColl)))
      assert.isTrue(activePool_ETH_before_Asset.eq(aliceColl_Asset.add(dennisColl_Asset)))
      assert.isTrue(activePool_ETH_before.gt(toBN('0')))
      assert.isTrue(activePool_ETH_before_Asset.gt(toBN('0')))

      assert.isTrue(activePool_RawEther_before.eq(activePool_ETH_before))
      assert.isTrue(activePool_RawEther_before_Asset.eq(activePool_ETH_before_Asset.div(toBN(10 ** 10))))

      // to compensate borrowing fees
      await vstToken.transfer(alice, await vstToken.balanceOf(dennis), { from: dennis })

      // Close the trove
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice })
      await borrowerOperations.closeTrove(erc20.address, { from: alice })

      // Check after
      const activePool_ETH_After = await activePool.getAssetBalance(ZERO_ADDRESS)
      const activePool_RawEther_After = toBN(await web3.eth.getBalance(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(dennisColl))
      assert.isTrue(activePool_RawEther_After.eq(dennisColl))

      const activePool_ETH_After_Asset = await activePool.getAssetBalance(erc20.address)
      const activePool_RawEther_After_Asset = toBN(await erc20.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After_Asset.eq(dennisColl_Asset))
      assert.isTrue(activePool_RawEther_After_Asset.eq(dennisColl_Asset.div(toBN(10 ** 10))))
    })

    it("closeTrove(): reduces ActivePool debt by correct amount", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const dennisDebt = await getTroveEntireDebt(dennis)
      const aliceDebt = await getTroveEntireDebt(alice)
      const dennisDebt_Asset = await getTroveEntireDebt(dennis, erc20.address)
      const aliceDebt_Asset = await getTroveEntireDebt(alice, erc20.address)

      assert.isTrue(dennisDebt.gt('0'))
      assert.isTrue(aliceDebt.gt('0'))
      assert.isTrue(dennisDebt_Asset.gt('0'))
      assert.isTrue(aliceDebt_Asset.gt('0'))

      // Check before
      const activePool_Debt_before = await activePool.getVSTDebt(ZERO_ADDRESS)
      const activePool_Debt_before_Asset = await activePool.getVSTDebt(erc20.address)

      assert.isTrue(activePool_Debt_before.eq(aliceDebt.add(dennisDebt)))
      assert.isTrue(activePool_Debt_before.gt(toBN('0')))
      assert.isTrue(activePool_Debt_before_Asset.eq(aliceDebt_Asset.add(dennisDebt_Asset)))
      assert.isTrue(activePool_Debt_before_Asset.gt(toBN('0')))

      // to compensate borrowing fees
      await vstToken.transfer(alice, await vstToken.balanceOf(dennis), { from: dennis })

      // Close the trove
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice })
      await borrowerOperations.closeTrove(erc20.address, { from: alice })

      // Check after
      const activePool_Debt_After = (await activePool.getVSTDebt(ZERO_ADDRESS)).toString()
      th.assertIsApproximatelyEqual(activePool_Debt_After, dennisDebt)
      const activePool_Debt_After_Asset = (await activePool.getVSTDebt(erc20.address)).toString()
      th.assertIsApproximatelyEqual(activePool_Debt_After_Asset, dennisDebt_Asset)
    })

    it("closeTrove(): updates the the total stakes", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Get individual stakes
      const aliceStakeBefore = await getTroveStake(alice)
      const bobStakeBefore = await getTroveStake(bob)
      const dennisStakeBefore = await getTroveStake(dennis)
      const aliceStakeBefore_Asset = await getTroveStake(alice, erc20.address)
      const bobStakeBefore_Asset = await getTroveStake(bob, erc20.address)
      const dennisStakeBefore_Asset = await getTroveStake(dennis, erc20.address)
      assert.isTrue(aliceStakeBefore.gt('0'))
      assert.isTrue(bobStakeBefore.gt('0'))
      assert.isTrue(dennisStakeBefore.gt('0'))
      assert.isTrue(aliceStakeBefore_Asset.gt('0'))
      assert.isTrue(bobStakeBefore_Asset.gt('0'))
      assert.isTrue(dennisStakeBefore_Asset.gt('0'))

      const totalStakesBefore = await troveManager.totalStakes(ZERO_ADDRESS)
      const totalStakesBefore_Asset = await troveManager.totalStakes(erc20.address)

      assert.isTrue(totalStakesBefore.eq(aliceStakeBefore.add(bobStakeBefore).add(dennisStakeBefore)))
      assert.isTrue(totalStakesBefore_Asset.eq(aliceStakeBefore_Asset.add(bobStakeBefore_Asset).add(dennisStakeBefore_Asset)))

      // to compensate borrowing fees
      await vstToken.transfer(alice, await vstToken.balanceOf(dennis), { from: dennis })

      // Alice closes trove
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice })
      await borrowerOperations.closeTrove(erc20.address, { from: alice })

      // Check stake and total stakes get updated
      const aliceStakeAfter = await getTroveStake(alice)
      const totalStakesAfter = await troveManager.totalStakes(ZERO_ADDRESS)
      const aliceStakeAfter_Asset = await getTroveStake(alice, erc20.address)
      const totalStakesAfter_Asset = await troveManager.totalStakes(erc20.address)

      assert.equal(aliceStakeAfter, 0)
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.sub(aliceStakeBefore)))
      assert.equal(aliceStakeAfter_Asset, 0)
      assert.isTrue(totalStakesAfter_Asset.eq(totalStakesBefore_Asset.sub(aliceStakeBefore_Asset)))
    })

    if (!withProxy) { // TODO: wrap web3.eth.getBalance to be able to go through proxies
      it("closeTrove(): sends the correct amount of ETH to the user", async () => {
        await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
        await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

        const aliceColl = await getTroveEntireColl(alice)
        assert.isTrue(aliceColl.gt(toBN('0')))
        const aliceColl_Asset = await getTroveEntireColl(alice, erc20.address)
        assert.isTrue(aliceColl_Asset.gt(toBN('0')))

        const alice_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))
        const alice_ETHBalance_Before_Asset = web3.utils.toBN(await erc20.balanceOf(alice))

        // to compensate borrowing fees
        await vstToken.transfer(alice, await vstToken.balanceOf(dennis), { from: dennis })

        await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice, gasPrice: 0 })
        await borrowerOperations.closeTrove(erc20.address, { from: alice, gasPrice: 0 })

        const alice_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(alice))
        const alice_ETHBalance_After_Asset = web3.utils.toBN(await erc20.balanceOf(alice))

        const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)
        const balanceDiff_Asset = alice_ETHBalance_After_Asset.sub(alice_ETHBalance_Before_Asset)

        assert.isTrue(balanceDiff.eq(aliceColl))
        assert.isTrue(balanceDiff_Asset.eq(aliceColl_Asset.div(toBN(10 ** 10))))
      })
    }

    it("closeTrove(): subtracts the debt of the closed Trove from the Borrower's VSTToken balance", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceDebt = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebt.gt(toBN('0')))

      const aliceDebt_Asset = await getTroveEntireDebt(alice, erc20.address)
      assert.isTrue(aliceDebt_Asset.gt(toBN('0')))

      // to compensate borrowing fees
      await vstToken.transfer(alice, await vstToken.balanceOf(dennis), { from: dennis })

      const alice_VSTBalance_Before = await vstToken.balanceOf(alice)
      assert.isTrue(alice_VSTBalance_Before.gt(toBN('0')))

      // close trove
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice })
      await borrowerOperations.closeTrove(erc20.address, { from: alice })

      // check alice VST balance after
      const alice_VSTBalance_After = await vstToken.balanceOf(alice)
      const debtValue = aliceDebt.sub(VST_GAS_COMPENSATION);
      const debtValueERC20 = aliceDebt.sub(VST_GAS_COMPENSATION_ERC20)
      th.assertIsApproximatelyEqual(alice_VSTBalance_After, alice_VSTBalance_Before.sub(debtValue.add(debtValueERC20)))
    })

    it("closeTrove(): applies pending rewards", async () => {
      // --- SETUP ---
      await openTrove({ extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // Whale transfers to A and B to cover their fees
      await vstToken.transfer(alice, dec(10000, 18), { from: whale })
      await vstToken.transfer(bob, dec(10000, 18), { from: whale })

      // --- TEST ---

      // price drops to 1ETH:100VST, reducing Carol's ICR below MCR
      await priceFeed.setPrice(dec(100, 18));
      const price = await priceFeed.getPrice()

      // liquidate Carol's Trove, Alice and Bob earn rewards.
      const liquidationTx = await troveManager.liquidate(ZERO_ADDRESS, carol, { from: owner });
      const [liquidatedDebt_C, liquidatedColl_C] = th.getEmittedLiquidationValues(liquidationTx)

      const liquidationTx_Asset = await troveManager.liquidate(erc20.address, carol, { from: owner });
      const [liquidatedDebt_C_Asset, liquidatedColl_C_Asset] = th.getEmittedLiquidationValues(liquidationTx_Asset)

      // Dennis opens a new Trove 
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // check Alice and Bob's reward snapshots are zero before they alter their Troves
      const alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(alice, ZERO_ADDRESS)
      const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
      const alice_VSTDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

      const alice_rewardSnapshot_Before_Asset = await troveManager.rewardSnapshots(alice, erc20.address)
      const alice_ETHrewardSnapshot_Before_Asset = alice_rewardSnapshot_Before_Asset[0]
      const alice_VSTDebtRewardSnapshot_Before_Asset = alice_rewardSnapshot_Before_Asset[1]

      const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bob, ZERO_ADDRESS)
      const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
      const bob_VSTDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

      const bob_rewardSnapshot_Before_Asset = await troveManager.rewardSnapshots(bob, erc20.address)
      const bob_ETHrewardSnapshot_Before_Asset = bob_rewardSnapshot_Before_Asset[0]
      const bob_VSTDebtRewardSnapshot_Before_Asset = bob_rewardSnapshot_Before_Asset[1]

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_VSTDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_VSTDebtRewardSnapshot_Before, 0)

      assert.equal(alice_ETHrewardSnapshot_Before_Asset, 0)
      assert.equal(alice_VSTDebtRewardSnapshot_Before_Asset, 0)
      assert.equal(bob_ETHrewardSnapshot_Before_Asset, 0)
      assert.equal(bob_VSTDebtRewardSnapshot_Before_Asset, 0)

      const defaultPool_ETH = await defaultPool.getAssetBalance(ZERO_ADDRESS)
      const defaultPooL_VSTDebt = await defaultPool.getVSTDebt(ZERO_ADDRESS)

      const defaultPool_ETH_Asset = await defaultPool.getAssetBalance(erc20.address)
      const defaultPooL_VSTDebt_Asset = await defaultPool.getVSTDebt(erc20.address)

      // Carol's liquidated coll (1 ETH) and drawn debt should have entered the Default Pool
      assert.isAtMost(th.getDifference(defaultPool_ETH, liquidatedColl_C), 100)
      assert.isAtMost(th.getDifference(defaultPooL_VSTDebt, liquidatedDebt_C), 100)

      assert.isAtMost(th.getDifference(defaultPool_ETH_Asset, liquidatedColl_C_Asset), 100)
      assert.isAtMost(th.getDifference(defaultPooL_VSTDebt_Asset, liquidatedDebt_C_Asset), 100)

      const pendingCollReward_A = await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)
      const pendingDebtReward_A = await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, alice)
      const pendingCollReward_A_Asset = await troveManager.getPendingAssetReward(erc20.address, alice)
      const pendingDebtReward_A_Asset = await troveManager.getPendingVSTDebtReward(erc20.address, alice)
      assert.isTrue(pendingCollReward_A.gt('0'))
      assert.isTrue(pendingDebtReward_A.gt('0'))
      assert.isTrue(pendingCollReward_A_Asset.gt('0'))
      assert.isTrue(pendingDebtReward_A_Asset.gt('0'))

      // Close Alice's trove. Alice's pending rewards should be removed from the DefaultPool when she close.
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice })
      await borrowerOperations.closeTrove(erc20.address, { from: alice })

      const defaultPool_ETH_afterAliceCloses = await defaultPool.getAssetBalance(ZERO_ADDRESS)
      const defaultPooL_VSTDebt_afterAliceCloses = await defaultPool.getVSTDebt(ZERO_ADDRESS)

      const defaultPool_ETH_afterAliceCloses_Asset = await defaultPool.getAssetBalance(erc20.address)
      const defaultPooL_VSTDebt_afterAliceCloses_Asset = await defaultPool.getVSTDebt(erc20.address)

      assert.isAtMost(th.getDifference(defaultPool_ETH_afterAliceCloses,
        defaultPool_ETH.sub(pendingCollReward_A)), 1000)
      assert.isAtMost(th.getDifference(defaultPooL_VSTDebt_afterAliceCloses,
        defaultPooL_VSTDebt.sub(pendingDebtReward_A)), 1000)

      assert.isAtMost(th.getDifference(defaultPool_ETH_afterAliceCloses_Asset,
        defaultPool_ETH.sub(pendingCollReward_A_Asset)), 1000)
      assert.isAtMost(th.getDifference(defaultPooL_VSTDebt_afterAliceCloses_Asset,
        defaultPooL_VSTDebt.sub(pendingDebtReward_A_Asset)), 1000)

      // whale adjusts trove, pulling their rewards out of DefaultPool
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, dec(1, 18), true, whale, whale, { from: whale })
      await borrowerOperations.adjustTrove(erc20.address, 0, th._100pct, 0, dec(1, 18), true, whale, whale, { from: whale })

      // Close Bob's trove. Expect DefaultPool coll and debt to drop to 0, since closing pulls his rewards out.
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: bob })
      await borrowerOperations.closeTrove(erc20.address, { from: bob })

      const defaultPool_ETH_afterBobCloses = await defaultPool.getAssetBalance(ZERO_ADDRESS)
      const defaultPooL_VSTDebt_afterBobCloses = await defaultPool.getVSTDebt(ZERO_ADDRESS)

      const defaultPool_ETH_afterBobCloses_Asset = await defaultPool.getAssetBalance(erc20.address)
      const defaultPooL_VSTDebt_afterBobCloses_Asset = await defaultPool.getVSTDebt(erc20.address)

      assert.isAtMost(th.getDifference(defaultPool_ETH_afterBobCloses, 0), 100000)
      assert.isAtMost(th.getDifference(defaultPooL_VSTDebt_afterBobCloses, 0), 100000)

      assert.isAtMost(th.getDifference(defaultPool_ETH_afterBobCloses_Asset, 0), 100000)
      assert.isAtMost(th.getDifference(defaultPooL_VSTDebt_afterBobCloses_Asset, 0), 100000)
    })

    it("closeTrove(): reverts if borrower has insufficient VST balance to repay his entire debt", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })

      //Confirm Bob's VST balance is less than his trove debt
      const B_VSTBal = await vstToken.balanceOf(B)
      const B_troveDebt = await getTroveEntireDebt(B)

      assert.isTrue(B_VSTBal.lt(B_troveDebt))

      const closeTrovePromise_B = borrowerOperations.closeTrove(ZERO_ADDRESS, { from: B })
      await assertRevert(closeTrovePromise_B, "BorrowerOps: Caller doesnt have enough VST to make repayment")


      await vstToken.transfer(C, await B_VSTBal, { from: B })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })

      const B_VSTBal_Asset = await vstToken.balanceOf(B)
      const B_troveDebt_Asset = await getTroveEntireDebt(B, erc20.address)

      assert.isTrue(B_VSTBal_Asset.lt(B_troveDebt_Asset))

      const closeTrovePromise_B_Asset = borrowerOperations.closeTrove(erc20.address, { from: B })
      await assertRevert(closeTrovePromise_B_Asset, "BorrowerOps: Caller doesnt have enough VST to make repayment")

    })

    // --- openTrove() ---

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("openTrove(): emits a TroveUpdated event with the correct collateral and debt", async () => {
        const txA = (await openTrove({ extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })).tx
        const txB = (await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })).tx
        const txC = (await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })).tx

        const txA_Asset = (await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })).tx
        const txB_Asset = (await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })).tx
        const txC_Asset = (await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })).tx

        const A_Coll = await getTroveEntireColl(A)
        const B_Coll = await getTroveEntireColl(B)
        const C_Coll = await getTroveEntireColl(C)
        const A_Debt = await getTroveEntireDebt(A)
        const B_Debt = await getTroveEntireDebt(B)
        const C_Debt = await getTroveEntireDebt(C)

        const A_Coll_Asset = await getTroveEntireColl(A, erc20.address,)
        const B_Coll_Asset = await getTroveEntireColl(B, erc20.address,)
        const C_Coll_Asset = await getTroveEntireColl(C, erc20.address,)
        const A_Debt_Asset = await getTroveEntireDebt(A, erc20.address,)
        const B_Debt_Asset = await getTroveEntireDebt(B, erc20.address,)
        const C_Debt_Asset = await getTroveEntireDebt(C, erc20.address,)

        const A_emittedDebt = toBN(th.getEventArgByName(txA, "TroveUpdated", "_debt"))
        const A_emittedColl = toBN(th.getEventArgByName(txA, "TroveUpdated", "_coll"))
        const B_emittedDebt = toBN(th.getEventArgByName(txB, "TroveUpdated", "_debt"))
        const B_emittedColl = toBN(th.getEventArgByName(txB, "TroveUpdated", "_coll"))
        const C_emittedDebt = toBN(th.getEventArgByName(txC, "TroveUpdated", "_debt"))
        const C_emittedColl = toBN(th.getEventArgByName(txC, "TroveUpdated", "_coll"))

        const A_emittedDebt_Asset = toBN(th.getEventArgByName(txA, "TroveUpdated", "_debt"))
        const A_emittedColl_Asset = toBN(th.getEventArgByName(txA, "TroveUpdated", "_coll"))
        const B_emittedDebt_Asset = toBN(th.getEventArgByName(txB, "TroveUpdated", "_debt"))
        const B_emittedColl_Asset = toBN(th.getEventArgByName(txB, "TroveUpdated", "_coll"))
        const C_emittedDebt_Asset = toBN(th.getEventArgByName(txC, "TroveUpdated", "_debt"))
        const C_emittedColl_Asset = toBN(th.getEventArgByName(txC, "TroveUpdated", "_coll"))

        // Check emitted debt values are correct
        assert.isTrue(A_Debt.eq(A_emittedDebt))
        assert.isTrue(B_Debt.eq(B_emittedDebt))
        assert.isTrue(C_Debt.eq(C_emittedDebt))
        assert.isTrue(A_Debt_Asset.eq(A_emittedDebt_Asset))
        assert.isTrue(B_Debt_Asset.eq(B_emittedDebt_Asset))
        assert.isTrue(C_Debt_Asset.eq(C_emittedDebt_Asset))

        // Check emitted coll values are correct
        assert.isTrue(A_Coll.eq(A_emittedColl))
        assert.isTrue(B_Coll.eq(B_emittedColl))
        assert.isTrue(C_Coll.eq(C_emittedColl))
        assert.isTrue(A_Coll_Asset.eq(A_emittedColl_Asset))
        assert.isTrue(B_Coll_Asset.eq(B_emittedColl_Asset))
        assert.isTrue(C_Coll_Asset.eq(C_emittedColl_Asset))

        const baseRateBefore = await troveManager.baseRate(ZERO_ADDRESS)
        const baseRateBefore_Asset = await troveManager.baseRate(erc20.address)

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)
        await troveManager.setBaseRate(erc20.address, dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow(erc20.address)

        assert.isTrue((await troveManager.baseRate(ZERO_ADDRESS)).gt(baseRateBefore))
        assert.isTrue((await troveManager.baseRate(erc20.address)).gt(baseRateBefore_Asset))

        const txD = (await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })).tx
        const txE = (await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })).tx

        const txD_Asset = (await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })).tx
        const txE_Asset = (await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })).tx

        const D_Coll = await getTroveEntireColl(D)
        const E_Coll = await getTroveEntireColl(E)
        const D_Debt = await getTroveEntireDebt(D)
        const E_Debt = await getTroveEntireDebt(E)

        const D_Coll_Asset = await getTroveEntireColl(D, erc20.address)
        const E_Coll_Asset = await getTroveEntireColl(E, erc20.address)
        const D_Debt_Asset = await getTroveEntireDebt(D, erc20.address)
        const E_Debt_Asset = await getTroveEntireDebt(E, erc20.address)

        const D_emittedDebt = toBN(th.getEventArgByName(txD, "TroveUpdated", "_debt"))
        const D_emittedColl = toBN(th.getEventArgByName(txD, "TroveUpdated", "_coll"))
        const E_emittedDebt = toBN(th.getEventArgByName(txE, "TroveUpdated", "_debt"))
        const E_emittedColl = toBN(th.getEventArgByName(txE, "TroveUpdated", "_coll"))

        const D_emittedDebt_Asset = toBN(th.getEventArgByName(txD, "TroveUpdated", "_debt"))
        const D_emittedColl_Asset = toBN(th.getEventArgByName(txD, "TroveUpdated", "_coll"))
        const E_emittedDebt_Asset = toBN(th.getEventArgByName(txE, "TroveUpdated", "_debt"))
        const E_emittedColl_Asset = toBN(th.getEventArgByName(txE, "TroveUpdated", "_coll"))

        // Check emitted debt values are correct
        assert.isTrue(D_Debt.eq(D_emittedDebt))
        assert.isTrue(E_Debt.eq(E_emittedDebt))
        assert.isTrue(D_Debt_Asset.eq(D_emittedDebt_Asset))
        assert.isTrue(E_Debt_Asset.eq(E_emittedDebt_Asset))

        // Check emitted coll values are correct
        assert.isTrue(D_Coll.eq(D_emittedColl))
        assert.isTrue(E_Coll.eq(E_emittedColl))
        assert.isTrue(D_Coll_Asset.eq(D_emittedColl_Asset))
        assert.isTrue(E_Coll_Asset.eq(E_emittedColl_Asset))
      })
    }

    it("openTrove(): Opens a trove with net debt >= minimum net debt", async () => {
      // Add 1 wei to correct for rounding error in helper function
      const txA = await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(1)), ZERO_ADDRESS), A, A, { from: A, value: dec(100, 30) })
      assert.isTrue(txA.receipt.status)
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, A))

      const txA_Asset = await borrowerOperations.openTrove(erc20.address, dec(100, 30), th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT_ERC20.add(toBN(1)), ZERO_ADDRESS), A, A, { from: A })
      assert.isTrue(txA_Asset.receipt.status)
      assert.isTrue(await sortedTroves.contains(erc20.address, A))

      const txC = await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(dec(47789898, 22)), ZERO_ADDRESS)), A, A, { from: C, value: dec(100, 30) })
      assert.isTrue(txC.receipt.status)
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, C))

      const txC_Asset = await borrowerOperations.openTrove(erc20.address, dec(100, 30), th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT_ERC20.add(toBN(dec(47789898, 22)), ZERO_ADDRESS)), A, A, { from: C })
      assert.isTrue(txC_Asset.receipt.status)
      assert.isTrue(await sortedTroves.contains(erc20.address, C))
    })

    it("openTrove(): reverts if net debt < minimum net debt", async () => {
      const txAPromise = borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, 0, A, A, { from: A, value: dec(100, 30) })
      await assertRevert(txAPromise, "revert")

      const txBPromise = borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.sub(toBN(1)), ZERO_ADDRESS), B, B, { from: B, value: dec(100, 30) })
      await assertRevert(txBPromise, "revert")

      const txCPromise = borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, MIN_NET_DEBT.sub(toBN(dec(173, 18))), C, C, { from: C, value: dec(100, 30) })
      await assertRevert(txCPromise, "revert")

      const txAPromise_Asset = borrowerOperations.openTrove(erc20.address, dec(100, 30), th._100pct, 0, A, A, { from: A })
      await assertRevert(txAPromise_Asset, "revert")

      const txBPromise_Asset = borrowerOperations.openTrove(erc20.address, dec(100, 30), th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT_ERC20.sub(toBN(1)), ZERO_ADDRESS), B, B, { from: B })
      await assertRevert(txBPromise_Asset, "revert")

      const txCPromise_Asset = borrowerOperations.openTrove(erc20.address, dec(100, 30), th._100pct, MIN_NET_DEBT_ERC20.sub(toBN(dec(173, 18))), C, C, { from: C })
      await assertRevert(txCPromise_Asset, "revert")
    })

    it("openTrove(): decays a non-zero base rate", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)
      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_1.gt(toBN('0')))
      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      await openTrove({ extraVSTAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate has decreased
      const baseRate_2 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_2.lt(baseRate_1))
      const baseRate_2_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_2_Asset.lt(baseRate_1_Asset))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens trove 
      await openTrove({ extraVSTAmount: toBN(dec(12, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(12, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const baseRate_3 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_3.lt(baseRate_2))

      const baseRate_3_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_3_Asset.lt(baseRate_2_Asset))
    })

    it("openTrove(): doesn't change base rate if it is already zero", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.equal(baseRate_1, '0')

      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.equal(baseRate_1_Asset, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      await openTrove({ extraVSTAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is still 0
      const baseRate_2 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.equal(baseRate_2, '0')
      const baseRate_2_Asset = await troveManager.baseRate(erc20.address)
      assert.equal(baseRate_2_Asset, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens trove 
      await openTrove({ extraVSTAmount: toBN(dec(12, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(12, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const baseRate_3 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.equal(baseRate_3, '0')

      const baseRate_3_Asset = await troveManager.baseRate(erc20.address)
      assert.equal(baseRate_3_Asset, '0')
    })

    it("openTrove(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_1.gt(toBN('0')))
      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime(ZERO_ADDRESS)
      const lastFeeOpTime_1_Asset = await troveManager.lastFeeOperationTime(erc20.address)

      // Borrower D triggers a fee
      await openTrove({ extraVSTAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime(ZERO_ADDRESS)
      const lastFeeOpTime_2_Asset = await troveManager.lastFeeOperationTime(erc20.address)

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))
      assert.isTrue(lastFeeOpTime_2_Asset.eq(lastFeeOpTime_1_Asset))

      // 1 minute passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(3600))
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1_Asset).gte(3600))

      // Borrower E triggers a fee
      await openTrove({ extraVSTAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime(ZERO_ADDRESS)
      const lastFeeOpTime_3_Asset = await troveManager.lastFeeOperationTime(erc20.address)

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
      assert.isTrue(lastFeeOpTime_3_Asset.gt(lastFeeOpTime_1_Asset))
    })

    it("openTrove(): reverts if max fee > 100%", async () => {
      await assertRevert(borrowerOperations.openTrove(ZERO_ADDRESS, 0, dec(2, 18), dec(10000, 18), A, A, { from: A, value: dec(1000, 'ether') }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.openTrove(ZERO_ADDRESS, 0, '1000000000000000001', dec(20000, 18), B, B, { from: B, value: dec(1000, 'ether') }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.openTrove(erc20.address, dec(1000, 'ether'), dec(2, 18), dec(10000, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.openTrove(erc20.address, dec(1000, 'ether'), '1000000000000000001', dec(20000, 18), B, B, { from: B }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("openTrove(): reverts if max fee < 0.5% in Normal mode", async () => {
      await assertRevert(borrowerOperations.openTrove(ZERO_ADDRESS, 0, 0, dec(195000, 18), A, A, { from: A, value: dec(1200, 'ether') }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.openTrove(ZERO_ADDRESS, 0, 1, dec(195000, 18), A, A, { from: A, value: dec(1000, 'ether') }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.openTrove(ZERO_ADDRESS, 0, '4999999999999999', dec(195000, 18), B, B, { from: B, value: dec(1200, 'ether') }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.openTrove(erc20.address, dec(1200, 'ether'), 0, dec(195000, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.openTrove(erc20.address, dec(1000, 'ether'), 1, dec(195000, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.openTrove(erc20.address, dec(1200, 'ether'), '4999999999999999', dec(195000, 18), B, B, { from: B }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("openTrove(): allows max fee < 0.5% in Recovery Mode", async () => {
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, dec(195000, 18), A, A, { from: A, value: dec(2000, 'ether') })
      await borrowerOperations.openTrove(erc20.address, dec(2000, 'ether'), th._100pct, dec(195000, 18), A, A, { from: A })

      await priceFeed.setPrice(dec(100, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, 0, dec(19500, 18), B, B, { from: B, value: dec(3100, 'ether') })
      await borrowerOperations.openTrove(erc20.address, dec(3100, 'ether'), 0, dec(19500, 18), B, B, { from: B })
      await priceFeed.setPrice(dec(50, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, 1, dec(19500, 18), C, C, { from: C, value: dec(3100, 'ether') })
      await borrowerOperations.openTrove(erc20.address, dec(3100, 'ether'), 1, dec(19500, 18), C, C, { from: C })
      await priceFeed.setPrice(dec(25, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, '4999999999999999', dec(19500, 18), D, D, { from: D, value: dec(3100, 'ether') })
      await borrowerOperations.openTrove(erc20.address, dec(3100, 'ether'), '4999999999999999', dec(19500, 18), D, D, { from: D })
    })

    it("openTrove(): reverts if fee exceeds max fee percentage", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      const totalSupply = await vstToken.totalSupply()

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      //       actual fee percentage: 0.005000000186264514
      // user's max fee percentage:  0.0049999999999999999
      let borrowingRate = await troveManager.getBorrowingRate(ZERO_ADDRESS) // expect max(0.5 + 5%, 5%) rate
      assert.equal(borrowingRate, dec(5, 16))

      let borrowingRate_Asset = await troveManager.getBorrowingRate(erc20.address) // expect max(0.5 + 5%, 5%) rate
      assert.equal(borrowingRate_Asset, dec(5, 16))

      const lessThan5pct = '49999999999999999'
      await assertRevert(borrowerOperations.openTrove(ZERO_ADDRESS, 0, lessThan5pct, dec(30000, 18), A, A, { from: D, value: dec(1000, 'ether') }), "Fee exceeded provided maximum")
      await assertRevert(borrowerOperations.openTrove(erc20.address, dec(1000, 'ether'), lessThan5pct, dec(30000, 18), A, A, { from: D }), "Fee exceeded provided maximum")

      borrowingRate = await troveManager.getBorrowingRate(ZERO_ADDRESS) // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      borrowingRate_Asset = await troveManager.getBorrowingRate(erc20.address) // expect 5% rate
      assert.equal(borrowingRate_Asset, dec(5, 16))

      // Attempt with maxFee 1%
      await assertRevert(borrowerOperations.openTrove(ZERO_ADDRESS, 0, dec(1, 16), dec(30000, 18), A, A, { from: D, value: dec(1000, 'ether') }), "Fee exceeded provided maximum")
      await assertRevert(borrowerOperations.openTrove(erc20.address, dec(1000, 'ether'), dec(1, 16), dec(30000, 18), A, A, { from: D }), "Fee exceeded provided maximum")

      borrowingRate = await troveManager.getBorrowingRate(ZERO_ADDRESS) // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      borrowingRate_Asset = await troveManager.getBorrowingRate(ZERO_ADDRESS) // expect 5% rate
      assert.equal(borrowingRate_Asset, dec(5, 16))
      // Attempt with maxFee 3.754%
      await assertRevert(borrowerOperations.openTrove(ZERO_ADDRESS, 0, dec(3754, 13), dec(30000, 18), A, A, { from: D, value: dec(1000, 'ether') }), "Fee exceeded provided maximum")
      await assertRevert(borrowerOperations.openTrove(erc20.address, dec(1000, 'ether'), dec(3754, 13), dec(30000, 18), A, A, { from: D }), "Fee exceeded provided maximum")

      borrowingRate = await troveManager.getBorrowingRate(ZERO_ADDRESS) // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      borrowingRate_Asset = await troveManager.getBorrowingRate(erc20.address) // expect 5% rate
      assert.equal(borrowingRate_Asset, dec(5, 16))
      // Attempt with maxFee 1e-16%
      await assertRevert(borrowerOperations.openTrove(ZERO_ADDRESS, 0, dec(5, 15), dec(30000, 18), A, A, { from: D, value: dec(1000, 'ether') }), "Fee exceeded provided maximum")
      await assertRevert(borrowerOperations.openTrove(erc20.address, dec(1000, 'ether'), dec(5, 15), dec(30000, 18), A, A, { from: D }), "Fee exceeded provided maximum")
    })

    it("openTrove(): succeeds when fee is less than max fee percentage", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      let borrowingRate = await troveManager.getBorrowingRate(ZERO_ADDRESS) // expect min(0.5 + 5%, 5%) rate
      assert.equal(borrowingRate, dec(5, 16))

      let borrowingRate_Asset = await troveManager.getBorrowingRate(erc20.address) // expect min(0.5 + 5%, 5%) rate
      assert.equal(borrowingRate_Asset, dec(5, 16))

      // Attempt with maxFee > 5%
      const moreThan5pct = '50000000000000001'
      const tx1 = await borrowerOperations.openTrove(ZERO_ADDRESS, 0, moreThan5pct, dec(10000, 18), A, A, { from: D, value: dec(100, 'ether') })
      assert.isTrue(tx1.receipt.status)

      const tx1_Asset = await borrowerOperations.openTrove(erc20.address, dec(100, 'ether'), moreThan5pct, dec(10000, 18), A, A, { from: D })
      assert.isTrue(tx1_Asset.receipt.status)

      borrowingRate = await troveManager.getBorrowingRate(ZERO_ADDRESS) // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      borrowingRate_Asset = await troveManager.getBorrowingRate(erc20.address) // expect 5% rate
      assert.equal(borrowingRate_Asset, dec(5, 16))

      // Attempt with maxFee = 5%
      const tx2 = await borrowerOperations.openTrove(ZERO_ADDRESS, 0, dec(5, 16), dec(10000, 18), A, A, { from: H, value: dec(100, 'ether') })
      assert.isTrue(tx2.receipt.status)

      const tx2_Asset = await borrowerOperations.openTrove(erc20.address, dec(100, 'ether'), dec(5, 16), dec(10000, 18), A, A, { from: H })
      assert.isTrue(tx2_Asset.receipt.status)

      borrowingRate = await troveManager.getBorrowingRate(ZERO_ADDRESS) // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      borrowingRate_Asset = await troveManager.getBorrowingRate(erc20.address) // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee 10%
      const tx3 = await borrowerOperations.openTrove(ZERO_ADDRESS, 0, dec(1, 17), dec(10000, 18), A, A, { from: E, value: dec(100, 'ether') })
      assert.isTrue(tx3.receipt.status)

      const tx3_Asset = await borrowerOperations.openTrove(erc20.address, dec(100, 'ether'), dec(1, 17), dec(10000, 18), A, A, { from: E })
      assert.isTrue(tx3_Asset.receipt.status)

      borrowingRate = await troveManager.getBorrowingRate(ZERO_ADDRESS) // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      borrowingRate_Asset = await troveManager.getBorrowingRate(erc20.address) // expect 5% rate
      assert.equal(borrowingRate_Asset, dec(5, 16))

      // Attempt with maxFee 37.659%
      const tx4 = await borrowerOperations.openTrove(ZERO_ADDRESS, 0, dec(37659, 13), dec(10000, 18), A, A, { from: F, value: dec(100, 'ether') })
      assert.isTrue(tx4.receipt.status)

      const tx4_Asset = await borrowerOperations.openTrove(erc20.address, dec(100, 'ether'), dec(37659, 13), dec(10000, 18), A, A, { from: F })
      assert.isTrue(tx4_Asset.receipt.status)

      // Attempt with maxFee 100%
      const tx5 = await borrowerOperations.openTrove(ZERO_ADDRESS, 0, dec(1, 18), dec(10000, 18), A, A, { from: G, value: dec(100, 'ether') })
      assert.isTrue(tx5.receipt.status)

      const tx5_Asset = await borrowerOperations.openTrove(erc20.address, dec(100, 'ether'), dec(1, 18), dec(10000, 18), A, A, { from: G })
      assert.isTrue(tx5_Asset.receipt.status)
    })

    it("openTrove(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // Check baseRate is non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      // 59 minutes pass
      th.fastForwardTime(3540, web3.currentProvider)

      // Assume Borrower also owns accounts D and E
      // Borrower triggers a fee, before decay interval has passed
      await openTrove({ extraVSTAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // 1 minute pass
      th.fastForwardTime(3540, web3.currentProvider)

      // Borrower triggers another fee
      await openTrove({ extraVSTAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_2.lt(baseRate_1))

      const baseRate_2_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_2_Asset.lt(baseRate_1_Asset))
    })

    it("openTrove(): borrowing at non-zero base rate sends VST fee to VSTA staking contract", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 VSTA
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
      await vstaStaking.stake(dec(1, 18), { from: multisig })

      // Check VSTA VST balance before == 0
      const VSTAStaking_VSTBalance_Before = await vstToken.balanceOf(vstaStaking.address)
      assert.equal(VSTAStaking_VSTBalance_Before, '0')

      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check VSTA VST balance after has increased
      const VSTAStaking_VSTBalance_After = await vstToken.balanceOf(vstaStaking.address)
      assert.isTrue(VSTAStaking_VSTBalance_After.gt(VSTAStaking_VSTBalance_Before))
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("openTrove(): borrowing at non-zero base records the (drawn debt + fee  + liq. reserve) on the Trove struct", async () => {
        // time fast-forwards 1 year, and multisig stakes 1 VSTA
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
        await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
        await vstaStaking.stake(dec(1, 18), { from: multisig })

        await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

        await troveManager.setBaseRate(erc20.address, dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow(erc20.address)

        // Check baseRate is now non-zero
        const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
        assert.isTrue(baseRate_1.gt(toBN('0')))

        const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
        assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        const D_VSTRequest = toBN(dec(20000, 18))

        // D withdraws VST
        const openTroveTx = await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, D_VSTRequest, ZERO_ADDRESS, ZERO_ADDRESS, { from: D, value: dec(200, 'ether') })
        const openTroveTx_Asset = await borrowerOperations.openTrove(erc20.address, dec(200, 'ether'), th._100pct, D_VSTRequest, ZERO_ADDRESS, ZERO_ADDRESS, { from: D })

        const emittedFee = toBN(th.getVSTFeeFromVSTBorrowingEvent(openTroveTx))
        assert.isTrue(toBN(emittedFee).gt(toBN('0')))

        const emittedFee_Asset = toBN(th.getVSTFeeFromVSTBorrowingEvent(openTroveTx_Asset))
        assert.isTrue(toBN(emittedFee_Asset).gt(toBN('0')))

        const newDebt = (await troveManager.Troves(D, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]
        const newDebt_Asset = (await troveManager.Troves(D, erc20.address))[th.TROVE_DEBT_INDEX]

        // Check debt on Trove struct equals drawn debt plus emitted fee
        th.assertIsApproximatelyEqual(newDebt, D_VSTRequest.add(emittedFee).add(VST_GAS_COMPENSATION), 100000)
        th.assertIsApproximatelyEqual(newDebt_Asset, D_VSTRequest.add(emittedFee_Asset).add(VST_GAS_COMPENSATION_ERC20), 100000)
      })
    }

    it("openTrove(): Borrowing at non-zero base rate increases the VSTA staking contract VST fees-per-unit-staked", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 VSTA
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
      await vstaStaking.stake(dec(1, 18), { from: multisig })

      // Check VSTA contract VST fees-per-unit-staked is zero
      const F_VST_Before = await vstaStaking.F_VST()
      assert.equal(F_VST_Before, '0')

      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // Check baseRate is now non-zero
      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      await openTrove({ extraVSTAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check VSTA contract VST fees-per-unit-staked has increased
      const F_VST_After = await vstaStaking.F_VST()
      assert.isTrue(F_VST_After.gt(F_VST_Before))
    })

    it("openTrove(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 VSTA
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await vstaToken.approve(vstaStaking.address, dec(1, 18), { from: multisig })
      await vstaStaking.stake(dec(1, 18), { from: multisig })

      // Check VSTA Staking contract balance before == 0
      const VSTAStaking_VSTBalance_Before = await vstToken.balanceOf(vstaStaking.address)
      assert.equal(VSTAStaking_VSTBalance_Before, '0')

      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(ZERO_ADDRESS, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(ZERO_ADDRESS)

      await troveManager.setBaseRate(erc20.address, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(erc20.address)

      // Check baseRate is non-zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const baseRate_1_Asset = await troveManager.baseRate(erc20.address)
      assert.isTrue(baseRate_1_Asset.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      const VSTRequest_D = toBN(dec(40000, 18))
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, VSTRequest_D, D, D, { from: D, value: dec(500, 'ether') })
      await borrowerOperations.openTrove(erc20.address, dec(500, 'ether'), th._100pct, VSTRequest_D, D, D, { from: D })

      // Check VSTA staking VST balance has increased
      const VSTAStaking_VSTBalance_After = await vstToken.balanceOf(vstaStaking.address)
      assert.isTrue(VSTAStaking_VSTBalance_After.gt(VSTAStaking_VSTBalance_Before))

      // Check D's VST balance now equals their requested VST
      const VSTBalance_D = await vstToken.balanceOf(D)
      assert.isTrue(VSTRequest_D.mul(toBN(2)).eq(VSTBalance_D))
    })

    it("openTrove(): Borrowing at zero base rate changes the VSTA staking contract VST fees-per-unit-staked", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(ZERO_ADDRESS)
      assert.equal(baseRate_1, '0')

      const baseRate_1_Asset = await troveManager.baseRate(ZERO_ADDRESS)
      assert.equal(baseRate_1_Asset, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // Check VST reward per VSTA staked == 0
      const F_VST_Before = await vstaStaking.F_VST()
      assert.equal(F_VST_Before, '0')

      // A stakes VSTA
      await vstaToken.unprotectedMint(A, dec(100, 18))
      await vstaStaking.stake(dec(100, 18), { from: A })

      // D opens trove 
      await openTrove({ extraVSTAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check VST reward per VSTA staked > 0
      const F_VST_After = await vstaStaking.F_VST()
      assert.isTrue(F_VST_After.gt(toBN('0')))
    })

    it("openTrove(): Borrowing at zero base rate charges minimum fee", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })

      const VSTRequest = toBN(dec(10000, 18))
      const txC = await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, VSTRequest, ZERO_ADDRESS, ZERO_ADDRESS, { value: dec(100, 'ether'), from: C })
      const txC_Asset = await borrowerOperations.openTrove(erc20.address, dec(100, 'ether'), th._100pct, VSTRequest, ZERO_ADDRESS, ZERO_ADDRESS, { from: C })
      const _VSTFee = toBN(th.getEventArgByName(txC, "VSTBorrowingFeePaid", "_VSTFee"))
      const _VSTFee_Asset = toBN(th.getEventArgByName(txC_Asset, "VSTBorrowingFeePaid", "_VSTFee"))

      const expectedFee = BORROWING_FEE_FLOOR.mul(toBN(VSTRequest)).div(toBN(dec(1, 18)))
      const expectedFee_Asset = BORROWING_FEE_FLOOR_ERC20.mul(toBN(VSTRequest)).div(toBN(dec(1, 18)))
      assert.isTrue(_VSTFee.eq(expectedFee))
      assert.isTrue(_VSTFee_Asset.eq(expectedFee_Asset))
    })

    it("openTrove(): reverts when system is in Recovery Mode and ICR < CCR", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      // price drops, and Recovery Mode kicks in
      await priceFeed.setPrice(dec(105, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      // Bob tries to open a trove with 149% ICR during Recovery Mode
      try {
        const txBob = await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(149, 16)), extraParams: { from: alice } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Bob tries to open a trove with 149% ICR during Recovery Mode
      try {
        const txBob_Asset = await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(149, 16)), extraParams: { from: alice } })
        assert.isFalse(txBob_Asset.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("openTrove(): reverts when trove ICR < MCR", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      // Bob attempts to open a 109% ICR trove in Normal Mode
      try {
        const txBob = (await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(109, 16)), extraParams: { from: bob } })).tx
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try {
        const txBob = (await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(109, 16)), extraParams: { from: bob } })).tx
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // price drops, and Recovery Mode kicks in
      await priceFeed.setPrice(dec(105, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      // Bob attempts to open a 109% ICR trove in Recovery Mode
      try {
        const txBob = await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(109, 16)), extraParams: { from: bob } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try {
        const txBob = await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(109, 16)), extraParams: { from: bob } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("openTrove(): reverts when opening the trove would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18))

      // Alice creates trove with 150% ICR.  System TCR = 150%.
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })

      const TCR = await th.getTCR(contracts)
      assert.equal(TCR, dec(150, 16))

      const TCR_Asset = await th.getTCR(contracts, erc20.address)
      assert.equal(TCR_Asset, dec(150, 16))

      // Bob attempts to open a trove with ICR = 149% 
      // System TCR would fall below 150%
      try {
        const txBob = await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(149, 16)), extraParams: { from: bob } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try {
        const txBob = await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(149, 16)), extraParams: { from: bob } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("openTrove(): reverts if trove is already active", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      try {
        const txB_1 = await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: bob } })
        assert.isFalse(txB_1.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }

      try {
        const txB_1 = await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: bob } })
        assert.isFalse(txB_1.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }

      try {
        const txB_2 = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
        assert.isFalse(txB_2.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }

      try {
        const txB_2 = await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
        assert.isFalse(txB_2.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
    })

    it("openTrove(): Can open a trove with ICR >= CCR when system is in Recovery Mode", async () => {
      // --- SETUP ---
      //  Alice and Bob add coll and withdraw such  that the TCR is ~150%
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      const TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')

      const TCR_Asset = (await th.getTCR(contracts, erc20.address)).toString()
      assert.equal(TCR_Asset, '1500000000000000000')

      // price drops to 1ETH:100VST, reducing TCR below 150%
      await priceFeed.setPrice('100000000000000000000');
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      // Carol opens at 150% ICR in Recovery Mode
      const txCarol = (await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: carol } })).tx
      const txCarol_Asset = (await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: carol } })).tx
      assert.isTrue(txCarol.receipt.status)
      assert.isTrue(txCarol_Asset.receipt.status)
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
      assert.isTrue(await sortedTroves.contains(erc20.address, carol))

      const carol_TroveStatus = await troveManager.getTroveStatus(ZERO_ADDRESS, carol)
      assert.equal(carol_TroveStatus, 1)

      const carol_TroveStatus_Asset = await troveManager.getTroveStatus(erc20.address, carol)
      assert.equal(carol_TroveStatus_Asset, 1)

      const carolICR = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
      assert.isTrue(carolICR.gt(toBN(dec(150, 16))))

      const carolICR_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
      assert.isTrue(carolICR_Asset.gt(toBN(dec(150, 16))))
    })

    it("openTrove(): Reverts opening a trove with min debt when system is in Recovery Mode", async () => {
      // --- SETUP ---
      //  Alice and Bob add coll and withdraw such  that the TCR is ~150%
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      const TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')

      const TCR_Asset = (await th.getTCR(contracts, erc20.address)).toString()
      assert.equal(TCR_Asset, '1500000000000000000')

      // price drops to 1ETH:100VST, reducing TCR below 150%
      await priceFeed.setPrice('100000000000000000000');

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      await assertRevert(borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT, ZERO_ADDRESS), carol, carol, { from: carol, value: dec(1, 'ether') }))
      await assertRevert(borrowerOperations.openTrove(erc20.address, dec(1, 'ether'), th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT_ERC20, erc20.address), carol, carol, { from: carol }))
    })

    it("openTrove(): creates a new Trove and assigns the correct collateral and debt amount", async () => {
      const debt_Before = await getTroveEntireDebt(alice)
      const coll_Before = await getTroveEntireColl(alice)
      const status_Before = await troveManager.getTroveStatus(ZERO_ADDRESS, alice)

      const debt_Before_Asset = await getTroveEntireDebt(alice, erc20.address)
      const coll_Before_Asset = await getTroveEntireColl(alice, erc20.address)
      const status_Before_Asset = await troveManager.getTroveStatus(erc20.address, alice)

      // check coll and debt before
      assert.equal(debt_Before, 0)
      assert.equal(coll_Before, 0)

      // check non-existent status
      assert.equal(status_Before, 0)

      assert.equal(debt_Before_Asset, 0)
      assert.equal(coll_Before_Asset, 0)
      // check non-existent status
      assert.equal(status_Before_Asset, 0)

      const VSTRequest = MIN_NET_DEBT
      const VSTRequestERC20 = MIN_NET_DEBT_ERC20
      borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, MIN_NET_DEBT, carol, carol, { from: alice, value: dec(100, 'ether') })
      borrowerOperations.openTrove(erc20.address, dec(100, 'ether'), th._100pct, MIN_NET_DEBT_ERC20, carol, carol, { from: alice })

      // Get the expected debt based on the VST request (adding fee and liq. reserve on top)
      const expectedDebt = VSTRequest
        .add(await troveManager.getBorrowingFee(ZERO_ADDRESS, VSTRequest))
        .add(VST_GAS_COMPENSATION)

      const expectedDebt_Asset = VSTRequestERC20
        .add(await troveManager.getBorrowingFee(erc20.address, VSTRequestERC20))
        .add(VST_GAS_COMPENSATION_ERC20)

      const debt_After = await getTroveEntireDebt(alice)
      const coll_After = await getTroveEntireColl(alice)
      const status_After = await troveManager.getTroveStatus(ZERO_ADDRESS, alice)

      const debt_After_Asset = await getTroveEntireDebt(alice, erc20.address)
      const coll_After_Asset = await getTroveEntireColl(alice, erc20.address)
      const status_After_Asset = await troveManager.getTroveStatus(erc20.address, alice)

      // check coll and debt after
      assert.isTrue(coll_After.gt('0'))
      assert.isTrue(debt_After.gt('0'))
      assert.isTrue(debt_After.eq(expectedDebt))

      assert.isTrue(coll_After_Asset.gt('0'))
      assert.isTrue(debt_After_Asset.gt('0'))
      assert.isTrue(debt_After_Asset.eq(expectedDebt_Asset))

      // check active status
      assert.equal(status_After, 1)
      assert.equal(status_After_Asset, 1)
    })

    it("openTrove(): adds Trove owner to TroveOwners array", async () => {
      const TroveOwnersCount_Before = (await troveManager.getTroveOwnersCount(ZERO_ADDRESS)).toString();
      assert.equal(TroveOwnersCount_Before, '0')

      const TroveOwnersCount_Before_Asset = (await troveManager.getTroveOwnersCount(erc20.address)).toString();
      assert.equal(TroveOwnersCount_Before_Asset, '0')

      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })

      const TroveOwnersCount_After = (await troveManager.getTroveOwnersCount(ZERO_ADDRESS)).toString();
      const TroveOwnersCount_After_Asset = (await troveManager.getTroveOwnersCount(erc20.address)).toString();
      assert.equal(TroveOwnersCount_After, '1')
      assert.equal(TroveOwnersCount_After_Asset, '1')
    })

    it("openTrove(): creates a stake and adds it to total stakes", async () => {
      const aliceStakeBefore = await getTroveStake(alice)
      const totalStakesBefore = await troveManager.totalStakes(ZERO_ADDRESS)

      const aliceStakeBefore_Asset = await getTroveStake(alice, erc20.address)
      const totalStakesBefore_Asset = await troveManager.totalStakes(erc20.address)

      assert.equal(aliceStakeBefore, '0')
      assert.equal(totalStakesBefore, '0')
      assert.equal(aliceStakeBefore_Asset, '0')
      assert.equal(totalStakesBefore_Asset, '0')

      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceCollAfter = await getTroveEntireColl(alice)
      const aliceStakeAfter = await getTroveStake(alice)
      const aliceCollAfter_Asset = await getTroveEntireColl(alice, erc20.address)
      const aliceStakeAfter_Asset = await getTroveStake(alice, erc20.address)

      assert.isTrue(aliceCollAfter.gt(toBN('0')))
      assert.isTrue(aliceStakeAfter.eq(aliceCollAfter))

      assert.isTrue(aliceCollAfter_Asset.gt(toBN('0')))
      assert.isTrue(aliceStakeAfter_Asset.eq(aliceCollAfter_Asset))

      const totalStakesAfter = await troveManager.totalStakes(ZERO_ADDRESS)
      const totalStakesAfter_Asset = await troveManager.totalStakes(erc20.address)

      assert.isTrue(totalStakesAfter.eq(aliceStakeAfter))
      assert.isTrue(totalStakesAfter_Asset.eq(aliceStakeAfter_Asset))
    })

    it("openTrove(): inserts Trove to Sorted Troves list", async () => {
      // Check before
      const aliceTroveInList_Before = await sortedTroves.contains(ZERO_ADDRESS, alice)
      const listIsEmpty_Before = await sortedTroves.isEmpty(ZERO_ADDRESS)

      const aliceTroveInList_Before_Asset = await sortedTroves.contains(erc20.address, alice)
      const listIsEmpty_Before_Asset = await sortedTroves.isEmpty(erc20.address)

      assert.equal(aliceTroveInList_Before, false)
      assert.equal(listIsEmpty_Before, true)

      assert.equal(aliceTroveInList_Before_Asset, false)
      assert.equal(listIsEmpty_Before_Asset, true)

      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // check after
      const aliceTroveInList_After = await sortedTroves.contains(ZERO_ADDRESS, alice)
      const listIsEmpty_After = await sortedTroves.isEmpty(ZERO_ADDRESS)

      const aliceTroveInList_After_Asset = await sortedTroves.contains(erc20.address, alice)
      const listIsEmpty_After_Asset = await sortedTroves.isEmpty(erc20.address)

      assert.equal(aliceTroveInList_After, true)
      assert.equal(listIsEmpty_After, false)
      assert.equal(aliceTroveInList_After_Asset, true)
      assert.equal(listIsEmpty_After_Asset, false)
    })

    it("openTrove(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
      const activePool_ETH_Before = await activePool.getAssetBalance(ZERO_ADDRESS)
      const activePool_RawEther_Before = await web3.eth.getBalance(activePool.address)
      const activePool_ETH_Before_Asset = await activePool.getAssetBalance(erc20.address)
      const activePool_RawEther_Before_Asset = await erc20.balanceOf(activePool.address)

      assert.equal(activePool_ETH_Before, 0)
      assert.equal(activePool_RawEther_Before, 0)

      assert.equal(activePool_ETH_Before_Asset, 0)
      assert.equal(activePool_RawEther_Before_Asset, 0)

      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollAfter = await getTroveEntireColl(alice)
      const aliceCollAfter_Asset = await getTroveEntireColl(alice, erc20.address)

      const activePool_ETH_After = await activePool.getAssetBalance(ZERO_ADDRESS)
      const activePool_RawEther_After = toBN(await web3.eth.getBalance(activePool.address))
      const activePool_ETH_After_Asset = await activePool.getAssetBalance(erc20.address)
      const activePool_RawEther_After_Asset = toBN(await erc20.balanceOf(activePool.address))


      assert.isTrue(activePool_ETH_After.eq(aliceCollAfter))
      assert.isTrue(activePool_RawEther_After.eq(aliceCollAfter))
      assert.isTrue(activePool_ETH_After_Asset.eq(aliceCollAfter_Asset))
      assert.isTrue(activePool_RawEther_After_Asset.eq(aliceCollAfter_Asset.div(toBN(10 ** 10))))
    })

    it("openTrove(): records up-to-date initial snapshots of L_ETH and L_VSTDebt", async () => {
      // --- SETUP ---

      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // --- TEST ---

      // price drops to 1ETH:100VST, reducing Carol's ICR below MCR
      await priceFeed.setPrice(dec(100, 18));

      // close Carol's Trove, liquidating her 1 ether and 180VST.
      await troveManager.liquidate(ZERO_ADDRESS, carol, { from: owner });
      await troveManager.liquidate(erc20.address, carol, { from: owner });

      /* with total stakes = 10 ether, after liquidation, L_ETH should equal 1/10 ether per-ether-staked,
       and L_VST should equal 18 VST per-ether-staked. */

      const L_ETH = await troveManager.L_ASSETS(ZERO_ADDRESS)
      const L_VST = await troveManager.L_VSTDebts(ZERO_ADDRESS)

      const L_Asset = await troveManager.L_ASSETS(erc20.address)
      const L_VST_Asset = await troveManager.L_VSTDebts(erc20.address)

      assert.isTrue(L_ETH.gt(toBN('0')))
      assert.isTrue(L_VST.gt(toBN('0')))
      assert.isTrue(L_Asset.gt(toBN('0')))
      assert.isTrue(L_VST_Asset.gt(toBN('0')))

      // Bob opens trove
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Check Bob's snapshots of L_ETH and L_VST equal the respective current values
      const bob_rewardSnapshot = await troveManager.rewardSnapshots(bob, ZERO_ADDRESS)
      const bob_ETHrewardSnapshot = bob_rewardSnapshot[0]
      const bob_VSTDebtRewardSnapshot = bob_rewardSnapshot[1]

      const bob_rewardSnapshot_Asset = await troveManager.rewardSnapshots(bob, erc20.address)
      const bob_ETHrewardSnapshot_Asset = bob_rewardSnapshot_Asset[0]
      const bob_VSTDebtRewardSnapshot_Asset = bob_rewardSnapshot_Asset[1]

      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot, L_ETH), 1000)
      assert.isAtMost(th.getDifference(bob_VSTDebtRewardSnapshot, L_VST), 1000)

      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot, L_Asset), 1000)
      assert.isAtMost(th.getDifference(bob_VSTDebtRewardSnapshot, L_VST_Asset), 1000)
    })

    it("openTrove(): allows a user to open a Trove, then close it, then re-open it", async () => {
      // Open Troves
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // Check Trove is active
      const alice_Trove_1 = await troveManager.Troves(alice, ZERO_ADDRESS)
      const status_1 = alice_Trove_1[th.TROVE_STATUS_INDEX]
      assert.equal(status_1, 1)
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))

      const alice_Trove_1_Asset = await troveManager.Troves(alice, erc20.address)
      const status_1_Asset = alice_Trove_1_Asset[th.TROVE_STATUS_INDEX]
      assert.equal(status_1_Asset, 1)
      assert.isTrue(await sortedTroves.contains(erc20.address, alice))

      // to compensate borrowing fees
      await vstToken.transfer(alice, dec(10000, 18), { from: whale })

      // Repay and close Trove
      await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice })


      await vstToken.transfer(alice, dec(10000, 18), { from: whale })
      await borrowerOperations.closeTrove(erc20.address, { from: alice })

      // Check Trove is closed
      const alice_Trove_2 = await troveManager.Troves(alice, ZERO_ADDRESS)
      const status_2 = alice_Trove_2[th.TROVE_STATUS_INDEX]
      assert.equal(status_2, 2)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))

      const alice_Trove_2_Asset = await troveManager.Troves(alice, erc20.address)
      const status_2_Asset = alice_Trove_2_Asset[th.TROVE_STATUS_INDEX]
      assert.equal(status_2_Asset, 2)
      assert.isFalse(await sortedTroves.contains(erc20.address, alice))

      // Re-open Trove
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // Check Trove is re-opened
      const alice_Trove_3 = await troveManager.Troves(alice, ZERO_ADDRESS)
      const status_3 = alice_Trove_3[th.TROVE_STATUS_INDEX]
      assert.equal(status_3, 1)
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))

      const alice_Trove_3_Asset = await troveManager.Troves(alice, erc20.address)
      const status_3_Asset = alice_Trove_3_Asset[th.TROVE_STATUS_INDEX]
      assert.equal(status_3_Asset, 1)
      assert.isTrue(await sortedTroves.contains(erc20.address, alice))
    })

    it("openTrove(): increases the Trove's VST debt by the correct amount", async () => {
      // check before
      const alice_Trove_Before = await troveManager.Troves(alice, ZERO_ADDRESS)
      const debt_Before = alice_Trove_Before[th.TROVE_DEBT_INDEX]
      assert.equal(debt_Before, 0)

      const alice_Trove_Before_Asset = await troveManager.Troves(alice, erc20.address)
      const debt_Before_Asset = alice_Trove_Before_Asset[th.TROVE_DEBT_INDEX]
      assert.equal(debt_Before_Asset, 0)

      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getOpenTroveVSTAmount(dec(10000, 18), ZERO_ADDRESS), alice, alice, { from: alice, value: dec(100, 'ether') })
      await borrowerOperations.openTrove(erc20.address, dec(100, 'ether'), th._100pct, await getOpenTroveVSTAmount(dec(10000, 18), ZERO_ADDRESS), alice, alice, { from: alice })

      // check after
      const alice_Trove_After = await troveManager.Troves(alice, ZERO_ADDRESS)
      const debt_After = alice_Trove_After[th.TROVE_DEBT_INDEX]
      th.assertIsApproximatelyEqual(debt_After, dec(10000, 18), 10000)

      const alice_Trove_After_Asset = await troveManager.Troves(alice, erc20.address)
      const debt_After_Asset = alice_Trove_After_Asset[th.TROVE_DEBT_INDEX]
      th.assertIsApproximatelyEqual(debt_After_Asset, dec(10000, 18), 10000)
    })

    it("openTrove(): increases VST debt in ActivePool by the debt of the trove", async () => {
      const activePooL_VSTDebt_Before = await activePool.getVSTDebt(ZERO_ADDRESS)
      const activePooL_VSTDebt_Before_Asset = await activePool.getVSTDebt(erc20.address)
      assert.equal(activePooL_VSTDebt_Before, 0)
      assert.equal(activePooL_VSTDebt_Before_Asset, 0)

      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceDebt = await getTroveEntireDebt(alice)
      const aliceDebt_Asset = await getTroveEntireDebt(alice, erc20.address)
      assert.isTrue(aliceDebt.gt(toBN('0')))
      assert.isTrue(aliceDebt_Asset.gt(toBN('0')))

      const activePooL_VSTDebt_After = await activePool.getVSTDebt(ZERO_ADDRESS)
      const activePooL_VSTDebt_After_Asset = await activePool.getVSTDebt(erc20.address)
      assert.isTrue(activePooL_VSTDebt_After.eq(aliceDebt))
      assert.isTrue(activePooL_VSTDebt_After_Asset.eq(aliceDebt_Asset))
    })

    it("openTrove(): increases user VSTToken balance by correct amount", async () => {
      // check before
      const alice_VSTTokenBalance_Before = await vstToken.balanceOf(alice)
      assert.equal(alice_VSTTokenBalance_Before, 0)
      const troveColl = dec(100, 'ether');

      await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, dec(10000, 18), alice, alice, { from: alice, value: troveColl })
      await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, dec(10000, 18), alice, alice, { from: alice })

      // check after
      const alice_VSTTokenBalance_After = await vstToken.balanceOf(alice)
      assert.equal(alice_VSTTokenBalance_After, dec(20000, 18))
    })

    //  --- getNewICRFromTroveChange - (external wrapper in Tester contract calls internal function) ---

    describe("getNewICRFromTroveChange() returns the correct ICR", async () => {


      // 0, 0
      it("collChange = 0, debtChange = 0", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = 0

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // 0, +ve
      it("collChange = 0, debtChange is positive", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
        assert.isAtMost(th.getDifference(newICR, '1333333333333333333'), 100)
      })

      // 0, -ve
      it("collChange = 0, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, false, price)).toString()
        assert.equal(newICR, '4000000000000000000')
      })

      // +ve, 0
      it("collChange is positive, debtChange is 0", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(1, 'ether')
        const debtChange = 0

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
        assert.equal(newICR, '4000000000000000000')
      })

      // -ve, 0
      it("collChange is negative, debtChange is 0", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(5, 17)
        const debtChange = 0

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, false, debtChange, true, price)).toString()
        assert.equal(newICR, '1000000000000000000')
      })

      // -ve, -ve
      it("collChange is negative, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(5, 17)
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, false, debtChange, false, price)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // +ve, +ve 
      it("collChange is positive, debtChange is positive", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(1, 'ether')
        const debtChange = dec(100, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // +ve, -ve
      it("collChange is positive, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(1, 'ether')
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, false, price)).toString()
        assert.equal(newICR, '8000000000000000000')
      })

      // -ve, +ve
      it("collChange is negative, debtChange is positive", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(5, 17)
        const debtChange = dec(100, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, false, debtChange, true, price)).toString()
        assert.equal(newICR, '500000000000000000')
      })
    })

    // --- getCompositeDebt ---

    it("getCompositeDebt(): returns debt + gas comp", async () => {
      assert.equal(await borrowerOperations.getCompositeDebt(ZERO_ADDRESS, '0'), VST_GAS_COMPENSATION.toString())

      th.assertIsApproximatelyEqual(
        await borrowerOperations.getCompositeDebt(ZERO_ADDRESS, dec(90, 18)), VST_GAS_COMPENSATION.add(toBN(dec(90, 18))))
      th.assertIsApproximatelyEqual(
        await borrowerOperations.getCompositeDebt(ZERO_ADDRESS, dec(24423422357345049, 12)), VST_GAS_COMPENSATION.add(toBN(dec(24423422357345049, 12))))

      assert.equal(await borrowerOperations.getCompositeDebt(erc20.address, '0'), VST_GAS_COMPENSATION_ERC20.toString())

      th.assertIsApproximatelyEqual(
        await borrowerOperations.getCompositeDebt(erc20.address, dec(90, 18)), VST_GAS_COMPENSATION_ERC20.add(toBN(dec(90, 18))))
      th.assertIsApproximatelyEqual(
        await borrowerOperations.getCompositeDebt(erc20.address, dec(24423422357345049, 12)), VST_GAS_COMPENSATION_ERC20.add(toBN(dec(24423422357345049, 12))))
    })

    //  --- getNewTCRFromTroveChange  - (external wrapper in Tester contract calls internal function) ---

    describe("getNewTCRFromTroveChange() returns the correct TCR", async () => {

      // 0, 0
      it("collChange = 0, debtChange = 0", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveVSTAmount = await getOpenTroveVSTAmount(troveTotalDebt, ZERO_ADDRESS)
        const troveVSTAmount_Asset = await getOpenTroveVSTAmount(troveTotalDebt, erc20.address)

        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, alice, alice, { from: alice, value: troveColl })
        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, bob, bob, { from: bob, value: troveColl })

        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, alice, alice, { from: alice })
        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, bob, bob, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(ZERO_ADDRESS, bob)
        assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))

        const liquidationTx_Asset = await troveManager.liquidate(erc20.address, bob)
        assert.isFalse(await sortedTroves.contains(erc20.address, bob))

        const [liquidatedDebt, liquidatedColl] = th.getEmittedLiquidationValues(liquidationTx)
        const [liquidatedDebt_Asset, liquidatedColl_Asset] = th.getEmittedLiquidationValues(liquidationTx_Asset)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = 0
        const debtChange = 0
        const newTCR = await borrowerOperations.getNewTCRFromTroveChange(ZERO_ADDRESS, collChange, true, debtChange, true, price)
        const newTCR_Asset = await borrowerOperations.getNewTCRFromTroveChange(erc20.address, collChange, true, debtChange, true, price)

        const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt))
        const expectedTCR_Asset = (troveColl.add(liquidatedColl_Asset)).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt_Asset))

        assert.isTrue(newTCR.eq(expectedTCR))
        assert.isTrue(newTCR_Asset.eq(expectedTCR_Asset))
      })

      // 0, +ve
      it("collChange = 0, debtChange is positive", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveVSTAmount = await getOpenTroveVSTAmount(troveTotalDebt, ZERO_ADDRESS)
        const troveVSTAmount_Asset = await getOpenTroveVSTAmount(troveTotalDebt, erc20.address)

        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, alice, alice, { from: alice, value: troveColl })
        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, bob, bob, { from: bob, value: troveColl })

        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, alice, alice, { from: alice })
        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, bob, bob, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(ZERO_ADDRESS, bob)
        assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))

        const liquidationTx_Asset = await troveManager.liquidate(erc20.address, bob)
        assert.isFalse(await sortedTroves.contains(erc20.address, bob))

        const [liquidatedDebt, liquidatedColl] = th.getEmittedLiquidationValues(liquidationTx)
        const [liquidatedDebt_Asset, liquidatedColl_Asset] = th.getEmittedLiquidationValues(liquidationTx_Asset)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = 0
        const debtChange = dec(200, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(ZERO_ADDRESS, collChange, true, debtChange, true, price))
        const newTCR_Asset = (await borrowerOperations.getNewTCRFromTroveChange(erc20.address, collChange, true, debtChange, true, price))

        const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).add(toBN(debtChange)))

        const expectedTCR_Asset = (troveColl.add(liquidatedColl_Asset)).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt_Asset).add(toBN(debtChange)))

        assert.isTrue(newTCR.eq(expectedTCR))
        assert.isTrue(newTCR_Asset.eq(expectedTCR_Asset))
      })

      // 0, -ve
      it("collChange = 0, debtChange is negative", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveVSTAmount = await getOpenTroveVSTAmount(troveTotalDebt, ZERO_ADDRESS)
        const troveVSTAmount_Asset = await getOpenTroveVSTAmount(troveTotalDebt, erc20.address)

        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, alice, alice, { from: alice, value: troveColl })
        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, bob, bob, { from: bob, value: troveColl })

        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, alice, alice, { from: alice })
        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, bob, bob, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(ZERO_ADDRESS, bob)
        const liquidationTx_Asset = await troveManager.liquidate(erc20.address, bob)

        assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
        assert.isFalse(await sortedTroves.contains(erc20.address, bob))

        const [liquidatedDebt, liquidatedColl] = th.getEmittedLiquidationValues(liquidationTx)
        const [liquidatedDebt_Asset, liquidatedColl_Asset] = th.getEmittedLiquidationValues(liquidationTx_Asset)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = 0
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(ZERO_ADDRESS, collChange, true, debtChange, false, price))
        const newTCR_Asset = (await borrowerOperations.getNewTCRFromTroveChange(erc20.address, collChange, true, debtChange, false, price))

        const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).sub(toBN(dec(100, 18))))
        const expectedTCR_Asset = (troveColl.add(liquidatedColl_Asset)).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt_Asset).sub(toBN(dec(100, 18))))

        assert.isTrue(newTCR.eq(expectedTCR))
        assert.isTrue(newTCR_Asset.eq(expectedTCR_Asset))
      })

      // +ve, 0
      it("collChange is positive, debtChange is 0", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveVSTAmount = await getOpenTroveVSTAmount(troveTotalDebt, ZERO_ADDRESS)
        const troveVSTAmount_Asset = await getOpenTroveVSTAmount(troveTotalDebt, erc20.address)

        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, alice, alice, { from: alice, value: troveColl })
        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, bob, bob, { from: bob, value: troveColl })

        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, alice, alice, { from: alice })
        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, bob, bob, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(ZERO_ADDRESS, bob)
        const liquidationTx_Asset = await troveManager.liquidate(erc20.address, bob)

        assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
        assert.isFalse(await sortedTroves.contains(erc20.address, bob))

        const [liquidatedDebt, liquidatedColl] = th.getEmittedLiquidationValues(liquidationTx)
        const [liquidatedDebt_Asset, liquidatedColl_Asset] = th.getEmittedLiquidationValues(liquidationTx_Asset)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()
        // --- TEST ---
        const collChange = dec(2, 'ether')
        const debtChange = 0
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(ZERO_ADDRESS, collChange, true, debtChange, true, price))
        const newTCR_Asset = (await borrowerOperations.getNewTCRFromTroveChange(erc20.address, collChange, true, debtChange, true, price))

        const expectedTCR = (troveColl.add(liquidatedColl).add(toBN(collChange))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt))
        const expectedTCR_Asset = (troveColl.add(liquidatedColl_Asset).add(toBN(collChange))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt_Asset))

        assert.isTrue(newTCR.eq(expectedTCR))
        assert.isTrue(newTCR_Asset.eq(expectedTCR_Asset))
      })

      // -ve, 0
      it("collChange is negative, debtChange is 0", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveVSTAmount = await getOpenTroveVSTAmount(troveTotalDebt, ZERO_ADDRESS)
        const troveVSTAmount_Asset = await getOpenTroveVSTAmount(troveTotalDebt, erc20.address)

        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, alice, alice, { from: alice, value: troveColl })
        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, bob, bob, { from: bob, value: troveColl })

        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, alice, alice, { from: alice })
        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, bob, bob, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(ZERO_ADDRESS, bob)
        const liquidationTx_Asset = await troveManager.liquidate(erc20.address, bob)

        assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
        assert.isFalse(await sortedTroves.contains(erc20.address, bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)
        const [liquidatedDebt_Asset, liquidatedColl_Asset, gasComp_Asset] = th.getEmittedLiquidationValues(liquidationTx_Asset)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = 0
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(ZERO_ADDRESS, collChange, false, debtChange, true, price))
        const newTCR_Asset = (await borrowerOperations.getNewTCRFromTroveChange(ZERO_ADDRESS, collChange, false, debtChange, true, price))

        const expectedTCR = (troveColl.add(liquidatedColl).sub(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt))

        const expectedTCR_Asset = (troveColl.add(liquidatedColl_Asset).sub(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt_Asset))

        assert.isTrue(newTCR.eq(expectedTCR))
        assert.isTrue(newTCR_Asset.eq(expectedTCR_Asset))
      })

      // -ve, -ve
      it("collChange is negative, debtChange is negative", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveVSTAmount = await getOpenTroveVSTAmount(troveTotalDebt, ZERO_ADDRESS)
        const troveVSTAmount_Asset = await getOpenTroveVSTAmount(troveTotalDebt, erc20.address)

        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, alice, alice, { from: alice, value: troveColl })
        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, bob, bob, { from: bob, value: troveColl })

        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, alice, alice, { from: alice })
        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, bob, bob, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(ZERO_ADDRESS, bob)
        const liquidationTx_Asset = await troveManager.liquidate(erc20.address, bob)

        assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
        assert.isFalse(await sortedTroves.contains(erc20.address, bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)
        const [liquidatedDebt_Asset, liquidatedColl_Asset, gasComp_Asset] = th.getEmittedLiquidationValues(liquidationTx_Asset)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(ZERO_ADDRESS, collChange, false, debtChange, false, price))
        const newTCR_Asset = (await borrowerOperations.getNewTCRFromTroveChange(erc20.address, collChange, false, debtChange, false, price))

        const expectedTCR = (troveColl.add(liquidatedColl).sub(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).sub(toBN(dec(100, 18))))

        const expectedTCR_Asset = (troveColl.add(liquidatedColl_Asset).sub(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt_Asset).sub(toBN(dec(100, 18))))

        assert.isTrue(newTCR.eq(expectedTCR))
        assert.isTrue(newTCR_Asset.eq(expectedTCR_Asset))
      })

      // +ve, +ve 
      it("collChange is positive, debtChange is positive", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveVSTAmount = await getOpenTroveVSTAmount(troveTotalDebt, ZERO_ADDRESS)
        const troveVSTAmount_Asset = await getOpenTroveVSTAmount(troveTotalDebt, erc20.address)

        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, alice, alice, { from: alice, value: troveColl })
        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, bob, bob, { from: bob, value: troveColl })

        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, alice, alice, { from: alice })
        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, bob, bob, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(ZERO_ADDRESS, bob)
        const liquidationTx_Asset = await troveManager.liquidate(erc20.address, bob)

        assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
        assert.isFalse(await sortedTroves.contains(erc20.address, bob))

        const [liquidatedDebt, liquidatedColl] = th.getEmittedLiquidationValues(liquidationTx)
        const [liquidatedDebt_Asset, liquidatedColl_Asset] = th.getEmittedLiquidationValues(liquidationTx_Asset)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 'ether')
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(ZERO_ADDRESS, collChange, true, debtChange, true, price))
        const newTCR_Asset = (await borrowerOperations.getNewTCRFromTroveChange(erc20.address, collChange, true, debtChange, true, price))

        const expectedTCR = (troveColl.add(liquidatedColl).add(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).add(toBN(dec(100, 18))))

        const expectedTCR_Asset = (troveColl.add(liquidatedColl_Asset).add(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt_Asset).add(toBN(dec(100, 18))))

        assert.isTrue(newTCR.eq(expectedTCR))
        assert.isTrue(newTCR_Asset.eq(expectedTCR_Asset))
      })

      // +ve, -ve
      it("collChange is positive, debtChange is negative", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveVSTAmount = await getOpenTroveVSTAmount(troveTotalDebt, ZERO_ADDRESS)
        const troveVSTAmount_Asset = await getOpenTroveVSTAmount(troveTotalDebt, erc20.address)

        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, alice, alice, { from: alice, value: troveColl })
        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, bob, bob, { from: bob, value: troveColl })

        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, alice, alice, { from: alice })
        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, bob, bob, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(ZERO_ADDRESS, bob)
        const liquidationTx_Asset = await troveManager.liquidate(erc20.address, bob)

        assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
        assert.isFalse(await sortedTroves.contains(erc20.address, bob))

        const [liquidatedDebt, liquidatedColl] = th.getEmittedLiquidationValues(liquidationTx)
        const [liquidatedDebt_Asset, liquidatedColl_Asset] = th.getEmittedLiquidationValues(liquidationTx_Asset)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 'ether')
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(ZERO_ADDRESS, collChange, true, debtChange, false, price))
        const newTCR_Asset = (await borrowerOperations.getNewTCRFromTroveChange(erc20.address, collChange, true, debtChange, false, price))

        const expectedTCR = (troveColl.add(liquidatedColl).add(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).sub(toBN(dec(100, 18))))

        const expectedTCR_Asset = (troveColl.add(liquidatedColl_Asset).add(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt_Asset).sub(toBN(dec(100, 18))))

        assert.isTrue(newTCR.eq(expectedTCR))
        assert.isTrue(newTCR_Asset.eq(expectedTCR_Asset))
      })

      // -ve, +ve
      it("collChange is negative, debtChange is positive", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveVSTAmount = await getOpenTroveVSTAmount(troveTotalDebt, ZERO_ADDRESS)
        const troveVSTAmount_Asset = await getOpenTroveVSTAmount(troveTotalDebt, erc20.address)

        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, alice, alice, { from: alice, value: troveColl })
        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, troveVSTAmount, bob, bob, { from: bob, value: troveColl })

        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, alice, alice, { from: alice })
        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, troveVSTAmount_Asset, bob, bob, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(ZERO_ADDRESS, bob)
        const liquidationTx_Asset = await troveManager.liquidate(erc20.address, bob)

        assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
        assert.isFalse(await sortedTroves.contains(erc20.address, bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)
        const [liquidatedDebt_Asset, liquidatedColl_Asset] = th.getEmittedLiquidationValues(liquidationTx_Asset)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = await getNetBorrowingAmount(dec(200, 18), ZERO_ADDRESS)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(ZERO_ADDRESS, collChange, false, debtChange, true, price))
        const newTCR_Asset = (await borrowerOperations.getNewTCRFromTroveChange(erc20.address, collChange, false, debtChange, true, price))

        const expectedTCR = (troveColl.add(liquidatedColl).sub(toBN(collChange))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).add(toBN(debtChange)))

        const expectedTCR_Asset = (troveColl.add(liquidatedColl_Asset).sub(toBN(collChange))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt_Asset).add(toBN(debtChange)))

        assert.isTrue(newTCR.eq(expectedTCR))
        assert.isTrue(newTCR_Asset.eq(expectedTCR_Asset))
      })
    })

    if (!withProxy) {
      it('closeTrove(): fails if owner cannot receive ETH', async () => {
        const nonPayable = await NonPayable.new()
        const troveColl = dec(1000, 18)

        // we need 2 troves to be able to close 1 and have 1 remaining in the system
        await borrowerOperations.openTrove(ZERO_ADDRESS, troveColl, th._100pct, dec(100000, 18), alice, alice, { from: alice, value: troveColl })
        await borrowerOperations.openTrove(erc20.address, troveColl, th._100pct, dec(100000, 18), alice, alice, { from: alice })

        // Alice sends VST to NonPayable so its VST balance covers its debt
        await vstToken.transfer(nonPayable.address, dec(40000, 18), { from: alice })

        // open trove from NonPayable proxy contract
        const _100pctHex = '0xde0b6b3a7640000'
        const _1e25Hex = '0xd3c21bcecceda1000000'
        const _10000Ether = '0x21e19e0c9bab2400000'
        const openTroveData = th.getTransactionData('openTrove(address,uint256,uint256,uint256,address,address)', [ZERO_ADDRESS, 0, _100pctHex, _1e25Hex, '0x0', '0x0'])
        const openTroveData_Asset = th.getTransactionData('openTrove(address,uint256,uint256,uint256,address,address)', [erc20.address, _10000Ether, _100pctHex, _1e25Hex, '0x0', '0x0'])

        await nonPayable.forward(borrowerOperations.address, openTroveData, { value: dec(10000, 'ether') })
        // await nonPayable.forward(borrowerOperations.address, openTroveData_Asset);

        assert.equal((await troveManager.getTroveStatus(ZERO_ADDRESS, nonPayable.address)).toString(), '1', 'NonPayable proxy should have a trove')
        // assert.equal((await troveManager.getTroveStatus(erc20.address, nonPayable.address)).toString(), '1', 'NonPayable proxy should have a trove')

        assert.isFalse(await th.checkRecoveryMode(contracts), 'System should not be in Recovery Mode')
        // assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address), 'System should not be in Recovery Mode')
        // open trove from NonPayable proxy contract
        const closeTroveData = th.getTransactionData('closeTrove(address)', [ZERO_ADDRESS])
        // const closeTroveData_Asset = th.getTransactionData('closeTrove(address)', [erc20.address])

        await th.assertRevert(nonPayable.forward(borrowerOperations.address, closeTroveData), 'ActivePool: sending ETH failed')
        // await th.assertRevert(nonPayable.forward(borrowerOperations.address, closeTroveData_Asset), 'ActivePool: sending ETH failed')
      })
    }
  }

  describe('Without proxy', async () => {
    testCorpus({ withProxy: false })
  })

  // describe('With proxy', async () => {
  //   testCorpus({ withProxy: true })
  // })
})

contract('Reset chain state', async accounts => { })

/* TODO:

 1) Test SortedList re-ordering by ICR. ICR ratio
 changes with addColl, withdrawColl, withdrawVST, withdrawVST, etc. Can split them up and put them with
 individual functions, or give ordering it's own 'describe' block.

 2)In security phase:
 -'Negative' tests for all the above functions.
 */
