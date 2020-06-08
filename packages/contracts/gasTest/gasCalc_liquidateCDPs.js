/* Script that logs gas costs for Liquity operations under various conditions. 

  Note: uses Mocha testing structure, but simply prints gas costs of transactions. No assertions.
*/
const fs = require('fs')

const ABDKMath64x64 = artifacts.require("./ABDKMath64x64.sol")
const DeciMath = artifacts.require("./DeciMath.sol")
const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const mv = testHelpers.MoneyValues
const th = testHelpers.TestHelper

contract('Gas cost tests', async accounts => {
  const [owner] = accounts;
 
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

  let data = []

  before(async () => {
    const deciMath = await DeciMath.new()
    const abdkMath = await ABDKMath64x64.new()
    DeciMath.setAsDeployed(deciMath)
    ABDKMath64x64.setAsDeployed(abdkMath)
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

  // --- TESTS ---

  // --- liquidateCDPs() -  pure redistributions ---

  // 1 trove
  it("", async () => {
    const message = 'liquidateCDPs(). n = 1. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(2,12), borrowerOperations, mv._10_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(2,12), borrowerOperations, mv._180e18)

    //1 acct open CDP with 1 ether and withdraws 180 CLV
    await th.addColl_allAccounts([accounts[1]], borrowerOperations,mv._1_Ether)
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[1], {from: accounts[1]} )

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.liquidateCDPs(1, { from: accounts[0]})
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 2 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 2. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(3,13), borrowerOperations, mv._10_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(3,13), borrowerOperations, mv._180e18)

    //2 accts open CDP with 1 ether and withdraw 180 CLV
    await th.addColl_allAccounts([accounts[1]], borrowerOperations, mv._1_Ether)
    await th.addColl_allAccounts([accounts[2]], borrowerOperations, mv._1_Ether)
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[1], {from: accounts[1]} )
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[2], {from: accounts[2]} )

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0]})
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 3 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 3. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(4,14), borrowerOperations, mv._10_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(4,14), borrowerOperations, mv._180e18)

    //3 accts open CDP with 1 ether and withdraw 180 CLV
    await th.addColl_allAccounts(accounts.slice(1,4), borrowerOperations,mv._1_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(1,4), borrowerOperations, mv._180e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0]})
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 10 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 10. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(12,22), borrowerOperations, mv._10_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(12,22), borrowerOperations, mv._180e18)

    //10 accts open CDP with 1 ether and withdraw 180 CLV
    await th.addColl_allAccounts(accounts.slice(1,12), borrowerOperations,mv._1_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(1,12), borrowerOperations, mv._180e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // // Initial liquidation to make reward terms / Pool quantities non-zero
    // await cdpManager.liquidate(accounts[11])

    const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0]})
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 30 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 30. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(31,61), borrowerOperations, mv._100_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(31,61), borrowerOperations, mv._180e18)

    //30 accts open CDP with 1 ether and withdraw 180 CLV
    await th.addColl_allAccounts(accounts.slice(1,31), borrowerOperations,mv._1_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(1,31), borrowerOperations, mv._180e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check all accounts have CDPs
    for (account of (accounts.slice(1,31))) {
      assert.isTrue(await sortedCDPs.contains(account))
    }

    const tx = await cdpManager.liquidateCDPs(30, { from: accounts[0]})

    // Check all accounts have been closed
    for (account of (accounts.slice(1,31))) {
      assert.isFalse(await sortedCDPs.contains(account))
    }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 50 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 50. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(52,102), borrowerOperations, mv._100_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(52,102), borrowerOperations, mv._180e18)

    //30 accts open CDP with 1 ether and withdraw 180 CLV
    await th.addColl_allAccounts(accounts.slice(1,52), borrowerOperations,mv._1_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(1,52), borrowerOperations, mv._180e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Initial liquidation to make reward terms / Pool quantities non-zero
    await cdpManager.liquidate(accounts[51])

    for (account of (accounts.slice(1,51))) {
      assert.isTrue(await sortedCDPs.contains(account))
    }
    const tx = await cdpManager.liquidateCDPs(50, { from: accounts[0]})

    for (account of (accounts.slice(1,51))) {
      assert.isFalse(await sortedCDPs.contains(account))
    }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 100 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 100. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(101,201), borrowerOperations, mv._100_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(101,201), borrowerOperations, mv._180e18)

    //30 accts open CDP with 1 ether and withdraw 180 CLV
    await th.addColl_allAccounts(accounts.slice(1,101), borrowerOperations,mv._1_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(1,101), borrowerOperations, mv._180e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check CDPs are active
    for (account of (accounts.slice(1,101))) {
      assert.isTrue(await sortedCDPs.contains(account))
    }

    const tx = await cdpManager.liquidateCDPs(100, { from: accounts[0]})

    // Check CDPs are now closed
    for (account of (accounts.slice(1,101))) {
      assert.isFalse(await sortedCDPs.contains(account))
    }

    const gas = th.gasUsed(tx)

    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // --- liquidate CDPs - all troves offset by Stability Pool - No pending distribution rewards ---

  // 1 trove
  it("", async () => {
    const message = 'liquidateCDPs(). n = 1. All fully offset with Stability Pool. No pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(2,12), borrowerOperations, mv._10_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(2,12), borrowerOperations, mv._180e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], {from:accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP( mv._1e27, {from:accounts[999]})

    //1 acct open CDP with 1 ether and withdraws 180 CLV
    await th.addColl_allAccounts([accounts[1]], borrowerOperations,mv._1_Ether)
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[1], {from: accounts[1]} )

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.liquidateCDPs(1, { from: accounts[0]})
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 2 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 2. All fully offset with Stability Pool. No pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(3,13), borrowerOperations, mv._10_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(3,13), borrowerOperations, mv._180e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], {from:accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP( mv._1e27, {from:accounts[999]})

    //2 accts open CDP with 1 ether and withdraw 180 CLV
    await th.addColl_allAccounts([accounts[1]], borrowerOperations,mv._1_Ether)
    await th.addColl_allAccounts([accounts[2]], borrowerOperations,mv._1_Ether)
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[1], {from: accounts[1]} )
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[2], {from: accounts[2]} )

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.liquidateCDPs(2, { from: accounts[0]})
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 3 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 3. All fully offset with Stability Pool. No pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(4,14), borrowerOperations, mv._10_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(4,14), borrowerOperations, mv._180e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], {from:accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP( mv._1e27, {from:accounts[999]})

    //3 accts open CDP with 1 ether and withdraw 180 CLV
    await th.addColl_allAccounts(accounts.slice(1,4), borrowerOperations,mv._1_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(1,4), borrowerOperations, mv._180e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.liquidateCDPs(3, { from: accounts[0]})
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 10 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 10. All fully offset with Stability Pool. No pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(11,21), borrowerOperations, mv._10_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(11,21), borrowerOperations, mv._180e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], {from:accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP( mv._1e27, {from:accounts[999]})

    //10 accts open CDP with 1 ether and withdraw 180 CLV
    await th.addColl_allAccounts(accounts.slice(1,11), borrowerOperations,mv._1_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(1,11), borrowerOperations, mv._180e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0]})
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 30 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 30. All fully offset with Stability Pool. No pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(31,61), borrowerOperations, mv._100_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(31,61), borrowerOperations, mv._180e18)

    // Whale opens loan and fills SP with 1 billion CLV
   await borrowerOperations.openLoan(mv._1e27, accounts[999], {from:accounts[999], value: mv._1billion_Ether })
   await poolManager.provideToSP( mv._1e27, {from:accounts[999]})

    //50 accts open CDP with 1 ether and withdraw 180 CLV
    await th.addColl_allAccounts(accounts.slice(1,31), borrowerOperations,mv._1_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(1,31), borrowerOperations, mv._180e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

     // Check CDPs are active
     for (account of (accounts.slice(1,31))) {
      assert.isTrue(await sortedCDPs.contains(account))
    }
    const tx = await cdpManager.liquidateCDPs(30, { from: accounts[0]})

     // Check CDPs are closed
     for (account of (accounts.slice(1,31))) {
      assert.isFalse(await sortedCDPs.contains(account))
    }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 50 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 50. All fully offset with Stability Pool. No pending distribution rewards.'

    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(51,101), borrowerOperations, mv._100_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(51,101), borrowerOperations, mv._180e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], {from:accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP( mv._1e27, {from:accounts[999]})

    //50 accts open CDP with 1 ether and withdraw 180 CLV
    await th.addColl_allAccounts(accounts.slice(1,51), borrowerOperations,mv._1_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(1,51), borrowerOperations, mv._180e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

     // Check CDPs are active
     for (account of (accounts.slice(1,51))) {
      assert.isTrue(await sortedCDPs.contains(account))
    }
    const tx = await cdpManager.liquidateCDPs(50, { from: accounts[0]})

     // Check CDPs are closed
     for (account of (accounts.slice(1,51))) {
      assert.isFalse(await sortedCDPs.contains(account))
    }
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 100 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 100. All fully offset with Stability Pool. No pending distribution rewards.'

    // 100 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(101,201), borrowerOperations, mv._100_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(101,201), borrowerOperations, mv._180e18)

   // Whale opens loan and fills SP with 1 billion CLV
   await borrowerOperations.openLoan(mv._1e27, accounts[999], {from:accounts[999], value: mv._1billion_Ether })
   await poolManager.provideToSP( mv._1e27, {from:accounts[999]})

    //50 accts open CDP with 1 ether and withdraw 180 CLV
    await th.addColl_allAccounts(accounts.slice(1,101), borrowerOperations,mv._1_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(1,101), borrowerOperations, mv._180e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

     // Check CDPs are active
     for (account of (accounts.slice(1,101))) {
      assert.isTrue(await sortedCDPs.contains(account))
    }
    const tx = await cdpManager.liquidateCDPs(100, { from: accounts[0]})

     // Check CDPs are active
     for (account of (accounts.slice(1,101))) {
      assert.isFalse(await sortedCDPs.contains(account))
    }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // --- liquidate CDPs - all troves offset by Stability Pool - Has pending distribution rewards ---

  // 1 trove
  it("", async () => {0
    const message = 'liquidateCDPs(). n = 1. All fully offset with Stability Pool. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(101,111), borrowerOperations, mv._10_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(101,111), borrowerOperations, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], {from:accounts[500], value: mv._1_Ether })

     // --- Accounts to be liquidated in the test tx ---
    await th.addColl_allAccounts([accounts[1]], borrowerOperations,mv._1_Ether)
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[1], {from: accounts[1]} )

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500],{ from: accounts[0]})
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], {from:accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP( mv._1e27, {from:accounts[999]})

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.liquidateCDPs(1, { from: accounts[0]})
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })
   // 2 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 2. All fully offset with Stability Pool. Have pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(101,111), borrowerOperations, mv._10_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(101,111), borrowerOperations, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], {from:accounts[500], value: mv._1_Ether })

     // --- 2 Accounts to be liquidated in the test tx --
    await th.addColl_allAccounts(accounts.slice(1,3), borrowerOperations,mv._1_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(1,3), borrowerOperations, mv._180e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500],{ from: accounts[0]})
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], {from:accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP( mv._1e27, {from:accounts[999]})

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.liquidateCDPs(2, { from: accounts[0]})
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 3 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 3. All fully offset with Stability Pool. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(101,111), borrowerOperations, mv._10_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(101,111), borrowerOperations, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], {from:accounts[500], value: mv._1_Ether })

     // --- 3 Accounts to be liquidated in the test tx --
    await th.addColl_allAccounts(accounts.slice(1,4), borrowerOperations,mv._1_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(1,4), borrowerOperations, mv._180e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500],{ from: accounts[0]})
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], {from:accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP( mv._1e27, {from:accounts[999]})

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.liquidateCDPs(3, { from: accounts[0]})
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 10 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 10. All fully offset with Stability Pool. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(101,111), borrowerOperations, mv._10_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(101,111), borrowerOperations, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], {from:accounts[500], value: mv._1_Ether })

     // --- 10 Accounts to be liquidated in the test tx --
    await th.addColl_allAccounts(accounts.slice(1,11), borrowerOperations,mv._1_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(1,11), borrowerOperations, mv._180e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500],{ from: accounts[0]})
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], {from:accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP( mv._1e27, {from:accounts[999]})

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0]})
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 30 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 30. All fully offset with Stability Pool. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(101,111), borrowerOperations, mv._10_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(101,111), borrowerOperations, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], {from:accounts[500], value: mv._1_Ether })

     // --- 10 Accounts to be liquidated in the test tx --
    await th.addColl_allAccounts(accounts.slice(1,31), borrowerOperations,mv._1_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(1,31), borrowerOperations, mv._180e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500],{ from: accounts[0]})
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], {from:accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP( mv._1e27, {from:accounts[999]})

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.liquidateCDPs(30, { from: accounts[0]})
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 50 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 50. All fully offset with Stability Pool. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(101,111), borrowerOperations, mv._10_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(101,111), borrowerOperations, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], {from:accounts[500], value: mv._1_Ether })

     // --- 10 Accounts to be liquidated in the test tx --
    await th.addColl_allAccounts(accounts.slice(1,51), borrowerOperations,mv._1_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(1,51), borrowerOperations, mv._180e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500],{ from: accounts[0]})
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], {from:accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP( mv._1e27, {from:accounts[999]})

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.liquidateCDPs(50, { from: accounts[0]})
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // 100 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 100. All fully offset with Stability Pool. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.addColl_allAccounts(accounts.slice(101,111), borrowerOperations, mv._10_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(101,111), borrowerOperations, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], {from:accounts[500], value: mv._1_Ether })

     // --- 10 Accounts to be liquidated in the test tx --
    await th.addColl_allAccounts(accounts.slice(1,101), borrowerOperations,mv._1_Ether)
    await th.withdrawCLV_allAccounts(accounts.slice(1,101), borrowerOperations, mv._180e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500],{ from: accounts[0]})
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], {from:accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP( mv._1e27, {from:accounts[999]})

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.liquidateCDPs(100, { from: accounts[0]})
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  it("Export test data", async () => {
    fs.writeFile('gasTest/outputs/liquidateCDPsGasData.csv', data, (err) => {
      if (err) {console.log(err) } else {
        console.log("LiquidateCDPs() gas test data written to gasTest/outputs/liquidateCDPsGasData.csv")
      }
    })
  })

})