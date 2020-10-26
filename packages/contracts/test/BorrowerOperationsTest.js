const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")

const th = testHelpers.TestHelper

const dec = th.dec
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const ZERO_ADDRESS = th.ZERO_ADDRESS



contract('BorrowerOperations', async accounts => {

  const [
    owner, alice, bob, carol, dennis, whale,
    A, B, C, D, E,
    defaulter_1, defaulter_2,
    frontEnd_1, frontEnd_2, frontEnd_3] = accounts;

  const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]

  let priceFeed
  let clvToken
  let poolManager
  let sortedCDPs
  let cdpManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  let contracts

  before(async () => {

  })

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.borrowerOperations = await BorrowerOperationsTester.new()
    const GTContracts = await deploymentHelper.deployGTContracts()

    priceFeed = contracts.priceFeed
    clvToken = contracts.clvToken
    poolManager = contracts.poolManager
    sortedCDPs = contracts.sortedCDPs
    cdpManager = contracts.cdpManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    gtStaking = GTContracts.gtStaking
    growthToken = GTContracts.growthToken
    communityIssuance = GTContracts.communityIssuance
    lockupContractFactory = GTContracts.lockupContractFactory

    await deploymentHelper.connectGTContracts(GTContracts)
    await deploymentHelper.connectCoreContracts(contracts, GTContracts)
    await deploymentHelper.connectGTContractsToCore(GTContracts, contracts)
  })

  it("addColl(): Increases the activePool ETH and raw ether balance by correct amount", async () => {

    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })

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

  it("addColl(), active CDP: adds the correct collateral amount to the CDP", async () => {
    // alice creates a CDP and adds first collateral
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    coll_Before = alice_CDP_Before[1]
    const status_Before = alice_CDP_Before[3]

    // check coll and status before
    assert.equal(coll_Before, dec(1, 'ether'))
    assert.equal(status_Before, 1)

    // Alice adds second collateral
    await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(1, 'ether') })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    const status_After = alice_CDP_After[3]

    // check coll increases by correct amount,and status remains active
    assert.equal(coll_After, dec(2, 'ether'))
    assert.equal(status_After, 1)
  })

  it("addColl(), active CDP: CDP is in sortedList before and after", async () => {
    // alice creates a CDP and adds first collateral
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })

    // check Alice is in list before
    const aliceCDPInList_Before = await sortedCDPs.contains(alice)
    const listIsEmpty_Before = await sortedCDPs.isEmpty()
    assert.equal(aliceCDPInList_Before, true)
    assert.equal(listIsEmpty_Before, false)

    await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(1, 'ether') })

    // check Alice is still in list after
    const aliceCDPInList_After = await sortedCDPs.contains(alice)
    const listIsEmpty_After = await sortedCDPs.isEmpty()
    assert.equal(aliceCDPInList_After, true)
    assert.equal(listIsEmpty_After, false)
  })

  it("addColl(), active CDP: updates the stake and updates the total stakes", async () => {
    //  Alice creates initial CDP with 1 ether
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '1000000000000000000')
    assert.equal(totalStakes_Before, '1000000000000000000')

    // Alice tops up CDP collateral with 2 ether
    await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(2, 'ether') })

    // Check stake and total stakes get updated
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_Stake_After = alice_CDP_After[2].toString()
    const totalStakes_After = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, '3000000000000000000')
    assert.equal(totalStakes_After, '3000000000000000000')
  })

  it("addColl(), active CDP: applies pending rewards and updates user's L_ETH, L_CLVDebt snapshots", async () => {
    // --- SETUP ---
    // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether.  Withdraw 100/100/180 CLV
    const CLVwithdrawal_A = await th.getActualDebtFromComposite(dec(100, 18), contracts)
    const CLVwithdrawal_B = await th.getActualDebtFromComposite(dec(100, 18), contracts)
    const CLVwithdrawal_C = await th.getActualDebtFromComposite(dec(180, 18), contracts)

    await borrowerOperations.openLoan(CLVwithdrawal_A, alice, { from: alice, value: dec(15, 'ether') })
    await borrowerOperations.openLoan(CLVwithdrawal_B, bob, { from: bob, value: dec(5, 'ether') })
    await borrowerOperations.openLoan(CLVwithdrawal_C, carol, { from: carol, value: dec(1, 'ether') })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Close Carol's CDP, liquidating her 1 ether and 180CLV.
    const tx = await cdpManager.liquidate(carol, { from: owner });
    const liquidatedDebt_C = th.getEmittedLiquidatedDebt(tx)
    const liquidatedColl_C = th.getEmittedLiquidatedColl(tx)

    assert.isFalse(await sortedCDPs.contains(carol))

    const L_ETH = await cdpManager.L_ETH()
    const L_CLVDebt = await cdpManager.L_CLVDebt()

    // check Alice and Bob's reward snapshots are zero before they alter their CDPs
    const alice_rewardSnapshot_Before = await cdpManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
    const alice_CLVDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

    const bob_rewardSnapshot_Before = await cdpManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
    const bob_CLVDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

    assert.equal(alice_ETHrewardSnapshot_Before, 0)
    assert.equal(alice_CLVDebtRewardSnapshot_Before, 0)
    assert.equal(bob_ETHrewardSnapshot_Before, 0)
    assert.equal(bob_CLVDebtRewardSnapshot_Before, 0)

    // Alice and Bob top up their CDPs
    await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(5, 'ether') })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: dec(1, 'ether') })

    /* Check that both alice and Bob have had pending rewards applied in addition to their top-ups. 
    
    When Carol defaulted, her liquidated debt and coll was distributed to A and B in proportion to their 
    collateral shares.  
    */
    const expectedCollReward_A = liquidatedColl_C.mul(th.toBN(dec(15, 'ether'))).div(th.toBN(dec(20, 'ether')))
    const expectedDebtReward_A = liquidatedDebt_C.mul(th.toBN(dec(15, 'ether'))).div(th.toBN(dec(20, 'ether')))
    const expectedCollReward_B = liquidatedColl_C.mul(th.toBN(dec(5, 'ether'))).div(th.toBN(dec(20, 'ether')))
    const expectedDebtReward_B = liquidatedDebt_C.mul(th.toBN(dec(5, 'ether'))).div(th.toBN(dec(20, 'ether')))

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_CLVDebt_After = alice_CDP_After[0]
    const alice_Coll_After = alice_CDP_After[1]

    const bob_CDP_After = await cdpManager.CDPs(bob)
    const bob_CLVDebt_After = bob_CDP_After[0]
    const bob_Coll_After = bob_CDP_After[1]



    // Expect Alice coll = 15 + 5  + reward
    // Expect Bob coll = 5 + 1 + reward
    assert.isAtMost(th.getDifference(alice_Coll_After, th.toBN(dec(20, 'ether')).add(expectedCollReward_A)), 100)
    assert.isAtMost(th.getDifference(alice_CLVDebt_After, CLVwithdrawal_A.add(expectedDebtReward_A)), 100)

    assert.isAtMost(th.getDifference(bob_Coll_After, th.toBN(dec(6, 'ether')).add(expectedCollReward_B)), 100)
    assert.isAtMost(th.getDifference(bob_CLVDebt_After, CLVwithdrawal_B.add(expectedDebtReward_B)), 100)

    /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
    to the latest values of L_ETH and L_CLVDebt */
    alice_rewardSnapshot_After = await cdpManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
    const alice_CLVDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]

    const bob_rewardSnapshot_After = await cdpManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
    const bob_CLVDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]

    assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, L_ETH), 100)
    assert.isAtMost(th.getDifference(alice_CLVDebtRewardSnapshot_After, L_CLVDebt), 100)
    assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, L_ETH), 100)
    assert.isAtMost(th.getDifference(bob_CLVDebtRewardSnapshot_After, L_CLVDebt), 100)
  })

  // it("addColl(), active CDP: adds the right corrected stake after liquidations have occured", async () => {
  //  // TODO - check stake updates for addColl/withdrawColl/adustLoan ---

  //   // --- SETUP ---
  //   // A,B,C add 15/5/5 ETH, withdraw 100/100/900 CLV
  //   await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(15, 'ether') })
  //   await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(4, 'ether') })
  //   await borrowerOperations.openLoan(dec(900, 18), carol, { from: carol, value: dec(5, 'ether') })

  //   await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(1, 'ether') })
  //   // --- TEST ---

  //   // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
  //   await priceFeed.setPrice('100000000000000000000');

  //   // close Carol's CDP, liquidating her 5 ether and 900CLV.
  //   await cdpManager.liquidate(carol, { from: owner });

  //   // dennis tops up his loan by 1 ETH
  //   await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: dec(1, 'ether') })

  //   /* Check that Dennis's recorded stake is the right corrected stake, less than his collateral. A corrected 
  //   stake is given by the formula: 

  //   s = totalStakesSnapshot / totalCollateralSnapshot 

  //   where snapshots are the values immediately after the last liquidation.  After Carol's liquidation, 
  //   the ETH from her CDP has now become the totalPendingETHReward. So:

  //   totalStakes = (alice_Stake + bob_Stake + dennis_orig_stake ) = (15 + 4 + 1) =  20 ETH.
  //   totalCollateral = (alice_Collateral + bob_Collateral + dennis_orig_coll + totalPendingETHReward) = (15 + 4 + 1 + 5)  = 25 ETH.

  //   Therefore, as Dennis adds 1 ether collateral, his corrected stake should be:  s = 2 * (20 / 25 ) = 1.6 ETH */
  //   const dennis_CDP = await cdpManager.CDPs(dennis)

  //   const dennis_Stake = dennis_CDP[2]
  //   console.log(dennis_Stake.toString())

  //   assert.isAtMost(th.getDifference(dennis_Stake), 100)
  // })

  it("addColl(): non-trove owner can add collateral to another user's trove", async () => {
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(5, 'ether') })

    const activeETH_Before = await activePool.getETH()
    assert.equal(activeETH_Before, dec(10, 'ether'))

    // Dennis adds collateral to Bob's trove
    const tx = await borrowerOperations.addColl(bob, bob, { from: dennis, value: dec(5, 'ether') })
    assert.isTrue(tx.receipt.status)

    // Check Bob's collateral
    const bob_collateral = (await cdpManager.CDPs(bob))[1].toString()
    assert.equal(bob_collateral, dec(8, 'ether'))

    // Check Bob's stake
    const bob_Stake = (await cdpManager.CDPs(bob))[2].toString()
    assert.equal(bob_Stake, dec(8, 'ether'))

    // Check activePool ETH increased to 15 ETH
    const activeETH_After = await activePool.getETH()
    assert.equal(activeETH_After, dec(15, 'ether'))
  })

  it("addColl(): non-trove owner can add collateral to another user's trove", async () => {
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(5, 'ether') })

    const activeETH_Before = await activePool.getETH()
    assert.equal(activeETH_Before, dec(10, 'ether'))

    // Carol adds collateral to Bob's trove
    const tx = await borrowerOperations.addColl(bob, bob, { from: carol, value: dec(5, 'ether') })
    assert.isTrue(tx.receipt.status)

    // Check Bob's collateral
    const bob_collateral = (await cdpManager.CDPs(bob))[1].toString()
    assert.equal(bob_collateral, dec(8, 'ether'))

    // Check Bob's stake
    const bob_Stake = (await cdpManager.CDPs(bob))[2].toString()
    assert.equal(bob_Stake, dec(8, 'ether'))

    // Check activePool ETH increased to 15 ETH
    const activeETH_After = await activePool.getETH()
    assert.equal(activeETH_After, dec(15, 'ether'))
  })

  it("addColl(), reverts if trove is non-existent or closed", async () => {
    // A, B open troves
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })

    // Carol attempts to add collateral to her non-existent trove
    try {
      const txCarol = await borrowerOperations.addColl(carol, carol, { from: carol, value: dec(1, 'ether') })
      assert.isFalse(txCarol.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "CDP does not exist or is closed")
    }

    // Alice attempts to add colalteral to Carol's non-existent trove
    try {
      const txCarol_fromAlice = await borrowerOperations.addColl(carol, carol, { from: alice, value: dec(1, 'ether') })
      assert.isFalse(txCarol_fromAlice.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "CDP does not exist or is closed")
    }

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Bob gets liquidated
    await cdpManager.liquidate(bob)

    assert.isFalse(await sortedCDPs.contains(bob))

    // Bob attempts to add collateral to his closed trove
    try {
      const txBob = await borrowerOperations.addColl(bob, bob, { value: dec(1, 'ether') })
      assert.isFalse(txBob.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "CDP does not exist or is closed")
    }

    // Alice attempts to add colalteral to Bob's closed trove
    try {
      const txBob_fromAlice = await borrowerOperations.addColl(bob, bob, { from: alice, value: dec(1, 'ether') })
      assert.isFalse(txBob_fromAlice.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "CDP does not exist or is closed")
    }
  })

  // --- withdrawColl() ---

  // reverts when calling address does not have active trove  
  it("withdrawColl(): reverts when calling address does not have active trove", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })

    // Bob successfully withdraws some coll
    const txBob = await borrowerOperations.withdrawColl(dec(100, 'finney'), bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Carol with no active trove attempts to withdraw
    try {
      const txCarol = await borrowerOperations.withdrawColl(dec(1, 'ether'), carol, { from: carol })
      assert.fail(txCarol)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawColl(): reverts when system is in Recovery Mode", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.withdrawCLV(dec(100, 18), alice, { from: alice })
    await borrowerOperations.withdrawCLV(dec(100, 18), bob, { from: bob })

    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Withdrawal possible when recoveryMode == false
    const txAlice = await borrowerOperations.withdrawColl(1000, alice, { from: alice })
    assert.isTrue(txAlice.receipt.status)

    await priceFeed.setPrice('105000000000000000000')

    assert.isTrue(await cdpManager.checkRecoveryMode())

    //Check withdrawal impossible when recoveryMode == true
    try {
      const txBob = await borrowerOperations.withdrawColl(1000, bob, { from: bob })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawColl(): reverts when requested ETH withdrawal is > the trove's collateral", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: dec(1, 'ether') })

    // Carol withdraws exactly all her collateral
    const txCarol = await borrowerOperations.withdrawColl('1000000000000000000', carol, { from: carol })
    assert.isTrue(txCarol.receipt.status)

    // Bob attempts to withdraw 1 wei more than his collateral
    try {
      const txBob = await borrowerOperations.withdrawColl('1000000000000000001', bob, { from: bob })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawColl(): reverts when withdrawal would bring the user's ICR < MCR", async () => {
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(10, 'ether') })

    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })

    const CLVwithdrawal_A = await await th.getActualDebtFromComposite(dec(50, 18), contracts)
    const CLVwithdrawal_B = await await th.getActualDebtFromComposite(dec(50, 18), contracts)
    await borrowerOperations.withdrawCLV(CLVwithdrawal_A, alice, { from: alice })
    await borrowerOperations.withdrawCLV(CLVwithdrawal_B, bob, { from: bob })


    // Alice withdraws 0.45 ether, leaving 0.55 remaining. Her ICR = (0.55*100)/50 = 110%.
    const txAlice = await borrowerOperations.withdrawColl('450000000000000000', alice, { from: alice })
    assert.isTrue(txAlice.receipt.status)

    // Bob attempts to withdraws 0.46 ether, Which would leave him with 0.54 coll and ICR = (0.54*100)/50 = 108%.
    try {
      const txBob = await borrowerOperations.withdrawColl('460000000000000000', bob, { from: bob })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawColl(): reverts if system is in recovery mode", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(3, 'ether') })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    const TCR = (await cdpManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // price drops to 1ETH:150CLV, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000');

    //Alice tries to withdraw collateral during Recovery Mode
    try {
      const txData = await borrowerOperations.withdrawColl('1', alice, { from: alice })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("withdrawColl(): allows a user to completely withdraw all collateral from their CDP", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(100, 'finney') })

    // Alice attempts to withdraw all collateral
    const txData = await borrowerOperations.withdrawColl(dec(100, 'finney'), alice, { from: alice })

    // check withdrawal was successful
    txStatus = txData.receipt.status
    assert.isTrue(txStatus)
  })

  it("withdrawColl(): closes the CDP when the user withdraws all collateral", async () => {
    // Open CDPs
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })

    // Check CDP is active
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const status_Before = alice_CDP_Before[3]
    assert.equal(status_Before, 1)
    assert.isTrue(await sortedCDPs.contains(alice))

    // Withdraw all the collateral in the CDP
    await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, { from: alice })

    // Check CDP is closed
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const status_After = alice_CDP_After[3]
    assert.equal(status_After, 2)
    assert.isFalse(await sortedCDPs.contains(alice))

  })

  it("withdrawColl(): leaves the CDP active when the user withdraws less than all the collateral", async () => {
    // Open CDP 
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })

    // Check CDP is active
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const status_Before = alice_CDP_Before[3]
    assert.equal(status_Before, 1)
    assert.isTrue(await sortedCDPs.contains(alice))

    // Withdraw some collateral
    await borrowerOperations.withdrawColl(dec(100, 'finney'), alice, { from: alice })

    // Check CDP is still active
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const status_After = alice_CDP_After[3]
    assert.equal(status_After, 1)
    assert.isTrue(await sortedCDPs.contains(alice))
  })

  it("withdrawColl(): reduces the CDP's collateral by the correct amount", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(2, 'ether') })

    // check before -  Alice has 2 ether in CDP 
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const coll_Before = alice_CDP_Before[1]
    assert.equal(coll_Before, dec(2, 'ether'))

    // Alice withdraws 1 ether
    await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, { from: alice })

    // Check 1 ether remaining
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    assert.equal(coll_After, dec(1, 'ether'))
  })

  it("withdrawColl(): reduces ActivePool ETH and raw ether by correct amount", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(2, 'ether') })

    // check before
    const activePool_ETH_before = await activePool.getETH()
    const activePool_RawEther_before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_before, dec(2, 'ether'))
    assert.equal(activePool_RawEther_before, dec(2, 'ether'))

    await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, { from: alice })

    // check after
    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, dec(1, 'ether'))
    assert.equal(activePool_RawEther_After, dec(1, 'ether'))
  })

  it("withdrawColl(): updates the stake and updates the total stakes", async () => {
    //  Alice creates initial CDP with 2 ether
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(2, 'ether') })

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '2000000000000000000')
    assert.equal(totalStakes_Before, '2000000000000000000')

    // Alice withdraws 1 ether
    await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, { from: alice })

    // Check stake and total stakes get updated
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_Stake_After = alice_CDP_After[2].toString()
    const totalStakes_After = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, '1000000000000000000')
    assert.equal(totalStakes_After, '1000000000000000000')
  })

  it("withdrawColl(): sends the correct amount of ETH to the user", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(2, 'ether') })

    const alice_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))
    await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, { from: alice, gasPrice: 0 })

    const alice_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(alice))
    const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

    //   assert.equal(balanceDiff.toString(), dec(1, 'ether'))
  })

  it("withdrawColl(): applies pending rewards and updates user's L_ETH, L_CLVDebt snapshots", async () => {
    // --- SETUP ---
    // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(15, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(5, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: carol, value: dec(1, 'ether') })

    // Alice and Bob withdraw 100CLV, Carol withdraws 180CLV
    const CLVwithdrawal_A = await await th.getActualDebtFromComposite(dec(100, 18), contracts)
    const CLVwithdrawal_B = await await th.getActualDebtFromComposite(dec(100, 18), contracts)
    const CLVwithdrawal_C = await await th.getActualDebtFromComposite(dec(180, 18), contracts)

    await borrowerOperations.withdrawCLV(CLVwithdrawal_A, alice, { from: alice })
    await borrowerOperations.withdrawCLV(CLVwithdrawal_B, bob, { from: bob })
    await borrowerOperations.withdrawCLV(CLVwithdrawal_C, carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Carol's CDP, liquidating her 1 ether and 180CLV.
    const liquidationTx_C = await cdpManager.liquidate(carol, { from: owner });
    const [liquidatedDebt_C, liquidatedColl_C, gasComp_C] = th.getEmittedLiquidationValues(liquidationTx_C)

    const L_ETH = await cdpManager.L_ETH()
    const L_CLVDebt = await cdpManager.L_CLVDebt()

    // check Alice and Bob's reward snapshots are zero before they alter their CDPs
    const alice_rewardSnapshot_Before = await cdpManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
    const alice_CLVDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

    const bob_rewardSnapshot_Before = await cdpManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
    const bob_CLVDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

    assert.equal(alice_ETHrewardSnapshot_Before, 0)
    assert.equal(alice_CLVDebtRewardSnapshot_Before, 0)
    assert.equal(bob_ETHrewardSnapshot_Before, 0)
    assert.equal(bob_CLVDebtRewardSnapshot_Before, 0)

    // Alice and Bob withdraw from their CDPs
    await borrowerOperations.withdrawColl(dec(5, 'ether'), alice, { from: alice })
    await borrowerOperations.withdrawColl(dec(1, 'ether'), bob, { from: bob })
    /* Check that both alice and Bob have had pending rewards applied in addition to their top-ups. 
    
    When Carol defaulted, her liquidated debt and coll was distributed to A and B in proportion to their 
    collateral shares.  
    */
    const expectedCollReward_A = liquidatedColl_C.mul(th.toBN(dec(15, 'ether'))).div(th.toBN(dec(20, 'ether')))
    const expectedDebtReward_A = liquidatedDebt_C.mul(th.toBN(dec(15, 'ether'))).div(th.toBN(dec(20, 'ether')))
    const expectedCollReward_B = liquidatedColl_C.mul(th.toBN(dec(5, 'ether'))).div(th.toBN(dec(20, 'ether')))
    const expectedDebtReward_B = liquidatedDebt_C.mul(th.toBN(dec(5, 'ether'))).div(th.toBN(dec(20, 'ether')))

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_CLVDebt_After = alice_CDP_After[0]
    const alice_Coll_After = alice_CDP_After[1]

    const bob_CDP_After = await cdpManager.CDPs(bob)
    const bob_CLVDebt_After = bob_CDP_After[0]
    const bob_Coll_After = bob_CDP_After[1]

    // Expect Alice coll = 15 - 5  + reward
    // Expect Bob coll = 5 - 1 + reward
    assert.isAtMost(th.getDifference(alice_Coll_After, th.toBN(dec(10, 'ether')).add(expectedCollReward_A)), 100)
    assert.isAtMost(th.getDifference(alice_CLVDebt_After, CLVwithdrawal_A.add(expectedDebtReward_A)), 100)

    assert.isAtMost(th.getDifference(bob_Coll_After, th.toBN(dec(4, 'ether')).add(expectedCollReward_B)), 100)
    assert.isAtMost(th.getDifference(bob_CLVDebt_After, CLVwithdrawal_B.add(expectedDebtReward_B)), 100)

    /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
    to the latest values of L_ETH and L_CLVDebt */
    alice_rewardSnapshot_After = await cdpManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
    const alice_CLVDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]

    const bob_rewardSnapshot_After = await cdpManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
    const bob_CLVDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]

    assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, L_ETH), 100)
    assert.isAtMost(th.getDifference(alice_CLVDebtRewardSnapshot_After, L_CLVDebt), 100)
    assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, L_ETH), 100)
    assert.isAtMost(th.getDifference(bob_CLVDebtRewardSnapshot_After, L_CLVDebt), 100)
  })

  // --- withdrawCLV() ---

  it("withdrawCLV(): decays a non-zero base rate", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D withdraws CLV
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.withdrawCLV(dec(37, 18), D, { from: D })

    // Check baseRate has decreased
    const baseRate_2 = await cdpManager.baseRate()
    assert.isTrue(baseRate_2.lt(baseRate_1))

    // 1 hour passes
    th.fastForwardTime(3600, web3.currentProvider)

    // E opens loan 
    await borrowerOperations.openLoan(dec(12, 18), E, { from: E, value: dec(3, 'ether') })

    const baseRate_3 = await cdpManager.baseRate()
    assert.isTrue(baseRate_3.lt(baseRate_2))
  })

  it("withdrawCLV(): doesn't change base rate if it is already zero", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D withdraws CLV
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.withdrawCLV(dec(37, 18), D, { from: D })

    // Check baseRate is still 0
    const baseRate_2 = await cdpManager.baseRate()
    assert.equal(baseRate_2, '0')

    // 1 hour passes
    th.fastForwardTime(3600, web3.currentProvider)

    // E opens loan 
    await borrowerOperations.openLoan(dec(12, 18), E, { from: E, value: dec(3, 'ether') })

    const baseRate_3 = await cdpManager.baseRate()
    assert.equal(baseRate_3, '0')
  })

  it("withdrawCLV(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    const lastFeeOpTime_1 = await cdpManager.lastFeeOperationTime()

    // 59 minutes pass
    th.fastForwardTime(3540, web3.currentProvider)

    // Borrower C triggers a fee
    await borrowerOperations.withdrawCLV(dec(1, 18), C, { from: C })

    const lastFeeOpTime_2 = await cdpManager.lastFeeOperationTime()

    // Check that the last fee operation time did not update, as borrower D's debt issuance occured
    // since before minimum interval had passed 
    assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

    // 1 minute passes
    th.fastForwardTime(60, web3.currentProvider)

    // Check that now, at least one hour has passed since lastFeeOpTime_1
    const timeNow = await th.getLatestBlockTimestamp(web3)
    assert.isTrue(th.toBN(timeNow).sub(lastFeeOpTime_1).gte(3600))

    // Borrower C triggers a fee
    await borrowerOperations.withdrawCLV(dec(1, 18), C, { from: C })

    const lastFeeOpTime_3 = await cdpManager.lastFeeOperationTime()

    // Check that the last fee operation time DID update, as borrower's debt issuance occured
    // after minimum interval had passed 
    assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
  })


  it("withdrawCLV(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    // 59 minutes pass
    th.fastForwardTime(3540, web3.currentProvider)

    // Borrower C triggers a fee, before decay interval has passed
    await borrowerOperations.withdrawCLV(dec(1, 18), C, { from: C })

    // 1 minute pass
    th.fastForwardTime(3540, web3.currentProvider)

    // Borrower C triggers another fee
    await borrowerOperations.withdrawCLV(dec(1, 18), C, { from: C })

    // Check base rate has decreased even though Borrower tried to stop it decaying
    const baseRate_2 = await cdpManager.baseRate()
    assert.isTrue(baseRate_2.lt(baseRate_1))
  })


  it("withdrawCLV(): borrowing at non-zero base rate sends CLV fee to GT staking contract", async () => {
    // time fast-forwards 1 year, and owner stakes 1 GT
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(gtStaking.address, dec(1, 18), { from: owner })
    await gtStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check GT CLV balance before == 0
    const gtStaking_CLVBalance_Before = await clvToken.balanceOf(gtStaking.address)
    assert.equal(gtStaking_CLVBalance_Before, '0')

    // D withdraws CLV
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.withdrawCLV(dec(37, 18), D, { from: D })

    // Check GT CLV balance after has increased
    const gtStaking_CLVBalance_After = await clvToken.balanceOf(gtStaking.address)
    assert.isTrue(gtStaking_CLVBalance_After.gt(gtStaking_CLVBalance_Before))
  })

  it("withdrawCLV(): Borrowing at non-zero base rate increases the GT staking contract CLV fees-per-unit-staked", async () => {
    // time fast-forwards 1 year, and owner stakes 1 GT
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(gtStaking.address, dec(1, 18), { from: owner })
    await gtStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check GT contract CLV fees-per-unit-staked is zero
    const F_LUSD_Before = await gtStaking.F_LUSD()
    assert.equal(F_LUSD_Before, '0')

    // D withdraws CLV
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.withdrawCLV(dec(37, 18), D, { from: D })

    // Check GT contract CLV fees-per-unit-staked has increased
    const F_LUSD_After = await gtStaking.F_LUSD()
    assert.isTrue(F_LUSD_After.gt(F_LUSD_Before))
  })

  it("withdrawCLV(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
    // time fast-forwards 1 year, and owner stakes 1 GT
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(gtStaking.address, dec(1, 18), { from: owner })
    await gtStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check GT Staking contract balance before == 0
    const gtStaking_CLVBalance_Before = await clvToken.balanceOf(gtStaking.address)
    assert.equal(gtStaking_CLVBalance_Before, '0')

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D withdraws CLV
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })
    const CLVRequest_D = th.toBN(dec(40, 18))
    await borrowerOperations.withdrawCLV(CLVRequest_D, D, { from: D })

    // Check GT staking CLV balance has increased
    const gtStaking_CLVBalance_After = await clvToken.balanceOf(gtStaking.address)
    assert.isTrue(gtStaking_CLVBalance_After.gt(gtStaking_CLVBalance_Before))

    // Check D's CLV balance now equals their requested CLV
    const CLVBalance_D = await clvToken.balanceOf(D)
    assert.isTrue(CLVRequest_D.eq(CLVBalance_D))
  })

  it("withdrawCLV(): Borrowing at zero base rate does not change CLV balance of GT staking contract", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check GT CLV balance before == 0
    const gtStaking_CLVBalance_Before = await clvToken.balanceOf(gtStaking.address)
    assert.equal(gtStaking_CLVBalance_Before, '0')

    // D withdraws CLV
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.withdrawCLV(dec(37, 18), D, { from: D })

    // Check GT CLV balance after == 0
    const gtStaking_CLVBalance_After = await clvToken.balanceOf(gtStaking.address)
    assert.equal(gtStaking_CLVBalance_After, '0')
  })

  it("withdrawCLV(): Borrowing at zero base rate does not change GT staking contract CLV fees-per-unit-staked", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check GT CLV balance before == 0
    const F_LUSD_Before = await gtStaking.F_LUSD()
    assert.equal(F_LUSD_Before, '0')

    // D withdraws CLV
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.withdrawCLV(dec(37, 18), D, { from: D })

    // Check GT CLV balance after == 0
    const F_LUSD_After = await gtStaking.F_LUSD()
    assert.equal(F_LUSD_After, '0')
  })

  it("withdrawCLV(): Borrowing at zero base rate sends total requested CLV to the user", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)


    // D withdraws CLV
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })
    const CLVRequest_D = th.toBN(dec(40, 18))
    await borrowerOperations.withdrawCLV(CLVRequest_D, D, { from: D })

    // Check D's CLV balance now equals their requested CLV
    const CLVBalance_D = await clvToken.balanceOf(D)

    assert.isTrue(CLVRequest_D.eq(CLVBalance_D))
  })

  it("withdrawCLV(): reverts when calling address does not have active trove", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })

    // Bob successfully withdraws CLV
    const txBob = await borrowerOperations.withdrawCLV(dec(100, 18), bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Carol with no active trove attempts to withdraw CLV
    try {
      const txCarol = await borrowerOperations.withdrawCLV(dec(100, 18), carol, { from: carol })
      assert.fail(txCarol)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawCLV(): reverts when requested withdrawal amount is zero CLV", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })

    // Bob successfully withdraws 1e-18 CLV
    const txBob = await borrowerOperations.withdrawCLV(1, bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Alice attempts to withdraw 0 CLV
    try {
      const txAlice = await borrowerOperations.withdrawCLV(0, alice, { from: alice })
      assert.fail(txAlice)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawCLV(): reverts when system is in Recovery Mode", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })

    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Withdrawal possible when recoveryMode == false
    const txAlice = await borrowerOperations.withdrawCLV(dec(100, 18), alice, { from: alice })
    assert.isTrue(txAlice.receipt.status)

    await priceFeed.setPrice('50000000000000000000')

    assert.isTrue(await cdpManager.checkRecoveryMode())

    //Check CLV withdrawal impossible when recoveryMode == true
    try {
      const txBob = await borrowerOperations.withdrawCLV(1, bob, { from: bob })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })


  it("withdrawCLV(): reverts when withdrawal would bring the loan's ICR < MCR", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })

    // Alice withdraws to a composite debt of 181 CLV
    const CLVwithdrawal_A = await await th.getActualDebtFromComposite("181000000000000000000", contracts)
    const txAlice = await borrowerOperations.withdrawCLV(CLVwithdrawal_A, alice, { from: alice })
    assert.isTrue(txAlice.receipt.status)

    const price = await priceFeed.getPrice()
    const aliceICR = await cdpManager.getCurrentICR(alice, price)

    // Check Alice ICR > MCR
    assert.isTrue(aliceICR.gte(web3.utils.toBN("1100000000000000000")))

    // Bob tries to withdraw CLV that would bring his ICR < MCR
    try {
      const txBob = await borrowerOperations.withdrawCLV("182000000000000000000", bob, { from: bob })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawCLV(): reverts when the withdrawal would cause the TCR of the system to fall below the CCR", async () => {
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Alice and Bob creates troves with 3 ETH / 200 CLV, and 150% ICR.  System TCR = 150%.
    const txAlice = await borrowerOperations.openLoan(dec(200, 18), alice, { from: alice, value: dec(3, 'ether') })
    const aliceICR = await cdpManager.getCurrentICR(alice, price)

    const txBob = await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(3, 'ether') })
    const bobICR = await cdpManager.getCurrentICR(bob, price)

    const TCR = (await cdpManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // Bob attempts to withdraw 1 CLV.
    // System TCR would be: ((3+3) * 100 ) / (200+201) = 600/401 = 149.62%, i.e. below CCR of 150%.
    try {
      const txBob = await borrowerOperations.withdrawCLV(dec(1, 18), bob, { from: bob })
      assert.isFalse(txBob.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })


  it("withdrawCLV(): reverts if withdrawal would pull TCR below CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(3, 'ether') })

    //  Alice and Bob withdraw such that the TCR is 150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    // --- TEST ---

    // Alice attempts to withdraw 10 CLV, which would reducing TCR below 150%
    try {
      const txData = await borrowerOperations.withdrawCLV('10000000000000000000', alice, { from: alice })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("withdrawCLV(): reverts if system is in recovery mode", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(3, 'ether') })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    // const TCR = (await cdpManager.getTCR()).toString()
    // assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // price drops to 1ETH:150CLV, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000');

    try {
      const txData = await borrowerOperations.withdrawCLV('200', alice, { from: alice })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })



  it("withdrawCLV(): increases the CDP's CLV debt by the correct amount", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })

    // check before
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 0)

    await borrowerOperations.withdrawCLV(100, alice, { from: alice })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, 100)
  })

  it("withdrawCLV(): increases CLV debt in ActivePool by correct amount", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })

    // check before
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 0)

    await borrowerOperations.withdrawCLV(100, alice, { from: alice })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, 100)
  })

  it("withdrawCLV(): increases user CLVToken balance by correct amount", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })

    // check before
    const alice_CLVTokenBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_Before, 0)

    await borrowerOperations.withdrawCLV(100, alice, { from: alice })

    // check after
    const alice_CLVTokenBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_After, 100)
  })

  // --- repayCLV() ---

  it("repayCLV(): reverts when calling address does not have active trove", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.withdrawCLV(dec(100, 18), alice, { from: alice })
    await borrowerOperations.withdrawCLV(dec(100, 18), bob, { from: bob })

    // Bob successfully repays some CLV
    const txBob = await borrowerOperations.repayCLV(dec(10, 18), bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Carol with no active trove attempts to repayCLV
    try {
      const txCarol = await borrowerOperations.repayCLV(dec(10, 18), carol, { from: carol })
      assert.fail(txCarol)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("repayCLV(): reverts when attempted repayment is > the debt of the trove", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.withdrawCLV(dec(100, 18), alice, { from: alice })
    await borrowerOperations.withdrawCLV(dec(100, 18), bob, { from: bob })

    // Bob successfully repays some CLV
    const txBob = await borrowerOperations.repayCLV(dec(10, 18), bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Alice attempts to repay more than her debt
    try {
      const txAlice = await borrowerOperations.repayCLV('101000000000000000000', alice, { from: alice })
      assert.fail(txAlice)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })



  //repayCLV: reduces CLV debt in CDP
  it("repayCLV(): reduces the CDP's CLV debt by the correct amount", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })

    // check before
    await borrowerOperations.withdrawCLV(100, alice, { from: alice })
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 100)

    await borrowerOperations.repayCLV(100, alice, { from: alice })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, 0)
  })

  it("repayCLV(): decreases CLV debt in ActivePool by correct amount", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })

    //check before
    await borrowerOperations.withdrawCLV(100, alice, { from: alice })
    const activePool_CLV_Before = await activePool.getCLVDebt()
    assert.equal(activePool_CLV_Before, 100)

    await borrowerOperations.repayCLV(100, alice, { from: alice })

    // check after
    activePool_CLV_After = await activePool.getCLVDebt()
    assert.equal(activePool_CLV_After, 0)
  })

  it("repayCLV(): decreases user CLVToken balance by correct amount", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })

    // check before
    await borrowerOperations.withdrawCLV(100, alice, { from: alice })
    const alice_CLVTokenBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_Before, 100)

    await borrowerOperations.repayCLV(100, alice, { from: alice })

    // check after
    const alice_CLVTokenBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_After, 0)
  })

  // --- adjustLoan() ---

  it("adjustLoan(): decays a non-zero base rate", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D adjusts loan
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.adjustLoan(0, dec(37, 18), true, D, { from: D })

    // Check baseRate has decreased
    const baseRate_2 = await cdpManager.baseRate()
    assert.isTrue(baseRate_2.lt(baseRate_1))

    // 1 hour passes
    th.fastForwardTime(3600, web3.currentProvider)

    // E adjusts loan
    await borrowerOperations.openLoan(0, E, { from: E, value: dec(2, 'ether') })
    await borrowerOperations.adjustLoan(0, dec(37, 15), true, E, { from: D })

    const baseRate_3 = await cdpManager.baseRate()
    assert.isTrue(baseRate_3.lt(baseRate_2))
  })

  it("adjustLoan(): doesn't change base rate if it is already zero", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D adjusts loan
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.adjustLoan(0, dec(37, 18), true, D, { from: D })

    // Check baseRate is still 0
    const baseRate_2 = await cdpManager.baseRate()
    assert.equal(baseRate_2, '0')

    // 1 hour passes
    th.fastForwardTime(3600, web3.currentProvider)

    // E adjusts loan
    await borrowerOperations.openLoan(0, E, { from: E, value: dec(2, 'ether') })
    await borrowerOperations.adjustLoan(0, dec(37, 15), true, E, { from: D })

    const baseRate_3 = await cdpManager.baseRate()
    assert.equal(baseRate_3, '0')
  })

  it("adjustLoan(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    const lastFeeOpTime_1 = await cdpManager.lastFeeOperationTime()

    // 59 minutes pass
    th.fastForwardTime(3540, web3.currentProvider)

    // Borrower C triggers a fee
    await borrowerOperations.adjustLoan(0, dec(1, 18), true, C, { from: C })

    const lastFeeOpTime_2 = await cdpManager.lastFeeOperationTime()

    // Check that the last fee operation time did not update, as borrower D's debt issuance occured
    // since before minimum interval had passed 
    assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

    // 1 minute passes
    th.fastForwardTime(60, web3.currentProvider)

    // Check that now, at least one hour has passed since lastFeeOpTime_1
    const timeNow = await th.getLatestBlockTimestamp(web3)
    assert.isTrue(th.toBN(timeNow).sub(lastFeeOpTime_1).gte(3600))

    // Borrower C triggers a fee
    await borrowerOperations.adjustLoan(0, dec(1, 18), true, C, { from: C })

    const lastFeeOpTime_3 = await cdpManager.lastFeeOperationTime()

    // Check that the last fee operation time DID update, as borrower's debt issuance occured
    // after minimum interval had passed 
    assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
  })


  it("adjustLoan(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    // 59 minutes pass
    th.fastForwardTime(3540, web3.currentProvider)

    // Borrower C triggers a fee, before decay interval has passed
    await borrowerOperations.adjustLoan(0, dec(1, 18), true, C, { from: C })

    // 1 minute pass
    th.fastForwardTime(3540, web3.currentProvider)

    // Borrower C triggers another fee
    await borrowerOperations.adjustLoan(0, dec(1, 18), true, C, { from: C })

    // Check base rate has decreased even though Borrower tried to stop it decaying
    const baseRate_2 = await cdpManager.baseRate()
    assert.isTrue(baseRate_2.lt(baseRate_1))
  })

  it("adjustLoan(): borrowing at non-zero base rate sends CLV fee to GT staking contract", async () => {
    // time fast-forwards 1 year, and owner stakes 1 GT
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(gtStaking.address, dec(1, 18), { from: owner })
    await gtStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check GT CLV balance before == 0
    const gtStaking_CLVBalance_Before = await clvToken.balanceOf(gtStaking.address)
    assert.equal(gtStaking_CLVBalance_Before, '0')

    // D adjusts loan
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.adjustLoan(0, dec(37, 18), true, D, { from: D })

    // Check GT CLV balance after has increased
    const gtStaking_CLVBalance_After = await clvToken.balanceOf(gtStaking.address)
    assert.isTrue(gtStaking_CLVBalance_After.gt(gtStaking_CLVBalance_Before))
  })

  it("adjustLoan(): Borrowing at non-zero base rate increases the GT staking contract CLV fees-per-unit-staked", async () => {
    // time fast-forwards 1 year, and owner stakes 1 GT
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(gtStaking.address, dec(1, 18), { from: owner })
    await gtStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check GT contract CLV fees-per-unit-staked is zero
    const F_LUSD_Before = await gtStaking.F_LUSD()
    assert.equal(F_LUSD_Before, '0')

    // D adjusts loan
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.adjustLoan(0, dec(37, 18), true, D, { from: D })

    // Check GT contract CLV fees-per-unit-staked has increased
    const F_LUSD_After = await gtStaking.F_LUSD()
    assert.isTrue(F_LUSD_After.gt(F_LUSD_Before))
  })

  it("adjustLoan(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
    // time fast-forwards 1 year, and owner stakes 1 GT
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(gtStaking.address, dec(1, 18), { from: owner })
    await gtStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check GT Staking contract balance before == 0
    const gtStaking_CLVBalance_Before = await clvToken.balanceOf(gtStaking.address)
    assert.equal(gtStaking_CLVBalance_Before, '0')

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D adjusts loan
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })
    const CLVRequest_D = th.toBN(dec(40, 18))
    await borrowerOperations.adjustLoan(0, CLVRequest_D, true, D, { from: D })

    // Check GT staking CLV balance has increased
    const gtStaking_CLVBalance_After = await clvToken.balanceOf(gtStaking.address)
    assert.isTrue(gtStaking_CLVBalance_After.gt(gtStaking_CLVBalance_Before))

    // Check D's CLV balance now equals their requested CLV
    const CLVBalance_D = await clvToken.balanceOf(D)
    assert.isTrue(CLVRequest_D.eq(CLVBalance_D))
  })

  it("adjustLoan(): Borrowing at zero base rate does not change CLV balance of GT staking contract", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check GT CLV balance before == 0
    const gtStaking_CLVBalance_Before = await clvToken.balanceOf(gtStaking.address)
    assert.equal(gtStaking_CLVBalance_Before, '0')

    // D adjusts loan
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.adjustLoan(0, dec(37, 18), true, D, { from: D })

    // Check GT CLV balance after == 0
    const gtStaking_CLVBalance_After = await clvToken.balanceOf(gtStaking.address)
    assert.equal(gtStaking_CLVBalance_After, '0')
  })

  it("adjustLoan(): Borrowing at zero base rate does not change GT staking contract CLV fees-per-unit-staked", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check GT CLV balance before == 0
    const F_LUSD_Before = await gtStaking.F_LUSD()
    assert.equal(F_LUSD_Before, '0')

    // D adjusts loan
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })
    await borrowerOperations.adjustLoan(0, dec(37, 18), true, D, { from: D })

    // Check GT CLV balance after == 0
    const F_LUSD_After = await gtStaking.F_LUSD()
    assert.equal(F_LUSD_After, '0')
  })

  it("adjustLoan(): Borrowing at zero base rate sends total requested CLV to the user", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D adjusts loan
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })
    const CLVRequest_D = th.toBN(dec(40, 18))
    await borrowerOperations.adjustLoan(0, CLVRequest_D, true, D, { from: D })

    // Check D's CLV balance now equals their requested CLV
    const CLVBalance_D = await clvToken.balanceOf(D)

    assert.isTrue(CLVRequest_D.eq(CLVBalance_D))
  })

  it("adjustLoan(): reverts when calling address has no active trove", async () => {
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })

    // Alice coll and debt increase(+1 ETH, +50CLV)
    await borrowerOperations.adjustLoan(0, dec(50, 18), true, alice, { from: alice, value: dec(1, 'ether') })

    try {
      const txCarol = await borrowerOperations.adjustLoan(0, dec(50, 18), true, carol, { from: carol, value: dec(1, 'ether') })
      assert.fail(txCarol)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustLoan(): reverts when system is in Recovery Mode", async () => {
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })

    assert.isFalse(await cdpManager.checkRecoveryMode())

    const txAlice = await borrowerOperations.adjustLoan(0, dec(50, 18), true, alice, { from: alice, value: dec(1, 'ether') })
    assert.isTrue(txAlice.receipt.status)

    await priceFeed.setPrice(dec(100, 18))

    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check operation impossible when system is in Recovery Mode
    try {
      const txBob = await borrowerOperations.adjustLoan(0, dec(50, 18), true, bob, { from: bob, value: dec(1, 'ether') })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustLoan(): reverts when change would cause the TCR of the system to fall below the CCR", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await borrowerOperations.openLoan(dec(200, 18), alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(3, 'ether') })

    // Check TCR and Recovery Mode
    const TCR = (await cdpManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Bob attempts an operation that would bring the TCR below the CCR
    try {
      const txBob = await borrowerOperations.adjustLoan(0, dec(1, 18), true, bob, { from: bob })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustLoan(): reverts when CLV repaid is > debt of the trove", async () => {
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Check Bob can make an adjustment that fully repays his debt
    const txBob = await borrowerOperations.adjustLoan(0, dec(100, 18), false, bob, { from: bob, value: dec(1, 'ether') })
    assert.isTrue(txBob.receipt.status)

    // Carol attempts an adjustment that would repay more than her debt
    try {
      const txCarol = await borrowerOperations.adjustLoan(0, dec(101, 18), false, carol, { from: carol })
      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustLoan(): reverts when attempted ETH withdrawal is > the trove's collateral", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: dec(1, 'ether') })

    // Check Bob can make an adjustment that fully withdraws his ETH
    const txBob = await borrowerOperations.adjustLoan(dec(1, 'ether'), 0, true, bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Carol attempts an adjustment that would withdraw more than her ETH
    try {
      const txCarol = await borrowerOperations.adjustLoan('1000000000000000001', 0, true, carol, { from: carol })
      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustLoan(): reverts when change would cause the ICR of the loan to fall below the MCR", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    await priceFeed.setPrice(dec(100, 18))

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(2, 'ether') })

    // Alice decreases coll by 1 ETH and increass debt by 100 CLV. 
    // New ICR would be: ((2+1) * 100) / (100 + 100) = 300/200 = 150%, 
    const txAlice = await borrowerOperations.adjustLoan(0, dec(100, 18), true, alice, { from: alice, value: dec(1, 'ether') })
    assert.isTrue(txAlice.receipt.status)

    // Bob attempts to decrease coll  by 1 ETH and increase debt by 200 CLV. 
    // New ICR would be: ((2+1) * 100) / (100 + 200) = 300/300 = 100%, below the MCR.
    try {
      const txBob = await borrowerOperations.adjustLoan(0, dec(200, 18), true, bob, { from: bob, value: dec(1, 'ether') })
      assert.isFalse(txBob.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustLoan(): With 0 coll change, doesnt change borrower's coll or ActivePool coll", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(10, 'ether') })

    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()
    const activePoolCollBefore = (await activePool.getETH()).toString()

    assert.equal(collBefore, dec(10, 'ether'))
    assert.equal(activePoolCollBefore, '110000000000000000000')

    // Alice adjusts loan. No coll change, and a debt increase (+50CLV)
    await borrowerOperations.adjustLoan(0, dec(50, 18), true, alice, { from: alice, value: 0 })

    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()
    const activePoolCollAfter = (await activePool.getETH()).toString()

    assert.equal(collAfter, collBefore)
    assert.equal(activePoolCollAfter, activePoolCollBefore)
  })

  it("adjustLoan(): With 0 debt change, doesnt change borrower's debt or ActivePool debt", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(10, 'ether') })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const activePoolDebtBefore = (await activePool.getCLVDebt()).toString()

    assert.equal(debtBefore, dec(100, 18))
    assert.equal(activePoolDebtBefore, dec(100, 18))

    // Alice adjusts loan. No coll change, no debt change
    await borrowerOperations.adjustLoan(0, 0, true, alice, { from: alice, value: dec(1, 'ether') })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()
    const activePoolDebtAfter = (await activePool.getCLVDebt()).toString()

    assert.equal(debtAfter, debtBefore)
    assert.equal(activePoolDebtAfter, activePoolDebtBefore)
  })

  it("adjustLoan(): updates borrower's debt and coll with an increase in both", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtBefore, dec(100, 18))
    assert.equal(collBefore, dec(1, 'ether'))

    // Alice adjusts loan. Coll and debt increase(+1 ETH, +50CLV)
    await borrowerOperations.adjustLoan(0, dec(50, 18), true, alice, { from: alice, value: dec(1, 'ether') })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtAfter, dec(150, 18))
    assert.equal(collAfter, dec(2, 'ether'))
  })


  it("adjustLoan(): updates borrower's debt and coll with a decrease in both", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtBefore, dec(100, 18))
    assert.equal(collBefore, dec(1, 'ether'))

    // Alice adjusts loan coll and debt decrease (-0.5 ETH, -50CLV)
    await borrowerOperations.adjustLoan(dec(500, 'finney'), dec(50, 18), false, alice, { from: alice })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtAfter, dec(50, 18))
    assert.equal(collAfter, dec(500, 'finney'))
  })

  it("adjustLoan(): updates borrower's  debt and coll with coll increase, debt decrease", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtBefore, dec(100, 18))
    assert.equal(collBefore, dec(1, 'ether'))

    // Alice adjusts loan - coll increase and debt decrease (+0.5 ETH, -50CLV)
    await borrowerOperations.adjustLoan(0, dec(50, 18), false, alice, { from: alice, value: dec(500, 'finney') })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtAfter, dec(50, 18))
    assert.equal(collAfter, dec(1500, 'finney'))
  })


  it("adjustLoan(): updates borrower's debt and coll with coll decrease, debt increase", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtBefore, dec(100, 18))
    assert.equal(collBefore, dec(1, 'ether'))

    // Alice adjusts loan - coll decrease and debt increase (0.1 ETH, 10CLV)
    await borrowerOperations.adjustLoan('100000000000000000', dec(10, 18), true, alice, { from: alice })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtAfter, dec(110, 18))
    assert.equal(collAfter, '900000000000000000')
  })

  it("adjustLoan(): updates borrower's stake and totalStakes with a coll increase", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })

    const stakeBefore = ((await cdpManager.CDPs(alice))[2]).toString()
    const totalStakesBefore = await cdpManager.totalStakes();

    assert.equal(stakeBefore, dec(1, 'ether'))
    assert.equal(totalStakesBefore, '101000000000000000000')

    // Alice adjusts loan - coll and debt increase (+1 ETH, +50 CLV)
    await borrowerOperations.adjustLoan(0, dec(50, 18), true, alice, { from: alice, value: dec(1, 'ether') })

    const stakeAfter = ((await cdpManager.CDPs(alice))[2]).toString()
    const totalStakesAfter = await cdpManager.totalStakes();

    assert.equal(stakeAfter, dec(2, 'ether'))
    assert.equal(totalStakesAfter, '102000000000000000000')
  })

  it("adjustLoan():  updates borrower's stake and totalStakes with a coll decrease", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })

    const stakeBefore = ((await cdpManager.CDPs(alice))[2]).toString()
    const totalStakesBefore = await cdpManager.totalStakes();

    assert.equal(stakeBefore, dec(1, 'ether'))
    assert.equal(totalStakesBefore, '101000000000000000000')

    // Alice adjusts loan - coll decrease and debt decrease
    await borrowerOperations.adjustLoan(dec(500, 'finney'), dec(50, 18), false, alice, { from: alice })

    const stakeAfter = ((await cdpManager.CDPs(alice))[2]).toString()
    const totalStakesAfter = await cdpManager.totalStakes();

    assert.equal(stakeAfter, '500000000000000000')
    assert.equal(totalStakesAfter, '100500000000000000000')
  })

  it("adjustLoan(): changes CLVToken balance by the requested decrease", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })

    const alice_CLVTokenBalance_Before = (await clvToken.balanceOf(alice)).toString()
    assert.equal(alice_CLVTokenBalance_Before, dec(100, 18))

    // Alice adjusts loan - coll decrease and debt decrease
    await borrowerOperations.adjustLoan(dec(100, 'finney'), dec(10, 18), false, alice, { from: alice })

    // check after
    const alice_CLVTokenBalance_After = (await clvToken.balanceOf(alice)).toString()
    assert.equal(alice_CLVTokenBalance_After, dec(90, 18))
  })

  it("adjustLoan(): changes CLVToken balance by the requested increase", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })

    const alice_CLVTokenBalance_Before = (await clvToken.balanceOf(alice)).toString()
    assert.equal(alice_CLVTokenBalance_Before, dec(100, 18))

    // Alice adjusts loan - coll increase and debt increase
    await borrowerOperations.adjustLoan(0, dec(100, 18), true, alice, { from: alice, value: dec(1, 'ether') })

    // check after
    const alice_CLVTokenBalance_After = (await clvToken.balanceOf(alice)).toString()
    assert.equal(alice_CLVTokenBalance_After, dec(200, 18))
  })

  it("adjustLoan(): Changes the activePool ETH and raw ether balance by the requested decrease", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })

    const activePool_ETH_Before = (await activePool.getETH()).toString()
    const activePool_RawEther_Before = (await web3.eth.getBalance(activePool.address)).toString()
    assert.equal(activePool_ETH_Before, '101000000000000000000')
    assert.equal(activePool_RawEther_Before, '101000000000000000000')

    // Alice adjusts loan - coll decrease and debt decrease
    await borrowerOperations.adjustLoan(dec(100, 'finney'), dec(10, 18), false, alice, { from: alice })

    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, '100900000000000000000')
    assert.equal(activePool_RawEther_After, '100900000000000000000')
  })

  it("adjustLoan(): Changes the activePool ETH and raw ether balance by the amount of ETH sent", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })

    const activePool_ETH_Before = (await activePool.getETH()).toString()
    const activePool_RawEther_Before = (await web3.eth.getBalance(activePool.address)).toString()
    assert.equal(activePool_ETH_Before, '101000000000000000000')
    assert.equal(activePool_RawEther_Before, '101000000000000000000')

    // Alice adjusts loan - coll increase and debt increase
    await borrowerOperations.adjustLoan(0, dec(100, 18), true, alice, { from: alice, value: dec(1, 'ether') })

    const activePool_ETH_After = (await activePool.getETH()).toString()
    const activePool_RawEther_After = (await web3.eth.getBalance(activePool.address)).toString()
    assert.equal(activePool_ETH_After, '102000000000000000000')
    assert.equal(activePool_RawEther_After, '102000000000000000000')
  })

  it("adjustLoan(): Changes the CLV debt in ActivePool by requested decrease", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })

    const activePool_CLVDebt_Before = (await activePool.getCLVDebt()).toString()
    assert.equal(activePool_CLVDebt_Before, dec(100, 18))

    // Alice adjusts loan - coll increase and debt decrease
    await borrowerOperations.adjustLoan(0, dec(50, 18), false, alice, { from: alice, value: dec(1, 'ether') })

    const activePool_CLVDebt_After = (await activePool.getCLVDebt()).toString()
    assert.equal(activePool_CLVDebt_After, dec(50, 18))
  })

  it("adjustLoan():Changes the CLV debt in ActivePool by requested increase", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })

    const activePool_CLVDebt_Before = (await activePool.getCLVDebt()).toString()
    assert.equal(activePool_CLVDebt_Before, dec(100, 18))

    // Alice adjusts loan - coll increase and debt increase
    await borrowerOperations.adjustLoan(0, dec(100, 18), true, alice, { from: alice, value: dec(1, 'ether') })

    const activePool_CLVDebt_After = (await activePool.getCLVDebt()).toString()
    assert.equal(activePool_CLVDebt_After, dec(200, 18))
  })

  it("adjustLoan(): Closes the CDP if  new coll = 0 and new debt = 0", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })

    const status_Before = (await cdpManager.CDPs(alice))[3]
    const isInSortedList_Before = await sortedCDPs.contains(alice)

    assert.equal(status_Before, 1)  // 1: Active
    assert.isTrue(isInSortedList_Before)

    await borrowerOperations.adjustLoan(dec(1, 'ether'), dec(100, 18), false, alice, { from: alice })

    const status_After = (await cdpManager.CDPs(alice))[3]
    const isInSortedList_After = await sortedCDPs.contains(alice)

    assert.equal(status_After, 2) //2: Closed
    assert.isFalse(isInSortedList_After)
  })


  it("adjustLoan():  Deposits the received ether in the trove and ignores requested coll withdrawal if ether is sent", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })

    const aliceColl_Before = (await cdpManager.CDPs(alice))[1].toString()
    assert.equal(aliceColl_Before, dec(1, 'ether'))

    await borrowerOperations.adjustLoan(dec(1, 'ether'), dec(100, 18), true, alice, { from: alice, value: dec(3, 'ether') })

    const aliceColl_After = (await cdpManager.CDPs(alice))[1].toString()
    assert.equal(aliceColl_After, dec(4, 'ether'))
  })

  // --- closeLoan() ---

  it("closeLoan(): reverts when calling address does not have active trove", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })

    // Bob successfully closes his loan
    const txBob = await borrowerOperations.closeLoan({ from: bob })
    assert.isTrue(txBob.receipt.status)

    // Carol with no active trove attempts to close her loan
    try {
      const txCarol = await borrowerOperations.closeLoan({ from: carol })
      assert.fail(txCarol)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("closeLoan(): reverts when system is in Recovery Mode", async () => {
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // check recovery mode 
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Bob successfully closes his loan
    const txBob = await borrowerOperations.closeLoan({ from: bob })
    assert.isTrue(txBob.receipt.status)

    await priceFeed.setPrice(dec(100, 18))

    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Carol attempts to close her loan during Recovery Mode
    try {
      const txCarol = await borrowerOperations.closeLoan({ from: carol })
      assert.fail(txCarol)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("closeLoan(): reverts when trove is the only one in the system", async () => {
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })

    // check recovery mode 
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Alice attempts to close her loan
    try {
      const txCarol = await borrowerOperations.closeLoan({ from: alice })
      assert.fail(txAlice)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "CDPManager: Only one trove in the system")
    }
  })

  it("closeLoan(): reduces a CDP's collateral to zero", async () => {
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(10, 'ether') })
    // await borrowerOperations.withdrawCLV(dec(100, 18), dennis, { from: dennis })

    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.withdrawCLV(dec(100, 18), alice, { from: alice })

    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()
    assert.equal(collBefore, dec(1, 'ether'))

    // Alice attempts to close loan
    await borrowerOperations.closeLoan({ from: alice })

    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()
    assert.equal(collAfter, '0')
    // check withdrawal was successful
  })

  it("closeLoan(): reduces a CDP's debt to zero", async () => {
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(10, 'ether') })

    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.withdrawCLV(dec(100, 18), alice, { from: alice })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    assert.equal(debtBefore, dec(100, 18))

    // Alice attempts to close loan
    await borrowerOperations.closeLoan({ from: alice })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    assert.equal(debtAfter, '0')
    // check withdrawal was successful
  })

  it("closeLoan(): sets CDP's stake to zero", async () => {
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(10, 'ether') })

    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.withdrawCLV(dec(100, 18), alice, { from: alice })

    const stakeBefore = ((await cdpManager.CDPs(alice))[2]).toString()
    assert.equal(stakeBefore, dec(1, 'ether'))

    // Alice attempts to close loan
    await borrowerOperations.closeLoan({ from: alice })

    const stakeAfter = ((await cdpManager.CDPs(alice))[2]).toString()
    assert.equal(stakeAfter, '0')
    // check withdrawal was successful
  })

  it("closeLoan(): zero's the troves reward snapshots", async () => {

    // Dennis opens loan and transfers tokens to alice
    await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: dec(10, 'ether') })
    await clvToken.transfer(alice, dec(100, 18), { from: dennis })

    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Bob
    await cdpManager.liquidate(bob)
    assert.isFalse(await sortedCDPs.contains(bob))

    // Price bounces back
    await priceFeed.setPrice(dec(200, 18))

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops ...again
    await priceFeed.setPrice(dec(100, 18))

    // Get Alice's pending reward snapshots 
    const L_ETH_A_Snapshot = (await cdpManager.rewardSnapshots(alice))[0]
    const L_CLVDebt_A_Snapshot = (await cdpManager.rewardSnapshots(alice))[1]

    assert.isTrue(L_ETH_A_Snapshot.gt(th.toBN('0')))
    assert.isTrue(L_CLVDebt_A_Snapshot.gt(th.toBN('0')))

    // Liquidate Carol
    await cdpManager.liquidate(carol)
    assert.isFalse(await sortedCDPs.contains(carol))

    // Get Alice's pending reward snapshots after Carol's liquidation. Check above 0
    const L_ETH_Snapshot_A_AfterLiquidation = (await cdpManager.rewardSnapshots(alice))[0]
    const L_CLVDebt_Snapshot_A_AfterLiquidation = (await cdpManager.rewardSnapshots(alice))[1]

    assert.isTrue(L_ETH_Snapshot_A_AfterLiquidation.gt(th.toBN('0')))
    assert.isTrue(L_CLVDebt_Snapshot_A_AfterLiquidation.gt(th.toBN('0')))

    // Alice closes loan
    await borrowerOperations.closeLoan({ from: alice })

    // Check Alice's pending reward snapshots are zero
    const L_ETH_Snapshot_A_afterAliceCloses = (await cdpManager.rewardSnapshots(alice))[0]
    const L_CLVDebt_Snapshot_A_afterAliceCloses = (await cdpManager.rewardSnapshots(alice))[1]

    assert.equal(L_ETH_Snapshot_A_afterAliceCloses, '0')
    assert.equal(L_CLVDebt_Snapshot_A_afterAliceCloses, '0')
  })

  it("closeLoan(): closes the CDP", async () => {
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(10, 'ether') })

    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.withdrawCLV(dec(100, 18), alice, { from: alice })

    // Check CDP is active
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const status_Before = alice_CDP_Before[3]

    assert.equal(status_Before, 1)
    assert.isTrue(await sortedCDPs.contains(alice))

    // Close the loan
    await borrowerOperations.closeLoan({ from: alice })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const status_After = alice_CDP_After[3]

    assert.equal(status_After, 2)
    assert.isFalse(await sortedCDPs.contains(alice))
  })

  it("closeLoan(): reduces ActivePool ETH and raw ether by correct amount", async () => {
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(10, 'ether') })

    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.withdrawCLV(dec(100, 18), alice, { from: alice })

    // Check before
    const activePool_ETH_before = await activePool.getETH()
    const activePool_RawEther_before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_before, dec(11, 'ether'))
    assert.equal(activePool_RawEther_before, dec(11, 'ether'))

    // Close the loan
    await borrowerOperations.closeLoan({ from: alice })

    // Check after
    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, dec(10, 'ether'))
    assert.equal(activePool_RawEther_After, dec(10, 'ether'))
  })

  it("closeLoan(): reduces ActivePool debt by correct amount", async () => {
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(10, 'ether') })

    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.withdrawCLV(dec(100, 18), alice, { from: alice })

    // Check before
    const activePool_Debt_before = (await activePool.getETH()).toString()
    assert.equal(activePool_Debt_before, dec(11, 'ether'))

    // Close the loan
    await borrowerOperations.closeLoan({ from: alice })

    // Check after
    const activePool_Debt_After = (await activePool.getCLVDebt()).toString()
    assert.equal(activePool_Debt_After, 0)
  })

  it("closeLoan(): updates the the total stakes", async () => {
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(10, 'ether') })
    //  Alice creates initial CDP with 1 ether
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '1000000000000000000')
    assert.equal(totalStakes_Before, '12000000000000000000')

    // Alice closes loan
    await borrowerOperations.closeLoan({ from: alice })

    // Check stake and total stakes get updated
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_Stake_After = alice_CDP_After[2].toString()
    const totalStakes_After = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, 0)
    assert.equal(totalStakes_After, dec(11, 'ether'))
  })

  it("closeLoan(): sends the correct amount of ETH to the user", async () => {
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })

    const alice_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))
    await borrowerOperations.closeLoan({ from: alice, gasPrice: 0 })

    const alice_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(alice))
    const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

    assert.equal(balanceDiff, dec(1, 'ether'))
  })

  it("closeLoan(): subtracts the debt of the closed CDP from the Borrower's CLVToken balance", async () => {
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(10, 'ether') })

    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.withdrawCLV(dec(100, 18), alice, { from: alice })

    const alice_CLVBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVBalance_Before, dec(100, 18))

    // close loan
    await borrowerOperations.closeLoan({ from: alice })

    //   // check alive CLV balance after

    const alice_CLVBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVBalance_After, 0)
  })

  // --- closeLoan() with a LQTY-eligible deposit ---

  it("closeLoan(): increases the LQTY reward sum G", async () => {
    await th.registerFrontEnds(frontEnds, poolManager)
    // Whale opens trove
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open troves 
    await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(80, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(20, 18), C, { from: C, value: dec(1, 'ether') })

    // A, B, C deposit to Stability Pool
    await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
    await poolManager.provideToSP(dec(80, 18), frontEnd_2, { from: B })
    await poolManager.provideToSP(dec(20, 18), frontEnd_3, { from: C })

    const currentEpoch = await poolManager.currentEpoch()
    const currentScale = await poolManager.currentScale()

    const G_Before = await poolManager.epochToScaleToG(currentEpoch, currentScale)
    console.log(`G_Before: ${G_Before}`)

    console.log(`block.timstamp before ff: ${await th.getLatestBlockTimestamp(web3)}`)
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
    console.log(`block.timstamp after ff: ${await th.getLatestBlockTimestamp(web3)}`)

    // Whale sends A CLV so that he may close his loan
    await clvToken.transfer(A, dec(100, 18), { from: whale })

    // check LQTY balance of communityIssuance:
    console.log(`total supply: ${(await growthToken.balanceOf(communityIssuance.address)).toString()}`)

    await borrowerOperations.closeLoan({ from: A })

    const G_After = await poolManager.epochToScaleToG(currentEpoch, currentScale)

    console.log(`G_After: ${G_After}`)
    // Check LQTY reward sum G has increased

    assert.isTrue(G_After.gt(G_Before))
  })

  it("closeLoan(): with a prior eligible deposit, issues LQTY rewards to trove closer", async () => {
    await th.registerFrontEnds(frontEnds, poolManager)
    // Whale opens trove
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open troves 
    await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(80, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(20, 18), C, { from: C, value: dec(1, 'ether') })

    // A, B, C deposit to Stability Pool
    await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
    await poolManager.provideToSP(dec(80, 18), frontEnd_2, { from: B })
    await poolManager.provideToSP(dec(20, 18), frontEnd_3, { from: C })

    // Check A, B, C deposits are eligible for rewards
    assert.isTrue(await poolManager.isEligibleForLQTY(A))
    assert.isTrue(await poolManager.isEligibleForLQTY(B))
    assert.isTrue(await poolManager.isEligibleForLQTY(C))

    await borrowerOperations.openLoan(dec(50, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Check A's actual LQTY balance == 0
    const A_LQTYBalanceBefore = await growthToken.balanceOf(A)
    assert.equal(A_LQTYBalanceBefore, '0')

    // Whale sends A CLV so that he may close his loan
    await clvToken.transfer(A, dec(100, 18), { from: whale })

    // Close loan
    await borrowerOperations.closeLoan({ from: A })
    assert.isFalse(await sortedCDPs.contains(A))

    // Check LQTY balance has increased
    const A_LQTYBalanceAfter = await growthToken.balanceOf(A)
    assert.isTrue(A_LQTYBalanceAfter.gt(A_LQTYBalanceBefore))
  })

  it("closeLoan(): with a prior eligible deposit, issues LQTY rewards to deposit's front end'", async () => {
    await th.registerFrontEnds(frontEnds, poolManager)
    // Whale opens trove
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open troves 
    await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(80, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(20, 18), C, { from: C, value: dec(1, 'ether') })

    // A, B, C deposit to Stability Pool
    await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
    await poolManager.provideToSP(dec(80, 18), frontEnd_2, { from: B })
    await poolManager.provideToSP(dec(20, 18), frontEnd_3, { from: C })

    await borrowerOperations.openLoan(dec(50, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    assert.isFalse(await cdpManager.checkRecoveryMode())

    await th.fastForwardTime(timeValues, web3.currentProvider)

    // Check A's actual LQTY balance == 0
    const F1_LQTYBalanceBefore = await growthToken.balanceOf(frontEnd_1)
    assert.equal(F1_LQTYBalanceBefore, '0')

    // Whale sends A CLV so that he may close his loan
    await clvToken.transfer(A, dec(100, 18), { from: whale })

    // Close loan
    await borrowerOperations.closeLoan({ from: A })
    assert.isFalse(await sortedCDPs.contains(A))

    // Check LQTY balance == previous pending LQTY rewards
    const F1_LQTYBalanceAfter = await growthToken.balanceOf(frontEnd_1)
    assert.isTrue(F1_LQTYBalanceAfter.eq(F1_LQTYBalanceBefore))
  })

  it("closeLoan(): with a prior eligible deposit, makes deposit ineligible for GT", async () => {
    await th.registerFrontEnds(frontEnds, poolManager)
    // Whale opens trove
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open troves 
    await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(80, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(20, 18), C, { from: C, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(10, 18), D, { from: D, value: dec(1, 'ether') })

    // A, B, C deposit to Stability Pool
    await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
    await poolManager.provideToSP(dec(80, 18), frontEnd_2, { from: B })
    await poolManager.provideToSP(dec(20, 18), frontEnd_3, { from: C })
    await poolManager.provideToSP(dec(10, 18), ZERO_ADDRESS, { from: D })  // D deposits directly, not via front end

    // Check deposits A, B, C, D  are eligible for LQTY rewards
    assert.isTrue(await poolManager.isEligibleForLQTY(A))
    assert.isTrue(await poolManager.isEligibleForLQTY(B))
    assert.isTrue(await poolManager.isEligibleForLQTY(C))
    assert.isTrue(await poolManager.isEligibleForLQTY(D))

    // Whale sends A, B, C, D CLV so that they may close their loan
    await clvToken.transfer(A, dec(100, 18), { from: whale })
    await clvToken.transfer(B, dec(100, 18), { from: whale })
    await clvToken.transfer(C, dec(100, 18), { from: whale })
    await clvToken.transfer(D, dec(100, 18), { from: whale })

    // Close troves A, B, C, D
    await borrowerOperations.closeLoan({ from: A })
    await borrowerOperations.closeLoan({ from: B })
    await borrowerOperations.closeLoan({ from: C })
    await borrowerOperations.closeLoan({ from: D })
    assert.isFalse(await sortedCDPs.contains(A))
    assert.isFalse(await sortedCDPs.contains(B))
    assert.isFalse(await sortedCDPs.contains(C))
    assert.isFalse(await sortedCDPs.contains(D))

    // Check deposits A, B, C, D  are no longer eligible for LQTY rewards
    assert.isFalse(await poolManager.isEligibleForLQTY(A))
    assert.isFalse(await poolManager.isEligibleForLQTY(B))
    assert.isFalse(await poolManager.isEligibleForLQTY(C))
    assert.isFalse(await poolManager.isEligibleForLQTY(D))
  })

  it("closeLoan(): with a prior eligible deposit, de-tag front end from deposit", async () => {
    await th.registerFrontEnds(frontEnds, poolManager)
    // Whale opens trove
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open troves 
    await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(80, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(20, 18), C, { from: C, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(10, 18), D, { from: D, value: dec(1, 'ether') })

    // A, B, C deposit to Stability Pool
    await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
    await poolManager.provideToSP(dec(80, 18), frontEnd_2, { from: B })
    await poolManager.provideToSP(dec(20, 18), frontEnd_3, { from: C })

    // Check deposits A, B, C are tagged correctly
    const A_taggedFrontEnd_Before = await poolManager.getFrontEndTag(A)
    const B_taggedFrontEnd_Before = await poolManager.getFrontEndTag(B)
    const C_taggedFrontEnd_Before = await poolManager.getFrontEndTag(C)

    assert.equal(A_taggedFrontEnd_Before, frontEnd_1)
    assert.equal(B_taggedFrontEnd_Before, frontEnd_2)
    assert.equal(C_taggedFrontEnd_Before, frontEnd_3)

    // Whale sends A, B, C CLV so that they may close their loan
    await clvToken.transfer(A, dec(100, 18), { from: whale })
    await clvToken.transfer(B, dec(100, 18), { from: whale })
    await clvToken.transfer(C, dec(100, 18), { from: whale })

    // Close troves A, B, C
    await borrowerOperations.closeLoan({ from: A })
    await borrowerOperations.closeLoan({ from: B })
    await borrowerOperations.closeLoan({ from: C })
    assert.isFalse(await sortedCDPs.contains(A))
    assert.isFalse(await sortedCDPs.contains(B))
    assert.isFalse(await sortedCDPs.contains(C))

    // Check deposits from A, B, C have had their front end tags removed
    const A_taggedFrontEnd_After = await poolManager.getFrontEndTag(A)
    const B_taggedFrontEnd_After = await poolManager.getFrontEndTag(B)
    const C_taggedFrontEnd_After = await poolManager.getFrontEndTag(C)

    assert.equal(A_taggedFrontEnd_After, th.ZERO_ADDRESS)
    assert.equal(B_taggedFrontEnd_After, th.ZERO_ADDRESS)
    assert.equal(C_taggedFrontEnd_After, th.ZERO_ADDRESS)
  })

  it("closeLoan(): with a prior eligible deposit, issues (ETHGain + collWithdrawal) to closer", async () => {
    await th.registerFrontEnds(frontEnds, poolManager)
    // Whale opens trove
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open troves 
    await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(80, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(20, 18), C, { from: C, value: dec(1, 'ether') })

    // A, B, C deposit to Stability Pool
    await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
    await poolManager.provideToSP(dec(80, 18), frontEnd_2, { from: B })
    await poolManager.provideToSP(dec(20, 18), frontEnd_3, { from: C })

    // Confirm A's deposit is eliglble for LQTY
    assert.isTrue(await poolManager.isEligibleForLQTY(A))

    await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    assert.isFalse(await cdpManager.checkRecoveryMode())

    await th.fastForwardTime(timeValues, web3.currentProvider)

    // Liquidate defaulter 1
    await cdpManager.liquidate(defaulter_1)

    // Get A's deposit's current non-zero ETH gain 
    const A_ETHGain = await poolManager.getDepositorETHGain(A)
    assert.isTrue(A_ETHGain.gt(th.toBN('0')))

    // Get A's trove collateral and ETH balance
    const A_troveCollateral = (await cdpManager.CDPs(A))[1]
    const A_ETHBalanceBefore = th.toBN(await web3.eth.getBalance(A))

    // Whale sends A CLV so that they may close their loan
    await clvToken.transfer(A, dec(100, 18), { from: whale })

    // Close loan A
    await borrowerOperations.closeLoan({ from: A, gasPrice: 0 })
    assert.isFalse(await sortedCDPs.contains(A))

    const A_ETHBalanceAfter = th.toBN(await web3.eth.getBalance(A))
    const A_ETHBalanceDiff = A_ETHBalanceAfter.sub(A_ETHBalanceBefore)

    // Expect A has been sent (ETHGain + troveCollateral) when they closed their loan
    assert.isTrue(A_ETHBalanceDiff.eq(A_troveCollateral.add(A_ETHGain)))
  })

  it("closeLoan(): subtracts the trove closer's eligible deposit from the front end's stake", async () => {
    await th.registerFrontEnds(frontEnds, poolManager)
    // Whale opens trove
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open troves 
    await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(80, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(20, 18), C, { from: C, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(10, 18), D, { from: D, value: dec(1, 'ether') })

    const C_deposit = dec(20, 18)
    const D_deposit = dec(10, 18)
    // A, C deposit to Stability Pool via F1. B, D deposit via F2
    await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
    await poolManager.provideToSP(dec(80, 18), frontEnd_2, { from: B })
    await poolManager.provideToSP(C_deposit, frontEnd_1, { from: C })
    await poolManager.provideToSP(D_deposit, frontEnd_2, { from: D })

    // Check deposits A, B, C are eligible for LQTY rewards
    assert.isTrue(await poolManager.isEligibleForLQTY(A))
    assert.isTrue(await poolManager.isEligibleForLQTY(B))
    assert.isTrue(await poolManager.isEligibleForLQTY(C))
    assert.isTrue(await poolManager.isEligibleForLQTY(D))

    // Get F1 and F2 stakes
    const F1_Stake_Before = await poolManager.getCompoundedFrontEndStake(frontEnd_1)
    const F2_Stake_Before = await poolManager.getCompoundedFrontEndStake(frontEnd_2)

    assert.isTrue(F1_Stake_Before.gt(th.toBN('0')))
    assert.isTrue(F2_Stake_Before.gt(th.toBN('0')))

    // Whale sends C, D CLV so that they may close their loan
    await clvToken.transfer(C, dec(100, 18), { from: whale })
    await clvToken.transfer(D, dec(100, 18), { from: whale })

    // Close trove C, D
    await borrowerOperations.closeLoan({ from: C })
    await borrowerOperations.closeLoan({ from: D })
    assert.isFalse(await sortedCDPs.contains(C))
    assert.isFalse(await sortedCDPs.contains(D))

    // Check deposits C, D are no longer eligible for LQTY rewards
    assert.isFalse(await poolManager.isEligibleForLQTY(C))
    assert.isFalse(await poolManager.isEligibleForLQTY(D))

    // Get F1 and F2 stakes
    const F1_Stake_After = await poolManager.getCompoundedFrontEndStake(frontEnd_1)
    const F2_Stake_After = await poolManager.getCompoundedFrontEndStake(frontEnd_2)

    const F1_Diff = F1_Stake_Before.sub(F1_Stake_After)
    const F2_Diff = F2_Stake_Before.sub(F2_Stake_After)

    // Check F1 has reduced by amount equal to C's deposit, and F2 has reduced by amount equal to D's deposit
    console.log(`F1_Stake_Before  ${F1_Stake_Before}`)
    console.log(`F1_Stake_After  ${F1_Stake_After}`)
    console.log(`F1_Diff  ${F1_Diff}`)
    console.log(`C_deposit  ${C_deposit}`)

    console.log(`F2_Stake_Before  ${F2_Stake_Before}`)
    console.log(`F2_Stake_After  ${F2_Stake_After}`)
    console.log(`F2_Diff  ${F2_Diff}`)
    console.log(`D_deposit  ${D_deposit}`)

    assert.equal(F1_Diff, C_deposit)
    assert.equal(F2_Diff, D_deposit)
  })

  // --- closeLoan() with LQTY-ineligible deposit ---

  it("closeLoan(): with a prior ineligible deposit, issues only the collWithdrawal to closer", async () => {
    await th.registerFrontEnds(frontEnds, poolManager)
    // Whale opens trove
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

    // Whale transfers CLV to A 
    await clvToken.transfer(A, dec(50, 18), { from: whale })

    // A, deposits to Stability Pool
    await poolManager.provideToSP(dec(50, 18), frontEnd_1, { from: A })

    // Confirm A's deposit is ineliglble for LQTY
    assert.isFalse(await poolManager.isEligibleForLQTY(A))

    // C opens trove and makes SP deposit
    await borrowerOperations.openLoan(dec(20, 18), C, { from: C, value: dec(1, 'ether') })
    await poolManager.provideToSP(dec(20, 18), frontEnd_3, { from: C })

    await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate defaulter 1
    await cdpManager.liquidate(defaulter_1)

    // Get A's deposit's current non-zero ETH gain 
    const A_ETHGain_Before = await poolManager.getDepositorETHGain(A)
    assert.isTrue(A_ETHGain_Before.gt(th.toBN('0')))

    // A opens trove
    await borrowerOperations.openLoan(dec(20, 18), A, { from: A, value: dec(1, 'ether') })
    // Get A's trove collateral and ETH balance
    const A_troveCollateral = (await cdpManager.CDPs(A))[1]
    const A_ETHBalanceBefore = th.toBN(await web3.eth.getBalance(A))
    assert.isFalse(await poolManager.isEligibleForLQTY(A))

    // A then closes loan
    await borrowerOperations.closeLoan({ from: A, gasPrice: 0 })
    assert.isFalse(await sortedCDPs.contains(A))

    const A_ETHBalanceAfter = th.toBN(await web3.eth.getBalance(A))
    const A_ETHBalanceDiff = A_ETHBalanceAfter.sub(A_ETHBalanceBefore)

    // Expect A has been sent troveCollateral when they closed their loan
    assert.isTrue(A_ETHBalanceDiff.eq(A_troveCollateral))

    // Check A's deposit's ETH gain has not changed
    const A_ETHGain_After = await poolManager.getDepositorETHGain(A)
    assert.isTrue(A_ETHGain_After.eq(A_ETHGain_Before))
  })

  it("closeLoan(): deposit that has become ineligible for LQTY earns no further LQTY rewards", async () => {
    await th.registerFrontEnds(frontEnds, poolManager)
    // Whale opens trove
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open troves 
    await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(80, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(20, 18), C, { from: C, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(10, 18), D, { from: D, value: dec(1, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

    // A, B, C deposit to Stability Pool
    await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
    await poolManager.provideToSP(dec(80, 18), frontEnd_2, { from: B })
    await poolManager.provideToSP(dec(20, 18), frontEnd_3, { from: C })

    // Check deposits A, B, C are eligible for LQTY rewards
    assert.isTrue(await poolManager.isEligibleForLQTY(A))
    assert.isTrue(await poolManager.isEligibleForLQTY(B))
    assert.isTrue(await poolManager.isEligibleForLQTY(C))

    // Whale sends A CLV so that they may close their loan
    await clvToken.transfer(A, dec(100, 18), { from: whale })

    // Close trove A
    await borrowerOperations.closeLoan({ from: A })
    assert.isFalse(await sortedCDPs.contains(A))

    // Check deposits A is no longer eligible for LQTY rewards
    assert.isFalse(await poolManager.isEligibleForLQTY(A))

    // Check deposits B and C are still eligible
    assert.isTrue(await poolManager.isEligibleForLQTY(B))
    assert.isTrue(await poolManager.isEligibleForLQTY(C))

    // Get current LQTY gains
    const A_LQTYGain_Before = await poolManager.getDepositorLQTYGain(A)
    const B_LQTYGain_Before = await poolManager.getDepositorLQTYGain(B)
    const C_LQTYGain_Before = await poolManager.getDepositorLQTYGain(C)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // D provides 1 CLV to the SP, which brings LQTY gains for all depositors up to date
    await poolManager.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: D })

    // Get current LQTY gains after time has passed
    const A_LQTYGain_After = await poolManager.getDepositorLQTYGain(A)
    const B_LQTYGain_After = await poolManager.getDepositorLQTYGain(B)
    const C_LQTYGain_After = await poolManager.getDepositorLQTYGain(C)

    console.log(`A_LQTYGain_Before: ${A_LQTYGain_Before}`)
    console.log(`A_LQTYGain_After: ${A_LQTYGain_After}`)
    // Check A's LQTY gain has not increased
    assert.isTrue(A_LQTYGain_After.eq(A_LQTYGain_Before))

    // Check B and C's LQTY gain has increased
    assert.isTrue(B_LQTYGain_After.gt(B_LQTYGain_Before))
    assert.isTrue(C_LQTYGain_After.gt(C_LQTYGain_Before))
  })

  it("closeLoan(): with a prior ineligible deposit, doesn't alter a front end's stake", async () => {
    await th.registerFrontEnds(frontEnds, poolManager)
    // Whale opens trove
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

    // A and B open troves and make SP deposits via F1 and F2 respectively
    await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), B, { from: B, value: dec(1, 'ether') })
    await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
    await poolManager.provideToSP(dec(50, 18), frontEnd_2, { from: B })

    // Whale sends tokens to C and D
    await clvToken.transfer(C, dec(100, 18), { from: whale })
    await clvToken.transfer(D, dec(80, 18), { from: whale })

    // C and D make SP deposits via F1 and F2 respectively
    await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: C })
    await poolManager.provideToSP(dec(80, 18), frontEnd_2, { from: D })

    // C and D open loans 
    await borrowerOperations.openLoan(dec(30, 18), C, { from: C, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), C, { from: D, value: dec(1, 'ether') })

    // Check deposits C, D are ineligible for LQTY rewards
    assert.isFalse(await poolManager.isEligibleForLQTY(C))
    assert.isFalse(await poolManager.isEligibleForLQTY(D))

    // Get stakes for F1 an F2
    const F1_Stake_Before = await poolManager.getCompoundedFrontEndStake(frontEnd_1)
    const F2_Stake_Before = await poolManager.getCompoundedFrontEndStake(frontEnd_2)

    assert.isTrue(F1_Stake_Before.gt(th.toBN('0')))
    assert.isTrue(F2_Stake_Before.gt(th.toBN('0')))

    // Whale sends CLV so that they may close their loan
    await clvToken.transfer(C, dec(100, 18), { from: whale })
    await clvToken.transfer(D, dec(100, 18), { from: whale })

    // Close trove C, D
    await borrowerOperations.closeLoan({ from: C })
    await borrowerOperations.closeLoan({ from: D })
    assert.isFalse(await sortedCDPs.contains(C))
    assert.isFalse(await sortedCDPs.contains(D))

    // Get stakes for F1 and F2
    const F1_Stake_After = await poolManager.getCompoundedFrontEndStake(frontEnd_1)
    const F2_Stake_After = await poolManager.getCompoundedFrontEndStake(frontEnd_2)

    // Check front end stakes have not changed
    assert.isTrue(F1_Stake_After.gt(th.toBN('0')))
    assert.isTrue(F2_Stake_After.gt(th.toBN('0')))
  })

  it("closeLoan(): front end that has “lost” a deposit earns no further LQTY gains from that deposit", async () => {
    await th.registerFrontEnds(frontEnds, poolManager)
    // Whale opens trove
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open troves 
    await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(80, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(20, 18), C, { from: C, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(10, 18), D, { from: D, value: dec(1, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

    // A, B, C deposit to Stability Pool
    await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
    await poolManager.provideToSP(dec(80, 18), frontEnd_2, { from: B })
    await poolManager.provideToSP(dec(20, 18), frontEnd_3, { from: C })

    // Check deposits A, B, C are eligible for LQTY rewards
    assert.isTrue(await poolManager.isEligibleForLQTY(A))
    assert.isTrue(await poolManager.isEligibleForLQTY(B))
    assert.isTrue(await poolManager.isEligibleForLQTY(C))

    // Whale sends CLV so that they may close their loan
    await clvToken.transfer(A, dec(100, 18), { from: whale })

    // Close trove A
    await borrowerOperations.closeLoan({ from: A })
    assert.isFalse(await sortedCDPs.contains(A))

    // Check deposits A is no longer eligible for LQTY rewards
    assert.isFalse(await poolManager.isEligibleForLQTY(A))

    // Check frontEnd 1's stake is now 0
    const F1_Stake = await poolManager.frontEndStakes(frontEnd_1)
    assert.equal(F1_Stake, '0')

    // Check F2 and F3 stakes are > 0
    const F2_Stake = await poolManager.frontEndStakes(frontEnd_2)
    const F3_Stake = await poolManager.frontEndStakes(frontEnd_3)
    assert.isTrue(F2_Stake.gt(th.toBN('0')))
    assert.isTrue(F3_Stake.gt(th.toBN('0')))

    // Check deposits B and C are still eligible
    assert.isTrue(await poolManager.isEligibleForLQTY(B))
    assert.isTrue(await poolManager.isEligibleForLQTY(C))

    // Get current LQTY gains for front ends
    const F1_LQTYGain_Before = await poolManager.getFrontEndLQTYGain(frontEnd_1)
    const F2_LQTYGain_Before = await poolManager.getFrontEndLQTYGain(frontEnd_2)
    const F3_LQTYGain_Before = await poolManager.getDepositorLQTYGain(frontEnd_3)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // D provides 1 CLV to the SP, which brings earned LQTY gains for all stakers up to date
    await poolManager.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: D })

    // Get current LQTY gains after time has passed
    const F1_LQTYGain_After = await poolManager.getFrontEndLQTYGain(frontEnd_1)
    const F2_LQTYGain_After = await poolManager.getFrontEndLQTYGain(frontEnd_2)
    const F3_LQTYGain_After = await poolManager.getFrontEndLQTYGain(frontEnd_3)

    // Check F1's LQTY gain has not increased
    assert.isTrue(F1_LQTYGain_After.eq(F1_LQTYGain_Before))

    console.log( `F1_LQTYGain_Before: ${F1_LQTYGain_Before}`   )
    console.log( `F2_LQTYGain_Before: ${F2_LQTYGain_Before}`   )
    console.log( `F3_LQTYGain_Before: ${F3_LQTYGain_Before}`   )
    console.log( `F1_LQTYGain_After: ${F1_LQTYGain_After}`   )
    console.log( `F2_LQTYGain_After: ${F2_LQTYGain_After}`   )
    console.log( `F3_LQTYGain_After: ${F3_LQTYGain_After}`   )
   
    // Check B and C's LQTY gain has increased
    assert.isTrue(F2_LQTYGain_After.gt(F2_LQTYGain_Before))
    assert.isTrue(F3_LQTYGain_After.gt(F3_LQTYGain_Before))
  })

  it("closeLoan(): deposit that has become ineligible for LQTY continues earning ETH gains", async () => {
    await th.registerFrontEnds(frontEnds, poolManager)
    // Whale opens trove
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open troves 
    await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(80, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), defaulter_2, { from: defaulter_2, value: dec(1, 'ether') })

    // A, B, C deposit to Stability Pool
    await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
    await poolManager.provideToSP(dec(80, 18), frontEnd_2, { from: B })
    await poolManager.provideToSP(dec(50, 18), frontEnd_3, { from: C })

    // Check deposits A, B, C are eligible for LQTY rewards
    assert.isTrue(await poolManager.isEligibleForLQTY(A))
    assert.isTrue(await poolManager.isEligibleForLQTY(B))
    assert.isTrue(await poolManager.isEligibleForLQTY(C))

    await priceFeed.setPrice(dec(100, 18))
    assert.isFalse(await cdpManager.checkRecoveryMode())

    await cdpManager.liquidate(defaulter_1)

    // Get all ETH gains and check they're non-zero
    const A_ETHGain_Before = await poolManager.getDepositorETHGain(A)
    const B_ETHGain_Before = await poolManager.getDepositorETHGain(B)
    const C_ETHGain_Before = await poolManager.getDepositorETHGain(C)

    assert.isTrue(A_ETHGain_Before.gt(th.toBN('0')))
    assert.isTrue(B_ETHGain_Before.gt(th.toBN('0')))
    assert.isTrue(C_ETHGain_Before.gt(th.toBN('0')))

    // Whale sends CLV so that they may close their loan
    await clvToken.transfer(A, dec(100, 18), { from: whale })

    // Close trove A
    await borrowerOperations.closeLoan({ from: A })
    assert.isFalse(await sortedCDPs.contains(A))

    // Check deposits A is no longer eligible for LQTY rewards
    assert.isFalse(await poolManager.isEligibleForLQTY(A))

    // Check deposits B and C are still eligible for LQTY
    assert.isTrue(await poolManager.isEligibleForLQTY(B))
    assert.isTrue(await poolManager.isEligibleForLQTY(C))

    // 2nd liquidation
    await cdpManager.liquidate(defaulter_2)

    // Get current ETH gains
    const A_ETHGain_After = await poolManager.getDepositorETHGain(A)
    const B_ETHGain_After = await poolManager.getDepositorETHGain(B)
    const C_ETHGain_After = await poolManager.getDepositorETHGain(C)

    // Check  all ETH gains have increased 
    assert.isTrue(A_ETHGain_After.gt(A_ETHGain_Before))
    assert.isTrue(B_ETHGain_After.gt(B_ETHGain_Before))
    assert.isTrue(C_ETHGain_After.gt(C_ETHGain_Before))
  })

  it("closeLoan(): applies pending rewards", async () => {
    // --- SETUP ---
    // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(15, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(5, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: dec(1, 'ether') })

    // Alice and Bob withdraw 100CLV, Carol withdraws 180CLV
    const CLVwithdrawal_A = await th.getActualDebtFromComposite(dec(100, 18), contracts)
    const CLVwithdrawal_B = await th.getActualDebtFromComposite(dec(100, 18), contracts)
    const CLVwithdrawal_C = await th.getActualDebtFromComposite(dec(180, 18), contracts)
    await borrowerOperations.withdrawCLV(CLVwithdrawal_A, alice, { from: alice })
    await borrowerOperations.withdrawCLV(CLVwithdrawal_B, bob, { from: bob })
    await borrowerOperations.withdrawCLV(CLVwithdrawal_C, carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');
    const price = await priceFeed.getPrice()

    // close Carol's CDP, liquidating her 1 ether and 180CLV. Alice and Bob earn rewards.
    const liquidationTx = await cdpManager.liquidate(carol, { from: owner });
    const [liquidatedDebt_C, liquidatedColl_C, gasComp_C] = th.getEmittedLiquidationValues(liquidationTx)
    // Dennis opens a new CDP with 10 Ether, withdraws CLV and sends 135 CLV to Alice, and 45 CLV to Bob.

    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(100, 'ether') })
    const CLVwithdrawal_D = await await th.getActualDebtFromComposite(dec(200, 18), contracts)
    await borrowerOperations.withdrawCLV(CLVwithdrawal_D, dennis, { from: dennis })
    await clvToken.transfer(alice, '135000000000000000000', { from: dennis })
    await clvToken.transfer(bob, '45000000000000000000', { from: dennis })

    // check Alice and Bob's reward snapshots are zero before they alter their CDPs
    alice_rewardSnapshot_Before = await cdpManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
    const alice_CLVDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

    const bob_rewardSnapshot_Before = await cdpManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
    const bob_CLVDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

    assert.equal(alice_ETHrewardSnapshot_Before, 0)
    assert.equal(alice_CLVDebtRewardSnapshot_Before, 0)
    assert.equal(bob_ETHrewardSnapshot_Before, 0)
    assert.equal(bob_CLVDebtRewardSnapshot_Before, 0)

    const L_ETH = await cdpManager.L_ETH()
    const L_CLVDebt = await cdpManager.L_CLVDebt()

    const defaultPool_ETH = await defaultPool.getETH()
    const defaultPool_CLVDebt = await defaultPool.getCLVDebt()

    // Carol's liquidated coll (1 ETH) and drawn debt should have entered the Default Pool
    assert.isAtMost(th.getDifference(defaultPool_ETH, liquidatedColl_C), 100)
    assert.isAtMost(th.getDifference(defaultPool_CLVDebt, liquidatedDebt_C), 100)

    // Close Alice's loan. Alice's pending rewards should be removed from the DefaultPool when she close.
    await borrowerOperations.closeLoan({ from: alice })

    const expectedCollReward_A = liquidatedColl_C.mul(th.toBN(dec(15, 'ether'))).div(th.toBN(dec(20, 'ether')))
    const expectedDebtReward_A = liquidatedDebt_C.mul(th.toBN(dec(15, 'ether'))).div(th.toBN(dec(20, 'ether')))

    const defaultPool_ETH_afterAliceCloses = await defaultPool.getETH()
    const defaultPool_CLVDebt_afterAliceCloses = await defaultPool.getCLVDebt()

    assert.isAtMost(th.getDifference(defaultPool_ETH_afterAliceCloses,
      defaultPool_ETH.sub(expectedCollReward_A)), 100)
    assert.isAtMost(th.getDifference(defaultPool_CLVDebt_afterAliceCloses,
      defaultPool_CLVDebt.sub(expectedDebtReward_A)), 100)

    // Close Bob's loan. Expect DefaultPool coll and debt to drop to 0, since closing pulls his rewards out.
    await borrowerOperations.closeLoan({ from: bob })

    const defaultPool_ETH_afterBobCloses = await defaultPool.getETH()
    const defaultPool_CLVDebt_afterBobCloses = await defaultPool.getCLVDebt()

    assert.isAtMost(th.getDifference(defaultPool_ETH_afterBobCloses, 0), 100)
    assert.isAtMost(th.getDifference(defaultPool_CLVDebt_afterBobCloses, 0), 100)
  })

  // --- openLoan() ---
  it("openLoan(): decays a non-zero base rate", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D opens loan 
    await borrowerOperations.openLoan(dec(37, 18), D, { from: D, value: dec(5, 'ether') })

    // Check baseRate has decreased
    const baseRate_2 = await cdpManager.baseRate()
    assert.isTrue(baseRate_2.lt(baseRate_1))

    // 1 hour passes
    th.fastForwardTime(3600, web3.currentProvider)

    // E opens loan 
    await borrowerOperations.openLoan(dec(12, 18), E, { from: E, value: dec(3, 'ether') })

    const baseRate_3 = await cdpManager.baseRate()
    assert.isTrue(baseRate_3.lt(baseRate_2))
  })

  it("openLoan(): doesn't change a non-zero base rate if user issues no debt", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D opens loan with 0 debt
    await borrowerOperations.openLoan(0, D, { from: D, value: dec(5, 'ether') })

    // Check baseRate has not changed
    const baseRate_2 = await cdpManager.baseRate()
    assert.isTrue(baseRate_2.eq(baseRate_1))
  })

  it("openLoan(): doesn't change base rate if it is already zero", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D opens loan 
    await borrowerOperations.openLoan(dec(37, 18), D, { from: D, value: dec(5, 'ether') })

    // Check baseRate is still 0
    const baseRate_2 = await cdpManager.baseRate()
    assert.equal(baseRate_2, '0')

    // 1 hour passes
    th.fastForwardTime(3600, web3.currentProvider)

    // E opens loan 
    await borrowerOperations.openLoan(dec(12, 18), E, { from: E, value: dec(3, 'ether') })

    const baseRate_3 = await cdpManager.baseRate()
    assert.equal(baseRate_3, '0')
  })

  it("openLoan(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    const lastFeeOpTime_1 = await cdpManager.lastFeeOperationTime()

    // 59 minutes pass
    th.fastForwardTime(3540, web3.currentProvider)

    // Borrower D triggers a fee
    await borrowerOperations.openLoan(dec(1, 18), D, { from: D, value: dec(1, 'ether') })

    const lastFeeOpTime_2 = await cdpManager.lastFeeOperationTime()

    // Check that the last fee operation time did not update, as borrower D's debt issuance occured
    // since before minimum interval had passed 
    assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

    // 1 minute passes
    th.fastForwardTime(60, web3.currentProvider)

    // Check that now, at least one hour has passed since lastFeeOpTime_1
    const timeNow = await th.getLatestBlockTimestamp(web3)
    assert.isTrue(th.toBN(timeNow).sub(lastFeeOpTime_1).gte(3600))

    // Borrower E triggers a fee
    await borrowerOperations.openLoan(dec(1, 18), E, { from: E, value: dec(1, 'ether') })

    const lastFeeOpTime_3 = await cdpManager.lastFeeOperationTime()

    // Check that the last fee operation time DID update, as borrower's debt issuance occured
    // after minimum interval had passed 
    assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
  })


  it("openLoan(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    // 59 minutes pass
    th.fastForwardTime(3540, web3.currentProvider)

    // Assume Borrower also owns accounts D and E
    // Borrower triggers a fee, before decay interval has passed
    await borrowerOperations.openLoan(dec(1, 18), D, { from: D, value: dec(1, 'ether') })

    // 1 minute pass
    th.fastForwardTime(3540, web3.currentProvider)

    // Borrower triggers another fee
    await borrowerOperations.openLoan(dec(1, 18), E, { from: E, value: dec(1, 'ether') })

    // Check base rate has decreased even though Borrower tried to stop it decaying
    const baseRate_2 = await cdpManager.baseRate()
    assert.isTrue(baseRate_2.lt(baseRate_1))
  })

  it("openLoan(): borrowing at non-zero base rate sends CLV fee to GT staking contract", async () => {
    // time fast-forwards 1 year, and owner stakes 1 GT
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(gtStaking.address, dec(1, 18), { from: owner })
    await gtStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check GT CLV balance before == 0
    const gtStaking_CLVBalance_Before = await clvToken.balanceOf(gtStaking.address)
    assert.equal(gtStaking_CLVBalance_Before, '0')

    // D opens loan 
    await borrowerOperations.openLoan(dec(37, 18), D, { from: D, value: dec(5, 'ether') })

    // Check GT CLV balance after has increased
    const gtStaking_CLVBalance_After = await clvToken.balanceOf(gtStaking.address)
    assert.isTrue(gtStaking_CLVBalance_After.gt(gtStaking_CLVBalance_Before))
  })

  it("openLoan(): Borrowing at non-zero base rate increases the GT staking contract CLV fees-per-unit-staked", async () => {
    // time fast-forwards 1 year, and owner stakes 1 GT
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(gtStaking.address, dec(1, 18), { from: owner })
    await gtStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check GT contract CLV fees-per-unit-staked is zero
    const F_LUSD_Before = await gtStaking.F_LUSD()
    assert.equal(F_LUSD_Before, '0')

    // D opens loan 
    await borrowerOperations.openLoan(dec(37, 18), D, { from: D, value: dec(5, 'ether') })

    // Check GT contract CLV fees-per-unit-staked has increased
    const F_LUSD_After = await gtStaking.F_LUSD()
    assert.isTrue(F_LUSD_After.gt(F_LUSD_Before))
  })

  it("openLoan(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
    // time fast-forwards 1 year, and owner stakes 1 GT
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(gtStaking.address, dec(1, 18), { from: owner })
    await gtStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check GT Staking contract balance before == 0
    const gtStaking_CLVBalance_Before = await clvToken.balanceOf(gtStaking.address)
    assert.equal(gtStaking_CLVBalance_Before, '0')

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(th.toBN('0')))

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D opens loan 
    const CLVRequest_D = th.toBN(dec(40, 18))
    await borrowerOperations.openLoan(CLVRequest_D, D, { from: D, value: dec(5, 'ether') })

    // Check GT staking CLV balance has increased
    const gtStaking_CLVBalance_After = await clvToken.balanceOf(gtStaking.address)
    assert.isTrue(gtStaking_CLVBalance_After.gt(gtStaking_CLVBalance_Before))

    // Check D's CLV balance now equals their requested CLV
    const CLVBalance_D = await clvToken.balanceOf(D)
    assert.isTrue(CLVRequest_D.eq(CLVBalance_D))
  })

  it("openLoan(): Borrowing at zero base rate does not change CLV balance of GT staking contract", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check GT CLV balance before == 0
    const gtStaking_CLVBalance_Before = await clvToken.balanceOf(gtStaking.address)
    assert.equal(gtStaking_CLVBalance_Before, '0')

    // D opens loan 
    await borrowerOperations.openLoan(dec(37, 18), D, { from: D, value: dec(5, 'ether') })

    // Check GT CLV balance after == 0
    const gtStaking_CLVBalance_After = await clvToken.balanceOf(gtStaking.address)
    assert.equal(gtStaking_CLVBalance_After, '0')
  })

  it("openLoan(): Borrowing at zero base rate does not change GT staking contract CLV fees-per-unit-staked", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // Check GT CLV balance before == 0
    const F_LUSD_Before = await gtStaking.F_LUSD()
    assert.equal(F_LUSD_Before, '0')

    // D opens loan 
    await borrowerOperations.openLoan(dec(37, 18), D, { from: D, value: dec(5, 'ether') })

    // Check GT CLV balance after == 0
    const F_LUSD_After = await gtStaking.F_LUSD()
    assert.equal(F_LUSD_After, '0')
  })

  it("openLoan(): Borrowing at zero base rate sends total requested CLV to the user", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate is zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.equal(baseRate_1, '0')

    // 2 hours pass
    th.fastForwardTime(7200, web3.currentProvider)

    // D opens loan 
    const CLVRequest_D = th.toBN(dec(40, 18))
    await borrowerOperations.openLoan(CLVRequest_D, D, { from: D, value: dec(5, 'ether') })

    // Check D's CLV balance now equals their requested CLV
    const CLVBalance_D = await clvToken.balanceOf(D)

    assert.isTrue(CLVRequest_D.eq(CLVBalance_D))
  })


  it("openLoan(): reverts when system is in Recovery Mode", async () => {

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })

    assert.isFalse(await cdpManager.checkRecoveryMode())

    // price drops, and recovery mode kicks in
    await priceFeed.setPrice(dec(100, 18))

    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Bob tries to open a loan with same coll and debt, during Recovery Mode
    try {
      const txBob = await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("openLoan(): reverts when loan ICR < MCR", async () => {
    const txAlice = await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    const price = await priceFeed.getPrice()
    const aliceICR = await cdpManager.getCurrentICR(alice, price)

    assert.isTrue(txAlice.receipt.status)
    assert.isTrue(aliceICR.gte(web3.utils.toBN('110000000000000000')))

    // Bob attempts to open a loan with coll = 1 ETH, debt = 182 CLV. At ETH:USD price = 200, his ICR = 1 * 200 / 182 =   109.8%.
    try {
      const txBob = await borrowerOperations.openLoan('182000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("openLoan(): reverts when opening the loan causes the TCR of the system to fall below the CCR", async () => {
    await priceFeed.setPrice(dec(100, 18))

    // Alice creates trove with 3 ETH / 200 CLV, and 150% ICR.  System TCR = 150%.
    const txAlice = await borrowerOperations.openLoan(dec(200, 18), alice, { from: alice, value: dec(3, 'ether') })
    const price = await priceFeed.getPrice()

    const TCR = await cdpManager.getTCR()
    assert.equal(TCR, '1500000000000000000')

    // Bob attempts to open a loan with coll = 1 ETH, actual debt = 201 CLV. At ETH:USD price = 1, his ICR = 300 / 201 =   149.25%`

    // System TCR would be: ((3+3) * 100 ) / (200+201) = 600/401 = 149.62%, i.e. below CCR of 150%.
    try {
      const txBob = await borrowerOperations.openLoan('201000000000000000000', bob, { from: bob, value: dec(3, 'ether') })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("openLoan(): reverts if withdrawal would pull TCR below CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(3, 'ether') })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    const TCR = (await cdpManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // Carol attempts to open a loan, which would reduce TCR to below 150%
    try {
      const txData = await borrowerOperations.openLoan('180000000000000000000', carol, { from: carol, value: dec(1, 'ether') })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("openLoan(): with non-zero debt, reverts when system is in recovery mode", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(3, 'ether') })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    const TCR = (await cdpManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // price drops to 1ETH:150CLV, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000');

    try {
      const txData = await borrowerOperations.openLoan('50000000000000000000', carol, { from: carol, value: dec(1, 'ether') })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("openLoan(): reverts if trove is already active", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(10, 'ether') })

    await borrowerOperations.openLoan(dec(50, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), bob, { from: bob, value: dec(1, 'ether') })

    try {
      const txB_1 = await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
      assert.isFalse(txB_1.receipt.status)
    } catch (err) {
      assert.include(err.message, 'revert')
    }

    try {
      const txB_2 = await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })
      assert.isFalse(txB_2.receipt.status)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("openLoan(): Can open a loan with zero debt when system is in recovery mode", async () => {
    // --- SETUP ---
    //  Alice and Bob add coll and withdraw such  that the TCR is ~150%
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(3, 'ether') })
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    const TCR = (await cdpManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000');

    assert.isTrue(await cdpManager.checkRecoveryMode())

    const txCarol = await borrowerOperations.openLoan('0', carol, { from: carol, value: dec(1, 'ether') })
    assert.isTrue(txCarol.receipt.status)

    assert.isTrue(await cdpManager.checkRecoveryMode())

    assert.isTrue(await sortedCDPs.contains(carol))

    const carol_CDPStatus = await cdpManager.getCDPStatus(carol)
    assert.equal(carol_CDPStatus, 1)
  })

  it("openLoan(): creates a new CDP and assigns the correct collateral and debt amount", async () => {
    const alice_CDP_Before = await cdpManager.CDPs(alice)

    const debt_Before = alice_CDP_Before[0]
    const coll_Before = alice_CDP_Before[1]
    const status_Before = alice_CDP_Before[3]

    // check coll and debt before
    assert.equal(debt_Before, 0)
    assert.equal(coll_Before, 0)

    // check non-existent status
    assert.equal(status_Before, 0)

    await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: dec(1, 'ether') })

    const alice_CDP_After = await cdpManager.CDPs(alice)

    const debt_After = alice_CDP_After[0].toString()
    const coll_After = alice_CDP_After[1]
    const status_After = alice_CDP_After[3]

    // check coll and debt after
    assert.equal(debt_After, '50000000000000000000')
    assert.equal(coll_After, dec(1, 'ether'))

    // check active status
    assert.equal(status_After, 1)
  })

  it("openLoan(): adds CDP owner to CDPOwners array", async () => {
    const CDPOwnersCount_Before = (await cdpManager.getCDPOwnersCount()).toString();
    assert.equal(CDPOwnersCount_Before, '0')

    await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: dec(1, 'ether') })

    const CDPOwnersCount_After = (await cdpManager.getCDPOwnersCount()).toString();
    assert.equal(CDPOwnersCount_After, '1')
  })

  it("openLoan(): creates a stake and adds it to total stakes", async () => {
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '0')
    assert.equal(totalStakes_Before, '0')

    await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: dec(1, 'ether') })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_Stake_After = alice_CDP_After[2].toString()
    const totalStakes_After = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, '1000000000000000000')
    assert.equal(totalStakes_After, '1000000000000000000')
  })

  it("openLoan(): inserts CDP to Sorted CDPs list", async () => {
    // check before
    const aliceCDPInList_Before = await sortedCDPs.contains(alice)
    const listIsEmpty_Before = await sortedCDPs.isEmpty()
    assert.equal(aliceCDPInList_Before, false)
    assert.equal(listIsEmpty_Before, true)

    await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: dec(1, 'ether') })

    // check after
    const aliceCDPInList_After = await sortedCDPs.contains(alice)
    const listIsEmpty_After = await sortedCDPs.isEmpty()
    assert.equal(aliceCDPInList_After, true)
    assert.equal(listIsEmpty_After, false)
  })

  it("openLoan(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
    const activePool_ETH_Before = await activePool.getETH()
    const activePool_RawEther_Before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_Before, 0)
    assert.equal(activePool_RawEther_Before, 0)

    await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: dec(1, 'ether') })

    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, dec(1, 'ether'))
    assert.equal(activePool_RawEther_After, dec(1, 'ether'))
  })

  it("openLoan(): records up-to-date initial snapshots of L_ETH and L_CLVDebt", async () => {
    // --- SETUP ---
    /* Alice adds 10 ether
    Carol adds 1 ether */
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: dec(1, 'ether') })

    // Alice withdraws 100CLV, Carol withdraws 180CLV
    const A_CLVWithdrawal = await th.getActualDebtFromComposite(dec(100, 18), contracts)
    const C_CLVWithdrawal = await th.getActualDebtFromComposite(dec(180, 18), contracts)
    await borrowerOperations.withdrawCLV(A_CLVWithdrawal, alice, { from: alice })
    await borrowerOperations.withdrawCLV(C_CLVWithdrawal, carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice(dec(100, 18));

    // close Carol's CDP, liquidating her 1 ether and 180CLV.
    const liquidationTx = await cdpManager.liquidate(carol, { from: owner });
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

    /* with total stakes = 10 ether, after liquidation, L_ETH should equal 1/10 ether per-ether-staked,
     and L_CLV should equal 18 CLV per-ether-staked. */

    const L_ETH = await cdpManager.L_ETH()
    const L_CLV = await cdpManager.L_CLVDebt()

    assert.isAtMost(th.getDifference(L_ETH, liquidatedColl.div(th.toBN('10'))), 100)
    assert.isAtMost(th.getDifference(L_CLV, liquidatedDebt.div(th.toBN('10'))), 100)

    // Bob opens loan
    await borrowerOperations.openLoan('50000000000000000000', bob, { from: bob, value: dec(1, 'ether') })

    // check Bob's snapshots of L_ETH and L_CLV equal the respective current values
    const bob_rewardSnapshot = await cdpManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot = bob_rewardSnapshot[0]
    const bob_CLVDebtRewardSnapshot = bob_rewardSnapshot[1]

    assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot, L_ETH), 100)
    assert.isAtMost(th.getDifference(bob_CLVDebtRewardSnapshot, L_CLV), 100)
  })

  it("openLoan(): allows a user to open a CDP, then close it, then re-open it", async () => {
    // Open CDPs
    await borrowerOperations.openLoan('0', whale, { from: whale, value: dec(100, 'ether') })
    await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: dec(1, 'ether') })

    // Check CDP is active
    const alice_CDP_1 = await cdpManager.CDPs(alice)
    const status_1 = alice_CDP_1[3]
    assert.equal(status_1, 1)
    assert.isTrue(await sortedCDPs.contains(alice))

    // Repay and close CDP
    await borrowerOperations.repayCLV('50000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, { from: alice })

    // Check CDP is closed
    const alice_CDP_2 = await cdpManager.CDPs(alice)
    const status_2 = alice_CDP_2[3]
    assert.equal(status_2, 2)
    assert.isFalse(await sortedCDPs.contains(alice))

    // Re-open CDP
    await borrowerOperations.openLoan('25000000000000000000', alice, { from: alice, value: dec(1, 'ether') })

    // Check CDP is re-opened
    const alice_CDP_3 = await cdpManager.CDPs(alice)
    const status_3 = alice_CDP_3[3]
    assert.equal(status_3, 1)
    assert.isTrue(await sortedCDPs.contains(alice))
  })

  it("openLoan(): increases the CDP's CLV debt by the correct amount", async () => {
    // check before
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 0)

    await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: dec(1, 'ether') })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, '50000000000000000000')
  })

  it("openLoan(): increases CLV debt in ActivePool by correct amount", async () => {



    const activePool_CLVDebt_Before = await activePool.getCLVDebt()
    assert.equal(activePool_CLVDebt_Before, 0)

    await borrowerOperations.openLoan(dec(50, 18), alice, { from: alice, value: dec(1, 'ether') })

    const activePool_CLVDebt_After = await activePool.getCLVDebt()
    assert.equal(activePool_CLVDebt_After, dec(50, 18))
  })

  it("openLoan(): increases user CLVToken balance by correct amount", async () => {
    // check before
    const alice_CLVTokenBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_Before, 0)

    await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: dec(1, 'ether') })

    // check after
    const alice_CLVTokenBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_After, '50000000000000000000')
  })


  it.only("openLoan(): the caller's ineligible deposit remains ineligible for LQTY", async () => {
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

    // Whale transfers CLV to A, B, C
    await clvToken.transfer(A, dec(50, 18), { from: whale })
    await clvToken.transfer(A, dec(60, 18), { from: whale })
    await clvToken.transfer(A, dec(70, 18), { from: whale })

    // A, B, C make deposits
    await poolManager.provideToSP(dec(50, 18), frontEnd_1, { from: A })
    await poolManager.provideToSP(dec(60, 18), frontEnd_2, { from: B })
    await poolManager.provideToSP(dec(70, 18), ZERO_ADDRESS, { from: C })  //  C deposits directly, not via front end

    // Confirm A, B, C's deposits are ineligible for LQTY rewards
    assert.isFalse(await poolManager.isEligibleForLQTY(A))
    assert.isFalse(await poolManager.isEligibleForLQTY(B))
    assert.isFalse(await poolManager.isEligibleForLQTY(C))

    // A, B, C open loans
    await borrowerOperations.openLoan(dec(10, 18), whale, { from: A, value: dec(100, 'ether') })
    await borrowerOperations.openLoan(dec(20, 18), whale, { from: B, value: dec(100, 'ether') })
    await borrowerOperations.openLoan(dec(30, 18), whale, { from: C, value: dec(100, 'ether') })

    // Confirm A, B, C's deposits remain ineligible for LQTY rewards
    assert.isFalse(await poolManager.isEligibleForLQTY(A))
    assert.isFalse(await poolManager.isEligibleForLQTY(B))
    assert.isFalse(await poolManager.isEligibleForLQTY(C))
  })


  //  --- getNewICRFromTroveChange ---

  describe("getNewICRFromTroveChange() returns the correct ICR", async () => {


    // 0, 0
    it("collChange = 0, debtChange = 0", async () => {
      price = await priceFeed.getPrice()
      const initialColl = dec(1, 'ether')
      const initialDebt = await th.getActualDebtFromComposite(dec(100, 18), contracts)
      const collChange = 0
      const debtChange = 0

      const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
      assert.equal(newICR, '2000000000000000000')
    })

    // 0, +ve
    it("collChange = 0, debtChange is positive", async () => {
      price = await priceFeed.getPrice()
      const initialColl = dec(1, 'ether')
      const initialDebt = await th.getActualDebtFromComposite(dec(100, 18), contracts)
      const collChange = 0
      const debtChange = dec(50, 18)

      const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
      assert.isAtMost(th.getDifference(newICR, '1333333333333333333'), 100)
    })

    // 0, -ve
    it("collChange = 0, debtChange is negative", async () => {
      price = await priceFeed.getPrice()
      const initialColl = dec(1, 'ether')
      const initialDebt = await th.getActualDebtFromComposite(dec(100, 18), contracts)
      const collChange = 0
      const debtChange = dec(50, 18)

      const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, false, price)).toString()
      assert.equal(newICR, '4000000000000000000')
    })

    // +ve, 0
    it("collChange is positive, debtChange is 0", async () => {
      price = await priceFeed.getPrice()
      const initialColl = dec(1, 'ether')
      const initialDebt = await th.getActualDebtFromComposite(dec(100, 18), contracts)
      const collChange = dec(1, 'ether')
      const debtChange = 0

      const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
      assert.equal(newICR, '4000000000000000000')
    })

    // -ve, 0
    it("collChange is negative, debtChange is 0", async () => {
      price = await priceFeed.getPrice()
      const initialColl = dec(1, 'ether')
      const initialDebt = await th.getActualDebtFromComposite(dec(100, 18), contracts)
      const collChange = dec(5, 17)
      const debtChange = 0

      const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, false, debtChange, true, price)).toString()
      assert.equal(newICR, '1000000000000000000')
    })

    // -ve, -ve
    it("collChange is negative, debtChange is negative", async () => {
      price = await priceFeed.getPrice()
      const initialColl = dec(1, 'ether')
      const initialDebt = await th.getActualDebtFromComposite(dec(100, 18), contracts)
      const collChange = dec(5, 17)
      const debtChange = dec(50, 18)

      const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, false, debtChange, false, price)).toString()
      assert.equal(newICR, '2000000000000000000')
    })

    // +ve, +ve 
    it("collChange is positive, debtChange is positive", async () => {
      price = await priceFeed.getPrice()
      const initialColl = dec(1, 'ether')
      const initialDebt = await th.getActualDebtFromComposite(dec(100, 18), contracts)
      const collChange = dec(1, 'ether')
      const debtChange = dec(100, 18)

      const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
      assert.equal(newICR, '2000000000000000000')
    })

    // +ve, -ve
    it("collChange is positive, debtChange is negative", async () => {
      price = await priceFeed.getPrice()
      const initialColl = dec(1, 'ether')
      const initialDebt = await th.getActualDebtFromComposite(dec(100, 18), contracts)
      const collChange = dec(1, 'ether')
      const debtChange = dec(50, 18)

      const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, false, price)).toString()
      assert.equal(newICR, '8000000000000000000')
    })

    // -ve, +ve
    it("collChange is negative, debtChange is positive", async () => {
      price = await priceFeed.getPrice()
      const initialColl = dec(1, 'ether')
      const initialDebt = await th.getActualDebtFromComposite(dec(100, 18), contracts)
      const collChange = dec(5, 17)
      const debtChange = dec(100, 18)

      const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, false, debtChange, true, price)).toString()
      assert.equal(newICR, '500000000000000000')
    })
  })

  //  --- getNewICRFromTroveChange ---

  describe("getNewTCRFromTroveChange() returns the correct TCR", async () => {

    // 0, 0
    it("collChange = 0, debtChange = 0", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = th.toBN(dec(1, 'ether'))
      const troveDebt = th.toBN(dec(100, 18))
      await borrowerOperations.openLoan(troveDebt, alice, { from: alice, value: troveColl })
      await borrowerOperations.openLoan(troveDebt, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await cdpManager.liquidate(bob)
      assert.isFalse(await sortedCDPs.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()


      // --- TEST ---
      const collChange = 0
      const debtChange = 0
      const newTCR = await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, true, price)

      const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
        .div(troveDebt.add(liquidatedDebt))

      assert.isTrue(newTCR.eq(expectedTCR))
    })

    // 0, +ve
    it("collChange = 0, debtChange is positive", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = th.toBN(dec(1, 'ether'))
      const troveDebt = th.toBN(dec(100, 18))
      await borrowerOperations.openLoan(troveDebt, alice, { from: alice, value: troveColl })
      await borrowerOperations.openLoan(troveDebt, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await cdpManager.liquidate(bob)
      assert.isFalse(await sortedCDPs.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = 0
      const debtChange = dec(200, 18)
      const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, true, price))

      const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
        .div(troveDebt.add(liquidatedDebt).add(th.toBN(debtChange)))

      assert.isTrue(newTCR.eq(expectedTCR))
    })

    // 0, -ve
    it("collChange = 0, debtChange is negative", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = th.toBN(dec(1, 'ether'))
      const troveDebt = th.toBN(dec(100, 18))
      await borrowerOperations.openLoan(troveDebt, alice, { from: alice, value: troveColl })
      await borrowerOperations.openLoan(troveDebt, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await cdpManager.liquidate(bob)
      assert.isFalse(await sortedCDPs.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()
      // --- TEST ---
      const collChange = 0
      const debtChange = dec(100, 18)
      const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, false, price))

      const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
        .div(troveDebt.add(liquidatedDebt).sub(th.toBN(dec(100, 18))))

      assert.isTrue(newTCR.eq(expectedTCR))
    })

    // +ve, 0
    it("collChange is positive, debtChange is 0", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = th.toBN(dec(1, 'ether'))
      const troveDebt = th.toBN(dec(100, 18))
      await borrowerOperations.openLoan(troveDebt, alice, { from: alice, value: troveColl })
      await borrowerOperations.openLoan(troveDebt, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await cdpManager.liquidate(bob)
      assert.isFalse(await sortedCDPs.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()
      // --- TEST ---
      const collChange = dec(2, 'ether')
      const debtChange = 0
      const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, true, price))

      const expectedTCR = (troveColl.add(liquidatedColl).add(th.toBN(collChange))).mul(price)
        .div(troveDebt.add(liquidatedDebt))

      assert.isTrue(newTCR.eq(expectedTCR))
    })

    // -ve, 0
    it("collChange is negative, debtChange is 0", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = th.toBN(dec(1, 'ether'))
      const troveDebt = th.toBN(dec(100, 18))
      await borrowerOperations.openLoan(troveDebt, alice, { from: alice, value: troveColl })
      await borrowerOperations.openLoan(troveDebt, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await cdpManager.liquidate(bob)
      assert.isFalse(await sortedCDPs.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = dec(1, 18)
      const debtChange = 0
      const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, false, debtChange, true, price))

      const expectedTCR = (troveColl.add(liquidatedColl).sub(th.toBN(dec(1, 'ether')))).mul(price)
        .div(troveDebt.add(liquidatedDebt))

      assert.isTrue(newTCR.eq(expectedTCR))
    })

    // -ve, -ve
    it("collChange is negative, debtChange is negative", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = th.toBN(dec(1, 'ether'))
      const troveDebt = th.toBN(dec(100, 18))
      await borrowerOperations.openLoan(troveDebt, alice, { from: alice, value: troveColl })
      await borrowerOperations.openLoan(troveDebt, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await cdpManager.liquidate(bob)
      assert.isFalse(await sortedCDPs.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = dec(1, 18)
      const debtChange = dec(100, 18)
      const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, false, debtChange, false, price))

      const expectedTCR = (troveColl.add(liquidatedColl).sub(th.toBN(dec(1, 'ether')))).mul(price)
        .div(troveDebt.add(liquidatedDebt).sub(th.toBN(dec(100, 18))))

      assert.isTrue(newTCR.eq(expectedTCR))
    })

    // +ve, +ve 
    it("collChange is positive, debtChange is positive", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = th.toBN(dec(1, 'ether'))
      const troveDebt = th.toBN(dec(100, 18))
      await borrowerOperations.openLoan(troveDebt, alice, { from: alice, value: troveColl })
      await borrowerOperations.openLoan(troveDebt, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await cdpManager.liquidate(bob)
      assert.isFalse(await sortedCDPs.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = dec(1, 'ether')
      const debtChange = dec(100, 18)
      const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, true, price))

      const expectedTCR = (troveColl.add(liquidatedColl).add(th.toBN(dec(1, 'ether')))).mul(price)
        .div(troveDebt.add(liquidatedDebt).add(th.toBN(dec(100, 18))))

      assert.isTrue(newTCR.eq(expectedTCR))
    })

    // +ve, -ve
    it("collChange is positive, debtChange is negative", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = th.toBN(dec(1, 'ether'))
      const troveDebt = th.toBN(dec(100, 18))
      await borrowerOperations.openLoan(troveDebt, alice, { from: alice, value: troveColl })
      await borrowerOperations.openLoan(troveDebt, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await cdpManager.liquidate(bob)
      assert.isFalse(await sortedCDPs.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = dec(1, 'ether')
      const debtChange = dec(100, 18)
      const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, false, price))

      const expectedTCR = (troveColl.add(liquidatedColl).add(th.toBN(dec(1, 'ether')))).mul(price)
        .div(troveDebt.add(liquidatedDebt).sub(th.toBN(dec(100, 18))))

      assert.isTrue(newTCR.eq(expectedTCR))
    })

    // -ve, +ve
    it("collChange is negative, debtChange is positive", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      const troveColl = th.toBN(dec(1, 'ether'))
      const troveDebt = th.toBN(dec(100, 18))
      await borrowerOperations.openLoan(troveDebt, alice, { from: alice, value: troveColl })
      await borrowerOperations.openLoan(troveDebt, bob, { from: bob, value: troveColl })

      await priceFeed.setPrice(dec(100, 18))

      const liquidationTx = await cdpManager.liquidate(bob)
      assert.isFalse(await sortedCDPs.contains(bob))

      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      await priceFeed.setPrice(dec(200, 18))
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = dec(1, 18)
      const debtChange = dec(200, 18)
      const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, false, debtChange, true, price))

      const expectedTCR = (troveColl.add(liquidatedColl).sub(th.toBN(dec(1, 18)))).mul(price)
        .div(troveDebt.add(liquidatedDebt).add(th.toBN(debtChange)))

      assert.isTrue(newTCR.eq(expectedTCR))
    })
  })
})



contract('Reset chain state', async accounts => { })

/* TODO:

1) Test SortedList re-ordering by ICR. ICR ratio
changes with addColl, withdrawColl, withdrawCLV, repayCLV, etc. Can split them up and put them with
individual functions, or give ordering it's own 'describe' block.

2)In security phase:
-'Negative' tests for all the above functions.
*/