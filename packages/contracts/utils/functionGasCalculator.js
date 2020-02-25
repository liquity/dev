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

const deploymentHelpers = require("../utils/deploymentHelpers.js")
const getAddresses = deploymentHelpers.getAddresses
const setNameRegistry = deploymentHelpers.setNameRegistry
const connectContracts = deploymentHelpers.connectContracts
const getAddressesFromNameRegistry = deploymentHelpers.getAddressesFromNameRegistry

  const [owner, alice, bob, carol, dennis, whale] = accounts;
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


  const deciMath = await DeciMath.new()
  DeciMath.setAsDeployed(deciMath)
  CDPManager.link(deciMath)
  PoolManager.link(deciMath)
  FunctionCaller.link(deciMath)

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

const _2_Ether = web3.utils.toWei('2', 'ether')
const _1_Ether = web3.utils.toWei('1', 'ether')
const _5_Ether = web3.utils.toWei('5', 'ether')
const _10_Ether = web3.utils.toWei('10', 'ether')
const _15_Ether = web3.utils.toWei('15', 'ether')
const _98_Ether = web3.utils.toWei('98', 'ether')
const _100_Ether = web3.utils.toWei('100', 'ether')
const _1e9_wei = '1000000000'
const _10e9_wei = '10000000000'
const _20e9_wei = '20000000000'
const _30e9_wei = '30000000000'
const _180e9_wei = '180000000000'
const _90e9_wei = '90000000000'

const _180e18 = '180000000000000000000'

module.exports = async () => {
  const gasUsed = (tx) => {
    const gas = tx.receipt.gasUsed
    return gas
  }

  const getAccounts = async (callback) => {
    const accounts = await web3.eth.getAccounts()
    return accounts
  }

  // const getDeployedContracts = async () => {
  //   priceFeed = await PriceFeed.deployed()
  //   clvToken = await CLVToken.deployed()
  //   poolManager = await PoolManager.deployed()
  //   sortedCDPs = await SortedCDPs.deployed()
  //   cdpManager = await CDPManager.deployed()
  //   nameRegistry = await NameRegistry.deployed()
  //   activePool = await ActivePool.deployed()
  //   stabilityPool = await StabilityPool.deployed()
  //   defaultPool = await DefaultPool.deployed()

  //   return {
  //     priceFeed,
  //     clvToken,
  //     poolManager,
  //     sortedCDPs,
  //     cdpManager,
  //     nameRegistry,
  //     activePool,
  //     stabilityPool,
  //     defaultPool
  //   }
  // }

  // const functionCaller = await FunctionCaller.deployed()
  // // console.log(functionCaller)
  // console.log(cdpManager.address)
  // await functionCaller.setCDPManagerAddress(cdpManager.address)

 
  // --- Helper functions --- 
  const getEndOfAccount = (account) => {
    accountLast2bytes = account.slice((account.length - 4), account.length)
    return accountLast2bytes
  }
  const getRandomCLVAmount = () => {
    const max = 180*1e9
    return Math.floor(Math.random() * Math.floor(max));
    // return max
  }

  const getRandomCollAmount = () => {
    const max = 1e9
    return Math.floor(Math.random() * Math.floor(max));
    // return max
  }

  const getNewICR = async (address, CLVWithdrawal) => {
    const CDP = await getCDP(address)
    const coll = CDP[1]
    const debt = CDP[0]
    const newDebt = String(Number(debt) + Number(CLVWithdrawal))
    const ICR = (coll *200)/newDebt
    return ICR
  }

  /* Quick-and-dirty conversion from 15 DP JS Number to duint. Not 100% precise.
  Example:
  4.839999527515858  --> 4.839999527515858000 */
  const convertToDuint = (num) => {
      let strNum = num.toString()
    
      const intPart = strNum.split(".")[0]
      const fractionPart = strNum.split(".")[1]
      const duintNum = intPart + fractionPart + '000'
      
      return duintNum
    }

  const getCDP = async (address) => {
    const CDP = await cdpManager.CDPs(address)
    return CDP
  }

  const logListSizeBefore = async(cdpManager) => {
    const size_before = (await cdpManager.sortedCDPsgetSize()).toNumber()
    console.log("active CDPs list size before: "+ size_before)
  }

  const logListSizeAfter = async(cdpManager) => {
    const size_after = (await cdpManager.sortedCDPsgetSize()).toNumber()
    console.log("active CDPs list size after: "+ size_after)
  }

  const getListSize = async (cdpManager) => {
    const listSize = (await cdpManager.sortedCDPsgetSize()).toNumber()
    return listSize
  }

  // --- CDPManager gas functions ---

  const allAccountsAddColl = async (accounts, cdpManager, amount) => {
    console.log("CDP Creations")
    accounts.forEach(async (account) => {
      const tx = await cdpManager.addColl(account, { from: account, value: amount })
      const gas = await gasUsed(tx)

      const endOfAccount = getEndOfAccount(account)
      console.log("gas used in a single addColl() call:" + gas + ", account ending: "+ endOfAccount)
    })
  }
  const withdraw180NanoCLVFromAll = async (accounts, cdpManager) => {
    console.log("CDP withdrawals - 180 nanoCLV from all")
    accounts.forEach(async (account) => {
    const tx = await cdpManager.withdrawCLV(_180e9_wei, {from: account})
    const gas = await gasUsed(tx)
    console.log("gas used in single withdrawal of 180 nanoCLV:" + gas)
    })
  }

  const withdrawRandomCLVAmount = async (accounts, cdpManager) => {
    console.log("CDP withdrawals - random amounts")
    accounts.forEach(async (account) => {
      
      const randCLVAmount = getRandomCLVAmount()
      const newICR = await getNewICR(account, randCLVAmount)
      const newICRduint = convertToDuint(newICR)

      // const hintAddress = await cdpManager.getApproxHint(newICRduint, 10)
      // console.log(hintAddress)
    
      const tx = await cdpManager.withdrawCLV(randCLVAmount, {from: account})
      const gas = await gasUsed(tx)
      console.log("gas used in single withdrawal of a random CLV amount:" + gas)
    })
  }

  const withdrawAndRepayCLVAmount = async (accounts, cdpManager, amount) => {
    console.log("CDP withdrawals and repay " + amount + " nanoCLV from all")
    accounts.forEach(async (account) => {
    await cdpManager.withdrawCLV(amount, {from: account})
    const tx = await cdpManager.repayCLV(amount, {from: account})
    const gas = await gasUsed(tx)
    const endOfAccount = getEndOfAccount(account)
    console.log("gas used in repayment of " + amount + " CLV: " + gas + ", account ending: " + endOfAccount)
    })
  }

  const withdrawRandomCollAmount = async (accounts, cdpManager) => {
    accounts.forEach(async (account) => {
      const randCollAmount = getRandomCollAmount()
      const tx = await cdpManager.withdrawColl(randCollAmount, {from: account})
      const gas =  await gasUsed(tx)
      console.log("gas used in single withdrawal of a random Coll amount:" + gas)
    })
  }

  // single user redeems CLV for ETH
  const redeemCollateral = async(redeemer, cdpManager, CLVAmount) => {
    // Redeemer adds 1 ether and withdraws 180CLV, leaving him with more CLV than the CLVdebt
    // of all other CDPs
    await cdpManager.addColl(redeemer, {from: redeemer, value: _1_Ether})
    await cdpManager.withdrawCLV(_180e18, {from: redeemer})

    const tx = await cdpManager.redeemCollateral(CLVAmount, {from: redeemer})
    const gas =  await gasUsed(tx)
    console.log("gas used in redemption:" + gas)
  }

  const allAccountsWithdrawCLV = async (accounts, cdpManager, amount) => {
    accounts.forEach(async(account)=> {
      await cdpManager.withdrawCLV(amount, {from: account})
      const endOfAccount = getEndOfAccount(account)
      console.log(`account ${endOfAccount} withdrew ${amount}`)
    })
  }
  
  const callLiquidateIndividually = async (accounts, cdpManager) => {
    logListSizeBefore(cdpManager)
    accounts.forEach( async(account) => {
    const tx = await cdpManager.liquidate(account, {from: accounts[0]})
    const listSize = await getListSize(cdpManager)
    const gas = await gasUsed(tx)
    console.log("gas used in a single CDP Liquidation:" + gas + ". CDP List size is now " + listSize)
    })
    logListSizeAfter(cdpManager)
  }

  const liquidate = async(account, cdpManager) => {
    const tx = await cdpManager.liquidate(account, {from: accounts[0]})
    const listSize = await getListSize(cdpManager)
    const gas = await gasUsed(tx)
    console.log("gas used in a single CDP Liquidation:" + gas + ". CDP List size is now " + listSize)
  }

  const callLiquidateCDPs = async (accounts, cdpManager) => {
    const numAccounts = accounts.length
    // get number of CDPs in list
    logListSizeBefore(cdpManager)
    const tx = await cdpManager.liquidateCDPs(numAccounts)
    logListSizeAfter(cdpManager)
    const gas = await gasUsed(tx)
    // get number of CDPs in list
    console.log("gas used in batch CDP Liquidations:" + gas)
  }

  const callGetCurrentICROnAll = async (accounts, functionCaller) => {
    accounts.forEach (async(account) => {
      const tx = await functionCaller.cdpManager_getCurrentICR(account)
      const gas = await gasUsed(tx)
      console.log("gas used in a single getCurrentICR() call:" + gas)
    })
  }

  // const multipleGetApproxHint = async (n) => {
  //   const bestHint = ""
  //   for (i = 0; i < n, i++) {
  //     const newHint = await cdpManager.getApproxHint()
  //   }
  // })

  // --- PoolManager gas functions ---

  const provideToSP = async(account, poolManager, amount) =>{
    tx = await poolManager.provideToSP(amount, {from: account})
    const gas = await gasUsed(tx)
    console.log("gas used in provideToSP: " + gas)
  }

  const withdrawFromSP = async(account, poolManager, amount) =>{
    tx = await poolManager.withdrawFromSP(amount, {from: account})
    const gas = await gasUsed(tx)
    console.log("gas used in withDrawFromSP: " + gas)
  }

  const withdrawFromSPtoCDP = async(account, poolManager) =>{
    tx = await poolManager.withdrawFromSPtoCDP(account)
    const gas = await gasUsed(tx)
    console.log("gas used in withDrawFromSPtoCDP: " + gas)
  }


  // --- Execute script ---
  try {
    const contracts = await getDeployedContracts()
    // const functionCaller = await FunctionCaller.deployed()
    // console.log(functionCaller)
    // console.log(contracts.cdpManager.address)
    // await functionCaller.setCDPManagerAddress(cdpManager.address)

    const accounts = (await web3.eth.getAccounts()).slice(0,10)
    console.log("num of accounts is:"+ accounts.length)

  // --- PoolManager function calls ---

  // provideToSP()
  // await allAccountsAddColl(accounts, cdpManager, _1e9_wei)
  // await allAccountsWithdrawCLV(accounts, cdpManager, _180e9_wei)
  // // first funds provided
  // await provideToSP(accounts[0], poolManager, _10e9_wei)
  // // subsequent funds provided
  // await provideToSP(accounts[0], poolManager, _20e9_wei)
  // await provideToSP(accounts[0], poolManager, _30e9_wei)


    // withdrawFromSP() - has no pending rewards
    // await allAccountsAddColl(accounts, cdpManager, _1e9_wei)
    // await allAccountsWithdrawCLV(accounts, cdpManager, _180e9_wei)
    // await provideToSP(accounts[0], poolManager, _180e9_wei)
    // await withdrawFromSP(accounts[0], poolManager, _90e9_wei)

   // withdrawFromSP() - has pending rewards
  await allAccountsAddColl(accounts, cdpManager, _1e9_wei)
  await allAccountsWithdrawCLV(accounts, cdpManager, _180e9_wei)
  await provideToSP(accounts[0], poolManager, _180e9_wei)

  // price drop & liquidation of a different CDP
  await priceFeed.setPrice('1')
  console.log("price change")

  await cdpManager.liquidate(accounts[1])
  await withdrawFromSP(accounts[0], poolManager, _90e9_wei)

   // withdrawFromSPtoCDP() - has no pending rewards
  //  await allAccountsAddColl(accounts, cdpManager, _1e9_wei)
  //  await allAccountsWithdrawCLV(accounts, cdpManager, _180e9_wei)
  //  await provideToSP(accounts[0], poolManager, _180e9_wei)
  //  await withdrawFromSPtoCDP(accounts[0], poolManager)

  // withdrawFromSPtoCDP() - deposit has pending rewards
  // await allAccountsAddColl(accounts, cdpManager, _1e9_wei)
  // await allAccountsWithdrawCLV(accounts, cdpManager, _180e9_wei)

  // await provideToSP(accounts[0], poolManager, _180e9_wei)
  
  // // price drop & liquidation of a different CDP
  // await priceFeed.setPrice('1')
  // console.log("price change")
  // await cdpManager.liquidate(accounts[1])

  // await withdrawFromSPtoCDP(accounts[0], poolManager)

  // --- CDP Manager function calls ---

  //  await allAccountsAddColl(accounts, cdpManager, _1e9_wei)

  //   // await withdrawRandomCLVAmount(accounts, cdpManager)
  //   // await withdraw180NanoCLVFromAll(accounts, cdpManager)

  //   // await withdrawRandomCollAmount(accounts, cdpManager)

  //   // await withdrawAndRepayCLVAmount(accounts, cdpManager, _180e9_wei)

  //   // simple redemption:  redeemed CLV is less than the CLVDebt of the lowest ICR CDP
  //   await allAccountsWithdrawCLV(accounts, cdpManager, _180e9_wei)
  //   await redeemCollateral(accounts[9], cdpManager, _90e9_wei)

  //   // complex redemption:  redeemed CLV is bigger than the CLV debt of all CDPs
  //   console.log("complex redemption")
  //   await allAccountsWithdrawCLV(accounts, cdpManager, _180e9_wei)
  //   await redeemCollateral(accounts[9], cdpManager, '1000000000')

    // drop price and liquidate CDPs
    // await priceFeed.setPrice('1')
    // console.log("price change")

    // await callLiquidateIndividually(accounts, cdpManager)
    // await callLiquidateCDPs(accounts, cdpManager)
    
    // await callGetCurrentICROnAll(accounts, functionCaller)
    

  } catch (err) {
    console.log(err)
  }

  // --- RESULTS ---

  //--- PoolManager gas costs ---

  //provideToSP: 210153
  // withdrawFromSP, no pending rewards: 185k
  // withdrawFromSP, with pending rewards: 115k (? Why lower?)
  // withdrawFromSPtoCDP, no pending rewards: 375k
  // withdrawFromSPtoCDP, with pending rewards: 406k


  // ---  CDPManager Gas costs, no stability pool: ---

  // addcoll, newCDP: 330k
  // addColl, existing CDP: 220k
  // withdrawColl, random amount: 222k

  // withdrawCLV: 180k-450k (without good hint, 10 CDPs in list)
  // repayCLV: 122k

  // redeemCollateral, simple case:  redeemedCLV < CLVDebt in lowest ICR CDP:
  // 313k
  // redeemCollateral, complex case: redeemedCLV > total CLVDebt in other 9 CDPs:
  // 576k

  // --- Liquidation funcs - no stability pool ---
  // liquidateCDP: 253k for most (but 190k  for 1, and 290k for 1? )
  // --- 1 CDP in list: 155k
  // --- 2 CDPs in list: 155k, 290k
  // --- 3 CDPs in list:  

  // liquidateCDPs() - empty StabilityPool: 
  // 1 CDP:   172k
  // --- // 2 CDPs: 436k
  // --- // 3 CDPs: 686k
  // --- // 4 CDPs: 936k
  // --- // 5 CDPs: 1.18mil
  // --- // 6 CDPs: 1.43mil
  // --- // 10 CDPs: 2.4mil


  // getCurrentICR: 15k
}


