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
const DeciMath = artifacts.require("DeciMath")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")

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
  
  const [ owner, 
          mockCDPManagerAddress, 
          mockPoolManagerAddress, 
          defaulter_1, defaulter_2, 
          defaulter_3, 
          alice, 
          whale, 
          bob, 
          whale_2 ] = accounts;
          
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

  describe("Stability Pool Mechanisms", async () => {
    before(async() => {
      const deciMath = await DeciMath.new()
      DeciMath.setAsDeployed(deciMath)
      CDPManager.link(deciMath)
      PoolManager.link(deciMath)
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
      await poolManager.setCDPManagerAddress(mockCDPManagerAddress, { from: owner })
    })

    // increases recorded CLV at Stability Pool
    it("provideToSP(): increases the Stability Pool CLV balance", async () => {
      // --- SETUP --- Give Alice 200 CLV
      // use the mockPool to set alice's CLV Balance
      await clvToken.setPoolManagerAddress(mockPoolManagerAddress, { from: owner })
      await clvToken.mint(alice, 200, { from: mockPoolManagerAddress })
      // reconnect CLVToken to the real poolManager
      await clvToken.setPoolManagerAddress(poolManager.address, { from: owner })

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
      // use the mockPool to set alice's CLV Balance
      await clvToken.setPoolManagerAddress(mockPoolManagerAddress, { from: owner })
      await clvToken.mint(alice, 200, { from: mockPoolManagerAddress })
      // reconnect CLVToken to the real poolManager
      await clvToken.setPoolManagerAddress(poolManager.address, { from: owner })

      // --- TEST ---
      // check user's deposit record before
      const alice_depositRecord_Before = await poolManager.deposit(alice)
      assert.equal(alice_depositRecord_Before, 0)

      // provideToSP()
      await poolManager.provideToSP(200, { from: alice })

      // check user's deposit record after
      const alice_depositRecord_After = await poolManager.deposit(alice)
      assert.equal(alice_depositRecord_After, 200)
    })

    it("provideToSP(): reduces the user's CLV balance by the correct amount", async () => {
      // --- SETUP --- Give Alice 200 CLV
      // use the mockPool to set alice's CLV Balance
      await clvToken.setPoolManagerAddress(mockPoolManagerAddress, { from: owner })
      await clvToken.mint(alice, 200, { from: mockPoolManagerAddress })
      // reconnect CLVToken to the real poolManager
      await clvToken.setPoolManagerAddress(poolManager.address, { from: owner })

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
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      // Whale opens CDP with 50 ETH, adds 2000 CLV to StabilityPool
      await cdpManager.addColl(whale, whale, { from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('2000000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('2000000000000000000000', { from: whale })

      const totalCLVDeposits = await stabilityPool.getTotalCLVDeposits()
      assert.equal(totalCLVDeposits, '2000000000000000000000')
    })

    it('provideToSP(): Correctly updates user snapshots of accumulated rewards per unit staked', async () => {
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

      // Alice makes CDP and withdraws 100 CLV 
      await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })
      await cdpManager.withdrawCLV(100, alice, { from: alice })
     
      // price drops: defaulter's CDPs fall below MCR, whale doesn't
      await priceFeed.setPrice(100);

      // CDPs are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // --- TEST ---
      const S_CLV = (await poolManager.S_CLV()).toString()   // expected: 0.18 CLV
      const S_ETH = (await poolManager.S_ETH()).toString()  // expected: 0.001 Ether
      assert.equal(S_CLV, '180000000000000000')  // 0.18 CLV
      assert.equal(S_ETH, '1000000000000000') // 0.001 Ether

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

      assert.equal(alice_snapshotETH_After, '1000000000000000')
      assert.equal(alice_snapshotCLV_After, '180000000000000000')
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
      await priceFeed.setPrice(100);

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.liquidate(defaulter_2, { from: owner }); // 180 CLV closed

      // At this stage, total deposits = 2000 CLV: 1850CLV (from whale) and 150CLV (from Alice)
      const S_CLV_1 = (await poolManager.S_CLV()).toString()   // expected: 0.18 CLV
      const S_ETH_1 = (await poolManager.S_ETH()).toString()  // expected: 0.001 Ether

      assert.equal(S_CLV_1, '180000000000000000')  // 0.18 CLV
      assert.equal(S_ETH_1, '1000000000000000')  // 0.001 Ether

      // Alice makes deposit #2:  100CLV
      await cdpManager.withdrawCLV('100000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('100000000000000000000', { from: alice })

      /* check newDeposit = (oldDeposit - CLVLoss) + top-up.
      CLVLoss = 150 CLV * 0.18 = 27 CLV
      --> check newDeposit = (150 - 27 ) + 100 = 223 CLV */
      const newDeposit_alice = (await poolManager.deposit(alice)).toString()
      assert.equal(newDeposit_alice, '223000000000000000000')

      // check Alice's new snapshot is correct
      const alice_Snapshot_1 = await poolManager.snapshot(alice)
      const alice_Snapshot_1_ETH = alice_Snapshot_1[0].toString()
      const alice_Snapshot_1_CLV = alice_Snapshot_1[1].toString()
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
      await priceFeed.setPrice(100);

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.liquidate(defaulter_2, { from: owner }) // 180 CLV closed

      const S_CLV_1 = (await poolManager.S_CLV()).toString()   // expected: 0.18 CLV
      const S_ETH_1 = (await poolManager.S_ETH()).toString()  // expected: 0.001 Ether

      assert.equal(S_CLV_1, '180000000000000000')  // 0.18 CLV
      assert.equal(S_ETH_1, '1000000000000000')  // 0.001 Ether

      // Alice retrieves part of her entitled CLV: 90 CLV
      await poolManager.withdrawFromSP('90000000000000000000', { from: alice })

      /* Alice's CLVLoss = (0.18 * 150) = 27 CLV. Her remaining deposit should be:
      oldDeposit - CLVLoss - withdrawalAmount, i.e:
      150 - 27 - 90 = 33 CLV  */

      // check StabilityPool totalCLVDeposits decreased by 117 CLV to 1883 CLV
      const totalCLVDeposits = (await stabilityPool.getTotalCLVDeposits()).toString()
      assert.equal(totalCLVDeposits, '1883000000000000000000')

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
      await priceFeed.setPrice(100);

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.liquidate(defaulter_2, { from: owner }); // 180 CLV closed

      // Alice retrieves part of her entitled CLV: 90 CLV
      await poolManager.withdrawFromSP('90000000000000000000', { from: alice })

      // check 'After' snapshots
      const alice_snapshot_After = await poolManager.snapshot(alice)
      const alice_snapshotETH_After = alice_snapshot_After[0].toString()
      const alice_snapshotCLV_After = alice_snapshot_After[1].toString()
      assert.equal(alice_snapshotETH_After, '1000000000000000')
      assert.equal(alice_snapshotCLV_After, '180000000000000000')
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
      await priceFeed.setPrice(100);

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

      const active_ETH_Difference = (active_ETH_After - active_ETH_Before).toString()
      const stability_ETH_Difference = (stability_ETH_After - stability_ETH_Before).toString()

      assert.equal(active_ETH_Difference, '0')
      assert.equal(stability_ETH_Difference, '-75000000000000000')
    })

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
      await priceFeed.setPrice(100);

      /* defaulter's CDP is closed.  
      / Alice's expected rewards:
      / CLV: 150 * 180/2000 = 13.5
      / ETH: 150 * 1/2000 = 0.075 */
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed

      // Alice sends her ETH Gains to her CDP
      await poolManager.withdrawFromSPtoCDP(alice, {from: alice})

      // check Alice's CLVLoss has been applied to her deposit - expect (150 - 13.5) = 136.5 CLV
      alice_deposit_afterDefault = (await poolManager.deposit(alice)).toString()
      assert.equal(alice_deposit_afterDefault, '136500000000000000000')

      // check alice's CDP recorded ETH has increased by the expected reward amount
      const aliceCDP_After = await cdpManager.CDPs(alice)
      const aliceCDP_ETH_After = aliceCDP_After[1]

      const CDP_ETH_Increase = (aliceCDP_ETH_After - aliceCDP_ETH_Before).toString()

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
      await priceFeed.setPrice(100);

      /* defaulter's CDP is closed.  
      / Alice's expected rewards:
      / CLV: 150 * 180/2000 = 13.5
      / ETH: 150 * 1/2000 = 0.075 */
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed

      //check activePool and StabilityPool Ether before retrieval:
      const active_ETH_Before = await activePool.getETH()
      const stability_ETH_Before = await stabilityPool.getETH()

      // Alice retrieves all of her deposit, 150CLV, choosing to redirect to her CDP
      await poolManager.withdrawFromSPtoCDP(alice, { from: alice })

      const active_ETH_After = await activePool.getETH()
      const stability_ETH_After = await stabilityPool.getETH()

      const active_ETH_Difference = (active_ETH_After - active_ETH_Before).toString()
      const stability_ETH_Difference = (stability_ETH_After - stability_ETH_Before).toString()

      // check Pool ETH values change by Alice's ETHGain, i.e 0.075 ETH
      assert.equal(active_ETH_Difference, '75000000000000000')
      assert.equal(stability_ETH_Difference, '-75000000000000000')
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
      await priceFeed.setPrice(100);
      // CDPs are closed
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      /* 
      With 2000 CLV in StabilityPool, each closed CDP contributes:
      (180/2000) to S_CLV, i.e. 0.09 CLV
      (1/2000) to S_ETH, i.e. 0.0005 ETH
      */

      // Get accumulated rewards per unit staked
      const S_CLV_After = (await poolManager.S_CLV()).toString()   // expected: 0.18 CLV
      const S_ETH_After = (await poolManager.S_ETH()).toString()  // expected: 0.001 Ether

      assert.equal(S_CLV_After, '180000000000000000')  // 0.18 CLV
      assert.equal(S_ETH_After, '1000000000000000')  // 0.001 Ether
    })

    it('withdrawPenaltyFromSP(): Penalises the overstayer, allows a claimant to get the penalty, and sends remainder to overstayer', async () => {
      //// --- SETUP ---
      // Whale withdraws 1500 CLV and provides to StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
      await cdpManager.addColl(whale, whale, { from: whale, value: _100_Ether })
      await cdpManager.withdrawCLV('1500000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1500000000000000000000', { from: whale })
    
        // 2 CDPs opened, each withdraws 180 CLV
        await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: _10_Ether })
        await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: _10_Ether })
        await cdpManager.withdrawCLV('1500000000000000000000', defaulter_1, { from: defaulter_1 })
        await cdpManager.withdrawCLV('1500000000000000000000', defaulter_2, { from: defaulter_2 })

      // Alice makes deposit #1: 500 CLV
      await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV('500000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('500000000000000000000', { from: alice })

      // price drops: defaulters fall below MCR
      await priceFeed.setPrice(100);

      // defaulter 1 gets closed
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // whale 2 provides 2000 CLV to StabilityPool
      await cdpManager.addColl(whale_2, whale_2, { from: whale_2, value: _100_Ether })
      await cdpManager.withdrawCLV('2000000000000000000000', whale_2, { from: whale_2 })
      await poolManager.provideToSP('2000000000000000000000', { from: whale_2 })

      // defaulter 2 gets closed
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Get accumulated rewards per unit staked
      const S_CLV_After = (await poolManager.S_CLV()).toString()   // expected: 1.125 CLV
      const S_ETH_After = (await poolManager.S_ETH()).toString()  // expected: 0.01 ETH

      totalDep = (await stabilityPool.totalCLVDeposits()).toString()
      assert.equal(S_CLV_After, '1125000000000000000')  // 1.125 CLV
      assert.equal(S_ETH_After, '7500000000000000')  // 0.0075 Ether

      /* Alice's CLVLoss: (500 * 1.125) = 562.5 CLV
      Alice's ETHGain: (500 * 0.0075) = 3.75 Ether
      Alice's deposit - CLVLoss = -62.5 CLV. An overstay. */

      // bob calls withdrawPenalty, clamims penalty
      const penaltyTx = await poolManager.withdrawPenaltyFromSP(alice, { from: bob })
      const arg0 = penaltyTx.logs[2].args[0];
      const arg1  = penaltyTx.logs[2].args[1];
      const arg2 = penaltyTx.logs[2].args[2];
      const arg3 = penaltyTx.logs[2].args[3];

      /* deposit/CLVLoss = 500/562.5 = 0.8888888888888...
      Alice's expected remainder = ETHGain * deposit/CLVLoss = 3.75 * (19/20) = 3.33333... ETH
      Bob's expected reward = ETHGain * (1 - deposit/CLVLoss) = 3.75 * (1/20) = 0.41666666... ETH */


      // Grab reward and remainder from emitted event
      const bob_Reward = (penaltyTx.logs[2].args[1]).toString()
      const alice_Remainder = (penaltyTx.logs[2].args[3]).toString()

      assert.equal(alice_Remainder, '3333333333333333333')
      assert.equal(bob_Reward, '416666666666666667')
    })
  })
})

contract('Reset chain state', async accounts => { })