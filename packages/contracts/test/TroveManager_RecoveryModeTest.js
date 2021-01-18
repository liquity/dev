const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec
const assertRevert = th.assertRevert
const mv = testHelpers.MoneyValues

contract('TroveManager - in Recovery Mode', async accounts => {
  const _1_Ether = web3.utils.toWei('1', 'ether')
  const _2_Ether = web3.utils.toWei('2', 'ether')
  const _3_Ether = web3.utils.toWei('3', 'ether')
  const _3pt5_Ether = web3.utils.toWei('3.5', 'ether')
  const _6_Ether = web3.utils.toWei('6', 'ether')
  const _10_Ether = web3.utils.toWei('10', 'ether')
  const _20_Ether = web3.utils.toWei('20', 'ether')
  const _21_Ether = web3.utils.toWei('21', 'ether')
  const _22_Ether = web3.utils.toWei('22', 'ether')
  const _24_Ether = web3.utils.toWei('24', 'ether')
  const _25_Ether = web3.utils.toWei('25', 'ether')
  const _30_Ether = web3.utils.toWei('30', 'ether')

  const ZERO_ADDRESS = th.ZERO_ADDRESS
  const [
    owner,
    alice, bob, carol, dennis, erin, freddy, greta, harry, ida,
    whale, defaulter_1, defaulter_2, defaulter_3, defaulter_4,
    A, B, C, D, E, F, G, H, I] = accounts;

  let priceFeed
  let lusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations

  let contracts

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    const LQTYContracts = await deploymentHelper.deployLQTYContracts()

    priceFeed = contracts.priceFeedTestnet
    lusdToken = contracts.lusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    functionCaller = contracts.functionCaller
    borrowerOperations = contracts.borrowerOperations

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
  })

  it("checkRecoveryMode(): Returns true if TCR falls below CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: dec(3, 'ether') })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawLUSD(0, dec(390, 18), alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, dec(390, 18), bob, { from: bob })

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, dec(15, 17))

    const recoveryMode_Before = await troveManager.checkRecoveryMode();
    assert.isFalse(recoveryMode_Before)

    // --- TEST ---

    // price drops to 1ETH:150LUSD, reducing TCR below 150%.  setPrice() calls checkTCRAndSetRecoveryMode() internally.
    await priceFeed.setPrice(dec(15, 17))

    // const price = await priceFeed.getPrice()
    // await troveManager.checkTCRAndSetRecoveryMode(price)

    const recoveryMode_After = await troveManager.checkRecoveryMode();
    assert.isTrue(recoveryMode_After)
  })

  it("checkRecoveryMode(): Returns true if TCR stays less than CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })

    // Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', bob, { from: bob })

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // price drops to 1ETH:150LUSD, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000')

    const recoveryMode_Before = await troveManager.checkRecoveryMode();
    assert.isTrue(recoveryMode_Before)

    await borrowerOperations.addColl(0, alice, { from: alice, value: '1' })

    const recoveryMode_After = await troveManager.checkRecoveryMode();
    assert.isTrue(recoveryMode_After)
  })

  it("checkRecoveryMode(): returns false if TCR stays above CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })

    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', bob, { from: bob })

    // --- TEST ---
    const recoveryMode_Before = await troveManager.checkRecoveryMode();
    assert.isFalse(recoveryMode_Before)

    await borrowerOperations.withdrawColl(0, _1_Ether, alice, { from: alice })

    const recoveryMode_After = await troveManager.checkRecoveryMode();
    assert.isFalse(recoveryMode_After)
  })

  it("checkRecoveryMode(): returns false if TCR rises above CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', bob, { from: bob })

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---
    // price drops to 1ETH:150LUSD, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000')

    const recoveryMode_Before = await troveManager.checkRecoveryMode();
    assert.isTrue(recoveryMode_Before)

    await borrowerOperations.addColl(0, alice, { from: alice, value: _10_Ether })

    const recoveryMode_After = await troveManager.checkRecoveryMode();
    assert.isFalse(recoveryMode_After)
  })

  // --- liquidate() with ICR < 100% ---

  it("liquidate(), with ICR < 100%: removes stake and updates totalStakes", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', bob, { from: bob })

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')


    const bob_Stake_Before = (await troveManager.Troves(bob))[2]
    const totalStakes_Before = await troveManager.totalStakes()

    assert.equal(bob_Stake_Before, _3_Ether)
    assert.equal(totalStakes_Before, _6_Ether)

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check Bob's ICR falls to 75%
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, '750000000000000000')

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    const bob_Stake_After = (await troveManager.Troves(bob))[2]
    const totalStakes_After = await troveManager.totalStakes()

    assert.equal(bob_Stake_After, 0)
    assert.equal(totalStakes_After, _3_Ether)
  })

  it("liquidate(), with ICR < 100%: updates system snapshots correctly", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _3_Ether })

    //  Alice and Bob withdraw such that their ICRs and the TCR is ~150%
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', bob, { from: bob })
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', dennis, { from: dennis })

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%, and all Troves below 100% ICR
    await priceFeed.setPrice('100000000000000000000')

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Dennis is liquidated
    await troveManager.liquidate(dennis, { from: owner })

    const totalStakesSnaphot_before = (await troveManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_before = (await troveManager.totalCollateralSnapshot()).toString()

    assert.equal(totalStakesSnaphot_before, _6_Ether)
    assert.equal(totalCollateralSnapshot_before, dec(8985, 15)) // 6 + 3*0.995

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    const totalStakesSnaphot_After = (await troveManager.totalStakesSnapshot())
    const totalCollateralSnapshot_After = (await troveManager.totalCollateralSnapshot())

    assert.equal(totalStakesSnaphot_After, _3_Ether)
    // total collateral should always be 9 minus gas compensations, as all liquidations in this test case are full redistributions
    assert.isAtMost(th.getDifference(totalCollateralSnapshot_After, '8962537499999999820'), 1000) // 3 + 4.5*0.995 + 1.5*0.995^2
  })

  it("liquidate(), with ICR < 100%: closes the Trove and removes it from the Trove array", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', bob, { from: bob })

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    const bob_TroveStatus_Before = (await troveManager.Troves(bob))[3]
    const bob_Trove_isInSortedList_Before = await sortedTroves.contains(bob)

    assert.equal(bob_TroveStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_Before)

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check Bob's ICR falls to 75%
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, '750000000000000000')

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    // check Bob's Trove is successfully closed, and removed from sortedList
    const bob_TroveStatus_After = (await troveManager.Troves(bob))[3]
    const bob_Trove_isInSortedList_After = await sortedTroves.contains(bob)
    assert.equal(bob_TroveStatus_After, 2)  // status enum element 2 corresponds to "Closed"
    assert.isFalse(bob_Trove_isInSortedList_After)
  })

  it("liquidate(), with ICR < 100%: only redistributes to active Troves - no offset to Stability Pool", async () => {

    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _3_Ether })

    //  Alice and Bob withdraw such that their ICRs and the TCR is 150%
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', bob, { from: bob })
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', dennis, { from: dennis })

    // Alice deposits to SP
    await stabilityPool.provideToSP('390000000000000000000', ZERO_ADDRESS, { from: alice })

    // check rewards-per-unit-staked before
    const P_Before = (await stabilityPool.P()).toString()

    assert.equal(P_Before, '1000000000000000000')


    // const TCR = (await troveManager.getTCR()).toString()
    // assert.equal(TCR, '1500000000000000000')

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%, and all Troves below 100% ICR
    await priceFeed.setPrice('100000000000000000000')

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // liquidate bob
    await troveManager.liquidate(bob, { from: owner })

    // check SP rewards-per-unit-staked after liquidation - should be no increase
    const P_After = (await stabilityPool.P()).toString()

    assert.equal(P_After, '1000000000000000000')
  })

  // --- liquidate() with 100% < ICR < 110%

  it("liquidate(), with 100 < ICR < 110%: removes stake and updates totalStakes", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _21_Ether })

    //  Bob withdraws 1990 LUSD, bringing his ICR to 210%
    await borrowerOperations.withdrawLUSD(0, '1990000000000000000000', bob, { from: bob })

    // Total TCR = 24*200/2010 = 240%
    const TCR = (await troveManager.getTCR()).toString()
    assert.isAtMost(th.getDifference(TCR, '2388059701492537101'), 1000)

    const bob_Stake_Before = (await troveManager.Troves(bob))[2]
    const totalStakes_Before = await troveManager.totalStakes()

    assert.equal(bob_Stake_Before, _21_Ether)
    assert.equal(totalStakes_Before, _24_Ether)

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR to 120%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check Bob's ICR falls to 105%
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, '1050000000000000000')

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    const bob_Stake_After = (await troveManager.Troves(bob))[2]
    const totalStakes_After = await troveManager.totalStakes()

    assert.equal(bob_Stake_After, 0)
    assert.equal(totalStakes_After, _3_Ether)
  })

  it("liquidate(), with 100% < ICR < 110%: updates system snapshots correctly", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _21_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _3_Ether })

    //  Alice and Dennis withdraw such that their ICR is ~150%
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', dennis, { from: dennis })

    //  Bob withdraws 1990 LUSD, bringing his ICR to 210%
    await borrowerOperations.withdrawLUSD(0, '1990000000000000000000', bob, { from: bob })

    const totalStakesSnaphot_1 = (await troveManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_1 = (await troveManager.totalCollateralSnapshot()).toString()
    assert.equal(totalStakesSnaphot_1, 0)
    assert.equal(totalCollateralSnapshot_1, 0)

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%, and all Troves below 100% ICR
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Dennis is liquidated
    await troveManager.liquidate(dennis, { from: owner })

    /*
    Prior to Dennis liquidation, total stakes and total collateral were each 27 ether. 
  
    Check snapshots. Dennis' liquidated collateral is distributed and remains in the system. His 
    stake is removed, leaving 24+3*0.995 ether total collateral, and 24 ether total stakes. */

    const totalStakesSnaphot_2 = (await troveManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_2 = (await troveManager.totalCollateralSnapshot()).toString()
    assert.equal(totalStakesSnaphot_2, _24_Ether)
    assert.equal(totalCollateralSnapshot_2, dec(26985, 15)) // 24 + 3*0.995

    // check Bob's ICR is now in range 100% < ICR 110%
    const _110percent = web3.utils.toBN('1100000000000000000')
    const _100percent = web3.utils.toBN('1000000000000000000')

    const bob_ICR = (await troveManager.getCurrentICR(bob, price))

    assert.isTrue(bob_ICR.lt(_110percent))
    assert.isTrue(bob_ICR.gt(_100percent))

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    /* After Bob's liquidation, Bob's stake (21 ether) should be removed from total stakes, 
    but his collateral should remain in the system (*0.995). */
    const totalStakesSnaphot_3 = (await troveManager.totalStakesSnapshot())
    const totalCollateralSnapshot_3 = (await troveManager.totalCollateralSnapshot())
    assert.equal(totalStakesSnaphot_3, _3_Ether)
    // total collateral should always be 27 minus gas compensations, as all liquidations in this test case are full redistributions
    assert.isAtMost(th.getDifference(totalCollateralSnapshot_3, '26866940624999998021'), 2000) // 3 + 3*3/24*0.995 + (21+3*21/24*0.995)*0.995
  })

  it("liquidate(), with 100% < ICR < 110%: closes the Trove and removes it from the Trove array", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _21_Ether })

    //  Bob withdraws 1990 LUSD, bringing his ICR to 210%
    await borrowerOperations.withdrawLUSD(0, '1990000000000000000000', bob, { from: bob })

    const bob_TroveStatus_Before = (await troveManager.Troves(bob))[3]
    const bob_Trove_isInSortedList_Before = await sortedTroves.contains(bob)

    assert.equal(bob_TroveStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_Before)

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()


    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check Bob's ICR has fallen to 105%
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, '1050000000000000000')

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    // check Bob's Trove is successfully closed, and removed from sortedList
    const bob_TroveStatus_After = (await troveManager.Troves(bob))[3]
    const bob_Trove_isInSortedList_After = await sortedTroves.contains(bob)
    assert.equal(bob_TroveStatus_After, 2)  // status enum element 2 corresponds to "Closed"
    assert.isFalse(bob_Trove_isInSortedList_After)
  })

  it("liquidate(), with 100% < ICR < 110%: offsets as much debt as possible with the Stability Pool, then redistributes the remainder coll and debt", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _21_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _3_Ether })

    //  Alice and Dennis withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '390000000000000000000', dennis, { from: dennis })

    // Alice deposits 390LUSD to the Stability Pool
    await stabilityPool.provideToSP('390000000000000000000', ZERO_ADDRESS, { from: alice })

    // Bob withdraws 1990 LUSD, bringing his ICR to 210%
    await borrowerOperations.withdrawLUSD(0, '1990000000000000000000', bob, { from: bob })

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check Bob's ICR has fallen to 105%
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, '1050000000000000000')

    // check pool LUSD before liquidation
    const stabilityPoolLUSD_Before = (await stabilityPool.getTotalLUSDDeposits()).toString()
    assert.equal(stabilityPoolLUSD_Before, '390000000000000000000')

    // check Pool reward term before liquidation
    const P_Before = (await stabilityPool.P()).toString()

    assert.equal(P_Before, '1000000000000000000')

    /* Now, liquidate Bob. Liquidated coll is 21 ether, and liquidated debt is 2000 LUSD.
    
    With 390 LUSD in the StabilityPool, 390 LUSD should be offset with the pool, leaving 0 in the pool.
  
    Stability Pool rewards for alice should be:
    LUSDLoss: 390LUSD
    ETHGain: (390 / 2000) * 21*0.995 = 4.074525 ether

    After offsetting 390 LUSD and 4.074525 ether, the remainders - 1610 LUSD and 16.820475 ether - should be redistributed to all active Troves.
   */
    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    const aliceExpectedDeposit = await stabilityPool.getCompoundedLUSDDeposit(alice)
    const aliceExpectedETHGain = await stabilityPool.getDepositorETHGain(alice)

    assert.equal(aliceExpectedDeposit.toString(), 0)
    assert.equal(aliceExpectedETHGain.toString(), '4074525000000000000')

    /* Now, check redistribution to active Troves. Remainders of 1610 LUSD and 16.82 ether are distributed.
    
    Now, only Alice and Dennis have a stake in the system - 3 ether each, thus total stakes is 6 ether.
  
    Rewards-per-unit-staked from the redistribution should be:
  
    L_LUSDDebt = 1610 / 6 = 268.333 LUSD
    L_ETH = 16.820475 /6 =  2.8034125 ether
    */
    const L_LUSDDebt = (await troveManager.L_LUSDDebt()).toString()
    const L_ETH = (await troveManager.L_ETH()).toString()

    assert.isAtMost(th.getDifference(L_LUSDDebt, '268333333333333333333'), 100)
    assert.isAtMost(th.getDifference(L_ETH, '2803412500000000000'), 100)
  })

  // --- liquidate(), applied to trove with ICR > 110% that has the lowest ICR 

  it("liquidate(), with ICR > 110%, trove has lowest ICR, and StabilityPool is empty: does nothing", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _2_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _2_Ether })

    //  Alice and Dennis withdraw 140 LUSD, resulting in ICRs of 266%. 
    await borrowerOperations.withdrawLUSD(0, '140000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '140000000000000000000', dennis, { from: dennis })
    //Bob withdraws 240 LUSD, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', bob, { from: bob })

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Check Bob's ICR is >110% but still lowest
    const bob_ICR = (await troveManager.getCurrentICR(bob, price)).toString()
    const alice_ICR = (await troveManager.getCurrentICR(alice, price)).toString()
    const dennis_ICR = (await troveManager.getCurrentICR(dennis, price)).toString()
    assert.equal(bob_ICR, '1200000000000000000')
    assert.equal(alice_ICR, '1333333333333333333')
    assert.equal(dennis_ICR, '1333333333333333333')

    // console.log(`TCR: ${await troveManager.getTCR()}`)
    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    // Check that Pool rewards don't change
    const P_Before = (await stabilityPool.P()).toString()

    assert.equal(P_Before, '1000000000000000000')

    // Check that redistribution rewards don't change
    const L_LUSDDebt = (await troveManager.L_LUSDDebt()).toString()
    const L_ETH = (await troveManager.L_ETH()).toString()

    assert.equal(L_LUSDDebt, '0')
    assert.equal(L_ETH, '0')

    // Check that Bob's Trove and stake remains active with unchanged coll and debt
    const bob_Trove = await troveManager.Troves(bob);
    const bob_Debt = bob_Trove[0].toString()
    const bob_Coll = bob_Trove[1].toString()
    const bob_Stake = bob_Trove[2].toString()
    const bob_TroveStatus = bob_Trove[3].toString()
    const bob_isInSortedTrovesList = await sortedTroves.contains(bob)

    assert.equal(bob_Debt, '250000000000000000000')
    assert.equal(bob_Coll, '3000000000000000000')
    assert.equal(bob_Stake, '3000000000000000000')
    assert.equal(bob_TroveStatus, '1')
    assert.isTrue(bob_isInSortedTrovesList)
  })

  // --- liquidate(), applied to trove with ICR > 110% that has the lowest ICR, and Stability Pool LUSD is GREATER THAN liquidated debt ---

  it("liquidate(), with 110% < ICR < TCR, and StabilityPool LUSD > debt to liquidate: offsets the trove entirely with the pool", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 LUSD, and Dennis 140 LUSD, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawLUSD(0, '1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 LUSD, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', bob, { from: bob })

    // Alice deposits all 1490 LUSD in the Stability Pool
    await stabilityPool.provideToSP('1490000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Check Bob's ICR is between 110 and TCR
    const bob_ICR = await troveManager.getCurrentICR(bob, price)
    assert.isTrue(bob_ICR.gt(mv._MCR) && bob_ICR.lt(TCR))

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    /* Check accrued Stability Pool rewards after. Total Pool deposits was 1490 LUSD, Alice sole depositor.
    As liquidated debt (250 LUSD) was completely offset

    Alice's expected compounded deposit: (1490 - 250) = 1240LUSD
    Alice's expected ETH gain:  Bob's liquidated coll, 3*0.995 ether
  
    */
    const aliceExpectedDeposit = await stabilityPool.getCompoundedLUSDDeposit(alice)
    const aliceExpectedETHGain = await stabilityPool.getDepositorETHGain(alice)

    assert.isAtMost(th.getDifference(aliceExpectedDeposit.toString(), '1240000000000000000000'), 2000)
    assert.isAtMost(th.getDifference(aliceExpectedETHGain, dec(2985, 15)), 1000)
  })

  it("liquidate(), with  110% < ICR < TCR, and StabilityPool LUSD > debt to liquidate: removes stake and updates totalStakes", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 LUSD, and Dennis 150 LUSD, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawLUSD(0, '1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 LUSD, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', bob, { from: bob })

    // Alice deposits all 1490 LUSD in the Stability Pool
    await stabilityPool.provideToSP('1490000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check stake and totalStakes before
    const bob_Stake_Before = (await troveManager.Troves(bob))[2]
    const totalStakes_Before = await troveManager.totalStakes()

    assert.equal(bob_Stake_Before, _3_Ether)
    assert.equal(totalStakes_Before, _25_Ether)

    // Check Bob's ICR is between 110 and 150
    const bob_ICR = await troveManager.getCurrentICR(bob, price)
    assert.isTrue(bob_ICR.gt(mv._MCR) && bob_ICR.lt(await troveManager.getTCR()))

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    // check stake and totalStakes after
    const bob_Stake_After = (await troveManager.Troves(bob))[2]
    const totalStakes_After = await troveManager.totalStakes()

    assert.equal(bob_Stake_After, 0)
    assert.equal(totalStakes_After, _22_Ether)
  })

  it("liquidate(), with  110% < ICR < TCR, and StabilityPool LUSD > debt to liquidate: updates system snapshots", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 LUSD, and Dennis 140 LUSD, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawLUSD(0, '1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 LUSD, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', bob, { from: bob })

    // Alice deposits all 1490 LUSD in the Stability Pool
    await stabilityPool.provideToSP('1490000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check system snapshots before
    const totalStakesSnaphot_before = (await troveManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_before = (await troveManager.totalCollateralSnapshot()).toString()

    assert.equal(totalStakesSnaphot_before, '0')
    assert.equal(totalCollateralSnapshot_before, '0')

    // Check Bob's ICR is between 110 and TCR
    const bob_ICR = await troveManager.getCurrentICR(bob, price)
    assert.isTrue(bob_ICR.gt(mv._MCR) && bob_ICR.lt(await troveManager.getTCR()))

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    const totalStakesSnaphot_After = (await troveManager.totalStakesSnapshot())
    const totalCollateralSnapshot_After = (await troveManager.totalCollateralSnapshot())

    // totalStakesSnapshot should have reduced to 22 ether - the sum of Alice's coll( 20 ether) and Dennis' coll (2 ether )
    assert.equal(totalStakesSnaphot_After, _22_Ether)
    // Total collateral should also reduce, since all liquidated coll has been moved to a reward for Stability Pool depositors
    assert.equal(totalCollateralSnapshot_After, _22_Ether)
  })

  it("liquidate(), with 110% < ICR < TCR, and StabilityPool LUSD > debt to liquidate: closes the Trove", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 LUSD, and Dennis 140 LUSD, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawLUSD(0, '1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 LUSD, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', bob, { from: bob })

    // Alice deposits all 1490 LUSD in the Stability Pool
    await stabilityPool.provideToSP('1490000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Check Bob's Trove is active
    const bob_TroveStatus_Before = (await troveManager.Troves(bob))[3]
    const bob_Trove_isInSortedList_Before = await sortedTroves.contains(bob)

    assert.equal(bob_TroveStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_Before)

    // Check Bob's ICR is between 110 and TCR
    const bob_ICR = await troveManager.getCurrentICR(bob, price)
    assert.isTrue(bob_ICR.gt(mv._MCR) && bob_ICR.lt(await troveManager.getTCR()))

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    // Check Bob's Trove is closed after liquidation
    const bob_TroveStatus_After = (await troveManager.Troves(bob))[3]
    const bob_Trove_isInSortedList_After = await sortedTroves.contains(bob)

    assert.equal(bob_TroveStatus_After, 2) // status enum element 2 corresponds to "Closed"
    assert.isFalse(bob_Trove_isInSortedList_After)
  })

  it("liquidate(), with 110% < ICR < TCR, and StabilityPool LUSD > debt to liquidate: can liquidate troves out of order", async () => {

    // taking out 1000 LUSD against 10x200 = $2000 worth of ETH collateral, gives us an CR of 200%
    await borrowerOperations.openTrove(0, dec(1000, 18), whale, { from: whale, value: dec(10, 'ether') })
    await stabilityPool.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, '90000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '89000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '88000000000000000000', carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, '87000000000000000000', erin, { from: erin, value: dec(2, 'ether') }) 
    await borrowerOperations.openTrove(0, '86000000000000000000', freddy, { from: freddy, value: dec(2, 'ether') })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()
  
    // Check Recovery Mode is active
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check troves A-D are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price)
    const ICR_B = await troveManager.getCurrentICR(bob, price)
    const ICR_C = await troveManager.getCurrentICR(carol, price)
    const ICR_D = await troveManager.getCurrentICR(dennis, price)
    
    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))
    assert.isTrue(ICR_D.gt(mv._MCR) && ICR_D.lt(TCR))

    // Troves are ordered by ICR, low to high: A, B, C, D.

    // Liquidate out of ICR order: D, B, C.  Confirm Recovery Mode is active prior to each.
    const liquidationTx_D = await troveManager.liquidate(dennis)
  
    assert.isTrue(await troveManager.checkRecoveryMode())
    const liquidationTx_B = await troveManager.liquidate(bob)

    assert.isTrue(await troveManager.checkRecoveryMode())
    const liquidationTx_C = await troveManager.liquidate(carol)
    
    // Check transactions all succeeded
    assert.isTrue(liquidationTx_D.receipt.status)
    assert.isTrue(liquidationTx_B.receipt.status)
    assert.isTrue(liquidationTx_C.receipt.status)

    // Confirm troves D, B, C removed
    assert.isFalse(await sortedTroves.contains(dennis))
    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))

    // Confirm troves have status 'closed' (Status enum element idx 2)
    assert.equal((await troveManager.Troves(dennis))[3], '2')
    assert.equal((await troveManager.Troves(dennis))[3], '2')
    assert.equal((await troveManager.Troves(dennis))[3], '2')
  })


  /* --- liquidate() applied to trove with ICR > 110% that has the lowest ICR, and Stability Pool 
  LUSD is LESS THAN the liquidated debt: a partial liquidation --- */

  it("liquidate(), with ICR > 110%, and StabilityPool LUSD < liquidated debt: Trove remains active", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 LUSD, and Dennis 140 LUSD, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawLUSD(0, '1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 LUSD, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', bob, { from: bob })

    // Alice deposits 100 LUSD in the Stability Pool
    await stabilityPool.provideToSP('100000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Check Bob's Trove is active
    const bob_TroveStatus_Before = (await troveManager.Troves(bob))[3]
    const bob_Trove_isInSortedList_Before = await sortedTroves.contains(bob)

    assert.equal(bob_TroveStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_Before)

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })
    
    /* Since the pool only contains 100 LUSD, and Bob's pre-liquidation debt was 250 LUSD, 
    expect Bob's trove to only be partially offset, and remain active after liquidation */

    const bob_TroveStatus_After = (await troveManager.Troves(bob))[3]
    const bob_Trove_isInSortedList_After = await sortedTroves.contains(bob)

    assert.equal(bob_TroveStatus_After, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_After)
  })

  it("liquidate(), with ICR > 110%, and StabilityPool LUSD < liquidated debt: Trove remains in TroveOwners array", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 LUSD, and Dennis 140 LUSD, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawLUSD(0, '1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 LUSD, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', bob, { from: bob })

    // Alice deposits 100 LUSD in the Stability Pool
    await stabilityPool.provideToSP('100000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Check Bob's Trove is active
    const bob_TroveStatus_Before = (await troveManager.Troves(bob))[3]
    const bob_Trove_isInSortedList_Before = await sortedTroves.contains(bob)

    assert.equal(bob_TroveStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_Before)

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    /* Since the pool only contains 100 LUSD, and Bob's pre-liquidation debt was 250 LUSD, 
    expect Bob's trove to only be partially offset, and remain active after liquidation */

    // Check Bob is in Trove owners array
    const arrayLength = (await troveManager.getTroveOwnersCount()).toNumber()
    let addressFound = false;
    let addressIdx = 0;

    for (let i = 0; i < arrayLength; i++) {
      const address = (await troveManager.TroveOwners(i)).toString()
      if (address == bob) {
        addressFound = true
        addressIdx = i
      }
    }

    assert.isTrue(addressFound);

    // Check TroveOwners idx on trove struct == idx of address found in TroveOwners array
    const idxOnStruct = (await troveManager.Troves(bob))[4].toString()
    assert.equal(addressIdx.toString(), idxOnStruct)
  })

  it("liquidate(), with ICR > 110%, and StabilityPool LUSD < liquidated debt: updates trove coll, debt and stake, and system totalStakes", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 LUSD, and Dennis 140 LUSD, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawLUSD(0, '1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 LUSD, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', bob, { from: bob })

    // Alice deposits 100 LUSD in the Stability Pool
    await stabilityPool.provideToSP('100000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    /*  Since Bob's debt (250 LUSD) is larger than all LUSD in the Stability Pool, Liquidation should offset 
    a portion Bob's debt and coll with the Stability Pool, and leave remainders of debt and coll in his Trove. Specifically:

    Offset debt: 100 LUSD
    Offset coll: (100 / 250) * 3  = 1.2 ether

    Remainder debt: 150 LUSD
    Remainder coll: (3 - 1.2) = 1.8 ether 

    After liquidation, totalStakes snapshot should equal Alice's stake (20 ether) + Dennis stake (2 ether) = 22 ether.

    Since there has been no redistribution, the totalCollateral snapshot should equal the totalStakes snapshot: 22 ether.
    
    Then, Bob's new reduced coll and stake should each be 1.8 ether, and the updated totalStakes should equal 23.8 ether.
    */
    const bob_Trove = await troveManager.Troves(bob)
    const bob_DebtAfter = bob_Trove[0].toString()
    const bob_CollAfter = bob_Trove[1].toString()
    const bob_StakeAfter = bob_Trove[2].toString()

    assert.equal(bob_DebtAfter, '150000000000000000000')
    assert.equal(bob_CollAfter, '1800000000000000000')
    assert.equal(bob_StakeAfter, '1800000000000000000')

    const totalStakes_After = (await troveManager.totalStakes()).toString()
    assert.equal(totalStakes_After, '23800000000000000000')
  })

  it("liquidate(), with ICR > 110%, and StabilityPool LUSD < liquidated debt: updates system shapshots", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 LUSD, and Dennis 140 LUSD, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawLUSD(0, '1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 LUSD, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', bob, { from: bob })

    // Alice deposits 100 LUSD in the Stability Pool
    await stabilityPool.provideToSP('100000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Check snapshots before
    const totalStakesSnaphot_Before = (await troveManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_Before = (await troveManager.totalCollateralSnapshot()).toString()

    assert.equal(totalStakesSnaphot_Before, 0)
    assert.equal(totalCollateralSnapshot_Before, 0)

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    /* After liquidation, totalStakes snapshot should equal Alice's stake (20 ether) + Dennis stake (2 ether) = 22 ether.

    Since there has been no redistribution, the totalCollateral snapshot should equal the totalStakes snapshot: 22 ether.*/

    const totalStakesSnaphot_After = (await troveManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_After = (await troveManager.totalCollateralSnapshot()).toString()

    assert.equal(totalStakesSnaphot_After, '22000000000000000000')
    assert.equal(totalCollateralSnapshot_After, '22000000000000000000')
  })

  it("liquidate(), with ICR > 110%, and StabilityPool LUSD < liquidated debt: causes correct Pool offset and ETH gain, and doesn't redistribute to active troves", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 LUSD, and Dennis 140 LUSD, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawLUSD(0, '1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 LUSD, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', bob, { from: bob })

    // Alice deposits 100 LUSD in the Stability Pool
    await stabilityPool.provideToSP('100000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Liquidate Bob. 100 LUSD should be offset
    await troveManager.liquidate(bob, { from: owner })

    /* check Stability Pool rewards.  After Bob's liquidation:
    - amount of LUSD offset with Stability Pool should be 100 LUSD
    - corresponding amount of ETH added to Stability Pool should be 100/250 * 3 * 0.995 = 1.194 ether.

    - Alice's deposit (100 LUSD) should fully cancel with the debt, leaving her a withdrawable deposit of 0
  
    Her ETH gain from offset should be (3 * 100/250)*0.995 = 1.194 Ether.
    */

    const aliceExpectedDeposit = await stabilityPool.getCompoundedLUSDDeposit(alice)
    const aliceExpectedETHGain = await stabilityPool.getDepositorETHGain(alice)

    assert.equal(aliceExpectedDeposit.toString(), '0')

    assert.isAtMost(th.getDifference(aliceExpectedETHGain, '1194000000000000000'), 100)

    /* For this Recovery Mode test case with ICR > 110%, there should be no redistribution of remainder to active Troves. 
    Redistribution rewards-per-unit-staked should be zero. */

    const L_LUSDDebt_After = (await troveManager.L_LUSDDebt()).toString()
    const L_ETH_After = (await troveManager.L_ETH()).toString()

    assert.equal(L_LUSDDebt_After, '0')
    assert.equal(L_ETH_After, '0')
  })

  it("liquidate(), with ICR > 110%, and StabilityPool LUSD < liquidated debt: ICR of partially liquidated trove does not change", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, carol, { from: carol, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 LUSD, and Dennis 140 LUSD, -> ICRs of 266%.  
    await borrowerOperations.withdrawLUSD(0, '1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD(0, '140000000000000000000', dennis, { from: dennis })

    // Bob withdraws 240 LUSD, -> ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', bob, { from: bob })
    // Carol withdraws 230 LUSD, -> ICR of 250%.
    await borrowerOperations.withdrawLUSD(0, '230000000000000000000', carol, { from: carol })

    // Alice deposits 100 LUSD in the Stability Pool
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100LUSD, reducing TCR below 150%
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const bob_ICR_Before = (await troveManager.getCurrentICR(bob, price)).toString()
    const carol_ICR_Before = (await troveManager.getCurrentICR(carol, price)).toString()

    assert.isTrue(await troveManager.checkRecoveryMode())

    const bob_Coll_Before = (await troveManager.Troves(bob))[1]
    const bob_Debt_Before = (await troveManager.Troves(bob))[0]

    // confirm Bob is last trove in list, and has >110% ICR
    assert.equal((await sortedTroves.getLast()).toString(), bob)
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gt(mv._MCR))

    // L1: Liquidate Bob. 100 LUSD should be offset
    await troveManager.liquidate(bob, { from: owner })

    //Check SP LUSD has been completely emptied
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), '0')

    // Check Bob remains active
    assert.isTrue(await sortedTroves.contains(bob))

    // Check Bob's collateral and debt has reduced from the partial liquidation
    const bob_Coll_After = (await troveManager.Troves(bob))[1]
    const bob_Debt_After = (await troveManager.Troves(bob))[0]
    assert.isTrue(bob_Coll_After.lt(bob_Coll_Before))
    assert.isTrue(bob_Debt_After.lt(bob_Debt_Before))

    const bob_ICR_After = (await troveManager.getCurrentICR(bob, price)).toString()

    // check Bob's ICR has not changed from the partial liquidation
    assert.equal(bob_ICR_After, bob_ICR_Before)


    // Remove Bob from system to test Carol's trove: price rises, Bob closes trove, price drops to 100 again
    await priceFeed.setPrice(dec(200, 18))
    await borrowerOperations.closeTrove({ from: bob })
    await priceFeed.setPrice(dec(100, 18))
    assert.isFalse(await sortedTroves.contains(bob))

    // Alice provides another 50 LUSD to pool
    await stabilityPool.provideToSP(dec(50, 18), ZERO_ADDRESS, { from: alice })

    assert.isTrue(await troveManager.checkRecoveryMode())

    const carol_Coll_Before = (await troveManager.Troves(carol))[1]
    const carol_Debt_Before = (await troveManager.Troves(carol))[0]

    // Confirm Carol is last trove in list, and has >110% ICR
    assert.equal((await sortedTroves.getLast()), carol)
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).gt(mv._MCR))

    // L2: Liquidate Carol. 50 LUSD should be offset
    await troveManager.liquidate(carol)

    //Check SP LUSD has been completely emptied
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), '0')

    // Check Carol's collateral and debt has reduced from the partial liquidation
    const carol_Coll_After = (await troveManager.Troves(carol))[1]
    const carol_Debt_After = (await troveManager.Troves(carol))[0]
    assert.isTrue(carol_Coll_After.lt(carol_Coll_Before))
    assert.isTrue(carol_Debt_After.lt(carol_Debt_Before))

    const carol_ICR_After = (await troveManager.getCurrentICR(carol, price)).toString()

    // check Carol's ICR has not changed from the partial liquidation
    assert.equal(carol_ICR_After, carol_ICR_Before)

    //Confirm liquidations have not led to any redistributions to troves
    const L_LUSDDebt_After = (await troveManager.L_LUSDDebt()).toString()
    const L_ETH_After = (await troveManager.L_ETH()).toString()

    assert.equal(L_LUSDDebt_After, '0')
    assert.equal(L_ETH_After, '0')
  })

  it("liquidate() with ICR > 110%, and StabilityPool LUSD < liquidated debt: total liquidated coll and debt is correct", async () => {
    // Whale provides 50 LUSD to the SP
    await borrowerOperations.openTrove(0, dec(50, 18), whale, { from: whale, value: dec(1, 'ether') })
    await stabilityPool.provideToSP(dec(50, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, '90000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '89000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '88000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, '87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is active
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check C is in range 110% < ICR < 150%
    const ICR_A = await troveManager.getCurrentICR(alice, price)
    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(await troveManager.getTCR()))

    const entireSystemCollBefore = await troveManager.getEntireSystemColl()
    const entireSystemDebtBefore = await troveManager.getEntireSystemDebt()

    await troveManager.liquidate(alice)

    // Expect system debt reduced by 250 LUSD and system coll 2.5 ETH
    const entireSystemCollAfter = await troveManager.getEntireSystemColl()
    const entireSystemDebtAfter = await troveManager.getEntireSystemDebt()

    const changeInEntireSystemColl = entireSystemCollBefore.sub(entireSystemCollAfter)
    const changeInEntireSystemDebt = entireSystemDebtBefore.sub(entireSystemDebtAfter)

    assert.equal(changeInEntireSystemColl, '500000000000000000')
    assert.equal(changeInEntireSystemDebt, dec(50, 18))
  })

  // --- 

  it("liquidate(): Doesn't liquidate undercollateralized trove if it is the only trove in the system", async () => {
    // Alice creates a single trove with 0.5 ETH and a debt of 50 LQTY, and provides 10 LUSD to SP
    await borrowerOperations.openTrove(0, dec(40, 18), alice, { from: alice, value: dec(500, 'finney') })
    await stabilityPool.provideToSP(dec(10, 18), ZERO_ADDRESS, { from: alice })

    assert.isFalse(await troveManager.checkRecoveryMode())

    // Set ETH:USD price to 105
    await priceFeed.setPrice('105000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isTrue(await troveManager.checkRecoveryMode())

    const alice_ICR = (await troveManager.getCurrentICR(alice, price)).toString()
    assert.equal(alice_ICR, '1050000000000000000')

    const activeTrovesCount_Before = await troveManager.getTroveOwnersCount()

    assert.equal(activeTrovesCount_Before, 1)

    // Liquidate the trove
    await troveManager.liquidate(alice, { from: owner })

    // Check Alice's trove has not been removed
    const activeTrovesCount_After = await troveManager.getTroveOwnersCount()
    assert.equal(activeTrovesCount_After, 1)

    const alice_isInSortedList = await sortedTroves.contains(alice)
    assert.isTrue(alice_isInSortedList)
  })

  it("liquidate(): Liquidates undercollateralized trove if there are two troves in the system", async () => {
    await borrowerOperations.openTrove(0, dec(40, 18), bob, { from: bob, value: dec(500, 'finney') })

    // Alice creates a single trove with 0.5 ETH and a debt of 50 LQTY,  and provides 10 LUSD to SP
    await borrowerOperations.openTrove(0, dec(40, 18), alice, { from: alice, value: dec(500, 'finney') })
    await stabilityPool.provideToSP(dec(10, 18), ZERO_ADDRESS, { from: alice })

    // Alice proves 10 LUSD to SP
    await stabilityPool.provideToSP(dec(10, 18), ZERO_ADDRESS, { from: alice })

    assert.isFalse(await troveManager.checkRecoveryMode())

    // Set ETH:USD price to 105
    await priceFeed.setPrice('105000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isTrue(await troveManager.checkRecoveryMode())

    const alice_ICR = (await troveManager.getCurrentICR(alice, price)).toString()
    assert.equal(alice_ICR, '1050000000000000000')

    const activeTrovesCount_Before = await troveManager.getTroveOwnersCount()

    assert.equal(activeTrovesCount_Before, 2)

    // Liquidate the trove
    await troveManager.liquidate(alice, { from: owner })

    // Check Alice's trove is removed, and bob remains
    const activeTrovesCount_After = await troveManager.getTroveOwnersCount()
    assert.equal(activeTrovesCount_After, 1)

    const alice_isInSortedList = await sortedTroves.contains(alice)
    assert.isFalse(alice_isInSortedList)

    const bob_isInSortedList = await sortedTroves.contains(bob)
    assert.isTrue(bob_isInSortedList)
  })

  it("liquidate(): does nothing if trove has >= 110% ICR and the Stability Pool is empty", async () => {
    await borrowerOperations.openTrove(0, dec(90, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(0, dec(80, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(140, 18), carol, { from: carol, value: dec(2, 'ether') })

    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const TCR_Before = (await troveManager.getTCR()).toString()
    const listSize_Before = (await sortedTroves.getSize()).toString()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check Bob's ICR > 110%
    const bob_ICR = await troveManager.getCurrentICR(bob, price)
    assert.isTrue(bob_ICR.gte(mv._MCR))

    // Confirm SP is empty
    const LUSDinSP = (await stabilityPool.getTotalLUSDDeposits()).toString()
    assert.equal(LUSDinSP, '0')

    // Attempt to liquidate bob
    await troveManager.liquidate(bob)

    // check A, B, C remain active
    assert.isTrue((await sortedTroves.contains(bob)))
    assert.isTrue((await sortedTroves.contains(alice)))
    assert.isTrue((await sortedTroves.contains(carol)))

    const TCR_After = (await troveManager.getTCR()).toString()
    const listSize_After = (await sortedTroves.getSize()).toString()

    // Check TCR and list size have not changed
    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
  })

  it("liquidate(): does nothing if trove ICR >= TCR, and SP covers trove's debt", async () => { 
    await borrowerOperations.openTrove(0, dec(110, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(120, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(130, 18), C, { from: C, value: dec(1, 'ether') })
    
    // C fills SP with 130 LUSD
    await stabilityPool.provideToSP(dec(130, 18), ZERO_ADDRESS, {from: C})

    await priceFeed.setPrice(dec(150, 18))
    const price = await priceFeed.getPrice()
    assert.isTrue(await troveManager.checkRecoveryMode())

    const TCR = await troveManager.getTCR()

    const ICR_A = await troveManager.getCurrentICR(A, price)
    const ICR_B = await troveManager.getCurrentICR(B, price)
    const ICR_C = await troveManager.getCurrentICR(C, price)

    console.log(`TCR: ${TCR}`)
    console.log(`ICR_A: ${ICR_A}`)
    console.log(`ICR_B: ${ICR_B}`)
    console.log(`ICR_C: ${ICR_C}`)

    assert.isTrue(ICR_A.gt(TCR))
    const liqTxA = await troveManager.liquidate(A)
    assert.isTrue(liqTxA.receipt.status)
  
    // Check liquidation of A does nothing - trove remains in system
    assert.isTrue(await sortedTroves.contains(A))
    assert.equal(await troveManager.getTroveStatus(A), 1) // Status 1 -> active

    // Check C, with ICR < TCR, can be liquidated
    assert.isTrue(ICR_C.lt(TCR))
    const liqTxC = await troveManager.liquidate(C)
    assert.isTrue(liqTxC.receipt.status)

    assert.isFalse(await sortedTroves.contains(C))
    assert.equal(await troveManager.getTroveStatus(C), 2) // Status 0 -> closed
  })

  it("liquidate(): reverts if trove is non-existent", async () => {
    await borrowerOperations.openTrove(0, dec(90, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(140, 18), bob, { from: bob, value: dec(1, 'ether') })

    await priceFeed.setPrice(dec(100, 18))

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check Carol does not have an existing trove
    assert.equal(await troveManager.getTroveStatus(carol), 0)
    assert.isFalse(await sortedTroves.contains(carol))

    try {
      await troveManager.liquidate(carol)

      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("liquidate(): reverts if trove has been closed", async () => {
    await borrowerOperations.openTrove(0, dec(90, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(140, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(140, 18), carol, { from: carol, value: dec(1, 'ether') })

    assert.isTrue(await sortedTroves.contains(carol))

    // Price drops, Carol ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Carol liquidated, and her trove is closed
    const txCarol_L1 = await troveManager.liquidate(carol)
    assert.isTrue(txCarol_L1.receipt.status)

    // Check Carol's trove is closed
    assert.isFalse(await sortedTroves.contains(carol))
    assert.equal(await troveManager.getTroveStatus(carol), 2)

    try {
      await troveManager.liquidate(carol)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("liquidate(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await borrowerOperations.openTrove(0, dec(40, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '80500000000000000000', bob, { from: bob, value: dec(1, 'ether') })  // 90.5 LUSD, 1 ETH
    await borrowerOperations.openTrove(0, dec(90, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Defaulter opens with 30 LUSD, 0.3 ETH
    await borrowerOperations.openTrove(0, dec(20, 18), defaulter_1, { from: defaulter_1, value: dec(300, 'finney') })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    const alice_ICR_Before = await troveManager.getCurrentICR(alice, price)
    const bob_ICR_Before = await troveManager.getCurrentICR(bob, price)
    const carol_ICR_Before = await troveManager.getCurrentICR(carol, price)

    /* Before liquidation: 
    Alice ICR: = (1 * 100 / 50) = 200%
    Bob ICR: (1 * 100 / 90.5) = 110.5%
    Carol ICR: (1 * 100 / 100 ) =  100%

    Therefore Alice and Bob above the MCR, Carol is below */
    assert.isTrue(alice_ICR_Before.gte(mv._MCR))
    assert.isTrue(bob_ICR_Before.gte(mv._MCR))
    assert.isTrue(carol_ICR_Before.lte(mv._MCR))

    // Liquidate defaulter. 30 LUSD and 0.3 ETH is distributed uniformly between A, B and C. Each receive 10 LUSD, 0.1 ETH
    await troveManager.liquidate(defaulter_1)

    const alice_ICR_After = await troveManager.getCurrentICR(alice, price)
    const bob_ICR_After = await troveManager.getCurrentICR(bob, price)
    const carol_ICR_After = await troveManager.getCurrentICR(carol, price)

    /* After liquidation: 

    Alice ICR: (1.1 * 100 / 60) = 183.33%
    Bob ICR:(1.1 * 100 / 100.5) =  109.45%
    Carol ICR: (1.1 * 100 ) 100%

    Check Alice is above MCR, Bob below, Carol below. */
    assert.isTrue(alice_ICR_After.gte(mv._MCR))
    assert.isTrue(bob_ICR_After.lte(mv._MCR))
    assert.isTrue(carol_ICR_After.lte(mv._MCR))

    /* Though Bob's true ICR (including pending rewards) is below the MCR, 
    check that Bob's raw coll and debt has not changed, and that his "raw" ICR is above the MCR */
    const bob_Coll = (await troveManager.Troves(bob))[1]
    const bob_Debt = (await troveManager.Troves(bob))[0]

    const bob_rawICR = bob_Coll.mul(th.toBN(dec(100, 18))).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    //liquidate A, B, C
    await troveManager.liquidate(alice)
    await troveManager.liquidate(bob)
    await troveManager.liquidate(carol)

    /*  Since there is 0 LUSD in the stability Pool, A, with ICR >110%, should stay active.
    Check Alice stays active, Carol gets liquidated, and Bob gets liquidated 
    (because his pending rewards bring his ICR < MCR) */
    assert.isTrue(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))

    // check trove statuses - A active (1), B and C closed (2)
    assert.equal((await troveManager.Troves(alice))[3].toString(), '1')
    assert.equal((await troveManager.Troves(bob))[3].toString(), '2')
    assert.equal((await troveManager.Troves(carol))[3].toString(), '2')
  })

  it("liquidate(): does not affect the SP deposit or ETH gain when called on an SP depositor's address that has no trove", async () => {
    await borrowerOperations.openTrove(0, dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(0, dec(90, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Bob sends tokens to Dennis, who has no trove
    await lusdToken.transfer(dennis, dec(200, 18), { from: bob })

    //Dennis provides 200 LUSD to SP
    await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: dennis })

    // Price drop
    await priceFeed.setPrice(dec(105, 18))

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Carol gets liquidated
    await troveManager.liquidate(carol)

    // Check Dennis' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const dennis_Deposit_Before = (await stabilityPool.getCompoundedLUSDDeposit(dennis)).toString()
    const dennis_ETHGain_Before = (await stabilityPool.getDepositorETHGain(dennis)).toString()
    assert.isAtMost(th.getDifference(dennis_Deposit_Before, dec(100, 18)), 1000)
    assert.isAtMost(th.getDifference(dennis_ETHGain_Before, dec(995, 15)), 1000)

    // Attempt to liquidate Dennis
    try {
      await troveManager.liquidate(dennis)
    } catch (err) {
      assert.include(err.message, "revert")
    }

    // Check Dennis' SP deposit does not change after liquidation attempt
    const dennis_Deposit_After = (await stabilityPool.getCompoundedLUSDDeposit(dennis)).toString()
    const dennis_ETHGain_After = (await stabilityPool.getDepositorETHGain(dennis)).toString()
    assert.equal(dennis_Deposit_Before, dennis_Deposit_After)
    assert.equal(dennis_ETHGain_Before, dennis_ETHGain_After)
  })

  it("liquidate(): does not alter the liquidated user's token balance", async () => {
    await borrowerOperations.openTrove(0, dec(1000, 18), whale, { from: whale, value: dec(10, 'ether') })

    await borrowerOperations.openTrove(0, dec(300, 18), alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(0, dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(0, dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    await priceFeed.setPrice(dec(105, 18))

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check token balances 
    assert.equal((await lusdToken.balanceOf(alice)).toString(), dec(300, 18))
    assert.equal((await lusdToken.balanceOf(bob)).toString(), dec(200, 18))
    assert.equal((await lusdToken.balanceOf(carol)).toString(), dec(100, 18))

    // Check sortedList size is 4
    assert.equal((await sortedTroves.getSize()).toString(), '4')

    // Liquidate A, B and C
    await troveManager.liquidate(alice)
    await troveManager.liquidate(bob)
    await troveManager.liquidate(carol)

    // Confirm A, B, C closed
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))

    // Check sortedList size reduced to 1
    assert.equal((await sortedTroves.getSize()).toString(), '1')

    // Confirm token balances have not changed
    assert.equal((await lusdToken.balanceOf(alice)).toString(), dec(300, 18))
    assert.equal((await lusdToken.balanceOf(bob)).toString(), dec(200, 18))
    assert.equal((await lusdToken.balanceOf(carol)).toString(), dec(100, 18))
  })

  // --- liquidateTroves ---

  it("liquidateTroves(): With all ICRs > 110%, Liquidates Troves until system leaves recovery mode", async () => {
    // make 8 Troves accordingly
    // --- SETUP ---

    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _25_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3pt5_Ether })
    await borrowerOperations.openTrove(0, 0, carol, { from: carol, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, erin, { from: erin, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, freddy, { from: freddy, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, greta, { from: greta, value: _1_Ether })
    await borrowerOperations.openTrove(0, 0, harry, { from: harry, value: _1_Ether })

    // Everyone withdraws some LUSD from their Trove, resulting in different ICRs
    await borrowerOperations.withdrawLUSD(0, '1390000000000000000000', alice, { from: alice })  // 1400 LUSD -> ICR = 400%
    await borrowerOperations.withdrawLUSD(0, '190000000000000000000', bob, { from: bob }) //  200 LUSD -> ICR = 350%
    await borrowerOperations.withdrawLUSD(0, '200000000000000000000', carol, { from: carol }) // 210 LUSD -> ICR = 286%
    await borrowerOperations.withdrawLUSD(0, '210000000000000000000', dennis, { from: dennis }) // 220 LUSD -> ICR = 273%
    await borrowerOperations.withdrawLUSD(0, '220000000000000000000', erin, { from: erin }) // 230 LUSD -> ICR = 261%
    await borrowerOperations.withdrawLUSD(0, '230000000000000000000', freddy, { from: freddy }) // 240 LUSD -> ICR = 250%
    await borrowerOperations.withdrawLUSD(0, '75000000000000000000', greta, { from: greta }) // 85 LUSD -> ICR = 235%
    await borrowerOperations.withdrawLUSD(0, '80000000000000000000', harry, { from: harry }) // 90 LUSD ->  ICR = 222%

    // Alice deposits 1390 LUSD to Stability Pool
    await stabilityPool.provideToSP('1390000000000000000000', ZERO_ADDRESS, { from: alice })

    // price drops
    // price drops to 1ETH:90LUSD, reducing TCR below 150%
    await priceFeed.setPrice('90000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode_Before = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode_Before)

    // check TCR < 150%
    const _150percent = web3.utils.toBN('1500000000000000000')
    const TCR_Before = await troveManager.getTCR()
    assert.isTrue(TCR_Before.lt(_150percent))

    /* 
   After the price drop and prior to any liquidations, ICR should be:

    Trove         ICR
    Alice       161%
    Bob         158%
    Carol       129%
    Dennis      123%
    Elisa       117%
    Freddy      113%
    Greta       106%
    Harry       100%

    */
    const alice_ICR = await troveManager.getCurrentICR(alice, price)
    const bob_ICR = await troveManager.getCurrentICR(bob, price)
    const carol_ICR = await troveManager.getCurrentICR(carol, price)
    const dennis_ICR = await troveManager.getCurrentICR(dennis, price)
    const erin_ICR = await troveManager.getCurrentICR(erin, price)
    const freddy_ICR = await troveManager.getCurrentICR(freddy, price)
    const greta_ICR = await troveManager.getCurrentICR(greta, price)
    const harry_ICR = await troveManager.getCurrentICR(harry, price)
    const TCR = await troveManager.getTCR()

    // Alice and Bob should have ICR > TCR
    assert.isTrue(alice_ICR.gt(TCR))
    assert.isTrue(bob_ICR.gt(TCR))
    // All other Troves should have ICR < TCR
    assert.isTrue(carol_ICR.lt(TCR))
    assert.isTrue(dennis_ICR.lt(TCR))
    assert.isTrue(erin_ICR.lt(TCR))
    assert.isTrue(freddy_ICR.lt(TCR))
    assert.isTrue(greta_ICR.lt(TCR))
    assert.isTrue(harry_ICR.lt(TCR))

    /* Liquidations should occur from the lowest ICR Trove upwards, i.e. 
    1) Harry, 2) Greta, 3) Freddy, etc.

      Trove         ICR
    Alice       161%
    Bob         158%
    Carol       129%
    Dennis      123%
    ---- CUTOFF ----
    Elisa       117%
    Freddy      113%
    Greta       106%
    Harry       100%

    If all Troves below the cutoff are liquidated, the TCR of the system rises above the CCR, to 152%.  (see calculations in Google Sheet)

    Thus, after liquidateTroves(), expect all Troves to be liquidated up to the cut-off.  
    
    Only Alice, Bob, Carol and Dennis should remain active - all others should be closed. */

    // call liquidate Troves
    await troveManager.liquidateTroves(10);

    // check system is no longer in Recovery Mode
    const recoveryMode_After = await troveManager.checkRecoveryMode()
    assert.isFalse(recoveryMode_After)

    // After liquidation, TCR should rise to above 150%. 
    const TCR_After = await troveManager.getTCR()
    assert.isTrue(TCR_After.gt(_150percent))

    // get all Troves
    const alice_Trove = await troveManager.Troves(alice)
    const bob_Trove = await troveManager.Troves(bob)
    const carol_Trove = await troveManager.Troves(carol)
    const dennis_Trove = await troveManager.Troves(dennis)
    const erin_Trove = await troveManager.Troves(erin)
    const freddy_Trove = await troveManager.Troves(freddy)
    const greta_Trove = await troveManager.Troves(greta)
    const harry_Trove = await troveManager.Troves(harry)

    // check that Alice, Bob, Carol, & Dennis' Troves remain active
    assert.equal(alice_Trove[3], 1)
    assert.equal(bob_Trove[3], 1)
    assert.equal(carol_Trove[3], 1)
    assert.equal(dennis_Trove[3], 1)
    assert.isTrue(await sortedTroves.contains(alice))
    assert.isTrue(await sortedTroves.contains(bob))
    assert.isTrue(await sortedTroves.contains(carol))
    assert.isTrue(await sortedTroves.contains(dennis))

    // check all other Troves are closed
    assert.equal(erin_Trove[3], 2)
    assert.equal(freddy_Trove[3], 2)
    assert.equal(greta_Trove[3], 2)
    assert.equal(harry_Trove[3], 2)
    assert.isFalse(await sortedTroves.contains(erin))
    assert.isFalse(await sortedTroves.contains(freddy))
    assert.isFalse(await sortedTroves.contains(greta))
    assert.isFalse(await sortedTroves.contains(harry))
  })

  it("liquidateTroves(): Liquidates Troves until 1) system has left recovery mode AND 2) it reaches a Trove with ICR >= 110%", async () => {
    // make 6 Troves accordingly
    // --- SETUP ---

    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _30_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, carol, { from: carol, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, erin, { from: erin, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, freddy, { from: freddy, value: _3_Ether })

    // Alice withdraws 1400 LUSD, the others each withdraw 240 LUSD 
    await borrowerOperations.withdrawLUSD(0, '1400000000000000000000', alice, { from: alice })  // 1410 LUSD -> ICR = 426%
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', bob, { from: bob }) //  250 LUSD -> ICR = 240%
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', carol, { from: carol }) // 250 LUSD -> ICR = 240%
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', dennis, { from: dennis }) // 250 LUSD -> ICR = 240%
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', erin, { from: erin }) // 250 LUSD -> ICR = 240%
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', freddy, { from: freddy }) // 250 LUSD -> ICR = 240%

    // Alice deposits 1400 LUSD to Stability Pool
    await stabilityPool.provideToSP('1400000000000000000000', ZERO_ADDRESS, { from: alice })

    // price drops to 1ETH:85LUSD, reducing TCR below 150%
    await priceFeed.setPrice('85000000000000000000')
    const price = await priceFeed.getPrice()

    // check Recovery Mode kicks in

    const recoveryMode_Before = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode_Before)

    // check TCR < 150%
    const _150percent = web3.utils.toBN('1500000000000000000')
    const TCR_Before = await troveManager.getTCR()
    assert.isTrue(TCR_Before.lt(_150percent))

    /* 
   After the price drop and prior to any liquidations, ICR should be:

    Trove         ICR
    Alice       182%
    Bob         102%
    Carol       102%
    Dennis      102%
    Elisa       102%
    Freddy      102%
    */
    alice_ICR = await troveManager.getCurrentICR(alice, price)
    bob_ICR = await troveManager.getCurrentICR(bob, price)
    carol_ICR = await troveManager.getCurrentICR(carol, price)
    dennis_ICR = await troveManager.getCurrentICR(dennis, price)
    erin_ICR = await troveManager.getCurrentICR(erin, price)
    freddy_ICR = await troveManager.getCurrentICR(freddy, price)

    // Alice should have ICR > 150%
    assert.isTrue(alice_ICR.gt(_150percent))
    // All other Troves should have ICR < 150%
    assert.isTrue(carol_ICR.lt(_150percent))
    assert.isTrue(dennis_ICR.lt(_150percent))
    assert.isTrue(erin_ICR.lt(_150percent))
    assert.isTrue(freddy_ICR.lt(_150percent))

    /* Liquidations should occur from the lowest ICR Trove upwards, i.e. 
    1) Freddy, 2) Elisa, 3) Dennis.

    After liquidating Freddy and Elisa, the the TCR of the system rises above the CCR, to 154%.  
   (see calculations in Google Sheet)

    Liquidations continue until all Troves with ICR < MCR have been closed. 
    Only Alice should remain active - all others should be closed. */

    // call liquidate Troves
    await troveManager.liquidateTroves(6);

    // check system is no longer in Recovery Mode
    const recoveryMode_After = await troveManager.checkRecoveryMode()
    assert.isFalse(recoveryMode_After)

    // After liquidation, TCR should rise to above 150%. 
    const TCR_After = await troveManager.getTCR()
    assert.isTrue(TCR_After.gt(_150percent))

    // get all Troves
    const alice_Trove = await troveManager.Troves(alice)
    const bob_Trove = await troveManager.Troves(bob)
    const carol_Trove = await troveManager.Troves(carol)
    const dennis_Trove = await troveManager.Troves(dennis)
    const erin_Trove = await troveManager.Troves(erin)
    const freddy_Trove = await troveManager.Troves(freddy)

    // check that Alice's Trove remains active
    assert.equal(alice_Trove[3], 1)
    assert.isTrue(await sortedTroves.contains(alice))

    // check all other Troves are closed
    assert.equal(bob_Trove[3], 2)
    assert.equal(carol_Trove[3], 2)
    assert.equal(dennis_Trove[3], 2)
    assert.equal(erin_Trove[3], 2)
    assert.equal(freddy_Trove[3], 2)

    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))
    assert.isFalse(await sortedTroves.contains(dennis))
    assert.isFalse(await sortedTroves.contains(erin))
    assert.isFalse(await sortedTroves.contains(freddy))
  })

  it('liquidateTroves(): liquidates only up to the requested number of undercollateralized troves', async () => {
    await borrowerOperations.openTrove(0, '20000000000000000000000', whale, { from: whale, value: dec(300, 'ether') })

    // --- SETUP --- 
    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await borrowerOperations.openTrove(0, '95000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '94000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '93000000000000000000', carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '92000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '91000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    await priceFeed.setPrice(dec(100, 18))

    const TCR = await troveManager.getTCR()

    assert.isTrue(TCR.lte(web3.utils.toBN(dec(150, 18))))
    assert.isTrue(await troveManager.checkRecoveryMode())

    // --- TEST --- 

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidateTroves(3)

    // Check system still in Recovery Mode after liquidation tx
    assert.isTrue(await troveManager.checkRecoveryMode())

    const TroveOwnersArrayLength = await troveManager.getTroveOwnersCount()
    assert.equal(TroveOwnersArrayLength, '3')

    // Check Alice, Bob, Carol troves have been closed
    const aliceTroveStatus = (await troveManager.getTroveStatus(alice)).toString()
    const bobTroveStatus = (await troveManager.getTroveStatus(bob)).toString()
    const carolTroveStatus = (await troveManager.getTroveStatus(carol)).toString()

    assert.equal(aliceTroveStatus, '2')
    assert.equal(bobTroveStatus, '2')
    assert.equal(carolTroveStatus, '2')

    //  Check Alice, Bob, and Carol's trove are no longer in the sorted list
    const alice_isInSortedList = await sortedTroves.contains(alice)
    const bob_isInSortedList = await sortedTroves.contains(bob)
    const carol_isInSortedList = await sortedTroves.contains(carol)

    assert.isFalse(alice_isInSortedList)
    assert.isFalse(bob_isInSortedList)
    assert.isFalse(carol_isInSortedList)

    // Check Dennis, Erin still have active troves
    const dennisTroveStatus = (await troveManager.getTroveStatus(dennis)).toString()
    const erinTroveStatus = (await troveManager.getTroveStatus(erin)).toString()

    assert.equal(dennisTroveStatus, '1')
    assert.equal(erinTroveStatus, '1')

    // Check Dennis, Erin still in sorted list
    const dennis_isInSortedList = await sortedTroves.contains(dennis)
    const erin_isInSortedList = await sortedTroves.contains(erin)

    assert.isTrue(dennis_isInSortedList)
    assert.isTrue(erin_isInSortedList)
  })

  it("liquidateTroves(): does nothing if n = 0", async () => {
    await borrowerOperations.openTrove(0, dec(90, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(190, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(0, dec(290, 18), carol, { from: carol, value: dec(3, 'ether') })

    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const TCR_Before = (await troveManager.getTCR()).toString()

    // Confirm A, B, C ICRs are below 110%

    const alice_ICR = await troveManager.getCurrentICR(alice, price)
    const bob_ICR = await troveManager.getCurrentICR(bob, price)
    const carol_ICR = await troveManager.getCurrentICR(carol, price)
    assert.isTrue(alice_ICR.lte(mv._MCR))
    assert.isTrue(bob_ICR.lte(mv._MCR))
    assert.isTrue(carol_ICR.lte(mv._MCR))

    assert.isTrue(await troveManager.checkRecoveryMode())

    // Liquidation with n = 0
    await troveManager.liquidateTroves(0)

    // Check all troves are still in the system
    assert.isTrue(await sortedTroves.contains(alice))
    assert.isTrue(await sortedTroves.contains(bob))
    assert.isTrue(await sortedTroves.contains(carol))

    const TCR_After = (await troveManager.getTCR()).toString()

    // Check TCR has not changed after liquidation
    assert.equal(TCR_Before, TCR_After)
  })

  it('liquidateTroves(): closes every Trove with ICR < MCR, when n > number of undercollateralized troves', async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, dec(500, 18), whale, { from: whale, value: dec(10, 'ether') })

    // create 5 Troves with varying ICRs
    await borrowerOperations.openTrove(0, dec(190, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(0, dec(140, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(290, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(0, dec(100, 18), erin, { from: erin, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(170, 18), freddy, { from: freddy, value: dec(1, 'ether') })

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100LUSD, reducing Bob and Carol's ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Confirm troves A-E are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erin, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(freddy, price)).lte(mv._MCR))

    // Confirm Whale is ICR > 110% 
    assert.isTrue((await troveManager.getCurrentICR(whale, price)).gte(mv._MCR))

    // Liquidate 5 troves
    await troveManager.liquidateTroves(5);

    // Confirm troves A-E have been removed from the system
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))
    assert.isFalse(await sortedTroves.contains(erin))
    assert.isFalse(await sortedTroves.contains(freddy))

    // Check all troves are now closed
    assert.equal((await troveManager.Troves(alice))[3].toString(), '2')
    assert.equal((await troveManager.Troves(bob))[3].toString(), '2')
    assert.equal((await troveManager.Troves(carol))[3].toString(), '2')
    assert.equal((await troveManager.Troves(erin))[3].toString(), '2')
    assert.equal((await troveManager.Troves(freddy))[3].toString(), '2')
  })

  it("liquidateTroves(): a liquidation sequence containing Pool offsets increases the TCR", async () => {
    // Whale provides 500 LUSD to SP
    await borrowerOperations.openTrove(0, dec(500, 18), whale, { from: whale, value: dec(5, 'ether') })
    await stabilityPool.provideToSP(dec(500, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, 0, carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: dec(3, 'ether') })

    await borrowerOperations.openTrove(0, '91000000000000000000', defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '207000000000000000000', defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(0, '318000000000000000000', defaulter_3, { from: defaulter_3, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(0, '421000000000000000000', defaulter_4, { from: defaulter_4, value: dec(4, 'ether') })

    assert.isTrue((await sortedTroves.contains(defaulter_1)))
    assert.isTrue((await sortedTroves.contains(defaulter_2)))
    assert.isTrue((await sortedTroves.contains(defaulter_3)))
    assert.isTrue((await sortedTroves.contains(defaulter_4)))


    // Price drops
    await priceFeed.setPrice(dec(110, 18))
    const price = await priceFeed.getPrice()

    assert.isTrue(await th.ICRbetween100and110(defaulter_1, troveManager, price))
    assert.isTrue(await th.ICRbetween100and110(defaulter_2, troveManager, price))
    assert.isTrue(await th.ICRbetween100and110(defaulter_3, troveManager, price))
    assert.isTrue(await th.ICRbetween100and110(defaulter_4, troveManager, price))

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    const TCR_Before = await troveManager.getTCR()

    // Check Stability Pool has 500 LUSD
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), dec(500, 18))

    await troveManager.liquidateTroves(8)

    // assert.isFalse((await sortedTroves.contains(defaulter_1)))
    // assert.isFalse((await sortedTroves.contains(defaulter_2)))
    // assert.isFalse((await sortedTroves.contains(defaulter_3)))
    assert.isFalse((await sortedTroves.contains(defaulter_4)))

    // Check Stability Pool has been emptied by the liquidations
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), '0')

    // Check that the liquidation sequence has improved the TCR
    const TCR_After = await troveManager.getTCR()
    assert.isTrue(TCR_After.gte(TCR_Before))
  })

  it("liquidateTroves(): A liquidation sequence of pure redistributions decreases the TCR, due to gas compensation, but up to 0.5%", async () => {
    await borrowerOperations.openTrove(0, dec(400, 18), whale, { from: whale, value: dec(5, 'ether') })
    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, 0, carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: dec(3, 'ether') })

    await borrowerOperations.openTrove(0, '91000000000000000000', defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '247000000000000000000', defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(0, '318000000000000000000', defaulter_3, { from: defaulter_3, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(0, '470000000000000000000', defaulter_4, { from: defaulter_4, value: dec(4, 'ether') })

    assert.isTrue((await sortedTroves.contains(defaulter_1)))
    assert.isTrue((await sortedTroves.contains(defaulter_2)))
    assert.isTrue((await sortedTroves.contains(defaulter_3)))
    assert.isTrue((await sortedTroves.contains(defaulter_4)))

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    const TCR_Before = await troveManager.getTCR()
    // (5+1+2+3+1+2+3+4)*100/(410+10+10+10+101+257+328+480)
    assert.isAtMost(th.getDifference(TCR_Before, '1307596513075965027'), 1000)

    // Check pool is empty before liquidation
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), '0')

    // Liquidate
    await troveManager.liquidateTroves(8)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedTroves.contains(defaulter_1)))
    assert.isFalse((await sortedTroves.contains(defaulter_2)))
    assert.isFalse((await sortedTroves.contains(defaulter_3)))
    assert.isFalse((await sortedTroves.contains(defaulter_4)))

    // Check that the liquidation sequence has reduced the TCR
    const TCR_After = await troveManager.getTCR()
    // ((5+1+2+3)+(1+2+3+4)*0.995)*100/(410+10+10+10+101+257+328+480)
    assert.isAtMost(th.getDifference(TCR_After, '1304483188044831987'), 1000)
    assert.isTrue(TCR_Before.gte(TCR_After))
    assert.isTrue(TCR_After.gte(TCR_Before.mul(th.toBN(995)).div(th.toBN(1000))))
  })

  it("liquidateTroves(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await borrowerOperations.openTrove(0, dec(40, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '80500000000000000000', bob, { from: bob, value: dec(1, 'ether') })  // 90.5 LUSD, 1 ETH
    await borrowerOperations.openTrove(0, dec(90, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Defaulter opens with 30 LUSD, 0.3 ETH
    await borrowerOperations.openTrove(0, dec(20, 18), defaulter_1, { from: defaulter_1, value: dec(300, 'finney') })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    const alice_ICR_Before = await troveManager.getCurrentICR(alice, price)
    const bob_ICR_Before = await troveManager.getCurrentICR(bob, price)
    const carol_ICR_Before = await troveManager.getCurrentICR(carol, price)

    /* Before liquidation: 
    Alice ICR: = (1 * 100 / 50) = 200%
    Bob ICR: (1 * 100 / 90.5) = 110.5%
    Carol ICR: (1 * 100 / 100 ) =  100%

    Therefore Alice and Bob above the MCR, Carol is below */
    assert.isTrue(alice_ICR_Before.gte(mv._MCR))
    assert.isTrue(bob_ICR_Before.gte(mv._MCR))
    assert.isTrue(carol_ICR_Before.lte(mv._MCR))

    // Liquidate defaulter. 30 LUSD and 0.3 ETH is distributed uniformly between A, B and C. Each receive 10 LUSD, 0.1 ETH
    await troveManager.liquidate(defaulter_1)

    const alice_ICR_After = await troveManager.getCurrentICR(alice, price)
    const bob_ICR_After = await troveManager.getCurrentICR(bob, price)
    const carol_ICR_After = await troveManager.getCurrentICR(carol, price)

    /* After liquidation: 

    Alice ICR: (1.1 * 100 / 60) = 183.33%
    Bob ICR:(1.1 * 100 / 100.5) =  109.45%
    Carol ICR: (1.1 * 100 ) 100%

    Check Alice is above MCR, Bob below, Carol below. */
    assert.isTrue(alice_ICR_After.gte(mv._MCR))
    assert.isTrue(bob_ICR_After.lte(mv._MCR))
    assert.isTrue(carol_ICR_After.lte(mv._MCR))

    /* Though Bob's true ICR (including pending rewards) is below the MCR, 
   check that Bob's raw coll and debt has not changed, and that his "raw" ICR is above the MCR */
    const bob_Coll = (await troveManager.Troves(bob))[1]
    const bob_Debt = (await troveManager.Troves(bob))[0]

    const bob_rawICR = bob_Coll.mul(th.toBN(dec(100, 18))).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    // Liquidate A, B, C
    await troveManager.liquidateTroves(10)

    /*  Since there is 0 LUSD in the stability Pool, A, with ICR >110%, should stay active.
   Check Alice stays active, Carol gets liquidated, and Bob gets liquidated 
   (because his pending rewards bring his ICR < MCR) */
    assert.isTrue(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))

    // check trove statuses - A active (1),  B and C closed (2)
    assert.equal((await troveManager.Troves(alice))[3].toString(), '1')
    assert.equal((await troveManager.Troves(bob))[3].toString(), '2')
    assert.equal((await troveManager.Troves(carol))[3].toString(), '2')
  })

  it('liquidateTroves(): does nothing if all troves have ICR > 110% and Stability Pool is empty', async () => {
    await borrowerOperations.openTrove(0, dec(80, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(70, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(60, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    assert.isTrue((await sortedTroves.contains(alice)))
    assert.isTrue((await sortedTroves.contains(bob)))
    assert.isTrue((await sortedTroves.contains(carol)))

    const TCR_Before = (await troveManager.getTCR()).toString()
    const listSize_Before = (await sortedTroves.getSize()).toString()


    assert.isTrue((await troveManager.getCurrentICR(alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).gte(mv._MCR))

    // Confirm 0 LUSD in Stability Pool
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), '0')

    // Attempt liqudation sequence
    await troveManager.liquidateTroves(10)

    // Check all troves remain active
    assert.isTrue((await sortedTroves.contains(alice)))
    assert.isTrue((await sortedTroves.contains(bob)))
    assert.isTrue((await sortedTroves.contains(carol)))

    const TCR_After = (await troveManager.getTCR()).toString()
    const listSize_After = (await sortedTroves.getSize()).toString()

    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
  })

  it('liquidateTroves(): emits liquidation event with zero coll and debt when all troves have ICR > 110% and Stability Pool is empty', async () => {
    await borrowerOperations.openTrove(0, dec(80, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(70, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(60, 18), carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, dec(56, 18), dennis, { from: erin, value: dec(1, 'ether') })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    assert.isTrue((await troveManager.getCurrentICR(alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).gte(mv._MCR))

    // Confirm 0 LUSD in Stability Pool
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), '0')

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.liquidateTroves(10)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

    assert.equal(liquidatedDebt, '0')
    assert.equal(liquidatedColl, '0')
  })

  it('liquidateTroves(): emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves', async () => {
    // Whale adds 180 LUSD to SP
    await borrowerOperations.openTrove(0, dec(650, 18), whale, { from: whale, value: dec(10, 'ether') })
    await stabilityPool.provideToSP(dec(180, 18), ZERO_ADDRESS, { from: whale })

    // Troves to be absorbed by SP
    await borrowerOperations.openTrove(0, dec(80, 18), freddy, { from: freddy, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(80, 18), greta, { from: greta, value: dec(1, 'ether') })

    // Troves to be spared
    await borrowerOperations.openTrove(0, dec(70, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(65, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(60, 18), carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, dec(55, 18), dennis, { from: dennis, value: dec(1, 'ether') })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Confirm all troves have ICR > MCR
    assert.isTrue((await troveManager.getCurrentICR(freddy, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(greta, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).gte(mv._MCR))

    // Confirm 180 LUSD in Stability Pool
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), dec(180, 18))

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.liquidateTroves(10)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

    // Check F and G were liquidated
    assert.isFalse(await sortedTroves.contains(freddy))
    assert.isFalse(await sortedTroves.contains(greta))

    // Check whale and A-D remain active
    assert.isTrue(await sortedTroves.contains(alice))
    assert.isTrue(await sortedTroves.contains(bob))
    assert.isTrue(await sortedTroves.contains(carol))
    assert.isTrue(await sortedTroves.contains(dennis))
    assert.isTrue(await sortedTroves.contains(whale))

    // Liquidation event emits coll = (F_coll + G_coll)*0.995, and debt = (F_debt + G_debt)
    assert.equal(liquidatedDebt.toString(), dec(180, 18))
    assert.equal(liquidatedColl.toString(), dec(1990, 15))
  })

  it('liquidateTroves():  emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves, including a partial', async () => {
    // Whale opens trove and adds 220 LUSD to SP
    await borrowerOperations.openTrove(0, dec(650, 18), whale, { from: whale, value: dec(10, 'ether') })
    await stabilityPool.provideToSP(dec(220, 18), ZERO_ADDRESS, { from: whale })

    // Troves to be absorbed by SP
    await borrowerOperations.openTrove(0, dec(80, 18), freddy, { from: freddy, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(80, 18), greta, { from: greta, value: dec(1, 'ether') })

    // Trove to be partially liquidated
    await borrowerOperations.openTrove(0, dec(70, 18), alice, { from: alice, value: dec(1, 'ether') })

    // Troves to be spared
    await borrowerOperations.openTrove(0, dec(65, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(60, 18), carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, dec(55, 18), dennis, { from: dennis, value: dec(1, 'ether') })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Confirm all troves have ICR > MCR
    assert.isTrue((await troveManager.getCurrentICR(freddy, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(greta, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).gte(mv._MCR))

    // Confirm 220 LUSD in Stability Pool
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), dec(220, 18))

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.liquidateTroves(10)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

    // Check F and G were liquidated
    assert.isFalse(await sortedTroves.contains(freddy))
    assert.isFalse(await sortedTroves.contains(greta))

    // Check whale and A-D remain active
    assert.isTrue(await sortedTroves.contains(alice))
    assert.isTrue(await sortedTroves.contains(bob))
    assert.isTrue(await sortedTroves.contains(carol))
    assert.isTrue(await sortedTroves.contains(dennis))
    assert.isTrue(await sortedTroves.contains(whale))

    // Check A's collateral and debt have reduced by 50%, from partial liquidation
    const entireColl_A = (await troveManager.Troves(alice))[1].add(await troveManager.getPendingETHReward(alice))
    const entireDebt_A = (await troveManager.Troves(alice))[0].add(await troveManager.getPendingLUSDDebtReward(alice))

    assert.equal(entireColl_A, dec(5, 17))
    assert.equal(entireDebt_A, dec(40, 18))

    /* Liquidation event emits:
    coll = (F_coll + G_coll + A_Coll/2)*0.995
    debt = (F_debt + G_debt + A_debt/2) */
    assert.equal(liquidatedDebt.toString(), dec(220, 18))
    assert.equal(liquidatedColl.toString(), dec(24875, 14))
  })

  it("liquidateTroves(): does not affect the liquidated user's token balances", async () => {
    await borrowerOperations.openTrove(0, dec(1000, 18), whale, { from: whale, value: dec(15, 'ether') })

    // D, E, F open troves that will fall below MCR when price drops to 100
    await borrowerOperations.openTrove(0, dec(90, 18), dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(140, 18), erin, { from: erin, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(170, 18), freddy, { from: freddy, value: dec(1, 'ether') })

    // Check list size is 4
    assert.equal((await sortedTroves.getSize()).toString(), '4')

    // Check token balances before
    assert.equal((await lusdToken.balanceOf(dennis)).toString(), dec(90, 18))
    assert.equal((await lusdToken.balanceOf(erin)).toString(), dec(140, 18))
    assert.equal((await lusdToken.balanceOf(freddy)).toString(), dec(170, 18))

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    //Liquidate sequence
    await troveManager.liquidateTroves(10)

    // Check Whale remains in the system
    assert.isTrue(await sortedTroves.contains(whale))

    // Check D, E, F have been removed
    assert.isFalse(await sortedTroves.contains(dennis))
    assert.isFalse(await sortedTroves.contains(erin))
    assert.isFalse(await sortedTroves.contains(freddy))

    // Check token balances of users whose troves were liquidated, have not changed
    assert.equal((await lusdToken.balanceOf(dennis)).toString(), dec(90, 18))
    assert.equal((await lusdToken.balanceOf(erin)).toString(), dec(140, 18))
    assert.equal((await lusdToken.balanceOf(freddy)).toString(), dec(170, 18))
  })

  it("liquidateTroves(): Liquidating troves at 100 < ICR < 110 with SP deposits correctly impacts their SP deposit and ETH gain", async () => {
    // Whale provides 400 LUSD to the SP
    await borrowerOperations.openTrove(0, dec(400, 18), whale, { from: whale, value: dec(6, 'ether') })
    await stabilityPool.provideToSP(dec(400, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, dec(90, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(290, 18), bob, { from: bob, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(0, dec(90, 18), carol, { from: carol, value: dec(1, 'ether') })

    // A, B provide 90, 290 to the SP
    await stabilityPool.provideToSP(dec(90, 18), ZERO_ADDRESS, { from: alice })
    await stabilityPool.provideToSP(dec(290, 18), ZERO_ADDRESS, { from: bob })

    assert.equal((await sortedTroves.getSize()).toString(), '4')

    // Price drops
    await priceFeed.setPrice(dec(105, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check 780 LUSD in Pool
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), dec(780, 18))

    // *** Check A, B, C ICRs 100<ICR<110
    const alice_ICR = await troveManager.getCurrentICR(alice, price)
    const bob_ICR = await troveManager.getCurrentICR(bob, price)
    const carol_ICR = await troveManager.getCurrentICR(carol, price)

    assert.isTrue(alice_ICR.gte(mv._ICR100) && alice_ICR.lte(mv._MCR))
    assert.isTrue(bob_ICR.gte(mv._ICR100) && bob_ICR.lte(mv._MCR))
    assert.isTrue(carol_ICR.gte(mv._ICR100) && carol_ICR.lte(mv._MCR))

    // Liquidate
    await troveManager.liquidateTroves(10)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedTroves.contains(alice)))
    assert.isFalse((await sortedTroves.contains(bob)))
    assert.isFalse((await sortedTroves.contains(carol)))

    // check system sized reduced to 1 troves
    assert.equal((await sortedTroves.getSize()).toString(), '1')

    /* Prior to liquidation, SP deposits were:
    Whale: 400 LUSD
    Alice:  90 LUSD
    Bob:   290 LUSD
    Carol: 0 LUSD

    Total LUSD in Pool: 780 LUSD

    Then, liquidation hits A,B,C: 

    Total liquidated debt = 100 + 300 + 100 = 500 LUSD
    Total liquidated ETH = 1 + 3 + 1 = 5 ETH

    Whale LUSD Loss: 500 * (400/780) = 256.41 LUSD
    Alice LUSD Loss:  500 *(90/780) = 57.69 LUSD
    Bob LUSD Loss: 500 * (290/780) = 185.90 LUSD

    Whale remaining deposit: (400 - 256.41) = 143.59 LUSD
    Alice remaining deposit: (90 - 57.69) = 32.31 LUSD
    Bob remaining deposit: (290 - 185.90) = 104.10 LUSD

    Whale ETH Gain: 5*0.995 * (400/780) = 2.55 ETH
    Alice ETH Gain: 5*0.995 *(90/780) = 0.574 ETH
    Bob ETH Gain: 5*0.995 * (290/780) = 1.850 ETH

    Total remaining deposits: 280 LUSD
    Total ETH gain: 5 ETH */

    const LUSDinSP = (await stabilityPool.getTotalLUSDDeposits()).toString()
    const ETHinSP = (await stabilityPool.getETH()).toString()

    // Check remaining LUSD Deposits and ETH gain, for whale and depositors whose troves were liquidated
    const whale_Deposit_After = (await stabilityPool.getCompoundedLUSDDeposit(whale)).toString()
    const alice_Deposit_After = (await stabilityPool.getCompoundedLUSDDeposit(alice)).toString()
    const bob_Deposit_After = (await stabilityPool.getCompoundedLUSDDeposit(bob)).toString()

    const whale_ETHGain = (await stabilityPool.getDepositorETHGain(whale)).toString()
    const alice_ETHGain = (await stabilityPool.getDepositorETHGain(alice)).toString()
    const bob_ETHGain = (await stabilityPool.getDepositorETHGain(bob)).toString()

    assert.isAtMost(th.getDifference(whale_Deposit_After, '143589743589743591201'), 20000)
    assert.isAtMost(th.getDifference(alice_Deposit_After, '32307692307692306599'), 20000)
    assert.isAtMost(th.getDifference(bob_Deposit_After, '104102564102564087989'), 20000)

    assert.isAtMost(th.getDifference(whale_ETHGain, '2551282051282050655'), 2000)
    assert.isAtMost(th.getDifference(alice_ETHGain, '574038461538461497'), 2000)
    assert.isAtMost(th.getDifference(bob_ETHGain, '1849679487179487047'), 2000)

    // Check total remaining deposits and ETH gain in Stability Pool
    const total_LUSDinSP = (await stabilityPool.getTotalLUSDDeposits()).toString()
    const total_ETHinSP = (await stabilityPool.getETH()).toString()

    assert.isAtMost(th.getDifference(total_LUSDinSP, dec(280, 18)), 1000)
    assert.isAtMost(th.getDifference(total_ETHinSP, dec(4975, 15)), 1000)
  })

  it("liquidateTroves(): Liquidating troves at ICR <=100% with SP deposits does not alter their deposit or ETH gain", async () => {
    // Whale provides 400 LUSD to the SP
    await borrowerOperations.openTrove(0, dec(400, 18), whale, { from: whale, value: dec(6, 'ether') })
    await stabilityPool.provideToSP(dec(400, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, dec(170, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(300, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(0, dec(140, 18), carol, { from: carol, value: dec(1, 'ether') })

    // A, B provide 100, 300 to the SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: alice })
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: bob })

    assert.equal((await sortedTroves.getSize()).toString(), '4')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check LUSD and ETH in Pool  before
    const LUSDinSP_Before = (await stabilityPool.getTotalLUSDDeposits()).toString()
    const ETHinSP_Before = (await stabilityPool.getETH()).toString()
    assert.equal(LUSDinSP_Before, dec(800, 18))
    assert.equal(ETHinSP_Before, '0')

    // *** Check A, B, C ICRs < 100
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).lte(mv._ICR100))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).lte(mv._ICR100))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).lte(mv._ICR100))

    // Liquidate
    await troveManager.liquidateTroves(10)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedTroves.contains(alice)))
    assert.isFalse((await sortedTroves.contains(bob)))
    assert.isFalse((await sortedTroves.contains(carol)))

    // check system sized reduced to 1 troves
    assert.equal((await sortedTroves.getSize()).toString(), '1')

    // Check LUSD and ETH in Pool after
    const LUSDinSP_After = (await stabilityPool.getTotalLUSDDeposits()).toString()
    const ETHinSP_After = (await stabilityPool.getETH()).toString()
    assert.equal(LUSDinSP_Before, LUSDinSP_After)
    assert.equal(ETHinSP_Before, ETHinSP_After)

    // Check remaining LUSD Deposits and ETH gain, for whale and depositors whose troves were liquidated
    const whale_Deposit_After = (await stabilityPool.getCompoundedLUSDDeposit(whale)).toString()
    const alice_Deposit_After = (await stabilityPool.getCompoundedLUSDDeposit(alice)).toString()
    const bob_Deposit_After = (await stabilityPool.getCompoundedLUSDDeposit(bob)).toString()

    const whale_ETHGain_After = (await stabilityPool.getDepositorETHGain(whale)).toString()
    const alice_ETHGain_After = (await stabilityPool.getDepositorETHGain(alice)).toString()
    const bob_ETHGain_After = (await stabilityPool.getDepositorETHGain(bob)).toString()

    assert.equal(whale_Deposit_After, dec(400, 18))
    assert.equal(alice_Deposit_After, dec(100, 18))
    assert.equal(bob_Deposit_After, dec(300, 18))

    assert.equal(whale_ETHGain_After, '0')
    assert.equal(alice_ETHGain_After, '0')
    assert.equal(bob_ETHGain_After, '0')
  })

  it("liquidateTroves() with a partial liquidation: partially liquidated trove remains active", async () => {
    // Whale provides 253 LUSD to the SP
    await borrowerOperations.openTrove(0, '253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, '92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, '87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()

    // Check Recovery Mode is active
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check A, B, C, D, E troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price)
    const ICR_B = await troveManager.getCurrentICR(bob, price)
    const ICR_C = await troveManager.getCurrentICR(carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    /* Liquidate troves. Troves are ordered by ICR, from low to high:  A, B, C, D, E.
    With 253 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated. 
    That leaves 50 LUSD in the Pool to absorb exactly half of Carol's debt (100) */
    await troveManager.liquidateTroves(10)

    // Check A and B closed
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))

    // Check C remains active
    assert.isTrue(await sortedTroves.contains(carol))
    assert.equal((await troveManager.Troves(carol))[3].toString(), '1') // check Status is active
  })

  it("liquidateTroves() with a partial liquidation: partially liquidated trove remains in TroveOwners Array", async () => {
    // Whale provides 253 LUSD to the SP
    await borrowerOperations.openTrove(0, '253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, '92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, '87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()

    // Check Recovery Mode is active
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check A, B, C, D, E troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price)
    const ICR_B = await troveManager.getCurrentICR(bob, price)
    const ICR_C = await troveManager.getCurrentICR(carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    /* Liquidate troves. Troves are ordered by ICR, from low to high:  A, B, C, D, E.
    With 253 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated. 
    That leaves 50 LUSD in the Pool to absorb exactly half of Carol's debt (100) */
    await troveManager.liquidateTroves(10)

    // Check C is in Trove owners array
    const arrayLength = (await troveManager.getTroveOwnersCount()).toNumber()
    let addressFound = false;
    let addressIdx = 0;

    for (let i = 0; i < arrayLength; i++) {
      const address = (await troveManager.TroveOwners(i)).toString()
      if (address == carol) {
        addressFound = true
        addressIdx = i
      }
    }

    assert.isTrue(addressFound);

    // Check TroveOwners idx on trove struct == idx of address found in TroveOwners array
    const idxOnStruct = (await troveManager.Troves(carol))[4].toString()
    assert.equal(addressIdx.toString(), idxOnStruct)
  })

  it("liquidateTroves() with a partial liquidation: does not liquidate further troves after the partial", async () => {
    // Whale provides 250 LUSD to the SP
    await borrowerOperations.openTrove(0, '253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, '92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, '87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()

    // Check Recovery Mode is active
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check A, B, C, D, E troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price)
    const ICR_B = await troveManager.getCurrentICR(bob, price)
    const ICR_C = await troveManager.getCurrentICR(carol, price)
    const ICR_D = await troveManager.getCurrentICR(dennis, price)
    const ICR_E = await troveManager.getCurrentICR(erin, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))
    assert.isTrue(ICR_D.gt(mv._MCR) && ICR_D.lt(TCR))
    assert.isTrue(ICR_E.gt(mv._MCR) && ICR_E.lt(TCR))

    /* Liquidate troves. Troves are ordered by ICR, from low to high:  A, B, C, D, E.
    With 253 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated. 
    That leaves 50 LUSD in the Pool to absorb exactly half of Carol's debt (100) */
    await troveManager.liquidateTroves(10)

    // Check A and B closed
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))

    // Check whale, C, D and E stay active
    assert.isTrue(await sortedTroves.contains(whale))
    assert.isTrue(await sortedTroves.contains(carol))
    assert.isTrue(await sortedTroves.contains(dennis))
    assert.isTrue(await sortedTroves.contains(erin))
  })

  it("liquidateTroves() with a partial liquidation: total liquidated coll and debt is correct", async () => {
    // Whale provides 253 LUSD to the SP
    await borrowerOperations.openTrove(0, '253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, '92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, '87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()

    // Check Recovery Mode is active
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price)
    const ICR_B = await troveManager.getCurrentICR(bob, price)
    const ICR_C = await troveManager.getCurrentICR(carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    const entireSystemCollBefore = await troveManager.getEntireSystemColl()
    const entireSystemDebtBefore = await troveManager.getEntireSystemDebt()

    /* Liquidate troves. Troves are ordered by ICR, from low to high:  A, B, C, D, E.
    With 253 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated. 
    That leaves 50 LUSD in the Pool to absorb exactly half of Carol's debt (100) */
    const tx = await troveManager.liquidateTroves(10)

    // Expect system debt reduced by 250 LUSD and system coll 2.5 ETH
    const entireSystemCollAfter = await troveManager.getEntireSystemColl()
    const entireSystemDebtAfter = await troveManager.getEntireSystemDebt()

    const changeInEntireSystemColl = entireSystemCollBefore.sub(entireSystemCollAfter)
    const changeInEntireSystemDebt = entireSystemDebtBefore.sub(entireSystemDebtAfter)

    assert.equal(changeInEntireSystemColl, '2500000000000000000')
    assert.equal(changeInEntireSystemDebt, '253000000000000000000')
  })

  it("liquidateTroves() with a partial liquidation: emits correct liquidation event values", async () => {
    // Whale provides 253 LUSD to the SP
    await borrowerOperations.openTrove(0, '253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, '92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, '87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()

    // Check Recovery Mode is active
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price)
    const ICR_B = await troveManager.getCurrentICR(bob, price)
    const ICR_C = await troveManager.getCurrentICR(carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    /* Liquidate troves. Troves are ordered by ICR, from low to high:  A, B, C, D, E.
    With 253 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated. 
    That leaves 50 LUSD in the Pool to absorb exactly half of Carol's debt (100) */
    const liquidationTx = await troveManager.liquidateTroves(10)

    const [liquidatedDebt, liquidatedColl, collGasComp, lusdGasComp] = th.getEmittedLiquidationValues(liquidationTx)

    assert.equal(liquidatedDebt.toString(), '253000000000000000000')
    assert.equal(liquidatedColl.toString(), '2487500000000000000') // 2.5*0.995
    assert.equal(collGasComp.toString(), dec(125, 14)) // 0.5% of 2.5
    assert.equal(lusdGasComp.toString(), dec(20, 18)) // partially liquidated trove doesn’t count here
  })

  it("liquidateTroves() with a partial liquidation: ICR of partially liquidated trove does not change", async () => {
    // Whale provides 253 LUSD to the SP
    await borrowerOperations.openTrove(0, '253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, '92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, '87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()

    // Check Recovery Mode is active
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price)
    const ICR_B = await troveManager.getCurrentICR(bob, price)
    const ICR_C_Before = await troveManager.getCurrentICR(carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C_Before.gt(mv._MCR) && ICR_C_Before.lt(TCR))

    /* Liquidate troves. Troves are ordered by ICR, from low to high:  A, B, C, D, E.
    With 253 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated. 
    That leaves 50 LUSD in the Pool to absorb exactly half of Carol's debt (100) */
    await troveManager.liquidateTroves(10)

    const ICR_C_After = await troveManager.getCurrentICR(carol, price)
    assert.equal(ICR_C_Before.toString(), ICR_C_After)
  })

  // TODO: LiquidateTroves tests that involve troves with ICR > TCR

  // --- batchLiquidateTroves() ---

  it("batchLiquidateTroves(): Liquidates all troves with ICR < 110%, transitioning Normal -> Recovery Mode", async () => {
    // make 6 Troves accordingly
    // --- SETUP ---

    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _30_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, carol, { from: carol, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, erin, { from: erin, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, freddy, { from: freddy, value: _3_Ether })

    // Alice withdraws 1400 LUSD, the others each withdraw 240 LUSD 
    await borrowerOperations.withdrawLUSD(0, '1400000000000000000000', alice, { from: alice })  // 1410 LUSD -> ICR = 426%
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', bob, { from: bob }) //  250 LUSD -> ICR = 240%
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', carol, { from: carol }) // 250 LUSD -> ICR = 240%
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', dennis, { from: dennis }) // 250 LUSD -> ICR = 240%
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', erin, { from: erin }) // 250 LUSD -> ICR = 240%
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', freddy, { from: freddy }) // 250 LUSD -> ICR = 240%

    // Alice deposits 1400 LUSD to Stability Pool
    await stabilityPool.provideToSP('1400000000000000000000', ZERO_ADDRESS, { from: alice })

    // price drops to 1ETH:85LUSD, reducing TCR below 150%
    await priceFeed.setPrice('85000000000000000000')
    const price = await priceFeed.getPrice()

    // check Recovery Mode kicks in

    const recoveryMode_Before = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode_Before)

    // check TCR < 150%
    const _150percent = web3.utils.toBN('1500000000000000000')
    const TCR_Before = await troveManager.getTCR()
    assert.isTrue(TCR_Before.lt(_150percent))

    /* 
    After the price drop and prior to any liquidations, ICR should be:

    Trove         ICR
    Alice       182%
    Bob         102%
    Carol       102%
    Dennis      102%
    Elisa       102%
    Freddy      102%
    */
    alice_ICR = await troveManager.getCurrentICR(alice, price)
    bob_ICR = await troveManager.getCurrentICR(bob, price)
    carol_ICR = await troveManager.getCurrentICR(carol, price)
    dennis_ICR = await troveManager.getCurrentICR(dennis, price)
    erin_ICR = await troveManager.getCurrentICR(erin, price)
    freddy_ICR = await troveManager.getCurrentICR(freddy, price)

    // Alice should have ICR > 150%
    assert.isTrue(alice_ICR.gt(_150percent))
    // All other Troves should have ICR < 150%
    assert.isTrue(carol_ICR.lt(_150percent))
    assert.isTrue(dennis_ICR.lt(_150percent))
    assert.isTrue(erin_ICR.lt(_150percent))
    assert.isTrue(freddy_ICR.lt(_150percent))

    /* After liquidating Bob and Carol, the the TCR of the system rises above the CCR, to 154%.  
    (see calculations in Google Sheet)

    Liquidations continue until all Troves with ICR < MCR have been closed. 
    Only Alice should remain active - all others should be closed. */

    // call batchLiquidateTroves
    await troveManager.batchLiquidateTroves([alice, bob, carol, dennis, erin, freddy]);

    // check system is no longer in Recovery Mode
    const recoveryMode_After = await troveManager.checkRecoveryMode()
    assert.isFalse(recoveryMode_After)

    // After liquidation, TCR should rise to above 150%. 
    const TCR_After = await troveManager.getTCR()
    assert.isTrue(TCR_After.gt(_150percent))

    // get all Troves
    const alice_Trove = await troveManager.Troves(alice)
    const bob_Trove = await troveManager.Troves(bob)
    const carol_Trove = await troveManager.Troves(carol)
    const dennis_Trove = await troveManager.Troves(dennis)
    const erin_Trove = await troveManager.Troves(erin)
    const freddy_Trove = await troveManager.Troves(freddy)

    // check that Alice's Trove remains active
    assert.equal(alice_Trove[3], 1)
    assert.isTrue(await sortedTroves.contains(alice))

    // check all other Troves are closed
    assert.equal(bob_Trove[3], 2)
    assert.equal(carol_Trove[3], 2)
    assert.equal(dennis_Trove[3], 2)
    assert.equal(erin_Trove[3], 2)
    assert.equal(freddy_Trove[3], 2)

    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))
    assert.isFalse(await sortedTroves.contains(dennis))
    assert.isFalse(await sortedTroves.contains(erin))
    assert.isFalse(await sortedTroves.contains(freddy))
  })

  it("batchLiquidateTroves(): Liquidates all troves with ICR < 110%, transitioning Recovery -> Normal Mode", async () => {
    /* This is essentially the same test as before, but changing the order of the batch,
     * now the remaining trove (alice) goes at the end.
     * This way alice will be skipped in a different part of the code, as in the previous test,
     * when attempting alice the system was in Recovery mode, while in this test,
     * when attempting alice the system has gone back to Normal mode
     * (see function `_getTotalFromBatchLiquidate_RecoveryMode`)
     */
    // make 6 Troves accordingly
    // --- SETUP ---

    await borrowerOperations.openTrove(0, 0, alice, { from: alice, value: _30_Ether })
    await borrowerOperations.openTrove(0, 0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, carol, { from: carol, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, dennis, { from: dennis, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, erin, { from: erin, value: _3_Ether })
    await borrowerOperations.openTrove(0, 0, freddy, { from: freddy, value: _3_Ether })

    // Alice withdraws 1400 LUSD, the others each withdraw 240 LUSD
    await borrowerOperations.withdrawLUSD(0, '1400000000000000000000', alice, { from: alice })  // 1410 LUSD -> ICR = 426%
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', bob, { from: bob }) //  250 LUSD -> ICR = 240%
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', carol, { from: carol }) // 250 LUSD -> ICR = 240%
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', dennis, { from: dennis }) // 250 LUSD -> ICR = 240%
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', erin, { from: erin }) // 250 LUSD -> ICR = 240%
    await borrowerOperations.withdrawLUSD(0, '240000000000000000000', freddy, { from: freddy }) // 250 LUSD -> ICR = 240%

    // Alice deposits 1400 LUSD to Stability Pool
    await stabilityPool.provideToSP('1400000000000000000000', ZERO_ADDRESS, { from: alice })

    // price drops to 1ETH:85LUSD, reducing TCR below 150%
    await priceFeed.setPrice('85000000000000000000')
    const price = await priceFeed.getPrice()

    // check Recovery Mode kicks in

    const recoveryMode_Before = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode_Before)

    // check TCR < 150%
    const _150percent = web3.utils.toBN('1500000000000000000')
    const TCR_Before = await troveManager.getTCR()
    assert.isTrue(TCR_Before.lt(_150percent))

    /*
    After the price drop and prior to any liquidations, ICR should be:

    Trove         ICR
    Alice       182%
    Bob         102%
    Carol       102%
    Dennis      102%
    Elisa       102%
    Freddy      102%
    */
    const alice_ICR = await troveManager.getCurrentICR(alice, price)
    const bob_ICR = await troveManager.getCurrentICR(bob, price)
    const carol_ICR = await troveManager.getCurrentICR(carol, price)
    const dennis_ICR = await troveManager.getCurrentICR(dennis, price)
    const erin_ICR = await troveManager.getCurrentICR(erin, price)
    const freddy_ICR = await troveManager.getCurrentICR(freddy, price)

    // Alice should have ICR > 150%
    assert.isTrue(alice_ICR.gt(_150percent))
    // All other Troves should have ICR < 150%
    assert.isTrue(carol_ICR.lt(_150percent))
    assert.isTrue(dennis_ICR.lt(_150percent))
    assert.isTrue(erin_ICR.lt(_150percent))
    assert.isTrue(freddy_ICR.lt(_150percent))

    /* After liquidating Bob and Carol, the the TCR of the system rises above the CCR, to 154%.  
    (see calculations in Google Sheet)

    Liquidations continue until all Troves with ICR < MCR have been closed. 
    Only Alice should remain active - all others should be closed. */

    // call batchLiquidateTroves
    await troveManager.batchLiquidateTroves([bob, carol, dennis, erin, freddy, alice]);

    // check system is no longer in Recovery Mode
    const recoveryMode_After = await troveManager.checkRecoveryMode()
    assert.isFalse(recoveryMode_After)

    // After liquidation, TCR should rise to above 150%. 
    const TCR_After = await troveManager.getTCR()
    assert.isTrue(TCR_After.gt(_150percent))

    // get all Troves
    const alice_Trove = await troveManager.Troves(alice)
    const bob_Trove = await troveManager.Troves(bob)
    const carol_Trove = await troveManager.Troves(carol)
    const dennis_Trove = await troveManager.Troves(dennis)
    const erin_Trove = await troveManager.Troves(erin)
    const freddy_Trove = await troveManager.Troves(freddy)

    // check that Alice's Trove remains active
    assert.equal(alice_Trove[3], 1)
    assert.isTrue(await sortedTroves.contains(alice))

    // check all other Troves are closed
    assert.equal(bob_Trove[3], 2)
    assert.equal(carol_Trove[3], 2)
    assert.equal(dennis_Trove[3], 2)
    assert.equal(erin_Trove[3], 2)
    assert.equal(freddy_Trove[3], 2)

    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))
    assert.isFalse(await sortedTroves.contains(dennis))
    assert.isFalse(await sortedTroves.contains(erin))
    assert.isFalse(await sortedTroves.contains(freddy))
  })

  it("batchLiquidateTroves() with a partial liquidation: partially liquidated trove remains active", async () => {
    // Whale provides 253 LUSD to the SP
    await borrowerOperations.openTrove(0, '253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, '92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, '87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()

    // Check Recovery Mode is active
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price)
    const ICR_B = await troveManager.getCurrentICR(bob, price)
    const ICR_C = await troveManager.getCurrentICR(carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    const trovesToLiquidate = [alice, bob, carol]
    await troveManager.batchLiquidateTroves(trovesToLiquidate)

    // Check A and B closed
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))

    // Check C remains active
    assert.isTrue(await sortedTroves.contains(carol))
    assert.equal((await troveManager.Troves(carol))[3].toString(), '1') // check Status is active
  })

  it("batchLiquidateTroves() with a partial liquidation: partially liquidated trove remains in Trove Owners array", async () => {
    // Whale provides 253 LUSD to the SP
    await borrowerOperations.openTrove(0, '253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, '92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, '87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()

    // Check Recovery Mode is active
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price)
    const ICR_B = await troveManager.getCurrentICR(bob, price)
    const ICR_C = await troveManager.getCurrentICR(carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    const trovesToLiquidate = [alice, bob, carol]
    await troveManager.batchLiquidateTroves(trovesToLiquidate)

    // Check C is in Trove owners array
    const arrayLength = (await troveManager.getTroveOwnersCount()).toNumber()
    let addressFound = false;
    let addressIdx = 0;

    for (let i = 0; i < arrayLength; i++) {
      const address = (await troveManager.TroveOwners(i)).toString()
      if (address == carol) {
        addressFound = true
        addressIdx = i
      }
    }

    assert.isTrue(addressFound);

    // Check TroveOwners idx on trove struct == idx of address found in TroveOwners array
    const idxOnStruct = (await troveManager.Troves(carol))[4].toString()
    assert.equal(addressIdx.toString(), idxOnStruct)
  })

  it("batchLiquidateTroves() with a partial liquidation: does not liquidate further troves after the partial", async () => {
    // Whale provides 250 LUSD to the SP
    await borrowerOperations.openTrove(0, '253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, '92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, '87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()

    // Check Recovery Mode is active
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check A, B, C, D, E troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price)
    const ICR_B = await troveManager.getCurrentICR(bob, price)
    const ICR_C = await troveManager.getCurrentICR(carol, price)
    const ICR_D = await troveManager.getCurrentICR(dennis, price)
    const ICR_E = await troveManager.getCurrentICR(erin, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))
    assert.isTrue(ICR_D.gt(mv._MCR) && ICR_D.lt(TCR))
    assert.isTrue(ICR_E.gt(mv._MCR) && ICR_E.lt(TCR))

    const trovesToLiquidate = [alice, bob, carol, dennis, erin]
    await troveManager.batchLiquidateTroves(trovesToLiquidate)

    // Check A and B closed
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))

    // Check whale, C, D and E stay active
    assert.isTrue(await sortedTroves.contains(whale))
    assert.isTrue(await sortedTroves.contains(carol))
    assert.isTrue(await sortedTroves.contains(dennis))
    assert.isTrue(await sortedTroves.contains(erin))
  })

  it("batchLiquidateTroves() with a partial liquidation: total liquidated coll and debt is correct", async () => {
    // Whale provides 253 LUSD to the SP
    await borrowerOperations.openTrove(0, '253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, '92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, '87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()

    // Check Recovery Mode is active
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check A, B, C, D, E troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price)
    const ICR_B = await troveManager.getCurrentICR(bob, price)
    const ICR_C = await troveManager.getCurrentICR(carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    const entireSystemCollBefore = await troveManager.getEntireSystemColl()
    const entireSystemDebtBefore = await troveManager.getEntireSystemDebt()

    const trovesToLiquidate = [alice, bob, carol]
    await troveManager.batchLiquidateTroves(trovesToLiquidate)

    // Expect system debt reduced by 250 LUSD and system coll 2.5 ETH
    const entireSystemCollAfter = await troveManager.getEntireSystemColl()
    const entireSystemDebtAfter = await troveManager.getEntireSystemDebt()

    const changeInEntireSystemColl = entireSystemCollBefore.sub(entireSystemCollAfter)
    const changeInEntireSystemDebt = entireSystemDebtBefore.sub(entireSystemDebtAfter)

    assert.equal(changeInEntireSystemColl, '2500000000000000000')
    assert.equal(changeInEntireSystemDebt, '253000000000000000000')
  })

  it("batchLiquidateTroves() with a partial liquidation: emits correct liquidation event values", async () => {
    // Whale provides 253 LUSD to the SP
    await borrowerOperations.openTrove(0, '253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, '92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, '87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()

    // Check Recovery Mode is active
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price)
    const ICR_B = await troveManager.getCurrentICR(bob, price)
    const ICR_C = await troveManager.getCurrentICR(carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    const trovesToLiquidate = [alice, bob, carol]
    const liquidationTx = await troveManager.batchLiquidateTroves(trovesToLiquidate)

    const [liquidatedDebt, liquidatedColl, collGasComp, lusdGasComp] = th.getEmittedLiquidationValues(liquidationTx)

    assert.equal(liquidatedDebt.toString(), '253000000000000000000')
    assert.equal(liquidatedColl.toString(), '2487500000000000000') // 2.5*0.995
    assert.equal(collGasComp.toString(), dec(125, 14)) // 0.5% of 2.5
    assert.equal(lusdGasComp.toString(), dec(20, 18)) // partially liquidated trove doesn’t count here
  })

  it("batchLiquidateTroves() with a partial liquidation: ICR of partially liquidated trove does not change", async () => {
    // Whale provides 253 LUSD to the SP
    await borrowerOperations.openTrove(0, '253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, '92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, '87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()

    // Check Recovery Mode is active
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price)
    const ICR_B = await troveManager.getCurrentICR(bob, price)
    const ICR_C_Before = await troveManager.getCurrentICR(carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C_Before.gt(mv._MCR) && ICR_C_Before.lt(TCR))

    const trovesToLiquidate = [alice, bob, carol]
    await troveManager.batchLiquidateTroves(trovesToLiquidate)

    const ICR_C_After = await troveManager.getCurrentICR(carol, price)
    assert.equal(ICR_C_Before.toString(), ICR_C_After)
  })

  it("batchLiquidateTroves(), with 110% < ICR < TCR, and StabilityPool LUSD > debt to liquidate: can liquidate troves out of order", async () => {
    // Whale provides 1000 LUSD to the SP
    await borrowerOperations.openTrove(0, dec(1000, 18), whale, { from: whale, value: dec(10, 'ether') })
    await stabilityPool.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, 
      '90000000000000000000', alice, 
      { 
        from: alice, 
        value: dec(1, 'ether') 
      }
    )
    await borrowerOperations.openTrove(0, '89000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '88000000000000000000', carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, '87000000000000000000', erin, { from: erin, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(0, '86000000000000000000', freddy, { from: freddy, value: dec(2, 'ether') })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is active
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check troves A-D are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price)
    const ICR_B = await troveManager.getCurrentICR(bob, price)
    const ICR_C = await troveManager.getCurrentICR(carol, price)
    const ICR_D = await troveManager.getCurrentICR(dennis, price)
    const TCR = await troveManager.getTCR()

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))
    assert.isTrue(ICR_D.gt(mv._MCR) && ICR_D.lt(TCR))

    // Troves are ordered by ICR, low to high: A, B, C, D.

    // Liquidate out of ICR order: D, B, C. A (lowest ICR) not included.
    const trovesToLiquidate = [dennis, bob, carol]

    const liquidationTx = await troveManager.batchLiquidateTroves(trovesToLiquidate)

    // Check transaction succeeded
    assert.isTrue(liquidationTx.receipt.status)

    // Confirm troves D, B, C removed
    assert.isFalse(await sortedTroves.contains(dennis))
    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))

    // Confirm troves have status 'closed' (Status enum element idx 2)
    assert.equal((await troveManager.Troves(dennis))[3], '2')
    assert.equal((await troveManager.Troves(dennis))[3], '2')
    assert.equal((await troveManager.Troves(dennis))[3], '2')
  })

  it("batchLiquidateTroves(), with 110% < ICR < TCR, and StabilityPool empty: doesn't liquidate any troves", async () => {
    await borrowerOperations.openTrove(0, '90000000000000000000', alice, { from: alice, value: dec(1, 'ether') })

    const bobDebt_Before = '89000000000000000000'
    const carolDebt_Before = '88000000000000000000'
    const dennisDebt_Before = '87000000000000000000'

    await borrowerOperations.openTrove(0, bobDebt_Before, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, carolDebt_Before, carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dennisDebt_Before, dennis, { from: dennis, value: dec(1, 'ether') })

    const bobColl_Before = (await troveManager.Troves(bob))[1]
    const carolColl_Before = (await troveManager.Troves(carol))[1]
    const dennisColl_Before = (await troveManager.Troves(dennis))[1]

    await borrowerOperations.openTrove(0, '87000000000000000000', erin, { from: erin, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, '86000000000000000000', freddy, { from: freddy, value: dec(1, 'ether') })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()

    // Check Recovery Mode is active
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check troves A-D are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(alice, price)
    const ICR_B = await troveManager.getCurrentICR(bob, price)
    const ICR_C = await troveManager.getCurrentICR(carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    // Troves are ordered by ICR, low to high: A, B, C, D. 
    // Liquidate out of ICR order: D, B, C. A (lowest ICR) not included.
    const trovesToLiquidate = [dennis, bob, carol]
    const liquidationTx = await troveManager.batchLiquidateTroves(trovesToLiquidate)

    // Check transaction succeeded
    assert.isTrue(liquidationTx.receipt.status)

    // Confirm troves D, B, C remain in system
    assert.isTrue(await sortedTroves.contains(dennis))
    assert.isTrue(await sortedTroves.contains(bob))
    assert.isTrue(await sortedTroves.contains(carol))

    // Confirm troves have status 'active' (Status enum element idx 1)
    assert.equal((await troveManager.Troves(dennis))[3], '1')
    assert.equal((await troveManager.Troves(dennis))[3], '1')
    assert.equal((await troveManager.Troves(dennis))[3], '1')

    // Confirm D, B, C coll & debt have not changed
    const dennisDebt_After = (await troveManager.Troves(dennis))[0].add(await troveManager.getPendingLUSDDebtReward(dennis))
    const bobDebt_After = (await troveManager.Troves(bob))[0].add(await troveManager.getPendingLUSDDebtReward(bob))
    const carolDebt_After = (await troveManager.Troves(carol))[0].add(await troveManager.getPendingLUSDDebtReward(carol))

    const dennisColl_After = (await troveManager.Troves(dennis))[1].add(await troveManager.getPendingETHReward(dennis))  
    const bobColl_After = (await troveManager.Troves(bob))[1].add(await troveManager.getPendingETHReward(bob))
    const carolColl_After = (await troveManager.Troves(carol))[1].add(await troveManager.getPendingETHReward(carol))

    assert.isTrue(dennisColl_After.eq(dennisColl_Before))
    assert.isTrue(bobColl_After.eq(bobColl_Before))
    assert.isTrue(carolColl_After.eq(carolColl_Before))

    assert.equal(th.toBN(dennisDebt_Before).add(th.toBN(dec(10, 18))).toString(), dennisDebt_After.toString())
    assert.equal(th.toBN(bobDebt_Before).add(th.toBN(dec(10, 18))).toString(), bobDebt_After.toString())
    assert.equal(th.toBN(carolDebt_Before).add(th.toBN(dec(10, 18))).toString(), carolDebt_After.toString())
  })

  it('batchLiquidateTroves(): skips liquidation of troves with ICR > TCR, regardless of Stability Pool size', async () => {
    // Whale adds 1000 LUSD to SP
    await borrowerOperations.openTrove(0, dec(1000, 18), whale, { from: whale, value: dec(10, 'ether') })
    await stabilityPool.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: whale })

    // Troves that will fall into ICR range 100-MCR
    await borrowerOperations.openTrove(0, dec(93, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(92, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(91, 18), C, { from: C, value: dec(1, 'ether') })

    // Troves that will fall into ICR range 110-TCR
    await borrowerOperations.openTrove(0, dec(82, 18), D, { from: D, value: dec(1, 'ether') }) 
    await borrowerOperations.openTrove(0, dec(81, 18), E, { from: E, value: dec(1, 'ether') }) 
    await borrowerOperations.openTrove(0, dec(80, 18), F, { from: F, value: dec(1, 'ether') }) 

    // Troves that will fall into ICR range >= TCR
    await borrowerOperations.openTrove(0, dec(40, 18), G, { from: G, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(30, 18), H, { from: H, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(20, 18), I, { from: I, value: dec(1, 'ether') })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(110, 18)) 
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    const G_collBefore = (await troveManager.Troves(G))[1]
    const G_debtBefore = (await troveManager.Troves(G))[0]
    const H_collBefore = (await troveManager.Troves(H))[1]
    const H_debtBefore = (await troveManager.Troves(H))[0]
    const I_collBefore = (await troveManager.Troves(I))[1]
    const I_debtBefore = (await troveManager.Troves(I))[0]

    const ICR_A = await troveManager.getCurrentICR(A, price) 
    const ICR_B = await troveManager.getCurrentICR(B, price) 
    const ICR_C = await troveManager.getCurrentICR(C, price) 
    const ICR_D = await troveManager.getCurrentICR(D, price)
    const ICR_E = await troveManager.getCurrentICR(E, price)
    const ICR_F = await troveManager.getCurrentICR(F, price)
    const ICR_G = await troveManager.getCurrentICR(G, price)
    const ICR_H = await troveManager.getCurrentICR(H, price)
    const ICR_I = await troveManager.getCurrentICR(I, price)

    // Check A-C are in range 100-110
    assert.isTrue(ICR_A.gte(mv._ICR100) && ICR_A.lt(mv._MCR))
    assert.isTrue(ICR_B.gte(mv._ICR100) && ICR_B.lt(mv._MCR))
    assert.isTrue(ICR_C.gte(mv._ICR100) && ICR_C.lt(mv._MCR))

    // Check D-F are in range 110-TCR
    assert.isTrue(ICR_D.gt(mv._MCR) && ICR_D.lt(TCR))
    assert.isTrue(ICR_E.gt(mv._MCR) && ICR_E.lt(TCR))
    assert.isTrue(ICR_F.gt(mv._MCR) && ICR_F.lt(TCR))

    // Check G-I are in range >= TCR
    assert.isTrue(ICR_G.gte(TCR))
    assert.isTrue(ICR_H.gte(TCR))
    assert.isTrue(ICR_I.gte(TCR))

    // Attempt to liquidate only troves with ICR > TCR% 
    await troveManager.batchLiquidateTroves([G, H, I])

    // Check G, H, I remain in system
    assert.isTrue(await sortedTroves.contains(G))
    assert.isTrue(await sortedTroves.contains(H))
    assert.isTrue(await sortedTroves.contains(I))

    // Check G, H, I coll and debt have not changed
    assert.equal(G_collBefore.eq(await troveManager.Troves(G))[1])
    assert.equal(G_debtBefore.eq(await troveManager.Troves(G))[0])
    assert.equal(H_collBefore.eq(await troveManager.Troves(H))[1])
    assert.equal(H_debtBefore.eq(await troveManager.Troves(H))[0])
    assert.equal(I_collBefore.eq(await troveManager.Troves(I))[1])
    assert.equal(I_debtBefore.eq(await troveManager.Troves(I))[0])

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())
  
    // Attempt to liquidate a variety of troves with SP covering whole batch.
    // Expect A, C, D, F to be liquidated, and G, H, I to remain in system
    await troveManager.batchLiquidateTroves([C, D, G, H, A, I])
    
    // Confirm A, C, D liquidated  
    assert.isFalse(await sortedTroves.contains(C))
    assert.isFalse(await sortedTroves.contains(A))
    assert.isFalse(await sortedTroves.contains(D))
    
    // Check G, H, I remain in system
    assert.isTrue(await sortedTroves.contains(G))
    assert.isTrue(await sortedTroves.contains(H))
    assert.isTrue(await sortedTroves.contains(I))

    // Check coll and debt have not changed
    assert.equal(G_collBefore.eq(await troveManager.Troves(G))[1])
    assert.equal(G_debtBefore.eq(await troveManager.Troves(G))[0])
    assert.equal(H_collBefore.eq(await troveManager.Troves(H))[1])
    assert.equal(H_debtBefore.eq(await troveManager.Troves(H))[0])
    assert.equal(I_collBefore.eq(await troveManager.Troves(I))[1])
    assert.equal(I_debtBefore.eq(await troveManager.Troves(I))[0])

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Whale withdraws entire deposit, and re-deposits 132 LUSD
    // Increasing the price for a moment to avoid pending liquidations to block withdrawal
    await priceFeed.setPrice(dec(200, 18))
    await stabilityPool.withdrawFromSP(dec(1000, 18), {from: whale})
    await priceFeed.setPrice(dec(110, 18))
    await stabilityPool.provideToSP(dec(132, 18), ZERO_ADDRESS, {from: whale})

    // B and E are still in range 110-TCR.
    // Attempt to liquidate B, G, H, I, D.
    // Expected Stability Pool to fully absorb B (92 LUSD + 10 virtual debt), 
    // and absorb ~1/3 of E (30 of 81 LUSD + 10 virtual debt)
    
    const stabilityBefore = await stabilityPool.getTotalLUSDDeposits()
    const dEbtBefore = (await troveManager.Troves(E))[0]

    await troveManager.batchLiquidateTroves([B, G, H, I, E])
    
    const dEbtAfter = (await troveManager.Troves(E))[0]
    const stabilityAfter = await stabilityPool.getTotalLUSDDeposits()
    
    const stabilityDelta = stabilityBefore.sub(stabilityAfter)  
    const dEbtDelta = dEbtBefore.sub(dEbtAfter)

    assert.isTrue(stabilityDelta.eq(stabilityBefore))
    assert.equal((dEbtDelta.toString()), '30000000000000001000')
    
    // Confirm B removed and E active 
    assert.isFalse(await sortedTroves.contains(B)) 
    assert.isTrue(await sortedTroves.contains(E))

    // Check G, H, I remain in system
    assert.isTrue(await sortedTroves.contains(G))
    assert.isTrue(await sortedTroves.contains(H))
    assert.isTrue(await sortedTroves.contains(I))

    // Check coll and debt have not changed
    assert.equal(G_collBefore.eq(await troveManager.Troves(G))[1])
    assert.equal(G_debtBefore.eq(await troveManager.Troves(G))[0])
    assert.equal(H_collBefore.eq(await troveManager.Troves(H))[1])
    assert.equal(H_debtBefore.eq(await troveManager.Troves(H))[0])
    assert.equal(I_collBefore.eq(await troveManager.Troves(I))[1])
    assert.equal(I_debtBefore.eq(await troveManager.Troves(I))[0])
  })

  it('batchLiquidateTroves(): emits liquidation event with zero coll and debt when troves have ICR > 110% and Stability Pool is empty', async () => {
    await borrowerOperations.openTrove(0, dec(80, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(70, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(60, 18), carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, dec(56, 18), dennis, { from: erin, value: dec(1, 'ether') })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    assert.isTrue((await troveManager.getCurrentICR(alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).gte(mv._MCR))

    // Confirm 0 LUSD in Stability Pool
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), '0')

    const trovesToLiquidate = [alice, bob, carol, dennis]

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.batchLiquidateTroves(trovesToLiquidate)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

    assert.equal(liquidatedDebt, '0')
    assert.equal(liquidatedColl, '0')
  })

  it('batchLiquidateTroves(): emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves', async () => {
    // Whale adds 180 LUSD to SP
    await borrowerOperations.openTrove(0, dec(650, 18), whale, { from: whale, value: dec(10, 'ether') })
    await stabilityPool.provideToSP(dec(180, 18), ZERO_ADDRESS, { from: whale })

    // Troves to be absorbed by SP
    await borrowerOperations.openTrove(0, dec(80, 18), freddy, { from: freddy, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(80, 18), greta, { from: greta, value: dec(1, 'ether') })

    // Troves to be spared
    await borrowerOperations.openTrove(0, dec(70, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(65, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(60, 18), carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, dec(65, 18), dennis, { from: dennis, value: dec(1, 'ether') })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Confirm all troves have ICR > MCR
    assert.isTrue((await troveManager.getCurrentICR(freddy, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(greta, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).gte(mv._MCR))

    // Confirm 180 LUSD in Stability Pool
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), dec(180, 18))

    const trovesToLiquidate = [freddy, greta, alice, bob, carol, dennis, whale]

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.batchLiquidateTroves(trovesToLiquidate)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

    // Check F and G were liquidated
    assert.isFalse(await sortedTroves.contains(freddy))
    assert.isFalse(await sortedTroves.contains(greta))

    // Check whale and A-D remain active
    assert.isTrue(await sortedTroves.contains(alice))
    assert.isTrue(await sortedTroves.contains(bob))
    assert.isTrue(await sortedTroves.contains(carol))
    assert.isTrue(await sortedTroves.contains(dennis))
    assert.isTrue(await sortedTroves.contains(whale))

    // Liquidation event emits coll = (F_coll + G_coll)*0.995, and debt = (F_debt + G_debt)
    assert.equal(liquidatedDebt.toString(), dec(180, 18))
    assert.equal(liquidatedColl.toString(), dec(199, 16))
  })

  it('batchLiquidateTroves(): emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves, including. a partial', async () => {
    // Whale opens trove and adds 220 LUSD to SP
    await borrowerOperations.openTrove(0, dec(650, 18), whale, { from: whale, value: dec(10, 'ether') })
    await stabilityPool.provideToSP(dec(220, 18), ZERO_ADDRESS, { from: whale })

    // Troves to be absorbed by SP
    await borrowerOperations.openTrove(0, dec(80, 18), freddy, { from: freddy, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(80, 18), greta, { from: greta, value: dec(1, 'ether') })

    // Trove to be partially liquidated
    await borrowerOperations.openTrove(0, dec(70, 18), alice, { from: alice, value: dec(1, 'ether') })

    // Troves to be spared
    await borrowerOperations.openTrove(0, dec(65, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, dec(60, 18), carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(0, dec(65, 18), dennis, { from: dennis, value: dec(1, 'ether') })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Confirm all troves have ICR > MCR
    assert.isTrue((await troveManager.getCurrentICR(freddy, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(greta, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).gte(mv._MCR))

    // Confirm 220 LUSD in Stability Pool
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), dec(220, 18))

    const trovesToLiquidate = [freddy, greta, alice, bob, carol, dennis, whale]

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.batchLiquidateTroves(trovesToLiquidate)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

    // Check F and G were liquidated
    assert.isFalse(await sortedTroves.contains(freddy))
    assert.isFalse(await sortedTroves.contains(greta))

    // Check whale and A-D remain active
    assert.isTrue(await sortedTroves.contains(alice))
    assert.isTrue(await sortedTroves.contains(bob))
    assert.isTrue(await sortedTroves.contains(carol))
    assert.isTrue(await sortedTroves.contains(dennis))
    assert.isTrue(await sortedTroves.contains(whale))

    // Check A's collateral and debt have reduced by 50%, from partial liquidation
    const entireColl_A = (await troveManager.Troves(alice))[1].add(await troveManager.getPendingETHReward(alice))
    const entireDebt_A = (await troveManager.Troves(alice))[0].add(await troveManager.getPendingLUSDDebtReward(alice))

    assert.equal(entireColl_A, dec(5, 17))
    assert.equal(entireDebt_A, dec(40, 18))

    /* Liquidation event emits:
    coll = (F_coll + G_coll + A_Coll/2)*0.995
    debt = (F_debt + G_debt + A_debt/2) */
    assert.equal(liquidatedDebt.toString(), dec(220, 18))
    assert.equal(liquidatedColl.toString(), dec(24875, 14))
  })

})

contract('Reset chain state', async accounts => { })
