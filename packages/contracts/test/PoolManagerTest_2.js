// TODO - Refactor duplication across tests. Run only minimum number of contracts
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
    defaulter_4,
    whale,
    whale_2,
    alice,
    bob,
    carol,
    dennis,
    erin,
    flyn,
    graham,
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

  let gasPriceInWei


  describe("Stability Pool Mechanisms", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
    })

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

    // increases recorded CLV at Stability Pool
    it("provideToSP(): increases the Stability Pool CLV balance", async () => {
      // --- SETUP --- Give Alice 200 CLV
      await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })
      await cdpManager.withdrawCLV(200, alice, { from: alice })

      // --- TEST ---
      // check CLV balances before
      const alice_CLV_Before = await clvToken.balanceOf(alice)
      const stabilityPool_CLV_Before = await stabilityPool.getCLV({ from: poolManager.address })
      assert.equal(alice_CLV_Before, 200)
      assert.equal(stabilityPool_CLV_Before, 0)

      // provideToSP()
      await poolManager.provideToSP(200, { from: alice })

      // check CLV balances after
      const alice_CLV_After = await clvToken.balanceOf(alice)
      const stabilityPool_CLV_After = await stabilityPool.getCLV({ from: poolManager.address })
      assert.equal(alice_CLV_After, 0)
      assert.equal(stabilityPool_CLV_After, 200)
    })

    it("provideToSP(): updates the user's deposit record in PoolManager", async () => {
      // --- SETUP --- give Alice 200 CLV
      await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })
      await cdpManager.withdrawCLV(200, alice, { from: alice })

      // --- TEST ---
      // check user's deposit record before
      const alice_depositRecord_Before = await poolManager.deposits(alice)
      assert.equal(alice_depositRecord_Before, 0)

      // provideToSP()
      await poolManager.provideToSP(200, { from: alice })

      // check user's deposit record after
      const alice_depositRecord_After = await poolManager.deposit(alice)
      assert.equal(alice_depositRecord_After, 200)
    })

    it("provideToSP(): reduces the user's CLV balance by the correct amount", async () => {
      // --- SETUP --- Give Alice 200 CLV
      await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })
      await cdpManager.withdrawCLV(200, alice, { from: alice })

      // --- TEST ---
      // check user's deposit record before
      const alice_CLVBalance_Before = await clvToken.balanceOf(alice)
      assert.equal(alice_CLVBalance_Before, 200)

      // provideToSP()
      await poolManager.provideToSP(200, { from: alice })

      // check user's deposit record after
      const alice_CLVBalance_After = await clvToken.balanceOf(alice)
      assert.equal(alice_CLVBalance_After, 0)
    })

    it("provideToSP(): increases totalCLVDeposits by correct amount", async () => {
      // --- SETUP ---

      // Whale opens CDP with 50 ETH, adds 2000 CLV to StabilityPool
      await cdpManager.addColl(whale, whale, { from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('2000000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('2000000000000000000000', { from: whale })

      const totalCLVDeposits = await stabilityPool.getTotalCLVDeposits()
      assert.equal(totalCLVDeposits, '2000000000000000000000')
    })

    it('provideToSP(): Correctly updates user snapshots of accumulated rewards per unit staked', async () => {
      // --- SETUP ---

      // Whale opens CDP with 50 ETH, adds 2000 CLV to StabilityPool
      await cdpManager.addColl(whale, whale, { from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('2000000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('2000000000000000000000', { from: whale })
      // 2 CDPs opened, each withdraws 180 CLV
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV('180000000000000000000', defaulter_2, { from: defaulter_2 })

      // Alice makes CDP and withdraws 100 CLV
      await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })
      await cdpManager.withdrawCLV(100, alice, { from: alice })

      // price drops: defaulter's CDPs fall below MCR, whale doesn't
      await priceFeed.setPrice('100000000000000000000');

      // CDPs are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // --- TEST ---
      const S_CLV = (await poolManager.S_CLV())  // expected: 0.18 CLV
      const S_ETH = (await poolManager.S_ETH())  // expected: 0.001 Ether
      assert.isAtMost(getDifference(S_CLV, '180000000000000000'), 100)  // 0.18 CLV
      assert.isAtMost(getDifference(S_ETH, '1000000000000000'), 100) // 0.001 Ether

      // check 'Before' snapshots
      const alice_snapshot_Before = await poolManager.snapshot(alice)
      const alice_snapshotETH_Before = alice_snapshot_Before[0].toString()
      const alice_snapshotCLV_Before = alice_snapshot_Before[1].toString()
      assert.equal(alice_snapshotETH_Before, 0)
      assert.equal(alice_snapshotCLV_Before, 0)

      // Make deposit
      await poolManager.provideToSP(100, { from: alice })

      // check 'After' snapshots
      const alice_snapshot_After = await poolManager.snapshot(alice)
      const alice_snapshotETH_After = alice_snapshot_After[0]
      const alice_snapshotCLV_After = alice_snapshot_After[1]

      assert.isAtMost(getDifference(alice_snapshotETH_After, '1000000000000000'), 100)
      assert.isAtMost(getDifference(alice_snapshotCLV_After, '180000000000000000'), 100)
    })

    it("provideToSP(), multiple deposits: updates user's deposit and snapshots", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
      await cdpManager.addColl(whale, whale, { from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('1850000000000000000000', alice, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 3 CDPs opened. Two users withdraw 180 CLV each
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV('180000000000000000000', defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV('180000000000000000000', defaulter_3, { from: defaulter_3 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV('150000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('150000000000000000000', { from: alice })

      const alice_Snapshot_0 = await poolManager.snapshot(alice)
      const alice_Snapshot_0_ETH = alice_Snapshot_0[0]
      const alice_Snapshot_0_CLV = alice_Snapshot_0[1]
      assert.equal(alice_Snapshot_0_ETH, 0)
      assert.equal(alice_Snapshot_0_CLV, 0)

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.liquidate(defaulter_2, { from: owner }); // 180 CLV closed

      // At this stage, total deposits = 2000 CLV: 1850CLV (from whale) and 150CLV (from Alice)
      const S_CLV_1 = (await poolManager.S_CLV()).toString()   // expected: 0.18 CLV
      const S_ETH_1 = (await poolManager.S_ETH()).toString()  // expected: 0.001 Ether

      assert.equal(S_CLV_1, '180000000000000000') // 0.18 CLV
      assert.equal(S_ETH_1, '1000000000000000')  // 0.001 Ether

      // Alice makes deposit #2:  100CLV
      await cdpManager.withdrawCLV('100000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('100000000000000000000', { from: alice })

      /* check newDeposit = (oldDeposit - CLVLoss) + top-up.
      CLVLoss = 150 CLV * 0.18 = 27 CLV
      --> check newDeposit = (150 - 27 ) + 100 = 223 CLV */
      const newDeposit_alice = (await poolManager.deposit(alice)).toString()
      console.log("new deposit alice:" + newDeposit_alice)
      assert.equal(newDeposit_alice, '223000000000000000000')

      // check Alice's new snapshot is correct
      const alice_Snapshot_1 = await poolManager.snapshot(alice)
      const alice_Snapshot_1_ETH = (alice_Snapshot_1[0]).toString()
      const alice_Snapshot_1_CLV = (alice_Snapshot_1[1]).toString()
      assert.equal(alice_Snapshot_1_ETH, S_ETH_1)
      assert.equal(alice_Snapshot_1_CLV, S_CLV_1)

      // Bob withdraws CLV and deposits to StabilityPool, bringing total deposits to: (1850 + 223 + 427) = 2500 CLV
      await cdpManager.addColl(bob, bob, { from: bob, value: _50_Ether })
      await cdpManager.withdrawCLV('427000000000000000000', bob, { from: bob })
      await poolManager.provideToSP('427000000000000000000', { from: bob })

      const totalCLVDeposits = (await stabilityPool.getTotalCLVDeposits()).toString()
      assert.equal(totalCLVDeposits, '2500000000000000000000')

      // Defaulter 3 CDP is closed
      await cdpManager.liquidate(defaulter_3, { from: owner })

      /*  Now, 'S' values have been impacted by 3 'default' events:
       S_CLV = (180/2000 + 180/2000 + 180/2500) = (0.09 + 0.09 + 0.072) = 0.252 CLV
       S_ETH = (1/2000 + 1/2000 + 1/2500)  = (0.0005 + 0.0005 + 0.0004) = 0.0014 ETH  */

      const S_CLV_2 = (await poolManager.S_CLV()).toString()   // expected: 0.252 CLV
      const S_ETH_2 = (await poolManager.S_ETH()).toString()  // expected: 0.0014 ETH

      assert.equal(S_CLV_2, '252000000000000000')  // 00.252 CLV
      assert.equal(S_ETH_2, '1400000000000000')  // 0.0014 ETH

      // Alice makes deposit #3:  100CLV
      await cdpManager.withdrawCLV('100000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('100000000000000000000', { from: alice })

      // check Alice's new snapshot is correct
      const alice_Snapshot_2 = await poolManager.snapshot(alice)
      const alice_Snapshot_2_ETH = alice_Snapshot_2[0].toString()
      const alice_Snapshot_2_CLV = alice_Snapshot_2[1].toString()
      assert.equal(alice_Snapshot_2_ETH, S_ETH_2)
      assert.equal(alice_Snapshot_2_CLV, S_CLV_2)
    })

    it("withdrawFromSP(): it retrieves the correct CLV amount and the entire ETH Gain, and updates deposit", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
      await cdpManager.addColl(whale, whale, { from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 2 CDPs opened, 180 CLV withdrawn
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV('180000000000000000000', defaulter_2, { from: defaulter_2 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV('150000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('150000000000000000000', { from: alice })

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.liquidate(defaulter_2, { from: owner }) // 180 CLV closed

      const S_CLV_1 = (await poolManager.S_CLV())  // expected: 0.18 CLV
      const S_ETH_1 = (await poolManager.S_ETH())  // expected: 0.001 Ether

      assert.isAtMost(getDifference(S_CLV_1, '180000000000000000'), 100)  // 0.18 CLV
      assert.isAtMost(getDifference(S_ETH_1, '1000000000000000'), 100)  // 0.001 Ether

      // Alice retrieves part of her entitled CLV: 90 CLV
      await poolManager.withdrawFromSP('90000000000000000000', { from: alice })

      /* Alice's CLVLoss = (0.18 * 150) = 27 CLV. Her remaining deposit should be:
      oldDeposit - CLVLoss - withdrawalAmount, i.e:
      150 - 27 - 90 = 33 CLV  */

      // check StabilityPool totalCLVDeposits decreased by 117 CLV to 1883 CLV
      const totalCLVDeposits = (await stabilityPool.getTotalCLVDeposits())
      assert.isAtMost(getDifference(totalCLVDeposits, '1883000000000000000000'), 100)

      // check Alice's deposit has been updated to 33 CLV */
      const newDeposit = (await poolManager.deposit(alice)).toString()
      assert.equal(newDeposit, '33000000000000000000')
    })

    it("withdrawFromSP(): it correctly updates the user's CLV and ETH snapshots of entitled reward per unit staked", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
      await cdpManager.addColl(whale, whale, { from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 2 CDPs opened, 180 CLV withdrawn
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV('180000000000000000000', defaulter_2, { from: defaulter_2 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV('150000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('150000000000000000000', { from: alice })

      // check 'Before' snapshots
      const alice_snapshot_Before = await poolManager.snapshot(alice)
      const alice_snapshotETH_Before = alice_snapshot_Before[0].toString()
      const alice_snapshotCLV_Before = alice_snapshot_Before[1].toString()
      assert.equal(alice_snapshotETH_Before, 0)
      assert.equal(alice_snapshotCLV_Before, 0)

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.liquidate(defaulter_2, { from: owner }); // 180 CLV closed

      // Alice retrieves part of her entitled CLV: 90 CLV
      await poolManager.withdrawFromSP('90000000000000000000', { from: alice })

      // check 'After' snapshots
      const alice_snapshot_After = await poolManager.snapshot(alice)
      const alice_snapshotETH_After = alice_snapshot_After[0]
      const alice_snapshotCLV_After = alice_snapshot_After[1]
      assert.isAtMost(getDifference(alice_snapshotETH_After, '1000000000000000'), 100)
      assert.isAtMost(getDifference(alice_snapshotCLV_After, '180000000000000000'), 100)
    })

    it("withdrawFromSP(): decreases StabilityPool ETH", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      await cdpManager.addColl(whale, whale, { from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV('150000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('150000000000000000000', { from: alice })

      // price drops: defaulter's CDP falls below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      /* defaulter's CDP is closed.
      / Alice's expected rewards:
      / CLV: 150 * 180/2000 = 13.5
      / ETH: 150 * 1/2000 = 0.075 */
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed

      //check activePool and StabilityPool Ether before retrieval:
      const active_ETH_Before = await activePool.getETH()
      const stability_ETH_Before = await stabilityPool.getETH()

      // Alice retrieves all of her deposit
      await poolManager.withdrawFromSP('150000000000000000000', { from: alice })

      const active_ETH_After = await activePool.getETH()
      const stability_ETH_After = await stabilityPool.getETH()

      const active_ETH_Difference = (active_ETH_After.sub(active_ETH_Before))
      const stability_ETH_Difference = (stability_ETH_After.sub(stability_ETH_Before))

      assert.equal(active_ETH_Difference, '0')
      assert.isAtMost(getDifference(stability_ETH_Difference, '-75000000000000000'), 100)
    })

    // --- Tests that check any rounding error in accumulated CLVLoss in the SP "favors the Pool" ---

    it("withdrawFromSP(): All depositors are able to withdraw from the SP to their account", async () => {
      // Whale opens loan 
      await cdpManager.addColl(accounts[999], accounts[999], { from: whale, value: moneyVals._100_Ether })

      // Future defaulter opens loan
      await cdpManager.openLoan(moneyVals._100e18, accounts[0], { from: defaulter_1, value: moneyVals._1_Ether })

      // 6 Accounts open loans and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await cdpManager.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._1_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      await priceFeed.setPrice(moneyVals._100e18)
      await cdpManager.liquidate(defaulter_1)

      // All depositors attempt to withdraw
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      assert.equal((await poolManager.deposit(alice)).toString(), '0')
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      assert.equal((await poolManager.deposit(alice)).toString(), '0')
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })
      assert.equal((await poolManager.deposit(alice)).toString(), '0')
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: dennis })
      assert.equal((await poolManager.deposit(alice)).toString(), '0')
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: erin })
      assert.equal((await poolManager.deposit(alice)).toString(), '0')
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: flyn })
      assert.equal((await poolManager.deposit(alice)).toString(), '0')

      const totalDeposits = (await stabilityPool.totalCLVDeposits()).toString()

      assert.equal(totalDeposits, '0')
    })

    it("withdrawFromSP(): Each depositor withdraws an amount <= their (deposit - CLVLoss)", async () => {
      // Whale opens loan 
      await cdpManager.addColl(accounts[999], accounts[999], { from: whale, value: moneyVals._100_Ether })

      // Future defaulter opens loan
      await cdpManager.openLoan(moneyVals._100e18, accounts[0], { from: defaulter_1, value: moneyVals._1_Ether })

      // 6 Accounts open loans and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await cdpManager.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._1_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      await priceFeed.setPrice(moneyVals._100e18)
      await cdpManager.liquidate(defaulter_1)

      /* All depositors attempt to withdraw.  From a distribution of 100 CLV, each depositor receives
      CLVLoss = 16.666666666666666666 CLV

      and thus with a deposit of 100 CLV, each should withdraw 83.333333333333333333 CLV (in practice, slightly less due to rounding error)
      */

      const expectedWithdrawnCLVAmount = web3.utils.toBN('83333333333333333333')

      await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      assert.isTrue((await clvToken.balanceOf(alice)).lte(expectedWithdrawnCLVAmount))
      console.log((await clvToken.balanceOf(alice)).toString())
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      assert.isTrue((await clvToken.balanceOf(bob)).lte(expectedWithdrawnCLVAmount))
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })
      assert.isTrue((await clvToken.balanceOf(carol)).lte(expectedWithdrawnCLVAmount))
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: dennis })
      assert.isTrue((await clvToken.balanceOf(dennis)).lte(expectedWithdrawnCLVAmount))
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: erin })
      assert.isTrue((await clvToken.balanceOf(erin)).lte(expectedWithdrawnCLVAmount))
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: flyn })
      assert.isTrue((await clvToken.balanceOf(flyn)).lte(expectedWithdrawnCLVAmount))

      const totalDeposits = (await stabilityPool.totalCLVDeposits()).toString()

      assert.equal(totalDeposits, '0')
    })


    // --- withdrawFromSPtoCDP ---


    it("withdrawFromSPtoCDP(): Applies CLVLoss to user's deposit, and redirects ETH reward to user's CDP", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      await cdpManager.addColl(whale, whale, { from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV('150000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('150000000000000000000', { from: alice })

      // check alice's CDP recorded ETH Before:
      const aliceCDP_Before = await cdpManager.CDPs(alice)
      const aliceCDP_ETH_Before = aliceCDP_Before[1]
      assert.equal(aliceCDP_ETH_Before, _10_Ether)

      // price drops: defaulter's CDP falls below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      /* defaulter's CDP is closed.
      / Alice's expected rewards:
      / CLV: 150 * 180/2000 = 13.5
      / ETH: 150 * 1/2000 = 0.075 */
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed

      // Alice sends her ETH Gains to her CDP
      await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })

      // check Alice's CLVLoss has been applied to her deposit - expect (150 - 13.5) = 136.5 CLV
      alice_deposit_afterDefault = (await poolManager.deposit(alice))
      assert.isAtMost(getDifference(alice_deposit_afterDefault, '136500000000000000000'), 100)

      // check alice's CDP recorded ETH has increased by the expected reward amount
      const aliceCDP_After = await cdpManager.CDPs(alice)
      const aliceCDP_ETH_After = aliceCDP_After[1]

      const CDP_ETH_Increase = (aliceCDP_ETH_After.sub(aliceCDP_ETH_Before)).toString()

      assert.equal(CDP_ETH_Increase, '75000000000000000') // expect gain of 0.075 Ether
    })

    it("withdrawFromSPtoCDP(): decreases StabilityPool ETH and increases activePool ETH", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      await cdpManager.addColl(whale, whale, { from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV('150000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('150000000000000000000', { from: alice })

      // price drops: defaulter's CDP falls below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      /* defaulter's CDP is closed.
      / Alice's expected rewards:
      / CLV: 150 * 180/2000 = 13.5
      / ETH: 150 * 1/2000 = 0.075 */
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed

      //check activePool and StabilityPool Ether before retrieval:
      const active_ETH_Before = await activePool.getETH()
      const stability_ETH_Before = await stabilityPool.getETH()

      // Alice retrieves all of her deposit, 150CLV, choosing to redirect to her CDP
      await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })

      const active_ETH_After = await activePool.getETH()
      const stability_ETH_After = await stabilityPool.getETH()

      const active_ETH_Difference = (active_ETH_After.sub(active_ETH_Before))
      const stability_ETH_Difference = (stability_ETH_After.sub(stability_ETH_Before))

      // check Pool ETH values change by Alice's ETHGain, i.e 0.075 ETH
      assert.isAtMost(getDifference(active_ETH_Difference, '75000000000000000'), 100)
      assert.isAtMost(getDifference(stability_ETH_Difference, '-75000000000000000'), 100)
    })

    it("withdrawFromSPtoCDP(): All depositors are able to withdraw their ETH gain from the SP to their CDP", async () => {
      // Whale opens loan 
      await cdpManager.addColl(accounts[999], accounts[999], { from: whale, value: moneyVals._100_Ether })

      // Future defaulter opens loan
      await cdpManager.openLoan(moneyVals._100e18, accounts[0], { from: defaulter_1, value: moneyVals._1_Ether })

      // 6 Accounts open loans and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await cdpManager.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._1_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      await priceFeed.setPrice(moneyVals._100e18)
      await cdpManager.liquidate(defaulter_1)

      // All depositors attempt to withdraw
      const tx1 = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      assert.isTrue(tx1.receipt.status)
      const tx2 = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      assert.isTrue(tx1.receipt.status)
      const tx3 = await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })
      assert.isTrue(tx1.receipt.status)
      const tx4 = await poolManager.withdrawFromSPtoCDP(dennis, dennis, { from: dennis })
      assert.isTrue(tx1.receipt.status)
      const tx5 = await poolManager.withdrawFromSPtoCDP(erin, erin, { from: erin })
      assert.isTrue(tx1.receipt.status)
      const tx6 = await poolManager.withdrawFromSPtoCDP(flyn, flyn, { from: flyn })
      assert.isTrue(tx1.receipt.status)
    })

    it("withdrawFromSPToCDP(): All depositors withdraw, each withdraw their correct ETH gain", async () => {
      // Whale opens loan 
      await cdpManager.addColl(accounts[999], accounts[999], { from: whale, value: moneyVals._100_Ether })

      // Future defaulter opens loan
      await cdpManager.openLoan(moneyVals._100e18, accounts[0], { from: defaulter_1, value: moneyVals._1_Ether })

      // 6 Accounts open loans and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await cdpManager.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._1_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      await priceFeed.setPrice(moneyVals._100e18)
      await cdpManager.liquidate(defaulter_1)

      /* All depositors attempt to withdraw their ETH gain to their CDP. From a distribution of 1 ETH, each depositor 
      receives
      ETH Gain = 0.1666... ETH

      Thus, expected new collateral for each depositor with 1 Ether in their trove originally, is 1.1666... ETH
      */
      const expectedNewCollateral = web3.utils.toBN('1166666666666666666')

      await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      aliceColl = (await cdpManager.CDPs(alice))[1]
      assert.isAtMost(getDifference(aliceColl, expectedNewCollateral), 100)

      await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      bobColl = (await cdpManager.CDPs(bob))[1]
      assert.isAtMost(getDifference(bobColl, expectedNewCollateral), 100)

      await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })
      carolColl = (await cdpManager.CDPs(carol))[1]
      assert.isAtMost(getDifference(carolColl, expectedNewCollateral), 100)

      await poolManager.withdrawFromSPtoCDP(dennis, dennis, { from: dennis })
      dennisColl = (await cdpManager.CDPs(dennis))[1]
      assert.isAtMost(getDifference(dennisColl, expectedNewCollateral), 100)

      await poolManager.withdrawFromSPtoCDP(erin, erin, { from: erin })
      erinColl = (await cdpManager.CDPs(erin))[1]
      assert.isAtMost(getDifference(erinColl, expectedNewCollateral), 100)

      await poolManager.withdrawFromSPtoCDP(flyn, flyn, { from: flyn })
      flynColl = (await cdpManager.CDPs(flyn))[1]
      assert.isAtMost(getDifference(flynColl, expectedNewCollateral), 100)

    })

    it("offset(): increases S_ETH and S_CLV by correct amounts", async () => {
      // --- SETUP ---
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      // Whale opens CDP with 50 ETH, adds 2000 CLV to StabilityPool
      await cdpManager.addColl(whale, whale, { from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('2000000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('2000000000000000000000', { from: whale })
      // 2 CDPs opened, each withdraws 180 CLV
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV('180000000000000000000', defaulter_2, { from: defaulter_2 })

      const S_CLV_Before = await poolManager.S_CLV()
      const S_ETH_Before = await poolManager.S_ETH()
      const totalCLVDeposits = await stabilityPool.getTotalCLVDeposits()

      assert.equal(S_CLV_Before, 0)
      assert.equal(S_ETH_Before, 0)
      assert.equal(totalCLVDeposits, '2000000000000000000000')

      // price drops: defaulter's CDPs fall below MCR, whale doesn't
      await priceFeed.setPrice('100000000000000000000');
      // CDPs are closed
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      /*
      With 2000 CLV in StabilityPool, each closed CDP contributes:
      (180/2000) to S_CLV, i.e. 0.09 CLV
      (1/2000) to S_ETH, i.e. 0.0005 ETH
      */

      // Get accumulated rewards per unit staked
      const S_CLV_After = (await poolManager.S_CLV())   // expected: 0.18 CLV
      const S_ETH_After = (await poolManager.S_ETH())  // expected: 0.001 Ether

      assert.isAtMost(getDifference(S_CLV_After, '180000000000000000'), 100)  // 0.18 CLV
      assert.isAtMost(getDifference(S_ETH_After, '1000000000000000'), 100)  // 0.001 Ether
    })

    // --- Compounding tests ---

    // --- Identical deposits, identical liquidation amounts---
    it("Compounding: Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await cdpManager.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulter opens loan with 200% ICR
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Check depositors' compounded deposit is 33.33 CLV and ETH Gain is 0.33 ETH
      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      // assert.equal((await clvToken.balanceOf(alice)).toString(), '66666666666666666666')
      // assert.equal((await clvToken.balanceOf(bob)).toString(), '66666666666666666666')
      // assert.equal((await clvToken.balanceOf(carol)).toString(), '66666666666666666666')

      assert.equal(alice_ETHWithdrawn, '333333333333333333')
      assert.equal(bob_ETHWithdrawn, '333333333333333333')
      assert.equal(carol_ETHWithdrawn, '333333333333333333')
    })

    it("Compounding: Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two identical liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await cdpManager.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Check depositors' compounded deposit is 33.33 CLV and ETH Gain is 0.66 ETH
      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.equal((await clvToken.balanceOf(alice)).toString(), '33333333333333333333')
      assert.equal((await clvToken.balanceOf(bob)).toString(), '33333333333333333333')
      assert.equal((await clvToken.balanceOf(carol)).toString(), '33333333333333333333')

      assert.equal(alice_ETHWithdrawn, '666666666666666666')
      assert.equal(bob_ETHWithdrawn, '666666666666666666')
      assert.equal(carol_ETHWithdrawn, '666666666666666666')
    })

    it("Compounding:  Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three identical liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await cdpManager.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Check depositors' compounded deposit is 0 CLV and ETH Gain is 1 ETH
      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.equal((await clvToken.balanceOf(alice)).toString(), '0')
      assert.equal((await clvToken.balanceOf(bob)).toString(), '0')
      assert.equal((await clvToken.balanceOf(carol)).toString(), '0')

      assert.equal(alice_ETHWithdrawn, '1000000000000000000')
      assert.equal(bob_ETHWithdrawn, '1000000000000000000')
      assert.equal(carol_ETHWithdrawn, '1000000000000000000')
    })

    // --- Identical deposits, increasing liquidation amounts ---
    it("Compounding: Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two liquidations of increasing CLV", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await cdpManager.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: '100000000000000000' })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: '200000000000000000' })
      await cdpManager.withdrawCLV(moneyVals._10e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._20e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Check depositors' compounded deposit is 0 CLV and ETH Gain is 1 ETH
      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      // assert.equal((await clvToken.balanceOf(alice)).toString(), '90000000000000000000')
      // assert.equal((await clvToken.balanceOf(bob)).toString(), '90000000000000000000')
      // assert.equal((await clvToken.balanceOf(carol)).toString(), '90000000000000000000')

      assert.equal(alice_ETHWithdrawn, '100000000000000000')
      assert.equal(bob_ETHWithdrawn, '100000000000000000')
      assert.equal(carol_ETHWithdrawn, '100000000000000000')
    })

    it("Compounding: Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three liquidations of increasing CLV", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await cdpManager.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: '100000000000000000' })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: '200000000000000000' })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: '300000000000000000' })
      await cdpManager.withdrawCLV(moneyVals._10e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._20e18, defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV(moneyVals._30e18, defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Check depositors' compounded deposit is 80 CLV and ETH Gain is 0.2 ETH
      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.equal((await clvToken.balanceOf(alice)).toString(), '80000000000000000000')
      assert.equal((await clvToken.balanceOf(bob)).toString(), '80000000000000000000')
      assert.equal((await clvToken.balanceOf(carol)).toString(), '80000000000000000000')

      assert.equal(alice_ETHWithdrawn, '200000000000000000')
      assert.equal(bob_ETHWithdrawn, '200000000000000000')
      assert.equal(carol_ETHWithdrawn, '200000000000000000')
    })

    // --- Increasing deposits, identical liquidation amounts ---
    it("Compounding: Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after two identical liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      // Alice deposits 100, Bob deposits 200, Carol deposits 300 CLV
      await cdpManager.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await cdpManager.openLoan(moneyVals._200e18, bob, { from: bob, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._200e18, { from: bob })

      await cdpManager.openLoan(moneyVals._300e18, carol, { from: carol, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._300e18, { from: carol })

      // 2 Defaulters open loan with 200% ICR
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(moneyVals._200e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._300e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.equal((await clvToken.balanceOf(alice)).toString(), '66666666666666666666')
      assert.equal((await clvToken.balanceOf(bob)).toString(), '133333333333333333333')
      assert.equal((await clvToken.balanceOf(carol)).toString(), '200000000000000000000')

      assert.equal(alice_ETHWithdrawn, '333333333333333333')
      assert.equal(bob_ETHWithdrawn, '666666666666666666')
      assert.equal(carol_ETHWithdrawn, '1000000000000000000')
    })

    it("Compounding: Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three identical liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      // Alice deposits 100, Bob deposits 200, Carol deposits 300 CLV
      await cdpManager.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      await cdpManager.openLoan(moneyVals._200e18, bob, { from: bob, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._200e18, { from: bob })

      await cdpManager.openLoan(moneyVals._300e18, carol, { from: carol, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._300e18, { from: carol })

      // Defaulters open loan with 200% ICR
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(moneyVals._200e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._300e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.equal((await clvToken.balanceOf(alice)).toString(), '50000000000000000000')
      assert.equal((await clvToken.balanceOf(bob)).toString(), '100000000000000000000')
      assert.equal((await clvToken.balanceOf(carol)).toString(), '150000000000000000000')

      assert.equal(alice_ETHWithdrawn, '500000000000000000')
      assert.equal(bob_ETHWithdrawn, '1000000000000000000')
      assert.equal(carol_ETHWithdrawn, '1500000000000000000')
    })

    // --- Varied depoosits and varied liquidation amount ---
    it("Compounding: Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three varying liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      /* Depositors provide:-
      Alice:  20 CLV
      Bob:  4560 CLV
      Carol: 131 CLV */
      await cdpManager.openLoan('20000000000000000000', alice, { from: alice, value: moneyVals._100_Ether })
      await poolManager.provideToSP('20000000000000000000', { from: alice })

      await cdpManager.openLoan('4560000000000000000000', bob, { from: bob, value: moneyVals._100_Ether })
      await poolManager.provideToSP('4560000000000000000000', { from: bob })

      await cdpManager.openLoan('131000000000000000000', carol, { from: carol, value: moneyVals._100_Ether })
      await poolManager.provideToSP('131000000000000000000', { from: carol })


      /* Defaulters open loans

      Defaulter 1: 2110 CLV & 22 ETH  
      Defaulter 2: 10 CLV & 0.1 ETH  
      Defaulter 3: 467 CLV & 5 ETH
      */
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._22_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: '100000000000000000' })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._5_Ether })
      await cdpManager.withdrawCLV('2110000000000000000000', defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV('10000000000000000000', defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV('467000000000000000000', defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await poolManager.withdrawFromSP(moneyVals._5000e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(moneyVals._5000e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._5000e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.equal((await clvToken.balanceOf(alice)).toString(), '9017193801740610000')
      assert.equal((await clvToken.balanceOf(bob)).toString(), '2055920186796860000000')
      assert.equal((await clvToken.balanceOf(carol)).toString(), '59062619401401000000')

      assert.equal(alice_ETHWithdrawn, '115049883251961100')
      assert.equal(bob_ETHWithdrawn, '26231373381447700000')
      assert.equal(carol_ETHWithdrawn, '753576735300360000')
    })

    // --- Deposit enters at t > 0

    it("Compounding, A, B, C Deposit -> 2 liquidations -> D deposits -> 1 liquidation. All deposits and liquidations = 100 CLV.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await cdpManager.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis opens a loan and provides to SP
      await cdpManager.openLoan(moneyVals._100e18, dennis, { from: dennis, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: dennis })

      // Third defaulter liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });

      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })
      const txD = await poolManager.withdrawFromSP(moneyVals._100e18, { from: dennis })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()

      assert.equal((await clvToken.balanceOf(alice)).toString(), '16666666666666666666')
      assert.equal((await clvToken.balanceOf(bob)).toString(), '16666666666666666666')
      assert.equal((await clvToken.balanceOf(carol)).toString(), '16666666666666666666')

      assert.equal((await clvToken.balanceOf(dennis)).toString(), '50000000000000000000')

      assert.equal(alice_ETHWithdrawn, '833333333333333333')
      assert.equal(bob_ETHWithdrawn, '833333333333333333')
      assert.equal(carol_ETHWithdrawn, '833333333333333333')

      assert.equal(dennis_ETHWithdrawn, '500000000000000000')
    })

    it("Compounding, A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. All deposits and liquidations = 100 CLV.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await cdpManager.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: _1_Ether })
      await cdpManager.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_3, { from: defaulter_3 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis opens a loan and provides to SP
      await cdpManager.openLoan(moneyVals._100e18, dennis, { from: dennis, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: dennis })

      // Third and fourth defaulters liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });
      await cdpManager.liquidate(defaulter_4, { from: owner });

      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })
      const txD = await poolManager.withdrawFromSP(moneyVals._100e18, { from: dennis })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()

      assert.equal((await clvToken.balanceOf(alice)).toString(), '0')
      assert.equal((await clvToken.balanceOf(bob)).toString(), '0')
      assert.equal((await clvToken.balanceOf(carol)).toString(), '0')
      assert.equal((await clvToken.balanceOf(dennis)).toString(), '0')

      assert.equal(alice_ETHWithdrawn, moneyVals._1_Ether)
      assert.equal(bob_ETHWithdrawn, moneyVals._1_Ether)
      assert.equal(carol_ETHWithdrawn, moneyVals._1_Ether)
      assert.equal(dennis_ETHWithdrawn, moneyVals._1_Ether)
    })

    it("Compounding, A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. Various deposit and liquidation vals.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      /* Depositors open loans and make SP deposit:
      Alice: 600 CLV
      Bob: 200 CLV
      Carol: 150 CLV
      */
      await cdpManager.openLoan(moneyVals._600e18, alice, { from: alice, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._600e18, { from: alice })

      await cdpManager.openLoan(moneyVals._200e18, bob, { from: bob, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._200e18, { from: bob })

      await cdpManager.openLoan(moneyVals._150e18, carol, { from: carol, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._150e18, { from: carol })

      /* Defaulters open loans:
      Defaulter 1:  100 CLV, 1 ETH
      Defaulter 2:  250 CLV, 2.5 ETH
      Defaulter 3:  50 CLV, 0.5 ETH
      Defaulter 4:  400 CLV, 4 ETH
      */
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: '2500000000000000000' })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: '500000000000000000' })
      await cdpManager.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: moneyVals._4_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._250e18, defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV(moneyVals._50e18, defaulter_3, { from: defaulter_3 })
      await cdpManager.withdrawCLV(moneyVals._400e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis opens a loan and provides 250 CLV
      await cdpManager.openLoan(moneyVals._250e18, dennis, { from: dennis, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._250e18, { from: dennis })

      // Last two defaulters liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });
      await cdpManager.liquidate(defaulter_4, { from: owner });

      // Each depositor withdraws as much as possible
      const txA = await poolManager.withdrawFromSP(moneyVals._5000e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(moneyVals._5000e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._5000e18, { from: carol })
      const txD = await poolManager.withdrawFromSP(moneyVals._5000e18, { from: dennis })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()

      assert.equal((await clvToken.balanceOf(alice)).toString(), '178328173374613000000')
      assert.equal((await clvToken.balanceOf(bob)).toString(), '59442724458204300000')
      assert.equal((await clvToken.balanceOf(carol)).toString(), '44582043343653200000')
      assert.equal((await clvToken.balanceOf(dennis)).toString(), '117647058823529000000')

      assert.equal(alice_ETHWithdrawn, '4216718266253870000')
      assert.equal(bob_ETHWithdrawn, '1405572755417960000')
      assert.equal(carol_ETHWithdrawn, '1054179566563470000')
      assert.equal(dennis_ETHWithdrawn, '1323529411764710000')
    })

    // --- Depositor leaves ---

    it("Compounding, A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. All deposits and liquidations = 100 CLV.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, carol, dennis]
      for (account of depositors) {
        await cdpManager.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _1_Ether })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: _1_Ether })
      await cdpManager.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: _1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_3, { from: defaulter_3 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis withdraws his deposit and ETH gain
      const txD = await poolManager.withdrawFromSP(moneyVals._100e18, { from: dennis })

      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()
      assert.equal((await clvToken.balanceOf(dennis)).toString(), '50000000000000000000')
      assert.equal(dennis_ETHWithdrawn, '500000000000000000')

      // Two more defaulters are liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });
      await cdpManager.liquidate(defaulter_4, { from: owner });

      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.equal((await clvToken.balanceOf(alice)).toString(), '0')
      assert.equal((await clvToken.balanceOf(bob)).toString(), '0')
      assert.equal((await clvToken.balanceOf(carol)).toString(), '0')

      assert.equal(alice_ETHWithdrawn, moneyVals._1_Ether)
      assert.equal(bob_ETHWithdrawn, moneyVals._1_Ether)
      assert.equal(carol_ETHWithdrawn, moneyVals._1_Ether)
    })

    it("Compounding, A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. Various deposit and liquidation vals. A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      /* Initial deposits:
      Alice: 200 CLV
      Bob: 250 CLV
      Carol: 125 CLV
      Dennis: 400 CLV
      */
      await cdpManager.openLoan(moneyVals._200e18, alice, { from: alice, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._200e18, { from: alice })

      await cdpManager.openLoan(moneyVals._250e18, bob, { from: bob, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._250e18, { from: bob })

      await cdpManager.openLoan(moneyVals._125e18, carol, { from: carol, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._125e18, { from: carol })

      await cdpManager.openLoan(moneyVals._400e18, dennis, { from: dennis, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._400e18, { from: dennis })

      /* Defaulters open loans:
      Defaulter 1: 100 CLV
      Defaulter 1: 200 CLV
      Defaulter 1: 300 CLV
      Defaulter 1: 50 CLV
      */
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._2_Ether })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._3_Ether })
      await cdpManager.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: '500000000000000000' })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._200e18, defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV(moneyVals._300e18, defaulter_3, { from: defaulter_3 })
      await cdpManager.withdrawCLV(moneyVals._50e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis withdraws his deposit and ETH gain
      const txD = await poolManager.withdrawFromSP(moneyVals._5000e18, { from: dennis })

      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()
      // assert.equal((await clvToken.balanceOf(dennis)).toString(),  '276923076923077000000')
      // assert.equal(dennis_ETHWithdrawn,  '1230769230769230000')

      // Two more defaulters are liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });
      await cdpManager.liquidate(defaulter_4, { from: owner });

      const txA = await poolManager.withdrawFromSP(moneyVals._5000e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(moneyVals._5000e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._5000e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.equal((await clvToken.balanceOf(alice)).toString(), '16722408026755900000')
      assert.equal((await clvToken.balanceOf(bob)).toString(), '20903010033444800000')
      assert.equal((await clvToken.balanceOf(carol)).toString(), '10451505016722400000')

      assert.equal(alice_ETHWithdrawn, '1832775919732440000')
      assert.equal(bob_ETHWithdrawn, '2290969899665550000')
      assert.equal(carol_ETHWithdrawn, '1145484949832780000')
    })

    // One deposit enters at t > 0, and another leaves later
    it.only("Compounding, A, B, D deposit -> 2 liquidations -> C makes deposit -> 1 liquidation -> D withdraws -> 1 liquidation. All deposits: 100 CLV. Liquidations: 100,100,100,50.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      const depositors = [alice, bob, dennis]
      for (account of depositors) {
        await cdpManager.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulters open loans
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._1_Ether })
      await cdpManager.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: '500000000000000000' })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_3, { from: defaulter_3 })
      await cdpManager.withdrawCLV(moneyVals._50e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Carol makes deposit
      await cdpManager.openLoan(moneyVals._100e18, carol, { from: carol, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Dennis withdraws his deposit and ETH gain
      const txD = await poolManager.withdrawFromSP(moneyVals._100e18, { from: dennis })

      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()
      // assert.equal((await clvToken.balanceOf(dennis)).toString(), '16666666666666666666')
      // assert.equal(dennis_ETHWithdrawn, '833333333333333333')

      await cdpManager.liquidate(defaulter_4, { from: owner });

      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()

      assert.equal((await clvToken.balanceOf(alice)).toString(), '6666666666666666666')
      assert.equal((await clvToken.balanceOf(bob)).toString(), '6666666666666666666')
      assert.equal((await clvToken.balanceOf(carol)).toString(), '20000000000000000000')

      assert.equal(alice_ETHWithdrawn, '933333333333333333')
      assert.equal(bob_ETHWithdrawn, '933333333333333333')
      assert.equal(carol_ETHWithdrawn, '800000000000000000')
    })

    // --- Pool empties to 0 ---

    // A, B deposit 100
    // L1 cancels 200, 2
    // C, D deposit 100
    // L2 cancels 100,1 

    // A, B withdraw 0c & 1e
    // C, D withdraw 50c  & 0.5e
    it("Compounding: Depositors withdraw correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      // Alice, Bob each deposit 100 CLV
      const depositors_1 = [alice, bob]
      for (account of depositors_1) {
        await cdpManager.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // 2 Defaulters open loan with 200% ICR
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._2_Ether })
      await cdpManager.withdrawCLV(moneyVals._200e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_1 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter 1 liquidated. 200 CLV fully offset with pool.
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis each deposit 100 CLV
      const depositors_2 = [carol, dennis]
      for (account of depositors_2) {
        await cdpManager.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // Defaulter 2 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_2, { from: owner });

      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })
      const txD = await poolManager.withdrawFromSP(moneyVals._100e18, { from: dennis })

      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()

      // Expect Alice And Bob's compounded deposit to be 0 CLV
      assert.equal((await clvToken.balanceOf(alice)).toString(), '0')
      assert.equal((await clvToken.balanceOf(bob)).toString(), '0')

      // Expect Carol And Dennis' compounded deposit to be 50 CLV
      assert.equal((await clvToken.balanceOf(carol)).toString(), '50000000000000000000')
      assert.equal((await clvToken.balanceOf(dennis)).toString(), '50000000000000000000')

      // Expect Alice and Bob's ETH Gain to be 1 ETH
      assert.equal(alice_ETHWithdrawn, moneyVals._1_Ether)
      assert.equal(bob_ETHWithdrawn, moneyVals._1_Ether)

      // Expect Carol and and Dennis ETH Gain to be 0.5 ETH
      assert.equal(carol_ETHWithdrawn, '500000000000000000')
      assert.equal(dennis_ETHWithdrawn, '500000000000000000')
    })

    it("Compounding: Depositors withdraw correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      // Alice, Bob each deposit 100 CLV
      const depositors_1 = [alice, bob]
      for (account of depositors_1) {
        await cdpManager.openLoan(moneyVals._100e18, account, { from: account, value: moneyVals._2_Ether })
        await poolManager.provideToSP(moneyVals._100e18, { from: account })
      }

      // 2 Defaulters open loan with 200% ICR
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._2_Ether })
      await cdpManager.withdrawCLV(moneyVals._200e18, defaulter_1, { from: defaulter_1 })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_1 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter 1 liquidated. 200 CLV fully offset with pool.
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis, Erin each deposit 100, 200, 300 CLV respectively
      await cdpManager.openLoan(moneyVals._100e18, carol, { from: carol, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      await cdpManager.openLoan(moneyVals._200e18, dennis, { from: dennis, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._200e18, { from: dennis })

      await cdpManager.openLoan(moneyVals._300e18, erin, { from: erin, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._300e18, { from: erin })

      // Defaulter 2 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_2, { from: owner });

      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })
      const txD = await poolManager.withdrawFromSP(moneyVals._200e18, { from: dennis })
      const txE = await poolManager.withdrawFromSP(moneyVals._300e18, { from: erin })

      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[1].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[1].args[1].toString()
      const erin_ETHWithdrawn = txE.logs[1].args[1].toString()

      // Expect Alice And Bob's compounded deposit to be 0 CLV
      assert.equal((await clvToken.balanceOf(alice)).toString(), '0')
      assert.equal((await clvToken.balanceOf(bob)).toString(), '0')

      assert.equal((await clvToken.balanceOf(carol)).toString(),   '83333333333333333333')
      assert.equal((await clvToken.balanceOf(dennis)).toString(), '166666666666666666666')
      assert.equal((await clvToken.balanceOf(erin)).toString(),   '250000000000000000000')

      // Expect Alice and Bob's ETH Gain to be 1 ETH
      assert.equal(alice_ETHWithdrawn, moneyVals._1_Ether)
      assert.equal(bob_ETHWithdrawn, moneyVals._1_Ether)

      assert.equal(carol_ETHWithdrawn,  '166666666666666666')
      assert.equal(dennis_ETHWithdrawn, '333333333333333333')
      assert.equal(erin_ETHWithdrawn,   '500000000000000000')
    })

    // --- Scale factor tests
    // A deposits 100
    // L1 brings P close to boundary, i.e. 1e-18 - 99.9999999?
    // A withdraws all
    // B deposits 100
    // L2 brings of 90, should bring P slightly past boundary i.e. 1e-18 -> 1e-19

    // expect d(B) = d0(B)/10
    // expect correct ETH gain, i.e. all of the reward
    it("Compounding: Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      await cdpManager.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })
      
      // Defaulter 1 withdraws 'almost' 100 CLV
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _1_Ether })
      await cdpManager.withdrawCLV('99999999999999999000', defaulter_1, { from: defaulter_1 })
      
      // Defaulter 2 withdraws 90 CLV
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: '500000000000000000' })
      await cdpManager.withdrawCLV(moneyVals._90e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });

      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
     
      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[1].args[1].toString()
     
      console.log(`P_CLV is ${await poolManager.P_CLV()}`)
      // assert.equal((await clvToken.balanceOf(alice)).toString(), '1')
      console.log(await clvToken.balanceOf(alice).toString())
      console.log(alice_ETHWithdrawn)

      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      await cdpManager.liquidate(defaulter_2, { from: owner });

      console.log(`P_CLV after L2 is ${await poolManager.P_CLV()}`)

      console.log(`scale: ${await poolManager.scale()}`)
      console.log(`sum at scale 0: ${await poolManager.scaleToSum(0)}`)
      console.log(`sum at scale 1: ${await poolManager.scaleToSum(1)}`)
      const txB = await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      const bob_ETHWithdrawn = txB.logs[1].args[1].toString()
     
      // assert.equal((await clvToken.balanceOf(bob)).toString(), '10000000000000000000')
      assert.equal(bob_ETHWithdrawn, '500000000000000000')

      // assert.equal(carol_ETHWithdrawn, '333333333333333333')
    })
  })
})


contract('Reset chain state', async accounts => { })