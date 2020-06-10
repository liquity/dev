const web3 = require('web3')

const MoneyValues = {
  _1_Ether: web3.utils.toWei('1', 'ether'),
  _2_Ether: web3.utils.toWei('2', 'ether'),
  _3_Ether: web3.utils.toWei('3', 'ether'),
  _4_Ether: web3.utils.toWei('4', 'ether'),
  _5_Ether: web3.utils.toWei('5', 'ether'),
  _6_Ether: web3.utils.toWei('6', 'ether'),
  _10_Ether: web3.utils.toWei('10', 'ether'),
  _15_Ether: web3.utils.toWei('15', 'ether'),
  _20_Ether: web3.utils.toWei('20', 'ether'),
  _22_Ether: web3.utils.toWei('22', 'ether'),
  _50_Ether: web3.utils.toWei('50', 'ether'),
  _98_Ether: web3.utils.toWei('98', 'ether'),
  _100_Ether: web3.utils.toWei('100', 'ether'),
  _200_Ether: web3.utils.toWei('200', 'ether'),
  _1000_Ether: web3.utils.toWei('1000', 'ether'),
  _10000_Ether: web3.utils.toWei('10000', 'ether'),
  _1million_Ether: web3.utils.toWei('1000000', 'ether'),
  _10million_Ether: web3.utils.toWei('10000000', 'ether'),
  _100million_Ether: web3.utils.toWei('100000000', 'ether'),
  _500million_Ether: web3.utils.toWei('500000000', 'ether'),
  _1billion_Ether: web3.utils.toWei('1000000000', 'ether'),
  _10billion_Ether: web3.utils.toWei('10000000000', 'ether'),
  _100billion_Ether: web3.utils.toWei('100000000000', 'ether'),
  _500billion_Ether: web3.utils.toWei('500000000000', 'ether'),
  
  _0pt5_Ether:  web3.utils.toWei('500', 'finney'),
  _1pt5_Ether:  web3.utils.toWei('1500', 'finney'),

  _1e17:  web3.utils.toWei('100', 'finney'),
  _5e17:  web3.utils.toWei('500', 'finney'),

  _1e18: web3.utils.toWei('1', 'ether'),
  _5e18: web3.utils.toWei('5', 'ether'),
  _10e18: web3.utils.toWei('10', 'ether'),
  _13e18: web3.utils.toWei('13', 'ether'),
  _20e18: web3.utils.toWei('20', 'ether'),
  _30e18: web3.utils.toWei('30', 'ether'),
  _50e18: web3.utils.toWei('50', 'ether'),
  _80e18: web3.utils.toWei('80', 'ether'),
  _90e18: web3.utils.toWei('90', 'ether'),
  _100e18: web3.utils.toWei('100', 'ether'),
  _101e18: web3.utils.toWei('101', 'ether'),
  _110e18: web3.utils.toWei('110', 'ether'),
  _125e18: web3.utils.toWei('125', 'ether'),
  _150e18: web3.utils.toWei('150', 'ether'),
  _180e18: web3.utils.toWei('180', 'ether'),
  _200e18: web3.utils.toWei('200', 'ether'),
  _250e18: web3.utils.toWei('250', 'ether'),
  _300e18: web3.utils.toWei('300', 'ether'),
  _360e18: web3.utils.toWei('360', 'ether'),
  _400e18: web3.utils.toWei('400', 'ether'),
  _450e18: web3.utils.toWei('450', 'ether'),
  _500e18: web3.utils.toWei('500', 'ether'),
  _600e18: web3.utils.toWei('600', 'ether'),
  _900e18: web3.utils.toWei('900', 'ether'),
  _1000e18: web3.utils.toWei('1000', 'ether'),
  _1500e18: web3.utils.toWei('1500', 'ether'),
  _1700e18: web3.utils.toWei('1700', 'ether'),
  _1800e18: web3.utils.toWei('1800', 'ether'),
  _2000e18: web3.utils.toWei('2000', 'ether'),
  _5000e18: web3.utils.toWei('5000', 'ether'),
  _1e22: web3.utils.toWei('10000', 'ether'),
  _1e24: web3.utils.toWei('1000000', 'ether'),
  _2e24: web3.utils.toWei('2000000', 'ether'),
  _1e27: web3.utils.toWei('1000000000', 'ether'),
  _2e27: web3.utils.toWei('2000000000', 'ether'),
  _5e35: web3.utils.toWei('500000000000000000', 'ether'),
  _1e36: web3.utils.toWei('1000000000000000000', 'ether'),

  _1e27: web3.utils.toWei('1000000000', 'ether'),
  _1e36: web3.utils.toWei('1000000000000000000', 'ether'),

  negative_5e17:  "-" + web3.utils.toWei('500', 'finney'),
  negative_10e18:  "-" + web3.utils.toWei('10', 'ether'),
  negative_50e18:  "-" + web3.utils.toWei('50', 'ether'),
  negative_100e18:  "-" + web3.utils.toWei('100', 'ether'),

  _1e18BN: web3.utils.toBN('1000000000000000000'),
  _100BN: web3.utils.toBN('100')

}

// TODO: Make classes for function export

class TestHelper {

  static squeezeAddr(address) {
    const len = address.length
    return address.slice(0,6).concat("...").concat(address.slice(len-5, len-1))
  }
  static getDifference(x, y){
    const x_BN = web3.utils.toBN(x)
    const y_BN = web3.utils.toBN(y)

    return Number(x_BN.sub(y_BN).abs())
  }

static getGasMetrics(gasCostList) {
  const minGas = Math.min(...gasCostList) 
  const maxGas = Math.max(...gasCostList)

  let sum = 0;
  let meanGas;
  for (const gas of gasCostList) {
    sum += gas
  }
  meanGas = sum / gasCostList.Length

  // median is the middle element (for odd list size) or element adjacent-right of middle (for even list size)
  const medianGas = (gasCostList[Math.floor(gasCostList.length / 2)]) 
  return {gasCostList, minGas, maxGas, meanGas, medianGas}
}

static getEndOfAccount(account) {
  const accountLast2bytes = account.slice((account.length - 4), account.length)
  return accountLast2bytes
}

static randAmountInWei (min, max) {
  const amount = Math.random() * (max - min) + min;
  const amountInWei = web3.utils.toWei(amount.toString(), 'ether')
  return amountInWei
}

static randAmountInGWei(min, max) {
  const amount = Math.floor(Math.random() * (max - min) + min);
  const amountInWei = web3.utils.toWei(amount.toString(), 'gwei')
  return amountInWei
}

static makeWei(num){
  return web3.utils.toWei(num.toString(), 'ether')
}

static appendData(results, message, data) {
  data.push(message + `\n`)
  for (const key in results) {
    data.push(key + "," + results[key] + '\n')
  }
}

static getRandICR(min, max) {
  const ICR_Percent = (Math.floor(Math.random() * (max - min) + min))

  // Convert ICR to a duint
  const ICR = web3.utils.toWei((ICR_Percent * 10).toString(), 'finney')
  return ICR
}

static computeICR (coll, debt, price) {
  const collBN = web3.utils.toBN(coll)
  const debtBN = web3.utils.toBN(debt)
  const priceBN = web3.utils.toBN(price)

  const ICR = collBN.mul(priceBN).div(debtBN)

  return ICR
}

static gasUsed(tx) {
  const gas = tx.receipt.gasUsed
  return gas
}

static logGasMetrics(gasResults, message){
  console.log(
    `\n ${message} \n
    min gas: ${gasResults.minGas} \n
    max gas: ${gasResults.maxGas} \n
    mean gas: ${gasResults.meanGas} \n
    median gas: ${gasResults.medianGas} \n`)
}

static logAllGasCosts(gasResults) {
  console.log(
    `all gas costs: ${gasResults.gasCostList} \n`
  )
}

static logGas(gas, message) {
  console.log(
    `\n ${message} \n
    gas used: ${gas} \n`
  )
}

 // --- CDPManager gas functions ---

 static async openLoan_allAccounts(accounts, cdpManager, ETHAmount, CLVAmount){
  const gasCostList = []
  for (const account of accounts) {
    const tx = await cdpManager.openLoan(CLVAmount, account, { from: account, value: ETHAmount })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
 return this.getGasMetrics(gasCostList)
}

static async openLoan_allAccounts_randomETH(minETH, maxETH, accounts, cdpManager, CLVAmount) {
  const gasCostList = []
  for (const account of accounts) {
    const randCollAmount = this.randAmountInWei(minETH, maxETH)
    const tx = await cdpManager.openLoan(CLVAmount, account, { from: account, value: randCollAmount })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
 return this.getGasMetrics(gasCostList)
}

static async openLoan_allAccounts_randomETH_ProportionalCLV(minETH, maxETH, accounts, cdpManager, proportion) {
  const gasCostList = []
  for (const account of accounts) {
    const randCollAmount = this.randAmountInWei(minETH, maxETH)
    const proportionalCLV = (web3.utils.toBN(proportion)).mul(web3.utils.toBN(randCollAmount))
    const tx = await cdpManager.openLoan(proportionalCLV, account, { from: account, value: randCollAmount })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
 return this.getGasMetrics(gasCostList)
}

static async openLoan_allAccounts_randomETH_randomCLV(minETH, maxETH, accounts, cdpManager, minCLVProportion, maxCLVProportion, logging) {
  const gasCostList = []
  const _1e18 = web3.utils.toBN('1000000000000000000')

  let i = 0
  for (const account of accounts) {
    
    const randCollAmount = this.randAmountInWei(minETH, maxETH)
    const randCLVProportion = this.randAmountInWei(minCLVProportion, maxCLVProportion)
    const proportionalCLV = (web3.utils.toBN(randCLVProportion)).mul(web3.utils.toBN(randCollAmount).div(_1e18))

    const tx = await cdpManager.openLoan(proportionalCLV, account, { from: account, value: randCollAmount })
    
    if (logging === true && tx.receipt.status) {
      i++
      console.log(`${i}. Loan opened. addr: ${this.squeezeAddr(account)} coll: ${randCollAmount} debt: ${proportionalCLV}`)
    }
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
 return this.getGasMetrics(gasCostList)
}


static async openLoan_allAccounts_randomCLV(minCLV, maxCLV, accounts, cdpManager, ETHAmount){
  const gasCostList = []
  for (const account of accounts) {
    const randCLVAmount = this.randAmountInWei(minCLV, maxCLV)
    const tx = await cdpManager.openLoan(randCLVAmount, account, { from: account, value: ETHAmount })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
 return this.getGasMetrics(gasCostList)
}

static async closeLoan_allAccounts (accounts, borrowerOperations){
  const gasCostList = []
  for (const account of accounts) {
    const tx = await borrowerOperations.closeLoan({ from: account })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}

static async  openLoan_allAccounts_decreasingCLVAmounts (accounts, borrowerOperations, ETHAmount, maxCLVAmount){
  const gasCostList = []
  let i = 0
  for (const account of accounts) {
    const CLVAmount = (maxCLVAmount - i).toString()
    const CLVAmountWei = web3.utils.toWei(CLVAmount, 'ether')
    const tx = await borrowerOperations.openLoan(CLVAmountWei, account, { from: account, value: ETHAmount })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
    i += 1
  }
  return this.getGasMetrics(gasCostList)
}

static async adjustLoan_allAccounts (accounts, priceFeed, borrowerOperations, ETHAmount, CLVAmount){
  const gasCostList = []
  const price = await priceFeed.getPrice()
  for (const account of accounts) {
    let tx;

    let CLVAmountBN = web3.utils.toBN(CLVAmount)
    let ETHAmountBN = web3.utils.toBN(ETHAmount)
    const zero = web3.utils.toBN('0')

    const debt = (await cdpManager.CDPs(account))[0]
    const coll = (await cdpManager.CDPs(account))[1]

    const newDebt = debt.add(CLVAmountBN)
    const newColl = coll.add(ETHAmountBN)

    const newICR = computeICR(newColl, newDebt, price)
    const approxHint = await cdpManager.getApproxHint(newICR, 50)
    const insertAddr = (await sortedCDPs.findInsertPosition(newICR, price, approxHint, approxHint))[0]

    if (ETHAmountBN.gt(zero)) {
      tx = await borrowerOperations.adjustLoan(0, CLVAmountBN, insertAddr, { from: account, value: ETHAmountBN })
    } else if (ETHAmountBN.lt(zero)) {
      ETHAmountBN = ETHAmountBN.neg()
      console.log(`ETHAmountBN: ${ETHAmountBN}`)
      tx = await borrowerOperations.adjustLoan(ETHAmountBN, CLVAmountBN, insertAddr, { from: account })
    }

    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}

static async  adjustLoan_allAccounts_randomAmount (accounts, borrowerOperations, ETHMin, ETHMax, CLVMin, CLVMax){
  const gasCostList = []
  const price = await priceFeed.getPrice()
  for (const account of accounts) {
    let tx;

    let CLVAmountBN = web3.utils.toBN(randAmountInGwei(CLVMin, CLVMax))
    let ETHAmountBN = web3.utils.toBN(randAmountInGwei(ETHMin, ETHMax))

    const zero = web3.utils.toBN('0')

    const debt = (await cdpManager.CDPs(account))[0]
    const coll = (await cdpManager.CDPs(account))[1]

    const newDebt = debt.add(CLVAmountBN)
    const newColl = coll.add(ETHAmountBN)

    const newICR = computeICR(newColl, newDebt, price)
    const approxHint = await cdpManager.getApproxHint(newICR, 50)
    const insertAddr = (await sortedCDPs.findInsertPosition(newICR, price, approxHint, approxHint))[0]

    if (ETHAmountBN.gt(zero)) {
      tx = await borrowerOperations.adjustLoan(0, CLVAmountBN, insertAddr, { from: account, value: ETHAmountBN })
    } else if (ETHAmountBN.lt(zero)) {
      ETHAmountBN = ETHAmountBN.neg()
      console.log(`ETHAmountBN: ${ETHAmountBN}`)
      tx = await borrowerOperations.adjustLoan(ETHAmountBN, CLVAmountBN, insertAddr, { from: account })
    }

    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}

static async addColl_allAccounts (accounts, borrowerOperations, amount){
  const gasCostList = []
  for (const account of accounts) {
    const tx = await borrowerOperations.addColl(account, account, { from: account, value: amount })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}

static async addColl_allAccounts_randomAmount (min, max, accounts, borrowerOperations){
  const gasCostList = []
  for (const account of accounts) {
    const randCollAmount = this.randAmountInWei(min, max)
    const tx = await borrowerOperations.addColl(account, account, { from: account, value: randCollAmount })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}

// 
static async  withdrawColl_allAccounts (accounts, borrowerOperations, amount){
  const gasCostList = []
  for (const account of accounts) {
    const tx = await borrowerOperations.withdrawColl(amount, account, { from: account })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}

static async withdrawColl_allAccounts_randomAmount (min, max, accounts, borrowerOperations){
  const gasCostList = []
  for (const account of accounts) {
    const randCollAmount = this.randAmountInWei(min, max)
    const tx = await borrowerOperations.withdrawColl(randCollAmount, account, { from: account })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
    // console.log("gasCostlist length is " + gasCostList.length)
  }
  return this.getGasMetrics(gasCostList)
}

static async withdrawCLV_allAccounts (accounts, borrowerOperations, amount){
  const gasCostList = []
  for (const account of accounts) {
    const tx = await borrowerOperations.withdrawCLV(amount, account, { from: account })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}

static async withdrawCLV_allAccounts_randomAmount (min, max, accounts, borrowerOperations){
  const gasCostList = []
  for (const account of accounts) {
    const randCLVAmount = this.randAmountInWei(min, max)

    const tx = await borrowerOperations.withdrawCLV(randCLVAmount, account, { from: account })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}

static async repayCLV_allAccounts (accounts, borrowerOperations, amount){
  const gasCostList = []
  for (const account of accounts) {
    const tx = await borrowerOperations.repayCLV(amount, account, { from: account })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}

static async repayCLV_allAccounts_randomAmount (min, max, accounts, borrowerOperations){
  const gasCostList = []
  for (const account of accounts) {
    const randCLVAmount = this.randAmountInWei(min, max)

    const tx = await borrowerOperations.repayCLV(randCLVAmount, account, { from: account })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}

static async  getCurrentICR_allAccounts (accounts, priceFeed, borrowerOperations){
  const gasCostList = []
  const price = await priceFeed.getPrice()

  for (const account of accounts) {
    const tx = await functionCaller.cdpManager_getCurrentICR(account, price)
    const gas = this.gasUsed(tx) - 21000
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}

static async redeemCollateral (redeemer, priceFeed, cdpManager, CLVAmount){
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
  const gas = await this.gasUsed(tx)
  return gas
}

static async redeemCollateral_allAccounts_randomAmount (min, max, accounts, cdpManager){
  const gasCostList = []
  const price = await priceFeed.getPrice()

  for (const redeemer of accounts) {
    const randCLVAmount = this.randAmountInWei(min, max)
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
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}

// --- Composite functions ---

static async  makeCDPsIncreasingICR (accounts, borrowerOperations){

  let amountFinney = 2000

  for (const account of accounts) {
    const coll = web3.utils.toWei((amountFinney.toString()), 'finney')

    await borrowerOperations.addColl(account, account, { from: account, value: coll })
    await borrowerOperations.withdrawCLV('200000000000000000000', account, { from: account })

    amountFinney += 10
  }
}

// --- PoolManager gas functions ---

static async provideToSP_allAccounts (accounts, poolManager, amount){
  const gasCostList = []
  for (const account of accounts) {
    const tx = await poolManager.provideToSP(amount, { from: account })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}

static async provideToSP_allAccounts_randomAmount (min, max, accounts, poolManager){
  const gasCostList = []
  for (const account of accounts) {
    const randomCLVAmount = this.randAmountInWei(min, max)
    const tx = await poolManager.provideToSP(randomCLVAmount, { from: account })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}

static async withdrawFromSP_allAccounts(accounts, poolManager, amount){
  const gasCostList = []
  for (const account of accounts) {
    const tx = await poolManager.withdrawFromSP(amount, { from: account })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}

static async withdrawFromSP_allAccounts_randomAmount(min, max, accounts, poolManager){
  const gasCostList = []
  for (const account of accounts) {
    const randomCLVAmount = this.randAmountInWei(min, max)
    const tx = await poolManager.withdrawFromSP(randomCLVAmount, { from: account })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}

static async withdrawFromSPtoCDP_allAccounts(accounts, poolManager){
  const gasCostList = []
  for (const account of accounts) {

    const tx = await poolManager.withdrawFromSPtoCDP(account, account, { from: account })
    const gas = this.gasUsed(tx)
    gasCostList.push(gas)
  }
  return this.getGasMetrics(gasCostList)
}
}

// TODO:  Group functions into classes for export
module.exports = {
  TestHelper: TestHelper,
  MoneyValues: MoneyValues
}