const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const LUSDTokenTester = artifacts.require("./LUSDTokenTester.sol")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const assertRevert = th.assertRevert
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues


/* NOTE: Some tests involving ETH redemption fees do not test for specific fee values.
 * Some only test that the fees are non-zero when they should occur.
 *
 * Specific ETH gain values will depend on the final fee schedule used, and the final choices for
 * the parameter BETA in the TroveManager, which is still TBD based on economic modelling.
 * 
 */ 
contract('TroveManager', async accounts => {

  const _18_zeros = '000000000000000000'
  const ZERO_ADDRESS = th.ZERO_ADDRESS

  const [
    owner,
    alice, bob, carol, dennis, erin, flyn, graham, harriet, ida,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4, whale,
    A, B, C, D, E] = accounts;

  let priceFeed
  let lusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let collSurplusPool
  let defaultPool
  let borrowerOperations
  let hintHelpers

  let contracts

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts.lusdToken = await LUSDTokenTester.new(
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    const LQTYContracts = await deploymentHelper.deployLQTYContracts()

    priceFeed = contracts.priceFeedTestnet
    lusdToken = contracts.lusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    collSurplusPool = contracts.collSurplusPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    lqtyStaking = LQTYContracts.lqtyStaking
    lqtyToken = LQTYContracts.lqtyToken
    communityIssuance = LQTYContracts.communityIssuance
    lockupContractFactory = LQTYContracts.lockupContractFactory

    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
  })

  it('liquidate(): closes a Trove that has ICR < MCR', async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(50, 'ether') })
    await borrowerOperations.openTrove(0, alice, { from: alice, value: dec(1, 'ether') })

    const price = await priceFeed.getPrice()
    const ICR_Before = await troveManager.getCurrentICR(alice, price)
    assert.equal(ICR_Before, dec(20, 18))

    const MCR = (await troveManager.MCR()).toString()
    assert.equal(MCR.toString(), '1100000000000000000')

    // Alice withdraws to 180 LUSD, lowering her ICR to 1.11
    const A_LUSDWithdrawal = await th.getActualDebtFromComposite(dec(180, 18), contracts)

    await borrowerOperations.withdrawLUSD(A_LUSDWithdrawal, alice, { from: alice })

    const ICR_AfterWithdrawal = await troveManager.getCurrentICR(alice, price)
    assert.isAtMost(th.getDifference(ICR_AfterWithdrawal, '1111111111111111111'), 100)

    // price drops to 1ETH:100LUSD, reducing Alice's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // close Trove
    await troveManager.liquidate(alice, { from: owner });

    // check the Trove is successfully closed, and removed from sortedList
    const status = (await troveManager.Troves(alice))[3]
    assert.equal(status, 2)  // status enum  2 corresponds to "Closed"
    const alice_Trove_isInSortedList = await sortedTroves.contains(alice)
    assert.isFalse(alice_Trove_isInSortedList)
  })

  it("liquidate(): decreases ActivePool ETH and LUSDDebt by correct amounts", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(0, bob, { from: bob, value: dec(1, 'ether') })
    // Alice withdraws 100LUSD, Bob withdraws 180LUSD
    const A_LUSDWithdrawal = await th.getActualDebtFromComposite(dec(100, 18), contracts)
    const B_LUSDWithdrawal = await th.getActualDebtFromComposite(dec(180, 18), contracts)
    await borrowerOperations.withdrawLUSD(A_LUSDWithdrawal, alice, { from: alice })
    await borrowerOperations.withdrawLUSD(B_LUSDWithdrawal, bob, { from: bob })

    // --- TEST ---

    // check ActivePool ETH and LUSD debt before
    const activePool_ETH_Before = (await activePool.getETH()).toString()
    const activePool_RawEther_Before = (await web3.eth.getBalance(activePool.address)).toString()
    const activePool_LUSDDebt_Before = (await activePool.getLUSDDebt()).toString()

    assert.equal(activePool_ETH_Before, dec(11, 'ether'))
    assert.equal(activePool_RawEther_Before, dec(11, 'ether'))
    assert.equal(activePool_LUSDDebt_Before, '280000000000000000000')

    // price drops to 1ETH:100LUSD, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    /* close Bob's Trove. Should liquidate his 1 ether and 180LUSD, 
    leaving 10 ether and 100 LUSD debt in the ActivePool. */
    await troveManager.liquidate(bob, { from: owner });

    // check ActivePool ETH and LUSD debt 
    const activePool_ETH_After = (await activePool.getETH()).toString()
    const activePool_RawEther_After = (await web3.eth.getBalance(activePool.address)).toString()
    const activePool_LUSDDebt_After = (await activePool.getLUSDDebt()).toString()

    assert.equal(activePool_ETH_After, dec(10, 'ether'))
    assert.equal(activePool_RawEther_After, dec(10, 'ether'))
    assert.equal(activePool_LUSDDebt_After, '100000000000000000000')
  })

  it("liquidate(): increases DefaultPool ETH and LUSD debt by correct amounts", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(0, bob, { from: bob, value: dec(1, 'ether') })

    await borrowerOperations.withdrawLUSD('1000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD('170000000000000000000', bob, { from: bob })

    // --- TEST ---

    // check DefaultPool ETH and LUSD debt before
    const defaultPool_ETH_Before = (await defaultPool.getETH())
    const defaultPool_RawEther_Before = (await web3.eth.getBalance(defaultPool.address)).toString()
    const defaultPool_LUSDDebt_Before = (await defaultPool.getLUSDDebt()).toString()

    assert.equal(defaultPool_ETH_Before, '0')
    assert.equal(defaultPool_RawEther_Before, '0')
    assert.equal(defaultPool_LUSDDebt_Before, '0')

    // price drops to 1ETH:100LUSD, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // close Bob's Trove
    await troveManager.liquidate(bob, { from: owner });

    // check after
    const defaultPool_ETH_After = (await defaultPool.getETH()).toString()
    const defaultPool_RawEther_After = (await web3.eth.getBalance(defaultPool.address)).toString()
    const defaultPool_LUSDDebt_After = (await defaultPool.getLUSDDebt()).toString()

    assert.equal(defaultPool_ETH_After, dec(995, 15))
    assert.equal(defaultPool_RawEther_After, dec(995, 15))
    assert.equal(defaultPool_LUSDDebt_After, '180000000000000000000')
  })

  it("liquidate(): removes the Trove's stake from the total stakes", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(0, bob, { from: bob, value: dec(1, 'ether') })

    const A_LUSDWithdrawal = await th.getActualDebtFromComposite(dec(100, 18), contracts)
    const B_LUSDWithdrawal = await th.getActualDebtFromComposite(dec(180, 18), contracts)
    await borrowerOperations.withdrawLUSD(A_LUSDWithdrawal, alice, { from: alice })
    await borrowerOperations.withdrawLUSD(B_LUSDWithdrawal, bob, { from: bob })

    // --- TEST ---

    // check totalStakes before
    const totalStakes_Before = (await troveManager.totalStakes()).toString()
    assert.equal(totalStakes_Before, dec(11, 'ether'))

    // price drops to 1ETH:100LUSD, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Close Bob's Trove
    await troveManager.liquidate(bob, { from: owner });

    // check totalStakes after
    const totalStakes_After = (await troveManager.totalStakes()).toString()
    assert.equal(totalStakes_After, dec(10, 'ether'))
  })

  it("liquidate(): Removes the correct trove from the TroveOwners array, and moves the last array element to the new empty slot", async () => {
    // --- SETUP --- 
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(100, 'ether') })

    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await borrowerOperations.openTrove(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('101000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('102000000000000000000', carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('103000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('104000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // At this stage, TroveOwners array should be: [W, A, B, C, D, E] 

    // Drop price
    await priceFeed.setPrice(dec(100, 18))

    const arrayLength_Before = await troveManager.getTroveOwnersCount()
    assert.equal(arrayLength_Before, 6)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Liquidate carol
    await troveManager.liquidate(carol)

    // Check Carol no longer has an active trove
    assert.isFalse(await sortedTroves.contains(carol))

    // Check length of array has decreased by 1
    const arrayLength_After = await troveManager.getTroveOwnersCount()
    assert.equal(arrayLength_After, 5)

    /* After Carol is removed from array, the last element (Erin's address) should have been moved to fill 
    the empty slot left by Carol, and the array length decreased by one.  The final TroveOwners array should be:
  
    [W, A, B, E, D] 

    Check all remaining troves in the array are in the correct order */
    const trove_0 = await troveManager.TroveOwners(0)
    const trove_1 = await troveManager.TroveOwners(1)
    const trove_2 = await troveManager.TroveOwners(2)
    const trove_3 = await troveManager.TroveOwners(3)
    const trove_4 = await troveManager.TroveOwners(4)

    assert.equal(trove_0, whale)
    assert.equal(trove_1, alice)
    assert.equal(trove_2, bob)
    assert.equal(trove_3, erin)
    assert.equal(trove_4, dennis)

    // Check correct indices recorded on the active trove structs
    const whale_arrayIndex = (await troveManager.Troves(whale))[4]
    const alice_arrayIndex = (await troveManager.Troves(alice))[4]
    const bob_arrayIndex = (await troveManager.Troves(bob))[4]
    const dennis_arrayIndex = (await troveManager.Troves(dennis))[4]
    const erin_arrayIndex = (await troveManager.Troves(erin))[4]

    // [W, A, B, E, D] 
    assert.equal(whale_arrayIndex, 0)
    assert.equal(alice_arrayIndex, 1)
    assert.equal(bob_arrayIndex, 2)
    assert.equal(erin_arrayIndex, 3)
    assert.equal(dennis_arrayIndex, 4)
  })

  it("liquidate(): updates the snapshots of total stakes and total collateral", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(0, bob, { from: bob, value: dec(1, 'ether') })

    await borrowerOperations.withdrawLUSD('1000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawLUSD('170000000000000000000', bob, { from: bob })

    // --- TEST ---

    // check snapshots before 
    const totalStakesSnapshot_Before = (await troveManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_Before = (await troveManager.totalCollateralSnapshot()).toString()
    assert.equal(totalStakesSnapshot_Before, '0')
    assert.equal(totalCollateralSnapshot_Before, '0')

    // price drops to 1ETH:100LUSD, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // close Bob's Trove.  His 1*0.995 ether and 180 LUSD should be added to the DefaultPool.
    await troveManager.liquidate(bob, { from: owner });

    /* check snapshots after. Total stakes should be equal to the  remaining stake then the system: 
    10 ether, Alice's stake.
     
    Total collateral should be equal to Alice's collateral (10 ether) plus her pending ETH reward (1*0.995 ether), earned
    from the liquidation of Bob's Trove */
    const totalStakesSnapshot_After = (await troveManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_After = (await troveManager.totalCollateralSnapshot()).toString()

    assert.equal(totalStakesSnapshot_After, dec(10, 'ether'))
    assert.equal(totalCollateralSnapshot_After, dec(10995, 15))
  })

  it("liquidate(): updates the L_ETH and L_LUSDDebt reward-per-unit-staked totals", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(0, alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(0, bob, { from: bob, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(0, carol, { from: carol, value: dec(1, 'ether') })

    // Carol withdraws 170LUSD, lowering her ICR to 1.11
    await borrowerOperations.withdrawLUSD('170000000000000000000', carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100LUSD, reducing Carols's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // close Carol's Trove.  
    assert.isTrue(await sortedTroves.contains(carol))
    await troveManager.liquidate(carol, { from: owner });
    assert.isFalse(await sortedTroves.contains(carol))

    /* Alice and Bob have the same active stakes. totalStakes in the system is (10 + 10) = 20 ether.
    
    Carol's 1*0.995 ether and 180 LUSD should be added to the DefaultPool. The system rewards-per-unit-staked should now be:
    
    L_ETH = (0.995 / 20) = 0.04975 ETH
    L_LUSDDebt = (180 / 20) = 9 LUSD */
    const L_ETH_AfterCarolLiquidated = await troveManager.L_ETH()
    const L_LUSDDebt_AfterCarolLiquidated = await troveManager.L_LUSDDebt()

    assert.isAtMost(th.getDifference(L_ETH_AfterCarolLiquidated, '49750000000000000'), 100)
    assert.isAtMost(th.getDifference(L_LUSDDebt_AfterCarolLiquidated, '9000000000000000000'), 100)

    // Bob now withdraws 790 LUSD, bringing his ICR to 1.11
    await borrowerOperations.withdrawLUSD('790000000000000000000', bob, { from: bob })

    // Confirm system is in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // price drops to 1ETH:50LUSD, reducing Bob's ICR below MCR
    await priceFeed.setPrice(dec(50, 18));
    const price = await priceFeed.getPrice()

    // close Bob's Trove 
    assert.isTrue(await sortedTroves.contains(bob))
    await troveManager.liquidate(bob, { from: owner });
    assert.isFalse(await sortedTroves.contains(bob))

    /* Alice now has all the active stake. totalStakes in the system is now 10 ether.
   
   Bob's pending collateral reward (10 * 0.05 * 0.995 = 0.4975 ETH) and debt reward (10 * 9 = 90 LUSD) are applied to his Trove
   before his liquidation.
   His total collateral (10 + 0.4975 = 10.4975 ETH)*0.995 and debt (800 + 90 = 890 LUSD) are then added to the DefaultPool. 
   
   The system rewards-per-unit-staked should now be:
   
   L_ETH = (0.995 / 20) + (10.4975*0.995  / 10) = 1.09425125 ETH
   L_LUSDDebt = (180 / 20) + (890 / 10) = 98 LUSD */
    const L_ETH_AfterBobLiquidated = await troveManager.L_ETH()
    const L_LUSDDebt_AfterBobLiquidated = await troveManager.L_LUSDDebt()

    assert.isAtMost(th.getDifference(L_ETH_AfterBobLiquidated, '1094251250000000000'), 100)
    assert.isAtMost(th.getDifference(L_LUSDDebt_AfterBobLiquidated, '98000000000000000000'), 100)
  })

  it("liquidate(): Liquidates undercollateralized trove if there are two troves in the system", async () => {
    await borrowerOperations.openTrove(dec(50, 18), bob, { from: bob, value: dec(100, 'ether') })

    // Alice creates a single trove with 0.5 ETH and a debt of 50 LQTY,  and provides 10 LUSD to SP

    const A_LUSDWithdrawal = await th.getActualDebtFromComposite(dec(50, 18), contracts)
    await borrowerOperations.openTrove(A_LUSDWithdrawal, alice, { from: alice, value: dec(500, 'finney') })

    // Alice proves 10 LUSD to SP
    await stabilityPool.provideToSP(dec(10, 18), ZERO_ADDRESS, { from: alice })

    // Set ETH:USD price to 105
    await priceFeed.setPrice('105000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isFalse(await troveManager.checkRecoveryMode())

    const alice_ICR = (await troveManager.getCurrentICR(alice, price)).toString()
    assert.equal(alice_ICR, '1050000000000000000')

    const activeTrovesCount_Before = await troveManager.getTroveOwnersCount()

    assert.equal(activeTrovesCount_Before, 2)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

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

  it("liquidate(): reverts if trove is non-existent", async () => {
    await borrowerOperations.openTrove(0, alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), bob, { from: bob, value: dec(10, 'ether') })

    assert.equal(await troveManager.getTroveStatus(carol), 0) // check trove non-existent

    assert.isFalse(await sortedTroves.contains(carol))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    try {
      const txCarol = await troveManager.liquidate(carol)

      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }
  })

  it("liquidate(): reverts if trove has been closed", async () => {
    await borrowerOperations.openTrove(0, alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(dec(180, 18), bob, { from: bob, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    assert.isTrue(await sortedTroves.contains(carol))

    // price drops, Carol ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Carol liquidated, and her trove is closed
    const txCarol_L1 = await troveManager.liquidate(carol)
    assert.isTrue(txCarol_L1.receipt.status)

    assert.isFalse(await sortedTroves.contains(carol))

    assert.equal(await troveManager.getTroveStatus(carol), 2)  // check trove closed

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    try {
      const txCarol_L2 = await troveManager.liquidate(carol)

      assert.isFalse(txCarol_L2.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }
  })

  it("liquidate(): does nothing if trove has >= 110% ICR", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(dec(180, 18), bob, { from: bob, value: dec(10, 'ether') })

    const TCR_Before = (await troveManager.getTCR()).toString()
    const listSize_Before = (await sortedTroves.getSize()).toString()

    const price = await priceFeed.getPrice()

    // Check Bob's ICR > 110%
    const bob_ICR = await troveManager.getCurrentICR(bob, price)
    assert.isTrue(bob_ICR.gte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Attempt to liquidate bob
    await troveManager.liquidate(bob)

    // Check bob active, check whale active
    assert.isTrue((await sortedTroves.contains(bob)))
    assert.isTrue((await sortedTroves.contains(whale)))

    const TCR_After = (await troveManager.getTCR()).toString()
    const listSize_After = (await sortedTroves.getSize()).toString()

    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
  })

  it("liquidate(): Given the same price and no other trove changes, complete Pool offsets restore the TCR to its value prior to the defaulters opening troves", async () => {
    // Whale provides 2000 LUSD to SP
    await borrowerOperations.openTrove(dec(2000, 18), whale, { from: whale, value: dec(100, 'ether') })
    await stabilityPool.provideToSP(dec(2000, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, { from: bob, value: dec(7, 'ether') })
    await borrowerOperations.openTrove(0, carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(0, dennis, { from: dennis, value: dec(20, 'ether') })

    const TCR_Before = (await troveManager.getTCR()).toString()

    await borrowerOperations.openTrove('101000000000000000000', defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('257000000000000000000', defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
    await borrowerOperations.openTrove('328000000000000000000', defaulter_3, { from: defaulter_3, value: dec(3, 'ether') })
    await borrowerOperations.openTrove('480000000000000000000', defaulter_4, { from: defaulter_4, value: dec(4, 'ether') })

    assert.isTrue((await sortedTroves.contains(defaulter_1)))
    assert.isTrue((await sortedTroves.contains(defaulter_2)))
    assert.isTrue((await sortedTroves.contains(defaulter_3)))
    assert.isTrue((await sortedTroves.contains(defaulter_4)))

    // Price drop
    await priceFeed.setPrice(dec(100, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // All defaulters liquidated
    await troveManager.liquidate(defaulter_1)
    assert.isFalse((await sortedTroves.contains(defaulter_1)))

    await troveManager.liquidate(defaulter_2)
    assert.isFalse((await sortedTroves.contains(defaulter_2)))

    await troveManager.liquidate(defaulter_3)
    assert.isFalse((await sortedTroves.contains(defaulter_3)))

    await troveManager.liquidate(defaulter_4)
    assert.isFalse((await sortedTroves.contains(defaulter_4)))

    // Price bounces back
    await priceFeed.setPrice(dec(200, 18))

    const TCR_After = (await troveManager.getTCR()).toString()
    assert.equal(TCR_Before, TCR_After)
  })


  it("liquidate(): Pool offsets increase the TCR", async () => {
    // Whale provides 2000 LUSD to SP
    await borrowerOperations.openTrove(dec(2000, 18), whale, { from: whale, value: dec(100, 'ether') })
    await stabilityPool.provideToSP(dec(2000, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, { from: bob, value: dec(7, 'ether') })
    await borrowerOperations.openTrove(0, carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(0, dennis, { from: dennis, value: dec(20, 'ether') })

    await borrowerOperations.openTrove('101000000000000000000', defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('257000000000000000000', defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
    await borrowerOperations.openTrove('328000000000000000000', defaulter_3, { from: defaulter_3, value: dec(3, 'ether') })
    await borrowerOperations.openTrove('480000000000000000000', defaulter_4, { from: defaulter_4, value: dec(4, 'ether') })

    assert.isTrue((await sortedTroves.contains(defaulter_1)))
    assert.isTrue((await sortedTroves.contains(defaulter_2)))
    assert.isTrue((await sortedTroves.contains(defaulter_3)))
    assert.isTrue((await sortedTroves.contains(defaulter_4)))

    await priceFeed.setPrice(dec(100, 18))

    const TCR_1 = await troveManager.getTCR()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Check TCR improves with each liquidation that is offset with Pool
    await troveManager.liquidate(defaulter_1)
    assert.isFalse((await sortedTroves.contains(defaulter_1)))
    const TCR_2 = await troveManager.getTCR()
    assert.isTrue(TCR_2.gte(TCR_1))

    await troveManager.liquidate(defaulter_2)
    assert.isFalse((await sortedTroves.contains(defaulter_2)))
    const TCR_3 = await troveManager.getTCR()
    assert.isTrue(TCR_3.gte(TCR_2))

    await troveManager.liquidate(defaulter_3)
    assert.isFalse((await sortedTroves.contains(defaulter_3)))
    const TCR_4 = await troveManager.getTCR()
    assert.isTrue(TCR_4.gte(TCR_4))

    await troveManager.liquidate(defaulter_4)
    assert.isFalse((await sortedTroves.contains(defaulter_4)))
    const TCR_5 = await troveManager.getTCR()
    assert.isTrue(TCR_5.gte(TCR_5))
  })

  it("liquidate(): a pure redistribution reduces the TCR only as a result of compensation", async () => {
    await borrowerOperations.openTrove(dec(2000, 18), whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, { from: bob, value: dec(7, 'ether') })
    await borrowerOperations.openTrove(0, carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(0, dennis, { from: dennis, value: dec(20, 'ether') })

    await borrowerOperations.openTrove('101000000000000000000', defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('257000000000000000000', defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
    await borrowerOperations.openTrove('328000000000000000000', defaulter_3, { from: defaulter_3, value: dec(3, 'ether') })
    await borrowerOperations.openTrove('480000000000000000000', defaulter_4, { from: defaulter_4, value: dec(4, 'ether') })

    assert.isTrue((await sortedTroves.contains(defaulter_1)))
    assert.isTrue((await sortedTroves.contains(defaulter_2)))
    assert.isTrue((await sortedTroves.contains(defaulter_3)))
    assert.isTrue((await sortedTroves.contains(defaulter_4)))

    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const TCR_0 = await troveManager.getTCR()

    const entireSystemCollBefore = await troveManager.getEntireSystemColl()
    const entireSystemDebtBefore = await troveManager.getEntireSystemDebt()

    const expectedTCR_0 = entireSystemCollBefore.mul(price).div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_0.eq(TCR_0))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Check TCR does not decrease with each liquidation 
    const liquidationTx_1 = await troveManager.liquidate(defaulter_1)
    const [liquidatedDebt_1, liquidatedColl_1, gasComp_1] = th.getEmittedLiquidationValues(liquidationTx_1)
    assert.isFalse((await sortedTroves.contains(defaulter_1)))
    const TCR_1 = await troveManager.getTCR()

    // Expect only change to TCR to be due to the issued gas compensation
    const expectedTCR_1 = (entireSystemCollBefore
      .sub(gasComp_1))
      .mul(price)
      .div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_1.eq(TCR_1))

    const liquidationTx_2 = await troveManager.liquidate(defaulter_2)
    const [liquidatedDebt_2, liquidatedColl_2, gasComp_2] = th.getEmittedLiquidationValues(liquidationTx_2)
    assert.isFalse((await sortedTroves.contains(defaulter_2)))

    const TCR_2 = await troveManager.getTCR()

    const expectedTCR_2 = (entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2))
      .mul(price)
      .div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_2.eq(TCR_2))

    const liquidationTx_3 = await troveManager.liquidate(defaulter_3)
    const [liquidatedDebt_3, liquidatedColl_3, gasComp_3] = th.getEmittedLiquidationValues(liquidationTx_3)
    assert.isFalse((await sortedTroves.contains(defaulter_3)))

    const TCR_3 = await troveManager.getTCR()

    const expectedTCR_3 = (entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2)
      .sub(gasComp_3))
      .mul(price)
      .div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_3.eq(TCR_3))


    const liquidationTx_4 = await troveManager.liquidate(defaulter_4)
    const [liquidatedDebt_4, liquidatedColl_4, gasComp_4] = th.getEmittedLiquidationValues(liquidationTx_4)
    assert.isFalse((await sortedTroves.contains(defaulter_4)))

    const TCR_4 = await troveManager.getTCR()

    const expectedTCR_4 = (entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2)
      .sub(gasComp_3)
      .sub(gasComp_4))
      .mul(price)
      .div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_4.eq(TCR_4))
  })

  it("liquidate(): does not affect the SP deposit or ETH gain when called on an SP depositor's address that has no trove", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Bob sends tokens to Dennis, who has no trove
    await lusdToken.transfer(dennis, dec(200, 18), { from: bob })

    //Dennis provides 200 LUSD to SP
    await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: dennis })

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    const liquidationTX_C = await troveManager.liquidate(carol)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTX_C)

    assert.isFalse(await sortedTroves.contains(carol))
    // Check Dennis' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const dennis_Deposit_Before = (await stabilityPool.getCompoundedLUSDDeposit(dennis)).toString()
    const dennis_ETHGain_Before = (await stabilityPool.getDepositorETHGain(dennis)).toString()
    assert.isAtMost(th.getDifference(dennis_Deposit_Before, th.toBN(dec(200, 18)).sub(liquidatedDebt)), 1000)
    assert.isAtMost(th.getDifference(dennis_ETHGain_Before, liquidatedColl), 1000)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Attempt to liquidate Dennis
    try {
      const txDennis = await troveManager.liquidate(dennis)
      assert.isFalse(txDennis.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Trove does not exist or is closed")
    }

    // Check Dennis' SP deposit does not change after liquidation attempt
    const dennis_Deposit_After = (await stabilityPool.getCompoundedLUSDDeposit(dennis)).toString()
    const dennis_ETHGain_After = (await stabilityPool.getDepositorETHGain(dennis)).toString()
    assert.equal(dennis_Deposit_Before, dennis_Deposit_After)
    assert.equal(dennis_ETHGain_Before, dennis_ETHGain_After)
  })

  it("liquidate(): does not liquidate a SP depositor's trove with ICR > 110%, and does not affect their SP deposit or ETH gain", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    //Bob provides 200 LUSD to SP
    await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: bob })

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    const liquidationTX_C = await troveManager.liquidate(carol)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTX_C)
    assert.isFalse(await sortedTroves.contains(carol))

    // price bounces back - Bob's trove is >110% ICR again
    await priceFeed.setPrice(dec(200, 18))
    const price = await priceFeed.getPrice()
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gt(mv._MCR))

    // Check Bob' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const bob_Deposit_Before = (await stabilityPool.getCompoundedLUSDDeposit(bob)).toString()
    const bob_ETHGain_Before = (await stabilityPool.getDepositorETHGain(bob)).toString()
    assert.isAtMost(th.getDifference(bob_Deposit_Before, th.toBN(dec(200, 18)).sub(liquidatedDebt)), 1000)
    assert.isAtMost(th.getDifference(bob_ETHGain_Before, liquidatedColl), 1000)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Attempt to liquidate Bob
    await troveManager.liquidate(bob)

    // Confirm Bob's trove is still active
    assert.isTrue(await sortedTroves.contains(bob))

    // Check Bob' SP deposit does not change after liquidation attempt
    const bob_Deposit_After = (await stabilityPool.getCompoundedLUSDDeposit(bob)).toString()
    const bob_ETHGain_After = (await stabilityPool.getDepositorETHGain(bob)).toString()
    assert.equal(bob_Deposit_Before, bob_Deposit_After)
    assert.equal(bob_ETHGain_Before, bob_ETHGain_After)
  })

  it("liquidate(): liquidates a SP depositor's trove with ICR < 110%, and the liquidation correctly impacts their SP deposit and ETH gain", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(dec(300, 18), alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(90, 18), carol, { from: carol, value: dec(1, 'ether') })

    //Bob provides 200 LUSD to SP
    await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: bob })

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(carol)

    // Check Bob' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const bob_Deposit_Before = (await stabilityPool.getCompoundedLUSDDeposit(bob)).toString()
    const bob_ETHGain_Before = (await stabilityPool.getDepositorETHGain(bob)).toString()
    assert.isAtMost(th.getDifference(bob_Deposit_Before, dec(100, 18)), 1000)
    assert.isAtMost(th.getDifference(bob_ETHGain_Before, dec(995, 15)), 1000)

    // Alice provides 300 LUSD to SP
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: alice })

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Liquidate Bob. 200 LUSD and 2 ETH is liquidated
    await troveManager.liquidate(bob)

    // Confirm Bob's trove has been closed
    assert.isFalse(await sortedTroves.contains(bob))
    const bob_Trove_Status = ((await troveManager.Troves(bob))[3]).toString()
    assert.equal(bob_Trove_Status, 2) // check closed

    /* Alice's LUSD Loss = (300 / 400) * 210 = 157.5 LUSD
       Alice's ETH gain = (300 / 400) * 2*0.995 = 1.4925 ETH

       Bob's LUSDLoss = (100 / 400) * 210 = 52.5 LUSD
       Bob's ETH gain = (100 / 400) * 2*0.995 = 0.4975 ETH

     Check Bob' SP deposit has been reduced to 47.5 LUSD, and his ETH gain has increased to 1.5 ETH. */
    const bob_Deposit_After = (await stabilityPool.getCompoundedLUSDDeposit(bob)).toString()
    const bob_ETHGain_After = (await stabilityPool.getDepositorETHGain(bob)).toString()

    assert.isAtMost(th.getDifference(bob_Deposit_After, dec(475, 17)), 1000)
    assert.isAtMost(th.getDifference(bob_ETHGain_After, '1492500000000000000'), 1000)
  })

  it("liquidate(): does not alter the liquidated user's token balance", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(dec(300, 18), alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })
    await priceFeed.setPrice(dec(100, 18))

    // Check token balances 
    assert.equal((await lusdToken.balanceOf(alice)).toString(), dec(300, 18))
    assert.equal((await lusdToken.balanceOf(bob)).toString(), dec(200, 18))
    assert.equal((await lusdToken.balanceOf(carol)).toString(), dec(100, 18))

    // Check sortedList size
    assert.equal((await sortedTroves.getSize()).toString(), '4')

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Liquidate A, B and C
    const activeLUSDDebt_0 = await activePool.getLUSDDebt()
    const defaultLUSDDebt_0 = await defaultPool.getLUSDDebt()

    await troveManager.liquidate(alice)
    const activeLUSDDebt_A = await activePool.getLUSDDebt()
    const defaultLUSDDebt_A = await defaultPool.getLUSDDebt()

    await troveManager.liquidate(bob)
    const activeLUSDDebt_B = await activePool.getLUSDDebt()
    const defaultLUSDDebt_B = await defaultPool.getLUSDDebt()

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

  it("liquidate(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    const withdrawal_A = await th.getActualDebtFromComposite(dec(50, 18), contracts)
    const withdrawal_B = await th.getActualDebtFromComposite('90500000000000000000', contracts)
    const withdrawal_C = await th.getActualDebtFromComposite(dec(100, 18), contracts)

    await borrowerOperations.openTrove(withdrawal_A, alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(withdrawal_B, bob, { from: bob, value: dec(1, 'ether') })  // 90.5 LUSD, 1 ETH
    await borrowerOperations.openTrove(withdrawal_C, carol, { from: carol, value: dec(1, 'ether') })

    // Defaulter opens with 30 LUSD, 0.3 ETH
    await borrowerOperations.openTrove(dec(30, 18), defaulter_1, { from: defaulter_1, value: dec(300, 'finney') })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const alice_ICR_Before = await troveManager.getCurrentICR(alice, price)
    const bob_ICR_Before = await troveManager.getCurrentICR(bob, price)
    const carol_ICR_Before = await troveManager.getCurrentICR(carol, price)

    /* Before liquidation: 
    Alice ICR: = (2 * 100 / 50) = 400%
    Bob ICR: (1 * 100 / 90.5) = 110.5%
    Carol ICR: (1 * 100 / 100 ) =  100%

    Therefore Alice and Bob above the MCR, Carol is below */
    assert.isTrue(alice_ICR_Before.gte(mv._MCR))
    assert.isTrue(bob_ICR_Before.gte(mv._MCR))
    assert.isTrue(carol_ICR_Before.lte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    /* Liquidate defaulter. 30 LUSD and 0.3 ETH is distributed between A, B and C.

    A receives (30 * 2/4) = 15 LUSD, and (0.3*2/4) = 0.15 ETH
    B receives (30 * 1/4) = 7.5 LUSD, and (0.3*1/4) = 0.075 ETH
    C receives (30 * 1/4) = 7.5 LUSD, and (0.3*1/4) = 0.075 ETH
    */
    await troveManager.liquidate(defaulter_1)

    const alice_ICR_After = await troveManager.getCurrentICR(alice, price)
    const bob_ICR_After = await troveManager.getCurrentICR(bob, price)
    const carol_ICR_After = await troveManager.getCurrentICR(carol, price)

    /* After liquidation: 

    Alice ICR: (10.15 * 100 / 60) = 183.33%
    Bob ICR:(1.075 * 100 / 98) =  109.69%
    Carol ICR: (1.075 *100 /  107.5 ) = 100.0%

    Check Alice is above MCR, Bob below, Carol below. */


    assert.isTrue(alice_ICR_After.gte(mv._MCR))
    assert.isTrue(bob_ICR_After.lte(mv._MCR))
    assert.isTrue(carol_ICR_After.lte(mv._MCR))

    /* Though Bob's true ICR (including pending rewards) is below the MCR, 
    check that Bob's raw coll and debt has not changed, and that his "raw" ICR is above the MCR */
    const bob_Coll = (await troveManager.Troves(bob))[1]
    const bob_Debt = (await troveManager.Troves(bob))[0]

    const bob_rawICR = bob_Coll.mul(toBN(dec(100, 18))).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    // Whale enters system, pulling it into Normal Mode
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(10, 'ether') })
    assert.isFalse(await troveManager.checkRecoveryMode())

    // Liquidate Alice, Bob, Carol
    await troveManager.liquidate(alice)
    await troveManager.liquidate(bob)
    await troveManager.liquidate(carol)

    /* Check Alice stays active, Carol gets liquidated, and Bob gets liquidated 
   (because his pending rewards bring his ICR < MCR) */
    assert.isTrue(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))

    // Check trove statuses - A active (1),  B and C closed (2)
    assert.equal((await troveManager.Troves(alice))[3].toString(), '1')
    assert.equal((await troveManager.Troves(bob))[3].toString(), '2')
    assert.equal((await troveManager.Troves(carol))[3].toString(), '2')
  })

  it("liquidate(): when SP > 0, triggers LQTY reward event - increases the sum G", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open troves 
    await borrowerOperations.openTrove(dec(50, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), B, { from: B, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(150, 18), C, { from: C, value: dec(3, 'ether') })

    await borrowerOperations.openTrove(dec(50, 18), defaulter_1, { from: defaulter_1, value: dec(5, 17) })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })
    assert.equal(await stabilityPool.getTotalLUSDDeposits(), dec(100, 18))

    const G_Before = await stabilityPool.epochToScaleToG(0, 0)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100LUSD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await troveManager.checkRecoveryMode())

    // Liquidate trove
    await troveManager.liquidate(defaulter_1)
    assert.isFalse(await sortedTroves.contains(defaulter_1))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has increased from the LQTY reward event triggered
    assert.isTrue(G_After.gt(G_Before))
  })

  it("liquidate(): when SP is empty, doesn't update G", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open troves 
    await borrowerOperations.openTrove(dec(50, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), B, { from: B, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(150, 18), C, { from: C, value: dec(3, 'ether') })

    await borrowerOperations.openTrove(dec(50, 18), defaulter_1, { from: defaulter_1, value: dec(5, 17) })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // B withdraws
    await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })

    // Check SP is empty
    assert.equal((await stabilityPool.getTotalLUSDDeposits()), '0')

    // Check G is non-zero
    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    assert.isTrue(G_Before.gt(toBN('0')))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100LUSD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await troveManager.checkRecoveryMode())

    // liquidate trove
    await troveManager.liquidate(defaulter_1)
    assert.isFalse(await sortedTroves.contains(defaulter_1))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has not changed
    assert.isTrue(G_After.eq(G_Before))
  })

  // --- liquidateTroves() ---

  it('liquidateTroves(): closes every Trove with ICR < MCR, when n > number of undercollateralized troves', async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(dec(490, 18), whale, { from: whale, value: dec(100, 'ether') })

    // create 5 Troves with varying ICRs
    await borrowerOperations.openTrove(dec(190, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(140, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(290, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), erin, { from: erin, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(170, 18), flyn, { from: flyn, value: dec(1, 'ether') })

    // G,H, I open high-ICR troves
    await borrowerOperations.openTrove(dec(90, 18), graham, { from: graham, value: dec(100, 'ether') })
    await borrowerOperations.openTrove(dec(190, 18), harriet, { from: harriet, value: dec(100, 'ether') })
    await borrowerOperations.openTrove(dec(290, 18), ida, { from: ida, value: dec(100, 'ether') })

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100LUSD, reducing Bob and Carol's ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Confirm troves A-E are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erin, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(flyn, price)).lte(mv._MCR))

    // Confirm troves G, H, I are ICR > 110%
    assert.isTrue((await troveManager.getCurrentICR(graham, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(harriet, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ida, price)).gte(mv._MCR))

    // Confirm Whale is ICR > 110% 
    assert.isTrue((await troveManager.getCurrentICR(whale, price)).gte(mv._MCR))

    // Liquidate 5 troves
    await troveManager.liquidateTroves(5);

    // Confirm troves A-E have been removed from the system
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))
    assert.isFalse(await sortedTroves.contains(erin))
    assert.isFalse(await sortedTroves.contains(flyn))

    // Check all troves A-E are now closed
    assert.equal((await troveManager.Troves(alice))[3].toString(), '2')
    assert.equal((await troveManager.Troves(bob))[3].toString(), '2')
    assert.equal((await troveManager.Troves(carol))[3].toString(), '2')
    assert.equal((await troveManager.Troves(erin))[3].toString(), '2')
    assert.equal((await troveManager.Troves(flyn))[3].toString(), '2')

    // Check sorted list has been reduced to length 4 
    assert.equal((await sortedTroves.getSize()).toString(), '4')
  })

  it('liquidateTroves(): liquidates  up to the requested number of undercollateralized troves', async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(100, 'ether') })

    // --- SETUP --- 
    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await borrowerOperations.openTrove('105000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('104000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('103000000000000000000', carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('102000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('101000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // --- TEST --- 

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    await troveManager.liquidateTroves(3)

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

  it('liquidateTroves(): does nothing if all troves have ICR > 110%', async () => {

    const LUSDwithdrawal_A = await th.getActualDebtFromComposite(dec(90, 18), contracts)
    const LUSDwithdrawal_B = await th.getActualDebtFromComposite(dec(20, 18), contracts)
    const LUSDwithdrawal_C = await th.getActualDebtFromComposite('37398509798897897897', contracts)
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(LUSDwithdrawal_A, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(LUSDwithdrawal_B, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(LUSDwithdrawal_C, carol, { from: carol, value: dec(1, 'ether') })

    // Price drops, but all troves remain active at 111% ICR
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    assert.isTrue((await sortedTroves.contains(whale)))
    assert.isTrue((await sortedTroves.contains(alice)))
    assert.isTrue((await sortedTroves.contains(bob)))
    assert.isTrue((await sortedTroves.contains(carol)))

    const TCR_Before = (await troveManager.getTCR()).toString()
    const listSize_Before = (await sortedTroves.getSize()).toString()

    assert.isTrue((await troveManager.getCurrentICR(whale, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).gte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Attempt liqudation sequence
    await troveManager.liquidateTroves(10)

    // Check all troves remain active
    assert.isTrue((await sortedTroves.contains(whale)))
    assert.isTrue((await sortedTroves.contains(alice)))
    assert.isTrue((await sortedTroves.contains(bob)))
    assert.isTrue((await sortedTroves.contains(carol)))

    const TCR_After = (await troveManager.getTCR()).toString()
    const listSize_After = (await sortedTroves.getSize()).toString()

    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
  })

  
  it("liquidateTroves(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await borrowerOperations.openTrove(dec(40, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('80500000000000000000', bob, { from: bob, value: dec(1, 'ether') })  // 90.5 LUSD, 1 ETH
    await borrowerOperations.openTrove(dec(90, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Defaulter opens with 30 LUSD, 0.3 ETH
    await borrowerOperations.openTrove(dec(20, 18), defaulter_1, { from: defaulter_1, value: dec(300, 'finney') })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

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

    Alice ICR: (1.0995 * 100 / 60) = 183.25%
    Bob ICR:(1.0995 * 100 / 100.5) =  109.40%
    Carol ICR: (1.0995 * 100 / 110 ) 99.95%

    Check Alice is above MCR, Bob below, Carol below. */
    assert.isTrue(alice_ICR_After.gte(mv._MCR))
    assert.isTrue(bob_ICR_After.lte(mv._MCR))
    assert.isTrue(carol_ICR_After.lte(mv._MCR))

    /* Though Bob's true ICR (including pending rewards) is below the MCR, check that Bob's raw coll and debt has not changed */
    const bob_Coll = (await troveManager.Troves(bob))[1]
    const bob_Debt = (await troveManager.Troves(bob))[0]

    const bob_rawICR = bob_Coll.mul(toBN(dec(100, 18))).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    // Whale enters system, pulling it into Normal Mode
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(10, 'ether') })

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    //liquidate A, B, C
    await troveManager.liquidateTroves(10)

    // Check A stays active, B and C get liquidated
    assert.isTrue(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))

    // check trove statuses - A active (1),  B and C closed (2)
    assert.equal((await troveManager.Troves(alice))[3].toString(), '1')
    assert.equal((await troveManager.Troves(bob))[3].toString(), '2')
    assert.equal((await troveManager.Troves(carol))[3].toString(), '2')
  })

  it("liquidateTroves(): does nothing if n = 0", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

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

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Liquidation with n = 0
    await troveManager.liquidateTroves(0)

    // Check all troves are still in the system
    assert.isTrue(await sortedTroves.contains(whale))
    assert.isTrue(await sortedTroves.contains(alice))
    assert.isTrue(await sortedTroves.contains(bob))
    assert.isTrue(await sortedTroves.contains(carol))

    const TCR_After = (await troveManager.getTCR()).toString()

    // Check TCR has not changed after liquidation
    assert.equal(TCR_Before, TCR_After)
  })

  it("liquidateTroves():  liquidates troves with ICR < MCR", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(10, 'ether') })

    // A, B, C open troves that will remain active when price drops to 100

    const A_LUSDWithdrawal = await th.getActualDebtFromComposite('88000000000000000000', contracts)
    const B_LUSDWithdrawal = await th.getActualDebtFromComposite('89000000000000000000', contracts)
    const C_LUSDWithdrawal = await th.getActualDebtFromComposite('90000000000000000000', contracts)

    await borrowerOperations.openTrove(A_LUSDWithdrawal, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(B_LUSDWithdrawal, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(C_LUSDWithdrawal, carol, { from: carol, value: dec(1, 'ether') })

    const D_LUSDWithdrawal = await th.getActualDebtFromComposite('91000000000000000000', contracts)
    const E_LUSDWithdrawal = await th.getActualDebtFromComposite('92000000000000000000', contracts)
    const F_LUSDWithdrawal = await th.getActualDebtFromComposite('93000000000000000000', contracts)

    // D, E, F open troves that will fall below MCR when price drops to 100
    await borrowerOperations.openTrove('91000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('92000000000000000000', erin, { from: erin, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('93000000000000000000', flyn, { from: flyn, value: dec(1, 'ether') })

    // Check list size is 7
    assert.equal((await sortedTroves.getSize()).toString(), '7')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const alice_ICR = await troveManager.getCurrentICR(alice, price)
    const bob_ICR = await troveManager.getCurrentICR(bob, price)
    const carol_ICR = await troveManager.getCurrentICR(carol, price)
    const dennis_ICR = await troveManager.getCurrentICR(dennis, price)
    const erin_ICR = await troveManager.getCurrentICR(erin, price)
    const flyn_ICR = await troveManager.getCurrentICR(flyn, price)

    // Check A, B, C have ICR above MCR
    assert.isTrue(alice_ICR.gte(mv._MCR))
    assert.isTrue(bob_ICR.gte(mv._MCR))
    assert.isTrue(carol_ICR.gte(mv._MCR))

    // Check D, E, F have ICR below MCR
    assert.isTrue(dennis_ICR.lte(mv._MCR))
    assert.isTrue(erin_ICR.lte(mv._MCR))
    assert.isTrue(flyn_ICR.lte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    //Liquidate sequence
    await troveManager.liquidateTroves(10)

    // check list size reduced to 4
    assert.equal((await sortedTroves.getSize()).toString(), '4')

    // Check Whale and A, B, C remain in the system
    assert.isTrue(await sortedTroves.contains(whale))
    assert.isTrue(await sortedTroves.contains(alice))
    assert.isTrue(await sortedTroves.contains(bob))
    assert.isTrue(await sortedTroves.contains(carol))

    // Check D, E, F have been removed
    assert.isFalse(await sortedTroves.contains(dennis))
    assert.isFalse(await sortedTroves.contains(erin))
    assert.isFalse(await sortedTroves.contains(flyn))
  })

  it("liquidateTroves(): does not affect the liquidated user's token balances", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(10, 'ether') })

    const A_LUSDWithdrawal = await th.getActualDebtFromComposite(dec(100, 18), contracts)
    const B_LUSDWithdrawal = await th.getActualDebtFromComposite(dec(150, 18), contracts)
    const C_LUSDWithdrawal = await th.getActualDebtFromComposite(dec(180, 18), contracts)

    // D, E, F open troves that will fall below MCR when price drops to 100
    await borrowerOperations.openTrove(A_LUSDWithdrawal, dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(B_LUSDWithdrawal, erin, { from: erin, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(C_LUSDWithdrawal, flyn, { from: flyn, value: dec(1, 'ether') })

    // Check list size is 4
    assert.equal((await sortedTroves.getSize()).toString(), '4')

    // Check token balances before
    assert.equal((await lusdToken.balanceOf(dennis)).toString(), A_LUSDWithdrawal)
    assert.equal((await lusdToken.balanceOf(erin)).toString(), B_LUSDWithdrawal)
    assert.equal((await lusdToken.balanceOf(flyn)).toString(), C_LUSDWithdrawal)

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    //Liquidate sequence
    await troveManager.liquidateTroves(10)

    // check list size reduced to 1
    assert.equal((await sortedTroves.getSize()).toString(), '1')

    // Check Whale remains in the system
    assert.isTrue(await sortedTroves.contains(whale))

    // Check D, E, F have been removed
    assert.isFalse(await sortedTroves.contains(dennis))
    assert.isFalse(await sortedTroves.contains(erin))
    assert.isFalse(await sortedTroves.contains(flyn))

    // Check token balances of users whose troves were liquidated, have not changed
    assert.equal((await lusdToken.balanceOf(dennis)).toString(), A_LUSDWithdrawal)
    assert.equal((await lusdToken.balanceOf(erin)).toString(), B_LUSDWithdrawal)
    assert.equal((await lusdToken.balanceOf(flyn)).toString(), C_LUSDWithdrawal)
  })

  it("liquidateTroves(): A liquidation sequence containing Pool offsets increases the TCR", async () => {
    // Whale provides 500 LUSD to SP
    await borrowerOperations.openTrove(dec(2000, 18), whale, { from: whale, value: dec(100, 'ether') })
    await stabilityPool.provideToSP(dec(500, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, { from: bob, value: dec(7, 'ether') })
    await borrowerOperations.openTrove(0, carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(0, dennis, { from: dennis, value: dec(20, 'ether') })

    await borrowerOperations.openTrove('101000000000000000000', defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('257000000000000000000', defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
    await borrowerOperations.openTrove('328000000000000000000', defaulter_3, { from: defaulter_3, value: dec(3, 'ether') })
    await borrowerOperations.openTrove('480000000000000000000', defaulter_4, { from: defaulter_4, value: dec(4, 'ether') })

    assert.isTrue((await sortedTroves.contains(defaulter_1)))
    assert.isTrue((await sortedTroves.contains(defaulter_2)))
    assert.isTrue((await sortedTroves.contains(defaulter_3)))
    assert.isTrue((await sortedTroves.contains(defaulter_4)))

    assert.equal((await sortedTroves.getSize()).toString(), '9')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    const TCR_Before = await troveManager.getTCR()

    // Check pool has 500 LUSD
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), dec(500, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Liquidate troves
    await troveManager.liquidateTroves(10)

    // Check pool has been emptied by the liquidations
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), '0')

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedTroves.contains(defaulter_1)))
    assert.isFalse((await sortedTroves.contains(defaulter_2)))
    assert.isFalse((await sortedTroves.contains(defaulter_3)))
    assert.isFalse((await sortedTroves.contains(defaulter_4)))

    // check system sized reduced to 5 troves
    assert.equal((await sortedTroves.getSize()).toString(), '5')

    // Check that the liquidation sequence has improved the TCR
    const TCR_After = await troveManager.getTCR()
    assert.isTrue(TCR_After.gte(TCR_Before))
  })

  it("liquidateTroves(): A liquidation sequence of pure redistributions decreases the TCR, due to gas compensation, but up to 0.5%", async () => {
    await borrowerOperations.openTrove(dec(2000, 18), whale, { from: whale, value: dec(100, 'ether') })
    await borrowerOperations.openTrove(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(0, bob, { from: bob, value: dec(7, 'ether') })
    await borrowerOperations.openTrove(0, carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(0, dennis, { from: dennis, value: dec(20, 'ether') })

    await borrowerOperations.openTrove('91000000000000000000', defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('247000000000000000000', defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
    await borrowerOperations.openTrove('318000000000000000000', defaulter_3, { from: defaulter_3, value: dec(3, 'ether') })
    await borrowerOperations.openTrove('470000000000000000000', defaulter_4, { from: defaulter_4, value: dec(4, 'ether') })

    assert.isTrue((await sortedTroves.contains(defaulter_1)))
    assert.isTrue((await sortedTroves.contains(defaulter_2)))
    assert.isTrue((await sortedTroves.contains(defaulter_3)))
    assert.isTrue((await sortedTroves.contains(defaulter_4)))

    assert.equal((await sortedTroves.getSize()).toString(), '9')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    const TCR_Before = await troveManager.getTCR()
    // (100+1+7+2+20+1+2+3+4)*100/(2010+10+10+10+10+101+257+328+480)
    assert.isAtMost(th.getDifference(TCR_Before, '4353233830845771200'), 1000)

    // Check pool is empty before liquidation
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), '0')

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Liquidate
    await troveManager.liquidateTroves(10)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedTroves.contains(defaulter_1)))
    assert.isFalse((await sortedTroves.contains(defaulter_2)))
    assert.isFalse((await sortedTroves.contains(defaulter_3)))
    assert.isFalse((await sortedTroves.contains(defaulter_4)))

    // check system sized reduced to 5 troves
    assert.equal((await sortedTroves.getSize()).toString(), '5')

    // Check that the liquidation sequence has reduced the TCR
    const TCR_After = await troveManager.getTCR()
    // ((100+1+7+2+20)+(1+2+3+4)*0.995)*100/(2010+10+10+10+10+101+257+328+480)
    assert.isAtMost(th.getDifference(TCR_After, '4351679104477611300'), 1000)
    assert.isTrue(TCR_Before.gte(TCR_After))
    assert.isTrue(TCR_After.gte(TCR_Before.mul(toBN(995)).div(toBN(1000))))
  })

  it("liquidateTroves(): Liquidating troves with SP deposits correctly impacts their SP deposit and ETH gain", async () => {
    // Whale provides 400 LUSD to the SP
    await borrowerOperations.openTrove(dec(400, 18), whale, { from: whale, value: dec(100, 'ether') })
    await stabilityPool.provideToSP(dec(400, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(300, 18), bob, { from: bob, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // A, B provide 100, 300 to the SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: alice })
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: bob })

    assert.equal((await sortedTroves.getSize()).toString(), '4')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Check 800 LUSD in Pool
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), dec(800, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

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
    Alice: 100 LUSD
    Bob:   300 LUSD
    Carol: 0 LUSD

    Total LUSD in Pool: 800 LUSD

    Then, liquidation hits A,B,C: 

    Total liquidated debt = 110 + 310 + 110 = 530 LUSD
    Total liquidated ETH = 1.1 + 3.1 + 1.1 = 5.3 ETH

    Whale LUSD Loss: 530 * (400/800) = 265 LUSD
    Alice LUSD Loss:  530 *(100/800) = 66.25 LUSD
    Bob LUSD Loss: 530 * (300/800) = 198.75 LUSD

    Whale remaining deposit: (400 - 265) = 135 LUSD
    Alice remaining deposit: (100 - 66.25) = 33.75 LUSD
    Bob remaining deposit: (300 - 198.75) = 101.25 LUSD

    Whale ETH Gain: 5*0.995 * (400/800) = 2.4875 ETH
    Alice ETH Gain: 5*0.995 *(100/800) = 0.621875 ETH
    Bob ETH Gain: 5*0.995 * (300/800) = 1.865625 ETH

    Total remaining deposits: 270 LUSD
    Total ETH gain: 4.975 ETH */

    // Check remaining LUSD Deposits and ETH gain, for whale and depositors whose troves were liquidated
    const whale_Deposit_After = (await stabilityPool.getCompoundedLUSDDeposit(whale)).toString()
    const alice_Deposit_After = (await stabilityPool.getCompoundedLUSDDeposit(alice)).toString()
    const bob_Deposit_After = (await stabilityPool.getCompoundedLUSDDeposit(bob)).toString()

    const whale_ETHGain = (await stabilityPool.getDepositorETHGain(whale)).toString()
    const alice_ETHGain = (await stabilityPool.getDepositorETHGain(alice)).toString()
    const bob_ETHGain = (await stabilityPool.getDepositorETHGain(bob)).toString()

    assert.isAtMost(th.getDifference(whale_Deposit_After, dec(135, 18)), 1000)
    assert.isAtMost(th.getDifference(alice_Deposit_After, '33750000000000000000'), 1000)
    assert.isAtMost(th.getDifference(bob_Deposit_After, '101250000000000000000'), 1000)

    assert.isAtMost(th.getDifference(whale_ETHGain, '2487500000000000000'), 1000)
    assert.isAtMost(th.getDifference(alice_ETHGain, '621875000000000000'), 1000)
    assert.isAtMost(th.getDifference(bob_ETHGain, '1865625000000000000'), 1000)

    // Check total remaining deposits and ETH gain in Stability Pool
    const total_LUSDinSP = (await stabilityPool.getTotalLUSDDeposits()).toString()
    const total_ETHinSP = (await stabilityPool.getETH()).toString()

    assert.isAtMost(th.getDifference(total_LUSDinSP, dec(270, 18)), 1000)
    assert.isAtMost(th.getDifference(total_ETHinSP, dec(4975, 15)), 1000)
  })

  it("liquidateTroves(): when SP > 0, triggers LQTY reward event - increases the sum G", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open troves 
    await borrowerOperations.openTrove(dec(50, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), B, { from: B, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(150, 18), C, { from: C, value: dec(3, 'ether') })

    await borrowerOperations.openTrove(dec(50, 18), defaulter_1, { from: defaulter_1, value: dec(5, 17) })
    await borrowerOperations.openTrove(dec(25, 18), defaulter_2, { from: defaulter_2, value: dec(25, 16) })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })
    assert.equal(await stabilityPool.getTotalLUSDDeposits(), dec(100, 18))

    const G_Before = await stabilityPool.epochToScaleToG(0, 0)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100LUSD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await troveManager.checkRecoveryMode())

    // Liquidate troves
    await troveManager.liquidateTroves(2)
    assert.isFalse(await sortedTroves.contains(defaulter_1))
    assert.isFalse(await sortedTroves.contains(defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has increased from the LQTY reward event triggered
    assert.isTrue(G_After.gt(G_Before))
  })

  it("liquidateTroves(): when SP is empty, doesn't update G", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open troves 
    await borrowerOperations.openTrove(dec(50, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), B, { from: B, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(150, 18), C, { from: C, value: dec(3, 'ether') })

    await borrowerOperations.openTrove(dec(50, 18), defaulter_1, { from: defaulter_1, value: dec(5, 17) })
    await borrowerOperations.openTrove(dec(25, 18), defaulter_2, { from: defaulter_2, value: dec(25, 16) })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // B withdraws
    await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })

    // Check SP is empty
    assert.equal((await stabilityPool.getTotalLUSDDeposits()), '0')

    // Check G is non-zero
    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    assert.isTrue(G_Before.gt(toBN('0')))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100LUSD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await troveManager.checkRecoveryMode())

    // liquidate troves
    await troveManager.liquidateTroves(2)
    assert.isFalse(await sortedTroves.contains(defaulter_1))
    assert.isFalse(await sortedTroves.contains(defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has not changed
    assert.isTrue(G_After.eq(G_Before))
  })


  // --- batchLiquidateTroves() ---

  it('batchLiquidateTroves(): closes every trove with ICR < MCR in the given array', async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(dec(500, 18), whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(200, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(150, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(5, 18), dennis, { from: dennis, value: dec(5, 'ether') })
    await borrowerOperations.openTrove(dec(10, 18), erin, { from: erin, value: dec(5, 'ether') })

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100LUSD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Confirm troves A-C are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await troveManager.getCurrentICR(dennis, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erin, price)).gte(mv._MCR))

    // Confirm Whale is ICR >= 110% 
    assert.isTrue((await troveManager.getCurrentICR(whale, price)).gte(mv._MCR))

    liquidationArray = [alice, bob, carol, dennis, erin]
    await troveManager.batchLiquidateTroves(liquidationArray);

    // Confirm troves A-C have been removed from the system
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))

    // Check all troves A-C are now closed
    assert.equal((await troveManager.Troves(alice))[3].toString(), '2')
    assert.equal((await troveManager.Troves(bob))[3].toString(), '2')
    assert.equal((await troveManager.Troves(carol))[3].toString(), '2')

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedTroves.getSize()).toString(), '3')
  })

  it('batchLiquidateTroves(): does not liquidate troves that are not in the given array', async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(dec(500, 18), whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(200, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(150, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(500, 18), dennis, { from: dennis, value: dec(5, 'ether') })
    await borrowerOperations.openTrove(dec(500, 18), erin, { from: erin, value: dec(5, 'ether') })

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100LUSD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Confirm troves A-E are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(dennis, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erin, price)).lt(mv._MCR))

    liquidationArray = [alice, bob]  // C-E not included
    await troveManager.batchLiquidateTroves(liquidationArray);

    // Confirm troves A-B have been removed from the system
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))

    // Check all troves A-B are now closed
    assert.equal((await troveManager.Troves(alice))[3].toString(), '2')
    assert.equal((await troveManager.Troves(bob))[3].toString(), '2')

    // Confirm troves C-E remain in the system
    assert.isTrue(await sortedTroves.contains(carol))
    assert.isTrue(await sortedTroves.contains(dennis))
    assert.isTrue(await sortedTroves.contains(erin))

    // Check all troves C-E are still active
    assert.equal((await troveManager.Troves(carol))[3].toString(), '1')
    assert.equal((await troveManager.Troves(dennis))[3].toString(), '1')
    assert.equal((await troveManager.Troves(erin))[3].toString(), '1')

    // Check sorted list has been reduced to length 4
    assert.equal((await sortedTroves.getSize()).toString(), '4')
  })

  it('batchLiquidateTroves(): does not close troves with ICR >= MCR in the given array', async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(dec(500, 18), whale, { from: whale, value: dec(100, 'ether') })


    await borrowerOperations.openTrove(dec(200, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(150, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(5, 18), dennis, { from: dennis, value: dec(5, 'ether') })
    await borrowerOperations.openTrove(dec(10, 18), erin, { from: erin, value: dec(5, 'ether') })

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100LUSD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Confirm troves A-C are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol, price)).lt(mv._MCR))

    // Confirm D-E are ICR >= 110%
    assert.isTrue((await troveManager.getCurrentICR(dennis, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erin, price)).gte(mv._MCR))

    // Confirm Whale is ICR > 110% 
    assert.isTrue((await troveManager.getCurrentICR(whale, price)).gte(mv._MCR))

    liquidationArray = [alice, bob, carol, dennis, erin]
    await troveManager.batchLiquidateTroves(liquidationArray);

    // Confirm troves D-E and whale remain in the system
    assert.isTrue(await sortedTroves.contains(dennis))
    assert.isTrue(await sortedTroves.contains(erin))
    assert.isTrue(await sortedTroves.contains(whale))

    // Check all troves D-E and whale remain active
    assert.equal((await troveManager.Troves(dennis))[3].toString(), '1')
    assert.equal((await troveManager.Troves(erin))[3].toString(), '1')
    assert.isTrue(await sortedTroves.contains(whale))

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedTroves.getSize()).toString(), '3')
  })

  it('batchLiquidateTroves(): reverts if array is empty', async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(dec(500, 18), whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(200, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(150, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(5, 18), dennis, { from: dennis, value: dec(5, 'ether') })
    await borrowerOperations.openTrove(dec(10, 18), erin, { from: erin, value: dec(5, 'ether') })

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100LUSD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    liquidationArray = []
    try {
      const tx = await troveManager.batchLiquidateTroves(liquidationArray);
      assert.isFalse(tx.receipt.status)
    } catch (error) {
      assert.include(error.message, "TroveManager: Calldata address array must not be empty")
    }
  })

  it("batchLiquidateTroves(): skips if trove is non-existent", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(dec(500, 18), whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(190, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(140, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(5, 18), dennis, { from: dennis, value: dec(5, 'ether') })
    await borrowerOperations.openTrove(dec(10, 18), erin, { from: erin, value: dec(5, 'ether') })

    assert.equal(await troveManager.getTroveStatus(carol), 0) // check trove non-existent

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), '5')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(500, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100LUSD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Confirm troves A-B are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await troveManager.getCurrentICR(dennis, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erin, price)).gte(mv._MCR))

    // Confirm Whale is ICR >= 110% 
    assert.isTrue((await troveManager.getCurrentICR(whale, price)).gte(mv._MCR))

    // Liquidate - trove C in between the ones to be liquidated!
    const liquidationArray = [alice, carol, bob, dennis, erin]
    await troveManager.batchLiquidateTroves(liquidationArray);

    // Confirm troves A-B have been removed from the system
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))

    // Check all troves A-B are now closed
    assert.equal((await troveManager.Troves(alice))[3].toString(), '2')
    assert.equal((await troveManager.Troves(bob))[3].toString(), '2')

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedTroves.getSize()).toString(), '3')

    // Confirm trove C non-existent
    assert.isFalse(await sortedTroves.contains(carol))
    assert.equal((await troveManager.Troves(carol))[3].toString(), '0')

    // Check Stability pool has only been reduced by A-B
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), dec(150, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());
  })

  it("batchLiquidateTroves(): skips if a trove has been closed", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove(dec(500, 18), whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(190, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(140, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(90, 18), carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(5, 18), dennis, { from: dennis, value: dec(5, 'ether') })
    await borrowerOperations.openTrove(dec(10, 18), erin, { from: erin, value: dec(5, 'ether') })

    assert.isTrue(await sortedTroves.contains(carol))

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(500, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100LUSD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Carol liquidated, and her trove is closed
    const txCarolClose = await borrowerOperations.closeTrove({ from: carol })
    assert.isTrue(txCarolClose.receipt.status)

    assert.isFalse(await sortedTroves.contains(carol))

    assert.equal(await troveManager.getTroveStatus(carol), 2)  // check trove closed

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());

    // Confirm troves A-B are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob, price)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await troveManager.getCurrentICR(dennis, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erin, price)).gte(mv._MCR))

    // Confirm Whale is ICR >= 110% 
    assert.isTrue((await troveManager.getCurrentICR(whale, price)).gte(mv._MCR))

    // Liquidate - trove C in between the ones to be liquidated!
    const liquidationArray = [alice, carol, bob, dennis, erin]
    await troveManager.batchLiquidateTroves(liquidationArray);

    // Confirm troves A-B have been removed from the system
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))

    // Check all troves A-C are now closed
    assert.equal((await troveManager.Troves(alice))[3].toString(), '2')
    assert.equal((await troveManager.Troves(bob))[3].toString(), '2')
    assert.equal((await troveManager.Troves(carol))[3].toString(), '2')

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedTroves.getSize()).toString(), '3')

    // Check Stability pool has only been reduced by A-B
    assert.equal((await stabilityPool.getTotalLUSDDeposits()).toString(), dec(150, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode());
  })

  it("batchLiquidateTroves: when SP > 0, triggers LQTY reward event - increases the sum G", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open troves 
    await borrowerOperations.openTrove(dec(50, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), B, { from: B, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(150, 18), C, { from: C, value: dec(3, 'ether') })

    await borrowerOperations.openTrove(dec(50, 18), defaulter_1, { from: defaulter_1, value: dec(5, 17) })
    await borrowerOperations.openTrove(dec(25, 18), defaulter_2, { from: defaulter_2, value: dec(25, 16) })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })
    assert.equal(await stabilityPool.getTotalLUSDDeposits(), dec(100, 18))

    const G_Before = await stabilityPool.epochToScaleToG(0, 0)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100LUSD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await troveManager.checkRecoveryMode())

    // Liquidate troves
    await troveManager.batchLiquidateTroves([defaulter_1, defaulter_2])
    assert.isFalse(await sortedTroves.contains(defaulter_1))
    assert.isFalse(await sortedTroves.contains(defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has increased from the LQTY reward event triggered
    assert.isTrue(G_After.gt(G_Before))
  })

  it("batchLiquidateTroves(): when SP is empty, doesn't update G", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open troves 
    await borrowerOperations.openTrove(dec(50, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), B, { from: B, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(150, 18), C, { from: C, value: dec(3, 'ether') })

    await borrowerOperations.openTrove(dec(50, 18), defaulter_1, { from: defaulter_1, value: dec(5, 17) })
    await borrowerOperations.openTrove(dec(25, 18), defaulter_2, { from: defaulter_2, value: dec(25, 16) })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // B withdraws
    await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })

    // Check SP is empty
    assert.equal((await stabilityPool.getTotalLUSDDeposits()), '0')

    // Check G is non-zero
    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    assert.isTrue(G_Before.gt(toBN('0')))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100LUSD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await troveManager.checkRecoveryMode())

    // liquidate troves
    await troveManager.batchLiquidateTroves([defaulter_1, defaulter_2])
    assert.isFalse(await sortedTroves.contains(defaulter_1))
    assert.isFalse(await sortedTroves.contains(defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has not changed
    assert.isTrue(G_After.eq(G_Before))
  })

  // --- Redemption hints ---


  it('getRedemptionHints(): gets the address of the first Trove and the final ICR of the last Trove involved in a redemption', async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove('10' + _18_zeros, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('20' + _18_zeros, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('30' + _18_zeros, carol, { from: carol, value: dec(1, 'ether') })
    // Dennis' Trove should be untouched by redemption, because its ICR will be < 110% after the price drop
    await borrowerOperations.openTrove('170' + _18_zeros, dennis, { from: dennis, value: dec(1, 'ether') })

    // Drop the price
    const price = '100' + _18_zeros
    await priceFeed.setPrice(price);

    // --- TEST ---
    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints('55' + _18_zeros, price, 0)

    assert.equal(firstRedemptionHint, carol)
    // Alice trove’s ends up with 0.95 ETH and 5+10 LUSD debt (10 for gas compensation)
    assert.equal(partialRedemptionHintNICR, '6333333333333333333')
  });

  it('getRedemptionHints(): returns 0 as partialRedemptionHintNICR when reaching _maxIterations', async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove('10' + _18_zeros, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('20' + _18_zeros, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('30' + _18_zeros, carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('170' + _18_zeros, dennis, { from: dennis, value: dec(1, 'ether') })

    const price = await priceFeed.getPrice();

    // --- TEST ---

    // Get hints for a redemption of 170 + 30 + some extra LUSD. At least 3 iterations are needed
    // for total redemption of the given amount.
    const {
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints('210' + _18_zeros, price, 2) // limit _maxIterations to 2

    assert.equal(partialRedemptionHintNICR, '0')
  });

    // --- Redemptions  ---

  it('redeemCollateral(): cancels the provided LUSD with debt from Troves with the lowest ICRs and sends an equivalent amount of Ether', async () => {
    // --- SETUP ---

    // A, B, C, D have 20, 30, 40, 310 LUSD debt respectively (inc gas comp)
    await borrowerOperations.openTrove(dec(15, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(30, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), carol, { from: carol, value: dec(1, 'ether') })
    // start Dennis with a high ICR
    await borrowerOperations.openTrove(dec(275, 18), dennis, { from: dennis, value: dec(100, 'ether') })

    const dennis_ETHBalance_Before = toBN(await web3.eth.getBalance(dennis))

    const dennis_LUSDBalance_Before = await lusdToken.balanceOf(dennis)
    assert.equal(dennis_LUSDBalance_Before, dec(275, 18))


    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    // check total LUSD supply is 400
    const totalLUSDSupply = await troveManager.getEntireSystemDebt()
    assert.isTrue(totalLUSDSupply.eq(toBN(dec(400, 18))))

    const redemptionTx = await th.redeemCollateralAndGetTxObject(dennis, contracts, dec(100, 18))

    const emittedVals = th.getEmittedRedemptionValues(redemptionTx)
    const LUSDFee = emittedVals[3]
    const totalLUSDRedeemed = emittedVals[1]
    assert.isTrue(LUSDFee.eq(toBN(dec(20, 18)))) // check Fee was 20, and thus 80 net redeemed amount

    const alice_Trove_After = await troveManager.Troves(alice)
    const bob_Trove_After = await troveManager.Troves(bob)
    const carol_Trove_After = await troveManager.Troves(carol)

    const alice_debt_After = alice_Trove_After[0].toString()
    const bob_debt_After = bob_Trove_After[0].toString()
    const carol_debt_After = carol_Trove_After[0].toString()

    /* check that Dennis' redeemed 80 LUSD has been cancelled with debt from Bobs's Trove (30) and Carol's Trove (40).
    The remaining lot (10) is sent to Alice's Trove, who had the best ICR.
    It leaves her with (10) LUSD debt. */

    assert.equal(alice_debt_After, dec(15, 18))
    assert.equal(bob_debt_After, '0')
    assert.equal(carol_debt_After, '0')

    const dennis_ETHBalance_After = toBN(await web3.eth.getBalance(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)

    const expectedTotalETHDrawn = toBN(dec(80, 18)).div(toBN(200)) // convert 80 LUSD to ETH, at ETH:USD price 200

    assert.isTrue(expectedTotalETHDrawn.eq(receivedETH))

    const dennis_LUSDBalance_After = (await lusdToken.balanceOf(dennis)).toString()
    assert.equal(dennis_LUSDBalance_After, dec(175, 18))
  })

  it('redeemCollateral(): ends the redemption sequence when the token redemption request has been filled', async () => {
    // --- SETUP --- 
    const price = await priceFeed.getPrice()
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(100, 'ether') })

    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await borrowerOperations.openTrove(dec(20, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(20, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(20, 18), carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(20, 18), dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(10, 18), erin, { from: erin, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(dec(240, 18), flyn, { from: flyn, value: dec(100, 'ether') })

    // Check total LUSD supply is 400
    const totalLUSDSupply = await troveManager.getEntireSystemDebt()
    assert.isTrue(totalLUSDSupply.eq(toBN(dec(400, 18))))

    // --- TEST --- 

    // Flyn redeems collateral
    const redemptionTx = await th.redeemCollateralAndGetTxObject(flyn, contracts, dec(100, 18))
    const emittedVals = th.getEmittedRedemptionValues(redemptionTx)
    const totalLUSDRedeemed = emittedVals[1]

    assert.isTrue(totalLUSDRedeemed.eq(toBN(dec(80, 18))))

    // Confirm redemption (80 LUSD) has fully hit A, B, C, D (20 debt each)
    const alice_Debt = await troveManager.getTroveDebt(alice)
    const bob_Debt = await troveManager.getTroveDebt(bob)
    const carol_Debt = await troveManager.getTroveDebt(carol)
    const dennis_Debt = await troveManager.getTroveDebt(dennis)

    assert.equal(alice_Debt, 0)
    assert.equal(bob_Debt, 0)
    assert.equal(carol_Debt, 0)
    assert.equal(dennis_Debt, 0)

    // check Alice, Bob and Carol troves are closed
    const alice_Status = await troveManager.getTroveStatus(alice)
    const bob_Status = await troveManager.getTroveStatus(bob)
    const carol_Status = await troveManager.getTroveStatus(carol)
    const dennis_Status = await troveManager.getTroveStatus(dennis)
    assert.equal(alice_Status, 2)
    assert.equal(bob_Status, 2)
    assert.equal(carol_Status, 2)
    assert.equal(dennis_Status, 2)

    // Check coll of Erin has not been impacted by redemption
    const erin_Debt = await troveManager.getTroveDebt(erin)
    assert.equal(erin_Debt, dec(20, 18))

    const erin_Coll = await troveManager.getTroveColl(erin)

    assert.equal(erin_Coll, dec(1, 'ether'))
  })

  it('redeemCollateral(): ends the redemption sequence when max iterations have been reached', async () => {
    // --- SETUP --- 
    const price = await priceFeed.getPrice()
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(100, 'ether') })

    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await borrowerOperations.openTrove(dec(20, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(20, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(20, 18), carol, { from: carol, value: dec(1, 'ether') })

    // --- TEST --- 

    // open trove from redeemer.  Redeemer has highest ICR (10000ETH, 10000 LUSD), 20000%
    await borrowerOperations.openTrove(dec(10000, 18), flyn, { from: flyn, value: dec(10000, 'ether') })

    // Flyn redeems collateral
    await troveManager.redeemCollateral(dec(60, 18), alice, alice, 0, 2, { from: flyn })

    // Check Flyn's redemption has reduced
    const flynBalance = await lusdToken.balanceOf(flyn)
    assert.isTrue(flynBalance.lt(toBN(dec(10000, 18))))

    // Check debt of Alice, Bob, Carol
    const alice_Debt = await troveManager.getTroveDebt(alice)
    const bob_Debt = await troveManager.getTroveDebt(bob)
    const carol_Debt = await troveManager.getTroveDebt(carol)

    assert.equal(alice_Debt, 0)
    assert.equal(bob_Debt, 0)
    assert.equal(carol_Debt.toString(), dec(30, 18)) // 20 withdrawn + 10 for gas compensation

    // check only 2 troves were redeemed: i.e. Alice and Bob troves are closed, but Carol is not
    const alice_Status = await troveManager.getTroveStatus(alice)
    const bob_Status = await troveManager.getTroveStatus(bob)
    const carol_Status = await troveManager.getTroveStatus(carol)
    assert.equal(alice_Status, 2)
    assert.equal(bob_Status, 2)
    assert.equal(carol_Status, 1)
  })

  it('redeemCollateral(): doesnt perform the final partial redemption in the sequence if the hint is out-of-date', async () => {
    // --- SETUP ---

    const price = await priceFeed.getPrice()

    await borrowerOperations.openTrove(dec(21, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(20, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(270, 18), dennis, { from: dennis, value: dec(100, 'ether') })

    const dennis_ETHBalance_Before = toBN(await web3.eth.getBalance(dennis))

   // Check total LUSD supply is 401
   const totalLUSDSupply = await troveManager.getEntireSystemDebt()
   assert.isTrue(totalLUSDSupply.eq(toBN(dec(401, 18))))

    // --- TEST --- 

    const expectedNetRedemption_1 = await th.getNetRedemption(dec(100, 18), troveManager)

    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(expectedNetRedemption_1, price, 0)

    const { 0: partialRedemptionHint } = await sortedTroves.findInsertPosition(
      partialRedemptionHintNICR,
      dennis,
      dennis
    )

    // Oops - Alice changes her trove's debt (and ICR) before Dennis' tx goes through
    await borrowerOperations.repayLUSD(dec(1, 18), alice, {from: alice})
  
    // Get new expected net redemption (now that total supply has changed) -  check it is 80 LUSD
    const expectedNetRedemption_2 = await th.getNetRedemption(dec(100, 18), troveManager)
    assert.equal(expectedNetRedemption_2, dec(80, 18))

    // Dennis tries to redeem 100 LUSD, but passes the out-of-date ICR hint
    const redemptionTx = await troveManager.redeemCollateral(
      dec(100, 18),
      firstRedemptionHint,
      partialRedemptionHint,
      partialRedemptionHintNICR,
      0,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    // Dennis was able to redeem:
    //  - 50 LUSD from Carol's
    //  - 20 LUSD from Bob's
    // for a total of 70 LUSD.

    // Dennis calculated his hint for redeeming 10 LUSD from Alice's Trove, but when he passed the wrong ICR, the partial redemption failed.
    // So he did not redeem at all from Alice's trove

    // Expect only 70 LUSD worth of ETH drawn
    const expectedTotalETHDrawn = toBN(dec(70, 18)).div(toBN(200)) // 70 LUSD converted to ETH, at ETH:USD price 200
   
    const dennis_ETHBalance_After = toBN(await web3.eth.getBalance(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)
    assert.isTrue(expectedTotalETHDrawn.eq(receivedETH))

    // Check debt of Alice, Bob, Carol
    const alice_Debt = await troveManager.getTroveDebt(alice)
    const bob_Debt = await troveManager.getTroveDebt(bob)
    const carol_Debt = await troveManager.getTroveDebt(carol)

    assert.isTrue(alice_Debt.eq(toBN(dec(30, 18)))) // Alice's trove is left untouched
    assert.equal(bob_Debt, 0)
    assert.equal(carol_Debt, 0) 
  })

  it("redeemCollateral(): can redeem if there is zero active debt but non-zero debt in DefaultPool", async () => {
    // --- SETUP ---

    await borrowerOperations.openTrove('0', alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })

    await lusdToken.transfer(carol, dec(100, 18), { from: bob })

    const price = dec(100, 18)
    await priceFeed.setPrice(price)

    // Liquidate Bob's Trove - there is now no active debt in the system (only pending rewards for Alice)
    await troveManager.liquidateTroves(1)

    // --- TEST --- 

    const carol_ETHBalance_Before = toBN(await web3.eth.getBalance(carol))

    const redemptionTx = await th.redeemCollateralAndGetTxObject(carol, contracts, dec(100, 18))

    const carol_ETHBalance_After = toBN(await web3.eth.getBalance(carol))

    assert.isTrue(carol_ETHBalance_After.gt(carol_ETHBalance_Before))

    const carol_LUSDBalance_After = (await lusdToken.balanceOf(carol)).toString()
    assert.equal(carol_LUSDBalance_After, '0')
  })

  it("redeemCollateral(): doesn't touch Troves with ICR < 110%", async () => {
    // --- SETUP ---

    await borrowerOperations.openTrove(dec(100, 18), alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(2000, 18), carol, { from: carol, value: dec(10000, 'ether') })  // highest ICR

    // Put Bob's Trove below 110% ICR
    const price = dec(100, 18)
    await priceFeed.setPrice(price)

    // --- TEST --- 

    await troveManager.redeemCollateral(
      dec(200, 18),
      bob,
      '0x0000000000000000000000000000000000000000',
      0,
      0,
      { from: carol }
    );

    // Alice's Trove debt was reduced
    const { debt: alice_Debt_After } = await troveManager.Troves(alice)
    assert.isTrue(alice_Debt_After.lt(toBN(dec(110, 18))))

    // Bob's Trove was left untouched
    const { debt: bob_Debt_After } = await troveManager.Troves(bob)
    assert.equal(bob_Debt_After, dec(110, 18))
  });

  it("redeemCollateral(): finds the last Trove with ICR == 110% even if there is more than one", async () => {
    // --- SETUP ---
    await borrowerOperations.openTrove('10000' + _18_zeros, whale, { from: whale, value: dec(1000, 'ether') })

    await borrowerOperations.openTrove('90' + _18_zeros, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('90' + _18_zeros, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('90' + _18_zeros, carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openTrove('91' + _18_zeros, dennis, { from: dennis, value: dec(1, 'ether') })

    await lusdToken.transfer(dennis, '90' + _18_zeros, { from: alice })
    await lusdToken.transfer(dennis, '90' + _18_zeros, { from: bob })
    await lusdToken.transfer(dennis, '90' + _18_zeros, { from: carol })

    // This will put Dennis slightly below 110%, and everyone else exactly at 110%
    const price = '110' + _18_zeros
    await priceFeed.setPrice(price)

    const orderOfTroves = [];
    let current = await sortedTroves.getFirst();

    while (current !== '0x0000000000000000000000000000000000000000') {
      orderOfTroves.push(current);
      current = await sortedTroves.getNext(current);
    }

    assert.deepEqual(orderOfTroves, [whale, carol, bob, alice, dennis]);

    // --- TEST --- 

    await troveManager.redeemCollateral(
      '1000' + _18_zeros,
      carol, // try to trick redeemCollateral by passing a hint that doesn't exactly point to the
      // last Trove with ICR == 110% (which would be Alice's)
      '0x0000000000000000000000000000000000000000',
      0,
      0,
      { from: whale }
    );

    const { debt: alice_Debt_After } = await troveManager.Troves(alice)
    assert.equal(alice_Debt_After, '0')

    const { debt: bob_Debt_After } = await troveManager.Troves(bob)
    assert.equal(bob_Debt_After, '0')

    const { debt: carol_Debt_After } = await troveManager.Troves(carol)
    assert.equal(carol_Debt_After, '0')

    const { debt: dennis_Debt_After } = await troveManager.Troves(dennis)
    assert.equal(dennis_Debt_After, '101' + _18_zeros)
  });

  it("redeemCollateral(): reverts when argument _amount is 0", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(100, 'ether') })

    // Alice opens trove and transfers 500LUSD to Erin, the would-be redeemer
    await borrowerOperations.openTrove(dec(500, 18), alice, { from: alice, value: dec(10, 'ether') })
    await lusdToken.transfer(erin, dec(500, 18), { from: alice })

    // B, C and D open troves
    await borrowerOperations.openTrove(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(200, 18), carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(300, 18), dennis, { from: dennis, value: dec(3, 'ether') })

    // Erin attempts to redeem with _amount = 0
    const redemptionTxPromise = troveManager.redeemCollateral(0, erin, erin, 0, 0, { from: erin })
    await assertRevert(redemptionTxPromise, "TroveManager: Amount must be greater than zero")
  })

  it("redeemCollateral(): doesn't affect the Stability Pool deposits or ETH gain of redeemed-from troves", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(100, 'ether') })

    // Alice opens trove and transfers 400LUSD to Erin, the would-be redeemer
    await borrowerOperations.openTrove(dec(500, 18), alice, { from: alice, value: dec(10, 'ether') })
    await lusdToken.transfer(erin, dec(400, 18), { from: alice })

    // B, C, D, F open trove
    await borrowerOperations.openTrove(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(200, 18), carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openTrove(dec(300, 18), dennis, { from: dennis, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(100, 18), flyn, { from: flyn, value: dec(1, 'ether') })

    // B, C, D deposit some of their tokens to the Stability Pool
    await stabilityPool.provideToSP(dec(50, 18), ZERO_ADDRESS, { from: bob })
    await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: carol })
    await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: dennis })

    let price = await priceFeed.getPrice()
    const bob_ICR_before = await troveManager.getCurrentICR(bob, price)
    const carol_ICR_before = await troveManager.getCurrentICR(carol, price)
    const dennis_ICR_before = await troveManager.getCurrentICR(dennis, price)

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    assert.isTrue(await sortedTroves.contains(flyn))

    // Liquidate Flyn
    await troveManager.liquidate(flyn)
    assert.isFalse(await sortedTroves.contains(flyn))

    // Price bounces back, bringing B, C, D back above MCR
    await priceFeed.setPrice(dec(200, 18))

    const bob_SPDeposit_before = (await stabilityPool.getCompoundedLUSDDeposit(bob)).toString()
    const carol_SPDeposit_before = (await stabilityPool.getCompoundedLUSDDeposit(carol)).toString()
    const dennis_SPDeposit_before = (await stabilityPool.getCompoundedLUSDDeposit(dennis)).toString()

    const bob_ETHGain_before = (await stabilityPool.getDepositorETHGain(bob)).toString()
    const carol_ETHGain_before = (await stabilityPool.getDepositorETHGain(carol)).toString()
    const dennis_ETHGain_before = (await stabilityPool.getDepositorETHGain(dennis)).toString()

    // Check the remaining LUSD and ETH in Stability Pool after liquidation is non-zero
    const LUSDinSP = await stabilityPool.getTotalLUSDDeposits()
    const ETHinSP = await stabilityPool.getETH()
    assert.isTrue(LUSDinSP.gte(mv._zeroBN))
    assert.isTrue(ETHinSP.gte(mv._zeroBN))

    // Erin redeems 400 LUSD
    await troveManager.redeemCollateral(dec(400, 18), erin, erin, 0, 0, { from: erin })

    price = await priceFeed.getPrice()
    const bob_ICR_after = await troveManager.getCurrentICR(bob, price)
    const carol_ICR_after = await troveManager.getCurrentICR(carol, price)
    const dennis_ICR_after = await troveManager.getCurrentICR(dennis, price)

    // Check ICR of B, C and D troves has increased,i.e. they have been hit by redemptions
    assert.isTrue(bob_ICR_after.gte(bob_ICR_before))
    assert.isTrue(carol_ICR_after.gte(carol_ICR_before))
    assert.isTrue(dennis_ICR_after.gte(dennis_ICR_before))

    const bob_SPDeposit_after = (await stabilityPool.getCompoundedLUSDDeposit(bob)).toString()
    const carol_SPDeposit_after = (await stabilityPool.getCompoundedLUSDDeposit(carol)).toString()
    const dennis_SPDeposit_after = (await stabilityPool.getCompoundedLUSDDeposit(dennis)).toString()

    const bob_ETHGain_after = (await stabilityPool.getDepositorETHGain(bob)).toString()
    const carol_ETHGain_after = (await stabilityPool.getDepositorETHGain(carol)).toString()
    const dennis_ETHGain_after = (await stabilityPool.getDepositorETHGain(dennis)).toString()

    // Check B, C, D Stability Pool deposits and ETH gain have not been affected by redemptions from their troves
    assert.equal(bob_SPDeposit_before, bob_SPDeposit_after)
    assert.equal(carol_SPDeposit_before, carol_SPDeposit_after)
    assert.equal(dennis_SPDeposit_before, dennis_SPDeposit_after)

    assert.equal(bob_ETHGain_before, bob_ETHGain_after)
    assert.equal(carol_ETHGain_before, carol_ETHGain_after)
    assert.equal(dennis_ETHGain_before, dennis_ETHGain_after)
  })

  it("redeemCollateral(): caller can redeem their entire LUSDToken balance (split between redemption and fee)", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(100, 'ether') })

    // Alice opens trove and transfers 400 LUSD to Erin, the would-be redeemer
    await borrowerOperations.openTrove(dec(400, 18), alice, { from: alice, value: dec(10, 'ether') })
    await lusdToken.transfer(erin, dec(400, 18), { from: alice })

    // Check Erin's balance before
    const erin_balance_before = await lusdToken.balanceOf(erin)
    assert.equal(erin_balance_before, dec(400, 18))

    // B, C, D open trove
    await borrowerOperations.openTrove(dec(590, 18), bob, { from: bob, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(dec(1990, 18), carol, { from: carol, value: dec(30, 'ether') })
    await borrowerOperations.openTrove(dec(1990, 18), dennis, { from: dennis, value: dec(50, 'ether') })

    // Get active debt and coll before redemption
    const activePool_debt_before = await activePool.getLUSDDebt()
    const activePool_coll_before = await activePool.getETH()

    assert.isTrue(activePool_debt_before.eq(toBN(dec(5020, 18))))
    assert.isTrue(activePool_coll_before.eq(toBN(dec(200, 'ether'))))

    const price = await priceFeed.getPrice()
    
    // Erin attempts to redeem 400 LUSD
    const redemptionTx = await th.redeemCollateralAndGetTxObject(erin, contracts, dec(400, 18))
    const [, totalLUSDRedeemed, , LUSDFee] = th.getEmittedRedemptionValues(redemptionTx)

    // Check the emitted LUSDFee plus net redeemed amount equal the redemption request
    const redeemedPlusFee = toBN(totalLUSDRedeemed).add(toBN(LUSDFee))
    assert.isTrue(toBN(dec(400, 18)).eq(redeemedPlusFee))

    // Check Erin's balance after
    const erin_balance_after = (await lusdToken.balanceOf(erin)).toString()
    assert.equal(erin_balance_after, '0')
  })

  it("redeemCollateral(): reverts when requested redemption amount exceeds caller's LUSD token balance", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(100, 'ether') })

    // Alice opens trove and transfers 400 LUSD to Erin, the would-be redeemer
    await borrowerOperations.openTrove(dec(400, 18), alice, { from: alice, value: dec(10, 'ether') })
    await lusdToken.transfer(erin, dec(400, 18), { from: alice })

    // Check Erin's balance before
    const erin_balance_before = await lusdToken.balanceOf(erin)
    assert.equal(erin_balance_before, dec(400, 18))

    // B, C, D open trove
    await borrowerOperations.openTrove(dec(590, 18), bob, { from: bob, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(dec(1990, 18), carol, { from: carol, value: dec(30, 'ether') })
    await borrowerOperations.openTrove(dec(1990, 18), dennis, { from: dennis, value: dec(50, 'ether') })

    // Get active debt and coll before redemption
    const activePool_debt_before = (await activePool.getLUSDDebt()).toString()
    const activePool_coll_before = (await activePool.getETH()).toString()

    assert.equal(activePool_debt_before, dec(5020, 18))
    assert.equal(activePool_coll_before, dec(200, 'ether'))

    const price = await priceFeed.getPrice()

    let firstRedemptionHint
    let partialRedemptionHintNICR

    // Erin tries to redeem 1000 LUSD
    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintNICR
      } = await hintHelpers.getRedemptionHints(dec(1000, 18), price, 0))

      const { 0: partialRedemptionHint_1 } = await sortedTroves.findInsertPosition(
        partialRedemptionHintNICR,
        erin,
        erin
      )

      const redemptionTx = await troveManager.redeemCollateral(
        dec(1000, 18),
        firstRedemptionHint,
        partialRedemptionHint_1,
        partialRedemptionHintNICR,
        0,
        { from: erin })

      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's LUSD token balance")
    }

    // Erin tries to redeem 401 LUSD
    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintNICR
      } = await hintHelpers.getRedemptionHints('401000000000000000000', price, 0))

      const { 0: partialRedemptionHint_2 } = await sortedTroves.findInsertPosition(
        partialRedemptionHintNICR,
        erin,
        erin
      )

      const redemptionTx = await troveManager.redeemCollateral(
        '401000000000000000000', firstRedemptionHint,
        partialRedemptionHint_2,
        partialRedemptionHintNICR,
        0,
        { from: erin })
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's LUSD token balance")
    }

    // Erin tries to redeem 239482309 LUSD
    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintNICR
      } = await hintHelpers.getRedemptionHints('239482309000000000000000000', price, 0))

      const { 0: partialRedemptionHint_3 } = await sortedTroves.findInsertPosition(
        partialRedemptionHintNICR,
        erin,
        erin
      )

      const redemptionTx = await troveManager.redeemCollateral(
        '239482309000000000000000000', firstRedemptionHint,
        partialRedemptionHint_3,
        partialRedemptionHintNICR,
        0,
        { from: erin })
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's LUSD token balance")
    }

    // Erin tries to redeem 2^256 - 1 LUSD
    const maxBytes32 = toBN('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintNICR
      } = await hintHelpers.getRedemptionHints('239482309000000000000000000', price, 0))

      const { 0: partialRedemptionHint_4 } = await sortedTroves.findInsertPosition(
        partialRedemptionHintNICR,
        erin,
        erin
      )

      const redemptionTx = await troveManager.redeemCollateral(
        maxBytes32, firstRedemptionHint,
        partialRedemptionHint_4,
        partialRedemptionHintNICR,
        0,
        { from: erin })
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's LUSD token balance")
    }
  })

  it("redeemCollateral(): value of issued ETH == face value of redeemed LUSD (assuming 1 LUSD has value of $1)", async () => {
    await borrowerOperations.openTrove(0, whale, { from: whale, value: dec(100, 'ether') })

    // Alice opens trove and transfers 1000 LUSD each to Erin, Flyn, Graham
    await borrowerOperations.openTrove(dec(4990, 18), alice, { from: alice, value: dec(100, 'ether') })
    await lusdToken.transfer(erin, dec(1000, 18), { from: alice })
    await lusdToken.transfer(flyn, dec(1000, 18), { from: alice })
    await lusdToken.transfer(graham, dec(1000, 18), { from: alice })

    // B, C, D open trove
    await borrowerOperations.openTrove(dec(590, 18), bob, { from: bob, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(dec(1090, 18), carol, { from: carol, value: dec(30, 'ether') })
    await borrowerOperations.openTrove(dec(1090, 18), dennis, { from: dennis, value: dec(40, 'ether') })

    const price = await priceFeed.getPrice()

    const _120_LUSD = '120000000000000000000'
    const _373_LUSD = '373000000000000000000'
    const _950_LUSD = '950000000000000000000'

    // Expect 280 Ether in activePool 
    const activeETH_0 = await activePool.getETH()
    assert.equal(activeETH_0, '280000000000000000000');

  
    // Erin redeems 120 LUSD
    const expectedNetRedemption_1 = await th.getNetRedemption(dec(120, 18), troveManager)
    const redemption_1 = await th.redeemCollateralAndGetTxObject(erin, contracts, dec(120, 18))

    // check active pool change
    const activeETH_1 = await activePool.getETH()
    let activeETHDiff = activeETH_0.sub(activeETH_1)
    let activeETHChangeDollarVal = activeETHDiff.mul(price).div(toBN(dec(1, 18)))

    // check ETH val in $ = expectedNetRedemption
    assert.isAtMost(th.getDifference(activeETHChangeDollarVal, expectedNetRedemption_1), 1000)
  
    // Flyn redeems 373 LUSD
    const expectedNetRedemption_2 = await th.getNetRedemption(dec(373, 18), troveManager)

    const redemption_2 = await th.redeemCollateralAndGetTxObject(flyn, contracts, dec(373, 18))

    // check active pool change
    const activeETH_2 = await activePool.getETH()
    activeETHDiff = activeETH_1.sub(activeETH_2)
    activeETHChangeDollarVal = activeETHDiff.mul(price).div(toBN(dec(1, 18)))

    // check ETH val in $ = expectedNetRedemption
    assert.isAtMost(th.getDifference(activeETHChangeDollarVal, expectedNetRedemption_2), 1000)
   
   
    // Graham redeems 950 LUSD
    const expectedNetRedemption_3 = await th.getNetRedemption(dec(950, 18), troveManager)

    const redemption_3 = await th.redeemCollateralAndGetTxObject(graham, contracts, dec(950, 18))

    // check active pool change
    const activeETH_3 = await activePool.getETH()
    activeETHDiff = activeETH_2.sub(activeETH_3)
    activeETHChangeDollarVal = activeETHDiff.mul(price).div(toBN(dec(1, 18)))

    // check ETH val in $ = expectedNetRedemption
    assert.isAtMost(th.getDifference(activeETHChangeDollarVal, expectedNetRedemption_3), 1000)
  })

  it("redeemCollateral(): reverts if there is zero outstanding system debt", async () => {
    // --- SETUP --- illegally mint LUSD to Bob
    await lusdToken.unprotectedMint(bob, dec(100, 18))

    assert.equal((await lusdToken.balanceOf(bob)), dec(100, 18))

    await borrowerOperations.openTrove(0, bob, { from: bob, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(0, carol, { from: carol, value: dec(30, 'ether') })
    await borrowerOperations.openTrove(0, dennis, { from: dennis, value: dec(40, 'ether') })

    const price = await priceFeed.getPrice()

    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints(dec(100, 18), price, 0)

    const { 0: partialRedemptionHint } = await sortedTroves.findInsertPosition(
      partialRedemptionHintNICR,
      bob,
      bob
    )

    // Bob tries to redeem his illegally obtained LUSD
    try {
      const redemptionTx = await troveManager.redeemCollateral(
        dec(100, 18),
        firstRedemptionHint,
        partialRedemptionHint,
        partialRedemptionHintNICR,
        0,
        { from: bob })
    } catch (error) {
      assert.include(error.message, "VM Exception while processing transaction")
    }

    // assert.isFalse(redemptionTx.receipt.status);
  })

  it("redeemCollateral(): reverts if caller's tries to redeem more than the outstanding system debt", async () => {
    // --- SETUP --- illegally mint LUSD to Bob
    await lusdToken.unprotectedMint(bob, '101000000000000000000')

    assert.equal((await lusdToken.balanceOf(bob)), '101000000000000000000')

    await borrowerOperations.openTrove(dec(40, 18), carol, { from: carol, value: dec(30, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), dennis, { from: dennis, value: dec(40, 'ether') })

    assert.equal((await activePool.getLUSDDebt()).toString(), dec(100, 18))

    const price = await priceFeed.getPrice()
    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await hintHelpers.getRedemptionHints('101000000000000000000', price, 0)

    const { 0: partialRedemptionHint } = await sortedTroves.findInsertPosition(
      partialRedemptionHintNICR,
      bob,
      bob
    )

    // Bob attempts to redeem his ill-gotten 101 LUSD, from a system that has 100 LUSD outstanding debt
    try {
      const redemptionTx = await troveManager.redeemCollateral(
        dec(100, 18),
        firstRedemptionHint,
        partialRedemptionHint,
        partialRedemptionHintNICR,
        0,
        { from: bob })
    } catch (error) {
      assert.include(error.message, "VM Exception while processing transaction")
    }
  })

  // Redemption fees 
  it("redeemCollateral(): a redemption made when base rate is zero increases the base rate", async () => {
    await borrowerOperations.openTrove('0', whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(), '0')

    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    assert.isTrue((await troveManager.baseRate()).gt(toBN('0')))
  })

  it("redeemCollateral(): a redemption made when base rate is non-zero increases the base rate, for negligible time passed", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(), '0')

    // A redeems 10 LUSD
    const redemptionTx_A = await th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18))
    const timeStamp_A = await th.getTimestampFromTx(redemptionTx_A, web3)

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // B redeems 10 LUSD
    const redemptionTx_B = await th.redeemCollateralAndGetTxObject(B, contracts, dec(10, 18))
    const timeStamp_B = await th.getTimestampFromTx(redemptionTx_B, web3)

    // Check B's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(B), dec(30, 18))

    // Check negligible time difference (< 1 minute) between txs
    assert.isTrue(Number(timeStamp_B) - Number(timeStamp_A) < 60)

    const baseRate_2 = await troveManager.baseRate()

    // Check baseRate has again increased
    assert.isTrue(baseRate_2.gt(baseRate_1))
  })

  it("redeemCollateral(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation [ @skip-on-coverage ]", async () => {
    await borrowerOperations.openTrove('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime()

    // 45 seconds pass
    th.fastForwardTime(45, web3.currentProvider)

    // Borrower A triggers a fee
    await th.redeemCollateral(A, contracts, dec(1, 18))

    const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime()

    // Check that the last fee operation time did not update, as borrower A's 2nd redemption occured
    // since before minimum interval had passed 
    assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

    // 15 seconds passes
    th.fastForwardTime(15, web3.currentProvider)

    // Check that now, at least one hour has passed since lastFeeOpTime_1
    const timeNow = await th.getLatestBlockTimestamp(web3)
    assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(3600))

    // Borrower A triggers a fee
    await th.redeemCollateral(A, contracts, dec(1, 18))

    const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime()

    // Check that the last fee operation time DID update, as A's 2rd redemption occured
    // after minimum interval had passed 
    assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
  })

  it("redeemCollateral(): a redemption made at zero base rate send a non-zero LUSDFee to LQTY staking contract", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(), '0')

    // Check LQTY Staking contract LUSD balance before is zero
    const lqtyStakingLUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
    assert.equal(lqtyStakingLUSDBalance_Before, '0')

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // Check LQTY Staking LUSD contract balance after is non-zero
    const lqtyStakingLUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
    assert.isTrue(lqtyStakingLUSDBalance_After.gt(toBN('0')))
  })

  it("redeemCollateral(): a redemption made at zero base increases the LUSD-fees-per-LQTY-staked in LQTY Staking contract", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(), '0')

    // Check LQTY Staking LUSD-fees-per-LQTY-staked before is zero
    const F_LUSD_Before = await lqtyStaking.F_LUSD()
    assert.equal(F_LUSD_Before, '0')

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // Check LQTY Staking LUSD-fees-per-LQTY-staked after is non-zero
    const F_LUSD_After = await lqtyStaking.F_LUSD()
    assert.isTrue(F_LUSD_After.gt('0'))
  })

  it("redeemCollateral(): a redemption made at a non-zero base rate send a non-zero ETHFee to LQTY staking contract", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(), '0')

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const lqtyStakingLUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)

    // B redeems 10 LUSD
    await th.redeemCollateral(B, contracts, dec(10, 18))

    // Check B's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(B), dec(30, 18))

    const lqtyStakingLUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)

    // check LQTY Staking LUSD balance has increased
    assert.isTrue(lqtyStakingLUSDBalance_After.gt(lqtyStakingLUSDBalance_Before))
  })

  it("redeemCollateral(): a redemption made at a non-zero base rate increases LUSD-per-LQTY-staked in the staking contract", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(), '0')

    // A redeems 10 LUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // Check LQTY Staking LUSD-fees-per-LQTY-staked before is zero
    const F_LUSD_Before = await lqtyStaking.F_LUSD()

    // B redeems 10 LUSD
    await th.redeemCollateral(B, contracts, dec(10, 18))

    // Check B's balance has decreased by 10 LUSD
    assert.equal(await lusdToken.balanceOf(B), dec(30, 18))

    const F_LUSD_After = await lqtyStaking.F_LUSD()

    // check LQTY LUSD Staking balance has increased
    assert.isTrue(F_LUSD_After.gt(F_LUSD_Before))
  })

  it("redeemCollateral(): a redemption sends the ETH drawn to the redeemer", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openTrove(dec(10, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(20, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(30, 18), C, { from: C, value: dec(1, 'ether') })

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))

    const redemptionTx = await th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18))
    const [, ,totalETHDrawn, ] = th.getEmittedRedemptionValues(redemptionTx)

    // Check emitted ETH drawn is > 0 
    assert.isTrue(totalETHDrawn.gt(toBN('0')))

    const A_balanceAfter = toBN(await web3.eth.getBalance(A))

    // check A's ETH balance has increased by the ETH drawn
    assert.isTrue(A_balanceAfter.sub(A_balanceBefore).eq(totalETHDrawn))
  })

  it("redeemCollateral(): a full redemption (leaving trove with 0 debt), closes the trove", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove(dec(10000, 18), whale, { from: whale, value: dec(10000, 'ether') })  // highest ICR

    await borrowerOperations.openTrove(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(120, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(130, 18), C, { from: C, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), D, { from: D, value: dec(1, 'ether') })

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))
    const B_balanceBefore = toBN(await web3.eth.getBalance(B))
    const C_balanceBefore = toBN(await web3.eth.getBalance(C))

    // whale redeems 400 LUSD.  Expect this to fully redeem A, B, C, and partially redeem D.
    await th.redeemCollateral(whale, contracts, dec(400, 18), { gasPrice: 0 })

    // Check A, B, C have been closed
    assert.isFalse(await sortedTroves.contains(A))
    assert.isFalse(await sortedTroves.contains(B))
    assert.isFalse(await sortedTroves.contains(C))

    // Check D remains active
    assert.isTrue(await sortedTroves.contains(D))
  })

  const redeemCollateral3Full1Partial = async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openTrove(dec(10000, 18), whale, { from: whale, value: dec(10000, 'ether') })

    await borrowerOperations.openTrove(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(120, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(130, 18), C, { from: C, value: dec(1, 'ether') })
    await borrowerOperations.openTrove(dec(40, 18), D, { from: D, value: dec(1, 'ether') })

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))
    const B_balanceBefore = toBN(await web3.eth.getBalance(B))
    const C_balanceBefore = toBN(await web3.eth.getBalance(C))
    const D_balanceBefore = toBN(await web3.eth.getBalance(D))

    const A_collBefore = await troveManager.getTroveColl(A)
    const B_collBefore = await troveManager.getTroveColl(B)
    const C_collBefore = await troveManager.getTroveColl(C)
    const D_collBefore = await troveManager.getTroveColl(D)

    // Confirm baseRate before redemption is 0
    const baseRate = await troveManager.baseRate()
    assert.equal(baseRate, '0')

    // whale redeems 400 LUSD.  Expect this to fully redeem A, B, C, and partially redeem D.
    await th.redeemCollateral(whale, contracts, dec(400, 18), { gasPrice: 0 })

    // Check A, B, C have been closed
    assert.isFalse(await sortedTroves.contains(A))
    assert.isFalse(await sortedTroves.contains(B))
    assert.isFalse(await sortedTroves.contains(C))

    // Check D stays active
    assert.isTrue(await sortedTroves.contains(D))
  }

  it("redeemCollateral(): a redemption that closes a trove leaves the trove's ETH surplus (collateral - ETH drawn) available for the trove owner to claim", async () => {
    await redeemCollateral3Full1Partial()

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))
    const B_balanceBefore = toBN(await web3.eth.getBalance(B))
    const C_balanceBefore = toBN(await web3.eth.getBalance(C))

    // CollSurplusPool endpoint cannot be called directly
    await assertRevert(collSurplusPool.claimColl(A), 'CollSurplusPool: Caller is not Borrower Operations')

    await borrowerOperations.claimRedeemedCollateral(A)
    await borrowerOperations.claimRedeemedCollateral(B)
    await borrowerOperations.claimRedeemedCollateral(C)

    const A_balanceAfter = toBN(await web3.eth.getBalance(A))
    const B_balanceAfter = toBN(await web3.eth.getBalance(B))
    const C_balanceAfter = toBN(await web3.eth.getBalance(C))

    assert.isTrue(A_balanceAfter.eq(A_balanceBefore.add(toBN(dec(5, 17)))))
    assert.isTrue(B_balanceAfter.eq(B_balanceBefore.add(toBN(dec(4, 17)))))
    assert.isTrue(C_balanceAfter.eq(C_balanceBefore.add(toBN(dec(35, 16)))))
  })

  it("redeemCollateral(): a redemption that closes a trove leaves the trove's ETH surplus (collateral - ETH drawn) available for the trove owner after re-opening trove", async () => {
    await redeemCollateral3Full1Partial()

    const A_collSent = toBN(dec(2, 18))
    const B_collSent = toBN(dec(4, 17))
    const C_collSent = toBN(dec(36, 16))

    await borrowerOperations.openTrove(dec(100, 18), ZERO_ADDRESS, { from: A, value: A_collSent })
    await borrowerOperations.openTrove(dec(10, 18), ZERO_ADDRESS, { from: B, value: B_collSent })
    await borrowerOperations.openTrove(0, ZERO_ADDRESS, { from: C, value: C_collSent })

    const A_collAfter = await troveManager.getTroveColl(A)
    const B_collAfter = await troveManager.getTroveColl(B)
    const C_collAfter = await troveManager.getTroveColl(C)

    assert.isTrue(A_collAfter.eq(A_collSent))
    assert.isTrue(B_collAfter.eq(B_collSent))
    assert.isTrue(C_collAfter.eq(C_collSent))

    assert.isTrue((await collSurplusPool.getCollateral(A)).eq(toBN(dec(5, 17))))
    assert.isTrue((await collSurplusPool.getCollateral(B)).eq(toBN(dec(4, 17))))
    assert.isTrue((await collSurplusPool.getCollateral(C)).eq(toBN(dec(35, 16))))

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))
    const B_balanceBefore = toBN(await web3.eth.getBalance(B))
    const C_balanceBefore = toBN(await web3.eth.getBalance(C))

    await borrowerOperations.claimRedeemedCollateral(A)
    await borrowerOperations.claimRedeemedCollateral(B)
    await borrowerOperations.claimRedeemedCollateral(C)

    const A_balanceAfter = toBN(await web3.eth.getBalance(A))
    const B_balanceAfter = toBN(await web3.eth.getBalance(B))
    const C_balanceAfter = toBN(await web3.eth.getBalance(C))

    assert.isTrue(A_balanceAfter.eq(A_balanceBefore.add(toBN(dec(5, 17)))))
    assert.isTrue(B_balanceAfter.eq(B_balanceBefore.add(toBN(dec(4, 17)))))
    assert.isTrue(C_balanceAfter.eq(C_balanceBefore.add(toBN(dec(35, 16)))))
  })

  it("getPendingLUSDDebtReward(): Returns 0 if there is no pending LUSDDebt reward", async () => {
    // Make some troves
    const price = await priceFeed.getPrice()
    await borrowerOperations.openTrove(dec(2000, 18), whale, { from: whale, value: dec(100, 'ether') })
    await stabilityPool.provideToSP(dec(2000, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(dec(20, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(defaulter_1)

    // Confirm defaulter_1 liquidated
    assert.isFalse(await sortedTroves.contains(defaulter_1))

    // Confirm there are no pending rewards from liquidation
    const current_L_LUSDDebt = await troveManager.L_LUSDDebt()
    assert.equal(current_L_LUSDDebt, 0)

    const carolSnapshot_L_LUSDDebt = (await troveManager.rewardSnapshots(carol))[1]
    assert.equal(carolSnapshot_L_LUSDDebt, 0)

    const carol_PendingLUSDDebtReward = await troveManager.getPendingLUSDDebtReward(carol)
    assert.equal(carol_PendingLUSDDebtReward, 0)
  })

  it("getPendingETHReward(): Returns 0 if there is no pending ETH reward", async () => {
    // make some troves
    const price = await priceFeed.getPrice()
    await borrowerOperations.openTrove(dec(2000, 18), whale, { from: whale, value: dec(100, 'ether') })
    await stabilityPool.provideToSP(dec(2000, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openTrove(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

    await borrowerOperations.openTrove(dec(20, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(defaulter_1)

    // Confirm defaulter_1 liquidated
    assert.isFalse(await sortedTroves.contains(defaulter_1))

    // Confirm there are no pending rewards from liquidation
    const current_L_ETH = await troveManager.L_ETH()
    assert.equal(current_L_ETH, 0)

    const carolSnapshot_L_ETH = (await troveManager.rewardSnapshots(carol))[0]
    assert.equal(carolSnapshot_L_ETH, 0)

    const carol_PendingETHReward = await troveManager.getPendingETHReward(carol)
    assert.equal(carol_PendingETHReward, 0)
  })

  // --- computeICR ---

  it("computeICR(): Returns 0 if trove's coll is worth 0", async () => {
    const price = 0
    const coll = dec(1, 'ether')
    const debt = dec(100, 18)

    const ICR = (await troveManager.computeICR(coll, debt, price)).toString()

    assert.equal(ICR, 0)
  })

  it("computeICR(): Returns 2^256-1 for ETH:USD = 100, coll = 1 ETH, debt = 100 LUSD", async () => {
    const price = dec(100, 18)
    const coll = dec(1, 'ether')
    const debt = dec(100, 18)

    const ICR = (await troveManager.computeICR(coll, debt, price)).toString()

    assert.equal(ICR, dec(1, 18))
  })

  it("computeICR(): returns correct ICR for ETH:USD = 100, coll = 200 ETH, debt = 30 LUSD", async () => {
    const price = dec(100, 18)
    const coll = dec(200, 'ether')
    const debt = dec(30, 18)

    const ICR = (await troveManager.computeICR(coll, debt, price)).toString()

    assert.isAtMost(th.getDifference(ICR, '666666666666666666666'), 1000)
  })

  it("computeICR(): returns correct ICR for ETH:USD = 250, coll = 1350 ETH, debt = 127 LUSD", async () => {
    const price = '250000000000000000000'
    const coll = '1350000000000000000000'
    const debt = '127000000000000000000'

    const ICR = (await troveManager.computeICR(coll, debt, price))

    assert.isAtMost(th.getDifference(ICR, '2657480314960630000000'), 1000000)
  })

  it("computeICR(): returns correct ICR for ETH:USD = 100, coll = 1 ETH, debt = 54321 LUSD", async () => {
    const price = dec(100, 18)
    const coll = dec(1, 'ether')
    const debt = '54321000000000000000000'

    const ICR = (await troveManager.computeICR(coll, debt, price)).toString()

    assert.isAtMost(th.getDifference(ICR, '1840908672520756'), 1000)
  })


  it("computeICR(): Returns 2^256-1 if trove has non-zero coll and zero debt", async () => {
    const price = dec(100, 18)
    const coll = dec(1, 'ether')
    const debt = 0

    const ICR = web3.utils.toHex(await troveManager.computeICR(coll, debt, price))
    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    assert.equal(ICR, maxBytes32)
  })

  // --- checkRecoveryMode ---

  //TCR < 150%
  it("checkRecoveryMode(): Returns true when TCR < 150%", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await borrowerOperations.openTrove(dec(190, 18), alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(190, 18), bob, { from: bob, value: dec(3, 'ether') })

    await priceFeed.setPrice('99999999999999999999')

    const TCR = (await troveManager.getTCR())

    assert.isTrue(TCR.lte(toBN('1500000000000000000')))

    assert.isTrue(await troveManager.checkRecoveryMode())
  })

  // TCR == 150%
  it("checkRecoveryMode(): Returns false when TCR == 150%", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await borrowerOperations.openTrove(dec(190, 18), alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(190, 18), bob, { from: bob, value: dec(3, 'ether') })

    await priceFeed.setPrice('100000000000000000001')

    const TCR = (await troveManager.getTCR())

    assert.isTrue(TCR.gte(toBN('1500000000000000000')))

    assert.isFalse(await troveManager.checkRecoveryMode())
  })

  // > 150%
  it("checkRecoveryMode(): Returns false when TCR > 150%", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await borrowerOperations.openTrove(dec(190, 18), alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(190, 18), bob, { from: bob, value: dec(3, 'ether') })

    const TCR = (await troveManager.getTCR()).toString()

    assert.equal(TCR, '1500000000000000000')

    assert.isFalse(await troveManager.checkRecoveryMode())
  })

  // check 0
  it("checkRecoveryMode(): Returns false when TCR == 0", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await borrowerOperations.openTrove(dec(190, 18), alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(190, 18), bob, { from: bob, value: dec(3, 'ether') })

    await priceFeed.setPrice(0)

    const TCR = (await troveManager.getTCR()).toString()

    assert.equal(TCR, 0)

    assert.isTrue(await troveManager.checkRecoveryMode())
  })

  // --- Getters ---

  it("getTroveStake(): Returns stake", async () => {
    await borrowerOperations.openTrove(dec(190, 18), A, { from: A, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(27, 18), B, { from: B, value: dec(1, 'ether') })

    const A_Stake = await troveManager.getTroveStake(A)
    const B_Stake = await troveManager.getTroveStake(B)

    assert.equal(A_Stake, dec(3, 'ether'))
    assert.equal(B_Stake, dec(1, 'ether'))
  })

  it("getTroveColl(): Returns coll", async () => {
    await borrowerOperations.openTrove(dec(190, 18), A, { from: A, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(27, 18), B, { from: B, value: dec(1, 'ether') })

    const A_Coll = await troveManager.getTroveColl(A)
    const B_Coll = await troveManager.getTroveColl(B)

    assert.equal(A_Coll, dec(3, 'ether'))
    assert.equal(B_Coll, dec(1, 'ether'))
  })

  it("getTroveDebt(): Returns debt", async () => {
    await borrowerOperations.openTrove(dec(190, 18), A, { from: A, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(27, 18), B, { from: B, value: dec(1, 'ether') })

    const A_Debt = await troveManager.getTroveDebt(A)
    const B_Debt = await troveManager.getTroveDebt(B)

    // Expect debt = requested + 10 (due to gas comp)

    assert.equal(A_Debt, dec(200, 18))
    assert.equal(B_Debt, dec(37, 18))
  })

  it("getTroveStatus(): Returns status", async () => {
    await borrowerOperations.openTrove(dec(190, 18), A, { from: A, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(27, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.closeTrove({from: B})

    const A_Status = await troveManager.getTroveStatus(A)
    const B_Status = await troveManager.getTroveStatus(B)
    const C_Status = await troveManager.getTroveStatus(C)

    assert.equal(A_Status, '1')  // active
    assert.equal(B_Status, '2')  // closed
    assert.equal(C_Status, '0')  // non-existent
  })

  // --- Internal removeTroveOwner ---

  it("Internal _removeTroveOwner(): Reverts if trove has been closed", async () => { 
    await borrowerOperations.openTrove(dec(1, 18), C, { from: C, value: dec(3, 'ether') })
    await borrowerOperations.openTrove(dec(190, 18), A, { from: A, value: dec(3, 'ether') })
   
    // B closes, leaves 2 troves in system
    await borrowerOperations.openTrove(dec(27, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.closeTrove({from: B})

    /* Call the external tester function that directly accesses the internal _removeTroveOwner() function.
     Try to remove B */
    const txPromise_B = troveManager.callInternalRemoveTroveOwner(B)

    assertRevert(txPromise_B)
  })
})

contract('Reset chain state', async accounts => { })
