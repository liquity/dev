const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const NonPayable = artifacts.require('NonPayable.sol')

const th = testHelpers.TestHelper

const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const ZERO_ADDRESS = th.ZERO_ADDRESS
const assertRevert = th.assertRevert

/* NOTE: Some of the borrowing tests do not test for specific LUSD fee values. They only test that the 
 * fees are non-zero when they should occur, and that they decay over time.
 *
 * Specific LUSD fee values will depend on the final fee schedule used, and the final choice for
 *  the parameter MINUTE_DECAY_FACTOR in the TroveManager, which is still TBD based on economic
 * modelling.
 * 
 */ 

contract('BorrowerOperations', async accounts => {

  const [
    owner, alice, bob, carol, dennis, whale,
    A, B, C, D, E,
    // defaulter_1, defaulter_2,
    frontEnd_1, frontEnd_2, frontEnd_3] = accounts;

  // const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]

  let priceFeed
  let lusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  let contracts

  let LUSD_GAS_COMPENSATION

  before(async () => {

  })

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.borrowerOperations = await BorrowerOperationsTester.new()
    contracts = await deploymentHelper.deployLUSDToken(contracts)
    const LQTYContracts = await deploymentHelper.deployLQTYContracts()

    priceFeed = contracts.priceFeedTestnet
    lusdToken = contracts.lusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    lqtyStaking = LQTYContracts.lqtyStaking
    lqtyToken = LQTYContracts.lqtyToken
    communityIssuance = LQTYContracts.communityIssuance
    lockupContractFactory = LQTYContracts.lockupContractFactory

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
  
    LUSD_GAS_COMPENSATION = await borrowerOperations.LUSD_GAS_COMPENSATION()
  })

  it("addColl(): Increases the activePool ETH and raw ether balance by correct amount", async () => {

    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })

    const activePool_ETH_Before = await activePool.getETH()
    const activePool_RawEther_Before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_Before, dec(1, 'ether'))
    assert.equal(activePool_RawEther_Before, dec(1, 'ether'))

    await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(1, 'ether') })

    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, dec(2, 'ether'))
    assert.equal(activePool_RawEther_After, dec(2, 'ether'))
  })

  it("addColl(), active Trove: adds the correct collateral amount to the Trove", async () => {
    // alice creates a Trove and adds first collateral
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })

    const alice_Trove_Before = await troveManager.Troves(alice)
    coll_Before = alice_Trove_Before[1]
    const status_Before = alice_Trove_Before[3]

    // check coll and status before
    assert.equal(coll_Before, dec(1, 'ether'))
    assert.equal(status_Before, 1)

    // Alice adds second collateral
    await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(1, 'ether') })

    const alice_Trove_After = await troveManager.Troves(alice)
    const coll_After = alice_Trove_After[1]
    const status_After = alice_Trove_After[3]

    // check coll increases by correct amount,and status remains active
    assert.equal(coll_After, dec(2, 'ether'))
    assert.equal(status_After, 1)
  })

  it("addColl(), active Trove: Trove is in sortedList before and after", async () => {
    // alice creates a Trove and adds first collateral
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })

    // check Alice is in list before
    const aliceTroveInList_Before = await sortedTroves.contains(alice)
    const listIsEmpty_Before = await sortedTroves.isEmpty()
    assert.equal(aliceTroveInList_Before, true)
    assert.equal(listIsEmpty_Before, false)

    await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(1, 'ether') })

    // check Alice is still in list after
    const aliceTroveInList_After = await sortedTroves.contains(alice)
    const listIsEmpty_After = await sortedTroves.isEmpty()
    assert.equal(aliceTroveInList_After, true)
    assert.equal(listIsEmpty_After, false)
  })

  it("addColl(), active Trove: updates the stake and updates the total stakes", async () => {
    //  Alice creates initial Trove with 1 ether
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })

    const alice_Trove_Before = await troveManager.Troves(alice)
    const alice_Stake_Before = alice_Trove_Before[2].toString()
    const totalStakes_Before = (await troveManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '1000000000000000000')
    assert.equal(totalStakes_Before, '1000000000000000000')

    // Alice tops up Trove collateral with 2 ether
    await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(2, 'ether') })

    // Check stake and total stakes get updated
    const alice_Trove_After = await troveManager.Troves(alice)
    const alice_Stake_After = alice_Trove_After[2].toString()
    const totalStakes_After = (await troveManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, '3000000000000000000')
    assert.equal(totalStakes_After, '3000000000000000000')
  })

  it("addColl(), active Trove: applies pending rewards and updates user's L_ETH, L_LUSDDebt snapshots", async () => {
    // --- SETUP ---
    // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether.  Withdraw 90/90/170 LUSD (+ 10 LUSD for gas compensation)
    const LUSDwithdrawal_A = toBN(dec(90, 18))
    const LUSDwithdrawal_B = toBN(dec(90, 18))
    const LUSDwithdrawal_C = toBN(dec(170, 18))

    await borrowerOperations.openTrove(LUSDwithdrawal_A, alice, alice, { from: alice, value: dec(15, 'ether') })
    await borrowerOperations.openTrove(LUSDwithdrawal_B, bob, bob, { from: bob, value: dec(5, 'ether') })
    await borrowerOperations.openTrove(LUSDwithdrawal_C, carol, carol, { from: carol, value: dec(1, 'ether') })

    // --- TEST ---

    // price drops to 1ETH:100LUSD, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Close Carol's Trove, liquidating her 1 ether and 180LUSD.
    const tx = await troveManager.liquidate(carol, { from: owner });
    const liquidatedDebt_C = th.getEmittedLiquidatedDebt(tx)
    const liquidatedColl_C = th.getEmittedLiquidatedColl(tx)

    assert.isFalse(await sortedTroves.contains(carol))

    const L_ETH = await troveManager.L_ETH()
    const L_LUSDDebt = await troveManager.L_LUSDDebt()

    // check Alice and Bob's reward snapshots are zero before they alter their Troves
    const alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
    const alice_LUSDDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

    const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
    const bob_LUSDDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

    assert.equal(alice_ETHrewardSnapshot_Before, 0)
    assert.equal(alice_LUSDDebtRewardSnapshot_Before, 0)
    assert.equal(bob_ETHrewardSnapshot_Before, 0)
    assert.equal(bob_LUSDDebtRewardSnapshot_Before, 0)

    // Alice and Bob top up their Troves
    await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(5, 'ether') })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: dec(1, 'ether') })

    /* Check that both alice and Bob have had pending rewards applied in addition to their top-ups. 
    
    When Carol defaulted, her liquidated debt and coll was distributed to A and B in proportion to their 
    collateral shares.  
    */
    const expectedCollReward_A = liquidatedColl_C.mul(toBN(dec(15, 'ether'))).div(toBN(dec(20, 'ether')))
    const expectedDebtReward_A = liquidatedDebt_C.mul(toBN(dec(15, 'ether'))).div(toBN(dec(20, 'ether')))
    const expectedCollReward_B = liquidatedColl_C.mul(toBN(dec(5, 'ether'))).div(toBN(dec(20, 'ether')))
    const expectedDebtReward_B = liquidatedDebt_C.mul(toBN(dec(5, 'ether'))).div(toBN(dec(20, 'ether')))

    const alice_Trove_After = await troveManager.Troves(alice)
    const alice_LUSDDebt_After = alice_Trove_After[0]
    const alice_Coll_After = alice_Trove_After[1]

    const bob_Trove_After = await troveManager.Troves(bob)
    const bob_LUSDDebt_After = bob_Trove_After[0]
    const bob_Coll_After = bob_Trove_After[1]

    // Expect Alice coll = 15 + 5  + reward
    // Expect Bob coll = 5 + 1 + reward
    assert.isAtMost(th.getDifference(alice_Coll_After, toBN(dec(20, 'ether')).add(expectedCollReward_A)), 100)
    assert.isAtMost(th.getDifference(alice_LUSDDebt_After, LUSDwithdrawal_A.add(expectedDebtReward_A).add(toBN(dec(10, 18)))), 100)

    assert.isAtMost(th.getDifference(bob_Coll_After, toBN(dec(6, 'ether')).add(expectedCollReward_B)), 100)
    assert.isAtMost(th.getDifference(bob_LUSDDebt_After, LUSDwithdrawal_B.add(expectedDebtReward_B).add(toBN(dec(10, 18)))), 100)

    /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
    to the latest values of L_ETH and L_LUSDDebt */
    const alice_rewardSnapshot_After = await troveManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
    const alice_LUSDDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]

    const bob_rewardSnapshot_After = await troveManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
    const bob_LUSDDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]

    assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, L_ETH), 100)
    assert.isAtMost(th.getDifference(alice_LUSDDebtRewardSnapshot_After, L_LUSDDebt), 100)
    assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, L_ETH), 100)
    assert.isAtMost(th.getDifference(bob_LUSDDebtRewardSnapshot_After, L_LUSDDebt), 100)
  })

  // it("addColl(), active Trove: adds the right corrected stake after liquidations have occured", async () => {
  //  // TODO - check stake updates for addColl/withdrawColl/adustTrove ---

  //   // --- SETUP ---
  //   // A,B,C add 15/5/5 ETH, withdraw 100/100/900 LUSD
  //   await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(15, 'ether') })
  //   await borrowerOperations.openTrove(dec(100, 18), bob, bob, { from: bob, value: dec(4, 'ether') })
  //   await borrowerOperations.openTrove(dec(900, 18), carol, carol, { from: carol, value: dec(5, 'ether') })

  //   await borrowerOperations.openTrove(0, dennis, dennis, { from: dennis, value: dec(1, 'ether') })
  //   // --- TEST ---

  //   // price drops to 1ETH:100LUSD, reducing Carol's ICR below MCR
  //   await priceFeed.setPrice('100000000000000000000');

  //   // close Carol's Trove, liquidating her 5 ether and 900LUSD.
  //   await troveManager.liquidate(carol, { from: owner });

  //   // dennis tops up his trove by 1 ETH
  //   await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: dec(1, 'ether') })

  //   /* Check that Dennis's recorded stake is the right corrected stake, less than his collateral. A corrected 
  //   stake is given by the formula: 

  //   s = totalStakesSnapshot / totalCollateralSnapshot 

  //   where snapshots are the values immediately after the last liquidation.  After Carol's liquidation, 
  //   the ETH from her Trove has now become the totalPendingETHReward. So:

  //   totalStakes = (alice_Stake + bob_Stake + dennis_orig_stake ) = (15 + 4 + 1) =  20 ETH.
  //   totalCollateral = (alice_Collateral + bob_Collateral + dennis_orig_coll + totalPendingETHReward) = (15 + 4 + 1 + 5)  = 25 ETH.

  //   Therefore, as Dennis adds 1 ether collateral, his corrected stake should be:  s = 2 * (20 / 25 ) = 1.6 ETH */
  //   const dennis_Trove = await troveManager.Troves(dennis)

  //   const dennis_Stake = dennis_Trove[2]
  //   console.log(dennis_Stake.toString())

  //   assert.isAtMost(th.getDifference(dennis_Stake), 100)
  // })

  it("addColl(), reverts if trove is non-existent or closed", async () => {
    // A, B open troves
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), bob, bob, { from: bob, value: dec(1, 'ether') })

    // Carol attempts to add collateral to her non-existent trove
    try {
      const txCarol = await borrowerOperations.addColl(carol, carol, { from: carol, value: dec(1, 'ether') })
      assert.isFalse(txCarol.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Trove does not exist or is closed")
    }

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Bob gets liquidated
    await troveManager.liquidate(bob)

    assert.isFalse(await sortedTroves.contains(bob))

    // Bob attempts to add collateral to his closed trove
    try {
      const txBob = await borrowerOperations.addColl(bob, bob, { value: dec(1, 'ether') })
      assert.isFalse(txBob.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Trove does not exist or is closed")
    }
  })

  it('addColl(): can add collateral in Recovery Mode', async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(100, 18), alice, alice, { from: alice })

    assert.isFalse(await troveManager.checkRecoveryMode())

    await priceFeed.setPrice('105000000000000000000')

    assert.isTrue(await troveManager.checkRecoveryMode())

    await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(1, 'ether') })

    // Check Alice's collateral
    const alice_collateral = (await troveManager.Troves(alice))[1].toString()
    assert.equal(alice_collateral, dec(2, 'ether'))
  })


  // --- withdrawColl() ---

  // reverts when calling address does not have active trove  
  it("withdrawColl(): reverts when calling address does not have active trove", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(1, 'ether') })

    // Bob successfully withdraws some coll
    const txBob = await borrowerOperations.withdrawColl(dec(100, 'finney'), bob, bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Carol with no active trove attempts to withdraw
    try {
      const txCarol = await borrowerOperations.withdrawColl(dec(1, 'ether'), carol, carol, { from: carol })
      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawColl(): reverts when system is in Recovery Mode", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(100, 18), alice, alice, { from: alice })
    await borrowerOperations.withdrawLUSD(dec(100, 18), bob, bob, { from: bob })

    assert.isFalse(await troveManager.checkRecoveryMode())

    // Withdrawal possible when recoveryMode == false
    const txAlice = await borrowerOperations.withdrawColl(1000, alice, alice, { from: alice })
    assert.isTrue(txAlice.receipt.status)

    await priceFeed.setPrice('105000000000000000000')

    assert.isTrue(await troveManager.checkRecoveryMode())

    //Check withdrawal impossible when recoveryMode == true
    try {
      const txBob = await borrowerOperations.withdrawColl(1000, bob, bob, { from: bob })
      assert.isFalse(txBob.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawColl(): reverts when requested ETH withdrawal is > the trove's collateral", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, carol, carol, { from: carol, value: dec(1, 'ether') })

    // Carol withdraws exactly all her collateral
    await assertRevert(
      borrowerOperations.withdrawColl('1000000000000000000', carol, carol, { from: carol }),
      'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
    )

    // Bob attempts to withdraw 1 wei more than his collateral
    try {
      const txBob = await borrowerOperations.withdrawColl('1000000000000000001', bob, bob, { from: bob })
      assert.isFalse(txBob.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawColl(): reverts when withdrawal would bring the user's ICR < MCR", async () => {
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(10, 'ether') })

    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(1, 'ether') })

    const LUSDwithdrawal_A = await dec(40, 18)
    const LUSDwithdrawal_B = await dec(40, 18)
    await borrowerOperations.withdrawLUSD(LUSDwithdrawal_A, alice, alice, { from: alice })
    await borrowerOperations.withdrawLUSD(LUSDwithdrawal_B, bob, bob, { from: bob })


    // Alice withdraws 0.45 ether, leaving 0.55 remaining. Her ICR = (0.55*100)/50 = 110%.
    const txAlice = await borrowerOperations.withdrawColl('450000000000000000', alice, alice, { from: alice })
    assert.isTrue(txAlice.receipt.status)

    // Bob attempts to withdraws 0.46 ether, Which would leave him with 0.54 coll and ICR = (0.54*100)/50 = 108%.
    try {
      const txBob = await borrowerOperations.withdrawColl('460000000000000000', bob, bob, { from: bob })
      assert.isFalse(txBob.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawColl(): reverts if system is in recovery mode", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(3, 'ether') })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawLUSD('390000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawLUSD('390000000000000000000', bob, bob, { from: bob })

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // price drops to 1ETH:150LUSD, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000');

    //Alice tries to withdraw collateral during Recovery Mode
    try {
      const txData = await borrowerOperations.withdrawColl('1', alice, alice, { from: alice })
      assert.isFalse(txData.receipt.status)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("withdrawColl(): doesn’t allow a user to completely withdraw all collateral from their Trove (due to gas compensation)", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(100, 'finney') })

    // Alice attempts to withdraw all collateral
    await assertRevert(
      borrowerOperations.withdrawColl(dec(100, 'finney'), alice, alice, { from: alice }),
      'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
    )
  })

  it("withdrawColl(): cannot withdraw all collateral (due to gas compensation)", async () => {
    // Open Troves
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })

    // Check Trove is active
    const alice_Trove_Before = await troveManager.Troves(alice)
    const status_Before = alice_Trove_Before[3]
    assert.equal(status_Before, 1)
    assert.isTrue(await sortedTroves.contains(alice))

    // Withdraw all the collateral in the Trove
    await assertRevert(
      borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice }),
      'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
    )
  })

  it("withdrawColl(): leaves the Trove active when the user withdraws less than all the collateral", async () => {
    // Open Trove 
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })

    // Check Trove is active
    const alice_Trove_Before = await troveManager.Troves(alice)
    const status_Before = alice_Trove_Before[3]
    assert.equal(status_Before, 1)
    assert.isTrue(await sortedTroves.contains(alice))

    // Withdraw some collateral
    await borrowerOperations.withdrawColl(dec(100, 'finney'), alice, alice, { from: alice })

    // Check Trove is still active
    const alice_Trove_After = await troveManager.Troves(alice)
    const status_After = alice_Trove_After[3]
    assert.equal(status_After, 1)
    assert.isTrue(await sortedTroves.contains(alice))
  })

  it("withdrawColl(): reduces the Trove's collateral by the correct amount", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(2, 'ether') })

    // check before -  Alice has 2 ether in Trove 
    const alice_Trove_Before = await troveManager.Troves(alice)
    const coll_Before = alice_Trove_Before[1]
    assert.equal(coll_Before, dec(2, 'ether'))

    // Alice withdraws 1 ether
    await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice })

    // Check 1 ether remaining
    const alice_Trove_After = await troveManager.Troves(alice)
    const coll_After = alice_Trove_After[1]
    assert.equal(coll_After, dec(1, 'ether'))
  })

  it("withdrawColl(): reduces ActivePool ETH and raw ether by correct amount", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(2, 'ether') })

    // check before
    const activePool_ETH_before = await activePool.getETH()
    const activePool_RawEther_before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_before, dec(2, 'ether'))
    assert.equal(activePool_RawEther_before, dec(2, 'ether'))

    await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice })

    // check after
    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, dec(1, 'ether'))
    assert.equal(activePool_RawEther_After, dec(1, 'ether'))
  })

  it("withdrawColl(): updates the stake and updates the total stakes", async () => {
    //  Alice creates initial Trove with 2 ether
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(2, 'ether') })

    const alice_Trove_Before = await troveManager.Troves(alice)
    const alice_Stake_Before = alice_Trove_Before[2].toString()
    const totalStakes_Before = (await troveManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '2000000000000000000')
    assert.equal(totalStakes_Before, '2000000000000000000')

    // Alice withdraws 1 ether
    await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice })

    // Check stake and total stakes get updated
    const alice_Trove_After = await troveManager.Troves(alice)
    const alice_Stake_After = alice_Trove_After[2].toString()
    const totalStakes_After = (await troveManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, '1000000000000000000')
    assert.equal(totalStakes_After, '1000000000000000000')
  })

  it("withdrawColl(): sends the correct amount of ETH to the user", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(2, 'ether') })

    const alice_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))
    await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice, gasPrice: 0 })

    const alice_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(alice))
    const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

    //   assert.equal(balanceDiff.toString(), dec(1, 'ether'))
  })

  it("withdrawColl(): applies pending rewards and updates user's L_ETH, L_LUSDDebt snapshots", async () => {
    // --- SETUP ---
    // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(15, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(5, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: carol, value: dec(1, 'ether') })

    // Alice and Bob withdraw 90LUSD, Carol withdraws 170LUSD (+10 LUSD for gas compensation)
    const LUSDwithdrawal_A = await toBN(dec(90, 18))
    const LUSDwithdrawal_B = await toBN(dec(90, 18))
    const LUSDwithdrawal_C = await toBN(dec(170, 18))

    await borrowerOperations.withdrawLUSD(LUSDwithdrawal_A, alice, alice, { from: alice })
    await borrowerOperations.withdrawLUSD(LUSDwithdrawal_B, bob, bob, { from: bob })
    await borrowerOperations.withdrawLUSD(LUSDwithdrawal_C, carol, carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100LUSD, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Carol's Trove, liquidating her 1 ether and 180LUSD.
    const liquidationTx_C = await troveManager.liquidate(carol, { from: owner });
    const [liquidatedDebt_C, liquidatedColl_C, gasComp_C] = th.getEmittedLiquidationValues(liquidationTx_C)

    const L_ETH = await troveManager.L_ETH()
    const L_LUSDDebt = await troveManager.L_LUSDDebt()

    // check Alice and Bob's reward snapshots are zero before they alter their Troves
    const alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
    const alice_LUSDDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

    const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
    const bob_LUSDDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

    assert.equal(alice_ETHrewardSnapshot_Before, 0)
    assert.equal(alice_LUSDDebtRewardSnapshot_Before, 0)
    assert.equal(bob_ETHrewardSnapshot_Before, 0)
    assert.equal(bob_LUSDDebtRewardSnapshot_Before, 0)

    // Alice and Bob withdraw from their Troves
    await borrowerOperations.withdrawColl(dec(5, 'ether'), alice, alice, { from: alice })
    await borrowerOperations.withdrawColl(dec(1, 'ether'), bob, bob, { from: bob })
    /* Check that both alice and Bob have had pending rewards applied in addition to their top-ups. 
    
    When Carol defaulted, her liquidated debt and coll was distributed to A and B in proportion to their 
    collateral shares.  
    */
    const expectedCollReward_A = liquidatedColl_C.mul(toBN(dec(15, 'ether'))).div(toBN(dec(20, 'ether')))
    const expectedDebtReward_A = liquidatedDebt_C.mul(toBN(dec(15, 'ether'))).div(toBN(dec(20, 'ether')))
    const expectedCollReward_B = liquidatedColl_C.mul(toBN(dec(5, 'ether'))).div(toBN(dec(20, 'ether')))
    const expectedDebtReward_B = liquidatedDebt_C.mul(toBN(dec(5, 'ether'))).div(toBN(dec(20, 'ether')))

    const alice_Trove_After = await troveManager.Troves(alice)
    const alice_LUSDDebt_After = alice_Trove_After[0]
    const alice_Coll_After = alice_Trove_After[1]

    const bob_Trove_After = await troveManager.Troves(bob)
    const bob_LUSDDebt_After = bob_Trove_After[0]
    const bob_Coll_After = bob_Trove_After[1]

    // Expect Alice coll = 15 - 5  + reward
    // Expect Bob coll = 5 - 1 + reward
    assert.isAtMost(th.getDifference(alice_Coll_After, toBN(dec(10, 'ether')).add(expectedCollReward_A)), 100)
    assert.isAtMost(th.getDifference(alice_LUSDDebt_After, LUSDwithdrawal_A.add(expectedDebtReward_A).add(toBN(dec(10, 18)))), 100)

    assert.isAtMost(th.getDifference(bob_Coll_After, toBN(dec(4, 'ether')).add(expectedCollReward_B)), 100)
    assert.isAtMost(th.getDifference(bob_LUSDDebt_After, LUSDwithdrawal_B.add(expectedDebtReward_B).add(toBN(dec(10, 18)))), 100)

    /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
    to the latest values of L_ETH and L_LUSDDebt */
    const alice_rewardSnapshot_After = await troveManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
    const alice_LUSDDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]

    const bob_rewardSnapshot_After = await troveManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
    const bob_LUSDDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]

    assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, L_ETH), 100)
    assert.isAtMost(th.getDifference(alice_LUSDDebtRewardSnapshot_After, L_LUSDDebt), 100)
    assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, L_ETH), 100)
    assert.isAtMost(th.getDifference(bob_LUSDDebtRewardSnapshot_After, L_LUSDDebt), 100)
  })

  // --- withdrawLUSD() ---

  it("withdrawLUSD(): decays a non-zero base rate", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // console.log(`activePool raw ETH bal: ${await web3.eth.getBalance(activePool.address)}`)
    // console.log(`activePool ETH tracker: ${await activePool.getETH()}`)
    // console.log(`activePool in TroveManager: ${await troveManager.activePool()}`)

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D withdraws LUSD
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(37, 18), D, D, { from: D })

    // Check baseRate has decreased
    const baseRate_2 = await troveManager.baseRate()
    assert.isTrue(baseRate_2.lt(baseRate_1))

    // 1 hour passes
    th.fastForwardTime(3600, web3.currentProvider)

    // E opens trove 
    await borrowerOperations.openTrove(dec(12, 18), E, E, { from: E, value: dec(3, 'ether') })

    const baseRate_3 = await troveManager.baseRate()
    assert.isTrue(baseRate_3.lt(baseRate_2))
  })

  it("withdrawLUSD(): doesn't change base rate if it is already zero", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await troveManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D withdraws LUSD
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(37, 18), D, D, { from: D })

    // Check baseRate is still 0
    const baseRate_2 = await troveManager.baseRate()
    assert.equal(baseRate_2, '0')

    // 1 hour passes
    th.fastForwardTime(3600, web3.currentProvider)

    // E opens trove 
    await borrowerOperations.openTrove(dec(12, 18), E, E, { from: E, value: dec(3, 'ether') })

    const baseRate_3 = await troveManager.baseRate()
    assert.equal(baseRate_3, '0')
  })

  it("withdrawLUSD(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime()

    // 50 seconds pass
    th.fastForwardTime(50, web3.currentProvider)

    // Borrower C triggers a fee
    await borrowerOperations.withdrawLUSD(dec(1, 18), C, C, { from: C })

    const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime()

    // Check that the last fee operation time did not update, as borrower D's debt issuance occured
    // since before minimum interval had passed 
    assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

    // 10 seconds passes
    th.fastForwardTime(60, web3.currentProvider)

    // Check that now, at least one minute has passed since lastFeeOpTime_1
    const timeNow = await th.getLatestBlockTimestamp(web3)
    assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(60))

    // Borrower C triggers a fee
    await borrowerOperations.withdrawLUSD(dec(1, 18), C, C, { from: C })

    const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime()

    // Check that the last fee operation time DID update, as borrower's debt issuance occured
    // after minimum interval had passed 
    assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
  })


  it("withdrawLUSD(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 59 minutes pass
    th.fastForwardTime(3540, web3.currentProvider)

    // Borrower C triggers a fee, before decay interval has passed
    await borrowerOperations.withdrawLUSD(dec(1, 18), C, C, { from: C })

    // 1 minute pass
    th.fastForwardTime(3540, web3.currentProvider)

    // Borrower C triggers another fee
    await borrowerOperations.withdrawLUSD(dec(1, 18), C, C, { from: C })

    // Check base rate has decreased even though Borrower tried to stop it decaying
    const baseRate_2 = await troveManager.baseRate()
    assert.isTrue(baseRate_2.lt(baseRate_1))
  })


  it("withdrawLUSD(): borrowing at non-zero base rate sends LUSD fee to LQTY staking contract", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check LQTY LUSD balance before == 0
    const lqtyStaking_LUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
    assert.equal(lqtyStaking_LUSDBalance_Before, '0')

    // D withdraws LUSD
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(37, 18), D, D, { from: D })

    // Check LQTY LUSD balance after has increased
    const lqtyStaking_LUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
    assert.isTrue(lqtyStaking_LUSDBalance_After.gt(lqtyStaking_LUSDBalance_Before))
  })

  it("withdrawLUSD(): borrowing at non-zero base records the (drawn debt + fee) on the Trove struct", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D withdraws LUSD
    const withdrawal_D = toBN(dec(37, 18))

    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    const withdrawalTx = await borrowerOperations.withdrawLUSD(dec(37, 18), D, D, { from: D })

    const emittedFee = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(withdrawalTx))
    assert.isTrue(emittedFee.gt(toBN('0')))

    const gasComp = toBN(dec(10, 18))

    const newDebt = (await troveManager.Troves(D))[0]

    // console.log(`newDebt ${newDebt}`)
    // console.log(`withdrawal_D ${withdrawal_D}`)
    // console.log(`emittedFee ${emittedFee}`)
    // console.log(`withdrawal_D.add(emittedFee) ${withdrawal_D.add(emittedFee)}`)

    // Check debt on Trove struct equals drawn debt plus emitted fee
    assert.isTrue(newDebt.eq(withdrawal_D.add(emittedFee).add(gasComp)))
  })

  it("withdrawLUSD(): Borrowing at non-zero base rate increases the LQTY staking contract LUSD fees-per-unit-staked", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check LQTY contract LUSD fees-per-unit-staked is zero
    const F_LUSD_Before = await lqtyStaking.F_LUSD()
    assert.equal(F_LUSD_Before, '0')

    // D withdraws LUSD
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(37, 18), D, D, { from: D })

    // Check LQTY contract LUSD fees-per-unit-staked has increased
    const F_LUSD_After = await lqtyStaking.F_LUSD()
    assert.isTrue(F_LUSD_After.gt(F_LUSD_Before))
  })

  it("withdrawLUSD(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check LQTY Staking contract balance before == 0
    const lqtyStaking_LUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
    assert.equal(lqtyStaking_LUSDBalance_Before, '0')

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D withdraws LUSD
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    const LUSDRequest_D = toBN(dec(40, 18))
    await borrowerOperations.withdrawLUSD(LUSDRequest_D, D, D, { from: D })

    // Check LQTY staking LUSD balance has increased
    const lqtyStaking_LUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
    assert.isTrue(lqtyStaking_LUSDBalance_After.gt(lqtyStaking_LUSDBalance_Before))

    // Check D's LUSD balance now equals their requested LUSD
    const LUSDBalance_D = await lusdToken.balanceOf(D)
    assert.isTrue(LUSDRequest_D.eq(LUSDBalance_D))
  })

  it("withdrawLUSD(): Borrowing at zero base rate does not change LUSD balance of LQTY staking contract", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await troveManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check LQTY LUSD balance before == 0
    const lqtyStaking_LUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
    assert.equal(lqtyStaking_LUSDBalance_Before, '0')

    // D withdraws LUSD
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(37, 18), D, D, { from: D })

    // Check LQTY LUSD balance after == 0
    const lqtyStaking_LUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
    assert.equal(lqtyStaking_LUSDBalance_After, '0')
  })

  it("withdrawLUSD(): Borrowing at zero base rate does not change LQTY staking contract LUSD fees-per-unit-staked", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await troveManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check LQTY LUSD balance before == 0
    const F_LUSD_Before = await lqtyStaking.F_LUSD()
    assert.equal(F_LUSD_Before, '0')

    // D withdraws LUSD
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(37, 18), D, D, { from: D })

    // Check LQTY LUSD balance after == 0
    const F_LUSD_After = await lqtyStaking.F_LUSD()
    assert.equal(F_LUSD_After, '0')
  })

  it("withdrawLUSD(): Borrowing at zero base rate sends total requested LUSD to the user", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await troveManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)


    // D withdraws LUSD
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    const LUSDRequest_D = toBN(dec(40, 18))
    await borrowerOperations.withdrawLUSD(LUSDRequest_D, D, D, { from: D })

    // Check D's LUSD balance now equals their requested LUSD
    const LUSDBalance_D = await lusdToken.balanceOf(D)

    assert.isTrue(LUSDRequest_D.eq(LUSDBalance_D))
  })

  it("withdrawLUSD(): reverts when calling address does not have active trove", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(1, 'ether') })

    // Bob successfully withdraws LUSD
    const txBob = await borrowerOperations.withdrawLUSD(dec(100, 18), bob, bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Carol with no active trove attempts to withdraw LUSD
    try {
      const txCarol = await borrowerOperations.withdrawLUSD(dec(100, 18), carol, carol, { from: carol })
      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawLUSD(): reverts when requested withdrawal amount is zero LUSD", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(1, 'ether') })

    // Bob successfully withdraws 1e-18 LUSD
    const txBob = await borrowerOperations.withdrawLUSD(1, bob, bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Alice attempts to withdraw 0 LUSD
    try {
      const txAlice = await borrowerOperations.withdrawLUSD(0, alice, alice, { from: alice })
      assert.isFalse(txAlice.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawLUSD(): reverts when system is in Recovery Mode", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(1, 'ether') })

    assert.isFalse(await troveManager.checkRecoveryMode())

    // Withdrawal possible when recoveryMode == false
    const txAlice = await borrowerOperations.withdrawLUSD(dec(100, 18), alice, alice, { from: alice })
    assert.isTrue(txAlice.receipt.status)

    await priceFeed.setPrice('50000000000000000000')

    assert.isTrue(await troveManager.checkRecoveryMode())

    //Check LUSD withdrawal impossible when recoveryMode == true
    try {
      const txBob = await borrowerOperations.withdrawLUSD(1, bob, bob, { from: bob })
      assert.isFalse(txBob.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })


  it("withdrawLUSD(): reverts when withdrawal would bring the trove's ICR < MCR", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(1, 'ether') })

    // Alice withdraws to a composite debt of 171 LUSD (+10 LUSD for gas compensation)
    const LUSDwithdrawal_A = "171000000000000000000"
    const txAlice = await borrowerOperations.withdrawLUSD(LUSDwithdrawal_A, alice, alice, { from: alice })
    assert.isTrue(txAlice.receipt.status)

    const price = await priceFeed.getPrice()
    const aliceICR = await troveManager.getCurrentICR(alice, price)

    // Check Alice ICR > MCR
    assert.isTrue(aliceICR.gte(web3.utils.toBN("1100000000000000000")))

    // Bob tries to withdraw LUSD that would bring his ICR < MCR
    try {
      const txBob = await borrowerOperations.withdrawLUSD("172000000000000000000", bob, bob, { from: bob })
      assert.isFalse(txBob.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawLUSD(): reverts when the withdrawal would cause the TCR of the system to fall below the CCR", async () => {
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Alice and Bob creates troves with 3 ETH / 200 LUSD, and 150% ICR.  System TCR = 150%.
    const txAlice = await borrowerOperations.openTrove(dec(190, 18), alice, alice, { from: alice, value: dec(3, 'ether') })
    const aliceICR = await troveManager.getCurrentICR(alice, price)

    const txBob = await borrowerOperations.openTrove(dec(190, 18), bob, bob, { from: bob, value: dec(3, 'ether') })
    const bobICR = await troveManager.getCurrentICR(bob, price)

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // Bob attempts to withdraw 1 LUSD.
    // System TCR would be: ((3+3) * 100 ) / (200+201) = 600/401 = 149.62%, i.e. below CCR of 150%.
    try {
      const txBob = await borrowerOperations.withdrawLUSD(dec(1, 18), bob, bob, { from: bob })
      assert.isFalse(txBob.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })


  it("withdrawLUSD(): reverts if withdrawal would pull TCR below CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(3, 'ether') })

    //  Alice and Bob withdraw such that the TCR is 150%
    await borrowerOperations.withdrawLUSD('390000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawLUSD('390000000000000000000', bob, bob, { from: bob })

    // --- TEST ---

    // Alice attempts to withdraw 10 LUSD, which would reducing TCR below 150%
    try {
      const txData = await borrowerOperations.withdrawLUSD('10000000000000000000', alice, alice, { from: alice })
      assert.isFalse(txData.receipt.status)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("withdrawLUSD(): reverts if system is in recovery mode", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(3, 'ether') })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawLUSD('390000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawLUSD('390000000000000000000', bob, bob, { from: bob })

    // const TCR = (await troveManager.getTCR()).toString()
    // assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // price drops to 1ETH:150LUSD, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000');

    try {
      const txData = await borrowerOperations.withdrawLUSD('200', alice, alice, { from: alice })
      assert.isFalse(txData.receipt.status)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("withdrawLUSD(): increases the Trove's LUSD debt by the correct amount", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })

    // check before
    const alice_Trove_Before = await troveManager.Troves(alice)
    const debt_Before = alice_Trove_Before[0]
    assert.equal(debt_Before, dec(10, 18))

    await borrowerOperations.withdrawLUSD(100, alice, alice, { from: alice })

    // check after
    const alice_Trove_After = await troveManager.Troves(alice)
    const debt_After = alice_Trove_After[0]
    assert.equal(debt_After.toString(), toBN(dec(10, 18)).add(toBN(100)).toString())
  })

  it("withdrawLUSD(): increases LUSD debt in ActivePool by correct amount", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })

    // check before
    const alice_Trove_Before = await troveManager.Troves(alice)
    const debt_Before = alice_Trove_Before[0]
    assert.equal(debt_Before, dec(10, 18))

    await borrowerOperations.withdrawLUSD(100, alice, alice, { from: alice })

    // check after
    const alice_Trove_After = await troveManager.Troves(alice)
    const debt_After = alice_Trove_After[0]
    assert.equal(debt_After.toString(), toBN(dec(10, 18)).add(toBN(100)).toString())
  })

  it("withdrawLUSD(): increases user LUSDToken balance by correct amount", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })

    // check before
    const alice_LUSDTokenBalance_Before = await lusdToken.balanceOf(alice)
    assert.equal(alice_LUSDTokenBalance_Before, 0)

    await borrowerOperations.withdrawLUSD(100, alice, alice, { from: alice })

    // check after
    const alice_LUSDTokenBalance_After = await lusdToken.balanceOf(alice)
    assert.equal(alice_LUSDTokenBalance_After, 100)
  })

  // --- repayLUSD() ---

  it("repayLUSD(): reverts when calling address does not have active trove", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(100, 18), alice, alice, { from: alice })
    await borrowerOperations.withdrawLUSD(dec(100, 18), bob, bob, { from: bob })

    // Bob successfully repays some LUSD
    const txBob = await borrowerOperations.repayLUSD(dec(10, 18), bob, bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Carol with no active trove attempts to repayLUSD
    try {
      const txCarol = await borrowerOperations.repayLUSD(dec(10, 18), carol, carol, { from: carol })
      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("repayLUSD(): reverts when attempted repayment is > the debt of the trove", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(100, 18), alice, alice, { from: alice })
    await borrowerOperations.withdrawLUSD(dec(100, 18), bob, bob, { from: bob })

    // Bob successfully repays some LUSD
    const txBob = await borrowerOperations.repayLUSD(dec(10, 18), bob, bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Alice attempts to repay more than her debt
    try {
      const txAlice = await borrowerOperations.repayLUSD('101000000000000000000', alice, alice, { from: alice })
      assert.isFalse(txAlice.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  //repayLUSD: reduces LUSD debt in Trove
  it("repayLUSD(): reduces the Trove's LUSD debt by the correct amount", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })

    // check before
    await borrowerOperations.withdrawLUSD(100, alice, alice, { from: alice })
    const alice_Trove_Before = await troveManager.Troves(alice)
    const debt_Before = alice_Trove_Before[0]
    assert.equal(debt_Before.toString(), toBN(dec(10, 18)).add(toBN(100)).toString())

    await borrowerOperations.repayLUSD(100, alice, alice, { from: alice })

    // check after
    const alice_Trove_After = await troveManager.Troves(alice)
    const debt_After = alice_Trove_After[0]
    assert.equal(debt_After, dec(10, 18))
  })

  it("repayLUSD(): decreases LUSD debt in ActivePool by correct amount", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })

    //check before
    await borrowerOperations.withdrawLUSD(100, alice, alice, { from: alice })
    const activePool_LUSD_Before = await activePool.getLUSDDebt()
    assert.equal(activePool_LUSD_Before.toString(), toBN(dec(10, 18)).add(toBN(100)).toString())

    await borrowerOperations.repayLUSD(100, alice, alice, { from: alice })

    // check after
    const activePool_LUSD_After = await activePool.getLUSDDebt()
    assert.equal(activePool_LUSD_After, dec(10, 18))
  })

  it("repayLUSD(): decreases user LUSDToken balance by correct amount", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })

    // check before
    await borrowerOperations.withdrawLUSD(100, alice, alice, { from: alice })
    const alice_LUSDTokenBalance_Before = await lusdToken.balanceOf(alice)
    assert.equal(alice_LUSDTokenBalance_Before, 100)

    await borrowerOperations.repayLUSD(100, alice, alice, { from: alice })

    // check after
    const alice_LUSDTokenBalance_After = await lusdToken.balanceOf(alice)
    assert.equal(alice_LUSDTokenBalance_After, 0)
  })

  it('repayLUSD(): can repay debt in Recovery Mode', async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(90, 18), alice, alice, { from: alice })

    assert.isFalse(await troveManager.checkRecoveryMode())

    await priceFeed.setPrice('105000000000000000000')

    assert.isTrue(await troveManager.checkRecoveryMode())

    await borrowerOperations.repayLUSD(dec(50, 18), alice, alice, { from: alice })

    // Check Alice's debt: 90 (withdrawn) + 10 (gas comp) - 50 (repaid)
    const alice_debt = (await troveManager.Troves(alice))[0].toString()
    assert.equal(alice_debt, dec(50, 18))
  })

  it("repayLUSD(): Reverts if borrower has insufficient LUSD balance to cover his debt repayment", async () => {
    await borrowerOperations.openTrove(dec(1000, 18), A, A, { from: A, value: dec(15, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), B, B, { from: B, value: dec(5, 'ether') })
 
    // Bob transfers some LUSD to carol
    await lusdToken.transfer(C, dec(51, 18),  {from: B})

    //Confirm B's LUSD balance is less than 50 LUSD
    const B_LUSDBal = await lusdToken.balanceOf(B)
    assert.isTrue(B_LUSDBal.lt(toBN(dec(50, 18))))

    const repayLUSDPromise_B = borrowerOperations.repayLUSD(dec(50, 18), B, B, {from: B})
     
    // B attempts to repay 50 LUSD
    await assertRevert(repayLUSDPromise_B, "BorrowerOps: Caller doesnt have enough LUSD to close their trove")
  })

  // --- adjustTrove() ---

  it("adjustTrove(): decays a non-zero base rate", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D adjusts trove
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.adjustTrove(0, dec(37, 18), true, D, D, { from: D })

    // Check baseRate has decreased
    const baseRate_2 = await troveManager.baseRate()
    assert.isTrue(baseRate_2.lt(baseRate_1))

    // 1 hour passes
    th.fastForwardTime(3600, web3.currentProvider)

    // E adjusts trove
    await borrowerOperations.openTrove(0, E, E, { from: E, value: dec(2, 'ether') })
    await borrowerOperations.adjustTrove(0, dec(37, 15), true, E, E, { from: D })

    const baseRate_3 = await troveManager.baseRate()
    assert.isTrue(baseRate_3.lt(baseRate_2))
  })

  it("adjustTrove(): doesn't change base rate if it is already zero", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await troveManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D adjusts trove
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.adjustTrove(0, dec(37, 18), true, D, D, { from: D })

    // Check baseRate is still 0
    const baseRate_2 = await troveManager.baseRate()
    assert.equal(baseRate_2, '0')

    // 1 hour passes
    th.fastForwardTime(3600, web3.currentProvider)

    // E adjusts trove
    await borrowerOperations.openTrove(0, E, E, { from: E, value: dec(2, 'ether') })
    await borrowerOperations.adjustTrove(0, dec(37, 15), true, E, E, { from: D })

    const baseRate_3 = await troveManager.baseRate()
    assert.equal(baseRate_3, '0')
  })

  it("adjustTrove(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime()

    // 50 seconds pass
    th.fastForwardTime(50, web3.currentProvider)

    // Borrower C triggers a fee
    await borrowerOperations.adjustTrove(0, dec(1, 18), true, C, C, { from: C })

    const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime()

    // Check that the last fee operation time did not update, as borrower D's debt issuance occured
    // since before minimum interval had passed 
    assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

    // 10 seconds passes
    th.fastForwardTime(10, web3.currentProvider)

    // Check that now, at least one minute has passed since lastFeeOpTime_1
    const timeNow = await th.getLatestBlockTimestamp(web3)
    assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(60))

    // Borrower C triggers a fee
    await borrowerOperations.adjustTrove(0, dec(1, 18), true, C, C, { from: C })

    const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime()

    // Check that the last fee operation time DID update, as borrower's debt issuance occured
    // after minimum interval had passed 
    assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
  })


  it("adjustTrove(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 59 minutes pass
    th.fastForwardTime(3540, web3.currentProvider)

    // Borrower C triggers a fee, before decay interval has passed
    await borrowerOperations.adjustTrove(0, dec(1, 18), true, C, C, { from: C })

    // 1 minute pass
    th.fastForwardTime(3540, web3.currentProvider)

    // Borrower C triggers another fee
    await borrowerOperations.adjustTrove(0, dec(1, 18), true, C, C, { from: C })

    // Check base rate has decreased even though Borrower tried to stop it decaying
    const baseRate_2 = await troveManager.baseRate()
    assert.isTrue(baseRate_2.lt(baseRate_1))
  })

  it("adjustTrove(): borrowing at non-zero base rate sends LUSD fee to LQTY staking contract", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check LQTY LUSD balance before == 0
    const lqtyStaking_LUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
    assert.equal(lqtyStaking_LUSDBalance_Before, '0')

    // D adjusts trove
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.adjustTrove(0, dec(37, 18), true, D, D, { from: D })

    // Check LQTY LUSD balance after has increased
    const lqtyStaking_LUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
    assert.isTrue(lqtyStaking_LUSDBalance_After.gt(lqtyStaking_LUSDBalance_Before))
  })

  it("adjustTrove(): borrowing at non-zero base records the (drawn debt + fee) on the Trove struct", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    const withdrawal_D = toBN(dec(37, 18))

    // D withdraws LUSD
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    const adjustmentTx = await borrowerOperations.adjustTrove(0, withdrawal_D, true, D, D, { from: D })

    const emittedFee = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(adjustmentTx))
    assert.isTrue(emittedFee.gt(toBN('0')))

    const gasComp = toBN(dec(10, 18))

    const newDebt = (await troveManager.Troves(D))[0]

    // Check debt on Trove struct equals drawn debt plus emitted fee
    assert.isTrue(newDebt.eq(withdrawal_D.add(emittedFee).add(gasComp)))
  })

  it("adjustTrove(): Borrowing at non-zero base rate increases the LQTY staking contract LUSD fees-per-unit-staked", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check LQTY contract LUSD fees-per-unit-staked is zero
    const F_LUSD_Before = await lqtyStaking.F_LUSD()
    assert.equal(F_LUSD_Before, '0')

    // D adjusts trove
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.adjustTrove(0, dec(37, 18), true, D, D, { from: D })

    // Check LQTY contract LUSD fees-per-unit-staked has increased
    const F_LUSD_After = await lqtyStaking.F_LUSD()
    assert.isTrue(F_LUSD_After.gt(F_LUSD_Before))
  })

  it("adjustTrove(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check LQTY Staking contract balance before == 0
    const lqtyStaking_LUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
    assert.equal(lqtyStaking_LUSDBalance_Before, '0')

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D adjusts trove
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    const LUSDRequest_D = toBN(dec(40, 18))
    await borrowerOperations.adjustTrove(0, LUSDRequest_D, true, D, D, { from: D })

    // Check LQTY staking LUSD balance has increased
    const lqtyStaking_LUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
    assert.isTrue(lqtyStaking_LUSDBalance_After.gt(lqtyStaking_LUSDBalance_Before))

    // Check D's LUSD balance now equals their requested LUSD
    const LUSDBalance_D = await lusdToken.balanceOf(D)
    assert.isTrue(LUSDRequest_D.eq(LUSDBalance_D))
  })

  it("adjustTrove(): Borrowing at zero base rate does not change LUSD balance of LQTY staking contract", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await troveManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check LQTY LUSD balance before == 0
    const lqtyStaking_LUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
    assert.equal(lqtyStaking_LUSDBalance_Before, '0')

    // D adjusts trove
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.adjustTrove(0, dec(37, 18), true, D, D, { from: D })

    // Check LQTY LUSD balance after == 0
    const lqtyStaking_LUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
    assert.equal(lqtyStaking_LUSDBalance_After, '0')
  })

  it("adjustTrove(): Borrowing at zero base rate does not change LQTY staking contract LUSD fees-per-unit-staked", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await troveManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check LQTY LUSD balance before == 0
    const F_LUSD_Before = await lqtyStaking.F_LUSD()
    assert.equal(F_LUSD_Before, '0')

    // D adjusts trove
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.adjustTrove(0, dec(37, 18), true, D, D, { from: D })

    // Check LQTY LUSD balance after == 0
    const F_LUSD_After = await lqtyStaking.F_LUSD()
    assert.equal(F_LUSD_After, '0')
  })

  it("adjustTrove(): Borrowing at zero base rate sends total requested LUSD to the user", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await troveManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D adjusts trove
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })
    const LUSDRequest_D = toBN(dec(40, 18))
    await borrowerOperations.adjustTrove(0, LUSDRequest_D, true, D, D, { from: D })

    // Check D's LUSD balance now equals their requested LUSD
    const LUSDBalance_D = await lusdToken.balanceOf(D)

    assert.isTrue(LUSDRequest_D.eq(LUSDBalance_D))
  })

  it("adjustTrove(): reverts when calling address has no active trove", async () => {
    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), bob, bob, { from: bob, value: dec(1, 'ether') })

    // Alice coll and debt increase(+1 ETH, +50LUSD)
    await borrowerOperations.adjustTrove(0, dec(50, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

    try {
      const txCarol = await borrowerOperations.adjustTrove(0, dec(50, 18), true, carol, carol, { from: carol, value: dec(1, 'ether') })
      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustTrove(): reverts when system is in Recovery Mode", async () => {
    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), bob, bob, { from: bob, value: dec(1, 'ether') })

    assert.isFalse(await troveManager.checkRecoveryMode())

    const txAlice = await borrowerOperations.adjustTrove(0, dec(50, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })
    assert.isTrue(txAlice.receipt.status)

    await priceFeed.setPrice(dec(100, 18))

    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check operation impossible when system is in Recovery Mode
    try {
      const txBob = await borrowerOperations.adjustTrove(0, dec(50, 18), true, bob, bob, { from: bob, value: dec(1, 'ether') })
      assert.isFalse(txBob.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustTrove(): reverts when change would cause the TCR of the system to fall below the CCR", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await borrowerOperations.openTrove(dec(190, 18), alice, alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(190, 18), bob, bob, { from: bob, value: dec(3, 'ether') })

    // Check TCR and Recovery Mode
    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')
    assert.isFalse(await troveManager.checkRecoveryMode())

    // Bob attempts an operation that would bring the TCR below the CCR
    try {
      const txBob = await borrowerOperations.adjustTrove(0, dec(1, 18), true, bob, bob, { from: bob })
      assert.isFalse(txBob.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustTrove(): reverts when LUSD repaid is > debt of the trove", async () => {
    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), bob, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), carol, carol, { from: carol, value: dec(1, 'ether') })

    // Check Bob can make an adjustment that fully repays his debt
    const txBob = await borrowerOperations.adjustTrove(0, dec(100, 18), false, bob, bob, { from: bob, value: dec(1, 'ether') })
    assert.isTrue(txBob.receipt.status)

    // Carol attempts an adjustment that would repay more than her debt
    try {
      const txCarol = await borrowerOperations.adjustTrove(0, dec(101, 18), false, carol, carol, { from: carol })
      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustTrove(): reverts when attempted ETH withdrawal is >= the trove's collateral", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, carol, carol, { from: carol, value: dec(1, 'ether') })

    // Bob attempts an adjustment that would withdraw his entire ETH
    await assertRevert(
      borrowerOperations.adjustTrove(dec(1, 'ether'), 0, false, bob, bob, { from: bob }),
      'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
    )

    // Carol attempts an adjustment that would withdraw more than her ETH
    try {
      const txCarol = await borrowerOperations.adjustTrove('1000000000000000001', 0, true, carol, carol, { from: carol })
      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustTrove(): reverts when change would cause the ICR of the trove to fall below the MCR", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })

    await priceFeed.setPrice(dec(100, 18))

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), bob, bob, { from: bob, value: dec(2, 'ether') })

    // Alice decreases coll by 1 ETH and increass debt by 100 LUSD. 
    // New ICR would be: ((2+1) * 100) / (100 + 100) = 300/200 = 150%, 
    const txAlice = await borrowerOperations.adjustTrove(0, dec(100, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })
    assert.isTrue(txAlice.receipt.status)

    // Bob attempts to decrease coll  by 1 ETH and increase debt by 200 LUSD. 
    // New ICR would be: ((2+1) * 100) / (100 + 200) = 300/300 = 100%, below the MCR.
    try {
      const txBob = await borrowerOperations.adjustTrove(0, dec(200, 18), true, bob, bob, { from: bob, value: dec(1, 'ether') })
      assert.isFalse(txBob.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustTrove(): With 0 coll change, doesnt change borrower's coll or ActivePool coll", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(10, 'ether') })

    const collBefore = ((await troveManager.Troves(alice))[1]).toString()
    const activePoolCollBefore = (await activePool.getETH()).toString()

    assert.equal(collBefore, dec(10, 'ether'))
    assert.equal(activePoolCollBefore, '110000000000000000000')

    // Alice adjusts trove. No coll change, and a debt increase (+50LUSD)
    await borrowerOperations.adjustTrove(0, dec(50, 18), true, alice, alice, { from: alice, value: 0 })

    const collAfter = ((await troveManager.Troves(alice))[1]).toString()
    const activePoolCollAfter = (await activePool.getETH()).toString()

    assert.equal(collAfter, collBefore)
    assert.equal(activePoolCollAfter, activePoolCollBefore)
  })

  it("adjustTrove(): With 0 debt change, doesnt change borrower's debt or ActivePool debt", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(10, 'ether') })

    const debtBefore = ((await troveManager.Troves(alice))[0]).toString()
    const activePoolDebtBefore = (await activePool.getLUSDDebt()).toString()

    assert.equal(debtBefore, dec(110, 18))
    assert.equal(activePoolDebtBefore, dec(120, 18))

    // Alice adjusts trove. No coll change, no debt change
    await borrowerOperations.adjustTrove(0, 0, true, alice, alice, { from: alice, value: dec(1, 'ether') })

    const debtAfter = ((await troveManager.Troves(alice))[0]).toString()
    const collAfter = ((await troveManager.Troves(alice))[1]).toString()
    const activePoolDebtAfter = (await activePool.getLUSDDebt()).toString()

    assert.equal(debtAfter, debtBefore)
    assert.equal(activePoolDebtAfter, activePoolDebtBefore)
  })

  it("adjustTrove(): updates borrower's debt and coll with an increase in both", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    const debtBefore = ((await troveManager.Troves(alice))[0]).toString()
    const collBefore = ((await troveManager.Troves(alice))[1]).toString()

    assert.equal(debtBefore, dec(110, 18))
    assert.equal(collBefore, dec(1, 'ether'))

    // Alice adjusts trove. Coll and debt increase(+1 ETH, +50LUSD)
    await borrowerOperations.adjustTrove(0, dec(50, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

    const debtAfter = ((await troveManager.Troves(alice))[0]).toString()
    const collAfter = ((await troveManager.Troves(alice))[1]).toString()

    assert.equal(debtAfter, dec(160, 18))
    assert.equal(collAfter, dec(2, 'ether'))
  })


  it("adjustTrove(): updates borrower's debt and coll with a decrease in both", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    const debtBefore = ((await troveManager.Troves(alice))[0]).toString()
    const collBefore = ((await troveManager.Troves(alice))[1]).toString()

    assert.equal(debtBefore, dec(110, 18))
    assert.equal(collBefore, dec(1, 'ether'))

    // Alice adjusts trove coll and debt decrease (-0.5 ETH, -50LUSD)
    await borrowerOperations.adjustTrove(dec(500, 'finney'), dec(50, 18), false, alice, alice, { from: alice })

    const debtAfter = ((await troveManager.Troves(alice))[0]).toString()
    const collAfter = ((await troveManager.Troves(alice))[1]).toString()

    assert.equal(debtAfter, dec(60, 18))
    assert.equal(collAfter, dec(500, 'finney'))
  })

  it("adjustTrove(): updates borrower's  debt and coll with coll increase, debt decrease", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    const debtBefore = ((await troveManager.Troves(alice))[0]).toString()
    const collBefore = ((await troveManager.Troves(alice))[1]).toString()

    assert.equal(debtBefore, dec(110, 18))
    assert.equal(collBefore, dec(1, 'ether'))

    // Alice adjusts trove - coll increase and debt decrease (+0.5 ETH, -50LUSD)
    await borrowerOperations.adjustTrove(0, dec(50, 18), false, alice, alice, { from: alice, value: dec(500, 'finney') })

    const debtAfter = ((await troveManager.Troves(alice))[0]).toString()
    const collAfter = ((await troveManager.Troves(alice))[1]).toString()

    assert.equal(debtAfter, dec(60, 18))
    assert.equal(collAfter, dec(1500, 'finney'))
  })


  it("adjustTrove(): updates borrower's debt and coll with coll decrease, debt increase", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    const debtBefore = ((await troveManager.Troves(alice))[0]).toString()
    const collBefore = ((await troveManager.Troves(alice))[1]).toString()

    assert.equal(debtBefore, dec(110, 18))
    assert.equal(collBefore, dec(1, 'ether'))

    // Alice adjusts trove - coll decrease and debt increase (0.1 ETH, 10LUSD)
    await borrowerOperations.adjustTrove('100000000000000000', dec(10, 18), true, alice, alice, { from: alice })

    const debtAfter = ((await troveManager.Troves(alice))[0]).toString()
    const collAfter = ((await troveManager.Troves(alice))[1]).toString()

    assert.equal(debtAfter, dec(120, 18))
    assert.equal(collAfter, '900000000000000000')
  })

  it("adjustTrove(): updates borrower's stake and totalStakes with a coll increase", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    const stakeBefore = ((await troveManager.Troves(alice))[2]).toString()
    const totalStakesBefore = await troveManager.totalStakes();

    assert.equal(stakeBefore, dec(1, 'ether'))
    assert.equal(totalStakesBefore, '101000000000000000000')

    // Alice adjusts trove - coll and debt increase (+1 ETH, +50 LUSD)
    await borrowerOperations.adjustTrove(0, dec(50, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

    const stakeAfter = ((await troveManager.Troves(alice))[2]).toString()
    const totalStakesAfter = await troveManager.totalStakes();

    assert.equal(stakeAfter, dec(2, 'ether'))
    assert.equal(totalStakesAfter, '102000000000000000000')
  })

  it("adjustTrove():  updates borrower's stake and totalStakes with a coll decrease", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    const stakeBefore = ((await troveManager.Troves(alice))[2]).toString()
    const totalStakesBefore = await troveManager.totalStakes();

    assert.equal(stakeBefore, dec(1, 'ether'))
    assert.equal(totalStakesBefore, '101000000000000000000')

    // Alice adjusts trove - coll decrease and debt decrease
    await borrowerOperations.adjustTrove(dec(500, 'finney'), dec(50, 18), false, alice, alice, { from: alice })

    const stakeAfter = ((await troveManager.Troves(alice))[2]).toString()
    const totalStakesAfter = await troveManager.totalStakes();

    assert.equal(stakeAfter, '500000000000000000')
    assert.equal(totalStakesAfter, '100500000000000000000')
  })

  it("adjustTrove(): changes LUSDToken balance by the requested decrease", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    const alice_LUSDTokenBalance_Before = (await lusdToken.balanceOf(alice)).toString()
    assert.equal(alice_LUSDTokenBalance_Before, dec(100, 18))

    // Alice adjusts trove - coll decrease and debt decrease
    await borrowerOperations.adjustTrove(dec(100, 'finney'), dec(10, 18), false, alice, alice, { from: alice })

    // check after
    const alice_LUSDTokenBalance_After = (await lusdToken.balanceOf(alice)).toString()
    assert.equal(alice_LUSDTokenBalance_After, dec(90, 18))
  })

  it("adjustTrove(): changes LUSDToken balance by the requested increase", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    const alice_LUSDTokenBalance_Before = (await lusdToken.balanceOf(alice)).toString()
    assert.equal(alice_LUSDTokenBalance_Before, dec(100, 18))

    // Alice adjusts trove - coll increase and debt increase
    await borrowerOperations.adjustTrove(0, dec(100, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

    // check after
    const alice_LUSDTokenBalance_After = (await lusdToken.balanceOf(alice)).toString()
    assert.equal(alice_LUSDTokenBalance_After, dec(200, 18))
  })

  it("adjustTrove(): Changes the activePool ETH and raw ether balance by the requested decrease", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    const activePool_ETH_Before = (await activePool.getETH()).toString()
    const activePool_RawEther_Before = (await web3.eth.getBalance(activePool.address)).toString()
    assert.equal(activePool_ETH_Before, '101000000000000000000')
    assert.equal(activePool_RawEther_Before, '101000000000000000000')

    // Alice adjusts trove - coll decrease and debt decrease
    await borrowerOperations.adjustTrove(dec(100, 'finney'), dec(10, 18), false, alice, alice, { from: alice })

    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, '100900000000000000000')
    assert.equal(activePool_RawEther_After, '100900000000000000000')
  })

  it("adjustTrove(): Changes the activePool ETH and raw ether balance by the amount of ETH sent", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    const activePool_ETH_Before = (await activePool.getETH()).toString()
    const activePool_RawEther_Before = (await web3.eth.getBalance(activePool.address)).toString()
    assert.equal(activePool_ETH_Before, '101000000000000000000')
    assert.equal(activePool_RawEther_Before, '101000000000000000000')

    // Alice adjusts trove - coll increase and debt increase
    await borrowerOperations.adjustTrove(0, dec(100, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

    const activePool_ETH_After = (await activePool.getETH()).toString()
    const activePool_RawEther_After = (await web3.eth.getBalance(activePool.address)).toString()
    assert.equal(activePool_ETH_After, '102000000000000000000')
    assert.equal(activePool_RawEther_After, '102000000000000000000')
  })

  it("adjustTrove(): Changes the LUSD debt in ActivePool by requested decrease", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    const activePool_LUSDDebt_Before = (await activePool.getLUSDDebt()).toString()
    assert.equal(activePool_LUSDDebt_Before, dec(120, 18))

    // Alice adjusts trove - coll increase and debt decrease
    await borrowerOperations.adjustTrove(0, dec(50, 18), false, alice, alice, { from: alice, value: dec(1, 'ether') })

    const activePool_LUSDDebt_After = (await activePool.getLUSDDebt()).toString()
    assert.equal(activePool_LUSDDebt_After, dec(70, 18))
  })

  it("adjustTrove():Changes the LUSD debt in ActivePool by requested increase", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    const activePool_LUSDDebt_Before = (await activePool.getLUSDDebt()).toString()
    assert.equal(activePool_LUSDDebt_Before, dec(120, 18))

    // Alice adjusts trove - coll increase and debt increase
    await borrowerOperations.adjustTrove(0, dec(100, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

    const activePool_LUSDDebt_After = (await activePool.getLUSDDebt()).toString()
    assert.equal(activePool_LUSDDebt_After, dec(220, 18))
  })

  it("adjustTrove(): new coll = 0 and new debt = 0 is not allowed, as gas compensation still counts toward ICR", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })
    await borrowerOperations.openTrove(dec(90, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    const status_Before = (await troveManager.Troves(alice))[3]
    const isInSortedList_Before = await sortedTroves.contains(alice)

    assert.equal(status_Before, 1)  // 1: Active
    assert.isTrue(isInSortedList_Before)

    await assertRevert(
      borrowerOperations.adjustTrove(dec(1, 'ether'), dec(90, 18), true, alice, alice, { from: alice }),
      'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
    )
  })


  it("adjustTrove(): Reverts if requested coll withdrawal and ether is sent", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    const aliceColl_Before = (await troveManager.Troves(alice))[1].toString()
    assert.equal(aliceColl_Before, dec(1, 'ether'))

    await assertRevert(borrowerOperations.adjustTrove(dec(1, 'ether'), dec(100, 18), true, alice, alice, { from: alice, value: dec(3, 'ether') }), 'BorrowerOperations: Cannot withdraw and add coll')
  })

  it("adjustTrove(): Reverts if requested coll withdrawal is greater than trove's collateral", async () => { 
    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), bob, bob, { from: bob, value: dec(1, 'ether') })

    // Requested coll withdrawal > coll in the trove
    await assertRevert(borrowerOperations.adjustTrove('1000000000000000001', 0 , false, alice, alice, {from: alice}))
    await assertRevert(borrowerOperations.adjustTrove(dec(37, 'ether'), 0 , false, bob, bob, {from: bob}))
    /*
    const txPromise_B = borrowerOperations.adjustTrove(dec(37, 'ether'), 0 , false, bob, bob, {from: bob})
    const txPromise_A = borrowerOperations.adjustTrove('1000000000000000001', 0 , false, alice, alice, {from: alice})

    await assertRevert(txPromise_A)
    await assertRevert(txPromise_B)
    */
  })

  it("adjustTrove(): Reverts if borrower has insufficient LUSD balance to cover his debt repayment", async () => {
    await borrowerOperations.openTrove(dec(1000, 18), A, A, { from: A, value: dec(15, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), B, B, { from: B, value: dec(5, 'ether') })
 
    // Bob transfers some LUSD to carol
    await lusdToken.transfer(C, dec(51, 18),  {from: B})

    //Confirm B's LUSD balance is less than 50 LUSD
    const B_LUSDBal = await lusdToken.balanceOf(B)
    assert.isTrue(B_LUSDBal.lt(toBN(dec(50, 18))))

    const repayLUSDPromise_B = borrowerOperations.adjustTrove(0, dec(50, 18), false, B, B, {from: B})
     
    // B attempts to repay 50 LUSD
    await assertRevert(repayLUSDPromise_B, "BorrowerOps: Caller doesnt have enough LUSD to close their trove")
  })

  // --- Internal _adjustTrove() ---

  it("Internal _adjustTrove(): reverts when _borrower param is not the msg.sender", async () => {
    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), bob, bob, { from: bob, value: dec(1, 'ether') })

    const txPromise_A = borrowerOperations.callInternalAdjustLoan(alice, dec(1, 18),  dec(1, 18), true, alice, alice, {from: bob} )
    const txPromise_B = borrowerOperations.callInternalAdjustLoan(bob, dec(1, 18),  dec(1, 18), true, alice, alice, {from: owner} )
    const txPromise_C = borrowerOperations.callInternalAdjustLoan(carol, dec(1, 18),  dec(1, 18), true, alice, alice, {from: bob} )
  
    await assertRevert(txPromise_A)
    await assertRevert(txPromise_B)
    await assertRevert(txPromise_C)
  })

  // --- closeTrove() ---

  it("closeTrove(): reverts when calling address does not have active trove", async () => {
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(1, 'ether') })

    // Bob successfully closes his trove
    const txBob = await borrowerOperations.closeTrove({ from: bob })
    assert.isTrue(txBob.receipt.status)

    // Carol with no active trove attempts to close her trove
    try {
      const txCarol = await borrowerOperations.closeTrove({ from: carol })
      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("closeTrove(): reverts when system is in Recovery Mode", async () => {
    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), bob, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), carol, carol, { from: carol, value: dec(1, 'ether') })

    // check recovery mode 
    assert.isFalse(await troveManager.checkRecoveryMode())

    // Bob successfully closes his trove
    const txBob = await borrowerOperations.closeTrove({ from: bob })
    assert.isTrue(txBob.receipt.status)

    await priceFeed.setPrice(dec(100, 18))

    assert.isTrue(await troveManager.checkRecoveryMode())

    // Carol attempts to close her trove during Recovery Mode
    try {
      const txCarol = await borrowerOperations.closeTrove({ from: carol })
      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("closeTrove(): reverts when trove is the only one in the system", async () => {
    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    // check recovery mode 
    assert.isFalse(await troveManager.checkRecoveryMode())

    // Alice attempts to close her trove
    try {
      const txAlice = await borrowerOperations.closeTrove({ from: alice })
      assert.isFalse(txAlice.receipt.status)
    } catch (err) {
      // assert.include(err.message, "revert")
      // assert.include(err.message, "TroveManager: Only one trove in the system")
    }
  })

  it("closeTrove(): reduces a Trove's collateral to zero", async () => {
    await borrowerOperations.openTrove(0, dennis, dennis, { from: dennis, value: dec(10, 'ether') })
    // await borrowerOperations.withdrawLUSD(dec(100, 18), dennis, dennis, { from: dennis })

    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(100, 18), alice, alice, { from: alice })

    const collBefore = ((await troveManager.Troves(alice))[1]).toString()
    assert.equal(collBefore, dec(1, 'ether'))

    // Alice attempts to close trove
    await borrowerOperations.closeTrove({ from: alice })

    const collAfter = ((await troveManager.Troves(alice))[1]).toString()
    assert.equal(collAfter, '0')
    // check withdrawal was successful
  })

  it("closeTrove(): reduces a Trove's debt to zero", async () => {
    await borrowerOperations.openTrove(0, dennis, dennis, { from: dennis, value: dec(10, 'ether') })

    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(100, 18), alice, alice, { from: alice })

    const debtBefore = ((await troveManager.Troves(alice))[0]).toString()
    assert.equal(debtBefore, dec(110, 18))

    // Alice attempts to close trove
    await borrowerOperations.closeTrove({ from: alice })

    const debtAfter = ((await troveManager.Troves(alice))[0]).toString()
    assert.equal(debtAfter, '0')
    // check withdrawal was successful
  })

  it("closeTrove(): sets Trove's stake to zero", async () => {
    await borrowerOperations.openTrove(0, dennis, dennis, { from: dennis, value: dec(10, 'ether') })

    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(100, 18), alice, alice, { from: alice })

    const stakeBefore = ((await troveManager.Troves(alice))[2]).toString()
    assert.equal(stakeBefore, dec(1, 'ether'))

    // Alice attempts to close trove
    await borrowerOperations.closeTrove({ from: alice })

    const stakeAfter = ((await troveManager.Troves(alice))[2]).toString()
    assert.equal(stakeAfter, '0')
    // check withdrawal was successful
  })

  it("closeTrove(): zero's the troves reward snapshots", async () => {

    // Dennis opens trove and transfers tokens to alice
    await borrowerOperations.openTrove(dec(100, 18), dennis, dennis, { from: dennis, value: dec(10, 'ether') })
    await lusdToken.transfer(alice, dec(100, 18), { from: dennis })

    await borrowerOperations.openTrove(dec(100, 18), bob, bob, { from: bob, value: dec(1, 'ether') })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Bob
    await troveManager.liquidate(bob)
    assert.isFalse(await sortedTroves.contains(bob))

    // Price bounces back
    await priceFeed.setPrice(dec(200, 18))

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), carol, carol, { from: carol, value: dec(1, 'ether') })

    // Price drops ...again
    await priceFeed.setPrice(dec(100, 18))

    // Get Alice's pending reward snapshots 
    const L_ETH_A_Snapshot = (await troveManager.rewardSnapshots(alice))[0]
    const L_LUSDDebt_A_Snapshot = (await troveManager.rewardSnapshots(alice))[1]

    assert.isTrue(L_ETH_A_Snapshot.gt(toBN('0')))
    assert.isTrue(L_LUSDDebt_A_Snapshot.gt(toBN('0')))

    // Liquidate Carol
    await troveManager.liquidate(carol)
    assert.isFalse(await sortedTroves.contains(carol))

    // Get Alice's pending reward snapshots after Carol's liquidation. Check above 0
    const L_ETH_Snapshot_A_AfterLiquidation = (await troveManager.rewardSnapshots(alice))[0]
    const L_LUSDDebt_Snapshot_A_AfterLiquidation = (await troveManager.rewardSnapshots(alice))[1]

    assert.isTrue(L_ETH_Snapshot_A_AfterLiquidation.gt(toBN('0')))
    assert.isTrue(L_LUSDDebt_Snapshot_A_AfterLiquidation.gt(toBN('0')))

    // Alice closes trove
    await borrowerOperations.closeTrove({ from: alice })

    // Check Alice's pending reward snapshots are zero
    const L_ETH_Snapshot_A_afterAliceCloses = (await troveManager.rewardSnapshots(alice))[0]
    const L_LUSDDebt_Snapshot_A_afterAliceCloses = (await troveManager.rewardSnapshots(alice))[1]

    assert.equal(L_ETH_Snapshot_A_afterAliceCloses, '0')
    assert.equal(L_LUSDDebt_Snapshot_A_afterAliceCloses, '0')
  })

  it("closeTrove(): closes the Trove", async () => {
    await borrowerOperations.openTrove(0, dennis, dennis, { from: dennis, value: dec(10, 'ether') })

    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(100, 18), alice, alice, { from: alice })

    // Check Trove is active
    const alice_Trove_Before = await troveManager.Troves(alice)
    const status_Before = alice_Trove_Before[3]

    assert.equal(status_Before, 1)
    assert.isTrue(await sortedTroves.contains(alice))

    // Close the trove
    await borrowerOperations.closeTrove({ from: alice })

    const alice_Trove_After = await troveManager.Troves(alice)
    const status_After = alice_Trove_After[3]

    assert.equal(status_After, 2)
    assert.isFalse(await sortedTroves.contains(alice))
  })

  it("closeTrove(): reduces ActivePool ETH and raw ether by correct amount", async () => {
    await borrowerOperations.openTrove(0, dennis, dennis, { from: dennis, value: dec(10, 'ether') })

    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(100, 18), alice, alice, { from: alice })

    // Check before
    const activePool_ETH_before = await activePool.getETH()
    const activePool_RawEther_before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_before, dec(11, 'ether'))
    assert.equal(activePool_RawEther_before, dec(11, 'ether'))

    // Close the trove
    await borrowerOperations.closeTrove({ from: alice })

    // Check after
    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, dec(10, 'ether'))
    assert.equal(activePool_RawEther_After, dec(10, 'ether'))
  })

  it("closeTrove(): reduces ActivePool debt by correct amount", async () => {
    await borrowerOperations.openTrove(0, dennis, dennis, { from: dennis, value: dec(10, 'ether') })

    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(100, 18), alice, alice, { from: alice })

    // Check before
    const activePool_Debt_before = (await activePool.getETH()).toString()
    assert.equal(activePool_Debt_before, dec(11, 'ether'))

    // Close the trove
    await borrowerOperations.closeTrove({ from: alice })

    // Check after
    const activePool_Debt_After = (await activePool.getLUSDDebt()).toString()
    assert.equal(activePool_Debt_After, dec(10, 18))
  })

  it("closeTrove(): updates the the total stakes", async () => {
    await borrowerOperations.openTrove(0, dennis, dennis, { from: dennis, value: dec(10, 'ether') })
    //  Alice creates initial Trove with 1 ether
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(1, 'ether') })

    const alice_Trove_Before = await troveManager.Troves(alice)
    const alice_Stake_Before = alice_Trove_Before[2].toString()
    const totalStakes_Before = (await troveManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '1000000000000000000')
    assert.equal(totalStakes_Before, '12000000000000000000')

    // Alice closes trove
    await borrowerOperations.closeTrove({ from: alice })

    // Check stake and total stakes get updated
    const alice_Trove_After = await troveManager.Troves(alice)
    const alice_Stake_After = alice_Trove_After[2].toString()
    const totalStakes_After = (await troveManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, 0)
    assert.equal(totalStakes_After, dec(11, 'ether'))
  })

  it("closeTrove(): sends the correct amount of ETH to the user", async () => {
    await borrowerOperations.openTrove(0, dennis, dennis, { from: dennis, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })

    const alice_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))
    await borrowerOperations.closeTrove({ from: alice, gasPrice: 0 })

    const alice_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(alice))
    const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

    assert.equal(balanceDiff, dec(1, 'ether'))
  })

  it("closeTrove(): subtracts the debt of the closed Trove from the Borrower's LUSDToken balance", async () => {
    await borrowerOperations.openTrove(0, dennis, dennis, { from: dennis, value: dec(10, 'ether') })

    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.withdrawLUSD(dec(100, 18), alice, alice, { from: alice })

    const alice_LUSDBalance_Before = await lusdToken.balanceOf(alice)
    assert.equal(alice_LUSDBalance_Before, dec(100, 18))

    // close trove
    await borrowerOperations.closeTrove({ from: alice })

    //   // check alive LUSD balance after

    const alice_LUSDBalance_After = await lusdToken.balanceOf(alice)
    assert.equal(alice_LUSDBalance_After, 0)
  })

  it("closeTrove(): applies pending rewards", async () => {
    // --- SETUP ---
    // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(15, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(5, 'ether') })
    await borrowerOperations.openTrove(0, carol, carol, { from: carol, value: dec(1, 'ether') })

    // Alice and Bob withdraw 90LUSD, Carol withdraws 170LUSD
    const LUSDwithdrawal_A = dec(90, 18)
    const LUSDwithdrawal_B = dec(90, 18)
    const LUSDwithdrawal_C = dec(170, 18)
    await borrowerOperations.withdrawLUSD(LUSDwithdrawal_A, alice, alice, { from: alice })
    await borrowerOperations.withdrawLUSD(LUSDwithdrawal_B, bob, bob, { from: bob })
    await borrowerOperations.withdrawLUSD(LUSDwithdrawal_C, carol, carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100LUSD, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');
    const price = await priceFeed.getPrice()

    // close Carol's Trove, liquidating her 1 ether and 180LUSD. Alice and Bob earn rewards.
    const liquidationTx = await troveManager.liquidate(carol, { from: owner });
    const [liquidatedDebt_C, liquidatedColl_C, gasComp_C] = th.getEmittedLiquidationValues(liquidationTx)
    // Dennis opens a new Trove with 10 Ether, withdraws LUSD and sends 135 LUSD to Alice, and 45 LUSD to Bob.

    await borrowerOperations.openTrove(0, dennis, dennis, { from: dennis, value: dec(100, 'ether') })
    const LUSDwithdrawal_D = await dec(200, 18)
    await borrowerOperations.withdrawLUSD(LUSDwithdrawal_D, dennis, dennis, { from: dennis })
    await lusdToken.transfer(alice, '135000000000000000000', { from: dennis })
    await lusdToken.transfer(bob, '45000000000000000000', { from: dennis })

    // check Alice and Bob's reward snapshots are zero before they alter their Troves
    alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
    const alice_LUSDDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

    const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
    const bob_LUSDDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

    assert.equal(alice_ETHrewardSnapshot_Before, 0)
    assert.equal(alice_LUSDDebtRewardSnapshot_Before, 0)
    assert.equal(bob_ETHrewardSnapshot_Before, 0)
    assert.equal(bob_LUSDDebtRewardSnapshot_Before, 0)

    const L_ETH = await troveManager.L_ETH()
    const L_LUSDDebt = await troveManager.L_LUSDDebt()

    const defaultPool_ETH = await defaultPool.getETH()
    const defaultPool_LUSDDebt = await defaultPool.getLUSDDebt()

    // Carol's liquidated coll (1 ETH) and drawn debt should have entered the Default Pool
    assert.isAtMost(th.getDifference(defaultPool_ETH, liquidatedColl_C), 100)
    assert.isAtMost(th.getDifference(defaultPool_LUSDDebt, liquidatedDebt_C), 100)

    // Close Alice's trove. Alice's pending rewards should be removed from the DefaultPool when she close.
    await borrowerOperations.closeTrove({ from: alice })

    const expectedCollReward_A = liquidatedColl_C.mul(toBN(dec(15, 'ether'))).div(toBN(dec(20, 'ether')))
    const expectedDebtReward_A = liquidatedDebt_C.mul(toBN(dec(15, 'ether'))).div(toBN(dec(20, 'ether')))

    const defaultPool_ETH_afterAliceCloses = await defaultPool.getETH()
    const defaultPool_LUSDDebt_afterAliceCloses = await defaultPool.getLUSDDebt()

    assert.isAtMost(th.getDifference(defaultPool_ETH_afterAliceCloses,
      defaultPool_ETH.sub(expectedCollReward_A)), 100)
    assert.isAtMost(th.getDifference(defaultPool_LUSDDebt_afterAliceCloses,
      defaultPool_LUSDDebt.sub(expectedDebtReward_A)), 100)

    // Close Bob's trove. Expect DefaultPool coll and debt to drop to 0, since closing pulls his rewards out.
    await borrowerOperations.closeTrove({ from: bob })

    const defaultPool_ETH_afterBobCloses = await defaultPool.getETH()
    const defaultPool_LUSDDebt_afterBobCloses = await defaultPool.getLUSDDebt()

    assert.isAtMost(th.getDifference(defaultPool_ETH_afterBobCloses, 0), 100)
    assert.isAtMost(th.getDifference(defaultPool_LUSDDebt_afterBobCloses, 0), 100)
  })

  it("closeTrove(): reverts if borrower has insufficient LUSD balance to repay his entire debt", async () => {
    await borrowerOperations.openTrove(dec(1000), A, A, { from: A, value: dec(15, 'ether') })
    await borrowerOperations.openTrove(dec(100), B, B, { from: B, value: dec(5, 'ether') })
 
    // Bob transfers some LUSD to carol
    await lusdToken.transfer(carol, 1,  {from: B})

    //Confirm Bob's LUSD balance is less than his trove debt
    const B_LUSDBal = await lusdToken.balanceOf(B)
    const B_troveDebt = (await troveManager.Troves(B))[0]
    
    assert.isTrue(B_LUSDBal.lt(B_troveDebt))

    const closeTrovePromise_B = borrowerOperations.closeTrove({from: B})
    
    // Check closing trove reverts
    await assertRevert(closeTrovePromise_B, "BorrowerOps: Caller doesnt have enough LUSD to close their trove")
  })

  // --- openTrove() ---

  it("openTrove(): emits a TroveUpdated event with the correct collateral and debt", async () => { 
    const txA = await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    const txB = await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    const txC = await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    const A_emittedDebt = th.getEventArgByName(txA, "TroveUpdated", "_debt")
    const A_emittedColl = th.getEventArgByName(txA, "TroveUpdated", "_coll")
    const B_emittedDebt = th.getEventArgByName(txB, "TroveUpdated", "_debt")
    const B_emittedColl = th.getEventArgByName(txB, "TroveUpdated", "_coll")
    const C_emittedDebt = th.getEventArgByName(txC, "TroveUpdated", "_debt")
    const C_emittedColl = th.getEventArgByName(txC, "TroveUpdated", "_coll")

    // Check emitted debts include 10 LUSD gas comp
    assert.equal(A_emittedDebt, dec(40, 18))
    assert.equal(B_emittedDebt, dec(50, 18))
    assert.equal(C_emittedDebt, dec(60, 18))
 
    // Check coll values are 1 ETH
    for (const coll of [A_emittedColl, B_emittedColl, C_emittedColl] ) {
      assert.equal(coll, dec(1, 18))
    }
    
    // Redemption occurs, increasing baseRate
    await th.redeemCollateral(A, contracts, dec(30, 18))
    assert.isTrue((await troveManager.baseRate()).gt(toBN('0')))

    const LUSDGasComp = toBN(dec(10, 18))
    const D_drawnDebt = toBN(dec(60, 18))
    const E_drawnDebt = toBN(dec(70, 18))
    
    const txD = await borrowerOperations.openTrove(D_drawnDebt, D, D, { from: D, value: dec(1, 'ether') })
    const txE = await borrowerOperations.openTrove(E_drawnDebt, E, E, { from: E, value: dec(1, 'ether') })

    const D_emittedDebt = toBN(th.getEventArgByName(txD, "TroveUpdated", "_debt"))
    const D_emittedFee = toBN(th.getEventArgByName(txD, "LUSDBorrowingFeePaid", "_LUSDFee"))
    const D_emittedColl = th.getEventArgByName(txD, "TroveUpdated", "_coll")
    
    const E_emittedDebt = th.getEventArgByName(txE, "TroveUpdated", "_debt")
    const E_emittedFee = toBN(th.getEventArgByName(txE, "LUSDBorrowingFeePaid", "_LUSDFee"))
    const E_emittedColl = th.getEventArgByName(txE, "TroveUpdated", "_coll")

    // Expected emitted debt is the debt issuance request + gas comp + fee
    const D_expectedEmittedDebt = D_drawnDebt.add(LUSDGasComp).add(D_emittedFee)
    const E_expectedEmittedDebt = E_drawnDebt.add(LUSDGasComp).add(E_emittedFee)

    // Check emitted debts include 10 LUSD gas comp
    assert.isTrue(D_expectedEmittedDebt.eq(D_emittedDebt))
    assert.isTrue(E_expectedEmittedDebt.eq(E_emittedDebt))

    // Check coll values are 1 ETH
    for (const coll of [D_emittedColl, E_emittedColl] ) {
      assert.equal(coll, dec(1, 18))
    }
  })

  it("openTrove(): decays a non-zero base rate", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D opens trove 
    await borrowerOperations.openTrove(dec(37, 18), D, D, { from: D, value: dec(5, 'ether') })

    // Check baseRate has decreased
    const baseRate_2 = await troveManager.baseRate()
    assert.isTrue(baseRate_2.lt(baseRate_1))

    // 1 hour passes
    th.fastForwardTime(3600, web3.currentProvider)

    // E opens trove 
    await borrowerOperations.openTrove(dec(12, 18), E, E, { from: E, value: dec(3, 'ether') })

    const baseRate_3 = await troveManager.baseRate()
    assert.isTrue(baseRate_3.lt(baseRate_2))
  })

  it("openTrove(): updates base rate when user issues 0 debt (aside from gas comp)", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D opens trove with 0 debt
    await borrowerOperations.openTrove(0, D, D, { from: D, value: dec(5, 'ether') })

    // Check baseRate has decayed
    const baseRate_2 = await troveManager.baseRate()
    assert.isTrue(baseRate_2.lt(baseRate_1))
  })

  it("openTrove(): doesn't change base rate if it is already zero", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await troveManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D opens trove 
    await borrowerOperations.openTrove(dec(37, 18), D, D, { from: D, value: dec(5, 'ether') })

    // Check baseRate is still 0
    const baseRate_2 = await troveManager.baseRate()
    assert.equal(baseRate_2, '0')

    // 1 hour passes
    th.fastForwardTime(3600, web3.currentProvider)

    // E opens trove 
    await borrowerOperations.openTrove(dec(12, 18), E, E, { from: E, value: dec(3, 'ether') })

    const baseRate_3 = await troveManager.baseRate()
    assert.equal(baseRate_3, '0')
  })

  it("openTrove(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime()

    // 50 seconds pass
    th.fastForwardTime(50, web3.currentProvider)

    // Borrower D triggers a fee
    await borrowerOperations.openTrove(dec(1, 18), D, D, { from: D, value: dec(1, 'ether') })

    const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime()

    // Check that the last fee operation time did not update, as borrower D's debt issuance occured
    // since before minimum interval had passed 
    assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

    // 10 seconds passes
    th.fastForwardTime(10, web3.currentProvider)

    // Check that now, at least one hour has passed since lastFeeOpTime_1
    const timeNow = await th.getLatestBlockTimestamp(web3)
    assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(3600))

    // Borrower E triggers a fee
    await borrowerOperations.openTrove(dec(1, 18), E, E, { from: E, value: dec(1, 'ether') })

    const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime()

    // Check that the last fee operation time DID update, as borrower's debt issuance occured
    // after minimum interval had passed 
    assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
  })


  it("openTrove(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 59 minutes pass
    th.fastForwardTime(3540, web3.currentProvider)

    // Assume Borrower also owns accounts D and E
    // Borrower triggers a fee, before decay interval has passed
    await borrowerOperations.openTrove(dec(1, 18), D, D, { from: D, value: dec(1, 'ether') })

    // 1 minute pass
    th.fastForwardTime(3540, web3.currentProvider)

    // Borrower triggers another fee
    await borrowerOperations.openTrove(dec(1, 18), E, E, { from: E, value: dec(1, 'ether') })

    // Check base rate has decreased even though Borrower tried to stop it decaying
    const baseRate_2 = await troveManager.baseRate()
    assert.isTrue(baseRate_2.lt(baseRate_1))
  })

  it("openTrove(): borrowing at non-zero base rate sends LUSD fee to LQTY staking contract", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check LQTY LUSD balance before == 0
    const lqtyStaking_LUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
    assert.equal(lqtyStaking_LUSDBalance_Before, '0')

    // D opens trove 
    await borrowerOperations.openTrove(dec(37, 18), D, D, { from: D, value: dec(5, 'ether') })

    // Check LQTY LUSD balance after has increased
    const lqtyStaking_LUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
    assert.isTrue(lqtyStaking_LUSDBalance_After.gt(lqtyStaking_LUSDBalance_Before))
  })

  it("openTrove(): borrowing at non-zero base records the (drawn debt + fee) on the Trove struct", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    const withdrawal_D = toBN(dec(37, 18))

    gasComp = toBN(dec(10, 18))

    // D withdraws LUSD
    const openTroveTx = await borrowerOperations.openTrove(withdrawal_D, D, D, { from: D, value: dec(5, 'ether') })
    
    const emittedFee = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(openTroveTx))
    assert.isTrue(toBN(emittedFee).gt(toBN('0')))

    const newDebt = (await troveManager.Troves(D))[0]

    // Check debt on Trove struct equals drawn debt plus emitted fee
    assert.isTrue(newDebt.eq(withdrawal_D.add(emittedFee).add(gasComp)))
  })

  it("openTrove(): Borrowing at non-zero base rate increases the LQTY staking contract LUSD fees-per-unit-staked", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check LQTY contract LUSD fees-per-unit-staked is zero
    const F_LUSD_Before = await lqtyStaking.F_LUSD()
    assert.equal(F_LUSD_Before, '0')

    // D opens trove 
    await borrowerOperations.openTrove(dec(37, 18), D, D, { from: D, value: dec(5, 'ether') })

    // Check LQTY contract LUSD fees-per-unit-staked has increased
    const F_LUSD_After = await lqtyStaking.F_LUSD()
    assert.isTrue(F_LUSD_After.gt(F_LUSD_Before))
  })

  it("openTrove(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check LQTY Staking contract balance before == 0
    const lqtyStaking_LUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
    assert.equal(lqtyStaking_LUSDBalance_Before, '0')

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D opens trove 
    const LUSDRequest_D = toBN(dec(40, 18))
    await borrowerOperations.openTrove(LUSDRequest_D, D, D, { from: D, value: dec(5, 'ether') })

    // Check LQTY staking LUSD balance has increased
    const lqtyStaking_LUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
    assert.isTrue(lqtyStaking_LUSDBalance_After.gt(lqtyStaking_LUSDBalance_Before))

    // Check D's LUSD balance now equals their requested LUSD
    const LUSDBalance_D = await lusdToken.balanceOf(D)
    assert.isTrue(LUSDRequest_D.eq(LUSDBalance_D))
  })

  it("openTrove(): Borrowing at zero base rate does not change LUSD balance of LQTY staking contract", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await troveManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check LQTY LUSD balance before == 0
    const lqtyStaking_LUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
    assert.equal(lqtyStaking_LUSDBalance_Before, '0')

    // D opens trove 
    await borrowerOperations.openTrove(dec(37, 18), D, D, { from: D, value: dec(5, 'ether') })

    // Check LQTY LUSD balance after == 0
    const lqtyStaking_LUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
    assert.equal(lqtyStaking_LUSDBalance_After, '0')
  })

  it("openTrove(): Borrowing at zero base rate does not change LQTY staking contract LUSD fees-per-unit-staked", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await troveManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check LQTY LUSD balance before == 0
    const F_LUSD_Before = await lqtyStaking.F_LUSD()
    assert.equal(F_LUSD_Before, '0')

    // D opens trove 
    await borrowerOperations.openTrove(dec(37, 18), D, D, { from: D, value: dec(5, 'ether') })

    // Check LQTY LUSD balance after == 0
    const F_LUSD_After = await lqtyStaking.F_LUSD()
    assert.equal(F_LUSD_After, '0')
  })

  it("openTrove(): Borrowing at zero base rate sends total requested LUSD to the user", async () => {
    await borrowerOperations.openTrove(0, A, A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await troveManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D opens trove 
    const LUSDRequest_D = toBN(dec(40, 18))
    await borrowerOperations.openTrove(LUSDRequest_D, D, D, { from: D, value: dec(5, 'ether') })

    // Check D's LUSD balance now equals their requested LUSD
    const LUSDBalance_D = await lusdToken.balanceOf(D)

    assert.isTrue(LUSDRequest_D.eq(LUSDBalance_D))
  })


  it("openTrove(): reverts when system is in Recovery Mode", async () => {

    await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    assert.isFalse(await troveManager.checkRecoveryMode())

    // price drops, and recovery mode kicks in
    await priceFeed.setPrice(dec(100, 18))

    assert.isTrue(await troveManager.checkRecoveryMode())

    // Bob tries to open a trove with same coll and debt, during Recovery Mode
    try {
      const txBob = await borrowerOperations.openTrove(dec(100, 18), bob, bob, { from: bob, value: dec(1, 'ether') })
      assert.isFalse(txBob.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("openTrove(): reverts when trove ICR < MCR", async () => {
    const txAlice = await borrowerOperations.openTrove(dec(100, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    const price = await priceFeed.getPrice()
    const aliceICR = await troveManager.getCurrentICR(alice, price)

    assert.isTrue(txAlice.receipt.status)
    assert.isTrue(aliceICR.gte(web3.utils.toBN('110000000000000000')))

    // Bob attempts to open a trove with coll = 1 ETH, debt = 182 LUSD. At ETH:USD price = 200, his ICR = 1 * 200 / 182 =   109.8%.
    try {
      const txBob = await borrowerOperations.openTrove('182000000000000000000', bob, bob, { from: bob, value: dec(1, 'ether') })
      assert.isFalse(txBob.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("openTrove(): reverts when opening the trove causes the TCR of the system to fall below the CCR", async () => {
    await priceFeed.setPrice(dec(100, 18))

    // Alice creates trove with 3 ETH / 200 LUSD, and 150% ICR.  System TCR = 150%.
    const txAlice = await borrowerOperations.openTrove(dec(190, 18), alice, alice, { from: alice, value: dec(3, 'ether') })
    const price = await priceFeed.getPrice()

    const TCR = await troveManager.getTCR()
    assert.equal(TCR, '1500000000000000000')

    // Bob attempts to open a trove with coll = 1 ETH, actual debt = 201 LUSD. At ETH:USD price = 1, his ICR = 300 / 201 =   149.25%`

    // System TCR would be: ((3+3) * 100 ) / (200+201) = 600/401 = 149.62%, i.e. below CCR of 150%.
    try {
      const txBob = await borrowerOperations.openTrove('191000000000000000000', bob, bob, { from: bob, value: dec(3, 'ether') })
      assert.isFalse(txBob.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("openTrove(): reverts if withdrawal would pull TCR below CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(3, 'ether') })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawLUSD('390000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawLUSD('390000000000000000000', bob, bob, { from: bob })

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // Carol attempts to open a trove, which would reduce TCR to below 150%
    try {
      const txData = await borrowerOperations.openTrove('180000000000000000000', carol, carol, { from: carol, value: dec(1, 'ether') })
      assert.isFalse(txData.receipt.status)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("openTrove(): with ICR < 300%, reverts when system is in recovery mode", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(3, 'ether') })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawLUSD('390000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawLUSD('390000000000000000000', bob, bob, { from: bob })

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // price drops to 1ETH:150LUSD, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000');

    try {                                                
      const txData = await borrowerOperations.openTrove('101000000000000000000', carol, carol, { from: carol, value: dec(1, 'ether') })
      assert.isFalse(txData.receipt.status)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
    // this should work as the ICR is exactly 300% (incl the virtual debt)
    await borrowerOperations.openTrove('90000000000000000000', carol, carol, { from: carol, value: dec(2, 'ether') })
  })

  it("openTrove(): reverts if trove is already active", async () => {
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(10, 'ether') })

    await borrowerOperations.openTrove(dec(50, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), bob, bob, { from: bob, value: dec(1, 'ether') })

    try {
      const txB_1 = await borrowerOperations.openTrove(dec(100, 18), bob, bob, { from: bob, value: dec(1, 'ether') })
      assert.isFalse(txB_1.receipt.status)
    } catch (err) {
      assert.include(err.message, 'revert')
    }

    try {
      const txB_2 = await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(1, 'ether') })
      assert.isFalse(txB_2.receipt.status)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("openTrove(): Can open a trove with zero debt (plus gas comp) when system is in recovery mode, if ICR >= 300%", async () => {
    // --- SETUP ---
    //  Alice and Bob add coll and withdraw such  that the TCR is ~150%
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(0, bob, bob, { from: bob, value: dec(3, 'ether') })
    await borrowerOperations.withdrawLUSD('390000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawLUSD('390000000000000000000', bob, bob, { from: bob })

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // price drops to 1ETH:100LUSD, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000');
    

    assert.isTrue(await troveManager.checkRecoveryMode())

    await assertRevert(
      borrowerOperations.openTrove(dec(80, 18), carol, carol, { from: carol, value: dec(1, 'ether') }),
      'BorrowerOps: In Recovery Mode new troves must have ICR >= R_MCR'
    )
    const txCarol = await borrowerOperations.openTrove(0, carol, carol, { from: carol, value: dec(1, 'ether') })
    assert.isTrue(txCarol.receipt.status)

    assert.isTrue(await troveManager.checkRecoveryMode())

    assert.isTrue(await sortedTroves.contains(carol))

    const carol_TroveStatus = await troveManager.getTroveStatus(carol)
    assert.equal(carol_TroveStatus, 1)
  })

  it("openTrove(): creates a new Trove and assigns the correct collateral and debt amount", async () => {
    const alice_Trove_Before = await troveManager.Troves(alice)

    const debt_Before = alice_Trove_Before[0]
    const coll_Before = alice_Trove_Before[1]
    const status_Before = alice_Trove_Before[3]

    // check coll and debt before
    assert.equal(debt_Before, 0)
    assert.equal(coll_Before, 0)

    // check non-existent status
    assert.equal(status_Before, 0)

    await borrowerOperations.openTrove('50000000000000000000', alice, alice, { from: alice, value: dec(1, 'ether') })

    const alice_Trove_After = await troveManager.Troves(alice)

    const debt_After = alice_Trove_After[0].toString()
    const coll_After = alice_Trove_After[1]
    const status_After = alice_Trove_After[3]

    // check coll and debt after
    assert.equal(debt_After, '60000000000000000000')
    assert.equal(coll_After, dec(1, 'ether'))

    // check active status
    assert.equal(status_After, 1)
  })

  it("openTrove(): adds Trove owner to TroveOwners array", async () => {
    const TroveOwnersCount_Before = (await troveManager.getTroveOwnersCount()).toString();
    assert.equal(TroveOwnersCount_Before, '0')

    await borrowerOperations.openTrove('50000000000000000000', alice, alice, { from: alice, value: dec(1, 'ether') })

    const TroveOwnersCount_After = (await troveManager.getTroveOwnersCount()).toString();
    assert.equal(TroveOwnersCount_After, '1')
  })

  it("openTrove(): creates a stake and adds it to total stakes", async () => {
    const alice_Trove_Before = await troveManager.Troves(alice)
    const alice_Stake_Before = alice_Trove_Before[2].toString()
    const totalStakes_Before = (await troveManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '0')
    assert.equal(totalStakes_Before, '0')

    await borrowerOperations.openTrove('50000000000000000000', alice, alice, { from: alice, value: dec(1, 'ether') })

    const alice_Trove_After = await troveManager.Troves(alice)
    const alice_Stake_After = alice_Trove_After[2].toString()
    const totalStakes_After = (await troveManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, '1000000000000000000')
    assert.equal(totalStakes_After, '1000000000000000000')
  })

  it("openTrove(): inserts Trove to Sorted Troves list", async () => {
    // check before
    const aliceTroveInList_Before = await sortedTroves.contains(alice)
    const listIsEmpty_Before = await sortedTroves.isEmpty()
    assert.equal(aliceTroveInList_Before, false)
    assert.equal(listIsEmpty_Before, true)

    await borrowerOperations.openTrove('50000000000000000000', alice, alice, { from: alice, value: dec(1, 'ether') })

    // check after
    const aliceTroveInList_After = await sortedTroves.contains(alice)
    const listIsEmpty_After = await sortedTroves.isEmpty()
    assert.equal(aliceTroveInList_After, true)
    assert.equal(listIsEmpty_After, false)
  })

  it("openTrove(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
    const activePool_ETH_Before = await activePool.getETH()
    const activePool_RawEther_Before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_Before, 0)
    assert.equal(activePool_RawEther_Before, 0)

    await borrowerOperations.openTrove('50000000000000000000', alice, alice, { from: alice, value: dec(1, 'ether') })

    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, dec(1, 'ether'))
    assert.equal(activePool_RawEther_After, dec(1, 'ether'))
  })

  it("openTrove(): records up-to-date initial snapshots of L_ETH and L_LUSDDebt", async () => {
    // --- SETUP ---
    /* Alice adds 10 ether
    Carol adds 1 ether */
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(0, carol, carol, { from: carol, value: dec(1, 'ether') })

    // Alice withdraws 90LUSD, Carol withdraws 170LUSD
    const A_LUSDWithdrawal = dec(90, 18)
    const C_LUSDWithdrawal = dec(170, 18)
    await borrowerOperations.withdrawLUSD(A_LUSDWithdrawal, alice, alice, { from: alice })
    await borrowerOperations.withdrawLUSD(C_LUSDWithdrawal, carol, carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100LUSD, reducing Carol's ICR below MCR
    await priceFeed.setPrice(dec(100, 18));

    // close Carol's Trove, liquidating her 1 ether and 180LUSD.
    const liquidationTx = await troveManager.liquidate(carol, { from: owner });
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

    /* with total stakes = 10 ether, after liquidation, L_ETH should equal 1/10 ether per-ether-staked,
     and L_LUSD should equal 18 LUSD per-ether-staked. */

    const L_ETH = await troveManager.L_ETH()
    const L_LUSD = await troveManager.L_LUSDDebt()

    assert.isAtMost(th.getDifference(L_ETH, liquidatedColl.div(toBN('10'))), 100)
    assert.isAtMost(th.getDifference(L_LUSD, liquidatedDebt.div(toBN('10'))), 100)

    // Bob opens trove
    await borrowerOperations.openTrove('50000000000000000000', bob, bob, { from: bob, value: dec(1, 'ether') })

    // check Bob's snapshots of L_ETH and L_LUSD equal the respective current values
    const bob_rewardSnapshot = await troveManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot = bob_rewardSnapshot[0]
    const bob_LUSDDebtRewardSnapshot = bob_rewardSnapshot[1]

    assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot, L_ETH), 100)
    assert.isAtMost(th.getDifference(bob_LUSDDebtRewardSnapshot, L_LUSD), 100)
  })

  it("openTrove(): allows a user to open a Trove, then close it, then re-open it", async () => {
    // Open Troves
    await borrowerOperations.openTrove(0, whale, whale, { from: whale, value: dec(100, 'ether') })
    await borrowerOperations.openTrove('50000000000000000000', alice, alice, { from: alice, value: dec(1, 'ether') })

    // Check Trove is active
    const alice_Trove_1 = await troveManager.Troves(alice)
    const status_1 = alice_Trove_1[3]
    assert.equal(status_1, 1)
    assert.isTrue(await sortedTroves.contains(alice))

    // Repay and close Trove
    await borrowerOperations.closeTrove({ from: alice })
    /*
    await borrowerOperations.repayLUSD('50000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice })
    */

    // Check Trove is closed
    const alice_Trove_2 = await troveManager.Troves(alice)
    const status_2 = alice_Trove_2[3]
    assert.equal(status_2, 2)
    assert.isFalse(await sortedTroves.contains(alice))

    // Re-open Trove
    await borrowerOperations.openTrove('25000000000000000000', alice, alice, { from: alice, value: dec(1, 'ether') })

    // Check Trove is re-opened
    const alice_Trove_3 = await troveManager.Troves(alice)
    const status_3 = alice_Trove_3[3]
    assert.equal(status_3, 1)
    assert.isTrue(await sortedTroves.contains(alice))
  })

  it("openTrove(): increases the Trove's LUSD debt by the correct amount", async () => {
    // check before
    const alice_Trove_Before = await troveManager.Troves(alice)
    const debt_Before = alice_Trove_Before[0]
    assert.equal(debt_Before, 0)

    await borrowerOperations.openTrove('50000000000000000000', alice, alice, { from: alice, value: dec(1, 'ether') })

    // check after
    const alice_Trove_After = await troveManager.Troves(alice)
    const debt_After = alice_Trove_After[0]
    assert.equal(debt_After, '60000000000000000000')
  })

  it("openTrove(): increases LUSD debt in ActivePool by (drawn debt + gas comp)", async () => {
    const activePool_LUSDDebt_Before = await activePool.getLUSDDebt()
    assert.equal(activePool_LUSDDebt_Before, 0)

    await borrowerOperations.openTrove(dec(50, 18), alice, alice, { from: alice, value: dec(1, 'ether') })

    const activePool_LUSDDebt_After = await activePool.getLUSDDebt()
    assert.equal(activePool_LUSDDebt_After, dec(60, 18))
  })

  it("openTrove(): increases user LUSDToken balance by correct amount", async () => {
    // check before
    const alice_LUSDTokenBalance_Before = await lusdToken.balanceOf(alice)
    assert.equal(alice_LUSDTokenBalance_Before, 0)

    await borrowerOperations.openTrove('50000000000000000000', alice, alice, { from: alice, value: dec(1, 'ether') })

    // check after
    const alice_LUSDTokenBalance_After = await lusdToken.balanceOf(alice)
    assert.equal(alice_LUSDTokenBalance_After, '50000000000000000000')
  })

  //  --- getNewICRFromTroveChange ---

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

  it("getCompositeDebt(): returns debt + 10 gas comp", async () => { 
    const res1 = await borrowerOperations.getCompositeDebt('0')
    assert.equal(res1, dec(10, 18))

    const res2 = await borrowerOperations.getCompositeDebt(dec(90, 18))
    assert.equal(res2, dec(100, 18))

    const res3 = await borrowerOperations.getCompositeDebt(dec(24423422357345049, 12))
    assert.equal(res3, dec(24423422367345049, 12))
  })

  //  --- getNewICRFromTroveChange ---

  describe("getNewTCRFromTroveChange() returns the correct TCR", async () => {

    // 0, 0
    it("collChange = 0, debtChange = 0", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = toBN(dec(1, 'ether'))
      const troveDebt = toBN(dec(100, 18))
      await borrowerOperations.openTrove(troveDebt, alice, alice, { from: alice, value: troveColl })
      await borrowerOperations.openTrove(troveDebt, bob, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await troveManager.liquidate(bob)
      assert.isFalse(await sortedTroves.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = 0
      const debtChange = 0
      const newTCR = await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, true, price)

      const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
                          .div(troveDebt.add(LUSD_GAS_COMPENSATION).add(liquidatedDebt))

      assert.isTrue(newTCR.eq(expectedTCR))
    })

    // 0, +ve
    it("collChange = 0, debtChange is positive", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = toBN(dec(1, 'ether'))
      const troveDebt = toBN(dec(100, 18))
      await borrowerOperations.openTrove(troveDebt, alice, alice, { from: alice, value: troveColl })
      await borrowerOperations.openTrove(troveDebt, bob, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await troveManager.liquidate(bob)
      assert.isFalse(await sortedTroves.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = 0
      const debtChange = dec(200, 18)
      const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, true, price))

      const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
      .div(troveDebt.add(LUSD_GAS_COMPENSATION).add(liquidatedDebt).add(toBN(debtChange)))

      assert.isTrue(newTCR.eq(expectedTCR))
    })

    // 0, -ve
    it("collChange = 0, debtChange is negative", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = toBN(dec(1, 'ether'))
      const troveDebt = toBN(dec(100, 18))
      await borrowerOperations.openTrove(troveDebt, alice, alice, { from: alice, value: troveColl })
      await borrowerOperations.openTrove(troveDebt, bob, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await troveManager.liquidate(bob)
      assert.isFalse(await sortedTroves.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()
      // --- TEST ---
      const collChange = 0
      const debtChange = dec(100, 18)
      const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, false, price))

      const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
      .div(troveDebt.add(LUSD_GAS_COMPENSATION).add(liquidatedDebt).sub(toBN(dec(100, 18))))

      assert.isTrue(newTCR.eq(expectedTCR))
    })

    // +ve, 0
    it("collChange is positive, debtChange is 0", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = toBN(dec(1, 'ether'))
      const troveDebt = toBN(dec(100, 18))
      await borrowerOperations.openTrove(troveDebt, alice, alice, { from: alice, value: troveColl })
      await borrowerOperations.openTrove(troveDebt, bob, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await troveManager.liquidate(bob)
      assert.isFalse(await sortedTroves.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()
      // --- TEST ---
      const collChange = dec(2, 'ether')
      const debtChange = 0
      const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, true, price))

      const expectedTCR = (troveColl.add(liquidatedColl).add(toBN(collChange))).mul(price)
      .div(troveDebt.add(LUSD_GAS_COMPENSATION).add(liquidatedDebt))

      assert.isTrue(newTCR.eq(expectedTCR))
    })

    // -ve, 0
    it("collChange is negative, debtChange is 0", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = toBN(dec(1, 'ether'))
      const troveDebt = toBN(dec(100, 18))
      await borrowerOperations.openTrove(troveDebt, alice, alice, { from: alice, value: troveColl })
      await borrowerOperations.openTrove(troveDebt, bob, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await troveManager.liquidate(bob)
      assert.isFalse(await sortedTroves.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = dec(1, 18)
      const debtChange = 0
      const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, false, debtChange, true, price))

      const expectedTCR = (troveColl.add(liquidatedColl).sub(toBN(dec(1, 'ether')))).mul(price)
                          .div(troveDebt.add(LUSD_GAS_COMPENSATION).add(liquidatedDebt))

      assert.isTrue(newTCR.eq(expectedTCR))
    })

    // -ve, -ve
    it("collChange is negative, debtChange is negative", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = toBN(dec(1, 'ether'))
      const troveDebt = toBN(dec(100, 18))
      await borrowerOperations.openTrove(troveDebt, alice, alice, { from: alice, value: troveColl })
      await borrowerOperations.openTrove(troveDebt, bob, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await troveManager.liquidate(bob)
      assert.isFalse(await sortedTroves.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = dec(1, 18)
      const debtChange = dec(100, 18)
      const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, false, debtChange, false, price))

      const expectedTCR = (troveColl.add(liquidatedColl).sub(toBN(dec(1, 'ether')))).mul(price)
      .div(troveDebt.add(LUSD_GAS_COMPENSATION).add(liquidatedDebt).sub(toBN(dec(100, 18)))) 

      assert.isTrue(newTCR.eq(expectedTCR))
    })

    // +ve, +ve 
    it("collChange is positive, debtChange is positive", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = toBN(dec(1, 'ether'))
      const troveDebt = toBN(dec(100, 18))
      await borrowerOperations.openTrove(troveDebt, alice, alice, { from: alice, value: troveColl })
      await borrowerOperations.openTrove(troveDebt, bob, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await troveManager.liquidate(bob)
      assert.isFalse(await sortedTroves.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = dec(1, 'ether')
      const debtChange = dec(100, 18)
      const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, true, price))

      const expectedTCR = (troveColl.add(liquidatedColl).add(toBN(dec(1, 'ether')))).mul(price)
                          .div(troveDebt.add(LUSD_GAS_COMPENSATION).add(liquidatedDebt).add(toBN(dec(100, 18)))) 

      assert.isTrue(newTCR.eq(expectedTCR))
    })

    // +ve, -ve
    it("collChange is positive, debtChange is negative", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = toBN(dec(1, 'ether'))
      const troveDebt = toBN(dec(100, 18))
      await borrowerOperations.openTrove(troveDebt, alice, alice, { from: alice, value: troveColl })
      await borrowerOperations.openTrove(troveDebt, bob, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await troveManager.liquidate(bob)
      assert.isFalse(await sortedTroves.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = dec(1, 'ether')
      const debtChange = dec(100, 18)
      const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, false, price))

      const expectedTCR = (troveColl.add(liquidatedColl).add(toBN(dec(1, 'ether')))).mul(price)
                          .div(troveDebt.add(LUSD_GAS_COMPENSATION).add(liquidatedDebt).sub(toBN(dec(100, 18)))) 

      assert.isTrue(newTCR.eq(expectedTCR))
    })

    // -ve, +ve
    it("collChange is negative, debtChange is positive", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = toBN(dec(1, 'ether'))
      const troveDebt = toBN(dec(100, 18))
      await borrowerOperations.openTrove(troveDebt, alice, alice, { from: alice, value: troveColl })
      await borrowerOperations.openTrove(troveDebt, bob, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await troveManager.liquidate(bob)
      assert.isFalse(await sortedTroves.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = dec(1, 18)
      const debtChange = dec(200, 18)
      const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, false, debtChange, true, price))

      const expectedTCR = (troveColl.add(liquidatedColl).sub(toBN(dec(1, 18)))).mul(price)
            .div(troveDebt.add(LUSD_GAS_COMPENSATION).add(liquidatedDebt).add(toBN(debtChange)))  
  
      assert.isTrue(newTCR.eq(expectedTCR))
    })
  })

  it('closeTrove(): fails if owner cannot receive ETH', async () => {
    const nonPayable = await NonPayable.new()

    // we need 2 troves to be able to close 1 and have 1 remaining in the system
    await borrowerOperations.openTrove(0, alice, alice, { from: alice, value: dec(10, 18) })
    // open trove from NonPayable proxy contract
    const openTroveData = th.getTransactionData('openTrove(uint256,address,address)', ['0x0', '0x0', '0x0'])
    await nonPayable.forward(borrowerOperations.address, openTroveData, { value: dec(1, 'ether') })
    assert.equal((await troveManager.getTroveStatus(nonPayable.address)).toString(), '1', 'NonPayable proxy should have a trove')
    assert.isFalse(await troveManager.checkRecoveryMode(), 'System should not be in Recovery Mode')
    // open trove from NonPayable proxy contract
    const closeTroveData = th.getTransactionData('closeTrove()', [])
    await th.assertRevert(nonPayable.forward(borrowerOperations.address, closeTroveData), 'ActivePool: sending ETH failed')
  })
})



contract('Reset chain state', async accounts => { })

/* TODO:

1) Test SortedList re-ordering by ICR. ICR ratio
changes with addColl, withdrawColl, withdrawLUSD, repayLUSD, etc. Can split them up and put them with
individual functions, or give ordering it's own 'describe' block.

2)In security phase:
-'Negative' tests for all the above functions.
*/
