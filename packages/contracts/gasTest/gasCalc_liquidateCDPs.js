/* Script that logs gas costs for Liquity operations under various conditions. 

  Note: uses Mocha testing structure, but simply prints gas costs of transactions. No assertions.
*/
const fs = require('fs')

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
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    //1 accts open CDP with 1 ether and withdraw 100 CLV
    const _1_Defaulter = accounts.slice(1, 2)
    await th.openLoan_allAccounts(_1_Defaulter, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _1_Defaulter) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._110e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidateCDPs(1, { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(1, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check defaulters' troves have been closed
    for (account of _1_Defaulter) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 2 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 2. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    //2 accts open CDP with 1 ether and withdraw 100 CLV
    const _2_Defaulters = accounts.slice(1, 3)
    await th.openLoan_allAccounts(_2_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _2_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openLoan(mv._110e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidateCDPs(1, { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(2, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check defaulters' troves have been closed
    for (account of _2_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 3 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 3. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    //3 accts open CDP with 1 ether and withdraw 100 CLV
    const _3_Defaulters = accounts.slice(1, 4)
    await th.openLoan_allAccounts(_3_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _3_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(3, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check defaulters' troves have been closed
    for (account of _3_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 5 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 5. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    //5 accts open CDP with 1 ether and withdraw 100 CLV
    const _5_Defaulters = accounts.slice(1, 6)
    await th.openLoan_allAccounts(_5_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _5_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(5, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check defaulters' troves have been closed
    for (account of _5_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 10 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 10. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    //10 accts open CDP with 1 ether and withdraw 100 CLV
    const _10_Defaulters = accounts.slice(1, 11)
    await th.openLoan_allAccounts(_10_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _10_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check defaulters' troves have been closed
    for (account of _10_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  //20 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 20. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    //20 accts open CDP with 1 ether and withdraw 100 CLV
    const _20_Defaulters = accounts.slice(1, 21)
    await th.openLoan_allAccounts(_20_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _20_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(20, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check defaulters' troves have been closed
    for (account of _20_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 30 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 30. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    //30 accts open CDP with 1 ether and withdraw 100 CLV
    const _30_Defaulters = accounts.slice(1, 31)
    await th.openLoan_allAccounts(_30_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _30_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(30, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check defaulters' troves have been closed
    for (account of _30_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 40. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    //40 accts open CDP with 1 ether and withdraw 100 CLV
    const _40_Defaulters = accounts.slice(1, 41)
    await th.openLoan_allAccounts(_40_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _40_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(40, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check defaulters' troves have been closed
    for (account of _40_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 45. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    //45 accts open CDP with 1 ether and withdraw 100 CLV
    const _45_Defaulters = accounts.slice(1, 46)
    await th.openLoan_allAccounts(_45_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _45_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(45, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check defaulters' troves have been closed
    for (account of _45_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 50 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 50. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    //50 accts open CDP with 1 ether and withdraw 100 CLV
    const _50_Defaulters = accounts.slice(1, 51)
    await th.openLoan_allAccounts(_50_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _50_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(50, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check defaulters' troves have been closed
    for (account of _50_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'liquidateCDPs(). n = 60. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    //60 accts open CDP with 1 ether and withdraw 100 CLV
    const _60_Defaulters = accounts.slice(1, 61)
    await th.openLoan_allAccounts(_60_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _60_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(60, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check defaulters' troves have been closed
    for (account of _60_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 65 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 65. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    //65 accts open CDP with 1 ether and withdraw 100 CLV
    const _65_Defaulters = accounts.slice(1, 66)
    await th.openLoan_allAccounts(_65_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _65_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(65, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check defaulters' troves have been closed
    for (account of _65_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })



  // --- liquidate CDPs - all troves offset by Stability Pool - no pending distribution rewards ---

  // 1 trove
  it("", async () => {
    const message = 'liquidateCDPs(). n = 1. All fully offset with Stability Pool. No pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })

    //1 acct opens CDP with 1 ether and withdraw 100 CLV
    const _1_Defaulter = accounts.slice(1, 2)
    await th.openLoan_allAccounts(_1_Defaulter, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _1_Defaulter) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(1, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check CDPs are closed
    for (account of _1_Defaulter) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 2 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 2. All fully offset with Stability Pool. No pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })

    //2 accts open CDP with 1 ether and withdraw 100 CLV
    const _2_Defaulters = accounts.slice(1, 3)
    await th.openLoan_allAccounts(_2_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _2_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(2, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check CDPs are closed
    for (account of _2_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 3 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 3. All fully offset with Stability Pool. No pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })

    //3 accts open CDP with 1 ether and withdraw 100 CLV
    const _3_Defaulters = accounts.slice(1, 4)
    await th.openLoan_allAccounts(_3_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _3_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(3, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check CDPs are closed
    for (account of _3_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 5 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 5. All fully offset with Stability Pool. No pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })

    //5 accts open CDP with 1 ether and withdraw 100 CLV
    const _5_Defaulters = accounts.slice(1, 6)
    await th.openLoan_allAccounts(_5_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _5_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(5, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check CDPs are closed
    for (account of _5_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 10 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 10. All fully offset with Stability Pool. No pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })

    //10 accts open CDP with 1 ether and withdraw 100 CLV
    const _10_Defaulters = accounts.slice(1, 11)
    await th.openLoan_allAccounts(_10_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _10_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check CDPs are closed
    for (account of _10_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 20 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 20. All fully offset with Stability Pool. No pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })

    //20 accts open CDP with 1 ether and withdraw 100 CLV
    const _20_Defaulters = accounts.slice(1, 21)
    await th.openLoan_allAccounts(_20_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _20_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(20, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check CDPs are closed
    for (account of _20_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 30 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 30. All fully offset with Stability Pool. No pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })

    //30 accts open CDP with 1 ether and withdraw 100 CLV
    const _30_Defaulters = accounts.slice(1, 31)
    await th.openLoan_allAccounts(_30_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _30_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(30, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check CDPs are closed
    for (account of _30_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 40. All fully offset with Stability Pool. No pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })

    //40 accts open CDP with 1 ether and withdraw 100 CLV
    const _40_Defaulters = accounts.slice(1, 41)
    await th.openLoan_allAccounts(_40_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _40_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(40, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check CDPs are closed
    for (account of _40_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 50 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 50. All fully offset with Stability Pool. No pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })

    //50 accts open CDP with 1 ether and withdraw 100 CLV
    const _50_Defaulters = accounts.slice(1, 51)
    await th.openLoan_allAccounts(_50_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _50_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(50, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check CDPs are closed
    for (account of _50_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 55 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 55. All fully offset with Stability Pool. No pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })

    //50 accts open CDP with 1 ether and withdraw 100 CLV
    const _55_Defaulters = accounts.slice(1, 56)
    await th.openLoan_allAccounts(_55_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _55_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(55, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check CDPs are closed
    for (account of _55_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // --- liquidate CDPs - all troves offset by Stability Pool - Has pending distribution rewards ---

  // 1 trove
  it.only("", async () => {
    const message = 'liquidateCDPs(). n = 1. All fully offset with Stability Pool. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // --- 1 Accounts to be liquidated in the test tx --
    const _1_Defaulter = accounts.slice(1, 2)
    await th.openLoan_allAccounts(_1_Defaulter, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters active
    for (account of _1_Defaulter) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })
    assert.equal((await stabilityPool.getCLV()), mv._1e27)

    // Price drops, defaulters' ICR fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(1, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check all defaulters liquidated
    for (account of _1_Defaulter) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 2 troves
  it.only("", async () => {
    const message = 'liquidateCDPs(). n = 2. All fully offset with Stability Pool. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // --- 2 Accounts to be liquidated in the test tx --
    const _2_Defaulters = accounts.slice(1, 3)
    await th.openLoan_allAccounts(_2_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters active
    for (account of _2_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })
    assert.equal((await stabilityPool.getCLV()), mv._1e27)

    // Price drops, defaulters' ICR fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(2, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check all defaulters liquidated
    for (account of _2_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 3 troves
  it.only("", async () => {
    const message = 'liquidateCDPs(). n = 3. All fully offset with Stability Pool. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // --- 3 Accounts to be liquidated in the test tx --
    const _3_Defaulters = accounts.slice(1, 4)
    await th.openLoan_allAccounts(_3_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters active
    for (account of _3_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })
    assert.equal((await stabilityPool.getCLV()), mv._1e27)

    // Price drops, defaulters' ICR fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(3, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check all defaulters liquidated
    for (account of _3_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 5 troves
  it.only("", async () => {
    const message = 'liquidateCDPs(). n = 5. All fully offset with Stability Pool. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // --- 5 Accounts to be liquidated in the test tx --
    const _5_Defaulters = accounts.slice(1, 6)
    await th.openLoan_allAccounts(_5_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters active
    for (account of _5_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })
    assert.equal((await stabilityPool.getCLV()), mv._1e27)

    // Price drops, defaulters' ICR fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(5, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check all defaulters liquidated
    for (account of _5_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 10 troves
  it.only("", async () => {
    const message = 'liquidateCDPs(). n = 10. All fully offset with Stability Pool. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // --- 10 Accounts to be liquidated in the test tx --
    const _10_Defaulters = accounts.slice(1, 11)
    await th.openLoan_allAccounts(_10_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters active
    for (account of _10_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })
    assert.equal((await stabilityPool.getCLV()), mv._1e27)

    // Price drops, defaulters' ICR fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check all defaulters liquidated
    for (account of _10_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 20 troves
  it.only("", async () => {
    const message = 'liquidateCDPs(). n = 20. All fully offset with Stability Pool. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // --- 20 Accounts to be liquidated in the test tx --
    const _20_Defaulters = accounts.slice(1, 21)
    await th.openLoan_allAccounts(_20_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters active
    for (account of _20_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })
    assert.equal((await stabilityPool.getCLV()), mv._1e27)

    // Price drops, defaulters' ICR fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(20, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check all defaulters liquidated
    for (account of _20_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 30 troves
  it.only("", async () => {
    const message = 'liquidateCDPs(). n = 30. All fully offset with Stability Pool. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // --- 30 Accounts to be liquidated in the test tx --
    const _30_Defaulters = accounts.slice(1, 31)
    await th.openLoan_allAccounts(_30_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters active
    for (account of _30_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })
    assert.equal((await stabilityPool.getCLV()), mv._1e27)

    // Price drops, defaulters' ICR fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(30, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check all defaulters liquidated
    for (account of _30_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 troves
  it.only("", async () => {
   const message = 'liquidateCDPs(). n = 40. All fully offset with Stability Pool. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // --- 40 Accounts to be liquidated in the test tx --
    const _40_Defaulters = accounts.slice(1, 41)
    await th.openLoan_allAccounts(_40_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters active
    for (account of _40_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })
    assert.equal((await stabilityPool.getCLV()), mv._1e27)

    // Price drops, defaulters' ICR fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(40, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check all defaulters liquidated
    for (account of _40_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 45 troves
  it.only("", async () => {
    const message = 'liquidateCDPs(). n = 45. All fully offset with Stability Pool. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // --- 50 Accounts to be liquidated in the test tx --
    const _45_Defaulters = accounts.slice(1, 46)
    await th.openLoan_allAccounts(_45_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters active
    for (account of _45_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })
    assert.equal((await stabilityPool.getCLV()), mv._1e27)

    // Price drops, defaulters' ICR fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(45, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check all defaulters liquidated
    for (account of _45_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 50 troves
  it.only("", async () => {
    const message = 'liquidateCDPs(). n = 50. All fully offset with Stability Pool. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 100 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._100e18)

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // --- 50 Accounts to be liquidated in the test tx --
    const _50_Defaulters = accounts.slice(1, 51)
    await th.openLoan_allAccounts(_50_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters active
    for (account of _50_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })
    assert.equal((await stabilityPool.getCLV()), mv._1e27)

    // Price drops, defaulters' ICR fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is false
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(50, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check all defaulters liquidated
    for (account of _50_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // --- liquidateCDPs RECOVERY MODE - pure redistribution ---

  // 1 trove
  it("", async () => {
    const message = 'liquidateCDPs(). n = 1. Pure redistribution, Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //1 accts open CDP with 1 ether and withdraw 100 CLV
    const _1_Defaulter = accounts.slice(1, 2)
    await th.openLoan_allAccounts(_1_Defaulter, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _1_Defaulter) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)
    const price = await priceFeed.getPrice()

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(1, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulters' troves have been closed
    for (account of _1_Defaulter) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 2 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 2. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //2 accts open CDP with 1 ether and withdraw 100 CLV
    const _2_Defaulters = accounts.slice(1, 3)
    await th.openLoan_allAccounts(_2_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _2_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(2, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulters' troves have been closed
    for (account of _2_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 3 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 3. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //3 accts open CDP with 1 ether and withdraw 100 CLV
    const _3_Defaulters = accounts.slice(1, 4)
    await th.openLoan_allAccounts(_3_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _3_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(3, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulters' troves have been closed
    for (account of _3_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 5 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 5. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //5 accts open CDP with 1 ether and withdraw 100 CLV
    const _5_Defaulters = accounts.slice(1, 6)
    await th.openLoan_allAccounts(_5_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _5_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(5, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulters' troves have been closed
    for (account of _5_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 10 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 10. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //10 accts open CDP with 1 ether and withdraw 100 CLV
    const _10_Defaulters = accounts.slice(1, 11)
    await th.openLoan_allAccounts(_10_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _10_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulters' troves have been closed
    for (account of _10_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  //20 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 20. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 90 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //20 accts open CDP with 1 ether and withdraw 100 CLV
    const _20_Defaulters = accounts.slice(1, 21)
    await th.openLoan_allAccounts(_20_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _20_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(20, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulters' troves have been closed
    for (account of _20_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 30 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 30. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 90 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //30 accts open CDP with 1 ether and withdraw 100 CLV
    const _30_Defaulters = accounts.slice(1, 31)
    await th.openLoan_allAccounts(_30_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _30_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(30, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulters' troves have been closed
    for (account of _30_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 40. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 90 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //40 accts open CDP with 1 ether and withdraw 100 CLV
    const _40_Defaulters = accounts.slice(1, 41)
    await th.openLoan_allAccounts(_40_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _40_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(40, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulters' troves have been closed
    for (account of _40_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 45. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //45 accts open CDP with 1 ether and withdraw 100 CLV
    const _45_Defaulters = accounts.slice(1, 46)
    await th.openLoan_allAccounts(_45_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _45_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openLoan(mv._100e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 500 is liquidated, creates pending distribution rewards for all
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    const tx = await cdpManager.liquidateCDPs(45, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check defaulters' troves have been closed
    for (account of _45_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // --- liquidate CDPs --- RECOVERY MODE --- Full offset, NO pending distribution rewards ----

  // 1 trove
  it("", async () => {
    const message = 'liquidateCDPs(). n = 1. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    //1 acct opens CDP with 1 ether and withdraw 100 CLV
    const _1_Defaulter = accounts.slice(1, 2)
    await th.openLoan_allAccounts(_1_Defaulter, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _1_Defaulter) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(1, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // // Check CDPs are closed
    for (account of _1_Defaulter) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 2 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 2. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    //2 acct opens CDP with 1 ether and withdraw 100 CLV
    const _2_Defaulters = accounts.slice(1, 3)
    await th.openLoan_allAccounts(_2_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _2_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(2, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // // Check CDPs are closed
    for (account of _2_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 3 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 3. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    //3 accts open CDP with 1 ether and withdraw 100 CLV
    const _3_Defaulters = accounts.slice(1, 4)
    await th.openLoan_allAccounts(_3_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _3_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(3, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // // Check CDPs are closed
    for (account of _3_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 5 troves 
  it("", async () => {
    const message = 'liquidateCDPs(). n = 5. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    //5 accts open CDP with 1 ether and withdraw 100 CLV
    const _5_Defaulters = accounts.slice(1, 6)
    await th.openLoan_allAccounts(_5_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _5_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(5, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // // Check CDPs are closed
    for (account of _5_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 10 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 10. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    //10 accts open CDP with 1 ether and withdraw 100 CLV
    const _10_Defaulters = accounts.slice(1, 11)
    await th.openLoan_allAccounts(_10_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _10_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // // Check CDPs are closed
    for (account of _10_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 20 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 20. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    //30 accts open CDP with 1 ether and withdraw 100 CLV
    const _20_Defaulters = accounts.slice(1,21)
    await th.openLoan_allAccounts(_20_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _20_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(20, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // // Check CDPs are closed
    for (account of _20_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 30 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 30. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    //30 accts open CDP with 1 ether and withdraw 100 CLV
    const _30_Defaulters = accounts.slice(1, 31)
    await th.openLoan_allAccounts(_30_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _30_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(30, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // // Check CDPs are closed
    for (account of _30_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 40. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    //40 accts open CDP with 1 ether and withdraw 100 CLV
    const _40_Defaulters = accounts.slice(1, 41)
    await th.openLoan_allAccounts(_40_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _40_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(40, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // // Check CDPs are closed
    for (account of _40_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 45. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    //45 accts open CDP with 1 ether and withdraw 100 CLV
    const _45_Defaulters = accounts.slice(1, 46)
    await th.openLoan_allAccounts(_45_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

    // Check all defaulters are active
    for (account of _45_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(45, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // // Check CDPs are closed
    for (account of _45_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // --- liquidate CDPs --- RECOVERY MODE --- Full offset, HAS pending distribution rewards ----

  // 1 trove
  it("", async () => {
    const message = 'liquidateCDPs(). n = 1. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

     //1 acct opens CDP with 1 ether and withdraw 100 CLV
     const _1_Defaulter = accounts.slice(1, 2)
     await th.openLoan_allAccounts(_1_Defaulter, borrowerOperations, mv._1_Ether, mv._100e18)

      // Check all defaulters are active
    for (account of _1_Defaulter) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openLoan(mv._110e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Check all defaulters have pending rewards 
    for (account of _1_Defaulter) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(1, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // // Check CDPs are closed
    for (account of _1_Defaulter) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 2 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 2. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

     //2 accts open CDP with 1 ether and withdraw 100 CLV
     const _2_Defaulters = accounts.slice(1, 3)
     await th.openLoan_allAccounts(_2_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

      // Check all defaulters are active
    for (account of _2_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openLoan(mv._110e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Check all defaulters have pending rewards 
    for (account of _2_Defaulters) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(2, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check CDPs are closed
    for (account of _2_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 3 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 3. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

     //3 accts open CDP with 1 ether and withdraw 100 CLV
     const _3_Defaulters = accounts.slice(1, 4)
     await th.openLoan_allAccounts(_3_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

      // Check all defaulters are active
    for (account of _3_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openLoan(mv._110e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Check all defaulters have pending rewards 
    for (account of _3_Defaulters) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(3, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check CDPs are closed
    for (account of _3_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 5 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 5. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

     //5 accts open CDP with 1 ether and withdraw 100 CLV
     const _5_Defaulters = accounts.slice(1, 6)
     await th.openLoan_allAccounts(_5_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

      // Check all defaulters are active
    for (account of _5_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openLoan(mv._110e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Check all defaulters have pending rewards 
    for (account of _5_Defaulters) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(5, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check CDPs are closed
    for (account of _5_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 10 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 10. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

     //10 accts open CDP with 1 ether and withdraw 100 CLV
     const _10_Defaulters = accounts.slice(1, 11)
     await th.openLoan_allAccounts(_10_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

      // Check all defaulters are active
    for (account of _10_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openLoan(mv._110e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Check all defaulters have pending rewards 
    for (account of _10_Defaulters) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check CDPs are closed
    for (account of _10_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })
  
  // 20 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 20. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

     //20 accts open CDP with 1 ether and withdraw 100 CLV
     const _20_Defaulters = accounts.slice(1, 21)
     await th.openLoan_allAccounts(_20_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

      // Check all defaulters are active
    for (account of _20_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openLoan(mv._110e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Check all defaulters have pending rewards 
    for (account of _20_Defaulters) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(20, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check CDPs are closed
    for (account of _20_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 30 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 30. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

     //30 accts open CDP with 1 ether and withdraw 100 CLV
     const _30_Defaulters = accounts.slice(1, 31)
     await th.openLoan_allAccounts(_30_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

      // Check all defaulters are active
    for (account of _30_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openLoan(mv._110e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Check all defaulters have pending rewards 
    for (account of _30_Defaulters) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(30, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check CDPs are closed
    for (account of _30_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 40. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

     //40 accts open CDP with 1 ether and withdraw 100 CLV
     const _40_Defaulters = accounts.slice(1, 41)
     await th.openLoan_allAccounts(_40_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

      // Check all defaulters are active
    for (account of _40_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openLoan(mv._110e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Check all defaulters have pending rewards 
    for (account of _40_Defaulters) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(40, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check CDPs are closed
    for (account of _40_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 45. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._900e18)
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

     //45 accts open CDP with 1 ether and withdraw 100 CLV
     const _45_Defaulters = accounts.slice(1, 46)
     await th.openLoan_allAccounts(_45_Defaulters, borrowerOperations, mv._1_Ether, mv._100e18)

      // Check all defaulters are active
    for (account of _45_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openLoan(mv._110e18, accounts[500], { from: accounts[500], value: mv._1_Ether })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(mv._200e18)

    // Check all defaulters have pending rewards 
    for (account of _45_Defaulters) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openLoan(mv._9e28, whale, { from: whale, value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._9e28, { from: whale })

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Liquidate troves
    const tx = await cdpManager.liquidateCDPs(45, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check CDPs are closed
    for (account of _45_Defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    // Check initial troves with starting 10E/90CLV, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }
    assert.isTrue(await sortedCDPs.contains(whale))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })




  // --- BatchLiquidateTroves ---

  // --- Pure redistribution, no offset. WITH pending distribution rewards ---

  // 2 troves
  it("", async () => {
    0
    const message = 'batchLiquidateTroves(). n = 2. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], { from: accounts[500], value: mv._1_Ether })

    const _2_defaulters = accounts.slice(1, 3)
    // --- Accounts to be liquidated in the test tx ---
    await th.openLoan_allAccounts(_2_defaulters, borrowerOperations, mv._1_Ether, mv._180e18)

    // Check all defaulters active
    for (account of _2_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(mv._200e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.batchLiquidateTroves(_2_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _2_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 3 troves
  it("", async () => {
    0
    const message = 'batchLiquidateTroves(). n = 3. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], { from: accounts[500], value: mv._1_Ether })

    const _3_defaulters = accounts.slice(1, 4)
    // --- Accounts to be liquidated in the test tx ---
    await th.openLoan_allAccounts(_3_defaulters, borrowerOperations, mv._1_Ether, mv._180e18)

    // Check all defaulters active
    for (account of _3_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(mv._200e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.batchLiquidateTroves(_3_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _3_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 5 troves
  it("", async () => {
    0
    const message = 'batchLiquidateTroves(). n = 5. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], { from: accounts[500], value: mv._1_Ether })

    const _5_defaulters = accounts.slice(1, 6)
    // --- Accounts to be liquidated in the test tx ---
    await th.openLoan_allAccounts(_5_defaulters, borrowerOperations, mv._1_Ether, mv._180e18)

    // Check all defaulters active
    for (account of _5_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(mv._200e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.batchLiquidateTroves(_5_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _5_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 10 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 10. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], { from: accounts[500], value: mv._1_Ether })

    const _10_defaulters = accounts.slice(1, 11)
    // --- Accounts to be liquidated in the test tx ---
    await th.openLoan_allAccounts(_10_defaulters, borrowerOperations, mv._1_Ether, mv._180e18)

    // Check all defaulters active
    for (account of _10_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(mv._200e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.batchLiquidateTroves(_10_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _10_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 20 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 20. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], { from: accounts[500], value: mv._1_Ether })

    const _20_defaulters = accounts.slice(1, 21)
    // --- Accounts to be liquidated in the test tx ---
    await th.openLoan_allAccounts(_20_defaulters, borrowerOperations, mv._1_Ether, mv._180e18)

    // Check all defaulters active
    for (account of _20_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(mv._200e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.batchLiquidateTroves(_20_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _20_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 30 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 30. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], { from: accounts[500], value: mv._1_Ether })

    // --- Accounts to be liquidated in the test tx ---
    const _30_defaulters = accounts.slice(1, 31)
    await th.openLoan_allAccounts(_30_defaulters, borrowerOperations, mv._1_Ether, mv._180e18)

    // Check all defaulters active
    for (account of _30_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(mv._200e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.batchLiquidateTroves(_30_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _30_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 40. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], { from: accounts[500], value: mv._1_Ether })


    // --- Accounts to be liquidated in the test tx ---
    const _40_defaulters = accounts.slice(1, 41)
    await th.openLoan_allAccounts(_40_defaulters, borrowerOperations, mv._1_Ether, mv._180e18)

    // Check all defaulters active
    for (account of _40_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(mv._200e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.batchLiquidateTroves(_40_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _40_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 45. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], { from: accounts[500], value: mv._1_Ether })

    // --- Accounts to be liquidated in the test tx ---
    const _45_defaulters = accounts.slice(1, 46)
    await th.openLoan_allAccounts(_45_defaulters, borrowerOperations, mv._1_Ether, mv._180e18)

    // check all defaulters active
    for (account of _45_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(mv._200e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.batchLiquidateTroves(_45_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _45_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })



  // --- batchLiquidateTroves - pure offset with Stability Pool ---

  // 2 troves
  it("", async () => {
    0
    const message = 'batchLiquidateTroves(). n = 2. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], { from: accounts[500], value: mv._1_Ether })

    const _2_defaulters = accounts.slice(1, 3)
    // --- Accounts to be liquidated in the test tx ---
    await th.openLoan_allAccounts(_2_defaulters, borrowerOperations, mv._1_Ether, mv._180e18)

    // Check all defaulters active
    for (account of _2_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.batchLiquidateTroves(_2_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _2_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 3 troves
  it("", async () => {
    0
    const message = 'batchLiquidateTroves(). n = 3. All troves fully offset. Have pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], { from: accounts[500], value: mv._1_Ether })

    const _3_defaulters = accounts.slice(1, 4)
    // --- Accounts to be liquidated in the test tx ---
    await th.openLoan_allAccounts(_3_defaulters, borrowerOperations, mv._1_Ether, mv._180e18)

    // Check all defaulters active
    for (account of _3_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })


    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.batchLiquidateTroves(_3_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _3_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 5 troves
  it("", async () => {
    0
    const message = 'batchLiquidateTroves(). n = 5. All troves fully offset. Have pending distribution rewards'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], { from: accounts[500], value: mv._1_Ether })

    const _5_defaulters = accounts.slice(1, 6)
    // --- Accounts to be liquidated in the test tx ---
    await th.openLoan_allAccounts(_5_defaulters, borrowerOperations, mv._1_Ether, mv._180e18)

    // Check all defaulters active
    for (account of _5_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })


    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.batchLiquidateTroves(_5_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _5_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 10 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 10. All troves fully offset. Have pending distribution rewards'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], { from: accounts[500], value: mv._1_Ether })

    const _10_defaulters = accounts.slice(1, 11)
    // --- Accounts to be liquidated in the test tx ---
    await th.openLoan_allAccounts(_10_defaulters, borrowerOperations, mv._1_Ether, mv._180e18)

    // Check all defaulters active
    for (account of _10_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })


    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.batchLiquidateTroves(_10_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _10_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 20 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 20. All troves fully offset. Have pending distribution rewards'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], { from: accounts[500], value: mv._1_Ether })

    const _20_defaulters = accounts.slice(1, 21)
    // --- Accounts to be liquidated in the test tx ---
    await th.openLoan_allAccounts(_20_defaulters, borrowerOperations, mv._1_Ether, mv._180e18)

    // Check all defaulters active
    for (account of _20_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })


    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.batchLiquidateTroves(_20_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _20_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 30 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 30. All troves fully offset. Have pending distribution rewards'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], { from: accounts[500], value: mv._1_Ether })

    // --- Accounts to be liquidated in the test tx ---
    const _30_defaulters = accounts.slice(1, 31)
    await th.openLoan_allAccounts(_30_defaulters, borrowerOperations, mv._1_Ether, mv._180e18)

    // Check all defaulters active
    for (account of _30_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })


    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.batchLiquidateTroves(_30_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _30_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 40. All troves fully offset. Have pending distribution rewards'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], { from: accounts[500], value: mv._1_Ether })


    // --- Accounts to be liquidated in the test tx ---
    const _40_defaulters = accounts.slice(1, 41)
    await th.openLoan_allAccounts(_40_defaulters, borrowerOperations, mv._1_Ether, mv._180e18)

    // Check all defaulters active
    for (account of _40_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })


    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.batchLiquidateTroves(_40_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _40_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 45. All troves fully offset. Have pending distribution rewards'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(101, 111), borrowerOperations, mv._10_Ether, mv._180e18)

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[500], { from: accounts[500], value: mv._1_Ether })

    // --- Accounts to be liquidated in the test tx ---
    const _45_defaulters = accounts.slice(1, 46)
    await th.openLoan_allAccounts(_45_defaulters, borrowerOperations, mv._1_Ether, mv._180e18)

    // check all defaulters active
    for (account of _45_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(mv._200e18)

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openLoan(mv._1e27, accounts[999], { from: accounts[999], value: mv._1billion_Ether })
    await poolManager.provideToSP(mv._1e27, { from: accounts[999] })


    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.batchLiquidateTroves(_45_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _45_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })



  it("Export test data", async () => {
    fs.writeFile('gasTest/outputs/liquidateCDPsGasData.csv', data, (err) => {
      if (err) { console.log(err) } else {
        console.log("LiquidateCDPs() gas test data written to gasTest/outputs/liquidateCDPsGasData.csv")
      }
    })
  })
})