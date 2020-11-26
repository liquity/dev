const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const CDPManagerTester = artifacts.require("./CDPManagerTester.sol")
const CLVTokenTester = artifacts.require("./CLVTokenTester.sol")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

contract('CDPManager', async accounts => {

  const _18_zeros = '000000000000000000'
  const ZERO_ADDRESS = th.ZERO_ADDRESS

  const [
    owner,
    alice, bob, carol, dennis, erin, flyn, graham, harriet, ida,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4, whale,
    A, B, C, D, E] = accounts;

  let priceFeed
  let clvToken
  let sortedCDPs
  let cdpManager
  let activePool
  let stabilityPool
  let collSurplusPool
  let defaultPool
  let borrowerOperations
  let hintHelpers

  let contracts

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.cdpManager = await CDPManagerTester.new()
    contracts.clvToken = await CLVTokenTester.new(
      contracts.cdpManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    const LQTYContracts = await deploymentHelper.deployLQTYContracts()

    priceFeed = contracts.priceFeed
    clvToken = contracts.clvToken
    sortedCDPs = contracts.sortedCDPs
    cdpManager = contracts.cdpManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    collSurplusPool = contracts.collSurplusPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    lqtyStaking = LQTYContracts.lqtyStaking
    growthToken = LQTYContracts.growthToken
    communityIssuance = LQTYContracts.communityIssuance
    lockupContractFactory = LQTYContracts.lockupContractFactory

    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
  })

  it('liquidate(): closes a CDP that has ICR < MCR', async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(50, 'ether') })
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })

    const price = await priceFeed.getPrice()
    const ICR_Before = await cdpManager.getCurrentICR(alice, price)
    assert.equal(ICR_Before, dec(20, 18))

    const MCR = (await cdpManager.MCR()).toString()
    assert.equal(MCR.toString(), '1100000000000000000')

    // Alice withdraws to 180 CLV, lowering her ICR to 1.11
    const A_CLVWithdrawal = await th.getActualDebtFromComposite(dec(180, 18), contracts)

    await borrowerOperations.withdrawCLV(A_CLVWithdrawal, alice, { from: alice })

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
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })
    // Alice withdraws 100CLV, Bob withdraws 180CLV
    const A_CLVWithdrawal = await th.getActualDebtFromComposite(dec(100, 18), contracts)
    const B_CLVWithdrawal = await th.getActualDebtFromComposite(dec(180, 18), contracts)
    await borrowerOperations.withdrawCLV(A_CLVWithdrawal, alice, { from: alice })
    await borrowerOperations.withdrawCLV(B_CLVWithdrawal, bob, { from: bob })

    // --- TEST ---

    // check ActivePool ETH and CLV debt before
    const activePool_ETH_Before = (await activePool.getETH()).toString()
    const activePool_RawEther_Before = (await web3.eth.getBalance(activePool.address)).toString()
    const activePool_CLVDebt_Before = (await activePool.getCLVDebt()).toString()

    assert.equal(activePool_ETH_Before, dec(11, 'ether'))
    assert.equal(activePool_RawEther_Before, dec(11, 'ether'))
    assert.equal(activePool_CLVDebt_Before, '280000000000000000000')

    // price drops to 1ETH:100CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    /* close Bob's CDP. Should liquidate his 1 ether and 180CLV, 
    leaving 10 ether and 100 CLV debt in the ActivePool. */
    await cdpManager.liquidate(bob, { from: owner });

    // check ActivePool ETH and CLV debt 
    const activePool_ETH_After = (await activePool.getETH()).toString()
    const activePool_RawEther_After = (await web3.eth.getBalance(activePool.address)).toString()
    const activePool_CLVDebt_After = (await activePool.getCLVDebt()).toString()

    assert.equal(activePool_ETH_After, dec(10, 'ether'))
    assert.equal(activePool_RawEther_After, dec(10, 'ether'))
    assert.equal(activePool_CLVDebt_After, '100000000000000000000')
  })

  it("liquidate(): increases DefaultPool ETH and CLV debt by correct amounts", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })

    await borrowerOperations.withdrawCLV('1000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('170000000000000000000', bob, { from: bob })

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
    await cdpManager.liquidate(bob, { from: owner });

    // check after
    const defaultPool_ETH_After = (await defaultPool.getETH()).toString()
    const defaultPool_RawEther_After = (await web3.eth.getBalance(defaultPool.address)).toString()
    const defaultPool_CLVDebt_After = (await defaultPool.getCLVDebt()).toString()

    assert.equal(defaultPool_ETH_After, dec(995, 15))
    assert.equal(defaultPool_RawEther_After, dec(995, 15))
    assert.equal(defaultPool_CLVDebt_After, '180000000000000000000')
  })

  it("liquidate(): removes the CDP's stake from the total stakes", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })

    const A_CLVWithdrawal = await th.getActualDebtFromComposite(dec(100, 18), contracts)
    const B_CLVWithdrawal = await th.getActualDebtFromComposite(dec(180, 18), contracts)
    await borrowerOperations.withdrawCLV(A_CLVWithdrawal, alice, { from: alice })
    await borrowerOperations.withdrawCLV(B_CLVWithdrawal, bob, { from: bob })

    // --- TEST ---

    // check totalStakes before
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()
    assert.equal(totalStakes_Before, dec(11, 'ether'))

    // price drops to 1ETH:100CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Close Bob's CDP
    await cdpManager.liquidate(bob, { from: owner });

    // check totalStakes after
    const totalStakes_After = (await cdpManager.totalStakes()).toString()
    assert.equal(totalStakes_After, dec(10, 'ether'))
  })

  it("liquidate(): Removes the correct trove from the CDPOwners array, and moves the last array element to the new empty slot", async () => {
    // --- SETUP --- 
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('101000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('102000000000000000000', carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('103000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('104000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // At this stage, CDPOwners array should be: [W, A, B, C, D, E] 

    // Drop price
    await priceFeed.setPrice(dec(100, 18))

    const arrayLength_Before = await cdpManager.getCDPOwnersCount()
    assert.equal(arrayLength_Before, 6)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

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
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })

    await borrowerOperations.withdrawCLV('1000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('170000000000000000000', bob, { from: bob })

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

    // close Bob's CDP.  His 1*0.995 ether and 180 CLV should be added to the DefaultPool.
    await cdpManager.liquidate(bob, { from: owner });

    /* check snapshots after. Total stakes should be equal to the  remaining stake then the system: 
    10 ether, Alice's stake.
     
    Total collateral should be equal to Alice's collateral (10 ether) plus her pending ETH reward (1*0.995 ether), earned
    from the liquidation of Bob's CDP */
    const totalStakesSnapshot_After = (await cdpManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_After = (await cdpManager.totalCollateralSnapshot()).toString()

    assert.equal(totalStakesSnapshot_After, dec(10, 'ether'))
    assert.equal(totalCollateralSnapshot_After, dec(10995, 15))
  })

  it("liquidate(): updates the L_ETH and L_CLVDebt reward-per-unit-staked totals", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: dec(1, 'ether') })

    // Carol withdraws 170CLV, lowering her ICR to 1.11
    await borrowerOperations.withdrawCLV('170000000000000000000', carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carols's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // close Carol's CDP.  
    assert.isTrue(await sortedCDPs.contains(carol))
    await cdpManager.liquidate(carol, { from: owner });
    assert.isFalse(await sortedCDPs.contains(carol))

    /* Alice and Bob have the same active stakes. totalStakes in the system is (10 + 10) = 20 ether.
    
    Carol's 1*0.995 ether and 180 CLV should be added to the DefaultPool. The system rewards-per-unit-staked should now be:
    
    L_ETH = (0.995 / 20) = 0.04975 ETH
    L_CLVDebt = (180 / 20) = 9 CLV */
    const L_ETH_AfterCarolLiquidated = await cdpManager.L_ETH()
    const L_CLVDebt_AfterCarolLiquidated = await cdpManager.L_CLVDebt()

    assert.isAtMost(th.getDifference(L_ETH_AfterCarolLiquidated, '49750000000000000'), 100)
    assert.isAtMost(th.getDifference(L_CLVDebt_AfterCarolLiquidated, '9000000000000000000'), 100)

    // Bob now withdraws 790 CLV, bringing his ICR to 1.11
    await borrowerOperations.withdrawCLV('790000000000000000000', bob, { from: bob })

    // Confirm system is in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // price drops to 1ETH:50CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice(dec(50, 18));
    const price = await priceFeed.getPrice()

    // close Bob's CDP 
    assert.isTrue(await sortedCDPs.contains(bob))
    await cdpManager.liquidate(bob, { from: owner });
    assert.isFalse(await sortedCDPs.contains(bob))

    /* Alice now has all the active stake. totalStakes in the system is now 10 ether.
   
   Bob's pending collateral reward (10 * 0.05 * 0.995 = 0.4975 ETH) and debt reward (10 * 9 = 90 CLV) are applied to his CDP
   before his liquidation.
   His total collateral (10 + 0.4975 = 10.4975 ETH)*0.995 and debt (800 + 90 = 890 CLV) are then added to the DefaultPool. 
   
   The system rewards-per-unit-staked should now be:
   
   L_ETH = (0.995 / 20) + (10.4975*0.995  / 10) = 1.09425125 ETH
   L_CLVDebt = (180 / 20) + (890 / 10) = 98 CLV */
    const L_ETH_AfterBobLiquidated = await cdpManager.L_ETH()
    const L_CLVDebt_AfterBobLiquidated = await cdpManager.L_CLVDebt()

    assert.isAtMost(th.getDifference(L_ETH_AfterBobLiquidated, '1094251250000000000'), 100)
    assert.isAtMost(th.getDifference(L_CLVDebt_AfterBobLiquidated, '98000000000000000000'), 100)
  })

  it("liquidate(): Liquidates undercollateralized trove if there are two troves in the system", async () => {
    await borrowerOperations.openLoan(dec(50, 18), bob, { from: bob, value: dec(100, 'ether') })

    // Alice creates a single trove with 0.5 ETH and a debt of 50 LQTY,  and provides 10 CLV to SP

    const A_CLVWithdrawal = await th.getActualDebtFromComposite(dec(50, 18), contracts)
    await borrowerOperations.openLoan(A_CLVWithdrawal, alice, { from: alice, value: dec(500, 'finney') })

    // Alice proves 10 CLV to SP
    await stabilityPool.provideToSP(dec(10, 18), ZERO_ADDRESS, { from: alice })

    // Set ETH:USD price to 105
    await priceFeed.setPrice('105000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isFalse(await cdpManager.checkRecoveryMode())

    const alice_ICR = (await cdpManager.getCurrentICR(alice, price)).toString()
    assert.equal(alice_ICR, '1050000000000000000')

    const activeTrovesCount_Before = await cdpManager.getCDPOwnersCount()

    assert.equal(activeTrovesCount_Before, 2)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

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
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(10, 'ether') })

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
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(180, 18), bob, { from: bob, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    assert.isTrue(await sortedCDPs.contains(carol))

    // price drops, Carol ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

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
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(180, 18), bob, { from: bob, value: dec(10, 'ether') })

    const TCR_Before = (await cdpManager.getTCR()).toString()
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

    const TCR_After = (await cdpManager.getTCR()).toString()
    const listSize_After = (await sortedCDPs.getSize()).toString()

    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
  })

  it("liquidate(): Given the same price and no other loan changes, complete Pool offsets restore the TCR to its value prior to the defaulters opening troves", async () => {
    // Whale provides 2000 CLV to SP
    await borrowerOperations.openLoan(dec(2000, 18), whale, { from: whale, value: dec(100, 'ether') })
    await stabilityPool.provideToSP(dec(2000, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(7, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(20, 'ether') })

    const TCR_Before = (await cdpManager.getTCR()).toString()

    await borrowerOperations.openLoan('101000000000000000000', defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('257000000000000000000', defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
    await borrowerOperations.openLoan('328000000000000000000', defaulter_3, { from: defaulter_3, value: dec(3, 'ether') })
    await borrowerOperations.openLoan('480000000000000000000', defaulter_4, { from: defaulter_4, value: dec(4, 'ether') })

    assert.isTrue((await sortedCDPs.contains(defaulter_1)))
    assert.isTrue((await sortedCDPs.contains(defaulter_2)))
    assert.isTrue((await sortedCDPs.contains(defaulter_3)))
    assert.isTrue((await sortedCDPs.contains(defaulter_4)))

    // Price drop
    await priceFeed.setPrice(dec(100, 18))

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
    await priceFeed.setPrice(dec(200, 18))

    const TCR_After = (await cdpManager.getTCR()).toString()
    assert.equal(TCR_Before, TCR_After)
  })


  it("liquidate(): Pool offsets increase the TCR", async () => {
    // Whale provides 2000 CLV to SP
    await borrowerOperations.openLoan(dec(2000, 18), whale, { from: whale, value: dec(100, 'ether') })
    await stabilityPool.provideToSP(dec(2000, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(7, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(20, 'ether') })

    await borrowerOperations.openLoan('101000000000000000000', defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('257000000000000000000', defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
    await borrowerOperations.openLoan('328000000000000000000', defaulter_3, { from: defaulter_3, value: dec(3, 'ether') })
    await borrowerOperations.openLoan('480000000000000000000', defaulter_4, { from: defaulter_4, value: dec(4, 'ether') })

    assert.isTrue((await sortedCDPs.contains(defaulter_1)))
    assert.isTrue((await sortedCDPs.contains(defaulter_2)))
    assert.isTrue((await sortedCDPs.contains(defaulter_3)))
    assert.isTrue((await sortedCDPs.contains(defaulter_4)))

    await priceFeed.setPrice(dec(100, 18))

    const TCR_1 = await cdpManager.getTCR()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Check TCR improves with each liquidation that is offset with Pool
    await cdpManager.liquidate(defaulter_1)
    assert.isFalse((await sortedCDPs.contains(defaulter_1)))
    const TCR_2 = await cdpManager.getTCR()
    assert.isTrue(TCR_2.gte(TCR_1))

    await cdpManager.liquidate(defaulter_2)
    assert.isFalse((await sortedCDPs.contains(defaulter_2)))
    const TCR_3 = await cdpManager.getTCR()
    assert.isTrue(TCR_3.gte(TCR_2))

    await cdpManager.liquidate(defaulter_3)
    assert.isFalse((await sortedCDPs.contains(defaulter_3)))
    const TCR_4 = await cdpManager.getTCR()
    assert.isTrue(TCR_4.gte(TCR_4))

    await cdpManager.liquidate(defaulter_4)
    assert.isFalse((await sortedCDPs.contains(defaulter_4)))
    const TCR_5 = await cdpManager.getTCR()
    assert.isTrue(TCR_5.gte(TCR_5))
  })

  it("liquidate(): a pure redistribution reduces the TCR only as a result of compensation", async () => {
    await borrowerOperations.openLoan(dec(2000, 18), whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(7, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(20, 'ether') })

    await borrowerOperations.openLoan('101000000000000000000', defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('257000000000000000000', defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
    await borrowerOperations.openLoan('328000000000000000000', defaulter_3, { from: defaulter_3, value: dec(3, 'ether') })
    await borrowerOperations.openLoan('480000000000000000000', defaulter_4, { from: defaulter_4, value: dec(4, 'ether') })

    assert.isTrue((await sortedCDPs.contains(defaulter_1)))
    assert.isTrue((await sortedCDPs.contains(defaulter_2)))
    assert.isTrue((await sortedCDPs.contains(defaulter_3)))
    assert.isTrue((await sortedCDPs.contains(defaulter_4)))

    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const TCR_0 = await cdpManager.getTCR()

    const entireSystemCollBefore = await cdpManager.getEntireSystemColl()
    const entireSystemDebtBefore = await cdpManager.getEntireSystemDebt()

    const expectedTCR_0 = entireSystemCollBefore.mul(price).div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_0.eq(TCR_0))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Check TCR does not decrease with each liquidation 
    const liquidationTx_1 = await cdpManager.liquidate(defaulter_1)
    const [liquidatedDebt_1, liquidatedColl_1, gasComp_1] = th.getEmittedLiquidationValues(liquidationTx_1)
    assert.isFalse((await sortedCDPs.contains(defaulter_1)))
    const TCR_1 = await cdpManager.getTCR()

    // Expect only change to TCR to be due to the issued gas compensation
    const expectedTCR_1 = (entireSystemCollBefore
      .sub(gasComp_1))
      .mul(price)
      .div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_1.eq(TCR_1))

    const liquidationTx_2 = await cdpManager.liquidate(defaulter_2)
    const [liquidatedDebt_2, liquidatedColl_2, gasComp_2] = th.getEmittedLiquidationValues(liquidationTx_2)
    assert.isFalse((await sortedCDPs.contains(defaulter_2)))

    const TCR_2 = await cdpManager.getTCR()

    const expectedTCR_2 = (entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2))
      .mul(price)
      .div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_2.eq(TCR_2))

    const liquidationTx_3 = await cdpManager.liquidate(defaulter_3)
    const [liquidatedDebt_3, liquidatedColl_3, gasComp_3] = th.getEmittedLiquidationValues(liquidationTx_3)
    assert.isFalse((await sortedCDPs.contains(defaulter_3)))

    const TCR_3 = await cdpManager.getTCR()

    const expectedTCR_3 = (entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2)
      .sub(gasComp_3))
      .mul(price)
      .div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_3.eq(TCR_3))


    const liquidationTx_4 = await cdpManager.liquidate(defaulter_4)
    const [liquidatedDebt_4, liquidatedColl_4, gasComp_4] = th.getEmittedLiquidationValues(liquidationTx_4)
    assert.isFalse((await sortedCDPs.contains(defaulter_4)))

    const TCR_4 = await cdpManager.getTCR()

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
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Bob sends tokens to Dennis, who has no trove
    await clvToken.transfer(dennis, dec(200, 18), { from: bob })

    //Dennis provides 200 CLV to SP
    await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: dennis })

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    const liquidationTX_C = await cdpManager.liquidate(carol)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTX_C)

    assert.isFalse(await sortedCDPs.contains(carol))
    // Check Dennis' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const dennis_Deposit_Before = (await stabilityPool.getCompoundedCLVDeposit(dennis)).toString()
    const dennis_ETHGain_Before = (await stabilityPool.getDepositorETHGain(dennis)).toString()
    assert.isAtMost(th.getDifference(dennis_Deposit_Before, th.toBN(dec(200, 18)).sub(liquidatedDebt)), 1000)
    assert.isAtMost(th.getDifference(dennis_ETHGain_Before, liquidatedColl), 1000)

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
    const dennis_Deposit_After = (await stabilityPool.getCompoundedCLVDeposit(dennis)).toString()
    const dennis_ETHGain_After = (await stabilityPool.getDepositorETHGain(dennis)).toString()
    assert.equal(dennis_Deposit_Before, dennis_Deposit_After)
    assert.equal(dennis_ETHGain_Before, dennis_ETHGain_After)
  })

  it("liquidate(): does not liquidate a SP depositor's trove with ICR > 110%, and does not affect their SP deposit or ETH gain", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    //Bob provides 200 CLV to SP
    await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: bob })

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    const liquidationTX_C = await cdpManager.liquidate(carol)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTX_C)
    assert.isFalse(await sortedCDPs.contains(carol))

    // price bounces back - Bob's trove is >110% ICR again
    await priceFeed.setPrice(dec(200, 18))
    const price = await priceFeed.getPrice()
    assert.isTrue((await cdpManager.getCurrentICR(bob, price)).gt(mv._MCR))

    // Check Bob' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const bob_Deposit_Before = (await stabilityPool.getCompoundedCLVDeposit(bob)).toString()
    const bob_ETHGain_Before = (await stabilityPool.getDepositorETHGain(bob)).toString()
    assert.isAtMost(th.getDifference(bob_Deposit_Before, th.toBN(dec(200, 18)).sub(liquidatedDebt)), 1000)
    assert.isAtMost(th.getDifference(bob_ETHGain_Before, liquidatedColl), 1000)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Attempt to liquidate Bob
    await cdpManager.liquidate(bob)

    // Confirm Bob's trove is still active
    assert.isTrue(await sortedCDPs.contains(bob))

    // Check Bob' SP deposit does not change after liquidation attempt
    const bob_Deposit_After = (await stabilityPool.getCompoundedCLVDeposit(bob)).toString()
    const bob_ETHGain_After = (await stabilityPool.getDepositorETHGain(bob)).toString()
    assert.equal(bob_Deposit_Before, bob_Deposit_After)
    assert.equal(bob_ETHGain_Before, bob_ETHGain_After)
  })

  it("liquidate(): liquidates a SP depositor's trove with ICR < 110%, and the liquidation correctly impacts their SP deposit and ETH gain", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(300, 18), alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(90, 18), carol, { from: carol, value: dec(1, 'ether') })

    //Bob provides 200 CLV to SP
    await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: bob })

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(carol)

    // Check Bob' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const bob_Deposit_Before = (await stabilityPool.getCompoundedCLVDeposit(bob)).toString()
    const bob_ETHGain_Before = (await stabilityPool.getDepositorETHGain(bob)).toString()
    assert.isAtMost(th.getDifference(bob_Deposit_Before, dec(100, 18)), 1000)
    assert.isAtMost(th.getDifference(bob_ETHGain_Before, dec(995, 15)), 1000)

    // Alice provides 300 CLV to SP
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: alice })

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Liquidate Bob. 200 CLV and 2 ETH is liquidated
    await cdpManager.liquidate(bob)

    // Confirm Bob's trove has been closed
    assert.isFalse(await sortedCDPs.contains(bob))
    const bob_Trove_Status = ((await cdpManager.CDPs(bob))[3]).toString()
    assert.equal(bob_Trove_Status, 2) // check closed

    /* Alice's CLV Loss = (300 / 400) * 210 = 157.5 CLV
       Alice's ETH gain = (300 / 400) * 2*0.995 = 1.4925 ETH

       Bob's CLVLoss = (100 / 400) * 210 = 52.5 CLV
       Bob's ETH gain = (100 / 400) * 2*0.995 = 0.4975 ETH

     Check Bob' SP deposit has been reduced to 47.5 CLV, and his ETH gain has increased to 1.5 ETH. */
    const bob_Deposit_After = (await stabilityPool.getCompoundedCLVDeposit(bob)).toString()
    const bob_ETHGain_After = (await stabilityPool.getDepositorETHGain(bob)).toString()

    assert.isAtMost(th.getDifference(bob_Deposit_After, dec(475, 17)), 1000)
    assert.isAtMost(th.getDifference(bob_ETHGain_After, '1492500000000000000'), 1000)
  })

  it("liquidate(): does not alter the liquidated user's token balance", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(300, 18), alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })
    await priceFeed.setPrice(dec(100, 18))

    // Check token balances 
    assert.equal((await clvToken.balanceOf(alice)).toString(), dec(300, 18))
    assert.equal((await clvToken.balanceOf(bob)).toString(), dec(200, 18))
    assert.equal((await clvToken.balanceOf(carol)).toString(), dec(100, 18))

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
    assert.equal((await clvToken.balanceOf(alice)).toString(), dec(300, 18))
    assert.equal((await clvToken.balanceOf(bob)).toString(), dec(200, 18))
    assert.equal((await clvToken.balanceOf(carol)).toString(), dec(100, 18))
  })

  it("liquidate(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    const withdrawal_A = await th.getActualDebtFromComposite(dec(50, 18), contracts)
    const withdrawal_B = await th.getActualDebtFromComposite('90500000000000000000', contracts)
    const withdrawal_C = await th.getActualDebtFromComposite(dec(100, 18), contracts)

    await borrowerOperations.openLoan(withdrawal_A, alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(withdrawal_B, bob, { from: bob, value: dec(1, 'ether') })  // 90.5 CLV, 1 ETH
    await borrowerOperations.openLoan(withdrawal_C, carol, { from: carol, value: dec(1, 'ether') })

    // Defaulter opens with 30 CLV, 0.3 ETH
    await borrowerOperations.openLoan(dec(30, 18), defaulter_1, { from: defaulter_1, value: dec(300, 'finney') })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
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
    assert.isTrue(carol_ICR_Before.lte(mv._MCR))

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
    assert.isTrue(bob_ICR_After.lte(mv._MCR))
    assert.isTrue(carol_ICR_After.lte(mv._MCR))

    /* Though Bob's true ICR (including pending rewards) is below the MCR, 
    check that Bob's raw coll and debt has not changed, and that his "raw" ICR is above the MCR */
    const bob_Coll = (await cdpManager.CDPs(bob))[1]
    const bob_Debt = (await cdpManager.CDPs(bob))[0]

    const bob_rawICR = bob_Coll.mul(toBN(dec(100, 18))).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    // Whale enters system, pulling it into Normal Mode
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(10, 'ether') })
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

  it("liquidate(): when SP > 0, triggers LQTY reward event - increases the sum G", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open loans 
    await borrowerOperations.openLoan(dec(50, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), B, { from: B, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(150, 18), C, { from: C, value: dec(3, 'ether') })

    await borrowerOperations.openLoan(dec(50, 18), defaulter_1, { from: defaulter_1, value: dec(5, 17) })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })
    assert.equal(await stabilityPool.getTotalCLVDeposits(), dec(100, 18))

    const G_Before = await stabilityPool.epochToScaleToG(0, 0)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100CLV, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate trove
    await cdpManager.liquidate(defaulter_1)
    assert.isFalse(await sortedCDPs.contains(defaulter_1))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has increased from the LQTY reward event triggered
    assert.isTrue(G_After.gt(G_Before))
  })

  it("liquidate(): when SP is empty, doesn't update G", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open loans 
    await borrowerOperations.openLoan(dec(50, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), B, { from: B, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(150, 18), C, { from: C, value: dec(3, 'ether') })

    await borrowerOperations.openLoan(dec(50, 18), defaulter_1, { from: defaulter_1, value: dec(5, 17) })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // B withdraws
    await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })

    // Check SP is empty
    assert.equal((await stabilityPool.getTotalCLVDeposits()), '0')

    // Check G is non-zero
    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    assert.isTrue(G_Before.gt(toBN('0')))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100CLV, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // liquidate trove
    await cdpManager.liquidate(defaulter_1)
    assert.isFalse(await sortedCDPs.contains(defaulter_1))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has not changed
    assert.isTrue(G_After.eq(G_Before))
  })

  // --- liquidateCDPs() ---

  it('liquidateCDPs(): closes every CDP with ICR < MCR, when n > number of undercollateralized troves', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(dec(490, 18), whale, { from: whale, value: dec(100, 'ether') })

    // create 5 CDPs with varying ICRs
    await borrowerOperations.openLoan(dec(190, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(140, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(290, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), erin, { from: erin, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(170, 18), flyn, { from: flyn, value: dec(1, 'ether') })

    // G,H, I open high-ICR loans
    await borrowerOperations.openLoan(dec(90, 18), graham, { from: graham, value: dec(100, 'ether') })
    await borrowerOperations.openLoan(dec(190, 18), harriet, { from: harriet, value: dec(100, 'ether') })
    await borrowerOperations.openLoan(dec(290, 18), ida, { from: ida, value: dec(100, 'ether') })

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100CLV, reducing Bob and Carol's ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Confirm troves A-E are ICR < 110%
    assert.isTrue((await cdpManager.getCurrentICR(alice, price)).lte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(carol, price)).lte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(erin, price)).lte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(flyn, price)).lte(mv._MCR))

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

  it('liquidateCDPs(): liquidates  up to the requested number of undercollateralized troves', async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    // --- SETUP --- 
    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await borrowerOperations.openLoan('105000000000000000000', alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('104000000000000000000', bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('103000000000000000000', carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('102000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('101000000000000000000', erin, { from: erin, value: dec(1, 'ether') })

    // --- TEST --- 

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

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

  it('liquidateCDPs(): does nothing if all troves have ICR > 110%', async () => {

    const CLVwithdrawal_A = await th.getActualDebtFromComposite(dec(90, 18), contracts)
    const CLVwithdrawal_B = await th.getActualDebtFromComposite(dec(20, 18), contracts)
    const CLVwithdrawal_C = await th.getActualDebtFromComposite('37398509798897897897', contracts)
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(CLVwithdrawal_A, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(CLVwithdrawal_B, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(CLVwithdrawal_C, carol, { from: carol, value: dec(1, 'ether') })

    // Price drops, but all troves remain active at 111% ICR
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    assert.isTrue((await sortedCDPs.contains(whale)))
    assert.isTrue((await sortedCDPs.contains(alice)))
    assert.isTrue((await sortedCDPs.contains(bob)))
    assert.isTrue((await sortedCDPs.contains(carol)))

    const TCR_Before = (await cdpManager.getTCR()).toString()
    const listSize_Before = (await sortedCDPs.getSize()).toString()

    assert.isTrue((await cdpManager.getCurrentICR(whale, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(alice, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(bob, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(carol, price)).gte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Attempt liqudation sequence
    await cdpManager.liquidateCDPs(10)

    // Check all troves remain active
    assert.isTrue((await sortedCDPs.contains(whale)))
    assert.isTrue((await sortedCDPs.contains(alice)))
    assert.isTrue((await sortedCDPs.contains(bob)))
    assert.isTrue((await sortedCDPs.contains(carol)))

    const TCR_After = (await cdpManager.getTCR()).toString()
    const listSize_After = (await sortedCDPs.getSize()).toString()

    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
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

    Alice ICR: (1.0995 * 100 / 60) = 183.25%
    Bob ICR:(1.0995 * 100 / 100.5) =  109.40%
    Carol ICR: (1.0995 * 100 / 110 ) 99.95%

    Check Alice is above MCR, Bob below, Carol below. */
    assert.isTrue(alice_ICR_After.gte(mv._MCR))
    assert.isTrue(bob_ICR_After.lte(mv._MCR))
    assert.isTrue(carol_ICR_After.lte(mv._MCR))

    /* Though Bob's true ICR (including pending rewards) is below the MCR, check that Bob's raw coll and debt has not changed */
    const bob_Coll = (await cdpManager.CDPs(bob))[1]
    const bob_Debt = (await cdpManager.CDPs(bob))[0]

    const bob_rawICR = bob_Coll.mul(toBN(dec(100, 18))).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    // Whale enters system, pulling it into Normal Mode
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(10, 'ether') })

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
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const TCR_Before = (await cdpManager.getTCR()).toString()

    // Confirm A, B, C ICRs are below 110%
    const alice_ICR = await cdpManager.getCurrentICR(alice, price)
    const bob_ICR = await cdpManager.getCurrentICR(bob, price)
    const carol_ICR = await cdpManager.getCurrentICR(carol, price)
    assert.isTrue(alice_ICR.lte(mv._MCR))
    assert.isTrue(bob_ICR.lte(mv._MCR))
    assert.isTrue(carol_ICR.lte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Liquidation with n = 0
    await cdpManager.liquidateCDPs(0)

    // Check all troves are still in the system
    assert.isTrue(await sortedCDPs.contains(whale))
    assert.isTrue(await sortedCDPs.contains(alice))
    assert.isTrue(await sortedCDPs.contains(bob))
    assert.isTrue(await sortedCDPs.contains(carol))

    const TCR_After = (await cdpManager.getTCR()).toString()

    // Check TCR has not changed after liquidation
    assert.equal(TCR_Before, TCR_After)
  })

  it("liquidateCDPs():  liquidates troves with ICR < MCR", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(10, 'ether') })

    // A, B, C open loans that will remain active when price drops to 100

    const A_CLVWithdrawal = await th.getActualDebtFromComposite('88000000000000000000', contracts)
    const B_CLVWithdrawal = await th.getActualDebtFromComposite('89000000000000000000', contracts)
    const C_CLVWithdrawal = await th.getActualDebtFromComposite('90000000000000000000', contracts)

    await borrowerOperations.openLoan(A_CLVWithdrawal, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(B_CLVWithdrawal, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(C_CLVWithdrawal, carol, { from: carol, value: dec(1, 'ether') })

    const D_CLVWithdrawal = await th.getActualDebtFromComposite('91000000000000000000', contracts)
    const E_CLVWithdrawal = await th.getActualDebtFromComposite('92000000000000000000', contracts)
    const F_CLVWithdrawal = await th.getActualDebtFromComposite('93000000000000000000', contracts)

    // D, E, F open loans that will fall below MCR when price drops to 100
    await borrowerOperations.openLoan('91000000000000000000', dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('92000000000000000000', erin, { from: erin, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('93000000000000000000', flyn, { from: flyn, value: dec(1, 'ether') })

    // Check list size is 7
    assert.equal((await sortedCDPs.getSize()).toString(), '7')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
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
    assert.isTrue(dennis_ICR.lte(mv._MCR))
    assert.isTrue(erin_ICR.lte(mv._MCR))
    assert.isTrue(flyn_ICR.lte(mv._MCR))

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
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(10, 'ether') })

    const A_CLVWithdrawal = await th.getActualDebtFromComposite(dec(100, 18), contracts)
    const B_CLVWithdrawal = await th.getActualDebtFromComposite(dec(150, 18), contracts)
    const C_CLVWithdrawal = await th.getActualDebtFromComposite(dec(180, 18), contracts)

    // D, E, F open loans that will fall below MCR when price drops to 100
    await borrowerOperations.openLoan(A_CLVWithdrawal, dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(B_CLVWithdrawal, erin, { from: erin, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(C_CLVWithdrawal, flyn, { from: flyn, value: dec(1, 'ether') })

    // Check list size is 4
    assert.equal((await sortedCDPs.getSize()).toString(), '4')

    // Check token balances before
    assert.equal((await clvToken.balanceOf(dennis)).toString(), A_CLVWithdrawal)
    assert.equal((await clvToken.balanceOf(erin)).toString(), B_CLVWithdrawal)
    assert.equal((await clvToken.balanceOf(flyn)).toString(), C_CLVWithdrawal)

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
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
    assert.equal((await clvToken.balanceOf(dennis)).toString(), A_CLVWithdrawal)
    assert.equal((await clvToken.balanceOf(erin)).toString(), B_CLVWithdrawal)
    assert.equal((await clvToken.balanceOf(flyn)).toString(), C_CLVWithdrawal)
  })

  it("liquidateCDPs(): A liquidation sequence containing Pool offsets increases the TCR", async () => {
    // Whale provides 500 CLV to SP
    await borrowerOperations.openLoan(dec(2000, 18), whale, { from: whale, value: dec(100, 'ether') })
    await stabilityPool.provideToSP(dec(500, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(7, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(20, 'ether') })

    await borrowerOperations.openLoan('101000000000000000000', defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('257000000000000000000', defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
    await borrowerOperations.openLoan('328000000000000000000', defaulter_3, { from: defaulter_3, value: dec(3, 'ether') })
    await borrowerOperations.openLoan('480000000000000000000', defaulter_4, { from: defaulter_4, value: dec(4, 'ether') })

    assert.isTrue((await sortedCDPs.contains(defaulter_1)))
    assert.isTrue((await sortedCDPs.contains(defaulter_2)))
    assert.isTrue((await sortedCDPs.contains(defaulter_3)))
    assert.isTrue((await sortedCDPs.contains(defaulter_4)))

    assert.equal((await sortedCDPs.getSize()).toString(), '9')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    const TCR_Before = await cdpManager.getTCR()

    // Check pool has 500 CLV
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), dec(500, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Liquidate troves
    await cdpManager.liquidateCDPs(10)

    // Check pool has been emptied by the liquidations
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), '0')

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedCDPs.contains(defaulter_1)))
    assert.isFalse((await sortedCDPs.contains(defaulter_2)))
    assert.isFalse((await sortedCDPs.contains(defaulter_3)))
    assert.isFalse((await sortedCDPs.contains(defaulter_4)))

    // check system sized reduced to 5 troves
    assert.equal((await sortedCDPs.getSize()).toString(), '5')

    // Check that the liquidation sequence has improved the TCR
    const TCR_After = await cdpManager.getTCR()
    assert.isTrue(TCR_After.gte(TCR_Before))
  })

  it("liquidateCDPs(): A liquidation sequence of pure redistributions decreases the TCR, due to gas compensation, but up to 0.5%", async () => {
    await borrowerOperations.openLoan(dec(2000, 18), whale, { from: whale, value: dec(100, 'ether') })
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(7, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(20, 'ether') })

    await borrowerOperations.openLoan('91000000000000000000', defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('247000000000000000000', defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
    await borrowerOperations.openLoan('318000000000000000000', defaulter_3, { from: defaulter_3, value: dec(3, 'ether') })
    await borrowerOperations.openLoan('470000000000000000000', defaulter_4, { from: defaulter_4, value: dec(4, 'ether') })

    assert.isTrue((await sortedCDPs.contains(defaulter_1)))
    assert.isTrue((await sortedCDPs.contains(defaulter_2)))
    assert.isTrue((await sortedCDPs.contains(defaulter_3)))
    assert.isTrue((await sortedCDPs.contains(defaulter_4)))

    assert.equal((await sortedCDPs.getSize()).toString(), '9')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    const TCR_Before = await cdpManager.getTCR()
    // (100+1+7+2+20+1+2+3+4)*100/(2010+10+10+10+10+101+257+328+480)
    assert.isAtMost(th.getDifference(TCR_Before, '4353233830845771200'), 1000)

    // Check pool is empty before liquidation
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), '0')

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

    // Check that the liquidation sequence has reduced the TCR
    const TCR_After = await cdpManager.getTCR()
    // ((100+1+7+2+20)+(1+2+3+4)*0.995)*100/(2010+10+10+10+10+101+257+328+480)
    assert.isAtMost(th.getDifference(TCR_After, '4351679104477611300'), 1000)
    assert.isTrue(TCR_Before.gte(TCR_After))
    assert.isTrue(TCR_After.gte(TCR_Before.mul(toBN(995)).div(toBN(1000))))
  })

  it("liquidateCDPs(): Liquidating troves with SP deposits correctly impacts their SP deposit and ETH gain", async () => {
    // Whale provides 400 CLV to the SP
    await borrowerOperations.openLoan(dec(400, 18), whale, { from: whale, value: dec(100, 'ether') })
    await stabilityPool.provideToSP(dec(400, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(300, 18), bob, { from: bob, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // A, B provide 100, 300 to the SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: alice })
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: bob })

    assert.equal((await sortedCDPs.getSize()).toString(), '4')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Check 800 CLV in Pool
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), dec(800, 18))

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

    Total liquidated debt = 110 + 310 + 110 = 530 CLV
    Total liquidated ETH = 1.1 + 3.1 + 1.1 = 5.3 ETH

    Whale CLV Loss: 530 * (400/800) = 265 CLV
    Alice CLV Loss:  530 *(100/800) = 66.25 CLV
    Bob CLV Loss: 530 * (300/800) = 198.75 CLV

    Whale remaining deposit: (400 - 265) = 135 CLV
    Alice remaining deposit: (100 - 66.25) = 33.75 CLV
    Bob remaining deposit: (300 - 198.75) = 101.25 CLV

    Whale ETH Gain: 5*0.995 * (400/800) = 2.4875 ETH
    Alice ETH Gain: 5*0.995 *(100/800) = 0.621875 ETH
    Bob ETH Gain: 5*0.995 * (300/800) = 1.865625 ETH

    Total remaining deposits: 270 CLV
    Total ETH gain: 4.975 ETH */

    // Check remaining CLV Deposits and ETH gain, for whale and depositors whose troves were liquidated
    const whale_Deposit_After = (await stabilityPool.getCompoundedCLVDeposit(whale)).toString()
    const alice_Deposit_After = (await stabilityPool.getCompoundedCLVDeposit(alice)).toString()
    const bob_Deposit_After = (await stabilityPool.getCompoundedCLVDeposit(bob)).toString()

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
    const total_CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    const total_ETHinSP = (await stabilityPool.getETH()).toString()

    assert.isAtMost(th.getDifference(total_CLVinSP, dec(270, 18)), 1000)
    assert.isAtMost(th.getDifference(total_ETHinSP, dec(4975, 15)), 1000)
  })

  it("liquidateCDPs(): when SP > 0, triggers LQTY reward event - increases the sum G", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open loans 
    await borrowerOperations.openLoan(dec(50, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), B, { from: B, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(150, 18), C, { from: C, value: dec(3, 'ether') })

    await borrowerOperations.openLoan(dec(50, 18), defaulter_1, { from: defaulter_1, value: dec(5, 17) })
    await borrowerOperations.openLoan(dec(25, 18), defaulter_2, { from: defaulter_2, value: dec(25, 16) })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })
    assert.equal(await stabilityPool.getTotalCLVDeposits(), dec(100, 18))

    const G_Before = await stabilityPool.epochToScaleToG(0, 0)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100CLV, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    await cdpManager.liquidateCDPs(2)
    assert.isFalse(await sortedCDPs.contains(defaulter_1))
    assert.isFalse(await sortedCDPs.contains(defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has increased from the LQTY reward event triggered
    assert.isTrue(G_After.gt(G_Before))
  })

  it("liquidateCDPs(): when SP is empty, doesn't update G", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open loans 
    await borrowerOperations.openLoan(dec(50, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), B, { from: B, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(150, 18), C, { from: C, value: dec(3, 'ether') })

    await borrowerOperations.openLoan(dec(50, 18), defaulter_1, { from: defaulter_1, value: dec(5, 17) })
    await borrowerOperations.openLoan(dec(25, 18), defaulter_2, { from: defaulter_2, value: dec(25, 16) })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // B withdraws
    await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })

    // Check SP is empty
    assert.equal((await stabilityPool.getTotalCLVDeposits()), '0')

    // Check G is non-zero
    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    assert.isTrue(G_Before.gt(toBN('0')))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100CLV, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // liquidate troves
    await cdpManager.liquidateCDPs(2)
    assert.isFalse(await sortedCDPs.contains(defaulter_1))
    assert.isFalse(await sortedCDPs.contains(defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has not changed
    assert.isTrue(G_After.eq(G_Before))
  })


  // --- batchLiquidateTroves() ---

  it('batchLiquidateTroves(): closes every trove with ICR < MCR in the given array', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(dec(500, 18), whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(200, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(150, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(5, 18), dennis, { from: dennis, value: dec(5, 'ether') })
    await borrowerOperations.openLoan(dec(10, 18), erin, { from: erin, value: dec(5, 'ether') })

    // Check full sorted list size is 6
    assert.equal((await sortedCDPs.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100CLV, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Confirm troves A-C are ICR < 110%
    assert.isTrue((await cdpManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(carol, price)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await cdpManager.getCurrentICR(dennis, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(erin, price)).gte(mv._MCR))

    // Confirm Whale is ICR >= 110% 
    assert.isTrue((await cdpManager.getCurrentICR(whale, price)).gte(mv._MCR))

    liquidationArray = [alice, bob, carol, dennis, erin]
    await cdpManager.batchLiquidateTroves(liquidationArray);

    // Confirm troves A-C have been removed from the system
    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))
    assert.isFalse(await sortedCDPs.contains(carol))

    // Check all troves A-C are now closed
    assert.equal((await cdpManager.CDPs(alice))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(bob))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(carol))[3].toString(), '2')

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedCDPs.getSize()).toString(), '3')
  })

  it('batchLiquidateTroves(): does not liquidate troves that are not in the given array', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(dec(500, 18), whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(200, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(150, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(500, 18), dennis, { from: dennis, value: dec(5, 'ether') })
    await borrowerOperations.openLoan(dec(500, 18), erin, { from: erin, value: dec(5, 'ether') })

    // Check full sorted list size is 6
    assert.equal((await sortedCDPs.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100CLV, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Confirm troves A-E are ICR < 110%
    assert.isTrue((await cdpManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(carol, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(dennis, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(erin, price)).lt(mv._MCR))

    liquidationArray = [alice, bob]  // C-E not included
    await cdpManager.batchLiquidateTroves(liquidationArray);

    // Confirm troves A-B have been removed from the system
    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))

    // Check all troves A-B are now closed
    assert.equal((await cdpManager.CDPs(alice))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(bob))[3].toString(), '2')

    // Confirm troves C-E remain in the system
    assert.isTrue(await sortedCDPs.contains(carol))
    assert.isTrue(await sortedCDPs.contains(dennis))
    assert.isTrue(await sortedCDPs.contains(erin))

    // Check all troves C-E are still active
    assert.equal((await cdpManager.CDPs(carol))[3].toString(), '1')
    assert.equal((await cdpManager.CDPs(dennis))[3].toString(), '1')
    assert.equal((await cdpManager.CDPs(erin))[3].toString(), '1')

    // Check sorted list has been reduced to length 4
    assert.equal((await sortedCDPs.getSize()).toString(), '4')
  })

  it('batchLiquidateTroves(): does not close troves with ICR >= MCR in the given array', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(dec(500, 18), whale, { from: whale, value: dec(100, 'ether') })


    await borrowerOperations.openLoan(dec(200, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(150, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(5, 18), dennis, { from: dennis, value: dec(5, 'ether') })
    await borrowerOperations.openLoan(dec(10, 18), erin, { from: erin, value: dec(5, 'ether') })

    // Check full sorted list size is 6
    assert.equal((await sortedCDPs.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100CLV, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Confirm troves A-C are ICR < 110%
    assert.isTrue((await cdpManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(carol, price)).lt(mv._MCR))

    // Confirm D-E are ICR >= 110%
    assert.isTrue((await cdpManager.getCurrentICR(dennis, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(erin, price)).gte(mv._MCR))

    // Confirm Whale is ICR > 110% 
    assert.isTrue((await cdpManager.getCurrentICR(whale, price)).gte(mv._MCR))

    liquidationArray = [alice, bob, carol, dennis, erin]
    await cdpManager.batchLiquidateTroves(liquidationArray);

    // Confirm troves D-E and whale remain in the system
    assert.isTrue(await sortedCDPs.contains(dennis))
    assert.isTrue(await sortedCDPs.contains(erin))
    assert.isTrue(await sortedCDPs.contains(whale))

    // Check all troves D-E and whale remain active
    assert.equal((await cdpManager.CDPs(dennis))[3].toString(), '1')
    assert.equal((await cdpManager.CDPs(erin))[3].toString(), '1')
    assert.isTrue(await sortedCDPs.contains(whale))

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedCDPs.getSize()).toString(), '3')
  })

  it('batchLiquidateTroves(): reverts if array is empty', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(dec(500, 18), whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(200, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(150, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(5, 18), dennis, { from: dennis, value: dec(5, 'ether') })
    await borrowerOperations.openLoan(dec(10, 18), erin, { from: erin, value: dec(5, 'ether') })

    // Check full sorted list size is 6
    assert.equal((await sortedCDPs.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100CLV, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    liquidationArray = []
    try {
      const tx = await cdpManager.batchLiquidateTroves(liquidationArray);
      assert.isFalse(tx.receipt.status)
    } catch (error) {
      assert.include(error.message, "CDPManager: Calldata address array must not be empty")
    }
  })

  it("batchLiquidateTroves(): skips if trove is non-existent", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(dec(500, 18), whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(190, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(140, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(5, 18), dennis, { from: dennis, value: dec(5, 'ether') })
    await borrowerOperations.openLoan(dec(10, 18), erin, { from: erin, value: dec(5, 'ether') })

    assert.equal(await cdpManager.getCDPStatus(carol), 0) // check trove non-existent

    // Check full sorted list size is 6
    assert.equal((await sortedCDPs.getSize()).toString(), '5')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(500, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100CLV, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Confirm troves A-B are ICR < 110%
    assert.isTrue((await cdpManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await cdpManager.getCurrentICR(dennis, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(erin, price)).gte(mv._MCR))

    // Confirm Whale is ICR >= 110% 
    assert.isTrue((await cdpManager.getCurrentICR(whale, price)).gte(mv._MCR))

    // Liquidate - trove C in between the ones to be liquidated!
    const liquidationArray = [alice, carol, bob, dennis, erin]
    await cdpManager.batchLiquidateTroves(liquidationArray);

    // Confirm troves A-B have been removed from the system
    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))

    // Check all troves A-B are now closed
    assert.equal((await cdpManager.CDPs(alice))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(bob))[3].toString(), '2')

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedCDPs.getSize()).toString(), '3')

    // Confirm trove C non-existent
    assert.isFalse(await sortedCDPs.contains(carol))
    assert.equal((await cdpManager.CDPs(carol))[3].toString(), '0')

    // Check Stability pool has only been reduced by A-B
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), dec(150, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());
  })

  it("batchLiquidateTroves(): skips if a trove has been closed", async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan(dec(500, 18), whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(190, 18), alice, { from: alice, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(140, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(90, 18), carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(5, 18), dennis, { from: dennis, value: dec(5, 'ether') })
    await borrowerOperations.openLoan(dec(10, 18), erin, { from: erin, value: dec(5, 'ether') })

    assert.isTrue(await sortedCDPs.contains(carol))

    // Check full sorted list size is 6
    assert.equal((await sortedCDPs.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(500, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100CLV, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Carol liquidated, and her trove is closed
    const txCarolClose = await borrowerOperations.closeLoan({ from: carol })
    assert.isTrue(txCarolClose.receipt.status)

    assert.isFalse(await sortedCDPs.contains(carol))

    assert.equal(await cdpManager.getCDPStatus(carol), 2)  // check trove closed

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());

    // Confirm troves A-B are ICR < 110%
    assert.isTrue((await cdpManager.getCurrentICR(alice, price)).lt(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(bob, price)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await cdpManager.getCurrentICR(dennis, price)).gte(mv._MCR))
    assert.isTrue((await cdpManager.getCurrentICR(erin, price)).gte(mv._MCR))

    // Confirm Whale is ICR >= 110% 
    assert.isTrue((await cdpManager.getCurrentICR(whale, price)).gte(mv._MCR))

    // Liquidate - trove C in between the ones to be liquidated!
    const liquidationArray = [alice, carol, bob, dennis, erin]
    await cdpManager.batchLiquidateTroves(liquidationArray);

    // Confirm troves A-B have been removed from the system
    assert.isFalse(await sortedCDPs.contains(alice))
    assert.isFalse(await sortedCDPs.contains(bob))

    // Check all troves A-C are now closed
    assert.equal((await cdpManager.CDPs(alice))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(bob))[3].toString(), '2')
    assert.equal((await cdpManager.CDPs(carol))[3].toString(), '2')

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedCDPs.getSize()).toString(), '3')

    // Check Stability pool has only been reduced by A-B
    assert.equal((await stabilityPool.getTotalCLVDeposits()).toString(), dec(150, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode());
  })

  it("batchLiquidateTroves: when SP > 0, triggers LQTY reward event - increases the sum G", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open loans 
    await borrowerOperations.openLoan(dec(50, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), B, { from: B, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(150, 18), C, { from: C, value: dec(3, 'ether') })

    await borrowerOperations.openLoan(dec(50, 18), defaulter_1, { from: defaulter_1, value: dec(5, 17) })
    await borrowerOperations.openLoan(dec(25, 18), defaulter_2, { from: defaulter_2, value: dec(25, 16) })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })
    assert.equal(await stabilityPool.getTotalCLVDeposits(), dec(100, 18))

    const G_Before = await stabilityPool.epochToScaleToG(0, 0)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100CLV, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    await cdpManager.batchLiquidateTroves([defaulter_1, defaulter_2])
    assert.isFalse(await sortedCDPs.contains(defaulter_1))
    assert.isFalse(await sortedCDPs.contains(defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has increased from the LQTY reward event triggered
    assert.isTrue(G_After.gt(G_Before))
  })

  it("batchLiquidateTroves(): when SP is empty, doesn't update G", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    // A, B, C open loans 
    await borrowerOperations.openLoan(dec(50, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), B, { from: B, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(150, 18), C, { from: C, value: dec(3, 'ether') })

    await borrowerOperations.openLoan(dec(50, 18), defaulter_1, { from: defaulter_1, value: dec(5, 17) })
    await borrowerOperations.openLoan(dec(25, 18), defaulter_2, { from: defaulter_2, value: dec(25, 16) })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // B withdraws
    await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })

    // Check SP is empty
    assert.equal((await stabilityPool.getTotalCLVDeposits()), '0')

    // Check G is non-zero
    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    assert.isTrue(G_Before.gt(toBN('0')))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100CLV, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // liquidate troves
    await cdpManager.batchLiquidateTroves([defaulter_1, defaulter_2])
    assert.isFalse(await sortedCDPs.contains(defaulter_1))
    assert.isFalse(await sortedCDPs.contains(defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has not changed
    assert.isTrue(G_After.eq(G_Before))
  })

  // --- redemptions ---


  it('getRedemptionHints(): gets the address of the first CDP and the final ICR of the last CDP involved in a redemption', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan('10' + _18_zeros, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('20' + _18_zeros, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('30' + _18_zeros, carol, { from: carol, value: dec(1, 'ether') })
    // Dennis' CDP should be untouched by redemption, because its ICR will be < 110% after the price drop
    await borrowerOperations.openLoan('170' + _18_zeros, dennis, { from: dennis, value: dec(1, 'ether') })

    // Drop the price
    const price = '100' + _18_zeros
    await priceFeed.setPrice(price);

    // --- TEST ---
    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints('55' + _18_zeros, price)

    assert.equal(firstRedemptionHint, carol)
    // Alice trove’s ends up with 0.95 ETH and 5+10 CLV debt (10 for gas compensation)
    assert.equal(partialRedemptionHintICR, '6333333333333333333')
  });

  it('redeemCollateral(): cancels the provided CLV with debt from CDPs with the lowest ICRs and sends an equivalent amount of Ether', async () => {
    // --- SETUP ---

    await borrowerOperations.openLoan(dec(5, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(8, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(10, 18), carol, { from: carol, value: dec(1, 'ether') })
    // start Dennis with a high ICR
    await borrowerOperations.openLoan(dec(150, 18), dennis, { from: dennis, value: dec(100, 'ether') })

    const dennis_ETHBalance_Before = toBN(await web3.eth.getBalance(dennis))

    const dennis_CLVBalance_Before = await clvToken.balanceOf(dennis)
    assert.equal(dennis_CLVBalance_Before, dec(150, 18))

    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    // --- TEST --- 

    // Find hints for redeeming 20 CLV
    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(dec(20, 18), price)

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
    const redemptionTx = await cdpManager.redeemCollateral(
      dec(20, 18),
      firstRedemptionHint,
      partialRedemptionHint,
      partialRedemptionHintICR,
      0,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const ETHFee = th.getEmittedRedemptionValues(redemptionTx)[3]

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const bob_CDP_After = await cdpManager.CDPs(bob)
    const carol_CDP_After = await cdpManager.CDPs(carol)

    const alice_debt_After = alice_CDP_After[0].toString()
    const bob_debt_After = bob_CDP_After[0].toString()
    const carol_debt_After = carol_CDP_After[0].toString()

    /* check that Dennis' redeemed 20 CLV has been cancelled with debt from Bobs's CDP (8) and Carol's CDP (10).
    The remaining lot (2) is sent to Alice's CDP, who had the best ICR.
    It leaves her with (3) CLV debt + 10 for gas compensation. */
    assert.equal(alice_debt_After, dec(13, 18))
    assert.equal(bob_debt_After, '0')
    assert.equal(carol_debt_After, '0')

    const dennis_ETHBalance_After = toBN(await web3.eth.getBalance(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)

    const expectedTotalETHDrawn = toBN(dec(20, 18)).div(toBN(200)) // convert 20 CLV to ETH, at ETH:USD price 200
    const expectedReceivedETH = expectedTotalETHDrawn.sub(toBN(ETHFee))

    assert.isTrue(expectedReceivedETH.eq(receivedETH))

    const dennis_CLVBalance_After = (await clvToken.balanceOf(dennis)).toString()
    assert.equal(dennis_CLVBalance_After, dec(130, 18))
  })

  it('redeemCollateral(): ends the redemption sequence when the token redemption request has been filled', async () => {
    // --- SETUP --- 
    const price = await priceFeed.getPrice()
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await borrowerOperations.openLoan(dec(20, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(20, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(20, 18), carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(10, 18), dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(10, 18), erin, { from: erin, value: dec(1, 'ether') })

    // --- TEST --- 

    // open loan from redeemer.  Redeemer has highest ICR (100ETH, 100 CLV), 20000%
    await borrowerOperations.openLoan(dec(100, 18), flyn, { from: flyn, value: dec(100, 'ether') })

    // Flyn redeems collateral
    await cdpManager.redeemCollateral(dec(60, 18), alice, alice, 0, 0, { from: flyn })

    // Check Flyn's redemption has reduced his balance from 100 to (100-60) = 40 CLV
    const flynBalance = (await clvToken.balanceOf(flyn)).toString()
    assert.equal(flynBalance, dec(40, 18))

    // Check debt of Alice, Bob, Carol
    const alice_Debt = await cdpManager.getCDPDebt(alice)
    const bob_Debt = await cdpManager.getCDPDebt(bob)
    const carol_Debt = await cdpManager.getCDPDebt(carol)

    assert.equal(alice_Debt, 0)
    assert.equal(bob_Debt, 0)
    assert.equal(carol_Debt, 0)

    // check Alice, Bob and Carol troves are closed
    const alice_Status = await cdpManager.getCDPStatus(alice)
    const bob_Status = await cdpManager.getCDPStatus(bob)
    const carol_Status = await cdpManager.getCDPStatus(carol)
    assert.equal(alice_Status, 2)
    assert.equal(bob_Status, 2)
    assert.equal(carol_Status, 2)

    // check debt and coll of Dennis, Erin has not been impacted by redemption
    const dennis_Debt = await cdpManager.getCDPDebt(dennis)
    const erin_Debt = await cdpManager.getCDPDebt(erin)

    assert.equal(dennis_Debt, dec(20, 18))
    assert.equal(erin_Debt, dec(20, 18))

    const dennis_Coll = await cdpManager.getCDPColl(dennis)
    const erin_Coll = await cdpManager.getCDPColl(erin)

    assert.equal(dennis_Coll, dec(1, 'ether'))
    assert.equal(erin_Coll, dec(1, 'ether'))
  })

  it('redeemCollateral(): ends the redemption sequence when max iterations have been reached', async () => {
    // --- SETUP --- 
    const price = await priceFeed.getPrice()
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await borrowerOperations.openLoan(dec(20, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(20, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(20, 18), carol, { from: carol, value: dec(1, 'ether') })

    // --- TEST --- 

    // open loan from redeemer.  Redeemer has highest ICR (100ETH, 100 CLV), 20000%
    await borrowerOperations.openLoan(dec(100, 18), flyn, { from: flyn, value: dec(100, 'ether') })

    // Flyn redeems collateral
    await cdpManager.redeemCollateral(dec(60, 18), alice, alice, 0, 2, { from: flyn })

    // Check Flyn's redemption has reduced his balance from 100 to (100-40) = 60 CLV
    const flynBalance = (await clvToken.balanceOf(flyn)).toString()
    assert.equal(flynBalance, dec(60, 18))

    // Check debt of Alice, Bob, Carol
    const alice_Debt = await cdpManager.getCDPDebt(alice)
    const bob_Debt = await cdpManager.getCDPDebt(bob)
    const carol_Debt = await cdpManager.getCDPDebt(carol)

    assert.equal(alice_Debt, 0)
    assert.equal(bob_Debt, 0)
    assert.equal(carol_Debt.toString(), dec(30, 18)) // 20 withdrawn + 10 for gas compensation

    // check Alice and Bob troves are closed, but Carol is not
    const alice_Status = await cdpManager.getCDPStatus(alice)
    const bob_Status = await cdpManager.getCDPStatus(bob)
    const carol_Status = await cdpManager.getCDPStatus(carol)
    assert.equal(alice_Status, 2)
    assert.equal(bob_Status, 2)
    assert.equal(carol_Status, 1)
  })

  it('redeemCollateral(): doesnt perform the final partial redemption in the sequence if the hint is out-of-date', async () => {
    // --- SETUP ---

    await borrowerOperations.openLoan(dec(5, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(8, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(10, 18), carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(150, 18), dennis, { from: dennis, value: dec(100, 'ether') })

    const dennis_ETHBalance_Before = toBN(await web3.eth.getBalance(dennis))

    const dennis_CLVBalance_Before = await clvToken.balanceOf(dennis)
    assert.equal(dennis_CLVBalance_Before, dec(150, 18))

    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    // --- TEST --- 

    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(dec(20, 18), price)

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
      } = await hintHelpers.getRedemptionHints(dec(1, 18), price)

      const { 0: partialRedemptionHint } = await sortedCDPs.findInsertPosition(
        partialRedemptionHintICR,
        price,
        dennis,
        dennis
      )

      // Alice redeems 1 CLV from Carol's CDP
      await cdpManager.redeemCollateral(
        dec(1, 18),
        firstRedemptionHint,
        partialRedemptionHint,
        partialRedemptionHintICR,
        0,
        { from: alice }
      )
    }

    // Dennis tries to redeem 20 CLV
    const redemptionTx = await cdpManager.redeemCollateral(
      dec(20, 18),
      firstRedemptionHint,
      partialRedemptionHint,
      partialRedemptionHintICR,
      0,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const ETHFee = th.getEmittedRedemptionValues(redemptionTx)[3]

    // Since Alice already redeemed 1 CLV from Carol's CDP, Dennis was  able to redeem:
    //  - 9 CLV from Carol's
    //  - 8 CLV from Bob's
    // for a total of 17 CLV.

    // Dennis calculated his hint for redeeming 2 CLV from Alice's CDP, but after Alice's transaction
    // got in the way, he would have needed to redeem 3 CLV to fully complete his redemption of 20 CLV.
    // This would have required a different hint, therefore he ended up with a partial redemption.

    const dennis_ETHBalance_After = toBN(await web3.eth.getBalance(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)

    // Expect only 17 worth of ETH drawn
    const expectedTotalETHDrawn = toBN(dec(17, 18)).div(toBN(200)) // 20 CLV converted to ETH, at ETH:USD price 200
    const expectedReceivedETH = expectedTotalETHDrawn.sub(ETHFee)

    assert.isTrue(expectedReceivedETH.eq(receivedETH))

    const dennis_CLVBalance_After = (await clvToken.balanceOf(dennis)).toString()
    assert.equal(dennis_CLVBalance_After, dec(133, 18))
  })

  it("redeemCollateral(): can redeem if there is zero active debt but non-zero debt in DefaultPool", async () => {
    // --- SETUP ---

    await borrowerOperations.openLoan('0', alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })

    await clvToken.transfer(carol, dec(100, 18), { from: bob })

    const price = dec(100, 18)
    await priceFeed.setPrice(price)

    // Liquidate Bob's CDP
    await cdpManager.liquidateCDPs(1)

    // --- TEST --- 

    const carol_ETHBalance_Before = toBN(await web3.eth.getBalance(carol))

    const redemptionTx = await cdpManager.redeemCollateral(
      dec(100, 18),
      alice,
      '0x0000000000000000000000000000000000000000',
      dec(49975, 15), // (10 + 0.995 - 1)*100 / 20
      0,
      {
        from: carol,
        gasPrice: 0
      }
    )

    const ETHFee = th.getEmittedRedemptionValues(redemptionTx)[3]

    const carol_ETHBalance_After = toBN(await web3.eth.getBalance(carol))

    const expectedTotalETHDrawn = toBN(dec(100, 18)).div(toBN(100)) // convert 100 CLV to ETH at ETH:USD price of 100
    const expectedReceivedETH = expectedTotalETHDrawn.sub(ETHFee)

    const receivedETH = carol_ETHBalance_After.sub(carol_ETHBalance_Before)
    assert.isTrue(expectedReceivedETH.eq(receivedETH))

    const carol_CLVBalance_After = (await clvToken.balanceOf(carol)).toString()
    assert.equal(carol_CLVBalance_After, '0')
  })

  it("redeemCollateral(): doesn't touch CDPs with ICR < 110%", async () => {
    // --- SETUP ---

    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })

    await clvToken.transfer(carol, dec(100, 18), { from: bob })

    // Put Bob's CDP below 110% ICR
    const price = dec(100, 18)
    await priceFeed.setPrice(price)

    // --- TEST --- 

    await cdpManager.redeemCollateral(
      dec(100, 18),
      bob,
      '0x0000000000000000000000000000000000000000',
      0,
      0,
      { from: carol }
    );

    // Alice's CDP was cleared of debt
    const { debt: alice_Debt_After } = await cdpManager.CDPs(alice)
    assert.equal(alice_Debt_After, '0')

    // Bob's CDP was left untouched
    const { debt: bob_Debt_After } = await cdpManager.CDPs(bob)
    assert.equal(bob_Debt_After, dec(110, 18))
  });

  it("redeemCollateral(): finds the last CDP with ICR == 110% even if there is more than one", async () => {
    // --- SETUP ---

    await borrowerOperations.openLoan('90' + _18_zeros, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('90' + _18_zeros, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('90' + _18_zeros, carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openLoan('91' + _18_zeros, dennis, { from: dennis, value: dec(1, 'ether') })

    await clvToken.transfer(dennis, '90' + _18_zeros, { from: alice })
    await clvToken.transfer(dennis, '90' + _18_zeros, { from: bob })
    await clvToken.transfer(dennis, '90' + _18_zeros, { from: carol })

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
      '270' + _18_zeros,
      carol, // try to trick redeemCollateral by passing a hint that doesn't exactly point to the
      // last CDP with ICR == 110% (which would be Alice's)
      '0x0000000000000000000000000000000000000000',
      0,
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

  it("redeemCollateral(): reverts when argument _amount is 0", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    // Alice opens loan and transfers 500CLV to Erin, the would-be redeemer
    await borrowerOperations.openLoan(dec(500, 18), alice, { from: alice, value: dec(10, 'ether') })
    await clvToken.transfer(erin, dec(500, 18), { from: alice })

    // B, C and D open loans
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(200, 18), carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(300, 18), dennis, { from: dennis, value: dec(3, 'ether') })

    // Erin attempts to redeem with _amount = 0
    const redemptionTxPromise = cdpManager.redeemCollateral(0, erin, erin, 0, 0, { from: erin })
    await th.assertRevert(redemptionTxPromise, "CDPManager: Amount must be greater than zero")
  })

  it("redeemCollateral(): doesn't affect the Stability Pool deposits or ETH gain of redeemed-from troves", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    // Alice opens loan and transfers 400CLV to Erin, the would-be redeemer
    await borrowerOperations.openLoan(dec(500, 18), alice, { from: alice, value: dec(10, 'ether') })
    await clvToken.transfer(erin, dec(400, 18), { from: alice })

    // B, C, D, F open loan
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(200, 18), carol, { from: carol, value: dec(2, 'ether') })
    await borrowerOperations.openLoan(dec(300, 18), dennis, { from: dennis, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), flyn, { from: flyn, value: dec(1, 'ether') })

    // B, C, D deposit some of their tokens to the Stability Pool
    await stabilityPool.provideToSP(dec(50, 18), ZERO_ADDRESS, { from: bob })
    await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: carol })
    await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: dennis })

    let price = await priceFeed.getPrice()
    const bob_ICR_before = await cdpManager.getCurrentICR(bob, price)
    const carol_ICR_before = await cdpManager.getCurrentICR(carol, price)
    const dennis_ICR_before = await cdpManager.getCurrentICR(dennis, price)

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    assert.isTrue(await sortedCDPs.contains(flyn))

    // Liquidate Flyn
    await cdpManager.liquidate(flyn)
    assert.isFalse(await sortedCDPs.contains(flyn))

    // Price bounces back, bringing B, C, D back above MCR
    await priceFeed.setPrice(dec(200, 18))

    const bob_SPDeposit_before = (await stabilityPool.getCompoundedCLVDeposit(bob)).toString()
    const carol_SPDeposit_before = (await stabilityPool.getCompoundedCLVDeposit(carol)).toString()
    const dennis_SPDeposit_before = (await stabilityPool.getCompoundedCLVDeposit(dennis)).toString()

    const bob_ETHGain_before = (await stabilityPool.getDepositorETHGain(bob)).toString()
    const carol_ETHGain_before = (await stabilityPool.getDepositorETHGain(carol)).toString()
    const dennis_ETHGain_before = (await stabilityPool.getDepositorETHGain(dennis)).toString()

    // Check the remaining CLV and ETH in Stability Pool after liquidation is non-zero
    const CLVinSP = await stabilityPool.getTotalCLVDeposits()
    const ETHinSP = await stabilityPool.getETH()
    assert.isTrue(CLVinSP.gte(mv._zeroBN))
    assert.isTrue(ETHinSP.gte(mv._zeroBN))

    // Erin redeems 400 CLV
    await cdpManager.redeemCollateral(dec(400, 18), erin, erin, 0, 0, { from: erin })

    price = await priceFeed.getPrice()
    const bob_ICR_after = await cdpManager.getCurrentICR(bob, price)
    const carol_ICR_after = await cdpManager.getCurrentICR(carol, price)
    const dennis_ICR_after = await cdpManager.getCurrentICR(dennis, price)

    // Check ICR of B, C and D troves has increased,i.e. they have been hit by redemptions
    assert.isTrue(bob_ICR_after.gte(bob_ICR_before))
    assert.isTrue(carol_ICR_after.gte(carol_ICR_before))
    assert.isTrue(dennis_ICR_after.gte(dennis_ICR_before))

    const bob_SPDeposit_after = (await stabilityPool.getCompoundedCLVDeposit(bob)).toString()
    const carol_SPDeposit_after = (await stabilityPool.getCompoundedCLVDeposit(carol)).toString()
    const dennis_SPDeposit_after = (await stabilityPool.getCompoundedCLVDeposit(dennis)).toString()

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

  it("redeemCollateral(): caller can redeem their entire CLVToken balance", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    // Alice opens loan and transfers 400 CLV to Erin, the would-be redeemer
    await borrowerOperations.openLoan(dec(400, 18), alice, { from: alice, value: dec(10, 'ether') })
    await clvToken.transfer(erin, dec(400, 18), { from: alice })

    // Check Erin's balance before
    const erin_balance_before = await clvToken.balanceOf(erin)
    assert.equal(erin_balance_before, dec(400, 18))

    // B, C, D open loan
    await borrowerOperations.openLoan(dec(590, 18), bob, { from: bob, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(1990, 18), carol, { from: carol, value: dec(30, 'ether') })
    await borrowerOperations.openLoan(dec(1990, 18), dennis, { from: dennis, value: dec(50, 'ether') })

    // Get active debt and coll before redemption
    const activePool_debt_before = (await activePool.getCLVDebt()).toString()
    const activePool_coll_before = (await activePool.getETH()).toString()

    assert.equal(activePool_debt_before, dec(5020, 18))
    assert.equal(activePool_coll_before, dec(200, 'ether'))

    const price = await priceFeed.getPrice()
    // Erin attempts to redeem 400 CLV
    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(dec(400, 18), price)

    const { 0: partialRedemptionHint } = await sortedCDPs.findInsertPosition(
      partialRedemptionHintICR,
      price,
      erin,
      erin
    )

    await cdpManager.redeemCollateral(
      dec(400, 18),
      firstRedemptionHint,
      partialRedemptionHint,
      partialRedemptionHintICR,
      0,
      { from: erin })

    // Check activePool debt reduced by  400 CLV
    const activePool_debt_after = (await activePool.getCLVDebt()).toString()
    assert.equal(activePool_debt_after, '4620000000000000000000')

    /* Check ActivePool coll reduced by $400 worth of Ether: at ETH:USD price of $200, this should be 2 ETH.

    therefore remaining ActivePool ETH should be 198 */
    const activePool_coll_after = await activePool.getETH()
    // console.log(`activePool_coll_after: ${activePool_coll_after}`)
    assert.equal(activePool_coll_after, '198000000000000000000')

    // Check Erin's balance after
    const erin_balance_after = (await clvToken.balanceOf(erin)).toString()
    assert.equal(erin_balance_after, '0')
  })

  it("redeemCollateral(): reverts when requested redemption amount exceeds caller's CLV token balance", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    // Alice opens loan and transfers 400 CLV to Erin, the would-be redeemer
    await borrowerOperations.openLoan(dec(400, 18), alice, { from: alice, value: dec(10, 'ether') })
    await clvToken.transfer(erin, dec(400, 18), { from: alice })

    // Check Erin's balance before
    const erin_balance_before = await clvToken.balanceOf(erin)
    assert.equal(erin_balance_before, dec(400, 18))

    // B, C, D open loan
    await borrowerOperations.openLoan(dec(590, 18), bob, { from: bob, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(1990, 18), carol, { from: carol, value: dec(30, 'ether') })
    await borrowerOperations.openLoan(dec(1990, 18), dennis, { from: dennis, value: dec(50, 'ether') })

    // Get active debt and coll before redemption
    const activePool_debt_before = (await activePool.getCLVDebt()).toString()
    const activePool_coll_before = (await activePool.getETH()).toString()

    assert.equal(activePool_debt_before, dec(5020, 18))
    assert.equal(activePool_coll_before, dec(200, 'ether'))

    const price = await priceFeed.getPrice()

    let firstRedemptionHint
    let partialRedemptionHintICR

    // Erin tries to redeem 1000 CLV
    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintICR
      } = await hintHelpers.getRedemptionHints(dec(1000, 18), price))

      const { 0: partialRedemptionHint_1 } = await sortedCDPs.findInsertPosition(
        partialRedemptionHintICR,
        price,
        erin,
        erin
      )

      const redemptionTx = await cdpManager.redeemCollateral(
        dec(1000, 18),
        firstRedemptionHint,
        partialRedemptionHint_1,
        partialRedemptionHintICR,
        0,
        { from: erin })

      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's CLV token balance")
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
        0,
        { from: erin })
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's CLV token balance")
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
        0,
        { from: erin })
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's CLV token balance")
    }

    // Erin tries to redeem 2^256 - 1 CLV
    const maxBytes32 = toBN('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

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
        0,
        { from: erin })
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's CLV token balance")
    }
  })

  it("redeemCollateral(): value of issued ETH == face value of redeemed CLV (assuming 1 CLV has value of $1)", async () => {
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

    // Alice opens loan and transfers 1000 CLV each to Erin, Flyn, Graham
    await borrowerOperations.openLoan(dec(4990, 18), alice, { from: alice, value: dec(100, 'ether') })
    await clvToken.transfer(erin, dec(1000, 18), { from: alice })
    await clvToken.transfer(flyn, dec(1000, 18), { from: alice })
    await clvToken.transfer(graham, dec(1000, 18), { from: alice })

    // B, C, D open loan
    await borrowerOperations.openLoan(dec(590, 18), bob, { from: bob, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(1090, 18), carol, { from: carol, value: dec(30, 'ether') })
    await borrowerOperations.openLoan(dec(1090, 18), dennis, { from: dennis, value: dec(40, 'ether') })

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
      0,
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
      0,
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
      0,
      { from: graham })

    assert.isTrue(redemption_3.receipt.status);

    /* 950 CLV redeemed.  Expect $950 worth of ETH removed. At ETH:USD price of $200, 
    ETH removed = (950/200) = 4.75 ETH
    Total active ETH = 277.535 - 4.75 = 272.785 ETH */
    const activeETH_3 = (await activePool.getETH()).toString()
    assert.equal(activeETH_3, '272785000000000000000');
  })

  it("redeemCollateral(): reverts if there is zero outstanding system debt", async () => {
    // --- SETUP --- illegally mint CLV to Bob
    await clvToken.unprotectedMint(bob, dec(100, 18))

    assert.equal((await clvToken.balanceOf(bob)), dec(100, 18))

    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: dec(30, 'ether') })
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(40, 'ether') })

    const price = await priceFeed.getPrice()

    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(dec(100, 18), price)

    const { 0: partialRedemptionHint } = await sortedCDPs.findInsertPosition(
      partialRedemptionHintICR,
      price,
      bob,
      bob
    )

    // Bob tries to redeem his illegally obtained CLV
    try {
      const redemptionTx = await cdpManager.redeemCollateral(
        dec(100, 18),
        firstRedemptionHint,
        partialRedemptionHint,
        partialRedemptionHintICR,
        0,
        { from: bob })
    } catch (error) {
      assert.include(error.message, "VM Exception while processing transaction")
    }

    // assert.isFalse(redemptionTx.receipt.status);
  })

  it("redeemCollateral(): reverts if caller's tries to redeem more than the outstanding system debt", async () => {
    // --- SETUP --- illegally mint CLV to Bob
    await clvToken.unprotectedMint(bob, '101000000000000000000')

    assert.equal((await clvToken.balanceOf(bob)), '101000000000000000000')

    await borrowerOperations.openLoan(dec(40, 18), carol, { from: carol, value: dec(30, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), dennis, { from: dennis, value: dec(40, 'ether') })

    assert.equal((await activePool.getCLVDebt()).toString(), dec(100, 18))

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

    // Bob attempts to redeem his ill-gotten 101 CLV, from a system that has 100 CLV outstanding debt
    try {
      const redemptionTx = await cdpManager.redeemCollateral(
        dec(100, 18),
        firstRedemptionHint,
        partialRedemptionHint,
        partialRedemptionHintICR,
        0,
        { from: bob })
    } catch (error) {
      assert.include(error.message, "VM Exception while processing transaction")
    }
  })

  // Redemption fees 
  it("redeemCollateral(): a redemption made when base rate is zero increases the base rate", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate == 0
    assert.equal(await cdpManager.baseRate(), '0')

    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    assert.isTrue((await cdpManager.baseRate()).gt(toBN('0')))
  })

  it("redeemCollateral(): a redemption made when base rate is non-zero increases the base rate, for negligible time passed", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate == 0
    assert.equal(await cdpManager.baseRate(), '0')

    // A redeems 10 CLV
    const redemptionTx_A = await th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18))
    const timeStamp_A = await th.getTimestampFromTx(redemptionTx_A, web3)

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // B redeems 10 CLV
    const redemptionTx_B = await th.redeemCollateralAndGetTxObject(B, contracts, dec(10, 18))
    const timeStamp_B = await th.getTimestampFromTx(redemptionTx_B, web3)

    // Check B's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(B), dec(30, 18))

    // Check negligible time difference (< 1 minute) between txs
    assert.isTrue(Number(timeStamp_B) - Number(timeStamp_A) < 60)

    const baseRate_2 = await cdpManager.baseRate()

    // Check baseRate has again increased
    assert.isTrue(baseRate_2.gt(baseRate_1))
  })

  it("redeemCollateral(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const lastFeeOpTime_1 = await cdpManager.lastFeeOperationTime()

    // 50 seconds pass
    th.fastForwardTime(50, web3.currentProvider)

    // Borrower A triggers a fee
    await th.redeemCollateral(A, contracts, dec(1, 18))

    const lastFeeOpTime_2 = await cdpManager.lastFeeOperationTime()

    // Check that the last fee operation time did not update, as borrower A's 2nd redemption occured
    // since before minimum interval had passed 
    assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

    // 10 seconds passes
    th.fastForwardTime(10, web3.currentProvider)

    // Check that now, at least one hour has passed since lastFeeOpTime_1
    const timeNow = await th.getLatestBlockTimestamp(web3)
    assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(3600))

    // Borrower A triggers a fee
    await th.redeemCollateral(A, contracts, dec(1, 18))

    const lastFeeOpTime_3 = await cdpManager.lastFeeOperationTime()

    // Check that the last fee operation time DID update, as A's 2rd redemption occured
    // after minimum interval had passed 
    assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
  })

  it("redeemCollateral(): a redemption made at zero base rate send a non-zero ETHFee to LQTY staking contract", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate == 0
    assert.equal(await cdpManager.baseRate(), '0')

    // Check LQTY Staking contract balance before is zero
    const lqtyStakingBalance_Before = await web3.eth.getBalance(lqtyStaking.address)
    assert.equal(lqtyStakingBalance_Before, '0')

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // Check LQTY Staking contract balance after is non-zero
    const lqtyStakingBalance_After = toBN(await web3.eth.getBalance(lqtyStaking.address))
    assert.isTrue(lqtyStakingBalance_After.gt(toBN('0')))
  })

  it("redeemCollateral(): a redemption made at zero base increases the ETH-fees-per-LQTY-staked in LQTY Staking contract", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate == 0
    assert.equal(await cdpManager.baseRate(), '0')

    // Check LQTY Staking ETH-fees-per-LQTY-staked before is zero
    const F_ETH_Before = await lqtyStaking.F_ETH()
    assert.equal(F_ETH_Before, '0')

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // Check LQTY Staking ETH-fees-per-LQTY-staked after is non-zero
    const F_ETH_After = await lqtyStaking.F_ETH()
    assert.isTrue(F_ETH_After.gt('0'))
  })

  it("redeemCollateral(): a redemption made at a non-zero base rate send a non-zero ETHFee to LQTY staking contract", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate == 0
    assert.equal(await cdpManager.baseRate(), '0')

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const lqtyStakingBalance_Before = toBN(await web3.eth.getBalance(lqtyStaking.address))

    // B redeems 10 CLV
    await th.redeemCollateral(B, contracts, dec(10, 18))

    // Check B's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(B), dec(30, 18))

    const lqtyStakingBalance_After = toBN(await web3.eth.getBalance(lqtyStaking.address))

    // check LQTY Staking balance has increased
    assert.isTrue(lqtyStakingBalance_After.gt(lqtyStakingBalance_Before))
  })

  it("redeemCollateral(): a redemption made at a non-zero base rate increases ETH-per-LQTY-staked in the staking contract", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(30, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), C, { from: C, value: dec(1, 'ether') })

    // Check baseRate == 0
    assert.equal(await cdpManager.baseRate(), '0')

    // A redeems 10 CLV
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(A), dec(20, 18))

    // Check baseRate is now non-zero
    const baseRate_1 = await cdpManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // Check LQTY Staking ETH-fees-per-LQTY-staked before is zero
    const F_ETH_Before = await lqtyStaking.F_ETH()

    // B redeems 10 CLV
    await th.redeemCollateral(B, contracts, dec(10, 18))

    // Check B's balance has decreased by 10 CLV
    assert.equal(await clvToken.balanceOf(B), dec(30, 18))

    const F_ETH_After = await lqtyStaking.F_ETH()

    // check LQTY Staking balance has increased
    assert.isTrue(F_ETH_After.gt(F_ETH_Before))
  })

  it("redeemCollateral(): a redemption sends the ETH remainder (ETHDrawn - ETHFee) to the redeemer", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan('0', A, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(10, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(20, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(30, 18), C, { from: C, value: dec(1, 'ether') })

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))

    // Confirm baseRate before redemption is 0
    const baseRate = await cdpManager.baseRate()
    assert.equal(baseRate, '0')

    // Check total CLV supply
    const activeCLV = await activePool.getCLVDebt()
    const defaultCLV = await defaultPool.getCLVDebt()

    const totalCLVSupply = await activeCLV.add(defaultCLV)
    assert.equal(totalCLVSupply, dec(100, 18))

    // A redeems 10 CLV, which is 10% of total CLV supply
    await th.redeemCollateral(A, contracts, dec(10, 18))

    /*
    At ETH:USD price of 200:
    ETHDrawn = (10 / 200) = 0.05 ETH
    ETHfee = (1/) *( 10/100 ) * ETHDrawn = 0.0025 ETH
    ETHRemainder = 0.005 - 0.027 = 0.0475 ETH
    */

    const A_balanceAfter = toBN(await web3.eth.getBalance(A))

    // check A's ETH balance has increased by 0.045 ETH 
    assert.equal((A_balanceAfter.sub(A_balanceBefore)).toString(), dec(475, 14))
  })

  it("redeemCollateral(): a full redemption (leaving trove with 0 debt), closes the trove", async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan(dec(500, 18), whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(120, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(130, 18), C, { from: C, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), D, { from: D, value: dec(1, 'ether') })

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))
    const B_balanceBefore = toBN(await web3.eth.getBalance(B))
    const C_balanceBefore = toBN(await web3.eth.getBalance(C))

    // whale redeems 360 CLV.  Expect this to fully redeem A, B, C, and partially redeem D.
    await th.redeemCollateral(whale, contracts, dec(360, 18), { gasPrice: 0 })

    // Check A, B, C have been closed
    assert.isFalse(await sortedCDPs.contains(A))
    assert.isFalse(await sortedCDPs.contains(B))
    assert.isFalse(await sortedCDPs.contains(C))

    // Check D remains active
    assert.isTrue(await sortedCDPs.contains(D))
  })

  const redeemCollateral3Full1Partial = async () => {
    // time fast-forwards 1 year, and owner stakes 1 LQTY
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthToken.approve(lqtyStaking.address, dec(1, 18), { from: owner })
    await lqtyStaking.stake(dec(1, 18), { from: owner })

    await borrowerOperations.openLoan(dec(500, 18), whale, { from: whale, value: dec(100, 'ether') })

    await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(120, 18), B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(130, 18), C, { from: C, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(40, 18), D, { from: D, value: dec(1, 'ether') })

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))
    const B_balanceBefore = toBN(await web3.eth.getBalance(B))
    const C_balanceBefore = toBN(await web3.eth.getBalance(C))
    const D_balanceBefore = toBN(await web3.eth.getBalance(D))

    const A_collBefore = await cdpManager.getCDPColl(A)
    const B_collBefore = await cdpManager.getCDPColl(B)
    const C_collBefore = await cdpManager.getCDPColl(C)
    const D_collBefore = await cdpManager.getCDPColl(D)

    // Confirm baseRate before redemption is 0
    const baseRate = await cdpManager.baseRate()
    assert.equal(baseRate, '0')

    // whale redeems 360 CLV.  Expect this to fully redeem A, B, C, and partially redeem D.
    await th.redeemCollateral(whale, contracts, dec(360, 18), { gasPrice: 0 })

    // Check A, B, C have been closed
    assert.isFalse(await sortedCDPs.contains(A))
    assert.isFalse(await sortedCDPs.contains(B))
    assert.isFalse(await sortedCDPs.contains(C))

    // Check D stays active
    assert.isTrue(await sortedCDPs.contains(D))
    
    /*
    At ETH:USD price of 200, with full redemptions from A, B, C:

    ETHDrawn from A = 100/200 = 0.5 ETH --> Surplus = (1-0.5) = 0.5
    ETHDrawn from B = 120/200 = 0.6 ETH --> Surplus = (1-0.6) = 0.4
    ETHDrawn from C = 130/200 = 0.65 ETH --> Surplus = (1-0.65) = 0.35
    */

    const A_balanceAfter = toBN(await web3.eth.getBalance(A))
    const B_balanceAfter = toBN(await web3.eth.getBalance(B))
    const C_balanceAfter = toBN(await web3.eth.getBalance(C))
    const D_balanceAfter = toBN(await web3.eth.getBalance(D))

    // Check A, B, C’s trove collateral balance is zero (fully redeemed-from troves)
    const A_collAfter = await cdpManager.getCDPColl(A)
    const B_collAfter = await cdpManager.getCDPColl(B)
    const C_collAfter = await cdpManager.getCDPColl(C)
    assert.isTrue(A_collAfter.eq(toBN(0)))
    assert.isTrue(B_collAfter.eq(toBN(0)))
    assert.isTrue(C_collAfter.eq(toBN(0)))

    // check D's trove collateral balances have decreased (the partially redeemed-from trove)
    const D_collAfter = await cdpManager.getCDPColl(D)
    assert.isTrue(D_collAfter.lt(D_collBefore))

    // Check A, B, C (fully redeemed-from troves), and D's (the partially redeemed-from trove) balance has not changed
    assert.isTrue(A_balanceAfter.eq(A_balanceBefore))
    assert.isTrue(B_balanceAfter.eq(B_balanceBefore))
    assert.isTrue(C_balanceAfter.eq(C_balanceBefore))
    assert.isTrue(D_balanceAfter.eq(D_balanceBefore))
  }

  it("redeemCollateral(): a redemption that closes a trove leaves the trove's ETH surplus (collateral - ETH drawn) available for the trove owner to claim", async () => {
    await redeemCollateral3Full1Partial()

    const A_balanceBefore = toBN(await web3.eth.getBalance(A))
    const B_balanceBefore = toBN(await web3.eth.getBalance(B))
    const C_balanceBefore = toBN(await web3.eth.getBalance(C))

    // CDPManager endpoint cannot be called directly
    await th.assertRevert(borrowerOperations.claimRedeemedCollateral(D), 'CDPManager: Caller is not the BorrowerOperations contract')

    await borrowerOperations.claimRedeemedCollateral(A)
    await borrowerOperations.claimRedeemedCollateral(B)
    await borrowerOperations.claimRedeemedCollateral(C)

    const A_balanceAfter = toBN(await web3.eth.getBalance(A))
    const B_balanceAfter = toBN(await web3.eth.getBalance(B))
    const C_balanceAfter = toBN(await web3.eth.getBalance(C))

    assert.isTrue(A_balanceAfter.eq(A_balanceBefore.add(toBN(dec(5, 17)))))
    assert.isTrue(B_balanceAfter.eq(B_balanceBefore.add(toBN(dec(4, 17)))))
    assert.isTrue(C_balanceAfter.eq(C_balanceBefore.add(toBN(dec(35, 16)))))

    // D is not closed, so cannot claim
    await th.assertRevert(borrowerOperations.claimRedeemedCollateral(D), 'Trove must be closed to claim ETH')
  })

  it("redeemCollateral(): a redemption that closes a trove leaves the trove's ETH surplus (collateral - ETH drawn) available for the trove owner to use re-opening loan", async () => {
    await redeemCollateral3Full1Partial()

    const A_collSent = toBN(dec(2, 18))
    const B_collSent = toBN(dec(4, 17))
    const C_collSent = toBN(dec(36, 16))

    await borrowerOperations.openLoan(dec(100, 18), ZERO_ADDRESS, { from: A, value: A_collSent })
    await borrowerOperations.openLoan(dec(10, 18), ZERO_ADDRESS, { from: B, value: B_collSent })
    await borrowerOperations.openLoan(0, ZERO_ADDRESS, { from: C, value: C_collSent })

    const A_collAfter = await cdpManager.getCDPColl(A)
    const B_collAfter = await cdpManager.getCDPColl(B)
    const C_collAfter = await cdpManager.getCDPColl(C)

    assert.isTrue(A_collAfter.eq(A_collSent))
    assert.isTrue(B_collAfter.eq(B_collSent))
    assert.isTrue(C_collAfter.eq(C_collSent))

    assert.isTrue((await collSurplusPool.getCollateral(A)).eq(toBN(dec(5, 17))))
    assert.isTrue((await collSurplusPool.getCollateral(B)).eq(toBN(dec(4, 17))))
    assert.isTrue((await collSurplusPool.getCollateral(C)).eq(toBN(dec(35, 16))))

    // D is not closed, so cannot open trove
    await th.assertRevert(borrowerOperations.openLoan(D, ZERO_ADDRESS), 'BorrowerOps: CDP is active')
  })

  it("getPendingCLVDebtReward(): Returns 0 if there is no pending CLVDebt reward", async () => {
    // Make some loans
    const price = await priceFeed.getPrice()
    await borrowerOperations.openLoan(dec(2000, 18), whale, { from: whale, value: dec(100, 'ether') })
    await stabilityPool.provideToSP(dec(2000, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

    await borrowerOperations.openLoan(dec(20, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

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
    await borrowerOperations.openLoan(dec(2000, 18), whale, { from: whale, value: dec(100, 'ether') })
    await stabilityPool.provideToSP(dec(2000, 18), ZERO_ADDRESS, { from: whale })

    await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

    await borrowerOperations.openLoan(dec(20, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

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

  // --- computeICR ---

  it("computeICR(): Returns 0 if trove's coll is worth 0", async () => {
    const price = 0
    const coll = dec(1, 'ether')
    const debt = dec(100, 18)

    const ICR = (await cdpManager.computeICR(coll, debt, price)).toString()

    assert.equal(ICR, 0)
  })

  it("computeICR(): Returns 2^256-1 for ETH:USD = 100, coll = 1 ETH, debt = 100 CLV", async () => {
    const price = dec(100, 18)
    const coll = dec(1, 'ether')
    const debt = dec(100, 18)

    const ICR = (await cdpManager.computeICR(coll, debt, price)).toString()

    assert.equal(ICR, dec(1, 18))
  })

  it("computeICR(): returns correct ICR for ETH:USD = 100, coll = 200 ETH, debt = 30 CLV", async () => {
    const price = dec(100, 18)
    const coll = dec(200, 'ether')
    const debt = dec(30, 18)

    const ICR = (await cdpManager.computeICR(coll, debt, price)).toString()

    assert.isAtMost(th.getDifference(ICR, '666666666666666666666'), 1000)
  })

  it("computeICR(): returns correct ICR for ETH:USD = 250, coll = 1350 ETH, debt = 127 CLV", async () => {
    const price = '250000000000000000000'
    const coll = '1350000000000000000000'
    const debt = '127000000000000000000'

    const ICR = (await cdpManager.computeICR(coll, debt, price))

    assert.isAtMost(th.getDifference(ICR, '2657480314960630000000'), 1000000)
  })

  it("computeICR(): returns correct ICR for ETH:USD = 100, coll = 1 ETH, debt = 54321 CLV", async () => {
    const price = dec(100, 18)
    const coll = dec(1, 'ether')
    const debt = '54321000000000000000000'

    const ICR = (await cdpManager.computeICR(coll, debt, price)).toString()

    assert.isAtMost(th.getDifference(ICR, '1840908672520756'), 1000)
  })


  it("computeICR(): Returns 2^256-1 if trove has non-zero coll and zero debt", async () => {
    const price = dec(100, 18)
    const coll = dec(1, 'ether')
    const debt = 0

    const ICR = web3.utils.toHex(await cdpManager.computeICR(coll, debt, price))
    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    assert.equal(ICR, maxBytes32)
  })

  // --- checkRecoveryMode ---

  //TCR < 150%
  it("checkRecoveryMode(): Returns true when TCR < 150%", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await borrowerOperations.openLoan(dec(190, 18), alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(190, 18), bob, { from: bob, value: dec(3, 'ether') })

    await priceFeed.setPrice('99999999999999999999')

    const TCR = (await cdpManager.getTCR())

    assert.isTrue(TCR.lte(toBN('1500000000000000000')))

    assert.isTrue(await cdpManager.checkRecoveryMode())
  })

  // TCR == 150%
  it("checkRecoveryMode(): Returns false when TCR == 150%", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await borrowerOperations.openLoan(dec(190, 18), alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(190, 18), bob, { from: bob, value: dec(3, 'ether') })

    await priceFeed.setPrice('100000000000000000001')

    const TCR = (await cdpManager.getTCR())

    assert.isTrue(TCR.gte(toBN('1500000000000000000')))

    assert.isFalse(await cdpManager.checkRecoveryMode())
  })

  // > 150%
  it("checkRecoveryMode(): Returns false when TCR > 150%", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await borrowerOperations.openLoan(dec(190, 18), alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(190, 18), bob, { from: bob, value: dec(3, 'ether') })

    const TCR = (await cdpManager.getTCR()).toString()

    assert.equal(TCR, '1500000000000000000')

    assert.isFalse(await cdpManager.checkRecoveryMode())
  })

  // check 0
  it("checkRecoveryMode(): Returns false when TCR == 0", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await borrowerOperations.openLoan(dec(190, 18), alice, { from: alice, value: dec(3, 'ether') })
    await borrowerOperations.openLoan(dec(190, 18), bob, { from: bob, value: dec(3, 'ether') })

    await priceFeed.setPrice(0)

    const TCR = (await cdpManager.getTCR()).toString()

    assert.equal(TCR, 0)

    assert.isTrue(await cdpManager.checkRecoveryMode())
  })
})

contract('Reset chain state', async accounts => { })
