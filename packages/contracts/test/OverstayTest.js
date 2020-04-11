const PoolManager = artifacts.require("./PoolManager.sol")
const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const NameRegistry = artifacts.require("./NameRegistry.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")

const testHelpers = require("../utils/testHelpers.js")
const getDifference = testHelpers.getDifference

const moneyVals = testHelpers.MoneyValues

const deploymentHelpers = require("../utils/deploymentHelpers.js")
const getAddresses = deploymentHelpers.getAddresses
const setNameRegistry = deploymentHelpers.setNameRegistry
const connectContracts = deploymentHelpers.connectContracts
const getAddressesFromNameRegistry = deploymentHelpers.getAddressesFromNameRegistry

contract('PoolManager', async accounts => {
  const _1_Ether = web3.utils.toWei('1', 'ether')
  const _10_Ether = web3.utils.toWei('10', 'ether')
  const _50_Ether = web3.utils.toWei('50', 'ether')
  const _100_Ether = web3.utils.toWei('100', 'ether')

  const [owner,
    defaulter_1,
    defaulter_2,
    defaulter_3,
    whale,
    alice,
    bob,
    carol,
    dennis,
    erin,
    flyn,
  ] = accounts;

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

  describe("Overstays", async () => {
    beforeEach(async () => {
      priceFeed = await PriceFeed.new()
      clvToken = await CLVToken.new()
      poolManager = await PoolManager.new()
      sortedCDPs = await SortedCDPs.new()
      cdpManager = await CDPManager.new()
      nameRegistry = await NameRegistry.new()
      activePool = await ActivePool.new()
      stabilityPool = await StabilityPool.new()
      defaultPool = await DefaultPool.new()
      functionCaller = await FunctionCaller.new()

      DefaultPool.setAsDeployed(defaultPool)
      PriceFeed.setAsDeployed(priceFeed)
      CLVToken.setAsDeployed(clvToken)
      PoolManager.setAsDeployed(poolManager)
      SortedCDPs.setAsDeployed(sortedCDPs)
      CDPManager.setAsDeployed(cdpManager)
      NameRegistry.setAsDeployed(nameRegistry)
      ActivePool.setAsDeployed(activePool)
      StabilityPool.setAsDeployed(stabilityPool)
      FunctionCaller.setAsDeployed(functionCaller)

      contracts = {
        priceFeed,
        clvToken,
        poolManager,
        sortedCDPs,
        cdpManager,
        nameRegistry,
        activePool,
        stabilityPool,
        defaultPool,
        functionCaller
      }

      const contractAddresses = getAddresses(contracts)
      await setNameRegistry(contractAddresses, nameRegistry, { from: owner })
      const registeredAddresses = await getAddressesFromNameRegistry(nameRegistry)

      await connectContracts(contracts, registeredAddresses)
    })

    // --- Overstay Cohort Functionality ---

    it.only('poolContainsOverstays(): returns true if there is an overstay', async () => {
      // whale supports TCR
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })

      // alice deposits 100 CLV to the SP
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, alice, { from: alice })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      // Price drops
      await priceFeed.setPrice(moneyVals._100e18);

      // defaulter_1 liquidated. 100 CLV  absorbed by Pool, which empties it.  Alice's CLVLoss = 100.
      await cdpManager.liquidate(defaulter_1, { from: owner })

      // Bob, carol, dennis, erin, flyn open loans, withdraws 100 CLV and deposits to Stability Pool
      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: _10_Ether })
      await cdpManager.openLoan(moneyVals._100e18, carol, { from: carol, value: _10_Ether })
      await cdpManager.openLoan(moneyVals._100e18, dennis, { from: dennis, value: _10_Ether })
      await cdpManager.openLoan(moneyVals._100e18, erin, { from: erin, value: _10_Ether })
      await cdpManager.openLoan(moneyVals._100e18, flyn, { from: flyn, value: _10_Ether })

      await poolManager.provideToSP(moneyVals._100e18, { from: bob })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })
      await poolManager.provideToSP(moneyVals._100e18, { from: dennis })
      await poolManager.provideToSP(moneyVals._100e18, { from: erin })
      await poolManager.provideToSP(moneyVals._100e18, { from: flyn })

      // Defaulter 2 liquidated. Expect Alice's CLVLoss > 100, overstay.
      await cdpManager.liquidate(defaulter_2, { from: owner })

      const poolContainsOverstay = await poolManager.poolContainsOverstays()
      assert.isTrue(poolContainsOverstay)
    })

    it.only('The current cohort is updated with every liquidation', async () => {
      // whale supports TCR
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })

      assert.equal((await poolManager.currentCohort()).toString(), '0')

      // alice deposits 100 CLV to the SP
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, alice, { from: alice })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_3, { from: defaulter_3 })

      // Price drops
      await priceFeed.setPrice(moneyVals._100e18);

      // Liquidation offset against SP - increments current cohort by 1
      await cdpManager.liquidate(defaulter_1, { from: owner })

      assert.equal((await poolManager.currentCohort()).toString(), '1')

      // Liquidation is pure trove redistributon, no SP offset - no change to current cohort
      await cdpManager.liquidate(defaulter_2, { from: owner })

      assert.equal((await poolManager.currentCohort()).toString(), '1')

      // Bob deposits 100 CLV to the SP
      await cdpManager.addColl(bob, bob, { from: bob, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, bob, { from: bob })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      // Liquidation offset against SP - increments current cohort by 1
      await cdpManager.liquidate(defaulter_3, { from: owner })

      assert.equal((await poolManager.currentCohort()).toString(), '2')
    })

    it.only('New SP deposits are assigned to the correct cohorts', async () => {
      // whale supports TCR
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })

      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      // alice deposits 100 CLV to the SP
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, alice, { from: alice })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      assert.equal((await poolManager.userToCohort(alice)).toString(), '0')

      // Price drops
      await priceFeed.setPrice(moneyVals._100e18);

      await cdpManager.liquidate(defaulter_1, { from: owner })

      // Bob deposits 100 CLV to the SP
      await cdpManager.addColl(bob, bob, { from: bob, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, bob, { from: bob })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      assert.equal((await poolManager.userToCohort(bob)).toString(), '1')

      await cdpManager.liquidate(defaulter_2, { from: owner })

      // Carol deposits 100 CLV to the SP
      await cdpManager.addColl(carol, carol, { from: carol, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, carol, { from: carol })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      assert.equal((await poolManager.userToCohort(carol)).toString(), '2')
    })

    it.only('clearOverstayCohort(): It clears the overstayers from the oldest active cohort', async () => {
      // whale supports TCR
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })

      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      // alice deposits 100 CLV to the SP
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, alice, { from: alice })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      // Price drops
      await priceFeed.setPrice(moneyVals._100e18);

      await cdpManager.liquidate(defaulter_1, { from: owner })

      // bob deposits 100 CLV to the SP
      await cdpManager.addColl(bob, bob, { from: bob, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, bob, { from: bob })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      await cdpManager.liquidate(defaulter_2, { from: owner })

      assert.equal((await poolManager.deposit(alice)).toString(), moneyVals._100e18)
      await poolManager.clearOldestActiveCohort()
      assert.equal((await poolManager.deposit(alice)).toString(), '0')
    })

    // --- Overstay tests - withdraw 0 CLV if system contains an overstay ---

    /* Expectations:
    - Withdrawn CLV is equal to 0 if there's an overstayer
    - All depositors can withdraw
    */

    // 1.
    it('Basic unremoved overstay - overstayer remains in pool after a liquidation - new depositors withdraw 0 CLV', async () => {
      // whale supports TCR
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })

      // alice deposits 100 CLV to the SP
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, alice, { from: alice })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      // Price drops
      await priceFeed.setPrice(moneyVals._100e18);

      // defaulter_1 liquidated. 100 CLV  absorbed by Pool, which empties it.  Alice's CLVLoss = 100.
      await cdpManager.liquidate(defaulter_1, { from: owner })

      // Bob, carol, dennis, erin, flyn open loans, withdraws 100 CLV and deposits to Stability Pool
      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: _10_Ether })
      await cdpManager.openLoan(moneyVals._100e18, carol, { from: carol, value: _10_Ether })
      await cdpManager.openLoan(moneyVals._100e18, dennis, { from: dennis, value: _10_Ether })
      await cdpManager.openLoan(moneyVals._100e18, erin, { from: erin, value: _10_Ether })
      await cdpManager.openLoan(moneyVals._100e18, flyn, { from: flyn, value: _10_Ether })

      await poolManager.provideToSP(moneyVals._100e18, { from: bob })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })
      await poolManager.provideToSP(moneyVals._100e18, { from: dennis })
      await poolManager.provideToSP(moneyVals._100e18, { from: erin })
      await poolManager.provideToSP(moneyVals._100e18, { from: flyn })

      // Defaulter 2 liquidated. 
      await cdpManager.liquidate(defaulter_2, { from: owner })

      // With an overstayer in the pool, Bob, Carol, Dennis, Erin, Flyn should withdraw 0 CLV.
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      assert.equal((await clvToken.balanceOf(bob)).toString(), '0')
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })
      assert.equal((await clvToken.balanceOf(carol)).toString(), '0')
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: dennis })
      assert.equal((await clvToken.balanceOf(dennis)).toString(), '0')
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: erin })
      assert.equal((await clvToken.balanceOf(erin)).toString(), '0')
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: flyn })
      assert.equal((await clvToken.balanceOf(flyn)).toString(), '0')
    })

    // 2. 
    it('Basic unremoved overstay - overstayer leaves before a liquidation - new depositors withdraw correct amounts of CLV', async () => {
      // whale supports TCR
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })

      // alice deposits 100 CLV to the SP
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, alice, { from: alice })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      // Price drops
      await priceFeed.setPrice(moneyVals._100e18);

      // defaulter_1 liquidated. 100 CLV  absorbed by Pool, which empties it.  Alice's CLVLoss = 100.
      await cdpManager.liquidate(defaulter_1, { from: owner })

      // Bob, and Carol open loans with 100l CLV and provide 100 CLV to SP
      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: _10_Ether })
      await cdpManager.openLoan(moneyVals._100e18, carol, { from: carol, value: _10_Ether })

      await poolManager.provideToSP(moneyVals._100e18, { from: bob })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      // Alice fully withdraws
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })

      // Defaulter 2 liquidated. Bob and Carol should receive 50 CLV Loss each, leaving them with
      // withdrawable deposits of 50 CLV.
      await cdpManager.liquidate(defaulter_2, { from: owner })

      // Bob, Carol fully withdraw
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      const bob_CLVBalance = (await clvToken.balanceOf(bob)).toString()
      const carol_CLVBalance = (await clvToken.balanceOf(carol)).toString()
      assert.equal(bob_CLVBalance, moneyVals._50e18)
      assert.equal(carol_CLVBalance, moneyVals._50e18)
    })

    //3. 
    it('Basic unremoved overstay - overstayer leaves after a liquidation - new depositors withdraw correct amounts of CLV', async () => {
      // whale supports TCR
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })

      // alice deposits 100 CLV to the SP
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, alice, { from: alice })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      // Price drops
      await priceFeed.setPrice(moneyVals._100e18);

      // defaulter_1 liquidated. 100 CLV  absorbed by Pool, which empties it.  Alice's CLVLoss = 100.
      await cdpManager.liquidate(defaulter_1, { from: owner })

      // Bob, and Carol open loans, withdrawing 100 CLV and provide 100 CLV to SP
      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: _10_Ether })
      await cdpManager.openLoan(moneyVals._100e18, carol, { from: carol, value: _10_Ether })

      await poolManager.provideToSP(moneyVals._100e18, { from: bob })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      // Defaulter 2 liquidated. Expect Alice CLVLoss = 133.33, Bob CLVLoss = 33.33, Carol CLVLoss = 33.33
      await cdpManager.liquidate(defaulter_2, { from: owner })

      // Alice fully withdraws. Her excess 33.33 CLVLoss is split between active depositors
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })

      // Bob, Carol fully withdraw.  Expect Alice's excess CLV loss has been fed back in to Pool, and Bob and Carol
      // now withdraw 50 CLV each
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      const bob_CLVBalance = (await clvToken.balanceOf(bob)).toString()
      const carol_CLVBalance = (await clvToken.balanceOf(carol)).toString()

      assert.equal(bob_CLVBalance, moneyVals._50e18)
      assert.equal(carol_CLVBalance, moneyVals._50e18)
    })

    //4. 
    it('Complex unremoved overstay - overstayer remains in pool after a liquidation - new depositors withdraw 0 CLV', async () => {
      // whale supports TCR
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })

      // Alice deposits 100 CLV to the SP
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, alice, { from: alice })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._500_Finney })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._400_Finney })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._50e18, defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV(moneyVals._40e18, defaulter_3, { from: defaulter_3 })

      // Price drops
      await priceFeed.setPrice(moneyVals._100e18);

      // defaulter_1 liquidated. 100 CLV  absorbed by Pool, which empties it.  Alice's CLVLoss = 100.
      await cdpManager.liquidate(defaulter_1, { from: owner })

      // Bob opens loan  with 100 CLV and provides 100 CLV to SP
      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: _10_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      // defaulter_2 liquidated. Expect Bob's CLVLoss = 50, Alice's CLVLoss = 150
      await cdpManager.liquidate(defaulter_2, { from: owner })

      // Carol opens loan with 100 CLV and provides 100 CLV to SP
      await cdpManager.openLoan(moneyVals._100e18, carol, { from: carol, value: _10_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      // Defaulter 3 liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner })

      // Bob, Carol fully withdraw - both should only withdraw 0 CLV.

      await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      const bob_CLVBalance = (await clvToken.balanceOf(bob)).toString()
      const carol_CLVBalance = (await clvToken.balanceOf(carol)).toString()

      assert.equal(bob_CLVBalance, '0')
      assert.equal(carol_CLVBalance, '0')
    })

    // 5.
    it('Complex unremoved overstay - overstayer withdraws from pool before the last liquidation - new depositors withdraw correct amounts of CLV', async () => {
      // whale supports TCR
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })

      console.log(`S_CLV 1: ${await poolManager.S_CLV()}`)
      console.log(`CLV in Pool 1: ${await stabilityPool.getCLV()}`)
      // Alice deposits 100 CLV to the SP
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, alice, { from: alice })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._500_Finney })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._400_Finney })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._50e18, defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV(moneyVals._40e18, defaulter_3, { from: defaulter_3 })

      // Price drops
      await priceFeed.setPrice(moneyVals._100e18);

      // defaulter_1 liquidated. 100 CLV  absorbed by Pool, which empties it. Alice's CLVLoss = 100.
      await cdpManager.liquidate(defaulter_1, { from: owner })

      // Bob opens loan with 100 CLV and provides 100 CLV to SP
      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: _10_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      // defaulter_2 liquidated. Expect Bob's CLVLoss = 25, Alice's CLVLoss = 125
      await cdpManager.liquidate(defaulter_2, { from: owner })

      // Carol opens loan with 100 CLV and provides 100 CLV to SP
      await cdpManager.openLoan(moneyVals._100e18, carol, { from: carol, value: _10_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      // Alice fully withdraws.  Expect her 25 excess CLVLoss to be fed back the pool - 12.5 each for Bob and Carol
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })

      // Defaulter 3 liquidated. Bob should receive 20 CLV Loss, Carol should receive 20 CLV Loss
      await cdpManager.liquidate(defaulter_3, { from: owner })

      /* Bob, Carol fully withdraw.  Bob's CLV loss should be (25+12.5+20) = 57.5, Carol's CLV Loss should be (12.5+20) = 32.5.
      So Bob should withdraw 42.5, Carol should withdraw 67.5. */
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      const bob_CLVBalance = (await clvToken.balanceOf(bob)).toString()
      const carol_CLVBalance = (await clvToken.balanceOf(carol)).toString()

      assert.equal(bob_CLVBalance, '42500000000000000000')
      assert.equal(carol_CLVBalance, '67500000000000000000')
    })

    // 6.
    it('Complex unremoved overstay - overstayer withdraws from pool after the last liquidation - new depositors withdraw correct amounts of CLV', async () => {
      // whale supports TCR
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })

      // Alice deposits 100 CLV to the SP
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, alice, { from: alice })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._500_Finney })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._300_Finney })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._50e18, defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV(moneyVals._30e18, defaulter_3, { from: defaulter_3 })

      // Price drops
      await priceFeed.setPrice(moneyVals._100e18);

      // defaulter_1 liquidated. 100 CLV absorbed by Pool, which empties it.  Alice's CLVLoss = 100.
      await cdpManager.liquidate(defaulter_1, { from: owner })

      // Bob opens loan with 100 CLV and provides 100 CLV to SP
      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: _10_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      // defaulter_2 liquidated. Expect Bob's CLVLoss = 25, Alice's CLVLoss = 125
      await cdpManager.liquidate(defaulter_2, { from: owner })

      // Carol opens loan with 100 CLV and provides 100 CLV to SP
      await cdpManager.openLoan(moneyVals._100e18, carol, { from: carol, value: _10_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      // Defaulter 3 liquidated. Alice, Bob, Carol each receive 10 CLVLoss
      await cdpManager.liquidate(defaulter_3, { from: owner })

      // Alice fully withdraws. Her 'excess' CLV Loss of 35 gets fed back to pool, resulting in 17.5 each for Carol and Bob.
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })

      /* Bob, Carol fully withdraw.  Bob's CLV loss should be (25+10+17.5) = 52.5, Carol's CLV Loss should be (10+17.5)= 27.5 .
      Bob should be able to withdraw 47.5, Carol should be able to withdraw 72.5. */
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      const bob_CLVBalance = (await clvToken.balanceOf(bob)).toString()
      const carol_CLVBalance = (await clvToken.balanceOf(carol)).toString()

      assert.equal(bob_CLVBalance, '47500000000000000000')
      assert.equal(carol_CLVBalance, '72500000000000000000')
    })

    // --- Overstay tests - Ideal outcome ---

    /* Expectations:
    - Withdrawn CLV is equal to what depositor could withdraw if overstayer had already been ejected
    - All depositors can withdraw  */

    // 1.
    it('Basic unremoved overstay - overstayer remains in pool after a liquidation -  new depositors withdraw the correct amount', async () => {
      // whale supports TCR
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })

      // alice deposits 100 CLV to the SP
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, alice, { from: alice })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      // Price drops
      await priceFeed.setPrice(moneyVals._100e18);

      // defaulter_1 liquidated. 100 CLV  absorbed by Pool, which empties it.  Alice's CLVLoss = 100.
      await cdpManager.liquidate(defaulter_1, { from: owner })

      // Bob, carol, dennis, erin, flyn open loans, withdraws 100 CLV and deposits to Stability Pool
      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: _10_Ether })
      await cdpManager.openLoan(moneyVals._100e18, carol, { from: carol, value: _10_Ether })
      await cdpManager.openLoan(moneyVals._100e18, dennis, { from: dennis, value: _10_Ether })
      await cdpManager.openLoan(moneyVals._100e18, erin, { from: erin, value: _10_Ether })
      await cdpManager.openLoan(moneyVals._100e18, flyn, { from: flyn, value: _10_Ether })

      await poolManager.provideToSP(moneyVals._100e18, { from: bob })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })
      await poolManager.provideToSP(moneyVals._100e18, { from: dennis })
      await poolManager.provideToSP(moneyVals._100e18, { from: erin })
      await poolManager.provideToSP(moneyVals._100e18, { from: flyn })

      // Defaulter 2 liquidated. Bob, Carol, Dennis, Erin, Flyn should receive 20 CLV Loss each, leaving them with
      // withdrawable deposits of 80 CLV.
      await cdpManager.liquidate(defaulter_2, { from: owner })

      await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      assert.equal((await clvToken.balanceOf(bob)).toString(), moneyVals._80e18)
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })
      assert.equal((await clvToken.balanceOf(carol)).toString(), moneyVals._80e18)
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: dennis })
      assert.equal((await clvToken.balanceOf(dennis)).toString(), moneyVals._80e18)
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: erin })
      assert.equal((await clvToken.balanceOf(erin)).toString(), moneyVals._80e18)
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: flyn })
      assert.equal((await clvToken.balanceOf(flyn)).toString(), moneyVals._80e18)
    })

    // 2. 
    it('Basic unremoved overstay - overstayer leaves before a liquidation - new depositors withdraw correct amounts of CLV', async () => {
      // whale supports TCR
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })

      // alice deposits 100 CLV to the SP
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, alice, { from: alice })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      // Price drops
      await priceFeed.setPrice(moneyVals._100e18);

      // defaulter_1 liquidated. 100 CLV  absorbed by Pool, which empties it.  Alice's CLVLoss = 100.
      await cdpManager.liquidate(defaulter_1, { from: owner })

      // Bob, and Carol open loans with 100l CLV and provide 100 CLV to SP
      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: _10_Ether })
      await cdpManager.openLoan(moneyVals._100e18, carol, { from: carol, value: _10_Ether })

      await poolManager.provideToSP(moneyVals._100e18, { from: bob })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      // Alice fully withdraws
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })

      // Defaulter 2 liquidated. Bob and Carol should receive 50 CLV Loss each, leaving them with
      // withdrawable deposits of 50 CLV.
      await cdpManager.liquidate(defaulter_2, { from: owner })

      // Bob, Carol fully withdraw
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      const bob_CLVBalance = (await clvToken.balanceOf(bob)).toString()
      const carol_CLVBalance = (await clvToken.balanceOf(carol)).toString()
      assert.equal(bob_CLVBalance, moneyVals._50e18)
      assert.equal(carol_CLVBalance, moneyVals._50e18)
    })

    //3. 
    it('Basic unremoved overstay - overstayer leaves after a liquidation - new depositors withdraw correct amounts of CLV', async () => {
      // whale supports TCR
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })

      // alice deposits 100 CLV to the SP
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, alice, { from: alice })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      // Price drops
      await priceFeed.setPrice(moneyVals._100e18);

      // defaulter_1 liquidated. 100 CLV  absorbed by Pool, which empties it.  Alice's CLVLoss = 100.
      await cdpManager.liquidate(defaulter_1, { from: owner })

      // Bob, and Carol open loans, withdrawing 100 CLV and provide 100 CLV to SP
      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: _10_Ether })
      await cdpManager.openLoan(moneyVals._100e18, carol, { from: carol, value: _10_Ether })

      await poolManager.provideToSP(moneyVals._100e18, { from: bob })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      // Defaulter 2 liquidated. Bob and Carol should receive 50 CLV Loss each, leaving them with
      // withdrawable deposits of 50 CLV.
      await cdpManager.liquidate(defaulter_2, { from: owner })

      // Alice fully withdraws
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })

      // Bob, Carol fully withdraw
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      const bob_CLVBalance = (await clvToken.balanceOf(bob)).toString()
      const carol_CLVBalance = (await clvToken.balanceOf(carol)).toString()

      assert.equal(bob_CLVBalance, moneyVals._50e18)
      assert.equal(carol_CLVBalance, moneyVals._50e18)
    })

    //4. 
    it('Complex unremoved overstay - overstayer remains in pool after a liquidation - new depositors withdraw correct amounts of CLV', async () => {
      // whale supports TCR
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })

      // Alice deposits 100 CLV to the SP
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, alice, { from: alice })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._50e18, defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV(moneyVals._40e18, defaulter_3, { from: defaulter_3 })

      // Price drops
      await priceFeed.setPrice(moneyVals._100e18);

      // defaulter_1 liquidated. 100 CLV  absorbed by Pool, which empties it.  Alice's CLVLoss = 100.
      await cdpManager.liquidate(defaulter_1, { from: owner })

      // Bob opens loan  with 100 CLV and provides 100 CLV to SP
      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: _10_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      // defaulter_2 liquidated. Bob should receive 50 CLV Loss.
      await cdpManager.liquidate(defaulter_2, { from: owner })

      // Carol opens loan with 100 CLV and provides 100 CLV to SP
      await cdpManager.openLoan(moneyVals._100e18, carol, { from: carol, value: _10_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      // Defaulter 3 liquidated. Bob should receive 20 CLV Loss, Carol should receive 20 CLV Loss
      await cdpManager.liquidate(defaulter_3, { from: owner })

      /* Bob, Carol fully withdraw.  Bob's CLV loss should be (50+20), Carol's CLV Loss should be 20.
      Bob should be able to withdraw 30, Carol should be able to withdraw 80. */
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      const bob_CLVBalance = (await clvToken.balanceOf(bob)).toString()
      const carol_CLVBalance = (await clvToken.balanceOf(carol)).toString()

      assert.equal(bob_CLVBalance, moneyVals._50e18)
      assert.equal(carol_CLVBalance, moneyVals._50e18)
    })

    // 5.
    it('Complex unremoved overstay - overstayer withdraws from pool before the last liquidation - new depositors withdraw correct amounts of CLV', async () => {
      // whale supports TCR
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })

      // Alice deposits 100 CLV to the SP
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, alice, { from: alice })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._50e18, defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV(moneyVals._40e18, defaulter_3, { from: defaulter_3 })

      // Price drops
      await priceFeed.setPrice(moneyVals._100e18);

      // defaulter_1 liquidated. 100 CLV  absorbed by Pool, which empties it.  Alice's CLVLoss = 100.
      await cdpManager.liquidate(defaulter_1, { from: owner })

      // Bob opens loan  with 100 CLV and provides 100 CLV to SP
      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: _10_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      // defaulter_2 liquidated. Bob should receive 50 CLV Loss.
      await cdpManager.liquidate(defaulter_2, { from: owner })

      // Carol opens loan with 100 CLV and provides 100 CLV to SP
      await cdpManager.openLoan(moneyVals._100e18, carol, { from: carol, value: _10_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      // Alice fully withdraws
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })

      // Defaulter 3 liquidated. Bob should receive 20 CLV Loss, Carol should receive 20 CLV Loss
      await cdpManager.liquidate(defaulter_3, { from: owner })

      /* Bob, Carol fully withdraw.  Bob's CLV loss should be (50+20), Carol's CLV Loss should be 20.
      Bob should be able to withdraw 30, Carol should be able to withdraw 80. */
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      const bob_CLVBalance = (await clvToken.balanceOf(bob)).toString()
      const carol_CLVBalance = (await clvToken.balanceOf(carol)).toString()

      assert.equal(bob_CLVBalance, moneyVals._50e18)
      assert.equal(carol_CLVBalance, moneyVals._50e18)
    })

    // 6.
    it('Complex unremoved overstay - overstayer withdraws from pool after the last liquidation - new depositors withdraw correct amounts of CLV', async () => {
      // whale supports TCR
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })

      // Alice deposits 100 CLV to the SP
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, alice, { from: alice })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._50e18, defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV(moneyVals._40e18, defaulter_3, { from: defaulter_3 })

      // Price drops
      await priceFeed.setPrice(moneyVals._100e18);

      // defaulter_1 liquidated. 100 CLV  absorbed by Pool, which empties it.  Alice's CLVLoss = 100.
      await cdpManager.liquidate(defaulter_1, { from: owner })

      // Bob opens loan  with 100 CLV and provides 100 CLV to SP
      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: _10_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      // defaulter_2 liquidated. Bob should receive 50 CLV Loss.
      await cdpManager.liquidate(defaulter_2, { from: owner })

      // Carol opens loan with 100 CLV and provides 100 CLV to SP
      await cdpManager.openLoan(moneyVals._100e18, carol, { from: carol, value: _10_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      // Defaulter 3 liquidated. Bob should receive 20 CLV Loss, Carol should receive 20 CLV Loss
      await cdpManager.liquidate(defaulter_3, { from: owner })

      // Alice fully withdraws
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })

      /* Bob, Carol fully withdraw.  Bob's CLV loss should be (50+20), Carol's CLV Loss should be 20.
      Bob should be able to withdraw 30, Carol should be able to withdraw 80. */
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      const bob_CLVBalance = (await clvToken.balanceOf(bob)).toString()
      const carol_CLVBalance = (await clvToken.balanceOf(carol)).toString()

      assert.equal(bob_CLVBalance, moneyVals._50e18)
      assert.equal(carol_CLVBalance, moneyVals._50e18)
    })
  })
})