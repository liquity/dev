const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec
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
  let sortedCDPs
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

    priceFeed = contracts.priceFeed
    lusdToken = contracts.lusdToken
    sortedCDPs = contracts.sortedCDPs
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
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(3, 'ether') })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV(dec(390, 18), alice, { from: alice })
    await borrowerOperations.withdrawCLV(dec(390, 18), bob, { from: bob })

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, dec(15, 17))

    const recoveryMode_Before = await troveManager.checkRecoveryMode();
    assert.isFalse(recoveryMode_Before)

    // --- TEST ---

    // price drops to 1ETH:150CLV, reducing TCR below 150%.  setPrice() calls checkTCRAndSetRecoveryMode() internally.
    await priceFeed.setPrice(dec(15, 17))

    // const price = await priceFeed.getPrice()
    // await troveManager.checkTCRAndSetRecoveryMode(price)

    const recoveryMode_After = await troveManager.checkRecoveryMode();
    assert.isTrue(recoveryMode_After)
  })

  it("checkRecoveryMode(): Returns true if TCR stays less than CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })

    // Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('390000000000000000000', bob, { from: bob })

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // price drops to 1ETH:150CLV, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000')

    const recoveryMode_Before = await troveManager.checkRecoveryMode();
    assert.isTrue(recoveryMode_Before)

    await borrowerOperations.addColl(alice, { from: alice, value: '1' })

    const recoveryMode_After = await troveManager.checkRecoveryMode();
    assert.isTrue(recoveryMode_After)
  })

  it("checkRecoveryMode(): returns false if TCR stays above CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })

    await borrowerOperations.withdrawCLV('390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('390000000000000000000', bob, { from: bob })

    // --- TEST ---
    const recoveryMode_Before = await troveManager.checkRecoveryMode();
    assert.isFalse(recoveryMode_Before)

    await borrowerOperations.withdrawColl(_1_Ether, alice, { from: alice })

    const recoveryMode_After = await troveManager.checkRecoveryMode();
    assert.isFalse(recoveryMode_After)
  })

  it("checkRecoveryMode(): returns false if TCR rises above CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('390000000000000000000', bob, { from: bob })

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---
    // price drops to 1ETH:150CLV, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000')

    const recoveryMode_Before = await troveManager.checkRecoveryMode();
    assert.isTrue(recoveryMode_Before)

    await borrowerOperations.addColl(alice, { from: alice, value: _10_Ether })

    const recoveryMode_After = await troveManager.checkRecoveryMode();
    assert.isFalse(recoveryMode_After)
  })

  // --- liquidate() with ICR < 100% ---

  it("liquidate(), with ICR < 100%: removes stake and updates totalStakes", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('390000000000000000000', bob, { from: bob })

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')


    const bob_Stake_Before = (await troveManager.CDPs(bob))[2]
    const totalStakes_Before = await troveManager.totalStakes()

    assert.equal(bob_Stake_Before, _3_Ether)
    assert.equal(totalStakes_Before, _6_Ether)

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check Bob's ICR falls to 75%
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, '750000000000000000')

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    const bob_Stake_After = (await troveManager.CDPs(bob))[2]
    const totalStakes_After = await troveManager.totalStakes()

    assert.equal(bob_Stake_After, 0)
    assert.equal(totalStakes_After, _3_Ether)
  })

  it("liquidate(), with ICR < 100%: updates system snapshots correctly", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _3_Ether })

    //  Alice and Bob withdraw such that their ICRs and the TCR is ~150%
    await borrowerOperations.withdrawCLV('390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('390000000000000000000', bob, { from: bob })
    await borrowerOperations.withdrawCLV('390000000000000000000', dennis, { from: dennis })

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%, and all CDPs below 100% ICR
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

  it("liquidate(), with ICR < 100%: closes the CDP and removes it from the CDP array", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('390000000000000000000', bob, { from: bob })

    const TCR = (await troveManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    const bob_CDPStatus_Before = (await troveManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_Before = await sortedCDPs.contains(bob)

    assert.equal(bob_CDPStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_CDP_isInSortedList_Before)

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check Bob's ICR falls to 75%
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, '750000000000000000')

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    // check Bob's CDP is successfully closed, and removed from sortedList
    const bob_CDPStatus_After = (await troveManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_After = await sortedCDPs.contains(bob)
    assert.equal(bob_CDPStatus_After, 2)  // status enum element 2 corresponds to "Closed"
    assert.isFalse(bob_CDP_isInSortedList_After)
  })

  it("liquidate(), with ICR < 100%: only redistributes to active CDPs - no offset to Stability Pool", async () => {

    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _3_Ether })

    //  Alice and Bob withdraw such that their ICRs and the TCR is 150%
    await borrowerOperations.withdrawCLV('390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('390000000000000000000', bob, { from: bob })
    await borrowerOperations.withdrawCLV('390000000000000000000', dennis, { from: dennis })

    // Alice deposits to SP
    await stabilityPool.provideToSP('390000000000000000000', ZERO_ADDRESS, { from: alice })

    // check rewards-per-unit-staked before
    const P_Before = (await stabilityPool.P()).toString()

    assert.equal(P_Before, '1000000000000000000')


    // const TCR = (await troveManager.getTCR()).toString()
    // assert.equal(TCR, '1500000000000000000')

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%, and all CDPs below 100% ICR
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
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _21_Ether })

    //  Bob withdraws 1990 CLV, bringing his ICR to 210%
    await borrowerOperations.withdrawCLV('1990000000000000000000', bob, { from: bob })

    // Total TCR = 24*200/2010 = 240%
    const TCR = (await troveManager.getTCR()).toString()
    assert.isAtMost(th.getDifference(TCR, '2388059701492537101'), 1000)

    const bob_Stake_Before = (await troveManager.CDPs(bob))[2]
    const totalStakes_Before = await troveManager.totalStakes()

    assert.equal(bob_Stake_Before, _21_Ether)
    assert.equal(totalStakes_Before, _24_Ether)

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR to 120%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check Bob's ICR falls to 105%
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, '1050000000000000000')

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    const bob_Stake_After = (await troveManager.CDPs(bob))[2]
    const totalStakes_After = await troveManager.totalStakes()

    assert.equal(bob_Stake_After, 0)
    assert.equal(totalStakes_After, _3_Ether)
  })

  it("liquidate(), with 100% < ICR < 110%: updates system snapshots correctly", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _21_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _3_Ether })

    //  Alice and Dennis withdraw such that their ICR is ~150%
    await borrowerOperations.withdrawCLV('390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('390000000000000000000', dennis, { from: dennis })

    //  Bob withdraws 1990 CLV, bringing his ICR to 210%
    await borrowerOperations.withdrawCLV('1990000000000000000000', bob, { from: bob })

    const totalStakesSnaphot_1 = (await troveManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_1 = (await troveManager.totalCollateralSnapshot()).toString()
    assert.equal(totalStakesSnaphot_1, 0)
    assert.equal(totalCollateralSnapshot_1, 0)

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%, and all CDPs below 100% ICR
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

  it("liquidate(), with 100% < ICR < 110%: closes the CDP and removes it from the CDP array", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _21_Ether })

    //  Bob withdraws 1990 CLV, bringing his ICR to 210%
    await borrowerOperations.withdrawCLV('1990000000000000000000', bob, { from: bob })

    const bob_CDPStatus_Before = (await troveManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_Before = await sortedCDPs.contains(bob)

    assert.equal(bob_CDPStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_CDP_isInSortedList_Before)

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()


    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check Bob's ICR has fallen to 105%
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, '1050000000000000000')

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    // check Bob's CDP is successfully closed, and removed from sortedList
    const bob_CDPStatus_After = (await troveManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_After = await sortedCDPs.contains(bob)
    assert.equal(bob_CDPStatus_After, 2)  // status enum element 2 corresponds to "Closed"
    assert.isFalse(bob_CDP_isInSortedList_After)
  })

  it("liquidate(), with 100% < ICR < 110%: offsets as much debt as possible with the Stability Pool, then redistributes the remainder coll and debt", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _21_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _3_Ether })

    //  Alice and Dennis withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('390000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('390000000000000000000', dennis, { from: dennis })

    // Alice deposits 390CLV to the Stability Pool
    await stabilityPool.provideToSP('390000000000000000000', ZERO_ADDRESS, { from: alice })

    // Bob withdraws 1990 CLV, bringing his ICR to 210%
    await borrowerOperations.withdrawCLV('1990000000000000000000', bob, { from: bob })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check Bob's ICR has fallen to 105%
    const bob_ICR = await troveManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, '1050000000000000000')

    // check pool CLV before liquidation
    const stabilityPoolCLV_Before = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(stabilityPoolCLV_Before, '390000000000000000000')

    // check Pool reward term before liquidation
    const P_Before = (await stabilityPool.P()).toString()

    assert.equal(P_Before, '1000000000000000000')

    /* Now, liquidate Bob. Liquidated coll is 21 ether, and liquidated debt is 2000 CLV.
    
    With 390 CLV in the StabilityPool, 390 CLV should be offset with the pool, leaving 0 in the pool.
  
    Stability Pool rewards for alice should be:
    CLVLoss: 390CLV
    ETHGain: (390 / 2000) * 21*0.995 = 4.074525 ether

    After offsetting 390 CLV and 4.074525 ether, the remainders - 1610 CLV and 16.820475 ether - should be redistributed to all active CDPs.
   */
    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    const aliceExpectedDeposit = await stabilityPool.getCompoundedCLVDeposit(alice)
    const aliceExpectedETHGain = await stabilityPool.getDepositorETHGain(alice)

    assert.equal(aliceExpectedDeposit.toString(), 0)
    assert.equal(aliceExpectedETHGain.toString(), '4074525000000000000')

    /* Now, check redistribution to active CDPs. Remainders of 1610 CLV and 16.82 ether are distributed.
    
    Now, only Alice and Dennis have a stake in the system - 3 ether each, thus total stakes is 6 ether.
  
    Rewards-per-unit-staked from the redistribution should be:
  
    L_CLVDebt = 1610 / 6 = 268.333 CLV
    L_ETH = 16.820475 /6 =  2.8034125 ether
    */
    const L_CLVDebt = (await troveManager.L_CLVDebt()).toString()
    const L_ETH = (await troveManager.L_ETH()).toString()

    assert.isAtMost(th.getDifference(L_CLVDebt, '268333333333333333333'), 100)
    assert.isAtMost(th.getDifference(L_ETH, '2803412500000000000'), 100)
  })

  // --- liquidate(), applied to loan with ICR > 110% that has the lowest ICR 

  it("liquidate(), with ICR > 110%, loan has lowest ICR, and StabilityPool is empty: does nothing", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _2_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _2_Ether })

    //  Alice and Dennis withdraw 140 CLV, resulting in ICRs of 266%. 
    await borrowerOperations.withdrawCLV('140000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('140000000000000000000', dennis, { from: dennis })
    //Bob withdraws 240 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('240000000000000000000', bob, { from: bob })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
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

    console.log(`TCR: ${await troveManager.getTCR()}`)
    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    // Check that Pool rewards don't change
    const P_Before = (await stabilityPool.P()).toString()

    assert.equal(P_Before, '1000000000000000000')

    // Check that redistribution rewards don't change
    const L_CLVDebt = (await troveManager.L_CLVDebt()).toString()
    const L_ETH = (await troveManager.L_ETH()).toString()

    assert.equal(L_CLVDebt, '0')
    assert.equal(L_ETH, '0')

    // Check that Bob's CDP and stake remains active with unchanged coll and debt
    const bob_CDP = await troveManager.CDPs(bob);
    const bob_Debt = bob_CDP[0].toString()
    const bob_Coll = bob_CDP[1].toString()
    const bob_Stake = bob_CDP[2].toString()
    const bob_CDPStatus = bob_CDP[3].toString()
    const bob_isInSortedCDPsList = await sortedCDPs.contains(bob)

    assert.equal(bob_Debt, '250000000000000000000')
    assert.equal(bob_Coll, '3000000000000000000')
    assert.equal(bob_Stake, '3000000000000000000')
    assert.equal(bob_CDPStatus, '1')
    assert.isTrue(bob_isInSortedCDPsList)
  })

  // --- liquidate(), applied to loan with ICR > 110% that has the lowest ICR, and Stability Pool CLV is GREATER THAN liquidated debt ---

  it("liquidate(), with 110% < ICR < TCR, and StabilityPool CLV > debt to liquidate: offsets the loan entirely with the pool", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 CLV, and Dennis 140 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('240000000000000000000', bob, { from: bob })

    // Alice deposits all 1490 CLV in the Stability Pool
    await stabilityPool.provideToSP('1490000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
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

    /* Check accrued Stability Pool rewards after. Total Pool deposits was 1490 CLV, Alice sole depositor.
    As liquidated debt (250 CLV) was completely offset

    Alice's expected compounded deposit: (1490 - 250) = 1240CLV
    Alice's expected ETH gain:  Bob's liquidated coll, 3*0.995 ether
  
    */
    const aliceExpectedDeposit = await stabilityPool.getCompoundedCLVDeposit(alice)
    const aliceExpectedETHGain = await stabilityPool.getDepositorETHGain(alice)

    assert.isAtMost(th.getDifference(aliceExpectedDeposit.toString(), '1240000000000000000000'), 2000)
    assert.isAtMost(th.getDifference(aliceExpectedETHGain, dec(2985, 15)), 1000)
  })

  it("liquidate(), with  110% < ICR < TCR, and StabilityPool CLV > debt to liquidate: removes stake and updates totalStakes", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 CLV, and Dennis 150 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('240000000000000000000', bob, { from: bob })

    // Alice deposits all 1490 CLV in the Stability Pool
    await stabilityPool.provideToSP('1490000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check stake and totalStakes before
    const bob_Stake_Before = (await troveManager.CDPs(bob))[2]
    const totalStakes_Before = await troveManager.totalStakes()

    assert.equal(bob_Stake_Before, _3_Ether)
    assert.equal(totalStakes_Before, _25_Ether)

    // Check Bob's ICR is between 110 and 150
    const bob_ICR = await troveManager.getCurrentICR(bob, price)
    assert.isTrue(bob_ICR.gt(mv._MCR) && bob_ICR.lt(await troveManager.getTCR()))

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    // check stake and totalStakes after
    const bob_Stake_After = (await troveManager.CDPs(bob))[2]
    const totalStakes_After = await troveManager.totalStakes()

    assert.equal(bob_Stake_After, 0)
    assert.equal(totalStakes_After, _22_Ether)
  })

  it("liquidate(), with  110% < ICR < TCR, and StabilityPool CLV > debt to liquidate: updates system snapshots", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 CLV, and Dennis 140 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('240000000000000000000', bob, { from: bob })

    // Alice deposits all 1490 CLV in the Stability Pool
    await stabilityPool.provideToSP('1490000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
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

  it("liquidate(), with 110% < ICR < TCR, and StabilityPool CLV > debt to liquidate: closes the CDP", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 CLV, and Dennis 140 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('240000000000000000000', bob, { from: bob })

    // Alice deposits all 1490 CLV in the Stability Pool
    await stabilityPool.provideToSP('1490000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Check Bob's CDP is active
    const bob_CDPStatus_Before = (await troveManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_Before = await sortedCDPs.contains(bob)

    assert.equal(bob_CDPStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_CDP_isInSortedList_Before)

    // Check Bob's ICR is between 110 and TCR
    const bob_ICR = await troveManager.getCurrentICR(bob, price)
    assert.isTrue(bob_ICR.gt(mv._MCR) && bob_ICR.lt(await troveManager.getTCR()))

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    // Check Bob's CDP is closed after liquidation
    const bob_CDPStatus_After = (await troveManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_After = await sortedCDPs.contains(bob)

    assert.equal(bob_CDPStatus_After, 2) // status enum element 2 corresponds to "Closed"
    assert.isFalse(bob_CDP_isInSortedList_After)
  })

  it("liquidate(), with 110% < ICR < TCR, and StabilityPool CLV > debt to liquidate: can liquidate troves out of order", async () => {

    // taking out 1000 LUSD against 10x200 = $2000 worth of ETH collateral, gives us an CR of 200%
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(10, 'ether') })
    await stabilityPool.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan('90000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('89000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('88000000000000000000', carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })

    await borrowerOperations.openLoan('87000000000000000000', erin, { from: erin, value: dec(2, 'ether') }) 
    await borrowerOperations.openLoan('86000000000000000000', freddy, { from: freddy, value: dec(2, 'ether') })

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
    assert.isFalse(await sortedCDPs.contains(dennis))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))

    // Confirm troves have status 'closed' (Status enum element idx 2)
    assert.equal((await troveManager.CDPs(dennis))[3], '2')
    assert.equal((await troveManager.CDPs(dennis))[3], '2')
    assert.equal((await troveManager.CDPs(dennis))[3], '2')
  })


  /* --- liquidate() applied to loan with ICR > 110% that has the lowest ICR, and Stability Pool 
  CLV is LESS THAN the liquidated debt: a partial liquidation --- */

  it("liquidate(), with ICR > 110%, and StabilityPool CLV < liquidated debt: CDP remains active", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 CLV, and Dennis 140 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('240000000000000000000', bob, { from: bob })

    // Alice deposits 100 CLV in the Stability Pool
    await stabilityPool.provideToSP('100000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Check Bob's CDP is active
    const bob_CDPStatus_Before = (await troveManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_Before = await sortedCDPs.contains(bob)

    assert.equal(bob_CDPStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_CDP_isInSortedList_Before)

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })
    
    /* Since the pool only contains 100 CLV, and Bob's pre-liquidation debt was 250 CLV, 
    expect Bob's loan to only be partially offset, and remain active after liquidation */

    const bob_CDPStatus_After = (await troveManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_After = await sortedCDPs.contains(bob)

    assert.equal(bob_CDPStatus_After, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_CDP_isInSortedList_After)
  })

  it("liquidate(), with ICR > 110%, and StabilityPool CLV < liquidated debt: CDP remains in CDPOwners array", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 CLV, and Dennis 140 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('240000000000000000000', bob, { from: bob })

    // Alice deposits 100 CLV in the Stability Pool
    await stabilityPool.provideToSP('100000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Check Bob's CDP is active
    const bob_CDPStatus_Before = (await troveManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_Before = await sortedCDPs.contains(bob)

    assert.equal(bob_CDPStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_CDP_isInSortedList_Before)

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    /* Since the pool only contains 100 CLV, and Bob's pre-liquidation debt was 250 CLV, 
    expect Bob's loan to only be partially offset, and remain active after liquidation */

    // Check Bob is in CDP owners array
    const arrayLength = (await troveManager.getCDPOwnersCount()).toNumber()
    let addressFound = false;
    let addressIdx = 0;

    for (let i = 0; i < arrayLength; i++) {
      const address = (await troveManager.CDPOwners(i)).toString()
      if (address == bob) {
        addressFound = true
        addressIdx = i
      }
    }

    assert.isTrue(addressFound);

    // Check CDPOwners idx on trove struct == idx of address found in CDPOwners array
    const idxOnStruct = (await troveManager.CDPs(bob))[4].toString()
    assert.equal(addressIdx.toString(), idxOnStruct)
  })

  it("liquidate(), with ICR > 110%, and StabilityPool CLV < liquidated debt: updates loan coll, debt and stake, and system totalStakes", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 CLV, and Dennis 140 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('240000000000000000000', bob, { from: bob })

    // Alice deposits 100 CLV in the Stability Pool
    await stabilityPool.provideToSP('100000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Liquidate Bob
    await troveManager.liquidate(bob, { from: owner })

    /*  Since Bob's debt (250 CLV) is larger than all CLV in the Stability Pool, Liquidation should offset 
    a portion Bob's debt and coll with the Stability Pool, and leave remainders of debt and coll in his CDP. Specifically:

    Offset debt: 100 CLV
    Offset coll: (100 / 250) * 3  = 1.2 ether

    Remainder debt: 150 CLV
    Remainder coll: (3 - 1.2) = 1.8 ether 

    After liquidation, totalStakes snapshot should equal Alice's stake (20 ether) + Dennis stake (2 ether) = 22 ether.

    Since there has been no redistribution, the totalCollateral snapshot should equal the totalStakes snapshot: 22 ether.
    
    Then, Bob's new reduced coll and stake should each be 1.8 ether, and the updated totalStakes should equal 23.8 ether.
    */
    const bob_CDP = await troveManager.CDPs(bob)
    const bob_DebtAfter = bob_CDP[0].toString()
    const bob_CollAfter = bob_CDP[1].toString()
    const bob_StakeAfter = bob_CDP[2].toString()

    assert.equal(bob_DebtAfter, '150000000000000000000')
    assert.equal(bob_CollAfter, '1800000000000000000')
    assert.equal(bob_StakeAfter, '1800000000000000000')

    const totalStakes_After = (await troveManager.totalStakes()).toString()
    assert.equal(totalStakes_After, '23800000000000000000')
  })

  it("liquidate(), with ICR > 110%, and StabilityPool CLV < liquidated debt: updates system shapshots", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 CLV, and Dennis 140 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('240000000000000000000', bob, { from: bob })

    // Alice deposits 100 CLV in the Stability Pool
    await stabilityPool.provideToSP('100000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
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

  it("liquidate(), with ICR > 110%, and StabilityPool CLV < liquidated debt: causes correct Pool offset and ETH gain, and doesn't redistribute to active troves", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 CLV, and Dennis 140 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('140000000000000000000', dennis, { from: dennis })
    // Bob withdraws 240 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('240000000000000000000', bob, { from: bob })

    // Alice deposits 100 CLV in the Stability Pool
    await stabilityPool.provideToSP('100000000000000000000', ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')

    const recoveryMode = await troveManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Liquidate Bob. 100 CLV should be offset
    await troveManager.liquidate(bob, { from: owner })

    /* check Stability Pool rewards.  After Bob's liquidation:
    - amount of CLV offset with Stability Pool should be 100 CLV
    - corresponding amount of ETH added to Stability Pool should be 100/250 * 3 * 0.995 = 1.194 ether.

    - Alice's deposit (100 CLV) should fully cancel with the debt, leaving her a withdrawable deposit of 0
  
    Her ETH gain from offset should be (3 * 100/250)*0.995 = 1.194 Ether.
    */

    const aliceExpectedDeposit = await stabilityPool.getCompoundedCLVDeposit(alice)
    const aliceExpectedETHGain = await stabilityPool.getDepositorETHGain(alice)

    assert.equal(aliceExpectedDeposit.toString(), '0')

    assert.isAtMost(th.getDifference(aliceExpectedETHGain, '1194000000000000000'), 100)

    /* For this Recovery Mode test case with ICR > 110%, there should be no redistribution of remainder to active CDPs. 
    Redistribution rewards-per-unit-staked should be zero. */

    const L_CLVDebt_After = (await troveManager.L_CLVDebt()).toString()
    const L_ETH_After = (await troveManager.L_ETH()).toString()

    assert.equal(L_CLVDebt_After, '0')
    assert.equal(L_ETH_After, '0')
  })

  it("liquidate(), with ICR > 110%, and StabilityPool CLV < liquidated debt: ICR of partially liquidated trove does not change", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: _3_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1490 CLV, and Dennis 140 CLV, -> ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1490000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('140000000000000000000', dennis, { from: dennis })

    // Bob withdraws 240 CLV, -> ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('240000000000000000000', bob, { from: bob })
    // Carol withdraws 230 CLV, -> ICR of 250%.
    await borrowerOperations.withdrawCLV('230000000000000000000', carol, { from: carol })

    // Alice deposits 100 CLV in the Stability Pool
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const bob_ICR_Before = (await troveManager.getCurrentICR(bob, price)).toString()
    const carol_ICR_Before = (await troveManager.getCurrentICR(carol, price)).toString()

    assert.isTrue(await troveManager.checkRecoveryMode())

    const bob_Coll_Before = (await troveManager.CDPs(bob))[1]
    const bob_Debt_Before = (await troveManager.CDPs(bob))[0]

    // confirm Bob is last trove in list, and has >110% ICR
    assert.equal((await sortedCDPs.getLast()).toString(), bob)
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gt(mv._MCR))

    // L1: Liquidate Bob. 100 CLV should be offset
    await troveManager.liquidate(bob, { from: owner })

    //Check SP CLV has been completely emptied
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), '0')

    // Check Bob remains active
    assert.isTrue(await sortedCDPs.contains(bob))

    // Check Bob's collateral and debt has reduced from the partial liquidation
    const bob_Coll_After = (await troveManager.CDPs(bob))[1]
    const bob_Debt_After = (await troveManager.CDPs(bob))[0]
    assert.isTrue(bob_Coll_After.lt(bob_Coll_Before))
    assert.isTrue(bob_Debt_After.lt(bob_Debt_Before))

    const bob_ICR_After = (await troveManager.getCurrentICR(bob, price)).toString()

    // check Bob's ICR has not changed from the partial liquidation
    assert.equal(bob_ICR_After, bob_ICR_Before)


    // Remove Bob from system to test Carol's trove: price rises, Bob closes loan, price drops to 100 again
    await priceFeed.setPrice(dec(200, 18))
    await borrowerOperations.closeLoan({ from: bob })
    await priceFeed.setPrice(dec(100, 18))
    assert.isFalse(await sortedCDPs.contains(bob))

    // Alice provides another 50 CLV to pool
    await stabilityPool.provideToSP(dec(50, 18), ZERO_ADDRESS, { from: alice })

    assert.isTrue(await troveManager.checkRecoveryMode())

    const carol_Coll_Before = (await troveManager.CDPs(carol))[1]
    const carol_Debt_Before = (await troveManager.CDPs(carol))[0]

    // Confirm Carol is last trove in list, and has >110% ICR
    assert.equal((await sortedCDPs.getLast()), carol)
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).gt(mv._MCR))

    // L2: Liquidate Carol. 50 CLV should be offset
    await troveManager.liquidate(carol)

    //Check SP CLV has been completely emptied
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), '0')

    // Check Carol's collateral and debt has reduced from the partial liquidation
    const carol_Coll_After = (await troveManager.CDPs(carol))[1]
    const carol_Debt_After = (await troveManager.CDPs(carol))[0]
    assert.isTrue(carol_Coll_After.lt(carol_Coll_Before))
    assert.isTrue(carol_Debt_After.lt(carol_Debt_Before))

    const carol_ICR_After = (await troveManager.getCurrentICR(carol, price)).toString()

    // check Carol's ICR has not changed from the partial liquidation
    assert.equal(carol_ICR_After, carol_ICR_Before)

    //Confirm liquidations have not led to any redistributions to troves
    const L_CLVDebt_After = (await troveManager.L_CLVDebt()).toString()
    const L_ETH_After = (await troveManager.L_ETH()).toString()

    assert.equal(L_CLVDebt_After, '0')
    assert.equal(L_ETH_After, '0')
  })

  it("liquidate() with ICR > 110%, and StabilityPool CLV < liquidated debt: total liquidated coll and debt is correct", async () => {
    // Whale provides 50 CLV to the SP
    await borrowerOperations.openLoan(dec(50, 18), whale, { from: whale, value: dec(1, 'ether') })
    await stabilityPool.provideToSP(dec(50, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan('90000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('89000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('88000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan('87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

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

    // Expect system debt reduced by 250 CLV and system coll 2.5 ETH
    const entireSystemCollAfter = await troveManager.getEntireSystemColl()
    const entireSystemDebtAfter = await troveManager.getEntireSystemDebt()

    const changeInEntireSystemColl = entireSystemCollBefore.sub(entireSystemCollAfter)
    const changeInEntireSystemDebt = entireSystemDebtBefore.sub(entireSystemDebtAfter)

    assert.equal(changeInEntireSystemColl, '500000000000000000')
    assert.equal(changeInEntireSystemDebt, dec(50, 18))
  })

  // --- 

  it("liquidate(): Doesn't liquidate undercollateralized trove if it is the only trove in the system", async () => {
    // Alice creates a single trove with 0.5 ETH and a debt of 50 LQTY, and provides 10 CLV to SP
    await borrowerOperations.openLoan(dec(40, 18), alice, { from: alice, value: dec(500, 'finney') })
    await stabilityPool.provideToSP(dec(10, 18), ZERO_ADDRESS, { from: alice })

    assert.isFalse(await troveManager.checkRecoveryMode())

    // Set ETH:USD price to 105
    await priceFeed.setPrice('105000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isTrue(await troveManager.checkRecoveryMode())

    const alice_ICR = (await troveManager.getCurrentICR(alice, price)).toString()
    assert.equal(alice_ICR, '1050000000000000000')

    const activeTrovesCount_Before = await troveManager.getCDPOwnersCount()

    assert.equal(activeTrovesCount_Before, 1)

    // Liquidate the trove
    await troveManager.liquidate(alice, { from: owner })

    // Check Alice's trove has not been removed
    const activeTrovesCount_After = await troveManager.getCDPOwnersCount()
    assert.equal(activeTrovesCount_After, 1)

    const alice_isInSortedList = await sortedCDPs.contains(alice)
    assert.isTrue(alice_isInSortedList)
  })

  it("liquidate(): Liquidates undercollateralized trove if there are two troves in the system", async () => {
    await borrowerOperations.openLoan(dec(40, 18), bob, { from: bob, value: dec(500, 'finney') })

    // Alice creates a single trove with 0.5 ETH and a debt of 50 LQTY,  and provides 10 CLV to SP
    await borrowerOperations.openLoan(dec(40, 18), alice, { from: alice, value: dec(500, 'finney') })
    await stabilityPool.provideToSP(dec(10, 18), ZERO_ADDRESS, { from: alice })

    // Alice proves 10 CLV to SP
    await stabilityPool.provideToSP(dec(10, 18), ZERO_ADDRESS, { from: alice })

    assert.isFalse(await troveManager.checkRecoveryMode())

    // Set ETH:USD price to 105
    await priceFeed.setPrice('105000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isTrue(await troveManager.checkRecoveryMode())

    const alice_ICR = (await troveManager.getCurrentICR(alice, price)).toString()
    assert.equal(alice_ICR, '1050000000000000000')

    const activeTrovesCount_Before = await troveManager.getCDPOwnersCount()

    assert.equal(activeTrovesCount_Before, 2)

    // Liquidate the trove
    await troveManager.liquidate(alice, { from: owner })

    // Check Alice's trove is removed, and bob remains
    const activeTrovesCount_After = await troveManager.getCDPOwnersCount()
    assert.equal(activeTrovesCount_After, 1)

    const alice_isInSortedList = await sortedCDPs.contains(alice)
    assert.isFalse(alice_isInSortedList)

    const bob_isInSortedList = await sortedCDPs.contains(bob)
    assert.isTrue(bob_isInSortedList)
  })

  it("liquidate(): does nothing if trove has >= 110% ICR and the Stability Pool is empty", async () => {
    await borrowerOperations.openLoan(dec(90, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(80, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(140, 18), carol, { from: carol, value: dec(2, 'ether') })

    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const TCR_Before = (await troveManager.getTCR()).toString()
    const listSize_Before = (await sortedCDPs.getSize()).toString()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check Bob's ICR > 110%
    const bob_ICR = await troveManager.getCurrentICR(bob, price)
    assert.isTrue(bob_ICR.gte(mv._MCR))

    // Confirm SP is empty
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, '0')

    // Attempt to liquidate bob
    await troveManager.liquidate(bob)

    // check A, B, C remain active
    assert.isTrue((await sortedCDPs.contains(bob)))
    assert.isTrue((await sortedCDPs.contains(alice)))
    assert.isTrue((await sortedCDPs.contains(carol)))

    const TCR_After = (await troveManager.getTCR()).toString()
    const listSize_After = (await sortedCDPs.getSize()).toString()

    // Check TCR and list size have not changed
    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
  })

  it("liquidate(): reverts if trove is non-existent", async () => {
    await borrowerOperations.openLoan(dec(90, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(140, 18), bob, { from: bob, value: dec(1, 'ether') })

    await priceFeed.setPrice(dec(100, 18))

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check Carol does not have an existing trove
    assert.equal(await troveManager.getCDPStatus(carol), 0)
    assert.isFalse(await sortedCDPs.contains(carol))

    try {
      const txCarol = await troveManager.liquidate(carol)

      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }
  })

  it("liquidate(): reverts if trove has been closed", async () => {
    await borrowerOperations.openLoan(dec(90, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(140, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(140, 18), carol, { from: carol, value: dec(1, 'ether') })

    assert.isTrue(await sortedCDPs.contains(carol))

    // Price drops, Carol ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Carol liquidated, and her trove is closed
    const txCarol_L1 = await troveManager.liquidate(carol)
    assert.isTrue(txCarol_L1.receipt.status)

    // Check Carol's trove is closed
    assert.isFalse(await sortedCDPs.contains(carol))
    assert.equal(await troveManager.getCDPStatus(carol), 2)

    try {
      const txCarol_L2 = await troveManager.liquidate(carol)

      assert.isFalse(txCarol_L2.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }
  })

  it("liquidate(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await borrowerOperations.openLoan(dec(40, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('80500000000000000000', bob, { from: bob, value: dec(1, 'ether') })  // 90.5 CLV, 1 ETH
    await borrowerOperations.openLoan(dec(90, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Defaulter opens with 30 CLV, 0.3 ETH
    await borrowerOperations.openLoan(dec(20, 18), defaulter_1, { from: defaulter_1, value: dec(300, 'finney') })

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

    // Liquidate defaulter. 30 CLV and 0.3 ETH is distributed uniformly between A, B and C. Each receive 10 CLV, 0.1 ETH
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
    const bob_Coll = (await troveManager.CDPs(bob))[1]
    const bob_Debt = (await troveManager.CDPs(bob))[0]

    const bob_rawICR = bob_Coll.mul(th.toBN(dec(100, 18))).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    //liquidate A, B, C
    await troveManager.liquidate(alice)
    await troveManager.liquidate(bob)
    await troveManager.liquidate(carol)

    /*  Since there is 0 CLV in the stability Pool, A, with ICR >110%, should stay active.
    Check Alice stays active, Carol gets liquidated, and Bob gets liquidated 
    (because his pending rewards bring his ICR < MCR) */
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))

    // check trove statuses - A active (1), B and C closed (2)
    assert.equal((await troveManager.CDPs(alice))[3].toString(), '1')
    assert.equal((await troveManager.CDPs(bob))[3].toString(), '2')
    assert.equal((await troveManager.CDPs(carol))[3].toString(), '2')
  })

  it("liquidate(): does not affect the SP deposit or ETH gain when called on an SP depositor's address that has no trove", async () => {
    await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(90, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Bob sends tokens to Dennis, who has no trove
    await lusdToken.transfer(dennis, dec(200, 18), { from: bob })

    //Dennis provides 200 CLV to SP
    await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: dennis })

    // Price drop
    await priceFeed.setPrice(dec(105, 18))

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Carol gets liquidated
    await troveManager.liquidate(carol)

    // Check Dennis' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const dennis_Deposit_Before = (await stabilityPool.getCompoundedCLVDeposit(dennis)).toString()
    const dennis_ETHGain_Before = (await stabilityPool.getDepositorETHGain(dennis)).toString()
    assert.isAtMost(th.getDifference(dennis_Deposit_Before, dec(100, 18)), 1000)
    assert.isAtMost(th.getDifference(dennis_ETHGain_Before, dec(995, 15)), 1000)

    // Attempt to liquidate Dennis
    try {
      const txDennis = await troveManager.liquidate(dennis)
      assert.isFalse(txDennis.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }

    // Check Dennis' SP deposit does not change after liquidation attempt
    const dennis_Deposit_After = (await stabilityPool.getCompoundedCLVDeposit(dennis)).toString()
    const dennis_ETHGain_After = (await stabilityPool.getDepositorETHGain(dennis)).toString()
    assert.equal(dennis_Deposit_Before, dennis_Deposit_After)
    assert.equal(dennis_ETHGain_Before, dennis_ETHGain_After)
  })

  it("liquidate(): does not alter the liquidated user's token balance", async () => {
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(10, 'ether') })

    await borrowerOperations.openLoan(dec(300, 18), alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    await priceFeed.setPrice(dec(105, 18))

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check token balances 
    assert.equal((await lusdToken.balanceOf(alice)).toString(), dec(300, 18))
    assert.equal((await lusdToken.balanceOf(bob)).toString(), dec(200, 18))
    assert.equal((await lusdToken.balanceOf(carol)).toString(), dec(100, 18))

    // Check sortedList size is 4
    assert.equal((await sortedCDPs.getSize()).toString(), '4')

    // Liquidate A, B and C
    await troveManager.liquidate(alice)
    await troveManager.liquidate(bob)
    await troveManager.liquidate(carol)

    // Confirm A, B, C closed
    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))

    // Check sortedList size reduced to 1
    assert.equal((await sortedCDPs.getSize()).toString(), '1')

    // Confirm token balances have not changed
    assert.equal((await lusdToken.balanceOf(alice)).toString(), dec(300, 18))
    assert.equal((await lusdToken.balanceOf(bob)).toString(), dec(200, 18))
    assert.equal((await lusdToken.balanceOf(carol)).toString(), dec(100, 18))
  })

  // --- liquidateCDPs ---


  it("liquidateCDPs(): With all ICRs > 110%, Liquidates CDPs until system leaves recovery mode", async () => {
    // make 8 CDPs accordingly
    // --- SETUP ---

    await borrowerOperations.openLoan(0, alice, { from: alice, value: _25_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3pt5_Ether })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: _3_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _3_Ether })
    await borrowerOperations.openLoan(0, erin, { from: erin, value: _3_Ether })
    await borrowerOperations.openLoan(0, freddy, { from: freddy, value: _3_Ether })
    await borrowerOperations.openLoan(0, greta, { from: greta, value: _1_Ether })
    await borrowerOperations.openLoan(0, harry, { from: harry, value: _1_Ether })

    // Everyone withdraws some CLV from their CDP, resulting in different ICRs
    await borrowerOperations.withdrawCLV('1390000000000000000000', alice, { from: alice })  // 1400 CLV -> ICR = 400%
    await borrowerOperations.withdrawCLV('190000000000000000000', bob, { from: bob }) //  200 CLV -> ICR = 350%
    await borrowerOperations.withdrawCLV('200000000000000000000', carol, { from: carol }) // 210 CLV -> ICR = 286%
    await borrowerOperations.withdrawCLV('210000000000000000000', dennis, { from: dennis }) // 220 CLV -> ICR = 273%
    await borrowerOperations.withdrawCLV('220000000000000000000', erin, { from: erin }) // 230 CLV -> ICR = 261%
    await borrowerOperations.withdrawCLV('230000000000000000000', freddy, { from: freddy }) // 240 CLV -> ICR = 250%
    await borrowerOperations.withdrawCLV('75000000000000000000', greta, { from: greta }) // 85 CLV -> ICR = 235%
    await borrowerOperations.withdrawCLV('80000000000000000000', harry, { from: harry }) // 90 CLV ->  ICR = 222%

    // Alice deposits 1390 CLV to Stability Pool
    await stabilityPool.provideToSP('1390000000000000000000', ZERO_ADDRESS, { from: alice })

    // price drops
    // price drops to 1ETH:90CLV, reducing TCR below 150%
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

    CDP         ICR
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
    // All other CDPs should have ICR < TCR
    assert.isTrue(carol_ICR.lt(TCR))
    assert.isTrue(dennis_ICR.lt(TCR))
    assert.isTrue(erin_ICR.lt(TCR))
    assert.isTrue(freddy_ICR.lt(TCR))
    assert.isTrue(greta_ICR.lt(TCR))
    assert.isTrue(harry_ICR.lt(TCR))

    /* Liquidations should occur from the lowest ICR CDP upwards, i.e. 
    1) Harry, 2) Greta, 3) Freddy, etc.

      CDP         ICR
    Alice       161%
    Bob         158%
    Carol       129%
    Dennis      123%
    ---- CUTOFF ----
    Elisa       117%
    Freddy      113%
    Greta       106%
    Harry       100%

    If all CDPs below the cutoff are liquidated, the TCR of the system rises above the CCR, to 152%.  (see calculations in Google Sheet)

    Thus, after liquidateCDPs(), expect all CDPs to be liquidated up to the cut-off.  
    
    Only Alice, Bob, Carol and Dennis should remain active - all others should be closed. */

    // call liquidate CDPs
    await troveManager.liquidateCDPs(10);

    // check system is no longer in Recovery Mode
    const recoveryMode_After = await troveManager.checkRecoveryMode()
    assert.isFalse(recoveryMode_After)

    // After liquidation, TCR should rise to above 150%. 
    const TCR_After = await troveManager.getTCR()
    assert.isTrue(TCR_After.gt(_150percent))

    // get all CDPs
    const alice_CDP = await troveManager.CDPs(alice)
    const bob_CDP = await troveManager.CDPs(bob)
    const carol_CDP = await troveManager.CDPs(carol)
    const dennis_CDP = await troveManager.CDPs(dennis)
    const erin_CDP = await troveManager.CDPs(erin)
    const freddy_CDP = await troveManager.CDPs(freddy)
    const greta_CDP = await troveManager.CDPs(greta)
    const harry_CDP = await troveManager.CDPs(harry)

    // check that Alice, Bob, Carol, & Dennis' CDPs remain active
    assert.equal(alice_CDP[3], 1)
    assert.equal(bob_CDP[3], 1)
    assert.equal(carol_CDP[3], 1)
    assert.equal(dennis_CDP[3], 1)
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isTrue(await sortedCDPs.contains(bob))
    assert.isTrue(await sortedCDPs.contains(carol))
    assert.isTrue(await sortedCDPs.contains(dennis))

    // check all other CDPs are closed
    assert.equal(erin_CDP[3], 2)
    assert.equal(freddy_CDP[3], 2)
    assert.equal(greta_CDP[3], 2)
    assert.equal(harry_CDP[3], 2)
    assert.isFalse(await sortedCDPs.contains(erin))
    assert.isFalse(await sortedCDPs.contains(freddy))
    assert.isFalse(await sortedCDPs.contains(greta))
    assert.isFalse(await sortedCDPs.contains(harry))
  })

  it("liquidateCDPs(): Liquidates CDPs until 1) system has left recovery mode AND 2) it reaches a CDP with ICR >= 110%", async () => {
    // make 6 CDPs accordingly
    // --- SETUP ---

    await borrowerOperations.openLoan(0, alice, { from: alice, value: _30_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: _3_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _3_Ether })
    await borrowerOperations.openLoan(0, erin, { from: erin, value: _3_Ether })
    await borrowerOperations.openLoan(0, freddy, { from: freddy, value: _3_Ether })

    // Alice withdraws 1400 CLV, the others each withdraw 240 CLV 
    await borrowerOperations.withdrawCLV('1400000000000000000000', alice, { from: alice })  // 1410 CLV -> ICR = 426%
    await borrowerOperations.withdrawCLV('240000000000000000000', bob, { from: bob }) //  250 CLV -> ICR = 240%
    await borrowerOperations.withdrawCLV('240000000000000000000', carol, { from: carol }) // 250 CLV -> ICR = 240%
    await borrowerOperations.withdrawCLV('240000000000000000000', dennis, { from: dennis }) // 250 CLV -> ICR = 240%
    await borrowerOperations.withdrawCLV('240000000000000000000', erin, { from: erin }) // 250 CLV -> ICR = 240%
    await borrowerOperations.withdrawCLV('240000000000000000000', freddy, { from: freddy }) // 250 CLV -> ICR = 240%

    // Alice deposits 1400 CLV to Stability Pool
    await stabilityPool.provideToSP('1400000000000000000000', ZERO_ADDRESS, { from: alice })

    // price drops to 1ETH:85CLV, reducing TCR below 150%
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

    CDP         ICR
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
    // All other CDPs should have ICR < 150%
    assert.isTrue(carol_ICR.lt(_150percent))
    assert.isTrue(dennis_ICR.lt(_150percent))
    assert.isTrue(erin_ICR.lt(_150percent))
    assert.isTrue(freddy_ICR.lt(_150percent))

    /* Liquidations should occur from the lowest ICR CDP upwards, i.e. 
    1) Freddy, 2) Elisa, 3) Dennis.

    After liquidating Freddy and Elisa, the the TCR of the system rises above the CCR, to 154%.  
   (see calculations in Google Sheet)

    Liquidations continue until all CDPs with ICR < MCR have been closed. 
    Only Alice should remain active - all others should be closed. */

    // call liquidate CDPs
    await troveManager.liquidateCDPs(6);

    // check system is no longer in Recovery Mode
    const recoveryMode_After = await troveManager.checkRecoveryMode()
    assert.isFalse(recoveryMode_After)

    // After liquidation, TCR should rise to above 150%. 
    const TCR_After = await troveManager.getTCR()
    assert.isTrue(TCR_After.gt(_150percent))

    // get all CDPs
    const alice_CDP = await troveManager.CDPs(alice)
    const bob_CDP = await troveManager.CDPs(bob)
    const carol_CDP = await troveManager.CDPs(carol)
    const dennis_CDP = await troveManager.CDPs(dennis)
    const erin_CDP = await troveManager.CDPs(erin)
    const freddy_CDP = await troveManager.CDPs(freddy)

    // check that Alice's CDP remains active
    assert.equal(alice_CDP[3], 1)
    assert.isTrue(await sortedCDPs.contains(alice))

    // check all other CDPs are closed
    assert.equal(bob_CDP[3], 2)
    assert.equal(carol_CDP[3], 2)
    assert.equal(dennis_CDP[3], 2)
    assert.equal(erin_CDP[3], 2)
    assert.equal(freddy_CDP[3], 2)

    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))
    assert.isFalse(await sortedCDPs.contains(dennis))
    assert.isFalse(await sortedCDPs.contains(erin))
    assert.isFalse(await sortedCDPs.contains(freddy))
  })

  it('liquidateCDPs(): liquidates only up to the requested number of undercollateralized troves', async () => {
    await borrowerOperations.openLoan('20000000000000000000000', whale, { from: whale, value: dec(300, 'ether') })

    // --- SETUP --- 
    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await borrowerOperations.openLoan('95000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('94000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('93000000000000000000', carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('92000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('91000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    await priceFeed.setPrice(dec(100, 18))

    const TCR = await troveManager.getTCR()

    assert.isTrue(TCR.lte(web3.utils.toBN(dec(150, 18))))
    assert.isTrue(await troveManager.checkRecoveryMode())

    // --- TEST --- 

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidateCDPs(3)

    // Check system still in Recovery Mode after liquidation tx
    assert.isTrue(await troveManager.checkRecoveryMode())

    const CDPOwnersArrayLength = await troveManager.getCDPOwnersCount()
    assert.equal(CDPOwnersArrayLength, '3')

    // Check Alice, Bob, Carol troves have been closed
    const aliceCDPStatus = (await troveManager.getCDPStatus(alice)).toString()
    const bobCDPStatus = (await troveManager.getCDPStatus(bob)).toString()
    const carolCDPStatus = (await troveManager.getCDPStatus(carol)).toString()

    assert.equal(aliceCDPStatus, '2')
    assert.equal(bobCDPStatus, '2')
    assert.equal(carolCDPStatus, '2')

    //  Check Alice, Bob, and Carol's trove are no longer in the sorted list
    const alice_isInSortedList = await sortedCDPs.contains(alice)
    const bob_isInSortedList = await sortedCDPs.contains(bob)
    const carol_isInSortedList = await sortedCDPs.contains(carol)

    assert.isFalse(alice_isInSortedList)
    assert.isFalse(bob_isInSortedList)
    assert.isFalse(carol_isInSortedList)

    // Check Dennis, Erin still have active troves
    const dennisCDPStatus = (await troveManager.getCDPStatus(dennis)).toString()
    const erinCDPStatus = (await troveManager.getCDPStatus(erin)).toString()

    assert.equal(dennisCDPStatus, '1')
    assert.equal(erinCDPStatus, '1')

    // Check Dennis, Erin still in sorted list
    const dennis_isInSortedList = await sortedCDPs.contains(dennis)
    const erin_isInSortedList = await sortedCDPs.contains(erin)

    assert.isTrue(dennis_isInSortedList)
    assert.isTrue(erin_isInSortedList)
  })

  it("liquidateCDPs(): does nothing if n = 0", async () => {
    await borrowerOperations.openLoan(dec(90, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(190, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(290, 18), carol, { from: carol, value: dec(3, 'ether') })

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
    await troveManager.liquidateCDPs(0)

    // Check all troves are still in the system
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isTrue(await sortedCDPs.contains(bob))
    assert.isTrue(await sortedCDPs.contains(carol))

    const TCR_After = (await troveManager.getTCR()).toString()

    // Check TCR has not changed after liquidation
    assert.equal(TCR_Before, TCR_After)
  })

  it('liquidateCDPs(): closes every CDP with ICR < MCR, when n > number of undercollateralized troves', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(dec(500, 18), whale, { from: whale, value: dec(10, 'ether') })

    // create 5 CDPs with varying ICRs
    await borrowerOperations.openLoan(dec(190, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(140, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(290, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), erin, { from: erin, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(170, 18), freddy, { from: freddy, value: dec(1, 'ether') })

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100CLV, reducing Bob and Carol's ICR below MCR
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
    await troveManager.liquidateCDPs(5);

    // Confirm troves A-E have been removed from the system
    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))
    assert.isFalse(await sortedCDPs.contains(erin))
    assert.isFalse(await sortedCDPs.contains(freddy))

    // Check all troves are now closed
    assert.equal((await troveManager.CDPs(alice))[3].toString(), '2')
    assert.equal((await troveManager.CDPs(bob))[3].toString(), '2')
    assert.equal((await troveManager.CDPs(carol))[3].toString(), '2')
    assert.equal((await troveManager.CDPs(erin))[3].toString(), '2')
    assert.equal((await troveManager.CDPs(freddy))[3].toString(), '2')
  })

  it("liquidateCDPs(): a liquidation sequence containing Pool offsets increases the TCR", async () => {
    // Whale provides 500 CLV to SP
    await borrowerOperations.openLoan(dec(500, 18), whale, { from: whale, value: dec(5, 'ether') })
    await stabilityPool.provideToSP(dec(500, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(3, 'ether') })

    await borrowerOperations.openLoan('91000000000000000000', defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('207000000000000000000', defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
    await borrowerOperations.openLoan('318000000000000000000', defaulter_3, { from: defaulter_3, value: dec(3, 'ether') })
    await borrowerOperations.openLoan('421000000000000000000', defaulter_4, { from: defaulter_4, value: dec(4, 'ether') })

    assert.isTrue((await sortedCDPs.contains(defaulter_1)))
    assert.isTrue((await sortedCDPs.contains(defaulter_2)))
    assert.isTrue((await sortedCDPs.contains(defaulter_3)))
    assert.isTrue((await sortedCDPs.contains(defaulter_4)))


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

    // Check Stability Pool has 500 CLV
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), dec(500, 18))

    await troveManager.liquidateCDPs(8)

    // assert.isFalse((await sortedCDPs.contains(defaulter_1)))
    // assert.isFalse((await sortedCDPs.contains(defaulter_2)))
    // assert.isFalse((await sortedCDPs.contains(defaulter_3)))
    assert.isFalse((await sortedCDPs.contains(defaulter_4)))

    // Check Stability Pool has been emptied by the liquidations
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), '0')

    // Check that the liquidation sequence has improved the TCR
    const TCR_After = await troveManager.getTCR()
    assert.isTrue(TCR_After.gte(TCR_Before))
  })

  it("liquidateCDPs(): A liquidation sequence of pure redistributions decreases the TCR, due to gas compensation, but up to 0.5%", async () => {
    await borrowerOperations.openLoan(dec(400, 18), whale, { from: whale, value: dec(5, 'ether') })
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(3, 'ether') })

    await borrowerOperations.openLoan('91000000000000000000', defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('247000000000000000000', defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
    await borrowerOperations.openLoan('318000000000000000000', defaulter_3, { from: defaulter_3, value: dec(3, 'ether') })
    await borrowerOperations.openLoan('470000000000000000000', defaulter_4, { from: defaulter_4, value: dec(4, 'ether') })

    assert.isTrue((await sortedCDPs.contains(defaulter_1)))
    assert.isTrue((await sortedCDPs.contains(defaulter_2)))
    assert.isTrue((await sortedCDPs.contains(defaulter_3)))
    assert.isTrue((await sortedCDPs.contains(defaulter_4)))

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    const TCR_Before = await troveManager.getTCR()
    // (5+1+2+3+1+2+3+4)*100/(410+10+10+10+101+257+328+480)
    assert.isAtMost(th.getDifference(TCR_Before, '1307596513075965027'), 1000)

    // Check pool is empty before liquidation
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), '0')

    // Liquidate
    await troveManager.liquidateCDPs(8)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedCDPs.contains(defaulter_1)))
    assert.isFalse((await sortedCDPs.contains(defaulter_2)))
    assert.isFalse((await sortedCDPs.contains(defaulter_3)))
    assert.isFalse((await sortedCDPs.contains(defaulter_4)))

    // Check that the liquidation sequence has reduced the TCR
    const TCR_After = await troveManager.getTCR()
    // ((5+1+2+3)+(1+2+3+4)*0.995)*100/(410+10+10+10+101+257+328+480)
    assert.isAtMost(th.getDifference(TCR_After, '1304483188044831987'), 1000)
    assert.isTrue(TCR_Before.gte(TCR_After))
    assert.isTrue(TCR_After.gte(TCR_Before.mul(th.toBN(995)).div(th.toBN(1000))))
  })

  it("liquidateCDPs(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await borrowerOperations.openLoan(dec(40, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('80500000000000000000', bob, { from: bob, value: dec(1, 'ether') })  // 90.5 CLV, 1 ETH
    await borrowerOperations.openLoan(dec(90, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Defaulter opens with 30 CLV, 0.3 ETH
    await borrowerOperations.openLoan(dec(20, 18), defaulter_1, { from: defaulter_1, value: dec(300, 'finney') })

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

    // Liquidate defaulter. 30 CLV and 0.3 ETH is distributed uniformly between A, B and C. Each receive 10 CLV, 0.1 ETH
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
    const bob_Coll = (await troveManager.CDPs(bob))[1]
    const bob_Debt = (await troveManager.CDPs(bob))[0]

    const bob_rawICR = bob_Coll.mul(th.toBN(dec(100, 18))).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    // Liquidate A, B, C
    await troveManager.liquidateCDPs(10)

    /*  Since there is 0 CLV in the stability Pool, A, with ICR >110%, should stay active.
   Check Alice stays active, Carol gets liquidated, and Bob gets liquidated 
   (because his pending rewards bring his ICR < MCR) */
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))

    // check trove statuses - A active (1),  B and C closed (2)
    assert.equal((await troveManager.CDPs(alice))[3].toString(), '1')
    assert.equal((await troveManager.CDPs(bob))[3].toString(), '2')
    assert.equal((await troveManager.CDPs(carol))[3].toString(), '2')
  })

  it('liquidateCDPs(): does nothing if all troves have ICR > 110% and Stability Pool is empty', async () => {
    await borrowerOperations.openLoan(dec(80, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(70, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(60, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    assert.isTrue((await sortedCDPs.contains(alice)))
    assert.isTrue((await sortedCDPs.contains(bob)))
    assert.isTrue((await sortedCDPs.contains(carol)))

    const TCR_Before = (await troveManager.getTCR()).toString()
    const listSize_Before = (await sortedCDPs.getSize()).toString()


    assert.isTrue((await troveManager.getCurrentICR(alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).gte(mv._MCR))

    // Confirm 0 CLV in Stability Pool
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), '0')

    // Attempt liqudation sequence
    await troveManager.liquidateCDPs(10)

    // Check all troves remain active
    assert.isTrue((await sortedCDPs.contains(alice)))
    assert.isTrue((await sortedCDPs.contains(bob)))
    assert.isTrue((await sortedCDPs.contains(carol)))

    const TCR_After = (await troveManager.getTCR()).toString()
    const listSize_After = (await sortedCDPs.getSize()).toString()

    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
  })

  it('liquidateCDPs(): emits liquidation event with zero coll and debt when all troves have ICR > 110% and Stability Pool is empty', async () => {
    await borrowerOperations.openLoan(dec(80, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(70, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(60, 18), carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan(dec(56, 18), dennis, { from: erin, value: dec(1, 'ether') })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    assert.isTrue((await troveManager.getCurrentICR(alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).gte(mv._MCR))

    // Confirm 0 CLV in Stability Pool
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), '0')

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.liquidateCDPs(10)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

    assert.equal(liquidatedDebt, '0')
    assert.equal(liquidatedColl, '0')
  })

  it('liquidateCDPs(): emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves', async () => {
    // Whale adds 180 CLV to SP
    await borrowerOperations.openLoan(dec(650, 18), whale, { from: whale, value: dec(10, 'ether') })
    await stabilityPool.provideToSP(dec(180, 18), ZERO_ADDRESS, { from: whale })

    // Troves to be absorbed by SP
    await borrowerOperations.openLoan(dec(80, 18), freddy, { from: freddy, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(80, 18), greta, { from: greta, value: dec(1, 'ether') })

    // Troves to be spared
    await borrowerOperations.openLoan(dec(70, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(65, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(60, 18), carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan(dec(55, 18), dennis, { from: dennis, value: dec(1, 'ether') })

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

    // Confirm 180 CLV in Stability Pool
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), dec(180, 18))

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.liquidateCDPs(10)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

    // Check F and G were liquidated
    assert.isFalse(await sortedCDPs.contains(freddy))
    assert.isFalse(await sortedCDPs.contains(greta))

    // Check whale and A-D remain active
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isTrue(await sortedCDPs.contains(bob))
    assert.isTrue(await sortedCDPs.contains(carol))
    assert.isTrue(await sortedCDPs.contains(dennis))
    assert.isTrue(await sortedCDPs.contains(whale))

    // Liquidation event emits coll = (F_coll + G_coll)*0.995, and debt = (F_debt + G_debt)
    assert.equal(liquidatedDebt.toString(), dec(180, 18))
    assert.equal(liquidatedColl.toString(), dec(1990, 15))
  })

  it('liquidateCDPs():  emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves, including a partial', async () => {
    // Whale opens trove and adds 220 CLV to SP
    await borrowerOperations.openLoan(dec(650, 18), whale, { from: whale, value: dec(10, 'ether') })
    await stabilityPool.provideToSP(dec(220, 18), ZERO_ADDRESS, { from: whale })

    // Troves to be absorbed by SP
    await borrowerOperations.openLoan(dec(80, 18), freddy, { from: freddy, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(80, 18), greta, { from: greta, value: dec(1, 'ether') })

    // Trove to be partially liquidated
    await borrowerOperations.openLoan(dec(70, 18), alice, { from: alice, value: dec(1, 'ether') })

    // Troves to be spared
    await borrowerOperations.openLoan(dec(65, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(60, 18), carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan(dec(55, 18), dennis, { from: dennis, value: dec(1, 'ether') })

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

    // Confirm 220 CLV in Stability Pool
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), dec(220, 18))

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.liquidateCDPs(10)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

    // Check F and G were liquidated
    assert.isFalse(await sortedCDPs.contains(freddy))
    assert.isFalse(await sortedCDPs.contains(greta))

    // Check whale and A-D remain active
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isTrue(await sortedCDPs.contains(bob))
    assert.isTrue(await sortedCDPs.contains(carol))
    assert.isTrue(await sortedCDPs.contains(dennis))
    assert.isTrue(await sortedCDPs.contains(whale))

    // Check A's collateral and debt have reduced by 50%, from partial liquidation
    const entireColl_A = (await troveManager.CDPs(alice))[1].add(await troveManager.getPendingETHReward(alice))
    const entireDebt_A = (await troveManager.CDPs(alice))[0].add(await troveManager.getPendingCLVDebtReward(alice))

    assert.equal(entireColl_A, dec(5, 17))
    assert.equal(entireDebt_A, dec(40, 18))

    /* Liquidation event emits:
    coll = (F_coll + G_coll + A_Coll/2)*0.995
    debt = (F_debt + G_debt + A_debt/2) */
    assert.equal(liquidatedDebt.toString(), dec(220, 18))
    assert.equal(liquidatedColl.toString(), dec(24875, 14))
  })

  it("liquidateCDPs(): does not affect the liquidated user's token balances", async () => {
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(15, 'ether') })

    // D, E, F open loans that will fall below MCR when price drops to 100
    await borrowerOperations.openLoan(dec(90, 18), dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(140, 18), erin, { from: erin, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(170, 18), freddy, { from: freddy, value: dec(1, 'ether') })

    // Check list size is 4
    assert.equal((await sortedCDPs.getSize()).toString(), '4')

    // Check token balances before
    assert.equal((await lusdToken.balanceOf(dennis)).toString(), dec(90, 18))
    assert.equal((await lusdToken.balanceOf(erin)).toString(), dec(140, 18))
    assert.equal((await lusdToken.balanceOf(freddy)).toString(), dec(170, 18))

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    //Liquidate sequence
    await troveManager.liquidateCDPs(10)

    // Check Whale remains in the system
    assert.isTrue(await sortedCDPs.contains(whale))

    // Check D, E, F have been removed
    assert.isFalse(await sortedCDPs.contains(dennis))
    assert.isFalse(await sortedCDPs.contains(erin))
    assert.isFalse(await sortedCDPs.contains(freddy))

    // Check token balances of users whose troves were liquidated, have not changed
    assert.equal((await lusdToken.balanceOf(dennis)).toString(), dec(90, 18))
    assert.equal((await lusdToken.balanceOf(erin)).toString(), dec(140, 18))
    assert.equal((await lusdToken.balanceOf(freddy)).toString(), dec(170, 18))
  })

  it("liquidateCDPs(): Liquidating troves at 100 < ICR < 110 with SP deposits correctly impacts their SP deposit and ETH gain", async () => {
    // Whale provides 400 CLV to the SP
    await borrowerOperations.openLoan(dec(400, 18), whale, { from: whale, value: dec(6, 'ether') })
    await stabilityPool.provideToSP(dec(400, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan(dec(90, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(290, 18), bob, { from: bob, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(90, 18), carol, { from: carol, value: dec(1, 'ether') })

    // A, B provide 90, 290 to the SP
    await stabilityPool.provideToSP(dec(90, 18), ZERO_ADDRESS, { from: alice })
    await stabilityPool.provideToSP(dec(290, 18), ZERO_ADDRESS, { from: bob })

    assert.equal((await sortedCDPs.getSize()).toString(), '4')

    // Price drops
    await priceFeed.setPrice(dec(105, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check 780 CLV in Pool
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), dec(780, 18))

    // *** Check A, B, C ICRs 100<ICR<110
    const alice_ICR = await troveManager.getCurrentICR(alice, price)
    const bob_ICR = await troveManager.getCurrentICR(bob, price)
    const carol_ICR = await troveManager.getCurrentICR(carol, price)

    assert.isTrue(alice_ICR.gte(mv._ICR100) && alice_ICR.lte(mv._MCR))
    assert.isTrue(bob_ICR.gte(mv._ICR100) && bob_ICR.lte(mv._MCR))
    assert.isTrue(carol_ICR.gte(mv._ICR100) && carol_ICR.lte(mv._MCR))

    // Liquidate
    await troveManager.liquidateCDPs(10)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedCDPs.contains(alice)))
    assert.isFalse((await sortedCDPs.contains(bob)))
    assert.isFalse((await sortedCDPs.contains(carol)))

    // check system sized reduced to 1 troves
    assert.equal((await sortedCDPs.getSize()).toString(), '1')

    /* Prior to liquidation, SP deposits were:
    Whale: 400 CLV
    Alice:  90 CLV
    Bob:   290 CLV
    Carol: 0 CLV

    Total CLV in Pool: 780 CLV

    Then, liquidation hits A,B,C: 

    Total liquidated debt = 100 + 300 + 100 = 500 CLV
    Total liquidated ETH = 1 + 3 + 1 = 5 ETH

    Whale CLV Loss: 500 * (400/780) = 256.41 CLV
    Alice CLV Loss:  500 *(90/780) = 57.69 CLV
    Bob CLV Loss: 500 * (290/780) = 185.90 CLV

    Whale remaining deposit: (400 - 256.41) = 143.59 CLV
    Alice remaining deposit: (90 - 57.69) = 32.31 CLV
    Bob remaining deposit: (290 - 185.90) = 104.10 CLV

    Whale ETH Gain: 5*0.995 * (400/780) = 2.55 ETH
    Alice ETH Gain: 5*0.995 *(90/780) = 0.574 ETH
    Bob ETH Gain: 5*0.995 * (290/780) = 1.850 ETH

    Total remaining deposits: 280 CLV
    Total ETH gain: 5 ETH */

    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    const ETHinSP = (await stabilityPool.getETH()).toString()

    // Check remaining CLV Deposits and ETH gain, for whale and depositors whose troves were liquidated
    const whale_Deposit_After = (await stabilityPool.getCompoundedCLVDeposit(whale)).toString()
    const alice_Deposit_After = (await stabilityPool.getCompoundedCLVDeposit(alice)).toString()
    const bob_Deposit_After = (await stabilityPool.getCompoundedCLVDeposit(bob)).toString()

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
    const total_CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    const total_ETHinSP = (await stabilityPool.getETH()).toString()

    assert.isAtMost(th.getDifference(total_CLVinSP, dec(280, 18)), 1000)
    assert.isAtMost(th.getDifference(total_ETHinSP, dec(4975, 15)), 1000)
  })

  it("liquidateCDPs(): Liquidating troves at ICR <=100% with SP deposits does not alter their deposit or ETH gain", async () => {
    // Whale provides 400 CLV to the SP
    await borrowerOperations.openLoan(dec(400, 18), whale, { from: whale, value: dec(6, 'ether') })
    await stabilityPool.provideToSP(dec(400, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan(dec(170, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(300, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(140, 18), carol, { from: carol, value: dec(1, 'ether') })

    // A, B provide 100, 300 to the SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: alice })
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: bob })

    assert.equal((await sortedCDPs.getSize()).toString(), '4')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Check CLV and ETH in Pool  before
    const CLVinSP_Before = (await stabilityPool.getTotalCLVDeposits()).toString()
    const ETHinSP_Before = (await stabilityPool.getETH()).toString()
    assert.equal(CLVinSP_Before, dec(800, 18))
    assert.equal(ETHinSP_Before, '0')

    // *** Check A, B, C ICRs < 100
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).lte(mv._ICR100))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).lte(mv._ICR100))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).lte(mv._ICR100))

    // Liquidate
    await troveManager.liquidateCDPs(10)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedCDPs.contains(alice)))
    assert.isFalse((await sortedCDPs.contains(bob)))
    assert.isFalse((await sortedCDPs.contains(carol)))

    // check system sized reduced to 1 troves
    assert.equal((await sortedCDPs.getSize()).toString(), '1')

    // Check CLV and ETH in Pool after
    const CLVinSP_After = (await stabilityPool.getTotalCLVDeposits()).toString()
    const ETHinSP_After = (await stabilityPool.getETH()).toString()
    assert.equal(CLVinSP_Before, CLVinSP_After)
    assert.equal(ETHinSP_Before, ETHinSP_After)

    // Check remaining CLV Deposits and ETH gain, for whale and depositors whose troves were liquidated
    const whale_Deposit_After = (await stabilityPool.getCompoundedCLVDeposit(whale)).toString()
    const alice_Deposit_After = (await stabilityPool.getCompoundedCLVDeposit(alice)).toString()
    const bob_Deposit_After = (await stabilityPool.getCompoundedCLVDeposit(bob)).toString()

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

  it("liquidateCDPs() with a partial liquidation: partially liquidated trove remains active", async () => {
    // Whale provides 253 CLV to the SP
    await borrowerOperations.openLoan('253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan('92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan('87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

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
    That leaves 50 CLV in the Pool to absorb exactly half of Carol's debt (100) */
    await troveManager.liquidateCDPs(10)

    // Check A and B closed
    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))

    // Check C remains active
    assert.isTrue(await sortedCDPs.contains(carol))
    assert.equal((await troveManager.CDPs(carol))[3].toString(), '1') // check Status is active
  })

  it("liquidateCDPs() with a partial liquidation: partially liquidated trove remains in CDPOwners Array", async () => {
    // Whale provides 253 CLV to the SP
    await borrowerOperations.openLoan('253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan('92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan('87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

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
    That leaves 50 CLV in the Pool to absorb exactly half of Carol's debt (100) */
    await troveManager.liquidateCDPs(10)

    // Check C is in CDP owners array
    const arrayLength = (await troveManager.getCDPOwnersCount()).toNumber()
    let addressFound = false;
    let addressIdx = 0;

    for (let i = 0; i < arrayLength; i++) {
      const address = (await troveManager.CDPOwners(i)).toString()
      if (address == carol) {
        addressFound = true
        addressIdx = i
      }
    }

    assert.isTrue(addressFound);

    // Check CDPOwners idx on trove struct == idx of address found in CDPOwners array
    const idxOnStruct = (await troveManager.CDPs(carol))[4].toString()
    assert.equal(addressIdx.toString(), idxOnStruct)
  })

  it("liquidateCDPs() with a partial liquidation: does not liquidate further troves after the partial", async () => {
    // Whale provides 250 CLV to the SP
    await borrowerOperations.openLoan('253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan('92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan('87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

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
    That leaves 50 CLV in the Pool to absorb exactly half of Carol's debt (100) */
    await troveManager.liquidateCDPs(10)

    // Check A and B closed
    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))

    // Check whale, C, D and E stay active
    assert.isTrue(await sortedCDPs.contains(whale))
    assert.isTrue(await sortedCDPs.contains(carol))
    assert.isTrue(await sortedCDPs.contains(dennis))
    assert.isTrue(await sortedCDPs.contains(erin))
  })

  it("liquidateCDPs() with a partial liquidation: total liquidated coll and debt is correct", async () => {
    // Whale provides 253 CLV to the SP
    await borrowerOperations.openLoan('253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan('92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan('87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

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
    That leaves 50 CLV in the Pool to absorb exactly half of Carol's debt (100) */
    const tx = await troveManager.liquidateCDPs(10)

    // Expect system debt reduced by 250 CLV and system coll 2.5 ETH
    const entireSystemCollAfter = await troveManager.getEntireSystemColl()
    const entireSystemDebtAfter = await troveManager.getEntireSystemDebt()

    const changeInEntireSystemColl = entireSystemCollBefore.sub(entireSystemCollAfter)
    const changeInEntireSystemDebt = entireSystemDebtBefore.sub(entireSystemDebtAfter)

    assert.equal(changeInEntireSystemColl, '2500000000000000000')
    assert.equal(changeInEntireSystemDebt, '253000000000000000000')
  })

  it("liquidateCDPs() with a partial liquidation: emits correct liquidation event values", async () => {
    // Whale provides 253 CLV to the SP
    await borrowerOperations.openLoan('253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan('92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan('87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

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
    That leaves 50 CLV in the Pool to absorb exactly half of Carol's debt (100) */
    const liquidationTx = await troveManager.liquidateCDPs(10)

    const [liquidatedDebt, liquidatedColl, collGasComp, clvGasComp] = th.getEmittedLiquidationValues(liquidationTx)

    assert.equal(liquidatedDebt.toString(), '253000000000000000000')
    assert.equal(liquidatedColl.toString(), '2487500000000000000') // 2.5*0.995
    assert.equal(collGasComp.toString(), dec(125, 14)) // 0.5% of 2.5
    assert.equal(clvGasComp.toString(), dec(20, 18)) // partially liquidated trove doesn’t count here
  })

  it("liquidateCDPs() with a partial liquidation: ICR of partially liquidated trove does not change", async () => {
    // Whale provides 253 CLV to the SP
    await borrowerOperations.openLoan('253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan('92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan('87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

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
    That leaves 50 CLV in the Pool to absorb exactly half of Carol's debt (100) */
    await troveManager.liquidateCDPs(10)

    const ICR_C_After = await troveManager.getCurrentICR(carol, price)
    assert.equal(ICR_C_Before.toString(), ICR_C_After)
  })

  // --- batchLiquidateTroves() ---

  it("batchLiquidateTroves(): Liquidates all troves with ICR < 110%, transitioning Normal -> Recovery Mode", async () => {
    // make 6 CDPs accordingly
    // --- SETUP ---

    await borrowerOperations.openLoan(0, alice, { from: alice, value: _30_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: _3_Ether })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: _3_Ether })
    await borrowerOperations.openLoan(0, erin, { from: erin, value: _3_Ether })
    await borrowerOperations.openLoan(0, freddy, { from: freddy, value: _3_Ether })

    // Alice withdraws 1400 CLV, the others each withdraw 240 CLV 
    await borrowerOperations.withdrawCLV('1400000000000000000000', alice, { from: alice })  // 1410 CLV -> ICR = 426%
    await borrowerOperations.withdrawCLV('240000000000000000000', bob, { from: bob }) //  250 CLV -> ICR = 240%
    await borrowerOperations.withdrawCLV('240000000000000000000', carol, { from: carol }) // 250 CLV -> ICR = 240%
    await borrowerOperations.withdrawCLV('240000000000000000000', dennis, { from: dennis }) // 250 CLV -> ICR = 240%
    await borrowerOperations.withdrawCLV('240000000000000000000', erin, { from: erin }) // 250 CLV -> ICR = 240%
    await borrowerOperations.withdrawCLV('240000000000000000000', freddy, { from: freddy }) // 250 CLV -> ICR = 240%

    // Alice deposits 1400 CLV to Stability Pool
    await stabilityPool.provideToSP('1400000000000000000000', ZERO_ADDRESS, { from: alice })

    // price drops to 1ETH:85CLV, reducing TCR below 150%
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

    CDP         ICR
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
    // All other CDPs should have ICR < 150%
    assert.isTrue(carol_ICR.lt(_150percent))
    assert.isTrue(dennis_ICR.lt(_150percent))
    assert.isTrue(erin_ICR.lt(_150percent))
    assert.isTrue(freddy_ICR.lt(_150percent))

    /* Liquidations should occur from the lowest ICR CDP upwards, i.e. 
    1) Freddy, 2) Elisa, 3) Dennis.

    After liquidating Freddy and Elisa, the the TCR of the system rises above the CCR, to 154%.  
   (see calculations in Google Sheet)

    Liquidations continue until all CDPs with ICR < MCR have been closed. 
    Only Alice should remain active - all others should be closed. */

    // call batchLiquidateTroves
    await troveManager.batchLiquidateTroves([alice, bob, carol, dennis, erin, freddy]);

    // check system is no longer in Recovery Mode
    const recoveryMode_After = await troveManager.checkRecoveryMode()
    assert.isFalse(recoveryMode_After)

    // After liquidation, TCR should rise to above 150%. 
    const TCR_After = await troveManager.getTCR()
    assert.isTrue(TCR_After.gt(_150percent))

    // get all CDPs
    const alice_CDP = await troveManager.CDPs(alice)
    const bob_CDP = await troveManager.CDPs(bob)
    const carol_CDP = await troveManager.CDPs(carol)
    const dennis_CDP = await troveManager.CDPs(dennis)
    const erin_CDP = await troveManager.CDPs(erin)
    const freddy_CDP = await troveManager.CDPs(freddy)

    // check that Alice's CDP remains active
    assert.equal(alice_CDP[3], 1)
    assert.isTrue(await sortedCDPs.contains(alice))

    // check all other CDPs are closed
    assert.equal(bob_CDP[3], 2)
    assert.equal(carol_CDP[3], 2)
    assert.equal(dennis_CDP[3], 2)
    assert.equal(erin_CDP[3], 2)
    assert.equal(freddy_CDP[3], 2)

    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))
    assert.isFalse(await sortedCDPs.contains(dennis))
    assert.isFalse(await sortedCDPs.contains(erin))
    assert.isFalse(await sortedCDPs.contains(freddy))
  })

  it("batchLiquidateTroves() with a partial liquidation: partially liquidated trove remains active", async () => {
    // Whale provides 253 CLV to the SP
    await borrowerOperations.openLoan('253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan('92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan('87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

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
    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))

    // Check C remains active
    assert.isTrue(await sortedCDPs.contains(carol))
    assert.equal((await troveManager.CDPs(carol))[3].toString(), '1') // check Status is active
  })

  it("batchLiquidateTroves() with a partial liquidation: partially liquidated trove remains in CDP Owners array", async () => {
    // Whale provides 253 CLV to the SP
    await borrowerOperations.openLoan('253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan('92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan('87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

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

    // Check C is in CDP owners array
    const arrayLength = (await troveManager.getCDPOwnersCount()).toNumber()
    let addressFound = false;
    let addressIdx = 0;

    for (let i = 0; i < arrayLength; i++) {
      const address = (await troveManager.CDPOwners(i)).toString()
      if (address == carol) {
        addressFound = true
        addressIdx = i
      }
    }

    assert.isTrue(addressFound);

    // Check CDPOwners idx on trove struct == idx of address found in CDPOwners array
    const idxOnStruct = (await troveManager.CDPs(carol))[4].toString()
    assert.equal(addressIdx.toString(), idxOnStruct)
  })

  it("batchLiquidateTroves() with a partial liquidation: does not liquidate further troves after the partial", async () => {
    // Whale provides 250 CLV to the SP
    await borrowerOperations.openLoan('253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan('92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan('87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

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
    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))

    // Check whale, C, D and E stay active
    assert.isTrue(await sortedCDPs.contains(whale))
    assert.isTrue(await sortedCDPs.contains(carol))
    assert.isTrue(await sortedCDPs.contains(dennis))
    assert.isTrue(await sortedCDPs.contains(erin))
  })

  it("batchLiquidateTroves() with a partial liquidation: total liquidated coll and debt is correct", async () => {
    // Whale provides 253 CLV to the SP
    await borrowerOperations.openLoan('253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan('92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan('87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

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

    // Expect system debt reduced by 250 CLV and system coll 2.5 ETH
    const entireSystemCollAfter = await troveManager.getEntireSystemColl()
    const entireSystemDebtAfter = await troveManager.getEntireSystemDebt()

    const changeInEntireSystemColl = entireSystemCollBefore.sub(entireSystemCollAfter)
    const changeInEntireSystemDebt = entireSystemDebtBefore.sub(entireSystemDebtAfter)

    assert.equal(changeInEntireSystemColl, '2500000000000000000')
    assert.equal(changeInEntireSystemDebt, '253000000000000000000')
  })

  it("batchLiquidateTroves() with a partial liquidation: emits correct liquidation event values", async () => {
    // Whale provides 253 CLV to the SP
    await borrowerOperations.openLoan('253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan('92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan('87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

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

    const [liquidatedDebt, liquidatedColl, collGasComp, clvGasComp] = th.getEmittedLiquidationValues(liquidationTx)

    assert.equal(liquidatedDebt.toString(), '253000000000000000000')
    assert.equal(liquidatedColl.toString(), '2487500000000000000') // 2.5*0.995
    assert.equal(collGasComp.toString(), dec(125, 14)) // 0.5% of 2.5
    assert.equal(clvGasComp.toString(), dec(20, 18)) // partially liquidated trove doesn’t count here
  })

  it("batchLiquidateTroves() with a partial liquidation: ICR of partially liquidated trove does not change", async () => {
    // Whale provides 253 CLV to the SP
    await borrowerOperations.openLoan('253000000000000000000', whale, { from: whale, value: dec(3, 'ether') })
    await stabilityPool.provideToSP('253000000000000000000', ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan('92000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('91000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('90000000000000000000', carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan('87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('86000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

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

  it("batchLiquidateTroves(), with 110% < ICR < TCR, and StabilityPool CLV > debt to liquidate: can liquidate troves out of order", async () => {
    // Whale provides 1000 CLV to the SP
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(10, 'ether') })
    await stabilityPool.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan(
      '90000000000000000000', alice, 
      { 
        from: alice, 
        value: dec(1, 'ether') 
      }
    )
    await borrowerOperations.openLoan('89000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('88000000000000000000', carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('87000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })

    await borrowerOperations.openLoan('87000000000000000000', erin, { from: erin, value: dec(2, 'ether') })
    await borrowerOperations.openLoan('86000000000000000000', freddy, { from: freddy, value: dec(2, 'ether') })

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
    assert.isFalse(await sortedCDPs.contains(dennis))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))

    // Confirm troves have status 'closed' (Status enum element idx 2)
    assert.equal((await troveManager.CDPs(dennis))[3], '2')
    assert.equal((await troveManager.CDPs(dennis))[3], '2')
    assert.equal((await troveManager.CDPs(dennis))[3], '2')
  })

  it("batchLiquidateTroves(), with 110% < ICR < TCR, and StabilityPool empty: doesn't liquidate any troves", async () => {
    await borrowerOperations.openLoan('90000000000000000000', alice, { from: alice, value: dec(1, 'ether') })

    const bobDebt_Before = '89000000000000000000'
    const carolDebt_Before = '88000000000000000000'
    const dennisDebt_Before = '87000000000000000000'

    await borrowerOperations.openLoan(bobDebt_Before, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(carolDebt_Before, carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dennisDebt_Before, dennis, { from: dennis, value: dec(1, 'ether') })

    const bobColl_Before = (await troveManager.CDPs(bob))[1]
    const carolColl_Before = (await troveManager.CDPs(carol))[1]
    const dennisColl_Before = (await troveManager.CDPs(dennis))[1]

    await borrowerOperations.openLoan('87000000000000000000', erin, { from: erin, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('86000000000000000000', freddy, { from: freddy, value: dec(1, 'ether') })

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
    assert.isTrue(await sortedCDPs.contains(dennis))
    assert.isTrue(await sortedCDPs.contains(bob))
    assert.isTrue(await sortedCDPs.contains(carol))

    // Confirm troves have status 'active' (Status enum element idx 1)
    assert.equal((await troveManager.CDPs(dennis))[3], '1')
    assert.equal((await troveManager.CDPs(dennis))[3], '1')
    assert.equal((await troveManager.CDPs(dennis))[3], '1')

    // Confirm D, B, C coll & debt have not changed
    const dennisDebt_After = (await troveManager.CDPs(dennis))[0].add(await troveManager.getPendingCLVDebtReward(dennis))
    const bobDebt_After = (await troveManager.CDPs(bob))[0].add(await troveManager.getPendingCLVDebtReward(bob))
    const carolDebt_After = (await troveManager.CDPs(carol))[0].add(await troveManager.getPendingCLVDebtReward(carol))

    const dennisColl_After = (await troveManager.CDPs(dennis))[1].add(await troveManager.getPendingETHReward(dennis))  
    const bobColl_After = (await troveManager.CDPs(bob))[1].add(await troveManager.getPendingETHReward(bob))
    const carolColl_After = (await troveManager.CDPs(carol))[1].add(await troveManager.getPendingETHReward(carol))

    assert.isTrue(dennisColl_After.eq(dennisColl_Before))
    assert.isTrue(bobColl_After.eq(bobColl_Before))
    assert.isTrue(carolColl_After.eq(carolColl_Before))

    assert.equal(th.toBN(dennisDebt_Before).add(th.toBN(dec(10, 18))).toString(), dennisDebt_After.toString())
    assert.equal(th.toBN(bobDebt_Before).add(th.toBN(dec(10, 18))).toString(), bobDebt_After.toString())
    assert.equal(th.toBN(carolDebt_Before).add(th.toBN(dec(10, 18))).toString(), carolDebt_After.toString())
  })

  it('batchLiquidateTroves(): skips liquidation of troves with ICR > TCR, regardless of Stability Pool size', async () => {
    // Whale adds 1000 CLV to SP
    await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(10, 'ether') })
    await stabilityPool.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: whale })

    // Troves that will fall into ICR range 100-MCR
    await borrowerOperations.openLoan(dec(93, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(92, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(91, 18), C, { from: C, value: dec(1, 'ether') })

    // Troves that will fall into ICR range 110-TCR
    await borrowerOperations.openLoan(dec(82, 18), D, { from: D, value: dec(1, 'ether') }) 
    await borrowerOperations.openLoan(dec(81, 18), E, { from: E, value: dec(1, 'ether') }) 
    await borrowerOperations.openLoan(dec(80, 18), F, { from: F, value: dec(1, 'ether') }) 

    // Troves that will fall into ICR range >= TCR
    await borrowerOperations.openLoan(dec(40, 18), G, { from: G, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(30, 18), H, { from: H, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(20, 18), I, { from: I, value: dec(1, 'ether') })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(110, 18)) 
    const price = await priceFeed.getPrice()
    const TCR = await troveManager.getTCR()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    const G_collBefore = (await troveManager.CDPs(G))[1]
    const G_debtBefore = (await troveManager.CDPs(G))[0]
    const H_collBefore = (await troveManager.CDPs(H))[1]
    const H_debtBefore = (await troveManager.CDPs(H))[0]
    const I_collBefore = (await troveManager.CDPs(I))[1]
    const I_debtBefore = (await troveManager.CDPs(I))[0]

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
    assert.isTrue(await sortedCDPs.contains(G))
    assert.isTrue(await sortedCDPs.contains(H))
    assert.isTrue(await sortedCDPs.contains(I))

    // Check G, H, I coll and debt have not changed
    assert.equal(G_collBefore.eq(await troveManager.CDPs(G))[1])
    assert.equal(G_debtBefore.eq(await troveManager.CDPs(G))[0])
    assert.equal(H_collBefore.eq(await troveManager.CDPs(H))[1])
    assert.equal(H_debtBefore.eq(await troveManager.CDPs(H))[0])
    assert.equal(I_collBefore.eq(await troveManager.CDPs(I))[1])
    assert.equal(I_debtBefore.eq(await troveManager.CDPs(I))[0])

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())
  
    // Attempt to liquidate a variety of troves with SP covering whole batch.
    // Expect A, C, D, F to be liquidated, and G, H, I to remain in system
    await troveManager.batchLiquidateTroves([C, D, G, H, A, I])
    
    // Confirm A, C, D liquidated  
    assert.isFalse(await sortedCDPs.contains(C))
    assert.isFalse(await sortedCDPs.contains(A))
    assert.isFalse(await sortedCDPs.contains(D))
    
    // Check G, H, I remain in system
    assert.isTrue(await sortedCDPs.contains(G))
    assert.isTrue(await sortedCDPs.contains(H))
    assert.isTrue(await sortedCDPs.contains(I))

    // Check coll and debt have not changed
    assert.equal(G_collBefore.eq(await troveManager.CDPs(G))[1])
    assert.equal(G_debtBefore.eq(await troveManager.CDPs(G))[0])
    assert.equal(H_collBefore.eq(await troveManager.CDPs(H))[1])
    assert.equal(H_debtBefore.eq(await troveManager.CDPs(H))[0])
    assert.equal(I_collBefore.eq(await troveManager.CDPs(I))[1])
    assert.equal(I_debtBefore.eq(await troveManager.CDPs(I))[0])

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    // Whale withdraws entire deposit, and re-deposits 132 CLV
    // Increasing the price for a moment to avoid pending liquidations to block withdrawal
    await priceFeed.setPrice(dec(200, 18))
    await stabilityPool.withdrawFromSP(dec(1000, 18), {from: whale})
    await priceFeed.setPrice(dec(110, 18))
    await stabilityPool.provideToSP(dec(132, 18), ZERO_ADDRESS, {from: whale})

    // B and E are still in range 110-TCR.
    // Attempt to liquidate B, G, H, I, D.
    // Expected Stability Pool to fully absorb B (92 CLV + 10 virtual debt), 
    // and absorb ~1/3 of E (30 of 81 CLV + 10 virtual debt)
    
    const stabilityBefore = await stabilityPool.getTotalCLVDeposits()
    const dEbtBefore = (await troveManager.CDPs(E))[0]

    await troveManager.batchLiquidateTroves([B, G, H, I, E])
    
    const dEbtAfter = (await troveManager.CDPs(E))[0]
    const stabilityAfter = await stabilityPool.getTotalCLVDeposits()
    
    const stabilityDelta = stabilityBefore.sub(stabilityAfter)  
    const dEbtDelta = dEbtBefore.sub(dEbtAfter)

    assert.isTrue(stabilityDelta.eq(stabilityBefore))
    assert.equal((dEbtDelta.toString()), '30000000000000001000')
    
    // Confirm B removed and E active 
    assert.isFalse(await sortedCDPs.contains(B)) 
    assert.isTrue(await sortedCDPs.contains(E))

    // Check G, H, I remain in system
    assert.isTrue(await sortedCDPs.contains(G))
    assert.isTrue(await sortedCDPs.contains(H))
    assert.isTrue(await sortedCDPs.contains(I))

    // Check coll and debt have not changed
    assert.equal(G_collBefore.eq(await troveManager.CDPs(G))[1])
    assert.equal(G_debtBefore.eq(await troveManager.CDPs(G))[0])
    assert.equal(H_collBefore.eq(await troveManager.CDPs(H))[1])
    assert.equal(H_debtBefore.eq(await troveManager.CDPs(H))[0])
    assert.equal(I_collBefore.eq(await troveManager.CDPs(I))[1])
    assert.equal(I_debtBefore.eq(await troveManager.CDPs(I))[0])
  })

  it('batchLiquidateTroves(): emits liquidation event with zero coll and debt when troves have ICR > 110% and Stability Pool is empty', async () => {
    await borrowerOperations.openLoan(dec(80, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(70, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(60, 18), carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan(dec(56, 18), dennis, { from: erin, value: dec(1, 'ether') })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await troveManager.checkRecoveryMode())

    assert.isTrue((await troveManager.getCurrentICR(alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).gte(mv._MCR))

    // Confirm 0 CLV in Stability Pool
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), '0')

    const trovesToLiquidate = [alice, bob, carol, dennis]

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.batchLiquidateTroves(trovesToLiquidate)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

    assert.equal(liquidatedDebt, '0')
    assert.equal(liquidatedColl, '0')
  })

  it('batchLiquidateTroves(): emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves', async () => {
    // Whale adds 180 CLV to SP
    await borrowerOperations.openLoan(dec(650, 18), whale, { from: whale, value: dec(10, 'ether') })
    await stabilityPool.provideToSP(dec(180, 18), ZERO_ADDRESS, { from: whale })

    // Troves to be absorbed by SP
    await borrowerOperations.openLoan(dec(80, 18), freddy, { from: freddy, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(80, 18), greta, { from: greta, value: dec(1, 'ether') })

    // Troves to be spared
    await borrowerOperations.openLoan(dec(70, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(65, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(60, 18), carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan(dec(65, 18), dennis, { from: dennis, value: dec(1, 'ether') })

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

    // Confirm 180 CLV in Stability Pool
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), dec(180, 18))

    const trovesToLiquidate = [freddy, greta, alice, bob, carol, dennis, whale]

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.batchLiquidateTroves(trovesToLiquidate)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

    // Check F and G were liquidated
    assert.isFalse(await sortedCDPs.contains(freddy))
    assert.isFalse(await sortedCDPs.contains(greta))

    // Check whale and A-D remain active
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isTrue(await sortedCDPs.contains(bob))
    assert.isTrue(await sortedCDPs.contains(carol))
    assert.isTrue(await sortedCDPs.contains(dennis))
    assert.isTrue(await sortedCDPs.contains(whale))

    // Liquidation event emits coll = (F_coll + G_coll)*0.995, and debt = (F_debt + G_debt)
    assert.equal(liquidatedDebt.toString(), dec(180, 18))
    assert.equal(liquidatedColl.toString(), dec(199, 16))
  })

  it('batchLiquidateTroves(): emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves, including. a partial', async () => {
    // Whale opens trove and adds 220 CLV to SP
    await borrowerOperations.openLoan(dec(650, 18), whale, { from: whale, value: dec(10, 'ether') })
    await stabilityPool.provideToSP(dec(220, 18), ZERO_ADDRESS, { from: whale })

    // Troves to be absorbed by SP
    await borrowerOperations.openLoan(dec(80, 18), freddy, { from: freddy, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(80, 18), greta, { from: greta, value: dec(1, 'ether') })

    // Trove to be partially liquidated
    await borrowerOperations.openLoan(dec(70, 18), alice, { from: alice, value: dec(1, 'ether') })

    // Troves to be spared
    await borrowerOperations.openLoan(dec(65, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(60, 18), carol, { from: carol, value: dec(1, 'ether') })

    await borrowerOperations.openLoan(dec(65, 18), dennis, { from: dennis, value: dec(1, 'ether') })

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

    // Confirm 220 CLV in Stability Pool
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), dec(220, 18))

    const trovesToLiquidate = [freddy, greta, alice, bob, carol, dennis, whale]

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.batchLiquidateTroves(trovesToLiquidate)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

    // Check F and G were liquidated
    assert.isFalse(await sortedCDPs.contains(freddy))
    assert.isFalse(await sortedCDPs.contains(greta))

    // Check whale and A-D remain active
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isTrue(await sortedCDPs.contains(bob))
    assert.isTrue(await sortedCDPs.contains(carol))
    assert.isTrue(await sortedCDPs.contains(dennis))
    assert.isTrue(await sortedCDPs.contains(whale))

    // Check A's collateral and debt have reduced by 50%, from partial liquidation
    const entireColl_A = (await troveManager.CDPs(alice))[1].add(await troveManager.getPendingETHReward(alice))
    const entireDebt_A = (await troveManager.CDPs(alice))[0].add(await troveManager.getPendingCLVDebtReward(alice))

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
