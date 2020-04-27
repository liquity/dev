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
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
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
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
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
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._1_Ether })
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
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals. _1_Ether })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._1_Ether })
      await cdpManager.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: moneyVals._1_Ether })
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
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._1_Ether })
      await cdpManager.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: moneyVals._1_Ether })
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
    it("Compounding, A, B, D deposit -> 2 liquidations -> C makes deposit -> 1 liquidation -> D withdraws -> 1 liquidation. All deposits: 100 CLV. Liquidations: 100,100,100,50.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
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
    it.only("Compounding: Depositor withdraws correct compounded deposit after liquidation empties the pool", async () => {
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
      
      console.log("P CLV is: " + (await poolManager.P_CLV()).toString())
      
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

      // price drops by 50%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter 1 liquidated. 200 CLV fully offset with pool.
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis, Erin each deposit 100, 200, 300 CLV respectively
      await cdpManager.openLoan(moneyVals._100e18, carol, { from: carol, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: carol })

      await cdpManager.openLoan(moneyVals._200e18, dennis, { from: dennis, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._200e18, { from: dennis })

      await cdpManager.openLoan(moneyVals._300e18, erin, { from: erin, value: moneyVals._100_Ether })
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

      assert.equal((await clvToken.balanceOf(carol)).toString(), '83333333333333333333')
      assert.equal((await clvToken.balanceOf(dennis)).toString(), '166666666666666666666')
      assert.equal((await clvToken.balanceOf(erin)).toString(), '250000000000000000000')

      //Expect Alice and Bob's ETH Gain to be 1 ETH
      assert.equal(alice_ETHWithdrawn, moneyVals._1_Ether)
      assert.equal(bob_ETHWithdrawn, moneyVals._1_Ether)

      assert.equal(carol_ETHWithdrawn, '166666666666666666')
      assert.equal(dennis_ETHWithdrawn, '333333333333333333')
      assert.equal(erin_ETHWithdrawn, '500000000000000000')
    })

    // --- Scale factor tests

    // A deposits 100
    // L1 brings P close to boundary, i.e. 1e-18 - 99.9999999?
    // A withdraws all
    // B deposits 100
    // L2 brings of 90, should bring P slightly past boundary i.e. 1e-18 -> 1e-19

    // expect d(B) = d0(B)/10
    // expect correct ETH gain, i.e. all of the reward
    it("Compounding, deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      await cdpManager.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      // Defaulter 1 withdraws 'almost' 100 CLV
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await cdpManager.withdrawCLV('99999999999999999000', defaulter_1, { from: defaulter_1 })

      // Defaulter 2 withdraws 90 CLV
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: '500000000000000000' })
      await cdpManager.withdrawCLV(moneyVals._90e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter 1 liquidated.  Value of P reduced to 9.
      await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.equal((await poolManager.P_CLV()).toString(), '9')

      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = await txA.logs[1].args[1].toString()

      console.log(`P_CLV after L1 is ${await poolManager.P_CLV()}`)
      // assert.equal((await clvToken.balanceOf(alice)).toString(), '1')
      console.log(await clvToken.balanceOf(alice).toString())
      console.log(alice_ETHWithdrawn)

      console.log(`scale after L1: ${await poolManager.scale()}`)
      console.log(`S sum at scale 0, after L1: ${await poolManager.scaleToSum(0)}`)
      console.log(`S sum at scale 1, after L1: ${await poolManager.scaleToSum(1)}`)

      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      // Defaulter 2 liquidated
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // 90 CLV liquidated. P altered by a factor of (1-90/100) = 0.1.  Scale changed.
      console.log(`P_CLV after L2 is ${await poolManager.P_CLV()}`)

      console.log(`scale after L2: ${await poolManager.scale()}`)
      console.log(`S sum at scale 0, after L2: ${await poolManager.scaleToSum(0)}`)
      console.log(`S sum at scale 1, after L2: ${await poolManager.scaleToSum(1)}`)

      const txB = await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      const bob_ETHWithdrawn = await txB.logs[1].args[1].toString()

      // Expect Bob to withdraw 10% of initial deposit (10 CLV) and all the liquidated ETH (0.5 ether)
      assert.equal((await clvToken.balanceOf(bob)).toString(), '10000000000000000000')
      assert.equal(bob_ETHWithdrawn, '500000000000000000')
    })


    // A deposits 100
    // L1 brings P close to boundary, i.e. 1e-18 - 99.9999999?
    // A withdraws all
    // B, C, D deposit 100, 200, 300
    // L2 brings of 90, should bring P slightly past boundary i.e. 1e-18 -> 1e-19

    // expect d(B) = d0(B)/10
    // expect correct ETH gain, i.e. all of the reward
    it("Compounding: Several deposits of varying amounts span one scale factor change. Depositors withdraw correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      await cdpManager.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      // Defaulter 1 withdraws 'almost' 100 CLV.
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await cdpManager.withdrawCLV('99999999999999999000', defaulter_1, { from: defaulter_1 })

      // Defaulter 2 withdraws 540 CLV
      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._3_Ether })
      await cdpManager.withdrawCLV('540000000000000000000', defaulter_2, { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter 1 liquidated.  Value of P reduced to 9.
      await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.equal((await poolManager.P_CLV()).toString(), '9')

      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })

      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      await cdpManager.openLoan(moneyVals._200e18, carol, { from: carol, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._200e18, { from: carol })

      await cdpManager.openLoan(moneyVals._300e18, dennis, { from: dennis, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._300e18, { from: dennis })

      // 540 CLV liquidated.  P altered by a factor of (1-540/600) = 0.1. Scale changed.
      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)
      console.log(`P_CLV after L2 is ${await poolManager.P_CLV()}`)

      const txB = await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(moneyVals._200e18, { from: carol })
      const txD = await poolManager.withdrawFromSP(moneyVals._300e18, { from: dennis })

      /* Expect depositors to withdraw 10% of their initial deposit, and an ETH gain 
      in proportion to their initial deposit:
     
      Bob:  10 CLV, 0.5 Ether
      Carol:  20 CLV, 1 Ether
      Dennis:  30 CLV, 1.5 Ether
     
      Total: 60 CLV, 3 Ether
      */
      assert.equal((await clvToken.balanceOf(bob)).toString(), moneyVals._10e18)
      assert.equal((await clvToken.balanceOf(carol)).toString(), moneyVals._20e18)
      assert.equal((await clvToken.balanceOf(dennis)).toString(), moneyVals._30e18)

      const bob_ETHWithdrawn = await txB.logs[1].args[1].toString()
      const carol_ETHWithdrawn = await txC.logs[1].args[1].toString()
      const dennis_ETHWithdrawn = await txD.logs[1].args[1].toString()

      // assert.equal(bob_ETHWithdrawn, '500000000000000000')
      // assert.equal(carol_ETHWithdrawn, '1000000000000000000')
      assert.equal(dennis_ETHWithdrawn, '1500000000000000000')
    })


    // Deposit's ETH reward spans one scale -  deposit reduced by factor of < 1e18

    // A make deposit 100 CLV
    // L1 brings P to (~1e-10)*P. L1:  99.999999999000000000 CLV
    // A withdraws
    // B makes deposit 100 CLV
    // L2 decreases P again by (1e-10)), over boundary: 99.999999999000000000 (near to the 100 CLV total deposits)
    // B withdraws
    // expect d(B) = d0(B) * (1e-10)
    // expect B gets entire ETH gain from L2
    it("Compounding, deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      await cdpManager.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      // Defaulter 1 and default 2 each withdraw 99.999999999 CLV
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await cdpManager.withdrawCLV('99999999999000000000', defaulter_1, { from: defaulter_1 })

      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await cdpManager.withdrawCLV('99999999999000000000', defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter 1 ICR falls to 100%
      await priceFeed.setPrice(moneyVals._100e18);

      console.log(`scale Pre-L1 is:${await poolManager.scale()}`)
      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txL1 = await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)
      console.log("P CLV after L1:" + (await poolManager.P_CLV()).toString())

      console.log(`scale after is:${await poolManager.scale()}`)
      // Alice withdraws
      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })
      console.log("P CLV after Alice withdraws:" + (await poolManager.P_CLV()).toString())
      // Bob deposits 100 CLV
      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })
      console.log("P CLV after Bob withdraws:" + (await poolManager.P_CLV()).toString())
      // Defaulter 2 liquidated
      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)
      console.log("P CLV after L2:" + (await poolManager.P_CLV()).toString())
      console.log(`scale after L2 is:${await poolManager.scale()}`)

      // 99999999999999 Why is P 14 digits? Should be ( 8 + 18 - 10) = 16? So 15 digits with rounding error.

      const txB = await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      const bob_ETHWithdrawn = await txB.logs[1].args[1].toString()

      // Bob should withdraw 1e-10 of his deposit, and the full ETH gain of 1 ether
      console.log(`bob balance after: ${(await clvToken.balanceOf(bob)).toString()}`)
      assert.equal((await clvToken.balanceOf(bob)).toString(), '1000000000')
      assert.equal(bob_ETHWithdrawn, '1000000000000000000')

      console.log(`bob ETH after: ${await txB.logs[1].args[1].toString()}`)
    })

    // A make deposit 100 CLV
    // L1 brings P to (~1e-10)*P. L1:  99.999999999000000000 CLV
    // A withdraws
    // B,C D make deposit 100, 200, 300
    // L2 decreases P again by (1e-10)), over boundary. L2: 599.999999994000000000  (near to the 600 CLV total deposits)
    // B withdraws
    // expect d(B) = d0(B) * (1e-10)
    // expect B gets entire ETH gain from L2
    it("Compounding, Several deposits of varying amounts span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      await cdpManager.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      // Defaulter 1 and default 2 each withdraw 99.999999999 CLV
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await cdpManager.withdrawCLV('99999999999000000000', defaulter_1, { from: defaulter_1 })

      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._6_Ether })
      await cdpManager.withdrawCLV('599999999994000000000', defaulter_2, { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txL1 = await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)
      console.log("P CLV after L1:" + (await poolManager.P_CLV()).toString())

      // Alice withdraws
      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })

      // B, C, D deposit 100, 200, 300 CLV
      await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: bob })

      await cdpManager.openLoan(moneyVals._200e18, carol, { from: carol, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._200e18, { from: carol })

      await cdpManager.openLoan(moneyVals._300e18, dennis, { from: dennis, value: moneyVals._100_Ether })
      await poolManager.provideToSP(moneyVals._300e18, { from: dennis })

      // Defaulter 2 liquidated
      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)
      console.log("P CLV after L2:" + (await poolManager.P_CLV()).toString())

      const txB = await poolManager.withdrawFromSP(moneyVals._100e18, { from: bob })
      const bob_ETHWithdrawn = await txB.logs[1].args[1].toString()

      const txC = await poolManager.withdrawFromSP(moneyVals._200e18, { from: carol })
      const carol_ETHWithdrawn = await txC.logs[1].args[1].toString()

      const txD = await poolManager.withdrawFromSP(moneyVals._300e18, { from: dennis })
      const dennis_ETHWithdrawn = await txD.logs[1].args[1].toString()

      // B, C and D should withdraw 1e-10 of initial deposit, 
      console.log(`bob balance after: ${(await clvToken.balanceOf(bob)).toString()}`)

      // TODO:  check deposit magnitudes are correct
      // assert.equal((await clvToken.balanceOf(bob)).toString(), '1000000000' )
      // assert.equal((await clvToken.balanceOf(carol)).toString(), '2000000000' )
      assert.equal((await clvToken.balanceOf(dennis)).toString(), '3000000000' )

      assert.equal(bob_ETHWithdrawn, moneyVals._1_Ether )
      assert.equal(carol_ETHWithdrawn, moneyVals._2_Ether)
      assert.equal(dennis_ETHWithdrawn, moneyVals._3_Ether)

      console.log(`bob ETH after: ${await txB.logs[1].args[1].toString()}`)
    })

   
  // A deposits 100
    // L1, L2, L3 liquidated with 100 CLV each
    // A withdraws all
    // Expect A to withdraw 0 deposit and ether only from reward L1
    it("Compounding, single deposit fully offset. After subsequent liquidations, depositor withdraws 0 deposit and *only* the ETH Gain from one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await cdpManager.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

      await cdpManager.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._2_Ether })
      await poolManager.provideToSP(moneyVals._100e18, { from: alice })

      // Defaulter 1,2,3 withdraw 'almost' 100 CLV
      await cdpManager.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: moneyVals._1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18 , defaulter_1, { from: defaulter_1 })

      await cdpManager.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: moneyVals._1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_2, { from: defaulter_2 })

      await cdpManager.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: moneyVals._1_Ether })
      await cdpManager.withdrawCLV(moneyVals._100e18, defaulter_3, { from: defaulter_3 })

      // price drops by 50%
      await priceFeed.setPrice(moneyVals._100e18);

      // Defaulter 1, 2  and 3 liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      console.log(` P After L1 is: ${(await poolManager.P_CLV()).toString()}`)

      await cdpManager.liquidate(defaulter_2, { from: owner });
      console.log(` P After L2 is: ${(await poolManager.P_CLV()).toString()}`)

      await cdpManager.liquidate(defaulter_3, { from: owner });
      console.log(` P After L3 is: ${(await poolManager.P_CLV()).toString()}`)

      const txA = await poolManager.withdrawFromSP(moneyVals._100e18, { from: alice })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = await txA.logs[1].args[1].toString()

      console.log(`$ Alice CLV balance: ${(await clvToken.balanceOf(alice)).toString()}`)
      console.log(`Alice ETH withdrawn: ${alice_ETHWithdrawn}`)

      assert.isAtMost(getDifference((await clvToken.balanceOf(alice)) .toString(), 0), 1000)
      assert.isAtMost(getDifference(alice_ETHWithdrawn, moneyVals._1_Ether), 1000)

      // console.log(`scale after L1: ${await poolManager.scale()}`)
      // console.log(`S sum at scale 0, after L1: ${await poolManager.scaleToSum(0)}`)
      // console.log(`S sum at scale 1, after L1: ${await poolManager.scaleToSum(1)}`)

      // await cdpManager.openLoan(moneyVals._100e18, bob, { from: bob, value: moneyVals._2_Ether })
      // await poolManager.provideToSP(moneyVals._100e18, { from: bob })


      // console.log(`scale after L2: ${await poolManager.scale()}`)
      // console.log(`S sum at scale 0, after L2: ${await poolManager.scaleToSum(0)}`)
      // console.log(`S sum at scale 1, after L2: ${await poolManager.scaleToSum(1)}`)
    })
  })
})

contract('Reset chain state', async accounts => { })