const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")

const LQTYStakingTester = artifacts.require('LQTYStakingTester')
const TroveManagerTester = artifacts.require("TroveManagerTester")
const NonPayable = artifacts.require("./NonPayable.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const assertRevert = th.assertRevert

const toBN = th.toBN
const ZERO = th.toBN('0')

const GAS_PRICE = 10000000

/* NOTE: These tests do not test for specific ONE and 1USD gain values. They only test that the 
 * gains are non-zero, occur when they should, and are in correct proportion to the user's stake. 
 *
 * Specific ONE/1USD gain values will depend on the final fee schedule used, and the final choices for
 * parameters BETA and MINUTE_DECAY_FACTOR in the TroveManager, which are still TBD based on economic
 * modelling.
 * 
 */

contract('LQTYStaking revenue share tests', async accounts => {

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  const [owner, A, B, C, D, E, F, G, whale] = accounts;

  let priceFeed
  let oneusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let lqtyStaking
  let lqtyToken

  let contracts

  const openTrove = async (params) => th.openTrove(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts = await deploymentHelper.deploy1USDTokenTester(contracts)
    const LQTYContracts = await deploymentHelper.deployLQTYTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

    nonPayable = await NonPayable.new()
    priceFeed = contracts.priceFeedTestnet
    oneusdToken = contracts.oneusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    lqtyToken = LQTYContracts.lqtyToken
    lqtyStaking = LQTYContracts.lqtyStaking
  })

  it('stake(): reverts if amount is zero', async () => {
    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), { from: multisig })

    // console.log(`A lqty bal: ${await lqtyToken.balanceOf(A)}`)

    // A makes stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), { from: A })
    await assertRevert(lqtyStaking.stake(0, { from: A }), "LQTYStaking: Amount must be non-zero")
  })

  it("ONE fee per LQTY staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await openTrove({ extra1USDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extra1USDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extra1USDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extra1USDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), { from: multisig, gasPrice: GAS_PRICE })

    // console.log(`A lqty bal: ${await lqtyToken.balanceOf(A)}`)

    // A makes stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), { from: A })
    await lqtyStaking.stake(dec(100, 18), { from: A })

    // Check ONE fee per unit staked is zero
    const F_ONE_Before = await lqtyStaking.F_ONE()
    assert.equal(F_ONE_Before, '0')

    const B_BalBeforeREdemption = await oneusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), GAS_PRICE)

    const B_BalAfterRedemption = await oneusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ONE fee emitted in event is non-zero
    const emittedONEFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedONEFee.gt(toBN('0')))

    // Check ONE fee per unit staked has increased by correct amount
    const F_ONE_After = await lqtyStaking.F_ONE()

    // Expect fee per unit staked = fee/100, since there is 100 1USD totalStaked
    const expected_F_ONE_After = emittedONEFee.div(toBN('100'))

    assert.isTrue(expected_F_ONE_After.eq(F_ONE_After))
  })

  it("ONE fee per LQTY staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await openTrove({ extra1USDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extra1USDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extra1USDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extra1USDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extra1USDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), { from: multisig, gasPrice: GAS_PRICE })

    // Check ONE fee per unit staked is zero
    const F_ONE_Before = await lqtyStaking.F_ONE()
    assert.equal(F_ONE_Before, '0')

    const B_BalBeforeREdemption = await oneusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), GAS_PRICE)

    const B_BalAfterRedemption = await oneusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ONE fee emitted in event is non-zero
    const emittedONEFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedONEFee.gt(toBN('0')))

    // Check ONE fee per unit staked has not increased 
    const F_ONE_After = await lqtyStaking.F_ONE()
    assert.equal(F_ONE_After, '0')
  })

  it("1USD fee per LQTY staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await openTrove({ extra1USDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extra1USDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extra1USDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extra1USDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extra1USDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), { from: multisig })

    // A makes stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), { from: A })
    await lqtyStaking.stake(dec(100, 18), { from: A })

    // Check 1USD fee per unit staked is zero
    const F_1USD_Before = await lqtyStaking.F_ONE()
    assert.equal(F_1USD_Before, '0')

    const B_BalBeforeREdemption = await oneusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)

    const B_BalAfterRedemption = await oneusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // Check base rate is now non-zero
    const baseRate = await troveManager.baseRate()
    assert.isTrue(baseRate.gt(toBN('0')))

    // D draws debt
    const tx = await borrowerOperations.withdraw1USD(th._100pct, dec(27, 18), D, D, { from: D })

    // Check 1USD fee value in event is non-zero
    const emitted1USDFee = toBN(th.get1USDFeeFrom1USDBorrowingEvent(tx))
    assert.isTrue(emitted1USDFee.gt(toBN('0')))

    // Check 1USD fee per unit staked has increased by correct amount
    const F_1USD_After = await lqtyStaking.F_1USD()

    // Expect fee per unit staked = fee/100, since there is 100 1USD totalStaked
    const expected_F_1USD_After = emitted1USDFee.div(toBN('100'))

    assert.isTrue(expected_F_1USD_After.eq(F_1USD_After))
  })

  it("1USD fee per LQTY staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await openTrove({ extra1USDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extra1USDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extra1USDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extra1USDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extra1USDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), { from: multisig })

    // Check 1USD fee per unit staked is zero
    const F_1USD_Before = await lqtyStaking.F_ONE()
    assert.equal(F_1USD_Before, '0')

    const B_BalBeforeREdemption = await oneusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)

    const B_BalAfterRedemption = await oneusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // Check base rate is now non-zero
    const baseRate = await troveManager.baseRate()
    assert.isTrue(baseRate.gt(toBN('0')))

    // D draws debt
    const tx = await borrowerOperations.withdraw1USD(th._100pct, dec(27, 18), D, D, { from: D })

    // Check 1USD fee value in event is non-zero
    const emitted1USDFee = toBN(th.get1USDFeeFrom1USDBorrowingEvent(tx))
    assert.isTrue(emitted1USDFee.gt(toBN('0')))

    // Check 1USD fee per unit staked did not increase, is still zero
    const F_1USD_After = await lqtyStaking.F_1USD()
    assert.equal(F_1USD_After, '0')
  })

  it("LQTY Staking: A single staker earns all ONE and LQTY fees that occur", async () => {
    await openTrove({ extra1USDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extra1USDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extra1USDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extra1USDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extra1USDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), { from: multisig })

    // A makes stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), { from: A })
    await lqtyStaking.stake(dec(100, 18), { from: A })

    const B_BalBeforeREdemption = await oneusdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)

    const B_BalAfterRedemption = await oneusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ONE fee 1 emitted in event is non-zero
    const emittedONEFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedONEFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await oneusdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18), gasPrice = GAS_PRICE)

    const C_BalAfterRedemption = await oneusdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))

    // check ONE fee 2 emitted in event is non-zero
    const emittedONEFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
    assert.isTrue(emittedONEFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdraw1USD(th._100pct, dec(104, 18), D, D, { from: D })

    // Check 1USD fee value in event is non-zero
    const emitted1USDFee_1 = toBN(th.get1USDFeeFrom1USDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emitted1USDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdraw1USD(th._100pct, dec(17, 18), B, B, { from: B })

    // Check 1USD fee value in event is non-zero
    const emitted1USDFee_2 = toBN(th.get1USDFeeFrom1USDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emitted1USDFee_2.gt(toBN('0')))

    const expectedTotalONEGain = emittedONEFee_1.add(emittedONEFee_2)
    const expectedTotal1USDGain = emitted1USDFee_1.add(emitted1USDFee_2)

    const A_ONEBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_1USDBalance_Before = toBN(await oneusdToken.balanceOf(A))

    // A un-stakes
    const GAS_Used = th.gasUsed(await lqtyStaking.unstake(dec(100, 18), { from: A, gasPrice: GAS_PRICE }))

    const A_ONEBalance_After = toBN(await web3.eth.getBalance(A))
    const A_1USDBalance_After = toBN(await oneusdToken.balanceOf(A))


    const A_ONEGain = A_ONEBalance_After.sub(A_ONEBalance_Before).add(toBN(GAS_Used * GAS_PRICE))
    const A_1USDGain = A_1USDBalance_After.sub(A_1USDBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalONEGain, A_ONEGain), 1000)
    assert.isAtMost(th.getDifference(expectedTotal1USDGain, A_1USDGain), 1000)
  })

  it("stake(): Top-up sends out all accumulated ONE and 1USD gains to the staker", async () => {
    await openTrove({ extra1USDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extra1USDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extra1USDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extra1USDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extra1USDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), { from: multisig })

    // A makes stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), { from: A })
    await lqtyStaking.stake(dec(50, 18), { from: A })

    const B_BalBeforeREdemption = await oneusdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)

    const B_BalAfterRedemption = await oneusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ONE fee 1 emitted in event is non-zero
    const emittedONEFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedONEFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await oneusdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18), gasPrice = GAS_PRICE)

    const C_BalAfterRedemption = await oneusdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))

    // check ONE fee 2 emitted in event is non-zero
    const emittedONEFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
    assert.isTrue(emittedONEFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdraw1USD(th._100pct, dec(104, 18), D, D, { from: D })

    // Check 1USD fee value in event is non-zero
    const emitted1USDFee_1 = toBN(th.get1USDFeeFrom1USDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emitted1USDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdraw1USD(th._100pct, dec(17, 18), B, B, { from: B })

    // Check 1USD fee value in event is non-zero
    const emitted1USDFee_2 = toBN(th.get1USDFeeFrom1USDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emitted1USDFee_2.gt(toBN('0')))

    const expectedTotalONEGain = emittedONEFee_1.add(emittedONEFee_2)
    const expectedTotal1USDGain = emitted1USDFee_1.add(emitted1USDFee_2)

    const A_ONEBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_1USDBalance_Before = toBN(await oneusdToken.balanceOf(A))

    // A tops up
    const GAS_Used = th.gasUsed(await lqtyStaking.stake(dec(50, 18), { from: A, gasPrice: GAS_PRICE }))

    const A_ONEBalance_After = toBN(await web3.eth.getBalance(A))
    const A_1USDBalance_After = toBN(await oneusdToken.balanceOf(A))

    const A_ONEGain = A_ONEBalance_After.sub(A_ONEBalance_Before).add(toBN(GAS_Used * GAS_PRICE))
    const A_1USDGain = A_1USDBalance_After.sub(A_1USDBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalONEGain, A_ONEGain), 1000)
    assert.isAtMost(th.getDifference(expectedTotal1USDGain, A_1USDGain), 1000)
  })

  it("getPendingONEGain(): Returns the staker's correct pending ONE gain", async () => {
    await openTrove({ extra1USDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extra1USDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extra1USDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extra1USDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extra1USDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), { from: multisig })

    // A makes stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), { from: A })
    await lqtyStaking.stake(dec(50, 18), { from: A })

    const B_BalBeforeREdemption = await oneusdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)

    const B_BalAfterRedemption = await oneusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ONE fee 1 emitted in event is non-zero
    const emittedONEFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedONEFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await oneusdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18), gasPrice = GAS_PRICE)

    const C_BalAfterRedemption = await oneusdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))

    // check ONE fee 2 emitted in event is non-zero
    const emittedONEFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
    assert.isTrue(emittedONEFee_2.gt(toBN('0')))

    const expectedTotalONEGain = emittedONEFee_1.add(emittedONEFee_2)

    const A_ONEGain = await lqtyStaking.getPendingONEGain(A)

    assert.isAtMost(th.getDifference(expectedTotalONEGain, A_ONEGain), 1000)
  })

  it("getPending1USDGain(): Returns the staker's correct pending 1USD gain", async () => {
    await openTrove({ extra1USDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extra1USDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extra1USDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extra1USDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extra1USDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers LQTY to staker A
    await lqtyToken.transfer(A, dec(100, 18), { from: multisig })

    // A makes stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), { from: A })
    await lqtyStaking.stake(dec(50, 18), { from: A })

    const B_BalBeforeREdemption = await oneusdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)

    const B_BalAfterRedemption = await oneusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ONE fee 1 emitted in event is non-zero
    const emittedONEFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedONEFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await oneusdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18), gasPrice = GAS_PRICE)

    const C_BalAfterRedemption = await oneusdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))

    // check ONE fee 2 emitted in event is non-zero
    const emittedONEFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
    assert.isTrue(emittedONEFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdraw1USD(th._100pct, dec(104, 18), D, D, { from: D })

    // Check 1USD fee value in event is non-zero
    const emitted1USDFee_1 = toBN(th.get1USDFeeFrom1USDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emitted1USDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdraw1USD(th._100pct, dec(17, 18), B, B, { from: B })

    // Check 1USD fee value in event is non-zero
    const emitted1USDFee_2 = toBN(th.get1USDFeeFrom1USDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emitted1USDFee_2.gt(toBN('0')))

    const expectedTotal1USDGain = emitted1USDFee_1.add(emitted1USDFee_2)
    const A_1USDGain = await lqtyStaking.getPending1USDGain(A)

    assert.isAtMost(th.getDifference(expectedTotal1USDGain, A_1USDGain), 1000)
  })

  // - multi depositors, several rewards
  it("LQTY Staking: Multiple stakers earn the correct share of all ONE and LQTY fees, based on their stake size", async () => {
    await openTrove({ extra1USDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extra1USDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extra1USDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extra1USDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extra1USDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
    await openTrove({ extra1USDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
    await openTrove({ extra1USDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: F } })
    await openTrove({ extra1USDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: G } })

    // FF time one year so owner can transfer LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers LQTY to staker A, B, C
    await lqtyToken.transfer(A, dec(100, 18), { from: multisig })
    await lqtyToken.transfer(B, dec(200, 18), { from: multisig })
    await lqtyToken.transfer(C, dec(300, 18), { from: multisig })

    // A, B, C make stake
    await lqtyToken.approve(lqtyStaking.address, dec(100, 18), { from: A })
    await lqtyToken.approve(lqtyStaking.address, dec(200, 18), { from: B })
    await lqtyToken.approve(lqtyStaking.address, dec(300, 18), { from: C })
    await lqtyStaking.stake(dec(100, 18), { from: A })
    await lqtyStaking.stake(dec(200, 18), { from: B })
    await lqtyStaking.stake(dec(300, 18), { from: C })

    // Confirm staking contract holds 600 LQTY
    // console.log(`lqty staking LQTY bal: ${await lqtyToken.balanceOf(lqtyStaking.address)}`)
    assert.equal(await lqtyToken.balanceOf(lqtyStaking.address), dec(600, 18))
    assert.equal(await lqtyStaking.totalLQTYStaked(), dec(600, 18))

    // F redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(F, contracts, dec(45, 18), gasPrice = GAS_PRICE)
    const emittedONEFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedONEFee_1.gt(toBN('0')))

    // G redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(G, contracts, dec(197, 18), gasPrice = GAS_PRICE)
    const emittedONEFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
    assert.isTrue(emittedONEFee_2.gt(toBN('0')))

    // F draws debt
    const borrowingTx_1 = await borrowerOperations.withdraw1USD(th._100pct, dec(104, 18), F, F, { from: F })
    const emitted1USDFee_1 = toBN(th.get1USDFeeFrom1USDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emitted1USDFee_1.gt(toBN('0')))

    // G draws debt
    const borrowingTx_2 = await borrowerOperations.withdraw1USD(th._100pct, dec(17, 18), G, G, { from: G })
    const emitted1USDFee_2 = toBN(th.get1USDFeeFrom1USDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emitted1USDFee_2.gt(toBN('0')))

    // D obtains LQTY from owner and makes a stake
    await lqtyToken.transfer(D, dec(50, 18), { from: multisig })
    await lqtyToken.approve(lqtyStaking.address, dec(50, 18), { from: D })
    await lqtyStaking.stake(dec(50, 18), { from: D })

    // Confirm staking contract holds 650 LQTY
    assert.equal(await lqtyToken.balanceOf(lqtyStaking.address), dec(650, 18))
    assert.equal(await lqtyStaking.totalLQTYStaked(), dec(650, 18))

    // G redeems
    const redemptionTx_3 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(197, 18), gasPrice = GAS_PRICE)
    const emittedONEFee_3 = toBN((await th.getEmittedRedemptionValues(redemptionTx_3))[3])
    assert.isTrue(emittedONEFee_3.gt(toBN('0')))

    // G draws debt
    const borrowingTx_3 = await borrowerOperations.withdraw1USD(th._100pct, dec(17, 18), G, G, { from: G })
    const emitted1USDFee_3 = toBN(th.get1USDFeeFrom1USDBorrowingEvent(borrowingTx_3))
    assert.isTrue(emitted1USDFee_3.gt(toBN('0')))

    /*  
    Expected rewards:

    A_ONE: (100* ONEFee_1)/600 + (100* ONEFee_2)/600 + (100*ONE_Fee_3)/650
    B_ONE: (200* ONEFee_1)/600 + (200* ONEFee_2)/600 + (200*ONE_Fee_3)/650
    C_ONE: (300* ONEFee_1)/600 + (300* ONEFee_2)/600 + (300*ONE_Fee_3)/650
    D_ONE:                                             (100*ONE_Fee_3)/650

    A_1USD: (100*1USDFee_1 )/600 + (100* 1USDFee_2)/600 + (100*1USDFee_3)/650
    B_1USD: (200* 1USDFee_1)/600 + (200* 1USDFee_2)/600 + (200*1USDFee_3)/650
    C_1USD: (300* 1USDFee_1)/600 + (300* 1USDFee_2)/600 + (300*1USDFee_3)/650
    D_1USD:                                               (100*1USDFee_3)/650
    */

    // Expected ONE gains
    const expectedONEGain_A = toBN('100').mul(emittedONEFee_1).div(toBN('600'))
      .add(toBN('100').mul(emittedONEFee_2).div(toBN('600')))
      .add(toBN('100').mul(emittedONEFee_3).div(toBN('650')))

    const expectedONEGain_B = toBN('200').mul(emittedONEFee_1).div(toBN('600'))
      .add(toBN('200').mul(emittedONEFee_2).div(toBN('600')))
      .add(toBN('200').mul(emittedONEFee_3).div(toBN('650')))

    const expectedONEGain_C = toBN('300').mul(emittedONEFee_1).div(toBN('600'))
      .add(toBN('300').mul(emittedONEFee_2).div(toBN('600')))
      .add(toBN('300').mul(emittedONEFee_3).div(toBN('650')))

    const expectedONEGain_D = toBN('50').mul(emittedONEFee_3).div(toBN('650'))

    // Expected 1USD gains:
    const expected1USDGain_A = toBN('100').mul(emitted1USDFee_1).div(toBN('600'))
      .add(toBN('100').mul(emitted1USDFee_2).div(toBN('600')))
      .add(toBN('100').mul(emitted1USDFee_3).div(toBN('650')))

    const expected1USDGain_B = toBN('200').mul(emitted1USDFee_1).div(toBN('600'))
      .add(toBN('200').mul(emitted1USDFee_2).div(toBN('600')))
      .add(toBN('200').mul(emitted1USDFee_3).div(toBN('650')))

    const expected1USDGain_C = toBN('300').mul(emitted1USDFee_1).div(toBN('600'))
      .add(toBN('300').mul(emitted1USDFee_2).div(toBN('600')))
      .add(toBN('300').mul(emitted1USDFee_3).div(toBN('650')))

    const expected1USDGain_D = toBN('50').mul(emitted1USDFee_3).div(toBN('650'))


    const A_ONEBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_1USDBalance_Before = toBN(await oneusdToken.balanceOf(A))
    const B_ONEBalance_Before = toBN(await web3.eth.getBalance(B))
    const B_1USDBalance_Before = toBN(await oneusdToken.balanceOf(B))
    const C_ONEBalance_Before = toBN(await web3.eth.getBalance(C))
    const C_1USDBalance_Before = toBN(await oneusdToken.balanceOf(C))
    const D_ONEBalance_Before = toBN(await web3.eth.getBalance(D))
    const D_1USDBalance_Before = toBN(await oneusdToken.balanceOf(D))

    // A-D un-stake
    const A_GAS_Used = th.gasUsed(await lqtyStaking.unstake(dec(100, 18), { from: A, gasPrice: GAS_PRICE }))
    const B_GAS_Used = th.gasUsed(await lqtyStaking.unstake(dec(200, 18), { from: B, gasPrice: GAS_PRICE }))
    const C_GAS_Used = th.gasUsed(await lqtyStaking.unstake(dec(400, 18), { from: C, gasPrice: GAS_PRICE }))
    const D_GAS_Used = th.gasUsed(await lqtyStaking.unstake(dec(50, 18), { from: D, gasPrice: GAS_PRICE }))

    // Confirm all depositors could withdraw

    //Confirm pool Size is now 0
    assert.equal((await lqtyToken.balanceOf(lqtyStaking.address)), '0')
    assert.equal((await lqtyStaking.totalLQTYStaked()), '0')

    // Get A-D ONE and 1USD balances
    const A_ONEBalance_After = toBN(await web3.eth.getBalance(A))
    const A_1USDBalance_After = toBN(await oneusdToken.balanceOf(A))
    const B_ONEBalance_After = toBN(await web3.eth.getBalance(B))
    const B_1USDBalance_After = toBN(await oneusdToken.balanceOf(B))
    const C_ONEBalance_After = toBN(await web3.eth.getBalance(C))
    const C_1USDBalance_After = toBN(await oneusdToken.balanceOf(C))
    const D_ONEBalance_After = toBN(await web3.eth.getBalance(D))
    const D_1USDBalance_After = toBN(await oneusdToken.balanceOf(D))

    // Get ONE and 1USD gains
    const A_ONEGain = A_ONEBalance_After.sub(A_ONEBalance_Before).add(toBN(A_GAS_Used * GAS_PRICE))
    const A_1USDGain = A_1USDBalance_After.sub(A_1USDBalance_Before)
    const B_ONEGain = B_ONEBalance_After.sub(B_ONEBalance_Before).add(toBN(B_GAS_Used * GAS_PRICE))
    const B_1USDGain = B_1USDBalance_After.sub(B_1USDBalance_Before)
    const C_ONEGain = C_ONEBalance_After.sub(C_ONEBalance_Before).add(toBN(C_GAS_Used * GAS_PRICE))
    const C_1USDGain = C_1USDBalance_After.sub(C_1USDBalance_Before)
    const D_ONEGain = D_ONEBalance_After.sub(D_ONEBalance_Before).add(toBN(D_GAS_Used * GAS_PRICE))
    const D_1USDGain = D_1USDBalance_After.sub(D_1USDBalance_Before)

    // Check gains match expected amounts
    assert.isAtMost(th.getDifference(expectedONEGain_A, A_ONEGain), 1000)
    assert.isAtMost(th.getDifference(expected1USDGain_A, A_1USDGain), 1000)
    assert.isAtMost(th.getDifference(expectedONEGain_B, B_ONEGain), 1000)
    assert.isAtMost(th.getDifference(expected1USDGain_B, B_1USDGain), 1000)
    assert.isAtMost(th.getDifference(expectedONEGain_C, C_ONEGain), 1000)
    assert.isAtMost(th.getDifference(expected1USDGain_C, C_1USDGain), 1000)
    assert.isAtMost(th.getDifference(expectedONEGain_D, D_ONEGain), 1000)
    assert.isAtMost(th.getDifference(expected1USDGain_D, D_1USDGain), 1000)
  })

  it("unstake(): reverts if caller has ONE gains and can't receive ONE", async () => {
    await openTrove({ extra1USDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
    await openTrove({ extra1USDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extra1USDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extra1USDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extra1USDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers LQTY to staker A and the non-payable proxy
    await lqtyToken.transfer(A, dec(100, 18), { from: multisig })
    await lqtyToken.transfer(nonPayable.address, dec(100, 18), { from: multisig })

    //  A makes stake
    const A_stakeTx = await lqtyStaking.stake(dec(100, 18), { from: A })
    assert.isTrue(A_stakeTx.receipt.status)

    //  A tells proxy to make a stake
    const proxystakeTxData = await th.getTransactionData('stake(uint256)', ['0x56bc75e2d63100000'])  // proxy stakes 100 LQTY
    await nonPayable.forward(lqtyStaking.address, proxystakeTxData, { from: A })


    // B makes a redemption, creating ONE gain for proxy
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(45, 18), gasPrice = GAS_PRICE)

    const proxy_ONEGain = await lqtyStaking.getPendingONEGain(nonPayable.address)
    assert.isTrue(proxy_ONEGain.gt(toBN('0')))

    // Expect this tx to revert: stake() tries to send nonPayable proxy's accumulated ONE gain (albeit 0),
    //  A tells proxy to unstake
    const proxyUnStakeTxData = await th.getTransactionData('unstake(uint256)', ['0x56bc75e2d63100000'])  // proxy stakes 100 LQTY
    const proxyUnstakeTxPromise = nonPayable.forward(lqtyStaking.address, proxyUnStakeTxData, { from: A })

    // but nonPayable proxy can not accept ONE - therefore stake() reverts.
    await assertRevert(proxyUnstakeTxPromise)
  })

  it("receive(): reverts when it receives ONE from an address that is not the Active Pool", async () => {
    const ethSendTxPromise1 = web3.eth.sendTransaction({ to: lqtyStaking.address, from: A, value: dec(1, 'ether') })
    const ethSendTxPromise2 = web3.eth.sendTransaction({ to: lqtyStaking.address, from: owner, value: dec(1, 'ether') })

    await assertRevert(ethSendTxPromise1)
    await assertRevert(ethSendTxPromise2)
  })

  it("unstake(): reverts if user has no stake", async () => {
    const unstakeTxPromise1 = lqtyStaking.unstake(1, { from: A })
    const unstakeTxPromise2 = lqtyStaking.unstake(1, { from: owner })

    await assertRevert(unstakeTxPromise1)
    await assertRevert(unstakeTxPromise2)
  })

  it('Test requireCallerIsTroveManager', async () => {
    const lqtyStakingTester = await LQTYStakingTester.new()
    await assertRevert(lqtyStakingTester.requireCallerIsTroveManager(), 'LQTYStaking: caller is not TroveM')
  })
})
