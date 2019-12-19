// TODO - Refactor duplication across tests. Run only minimum number of contracts
const PoolManager = artifacts.require("./PoolManager.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const NameRegistry = artifacts.require("./NameRegistry.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")

const deploymentHelpers = require("../utils/deploymentHelpers.js")
const getAddresses = deploymentHelpers.getAddresses
const setNameRegistry = deploymentHelpers.setNameRegistry
const connectContracts = deploymentHelpers.connectContracts
const getAddressesFromNameRegistry = deploymentHelpers.getAddressesFromNameRegistry

contract('PoolManager', async accounts => {
  const _2_Ether = web3.utils.toWei('2', 'ether')
  const _1_Ether = web3.utils.toWei('1', 'ether')
  const _9_Ether = web3.utils.toWei('9', 'ether')
  const _10_Ether = web3.utils.toWei('10', 'ether')
  const _50_Ether = web3.utils.toWei('50', 'ether')
  const _100_Ether = web3.utils.toWei('100', 'ether')
  const _101_Ether = web3.utils.toWei('101', 'ether')

  const [owner, mockCDPManagerAddress, mockPoolManagerAddress, defaulter_1, defaulter_2, defaulter_3, alice, whale] = accounts;
  let priceFeed;
  let clvToken;
  let poolManager;
  let cdpManager;
  let nameRegistry;
  let activePool;
  let stabilityPool;
  let defaultPool;
  let contractAddresses;

  describe("Stability Pool Mechanisms", async () => {
    beforeEach(async () => {
      priceFeed = await PriceFeed.new()
      clvToken = await CLVToken.new()
      poolManager = await PoolManager.new()
      cdpManager = await CDPManager.new()
      nameRegistry = await NameRegistry.new()
      activePool = await ActivePool.new()
      stabilityPool = await StabilityPool.new()
      defaultPool = await DefaultPool.new()

      contracts = {
        priceFeed,
        clvToken,
        poolManager,
        cdpManager,
        nameRegistry,
        activePool,
        stabilityPool,
        defaultPool
      }

      const contractAddresses = getAddresses(contracts)
      await setNameRegistry(contractAddresses, nameRegistry, { from: owner })
      const registeredAddresses = await getAddressesFromNameRegistry(nameRegistry)

      await connectContracts(contracts, registeredAddresses)
      await poolManager.setCDPManagerAddress(mockCDPManagerAddress, { from: owner })
    })

    // increases recorded CLV at Stability Pool
    it("depositCLV(): increases the Stability Pool CLV balance", async () => {
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

      // depositCLV()
      await poolManager.depositCLV(200, { from: alice })

      // check CLV balances after
      const alice_CLV_After = await clvToken.balanceOf(alice)
      const stabilityPool_CLV_After = await stabilityPool.getCLV({ from: poolManager.address })
      assert.equal(alice_CLV_After, 0)
      assert.equal(stabilityPool_CLV_After, 200)
    })

    it("depositCLV(): updates the user's deposit record in PoolManager", async () => {
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

      // depositCLV()
      await poolManager.depositCLV(200, { from: alice })

      // check user's deposit record after
      const alice_depositRecord_After = await poolManager.deposit(alice)
      assert.equal(alice_depositRecord_After, 200)
    })

    it("depositCLV(): reduces users CLV balance by the correct amount", async () => {
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

      // depositCLV()
      await poolManager.depositCLV(200, { from: alice })

      // check user's deposit record after
      const alice_CLVBalance_After = await clvToken.balanceOf(alice)
      assert.equal(alice_CLVBalance_After, 0)
    })

    it("depositCLV(): increases totalCLVDeposits by correct amount", async () => {
      // --- SETUP ---
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      // Whale opens CDP with 50 ETH, adds 2000 CLV to StabilityPool
      await cdpManager.addColl({ from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('2000000000000000000000', { from: whale })
      await poolManager.depositCLV('2000000000000000000000', { from: whale })

      const totalCLVDeposits = await stabilityPool.getTotalCLVDeposits()
      assert.equal(totalCLVDeposits, '2000000000000000000000')
    })

    it('depositCLV(): Correctly updates user snapshots of accumulated rewards per unit staked', async () => {
      // --- SETUP ---
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
      // 2 CDPs opened, each withdraws 180 CLV
      await cdpManager.addColl({ from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl({ from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', { from: defaulter_1 })
      await cdpManager.withdrawCLV('180000000000000000000', { from: defaulter_2 })

      // Alice makes CDP and withdraws 100 CLV 
      await cdpManager.addColl({ from: alice, value: _1_Ether })
      await cdpManager.withdrawCLV(100, { from: alice })
      // Whale opens CDP with 50 ETH, adds 2000 CLV to StabilityPool
      await cdpManager.addColl({ from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('2000000000000000000000', { from: whale })
      await poolManager.depositCLV('2000000000000000000000', { from: whale })

      // price drops: defaulter's CDPs fall below MCR, whale doesn't
      await priceFeed.setPrice(100);

      // CDPs are closed
      await cdpManager.close(defaulter_1, { from: owner })
      await cdpManager.close(defaulter_2, { from: owner });

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
      await poolManager.depositCLV(100, { from: alice })

      // check 'After' snapshots
      const alice_snapshot_After = await poolManager.snapshot(alice)
      const alice_snapshotETH_After = alice_snapshot_After[0].toString()
      const alice_snapshotCLV_After = alice_snapshot_After[1].toString()

      assert.equal(alice_snapshotETH_After, '1000000000000000')
      assert.equal(alice_snapshotCLV_After, '180000000000000000')
    })

    it("depositCLV(), multi-deposit: updates user's total pending changes, snapshots and deposit", async () => {
      // --- SETUP ---
      // Whale deposits 2000 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
      await cdpManager.addColl({ from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('1850000000000000000000', { from: whale })
      await poolManager.depositCLV('1850000000000000000000', { from: whale })

      // 3 CDPs opened. Two users withdraw 180 CLV each
      await cdpManager.addColl({ from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl({ from: defaulter_2, value: _1_Ether })
      await cdpManager.addColl({ from: defaulter_3, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', { from: defaulter_1 })
      await cdpManager.withdrawCLV('180000000000000000000', { from: defaulter_2 })
      await cdpManager.withdrawCLV('180000000000000000000', { from: defaulter_3 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await cdpManager.addColl({ from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV('150000000000000000000', { from: alice })
      await poolManager.depositCLV('150000000000000000000', { from: alice })

      const alice_Snapshot_0 = await poolManager.snapshot(alice)
      const alice_Snapshot_0_ETH = alice_Snapshot_0[0]
      const alice_Snapshot_0_CLV = alice_Snapshot_0[1]
      assert.equal(alice_Snapshot_0_ETH, 0)
      assert.equal(alice_Snapshot_0_CLV, 0)

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice(100);

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.close(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.close(defaulter_2, { from: owner }); // 180 CLV closed

      // At this stage, total deposits = 2000 CLV: 1850CLV (from whale) and 150CLV (from Alice)
      const S_CLV_1 = (await poolManager.S_CLV()).toString()   // expected: 0.18 CLV
      const S_ETH_1 = (await poolManager.S_ETH()).toString()  // expected: 0.001 Ether

      assert.equal(S_CLV_1, '180000000000000000')  // 0.18 CLV
      assert.equal(S_ETH_1, '1000000000000000')  // 0.001 Ether

      // check Alice's total pending changes are 0
      const totalPendingCLVLoss_1 = await poolManager.totalPendingCLVLoss(alice);
      const totalPendingETHGain_1 = await poolManager.totalPendingETHGain(alice);
      assert.equal(totalPendingCLVLoss_1, 0)
      assert.equal(totalPendingETHGain_1, 0)

      // Alice makes deposit #2:  100CLV
      await cdpManager.withdrawCLV('100000000000000000000', { from: alice })
      await poolManager.depositCLV('100000000000000000000', { from: alice })

      // check Alice's total pending changes increase by deposit * [S-S(0)]:
      const totalPendingCLVLoss_2 = (await poolManager.totalPendingCLVLoss(alice)).toString();
      const totalPendingETHGain_2 = (await poolManager.totalPendingETHGain(alice)).toString();

      assert.equal(totalPendingCLVLoss_2, '27000000000000000000') // 27 CLV
      assert.equal(totalPendingETHGain_2, '150000000000000000') // 0.15 Ether

      // check Alice's deposit increases from 150 CLV to 250 CLV
      const newDeposit_alice = await poolManager.deposit(alice)
      assert.equal(newDeposit_alice, '250000000000000000000')

      // check Alice's new snapshot is correct
      const alice_Snapshot_1 = await poolManager.snapshot(alice)
      const alice_Snapshot_1_ETH = alice_Snapshot_1[0].toString()
      const alice_Snapshot_1_CLV = alice_Snapshot_1[1].toString()
      assert.equal(alice_Snapshot_1_ETH, S_ETH_1)
      assert.equal(alice_Snapshot_1_CLV, S_CLV_1)

      // Whale withdraws 100 CLV, bringing totalDepositedCLV back to 2000 CLV
      await poolManager.retrieve('100000000000000000000', false, { from: whale })
      const totalCLVDeposits = (await stabilityPool.getTotalCLVDeposits()).toString()
      assert.equal(totalCLVDeposits, '2000000000000000000000')

      // Defaulter 3 CDP is closed
      await cdpManager.close(defaulter_3, { from: owner })

      // At this stage, total deposits = 2000 CLV: 1850CLV (from whale) and 250CLV (from Alice)
      const S_CLV_2 = (await poolManager.S_CLV()).toString()   // expected: 0.27 CLV
      const S_ETH_2 = (await poolManager.S_ETH()).toString()  // expected: 0.0015 Ether

      assert.equal(S_CLV_2, '270000000000000000')  // 0.27 CLV
      assert.equal(S_ETH_2, '1500000000000000')  // 0.0015 Ether

      // Alice makes deposit #3:  100CLV
      await cdpManager.withdrawCLV('100000000000000000000', { from: alice })
      await poolManager.depositCLV('100000000000000000000', { from: alice })

      // check Alice's total pending changes increase by deposit * [S-S(0)]:
      const totalPendingCLVLoss_3 = (await poolManager.totalPendingCLVLoss(alice)).toString();
      const totalPendingETHGain_3 = (await poolManager.totalPendingETHGain(alice)).toString();

      assert.equal(totalPendingCLVLoss_3, '49500000000000000000') //27 +  22.5  = 49.5 CLV
      assert.equal(totalPendingETHGain_3, '275000000000000000')  // 0.15 + 0.125 = 0.275 Ether

      // check Alice's new snapshot is correct
      const alice_Snapshot_2 = await poolManager.snapshot(alice)
      const alice_Snapshot_2_ETH = alice_Snapshot_2[0].toString()
      const alice_Snapshot_2_CLV = alice_Snapshot_2[1].toString()
      assert.equal(alice_Snapshot_2_ETH, S_ETH_2)
      assert.equal(alice_Snapshot_2_CLV, S_CLV_2)
    })

    it("partial retrieve(): it retrieves the correct fraction of the deposit, the correct fraction of entitled rewards, and updates deposit and entitled rewards per unit staked", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
      await cdpManager.addColl({ from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('1850000000000000000000', { from: whale })
      await poolManager.depositCLV('1850000000000000000000', { from: whale })

      // 2 CDPs opened, 180 CLV withdrawn
      await cdpManager.addColl({ from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl({ from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', { from: defaulter_1 })
      await cdpManager.withdrawCLV('180000000000000000000', { from: defaulter_2 })

      // --- TEST --- 

      // Alice makes deposit #1: 150 CLV
      await cdpManager.addColl({ from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV('150000000000000000000', { from: alice })
      await poolManager.depositCLV('150000000000000000000', { from: alice })

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice(100);

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.close(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.close(defaulter_2, { from: owner }); // 180 CLV closed

      // Alice retrieves 60% of her deposit: 90 CLV
      await poolManager.retrieve('90000000000000000000', 0, { from: alice })

      // check StabilityPool totalCLVDeposits decreased by 90 CLV to 1910 CLV
      const totalCLVDeposits = (await stabilityPool.getTotalCLVDeposits()).toString()
      assert.equal(totalCLVDeposits, '1910000000000000000000')

      // check alice has 40% of initial deposit remaining: 60 CLV
      const newDeposit = (await poolManager.deposit(alice)).toString()
      assert.equal(newDeposit, '60000000000000000000')

      // Pending changes sums receive 40% of alice's accumulated total reward, for the previous deposit value
      const totalPendingCLVLoss = (await poolManager.totalPendingCLVLoss(alice)).toString();
      const totalPendingETHGain = (await poolManager.totalPendingETHGain(alice)).toString();

      assert.equal(totalPendingCLVLoss, '10800000000000000000')
      assert.equal(totalPendingETHGain, '60000000000000000')
    })

    it("retrieve(), to user's account: decreases StabilityPool ETH", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      await cdpManager.addColl({ from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('1850000000000000000000', { from: whale })
      await poolManager.depositCLV('1850000000000000000000', { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await cdpManager.addColl({ from: defaulter_1, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', { from: defaulter_1 })

      // --- TEST --- 

      // Alice makes deposit #1: 150 CLV
      await cdpManager.addColl({ from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV('150000000000000000000', { from: alice })
      await poolManager.depositCLV('150000000000000000000', { from: alice })

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
      await cdpManager.close(defaulter_1, { from: owner })  // 180 CLV closed

      //check activePool and StabilityPool Ether before retrieval:
      const active_ETH_Before = await activePool.getETH()
      const stability_ETH_Before = await stabilityPool.getETH()

      // Alice retrieves all of her deposit, 150CLV, choosing to retrieve ETH direct to her account
      await poolManager.retrieve('150000000000000000000', 0, { from: alice })

      const active_ETH_After = await activePool.getETH()
      const stability_ETH_After = await stabilityPool.getETH()

      const active_ETH_Difference = (active_ETH_After - active_ETH_Before).toString()
      const stability_ETH_Difference = (stability_ETH_After - stability_ETH_Before).toString()

      assert.equal(active_ETH_Difference, '0')
      assert.equal(stability_ETH_Difference, '-75000000000000000')
    })


    it("retrieve(), to CDP: redirects ETH reward to user's CDP", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      await cdpManager.addColl({ from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('1850000000000000000000', { from: whale })
      await poolManager.depositCLV('1850000000000000000000', { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await cdpManager.addColl({ from: defaulter_1, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', { from: defaulter_1 })

      // --- TEST --- 

      // Alice makes deposit #1: 150 CLV
      await cdpManager.addColl({ from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV('150000000000000000000', { from: alice })
      await poolManager.depositCLV('150000000000000000000', { from: alice })

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
      await cdpManager.close(defaulter_1, { from: owner })  // 180 CLV closed

      // Alice retrieves all of her deposit, 150CLV, choosing to redirect to her CDP
      await poolManager.retrieve('150000000000000000000', 1, { from: alice })
      // check alice's CDP recorded ETH has increased by the expected reward amount
      const aliceCDP_After = await cdpManager.CDPs(alice)
      const aliceCDP_ETH_After = aliceCDP_After[1]

      const CDP_ETH_Increase = (aliceCDP_ETH_After - aliceCDP_ETH_Before).toString()

      assert.equal(CDP_ETH_Increase, '75000000000000000') // expect gain of 0.075 Ether
    })

    it("retrieve(), to CDP: decreases StabilityPool ETH and increases activePool ETH", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      await cdpManager.addColl({ from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('1850000000000000000000', { from: whale })
      await poolManager.depositCLV('1850000000000000000000', { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await cdpManager.addColl({ from: defaulter_1, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', { from: defaulter_1 })

      // --- TEST --- 

      // Alice makes deposit #1: 150 CLV
      await cdpManager.addColl({ from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV('150000000000000000000', { from: alice })
      await poolManager.depositCLV('150000000000000000000', { from: alice })

      // price drops: defaulter's CDP falls below MCR, alice and whale CDP remain active
      await priceFeed.setPrice(100);

      /* defaulter's CDP is closed.  
      / Alice's expected rewards:
      / CLV: 150 * 180/2000 = 13.5
      / ETH: 150 * 1/2000 = 0.075 */
      await cdpManager.close(defaulter_1, { from: owner })  // 180 CLV closed

      //check activePool and StabilityPool Ether before retrieval:
      const active_ETH_Before = await activePool.getETH()
      const stability_ETH_Before = await stabilityPool.getETH()

      // Alice retrieves all of her deposit, 150CLV, choosing to redirect to her CDP
      await poolManager.retrieve('150000000000000000000', 1, { from: alice })

      const active_ETH_After = await activePool.getETH()
      const stability_ETH_After = await stabilityPool.getETH()

      const active_ETH_Difference = (active_ETH_After - active_ETH_Before).toString()
      const stability_ETH_Difference = (stability_ETH_After - stability_ETH_Before).toString()

      assert.equal(active_ETH_Difference, '75000000000000000')
      assert.equal(stability_ETH_Difference, '-75000000000000000')
    })

    it("retrieve(), user leaves ETH in Pool: user's totalPendingETHGains decreases, and entitledETHGain increases", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      await cdpManager.addColl({ from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('1850000000000000000000', { from: whale })
      await poolManager.depositCLV('1850000000000000000000', { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await cdpManager.addColl({ from: defaulter_1, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', { from: defaulter_1 })

      // --- TEST --- 

      // Alice makes deposit #1: 150 CLV
      await cdpManager.addColl({ from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV('150000000000000000000', { from: alice })
      await poolManager.depositCLV('150000000000000000000', { from: alice })

      // price drops: defaulter's CDP falls below MCR, alice and whale CDP remain active
      await priceFeed.setPrice(100);

      /* defaulter's CDP is closed.  
      / Alice's expected rewards:
      / CLV: 150 * 180/2000 = 13.5
      / ETH: 150 * 1/2000 = 0.075 */
      await cdpManager.close(defaulter_1, { from: owner })  // 180 CLV closed

      //check activePool and StabilityPool Ether before retrieval:
      const active_ETH_Before = await activePool.getETH()
      const stability_ETH_Before = await stabilityPool.getETH()
      const alice_EntitledETH_Before = await poolManager.entitledETHGain(alice)

      // Alice retrieves all of her deposit, 150CLV, choosing to leave her ETH gain in the Pool as entitled ETH
      await poolManager.retrieve('150000000000000000000', 2, { from: alice })

      const active_ETH_After = await activePool.getETH()
      const stability_ETH_After = await stabilityPool.getETH()
      const alice_EntitledETH_After = await poolManager.entitledETHGain(alice)

      const active_ETH_Difference = (active_ETH_After - active_ETH_Before).toString()
      const stability_ETH_Difference = (stability_ETH_After - stability_ETH_Before).toString()
      const alice_EntitledETH_Difference = (alice_EntitledETH_After - alice_EntitledETH_Before)

      assert.equal(active_ETH_Difference, '0')
      assert.equal(stability_ETH_Difference, '0')
      assert.equal(alice_EntitledETH_Difference, '75000000000000000')
    })

    it.only("retrieveEntitledETH(): user can retrieve their entitled ETH", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })

      await cdpManager.addColl({ from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('1850000000000000000000', { from: whale })
      await poolManager.depositCLV('1850000000000000000000', { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await cdpManager.addColl({ from: defaulter_1, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', { from: defaulter_1 })

      // --- TEST --- 

      // Alice makes deposit #1: 150 CLV
      await cdpManager.addColl({ from: alice, value: _10_Ether })
      await cdpManager.withdrawCLV('150000000000000000000', { from: alice })
      await poolManager.depositCLV('150000000000000000000', { from: alice })

      // price drops: defaulter's CDP falls below MCR, alice and whale CDP remain active
      await priceFeed.setPrice(100);

      /* defaulter's CDP is closed.  
      / Alice's expected rewards:
      / CLV: 150 * 180/2000 = 13.5
      / ETH: 150 * 1/2000 = 0.075 */
      await cdpManager.close(defaulter_1, { from: owner })  // 180 CLV closed

      // Alice retrieves first half of her deposit, 75CLV, choosing to leave her ETH gain in the Pool as entitled ETH
      await poolManager.retrieve('75000000000000000000', 2, { from: alice })
      const alice_EntitledETH_1 = (await poolManager.entitledETHGain(alice)).toString()
      assert.equal(alice_EntitledETH_1, '37500000000000000')
      // Alice retrieves last half her deposit, 75CLV, choosing to leave her ETH gain in the Pool as entitled ETH
      await poolManager.retrieve('75000000000000000000', 2, { from: alice })
      const alice_EntitledETH_2 = (await poolManager.entitledETHGain(alice)).toString()
      assert.equal(alice_EntitledETH_2, '75000000000000000')

      const tx = await poolManager.retrieveEntitledETH({ from: alice })
     
      const alice_entitledETH_After = await poolManager.entitledETHGain(alice)
     
      // check Alice retrieves all entitled ETH
      assert.equal(alice_entitledETH_After, '0')
    })

    it("offset: increases S_ETH and S_CLV by correct amounts", async () => {
      // --- SETUP ---
      await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
      // 2 CDPs opened, each withdraws 180 CLV
      await cdpManager.addColl({ from: defaulter_1, value: _1_Ether })
      await cdpManager.addColl({ from: defaulter_2, value: _1_Ether })
      await cdpManager.withdrawCLV('180000000000000000000', { from: defaulter_1 })
      await cdpManager.withdrawCLV('180000000000000000000', { from: defaulter_2 })

      // Whale opens CDP with 50 ETH, adds 2000 CLV to StabilityPool
      await cdpManager.addColl({ from: whale, value: _50_Ether })
      await cdpManager.withdrawCLV('2000000000000000000000', { from: whale })
      await poolManager.depositCLV('2000000000000000000000', { from: whale })

      const S_CLV_Before = await poolManager.S_CLV()
      const S_ETH_Before = await poolManager.S_ETH()
      const totalCLVDeposits = await stabilityPool.getTotalCLVDeposits()

      assert.equal(S_CLV_Before, 0)
      assert.equal(S_ETH_Before, 0)
      assert.equal(totalCLVDeposits, '2000000000000000000000')

      // price drops: defaulter's CDPs fall below MCR, whale doesn't
      await priceFeed.setPrice(100);
      // CDPs are closed
      await cdpManager.close(defaulter_1, { from: owner });
      await cdpManager.close(defaulter_2, { from: owner });

      /* 
      With 2000 CLV in StabilityPool, each closed CDP contributes:
      180/2000 CLV to S_CLV, i.e. 0.09 CLV
      1/2000 ETH to S_ETH, i.e. 0.0005 ETH
      */

      // Get accumulated rewards per unit staked
      const S_CLV_After = (await poolManager.S_CLV()).toString()   // expected: 0.18 CLV
      const S_ETH_After = (await poolManager.S_ETH()).toString()  // expected: 0.001 Ether

      assert.equal(S_CLV_After, '180000000000000000')  // 0.18 CLV
      assert.equal(S_ETH_After, '1000000000000000')  // 0.001 Ether
    })
  })
})

contract('Reset chain state', async accounts => { })