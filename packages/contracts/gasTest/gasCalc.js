/* Script that logs gas costs for Liquity operations under various conditions. 
  Note: uses Mocha testing structure, but simply prints gas costs of transactions. No assertions.
*/
const fs = require('fs')
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const toBN = th.toBN

const ZERO_ADDRESS = th.ZERO_ADDRESS

contract('Gas cost tests', async accounts => {

  const [owner] = accounts;
  const _10_Accounts = accounts.slice(0, 10)
  const _20_Accounts = accounts.slice(0, 20)
  const _30_Accounts = accounts.slice(0, 30)
  const _40_Accounts = accounts.slice(0, 40)
  const _50_Accounts = accounts.slice(0, 50)
  const _100_Accounts = accounts.slice(0, 100)

  const whale = accounts[999]

  const address_0 = '0x0000000000000000000000000000000000000000'

  let contracts

  let priceFeed
  let clvToken
  let sortedCDPs
  let cdpManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let hintHelpers
  let functionCaller

  let data = []


  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    const GTContracts = await deploymentHelper.deployGTContracts()

    priceFeed = contracts.priceFeed
    clvToken = contracts.clvToken
    sortedCDPs = contracts.sortedCDPs
    cdpManager = contracts.cdpManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    functionCaller = contracts.functionCaller

    lqtyStaking = GTContracts.lqtyStaking
    growthToken = GTContracts.growthToken
    communityIssuance = GTContracts.communityIssuance
    lockupContractFactory = GTContracts.lockupContractFactory

    await deploymentHelper.connectGTContracts(GTContracts)
    await deploymentHelper.connectCoreContracts(contracts, GTContracts)
    await deploymentHelper.connectGTContractsToCore(GTContracts, contracts)
  })

  // ---TESTS ---

  it("runs the test helper", async () => {
    assert.equal(th.getDifference('2000', '1000'), 1000)
  })

  // --- CDP Manager function calls ---

  // --- openLoan() ---

  it("", async () => {
    const message = 'openLoan(), single account, 0 existing CDPs in system. Adds 10 ether and issues 100 CLV'
    const tx = await borrowerOperations.openLoan(dec(100, 18), accounts[2], { from: accounts[2], value: dec(10, 'ether') })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'openLoan(), single account, 1 existing CDP in system. Adds 10 ether and issues 100 CLV'
    await borrowerOperations.openLoan(dec(100, 18), accounts[1], { from: accounts[1], value: dec(10, 'ether') })

    const tx = await borrowerOperations.openLoan(dec(100, 18), accounts[2], { from: accounts[2], value: dec(10, 'ether') })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'openLoan(), single account, Inserts between 2 existing CDs in system. Adds 10 ether and issues 80 CLV. '

    await borrowerOperations.openLoan(dec(100, 18), accounts[1], { from: accounts[1], value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(50, 18), accounts[2], { from: accounts[2], value: dec(10, 'ether') })

    const tx = await borrowerOperations.openLoan(dec(80, 18), accounts[3], { from: accounts[3], value: dec(10, 'ether') })

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'openLoan(), 10 accounts, each account adds 10 ether and issues 100 CLV'

    const amountETH = dec(10, 'ether')
    const amountCLV = 0
    const gasResults = await th.openLoan_allAccounts(_10_Accounts, contracts, amountETH, amountCLV)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'openLoan(), 10 accounts, each account adds 10 ether and issues less CLV than the previous one'
    const amountETH = dec(10, 'ether')
    const amountCLV = 200
    const gasResults = await th.openLoan_allAccounts_decreasingCLVAmounts(_10_Accounts, contracts, amountETH, amountCLV)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it.only("", async () => {
    const message = 'openLoan(), 30 accounts, each account adds random ether and random CLV'
    const amountETH = dec(10, 'ether')
    const amountCLV = 0
    const gasResults = await th.openLoan_allAccounts_randomETH_randomCLV(1, 9, _30_Accounts, contracts, 2, 100, true)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- adjustLoan ---

  it("", async () => {
    const message = 'adjustLoan(). ETH/CLV Increase/Increase. 10 accounts, each account adjusts up -  1 ether and 100 CLV'
    await borrowerOperations.openLoan(0, accounts[999], { from: accounts[999], value: dec(100, 'ether') })

    const amountETH = dec(10, 'ether')
    const amountCLV = dec(100, 18)
    await th.openLoan_allAccounts(_10_Accounts, contracts, amountETH, amountCLV)


    const amountETH_2 = dec(1, 'ether')
    const amountCLV_2 = dec(100, 18)
    const gasResults = await th.adjustLoan_allAccounts(_10_Accounts, contracts, amountETH_2, amountCLV_2)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'adjustLoan(). ETH/CLV Decrease/Decrease. 10 accounts, each account adjusts down by 0.1 ether and 10 CLV'
    await borrowerOperations.openLoan(0, accounts[999], { from: accounts[999], value: dec(100, 'ether') })

    const amountETH = dec(10, 'ether')
    const amountCLV = dec(100, 18)
    await th.openLoan_allAccounts(_10_Accounts, contracts, amountETH, amountCLV)

    const amountETH_2 = "-100000000000000000"  // coll decrease of 0.1 ETH 
    const amountCLV_2 = "-10000000000000000000" // debt decrease of 10 CLV 
    const gasResults = await th.adjustLoan_allAccounts(_10_Accounts, contracts, amountETH_2, amountCLV_2)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'adjustLoan(). ETH/CLV Increase/Decrease. 10 accounts, each account adjusts up by 0.1 ether and down by 10 CLV'
    await borrowerOperations.openLoan(0, accounts[999], { from: accounts[999], value: dec(100, 'ether') })

    const amountETH = dec(10, 'ether')
    const amountCLV = dec(100, 18)
    await th.openLoan_allAccounts(_10_Accounts, contracts, amountETH, amountCLV)

    const amountETH_2 = "100000000000000000"  // coll increase of 0.1 ETH 
    const amountCLV_2 = "-10000000000000000000" // debt decrease of 10 CLV 
    const gasResults = await th.adjustLoan_allAccounts(_10_Accounts, contracts, amountETH_2, amountCLV_2)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'adjustLoan(). ETH/CLV Decrease/Increase. 10 accounts, each account adjusts down by 0.1 ether and up by 10 CLV'
    await borrowerOperations.openLoan(0, accounts[999], { from: accounts[999], value: dec(100, 'ether') })

    const amountETH = dec(10, 'ether')
    const amountCLV = dec(100, 18)
    await th.openLoan_allAccounts(_10_Accounts, contracts, amountETH, amountCLV)

    const amountETH_2 = "-100000000000000000"  // coll decrease of 0.1 ETH 
    const amountCLV_2 = "10000000000000000000" // debt increase of 10 CLV 
    const gasResults = await th.adjustLoan_allAccounts(_10_Accounts, contracts, amountETH_2, amountCLV_2)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'adjustLoan(). 30 accounts, each account adjusts up by random amounts. No size range transition'
    await borrowerOperations.openLoan(0, accounts[999], { from: accounts[999], value: dec(100, 'ether') })

    const amountETH = dec(10, 'ether')
    const amountCLV = dec(100, 18)
    await th.openLoan_allAccounts(_30_Accounts, contracts, amountETH, amountCLV)

    // Randomly add between 1-9 ETH, and withdraw 1-100 CLV
    const gasResults = await th.adjustLoan_allAccounts_randomAmount(_30_Accounts, contracts, 1, 9, 1, 100)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'adjustLoan(). 40 accounts, each account adjusts up by random amounts. HAS size range transition'
    await borrowerOperations.openLoan(0, accounts[999], { from: accounts[999], value: dec(100, 'ether') })

    const amountETH = dec(9, 'ether')
    const amountCLV = dec(100, 18)
    await th.openLoan_allAccounts(_40_Accounts, contracts, amountETH, amountCLV)
    // Randomly add between 1-9 ETH, and withdraw 1-100 CLV
    const gasResults = await th.adjustLoan_allAccounts_randomAmount(_40_Accounts, contracts, 1, 9, 1, 100)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- closeLoan() ---

  it("", async () => {
    const message = 'closeLoan(), 10 accounts, 1 account closes its loan'
    await th.openLoan_allAccounts_decreasingCLVAmounts(_10_Accounts, contracts, dec(10, 'ether'), 200)

    const tx = await borrowerOperations.closeLoan({ from: accounts[1] })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'closeLoan(), 20 accounts, each account adds 10 ether and issues less CLV than the previous one. First 10 accounts close their loan. '

    await th.openLoan_allAccounts_decreasingCLVAmounts(_20_Accounts, contracts, dec(10, 'ether'), 200)

    const gasResults = await th.closeLoan_allAccounts(_20_Accounts.slice(1), contracts)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- addColl() ---

  it("", async () => {
    const message = 'addColl(), second deposit, 0 other CDPs in system. Adds 10 ether'
    await th.openLoan_allAccounts([accounts[2]], contracts, dec(10, 'ether'), 0)

    const tx = await borrowerOperations.addColl(accounts[2], accounts[2], { from: accounts[2], value: dec(10, 'ether') })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'addColl(), second deposit, 10 existing CDPs in system. Adds 10 ether'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)

    await th.openLoan_allAccounts([accounts[99]], contracts, dec(10, 'ether'), 0)
    const tx = await borrowerOperations.addColl(accounts[99], accounts[99], { from: accounts[99], value: dec(10, 'ether') })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'addColl(), second deposit, 10 accounts, each account adds 10 ether'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)

    const gasResults = await th.addColl_allAccounts(_10_Accounts, contracts, dec(10, 'ether'))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'addColl(), second deposit, 30 accounts, each account adds random amount. No size range transition'
    const amount = dec(10, 'ether')
    await th.openLoan_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)

    const gasResults = await th.addColl_allAccounts_randomAmount(0.000000001, 10000, _30_Accounts, contracts)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'addColl(), second deposit, 30 accounts, each account adds random amount. HAS size range transition'
    const amount = dec(10, 'ether')
    await th.openLoan_allAccounts(_30_Accounts, contracts, dec(9, 'ether'), 0)

    const gasResults = await th.addColl_allAccounts_randomAmount(0.000000001, 10000, _30_Accounts, contracts)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- withdrawColl() ---

  it("", async () => {
    const message = 'withdrawColl(), first withdrawal. 10 accounts in system. 1 account withdraws 5 ether'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)

    const tx = await borrowerOperations.withdrawColl(dec(5, 'ether'), accounts[9], { from: accounts[9] })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'withdrawColl(), first withdrawal, 10 accounts, each account withdraws 5 ether'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)

    const gasResults = await th.withdrawColl_allAccounts(_10_Accounts, contracts, dec(5, 'ether'))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawColl(), second withdrawal, 10 accounts, each account withdraws 5 ether'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawColl_allAccounts(_10_Accounts, contracts, dec(1, 'ether'))

    const gasResults = await th.withdrawColl_allAccounts(_10_Accounts, contracts, dec(5, 'ether'))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawColl(), first withdrawal, 30 accounts, each account withdraws random amount. No size range transition'
    await th.openLoan_allAccounts(_30_Accounts, contracts, dec(9, 'ether'), 0)

    const gasResults = await th.withdrawColl_allAccounts_randomAmount(1, 8, _30_Accounts, contracts)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawColl(), first withdrawal, 30 accounts, each account withdraws random amount. HAS size range transition'
    await th.openLoan_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)

    const gasResults = await th.withdrawColl_allAccounts_randomAmount(1, 8, _30_Accounts, contracts)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawColl(), second withdrawal, 10 accounts, each account withdraws random amount'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawColl_allAccounts(_10_Accounts, contracts, dec(1, 'ether'))

    const gasResults = await th.withdrawColl_allAccounts_randomAmount(1, 8, _10_Accounts, contracts)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- withdrawCLV() --- 

  it("", async () => {
    const message = 'withdrawCLV(), first withdrawal, 10 accounts, each account withdraws 100 CLV'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)

    const gasResults = await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(100, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawCLV(), second withdrawal, 10 accounts, each account withdraws 100 CLV'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(100, 18))

    const gasResults = await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(100, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawCLV(), first withdrawal, 30 accounts, each account withdraws a random CLV amount'
    await th.openLoan_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)

    const gasResults = await th.withdrawCLV_allAccounts_randomAmount(1, 180, _30_Accounts, contracts)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawCLV(), second withdrawal, 30 accounts, each account withdraws a random CLV amount'
    await th.openLoan_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_30_Accounts, contracts, dec(100, 18))

    const gasResults = await th.withdrawCLV_allAccounts_randomAmount(1, 70, _30_Accounts, contracts)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- repayCLV() ---

  it("", async () => {
    const message = 'repayCLV(), partial repayment, 10 accounts, repay 30 CLV (of 100 CLV)'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(100, 18))

    const gasResults = await th.repayCLV_allAccounts(_10_Accounts, contracts, dec(30, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'repayCLV(), second partial repayment, 10 accounts, repay 30 CLV (of 70 CLV)'
    await th.openLoan_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_30_Accounts, contracts, dec(100, 18))
    await th.repayCLV_allAccounts(_30_Accounts, contracts, dec(30, 18))

    const gasResults = await th.repayCLV_allAccounts(_30_Accounts, contracts, dec(30, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'repayCLV(), partial repayment, 30 accounts, repay random amount of CLV (of 100 CLV)'
    await th.openLoan_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_30_Accounts, contracts, dec(100, 18))

    const gasResults = await th.repayCLV_allAccounts_randomAmount(1, 99, _30_Accounts, contracts)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'repayCLV(), first repayment, 10 accounts, repay in full (100 of 100 CLV)'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(100, 18))

    const gasResults = await th.repayCLV_allAccounts(_10_Accounts, contracts, dec(100, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'repayCLV(), first repayment, 30 accounts, repay in full (50 of 50 CLV)'
    await th.openLoan_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_30_Accounts, contracts, dec(100, 18))
    await th.repayCLV_allAccounts(_30_Accounts, contracts, dec(50, 18))

    const gasResults = await th.repayCLV_allAccounts(_30_Accounts, contracts, dec(50, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- getCurrentICR() ---

  it("", async () => {
    const message = 'single getCurrentICR() call'

    await th.openLoan_allAccounts([accounts[1]], contracts, dec(10, 'ether'), 0)
    const randCLVAmount = th.randAmountInWei(1, 180)
    await borrowerOperations.withdrawCLV(randCLVAmount, accounts[1], { from: accounts[1] })

    const price = await priceFeed.getPrice()
    const tx = await functionCaller.cdpManager_getCurrentICR(accounts[1], price)

    const gas = th.gasUsed(tx) - 21000
    th.logGas(gas, message)
  })

  it("", async () => {
    const message = 'getCurrentICR(), new CDPs with 10 ether and no withdrawals'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'getCurrentICR(), CDPs with 10 ether and 100 CLV withdrawn'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(100, 18))

    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'getCurrentICR(), CDPs with 10 ether and random CLV amount withdrawn'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts_randomAmount(1, 1800, _10_Accounts, contracts)

    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- getCurrentICR() with pending distribution rewards ---

  it("", async () => {
    const message = 'single getCurrentICR() call, WITH pending rewards'

    const randCLVAmount = th.randAmountInWei(1, 180)
    await borrowerOperations.openLoan(randCLVAmount, accounts[1], { from: accounts[1], value: dec(10, 'ether') })

    // acct 999 adds coll, withdraws CLV, sits at 111% ICR
    await borrowerOperations.openLoan(dec(170, 18), accounts[999], { from: accounts[999], value: dec(1, 'ether') })

    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[999], { from: accounts[0] })

    const price = await priceFeed.getPrice()
    const tx = await functionCaller.cdpManager_getCurrentICR(accounts[1], price)

    const gas = th.gasUsed(tx) - 21000
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'getCurrentICR(), new CDPs with 10 ether and no withdrawals,  WITH pending rewards'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), dec(100, 18))

    // acct 999 adds coll, withdraws CLV, sits at 111% ICR
    await borrowerOperations.openLoan(dec(170, 18), accounts[999], { from: accounts[999], value: dec(1, 'ether') })

    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[999], { from: accounts[0] })

    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'getCurrentICR(), CDPs with 10 ether and 100 CLV withdrawn, WITH pending rewards'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), dec(100, 18))

    // acct 999 adds coll, withdraws CLV, sits at 111% ICR
    await borrowerOperations.openLoan(dec(170, 18), accounts[999], { from: accounts[999], value: dec(1, 'ether') })


    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[999], { from: accounts[0] })

    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'getCurrentICR(), CDPs with 10 ether and random CLV amount withdrawn, WITH pending rewards'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), dec(100, 18))

    // acct 999 adds coll, withdraws CLV, sits at 111% ICR
    await borrowerOperations.openLoan(dec(170, 18), accounts[999], { from: accounts[999], value: dec(1, 'ether') })

    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[999], { from: accounts[0] })

    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- redeemCollateral() ---
  it("", async () => {
    const message = 'redeemCollateral(), redeems 50 CLV, redemption hits 1 CDP. One account in system, partial redemption'
    await th.openLoan_allAccounts([accounts[0]], contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts([accounts[0]], contracts, dec(100, 18))

    const gas = await th.redeemCollateral(accounts[0], contracts, dec(50, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeems 50 CLV, redemption hits 1 CDP. No pending rewards. 3 accounts in system, partial redemption'
    // 3 accounts add coll
    await th.openLoan_allAccounts(accounts.slice(0, 3), contracts, dec(10, 'ether'), 0)
    // 3 accounts withdraw successively less CLV
    await borrowerOperations.withdrawCLV(dec(100, 18), accounts[0], { from: accounts[0] })
    await borrowerOperations.withdrawCLV(dec(90, 18), accounts[1], { from: accounts[1] })
    await borrowerOperations.withdrawCLV(dec(80, 18), accounts[2], { from: accounts[2] })

    /* Account 2 redeems 50 CLV. It is redeemed from account 0's CDP, 
    leaving the CDP active with 30 CLV and ((200 *10 - 50 ) / 200 ) = 9.75 ETH. 
    
    It's ICR jumps from 2500% to 6500% and it is reinserted at the top of the list.
    */

    const gas = await th.redeemCollateral(accounts[2], contracts, dec(50, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 101 CLV, redemption hits 2 CDPs, last redemption is partial'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 500 CLV, redeems 101 CLV
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawCLV(dec(500, 18), whale, { from: whale })

    const gas = await th.redeemCollateral(whale, contracts, dec(101, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 500 CLV, redemption hits 5 CDPs, all full redemptions'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 500 CLV, redeems 500 CLV
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawCLV(dec(500, 18), whale, { from: whale })

    const gas = await th.redeemCollateral(whale, contracts, dec(500, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 450 CLV, redemption hits 5 CDPs,  last redemption is partial (50 of 100 CLV)'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 450 CLV, redeems 500 CLV
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawCLV(dec(450, 18), whale, { from: whale })

    const gas = await th.redeemCollateral(whale, contracts, dec(450, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 1000 CLV, redemption hits 10 CDPs'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 1000 CLV, redeems 500 CLV
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawCLV(dec(1000, 18), whale, { from: whale })
    const gas = await th.redeemCollateral(whale, contracts, dec(1000, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 1500 CLV, redemption hits 15 CDPs'
    await th.openLoan_allAccounts(_20_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_20_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 1500 CLV, redeems 1500 CLV
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawCLV(dec(1500, 18), whale, { from: whale })
    const gas = await th.redeemCollateral(whale, contracts, dec(1500, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 2000 CLV, redemption hits 20 CDPs'
    await th.openLoan_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_30_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 2000 CLV, redeems 2000 CLV
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawCLV(dec(2000, 18), whale, { from: whale })
    const gas = await th.redeemCollateral(whale, contracts, dec(2000, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // Slow test

  // it("", async () => { 
  //   const message = 'redeemCollateral(),  CLV, each redemption only hits the first CDP, never closes it'
  //   await th.addColl_allAccounts(_20_Accounts, cdpManager, dec(10, 'ether'))
  //   await th.withdrawCLV_allAccounts(_20_Accounts, cdpManager, dec(100, 18))

  //   const gasResults = await th.redeemCollateral_allAccounts_randomAmount( 1, 10, _10_Accounts, cdpManager)
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  // --- redeemCollateral(), with pending redistribution rewards --- 

  it("", async () => {
    const message = 'redeemCollateral(), redeems 50 CLV, redemption hits 1 CDP, WITH pending rewards. One account in system'
    await th.openLoan_allAccounts([accounts[1]], contracts, dec(10, 'ether'), 0)
    await borrowerOperations.withdrawCLV(dec(100, 18), accounts[1], { from: accounts[1] })

    // acct 998 adds coll, withdraws CLV, sits at 111% ICR
    await th.openLoan_allAccounts([accounts[998]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[998], { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[998], { from: accounts[0] })

    const gas = await th.redeemCollateral(accounts[1], contracts, dec(50, 18))

    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeems 50 CLV, redemption hits 1 CDP. WITH pending rewards. 3 accounts in system.'
    // 3 accounts add coll
    await th.openLoan_allAccounts(accounts.slice(0, 3), contracts, dec(10, 'ether'), 0)
    // 3 accounts withdraw successively less CLV
    await borrowerOperations.withdrawCLV(dec(100, 18), accounts[0], { from: accounts[0] })
    await borrowerOperations.withdrawCLV(dec(90, 18), accounts[1], { from: accounts[1] })
    await borrowerOperations.withdrawCLV(dec(80, 18), accounts[2], { from: accounts[2] })

    // acct 999 adds coll, withdraws CLV, sits at 111% ICR
    await th.openLoan_allAccounts([accounts[998]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[998], { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[998], { from: accounts[0] })

    /* Account 2 redeems 50 CLV. It is redeemed from account 0's CDP, 
    leaving the CDP active with 30 CLV and ((200 *10 - 50 ) / 200 ) = 9.75 ETH. 
    
    It's ICR jumps from 2500% to 6500% and it is reinserted at the top of the list.
    */

    const gas = await th.redeemCollateral(accounts[2], contracts, dec(50, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 500 CLV, WITH pending rewards, redemption hits 5 CDPs, WITH pending rewards'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 500 CLV, redeems 500 CLV
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawCLV(dec(500, 18), whale, { from: whale })

    // acct 998 adds coll, withdraws CLV, sits at 111% ICR
    await th.openLoan_allAccounts([accounts[998]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[998], { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[998], { from: accounts[0] })

    const gas = await th.redeemCollateral(whale, contracts, dec(500, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 1000 CLV, WITH pending rewards, redemption hits 10 CDPs, WITH pending rewards'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 1000 CLV, redeems 500 CLV
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawCLV(dec(1000, 18), whale, { from: whale })

    // acct 998 adds coll, withdraws CLV, sits at 111% ICR
    await th.openLoan_allAccounts([accounts[998]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[998], { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[998], { from: accounts[0] })

    const gas = await th.redeemCollateral(whale, contracts, dec(1000, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 1500 CLV, WITH pending rewards, redemption hits 15 CDPs, WITH pending rewards'
    await th.openLoan_allAccounts(_20_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_20_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 1500 CLV, redeems 1500 CLV
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawCLV(dec(1500, 18), whale, { from: whale })

    //  // acct 998 adds coll, withdraws CLV, sits at 111% ICR
    await th.openLoan_allAccounts([accounts[998]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[998], { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[998], { from: accounts[0] })

    const gas = await th.redeemCollateral(whale, contracts, dec(1500, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 2000 CLV, WITH pending rewards, redemption hits 20 CDPs, WITH pending rewards'
    await th.openLoan_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_30_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 2000 CLV, redeems 2000 CLV
    await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawCLV(dec(2000, 18), whale, { from: whale })

    // acct 998 adds coll, withdraws CLV, sits at 111% ICR
    await th.openLoan_allAccounts([accounts[998]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[998], { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[998], { from: accounts[0] })

    const gas = await th.redeemCollateral(whale, contracts, dec(2000, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // Slow test

  // it("", async () => { 
  //   const message = 'redeemCollateral(),  CLV, each redemption only hits the first CDP, never closes it, WITH pending rewards'
  //   await th.addColl_allAccounts(_20_Accounts, cdpManager, dec(10, 'ether'))
  //   await th.withdrawCLV_allAccounts(_20_Accounts, cdpManager, dec(100, 18))

  //    // acct 999 adds coll, withdraws CLV, sits at 111% ICR
  //    await borrowerOperations.addColl(accounts[999], {from: accounts[999], value:dec(1, 'ether')})
  //    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[999], { from: accounts[999]})

  //     // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
  //    await priceFeed.setPrice(dec(100, 18))
  //    await cdpManager.liquidate(accounts[999], { from: accounts[0]})

  //   const gasResults = await th.redeemCollateral_allAccounts_randomAmount( 1, 10, _10_Accounts, cdpManager)
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })


  // --- getApproxHint() ---

  // it("", async () => {
  //   const message = 'getApproxHint(), numTrials = 10, 10 calls, each with random CR'
  //   await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0 )
  //   await th.withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, borrowerOperations)

  //   gasCostList = []

  //   for (i = 0; i < 10; i++) {
  //     randomCR = th.randAmountInWei(1, 5)
  //     const tx = await functionCaller.cdpManager_getApproxHint(randomCR, 10)
  //     const gas = th.gasUsed(tx) - 21000
  //     gasCostList.push(gas)
  //   }

  //   const gasResults = th.getGasMetrics(gasCostList)
  //   th.logGasMetrics(gasResults)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  // it("", async () => {
  //   const message = 'getApproxHint(), numTrials = 10:  i.e. k = 1, list size = 1'
  //   await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0 )
  //   await th.withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, borrowerOperations)

  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.cdpManager_getApproxHint(CR, 10)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // it("", async () => {
  //   const message = 'getApproxHint(), numTrials = 32:  i.e. k = 10, list size = 10'
  //   await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0 )
  //   await th.withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, borrowerOperations)


  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.cdpManager_getApproxHint(CR, 32)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // it("", async () => {
  //   const message = 'getApproxHint(), numTrials = 100: i.e. k = 10, list size = 100'
  //   await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0 )
  //   await th.withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, borrowerOperations)

  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.cdpManager_getApproxHint(CR, 100)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // Slow tests

  // it("", async () => { //8mil. gas
  //   const message = 'getApproxHint(), numTrials = 320: i.e. k = 10, list size = 1000'
  //   await th.addColl_allAccounts(_10_Accounts, cdpManager, dec(10, 'ether'))
  //   await th.withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)

  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.cdpManager_getApproxHint(CR, 320)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({gas: gas}, message, data)
  // })

  // it("", async () => { // 25mil. gas
  //   const message = 'getApproxHint(), numTrials = 1000:  i.e. k = 10, list size = 10000'
  //   await th.addColl_allAccounts(_10_Accounts, cdpManager, dec(10, 'ether'))
  //   await th.withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)

  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.cdpManager_getApproxHint(CR, 1000)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({gas: gas}, message, data)
  // })

  // it("", async () => { // 81mil. gas
  //   const message = 'getApproxHint(), numTrials = 3200:  i.e. k = 10, list size = 100000'
  //   await th.addColl_allAccounts(_10_Accounts, cdpManager, dec(10, 'ether'))
  //   await th.withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)

  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.cdpManager_getApproxHint(CR, 3200)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({gas: gas}, message, data)
  // })


  // Test hangs 

  // it("", async () => { 
  //   const message = 'getApproxHint(), numTrials = 10000:  i.e. k = 10, list size = 1000000'
  //   await th.addColl_allAccounts(_10_Accounts, cdpManager, dec(10, 'ether'))
  //   await th.withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)

  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.cdpManager_getApproxHint(CR, 10000)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({gas: gas}, message, data)
  // })

  // --- PoolManager functions ---

  // --- provideToSP(): No pending rewards

  // --- First deposit ---

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, part of issued CLV: all accounts withdraw 180 CLV, all make first deposit, provide 100 CLV'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(180, 18))

    // first funds provided
    const gasResults = await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(100, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, all issued CLV: all accounts withdraw 180 CLV, all make first deposit, 180 CLV'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(180, 18))

    // first funds provided
    const gasResults = await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(180, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, all accounts withdraw 180 CLV, all make first deposit, random CLV amount'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(180, 18))

    // first funds provided
    const gasResults = await th.provideToSP_allAccounts_randomAmount(1, 179, _10_Accounts, stabilityPool)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  //    // --- Top-up deposit ---

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, deposit part of issued CLV: all accounts withdraw 180 CLV, all make second deposit, provide 50 CLV'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(180, 18))
    await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(50, 18))

    // >>FF time and one account tops up, triggers LQTY gains for all
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
    await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: _10_Accounts[0] })

    // Check the other accounts have LQTY gain
    for (account of _10_Accounts.slice(1)) {
      const LQTYGain = await stabilityPool.getDepositorLQTYGain(account)
      assert.isTrue(LQTYGain.gt(toBN('0')))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // top-up of StabilityPool Deposit
    const gasResults = await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(50, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, deposit all issued CLV: all accounts withdraw 180 CLV, make second deposit, provide 90 CLV'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(180, 18))
    await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(90, 18))

    // >>FF time and one account tops up, triggers LQTY gains for all
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
    await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: _10_Accounts[0] })

    // Check the other accounts have LQTY gain
    for (account of _10_Accounts.slice(1)) {
      const LQTYGain = await stabilityPool.getDepositorLQTYGain(account)
      assert.isTrue(LQTYGain.gt(toBN('0')))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // top-up of StabilityPool Deposit
    const gasResults = await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(90, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, all accounts withdraw 180 CLV, make second deposit, random CLV amount'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(_10_Accounts, contracts, dec(180, 18))
    await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(90, 18))

    // >>FF time and one account tops up, triggers LQTY gains for all
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
    await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: _10_Accounts[0] })

    // Check the other accounts have LQTY gain
    for (account of _10_Accounts.slice(1)) {
      const LQTYGain = await stabilityPool.getDepositorLQTYGain(account)
      assert.isTrue(LQTYGain.gt(toBN('0')))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // top-up of StabilityPool Deposit
    const gasResults = await th.provideToSP_allAccounts_randomAmount(1, 89, _10_Accounts, stabilityPool)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  //   // --- provideToSP(): Pending rewards

  //   // --- Top-up deposit ---

  it("", async () => {
    const message = 'provideToSP(), with pending rewards in system. deposit part of issued CLV: all accounts make second deposit, provide 50 CLV'
    // 9 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 50 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(2, 12), contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(accounts.slice(2, 12), contracts, dec(180, 18))
    await th.provideToSP_allAccounts(accounts.slice(2, 12), stabilityPool, dec(50, 18))

    //1 acct open CDP with 1 ether and withdraws 170 CLV
    await borrowerOperations.openLoan(dec(170, 18), accounts[1], { from: accounts[1], value: dec(1, 'ether') })

    // >>FF time and one account tops up, triggers LQTY gains for all
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops, account 1 liquidated
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[1], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[1]))

    // Check accounts have LQTY gains from liquidations
    for (account of accounts.slice(2, 12)) {
      const LQTYGain = await stabilityPool.getDepositorLQTYGain(account)
      assert.isTrue(LQTYGain.gt(toBN('0')))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // 9 active CDPs top up their Stability Pool deposits with 50 CLV
    const gasResults = await th.provideToSP_allAccounts(accounts.slice(2, 11), stabilityPool, dec(50, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'provideToSP(), with pending rewards in system. deposit all issued CLV: all accounts make second deposit, provide 90 CLV'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 90 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(2, 12), contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(accounts.slice(2, 12), contracts, dec(180, 18))
    await th.provideToSP_allAccounts(accounts.slice(2, 12), stabilityPool, dec(90, 18))

    //1 acct open CDP with 1 ether and withdraws 170 CLV
    await borrowerOperations.openLoan(dec(170, 18), accounts[1], { from: accounts[1], value: dec(1, 'ether') })

    // >>FF time and one account tops up, triggers LQTY gains for all
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops, account[1] is liquidated
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[1], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[1]))

    // Check accounts have LQTY gains from liquidations
    for (account of accounts.slice(2, 12)) {
      const LQTYGain = await stabilityPool.getDepositorLQTYGain(account)
      assert.isTrue(LQTYGain.gt(toBN('0')))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // 5 active CDPs top up their Stability Pool deposits with 90 CLV, using up all their issued CLV
    const gasResults = await th.provideToSP_allAccounts(accounts.slice(7, 12), stabilityPool, dec(90, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'provideToSP(), with pending rewards in system. deposit part of issued CLV: all make second deposit, provide random CLV amount'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 90 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(2, 12), contracts, dec(10, 'ether'), dec(180, 18))
    await th.provideToSP_allAccounts(accounts.slice(2, 12), stabilityPool, dec(90, 18))

    //1 acct open CDP with 1 ether and withdraws 170 CLV
    await borrowerOperations.openLoan(dec(170, 18), accounts[1], { from: accounts[1], value: dec(1, 'ether') })

    // >>FF time and one account tops up, triggers LQTY gains for all
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops, account[1] is liquidated
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[1], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[1]))

    // Check accounts have LQTY gains from liquidations
    for (account of accounts.slice(2, 12)) {
      const LQTYGain = await stabilityPool.getDepositorLQTYGain(account)
      assert.isTrue(LQTYGain.gt(toBN('0')))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // 5 active CDPs top up their Stability Pool deposits with a random CLV amount
    const gasResults = await th.provideToSP_allAccounts_randomAmount(1, 89, accounts.slice(7, 12), stabilityPool)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- withdrawFromSP() ---

  // --- No pending rewards ---

  // partial
  it("", async () => {
    const message = 'withdrawFromSP(), no pending rewards. Stability Pool depositors make partial withdrawal - 90 CLV of 180 CLV deposit'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), dec(190, 18))
    await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(180, 18))

    // >>FF time and one account tops up, triggers LQTY gains for all
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
    await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: _10_Accounts[0] })

    // Check the other accounts have LQTY gain
    for (account of _10_Accounts.slice(1)) {
      const LQTYGain = await stabilityPool.getDepositorLQTYGain(account)
      assert.isTrue(LQTYGain.gt(toBN('0')))
    }
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const gasResults = await th.withdrawFromSP_allAccounts(_10_Accounts, stabilityPool, dec(90, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // full
  it("", async () => {
    const message = 'withdrawFromSP(), no pending rewards. Stability Pool depositors make full withdrawal - 180 CLV of 180 CLV deposit'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), dec(190, 18))
    await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(180, 18))

    // >>FF time and one account tops up, triggers LQTY gains for all
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
    await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: _10_Accounts[0] })

    // Check the other accounts have LQTY gain
    for (account of _10_Accounts.slice(1)) {
      const LQTYGain = await stabilityPool.getDepositorLQTYGain(account)
      assert.isTrue(LQTYGain.gt(toBN('0')))
    }
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const gasResults = await th.withdrawFromSP_allAccounts(_10_Accounts, stabilityPool, dec(180, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // random amount
  it("", async () => {
    const message = 'withdrawFromSP(), no pending rewards. Stability Pool depositors make partial withdrawal - random CLV amount, less than 180 CLV deposit'
    await th.openLoan_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), dec(180, 18))
    await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(180, 18))

    const gasResults = await th.withdrawFromSP_allAccounts_randomAmount(1, 179, _10_Accounts, stabilityPool)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })


  // // --- withdrawFromSP() ---

  // // --- Pending rewards in system ---

  it("", async () => {
    const message = 'withdrawFromSP(), pending rewards in system. Stability Pool depositors make partial withdrawal - 90 CLV of 180 CLV deposit'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(2, 12), contracts, dec(10, 'ether'), dec(180, 18))
    await th.provideToSP_allAccounts(accounts.slice(2, 12), stabilityPool, dec(180, 18))

    //1 acct open CDP with 1 ether and withdraws 170 CLV
    await borrowerOperations.openLoan(0, accounts[1], { from: accounts[1], value: dec(1, 'ether') })
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[1], { from: accounts[1] })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops, account[0]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[1], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[1]))

    // Check accounts have LQTY gains from liquidations
    for (account of accounts.slice(2, 12)) {
      const LQTYGain = await stabilityPool.getDepositorLQTYGain(account)
      assert.isTrue(LQTYGain.gt(toBN('0')))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // 5 active CDPs reduce their Stability Pool deposit by 90 CLV
    const gasResults = await th.withdrawFromSP_allAccounts(accounts.slice(7, 12), stabilityPool, dec(90, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawFromSP(), pending rewards in system. Stability Pool depositors make full withdrawal - 180 CLV of 180 CLV deposit'
    // 10 accts each open CDP with 10 ether, withdraw 170 CLV, and provide 180 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(2, 12), contracts, dec(10, 'ether'), dec(180, 18))
    await th.provideToSP_allAccounts(accounts.slice(2, 12), stabilityPool, dec(180, 18))

    //1 acct open CDP with 1 ether and withdraws 170 CLV
    await borrowerOperations.openLoan(0, accounts[1], { from: accounts[1], value: dec(1, 'ether') })
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[1], { from: accounts[1] })


    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops, account[0]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[1], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[1]))

    // Check accounts have LQTY gains from liquidations
    for (account of accounts.slice(2, 12)) {
      const LQTYGain = await stabilityPool.getDepositorLQTYGain(account)
      assert.isTrue(LQTYGain.gt(toBN('0')))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // 5 active CDPs reduce their Stability Pool deposit by 180 CLV
    const gasResults = await th.withdrawFromSP_allAccounts(accounts.slice(7, 12), stabilityPool, dec(180, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawFromSP(), pending rewards in system. Stability Pool depositors make partial withdrawal - random amount of CLV'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(2, 12), contracts, dec(10, 'ether'), dec(180, 18))
    await th.provideToSP_allAccounts(accounts.slice(2, 12), stabilityPool, dec(180, 18))

    //1 acct open CDP with 1 ether and withdraws 170 CLV
    await borrowerOperations.openLoan(0, accounts[1], { from: accounts[1], value: dec(1, 'ether') })
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[1], { from: accounts[1] })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops, account[0]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[1], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[1]))

    // Check accounts have LQTY gains from liquidations
    for (account of accounts.slice(2, 12)) {
      const LQTYGain = await stabilityPool.getDepositorLQTYGain(account)
      assert.isTrue(LQTYGain.gt(toBN('0')))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // 5 active CDPs reduce their Stability Pool deposit by random amount
    const gasResults = await th.withdrawFromSP_allAccounts_randomAmount(1, 179, accounts.slice(7, 12), stabilityPool)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- withdrawETHGainToTrove() ---

  // --- withdrawETHGainToTrove() - deposit has pending rewards ---
  it("", async () => {
    const message = 'withdrawETHGainToTrove(), pending rewards in system. Accounts withdraw 180 CLV, provide 180 CLV, then withdraw all to SP after a liquidation'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(2, 12), contracts, dec(10, 'ether'), dec(180, 18))
    await th.provideToSP_allAccounts(accounts.slice(2, 12), stabilityPool, dec(180, 18))

    //1 acct open CDP with 1 ether and withdraws 170 CLV
    await borrowerOperations.openLoan(0, accounts[1], { from: accounts[1], value: dec(1, 'ether') })
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[1], { from: accounts[1] })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops, account[0]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[1], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[1]))

     // Check accounts have LQTY gains from liquidations
     for (account of accounts.slice(2, 12)) {
      const LQTYGain = await stabilityPool.getDepositorLQTYGain(account)
      assert.isTrue(LQTYGain.gt(toBN('0')))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // 5 active CDPs reduce their Stability Pool deposit by 90 CLV
    const gasResults = await th.withdrawETHGainToTrove_allAccounts(accounts.slice(7, 12), stabilityPool)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawETHGainToTrove(), pending rewards in system. Accounts withdraw 180 CLV, provide a random amount, then withdraw all to SP after a liquidation'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(2, 12), contracts, dec(10, 'ether'), dec(180, 18))
    await await th.provideToSP_allAccounts_randomAmount(1, 179, accounts.slice(2, 12), stabilityPool)

    //1 acct open CDP with 1 ether and withdraws 170 CLV
    await borrowerOperations.openLoan(0, accounts[1], { from: accounts[1], value: dec(1, 'ether') })
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[1], { from: accounts[1] })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
  
    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))
    await cdpManager.liquidate(accounts[1], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[1]))

       // Check accounts have LQTY gains from liquidations
       for (account of accounts.slice(2, 12)) {
        const LQTYGain = await stabilityPool.getDepositorLQTYGain(account)
        assert.isTrue(LQTYGain.gt(toBN('0')))
      }
  
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
  
    // 5 active CDPs reduce their Stability Pool deposit by 90 CLV
    const gasResults = await th.withdrawETHGainToTrove_allAccounts(accounts.slice(7, 12), stabilityPool)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- liquidate() ---

  // Pure redistribution WITH pending rewards
  it("", async () => {
    const message = 'Single liquidate() call. Liquidee has pending rewards. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV
    await th.openLoan_allAccounts(accounts.slice(100, 110), contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(accounts.slice(100, 110), contracts, dec(180, 18))

    //6s acct open CDP with 1 ether and withdraw 180 CLV (inc gas comp)
    await th.openLoan_allAccounts(accounts.slice(0, 6), contracts, dec(1, 'ether'), dec(180, 18))
    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Initial distribution liquidations make system reward terms and Default Pool non-zero
    const tx1 = await cdpManager.liquidate(accounts[2], { from: accounts[0] })
    // const gas1 = th.gasUsed(tx1)
    // th.logGas(gas1, message)
    const tx2 = await cdpManager.liquidate(accounts[3], { from: accounts[0] })
    // const gas2 = th.gasUsed(tx2)
    // th.logGas(gas2, message)

    assert.isTrue(await sortedCDPs.contains(accounts[1]))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const tx5 = await cdpManager.liquidate(accounts[1], { from: accounts[0] })

    assert.isFalse(await sortedCDPs.contains(accounts[1]))
    const gas5 = th.gasUsed(tx5)
    th.logGas(gas5, message)

    th.appendData({ gas: gas5 }, message, data)
  })

  it("", async () => {
    const message = 'Series of liquidate() calls. Liquidee has pending rewards. Pure redistribution'
    // 100 accts each open CDP with 10 ether, withdraw 180 CLV
    await th.openLoan_allAccounts(accounts.slice(100, 200), contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(accounts.slice(100, 200), contracts, dec(180, 18))

    const liquidationAcctRange = accounts.slice(1, 10)

    // Accts open CDP with 1 ether and withdraws 180 CLV (inc gas comp)
    await th.openLoan_allAccounts(liquidationAcctRange, contracts, dec(1, 'ether'), 0)
    await th.withdrawCLV_allAccounts(liquidationAcctRange, contracts, dec(180, 18))

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // All loans are liquidated
    for (account of liquidationAcctRange) {
      const hasPendingRewards = await cdpManager.hasPendingRewards(account)
      console.log("Liquidee has pending rewards: " + hasPendingRewards)

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      const tx = await cdpManager.liquidate(account, { from: accounts[0] })
      assert.isFalse(await sortedCDPs.contains(account))

      const gas = th.gasUsed(tx)
      th.logGas(gas, message)
    }

    // th.appendData({gas: gas}, message, data)
  })

  // Pure redistribution with NO pending rewards
  it("", async () => {
    const message = 'Single liquidate() call. Liquidee has NO pending rewards. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV
    await th.openLoan_allAccounts(accounts.slice(100, 110), contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(accounts.slice(100, 110), contracts, dec(180, 18))

    //2 acct open CDP with 1 ether and withdraws 180 CLV (inc gas comp)
    await th.openLoan_allAccounts(accounts.slice(2, 4), contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[2], { from: accounts[2] })
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[3], { from: accounts[3] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Initial distribution liquidations make system reward terms and DefaultPool non-zero
    const tx1 = await cdpManager.liquidate(accounts[2], { from: accounts[0] })
    const tx2 = await cdpManager.liquidate(accounts[3], { from: accounts[0] })

    // Account 1 opens loan
    await borrowerOperations.openLoan(dec(90, 18), accounts[1], { from: accounts[1], value: dec(1, 'ether') })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(50, 18))

    assert.isTrue(await sortedCDPs.contains(accounts[1]))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const tx3 = await cdpManager.liquidate(accounts[1], { from: accounts[0] })

    assert.isFalse(await sortedCDPs.contains(accounts[1]))
    const gas = th.gasUsed(tx3)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'Series of liquidate() calls. Liquidee has NO pending rewards. Pure redistribution'

    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(100, 110), contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(accounts.slice(100, 110), contracts, dec(180, 18))

    const liquidationAcctRange = accounts.slice(1, 20)

    for (account of liquidationAcctRange) {
      await priceFeed.setPrice(dec(200, 18))
      await borrowerOperations.openLoan(dec(180, 18), account, { from: account, value: dec(1, 'ether') })

      const hasPendingRewards = await cdpManager.hasPendingRewards(account)
      console.log("Liquidee has pending rewards: " + hasPendingRewards)

      await priceFeed.setPrice(dec(100, 18))

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      const tx = await cdpManager.liquidate(account, { from: accounts[0] })

      assert.isFalse(await sortedCDPs.contains(account))

      const gas = th.gasUsed(tx)
      th.logGas(gas, message)
    }

    // th.appendData({gas: gas}, message, data)
  })

  // Pure offset with NO pending rewards
  it("", async () => {
    const message = 'Single liquidate() call. Liquidee has NO pending rewards. Pure offset with SP'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV
    await th.openLoan_allAccounts(accounts.slice(100, 110), contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(accounts.slice(100, 110), contracts, dec(180, 18))

    //3 acct open CDP with 1 ether and withdraws 180 CLV (inc gas comp)
    await th.openLoan_allAccounts(accounts.slice(0, 4), contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[1], { from: accounts[1] })
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[2], { from: accounts[2] })
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[3], { from: accounts[3] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 100 provides 600 CLV to pool
    await borrowerOperations.withdrawCLV(dec(600, 18), accounts[100], { from: accounts[100] })
    await stabilityPool.provideToSP(dec(600, 18), ZERO_ADDRESS, { from: accounts[100] })

    // Initial liquidations - full offset - makes SP reward terms and SP non-zero
    await cdpManager.liquidate(accounts[2], { from: accounts[0] })
    await cdpManager.liquidate(accounts[3], { from: accounts[0] })

    const hasPendingRewards = await cdpManager.hasPendingRewards(accounts[1])
    console.log("Liquidee has pending rewards: " + hasPendingRewards)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Account 1 liquidated - full offset
    const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0] })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // Pure offset WITH pending rewards
  it("", async () => {
    const message = 'Single liquidate() call. Liquidee has pending rewards. Pure offset with SP'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV
    await th.openLoan_allAccounts(accounts.slice(100, 110), contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(accounts.slice(100, 110), contracts, dec(180, 18))

    // 5 acct open CDP with 1 ether and withdraws 180 CLV (inc gas comp)
    await th.openLoan_allAccounts(accounts.slice(0, 5), contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[1], { from: accounts[1] })
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[2], { from: accounts[2] })
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[3], { from: accounts[3] })
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[4], { from: accounts[4] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 100 provides 360 CLV to SP
    await borrowerOperations.withdrawCLV(dec(600, 18), accounts[100], { from: accounts[100] })
    await stabilityPool.provideToSP(dec(360, 18), ZERO_ADDRESS, { from: accounts[100] })

    // Initial liquidations - full offset - makes SP reward terms and SP non-zero
    await cdpManager.liquidate(accounts[2], { from: accounts[0] })
    await cdpManager.liquidate(accounts[3], { from: accounts[0] })

    // Pure redistribution - creates pending dist. rewards for account 1
    await cdpManager.liquidate(accounts[4], { from: accounts[0] })

    // Account 5 provides another 200 to the SP
    await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: accounts[100] })

    const hasPendingRewards = await cdpManager.hasPendingRewards(accounts[1])
    console.log("Liquidee has pending rewards: " + hasPendingRewards)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Account 1 liquidated - full offset
    const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0] })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // Partial offset + redistribution WITH pending rewards
  it("", async () => {
    const message = 'Single liquidate() call. Liquidee has pending rewards. Partial offset + redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV
    await th.openLoan_allAccounts(accounts.slice(100, 110), contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(accounts.slice(100, 110), contracts, dec(180, 18))

    //4 acct open CDP with 1 ether and withdraws 180 CLV (inc gas comp)
    await th.openLoan_allAccounts(accounts.slice(0, 4), contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[1], { from: accounts[1] })
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[2], { from: accounts[2] })
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[3], { from: accounts[3] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Set up some "previous" liquidations triggering partial offsets, and pending rewards for all troves
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: accounts[100] })
    await cdpManager.liquidate(accounts[2], { from: accounts[0] })

    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: accounts[101] })
    await cdpManager.liquidate(accounts[3], { from: accounts[0] })

    // pool refilled with 100 CLV
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: accounts[102] })

    const hasPendingRewards = await cdpManager.hasPendingRewards(accounts[1])
    console.log("Liquidee has pending rewards: " + hasPendingRewards)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // account 1 180 CLV liquidated  - partial offset
    const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0] })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // Partial offset + redistribution with NO pending rewards
  it("", async () => {
    const message = 'Single liquidate() call. Liquidee has NO pending rewards. Partial offset + redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV
    await th.openLoan_allAccounts(accounts.slice(100, 110), contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(accounts.slice(100, 110), contracts, dec(180, 18))

    //2 acct open CDP with 1 ether and withdraws 180 CLV (inc gas comp)
    await th.openLoan_allAccounts(accounts.slice(2, 4), contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[2], { from: accounts[2] })
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[3], { from: accounts[3] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Set up some "previous" liquidations that trigger partial offsets, 
    //and create pending rewards for all troves
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: accounts[100] })
    await cdpManager.liquidate(accounts[2], { from: accounts[0] })

    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: accounts[101] })
    await cdpManager.liquidate(accounts[3], { from: accounts[0] })

    // Pool refilled with 50 CLV
    await stabilityPool.provideToSP(dec(50, 18), ZERO_ADDRESS, { from: accounts[102] })

    // Account 1 opens loan
    await borrowerOperations.openLoan(dec(70, 18), accounts[1], { from: accounts[1], value: dec(1, 'ether') })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(50, 18))

    const hasPendingRewards = await cdpManager.hasPendingRewards(accounts[1])
    console.log("Liquidee has pending rewards: " + hasPendingRewards)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // account 1 70 CLV liquidated  - partial offset against 50 CLV in SP
    const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0] })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // With pending dist. rewards and SP gains (still closes) - partial offset (Highest gas cost scenario in Normal Mode)
  it("", async () => {
    const message = 'liquidate() 1 CDP, liquidated CDP has pending SP rewards and redistribution rewards, offset + redistribution.'
    // 10 accts each open CDP with 10 ether
    await th.openLoan_allAccounts(accounts.slice(100, 110), contracts, dec(10, 'ether'), 0)

    //Account 99 and 98 each open CDP with 1 ether, and withdraw 180 CLV (inc gas comp)
    await th.openLoan_allAccounts([accounts[99]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[99], { from: accounts[99] })
    await th.openLoan_allAccounts([accounts[98]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[98], { from: accounts[98] })

    // Acct 99 deposits 1 CLV to SP
    await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: accounts[99] })

    //Account 97 opens CDP with 1 ether and withdraws 180 CLV (inc gas comp)
    await th.openLoan_allAccounts([accounts[97]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[97], { from: accounts[97] })

    // Acct 100 withdraws 1800 CLV and deposits it to the SP
    await borrowerOperations.withdrawCLV(dec(1800, 18), accounts[100], { from: accounts[100] })
    await stabilityPool.provideToSP(dec(1800, 18), ZERO_ADDRESS, { from: accounts[100] })

    // Price drops too $100, accounts 99 and 100 ICR fall below MCR
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    /* Liquidate account 97. Account 97 is completely offset against SP and removed from system.
    This creates SP gains for accounts 99 and 7. */
    await cdpManager.liquidate(accounts[97], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[97]))

    // Acct 100 withdraws deposit and gains from SP
    await stabilityPool.withdrawFromSP(dec(1800, 18), { from: accounts[100] })

    // Account 98 is liquidated, with nothing in SP pool.  This creates pending rewards from distribution.
    await cdpManager.liquidate(accounts[98], { from: accounts[0] })

    // Account 7 deposits 1 CLV in the Stability Pool
    await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: accounts[100] })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const tx = await cdpManager.liquidate(accounts[99], { from: accounts[0] })
    assert.isFalse(await sortedCDPs.contains(accounts[99]))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // pure offset
  it("", async () => {
    const message = 'liquidate() 1 CDP Normal Mode, 30 active CDPs, no ETH gain in pool, pure offset with SP'
    // 30 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(100, 130), contracts, dec(10, 'ether'), 0)
    await th.withdrawCLV_allAccounts(accounts.slice(100, 130), contracts, dec(180, 18))

    await stabilityPool.provideToSP(dec(180, 18), ZERO_ADDRESS, { from: accounts[100] })

    //1 acct open CDP with 1 ether and withdraws 180 CLV (inc gas comp)
    await th.openLoan_allAccounts([accounts[1]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawCLV(dec(170, 18), accounts[1], { from: accounts[1] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
    
    const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0] })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // --- findInsertPosition ---

  // --- Insert at head, 0 traversals ---

  it("", async () => {
    const message = 'findInsertPosition(), 10 CDPs with ICRs 200-209%, ICR > head ICR, no hint, 0 traversals'

    // makes 10 CDPs with ICRs 200 to 209%
    await th.makeCDPsIncreasingICR(_10_Accounts, contracts)

    // 300% ICR, higher than CDP at head of list
    const CR = web3.utils.toWei('3', 'ether')
    const address_0 = '0x0000000000000000000000000000000000000000'

    const price = await priceFeed.getPrice()
    const tx = await functionCaller.sortedCDPs_findInsertPosition(CR, price, address_0, address_0)
    const gas = th.gasUsed(tx) - 21000
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'findInsertPosition(), 50 CDPs with ICRs 200-209%, ICR > head ICR, no hint, 0 traversals'

    // makes 10 CDPs with ICRs 200 to 209%
    await th.makeCDPsIncreasingICR(_50_Accounts, contracts)

    // 300% ICR, higher than CDP at head of list
    const CR = web3.utils.toWei('3', 'ether')
    const address_0 = '0x0000000000000000000000000000000000000000'

    const price = await priceFeed.getPrice()
    const tx = await functionCaller.sortedCDPs_findInsertPosition(CR, price, address_0, address_0)
    const gas = th.gasUsed(tx) - 21000
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // --- Insert at tail, so num. traversals = listSize ---

  it("", async () => {
    const message = 'findInsertPosition(), 10 CDPs with ICRs 200-209%, ICR < tail ICR, no hint, 10 traversals'

    // makes 10 CDPs with ICRs 200 to 209%
    await th.makeCDPsIncreasingICR(_10_Accounts, contracts)

    // 200% ICR, lower than CDP at tail of list
    const CR = web3.utils.toWei('2', 'ether')
    const address_0 = '0x0000000000000000000000000000000000000000'

    const price = await priceFeed.getPrice()
    const tx = await functionCaller.sortedCDPs_findInsertPosition(CR, price, address_0, address_0)
    const gas = th.gasUsed(tx) - 21000
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'findInsertPosition(), 20 CDPs with ICRs 200-219%, ICR <  tail ICR, no hint, 20 traversals'

    // makes 20 CDPs with ICRs 200 to 219%
    await th.makeCDPsIncreasingICR(_20_Accounts, contracts)

    // 200% ICR, lower than CDP at tail of list
    const CR = web3.utils.toWei('2', 'ether')

    const price = await priceFeed.getPrice()
    const tx = await functionCaller.sortedCDPs_findInsertPosition(CR, price, address_0, address_0)
    const gas = th.gasUsed(tx) - 21000
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'findInsertPosition(), 50 CDPs with ICRs 200-249%, ICR <  tail ICR, no hint, 50 traversals'

    // makes 50 CDPs with ICRs 200 to 249%
    await th.makeCDPsIncreasingICR(_50_Accounts, contracts)

    // 200% ICR, lower than CDP at tail of list
    const CR = web3.utils.toWei('2', 'ether')

    const price = await priceFeed.getPrice()
    const tx = await functionCaller.sortedCDPs_findInsertPosition(CR, price, address_0, address_0)
    const gas = th.gasUsed(tx) - 21000
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // --- Write test output data to CSV file

  it("Export test data", async () => {
    fs.writeFile('gasTest/outputs/gasTestData.csv', data, (err) => {
      if (err) { console.log(err) } else {
        console.log("Gas test data written to gasTest/outputs/gasTestData.csv")
      }
    })
  })

})


/* TODO:
-Liquidations in Recovery Mode
---
Parameters to vary for gas tests:
- Number of accounts
- Function call parameters - low, high, random, average of many random
  -Pre-existing state:
  --- Rewards accumulated (or not)
  --- CLV in StabilityPool (or not)
  --- State variables non-zero e.g. CDP already opened, stake already made, etc
  - Steps in the the operation:
  --- number of liquidations to perform
  --- number of loans to redeem from
  --- number of trials to run
  Extremes/edges:
  - Lowest or highest ICR
  - empty list, max size list
  - the only CDP, the newest CDP
  etc.
*/
