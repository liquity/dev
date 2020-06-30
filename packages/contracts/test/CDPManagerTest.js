const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const CDPManagerTester = artifacts.require("./CDPManagerTester.sol")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th = testHelpers.TestHelper
const mv = testHelpers.MoneyValues

contract('CDPManager', async accounts => {
  const _1_Ether = web3.utils.toWei('1', 'ether')
  const _2_Ether = web3.utils.toWei('2', 'ether')
  const _5_Ether = web3.utils.toWei('5', 'ether')
  const _10_Ether = web3.utils.toWei('10', 'ether')
  const _11_Ether = web3.utils.toWei('11', 'ether')
  const _15_Ether = web3.utils.toWei('15', 'ether')
  const _50_Ether = web3.utils.toWei('50', 'ether')
  const _100_Ether = web3.utils.toWei('100', 'ether')

  const _100e18 = web3.utils.toWei('100', 'ether')
  const _150e18 = web3.utils.toWei('150', 'ether')
  const _180e18 = web3.utils.toWei('180', 'ether')
  const _200e18 = web3.utils.toWei('200', 'ether')

  const _18_zeros = '000000000000000000'

  const [owner, alice, bob, carol, dennis, erin, flyn, defaulter_1, defaulter_2, whale] = accounts;
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

  let cdpManagerTester

  before(async () => {
    cdpManagerTester = await CDPManagerTester.new()
    CDPManagerTester.setAsDeployed(cdpManagerTester)
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

    const contractAddresses = getAddresses(contracts)
    await connectContracts(contracts, contractAddresses)
  })

  it('liquidate(): closes a CDP that has ICR < MCR', async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: _50_Ether })
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    const price = await priceFeed.getPrice()
    const ICR_Before = web3.utils.toHex(await cdpManager.getCurrentICR(alice, price))
    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    assert.equal(ICR_Before, maxBytes32)

    const MCR = (await cdpManager.MCR()).toString()
    assert.equal(MCR.toString(), '1100000000000000000')

    // Alice withdraws 180 CLV, lowering her ICR to 1.11
    await borrowerOperations.withdrawCLV('180000000000000000000', alice, { from: alice })
    const ICR_AfterWithdrawal = await cdpManager.getCurrentICR(alice, price)
    assert.isAtMost(th.getDifference(ICR_AfterWithdrawal, '1111111111111111111'), 100)

    // price drops to 1ETH:100CLV, reducing Alice's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close CDP
    await cdpManager.liquidate(alice, { from: owner });

    // check the CDP is successfully closed, and removed from sortedList
    const status = (await cdpManager.CDPs(alice))[3]
    assert.equal(status, 2)  // status enum  2 corresponds to "Closed"
    const alice_CDP_isInSortedList = await sortedCDPs.contains(alice)
    assert.isFalse(alice_CDP_isInSortedList)
  })

  it("liquidate(): decreases ActivePool ETH and CLVDebt by correct amounts", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _1_Ether })
    // Alice withdraws 100CLV, Bob withdraws 180CLV
    await borrowerOperations.withdrawCLV('100000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('180000000000000000000', bob, { from: bob })

    // --- TEST ---

    // check ActivePool ETH and CLV debt before
    const activePool_ETH_Before = (await activePool.getETH()).toString()
    const activePool_RawEther_Before = (await web3.eth.getBalance(activePool.address)).toString()
    const activePool_CLVDebt_Before = (await activePool.getCLVDebt()).toString()

    assert.equal(activePool_ETH_Before, _11_Ether)
    assert.equal(activePool_RawEther_Before, _11_Ether)
    assert.equal(activePool_CLVDebt_Before, '280000000000000000000')

    // price drops to 1ETH:100CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    /* close Bob's CDP. Should liquidate his 1 ether and 180CLV, 
    leaving 10 ether and 100 CLV debt in the ActivePool. */
    await cdpManager.liquidate(bob, { from: owner });

    // check ActivePool ETH and CLV debt 
    const activePool_ETH_After = (await activePool.getETH()).toString()
    const activePool_RawEther_After = (await web3.eth.getBalance(activePool.address)).toString()
    const activePool_CLVDebt_After = (await activePool.getCLVDebt()).toString()

    assert.equal(activePool_ETH_After, _10_Ether)
    assert.equal(activePool_RawEther_After, _10_Ether)
    assert.equal(activePool_CLVDebt_After, '100000000000000000000')
  })

  it("liquidate(): increases DefaultPool ETH and CLV debt by correct amounts", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _1_Ether })

    await borrowerOperations.withdrawCLV('1000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('180000000000000000000', bob, { from: bob })

    // --- TEST ---

    // check DefaultPool ETH and CLV debt before
    const defaultPool_ETH_Before = (await defaultPool.getETH())
    const defaultPool_RawEther_Before = (await web3.eth.getBalance(defaultPool.address)).toString()
    const defaultPool_CLVDebt_Before = (await defaultPool.getCLVDebt()).toString()

    assert.equal(defaultPool_ETH_Before, '0')
    assert.equal(defaultPool_RawEther_Before, '0')
    assert.equal(defaultPool_CLVDebt_Before, '0')

    // price drops to 1ETH:100CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Bob's CDP
    await cdpManager.liquidate(bob, { from: owner });

    // check after
    const defaultPool_ETH_After = (await defaultPool.getETH()).toString()
    const defaultPool_RawEther_After = (await web3.eth.getBalance(defaultPool.address)).toString()
    const defaultPool_CLVDebt_After = (await defaultPool.getCLVDebt()).toString()

    assert.equal(defaultPool_ETH_After, _1_Ether)
    assert.equal(defaultPool_RawEther_After, _1_Ether)
    assert.equal(defaultPool_CLVDebt_After, '180000000000000000000')
  })

  it("liquidate(): removes the CDP's stake from the total stakes", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _1_Ether })

    await borrowerOperations.withdrawCLV('1000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('180000000000000000000', bob, { from: bob })

    // --- TEST ---

    // check totalStakes before
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()
    assert.equal(totalStakes_Before, _11_Ether)

    // price drops to 1ETH:100CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Bob's CDP
    await cdpManager.liquidate(bob, { from: owner });

    // check totalStakes after
    const totalStakes_After = (await cdpManager.totalStakes()).toString()
    assert.equal(totalStakes_After, _10_Ether)
  })

  it("liquidate(): Removes the correct trove from the CDPOwners array, and moves the last array element to the new empty slot", async () => {
    // --- SETUP --- 
    const price = await priceFeed.getPrice()
    await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._100e18, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._100e18, carol, { from: carol, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._100e18, dennis, { from: dennis, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._100e18, erin, { from: erin, value: mv._1_Ether })

    // At this stage, CDPOwners array should be: [W, A, B, C, D, E] 

    // Drop price
    await priceFeed.setPrice(mv._1e18)

    const arrayLength_Before = await cdpManager.getCDPOwnersCount()
    assert.equal(arrayLength_Before, 6)

    // Liquidate carol
    await cdpManager.liquidate(carol)

    // Check Carol no longer has an active trove
    assert.isFalse(await sortedCDPs.contains(carol))

    // Check length of array has decreased by 1
    const arrayLength_After = await cdpManager.getCDPOwnersCount()
    assert.equal(arrayLength_After, 5)

    /* After Carol is removed from array, the last element (Erin's address) should have been moved to fill 
    the empty slot left by Carol, and the array length decreased by one.  The final CDPOwners array should be:
  
    [W, A, B, E, D] 

    Check all remaining troves in the array are in the correct order */
    const trove_0 = await cdpManager.CDPOwners(0)
    const trove_1 = await cdpManager.CDPOwners(1)
    const trove_2 = await cdpManager.CDPOwners(2)
    const trove_3 = await cdpManager.CDPOwners(3)
    const trove_4 = await cdpManager.CDPOwners(4)

    assert.equal(trove_0, whale)
    assert.equal(trove_1, alice)
    assert.equal(trove_2, bob)
    assert.equal(trove_3, erin)
    assert.equal(trove_4, dennis)

    // Check correct indices recorded on the active trove structs
    const whale_arrayIndex = (await cdpManager.CDPs(whale))[4]
    const alice_arrayIndex = (await cdpManager.CDPs(alice))[4]
    const bob_arrayIndex = (await cdpManager.CDPs(bob))[4]
    const dennis_arrayIndex = (await cdpManager.CDPs(dennis))[4]
    const erin_arrayIndex = (await cdpManager.CDPs(erin))[4]

    // [W, A, B, E, D] 
    assert.equal(whale_arrayIndex, 0)
    assert.equal(alice_arrayIndex, 1)
    assert.equal(bob_arrayIndex, 2)
    assert.equal(erin_arrayIndex, 3)
    assert.equal(dennis_arrayIndex, 4)
  })


  it("liquidate(): updates the snapshots of total stakes and total collateral", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _1_Ether })

    await borrowerOperations.withdrawCLV('1000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('180000000000000000000', bob, { from: bob })

    // --- TEST ---

    // check snapshots before 
    const totalStakesSnapshot_Before = (await cdpManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_Before = (await cdpManager.totalCollateralSnapshot()).toString()
    assert.equal(totalStakesSnapshot_Before, '0')
    assert.equal(totalCollateralSnapshot_Before, '0')

    // price drops to 1ETH:100CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Bob's CDP.  His 1 ether and 180 CLV should be added to the DefaultPool.
    await cdpManager.liquidate(bob, { from: owner });

    /* check snapshots after. Total stakes should be equal to the only remaining stake then the system: 
    10 ether, Alice's stake.
     
    Total collateral should be equal to Alice's collateral (10 ether) plus her pending ETH reward (1 ether), earned
    from the liquidation of Bob's CDP */
    const totalStakesSnapshot_After = (await cdpManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_After = (await cdpManager.totalCollateralSnapshot()).toString()

    assert.equal(totalStakesSnapshot_After, _10_Ether)
    assert.equal(totalCollateralSnapshot_After, _11_Ether)
  })

  it("liquidate(): updates the L_ETH and L_CLVDebt reward-per-unit-staked totals", async () => {
    // --- SETUP ---
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _10_Ether })
    await borrowerOperations.addColl(carol, carol, { from: carol, value: _1_Ether })

    // Carol withdraws 180CLV, lowering her ICR to 1.11
    await borrowerOperations.withdrawCLV('180000000000000000000', carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carols's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Carol's CDP.  
    await cdpManager.liquidate(carol, { from: owner });

    /* Alice and Bob have the only active stakes. totalStakes in the system is (10 + 10) = 20 ether.
    
    Carol's 1 ether and 180 CLV should be added to the DefaultPool. The system rewards-per-unit-staked should now be:
    
    L_ETH = (1 / 20) = 0.05 ETH
    L_CLVDebt = (180 / 20) = 9 CLV */
    const L_ETH_AfterCarolLiquidated = await cdpManager.L_ETH()
    const L_CLVDebt_AfterCarolLiquidated = await cdpManager.L_CLVDebt()

    assert.isAtMost(th.getDifference(L_ETH_AfterCarolLiquidated, '50000000000000000'), 100)
    assert.isAtMost(th.getDifference(L_CLVDebt_AfterCarolLiquidated, '9000000000000000000'), 100)

    // Bob now withdraws 800 CLV, bringing his ICR to 1.11
    await borrowerOperations.withdrawCLV('800000000000000000000', bob, { from: bob })

    // price drops to 1ETH:50CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice('50000000000000000000');

    // close Bob's CDP 
    await cdpManager.liquidate(bob, { from: owner });

    /* Alice now has the only active stake. totalStakes in the system is now 10 ether.
   
   Bob's pending collateral reward (10 * 0.05 = 0.5 ETH) and debt reward (10 * 9 = 90 CLV) are applied to his CDP
   before his liquidation.
   His total collateral (10 + 0.5 = 10.5 ETH) and debt (800 + 90 = 890 CLV) are then added to the DefaultPool. 
   
   The system rewards-per-unit-staked should now be:
   
   L_ETH = (1 / 20) + (10.5  / 10) = 1.10 ETH
   L_CLVDebt = (180 / 20) + (890 / 10) = 98 CLV */
    const L_ETH_AfterBobLiquidated = await cdpManager.L_ETH()
    const L_CLVDebt_AfterBobLiquidated = await cdpManager.L_CLVDebt()
    assert.isAtMost(th.getDifference(L_ETH_AfterBobLiquidated, '1100000000000000000'), 100)
    assert.isAtMost(th.getDifference(L_CLVDebt_AfterBobLiquidated, '98000000000000000000'), 100)
  })

  it("liquidate(): Liquidates undercollateralized trove if there are two troves in the system", async () => {
    await borrowerOperations.openLoan(mv._50e18, bob, { from: bob, value: mv._100_Ether })

    // Alice creates a single trove with 0.5 ETH and a debt of 50 LQTY,  and provides 10 CLV to SP
    await borrowerOperations.openLoan(mv._50e18, alice, { from: alice, value: mv._5e17 })
    await poolManager.provideToSP(mv._10e18, { from: alice })

    // Alice proves 10 CLV to SP
    await poolManager.provideToSP(mv._10e18, { from: alice })

    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Set ETH:USD price to 105
    await priceFeed.setPrice('105000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isFalse(await cdpManager.checkRecoveryMode())

    const alice_ICR = (await cdpManager.getCurrentICR(alice, price)).toString()
    assert.equal(alice_ICR, '1050000000000000000')

    const activeTrovesCount_Before = await cdpManager.getCDPOwnersCount()

    assert.equal(activeTrovesCount_Before, 2)

    // Liquidate the trove
    await cdpManager.liquidate(alice, { from: owner })

    // Check Alice's trove is removed, and bob remains
    const activeTrovesCount_After = await cdpManager.getCDPOwnersCount()
    assert.equal(activeTrovesCount_After, 1)

    const alice_isInSortedList = await sortedCDPs.contains(alice)
    assert.isFalse(alice_isInSortedList)

    const bob_isInSortedList = await sortedCDPs.contains(bob)
    assert.isTrue(bob_isInSortedList)
  })

  it("liquidate(): reverts if trove is non-existent", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._100e18, bob, { from: bob, value: mv._10_Ether })

    assert.equal(await cdpManager.getCDPStatus(carol), 0) // check trove non-existent

    assert.isFalse(await sortedCDPs.contains(carol))

    try {
      const txCarol = await cdpManager.liquidate(carol)

      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }
  })

  it("liquidate(): reverts if trove has been closed", async () => {
    await borrowerOperations.openLoan(0, alice, { from: alice, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._180e18, bob, { from: bob, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._100e18, carol, { from: carol, value: mv._1_Ether })

    assert.isTrue(await sortedCDPs.contains(carol))

    // price drops, Carol ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Carol liquidated, and her trove is closed
    const txCarol_L1 = await cdpManager.liquidate(carol)
    assert.isTrue(txCarol_L1.receipt.status)

    assert.isFalse(await sortedCDPs.contains(carol))

    assert.equal(await cdpManager.getCDPStatus(carol), 2)  // check trove closed

    try {
      const txCarol_L2 = await cdpManager.liquidate(carol)

      assert.isFalse(txCarol_L2.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }
  })

  it("liquidate(): does nothing if trove has >= 110% ICR", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._180e18, bob, { from: bob, value: mv._10_Ether })
   
    const TCR_Before = (await poolManager.getTCR()).toString()
    const listSize_Before = (await sortedCDPs.getSize()).toString()

    // Attempt to liquidate bob
    await cdpManager.liquidate(bob)

    // check bob active, check whale active
    assert.isTrue((await sortedCDPs.contains(bob)))
    assert.isTrue((await sortedCDPs.contains(whale)))

    const TCR_After = (await poolManager.getTCR()).toString()
    const listSize_After = (await sortedCDPs.getSize()).toString()
   
    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
  })

  it("liquidate(): does not affect the SP deposit or ETH gain when called on an SP depositor's address that has no trove", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._100e18, carol, { from: carol, value: mv._1_Ether })

    // Bob sends tokens to Dennis, who has no trove
    await clvToken.transfer(dennis, mv._200e18, {from: bob})

    //Dennis provides 200 CLV to SP
    await poolManager.provideToSP(mv._200e18, {from: dennis})

    // Carol gets liquidated
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(carol)

    // Check Dennis' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const dennis_Deposit_Before = (await poolManager.getCompoundedCLVDeposit(dennis)).toString()
    const dennis_ETHGain_Before = (await poolManager.getCurrentETHGain(dennis)).toString()
    assert.isAtMost(th.getDifference(dennis_Deposit_Before, mv._100e18), 1000)
    assert.isAtMost(th.getDifference(dennis_ETHGain_Before, mv._1_Ether), 1000)

    // Attempt to liquidate Dennis
    try {
      const txDennis = await cdpManager.liquidate(dennis)
      assert.isFalse(txDennis.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }

    // Check Dennis' SP deposit does not change after liquidation attempt
    const dennis_Deposit_After = (await poolManager.getCompoundedCLVDeposit(dennis)).toString()
    const dennis_ETHGain_After = (await poolManager.getCurrentETHGain(dennis)).toString()
    assert.equal(dennis_Deposit_Before, dennis_Deposit_After)
    assert.equal(dennis_ETHGain_Before, dennis_ETHGain_After)
  })

  it("liquidate(): does not liquidate a SP depositor's trove with ICR > 110%, and does not affect their SP deposit or ETH gain", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._100e18, carol, { from: carol, value: mv._1_Ether })

    //Bob provides 200 CLV to SP
    await poolManager.provideToSP(mv._200e18, {from: bob})

    // Carol gets liquidated
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(carol)

    // price bounces back - Bob's trove is >110% ICR again
    await priceFeed.setPrice(mv._200e18)

    // Check Bob' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const bob_Deposit_Before = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
    const bob_ETHGain_Before = (await poolManager.getCurrentETHGain(bob)).toString()
    assert.isAtMost(th.getDifference(bob_Deposit_Before, mv._100e18), 1000)
    assert.isAtMost(th.getDifference(bob_ETHGain_Before, mv._1_Ether), 1000)

    // Attempt to liquidate Bob
    await cdpManager.liquidate(bob)

    // Confirm Bob's trove is still active
    assert.isTrue(await sortedCDPs.contains(bob))
  
    // Check Bob' SP deposit does not change after liquidation attempt
    const bob_Deposit_After = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
    const bob_ETHGain_After = (await poolManager.getCurrentETHGain(bob)).toString()
    assert.equal(bob_Deposit_Before, bob_Deposit_After)
    assert.equal(bob_ETHGain_Before, bob_ETHGain_After)
  })
  
  it("liquidate(): liquidates a SP depositor's trove with ICR < 110%, and the liquidation correctly impacts their SP deposit and ETH gain", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._300e18, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._100e18, carol, { from: carol, value: mv._1_Ether })

    //Bob provides 200 CLV to SP
    await poolManager.provideToSP(mv._200e18, {from: bob})

    // Carol gets liquidated
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(carol)

    // Check Bob' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const bob_Deposit_Before = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
    const bob_ETHGain_Before = (await poolManager.getCurrentETHGain(bob)).toString()
    assert.isAtMost(th.getDifference(bob_Deposit_Before, mv._100e18), 1000)
    assert.isAtMost(th.getDifference(bob_ETHGain_Before, mv._1_Ether), 1000)

    // Alice provides 300 CLV to SP
    await poolManager.provideToSP(mv._300e18, {from: alice})

    // Liquidate Bob. 200 CLV and 2 ETH is liquidated
    await cdpManager.liquidate(bob)

    // Confirm Bob's trove has been closed
    assert.isFalse(await sortedCDPs.contains(bob))
    const bob_Trove_Status = ((await cdpManager.CDPs(bob))[3]).toString()
    assert.equal(bob_Trove_Status, 2) // check closed
  
    /* Alice's CLV Loss = (300 / 400) * 200 = 150 CLV
       Alice's ETH gain = (300 / 400) * 2 = 1.5 ETH

       Bob's CLVLoss = (300 / 400) * 200 = 50 CLV
       Bob's ETH gain = (300 / 400) * 2 = 0.5 ETH

     Check Bob' SP deposit has been reduced to 50 CLV, and his ETH gain has increased to 1.5 ETH. */
    const bob_Deposit_After = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
    const bob_ETHGain_After =(await poolManager.getCurrentETHGain(bob)).toString()

    assert.isAtMost(th.getDifference(bob_Deposit_After, mv._50e18), 1000)
    assert.isAtMost(th.getDifference(bob_ETHGain_After, '1500000000000000000'), 1000)
  })

  it("liquidate(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await borrowerOperations.openLoan(mv._50e18, alice, { from: alice, value: mv._1_Ether })  
    await borrowerOperations.openLoan('90500000000000000000', bob, { from: bob, value: mv._1_Ether })  // 90.5 CLV, 1 ETH
    await borrowerOperations.openLoan(mv._100e18, carol, { from: carol, value: mv._1_Ether })

    // Defaulter opens with 30 CLV, 0.3 ETH
    await borrowerOperations.openLoan(mv._30e18, defaulter_1, { from: defaulter_1, value: mv._3e17  })
    
    // Price drops
    await priceFeed.setPrice(mv._100e18)
    const price = await priceFeed.getPrice()

    const alice_ICR_Before = await cdpManager.getCurrentICR(alice, price)
    const bob_ICR_Before = await cdpManager.getCurrentICR(bob, price)
    const carol_ICR_Before = await cdpManager.getCurrentICR(carol, price)

    /* Before liquidation: 
    Alice ICR: = (1 * 100 / 50) = 200%
    Bob ICR: (1 * 100 / 90.5) = 110.5%
    Carol ICR: (1 * 100 / 100 ) =  100%

    Therefore Alice and Bob above the MCR, Carol is below */
    assert.isTrue(alice_ICR_Before.gte(mv._MCR))
    assert.isTrue(bob_ICR_Before.gte(mv._MCR))
    assert.isTrue(carol_ICR_Before.lte(mv._MCR))  

    // Liquidate defaulter. 30 CLV and 0.3 ETH is distributed uniformly between A, B and C. Each receive 10 CLV, 0.1 ETH
    await cdpManager.liquidate(defaulter_1)

    const alice_ICR_After = await cdpManager.getCurrentICR(alice, price)
    const bob_ICR_After = await cdpManager.getCurrentICR(bob, price)
    const carol_ICR_After = await cdpManager.getCurrentICR(carol, price)
   
    /* After liquidation: 

    Alice ICR: (1.1 * 100 / 60) = 183.33%
    Bob ICR:(1.1 * 100 / 100.5) =  109.45%
    Carol ICR: (1.1 * 100 ) 100%

    Check Alice is above MCR, Bob below, Carol below. */
    assert.isTrue(alice_ICR_After.gte(mv._MCR))
    assert.isTrue(bob_ICR_After.lte(mv._MCR))
    assert.isTrue(carol_ICR_After.lte(mv._MCR)) 

    /* Though Bob's true ICR (including pending rewards) is below the MCR, check that Bob's raw coll and debt has not changed */
    const bob_Coll = (await cdpManager.CDPs(bob))[1]
    const bob_Debt = (await cdpManager.CDPs(bob))[0]

    const bob_rawICR = bob_Coll.mul(mv._100e18BN).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))
    
    // Whale enters system, pulling it into Normal Mode
    await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._10_Ether })

    //liquidate A, B, C
    await cdpManager.liquidate(alice)
    await cdpManager.liquidate(bob)
    await cdpManager.liquidate(carol)

    // Check A stays active, B and C get liquidated
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))

    // check trove statuses - A active (1),  B and C closed (2)
    assert.equal((await cdpManager.CDPs(alice))[3].toString(), '1')
    assert.equal((await cdpManager.CDPs(bob))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(carol))[3].toString(), '2')
  })


  it('liquidateCDPs(): closes every CDP with ICR < MCR', async () => {
    // --- SETUP ---

    // create 3 CDPs
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _1_Ether })
    await borrowerOperations.addColl(carol, carol, { from: carol, value: _1_Ether })

    // alice withdraws only 1 CLV. Bob and Carol each withdraw 180 CLV, lowering their ICR to 1.11
    await borrowerOperations.withdrawCLV('1000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('180000000000000000000', bob, { from: bob })
    await borrowerOperations.withdrawCLV('180000000000000000000', carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Bob and Carols's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    await cdpManager.liquidateCDPs(10, { from: owner });

    const alice_CDP_status = (await cdpManager.CDPs(alice))[3]
    const bob_CDP_status = (await cdpManager.CDPs(bob))[3]
    const carol_CDP_status = (await cdpManager.CDPs(carol))[3]

    /* Now, Alice has received 2 ETH and 360 CLV in rewards from liquidations.

    Her ICR, at price 1ETH:200CLV, should be (12 ETH * 200 / 361 CLV) = 664.82%. Thus her CDP should still be active. */

    // check Alice's CDP is still active
    assert.equal(alice_CDP_status, 1)

    // check Bob and Carol's CDP status is closed
    assert.equal(bob_CDP_status, 2)
    assert.equal(carol_CDP_status, 2)

    const alice_CDP_isInSortedList = await sortedCDPs.contains(alice)
    const bob_CDP_isInSortedList = await sortedCDPs.contains(bob)
    const carol_CDP_isInSortedList = await sortedCDPs.contains(carol)

    // check Alice's CDP is still in the sortedList
    assert.isTrue(alice_CDP_isInSortedList)

    // check Bob and Carol's CDPs have been removed from sortedList
    assert.isFalse(bob_CDP_isInSortedList)
    assert.isFalse(carol_CDP_isInSortedList)
  })

  it('liquidateCDPs(): liquidates only up to the requested number of undercollateralized troves', async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

    // --- SETUP --- 
    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await borrowerOperations.openLoan('105000000000000000000', alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan('104000000000000000000', bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan('103000000000000000000', carol, { from: carol, value: mv._1_Ether })
    await borrowerOperations.openLoan('102000000000000000000', dennis, { from: dennis, value: mv._1_Ether })
    await borrowerOperations.openLoan('101000000000000000000', erin, { from: erin, value: mv._1_Ether })

    // --- TEST --- 

    // Price drops
    await priceFeed.setPrice(mv._100e18)

    await cdpManager.liquidateCDPs(3)

    const CDPOwnersArrayLength = await cdpManager.getCDPOwnersCount()
    assert.equal(CDPOwnersArrayLength, '3')

    // Check Alice, Bob, Carol troves have been closed
    const aliceCDPStatus = (await cdpManager.getCDPStatus(alice)).toString()
    const bobCDPStatus = (await cdpManager.getCDPStatus(bob)).toString()
    const carolCDPStatus = (await cdpManager.getCDPStatus(carol)).toString()

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
    const dennisCDPStatus = (await cdpManager.getCDPStatus(dennis)).toString()
    const erinCDPStatus = (await cdpManager.getCDPStatus(erin)).toString()

    assert.equal(dennisCDPStatus, '1')
    assert.equal(erinCDPStatus, '1')

    // Check Dennis, Erin still in sorted list
    const dennis_isInSortedList = await sortedCDPs.contains(dennis)
    const erin_isInSortedList = await sortedCDPs.contains(erin)

    assert.isTrue(dennis_isInSortedList)
    assert.isTrue(erin_isInSortedList)
  })

  it('getRedemptionHints(): gets the address of the first CDP and the final ICR of the last CDP involved in a redemption', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan('10' + _18_zeros, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.openLoan('20' + _18_zeros, bob, { from: bob, value: _1_Ether })
    await borrowerOperations.openLoan('30' + _18_zeros, carol, { from: carol, value: _1_Ether })
    // Dennis' CDP should be untouched by redemption, because its ICR will be < 110% after the price drop
    await borrowerOperations.openLoan('180' + _18_zeros, dennis, { from: dennis, value: _1_Ether })

    // Drop the price
    const price = '100' + _18_zeros
    await priceFeed.setPrice(price);

    // --- TEST ---
    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await cdpManager.getRedemptionHints('55' + _18_zeros, price)

    assert.equal(firstRedemptionHint, carol)
    assert.equal(partialRedemptionHintICR, '19' + _18_zeros)
  });

  it('redeemCollateral(): cancels the provided CLV with debt from CDPs with the lowest ICRs and sends an equivalent amount of Ether', async () => {
    // --- SETUP ---

    await borrowerOperations.openLoan('5' + _18_zeros, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.openLoan('8' + _18_zeros, bob, { from: bob, value: _1_Ether })
    await borrowerOperations.openLoan('10' + _18_zeros, carol, { from: carol, value: _1_Ether })
    // start Dennis with a high ICR
    await borrowerOperations.openLoan('150' + _18_zeros, dennis, { from: dennis, value: _100_Ether })

    const dennis_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(dennis))

    const dennis_CLVBalance_Before = await clvToken.balanceOf(dennis)
    assert.equal(dennis_CLVBalance_Before, '150' + _18_zeros)

    const price = await priceFeed.getPrice()
    assert.equal(price, '200' + _18_zeros)

    // --- TEST --- 

    // Find hints for redeeming 20 CLV
    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await cdpManager.getRedemptionHints('20' + _18_zeros, price)

    // We don't need to use getApproxHint for this test, since it's not the subject of this
    // test case, and the list is very small, so the correct position is quickly found
    const { 0: partialRedemptionHint } = await sortedCDPs.findInsertPosition(
      partialRedemptionHintICR,
      price,
      dennis,
      dennis
    )

    // Dennis redeems 20 CLV
    // Don't pay for gas, as it makes it easier to calculate the received Ether
    await cdpManager.redeemCollateral(
      '20' + _18_zeros,
      firstRedemptionHint,
      partialRedemptionHint,
      partialRedemptionHintICR,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const bob_CDP_After = await cdpManager.CDPs(bob)
    const carol_CDP_After = await cdpManager.CDPs(carol)

    const alice_debt_After = alice_CDP_After[0].toString()
    const bob_debt_After = bob_CDP_After[0].toString()
    const carol_debt_After = carol_CDP_After[0].toString()

    /* check that Dennis' redeemed 20 CLV has been cancelled with debt from Bobs's CDP (8) and Carol's CDP (10).
    The remaining lot (2) is sent to Alice's CDP, who had the best ICR.
    It leaves her with (3) CLV debt. */
    assert.equal(alice_debt_After, '3' + _18_zeros)
    assert.equal(bob_debt_After, '0')
    assert.equal(carol_debt_After, '0')

    const dennis_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)
    assert.equal(receivedETH, web3.utils.toWei('0.1', 'ether'))

    const dennis_CLVBalance_After = (await clvToken.balanceOf(dennis)).toString()
    assert.equal(dennis_CLVBalance_After, '130' + _18_zeros)
  })

  it('redeemCollateral(): ends the redemption sequence when the token redemption request has been filled', async () => {
    // --- SETUP --- 
    const price = await priceFeed.getPrice()
    await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await borrowerOperations.openLoan(mv._20e18, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._20e18, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._20e18, carol, { from: carol, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._10e18, dennis, { from: dennis, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._10e18, erin, { from: erin, value: mv._1_Ether })

    // --- TEST --- 

    // open loan from redeemer.  Redeemer has highest ICR (100ETH, 100 CLV), 20000%
    await borrowerOperations.openLoan(mv._100e18, flyn, { from: flyn, value: mv._100_Ether })

    // Flyn redeems collateral
    await cdpManager.redeemCollateral(mv._60e18, alice, alice, 0, { from: flyn })

    // Check Flyn's redemption has reduced his balance from 100 to (100-60) = 40 CLV
    const flynBalance = (await clvToken.balanceOf(flyn)).toString()
    assert.equal(flynBalance, mv._40e18)

    // Check debt of Alice, Bob, Carol
    const alice_Debt = await cdpManager.getCDPDebt(alice)
    const bob_Debt = await cdpManager.getCDPDebt(bob)
    const carol_Debt = await cdpManager.getCDPDebt(carol)

    assert.equal(alice_Debt, 0)
    assert.equal(bob_Debt, 0)
    assert.equal(carol_Debt, 0)

    // Check ICR of Alice, Bob, Carol
    const alice_ICR = web3.utils.toHex(await cdpManager.getCurrentICR(alice, price))
    const bob_ICR = web3.utils.toHex(await cdpManager.getCurrentICR(bob, price))
    const carol_ICR = web3.utils.toHex(await cdpManager.getCurrentICR(carol, price))

    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    assert.equal(alice_ICR, maxBytes32)
    assert.equal(bob_ICR, maxBytes32)
    assert.equal(carol_ICR, maxBytes32)

    // check debt and coll of Dennis, Erin has not been impacted by redemption
    const dennis_Debt = await cdpManager.getCDPDebt(dennis)
    const erin_Debt = await cdpManager.getCDPDebt(erin)

    assert.equal(dennis_Debt, mv._10e18)
    assert.equal(erin_Debt, mv._10e18)

    const dennis_Coll = await cdpManager.getCDPColl(dennis)
    const erin_Coll = await cdpManager.getCDPColl(erin)

    assert.equal(dennis_Coll, mv._1_Ether)
    assert.equal(erin_Coll, mv._1_Ether)
  })

  it('redeemCollateral(): performs a partial redemption if the hint has gotten out-of-date', async () => {
    // --- SETUP ---

    await borrowerOperations.openLoan('5' + _18_zeros, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.openLoan('8' + _18_zeros, bob, { from: bob, value: _1_Ether })
    await borrowerOperations.openLoan('10' + _18_zeros, carol, { from: carol, value: _1_Ether })
    await borrowerOperations.openLoan('150' + _18_zeros, dennis, { from: dennis, value: _100_Ether })

    const dennis_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(dennis))

    const dennis_CLVBalance_Before = await clvToken.balanceOf(dennis)
    assert.equal(dennis_CLVBalance_Before, '150' + _18_zeros)

    const price = await priceFeed.getPrice()
    assert.equal(price, '200' + _18_zeros)

    // --- TEST --- 

    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await cdpManager.getRedemptionHints('20' + _18_zeros, price)

    const { 0: partialRedemptionHint } = await sortedCDPs.findInsertPosition(
      partialRedemptionHintICR,
      price,
      dennis,
      dennis
    )

    // Oops, another transaction gets in the way
    {
      const {
        firstRedemptionHint,
        partialRedemptionHintICR
      } = await cdpManager.getRedemptionHints('1' + _18_zeros, price)

      const { 0: partialRedemptionHint } = await sortedCDPs.findInsertPosition(
        partialRedemptionHintICR,
        price,
        dennis,
        dennis
      )

      // Alice redeems 1 CLV from Carol's CDP
      await cdpManager.redeemCollateral(
        '1' + _18_zeros,
        firstRedemptionHint,
        partialRedemptionHint,
        partialRedemptionHintICR,
        { from: alice }
      )
    }

    // Dennis tries to redeem 20 CLV
    await cdpManager.redeemCollateral(
      '20' + _18_zeros,
      firstRedemptionHint,
      partialRedemptionHint,
      partialRedemptionHintICR,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    // Since Alice already redeemed 1 CLV from Carol's CDP, Dennis was only able to redeem:
    //  - 9 CLV from Carol's
    //  - 8 CLV from Bob's
    // for a total of 17 CLV.

    // Dennis calculated his hint for redeeming 2 CLV from Alice's CDP, but after Alice's transaction
    // got in the way, he would have needed to redeem 3 CLV to fully complete his redemption of 20 CLV.
    // This would have required a different hint, therefore he ended up with a partial redemption.

    const dennis_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)
    assert.equal(receivedETH, web3.utils.toWei('0.085', 'ether'))

    const dennis_CLVBalance_After = (await clvToken.balanceOf(dennis)).toString()
    assert.equal(dennis_CLVBalance_After, '133' + _18_zeros)
  })

  it("redeemCollateral(): can redeem even if there's no active debt", async () => {
    // --- SETUP ---

    await borrowerOperations.openLoan('0', alice, { from: alice, value: _10_Ether })
    await borrowerOperations.openLoan('100' + _18_zeros, bob, { from: bob, value: _1_Ether })

    await clvToken.transfer(carol, '100' + _18_zeros, { from: bob })

    const price = '100' + _18_zeros
    await priceFeed.setPrice(price)

    // Liquidate Bob's CDP
    await cdpManager.liquidateCDPs(1)

    // --- TEST --- 

    const carol_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(carol))

    await cdpManager.redeemCollateral(
      '100' + _18_zeros,
      alice,
      '0x0000000000000000000000000000000000000000',
      0,
      {
        from: carol,
        gasPrice: 0
      }
    )

    const carol_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(carol))
    const receivedETH = carol_ETHBalance_After.sub(carol_ETHBalance_Before)
    assert.equal(receivedETH, '1' + _18_zeros)

    const carol_CLVBalance_After = (await clvToken.balanceOf(carol)).toString()
    assert.equal(carol_CLVBalance_After, '0')
  })

  it("redeemCollateral(): doesn't touch CDPs with ICR < 110%", async () => {
    // --- SETUP ---

    await borrowerOperations.openLoan('100' + _18_zeros, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.openLoan('100' + _18_zeros, bob, { from: bob, value: _1_Ether })

    await clvToken.transfer(carol, '100' + _18_zeros, { from: bob })

    // Put Bob's CDP below 110% ICR
    const price = '100' + _18_zeros
    await priceFeed.setPrice(price)

    // --- TEST --- 

    await cdpManager.redeemCollateral(
      '100' + _18_zeros,
      bob,
      '0x0000000000000000000000000000000000000000',
      0,
      { from: carol }
    );

    // Alice's CDP was cleared of debt
    const { debt: alice_Debt_After } = await cdpManager.CDPs(alice)
    assert.equal(alice_Debt_After, '0')

    // Bob's CDP was left untouched
    const { debt: bob_Debt_After } = await cdpManager.CDPs(bob)
    assert.equal(bob_Debt_After, '100' + _18_zeros)
  });

  it("redeemCollateral(): finds the last CDP with ICR == 110% even if there is more than one", async () => {
    // --- SETUP ---

    await borrowerOperations.openLoan('100' + _18_zeros, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.openLoan('100' + _18_zeros, bob, { from: bob, value: _1_Ether })
    await borrowerOperations.openLoan('100' + _18_zeros, carol, { from: carol, value: _1_Ether })
    await borrowerOperations.openLoan('101' + _18_zeros, dennis, { from: dennis, value: _1_Ether })

    await clvToken.transfer(dennis, '100' + _18_zeros, { from: alice })
    await clvToken.transfer(dennis, '100' + _18_zeros, { from: bob })
    await clvToken.transfer(dennis, '100' + _18_zeros, { from: carol })

    // This will put Dennis slightly below 110%, and everyone else exactly at 110%
    const price = '110' + _18_zeros
    await priceFeed.setPrice(price)

    const orderOfCDPs = [];
    let current = await sortedCDPs.getFirst();

    while (current !== '0x0000000000000000000000000000000000000000') {
      orderOfCDPs.push(current);
      current = await sortedCDPs.getNext(current);
    }

    assert.deepEqual(orderOfCDPs, [carol, bob, alice, dennis]);

    // --- TEST --- 

    await cdpManager.redeemCollateral(
      '300' + _18_zeros,
      carol, // try to trick redeemCollateral by passing a hint that doesn't exactly point to the
      // last CDP with ICR == 110% (which would be Alice's)
      '0x0000000000000000000000000000000000000000',
      0,
      { from: dennis }
    );

    const { debt: alice_Debt_After } = await cdpManager.CDPs(alice)
    assert.equal(alice_Debt_After, '0')

    const { debt: bob_Debt_After } = await cdpManager.CDPs(bob)
    assert.equal(bob_Debt_After, '0')

    const { debt: carol_Debt_After } = await cdpManager.CDPs(carol)
    assert.equal(carol_Debt_After, '0')

    const { debt: dennis_Debt_After } = await cdpManager.CDPs(dennis)
    assert.equal(dennis_Debt_After, '101' + _18_zeros)
  });


  it("getPendingCLVDebtReward(): Returns 0 if there is no pending CLVDebt reward", async () => {
    // make some loans
    const price = await priceFeed.getPrice()
    await borrowerOperations.openLoan(mv._2000e18, whale, { from: whale, value: mv._100_Ether })
    await poolManager.provideToSP(mv._2000e18, { from: whale })

    await borrowerOperations.openLoan(mv._100e18, defaulter_1, { from: defaulter_1, value: mv._1_Ether })

    await borrowerOperations.openLoan(mv._20e18, carol, { from: carol, value: mv._1_Ether })

    // Price drops
    await priceFeed.setPrice(mv._100e18)

    await cdpManager.liquidate(defaulter_1)

    // Confirm defaulter_1 liquidated
    assert.isFalse(await sortedCDPs.contains(defaulter_1))

    // Confirm there are no pending rewards from liquidation
    const current_L_CLVDebt = await cdpManager.L_CLVDebt()
    assert.equal(current_L_CLVDebt, 0)

    const carolSnapshot_L_CLVDebt = (await cdpManager.rewardSnapshots(carol))[1]
    assert.equal(carolSnapshot_L_CLVDebt, 0)

    const carol_PendingCLVDebtReward = await cdpManager.getPendingCLVDebtReward(carol)
    assert.equal(carol_PendingCLVDebtReward, 0)
  })

  it("getPendingETHReward(): Returns 0 if there is no pending ETH reward", async () => {
    // make some loans
    const price = await priceFeed.getPrice()
    await borrowerOperations.openLoan(mv._2000e18, whale, { from: whale, value: mv._100_Ether })
    await poolManager.provideToSP(mv._2000e18, { from: whale })

    await borrowerOperations.openLoan(mv._100e18, defaulter_1, { from: defaulter_1, value: mv._1_Ether })

    await borrowerOperations.openLoan(mv._20e18, carol, { from: carol, value: mv._1_Ether })

    // Price drops
    await priceFeed.setPrice(mv._100e18)

    await cdpManager.liquidate(defaulter_1)

    // Confirm defaulter_1 liquidated
    assert.isFalse(await sortedCDPs.contains(defaulter_1))

    // Confirm there are no pending rewards from liquidation
    const current_L_ETH = await cdpManager.L_ETH()
    assert.equal(current_L_ETH, 0)

    const carolSnapshot_L_ETH = (await cdpManager.rewardSnapshots(carol))[0]
    assert.equal(carolSnapshot_L_ETH, 0)

    const carol_PendingETHReward = await cdpManager.getPendingETHReward(carol)
    assert.equal(carol_PendingETHReward, 0)
  })

  // --- getCurrentICR ---

  it("getCurrentICR(): Returns 2^256-1 if trove has non-zero coll and zero debt", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

    const price = await priceFeed.getPrice()

    const whaleICR = web3.utils.toHex(await cdpManager.getCurrentICR(whale, price))
    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    assert.equal(whaleICR, maxBytes32)
  })

  // --- computeICR ---

  it("computeICR(): Returns 0 if trove's coll is worth 0", async () => {
    const price = 0
    const coll = mv._1_Ether
    const debt = mv._100e18

    const ICR = (await cdpManagerTester.computeICR(coll, debt, price)).toString()
    
    assert.equal(ICR, 0)
  })

  it("computeICR(): Returns 2^256-1 for ETH:USD = 100, coll = 1 ETH, debt = 100 CLV", async () => {
    const price = mv._100e18
    const coll = mv._1_Ether
    const debt = mv._100e18

    const ICR = (await cdpManagerTester.computeICR(coll, debt, price)).toString()
    
    assert.equal(ICR, mv._1e18)
  })

  it("computeICR(): returns correct ICR for ETH:USD = 100, coll = 200 ETH, debt = 30 CLV", async () => {
    const price = mv._100e18
    const coll = mv._200_Ether
    const debt = mv._30e18

    const ICR = (await cdpManagerTester.computeICR(coll, debt, price)).toString()
    
    assert.isAtMost(th.getDifference(ICR, '666666666666666666666'), 1000)
  })

  it("computeICR(): returns correct ICR for ETH:USD = 250, coll = 1350 ETH, debt = 127 CLV", async () => {
    const price = '250000000000000000000'
    const coll = '1350000000000000000000'
    const debt = '127000000000000000000'

    const ICR = (await cdpManagerTester.computeICR(coll, debt, price))
  
    assert.isAtMost(th.getDifference(ICR, '2657480314960630000000'), 1000000)
  })

  it("computeICR(): returns correct ICR for ETH:USD = 100, coll = 1 ETH, debt = 54321 CLV", async () => {
    const price = mv._100e18
    const coll = mv._1_Ether
    const debt = '54321000000000000000000'

    const ICR = (await cdpManagerTester.computeICR(coll, debt, price)).toString()

    assert.isAtMost(th.getDifference(ICR, '1840908672520756'), 1000)
  })

  
  it("computeICR(): Returns 2^256-1 if trove has non-zero coll and zero debt", async () => {
    const price = mv._100e18
    const coll = mv._1_Ether
    const debt = 0

    const ICR = web3.utils.toHex(await cdpManagerTester.computeICR(coll, debt, price))
    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    assert.equal(ICR, maxBytes32)
  })

  // --- checkRecoveryMode ---

  //TCR < 150%
  it("checkRecoveryMode(): Returns true when TCR < 150%", async () => {
    await priceFeed.setPrice(mv._100e18)

    await borrowerOperations.openLoan(mv._200e18, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._3_Ether })

    await priceFeed.setPrice('99999999999999999999')

    const TCR = (await poolManager.getTCR())

    assert.isTrue(TCR.lte(web3.utils.toBN('1500000000000000000')))

    assert.isTrue(await cdpManager.checkRecoveryMode())
  })

  // TCR == 150%
  it("checkRecoveryMode(): Returns false when TCR == 150%", async () => {
    await priceFeed.setPrice(mv._100e18)

    await borrowerOperations.openLoan(mv._200e18, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._3_Ether })

    await priceFeed.setPrice('100000000000000000001')

    const TCR = (await poolManager.getTCR())

    assert.isTrue(TCR.gte(web3.utils.toBN('1500000000000000000')))

    assert.isFalse(await cdpManager.checkRecoveryMode())
  })

  // > 150%
  it("checkRecoveryMode(): Returns false when TCR > 150%", async () => {
    await priceFeed.setPrice(mv._100e18)

    await borrowerOperations.openLoan(mv._200e18, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._3_Ether })

    const TCR = (await poolManager.getTCR()).toString()

    assert.equal(TCR, '1500000000000000000')

    assert.isFalse(await cdpManager.checkRecoveryMode())
  })

  //check max
  it("checkRecoveryMode(): Returns false when TCR == maxBytes32", async () => {
    await priceFeed.setPrice(mv._100e18)

    await borrowerOperations.openLoan(0, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: mv._3_Ether })

    const TCR = web3.utils.toHex(await poolManager.getTCR()).toString()

    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    assert.equal(TCR, maxBytes32)

    assert.isFalse(await cdpManager.checkRecoveryMode())
  })

  // check 0
  it("checkRecoveryMode(): Returns false when TCR == 0", async () => {
    await priceFeed.setPrice(mv._100e18)

    await borrowerOperations.openLoan(mv._200e18, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._3_Ether })

    await priceFeed.setPrice(0)

    const TCR = (await poolManager.getTCR()).toString()

    assert.equal(TCR, 0)

    assert.isTrue(await cdpManager.checkRecoveryMode())
  })
})

contract('Reset chain state', async accounts => { })