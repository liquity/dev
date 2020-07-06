const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th  = testHelpers.TestHelper
const mv = testHelpers.MoneyValues

contract('PoolManager - Withdrawal of stability deposit - Reward calculations', async accounts => {

  const [owner,
    defaulter_1,
    defaulter_2,
    defaulter_3,
    defaulter_4,
    defaulter_5,
    defaulter_6,
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
  let nameRegistry
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations

  let gasPriceInWei

  describe("Stability Pool Withdrawal", async () => {

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

    // --- Compounding tests ---

    // --- withdrawFromSP()

    // --- Identical deposits, identical liquidation amounts---
    it("withdrawFromSP(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._2_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // Defaulter opens loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_1, { from: defaulter_1 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // Defaulter liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Check depositors' compounded deposit is 66.66 CLV and ETH Gain is 0.33 ETH
      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._100e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '66666666666666666666'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '66666666666666666666'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '66666666666666666666'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '333333333333333333'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '333333333333333333'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '333333333333333333'), 1000)
    })

    it("withdrawFromSP(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two identical liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._2_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // Two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Check depositors' compounded deposit is 33.33 CLV and ETH Gain is 0.66 ETH
      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._100e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '33333333333333333333'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '33333333333333333333'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '33333333333333333333'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '666666666666666666'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '666666666666666666'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '666666666666666666'), 1000)
    })

    it("withdrawFromSP():  Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three identical liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._2_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Check depositors' compounded deposit is 0 CLV and ETH Gain is 1 ETH
      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._100e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '0'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '1000000000000000000'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '1000000000000000000'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '1000000000000000000'), 1000)
    })

    // --- Identical deposits, increasing liquidation amounts ---
    it("withdrawFromSP(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two liquidations of increasing CLV", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._2_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: '100000000000000000' })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: '200000000000000000' })
      await borrowerOperations.withdrawCLV(mv._10e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(mv._20e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // Defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Check depositors' compounded deposit is 0 CLV and ETH Gain is 1 ETH
      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._100e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '90000000000000000000'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '90000000000000000000'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '90000000000000000000'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '100000000000000000'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '100000000000000000'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '100000000000000000'), 1000)
    })

    it("withdrawFromSP(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three liquidations of increasing CLV", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._2_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: '100000000000000000' })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: '200000000000000000' })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: '300000000000000000' })
      await borrowerOperations.withdrawCLV(mv._10e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(mv._20e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(mv._30e18, defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Check depositors' compounded deposit is 80 CLV and ETH Gain is 0.2 ETH
      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._100e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '80000000000000000000'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '80000000000000000000'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '80000000000000000000'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '200000000000000000'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '200000000000000000'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '200000000000000000'), 1000)
    })

    // --- Increasing deposits, identical liquidation amounts ---
    it("withdrawFromSP(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after two identical liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      // Alice deposits 100, Bob deposits 200, Carol deposits 300 CLV
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._2_Ether })
      await poolManager.provideToSP(mv._100e18, { from: alice })

      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await poolManager.provideToSP(mv._200e18, { from: bob })

      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._2_Ether })
      await poolManager.provideToSP(mv._300e18, { from: carol })

      // 2 Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._200e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._300e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '66666666666666666666'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '133333333333333333333'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '200000000000000000000'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '333333333333333333'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '666666666666666666'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '1000000000000000000'), 1000)
    })

    it("withdrawFromSP(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three identical liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      // Alice deposits 100, Bob deposits 200, Carol deposits 300 CLV
      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._2_Ether })
      await poolManager.provideToSP(mv._100e18, { from: alice })

      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._2_Ether })
      await poolManager.provideToSP(mv._200e18, { from: bob })

      await borrowerOperations.openLoan(mv._300e18, carol, { from: carol, value: mv._2_Ether })
      await poolManager.provideToSP(mv._300e18, { from: carol })

      // Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._200e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._300e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '50000000000000000000'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '100000000000000000000'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '150000000000000000000'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '500000000000000000'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '1000000000000000000'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '1500000000000000000'), 1000)
    })

    // --- Varied depoosits and varied liquidation amount ---
    it("withdrawFromSP(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three varying liquidations", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      /* Depositors provide:-
      Alice:  20 CLV
      Bob:  4560 CLV
      Carol: 131 CLV */
      await borrowerOperations.openLoan('20000000000000000000', alice, { from: alice, value: mv._100_Ether })
      await poolManager.provideToSP('20000000000000000000', { from: alice })

      await borrowerOperations.openLoan('4560000000000000000000', bob, { from: bob, value: mv._100_Ether })
      await poolManager.provideToSP('4560000000000000000000', { from: bob })

      await borrowerOperations.openLoan('131000000000000000000', carol, { from: carol, value: mv._100_Ether })
      await poolManager.provideToSP('131000000000000000000', { from: carol })


      /* Defaulters open loans
     
      Defaulter 1: 2110 CLV & 22 ETH  
      Defaulter 2: 10 CLV & 0.1 ETH  
      Defaulter 3: 467 CLV & 5 ETH
      */
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._22_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: '100000000000000000' })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: mv._5_Ether })
      await borrowerOperations.withdrawCLV('2110000000000000000000', defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV('10000000000000000000', defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV('467000000000000000000', defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // Three defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await poolManager.withdrawFromSP(mv._5000e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._5000e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._5000e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '9017193801740610000'), 10000000000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '2055920186796860000000'), 1000000000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '59062619401401000000'), 1000000000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '115049883251961100'), 1000000000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '26231373381447700000'), 1000000000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '753576735300360000'), 1000000000)
    })

    // --- Deposit enters at t > 0

    it("withdrawFromSP(): A, B, C Deposit -> 2 liquidations -> D deposits -> 1 liquidation. All deposits and liquidations = 100 CLV.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._2_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_3, { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis opens a loan and provides to SP
      await borrowerOperations.openLoan(mv._100e18, dennis, { from: dennis, value: mv._2_Ether })
      await poolManager.provideToSP(mv._100e18, { from: dennis })

      // Third defaulter liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });

      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._100e18, { from: carol })
      const txD = await poolManager.withdrawFromSP(mv._100e18, { from: dennis })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[2].args[1].toString()

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '16666666666666666666'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '16666666666666666666'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '16666666666666666666'), 1000)

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(dennis)).toString(), '50000000000000000000'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '833333333333333333'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '833333333333333333'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '833333333333333333'), 1000)

      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '500000000000000000'), 1000)
    })

    it("withdrawFromSP(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. All deposits and liquidations = 100 CLV.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._2_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_3, { from: defaulter_3 })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis opens a loan and provides to SP
      await borrowerOperations.openLoan(mv._100e18, dennis, { from: dennis, value: mv._2_Ether })
      await poolManager.provideToSP(mv._100e18, { from: dennis })

      // Third and fourth defaulters liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });
      await cdpManager.liquidate(defaulter_4, { from: owner });

      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._100e18, { from: carol })
      const txD = await poolManager.withdrawFromSP(mv._100e18, { from: dennis })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[2].args[1].toString()

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(dennis)).toString(), '0'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, mv._1_Ether), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, mv._1_Ether), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, mv._1_Ether), 1000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, mv._1_Ether), 1000)
    })

    it("withdrawFromSP(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. Various deposit and liquidation vals.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      /* Depositors open loans and make SP deposit:
      Alice: 600 CLV
      Bob: 200 CLV
      Carol: 150 CLV
      */
      await borrowerOperations.openLoan(mv._600e18, alice, { from: alice, value: mv._100_Ether })
      await poolManager.provideToSP(mv._600e18, { from: alice })

      await borrowerOperations.openLoan(mv._200e18, bob, { from: bob, value: mv._100_Ether })
      await poolManager.provideToSP(mv._200e18, { from: bob })

      await borrowerOperations.openLoan(mv._150e18, carol, { from: carol, value: mv._100_Ether })
      await poolManager.provideToSP(mv._150e18, { from: carol })

      /* Defaulters open loans:
      Defaulter 1:  100 CLV, 1 ETH
      Defaulter 2:  250 CLV, 2.5 ETH
      Defaulter 3:  50 CLV, 0.5 ETH
      Defaulter 4:  400 CLV, 4 ETH
      */
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: '2500000000000000000' })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: '500000000000000000' })
      await borrowerOperations.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: mv._4_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(mv._250e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(mv._50e18, defaulter_3, { from: defaulter_3 })
      await borrowerOperations.withdrawCLV(mv._400e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis opens a loan and provides 250 CLV
      await borrowerOperations.openLoan(mv._250e18, dennis, { from: dennis, value: mv._100_Ether })
      await poolManager.provideToSP(mv._250e18, { from: dennis })

      // Last two defaulters liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });
      await cdpManager.liquidate(defaulter_4, { from: owner });

      // Each depositor withdraws as much as possible
      const txA = await poolManager.withdrawFromSP(mv._5000e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._5000e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._5000e18, { from: carol })
      const txD = await poolManager.withdrawFromSP(mv._5000e18, { from: dennis })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[2].args[1].toString()

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '178328173374613000000'), 1000000000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '59442724458204300000'), 1000000000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '44582043343653200000'), 1000000000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(dennis)).toString(), '117647058823529000000'), 1000000000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '4216718266253870000'), 1000000000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '1405572755417960000'), 1000000000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '1054179566563470000'), 1000000000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '1323529411764710000'), 1000000000)
    })

    // --- Depositor leaves ---

    it("withdrawFromSP(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. All deposits and liquidations = 100 CLV.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      const depositors = [alice, bob, carol, dennis]
      for (account of depositors) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._2_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_3, { from: defaulter_3 })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis withdraws his deposit and ETH gain
      const txD = await poolManager.withdrawFromSP(mv._100e18, { from: dennis })

      const dennis_ETHWithdrawn = txD.logs[2].args[1].toString()
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(dennis)).toString(), '50000000000000000000'), 1000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '500000000000000000'), 1000)

      // Two more defaulters are liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });
      await cdpManager.liquidate(defaulter_4, { from: owner });

      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._100e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '0'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, mv._1_Ether), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, mv._1_Ether), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, mv._1_Ether), 1000)
    })

    it("withdrawFromSP(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. Various deposit and liquidation vals. A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      /* Initial deposits:
      Alice: 200 CLV
      Bob: 250 CLV
      Carol: 125 CLV
      Dennis: 400 CLV
      */
      await borrowerOperations.openLoan(mv._200e18, alice, { from: alice, value: mv._100_Ether })
      await poolManager.provideToSP(mv._200e18, { from: alice })

      await borrowerOperations.openLoan(mv._250e18, bob, { from: bob, value: mv._100_Ether })
      await poolManager.provideToSP(mv._250e18, { from: bob })

      await borrowerOperations.openLoan(mv._125e18, carol, { from: carol, value: mv._100_Ether })
      await poolManager.provideToSP(mv._125e18, { from: carol })

      await borrowerOperations.openLoan(mv._400e18, dennis, { from: dennis, value: mv._100_Ether })
      await poolManager.provideToSP(mv._400e18, { from: dennis })

      /* Defaulters open loans:
      Defaulter 1: 100 CLV
      Defaulter 1: 200 CLV
      Defaulter 1: 300 CLV
      Defaulter 1: 50 CLV
      */
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._2_Ether })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: mv._3_Ether })
      await borrowerOperations.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: '500000000000000000' })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(mv._200e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(mv._300e18, defaulter_3, { from: defaulter_3 })
      await borrowerOperations.withdrawCLV(mv._50e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Dennis withdraws his deposit and ETH gain
      const txD = await poolManager.withdrawFromSP(mv._5000e18, { from: dennis })

      const dennis_ETHWithdrawn = txD.logs[2].args[1].toString()
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(dennis)).toString(), '276923076923077000000'), 1000000000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '1230769230769230000'), 1000000000)

      // Two more defaulters are liquidated
      await cdpManager.liquidate(defaulter_3, { from: owner });
      await cdpManager.liquidate(defaulter_4, { from: owner });

      const txA = await poolManager.withdrawFromSP(mv._5000e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._5000e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._5000e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '16722408026755900000'), 100000000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '20903010033444800000'), 1000000000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '10451505016722400000'), 1000000000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '1832775919732440000'), 1000000000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '2290969899665550000'), 1000000000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '1145484949832780000'), 1000000000)
    })

    // --- One deposit enters at t > 0, and another leaves later ---
    it("withdrawFromSP(): A, B, D deposit -> 2 liquidations -> C makes deposit -> 1 liquidation -> D withdraws -> 1 liquidation. All deposits: 100 CLV. Liquidations: 100,100,100,50.  A, B, C, D withdraw correct CLV deposit and ETH Gain", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      const depositors = [alice, bob, dennis]
      for (account of depositors) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._2_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // Defaulters open loans
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: mv._1_Ether })
      await borrowerOperations.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: '500000000000000000' })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_3, { from: defaulter_3 })
      await borrowerOperations.withdrawCLV(mv._50e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // First two defaulters liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Carol makes deposit
      await borrowerOperations.openLoan(mv._100e18, carol, { from: carol, value: mv._2_Ether })
      await poolManager.provideToSP(mv._100e18, { from: carol })

      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Dennis withdraws his deposit and ETH gain
      const txD = await poolManager.withdrawFromSP(mv._100e18, { from: dennis })

      const dennis_ETHWithdrawn = txD.logs[2].args[1].toString()
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(dennis)).toString(), '16666666666666666666'), 1000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '833333333333333333'), 1000)

      await cdpManager.liquidate(defaulter_4, { from: owner });

      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._100e18, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '6666666666666666666'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '6666666666666666666'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '20000000000000000000'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '933333333333333333'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '933333333333333333'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '800000000000000000'), 1000)
    })

    // --- Tests for full offset - Pool empties to 0 ---

    // A, B deposit 100
    // L1 cancels 200, 2
    // C, D deposit 100
    // L2 cancels 100,1 

    // A, B withdraw 0c & 1e
    // C, D withdraw 50c  & 0.5e
    it("withdrawFromSP(): Depositor withdraws correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      // Alice, Bob each deposit 100 CLV
      const depositors_1 = [alice, bob]
      for (account of depositors_1) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._2_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // 2 Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._2_Ether })
      await borrowerOperations.withdrawCLV(mv._200e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // Defaulter 1 liquidated. 200 CLV fully offset with pool.
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis each deposit 100 CLV
      const depositors_2 = [carol, dennis]
      for (account of depositors_2) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._2_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // Defaulter 2 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // await borrowerOperations.openLoan(mv._1e18, account, { from: erin, value: mv._2_Ether })
      // await poolManager.provideToSP(mv._1e18, { from: erin })

      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._100e18, { from: carol })
      const txD = await poolManager.withdrawFromSP(mv._100e18, { from: dennis })

      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[2].args[1].toString()

      // Expect Alice And Bob's compounded deposit to be 0 CLV
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '0'), 1000)

      // Expect Alice and Bob's ETH Gain to be 1 ETH
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, mv._1_Ether), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, mv._1_Ether), 1000)

      // Expect Carol And Dennis' compounded deposit to be 50 CLV
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '50000000000000000000'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(dennis)).toString(), '50000000000000000000'), 1000)

      // Expect Carol and and Dennis ETH Gain to be 0.5 ETH
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '500000000000000000'), 1000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '500000000000000000'), 1000)
    })

    // A, B deposit 100
    // L1 cancels 100, 1
    // L2 100, 2 empties Pool
    // C, D deposit 100
    // L3 cancels 100, 1 
    // L2 200, 2 empties Pool
    it("withdrawFromSP(): Pool-emptying liquidation increases epoch by one, resets scaleFactor to 0, and resets P to 1e18", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      // Alice, Bob each deposit 100 CLV
      const depositors_1 = [alice, bob]
      for (account of depositors_1) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._2_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // 4 Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_1, { from: defaulter_1 })

      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_2, { from: defaulter_2 })

      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_3, { from: defaulter_3 })

      await borrowerOperations.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      const epoch_0 = (await poolManager.currentEpoch()).toString()
      const scale_0 = (await poolManager.currentScale()).toString()
      const P_0 = (await poolManager.P()).toString()

      assert.equal(epoch_0, '0')
      assert.equal(scale_0, '0')
      assert.equal(P_0, mv._1e18)

      // Defaulter 1 liquidated. 100 CLV fully offset, Pool remains non-zero
      await cdpManager.liquidate(defaulter_1, { from: owner });

      //Check epoch, scale and sum
      const epoch_1 = (await poolManager.currentEpoch()).toString()
      const scale_1 = (await poolManager.currentScale()).toString()
      const P_1 = (await poolManager.P()).toString()

      assert.equal(epoch_1, '0')
      assert.equal(scale_1, '0')
      assert.isAtMost(th.getDifference(P_1, mv._5e17), 1000)

      // Defaulter 2 liquidated. 100 CLV, empties pool
      await cdpManager.liquidate(defaulter_2, { from: owner });

      //Check epoch, scale and sum
      const epoch_2 = (await poolManager.currentEpoch()).toString()
      const scale_2 = (await poolManager.currentScale()).toString()
      const P_2 = (await poolManager.P()).toString()

      assert.equal(epoch_2, '1')
      assert.equal(scale_2, '0')
      assert.equal(P_2, mv._1e18)

      // Carol, Dennis each deposit 100 CLV
      const depositors_2 = [carol, dennis]
      for (account of depositors_2) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._2_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // Defaulter 3 liquidated. 100 CLV fully offset, Pool remains non-zero
      await cdpManager.liquidate(defaulter_3, { from: owner });

     //Check epoch, scale and sum
     const epoch_3 = (await poolManager.currentEpoch()).toString()
     const scale_3 = (await poolManager.currentScale()).toString()
     const P_3 = (await poolManager.P()).toString()

     assert.equal(epoch_3, '1')
     assert.equal(scale_3, '0')
     assert.isAtMost(th.getDifference(P_3, mv._5e17), 1000)

      // Defaulter 4 liquidated. 200 CLV, empties pool
      await cdpManager.liquidate(defaulter_4, { from: owner });

      //Check epoch, scale and sum
      const epoch_4 = (await poolManager.currentEpoch()).toString()
      const scale_4 = (await poolManager.currentScale()).toString()
      const P_4 = (await poolManager.P()).toString()

      assert.equal(epoch_4, '2')
      assert.equal(scale_4, '0')
      assert.equal(P_4,  mv._1e18)
    })


    // A, B deposit 100
    // L1 cancels 200, 2
    // C, D, E deposit 100, 200, 300
    // L2 cancels 100,1 

    // A, B withdraw 0c & 1e
    // C, D withdraw 50c  & 0.5e
    it("withdrawFromSP(): Depositors withdraw correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      // Alice, Bob each deposit 100 CLV
      const depositors_1 = [alice, bob]
      for (account of depositors_1) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._2_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // 2 Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._2_Ether })
      await borrowerOperations.withdrawCLV(mv._200e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(mv._100e18);

      // Defaulter 1 liquidated. 200 CLV fully offset with pool.
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis, Erin each deposit 100, 200, 300 CLV respectively
      await borrowerOperations.openLoan(mv._100e18, carol, { from: carol, value: mv._100_Ether })
      await poolManager.provideToSP(mv._100e18, { from: carol })

      await borrowerOperations.openLoan(mv._200e18, dennis, { from: dennis, value: mv._100_Ether })
      await poolManager.provideToSP(mv._200e18, { from: dennis })

      await borrowerOperations.openLoan(mv._300e18, erin, { from: erin, value: mv._100_Ether })
      await poolManager.provideToSP(mv._300e18, { from: erin })

      // Defaulter 2 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // await borrowerOperations.openLoan(mv._1e18, account, { from: flyn, value: mv._2_Ether })
      // await poolManager.provideToSP(mv._1e18, { from: flyn })

      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._100e18, { from: carol })
      const txD = await poolManager.withdrawFromSP(mv._200e18, { from: dennis })
      const txE = await poolManager.withdrawFromSP(mv._300e18, { from: erin })

      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[2].args[1].toString()
      const erin_ETHWithdrawn = txE.logs[2].args[1].toString()

      // Expect Alice And Bob's compounded deposit to be 0 CLV
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '0'), 1000)

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '83333333333333333333'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(dennis)).toString(), '166666666666666666666'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(erin)).toString(), '250000000000000000000'), 1000)

      //Expect Alice and Bob's ETH Gain to be 1 ETH
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, mv._1_Ether), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, mv._1_Ether), 1000)

      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '166666666666666666'), 1000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '333333333333333333'), 1000)
      assert.isAtMost(th.getDifference(erin_ETHWithdrawn, '500000000000000000'), 1000)
    })

    // A deposits 100
    // L1, L2, L3 liquidated with 100 CLV each
    // A withdraws all
    // Expect A to withdraw 0 deposit and ether only from reward L1
    it("withdrawFromSP(): single deposit fully offset. After subsequent liquidations, depositor withdraws 0 deposit and *only* the ETH Gain from one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._2_Ether })
      await poolManager.provideToSP(mv._100e18, { from: alice })

      // Defaulter 1,2,3 withdraw 'almost' 100 CLV
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_1, { from: defaulter_1 })

      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_2, { from: defaulter_2 })

      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV(mv._100e18, defaulter_3, { from: defaulter_3 })

      // price drops by 50%
      await priceFeed.setPrice(mv._100e18);

      // Defaulter 1, 2  and 3 liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });

      await cdpManager.liquidate(defaulter_2, { from: owner });

      await cdpManager.liquidate(defaulter_3, { from: owner });

      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = await txA.logs[2].args[1].toString()

      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), 0), 1000)
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, mv._1_Ether), 1000)
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

    it("withdrawFromSP(): Depositor withdraws correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      // 4 Defaulters open loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._2_Ether })
      await borrowerOperations.withdrawCLV(mv._200e18, defaulter_1, { from: defaulter_1 })
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._2_Ether })
      await borrowerOperations.withdrawCLV(mv._200e18, defaulter_2, { from: defaulter_2 })
      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: mv._2_Ether })
      await borrowerOperations.withdrawCLV(mv._200e18, defaulter_3, { from: defaulter_3 })
      await borrowerOperations.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: mv._2_Ether })
      await borrowerOperations.withdrawCLV(mv._200e18, defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // Alice, Bob each deposit 100 CLV
      const depositors_1 = [alice, bob]
      for (account of depositors_1) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._100_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // Defaulter 1 liquidated. 200 CLV fully offset with pool.
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis each deposit 100 CLV
      const depositors_2 = [carol, dennis]
      for (account of depositors_2) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._100_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // Defaulter 2 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Erin, Flyn each deposit 100 CLV
      const depositors_3 = [erin, flyn]
      for (account of depositors_3) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._100_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // Defaulter 3 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Graham, Harriet each deposit 100 CLV
      const depositors_4 = [graham, harriet]
      for (account of depositors_4) {
        await borrowerOperations.openLoan(mv._100e18, account, { from: account, value: mv._100_Ether })
        await poolManager.provideToSP(mv._100e18, { from: account })
      }

      // Defaulter 4 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_4, { from: owner });

      // await borrowerOperations.withdrawCLV(mv._1e18, whale, { from: whale })
      // await poolManager.provideToSP(mv._1e18, { from: whale })

      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._100e18, { from: carol })
      const txD = await poolManager.withdrawFromSP(mv._100e18, { from: dennis })
      const txE = await poolManager.withdrawFromSP(mv._100e18, { from: erin })
      const txF = await poolManager.withdrawFromSP(mv._100e18, { from: flyn })
      const txG = await poolManager.withdrawFromSP(mv._100e18, { from: graham })
      const txH = await poolManager.withdrawFromSP(mv._100e18, { from: harriet })

      const alice_ETHWithdrawn = txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = txC.logs[2].args[1].toString()
      const dennis_ETHWithdrawn = txD.logs[2].args[1].toString()
      const erin_ETHWithdrawn = txE.logs[2].args[1].toString()
      const flyn_ETHWithdrawn = txF.logs[2].args[1].toString()
      const graham_ETHWithdrawn = txG.logs[2].args[1].toString()
      const harriet_ETHWithdrawn = txH.logs[2].args[1].toString()

      // Expect all deposits to be 0 CLV
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(dennis)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(erin)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(flyn)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(graham)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(harriet)).toString(), '0'), 1000)

      /* Expect all ETH gains to be 1 ETH:  Since each liquidation of empties the pool, depositors
      should only earn ETH from the single liquidation that cancelled with their deposit */
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, mv._1_Ether), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, mv._1_Ether), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, mv._1_Ether), 1000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, mv._1_Ether), 1000)
      assert.isAtMost(th.getDifference(erin_ETHWithdrawn, mv._1_Ether), 1000)
      assert.isAtMost(th.getDifference(flyn_ETHWithdrawn, mv._1_Ether), 1000)
      assert.isAtMost(th.getDifference(graham_ETHWithdrawn, mv._1_Ether), 1000)
      assert.isAtMost(th.getDifference(harriet_ETHWithdrawn, mv._1_Ether), 1000)

      const finalEpoch = (await poolManager.currentEpoch()).toString()
      assert.equal(finalEpoch, 4)
    })

    // --- Scale factor tests ---

    // A deposits 100
    // L1 brings P close to boundary, i.e. 1e-18 - 99.9999999?
    // A withdraws all
    // B deposits 100
    // L2 of 90 CLV, should bring P slightly past boundary i.e. 1e-18 -> 1e-19

    // expect d(B) = d0(B)/10
    // expect correct ETH gain, i.e. all of the reward
    it("withdrawFromSP(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._2_Ether })
      await poolManager.provideToSP(mv._100e18, { from: alice })

      // Defaulter 1 withdraws 'almost' 100 CLV
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999999999000', defaulter_1, { from: defaulter_1 })

      // Defaulter 2 withdraws 90 CLV
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: '500000000000000000' })
      await borrowerOperations.withdrawCLV(mv._90e18, defaulter_2, { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(mv._100e18);

      // Defaulter 1 liquidated.  Value of P reduced to 9.
      await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.equal((await poolManager.P()).toString(), '9')

      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = await txA.logs[2].args[1].toString()

      await borrowerOperations.openLoan(mv._100e18, bob, { from: bob, value: mv._2_Ether })
      await poolManager.provideToSP(mv._100e18, { from: bob })

      // Defaulter 2 liquidated.  90 CLV liquidated. P altered by a factor of (1-90/100) = 0.1.  Scale changed.
      await cdpManager.liquidate(defaulter_2, { from: owner });

      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const bob_ETHWithdrawn = await txB.logs[2].args[1].toString()

      // Expect Bob to withdraw 10% of initial deposit (10 CLV) and all the liquidated ETH (0.5 ether)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '10000000000000000000'), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '500000000000000000'), 1000)
    })

    // A deposits 100
    // L1 brings P close to boundary, i.e. 1e-18 - 99.9999999?
    // A withdraws all
    // B, C, D deposit 100, 200, 300
    // L2 brings of 90, should bring P slightly past boundary i.e. 1e-18 -> 1e-19

    // expect d(B) = d0(B)/10
    // expect correct ETH gain, i.e. all of the reward
    it("withdrawFromSP(): Several deposits of varying amounts span one scale factor change. Depositors withdraw correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._2_Ether })
      await poolManager.provideToSP(mv._100e18, { from: alice })

      // Defaulter 1 withdraws 'almost' 100 CLV.
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999999999000', defaulter_1, { from: defaulter_1 })

      // Defaulter 2 withdraws 540 CLV
      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._3_Ether })
      await borrowerOperations.withdrawCLV('540000000000000000000', defaulter_2, { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(mv._100e18);

      // Defaulter 1 liquidated.  Value of P reduced to 9.
      await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.equal((await poolManager.P()).toString(), '9')

      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })

      await borrowerOperations.openLoan(mv._100e18, bob, { from: bob, value: mv._100_Ether })
      await poolManager.provideToSP(mv._100e18, { from: bob })

      await borrowerOperations.openLoan(mv._200e18, carol, { from: carol, value: mv._100_Ether })
      await poolManager.provideToSP(mv._200e18, { from: carol })

      await borrowerOperations.openLoan(mv._300e18, dennis, { from: dennis, value: mv._100_Ether })
      await poolManager.provideToSP(mv._300e18, { from: dennis })

      // 540 CLV liquidated.  P altered by a factor of (1-540/600) = 0.1. Scale changed.
      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)

      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._200e18, { from: carol })
      const txD = await poolManager.withdrawFromSP(mv._300e18, { from: dennis })

      /* Expect depositors to withdraw 10% of their initial deposit, and an ETH gain 
      in proportion to their initial deposit:
     
      Bob:  10 CLV, 0.5 Ether
      Carol:  20 CLV, 1 Ether
      Dennis:  30 CLV, 1.5 Ether
     
      Total: 60 CLV, 3 Ether
      */
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), mv._10e18), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), mv._20e18), 1000)
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(dennis)).toString(), mv._30e18), 1000)

      const bob_ETHWithdrawn = await txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = await txC.logs[2].args[1].toString()
      const dennis_ETHWithdrawn = await txD.logs[2].args[1].toString()

      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '500000000000000000'), 1000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '1000000000000000000'), 1000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '1500000000000000000'), 1000)
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
    it("withdrawFromSP(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._2_Ether })
      await poolManager.provideToSP(mv._100e18, { from: alice })

      // Defaulter 1 and default 2 each withdraw 99.999999999 CLV
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_1, { from: defaulter_1 })

      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_2, { from: defaulter_2 })

      // price drops by 50%: defaulter 1 ICR falls to 100%
      await priceFeed.setPrice(mv._100e18);

      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txL1 = await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)
  
      // Alice withdraws
      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      // Bob deposits 100 CLV
      await borrowerOperations.openLoan(mv._100e18, bob, { from: bob, value: mv._2_Ether })
      await poolManager.provideToSP(mv._100e18, { from: bob })
      // Defaulter 2 liquidated
      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)
     
      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const bob_ETHWithdrawn = await txB.logs[2].args[1].toString()

      // Bob should withdraw 0 deposit, and the full ETH gain of 1 ether
      assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), 0), 1000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '1000000000000000000'), 1000000000)
    })

    // A make deposit 100 CLV
    // L1 brings P to (~1e-10)*P. L1:  99.999999999000000000 CLV
    // A withdraws
    // B,C D make deposit 100, 200, 300
    // L2 decreases P again by (1e-10)), over boundary. L2: 599.999999994000000000  (near to the 600 CLV total deposits)
    // B withdraws
    // expect d(B) = d0(B) * (1e-10)
    // expect B gets entire ETH gain from L2
    it("withdrawFromSP(): Several deposits of varying amounts span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._2_Ether })
      await poolManager.provideToSP(mv._100e18, { from: alice })

      // Defaulter 1 and default 2 each withdraw 99.999999999 CLV
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_1, { from: defaulter_1 })

      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._6_Ether })
      await borrowerOperations.withdrawCLV('599999999994000000000', defaulter_2, { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(mv._100e18);

      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txL1 = await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)

      // Alice withdraws
      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })

      // B, C, D deposit 100, 200, 300 CLV
      await borrowerOperations.openLoan(mv._100e18, bob, { from: bob, value: mv._100_Ether })
      await poolManager.provideToSP(mv._100e18, { from: bob })

      await borrowerOperations.openLoan(mv._200e18, carol, { from: carol, value: mv._100_Ether })
      await poolManager.provideToSP(mv._200e18, { from: carol })

      await borrowerOperations.openLoan(mv._300e18, dennis, { from: dennis, value: mv._100_Ether })
      await poolManager.provideToSP(mv._300e18, { from: dennis })

      // Defaulter 2 liquidated
      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)

      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const bob_ETHWithdrawn = await txB.logs[2].args[1].toString()

      const txC = await poolManager.withdrawFromSP(mv._200e18, { from: carol })
      const carol_ETHWithdrawn = await txC.logs[2].args[1].toString()

      const txD = await poolManager.withdrawFromSP(mv._300e18, { from: dennis })
      const dennis_ETHWithdrawn = await txD.logs[2].args[1].toString()

      // B, C and D should have a compounded deposit of 1e-10 of initial deposit, which the system rounds down to 0
     assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '0' ), 1000)
     assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '0' ), 1000)
     assert.isAtMost(th.getDifference((await clvToken.balanceOf(dennis)).toString(), '0'), 1000)

     assert.isAtMost(th.getDifference(bob_ETHWithdrawn, mv._1_Ether), 100000000)
     assert.isAtMost(th.getDifference(carol_ETHWithdrawn, mv._2_Ether), 1000000000)
     assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, mv._3_Ether), 1000000000)
    })
 
    // A make deposit 100 CLV
    // L1 brings P to (~1e-10)*P. L1:  99.999999999000000000 CLV
    // Expect A to withdraw 0 deposit
    it("withdrawFromSP(): Deposit that decreases to less than 1e-9 of it's original value is reduced to 0", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      // Defaulters 1 withdraws 99.999999999 CLV
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_1, { from: defaulter_1 })

      // price drops by 50%
      await priceFeed.setPrice(mv._100e18);

      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._100_Ether })
      await poolManager.provideToSP(mv._100e18, { from: alice })

      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txL1 = await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)

      const aliceDeposit = (await poolManager.getCompoundedCLVDeposit(alice)).toString()
      assert.equal(aliceDeposit, 0)
    })

    // --- Serial scale changes ---

    /* A make deposit 100 CLV
    L1 brings P to (~1e-10)*P. L1:  99.999999999000000000 CLV, 1 ETH
    B makes deposit 100
    L2 decreases P by(~1e-10)P. L2:  99.999999999000000000 CLV, 1 ETH
    C makes deposit 100
    L3 decreases P by(~1e-10)P. L3:  99.999999999000000000 CLV, 1 ETH
    D makes deposit 100
    L4 decreases P by(~1e-10)P. L4:  99.999999999000000000 CLV, 1 ETH
    expect A, B, C, D each withdraw ~1 Ether
    */
    it("withdrawFromSP(): Several deposits of varying amounts span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

      // Defaulters 1-4 each withdraw 99.999999999 CLV
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_1, { from: defaulter_1 })

      await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_2, { from: defaulter_2 })

      await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_3, { from: defaulter_3 })

      await borrowerOperations.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: mv._1_Ether })
      await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_4, { from: defaulter_4 })

      // price drops by 50%
      await priceFeed.setPrice(mv._100e18);

      await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._100_Ether })
      await poolManager.provideToSP(mv._100e18, { from: alice })

      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txL1 = await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)

      // B deposits 100CLV
      await borrowerOperations.openLoan(mv._100e18, bob, { from: bob, value: mv._100_Ether })
      await poolManager.provideToSP(mv._100e18, { from: bob })

      // Defaulter 2 liquidated
      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)

      await borrowerOperations.openLoan(mv._100e18, carol, { from: carol, value: mv._100_Ether })
      await poolManager.provideToSP(mv._100e18, { from: carol })

      // Defaulter 3 liquidated
      const txL3 = await cdpManager.liquidate(defaulter_3, { from: owner });
      assert.isTrue(txL3.receipt.status)

      await borrowerOperations.openLoan(mv._100e18, dennis, { from: dennis, value: mv._100_Ether })
      await poolManager.provideToSP(mv._100e18, { from: dennis })

      // Defaulter 4 liquidated
      const txL4 = await cdpManager.liquidate(defaulter_4, { from: owner });
      assert.isTrue(txL4.receipt.status)

      const txA = await poolManager.withdrawFromSP(mv._100e18, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._100e18, { from: bob })
      const txC = await poolManager.withdrawFromSP(mv._100e18, { from: carol })
      const txD = await poolManager.withdrawFromSP(mv._100e18, { from: dennis })

      const alice_ETHWithdrawn = await txA.logs[2].args[1].toString()
      const bob_ETHWithdrawn = await txB.logs[2].args[1].toString()
      const carol_ETHWithdrawn = await txC.logs[2].args[1].toString()
      const dennis_ETHWithdrawn = await txD.logs[2].args[1].toString()

      // B, C and D should withdraw 1e-10 of initial deposit, 

      // TODO:  check deposit magnitudes are correct
     assert.isAtMost(th.getDifference((await clvToken.balanceOf(alice)).toString(), '0'), 1000)
     assert.isAtMost(th.getDifference((await clvToken.balanceOf(bob)).toString(), '0'), 1000)
     assert.isAtMost(th.getDifference((await clvToken.balanceOf(carol)).toString(), '0'), 1000)
     assert.isAtMost(th.getDifference((await clvToken.balanceOf(dennis)).toString(), '0'), 1000)

     assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '1000000000010000000'), 1000000000)
     assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '1000000000010000000'), 1000000000)
     assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '1000000000010000000'), 1000000000)
     assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '999999999970000000'), 1000000000)
    })


   it("withdrawFromSP(): Depositor's ETH gain stops increasing after two scale changes", async () => {
    // Whale opens CDP with 100 ETH
    await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._1billion_Ether })

    // Defaulters 1-4 each withdraw 99.999999999 CLV
    await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1_Ether })
    await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_1, { from: defaulter_1 })

    await borrowerOperations.addColl(defaulter_2, defaulter_2, { from: defaulter_2, value: mv._1_Ether })
    await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_2, { from: defaulter_2 })

    await borrowerOperations.addColl(defaulter_3, defaulter_3, { from: defaulter_3, value: mv._1_Ether })
    await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_3, { from: defaulter_3 })

    await borrowerOperations.addColl(defaulter_4, defaulter_4, { from: defaulter_4, value: mv._1_Ether })
    await borrowerOperations.withdrawCLV('99999999999000000000', defaulter_4, { from: defaulter_4 })

    await borrowerOperations.addColl(defaulter_5, defaulter_5, { from: defaulter_5, value: mv._100_Ether })
    await borrowerOperations.withdrawCLV(mv._1e22, defaulter_5, { from: defaulter_5 })

    await borrowerOperations.addColl(defaulter_6, defaulter_6, { from: defaulter_6, value: mv._100_Ether })
    await borrowerOperations.withdrawCLV(mv._1e22, defaulter_6, { from: defaulter_6 })

    // price drops by 50%
    await priceFeed.setPrice(mv._100e18);

    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._100_Ether })
    await poolManager.provideToSP(mv._100e18, { from: alice })

  
    // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
    const txL1 = await cdpManager.liquidate(defaulter_1, { from: owner });
    assert.isTrue(txL1.receipt.status)

    // B deposits 100CLV
    await borrowerOperations.openLoan(mv._100e18, bob, { from: bob, value: mv._100_Ether })
    await poolManager.provideToSP(mv._100e18, { from: bob })

    // Defaulter 2 liquidated
    const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
    assert.isTrue(txL2.receipt.status)

    await borrowerOperations.openLoan(mv._100e18, carol, { from: carol, value: mv._100_Ether })
    await poolManager.provideToSP(mv._100e18, { from: carol })

    // Defaulter 3 liquidated
    const txL3 = await cdpManager.liquidate(defaulter_3, { from: owner });
    assert.isTrue(txL3.receipt.status)

    const alice_ETHGainBefore2ndScaleChange = (await poolManager.getCurrentETHGain(alice)).toString()
    const scale_Before =  (await poolManager.currentScale()).toString()

    await borrowerOperations.openLoan(mv._100e18, dennis, { from: dennis, value: mv._100_Ether })
    await poolManager.provideToSP(mv._100e18, { from: dennis })

    // Defaulter 4 liquidated
    const txL4 = await cdpManager.liquidate(defaulter_4, { from: owner });
    assert.isTrue(txL4.receipt.status)

    const alice_ETHGainAfter2ndScaleChange = (await poolManager.getCurrentETHGain(alice)).toString()
    const scale_After = (await poolManager.currentScale()).toString()

    const alice_scaleSnapshot = (await poolManager.snapshot(alice))[2].toString()

    assert.equal(alice_scaleSnapshot, '0')
    assert.equal(scale_Before, '1')
    assert.equal(scale_After, '2')
    assert.equal(alice_ETHGainBefore2ndScaleChange, alice_ETHGainAfter2ndScaleChange)
  })

    // --- Extreme values, confirm no overflows ---

    it("withdrawFromSP(): Large liquidated coll/debt, deposits and ETH price", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100billion_Ether })

      // ETH:USD price is $2 billion per ETH
      await priceFeed.setPrice(mv._2e27);
      const price = await priceFeed.getPrice()

      const depositors = [alice, bob]
      for (account of depositors) {
        await borrowerOperations.openLoan(mv._1e36, account, { from: account, value: mv._1billion_Ether })
        await poolManager.provideToSP(mv._1e36, { from: account })
      }

      // Defaulter opens loan with 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: mv._1billion_Ether })
      await borrowerOperations.withdrawCLV(mv._1e36, defaulter_1, { from: defaulter_1 })

      // ETH:USD price drops to $1 billion per ETH
      await priceFeed.setPrice(mv._1e27);

      // Defaulter liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });

      const txA = await poolManager.withdrawFromSP(mv._1e36, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._1e36, { from: bob })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = txA.logs[2].args[1]
      const bob_ETHWithdrawn = txB.logs[2].args[1]

      aliceBalance = await clvToken.balanceOf(alice)
      aliceExpectedBalance = web3.utils.toBN(mv._5e35)
      aliceBalDiff = aliceBalance.sub(aliceExpectedBalance).abs()
     
      assert.isTrue(aliceBalDiff.lte(web3.utils.toBN('1000000000000000000')))

      bobBalance = await clvToken.balanceOf(bob)
      bobExpectedBalance = web3.utils.toBN(mv._5e35)
      bobBalDiff = bobBalance.sub(bobExpectedBalance).abs()
     
      assert.isTrue(bobBalDiff.lte(web3.utils.toBN('1000000000000000000')))

      aliceExpectedETHGain = web3.utils.toBN(mv._500million_Ether)
      aliceETHDiff = aliceExpectedETHGain.sub(alice_ETHWithdrawn)
     
      assert.isTrue(aliceETHDiff.lte(web3.utils.toBN('1000000000000000000')))

      bobExpectedETHGain = web3.utils.toBN(mv._500million_Ether)
      bobETHDiff = bobExpectedETHGain.sub(bob_ETHWithdrawn)
     
      assert.isTrue(bobETHDiff.lte(web3.utils.toBN('1000000000000000000')))
  
    //  assert.isAtMost(th.getDifference(alice_ETHWithdrawn, mv._500million_Ether), web3.utils.toBN('1000000000000000000'))
    //  assert.isAtMost(th.getDifference(bob_ETHWithdrawn, mv._500million_Ether), web3.utils.toBN('1000000000000000000'))
    })

    it("withdrawFromSP(): Tiny liquidated coll/debt, large deposits and ETH price", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100billion_Ether })

      // ETH:USD price is $2 billion per ETH
      await priceFeed.setPrice(mv._2e27);
      const price = await priceFeed.getPrice()

      const depositors = [alice, bob]
      for (account of depositors) {
        await borrowerOperations.openLoan(mv._1e36, account, { from: account, value: mv._1billion_Ether })
        await poolManager.provideToSP(mv._1e36, { from: account })
      }

      // Defaulter opens loan with 20e-9 ETH (with minimum value of $20) and 20 CLV. 200% ICR
      await borrowerOperations.addColl(defaulter_1, defaulter_1, { from: defaulter_1, value: '20000000000' })
      await borrowerOperations.withdrawCLV(mv._20e18, defaulter_1, { from: defaulter_1 })

      // ETH:USD price drops to $1 billion per ETH
      await priceFeed.setPrice(mv._1e27);

      // Defaulter liquidated
      await cdpManager.liquidate(defaulter_1, { from: owner });

      const txA = await poolManager.withdrawFromSP(mv._1e36, { from: alice })
      const txB = await poolManager.withdrawFromSP(mv._1e36, { from: bob })

      const alice_ETHWithdrawn = txA.logs[2].args[1]
      const bob_ETHWithdrawn = txB.logs[2].args[1]

      aliceBalance = await clvToken.balanceOf(alice)
      aliceExpectedBalance = web3.utils.toBN('999999999999999990000000000000000000')
      aliceBalDiff = aliceBalance.sub(aliceExpectedBalance).abs()
     
      assert.isTrue(aliceBalDiff.lte(web3.utils.toBN('1000000000000000000')))

      bobBalance = await clvToken.balanceOf(bob)
      bobExpectedBalance = web3.utils.toBN('999999999999999990000000000000000000')
      bobBalDiff = bobBalance.sub(bobExpectedBalance).abs()
     
      assert.isTrue(bobBalDiff.lte(web3.utils.toBN('1000000000000000000')))

      // Expect ETH gain per depositor of 1e9 wei to be rounded to 0 by the ETHGainedPerUnitStaked calculation (e / D), where D is ~1e36.
       assert.equal(alice_ETHWithdrawn.toString(), '0')
       assert.equal(bob_ETHWithdrawn.toString(), '0')
    })
  })
})

contract('Reset chain state', async accounts => { })