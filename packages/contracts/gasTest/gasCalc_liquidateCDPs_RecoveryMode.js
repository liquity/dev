/* Script that logs gas costs for Liquity operations under various conditions. 

  Note: uses Mocha testing structure, but the purpose of each test is simply to print gas costs.

  'asserts' are only used to confirm the setup conditions.
*/
const fs = require('fs')

const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec
const timeValues = testHelpers.TimeValues

const ZERO_ADDRESS = th.ZERO_ADDRESS

contract('Gas cost tests', async accounts => {
  const [owner] = accounts;

  let priceFeed
  let clvToken

  let sortedCDPs
  let cdpManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  let contracts
  let data = []

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    const LQTYContracts = await deploymentHelper.deployLQTYContracts()

    priceFeed = contracts.priceFeedTestnet
    clvToken = contracts.clvToken
    sortedCDPs = contracts.sortedCDPs
    cdpManager = contracts.cdpManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    lqtyStaking = LQTYContracts.lqtyStaking
    growthToken = LQTYContracts.growthToken
    communityIssuance = LQTYContracts.communityIssuance
    lockupContractFactory = LQTYContracts.lockupContractFactory

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

    await priceFeed.setPrice(dec(200, 18))
  })

  // --- liquidateCDPs RECOVERY MODE - pure redistribution ---

  // 1 trove
  it("", async () => {
    const message = 'liquidateCDPs(). n = 1. Pure redistribution, Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //1 accts open CDP with 1 ether and withdraw 100 CLV
    const _1_Defaulter = accounts.slice(1, 2)
    await th.openTrove_allAccounts(_1_Defaulter, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _1_Defaulter) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openTrove(dec(100, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))
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
    const message = 'liquidateCDPs(). n = 2. Pure redistribution. Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //2 accts open CDP with 1 ether and withdraw 100 CLV
    const _2_Defaulters = accounts.slice(1, 3)
    await th.openTrove_allAccounts(_2_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _2_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openTrove(dec(100, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))

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
    const message = 'liquidateCDPs(). n = 3. Pure redistribution. Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //3 accts open CDP with 1 ether and withdraw 100 CLV
    const _3_Defaulters = accounts.slice(1, 4)
    await th.openTrove_allAccounts(_3_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _3_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openTrove(dec(100, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))

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
    const message = 'liquidateCDPs(). n = 5. Pure redistribution. Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //5 accts open CDP with 1 ether and withdraw 100 CLV
    const _5_Defaulters = accounts.slice(1, 6)
    await th.openTrove_allAccounts(_5_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _5_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openTrove(dec(100, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))

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
    const message = 'liquidateCDPs(). n = 10. Pure redistribution. Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //10 accts open CDP with 1 ether and withdraw 100 CLV
    const _10_Defaulters = accounts.slice(1, 11)
    await th.openTrove_allAccounts(_10_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _10_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openTrove(dec(100, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))

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
    const message = 'liquidateCDPs(). n = 20. Pure redistribution. Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 90 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //20 accts open CDP with 1 ether and withdraw 100 CLV
    const _20_Defaulters = accounts.slice(1, 21)
    await th.openTrove_allAccounts(_20_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _20_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openTrove(dec(100, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))

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
    const message = 'liquidateCDPs(). n = 30. Pure redistribution. Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 90 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //30 accts open CDP with 1 ether and withdraw 100 CLV
    const _30_Defaulters = accounts.slice(1, 31)
    await th.openTrove_allAccounts(_30_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _30_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openTrove(dec(100, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))

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
    const message = 'liquidateCDPs(). n = 40. Pure redistribution. Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 90 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //40 accts open CDP with 1 ether and withdraw 100 CLV
    const _40_Defaulters = accounts.slice(1, 41)
    await th.openTrove_allAccounts(_40_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _40_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openTrove(dec(100, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))

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
    const message = 'liquidateCDPs(). n = 45. Pure redistribution. Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //45 accts open CDP with 1 ether and withdraw 100 CLV
    const _45_Defaulters = accounts.slice(1, 46)
    await th.openTrove_allAccounts(_45_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _45_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 CLV
    await borrowerOperations.openTrove(dec(100, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))

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
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    //1 acct opens CDP with 1 ether and withdraw 100 CLV
    const _1_Defaulter = accounts.slice(1, 2)
    await th.openTrove_allAccounts(_1_Defaulter, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _1_Defaulter) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _1_Defaulter) {
      console.log(`ICR: ${await cdpManager.getCurrentICR(account, price)}`)
      assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 2 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 2. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    //2 acct opens CDP with 1 ether and withdraw 100 CLV
    const _2_Defaulters = accounts.slice(1, 3)
    await th.openTrove_allAccounts(_2_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _2_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _2_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 3 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 3. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    //3 accts open CDP with 1 ether and withdraw 100 CLV
    const _3_Defaulters = accounts.slice(1, 4)
    await th.openTrove_allAccounts(_3_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _3_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _3_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 5 troves 
  it("", async () => {
    const message = 'liquidateCDPs(). n = 5. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    //5 accts open CDP with 1 ether and withdraw 100 CLV
    const _5_Defaulters = accounts.slice(1, 6)
    await th.openTrove_allAccounts(_5_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _5_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _5_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 10 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 10. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    //10 accts open CDP with 1 ether and withdraw 100 CLV
    const _10_Defaulters = accounts.slice(1, 11)
    await th.openTrove_allAccounts(_10_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _10_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _10_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 20 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 20. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    //30 accts open CDP with 1 ether and withdraw 100 CLV
    const _20_Defaulters = accounts.slice(1, 21)
    await th.openTrove_allAccounts(_20_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _20_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _20_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 30 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 30. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    //30 accts open CDP with 1 ether and withdraw 100 CLV
    const _30_Defaulters = accounts.slice(1, 31)
    await th.openTrove_allAccounts(_30_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _30_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _30_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 40. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    //40 accts open CDP with 1 ether and withdraw 100 CLV
    const _40_Defaulters = accounts.slice(1, 41)
    await th.openTrove_allAccounts(_40_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _40_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _40_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 45. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    //45 accts open CDP with 1 ether and withdraw 100 CLV
    const _45_Defaulters = accounts.slice(1, 46)
    await th.openTrove_allAccounts(_45_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _45_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _45_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // --- liquidate CDPs --- RECOVERY MODE --- Full offset, HAS pending distribution rewards ----

  // 1 trove
  it("", async () => {
    const message = 'liquidateCDPs(). n = 1. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //1 acct opens CDP with 1 ether and withdraw 100 CLV
    const _1_Defaulter = accounts.slice(1, 2)
    await th.openTrove_allAccounts(_1_Defaulter, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _1_Defaulter) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openTrove(dec(110, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _1_Defaulter) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _1_Defaulter) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 2 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 2. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //2 accts open CDP with 1 ether and withdraw 100 CLV
    const _2_Defaulters = accounts.slice(1, 3)
    await th.openTrove_allAccounts(_2_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _2_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openTrove(dec(110, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _2_Defaulters) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _2_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))


    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 3 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 3. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //3 accts open CDP with 1 ether and withdraw 100 CLV
    const _3_Defaulters = accounts.slice(1, 4)
    await th.openTrove_allAccounts(_3_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _3_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openTrove(dec(110, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _3_Defaulters) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _3_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 5 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 5. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //5 accts open CDP with 1 ether and withdraw 100 CLV
    const _5_Defaulters = accounts.slice(1, 6)
    await th.openTrove_allAccounts(_5_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _5_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openTrove(dec(110, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _5_Defaulters) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _5_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 10 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 10. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //10 accts open CDP with 1 ether and withdraw 100 CLV
    const _10_Defaulters = accounts.slice(1, 11)
    await th.openTrove_allAccounts(_10_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _10_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openTrove(dec(110, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _10_Defaulters) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _10_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 20 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 20. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //20 accts open CDP with 1 ether and withdraw 100 CLV
    const _20_Defaulters = accounts.slice(1, 21)
    await th.openTrove_allAccounts(_20_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _20_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openTrove(dec(110, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _20_Defaulters) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _20_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 30 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 30. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //30 accts open CDP with 1 ether and withdraw 100 CLV
    const _30_Defaulters = accounts.slice(1, 31)
    await th.openTrove_allAccounts(_30_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _30_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openTrove(dec(110, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _30_Defaulters) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _30_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 40. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //40 accts open CDP with 1 ether and withdraw 100 CLV
    const _40_Defaulters = accounts.slice(1, 41)
    await th.openTrove_allAccounts(_40_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _40_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openTrove(dec(110, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _40_Defaulters) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _40_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 troves
  it("", async () => {
    const message = 'liquidateCDPs(). n = 45. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open CDP with 10 ether, withdraw 900 CLV
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedCDPs.contains(account)) }

    //45 accts open CDP with 1 ether and withdraw 100 CLV
    const _45_Defaulters = accounts.slice(1, 46)
    await th.openTrove_allAccounts(_45_Defaulters, contracts, dec(1, 'ether'), dec(100, 18))

    // Check all defaulters are active
    for (account of _45_Defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 CLV
    await borrowerOperations.openTrove(dec(110, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedCDPs.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _45_Defaulters) { assert.isTrue(await cdpManager.hasPendingRewards(account)) }

    // Whale opens loan and fills SP with 1 billion CLV
    const whale = accounts[999]
    await borrowerOperations.openTrove(dec(9, 28), whale, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 CLV
    const CLVinSP = (await stabilityPool.getTotalCLVDeposits()).toString()
    assert.equal(CLVinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await cdpManager.checkRecoveryMode())

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _45_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, cdpManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    //Check CLV in SP has decreased but is still > 0
    const CLVinSP_After = await stabilityPool.getTotalCLVDeposits()
    assert.isTrue(CLVinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(CLVinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // --- BatchLiquidateTroves ---

  // --- Pure redistribution, no offset. WITH pending distribution rewards ---

  // 10 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 10. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(180, 18))

    // Account 500 opens with 1 ether and withdraws 170 CLV
    await borrowerOperations.openTrove(dec(170, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })

    const _10_defaulters = accounts.slice(1, 11)
    // --- Accounts to be liquidated in the test tx ---
    await th.openTrove_allAccounts(_10_defaulters, contracts, dec(1, 'ether'), dec(170, 18))

    // Check all defaulters active
    for (account of _10_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    const tx = await cdpManager.batchLiquidateTroves(_10_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _10_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 40. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(180, 18))

    // Account 500 opens with 1 ether and withdraws 170 CLV
    await borrowerOperations.openTrove(dec(170, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })


    // --- Accounts to be liquidated in the test tx ---
    const _40_defaulters = accounts.slice(1, 41)
    await th.openTrove_allAccounts(_40_defaulters, contracts, dec(1, 'ether'), dec(170, 18))

    // Check all defaulters active
    for (account of _40_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

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

    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(180, 18))

    // Account 500 opens with 1 ether and withdraws 170 CLV
    await borrowerOperations.openTrove(dec(170, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })

    // --- Accounts to be liquidated in the test tx ---
    const _45_defaulters = accounts.slice(1, 46)
    await th.openTrove_allAccounts(_45_defaulters, contracts, dec(1, 'ether'), dec(170, 18))

    // check all defaulters active
    for (account of _45_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    const tx = await cdpManager.batchLiquidateTroves(_45_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _45_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 50 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 50. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(180, 18))

    // Account 500 opens with 1 ether and withdraws 170 CLV
    await borrowerOperations.openTrove(dec(170, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })

    // --- Accounts to be liquidated in the test tx ---
    const _50_defaulters = accounts.slice(1, 51)
    await th.openTrove_allAccounts(_50_defaulters, contracts, dec(1, 'ether'), dec(170, 18))

    // check all defaulters active
    for (account of _50_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    const tx = await cdpManager.batchLiquidateTroves(_50_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _50_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // --- batchLiquidateTroves - pure offset with Stability Pool ---

  // 10 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 10. All troves fully offset. Have pending distribution rewards'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(180, 18))

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openTrove(dec(170, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })

    const _10_defaulters = accounts.slice(1, 11)
    // --- Accounts to be liquidated in the test tx ---
    await th.openTrove_allAccounts(_10_defaulters, contracts, dec(1, 'ether'), dec(170, 18))

    // Check all defaulters active
    for (account of _10_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openTrove(dec(1, 27), accounts[999], { from: accounts[999], value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(1, 27), ZERO_ADDRESS, { from: accounts[999] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const tx = await cdpManager.batchLiquidateTroves(_10_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _10_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 40 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 40. All troves fully offset. Have pending distribution rewards'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(10, 18))

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openTrove(dec(170, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })


    // --- Accounts to be liquidated in the test tx ---
    const _40_defaulters = accounts.slice(1, 41)
    await th.openTrove_allAccounts(_40_defaulters, contracts, dec(1, 'ether'), dec(170, 18))

    // Check all defaulters active
    for (account of _40_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openTrove(dec(1, 27), accounts[999], { from: accounts[999], value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(1, 27), ZERO_ADDRESS, { from: accounts[999] })


    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

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

    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(180, 18))

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openTrove(dec(170, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })

    // --- Accounts to be liquidated in the test tx ---
    const _45_defaulters = accounts.slice(1, 46)
    await th.openTrove_allAccounts(_45_defaulters, contracts, dec(1, 'ether'), dec(170, 18))

    // check all defaulters active
    for (account of _45_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openTrove(dec(1, 27), accounts[999], { from: accounts[999], value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(1, 27), ZERO_ADDRESS, { from: accounts[999] })


    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const tx = await cdpManager.batchLiquidateTroves(_45_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _45_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 50 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 50. All troves fully offset. Have pending distribution rewards'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(180, 18))

    // Account 500 opens with 1 ether and withdraws 180 CLV
    await borrowerOperations.openTrove(dec(170, 18), accounts[500], { from: accounts[500], value: dec(1, 'ether') })

    // --- Accounts to be liquidated in the test tx ---
    const _50_defaulters = accounts.slice(1, 51)
    await th.openTrove_allAccounts(_50_defaulters, contracts, dec(1, 'ether'), dec(170, 18))

    // check all defaulters active
    for (account of _50_defaulters) { assert.isTrue(await sortedCDPs.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Whale opens loan and fills SP with 1 billion CLV
    await borrowerOperations.openTrove(dec(1, 27), accounts[999], { from: accounts[999], value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(1, 27), ZERO_ADDRESS, { from: accounts[999] })


    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
    
    const tx = await cdpManager.batchLiquidateTroves(_50_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _50_defaulters) { assert.isFalse(await sortedCDPs.contains(account)) }

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