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
  let poolManager
  let sortedCDPs
  let cdpManager
  let nameRegistry
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations
  let hintHelpers

  let data = []


  beforeEach(async () => {
    contracts = await deployLiquity()

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
    hintHelpers = contracts.hintHelpers

    const contractAddresses = getAddresses(contracts)
    await connectContracts(contracts, contractAddresses)
  })

  // ---TESTS ---

  it("runs the test helper", async () => {
    assert.equal(th.getDifference('2000','1000'), 1000)
  })

  // --- CDP Manager function calls ---

  // --- openLoan() ---

  it("", async () => {
    const message = 'openLoan(), single account, 0 existing CDPs in system. Adds 10 ether and issues 100 CLV'
    const tx = await borrowerOperations.openLoan(mv._100e18, accounts[2], accounts[2], { from: accounts[2], value: mv._10_Ether })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'openLoan(), single account, 1 existing CDP in system. Adds 10 ether and issues 100 CLV'
    await borrowerOperations.openLoan(mv._100e18, accounts[1], accounts[1], { from: accounts[1], value: mv._10_Ether })

    const tx = await borrowerOperations.openLoan(mv._100e18, accounts[2], accounts[2], { from: accounts[2], value: mv._10_Ether })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'openLoan(), single account, Inserts between 2 existing CDs in system. Adds 10 ether and issues 80 CLV. '

    await borrowerOperations.openLoan(mv._100e18, accounts[1], accounts[1], { from: accounts[1], value: mv._10_Ether })
    await borrowerOperations.openLoan(mv._50e18, accounts[2], accounts[2], { from: accounts[2], value: mv._10_Ether })

    const tx = await borrowerOperations.openLoan(mv._80e18, accounts[3], accounts[3],{ from: accounts[3], value: mv._10_Ether })

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'openLoan(), 10 accounts, each account adds 10 ether and issues 100 CLV'

    const amountETH = mv._10_Ether
    const amountCLV = 0
    const gasResults = await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, amountETH, amountCLV)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'openLoan(), 10 accounts, each account adds 10 ether and issues less CLV than the previous one'
    const amountETH = mv._10_Ether
    const amountCLV = 200
    const gasResults = await th.openLoan_allAccounts_decreasingCLVAmounts(_10_Accounts, borrowerOperations, amountETH, amountCLV)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'openLoan(), 10 accounts, each account adds 20 ether and issues less CLV than the previous one'
    const amountETH = mv._20_Ether
    const amountCLV = 200
    const gasResults = await th.openLoan_allAccounts_decreasingCLVAmounts(_10_Accounts, borrowerOperations, amountETH, amountCLV)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- adjustLoan ---

  it("", async () => {
    const message = 'adjustLoan(). ETH/CLV Increase/Increase. 10 accounts, each account adjusts up -  1 ether and 100 CLV'
    await borrowerOperations.openLoan(0, accounts[999], accounts[999], {from: accounts[999], value: mv._100_Ether})

    const amountETH = mv._10_Ether
    const amountCLV = mv._100e18
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, amountETH, amountCLV)


    const amountETH_2 =mv._1_Ether
    const amountCLV_2 = mv._100e18
    const gasResults = await th.adjustLoan_allAccounts(_10_Accounts, contracts, amountETH_2, amountCLV_2)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'adjustLoan(). ETH/CLV Decrease/Decrease. 10 accounts, each account adjusts down by 0.1 ether and 10 CLV'
   await borrowerOperations.openLoan(0, accounts[999], accounts[999], {from: accounts[999], value: mv._100_Ether})

    const amountETH = mv._10_Ether
    const amountCLV = mv._100e18
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, amountETH, amountCLV)

    const amountETH_2 = "-100000000000000000"  // coll decrease of 0.1 ETH 
    const amountCLV_2 = "-10000000000000000000" // debt decrease of 10 CLV 
    const gasResults = await th.adjustLoan_allAccounts(_10_Accounts, contracts, amountETH_2, amountCLV_2)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'adjustLoan(). ETH/CLV Increase/Decrease. 10 accounts, each account adjusts down by 0.1 ether and 10 CLV'
    await borrowerOperations.openLoan(0, accounts[999], accounts[999], {from: accounts[999], value: mv._100_Ether})

    const amountETH = mv._10_Ether
    const amountCLV = mv._100e18
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, amountETH, amountCLV)

    const amountETH_2 = "100000000000000000"  // coll increase of 0.1 ETH 
    const amountCLV_2 = "-10000000000000000000" // debt decrease of 10 CLV 
    const gasResults = await th.adjustLoan_allAccounts(_10_Accounts, contracts, amountETH_2, amountCLV_2)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'adjustLoan(). ETH/CLV Decrease/Increase. 10 accounts, each account adjusts down by 0.1 ether and 10 CLV'
    await borrowerOperations.openLoan(0, accounts[999], accounts[999], {from: accounts[999], value: mv._100_Ether})

    const amountETH = mv._10_Ether
    const amountCLV = mv._100e18
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, amountETH, amountCLV)

    const amountETH_2 = "-100000000000000000"  // coll increase of 0.1 ETH 
    const amountCLV_2 = "10000000000000000000" // debt decrease of 10 CLV 
    const gasResults = await th.adjustLoan_allAccounts(_10_Accounts, contracts, amountETH_2, amountCLV_2)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'adjustLoan(). 10 accounts, each account adjusts up by a random amount'
    await borrowerOperations.openLoan(0, accounts[999], accounts[999], {from: accounts[999], value: mv._100_Ether})

    const amountETH = mv._10_Ether
    const amountCLV = mv._100e18
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, amountETH, amountCLV)

    const gasResults = await th.adjustLoan_allAccounts_randomAmount(_10_Accounts,  contracts, 1, 1000000, 1, 1000000)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })


  // --- closeLoan() ---

  it("", async () => {
    const message = 'closeLoan(), 10 accounts, 1 account closes its loan'
    await th.openLoan_allAccounts_decreasingCLVAmounts(_10_Accounts, borrowerOperations, mv._10_Ether, 200)

    const tx = await borrowerOperations.closeLoan({ from: accounts[1] })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'closeLoan(), 20 accounts, each account adds 10 ether and issues less CLV than the previous one. First 10 accounts close their loan. '
    await th.openLoan_allAccounts_decreasingCLVAmounts(_20_Accounts, borrowerOperations, mv._10_Ether, 200)

    const gasResults = await th.closeLoan_allAccounts(_10_Accounts, borrowerOperations)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- addColl() ---

  it("", async () => {
    const message = 'addColl(), second deposit, 0 other CDPs in system. Adds 10 ether'
     await th.openLoan_allAccounts([accounts[2]], borrowerOperations, mv._10_Ether, 0 )

    const tx = await borrowerOperations.addColl(accounts[2], accounts[2], accounts[2], { from: accounts[2], value: mv._10_Ether })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'addColl(), second deposit, 10 existing CDPs in system. Adds 10 ether'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )

    await th.openLoan_allAccounts([accounts[99]], borrowerOperations, mv._10_Ether, 0 )
    const tx = await borrowerOperations.addColl(accounts[99], accounts[99], accounts[99], { from: accounts[99], value: mv._10_Ether })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'addColl(), second deposit, 10 accounts, each account adds 10 ether'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )

    const gasResults = await th.addColl_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'addColl(), second deposit, 10 accounts, each account adds random amount'
    const amount = mv._10_Ether
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )

    const gasResults = await th.addColl_allAccounts_randomAmount(0.000000001, 10000, _10_Accounts, borrowerOperations)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- withdrawColl() ---

  it("", async () => {
    const message = 'withdrawColl(), first withdrawal. 10 accounts in system. 1 account withdraws 5 ether'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )

    const tx = await borrowerOperations.withdrawColl(mv._5_Ether, accounts[9], accounts[9], { from: accounts[9] })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'withdrawColl(), first withdrawal, 10 accounts, each account withdraws 5 ether'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )

    const gasResults = await th.withdrawColl_allAccounts(_10_Accounts, borrowerOperations, mv._5_Ether)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawColl(), second withdrawal, 10 accounts, each account withdraws 5 ether'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawColl_allAccounts(_10_Accounts, borrowerOperations,mv._1_Ether)

    const gasResults = await th.withdrawColl_allAccounts(_10_Accounts, borrowerOperations, mv._5_Ether)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawColl(), first withdrawal, 10 accounts, each account withdraws random amount'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )

    const gasResults = await th.withdrawColl_allAccounts_randomAmount(1, 9, _10_Accounts, borrowerOperations)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawColl(), second withdrawal, 10 accounts, each account withdraws random amount'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawColl_allAccounts(_10_Accounts, borrowerOperations,mv._1_Ether)

    const gasResults = await th.withdrawColl_allAccounts_randomAmount(1, 8, _10_Accounts, borrowerOperations)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- withdrawCLV() --- 

  it("", async () => {
    const message = 'withdrawCLV(), first withdrawal, 10 accounts, each account withdraws 100 CLV'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )

    const gasResults = await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawCLV(), second withdrawal, 10 accounts, each account withdraws 100 CLV'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)

    const gasResults = await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawCLV(), first withdrawal, 10 accounts, each account withdraws a random CLV amount'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )

    const gasResults = await th.withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, borrowerOperations)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawCLV(), second withdrawal, 10 accounts, each account withdraws a random CLV amount'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)

    const gasResults = await th.withdrawCLV_allAccounts_randomAmount(1, 80, _10_Accounts, borrowerOperations)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- repayCLV() ---

  it("", async () => {
    const message = 'repayCLV(), partial repayment, 10 accounts, repay 30 CLV (of 100 CLV)'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)

    const gasResults = await th.repayCLV_allAccounts(_10_Accounts, borrowerOperations, mv._30e18)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'repayCLV(), second partial repayment, 10 accounts, repay 30 CLV (of 70 CLV)'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)
    await th.repayCLV_allAccounts(_10_Accounts, borrowerOperations, mv._30e18)

    const gasResults = await th.repayCLV_allAccounts(_10_Accounts, borrowerOperations, mv._30e18)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'repayCLV(), partial repayment, 10 accounts, repay random amount of CLV (of 100 CLV)'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)

    const gasResults = await th.repayCLV_allAccounts_randomAmount(1, 99, _10_Accounts, borrowerOperations)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'repayCLV(), first repayment, 10 accounts, repay in full (100 of 100 CLV)'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)

    const gasResults = await th.repayCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'repayCLV(), first repayment, 10 accounts, repay in full (50 of 50 CLV)'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)
    await th.repayCLV_allAccounts(_10_Accounts, borrowerOperations, mv._50e18)

    const gasResults = await th.repayCLV_allAccounts(_10_Accounts, borrowerOperations, mv._50e18)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- getCurrentICR() ---

  it("", async () => {
    const message = 'single getCurrentICR() call'

    await th.openLoan_allAccounts([accounts[1]], borrowerOperations, mv._10_Ether, 0 )
    const randCLVAmount = th.randAmountInWei(1, 180)
    await borrowerOperations.withdrawCLV(randCLVAmount, accounts[1], accounts[1], { from: accounts[1] })

    const price = await priceFeed.getPrice()
    const tx = await functionCaller.cdpManager_getCurrentICR(accounts[1], price)

    const gas = th.gasUsed(tx) - 21000
    th.logGas(gas, message)
  })

  it("", async () => {
    const message = 'getCurrentICR(), new CDPs with 10 ether and no withdrawals'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'getCurrentICR(), CDPs with 10 ether and 100 CLV withdrawn'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)

    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'getCurrentICR(), CDPs with 10 ether and random CLV amount withdrawn'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts_randomAmount(1, 1800, _10_Accounts, borrowerOperations)

    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'getCurrentICR(), empty CDPs with no ether and no withdrawals'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawColl_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether)

    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- getCurrentICR() with pending distribution rewards ---

  it("", async () => {
    const message = 'single getCurrentICR() call, WITH pending rewards'

    const randCLVAmount = th.randAmountInWei(1, 180)
    await borrowerOperations.openLoan(randCLVAmount, accounts[1], accounts[1], {from: accounts[1], value: mv._10_Ether})

    // acct 999 adds coll, withdraws CLV, sits at 111% ICR
    await borrowerOperations.openLoan(mv._170e18, accounts[999], {from: accounts[999], value: mv._1_Ether})

    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[999], { from: accounts[0] })

    const price = await priceFeed.getPrice()
    const tx = await functionCaller.cdpManager_getCurrentICR(accounts[1], price)

    const gas = th.gasUsed(tx) - 21000
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'getCurrentICR(), new CDPs with 10 ether and no withdrawals,  WITH pending rewards'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, mv._100e18 )

    // acct 999 adds coll, withdraws CLV, sits at 111% ICR
    await borrowerOperations.openLoan(mv._170e18, accounts[999], accounts[999], {from: accounts[999], value: mv._1_Ether})

    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[999], { from: accounts[0] })

    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'getCurrentICR(), CDPs with 10 ether and 100 CLV withdrawn, WITH pending rewards'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, mv._100e18 )

    // acct 999 adds coll, withdraws CLV, sits at 111% ICR
    await borrowerOperations.openLoan(mv._170e18, accounts[999], accounts[999], {from: accounts[999], value: mv._1_Ether})


    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[999], { from: accounts[0] })

    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'getCurrentICR(), CDPs with 10 ether and random CLV amount withdrawn, WITH pending rewards'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, mv._100e18 )

    // acct 999 adds coll, withdraws CLV, sits at 111% ICR
    await borrowerOperations.openLoan(mv._170e18, accounts[999], accounts[999], {from: accounts[999], value: mv._1_Ether})

    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[999], { from: accounts[0] })

    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- redeemCollateral() ---
  it.only("", async () => {
    const message = 'redeemCollateral(), redeems 50 CLV, redemption hits 1 CDP. One account in system, partial redemption'
    await th.openLoan_allAccounts([accounts[0]], borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts([accounts[0]], borrowerOperations, mv._100e18)
    const gas = await th.redeemCollateral(accounts[0], contracts, mv._50e18)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeems 50 CLV, redemption hits 1 CDP. No pending rewards. 3 accounts in system, partial redemption'
    // 3 accounts add coll
    await th.openLoan_allAccounts(accounts.slice(0,3), borrowerOperations, mv._10_Ether, 0 )
    // 3 accounts withdraw successively less CLV
    await borrowerOperations.withdrawCLV(mv._100e18, accounts[0], accounts[0], { from: accounts[0] })
    await borrowerOperations.withdrawCLV(mv._90e18, accounts[1], accounts[1], { from: accounts[1] })
    await borrowerOperations.withdrawCLV(mv._80e18, accounts[2], accounts[2], { from: accounts[2] })

    console.log("acct 2 in list:" + (await sortedCDPs.contains(accounts[2])))
    /* Account 2 redeems 50 CLV. It is redeemed from account 0's CDP, 
    leaving the CDP active with 30 CLV and ((200 *10 - 50 ) / 200 ) = 9.75 ETH. 
    
    It's ICR jumps from 2500% to 6500% and it is reinserted at the top of the list.
    */

    const gas = await th.redeemCollateral(accounts[2], contracts, mv._50e18)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 101 CLV, redemption hits 2 CDPs, last redemption is partial'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)

    // Whale adds 200 ether, withdraws 500 CLV, redeems 101 CLV
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._200_Ether })
    await borrowerOperations.withdrawCLV(mv._500e18, whale, whale, { from: whale })

    console.log("acct 9 in list:" + (await sortedCDPs.contains(whale)))

    const gas = await th.redeemCollateral(whale,contracts, mv._101e18)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 500 CLV, redemption hits 5 CDPs, all full redemptions'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)

    // Whale adds 200 ether, withdraws 500 CLV, redeems 500 CLV
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._200_Ether })
    await borrowerOperations.withdrawCLV(mv._500e18, whale, whale, { from: whale })

    const gas = await th.redeemCollateral(whale, contracts, mv._500e18)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 450 CLV, redemption hits 5 CDPs,  last redemption is partial (50 of 100 CLV)'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)

    // Whale adds 200 ether, withdraws 450 CLV, redeems 500 CLV
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._200_Ether })
    await borrowerOperations.withdrawCLV(mv._450e18, whale, whale, { from: whale })

    const gas = await th.redeemCollateral(whale, contracts, mv._450e18)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 1000 CLV, redemption hits 10 CDPs'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)

    // Whale adds 200 ether, withdraws 1000 CLV, redeems 500 CLV
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._200_Ether })
    await borrowerOperations.withdrawCLV(mv._1000e18, whale, whale, { from: whale })
    const gas = await th.redeemCollateral(whale, contracts, mv._1000e18)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 1500 CLV, redemption hits 15 CDPs'
    await th.openLoan_allAccounts(_20_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_20_Accounts, borrowerOperations, mv._100e18)

    // Whale adds 200 ether, withdraws 1500 CLV, redeems 1500 CLV
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._200_Ether })
    await borrowerOperations.withdrawCLV(mv._1500e18, whale, whale, { from: whale })
    const gas = await th.redeemCollateral(whale, contracts, mv._1500e18)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 2000 CLV, redemption hits 20 CDPs'
    await th.openLoan_allAccounts(_30_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_30_Accounts, borrowerOperations, mv._100e18)

    // Whale adds 200 ether, withdraws 2000 CLV, redeems 2000 CLV
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._200_Ether })
    await borrowerOperations.withdrawCLV(mv._2000e18, whale, whale, { from: whale })
    const gas = await th.redeemCollateral(whale, contracts, mv._2000e18)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // Slow test

  // it("", async () => { 
  //   const message = 'redeemCollateral(),  CLV, each redemption only hits the first CDP, never closes it'
  //   await th.addColl_allAccounts(_20_Accounts, cdpManager, mv._10_Ether)
  //   await th.withdrawCLV_allAccounts(_20_Accounts, cdpManager, mv._100e18)

  //   const gasResults = await th.redeemCollateral_allAccounts_randomAmount( 1, 10, _10_Accounts, cdpManager)
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  // --- redeemCollateral(), with pending redistribution rewards --- 

  it("", async () => {
    const message = 'redeemCollateral(), redeems 50 CLV, redemption hits 1 CDP, WITH pending rewards. One account in system'
    await th.openLoan_allAccounts([accounts[1]], borrowerOperations, mv._10_Ether, 0 )
    await borrowerOperations.withdrawCLV(mv._100e18, accounts[1], accounts[1], { from: accounts[1] })

    // acct 998 adds coll, withdraws CLV, sits at 111% ICR
    await th.openLoan_allAccounts([accounts[998]], borrowerOperations, mv._1_Ether, 0 )
    await borrowerOperations.withdrawCLV(mv._170e18, accounts[998], accounts[998], { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[998], { from: accounts[0] })

    const gas = await th.redeemCollateral(accounts[1], contracts, mv._50e18)

    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeems 50 CLV, redemption hits 1 CDP. WITH pending rewards. 3 accounts in system.'
    // 3 accounts add coll
    await th.openLoan_allAccounts(accounts.slice(0,3), borrowerOperations, mv._10_Ether, 0 )
    // 3 accounts withdraw successively less CLV
    await borrowerOperations.withdrawCLV(mv._100e18, accounts[0], accounts[0], { from: accounts[0] })
    await borrowerOperations.withdrawCLV(mv._90e18, accounts[1], accounts[1], { from: accounts[1] })
    await borrowerOperations.withdrawCLV(mv._80e18, accounts[2], accounts[2], { from: accounts[2] })

    // acct 999 adds coll, withdraws CLV, sits at 111% ICR
    await th.openLoan_allAccounts([accounts[998]], borrowerOperations, mv._1_Ether, 0 )
    await borrowerOperations.withdrawCLV(mv._170e18, accounts[998], accounts[998], { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[998], { from: accounts[0] })

    /* Account 2 redeems 50 CLV. It is redeemed from account 0's CDP, 
    leaving the CDP active with 30 CLV and ((200 *10 - 50 ) / 200 ) = 9.75 ETH. 
    
    It's ICR jumps from 2500% to 6500% and it is reinserted at the top of the list.
    */

    const gas = await th.redeemCollateral(accounts[2], contracts, mv._50e18)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 500 CLV, WITH pending rewards, redemption hits 5 CDPs, WITH pending rewards'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)

    // Whale adds 200 ether, withdraws 500 CLV, redeems 500 CLV
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._200_Ether })
    await borrowerOperations.withdrawCLV(mv._500e18, whale, whale, { from: whale })

    // acct 998 adds coll, withdraws CLV, sits at 111% ICR
    await th.openLoan_allAccounts([accounts[998]], borrowerOperations, mv._1_Ether, 0 )
    await borrowerOperations.withdrawCLV(mv._170e18, accounts[998], accounts[998], { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[998], { from: accounts[0] })

    const gas = await th.redeemCollateral(whale, contracts, mv._500e18)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 1000 CLV, WITH pending rewards, redemption hits 10 CDPs, WITH pending rewards'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._100e18)

    // Whale adds 200 ether, withdraws 1000 CLV, redeems 500 CLV
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._200_Ether })
    await borrowerOperations.withdrawCLV(mv._1000e18, whale, whale, { from: whale })

    // acct 998 adds coll, withdraws CLV, sits at 111% ICR
    await th.openLoan_allAccounts([accounts[998]], borrowerOperations, mv._1_Ether, 0 )
    await borrowerOperations.withdrawCLV(mv._170e18, accounts[998], accounts[998], { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[998], { from: accounts[0] })

    const gas = await th.redeemCollateral(whale,contracts, mv._1000e18)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 1500 CLV, WITH pending rewards, redemption hits 15 CDPs, WITH pending rewards'
    await th.openLoan_allAccounts(_20_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_20_Accounts, borrowerOperations, mv._100e18)

    // Whale adds 200 ether, withdraws 1500 CLV, redeems 1500 CLV
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._200_Ether })
    await borrowerOperations.withdrawCLV(mv._1500e18, whale, whale, { from: whale })

    //  // acct 998 adds coll, withdraws CLV, sits at 111% ICR
    await th.openLoan_allAccounts([accounts[998]], borrowerOperations, mv._1_Ether, 0 )
    await borrowerOperations.withdrawCLV(mv._170e18, accounts[998], accounts[998], { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[998], { from: accounts[0] })

    const gas = await th.redeemCollateral(whale, contracts, mv._1500e18)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 2000 CLV, WITH pending rewards, redemption hits 20 CDPs, WITH pending rewards'
    await th.openLoan_allAccounts(_30_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_30_Accounts, borrowerOperations, mv._100e18)

    // Whale adds 200 ether, withdraws 2000 CLV, redeems 2000 CLV
    await borrowerOperations.openLoan(0, whale, whale, { from: whale, value: mv._200_Ether })
    await borrowerOperations.withdrawCLV(mv._2000e18, whale, whale, { from: whale })

    // acct 998 adds coll, withdraws CLV, sits at 111% ICR
    await th.openLoan_allAccounts([accounts[998]], borrowerOperations, mv._1_Ether, 0 )
    await borrowerOperations.withdrawCLV(mv._170e18, accounts[998], accounts[998], { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[998], { from: accounts[0] })

    const gas = await th.redeemCollateral(whale, contracts, mv._2000e18)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // Slow test

  // it("", async () => { 
  //   const message = 'redeemCollateral(),  CLV, each redemption only hits the first CDP, never closes it, WITH pending rewards'
  //   await th.addColl_allAccounts(_20_Accounts, cdpManager, mv._10_Ether)
  //   await th.withdrawCLV_allAccounts(_20_Accounts, cdpManager, mv._100e18)

  //    // acct 999 adds coll, withdraws CLV, sits at 111% ICR
  //    await borrowerOperations.addColl(accounts[999], accounts[999], {from: accounts[999], value:mv._1_Ether})
  //    await borrowerOperations.withdrawCLV(mv._180e18, accounts[999], { from: accounts[999]})

  //     // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
  //    await priceFeed.setPrice(mv._100e18)
  //    await cdpManager.liquidate(accounts[999], { from: accounts[0]})

  //   const gasResults = await th.redeemCollateral_allAccounts_randomAmount( 1, 10, _10_Accounts, cdpManager)
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })


  // --- getApproxHint() ---

  // it("", async () => {
  //   const message = 'getApproxHint(), numTrials = 10, 10 calls, each with random CR'
  //   await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
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
  //   await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
  //   await th.withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, borrowerOperations)

  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.cdpManager_getApproxHint(CR, 10)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // it("", async () => {
  //   const message = 'getApproxHint(), numTrials = 32:  i.e. k = 10, list size = 10'
  //   await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
  //   await th.withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, borrowerOperations)


  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.cdpManager_getApproxHint(CR, 32)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // it("", async () => {
  //   const message = 'getApproxHint(), numTrials = 100: i.e. k = 10, list size = 100'
  //   await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
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
  //   await th.addColl_allAccounts(_10_Accounts, cdpManager, mv._10_Ether)
  //   await th.withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)

  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.cdpManager_getApproxHint(CR, 320)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({gas: gas}, message, data)
  // })

  // it("", async () => { // 25mil. gas
  //   const message = 'getApproxHint(), numTrials = 1000:  i.e. k = 10, list size = 10000'
  //   await th.addColl_allAccounts(_10_Accounts, cdpManager, mv._10_Ether)
  //   await th.withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)

  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.cdpManager_getApproxHint(CR, 1000)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({gas: gas}, message, data)
  // })

  // it("", async () => { // 81mil. gas
  //   const message = 'getApproxHint(), numTrials = 3200:  i.e. k = 10, list size = 100000'
  //   await th.addColl_allAccounts(_10_Accounts, cdpManager, mv._10_Ether)
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
  //   await th.addColl_allAccounts(_10_Accounts, cdpManager, mv._10_Ether)
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
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._180e18)

    // first funds provided
    const gasResults = await th.provideToSP_allAccounts(_10_Accounts, poolManager, mv._100e18)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, all issued CLV: all accounts withdraw 180 CLV, all make first deposit, 180 CLV'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._180e18)

    // first funds provided
    const gasResults = await th.provideToSP_allAccounts(_10_Accounts, poolManager, mv._180e18)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, all accounts withdraw 180 CLV, all make first deposit, random CLV amount'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._180e18)

    // first funds provided
    const gasResults = await th.provideToSP_allAccounts_randomAmount(1, 179, _10_Accounts, poolManager)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  //    // --- Top-up deposit ---

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, deposit part of issued CLV: all accounts withdraw 180 CLV, all make second deposit, provide 50 CLV'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._180e18)
    await th.provideToSP_allAccounts(_10_Accounts, poolManager, mv._50e18)

    // top-up of StabilityPool Deposit
    const gasResults = await th.provideToSP_allAccounts(_10_Accounts, poolManager, mv._50e18)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, deposit all issued CLV: all accounts withdraw 180 CLV, make second deposit, provide 90 CLV'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._180e18)
    await th.provideToSP_allAccounts(_10_Accounts, poolManager, mv._90e18)

    // top-up of StabilityPool Deposit
    const gasResults = await th.provideToSP_allAccounts(_10_Accounts, poolManager, mv._90e18)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, all accounts withdraw 180 CLV, make second deposit, random CLV amount'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(_10_Accounts, borrowerOperations, mv._180e18)
    await th.provideToSP_allAccounts(_10_Accounts, poolManager, mv._90e18)

    // top-up of StabilityPool Deposit
    const gasResults = await th.provideToSP_allAccounts_randomAmount(1, 89, _10_Accounts, poolManager)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  //   // --- provideToSP(): Pending rewards

  //   // --- Top-up deposit ---

  it("", async () => {
    const message = 'provideToSP(), with pending rewards in system. deposit part of issued CLV: all accounts make second deposit, provide 50 CLV'
    // 9 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 50 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(2, 12), borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(accounts.slice(2, 12), borrowerOperations, mv._180e18)
    await th.provideToSP_allAccounts(accounts.slice(2, 12), poolManager, mv._50e18)

    //1 acct open CDP with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[1], accounts[1], { from: accounts[1], value: mv._1_Ether })

   

    // Price drops, account[0]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[1], { from: accounts[0] })

    assert.isFalse(await sortedCDPs.contains(accounts[1]))

    // 9 active CDPs top up their Stability Pool deposits with 50 CLV
    const gasResults = await th.provideToSP_allAccounts(accounts.slice(2, 11), poolManager, mv._50e18)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'provideToSP(), with pending rewards in system. deposit all issued CLV: all accounts make second deposit, provide 90 CLV'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 90 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(2, 12), borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(accounts.slice(2, 12), borrowerOperations, mv._180e18)
    await th.provideToSP_allAccounts(accounts.slice(2, 12), poolManager, mv._90e18)

    //1 acct open CDP with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(mv._180e18, accounts[1], accounts[1], { from: accounts[1], value: mv._1_Ether })


    // Price drops, account[0]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[1], { from: accounts[0] })

    assert.isFalse(await sortedCDPs.contains(accounts[1]))

    // 5 active CDPs top up their Stability Pool deposits with 90 CLV, using up all their issued CLV
    const gasResults = await th.provideToSP_allAccounts(accounts.slice(7, 12), poolManager, mv._90e18)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'provideToSP(), with pending rewards in system. deposit part of issued CLV: all make second deposit, provide random CLV amount'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 90 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(2, 12), borrowerOperations,  mv._10_Ether, mv._180e18)
    await th.provideToSP_allAccounts(accounts.slice(2, 12), poolManager, mv._90e18)

   //1 acct open CDP with 1 ether and withdraws 180 CLV
   await borrowerOperations.openLoan(mv._180e18, accounts[1], accounts[1], { from: accounts[1], value: mv._1_Ether })


    // Price drops, account[0]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[1], { from: accounts[0] })

    assert.isFalse(await sortedCDPs.contains(accounts[1]))

    // 5 active CDPs top up their Stability Pool deposits with a random CLV amount
    const gasResults = await th.provideToSP_allAccounts_randomAmount(1, 89, accounts.slice(7, 12), poolManager)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- withdrawFromSP() ---

  // --- No pending rewards ---

  // partial
  it("", async () => {
    const message = 'withdrawFromSP(), no pending rewards. Stability Pool depositors make partial withdrawal - 90 CLV of 180 CLV deposit'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations,  mv._10_Ether, mv._180e18)
    await th.provideToSP_allAccounts(_10_Accounts, poolManager, mv._180e18)

    const gasResults = await th.withdrawFromSP_allAccounts(_10_Accounts, poolManager, mv._90e18)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // full
  it("", async () => {
    const message = 'withdrawFromSP(), no pending rewards. Stability Pool depositors make full withdrawal - 180 CLV of 180 CLV deposit'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations,  mv._10_Ether, mv._180e18)
    await th.provideToSP_allAccounts(_10_Accounts, poolManager, mv._180e18)

    const gasResults = await th.withdrawFromSP_allAccounts(_10_Accounts, poolManager, mv._180e18)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // random amount
  it("", async () => {
    const message = 'withdrawFromSP(), no pending rewards. Stability Pool depositors make partial withdrawal - random CLV amount, less than 180 CLV deposit'
    await th.openLoan_allAccounts(_10_Accounts, borrowerOperations,  mv._10_Ether, mv._180e18)
    await th.provideToSP_allAccounts(_10_Accounts, poolManager, mv._180e18)

    const gasResults = await th.withdrawFromSP_allAccounts_randomAmount(1, 179, _10_Accounts, poolManager)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })


  // // --- withdrawFromSP() ---

  // // --- Pending rewards in system ---

  it("", async () => {
    const message = 'withdrawFromSP(), pending rewards in system. Stability Pool depositors make partial withdrawal - 90 CLV of 180 CLV deposit'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(2, 12), borrowerOperations,  mv._10_Ether, mv._180e18)
    await th.provideToSP_allAccounts(accounts.slice(2, 12), poolManager, mv._180e18)

    //1 acct open CDP with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(0, accounts[1], accounts[1], {from: accounts[1], value: mv._1_Ether })
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[1], accounts[1], { from: accounts[1] })

    // Price drops, account[0]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[1], { from: accounts[0] })

    assert.isFalse(await sortedCDPs.contains(accounts[1]))

    // 5 active CDPs reduce their Stability Pool deposit by 90 CLV
    const gasResults = await th.withdrawFromSP_allAccounts(accounts.slice(7, 12), poolManager, mv._90e18)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawFromSP(), pending rewards in system. Stability Pool depositors make full withdrawal - 180 CLV of 180 CLV deposit'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(2, 12), borrowerOperations,  mv._10_Ether, mv._180e18)
    await th.provideToSP_allAccounts(accounts.slice(2, 12), poolManager, mv._180e18)

    //1 acct open CDP with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(0, accounts[1], accounts[1], {from: accounts[1], value: mv._1_Ether })
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[1], accounts[1], { from: accounts[1] })

    // Price drops, account[0]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[1], { from: accounts[0] })

    assert.isFalse(await sortedCDPs.contains(accounts[1]))

    // 5 active CDPs reduce their Stability Pool deposit by 180 CLV
    const gasResults = await th.withdrawFromSP_allAccounts(accounts.slice(7, 12), poolManager, mv._180e18)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawFromSP(), pending rewards in system. Stability Pool depositors make partial withdrawal - random amount of CLV'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(2, 12), borrowerOperations,  mv._10_Ether, mv._180e18)
    await th.provideToSP_allAccounts(accounts.slice(2, 12), poolManager, mv._180e18)

    //1 acct open CDP with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(0, accounts[1], accounts[1], {from: accounts[1], value: mv._1_Ether })
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[1], accounts[1], { from: accounts[1] })

    // Price drops, account[0]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[1], { from: accounts[0] })

    assert.isFalse(await sortedCDPs.contains(accounts[1]))

    // 5 active CDPs reduce their Stability Pool deposit by random amount
    const gasResults = await th.withdrawFromSP_allAccounts_randomAmount(1, 179, accounts.slice(7, 12), poolManager)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- withdrawFromSPtoCDP() ---

  // --- No pending rewards ---
  it("", async () => {
    const message = 'withdrawFromSPtoCDP(), no pending rewards. All accounts withdraw 180 CLV, provide a random amount, then withdraw all to SP'
    await th.openLoan_allAccounts(accounts.slice(2, 12), borrowerOperations,  mv._10_Ether, mv._180e18)
    await th.provideToSP_allAccounts_randomAmount(1, 179, accounts.slice(2, 12), poolManager)

    const gasResults = await th.withdrawFromSPtoCDP_allAccounts(accounts.slice(5, 10), poolManager)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawFromSPtoCDP(), no pending rewards. All accounts withdraw 180 CLV, provide 180 CLV, then withdraw all to SP'
    await th.openLoan_allAccounts(accounts.slice(2, 12), borrowerOperations,  mv._10_Ether, mv._180e18)
    await th.provideToSP_allAccounts(accounts.slice(2, 12), poolManager, mv._180e18)

    const gasResults = await th.withdrawFromSPtoCDP_allAccounts(accounts.slice(5, 10), poolManager)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- withdrawFromSPtoCDP() - deposit has pending rewards ---
  it("", async () => {
    const message = 'withdrawFromSPtoCDP(), pending rewards in system. Accounts withdraw 180 CLV, provide 180 CLV, then withdraw all to SP after a liquidation'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(2, 12), borrowerOperations,  mv._10_Ether, mv._180e18)
    await th.provideToSP_allAccounts(accounts.slice(2, 12), poolManager, mv._180e18)

    //1 acct open CDP with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(0, accounts[1], accounts[1], {from: accounts[1], value: mv._1_Ether })
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[1], accounts[1], { from: accounts[1] })

    // Price drops, account[0]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[1], { from: accounts[0] })

    assert.isFalse(await sortedCDPs.contains(accounts[1]))

    // 5 active CDPs reduce their Stability Pool deposit by 90 CLV
    const gasResults = await th.withdrawFromSPtoCDP_allAccounts(accounts.slice(7, 12), poolManager)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawFromSPtoCDP(), pending rewards in system. Accounts withdraw 180 CLV, provide a random amount, then withdraw all to SP after a liquidation'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(2, 12), borrowerOperations,  mv._10_Ether, mv._180e18)
    await await th.provideToSP_allAccounts_randomAmount(1, 179, accounts.slice(2, 12), poolManager)

    //1 acct open CDP with 1 ether and withdraws 180 CLV
    await borrowerOperations.openLoan(0, accounts[1], accounts[1], {from: accounts[1], value: mv._1_Ether })
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[1], accounts[1], { from: accounts[1] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)
    await cdpManager.liquidate(accounts[1], { from: accounts[0] })

    assert.isFalse(await sortedCDPs.contains(accounts[1]))

    // 5 active CDPs reduce their Stability Pool deposit by 90 CLV
    const gasResults = await th.withdrawFromSPtoCDP_allAccounts(accounts.slice(7, 12), poolManager)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- liquidate() ---

  // Pure redistribution WITH pending rewards
  it("", async () => {
    const message = 'Single liquidate() call. Liquidee has pending rewards. Pure redistribution'
    // 10 accts each open CDP with 10 ether, withdraw 180 CLV
    await th.openLoan_allAccounts(accounts.slice(100, 110), borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(accounts.slice(100, 110), borrowerOperations, mv._180e18)

    //6s acct open CDP with 1 ether and withdraw 180 CLV
    await th.openLoan_allAccounts(accounts.slice(0, 6), borrowerOperations, mv._1_Ether, mv._180e18 )
    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Initial distribution liquidations make system reward terms and Default Pool non-zero
    const tx1 = await cdpManager.liquidate(accounts[2], { from: accounts[0] })
    // const gas1 = th.gasUsed(tx1)
    // th.logGas(gas1, message)
    const tx2 = await cdpManager.liquidate(accounts[3], { from: accounts[0] })
    // const gas2 = th.gasUsed(tx2)
    // th.logGas(gas2, message)

    assert.isTrue(await sortedCDPs.contains(accounts[1]))

    const tx5 = await cdpManager.liquidate(accounts[1], { from: accounts[0] })

    assert.isFalse(await sortedCDPs.contains(accounts[1]))
    const gas5 = th.gasUsed(tx5)
    th.logGas(gas5, message)

    th.appendData({ gas: gas5 }, message, data)
  })

  it("", async () => {
    const message = 'Series of liquidate() calls. Liquidee has pending rewards. Pure redistribution'
    // 100 accts each open CDP with 10 ether, withdraw 180 CLV
    await th.openLoan_allAccounts(accounts.slice(100, 200), borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(accounts.slice(100, 200), borrowerOperations, mv._180e18)

    const liquidationAcctRange = accounts.slice(1, 10)

    // Accts open CDP with 1 ether and withdraws 180 CLV
    await th.openLoan_allAccounts(liquidationAcctRange, borrowerOperations, mv._1_Ether, 0)
    await th.withdrawCLV_allAccounts(liquidationAcctRange, borrowerOperations, mv._180e18)

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // All loans are liquidated
    for (account of liquidationAcctRange) {
      const hasPendingRewards = await cdpManager.hasPendingRewards(account)
      console.log("Liquidee has pending rewards: " + hasPendingRewards)

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
    await th.openLoan_allAccounts(accounts.slice(100, 110), borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(accounts.slice(100, 110), borrowerOperations, mv._180e18)

    //2 acct open CDP with 1 ether and withdraws 180 CLV
    await th.openLoan_allAccounts(accounts.slice(2, 4), borrowerOperations,mv._1_Ether, 0)
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[2], accounts[2], { from: accounts[2] })
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[3], accounts[3], { from: accounts[3] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Initial distribution liquidations make system reward terms and DefaultPool non-zero
    const tx1 = await cdpManager.liquidate(accounts[2], { from: accounts[0] })
    const tx2 = await cdpManager.liquidate(accounts[3], { from: accounts[0] })

    // Account 1 opens loan
    await borrowerOperations.openLoan(mv._90e18, accounts[1], accounts[1], { from: accounts[1], value:mv._1_Ether })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._50e18)

    assert.isTrue(await sortedCDPs.contains(accounts[1]))

    const tx3 = await cdpManager.liquidate(accounts[1], { from: accounts[0] })

    assert.isFalse(await sortedCDPs.contains(accounts[1]))
    const gas = th.gasUsed(tx3)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'Series of liquidate() calls. Liquidee has NO pending rewards. Pure redistribution'

    // 10 accts each open CDP with 10 ether, withdraw 180 CLV

    await th.openLoan_allAccounts(accounts.slice(100, 110), borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(accounts.slice(100, 110), borrowerOperations, mv._180e18)

    const liquidationAcctRange = accounts.slice(1, 20)

    for (account of liquidationAcctRange) {
      await priceFeed.setPrice(mv._200e18)
      await borrowerOperations.openLoan(mv._180e18, account, account, { from: account, value:mv._1_Ether })

      const hasPendingRewards = await cdpManager.hasPendingRewards(account)
      console.log("Liquidee has pending rewards: " + hasPendingRewards)

      await priceFeed.setPrice(mv._100e18)
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
    await th.openLoan_allAccounts(accounts.slice(100, 110), borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(accounts.slice(100, 110), borrowerOperations, mv._180e18)

    //2 acct open CDP with 1 ether and withdraws 180 CLV
    await th.openLoan_allAccounts(accounts.slice(0, 4), borrowerOperations,mv._1_Ether, 0)
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[1], accounts[1], { from: accounts[1] })
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[2], accounts[2], { from: accounts[2] })
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[3], accounts[3], { from: accounts[3] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 4 provides 600 CLV to pool
    await borrowerOperations.withdrawCLV(mv._600e18, accounts[4], accounts[4],{ from: accounts[4] })
    await poolManager.provideToSP(mv._600e18, { from: accounts[4] })

    // Initial liquidations - full offset - makes SP reward terms and SP non-zero
    await cdpManager.liquidate(accounts[2], { from: accounts[0] })
    await cdpManager.liquidate(accounts[3], { from: accounts[0] })

    const hasPendingRewards = await cdpManager.hasPendingRewards(accounts[1])
    console.log("Liquidee has pending rewards: " + hasPendingRewards)

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
    await th.openLoan_allAccounts(accounts.slice(100, 110), borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(accounts.slice(100, 110), borrowerOperations, mv._180e18)

    // 5 acct open CDP with 1 ether and withdraws 180 CLV
    await th.openLoan_allAccounts(accounts.slice(0, 5), borrowerOperations,mv._1_Ether, 0)
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[1], accounts[1], { from: accounts[1] })
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[2], accounts[2], { from: accounts[2] })
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[3], accounts[3], { from: accounts[3] })
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[4], accounts[4], { from: accounts[4] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Account 5 provides 360 CLV to SP
    await borrowerOperations.withdrawCLV(mv._600e18, accounts[5], accounts[5], { from: accounts[5] })
    await poolManager.provideToSP(mv._360e18, { from: accounts[5] })

    // Initial liquidations - full offset - makes SP reward terms and SP non-zero
    await cdpManager.liquidate(accounts[2], { from: accounts[0] })
    await cdpManager.liquidate(accounts[3], { from: accounts[0] })

    // Pure redistribution - creates pending dist. rewards for account 1
    await cdpManager.liquidate(accounts[4], { from: accounts[0] })

    // Account 5 provides another 200 to the SP
    await poolManager.provideToSP(mv._200e18, { from: accounts[5] })

    const hasPendingRewards = await cdpManager.hasPendingRewards(accounts[1])
    console.log("Liquidee has pending rewards: " + hasPendingRewards)

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
    await th.openLoan_allAccounts(accounts.slice(100, 110), borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(accounts.slice(100, 110), borrowerOperations, mv._180e18)

    //4 acct open CDP with 1 ether and withdraws 180 CLV
    await th.openLoan_allAccounts(accounts.slice(0, 4), borrowerOperations, mv._1_Ether, 0)
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[1], accounts[1], { from: accounts[1] })
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[2], accounts[2], { from: accounts[2] })
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[3], accounts[3], { from: accounts[3] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Set up some "previous" liquidations triggering partial offsets, and pending rewards for all troves
    await poolManager.provideToSP(mv._100e18, { from: accounts[100] })
    await cdpManager.liquidate(accounts[2], { from: accounts[0] })

    await poolManager.provideToSP(mv._100e18, { from: accounts[101] })
    await cdpManager.liquidate(accounts[3], { from: accounts[0] })

    // pool refilled with 100 CLV
    await poolManager.provideToSP(mv._100e18, { from: accounts[102] })

    const hasPendingRewards = await cdpManager.hasPendingRewards(accounts[1])
    console.log("Liquidee has pending rewards: " + hasPendingRewards)

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
    await th.openLoan_allAccounts(accounts.slice(100, 110), borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(accounts.slice(100, 110), borrowerOperations, mv._180e18)

    //2 acct open CDP with 1 ether and withdraws 180 CLV
    await th.openLoan_allAccounts(accounts.slice(2, 4), borrowerOperations, mv._1_Ether, 0)
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[2], accounts[2], { from: accounts[2] })
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[3], accounts[3], { from: accounts[3] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    // Set up some "previous" liquidations that trigger partial offsets, 
    //and create pending rewards for all troves
    await poolManager.provideToSP(mv._100e18, { from: accounts[100] })
    await cdpManager.liquidate(accounts[2], { from: accounts[0] })

    await poolManager.provideToSP(mv._100e18, { from: accounts[101] })
    await cdpManager.liquidate(accounts[3], { from: accounts[0] })

    // Pool refilled with 50 CLV
    await poolManager.provideToSP(mv._50e18, { from: accounts[102] })

    // Account 1 opens loan
    await borrowerOperations.openLoan(mv._90e18, accounts[1], accounts[1], { from: accounts[1], value:mv._1_Ether })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._50e18)

    const hasPendingRewards = await cdpManager.hasPendingRewards(accounts[1])
    console.log("Liquidee has pending rewards: " + hasPendingRewards)

    // account 1 90 CLV liquidated  - partial offset against 50 CLV in SP
    const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0] })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // With pending dist. rewards and SP gains (still closes) - partial offset (Highest gas cost scenario in Normal Mode)
  it("", async () => {
    const message = 'liquidate() 1 CDP, liquidated CDP has pending SP rewards and redistribution rewards, offset + redistribution.'
    // 10 accts each open CDP with 10 ether
    await th.openLoan_allAccounts(accounts.slice(100, 110), borrowerOperations, mv._10_Ether, 0 )

    //Account 99 and 98 each open CDP with 1 ether, and withdraw 180 CLV
    await th.openLoan_allAccounts([accounts[99]], borrowerOperations,mv._1_Ether, 0)
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[99],  accounts[99], {from: accounts[99]} )
    await th.openLoan_allAccounts([accounts[98]], borrowerOperations,mv._1_Ether, 0)
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[98], accounts[98], {from: accounts[98]} )

    // Acct 99 deposits 1 CLV to SP
    await poolManager.provideToSP(mv._1e18, {from: accounts[99]} )

     //Account 97 opens CDP with 1 ether and withdraws 180 CLV
     await th.openLoan_allAccounts([accounts[97]], borrowerOperations,mv._1_Ether, 0)
     await borrowerOperations.withdrawCLV(mv._180e18, accounts[97], accounts[97], {from: accounts[97]} )

    // Price drops too $100, accounts 99 and 100 ICR fall below MCR
    await priceFeed.setPrice(mv._100e18)
    const price = await priceFeed.getPrice()

    // Acct 7 adds 10 ether, withdraws 1800 CLV and deposits it to the SP
    await th.openLoan_allAccounts([accounts[7]], borrowerOperations, mv._10_Ether, 0)
    await borrowerOperations.withdrawCLV(mv._1800e18, accounts[7],  accounts[7], {from: accounts[7]} )
    await poolManager.provideToSP(_1800e18, {from: accounts[7]} )

    /* Liquidate account 97. Account 97 is completely offset against SP and removed from system.

    This creates SP gains for accounts 99 and 7. */
    await cdpManager.liquidate(accounts[97], { from: accounts[0]})
    assert.isFalse(await sortedCDPs.contains(accounts[97]))

    // Acct 7 withdraws deposit and gains from SP
  //  await poolManager.withdrawFromSPtoCDP(accounts[7], {from: accounts[7]})

   await poolManager.withdrawFromSP(_1800e18, {from: accounts[7]})

    // Account 98 is liquidated, with nothing in SP pool.  This creates pending rewards from distribution.
    await cdpManager.liquidate(accounts[98], { from: accounts[0]})

    // Account 7 deposits 1 CLV in the Stability Pool
    await poolManager.provideToSP(mv._1e18, {from: accounts[7]} )

    const tx = await cdpManager.liquidate(accounts[99], { from: accounts[0]})
    assert.isFalse(await sortedCDPs.contains(accounts[99]))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // pure offset
  it("", async () => {
    const message = 'liquidate() 1 CDP Normal Mode, 30 active CDPs, no ETH gain in pool, pure offset with SP'
    // 30 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
    await th.openLoan_allAccounts(accounts.slice(100, 130), borrowerOperations, mv._10_Ether, 0 )
    await th.withdrawCLV_allAccounts(accounts.slice(100, 130), borrowerOperations, mv._180e18)

    await poolManager.provideToSP( mv._180e18, {from:accounts[100]})

    //1 acct open CDP with 1 ether and withdraws 180 CLV
    await th.openLoan_allAccounts([accounts[1]], borrowerOperations,mv._1_Ether, 0)
    await borrowerOperations.withdrawCLV(mv._180e18, accounts[1],  accounts[1], {from: accounts[1]} )

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(mv._100e18)

    const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0]})
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({gas: gas}, message, data)
  })

  // --- findInsertPosition ---

  // --- Insert at head, 0 traversals ---

  it("", async () => {
    const message = 'findInsertPosition(), 10 CDPs with ICRs 200-209%, ICR > head ICR, no hint, 0 traversals'

    // makes 10 CDPs with ICRs 200 to 209%
    await th.makeCDPsIncreasingICR(_10_Accounts, borrowerOperations)

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
    await th.makeCDPsIncreasingICR(_50_Accounts, borrowerOperations)

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
    await th.makeCDPsIncreasingICR(_10_Accounts, borrowerOperations)

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
    await th.makeCDPsIncreasingICR(_20_Accounts, borrowerOperations)

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
    await th.makeCDPsIncreasingICR(_50_Accounts, borrowerOperations)

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
      if (err) {console.log(err) } else {
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