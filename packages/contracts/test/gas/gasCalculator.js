/* Script that logs gas costs for Liquity operations under various conditions. 

  Note: uses Mocha testing structure, but simply prints gas costs of transactions. No assertions.
*/
const fs = require('fs')
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
const deploymentHelpers = require("../../utils/deploymentHelpers.js")

const getAddresses = deploymentHelpers.getAddresses
const setNameRegistry = deploymentHelpers.setNameRegistry
const connectContracts = deploymentHelpers.connectContracts
const getAddressesFromNameRegistry = deploymentHelpers.getAddressesFromNameRegistry


contract('Gas cost tests', async accounts => {

  const _2_Ether = web3.utils.toWei('2', 'ether')
  const _1_Ether = web3.utils.toWei('1', 'ether')
  const _5_Ether = web3.utils.toWei('5', 'ether')
  const _10_Ether = web3.utils.toWei('10', 'ether')
  const _15_Ether = web3.utils.toWei('15', 'ether')
  const _20_Ether = web3.utils.toWei('20', 'ether')
  const _98_Ether = web3.utils.toWei('98', 'ether')
  const _100_Ether = web3.utils.toWei('100', 'ether')
  const _200_Ether = web3.utils.toWei('200', 'ether')
  
  const _30e18 = web3.utils.toWei('30', 'ether')
  const _50e18 = web3.utils.toWei('50', 'ether')
  const _150e18 = web3.utils.toWei('150', 'ether')

  const _90e18 =  web3.utils.toWei('90', 'ether')

  const _100e18 = web3.utils.toWei('100', 'ether')
  const _180e18 = web3.utils.toWei('180', 'ether')
  const _500e18 = web3.utils.toWei('500', 'ether')
  const _900e18 = web3.utils.toWei('900', 'ether')
  const _1000e18 = web3.utils.toWei('1000', 'ether')
  const _1500e18 = web3.utils.toWei('1500', 'ether')
  const _2000e18 = web3.utils.toWei('2000', 'ether')

  const [owner] = accounts;
  const _10_Accounts = accounts.slice(0, 10)
  const _20_Accounts = accounts.slice(0, 20)
  const _30_Accounts = accounts.slice(0, 30)
  const _40_Accounts = accounts.slice(0, 40)
  const _50_Accounts = accounts.slice(0, 50)
  const _100_Accounts = accounts.slice(0, 100)

  const address_0 = '0x0000000000000000000000000000000000000000'

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
  let data = []

  before(async () => {
    const deciMath = await DeciMath.new()
    DeciMath.setAsDeployed(deciMath)
    CDPManager.link(deciMath)
    PoolManager.link(deciMath)
    FunctionCaller.link(deciMath)
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

  // --- Helper functions --- 
  const getEndOfAccount = (account) => {
    accountLast2bytes = account.slice((account.length - 4), account.length)
    return accountLast2bytes
  }
  const randAmountInWei = (min, max) => {
    const amount = Math.random() * (max - min) + min;
    const amountInWei = web3.utils.toWei(amount.toString(), 'ether')
    return amountInWei
  }

  const gasUsed = (tx) => {
    const gas = tx.receipt.gasUsed
    return gas
  }

  const getGasMetrics = (gasCostList) => {
    minGas = Math.min(...gasCostList) 
    maxGas = Math.max(...gasCostList)
    meanGas = gasCostList.reduce((acc, curr) => acc + curr, 0) / gasCostList.length
    // median is the middle element (for odd list size) or element adjacent-right of middle (for even list size)
    medianGas = (gasCostList[Math.floor(gasCostList.length / 2)]) 
    return {gasCostList, minGas, maxGas, meanGas, medianGas}
  }

  const appendData = (results, message, data) => {
    data.push(message + `\n`)
    for (key in results) {
      data.push(key + "," + results[key] + '\n')
    }
  }

  const getRandICR = (min, max) => {
    const ICR_Percent = (Math.floor(Math.random() * (max - min) + min)) 

      // Convert ICR to a duint
      const ICR = web3.utils.toWei((ICR_Percent * 10).toString(), 'finney') 
      return ICR
  }

  const logGasMetrics = (gasResults, message) => {
     console.log(
      `\n ${message} \n
      min gas: ${gasResults.minGas} \n
      max gas: ${gasResults.maxGas} \n
      mean gas: ${gasResults.meanGas} \n
      median gas: ${gasResults.medianGas} \n`)
  }

  const logAllGasCosts = (gasResults) => {
    console.log(
    `all gas costs: ${gasResults.gasCostList} \n`
    )
  }

  const logGas = (gas, message) => {
    console.log(
      `\n ${message} \n
      gas used: ${gas} \n`
    )
  }

  // --- CDPManager gas functions ---

  const openLoan_allAccounts = async( accounts, cdpManager, ETHAmount, CLVAmount) => {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await cdpManager.openLoan(CLVAmount, account, { from: account, value: ETHAmount })
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }
   return getGasMetrics(gasCostList)
  }

  const openLoan_allAccounts_decreasingCLVAmounts = async( accounts, cdpManager, ETHAmount, maxCLVAmount) => {
    const gasCostList = []
    let i = 0
    for (const account of accounts) {
      const CLVAmount = (maxCLVAmount - i).toString()
      const CLVAmountWei = web3.utils.toWei(CLVAmount, 'ether')
      const tx = await cdpManager.openLoan(CLVAmountWei, account, { from: account, value: ETHAmount })
      const gas = gasUsed(tx)
      gasCostList.push(gas)
      i += 1
    }
   return getGasMetrics(gasCostList)
  }

  const addColl_allAccounts = async (accounts, cdpManager, amount) => {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await cdpManager.addColl(account, account, { from: account, value: amount })
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }
   return getGasMetrics(gasCostList)
  }

  const addColl_allAccounts_randomAmount = async (min, max, accounts, cdpManager) => {
    const gasCostList = []
    for (const account of accounts) {
      const randCollAmount = randAmountInWei(min, max)
      const tx = await cdpManager.addColl(account, account, { from: account, value: randCollAmount })
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }
   return getGasMetrics(gasCostList)
  }

  // 
  const withdrawColl_allAccounts = async (accounts, cdpManager, amount) => {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await cdpManager.withdrawColl(amount, account, { from: account })
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }
    return getGasMetrics(gasCostList)
  }

  const withdrawColl_allAccounts_randomAmount = async (min, max, accounts, cdpManager) => {
    const gasCostList = []
    for (const account of accounts) {
      const randCollAmount = randAmountInWei(min, max)
      const tx = await cdpManager.withdrawColl(randCollAmount, account, { from: account })
      const gas = gasUsed(tx)
      gasCostList.push(gas)
      // console.log("gasCostlist length is " + gasCostList.length)
    }
    return getGasMetrics(gasCostList)
  }

  const withdrawCLV_allAccounts = async (accounts, cdpManager, amount) => {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await cdpManager.withdrawCLV(amount, account, { from: account })
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }
    return getGasMetrics(gasCostList)
  }

  const withdrawCLV_allAccounts_randomAmount = async (min, max, accounts, cdpManager) => {
    const gasCostList = []
    for (const account of accounts) {
      const randCLVAmount = randAmountInWei(min, max)
     
      const tx = await cdpManager.withdrawCLV(randCLVAmount, account, { from: account })
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }
    return getGasMetrics(gasCostList)
  }

  const repayCLV_allAccounts = async (accounts, cdpManager, amount) => {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await cdpManager.repayCLV(amount, account, { from: account })
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }
    return getGasMetrics(gasCostList)
  }

  const repayCLV_allAccounts_randomAmount = async (min, max, accounts, cdpManager) => {
    const gasCostList = []
    for (const account of accounts) {
      const randCLVAmount = randAmountInWei(min, max)

      const tx = await cdpManager.repayCLV(randCLVAmount, account, { from: account })
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }
    return getGasMetrics(gasCostList)
  }

  const getCurrentICR_allAccounts = async (accounts, cdpManager) => {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await functionCaller.cdpManager_getCurrentICR(account)
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }
    return getGasMetrics(gasCostList)
  }

  const redeemCollateral = async (redeemer, cdpManager, CLVAmount) => {
    const tx = await cdpManager.redeemCollateral(CLVAmount, redeemer, { from: redeemer })
    const gas = await gasUsed(tx)
    return gas
  }

  const redeemCollateral_allAccounts_randomAmount = async (min, max, accounts, cdpManager) => {
    const gasCostList = []
    for (const account of accounts) {
      const randCLVAmount = randAmountInWei(min, max)
      const tx = await cdpManager.redeemCollateral(randCLVAmount, account, { from: account })
     
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }
    return getGasMetrics(gasCostList)
  }

  // --- Composite functions ---

  const makeCDPsIncreasingICR = async (accounts) => {

    let amountFinney = 2000
    
    for (const account of accounts) {
      const coll = web3.utils.toWei((amountFinney.toString()), 'finney')
      
      await cdpManager.addColl(account, account, { from: account, value: coll })
      await cdpManager.withdrawCLV('200000000000000000000', account, { from: account })
     
      amountFinney += 10
    }
  }

  // --- PoolManager gas functions ---

  const provideToSP_allAccounts = async( accounts, poolManager, amount) => {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await poolManager.provideToSP(amount, { from: account })
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }
    return getGasMetrics(gasCostList)
  }

  const provideToSP_allAccounts_randomAmount = async(min, max, accounts, poolManager) => {
    const gasCostList = []
    for (const account of accounts) {
      const randomCLVAmount = randAmountInWei(min, max)
      const tx = await poolManager.provideToSP(randomCLVAmount, { from: account })
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }
    return getGasMetrics(gasCostList)
  }

  const withdrawFromSP_allAccounts = async( accounts, poolManager, amount) => {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await poolManager.withdrawFromSP(amount, { from: account })
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }
    return getGasMetrics(gasCostList)
  }

  const withdrawFromSP_allAccounts_randomAmount = async(min, max, accounts, poolManager) => {
    const gasCostList = []
    for (const account of accounts) {
      const randomCLVAmount = randAmountInWei(min, max)
      const tx = await poolManager.withdrawFromSP(randomCLVAmount, { from: account })
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }
    return getGasMetrics(gasCostList)
  }

  const withdrawFromSPtoCDP_allAccounts = async (accounts, poolManager) => {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await poolManager.withdrawFromSPtoCDP(account, { from: account })
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }
    return getGasMetrics(gasCostList)
  }

  //
  //
  // ---TESTS ---
  //
  //

  // --- CDP Manager function calls ---

  // --- openLoan() ---

  it.only("", async () => {
    const message = 'openLoan(), 10 accounts, each account adds 10 ether and issues 100 CLV'
    const amountETH = _10_Ether
    const amountCLV = _100e18
    const gasResults = await openLoan_allAccounts(_10_Accounts, cdpManager, amountETH, amountCLV)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)
    
    appendData(gasResults, message, data)
  })

  it.only("", async () => {
    const message = 'openLoan(), 10 accounts, each account adds 10 ether and issues less CLV than the previous one'
    const amountETH = _10_Ether
    const amountCLV = 200
    const gasResults = await openLoan_allAccounts_decreasingCLVAmounts(_10_Accounts, cdpManager, amountETH, amountCLV)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)
    
    appendData(gasResults, message, data)
  })

  it.only("", async () => {
    const message = 'openLoan(), 10 accounts, each account adds 20 ether and issues less CLV than the previous one'
    const amountETH = _20_Ether
    const amountCLV = 200
    const gasResults = await openLoan_allAccounts_decreasingCLVAmounts(_10_Accounts, cdpManager, amountETH, amountCLV)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)
    
    appendData(gasResults, message, data)
  })

  // --- addColl() ---

  it("", async () => {
    const message = 'addColl(), first deposit, 10 accounts, each account adds 10 ether'
    const amount = _10_Ether
    const gasResults = await addColl_allAccounts(_10_Accounts, cdpManager, amount)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)
    
    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'addColl(), second deposit, 10 accounts, each account adds 10 ether'
    const amount = _10_Ether
    await addColl_allAccounts(_10_Accounts, cdpManager, amount)

    const gasResults = await addColl_allAccounts(_10_Accounts, cdpManager, amount)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'addColl(), first deposit, 10 accounts, each account adds random amount'
    const gasResults = await addColl_allAccounts_randomAmount(0.000000001, 10000, _10_Accounts, cdpManager)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)
    
    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'addColl(), second deposit, 10 accounts, each account adds random amount'
    const amount = _10_Ether
    await addColl_allAccounts(_10_Accounts, cdpManager, amount)

    const gasResults = await addColl_allAccounts_randomAmount(0.000000001, 10000, _10_Accounts, cdpManager)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)
   
    appendData(gasResults, message, data)
  })

  // --- withdrawColl() ---

  it("", async () => {
    const message = 'withdrawColl(), first withdrawal, 10 accounts, each account withdraws 5 ether'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)

    const gasResults = await withdrawColl_allAccounts(_10_Accounts, cdpManager, _5_Ether)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)
     
    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawColl(), second withdrawal, 10 accounts, each account withdraws 5 ether'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawColl_allAccounts(_10_Accounts, cdpManager, _1_Ether)

    const gasResults = await withdrawColl_allAccounts(_10_Accounts, cdpManager, _5_Ether)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawColl(), first withdrawal, 10 accounts, each account withdraws random amount'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)

    const gasResults = await withdrawColl_allAccounts_randomAmount(1, 9, _10_Accounts, cdpManager)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawColl(), second withdrawal, 10 accounts, each account withdraws random amount'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawColl_allAccounts(_10_Accounts, cdpManager, _1_Ether)

    const gasResults = await withdrawColl_allAccounts_randomAmount(1, 8, _10_Accounts, cdpManager)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawColl(), first withdrawal, 10 accounts, each account withdraws 10 ether, leaving CDP empty'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)

    const gasResults = await withdrawColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawColl(), second withdrawal, 10 accounts, each account withdraws 5 ether, leaving CDP empty'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawColl_allAccounts(_10_Accounts, cdpManager, _5_Ether)

    const gasResults = await withdrawColl_allAccounts(_10_Accounts, cdpManager, _5_Ether)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  // --- withdrawCLV() --- 

  it("", async () => {
    const message = 'withdrawCLV(), first withdrawal, 10 accounts, each account withdraws 100 CLV'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)

    const gasResults = await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawCLV(), second withdrawal, 10 accounts, each account withdraws 100 CLV'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)

    const gasResults = await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawCLV(), first withdrawal, 10 accounts, each account withdraws a random CLV amount'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)

    const gasResults = await withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

   it("", async () => {
    const message = 'withdrawCLV(), second withdrawal, 10 accounts, each account withdraws a random CLV amount'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)

    const gasResults = await withdrawCLV_allAccounts_randomAmount(1, 80, _10_Accounts, cdpManager)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  // --- repayCLV() ---

  it("", async () => {
    const message = 'repayCLV(), partial repayment, 10 accounts, repay 30 CLV (of 100 CLV)'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)

    const gasResults = await repayCLV_allAccounts(_10_Accounts, cdpManager, _30e18)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'repayCLV(), second partial repayment, 10 accounts, repay 30 CLV (of 70 CLV)'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)
    await repayCLV_allAccounts(_10_Accounts, cdpManager, _30e18)

    const gasResults = await repayCLV_allAccounts(_10_Accounts, cdpManager, _30e18)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'repayCLV(), partial repayment, 10 accounts, repay random amount of CLV (of 100 CLV)'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)

    const gasResults = await repayCLV_allAccounts_randomAmount(1, 99, _10_Accounts, cdpManager)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'repayCLV(), first repayment, 10 accounts, repay in full (100 of 100 CLV)'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)

    const gasResults = await repayCLV_allAccounts(_10_Accounts, cdpManager, _100e18)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

   it("", async () => {
    const message = 'repayCLV(), first repayment, 10 accounts, repay in full (50 of 50 CLV)'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)
    await repayCLV_allAccounts(_10_Accounts, cdpManager, _50e18)

    const gasResults = await repayCLV_allAccounts(_10_Accounts, cdpManager, _50e18)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

// --- getCurrentICR() ---

it("", async () => {
  const message = 'single getCurrentICR() call'
  
  await cdpManager.addColl(accounts[1], accounts[1], {from: accounts[1], value: _10_Ether})
  const randCLVAmount = randAmountInWei(1,180)
  await cdpManager.withdrawCLV(randCLVAmount, accounts[1], {from: accounts[1]})

  const tx = await functionCaller.cdpManager_getCurrentICR(accounts[1])

  const gas = gasUsed(tx)
  logGas(gas, message)
})

it("", async () => {
  const message = 'getCurrentICR(), new CDPs with 10 ether and no withdrawals'
  await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  const gasResults = await getCurrentICR_allAccounts(_10_Accounts, cdpManager)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

it("", async () => {
  const message = 'getCurrentICR(), CDPs with 10 ether and 100 CLV withdrawn'
  await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)
  
  const gasResults = await getCurrentICR_allAccounts(_10_Accounts, cdpManager)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

it("", async () => {
  const message = 'getCurrentICR(), CDPs with 10 ether and random CLV amount withdrawn'
  await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  await withdrawCLV_allAccounts_randomAmount(1, 1800, _10_Accounts, cdpManager)
  
  const gasResults = await getCurrentICR_allAccounts(_10_Accounts, cdpManager)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

it("", async () => {
  const message = 'getCurrentICR(), empty CDPs with no ether and no withdrawals'
  await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  await withdrawColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  
  const gasResults = await getCurrentICR_allAccounts(_10_Accounts, cdpManager)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

// // --- redeemCollateral() ---
  it("", async () => { 
    const message = 'redeemCollateral(), redeems 100 CLV, redemption hits 1 CDP'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)

    const gas = await redeemCollateral(accounts[9], cdpManager, _50e18)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => { 
    const message = 'redeemCollateral(), redeemed 500 CLV, redemption hits 5 CDPs'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)

    // Whale adds 200 ether, withdraws 500 CLV, redeems 500 CLV
    await cdpManager.addColl(accounts[9], accounts[9], {from: accounts[9], value: _200_Ether})
    await cdpManager.withdrawCLV(_500e18, accounts[9], { from: accounts[9]})
    const gas = await redeemCollateral(accounts[9], cdpManager, _500e18)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => { 
    const message = 'redeemCollateral(), redeemed 1000 CLV, redemption hits 10 CDPs'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)

    // Whale adds 200 ether, withdraws 500 CLV, redeems 500 CLV
    await cdpManager.addColl(accounts[9], accounts[9], {from: accounts[9], value: _200_Ether})
    await cdpManager.withdrawCLV(_1000e18, accounts[9], { from: accounts[9]})
    const gas = await redeemCollateral(accounts[9], cdpManager, _1000e18)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => { 
    const message = 'redeemCollateral(), redeemed 1500 CLV, redemption hits 15 CDPs'
    await addColl_allAccounts(_20_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_20_Accounts, cdpManager, _100e18)

    // Whale adds 200 ether, withdraws 1500 CLV, redeems 1500 CLV
    await cdpManager.addColl(accounts[9], accounts[9], {from: accounts[9], value: _200_Ether})
    await cdpManager.withdrawCLV(_1500e18, accounts[9], { from: accounts[9]})
    const gas = await redeemCollateral(accounts[9], cdpManager, _1500e18)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => { 
    const message = 'redeemCollateral(), redeemed 2000 CLV, redemption hits 20 CDPs'
    await addColl_allAccounts(_30_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_30_Accounts, cdpManager, _100e18)

    // Whale adds 200 ether, withdraws 2000 CLV, redeems 2000 CLV
    await cdpManager.addColl(accounts[9], accounts[9], {from: accounts[9], value: _200_Ether})
    await cdpManager.withdrawCLV(_2000e18, accounts[9], { from: accounts[9]})
    const gas = await redeemCollateral(accounts[9], cdpManager, _2000e18)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => { 
    const message = 'redeemCollateral(),  CLV, each redemption only hits the first CDP, never closes it'
    await addColl_allAccounts(_20_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_20_Accounts, cdpManager, _100e18)

    const gasResults = await redeemCollateral_allAccounts_randomAmount( 1, 10, _10_Accounts, cdpManager)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })
  
 // --- getApproxHint() ---

  it("", async () => {
    const message = 'getApproxHint(), numTrials = 10, 10 calls, each with random CR'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)
    
    gasCostList = []

    for (i = 0; i < 10; i++) {
      randomCR = randAmountInWei(1,5)
      const tx = await functionCaller.cdpManager_getApproxHint(randomCR, 10)
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }

    const gasResults = getGasMetrics(gasCostList)
    logGasMetrics(gasResults)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'getApproxHint(), numTrials = 10:  i.e. k = 1, list size = 1'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)
    
    const CR = '200000000000000000000'
    tx = await functionCaller.cdpManager_getApproxHint(CR, 10)
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = 'getApproxHint(), numTrials = 32:  i.e. k = 10, list size = 10'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)
    

    const CR = '200000000000000000000'
    tx = await functionCaller.cdpManager_getApproxHint(CR, 32)
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = 'getApproxHint(), numTrials = 100: i.e. k = 10, list size = 100'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)
    
    const CR = '200000000000000000000'
    tx = await functionCaller.cdpManager_getApproxHint(CR, 100)
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => { //8mil. gas
    const message = 'getApproxHint(), numTrials = 320: i.e. k = 10, list size = 1000'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)
    
    const CR = '200000000000000000000'
    tx = await functionCaller.cdpManager_getApproxHint(CR, 320)
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => { // 25mil. gas
    const message = 'getApproxHint(), numTrials = 1000:  i.e. k = 10, list size = 10000'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)
    
    const CR = '200000000000000000000'
    tx = await functionCaller.cdpManager_getApproxHint(CR, 1000)
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  // Slow test

  // it("", async () => { //81mil. gas
  //   const message = 'getApproxHint(), numTrials = 3200:  i.e. k = 10, list size = 100000'
  //   await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  //   await withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)
    
  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.cdpManager_getApproxHint(CR, 3200)
  //   const gas = gasUsed(tx)
  //   logGas(gas, message)

  //   appendData({gas: gas}, message, data)
  // })


  // Test hangs 

  // it("", async () => { 
  //   const message = 'getApproxHint(), numTrials = 10000:  i.e. k = 10, list size = 1000000'
  //   await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  //   await withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)
    
  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.cdpManager_getApproxHint(CR, 10000)
  //   const gas = gasUsed(tx)
  //   logGas(gas, message)

  //   appendData({gas: gas}, message, data)
  // })


  // --- PoolManager functions ---

  // --- provideToSP(): No pending rewards

  // --- First deposit ---

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, part of issued CLV: all accounts withdraw 180 CLV, all make first deposit, provide 100 CLV'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _180e18)
    
    // first funds provided
    const gasResults = await provideToSP_allAccounts(_10_Accounts, poolManager, _100e18)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, all issued CLV: all accounts withdraw 180 CLV, all make first deposit, 180 CLV'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _180e18)
    
    // first funds provided
    const gasResults = await provideToSP_allAccounts(_10_Accounts, poolManager, _180e18)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, all accounts withdraw 180 CLV, all make first deposit, random CLV amount'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _180e18)
    
    // first funds provided
    const gasResults = await provideToSP_allAccounts_randomAmount(1, 179, _10_Accounts, poolManager)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

//    // --- Top-up deposit ---

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, deposit part of issued CLV: all accounts withdraw 180 CLV, all make second deposit, provide 50 CLV'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _180e18)
    await provideToSP_allAccounts(_10_Accounts, poolManager, _50e18)
    
    // top-up of StabilityPool Deposit
    const gasResults = await provideToSP_allAccounts(_10_Accounts, poolManager, _50e18)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, deposit all issued CLV: all accounts withdraw 180 CLV, make second deposit, provide 90 CLV'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _180e18)
    await provideToSP_allAccounts(_10_Accounts, poolManager, _90e18)
    
   // top-up of StabilityPool Deposit
    const gasResults = await provideToSP_allAccounts(_10_Accounts, poolManager, _90e18)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, all accounts withdraw 180 CLV, make second deposit, random CLV amount'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _180e18)
    await provideToSP_allAccounts(_10_Accounts, poolManager, _90e18)
    
    // top-up of StabilityPool Deposit
    const gasResults = await provideToSP_allAccounts_randomAmount(1, 89, _10_Accounts, poolManager)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)

    appendData(gasResults, message, data)
  })

//   // --- provideToSP(): Pending rewards
 
//   // --- Top-up deposit ---

 it("", async () => {
  const message = 'provideToSP(), with pending rewards in system. deposit part of issued CLV: all accounts make second deposit, provide 50 CLV'
  // 9 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 50 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,11), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,11), cdpManager, _180e18)
  await provideToSP_allAccounts(accounts.slice(2,11), poolManager, _50e18)

  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[0]'s ICR falls below MCR
  await priceFeed.setPrice(100)
  await cdpManager.liquidate(accounts[1], { from: accounts[0]})
 
  assert.isFalse(await sortedCDPs.contains(accounts[1]))

  // 9 active CDPs top up their Stability Pool deposits with 50 CLV
  const gasResults = await provideToSP_allAccounts(accounts.slice(2,11), poolManager, _50e18)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

it("", async () => {
  const message = 'provideToSP(), with pending rewards in system. deposit all issued CLV: all accounts make second deposit, provide 90 CLV'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 90 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,12), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,12), cdpManager, _180e18)
  await provideToSP_allAccounts(accounts.slice(2,12), poolManager, _90e18)

  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[0]'s ICR falls below MCR
  await priceFeed.setPrice(100)
  await cdpManager.liquidate(accounts[1], { from: accounts[0]})
 
  assert.isFalse(await sortedCDPs.contains(accounts[1]))

  // 5 active CDPs top up their Stability Pool deposits with 90 CLV, using up all their issued CLV
  const gasResults = await provideToSP_allAccounts(accounts.slice(7,12), poolManager, _90e18)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

it("", async () => {
  const message = 'provideToSP(), with pending rewards in system. deposit part of issued CLV: all make second deposit, provide random CLV amount'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 90 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,12), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,12), cdpManager, _180e18)
  await provideToSP_allAccounts(accounts.slice(2,12), poolManager, _90e18)

  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[0]'s ICR falls below MCR
  await priceFeed.setPrice(100)
  await cdpManager.liquidate(accounts[1], { from: accounts[0]})
 
  assert.isFalse(await sortedCDPs.contains(accounts[1]))

  // 5 active CDPs top up their Stability Pool deposits with a random CLV amount
  const gasResults = await provideToSP_allAccounts_randomAmount(1, 89, accounts.slice(7,12), poolManager)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

// --- withdrawFromSP() ---

// --- No pending rewards ---

// partial
it("", async () => {
  const message = 'withdrawFromSP(), no pending rewards. Stability Pool depositors make partial withdrawal - 90 CLV of 180 CLV deposit'
  await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _180e18)
  await provideToSP_allAccounts(_10_Accounts, poolManager, _180e18)

  const gasResults = await withdrawFromSP_allAccounts(_10_Accounts, poolManager, _90e18)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

// full
it("", async () => {
  const message = 'withdrawFromSP(), no pending rewards. Stability Pool depositors make full withdrawal - 180 CLV of 180 CLV deposit'
  await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _180e18)
  await provideToSP_allAccounts(_10_Accounts, poolManager, _180e18)

  const gasResults = await withdrawFromSP_allAccounts(_10_Accounts, poolManager, _180e18)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

// random amount
it("", async () => {
  const message = 'withdrawFromSP(), no pending rewards. Stability Pool depositors make partial withdrawal - random CLV amount, less than 180 CLV deposit'
  await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _180e18)
  await provideToSP_allAccounts(_10_Accounts, poolManager, _180e18)

  const gasResults = await withdrawFromSP_allAccounts_randomAmount(1, 179, _10_Accounts, poolManager)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})


// // --- withdrawFromSP() ---

// // --- Pending rewards in system ---

it("", async () => {
  const message = 'withdrawFromSP(), pending rewards in system. Stability Pool depositors make partial withdrawal - 90 CLV of 180 CLV deposit'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,12), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,12), cdpManager, _180e18)
  await provideToSP_allAccounts(accounts.slice(2,12), poolManager, _180e18)

  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[0]'s ICR falls below MCR
  await priceFeed.setPrice(100)
  await cdpManager.liquidate(accounts[1], { from: accounts[0]})
 
  assert.isFalse(await sortedCDPs.contains(accounts[1]))

  // 5 active CDPs reduce their Stability Pool deposit by 90 CLV
  const gasResults = await withdrawFromSP_allAccounts(accounts.slice(7,12), poolManager, _90e18)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

it("", async () => {
  const message = 'withdrawFromSP(), pending rewards in system. Stability Pool depositors make full withdrawal - 180 CLV of 180 CLV deposit'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,12), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,12), cdpManager, _180e18)
  await provideToSP_allAccounts(accounts.slice(2,12), poolManager, _180e18)

  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[0]'s ICR falls below MCR
  await priceFeed.setPrice(100)
  await cdpManager.liquidate(accounts[1], { from: accounts[0]})
 
  assert.isFalse(await sortedCDPs.contains(accounts[1]))

  // 5 active CDPs reduce their Stability Pool deposit by 180 CLV
  const gasResults = await withdrawFromSP_allAccounts(accounts.slice(7,12), poolManager, _180e18)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

it("", async () => {
  const message = 'withdrawFromSP(), pending rewards in system. Stability Pool depositors make partial withdrawal - random amount of CLV'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,12), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,12), cdpManager, _180e18)
  await provideToSP_allAccounts(accounts.slice(2,12), poolManager, _180e18)

  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[0]'s ICR falls below MCR
  await priceFeed.setPrice(100)
  await cdpManager.liquidate(accounts[1], { from: accounts[0]})
 
  assert.isFalse(await sortedCDPs.contains(accounts[1]))

  // 5 active CDPs reduce their Stability Pool deposit by random amount
  const gasResults = await withdrawFromSP_allAccounts_randomAmount(1, 179, accounts.slice(7,12), poolManager)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

// --- withdrawFromSPtoCDP() ---

// --- No pending rewards ---
it("", async () => {
  const message = 'withdrawFromSPtoCDP(), no pending rewards. All accounts withdraw 180 CLV, provide a random amount, then withdraw all to SP'
  await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _180e18)
  await provideToSP_allAccounts_randomAmount(1, 179, _10_Accounts, poolManager)

  const gasResults = await withdrawFromSPtoCDP_allAccounts(accounts.slice(5,10), poolManager)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

it("", async () => {
  const message = 'withdrawFromSPtoCDP(), no pending rewards. All accounts withdraw 180 CLV, provide 180 CLV, then withdraw all to SP'
  await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _180e18)
  await provideToSP_allAccounts(_10_Accounts, poolManager, _180e18)

  const gasResults = await withdrawFromSPtoCDP_allAccounts(accounts.slice(5,10), poolManager)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

// --- withdrawFromSPtoCDP() - deposit has pending rewards ---
it("", async () => {
  const message = 'withdrawFromSPtoCDP(), pending rewards in system. Accounts withdraw 180 CLV, provide 180 CLV, then withdraw all to SP after a liquidation'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,12), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,12), cdpManager, _180e18)
  await provideToSP_allAccounts(accounts.slice(2,12), poolManager, _180e18)

  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[0]'s ICR falls below MCR
  await priceFeed.setPrice(100)
  await cdpManager.liquidate(accounts[1], { from: accounts[0]})
 
  assert.isFalse(await sortedCDPs.contains(accounts[1]))

  // 5 active CDPs reduce their Stability Pool deposit by 90 CLV
  const gasResults = await withdrawFromSPtoCDP_allAccounts(accounts.slice(7,12), poolManager)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

it("", async () => {
  const message = 'withdrawFromSPtoCDP(), pending rewards in system. Accounts withdraw 180 CLV, provide a random amount, then withdraw all to SP after a liquidation'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,12), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,12), cdpManager, _180e18)
  await await provideToSP_allAccounts_randomAmount(1, 179, accounts.slice(2,12), poolManager)

  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)
  await cdpManager.liquidate(accounts[1], { from: accounts[0]})
 
  assert.isFalse(await sortedCDPs.contains(accounts[1]))

  // 5 active CDPs reduce their Stability Pool deposit by 90 CLV
  const gasResults = await withdrawFromSPtoCDP_allAccounts(accounts.slice(7,12), poolManager)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

// --- liquidate() ---

it("", async () => {
  const message = 'liquidate() 1 CDP Normal Mode, 10 active CDPs, No funds in SP, no ETH gain in pool'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,12), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,12), cdpManager, _180e18)
 
  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)

  const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = 'liquidate() 1 CDP Normal Mode, 10 active CDPs, Funds in SP partially covering liquidation, no ETH gain in pool'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,12), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,12), cdpManager, _180e18)
 
  await poolManager.provideToSP( _100e18, {from:accounts[2]})

  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)

  const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = 'liquidate() 1 CDP Normal Mode, 10 active CDPs, Funds in SP fully covering liquidation, no ETH gain in pool'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,12), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,12), cdpManager, _180e18)
 
  await poolManager.provideToSP( _180e18, {from:accounts[2]})

  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)

  const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

//--- 30 CDPs --- 

it("", async () => {
  const message = 'liquidate()  1 CDP Normal Mode,30 active CDPs, No funds in SP, no ETH gain in pool'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,32), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,32), cdpManager, _180e18)
 
  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)

  const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = 'liquidate() 1 CDP Normal Mode, 30 active CDPs, Funds in SP partially covering liquidation, no ETH gain in pool'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,32), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,32), cdpManager, _180e18)
 
  await poolManager.provideToSP( _100e18, {from:accounts[2]})

  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)

  const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = 'liquidate() 1 CDP Normal Mode, 30 active CDPs, Funds in SP fully covering liquidation, no ETH gain in pool'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,32), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,32), cdpManager, _180e18)
 
  await poolManager.provideToSP( _180e18, {from:accounts[2]})

  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)

  const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// // --- liquidateCDPs() ---

it("", async () => {
  const message = 'liquidateCDPs() Normal Mode liquidates 1 CDP, n = 10, 10 remaining active CDPs, No funds in SP, no ETH gain in pool'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,12), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,12), cdpManager, _180e18)

  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)

  const tx = await cdpManager.liquidateCDPs(1, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})


it("", async () => {
  const message = 'liquidateCDPs() Normal Mode liquidates 2 CDPs, 10 remaining active CDPs, No funds in SP, no ETH gain in pool'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(3,13), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(3,13), cdpManager, _180e18)

  //2 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await addColl_allAccounts([accounts[2]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  await cdpManager.withdrawCLV(_180e18, accounts[2], {from: accounts[2]} )

  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)

  const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = 'liquidateCDPs() Normal Mode liquidates 3 CDPs, 10 remaining active CDPs, No funds in SP, no ETH gain in pool'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(4,14), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(4,14), cdpManager, _180e18)

  //3 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(1,4), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,4), cdpManager, _180e18)
 
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)

  const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = 'liquidateCDPs() Normal Mode liquidates 10 CDPs, 10 remaining active CDPs, No funds in SP, no ETH gain in pool'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(11,21), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(11,21), cdpManager, _180e18)

  //10 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(1,11), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,11), cdpManager, _180e18)
 
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)

  const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = 'liquidateCDPs() Normal Mode liquidates 30 CDPs, 30 remaining active CDPs, No funds in SP, no ETH gain in pool'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(31,61), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(31,61), cdpManager, _180e18)
 
  //30 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(1,31), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,31), cdpManager, _180e18)
 
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)

  const tx = await cdpManager.liquidateCDPs(30, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})


// liquidate CDPs - all offset by funds in SP 

it("", async () => {
  const message = 'liquidateCDPs() Normal Mode liquidates 1 CDP, completely offset by SP funds, n = 10, 10 remaining active CDPs, no ETH gain in pool'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,12), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,12), cdpManager, _180e18)

  await poolManager.provideToSP( _180e18, {from:accounts[2]})

  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)

  const tx = await cdpManager.liquidateCDPs(1, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = 'liquidateCDPs() Normal Mode liquidates 2 CDPs, completely offset by SP funds, 10 remaining active CDPs, No funds in SP, no ETH gain in pool'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(3,13), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(3,13), cdpManager, _180e18)

  await provideToSP_allAccounts(accounts.slice(3,5), poolManager, _180e18)

  //2 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await addColl_allAccounts([accounts[2]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  await cdpManager.withdrawCLV(_180e18, accounts[2], {from: accounts[2]} )

  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)

  const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = 'liquidateCDPs() Normal Mode liquidates 3 CDPs, completely offset by SP funds, 10 remaining active CDPs, No funds in SP, no ETH gain in pool'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(4,14), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(4,14), cdpManager, _180e18)
  
  await provideToSP_allAccounts(accounts.slice(4,7), poolManager,_180e18)
 
  //3 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(1,4), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,4), cdpManager, _180e18)
 
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)

  const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = 'liquidateCDPs() Normal Mode liquidates 10 CDPs, completely offset by SP funds, 10 remaining active CDPs, No funds in SP, no ETH gain in pool'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(11,21), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(11,21), cdpManager, _180e18)

  await provideToSP_allAccounts(accounts.slice(11,21), poolManager,_180e18)

  //10 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(1,11), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,11), cdpManager, _180e18)
 
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)

  const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = 'liquidateCDPs() Normal Mode liquidates 30 CDPs, completely offset by SP funds, 30 remaining active CDPs, No funds in SP, no ETH gain in pool'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(31,61), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(31,61), cdpManager, _180e18)
 
  await provideToSP_allAccounts(accounts.slice(31,61), poolManager,_180e18)

  //30 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(1,31), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,31), cdpManager, _180e18)
 
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(100)

  const tx = await cdpManager.liquidateCDPs(30, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// --- findInsertPosition ---

// --- Insert at head, 0 traversals ---

it("", async () => {
  const message = 'findInsertPosition(), 10 CDPs with ICRs 200-209%, ICR > head ICR, no hint, 0 traversals'
 
  // makes 10 CDPs with ICRs 200 to 209%
  await makeCDPsIncreasingICR(_10_Accounts)

  // 300% ICR, higher than CDP at head of list
  const CR = web3.utils.toWei('3', 'ether')
  const address_0 = '0x0000000000000000000000000000000000000000'
 
  const tx = await functionCaller.sortedCDPs_findInsertPosition(CR, address_0, address_0)
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
} )

it("", async () => {
  const message = 'findInsertPosition(), 50 CDPs with ICRs 200-209%, ICR > head ICR, no hint, 0 traversals'
 
  // makes 10 CDPs with ICRs 200 to 209%
  await makeCDPsIncreasingICR(_50_Accounts)

  // 300% ICR, higher than CDP at head of list
  const CR = web3.utils.toWei('3', 'ether')
  const address_0 = '0x0000000000000000000000000000000000000000'
 
  const tx = await functionCaller.sortedCDPs_findInsertPosition(CR, address_0, address_0)
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
} )

// --- Insert at tail, so num. traversals = listSize ---

it("", async () => {
  const message = 'findInsertPosition(), 10 CDPs with ICRs 200-209%, ICR < tail ICR, no hint, 10 traversals'
 
  // makes 10 CDPs with ICRs 200 to 209%
  await makeCDPsIncreasingICR(_10_Accounts)

 // 200% ICR, lower than CDP at tail of list
  const CR = web3.utils.toWei('2', 'ether')
  const address_0 = '0x0000000000000000000000000000000000000000'
 
  const tx = await functionCaller.sortedCDPs_findInsertPosition(CR, address_0, address_0)
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
} )

it("", async () => {
  const message = 'findInsertPosition(), 20 CDPs with ICRs 200-219%, ICR <  tail ICR, no hint, 20 traversals'
 
  // makes 20 CDPs with ICRs 200 to 219%
  await makeCDPsIncreasingICR(_20_Accounts)

  // 200% ICR, lower than CDP at tail of list
  const CR = web3.utils.toWei('2', 'ether')
 
  const tx = await functionCaller.sortedCDPs_findInsertPosition(CR, address_0, address_0)
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})


  it("", async () => {
    const message = 'findInsertPosition(), 50 CDPs with ICRs 200-249%, ICR <  tail ICR, no hint, 50 traversals'
    
    // makes 50 CDPs with ICRs 200 to 249%
    await makeCDPsIncreasingICR(_50_Accounts)

    // 200% ICR, lower than CDP at tail of list
    const CR = web3.utils.toWei('2', 'ether')
  
    const tx = await functionCaller.sortedCDPs_findInsertPosition(CR, address_0, address_0)
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

// withdrawPenaltyFromSP
  it("", async () => {
    const message = "withdrawPenaltyFromSP()"
    // Acct 1 withdraws 1500 CLV and provides to StabilityPool
    await cdpManager.addColl(accounts[1], accounts[1], { from: accounts[1], value: _100_Ether })
    await cdpManager.withdrawCLV(_1500e18, accounts[1], { from: accounts[1] })
    await poolManager.provideToSP(_1500e18, { from: accounts[1] })
  
    // 2 CDPs opened, each withdraws 1500 CLV
    await addColl_allAccounts(accounts.slice(2,4), cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(accounts.slice(2,4), cdpManager, _1500e18)
    
    // Acct 4 makes deposit #1: 500 CLV
    await cdpManager.addColl(accounts[4], accounts[4], { from: accounts[4], value: _10_Ether })
    await cdpManager.withdrawCLV(_500e18, accounts[4], { from: accounts[4] })
    await poolManager.provideToSP(_500e18, { from: accounts[4] })

    // price drops
    await priceFeed.setPrice(100);

    // account[2] closed
    await cdpManager.liquidate(accounts[2]);

    // Acct 5 provides another 2000 CLV to StabilityPool
    await cdpManager.addColl(accounts[5], accounts[5], { from: accounts[5], value: _100_Ether })
    await cdpManager.withdrawCLV(_2000e18, accounts[5], { from: accounts[5] })
    await poolManager.provideToSP(_2000e18, { from: accounts[5] })

    // // account[3] closed
    await cdpManager.liquidate(accounts[3]);

    // bob calls withdrawPenalty, clamims penalty
    const tx = await poolManager.withdrawPenaltyFromSP(accounts[4])
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  // --- DeciMath Functions ---

  it.only("", async () => {
    const message = "decMul() with random args"
    const rand1 = randAmountInWei(1,200)
    const rand2 = randAmountInWei(1,200)
    const tx = await functionCaller.decimath_decMul(rand1, rand2)
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = "decDiv() with random args"
    const rand1 = randAmountInWei(1,200)
    const rand2 = randAmountInWei(1,200)
    const tx = await functionCaller.decimath_decDiv(rand1, rand2)
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = "accurateMulDiv() with random args"
    const rand1 = randAmountInWei(1,200)
    const rand2 = randAmountInWei(1,200)
    const rand3 = randAmountInWei(1,200)
    const tx = await functionCaller.decimath_accurateMulDiv(rand1, rand2, rand3)
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = "div_toDuint() with random args"
    const rand1 = randAmountInWei(1,200)
    const rand2 = randAmountInWei(1,200)
    const tx = await functionCaller.decimath_div_toDuint(rand1, rand2)
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = "mul_uintByDuint() with random args"
    const rand1 = randAmountInWei(1,200)
    const rand2 = randAmountInWei(1,200)
    const tx = await functionCaller.decimath_mul_uintByDuint(rand1, rand2)
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("Export test data", async () => {
    fs.writeFile('test/gas/gasTestData.csv', data, (err) => { 
      if (err) console.log(err)
    console.log("Gas test data written to /gasTestData.csv") })
  })
})

/* TODO: 

-Liquidations with pending rewards from distributions
-Liquidations with pending SP gains (that may / may not stop liquidation) 
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