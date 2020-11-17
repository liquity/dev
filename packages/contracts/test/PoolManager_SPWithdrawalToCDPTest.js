const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const CDPManagerTester = artifacts.require("./CDPManagerTester.sol")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN

contract('PoolManager - Withdrawal of Stability deposit to CDP - reward calculations', async accounts => {

  const [owner,
    defaulter_1,
    defaulter_2,
    defaulter_3,
    defaulter_4,
    defaulter_5,
    whale,
    whale_2,
    alice,
    bob,
    carol,
    dennis,
    erin,
    flyn,
    graham,
    harriet
  ] = accounts;

  let priceFeed
  let clvToken
  let poolManager
  let sortedCDPs
  let cdpManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  let contracts

  const ZERO_ADDRESS = th.ZERO_ADDRESS

  let gasPriceInWei

  describe("Stability Pool Withdrawal to CDP", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
    })

    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      const GTContracts = await deploymentHelper.deployGTContracts()
      contracts.cdpManager = await CDPManagerTester.new()
      contracts = await deploymentHelper.deployCLVToken(contracts)
  
      priceFeed = contracts.priceFeed
      clvToken = contracts.clvToken
      poolManager = contracts.poolManager
      sortedCDPs = contracts.sortedCDPs
      cdpManager = contracts.cdpManager
      activePool = contracts.activePool
      stabilityPool = contracts.stabilityPool
      defaultPool = contracts.defaultPool
      borrowerOperations = contracts.borrowerOperations
      hintHelpers = contracts.hintHelpers
  
      lqtyStaking = GTContracts.lqtyStaking
      growthToken = GTContracts.growthToken
      communityIssuance = GTContracts.communityIssuance
      lockupContractFactory = GTContracts.lockupContractFactory
  
      await deploymentHelper.connectGTContracts(GTContracts)
      await deploymentHelper.connectCoreContracts(contracts, GTContracts)
      await deploymentHelper.connectGTContractsToCore(GTContracts, contracts)
    })

    // --- withdrawETHGainToTrove() ---

    // --- Identical deposits, identical liquidation amounts---
    it("withdrawETHGainToTrove(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(2, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter opens loan with 200% ICR
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_1, { from: defaulter_1 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Check depositors' compounded deposit is 66.66 CLV and ETH Gain is 0.33 ETH
      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '66666666666666666666'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '66666666666666666666'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '66666666666666666666'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '331666666666666667'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '331666666666666667'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '331666666666666667'), 1000)
    })

    it("withdrawETHGainToTrove(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two identical liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(2, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Check depositors' compounded deposit is 33.33 CLV and ETH Gain is 0.66 ETH
      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,   { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '33333333333333333333'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '33333333333333333333'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '33333333333333333333'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '663333333333333333'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '663333333333333333'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '663333333333333333'), 1000)
    })

    it("withdrawETHGainToTrove():  Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three identical liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(2, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_3, { from: defaulter_3, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Check depositors' compounded deposit is 0 CLV and ETH Gain is 1 ETH
      const txA = await poolManager.withdrawETHGainToTrove(alice,  { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,   { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '0'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '995000000000000000'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '995000000000000000'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '995000000000000000'), 1000)
    })

    // --- Identical deposits, increasing liquidation amounts ---
    it("withdrawETHGainToTrove(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two liquidations of increasing CLV", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(2, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: '100000000000000000' })
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: '200000000000000000' })
      await borrowerOperations.withdrawCLV(dec(10, 18), defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Check depositors' compounded deposit is 0 CLV and ETH Gain is 1 ETH
      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,   { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '90000000000000000000'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '90000000000000000000'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '90000000000000000000'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '99500000000000000'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '99500000000000000'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '99500000000000000'), 1000)
    })

    it("withdrawETHGainToTrove(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three liquidations of increasing CLV", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(2, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: '100000000000000000' })
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: '200000000000000000' })
      await borrowerOperations.openLoan(0,  defaulter_3, { from: defaulter_3, value: '300000000000000000' })
      await borrowerOperations.withdrawCLV(dec(10, 18), defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(dec(20, 18), defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Check depositors' compounded deposit is 80 CLV and ETH Gain is 0.2 ETH
      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob,  { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,   { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '80000000000000000000'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '80000000000000000000'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '80000000000000000000'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '199000000000000000'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '199000000000000000'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '199000000000000000'), 1000)
    })

    // --- Increasing deposits, identical liquidation amounts ---
    it("withdrawETHGainToTrove(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after two identical liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      // Alice deposits 100, Bob deposits 200, Carol deposits 300 CLV
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: alice })

      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: bob })

      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: carol })

      // 2 Defaulters open loan with 200% ICR
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,  { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '66666666666666666666'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '133333333333333333333'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '200000000000000000000'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '331666666666666667'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '663333333333333333'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '995000000000000000'), 1000)
    })

    it("withdrawETHGainToTrove(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three identical liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      // Alice deposits 100, Bob deposits 200, Carol deposits 300 CLV
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: alice })

      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: bob })

      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: carol })

      // Defaulters open loan with 200% ICR
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_3, { from: defaulter_3, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,   { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '50000000000000000000'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '100000000000000000000'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '150000000000000000000'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '497500000000000000'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '995000000000000000'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '1492500000000000000'), 1000)
    })

    // --- Varied depoosits and varied liquidation amount ---
    it("withdrawETHGainToTrove(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three varying liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      /* Depositors provide:-
      Alice:  20 CLV
      Bob:  4560 CLV
      Carol: 131 CLV */
      await borrowerOperations.openLoan('20000000000000000000', alice, { from: alice, value: dec(100, 'ether') })
      await poolManager.provideToSP('20000000000000000000', ZERO_ADDRESS, { from: alice })

      await borrowerOperations.openLoan('4560000000000000000000', bob, { from: bob, value: dec(100, 'ether') })
      await poolManager.provideToSP('4560000000000000000000', ZERO_ADDRESS, { from: bob })

      await borrowerOperations.openLoan('131000000000000000000', carol, { from: carol, value: dec(100, 'ether') })
      await poolManager.provideToSP('131000000000000000000', ZERO_ADDRESS, { from: carol })


      /* Defaulters open loans
     
      Defaulter 1: 2110 CLV & 22 ETH  
      Defaulter 2: 10 CLV & 0.1 ETH  
      Defaulter 3: 467 CLV & 5 ETH
      */
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(22, 'ether') })
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: '100000000000000000' })
      await borrowerOperations.openLoan(0,  defaulter_3, { from: defaulter_3, value: dec(5, 'ether') })
      await borrowerOperations.withdrawCLV('2100000000000000000000', defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV('457000000000000000000', defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,   { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '9017193801740610000'), 10000000000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '2055920186796860000000'), 1000000000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '59062619401401000000'), 1000000000)

      // 27.1 * 0.995 * {20,4560,131}/4711
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '114474633835703665'), 1000000000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '26100216514540438340'), 1000000000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '749808851623859129'), 1000000000)
    })

    // --- Deposit enters at t > 0

    it("withdrawETHGainToTrove(): A, B, C Deposit -> 2 liquidations -> D deposits -> 1 liquidation. All deposits and liquidations = 100 CLV.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(2, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_3, { from: defaulter_3, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis opens a loan and provides to SP
      await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: dennis })

      // Third defaulter liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });

      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,   { from: carol })
      const txD = await poolManager.withdrawETHGainToTrove(dennis, { from: dennis })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)
      const dennis_ETHWithdrawn = th.getETHWithdrawnFromEvent(txD)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '16666666666666666666'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '16666666666666666666'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '16666666666666666666'), 1000)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '50000000000000000000'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '829166666666666667'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '829166666666666667'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '829166666666666667'), 1000)

      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '497500000000000000'), 1000)
    })

    it("withdrawETHGainToTrove(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. All deposits and liquidations = 100 CLV.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(2, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_3, { from: defaulter_3, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_4, { from: defaulter_4, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_3, { from: defaulter_3 })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis opens a loan and provides to SP
      await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: dennis })

      // Third and fourth defaulters liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });
      await cdpManager.liquidate(defaulter_4, { from: owner });

      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,   { from: carol })
      const txD = await poolManager.withdrawETHGainToTrove(dennis, { from: dennis })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)
      const dennis_ETHWithdrawn = th.getETHWithdrawnFromEvent(txD)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '0'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 15)), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 15)), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(995, 15)), 1000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, dec(995, 15)), 1000)
    })

    it("withdrawETHGainToTrove(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. Various deposit and liquidation vals.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      /* Depositors open loans and make SP deposit:
      Alice: 600 CLV
      Bob: 200 CLV
      Carol: 150 CLV
      */
      await borrowerOperations.openLoan(dec(600, 18), alice, { from: alice, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(600, 18), ZERO_ADDRESS, { from: alice })

      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: bob })

      await borrowerOperations.openLoan(dec(150, 18), carol, { from: carol, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: carol })

      /* Defaulters open loans:
      Defaulter 1:  100 CLV, 1 ETH
      Defaulter 2:  250 CLV, 2.5 ETH
      Defaulter 3:  50 CLV, 0.5 ETH
      Defaulter 4:  400 CLV, 4 ETH
      */
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: '2500000000000000000' })
      await borrowerOperations.openLoan(0,  defaulter_3, { from: defaulter_3, value: '500000000000000000' })
      await borrowerOperations.openLoan(0,  defaulter_4, { from: defaulter_4, value: dec(4, 'ether') })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(dec(240, 18), defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(dec(40, 18), defaulter_3, { from: defaulter_3 })
      await borrowerOperations.withdrawCLV(dec(390, 18), defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis opens a loan and provides 250 CLV
      await borrowerOperations.openLoan(dec(250, 18), dennis, { from: dennis, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(250, 18), ZERO_ADDRESS, { from: dennis })

      // Last two defaulters liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });
      await cdpManager.liquidate(defaulter_4, { from: owner });

      // Each depositor withdraws as much as possible
      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,   { from: carol })
      const txD = await poolManager.withdrawETHGainToTrove(dennis, { from: dennis })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)
      const dennis_ETHWithdrawn = th.getETHWithdrawnFromEvent(txD)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '178328173374613000000'), 1000000000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '59442724458204300000'), 1000000000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '44582043343653200000'), 1000000000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '117647058823529000000'), 1000000000)

      // 3.5*0.995 * {600,200,150,0} / 950 + 4.5*0.995 * {600/950*{600,200,150},250} / (1200-350)
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '4195634674922600559'), 1000000000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '1398544891640866927'), 1000000000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '1048908668730650140'), 1000000000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '1316911764705882337'), 1000000000)
    })

    // --- Depositor leaves ---

    it("withdrawETHGainToTrove(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. All deposits and liquidations = 100 CLV.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      const depositors = [alice, bob, carol, dennis]
      for (account of depositors) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(2, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_3, { from: defaulter_3, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_4, { from: defaulter_4, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_3, { from: defaulter_3 })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis withdraws his deposit and ETH gain
      const txD = await poolManager.withdrawETHGainToTrove(dennis, { from: dennis })

      const dennis_ETHWithdrawn = th.getETHWithdrawnFromEvent(txD)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '50000000000000000000'), 1000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '497500000000000000'), 1000)

      // Two more defaulters are liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });
      await cdpManager.liquidate(defaulter_4, { from: owner });

      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,  { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '0'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 15)), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 15)), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(995, 15)), 1000)
    })

    it("withdrawETHGainToTrove(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. Various deposit and liquidation vals. A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      /* Initial deposits:
      Alice: 200 CLV
      Bob: 250 CLV
      Carol: 125 CLV
      Dennis: 400 CLV
      */
      await borrowerOperations.openLoan(dec(200, 18), alice, { from: alice, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: alice })

      await borrowerOperations.openLoan(dec(250, 18), bob, { from: bob, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(250, 18), ZERO_ADDRESS, { from: bob })

      await borrowerOperations.openLoan(dec(125, 18), carol, { from: carol, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(125, 18), ZERO_ADDRESS, { from: carol })

      await borrowerOperations.openLoan(dec(400, 18), dennis, { from: dennis, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(400, 18), ZERO_ADDRESS, { from: dennis })

      /* Defaulters open loans:
      Defaulter 1: 100 CLV
      Defaulter 1: 200 CLV
      Defaulter 1: 300 CLV
      Defaulter 1: 50 CLV
      */
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(0,  defaulter_3, { from: defaulter_3, value: dec(3, 'ether') })
      await borrowerOperations.openLoan(0,  defaulter_4, { from: defaulter_4, value: '500000000000000000' })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(dec(190, 18), defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(dec(290, 18), defaulter_3, { from: defaulter_3 })
      await borrowerOperations.withdrawCLV(dec(40, 18), defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

       // Dennis withdraws his deposit and ETH gain
      const txD = await poolManager.withdrawFromSP(dec(5000, 18), { from: dennis })
      // console.log(txD.logs)
      const dennis_ETHWithdrawn = th.getETHWithdrawnFromEvent(txD)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(dennis)).toString(), '276923076923077000000'), 1000000000)
      // 3*0.995 * 400/975
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '1224615384615384661'), 1000000000)

      // Two more defaulters are liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });
      await cdpManager.liquidate(defaulter_4, { from: owner });

      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,  { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '16722408026755900000'), 100000000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '20903010033444800000'), 1000000000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '10451505016722400000'), 1000000000)

      // 3*0.995 * {200,250,125}/975 + 3.5*0.995 * {200,250,125}/575
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '1823612040133779199'), 1000000000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '2279515050167224110'), 1000000000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '1139757525083612055'), 1000000000)
    })

    // --- One deposit enters at t > 0, and another leaves later ---
    it("withdrawETHGainToTrove(): A, B, D deposit -> 2 liquidations -> C makes deposit -> 1 liquidation -> D withdraws -> 1 liquidation. All deposits: 100 CLV. Liquidations: 100,100,100,50.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      const depositors = [alice, bob, dennis]
      for (account of depositors) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(2, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open loans
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_3, { from: defaulter_3, value: dec(1, 18) })
      await borrowerOperations.openLoan(0,  defaulter_4, { from: defaulter_4, value: '500000000000000000' })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_3, { from: defaulter_3 })
      await borrowerOperations.withdrawCLV(dec(40, 18), defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Carol makes deposit
      await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: carol })

      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Dennis withdraws his deposit and ETH gain
      const txD = await poolManager.withdrawFromSP(dec(5000, 18), { from: dennis })

      const dennis_ETHWithdrawn = th.getETHWithdrawnFromEvent(txD)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(dennis)).toString(), '16666666666666666666'), 1000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '829166666666666667'), 1000)

      await cdpManager.liquidate(defaulter_4, { from: owner });

      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob,{ from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,   { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '6666666666666666666'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '6666666666666666666'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '20000000000000000000'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '928666666666666667'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '928666666666666667'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '796000000000000000'), 1000)
    })

    // --- Tests for full offset - Pool empties to 0 ---

    // A, B deposit 100
    // L1 cancels 200, 2
    // C, D deposit 100
    // L2 cancels 100,1 

    // A, B withdraw 0c & 1e
    // C, D withdraw 50c  & 0.5e
    it("withdrawETHGainToTrove(): Depositor withdraws correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      // Alice, Bob each deposit 100 CLV
      const depositors_1 = [alice, bob]
      for (account of depositors_1) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(2, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // 2 Defaulters open loan with 200% ICR
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(2, 'ether') })
      await borrowerOperations.withdrawCLV(dec(190, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated. 200 CLV fully offset with pool.
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis each deposit 100 CLV
      const depositors_2 = [carol, dennis]
      for (account of depositors_2) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(2, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 2 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // await borrowerOperations.openLoan(dec(1, 18), account, { from: erin, value: dec(2, 'ether') })
      // await poolManager.provideToSP(dec(1, 18),  ZERO_ADDRESS, { from: erin })

      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,   { from: carol })
      const txD = await poolManager.withdrawETHGainToTrove(dennis, { from: dennis })

      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)
      const dennis_ETHWithdrawn = th.getETHWithdrawnFromEvent(txD)

      // Expect Alice And Bob's compounded deposit to be 0 CLV
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '0'), 1000)

      // Expect Alice and Bob's ETH Gain to be 1 ETH *0.995
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 15)), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 15)), 1000)

      // Expect Carol And Dennis' compounded deposit to be 50 CLV
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '50000000000000000000'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '50000000000000000000'), 1000)

      // Expect Carol and and Dennis ETH Gain to be 0.5 ETH *0.995
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '497500000000000000'), 1000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '497500000000000000'), 1000)
    })

    // A, B deposit 100
    // L1 cancels 200, 2
    // C, D, E deposit 100, 200, 300
    // L2 cancels 100,1 

    // A, B withdraw 0c & 1e
    // C, D withdraw 50c  & 0.5e
    it("withdrawETHGainToTrove(): Depositors withdraw correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      // Alice, Bob each deposit 100 CLV
      const depositors_1 = [alice, bob]
      for (account of depositors_1) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(2, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // 2 Defaulters open loan with 200% ICR
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(2, 'ether') })
      await borrowerOperations.withdrawCLV(dec(190, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_2, { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated. 200 CLV fully offset with pool.
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis, Erin each deposit 100, 200, 300 CLV respectively
      await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: carol })

      await borrowerOperations.openLoan(dec(200, 18), dennis, { from: dennis, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: dennis })

      await borrowerOperations.openLoan(dec(300, 18), erin, { from: erin, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: erin })

      // Defaulter 2 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // await borrowerOperations.openLoan(dec(1, 18), account, { from: flyn, value: dec(2, 'ether') })
      // await poolManager.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: flyn })

      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,   { from: carol })
      const txD = await poolManager.withdrawETHGainToTrove(dennis, { from: dennis })
      const txE = await poolManager.withdrawETHGainToTrove(erin, { from: erin })

      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)
      const dennis_ETHWithdrawn = th.getETHWithdrawnFromEvent(txD)
      const erin_ETHWithdrawn = th.getETHWithdrawnFromEvent(txE)

      // Expect Alice And Bob's compounded deposit to be 0 CLV
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '0'), 1000)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '83333333333333333333'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '166666666666666666666'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(erin)).toString(), '250000000000000000000'), 1000)

      //Expect Alice and Bob's ETH Gain to be 1 ETH
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 15)), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 15)), 1000)

      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '165833333333333333'), 1000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '331666666666666667'), 1000)
      assert.isAtMost(th.getDifference(erin_ETHWithdrawn, '497500000000000000'), 1000)
    })

    // A deposits 100
    // L1, L2, L3 liquidated with 100 CLV each
    // A withdraws all
    // Expect A to withdraw 0 deposit and ether only from reward L1
    it("withdrawETHGainToTrove(): single deposit fully offset. After subsequent liquidations, depositor withdraws 0 deposit and *only* the ETH Gain from one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1,2,3 withdraw 'almost' 100 CLV
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_1, { from: defaulter_1 })

      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_2, { from: defaulter_2 })

      await borrowerOperations.openLoan(0,  defaulter_3, { from: defaulter_3, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_3, { from: defaulter_3 })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1, 2  and 3 liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });

      await cdpManager.liquidate(defaulter_2, { from: owner });

      await cdpManager.liquidate(defaulter_3, { from: owner });

      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)

      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), 0), 1000)
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 15)), 1000)
    })

    //--- Serial full offsets ---

    // A,B deposit 100C
    // L1 cancels 200C, 2E
    // B,C deposits 100C
    // L2 cancels 200C, 2E
    // E,F deposit 100C
    // L3 cancels 200C, 2E
    // G,H deposits 100C
    // L4 cancels 200C, 2E

    // Expect all depositors withdraw 0 CLV and 1 ETH

    it("withdrawETHGainToTrove(): Depositor withdraws correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      // 4 Defaulters open loan with 200% ICR
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(2, 'ether') })
      await borrowerOperations.withdrawCLV(dec(190, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
      await borrowerOperations.withdrawCLV(dec(190, 18), defaulter_2, { from: defaulter_2 })
      await borrowerOperations.openLoan(0,  defaulter_3, { from: defaulter_3, value: dec(2, 'ether') })
      await borrowerOperations.withdrawCLV(dec(190, 18), defaulter_3, { from: defaulter_3 })
      await borrowerOperations.openLoan(0,  defaulter_4, { from: defaulter_4, value: dec(2, 'ether') })
      await borrowerOperations.withdrawCLV(dec(190, 18), defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Alice, Bob each deposit 100 CLV
      const depositors_1 = [alice, bob]
      for (account of depositors_1) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(100, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 1 liquidated. 200 CLV fully offset with pool.
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis each deposit 100 CLV
      const depositors_2 = [carol, dennis]
      for (account of depositors_2) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(100, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 2 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Erin, Flyn each deposit 100 CLV
      const depositors_3 = [erin, flyn]
      for (account of depositors_3) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(100, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 3 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Graham, Harriet each deposit 100 CLV
      const depositors_4 = [graham, harriet]
      for (account of depositors_4) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(100, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 4 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_4, { from: owner });

      // await borrowerOperations.withdrawCLV(dec(1, 18), whale, { from: whale })
      // await poolManager.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: whale })

      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,   { from: carol })
      const txD = await poolManager.withdrawETHGainToTrove(dennis, { from: dennis })
      const txE = await poolManager.withdrawETHGainToTrove(erin, { from: erin })
      const txF = await poolManager.withdrawETHGainToTrove(flyn, { from: flyn })
      const txG = await poolManager.withdrawETHGainToTrove(graham,  { from: graham })
      const txH = await poolManager.withdrawETHGainToTrove(harriet,  { from: harriet })

      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)
      const dennis_ETHWithdrawn = th.getETHWithdrawnFromEvent(txD)
      const erin_ETHWithdrawn = th.getETHWithdrawnFromEvent(txE)
      const flyn_ETHWithdrawn = th.getETHWithdrawnFromEvent(txF)
      const graham_ETHWithdrawn = th.getETHWithdrawnFromEvent(txG)
      const harriet_ETHWithdrawn = th.getETHWithdrawnFromEvent(txH)

      // Expect all deposits to be 0 CLV
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(erin)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(flyn)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(graham)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(harriet)).toString(), '0'), 1000)

      /* Expect all ETH gains to be 1 ETH (0.995 w/ gas comp taken):  
      
      Since each liquidation of empties the pool, depositors
      should only earn ETH from the single liquidation that cancelled with their deposit */
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 15)), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 15)), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(995, 15)), 1000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, dec(995, 15)), 1000)
      assert.isAtMost(th.getDifference(erin_ETHWithdrawn, dec(995, 15)), 1000)
      assert.isAtMost(th.getDifference(flyn_ETHWithdrawn, dec(995, 15)), 1000)
      assert.isAtMost(th.getDifference(graham_ETHWithdrawn, dec(995, 15)), 1000)
      assert.isAtMost(th.getDifference(harriet_ETHWithdrawn, dec(995, 15)), 1000)
    })


    // --- Scale factor tests ---

    // A deposits 100
    // L1 brings P close to boundary, i.e. 1e-18 - 99.9999999?
    // A withdraws all
    // B deposits 100
    // L2 brings of 90, should bring P slightly past boundary i.e. 1e-18 -> 1e-19

    // expect d(B) = d0(B)/10
    // expect correct ETH gain, i.e. all of the reward
    it("withdrawETHGainToTrove(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 withdraws 'almost' 90 CLV
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV('89999999999999999000', defaulter_1, { from: defaulter_1 })

      // Defaulter 2 withdraws 80 CLV
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: '500000000000000000' })
      await borrowerOperations.withdrawCLV(dec(80, 18), defaulter_2, { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P reduced to 9.
      await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.equal((await poolManager.P()).toString(), '9')

      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })

      await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: bob })

      // Defaulter 2 liquidated.  90 CLV liquidated. P altered by a factor of (1-90/100) = 0.1.  Scale changed.
      await cdpManager.liquidate(defaulter_2, { from: owner });
 
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
     

      // Expect Bob to withdraw 10% of initial deposit (10 CLV) and all the liquidated ETH (0.5 ether)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '10000000000000000000'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '497500000000000000'), 1000)
    })


    // A deposits 100
    // L1 brings P close to boundary, i.e. 1e-18 - 99.9999999?
    // A withdraws all
    // B, C, D deposit 100, 200, 300
    // L2 brings of 90, should bring P slightly past boundary i.e. 1e-18 -> 1e-19

    // expect d(B) = d0(B)/10
    // expect correct ETH gain, i.e. all of the reward
    it("withdrawETHGainToTrove(): Several deposits of varying amounts span one scale factor change. Depositors withdraw correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 withdraws 'almost' 90 CLV.
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV('89999999999999999000', defaulter_1, { from: defaulter_1 })

      // Defaulter 2 withdraws 530 CLV
      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(3, 'ether') })
      await borrowerOperations.withdrawCLV('530000000000000000000', defaulter_2, { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P reduced to 9.
      await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.equal((await poolManager.P()).toString(), '9')

      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })

      await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: bob })

      await borrowerOperations.openLoan(dec(200, 18), carol, { from: carol, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: carol })

      await borrowerOperations.openLoan(dec(300, 18), dennis, { from: dennis, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: dennis })

      // 540 CLV liquidated.  P altered by a factor of (1-540/600) = 0.1. Scale changed.
      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)

      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,   { from: carol })
      const txD = await poolManager.withdrawETHGainToTrove(dennis, { from: dennis })

      /* Expect depositors to withdraw 10% of their initial deposit, and an ETH gain 
      in proportion to their initial deposit:
     
      Bob:  10 CLV, 0.5 Ether
      Carol:  20 CLV, 1 Ether
      Dennis:  30 CLV, 1.5 Ether
     
      Total: 60 CLV, 3 Ether
      */
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), dec(10, 18)), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), dec(20, 18)), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), dec(30, 18)), 1000)

      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)
      const dennis_ETHWithdrawn = th.getETHWithdrawnFromEvent(txD)

      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '497500000000000000'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '995000000000000000'), 1000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '1492500000000000000'), 1000)
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
    it("withdrawETHGainToTrove(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 and default 2 each withdraw 89.999999999 CLV
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV('89999999999000000000', defaulter_1, { from: defaulter_1 })

      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV('89999999999000000000', defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter 1 ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txL1 = await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)

      // Alice withdraws
      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      // Bob deposits 100 CLV
      await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: bob })
      // Defaulter 2 liquidated
      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)

      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      

      // Bob should withdraw 0 deposit, and the full ETH gain of 1 ether
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), 0), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '995000000000000000'), 1000000000)
    })

    // A make deposit 100 CLV
    // L1 brings P to (~1e-10)*P. L1:  99.999999999000000000 CLV
    // A withdraws
    // B,C D make deposit 100, 200, 300
    // L2 decreases P again by (1e-10)), over boundary. L2: 599.999999994000000000  (near to the 600 CLV total deposits)
    // B withdraws
    // expect d(B) = d0(B) * (1e-10)
    // expect B gets entire ETH gain from L2
    it("withdrawETHGainToTrove(): Several deposits of varying amounts span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: alice })

          // Defaulter 1 and default 2 withdraw 89.999999999 CLV and 58.9999999994
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV('89999999999000000000', defaulter_1, { from: defaulter_1 })

      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(6, 'ether') })
      await borrowerOperations.withdrawCLV('589999999994000000000', defaulter_2, { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txL1 = await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)

      // Alice withdraws
      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })

      // B, C, D deposit 100, 200, 300 CLV
      await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: bob })

      await borrowerOperations.openLoan(dec(200, 18), carol, { from: carol, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: carol })

      await borrowerOperations.openLoan(dec(300, 18), dennis, { from: dennis, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: dennis })

      // Defaulter 2 liquidated
      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)

      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const bob_ETHWithdrawn = await th.getETHWithdrawnFromEvent(txB)

      const txC = await poolManager.withdrawETHGainToTrove(carol,   { from: carol })
      const carol_ETHWithdrawn = await th.getETHWithdrawnFromEvent(txC)

      const txD = await poolManager.withdrawETHGainToTrove(dennis, { from: dennis })
      const dennis_ETHWithdrawn = await th.getETHWithdrawnFromEvent(txD)

      // B, C and D should withdraw 1e-10 of initial deposit, 
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '0'), 1000)

      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 15)), 100000000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(1990, 15)), 1000000000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, dec(2985, 15)), 1000000000)
    })

    // --- Serial scale changes ---

    /* A make deposit 100 CLV
    L1 brings P to (~1e-10)*P. L1:  99.999999999000000000 CLV, 1 ETH
    B makes deposit 100
    L2 decreases P by(~1e-10)P. L2:  99.999999999000000000 CLV, 1 ETH
    C makes deposit 100
    L2 decreases P by(~1e-10)P. L2:  99.999999999000000000 CLV, 1 ETH
    C makes deposit 100
    L3 decreases P by(~1e-10)P. L2:  99.999999999000000000 CLV, 1 ETH
    D makes deposit 100
    L4 decreases P by(~1e-10)P. L2:  99.999999999000000000 CLV, 1 ETH
    expect A, B, C, D each withdraw ~1e-10 CLV and ~1 Ether
    */
    it("withdrawETHGainToTrove(): Several deposits of 100 CLV span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(100, 'ether') })

      // Defaulters 1-4 each withdraw 89.999999999 CLV
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV('89999999999000000000', defaulter_1, { from: defaulter_1 })

      await borrowerOperations.openLoan(0,  defaulter_2, { from: defaulter_2, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV('89999999999000000000', defaulter_2, { from: defaulter_2 })

      await borrowerOperations.openLoan(0,  defaulter_3, { from: defaulter_3, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV('89999999999000000000', defaulter_3, { from: defaulter_3 })

      await borrowerOperations.openLoan(0,  defaulter_4, { from: defaulter_4, value: dec(1, 18) })
      await borrowerOperations.withdrawCLV('89999999999000000000', defaulter_4, { from: defaulter_4 })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txL1 = await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)

      // B deposits 100CLV
      await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: bob })

      // Defaulter 2 liquidated
      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)

      await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: carol })

      // Defaulter 3 liquidated
      const txL3 = await cdpManager.liquidate(defaulter_3, { from: owner });
      assert.isTrue(txL3.receipt.status)

      await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: dec(100, 'ether') })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: dennis })

      // Defaulter 4 liquidated
      const txL4 = await cdpManager.liquidate(defaulter_4, { from: owner });
      assert.isTrue(txL4.receipt.status)

      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })
      const txC = await poolManager.withdrawETHGainToTrove(carol,   { from: carol })
      const txD = await poolManager.withdrawETHGainToTrove(dennis, { from: dennis })

      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)
      const carol_ETHWithdrawn = th.getETHWithdrawnFromEvent(txC)
      const dennis_ETHWithdrawn = await th.getETHWithdrawnFromEvent(txD)

      // B, C and D should withdraw 1e-10 of initial deposit, 

      // TODO:  check deposit magnitudes are correct
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(alice)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(bob)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(carol)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), '0'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '995000000009950000'), 1000000000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '995000000009950000'), 1000000000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '995000000009950000'), 1000000000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '994999999970149984'), 1000000000)
    })

    // --- Extreme values, confirm no overflows ---

    it("withdrawETHGainToTrove(): Large liquidated coll/debt, deposits and ETH price", async () => {
      // Whale opens CDP with 100bn ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(1, 29) })

      // ETH:USD price is $2 billion per ETH
      await priceFeed.setPrice(dec(2, 27));
      const price = await priceFeed.getPrice()

      const depositors = [alice, bob]
      for (account of depositors) {
        await borrowerOperations.openLoan(dec(1, 36), account, { from: account, value: dec(1, 27) })
        await poolManager.provideToSP(dec(1, 36), ZERO_ADDRESS, { from: account })
      }

      // Defaulter opens loan with 200% ICR
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: dec(1, 27) })
      await borrowerOperations.withdrawCLV(await th.getActualDebtFromComposite(dec(1, 36), contracts), defaulter_1, { from: defaulter_1 })
      

      // ETH:USD price drops to $1 billion per ETH
      await priceFeed.setPrice(dec(1, 27));

      // Defaulter liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });

      const txA = await poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txB = await poolManager.withdrawETHGainToTrove(bob, { from: bob })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getETHWithdrawnFromEvent(txA)
      const bob_ETHWithdrawn =th.getETHWithdrawnFromEvent(txB)

      const aliceCLVDeposit = await poolManager.getCompoundedCLVDeposit(alice)
      const bobCLVDeposit = await poolManager.getCompoundedCLVDeposit(alice)
      
      const aliceExpectedCLVDeposit = toBN(dec(5, 35))
      const  bobExpectedCLVDeposit = toBN(dec(5, 35))
      
      const aliceDepositDiff = aliceCLVDeposit.sub(aliceExpectedCLVDeposit).abs()

      assert.isTrue(aliceDepositDiff.lte(toBN('1000000000000000000')))

      const bobDepositDiff = bobCLVDeposit.sub(bobExpectedCLVDeposit).abs()

      assert.isTrue(bobDepositDiff.lte(toBN('1000000000000000000')))

      const aliceExpectedETHGain = toBN(dec(4975, 23))
      const aliceETHDiff = aliceExpectedETHGain.sub(toBN(alice_ETHWithdrawn))

      // console.log(`alice_ETHWithdrawn: ${alice_ETHWithdrawn}`)
      // console.log(`aliceExpectedETHGain: ${aliceExpectedETHGain}`)
      // console.log(`aliceETHDiff: ${aliceETHDiff}`)

      assert.isTrue(aliceETHDiff.lte(toBN('1000000000000000000')))

      const bobExpectedETHGain = toBN(dec(4975, 23))
      const bobETHDiff = bobExpectedETHGain.sub(toBN(bob_ETHWithdrawn))

      // console.log(`bob_ETHWithdrawn: ${bob_ETHWithdrawn}`)
      // console.log(`bobExpectedETHGain: ${bobExpectedETHGain}`)
      // console.log(`bobETHDiff: ${bobETHDiff}`)

      assert.isTrue(bobETHDiff.lte(toBN('1000000000000000000')))
     })

    it("withdrawETHGainToTrove(): Tiny liquidated coll/debt, large deposits and ETH price", async () => {
      // Whale opens CDP with 100bn ETH
      await borrowerOperations.openLoan(0,  whale, { from: whale, value: dec(1, 29) })

      // ETH:USD price is $2 billion per ETH
      await priceFeed.setPrice(dec(2, 27));

      const depositors = [alice, bob]
      for (account of depositors) {
        await borrowerOperations.openLoan(dec(1, 36), account, { from: account, value: dec(1, 27) })
        await poolManager.provideToSP(dec(1, 36), ZERO_ADDRESS, { from: account })
      }

      // Defaulter opens loan with 20e-9 ETH (with minimum value of $20) and 20 CLV. 200% ICR
      await borrowerOperations.openLoan(0,  defaulter_1, { from: defaulter_1, value: '20000000000' })
      await borrowerOperations.withdrawCLV(dec(10, 18), defaulter_1, { from: defaulter_1 })

      // ETH:USD price drops to $1 billion per ETH
      await priceFeed.setPrice(dec(1, 27));

      // Defaulter liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });

      const txPromise_A = poolManager.withdrawETHGainToTrove(alice, { from: alice })
      const txPromise_B =  poolManager.withdrawETHGainToTrove(bob, { from: bob })

       // Expect ETH gain per depositor of 1e9 wei to be rounded to 0 by the ETHGainedPerUnitStaked calculation (e / D), where D is ~1e36.
      await th.assertRevert(txPromise_A, 'PoolManager: caller must have non-zero ETH Gain')
      await th.assertRevert(txPromise_B, 'PoolManager: caller must have non-zero ETH Gain')

      aliceCLVDeposit = await poolManager.getCompoundedCLVDeposit(alice)
      bobCLVDeposit = await poolManager.getCompoundedCLVDeposit(alice)
      
      aliceExpectedCLVDeposit = toBN('999999999999999990000000000000000000')
      bobExpectedCLVDeposit = toBN('999999999999999990000000000000000000')

      aliceDepositDiff = aliceCLVDeposit.sub(aliceExpectedCLVDeposit).abs()

      assert.isTrue(aliceDepositDiff.lte(toBN('1000000000000000000')))

      bobDepositDiff = bobCLVDeposit.sub(bobExpectedCLVDeposit).abs()

      assert.isTrue(bobDepositDiff.lte(toBN('1000000000000000000')))
    })
  })
})

contract('Reset chain state', async accounts => { })
