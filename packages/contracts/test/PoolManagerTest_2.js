const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const getDifference = testHelpers.getDifference
const moneyVals = testHelpers.MoneyValues

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
      await borrowerOperations.addColl(alice, alice, { from: alice, value:moneyVals._1_Ether })
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
      await borrowerOperations.addColl(alice, alice, { from: alice, value:moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV(200, alice, { from: alice })

      // --- TEST ---
      // check user's deposit record before
      const alice_depositRecord_Before = await poolManager.deposits(alice)
      assert.equal(alice_depositRecord_Before, 0)

      // provideToSP()
      await poolManager.provideToSP(200, { from: alice })

      // check user's deposit record after
      const alice_depositRecord_After = await poolManager.deposits(alice)
      assert.equal(alice_depositRecord_After, 200)
    })

    it("provideToSP(): reduces the user's CLV balance by the correct amount", async () => {
      // --- SETUP --- Give Alice 200 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value:moneyVals._1_Ether })
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
      await borrowerOperations.addColl(whale, whale, { from: whale, value:moneyVals._50_Ether })
      await borrowerOperations.withdrawCLV('2000000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('2000000000000000000000', { from: whale })

      const totalCLVDeposits = await stabilityPool.getTotalCLVDeposits()
      assert.equal(totalCLVDeposits, '2000000000000000000000')
    })

    it('provideToSP(): Correctly updates user snapshots of accumulated rewards per unit staked', async () => {
      // --- SETUP ---

      // Whale opens CDP with 50 ETH, adds 2000 CLV to StabilityPool
      await borrowerOperations.addColl(whale, whale, { from: whale, value:moneyVals._50_Ether })
      await borrowerOperations.withdrawCLV('2000000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('2000000000000000000000', { from: whale })
      // 2 CDPs opened, each withdraws 180 CLV
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value:moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value:moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_2, { from: defaulter_2 })

      // Alice makes CDP and withdraws 100 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value:moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV(100, alice, { from: alice })

      // price drops: defaulter's CDPs fall below MCR, whale doesn't
      await priceFeed.setPrice('100000000000000000000');

      // CDPs are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // --- TEST ---
      const P = (await poolManager.P())  // expected: 0.18 CLV
      const S = (await poolManager.epochToScaleToSum(0,0))  // expected: 0.001 Ether
  

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
      await borrowerOperations.addColl(whale, whale, { from: whale, value:moneyVals._100_Ether })
      await borrowerOperations.withdrawCLV('1850000000000000000000', alice, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 3 CDPs opened. Two users withdraw 180 CLV each
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value:moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value:moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value:moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_3, { from: defaulter_3 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value:moneyVals._10_Ether })
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

      const alice_newDeposit_1 = (await poolManager.deposits(alice)).toString()
      console.log(typeof alice_compoundedDeposit_1)
      assert.equal(alice_compoundedDeposit_1.add(alice_topUp_1), alice_newDeposit_1)

      // get system reward terms
      const P_1 = (await poolManager.P()).toString()
      const S_1 = (await poolManager.epochToScaleToSum(0,0)).toString()
      console.log(`S1: ${S_1}`)
      // check Alice's new snapshot is correct
      const alice_Snapshot_1 = await poolManager.snapshot(alice)
      const alice_Snapshot_S_1 = alice_Snapshot_1[0].toString()
      const alice_Snapshot_P_1 = alice_Snapshot_1[1].toString()
      assert.equal(alice_Snapshot_S_1, S_1)
      assert.equal(alice_Snapshot_P_1, P_1)

      // Bob withdraws CLV and deposits to StabilityPool, bringing total deposits to: (1850 + 223 + 427) = 2500 CLV
      await borrowerOperations.addColl(bob, bob, { from: bob, value:moneyVals._50_Ether })
      await borrowerOperations.withdrawCLV('427000000000000000000', bob, { from: bob })
      await poolManager.provideToSP('427000000000000000000', { from: bob })

      // Defaulter 3 CDP is closed
      await cdpManager.liquidate(defaulter_3, { from: owner })

      const alice_compoundedDeposit_2 = await poolManager.getCompoundedCLVDeposit(alice)

      const P_2 = (await poolManager.P()).toString()
      const S_2 = (await poolManager.epochToScaleToSum(0,0)).toString()

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

    it("withdrawFromSP(): partial retrieval - retrieves correct CLV amount and the entire ETH Gain, and updates deposit", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
      await borrowerOperations.addColl(whale, whale, { from: whale, value:moneyVals._50_Ether })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 2 CDPs opened, 180 CLV withdrawn
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value:moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value:moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_2, { from: defaulter_2 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value:moneyVals._10_Ether })
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
      const newDeposit = (await poolManager.deposits(alice)).toString()
      assert.isAtMost(getDifference(newDeposit, '33000000000000000000'), 1000)

      // Expect Alice has withdrawn all ETH gain
      const alice_pendingETHGain = await poolManager.getCurrentETHGain(alice)
      assert.equal(alice_pendingETHGain, 0)
    })

    it("withdrawFromSP(): it correctly updates the user's CLV and ETH snapshots of entitled reward per unit staked", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
      await borrowerOperations.addColl(whale, whale, { from: whale, value:moneyVals._50_Ether })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 2 CDPs opened, 180 CLV withdrawn
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value:moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value:moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_2, { from: defaulter_2 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value:moneyVals._10_Ether })
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
      const S = (await poolManager.epochToScaleToSum(0,0)).toString()
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

      await borrowerOperations.addColl(whale, whale, { from: whale, value:moneyVals._50_Ether })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value:moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value:moneyVals._10_Ether })
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
      assert.isAtMost(getDifference(stability_ETH_Difference, '-75000000000000000'), 100)
    })

    // --- Tests that check any rounding error in accumulated CLVLoss in the SP "favors the Pool" ---

    it("withdrawFromSP(): All depositors are able to withdraw from the SP to their account", async () => {
      // Whale opens loan 
      await borrowerOperations.addColl(accounts[999], accounts[999], { from: whale, value: moneyVals._100_Ether })
      
      // Future defaulter opens loan
      await borrowerOperations.openLoan(moneyVals._100e18, accounts[0],{from: defaulter_1, value: moneyVals._1_Ether})
 
      // 6 Accounts open loans and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, {from: account, value: moneyVals._1_Ether})
        await poolManager.provideToSP(moneyVals._100e18, {from: account} )
      }

      await priceFeed.setPrice(moneyVals._100e18)
      await cdpManager.liquidate(defaulter_1)

      // All depositors attempt to withdraw
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      assert.equal((await poolManager.deposits(alice)).toString(), '0')
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      assert.equal((await poolManager.deposits(alice)).toString(), '0')
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol })
      assert.equal((await poolManager.deposits(alice)).toString(), '0')
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: dennis })
      assert.equal((await poolManager.deposits(alice)).toString(), '0')
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: erin })
      assert.equal((await poolManager.deposits(alice)).toString(), '0')
      await poolManager.withdrawFromSP(moneyVals._100e18, { from: flyn })
      assert.equal((await poolManager.deposits(alice)).toString(), '0')

      const totalDeposits = (await stabilityPool.totalCLVDeposits()).toString()

      assert.isAtMost(getDifference(totalDeposits, '0'), 1000)
    })

    it("withdrawFromSP(): Each depositor withdraws a correct compounded deposit", async () => {
      // Whale opens loan 
      await borrowerOperations.addColl(accounts[999], accounts[999], { from: whale, value: moneyVals._100_Ether })
      
      // Future defaulter opens loan
      await borrowerOperations.openLoan(moneyVals._100e18, accounts[0],{from: defaulter_1, value: moneyVals._1_Ether})
 
      // 6 Accounts open loans and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, {from: account, value: moneyVals._1_Ether})
        await poolManager.provideToSP(moneyVals._100e18, {from: account} )
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

      assert.isAtMost(getDifference(totalDeposits, '0'), 1000)
    })


    // --- withdrawFromSPtoCDP ---


    it("withdrawFromSPtoCDP(): Applies CLVLoss to user's deposit, and redirects ETH reward to user's CDP", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      await borrowerOperations.addColl(whale, whale, { from: whale, value:moneyVals._50_Ether })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value:moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value:moneyVals._10_Ether })
      await borrowerOperations.withdrawCLV('150000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('150000000000000000000', { from: alice })

      // check alice's CDP recorded ETH Before:
      const aliceCDP_Before = await cdpManager.CDPs(alice)
      const aliceCDP_ETH_Before = aliceCDP_Before[1]
      assert.equal(aliceCDP_ETH_Before, moneyVals._10_Ether)

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
      alice_deposit_afterDefault = (await poolManager.deposits(alice))
      assert.isAtMost(getDifference(alice_deposit_afterDefault, '136500000000000000000'), 1000)

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

      await borrowerOperations.addColl(whale, whale, { from: whale, value:moneyVals._50_Ether })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value:moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('180000000000000000000', defaulter_1, { from: defaulter_1 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.addColl(alice, alice, { from: alice, value:moneyVals._10_Ether })
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
      assert.isAtMost(getDifference(active_ETH_Difference, '75000000000000000'), 100)
      assert.isAtMost(getDifference(stability_ETH_Difference, '-75000000000000000'), 100)
    })

    it("withdrawFromSPtoCDP(): All depositors are able to withdraw their ETH gain from the SP to their CDP", async () => {
      // Whale opens loan 
      await borrowerOperations.addColl(accounts[999], accounts[999], { from: whale, value: moneyVals._100_Ether })
      
      // Future defaulter opens loan
      await borrowerOperations.openLoan(moneyVals._100e18, accounts[0],{from: defaulter_1, value: moneyVals._1_Ether})
 
      // 6 Accounts open loans and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, {from: account, value: moneyVals._1_Ether})
        await poolManager.provideToSP(moneyVals._100e18, {from: account} )
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
      await borrowerOperations.addColl(accounts[999], accounts[999], { from: whale, value: moneyVals._100_Ether })
      
      // Future defaulter opens loan
      await borrowerOperations.openLoan(moneyVals._100e18, accounts[0],{from: defaulter_1, value: moneyVals._1_Ether})
 
      // 6 Accounts open loans and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await borrowerOperations.openLoan(moneyVals._100e18, account, {from: account, value: moneyVals._1_Ether})
        await poolManager.provideToSP(moneyVals._100e18, {from: account} )
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
      await borrowerOperations.addColl(whale, whale, { from: whale, value:moneyVals._100_Ether })
      await borrowerOperations.withdrawCLV('2000000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('2000000000000000000000', { from: whale })
      // 2 CDPs opened, each withdraws 100 CLV
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value:moneyVals._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value:moneyVals._1_Ether })
      await borrowerOperations.withdrawCLV('100000000000000000000', defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV('100000000000000000000', defaulter_2, { from: defaulter_2 })

      const P_Before = await poolManager.P()
      const S_Before = await poolManager.epochToScaleToSum(0,0)
      const totalCLVDeposits = await stabilityPool.getTotalCLVDeposits()

      assert.equal(P_Before, '1000000000000000000')
      assert.equal(S_Before, 0)
      assert.equal(totalCLVDeposits, '2000000000000000000000')

      // price drops: defaulter's CDPs fall below MCR, whale doesn't
      await priceFeed.setPrice('100000000000000000000');
      // CDPs are closed
      const txL1 = await cdpManager.liquidate(defaulter_1, { from: owner });

      console.log("P after L1:" + (await poolManager.P()))  
      console.log("S after L1:" + (await poolManager.epochToScaleToSum(0,0)))  

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
      const S_After = (await poolManager.epochToScaleToSum(0,0))  

      console.log("P after L2:" + P_After.toString())  
      console.log("S after L2:" + S_After.toString()) 

      console.log("total SP deposits after L2: " + (await stabilityPool.getTotalCLVDeposits()).toString())
      // console.log(`${P_After}`)
      // console.log(`${S_After}`)

      assert.isAtMost(getDifference(P_After, '900000000000000000'), 1000)
    })

    // --- SP overstay scenario tests ---

    // it('After an unremoved overstay, a previous depositor can withdraw their deposit', async () => {
    //   // --- SETUP ---
    //   // Whale withdraws 1500 CLV and provides to StabilityPool
    //   await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
    //   await borrowerOperations.addColl(whale, whale, { from: whale, value: _100_Ether })
    //   await borrowerOperations.withdrawCLV('1500000000000000000000', whale, { from: whale })
    //   await poolManager.provideToSP('1500000000000000000000', { from: whale })

    //   // 3 CDPs opened, each withdraws 1500 CLV
    //   await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value:moneyVals._10_Ether })
    //   await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value:moneyVals._10_Ether })
    //   await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value:moneyVals._10_Ether })
    //   await borrowerOperations.withdrawCLV('1500000000000000000000', defaulter_1, { from: defaulter_1 })
    //   await borrowerOperations.withdrawCLV('1500000000000000000000', defaulter_2, { from: defaulter_2 })
    //   await borrowerOperations.withdrawCLV('1500000000000000000000', defaulter_3, { from: defaulter_3 })

    //   // --- TEST --- 

    //   // Alice makes deposit #1: 500 CLV
    //   await borrowerOperations.addColl(alice, alice, { from: alice, value:moneyVals._10_Ether })
    //   await borrowerOperations.withdrawCLV('500000000000000000000', alice, { from: alice })
    //   await poolManager.provideToSP('500000000000000000000', { from: alice })

    //   // price drops: defaulters fall below MCR
    //   await priceFeed.setPrice('100000000000000000000');

    //   // defaulter 1 gets closed, absorbed partly by alice's and whale's deposit (500 and 1500 respectively)
    //   await cdpManager.liquidate(defaulter_1, { from: owner });

    //   // whale 2 provides 2000 CLV to StabilityPool
    //   await borrowerOperations.addColl(whale_2, whale_2, { from: whale_2, value: _100_Ether })
    //   await borrowerOperations.withdrawCLV('2000000000000000000000', whale_2, { from: whale_2 })
    //   await poolManager.provideToSP('2000000000000000000000', { from: whale_2 })

    //   // defaulter 2 (1500CLV) gets closed, absorbed by whale 2
    //   await cdpManager.liquidate(defaulter_2, { from: owner });

    //   await poolManager.withdrawFromSP('2000000000000000000000', { from: whale })

    //   // Whale 2 should be able to withdraw
    //   const tx = await poolManager.withdrawFromSP('2000000000000000000000', { from: whale_2 })
    //   assert.isTrue(tx.receipt.status)

    //   const whaleDeposit = (await poolManager.deposit(whale)).toString()
    //   assert.equal(whaleDeposit, 0)

    // })

    // it('After an unremoved overstay, the raw CLV in the Pool updates correctly upon withdrawal', async () => {
    //   // whale supports TCR
    //   await borrowerOperations.addColl(whale, whale, { from: whale, value: _100_Ether })

    //   // alice deposits 100 CLV to the SP
    //   await borrowerOperations.addColl(alice, alice, { from: alice, value:moneyVals._10_Ether })
    //   await borrowerOperations.withdrawCLV(moneyVals._100e18, alice, { from: alice })
    //   await poolManager.provideToSP(moneyVals._100e18, { from: alice })

    //   await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value:moneyVals._1_Ether })
    //   await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value:moneyVals._1_Ether })
    //   await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
    //   await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

    //   // Price drops
    //   await priceFeed.setPrice(moneyVals._100e18);

    //   // defaulter_1 liquidated. 100 CLV Empties pool. Alice CLVLoss = 100.
    //   await cdpManager.liquidate(defaulter_1, { from: owner })

    //   const SP_CLV_afterFirstLiquidation = await stabilityPool.getCLV()
    //   assert.equal(SP_CLV_afterFirstLiquidation, 0)

    //   // Bob opens loan, withdraws 100 CLV and deposits to Stability Pool
    //   await borrowerOperations.addColl(bob, bob, { from: bob, value:moneyVals._10_Ether })
    //   await borrowerOperations.withdrawCLV(moneyVals._100e18, bob, { from: bob })
    //   await poolManager.provideToSP(moneyVals._100e18, { from: bob })
      
    //   // Bob *should* receive a CLVLoss of 100 
    //   await cdpManager.liquidate(defaulter_2, { from: owner })
    
    //   const SP_CLV_afterSecondLiquidation = await stabilityPool.getCLV()
    //   assert.equal(SP_CLV_afterSecondLiquidation, 0)

    //   await borrowerOperations.addColl(carol, carol, { from: carol, value:moneyVals._10_Ether })
     
    //   await borrowerOperations.withdrawCLV(moneyVals._50e18, carol, { from: carol })
    //   await poolManager.provideToSP(moneyVals._50e18, { from: carol })
     
    //   /* Bob should have a CLVLoss of 100, and thus with his deposit of 100, his withdrawal should not affect the raw 
    //    CLV in the pool */
    //   await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })

    //   const SP_CLV_afterBobWithdraws = await stabilityPool.getCLV()
    //   assert.equal(SP_CLV_afterBobWithdraws, moneyVals._50e18)

    //   await poolManager.withdrawFromSP(moneyVals._50e18, { from: carol })
    //   const SP_CLV_afterCarolWithdraws = await stabilityPool.getCLV()
    //   assert.equal(SP_CLV_afterCarolWithdraws, 0) 
    // })

    // it('After an unremoved overstay, new depositors have the correct CLV Loss upon a new liquidation', async () => {
    //   // whale supports TCR
    //   await borrowerOperations.addColl(whale, whale, { from: whale, value: _100_Ether })

    //   // alice deposits 100 CLV to the SP
    //   await borrowerOperations.addColl(alice, alice, { from: alice, value:moneyVals._10_Ether })
    //   await borrowerOperations.withdrawCLV(moneyVals._100e18, alice, { from: alice })
    //   await poolManager.provideToSP(moneyVals._100e18, { from: alice })

    //   await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value:moneyVals._1_Ether })
    //   await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value:moneyVals._1_Ether })
    //   await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
    //   await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

    //   // Price drops
    //   await priceFeed.setPrice(moneyVals._100e18);

    //   // defaulter_1 liquidated. 100 CLV  absorbed by Pool, which empties it.  Alice CLVLoss = 100.
    //   await cdpManager.liquidate(defaulter_1, { from: owner })

    //   // Bob and carol open loans, withdraws 100 CLV and deposits to Stability Pool
    //   await borrowerOperations.addColl(bob, bob, { from: bob, value:moneyVals._10_Ether })
    //   await borrowerOperations.withdrawCLV(moneyVals._100e18, bob, { from: bob })
    //   await poolManager.provideToSP(moneyVals._100e18, { from: bob })

    //   await borrowerOperations.addColl(carol, carol, { from: carol, value:moneyVals._10_Ether })
    //   await borrowerOperations.withdrawCLV(moneyVals._100e18, carol, { from: carol })
    //   await poolManager.provideToSP(moneyVals._100e18, { from: carol })
      
    //   // Defaulter 2 liquidated. Bob and Carol *should* receive a CLVLoss of 50 each
    //   await cdpManager.liquidate(defaulter_2, { from: owner })
    
    //   const bob_S_CLV_Snapshot = (await poolManager.snapshot(bob))[1]
    //   const carol_S_CLV_Snapshot = (await poolManager.snapshot(carol))[1]

    //   const bob_deposit = await poolManager.deposit(bob)
    //   const carol_deposit = await poolManager.deposit(carol)
    
    //   const S_CLV = await poolManager.S_CLV()
    //   console.log("S_CLV is" + S_CLV)

    //   const bob_CLVLoss = bob_deposit.mul(S_CLV.sub(bob_S_CLV_Snapshot)).div(web3.utils.toBN('1000000000000000000'))
    //   const carol_CLVLoss = carol_deposit.mul(S_CLV.sub(carol_S_CLV_Snapshot)).div(web3.utils.toBN('1000000000000000000'))

    //   console.log(`Bob's CLV Loss after a liquidation of 100 CLV is: ${bob_CLVLoss} `)
    //   console.log(`Carol's CLV Loss after a liquidation of 100 CLV is: ${carol_CLVLoss} `)

    //   assert.equal(bob_CLVLoss.toString(), moneyVals._50e18)
    //   assert.equal(carol_CLVLoss.toString(), moneyVals._50e18)
    // })

    // it('After an unremoved overstay, new depositors withdraw the correct amount of CLV after a new liquidation', async () => {
    //   // whale supports TCR
    //   await borrowerOperations.addColl(whale, whale, { from: whale, value: _100_Ether })

    //   // alice deposits 100 CLV to the SP
    //   await borrowerOperations.addColl(alice, alice, { from: alice, value:moneyVals._10_Ether })
    //   await borrowerOperations.withdrawCLV(moneyVals._100e18, alice, { from: alice })
    //   await poolManager.provideToSP(moneyVals._100e18, { from: alice })

    //   await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value:moneyVals._1_Ether })
    //   await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value:moneyVals._1_Ether })
    //   await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_1, { from: defaulter_1 })
    //   await borrowerOperations.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

    //   // Price drops
    //   await priceFeed.setPrice(moneyVals._100e18);

    //   // defaulter_1 liquidated. 100 CLV  absorbed by Pool, which empties it.  Alice's CLVLoss = 100.
    //   await cdpManager.liquidate(defaulter_1, { from: owner })

    //   // Bob, carol, dennis, erin, flyn open loans, withdraws 100 CLV and deposits to Stability Pool
    //   await borrowerOperations.openLoan(moneyVals._100e18, bob, {from: bob, value:moneyVals._10_Ether})
    //   await borrowerOperations.openLoan(moneyVals._100e18, carol, {from: carol, value:moneyVals._10_Ether})
    //   await borrowerOperations.openLoan(moneyVals._100e18, dennis, {from: dennis, value:moneyVals._10_Ether})
    //   await borrowerOperations.openLoan(moneyVals._100e18, erin, {from: erin, value:moneyVals._10_Ether})
    //   await borrowerOperations.openLoan(moneyVals._100e18, flyn, {from: flyn, value:moneyVals._10_Ether})

    //   await poolManager.provideToSP(moneyVals._100e18, { from: bob })
    //   await poolManager.provideToSP(moneyVals._100e18, { from: carol })
    //   await poolManager.provideToSP(moneyVals._100e18, { from: dennis })
    //   await poolManager.provideToSP(moneyVals._100e18, { from: erin })
    //   await poolManager.provideToSP(moneyVals._100e18, { from: flyn })
    
    //   // Defaulter 2 liquidated. Bob, Carol, Dennis, Erin, Flyn should receive 20 CLV Loss each, leaving them with
    //   // withdrawable deposits of 80 CLV.
    //   await cdpManager.liquidate(defaulter_2, { from: owner })
  
    //  await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob } )
    //  assert.equal((await clvToken.balanceOf(bob)).toString(), moneyVals._80e18)
    //  await poolManager.withdrawFromSP(moneyVals._100e18, { from: carol } )
    //  assert.equal((await clvToken.balanceOf(carol)).toString(), moneyVals._80e18)
    //  await poolManager.withdrawFromSP(moneyVals._100e18, { from: dennis } )
    //  assert.equal((await clvToken.balanceOf(dennis)).toString(), moneyVals._80e18)
    //  await poolManager.withdrawFromSP(moneyVals._100e18, { from: erin } )
    //  assert.equal((await clvToken.balanceOf(erin)).toString(), moneyVals._80e18)
    //  await poolManager.withdrawFromSP(moneyVals._100e18, { from: flyn } )
    //  assert.equal((await clvToken.balanceOf(flyn)).toString(), moneyVals._80e18)
    // })
  })
})


contract('Reset chain state', async accounts => { })