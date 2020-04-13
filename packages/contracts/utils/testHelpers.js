require('web3')

class MoneyValues {
  static _300_Finney = web3.utils.toWei('300', 'finney')
  static _400_Finney = web3.utils.toWei('400', 'finney')
  static _500_Finney = web3.utils.toWei('500', 'finney')
  static _1_Ether = web3.utils.toWei('1', 'ether')

  static _2_Ether = web3.utils.toWei('2', 'ether')
  static _3_Ether = web3.utils.toWei('2', 'ether')
  static _4_Ether = web3.utils.toWei('2', 'ether')
  static _5_Ether = web3.utils.toWei('5', 'ether')
  static _10_Ether = web3.utils.toWei('10', 'ether')
  static _15_Ether = web3.utils.toWei('15', 'ether')
  static _20_Ether = web3.utils.toWei('20', 'ether')
  static _98_Ether = web3.utils.toWei('98', 'ether')
  static _100_Ether = web3.utils.toWei('100', 'ether')
  static _200_Ether = web3.utils.toWei('200', 'ether')
  static _1000_Ether = web3.utils.toWei('1000', 'ether')
  static _10000_Ether = web3.utils.toWei('10000', 'ether')
  static _1million_Ether = web3.utils.toWei('1000000', 'ether')
  static _10million_Ether = web3.utils.toWei('10000000', 'ether')
  static _100million_Ether = web3.utils.toWei('100000000', 'ether')
  static _1billion_Ether = web3.utils.toWei('1000000000', 'ether')
  static _10billion_Ether = web3.utils.toWei('10000000000', 'ether')
  
  static _1e18 = web3.utils.toWei('1', 'ether')
  static _5e18 = web3.utils.toWei('5', 'ether')
  static _10e18 = web3.utils.toWei('10', 'ether')
  static _13e18 = web3.utils.toWei('13', 'ether')
  static _30e18 = web3.utils.toWei('30', 'ether')
  static _40e18 = web3.utils.toWei('40', 'ether')
  static _50e18 = web3.utils.toWei('50', 'ether')
  static _55e18 = web3.utils.toWei('55', 'ether')
  static _80e18 =  web3.utils.toWei('80', 'ether')
  static _90e18 =  web3.utils.toWei('90', 'ether')
  static _100e18 = web3.utils.toWei('100', 'ether')
  static _101e18 = web3.utils.toWei('101', 'ether')
  static _150e18 = web3.utils.toWei('150', 'ether')
  static _180e18 = web3.utils.toWei('180', 'ether')
  static _200e18 = web3.utils.toWei('180', 'ether')
  static _300e18 = web3.utils.toWei('300', 'ether')
  static _360e18 = web3.utils.toWei('360', 'ether')
  static _450e18 = web3.utils.toWei('450', 'ether')
  static _500e18 = web3.utils.toWei('500', 'ether')
  static _900e18 = web3.utils.toWei('900', 'ether')
  static _1000e18 = web3.utils.toWei('1000', 'ether')
  static _1500e18 = web3.utils.toWei('1500', 'ether')
  static _1700e18 = web3.utils.toWei('1700', 'ether')
  static _1800e18 = web3.utils.toWei('1800', 'ether')
  static _2000e18 = web3.utils.toWei('2000', 'ether')
}

// TODO: Make classes for function export

const getDifference = (_BN, numberString) => {
  return Number(_BN.sub(web3.utils.toBN(numberString)).abs())
}

const getGasMetrics = (gasCostList) => {
  minGas = Math.min(...gasCostList) 
  maxGas = Math.max(...gasCostList)
  meanGas = gasCostList.reduce((acc, curr) => acc + curr, 0) / gasCostList.length
  // median is the middle element (for odd list size) or element adjacent-right of middle (for even list size)
  medianGas = (gasCostList[Math.floor(gasCostList.length / 2)]) 
  return {gasCostList, minGas, maxGas, meanGas, medianGas}
}

const gasUsed = (tx) => {
  const gas = tx.receipt.gasUsed
  return gas
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

const makeWei = (num) => {
  web3.utils.toWei(num.toString(), 'ether')
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

const openLoan_allAccounts_randomETH = async(minETH, maxETH, accounts, cdpManager, CLVAmount) => {
  const gasCostList = []
  for (const account of accounts) {
    const randCollAmount = randAmountInWei(minETH, maxETH)
    const tx = await cdpManager.openLoan(CLVAmount, account, { from: account, value: randCollAmount })
    const gas = gasUsed(tx)
    gasCostList.push(gas)
  }
 return getGasMetrics(gasCostList)
}

const openLoan_allAccounts_randomETH_ProportionalCLV = async(minETH, maxETH, accounts, cdpManager, proportion) => {
  const gasCostList = []
  for (const account of accounts) {
    const randCollAmount = randAmountInWei(minETH, maxETH)
    const proportionalCLV = (web3.utils.toBN(proportion)).mul(web3.utils.toBN(randCollAmount))
    const tx = await cdpManager.openLoan(proportionalCLV, account, { from: account, value: randCollAmount })
    const gas = gasUsed(tx)
    gasCostList.push(gas)
  }
 return getGasMetrics(gasCostList)
}

const openLoan_allAccounts_randomCLV = async(minCLV, maxCLV, accounts, cdpManager, ETHAmount) => {
  const gasCostList = []
  for (const account of accounts) {
    const randCLVAmount = randAmountInWei(minCLV, maxCLV)
    const tx = await cdpManager.openLoan(randCLVAmount, account, { from: account, value: ETHAmount })
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
  const tx = await cdpManager.redeemCollateral(CLVAmount, redeemer, { from: redeemer })
  const gas = await gasUsed(tx)
  return gas
}

const redeemCollateral_allAccounts_randomAmount = async (min, max, accounts, cdpManager) => {
  const gasCostList = []
  for (const account of accounts) {
    const randCLVAmount = randAmountInWei(min, max)
    // console.log("redeem starts here")
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

// TODO:  Group functions into classes for export
module.exports = {
  randAmountInWei: randAmountInWei,
  randAmountInGwei: randAmountInGwei,
  MoneyValues: MoneyValues,
  getGasMetrics: getGasMetrics,
  gasUsed: gasUsed,
  makeWei: makeWei,
  getDifference: getDifference,
  openLoan_allAccounts: openLoan_allAccounts,
  openLoan_allAccounts_randomETH: openLoan_allAccounts_randomETH,
  openLoan_allAccounts_randomCLV: openLoan_allAccounts_randomCLV,
  openLoan_allAccounts_randomETH_ProportionalCLV: openLoan_allAccounts_randomETH_ProportionalCLV,
  closeLoan_allAccounts: closeLoan_allAccounts,
  openLoan_allAccounts_decreasingCLVAmounts: openLoan_allAccounts_decreasingCLVAmounts,
  addColl_allAccounts: addColl_allAccounts,
  addColl_allAccounts_randomAmount: addColl_allAccounts_randomAmount,
  withdrawColl_allAccounts: withdrawColl_allAccounts,
  withdrawColl_allAccounts_randomAmount: withdrawColl_allAccounts_randomAmount,
  withdrawCLV_allAccounts: withdrawCLV_allAccounts,
  withdrawCLV_allAccounts_randomAmount: withdrawCLV_allAccounts_randomAmount,
  repayCLV_allAccounts: repayCLV_allAccounts,
  repayCLV_allAccounts_randomAmount: repayCLV_allAccounts_randomAmount,
  getCurrentICR_allAccounts: getCurrentICR_allAccounts,
  redeemCollateral: redeemCollateral,
  redeemCollateral_allAccounts_randomAmount: redeemCollateral_allAccounts_randomAmount,
  makeCDPsIncreasingICR: makeCDPsIncreasingICR,
  provideToSP_allAccounts: provideToSP_allAccounts,
  provideToSP_allAccounts_randomAmount: provideToSP_allAccounts_randomAmount,
  withdrawFromSP_allAccounts: withdrawFromSP_allAccounts,
  withdrawFromSP_allAccounts_randomAmount: withdrawFromSP_allAccounts_randomAmount,
  withdrawFromSPtoCDP_allAccounts: withdrawFromSPtoCDP_allAccounts
}