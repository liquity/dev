const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th = testHelpers.TestHelper
const mv = testHelpers.MoneyValues

contract('BorrowerOperations', async accounts => {
  const _2_Ether = web3.utils.toWei('2', 'ether')
  const _100_Finney = web3.utils.toWei('100', 'finney')
  const _1_Ether = web3.utils.toWei('1', 'ether')
  const _5_Ether = web3.utils.toWei('5', 'ether')
  const _15_Ether = web3.utils.toWei('15', 'ether')

  const [owner, alice, bob, carol, dennis, erin, whale] = accounts;
  let priceFeed
  let clvToken
  let poolManager
  let sortedCDPs
  let cdpManager
  let nameRegistry
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations

  let sizeList_18orLess
  let sizeList_19orGreater

  let borrowerOpsTester

  before(async () => {
    borrowerOpsTester = await BorrowerOperationsTester.new()
    BorrowerOperationsTester.setAsDeployed(borrowerOpsTester)
  })

  beforeEach(async () => {
    const contracts = await deployLiquity()

    priceFeed = contracts.priceFeed
    clvToken = contracts.clvToken
    poolManager = contracts.poolManager
    sortedCDPs = contracts.sortedCDPs
    cdpManager = contracts.cdpManager
    nameRegistry = contracts.nameRegistry
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    functionCaller = contracts.functionCaller
    borrowerOperations = contracts.borrowerOperations
    sizeList_18orLess = contracts.sizeList_18orLess
    sizeList_19orGreater = contracts.sizeList_19orGreater

    const contractAddresses = getAddresses(contracts)
    await connectContracts(contracts, contractAddresses)

    borrowerOpsTester.setActivePool(contracts.activePool.address)
    borrowerOpsTester.setDefaultPool(contracts.defaultPool.address)
  })

  it("addColl(): Increases the activePool ETH and raw ether balance by correct amount", async () => {

    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })

    const activePool_ETH_Before = await activePool.getETH()
    const activePool_RawEther_Before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_Before, mv._1_Ether)
    assert.equal(activePool_RawEther_Before, mv._1_Ether)

    await borrowerOperations.addColl(alice, alice, alice, { from: alice, value: mv._1_Ether })

    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, mv._2_Ether)
    assert.equal(activePool_RawEther_After, mv._2_Ether)
  })

  it("addColl(), active CDP: adds the correct collateral amount to the CDP", async () => {
    // alice creates a CDP and adds first collateral
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    coll_Before = alice_CDP_Before[1]
    const status_Before = alice_CDP_Before[3]

    // check coll and status before
    assert.equal(coll_Before, _1_Ether)
    assert.equal(status_Before, 1)

    // Alice adds second collateral
    await borrowerOperations.addColl(alice, alice, alice, { from: alice, value: _1_Ether })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    const status_After = alice_CDP_After[3]

    // check coll increases by correct amount,and status remains active
    assert.equal(coll_After, _2_Ether)
    assert.equal(status_After, 1)
  })

  it("addColl(), active CDP: CDP is in sortedList before and after", async () => {
    // alice creates a CDP and adds first collateral
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })

    // check Alice is in list before
    const aliceCDPInList_Before = await sortedCDPs.contains(alice)
    const listIsEmpty_Before = await sortedCDPs.isEmpty()
    assert.equal(aliceCDPInList_Before, true)
    assert.equal(listIsEmpty_Before, false)

    await borrowerOperations.addColl(alice, alice, alice, { from: alice, value: _1_Ether })

    // check Alice is still in list after
    const aliceCDPInList_After = await sortedCDPs.contains(alice)
    const listIsEmpty_After = await sortedCDPs.isEmpty()
    assert.equal(aliceCDPInList_After, true)
    assert.equal(listIsEmpty_After, false)
  })

  it("addColl(), active CDP: updates the stake and updates the total stakes", async () => {
    //  Alice creates initial CDP with 1 ether
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '1000000000000000000')
    assert.equal(totalStakes_Before, '1000000000000000000')

    // Alice tops up CDP collateral with 2 ether
    await borrowerOperations.addColl(alice, alice, alice, { from: alice, value: _2_Ether })

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
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._15_Ether })
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._5_Ether })
    await borrowerOperations.openLoan(mv._180e18, carol, carol, { from: carol, carol, value: mv._1_Ether })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Carol's CDP, liquidating her 1 ether and 180CLV.
    await cdpManager.liquidate(carol, { from: owner });
    assert.isFalse(await sortedCDPs.contains(carol))

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

    // Alice and Bob top up their CDPs
    await borrowerOperations.addColl(alice, alice, alice, { from: alice, value: _5_Ether })
    await borrowerOperations.addColl(bob, bob, bob, { from: bob, value: _1_Ether })

    /* check that both alice and Bob have had pending rewards applied in addition to their top-ups. When Carol defaulted, 
    the reward-per-unit-staked due to her CDP liquidation was (1/20) ETH and (180/20) CLV Debt.

    Alice, with a stake of 15 ether, should have earned (15 * 1/20)  = 0.75 ETH, and (15 *180/20) = 135 CLV Debt.
    
    After her top-up of 5 ether:
    - Her collateral should be (15 + 0.75 + 5) = 20.75 ETH.
    - Her CLV debt should be (100 + 135) = 235 CLV.

    Bob, with a stake of 5 ether, should have earned (5 * 1/20)  = 0.25 ETH, and (5 *180/20) = 45 CLV.
     
    After his top-up of 1 ether:
    - His collateral should be (5 + 0.25 + 1) = 6.25 ETH.
    - His CLV debt should be (100 + 45) = 145 CLV.   */
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_CLVDebt_After = alice_CDP_After[0]
    const alice_Coll_After = alice_CDP_After[1]

    const bob_CDP_After = await cdpManager.CDPs(bob)
    const bob_CLVDebt_After = bob_CDP_After[0]
    const bob_Coll_After = bob_CDP_After[1]

    // check coll and debt are within 1e-16 of expected values
    assert.isAtMost(th.getDifference(alice_CLVDebt_After, '235000000000000000000'), 100)
    assert.isAtMost(th.getDifference(alice_Coll_After, '20750000000000000000'), 100)
    assert.isAtMost(th.getDifference(bob_CLVDebt_After, '145000000000000000000'), 100)
    assert.isAtMost(th.getDifference(bob_Coll_After, '6250000000000000000'), 100)

    /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be:

    L_ETH(0): 0.05
    L_CLVDebt(0): 9   */
    alice_rewardSnapshot_After = await cdpManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
    const alice_CLVDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]

    const bob_rewardSnapshot_After = await cdpManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
    const bob_CLVDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]

    assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, '50000000000000000'), 100)
    assert.isAtMost(th.getDifference(alice_CLVDebtRewardSnapshot_After, '9000000000000000000'), 100)
    assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, '50000000000000000'), 100)
    assert.isAtMost(th.getDifference(bob_CLVDebtRewardSnapshot_After, '9000000000000000000'), 100)
  })

  // it("addColl(), active CDP: adds the right corrected stake after liquidations have occured", async () => {
  //  // TODO - check stake updates for addColl/withdrawColl/adustLoan ---

  //   // --- SETUP ---
  //   // A,B,C add 15/5/5 ETH, withdraw 100/100/900 CLV
  //   await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._15_Ether })
  //   await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._4_Ether })
  //   await borrowerOperations.openLoan(mv._900e18, carol, carol, { from: carol, carol,  value: mv._5_Ether })

  //   await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._1_Ether })
  //   // --- TEST ---

  //   // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
  //   await priceFeed.setPrice('100000000000000000000');

  //   // close Carol's CDP, liquidating her 5 ether and 900CLV.
  //   await cdpManager.liquidate(carol, { from: owner });

  //   // dennis tops up his loan by 1 ETH
  //   await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: mv._1_Ether })

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

  it("addColl(): allows a user to top up an active CDP with additional collateral of value < $20 USD", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1e17 })

    // Tops up with only one wei
    const txData = await borrowerOperations.addColl(alice, alice, alice, { from: alice, value: '1' })

    // check top-up was successful
    txStatus = txData.receipt.status
    assert.isTrue(txStatus)
  })

  it("addColl(): non-trove owner can add collateral to another user's trove", async () => {
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, bob, { from: bob, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._300e18, carol, carol, { from: carol, carol, value: mv._5_Ether })

    const activeETH_Before = await activePool.getETH()
    assert.equal(activeETH_Before, mv._10_Ether)

    // Dennis adds collateral to Bob's trove
    const tx = await borrowerOperations.addColl(bob, bob, bob, { from: dennis, value: _5_Ether })
    assert.isTrue(tx.receipt.status)

    // Check Bob's collateral
    const bob_collateral = (await cdpManager.CDPs(bob))[1].toString()
    assert.equal(bob_collateral, mv._8_Ether)

    // Check Bob's stake
    const bob_Stake = (await cdpManager.CDPs(bob))[2].toString()
    assert.equal(bob_Stake, mv._8_Ether)

    // Check activePool ETH increased to 15 ETH
    const activeETH_After = await activePool.getETH()
    assert.equal(activeETH_After, mv._15_Ether)
  })

  it("addColl(): non-trove owner can add collateral to another user's trove", async () => {
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, bob, { from: bob, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._300e18, carol, carol, { from: carol, carol, value: mv._5_Ether })

    const activeETH_Before = await activePool.getETH()
    assert.equal(activeETH_Before, mv._10_Ether)

    // Carol adds collateral to Bob's trove
    const tx = await borrowerOperations.addColl(bob, bob, bob, { from: carol, carol, value: _5_Ether })
    assert.isTrue(tx.receipt.status)

    // Check Bob's collateral
    const bob_collateral = (await cdpManager.CDPs(bob))[1].toString()
    assert.equal(bob_collateral, mv._8_Ether)

    // Check Bob's stake
    const bob_Stake = (await cdpManager.CDPs(bob))[2].toString()
    assert.equal(bob_Stake, mv._8_Ether)

    // Check activePool ETH increased to 15 ETH
    const activeETH_After = await activePool.getETH()
    assert.equal(activeETH_After, mv._15_Ether)
  })

  // --- no size range transition ---

  it("addColl(): re-inserts trove to it's current size list when new collateral is in the same size range", async () => {
    // A, B open troves
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._10_Ether }) // >1e19 wei, therefore in sizeRange 19

    // Check size lists before
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_19orGreater.contains(bob))

    // A, B add coll, staying within their respective initial collateral ranges 
    await borrowerOperations.addColl(alice, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.addColl(bob, bob, bob, { from: bob, value: mv._1_Ether })

    // Check size lists after
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_19orGreater.contains(bob))
  })

  it("addColl(): trove remains in the same size range array when new collateral is in the same size range", async () => {
    // A, B open troves
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._10_Ether }) // >1e19 wei, therefore in sizeRange 19

    // Check size arrays before
    const sizeRangeArray18_element0_Before = await cdpManager.rangeToSizeArray(18, 0)
    const sizeRangeArray19_element0_Before = await cdpManager.rangeToSizeArray(19, 0)

    assert.equal(sizeRangeArray18_element0_Before, alice)
    assert.equal(sizeRangeArray19_element0_Before, bob)

    // A, B add coll, staying within their respective initial  collateral ranges 
    await borrowerOperations.addColl(alice, alice, bob, { from: alice, value: mv._1_Ether })
    await borrowerOperations.addColl(bob, bob, bob, { from: bob, value: mv._1_Ether })

    // Check size arrays after
    const sizeRangeArray18_element0_After = await cdpManager.rangeToSizeArray(18, 0)
    const sizeRangeArray19_element0_After = await cdpManager.rangeToSizeArray(19, 0)

    assert.equal(sizeRangeArray18_element0_After, alice)
    assert.equal(sizeRangeArray19_element0_After, bob)
  })

  it("addColl(): trove retains the same sizeRange property when new collateral is in the same size range", async () => {
    // A, B open troves
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._10_Ether }) // >1e19 wei, therefore in sizeRange 19

    // Check sizeRange properties before
    const A_sizeRange_Before = (await cdpManager.CDPs(alice))[6].toString()
    const B_sizeRange_Before = (await cdpManager.CDPs(bob))[6].toString()

    assert.equal(A_sizeRange_Before, '18')
    assert.equal(B_sizeRange_Before, '19')

    // A, B add coll, staying within their respective initial  collateral ranges 
    await borrowerOperations.addColl(alice, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.addColl(bob, bob, bob, { from: bob, value: mv._1_Ether })

    // Check sizeRange properties after
    const A_sizeRange_After = (await cdpManager.CDPs(alice))[6]
    const B_sizeRange_After = (await cdpManager.CDPs(bob))[6]

    assert.equal(A_sizeRange_After, '18')
    assert.equal(B_sizeRange_After, '19')
  })

  // --- Transitions to new size range ---

  it("addColl(): transitions trove between size lists when new collateral is in a greater size range", async () => {
    // A, B open troves in size range 18
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._5e18 }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: '9999999999999999999' }) // <1e19 wei, therefore in sizeRange 18

    // Check size lists before
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_18orLess.contains(bob))

    // A, B add coll, bringing their coll >= 1e19
    await borrowerOperations.addColl(alice, alice, alice, { from: alice, value: mv._6_Ether })
    await borrowerOperations.addColl(bob, bob, bob, { from: bob, value: '1' })

    // Check troves have been removed from their previous size list
    assert.isFalse(await sizeList_18orLess.contains(alice))
    assert.isFalse(await sizeList_18orLess.contains(bob))

    // Check troves have been added to the correct new size list
    assert.isTrue(await sizeList_19orGreater.contains(alice))
    assert.isTrue(await sizeList_19orGreater.contains(bob))
  })

  it("addColl(): removes trove address from current size range array and adds it to new size range array, when new collateral is in a greater size range", async () => {
    // A, B open troves in size range 18
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._5e18 }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: '9999999999999999999' }) // <1e19 wei, therefore in sizeRange 18

    // check length of sizeArray 18 is 2, and length of sizeArray 19 is 0
    const length_sizeArray18_Before = await cdpManager.getSizeArrayCount(18)
    const length_sizeArray19_Before = await cdpManager.getSizeArrayCount(19)

    assert.equal(length_sizeArray18_Before, '2')
    assert.equal(length_sizeArray19_Before, '0')

    // check A, B are in size array 18
    const sizeArray18_element0_Before = await cdpManager.rangeToSizeArray(18, 0)
    const sizeArray18_element1_Before = await cdpManager.rangeToSizeArray(18, 1)

    assert.equal(sizeArray18_element0_Before, alice)
    assert.equal(sizeArray18_element1_Before, bob)

    // A, B add coll, bringing their coll >= 1e19
    await borrowerOperations.addColl(alice, alice, alice, { from: alice, value: mv._6_Ether })
    await borrowerOperations.addColl(bob, bob, bob, { from: bob, value: '1' })

    // check length of sizeArray 18 is 0, and length of sizeArray 19 is 2
    const length_sizeArray18_After = await cdpManager.getSizeArrayCount(18)
    const length_sizeArray19_After = await cdpManager.getSizeArrayCount(19)

    assert.equal(length_sizeArray18_After, '0')
    assert.equal(length_sizeArray19_After, '2')

    //check A, B are in size array 19
    const sizeArray19_element0_After = await cdpManager.rangeToSizeArray(19, 0)
    const sizeArray19_element1_After = await cdpManager.rangeToSizeArray(19, 1)

    assert.equal(sizeArray19_element0_After, alice)
    assert.equal(sizeArray19_element1_After, bob)
  })

  it("addColl(): updates trove's sizeRange property when new collateral is in in a greater size range", async () => {
    // A, B open troves in size range 18
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._5e18 }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: '9999999999999999999' }) // <1e19 wei, therefore in sizeRange 18

    // Check sizeRange properties before
    const A_sizeRange_Before = (await cdpManager.CDPs(alice))[6].toString()
    const B_sizeRange_Before = (await cdpManager.CDPs(bob))[6].toString()

    assert.equal(A_sizeRange_Before, '18')
    assert.equal(B_sizeRange_Before, '18')

    // A, B add coll, bringing their coll >= 1e19
    await borrowerOperations.addColl(alice, alice, alice, { from: alice, value: mv._6_Ether })
    await borrowerOperations.addColl(bob, bob, bob, { from: bob, value: '1' })

    // Check sizerange properties after
    const A_sizeRange_After = (await cdpManager.CDPs(alice))[6].toString()
    const B_sizeRange_After = (await cdpManager.CDPs(bob))[6].toString()

    assert.equal(A_sizeRange_After, '19')
    assert.equal(B_sizeRange_After, '19')
  })


  it("addColl(), reverts if trove is non-existent or closed", async () => {
    // A, B open troves
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })

    // Carol attempts to add collateral to her non-existent trove
    try {
      const txCarol = await borrowerOperations.addColl(carol, carol, carol, { from: carol, carol, value: mv._1_Ether })
      assert.isFalse(txCarol.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "CDP does not exist or is closed")
    }

    // Alice attempts to add colalteral to Carol's non-existent trove
    try {
      const txCarol_fromAlice = await borrowerOperations.addColl(carol, carol, carol, { from: alice, value: mv._1_Ether })
      assert.isFalse(txCarol_fromAlice.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "CDP does not exist or is closed")
    }

    // Price drops
    await priceFeed.setPrice(mv._100e18)

    // Bob gets liquidated
    await cdpManager.liquidate(bob)

    assert.isFalse(await sortedCDPs.contains(bob))

    // Bob attempts to add collateral to his closed trove
    try {
      const txBob = await borrowerOperations.addColl(bob, bob, bob, { value: mv._1_Ether })
      assert.isFalse(txBob.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "CDP does not exist or is closed")
    }

    // Alice attempts to add colalteral to Bob's closed trove
    try {
      const txBob_fromAlice = await borrowerOperations.addColl(bob, bob, bob, { from: alice, value: mv._1_Ether })
      assert.isFalse(txBob_fromAlice.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "CDP does not exist or is closed")
    }
  })

  // --- withdrawColl() ---

  it("withdrawColl(): reverts if dollar value of remaining collateral in CDP would be < $20 USD", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _100_Finney })

    // Alice attempts to withdraw 1 wei. Check tx reverts
    try {
      const txData = await borrowerOperations.withdrawColl('1', alice, alice, { from: alice })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Remaining collateral must have $USD value >= 20, or be zero")
    }
  })

  // reverts when calling address does not have active trove  
  it("withdrawColl(): reverts when calling address does not have active trove", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._1_Ether })

    // Bob successfully withdraws
    const txBob = await borrowerOperations.withdrawColl(mv._1_Ether, bob, bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Carol with no active trove attempts to withdraw
    try {
      const txCarol = await borrowerOperations.withdrawColl(mv._1_Ether, carol, carol, { from: carol })
      assert.fail(txCarol)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawColl(): reverts when system is in Recovery Mode", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, alice, { from: alice })
    await borrowerOperations.withdrawCLV(mv._100e18, bob, bob, { from: bob })

    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Withdrawal possible when recoveryMode == false
    const txAlice = await borrowerOperations.withdrawColl(1000, alice, alice, { from: alice })
    assert.isTrue(txAlice.receipt.status)

    await priceFeed.setPrice('105000000000000000000')

    assert.isTrue(await cdpManager.checkRecoveryMode())

    //Check withdrawal impossible when recoveryMode == true
    try {
      const txBob = await borrowerOperations.withdrawColl(1000, bob, bob, { from: bob })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })


  it("withdrawColl(): reverts when requested ETH withdrawal is > the trove's collateral", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, carol, carol, { from: carol, carol, value: mv._1_Ether })

    const txCarol = await borrowerOperations.withdrawColl('1000000000000000000', carol, carol, { from: carol })
    assert.isTrue(txCarol.receipt.status)

    try {
      const txBob = await borrowerOperations.withdrawColl('1000000000000000001', bob, bob, { from: bob })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawColl(): reverts when withdrawal would bring the user's ICR < MCR", async () => {
    await priceFeed.setPrice(mv._100e18)
    const price = await priceFeed.getPrice()

    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._10_Ether })

    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._1_Ether })

    await borrowerOperations.withdrawCLV(mv._50e18, alice, alice, { from: alice })
    await borrowerOperations.withdrawCLV(mv._50e18, bob, bob, { from: bob })


    // Alice withdraws 0.45 ether, leaving 0.55 remaining. Her ICR = (0.55*100)/50 = 110%.
    const txAlice = await borrowerOperations.withdrawColl('450000000000000000', alice, alice, { from: alice })
    assert.isTrue(txAlice.receipt.status)

    // Bob attempts to withdraws 0.46 ether, Which would leave him with 0.54 coll and ICR = (0.54*100)/50 = 108%.
    try {
      const txBob = await borrowerOperations.withdrawColl('460000000000000000', bob, bob, { from: bob })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawColl(): reverts if system is in recovery mode", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._3_Ether })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, bob, { from: bob })

    const TCR = (await poolManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // price drops to 1ETH:150CLV, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000');

    //Alice tries to withdraw collateral during Recovery Mode
    try {
      const txData = await borrowerOperations.withdrawColl('1', alice, alice, { from: alice })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("withdrawColl(): allows a user to completely withdraw all collateral from their CDP", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _100_Finney })

    // Alice attempts to withdraw all collateral
    const txData = await borrowerOperations.withdrawColl(_100_Finney, alice, alice, { from: alice })

    // check withdrawal was successful
    txStatus = txData.receipt.status
    assert.isTrue(txStatus)
  })

  it("withdrawColl(): closes the CDP when the user withdraws all collateral", async () => {
    // Open CDP 
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })

    // Check CDP is active
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const status_Before = alice_CDP_Before[3]
    assert.equal(status_Before, 1)
    assert.isTrue(await sortedCDPs.contains(alice))

    // Withdraw all the collateral in the CDP
    await borrowerOperations.withdrawColl(_1_Ether, alice, alice, { from: alice })

    // Check CDP is closed
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const status_After = alice_CDP_After[3]
    assert.equal(status_After, 2)
    assert.isFalse(await sortedCDPs.contains(alice))

  })

  it("withdrawColl(): leaves the CDP active when the user withdraws less than all the collateral", async () => {
    // Open CDP 
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })

    // Check CDP is active
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const status_Before = alice_CDP_Before[3]
    assert.equal(status_Before, 1)
    assert.isTrue(await sortedCDPs.contains(alice))

    // Withdraw some collateral
    await borrowerOperations.withdrawColl(_100_Finney, alice, alice, { from: alice })

    // Check CDP is still active
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const status_After = alice_CDP_After[3]
    assert.equal(status_After, 1)
    assert.isTrue(await sortedCDPs.contains(alice))
  })

  it("withdrawColl(): reduces the CDP's collateral by the correct amount", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _2_Ether })

    // check before -  Alice has 2 ether in CDP 
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const coll_Before = alice_CDP_Before[1]
    assert.equal(coll_Before, _2_Ether)

    // Alice withdraws 1 ether
    await borrowerOperations.withdrawColl(_1_Ether, alice, alice, { from: alice })

    // Check 1 ether remaining
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    assert.equal(coll_After, _1_Ether)
  })

  it("withdrawColl(): reduces ActivePool ETH and raw ether by correct amount", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _2_Ether })

    // check before
    const activePool_ETH_before = await activePool.getETH()
    const activePool_RawEther_before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_before, _2_Ether)
    assert.equal(activePool_RawEther_before, _2_Ether)

    await borrowerOperations.withdrawColl(_1_Ether, alice, alice, { from: alice })

    // check after
    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, _1_Ether)
    assert.equal(activePool_RawEther_After, _1_Ether)
  })

  it("withdrawColl(): updates the stake and updates the total stakes", async () => {
    //  Alice creates initial CDP with 2 ether
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _2_Ether })

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '2000000000000000000')
    assert.equal(totalStakes_Before, '2000000000000000000')

    // Alice withdraws 1 ether
    await borrowerOperations.withdrawColl(_1_Ether, alice, alice, { from: alice })

    // Check stake and total stakes get updated
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_Stake_After = alice_CDP_After[2].toString()
    const totalStakes_After = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, '1000000000000000000')
    assert.equal(totalStakes_After, '1000000000000000000')
  })

  it("withdrawColl(): sends the correct amount of ETH to the user", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _2_Ether })

    const alice_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))
    await borrowerOperations.withdrawColl(_1_Ether, alice, alice, { from: alice, gasPrice: 0 })

    const alice_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(alice))
    const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

    //   assert.equal(balanceDiff.toString(), _1_Ether)
  })

  it("withdrawColl(): applies pending rewards and updates user's L_ETH, L_CLVDebt snapshots", async () => {
    // --- SETUP ---
    // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _15_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: _5_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: carol, carol, value: _1_Ether })

    // Alice and Bob withdraw 100CLV, Carol withdraws 180CLV
    await borrowerOperations.withdrawCLV('100000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawCLV('100000000000000000000', bob, bob, { from: bob })
    await borrowerOperations.withdrawCLV('180000000000000000000', carol, carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Carol's CDP, liquidating her 1 ether and 180CLV.
    await cdpManager.liquidate(carol, { from: owner });

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

    // Alice and Bob withdraw from their CDPs
    await borrowerOperations.withdrawColl(_5_Ether, alice, alice, { from: alice })
    await borrowerOperations.withdrawColl(_1_Ether, bob, bob, { from: bob })

    /* check that both alice and Bob have had pending rewards applied in addition to their top-ups. When Carol defaulted, 
    the reward-per-unit-staked due to her CDP liquidation was (1/20) ETH and (180/20) CLV Debt.
 
    Alice, with a stake of 15 ether, should have earned (15 * 1/20)  = 0.75 ETH, and (15 *180/20) = 135 CLV Debt.
    
    After her withdrawal of 5 ether:
    - Her collateral should be (15 + 0.75 - 5) = 10.75 ETH.
    - Her CLV debt should be (100 + 135) = 235 CLV.
 
    Bob, with a stake of 5 ether, should have earned (5 * 1/20)  = 0.25 ETH, and (5 *180/20) = 45 CLV.
     
    After his withdrawal of 1 ether:
    - His collateral should be (5 + 0.25 - 1) = 4.25 ETH.
    - His CLV debt should be (100 + 45) = 145 CLV.   */
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_CLVDebt_After = alice_CDP_After[0]
    const alice_Coll_After = alice_CDP_After[1]

    const bob_CDP_After = await cdpManager.CDPs(bob)
    const bob_CLVDebt_After = bob_CDP_After[0]
    const bob_Coll_After = bob_CDP_After[1]

    assert.isAtMost(th.getDifference(alice_CLVDebt_After, '235000000000000000000'), 100)
    assert.isAtMost(th.getDifference(alice_Coll_After, '10750000000000000000'), 100)

    assert.isAtMost(th.getDifference(bob_CLVDebt_After, '145000000000000000000'), 100)
    assert.isAtMost(th.getDifference(bob_Coll_After, '4250000000000000000'), 100)

    /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be:
 
    L_ETH(0): 0.05
    L_CLVDebt(0): 9   */
    alice_rewardSnapshot_After = await cdpManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
    const alice_CLVDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]

    const bob_rewardSnapshot_After = await cdpManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
    const bob_CLVDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]

    assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, '50000000000000000'), 100)
    assert.isAtMost(th.getDifference(alice_CLVDebtRewardSnapshot_After, '9000000000000000000'), 100)
    assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, '50000000000000000'), 100)
    assert.isAtMost(th.getDifference(bob_CLVDebtRewardSnapshot_After, '9000000000000000000'), 100)
  })

  // --- No size range transition ---

  it("withdrawColl(): re-inserts trove to it's current size list when new collateral is in the same size range", async () => {
    // A, B open troves
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._11_Ether }) // >1e19 wei, therefore in sizeRange 19

    // Check size lists before
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_19orGreater.contains(bob))

    // A, B withdraw collateral such that their remaining collaterals have not changed size ranges
    await borrowerOperations.withdrawColl(mv._1e17, alice, alice, { from: alice })
    await borrowerOperations.withdrawColl(mv._1_Ether, bob, bob, { from: bob })

    // Check size lists after
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_19orGreater.contains(bob))
  })

  it("withdrawColl(): trove remains in the same size range array when new collateral is in the same size range", async () => {
    // A, B open troves
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._11_Ether }) // >1e19 wei, therefore in sizeRange 19

    // Check size arrays before
    const sizeRangeArray18_element0_Before = await cdpManager.rangeToSizeArray(18, 0)
    const sizeRangeArray19_element0_Before = await cdpManager.rangeToSizeArray(19, 0)

    assert.equal(sizeRangeArray18_element0_Before, alice)
    assert.equal(sizeRangeArray19_element0_Before, bob)

    // A, B withdraw collateral such that their remaining collaterals have not changed size ranges
    await borrowerOperations.withdrawColl(mv._1e17, alice, alice, { from: alice })
    await borrowerOperations.withdrawColl(mv._1_Ether, bob, bob, { from: bob })

    // Check size arrays after
    const sizeRangeArray18_element0_After = await cdpManager.rangeToSizeArray(18, 0)
    const sizeRangeArray19_element0_After = await cdpManager.rangeToSizeArray(19, 0)

    assert.equal(sizeRangeArray18_element0_After, alice)
    assert.equal(sizeRangeArray19_element0_After, bob)
  })

  it("withdrawColl(): trove retains the same sizeRange property when new collateral is in the same size range", async () => {
    // A, B open troves
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._11_Ether }) // >1e19 wei, therefore in sizeRange 19

    // Check sizeRange properties before
    const A_sizeRange_Before = (await cdpManager.CDPs(alice))[6].toString()
    const B_sizeRange_Before = (await cdpManager.CDPs(bob))[6].toString()

    assert.equal(A_sizeRange_Before, '18')
    assert.equal(B_sizeRange_Before, '19')

    // A, B withdraw collateral such that their remaining collaterals have not changed size ranges
    await borrowerOperations.withdrawColl(mv._1e17, alice, alice, { from: alice })
    await borrowerOperations.withdrawColl(mv._1_Ether, bob, bob, { from: bob })

    // Check sizeRange properties after
    const A_sizeRange_After = (await cdpManager.CDPs(alice))[6]
    const B_sizeRange_After = (await cdpManager.CDPs(bob))[6]

    assert.equal(A_sizeRange_After, '18')
    assert.equal(B_sizeRange_After, '19')
  })

  // --- Transitions to new size range ---

  it("withdrawColl(): transitions trove between size lists when new collateral is in a lower size range", async () => {
    // A, B open troves in size range 19
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._10_Ether }) // 1e19 wei, therefore in sizeRange 19
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._11_Ether }) // > 1e19 wei, therefore in sizeRange 18

    // Check size lists before
    assert.isTrue(await sizeList_19orGreater.contains(alice))
    assert.isTrue(await sizeList_19orGreater.contains(bob))

    // A, B withdraw, and their remaining coll is now < 1e19
    await borrowerOperations.withdrawColl('1', alice, alice, { from: alice })
    await borrowerOperations.withdrawColl(mv._5_Ether, bob, bob, { from: bob })

    // Check troves have been removed from their previous size list
    assert.isFalse(await sizeList_19orGreater.contains(alice))
    assert.isFalse(await sizeList_19orGreater.contains(bob))

    // Check troves have been added to the correct new size list
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_18orLess.contains(bob))
  })

  it("withdrawColl(): removes trove address from current size range array and adds it to new size range array, when new collateral is in a lower size range", async () => {
    // A, B open troves in size range 19
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._10_Ether }) // 1e19 wei, therefore in sizeRange 19
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._11_Ether }) // > 1e19 wei, therefore in sizeRange 18

    // check length of sizeArray 19 is 2, and length of sizeArray 18 is 0
    const length_sizeArray18_Before = await cdpManager.getSizeArrayCount(18)
    const length_sizeArray19_Before = await cdpManager.getSizeArrayCount(19)

    assert.equal(length_sizeArray18_Before, '0')
    assert.equal(length_sizeArray19_Before, '2')

    // check A, B are in size array 19
    const sizeArray19_element0_Before = await cdpManager.rangeToSizeArray(19, 0)
    const sizeArray19_element1_Before = await cdpManager.rangeToSizeArray(19, 1)

    assert.equal(sizeArray19_element0_Before, alice)
    assert.equal(sizeArray19_element1_Before, bob)

    // Withdraw coll
    await borrowerOperations.withdrawColl('1', alice, alice, { from: alice })
    await borrowerOperations.withdrawColl(mv._5_Ether, bob, bob, { from: bob })

    // check length of sizeArray 19 is 0, and length of sizeArray 18 is 2
    const length_sizeArray18_After = await cdpManager.getSizeArrayCount(18)
    const length_sizeArray19_After = await cdpManager.getSizeArrayCount(19)

    assert.equal(length_sizeArray18_After, '2')
    assert.equal(length_sizeArray19_After, '0')

    //check A, B are in size array 18
    const sizeArray18_element0_After = await cdpManager.rangeToSizeArray(18, 0)
    const sizeArray18_element1_After = await cdpManager.rangeToSizeArray(18, 1)

    assert.equal(sizeArray18_element0_After, alice)
    assert.equal(sizeArray18_element1_After, bob)
  })

  it("withdrawColl(): updates trove's sizeRange property when new collateral is in in a lower size range", async () => {
    // A, B open troves in size range 19
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._10_Ether }) // 1e19 wei, therefore in sizeRange 19
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._11_Ether }) // > 1e19 wei, therefore in sizeRange 18

    // Check sizeRange properties before
    const A_sizeRange_Before = (await cdpManager.CDPs(alice))[6].toString()
    const B_sizeRange_Before = (await cdpManager.CDPs(bob))[6].toString()

    assert.equal(A_sizeRange_Before, '19')
    assert.equal(B_sizeRange_Before, '19')

    // Withdraw coll
    await borrowerOperations.withdrawColl('1', alice, alice, { from: alice })
    await borrowerOperations.withdrawColl(mv._5_Ether, bob, bob, { from: bob })

    // Check sizerange properties after
    const A_sizeRange_After = (await cdpManager.CDPs(alice))[6].toString()
    const B_sizeRange_After = (await cdpManager.CDPs(bob))[6].toString()

    assert.equal(A_sizeRange_After, '18')
    assert.equal(B_sizeRange_After, '18')
  })

  // --- withdrawCLV() ---

  it("withdrawCLV(): reverts when calling address does not have active trove", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._1_Ether })

    // Bob successfully withdraws CLV
    const txBob = await borrowerOperations.withdrawCLV(mv._100e18, bob, bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Carol with no active trove attempts to withdraw CLV
    try {
      const txCarol = await borrowerOperations.withdrawCLV(mv._100e18, carol, carol, { from: carol })
      assert.fail(txCarol)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawCLV(): reverts when requested withdrawal amount is zero CLV", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._1_Ether })

    // Bob successfully withdraws 1e-18 CLV
    const txBob = await borrowerOperations.withdrawCLV(1, bob, bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Alice attempts to withdraw 0 CLV
    try {
      const txAlice = await borrowerOperations.withdrawCLV(0, alice, alice, { from: alice })
      assert.fail(txAlice)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawCLV(): reverts when system is in Recovery Mode", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._1_Ether })

    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Withdrawal possible when recoveryMode == false
    const txAlice = await borrowerOperations.withdrawCLV(mv._100e18, alice, alice, { from: alice })
    assert.isTrue(txAlice.receipt.status)

    await priceFeed.setPrice('50000000000000000000')

    assert.isTrue(await cdpManager.checkRecoveryMode())

    //Check CLV withdrawal impossible when recoveryMode == true
    try {
      const txBob = await borrowerOperations.withdrawCLV(1, bob, bob, { from: bob })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })


  it("withdrawCLV(): reverts when withdrawal would bring the loan's ICR < MCR", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._1_Ether })

    const txAlice = await borrowerOperations.withdrawCLV("181000000000000000000", alice, alice, { from: alice })
    assert.isTrue(txAlice.receipt.status)

    const price = await priceFeed.getPrice()
    const aliceICR = await cdpManager.getCurrentICR(alice, price)

    // Check Alice ICR > MCR
    assert.isTrue(aliceICR.gte(web3.utils.toBN("1100000000000000000")))

    // Bob tries to withdraw CLV that would bring his ICR < MCR
    try {
      const txBob = await borrowerOperations.withdrawCLV("182000000000000000000", bob, bob, { from: bob })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("withdrawCLV(): reverts when the withdrawal would cause the TCR of the system to fall below the CCR", async () => {
    await priceFeed.setPrice(mv._100e18)
    const price = await priceFeed.getPrice()

    // Alice and Bob creates troves with 3 ETH / 200 CLV, and 150% ICR.  System TCR = 150%.
    const txAlice = await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._3_Ether })
    const aliceICR = await cdpManager.getCurrentICR(alice, price)

    const txBob = await borrowerOperations.openLoan(mv._200e18, bob, bob, { from: bob, value: mv._3_Ether })
    const bobICR = await cdpManager.getCurrentICR(bob, price)

    assert.isTrue(txAlice.receipt.status)
    assert.isTrue(txBob.receipt.status)
    assert.isTrue(aliceICR.eq(web3.utils.toBN('1500000000000000000')))
    assert.isTrue(bobICR.eq(web3.utils.toBN('1500000000000000000')))

    const TCR = (await poolManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // Bob attempts to withdraw 1 CLV.
    // System TCR would be: ((3+3) * 100 ) / (200+201) = 600/401 = 149.62%, i.e. below CCR of 150%.
    try {
      const txBob = await borrowerOperations.withdrawCLV(mv._1e18, bob, bob, { from: bob })
      assert.isFalse(txBob.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })


  it("withdrawCLV(): reverts if withdrawal would pull TCR below CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._3_Ether })

    //  Alice and Bob withdraw such that the TCR is 150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, bob, { from: bob })

    // --- TEST ---

    // Alice attempts to withdraw 10 CLV, which would reducing TCR below 150%
    try {
      const txData = await borrowerOperations.withdrawCLV('10000000000000000000', alice, alice, { from: alice })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("withdrawCLV(): reverts if system is in recovery mode", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._3_Ether })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, bob, { from: bob })

    // const TCR = (await poolManager.getTCR()).toString()
    // assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // price drops to 1ETH:150CLV, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000');

    try {
      const txData = await borrowerOperations.withdrawCLV('200', alice, alice, { from: alice })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("withdrawCLV(): increases the CDP's CLV debt by the correct amount", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })

    // check before
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 0)

    await borrowerOperations.withdrawCLV(100, alice, alice, { from: alice })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, 100)
  })

  it("withdrawCLV(): increases CLV debt in ActivePool by correct amount", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })

    // check before
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 0)

    await borrowerOperations.withdrawCLV(100, alice, alice, { from: alice })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, 100)
  })

  it("withdrawCLV(): increases user CLVToken balance by correct amount", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })

    // check before
    const alice_CLVTokenBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_Before, 0)

    await borrowerOperations.withdrawCLV(100, alice, alice, { from: alice })

    // check after
    const alice_CLVTokenBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_After, 100)
  })

  it("withdrawCLV(): re-inserts trove to it's current size list", async () => {
    // A, B open troves
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._11_Ether }) // >1e19 wei, therefore in sizeRange 19

    // Check size lists before
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_19orGreater.contains(bob))

    // A, B each withdraw CLV
    await borrowerOperations.withdrawCLV(mv._150e18, alice, alice, { from: alice }) 
    await borrowerOperations.withdrawCLV('17', bob, bob, { from: bob }) 

    // Check size lists after
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_19orGreater.contains(bob))
  })

  it("withdrawCLV(): trove remains in the same size range array", async () => {
    // A, B open troves
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._11_Ether }) // >1e19 wei, therefore in sizeRange 19

    // Check size arrays before
    const sizeRangeArray18_element0_Before = await cdpManager.rangeToSizeArray(18, 0)
    const sizeRangeArray19_element0_Before = await cdpManager.rangeToSizeArray(19, 0)

    assert.equal(sizeRangeArray18_element0_Before, alice)
    assert.equal(sizeRangeArray19_element0_Before, bob)

    // A, B each withdraw CLV
    await borrowerOperations.withdrawCLV(mv._150e18, alice, alice, { from: alice }) 
    await borrowerOperations.withdrawCLV('17', bob, bob, { from: bob }) 

    // Check size arrays after
    const sizeRangeArray18_element0_After = await cdpManager.rangeToSizeArray(18, 0)
    const sizeRangeArray19_element0_After = await cdpManager.rangeToSizeArray(19, 0)

    assert.equal(sizeRangeArray18_element0_After, alice)
    assert.equal(sizeRangeArray19_element0_After, bob)
  })

  it("withdrawCLV(): trove retains the same sizeRange property", async () => {
    // A, B open troves
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._11_Ether }) // >1e19 wei, therefore in sizeRange 19

    // Check sizeRange properties before
    const A_sizeRange_Before = (await cdpManager.CDPs(alice))[6].toString()
    const B_sizeRange_Before = (await cdpManager.CDPs(bob))[6].toString()

    assert.equal(A_sizeRange_Before, '18')
    assert.equal(B_sizeRange_Before, '19')

    // A, B each withdraw CLV
    await borrowerOperations.withdrawCLV(mv._150e18, alice, alice, { from: alice }) 
    await borrowerOperations.withdrawCLV('17', bob, bob, { from: bob }) 

    // Check sizeRange properties after
    const A_sizeRange_After = (await cdpManager.CDPs(alice))[6]
    const B_sizeRange_After = (await cdpManager.CDPs(bob))[6]

    assert.equal(A_sizeRange_After, '18')
    assert.equal(B_sizeRange_After, '19')
  })

  // --- repayCLV() ---

  it("repayCLV(): reverts when calling address does not have active trove", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, alice, { from: alice })
    await borrowerOperations.withdrawCLV(mv._100e18, bob, bob, { from: bob })

    // Bob successfully repays some CLV
    const txBob = await borrowerOperations.repayCLV(mv._10e18, bob, bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Carol with no active trove attempts to repayCLV
    try {
      const txCarol = await borrowerOperations.repayCLV(mv._10e18, carol, carol, { from: carol })
      assert.fail(txCarol)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("repayCLV(): reverts when attempted repayment is > the debt of the trove", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, alice, { from: alice })
    await borrowerOperations.withdrawCLV(mv._100e18, bob, bob, { from: bob })

    // Bob successfully repays some CLV
    const txBob = await borrowerOperations.repayCLV(mv._10e18, bob, bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Alice attempts to repay more than her debt
    try {
      const txAlice = await borrowerOperations.repayCLV('101000000000000000000', alice, alice, { from: alice })
      assert.fail(txAlice)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })



  //repayCLV: reduces CLV debt in CDP
  it("repayCLV(): reduces the CDP's CLV debt by the correct amount", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })

    // check before
    await borrowerOperations.withdrawCLV(100, alice, alice, { from: alice })
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 100)

    await borrowerOperations.repayCLV(100, alice, alice, { from: alice })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, 0)
  })

  it("repayCLV(): decreases CLV debt in ActivePool by correct amount", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })

    //check before
    await borrowerOperations.withdrawCLV(100, alice, alice, { from: alice })
    const activePool_CLV_Before = await activePool.getCLVDebt()
    assert.equal(activePool_CLV_Before, 100)

    await borrowerOperations.repayCLV(100, alice, alice, { from: alice })

    // check after
    activePool_CLV_After = await activePool.getCLVDebt()
    assert.equal(activePool_CLV_After, 0)
  })

  it("repayCLV(): decreases user CLVToken balance by correct amount", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })

    // check before
    await borrowerOperations.withdrawCLV(100, alice, alice, { from: alice })
    const alice_CLVTokenBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_Before, 100)

    await borrowerOperations.repayCLV(100, alice, alice, { from: alice })

    // check after
    const alice_CLVTokenBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_After, 0)
  })

  it("repayCLV(): re-inserts trove to it's current size list", async () => {
    // A, B open troves
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._11_Ether }) // >1e19 wei, therefore in sizeRange 19

    // Check size lists before
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_19orGreater.contains(bob))

    // A, B each repay CLV
    await borrowerOperations.repayCLV(mv._100e18, alice, alice, { from: alice }) 
    await borrowerOperations.repayCLV('17', bob, bob, { from: bob }) 

    // Check size lists after
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_19orGreater.contains(bob))
  })

  it("repayCLV(): trove remains in the same size range array", async () => {
    // A, B open troves
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._11_Ether }) // >1e19 wei, therefore in sizeRange 19

    // Check size arrays before
    const sizeRangeArray18_element0_Before = await cdpManager.rangeToSizeArray(18, 0)
    const sizeRangeArray19_element0_Before = await cdpManager.rangeToSizeArray(19, 0)

    assert.equal(sizeRangeArray18_element0_Before, alice)
    assert.equal(sizeRangeArray19_element0_Before, bob)

   // A, B each repay CLV
   await borrowerOperations.repayCLV(mv._100e18, alice, alice, { from: alice }) 
   await borrowerOperations.repayCLV('17', bob, bob, { from: bob })

    // Check size arrays after
    const sizeRangeArray18_element0_After = await cdpManager.rangeToSizeArray(18, 0)
    const sizeRangeArray19_element0_After = await cdpManager.rangeToSizeArray(19, 0)

    assert.equal(sizeRangeArray18_element0_After, alice)
    assert.equal(sizeRangeArray19_element0_After, bob)
  })

  it("repayCLV(): trove retains the same sizeRange property", async () => {
    // A, B open troves
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._11_Ether }) // >1e19 wei, therefore in sizeRange 19

    // Check sizeRange properties before
    const A_sizeRange_Before = (await cdpManager.CDPs(alice))[6].toString()
    const B_sizeRange_Before = (await cdpManager.CDPs(bob))[6].toString()

    assert.equal(A_sizeRange_Before, '18')
    assert.equal(B_sizeRange_Before, '19')

    // A, B each repay CLV
    await borrowerOperations.repayCLV(mv._100e18, alice, alice, { from: alice }) 
    await borrowerOperations.repayCLV('17', bob, bob, { from: bob })

    // Check sizeRange properties after
    const A_sizeRange_After = (await cdpManager.CDPs(alice))[6]
    const B_sizeRange_After = (await cdpManager.CDPs(bob))[6]

    assert.equal(A_sizeRange_After, '18')
    assert.equal(B_sizeRange_After, '19')
  })

  // --- adjustLoan() ---

  it("adjustLoan(): reverts when calling address has no active trove", async () => {
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })

    // Alice coll and debt increase(+1 ETH, +50CLV)
    await borrowerOperations.adjustLoan(0, mv._50e18, alice, alice, { from: alice, value: mv._1_Ether })

    try {
      const txCarol = await borrowerOperations.adjustLoan(0, mv._50e18, carol, carol, { from: carol, carol, value: mv._1_Ether })
      assert.fail(txCarol)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustLoan(): reverts when system is in Recovery Mode", async () => {
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })

    assert.isFalse(await cdpManager.checkRecoveryMode())

    const txAlice = await borrowerOperations.adjustLoan(0, mv._50e18, alice, alice, { from: alice, value: mv._1_Ether })
    assert.isTrue(txAlice.receipt.status)

    await priceFeed.setPrice(mv._100e18)

    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check operation impossible when system is in Recovery Mode
    try {
      const txBob = await borrowerOperations.adjustLoan(0, mv._50e18, bob, bob, { from: bob, value: mv._1_Ether })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustLoan(): reverts when change would cause the TCR of the system to fall below the CCR", async () => {
    await priceFeed.setPrice(mv._100e18)

    await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, bob, { from: bob, value: mv._3_Ether })

    // Check TCR and Recovery Mode
    const TCR = (await poolManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Bob attempts an operation that would bring the TCR below the CCR
    try {
      const txBob = await borrowerOperations.adjustLoan(0, mv._1e18, bob, bob, { from: bob })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustLoan(): reverts when CLV repaid is > debt of the trove", async () => {
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, carol, value: mv._1_Ether })

    // Check Bob can make an adjustment that fully repays his debt
    const txBob = await borrowerOperations.adjustLoan(0, mv.negative_100e18, bob, bob, { from: bob, value: mv._1_Ether })
    assert.isTrue(txBob.receipt.status)

    // Carol attempts an adjustment that would repay more than her debt
    try {
      const txCarol = await borrowerOperations.adjustLoan(0, mv.negative_101e18, carol, carol, { from: carol })
      assert.fail(txCarol)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustLoan(): reverts when attempted ETH withdrawal is > the trove's collateral", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, carol, carol, { from: carol, carol, value: mv._1_Ether })

    // Check Bob can make an adjustment that fully withdraws his ETH
    const txBob = await borrowerOperations.adjustLoan(mv._1_Ether, 0, bob, bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Carol attempts an adjustment that would withdraw more than her ETH
    try {
      const txCarol = await borrowerOperations.adjustLoan('1000000000000000001', 0, carol, carol, { from: carol })
      assert.fail(txCarol)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustLoan(): reverts when ETH is withdrawn and the remaining collateral in the loan is non-zero but value < $20 USD", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, carol, carol, { from: carol, carol, value: mv._1_Ether })

    // Check Bob can make an adjustment that leaves $20 USD worth of ETH in his trove.
    // 1ETH = 200 USD.  Bob withdraws 0.9 ETH, leaving (0.1 * 200) = 20 USD worth of ETH.
    const txBob = await borrowerOperations.adjustLoan('900000000000000000', mv._1e18, bob, bob, { from: bob })
    assert.isTrue(txBob.receipt.status)

    // Carol attempts an adjustment that leaves < $20 USD worth of ETH in her trove.
    // 1ETH = 200 USD. Carol tries to withdraw 0.91 ETH, leaving (0.09 * 200) = 18 USD worth of ETH.
    try {
      const txCarol = await borrowerOperations.adjustLoan('910000000000000000', mv._1e18, carol, carol, { from: carol })
      assert.fail(txCarol)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })


  it("adjustLoan(): reverts when change would cause the ICR of the loan to fall below the MCR", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    await priceFeed.setPrice(mv._100e18)

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._2_Ether })

    // Alice decreases coll by 1 ETH and increass debt by 100 CLV. 
    // New ICR would be: ((2+1) * 100) / (100 + 100) = 300/200 = 150%, 
    const txAlice = await borrowerOperations.adjustLoan(0, mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
    assert.isTrue(txAlice.receipt.status)

    // Bob attempts to decrease coll  by 1 ETH and increase debt by 200 CLV. 
    // New ICR would be: ((2+1) * 100) / (100 + 200) = 300/300 = 100%, below the MCR.
    try {
      const txBob = await borrowerOperations.adjustLoan(0, mv._200e18, bob, bob, { from: bob, value: mv._1_Ether })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("adjustLoan(): With 0 coll change, doesnt change borrower's coll or ActivePool coll", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._10_Ether })

    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()
    const activePoolCollBefore = (await activePool.getETH()).toString()

    assert.equal(collBefore, mv._10_Ether)
    assert.equal(activePoolCollBefore, '110000000000000000000')

    // Alice adjusts loan. No coll change, and a debt increase (+50CLV)
    await borrowerOperations.adjustLoan(0, mv._50e18, alice, alice, { from: alice, value: 0 })

    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()
    const activePoolCollAfter = (await activePool.getETH()).toString()

    assert.equal(collAfter, collBefore)
    assert.equal(activePoolCollAfter, activePoolCollBefore)
  })

  it("adjustLoan(): With 0 debt change, doesnt change borrower's debt or ActivePool debt", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._10_Ether })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const activePoolDebtBefore = (await activePool.getCLVDebt()).toString()

    assert.equal(debtBefore, mv._100e18)
    assert.equal(activePoolDebtBefore, mv._100e18)

    // Alice adjusts loan. No coll change, and a debt increase (+50CLV)
    await borrowerOperations.adjustLoan(0, 0, alice, alice, { from: alice, value: mv._1_Ether })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()
    const activePoolDebtAfter = (await activePool.getCLVDebt()).toString()

    assert.equal(debtAfter, debtBefore)
    assert.equal(activePoolDebtAfter, activePoolDebtBefore)
  })

  it("adjustLoan(): updates borrower's debt and coll with an increase in both", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtBefore, mv._100e18)
    assert.equal(collBefore, mv._1_Ether)

    // Alice adjusts loan. Coll and debt increase(+1 ETH, +50CLV)
    await borrowerOperations.adjustLoan(0, mv._50e18, alice, alice, { from: alice, value: mv._1_Ether })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtAfter, mv._150e18)
    assert.equal(collAfter, mv._2_Ether)
  })


  it("adjustLoan(): updates borrower's debt and coll with a decrease in both", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtBefore, mv._100e18)
    assert.equal(collBefore, mv._1_Ether)

    // Alice adjusts loan coll and debt decrease (-0.5 ETH, -50CLV)
    await borrowerOperations.adjustLoan(mv._0pt5_Ether, mv.negative_50e18, alice, alice, { from: alice })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtAfter, mv._50e18)
    assert.equal(collAfter, mv._0pt5_Ether)
  })

  it("adjustLoan(): updates borrower's  debt and coll with coll increase, debt decrease", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtBefore, mv._100e18)
    assert.equal(collBefore, mv._1_Ether)

    // Alice adjusts loan - coll increase and debt decrease (+0.5 ETH, -50CLV)
    await borrowerOperations.adjustLoan(0, mv.negative_50e18, alice, alice, { from: alice, value: mv._0pt5_Ether })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtAfter, mv._50e18)
    assert.equal(collAfter, mv._1pt5_Ether)
  })


  it("adjustLoan(): updates borrower's debt and coll with coll decrease, debt increase", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtBefore, mv._100e18)
    assert.equal(collBefore, mv._1_Ether)

    // Alice adjusts loan - coll decrease and debt increase (0.1 ETH, 10CLV)
    await borrowerOperations.adjustLoan('100000000000000000', mv._10e18, alice, alice, { from: alice })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtAfter, mv._110e18)
    assert.equal(collAfter, '900000000000000000')
  })

  it("adjustLoan(): updates borrower's stake and totalStakes with a coll increase", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })

    const stakeBefore = ((await cdpManager.CDPs(alice))[2]).toString()
    const totalStakesBefore = await cdpManager.totalStakes();

    assert.equal(stakeBefore, mv._1_Ether)
    assert.equal(totalStakesBefore, '101000000000000000000')

    // Alice adjusts loan - coll and debt increase (+1 ETH, +50 CLV)
    await borrowerOperations.adjustLoan(0, mv._50e18, alice, alice, { from: alice, value: mv._1_Ether })

    const stakeAfter = ((await cdpManager.CDPs(alice))[2]).toString()
    const totalStakesAfter = await cdpManager.totalStakes();

    assert.equal(stakeAfter, mv._2_Ether)
    assert.equal(totalStakesAfter, '102000000000000000000')
  })

  it("adjustLoan():  updates borrower's stake and totalStakes with a coll decrease", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })

    const stakeBefore = ((await cdpManager.CDPs(alice))[2]).toString()
    const totalStakesBefore = await cdpManager.totalStakes();

    assert.equal(stakeBefore, mv._1_Ether)
    assert.equal(totalStakesBefore, '101000000000000000000')

    // Alice adjusts loan - coll decrease and debt decrease
    await borrowerOperations.adjustLoan(mv._0pt5_Ether, mv.negative_50e18, alice, alice, { from: alice })

    const stakeAfter = ((await cdpManager.CDPs(alice))[2]).toString()
    const totalStakesAfter = await cdpManager.totalStakes();

    assert.equal(stakeAfter, '500000000000000000')
    assert.equal(totalStakesAfter, '100500000000000000000')
  })

  it("adjustLoan(): changes CLVToken balance by the requested decrease", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })

    const alice_CLVTokenBalance_Before = (await clvToken.balanceOf(alice)).toString()
    assert.equal(alice_CLVTokenBalance_Before, mv._100e18)

    // Alice adjusts loan - coll decrease and debt decrease
    await borrowerOperations.adjustLoan(mv._1e17, mv.negative_10e18, alice, alice, { from: alice })

    // check after
    const alice_CLVTokenBalance_After = (await clvToken.balanceOf(alice)).toString()
    assert.equal(alice_CLVTokenBalance_After, mv._90e18)
  })

  it("adjustLoan(): changes CLVToken balance by the requested increase", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })

    const alice_CLVTokenBalance_Before = (await clvToken.balanceOf(alice)).toString()
    assert.equal(alice_CLVTokenBalance_Before, mv._100e18)

    // Alice adjusts loan - coll increase and debt increase
    await borrowerOperations.adjustLoan(0, mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })

    // check after
    const alice_CLVTokenBalance_After = (await clvToken.balanceOf(alice)).toString()
    assert.equal(alice_CLVTokenBalance_After, mv._200e18)
  })

  it("adjustLoan(): Changes the activePool ETH and raw ether balance by the requested decrease", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })

    const activePool_ETH_Before = (await activePool.getETH()).toString()
    const activePool_RawEther_Before = (await web3.eth.getBalance(activePool.address)).toString()
    assert.equal(activePool_ETH_Before, '101000000000000000000')
    assert.equal(activePool_RawEther_Before, '101000000000000000000')

    // Alice adjusts loan - coll decrease and debt decrease
    await borrowerOperations.adjustLoan(mv._1e17, mv.negative_10e18, alice, alice, { from: alice })

    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, '100900000000000000000')
    assert.equal(activePool_RawEther_After, '100900000000000000000')
  })

  it("adjustLoan(): Changes the activePool ETH and raw ether balance by the amount of ETH sent", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })

    const activePool_ETH_Before = (await activePool.getETH()).toString()
    const activePool_RawEther_Before = (await web3.eth.getBalance(activePool.address)).toString()
    assert.equal(activePool_ETH_Before, '101000000000000000000')
    assert.equal(activePool_RawEther_Before, '101000000000000000000')

    // Alice adjusts loan - coll increase and debt increase
    await borrowerOperations.adjustLoan(0, mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })

    const activePool_ETH_After = (await activePool.getETH()).toString()
    const activePool_RawEther_After = (await web3.eth.getBalance(activePool.address)).toString()
    assert.equal(activePool_ETH_After, '102000000000000000000')
    assert.equal(activePool_RawEther_After, '102000000000000000000')
  })

  it("adjustLoan(): Changes the CLV debt in ActivePool by requested decrease", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: _1_Ether })

    const activePool_CLVDebt_Before = (await activePool.getCLVDebt()).toString()
    assert.equal(activePool_CLVDebt_Before, mv._100e18)

    // Alice adjusts loan - coll increase and debt increase
    await borrowerOperations.adjustLoan(0, mv.negative_50e18, alice, alice, { from: alice, value: mv._1_Ether })

    const activePool_CLVDebt_After = (await activePool.getCLVDebt()).toString()
    assert.equal(activePool_CLVDebt_After, mv._50e18)
  })

  it("adjustLoan():Changes the CLV debt in ActivePool by requested increase", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: _1_Ether })

    const activePool_CLVDebt_Before = (await activePool.getCLVDebt()).toString()
    assert.equal(activePool_CLVDebt_Before, mv._100e18)

    // Alice adjusts loan - coll increase and debt increase
    await borrowerOperations.adjustLoan(0, mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })

    const activePool_CLVDebt_After = (await activePool.getCLVDebt()).toString()
    assert.equal(activePool_CLVDebt_After, mv._200e18)
  })

  it("adjustLoan(): Closes the CDP if  new coll = 0 and new debt = 0", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: _1_Ether })

    const status_Before = (await cdpManager.CDPs(alice))[3]
    const isInSortedList_Before = await sortedCDPs.contains(alice)

    assert.equal(status_Before, 1)  // 1: Active
    assert.isTrue(isInSortedList_Before)

    await borrowerOperations.adjustLoan(mv._1_Ether, mv.negative_100e18, alice, alice, { from: alice })

    const status_After = (await cdpManager.CDPs(alice))[3]
    const isInSortedList_After = await sortedCDPs.contains(alice)

    assert.equal(status_After, 2) //2: Closed
    assert.isFalse(isInSortedList_After)
  })


  it("adjustLoan():  Deposits the received ether in the trove and ignores requested coll withdrawal if ether is sent", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: _1_Ether })

    const aliceColl_Before = (await cdpManager.CDPs(alice))[1].toString()
    assert.equal(aliceColl_Before, mv._1_Ether)

    await borrowerOperations.adjustLoan(mv._1_Ether, mv._100e18, alice, alice, { from: alice, value: mv._3_Ether })

    const aliceColl_After = (await cdpManager.CDPs(alice))[1].toString()
    assert.equal(aliceColl_After, mv._4_Ether)
  })

  // --- No size range transition ---

  it("adjustLoan(): re-inserts trove to it's current size list when new collateral is in the same size range", async () => {
    // A, B, C, D open troves
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei -- in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._10_Ether }) // >1e19 wei -- in sizeRange 19
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._1_Ether }) // <1e19 wei -- in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, dennis, dennis, { from: dennis, value: mv._11_Ether }) // >1e19 wei -- in sizeRange 19

    // Check size lists before
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_19orGreater.contains(bob))
    assert.isTrue(await sizeList_18orLess.contains(carol))
    assert.isTrue(await sizeList_19orGreater.contains(dennis))

    // --- Users adjust loans  ---
    // A, B adjust collateral up, without changing their collateral size range
    await borrowerOperations.adjustLoan(0, mv._50e18, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.adjustLoan(0, mv._50e18, bob, bob, { from: bob, value: mv._1_Ether })

    // B, C adjust collateral down, without chaning their collateral size range 
    await borrowerOperations.adjustLoan(mv._1e17, 0, carol, carol, { from: carol })
    await borrowerOperations.adjustLoan(mv._1_Ether, 0, dennis, dennis, { from: dennis })

    // Check size lists after
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_19orGreater.contains(bob))
    assert.isTrue(await sizeList_18orLess.contains(carol))
    assert.isTrue(await sizeList_19orGreater.contains(dennis))
  })

  it("adjustLoan(): trove remains in the same size range array when new collateral is in the same size range", async () => {
    // A, B, C, D open troves
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei -- in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._10_Ether }) // >1e19 wei -- in sizeRange 19
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._1_Ether }) // <1e19 wei -- in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, dennis, dennis, { from: dennis, value: mv._11_Ether }) // >1e19 wei -- in sizeRange 19

    // Check size arrays before
    const sizeRangeArray18_element0_Before = await cdpManager.rangeToSizeArray(18, 0)
    const sizeRangeArray18_element1_Before = await cdpManager.rangeToSizeArray(18, 1)
    const sizeRangeArray19_element0_Before = await cdpManager.rangeToSizeArray(19, 0)
    const sizeRangeArray19_element1_Before = await cdpManager.rangeToSizeArray(19, 1)

    assert.equal(sizeRangeArray18_element0_Before, alice)
    assert.equal(sizeRangeArray19_element0_Before, bob)
    assert.equal(sizeRangeArray18_element1_Before, carol)
    assert.equal(sizeRangeArray19_element1_Before, dennis)

    // --- Users adjust loans  ---
    // A, B adjust collateral up, without changing their collateral size range
    await borrowerOperations.adjustLoan(0, mv._50e18, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.adjustLoan(0, mv._50e18, bob, bob, { from: bob, value: mv._1_Ether })

    // B, C adjust collateral down, without chaning their collateral size range 
    await borrowerOperations.adjustLoan(mv._1e17, 0, carol, carol, { from: carol })
    await borrowerOperations.adjustLoan(mv._1_Ether, 0, dennis, dennis, { from: dennis })

    // Check size arrays after
    const sizeRangeArray18_element0_After = await cdpManager.rangeToSizeArray(18, 0)
    const sizeRangeArray18_element1_After = await cdpManager.rangeToSizeArray(18, 1)
    const sizeRangeArray19_element0_After = await cdpManager.rangeToSizeArray(19, 0)
    const sizeRangeArray19_element1_After = await cdpManager.rangeToSizeArray(19, 1)

    assert.equal(sizeRangeArray18_element0_After, alice)
    assert.equal(sizeRangeArray19_element0_After, bob)
    assert.equal(sizeRangeArray18_element1_After, carol)
    assert.equal(sizeRangeArray19_element1_After, dennis)
  })

  it("adjustLoan(): trove retains the same sizeRange property when new collateral is in the same size range", async () => {
    // A, B, C, D open troves
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei -- in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._10_Ether }) // >1e19 wei -- in sizeRange 19
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._1_Ether }) // <1e19 wei -- in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, dennis, dennis, { from: dennis, value: mv._11_Ether }) // >1e19 wei -- in sizeRange 19

    // Check sizeRange properties before
    const A_sizeRange_Before = (await cdpManager.CDPs(alice))[6].toString()
    const B_sizeRange_Before = (await cdpManager.CDPs(bob))[6].toString()
    const C_sizeRange_Before = (await cdpManager.CDPs(carol))[6].toString()
    const D_sizeRange_Before = (await cdpManager.CDPs(dennis))[6].toString()

    assert.equal(A_sizeRange_Before, '18')
    assert.equal(B_sizeRange_Before, '19')
    assert.equal(C_sizeRange_Before, '18')
    assert.equal(D_sizeRange_Before, '19')

    // --- Users adjust loans  ---
    // A, B adjust collateral up, without changing their collateral size range
    await borrowerOperations.adjustLoan(0, mv._50e18, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.adjustLoan(0, mv._50e18, bob, bob, { from: bob, value: mv._1_Ether })

    // B, C adjust collateral down, without chaning their collateral size range 
    await borrowerOperations.adjustLoan(mv._1e17, 0, carol, carol, { from: carol })
    await borrowerOperations.adjustLoan(mv._1_Ether, 0, dennis, dennis, { from: dennis })

    // Check sizeRange properties after
    const A_sizeRange_After = (await cdpManager.CDPs(alice))[6].toString()
    const B_sizeRange_After = (await cdpManager.CDPs(bob))[6].toString()
    const C_sizeRange_After = (await cdpManager.CDPs(carol))[6].toString()
    const D_sizeRange_After = (await cdpManager.CDPs(dennis))[6].toString()

    assert.equal(A_sizeRange_After, '18')
    assert.equal(B_sizeRange_After, '19')
    assert.equal(C_sizeRange_After, '18')
    assert.equal(D_sizeRange_After, '19')
  })

  // --- Transitions to new size range ---

  it("adjustLoan(): transitions trove between size lists when new collateral is in a greater size range", async () => {
    // A, B, C, D open troves
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei -- in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: '9999999999999999999' }) // <1e19 wei -- in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._10_Ether }) // >1e19 wei -- in sizeRange 19
    await borrowerOperations.openLoan(mv._100e18, dennis, dennis, { from: dennis, value: mv._11_Ether }) // >1e19 wei -- in sizeRange 19

    // Check size lists before
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_18orLess.contains(bob))
    assert.isTrue(await sizeList_19orGreater.contains(carol))
    assert.isTrue(await sizeList_19orGreater.contains(dennis))

    // --- Users adjust loans  ---
    // A, B adjust collateral up, moving up a collateral size range
    await borrowerOperations.adjustLoan(0, mv._50e18, alice, alice, { from: alice, value: mv._10_Ether })
    await borrowerOperations.adjustLoan(0, mv._50e18, bob, bob, { from: bob, value: '1' })

    // C, D, adjust collateral down, moving down a collateral size range
    await borrowerOperations.adjustLoan('1', 0, carol, carol, { from: carol })
    await borrowerOperations.adjustLoan(mv._5_Ether, 0, dennis, dennis, { from: dennis })

    // Check troves have been removed from their previous size list
    assert.isFalse(await sizeList_18orLess.contains(alice))
    assert.isFalse(await sizeList_18orLess.contains(bob))
    // assert.isFalse(await sizeList_19orGreater.contains(carol))
    assert.isFalse(await sizeList_19orGreater.contains(dennis))

    // Check troves have been added to the correct new size list
    assert.isTrue(await sizeList_19orGreater.contains(alice))
    assert.isTrue(await sizeList_19orGreater.contains(bob))
    assert.isTrue(await sizeList_18orLess.contains(carol))
    assert.isTrue(await sizeList_18orLess.contains(dennis))
  })

  it("adjustLoan(): removes trove address from current size range array and adds it to new size range array, when new collateral is in a greater size range", async () => {
    // A, B, C, D open troves
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei -- in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: '9999999999999999999' }) // <1e19 wei -- in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._10_Ether }) // >1e19 wei -- in sizeRange 19
    await borrowerOperations.openLoan(mv._100e18, dennis, dennis, { from: dennis, value: mv._11_Ether }) // >1e19 wei -- in sizeRange 19

    // check length of sizeArray 19 is 2, and length of sizeArray 18 is 2
    const length_sizeArray18_Before = await cdpManager.getSizeArrayCount(18)
    const length_sizeArray19_Before = await cdpManager.getSizeArrayCount(19)

    assert.equal(length_sizeArray18_Before, '2')
    assert.equal(length_sizeArray19_Before, '2')

    // check A, B are in size array 18
    const sizeArray18_element0_Before = await cdpManager.rangeToSizeArray(18, 0)
    const sizeArray18_element1_Before = await cdpManager.rangeToSizeArray(18, 1)

    assert.equal(sizeArray18_element0_Before, alice)
    assert.equal(sizeArray18_element1_Before, bob)

    // Check C, D are in size array 19
    const sizeArray19_element0_Before = await cdpManager.rangeToSizeArray(19, 0)
    const sizeArray19_element1_Before = await cdpManager.rangeToSizeArray(19, 1)

    assert.equal(sizeArray19_element0_Before, carol)
    assert.equal(sizeArray19_element1_Before, dennis)

    // --- Users adjust loans  ---
    // A, C adjust collateral up, moving up a collateral size range
    await borrowerOperations.adjustLoan(0, mv._50e18, alice, alice, { from: alice, value: mv._10_Ether })
    await borrowerOperations.adjustLoan(0, mv._50e18, bob, bob, { from: bob, value: '1' })

    // C, D, adjust collateral down, moving down a collateral size range
    await borrowerOperations.adjustLoan('1', 0, carol, carol, { from: carol })
    await borrowerOperations.adjustLoan(mv._5_Ether, 0, dennis, dennis, { from: dennis })

    // check A, B are in size array 19
    const sizeArray19_element0_After = await cdpManager.rangeToSizeArray(19, 0)
    const sizeArray19_element1_After = await cdpManager.rangeToSizeArray(19, 1)

    // Due to array re-ordering from delete operations, bob and alice end up in reverse order
    assert.equal(sizeArray19_element0_After, bob)
    assert.equal(sizeArray19_element1_After, alice)

    // Check C, D are in size array 18
    const sizeArray18_element0_After = await cdpManager.rangeToSizeArray(18, 0)
    const sizeArray18_element1_After = await cdpManager.rangeToSizeArray(18, 1)

    assert.equal(sizeArray18_element0_After, carol)
    assert.equal(sizeArray18_element1_After, dennis)
  })

  it("adjustLoan(): updates trove's sizeRange property when new collateral is in in a greater size range", async () => {
    // A, B, C, D open troves
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei -- in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: '9999999999999999999' }) // <1e19 wei -- in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._10_Ether }) // >1e19 wei -- in sizeRange 19
    await borrowerOperations.openLoan(mv._100e18, dennis, dennis, { from: dennis, value: mv._11_Ether }) // >1e19 wei -- in sizeRange 19

    // Check sizeRange properties before
    const A_sizeRange_Before = (await cdpManager.CDPs(alice))[6].toString()
    const B_sizeRange_Before = (await cdpManager.CDPs(bob))[6].toString()
    const C_sizeRange_Before = (await cdpManager.CDPs(carol))[6].toString()
    const D_sizeRange_Before = (await cdpManager.CDPs(dennis))[6].toString()

    assert.equal(A_sizeRange_Before, '18')
    assert.equal(B_sizeRange_Before, '18')
    assert.equal(C_sizeRange_Before, '19')
    assert.equal(D_sizeRange_Before, '19')

    // --- Users adjust loans  ---
    // A, C adjust collateral up, moving up a collateral size range
    await borrowerOperations.adjustLoan(0, mv._50e18, alice, alice, { from: alice, value: mv._10_Ether })
    await borrowerOperations.adjustLoan(0, mv._50e18, bob, bob, { from: bob, value: '1' })

    // C, D, adjust collateral down, moving down a collateral size range
    await borrowerOperations.adjustLoan('1', 0, carol, carol, { from: carol })
    await borrowerOperations.adjustLoan(mv._5_Ether, 0, dennis, dennis, { from: dennis })

    // Check sizerange properties after: expect A, B have moved up, C, D have moved down
    const A_sizeRange_After = (await cdpManager.CDPs(alice))[6].toString()
    const B_sizeRange_After = (await cdpManager.CDPs(bob))[6].toString()
    const C_sizeRange_After = (await cdpManager.CDPs(carol))[6].toString()
    const D_sizeRange_After = (await cdpManager.CDPs(dennis))[6].toString()

    assert.equal(A_sizeRange_After, '19')
    assert.equal(B_sizeRange_After, '19')
    assert.equal(C_sizeRange_After, '18')
    assert.equal(D_sizeRange_After, '18')
  })

  // --- closeLoan() ---

  it("closeLoan(): reverts when calling address does not have active trove", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._1_Ether })

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
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: _1_Ether })
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, carol, value: _1_Ether })

    // check recovery mode 
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Bob successfully closes his loan
    const txBob = await borrowerOperations.closeLoan({ from: bob })
    assert.isTrue(txBob.receipt.status)

    await priceFeed.setPrice(mv._100e18)

    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Carol attempts to close her loan during Recovery Mode
    try {
      const txCarol = await borrowerOperations.closeLoan({ from: carol })
      assert.fail(txCarol)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("closeLoan(): reduces a CDP's collateral to zero", async () => {
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._10_Ether })
    // await borrowerOperations.withdrawCLV(mv._100e18, dennis, dennis, { from: dennis })

    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, alice, { from: alice })

    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()
    assert.equal(collBefore, _1_Ether)

    // Alice attempts to close loan
    await borrowerOperations.closeLoan({ from: alice })

    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()
    assert.equal(collAfter, '0')
    // check withdrawal was successful
  })

  it("closeLoan(): reduces a CDP's debt to zero", async () => {
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._10_Ether })

    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, alice, { from: alice })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    assert.equal(debtBefore, mv._100e18)

    // Alice attempts to close loan
    await borrowerOperations.closeLoan({ from: alice })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    assert.equal(debtAfter, '0')
    // check withdrawal was successful
  })

  it("closeLoan(): sets CDP's stake to zero", async () => {
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._10_Ether })

    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, alice, { from: alice })

    const stakeBefore = ((await cdpManager.CDPs(alice))[2]).toString()
    assert.equal(stakeBefore, _1_Ether)

    // Alice attempts to close loan
    await borrowerOperations.closeLoan({ from: alice })

    const stakeAfter = ((await cdpManager.CDPs(alice))[2]).toString()
    assert.equal(stakeAfter, '0')
    // check withdrawal was successful
  })

  it("closeLoan(): closes the CDP", async () => {
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._10_Ether })

    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, alice, { from: alice })

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
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._10_Ether })

    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, alice, { from: alice })

    // Check before
    const activePool_ETH_before = await activePool.getETH()
    const activePool_RawEther_before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_before, mv._11_Ether)
    assert.equal(activePool_RawEther_before, mv._11_Ether)

    // Close the loan
    await borrowerOperations.closeLoan({ from: alice })

    // Check after
    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, mv._10_Ether)
    assert.equal(activePool_RawEther_After, mv._10_Ether)
  })

  it("closeLoan(): reduces ActivePool debt by correct amount", async () => {
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._10_Ether })

    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, alice, { from: alice })

    // Check before
    const activePool_Debt_before = (await activePool.getETH()).toString()
    assert.equal(activePool_Debt_before, mv._11_Ether)

    // Close the loan
    await borrowerOperations.closeLoan({ from: alice })

    // Check after
    const activePool_Debt_After = (await activePool.getCLVDebt()).toString()
    assert.equal(activePool_Debt_After, 0)
  })

  it("closeLoan(): updates the the total stakes", async () => {
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._10_Ether })
    //  Alice creates initial CDP with 1 ether
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: _1_Ether })

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
    assert.equal(totalStakes_After, mv._11_Ether)
  })

  it("closeLoan(): sends the correct amount of ETH to the user", async () => {
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._10_Ether })
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })

    const alice_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))
    await borrowerOperations.closeLoan({ from: alice, gasPrice: 0 })

    const alice_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(alice))
    const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

    assert.equal(balanceDiff, _1_Ether)
  })

  it("closeLoan(): subtracts the debt of the closed CDP from the Borrower's CLVToken balance", async () => {
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._10_Ether })

    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, alice, { from: alice })

    const alice_CLVBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVBalance_Before, mv._100e18)

    // close loan
    await borrowerOperations.closeLoan({ from: alice })

    //   // check alive CLV balance after

    const alice_CLVBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVBalance_After, 0)
  })

  it("closeLoan(): applies pending rewards and updates user's L_ETH, L_CLVDebt snapshots", async () => {
    // --- SETUP ---
    // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _15_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: _5_Ether })
    await borrowerOperations.openLoan(0, carol, carol, { from: carol, carol, value: _1_Ether })

    // Alice and Bob withdraw 100CLV, Carol withdraws 180CLV
    await borrowerOperations.withdrawCLV('100000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawCLV('100000000000000000000', bob, bob, { from: bob })
    await borrowerOperations.withdrawCLV('180000000000000000000', carol, carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');
    const price = await priceFeed.getPrice()

    // close Carol's CDP, liquidating her 1 ether and 180CLV. Alice and Bob earn rewards.
    await cdpManager.liquidate(carol, { from: owner });

    // Dennis opens a new CDP with 10 Ether, withdraws CLV and sends 135 CLV to Alice, and 45 CLV to Bob.

    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._100_Ether })
    await borrowerOperations.withdrawCLV(mv._200e18, dennis, dennis, { from: dennis })
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

    /* Check that system rewards-per-unit-staked are correct. When Carol defaulted, 
    the reward-per-unit-staked due to her CDP liquidation was (1/20) = 0.05 ETH and (180/20) = 9 CLV Debt. */
    const L_ETH = await cdpManager.L_ETH()
    const L_CLVDebt = await cdpManager.L_CLVDebt()

    assert.isAtMost(th.getDifference(L_ETH, '50000000000000000'), 100)
    assert.isAtMost(th.getDifference(L_CLVDebt, '9000000000000000000'), 100)

    const defaultPool_ETH = await defaultPool.getETH()
    const defaultPool_CLVDebt = await defaultPool.getCLVDebt()

    // Carol's liquidated coll (1 ETH) and debt (180 CLV) should have entered the Default Pool
    assert.isAtMost(th.getDifference(defaultPool_ETH, _1_Ether), 100)
    assert.isAtMost(th.getDifference(defaultPool_CLVDebt, mv._180e18), 100)

    /* Close Alice's loan.
    
    Alice, with a stake of 15 ether, should have earned (15 * 1/20)  = 0.75 ETH, and (15 *180/20) = 135 CLV Debt.
    These rewards are applied when she closes her loan. 
    
    Default Pool coll should be (1-0.75) = 0.25 ETH, and DefaultPool debt should be (180-135) = 45 CLV.
    // check L_ETH and L_CLV reduce by Alice's reward */
    await borrowerOperations.closeLoan({ from: alice })

    const defaultPool_ETH_afterAliceCloses = await defaultPool.getETH()
    const defaultPool_CLVDebt_afterAliceCloses = await defaultPool.getCLVDebt()

    assert.isAtMost(th.getDifference(defaultPool_ETH_afterAliceCloses, 250000000000000000), 100)
    assert.isAtMost(th.getDifference(defaultPool_CLVDebt_afterAliceCloses, 45000000000000000000), 100)

    /* Close Bob's loan.

    Bob, with a stake of 5 ether, should have earned (5 * 1/20)  = 0.25 ETH, and (5 *180/20) = 45 CLV.
    DefaultPool coll should reduce by 0.25 ETH to 0, and DefaultPool debt should reduce by 45, to 0. */

    await borrowerOperations.closeLoan({ from: bob })

    const defaultPool_ETH_afterBobCloses = await defaultPool.getETH()
    const defaultPool_CLVDebt_afterBobCloses = await defaultPool.getCLVDebt()

    assert.isAtMost(th.getDifference(defaultPool_ETH_afterBobCloses, 0), 100)
    assert.isAtMost(th.getDifference(defaultPool_CLVDebt_afterBobCloses, 0), 100)
  })

  it("closeLoan(): removes trove from its size list", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._1000_Ether })
    
    // A, B open troves
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._11_Ether }) // >1e19 wei, therefore in sizeRange 19

    // Check size lists before
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_19orGreater.contains(bob))

    // Close A, B
    await borrowerOperations.closeLoan({from: alice})
    await borrowerOperations.closeLoan({from: bob})

    // Check size lists after
    assert.isFalse(await sizeList_18orLess.contains(alice))
    assert.isFalse(await sizeList_19orGreater.contains(bob))
  })

  it("closeLoan(): removes trove from its size range array", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._1000_Ether })

    // A, B, C open troves
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._11_Ether }) // >1e19 wei, therefore in sizeRange 19
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._1_Ether }) // <1e19 wei

    //Check size array lengths before
    const length_sizeRangeArray18_Before = (await cdpManager.getSizeArrayCount(18)).toString()
    const length_sizeRangeArray19_Before = (await cdpManager.getSizeArrayCount(19)).toString()

    assert.equal(length_sizeRangeArray18_Before, '2')
    assert.equal(length_sizeRangeArray19_Before, '2')

    // Check size arrays before
    const sizeRangeArray18_element0_Before = await cdpManager.rangeToSizeArray(18, 0)
    const sizeRangeArray19_element0_Before = await cdpManager.rangeToSizeArray(19, 0)
    const sizeRangeArray19_element1_Before = await cdpManager.rangeToSizeArray(19, 1)

    assert.equal(sizeRangeArray18_element0_Before, alice)
    assert.equal(sizeRangeArray19_element0_Before, whale)
    assert.equal(sizeRangeArray19_element1_Before, bob)

    // Close A, B
    await borrowerOperations.closeLoan({from: alice})
    await borrowerOperations.closeLoan({from: bob})

    // Check size array lengths after
    const length_sizeRangeArray18_After = await cdpManager.getSizeArrayCount(18)
    const length_sizeRangeArray19_After = await cdpManager.getSizeArrayCount(19)

    assert.equal(length_sizeRangeArray18_After, '1')
    assert.equal(length_sizeRangeArray19_After, '1')

    // Check size arrays after
    const sizeRangeArray18_element0_After = await cdpManager.rangeToSizeArray(18, 0)
    const sizeRangeArray19_element0_After = await cdpManager.rangeToSizeArray(19, 0)

    assert.equal(sizeRangeArray18_element0_After, carol)
    assert.equal(sizeRangeArray19_element0_After, whale)
  })

  it("closeLoan(): removes the trove's sizeRange property and recorded size array index", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._1000_Ether })
    
    // A, B open troves
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether }) // <1e19 wei, therefore in sizeRange 18
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._11_Ether }) // >1e19 wei, therefore in sizeRange 19

    // Check sizeRange properties before
    const A_sizeRange_Before = (await cdpManager.CDPs(alice))[6].toString()
    const B_sizeRange_Before = (await cdpManager.CDPs(bob))[6].toString()

    assert.equal(A_sizeRange_Before, '18')
    assert.equal(B_sizeRange_Before, '19')

    // Check trove's recorded size array index before
    const A_sizeArrayIndex_Before = (await cdpManager.CDPs(alice))[5].toString()
    const B_sizeArrayIndex_Before = (await cdpManager.CDPs(bob))[5].toString()

    assert.equal(A_sizeArrayIndex_Before, '0')
    assert.equal(B_sizeArrayIndex_Before, '1')
   

   // closeLoan
   // Close A, B
   await borrowerOperations.closeLoan({from: alice})
   await borrowerOperations.closeLoan({from: bob})

    // Check sizeRange properties after
    const A_sizeRange_After = (await cdpManager.CDPs(alice))[6]
    const B_sizeRange_After = (await cdpManager.CDPs(bob))[6]

    assert.equal(A_sizeRange_After, '0')
    assert.equal(B_sizeRange_After, '0')

    // Check trove's recorded size array index after
    const A_sizeArrayIndex_After = (await cdpManager.CDPs(alice))[5].toString()
    const B_sizeArrayIndex_After = (await cdpManager.CDPs(bob))[5].toString()

    assert.equal(A_sizeArrayIndex_After, '0')
    assert.equal(B_sizeArrayIndex_After, '0')
  })

  // --- openLoan() ---

  it("openLoan(): reverts when system is in Recovery Mode", async () => {

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })

    assert.isFalse(await cdpManager.checkRecoveryMode())

    // price drops, and recovery mode kicks in
    await priceFeed.setPrice(mv._100e18)

    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Bob tries to open a loan with same coll and debt, during Recovery Mode
    try {
      const txBob = await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("openLoan(): reverts when loan ICR < MCR", async () => {
    const txAlice = await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
    const price = await priceFeed.getPrice()
    const aliceICR = await cdpManager.getCurrentICR(alice, price)

    assert.isTrue(txAlice.receipt.status)
    assert.isTrue(aliceICR.gte(web3.utils.toBN('110000000000000000')))

    // Bob attempts to open a loan with coll = 1 ETH, debt = 182 CLV. At ETH:USD price = 200, his ICR = 1 * 200 / 182 =   109.8%.
    try {
      const txBob = await borrowerOperations.openLoan('182000000000000000000', bob, bob, { from: bob, value: mv._1_Ether })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("openLoan(): reverts when opening the loan causes the TCR of the system to fall below the CCR", async () => {
    await priceFeed.setPrice(mv._100e18)

    // Alice creates trove with 3 ETH / 200 CLV, and 150% ICR.  System TCR = 150%.
    const txAlice = await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._3_Ether })
    const price = await priceFeed.getPrice()
    const aliceICR = await cdpManager.getCurrentICR(alice, price)

    assert.isTrue(txAlice.receipt.status)
    assert.isTrue(aliceICR.eq(web3.utils.toBN('1500000000000000000')))

    // Bob attempts to open a loan with coll = 1 ETH, debt = 201 CLV. At ETH:USD price = 1, his ICR = 300 / 201 =   149.25%`

    // System TCR would be: ((3+3) * 100 ) / (200+201) = 600/401 = 149.62%, i.e. below CCR of 150%.
    try {
      const txBob = await borrowerOperations.openLoan('201000000000000000000', bob, bob, { from: bob, value: mv._3_Ether })
      assert.fail(txBob)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("openLoan(): reverts if withdrawal would pull TCR below CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._3_Ether })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, bob, { from: bob })

    const TCR = (await poolManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // Carol attempts to open a loan, which would reduce TCR to below 150%
    try {
      const txData = await borrowerOperations.openLoan('180000000000000000000', carol, carol, { from: carol, carol, value: _1_Ether })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("openLoan(): with non-zero debt, reverts when system is in recovery mode", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._3_Ether })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, bob, { from: bob })

    const TCR = (await poolManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // price drops to 1ETH:150CLV, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000');

    try {
      const txData = await borrowerOperations.openLoan('50000000000000000000', carol, carol, { from: carol, carol, value: mv._1_Ether })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("openLoan(): reverts if trove is already active", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._10_Ether })

    await borrowerOperations.openLoan(mv._50e18, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._50e18, bob, bob, { from: bob, value: mv._1_Ether })

    try {
      const txB_1 = await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })
      assert.isFalse(txB_1.receipt.status)
    } catch (err) {
      assert.include(err.message, 'revert')
    }

    try {
      const txB_2 = await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._1_Ether })
      assert.isFalse(txB_2.receipt.status)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })



  it("openLoan(): Can open a loan with zero debt when system is in recovery mode", async () => {
    // --- SETUP ---
    //  Alice and Bob add coll and withdraw such  that the TCR is ~150%
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._3_Ether })
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, bob, { from: bob })

    const TCR = (await poolManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000');

    assert.isTrue(await cdpManager.checkRecoveryMode())

    const txCarol = await borrowerOperations.openLoan('0', carol, carol, { from: carol, carol, value: mv._1_Ether })
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

    await borrowerOperations.openLoan('50000000000000000000', alice, alice, { from: alice, value: _1_Ether })

    const alice_CDP_After = await cdpManager.CDPs(alice)

    const debt_After = alice_CDP_After[0].toString()
    const coll_After = alice_CDP_After[1]
    const status_After = alice_CDP_After[3]

    // check coll and debt after
    assert.equal(debt_After, '50000000000000000000')
    assert.equal(coll_After, _1_Ether)

    // check active status
    assert.equal(status_After, 1)
  })

  it("openLoan(): adds CDP owner to CDPOwners array", async () => {
    const CDPOwnersCount_Before = (await cdpManager.getallTrovesArrayCount()).toString();
    assert.equal(CDPOwnersCount_Before, '0')

    await borrowerOperations.openLoan('50000000000000000000', alice, alice, { from: alice, value: _1_Ether })

    const CDPOwnersCount_After = (await cdpManager.getallTrovesArrayCount()).toString();
    assert.equal(CDPOwnersCount_After, '1')
  })

  it("openLoan(): creates a stake and adds it to total stakes", async () => {
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '0')
    assert.equal(totalStakes_Before, '0')

    await borrowerOperations.openLoan('50000000000000000000', alice, alice, { from: alice, value: _1_Ether })

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

    await borrowerOperations.openLoan('50000000000000000000', alice, alice, { from: alice, value: _1_Ether })

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

    await borrowerOperations.openLoan('50000000000000000000', alice, alice, { from: alice, value: _1_Ether })

    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, _1_Ether)
    assert.equal(activePool_RawEther_After, _1_Ether)
  })

  it("openLoan(): records up-to-date initial snapshots of L_ETH and L_CLVDebt", async () => {
    // --- SETUP ---
    /* Alice adds 10 ether
    Carol adds 1 ether */
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._10_Ether })
    await borrowerOperations.openLoan(0, carol, carol, { from: carol, carol, value: _1_Ether })

    // Alice withdraws 100CLV, Carol withdraws 180CLV
    await borrowerOperations.withdrawCLV('100000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawCLV('180000000000000000000', carol, carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Carol's CDP, liquidating her 1 ether and 180CLV.
    await cdpManager.liquidate(carol, { from: owner });

    /* with total stakes = 10 ether, after liquidation, L_ETH should equal 1/10 ether per-ether-staked,
     and L_CLV should equal 18 CLV per-ether-staked. */

    const L_ETH = await cdpManager.L_ETH()
    const L_CLV = await cdpManager.L_CLVDebt()

    assert.isAtMost(th.getDifference(L_ETH, '100000000000000000'), 100)
    assert.isAtMost(th.getDifference(L_CLV, '18000000000000000000'), 100)

    // Bob opens loan
    await borrowerOperations.openLoan('50000000000000000000', bob, bob, { from: bob, value: _1_Ether })

    // check Bob's snapshots of L_ETH and L_CLV equal the respective current values
    const bob_rewardSnapshot = await cdpManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot = bob_rewardSnapshot[0]
    const bob_CLVDebtRewardSnapshot = bob_rewardSnapshot[1]

    assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot, L_ETH), 100)
    assert.isAtMost(th.getDifference(bob_CLVDebtRewardSnapshot, L_CLV), 100)
  })

  it("openLoan(): reverts if user tries to open a new CDP with collateral of value < $20 USD", async () => {
    /* Alice adds 0.0999 ether. At a price of 200 USD per ETH, 
    her collateral value is < $20 USD.  So her tx should revert */
    const coll = '99999999999999999'

    try {
      const txData = await borrowerOperations.openLoan('50000000000000000000', alice, alice, { from: alice, value: coll })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "BorrowerOps: Collateral must have $USD value >= 20")
    }
  })

  it("openLoan(): allows a user to open a CDP, then close it, then re-open it", async () => {
    // Open CDP 
    await borrowerOperations.openLoan('50000000000000000000', alice, alice, { from: alice, value: _1_Ether })

    // Check CDP is active
    const alice_CDP_1 = await cdpManager.CDPs(alice)
    const status_1 = alice_CDP_1[3]
    assert.equal(status_1, 1)
    assert.isTrue(await sortedCDPs.contains(alice))

    // Repay and close CDP
    await borrowerOperations.repayCLV('50000000000000000000', alice, alice, { from: alice })
    await borrowerOperations.withdrawColl(_1_Ether, alice, alice, { from: alice })

    // Check CDP is closed
    const alice_CDP_2 = await cdpManager.CDPs(alice)
    const status_2 = alice_CDP_2[3]
    assert.equal(status_2, 2)
    assert.isFalse(await sortedCDPs.contains(alice))

    // Re-open CDP
    await borrowerOperations.openLoan('25000000000000000000', alice, alice, { from: alice, value: _1_Ether })

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

    await borrowerOperations.openLoan('50000000000000000000', alice, alice, { from: alice, value: _1_Ether })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, '50000000000000000000')
  })

  it("openLoan(): increases CLV debt in ActivePool by correct amount", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    const activePool_CLVDebt_Before = await activePool.getCLVDebt()
    assert.equal(activePool_CLVDebt_Before, 0)

    await borrowerOperations.openLoan(mv._50e18, alice, alice, { from: alice, value: _1_Ether })

    const activePool_CLVDebt_After = await activePool.getCLVDebt()
    assert.equal(activePool_CLVDebt_After, mv._50e18)
  })

  it("openLoan(): increases user CLVToken balance by correct amount", async () => {
    // check before
    const alice_CLVTokenBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_Before, 0)

    await borrowerOperations.openLoan('50000000000000000000', alice, alice, { from: alice, value: _1_Ether })

    // check after
    const alice_CLVTokenBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_After, '50000000000000000000')
  })


  it("openLoan(): Inserts the trove to the correct size list", async () => {
    await priceFeed.setPrice(mv._1000e18)

    //  Add troves with >=1e19 wei collateral
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._10_Ether })
    await borrowerOperations.openLoan(0, erin, erin, { from: erin, value: '37034534636464639898' })

    //  Add troves with collateral in range [1e18, 1e19[ wei
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: '999999999999999999' }) // 
    await borrowerOperations.openLoan(0, carol, carol, { from: carol, value: mv._1e17 })

    // Check troves are in the correct size list
    assert.isTrue(await sizeList_19orGreater.contains(whale))
    assert.isTrue(await sizeList_19orGreater.contains(dennis))
    assert.isTrue(await sizeList_19orGreater.contains(erin))

    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_18orLess.contains(bob))
    assert.isTrue(await sizeList_18orLess.contains(carol))
  })

  it("openLoan(): Pushes the trove address to the correct size range array", async () => {
    await priceFeed.setPrice(mv._1000e18)

    //  Add troves with >1e18 wei collateral
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._10_Ether })
    await borrowerOperations.openLoan(0, erin, erin, { from: erin, value: '37034534636464639898' })

    // Add troves with collateral in range [1e18, 1e19[ wei
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: '999999999999999999' }) // 
    await borrowerOperations.openLoan(0, carol, carol, { from: carol, value: mv._1e17 })

    // Check size range arrays contain the correct trove addresses
    const sizeRangeArray_19orGreater_element0 = await cdpManager.rangeToSizeArray(19, 0)
    const sizeRangeArray_19orGreater_element1 = await cdpManager.rangeToSizeArray(19, 1)
    const sizeRangeArray_19orGreater_element2 = await cdpManager.rangeToSizeArray(19, 2)

    assert.equal(sizeRangeArray_19orGreater_element0, whale)
    assert.equal(sizeRangeArray_19orGreater_element1, dennis)
    assert.equal(sizeRangeArray_19orGreater_element2, erin)

    const sizeRangeArray_18orLess_element0 = await cdpManager.rangeToSizeArray(18, 0)
    const sizeRangeArray_18orLess_element1 = await cdpManager.rangeToSizeArray(18, 1)
    const sizeRangeArray_18orLess_element2 = await cdpManager.rangeToSizeArray(18, 2)

    assert.equal(sizeRangeArray_18orLess_element0, alice)
    assert.equal(sizeRangeArray_18orLess_element1, bob)
    assert.equal(sizeRangeArray_18orLess_element2, carol)
  })

  //  --- getNewICRFromTroveChange ---

  describe("getNewICRFromTroveChange() returns the correct ICR", async () => {


    // 0, 0
    it("collChange = 0, debtChange = 0", async () => {
      price = await priceFeed.getPrice()
      const initialColl = mv._1_Ether
      const initialDebt = mv._100e18
      const collChange = 0
      const debtChange = 0

      const newICR = (await borrowerOpsTester.getNewICRFromTroveChange(initialColl, initialDebt, collChange, debtChange, price)).toString()
      assert.equal(newICR, '2000000000000000000')
    })

    // 0, +ve
    it("collChange = 0, debtChange is positive", async () => {
      price = await priceFeed.getPrice()
      const initialColl = mv._1_Ether
      const initialDebt = mv._100e18
      const collChange = 0
      const debtChange = mv._50e18

      const newICR = (await borrowerOpsTester.getNewICRFromTroveChange(initialColl, initialDebt, collChange, debtChange, price)).toString()
      assert.isAtMost(th.getDifference(newICR, '1333333333333333333'), 100)
    })

    // 0, -ve
    it("collChange = 0, debtChange is negative", async () => {
      price = await priceFeed.getPrice()
      const initialColl = mv._1_Ether
      const initialDebt = mv._100e18
      const collChange = 0
      const debtChange = mv.negative_50e18

      const newICR = (await borrowerOpsTester.getNewICRFromTroveChange(initialColl, initialDebt, collChange, debtChange, price)).toString()
      assert.equal(newICR, '4000000000000000000')
    })

    // +ve, 0
    it("collChange is positive, debtChange is 0", async () => {
      price = await priceFeed.getPrice()
      const initialColl = mv._1_Ether
      const initialDebt = mv._100e18
      const collChange = mv._1_Ether
      const debtChange = 0

      const newICR = (await borrowerOpsTester.getNewICRFromTroveChange(initialColl, initialDebt, collChange, debtChange, price)).toString()
      assert.equal(newICR, '4000000000000000000')
    })

    // -ve, 0
    it("collChange is negative, debtChange is 0", async () => {
      price = await priceFeed.getPrice()
      const initialColl = mv._1_Ether
      const initialDebt = mv._100e18
      const collChange = mv.negative_5e17
      const debtChange = 0

      const newICR = (await borrowerOpsTester.getNewICRFromTroveChange(initialColl, initialDebt, collChange, debtChange, price)).toString()
      assert.equal(newICR, '1000000000000000000')
    })

    // -ve, -ve
    it("collChange is negative, debtChange is negative", async () => {
      price = await priceFeed.getPrice()
      const initialColl = mv._1_Ether
      const initialDebt = mv._100e18
      const collChange = mv.negative_5e17
      const debtChange = mv.negative_50e18

      const newICR = (await borrowerOpsTester.getNewICRFromTroveChange(initialColl, initialDebt, collChange, debtChange, price)).toString()
      assert.equal(newICR, '2000000000000000000')
    })

    // +ve, +ve 
    it("collChange is positive, debtChange is positive", async () => {
      price = await priceFeed.getPrice()
      const initialColl = mv._1_Ether
      const initialDebt = mv._100e18
      const collChange = mv._1_Ether
      const debtChange = mv._100e18

      const newICR = (await borrowerOpsTester.getNewICRFromTroveChange(initialColl, initialDebt, collChange, debtChange, price)).toString()
      assert.equal(newICR, '2000000000000000000')
    })

    // +ve, -ve
    it("collChange is positive, debtChange is negative", async () => {
      price = await priceFeed.getPrice()
      const initialColl = mv._1_Ether
      const initialDebt = mv._100e18
      const collChange = mv._1_Ether
      const debtChange = mv.negative_50e18

      const newICR = (await borrowerOpsTester.getNewICRFromTroveChange(initialColl, initialDebt, collChange, debtChange, price)).toString()
      assert.equal(newICR, '8000000000000000000')
    })

    // -ve, +ve
    it("collChange is negative, debtChange is positive", async () => {
      price = await priceFeed.getPrice()
      const initialColl = mv._1_Ether
      const initialDebt = mv._100e18
      const collChange = mv.negative_5e17
      const debtChange = mv._100e18

      const newICR = (await borrowerOpsTester.getNewICRFromTroveChange(initialColl, initialDebt, collChange, debtChange, price)).toString()
      assert.equal(newICR, '500000000000000000')
    })
  })

  //  --- getNewICRFromTroveChange ---

  describe("getNewTCRFromTroveChange() returns the correct TCR", async () => {

    // 0, 0
    it("collChange = 0, debtChange = 0", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })

      await priceFeed.setPrice(mv._100e18)
      await cdpManager.liquidate(bob)
      await priceFeed.setPrice(mv._200e18)
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = 0
      const debtChange = 0
      const newTCR = await borrowerOpsTester.getNewTCRFromTroveChange(collChange, debtChange, price)

      assert.equal(newTCR, '2000000000000000000')
    })

    // 0, +ve
    it("collChange = 0, debtChange is positive", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })

      await priceFeed.setPrice(mv._100e18)
      await cdpManager.liquidate(bob)
      await priceFeed.setPrice(mv._200e18)
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = 0
      const debtChange = mv._200e18
      const newTCR = (await borrowerOpsTester.getNewTCRFromTroveChange(collChange, debtChange, price)).toString()

      assert.equal(newTCR, '1000000000000000000')
    })

    // 0, -ve
    it("collChange = 0, debtChange is negative", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })

      await priceFeed.setPrice(mv._100e18)
      await cdpManager.liquidate(bob)
      await priceFeed.setPrice(mv._200e18)
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = 0
      const debtChange = mv.negative_100e18
      const newTCR = (await borrowerOpsTester.getNewTCRFromTroveChange(collChange, debtChange, price)).toString()

      assert.equal(newTCR, '4000000000000000000')
    })

    // +ve, 0
    it("collChange is positive, debtChange is 0", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })

      await priceFeed.setPrice(mv._100e18)
      await cdpManager.liquidate(bob)
      await priceFeed.setPrice(mv._200e18)
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = mv._2_Ether
      const debtChange = 0
      const newTCR = (await borrowerOpsTester.getNewTCRFromTroveChange(collChange, debtChange, price)).toString()

      assert.equal(newTCR, '4000000000000000000')
    })

    // -ve, 0
    it("collChange is negative, debtChange is 0", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })

      await priceFeed.setPrice(mv._100e18)
      await cdpManager.liquidate(bob)
      await priceFeed.setPrice(mv._200e18)
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = mv.negative_1e18
      const debtChange = 0
      const newTCR = (await borrowerOpsTester.getNewTCRFromTroveChange(collChange, debtChange, price)).toString()

      assert.equal(newTCR, '1000000000000000000')
    })

    // -ve, -ve
    it("collChange is negative, debtChange is negative", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })

      await priceFeed.setPrice(mv._100e18)
      await cdpManager.liquidate(bob)
      await priceFeed.setPrice(mv._200e18)
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = mv.negative_1e18
      const debtChange = mv.negative_100e18
      const newTCR = (await borrowerOpsTester.getNewTCRFromTroveChange(collChange, debtChange, price)).toString()

      assert.equal(newTCR, '2000000000000000000')
    })

    // +ve, +ve 
    it("collChange is positive, debtChange is positive", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })

      await priceFeed.setPrice(mv._100e18)
      await cdpManager.liquidate(bob)
      await priceFeed.setPrice(mv._200e18)
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = mv._1_Ether
      const debtChange = mv._100e18
      const newTCR = (await borrowerOpsTester.getNewTCRFromTroveChange(collChange, debtChange, price)).toString()

      assert.equal(newTCR, '2000000000000000000')
    })

    // +ve, -ve
    it("collChange is positive, debtChange is negative", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })

      await priceFeed.setPrice(mv._100e18)
      await cdpManager.liquidate(bob)
      await priceFeed.setPrice(mv._200e18)
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = mv._1_Ether
      const debtChange = mv.negative_100e18
      const newTCR = (await borrowerOpsTester.getNewTCRFromTroveChange(collChange, debtChange, price)).toString()

      assert.equal(newTCR, '6000000000000000000')
    })

    // -ve, +ve
    it("collChange is negative, debtChange is positive", async () => {
      // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
      await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })

      await priceFeed.setPrice(mv._100e18)
      await cdpManager.liquidate(bob)
      await priceFeed.setPrice(mv._200e18)
      const price = await priceFeed.getPrice()

      // --- TEST ---
      const collChange = mv.negative_1e18
      const debtChange = mv._200e18
      const newTCR = (await borrowerOpsTester.getNewTCRFromTroveChange(collChange, debtChange, price)).toString()

      assert.equal(newTCR, '500000000000000000')
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