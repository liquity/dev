const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const CDPManagerTester = artifacts.require("./CDPManagerTester.sol")

const deployAndConnectHintHelpers = deploymentHelpers.deployAndConnectHintHelpers
const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th = testHelpers.TestHelper
const mv = testHelpers.MoneyValues

const dummyHint = "0x0000000000000000000000000000000000000000"
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


  const [
    owner,
    alice, bob, carol, dennis, erin, flyn, graham, harriet, ida, jake,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4, whale] = accounts;

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

  let contractAddresses

  let cdpManagerTester
  let sizeList_18orLess
  let sizeList_19orGreater

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
    sizeList_18orLess = contracts.sizeList_18orLess
    sizeList_19orGreater = contracts.sizeList_19orGreater

    contractAddresses = getAddresses(contracts)
    await connectContracts(contracts, contractAddresses)
  })

  it('liquidate(): closes a CDP that has ICR < MCR', async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: _50_Ether })
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _1_Ether })

    const price = await priceFeed.getPrice()
    const ICR_Before = web3.utils.toHex(await cdpManager.getCurrentICR(alice, price))
    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    assert.equal(ICR_Before, maxBytes32)

    const MCR = (await cdpManager.MCR()).toString()
    assert.equal(MCR.toString(), '1100000000000000000')

    // Alice withdraws to 180 CLV, lowering her ICR to 1.11
    const withdrawal = th.getDebtMinusVirtual(mv._180e18)
    await borrowerOperations.withdrawCLV(withdrawal, dummyHint, dummyHint, { from: alice })
    const ICR_AfterWithdrawal = await cdpManager.getCurrentICR(alice, price)
    assert.isAtMost(th.getDifference(ICR_AfterWithdrawal, '1111111111111111111'), 100)

    // price drops to 1ETH:100CLV, reducing Alice's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

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
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: _1_Ether })
    // Alice withdraws 100CLV, Bob withdraws 180CLV
    const withdrawalA = th.getDebtMinusVirtual('100000000000000000000')
    const CLVWithdrawal_B = th.getDebtMinusVirtual('180000000000000000000')
    const totalWithdrawn = withdrawalA.add(CLVWithdrawal_B)

    await borrowerOperations.withdrawCLV(withdrawalA, alice, dummyHint, { from: alice })
    await borrowerOperations.withdrawCLV(CLVWithdrawal_B, bob, dummyHint, { from: bob })

    // --- TEST ---

    // check ActivePool ETH and CLV debt before
    const activePool_ETH_Before = (await activePool.getETH()).toString()
    const activePool_RawEther_Before = (await web3.eth.getBalance(activePool.address)).toString()
    const activePool_CLVDebt_Before = (await activePool.getCLVDebt()).toString()

    assert.equal(activePool_ETH_Before, _11_Ether)
    assert.equal(activePool_RawEther_Before, _11_Ether)

    assert.equal(activePool_CLVDebt_Before, totalWithdrawn)

    // price drops to 1ETH:100CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    /* close Bob's CDP. Should liquidate his 1 ether and 170CLV, 
    leaving 10 ether and 100 CLV debt in the ActivePool. */
    await cdpManager.liquidate(bob, { from: owner });

    // check ActivePool ETH and CLV debt 
    const activePool_ETH_After = (await activePool.getETH()).toString()
    const activePool_RawEther_After = (await web3.eth.getBalance(activePool.address)).toString()
    const activePool_CLVDebt_After = (await activePool.getCLVDebt()).toString()

    assert.equal(activePool_ETH_After, _10_Ether)
    assert.equal(activePool_RawEther_After, _10_Ether)
    assert.equal(activePool_CLVDebt_After, withdrawalA)
  })

  it("liquidate(): increases DefaultPool ETH and CLV debt by correct amounts", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: _1_Ether })

    // A withdraws to 100 CLV, B withdraws to 180 CLV
    const withdrawalA = th.getDebtMinusVirtual('100000000000000000000')
    const CLVWithdrawal_B = th.getDebtMinusVirtual('180000000000000000000')
    const totalWithdrawn = withdrawalA.add(CLVWithdrawal_B)

    await borrowerOperations.withdrawCLV(withdrawalA, alice, dummyHint, { from: alice })
    await borrowerOperations.withdrawCLV(CLVWithdrawal_B, bob, dummyHint, { from: bob })

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

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // close Bob's CDP
    const expectedLiquidatedColl_B = await th.getCollMinusGasComp([bob], cdpManager, priceFeed)
    await cdpManager.liquidate(bob, { from: owner });

    // check after
    const defaultPool_ETH_After = (await defaultPool.getETH()).toString()
    const defaultPool_RawEther_After = (await web3.eth.getBalance(defaultPool.address)).toString()
    const defaultPool_CLVDebt_After = (await defaultPool.getCLVDebt()).toString()

    assert.equal(defaultPool_ETH_After, expectedLiquidatedColl_B)
    assert.equal(defaultPool_RawEther_After, expectedLiquidatedColl_B)
    assert.equal(defaultPool_CLVDebt_After, CLVWithdrawal_B)
  })

  it("liquidate(): removes the CDP's stake from the total stakes", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: _1_Ether })

    const withdrawalA = th.getDebtMinusVirtual('100000000000000000000')
    const CLVWithdrawal_B = th.getDebtMinusVirtual('180000000000000000000')
    await borrowerOperations.withdrawCLV(withdrawalA, alice, dummyHint, { from: alice })
    await borrowerOperations.withdrawCLV(CLVWithdrawal_B, bob, dummyHint, { from: bob })

    // --- TEST ---

    // check totalStakes before
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()
    assert.equal(totalStakes_Before, _11_Ether)

    // price drops to 1ETH:100CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Close Bob's CDP
    await cdpManager.liquidate(bob, { from: owner });

    // check totalStakes after
    const totalStakes_After = (await cdpManager.totalStakes()).toString()
    assert.equal(totalStakes_After, _10_Ether)
  })

  it("liquidate(): Removes the correct trove from the allTrovesArray, and moves the last array element to the new empty slot", async () => {
    // --- SETUP --- 
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan('101000000000000000000', bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan('102000000000000000000', carol, carol, { from: carol, value: mv._1_Ether })
    await borrowerOperations.openLoan('103000000000000000000', dennis, dennis, { from: dennis, value: mv._1_Ether })
    await borrowerOperations.openLoan('104000000000000000000', erin, erin, { from: erin, value: mv._1_Ether })

    // At this stage, allTrovesArray should be: [W, A, B, C, D, E] 

    // Drop price
    await priceFeed.setPrice(mv._100e18)

    const arrayLength_Before = await cdpManager.getallTrovesArrayCount()
    assert.equal(arrayLength_Before, 6)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Liquidate carol
    await cdpManager.liquidate(carol)

    // Check Carol no longer has an active trove
    assert.isFalse(await sortedCDPs.contains(carol))

    // Check length of array has decreased by 1
    const arrayLength_After = await cdpManager.getallTrovesArrayCount()
    assert.equal(arrayLength_After, 5)

    /* After Carol is removed from array, the last element (Erin's address) should have been moved to fill 
    the empty slot left by Carol, and the array length decreased by one.  The final allTrovesArray should be:
  
    [W, A, B, E, D] 

    Check all remaining troves in the array are in the correct order */
    const trove_0 = await cdpManager.allTrovesArray(0)
    const trove_1 = await cdpManager.allTrovesArray(1)
    const trove_2 = await cdpManager.allTrovesArray(2)
    const trove_3 = await cdpManager.allTrovesArray(3)
    const trove_4 = await cdpManager.allTrovesArray(4)

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
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: _1_Ether })

    const withdrawalA = th.getDebtMinusVirtual('100000000000000000000')
    const CLVWithdrawal_B = th.getDebtMinusVirtual('180000000000000000000')
    await borrowerOperations.withdrawCLV(withdrawalA, alice, dummyHint, { from: alice })
    await borrowerOperations.withdrawCLV(CLVWithdrawal_B, bob, dummyHint, { from: bob })

    // --- TEST ---

    // check snapshots before 
    const totalStakesSnapshot_Before = (await cdpManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_Before = (await cdpManager.totalCollateralSnapshot()).toString()
    assert.equal(totalStakesSnapshot_Before, '0')
    assert.equal(totalCollateralSnapshot_Before, '0')

    // price drops to 1ETH:100CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // close Bob's CDP.  His 1 ether and 180 CLV should be added to the DefaultPool.
    const expectedLiquidatedColl_B = await th.getCollMinusGasComp([bob], cdpManager, priceFeed)
    await cdpManager.liquidate(bob, { from: owner });

    /* check snapshots after. Total stakes should be equal to the only remaining stake then the system: 
    10 ether, Alice's stake.
     
    Total collateral should be equal to Alice's collateral (10 ether) plus her pending ETH reward (0.9 ether), earned
    from the liquidation of Bob's CDP */

    const totalStakesSnapshot_After = (await cdpManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_After = (await cdpManager.totalCollateralSnapshot()).toString()

    const expectedTotalColl = web3.utils.toBN(_10_Ether).add(expectedLiquidatedColl_B)

    assert.equal(totalStakesSnapshot_After, _10_Ether)
    assert.equal(totalCollateralSnapshot_After, expectedTotalColl)
  })

  it("liquidate(): updates the L_ETH and L_CLVDebt reward-per-unit-staked totals", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: _10_Ether })
    await borrowerOperations.openLoan(0, carol, carol, { from: carol, value: _1_Ether })

    // Carol withdraws to 180CLV, lowering her ICR to 1.11
    const CLVWithdrawal_C = th.getDebtMinusVirtual('180000000000000000000')
    await borrowerOperations.withdrawCLV(CLVWithdrawal_C, carol, dummyHint, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carols's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    const expectedLiquidateColl_C = await th.getCollMinusGasComp([carol], cdpManager, priceFeed)
    const totalExpectedLiquidatedColl = await th.getCollMinusGasComp([bob, carol], cdpManager, priceFeed)
    // close Carol's CDP.  
    assert.isTrue(await sortedCDPs.contains(carol))
    await cdpManager.liquidate(carol, { from: owner });
    assert.isFalse(await sortedCDPs.contains(carol))

    /* Alice and Bob have the only active stakes. totalStakes in the system is (10 + 10) = 20 ether.
    
    Carol's 1 ether and 170 CLV should be added to the DefaultPool. */
    const L_ETH_AfterCarolLiquidated = await cdpManager.L_ETH()
    const L_CLVDebt_AfterCarolLiquidated = await cdpManager.L_CLVDebt()

    // With 20 ETH in activePool, expect reward-per-unit-staked  = (liquidated collateral) / 20
    const expected_L_ETH_after_C = expectedLiquidateColl_C.div(th.toBN('20'))
    const expected_L_CLVDebt_after_C = CLVWithdrawal_C.div(th.toBN('20'))

    assert.isAtMost(th.getDifference(L_ETH_AfterCarolLiquidated, expected_L_ETH_after_C), 100)
    assert.isAtMost(th.getDifference(L_CLVDebt_AfterCarolLiquidated, expected_L_CLVDebt_after_C), 100)

    // price rises to 200 CLV
    await priceFeed.setPrice(mv._200e18);

    // Bob now withdraws to 900 CLV
    const CLVWithdrawal_B = th.getDebtMinusVirtual('900000000000000000000')
    await borrowerOperations.withdrawCLV(CLVWithdrawal_B, bob, dummyHint, { from: bob })

    // price drops to 1ETH:100CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice(mv._100e18);
    const price = await priceFeed.getPrice()

    console.log(`ICR: ${await cdpManager.getCurrentICR(bob, price)}`)
    assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lt(mv._MCR))

    // close Bob's CDP 

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    assert.isTrue(await sortedCDPs.contains(bob))
    await cdpManager.liquidate(bob, { from: owner });
    assert.isFalse(await sortedCDPs.contains(bob))

    /* Alice now has the only active stake. totalStakes in the system is now 10 ether.
   
   Bob's debt (debt + pending debt reward) plus his liquidated collateral (coll + pending coll reward - gasComp)
   should now hit the Default Pool, and change the reward sums */
    const L_ETH_AfterBobLiquidated = await cdpManager.L_ETH()
    const L_CLVDebt_AfterBobLiquidated = await cdpManager.L_CLVDebt()

    const expected_L_ETH_after_B = totalExpectedLiquidatedColl.div(th.toBN('10'))
    const expected_L_CLVDebt_after_B = (CLVWithdrawal_B.add(CLVWithdrawal_C)).div(th.toBN('10'))

    console.log(`expected_L_Eth: ${expected_L_ETH_after_B}`)
    assert.isAtMost(th.getDifference(expected_L_ETH_after_B, L_ETH_AfterBobLiquidated), 100)
    assert.isAtMost(th.getDifference(expected_L_CLVDebt_after_B, L_CLVDebt_AfterBobLiquidated), 100)
  })

  it("liquidate(): Liquidates undercollateralized trove if there are two troves in the system", async () => {
    await borrowerOperations.openLoan(mv._50e18, bob, bob, { from: bob, value: mv._100_Ether })

    // Alice creates a single trove with 0.5 ETH and a debt of 50 LQTY,  and provides 10 CLV to SP
    const withdrawalA = th.getDebtMinusVirtual(mv._50e18)
    await borrowerOperations.openLoan(withdrawalA, alice, alice, { from: alice, value: mv._5e17 })
    await poolManager.provideToSP(mv._10e18, { from: alice })

    // Alice proves 10 CLV to SP
    await poolManager.provideToSP(mv._10e18, { from: alice })

    // Set ETH:USD price to 105
    await priceFeed.setPrice('105000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isFalse(await cdpManager.checkRecoveryMode())

    const alice_ICR = (await cdpManager.getCurrentICR(alice, price)).toString()
    assert.equal(alice_ICR, '1050000000000000000')

    const activeTrovesCount_Before = await cdpManager.getallTrovesArrayCount()

    assert.equal(activeTrovesCount_Before, 2)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Liquidate the trove
    await cdpManager.liquidate(alice, { from: owner })

    // Check Alice's trove is removed, and bob remains
    const activeTrovesCount_After = await cdpManager.getallTrovesArrayCount()
    assert.equal(activeTrovesCount_After, 1)

    const alice_isInSortedList = await sortedCDPs.contains(alice)
    assert.isFalse(alice_isInSortedList)

    const bob_isInSortedList = await sortedCDPs.contains(bob)
    assert.isTrue(bob_isInSortedList)
  })

  it("liquidate(): reverts if trove is non-existent", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._10_Ether })

    assert.equal(await cdpManager.getCDPStatus(carol), 0) // check trove non-existent

    assert.isFalse(await sortedCDPs.contains(carol))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    try {
      const txCarol = await cdpManager.liquidate(carol)

      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }
  })

  it("liquidate(): reverts if trove has been closed", async () => {
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._180e18, bob, bob, { from: bob, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._1_Ether })

    assert.isTrue(await sortedCDPs.contains(carol))

    // price drops, Carol ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Carol liquidated, and her trove is closed
    const txCarol_L1 = await cdpManager.liquidate(carol)
    assert.isTrue(txCarol_L1.receipt.status)

    assert.isFalse(await sortedCDPs.contains(carol))

    assert.equal(await cdpManager.getCDPStatus(carol), 2)  // check trove closed

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    try {
      const txCarol_L2 = await cdpManager.liquidate(carol)

      assert.isFalse(txCarol_L2.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }
  })

  it("liquidate(): does nothing if trove has >= 110% ICR", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._180e18, bob, bob, { from: bob, value: mv._10_Ether })

    const TCR_Before = (await poolManager.getTCR()).toString()
    const listSize_Before = (await sortedCDPs.getSize()).toString()

    const price = await priceFeed.getPrice()

    // Check Bob's ICR > 110%
    const bob_ICR = await cdpManager.getCurrentICR(bob, price)
    assert.isTrue(bob_ICR.gte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Attempt to liquidate bob
    await cdpManager.liquidate(bob)

    // Check bob active, check whale active
    assert.isTrue((await sortedCDPs.contains(bob)))
    assert.isTrue((await sortedCDPs.contains(whale)))

    const TCR_After = (await poolManager.getTCR()).toString()
    const listSize_After = (await sortedCDPs.getSize()).toString()

    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
  })

  it("liquidate(): does nothing if trove has non-zero coll, zero debt, and infinite ICR", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._10_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._10_Ether })

    const TCR_Before = (await poolManager.getTCR()).toString()
    const listSize_Before = (await sortedCDPs.getSize()).toString()

    await priceFeed.setPrice('0')
    const price = await priceFeed.getPrice()

    const bob_ICR = web3.utils.toHex(await cdpManager.getCurrentICR(bob, price))
    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    assert.equal(bob_ICR, maxBytes32)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

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

  it("liquidate(): Given the same price and no other loan changes, complete Pool offsets restore the TCR to its value prior to the defaulters opening troves", async () => {
    // Whale provides 2000 CLV to SP
    await borrowerOperations.openLoan(mv._2000e18, whale, whale, { from: whale, value: mv._100_Ether })
    await poolManager.provideToSP(mv._2000e18, { from: whale })

    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._7_Ether })
    await borrowerOperations.openLoan(0, carol, carol, { from: carol, value: mv._2_Ether })
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._20_Ether })

    const TCR_Before = (await poolManager.getTCR()).toString()

    await borrowerOperations.openLoan('101000000000000000000', defaulter_1, dummyHint, { from: defaulter_1, value: mv._1_Ether })
    await borrowerOperations.openLoan('257000000000000000000', defaulter_2, dummyHint, { from: defaulter_2, value: mv._2_Ether })
    await borrowerOperations.openLoan('328000000000000000000', defaulter_3, dummyHint, { from: defaulter_3, value: mv._3_Ether })
    await borrowerOperations.openLoan('480000000000000000000', defaulter_4, dummyHint, { from: defaulter_4, value: mv._4_Ether })

    assert.isTrue((await sortedCDPs.contains(defaulter_1)))
    assert.isTrue((await sortedCDPs.contains(defaulter_2)))
    assert.isTrue((await sortedCDPs.contains(defaulter_3)))
    assert.isTrue((await sortedCDPs.contains(defaulter_4)))

    // Price drop
    await priceFeed.setPrice(mv._100e18)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // All defaulters liquidated
    await cdpManager.liquidate(defaulter_1)
    assert.isFalse((await sortedCDPs.contains(defaulter_1)))

    await cdpManager.liquidate(defaulter_2)
    assert.isFalse((await sortedCDPs.contains(defaulter_2)))

    await cdpManager.liquidate(defaulter_3)
    assert.isFalse((await sortedCDPs.contains(defaulter_3)))

    await cdpManager.liquidate(defaulter_4)
    assert.isFalse((await sortedCDPs.contains(defaulter_4)))

    // Price bounces back
    await priceFeed.setPrice(mv._200e18)

    const TCR_After = (await poolManager.getTCR()).toString()
    assert.equal(TCR_Before, TCR_After)
  })


  it("liquidate(): Pool offsets increase the TCR", async () => {
    // Whale provides 2000 CLV to SP
    await borrowerOperations.openLoan(mv._2000e18, whale, whale, { from: whale, value: mv._100_Ether })
    await poolManager.provideToSP(mv._2000e18, { from: whale })

    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._7_Ether })
    await borrowerOperations.openLoan(0, carol, carol, { from: carol, value: mv._2_Ether })
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._20_Ether })

    await borrowerOperations.openLoan('101000000000000000000', defaulter_1, dummyHint, { from: defaulter_1, value: mv._1_Ether })
    await borrowerOperations.openLoan('257000000000000000000', defaulter_2, dummyHint, { from: defaulter_2, value: mv._2_Ether })
    await borrowerOperations.openLoan('328000000000000000000', defaulter_3, dummyHint, { from: defaulter_3, value: mv._3_Ether })
    await borrowerOperations.openLoan('480000000000000000000', defaulter_4, dummyHint, { from: defaulter_4, value: mv._4_Ether })

    assert.isTrue((await sortedCDPs.contains(defaulter_1)))
    assert.isTrue((await sortedCDPs.contains(defaulter_2)))
    assert.isTrue((await sortedCDPs.contains(defaulter_3)))
    assert.isTrue((await sortedCDPs.contains(defaulter_4)))

    await priceFeed.setPrice(mv._100e18)

    const TCR_1 = await poolManager.getTCR()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Check TCR improves with each liquidation that is offset with Pool
    await cdpManager.liquidate(defaulter_1)
    assert.isFalse((await sortedCDPs.contains(defaulter_1)))
    const TCR_2 = await poolManager.getTCR()
    assert.isTrue(TCR_2.gte(TCR_1))

    await cdpManager.liquidate(defaulter_2)
    assert.isFalse((await sortedCDPs.contains(defaulter_2)))
    const TCR_3 = await poolManager.getTCR()
    assert.isTrue(TCR_3.gte(TCR_2))

    await cdpManager.liquidate(defaulter_3)
    assert.isFalse((await sortedCDPs.contains(defaulter_3)))
    const TCR_4 = await poolManager.getTCR()
    assert.isTrue(TCR_4.gte(TCR_4))

    await cdpManager.liquidate(defaulter_4)
    assert.isFalse((await sortedCDPs.contains(defaulter_4)))
    const TCR_5 = await poolManager.getTCR()
    assert.isTrue(TCR_5.gte(TCR_5))
  })

  it("liquidate(): Pure redistributions do not decrease the TCR", async () => {
    // Whale provides 2000 CLV to SP
    await borrowerOperations.openLoan(mv._2000e18, whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._7_Ether })
    await borrowerOperations.openLoan(0, carol, carol, { from: carol, value: mv._2_Ether })
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._20_Ether })

    await borrowerOperations.openLoan('101000000000000000000', defaulter_1, dummyHint, { from: defaulter_1, value: mv._1_Ether })
    await borrowerOperations.openLoan('257000000000000000000', defaulter_2, dummyHint, { from: defaulter_2, value: mv._2_Ether })
    await borrowerOperations.openLoan('328000000000000000000', defaulter_3, dummyHint, { from: defaulter_3, value: mv._3_Ether })
    await borrowerOperations.openLoan('480000000000000000000', defaulter_4, dummyHint, { from: defaulter_4, value: mv._4_Ether })

    assert.isTrue((await sortedCDPs.contains(defaulter_1)))
    assert.isTrue((await sortedCDPs.contains(defaulter_2)))
    assert.isTrue((await sortedCDPs.contains(defaulter_3)))
    assert.isTrue((await sortedCDPs.contains(defaulter_4)))

    await priceFeed.setPrice(mv._100e18)

    const TCR_1 = await poolManager.getTCR()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Check TCR does not decrease with each liquidation 
    await cdpManager.liquidate(defaulter_1)
    assert.isFalse((await sortedCDPs.contains(defaulter_1)))
    const TCR_2 = await poolManager.getTCR()

    assert.isTrue(TCR_2.gte(TCR_1))

    await cdpManager.liquidate(defaulter_2)
    assert.isFalse((await sortedCDPs.contains(defaulter_2)))
    const TCR_3 = await poolManager.getTCR()
    assert.isTrue(TCR_3.gte(TCR_2))

    await cdpManager.liquidate(defaulter_3)
    assert.isFalse((await sortedCDPs.contains(defaulter_3)))
    const TCR_4 = await poolManager.getTCR()
    assert.isTrue(TCR_4.gte(TCR_4))

    await cdpManager.liquidate(defaulter_4)
    assert.isFalse((await sortedCDPs.contains(defaulter_4)))
    const TCR_5 = await poolManager.getTCR()
    assert.isTrue(TCR_5.gte(TCR_5))
  })

  it("liquidate(): does not affect the SP deposit or ETH gain when called on an SP depositor's address that has no trove", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, bob, { from: bob, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._1_Ether })

    // Bob sends tokens to Dennis, who has no trove
    await clvToken.transfer(dennis, mv._200e18, { from: bob })

    //Dennis provides 200 CLV to SP
    await poolManager.provideToSP(mv._200e18, { from: dennis })

    // Carol gets liquidated
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(carol)

    // Check Dennis' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const dennis_Deposit_Before = (await poolManager.getCompoundedCLVDeposit(dennis)).toString()
    const dennis_ETHGain_Before = (await poolManager.getCurrentETHGain(dennis)).toString()
    assert.isAtMost(th.getDifference(dennis_Deposit_Before, mv._100e18), 1000)
    assert.isAtMost(th.getDifference(dennis_ETHGain_Before, mv._1_Ether), 1000)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

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
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, bob, { from: bob, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._1_Ether })

    //Bob provides 200 CLV to SP
    await poolManager.provideToSP(mv._200e18, { from: bob })

    // Carol gets liquidated
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(carol)

    // price bounces back - Bob's trove is >110% ICR again
    await priceFeed.setPrice(mv._200e18)
    const price = await priceFeed.getPrice()
    assert.isTrue((await cdpManager.getCurrentICR(bob, price)).gt(mv._MCR))

    // Check Bob' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const bob_Deposit_Before = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
    const bob_ETHGain_Before = (await poolManager.getCurrentETHGain(bob)).toString()
    assert.isAtMost(th.getDifference(bob_Deposit_Before, mv._100e18), 1000)
    assert.isAtMost(th.getDifference(bob_ETHGain_Before, mv._1_Ether), 1000)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

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
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._300e18, alice, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, bob, { from: bob, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._1_Ether })

    //Bob provides 200 CLV to SP
    await poolManager.provideToSP(mv._200e18, { from: bob })

    // Carol gets liquidated
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(carol)

    // Check Bob' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const bob_Deposit_Before = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
    const bob_ETHGain_Before = (await poolManager.getCurrentETHGain(bob)).toString()
    assert.isAtMost(th.getDifference(bob_Deposit_Before, mv._100e18), 1000)
    assert.isAtMost(th.getDifference(bob_ETHGain_Before, mv._1_Ether), 1000)

    // Alice provides 300 CLV to SP
    await poolManager.provideToSP(mv._300e18, { from: alice })

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

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
    const bob_ETHGain_After = (await poolManager.getCurrentETHGain(bob)).toString()

    assert.isAtMost(th.getDifference(bob_Deposit_After, mv._50e18), 1000)
    assert.isAtMost(th.getDifference(bob_ETHGain_After, '1500000000000000000'), 1000)
  })

  it("liquidate(): does not alter the liquidated user's token balance", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._300e18, alice, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, bob, { from: bob, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._1_Ether })
    await priceFeed.setPrice(mv._100e18)

    // Check token balances 
    assert.equal((await clvToken.balanceOf(alice)).toString(), mv._300e18)
    assert.equal((await clvToken.balanceOf(bob)).toString(), mv._200e18)
    assert.equal((await clvToken.balanceOf(carol)).toString(), mv._100e18)

    // Check sortedList size
    assert.equal((await sortedCDPs.getSize()).toString(), '4')

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Liquidate A, B and C
    const activeCLVDebt_0 = await activePool.getCLVDebt()
    const defaultCLVDebt_0 = await defaultPool.getCLVDebt()

    await cdpManager.liquidate(alice)
    const activeCLVDebt_A = await activePool.getCLVDebt()
    const defaultCLVDebt_A = await defaultPool.getCLVDebt()

    await cdpManager.liquidate(bob)
    const activeCLVDebt_B = await activePool.getCLVDebt()
    const defaultCLVDebt_B = await defaultPool.getCLVDebt()

    await cdpManager.liquidate(carol)

    // Confirm A, B, C closed
    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))

    // Check sortedList size reduced to 1
    assert.equal((await sortedCDPs.getSize()).toString(), '1')

    // Confirm token balances have not changed
    assert.equal((await clvToken.balanceOf(alice)).toString(), mv._300e18)
    assert.equal((await clvToken.balanceOf(bob)).toString(), mv._200e18)
    assert.equal((await clvToken.balanceOf(carol)).toString(), mv._100e18)
  })

  it("liquidate(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await borrowerOperations.openLoan(mv._50e18, alice, alice, { from: alice, value: mv._2_Ether })
    await borrowerOperations.openLoan('90500000000000000000', bob, bob, { from: bob, value: mv._1_Ether })  // 90.5 CLV, 1 ETH
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._1_Ether })

    // Defaulter opens with 30 CLV, 0.3 ETH
    await borrowerOperations.openLoan(mv._30e18, defaulter_1, dummyHint, { from: defaulter_1, value: mv._3e17 })

    // Price drops
    await priceFeed.setPrice(mv._100e18)
    const price = await priceFeed.getPrice()

    const alice_ICR_Before = await cdpManager.getCurrentICR(alice, price)
    const bob_ICR_Before = await cdpManager.getCurrentICR(bob, price)
    const carol_ICR_Before = await cdpManager.getCurrentICR(carol, price)

    /* Before liquidation: 
    Alice ICR: = (2 * 100 / 50) = 400%
    Bob ICR: (1 * 100 / 90.5) = 110.5%
    Carol ICR: (1 * 100 / 100 ) =  100%

    Therefore Alice and Bob above the MCR, Carol is below */
    assert.isTrue(alice_ICR_Before.gte(mv._MCR))
    assert.isTrue(bob_ICR_Before.gte(mv._MCR))
    assert.isTrue(carol_ICR_Before.lt(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    /* Liquidate defaulter. 30 CLV and 0.3 ETH is distributed between A, B and C.

    A receives (30 * 2/4) = 15 CLV, and (0.3*2/4) = 0.15 ETH
    B receives (30 * 1/4) = 7.5 CLV, and (0.3*1/4) = 0.075 ETH
    C receives (30 * 1/4) = 7.5 CLV, and (0.3*1/4) = 0.075 ETH
    */
    await cdpManager.liquidate(defaulter_1)

    const alice_ICR_After = await cdpManager.getCurrentICR(alice, price)
    const bob_ICR_After = await cdpManager.getCurrentICR(bob, price)
    const carol_ICR_After = await cdpManager.getCurrentICR(carol, price)

    /* After liquidation: 

    Alice ICR: (10.15 * 100 / 60) = 183.33%
    Bob ICR:(1.075 * 100 / 98) =  109.69%
    Carol ICR: (1.075 *100 /  107.5 ) = 100.0%

    Check Alice is above MCR, Bob below, Carol below. */


    assert.isTrue(alice_ICR_After.gte(mv._MCR))
    assert.isTrue(bob_ICR_After.lt(mv._MCR))
    assert.isTrue(carol_ICR_After.lt(mv._MCR))

    /* Though Bob's true ICR (including pending rewards) is below the MCR, 
    check that Bob's raw coll and debt has not changed, and that his "raw" ICR is above the MCR */
    const bob_Coll = (await cdpManager.CDPs(bob))[1]
    const bob_Debt = (await cdpManager.CDPs(bob))[0]

    const bob_rawICR = bob_Coll.mul(mv._100e18BN).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    // Whale enters system, pulling it into Normal Mode
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._10_Ether })
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate Alice, Bob, Carol
    await cdpManager.liquidate(alice)
    await cdpManager.liquidate(bob)
    await cdpManager.liquidate(carol)

    /* Check Alice stays active, Carol gets liquidated, and Bob gets liquidated 
   (because his pending rewards bring his ICR < MCR) */
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))

    // Check trove statuses - A active (1),  B and C closed (2)
    assert.equal((await cdpManager.CDPs(alice))[3].toString(), '1')
    assert.equal((await cdpManager.CDPs(bob))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(carol))[3].toString(), '2')
  })

  it('liquidateCDPs(): closes every CDP with ICR < MCR, when n > number of undercollateralized troves', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(mv._500e18, whale, whale, { from: whale, value: mv._100_Ether })

    // create 5 CDPs with varying ICRs
    await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._150e18, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._300e18, carol, carol, { from: carol, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._110e18, erin, erin, { from: erin, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._180e18, flyn, flyn, { from: flyn, value: mv._1_Ether })

    // G,H, I open high-ICR loans
    await borrowerOperations.openLoan(mv._100e18, graham, graham, { from: graham, value: mv._100_Ether })
    await borrowerOperations.openLoan(mv._200e18, harriet, harriet, { from: harriet, value: mv._100_Ether })
    await borrowerOperations.openLoan(mv._300e18, ida, harriet, { from: ida, value: mv._100_Ether })

    // Whale puts some tokens in Stability Pool
    await poolManager.provideToSP(mv._300e18, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100CLV, reducing Bob and Carol's ICR below MCR
    await priceFeed.setPrice(mv._100e18);
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Confirm troves A-E are ICR < 110%
    assert.isTrue((await cdpManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(carol, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(erin, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(flyn, price)).lt(mv._MCR))

    // Confirm troves G, H, I are ICR > 110%
    assert.isTrue((await cdpManager.getCurrentICR(graham, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(harriet, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(ida, price)).gte(mv._MCR))

    // Confirm Whale is ICR > 110% 
    assert.isTrue((await cdpManager.getCurrentICR(whale, price)).gte(mv._MCR))

    // Liquidate 5 troves
    await cdpManager.liquidateCDPs(5);

    // Confirm troves A-E have been removed from the system
    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))
    assert.isFalse(await sortedCDPs.contains(erin))
    assert.isFalse(await sortedCDPs.contains(flyn))

    // Check all troves A-E are now closed
    assert.equal((await cdpManager.CDPs(alice))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(bob))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(carol))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(erin))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(flyn))[3].toString(), '2')

    // Check sorted list has been reduced to length 4 
    assert.equal((await sortedCDPs.getSize()).toString(), '4')
  })

  it('liquidateCDPs(): liquidates only up to the requested number of undercollateralized troves', async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    // --- SETUP --- 
    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await borrowerOperations.openLoan('105000000000000000000', alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan('104000000000000000000', bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan('103000000000000000000', carol, carol, { from: carol, value: mv._1_Ether })
    await borrowerOperations.openLoan('102000000000000000000', dennis, dennis, { from: dennis, value: mv._1_Ether })
    await borrowerOperations.openLoan('101000000000000000000', erin, erin, { from: erin, value: mv._1_Ether })

    // --- TEST --- 

    // Price drops
    await priceFeed.setPrice(mv._100e18)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    await cdpManager.liquidateCDPs(3)

    const allTrovesArrayLength = await cdpManager.getallTrovesArrayCount()
    assert.equal(allTrovesArrayLength, '3')

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

  it('liquidateCDPs(): does nothing if all troves have ICR > 110%', async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._90e18, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._90e18, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._90e18, carol, carol, { from: carol, value: mv._1_Ether })

    // Price drops, but all troves remain active at 111% ICR
    await priceFeed.setPrice(mv._100e18)
    const price = await priceFeed.getPrice()

    assert.isTrue((await sortedCDPs.contains(whale)))
    assert.isTrue((await sortedCDPs.contains(alice)))
    assert.isTrue((await sortedCDPs.contains(bob)))
    assert.isTrue((await sortedCDPs.contains(carol)))

    const TCR_Before = (await poolManager.getTCR()).toString()
    const listSize_Before = (await sortedCDPs.getSize()).toString()

    assert.isTrue((await cdpManager.getCurrentICR(whale, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(alice, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(alice, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(alice, price)).gte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Attempt liqudation sequence
    await cdpManager.liquidateCDPs(10)

    // Check all troves remain active
    assert.isTrue((await sortedCDPs.contains(whale)))
    assert.isTrue((await sortedCDPs.contains(alice)))
    assert.isTrue((await sortedCDPs.contains(bob)))
    assert.isTrue((await sortedCDPs.contains(carol)))

    const TCR_After = (await poolManager.getTCR()).toString()
    const listSize_After = (await sortedCDPs.getSize()).toString()

    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
  })

  it("liquidateCDPs(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await borrowerOperations.openLoan(mv._50e18, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan('90500000000000000000', bob, bob, { from: bob, value: mv._1_Ether })  // 90.5 CLV, 1 ETH
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._1_Ether })

    // Defaulter opens with 30 CLV, 0.3 ETH
    await borrowerOperations.openLoan(mv._30e18, defaulter_1, dummyHint, { from: defaulter_1, value: mv._3e17 })

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
    assert.isTrue(carol_ICR_Before.lt(mv._MCR))

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
    assert.isTrue(bob_ICR_After.lt(mv._MCR))
    assert.isTrue(carol_ICR_After.lt(mv._MCR))

    /* Though Bob's true ICR (including pending rewards) is below the MCR, check that Bob's raw coll and debt has not changed */
    const bob_Coll = (await cdpManager.CDPs(bob))[1]
    const bob_Debt = (await cdpManager.CDPs(bob))[0]

    const bob_rawICR = bob_Coll.mul(mv._100e18BN).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    // Whale enters system, pulling it into Normal Mode
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._10_Ether })

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    //liquidate A, B, C
    await cdpManager.liquidateCDPs(10)

    // Check A stays active, B and C get liquidated
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))

    // check trove statuses - A active (1),  B and C closed (2)
    assert.equal((await cdpManager.CDPs(alice))[3].toString(), '1')
    assert.equal((await cdpManager.CDPs(bob))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(carol))[3].toString(), '2')
  })

  it("liquidateCDPs(): does nothing if n = 0", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._1_Ether })

    await priceFeed.setPrice(mv._100e18)
    const price = await priceFeed.getPrice()

    const TCR_Before = (await poolManager.getTCR()).toString()

    // Confirm A, B, C ICRs are below 110%
    const alice_ICR = await cdpManager.getCurrentICR(alice, price)
    const bob_ICR = await cdpManager.getCurrentICR(bob, price)
    const carol_ICR = await cdpManager.getCurrentICR(carol, price)
    assert.isTrue(alice_ICR.lt(mv._MCR))
    assert.isTrue(bob_ICR.lt(mv._MCR))
    assert.isTrue(carol_ICR.lt(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Liquidation with n = 0
    await cdpManager.liquidateCDPs(0)

    // Check all troves are still in the system
    assert.isTrue(await sortedCDPs.contains(whale))
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isTrue(await sortedCDPs.contains(bob))
    assert.isTrue(await sortedCDPs.contains(carol))

    const TCR_After = (await poolManager.getTCR()).toString()

    // Check TCR has not changed after liquidation
    assert.equal(TCR_Before, TCR_After)
  })

  it("liquidateCDPs(): only liquidates troves with ICR < MCR", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._10_Ether })

    // A, B, C open loans that will remain active when price drops to 100
    await borrowerOperations.openLoan('88000000000000000000', alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan('89000000000000000000', bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan('90000000000000000000', carol, carol, { from: carol, value: mv._1_Ether })

    // D, E, F open loans that will fall below MCR when price drops to 100
    await borrowerOperations.openLoan('91000000000000000000', dennis, dennis, { from: dennis, value: mv._1_Ether })
    await borrowerOperations.openLoan('92000000000000000000', erin, erin, { from: erin, value: mv._1_Ether })
    await borrowerOperations.openLoan('93000000000000000000', flyn, flyn, { from: flyn, value: mv._1_Ether })

    // Check list size is 7
    assert.equal((await sortedCDPs.getSize()).toString(), '7')

    // Price drops
    await priceFeed.setPrice(mv._100e18)
    const price = await priceFeed.getPrice()

    const alice_ICR = await cdpManager.getCurrentICR(alice, price)
    const bob_ICR = await cdpManager.getCurrentICR(bob, price)
    const carol_ICR = await cdpManager.getCurrentICR(carol, price)
    const dennis_ICR = await cdpManager.getCurrentICR(dennis, price)
    const erin_ICR = await cdpManager.getCurrentICR(erin, price)
    const flyn_ICR = await cdpManager.getCurrentICR(flyn, price)

    // Check A, B, C have ICR above MCR
    assert.isTrue(alice_ICR.gte(mv._MCR))
    assert.isTrue(bob_ICR.gte(mv._MCR))
    assert.isTrue(carol_ICR.gte(mv._MCR))

    // Check D, E, F have ICR below MCR
    assert.isTrue(dennis_ICR.lt(mv._MCR))
    assert.isTrue(erin_ICR.lt(mv._MCR))
    assert.isTrue(flyn_ICR.lt(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    //Liquidate sequence
    await cdpManager.liquidateCDPs(10)

    // check list size reduced to 4
    assert.equal((await sortedCDPs.getSize()).toString(), '4')

    // Check Whale and A, B, C remain in the system
    assert.isTrue(await sortedCDPs.contains(whale))
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isTrue(await sortedCDPs.contains(bob))
    assert.isTrue(await sortedCDPs.contains(carol))

    // Check D, E, F have been removed
    assert.isFalse(await sortedCDPs.contains(dennis))
    assert.isFalse(await sortedCDPs.contains(erin))
    assert.isFalse(await sortedCDPs.contains(flyn))
  })

  it("liquidateCDPs(): does not affect the liquidated user's token balances", async () => {
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._10_Ether })

    // D, E, F open loans that will fall below MCR when price drops to 100
    await borrowerOperations.openLoan(mv._100e18, dennis, dennis, { from: dennis, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._150e18, erin, erin, { from: erin, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._180e18, flyn, flyn, { from: flyn, value: mv._1_Ether })

    // Check list size is 4
    assert.equal((await sortedCDPs.getSize()).toString(), '4')

    // Check token balances before
    assert.equal((await clvToken.balanceOf(dennis)).toString(), mv._100e18)
    assert.equal((await clvToken.balanceOf(erin)).toString(), mv._150e18)
    assert.equal((await clvToken.balanceOf(flyn)).toString(), mv._180e18)

    // Price drops
    await priceFeed.setPrice(mv._100e18)
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    //Liquidate sequence
    await cdpManager.liquidateCDPs(10)

    // check list size reduced to 1
    assert.equal((await sortedCDPs.getSize()).toString(), '1')

    // Check Whale remains in the system
    assert.isTrue(await sortedCDPs.contains(whale))

    // Check D, E, F have been removed
    assert.isFalse(await sortedCDPs.contains(dennis))
    assert.isFalse(await sortedCDPs.contains(erin))
    assert.isFalse(await sortedCDPs.contains(flyn))

    // Check token balances of users whose troves were liquidated, have not changed
    assert.equal((await clvToken.balanceOf(dennis)).toString(), mv._100e18)
    assert.equal((await clvToken.balanceOf(erin)).toString(), mv._150e18)
    assert.equal((await clvToken.balanceOf(flyn)).toString(), mv._180e18)
  })

  it("liquidateCDPs(): A liquidation sequence containing Pool offsets increases the TCR", async () => {
    // Whale provides 500 CLV to SP
    await borrowerOperations.openLoan(mv._2000e18, whale, whale, { from: whale, value: mv._100_Ether })
    await poolManager.provideToSP(mv._500e18, { from: whale })

    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._7_Ether })
    await borrowerOperations.openLoan(0, carol, carol, { from: carol, value: mv._2_Ether })
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._20_Ether })

    await borrowerOperations.openLoan('101000000000000000000', defaulter_1, dummyHint, { from: defaulter_1, value: mv._1_Ether })
    await borrowerOperations.openLoan('257000000000000000000', defaulter_2, dummyHint, { from: defaulter_2, value: mv._2_Ether })
    await borrowerOperations.openLoan('328000000000000000000', defaulter_3, dummyHint, { from: defaulter_3, value: mv._3_Ether })
    await borrowerOperations.openLoan('480000000000000000000', defaulter_4, dummyHint, { from: defaulter_4, value: mv._4_Ether })

    assert.isTrue((await sortedCDPs.contains(defaulter_1)))
    assert.isTrue((await sortedCDPs.contains(defaulter_2)))
    assert.isTrue((await sortedCDPs.contains(defaulter_3)))
    assert.isTrue((await sortedCDPs.contains(defaulter_4)))

    assert.equal((await sortedCDPs.getSize()).toString(), '9')

    // Price drops
    await priceFeed.setPrice(mv._100e18)

    const TCR_Before = await poolManager.getTCR()

    // Check pool has 500 CLV
    assert.equal((await stabilityPool.getCLV()).toString(), mv._500e18)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Liquidate troves
    await cdpManager.liquidateCDPs(10)

    // Check pool has been emptied by the liquidations
    assert.equal((await stabilityPool.getCLV()).toString(), '0')

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedCDPs.contains(defaulter_1)))
    assert.isFalse((await sortedCDPs.contains(defaulter_2)))
    assert.isFalse((await sortedCDPs.contains(defaulter_3)))
    assert.isFalse((await sortedCDPs.contains(defaulter_4)))

    // check system sized reduced to 5 troves
    assert.equal((await sortedCDPs.getSize()).toString(), '5')

    // Check that the liquidation sequence has improved the TCR
    const TCR_After = await poolManager.getTCR()
    assert.isTrue(TCR_After.gte(TCR_Before))
  })

  it("liquidateCDPs(): A liquidation sequence of pure redistributions does not decrease the TCR", async () => {
    await borrowerOperations.openLoan(mv._2000e18, whale, whale, { from: whale, value: mv._100_Ether })
    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._7_Ether })
    await borrowerOperations.openLoan(0, carol, carol, { from: carol, value: mv._2_Ether })
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._20_Ether })

    await borrowerOperations.openLoan('101000000000000000000', defaulter_1, dummyHint, { from: defaulter_1, value: mv._1_Ether })
    await borrowerOperations.openLoan('257000000000000000000', defaulter_2, dummyHint, { from: defaulter_2, value: mv._2_Ether })
    await borrowerOperations.openLoan('328000000000000000000', defaulter_3, dummyHint, { from: defaulter_3, value: mv._3_Ether })
    await borrowerOperations.openLoan('480000000000000000000', defaulter_4, dummyHint, { from: defaulter_4, value: mv._4_Ether })

    assert.isTrue((await sortedCDPs.contains(defaulter_1)))
    assert.isTrue((await sortedCDPs.contains(defaulter_2)))
    assert.isTrue((await sortedCDPs.contains(defaulter_3)))
    assert.isTrue((await sortedCDPs.contains(defaulter_4)))

    assert.equal((await sortedCDPs.getSize()).toString(), '9')

    // Price drops
    await priceFeed.setPrice(mv._100e18)

    const TCR_Before = await poolManager.getTCR()

    // Check pool is empty before liquidation
    assert.equal((await stabilityPool.getCLV()).toString(), '0')

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Liquidate
    await cdpManager.liquidateCDPs(10)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedCDPs.contains(defaulter_1)))
    assert.isFalse((await sortedCDPs.contains(defaulter_2)))
    assert.isFalse((await sortedCDPs.contains(defaulter_3)))
    assert.isFalse((await sortedCDPs.contains(defaulter_4)))

    // check system sized reduced to 5 troves
    assert.equal((await sortedCDPs.getSize()).toString(), '5')

    // Check that the liquidation sequence has not reduced the TCR
    const TCR_After = await poolManager.getTCR()
    assert.isTrue(TCR_After.gte(TCR_Before))
  })

  it("liquidateCDPs(): Liquidating troves with SP deposits correctly impacts their SP deposit and ETH gain", async () => {
    // Whale provides 400 CLV to the SP
    await borrowerOperations.openLoan(mv._400e18, whale, whale, { from: whale, value: mv._100_Ether })
    await poolManager.provideToSP(mv._400e18, { from: whale })

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._300e18, bob, bob, { from: bob, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._1_Ether })

    // A, B provide 100, 300 to the SP
    await poolManager.provideToSP(mv._100e18, { from: alice })
    await poolManager.provideToSP(mv._300e18, { from: bob })

    assert.equal((await sortedCDPs.getSize()).toString(), '4')

    // Price drops
    await priceFeed.setPrice(mv._100e18)

    // Check 800 CLV in Pool
    assert.equal((await stabilityPool.getCLV()).toString(), mv._800e18)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Liquidate
    await cdpManager.liquidateCDPs(10)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedCDPs.contains(alice)))
    assert.isFalse((await sortedCDPs.contains(bob)))
    assert.isFalse((await sortedCDPs.contains(carol)))

    // check system sized reduced to 1 troves
    assert.equal((await sortedCDPs.getSize()).toString(), '1')

    /* Prior to liquidation, SP deposits were:
    Whale: 400 CLV
    Alice: 100 CLV
    Bob:   300 CLV
    Carol: 0 CLV

    Total CLV in Pool: 800 CLV

    Then, liquidation hits A,B,C: 

    Total liquidated debt = 100 + 300 + 100 = 500 CLV
    Total liquidated ETH = 1 + 3 + 1 = 5 ETH

    Whale CLV Loss: 500 * (400/800) = 250 CLV
    Alice CLV Loss:  500 *(100/800) = 62.5 CLV
    Bob CLV Loss: 500 * (300/800) = 187.5 CLV

    Whale remaining deposit: (400 - 250) = 150 CLV
    Alice remaining deposit: (100 - 62.5) = 37.5 CLV
    Bob remaining deposit: (300 - 187.5) = 112.5 CLV

    Whale ETH Gain: 5 * (400/800) = 2.5 ETH
    Alice ETH Gain: 5 *(100/800) = 0.625 ETH
    Bob ETH Gain: 5 * (300/800) = 1.875 ETH

    Total remaining deposits: 300 CLV
    Total ETH gain: 5 ETH */

    // Check remaining CLV Deposits and ETH gain, for whale and depositors whose troves were liquidated
    const whale_Deposit_After = (await poolManager.getCompoundedCLVDeposit(whale)).toString()
    const alice_Deposit_After = (await poolManager.getCompoundedCLVDeposit(alice)).toString()
    const bob_Deposit_After = (await poolManager.getCompoundedCLVDeposit(bob)).toString()

    const whale_ETHGain = (await poolManager.getCurrentETHGain(whale)).toString()
    const alice_ETHGain = (await poolManager.getCurrentETHGain(alice)).toString()
    const bob_ETHGain = (await poolManager.getCurrentETHGain(bob)).toString()

    assert.isAtMost(th.getDifference(whale_Deposit_After, mv._150e18), 1000)
    assert.isAtMost(th.getDifference(alice_Deposit_After, '37500000000000000000'), 1000)
    assert.isAtMost(th.getDifference(bob_Deposit_After, '112500000000000000000'), 1000)

    assert.isAtMost(th.getDifference(whale_ETHGain, '2500000000000000000'), 1000)
    assert.isAtMost(th.getDifference(alice_ETHGain, '625000000000000000'), 1000)
    assert.isAtMost(th.getDifference(bob_ETHGain, '1875000000000000000'), 1000)

    // Check total remaining deposits and ETH gain in Stability Pool
    const total_CLVinSP = (await stabilityPool.getCLV()).toString()
    const total_ETHinSP = (await stabilityPool.getETH()).toString()

    assert.isAtMost(th.getDifference(total_CLVinSP, mv._300e18), 1000)
    assert.isAtMost(th.getDifference(total_ETHinSP, mv._5_Ether), 1000)
  })


  // --- redeemCollateral() and hints ---

  // TODO: Fix redemptions tests to accomodate new return values from hint helpers

  it.only('getRedemptionHints(): gets the address of the first CDP and the final ICR of the last CDP involved in a redemption', async () => {
    // --- SETUP ---
    hintHelpers = await deployAndConnectHintHelpers(contractAddresses)

    await borrowerOperations.openLoan('10' + _18_zeros, alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.openLoan('20' + _18_zeros, bob, bob, { from: bob, value: _1_Ether })
    await borrowerOperations.openLoan('30' + _18_zeros, carol, carol, { from: carol, value: _1_Ether })
    // Dennis' CDP should be untouched by redemption, because its ICR will be < 110% after the price drop
    await borrowerOperations.openLoan('180' + _18_zeros, dennis, dennis, { from: dennis, value: _1_Ether })

    // Drop the price
    const price = '100' + _18_zeros
    await priceFeed.setPrice(price);

    // --- TEST ---
    const {
      firstRedemptionHint,
      partialRedemptionHintICR,
    } = await hintHelpers.getRedemptionHints('55' + _18_zeros, price)

    assert.equal(firstRedemptionHint, carol)
    assert.equal(partialRedemptionHintICR, '19' + _18_zeros)
  });

  it('redeemCollateral(): cancels the provided CLV with debt from CDPs with the lowest ICRs and sends an equivalent amount of Ether', async () => {
    // --- SETUP ---
    hintHelpers = await deployAndConnectHintHelpers(contractAddresses)

    await borrowerOperations.openLoan('5' + _18_zeros, alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.openLoan('8' + _18_zeros, bob, bob, { from: bob, value: _1_Ether })
    await borrowerOperations.openLoan('10' + _18_zeros, carol, carol, { from: carol, value: _1_Ether })
    // start Dennis with a high ICR
    await borrowerOperations.openLoan('150' + _18_zeros, dennis, dennis, { from: dennis, value: _100_Ether })

    const dennis_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(dennis))

    const dennis_CLVBalance_Before = await clvToken.balanceOf(dennis)
    assert.equal(dennis_CLVBalance_Before, '150' + _18_zeros)

    const price = await priceFeed.getPrice()
    assert.equal(price, '200' + _18_zeros)

    // --- TEST --- 

    // Find hints for redeeming 20 CLV
    const {
      firstRedemptionHint,
      partialRedemptionHintICR, 
    } = await hintHelpers.getRedemptionHints('20' + _18_zeros, price)

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
      dennis,
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
    hintHelpers = await deployAndConnectHintHelpers(contractAddresses)

    const price = await priceFeed.getPrice()
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await borrowerOperations.openLoan(mv._20e18, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._20e18, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._20e18, carol, carol, { from: carol, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._10e18, dennis, dennis, { from: dennis, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._10e18, erin, erin, { from: erin, value: mv._1_Ether })

    // --- TEST --- 

    // open loan from redeemer.  Redeemer has highest ICR (100ETH, 100 CLV), 20000%
    await borrowerOperations.openLoan(mv._100e18, flyn, flyn, { from: flyn, value: mv._100_Ether })

    // Flyn redeems collateral
    await cdpManager.redeemCollateral(mv._60e18, alice, alice, 0, alice, { from: flyn })

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

  it('redeemCollateral(): doesnt perform the final partial redemption in the sequence if the hint is out-of-date', async () => {
    // --- SETUP ---
    hintHelpers = await deployAndConnectHintHelpers(contractAddresses)

    await borrowerOperations.openLoan('5' + _18_zeros, alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.openLoan('8' + _18_zeros, bob, bob, { from: bob, value: _1_Ether })
    await borrowerOperations.openLoan('10' + _18_zeros, carol, carol, { from: carol, value: _1_Ether })
    await borrowerOperations.openLoan('150' + _18_zeros, dennis, dennis, { from: dennis, value: _100_Ether })

    const dennis_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(dennis))

    const dennis_CLVBalance_Before = await clvToken.balanceOf(dennis)
    assert.equal(dennis_CLVBalance_Before, '150' + _18_zeros)

    const price = await priceFeed.getPrice()
    assert.equal(price, '200' + _18_zeros)

    // --- TEST --- 

    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints('20' + _18_zeros, price)

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
      } = await hintHelpers.getRedemptionHints('1' + _18_zeros, price)

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
        alice,
        { from: alice }
      )
    }

    // Dennis tries to redeem 20 CLV
    await cdpManager.redeemCollateral(
      '20' + _18_zeros,
      firstRedemptionHint,
      partialRedemptionHint,
      partialRedemptionHintICR,
      dennis,
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

  it("redeemCollateral(): can redeem if there is zero active debt but non-zero debt in DefaultPool", async () => {
    // --- SETUP ---
    hintHelpers = await deployAndConnectHintHelpers(contractAddresses)

    await borrowerOperations.openLoan('0', alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.openLoan('100' + _18_zeros, bob, bob, { from: bob, value: _1_Ether })

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
      alice,
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
    hintHelpers = await deployAndConnectHintHelpers(contractAddresses)

    await borrowerOperations.openLoan('100' + _18_zeros, alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.openLoan('100' + _18_zeros, bob, bob, { from: bob, value: _1_Ether })

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
      bob,
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
    hintHelpers = await deployAndConnectHintHelpers(contractAddresses)

    await borrowerOperations.openLoan('100' + _18_zeros, alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.openLoan('100' + _18_zeros, bob, bob, { from: bob, value: _1_Ether })
    await borrowerOperations.openLoan('100' + _18_zeros, carol, carol, { from: carol, value: _1_Ether })
    await borrowerOperations.openLoan('101' + _18_zeros, dennis, dennis, { from: dennis, value: _1_Ether })

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
      carol,
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

  it("redeemCollateral(): does nothing when argument _amount = 0 ", async () => {
    hintHelpers = await deployAndConnectHintHelpers(contractAddresses)
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    // Alice opens loan and transfers 500CLV to Erin, the would-be redeemer
    await borrowerOperations.openLoan(mv._500e18, alice, alice, { from: alice, value: mv._10_Ether })
    await clvToken.transfer(erin, mv._500e18, { from: alice })

    // B, C and D open loans
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._200e18, carol, carol, { from: carol, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._300e18, dennis, dennis, { from: dennis, value: mv._3_Ether })

    // Get coll, debt and ICR of B, C, D
    const whale_coll_before = (await cdpManager.CDPs(whale))[1].toString()
    const alice_coll_before = (await cdpManager.CDPs(alice))[1].toString()
    const bob_coll_before = (await cdpManager.CDPs(bob))[1].toString()
    const carol_coll_before = (await cdpManager.CDPs(carol))[1].toString()

    const whale_debt_before = (await cdpManager.CDPs(whale))[0].toString()
    const alice_debt_before = (await cdpManager.CDPs(alice))[0].toString()
    const bob_debt_before = (await cdpManager.CDPs(bob))[0].toString()
    const carol_debt_before = (await cdpManager.CDPs(carol))[0].toString()

    let price = await priceFeed.getPrice()
    const whale_ICR_before = (await cdpManager.getCurrentICR(whale, price)).toString()
    const alice_ICR_before = (await cdpManager.getCurrentICR(alice, price)).toString()
    const bob_ICR_before = (await cdpManager.getCurrentICR(bob, price)).toString()
    const carol_ICR_before = (await cdpManager.getCurrentICR(carol, price)).toString()

    const TCR_before = (await poolManager.getTCR()).toString()

    const erin_CLVBalance_before = (await clvToken.balanceOf(erin)).toString()

    // Erin redeems with _amount = 0
    await cdpManager.redeemCollateral(0, erin, erin, 0, erin, { from: erin })

    // Get coll, debt and ICR of B, C, D
    const whale_coll_after = (await cdpManager.CDPs(whale))[1].toString()
    const alice_coll_after = (await cdpManager.CDPs(alice))[1].toString()
    const bob_coll_after = (await cdpManager.CDPs(bob))[1].toString()
    const carol_coll_after = (await cdpManager.CDPs(carol))[1].toString()

    const whale_debt_after = (await cdpManager.CDPs(whale))[0].toString()
    const alice_debt_after = (await cdpManager.CDPs(alice))[0].toString()
    const bob_debt_after = (await cdpManager.CDPs(bob))[0].toString()
    const carol_debt_after = (await cdpManager.CDPs(carol))[0].toString()

    price = await priceFeed.getPrice()
    const whale_ICR_after = (await cdpManager.getCurrentICR(whale, price)).toString()
    const alice_ICR_after = (await cdpManager.getCurrentICR(alice, price)).toString()
    const bob_ICR_after = (await cdpManager.getCurrentICR(bob, price)).toString()
    const carol_ICR_after = (await cdpManager.getCurrentICR(carol, price)).toString()

    const TCR_after = (await poolManager.getTCR()).toString()

    const erin_CLVBalance_after = (await clvToken.balanceOf(erin)).toString()

    // Check coll, debt and ICR of all troves have not changed
    assert.equal(whale_coll_before, whale_coll_after)
    assert.equal(alice_coll_before, alice_coll_after)
    assert.equal(bob_coll_before, bob_coll_after)
    assert.equal(carol_coll_before, carol_coll_after)

    assert.equal(whale_debt_before, whale_debt_after)
    assert.equal(alice_debt_before, alice_debt_after)
    assert.equal(bob_debt_before, bob_debt_after)
    assert.equal(carol_debt_before, carol_debt_after)

    assert.equal(whale_ICR_before, whale_ICR_after)
    assert.equal(alice_ICR_before, alice_ICR_after)
    assert.equal(bob_ICR_before, bob_ICR_after)
    assert.equal(carol_ICR_before, carol_ICR_after)

    // check system TCR has not changed
    assert.equal(TCR_before, TCR_after)

    // Check Erin (redeemer) token balance has not changed
    assert.equal(erin_CLVBalance_before, erin_CLVBalance_after)
  })


  it("redeemCollateral(): doesn't affect the Stability Pool deposits or ETH gain of redeemed-from troves", async () => {
    hintHelpers = await deployAndConnectHintHelpers(contractAddresses)

    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    // Alice opens loan and transfers 400CLV to Erin, the would-be redeemer
    await borrowerOperations.openLoan(mv._500e18, alice, alice, { from: alice, value: mv._10_Ether })
    await clvToken.transfer(erin, mv._400e18, { from: alice })

    // B, C, D, F open loan
    await borrowerOperations.openLoan(mv._100e18, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._200e18, carol, carol, { from: carol, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._300e18, dennis, dennis, { from: dennis, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._100e18, flyn, flyn, { from: flyn, value: mv._1_Ether })

    // B, C, D deposit some of their tokens to the Stability Pool
    await poolManager.provideToSP(mv._50e18, { from: bob })
    await poolManager.provideToSP(mv._150e18, { from: carol })
    await poolManager.provideToSP(mv._200e18, { from: dennis })

    let price = await priceFeed.getPrice()
    const bob_ICR_before = await cdpManager.getCurrentICR(bob, price)
    const carol_ICR_before = await cdpManager.getCurrentICR(carol, price)
    const dennis_ICR_before = await cdpManager.getCurrentICR(dennis, price)

    // Price drops
    await priceFeed.setPrice(mv._100e18)

    assert.isTrue(await sortedCDPs.contains(flyn))

    // Liquidate Flyn
    await cdpManager.liquidate(flyn)
    assert.isFalse(await sortedCDPs.contains(flyn))

    // Price bounces back, bringing B, C, D back above MCR
    await priceFeed.setPrice(mv._200e18)

    const bob_SPDeposit_before = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
    const carol_SPDeposit_before = (await poolManager.getCompoundedCLVDeposit(carol)).toString()
    const dennis_SPDeposit_before = (await poolManager.getCompoundedCLVDeposit(dennis)).toString()

    const bob_ETHGain_before = (await poolManager.getCurrentETHGain(bob)).toString()
    const carol_ETHGain_before = (await poolManager.getCurrentETHGain(carol)).toString()
    const dennis_ETHGain_before = (await poolManager.getCurrentETHGain(dennis)).toString()

    // Check the remaining CLV and ETH in Stability Pool after liquidation is non-zero
    const CLVinSP = await stabilityPool.getCLV()
    const ETHinSP = await stabilityPool.getETH()
    assert.isTrue(CLVinSP.gte(mv._zeroBN))
    assert.isTrue(ETHinSP.gte(mv._zeroBN))

    // Erin redeems 400 CLV
    await cdpManager.redeemCollateral(mv._400e18, erin, erin, 0, erin, { from: erin })

    price = await priceFeed.getPrice()
    const bob_ICR_after = await cdpManager.getCurrentICR(bob, price)
    const carol_ICR_after = await cdpManager.getCurrentICR(carol, price)
    const dennis_ICR_after = await cdpManager.getCurrentICR(dennis, price)

    // Check ICR of B, C and D troves has increased,i.e. they have been hit by redemptions
    assert.isTrue(bob_ICR_after.gte(bob_ICR_before))
    assert.isTrue(carol_ICR_after.gte(carol_ICR_before))
    assert.isTrue(dennis_ICR_after.gte(dennis_ICR_before))

    const bob_SPDeposit_after = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
    const carol_SPDeposit_after = (await poolManager.getCompoundedCLVDeposit(carol)).toString()
    const dennis_SPDeposit_after = (await poolManager.getCompoundedCLVDeposit(dennis)).toString()

    const bob_ETHGain_after = (await poolManager.getCurrentETHGain(bob)).toString()
    const carol_ETHGain_after = (await poolManager.getCurrentETHGain(carol)).toString()
    const dennis_ETHGain_after = (await poolManager.getCurrentETHGain(dennis)).toString()

    // Check B, C, D Stability Pool deposits and ETH gain have not been affected by redemptions from their troves
    assert.equal(bob_SPDeposit_before, bob_SPDeposit_after)
    assert.equal(carol_SPDeposit_before, carol_SPDeposit_after)
    assert.equal(dennis_SPDeposit_before, dennis_SPDeposit_after)

    assert.equal(bob_ETHGain_before, bob_ETHGain_after)
    assert.equal(carol_ETHGain_before, carol_ETHGain_after)
    assert.equal(dennis_ETHGain_before, dennis_ETHGain_after)
  })

  it("redeemCollateral(): caller can redeem their entire CLVToken balance", async () => {
    hintHelpers = await deployAndConnectHintHelpers(contractAddresses)
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    // Alice opens loan and transfers 400 CLV to Erin, the would-be redeemer
    await borrowerOperations.openLoan(mv._400e18, alice, alice, { from: alice, value: mv._10_Ether })
    await clvToken.transfer(erin, mv._400e18, { from: alice })

    // Check Erin's balance before
    const erin_balance_before = await clvToken.balanceOf(erin)
    assert.equal(erin_balance_before, mv._400e18)

    // B, C, D open loan
    await borrowerOperations.openLoan(mv._600e18, bob, bob, { from: bob, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._2000e18, carol, carol, { from: carol, value: mv._30_Ether })
    await borrowerOperations.openLoan(mv._2000e18, dennis, dennis, { from: dennis, value: mv._50_Ether })

    // Get active debt and coll before redemption
    const activePool_debt_before = (await activePool.getCLVDebt()).toString()
    const activePool_coll_before = (await activePool.getETH()).toString()

    assert.equal(activePool_debt_before, mv._5000e18)
    assert.equal(activePool_coll_before, mv._200_Ether)

    const price = await priceFeed.getPrice()
    // Erin attempts to redeem 400 CLV
    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(mv._400e18, price)

    const { 0: partialRedemptionHint } = await sortedCDPs.findInsertPosition(
      partialRedemptionHintICR,
      price,
      erin,
      erin
    )

    await cdpManager.redeemCollateral(
      mv._400e18,
      firstRedemptionHint,
      partialRedemptionHint,
      partialRedemptionHintICR,
      erin,
      { from: erin })

    // Check activePool debt reduced by only 400 CLV
    const activePool_debt_after = (await activePool.getCLVDebt()).toString()
    assert.equal(activePool_debt_after, '4600000000000000000000')

    /* Check ActivePool coll reduced by $400 worth of Ether: at ETH:USD price of $200, this should be 2 ETH.

    therefore remaining ActivePool ETH should be 198 */
    const activePool_coll_after = await activePool.getETH()
    assert.equal(activePool_coll_after, '198000000000000000000')

    // Check Erin's balance after
    const erin_balance_after = (await clvToken.balanceOf(erin)).toString()
    assert.equal(erin_balance_after, '0')
  })

  it("redeemCollateral(): reverts when requested redemption amount exceeds caller's CLV token balance", async () => {
    hintHelpers = await deployAndConnectHintHelpers(contractAddresses)
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    // Alice opens loan and transfers 400 CLV to Erin, the would-be redeemer
    await borrowerOperations.openLoan(mv._400e18, alice, alice, { from: alice, value: mv._10_Ether })
    await clvToken.transfer(erin, mv._400e18, { from: alice })

    // Check Erin's balance before
    const erin_balance_before = await clvToken.balanceOf(erin)
    assert.equal(erin_balance_before, mv._400e18)

    // B, C, D open loan
    await borrowerOperations.openLoan(mv._600e18, bob, bob, { from: bob, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._2000e18, carol, carol, { from: carol, value: mv._30_Ether })
    await borrowerOperations.openLoan(mv._2000e18, dennis, dennis, { from: dennis, value: mv._50_Ether })

    // Get active debt and coll before redemption
    const activePool_debt_before = (await activePool.getCLVDebt()).toString()
    const activePool_coll_before = (await activePool.getETH()).toString()

    assert.equal(activePool_debt_before, mv._5000e18)
    assert.equal(activePool_coll_before, mv._200_Ether)

    const price = await priceFeed.getPrice()

    let firstRedemptionHint
    let partialRedemptionHintICR

    // Erin tries to redeem 1000 CLV
    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintICR
      } = await hintHelpers.getRedemptionHints(mv._1000e18, price))

      const { 0: partialRedemptionHint_1 } = await sortedCDPs.findInsertPosition(
        partialRedemptionHintICR,
        price,
        erin,
        erin
      )

      const redemptionTx = await cdpManager.redeemCollateral(
        mv._1000e18,
        firstRedemptionHint,
        partialRedemptionHint_1,
        partialRedemptionHintICR,
        erin,
        { from: erin })

      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be >= user's CLV token balance")
    }

    // Erin tries to redeem 401 CLV
    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintICR
      } = await hintHelpers.getRedemptionHints('401000000000000000000', price))

      const { 0: partialRedemptionHint_2 } = await sortedCDPs.findInsertPosition(
        partialRedemptionHintICR,
        price,
        erin,
        erin
      )

      const redemptionTx = await cdpManager.redeemCollateral(
        '401000000000000000000', firstRedemptionHint,
        partialRedemptionHint_2,
        partialRedemptionHintICR,
        erin,
        { from: erin })
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be >= user's CLV token balance")
    }

    // Erin tries to redeem 239482309 CLV
    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintICR
      } = await hintHelpers.getRedemptionHints('239482309000000000000000000', price))

      const { 0: partialRedemptionHint_3 } = await sortedCDPs.findInsertPosition(
        partialRedemptionHintICR,
        price,
        erin,
        erin
      )

      const redemptionTx = await cdpManager.redeemCollateral(
        '239482309000000000000000000', firstRedemptionHint,
        partialRedemptionHint_3,
        partialRedemptionHintICR,
        erin,
        { from: erin })
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be >= user's CLV token balance")
    }

    // Erin tries to redeem 2^256 - 1 CLV
    const maxBytes32 = web3.utils.toBN('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintICR
      } = await hintHelpers.getRedemptionHints('239482309000000000000000000', price))

      const { 0: partialRedemptionHint_4 } = await sortedCDPs.findInsertPosition(
        partialRedemptionHintICR,
        price,
        erin,
        erin
      )

      const redemptionTx = await cdpManager.redeemCollateral(
        maxBytes32, firstRedemptionHint,
        partialRedemptionHint_4,
        partialRedemptionHintICR,
        erin,
        { from: erin })
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be >= user's CLV token balance")
    }
  })

  it("redeemCollateral(): value of issued ETH == face value of redeemed CLV (assuming 1 CLV has value of $1)", async () => {
    hintHelpers = await deployAndConnectHintHelpers(contractAddresses)
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

    // Alice opens loan and transfers 1000 CLV each to Erin, Flyn, Graham
    await borrowerOperations.openLoan(mv._5000e18, alice, alice, { from: alice, value: mv._100_Ether })
    await clvToken.transfer(erin, mv._1000e18, { from: alice })
    await clvToken.transfer(flyn, mv._1000e18, { from: alice })
    await clvToken.transfer(graham, mv._1000e18, { from: alice })

    // B, C, D open loan
    await borrowerOperations.openLoan(mv._600e18, bob, bob, { from: bob, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._2000e18, carol, carol, { from: carol, value: mv._30_Ether })
    await borrowerOperations.openLoan(mv._2000e18, dennis, dennis, { from: dennis, value: mv._40_Ether })

    const price = await priceFeed.getPrice()

    const _120_CLV = '120000000000000000000'
    const _373_CLV = '373000000000000000000'
    const _950_CLV = '950000000000000000000'

    // Expect 280 Ether in activePool 
    const activeETH_0 = (await activePool.getETH()).toString()
    assert.equal(activeETH_0, '280000000000000000000');

    let firstRedemptionHint
    let partialRedemptionHintICR


    // Erin redeems 120 CLV
    ({
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(_120_CLV, price))

    const { 0: partialRedemptionHint_1 } = await sortedCDPs.findInsertPosition(
      partialRedemptionHintICR,
      price,
      erin,
      erin
    )

    const redemption_1 = await cdpManager.redeemCollateral(
      _120_CLV,
      firstRedemptionHint,
      partialRedemptionHint_1,
      partialRedemptionHintICR,
      erin,
      { from: erin })

    assert.isTrue(redemption_1.receipt.status);

    /* 120 CLV redeemed.  Expect $120 worth of ETH removed. At ETH:USD price of $200, 
    ETH removed = (120/200) = 0.6 ETH
    Total active ETH = 280 - 0.6 = 279.4 ETH */

    const activeETH_1 = (await activePool.getETH()).toString()
    assert.equal(activeETH_1, '279400000000000000000');

    // Flyn redeems 373 CLV
    ({
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(_373_CLV, price))

    const { 0: partialRedemptionHint_2 } = await sortedCDPs.findInsertPosition(
      partialRedemptionHintICR,
      price,
      flyn,
      flyn
    )

    const redemption_2 = await cdpManager.redeemCollateral(
      _373_CLV,
      firstRedemptionHint,
      partialRedemptionHint_2,
      partialRedemptionHintICR,
      flyn,
      { from: flyn })

    assert.isTrue(redemption_2.receipt.status);

    /* 373 CLV redeemed.  Expect $373 worth of ETH removed. At ETH:USD price of $200, 
    ETH removed = (373/200) = 1.865 ETH
    Total active ETH = 279.4 - 1.865 = 277.535 ETH */
    const activeETH_2 = (await activePool.getETH()).toString()
    assert.equal(activeETH_2, '277535000000000000000');

    // Graham redeems 950 CLV
    ({
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(_950_CLV, price))

    const { 0: partialRedemptionHint_3 } = await sortedCDPs.findInsertPosition(
      partialRedemptionHintICR,
      price,
      graham,
      graham
    )

    const redemption_3 = await cdpManager.redeemCollateral(
      _950_CLV,
      firstRedemptionHint,
      partialRedemptionHint_3,
      partialRedemptionHintICR,
      graham,
      { from: graham })

    assert.isTrue(redemption_3.receipt.status);

    /* 950 CLV redeemed.  Expect $950 worth of ETH removed. At ETH:USD price of $200, 
    ETH removed = (950/200) = 4.75 ETH
    Total active ETH = 277.535 - 4.75 = 272.785 ETH */
    const activeETH_3 = (await activePool.getETH()).toString()
    assert.equal(activeETH_3, '272785000000000000000');
  })

  it("redeemCollateral(): reverts if there is zero outstanding system debt", async () => {
    hintHelpers = await deployAndConnectHintHelpers(contractAddresses)
    // --- SETUP --- mock Alice as poolManager address in CLVTokenContract to ilegally mint CLV to Bob
    await clvToken.setPoolManagerAddress(alice)
    await clvToken.mint(bob, mv._100e18, { from: alice })

    assert.equal((await clvToken.balanceOf(bob)), mv._100e18)

    // Set poolManager in clvToken back to correct address
    await clvToken.setPoolManagerAddress(poolManager.address)

    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._10_Ether })
    await borrowerOperations.openLoan(0, carol, carol, { from: carol, value: mv._30_Ether })
    await borrowerOperations.openLoan(0, dennis, dennis, { from: dennis, value: mv._40_Ether })

    const price = await priceFeed.getPrice()

    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(mv._100e18, price)

    const { 0: partialRedemptionHint } = await sortedCDPs.findInsertPosition(
      partialRedemptionHintICR,
      price,
      bob,
      bob
    )

    // Bob tries to redeem his illegally obtained CLV
    try {
      const redemptionTx = await cdpManager.redeemCollateral(
        mv._100e18,
        firstRedemptionHint,
        partialRedemptionHint,
        partialRedemptionHintICR,
        bob,
        { from: bob })
      assert.isFalse(redemptionTx.receipt.status);
    } catch (error) {
      assert.include(error.message, "revert")
    }
  })

  it("redeemCollateral(): reverts if caller's tries to redeem more than the outstanding system debt", async () => {
    hintHelpers = await deployAndConnectHintHelpers(contractAddresses)
    // --- SETUP --- mock Alice as poolManager address in CLVTokenContract to ilegally mint CLV to Bob
    await clvToken.setPoolManagerAddress(alice)
    await clvToken.mint(bob, '101000000000000000000', { from: alice })

    assert.equal((await clvToken.balanceOf(bob)), '101000000000000000000')

    // Set poolManager in clvToken back to correct address
    await clvToken.setPoolManagerAddress(poolManager.address)

    await borrowerOperations.openLoan(mv._50e18, carol, carol, { from: carol, value: mv._30_Ether })
    await borrowerOperations.openLoan(mv._50e18, dennis, dennis, { from: dennis, value: mv._40_Ether })

    assert.equal((await activePool.getCLVDebt()).toString(), mv._100e18)

    const price = await priceFeed.getPrice()
    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints('101000000000000000000', price)

    const { 0: partialRedemptionHint } = await sortedCDPs.findInsertPosition(
      partialRedemptionHintICR,
      price,
      bob,
      bob
    )

    // Bob attempts to redeem his ill-gotten 101 CLV, from a system that only has 100 CLV outstanding debt
    try {
      const redemptionTx = await cdpManager.redeemCollateral(
        mv._100e18,
        firstRedemptionHint,
        partialRedemptionHint,
        partialRedemptionHintICR,
        bob,
        { from: bob })
      assert.isFalse(redemptionTx.receipt.status);
    } catch (error) {
      assert.include(error.message, "revert")
    }
  })

  it("getPendingCLVDebtReward(): Returns 0 if there is no pending CLVDebt reward", async () => {
    // make some loans
    const price = await priceFeed.getPrice()
    await borrowerOperations.openLoan(mv._2000e18, whale, whale, { from: whale, value: mv._100_Ether })
    await poolManager.provideToSP(mv._2000e18, { from: whale })

    await borrowerOperations.openLoan(mv._100e18, defaulter_1, dummyHint, { from: defaulter_1, value: mv._1_Ether })

    await borrowerOperations.openLoan(mv._20e18, carol, carol, { from: carol, value: mv._1_Ether })

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
    await borrowerOperations.openLoan(mv._2000e18, whale, whale, { from: whale, value: mv._100_Ether })
    await poolManager.provideToSP(mv._2000e18, { from: whale })

    await borrowerOperations.openLoan(mv._100e18, defaulter_1, dummyHint, { from: defaulter_1, value: mv._1_Ether })

    await borrowerOperations.openLoan(mv._20e18, carol, carol, { from: carol, value: mv._1_Ether })

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
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._100_Ether })

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

    await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, bob, { from: bob, value: mv._3_Ether })

    await priceFeed.setPrice('99999999999999999999')

    const TCR = (await poolManager.getTCR())

    assert.isTrue(TCR.lte(web3.utils.toBN('1500000000000000000')))

    assert.isTrue(await cdpManager.checkRecoveryMode())
  })

  // TCR == 150%
  it("checkRecoveryMode(): Returns false when TCR == 150%", async () => {
    await priceFeed.setPrice(mv._100e18)

    await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, bob, { from: bob, value: mv._3_Ether })

    await priceFeed.setPrice('100000000000000000001')

    const TCR = (await poolManager.getTCR())

    assert.isTrue(TCR.gte(web3.utils.toBN('1500000000000000000')))

    assert.isFalse(await cdpManager.checkRecoveryMode())
  })

  // > 150%
  it("checkRecoveryMode(): Returns false when TCR > 150%", async () => {
    await priceFeed.setPrice(mv._100e18)

    await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, bob, { from: bob, value: mv._3_Ether })

    const TCR = (await poolManager.getTCR()).toString()

    assert.equal(TCR, '1500000000000000000')

    assert.isFalse(await cdpManager.checkRecoveryMode())
  })

  //check max
  it("checkRecoveryMode(): Returns false when TCR == maxBytes32", async () => {
    await priceFeed.setPrice(mv._100e18)

    await borrowerOperations.openLoan(0, alice, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(0, bob, bob, { from: bob, value: mv._3_Ether })

    const TCR = web3.utils.toHex(await poolManager.getTCR()).toString()

    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    assert.equal(TCR, maxBytes32)

    assert.isFalse(await cdpManager.checkRecoveryMode())
  })

  // check 0
  it("checkRecoveryMode(): Returns false when TCR == 0", async () => {
    await priceFeed.setPrice(mv._100e18)

    await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._200e18, bob, bob, { from: bob, value: mv._3_Ether })

    await priceFeed.setPrice(0)

    const TCR = (await poolManager.getTCR()).toString()

    assert.equal(TCR, 0)

    assert.isTrue(await cdpManager.checkRecoveryMode())
  })

  // --- liquidateTrovesInRange() ---

  it('liquidateTrovesInRange(): closes every CDP with ICR < MCR and collateral in size range, when n > number of undercollateralized troves', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(mv._500e18, whale, whale, { from: whale, value: mv._100_Ether })

    // create 5 troves in size range 18
    await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._150e18, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._300e18, carol, carol, { from: carol, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._5e18, erin, erin, { from: erin, value: mv._5_Ether })
    await borrowerOperations.openLoan(mv._10e18, flyn, flyn, { from: flyn, value: mv._5_Ether })

    // create 4 troves in size range 19
    await borrowerOperations.openLoan(mv._1000e18, graham, graham, { from: graham, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._1500e18, harriet, harriet, { from: harriet, value: mv._15_Ether })
    await borrowerOperations.openLoan(mv._300e18, ida, ida, { from: ida, value: mv._40_Ether })
    await borrowerOperations.openLoan('50', jake, jake, { from: jake, value: mv._50_Ether })

    // Check full sorted list size is 10
    assert.equal((await sortedCDPs.getSize()).toString(), '10')
    // Check sizeList 18 size is 5
    assert.equal((await sizeList_18orLess.getSize()).toString(), '5')
    //Check sizeList 19 sizee is 4
    assert.equal((await sizeList_19orGreater.getSize()).toString(), '5')

    // Whale puts some tokens in Stability Pool
    await poolManager.provideToSP(mv._300e18, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100CLV, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(mv._100e18);
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Confirm troves A-C are ICR < 110%
    assert.isTrue((await cdpManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(carol, price)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await cdpManager.getCurrentICR(erin, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(flyn, price)).gte(mv._MCR))

    // Confirm Whale is ICR > 110% 
    assert.isTrue((await cdpManager.getCurrentICR(whale, price)).gte(mv._MCR))

    // Liquidate up to 5 troves, izeRange 18
    await cdpManager.liquidateTrovesInRange(5, 18);

    // Confirm troves A-C have been removed from the system
    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))

    // Check all troves A-C are now closed
    assert.equal((await cdpManager.CDPs(alice))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(bob))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(carol))[3].toString(), '2')

    // Check sorted list has been reduced to length 7
    assert.equal((await sortedCDPs.getSize()).toString(), '7')
    // Check sizeList 18 size is 2
    assert.equal((await sizeList_18orLess.getSize()).toString(), '2')
    //Check sizeList 19 size is 4
    assert.equal((await sizeList_19orGreater.getSize()).toString(), '5')
  })

  //TODO
  it('liquidateTrovesInRange(): Doesnt impact troves with ICR > MCR', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(mv._500e18, whale, whale, { from: whale, value: mv._100_Ether })

    // create 5 troves in size range 18
    await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._150e18, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._300e18, carol, carol, { from: carol, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._5e18, erin, erin, { from: erin, value: mv._5_Ether })
    await borrowerOperations.openLoan(mv._10e18, flyn, flyn, { from: flyn, value: mv._5_Ether })

    // create 4 troves in size range 19
    await borrowerOperations.openLoan(mv._1000e18, graham, graham, { from: graham, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._1500e18, harriet, harriet, { from: harriet, value: mv._15_Ether })
    await borrowerOperations.openLoan(mv._300e18, ida, ida, { from: ida, value: mv._40_Ether })
    await borrowerOperations.openLoan('50', jake, jake, { from: jake, value: mv._50_Ether })

    // Check full sorted list size is 10
    assert.equal((await sortedCDPs.getSize()).toString(), '10')
    // Check sizeList 18 size is 5
    assert.equal((await sizeList_18orLess.getSize()).toString(), '5')
    //Check sizeList 19 sizee is 4
    assert.equal((await sizeList_19orGreater.getSize()).toString(), '5')

    // Whale puts some tokens in Stability Pool
    await poolManager.provideToSP(mv._300e18, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100CLV, reducing A, B, C and I, J  ICR below MCR
    await priceFeed.setPrice(mv._100e18);
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Confirm troves A-C are ICR < 110%
    assert.isTrue((await cdpManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(carol, price)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await cdpManager.getCurrentICR(erin, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(flyn, price)).gte(mv._MCR))

    // Confirm G, H are ICR < 110%
    assert.isTrue((await cdpManager.getCurrentICR(graham, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(harriet, price)).lt(mv._MCR))

    // Confirm I, J are ICR > 110%
    assert.isTrue((await cdpManager.getCurrentICR(erin, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(flyn, price)).gte(mv._MCR))

    // Confirm Whale is ICR > 110% 
    assert.isTrue((await cdpManager.getCurrentICR(whale, price)).gte(mv._MCR))

    // Liquidate up to 5 troves, sizeRange 18
    await cdpManager.liquidateTrovesInRange(5, 18);

     // Liquidate up to 5 troves, izeRange 19
     await cdpManager.liquidateTrovesInRange(5, 19);

    // Confirm troves D, E remain active
    assert.isTrue(await sortedCDPs.contains(flyn))
    assert.isTrue(await sortedCDPs.contains(erin))
    assert.isTrue(await sizeList_18orLess.contains(flyn))
    assert.isTrue(await sizeList_18orLess.contains(erin))
    assert.equal((await cdpManager.CDPs(flyn))[3].toString(), '1')
    assert.equal((await cdpManager.CDPs(erin))[3].toString(), '1')

    // Confirm troves G, H remain active
    assert.isTrue(await sortedCDPs.contains(ida))
    assert.isTrue(await sortedCDPs.contains(jake))
    assert.isTrue(await sizeList_19orGreater.contains(ida))
    assert.isTrue(await sizeList_19orGreater.contains(jake))
    assert.equal((await cdpManager.CDPs(ida))[3].toString(), '1')
    assert.equal((await cdpManager.CDPs(jake))[3].toString(), '1')

    // Check sorted list has been reduced to length 5
    assert.equal((await sortedCDPs.getSize()).toString(), '5')
    // Check sizeList 18 size is 2
    assert.equal((await sizeList_18orLess.getSize()).toString(), '2')
    //Check sizeList 19 size is 4
    assert.equal((await sizeList_19orGreater.getSize()).toString(), '3')
  })

  it('liquidateTrovesInRange(): Doesnt impact troves with collateral outside the specified range', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(mv._500e18, whale, whale, { from: whale, value: mv._100_Ether })

    // create 5 troves in size range 18
    await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._150e18, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._300e18, carol, carol, { from: carol, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._5e18, erin, erin, { from: erin, value: mv._5_Ether })
    await borrowerOperations.openLoan(mv._10e18, flyn, flyn, { from: flyn, value: mv._5_Ether })

    // create 4 troves in size range 19
    await borrowerOperations.openLoan(mv._1000e18, graham, graham, { from: graham, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._1500e18, harriet, harriet, { from: harriet, value: mv._15_Ether })
    await borrowerOperations.openLoan(mv._300e18, ida, ida, { from: ida, value: mv._40_Ether })
    await borrowerOperations.openLoan('50', jake, jake, { from: jake, value: mv._50_Ether })

    // Check full sorted list size is 10
    assert.equal((await sortedCDPs.getSize()).toString(), '10')
    // Check sizeList 18 size is 5
    assert.equal((await sizeList_18orLess.getSize()).toString(), '5')
    //Check sizeList 19 size is 4
    assert.equal((await sizeList_19orGreater.getSize()).toString(), '5')

    // Whale puts some tokens in Stability Pool
    await poolManager.provideToSP(mv._300e18, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100CLV, reducing A, B, C, D, E ICR below MCR
    await priceFeed.setPrice(mv._100e18);
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Confirm troves A-C are ICR < 110%
    assert.isTrue((await cdpManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(carol, price)).lt(mv._MCR))

    // Confirm G, H are also ICR < 110%
    assert.isTrue((await cdpManager.getCurrentICR(graham, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(harriet, price)).lt(mv._MCR))

    // Confirm Whale is ICR > 110% 
    assert.isTrue((await cdpManager.getCurrentICR(whale, price)).gte(mv._MCR))

    // Liquidate up to 5 troves, sizeRange 18
    await cdpManager.liquidateTrovesInRange(5, 18);

    // Check sorted list has been reduced to length 6
    assert.equal((await sortedCDPs.getSize()).toString(), '7')
    // Check sizeList 18 size is 2
    assert.equal((await sizeList_18orLess.getSize()).toString(), '2')
    //Check sizeList 19 size is 4
    assert.equal((await sizeList_19orGreater.getSize()).toString(), '5')

    // Confirm that troves G, H have not been closed and are still active
    assert.isTrue(await sortedCDPs.contains(graham))
    assert.isTrue(await sortedCDPs.contains(harriet))
    assert.isTrue(await sizeList_19orGreater.contains(graham))
    assert.isTrue(await sizeList_19orGreater.contains(harriet))
    assert.equal((await cdpManager.CDPs(graham))[3].toString(), '1')
    assert.equal((await cdpManager.CDPs(harriet))[3].toString(), '1')
  })

  it('liquidateTrovesInRange(): Can liquidate undercollateralized troves in every valid size range passed as arg', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(mv._500e18, whale, whale, { from: whale, value: mv._100_Ether })

    // create 2 troves in size range 18
    await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._150e18, bob, bob, { from: bob, value: mv._1_Ether })

    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isTrue(await sortedCDPs.contains(bob))
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_18orLess.contains(bob))

    // Check sizeList 18 size is 2
    assert.equal((await sizeList_18orLess.getSize()).toString(), '2')

    // create 2 troves in size range 19
    await borrowerOperations.openLoan(mv._1000e18, graham, graham, { from: graham, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._1500e18, harriet, harriet, { from: harriet, value: mv._15_Ether })

    assert.isTrue(await sortedCDPs.contains(graham))
    assert.isTrue(await sortedCDPs.contains(harriet))
    assert.isTrue(await sizeList_19orGreater.contains(graham))
    assert.isTrue(await sizeList_19orGreater.contains(harriet))

    // Check sizeList 19 size is 3
    assert.equal((await sizeList_19orGreater.getSize()).toString(), '3')

    // --- TEST ---

    // Price drops to 1ETH:100CLV, reducing A, B, G, H ICR below MCR
    await priceFeed.setPrice(mv._100e18);
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Liquidate 2 troves in sizeRange 18
    await cdpManager.liquidateTrovesInRange(2, 18);

    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sizeList_18orLess.contains(alice))
    assert.isFalse(await sizeList_18orLess.contains(bob))

    // Check sizeList 18 size is 0
    assert.equal((await sizeList_18orLess.getSize()).toString(), '0')

    // Liquidate 2 troves, sizeRange 19
    await cdpManager.liquidateTrovesInRange(2, 19);

    assert.isFalse(await sortedCDPs.contains(graham))
    assert.isFalse(await sortedCDPs.contains(harriet))
    assert.isFalse(await sizeList_19orGreater.contains(graham))
    assert.isFalse(await sizeList_19orGreater.contains(harriet))

    // Check sizeList 19 size is 1
    assert.equal((await sizeList_19orGreater.getSize()).toString(), '1')
  })

  it('liquidateTrovesInRange(): A liquidation sequence containing Pool offsets increases the TCR', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(mv._500e18, whale, whale, { from: whale, value: mv._100_Ether })

    // create 5 troves in size range 18
    await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._150e18, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._300e18, carol, carol, { from: carol, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._5e18, erin, erin, { from: erin, value: mv._5_Ether })
    await borrowerOperations.openLoan(mv._10e18, flyn, flyn, { from: flyn, value: mv._5_Ether })

    // create 4 troves in size range 19
    await borrowerOperations.openLoan(mv._1000e18, graham, graham, { from: graham, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._1500e18, harriet, harriet, { from: harriet, value: mv._15_Ether })
    await borrowerOperations.openLoan(mv._300e18, ida, ida, { from: ida, value: mv._40_Ether })
    await borrowerOperations.openLoan('50', jake, jake, { from: jake, value: mv._50_Ether })

    // Whale puts some tokens in Stability Pool
    await poolManager.provideToSP(mv._300e18, { from: whale })

    // Price drops to 1ETH:100CLV, reducing A, B, G, H ICR below MCR
    await priceFeed.setPrice(mv._100e18);
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    const troveCount_Before = await sortedCDPs.getSize()
    const CLVinSP_Before = await stabilityPool.getCLV()
    const TCR_Before = await cdpManager.getTCR()

    // Liquidate 2 troves in sizeRange 18
    await cdpManager.liquidateTrovesInRange(2, 18);

    const troveCount_After = await sortedCDPs.getSize()
    const CLVinSP_After = await stabilityPool.getCLV()
    const TCR_After = await cdpManager.getTCR()

    // Check number of troves ihas decreased
    assert.isTrue(troveCount_After.lt(troveCount_Before))

    // Check CLV in Stability Pool has decreased
    assert.isTrue(CLVinSP_After.lt(CLVinSP_Before))

    // Check TCR has increased from liquidations
    assert.isTrue(TCR_After.gt(TCR_Before))
  })

  it("liquidateTrovesInRange(): Liquidating troves with SP deposits correctly impacts their SP deposit and ETH gain", async () => {
    // Whale provides 400 CLV to the SP
    await borrowerOperations.openLoan(mv._400e18, whale, whale, { from: whale, value: mv._100_Ether })
    await poolManager.provideToSP(mv._400e18, { from: whale })

    await borrowerOperations.openLoan(mv._100e18, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._300e18, bob, bob, { from: bob, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._100e18, carol, carol, { from: carol, value: mv._1_Ether })

    // A, B provide 100, 300 to the SP
    await poolManager.provideToSP(mv._100e18, { from: alice })
    await poolManager.provideToSP(mv._300e18, { from: bob })

    assert.equal((await sortedCDPs.getSize()).toString(), '4')

    // Price drops
    await priceFeed.setPrice(mv._100e18)

    // Check 800 CLV in Pool
    assert.equal((await stabilityPool.getCLV()).toString(), mv._800e18)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Liquidate
    await cdpManager.liquidateTrovesInRange(10, 18)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedCDPs.contains(alice)))
    assert.isFalse((await sortedCDPs.contains(bob)))
    assert.isFalse((await sortedCDPs.contains(carol)))

    // check system sized reduced to 1 troves
    assert.equal((await sortedCDPs.getSize()).toString(), '1')

    /* Prior to liquidation, SP deposits were:
    Whale: 400 CLV
    Alice: 100 CLV
    Bob:   300 CLV
    Carol: 0 CLV

    Total CLV in Pool: 800 CLV

    Then, liquidation hits A,B,C: 

    Total liquidated debt = 100 + 300 + 100 = 500 CLV
    Total liquidated ETH = 1 + 3 + 1 = 5 ETH

    Whale CLV Loss: 500 * (400/800) = 250 CLV
    Alice CLV Loss:  500 *(100/800) = 62.5 CLV
    Bob CLV Loss: 500 * (300/800) = 187.5 CLV

    Whale remaining deposit: (400 - 250) = 150 CLV
    Alice remaining deposit: (100 - 62.5) = 37.5 CLV
    Bob remaining deposit: (300 - 187.5) = 112.5 CLV

    Whale ETH Gain: 5 * (400/800) = 2.5 ETH
    Alice ETH Gain: 5 *(100/800) = 0.625 ETH
    Bob ETH Gain: 5 * (300/800) = 1.875 ETH

    Total remaining deposits: 300 CLV
    Total ETH gain: 5 ETH */

    // Check remaining CLV Deposits and ETH gain, for whale and depositors whose troves were liquidated
    const whale_Deposit_After = (await poolManager.getCompoundedCLVDeposit(whale)).toString()
    const alice_Deposit_After = (await poolManager.getCompoundedCLVDeposit(alice)).toString()
    const bob_Deposit_After = (await poolManager.getCompoundedCLVDeposit(bob)).toString()

    const whale_ETHGain = (await poolManager.getCurrentETHGain(whale)).toString()
    const alice_ETHGain = (await poolManager.getCurrentETHGain(alice)).toString()
    const bob_ETHGain = (await poolManager.getCurrentETHGain(bob)).toString()

    assert.isAtMost(th.getDifference(whale_Deposit_After, mv._150e18), 1000)
    assert.isAtMost(th.getDifference(alice_Deposit_After, '37500000000000000000'), 1000)
    assert.isAtMost(th.getDifference(bob_Deposit_After, '112500000000000000000'), 1000)

    assert.isAtMost(th.getDifference(whale_ETHGain, '2500000000000000000'), 1000)
    assert.isAtMost(th.getDifference(alice_ETHGain, '625000000000000000'), 1000)
    assert.isAtMost(th.getDifference(bob_ETHGain, '1875000000000000000'), 1000)

    // Check total remaining deposits and ETH gain in Stability Pool
    const total_CLVinSP = (await stabilityPool.getCLV()).toString()
    const total_ETHinSP = (await stabilityPool.getETH()).toString()

    assert.isAtMost(th.getDifference(total_CLVinSP, mv._300e18), 1000)
    assert.isAtMost(th.getDifference(total_ETHinSP, mv._5_Ether), 1000)
  })

  it('liquidateTrovesInRange(): A liquidation sequence of pure redistributions does not decrease the TCR', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(mv._500e18, whale, whale, { from: whale, value: mv._100_Ether })

    // create 5 troves in size range 18
    await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._150e18, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._300e18, carol, carol, { from: carol, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._5e18, erin, erin, { from: erin, value: mv._5_Ether })
    await borrowerOperations.openLoan(mv._10e18, flyn, flyn, { from: flyn, value: mv._5_Ether })

    // create 4 troves in size range 19
    await borrowerOperations.openLoan(mv._1000e18, graham, graham, { from: graham, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._1500e18, harriet, harriet, { from: harriet, value: mv._15_Ether })
    await borrowerOperations.openLoan(mv._300e18, ida, ida, { from: ida, value: mv._40_Ether })
    await borrowerOperations.openLoan('50', jake, jake, { from: jake, value: mv._50_Ether })

    // Price drops to 1ETH:100CLV, reducing A, B, G, H ICR below MCR
    await priceFeed.setPrice(mv._100e18);
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    const troveCount_Before = await sortedCDPs.getSize()
    const TCR_Before = await cdpManager.getTCR()

    // Liquidate 2 troves in sizeRange 18
    await cdpManager.liquidateTrovesInRange(2, 18);

    const troveCount_After = await sortedCDPs.getSize()
    const TCR_After = await cdpManager.getTCR()

    // Check number of troves ihas decreased
    assert.isTrue(troveCount_After.lt(troveCount_Before))

    // Check TCR has increased from liquidations
    assert.isTrue(TCR_After.eq(TCR_Before))
  })

  it('liquidateTrovesInRange(): liquidates only up to the requested number of undercollateralized trove', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(mv._500e18, whale, whale, { from: whale, value: mv._100_Ether })

    // Create 5 troves in size range 18
    await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._150e18, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._300e18, carol, carol, { from: carol, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._500e18, dennis, dennis, { from: dennis, value: mv._5_Ether })

    // Create 5 troves in size range 19
    await borrowerOperations.openLoan(mv._1000e18, graham, graham, { from: graham, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._1500e18, harriet, harriet, { from: harriet, value: mv._15_Ether })
    await borrowerOperations.openLoan('4500000000000000000000', ida, ida, { from: ida, value: mv._40_Ether })
    await borrowerOperations.openLoan(mv._5000e18, jake, jake, { from: jake, value: mv._50_Ether })

    // Check sizeList 18 size is 4
    assert.equal((await sizeList_18orLess.getSize()).toString(), '4')

    // Check sizeList 18 size is 5
    assert.equal((await sizeList_19orGreater.getSize()).toString(), '5')

    // Price drops to 1ETH:100CLV
    await priceFeed.setPrice(mv._100e18)
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Confirm troves A-J are <110% ICR
    assert.isTrue((await cdpManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(carol, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(dennis, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(graham, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(harriet, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(ida, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(jake, price)).lt(mv._MCR))

    // Liquidate up to 2 troves in sizeRange 18
    await cdpManager.liquidateTrovesInRange(2, 18);

    // Liquidate up to 3 troves in sizeRange 19
    await cdpManager.liquidateTrovesInRange(3, 19);

    // Check sizeList 18 size is 2
    assert.equal((await sizeList_18orLess.getSize()).toString(), '2')

    // Check sizeList 18 size is 2
    assert.equal((await sizeList_19orGreater.getSize()).toString(), '2')
  })

  it('liquidateTrovesInRange(): does nothing if all troves are > 110% ICR', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(mv._500e18, whale, whale, { from: whale, value: mv._100_Ether })

    // Create 5 troves in size range 18
    await borrowerOperations.openLoan('1', alice, alice, { from: alice, value: mv._2_Ether })
    await borrowerOperations.openLoan('2', bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan('3', carol, carol, { from: carol, value: mv._3_Ether })
    await borrowerOperations.openLoan('4', dennis, dennis, { from: dennis, value: mv._5_Ether })

    // Create 5 troves in size range 19
    await borrowerOperations.openLoan('5', graham, graham, { from: graham, value: mv._10_Ether })
    await borrowerOperations.openLoan('6', harriet, harriet, { from: harriet, value: mv._15_Ether })
    await borrowerOperations.openLoan('7', ida, ida, { from: ida, value: mv._40_Ether })
    await borrowerOperations.openLoan('8', jake, jake, { from: jake, value: mv._50_Ether })

    // Check sizeList 18 size is 4
    assert.equal((await sizeList_18orLess.getSize()).toString(), '4')

    // Check sizeList 18 size is 5
    assert.equal((await sizeList_19orGreater.getSize()).toString(), '5')

    // Price drops to 1ETH:100CLV
    await priceFeed.setPrice(mv._100e18)
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Confirm troves A-J are >=110% ICR
    assert.isTrue((await cdpManager.getCurrentICR(alice, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(bob, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(carol, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(dennis, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(graham, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(harriet, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(ida, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(jake, price)).gte(mv._MCR))

    // Liquidate up to 2 troves in sizeRange 18
    await cdpManager.liquidateTrovesInRange(2, 18);

    // Liquidate up to 3 troves in sizeRange 19
    await cdpManager.liquidateTrovesInRange(3, 19);

    // Check sizeList 18 size is still 4
    assert.equal((await sizeList_18orLess.getSize()).toString(), '4')

    // Check troves A-D are still in their respective lists
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isTrue(await sortedCDPs.contains(bob))
    assert.isTrue(await sortedCDPs.contains(carol))
    assert.isTrue(await sortedCDPs.contains(dennis))
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_18orLess.contains(bob))
    assert.isTrue(await sizeList_18orLess.contains(carol))
    assert.isTrue(await sizeList_18orLess.contains(dennis))

    // Check sizeList 19 size is still 5
    assert.equal((await sizeList_19orGreater.getSize()).toString(), '5')

    assert.isTrue(await sortedCDPs.contains(graham))
    assert.isTrue(await sortedCDPs.contains(harriet))
    assert.isTrue(await sortedCDPs.contains(ida))
    assert.isTrue(await sortedCDPs.contains(jake))
    assert.isTrue(await sizeList_19orGreater.contains(graham))
    assert.isTrue(await sizeList_19orGreater.contains(harriet))
    assert.isTrue(await sizeList_19orGreater.contains(ida))
    assert.isTrue(await sizeList_19orGreater.contains(jake))
  })


  it("liquidateTrovesInRange(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    const actualDebt_A = th.getDebtMinusVirtual(mv._50e18)
    const actualDebt_B = th.getDebtMinusVirtual('90500000000000000000')
    const actualDebt_C = th.getDebtMinusVirtual(mv._100e18)

    await borrowerOperations.openLoan(actualDebt_A, alice, alice, { from: alice, value: mv._1_Ether })
    await borrowerOperations.openLoan(actualDebt_B, bob, bob, { from: bob, value: mv._1_Ether })  // 90.5 CLV, 1 ETH
    await borrowerOperations.openLoan(actualDebt_C, carol, carol, { from: carol, value: mv._1_Ether })

    // Defaulter opens with 30 CLV, 0.3 ETH
    const actualDebt_D = th.getDebtMinusVirtual(mv._30e18)
    await borrowerOperations.openLoan(actualDebt_D, defaulter_1, dummyHint, { from: defaulter_1, value: mv._3e17 })

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
    assert.isTrue(carol_ICR_Before.lt(mv._MCR))

    // Liquidate defaulter. 30 CLV and ~0.3 ETH is distributed uniformly between A, B and C. Each receive 10 CLV, 0.1 ETH
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
    assert.isTrue(bob_ICR_After.lt(mv._MCR))
    assert.isTrue(carol_ICR_After.lt(mv._MCR))

    /* Though Bob's true ICR (including pending rewards) is below the MCR, check that Bob's raw coll and debt has not changed */
    const bob_Coll = (await cdpManager.CDPs(bob))[1]
    const bob_Debt = (await cdpManager.CDPs(bob))[0]

    const bob_rawICR = bob_Coll.mul(mv._100e18BN).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    // Whale enters system, pulling it into Normal Mode
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._10_Ether })

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    //liquidate A, B, C
    await cdpManager.liquidateTrovesInRange(10, 18)

    // Check A stays active, B and C get liquidated
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sizeList_18orLess.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))
    assert.isFalse(await sizeList_18orLess.contains(carol))

    // check trove statuses - A active (1),  B and C closed (2)
    assert.equal((await cdpManager.CDPs(alice))[3].toString(), '1')
    assert.equal((await cdpManager.CDPs(bob))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(carol))[3].toString(), '2')
  })

  it('liquidateTrovesInRange(): Doesnt impact the token balance of the liquidated trove owners', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(mv._500e18, whale, whale, { from: whale, value: mv._100_Ether })

    // create 5 troves in size range 18
    await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._150e18, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._300e18, carol, carol, { from: carol, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._5e18, erin, erin, { from: erin, value: mv._5_Ether })
    await borrowerOperations.openLoan(mv._10e18, flyn, flyn, { from: flyn, value: mv._5_Ether })

    // create 4 troves in size range 19
    await borrowerOperations.openLoan(mv._1000e18, graham, graham, { from: graham, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._2000e18, harriet, harriet, { from: harriet, value: mv._15_Ether })
    await borrowerOperations.openLoan(mv._300e18, ida, ida, { from: ida, value: mv._40_Ether })
    await borrowerOperations.openLoan('50', jake, jake, { from: jake, value: mv._50_Ether })

    // Whale puts some tokens in Stability Pool
    await poolManager.provideToSP(mv._300e18, { from: whale })

    // Price drops to 1ETH:100CLV, reducing A, B, G, H ICR below MCR
    await priceFeed.setPrice(mv._100e18);
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Get token balances before
    const A_balance_Before = await clvToken.balanceOf(alice)
    const B_balance_Before = await clvToken.balanceOf(bob)
    const C_balance_Before = await clvToken.balanceOf(carol)
    const G_balance_Before = await clvToken.balanceOf(graham)
    const H_balance_Before = await clvToken.balanceOf(harriet)

    assert.isTrue(A_balance_Before.gt(th.toBN('0')))
    assert.isTrue(B_balance_Before.gt(th.toBN('0')))
    assert.isTrue(C_balance_Before.gt(th.toBN('0')))
    assert.isTrue(G_balance_Before.gt(th.toBN('0')))
    assert.isTrue(H_balance_Before.gt(th.toBN('0')))

    // Liquidate 10 troves in sizeRange 18 and 19
    await cdpManager.liquidateTrovesInRange(10, 18);
    await cdpManager.liquidateTrovesInRange(10, 19);

    // confirm A, B, C, G, H were liquidated
    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))
    assert.isFalse(await sortedCDPs.contains(graham))
    assert.isFalse(await sortedCDPs.contains(harriet))
   
    assert.isFalse(await sizeList_18orLess.contains(alice))
    assert.isFalse(await sizeList_18orLess.contains(bob))
    assert.isFalse(await sizeList_18orLess.contains(carol))

    assert.isFalse(await sizeList_19orGreater.contains(bob))
    assert.isFalse(await sizeList_19orGreater.contains(carol))

    assert.equal((await cdpManager.CDPs(alice))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(bob))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(carol))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(graham))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(harriet))[3].toString(), '2')

    // Get token balances after
    const A_balance_After = await clvToken.balanceOf(alice)
    const B_balance_After = await clvToken.balanceOf(bob)
    const C_balance_After = await clvToken.balanceOf(carol)
    const G_balance_After = await clvToken.balanceOf(graham)
    const H_balance_After = await clvToken.balanceOf(harriet)

    // Check token balances of liquidated troves have not changed
    assert.isTrue(A_balance_Before.eq(A_balance_After))
    assert.isTrue(B_balance_Before.eq(B_balance_After))
    assert.isTrue(C_balance_Before.eq(C_balance_After))
    assert.isTrue(G_balance_Before.eq(G_balance_After))
    assert.isTrue(H_balance_Before.eq(H_balance_After))
  })

  it('liquidateTrovesInRange(): does nothing if n = 0', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(mv._500e18, whale, whale, { from: whale, value: mv._100_Ether })

    // Create 5 troves in size range 18
    await borrowerOperations.openLoan(mv._200e18, alice, alice, { from: alice, value: mv._2_Ether })
    await borrowerOperations.openLoan(mv._150e18, bob, bob, { from: bob, value: mv._1_Ether })
    await borrowerOperations.openLoan(mv._300e18, carol, carol, { from: carol, value: mv._3_Ether })
    await borrowerOperations.openLoan(mv._500e18, dennis, dennis, { from: dennis, value: mv._5_Ether })

    // Create 5 troves in size range 19
    await borrowerOperations.openLoan(mv._1000e18, graham, graham, { from: graham, value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._1500e18, harriet, harriet, { from: harriet, value: mv._15_Ether })
    await borrowerOperations.openLoan('4500000000000000000000', ida, ida, { from: ida, value: mv._40_Ether })
    await borrowerOperations.openLoan(mv._5000e18, jake, jake, { from: jake, value: mv._50_Ether })

    // Check sizeList 18 size is 4
    assert.equal((await sizeList_18orLess.getSize()).toString(), '4')

    // Check sizeList 18 size is 5
    assert.equal((await sizeList_19orGreater.getSize()).toString(), '5')

    // Price drops to 1ETH:100CLV
    await priceFeed.setPrice(mv._100e18)
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

     // Confirm troves A-J are <110% ICR
     assert.isTrue((await cdpManager.getCurrentICR(alice, price)).lt(mv._MCR))
     assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lt(mv._MCR))
     assert.isTrue((await cdpManager.getCurrentICR(carol, price)).lt(mv._MCR))
     assert.isTrue((await cdpManager.getCurrentICR(dennis, price)).lt(mv._MCR))
     assert.isTrue((await cdpManager.getCurrentICR(graham, price)).lt(mv._MCR))
     assert.isTrue((await cdpManager.getCurrentICR(harriet, price)).lt(mv._MCR))
     assert.isTrue((await cdpManager.getCurrentICR(ida, price)).lt(mv._MCR))
     assert.isTrue((await cdpManager.getCurrentICR(jake, price)).lt(mv._MCR))

    // Liquidate 0 in sizeRange 18
    await cdpManager.liquidateTrovesInRange(0, 18);

    // Liquidate 0 in sizeRange 19
    await cdpManager.liquidateTrovesInRange(0, 19);

    // Check sizeList 18 size is still 4
    assert.equal((await sizeList_18orLess.getSize()).toString(), '4')

    // Check troves A-D are still in their respective lists
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isTrue(await sortedCDPs.contains(bob))
    assert.isTrue(await sortedCDPs.contains(carol))
    assert.isTrue(await sortedCDPs.contains(dennis))
    assert.isTrue(await sizeList_18orLess.contains(alice))
    assert.isTrue(await sizeList_18orLess.contains(bob))
    assert.isTrue(await sizeList_18orLess.contains(carol))
    assert.isTrue(await sizeList_18orLess.contains(dennis))

    // Check sizeList 19 size is still 5
    assert.equal((await sizeList_19orGreater.getSize()).toString(), '5')

    assert.isTrue(await sortedCDPs.contains(graham))
    assert.isTrue(await sortedCDPs.contains(harriet))
    assert.isTrue(await sortedCDPs.contains(ida))
    assert.isTrue(await sortedCDPs.contains(jake))
    assert.isTrue(await sizeList_19orGreater.contains(graham))
    assert.isTrue(await sizeList_19orGreater.contains(harriet))
    assert.isTrue(await sizeList_19orGreater.contains(ida))
    assert.isTrue(await sizeList_19orGreater.contains(jake))
  })
})

contract('Reset chain state', async accounts => { })