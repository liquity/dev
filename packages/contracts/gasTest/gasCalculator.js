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
const ABDKMath64x64 = artifacts.require("ABDKMath64x64")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const deploymentHelpers = require("../utils/deploymentHelpers.js")

const getAddresses = deploymentHelpers.getAddresses
const setNameRegistry = deploymentHelpers.setNameRegistry
const connectContracts = deploymentHelpers.connectContracts
const getAddressesFromNameRegistry = deploymentHelpers.getAddressesFromNameRegistry

const testHelpers = require("../utils/testHelpers.js")
const getDifference = testHelpers.getDifference

const moneyVals = testHelpers.MoneyValues

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
  
  const _1e18 = web3.utils.toWei('1', 'ether')
  const _30e18 = web3.utils.toWei('30', 'ether')
  const _50e18 = web3.utils.toWei('50', 'ether')
  const _150e18 = web3.utils.toWei('150', 'ether')

  const _80e18 =  web3.utils.toWei('80', 'ether')
  const _90e18 =  web3.utils.toWei('90', 'ether')

  const _100e18 = web3.utils.toWei('100', 'ether')
  const _101e18 = web3.utils.toWei('101', 'ether')
  const _180e18 = web3.utils.toWei('180', 'ether')
  const _200e18 = web3.utils.toWei('200', 'ether')
  const _360e18 = web3.utils.toWei('360', 'ether')
  const _450e18 = web3.utils.toWei('450', 'ether')
  const _500e18 = web3.utils.toWei('500', 'ether')
  const _600e18 = web3.utils.toWei('600', 'ether')
  const _900e18 = web3.utils.toWei('900', 'ether')
  const _1000e18 = web3.utils.toWei('1000', 'ether')
  const _1500e18 = web3.utils.toWei('1500', 'ether')
  const _1700e18 = web3.utils.toWei('1700', 'ether')
  const _1800e18 = web3.utils.toWei('1800', 'ether')
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
    const abdkMath = await ABDKMath64x64.new()
    DeciMath.setAsDeployed(deciMath)
    ABDKMath64x64.setAsDeployed(abdkMath)
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

  const randAmountInGwei = (min, max) => {
    const amount = Math.floor(Math.random() * (max - min) + min);
    const amountInWei = web3.utils.toWei(amount.toString(), 'gwei')
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

  const openLoan_allAccounts = async(accounts, cdpManager, ETHAmount, CLVAmount) => {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await cdpManager.openLoan(CLVAmount, account, { from: account, value: ETHAmount })
      const gas = gasUsed(tx)
      gasCostList.push(gas)
    }
   return getGasMetrics(gasCostList)
  }

  const closeLoan_allAccounts = async(accounts, cdpManager) => {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await cdpManager.closeLoan({from: account})
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
    const price = await priceFeed.getPrice()

    for (const account of accounts) {
      const tx = await functionCaller.cdpManager_getCurrentICR(account, price)
      const gas = gasUsed(tx) - 21000
      gasCostList.push(gas)
    }
    return getGasMetrics(gasCostList)
  }

  const redeemCollateral = async (redeemer, cdpManager, CLVAmount) => {
    const price = await priceFeed.getPrice()
    const redemptionHints = await cdpManager.getRedemptionHints(CLVAmount, price)
    const firstRedemptionHint = redemptionHints[0]
    const partialRedemptionHintICR = redemptionHints[1]

    const approxPartialRedemptionHint = await cdpManager.getApproxHint(partialRedemptionHintICR, 1000)
    const exactPartialRedemptionHint = (await sortedCDPs.findInsertPosition(partialRedemptionHintICR,
                                                                          price,
                                                                          approxPartialRedemptionHint,
                                                                          approxPartialRedemptionHint))[0]
                                                                 
    const tx = await cdpManager.redeemCollateral(CLVAmount, 
                                                firstRedemptionHint, 
                                                exactPartialRedemptionHint, 
                                                partialRedemptionHintICR, 
                                                { from: redeemer })
    const gas = await gasUsed(tx)
    return gas
  }

  const redeemCollateral_allAccounts_randomAmount = async (min, max, accounts, cdpManager) => {
    const gasCostList = []
    const price = await priceFeed.getPrice()

    for (const redeemer of accounts) {
      const randCLVAmount = randAmountInWei(min, max)
      const redemptionHints = await cdpManager.getRedemptionHints(randCLVAmount, price)
      const firstRedemptionHint = redemptionHints[0]
      const partialRedemptionHintICR = redemptionHints[1]
  
      const approxPartialRedemptionHint = await cdpManager.getApproxHint(partialRedemptionHintICR, 1000)
      const exactPartialRedemptionHint = (await sortedCDPs.findInsertPosition(partialRedemptionHintICR,
                                                                            price,
                                                                            approxPartialRedemptionHint,
                                                                            approxPartialRedemptionHint))[0]
                                                                  
      const tx = await cdpManager.redeemCollateral(randCLVAmount, 
                                                  firstRedemptionHint, 
                                                  exactPartialRedemptionHint, 
                                                  partialRedemptionHintICR, 
                                                  { from: redeemer })
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

      const tx = await poolManager.withdrawFromSPtoCDP(account, account, { from: account })
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

  it("", async () => {
    const message = 'openLoan(), single account, 0 existing CDPs in system. Adds 10 ether and issues 100 CLV'
    const tx = await cdpManager.openLoan(_100e18, accounts[2], {from: accounts[2], value: _10_Ether})
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = 'openLoan(), single account, 1 existing CDP in system. Adds 10 ether and issues 100 CLV'
    await cdpManager.openLoan(_100e18, accounts[1],  {from: accounts[1], value: _10_Ether})

    const tx = await cdpManager.openLoan(_100e18, accounts[2], {from: accounts[2], value: _10_Ether})
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = 'openLoan(), single account, Inserts between 2 existing CDs in system. Adds 10 ether and issues 80 CLV. '

    await cdpManager.openLoan(_100e18, accounts[1],  {from: accounts[1], value: _10_Ether})
    await cdpManager.openLoan(_50e18, accounts[2],  {from: accounts[2], value: _10_Ether})

    const tx = await cdpManager.openLoan(_80e18, accounts[3], {from: accounts[3], value: _10_Ether})

    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = 'openLoan(), 10 accounts, each account adds 10 ether and issues 100 CLV'
  
    const amountETH = _10_Ether
    const amountCLV = 0
    const gasResults = await openLoan_allAccounts(_10_Accounts, cdpManager, amountETH, amountCLV)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)
    
    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'openLoan(), 10 accounts, each account adds 10 ether and issues less CLV than the previous one'
    const amountETH = _10_Ether
    const amountCLV = 200
    const gasResults = await openLoan_allAccounts_decreasingCLVAmounts(_10_Accounts, cdpManager, amountETH, amountCLV)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)
    
    appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'openLoan(), 10 accounts, each account adds 20 ether and issues less CLV than the previous one'
    const amountETH = _20_Ether
    const amountCLV = 200
    const gasResults = await openLoan_allAccounts_decreasingCLVAmounts(_10_Accounts, cdpManager, amountETH, amountCLV)
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)
    
    appendData(gasResults, message, data)
  })

  // --- closeLoan() ---
  
  it("", async () => {
    const message = 'closeLoan(), 10 accounts, 1 account closes its loan'
    await openLoan_allAccounts_decreasingCLVAmounts(_10_Accounts, cdpManager, _10_Ether, 200)

    const tx = await cdpManager.closeLoan({from: accounts[1]})
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = 'closeLoan(), 20 accounts, each account adds 10 ether and issues less CLV than the previous one. First 10 accounts close their loan. '
    await openLoan_allAccounts_decreasingCLVAmounts(_20_Accounts, cdpManager, _10_Ether, 200)
    
    const gasResults = await closeLoan_allAccounts(_10_Accounts, cdpManager)
    
    logGasMetrics(gasResults, message)
    logAllGasCosts(gasResults)
    
    appendData(gasResults, message, data)
  })

  // --- addColl() ---

  it("", async () => {
    const message = 'addColl(), first deposit, 0 CDPs in system. Adds 10 ether'
  
    const tx = await cdpManager.addColl(accounts[2], accounts[2], {from: accounts[2], value: _10_Ether})
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = 'addColl(), first deposit,  10 existing CDP in system. Adds 10 ether'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)

    const tx = await cdpManager.addColl(accounts[2], accounts[2], {from: accounts[2], value: _10_Ether})
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = 'addColl(), second deposit, 0 CDPs in system. Adds 10 ether'
  
    await cdpManager.addColl(accounts[2], accounts[2], {from: accounts[2], value: _10_Ether})
    const tx = await cdpManager.addColl(accounts[2], accounts[2], {from: accounts[2], value: _10_Ether})
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = 'addColl(), second deposit, 10 existing CDPs in system. Adds 10 ether'
     await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)

    await cdpManager.addColl(accounts[99], accounts[99], {from: accounts[99], value: _10_Ether})
    const tx = await cdpManager.addColl(accounts[99], accounts[99], {from: accounts[99], value: _10_Ether})
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

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
    const message = 'withdrawColl(), first withdrawal. 10 accounts in system. 1 account withdraws 5 ether'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)

    const tx = await cdpManager.withdrawColl(_5_Ether, accounts[9], {from: accounts[9]})
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

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
    const message = 'withdrawColl(), first withdrawal. 10 accounts in system. 1 account withdraws 10 ether, leaving CDP empty'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)

    const tx = await cdpManager.withdrawColl(_10_Ether, accounts[9], {from: accounts[9]})
    const gas = gasUsed(tx)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
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

  const price = await priceFeed.getPrice()
  const tx = await functionCaller.cdpManager_getCurrentICR(accounts[1], price)

  const gas = gasUsed(tx) - 21000
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

// --- getCurrentICR() with pending distribution rewards ---

it("", async () => {
  const message = 'single getCurrentICR() call, WITH pending rewards'
  
  await cdpManager.addColl(accounts[1], accounts[1], {from: accounts[1], value: _10_Ether})
  const randCLVAmount = randAmountInWei(1,180)
  await cdpManager.withdrawCLV(randCLVAmount, accounts[1], {from: accounts[1]})

   // acct 999 adds coll, withdraws CLV, sits at 111% ICR
   await cdpManager.addColl(accounts[999], accounts[999], {from: accounts[999], value: _1_Ether})
   await cdpManager.withdrawCLV(_180e18, accounts[999], { from: accounts[999]})

    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
   await priceFeed.setPrice(_100e18)
   await cdpManager.liquidate(accounts[999], { from: accounts[0]})

  const price = await priceFeed.getPrice()
  const tx = await functionCaller.cdpManager_getCurrentICR(accounts[1], price)

  const gas = gasUsed(tx) - 21000
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = 'getCurrentICR(), new CDPs with 10 ether and no withdrawals,  WITH pending rewards'
  await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)

   // acct 999 adds coll, withdraws CLV, sits at 111% ICR
   await cdpManager.addColl(accounts[999], accounts[999], {from: accounts[999], value: _1_Ether})
   await cdpManager.withdrawCLV(_180e18, accounts[999], { from: accounts[999]})

    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
   await priceFeed.setPrice(_100e18)
   await cdpManager.liquidate(accounts[999], { from: accounts[0]})

  const gasResults = await getCurrentICR_allAccounts(_10_Accounts, cdpManager)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

it("", async () => {
  const message = 'getCurrentICR(), CDPs with 10 ether and 100 CLV withdrawn, WITH pending rewards'
  await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)

   // acct 999 adds coll, withdraws CLV, sits at 111% ICR
   await cdpManager.addColl(accounts[999], accounts[999], {from: accounts[999], value: _1_Ether})
   await cdpManager.withdrawCLV(_180e18, accounts[999], { from: accounts[999]})

    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
   await priceFeed.setPrice(_100e18)
   await cdpManager.liquidate(accounts[999], { from: accounts[0]})
  
  const gasResults = await getCurrentICR_allAccounts(_10_Accounts, cdpManager)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

it("", async () => {
  const message = 'getCurrentICR(), CDPs with 10 ether and random CLV amount withdrawn, WITH pending rewards'
  await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  await withdrawCLV_allAccounts_randomAmount(1, 1800, _10_Accounts, cdpManager)

   // acct 999 adds coll, withdraws CLV, sits at 111% ICR
   await cdpManager.addColl(accounts[999], accounts[999], {from: accounts[999], value: _1_Ether})
   await cdpManager.withdrawCLV(_180e18, accounts[999], { from: accounts[999]})

    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
   await priceFeed.setPrice(_100e18)
   await cdpManager.liquidate(accounts[999], { from: accounts[0]})
  
  const gasResults = await getCurrentICR_allAccounts(_10_Accounts, cdpManager)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

 // --- redeemCollateral() ---
  it("", async () => { 
    const message = 'redeemCollateral(), redeems 50 CLV, redemption hits 1 CDP. One account in system, partial redemption'
    await addColl_allAccounts([accounts[0]], cdpManager, _10_Ether)
    await withdrawCLV_allAccounts([accounts[0]], cdpManager, _100e18)
    const gas = await redeemCollateral(accounts[0], cdpManager, _50e18)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => { 
    const message = 'redeemCollateral(), redeems 50 CLV, redemption hits 1 CDP. No pending rewards. 3 accounts in system, partial redemption'
    // 3 accounts add coll
    await addColl_allAccounts(accounts.slice(0,3), cdpManager, _10_Ether)
    // 3 accounts withdraw successively less CLV
    await cdpManager.withdrawCLV(_100e18, accounts[0], {from: accounts[0]})
    await cdpManager.withdrawCLV(_90e18, accounts[1], {from: accounts[1]})
    await cdpManager.withdrawCLV(_80e18, accounts[2], {from: accounts[2]})
    
    console.log("acct 2 in list:" + (await sortedCDPs.contains(accounts[2])))
    /* Account 2 redeems 50 CLV. It is redeemed from account 0's CDP, 
    leaving the CDP active with 30 CLV and ((200 *10 - 50 ) / 200 ) = 9.75 ETH. 
    
    It's ICR jumps from 2500% to 6500% and it is reinserted at the top of the list.
    */

    const gas = await redeemCollateral(accounts[2], cdpManager, _50e18)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => { 
    const message = 'redeemCollateral(), redeemed 101 CLV, redemption hits 2 CDPs, last redemption is partial'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)

    // Whale adds 200 ether, withdraws 500 CLV, redeems 101 CLV
    await cdpManager.addColl(accounts[9], accounts[9], {from: accounts[9], value: _200_Ether})
    await cdpManager.withdrawCLV(_500e18, accounts[9], { from: accounts[9]})
    
    console.log("acct 9 in list:" + (await sortedCDPs.contains(accounts[9])))

    const gas = await redeemCollateral(accounts[9], cdpManager, _101e18)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => { 
    const message = 'redeemCollateral(), redeemed 500 CLV, redemption hits 5 CDPs, all full redemptions'
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
    const message = 'redeemCollateral(), redeemed 450 CLV, redemption hits 5 CDPs,  last redemption is partial (50 of 100 CLV)'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)

    // Whale adds 200 ether, withdraws 500 CLV, redeems 500 CLV
    await cdpManager.addColl(accounts[9], accounts[9], {from: accounts[9], value: _200_Ether})
    await cdpManager.withdrawCLV(_450e18, accounts[9], { from: accounts[9]})
    const gas = await redeemCollateral(accounts[9], cdpManager, _450e18)
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

  // Slow test

  // it("", async () => { 
  //   const message = 'redeemCollateral(),  CLV, each redemption only hits the first CDP, never closes it'
  //   await addColl_allAccounts(_20_Accounts, cdpManager, _10_Ether)
  //   await withdrawCLV_allAccounts(_20_Accounts, cdpManager, _100e18)

  //   const gasResults = await redeemCollateral_allAccounts_randomAmount( 1, 10, _10_Accounts, cdpManager)
  //   logGasMetrics(gasResults, message)
  //   logAllGasCosts(gasResults)

  //   appendData(gasResults, message, data)
  // })
  
  // --- redeemCollateral(), with pending redistribution rewards --- 

  it("", async () => { 
    const message = 'redeemCollateral(), redeems 50 CLV, redemption hits 1 CDP, WITH pending rewards. One account in system'
    await cdpManager.addColl(accounts[1], accounts[1], {from: accounts[1], value: _10_Ether})
    await cdpManager.withdrawCLV(_100e18, accounts[1], { from: accounts[1]})

    // acct 999 adds coll, withdraws CLV, sits at 111% ICR
    await cdpManager.addColl(accounts[999], accounts[999], {from: accounts[999], value: _1_Ether})
    await cdpManager.withdrawCLV(_180e18, accounts[999], { from: accounts[999]})

    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(_100e18)
    await cdpManager.liquidate(accounts[999], { from: accounts[0]})

    const gas = await redeemCollateral(accounts[1], cdpManager, _50e18)

    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => { 
    const message = 'redeemCollateral(), redeems 50 CLV, redemption hits 1 CDP. WITH pending rewards. 3 accounts in system.'
    // 3 accounts add coll
    await addColl_allAccounts(accounts.slice(0,3), cdpManager, _10_Ether)
    // 3 accounts withdraw successively less CLV
    await cdpManager.withdrawCLV(_100e18, accounts[0], {from: accounts[0]})
    await cdpManager.withdrawCLV(_90e18, accounts[1], {from: accounts[1]})
    await cdpManager.withdrawCLV(_80e18, accounts[2], {from: accounts[2]})
    
    // acct 999 adds coll, withdraws CLV, sits at 111% ICR
    await cdpManager.addColl(accounts[999], accounts[999], {from: accounts[999], value: _1_Ether})
    await cdpManager.withdrawCLV(_180e18, accounts[999], { from: accounts[999]})

    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(_100e18)
    await cdpManager.liquidate(accounts[999], { from: accounts[0]})

    /* Account 2 redeems 50 CLV. It is redeemed from account 0's CDP, 
    leaving the CDP active with 30 CLV and ((200 *10 - 50 ) / 200 ) = 9.75 ETH. 
    
    It's ICR jumps from 2500% to 6500% and it is reinserted at the top of the list.
    */

    const gas = await redeemCollateral(accounts[2], cdpManager, _50e18)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => { 
    const message = 'redeemCollateral(), redeemed 500 CLV, WITH pending rewards, redemption hits 5 CDPs, WITH pending rewards'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)

    // Whale adds 200 ether, withdraws 500 CLV, redeems 500 CLV
    await cdpManager.addColl(accounts[9], accounts[9], {from: accounts[9], value: _200_Ether})
    await cdpManager.withdrawCLV(_500e18, accounts[9], { from: accounts[9]})

    // acct 999 adds coll, withdraws CLV, sits at 111% ICR
    await cdpManager.addColl(accounts[999], accounts[999], {from: accounts[999], value: _1_Ether})
    await cdpManager.withdrawCLV(_180e18, accounts[999], { from: accounts[999]})

     // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(_100e18)
    await cdpManager.liquidate(accounts[999], { from: accounts[0]})

    const gas = await redeemCollateral(accounts[9], cdpManager, _500e18)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => { 
    const message = 'redeemCollateral(), redeemed 1000 CLV, WITH pending rewards, redemption hits 10 CDPs, WITH pending rewards'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_10_Accounts, cdpManager, _100e18)

    // Whale adds 200 ether, withdraws 500 CLV, redeems 500 CLV
    await cdpManager.addColl(accounts[9], accounts[9], {from: accounts[9], value: _200_Ether})
    await cdpManager.withdrawCLV(_1000e18, accounts[9], { from: accounts[9]})

     // acct 999 adds coll, withdraws CLV, sits at 111% ICR
     await cdpManager.addColl(accounts[999], accounts[999], {from: accounts[999], value: _1_Ether})
     await cdpManager.withdrawCLV(_180e18, accounts[999], { from: accounts[999]})
 
      // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
     await priceFeed.setPrice(_100e18)
     await cdpManager.liquidate(accounts[999], { from: accounts[0]})

    const gas = await redeemCollateral(accounts[9], cdpManager, _1000e18)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => { 
    const message = 'redeemCollateral(), redeemed 1500 CLV, WITH pending rewards, redemption hits 15 CDPs, WITH pending rewards'
    await addColl_allAccounts(_20_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_20_Accounts, cdpManager, _100e18)

    // Whale adds 200 ether, withdraws 1500 CLV, redeems 1500 CLV
    await cdpManager.addColl(accounts[9], accounts[9], {from: accounts[9], value: _200_Ether})
    await cdpManager.withdrawCLV(_1500e18, accounts[9], { from: accounts[9]})

    //  // acct 999 adds coll, withdraws CLV, sits at 111% ICR
     await cdpManager.addColl(accounts[999], accounts[999], {from: accounts[999], value: _1_Ether})
     await cdpManager.withdrawCLV(_180e18, accounts[999], { from: accounts[999]})
 
      // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
     await priceFeed.setPrice(_100e18)
     await cdpManager.liquidate(accounts[999], { from: accounts[0]})

    const gas = await redeemCollateral(accounts[9], cdpManager, _1500e18)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => { 
    const message = 'redeemCollateral(), redeemed 2000 CLV, WITH pending rewards, redemption hits 20 CDPs, WITH pending rewards'
    await addColl_allAccounts(_30_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts(_30_Accounts, cdpManager, _100e18)

    // Whale adds 200 ether, withdraws 2000 CLV, redeems 2000 CLV
    await cdpManager.addColl(accounts[9], accounts[9], {from: accounts[9], value: _200_Ether})
    await cdpManager.withdrawCLV(_2000e18, accounts[9], { from: accounts[9]})

     // acct 999 adds coll, withdraws CLV, sits at 111% ICR
     await cdpManager.addColl(accounts[999], accounts[999], {from: accounts[999], value: _1_Ether})
     await cdpManager.withdrawCLV(_180e18, accounts[999], { from: accounts[999]})
 
      // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
     await priceFeed.setPrice(_100e18)
     await cdpManager.liquidate(accounts[999], { from: accounts[0]})

    const gas = await redeemCollateral(accounts[9], cdpManager, _2000e18)
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  // Slow test

  // it("", async () => { 
  //   const message = 'redeemCollateral(),  CLV, each redemption only hits the first CDP, never closes it, WITH pending rewards'
  //   await addColl_allAccounts(_20_Accounts, cdpManager, _10_Ether)
  //   await withdrawCLV_allAccounts(_20_Accounts, cdpManager, _100e18)

  //    // acct 999 adds coll, withdraws CLV, sits at 111% ICR
  //    await cdpManager.addColl(accounts[999], accounts[999], {from: accounts[999], value: _1_Ether})
  //    await cdpManager.withdrawCLV(_180e18, accounts[999], { from: accounts[999]})
 
  //     // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
  //    await priceFeed.setPrice(_100e18)
  //    await cdpManager.liquidate(accounts[999], { from: accounts[0]})

  //   const gasResults = await redeemCollateral_allAccounts_randomAmount( 1, 10, _10_Accounts, cdpManager)
  //   logGasMetrics(gasResults, message)
  //   logAllGasCosts(gasResults)

  //   appendData(gasResults, message, data)
  // })


 // --- getApproxHint() ---

  it("", async () => {
    const message = 'getApproxHint(), numTrials = 10, 10 calls, each with random CR'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)
    
    gasCostList = []

    for (i = 0; i < 10; i++) {
      randomCR = randAmountInWei(1,5)
      const tx = await functionCaller.cdpManager_getApproxHint(randomCR, 10)
      const gas = gasUsed(tx) - 21000
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
    const gas = gasUsed(tx) - 21000
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = 'getApproxHint(), numTrials = 32:  i.e. k = 10, list size = 10'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)
    

    const CR = '200000000000000000000'
    tx = await functionCaller.cdpManager_getApproxHint(CR, 32)
    const gas = gasUsed(tx) - 21000
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = 'getApproxHint(), numTrials = 100: i.e. k = 10, list size = 100'
    await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
    await withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)
    
    const CR = '200000000000000000000'
    tx = await functionCaller.cdpManager_getApproxHint(CR, 100)
    const gas = gasUsed(tx) - 21000
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  // Slow tests

  // it("", async () => { //8mil. gas
  //   const message = 'getApproxHint(), numTrials = 320: i.e. k = 10, list size = 1000'
  //   await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  //   await withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)
    
  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.cdpManager_getApproxHint(CR, 320)
  //   const gas = gasUsed(tx) - 21000
  //   logGas(gas, message)

  //   appendData({gas: gas}, message, data)
  // })

  // it("", async () => { // 25mil. gas
  //   const message = 'getApproxHint(), numTrials = 1000:  i.e. k = 10, list size = 10000'
  //   await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  //   await withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)
    
  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.cdpManager_getApproxHint(CR, 1000)
  //   const gas = gasUsed(tx) - 21000
  //   logGas(gas, message)

  //   appendData({gas: gas}, message, data)
  // })

  // it("", async () => { // 81mil. gas
  //   const message = 'getApproxHint(), numTrials = 3200:  i.e. k = 10, list size = 100000'
  //   await addColl_allAccounts(_10_Accounts, cdpManager, _10_Ether)
  //   await withdrawCLV_allAccounts_randomAmount(1, 180, _10_Accounts, cdpManager)
    
  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.cdpManager_getApproxHint(CR, 3200)
  //   const gas = gasUsed(tx) - 21000
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
  //   const gas = gasUsed(tx) - 21000
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
  await priceFeed.setPrice(_100e18)
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
  await priceFeed.setPrice(_100e18)
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
  await priceFeed.setPrice(_100e18)
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
  await priceFeed.setPrice(_100e18)
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
  await priceFeed.setPrice(_100e18)
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
  await priceFeed.setPrice(_100e18)
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
  await priceFeed.setPrice(_100e18)
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
  await priceFeed.setPrice(_100e18)
  await cdpManager.liquidate(accounts[1], { from: accounts[0]})
 
  assert.isFalse(await sortedCDPs.contains(accounts[1]))

  // 5 active CDPs reduce their Stability Pool deposit by 90 CLV
  const gasResults = await withdrawFromSPtoCDP_allAccounts(accounts.slice(7,12), poolManager)
  logGasMetrics(gasResults, message)
  logAllGasCosts(gasResults)

  appendData(gasResults, message, data)
})

// --- liquidate() ---

// Pure redistribution WITH pending rewards
it("", async () => {
  const message = 'Single liquidate() call. Liquidee has pending rewards. Pure redistribution'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(6,16), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(6,16), cdpManager, _180e18)
 
  //3 acct open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(0,6), cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  await cdpManager.withdrawCLV(_180e18, accounts[2], {from: accounts[2]} )
  await cdpManager.withdrawCLV(_180e18, accounts[3], {from: accounts[3]} )

  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  // Initial distribution liquidations make system reward terms and Default Pool non-zero
  const tx1 = await cdpManager.liquidate(accounts[2], { from: accounts[0]})
  // const gas1 = gasUsed(tx1)
  // logGas(gas1, message)
  const tx2 = await cdpManager.liquidate(accounts[3], { from: accounts[0]})
  // const gas2 = gasUsed(tx2)
  // logGas(gas2, message)

  assert.isTrue(await sortedCDPs.contains(accounts[1]))

  const tx5 = await cdpManager.liquidate(accounts[1], { from: accounts[0]})

  assert.isFalse(await sortedCDPs.contains(accounts[1]))
  const gas5 = gasUsed(tx5)
  logGas(gas5, message)

  appendData({gas: gas5}, message, data)
})

it("", async () => {
  const message = 'Series of liquidate() calls. Liquidee has pending rewards. Pure redistribution'
  // 100 accts each open CDP with 10 ether, withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(100,200), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(100,200), cdpManager, _180e18)
 
  const liquidationAcctRange = accounts.slice(1,10)
  
  // Accts open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts(liquidationAcctRange, cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(liquidationAcctRange, cdpManager, _180e18)

  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  // All loans are liquidated
  for (account of liquidationAcctRange) {
    const hasPendingRewards = await cdpManager.hasPendingRewards(account)
    console.log("Liquidee has pending rewards: " + hasPendingRewards)
    
    const tx = await cdpManager.liquidate(account, { from: accounts[0]})
    assert.isFalse(await sortedCDPs.contains(account))

    const gas = gasUsed(tx)
    logGas(gas, message)
  }

  // appendData({gas: gas}, message, data)
})

// Pure redistribution with NO pending rewards
it("", async () => {
  const message = 'Single liquidate() call. Liquidee has NO pending rewards. Pure redistribution'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(6,16), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(6,16), cdpManager, _180e18)
 
  //2 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts(accounts.slice(2,4), cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[2], {from: accounts[2]} )
  await cdpManager.withdrawCLV(_180e18, accounts[3], {from: accounts[3]} )

  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  // Initial distribution liquidations make system reward terms and DefaultPool non-zero
  const tx1 = await cdpManager.liquidate(accounts[2], { from: accounts[0]})
  const tx2 = await cdpManager.liquidate(accounts[3], { from: accounts[0]})
 
  // Account 1 opens loan
  await cdpManager.openLoan(_90e18, accounts[1], {from: accounts[1], value: _1_Ether })

  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_50e18)

  assert.isTrue(await sortedCDPs.contains(accounts[1]))

  const tx3 = await cdpManager.liquidate(accounts[1], { from: accounts[0]})

  assert.isFalse(await sortedCDPs.contains(accounts[1]))
  const gas = gasUsed(tx3)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = 'Series of liquidate() calls. Liquidee has NO pending rewards. Pure redistribution'
  
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV
  
  await addColl_allAccounts(accounts.slice(100,200), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(100,200), cdpManager, _180e18)
 
  const liquidationAcctRange = accounts.slice(1,10)

  for (account of liquidationAcctRange) {
    await priceFeed.setPrice(_200e18)
    await cdpManager.openLoan(_180e18, account, {from: account, value: _1_Ether })
   
    const hasPendingRewards = await cdpManager.hasPendingRewards(account)
    console.log("Liquidee has pending rewards: " + hasPendingRewards)

    await priceFeed.setPrice(_100e18)
    const tx = await cdpManager.liquidate(account, { from: accounts[0]})

    assert.isFalse(await sortedCDPs.contains(account))

    const gas = gasUsed(tx)
    logGas(gas, message)
  }

  // appendData({gas: gas}, message, data)
})

// Pure offset with NO pending rewards
it("", async () => {
  const message = 'Single liquidate() call. Liquidee has NO pending rewards. Pure offset with SP'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(4,14), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(4,14), cdpManager, _180e18)
 
   //2 acct open CDP with 1 ether and withdraws 180 CLV
   await addColl_allAccounts(accounts.slice(0,4), cdpManager, _1_Ether)
   await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
   await cdpManager.withdrawCLV(_180e18, accounts[2], {from: accounts[2]} )
   await cdpManager.withdrawCLV(_180e18, accounts[3], {from: accounts[3]} )
   
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  // Account 4 provides 600 CLV to pool
  await cdpManager.withdrawCLV( _600e18, accounts[4], {from:accounts[4]})
  await poolManager.provideToSP( _600e18, {from:accounts[4]})

  // Initial liquidations - full offset - makes SP reward terms and SP non-zero
  await cdpManager.liquidate(accounts[2], { from: accounts[0]})
  await cdpManager.liquidate(accounts[3], { from: accounts[0]})

  const hasPendingRewards = await cdpManager.hasPendingRewards(accounts[1])
  console.log("Liquidee has pending rewards: " + hasPendingRewards)

  // Account 1 liquidated - full offset
  const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// Pure offset WITH pending rewards
it("", async () => {
  const message = 'Single liquidate() call. Liquidee has pending rewards. Pure offset with SP'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(5,15), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(5,15), cdpManager, _180e18)
 
   //2 acct open CDP with 1 ether and withdraws 180 CLV
   await addColl_allAccounts(accounts.slice(0,5), cdpManager, _1_Ether)
   await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
   await cdpManager.withdrawCLV(_180e18, accounts[2], {from: accounts[2]} )
   await cdpManager.withdrawCLV(_180e18, accounts[3], {from: accounts[3]} )
   await cdpManager.withdrawCLV(_180e18, accounts[4], {from: accounts[4]} )
   
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  // Account 5 provides 360 CLV to SP
  await cdpManager.withdrawCLV( _600e18, accounts[5], {from:accounts[5]})
  await poolManager.provideToSP( _360e18, {from:accounts[5]})

  // Initial liquidations - full offset - makes SP reward terms and SP non-zero
  await cdpManager.liquidate(accounts[2], { from: accounts[0]})
  await cdpManager.liquidate(accounts[3], { from: accounts[0]})

  // Pure redistribution - creates pending dist. rewards for account 1
  await cdpManager.liquidate(accounts[4], { from: accounts[0]})

  // Account 5 provides another 200 to the SP
  await poolManager.provideToSP( _200e18, {from:accounts[5]})

  const hasPendingRewards = await cdpManager.hasPendingRewards(accounts[1])
  console.log("Liquidee has pending rewards: " + hasPendingRewards)

  // Account 1 liquidated - full offset
  const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// Partial offset + redistribution WITH pending rewards
it("", async () => {
  const message = 'Single liquidate() call. Liquidee has pending rewards. Partial offset + redistribution'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(4,14), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(4,14), cdpManager, _180e18)
 
  //2 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts(accounts.slice(0,4), cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  await cdpManager.withdrawCLV(_180e18, accounts[2], {from: accounts[2]} )
  await cdpManager.withdrawCLV(_180e18, accounts[3], {from: accounts[3]} )
  
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  // Set up some "previous" liquidations triggering partial offsets, and pending rewards for all troves
  await poolManager.provideToSP( _100e18, {from:accounts[10]})
  await cdpManager.liquidate(accounts[2], { from: accounts[0]})

  await poolManager.provideToSP( _100e18, {from:accounts[11]})
  await cdpManager.liquidate(accounts[3], { from: accounts[0]})

  // pool refilled with 100 CLV
  await poolManager.provideToSP( _100e18, {from:accounts[12]})

  const hasPendingRewards = await cdpManager.hasPendingRewards(accounts[1])
  console.log("Liquidee has pending rewards: " + hasPendingRewards)

  // account 1 180 CLV liquidated  - partial offset
  const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// Partial offset + redistribution with NO pending rewards
it("", async () => {
  const message = 'Single liquidate() call. Liquidee has NO pending rewards. Partial offset + redistribution'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(4,14), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(4,14), cdpManager, _180e18)
 
  //2 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts(accounts.slice(2,4), cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[2], {from: accounts[2]} )
  await cdpManager.withdrawCLV(_180e18, accounts[3], {from: accounts[3]} )
  
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  // Set up some "previous" liquidations that trigger partial offsets, 
  //and create pending rewards for all troves
  await poolManager.provideToSP( _100e18, {from:accounts[10]})
  await cdpManager.liquidate(accounts[2], { from: accounts[0]})

  await poolManager.provideToSP( _100e18, {from:accounts[11]})
  await cdpManager.liquidate(accounts[3], { from: accounts[0]})

  // Pool refilled with 50 CLV
  await poolManager.provideToSP( _50e18, {from:accounts[12]})

   // Account 1 opens loan
   await cdpManager.openLoan(_90e18, accounts[1], {from: accounts[1], value: _1_Ether })

   // Price drops, account[1]'s ICR falls below MCR
   await priceFeed.setPrice(_50e18)

  const hasPendingRewards = await cdpManager.hasPendingRewards(accounts[1])
  console.log("Liquidee has pending rewards: " + hasPendingRewards)

  // account 1 90 CLV liquidated  - partial offset against 50 CLV in SP
  const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// --- Liquidate wth SP gain. Deprecated tests, since liquidations are based on raw ICR ---

// // with SP gains
// it("", async () => {
//   const message = 'liquidate() 1 CDP, liquidated CDP has pending SP rewards that keep it active'
//   // 10 accts each open CDP with 10 ether
//   await addColl_allAccounts(accounts.slice(1,11), cdpManager, _10_Ether)
 
//   //Account 99 open CDP with 1 ether and withdraws 180 CLV
//   await addColl_allAccounts([accounts[99]], cdpManager, _1_Ether)
//   await cdpManager.withdrawCLV(_180e18, accounts[99], {from: accounts[99]} )
  
//   // Acct 99 deposits 180 CLV to SP
//   await poolManager.provideToSP(_180e18, {from: accounts[99]} )

//    //Account 100 opens CDP with 1 ether and withdraws 180 CLV
//    await addColl_allAccounts([accounts[100]], cdpManager, _1_Ether)
//    await cdpManager.withdrawCLV(_180e18, accounts[100], {from: accounts[100]} )

//   // Price drops too $100, accounts 99 and 100 ICR fall below MCR
//   await priceFeed.setPrice(_100e18)

//   // Liquidate account 100. Account 100 is removed from system
//   await cdpManager.liquidate(accounts[100], { from: accounts[0]})
//   assert.isFalse(await sortedCDPs.contains(accounts[100]))

//   const tx = await cdpManager.liquidate(accounts[99], { from: accounts[0]})
//   assert.isFalse(await sortedCDPs.contains(accounts[99]))

//   const gas = gasUsed(tx)
//   logGas(gas, message)

//   appendData({gas: gas}, message, data)
// })

// Liquidate a CDP with SP gains (still closes), full offset with SP

// it("", async () => {
//   const message = 'liquidate() 1 CDP, liquidated CDP has pending SP rewards, but gets liquidated anyway, pure offset with SP'
//   let price = await priceFeed.getPrice()
//   console.log("price is " + price)
//   // 10 accts each open CDP with 10 ether
//   await addColl_allAccounts(accounts.slice(1,11), cdpManager, _10_Ether)
 
//   //Account 99 open CDP with 1 ether and withdraws 180 CLV
//   await addColl_allAccounts([accounts[99]], cdpManager, _1_Ether)
//   await cdpManager.withdrawCLV(_180e18, accounts[99], {from: accounts[99]} )
  
//   // Acct 99 deposits 1 CLV to SP
//   await poolManager.provideToSP(_1e18, {from: accounts[99]} )

//   // Acct 7 withdraws 1800 CLV and deposits it to the SP
//   await cdpManager.withdrawCLV(_1800e18, accounts[7], {from: accounts[7]} )
//   await poolManager.provideToSP(_1800e18, {from: accounts[7]} )

//    //Account 100 opens CDP with 1 ether and withdraws 180 CLV
//    await addColl_allAccounts([accounts[100]], cdpManager, _1_Ether)
//    await cdpManager.withdrawCLV(_180e18, accounts[100], {from: accounts[100]} )

//   // Price drops too $100, accounts 99 and 100 ICR fall below MCR
//   await priceFeed.setPrice(_100e18)
//   price = await priceFeed.getPrice()

//   // Liquidate account 100. Account 100 is removed from system.  Generates SP gains for all SP depositors
//   await cdpManager.liquidate(accounts[100], { from: accounts[0]})
//   assert.isFalse(await sortedCDPs.contains(accounts[100]))

//   const tx = await cdpManager.liquidate(accounts[99], { from: accounts[0]})
//   assert.isFalse(await sortedCDPs.contains(accounts[99]))

//   console.log(`ICR acct 99 after liquidation is ${ await cdpManager.getCurrentICR(accounts[99], price)}`)

//   const gas = gasUsed(tx)
//   logGas(gas, message)

//   appendData({gas: gas}, message, data)
// })

// // Liquidate a CDP with SP gains (still closes), partial offset with SP

// it("", async () => {
//   const message = 'liquidate() 1 CDP, liquidated CDP has pending SP rewards, but gets liquidated anyway, offset + redistribution'
//   let price = await priceFeed.getPrice()
//   // 10 accts each open CDP with 10 ether
//   await addColl_allAccounts(accounts.slice(1,11), cdpManager, _10_Ether)
 
//   //Account 99 open CDP with 1 ether and withdraws 180 CLV
//   await addColl_allAccounts([accounts[99]], cdpManager, _1_Ether)
//   await cdpManager.withdrawCLV(_180e18, accounts[99], {from: accounts[99]} )
  
//   // Acct 99 deposits 1 CLV to SP
//   await poolManager.provideToSP(_1e18, {from: accounts[99]} )

//   // Acct 7 withdraws 1800 CLV and deposits it to the SP
//   await cdpManager.withdrawCLV(_1800e18, accounts[7], {from: accounts[7]} )
//   await poolManager.provideToSP(_1800e18, {from: accounts[7]} )

//    //Account 100 opens CDP with 1 ether and withdraws 180 CLV
//    await addColl_allAccounts([accounts[100]], cdpManager, _1_Ether)
//    await cdpManager.withdrawCLV(_180e18, accounts[100], {from: accounts[100]} )

//   // Price drops too $100, accounts 99 and 100 ICR fall below MCR
//   await priceFeed.setPrice(_100e18)
//   price = await priceFeed.getPrice()

//   // Liquidate account 100. Account 100 is removed from system. Generates SP gains for all SP depositors
//   await cdpManager.liquidate(accounts[100], { from: accounts[0]})
//   assert.isFalse(await sortedCDPs.contains(accounts[100]))

//   // Acct 7 withdraws 1500 CLV from SP, leaving ~121 CLV in the  SP)
//   await poolManager.withdrawFromSP(_1500e18, {from: accounts[7]} )

//   console.log(`Remaining CLV in SP is ${await poolManager.getStabilityPoolCLV()}`)

//   const tx = await cdpManager.liquidate(accounts[99], { from: accounts[0]})
//   assert.isFalse(await sortedCDPs.contains(accounts[99]))

//   const gas = gasUsed(tx)
//   logGas(gas, message)

//   appendData({gas: gas}, message, data)
// })


// // With pending dist. rewards and SP gains (still closes) - partial offset (Highest gas cost scenario in Normal Mode)
// it("", async () => {
//   const message = 'liquidate() 1 CDP, liquidated CDP has pending SP rewards and redistribution rewards, offset + redistribution.'
//   // 10 accts each open CDP with 10 ether
//   await addColl_allAccounts(accounts.slice(1,11), cdpManager, _10_Ether)
//   // await withdrawCLV_allAccounts(accounts.slice(1,11), cdpManager, _180e18)
 
//   //Account 99 and 98 each open CDP with 1 ether, and withdraw 180 CLV
//   await addColl_allAccounts([accounts[99]], cdpManager, _1_Ether)
//   await cdpManager.withdrawCLV(_180e18, accounts[99], {from: accounts[99]} )
//   await addColl_allAccounts([accounts[98]], cdpManager, _1_Ether)
//   await cdpManager.withdrawCLV(_180e18, accounts[98], {from: accounts[98]} )
  
//   // Acct 99 deposits 1 CLV to SP
//   await poolManager.provideToSP(_1e18, {from: accounts[99]} )

//    //Account 97 opens CDP with 1 ether and withdraws 180 CLV
//    await addColl_allAccounts([accounts[97]], cdpManager, _1_Ether)
//    await cdpManager.withdrawCLV(_180e18, accounts[97], {from: accounts[97]} )

//   // Price drops too $100, accounts 99 and 100 ICR fall below MCR
//   await priceFeed.setPrice(_100e18)
//   const price = await priceFeed.getPrice()

//   // Acct 7 adds 10 ether, withdraws 1800 CLV and deposits it to the SP
//   await addColl_allAccounts([accounts[7]], cdpManager, _10_Ether)
//   await cdpManager.withdrawCLV(_1800e18, accounts[7], {from: accounts[7]} )
//   await poolManager.provideToSP(_1800e18, {from: accounts[7]} )

//   /* Liquidate account 97. Account 97 is completely offset against SP and removed from system.

//   This creates SP gains for accounts 99 and 7. */
//   await cdpManager.liquidate(accounts[97], { from: accounts[0]})
//   assert.isFalse(await sortedCDPs.contains(accounts[97]))

//   // Acct 7 withdraws deposit and gains from SP
// //  await poolManager.withdrawFromSPtoCDP(accounts[7], {from: accounts[7]})

//  await poolManager.withdrawFromSP(_1800e18, {from: accounts[7]})

//   // Account 98 is liquidated, with nothing in SP pool.  This creates pending rewards from distribution.
//   await cdpManager.liquidate(accounts[98], { from: accounts[0]})

//   // Account 7 deposits 1 CLV in the Stability Pool
//   await poolManager.provideToSP(_1e18, {from: accounts[7]} )

//   const tx = await cdpManager.liquidate(accounts[99], { from: accounts[0]})
//   assert.isFalse(await sortedCDPs.contains(accounts[99]))

//   const gas = gasUsed(tx)
//   logGas(gas, message)

//   appendData({gas: gas}, message, data)
// })

// // pure offset
// it("", async () => {
//   const message = 'liquidate() 1 CDP Normal Mode, 30 active CDPs, no ETH gain in pool, pure offset with SP'
//   // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
//   await addColl_allAccounts(accounts.slice(2,32), cdpManager, _10_Ether)
//   await withdrawCLV_allAccounts(accounts.slice(2,32), cdpManager, _180e18)
 
//   await poolManager.provideToSP( _180e18, {from:accounts[2]})

//   //1 acct open CDP with 1 ether and withdraws 180 CLV
//   await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
//   await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
//   // Price drops, account[1]'s ICR falls below MCR
//   await priceFeed.setPrice(_100e18)

//   const tx = await cdpManager.liquidate(accounts[1], { from: accounts[0]})
//   const gas = gasUsed(tx)
//   logGas(gas, message)

//   appendData({gas: gas}, message, data)
// })

// // --- liquidateCDPs() -  pure redistributions ---

// 1 trove
it("", async () => {
  const message = 'liquidateCDPs(). n = 1. Pure redistribution'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,12), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,12), cdpManager, _180e18)

  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  const tx = await cdpManager.liquidateCDPs(1, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 2 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 2. Pure redistribution'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(3,13), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(3,13), cdpManager, _180e18)

  //2 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await addColl_allAccounts([accounts[2]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  await cdpManager.withdrawCLV(_180e18, accounts[2], {from: accounts[2]} )

  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 3 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 3. Pure redistribution'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(4,14), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(4,14), cdpManager, _180e18)

  //3 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(1,4), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,4), cdpManager, _180e18)
 
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 10 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 10. Pure redistribution'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(12,22), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(12,22), cdpManager, _180e18)

  //10 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(1,12), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,12), cdpManager, _180e18)
 
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  // // Initial liquidation to make reward terms / Pool quantities non-zero
  // await cdpManager.liquidate(accounts[11])

  const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 30 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 30. Pure redistribution'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(31,61), cdpManager, _100_Ether)
  await withdrawCLV_allAccounts(accounts.slice(31,61), cdpManager, _180e18)
 
  //30 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(1,31), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,31), cdpManager, _180e18)
 
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  // Check all accounts have CDPs
  for (account of (accounts.slice(1,31))) {
    assert.isTrue(await sortedCDPs.contains(account))
  }

  const tx = await cdpManager.liquidateCDPs(30, { from: accounts[0]})

  // Check all accounts have been closed
  for (account of (accounts.slice(1,31))) {
    assert.isFalse(await sortedCDPs.contains(account))
  }

  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 50 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 50. Pure redistribution'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(52,102), cdpManager, _100_Ether)
  await withdrawCLV_allAccounts(accounts.slice(52,102), cdpManager, _180e18)
 
  //30 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(1,52), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,52), cdpManager, _180e18)
 
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  // Initial liquidation to make reward terms / Pool quantities non-zero
  await cdpManager.liquidate(accounts[51])

  for (account of (accounts.slice(1,51))) {
    assert.isTrue(await sortedCDPs.contains(account))
  }
  const tx = await cdpManager.liquidateCDPs(50, { from: accounts[0]})

  for (account of (accounts.slice(1,51))) {
    assert.isFalse(await sortedCDPs.contains(account))
  }

  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 100 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 100. Pure redistribution'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(101,201), cdpManager, _100_Ether)
  await withdrawCLV_allAccounts(accounts.slice(101,201), cdpManager, _180e18)
 
  //30 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(1,101), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,101), cdpManager, _180e18)
 
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  // Check CDPs are active
  for (account of (accounts.slice(1,101))) {
    assert.isTrue(await sortedCDPs.contains(account))
  }

  const tx = await cdpManager.liquidateCDPs(100, { from: accounts[0]})

  // Check CDPs are now closed
  for (account of (accounts.slice(1,101))) {
    assert.isFalse(await sortedCDPs.contains(account))
  }
  
  const gas = gasUsed(tx)

  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// --- liquidate CDPs - all troves offset by Stability Pool - No pending distribution rewards ---

// 1 trove
it("", async () => {
  const message = 'liquidateCDPs(). n = 1. All fully offset with Stability Pool. No pending distribution rewards.'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(2,12), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(2,12), cdpManager, _180e18)

  // Whale opens loan and fills SP with 1 billion CLV
  await cdpManager.openLoan(moneyVals._1e27, accounts[999], {from:accounts[999], value: moneyVals._1billion_Ether })
  await poolManager.provideToSP( moneyVals._1e27, {from:accounts[999]})

  //1 acct open CDP with 1 ether and withdraws 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  const tx = await cdpManager.liquidateCDPs(1, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 2 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 2. All fully offset with Stability Pool. No pending distribution rewards.'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(3,13), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(3,13), cdpManager, _180e18)

  // Whale opens loan and fills SP with 1 billion CLV
  await cdpManager.openLoan(moneyVals._1e27, accounts[999], {from:accounts[999], value: moneyVals._1billion_Ether })
  await poolManager.provideToSP( moneyVals._1e27, {from:accounts[999]})

  //2 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await addColl_allAccounts([accounts[2]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  await cdpManager.withdrawCLV(_180e18, accounts[2], {from: accounts[2]} )

  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  const tx = await cdpManager.liquidateCDPs(2, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 3 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 3. All fully offset with Stability Pool. No pending distribution rewards.'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(4,14), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(4,14), cdpManager, _180e18)
  
  // Whale opens loan and fills SP with 1 billion CLV
  await cdpManager.openLoan(moneyVals._1e27, accounts[999], {from:accounts[999], value: moneyVals._1billion_Ether })
  await poolManager.provideToSP( moneyVals._1e27, {from:accounts[999]})

  //3 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(1,4), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,4), cdpManager, _180e18)
 
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  const tx = await cdpManager.liquidateCDPs(3, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 10 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 10. All fully offset with Stability Pool. No pending distribution rewards.'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(11,21), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(11,21), cdpManager, _180e18)

  // Whale opens loan and fills SP with 1 billion CLV
  await cdpManager.openLoan(moneyVals._1e27, accounts[999], {from:accounts[999], value: moneyVals._1billion_Ether })
  await poolManager.provideToSP( moneyVals._1e27, {from:accounts[999]})

  //10 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(1,11), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,11), cdpManager, _180e18)
 
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 30 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 30. All fully offset with Stability Pool. No pending distribution rewards.'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(31,61), cdpManager, _100_Ether)
  await withdrawCLV_allAccounts(accounts.slice(31,61), cdpManager, _180e18)
 
  // Whale opens loan and fills SP with 1 billion CLV
 await cdpManager.openLoan(moneyVals._1e27, accounts[999], {from:accounts[999], value: moneyVals._1billion_Ether })
 await poolManager.provideToSP( moneyVals._1e27, {from:accounts[999]})

  //50 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(1,31), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,31), cdpManager, _180e18)
 
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

   // Check CDPs are active
   for (account of (accounts.slice(1,31))) {
    assert.isTrue(await sortedCDPs.contains(account))
  }
  const tx = await cdpManager.liquidateCDPs(30, { from: accounts[0]})

   // Check CDPs are closed
   for (account of (accounts.slice(1,31))) {
    assert.isFalse(await sortedCDPs.contains(account))
  }

  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 50 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 50. All fully offset with Stability Pool. No pending distribution rewards.'

  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(51,101), cdpManager, _100_Ether)
  await withdrawCLV_allAccounts(accounts.slice(51,101), cdpManager, _180e18)
 
  // Whale opens loan and fills SP with 1 billion CLV
  await cdpManager.openLoan(moneyVals._1e27, accounts[999], {from:accounts[999], value: moneyVals._1billion_Ether })
  await poolManager.provideToSP( moneyVals._1e27, {from:accounts[999]})

  //50 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(1,51), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,51), cdpManager, _180e18)
 
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

   // Check CDPs are active
   for (account of (accounts.slice(1,51))) {
    assert.isTrue(await sortedCDPs.contains(account))
  }
  const tx = await cdpManager.liquidateCDPs(50, { from: accounts[0]})

   // Check CDPs are closed
   for (account of (accounts.slice(1,51))) {
    assert.isFalse(await sortedCDPs.contains(account))
  }
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 100 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 100. All fully offset with Stability Pool. No pending distribution rewards.'

  // 100 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(101,201), cdpManager, _100_Ether)
  await withdrawCLV_allAccounts(accounts.slice(101,201), cdpManager, _180e18)
 
 // Whale opens loan and fills SP with 1 billion CLV
 await cdpManager.openLoan(moneyVals._1e27, accounts[999], {from:accounts[999], value: moneyVals._1billion_Ether })
 await poolManager.provideToSP( moneyVals._1e27, {from:accounts[999]})

  //100 accts open CDP with 1 ether and withdraw 180 CLV
  await addColl_allAccounts(accounts.slice(1,101), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,101), cdpManager, _180e18)
 
  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

   // Check CDPs are active
   for (account of (accounts.slice(1,101))) {
    assert.isTrue(await sortedCDPs.contains(account))
  }
  const tx = await cdpManager.liquidateCDPs(100, { from: accounts[0]})

   // Check CDPs are active
   for (account of (accounts.slice(1,101))) {
    assert.isFalse(await sortedCDPs.contains(account))
  }

  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// --- liquidate CDPs - all troves offset by Stability Pool - Has pending distribution rewards ---

// 1 trove
it("", async () => {0
  const message = 'liquidateCDPs(). n = 1. All fully offset with Stability Pool. Has pending distribution rewards.'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(101,111), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(101,111), cdpManager, _180e18)

  // Account 500 opens with 1 ether and withdraws 180 CLV
  await cdpManager.openLoan(moneyVals._180e18, accounts[500], {from:accounts[500], value: moneyVals._1_Ether })

   // --- Accounts to be liquidated in the test tx ---
  await addColl_allAccounts([accounts[1]], cdpManager, _1_Ether)
  await cdpManager.withdrawCLV(_180e18, accounts[1], {from: accounts[1]} )
  
  // Account 500 is liquidated, creates pending distribution rewards for all
  await priceFeed.setPrice(_100e18)
  await cdpManager.liquidate(accounts[500],{ from: accounts[0]})
  await priceFeed.setPrice(_200e18)

  // Whale opens loan and fills SP with 1 billion CLV
  await cdpManager.openLoan(moneyVals._1e27, accounts[999], {from:accounts[999], value: moneyVals._1billion_Ether })
  await poolManager.provideToSP( moneyVals._1e27, {from:accounts[999]})

  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  const tx = await cdpManager.liquidateCDPs(1, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})
 // 2 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 2. All fully offset with Stability Pool. Have pending distribution rewards.'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(101,111), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(101,111), cdpManager, _180e18)

  // Account 500 opens with 1 ether and withdraws 180 CLV
  await cdpManager.openLoan(moneyVals._180e18, accounts[500], {from:accounts[500], value: moneyVals._1_Ether })

   // --- 2 Accounts to be liquidated in the test tx --
  await addColl_allAccounts(accounts.slice(1,3), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,3), cdpManager, _180e18)
  
  // Account 500 is liquidated, creates pending distribution rewards for all
  await priceFeed.setPrice(_100e18)
  await cdpManager.liquidate(accounts[500],{ from: accounts[0]})
  await priceFeed.setPrice(_200e18)

  // Whale opens loan and fills SP with 1 billion CLV
  await cdpManager.openLoan(moneyVals._1e27, accounts[999], {from:accounts[999], value: moneyVals._1billion_Ether })
  await poolManager.provideToSP( moneyVals._1e27, {from:accounts[999]})

  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  const tx = await cdpManager.liquidateCDPs(2, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 3 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 3. All fully offset with Stability Pool. Has pending distribution rewards.'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(101,111), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(101,111), cdpManager, _180e18)

  // Account 500 opens with 1 ether and withdraws 180 CLV
  await cdpManager.openLoan(moneyVals._180e18, accounts[500], {from:accounts[500], value: moneyVals._1_Ether })

   // --- 3 Accounts to be liquidated in the test tx --
  await addColl_allAccounts(accounts.slice(1,4), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,4), cdpManager, _180e18)
  
  // Account 500 is liquidated, creates pending distribution rewards for all
  await priceFeed.setPrice(_100e18)
  await cdpManager.liquidate(accounts[500],{ from: accounts[0]})
  await priceFeed.setPrice(_200e18)

  // Whale opens loan and fills SP with 1 billion CLV
  await cdpManager.openLoan(moneyVals._1e27, accounts[999], {from:accounts[999], value: moneyVals._1billion_Ether })
  await poolManager.provideToSP( moneyVals._1e27, {from:accounts[999]})

  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  const tx = await cdpManager.liquidateCDPs(3, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 10 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 10. All fully offset with Stability Pool. Has pending distribution rewards.'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(101,111), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(101,111), cdpManager, _180e18)

  // Account 500 opens with 1 ether and withdraws 180 CLV
  await cdpManager.openLoan(moneyVals._180e18, accounts[500], {from:accounts[500], value: moneyVals._1_Ether })

   // --- 10 Accounts to be liquidated in the test tx --
  await addColl_allAccounts(accounts.slice(1,11), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,11), cdpManager, _180e18)
  
  // Account 500 is liquidated, creates pending distribution rewards for all
  await priceFeed.setPrice(_100e18)
  await cdpManager.liquidate(accounts[500],{ from: accounts[0]})
  await priceFeed.setPrice(_200e18)

  // Whale opens loan and fills SP with 1 billion CLV
  await cdpManager.openLoan(moneyVals._1e27, accounts[999], {from:accounts[999], value: moneyVals._1billion_Ether })
  await poolManager.provideToSP( moneyVals._1e27, {from:accounts[999]})

  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  const tx = await cdpManager.liquidateCDPs(10, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 30 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 30. All fully offset with Stability Pool. Has pending distribution rewards.'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(101,111), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(101,111), cdpManager, _180e18)

  // Account 500 opens with 1 ether and withdraws 180 CLV
  await cdpManager.openLoan(moneyVals._180e18, accounts[500], {from:accounts[500], value: moneyVals._1_Ether })

   // --- 10 Accounts to be liquidated in the test tx --
  await addColl_allAccounts(accounts.slice(1,31), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,31), cdpManager, _180e18)
  
  // Account 500 is liquidated, creates pending distribution rewards for all
  await priceFeed.setPrice(_100e18)
  await cdpManager.liquidate(accounts[500],{ from: accounts[0]})
  await priceFeed.setPrice(_200e18)

  // Whale opens loan and fills SP with 1 billion CLV
  await cdpManager.openLoan(moneyVals._1e27, accounts[999], {from:accounts[999], value: moneyVals._1billion_Ether })
  await poolManager.provideToSP( moneyVals._1e27, {from:accounts[999]})

  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  const tx = await cdpManager.liquidateCDPs(30, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 50 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 50. All fully offset with Stability Pool. Has pending distribution rewards.'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(101,111), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(101,111), cdpManager, _180e18)

  // Account 500 opens with 1 ether and withdraws 180 CLV
  await cdpManager.openLoan(moneyVals._180e18, accounts[500], {from:accounts[500], value: moneyVals._1_Ether })

   // --- 10 Accounts to be liquidated in the test tx --
  await addColl_allAccounts(accounts.slice(1,51), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,51), cdpManager, _180e18)
  
  // Account 500 is liquidated, creates pending distribution rewards for all
  await priceFeed.setPrice(_100e18)
  await cdpManager.liquidate(accounts[500],{ from: accounts[0]})
  await priceFeed.setPrice(_200e18)

  // Whale opens loan and fills SP with 1 billion CLV
  await cdpManager.openLoan(moneyVals._1e27, accounts[999], {from:accounts[999], value: moneyVals._1billion_Ether })
  await poolManager.provideToSP( moneyVals._1e27, {from:accounts[999]})

  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  const tx = await cdpManager.liquidateCDPs(50, { from: accounts[0]})
  const gas = gasUsed(tx)
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// 100 troves
it("", async () => {
  const message = 'liquidateCDPs(). n = 100. All fully offset with Stability Pool. Has pending distribution rewards.'
  // 10 accts each open CDP with 10 ether, withdraw 180 CLV, and provide 180 CLV to Stability Pool
  await addColl_allAccounts(accounts.slice(101,111), cdpManager, _10_Ether)
  await withdrawCLV_allAccounts(accounts.slice(101,111), cdpManager, _180e18)

  // Account 500 opens with 1 ether and withdraws 180 CLV
  await cdpManager.openLoan(moneyVals._180e18, accounts[500], {from:accounts[500], value: moneyVals._1_Ether })

   // --- 10 Accounts to be liquidated in the test tx --
  await addColl_allAccounts(accounts.slice(1,101), cdpManager, _1_Ether)
  await withdrawCLV_allAccounts(accounts.slice(1,101), cdpManager, _180e18)
  
  // Account 500 is liquidated, creates pending distribution rewards for all
  await priceFeed.setPrice(_100e18)
  await cdpManager.liquidate(accounts[500],{ from: accounts[0]})
  await priceFeed.setPrice(_200e18)

  // Whale opens loan and fills SP with 1 billion CLV
  await cdpManager.openLoan(moneyVals._1e27, accounts[999], {from:accounts[999], value: moneyVals._1billion_Ether })
  await poolManager.provideToSP( moneyVals._1e27, {from:accounts[999]})

  // Price drops, account[1]'s ICR falls below MCR
  await priceFeed.setPrice(_100e18)

  const tx = await cdpManager.liquidateCDPs(100, { from: accounts[0]})
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
 
  const price = await priceFeed.getPrice()
  const tx = await functionCaller.sortedCDPs_findInsertPosition(CR, price, address_0, address_0)
  const gas = gasUsed(tx) - 21000
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
 
  const price = await priceFeed.getPrice()
  const tx = await functionCaller.sortedCDPs_findInsertPosition(CR, price, address_0, address_0)
  const gas = gasUsed(tx) - 21000
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
 
  const price = await priceFeed.getPrice()
  const tx = await functionCaller.sortedCDPs_findInsertPosition(CR, price, address_0, address_0)
  const gas = gasUsed(tx) - 21000
  logGas(gas, message)

  appendData({gas: gas}, message, data)
} )

it("", async () => {
  const message = 'findInsertPosition(), 20 CDPs with ICRs 200-219%, ICR <  tail ICR, no hint, 20 traversals'
 
  // makes 20 CDPs with ICRs 200 to 219%
  await makeCDPsIncreasingICR(_20_Accounts)

  // 200% ICR, lower than CDP at tail of list
  const CR = web3.utils.toWei('2', 'ether')
 
  const price = await priceFeed.getPrice()
  const tx = await functionCaller.sortedCDPs_findInsertPosition(CR, price, address_0, address_0)
  const gas = gasUsed(tx) - 21000
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})


  it("", async () => {
    const message = 'findInsertPosition(), 50 CDPs with ICRs 200-249%, ICR <  tail ICR, no hint, 50 traversals'
    
    // makes 50 CDPs with ICRs 200 to 249%
    await makeCDPsIncreasingICR(_50_Accounts)

    // 200% ICR, lower than CDP at tail of list
    const CR = web3.utils.toWei('2', 'ether')
  
    const price = await priceFeed.getPrice()
    const tx = await functionCaller.sortedCDPs_findInsertPosition(CR, price, address_0, address_0)
    const gas = gasUsed(tx) - 21000
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

// --- withdrawPenaltyFromSP ---

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
    await priceFeed.setPrice(_100e18);

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

  // --- DeciMath Functions - Embedded Library ---

  it("", async () => {
    const message = "DeciMath public decMul() with random args"
    const rand1 = randAmountInWei(1,200)
    const rand2 = randAmountInWei(1,200)
    const tx = await functionCaller.decimath_decMul(rand1, rand2)
    const gas = gasUsed(tx) - 21000
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = "DeciMath public decDiv() with random args"
    const rand1 = randAmountInWei(1,200)
    const rand2 = randAmountInWei(1,200)
    const tx = await functionCaller.decimath_decDiv(rand1, rand2)
    const gas = gasUsed(tx) - 21000
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  // it("", async () => {
  //   const message = "DeciMath public accurateMulDiv() with random args"
  //   const rand1 = randAmountInWei(1,200)
  //   const rand2 = randAmountInWei(1,200)
  //   const rand3 = randAmountInWei(1,200)
  //   const tx = await functionCaller.decimath_accurateMulDiv(rand1, rand2, rand3)
  //   const gas = gasUsed(tx) - 21000
  //   logGas(gas, message)

  //   appendData({gas: gas}, message, data)
  // })

  it("", async () => {
    const message = "DeciMath public div_toDuint() with random args"
    const rand1 = randAmountInWei(1,200)
    const rand2 = randAmountInWei(1,200)
    const tx = await functionCaller.decimath_div_toDuint(rand1, rand2)
    const gas = gasUsed(tx) - 21000
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

  it("", async () => {
    const message = "DeciMath public mul_uintByDuint() with random args"
    const rand1 = randAmountInWei(1,200)
    const rand2 = randAmountInWei(1,200)
    const tx = await functionCaller.decimath_mul_uintByDuint(rand1, rand2)
    const gas = gasUsed(tx) - 21000
    logGas(gas, message)

    appendData({gas: gas}, message, data)
  })

// --- ABDKMath64x64 functions - embedded library ---

it("", async () => {
  const message = "ABDKMath mul() with random args"
  const rand1 = randAmountInWei(1,200)
  const rand2 = randAmountInWei(1,200)
  const tx = await functionCaller.abdkMath_mul(rand1, rand2)
  const gas = gasUsed(tx) - 21000
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = "ABDKMath div() with random args"
  const rand1 = randAmountInWei(1,200)
  const rand2 = randAmountInWei(1,200)
  const tx = await functionCaller.abdkMath_div(rand1, rand2)
  const gas = gasUsed(tx) - 21000
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = "ABDKMath mulu() with random args"
  const rand1 = randAmountInWei(1,200)
  const rand2 = randAmountInWei(1,200)
  const tx = await functionCaller.abdkMath_mulu(rand1, rand2)
  const gas = gasUsed(tx) - 21000
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = "ABDKMath divu() with random args"
  const rand1 = randAmountInWei(1,200)
  const rand2 = randAmountInWei(1,200)
  const tx = await functionCaller.abdkMath_divu(rand1, rand2)
  const gas = gasUsed(tx) - 21000
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = "ABDKMath fromUInt() with random args"
  const rand = randAmountInGwei(1,200)
  console.log("rand is" + rand)
  // ABDK max arg is ( 2**64 - 1 ), i.e. 9223372036854775807 . 
  const tx = await functionCaller.abdkMath_fromUInt(rand)
  const gas = gasUsed(tx) - 21000
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

it("", async () => {
  const message = "ABDKMath toUInt() with random args"
  const rand = randAmountInGwei(1,200)
  console.log("rand is" + rand)
  
  const tx = await functionCaller.abdkMath_toUInt(rand)
  const gas = gasUsed(tx) - 21000
  logGas(gas, message)

  appendData({gas: gas}, message, data)
})

// TODO abdkMath_divuu (returns uint128)


// --- Write test output data to CSV file

it("Export test data", async () => {
  fs.writeFile('test/gas/gasTestData.csv', data, (err) => { 
    if (err) console.log(err)
  console.log("Gas test data written to /gasTestData.csv") })
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