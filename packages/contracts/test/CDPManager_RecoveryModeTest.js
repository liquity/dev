const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th = testHelpers.TestHelper
const moneyVals = testHelpers.MoneyValues

contract('CDPManager', async accounts => {
  const _1_Ether = web3.utils.toWei('1', 'ether')
  const _2_Ether = web3.utils.toWei('2', 'ether')
  const _3_Ether = web3.utils.toWei('3', 'ether')
  const _3pt5_Ether = web3.utils.toWei('3.5', 'ether')
  const _6_Ether = web3.utils.toWei('6', 'ether')
  const _9_Ether = web3.utils.toWei('9', 'ether')
  const _10_Ether = web3.utils.toWei('10', 'ether')
  const _20_Ether = web3.utils.toWei('20', 'ether')
  const _21_Ether = web3.utils.toWei('21', 'ether')
  const _22_Ether = web3.utils.toWei('22', 'ether')
  const _24_Ether = web3.utils.toWei('24', 'ether')
  const _25_Ether = web3.utils.toWei('25', 'ether')
  const _27_Ether = web3.utils.toWei('27', 'ether')
  const _30_Ether = web3.utils.toWei('30', 'ether')

  const [owner, alice, bob, carol, dennis, elisa, freddy, greta, harry, ida] = accounts;
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

    const contractAddresses = getAddresses(contracts)
    await connectContracts(contracts, contractAddresses)
  })

  it("withdrawCLV(): reverts if withdrawal would pull TCR below CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })

    //  Alice and Bob withdraw such that the TCR is 150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    // const TCR = (await poolManager.getTCR()).toString()
    // console.log("TCR is" + TCR)
    // assert.equal(TCR, '1500000000000000000')

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
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    // const TCR = (await poolManager.getTCR()).toString()
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

  //---

  it("openLoan(): reverts if withdrawal would pull TCR below CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    const TCR = (await poolManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // Carol attempts to open a loan, which would reduce TCR to below 150%
    try {
      const txData = await borrowerOperations.openLoan('180000000000000000000', carol, { from: carol, value: _1_Ether })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("openLoan(): reverts if system is in recovery mode", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    const TCR = (await poolManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // price drops to 1ETH:150CLV, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000');

    try {
      const txData = await borrowerOperations.openLoan('50000000000000000000', carol, { from: carol, value: _1_Ether })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, 'revert')
    }
  })

  it("withdrawColl(): reverts if system is in recovery mode", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    const TCR = (await poolManager.getTCR()).toString()
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

  it("checkRecoveryMode(): Returns true if TCR falls below CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    const TCR = (await poolManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    const recoveryMode_Before = await cdpManager.checkRecoveryMode();
    assert.isFalse(recoveryMode_Before)

    // --- TEST ---

    // price drops to 1ETH:150CLV, reducing TCR below 150%.  setPrice() calls checkTCRAndSetRecoveryMode() internally.
    await priceFeed.setPrice('150000000000000000000')
    
    // const price = await priceFeed.getPrice()
    // await cdpManager.checkTCRAndSetRecoveryMode(price)

    const recoveryMode_After = await cdpManager.checkRecoveryMode();
    assert.isTrue(recoveryMode_After)
  })

  it("checkRecoveryMode(): Returns true if TCR stays less than CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })

    // Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    const TCR = (await poolManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---

    // price drops to 1ETH:150CLV, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000')

    const recoveryMode_Before = await cdpManager.checkRecoveryMode();
    assert.isTrue(recoveryMode_Before)

    await borrowerOperations.addColl(alice, alice, { from: alice, value: '1' })

    const recoveryMode_After = await cdpManager.checkRecoveryMode();
    assert.isTrue(recoveryMode_After)
  })

  it("checkRecoveryMode(): returns false if TCR stays above CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })
    
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    // --- TEST ---
    const recoveryMode_Before = await cdpManager.checkRecoveryMode();
    assert.isFalse(recoveryMode_Before)

    await borrowerOperations.withdrawColl(_1_Ether, alice, { from: alice })

    const recoveryMode_After = await cdpManager.checkRecoveryMode();
    assert.isFalse(recoveryMode_After)
  })

  it("checkRecoveryMode(): returns false if TCR rises above CCR", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })

     //  Alice and Bob withdraw such that the TCR is ~150%
     await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
     await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    const TCR = (await poolManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---
    // price drops to 1ETH:150CLV, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000')

    const recoveryMode_Before = await cdpManager.checkRecoveryMode();
    assert.isTrue(recoveryMode_Before)

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _10_Ether })

    const recoveryMode_After = await cdpManager.checkRecoveryMode();
    assert.isFalse(recoveryMode_After)
  })

  // --- liquidate() with ICR < 100% ---

  it("liquidate(), with ICR < 100%: removes stake and updates totalStakes", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })

   //  Alice and Bob withdraw such that the TCR is ~150%
   await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
   await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    const TCR = (await poolManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')


    const bob_Stake_Before = (await cdpManager.CDPs(bob))[2]
    const totalStakes_Before = await cdpManager.totalStakes()

    assert.equal(bob_Stake_Before, _3_Ether)
    assert.equal(totalStakes_Before, _6_Ether)

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check Bob's ICR falls to 75%
    const bob_ICR = await cdpManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, '750000000000000000')

    // Liquidate Bob
    await cdpManager.liquidate(bob, { from: owner })

    const bob_Stake_After = (await cdpManager.CDPs(bob))[2]
    const totalStakes_After = await cdpManager.totalStakes()

    assert.equal(bob_Stake_After, 0)
    assert.equal(totalStakes_After, _3_Ether)
  })

  it("liquidate(), with ICR < 100%: updates system snapshots correctly", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _3_Ether })

    //  Alice and Bob withdraw such that their ICRs and the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })
    await borrowerOperations.withdrawCLV('400000000000000000000', dennis, { from: dennis })

    const TCR = (await poolManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%, and all CDPs below 100% ICR
    await priceFeed.setPrice('100000000000000000000')

    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Dennis is liquidated
    await cdpManager.liquidate(dennis, { from: owner })

    const totalStakesSnaphot_before = (await cdpManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_before = (await cdpManager.totalCollateralSnapshot()).toString()

    assert.equal(totalStakesSnaphot_before, _6_Ether)
    assert.equal(totalCollateralSnapshot_before, _9_Ether)

    // Liquidate Bob
    await cdpManager.liquidate(bob, { from: owner })

    const totalStakesSnaphot_After = (await cdpManager.totalStakesSnapshot())
    const totalCollateralSnapshot_After = (await cdpManager.totalCollateralSnapshot())

    assert.equal(totalStakesSnaphot_After, _3_Ether)
    // total collateral should always be 9, as all liquidations in this test case are full redistributions
    assert.equal(totalCollateralSnapshot_After, _9_Ether)
  })

  it("liquidate(), with ICR < 100%: closes the CDP and removes it from the CDP array", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })

    //  Alice and Bob withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })

    const TCR = (await poolManager.getTCR()).toString()
    assert.equal(TCR, '1500000000000000000')

    const bob_CDPStatus_Before = (await cdpManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_Before = await sortedCDPs.contains(bob)

    assert.equal(bob_CDPStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_CDP_isInSortedList_Before)

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()
 
    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check Bob's ICR falls to 75%
    const bob_ICR = await cdpManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, '750000000000000000')

    // Liquidate Bob
    await cdpManager.liquidate(bob, { from: owner })

    // check Bob's CDP is successfully closed, and removed from sortedList
    const bob_CDPStatus_After = (await cdpManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_After = await sortedCDPs.contains(bob)
    assert.equal(bob_CDPStatus_After, 2)  // status enum element 2 corresponds to "Closed"
    assert.isFalse(bob_CDP_isInSortedList_After)
  })

  it("liquidate(), with ICR < 100%: only redistributes to active CDPs - no offset to Stability Pool", async () => {

    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _3_Ether })

    //  Alice and Bob withdraw such that their ICRs and the TCR is 150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', bob, { from: bob })
    await borrowerOperations.withdrawCLV('400000000000000000000', dennis, { from: dennis })

    // Alice deposits to SP
    await poolManager.provideToSP('400000000000000000000', { from: alice })
    // check SP rewards-per-unit-staked before
    const S_CLV_Before = (await poolManager.S_CLV()).toString()
    const S_ETH_Before = (await poolManager.S_CLV()).toString()

    assert.equal(S_CLV_Before, '0')
    assert.equal(S_ETH_Before, '0')

    // const TCR = (await poolManager.getTCR()).toString()
    // assert.equal(TCR, '1500000000000000000')

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%, and all CDPs below 100% ICR
    await priceFeed.setPrice('100000000000000000000')
 
    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // liquidate bob
    await cdpManager.liquidate(bob, { from: owner })

    // check SP rewards-per-unit-staked after liquidation - should be no increase
    S_CLV_After = (await poolManager.S_CLV()).toString()
    S_ETH_After = (await poolManager.S_CLV()).toString()

    assert.equal(S_CLV_After, '0')
    assert.equal(S_ETH_After, '0')
  })

  // --- liquidate() with 100% < ICR < 110%

  it("liquidate(), with 100 < ICR < 110%: removes stake and updates totalStakes", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _21_Ether })

    //  Bob withdraws 2000 CLV, bringing his ICR to 210%
    await borrowerOperations.withdrawCLV('2000000000000000000000', bob, { from: bob })

    // Total TCR = 24*200/2000 = 240%
    const TCR = (await poolManager.getTCR()).toString()
    assert.equal(TCR, '2400000000000000000')

    const bob_Stake_Before = (await cdpManager.CDPs(bob))[2]
    const totalStakes_Before = await cdpManager.totalStakes()

    assert.equal(bob_Stake_Before, _21_Ether)
    assert.equal(totalStakes_Before, _24_Ether)

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR to 120%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()
 
    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check Bob's ICR falls to 105%
    const bob_ICR = await cdpManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, '1050000000000000000')

    // Liquidate Bob
    await cdpManager.liquidate(bob, { from: owner })

    const bob_Stake_After = (await cdpManager.CDPs(bob))[2]
    const totalStakes_After = await cdpManager.totalStakes()

    assert.equal(bob_Stake_After, 0)
    assert.equal(totalStakes_After, _3_Ether)
  })

  it("liquidate(), with 100% < ICR < 110%: updates system snapshots correctly", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _21_Ether })
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _3_Ether })

    //  Alice and Dennis withdraw such that their ICR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', dennis, { from: dennis })

    //  Bob withdraws 2000 CLV, bringing his ICR to 210%
    await borrowerOperations.withdrawCLV('2000000000000000000000', bob, { from: bob })

    const totalStakesSnaphot_1 = (await cdpManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_1 = (await cdpManager.totalCollateralSnapshot()).toString()
    assert.equal(totalStakesSnaphot_1, 0)
    assert.equal(totalCollateralSnapshot_1, 0)

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%, and all CDPs below 100% ICR
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()
 
    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Dennis is liquidated
    await cdpManager.liquidate(dennis, { from: owner })

    /*
    Prior to Dennis liquidation, total stakes and total collateral were each 27 ether. 
  
    Check snapshots. Dennis' liquidated collateral is distributed and remains in the system. His 
    stake is removed, leaving 27 ether total collateral, and 24 ether total stakes. */
    
    const totalStakesSnaphot_2 = (await cdpManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_2 = (await cdpManager.totalCollateralSnapshot()).toString()
    assert.equal(totalStakesSnaphot_2, _24_Ether)
    assert.equal(totalCollateralSnapshot_2, _27_Ether)

    // check Bob's ICR is now in range 100% < ICR 110%
    const _110percent = web3.utils.toBN('1100000000000000000')
    const _100percent = web3.utils.toBN('1000000000000000000')

    const bob_ICR = (await cdpManager.getCurrentICR(bob, price))

    assert.isTrue(bob_ICR.lt(_110percent))
    assert.isTrue(bob_ICR.gt(_100percent))

    // Liquidate Bob
    await cdpManager.liquidate(bob, { from: owner })

    /* After Bob's liquidation, Bob's stake (21 ether) should be removed from total stakes, 
    but his collateral should remain in the system. */
    const totalStakesSnaphot_3 = (await cdpManager.totalStakesSnapshot())
    const totalCollateralSnapshot_3 = (await cdpManager.totalCollateralSnapshot())
    assert.equal(totalStakesSnaphot_3, _3_Ether)
    assert.equal(totalCollateralSnapshot_3, _27_Ether)   // total collateral should always be 9, as all liquidations in this test case are full redistributions
  })

  it("liquidate(), with 100% < ICR < 110%: closes the CDP and removes it from the CDP array", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _21_Ether })

    //  Bob withdraws 2000 CLV, bringing his ICR to 210%
    await borrowerOperations.withdrawCLV('2000000000000000000000', bob, { from: bob })

    const bob_CDPStatus_Before = (await cdpManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_Before = await sortedCDPs.contains(bob)

    assert.equal(bob_CDPStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_CDP_isInSortedList_Before)

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()
 
    
    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check Bob's ICR has fallen to 105%
    const bob_ICR = await cdpManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, '1050000000000000000')

    // Liquidate Bob
    await cdpManager.liquidate(bob, { from: owner })

    // check Bob's CDP is successfully closed, and removed from sortedList
    const bob_CDPStatus_After = (await cdpManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_After = await sortedCDPs.contains(bob)
    assert.equal(bob_CDPStatus_After, 2)  // status enum element 2 corresponds to "Closed"
    assert.isFalse(bob_CDP_isInSortedList_After)
  })

  it("liquidate(), with 100% < ICR < 110%: offsets as much debt as possible with the Stability Pool, then redistributes the remainder coll and debt", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _3_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _21_Ether })
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _3_Ether })

     //  Alice and Dennis withdraw such that the TCR is ~150%
    await borrowerOperations.withdrawCLV('400000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('400000000000000000000', dennis, { from: dennis })

    // Alice deposits 400CLV to the Stability Pool
    await poolManager.provideToSP('400000000000000000000', { from: alice })

    // Bob withdraws 2000 CLV, bringing his ICR to 210%
    await borrowerOperations.withdrawCLV('2000000000000000000000', bob, { from: bob })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()
 
    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check Bob's ICR has fallen to 105%
    const bob_ICR = await cdpManager.getCurrentICR(bob, price);
    assert.equal(bob_ICR, '1050000000000000000')

    // check pool CLV before liquidation
    const stabilityPoolCLV_Before = (await poolManager.getStabilityPoolCLV()).toString()
    assert.equal(stabilityPoolCLV_Before, '400000000000000000000')

    // check pool rewards before liquidation
    const S_CLV_Before = await poolManager.S_CLV()
    const S_ETH_Before = await poolManager.S_ETH()

    assert.equal(S_CLV_Before, 0)
    assert.equal(S_ETH_Before, 0)

    /* Now, liquidate Bob. Liquidated coll is 21 ether, and liquidated debt is 2000 CLV.
    
    With 400 CLV in the StabilityPool, 400 CLV should be offset with the pool, leaving 0 in the pool.
  
    Stability Pool rewards for alice should be:
    CLVLoss: 400CLV
    ETHGain: (400 / 2000) * 21 = 4.2 ether
  
    After offsetting 400 CLV and 4.2 ether, the remainders - 1600 CLV and 16.8 ether - should be redistributed to all active CDPs.
   */

    // Liquidate Bob
    await cdpManager.liquidate(bob, { from: owner })


    /* check Stability Pool rewards after.  As total deposited was 400 CLV, rewards-per-unit-staked for the StabilityPool
     should be:
    S_CLV = 400 / 400 = 1 CLV
    S_ETH = 4.2 / 400 = 0.0105 ether
    */
    const S_CLV_After = (await poolManager.S_CLV()).toString()
    const S_ETH_After = (await poolManager.S_ETH()).toString()

    assert.isAtMost(th.getDifference(S_CLV_After, '1000000000000000000'), 100)
    assert.isAtMost(th.getDifference(S_ETH_After, '10500000000000000'), 100)

    /* Now, check redistribution to active CDPs. Remainders of 1600 CLV and 16.8 ether are distributed.
    
    Now, only Alice and Dennis have a stake in the system - 3 ether each, thus total stakes is 6 ether.
  
    Rewards-per-unit-staked from the redistribution should be:
  
    L_CLVDebt = 1600 / 6 = 266.666 CLV
    L_ETH = 16.8 /6 =  2.8 ether
    */
    const L_CLVDebt = (await cdpManager.L_CLVDebt()).toString()
    const L_ETH = (await cdpManager.L_ETH()).toString()

    assert.isAtMost(th.getDifference(L_CLVDebt, '266666666666666666667'), 100)
    assert.isAtMost(th.getDifference(L_ETH, '2800000000000000000'), 100)
  })

  // --- liquidate(), applied to loan with ICR > 110% that has the lowest ICR 

  it("liquidate(), with ICR > 110%, loan has lowest ICR, and StabilityPool is empty: does nothing", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _2_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _2_Ether })

    //  Alice and Dennis withdraw 150 CLV, resulting in ICRs of 266%. 
    await borrowerOperations.withdrawCLV('150000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('150000000000000000000', dennis, { from: dennis })
    //Bob withdraws 250 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('250000000000000000000', bob, { from: bob })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()
 
    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Check Bob's ICR is >110% but still lowest
    const bob_ICR = (await cdpManager.getCurrentICR(bob, price)).toString()
    const alice_ICR = (await cdpManager.getCurrentICR(alice, price)).toString()
    const dennis_ICR = (await cdpManager.getCurrentICR(dennis, price)).toString()
    assert.equal(bob_ICR, '1200000000000000000')
    assert.equal(alice_ICR, '1333333333333333333')
    assert.equal(dennis_ICR, '1333333333333333333')

    // Liquidate Bob
    await cdpManager.liquidate(bob, { from: owner })

    // Check that Pool rewards don't change
    const S_CLV_Before = (await poolManager.S_CLV()).toString()
    const S_ETH_Before = (await poolManager.S_ETH()).toString()

    assert.equal(S_CLV_Before, '0')
    assert.equal(S_ETH_Before, '0')

    // Check that redistribution rewards don't change
    const L_CLVDebt = (await cdpManager.L_CLVDebt()).toString()
    const L_ETH = (await poolManager.S_ETH()).toString()

    assert.equal(L_CLVDebt, '0')
    assert.equal(L_ETH, '0')

    // Check that Bob's CDP and stake remains active with unchanged coll and debt
    const bob_CDP = await cdpManager.CDPs(bob);
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

  it("liquidate(), with ICR > 110%, loan has lowest ICR, and StabilityPool CLV > liquidated debt: offsets the loan entirely with the pool", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1500 CLV, and Dennis 150 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1500000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('150000000000000000000', dennis, { from: dennis })
    // Bob withdraws 250 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('250000000000000000000', bob, { from: bob })

    // Alice deposits all 1500 CLV in the Stability Pool
    await poolManager.provideToSP('1500000000000000000000', { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()
 
    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Check Bob's ICR is > 110% but still lowest
    bob_ICR = (await cdpManager.getCurrentICR(bob, price)).toString()
    alice_ICR = (await cdpManager.getCurrentICR(alice, price)).toString()
    dennis_ICR = (await cdpManager.getCurrentICR(dennis, price)).toString()
    assert.equal(bob_ICR, '1200000000000000000')
    assert.equal(alice_ICR, '1333333333333333333')
    assert.equal(dennis_ICR, '1333333333333333333')

    // Liquidate Bob
    await cdpManager.liquidate(bob, { from: owner })

    /* Check accrued Stability Pool rewards after. Total Pool deposits was 1500 CLV. 
    As liquidated debt (250 CLV) was completely offset, rewards-per-unit-staked for the Stability Pool should be:
    
    S_CLV = 250 / 1500 = 10 CLV
    S_ETH =  3 / 1500 = 0.002 ether
    */
    const S_CLV = (await poolManager.S_CLV()).toString()
    const S_ETH = (await poolManager.S_ETH()).toString()

    assert.equal(S_CLV, '166666666666666667')
    assert.equal(S_ETH, '2000000000000000')
  })

  it("liquidate(), with ICR > 110%, loan has lowest ICR, and StabilityPool CLV > liquidated debt: removes stake and updates totalStakes", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1500 CLV, and Dennis 150 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1500000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('150000000000000000000', dennis, { from: dennis })
    // Bob withdraws 250 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('250000000000000000000', bob, { from: bob })

    // Alice deposits all 1500 CLV in the Stability Pool
    await poolManager.provideToSP('1500000000000000000000', { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
 
    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check stake and totalStakes before
    const bob_Stake_Before = (await cdpManager.CDPs(bob))[2]
    const totalStakes_Before = await cdpManager.totalStakes()

    assert.equal(bob_Stake_Before, _3_Ether)
    assert.equal(totalStakes_Before, _25_Ether)

    // Liquidate Bob
    await cdpManager.liquidate(bob, { from: owner })

    // check stake and totalStakes after
    const bob_Stake_After = (await cdpManager.CDPs(bob))[2]
    const totalStakes_After = await cdpManager.totalStakes()

    assert.equal(bob_Stake_After, 0)
    assert.equal(totalStakes_After, _22_Ether)
  })

  it("liquidate(), with ICR > 110%, loan has lowest ICR, and StabilityPool CLV > liquidated debt: updates system snapshots", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1500 CLV, and Dennis 150 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1500000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('150000000000000000000', dennis, { from: dennis })
    // Bob withdraws 250 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('250000000000000000000', bob, { from: bob })

    // Alice deposits all 1500 CLV in the Stability Pool
    await poolManager.provideToSP('1500000000000000000000', { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
 
    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // check system snapshots before
    const totalStakesSnaphot_before = (await cdpManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_before = (await cdpManager.totalCollateralSnapshot()).toString()

    assert.equal(totalStakesSnaphot_before, '0')
    assert.equal(totalCollateralSnapshot_before, '0')

    // Liquidate Bob
    await cdpManager.liquidate(bob, { from: owner })

    const totalStakesSnaphot_After = (await cdpManager.totalStakesSnapshot())
    const totalCollateralSnapshot_After = (await cdpManager.totalCollateralSnapshot())

    // totalStakesSnapshot should have reduced to 22 ether - the sum of Alice's coll( 20 ether) and Dennis' coll (2 ether )
    assert.equal(totalStakesSnaphot_After, _22_Ether)
    // Total collateral should also reduce, since all liquidated coll has been moved to a reward for Stability Pool depositors
    assert.equal(totalCollateralSnapshot_After, _22_Ether)
  })

  it("liquidate(), with ICR > 110%, loan has lowest ICR, and StabilityPool CLV > liquidated debt: closes the CDP", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1500 CLV, and Dennis 150 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1500000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('150000000000000000000', dennis, { from: dennis })
    // Bob withdraws 250 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('250000000000000000000', bob, { from: bob })

    // Alice deposits all 1500 CLV in the Stability Pool
    await poolManager.provideToSP('1500000000000000000000', { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
 
    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Check Bob's CDP is active
    const bob_CDPStatus_Before = (await cdpManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_Before = await sortedCDPs.contains(bob)

    assert.equal(bob_CDPStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_CDP_isInSortedList_Before)

    // Liquidate Bob
    await cdpManager.liquidate(bob, { from: owner })

    // Check Bob's CDP is closed after liquidation
    const bob_CDPStatus_After = (await cdpManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_After = await sortedCDPs.contains(bob)

    assert.equal(bob_CDPStatus_After, 2) // status enum element 2 corresponds to "Closed"
    assert.isFalse(bob_CDP_isInSortedList_After)
  })

  // --- liquidate() applied to loan with ICR > 110% that has the lowest ICR, and Stability Pool CLV is LESS THAN the liquidated debt ---

  it("liquidate(), with ICR > 110%, loan has lowest ICR, and StabilityPool CLV < liquidated debt: CDP remains active", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1500 CLV, and Dennis 150 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1500000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('150000000000000000000', dennis, { from: dennis })
    // Bob withdraws 250 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('250000000000000000000', bob, { from: bob })

    // Alice deposits 100 CLV in the Stability Pool
    await poolManager.provideToSP('100000000000000000000', { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
 
    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Check Bob's CDP is active
    const bob_CDPStatus_Before = (await cdpManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_Before = await sortedCDPs.contains(bob)

    assert.equal(bob_CDPStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_CDP_isInSortedList_Before)

    // Liquidate Bob
    await cdpManager.liquidate(bob, { from: owner })

    /* Since the pool only contains 100 CLV, and Bob's pre-liquidation debt was 250 CLV, 
    expect Bob's loan to only be partially offset, and remain active after liquidation */

    const bob_CDPStatus_After = (await cdpManager.CDPs(bob))[3]
    const bob_CDP_isInSortedList_After = await sortedCDPs.contains(bob)

    assert.equal(bob_CDPStatus_After, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_CDP_isInSortedList_After)
  })

  it("liquidate(), with ICR > 110%, loan has lowest ICR, and StabilityPool CLV < liquidated debt: updates loan coll, debt and stake, and system totalStakes", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1500 CLV, and Dennis 150 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1500000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('150000000000000000000', dennis, { from: dennis })
    // Bob withdraws 250 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('250000000000000000000', bob, { from: bob })

    // Alice deposits 100 CLV in the Stability Pool
    await poolManager.provideToSP('100000000000000000000', { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
 
    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Liquidate Bob
    await cdpManager.liquidate(bob, { from: owner })

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
    const bob_CDP = await cdpManager.CDPs(bob)
    const bob_DebtAfter = bob_CDP[0].toString()
    const bob_CollAfter = bob_CDP[1].toString()
    const bob_StakeAfter = bob_CDP[2].toString()

    assert.equal(bob_DebtAfter, '150000000000000000000')
    assert.equal(bob_CollAfter, '1800000000000000000')
    assert.equal(bob_StakeAfter, '1800000000000000000')

    const totalStakes_After = (await cdpManager.totalStakes()).toString()
    assert.equal(totalStakes_After, '23800000000000000000')
  })

  it("liquidate(), with ICR > 110%, loan has lowest ICR, and StabilityPool CLV < liquidated debt: updates system shapshots", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1500 CLV, and Dennis 150 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1500000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('150000000000000000000', dennis, { from: dennis })
    // Bob withdraws 250 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('250000000000000000000', bob, { from: bob })

    // Alice deposits 100 CLV in the Stability Pool
    await poolManager.provideToSP('100000000000000000000', { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
 
    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Check snapshots before
    const totalStakesSnaphot_Before = (await cdpManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_Before = (await cdpManager.totalCollateralSnapshot()).toString()

    assert.equal(totalStakesSnaphot_Before, 0)
    assert.equal(totalCollateralSnapshot_Before, 0)

    // Liquidate Bob
    await cdpManager.liquidate(bob, { from: owner })

    /* After liquidation, totalStakes snapshot should equal Alice's stake (20 ether) + Dennis stake (2 ether) = 22 ether.

    Since there has been no redistribution, the totalCollateral snapshot should equal the totalStakes snapshot: 22 ether.*/

    const totalStakesSnaphot_After = (await cdpManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_After = (await cdpManager.totalCollateralSnapshot()).toString()

    assert.equal(totalStakesSnaphot_After, '22000000000000000000')
    assert.equal(totalCollateralSnapshot_After, '22000000000000000000')
  })

  it("liquidate(), with ICR > 110%, loan has lowest ICR, and StabilityPool CLV < liquidated debt: updates system shapshots", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _20_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _2_Ether })

    // Alice withdraws 1500 CLV, and Dennis 150 CLV, resulting in ICRs of 266%.  
    await borrowerOperations.withdrawCLV('1500000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('150000000000000000000', dennis, { from: dennis })
    // Bob withdraws 250 CLV, resulting in ICR of 240%. Bob has lowest ICR.
    await borrowerOperations.withdrawCLV('250000000000000000000', bob, { from: bob })

    // Alice deposits 100 CLV in the Stability Pool
    await poolManager.provideToSP('100000000000000000000', { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100CLV, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
 
    const recoveryMode = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode)

    // Liquidate Bob
    await cdpManager.liquidate(bob, { from: owner })

    /* check Stability Pool rewards.  After Bob's liquidation:
    - amount of CLV offset with Stability Pool should be 100 CLV
    - corresponding amount of ETH added to Stability Pool should be 100/250 * 3 = 1.2 ether.

    Thus, with 100 CLV in pool prior to liquidation, rewards-per-unit-staked should be:

    S_CLV: 1 CLV
    S_ETH : 1.2 / 100 = 0.012 ether */
    const S_CLV_After = (await poolManager.S_CLV()).toString()
    const S_ETH_After = (await poolManager.S_ETH()).toString()

    assert.isAtMost(th.getDifference(S_CLV_After, '1000000000000000000'), 100)
    assert.isAtMost(th.getDifference(S_ETH_After, '12000000000000000'), 100)

    /* For this Recovery Mode test case, there should be no redistribution of remainder to active CDPs. 
    Redistribution rewards-per-unit-staked should be zero. */

    const L_CLVDebt_After = (await cdpManager.L_CLVDebt()).toString()
    const L_ETH_After = (await cdpManager.L_ETH()).toString()

    assert.equal(L_CLVDebt_After, '0')
    assert.equal(L_ETH_After, '0')
  })

  it("liquidateCDPs(): With all ICRs > 110%, Liquidates CDPs until system leaves recovery mode", async () => {
    // make 8 CDPs accordingly
    // --- SETUP ---

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _25_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3pt5_Ether })
    await borrowerOperations.addColl(carol, carol, { from: carol, value: _3_Ether })
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _3_Ether })
    await borrowerOperations.addColl(elisa, elisa, { from: elisa, value: _3_Ether })
    await borrowerOperations.addColl(freddy, freddy, { from: freddy, value: _3_Ether })
    await borrowerOperations.addColl(greta, greta, { from: greta, value: _1_Ether })
    await borrowerOperations.addColl(harry, harry, { from: harry, value: _1_Ether })

    // Everyone withdraws some CLV from their CDP, resulting in different ICRs
    await borrowerOperations.withdrawCLV('1400000000000000000000', alice, { from: alice })  // 1400 CLV -> ICR = 400%
    await borrowerOperations.withdrawCLV('200000000000000000000', bob, { from: bob }) //  200 CLV -> ICR = 350%
    await borrowerOperations.withdrawCLV('210000000000000000000', carol, { from: carol }) // 210 CLV -> ICR = 286%
    await borrowerOperations.withdrawCLV('220000000000000000000', dennis, { from: dennis }) // 220 CLV -> ICR = 273%
    await borrowerOperations.withdrawCLV('230000000000000000000', elisa, { from: elisa }) // 230 CLV -> ICR = 261%
    await borrowerOperations.withdrawCLV('240000000000000000000', freddy, { from: freddy }) // 240 CLV -> ICR = 250%
    await borrowerOperations.withdrawCLV('85000000000000000000', greta, { from: greta }) // 85 CLV -> ICR = 235%
    await borrowerOperations.withdrawCLV('90000000000000000000', harry, { from: harry }) // 90 CLV ->  ICR = 222%

    // Alice deposits 1400 CLV to Stability Pool
    await poolManager.provideToSP('1400000000000000000000', { from: alice })

    // price drops
    // price drops to 1ETH:90CLV, reducing TCR below 150%
    await priceFeed.setPrice('90000000000000000000')
    const price = await priceFeed.getPrice()
 
    const recoveryMode_Before = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode_Before)

    // check TCR < 150%
    const _150percent = web3.utils.toBN('1500000000000000000')
    const TCR_Before = await poolManager.getTCR()
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
    alice_ICR = await cdpManager.getCurrentICR(alice, price)
    bob_ICR = await cdpManager.getCurrentICR(bob, price)
    carol_ICR = await cdpManager.getCurrentICR(carol, price)
    dennis_ICR = await cdpManager.getCurrentICR(dennis, price)
    elisa_ICR = await cdpManager.getCurrentICR(elisa, price)
    freddy_ICR = await cdpManager.getCurrentICR(freddy, price)
    greta_ICR = await cdpManager.getCurrentICR(greta, price)
    harry_ICR = await cdpManager.getCurrentICR(harry, price)

    // Alice and Bob should have ICR > 150%
    assert.isTrue(alice_ICR.gt(_150percent))
    assert.isTrue(bob_ICR.gt(_150percent))
    // All other CDPs should have ICR < 150%
    assert.isTrue(carol_ICR.lt(_150percent))
    assert.isTrue(dennis_ICR.lt(_150percent))
    assert.isTrue(elisa_ICR.lt(_150percent))
    assert.isTrue(freddy_ICR.lt(_150percent))
    assert.isTrue(greta_ICR.lt(_150percent))
    assert.isTrue(harry_ICR.lt(_150percent))

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
    await cdpManager.liquidateCDPs(10);

    // check system is no longer in Recovery Mode
    const recoveryMode_After = await cdpManager.checkRecoveryMode()
    assert.isFalse(recoveryMode_After)

    // After liquidation, TCR should rise to above 150%. 
    const TCR_After = await poolManager.getTCR()
    assert.isTrue(TCR_After.gt(_150percent))

    // get all CDPs
    const alice_CDP = await cdpManager.CDPs(alice)
    const bob_CDP = await cdpManager.CDPs(bob)
    const carol_CDP = await cdpManager.CDPs(carol)
    const dennis_CDP = await cdpManager.CDPs(dennis)
    const elisa_CDP = await cdpManager.CDPs(elisa)
    const freddy_CDP = await cdpManager.CDPs(freddy)
    const greta_CDP = await cdpManager.CDPs(greta)
    const harry_CDP = await cdpManager.CDPs(harry)

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
    assert.equal(elisa_CDP[3], 2)
    assert.equal(freddy_CDP[3], 2)
    assert.equal(greta_CDP[3], 2)
    assert.equal(harry_CDP[3], 2)
    assert.isFalse(await sortedCDPs.contains(elisa))
    assert.isFalse(await sortedCDPs.contains(freddy))
    assert.isFalse(await sortedCDPs.contains(greta))
    assert.isFalse(await sortedCDPs.contains(harry))
  })

  it("liquidateCDPs(): Liquidates CDPs until 1) system has left recovery mode AND 2) it reaches a CDP with ICR >= 110%", async () => {
    // make 6 CDPs accordingly
    // --- SETUP ---

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _30_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _3_Ether })
    await borrowerOperations.addColl(carol, carol, { from: carol, value: _3_Ether })
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _3_Ether })
    await borrowerOperations.addColl(elisa, elisa, { from: elisa, value: _3_Ether })
    await borrowerOperations.addColl(freddy, freddy, { from: freddy, value: _3_Ether })

    // Alice withdraws 1400 CLV, the others each withdraw 250 CLV 
    await borrowerOperations.withdrawCLV('1400000000000000000000', alice, { from: alice })  // 1400 CLV -> ICR = 429%
    await borrowerOperations.withdrawCLV('250000000000000000000', bob, { from: bob }) //  250 CLV -> ICR = 240%
    await borrowerOperations.withdrawCLV('250000000000000000000', carol, { from: carol }) // 250 CLV -> ICR = 240%
    await borrowerOperations.withdrawCLV('250000000000000000000', dennis, { from: dennis }) // 250 CLV -> ICR = 240%
    await borrowerOperations.withdrawCLV('250000000000000000000', elisa, { from: elisa }) // 250 CLV -> ICR = 240%
    await borrowerOperations.withdrawCLV('250000000000000000000', freddy, { from: freddy }) // 250 CLV -> ICR = 240%

    // Alice deposits 1400 CLV to Stability Pool
    await poolManager.provideToSP('1400000000000000000000', { from: alice })

    // price drops to 1ETH:85CLV, reducing TCR below 150%
    await priceFeed.setPrice('85000000000000000000')
    const price = await priceFeed.getPrice()

    // check Recovery Mode kicks in
     
    const recoveryMode_Before = await cdpManager.checkRecoveryMode()
    assert.isTrue(recoveryMode_Before)

    // check TCR < 150%
    const _150percent = web3.utils.toBN('1500000000000000000')
    const TCR_Before = await poolManager.getTCR()
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
    alice_ICR = await cdpManager.getCurrentICR(alice, price)
    bob_ICR = await cdpManager.getCurrentICR(bob, price)
    carol_ICR = await cdpManager.getCurrentICR(carol, price)
    dennis_ICR = await cdpManager.getCurrentICR(dennis, price)
    elisa_ICR = await cdpManager.getCurrentICR(elisa, price)
    freddy_ICR = await cdpManager.getCurrentICR(freddy, price)

    // Alice should have ICR > 150%
    assert.isTrue(alice_ICR.gt(_150percent))
    // All other CDPs should have ICR < 150%
    assert.isTrue(carol_ICR.lt(_150percent))
    assert.isTrue(dennis_ICR.lt(_150percent))
    assert.isTrue(elisa_ICR.lt(_150percent))
    assert.isTrue(freddy_ICR.lt(_150percent))

    /* Liquidations should occur from the lowest ICR CDP upwards, i.e. 
    1) Freddy, 2) Elisa, 3) Dennis.

    After liquidating Freddy and Elisa, the the TCR of the system rises above the CCR, to 154%.  
   (see calculations in Google Sheet)

    Liquidations continue until all CDPs with ICR < MCR have been closed. 
    Only Alice should remain active - all others should be closed. */

    // call liquidate CDPs
    await cdpManager.liquidateCDPs(6);

    // check system is no longer in Recovery Mode
    const recoveryMode_After = await cdpManager.checkRecoveryMode()
    assert.isFalse(recoveryMode_After)

    // After liquidation, TCR should rise to above 150%. 
    const TCR_After = await poolManager.getTCR()
    assert.isTrue(TCR_After.gt(_150percent))

    // get all CDPs
    const alice_CDP = await cdpManager.CDPs(alice)
    const bob_CDP = await cdpManager.CDPs(bob)
    const carol_CDP = await cdpManager.CDPs(carol)
    const dennis_CDP = await cdpManager.CDPs(dennis)
    const elisa_CDP = await cdpManager.CDPs(elisa)
    const freddy_CDP = await cdpManager.CDPs(freddy)

    // check that Alice's CDP remains active
    assert.equal(alice_CDP[3], 1)
    assert.isTrue(await sortedCDPs.contains(alice))

    // check all other CDPs are closed
    assert.equal(bob_CDP[3], 2)
    assert.equal(carol_CDP[3], 2)
    assert.equal(dennis_CDP[3], 2)
    assert.equal(elisa_CDP[3], 2)
    assert.equal(freddy_CDP[3], 2)

    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))
    assert.isFalse(await sortedCDPs.contains(dennis))
    assert.isFalse(await sortedCDPs.contains(elisa))
    assert.isFalse(await sortedCDPs.contains(freddy))
  })
})

contract('Reset chain state', async accounts => { })