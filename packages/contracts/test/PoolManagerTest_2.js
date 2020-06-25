const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th = testHelpers.TestHelper
const mv = testHelpers.MoneyValues

contract('PoolManager', async accounts => {

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
  let borrowerOperations

  let gasPriceInWei


  describe("Stability Pool Mechanisms", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
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

    // increases recorded CLV at Stability Pool
    it("provideToSP(): increases the Stability Pool CLV balance", async () => {
      // --- SETUP --- Give Alice 200 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(200, alice, { from: alice })

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
      await borrowerOperations.addColl(alice, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(200, alice, { from: alice })

      // --- TEST ---
      // check user's deposit record before
      const alice_depositRecord_Before = await poolManager.initialDeposits(alice)
      assert.equal(alice_depositRecord_Before, 0)

      // provideToSP()
      await poolManager.provideToSP(200, { from: alice })

      // check user's deposit record after
      const alice_depositRecord_After = await poolManager.initialDeposits(alice)
      assert.equal(alice_depositRecord_After, 200)
    })

    it("provideToSP(): reduces the user's CLV balance by the correct amount", async () => {
      // --- SETUP --- Give Alice 200 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(200, alice, { from: alice })

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
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._50_Ether })
      await borrowerOperations.withdrawCLV('2000000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('2000000000000000000000', { from: whale })

      const totalCLVDeposits = await stabilityPool.getCLV()
      assert.equal(totalCLVDeposits, '2000000000000000000000')
    })

    it('provideToSP(): Correctly updates user snapshots of accumulated rewards per unit staked', async () => {
      // --- SETUP ---

      // Whale opens CDP with 50 ETH, adds 2000 CLV to StabilityPool
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._50_Ether })
      await borrowerOperations.withdrawCLV('2000000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('2000000000000000000000', { from: whale })
      // 2 CDPs opened, each withdraws 180 CLV
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_2, { from: defaulter_2 })

      // Alice makes CDP and withdraws 100 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(100, alice, { from: alice })

      // price drops: defaulter's CDPs fall below MCR, whale doesn't
      await priceFeed.setPrice('100000000000000000000');

      // CDPs are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // --- TEST ---
      const P = (await poolManager.P())  // expected: 0.18 CLV
      const S = (await poolManager.epochToScaleToSum(0, 0))  // expected: 0.001 Ether


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
      const alice_snapshotETH_After = alice_snapshot_After[0].toString()
      const alice_snapshotCLV_After = alice_snapshot_After[1].toString()

      assert.equal(alice_snapshotETH_After, S)
      assert.equal(alice_snapshotCLV_After, P)
    })

    it("provideToSP(), multiple deposits: updates user's deposit and snapshots", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })
      await borrowerOperations.withdrawCLV('1850000000000000000000', alice, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 3 CDPs opened. Two users withdraw 180 CLV each
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_3, { from: defaulter_3 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value: mv._10_Ether })
      await borrowerOperations.withdrawCLV('150000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('150000000000000000000', { from: alice })

      const alice_Snapshot_0 = await poolManager.snapshot(alice)
      const alice_Snapshot_S_0 = alice_Snapshot_0[0]
      const alice_Snapshot_P_0 = alice_Snapshot_0[1]
      assert.equal(alice_Snapshot_S_0, 0)
      assert.equal(alice_Snapshot_P_0, '1000000000000000000')

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.liquidate(defaulter_2, { from: owner }) // 180 CLV closed

      const alice_compoundedDeposit_1 = await poolManager.getCompoundedCLVDeposit(alice)

      // Alice makes deposit #2:  100CLV
      const alice_topUp_1 = web3.utils.toBN('100000000000000000000')
      await borrowerOperations.withdrawCLV(alice_topUp_1, alice, { from: alice })
      await poolManager.provideToSP(alice_topUp_1, { from: alice })

      const alice_newDeposit_1 = (await poolManager.initialDeposits(alice)).toString()
      assert.equal(alice_compoundedDeposit_1.add(alice_topUp_1), alice_newDeposit_1)

      // get system reward terms
      const P_1 = (await poolManager.P()).toString()
      const S_1 = (await poolManager.epochToScaleToSum(0, 0)).toString()

      // check Alice's new snapshot is correct
      const alice_Snapshot_1 = await poolManager.snapshot(alice)
      const alice_Snapshot_S_1 = alice_Snapshot_1[0].toString()
      const alice_Snapshot_P_1 = alice_Snapshot_1[1].toString()
      assert.equal(alice_Snapshot_S_1, S_1)
      assert.equal(alice_Snapshot_P_1, P_1)

      // Bob withdraws CLV and deposits to StabilityPool, bringing total deposits to: (1850 + 223 + 427) = 2500 CLV
      await borrowerOperations.addColl(bob, bob, { from: bob, value: mv._50_Ether })
      await borrowerOperations.withdrawCLV('427000000000000000000', bob, { from: bob })
      await poolManager.provideToSP('427000000000000000000', { from: bob })

      // Defaulter 3 CDP is closed
      await cdpManager.liquidate(defaulter_3, { from: owner })

      const alice_compoundedDeposit_2 = await poolManager.getCompoundedCLVDeposit(alice)

      const P_2 = (await poolManager.P()).toString()
      const S_2 = (await poolManager.epochToScaleToSum(0, 0)).toString()

      // Alice makes deposit #3:  100CLV
      await borrowerOperations.withdrawCLV('100000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('100000000000000000000', { from: alice })

      // check Alice's new snapshot is correct
      const alice_Snapshot_2 = await poolManager.snapshot(alice)
      const alice_Snapshot_S_2 = alice_Snapshot_2[0].toString()
      const alice_Snapshot_P_2 = alice_Snapshot_2[1].toString()
      assert.equal(alice_Snapshot_S_2, S_2)
      assert.equal(alice_Snapshot_P_2, P_2)
    })

    // --- withdrawFromSP ---

    it("withdrawFromSP(): reverts when user has no active deposit", async () => {
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._10_Ether })
      await borrowerOperations.openLoan(mv._100e18, bob, { from: bob, value: mv._10_Ether })

      await poolManager.provideToSP(mv._100e18, {from: alice})

      const alice_initialDeposit = (await poolManager.initialDeposits(alice)).toString()
      const bob_initialDeposit = (await poolManager.initialDeposits(bob)).toString()

      assert.equal(alice_initialDeposit, mv._100e18)
      assert.equal(bob_initialDeposit,'0')

      const txAlice = await poolManager.withdrawFromSP(mv._100e18, {from: alice})
      assert.isTrue(txAlice.receipt.status)


      try {
        const txBob = await poolManager.withdrawFromSP(mv._100e18, {from: bob})
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "User must have a non-zero deposit")
        
      }
    })

    it("withdrawFromSP(): partial retrieval - retrieves correct CLV amount and the entire ETH Gain, and updates deposit", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._50_Ether })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 2 CDPs opened, 180 CLV withdrawn
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_2, { from: defaulter_2 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value: mv._10_Ether })
      await borrowerOperations.withdrawCLV('150000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('150000000000000000000', { from: alice })

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.liquidate(defaulter_2, { from: owner }) // 180 CLV closed

      // Alice retrieves part of her entitled CLV: 90 CLV
      await poolManager.withdrawFromSP('90000000000000000000', { from: alice })

      /* Alice's CLVLoss = (0.18 * 150) = 27 CLV. Her remaining deposit should be:
      oldDeposit - CLVLoss - withdrawalAmount, i.e:
      150 - 27 - 90 = 33 CLV  */

      // check Alice's deposit has been updated to 33 CLV */
      const newDeposit = (await poolManager.initialDeposits(alice)).toString()
      assert.isAtMost(th.getDifference(newDeposit, '33000000000000000000'), 1000)

      // Expect Alice has withdrawn all ETH gain
      const alice_pendingETHGain = await poolManager.getCurrentETHGain(alice)
      assert.equal(alice_pendingETHGain, 0)
    })

    it("withdrawFromSP(): partial retrieval - leaves the correct amount of CLV in the Stability Pool", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._50_Ether })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 2 CDPs opened, 180 CLV withdrawn
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_2, { from: defaulter_2 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value: mv._10_Ether })
      await borrowerOperations.withdrawCLV('150000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('150000000000000000000', { from: alice })

      const SP_CLV_Before = await stabilityPool.getCLV()
      assert.equal(SP_CLV_Before, mv._2000e18)

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.liquidate(defaulter_2, { from: owner }) // 180 CLV closed

      // Alice retrieves part of her entitled CLV: 90 CLV
      await poolManager.withdrawFromSP('90000000000000000000', { from: alice })

      /* Check SP has reduced from liquidations (2*180) and Alice's withdrawal (90)
      Expect CLV in SP = (2000 - 180 - 180 - 90) = 1550 CLV */

      const SP_CLV_After = await stabilityPool.getCLV()
      assert.equal(SP_CLV_After, '1550000000000000000000')
    })

    it("withdrawFromSP(): full retrieval - leaves the correct amount of CLV in the Stability Pool", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._50_Ether })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 2 CDPs opened, 180 CLV withdrawn
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_2, { from: defaulter_2 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value: mv._10_Ether })
      await borrowerOperations.withdrawCLV('150000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('150000000000000000000', { from: alice })

      const SP_CLV_Before = await stabilityPool.getCLV()
      assert.equal(SP_CLV_Before, mv._2000e18)

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.liquidate(defaulter_2, { from: owner }) // 180 CLV closed

      // Alice retrieves all of her entitled CLV:
      await poolManager.withdrawFromSP('150000000000000000000', { from: alice })

      /* Alice's CLVLoss = (0.18 * 150) = 27 CLV. Her withdrawable deposit should be (150-27) = 123 CLV
  
     Expect CLV in SP = (2000 - 180 - 180 - 123) = 1517 CLV */

      const SP_CLV_After = await stabilityPool.getCLV()
      assert.isAtMost(th.getDifference(SP_CLV_After, '1517000000000000000000'), 1000)
    })

    it("withdrawFromSP(): Subsequent deposit and withdrawal attempt from same account, with no intermediate liquidations, withdraws zero ETH", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      await borrowerOperations.openLoan('1850000000000000000000', whale, { from: whale, value: mv._50_Ether })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 2 CDPs opened, 180 CLV withdrawn
      await borrowerOperations.openLoan('180000000000000000000', defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.openLoan('180000000000000000000', defaulter_2, { from: defaulter_2, value: mv._1_Ether })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.openLoan('150000000000000000000', alice, { from: alice, value: mv._1_Ether })
      await poolManager.provideToSP('150000000000000000000', { from: alice })

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.liquidate(defaulter_2, { from: owner }) // 180 CLV closed

      // Alice retrieves all of her entitled CLV:
      await poolManager.withdrawFromSP('150000000000000000000', { from: alice })
      assert.equal( await poolManager.getCurrentETHGain(alice), 0)

      await poolManager.provideToSP('100000000000000000000',  { from: alice })
      assert.equal( await poolManager.getCurrentETHGain(alice), 0)

      const ETHinSP_Before = (await stabilityPool.getETH()).toString()

      // Alice attempts second withdrawal
      await poolManager.withdrawFromSP('100000000000000000000', { from: alice })
      assert.equal( await poolManager.getCurrentETHGain(alice), 0)

      // Check ETH in pool does not change
      const ETHinSP_1 = (await stabilityPool.getETH()).toString()
      assert.equal(ETHinSP_Before, ETHinSP_1)
      
      await poolManager.provideToSP('100000000000000000000',  { from: alice })
      assert.equal( await poolManager.getCurrentETHGain(alice), 0)

      // Alice attempts third withdrawal (this time, frm SP to CDP)
      await poolManager.withdrawFromSPtoCDP(alice, alice,{ from: alice })

      // Check ETH in pool does not change
      const ETHinSP_2 = (await stabilityPool.getETH()).toString()
      assert.equal(ETHinSP_Before, ETHinSP_2)
    })

    it("withdrawFromSP(): it correctly updates the user's CLV and ETH snapshots of entitled reward per unit staked", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._50_Ether })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 2 CDPs opened, 180 CLV withdrawn
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_2, { from: defaulter_2 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value: mv._10_Ether })
      await borrowerOperations.withdrawCLV('150000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('150000000000000000000', { from: alice })

      // check 'Before' snapshots
      const alice_snapshot_Before = await poolManager.snapshot(alice)
      const alice_snapshot_S_Before = alice_snapshot_Before[0].toString()
      const alice_snapshot_P_Before = alice_snapshot_Before[1].toString()
      assert.equal(alice_snapshot_S_Before, 0)
      assert.equal(alice_snapshot_P_Before, '1000000000000000000')

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.liquidate(defaulter_2, { from: owner }); // 180 CLV closed

      // Alice retrieves part of her entitled CLV: 90 CLV
      await poolManager.withdrawFromSP('90000000000000000000', { from: alice })

      const P = (await poolManager.P()).toString()
      const S = (await poolManager.epochToScaleToSum(0, 0)).toString()
      // check 'After' snapshots
      const alice_snapshot_After = await poolManager.snapshot(alice)
      const alice_snapshot_S_After = alice_snapshot_After[0].toString()
      const alice_snapshot_P_After = alice_snapshot_After[1].toString()
      assert.equal(alice_snapshot_S_After, S)
      assert.equal(alice_snapshot_P_After, P)
    })

    it("withdrawFromSP(): decreases StabilityPool ETH", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._50_Ether })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value: mv._10_Ether })
      await borrowerOperations.withdrawCLV('150000000000000000000', alice, { from: alice })
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
      assert.isAtMost(th.getDifference(stability_ETH_Difference, '-75000000000000000'), 100)
    })

    // --- Tests that check any rounding error in accumulated CLVLoss in the SP "favors the Pool" ---

    it("withdrawFromSP(): All depositors are able to withdraw from the SP to their account", async () => {
      // Whale opens loan 
      await borrowerOperations.addColl(accounts[999], accounts[999], { from: whale, value: mv._100_Ether })

      // Future defaulter opens loan
      await borrowerOperations.openLoan(mv._100e18, accounts[0], { from: defaulter_1, value: mv._1_Ether })

      // 6 Accounts open loans and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._1_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      await priceFeed.setPrice(mv._100e18)
      await cdpManager.liquidate(defaulter_1)

      // All depositors attempt to withdraw
      await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      assert.equal((await poolManager.initialDeposits(alice)).toString(), '0')
      await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      assert.equal((await poolManager.initialDeposits(alice)).toString(), '0')
      await poolManager.withdrawFromSP(mv._100e18, { from: carol })
      assert.equal((await poolManager.initialDeposits(alice)).toString(), '0')
      await poolManager.withdrawFromSP(mv._100e18, { from: dennis })
      assert.equal((await poolManager.initialDeposits(alice)).toString(), '0')
      await poolManager.withdrawFromSP(mv._100e18, { from: erin })
      assert.equal((await poolManager.initialDeposits(alice)).toString(), '0')
      await poolManager.withdrawFromSP(mv._100e18, { from: flyn })
      assert.equal((await poolManager.initialDeposits(alice)).toString(), '0')

      const totalDeposits = (await stabilityPool.totalCLVDeposits()).toString()

      assert.isAtMost(th.getDifference(totalDeposits, '0'), 1000)
    })

    it("withdrawFromSP(): Each depositor withdraws a correct compounded deposit", async () => {
      // Whale opens loan 
      await borrowerOperations.addColl(accounts[999], accounts[999], { from: whale, value: mv._100_Ether })

      // Future defaulter opens loan
      await borrowerOperations.openLoan(mv._100e18, accounts[0], { from: defaulter_1, value: mv._1_Ether })

      // 6 Accounts open loans and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._1_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      await priceFeed.setPrice(mv._100e18)
      await cdpManager.liquidate(defaulter_1)

      /* All depositors attempt to withdraw.  From a distribution of 100 CLV, each depositor receives
      CLVLoss = 16.666666666666666666 CLV

      and thus with a deposit of 100 CLV, each should withdraw 83.333333333333333333 CLV (in practice, slightly less due to rounding error)
      */

      const expectedWithdrawnCLVAmount = web3.utils.toBN('83333333333333333333')

      await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      assert.isTrue((await clvToken.balanceOf(alice)).lte(expectedWithdrawnCLVAmount))
      await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      assert.isTrue((await clvToken.balanceOf(bob)).lte(expectedWithdrawnCLVAmount))
      await poolManager.withdrawFromSP(mv._100e18, { from: carol })
      assert.isTrue((await clvToken.balanceOf(carol)).lte(expectedWithdrawnCLVAmount))
      await poolManager.withdrawFromSP(mv._100e18, { from: dennis })
      assert.isTrue((await clvToken.balanceOf(dennis)).lte(expectedWithdrawnCLVAmount))
      await poolManager.withdrawFromSP(mv._100e18, { from: erin })
      assert.isTrue((await clvToken.balanceOf(erin)).lte(expectedWithdrawnCLVAmount))
      await poolManager.withdrawFromSP(mv._100e18, { from: flyn })
      assert.isTrue((await clvToken.balanceOf(flyn)).lte(expectedWithdrawnCLVAmount))

      const totalDeposits = (await stabilityPool.totalCLVDeposits()).toString()

      assert.isAtMost(th.getDifference(totalDeposits, '0'), 1000)
    })


    // --- withdrawFromSPtoCDP ---

    it("withdrawFromSPtoCDP(): reverts when user has no active deposit", async () => {
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._10_Ether })
      await borrowerOperations.openLoan(mv._100e18, bob, { from: bob, value: mv._10_Ether })

      await poolManager.provideToSP(mv._100e18, {from: alice})

      const alice_initialDeposit = (await poolManager.initialDeposits(alice)).toString()
      const bob_initialDeposit = (await poolManager.initialDeposits(bob)).toString()

      assert.equal(alice_initialDeposit, mv._100e18)
      assert.equal(bob_initialDeposit,'0')

      const txAlice = await poolManager.withdrawFromSPtoCDP(alice, alice, {from: alice})
      assert.isTrue(txAlice.receipt.status)

      try {
        const txBob = await poolManager.withdrawFromSPtoCDP(bob, bob, {from: bob})
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "User must have a non-zero deposit")
      }
    })

    it("withdrawFromSPtoCDP(): reverts when user passes an argument != their own addresss", async () => {
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._10_Ether })
      await borrowerOperations.openLoan(mv._100e18, bob, { from: bob, value: mv._10_Ether })
      await borrowerOperations.openLoan(mv._100e18, carol, { from: carol, value: mv._10_Ether })

      await poolManager.provideToSP(mv._100e18, {from: alice})
      await poolManager.provideToSP(mv._100e18, {from: bob})
      await poolManager.provideToSP(mv._100e18, {from: carol})

      const alice_initialDeposit = (await poolManager.initialDeposits(alice)).toString()
      const bob_initialDeposit = (await poolManager.initialDeposits(bob)).toString()
      const carol_initialDeposit = (await poolManager.initialDeposits(carol)).toString()

      assert.equal(alice_initialDeposit, mv._100e18)
      assert.equal(bob_initialDeposit, mv._100e18)
      assert.equal(carol_initialDeposit, mv._100e18)

      const txAlice = await poolManager.withdrawFromSPtoCDP(alice, alice, {from: alice})
      assert.isTrue(txAlice.receipt.status)

      try {
        const txBob = await poolManager.withdrawFromSPtoCDP(carol, bob, {from: bob})
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "A user may only withdraw ETH gains to their own trove")
      }
    })

    it("withdrawFromSPtoCDP(): Applies CLVLoss to user's deposit, and redirects ETH reward to user's CDP", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._50_Ether })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value: mv._10_Ether })
      await borrowerOperations.withdrawCLV('150000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('150000000000000000000', { from: alice })

      // check alice's CDP recorded ETH Before:
      const aliceCDP_Before = await cdpManager.CDPs(alice)
      const aliceCDP_ETH_Before = aliceCDP_Before[1]
      assert.equal(aliceCDP_ETH_Before, mv._10_Ether)

      // price drops: defaulter's CDP falls below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      /* defaulter's CDP is closed.
      / Alice's expected rewards:
      / CLV: 150 * 180/2000 = 13.5
      / ETH: 150 * 1/2000 = 0.075 */
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed

      // Alice sends her ETH Gains to her CDP
      await poolManager.withdrawFromSPtoCDP(alice, alice,{ from: alice })

      // check Alice's CLVLoss has been applied to her deposit - expect (150 - 13.5) = 136.5 CLV
      alice_deposit_afterDefault = (await poolManager.initialDeposits(alice))
      assert.isAtMost(th.getDifference(alice_deposit_afterDefault, '136500000000000000000'), 1000)

      // check alice's CDP recorded ETH has increased by the expected reward amount
      const aliceCDP_After = await cdpManager.CDPs(alice)
      const aliceCDP_ETH_After = aliceCDP_After[1]

      const CDP_ETH_Increase = (aliceCDP_ETH_After.sub(aliceCDP_ETH_Before)).toString()

      assert.equal(CDP_ETH_Increase, '75000000000000000') // expect gain of 0.075 Ether
    })

    it("withdrawFromSPtoCDP(): Subsequent deposit and withdrawal attempt from same account, with no intermediate liquidations, withdraws zero ETH", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      await borrowerOperations.openLoan('1850000000000000000000', whale, { from: whale, value: mv._50_Ether })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await borrowerOperations.openLoan('180000000000000000000', defaulter_1, { from: defaulter_1, value: mv._1_Ether })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value: mv._10_Ether })
      await borrowerOperations.withdrawCLV('150000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('150000000000000000000', { from: alice })

      // check alice's CDP recorded ETH Before:
      const aliceCDP_Before = await cdpManager.CDPs(alice)
      const aliceCDP_ETH_Before = aliceCDP_Before[1]
      assert.equal(aliceCDP_ETH_Before, mv._10_Ether)

      // price drops: defaulter's CDP falls below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // defaulter's CDP is closed.
      await cdpManager.liquidate(defaulter_1, { from: owner })  

      // Alice sends her ETH Gains to her CDP
      await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })

      assert.equal( await poolManager.getCurrentETHGain(alice), 0)

      const ETHinSP_Before = (await stabilityPool.getETH()).toString()

      // Alice attempts second withdrawal from SP to CDP
      await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      assert.equal( await poolManager.getCurrentETHGain(alice), 0)

      // Check ETH in pool does not change
      const ETHinSP_1 = (await stabilityPool.getETH()).toString()
      assert.equal(ETHinSP_Before, ETHinSP_1)
      
      // Alice attempts third withdrawal (this time, from SP to her own account)
      await poolManager.withdrawFromSP('150000000000000000000', { from: alice })

      // Check ETH in pool does not change
      const ETHinSP_2 = (await stabilityPool.getETH()).toString()
      assert.equal(ETHinSP_Before, ETHinSP_2)
      
    })

    it("withdrawFromSPtoCDP(): decreases StabilityPool ETH and increases activePool ETH", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._50_Ether })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value: mv._10_Ether })
      await borrowerOperations.withdrawCLV('150000000000000000000', alice, { from: alice })
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
      await poolManager.withdrawFromSPtoCDP(alice, alice,{ from: alice })

      const active_ETH_After = await activePool.getETH()
      const stability_ETH_After = await stabilityPool.getETH()

      const active_ETH_Difference = (active_ETH_After.sub(active_ETH_Before))
      const stability_ETH_Difference = (stability_ETH_After.sub(stability_ETH_Before))

      // check Pool ETH values change by Alice's ETHGain, i.e 0.075 ETH
      assert.isAtMost(th.getDifference(active_ETH_Difference, '75000000000000000'), 100)
      assert.isAtMost(th.getDifference(stability_ETH_Difference, '-75000000000000000'), 100)
    })

    it("withdrawFromSPtoCDP(): All depositors are able to withdraw their ETH gain from the SP to their CDP", async () => {
      // Whale opens loan 
      await borrowerOperations.addColl(accounts[999], accounts[999], { from: whale, value: mv._100_Ether })

      // Future defaulter opens loan
      await borrowerOperations.openLoan(mv._100e18, accounts[0], { from: defaulter_1, value: mv._1_Ether })

      // 6 Accounts open loans and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._1_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      await priceFeed.setPrice(mv._100e18)
      await cdpManager.liquidate(defaulter_1)

      // All depositors attempt to withdraw
      const tx1 = await poolManager.withdrawFromSPtoCDP(alice, alice,{ from: alice })
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
      await borrowerOperations.addColl(accounts[999], accounts[999], { from: whale, value: mv._100_Ether })

      // Future defaulter opens loan
      await borrowerOperations.openLoan(mv._100e18, accounts[0], { from: defaulter_1, value: mv._1_Ether })

      // 6 Accounts open loans and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._1_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      await priceFeed.setPrice(mv._100e18)
      await cdpManager.liquidate(defaulter_1)

      /* All depositors attempt to withdraw their ETH gain to their CDP. From a distribution of 1 ETH, each depositor 
      receives
      ETH Gain = 0.1666... ETH

      Thus, expected new collateral for each depositor with 1 Ether in their trove originally, is 1.1666... ETH
      */
      const expectedNewCollateral = web3.utils.toBN('1166666666666666666')

      await poolManager.withdrawFromSPtoCDP(alice, alice,{ from: alice })
      aliceColl = (await cdpManager.CDPs(alice))[1]
      assert.isAtMost(th.getDifference(aliceColl, expectedNewCollateral), 100)

      await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      bobColl = (await cdpManager.CDPs(bob))[1]
      assert.isAtMost(th.getDifference(bobColl, expectedNewCollateral), 100)

      await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })
      carolColl = (await cdpManager.CDPs(carol))[1]
      assert.isAtMost(th.getDifference(carolColl, expectedNewCollateral), 100)

      await poolManager.withdrawFromSPtoCDP(dennis, dennis, { from: dennis })
      dennisColl = (await cdpManager.CDPs(dennis))[1]
      assert.isAtMost(th.getDifference(dennisColl, expectedNewCollateral), 100)

      await poolManager.withdrawFromSPtoCDP(erin, erin, { from: erin })
      erinColl = (await cdpManager.CDPs(erin))[1]
      assert.isAtMost(th.getDifference(erinColl, expectedNewCollateral), 100)

      await poolManager.withdrawFromSPtoCDP(flyn, flyn, { from: flyn })
      flynColl = (await cdpManager.CDPs(flyn))[1]
      assert.isAtMost(th.getDifference(flynColl, expectedNewCollateral), 100)

    })

    it("offset(): increases S_ETH and S_CLV by correct amounts", async () => {
      // --- SETUP ---
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      // Whale opens CDP with 50 ETH, adds 2000 CLV to StabilityPool
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })
      await borrowerOperations.withdrawCLV('2000000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('2000000000000000000000', { from: whale })
      // 2 CDPs opened, each withdraws 100 CLV
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('100000000000000000000', defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV('100000000000000000000', defaulter_2, { from: defaulter_2 })

      const P_Before = await poolManager.P()
      const S_Before = await poolManager.epochToScaleToSum(0, 0)
      const totalCLVDeposits = await stabilityPool.getCLV()

      assert.equal(P_Before, '1000000000000000000')
      assert.equal(S_Before, 0)
      assert.equal(totalCLVDeposits, '2000000000000000000000')

      // price drops: defaulter's CDPs fall below MCR, whale doesn't
      await priceFeed.setPrice('100000000000000000000');
      // CDPs are closed
      const txL1 = await cdpManager.liquidate(defaulter_1, { from: owner });

      // console.log("P after L1:" + (await poolManager.P()))  
      // console.log("S after L1:" + (await poolManager.epochToScaleToSum(0,0)))  

      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });

      assert.isTrue(txL1.receipt.status)
      assert.isTrue(txL2.receipt.status)
      /*
      With 2000 CLV in StabilityPool, each closed CDP contributes 100CLV, 1 ETH.

      Starting vals:
      P = 1
      S = 0

      L1:
      S = S + (1/2000)*P = 0.0005
      P = P * (1-(100/2000)) = 0.95

      L2:
      S = S + (1/1900) * P = 0.0005 + 0.0005 = 0.001
      P = P * (1-(100/1900)) = 0.95 * 0.9473684210526316 = 0.9
      */

      // Get accumulated rewards per unit staked
      const P_After = (await poolManager.P())
      const S_After = (await poolManager.epochToScaleToSum(0, 0))

      // console.log("P after L2:" + P_After.toString())  
      // console.log("S after L2:" + S_After.toString()) 

      // console.log("total SP deposits after L2: " + (await stabilityPool.getCLV()).toString())
      // console.log(`${P_After}`)
      // console.log(`${S_After}`)

      assert.isAtMost(th.getDifference(P_After, '900000000000000000'), 1000)
    })
  })
})


contract('Reset chain state', async accounts => { })