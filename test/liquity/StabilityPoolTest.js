const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")
const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const VSTTokenTester = artifacts.require("VSTTokenTester")
const TroveManagerTester = artifacts.require("TroveManagerTester")
const NonPayable = artifacts.require('NonPayable.sol')
const StabilityPool = artifacts.require('StabilityPool.sol')

const ZERO = toBN('0')
const ZERO_ADDRESS = th.ZERO_ADDRESS
const maxBytes32 = th.maxBytes32

contract('StabilityPool', async accounts => {

  const [owner,
    defaulter_1, defaulter_2, defaulter_3,
    whale,
    alice, bob, carol, dennis, erin, flyn,
    A, B, C, D, E, F,
  ] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let contracts
  let priceFeed
  let vstToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let stabilityPoolERC20
  let defaultPool
  let borrowerOperations
  let vstaToken
  let communityIssuance
  let erc20

  let gasPriceInWei

  const getOpenTroveVSTAmount = async (totalDebt, asset) => th.getOpenTroveVSTAmount(contracts, totalDebt, asset)
  const openTrove = async (params) => th.openTrove(contracts, params)
  const assertRevert = th.assertRevert

  describe("Stability Pool Mechanisms", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
    })

    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      contracts.troveManager = await TroveManagerTester.new()
      contracts.vstToken = await VSTTokenTester.new(
        contracts.troveManager.address,
        contracts.stabilityPoolManager.address,
        contracts.borrowerOperations.address,
      )
      const VSTAContracts = await deploymentHelper.deployVSTAContractsHardhat(accounts[0])

      priceFeed = contracts.priceFeedTestnet
      vstToken = contracts.vstToken
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      activePool = contracts.activePool
      defaultPool = contracts.defaultPool
      borrowerOperations = contracts.borrowerOperations
      hintHelpers = contracts.hintHelpers

      vstaToken = VSTAContracts.vstaToken
      communityIssuance = VSTAContracts.communityIssuance

      erc20 = contracts.erc20;

      let index = 0;
      for (const acc of accounts) {
        await erc20.mint(acc, await web3.eth.getBalance(acc))
        index++;

        if (index >= 100)
          break;
      }

      await deploymentHelper.connectCoreContracts(contracts, VSTAContracts)
      await deploymentHelper.connectVSTAContractsToCore(VSTAContracts, contracts)

      stabilityPool = await StabilityPool.at(await contracts.stabilityPoolManager.getAssetStabilityPool(ZERO_ADDRESS))
      stabilityPoolERC20 = await StabilityPool.at(await contracts.stabilityPoolManager.getAssetStabilityPool(erc20.address));
    })

    // --- provideToSP() ---
    // increases recorded VST at Stability Pool
    it("provideToSP(): increases the Stability Pool VST balance", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({ extraVSTAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // --- TEST ---

      // provideToSP()
      await stabilityPool.provideToSP(200, { from: alice })
      await stabilityPoolERC20.provideToSP(200, { from: alice })

      // check VST balances after
      assert.equal(await stabilityPool.getTotalVSTDeposits(), 200)
      assert.equal(await stabilityPoolERC20.getTotalVSTDeposits(), 200)
    })

    it("provideToSP(): updates the user's deposit record in StabilityPool", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({ extraVSTAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // --- TEST ---
      // check user's deposit record before
      assert.equal(await stabilityPool.deposits(alice), 0)
      assert.equal(await stabilityPoolERC20.deposits(alice), 0)

      // provideToSP()
      await stabilityPool.provideToSP(200, { from: alice })
      await stabilityPoolERC20.provideToSP(200, { from: alice })

      // check user's deposit record after
      assert.equal(await stabilityPool.deposits(alice), 200)
      assert.equal(await stabilityPoolERC20.deposits(alice), 200)
    })

    it("provideToSP(): reduces the user's VST balance by the correct amount", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({ extraVSTAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // --- TEST ---
      // get user's deposit record before
      const alice_VSTBalance_Before = await vstToken.balanceOf(alice)

      // provideToSP()
      await stabilityPool.provideToSP(200, { from: alice })
      await stabilityPoolERC20.provideToSP(200, { from: alice })

      // check user's VST balance change
      const alice_VSTBalance_After = await vstToken.balanceOf(alice)
      assert.equal(alice_VSTBalance_Before.sub(alice_VSTBalance_After), '400')
    })

    it("provideToSP(): increases totalVSTDeposits by correct amount", async () => {
      // --- SETUP ---

      // Whale opens Trove with 50 ETH, adds 2000 VST to StabilityPool
      await openTrove({ extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await stabilityPool.provideToSP(dec(2000, 18), { from: whale })
      await stabilityPoolERC20.provideToSP(dec(2000, 18), { from: whale })

      assert.equal(await stabilityPool.getTotalVSTDeposits(), dec(2000, 18))
      assert.equal(await stabilityPoolERC20.getTotalVSTDeposits(), dec(2000, 18))
    })

    it('provideToSP(): Correctly updates user snapshots of accumulated rewards per unit staked', async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      const whaleVST = (await vstToken.balanceOf(whale)).div(toBN(2))
      await stabilityPool.provideToSP(whaleVST, { from: whale })
      await stabilityPoolERC20.provideToSP(whaleVST, { from: whale })

      // 2 Troves opened, each withdraws minimum debt
      await openTrove({ extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
      await openTrove({ extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })
      await openTrove({ asset: erc20.address, extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
      await openTrove({ asset: erc20.address, extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })

      // Alice makes Trove and withdraws 100 VST
      await openTrove({ extraVSTAmount: toBN(dec(100, 18)), ICR: toBN(dec(5, 18)), extraParams: { from: alice, value: dec(50, 'ether') } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(100, 18)), ICR: toBN(dec(5, 18)), extraParams: { from: alice } })


      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      const SPVST_Before = await stabilityPool.getTotalVSTDeposits()
      const SPVST_BeforeERC20 = await stabilityPoolERC20.getTotalVSTDeposits()

      // Troves are closed
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1, { from: owner })
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_2, { from: owner })
      await troveManager.liquidate(erc20.address, defaulter_1, { from: owner })
      await troveManager.liquidate(erc20.address, defaulter_2, { from: owner })
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_2))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_2))

      // Confirm SP has decreased
      const SPVST_After = await stabilityPool.getTotalVSTDeposits()
      const SPVST_AfterERC20 = await stabilityPoolERC20.getTotalVSTDeposits()
      assert.isTrue(SPVST_After.lt(SPVST_Before))
      assert.isTrue(SPVST_AfterERC20.lt(SPVST_BeforeERC20))

      // --- TEST ---
      const P_Before = (await stabilityPool.P())
      const S_Before = (await stabilityPool.epochToScaleToSum(0, 0))
      const G_Before = (await stabilityPool.epochToScaleToG(0, 0))

      const P_BeforeERC20 = (await stabilityPoolERC20.P())
      const S_BeforeERC20 = (await stabilityPoolERC20.epochToScaleToSum(0, 0))
      const G_BeforeERC20 = (await stabilityPoolERC20.epochToScaleToG(0, 0))

      assert.isTrue(P_Before.gt(toBN('0')))
      assert.isTrue(S_Before.gt(toBN('0')))
      assert.isTrue(P_BeforeERC20.gt(toBN('0')))
      assert.isTrue(S_BeforeERC20.gt(toBN('0')))

      // Check 'Before' snapshots
      const alice_snapshot_Before = await stabilityPool.depositSnapshots(alice)
      const alice_snapshot_S_Before = alice_snapshot_Before[0].toString()
      const alice_snapshot_P_Before = alice_snapshot_Before[1].toString()
      const alice_snapshot_G_Before = alice_snapshot_Before[2].toString()

      const alice_snapshot_BeforeERC20 = await stabilityPoolERC20.depositSnapshots(alice)
      const alice_snapshot_S_BeforeERC20 = alice_snapshot_BeforeERC20[0].toString()
      const alice_snapshot_P_BeforeERC20 = alice_snapshot_BeforeERC20[1].toString()
      const alice_snapshot_G_BeforeERC20 = alice_snapshot_BeforeERC20[2].toString()
      assert.equal(alice_snapshot_S_Before, '0')
      assert.equal(alice_snapshot_P_Before, '0')
      assert.equal(alice_snapshot_G_Before, '0')

      assert.equal(alice_snapshot_S_BeforeERC20, '0')
      assert.equal(alice_snapshot_P_BeforeERC20, '0')
      assert.equal(alice_snapshot_G_BeforeERC20, '0')

      // Make deposit
      await stabilityPool.provideToSP(dec(100, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(100, 18), { from: alice })

      // Check 'After' snapshots
      const alice_snapshot_After = await stabilityPool.depositSnapshots(alice)
      const alice_snapshot_S_After = alice_snapshot_After[0].toString()
      const alice_snapshot_P_After = alice_snapshot_After[1].toString()
      const alice_snapshot_G_After = alice_snapshot_After[2].toString()

      const alice_snapshot_AfterERC20 = await stabilityPoolERC20.depositSnapshots(alice)
      const alice_snapshot_S_AfterERC20 = alice_snapshot_AfterERC20[0].toString()
      const alice_snapshot_P_AfterERC20 = alice_snapshot_AfterERC20[1].toString()
      const alice_snapshot_G_AfterERC20 = alice_snapshot_AfterERC20[2].toString()

      assert.equal(alice_snapshot_S_After, S_Before)
      assert.equal(alice_snapshot_P_After, P_Before)
      assert.equal(alice_snapshot_G_After, G_Before)

      assert.equal(alice_snapshot_S_AfterERC20, S_BeforeERC20)
      assert.equal(alice_snapshot_P_AfterERC20, P_BeforeERC20)
      assert.equal(alice_snapshot_G_AfterERC20, G_BeforeERC20)
    })

    it("provideToSP(), multiple deposits: updates user's deposit and snapshots", async () => {
      // --- SETUP ---
      // Whale opens Trove and deposits to SP
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

      const whaleVST = (await vstToken.balanceOf(whale)).div(toBN(2))
      await stabilityPool.provideToSP(whaleVST, { from: whale })
      await stabilityPoolERC20.provideToSP(whaleVST, { from: whale })

      // 3 Troves opened. Two users withdraw 160 VST each
      await openTrove({ extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, value: dec(50, 'ether') } })
      await openTrove({ extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, value: dec(50, 'ether') } })
      await openTrove({ extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_3, value: dec(50, 'ether') } })

      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_3 } })

      // --- TEST ---

      // Alice makes deposit #1: 150 VST
      await openTrove({ extraVSTAmount: toBN(dec(250, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(250, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
      await stabilityPool.provideToSP(dec(150, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(150, 18), { from: alice })

      const alice_Snapshot_0 = await stabilityPool.depositSnapshots(alice)
      const alice_Snapshot_S_0 = alice_Snapshot_0[0]
      const alice_Snapshot_P_0 = alice_Snapshot_0[1]

      const alice_Snapshot_0ERC20 = await stabilityPoolERC20.depositSnapshots(alice)
      const alice_Snapshot_S_0ERC20 = alice_Snapshot_0ERC20[0]
      const alice_Snapshot_P_0ERC20 = alice_Snapshot_0ERC20[1]

      assert.equal(alice_Snapshot_S_0, 0)
      assert.equal(alice_Snapshot_P_0, '1000000000000000000')
      assert.equal(alice_Snapshot_S_0ERC20, 0)
      assert.equal(alice_Snapshot_P_0ERC20, '1000000000000000000')

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 users with Trove with 180 VST drawn are closed
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1, { from: owner })
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_2, { from: owner })

      await troveManager.liquidate(erc20.address, defaulter_1, { from: owner })
      await troveManager.liquidate(erc20.address, defaulter_2, { from: owner })

      const alice_compoundedDeposit_1 = await stabilityPool.getCompoundedVSTDeposit(alice)
      const alice_compoundedDeposit_1ERC20 = await stabilityPoolERC20.getCompoundedVSTDeposit(alice)

      // Alice makes deposit #2
      const alice_topUp_1 = toBN(dec(100, 18))
      await stabilityPool.provideToSP(alice_topUp_1, { from: alice })
      await stabilityPoolERC20.provideToSP(alice_topUp_1, { from: alice })

      const alice_newDeposit_1 = (await stabilityPool.deposits(alice)).toString()
      assert.equal(alice_compoundedDeposit_1.add(alice_topUp_1), alice_newDeposit_1)

      const alice_newDeposit_1ERC20 = (await stabilityPoolERC20.deposits(alice)).toString()
      assert.equal(alice_compoundedDeposit_1ERC20.add(alice_topUp_1), alice_newDeposit_1ERC20)

      // get system reward terms
      const P_1 = await stabilityPool.P()
      const S_1 = await stabilityPool.epochToScaleToSum(0, 0)
      assert.isTrue(P_1.lt(toBN(dec(1, 18))))
      assert.isTrue(S_1.gt(toBN('0')))

      const P_1ERC20 = await stabilityPoolERC20.P()
      const S_1ERC20 = await stabilityPoolERC20.epochToScaleToSum(0, 0)
      assert.isTrue(P_1ERC20.lt(toBN(dec(1, 18))))
      assert.isTrue(S_1ERC20.gt(toBN('0')))

      // check Alice's new snapshot is correct
      const alice_Snapshot_1 = await stabilityPool.depositSnapshots(alice)
      const alice_Snapshot_S_1 = alice_Snapshot_1[0]
      const alice_Snapshot_P_1 = alice_Snapshot_1[1]
      assert.isTrue(alice_Snapshot_S_1.eq(S_1))
      assert.isTrue(alice_Snapshot_P_1.eq(P_1))


      const alice_Snapshot_1ERC20 = await stabilityPoolERC20.depositSnapshots(alice)
      const alice_Snapshot_S_1ERC20 = alice_Snapshot_1ERC20[0]
      const alice_Snapshot_P_1ERC20 = alice_Snapshot_1ERC20[1]
      assert.isTrue(alice_Snapshot_S_1ERC20.eq(S_1))
      assert.isTrue(alice_Snapshot_P_1ERC20.eq(P_1))

      // Bob withdraws VST and deposits to StabilityPool
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await stabilityPool.provideToSP(dec(427, 18), { from: alice })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await stabilityPoolERC20.provideToSP(dec(427, 18), { from: alice })

      // Defaulter 3 Trove is closed
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_3, { from: owner })
      await troveManager.liquidate(erc20.address, defaulter_3, { from: owner })

      const alice_compoundedDeposit_2 = await stabilityPool.getCompoundedVSTDeposit(alice)
      const alice_compoundedDeposit_2ERC20 = await stabilityPoolERC20.getCompoundedVSTDeposit(alice)

      const P_2 = await stabilityPool.P()
      const S_2 = await stabilityPool.epochToScaleToSum(0, 0)
      assert.isTrue(P_2.lt(P_1))
      assert.isTrue(S_2.gt(S_1))

      const P_2ERC20 = await stabilityPoolERC20.P()
      const S_2ERC20 = await stabilityPoolERC20.epochToScaleToSum(0, 0)
      assert.isTrue(P_2ERC20.lt(P_1ERC20))
      assert.isTrue(S_2ERC20.gt(S_1ERC20))

      // Alice makes deposit #3:  100VST
      await stabilityPool.provideToSP(dec(100, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(100, 18), { from: alice })

      // check Alice's new snapshot is correct
      const alice_Snapshot_2 = await stabilityPool.depositSnapshots(alice)
      const alice_Snapshot_S_2 = alice_Snapshot_2[0]
      const alice_Snapshot_P_2 = alice_Snapshot_2[1]
      assert.isTrue(alice_Snapshot_S_2.eq(S_2))
      assert.isTrue(alice_Snapshot_P_2.eq(P_2))

      const alice_Snapshot_2ERC20 = await stabilityPoolERC20.depositSnapshots(alice)
      const alice_Snapshot_S_2ERC20 = alice_Snapshot_2ERC20[0]
      const alice_Snapshot_P_2ERC20 = alice_Snapshot_2ERC20[1]
      assert.isTrue(alice_Snapshot_S_2ERC20.eq(S_2ERC20))
      assert.isTrue(alice_Snapshot_P_2ERC20.eq(P_2ERC20))
    })

    it("provideToSP(): reverts if user tries to provide more than their VST balance", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice, value: dec(50, 'ether') } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob, value: dec(50, 'ether') } })


      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      const aliceVSTbal = await vstToken.balanceOf(alice)
      const bobVSTbal = await vstToken.balanceOf(bob)

      // Alice, attempts to deposit 1 wei more than her balance

      const aliceTxPromise = stabilityPool.provideToSP(aliceVSTbal.add(toBN(1)), { from: alice })
      const aliceTxPromiseERC20 = stabilityPoolERC20.provideToSP(aliceVSTbal.add(toBN(1)), { from: alice })
      await assertRevert(aliceTxPromise, "revert")
      await assertRevert(aliceTxPromiseERC20, "revert")

      // Bob, attempts to deposit 235534 more than his balance

      const bobTxPromise = stabilityPool.provideToSP(bobVSTbal.add(toBN(dec(235534, 18))), { from: bob })
      const bobTxPromiseERC20 = stabilityPoolERC20.provideToSP(bobVSTbal.add(toBN(dec(235534, 18))), { from: bob })
      await assertRevert(bobTxPromise, "revert")
      await assertRevert(bobTxPromiseERC20, "revert")
    })

    it("provideToSP(): reverts if user tries to provide 2^256-1 VST, which exceeds their balance", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice, value: dec(50, 'ether') } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob, value: dec(50, 'ether') } })

      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      const maxBytes32 = web3.utils.toBN("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")

      // Alice attempts to deposit 2^256-1 VST
      try {
        aliceTx = await stabilityPool.provideToSP(maxBytes32, { from: alice })
        assert.isFalse(tx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      try {
        aliceTx = await stabilityPoolERC20.provideToSP(maxBytes32, { from: alice })
        assert.isFalse(tx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })

    it("provideToSP(): reverts if cannot receive ETH Gain", async () => {
      // --- SETUP ---
      // Whale deposits 1850 VST in StabilityPool
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await stabilityPool.provideToSP(dec(1850, 18), { from: whale })

      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await stabilityPoolERC20.provideToSP(dec(1850, 18), { from: whale })

      // Defaulter Troves opened
      await openTrove({ extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      await openTrove({ asset: erc20.address, extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      // --- TEST ---

      const nonPayable = await NonPayable.new()
      await vstToken.transfer(nonPayable.address, dec(250, 18), { from: whale })
      await vstToken.transfer(nonPayable.address, dec(250, 18), { from: whale })

      // NonPayable makes deposit #1: 150 VST
      const txData1 = th.getTransactionData('provideToSP(uint256)', [web3.utils.toHex(dec(150, 18))])
      await nonPayable.forward(stabilityPool.address, txData1)
      await nonPayable.forward(stabilityPoolERC20.address, txData1)

      const gain_0 = await stabilityPool.getDepositorAssetGain(nonPayable.address)
      assert.isTrue(gain_0.eq(toBN(0)), 'NonPayable should not have accumulated gains')

      const gain_0ERC20 = await stabilityPoolERC20.getDepositorAssetGain(nonPayable.address)
      assert.isTrue(gain_0ERC20.eq(toBN(0)), 'NonPayable should not have accumulated gains')

      // price drops: defaulters' Troves fall below MCR, nonPayable and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 defaulters are closed
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1, { from: owner })
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_2, { from: owner })

      await troveManager.liquidate(erc20.address, defaulter_1, { from: owner })
      await troveManager.liquidate(erc20.address, defaulter_2, { from: owner })

      const gain_1 = await stabilityPool.getDepositorAssetGain(nonPayable.address)
      assert.isTrue(gain_1.gt(toBN(0)), 'NonPayable should have some accumulated gains')

      const gain_1ERC20 = await stabilityPoolERC20.getDepositorAssetGain(nonPayable.address)
      assert.isTrue(gain_1ERC20.gt(toBN(0)), 'NonPayable should have some accumulated gains')

      // NonPayable tries to make deposit #2: 100VST (which also attempts to withdraw ETH gain)
      const txData2 = th.getTransactionData('provideToSP(uint256)', [web3.utils.toHex(dec(100, 18))])
      await th.assertRevert(nonPayable.forward(stabilityPool.address, txData2), 'StabilityPool: sending ETH failed')
    })

    it("provideToSP(): doesn't impact other users' deposits or ETH gains", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await stabilityPool.provideToSP(dec(1000, 18), { from: alice })
      await stabilityPool.provideToSP(dec(2000, 18), { from: bob })
      await stabilityPool.provideToSP(dec(3000, 18), { from: carol })

      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(2000, 18), { from: bob })
      await stabilityPoolERC20.provideToSP(dec(3000, 18), { from: carol })

      // D opens a trove
      await openTrove({ extraVSTAmount: toBN(dec(300, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(300, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      // Would-be defaulters open troves
      await openTrove({ extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      await openTrove({ asset: erc20.address, extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))

      // Defaulters are liquidated
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_2)
      await troveManager.liquidate(erc20.address, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_2)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_2))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_2))

      const alice_VSTDeposit_Before = (await stabilityPool.getCompoundedVSTDeposit(alice)).toString()
      const bob_VSTDeposit_Before = (await stabilityPool.getCompoundedVSTDeposit(bob)).toString()
      const carol_VSTDeposit_Before = (await stabilityPool.getCompoundedVSTDeposit(carol)).toString()

      const alice_VSTDeposit_BeforeERC20 = (await stabilityPoolERC20.getCompoundedVSTDeposit(alice)).toString()
      const bob_VSTDeposit_BeforeERC20 = (await stabilityPoolERC20.getCompoundedVSTDeposit(bob)).toString()
      const carol_VSTDeposit_BeforeERC20 = (await stabilityPoolERC20.getCompoundedVSTDeposit(carol)).toString()

      const alice_ETHGain_Before = (await stabilityPool.getDepositorAssetGain(alice)).toString()
      const bob_ETHGain_Before = (await stabilityPool.getDepositorAssetGain(bob)).toString()
      const carol_ETHGain_Before = (await stabilityPool.getDepositorAssetGain(carol)).toString()

      const alice_ETHGain_BeforeERC20 = (await stabilityPoolERC20.getDepositorAssetGain(alice)).toString()
      const bob_ETHGain_BeforeERC20 = (await stabilityPoolERC20.getDepositorAssetGain(bob)).toString()
      const carol_ETHGain_BeforeERC20 = (await stabilityPoolERC20.getDepositorAssetGain(carol)).toString()

      //check non-zero VST and AssetGain in the Stability Pool
      const VSTinSP = await stabilityPool.getTotalVSTDeposits()
      const ETHinSP = await stabilityPool.getAssetBalance()
      const VSTinSPERC20 = await stabilityPoolERC20.getTotalVSTDeposits()
      const ETHinSPERC20 = await stabilityPoolERC20.getAssetBalance()
      assert.isTrue(VSTinSP.gt(mv._zeroBN))
      assert.isTrue(ETHinSP.gt(mv._zeroBN))
      assert.isTrue(VSTinSPERC20.gt(mv._zeroBN))
      assert.isTrue(ETHinSPERC20.gt(mv._zeroBN))

      // D makes an SP deposit
      await stabilityPool.provideToSP(dec(1000, 18), { from: dennis })
      assert.equal((await stabilityPool.getCompoundedVSTDeposit(dennis)).toString(), dec(1000, 18))

      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: dennis })
      assert.equal((await stabilityPoolERC20.getCompoundedVSTDeposit(dennis)).toString(), dec(1000, 18))

      const alice_VSTDeposit_After = (await stabilityPool.getCompoundedVSTDeposit(alice)).toString()
      const bob_VSTDeposit_After = (await stabilityPool.getCompoundedVSTDeposit(bob)).toString()
      const carol_VSTDeposit_After = (await stabilityPool.getCompoundedVSTDeposit(carol)).toString()

      const alice_VSTDeposit_AfterERC20 = (await stabilityPoolERC20.getCompoundedVSTDeposit(alice)).toString()
      const bob_VSTDeposit_AfterERC20 = (await stabilityPoolERC20.getCompoundedVSTDeposit(bob)).toString()
      const carol_VSTDeposit_AfterERC20 = (await stabilityPoolERC20.getCompoundedVSTDeposit(carol)).toString()

      const alice_ETHGain_After = (await stabilityPool.getDepositorAssetGain(alice)).toString()
      const bob_ETHGain_After = (await stabilityPool.getDepositorAssetGain(bob)).toString()
      const carol_ETHGain_After = (await stabilityPool.getDepositorAssetGain(carol)).toString()

      const alice_ETHGain_AfterERC20 = (await stabilityPoolERC20.getDepositorAssetGain(alice)).toString()
      const bob_ETHGain_AfterERC20 = (await stabilityPoolERC20.getDepositorAssetGain(bob)).toString()
      const carol_ETHGain_AfterERC20 = (await stabilityPoolERC20.getDepositorAssetGain(carol)).toString()

      // Check compounded deposits and ETH gains for A, B and C have not changed
      assert.equal(alice_VSTDeposit_Before, alice_VSTDeposit_After)
      assert.equal(bob_VSTDeposit_Before, bob_VSTDeposit_After)
      assert.equal(carol_VSTDeposit_Before, carol_VSTDeposit_After)

      assert.equal(alice_VSTDeposit_BeforeERC20, alice_VSTDeposit_AfterERC20)
      assert.equal(bob_VSTDeposit_BeforeERC20, bob_VSTDeposit_AfterERC20)
      assert.equal(carol_VSTDeposit_BeforeERC20, carol_VSTDeposit_AfterERC20)

      assert.equal(alice_ETHGain_Before, alice_ETHGain_After)
      assert.equal(bob_ETHGain_Before, bob_ETHGain_After)
      assert.equal(carol_ETHGain_Before, carol_ETHGain_After)

      assert.equal(alice_ETHGain_BeforeERC20, alice_ETHGain_AfterERC20)
      assert.equal(bob_ETHGain_BeforeERC20, bob_ETHGain_AfterERC20)
      assert.equal(carol_ETHGain_BeforeERC20, carol_ETHGain_AfterERC20)
    })

    it("provideToSP(): doesn't impact system debt, collateral or TCR", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await stabilityPool.provideToSP(dec(1000, 18), { from: alice })
      await stabilityPool.provideToSP(dec(2000, 18), { from: bob })
      await stabilityPool.provideToSP(dec(3000, 18), { from: carol })

      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(2000, 18), { from: bob })
      await stabilityPoolERC20.provideToSP(dec(3000, 18), { from: carol })

      // D opens a trove
      await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      // Would-be defaulters open troves
      await openTrove({ extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      await openTrove({ asset: erc20.address, extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, extraVSTAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))

      // Defaulters are liquidated
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_2)
      await troveManager.liquidate(erc20.address, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_2)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_2))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_2))

      const activeDebt_Before = (await activePool.getVSTDebt(ZERO_ADDRESS)).toString()
      const defaultedDebt_Before = (await defaultPool.getVSTDebt(ZERO_ADDRESS)).toString()
      const activeColl_Before = (await activePool.getAssetBalance(ZERO_ADDRESS)).toString()
      const defaultedColl_Before = (await defaultPool.getAssetBalance(ZERO_ADDRESS)).toString()
      const TCR_Before = (await th.getTCR(contracts)).toString()

      const activeDebt_BeforeERC20 = (await activePool.getVSTDebt(erc20.address)).toString()
      const defaultedDebt_BeforeERC20 = (await defaultPool.getVSTDebt(erc20.address)).toString()
      const activeColl_BeforeERC20 = (await activePool.getAssetBalance(erc20.address)).toString()
      const defaultedColl_BeforeERC20 = (await defaultPool.getAssetBalance(erc20.address)).toString()
      const TCR_BeforeERC20 = (await th.getTCR(contracts, erc20.address)).toString()

      // D makes an SP deposit
      await stabilityPool.provideToSP(dec(1000, 18), { from: dennis })
      assert.equal((await stabilityPool.getCompoundedVSTDeposit(dennis)).toString(), dec(1000, 18))

      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: dennis })
      assert.equal((await stabilityPoolERC20.getCompoundedVSTDeposit(dennis)).toString(), dec(1000, 18))

      const activeDebt_After = (await activePool.getVSTDebt(ZERO_ADDRESS)).toString()
      const defaultedDebt_After = (await defaultPool.getVSTDebt(ZERO_ADDRESS)).toString()
      const activeColl_After = (await activePool.getAssetBalance(ZERO_ADDRESS)).toString()
      const defaultedColl_After = (await defaultPool.getAssetBalance(ZERO_ADDRESS)).toString()
      const TCR_After = (await th.getTCR(contracts)).toString()

      const activeDebt_AfterERC20 = (await activePool.getVSTDebt(erc20.address)).toString()
      const defaultedDebt_AfterERC20 = (await defaultPool.getVSTDebt(erc20.address)).toString()
      const activeColl_AfterERC20 = (await activePool.getAssetBalance(erc20.address)).toString()
      const defaultedColl_AfterERC20 = (await defaultPool.getAssetBalance(erc20.address)).toString()
      const TCR_AfterERC20 = (await th.getTCR(contracts, erc20.address)).toString()

      // Check total system debt, collateral and TCR have not changed after a Stability deposit is made
      assert.equal(activeDebt_Before, activeDebt_After)
      assert.equal(defaultedDebt_Before, defaultedDebt_After)
      assert.equal(activeColl_Before, activeColl_After)
      assert.equal(defaultedColl_Before, defaultedColl_After)
      assert.equal(TCR_Before, TCR_After)

      assert.equal(activeDebt_BeforeERC20, activeDebt_AfterERC20)
      assert.equal(defaultedDebt_BeforeERC20, defaultedDebt_AfterERC20)
      assert.equal(activeColl_BeforeERC20, activeColl_AfterERC20)
      assert.equal(defaultedColl_BeforeERC20, defaultedColl_AfterERC20)
      assert.equal(TCR_BeforeERC20, TCR_AfterERC20)
    })

    it("provideToSP(): doesn't impact any troves, including the caller's trove", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // A and B provide to SP
      await stabilityPool.provideToSP(dec(1000, 18), { from: alice })
      await stabilityPool.provideToSP(dec(2000, 18), { from: bob })

      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(2000, 18), { from: bob })

      // D opens a trove
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))
      const price = await priceFeed.getPrice()

      // Get debt, collateral and ICR of all existing troves
      const whale_Debt_Before = (await troveManager.Troves(whale, ZERO_ADDRESS))[0].toString()
      const alice_Debt_Before = (await troveManager.Troves(alice, ZERO_ADDRESS))[0].toString()
      const bob_Debt_Before = (await troveManager.Troves(bob, ZERO_ADDRESS))[0].toString()
      const carol_Debt_Before = (await troveManager.Troves(carol, ZERO_ADDRESS))[0].toString()
      const dennis_Debt_Before = (await troveManager.Troves(dennis, ZERO_ADDRESS))[0].toString()

      const whale_Debt_BeforeERC20 = (await troveManager.Troves(whale, erc20.address))[0].toString()
      const alice_Debt_BeforeERC20 = (await troveManager.Troves(alice, erc20.address))[0].toString()
      const bob_Debt_BeforeERC20 = (await troveManager.Troves(bob, erc20.address))[0].toString()
      const carol_Debt_BeforeERC20 = (await troveManager.Troves(carol, erc20.address))[0].toString()
      const dennis_Debt_BeforeERC20 = (await troveManager.Troves(dennis, erc20.address))[0].toString()

      const whale_Coll_Before = (await troveManager.Troves(whale, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()
      const alice_Coll_Before = (await troveManager.Troves(alice, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()
      const bob_Coll_Before = (await troveManager.Troves(bob, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()
      const carol_Coll_Before = (await troveManager.Troves(carol, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()
      const dennis_Coll_Before = (await troveManager.Troves(dennis, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()

      const whale_Coll_BeforeERC20 = (await troveManager.Troves(whale, erc20.address,))[th.TROVE_COLL_INDEX].toString()
      const alice_Coll_BeforeERC20 = (await troveManager.Troves(alice, erc20.address,))[th.TROVE_COLL_INDEX].toString()
      const bob_Coll_BeforeERC20 = (await troveManager.Troves(bob, erc20.address,))[th.TROVE_COLL_INDEX].toString()
      const carol_Coll_BeforeERC20 = (await troveManager.Troves(carol, erc20.address,))[th.TROVE_COLL_INDEX].toString()
      const dennis_Coll_BeforeERC20 = (await troveManager.Troves(dennis, erc20.address,))[th.TROVE_COLL_INDEX].toString()

      const whale_ICR_Before = (await troveManager.getCurrentICR(ZERO_ADDRESS, whale, price)).toString()
      const alice_ICR_Before = (await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).toString()
      const bob_ICR_Before = (await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).toString()
      const carol_ICR_Before = (await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).toString()
      const dennis_ICR_Before = (await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)).toString()

      const whale_ICR_BeforeERC20 = (await troveManager.getCurrentICR(erc20.address, whale, price)).toString()
      const alice_ICR_BeforeERC20 = (await troveManager.getCurrentICR(erc20.address, alice, price)).toString()
      const bob_ICR_BeforeERC20 = (await troveManager.getCurrentICR(erc20.address, bob, price)).toString()
      const carol_ICR_BeforeERC20 = (await troveManager.getCurrentICR(erc20.address, carol, price)).toString()
      const dennis_ICR_BeforeERC20 = (await troveManager.getCurrentICR(erc20.address, dennis, price)).toString()

      // D makes an SP deposit
      await stabilityPool.provideToSP(dec(1000, 18), { from: dennis })
      assert.equal((await stabilityPool.getCompoundedVSTDeposit(dennis)).toString(), dec(1000, 18))

      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: dennis })
      assert.equal((await stabilityPoolERC20.getCompoundedVSTDeposit(dennis)).toString(), dec(1000, 18))

      const whale_Debt_After = (await troveManager.Troves(whale, ZERO_ADDRESS,))[0].toString()
      const alice_Debt_After = (await troveManager.Troves(alice, ZERO_ADDRESS,))[0].toString()
      const bob_Debt_After = (await troveManager.Troves(bob, ZERO_ADDRESS,))[0].toString()
      const carol_Debt_After = (await troveManager.Troves(carol, ZERO_ADDRESS,))[0].toString()
      const dennis_Debt_After = (await troveManager.Troves(dennis, ZERO_ADDRESS,))[0].toString()

      const whale_Coll_After = (await troveManager.Troves(whale, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()
      const alice_Coll_After = (await troveManager.Troves(alice, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()
      const bob_Coll_After = (await troveManager.Troves(bob, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()
      const carol_Coll_After = (await troveManager.Troves(carol, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()
      const dennis_Coll_After = (await troveManager.Troves(dennis, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()

      const whale_ICR_After = (await troveManager.getCurrentICR(ZERO_ADDRESS, whale, price)).toString()
      const alice_ICR_After = (await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).toString()
      const bob_ICR_After = (await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).toString()
      const carol_ICR_After = (await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).toString()
      const dennis_ICR_After = (await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)).toString()


      const whale_Debt_AfterERC20 = (await troveManager.Troves(whale, erc20.address,))[0].toString()
      const alice_Debt_AfterERC20 = (await troveManager.Troves(alice, erc20.address,))[0].toString()
      const bob_Debt_AfterERC20 = (await troveManager.Troves(bob, erc20.address,))[0].toString()
      const carol_Debt_AfterERC20 = (await troveManager.Troves(carol, erc20.address,))[0].toString()
      const dennis_Debt_AfterERC20 = (await troveManager.Troves(dennis, erc20.address,))[0].toString()

      const whale_Coll_AfterERC20 = (await troveManager.Troves(whale, erc20.address,))[th.TROVE_COLL_INDEX].toString()
      const alice_Coll_AfterERC20 = (await troveManager.Troves(alice, erc20.address,))[th.TROVE_COLL_INDEX].toString()
      const bob_Coll_AfterERC20 = (await troveManager.Troves(bob, erc20.address,))[th.TROVE_COLL_INDEX].toString()
      const carol_Coll_AfterERC20 = (await troveManager.Troves(carol, erc20.address,))[th.TROVE_COLL_INDEX].toString()
      const dennis_Coll_AfterERC20 = (await troveManager.Troves(dennis, erc20.address,))[th.TROVE_COLL_INDEX].toString()

      const whale_ICR_AfterERC20 = (await troveManager.getCurrentICR(erc20.address, whale, price)).toString()
      const alice_ICR_AfterERC20 = (await troveManager.getCurrentICR(erc20.address, alice, price)).toString()
      const bob_ICR_AfterERC20 = (await troveManager.getCurrentICR(erc20.address, bob, price)).toString()
      const carol_ICR_AfterERC20 = (await troveManager.getCurrentICR(erc20.address, carol, price)).toString()
      const dennis_ICR_AfterERC20 = (await troveManager.getCurrentICR(erc20.address, dennis, price)).toString()

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


      assert.equal(whale_Debt_BeforeERC20, whale_Debt_AfterERC20)
      assert.equal(alice_Debt_BeforeERC20, alice_Debt_AfterERC20)
      assert.equal(bob_Debt_BeforeERC20, bob_Debt_AfterERC20)
      assert.equal(carol_Debt_BeforeERC20, carol_Debt_AfterERC20)
      assert.equal(dennis_Debt_BeforeERC20, dennis_Debt_AfterERC20)

      assert.equal(whale_Coll_BeforeERC20, whale_Coll_AfterERC20)
      assert.equal(alice_Coll_BeforeERC20, alice_Coll_AfterERC20)
      assert.equal(bob_Coll_BeforeERC20, bob_Coll_AfterERC20)
      assert.equal(carol_Coll_BeforeERC20, carol_Coll_AfterERC20)
      assert.equal(dennis_Coll_BeforeERC20, dennis_Coll_AfterERC20)

      assert.equal(whale_ICR_BeforeERC20, whale_ICR_AfterERC20)
      assert.equal(alice_ICR_BeforeERC20, alice_ICR_AfterERC20)
      assert.equal(bob_ICR_BeforeERC20, bob_ICR_AfterERC20)
      assert.equal(carol_ICR_BeforeERC20, carol_ICR_AfterERC20)
      assert.equal(dennis_ICR_BeforeERC20, dennis_ICR_AfterERC20)
    })

    it("provideToSP(): doesn't protect the depositor's trove from liquidation", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // A, B provide 100 VST to SP
      await stabilityPool.provideToSP(dec(1000, 18), { from: alice })
      await stabilityPool.provideToSP(dec(1000, 18), { from: bob })

      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: bob })

      // Confirm Bob has an active trove in the system
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, bob))
      assert.equal((await troveManager.getTroveStatus(ZERO_ADDRESS, bob)).toString(), '1')

      assert.isTrue(await sortedTroves.contains(erc20.address, bob))
      assert.equal((await troveManager.getTroveStatus(erc20.address, bob)).toString(), '1')

      // Confirm Bob has a Stability deposit
      assert.equal((await stabilityPool.getCompoundedVSTDeposit(bob)).toString(), dec(1000, 18))
      assert.equal((await stabilityPoolERC20.getCompoundedVSTDeposit(bob)).toString(), dec(1000, 18))

      // Price drops
      await priceFeed.setPrice(dec(105, 18))
      const price = await priceFeed.getPrice()

      // Liquidate bob
      await troveManager.liquidate(ZERO_ADDRESS, bob)
      await troveManager.liquidate(erc20.address, bob)

      // Check Bob's trove has been removed from the system
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
      assert.equal((await troveManager.getTroveStatus(ZERO_ADDRESS, bob)).toString(), '3')

      assert.isFalse(await sortedTroves.contains(erc20.address, bob))
      assert.equal((await troveManager.getTroveStatus(erc20.address, bob)).toString(), '3')
    })

    it("provideToSP(): providing 0 VST reverts", async () => {
      // --- SETUP ---
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // A, B, C provides 100, 50, 30 VST to SP
      await stabilityPool.provideToSP(dec(100, 18), { from: alice })
      await stabilityPool.provideToSP(dec(50, 18), { from: bob })
      await stabilityPool.provideToSP(dec(30, 18), { from: carol })

      await stabilityPoolERC20.provideToSP(dec(100, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(50, 18), { from: bob })
      await stabilityPoolERC20.provideToSP(dec(30, 18), { from: carol })

      const bob_Deposit_Before = (await stabilityPool.getCompoundedVSTDeposit(bob)).toString()
      const VSTinSP_Before = (await stabilityPool.getTotalVSTDeposits()).toString()

      const bob_Deposit_BeforeERC20 = (await stabilityPoolERC20.getCompoundedVSTDeposit(bob)).toString()
      const VSTinSP_BeforeERC20 = (await stabilityPoolERC20.getTotalVSTDeposits()).toString()

      assert.equal(VSTinSP_Before, dec(180, 18))
      assert.equal(VSTinSP_BeforeERC20, dec(180, 18))

      // Bob provides 0 VST to the Stability Pool 
      const txPromise_B = stabilityPool.provideToSP(0, { from: bob })
      await th.assertRevert(txPromise_B)

      const txPromise_BERC20 = stabilityPoolERC20.provideToSP(0, { from: bob })
      await th.assertRevert(txPromise_BERC20)
    })

    // --- VSTA functionality ---
    it("provideToSP(), new deposit: when SP > 0, triggers VSTA reward event - increases the sum G", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // A provides to SP
      await stabilityPool.provideToSP(dec(1000, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: A })

      let currentEpoch = await stabilityPool.currentEpoch()
      let currentScale = await stabilityPool.currentScale()
      const G_Before = await stabilityPool.epochToScaleToG(currentEpoch, currentScale)

      let currentEpochERC20 = await stabilityPoolERC20.currentEpoch()
      let currentScaleERC20 = await stabilityPoolERC20.currentScale()
      const G_BeforeERC20 = await stabilityPoolERC20.epochToScaleToG(currentEpochERC20, currentScaleERC20)

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // B provides to SP
      await stabilityPool.provideToSP(dec(1000, 18), { from: B })
      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: B })

      currentEpoch = await stabilityPool.currentEpoch()
      currentScale = await stabilityPool.currentScale()
      const G_After = await stabilityPool.epochToScaleToG(currentEpoch, currentScale)

      currentEpochERC20 = await stabilityPoolERC20.currentEpoch()
      currentScaleERC20 = await stabilityPoolERC20.currentScale()
      const G_AfterERC20 = await stabilityPoolERC20.epochToScaleToG(currentEpochERC20, currentScaleERC20)

      // Expect G has increased from the VSTA reward event triggered
      assert.isTrue(G_After.gt(G_Before))
      assert.isTrue(G_AfterERC20.gt(G_BeforeERC20))
    })

    it("provideToSP(), new deposit: when SP is empty, doesn't update G", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // A provides to SP
      await stabilityPool.provideToSP(dec(1000, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: A })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // A withdraws
      await stabilityPool.withdrawFromSP(dec(1000, 18), { from: A })
      await stabilityPoolERC20.withdrawFromSP(dec(1000, 18), { from: A })

      // Check SP is empty
      assert.equal((await stabilityPool.getTotalVSTDeposits()), '0')
      assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()), '0')

      // Check G is non-zero
      let currentEpoch = await stabilityPool.currentEpoch()
      let currentScale = await stabilityPool.currentScale()
      const G_Before = await stabilityPool.epochToScaleToG(currentEpoch, currentScale)

      let currentEpochERC20 = await stabilityPoolERC20.currentEpoch()
      let currentScaleERC20 = await stabilityPoolERC20.currentScale()
      const G_BeforeERC20 = await stabilityPoolERC20.epochToScaleToG(currentEpochERC20, currentScaleERC20)

      assert.isTrue(G_Before.gt(toBN('0')))
      assert.isTrue(G_BeforeERC20.gt(toBN('0')))

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // B provides to SP
      await stabilityPool.provideToSP(dec(1000, 18), { from: B })
      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: B })

      currentEpoch = await stabilityPool.currentEpoch()
      currentScale = await stabilityPool.currentScale()
      const G_After = await stabilityPool.epochToScaleToG(currentEpoch, currentScale)

      currentEpochERC20 = await stabilityPoolERC20.currentEpoch()
      currentScaleERC20 = await stabilityPoolERC20.currentScale()
      const G_AfterERC20 = await stabilityPoolERC20.epochToScaleToG(currentEpochERC20, currentScaleERC20)

      // Expect G has not changed
      assert.isTrue(G_After.eq(G_Before))
      assert.isTrue(G_AfterERC20.eq(G_BeforeERC20))
    })

    it("provideToSP(), new deposit: sets the correct front end tag", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

      // A, B, C, D open troves and make Stability Pool deposits
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // A, B, C, D provides to SP
      await stabilityPool.provideToSP(dec(1000, 18), { from: A })
      await stabilityPool.provideToSP(dec(2000, 18), { from: B })
      await stabilityPool.provideToSP(dec(3000, 18), { from: C })
      await stabilityPool.provideToSP(dec(4000, 18), { from: D })

      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(2000, 18), { from: B })
      await stabilityPoolERC20.provideToSP(dec(3000, 18), { from: C })
      await stabilityPoolERC20.provideToSP(dec(4000, 18), { from: D })
    })

    it("provideToSP(), new deposit: depositor does not receive any VSTA rewards", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({
        asset: erc20.address, assetSent: dec(50, 'ether'), extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale }
      })

      // A, B, open troves 
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })

      // Get A, B, C VSTA balances before and confirm they're zero
      const A_VSTABalance_Before = await vstaToken.balanceOf(A)
      const B_VSTABalance_Before = await vstaToken.balanceOf(B)

      assert.equal(A_VSTABalance_Before, '0')
      assert.equal(B_VSTABalance_Before, '0')

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // A, B provide to SP
      await stabilityPool.provideToSP(dec(1000, 18), { from: A })
      await stabilityPool.provideToSP(dec(2000, 18), { from: B })

      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(2000, 18), { from: B })

      // Get A, B, C VSTA balances after, and confirm they're still zero
      const A_VSTABalance_After = await vstaToken.balanceOf(A)
      const B_VSTABalance_After = await vstaToken.balanceOf(B)

      assert.equal(A_VSTABalance_After, '0')
      assert.equal(B_VSTABalance_After, '0')
    })

    it("provideToSP(), new deposit after past full withdrawal: depositor does not receive any VSTA rewards", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C, open troves 
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(4000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(4000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // --- SETUP --- 

      const initialDeposit_A = (await vstToken.balanceOf(A)).div(toBN(2))
      const initialDeposit_B = (await vstToken.balanceOf(B)).div(toBN(2))
      // A, B provide to SP
      await stabilityPool.provideToSP(initialDeposit_A, { from: A })
      await stabilityPool.provideToSP(initialDeposit_B, { from: B })

      await stabilityPoolERC20.provideToSP(initialDeposit_A, { from: A })
      await stabilityPoolERC20.provideToSP(initialDeposit_B, { from: B })

      // time passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // C deposits. A, and B earn VSTA
      await stabilityPool.provideToSP(dec(5, 18), { from: C })
      await stabilityPoolERC20.provideToSP(dec(5, 18), { from: C })

      // Price drops, defaulter is liquidated, A, B and C earn ETH
      await priceFeed.setPrice(dec(105, 18))
      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)

      // price bounces back to 200 
      await priceFeed.setPrice(dec(200, 18))

      // A and B fully withdraw from the pool
      await stabilityPool.withdrawFromSP(initialDeposit_A, { from: A })
      await stabilityPool.withdrawFromSP(initialDeposit_B, { from: B })

      await stabilityPoolERC20.withdrawFromSP(initialDeposit_A, { from: A })
      await stabilityPoolERC20.withdrawFromSP(initialDeposit_B, { from: B })

      // --- TEST --- 

      // Get A, B, C VSTA balances before and confirm they're non-zero
      const A_VSTABalance_Before = await vstaToken.balanceOf(A)
      const B_VSTABalance_Before = await vstaToken.balanceOf(B)
      assert.isTrue(A_VSTABalance_Before.gt(toBN('0')))
      assert.isTrue(B_VSTABalance_Before.gt(toBN('0')))

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // A, B provide to SP
      await stabilityPool.provideToSP(dec(100, 18), { from: A })
      await stabilityPool.provideToSP(dec(200, 18), { from: B })

      await stabilityPoolERC20.provideToSP(dec(100, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(200, 18), { from: B })

      // Get A, B, C VSTA balances after, and confirm they have not changed
      const A_VSTABalance_After = await vstaToken.balanceOf(A)
      const B_VSTABalance_After = await vstaToken.balanceOf(B)

      assert.isTrue(A_VSTABalance_After.eq(A_VSTABalance_Before))
      assert.isTrue(B_VSTABalance_After.eq(B_VSTABalance_Before))
    })

    it("provideToSP(), new eligible deposit: tagged System's stake increases", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C, open troves 
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Get front ends' stakes before
      const stake_Before = await stabilityPool.totalStakes()
      const stake_BeforeERC20 = await stabilityPoolERC20.totalStakes()

      const deposit_A = toBN(dec(1000, 18))
      const deposit_B = toBN(dec(2000, 18))
      const deposit_C = toBN(dec(3000, 18))

      // A, B, C provide to SP
      await stabilityPool.provideToSP(deposit_A, { from: A })
      await stabilityPool.provideToSP(deposit_B, { from: B })
      await stabilityPool.provideToSP(deposit_C, { from: C })

      await stabilityPoolERC20.provideToSP(deposit_A, { from: A })
      await stabilityPoolERC20.provideToSP(deposit_B, { from: B })
      await stabilityPoolERC20.provideToSP(deposit_C, { from: C })

      const stake_After = await stabilityPool.totalStakes()
      const stake_AfterERC20 = await stabilityPoolERC20.totalStakes()

      const Stake_Diff = stake_After.sub(stake_Before)
      const Stake_DiffERC20 = stake_AfterERC20.sub(stake_BeforeERC20)

      // Check front ends' stakes have increased by amount equal to the deposit made through them 
      assert.equal(Stake_Diff.toString(), deposit_A.add(deposit_B).add(deposit_C).toString())
      assert.equal(Stake_DiffERC20.toString(), deposit_A.add(deposit_B).add(deposit_C).toString())
    })

    it("provideToSP(), new eligible deposit: tagged System's snapshots update", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C, open troves 
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // D opens trove
      await openTrove({ extraVSTAmount: toBN(dec(4000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(4000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // --- SETUP ---

      await stabilityPool.provideToSP(dec(2000, 18), { from: D })
      await stabilityPoolERC20.provideToSP(dec(2000, 18), { from: D })

      // fastforward time then  make an SP deposit, to make G > 0
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
      await stabilityPool.provideToSP(dec(2000, 18), { from: D })
      await stabilityPoolERC20.provideToSP(dec(2000, 18), { from: D })

      // Perform a liquidation to make 0 < P < 1, and S > 0
      await priceFeed.setPrice(dec(105, 18))
      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)

      const currentEpoch = await stabilityPool.currentEpoch()
      const currentScale = await stabilityPool.currentScale()

      const S_Before = await stabilityPool.epochToScaleToSum(currentEpoch, currentScale)
      const P_Before = await stabilityPool.P()
      const G_Before = await stabilityPool.epochToScaleToG(currentEpoch, currentScale)

      const currentEpochERC20 = await stabilityPoolERC20.currentEpoch()
      const currentScaleERC20 = await stabilityPoolERC20.currentScale()

      const S_BeforeERC20 = await stabilityPoolERC20.epochToScaleToSum(currentEpochERC20, currentScaleERC20)
      const P_BeforeERC20 = await stabilityPoolERC20.P()
      const G_BeforeERC20 = await stabilityPoolERC20.epochToScaleToG(currentEpochERC20, currentScaleERC20)

      // Confirm 0 < P < 1
      assert.isTrue(P_Before.gt(toBN('0')) && P_Before.lt(toBN(dec(1, 18))))
      assert.isTrue(P_BeforeERC20.gt(toBN('0')) && P_BeforeERC20.lt(toBN(dec(1, 18))))
      // Confirm S, G are both > 0
      assert.isTrue(S_Before.gt(toBN('0')))
      assert.isTrue(G_Before.gt(toBN('0')))
      assert.isTrue(S_BeforeERC20.gt(toBN('0')))
      assert.isTrue(G_BeforeERC20.gt(toBN('0')))

      const deposit_A = dec(1000, 18)
      const deposit_B = dec(2000, 18)

      // --- TEST ---

      // A, B, C provide to SP
      const G1 = await stabilityPool.epochToScaleToG(currentScale, currentEpoch)
      await stabilityPool.provideToSP(deposit_A, { from: A })

      const G2 = await stabilityPoolERC20.epochToScaleToG(currentScale, currentEpoch)
      await stabilityPoolERC20.provideToSP(deposit_B, { from: B })

      const snapshotAfter = await stabilityPool.systemSnapshots()

      // Check snapshots are the expected values
      assert.equal(snapshotAfter[0], '0')  // S (should always be 0 for front ends)
      assert.isTrue(snapshotAfter[1].eq(P_Before))  // P 
      assert.isTrue(snapshotAfter[2].eq(G1))  // G
      assert.equal(snapshotAfter[3], '0')  // scale
      assert.equal(snapshotAfter[4], '0')  // epoch


      const snapshotAfterERC20 = await stabilityPool.systemSnapshots()

      // Check snapshots are the expected values
      assert.equal(snapshotAfterERC20[0], '0')  // S (should always be 0 for front ends)
      assert.isTrue(snapshotAfterERC20[1].eq(P_BeforeERC20))  // P 
      assert.isTrue(snapshotAfterERC20[2].eq(G2))  // G
      assert.equal(snapshotAfterERC20[3], '0')  // scale
      assert.equal(snapshotAfterERC20[4], '0')  // epoch
    })

    it("provideToSP(), new deposit: depositor does not receive ETH gains", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // Whale transfers VST to A, B
      await vstToken.transfer(A, dec(200, 18), { from: whale })
      await vstToken.transfer(B, dec(400, 18), { from: whale })

      // C, D open troves
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // --- TEST ---

      // get current ETH balances
      const A_ETHBalance_Before = await web3.eth.getBalance(A)
      const B_ETHBalance_Before = await web3.eth.getBalance(B)
      const C_ETHBalance_Before = await web3.eth.getBalance(C)
      const D_ETHBalance_Before = await web3.eth.getBalance(D)

      const A_ETHBalance_BeforeERC20 = await erc20.balanceOf(A)
      const B_ETHBalance_BeforeERC20 = await erc20.balanceOf(B)
      const C_ETHBalance_BeforeERC20 = await erc20.balanceOf(C)
      const D_ETHBalance_BeforeERC20 = await erc20.balanceOf(D)

      // A, B, C, D provide to SP
      await stabilityPool.provideToSP(dec(100, 18), { from: A, gasPrice: 0 })
      await stabilityPool.provideToSP(dec(200, 18), { from: B, gasPrice: 0 })
      await stabilityPool.provideToSP(dec(300, 18), { from: C, gasPrice: 0 })
      await stabilityPool.provideToSP(dec(400, 18), { from: D, gasPrice: 0 })

      await stabilityPoolERC20.provideToSP(dec(100, 18), { from: A, gasPrice: 0 })
      await stabilityPoolERC20.provideToSP(dec(200, 18), { from: B, gasPrice: 0 })
      await stabilityPoolERC20.provideToSP(dec(300, 18), { from: C, gasPrice: 0 })
      await stabilityPoolERC20.provideToSP(dec(400, 18), { from: D, gasPrice: 0 })

      // Get  ETH balances after
      const A_ETHBalance_After = await web3.eth.getBalance(A)
      const B_ETHBalance_After = await web3.eth.getBalance(B)
      const C_ETHBalance_After = await web3.eth.getBalance(C)
      const D_ETHBalance_After = await web3.eth.getBalance(D)

      const A_ETHBalance_AfterERC20 = await erc20.balanceOf(A)
      const B_ETHBalance_AfterERC20 = await erc20.balanceOf(B)
      const C_ETHBalance_AfterERC20 = await erc20.balanceOf(C)
      const D_ETHBalance_AfterERC20 = await erc20.balanceOf(D)

      // Check ETH balances have not changed
      assert.equal(A_ETHBalance_After, A_ETHBalance_Before)
      assert.equal(B_ETHBalance_After, B_ETHBalance_Before)
      assert.equal(C_ETHBalance_After, C_ETHBalance_Before)
      assert.equal(D_ETHBalance_After, D_ETHBalance_Before)

      assert.equal(A_ETHBalance_AfterERC20, A_ETHBalance_BeforeERC20.toString())
      assert.equal(B_ETHBalance_AfterERC20, B_ETHBalance_BeforeERC20.toString())
      assert.equal(C_ETHBalance_AfterERC20, C_ETHBalance_BeforeERC20.toString())
      assert.equal(D_ETHBalance_AfterERC20, D_ETHBalance_BeforeERC20.toString())
    })

    it("provideToSP(), new deposit after past full withdrawal: depositor does not receive ETH gains", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // Whale transfers VST to A, B
      await vstToken.transfer(A, dec(2000, 18), { from: whale })
      await vstToken.transfer(B, dec(2000, 18), { from: whale })

      // C, D open troves
      await openTrove({ extraVSTAmount: toBN(dec(4000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(4000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // --- SETUP ---
      // A, B, C, D provide to SP
      await stabilityPool.provideToSP(dec(105, 18), { from: A })
      await stabilityPool.provideToSP(dec(105, 18), { from: B })
      await stabilityPool.provideToSP(dec(105, 18), { from: C })
      await stabilityPool.provideToSP(dec(105, 18), { from: D })

      await stabilityPoolERC20.provideToSP(dec(105, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(105, 18), { from: B })
      await stabilityPoolERC20.provideToSP(dec(105, 18), { from: C })
      await stabilityPoolERC20.provideToSP(dec(105, 18), { from: D })

      // time passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // B deposits. A,B,C,D earn VSTA
      await stabilityPool.provideToSP(dec(5, 18), { from: B })
      await stabilityPoolERC20.provideToSP(dec(5, 18), { from: B })

      // Price drops, defaulter is liquidated, A, B, C, D earn ETH
      await priceFeed.setPrice(dec(105, 18))
      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)

      // Price bounces back
      await priceFeed.setPrice(dec(200, 18))

      // A B,C, D fully withdraw from the pool
      await stabilityPool.withdrawFromSP(dec(105, 18), { from: A })
      await stabilityPool.withdrawFromSP(dec(105, 18), { from: B })
      await stabilityPool.withdrawFromSP(dec(105, 18), { from: C })
      await stabilityPool.withdrawFromSP(dec(105, 18), { from: D })

      await stabilityPoolERC20.withdrawFromSP(dec(105, 18), { from: A })
      await stabilityPoolERC20.withdrawFromSP(dec(105, 18), { from: B })
      await stabilityPoolERC20.withdrawFromSP(dec(105, 18), { from: C })
      await stabilityPoolERC20.withdrawFromSP(dec(105, 18), { from: D })

      // --- TEST ---

      // get current ETH balances
      const A_ETHBalance_Before = await web3.eth.getBalance(A)
      const B_ETHBalance_Before = await web3.eth.getBalance(B)
      const C_ETHBalance_Before = await web3.eth.getBalance(C)
      const D_ETHBalance_Before = await web3.eth.getBalance(D)

      const A_ETHBalance_BeforeERC20 = await erc20.balanceOf(A)
      const B_ETHBalance_BeforeERC20 = await erc20.balanceOf(B)
      const C_ETHBalance_BeforeERC20 = await erc20.balanceOf(C)
      const D_ETHBalance_BeforeERC20 = await erc20.balanceOf(D)

      // A, B, C, D provide to SP
      await stabilityPool.provideToSP(dec(100, 18), { from: A, gasPrice: 0 })
      await stabilityPool.provideToSP(dec(200, 18), { from: B, gasPrice: 0 })
      await stabilityPool.provideToSP(dec(300, 18), { from: C, gasPrice: 0 })
      await stabilityPool.provideToSP(dec(400, 18), { from: D, gasPrice: 0 })

      await stabilityPoolERC20.provideToSP(dec(100, 18), { from: A, gasPrice: 0 })
      await stabilityPoolERC20.provideToSP(dec(200, 18), { from: B, gasPrice: 0 })
      await stabilityPoolERC20.provideToSP(dec(300, 18), { from: C, gasPrice: 0 })
      await stabilityPoolERC20.provideToSP(dec(400, 18), { from: D, gasPrice: 0 })

      // Get  ETH balances after
      const A_ETHBalance_After = await web3.eth.getBalance(A)
      const B_ETHBalance_After = await web3.eth.getBalance(B)
      const C_ETHBalance_After = await web3.eth.getBalance(C)
      const D_ETHBalance_After = await web3.eth.getBalance(D)

      const A_ETHBalance_AfterERC20 = await erc20.balanceOf(A)
      const B_ETHBalance_AfterERC20 = await erc20.balanceOf(B)
      const C_ETHBalance_AfterERC20 = await erc20.balanceOf(C)
      const D_ETHBalance_AfterERC20 = await erc20.balanceOf(D)

      // Check ETH balances have not changed
      assert.equal(A_ETHBalance_After, A_ETHBalance_Before)
      assert.equal(B_ETHBalance_After, B_ETHBalance_Before)
      assert.equal(C_ETHBalance_After, C_ETHBalance_Before)
      assert.equal(D_ETHBalance_After, D_ETHBalance_Before)

      assert.equal(A_ETHBalance_AfterERC20.toString(), A_ETHBalance_BeforeERC20.toString())
      assert.equal(B_ETHBalance_AfterERC20.toString(), B_ETHBalance_BeforeERC20.toString())
      assert.equal(C_ETHBalance_AfterERC20.toString(), C_ETHBalance_BeforeERC20.toString())
      assert.equal(D_ETHBalance_AfterERC20.toString(), D_ETHBalance_BeforeERC20.toString())
    })

    it("provideToSP(), topup: triggers VSTA reward event - increases the sum G", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C open troves 
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })


      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // A, B, C provide to SP
      await stabilityPool.provideToSP(dec(100, 18), { from: A })
      await stabilityPool.provideToSP(dec(50, 18), { from: B })
      await stabilityPool.provideToSP(dec(50, 18), { from: C })

      await stabilityPoolERC20.provideToSP(dec(100, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(50, 18), { from: B })
      await stabilityPoolERC20.provideToSP(dec(50, 18), { from: C })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      const G_Before = await stabilityPool.epochToScaleToG(0, 0)
      const G_BeforeERC20 = await stabilityPoolERC20.epochToScaleToG(0, 0)

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // B tops up
      await stabilityPool.provideToSP(dec(100, 18), { from: B })
      await stabilityPoolERC20.provideToSP(dec(100, 18), { from: B })

      const G_After = await stabilityPool.epochToScaleToG(0, 0)
      const G_AfterERC20 = await stabilityPoolERC20.epochToScaleToG(0, 0)

      // Expect G has increased from the VSTA reward event triggered by B's topup
      assert.isTrue(G_After.gt(G_Before))
      assert.isTrue(G_AfterERC20.gt(G_BeforeERC20))
    })

    it("provideToSP(), topup: depositor receives VSTA rewards", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C open troves 
      await openTrove({ extraVSTAmount: toBN(dec(100, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(200, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(300, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(200, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(300, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // A, B, C, provide to SP
      await stabilityPool.provideToSP(dec(10, 18), { from: A })
      await stabilityPool.provideToSP(dec(20, 18), { from: B })
      await stabilityPool.provideToSP(dec(30, 18), { from: C })

      await stabilityPoolERC20.provideToSP(dec(10, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(20, 18), { from: B })
      await stabilityPoolERC20.provideToSP(dec(30, 18), { from: C })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // Get A, B, C VSTA balance before
      const A_VSTABalance_Before = await vstaToken.balanceOf(A)
      const B_VSTABalance_Before = await vstaToken.balanceOf(B)
      const C_VSTABalance_Before = await vstaToken.balanceOf(C)

      // A, B, C top up
      await stabilityPool.provideToSP(dec(10, 18), { from: A })
      await stabilityPool.provideToSP(dec(20, 18), { from: B })
      await stabilityPool.provideToSP(dec(30, 18), { from: C })

      await stabilityPoolERC20.provideToSP(dec(10, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(20, 18), { from: B })
      await stabilityPoolERC20.provideToSP(dec(30, 18), { from: C })

      // Get VSTA balance after
      const A_VSTABalance_After = await vstaToken.balanceOf(A)
      const B_VSTABalance_After = await vstaToken.balanceOf(B)
      const C_VSTABalance_After = await vstaToken.balanceOf(C)

      // Check VSTA Balance of A, B, C has increased
      assert.isTrue(A_VSTABalance_After.gt(A_VSTABalance_Before))
      assert.isTrue(B_VSTABalance_After.gt(B_VSTABalance_Before))
      assert.isTrue(C_VSTABalance_After.gt(C_VSTABalance_Before))
    })

    it("provideToSP(), topup: system's stake increases", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraVSTAmount: toBN(dec(100, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })

      await stabilityPool.provideToSP(dec(10, 18), { from: A })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      const F1_Stake_Before = await stabilityPool.totalStakes()

      await stabilityPool.provideToSP(dec(10, 18), { from: A })

      const F1_Stake_After = await stabilityPool.totalStakes()

      assert.isTrue(F1_Stake_After.gt(F1_Stake_Before))
    })

    it("provideToSP(), topup: System's snapshots update", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C, open troves 
      await openTrove({ extraVSTAmount: toBN(dec(200, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(400, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(600, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(200, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(400, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(600, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // D opens trove
      await openTrove({ extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // --- SETUP ---

      const deposit_A = dec(100, 18)
      const deposit_B = dec(200, 18)
      const deposit_C = dec(300, 18)

      // A, B, C make their initial deposits
      await stabilityPool.provideToSP(deposit_A, { from: A })
      await stabilityPool.provideToSP(deposit_B, { from: B })
      await stabilityPool.provideToSP(deposit_C, { from: C })

      await stabilityPoolERC20.provideToSP(deposit_A, { from: A })
      await stabilityPoolERC20.provideToSP(deposit_B, { from: B })
      await stabilityPoolERC20.provideToSP(deposit_C, { from: C })

      // fastforward time then make an SP deposit, to make G > 0
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      const vstD_Balance = toBN(await vstToken.balanceOf(D)).div(toBN(2))
      await stabilityPool.provideToSP(vstD_Balance, { from: D })
      await stabilityPoolERC20.provideToSP(vstD_Balance, { from: D })

      // perform a liquidation to make 0 < P < 1, and S > 0
      await priceFeed.setPrice(dec(100, 18))
      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)

      const currentEpoch = await stabilityPool.currentEpoch()
      const currentScale = await stabilityPool.currentScale()

      const currentEpochERC20 = await stabilityPoolERC20.currentEpoch()
      const currentScaleERC20 = await stabilityPoolERC20.currentScale()

      const S_Before = await stabilityPool.epochToScaleToSum(currentEpoch, currentScale)
      const P_Before = await stabilityPool.P()
      const G_Before = await stabilityPool.epochToScaleToG(currentEpoch, currentScale)

      const S_BeforeERC20 = await stabilityPoolERC20.epochToScaleToSum(currentEpochERC20, currentScaleERC20)
      const P_BeforeERC20 = await stabilityPoolERC20.P()
      const G_BeforeERC20 = await stabilityPoolERC20.epochToScaleToG(currentEpochERC20, currentScaleERC20)

      // Confirm 0 < P < 1
      assert.isTrue(P_Before.gt(toBN('0')) && P_Before.lt(toBN(dec(1, 18))))
      assert.isTrue(P_BeforeERC20.gt(toBN('0')) && P_BeforeERC20.lt(toBN(dec(1, 18))))
      // Confirm S, G are both > 0
      assert.isTrue(S_Before.gt(toBN('0')))
      assert.isTrue(G_Before.gt(toBN('0')))
      assert.isTrue(S_BeforeERC20.gt(toBN('0')))
      assert.isTrue(G_BeforeERC20.gt(toBN('0')))

      // --- TEST ---

      // A, B, C top up their deposits. Grab G at each stage, as it can increase a bit
      // between topups, because some block.timestamp time passes (and LQTY is issued) between ops
      const G1 = await stabilityPool.epochToScaleToG(currentScale, currentEpoch)
      await stabilityPool.provideToSP(deposit_A, { from: A })

      const G1ERC20 = await stabilityPoolERC20.epochToScaleToG(currentScaleERC20, currentEpochERC20)
      await stabilityPoolERC20.provideToSP(deposit_A, { from: A })

      const snapshot = await stabilityPool.systemSnapshots()
      assert.equal(snapshot[0], '0')  // S (should always be 0 for front ends)
      assert.isTrue(snapshot[1].eq(P_Before))  // P 
      assert.isTrue(snapshot[2].eq(G1))  // G
      assert.equal(snapshot[3], '0')  // scale
      assert.equal(snapshot[4], '0')  // epoch


      const snapshotERC20 = await stabilityPoolERC20.systemSnapshots()
      assert.equal(snapshotERC20[0], '0')  // S (should always be 0 for front ends)
      assert.isTrue(snapshotERC20[1].eq(P_BeforeERC20))  // P 
      assert.isTrue(snapshotERC20[2].eq(G1ERC20))  // G
      assert.equal(snapshotERC20[3], '0')  // scale
      assert.equal(snapshotERC20[4], '0')  // epoch
    })


    it("provideToSP(): reverts when amount is zero", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })

      // Whale transfers VST to C, D
      await vstToken.transfer(C, dec(200, 18), { from: whale })
      await vstToken.transfer(D, dec(200, 18), { from: whale })

      txPromise_A = stabilityPool.provideToSP(0, { from: A })
      txPromise_B = stabilityPool.provideToSP(0, { from: B })
      txPromise_C = stabilityPool.provideToSP(0, { from: C })
      txPromise_D = stabilityPool.provideToSP(0, { from: D })

      txPromise_AERC20 = stabilityPoolERC20.provideToSP(0, { from: A })
      txPromise_BERC20 = stabilityPoolERC20.provideToSP(0, { from: B })
      txPromise_CERC20 = stabilityPoolERC20.provideToSP(0, { from: C })
      txPromise_DERC20 = stabilityPoolERC20.provideToSP(0, { from: D })

      await th.assertRevert(txPromise_A, 'StabilityPool: Amount must be non-zero')
      await th.assertRevert(txPromise_B, 'StabilityPool: Amount must be non-zero')
      await th.assertRevert(txPromise_C, 'StabilityPool: Amount must be non-zero')
      await th.assertRevert(txPromise_D, 'StabilityPool: Amount must be non-zero')

      await th.assertRevert(txPromise_AERC20, 'StabilityPool: Amount must be non-zero')
      await th.assertRevert(txPromise_BERC20, 'StabilityPool: Amount must be non-zero')
      await th.assertRevert(txPromise_CERC20, 'StabilityPool: Amount must be non-zero')
      await th.assertRevert(txPromise_DERC20, 'StabilityPool: Amount must be non-zero')
    })

    // --- withdrawFromSP ---

    it("withdrawFromSP(): reverts when user has no active deposit", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(100, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(100, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await stabilityPool.provideToSP(dec(100, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(100, 18), { from: alice })

      const alice_initialDeposit = (await stabilityPool.deposits(alice)).toString()
      const bob_initialDeposit = (await stabilityPool.deposits(bob)).toString()

      const alice_initialDepositERC20 = (await stabilityPoolERC20.deposits(alice)).toString()
      const bob_initialDepositERC20 = (await stabilityPoolERC20.deposits(bob)).toString()

      assert.equal(alice_initialDeposit, dec(100, 18))
      assert.equal(bob_initialDeposit, '0')

      assert.equal(alice_initialDepositERC20, dec(100, 18))
      assert.equal(bob_initialDepositERC20, '0')

      const txAlice = await stabilityPool.withdrawFromSP(dec(100, 18), { from: alice })
      assert.isTrue(txAlice.receipt.status)

      const txAliceERC20 = await stabilityPoolERC20.withdrawFromSP(dec(100, 18), { from: alice })
      assert.isTrue(txAliceERC20.receipt.status)

      try {
        const txBob = await stabilityPool.withdrawFromSP(dec(100, 18), { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        // TODO: infamous issue #99
        //assert.include(err.message, "User must have a non-zero deposit")
      }
      try {
        const txBob = await stabilityPoolERC20.withdrawFromSP(dec(100, 18), { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        // TODO: infamous issue #99
        //assert.include(err.message, "User must have a non-zero deposit")
      }
    })

    it("withdrawFromSP(): reverts when amount > 0 and system has an undercollateralized trove", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(100, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      await stabilityPool.provideToSP(dec(100, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(100, 18), { from: alice })

      const alice_initialDeposit = (await stabilityPool.deposits(alice)).toString()
      assert.equal(alice_initialDeposit, dec(100, 18))

      const alice_initialDepositERC20 = (await stabilityPoolERC20.deposits(alice)).toString()
      assert.equal(alice_initialDepositERC20, dec(100, 18))

      // defaulter opens trove
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // ETH drops, defaulter is in liquidation range (but not liquidated yet)
      await priceFeed.setPrice(dec(100, 18))

      await th.assertRevert(stabilityPool.withdrawFromSP(dec(100, 18), { from: alice }))
      await th.assertRevert(stabilityPoolERC20.withdrawFromSP(dec(100, 18), { from: alice }))
    })

    it("withdrawFromSP(): partial retrieval - retrieves correct VST amount and the entire ETH Gain, and updates deposit", async () => {
      // --- SETUP ---
      // Whale deposits 185000 VST in StabilityPool
      await openTrove({ extraVSTAmount: toBN(dec(1, 24)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1, 24)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPool.provideToSP(dec(185000, 18), { from: whale })
      await stabilityPoolERC20.provideToSP(dec(185000, 18), { from: whale })

      // 2 Troves opened
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      // --- TEST ---

      // Alice makes deposit #1: 15000 VST
      await openTrove({ extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await stabilityPool.provideToSP(dec(15000, 18), { from: alice })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await stabilityPoolERC20.provideToSP(dec(15000, 18), { from: alice })

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 users with Trove with 170 VST drawn are closed
      const liquidationTX_1 = await troveManager.liquidate(ZERO_ADDRESS, defaulter_1, { from: owner })  // 170 VST closed
      const liquidationTX_2 = await troveManager.liquidate(ZERO_ADDRESS, defaulter_2, { from: owner }) // 170 VST closed

      const liquidationTX_1ERC20 = await troveManager.liquidate(erc20.address, defaulter_1, { from: owner })  // 170 VST closed
      const liquidationTX_2ERC20 = await troveManager.liquidate(erc20.address, defaulter_2, { from: owner }) // 170 VST closed

      const [liquidatedDebt_1] = th.getEmittedLiquidationValues(liquidationTX_1)
      const [liquidatedDebt_2] = th.getEmittedLiquidationValues(liquidationTX_2)

      const [liquidatedDebt_1ERC20] = th.getEmittedLiquidationValues(liquidationTX_1ERC20)
      const [liquidatedDebt_2ERC20] = th.getEmittedLiquidationValues(liquidationTX_2ERC20)

      // Alice VSTLoss is ((15000/200000) * liquidatedDebt), for each liquidation
      const expectedVSTLoss_A = (liquidatedDebt_1.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18))))
        .add(liquidatedDebt_2.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18))))

      const expectedVSTLoss_AERC20 = (liquidatedDebt_1ERC20.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18))))
        .add(liquidatedDebt_2ERC20.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18))))

      const expectedCompoundedVSTDeposit_A = toBN(dec(15000, 18)).sub(expectedVSTLoss_A)
      const compoundedVSTDeposit_A = await stabilityPool.getCompoundedVSTDeposit(alice)

      const expectedCompoundedVSTDeposit_AERC20 = toBN(dec(15000, 18)).sub(expectedVSTLoss_AERC20)
      const compoundedVSTDeposit_AERC20 = await stabilityPoolERC20.getCompoundedVSTDeposit(alice)

      assert.isAtMost(th.getDifference(expectedCompoundedVSTDeposit_A, compoundedVSTDeposit_A), 100000)
      assert.isAtMost(th.getDifference(expectedCompoundedVSTDeposit_AERC20, compoundedVSTDeposit_AERC20), 100000)

      // Alice retrieves part of her entitled VST: 9000 VST
      await stabilityPool.withdrawFromSP(dec(9000, 18), { from: alice })
      await stabilityPoolERC20.withdrawFromSP(dec(9000, 18), { from: alice })

      const expectedNewDeposit_A = (compoundedVSTDeposit_A.sub(toBN(dec(9000, 18))))
      const expectedNewDeposit_AERC20 = (compoundedVSTDeposit_AERC20.sub(toBN(dec(9000, 18))))

      // check Alice's deposit has been updated to equal her compounded deposit minus her withdrawal */
      const newDeposit = (await stabilityPool.deposits(alice)).toString()
      assert.isAtMost(th.getDifference(newDeposit, expectedNewDeposit_A), 100000)

      const newDepositERC20 = (await stabilityPoolERC20.deposits(alice)).toString()
      assert.isAtMost(th.getDifference(newDepositERC20, expectedNewDeposit_AERC20), 100000)

      // Expect Alice has withdrawn all ETH gain
      const alice_pendingETHGain = await stabilityPool.getDepositorAssetGain(alice)
      assert.equal(alice_pendingETHGain, 0)

      const alice_pendingETHGainERC20 = await stabilityPoolERC20.getDepositorAssetGain(alice)
      assert.equal(alice_pendingETHGainERC20, 0)
    })

    it("withdrawFromSP(): partial retrieval - leaves the correct amount of VST in the Stability Pool", async () => {
      // --- SETUP ---
      // Whale deposits 185000 VST in StabilityPool
      await openTrove({ extraVSTAmount: toBN(dec(1, 24)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1, 24)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPool.provideToSP(dec(185000, 18), { from: whale })
      await stabilityPoolERC20.provideToSP(dec(185000, 18), { from: whale })

      // 2 Troves opened
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })
      // --- TEST ---

      // Alice makes deposit #1: 15000 VST
      await openTrove({ extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await stabilityPool.provideToSP(dec(15000, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(15000, 18), { from: alice })

      const SP_VST_Before = await stabilityPool.getTotalVSTDeposits()
      assert.equal(SP_VST_Before, dec(200000, 18))

      const SP_VST_BeforeERC20 = await stabilityPoolERC20.getTotalVSTDeposits()
      assert.equal(SP_VST_BeforeERC20, dec(200000, 18))

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 users liquidated
      const liquidationTX_1 = await troveManager.liquidate(ZERO_ADDRESS, defaulter_1, { from: owner })
      const liquidationTX_2 = await troveManager.liquidate(ZERO_ADDRESS, defaulter_2, { from: owner })

      const liquidationTX_1ERC20 = await troveManager.liquidate(erc20.address, defaulter_1, { from: owner })
      const liquidationTX_2ERC20 = await troveManager.liquidate(erc20.address, defaulter_2, { from: owner })

      const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1)
      const [liquidatedDebt_2] = await th.getEmittedLiquidationValues(liquidationTX_2)
      const [liquidatedDebt_1ERC20] = await th.getEmittedLiquidationValues(liquidationTX_1ERC20)
      const [liquidatedDebt_2ERC20] = await th.getEmittedLiquidationValues(liquidationTX_2ERC20)

      // Alice retrieves part of her entitled VST: 9000 VST
      await stabilityPool.withdrawFromSP(dec(9000, 18), { from: alice })
      await stabilityPoolERC20.withdrawFromSP(dec(9000, 18), { from: alice })

      /* Check SP has reduced from 2 liquidations and Alice's withdrawal
      Expect VST in SP = (200000 - liquidatedDebt_1 - liquidatedDebt_2 - 9000) */
      const expectedSPVST = toBN(dec(200000, 18))
        .sub(toBN(liquidatedDebt_1))
        .sub(toBN(liquidatedDebt_2))
        .sub(toBN(dec(9000, 18)))

      const expectedSPVSTERC20 = toBN(dec(200000, 18))
        .sub(toBN(liquidatedDebt_1ERC20))
        .sub(toBN(liquidatedDebt_2ERC20))
        .sub(toBN(dec(9000, 18)))

      const SP_VST_After = (await stabilityPool.getTotalVSTDeposits()).toString()
      const SP_VST_AfterERC20 = (await stabilityPoolERC20.getTotalVSTDeposits()).toString()

      th.assertIsApproximatelyEqual(SP_VST_After, expectedSPVST)
      th.assertIsApproximatelyEqual(SP_VST_AfterERC20, expectedSPVSTERC20)
    })

    it("withdrawFromSP(): full retrieval - leaves the correct amount of VST in the Stability Pool", async () => {
      // --- SETUP ---
      // Whale deposits 185000 VST in StabilityPool
      await openTrove({ extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPool.provideToSP(dec(185000, 18), { from: whale })
      await stabilityPoolERC20.provideToSP(dec(185000, 18), { from: whale })

      // 2 Troves opened
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      // --- TEST ---

      // Alice makes deposit #1
      await openTrove({ extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await stabilityPool.provideToSP(dec(15000, 18), { from: alice })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await stabilityPoolERC20.provideToSP(dec(15000, 18), { from: alice })

      const SP_VST_Before = await stabilityPool.getTotalVSTDeposits()
      assert.equal(SP_VST_Before, dec(200000, 18))

      const SP_VST_BeforeERC20 = await stabilityPoolERC20.getTotalVSTDeposits()
      assert.equal(SP_VST_BeforeERC20, dec(200000, 18))

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 defaulters liquidated
      const liquidationTX_1 = await troveManager.liquidate(ZERO_ADDRESS, defaulter_1, { from: owner })
      const liquidationTX_2 = await troveManager.liquidate(ZERO_ADDRESS, defaulter_2, { from: owner })

      const liquidationTX_1ERC20 = await troveManager.liquidate(erc20.address, defaulter_1, { from: owner })
      const liquidationTX_2ERC20 = await troveManager.liquidate(erc20.address, defaulter_2, { from: owner })

      const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1)
      const [liquidatedDebt_2] = await th.getEmittedLiquidationValues(liquidationTX_2)

      const [liquidatedDebt_1ERC20] = await th.getEmittedLiquidationValues(liquidationTX_1ERC20)
      const [liquidatedDebt_2ERC20] = await th.getEmittedLiquidationValues(liquidationTX_2ERC20)

      // Alice VSTLoss is ((15000/200000) * liquidatedDebt), for each liquidation
      const expectedVSTLoss_A = (liquidatedDebt_1.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18))))
        .add(liquidatedDebt_2.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18))))

      const expectedVSTLoss_AERC20 = (liquidatedDebt_1ERC20.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18))))
        .add(liquidatedDebt_2ERC20.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18))))

      const expectedCompoundedVSTDeposit_A = toBN(dec(15000, 18)).sub(expectedVSTLoss_A)
      const compoundedVSTDeposit_A = await stabilityPool.getCompoundedVSTDeposit(alice)

      const expectedCompoundedVSTDeposit_AERC20 = toBN(dec(15000, 18)).sub(expectedVSTLoss_AERC20)
      const compoundedVSTDeposit_AERC20 = await stabilityPoolERC20.getCompoundedVSTDeposit(alice)

      assert.isAtMost(th.getDifference(expectedCompoundedVSTDeposit_A, compoundedVSTDeposit_A), 100000)
      assert.isAtMost(th.getDifference(expectedCompoundedVSTDeposit_AERC20, compoundedVSTDeposit_AERC20), 100000)

      const VSTinSPBefore = await stabilityPool.getTotalVSTDeposits()
      const VSTinSPBeforeERC20 = await stabilityPoolERC20.getTotalVSTDeposits()

      // Alice retrieves all of her entitled VST:
      await stabilityPool.withdrawFromSP(dec(15000, 18), { from: alice })
      await stabilityPoolERC20.withdrawFromSP(dec(15000, 18), { from: alice })

      const expectedVSTinSPAfter = VSTinSPBefore.sub(compoundedVSTDeposit_A)
      const expectedVSTinSPAfterERC20 = VSTinSPBefore.sub(compoundedVSTDeposit_AERC20)

      const VSTinSPAfter = await stabilityPool.getTotalVSTDeposits()
      const VSTinSPAfterERC20 = await stabilityPoolERC20.getTotalVSTDeposits()
      assert.isAtMost(th.getDifference(expectedVSTinSPAfter, VSTinSPAfter), 100000)
      assert.isAtMost(th.getDifference(expectedVSTinSPAfterERC20, VSTinSPAfterERC20), 100000)
    })

    it("withdrawFromSP(): Subsequent deposit and withdrawal attempt from same account, with no intermediate liquidations, withdraws zero ETH", async () => {
      // --- SETUP ---
      // Whale deposits 1850 VST in StabilityPool
      await openTrove({ extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPool.provideToSP(dec(18500, 18), { from: whale })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPoolERC20.provideToSP(dec(18500, 18), { from: whale })

      // 2 defaulters open
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      // --- TEST ---

      // Alice makes deposit #1: 15000 VST
      await openTrove({ extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await stabilityPool.provideToSP(dec(15000, 18), { from: alice })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await stabilityPoolERC20.provideToSP(dec(15000, 18), { from: alice })

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // defaulters liquidated
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1, { from: owner })
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_2, { from: owner })

      await troveManager.liquidate(erc20.address, defaulter_1, { from: owner })
      await troveManager.liquidate(erc20.address, defaulter_2, { from: owner })

      // Alice retrieves all of her entitled VST:
      await stabilityPool.withdrawFromSP(dec(15000, 18), { from: alice })
      assert.equal(await stabilityPool.getDepositorAssetGain(alice), 0)

      await stabilityPoolERC20.withdrawFromSP(dec(15000, 18), { from: alice })
      assert.equal(await stabilityPoolERC20.getDepositorAssetGain(alice), 0)

      // Alice makes second deposit
      await stabilityPool.provideToSP(dec(10000, 18), { from: alice })
      assert.equal(await stabilityPool.getDepositorAssetGain(alice), 0)

      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: alice })
      assert.equal(await stabilityPoolERC20.getDepositorAssetGain(alice), 0)

      const ETHinSP_Before = (await stabilityPool.getAssetBalance()).toString()
      const ETHinSP_BeforeERC20 = (await stabilityPoolERC20.getAssetBalance()).toString()

      // Alice attempts second withdrawal
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      assert.equal(await stabilityPool.getDepositorAssetGain(alice), 0)

      await stabilityPoolERC20.withdrawFromSP(dec(10000, 18), { from: alice })
      assert.equal(await stabilityPoolERC20.getDepositorAssetGain(alice), 0)

      // Check ETH in pool does not change
      const ETHinSP_1 = (await stabilityPool.getAssetBalance()).toString()
      assert.equal(ETHinSP_Before, ETHinSP_1)

      const ETHinSP_1ERC20 = (await stabilityPoolERC20.getAssetBalance()).toString()
      assert.equal(ETHinSP_BeforeERC20, ETHinSP_1ERC20)

      // Third deposit
      await stabilityPool.provideToSP(dec(10000, 18), { from: alice })
      assert.equal(await stabilityPool.getDepositorAssetGain(alice), 0)

      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: alice })
      assert.equal(await stabilityPoolERC20.getDepositorAssetGain(alice), 0)

      // Alice attempts third withdrawal (this time, frm SP to Trove)
      const txPromise_A = stabilityPool.withdrawAssetGainToTrove(alice, alice, { from: alice })
      await th.assertRevert(txPromise_A)

      const txPromise_AERC20 = stabilityPoolERC20.withdrawAssetGainToTrove(alice, alice, { from: alice })
      await th.assertRevert(txPromise_AERC20)
    })

    it("withdrawFromSP(): it correctly updates the user's VST and ETH snapshots of entitled reward per unit staked", async () => {
      // --- SETUP ---
      // Whale deposits 185000 VST in StabilityPool
      await openTrove({ extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPool.provideToSP(dec(185000, 18), { from: whale })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPoolERC20.provideToSP(dec(185000, 18), { from: whale })

      // 2 defaulters open
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      // --- TEST ---

      // Alice makes deposit #1: 15000 VST
      await openTrove({ extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await stabilityPool.provideToSP(dec(15000, 18), { from: alice })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await stabilityPoolERC20.provideToSP(dec(15000, 18), { from: alice })

      // check 'Before' snapshots
      const alice_snapshot_Before = await stabilityPool.depositSnapshots(alice)
      const alice_snapshot_S_Before = alice_snapshot_Before[0].toString()
      const alice_snapshot_P_Before = alice_snapshot_Before[1].toString()
      assert.equal(alice_snapshot_S_Before, 0)
      assert.equal(alice_snapshot_P_Before, '1000000000000000000')


      const alice_snapshot_BeforeERC20 = await stabilityPoolERC20.depositSnapshots(alice)
      const alice_snapshot_S_BeforeERC20 = alice_snapshot_BeforeERC20[0].toString()
      const alice_snapshot_P_BeforeERC20 = alice_snapshot_BeforeERC20[1].toString()
      assert.equal(alice_snapshot_S_BeforeERC20, 0)
      assert.equal(alice_snapshot_P_BeforeERC20, '1000000000000000000')

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // 2 defaulters liquidated
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1, { from: owner })
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_2, { from: owner });

      await troveManager.liquidate(erc20.address, defaulter_1, { from: owner })
      await troveManager.liquidate(erc20.address, defaulter_2, { from: owner });

      // Alice retrieves part of her entitled VST: 9000 VST
      await stabilityPool.withdrawFromSP(dec(9000, 18), { from: alice })
      await stabilityPoolERC20.withdrawFromSP(dec(9000, 18), { from: alice })

      const P = (await stabilityPool.P()).toString()
      const S = (await stabilityPool.epochToScaleToSum(0, 0)).toString()
      // check 'After' snapshots
      const alice_snapshot_After = await stabilityPool.depositSnapshots(alice)
      const alice_snapshot_S_After = alice_snapshot_After[0].toString()
      const alice_snapshot_P_After = alice_snapshot_After[1].toString()
      assert.equal(alice_snapshot_S_After, S)
      assert.equal(alice_snapshot_P_After, P)


      const PERC20 = (await stabilityPoolERC20.P()).toString()
      const SERC20 = (await stabilityPoolERC20.epochToScaleToSum(0, 0)).toString()
      // check 'After' snapshots
      const alice_snapshot_AfterERC20 = await stabilityPoolERC20.depositSnapshots(alice)
      const alice_snapshot_S_AfterERC20 = alice_snapshot_AfterERC20[0].toString()
      const alice_snapshot_P_AfterERC20 = alice_snapshot_AfterERC20[1].toString()
      assert.equal(alice_snapshot_S_AfterERC20, SERC20)
      assert.equal(alice_snapshot_P_AfterERC20, PERC20)
    })

    it("withdrawFromSP(): decreases StabilityPool ETH", async () => {
      // --- SETUP ---
      // Whale deposits 185000 VST in StabilityPool
      await openTrove({ extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPool.provideToSP(dec(185000, 18), { from: whale })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPoolERC20.provideToSP(dec(185000, 18), { from: whale })

      // 1 defaulter opens
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // --- TEST ---

      // Alice makes deposit #1: 15000 VST
      await openTrove({ extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await stabilityPool.provideToSP(dec(15000, 18), { from: alice })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await stabilityPoolERC20.provideToSP(dec(15000, 18), { from: alice })

      // price drops: defaulter's Trove falls below MCR, alice and whale Trove remain active
      await priceFeed.setPrice('100000000000000000000');

      // defaulter's Trove is closed.
      const liquidationTx_1 = await troveManager.liquidate(ZERO_ADDRESS, defaulter_1, { from: owner })  // 180 VST closed
      const [, liquidatedColl,] = th.getEmittedLiquidationValues(liquidationTx_1)

      const liquidationTx_1ERC20 = await troveManager.liquidate(erc20.address, defaulter_1, { from: owner })  // 180 VST closed
      const [, liquidatedCollERC20,] = th.getEmittedLiquidationValues(liquidationTx_1ERC20)

      //Get ActivePool and StabilityPool Ether before retrieval:
      const active_ETH_Before = await activePool.getAssetBalance(ZERO_ADDRESS)
      const stability_ETH_Before = await stabilityPool.getAssetBalance()

      const active_ETH_BeforeERC20 = await activePool.getAssetBalance(erc20.address)
      const stability_ETH_BeforeERC20 = await stabilityPoolERC20.getAssetBalance()

      // Expect alice to be entitled to 15000/200000 of the liquidated coll
      const aliceExpectedETHGain = liquidatedColl.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18)))
      const aliceETHGain = await stabilityPool.getDepositorAssetGain(alice)
      assert.isTrue(aliceExpectedETHGain.eq(aliceETHGain))

      const aliceExpectedETHGainERC20 = liquidatedCollERC20.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18)))
      const aliceETHGainERC20 = await stabilityPoolERC20.getDepositorAssetGain(alice)
      assert.isTrue(aliceExpectedETHGainERC20.div(toBN(10 ** 10)).eq(aliceETHGainERC20))

      // Alice retrieves all of her deposit
      await stabilityPool.withdrawFromSP(dec(15000, 18), { from: alice })
      await stabilityPoolERC20.withdrawFromSP(dec(15000, 18), { from: alice })

      const active_ETH_After = await activePool.getAssetBalance(ZERO_ADDRESS)
      const stability_ETH_After = await stabilityPool.getAssetBalance()

      const active_ETH_AfterERC20 = await activePool.getAssetBalance(erc20.address)
      const stability_ETH_AfterERC20 = await stabilityPoolERC20.getAssetBalance()

      const active_ETH_Difference = (active_ETH_Before.sub(active_ETH_After))
      const stability_ETH_Difference = (stability_ETH_Before.sub(stability_ETH_After))

      const active_ETH_DifferenceERC20 = (active_ETH_BeforeERC20.sub(active_ETH_AfterERC20))
      const stability_ETH_DifferenceERC20 = (stability_ETH_BeforeERC20.sub(stability_ETH_AfterERC20))

      assert.equal(active_ETH_Difference, '0')
      assert.equal(active_ETH_DifferenceERC20, '0')

      // Expect StabilityPool to have decreased by Alice's AssetGain
      assert.isAtMost(th.getDifference(stability_ETH_Difference, aliceETHGain), 10000)
      assert.isAtMost(th.getDifference(stability_ETH_DifferenceERC20.div(toBN(10 ** 10)), aliceETHGainERC20), 10000)
    })

    it("withdrawFromSP(): All depositors are able to withdraw from the SP to their account", async () => {
      // Whale opens trove 
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // 1 defaulter open
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // 6 Accounts open troves and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
        await stabilityPool.provideToSP(dec(10000, 18), { from: account })
      }

      for (account of depositors) {
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
        await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: account })
      }

      await priceFeed.setPrice(dec(105, 18))
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)

      await priceFeed.setPrice(dec(200, 18))

      // All depositors attempt to withdraw
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      assert.equal((await stabilityPool.deposits(alice)).toString(), '0')
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      assert.equal((await stabilityPool.deposits(alice)).toString(), '0')
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: carol })
      assert.equal((await stabilityPool.deposits(alice)).toString(), '0')
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: dennis })
      assert.equal((await stabilityPool.deposits(alice)).toString(), '0')
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: erin })
      assert.equal((await stabilityPool.deposits(alice)).toString(), '0')
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: flyn })
      assert.equal((await stabilityPool.deposits(alice)).toString(), '0')


      await stabilityPoolERC20.withdrawFromSP(dec(10000, 18), { from: alice })
      assert.equal((await stabilityPoolERC20.deposits(alice)).toString(), '0')
      await stabilityPoolERC20.withdrawFromSP(dec(10000, 18), { from: bob })
      assert.equal((await stabilityPoolERC20.deposits(alice)).toString(), '0')
      await stabilityPoolERC20.withdrawFromSP(dec(10000, 18), { from: carol })
      assert.equal((await stabilityPoolERC20.deposits(alice)).toString(), '0')
      await stabilityPoolERC20.withdrawFromSP(dec(10000, 18), { from: dennis })
      assert.equal((await stabilityPoolERC20.deposits(alice)).toString(), '0')
      await stabilityPoolERC20.withdrawFromSP(dec(10000, 18), { from: erin })
      assert.equal((await stabilityPoolERC20.deposits(alice)).toString(), '0')
      await stabilityPoolERC20.withdrawFromSP(dec(10000, 18), { from: flyn })
      assert.equal((await stabilityPoolERC20.deposits(alice)).toString(), '0')

      const totalDeposits = (await stabilityPool.getTotalVSTDeposits()).toString()
      const totalDepositsERC20 = (await stabilityPoolERC20.getTotalVSTDeposits()).toString()

      assert.isAtMost(th.getDifference(totalDeposits, '0'), 100000)
      assert.isAtMost(th.getDifference(totalDepositsERC20, '0'), 100000)
    })

    it("withdrawFromSP(): increases depositor's VST token balance by the expected amount", async () => {
      // Whale opens trove 
      await openTrove({ extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // 1 defaulter opens trove
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getOpenTroveVSTAmount(dec(10000, 18), ZERO_ADDRESS), defaulter_1, defaulter_1, { from: defaulter_1, value: dec(100, 'ether') })
      await borrowerOperations.openTrove(erc20.address, dec(100, 'ether'), th._100pct, await getOpenTroveVSTAmount(dec(10000, 18), ZERO_ADDRESS), defaulter_1, defaulter_1, { from: defaulter_1 })

      const defaulterDebt = (await troveManager.getEntireDebtAndColl(ZERO_ADDRESS, defaulter_1))[0]
      const defaulterDebtERC20 = (await troveManager.getEntireDebtAndColl(erc20.address, defaulter_1))[0]

      // 6 Accounts open troves and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]

      for (account of depositors) {
        await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
        await stabilityPool.provideToSP(dec(10000, 18), { from: account })
      }

      for (account of depositors) {
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
        await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: account })
      }

      await priceFeed.setPrice(dec(105, 18))
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)

      const aliceBalBefore = await vstToken.balanceOf(alice)
      const bobBalBefore = await vstToken.balanceOf(bob)

      /* From an offset of 10000 VST, each depositor receives
      VSTLoss = 1666.6666666666666666 VST

      and thus with a deposit of 10000 VST, each should withdraw 8333.3333333333333333 VST (in practice, slightly less due to rounding error)
      */

      // Price bounces back to $200 per ETH
      await priceFeed.setPrice(dec(200, 18))

      // Bob issues a further 5000 VST from his trove 
      await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, dec(5000, 18), bob, bob, { from: bob })
      await borrowerOperations.withdrawVST(erc20.address, th._100pct, dec(5000, 18), bob, bob, { from: bob })

      // Expect Alice's VST balance increase be very close to 8333.3333333333333333 VST
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      await stabilityPoolERC20.withdrawFromSP(dec(10000, 18), { from: alice })
      const aliceBalance = (await vstToken.balanceOf(alice))

      assert.isAtMost(th.getDifference(aliceBalance.sub(aliceBalBefore), toBN('8333333333333333333333').mul(toBN(2))), 200000)

      // expect Bob's VST balance increase to be very close to  13333.33333333333333333 VST
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      await stabilityPoolERC20.withdrawFromSP(dec(10000, 18), { from: bob })
      const bobBalance = (await vstToken.balanceOf(bob))
      assert.isAtMost(th.getDifference(bobBalance.sub(bobBalBefore), toBN('13333333333333333333333').mul(toBN(2))), 200000)
    })

    it("withdrawFromSP(): doesn't impact other users Stability deposits or ETH gains", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await stabilityPool.provideToSP(dec(10000, 18), { from: alice })
      await stabilityPool.provideToSP(dec(20000, 18), { from: bob })
      await stabilityPool.provideToSP(dec(30000, 18), { from: carol })

      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(20000, 18), { from: bob })
      await stabilityPoolERC20.provideToSP(dec(30000, 18), { from: carol })

      // Would-be defaulters open troves
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))

      // Defaulters are liquidated
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_2)
      await troveManager.liquidate(erc20.address, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_2)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_2))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_2))

      const alice_VSTDeposit_Before = (await stabilityPool.getCompoundedVSTDeposit(alice)).toString()
      const bob_VSTDeposit_Before = (await stabilityPool.getCompoundedVSTDeposit(bob)).toString()

      const alice_VSTDeposit_BeforeERC20 = (await stabilityPoolERC20.getCompoundedVSTDeposit(alice)).toString()
      const bob_VSTDeposit_BeforeERC20 = (await stabilityPoolERC20.getCompoundedVSTDeposit(bob)).toString()

      const alice_ETHGain_Before = (await stabilityPool.getDepositorAssetGain(alice)).toString()
      const bob_ETHGain_Before = (await stabilityPool.getDepositorAssetGain(bob)).toString()

      const alice_ETHGain_BeforeERC20 = (await stabilityPoolERC20.getDepositorAssetGain(alice)).toString()
      const bob_ETHGain_BeforeERC20 = (await stabilityPoolERC20.getDepositorAssetGain(bob)).toString()

      //check non-zero VST and AssetGain in the Stability Pool
      const VSTinSP = await stabilityPool.getTotalVSTDeposits()
      const ETHinSP = await stabilityPool.getAssetBalance()
      const VSTinSPERC20 = await stabilityPoolERC20.getTotalVSTDeposits()
      const ETHinSPERC20 = await stabilityPoolERC20.getAssetBalance()
      assert.isTrue(VSTinSP.gt(mv._zeroBN))
      assert.isTrue(ETHinSP.gt(mv._zeroBN))
      assert.isTrue(VSTinSPERC20.gt(mv._zeroBN))
      assert.isTrue(ETHinSPERC20.gt(mv._zeroBN))

      // Price rises
      await priceFeed.setPrice(dec(200, 18))

      // Carol withdraws her Stability deposit 
      assert.equal((await stabilityPool.deposits(carol)).toString(), dec(30000, 18))
      assert.equal((await stabilityPoolERC20.deposits(carol)).toString(), dec(30000, 18))

      await stabilityPool.withdrawFromSP(dec(30000, 18), { from: carol })
      await stabilityPoolERC20.withdrawFromSP(dec(30000, 18), { from: carol })

      assert.equal((await stabilityPool.deposits(carol)).toString(), '0')
      assert.equal((await stabilityPoolERC20.deposits(carol)).toString(), '0')

      const alice_VSTDeposit_After = (await stabilityPool.getCompoundedVSTDeposit(alice)).toString()
      const bob_VSTDeposit_After = (await stabilityPool.getCompoundedVSTDeposit(bob)).toString()

      const alice_ETHGain_After = (await stabilityPool.getDepositorAssetGain(alice)).toString()
      const bob_ETHGain_After = (await stabilityPool.getDepositorAssetGain(bob)).toString()

      const alice_VSTDeposit_AfterERC20 = (await stabilityPoolERC20.getCompoundedVSTDeposit(alice)).toString()
      const bob_VSTDeposit_AfterERC20 = (await stabilityPoolERC20.getCompoundedVSTDeposit(bob)).toString()

      const alice_ETHGain_AfterERC20 = (await stabilityPoolERC20.getDepositorAssetGain(alice)).toString()
      const bob_ETHGain_AfterERC20 = (await stabilityPoolERC20.getDepositorAssetGain(bob)).toString()

      // Check compounded deposits and ETH gains for A and B have not changed
      assert.equal(alice_VSTDeposit_Before, alice_VSTDeposit_After)
      assert.equal(bob_VSTDeposit_Before, bob_VSTDeposit_After)
      assert.equal(alice_ETHGain_Before, alice_ETHGain_After)
      assert.equal(bob_ETHGain_Before, bob_ETHGain_After)

      assert.equal(alice_VSTDeposit_BeforeERC20, alice_VSTDeposit_AfterERC20)
      assert.equal(bob_VSTDeposit_BeforeERC20, bob_VSTDeposit_AfterERC20)
      assert.equal(alice_ETHGain_BeforeERC20, alice_ETHGain_AfterERC20)
      assert.equal(bob_ETHGain_BeforeERC20, bob_ETHGain_AfterERC20)
    })

    it("withdrawFromSP(): doesn't impact system debt, collateral or TCR ", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await stabilityPool.provideToSP(dec(10000, 18), { from: alice })
      await stabilityPool.provideToSP(dec(20000, 18), { from: bob })
      await stabilityPool.provideToSP(dec(30000, 18), { from: carol })

      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(20000, 18), { from: bob })
      await stabilityPoolERC20.provideToSP(dec(30000, 18), { from: carol })

      // Would-be defaulters open troves
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))

      // Defaulters are liquidated
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_2)
      await troveManager.liquidate(erc20.address, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_2)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_2))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_2))

      // Price rises
      await priceFeed.setPrice(dec(200, 18))

      const activeDebt_Before = (await activePool.getVSTDebt(ZERO_ADDRESS)).toString()
      const defaultedDebt_Before = (await defaultPool.getVSTDebt(ZERO_ADDRESS)).toString()
      const activeColl_Before = (await activePool.getAssetBalance(ZERO_ADDRESS)).toString()
      const defaultedColl_Before = (await defaultPool.getAssetBalance(ZERO_ADDRESS)).toString()
      const TCR_Before = (await th.getTCR(contracts)).toString()


      const activeDebt_BeforeERC20 = (await activePool.getVSTDebt(erc20.address)).toString()
      const defaultedDebt_BeforeERC20 = (await defaultPool.getVSTDebt(erc20.address)).toString()
      const activeColl_BeforeERC20 = (await activePool.getAssetBalance(erc20.address)).toString()
      const defaultedColl_BeforeERC20 = (await defaultPool.getAssetBalance(erc20.address)).toString()
      const TCR_BeforeERC20 = (await th.getTCR(contracts, erc20.address)).toString()

      // Carol withdraws her Stability deposit 
      assert.equal((await stabilityPool.deposits(carol)).toString(), dec(30000, 18))
      await stabilityPool.withdrawFromSP(dec(30000, 18), { from: carol })
      assert.equal((await stabilityPool.deposits(carol)).toString(), '0')

      assert.equal((await stabilityPoolERC20.deposits(carol)).toString(), dec(30000, 18))
      await stabilityPoolERC20.withdrawFromSP(dec(30000, 18), { from: carol })
      assert.equal((await stabilityPoolERC20.deposits(carol)).toString(), '0')

      const activeDebt_After = (await activePool.getVSTDebt(ZERO_ADDRESS)).toString()
      const defaultedDebt_After = (await defaultPool.getVSTDebt(ZERO_ADDRESS)).toString()
      const activeColl_After = (await activePool.getAssetBalance(ZERO_ADDRESS)).toString()
      const defaultedColl_After = (await defaultPool.getAssetBalance(ZERO_ADDRESS)).toString()
      const TCR_After = (await th.getTCR(contracts)).toString()


      const activeDebt_AfterERC20 = (await activePool.getVSTDebt(erc20.address)).toString()
      const defaultedDebt_AfterERC20 = (await defaultPool.getVSTDebt(erc20.address)).toString()
      const activeColl_AfterERC20 = (await activePool.getAssetBalance(erc20.address)).toString()
      const defaultedColl_AfterERC20 = (await defaultPool.getAssetBalance(erc20.address)).toString()
      const TCR_AfterERC20 = (await th.getTCR(contracts, erc20.address)).toString()

      // Check total system debt, collateral and TCR have not changed after a Stability deposit is made
      assert.equal(activeDebt_Before, activeDebt_After)
      assert.equal(defaultedDebt_Before, defaultedDebt_After)
      assert.equal(activeColl_Before, activeColl_After)
      assert.equal(defaultedColl_Before, defaultedColl_After)
      assert.equal(TCR_Before, TCR_After)

      assert.equal(activeDebt_BeforeERC20, activeDebt_AfterERC20)
      assert.equal(defaultedDebt_BeforeERC20, defaultedDebt_AfterERC20)
      assert.equal(activeColl_BeforeERC20, activeColl_AfterERC20)
      assert.equal(defaultedColl_BeforeERC20, defaultedColl_AfterERC20)
      assert.equal(TCR_BeforeERC20, TCR_AfterERC20)
    })

    it("withdrawFromSP(): doesn't impact any troves, including the caller's trove", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // A, B and C provide to SP
      await stabilityPool.provideToSP(dec(10000, 18), { from: alice })
      await stabilityPool.provideToSP(dec(20000, 18), { from: bob })
      await stabilityPool.provideToSP(dec(30000, 18), { from: carol })

      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(20000, 18), { from: bob })
      await stabilityPoolERC20.provideToSP(dec(30000, 18), { from: carol })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))
      const price = await priceFeed.getPrice()

      // Get debt, collateral and ICR of all existing troves
      const whale_Debt_Before = (await troveManager.Troves(whale, ZERO_ADDRESS,))[0].toString()
      const alice_Debt_Before = (await troveManager.Troves(alice, ZERO_ADDRESS,))[0].toString()
      const bob_Debt_Before = (await troveManager.Troves(bob, ZERO_ADDRESS,))[0].toString()
      const carol_Debt_Before = (await troveManager.Troves(carol, ZERO_ADDRESS,))[0].toString()

      const whale_Debt_BeforeERC20 = (await troveManager.Troves(whale, erc20.address,))[0].toString()
      const alice_Debt_BeforeERC20 = (await troveManager.Troves(alice, erc20.address,))[0].toString()
      const bob_Debt_BeforeERC20 = (await troveManager.Troves(bob, erc20.address,))[0].toString()
      const carol_Debt_BeforeERC20 = (await troveManager.Troves(carol, erc20.address,))[0].toString()

      const whale_Coll_Before = (await troveManager.Troves(whale, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()
      const alice_Coll_Before = (await troveManager.Troves(alice, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()
      const bob_Coll_Before = (await troveManager.Troves(bob, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()
      const carol_Coll_Before = (await troveManager.Troves(carol, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()

      const whale_Coll_BeforeERC20 = (await troveManager.Troves(whale, erc20.address))[th.TROVE_COLL_INDEX].toString()
      const alice_Coll_BeforeERC20 = (await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX].toString()
      const bob_Coll_BeforeERC20 = (await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX].toString()
      const carol_Coll_BeforeERC20 = (await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX].toString()

      const whale_ICR_Before = (await troveManager.getCurrentICR(ZERO_ADDRESS, whale, price)).toString()
      const alice_ICR_Before = (await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).toString()
      const bob_ICR_Before = (await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).toString()
      const carol_ICR_Before = (await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).toString()

      const whale_ICR_BeforeERC20 = (await troveManager.getCurrentICR(erc20.address, whale, price)).toString()
      const alice_ICR_BeforeERC20 = (await troveManager.getCurrentICR(erc20.address, alice, price)).toString()
      const bob_ICR_BeforeERC20 = (await troveManager.getCurrentICR(erc20.address, bob, price)).toString()
      const carol_ICR_BeforeERC20 = (await troveManager.getCurrentICR(erc20.address, carol, price)).toString()

      // price rises
      await priceFeed.setPrice(dec(200, 18))

      // Carol withdraws her Stability deposit 
      assert.equal((await stabilityPool.deposits(carol)).toString(), dec(30000, 18))
      await stabilityPool.withdrawFromSP(dec(30000, 18), { from: carol })
      assert.equal((await stabilityPool.deposits(carol)).toString(), '0')

      assert.equal((await stabilityPoolERC20.deposits(carol)).toString(), dec(30000, 18))
      await stabilityPoolERC20.withdrawFromSP(dec(30000, 18), { from: carol })
      assert.equal((await stabilityPoolERC20.deposits(carol)).toString(), '0')

      const whale_Debt_After = (await troveManager.Troves(whale, ZERO_ADDRESS,))[0].toString()
      const alice_Debt_After = (await troveManager.Troves(alice, ZERO_ADDRESS,))[0].toString()
      const bob_Debt_After = (await troveManager.Troves(bob, ZERO_ADDRESS,))[0].toString()
      const carol_Debt_After = (await troveManager.Troves(carol, ZERO_ADDRESS,))[0].toString()

      const whale_Coll_After = (await troveManager.Troves(whale, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()
      const alice_Coll_After = (await troveManager.Troves(alice, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()
      const bob_Coll_After = (await troveManager.Troves(bob, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()
      const carol_Coll_After = (await troveManager.Troves(carol, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX].toString()

      const whale_ICR_After = (await troveManager.getCurrentICR(ZERO_ADDRESS, whale, price)).toString()
      const alice_ICR_After = (await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).toString()
      const bob_ICR_After = (await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).toString()
      const carol_ICR_After = (await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).toString()


      const whale_Debt_AfterERC20 = (await troveManager.Troves(whale, erc20.address))[0].toString()
      const alice_Debt_AfterERC20 = (await troveManager.Troves(alice, erc20.address))[0].toString()
      const bob_Debt_AfterERC20 = (await troveManager.Troves(bob, erc20.address))[0].toString()
      const carol_Debt_AfterERC20 = (await troveManager.Troves(carol, erc20.address))[0].toString()

      const whale_Coll_AfterERC20 = (await troveManager.Troves(whale, erc20.address))[th.TROVE_COLL_INDEX].toString()
      const alice_Coll_AfterERC20 = (await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX].toString()
      const bob_Coll_AfterERC20 = (await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX].toString()
      const carol_Coll_AfterERC20 = (await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX].toString()

      const whale_ICR_AfterERC20 = (await troveManager.getCurrentICR(erc20.address, whale, price)).toString()
      const alice_ICR_AfterERC20 = (await troveManager.getCurrentICR(erc20.address, alice, price)).toString()
      const bob_ICR_AfterERC20 = (await troveManager.getCurrentICR(erc20.address, bob, price)).toString()
      const carol_ICR_AfterERC20 = (await troveManager.getCurrentICR(erc20.address, carol, price)).toString()

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


      assert.equal(whale_Debt_BeforeERC20, whale_Debt_AfterERC20)
      assert.equal(alice_Debt_BeforeERC20, alice_Debt_AfterERC20)
      assert.equal(bob_Debt_BeforeERC20, bob_Debt_AfterERC20)
      assert.equal(carol_Debt_BeforeERC20, carol_Debt_AfterERC20)

      assert.equal(whale_Coll_BeforeERC20, whale_Coll_AfterERC20)
      assert.equal(alice_Coll_BeforeERC20, alice_Coll_AfterERC20)
      assert.equal(bob_Coll_BeforeERC20, bob_Coll_AfterERC20)
      assert.equal(carol_Coll_BeforeERC20, carol_Coll_AfterERC20)

      assert.equal(whale_ICR_BeforeERC20, whale_ICR_AfterERC20)
      assert.equal(alice_ICR_BeforeERC20, alice_ICR_AfterERC20)
      assert.equal(bob_ICR_BeforeERC20, bob_ICR_AfterERC20)
      assert.equal(carol_ICR_BeforeERC20, carol_ICR_AfterERC20)
    })

    it("withdrawFromSP(): succeeds when amount is 0 and system has an undercollateralized trove", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(100, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })

      await stabilityPool.provideToSP(dec(100, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(100, 18), { from: A })

      const A_initialDeposit = (await stabilityPool.deposits(A)).toString()
      assert.equal(A_initialDeposit, dec(100, 18))

      const A_initialDepositERC20 = (await stabilityPoolERC20.deposits(A)).toString()
      assert.equal(A_initialDepositERC20, dec(100, 18))

      // defaulters opens trove
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })

      // ETH drops, defaulters are in liquidation range
      await priceFeed.setPrice(dec(105, 18))
      const price = await priceFeed.getPrice()
      assert.isTrue(await th.ICRbetween100and110(defaulter_1, troveManager, price))
      assert.isTrue(await th.ICRbetween100and110(defaulter_1, troveManager, price, erc20.address))

      await th.fastForwardTime(timeValues.MINUTES_IN_ONE_WEEK, web3.currentProvider)

      // Liquidate d1
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))

      await troveManager.liquidate(erc20.address, defaulter_1)
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))

      // Check d2 is undercollateralized
      assert.isTrue(await th.ICRbetween100and110(defaulter_2, troveManager, price))
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, defaulter_2))

      assert.isTrue(await th.ICRbetween100and110(defaulter_2, troveManager, price, erc20.address))
      assert.isTrue(await sortedTroves.contains(erc20.address, defaulter_2))

      const A_ETHBalBefore = toBN(await web3.eth.getBalance(A))
      const A_ETHBalBeforeERC20 = toBN(await erc20.balanceOf(A))
      const A_VSTABalBefore = await vstaToken.balanceOf(A)

      // Check Alice has gains to withdraw
      const A_pendingETHGain = await stabilityPool.getDepositorAssetGain(A)
      const A_pendingVSTAGain = await stabilityPool.getDepositorVSTAGain(A)
      assert.isTrue(A_pendingETHGain.gt(toBN('0')))
      assert.isTrue(A_pendingVSTAGain.gt(toBN('0')))

      const A_pendingETHGainERC20 = await stabilityPoolERC20.getDepositorAssetGain(A)
      const A_pendingVSTAGainERC20 = await stabilityPoolERC20.getDepositorVSTAGain(A)
      assert.isTrue(A_pendingETHGainERC20.gt(toBN('0')))
      assert.isTrue(A_pendingVSTAGainERC20.gt(toBN('0')))

      // Check withdrawal of 0 succeeds
      const tx = await stabilityPool.withdrawFromSP(0, { from: A, gasPrice: 0 })
      assert.isTrue(tx.receipt.status)

      const txERC20 = await stabilityPoolERC20.withdrawFromSP(0, { from: A, gasPrice: 0 })
      assert.isTrue(txERC20.receipt.status)

      const A_ETHBalAfter = toBN(await web3.eth.getBalance(A))
      const A_ETHBalAfterERC20 = toBN(await erc20.balanceOf(A))

      const A_VSTABalAfter = await vstaToken.balanceOf(A)
      const A_VSTABalDiff = A_VSTABalAfter.sub(A_VSTABalBefore)

      // Check A's ETH and VSTA balances have increased correctly
      assert.isTrue(A_ETHBalAfter.sub(A_ETHBalBefore).eq(A_pendingETHGain))
      assert.isTrue(A_ETHBalAfterERC20.sub(A_ETHBalBeforeERC20).eq(A_pendingETHGainERC20))
      assert.isAtMost(th.getDifference(A_VSTABalDiff, A_pendingVSTAGain.add(A_pendingVSTAGainERC20)), 1000)
    })

    it("withdrawFromSP(): withdrawing 0 VST doesn't alter the caller's deposit or the total VST in the Stability Pool", async () => {
      // --- SETUP ---
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // A, B, C provides 100, 50, 30 VST to SP
      await stabilityPool.provideToSP(dec(100, 18), { from: alice })
      await stabilityPool.provideToSP(dec(50, 18), { from: bob })
      await stabilityPool.provideToSP(dec(30, 18), { from: carol })

      await stabilityPoolERC20.provideToSP(dec(100, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(50, 18), { from: bob })
      await stabilityPoolERC20.provideToSP(dec(30, 18), { from: carol })

      const bob_Deposit_Before = (await stabilityPool.getCompoundedVSTDeposit(bob)).toString()
      const VSTinSP_Before = (await stabilityPool.getTotalVSTDeposits()).toString()

      const bob_Deposit_BeforeERC20 = (await stabilityPoolERC20.getCompoundedVSTDeposit(bob)).toString()
      const VSTinSP_BeforeERC20 = (await stabilityPoolERC20.getTotalVSTDeposits()).toString()

      assert.equal(VSTinSP_Before, dec(180, 18))
      assert.equal(VSTinSP_BeforeERC20, dec(180, 18))

      // Bob withdraws 0 VST from the Stability Pool 
      await stabilityPool.withdrawFromSP(0, { from: bob })
      await stabilityPoolERC20.withdrawFromSP(0, { from: bob })

      // check Bob's deposit and total VST in Stability Pool has not changed
      const bob_Deposit_After = (await stabilityPool.getCompoundedVSTDeposit(bob)).toString()
      const VSTinSP_After = (await stabilityPool.getTotalVSTDeposits()).toString()

      const bob_Deposit_AfterERC20 = (await stabilityPoolERC20.getCompoundedVSTDeposit(bob)).toString()
      const VSTinSP_AfterERC20 = (await stabilityPoolERC20.getTotalVSTDeposits()).toString()

      assert.equal(bob_Deposit_Before, bob_Deposit_After)
      assert.equal(VSTinSP_Before, VSTinSP_After)

      assert.equal(bob_Deposit_BeforeERC20, bob_Deposit_AfterERC20)
      assert.equal(VSTinSP_BeforeERC20, VSTinSP_AfterERC20)
    })

    it("withdrawFromSP(): withdrawing 0 ETH Gain does not alter the caller's ETH balance, their trove collateral, or the ETH  in the Stability Pool", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // Would-be defaulter open trove
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      // Defaulter 1 liquidated, full offset
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)

      // Dennis opens trove and deposits to Stability Pool
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await stabilityPool.provideToSP(dec(100, 18), { from: dennis })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await stabilityPoolERC20.provideToSP(dec(100, 18), { from: dennis })

      // Check Dennis has 0 AssetGain
      const dennis_ETHGain = (await stabilityPool.getDepositorAssetGain(dennis)).toString()
      assert.equal(dennis_ETHGain, '0')

      const dennis_ETHGainERC20 = (await stabilityPoolERC20.getDepositorAssetGain(dennis)).toString()
      assert.equal(dennis_ETHGainERC20, '0')

      const dennis_ETHBalance_Before = (web3.eth.getBalance(dennis)).toString()
      const dennis_Collateral_Before = ((await troveManager.Troves(dennis, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX]).toString()
      const ETHinSP_Before = (await stabilityPool.getAssetBalance()).toString()

      const dennis_ETHBalance_BeforeERC20 = (await erc20.balanceOf(dennis)).toString()
      const dennis_Collateral_BeforeERC20 = ((await troveManager.Troves(dennis, erc20.address,))[th.TROVE_COLL_INDEX]).toString()
      const ETHinSP_BeforeERC20 = (await stabilityPoolERC20.getAssetBalance()).toString()

      await priceFeed.setPrice(dec(200, 18))

      // Dennis withdraws his full deposit and AssetGain to his account
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: dennis, gasPrice: 0 })
      await stabilityPoolERC20.withdrawFromSP(dec(100, 18), { from: dennis, gasPrice: 0 })

      // Check withdrawal does not alter Dennis' ETH balance or his trove's collateral
      const dennis_ETHBalance_After = (web3.eth.getBalance(dennis)).toString()
      const dennis_Collateral_After = ((await troveManager.Troves(dennis, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX]).toString()
      const ETHinSP_After = (await stabilityPool.getAssetBalance()).toString()


      const dennis_ETHBalance_AfterERC20 = (await erc20.balanceOf(dennis)).toString()
      const dennis_Collateral_AfterERC20 = ((await troveManager.Troves(dennis, erc20.address,))[th.TROVE_COLL_INDEX]).toString()
      const ETHinSP_AfterERC20 = (await stabilityPoolERC20.getAssetBalance()).toString()

      assert.equal(dennis_ETHBalance_Before, dennis_ETHBalance_After)
      assert.equal(dennis_Collateral_Before, dennis_Collateral_After)
      assert.equal(dennis_ETHBalance_BeforeERC20, dennis_ETHBalance_AfterERC20)
      assert.equal(dennis_Collateral_BeforeERC20, dennis_Collateral_AfterERC20)

      // Check withdrawal has not altered the ETH in the Stability Pool
      assert.equal(ETHinSP_Before, ETHinSP_After)
      assert.equal(ETHinSP_BeforeERC20, ETHinSP_AfterERC20)
    })

    it("withdrawFromSP(): Request to withdraw > caller's deposit only withdraws the caller's compounded deposit", async () => {
      // --- SETUP ---
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // A, B, C provide VST to SP
      await stabilityPool.provideToSP(dec(10000, 18), { from: alice })
      await stabilityPool.provideToSP(dec(20000, 18), { from: bob })
      await stabilityPool.provideToSP(dec(30000, 18), { from: carol })

      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(20000, 18), { from: bob })
      await stabilityPoolERC20.provideToSP(dec(30000, 18), { from: carol })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))

      // Liquidate defaulter 1
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)

      const alice_VST_Balance_Before = await vstToken.balanceOf(alice)
      const bob_VST_Balance_Before = await vstToken.balanceOf(bob)

      const alice_Deposit_Before = await stabilityPool.getCompoundedVSTDeposit(alice)
      const bob_Deposit_Before = await stabilityPool.getCompoundedVSTDeposit(bob)

      const alice_Deposit_BeforeERC20 = await stabilityPoolERC20.getCompoundedVSTDeposit(alice)
      const bob_Deposit_BeforeERC20 = await stabilityPoolERC20.getCompoundedVSTDeposit(bob)

      const VSTinSP_Before = await stabilityPool.getTotalVSTDeposits()
      const VSTinSP_BeforeERC20 = await stabilityPoolERC20.getTotalVSTDeposits()

      await priceFeed.setPrice(dec(200, 18))

      // Bob attempts to withdraws 1 wei more than his compounded deposit from the Stability Pool
      await stabilityPool.withdrawFromSP(bob_Deposit_Before.add(toBN(1)), { from: bob })
      await stabilityPoolERC20.withdrawFromSP(bob_Deposit_BeforeERC20.add(toBN(1)), { from: bob })

      // Check Bob's VST balance has risen by only the value of his compounded deposit
      const bob_expectedVSTBalance = (bob_VST_Balance_Before.add(bob_Deposit_Before).add(bob_Deposit_BeforeERC20)).toString()
      const bob_VST_Balance_After = (await vstToken.balanceOf(bob)).toString()
      assert.equal(bob_VST_Balance_After, bob_expectedVSTBalance)

      // Alice attempts to withdraws 2309842309.000000000000000000 VST from the Stability Pool 
      await stabilityPool.withdrawFromSP('2309842309000000000000000000', { from: alice })
      await stabilityPoolERC20.withdrawFromSP('2309842309000000000000000000', { from: alice })

      // Check Alice's VST balance has risen by only the value of her compounded deposit
      const alice_expectedVSTBalance = (alice_VST_Balance_Before.add(alice_Deposit_Before).add(alice_Deposit_BeforeERC20)).toString()
      const alice_VST_Balance_After = (await vstToken.balanceOf(alice)).toString()
      assert.equal(alice_VST_Balance_After, alice_expectedVSTBalance)

      // Check VST in Stability Pool has been reduced by only Alice's compounded deposit and Bob's compounded deposit
      const expectedVSTinSP = (VSTinSP_Before.sub(alice_Deposit_Before).sub(bob_Deposit_Before)).toString()
      const VSTinSP_After = (await stabilityPool.getTotalVSTDeposits()).toString()
      assert.equal(VSTinSP_After, expectedVSTinSP)
    })

    it("withdrawFromSP(): Request to withdraw 2^256-1 VST only withdraws the caller's compounded deposit", async () => {
      // --- SETUP ---
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // A, B, C provides 100, 50, 30 VST to SP
      await stabilityPool.provideToSP(dec(100, 18), { from: alice })
      await stabilityPool.provideToSP(dec(50, 18), { from: bob })
      await stabilityPool.provideToSP(dec(30, 18), { from: carol })

      await stabilityPoolERC20.provideToSP(dec(100, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(50, 18), { from: bob })
      await stabilityPoolERC20.provideToSP(dec(30, 18), { from: carol })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Liquidate defaulter 1
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)

      const bob_VST_Balance_Before = await vstToken.balanceOf(bob)

      const bob_Deposit_Before = await stabilityPool.getCompoundedVSTDeposit(bob)
      const bob_Deposit_BeforeERC20 = await stabilityPoolERC20.getCompoundedVSTDeposit(bob)

      const VSTinSP_Before = await stabilityPool.getTotalVSTDeposits()
      const VSTinSP_BeforeERC20 = await stabilityPoolERC20.getTotalVSTDeposits()

      const maxBytes32 = web3.utils.toBN("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")

      // Price drops
      await priceFeed.setPrice(dec(200, 18))

      // Bob attempts to withdraws maxBytes32 VST from the Stability Pool
      await stabilityPool.withdrawFromSP(maxBytes32, { from: bob })
      await stabilityPoolERC20.withdrawFromSP(maxBytes32, { from: bob })

      // Check Bob's VST balance has risen by only the value of his compounded deposit
      const bob_expectedVSTBalance = (bob_VST_Balance_Before.add(bob_Deposit_Before).add(bob_Deposit_BeforeERC20)).toString()
      const bob_VST_Balance_After = (await vstToken.balanceOf(bob)).toString()
      assert.equal(bob_VST_Balance_After, bob_expectedVSTBalance)

      // Check VST in Stability Pool has been reduced by only  Bob's compounded deposit
      const expectedVSTinSP = (VSTinSP_Before.sub(bob_Deposit_Before)).toString()
      const VSTinSP_After = (await stabilityPool.getTotalVSTDeposits()).toString()
      assert.equal(VSTinSP_After, expectedVSTinSP)

      const expectedVSTinSPERC20 = (VSTinSP_BeforeERC20.sub(bob_Deposit_BeforeERC20)).toString()
      const VSTinSP_AfterERC20 = (await stabilityPoolERC20.getTotalVSTDeposits()).toString()
      assert.equal(VSTinSP_AfterERC20, expectedVSTinSPERC20)
    })

    it("withdrawFromSP(): caller can withdraw full deposit and ETH gain during Recovery Mode", async () => {
      // --- SETUP ---

      // Price doubles
      await priceFeed.setPrice(dec(400, 18))
      await openTrove({ extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      // Price halves
      await priceFeed.setPrice(dec(200, 18))

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(4, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(4, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(4, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(4, 18)), extraParams: { from: carol } })

      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getOpenTroveVSTAmount(dec(10000, 18), ZERO_ADDRESS), defaulter_1, defaulter_1, { from: defaulter_1, value: dec(100, 'ether') })
      await borrowerOperations.openTrove(erc20.address, dec(100, 'ether'), th._100pct, await getOpenTroveVSTAmount(dec(10000, 18), ZERO_ADDRESS), defaulter_1, defaulter_1, { from: defaulter_1 })

      // A, B, C provides 10000, 5000, 3000 VST to SP
      await stabilityPool.provideToSP(dec(10000, 18), { from: alice })
      await stabilityPool.provideToSP(dec(5000, 18), { from: bob })
      await stabilityPool.provideToSP(dec(3000, 18), { from: carol })

      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(5000, 18), { from: bob })
      await stabilityPoolERC20.provideToSP(dec(3000, 18), { from: carol })

      // Price drops
      await priceFeed.setPrice(dec(105, 18))
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      // Liquidate defaulter 1
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))

      const alice_VST_Balance_Before = await vstToken.balanceOf(alice)
      const bob_VST_Balance_Before = await vstToken.balanceOf(bob)
      const carol_VST_Balance_Before = await vstToken.balanceOf(carol)

      const alice_ETH_Balance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))
      const bob_ETH_Balance_Before = web3.utils.toBN(await web3.eth.getBalance(bob))
      const carol_ETH_Balance_Before = web3.utils.toBN(await web3.eth.getBalance(carol))

      const alice_ETH_Balance_BeforeERC20 = web3.utils.toBN(await erc20.balanceOf(alice))
      const bob_ETH_Balance_BeforeERC20 = web3.utils.toBN(await erc20.balanceOf(bob))
      const carol_ETH_Balance_BeforeERC20 = web3.utils.toBN(await erc20.balanceOf(carol))

      const alice_Deposit_Before = await stabilityPool.getCompoundedVSTDeposit(alice)
      const bob_Deposit_Before = await stabilityPool.getCompoundedVSTDeposit(bob)
      const carol_Deposit_Before = await stabilityPool.getCompoundedVSTDeposit(carol)

      const alice_Deposit_BeforeERC20 = await stabilityPoolERC20.getCompoundedVSTDeposit(alice)
      const bob_Deposit_BeforeERC20 = await stabilityPoolERC20.getCompoundedVSTDeposit(bob)
      const carol_Deposit_BeforeERC20 = await stabilityPoolERC20.getCompoundedVSTDeposit(carol)

      const alice_ETHGain_Before = await stabilityPool.getDepositorAssetGain(alice)
      const bob_ETHGain_Before = await stabilityPool.getDepositorAssetGain(bob)
      const carol_ETHGain_Before = await stabilityPool.getDepositorAssetGain(carol)

      const alice_ETHGain_BeforeERC20 = await stabilityPoolERC20.getDepositorAssetGain(alice)
      const bob_ETHGain_BeforeERC20 = await stabilityPoolERC20.getDepositorAssetGain(bob)
      const carol_ETHGain_BeforeERC20 = await stabilityPoolERC20.getDepositorAssetGain(carol)

      const VSTinSP_Before = await stabilityPool.getTotalVSTDeposits()
      const VSTinSP_BeforeERC20 = await stabilityPoolERC20.getTotalVSTDeposits()

      // Price rises
      await priceFeed.setPrice(dec(220, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      // A, B, C withdraw their full deposits from the Stability Pool
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice, gasPrice: 0 })
      await stabilityPool.withdrawFromSP(dec(5000, 18), { from: bob, gasPrice: 0 })
      await stabilityPool.withdrawFromSP(dec(3000, 18), { from: carol, gasPrice: 0 })

      await stabilityPoolERC20.withdrawFromSP(dec(10000, 18), { from: alice, gasPrice: 0 })
      await stabilityPoolERC20.withdrawFromSP(dec(5000, 18), { from: bob, gasPrice: 0 })
      await stabilityPoolERC20.withdrawFromSP(dec(3000, 18), { from: carol, gasPrice: 0 })

      // Check VST balances of A, B, C have risen by the value of their compounded deposits, respectively
      const alice_expectedVSTBalance = (alice_VST_Balance_Before.add(alice_Deposit_Before).add(alice_Deposit_BeforeERC20)).toString()
      const bob_expectedVSTBalance = (bob_VST_Balance_Before.add(bob_Deposit_Before).add(bob_Deposit_BeforeERC20)).toString()
      const carol_expectedVSTBalance = (carol_VST_Balance_Before.add(carol_Deposit_Before).add(carol_Deposit_BeforeERC20)).toString()

      const alice_VST_Balance_After = (await vstToken.balanceOf(alice)).toString()
      const bob_VST_Balance_After = (await vstToken.balanceOf(bob)).toString()
      const carol_VST_Balance_After = (await vstToken.balanceOf(carol)).toString()

      assert.equal(alice_VST_Balance_After, alice_expectedVSTBalance)
      assert.equal(bob_VST_Balance_After, bob_expectedVSTBalance)
      assert.equal(carol_VST_Balance_After, carol_expectedVSTBalance)

      // Check ETH balances of A, B, C have increased by the value of their ETH gain from liquidations, respectively
      const alice_expectedETHBalance = (alice_ETH_Balance_Before.add(alice_ETHGain_Before)).toString()
      const bob_expectedETHBalance = (bob_ETH_Balance_Before.add(bob_ETHGain_Before)).toString()
      const carol_expectedETHBalance = (carol_ETH_Balance_Before.add(carol_ETHGain_Before)).toString()

      const alice_expectedETHBalanceERC20 = (alice_ETH_Balance_BeforeERC20.add(alice_ETHGain_BeforeERC20)).toString()
      const bob_expectedETHBalanceERC20 = (bob_ETH_Balance_BeforeERC20.add(bob_ETHGain_BeforeERC20)).toString()
      const carol_expectedETHBalanceERC20 = (carol_ETH_Balance_BeforeERC20.add(carol_ETHGain_BeforeERC20)).toString()

      const alice_ETHBalance_After = (await web3.eth.getBalance(alice)).toString()
      const bob_ETHBalance_After = (await web3.eth.getBalance(bob)).toString()
      const carol_ETHBalance_After = (await web3.eth.getBalance(carol)).toString()

      const alice_ETHBalance_AfterERC20 = (await erc20.balanceOf(alice)).toString()
      const bob_ETHBalance_AfterERC20 = (await erc20.balanceOf(bob)).toString()
      const carol_ETHBalance_AfterERC20 = (await erc20.balanceOf(carol)).toString()

      assert.equal(alice_expectedETHBalance, alice_ETHBalance_After)
      assert.equal(bob_expectedETHBalance, bob_ETHBalance_After)
      assert.equal(carol_expectedETHBalance, carol_ETHBalance_After)

      assert.equal(alice_expectedETHBalanceERC20, alice_ETHBalance_AfterERC20)
      assert.equal(bob_expectedETHBalanceERC20, bob_ETHBalance_AfterERC20)
      assert.equal(carol_expectedETHBalanceERC20, carol_ETHBalance_AfterERC20)

      // Check VST in Stability Pool has been reduced by A, B and C's compounded deposit
      const expectedVSTinSP = (VSTinSP_Before
        .sub(alice_Deposit_Before)
        .sub(bob_Deposit_Before)
        .sub(carol_Deposit_Before))
        .toString()
      const VSTinSP_After = (await stabilityPool.getTotalVSTDeposits()).toString()
      assert.equal(VSTinSP_After, expectedVSTinSP)


      const expectedVSTinSPERC20 = (VSTinSP_BeforeERC20
        .sub(alice_Deposit_BeforeERC20)
        .sub(bob_Deposit_BeforeERC20)
        .sub(carol_Deposit_BeforeERC20))
        .toString()
      const VSTinSP_AfterERC20 = (await stabilityPoolERC20.getTotalVSTDeposits()).toString()
      assert.equal(VSTinSP_AfterERC20, expectedVSTinSPERC20)

      // Check ETH in SP has reduced to zero
      const ETHinSP_After = (await stabilityPool.getAssetBalance()).toString()
      assert.isAtMost(th.getDifference(ETHinSP_After, '0'), 100000)

      const ETHinSP_AfterERC20 = (await stabilityPoolERC20.getAssetBalance()).toString()
      assert.isAtMost(th.getDifference(ETHinSP_AfterERC20, '0'), 100000)
    })

    it("getDepositorETHGain(): depositor does not earn further ETH gains from liquidations while their compounded deposit == 0: ", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(1, 24)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1, 24)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C open troves
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // defaulters open troves 
      await openTrove({ extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_3 } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_3 } })

      // A, B, provide 10000, 5000 VST to SP
      await stabilityPool.provideToSP(dec(10000, 18), { from: alice })
      await stabilityPool.provideToSP(dec(5000, 18), { from: bob })

      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(5000, 18), { from: bob })

      //price drops
      await priceFeed.setPrice(dec(105, 18))

      // Liquidate defaulter 1. Empties the Pool
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))

      await troveManager.liquidate(erc20.address, defaulter_1)
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))

      const VSTinSP = (await stabilityPool.getTotalVSTDeposits()).toString()
      assert.equal(VSTinSP, '0')

      const VSTinSPERC20 = (await stabilityPoolERC20.getTotalVSTDeposits()).toString()
      assert.equal(VSTinSPERC20, '0')

      // Check Stability deposits have been fully cancelled with debt, and are now all zero
      const alice_Deposit = (await stabilityPool.getCompoundedVSTDeposit(alice)).toString()
      const bob_Deposit = (await stabilityPool.getCompoundedVSTDeposit(bob)).toString()

      const alice_DepositERC20 = (await stabilityPoolERC20.getCompoundedVSTDeposit(alice)).toString()
      const bob_DepositERC20 = (await stabilityPoolERC20.getCompoundedVSTDeposit(bob)).toString()

      assert.equal(alice_Deposit, '0')
      assert.equal(bob_Deposit, '0')
      assert.equal(alice_DepositERC20, '0')
      assert.equal(bob_DepositERC20, '0')

      // Get ETH gain for A and B
      const alice_ETHGain_1 = (await stabilityPool.getDepositorAssetGain(alice)).toString()
      const bob_ETHGain_1 = (await stabilityPool.getDepositorAssetGain(bob)).toString()

      const alice_ETHGain_1ERC20 = (await stabilityPoolERC20.getDepositorAssetGain(alice)).toString()
      const bob_ETHGain_1ERC20 = (await stabilityPoolERC20.getDepositorAssetGain(bob)).toString()

      // Whale deposits 10000 VST to Stability Pool
      await stabilityPool.provideToSP(dec(1, 24), { from: whale })
      await stabilityPoolERC20.provideToSP(dec(1, 24), { from: whale })

      // Liquidation 2
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_2)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_2))

      await troveManager.liquidate(erc20.address, defaulter_2)
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_2))

      // Check Alice and Bob have not received ETH gain from liquidation 2 while their deposit was 0
      const alice_ETHGain_2 = (await stabilityPool.getDepositorAssetGain(alice)).toString()
      const bob_ETHGain_2 = (await stabilityPool.getDepositorAssetGain(bob)).toString()

      const alice_ETHGain_2ERC20 = (await stabilityPoolERC20.getDepositorAssetGain(alice)).toString()
      const bob_ETHGain_2ERC20 = (await stabilityPoolERC20.getDepositorAssetGain(bob)).toString()

      assert.equal(alice_ETHGain_1, alice_ETHGain_2)
      assert.equal(bob_ETHGain_1, bob_ETHGain_2)

      assert.equal(alice_ETHGain_1ERC20, alice_ETHGain_2ERC20)
      assert.equal(bob_ETHGain_1ERC20, bob_ETHGain_2ERC20)

      // Liquidation 3
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_3)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_3))

      await troveManager.liquidate(erc20.address, defaulter_3)
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_3))

      // Check Alice and Bob have not received ETH gain from liquidation 3 while their deposit was 0
      const alice_ETHGain_3 = (await stabilityPool.getDepositorAssetGain(alice)).toString()
      const bob_ETHGain_3 = (await stabilityPool.getDepositorAssetGain(bob)).toString()

      const alice_ETHGain_3ERC20 = (await stabilityPoolERC20.getDepositorAssetGain(alice)).toString()
      const bob_ETHGain_3ERC20 = (await stabilityPoolERC20.getDepositorAssetGain(bob)).toString()

      assert.equal(alice_ETHGain_1, alice_ETHGain_3)
      assert.equal(bob_ETHGain_1, bob_ETHGain_3)

      assert.equal(alice_ETHGain_1ERC20, alice_ETHGain_3ERC20)
      assert.equal(bob_ETHGain_1ERC20, bob_ETHGain_3ERC20)
    })

    // --- VSTA functionality ---
    it("withdrawFromSP(): triggers VSTA reward event - increases the sum G", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(1, 24)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1, 24)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C open troves
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // A and B provide to SP
      await stabilityPool.provideToSP(dec(10000, 18), { from: A })
      await stabilityPool.provideToSP(dec(10000, 18), { from: B })

      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: B })

      const G_Before = await stabilityPool.epochToScaleToG(0, 0)
      const G_BeforeERC20 = await stabilityPoolERC20.epochToScaleToG(0, 0)

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // A withdraws from SP
      await stabilityPool.withdrawFromSP(dec(5000, 18), { from: A })
      await stabilityPoolERC20.withdrawFromSP(dec(5000, 18), { from: A })

      const G_1 = await stabilityPool.epochToScaleToG(0, 0)
      const G_1ERC20 = await stabilityPoolERC20.epochToScaleToG(0, 0)

      // Expect G has increased from the VSTA reward event triggered
      assert.isTrue(G_1.gt(G_Before))
      assert.isTrue(G_1ERC20.gt(G_BeforeERC20))

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // A withdraws from SP
      await stabilityPool.withdrawFromSP(dec(5000, 18), { from: B })
      await stabilityPoolERC20.withdrawFromSP(dec(5000, 18), { from: B })

      const G_2 = await stabilityPool.epochToScaleToG(0, 0)
      const G_2ERC20 = await stabilityPoolERC20.epochToScaleToG(0, 0)

      // Expect G has increased from the VSTA reward event triggered
      assert.isTrue(G_2.gt(G_1))
      assert.isTrue(G_2ERC20.gt(G_1ERC20))
    })

    it("withdrawFromSP(), partial withdrawal: depositor receives VSTA rewards", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C open troves
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // A, B, C, provide to SP
      await stabilityPool.provideToSP(dec(10, 18), { from: A })
      await stabilityPool.provideToSP(dec(20, 18), { from: B })
      await stabilityPool.provideToSP(dec(30, 18), { from: C })

      await stabilityPoolERC20.provideToSP(dec(10, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(20, 18), { from: B })
      await stabilityPoolERC20.provideToSP(dec(30, 18), { from: C })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // Get A, B, C VSTA balance before
      const A_VSTABalance_Before = await vstaToken.balanceOf(A)
      const B_VSTABalance_Before = await vstaToken.balanceOf(B)
      const C_VSTABalance_Before = await vstaToken.balanceOf(C)

      // A, B, C withdraw
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: A })
      await stabilityPool.withdrawFromSP(dec(2, 18), { from: B })
      await stabilityPool.withdrawFromSP(dec(3, 18), { from: C })

      await stabilityPoolERC20.withdrawFromSP(dec(1, 18), { from: A })
      await stabilityPoolERC20.withdrawFromSP(dec(2, 18), { from: B })
      await stabilityPoolERC20.withdrawFromSP(dec(3, 18), { from: C })

      // Get VSTA balance after
      const A_VSTABalance_After = await vstaToken.balanceOf(A)
      const B_VSTABalance_After = await vstaToken.balanceOf(B)
      const C_VSTABalance_After = await vstaToken.balanceOf(C)

      // Check VSTA Balance of A, B, C has increased
      assert.isTrue(A_VSTABalance_After.gt(A_VSTABalance_Before))
      assert.isTrue(B_VSTABalance_After.gt(B_VSTABalance_Before))
      assert.isTrue(C_VSTABalance_After.gt(C_VSTABalance_Before))
    })

    it("withdrawFromSP(), partial withdrawal: System's stake decreases", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C, D, E, F open troves 
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: F } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: F } })

      // A, B, C, D, E, F provide to SP
      await stabilityPool.provideToSP(dec(10, 18), { from: A })
      await stabilityPool.provideToSP(dec(20, 18), { from: B })
      await stabilityPool.provideToSP(dec(30, 18), { from: C })
      await stabilityPool.provideToSP(dec(10, 18), { from: D })
      await stabilityPool.provideToSP(dec(20, 18), { from: E })
      await stabilityPool.provideToSP(dec(30, 18), { from: F })

      await stabilityPoolERC20.provideToSP(dec(10, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(20, 18), { from: B })
      await stabilityPoolERC20.provideToSP(dec(30, 18), { from: C })
      await stabilityPoolERC20.provideToSP(dec(10, 18), { from: D })
      await stabilityPoolERC20.provideToSP(dec(20, 18), { from: E })
      await stabilityPoolERC20.provideToSP(dec(30, 18), { from: F })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // Get front ends' stake before
      const Stake_Before = await stabilityPool.totalStakes()
      const Stake_BeforeERC20 = await stabilityPoolERC20.totalStakes()

      // A, B, C withdraw 
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: A })
      await stabilityPool.withdrawFromSP(dec(2, 18), { from: B })
      await stabilityPool.withdrawFromSP(dec(3, 18), { from: C })

      await stabilityPoolERC20.withdrawFromSP(dec(1, 18), { from: A })
      await stabilityPoolERC20.withdrawFromSP(dec(2, 18), { from: B })
      await stabilityPoolERC20.withdrawFromSP(dec(3, 18), { from: C })

      // Get front ends' stakes after
      const Stake_After = await stabilityPool.totalStakes()
      const Stake_AfterERC20 = await stabilityPoolERC20.totalStakes()

      // Check front ends' stakes have decreased
      assert.isTrue(Stake_After.lt(Stake_Before))
      assert.isTrue(Stake_AfterERC20.lt(Stake_BeforeERC20))
    })

    it("withdrawFromSP(), partial withdrawal: System's snapshots update", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C, open troves 
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(60000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(60000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // D opens trove
      await openTrove({ extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // --- SETUP ---

      const deposit_A = dec(10000, 18)
      const deposit_B = dec(20000, 18)
      const deposit_C = dec(30000, 18)

      // A, B, C make their initial deposits
      await stabilityPool.provideToSP(deposit_A, { from: A })
      await stabilityPool.provideToSP(deposit_B, { from: B })
      await stabilityPool.provideToSP(deposit_C, { from: C })

      await stabilityPoolERC20.provideToSP(deposit_A, { from: A })
      await stabilityPoolERC20.provideToSP(deposit_B, { from: B })
      await stabilityPoolERC20.provideToSP(deposit_C, { from: C })

      // fastforward time then make an SP deposit, to make G > 0
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: D })
      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: D })

      // perform a liquidation to make 0 < P < 1, and S > 0
      await priceFeed.setPrice(dec(105, 18))
      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)

      const currentEpoch = await stabilityPool.currentEpoch()
      const currentScale = await stabilityPool.currentScale()

      const S_Before = await stabilityPool.epochToScaleToSum(currentEpoch, currentScale)
      const P_Before = await stabilityPool.P()
      const G_Before = await stabilityPool.epochToScaleToG(currentEpoch, currentScale)

      const currentEpochERC20 = await stabilityPoolERC20.currentEpoch()
      const currentScaleERC20 = await stabilityPoolERC20.currentScale()

      const S_BeforeERC20 = await stabilityPoolERC20.epochToScaleToSum(currentEpochERC20, currentScaleERC20)
      const P_BeforeERC20 = await stabilityPoolERC20.P()
      const G_BeforeERC20 = await stabilityPoolERC20.epochToScaleToG(currentEpochERC20, currentScaleERC20)

      // Confirm 0 < P < 1
      assert.isTrue(P_Before.gt(toBN('0')) && P_Before.lt(toBN(dec(1, 18))))
      assert.isTrue(P_BeforeERC20.gt(toBN('0')) && P_BeforeERC20.lt(toBN(dec(1, 18))))
      // Confirm S, G are both > 0
      assert.isTrue(S_Before.gt(toBN('0')))
      assert.isTrue(G_Before.gt(toBN('0')))
      assert.isTrue(S_BeforeERC20.gt(toBN('0')))
      assert.isTrue(G_BeforeERC20.gt(toBN('0')))

      // --- TEST ---

      await priceFeed.setPrice(dec(200, 18))

      // A, B, C top withdraw part of their deposits. Grab G at each stage, as it can increase a bit
      // between topups, because some block.timestamp time passes (and LQTY is issued) between ops
      const G1 = await stabilityPool.epochToScaleToG(currentScale, currentEpoch)
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: A })

      const G1ERC20 = await stabilityPoolERC20.epochToScaleToG(currentScaleERC20, currentEpochERC20)
      await stabilityPoolERC20.withdrawFromSP(dec(1, 18), { from: A })

      const snapshot = await stabilityPool.systemSnapshots()
      assert.equal(snapshot[0], '0')  // S (should always be 0 for front ends)
      assert.isTrue(snapshot[1].eq(P_Before))  // P 
      assert.isTrue(snapshot[2].eq(G1))  // G
      assert.equal(snapshot[3], '0')  // scale
      assert.equal(snapshot[4], '0')  // epoch

      const snapshotERC20 = await stabilityPoolERC20.systemSnapshots()
      assert.equal(snapshotERC20[0], '0')  // S (should always be 0 for front ends)
      assert.isTrue(snapshotERC20[1].eq(P_BeforeERC20))  // P 
      assert.isTrue(snapshotERC20[2].eq(G1ERC20))  // G
      assert.equal(snapshotERC20[3], '0')  // scale
      assert.equal(snapshotERC20[4], '0')  // epoch
    })

    it("withdrawFromSP(), full withdrawal: zero's depositor's snapshots", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      //  SETUP: Execute a series of operations to make G, S > 0 and P < 1  

      // E opens trove and makes a deposit
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: E } })
      await stabilityPool.provideToSP(dec(10000, 18), { from: E })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: E } })
      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: E })

      // Fast-forward time and make a second deposit, to trigger VSTA reward and make G > 0
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
      await stabilityPool.provideToSP(dec(10000, 18), { from: E })
      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: E })

      // perform a liquidation to make 0 < P < 1, and S > 0
      await priceFeed.setPrice(dec(105, 18))
      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)

      const currentEpoch = await stabilityPool.currentEpoch()
      const currentScale = await stabilityPool.currentScale()

      const currentEpochERC20 = await stabilityPoolERC20.currentEpoch()
      const currentScaleERC20 = await stabilityPoolERC20.currentScale()

      const S_Before = await stabilityPool.epochToScaleToSum(currentEpoch, currentScale)
      const P_Before = await stabilityPool.P()
      const G_Before = await stabilityPool.epochToScaleToG(currentEpoch, currentScale)

      const S_BeforeERC20 = await stabilityPoolERC20.epochToScaleToSum(currentEpochERC20, currentScaleERC20)
      const P_BeforeERC20 = await stabilityPoolERC20.P()
      const G_BeforeERC20 = await stabilityPoolERC20.epochToScaleToG(currentEpochERC20, currentScaleERC20)

      // Confirm 0 < P < 1
      assert.isTrue(P_Before.gt(toBN('0')) && P_Before.lt(toBN(dec(1, 18))))
      assert.isTrue(P_BeforeERC20.gt(toBN('0')) && P_BeforeERC20.lt(toBN(dec(1, 18))))
      // Confirm S, G are both > 0
      assert.isTrue(S_Before.gt(toBN('0')))
      assert.isTrue(G_Before.gt(toBN('0')))
      assert.isTrue(S_BeforeERC20.gt(toBN('0')))
      assert.isTrue(G_BeforeERC20.gt(toBN('0')))

      // --- TEST ---

      // Whale transfers to A, B
      await vstToken.transfer(A, dec(20000, 18), { from: whale })
      await vstToken.transfer(B, dec(40000, 18), { from: whale })

      await priceFeed.setPrice(dec(200, 18))

      // C, D open troves
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: D } })

      // A, B, C, D make their initial deposits
      await stabilityPool.provideToSP(dec(10000, 18), { from: A })
      await stabilityPool.provideToSP(dec(20000, 18), { from: B })
      await stabilityPool.provideToSP(dec(30000, 18), { from: C })
      await stabilityPool.provideToSP(dec(40000, 18), { from: D })

      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(20000, 18), { from: B })
      await stabilityPoolERC20.provideToSP(dec(30000, 18), { from: C })
      await stabilityPoolERC20.provideToSP(dec(40000, 18), { from: D })

      // Check deposits snapshots are non-zero

      for (depositor of [A, B, C, D]) {
        const snapshot = await stabilityPool.depositSnapshots(depositor)

        const ZERO = toBN('0')
        // Check S,P, G snapshots are non-zero
        assert.isTrue(snapshot[0].eq(S_Before))  // S 
        assert.isTrue(snapshot[1].eq(P_Before))  // P 
        assert.isTrue(snapshot[2].gt(ZERO))  // GL increases a bit between each depositor op, so just check it is non-zero
        assert.equal(snapshot[3], '0')  // scale
        assert.equal(snapshot[4], '0')  // epoch
      }

      for (depositor of [A, B, C, D]) {
        const snapshot = await stabilityPoolERC20.depositSnapshots(depositor)

        const ZERO = toBN('0')
        // Check S,P, G snapshots are non-zero
        assert.isTrue(snapshot[0].eq(S_BeforeERC20))  // S 
        assert.isTrue(snapshot[1].eq(P_BeforeERC20))  // P 
        assert.isTrue(snapshot[2].gt(ZERO))  // GL increases a bit between each depositor op, so just check it is non-zero
        assert.equal(snapshot[3], '0')  // scale
        assert.equal(snapshot[4], '0')  // epoch
      }

      // All depositors make full withdrawal
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: A })
      await stabilityPool.withdrawFromSP(dec(20000, 18), { from: B })
      await stabilityPool.withdrawFromSP(dec(30000, 18), { from: C })
      await stabilityPool.withdrawFromSP(dec(40000, 18), { from: D })

      await stabilityPoolERC20.withdrawFromSP(dec(10000, 18), { from: A })
      await stabilityPoolERC20.withdrawFromSP(dec(20000, 18), { from: B })
      await stabilityPoolERC20.withdrawFromSP(dec(30000, 18), { from: C })
      await stabilityPoolERC20.withdrawFromSP(dec(40000, 18), { from: D })

      // Check all depositors' snapshots have been zero'd
      for (depositor of [A, B, C, D]) {
        const snapshot = await stabilityPool.depositSnapshots(depositor)

        // Check S, P, G snapshots are now zero
        assert.equal(snapshot[0], '0')  // S 
        assert.equal(snapshot[1], '0')  // P 
        assert.equal(snapshot[2], '0')  // G
        assert.equal(snapshot[3], '0')  // scale
        assert.equal(snapshot[4], '0')  // epoch
      }

      for (depositor of [A, B, C, D]) {
        const snapshot = await stabilityPoolERC20.depositSnapshots(depositor)

        // Check S, P, G snapshots are now zero
        assert.equal(snapshot[0], '0')  // S 
        assert.equal(snapshot[1], '0')  // P 
        assert.equal(snapshot[2], '0')  // G
        assert.equal(snapshot[3], '0')  // scale
        assert.equal(snapshot[4], '0')  // epoch
      }
    })

    it("withdrawFromSP(), reverts when initial deposit value is 0", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A opens trove and join the Stability Pool
      await openTrove({ extraVSTAmount: toBN(dec(10100, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await stabilityPool.provideToSP(dec(10000, 18), { from: A })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10100, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: A })

      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      //  SETUP: Execute a series of operations to trigger VSTA and ETH rewards for depositor A

      // Fast-forward time and make a second deposit, to trigger VSTA reward and make G > 0
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
      await stabilityPool.provideToSP(dec(100, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(100, 18), { from: A })

      // perform a liquidation to make 0 < P < 1, and S > 0
      await priceFeed.setPrice(dec(105, 18))
      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))

      await priceFeed.setPrice(dec(200, 18))

      // A successfully withraws deposit and all gains
      await stabilityPool.withdrawFromSP(dec(10100, 18), { from: A })
      await stabilityPoolERC20.withdrawFromSP(dec(10100, 18), { from: A })

      // Confirm A's recorded deposit is 0
      assert.equal(await stabilityPool.deposits(A), '0')
      assert.equal(await stabilityPoolERC20.deposits(A), '0')

      // --- TEST ---
      const expectedRevertMessage = "StabilityPool: User must have a non-zero deposit"

      // Further withdrawal attempt from A
      await th.assertRevert(stabilityPool.withdrawFromSP(dec(10000, 18), { from: A }), expectedRevertMessage)

      await th.assertRevert(stabilityPoolERC20.withdrawFromSP(dec(10000, 18), { from: A }), expectedRevertMessage)

      // Withdrawal attempt of a non-existent deposit, from C
      await th.assertRevert(stabilityPool.withdrawFromSP(dec(10000, 18), { from: C }), expectedRevertMessage)
    })

    // --- withdrawETHGainToTrove ---

    it("withdrawETHGainToTrove(): reverts when user has no active deposit", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      await stabilityPool.provideToSP(dec(10000, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: alice })

      const alice_initialDeposit = (await stabilityPool.deposits(alice)).toString()
      const bob_initialDeposit = (await stabilityPool.deposits(bob)).toString()

      const alice_initialDepositERC20 = (await stabilityPoolERC20.deposits(alice)).toString()
      const bob_initialDepositERC20 = (await stabilityPoolERC20.deposits(bob)).toString()

      assert.equal(alice_initialDeposit, dec(10000, 18))
      assert.equal(bob_initialDeposit, '0')

      assert.equal(alice_initialDepositERC20, dec(10000, 18))
      assert.equal(bob_initialDepositERC20, '0')

      // Defaulter opens a trove, price drops, defaulter gets liquidated
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await priceFeed.setPrice(dec(105, 18))

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)

      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))

      const txAlice = await stabilityPool.withdrawAssetGainToTrove(alice, alice, { from: alice })
      assert.isTrue(txAlice.receipt.status)

      const txAliceERC20 = await stabilityPoolERC20.withdrawAssetGainToTrove(alice, alice, { from: alice })
      assert.isTrue(txAliceERC20.receipt.status)

      const txPromise_B = stabilityPool.withdrawAssetGainToTrove(bob, bob, { from: bob })
      await th.assertRevert(txPromise_B)

      const txPromise_BERC20 = stabilityPoolERC20.withdrawAssetGainToTrove(bob, bob, { from: bob })
      await th.assertRevert(txPromise_BERC20)
    })

    it("withdrawETHGainToTrove(): Applies VSTLoss to user's deposit, and redirects ETH reward to user's Trove", async () => {
      // --- SETUP ---
      // Whale deposits 185000 VST in StabilityPool
      await openTrove({ extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPool.provideToSP(dec(185000, 18), { from: whale })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPoolERC20.provideToSP(dec(185000, 18), { from: whale })

      // Defaulter opens trove
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // --- TEST ---

      // Alice makes deposit #1: 15000 VST
      await openTrove({ extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await stabilityPool.provideToSP(dec(15000, 18), { from: alice })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await stabilityPoolERC20.provideToSP(dec(15000, 18), { from: alice })

      // check Alice's Trove recorded ETH Before:
      const aliceTrove_Before = await troveManager.Troves(alice, ZERO_ADDRESS)
      const aliceTrove_ETH_Before = aliceTrove_Before[th.TROVE_COLL_INDEX]
      assert.isTrue(aliceTrove_ETH_Before.gt(toBN('0')))

      const aliceTrove_BeforeERC20 = await troveManager.Troves(alice, erc20.address)
      const aliceTrove_ETH_BeforeERC20 = aliceTrove_BeforeERC20[th.TROVE_COLL_INDEX]
      assert.isTrue(aliceTrove_ETH_BeforeERC20.gt(toBN('0')))

      // price drops: defaulter's Trove falls below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(dec(105, 18));

      // Defaulter's Trove is closed
      const liquidationTx_1 = await troveManager.liquidate(ZERO_ADDRESS, defaulter_1, { from: owner })
      const [liquidatedDebt, liquidatedColl, ,] = th.getEmittedLiquidationValues(liquidationTx_1)

      const liquidationTx_1ERC20 = await troveManager.liquidate(erc20.address, defaulter_1, { from: owner })
      const [liquidatedDebtERC20, liquidatedCollERC20, ,] = th.getEmittedLiquidationValues(liquidationTx_1ERC20)

      const ETHGain_A = await stabilityPool.getDepositorAssetGain(alice)
      const compoundedDeposit_A = await stabilityPool.getCompoundedVSTDeposit(alice)


      const ETHGain_AERC20 = await stabilityPoolERC20.getDepositorAssetGain(alice)
      const compoundedDeposit_AERC20 = await stabilityPoolERC20.getCompoundedVSTDeposit(alice)

      // Alice should receive rewards proportional to her deposit as share of total deposits
      const expectedETHGain_A = liquidatedColl.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18)))
      const expectedVSTLoss_A = liquidatedDebt.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18)))
      const expectedCompoundedDeposit_A = toBN(dec(15000, 18)).sub(expectedVSTLoss_A)

      const expectedETHGain_AERC20 = liquidatedCollERC20.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18)))
      const expectedVSTLoss_AERC20 = liquidatedDebtERC20.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18)))
      const expectedCompoundedDeposit_AERC20 = toBN(dec(15000, 18)).sub(expectedVSTLoss_AERC20)

      assert.isAtMost(th.getDifference(expectedCompoundedDeposit_A, compoundedDeposit_A), 100000)
      assert.isAtMost(th.getDifference(expectedCompoundedDeposit_AERC20, compoundedDeposit_AERC20), 100000)

      // Alice sends her ETH Gains to her Trove
      await stabilityPool.withdrawAssetGainToTrove(alice, alice, { from: alice })
      await stabilityPoolERC20.withdrawAssetGainToTrove(alice, alice, { from: alice })

      // check Alice's VSTLoss has been applied to her deposit expectedCompoundedDeposit_A
      alice_deposit_afterDefault = (await stabilityPool.deposits(alice))
      assert.isAtMost(th.getDifference(alice_deposit_afterDefault, expectedCompoundedDeposit_A), 100000)

      alice_deposit_afterDefaultERC20 = (await stabilityPool.deposits(alice))
      assert.isAtMost(th.getDifference(alice_deposit_afterDefaultERC20, expectedCompoundedDeposit_AERC20), 100000)

      // check alice's Trove recorded ETH has increased by the expected reward amount
      const aliceTrove_After = await troveManager.Troves(alice, ZERO_ADDRESS)
      const aliceTrove_ETH_After = aliceTrove_After[th.TROVE_COLL_INDEX]

      const aliceTrove_AfterERC20 = await troveManager.Troves(alice, erc20.address)
      const aliceTrove_ETH_AfterERC20 = aliceTrove_AfterERC20[th.TROVE_COLL_INDEX]

      const Trove_ETH_Increase = (aliceTrove_ETH_After.sub(aliceTrove_ETH_Before)).toString()
      const Trove_ETH_IncreaseERC20 = (aliceTrove_ETH_AfterERC20.sub(aliceTrove_ETH_BeforeERC20)).toString()

      assert.equal(Trove_ETH_Increase, ETHGain_A)
      assert.equal(toBN(Trove_ETH_IncreaseERC20).div(toBN(10 ** 10)).toString(), ETHGain_AERC20)
    })

    it("withdrawETHGainToTrove(): reverts if it would leave trove with ICR < MCR", async () => {
      // --- SETUP ---
      // Whale deposits 1850 VST in StabilityPool
      await openTrove({ extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPool.provideToSP(dec(185000, 18), { from: whale })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPoolERC20.provideToSP(dec(185000, 18), { from: whale })

      // defaulter opened
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // --- TEST ---

      // Alice makes deposit #1: 15000 VST
      await openTrove({ extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await stabilityPool.provideToSP(dec(15000, 18), { from: alice })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await stabilityPoolERC20.provideToSP(dec(15000, 18), { from: alice })

      // check alice's Trove recorded ETH Before:
      const aliceTrove_Before = await troveManager.Troves(alice, ZERO_ADDRESS,)
      const aliceTrove_ETH_Before = aliceTrove_Before[1]
      assert.isTrue(aliceTrove_ETH_Before.gt(toBN('0')))

      const aliceTrove_BeforeERC20 = await troveManager.Troves(alice, erc20.address)
      const aliceTrove_ETH_BeforeERC20 = aliceTrove_BeforeERC20[1]
      assert.isTrue(aliceTrove_ETH_BeforeERC20.gt(toBN('0')))

      // price drops: defaulter's Trove falls below MCR
      await priceFeed.setPrice(dec(10, 18));

      // defaulter's Trove is closed.
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1, { from: owner })
      await troveManager.liquidate(erc20.address, defaulter_1, { from: owner })

      // Alice attempts to  her ETH Gains to her Trove
      await assertRevert(stabilityPool.withdrawAssetGainToTrove(alice, alice, { from: alice }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")

      await assertRevert(stabilityPoolERC20.withdrawAssetGainToTrove(alice, alice, { from: alice }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("withdrawETHGainToTrove(): Subsequent deposit and withdrawal attempt from same account, with no intermediate liquidations, withdraws zero ETH", async () => {
      // --- SETUP ---
      // Whale deposits 1850 VST in StabilityPool
      await openTrove({ extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPool.provideToSP(dec(185000, 18), { from: whale })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPoolERC20.provideToSP(dec(185000, 18), { from: whale })

      // defaulter opened
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // --- TEST ---

      // Alice makes deposit #1: 15000 VST
      await openTrove({ extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await stabilityPool.provideToSP(dec(15000, 18), { from: alice })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await stabilityPoolERC20.provideToSP(dec(15000, 18), { from: alice })

      // check alice's Trove recorded ETH Before:
      const aliceTrove_Before = await troveManager.Troves(alice, ZERO_ADDRESS,)
      const aliceTrove_ETH_Before = aliceTrove_Before[1]
      assert.isTrue(aliceTrove_ETH_Before.gt(toBN('0')))

      const aliceTrove_BeforeERC20 = await troveManager.Troves(alice, erc20.address)
      const aliceTrove_ETH_BeforeERC20 = aliceTrove_BeforeERC20[1]
      assert.isTrue(aliceTrove_ETH_BeforeERC20.gt(toBN('0')))

      // price drops: defaulter's Trove falls below MCR
      await priceFeed.setPrice(dec(105, 18));

      // defaulter's Trove is closed.
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1, { from: owner })
      await troveManager.liquidate(erc20.address, defaulter_1, { from: owner })

      // price bounces back
      await priceFeed.setPrice(dec(200, 18));

      // Alice sends her ETH Gains to her Trove
      await stabilityPool.withdrawAssetGainToTrove(alice, alice, { from: alice })
      await stabilityPoolERC20.withdrawAssetGainToTrove(alice, alice, { from: alice })

      assert.equal(await stabilityPool.getDepositorAssetGain(alice), 0)
      assert.equal(await stabilityPoolERC20.getDepositorAssetGain(alice), 0)

      const ETHinSP_Before = (await stabilityPool.getAssetBalance()).toString()
      const ETHinSP_BeforeERC20 = (await stabilityPoolERC20.getAssetBalance()).toString()

      // Alice attempts second withdrawal from SP to Trove - reverts, due to 0 ETH Gain
      const txPromise_A = stabilityPool.withdrawAssetGainToTrove(alice, alice, { from: alice })
      await th.assertRevert(txPromise_A)

      const txPromise_AERC20 = stabilityPoolERC20.withdrawAssetGainToTrove(alice, alice, { from: alice })
      await th.assertRevert(txPromise_AERC20)

      // Check ETH in pool does not change
      const ETHinSP_1 = (await stabilityPool.getAssetBalance()).toString()
      assert.equal(ETHinSP_Before, ETHinSP_1)

      const ETHinSP_1ERC20 = (await stabilityPoolERC20.getAssetBalance()).toString()
      assert.equal(ETHinSP_BeforeERC20, ETHinSP_1ERC20)

      await priceFeed.setPrice(dec(200, 18));

      // Alice attempts third withdrawal (this time, from SP to her own account)
      await stabilityPool.withdrawFromSP(dec(15000, 18), { from: alice })
      await stabilityPoolERC20.withdrawFromSP(dec(15000, 18), { from: alice })

      // Check ETH in pool does not change
      const ETHinSP_2 = (await stabilityPool.getAssetBalance()).toString()
      assert.equal(ETHinSP_Before, ETHinSP_2)

      const ETHinSP_2ERC20 = (await stabilityPoolERC20.getAssetBalance()).toString()
      assert.equal(ETHinSP_BeforeERC20, ETHinSP_2ERC20)
    })

    it("withdrawETHGainToTrove(): decreases StabilityPool ETH and increases activePool ETH", async () => {
      // --- SETUP ---
      // Whale deposits 185000 VST in StabilityPool
      await openTrove({ extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPool.provideToSP(dec(185000, 18), { from: whale })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await stabilityPoolERC20.provideToSP(dec(185000, 18), { from: whale })

      // defaulter opened
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // --- TEST ---

      // Alice makes deposit #1: 15000 VST
      await openTrove({ extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await stabilityPool.provideToSP(dec(15000, 18), { from: alice })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await stabilityPoolERC20.provideToSP(dec(15000, 18), { from: alice })

      // price drops: defaulter's Trove falls below MCR
      await priceFeed.setPrice(dec(100, 18));

      // defaulter's Trove is closed.
      const liquidationTx = await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      const liquidationTxERC20 = await troveManager.liquidate(erc20.address, defaulter_1)
      const [liquidatedDebtERC20, liquidatedCollERC20, gasCompERC20] = th.getEmittedLiquidationValues(liquidationTxERC20)

      // Expect alice to be entitled to 15000/200000 of the liquidated coll
      const aliceExpectedETHGain = liquidatedColl.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18)))
      const aliceETHGain = await stabilityPool.getDepositorAssetGain(alice)
      assert.isTrue(aliceExpectedETHGain.eq(aliceETHGain))

      const aliceExpectedETHGainERC20 = liquidatedCollERC20.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18)))
      const aliceETHGainERC20 = await stabilityPoolERC20.getDepositorAssetGain(alice)
      assert.isTrue(aliceExpectedETHGainERC20.div(toBN(10 ** 10)).eq(aliceETHGainERC20))

      // price bounces back
      await priceFeed.setPrice(dec(200, 18));

      //check activePool and StabilityPool Ether before retrieval:
      const active_ETH_Before = await activePool.getAssetBalance(ZERO_ADDRESS)
      const stability_ETH_Before = await stabilityPool.getAssetBalance()

      const active_ETH_BeforeERC20 = await activePool.getAssetBalance(erc20.address)
      const stability_ETH_BeforeERC20 = await stabilityPoolERC20.getAssetBalance()

      // Alice retrieves redirects ETH gain to her Trove
      await stabilityPool.withdrawAssetGainToTrove(alice, alice, { from: alice })
      await stabilityPoolERC20.withdrawAssetGainToTrove(alice, alice, { from: alice })

      const active_ETH_After = await activePool.getAssetBalance(ZERO_ADDRESS)
      const stability_ETH_After = await stabilityPool.getAssetBalance()

      const active_ETH_AfterERC20 = await activePool.getAssetBalance(erc20.address)
      const stability_ETH_AfterERC20 = await stabilityPoolERC20.getAssetBalance()

      const active_ETH_Difference = (active_ETH_After.sub(active_ETH_Before)) // AP ETH should increase
      const stability_ETH_Difference = (stability_ETH_Before.sub(stability_ETH_After)) // SP ETH should decrease

      const active_ETH_DifferenceERC20 = (active_ETH_AfterERC20.sub(active_ETH_BeforeERC20)) // AP ETH should increase
      const stability_ETH_DifferenceERC20 = (stability_ETH_BeforeERC20.sub(stability_ETH_AfterERC20)) // SP ETH should decrease

      // check Pool ETH values change by Alice's AssetGain, i.e 0.075 ETH
      assert.isAtMost(th.getDifference(active_ETH_Difference, aliceETHGain), 10000)
      assert.isAtMost(th.getDifference(stability_ETH_Difference, aliceETHGain), 10000)

      assert.isAtMost(th.getDifference(active_ETH_DifferenceERC20.div(toBN(10 ** 10)), aliceETHGainERC20), 10000)
      assert.isAtMost(th.getDifference(stability_ETH_DifferenceERC20.div(toBN(10 ** 10)), aliceETHGainERC20), 10000)
    })

    it("withdrawETHGainToTrove(): All depositors are able to withdraw their ETH gain from the SP to their Trove", async () => {
      // Whale opens trove 
      await openTrove({ extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // Defaulter opens trove
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // 6 Accounts open troves and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
        await stabilityPool.provideToSP(dec(10000, 18), { from: account })
      }

      for (account of depositors) {
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
        await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: account })
      }

      await priceFeed.setPrice(dec(105, 18))
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)

      // price bounces back
      await priceFeed.setPrice(dec(200, 18));

      // All depositors attempt to withdraw
      const tx1 = await stabilityPool.withdrawAssetGainToTrove(alice, alice, { from: alice })
      assert.isTrue(tx1.receipt.status)
      const tx2 = await stabilityPool.withdrawAssetGainToTrove(bob, bob, { from: bob })
      assert.isTrue(tx2.receipt.status)
      const tx3 = await stabilityPool.withdrawAssetGainToTrove(carol, carol, { from: carol })
      assert.isTrue(tx3.receipt.status)
      const tx4 = await stabilityPool.withdrawAssetGainToTrove(dennis, dennis, { from: dennis })
      assert.isTrue(tx4.receipt.status)
      const tx5 = await stabilityPool.withdrawAssetGainToTrove(erin, erin, { from: erin })
      assert.isTrue(tx5.receipt.status)
      const tx6 = await stabilityPool.withdrawAssetGainToTrove(flyn, flyn, { from: flyn })
      assert.isTrue(tx6.receipt.status)

      const tx1ERC20 = await stabilityPoolERC20.withdrawAssetGainToTrove(alice, alice, { from: alice })
      assert.isTrue(tx1ERC20.receipt.status)
      const tx2ERC20 = await stabilityPoolERC20.withdrawAssetGainToTrove(bob, bob, { from: bob })
      assert.isTrue(tx2ERC20.receipt.status)
      const tx3ERC20 = await stabilityPoolERC20.withdrawAssetGainToTrove(carol, carol, { from: carol })
      assert.isTrue(tx3ERC20.receipt.status)
      const tx4ERC20 = await stabilityPoolERC20.withdrawAssetGainToTrove(dennis, dennis, { from: dennis })
      assert.isTrue(tx4ERC20.receipt.status)
      const tx5ERC20 = await stabilityPoolERC20.withdrawAssetGainToTrove(erin, erin, { from: erin })
      assert.isTrue(tx5ERC20.receipt.status)
      const tx6ERC20 = await stabilityPoolERC20.withdrawAssetGainToTrove(flyn, flyn, { from: flyn })
      assert.isTrue(tx6ERC20.receipt.status)
    })

    it("withdrawETHGainToTrove(): All depositors withdraw, each withdraw their correct ETH gain", async () => {
      // Whale opens trove 
      await openTrove({ extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // defaulter opened
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // 6 Accounts open troves and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
        await stabilityPool.provideToSP(dec(10000, 18), { from: account })
      }

      for (account of depositors) {
        await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
        await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: account })
      }

      const collBefore = (await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_COLL_INDEX] // all troves have same coll before
      const collBeforeERC20 = (await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX] // all troves have same coll before

      await priceFeed.setPrice(dec(105, 18))
      const liquidationTx = await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      const [, liquidatedColl, ,] = th.getEmittedLiquidationValues(liquidationTx)


      const liquidationTxERC20 = await troveManager.liquidate(erc20.address, defaulter_1)
      const [, liquidatedCollERC20, ,] = th.getEmittedLiquidationValues(liquidationTxERC20)


      /* All depositors attempt to withdraw their ETH gain to their Trove. Each depositor 
      receives (liquidatedColl/ 6).

      Thus, expected new collateral for each depositor with 1 Ether in their trove originally, is 
      (1 + liquidatedColl/6)
      */

      const expectedCollGain = liquidatedColl.div(toBN('6'))
      const expectedCollGainERC20 = liquidatedCollERC20.div(toBN('6'))

      await priceFeed.setPrice(dec(200, 18))

      await stabilityPool.withdrawAssetGainToTrove(alice, alice, { from: alice })
      const aliceCollAfter = (await troveManager.Troves(alice, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX]
      assert.isAtMost(th.getDifference(aliceCollAfter.sub(collBefore), expectedCollGain), 10000)

      await stabilityPoolERC20.withdrawAssetGainToTrove(alice, alice, { from: alice })
      const aliceCollAfterERC20 = (await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX]
      assert.isAtMost(th.getDifference(aliceCollAfterERC20.sub(collBeforeERC20), expectedCollGainERC20), 10000)

      await stabilityPool.withdrawAssetGainToTrove(bob, bob, { from: bob })
      const bobCollAfter = (await troveManager.Troves(bob, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX]
      assert.isAtMost(th.getDifference(bobCollAfter.sub(collBefore), expectedCollGain), 10000)

      await stabilityPoolERC20.withdrawAssetGainToTrove(bob, bob, { from: bob })
      const bobCollAfterERC20 = (await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
      assert.isAtMost(th.getDifference(bobCollAfterERC20.sub(collBeforeERC20), expectedCollGainERC20), 10000)

      await stabilityPool.withdrawAssetGainToTrove(carol, carol, { from: carol })
      const carolCollAfter = (await troveManager.Troves(carol, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX]
      assert.isAtMost(th.getDifference(carolCollAfter.sub(collBefore), expectedCollGain), 10000)

      await stabilityPoolERC20.withdrawAssetGainToTrove(carol, carol, { from: carol })
      const carolCollAfterERC20 = (await troveManager.Troves(carol, erc20.address,))[th.TROVE_COLL_INDEX]
      assert.isAtMost(th.getDifference(carolCollAfterERC20.sub(collBeforeERC20), expectedCollGainERC20), 10000)

      await stabilityPool.withdrawAssetGainToTrove(dennis, dennis, { from: dennis })
      const dennisCollAfter = (await troveManager.Troves(dennis, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX]
      assert.isAtMost(th.getDifference(dennisCollAfter.sub(collBefore), expectedCollGain), 10000)

      await stabilityPoolERC20.withdrawAssetGainToTrove(dennis, dennis, { from: dennis })
      const dennisCollAfterERC20 = (await troveManager.Troves(dennis, erc20.address))[th.TROVE_COLL_INDEX]
      assert.isAtMost(th.getDifference(dennisCollAfterERC20.sub(collBeforeERC20), expectedCollGainERC20), 10000)

      await stabilityPool.withdrawAssetGainToTrove(erin, erin, { from: erin })
      const erinCollAfter = (await troveManager.Troves(erin, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX]
      assert.isAtMost(th.getDifference(erinCollAfter.sub(collBefore), expectedCollGain), 10000)

      await stabilityPoolERC20.withdrawAssetGainToTrove(erin, erin, { from: erin })
      const erinCollAfterERC20 = (await troveManager.Troves(erin, erc20.address))[th.TROVE_COLL_INDEX]
      assert.isAtMost(th.getDifference(erinCollAfterERC20.sub(collBeforeERC20), expectedCollGainERC20), 10000)

      await stabilityPool.withdrawAssetGainToTrove(flyn, flyn, { from: flyn })
      const flynCollAfter = (await troveManager.Troves(flyn, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX]
      assert.isAtMost(th.getDifference(flynCollAfter.sub(collBefore), expectedCollGain), 10000)

      await stabilityPoolERC20.withdrawAssetGainToTrove(flyn, flyn, { from: flyn })
      const flynCollAfterERC20 = (await troveManager.Troves(flyn, erc20.address))[th.TROVE_COLL_INDEX]
      assert.isAtMost(th.getDifference(flynCollAfterERC20.sub(collBeforeERC20), expectedCollGainERC20), 10000)
    })

    it("withdrawETHGainToTrove(): caller can withdraw full deposit and ETH gain to their trove during Recovery Mode", async () => {
      // --- SETUP ---

      // Defaulter opens
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // A, B, C open troves 
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // A, B, C provides 10000, 5000, 3000 VST to SP
      await stabilityPool.provideToSP(dec(10000, 18), { from: alice })
      await stabilityPool.provideToSP(dec(5000, 18), { from: bob })
      await stabilityPool.provideToSP(dec(3000, 18), { from: carol })

      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: alice })
      await stabilityPoolERC20.provideToSP(dec(5000, 18), { from: bob })
      await stabilityPoolERC20.provideToSP(dec(3000, 18), { from: carol })

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      // Price drops to 105, 
      await priceFeed.setPrice(dec(105, 18))
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

      // Check defaulter 1 has ICR: 100% < ICR < 110%.
      assert.isTrue(await th.ICRbetween100and110(defaulter_1, troveManager, price))
      assert.isTrue(await th.ICRbetween100and110(defaulter_1, troveManager, price, erc20.address))

      const alice_Collateral_Before = (await troveManager.Troves(alice, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX]
      const bob_Collateral_Before = (await troveManager.Troves(bob, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX]
      const carol_Collateral_Before = (await troveManager.Troves(carol, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX]

      const alice_Collateral_BeforeERC20 = (await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX]
      const bob_Collateral_BeforeERC20 = (await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
      const carol_Collateral_BeforeERC20 = (await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX]

      // Liquidate defaulter 1
      assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))

      assert.isTrue(await sortedTroves.contains(erc20.address, defaulter_1))
      await troveManager.liquidate(erc20.address, defaulter_1)
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))

      const alice_ETHGain_Before = await stabilityPool.getDepositorAssetGain(alice)
      const bob_ETHGain_Before = await stabilityPool.getDepositorAssetGain(bob)
      const carol_ETHGain_Before = await stabilityPool.getDepositorAssetGain(carol)

      const alice_ETHGain_BeforeERC20 = await stabilityPoolERC20.getDepositorAssetGain(alice)
      const bob_ETHGain_BeforeERC20 = await stabilityPoolERC20.getDepositorAssetGain(bob)
      const carol_ETHGain_BeforeERC20 = await stabilityPoolERC20.getDepositorAssetGain(carol)

      // A, B, C withdraw their full ETH gain from the Stability Pool to their trove
      await stabilityPool.withdrawAssetGainToTrove(alice, alice, { from: alice })
      await stabilityPool.withdrawAssetGainToTrove(bob, bob, { from: bob })
      await stabilityPool.withdrawAssetGainToTrove(carol, carol, { from: carol })

      await stabilityPoolERC20.withdrawAssetGainToTrove(alice, alice, { from: alice })
      await stabilityPoolERC20.withdrawAssetGainToTrove(bob, bob, { from: bob })
      await stabilityPoolERC20.withdrawAssetGainToTrove(carol, carol, { from: carol })

      // Check collateral of troves A, B, C has increased by the value of their ETH gain from liquidations, respectively
      const alice_expectedCollateral = (alice_Collateral_Before.add(alice_ETHGain_Before)).toString()
      const bob_expectedColalteral = (bob_Collateral_Before.add(bob_ETHGain_Before)).toString()
      const carol_expectedCollateral = (carol_Collateral_Before.add(carol_ETHGain_Before)).toString()

      const alice_expectedCollateralERC20 = (alice_Collateral_BeforeERC20.div(toBN(10 ** 10)).add(alice_ETHGain_BeforeERC20)).toString()
      const bob_expectedColalteralERC20 = (bob_Collateral_BeforeERC20.div(toBN(10 ** 10)).add(bob_ETHGain_BeforeERC20)).toString()
      const carol_expectedCollateralERC20 = (carol_Collateral_BeforeERC20.div(toBN(10 ** 10)).add(carol_ETHGain_BeforeERC20)).toString()

      const alice_Collateral_After = (await troveManager.Troves(alice, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX]
      const bob_Collateral_After = (await troveManager.Troves(bob, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX]
      const carol_Collateral_After = (await troveManager.Troves(carol, ZERO_ADDRESS,))[th.TROVE_COLL_INDEX]

      const alice_Collateral_AfterERC20 = (await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX]
      const bob_Collateral_AfterERC20 = (await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
      const carol_Collateral_AfterERC20 = (await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX]

      assert.equal(alice_expectedCollateral, alice_Collateral_After)
      assert.equal(bob_expectedColalteral, bob_Collateral_After)
      assert.equal(carol_expectedCollateral, carol_Collateral_After)

      assert.equal(alice_expectedCollateralERC20, alice_Collateral_AfterERC20.div(toBN(10 ** 10)))
      assert.equal(bob_expectedColalteralERC20, bob_Collateral_AfterERC20.div(toBN(10 ** 10)))
      assert.equal(carol_expectedCollateralERC20, carol_Collateral_AfterERC20.div(toBN(10 ** 10)))

      // Check ETH in SP has reduced to zero
      const ETHinSP_After = (await stabilityPool.getAssetBalance()).toString()
      assert.isAtMost(th.getDifference(ETHinSP_After, '0'), 100000)

      const ETHinSP_AfterERC20 = (await stabilityPoolERC20.getAssetBalance()).toString()
      assert.isAtMost(th.getDifference(ETHinSP_AfterERC20, '0'), 100000)
    })

    it("withdrawETHGainToTrove(): reverts if user has no trove", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C open troves 
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // Defaulter opens
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // A transfers VST to D
      await vstToken.transfer(dennis, dec(20000, 18), { from: alice })

      // D deposits to Stability Pool
      await stabilityPool.provideToSP(dec(10000, 18), { from: dennis })
      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: dennis })

      //Price drops
      await priceFeed.setPrice(dec(105, 18))

      //Liquidate defaulter 1
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))

      await troveManager.liquidate(erc20.address, defaulter_1)
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))

      await priceFeed.setPrice(dec(200, 18))

      // D attempts to withdraw his ETH gain to Trove
      await th.assertRevert(stabilityPool.withdrawAssetGainToTrove(dennis, dennis, { from: dennis }), "caller must have an active trove to withdraw AssetGain to")
      await th.assertRevert(stabilityPoolERC20.withdrawAssetGainToTrove(dennis, dennis, { from: dennis }), "caller must have an active trove to withdraw AssetGain to")
    })

    it("withdrawETHGainToTrove(): triggers VSTA reward event - increases the sum G", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C open troves 
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // A and B provide to SP
      await stabilityPool.provideToSP(dec(10000, 18), { from: A })
      await stabilityPool.provideToSP(dec(10000, 18), { from: B })

      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: B })

      // Defaulter opens a trove, price drops, defaulter gets liquidated
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await priceFeed.setPrice(dec(105, 18))
      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))

      const G_Before = await stabilityPool.epochToScaleToG(0, 0)
      const G_BeforeERC20 = await stabilityPoolERC20.epochToScaleToG(0, 0)

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      await priceFeed.setPrice(dec(200, 18))

      // A withdraws from SP
      await stabilityPool.withdrawFromSP(dec(50, 18), { from: A })
      await stabilityPoolERC20.withdrawFromSP(dec(50, 18), { from: A })

      const G_1 = await stabilityPool.epochToScaleToG(0, 0)
      const G_1ERC20 = await stabilityPoolERC20.epochToScaleToG(0, 0)

      // Expect G has increased from the VSTA reward event triggered
      assert.isTrue(G_1.gt(G_Before))
      assert.isTrue(G_1ERC20.gt(G_BeforeERC20))

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // Check B has non-zero ETH gain
      assert.isTrue((await stabilityPool.getDepositorAssetGain(B)).gt(ZERO))
      assert.isTrue((await stabilityPoolERC20.getDepositorAssetGain(B)).gt(ZERO))

      // B withdraws to trove
      await stabilityPool.withdrawAssetGainToTrove(B, B, { from: B })
      await stabilityPoolERC20.withdrawAssetGainToTrove(B, B, { from: B })

      const G_2 = await stabilityPool.epochToScaleToG(0, 0)
      const G_2ERC20 = await stabilityPoolERC20.epochToScaleToG(0, 0)

      // Expect G has increased from the VSTA reward event triggered
      assert.isTrue(G_2.gt(G_1))
      assert.isTrue(G_2ERC20.gt(G_1ERC20))
    })

    it("withdrawETHGainToTrove(), partial withdrawal: doesn't change the front end tag", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C open troves 
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // A, B, C, D, E provide to SP
      await stabilityPool.provideToSP(dec(10000, 18), { from: A })
      await stabilityPool.provideToSP(dec(20000, 18), { from: B })
      await stabilityPool.provideToSP(dec(30000, 18), { from: C })

      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(20000, 18), { from: B })
      await stabilityPoolERC20.provideToSP(dec(30000, 18), { from: C })

      // Defaulter opens a trove, price drops, defaulter gets liquidated
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      await priceFeed.setPrice(dec(105, 18))

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)

      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // Check A, B, C have non-zero ETH gain
      assert.isTrue((await stabilityPool.getDepositorAssetGain(A)).gt(ZERO))
      assert.isTrue((await stabilityPool.getDepositorAssetGain(B)).gt(ZERO))
      assert.isTrue((await stabilityPool.getDepositorAssetGain(C)).gt(ZERO))

      assert.isTrue((await stabilityPoolERC20.getDepositorAssetGain(A)).gt(ZERO))
      assert.isTrue((await stabilityPoolERC20.getDepositorAssetGain(B)).gt(ZERO))
      assert.isTrue((await stabilityPoolERC20.getDepositorAssetGain(C)).gt(ZERO))

      await priceFeed.setPrice(dec(200, 18))

      // A, B, C withdraw to trove
      await stabilityPool.withdrawAssetGainToTrove(A, A, { from: A })
      await stabilityPool.withdrawAssetGainToTrove(B, B, { from: B })
      await stabilityPool.withdrawAssetGainToTrove(C, C, { from: C })

      await stabilityPoolERC20.withdrawAssetGainToTrove(A, A, { from: A })
      await stabilityPoolERC20.withdrawAssetGainToTrove(B, B, { from: B })
      await stabilityPoolERC20.withdrawAssetGainToTrove(C, C, { from: C })
    })

    it("withdrawETHGainToTrove(), eligible deposit: depositor receives VSTA rewards", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C open troves 
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // A, B, C, provide to SP
      await stabilityPool.provideToSP(dec(1000, 18), { from: A })
      await stabilityPool.provideToSP(dec(2000, 18), { from: B })
      await stabilityPool.provideToSP(dec(3000, 18), { from: C })

      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(2000, 18), { from: B })
      await stabilityPoolERC20.provideToSP(dec(3000, 18), { from: C })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // Defaulter opens a trove, price drops, defaulter gets liquidated
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await priceFeed.setPrice(dec(105, 18))

      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)

      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))

      // Get A, B, C VSTA balance before
      const A_VSTABalance_Before = await vstaToken.balanceOf(A)
      const B_VSTABalance_Before = await vstaToken.balanceOf(B)
      const C_VSTABalance_Before = await vstaToken.balanceOf(C)

      // Check A, B, C have non-zero ETH gain
      assert.isTrue((await stabilityPool.getDepositorAssetGain(A)).gt(ZERO))
      assert.isTrue((await stabilityPool.getDepositorAssetGain(B)).gt(ZERO))
      assert.isTrue((await stabilityPool.getDepositorAssetGain(C)).gt(ZERO))

      assert.isTrue((await stabilityPoolERC20.getDepositorAssetGain(A)).gt(ZERO))
      assert.isTrue((await stabilityPoolERC20.getDepositorAssetGain(B)).gt(ZERO))
      assert.isTrue((await stabilityPoolERC20.getDepositorAssetGain(C)).gt(ZERO))

      await priceFeed.setPrice(dec(200, 18))

      // A, B, C withdraw to trove
      await stabilityPool.withdrawAssetGainToTrove(A, A, { from: A })
      await stabilityPool.withdrawAssetGainToTrove(B, B, { from: B })
      await stabilityPool.withdrawAssetGainToTrove(C, C, { from: C })

      // Get VSTA balance after
      const A_VSTABalance_After = await vstaToken.balanceOf(A)
      const B_VSTABalance_After = await vstaToken.balanceOf(B)
      const C_VSTABalance_After = await vstaToken.balanceOf(C)

      // Check VSTA Balance of A, B, C has increased
      assert.isTrue(A_VSTABalance_After.gt(A_VSTABalance_Before))
      assert.isTrue(B_VSTABalance_After.gt(B_VSTABalance_Before))
      assert.isTrue(C_VSTABalance_After.gt(C_VSTABalance_Before))


      await stabilityPoolERC20.withdrawAssetGainToTrove(A, A, { from: A })
      await stabilityPoolERC20.withdrawAssetGainToTrove(B, B, { from: B })
      await stabilityPoolERC20.withdrawAssetGainToTrove(C, C, { from: C })

      // Get VSTA balance after
      const A_VSTABalance_AfterERC20 = await vstaToken.balanceOf(A)
      const B_VSTABalance_AfterERC20 = await vstaToken.balanceOf(B)
      const C_VSTABalance_AfterERC20 = await vstaToken.balanceOf(C)

      // Check VSTA Balance of A, B, C has increased
      assert.isTrue(A_VSTABalance_AfterERC20.gt(A_VSTABalance_After))
      assert.isTrue(B_VSTABalance_AfterERC20.gt(B_VSTABalance_After))
      assert.isTrue(C_VSTABalance_AfterERC20.gt(C_VSTABalance_After))


    })

    it("withdrawETHGainToTrove(), eligible deposit: System's stake decreases", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C, D, E, F open troves 
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })


      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // A, B, C, D, E, F provide to SP
      await stabilityPool.provideToSP(dec(1000, 18), { from: A })
      await stabilityPool.provideToSP(dec(2000, 18), { from: B })
      await stabilityPool.provideToSP(dec(3000, 18), { from: C })

      await stabilityPoolERC20.provideToSP(dec(1000, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(2000, 18), { from: B })
      await stabilityPoolERC20.provideToSP(dec(3000, 18), { from: C })

      // Defaulter opens a trove, price drops, defaulter gets liquidated
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await priceFeed.setPrice(dec(105, 18))
      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))
      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)
      assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, defaulter_1))
      assert.isFalse(await sortedTroves.contains(erc20.address, defaulter_1))

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // Get front ends' stake before
      const Stake_Before = await stabilityPool.totalStakes()
      const Stake_BeforeERC20 = await stabilityPoolERC20.totalStakes()

      await priceFeed.setPrice(dec(200, 18))

      // Check A, B, C have non-zero ETH gain
      assert.isTrue((await stabilityPool.getDepositorAssetGain(A)).gt(ZERO))
      assert.isTrue((await stabilityPool.getDepositorAssetGain(B)).gt(ZERO))
      assert.isTrue((await stabilityPool.getDepositorAssetGain(C)).gt(ZERO))

      assert.isTrue((await stabilityPoolERC20.getDepositorAssetGain(A)).gt(ZERO))
      assert.isTrue((await stabilityPoolERC20.getDepositorAssetGain(B)).gt(ZERO))
      assert.isTrue((await stabilityPoolERC20.getDepositorAssetGain(C)).gt(ZERO))

      // A, B, C withdraw to trove
      await stabilityPool.withdrawAssetGainToTrove(A, A, { from: A })
      await stabilityPool.withdrawAssetGainToTrove(B, B, { from: B })
      await stabilityPool.withdrawAssetGainToTrove(C, C, { from: C })

      await stabilityPoolERC20.withdrawAssetGainToTrove(A, A, { from: A })
      await stabilityPoolERC20.withdrawAssetGainToTrove(B, B, { from: B })
      await stabilityPoolERC20.withdrawAssetGainToTrove(C, C, { from: C })

      // Get front ends' stakes after
      const Stake_After = await stabilityPool.totalStakes()
      const Stake_AfterERC20 = await stabilityPoolERC20.totalStakes()

      // Check front ends' stakes have decreased
      assert.isTrue(Stake_After.lt(Stake_Before))
      assert.isTrue(Stake_AfterERC20.lt(Stake_BeforeERC20))
    })

    it("withdrawETHGainToTrove(), eligible deposit: System's snapshots update", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C, open troves 
      await openTrove({ extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraVSTAmount: toBN(dec(60000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(60000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // D opens trove
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

      // --- SETUP ---

      const deposit_A = dec(100, 18)
      const deposit_B = dec(200, 18)
      const deposit_C = dec(300, 18)

      // A, B, C make their initial deposits
      await stabilityPool.provideToSP(deposit_A, { from: A })
      await stabilityPool.provideToSP(deposit_B, { from: B })
      await stabilityPool.provideToSP(deposit_C, { from: C })

      await stabilityPoolERC20.provideToSP(deposit_A, { from: A })
      await stabilityPoolERC20.provideToSP(deposit_B, { from: B })
      await stabilityPoolERC20.provideToSP(deposit_C, { from: C })

      console.log()

      // fastforward time then make an SP deposit, to make G > 0
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      await stabilityPool.provideToSP(dec(10000, 18), { from: D })
      await stabilityPoolERC20.provideToSP(dec(10000, 18), { from: D })

      // perform a liquidation to make 0 < P < 1, and S > 0
      await priceFeed.setPrice(dec(105, 18))
      assert.isFalse(await th.checkRecoveryMode(contracts))
      assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

      await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
      await troveManager.liquidate(erc20.address, defaulter_1)

      const currentEpoch = await stabilityPool.currentEpoch()
      const currentScale = await stabilityPool.currentScale()

      const S_Before = await stabilityPool.epochToScaleToSum(currentEpoch, currentScale)
      const P_Before = await stabilityPool.P()
      const G_Before = await stabilityPool.epochToScaleToG(currentEpoch, currentScale)


      const currentEpochERC20 = await stabilityPoolERC20.currentEpoch()
      const currentScaleERC20 = await stabilityPoolERC20.currentScale()

      const S_BeforeERC20 = await stabilityPoolERC20.epochToScaleToSum(currentEpochERC20, currentScaleERC20)
      const P_BeforeERC20 = await stabilityPoolERC20.P()
      const G_BeforeERC20 = await stabilityPoolERC20.epochToScaleToG(currentEpochERC20, currentScaleERC20)

      // Confirm 0 < P < 1
      assert.isTrue(P_Before.gt(toBN('0')) && P_Before.lt(toBN(dec(1, 18))))
      assert.isTrue(P_BeforeERC20.gt(toBN('0')) && P_BeforeERC20.lt(toBN(dec(1, 18))))
      // Confirm S, G are both > 0
      assert.isTrue(S_Before.gt(toBN('0')))
      assert.isTrue(G_Before.gt(toBN('0')))
      assert.isTrue(S_BeforeERC20.gt(toBN('0')))
      assert.isTrue(G_BeforeERC20.gt(toBN('0')))

      // --- TEST ---

      // Check A, B, C have non-zero ETH gain
      assert.isTrue((await stabilityPool.getDepositorAssetGain(A)).gt(ZERO))
      assert.isTrue((await stabilityPool.getDepositorAssetGain(B)).gt(ZERO))
      assert.isTrue((await stabilityPool.getDepositorAssetGain(C)).gt(ZERO))

      assert.isTrue((await stabilityPoolERC20.getDepositorAssetGain(A)).gt(ZERO))
      assert.isTrue((await stabilityPoolERC20.getDepositorAssetGain(B)).gt(ZERO))
      assert.isTrue((await stabilityPoolERC20.getDepositorAssetGain(C)).gt(ZERO))

      await priceFeed.setPrice(dec(200, 18))

      // A, B, C withdraw ETH gain to troves. Grab G at each stage, as it can increase a bit
      // between topups, because some block.timestamp time passes (and VSTA is issued) between ops
      const G1 = await stabilityPool.epochToScaleToG(currentScale, currentEpoch)
      await stabilityPool.withdrawAssetGainToTrove(A, A, { from: A })

      const G1ERC20 = await stabilityPoolERC20.epochToScaleToG(currentScaleERC20, currentEpochERC20)
      await stabilityPoolERC20.withdrawAssetGainToTrove(A, A, { from: A })


      const snapshot = await stabilityPool.systemSnapshots()
      assert.equal(snapshot[0], '0')  // S (should always be 0 for front ends)
      assert.isTrue(snapshot[1].eq(P_Before))  // P
      assert.isTrue(snapshot[2].eq(G1))  // G
      assert.equal(snapshot[3], '0')  // scale
      assert.equal(snapshot[4], '0')  // epoch

      const snapshotERC20 = await stabilityPoolERC20.systemSnapshots()
      assert.equal(snapshotERC20[0], '0')  // S (should always be 0 for front ends)
      assert.isTrue(snapshotERC20[1].eq(P_BeforeERC20))  // P
      assert.isTrue(snapshotERC20[2].eq(G1ERC20))  // G
      assert.equal(snapshotERC20[3], '0')  // scale
      assert.equal(snapshotERC20[4], '0')  // epoch
    })

    it("withdrawETHGainToTrove(): reverts when depositor has no ETH gain", async () => {
      await openTrove({ extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(100000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // Whale transfers VST to A, B
      await vstToken.transfer(A, dec(20000, 18), { from: whale })
      await vstToken.transfer(B, dec(40000, 18), { from: whale })

      // C, D open troves 
      await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraVSTAmount: toBN(dec(4000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(4000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // A, B, C, D provide to SP
      await stabilityPool.provideToSP(dec(10, 18), { from: A })
      await stabilityPool.provideToSP(dec(20, 18), { from: B })
      await stabilityPool.provideToSP(dec(30, 18), { from: C })
      await stabilityPool.provideToSP(dec(40, 18), { from: D })

      await stabilityPoolERC20.provideToSP(dec(10, 18), { from: A })
      await stabilityPoolERC20.provideToSP(dec(20, 18), { from: B })
      await stabilityPoolERC20.provideToSP(dec(30, 18), { from: C })
      await stabilityPoolERC20.provideToSP(dec(40, 18), { from: D })

      // fastforward time, and E makes a deposit, creating VSTA rewards for all
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
      await openTrove({ extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      await stabilityPool.provideToSP(dec(3000, 18), { from: E })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      await stabilityPoolERC20.provideToSP(dec(3000, 18), { from: E })

      // Confirm A, B, C have zero ETH gain
      assert.equal(await stabilityPool.getDepositorAssetGain(A), '0')
      assert.equal(await stabilityPool.getDepositorAssetGain(B), '0')
      assert.equal(await stabilityPool.getDepositorAssetGain(C), '0')

      assert.equal(await stabilityPoolERC20.getDepositorAssetGain(A), '0')
      assert.equal(await stabilityPoolERC20.getDepositorAssetGain(B), '0')
      assert.equal(await stabilityPoolERC20.getDepositorAssetGain(C), '0')

      // Check withdrawETHGainToTrove reverts for A, B, C
      const txPromise_A = stabilityPool.withdrawAssetGainToTrove(A, A, { from: A })
      const txPromise_B = stabilityPool.withdrawAssetGainToTrove(B, B, { from: B })
      const txPromise_C = stabilityPool.withdrawAssetGainToTrove(C, C, { from: C })
      const txPromise_D = stabilityPool.withdrawAssetGainToTrove(D, D, { from: D })

      const txPromise_AERC20 = stabilityPoolERC20.withdrawAssetGainToTrove(A, A, { from: A })
      const txPromise_BERC20 = stabilityPoolERC20.withdrawAssetGainToTrove(B, B, { from: B })
      const txPromise_CERC20 = stabilityPoolERC20.withdrawAssetGainToTrove(C, C, { from: C })
      const txPromise_DERC20 = stabilityPoolERC20.withdrawAssetGainToTrove(D, D, { from: D })

      await th.assertRevert(txPromise_A)
      await th.assertRevert(txPromise_B)
      await th.assertRevert(txPromise_C)
      await th.assertRevert(txPromise_D)

      await th.assertRevert(txPromise_AERC20)
      await th.assertRevert(txPromise_BERC20)
      await th.assertRevert(txPromise_CERC20)
      await th.assertRevert(txPromise_DERC20)
    })
  })
})

contract('Reset chain state', async accounts => { })
