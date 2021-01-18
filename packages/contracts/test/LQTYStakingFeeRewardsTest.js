const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")

const NonPayable = artifacts.require("./NonPayable.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const assertRevert = th.assertRevert

const toBN = th.toBN
const ZERO = th.toBN('0')

/* NOTE: These tests do not test for specific LUSD gain values. They only test that the 
 * gains are non-zero, occur when they should, and are in correct proportion to the user's stake. 
 *
 * Specific LUSD gain values will depend on the final fee schedule used, and the final choices for
 * parameters BETA and MINUTE_DECAY_FACTOR in the TroveManager, which are still TBD based on economic
 * modelling.
 * 
 */ 

contract('LQTY Staking fee reward tests', async accounts => {
  let contracts
  
  const [owner, A, B, C, D, E, F, G, whale] = accounts;

  let borrowerOperations
  let lqtyToken
  let lqtyStaking
  let nonPayable
  
  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    const LQTYContracts = await deploymentHelper.deployLQTYTesterContractsHardhat()

    nonPayable = await NonPayable.new() 
    priceFeed = contracts.priceFeedTestnet
    lusdToken = contracts.lusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    lqtyToken = LQTYContracts.lqtyToken
    lqtyStaking = LQTYContracts.lqtyStaking
    
    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
  })

  it("LUSD fee per LQTY staked increases when a redemption fee is triggered and totalLQTYStaked > 0", async () => {
    await borrowerOperations.openTrove(0, dec(1000, 18), whale, {from: whale, value: dec(100, 'ether')})  
    await borrowerOperations.openTrove(0, dec(100, 18), A, {from: A, value: dec(7, 'ether')})  
    await borrowerOperations.openTrove(0, dec(200, 18), B, {from: B, value: dec(9, 'ether')})  
    await borrowerOperations.openTrove(0, dec(300, 18), C, {from: C, value: dec(8, 'ether')})  
    await borrowerOperations.openTrove(0, dec(400, 18), D, {from: D, value: dec(10, 'ether')})  

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // Owner transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), {from: owner})

    // console.log(`A lqty bal: ${await lqtyToken.balanceOf(A)}`)

    // A makes stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), {from: A})
    await lqtyStaking.stake(dec(100, 18), {from: A})

    // Check LUSD fee per unit staked is zero
    const F_LUSD_Before = await lqtyStaking.F_LUSD()
    assert.equal(F_LUSD_Before, '0')

    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    const B_balance = await lusdToken.balanceOf(B)
    assert.isTrue(B_balance.eq(toBN(dec(100, 18))))

    // check LUSD fee emitted in event is non-zero
    const emittedLUSDFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedLUSDFee.gt(toBN('0')))

    // Check LUSD fee per unit staked has increased by correct amount
    const F_LUSD_After = await lqtyStaking.F_LUSD()

    // Expect fee per unit staked = fee/100, since there is 100 total LQTY staked
    const expected_F_LUSD_After = emittedLUSDFee.div(toBN('100')) 
    assert.isTrue(expected_F_LUSD_After.eq(F_LUSD_After))
  })

  it("LUSD fee per LQTY staked doesn't change when a redemption fee is triggered and totalLQTYStaked == 0", async () => {
    await borrowerOperations.openTrove(0, dec(1000, 18), whale, {from: whale, value: dec(100, 'ether')})  
    await borrowerOperations.openTrove(0, dec(100, 18), A, {from: A, value: dec(7, 'ether')})  
    await borrowerOperations.openTrove(0, dec(200, 18), B, {from: B, value: dec(9, 'ether')})  
    await borrowerOperations.openTrove(0, dec(300, 18), C, {from: C, value: dec(8, 'ether')})  
    await borrowerOperations.openTrove(0, dec(400, 18), D, {from: D, value: dec(10, 'ether')})  

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // Owner transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), {from: owner})

    // Check LUSD fee per unit staked is zero
    const F_LUSD_Before = await lqtyStaking.F_LUSD()
    assert.equal(F_LUSD_Before, '0')

    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    const B_balance = await lusdToken.balanceOf(B)
    assert.isTrue(B_balance.eq(toBN(dec(100, 18))))

    // check LUSD fee emitted in event is zero
    const emittedLUSDFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedLUSDFee.gt(toBN('0')))

    // Check LUSD fee per unit staked has not increased 
    const F_LUSD_After = await lqtyStaking.F_LUSD()
    assert.equal(F_LUSD_After, '0')
  })

  it("LQTY Staking: A single LQTY staker earns all LUSD fees that occur", async () => {
    await borrowerOperations.openTrove(0, dec(1000, 18), whale, {from: whale, value: dec(100, 'ether')})  
    await borrowerOperations.openTrove(0, dec(100, 18), A, {from: A, value: dec(7, 'ether')})  
    await borrowerOperations.openTrove(0, dec(200, 18), B, {from: B, value: dec(9, 'ether')})  
    await borrowerOperations.openTrove(0, dec(300, 18), C, {from: C, value: dec(8, 'ether')})  
    await borrowerOperations.openTrove(0, dec(400, 18), D, {from: D, value: dec(10, 'ether')})  

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // Owner transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), {from: owner})

    // A makes stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), {from: A})
    await lqtyStaking.stake(dec(100, 18), {from: A})

    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    const B_balance = await lusdToken.balanceOf(B)
    assert.isTrue(B_balance.eq(toBN(dec(100, 18))))

    // check LUSD fee 1 emitted in event is non-zero
    const emittedLUSDFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedLUSDFee_1.gt(toBN('0')))

     // C redeems
     const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
     assert.equal(await lusdToken.balanceOf(C), dec(200, 18))
 
     // check LUSD fee 2 emitted in event is non-zero
     const emittedLUSDFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedLUSDFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_3 = await borrowerOperations.withdrawLUSD(0, dec(104, 18), D, {from: D})
    
    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee_3 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_3))
    assert.isTrue(emittedLUSDFee_3.gt(toBN('0')))

    // B draws debt
    const borrowingTx_4 = await borrowerOperations.withdrawLUSD(0, dec(17, 18), B, {from: B})
    
    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee_4 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_4))
    assert.isTrue(emittedLUSDFee_4.gt(toBN('0')))

    const expectedTotalLUSDGain = emittedLUSDFee_1.add(emittedLUSDFee_2).add(emittedLUSDFee_3).add(emittedLUSDFee_4)

    const A_LUSDBalance_Before = toBN(await lusdToken.balanceOf(A))

    // A un-stakes
    await lqtyStaking.unstake(dec(100, 18), {from: A, gasPrice: 0})

    const A_LUSDBalance_After = toBN(await lusdToken.balanceOf(A))

    const A_LUSDGain = A_LUSDBalance_After.sub(A_LUSDBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalLUSDGain, A_LUSDGain), 1000)
  })

  it("stake(): Top-up sends out all accumulated LUSD gains to the staker", async () => { 
    await borrowerOperations.openTrove(0, dec(1000, 18), whale, {from: whale, value: dec(100, 'ether')})  
    await borrowerOperations.openTrove(0, dec(100, 18), A, {from: A, value: dec(7, 'ether')})  
    await borrowerOperations.openTrove(0, dec(200, 18), B, {from: B, value: dec(9, 'ether')})  
    await borrowerOperations.openTrove(0, dec(300, 18), C, {from: C, value: dec(8, 'ether')})  
    await borrowerOperations.openTrove(0, dec(400, 18), D, {from: D, value: dec(10, 'ether')})  

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // Owner transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), {from: owner})

    // A makes stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), {from: A})
    await lqtyStaking.stake(dec(50, 18), {from: A})

    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    assert.equal(await lusdToken.balanceOf(B), dec(100, 18))

    // check ETH fee 1 emitted in event is non-zero
    const emittedLUSDFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedLUSDFee_1.gt(toBN('0')))

     // C redeems
     const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
     assert.equal(await lusdToken.balanceOf(C), dec(200, 18))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedLUSDFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedLUSDFee_2.gt(toBN('0')))

    const baseRate = await troveManager.baseRate()
    console.log(`baseRate: ${baseRate}`)

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawLUSD(0, dec(104, 18), D, {from: D})
    
    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee_3 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedLUSDFee_3.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawLUSD(0, dec(17, 18), B, {from: B})
    
    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee_4 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedLUSDFee_4.gt(toBN('0')))

    const expectedTotalLUSDGain = emittedLUSDFee_1.add(emittedLUSDFee_2).add(emittedLUSDFee_3).add(emittedLUSDFee_4)

    const A_LUSDBalance_Before = toBN(await lusdToken.balanceOf(A))

    // A tops up
    await lqtyStaking.stake(dec(50, 18), {from: A, gasPrice: 0})

    const A_LUSDBalance_After = toBN(await lusdToken.balanceOf(A))

    const A_LUSDGain = A_LUSDBalance_After.sub(A_LUSDBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalLUSDGain, A_LUSDGain), 1000)
  })

  it("unstake(): sends out all accumulated LUSD gains to the staker", async () => { 
    await borrowerOperations.openTrove(0, dec(1000, 18), whale, {from: whale, value: dec(100, 'ether')})  
    await borrowerOperations.openTrove(0, dec(100, 18), A, {from: A, value: dec(7, 'ether')})  
    await borrowerOperations.openTrove(0, dec(200, 18), B, {from: B, value: dec(9, 'ether')})  
    await borrowerOperations.openTrove(0, dec(300, 18), C, {from: C, value: dec(8, 'ether')})  
    await borrowerOperations.openTrove(0, dec(400, 18), D, {from: D, value: dec(10, 'ether')})  

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // Owner transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), {from: owner})

    // A makes stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), {from: A})
    await lqtyStaking.stake(dec(50, 18), {from: A})

    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    assert.equal(await lusdToken.balanceOf(B), dec(100, 18))

    // check ETH fee 1 emitted in event is non-zero
    const emittedLUSDFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedLUSDFee_1.gt(toBN('0')))

     // C redeems
     const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
     assert.equal(await lusdToken.balanceOf(C), dec(200, 18))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedLUSDFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedLUSDFee_2.gt(toBN('0')))

    const baseRate = await troveManager.baseRate()
    console.log(`baseRate: ${baseRate}`)

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawLUSD(0, dec(104, 18), D, {from: D})
    
    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee_3 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedLUSDFee_3.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawLUSD(0, dec(17, 18), B, {from: B})
    
    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee_4 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedLUSDFee_4.gt(toBN('0')))

    const expectedTotalLUSDGain = emittedLUSDFee_1.add(emittedLUSDFee_2).add(emittedLUSDFee_3).add(emittedLUSDFee_4)

    const A_LUSDBalance_Before = toBN(await lusdToken.balanceOf(A))

    // A tops up
    await lqtyStaking.unstake(dec(100, 18), {from: A, gasPrice: 0})

    const A_LUSDBalance_After = toBN(await lusdToken.balanceOf(A))

    const A_LUSDGain = A_LUSDBalance_After.sub(A_LUSDBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalLUSDGain, A_LUSDGain), 1000)
  })

  it("getPendingLUSDGain(): Returns the staker's correct pending LUSD gain", async () => { 
    await borrowerOperations.openTrove(0, dec(1000, 18), whale, {from: whale, value: dec(100, 'ether')})  
    await borrowerOperations.openTrove(0, dec(100, 18), A, {from: A, value: dec(7, 'ether')})  
    await borrowerOperations.openTrove(0, dec(200, 18), B, {from: B, value: dec(9, 'ether')})  
    await borrowerOperations.openTrove(0, dec(300, 18), C, {from: C, value: dec(8, 'ether')})  
    await borrowerOperations.openTrove(0, dec(400, 18), D, {from: D, value: dec(10, 'ether')})  

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // Owner transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), {from: owner})

    // A makes stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), {from: A})
    await lqtyStaking.stake(dec(50, 18), {from: A})

    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    assert.equal(await lusdToken.balanceOf(B), dec(100, 18))

    // check LUSD fee 1 emitted in event is non-zero
    const emittedLUSDFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedLUSDFee_1.gt(toBN('0')))

     // C redeems
     const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
     assert.equal(await lusdToken.balanceOf(C), dec(200, 18))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedLUSDFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedLUSDFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawLUSD(0, dec(104, 18), D, {from: D})
    
    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee_3 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedLUSDFee_3.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawLUSD(0, dec(17, 18), B, {from: B})
    
    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee_4 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedLUSDFee_4.gt(toBN('0')))

    const expectedTotalLUSDGain = emittedLUSDFee_1.add(emittedLUSDFee_2).add(emittedLUSDFee_3).add(emittedLUSDFee_4)
    const A_LUSDGain = await lqtyStaking.getPendingLUSDGain(A)

    assert.isAtMost(th.getDifference(expectedTotalLUSDGain, A_LUSDGain), 1000)
  })

  // - multi depositors, several rewards
  it("LQTY Staking: Multiple stakers earn the correct share of all ETH and LQTY fees, based on their stake size", async () => {
    await borrowerOperations.openTrove(0, dec(1000, 18), whale, {from: whale, value: dec(100, 'ether')})  
    await borrowerOperations.openTrove(0, dec(100, 18), A, {from: A, value: dec(7, 'ether')})  
    await borrowerOperations.openTrove(0, dec(200, 18), B, {from: B, value: dec(9, 'ether')})  
    await borrowerOperations.openTrove(0, dec(300, 18), C, {from: C, value: dec(8, 'ether')})  
    await borrowerOperations.openTrove(0, dec(400, 18), D, {from: D, value: dec(10, 'ether')})  
    await borrowerOperations.openTrove(0, dec(400, 18), E, {from: E, value: dec(10, 'ether')})  

    await borrowerOperations.openTrove(0, dec(1000, 18), F, {from: F, value: dec(10, 'ether')})  
    await borrowerOperations.openTrove(0, dec(1000, 18), G, {from: G, value: dec(10, 'ether')})  
  
    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // Owner transfers LQTY to staker A, B, C
    await lqtyToken.transfer(A, dec(100, 18), {from: owner})
    await lqtyToken.transfer(B, dec(200, 18), {from: owner})
    await lqtyToken.transfer(C, dec(300, 18), {from: owner})

    // A, B, C make stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), {from: A})
    await lqtyToken.approve(lqtyStaking.address, dec(200, 18), {from: B})
    await lqtyToken.approve(lqtyStaking.address, dec(300, 18), {from: C})
    await lqtyStaking.stake(dec(100, 18), {from: A})
    await lqtyStaking.stake(dec(200, 18), {from: B})
    await lqtyStaking.stake(dec(300, 18), {from: C})

    // Confirm staking contract holds 600 LQTY
    // console.log(`lqty staking LQTY bal: ${await lqtyToken.balanceOf(lqtyStaking.address)}`)
    assert.equal(await lqtyToken.balanceOf(lqtyStaking.address), dec(600, 18))
    assert.equal(await lqtyStaking.totalLQTYStaked(), dec(600, 18))

    // F redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(F, contracts, dec(45, 18))
    const emittedLUSDFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedLUSDFee_1.gt(toBN('0')))

     // G redeems
     const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(G, contracts, dec(197, 18))
     const emittedLUSDFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedLUSDFee_2.gt(toBN('0')))

    // F draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawLUSD(0, dec(104, 18), F, {from: F})
    const emittedLUSDFee_3 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedLUSDFee_3.gt(toBN('0')))

    // G draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawLUSD(0, dec(17, 18), G, {from: G})
    const emittedLUSDFee_4 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedLUSDFee_4.gt(toBN('0')))

    // D obtains LQTY from owner and makes a stake
    await lqtyToken.transfer(D, dec(50, 18), {from: owner})
    await lqtyToken.approve(lqtyStaking.address, dec(50, 18), {from: D})
    await lqtyStaking.stake(dec(50, 18), {from: D})

    // Confirm staking contract holds 650 LQTY
    assert.equal(await lqtyToken.balanceOf(lqtyStaking.address), dec(650, 18))
    assert.equal(await lqtyStaking.totalLQTYStaked(), dec(650, 18))

     // G redeems
     const redemptionTx_3 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(197, 18))
     const emittedLUSDFee_5 = toBN((await th.getEmittedRedemptionValues(redemptionTx_3))[3])
     assert.isTrue(emittedLUSDFee_5.gt(toBN('0')))

     // G draws debt
    const borrowingTx_3 = await borrowerOperations.withdrawLUSD(0, dec(17, 18), G, {from: G})
    const emittedLUSDFee_6 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_3))
    assert.isTrue(emittedLUSDFee_6.gt(toBN('0')))
     
    /*  
    Expected rewards:

    A_ETH: (100* ETHFee_1)/600 + (100* ETHFee_2)/600 + (100*ETH_Fee_3)/650
    B_ETH: (200* ETHFee_1)/600 + (200* ETHFee_2)/600 + (200*ETH_Fee_3)/650
    C_ETH: (300* ETHFee_1)/600 + (300* ETHFee_2)/600 + (300*ETH_Fee_3)/650
    D_ETH:                                             (100*ETH_Fee_3)/650

    A_LUSD: (100*LUSDFee_1 )/600 + (100* LUSDFee_2)/600 + (100*LUSDFee_3)/650
    B_LUSD: (200* LUSDFee_1)/600 + (200* LUSDFee_2)/600 + (200*LUSDFee_3)/650
    C_LUSD: (300* LUSDFee_1)/600 + (300* LUSDFee_2)/600 + (300*LUSDFee_3)/650
    D_LUSD:                                               (100*LUSDFee_3)/650
    */

    // Expected ETH gains
    // Expected LUSD gains:
    const expectedLUSDGain_A = toBN('100').mul(emittedLUSDFee_1).div( toBN('600'))
      .add(toBN('100').mul(emittedLUSDFee_2).div( toBN('600')))
      .add(toBN('100').mul(emittedLUSDFee_3).div( toBN('600')))
      .add(toBN('100').mul(emittedLUSDFee_4).div( toBN('600')))
      .add(toBN('100').mul(emittedLUSDFee_5).div( toBN('650')))
      .add(toBN('100').mul(emittedLUSDFee_6).div( toBN('650')))


    const expectedLUSDGain_B = toBN('200').mul(emittedLUSDFee_1).div( toBN('600'))
    .add(toBN('200').mul(emittedLUSDFee_2).div( toBN('600')))
    .add(toBN('200').mul(emittedLUSDFee_3).div( toBN('600')))
    .add(toBN('200').mul(emittedLUSDFee_4).div( toBN('600')))
    .add(toBN('200').mul(emittedLUSDFee_5).div( toBN('650')))
    .add(toBN('200').mul(emittedLUSDFee_6).div( toBN('650')))

    const expectedLUSDGain_C = toBN('300').mul(emittedLUSDFee_1).div( toBN('600'))
    .add(toBN('300').mul(emittedLUSDFee_2).div( toBN('600')))
    .add(toBN('300').mul(emittedLUSDFee_3).div( toBN('600')))
    .add(toBN('300').mul(emittedLUSDFee_4).div( toBN('600')))
    .add(toBN('300').mul(emittedLUSDFee_5).div( toBN('650')))
    .add(toBN('300').mul(emittedLUSDFee_6).div( toBN('650')))
    
    const expectedLUSDGain_D = toBN('50').mul(emittedLUSDFee_5).div( toBN('650'))
    .add(toBN('50').mul(emittedLUSDFee_6).div( toBN('650')))


    const A_LUSDBalance_Before = toBN(await lusdToken.balanceOf(A))
    const B_LUSDBalance_Before = toBN(await lusdToken.balanceOf(B))
    const C_LUSDBalance_Before = toBN(await lusdToken.balanceOf(C))
    const D_LUSDBalance_Before = toBN(await lusdToken.balanceOf(D))

    // A-D un-stake
    await lqtyStaking.unstake(dec(100, 18), {from: A, gasPrice: 0})
    await lqtyStaking.unstake(dec(200, 18), {from: B, gasPrice: 0})
    await lqtyStaking.unstake(dec(400, 18), {from: C, gasPrice: 0})
    await lqtyStaking.unstake(dec(50, 18), {from: D, gasPrice: 0})

    // Confirm all depositors could withdraw

    //Confirm pool Size is now 0
    assert.equal((await lqtyToken.balanceOf(lqtyStaking.address)), '0')
    assert.equal((await lqtyStaking.totalLQTYStaked()), '0')

    // Get A-D ETH and LUSD balances

    const A_LUSDBalance_After = toBN(await lusdToken.balanceOf(A))
    const B_LUSDBalance_After = toBN(await lusdToken.balanceOf(B))
    const C_LUSDBalance_After = toBN(await lusdToken.balanceOf(C))
    const D_LUSDBalance_After = toBN(await lusdToken.balanceOf(D))

    // Get ETH and LUSD gains

    const A_LUSDGain = A_LUSDBalance_After.sub(A_LUSDBalance_Before)
    const B_LUSDGain = B_LUSDBalance_After.sub(B_LUSDBalance_Before)
    const C_LUSDGain = C_LUSDBalance_After.sub(C_LUSDBalance_Before)
    const D_LUSDGain = D_LUSDBalance_After.sub(D_LUSDBalance_Before)

    // Check gains match expected amounts
    assert.isAtMost(th.getDifference(expectedLUSDGain_A, A_LUSDGain), 1000)
    assert.isAtMost(th.getDifference(expectedLUSDGain_B, B_LUSDGain), 1000)
    assert.isAtMost(th.getDifference(expectedLUSDGain_C, C_LUSDGain), 1000)
    assert.isAtMost(th.getDifference(expectedLUSDGain_D, D_LUSDGain), 1000)
  })
 
  it("unstake(): reverts if user has no stake",  async () => {  
    const unstakeTxPromise1 = lqtyStaking.unstake(1, {from: A})
    const unstakeTxPromise2 = lqtyStaking.unstake(1, {from: owner})

    await assertRevert(unstakeTxPromise1)
    await assertRevert(unstakeTxPromise2)
  })
})
