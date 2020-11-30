const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec

const toBN = th.toBN


/* NOTE: These tests do not test for specific ETH and LUSD gain values. They only test that the 
 * gains are non-zero, occur when they should, and are in correct proportion to the user's stake. 
 *
 * Specific ETH/LUSD gain values will depend on the final fee schedule used, and the final choices for
 * parameters BETA and MINUTE_DECAY_FACTORin the TroveManager, which are still TBD based on economic
 * modelling.
 * 
 */ 

contract('Fee arithmetic tests', async accounts => {
  let contracts
  
  const [owner, A, B, C, D, E, F, G, whale] = accounts;

  let borrowerOperations
  let lqtyToken
  let lqtyStaking
  
  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    const LQTYContracts = await deploymentHelper.deployLQTYTesterContractsBuidler()

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

  it("ETH fee per LQTY staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await borrowerOperations.openTrove(dec(1000, 18), whale, {from: whale, value: dec(100, 'ether')})  
    await borrowerOperations.openTrove(dec(100, 18), A, {from: A, value: dec(7, 'ether')})  
    await borrowerOperations.openTrove(dec(200, 18), B, {from: B, value: dec(9, 'ether')})  
    await borrowerOperations.openTrove(dec(300, 18), C, {from: C, value: dec(8, 'ether')})  
    await borrowerOperations.openTrove(dec(400, 18), D, {from: D, value: dec(10, 'ether')})  

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // Owner transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), {from: owner})

    // console.log(`A lqty bal: ${await lqtyToken.balanceOf(A)}`)

    // A makes stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), {from: A})
    await lqtyStaking.stake(dec(100, 18), {from: A})

    // Check ETH fee per unit staked is zero
    const F_ETH_Before = await lqtyStaking.F_ETH()
    assert.equal(F_ETH_Before, '0')

    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    assert.equal(await lusdToken.balanceOf(B), dec(100, 18))

    // check ETH fee emitted in event is non-zero
    const emittedETHFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedETHFee.gt(toBN('0')))

    // Check ETH fee per unit staked has increased by correct amount
    const F_ETH_After = await lqtyStaking.F_ETH()

    // Expect fee per unit staked = fee/100, since there is 100 LUSD totalStaked
    const expected_F_ETH_After = emittedETHFee.div(toBN('100')) 

    assert.isTrue(expected_F_ETH_After.eq(F_ETH_After))
  })

  it("ETH fee per LQTY staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await borrowerOperations.openTrove(dec(1000, 18), whale, {from: whale, value: dec(100, 'ether')})  
    await borrowerOperations.openTrove(dec(100, 18), A, {from: A, value: dec(7, 'ether')})  
    await borrowerOperations.openTrove(dec(200, 18), B, {from: B, value: dec(9, 'ether')})  
    await borrowerOperations.openTrove(dec(300, 18), C, {from: C, value: dec(8, 'ether')})  
    await borrowerOperations.openTrove(dec(400, 18), D, {from: D, value: dec(10, 'ether')})  

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // Owner transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), {from: owner})

    // Check ETH fee per unit staked is zero
    const F_ETH_Before = await lqtyStaking.F_ETH()
    assert.equal(F_ETH_Before, '0')

    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    assert.equal(await lusdToken.balanceOf(B), dec(100, 18))

    // check ETH fee emitted in event is non-zero
    const emittedETHFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedETHFee.gt(toBN('0')))

    // Check ETH fee per unit staked has not increased 
    const F_ETH_After = await lqtyStaking.F_ETH()
    assert.equal(F_ETH_After, '0')
  })

  it("LUSD fee per LQTY staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await borrowerOperations.openTrove(dec(1000, 18), whale, {from: whale, value: dec(100, 'ether')})  
    await borrowerOperations.openTrove(dec(100, 18), A, {from: A, value: dec(7, 'ether')})  
    await borrowerOperations.openTrove(dec(200, 18), B, {from: B, value: dec(9, 'ether')})  
    await borrowerOperations.openTrove(dec(300, 18), C, {from: C, value: dec(8, 'ether')})  
    await borrowerOperations.openTrove(dec(400, 18), D, {from: D, value: dec(10, 'ether')})  

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // Owner transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), {from: owner})

    // A makes stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), {from: A})
    await lqtyStaking.stake(dec(100, 18), {from: A})

    // Check LUSD fee per unit staked is zero
    const F_LUSD_Before = await lqtyStaking.F_ETH()
    assert.equal(F_LUSD_Before, '0')

    // B redeems
    await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    assert.equal(await lusdToken.balanceOf(B), dec(100, 18))

    // Check base rate is now non-zero
    const baseRate = await troveManager.baseRate()
    assert.isTrue(baseRate.gt(toBN('0')))

    // D draws debt
    const tx = await borrowerOperations.withdrawLUSD(dec(27, 18), D, {from: D})
    
    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
    assert.isTrue(emittedLUSDFee.gt(toBN('0')))
    
    // Check LUSD fee per unit staked has increased by correct amount
    const F_LUSD_After = await lqtyStaking.F_LUSD()

    // Expect fee per unit staked = fee/100, since there is 100 LUSD totalStaked
    const expected_F_LUSD_After = emittedLUSDFee.div(toBN('100')) 

    assert.isTrue(expected_F_LUSD_After.eq(F_LUSD_After))
  })

  it("LUSD fee per LQTY staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await borrowerOperations.openTrove(dec(1000, 18), whale, {from: whale, value: dec(100, 'ether')})  
    await borrowerOperations.openTrove(dec(100, 18), A, {from: A, value: dec(7, 'ether')})  
    await borrowerOperations.openTrove(dec(200, 18), B, {from: B, value: dec(9, 'ether')})  
    await borrowerOperations.openTrove(dec(300, 18), C, {from: C, value: dec(8, 'ether')})  
    await borrowerOperations.openTrove(dec(400, 18), D, {from: D, value: dec(10, 'ether')})  

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // Owner transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), {from: owner})

    // Check LUSD fee per unit staked is zero
    const F_LUSD_Before = await lqtyStaking.F_ETH()
    assert.equal(F_LUSD_Before, '0')

    // B redeems
    await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    assert.equal(await lusdToken.balanceOf(B), dec(100, 18))

    // Check base rate is now non-zero
    const baseRate = await troveManager.baseRate()
    assert.isTrue(baseRate.gt(toBN('0')))

    // D draws debt
    const tx = await borrowerOperations.withdrawLUSD(dec(27, 18), D, {from: D})
    
    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
    assert.isTrue(emittedLUSDFee.gt(toBN('0')))
    
    // Check LUSD fee per unit staked did not increase, is still zero
    const F_LUSD_After = await lqtyStaking.F_LUSD()
    assert.equal(F_LUSD_After, '0')
  })


  it("LQTY Staking: A single staker earns all ETH and LQTY fees that occur", async () => {
    await borrowerOperations.openTrove(dec(1000, 18), whale, {from: whale, value: dec(100, 'ether')})  
    await borrowerOperations.openTrove(dec(100, 18), A, {from: A, value: dec(7, 'ether')})  
    await borrowerOperations.openTrove(dec(200, 18), B, {from: B, value: dec(9, 'ether')})  
    await borrowerOperations.openTrove(dec(300, 18), C, {from: C, value: dec(8, 'ether')})  
    await borrowerOperations.openTrove(dec(400, 18), D, {from: D, value: dec(10, 'ether')})  

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // Owner transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), {from: owner})

    // A makes stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), {from: A})
    await lqtyStaking.stake(dec(100, 18), {from: A})

    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    assert.equal(await lusdToken.balanceOf(B), dec(100, 18))

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

     // C redeems
     const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
     assert.equal(await lusdToken.balanceOf(C), dec(200, 18))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawLUSD(dec(104, 18), D, {from: D})
    
    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee_1 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedLUSDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawLUSD(dec(17, 18), B, {from: B})
    
    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee_2 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedLUSDFee_2.gt(toBN('0')))

    const expectedTotalETHGain = emittedETHFee_1.add(emittedETHFee_2)
    const expectedTotalLUSDGain = emittedLUSDFee_1.add(emittedLUSDFee_2)

    const A_ETHBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_LUSDBalance_Before = toBN(await lusdToken.balanceOf(A))

    // A un-stakes
    await lqtyStaking.unstake(dec(100, 18), {from: A, gasPrice: 0})

    const A_ETHBalance_After = toBN(await web3.eth.getBalance(A))
    const A_LUSDBalance_After = toBN(await lusdToken.balanceOf(A))


    const A_ETHGain = A_ETHBalance_After.sub(A_ETHBalance_Before)
    const A_LUSDGain = A_LUSDBalance_After.sub(A_LUSDBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalETHGain, A_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedTotalLUSDGain, A_LUSDGain), 1000)
  })

  it("stake(): Top-up sends out all accumulated ETH and LUSD gains to the staker", async () => { 
    await borrowerOperations.openTrove(dec(1000, 18), whale, {from: whale, value: dec(100, 'ether')})  
    await borrowerOperations.openTrove(dec(100, 18), A, {from: A, value: dec(7, 'ether')})  
    await borrowerOperations.openTrove(dec(200, 18), B, {from: B, value: dec(9, 'ether')})  
    await borrowerOperations.openTrove(dec(300, 18), C, {from: C, value: dec(8, 'ether')})  
    await borrowerOperations.openTrove(dec(400, 18), D, {from: D, value: dec(10, 'ether')})  

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
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

     // C redeems
     const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
     assert.equal(await lusdToken.balanceOf(C), dec(200, 18))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawLUSD(dec(104, 18), D, {from: D})
    
    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee_1 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedLUSDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawLUSD(dec(17, 18), B, {from: B})
    
    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee_2 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedLUSDFee_2.gt(toBN('0')))

    const expectedTotalETHGain = emittedETHFee_1.add(emittedETHFee_2)
    const expectedTotalLUSDGain = emittedLUSDFee_1.add(emittedLUSDFee_2)

    const A_ETHBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_LUSDBalance_Before = toBN(await lusdToken.balanceOf(A))

    // A tops up
    await lqtyStaking.stake(dec(50, 18), {from: A, gasPrice: 0})

    const A_ETHBalance_After = toBN(await web3.eth.getBalance(A))
    const A_LUSDBalance_After = toBN(await lusdToken.balanceOf(A))

    const A_ETHGain = A_ETHBalance_After.sub(A_ETHBalance_Before)
    const A_LUSDGain = A_LUSDBalance_After.sub(A_LUSDBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalETHGain, A_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedTotalLUSDGain, A_LUSDGain), 1000)
  })

  it("getPendingETHGain(): Returns the staker's correct pending ETH gain", async () => { 
    await borrowerOperations.openTrove(dec(1000, 18), whale, {from: whale, value: dec(100, 'ether')})  
    await borrowerOperations.openTrove(dec(100, 18), A, {from: A, value: dec(7, 'ether')})  
    await borrowerOperations.openTrove(dec(200, 18), B, {from: B, value: dec(9, 'ether')})  
    await borrowerOperations.openTrove(dec(300, 18), C, {from: C, value: dec(8, 'ether')})  
    await borrowerOperations.openTrove(dec(400, 18), D, {from: D, value: dec(10, 'ether')})  

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
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

     // C redeems
     const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
     assert.equal(await lusdToken.balanceOf(C), dec(200, 18))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    const expectedTotalETHGain = emittedETHFee_1.add(emittedETHFee_2)

    const A_ETHGain = await lqtyStaking.getPendingETHGain(A)

    assert.isAtMost(th.getDifference(expectedTotalETHGain, A_ETHGain), 1000)
  })

  it("getPendingLUSDGain(): Returns the staker's correct pending LUSD gain", async () => { 
    await borrowerOperations.openTrove(dec(1000, 18), whale, {from: whale, value: dec(100, 'ether')})  
    await borrowerOperations.openTrove(dec(100, 18), A, {from: A, value: dec(7, 'ether')})  
    await borrowerOperations.openTrove(dec(200, 18), B, {from: B, value: dec(9, 'ether')})  
    await borrowerOperations.openTrove(dec(300, 18), C, {from: C, value: dec(8, 'ether')})  
    await borrowerOperations.openTrove(dec(400, 18), D, {from: D, value: dec(10, 'ether')})  

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
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

     // C redeems
     const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
     assert.equal(await lusdToken.balanceOf(C), dec(200, 18))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawLUSD(dec(104, 18), D, {from: D})
    
    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee_1 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedLUSDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawLUSD(dec(17, 18), B, {from: B})
    
    // Check LUSD fee value in event is non-zero
    const emittedLUSDFee_2 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedLUSDFee_2.gt(toBN('0')))

    const expectedTotalLUSDGain = emittedLUSDFee_1.add(emittedLUSDFee_2)
    const A_LUSDGain = await lqtyStaking.getPendingLUSDGain(A)

    assert.isAtMost(th.getDifference(expectedTotalLUSDGain, A_LUSDGain), 1000)
  })

  // - multi depositors, several rewards
  it("LQTY Staking: Multiple stakers earn the correct share of all ETH and LQTY fees, based on their stake size", async () => {
    await borrowerOperations.openTrove(dec(1000, 18), whale, {from: whale, value: dec(100, 'ether')})  
    await borrowerOperations.openTrove(dec(100, 18), A, {from: A, value: dec(7, 'ether')})  
    await borrowerOperations.openTrove(dec(200, 18), B, {from: B, value: dec(9, 'ether')})  
    await borrowerOperations.openTrove(dec(300, 18), C, {from: C, value: dec(8, 'ether')})  
    await borrowerOperations.openTrove(dec(400, 18), D, {from: D, value: dec(10, 'ether')})  
    await borrowerOperations.openTrove(dec(400, 18), E, {from: E, value: dec(10, 'ether')})  

    await borrowerOperations.openTrove(dec(1000, 18), F, {from: F, value: dec(10, 'ether')})  
    await borrowerOperations.openTrove(dec(1000, 18), G, {from: G, value: dec(10, 'ether')})  
  
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
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

     // G redeems
     const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(G, contracts, dec(197, 18))
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // F draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawLUSD(dec(104, 18), F, {from: F})
    const emittedLUSDFee_1 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedLUSDFee_1.gt(toBN('0')))

    // G draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawLUSD(dec(17, 18), G, {from: G})
    const emittedLUSDFee_2 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedLUSDFee_2.gt(toBN('0')))

    // D obtains LQTY from owner and makes a stake
    await lqtyToken.transfer(D, dec(50, 18), {from: owner})
    await lqtyToken.approve(lqtyStaking.address, dec(50, 18), {from: D})
    await lqtyStaking.stake(dec(50, 18), {from: D})

    // Confirm staking contract holds 650 LQTY
    assert.equal(await lqtyToken.balanceOf(lqtyStaking.address), dec(650, 18))
    assert.equal(await lqtyStaking.totalLQTYStaked(), dec(650, 18))

     // G redeems
     const redemptionTx_3 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(197, 18))
     const emittedETHFee_3 = toBN((await th.getEmittedRedemptionValues(redemptionTx_3))[3])
     assert.isTrue(emittedETHFee_3.gt(toBN('0')))

     // G draws debt
    const borrowingTx_3 = await borrowerOperations.withdrawLUSD(dec(17, 18), G, {from: G})
    const emittedLUSDFee_3 = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(borrowingTx_3))
    assert.isTrue(emittedLUSDFee_3.gt(toBN('0')))
     
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
    const expectedETHGain_A = toBN('100').mul(emittedETHFee_1).div( toBN('600'))
                            .add(toBN('100').mul(emittedETHFee_2).div( toBN('600')))
                            .add(toBN('100').mul(emittedETHFee_3).div( toBN('650')))

    const expectedETHGain_B = toBN('200').mul(emittedETHFee_1).div( toBN('600'))
                            .add(toBN('200').mul(emittedETHFee_2).div( toBN('600')))
                            .add(toBN('200').mul(emittedETHFee_3).div( toBN('650')))

    const expectedETHGain_C = toBN('300').mul(emittedETHFee_1).div( toBN('600'))
                            .add(toBN('300').mul(emittedETHFee_2).div( toBN('600')))
                            .add(toBN('300').mul(emittedETHFee_3).div( toBN('650')))

    const expectedETHGain_D = toBN('50').mul(emittedETHFee_3).div( toBN('650'))

    // Expected LUSD gains:
    const expectedLUSDGain_A = toBN('100').mul(emittedLUSDFee_1).div( toBN('600'))
                            .add(toBN('100').mul(emittedLUSDFee_2).div( toBN('600')))
                            .add(toBN('100').mul(emittedLUSDFee_3).div( toBN('650')))

    const expectedLUSDGain_B = toBN('200').mul(emittedLUSDFee_1).div( toBN('600'))
                            .add(toBN('200').mul(emittedLUSDFee_2).div( toBN('600')))
                            .add(toBN('200').mul(emittedLUSDFee_3).div( toBN('650')))

    const expectedLUSDGain_C = toBN('300').mul(emittedLUSDFee_1).div( toBN('600'))
                            .add(toBN('300').mul(emittedLUSDFee_2).div( toBN('600')))
                            .add(toBN('300').mul(emittedLUSDFee_3).div( toBN('650')))
    
    const expectedLUSDGain_D = toBN('50').mul(emittedLUSDFee_3).div( toBN('650'))


    const A_ETHBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_LUSDBalance_Before = toBN(await lusdToken.balanceOf(A))
    const B_ETHBalance_Before = toBN(await web3.eth.getBalance(B))
    const B_LUSDBalance_Before = toBN(await lusdToken.balanceOf(B))
    const C_ETHBalance_Before = toBN(await web3.eth.getBalance(C))
    const C_LUSDBalance_Before = toBN(await lusdToken.balanceOf(C))
    const D_ETHBalance_Before = toBN(await web3.eth.getBalance(D))
    const D_LUSDBalance_Before = toBN(await lusdToken.balanceOf(D))

    // A-D un-stake
    const unstake_A = await lqtyStaking.unstake(dec(100, 18), {from: A, gasPrice: 0})
    const unstake_B = await lqtyStaking.unstake(dec(200, 18), {from: B, gasPrice: 0})
    const unstake_C = await lqtyStaking.unstake(dec(400, 18), {from: C, gasPrice: 0})
    const unstake_D = await lqtyStaking.unstake(dec(50, 18), {from: D, gasPrice: 0})

    // Confirm all depositors could withdraw

    //Confirm pool Size is now 0
    assert.equal((await lqtyToken.balanceOf(lqtyStaking.address)), '0')
    assert.equal((await lqtyStaking.totalLQTYStaked()), '0')

    // Get A-D ETH and LUSD balances
    const A_ETHBalance_After = toBN(await web3.eth.getBalance(A))
    const A_LUSDBalance_After = toBN(await lusdToken.balanceOf(A))
    const B_ETHBalance_After = toBN(await web3.eth.getBalance(B))
    const B_LUSDBalance_After = toBN(await lusdToken.balanceOf(B))
    const C_ETHBalance_After = toBN(await web3.eth.getBalance(C))
    const C_LUSDBalance_After = toBN(await lusdToken.balanceOf(C))
    const D_ETHBalance_After = toBN(await web3.eth.getBalance(D))
    const D_LUSDBalance_After = toBN(await lusdToken.balanceOf(D))

    // Get ETH and LUSD gains
    const A_ETHGain = A_ETHBalance_After.sub(A_ETHBalance_Before)
    const A_LUSDGain = A_LUSDBalance_After.sub(A_LUSDBalance_Before)
    const B_ETHGain = B_ETHBalance_After.sub(B_ETHBalance_Before)
    const B_LUSDGain = B_LUSDBalance_After.sub(B_LUSDBalance_Before)
    const C_ETHGain = C_ETHBalance_After.sub(C_ETHBalance_Before)
    const C_LUSDGain = C_LUSDBalance_After.sub(C_LUSDBalance_Before)
    const D_ETHGain = D_ETHBalance_After.sub(D_ETHBalance_Before)
    const D_LUSDGain = D_LUSDBalance_After.sub(D_LUSDBalance_Before)

    // Check gains match expected amounts
    assert.isAtMost(th.getDifference(expectedETHGain_A, A_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedLUSDGain_A, A_LUSDGain), 1000)
    assert.isAtMost(th.getDifference(expectedETHGain_B, B_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedLUSDGain_B, B_LUSDGain), 1000)
    assert.isAtMost(th.getDifference(expectedETHGain_C, C_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedLUSDGain_C, C_LUSDGain), 1000)
    assert.isAtMost(th.getDifference(expectedETHGain_D, D_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedLUSDGain_D, D_LUSDGain), 1000)
  })
  // - all depositors can leave pool
})
