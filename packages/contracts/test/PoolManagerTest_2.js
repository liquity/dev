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
      await poolManager.setCDPManager(cdpManager.address, { from: owner })
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

    it("provideToSP(): reverts if user tries to provide more than their CLV balance", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._10_Ether })

      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._50e18, bob, { from: bob, value: mv._1_Ether })

      // Alice, with balance 100 CLV, attempts to deposit 100.00000000000000000001 CLV
      try {
        aliceTx = await poolManager.provideToSP('10000000000000000000001', { from: alice })
        assert.isFalse(tx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      // Bob, with balance 50 CLV, attempts to deposit 235534 CLV
      try {
        bobTx = await poolManager.provideToSP('235534000000000000000000', { from: bob })
        assert.isFalse(tx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })

    it("provideToSP(): reverts if user tries to provide 2^256-1 CLV, which exceeds their balance", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._10_Ether })

      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._50e18, bob, { from: bob, value: mv._1_Ether })

      const maxBytes32 = web3.utils.toBN("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")

      // Alice, with balance 100 CLV, attempts to deposit 2^256-1 CLV CLV
      try {
        aliceTx = await poolManager.provideToSP(maxBytes32, { from: alice })
        assert.isFalse(tx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      // Bob, with balance 50 CLV, attempts to deposit 235534 CLV
      try {
        bobTx = await poolManager.provideToSP(maxBytes32, { from: bob })
        assert.isFalse(tx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })

    it("provideToSP(): doesn't impact other users' deposits or ETH gains", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

      // A, B, C open loans and make Stability Pool deposits
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })

      await poolManager.provideToSP(mv._100e18, { from: alice })
      await poolManager.provideToSP(mv._200e18, { from: bob })
      await poolManager.provideToSP(mv._300e18, { from: carol })

      // D opens a loan
      await borrowerOperations.openLoan(mv._100e18, dennis, { from: dennis, value: mv._4_Ether })

      // Would-be defaulters open loans
      await borrowerOperations.openLoan(mv._100e18, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._180e18, defaulter_2, { from: defaulter_2, value: mv._1_Ether })

      // Price drops
      await priceFeed.setPrice(mv._100e18)

      // Defaulters are liquidated
      await cdpManager.liquidate(defaulter_1)
      await cdpManager.liquidate(defaulter_2)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))
      assert.isFalse(await sortedCDPs.contains(defaulter_2))


      const alice_CLVDeposit_Before = (await poolManager.getCompoundedCLVDeposit(alice)).toString()
      const bob_CLVDeposit_Before = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
      const carol_CLVDeposit_Before = (await poolManager.getCompoundedCLVDeposit(carol)).toString()

      const alice_ETHGain_Before = (await poolManager.getCurrentETHGain(alice)).toString()
      const bob_ETHGain_Before = (await poolManager.getCurrentETHGain(bob)).toString()
      const carol_ETHGain_Before = (await poolManager.getCurrentETHGain(carol)).toString()

      //check non-zero CLV and ETHGain in the Stability Pool
      const CLVinSP = await stabilityPool.getCLV()
      const ETHinSP = await stabilityPool.getETH()
      assert.isTrue(CLVinSP.gt(mv._zeroBN))
      assert.isTrue(ETHinSP.gt(mv._zeroBN))

      // D makes an SP deposit
      await poolManager.provideToSP(mv._100e18, { from: dennis })
      assert.equal((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), mv._100e18)

      const alice_CLVDeposit_After = (await poolManager.getCompoundedCLVDeposit(alice)).toString()
      const bob_CLVDeposit_After = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
      const carol_CLVDeposit_After = (await poolManager.getCompoundedCLVDeposit(carol)).toString()

      const alice_ETHGain_After = (await poolManager.getCurrentETHGain(alice)).toString()
      const bob_ETHGain_After = (await poolManager.getCurrentETHGain(bob)).toString()
      const carol_ETHGain_After = (await poolManager.getCurrentETHGain(carol)).toString()

      // Check compounded deposits and ETH gains for A, B and C have not changed
      assert.equal(alice_CLVDeposit_Before, alice_CLVDeposit_After)
      assert.equal(bob_CLVDeposit_Before, bob_CLVDeposit_After)
      assert.equal(carol_CLVDeposit_Before, carol_CLVDeposit_After)

      assert.equal(alice_ETHGain_Before, alice_ETHGain_After)
      assert.equal(bob_ETHGain_Before, bob_ETHGain_After)
      assert.equal(carol_ETHGain_Before, carol_ETHGain_After)
    })

    it("provideToSP(): doesn't impact system debt, collateral or TCR", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

      // A, B, C open loans and make Stability Pool deposits
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })

      await poolManager.provideToSP(mv._100e18, { from: alice })
      await poolManager.provideToSP(mv._200e18, { from: bob })
      await poolManager.provideToSP(mv._300e18, { from: carol })

      // D opens a loan
      await borrowerOperations.openLoan(mv._100e18, dennis, { from: dennis, value: mv._4_Ether })

      // Would-be defaulters open loans
      await borrowerOperations.openLoan(mv._100e18, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._180e18, defaulter_2, { from: defaulter_2, value: mv._1_Ether })

      // Price drops
      await priceFeed.setPrice(mv._100e18)

      // Defaulters are liquidated
      await cdpManager.liquidate(defaulter_1)
      await cdpManager.liquidate(defaulter_2)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))
      assert.isFalse(await sortedCDPs.contains(defaulter_2))

      const activeDebt_Before = (await activePool.getCLVDebt()).toString()
      const defaultedDebt_Before = (await defaultPool.getCLVDebt()).toString()
      const activeColl_Before = (await activePool.getETH()).toString()
      const defaultedColl_Before = (await defaultPool.getETH()).toString()
      const TCR_Before = (await poolManager.getTCR()).toString()

      // D makes an SP deposit
      await poolManager.provideToSP(mv._100e18, { from: dennis })
      assert.equal((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), mv._100e18)

      const activeDebt_After = (await activePool.getCLVDebt()).toString()
      const defaultedDebt_After = (await defaultPool.getCLVDebt()).toString()
      const activeColl_After = (await activePool.getETH()).toString()
      const defaultedColl_After = (await defaultPool.getETH()).toString()
      const TCR_After = (await poolManager.getTCR()).toString()

      // Check total system debt, collateral and TCR have not changed after a Stability deposit is made
      assert.equal(activeDebt_Before, activeDebt_After)
      assert.equal(defaultedDebt_Before, defaultedDebt_After)
      assert.equal(activeColl_Before, activeColl_After)
      assert.equal(defaultedColl_Before, defaultedColl_After)
      assert.equal(TCR_Before, TCR_After)
    })

    it("provideToSP(): doesn't impact any troves, including the caller's trove", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

      // A, B, C open loans and make Stability Pool deposits
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })

      // A and B provide to SP
      await poolManager.provideToSP(mv._100e18, { from: alice })
      await poolManager.provideToSP(mv._200e18, { from: bob })

      // D opens a loan
      await borrowerOperations.openLoan(mv._100e18, dennis, { from: dennis, value: mv._4_Ether })

      // Price drops
      await priceFeed.setPrice(mv._100e18)
      const price = await priceFeed.getPrice()

      // Get debt, collateral and ICR of all existing troves
      const whale_Debt_Before = (await cdpManager.CDPs(whale))[0].toString()
      const alice_Debt_Before = (await cdpManager.CDPs(alice))[0].toString()
      const bob_Debt_Before = (await cdpManager.CDPs(bob))[0].toString()
      const carol_Debt_Before = (await cdpManager.CDPs(carol))[0].toString()
      const dennis_Debt_Before = (await cdpManager.CDPs(dennis))[0].toString()

      const whale_Coll_Before = (await cdpManager.CDPs(whale))[1].toString()
      const alice_Coll_Before = (await cdpManager.CDPs(alice))[1].toString()
      const bob_Coll_Before = (await cdpManager.CDPs(bob))[1].toString()
      const carol_Coll_Before = (await cdpManager.CDPs(carol))[1].toString()
      const dennis_Coll_Before = (await cdpManager.CDPs(dennis))[1].toString()

      const whale_ICR_Before = (await cdpManager.getCurrentICR(whale, price)).toString()
      const alice_ICR_Before = (await cdpManager.getCurrentICR(alice, price)).toString()
      const bob_ICR_Before = (await cdpManager.getCurrentICR(bob, price)).toString()
      const carol_ICR_Before = (await cdpManager.getCurrentICR(carol, price)).toString()
      const dennis_ICR_Before = (await cdpManager.getCurrentICR(dennis, price)).toString()

      // D makes an SP deposit
      await poolManager.provideToSP(mv._100e18, { from: dennis })
      assert.equal((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), mv._100e18)

      const whale_Debt_After = (await cdpManager.CDPs(whale))[0].toString()
      const alice_Debt_After = (await cdpManager.CDPs(alice))[0].toString()
      const bob_Debt_After = (await cdpManager.CDPs(bob))[0].toString()
      const carol_Debt_After = (await cdpManager.CDPs(carol))[0].toString()
      const dennis_Debt_After = (await cdpManager.CDPs(dennis))[0].toString()

      const whale_Coll_After = (await cdpManager.CDPs(whale))[1].toString()
      const alice_Coll_After = (await cdpManager.CDPs(alice))[1].toString()
      const bob_Coll_After = (await cdpManager.CDPs(bob))[1].toString()
      const carol_Coll_After = (await cdpManager.CDPs(carol))[1].toString()
      const dennis_Coll_After = (await cdpManager.CDPs(dennis))[1].toString()

      const whale_ICR_After = (await cdpManager.getCurrentICR(whale, price)).toString()
      const alice_ICR_After = (await cdpManager.getCurrentICR(alice, price)).toString()
      const bob_ICR_After = (await cdpManager.getCurrentICR(bob, price)).toString()
      const carol_ICR_After = (await cdpManager.getCurrentICR(carol, price)).toString()
      const dennis_ICR_After = (await cdpManager.getCurrentICR(dennis, price)).toString()

      assert.equal(whale_Debt_Before, whale_Debt_After)
      assert.equal(alice_Debt_Before, alice_Debt_After)
      assert.equal(bob_Debt_Before, bob_Debt_After)
      assert.equal(carol_Debt_Before, carol_Debt_After)
      assert.equal(dennis_Debt_Before, dennis_Debt_After)

      assert.equal(whale_Coll_Before, whale_Coll_After)
      assert.equal(alice_Coll_Before, alice_Coll_After)
      assert.equal(bob_Coll_Before, bob_Coll_After)
      assert.equal(carol_Coll_Before, carol_Coll_After)
      assert.equal(dennis_Coll_Before, dennis_Coll_After)

      assert.equal(whale_ICR_Before, whale_ICR_After)
      assert.equal(alice_ICR_Before, alice_ICR_After)
      assert.equal(bob_ICR_Before, bob_ICR_After)
      assert.equal(carol_ICR_Before, carol_ICR_After)
      assert.equal(dennis_ICR_Before, dennis_ICR_After)
    })

    it("provideToSP(): doesn't protect the depositor's trove from liquidation", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

      // A, B, C open loans 
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })

      // A, B provide 100 CLV to SP
      await poolManager.provideToSP(mv._100e18, { from: alice })
      await poolManager.provideToSP(mv._100e18, { from: bob })

      // Confirm Bob has an active trove in the system
      assert.isTrue(await sortedCDPs.contains(bob))
      assert.equal((await cdpManager.getCDPStatus(bob)).toString(), '1')  // Confirm Bob's trove status is active

      // Confirm Bob has a Stability deposit
      assert.equal((await poolManager.getCompoundedCLVDeposit(bob)).toString(), mv._100e18)

      // Price drops
      await priceFeed.setPrice(mv._100e18)
      const price = await priceFeed.getPrice()

      // Liquidate bob
      await cdpManager.liquidate(bob)

      // Check Bob's trove has been removed from the system
      assert.isFalse(await sortedCDPs.contains(bob))
      assert.equal((await cdpManager.getCDPStatus(bob)).toString(), '2')  // check Bob's trove status is closed
    })

    it("provideToSP(): providing 0 CLV doesn't alter the caller's deposit or the total CLV in the Stability Pool", async () => {
      // --- SETUP ---
      await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

      // A, B, C open loans 
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })

      // A, B, C provides 100, 50, 30 CLV to SP
      await poolManager.provideToSP(mv._100e18, { from: alice })
      await poolManager.provideToSP(mv._50e18, { from: bob })
      await poolManager.provideToSP(mv._30e18, { from: carol })

      const bob_Deposit_Before = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
      const CLVinSP_Before = (await stabilityPool.getCLV()).toString()

      assert.equal(CLVinSP_Before, mv._180e18)

      // Bob provides 0 CLV to the Stability Pool 
      await poolManager.provideToSP(0, { from: bob })

      // check Bob's deposit and total CLV in Stability Pool has not changed
      const bob_Deposit_After = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
      const CLVinSP_After = (await stabilityPool.getCLV()).toString()

      assert.equal(bob_Deposit_Before, bob_Deposit_After)
      assert.equal(CLVinSP_Before, CLVinSP_After)
    })





    // --- withdrawFromSP ---

    it("withdrawFromSP(): reverts when user has no active deposit", async () => {
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._10_Ether })
      await borrowerOperations.openLoan(mv._100e18, bob, { from: bob, value: mv._10_Ether })

      await poolManager.provideToSP(mv._100e18, { from: alice })

      const alice_initialDeposit = (await poolManager.initialDeposits(alice)).toString()
      const bob_initialDeposit = (await poolManager.initialDeposits(bob)).toString()

      assert.equal(alice_initialDeposit, mv._100e18)
      assert.equal(bob_initialDeposit, '0')

      const txAlice = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      assert.isTrue(txAlice.receipt.status)


      try {
        const txBob = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "User must have a non-zero deposit")

      }
    })

    it("withdrawFromSP(): partial retrieval - retrieves correct CLV amount and the entire ETH Gain, and updates deposit", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManager(cdpManager.address, { from: owner })
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
      await poolManager.setCDPManager(cdpManager.address, { from: owner })
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
      await poolManager.setCDPManager(cdpManager.address, { from: owner })
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
      await poolManager.setCDPManager(cdpManager.address, { from: owner })

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
      assert.equal(await poolManager.getCurrentETHGain(alice), 0)

      await poolManager.provideToSP('100000000000000000000', { from: alice })
      assert.equal(await poolManager.getCurrentETHGain(alice), 0)

      const ETHinSP_Before = (await stabilityPool.getETH()).toString()

      // Alice attempts second withdrawal
      await poolManager.withdrawFromSP('100000000000000000000', { from: alice })
      assert.equal(await poolManager.getCurrentETHGain(alice), 0)

      // Check ETH in pool does not change
      const ETHinSP_1 = (await stabilityPool.getETH()).toString()
      assert.equal(ETHinSP_Before, ETHinSP_1)

      await poolManager.provideToSP('100000000000000000000', { from: alice })
      assert.equal(await poolManager.getCurrentETHGain(alice), 0)

      // Alice attempts third withdrawal (this time, frm SP to CDP)
      await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })

      // Check ETH in pool does not change
      const ETHinSP_2 = (await stabilityPool.getETH()).toString()
      assert.equal(ETHinSP_Before, ETHinSP_2)
    })

    it("withdrawFromSP(): it correctly updates the user's CLV and ETH snapshots of entitled reward per unit staked", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManager(cdpManager.address, { from: owner })
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
      await poolManager.setCDPManager(cdpManager.address, { from: owner })

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

    it("withdrawFromSP(): increases depositor's CLV token balance by the expected amount", async () => {
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

      /* From a distribution of 100 CLV, each depositor receives
      CLVLoss = 16.666666666666666666 CLV

      and thus with a deposit of 100 CLV, each should withdraw 83.333333333333333333 CLV (in practice, slightly less due to rounding error)
      */

      // Price bounces back to $200 per ETH
      await priceFeed.setPrice(mv._200e18)

      // Bob issues a further 50 CLV from his trove 
      await borrowerOperations.withdrawCLV(mv._50e18, bob, { from: bob })

      // Expect Alice's CLV balance to be very close to 83.333333333333333333 CLV
      await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      const alice_Balance = (await clvToken.balanceOf(alice)).toString()
      assert.isAtMost(th.getDifference(alice_Balance, '83333333333333333333'), 1000)

      // expect Bob's CLV balance to be very close to  133.33333333333333333 CLV
      await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const bob_Balance = (await clvToken.balanceOf(bob)).toString()
      assert.isAtMost(th.getDifference(bob_Balance, '133333333333333333333'), 1000)
    })

    it("withdrawFromSP(): doesn't impact other users Stability deposits or ETH gains", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

      // A, B, C open loans and make Stability Pool deposits
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })

      await poolManager.provideToSP(mv._100e18, { from: alice })
      await poolManager.provideToSP(mv._200e18, { from: bob })
      await poolManager.provideToSP(mv._300e18, { from: carol })

      // Would-be defaulters open loans
      await borrowerOperations.openLoan(mv._100e18, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._180e18, defaulter_2, { from: defaulter_2, value: mv._1_Ether })

      // Price drops
      await priceFeed.setPrice(mv._100e18)

      // Defaulters are liquidated
      await cdpManager.liquidate(defaulter_1)
      await cdpManager.liquidate(defaulter_2)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))
      assert.isFalse(await sortedCDPs.contains(defaulter_2))

      const alice_CLVDeposit_Before = (await poolManager.getCompoundedCLVDeposit(alice)).toString()
      const bob_CLVDeposit_Before = (await poolManager.getCompoundedCLVDeposit(bob)).toString()

      const alice_ETHGain_Before = (await poolManager.getCurrentETHGain(alice)).toString()
      const bob_ETHGain_Before = (await poolManager.getCurrentETHGain(bob)).toString()

      //check non-zero CLV and ETHGain in the Stability Pool
      const CLVinSP = await stabilityPool.getCLV()
      const ETHinSP = await stabilityPool.getETH()
      assert.isTrue(CLVinSP.gt(mv._zeroBN))
      assert.isTrue(ETHinSP.gt(mv._zeroBN))

      // Carol withdraws her Stability deposit 
      assert.equal((await poolManager.initialDeposits(carol)).toString(), mv._300e18)
      await poolManager.withdrawFromSP(mv._300e18, { from: carol })
      assert.equal((await poolManager.initialDeposits(carol)).toString(), '0')

      const alice_CLVDeposit_After = (await poolManager.getCompoundedCLVDeposit(alice)).toString()
      const bob_CLVDeposit_After = (await poolManager.getCompoundedCLVDeposit(bob)).toString()

      const alice_ETHGain_After = (await poolManager.getCurrentETHGain(alice)).toString()
      const bob_ETHGain_After = (await poolManager.getCurrentETHGain(bob)).toString()

      // Check compounded deposits and ETH gains for A and B have not changed
      assert.equal(alice_CLVDeposit_Before, alice_CLVDeposit_After)
      assert.equal(bob_CLVDeposit_Before, bob_CLVDeposit_After)

      assert.equal(alice_ETHGain_Before, alice_ETHGain_After)
      assert.equal(bob_ETHGain_Before, bob_ETHGain_After)
    })

    it("withdrawFromSP(): doesn't impact system debt, collateral or TCR ", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

      // A, B, C open loans and make Stability Pool deposits
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })

      await poolManager.provideToSP(mv._100e18, { from: alice })
      await poolManager.provideToSP(mv._200e18, { from: bob })
      await poolManager.provideToSP(mv._300e18, { from: carol })

      // Would-be defaulters open loans
      await borrowerOperations.openLoan(mv._100e18, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._180e18, defaulter_2, { from: defaulter_2, value: mv._1_Ether })

      // Price drops
      await priceFeed.setPrice(mv._100e18)

      // Defaulters are liquidated
      await cdpManager.liquidate(defaulter_1)
      await cdpManager.liquidate(defaulter_2)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))
      assert.isFalse(await sortedCDPs.contains(defaulter_2))

      const activeDebt_Before = (await activePool.getCLVDebt()).toString()
      const defaultedDebt_Before = (await defaultPool.getCLVDebt()).toString()
      const activeColl_Before = (await activePool.getETH()).toString()
      const defaultedColl_Before = (await defaultPool.getETH()).toString()
      const TCR_Before = (await poolManager.getTCR()).toString()

      // Carol withdraws her Stability deposit 
      assert.equal((await poolManager.initialDeposits(carol)).toString(), mv._300e18)
      await poolManager.withdrawFromSP(mv._300e18, { from: carol })
      assert.equal((await poolManager.initialDeposits(carol)).toString(), '0')

      const activeDebt_After = (await activePool.getCLVDebt()).toString()
      const defaultedDebt_After = (await defaultPool.getCLVDebt()).toString()
      const activeColl_After = (await activePool.getETH()).toString()
      const defaultedColl_After = (await defaultPool.getETH()).toString()
      const TCR_After = (await poolManager.getTCR()).toString()

      // Check total system debt, collateral and TCR have not changed after a Stability deposit is made
      assert.equal(activeDebt_Before, activeDebt_After)
      assert.equal(defaultedDebt_Before, defaultedDebt_After)
      assert.equal(activeColl_Before, activeColl_After)
      assert.equal(defaultedColl_Before, defaultedColl_After)
      assert.equal(TCR_Before, TCR_After)
    })

    it("withdrawFromSP(): doesn't impact any troves, including the caller's trove", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

      // A, B, C open loans and make Stability Pool deposits
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })

      // A, B and C provide to SP
      await poolManager.provideToSP(mv._100e18, { from: alice })
      await poolManager.provideToSP(mv._200e18, { from: bob })
      await poolManager.provideToSP(mv._300e18, { from: carol })

      // Price drops
      await priceFeed.setPrice(mv._100e18)
      const price = await priceFeed.getPrice()

      // Get debt, collateral and ICR of all existing troves
      const whale_Debt_Before = (await cdpManager.CDPs(whale))[0].toString()
      const alice_Debt_Before = (await cdpManager.CDPs(alice))[0].toString()
      const bob_Debt_Before = (await cdpManager.CDPs(bob))[0].toString()
      const carol_Debt_Before = (await cdpManager.CDPs(carol))[0].toString()

      const whale_Coll_Before = (await cdpManager.CDPs(whale))[1].toString()
      const alice_Coll_Before = (await cdpManager.CDPs(alice))[1].toString()
      const bob_Coll_Before = (await cdpManager.CDPs(bob))[1].toString()
      const carol_Coll_Before = (await cdpManager.CDPs(carol))[1].toString()

      const whale_ICR_Before = (await cdpManager.getCurrentICR(whale, price)).toString()
      const alice_ICR_Before = (await cdpManager.getCurrentICR(alice, price)).toString()
      const bob_ICR_Before = (await cdpManager.getCurrentICR(bob, price)).toString()
      const carol_ICR_Before = (await cdpManager.getCurrentICR(carol, price)).toString()

      // Carol withdraws her Stability deposit 
      assert.equal((await poolManager.initialDeposits(carol)).toString(), mv._300e18)
      await poolManager.withdrawFromSP(mv._300e18, { from: carol })
      assert.equal((await poolManager.initialDeposits(carol)).toString(), '0')

      const whale_Debt_After = (await cdpManager.CDPs(whale))[0].toString()
      const alice_Debt_After = (await cdpManager.CDPs(alice))[0].toString()
      const bob_Debt_After = (await cdpManager.CDPs(bob))[0].toString()
      const carol_Debt_After = (await cdpManager.CDPs(carol))[0].toString()

      const whale_Coll_After = (await cdpManager.CDPs(whale))[1].toString()
      const alice_Coll_After = (await cdpManager.CDPs(alice))[1].toString()
      const bob_Coll_After = (await cdpManager.CDPs(bob))[1].toString()
      const carol_Coll_After = (await cdpManager.CDPs(carol))[1].toString()

      const whale_ICR_After = (await cdpManager.getCurrentICR(whale, price)).toString()
      const alice_ICR_After = (await cdpManager.getCurrentICR(alice, price)).toString()
      const bob_ICR_After = (await cdpManager.getCurrentICR(bob, price)).toString()
      const carol_ICR_After = (await cdpManager.getCurrentICR(carol, price)).toString()

      // Check all troves are unaffected by Carol's Stability deposit withdrawal
      assert.equal(whale_Debt_Before, whale_Debt_After)
      assert.equal(alice_Debt_Before, alice_Debt_After)
      assert.equal(bob_Debt_Before, bob_Debt_After)
      assert.equal(carol_Debt_Before, carol_Debt_After)

      assert.equal(whale_Coll_Before, whale_Coll_After)
      assert.equal(alice_Coll_Before, alice_Coll_After)
      assert.equal(bob_Coll_Before, bob_Coll_After)
      assert.equal(carol_Coll_Before, carol_Coll_After)

      assert.equal(whale_ICR_Before, whale_ICR_After)
      assert.equal(alice_ICR_Before, alice_ICR_After)
      assert.equal(bob_ICR_Before, bob_ICR_After)
      assert.equal(carol_ICR_Before, carol_ICR_After)
    })

    it("withdrawFromSP(): withdrawing 0 CLV doesn't alter the caller's deposit or the total CLV in the Stability Pool", async () => {
      // --- SETUP ---
      await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

      // A, B, C open loans 
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })

      // A, B, C provides 100, 50, 30 CLV to SP
      await poolManager.provideToSP(mv._100e18, { from: alice })
      await poolManager.provideToSP(mv._50e18, { from: bob })
      await poolManager.provideToSP(mv._30e18, { from: carol })

      const bob_Deposit_Before = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
      const CLVinSP_Before = (await stabilityPool.getCLV()).toString()

      assert.equal(CLVinSP_Before, mv._180e18)

      // Bob withdraws 0 CLV from the Stability Pool 
      await poolManager.withdrawFromSP(0, { from: bob })

      // check Bob's deposit and total CLV in Stability Pool has not changed
      const bob_Deposit_After = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
      const CLVinSP_After = (await stabilityPool.getCLV()).toString()

      assert.equal(bob_Deposit_Before, bob_Deposit_After)
      assert.equal(CLVinSP_Before, CLVinSP_After)
    })

    
    it("withdrawFromSP(): withdrawing 0 ETH Gain does not alter the caller's ETH balance, their trove collateral, or the ETH  in the Stability Pool", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

      // A, B, C open loans and provide to Stability Pool
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })

      // Would-be defaulters open loans
      await borrowerOperations.openLoan(mv._1000e18, defaulter_1, { from: defaulter_1, value: mv._10_Ether })
  
      // Price drops
      await priceFeed.setPrice(mv._100e18)

      assert.isFalse(await cdpManager.checkRecoveryMode())

      // Defaulter 1 liquidated, full offset
      await cdpManager.liquidate(defaulter_1)

      // Dennis opens loan and deposits to Stability Pool
      await borrowerOperations.openLoan(mv._100e18, dennis, { from: dennis, value: mv._2_Ether })
      await poolManager.provideToSP(mv._100e18, {from: dennis})

      // Check Dennis has 0 ETHGain
      const dennis_ETHGain = (await poolManager.getCurrentETHGain(dennis)).toString()
      assert.equal(dennis_ETHGain, '0')

      const dennis_ETHBalance_Before = (web3.eth.getBalance(dennis)).toString()
      const dennis_Collateral_Before = ((await cdpManager.CDPs(dennis))[1]).toString()
      const ETHinSP_Before = (await stabilityPool.getETH()).toString()

      // Dennis withdraws his full deposit and ETHGain to his account
      await poolManager.withdrawFromSP(mv._100e18, {from: dennis, gasPrice: 0})

      // Check withdrawal does not alter Dennis' ETH balance or his trove's collateral
      const dennis_ETHBalance_After = (web3.eth.getBalance(dennis)).toString()
      const dennis_Collateral_After = ((await cdpManager.CDPs(dennis))[1]).toString()
      const ETHinSP_After = (await stabilityPool.getETH()).toString()

      assert.equal(dennis_ETHBalance_Before, dennis_ETHBalance_After)
      assert.equal(dennis_Collateral_Before, dennis_Collateral_After)
      
      // Check withdrawal has not altered the ETH in the Stability Pool
      assert.equal(ETHinSP_Before, ETHinSP_After)
    })



    it("withdrawFromSP(): Request to withdraw > caller's deposit only withdraws the caller's compounded deposit", async () => {
      // --- SETUP ---
      await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

      // A, B, C open loans 
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })

      await borrowerOperations.openLoan(mv._100e18, defaulter_1, { from: defaulter_1, value: mv._1_Ether })

      // A, B, C provides 100, 50, 30 CLV to SP
      await poolManager.provideToSP(mv._100e18, { from: alice })
      await poolManager.provideToSP(mv._50e18, { from: bob })
      await poolManager.provideToSP(mv._30e18, { from: carol })

      // Price drops
      await priceFeed.setPrice(mv._100e18)

      // Liquidate defaulter 1
      await cdpManager.liquidate(defaulter_1)

      const alice_CLV_Balance_Before = await clvToken.balanceOf(alice)
      const bob_CLV_Balance_Before = await clvToken.balanceOf(bob)

      assert.equal(alice_CLV_Balance_Before.toString(), '0')
      assert.equal(bob_CLV_Balance_Before.toString(), mv._150e18)

      const alice_Deposit_Before = await poolManager.getCompoundedCLVDeposit(alice)
      const bob_Deposit_Before = await poolManager.getCompoundedCLVDeposit(bob)

      const CLVinSP_Before = await stabilityPool.getCLV()

      // Bob attempts to withdraws 50.000000000000000001 CLV from the Stability Pool
      await poolManager.withdrawFromSP('50000000000000000001', { from: bob })

      // Check Bob's CLV balance has risen by only the value of his compounded deposit
      const bob_expectedCLVBalance = (bob_CLV_Balance_Before.add(bob_Deposit_Before)).toString()
      const bob_CLV_Balance_After = (await clvToken.balanceOf(bob)).toString()
      assert.equal(bob_CLV_Balance_After, bob_expectedCLVBalance)

      // Alice attempts to withdraws 2309842309.000000000000000000 CLV from the Stability Pool 
      await poolManager.withdrawFromSP('2309842309000000000000000000', { from: alice })

      // Check Alice's CLV balance has risen by only the value of her compounded deposit
      const alice_expectedCLVBalance = (alice_CLV_Balance_Before.add(alice_Deposit_Before)).toString()
      const alice_CLV_Balance_After = (await clvToken.balanceOf(alice)).toString()
      assert.equal(alice_CLV_Balance_After, alice_expectedCLVBalance)

      // Check CLV in Stability Pool has been reduced by only Alice's compounded deposit and Bob's compounded deposit
      const expectedCLVinSP = (CLVinSP_Before.sub(alice_Deposit_Before).sub(bob_Deposit_Before)).toString()
      const CLVinSP_After = (await stabilityPool.getCLV()).toString()
      assert.equal(CLVinSP_After, expectedCLVinSP)
    })

    it("withdrawFromSP(): Request to withdraw 2^256-1 CLV only withdraws the caller's compounded deposit", async () => {
      // --- SETUP ---
      await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

      // A, B, C open loans 
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })

      await borrowerOperations.openLoan(mv._100e18, defaulter_1, { from: defaulter_1, value: mv._1_Ether })

      // A, B, C provides 100, 50, 30 CLV to SP
      await poolManager.provideToSP(mv._100e18, { from: alice })
      await poolManager.provideToSP(mv._50e18, { from: bob })
      await poolManager.provideToSP(mv._30e18, { from: carol })

      // Price drops
      await priceFeed.setPrice(mv._100e18)

      // Liquidate defaulter 1
      await cdpManager.liquidate(defaulter_1)

      const bob_CLV_Balance_Before = await clvToken.balanceOf(bob)
      assert.equal(bob_CLV_Balance_Before.toString(), mv._150e18)

      const bob_Deposit_Before = await poolManager.getCompoundedCLVDeposit(bob)

      const CLVinSP_Before = await stabilityPool.getCLV()

      const maxBytes32 = web3.utils.toBN("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")

      // Bob attempts to withdraws maxBytes32 CLV from the Stability Pool
      await poolManager.withdrawFromSP(maxBytes32, { from: bob })

      // Check Bob's CLV balance has risen by only the value of his compounded deposit
      const bob_expectedCLVBalance = (bob_CLV_Balance_Before.add(bob_Deposit_Before)).toString()
      const bob_CLV_Balance_After = (await clvToken.balanceOf(bob)).toString()
      assert.equal(bob_CLV_Balance_After, bob_expectedCLVBalance)

      // Check CLV in Stability Pool has been reduced by only  Bob's compounded deposit
      const expectedCLVinSP = (CLVinSP_Before.sub(bob_Deposit_Before)).toString()
      const CLVinSP_After = (await stabilityPool.getCLV()).toString()
      assert.equal(CLVinSP_After, expectedCLVinSP)
    })

    it("withdrawFromSP(): caller can withdraw full deposit and ETH gain during Recovery Mode", async () => {
      // --- SETUP ---

      // A, B, C open loans 
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })

      await borrowerOperations.openLoan(mv._100e18, defaulter_1, { from: defaulter_1, value: mv._1_Ether })

      // A, B, C provides 100, 50, 30 CLV to SP
      await poolManager.provideToSP(mv._100e18, { from: alice })
      await poolManager.provideToSP(mv._50e18, { from: bob })
      await poolManager.provideToSP(mv._30e18, { from: carol })

      assert.isFalse(await cdpManager.checkRecoveryMode())

      // Price drops
      await priceFeed.setPrice(mv._105e18)
      const price = await priceFeed.getPrice()

      assert.isTrue(await cdpManager.checkRecoveryMode())

      // Liquidate defaulter 1
      await cdpManager.liquidate(defaulter_1)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))

      const alice_CLV_Balance_Before = await clvToken.balanceOf(alice)
      const bob_CLV_Balance_Before = await clvToken.balanceOf(bob)
      const carol_CLV_Balance_Before = await clvToken.balanceOf(carol)

      const alice_ETH_Balance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))
      const bob_ETH_Balance_Before = web3.utils.toBN(await web3.eth.getBalance(bob))
      const carol_ETH_Balance_Before = web3.utils.toBN(await web3.eth.getBalance(carol))

      const alice_Deposit_Before = await poolManager.getCompoundedCLVDeposit(alice)
      const bob_Deposit_Before = await poolManager.getCompoundedCLVDeposit(bob)
      const carol_Deposit_Before = await poolManager.getCompoundedCLVDeposit(carol)

      const alice_ETHGain_Before = await poolManager.getCurrentETHGain(alice)
      const bob_ETHGain_Before = await poolManager.getCurrentETHGain(bob)
      const carol_ETHGain_Before = await poolManager.getCurrentETHGain(carol)

      const CLVinSP_Before = await stabilityPool.getCLV()

      // A, B, C withdraw their full deposits from the Stability Pool
      await poolManager.withdrawFromSP(mv._100e18, { from: alice, gasPrice: 0 })
      await poolManager.withdrawFromSP(mv._100e18, { from: bob, gasPrice: 0 })
      await poolManager.withdrawFromSP(mv._100e18, { from: carol, gasPrice: 0 })

      // Check CLV balances of A, B, C have risen by the value of their compounded deposits, respectively
      const alice_expectedCLVBalance = (alice_CLV_Balance_Before.add(alice_Deposit_Before)).toString()
      const bob_expectedCLVBalance = (bob_CLV_Balance_Before.add(bob_Deposit_Before)).toString()
      const carol_expectedCLVBalance = (carol_CLV_Balance_Before.add(carol_Deposit_Before)).toString()

      const alice_CLV_Balance_After = (await clvToken.balanceOf(alice)).toString()
      const bob_CLV_Balance_After = (await clvToken.balanceOf(bob)).toString()
      const carol_CLV_Balance_After = (await clvToken.balanceOf(carol)).toString()

      assert.equal(alice_CLV_Balance_After, alice_expectedCLVBalance)
      assert.equal(bob_CLV_Balance_After, bob_expectedCLVBalance)
      assert.equal(carol_CLV_Balance_After, carol_expectedCLVBalance)


      // Check ETH balances of A, B, C have increased by the value of their ETH gain from liquidations, respectively
      const alice_expectedETHBalance = (alice_ETH_Balance_Before.add(alice_ETHGain_Before)).toString()
      const bob_expectedETHBalance = (bob_ETH_Balance_Before.add(bob_ETHGain_Before)).toString()
      const carol_expectedETHBalance = (carol_ETH_Balance_Before.add(carol_ETHGain_Before)).toString()

      const alice_ETHBalance_After = (await web3.eth.getBalance(alice)).toString()
      const bob_ETHBalance_After = (await web3.eth.getBalance(bob)).toString()
      const carol_ETHBalance_After = (await web3.eth.getBalance(carol)).toString()

      assert.equal(alice_expectedETHBalance, alice_ETHBalance_After)
      assert.equal(bob_expectedETHBalance, bob_ETHBalance_After)
      assert.equal(carol_expectedETHBalance, carol_ETHBalance_After)

      // Check CLV in Stability Pool has been reduced by A, B and C's compounded deposit
      const expectedCLVinSP = (CLVinSP_Before
        .sub(alice_Deposit_Before)
        .sub(bob_Deposit_Before)
        .sub(carol_Deposit_Before))
        .toString()
      const CLVinSP_After = (await stabilityPool.getCLV()).toString()
      assert.equal(CLVinSP_After, expectedCLVinSP)

      // Check ETH in SP has reduced to zero
      const ETHinSP_After = (await stabilityPool.getETH()).toString()
      assert.isAtMost(th.getDifference(ETHinSP_After, '0'), 1000)
    })

    it("getCurrentETHGain(): depositor does not earn further ETH gains from liquidations while their compounded deposit == 0: ", async () => {
      await borrowerOperations.openLoan(mv._1e22, whale, { from: whale, value: mv._1000_Ether })

      // A, B, C open loans 
      await borrowerOperations.openLoan(mv._1000e18, alice, { from: alice, value: mv._10_Ether })
      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })

      await borrowerOperations.openLoan(mv._200e18, defaulter_1, { from: defaulter_1, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, defaulter_2, { from: defaulter_2, value: mv._3_Ether })
      await borrowerOperations.openLoan(mv._5000e18, defaulter_3, { from: defaulter_3, value: mv._50_Ether })

      // A, B, provide 100, 50 CLV to SP
      await poolManager.provideToSP(mv._100e18, { from: alice })
      await poolManager.provideToSP(mv._50e18, { from: bob })

      //price drops
      await priceFeed.setPrice(mv._100e18)

      // Liquidate defaulter 1. Empties the Pool
      await cdpManager.liquidate(defaulter_1)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))

      const CLVinSP = (await stabilityPool.getCLV()).toString()
      assert.equal(CLVinSP, '0')

      // Check Stability deposits have been fully cancelled with debt, and are now all zero
      const alice_Deposit = (await poolManager.getCompoundedCLVDeposit(alice)).toString()
      const bob_Deposit = (await poolManager.getCompoundedCLVDeposit(bob)).toString()

      assert.equal(alice_Deposit, '0')
      assert.equal(bob_Deposit, '0')

      // Get ETH gain for A and B
      const alice_ETHGain_1 = (await poolManager.getCurrentETHGain(alice)).toString()
      const bob_ETHGain_1 = (await poolManager.getCurrentETHGain(bob)).toString()

      // Whale deposits 10000 CLV to Stability Pool
      await poolManager.provideToSP(mv._1e22, {from: whale})

      // Liquidation 2
      await cdpManager.liquidate(defaulter_2)
      assert.isFalse(await sortedCDPs.contains(defaulter_2))

      // Check Alice and Bob have not received ETH gain from liquidation 2 while their deposit was 0
      const alice_ETHGain_2 = (await poolManager.getCurrentETHGain(alice)).toString()
      const bob_ETHGain_2 = (await poolManager.getCurrentETHGain(bob)).toString()

      assert.equal(alice_ETHGain_1, alice_ETHGain_2)
      assert.equal(bob_ETHGain_1, bob_ETHGain_2)

      // Liquidation 3
      await cdpManager.liquidate(defaulter_3)
      assert.isFalse(await sortedCDPs.contains(defaulter_3))

       // Check Alice and Bob have not received ETH gain from liquidation 3 while their deposit was 0
      const alice_ETHGain_3 = (await poolManager.getCurrentETHGain(alice)).toString()
      const bob_ETHGain_3 = (await poolManager.getCurrentETHGain(bob)).toString()

      assert.equal(alice_ETHGain_1, alice_ETHGain_3)
      assert.equal(bob_ETHGain_1, bob_ETHGain_3)
    })



    // --- withdrawFromSPtoCDP ---

    it("withdrawFromSPtoCDP(): reverts when user has no active deposit", async () => {
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._10_Ether })
      await borrowerOperations.openLoan(mv._100e18, bob, { from: bob, value: mv._10_Ether })

      await poolManager.provideToSP(mv._100e18, { from: alice })

      const alice_initialDeposit = (await poolManager.initialDeposits(alice)).toString()
      const bob_initialDeposit = (await poolManager.initialDeposits(bob)).toString()

      assert.equal(alice_initialDeposit, mv._100e18)
      assert.equal(bob_initialDeposit, '0')

      const txAlice = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      assert.isTrue(txAlice.receipt.status)

      try {
        const txBob = await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
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

      await poolManager.provideToSP(mv._100e18, { from: alice })
      await poolManager.provideToSP(mv._100e18, { from: bob })
      await poolManager.provideToSP(mv._100e18, { from: carol })

      const alice_initialDeposit = (await poolManager.initialDeposits(alice)).toString()
      const bob_initialDeposit = (await poolManager.initialDeposits(bob)).toString()
      const carol_initialDeposit = (await poolManager.initialDeposits(carol)).toString()

      assert.equal(alice_initialDeposit, mv._100e18)
      assert.equal(bob_initialDeposit, mv._100e18)
      assert.equal(carol_initialDeposit, mv._100e18)

      const txAlice = await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      assert.isTrue(txAlice.receipt.status)

      try {
        const txBob = await poolManager.withdrawFromSPtoCDP(carol, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "A user may only withdraw ETH gains to their own trove")
      }
    })

    it("withdrawFromSPtoCDP(): Applies CLVLoss to user's deposit, and redirects ETH reward to user's CDP", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManager(cdpManager.address, { from: owner })

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
      await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })

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
      await poolManager.setCDPManager(cdpManager.address, { from: owner })

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

      assert.equal(await poolManager.getCurrentETHGain(alice), 0)

      const ETHinSP_Before = (await stabilityPool.getETH()).toString()

      // Alice attempts second withdrawal from SP to CDP
      await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      assert.equal(await poolManager.getCurrentETHGain(alice), 0)

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
      await poolManager.setCDPManager(cdpManager.address, { from: owner })

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
      await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })

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

      await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
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

    it("withdrawFromSPtoCDP(): caller can withdraw full deposit and ETH gain to their trove during Recovery Mode", async () => {
      // --- SETUP ---

      // A, B, C open loans 
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })

      await borrowerOperations.openLoan(mv._100e18, defaulter_1, { from: defaulter_1, value: mv._1_Ether })

      // A, B, C provides 100, 50, 30 CLV to SP
      await poolManager.provideToSP(mv._100e18, { from: alice })
      await poolManager.provideToSP(mv._50e18, { from: bob })
      await poolManager.provideToSP(mv._30e18, { from: carol })

      assert.isFalse(await cdpManager.checkRecoveryMode())

      // Price drops to 105, Defaulter1's ICR: 100 < ICR < 110.
      await priceFeed.setPrice(mv._105e18)

      assert.isTrue(await cdpManager.checkRecoveryMode())

      // Liquidate defaulter 1
      await cdpManager.liquidate(defaulter_1)

      const alice_Collateral_Before = (await cdpManager.CDPs(alice))[1]
      const bob_Collateral_Before = (await cdpManager.CDPs(bob))[1]
      const carol_Collateral_Before = (await cdpManager.CDPs(carol))[1]

      const alice_ETHGain_Before = await poolManager.getCurrentETHGain(alice)
      const bob_ETHGain_Before = await poolManager.getCurrentETHGain(bob)
      const carol_ETHGain_Before = await poolManager.getCurrentETHGain(carol)

      // A, B, C withdraw their full ETH gain from the Stability Pool to their trove
      await poolManager.withdrawFromSPtoCDP(alice, alice, { from: alice })
      await poolManager.withdrawFromSPtoCDP(bob, bob, { from: bob })
      await poolManager.withdrawFromSPtoCDP(carol, carol, { from: carol })

      // Check collateral of troves A, B, C has increased by the value of their ETH gain from liquidations, respectively
      const alice_expectedCollateral = (alice_Collateral_Before.add(alice_ETHGain_Before)).toString()
      const bob_expectedColalteral = (bob_Collateral_Before.add(bob_ETHGain_Before)).toString()
      const carol_expectedCollateral = (carol_Collateral_Before.add(carol_ETHGain_Before)).toString()

      const alice_Collateral_After = (await cdpManager.CDPs(alice))[1]
      const bob_Collateral_After = (await cdpManager.CDPs(bob))[1]
      const carol_Collateral_After = (await cdpManager.CDPs(carol))[1]

      assert.equal(alice_expectedCollateral, alice_Collateral_After)
      assert.equal(bob_expectedColalteral, bob_Collateral_After)
      assert.equal(carol_expectedCollateral, carol_Collateral_After)

      // Check ETH in SP has reduced to zero
      const ETHinSP_After = (await stabilityPool.getETH()).toString()
      assert.isAtMost(th.getDifference(ETHinSP_After, '0'), 1000)
    })

    it("withdrawFromSPtoCDP(): reverts if user has no trove", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._10_Ether })

       await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
       await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
       await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })
 
       await borrowerOperations.openLoan(mv._100e18, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
 
      // A transfers CLV to D
      await clvToken.transfer(dennis, mv._100e18, {from: alice})

      // D deposits to Stability Pool
      await poolManager.provideToSP(mv._100e18, {from: dennis} )

      //Price drops
      await priceFeed.setPrice(mv._100e18)

      //Liquidate defaulter 1
      await cdpManager.liquidate(defaulter_1)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))

      // D attempts to withdraw his ETH gain to CDP
      try {
        const txD = await poolManager.withdrawFromSPtoCDP(dennis, dennis, {from: dennis})
        assert.isFalse(txD.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
        assert.include(error.message, "caller must have an active trove to withdraw ETHGain to")
      }
    })

    it("withdrawFromSPtoCDP(): withdrawing 0 ETH Gain does not alter the caller's ETH balance, the trove collateral, or the ETH in the Stability Pool", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: mv._100_Ether })

      // A, B, C open loans and provide to Stability Pool
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })
      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._3_Ether })

      // Would-be defaulters open loans
      await borrowerOperations.openLoan(mv._1000e18, defaulter_1, { from: defaulter_1, value: mv._10_Ether })
  
      // Price drops
      await priceFeed.setPrice(mv._100e18)

      assert.isFalse(await cdpManager.checkRecoveryMode())

      // Defaulter 1 liquidated, full offset
      await cdpManager.liquidate(defaulter_1)

      // Dennis opens loan and deposits to Stability Pool
      await borrowerOperations.openLoan(mv._100e18, dennis, { from: dennis, value: mv._2_Ether })
      await poolManager.provideToSP(mv._100e18, {from: dennis})

      // Check Dennis has 0 ETHGain
      const dennis_ETHGain = (await poolManager.getCurrentETHGain(dennis)).toString()
      assert.equal(dennis_ETHGain, '0')

      const dennis_ETHBalance_Before = (web3.eth.getBalance(dennis)).toString()
      const dennis_Collateral_Before = ((await cdpManager.CDPs(dennis))[1]).toString()
      const ETHinSP_Before = (await stabilityPool.getETH()).toString()

      // Dennis withdraws his ETHGain to his trove
      await poolManager.withdrawFromSPtoCDP(dennis,dennis, {from: dennis, gasPrice: 0})

      // Check withdrawal does not alter Dennis' ETH balance or his trove's collateral
      const dennis_ETHBalance_After = (web3.eth.getBalance(dennis)).toString()
      const dennis_Collateral_After = ((await cdpManager.CDPs(dennis))[1]).toString()
      const ETHinSP_After = (await stabilityPool.getETH()).toString()

      assert.equal(dennis_ETHBalance_Before, dennis_ETHBalance_After)
      assert.equal(dennis_Collateral_Before, dennis_Collateral_After)
      
      // Check withdrawal has not altered the ETH in the Stability Pool
      assert.equal(ETHinSP_Before, ETHinSP_After)
    })
  })
})


contract('Reset chain state', async accounts => { })