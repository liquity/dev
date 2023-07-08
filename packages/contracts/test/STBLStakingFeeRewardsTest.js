const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")

const STBLStakingTester = artifacts.require('STBLStakingTester')
const TroveManagerTester = artifacts.require("TroveManagerTester")
const NonPayable = artifacts.require("./NonPayable.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const assertRevert = th.assertRevert

const toBN = th.toBN
const ZERO = th.toBN('0')

const GAS_PRICE = 10000000

/* NOTE: These tests do not test for specific ETH and XBRL gain values. They only test that the 
 * gains are non-zero, occur when they should, and are in correct proportion to the user's stake. 
 *
 * Specific ETH/XBRL gain values will depend on the final fee schedule used, and the final choices for
 * parameters BETA and MINUTE_DECAY_FACTOR in the TroveManager, which are still TBD based on economic
 * modelling.
 * 
 */ 

contract('STBLStaking revenue share tests', async accounts => {

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)
  
  const [owner, A, B, C, D, E, F, G, whale] = accounts;

  let priceFeed
  let xbrlToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let stblStaking
  let stblToken

  let contracts

  const openTrove = async (params) => th.openTrove(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts = await deploymentHelper.deployXBRLTokenTester(contracts)
    const STBLContracts = await deploymentHelper.deploySTBLTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)
    
    await deploymentHelper.connectSTBLContracts(STBLContracts)
    await deploymentHelper.connectCoreContracts(contracts, STBLContracts)
    await deploymentHelper.connectSTBLContractsToCore(STBLContracts, contracts)

    nonPayable = await NonPayable.new() 
    priceFeed = contracts.priceFeedTestnet
    xbrlToken = contracts.xbrlToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    stblToken = STBLContracts.stblToken
    stblStaking = STBLContracts.stblStaking
  })

  it('stake(): reverts if amount is zero', async () => {
    // FF time one year so owner can transfer STBL
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers STBL to staker A
    await stblToken.transfer(A, dec(100, 18), {from: multisig})

    // console.log(`A stbl bal: ${await stblToken.balanceOf(A)}`)

    // A makes stake
    await stblToken.approve(stblStaking.address, dec(100, 18), {from: A})
    await assertRevert(stblStaking.stake(0, {from: A}), "STBLStaking: Amount must be non-zero")
  })

  it("ETH fee per STBL staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await openTrove({ extraXBRLAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraXBRLAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraXBRLAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraXBRLAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

    // FF time one year so owner can transfer STBL
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers STBL to staker A
    await stblToken.transfer(A, dec(100, 18), {from: multisig, gasPrice: GAS_PRICE})

    // console.log(`A stbl bal: ${await stblToken.balanceOf(A)}`)

    // A makes stake
    await stblToken.approve(stblStaking.address, dec(100, 18), {from: A})
    await stblStaking.stake(dec(100, 18), {from: A})

    // Check ETH fee per unit staked is zero
    const F_ETH_Before = await stblStaking.F_ETH()
    assert.equal(F_ETH_Before, '0')

    const B_BalBeforeREdemption = await xbrlToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), GAS_PRICE)
    
    const B_BalAfterRedemption = await xbrlToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee emitted in event is non-zero
    const emittedETHFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedETHFee.gt(toBN('0')))

    // Check ETH fee per unit staked has increased by correct amount
    const F_ETH_After = await stblStaking.F_ETH()

    // Expect fee per unit staked = fee/100, since there is 100 XBRL totalStaked
    const expected_F_ETH_After = emittedETHFee.div(toBN('100')) 

    assert.isTrue(expected_F_ETH_After.eq(F_ETH_After))
  })

  it("ETH fee per STBL staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await openTrove({ extraXBRLAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraXBRLAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraXBRLAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraXBRLAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraXBRLAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer STBL
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers STBL to staker A
    await stblToken.transfer(A, dec(100, 18), {from: multisig, gasPrice: GAS_PRICE})

    // Check ETH fee per unit staked is zero
    const F_ETH_Before = await stblStaking.F_ETH()
    assert.equal(F_ETH_Before, '0')

    const B_BalBeforeREdemption = await xbrlToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), GAS_PRICE)
    
    const B_BalAfterRedemption = await xbrlToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee emitted in event is non-zero
    const emittedETHFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedETHFee.gt(toBN('0')))

    // Check ETH fee per unit staked has not increased 
    const F_ETH_After = await stblStaking.F_ETH()
    assert.equal(F_ETH_After, '0')
  })

  it("XBRL fee per STBL staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await openTrove({ extraXBRLAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraXBRLAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraXBRLAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraXBRLAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraXBRLAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer STBL
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers STBL to staker A
    await stblToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await stblToken.approve(stblStaking.address, dec(100, 18), {from: A})
    await stblStaking.stake(dec(100, 18), {from: A})

    // Check XBRL fee per unit staked is zero
    const F_XBRL_Before = await stblStaking.F_ETH()
    assert.equal(F_XBRL_Before, '0')

    const B_BalBeforeREdemption = await xbrlToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice= GAS_PRICE)
    
    const B_BalAfterRedemption = await xbrlToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // Check base rate is now non-zero
    const baseRate = await troveManager.baseRate()
    assert.isTrue(baseRate.gt(toBN('0')))

    // D draws debt
    const tx = await borrowerOperations.withdrawXBRL(th._100pct, dec(27, 18), D, D, {from: D})
    
    // Check XBRL fee value in event is non-zero
    const emittedXBRLFee = toBN(th.getXBRLFeeFromXBRLBorrowingEvent(tx))
    assert.isTrue(emittedXBRLFee.gt(toBN('0')))
    
    // Check XBRL fee per unit staked has increased by correct amount
    const F_XBRL_After = await stblStaking.F_XBRL()

    // Expect fee per unit staked = fee/100, since there is 100 XBRL totalStaked
    const expected_F_XBRL_After = emittedXBRLFee.div(toBN('100')) 

    assert.isTrue(expected_F_XBRL_After.eq(F_XBRL_After))
  })

  it("XBRL fee per STBL staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await openTrove({ extraXBRLAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraXBRLAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraXBRLAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraXBRLAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraXBRLAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer STBL
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers STBL to staker A
    await stblToken.transfer(A, dec(100, 18), {from: multisig})

    // Check XBRL fee per unit staked is zero
    const F_XBRL_Before = await stblStaking.F_ETH()
    assert.equal(F_XBRL_Before, '0')

    const B_BalBeforeREdemption = await xbrlToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const B_BalAfterRedemption = await xbrlToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // Check base rate is now non-zero
    const baseRate = await troveManager.baseRate()
    assert.isTrue(baseRate.gt(toBN('0')))

    // D draws debt
    const tx = await borrowerOperations.withdrawXBRL(th._100pct, dec(27, 18), D, D, {from: D})
    
    // Check XBRL fee value in event is non-zero
    const emittedXBRLFee = toBN(th.getXBRLFeeFromXBRLBorrowingEvent(tx))
    assert.isTrue(emittedXBRLFee.gt(toBN('0')))
    
    // Check XBRL fee per unit staked did not increase, is still zero
    const F_XBRL_After = await stblStaking.F_XBRL()
    assert.equal(F_XBRL_After, '0')
  })

  it("STBL Staking: A single staker earns all ETH and STBL fees that occur", async () => {
    await openTrove({ extraXBRLAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraXBRLAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraXBRLAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraXBRLAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraXBRLAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer STBL
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers STBL to staker A
    await stblToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await stblToken.approve(stblStaking.address, dec(100, 18), {from: A})
    await stblStaking.stake(dec(100, 18), {from: A})

    const B_BalBeforeREdemption = await xbrlToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const B_BalAfterRedemption = await xbrlToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await xbrlToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const C_BalAfterRedemption = await xbrlToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawXBRL(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check XBRL fee value in event is non-zero
    const emittedXBRLFee_1 = toBN(th.getXBRLFeeFromXBRLBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedXBRLFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawXBRL(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check XBRL fee value in event is non-zero
    const emittedXBRLFee_2 = toBN(th.getXBRLFeeFromXBRLBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedXBRLFee_2.gt(toBN('0')))

    const expectedTotalETHGain = emittedETHFee_1.add(emittedETHFee_2)
    const expectedTotalXBRLGain = emittedXBRLFee_1.add(emittedXBRLFee_2)

    const A_ETHBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_XBRLBalance_Before = toBN(await xbrlToken.balanceOf(A))

    // A un-stakes
    const GAS_Used = th.gasUsed(await stblStaking.unstake(dec(100, 18), {from: A, gasPrice: GAS_PRICE }))

    const A_ETHBalance_After = toBN(await web3.eth.getBalance(A))
    const A_XBRLBalance_After = toBN(await xbrlToken.balanceOf(A))


    const A_ETHGain = A_ETHBalance_After.sub(A_ETHBalance_Before).add(toBN(GAS_Used * GAS_PRICE))
    const A_XBRLGain = A_XBRLBalance_After.sub(A_XBRLBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalETHGain, A_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedTotalXBRLGain, A_XBRLGain), 1000)
  })

  it("stake(): Top-up sends out all accumulated ETH and XBRL gains to the staker", async () => { 
    await openTrove({ extraXBRLAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraXBRLAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraXBRLAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraXBRLAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraXBRLAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer STBL
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers STBL to staker A
    await stblToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await stblToken.approve(stblStaking.address, dec(100, 18), {from: A})
    await stblStaking.stake(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await xbrlToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const B_BalAfterRedemption = await xbrlToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await xbrlToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const C_BalAfterRedemption = await xbrlToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawXBRL(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check XBRL fee value in event is non-zero
    const emittedXBRLFee_1 = toBN(th.getXBRLFeeFromXBRLBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedXBRLFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawXBRL(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check XBRL fee value in event is non-zero
    const emittedXBRLFee_2 = toBN(th.getXBRLFeeFromXBRLBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedXBRLFee_2.gt(toBN('0')))

    const expectedTotalETHGain = emittedETHFee_1.add(emittedETHFee_2)
    const expectedTotalXBRLGain = emittedXBRLFee_1.add(emittedXBRLFee_2)

    const A_ETHBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_XBRLBalance_Before = toBN(await xbrlToken.balanceOf(A))

    // A tops up
    const GAS_Used = th.gasUsed(await stblStaking.stake(dec(50, 18), {from: A, gasPrice: GAS_PRICE }))

    const A_ETHBalance_After = toBN(await web3.eth.getBalance(A))
    const A_XBRLBalance_After = toBN(await xbrlToken.balanceOf(A))

    const A_ETHGain = A_ETHBalance_After.sub(A_ETHBalance_Before).add(toBN(GAS_Used * GAS_PRICE))
    const A_XBRLGain = A_XBRLBalance_After.sub(A_XBRLBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalETHGain, A_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedTotalXBRLGain, A_XBRLGain), 1000)
  })

  it("getPendingETHGain(): Returns the staker's correct pending ETH gain", async () => { 
    await openTrove({ extraXBRLAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraXBRLAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraXBRLAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraXBRLAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraXBRLAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer STBL
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers STBL to staker A
    await stblToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await stblToken.approve(stblStaking.address, dec(100, 18), {from: A})
    await stblStaking.stake(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await xbrlToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const B_BalAfterRedemption = await xbrlToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await xbrlToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const C_BalAfterRedemption = await xbrlToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    const expectedTotalETHGain = emittedETHFee_1.add(emittedETHFee_2)

    const A_ETHGain = await stblStaking.getPendingETHGain(A)

    assert.isAtMost(th.getDifference(expectedTotalETHGain, A_ETHGain), 1000)
  })

  it("getPendingXBRLGain(): Returns the staker's correct pending XBRL gain", async () => { 
    await openTrove({ extraXBRLAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraXBRLAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraXBRLAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraXBRLAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraXBRLAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer STBL
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers STBL to staker A
    await stblToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await stblToken.approve(stblStaking.address, dec(100, 18), {from: A})
    await stblStaking.stake(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await xbrlToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const B_BalAfterRedemption = await xbrlToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await xbrlToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const C_BalAfterRedemption = await xbrlToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawXBRL(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check XBRL fee value in event is non-zero
    const emittedXBRLFee_1 = toBN(th.getXBRLFeeFromXBRLBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedXBRLFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawXBRL(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check XBRL fee value in event is non-zero
    const emittedXBRLFee_2 = toBN(th.getXBRLFeeFromXBRLBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedXBRLFee_2.gt(toBN('0')))

    const expectedTotalXBRLGain = emittedXBRLFee_1.add(emittedXBRLFee_2)
    const A_XBRLGain = await stblStaking.getPendingXBRLGain(A)

    assert.isAtMost(th.getDifference(expectedTotalXBRLGain, A_XBRLGain), 1000)
  })

  // - multi depositors, several rewards
  it("STBL Staking: Multiple stakers earn the correct share of all ETH and STBL fees, based on their stake size", async () => {
    await openTrove({ extraXBRLAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraXBRLAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraXBRLAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraXBRLAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraXBRLAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
    await openTrove({ extraXBRLAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
    await openTrove({ extraXBRLAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: F } })
    await openTrove({ extraXBRLAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: G } })

    // FF time one year so owner can transfer STBL
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers STBL to staker A, B, C
    await stblToken.transfer(A, dec(100, 18), {from: multisig})
    await stblToken.transfer(B, dec(200, 18), {from: multisig})
    await stblToken.transfer(C, dec(300, 18), {from: multisig})

    // A, B, C make stake
    await stblToken.approve(stblStaking.address, dec(100, 18), {from: A})
    await stblToken.approve(stblStaking.address, dec(200, 18), {from: B})
    await stblToken.approve(stblStaking.address, dec(300, 18), {from: C})
    await stblStaking.stake(dec(100, 18), {from: A})
    await stblStaking.stake(dec(200, 18), {from: B})
    await stblStaking.stake(dec(300, 18), {from: C})

    // Confirm staking contract holds 600 STBL
    // console.log(`stbl staking STBL bal: ${await stblToken.balanceOf(stblStaking.address)}`)
    assert.equal(await stblToken.balanceOf(stblStaking.address), dec(600, 18))
    assert.equal(await stblStaking.totalSTBLStaked(), dec(600, 18))

    // F redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(F, contracts, dec(45, 18), gasPrice = GAS_PRICE)
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

     // G redeems
     const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(G, contracts, dec(197, 18), gasPrice = GAS_PRICE)
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // F draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawXBRL(th._100pct, dec(104, 18), F, F, {from: F})
    const emittedXBRLFee_1 = toBN(th.getXBRLFeeFromXBRLBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedXBRLFee_1.gt(toBN('0')))

    // G draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawXBRL(th._100pct, dec(17, 18), G, G, {from: G})
    const emittedXBRLFee_2 = toBN(th.getXBRLFeeFromXBRLBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedXBRLFee_2.gt(toBN('0')))

    // D obtains STBL from owner and makes a stake
    await stblToken.transfer(D, dec(50, 18), {from: multisig})
    await stblToken.approve(stblStaking.address, dec(50, 18), {from: D})
    await stblStaking.stake(dec(50, 18), {from: D})

    // Confirm staking contract holds 650 STBL
    assert.equal(await stblToken.balanceOf(stblStaking.address), dec(650, 18))
    assert.equal(await stblStaking.totalSTBLStaked(), dec(650, 18))

     // G redeems
     const redemptionTx_3 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(197, 18), gasPrice = GAS_PRICE)
     const emittedETHFee_3 = toBN((await th.getEmittedRedemptionValues(redemptionTx_3))[3])
     assert.isTrue(emittedETHFee_3.gt(toBN('0')))

     // G draws debt
    const borrowingTx_3 = await borrowerOperations.withdrawXBRL(th._100pct, dec(17, 18), G, G, {from: G})
    const emittedXBRLFee_3 = toBN(th.getXBRLFeeFromXBRLBorrowingEvent(borrowingTx_3))
    assert.isTrue(emittedXBRLFee_3.gt(toBN('0')))
     
    /*  
    Expected rewards:

    A_ETH: (100* ETHFee_1)/600 + (100* ETHFee_2)/600 + (100*ETH_Fee_3)/650
    B_ETH: (200* ETHFee_1)/600 + (200* ETHFee_2)/600 + (200*ETH_Fee_3)/650
    C_ETH: (300* ETHFee_1)/600 + (300* ETHFee_2)/600 + (300*ETH_Fee_3)/650
    D_ETH:                                             (100*ETH_Fee_3)/650

    A_XBRL: (100*XBRLFee_1 )/600 + (100* XBRLFee_2)/600 + (100*XBRLFee_3)/650
    B_XBRL: (200* XBRLFee_1)/600 + (200* XBRLFee_2)/600 + (200*XBRLFee_3)/650
    C_XBRL: (300* XBRLFee_1)/600 + (300* XBRLFee_2)/600 + (300*XBRLFee_3)/650
    D_XBRL:                                               (100*XBRLFee_3)/650
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

    // Expected XBRL gains:
    const expectedXBRLGain_A = toBN('100').mul(emittedXBRLFee_1).div( toBN('600'))
                            .add(toBN('100').mul(emittedXBRLFee_2).div( toBN('600')))
                            .add(toBN('100').mul(emittedXBRLFee_3).div( toBN('650')))

    const expectedXBRLGain_B = toBN('200').mul(emittedXBRLFee_1).div( toBN('600'))
                            .add(toBN('200').mul(emittedXBRLFee_2).div( toBN('600')))
                            .add(toBN('200').mul(emittedXBRLFee_3).div( toBN('650')))

    const expectedXBRLGain_C = toBN('300').mul(emittedXBRLFee_1).div( toBN('600'))
                            .add(toBN('300').mul(emittedXBRLFee_2).div( toBN('600')))
                            .add(toBN('300').mul(emittedXBRLFee_3).div( toBN('650')))
    
    const expectedXBRLGain_D = toBN('50').mul(emittedXBRLFee_3).div( toBN('650'))


    const A_ETHBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_XBRLBalance_Before = toBN(await xbrlToken.balanceOf(A))
    const B_ETHBalance_Before = toBN(await web3.eth.getBalance(B))
    const B_XBRLBalance_Before = toBN(await xbrlToken.balanceOf(B))
    const C_ETHBalance_Before = toBN(await web3.eth.getBalance(C))
    const C_XBRLBalance_Before = toBN(await xbrlToken.balanceOf(C))
    const D_ETHBalance_Before = toBN(await web3.eth.getBalance(D))
    const D_XBRLBalance_Before = toBN(await xbrlToken.balanceOf(D))

    // A-D un-stake
    const A_GAS_Used = th.gasUsed(await stblStaking.unstake(dec(100, 18), {from: A, gasPrice: GAS_PRICE }))
    const B_GAS_Used = th.gasUsed(await stblStaking.unstake(dec(200, 18), {from: B, gasPrice: GAS_PRICE }))
    const C_GAS_Used = th.gasUsed(await stblStaking.unstake(dec(400, 18), {from: C, gasPrice: GAS_PRICE }))
    const D_GAS_Used = th.gasUsed(await stblStaking.unstake(dec(50, 18), {from: D, gasPrice: GAS_PRICE }))

    // Confirm all depositors could withdraw

    //Confirm pool Size is now 0
    assert.equal((await stblToken.balanceOf(stblStaking.address)), '0')
    assert.equal((await stblStaking.totalSTBLStaked()), '0')

    // Get A-D ETH and XBRL balances
    const A_ETHBalance_After = toBN(await web3.eth.getBalance(A))
    const A_XBRLBalance_After = toBN(await xbrlToken.balanceOf(A))
    const B_ETHBalance_After = toBN(await web3.eth.getBalance(B))
    const B_XBRLBalance_After = toBN(await xbrlToken.balanceOf(B))
    const C_ETHBalance_After = toBN(await web3.eth.getBalance(C))
    const C_XBRLBalance_After = toBN(await xbrlToken.balanceOf(C))
    const D_ETHBalance_After = toBN(await web3.eth.getBalance(D))
    const D_XBRLBalance_After = toBN(await xbrlToken.balanceOf(D))

    // Get ETH and XBRL gains
    const A_ETHGain = A_ETHBalance_After.sub(A_ETHBalance_Before).add(toBN(A_GAS_Used * GAS_PRICE))
    const A_XBRLGain = A_XBRLBalance_After.sub(A_XBRLBalance_Before)
    const B_ETHGain = B_ETHBalance_After.sub(B_ETHBalance_Before).add(toBN(B_GAS_Used * GAS_PRICE))
    const B_XBRLGain = B_XBRLBalance_After.sub(B_XBRLBalance_Before)
    const C_ETHGain = C_ETHBalance_After.sub(C_ETHBalance_Before).add(toBN(C_GAS_Used * GAS_PRICE))
    const C_XBRLGain = C_XBRLBalance_After.sub(C_XBRLBalance_Before)
    const D_ETHGain = D_ETHBalance_After.sub(D_ETHBalance_Before).add(toBN(D_GAS_Used * GAS_PRICE))
    const D_XBRLGain = D_XBRLBalance_After.sub(D_XBRLBalance_Before)

    // Check gains match expected amounts
    assert.isAtMost(th.getDifference(expectedETHGain_A, A_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedXBRLGain_A, A_XBRLGain), 1000)
    assert.isAtMost(th.getDifference(expectedETHGain_B, B_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedXBRLGain_B, B_XBRLGain), 1000)
    assert.isAtMost(th.getDifference(expectedETHGain_C, C_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedXBRLGain_C, C_XBRLGain), 1000)
    assert.isAtMost(th.getDifference(expectedETHGain_D, D_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedXBRLGain_D, D_XBRLGain), 1000)
  })
 
  it("unstake(): reverts if caller has ETH gains and can't receive ETH",  async () => {
    await openTrove({ extraXBRLAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })  
    await openTrove({ extraXBRLAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraXBRLAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraXBRLAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraXBRLAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers STBL to staker A and the non-payable proxy
    await stblToken.transfer(A, dec(100, 18), {from: multisig})
    await stblToken.transfer(nonPayable.address, dec(100, 18), {from: multisig})

    //  A makes stake
    const A_stakeTx = await stblStaking.stake(dec(100, 18), {from: A})
    assert.isTrue(A_stakeTx.receipt.status)

    //  A tells proxy to make a stake
    const proxystakeTxData = await th.getTransactionData('stake(uint256)', ['0x56bc75e2d63100000'])  // proxy stakes 100 STBL
    await nonPayable.forward(stblStaking.address, proxystakeTxData, {from: A})


    // B makes a redemption, creating ETH gain for proxy
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(45, 18), gasPrice = GAS_PRICE)
    
    const proxy_ETHGain = await stblStaking.getPendingETHGain(nonPayable.address)
    assert.isTrue(proxy_ETHGain.gt(toBN('0')))

    // Expect this tx to revert: stake() tries to send nonPayable proxy's accumulated ETH gain (albeit 0),
    //  A tells proxy to unstake
    const proxyUnStakeTxData = await th.getTransactionData('unstake(uint256)', ['0x56bc75e2d63100000'])  // proxy stakes 100 STBL
    const proxyUnstakeTxPromise = nonPayable.forward(stblStaking.address, proxyUnStakeTxData, {from: A})
   
    // but nonPayable proxy can not accept ETH - therefore stake() reverts.
    await assertRevert(proxyUnstakeTxPromise)
  })

  it("receive(): reverts when it receives ETH from an address that is not the Active Pool",  async () => { 
    const ethSendTxPromise1 = web3.eth.sendTransaction({to: stblStaking.address, from: A, value: dec(1, 'ether')})
    const ethSendTxPromise2 = web3.eth.sendTransaction({to: stblStaking.address, from: owner, value: dec(1, 'ether')})

    await assertRevert(ethSendTxPromise1)
    await assertRevert(ethSendTxPromise2)
  })

  it("unstake(): reverts if user has no stake",  async () => {  
    const unstakeTxPromise1 = stblStaking.unstake(1, {from: A})
    const unstakeTxPromise2 = stblStaking.unstake(1, {from: owner})

    await assertRevert(unstakeTxPromise1)
    await assertRevert(unstakeTxPromise2)
  })

  it('Test requireCallerIsTroveManager', async () => {
    const stblStakingTester = await STBLStakingTester.new()
    await assertRevert(stblStakingTester.requireCallerIsTroveManager(), 'STBLStaking: caller is not TroveM')
  })
})
