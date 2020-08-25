
const web3 = require('web3')
const BN = require('bn.js')
const SortedCDPs = artifacts.require("./SortedCDPs.sol")

const MoneyValues = {
  _1_Ether: web3.utils.toWei('1', 'ether'),
  _2_Ether: web3.utils.toWei('2', 'ether'),
  _3_Ether: web3.utils.toWei('3', 'ether'),
  _4_Ether: web3.utils.toWei('4', 'ether'),
  _5_Ether: web3.utils.toWei('5', 'ether'),
  _6_Ether: web3.utils.toWei('6', 'ether'),
  _7_Ether: web3.utils.toWei('7', 'ether'),
  _8_Ether: web3.utils.toWei('8', 'ether'),
  _9_Ether: web3.utils.toWei('9', 'ether'),
  _10_Ether: web3.utils.toWei('10', 'ether'),
  _11_Ether: web3.utils.toWei('11', 'ether'),
  _15_Ether: web3.utils.toWei('15', 'ether'),
  _20_Ether: web3.utils.toWei('20', 'ether'),
  _22_Ether: web3.utils.toWei('22', 'ether'),
  _30_Ether: web3.utils.toWei('30', 'ether'),
  _40_Ether: web3.utils.toWei('40', 'ether'),
  _50_Ether: web3.utils.toWei('50', 'ether'),
  _98_Ether: web3.utils.toWei('98', 'ether'),
  _100_Ether: web3.utils.toWei('100', 'ether'),
  _200_Ether: web3.utils.toWei('200', 'ether'),
  _300_Ether: web3.utils.toWei('300', 'ether'),
  _999_Ether: web3.utils.toWei('300', 'ether'),
  _1000_Ether: web3.utils.toWei('1000', 'ether'),
  _2000_Ether: web3.utils.toWei('2000', 'ether'),
  _10000_Ether: web3.utils.toWei('10000', 'ether'),
  _1million_Ether: web3.utils.toWei('1000000', 'ether'),
  _10million_Ether: web3.utils.toWei('10000000', 'ether'),
  _100million_Ether: web3.utils.toWei('100000000', 'ether'),
  _500million_Ether: web3.utils.toWei('500000000', 'ether'),
  _1billion_Ether: web3.utils.toWei('1000000000', 'ether'),
  _10billion_Ether: web3.utils.toWei('10000000000', 'ether'),
  _100billion_Ether: web3.utils.toWei('100000000000', 'ether'),
  _500billion_Ether: web3.utils.toWei('500000000000', 'ether'),

  _0pt5_Ether: web3.utils.toWei('500', 'finney'),
  _1pt5_Ether: web3.utils.toWei('1500', 'finney'),

  _1e17: web3.utils.toWei('100', 'finney'),
  _3e17: web3.utils.toWei('300', 'finney'),
  _5e17: web3.utils.toWei('500', 'finney'),

  _1e18: web3.utils.toWei('1', 'ether'),
  _2e18: web3.utils.toWei('2', 'ether'),
  _3e18: web3.utils.toWei('3', 'ether'),
  _5e18: web3.utils.toWei('5', 'ether'),
  _10e18: web3.utils.toWei('10', 'ether'),
  _13e18: web3.utils.toWei('13', 'ether'),
  _15e18: web3.utils.toWei('15', 'ether'),
  _20e18: web3.utils.toWei('20', 'ether'),
  _30e18: web3.utils.toWei('30', 'ether'),
  _40e18: web3.utils.toWei('40', 'ether'),
  _50e18: web3.utils.toWei('50', 'ether'),
  _60e18: web3.utils.toWei('60', 'ether'),
  _70e18: web3.utils.toWei('70', 'ether'),
  _80e18: web3.utils.toWei('80', 'ether'),
  _90e18: web3.utils.toWei('90', 'ether'),
  _100e18: web3.utils.toWei('100', 'ether'),
  _101e18: web3.utils.toWei('101', 'ether'),
  _105e18: web3.utils.toWei('105', 'ether'),
  _110e18: web3.utils.toWei('110', 'ether'),
  _120e18: web3.utils.toWei('120', 'ether'),
  _125e18: web3.utils.toWei('125', 'ether'),
  _150e18: web3.utils.toWei('150', 'ether'),
  _170e18: web3.utils.toWei('170', 'ether'),
  _180e18: web3.utils.toWei('180', 'ether'),
  _200e18: web3.utils.toWei('200', 'ether'),
  _250e18: web3.utils.toWei('250', 'ether'),
  _300e18: web3.utils.toWei('300', 'ether'),
  _360e18: web3.utils.toWei('360', 'ether'),
  _400e18: web3.utils.toWei('400', 'ether'),
  _450e18: web3.utils.toWei('450', 'ether'),
  _500e18: web3.utils.toWei('500', 'ether'),
  _600e18: web3.utils.toWei('600', 'ether'),
  _800e18: web3.utils.toWei('800', 'ether'),
  _900e18: web3.utils.toWei('900', 'ether'),
  _1000e18: web3.utils.toWei('1000', 'ether'),
  _1500e18: web3.utils.toWei('1500', 'ether'),
  _1700e18: web3.utils.toWei('1700', 'ether'),
  _1800e18: web3.utils.toWei('1800', 'ether'),
  _2000e18: web3.utils.toWei('2000', 'ether'),
  _5000e18: web3.utils.toWei('5000', 'ether'),
  _8000e18: web3.utils.toWei('8000', 'ether'),
  _1e22: web3.utils.toWei('10000', 'ether'),
  _2e22: web3.utils.toWei('20000', 'ether'),
  _1e23: web3.utils.toWei('100000', 'ether'),
  _2e23: web3.utils.toWei('200000', 'ether'),
  _1e24: web3.utils.toWei('1000000', 'ether'),
  _2e24: web3.utils.toWei('2000000', 'ether'),
  _1e26: web3.utils.toWei('100000000', 'ether'),
  _1e27: web3.utils.toWei('1000000000', 'ether'),
  _2e27: web3.utils.toWei('2000000000', 'ether'),
  _9e28: web3.utils.toWei('90000000000', 'ether'),
  _1e29: web3.utils.toWei('100000000000', 'ether'),
  _5e35: web3.utils.toWei('500000000000000000', 'ether'),
  _1e36: web3.utils.toWei('1000000000000000000', 'ether'),

  negative_5e17: "-" + web3.utils.toWei('500', 'finney'),
  negative_1e18: "-" + web3.utils.toWei('1', 'ether'),
  negative_10e18: "-" + web3.utils.toWei('10', 'ether'),
  negative_50e18: "-" + web3.utils.toWei('50', 'ether'),
  negative_100e18: "-" + web3.utils.toWei('100', 'ether'),
  negative_101e18: "-" + web3.utils.toWei('101', 'ether'),

  _zeroBN: web3.utils.toBN('0'),
  _1e18BN: web3.utils.toBN('1000000000000000000'),
  _10e18BN: web3.utils.toBN('10000000000000000000'),
  _100e18BN: web3.utils.toBN('100000000000000000000'),
  _100BN: web3.utils.toBN('100'),
  _110BN: web3.utils.toBN('110'),
  _150BN: web3.utils.toBN('110'),

  _MCR: web3.utils.toBN('1100000000000000000'),
  _ICR100: web3.utils.toBN('1000000000000000000'),
  _CCR: web3.utils.toBN('1500000000000000000')

}

// TODO: Make classes for function export

class TestHelper {

  static squeezeAddr(address) {
    const len = address.length
    return address.slice(0, 6).concat("...").concat(address.slice(len - 5, len - 1))
  }
  static getDifference(x, y) {
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
    const sortedGasCostList = [...gasCostList].sort()
    const medianGas = (sortedGasCostList[Math.floor(sortedGasCostList.length / 2)])
    return { gasCostList, minGas, maxGas, meanGas, medianGas }
  }

  static getEndOfAccount(account) {
    const accountLast2bytes = account.slice((account.length - 4), account.length)
    return accountLast2bytes
  }

  static randAmountInWei(min, max) {
    const amount = Math.random() * (max - min) + min;
    const amountInWei = web3.utils.toWei(amount.toString(), 'ether')
    return amountInWei
  }

  static randAmountInGWei(min, max) {
    const amount = Math.floor(Math.random() * (max - min) + min);
    const amountInWei = web3.utils.toWei(amount.toString(), 'gwei')
    return amountInWei
  }

  static makeWei(num) {
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

  static computeICR(coll, debt, price) {
    const collBN = web3.utils.toBN(coll)
    const debtBN = web3.utils.toBN(debt)
    const priceBN = web3.utils.toBN(price)

    const ICR = debtBN.eq(this.toBN('0')) ? 
                this.toBN('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') 
                : collBN.mul(priceBN).div(debtBN)

    return ICR
  }

  static async ICRbetween100and110(account, cdpManager, price) {
    const ICR = await cdpManager.getCurrentICR(account, price)
    return (ICR.gt(MoneyValues._ICR100)) && (ICR.lt(MoneyValues._MCR))
  }
 
  static toBN(num) {
    return web3.utils.toBN(num)
  }

  static gasUsed(tx) {
    const gas = tx.receipt.gasUsed
    return gas
  }


  // --- Logging functions ---

  static logGasMetrics(gasResults, message) {
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

  static async logActiveAccounts(cdpManager, sortedCDPs, price, n) {
    const count = await sortedCDPs.getSize()

    n = (typeof n == 'undefined') ? count : n

    let account = await sortedCDPs.getLast()
    const head = await sortedCDPs.getFirst()

    console.log(`Total active accounts: ${count}`)
    console.log(`First ${n} accounts, in ascending ICR order:`)

    let i = 0
    while (i < n) {

      const squeezedAddr = this.squeezeAddr(account)
      const coll = (await cdpManager.CDPs(account))[1]
      const debt = (await cdpManager.CDPs(account))[0]
      const ICR = await cdpManager.getCurrentICR(account, price)

      console.log(`Acct: ${squeezedAddr}  coll:${coll}  debt: ${debt}  ICR: ${ICR}`)

      if (account == head) { break; }

      account = await sortedCDPs.getPrev(account)

      i++
    }
  }

  static async logAccountsArray(accounts, cdpManager, price, n) {
    const length = accounts.length

    n = (typeof n == 'undefined') ? length : n

    console.log(`Number of accounts in array: ${length}`)
    console.log(`First ${n} accounts of array:`)

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i]

      const squeezedAddr = this.squeezeAddr(account)
      const coll = (await cdpManager.CDPs(account))[1]
      const debt = (await cdpManager.CDPs(account))[0]
      const ICR = await cdpManager.getCurrentICR(account, price)

      console.log(`Acct: ${squeezedAddr}  coll:${coll}  debt: ${debt}  ICR: ${ICR}`)
    }
  }

  // --- Gas compensation calculation functions ---

  // Given a composite debt, returns the actual debt  - i.e. subtracts the virtual debt.
  // Virtual debt = 10 CLV.
  static async getActualDebtFromComposite(compositeDebt, contracts) {
    const issuedDebt = await contracts.cdpManager.getActualDebtFromComposite(compositeDebt)
    return issuedDebt
  }

  // Get's total collateral minus total gas comp, for a series of troves.
  static async getExpectedTotalCollMinusTotalGasComp(troveList, contracts) {
    let totalCollRemainder = web3.utils.toBN('0')

    for (const trove of troveList) {
      const remainingColl = this.getCollMinusGasComp(trove, contracts)
      totalCollRemainder = totalCollRemainder.add(remainingColl)
    }

    return totalCollRemainder
  }

  static getEmittedLiquidationValues(liquidationTx) {
    for (let i = 0; i< liquidationTx.logs.length; i++) {
      if (liquidationTx.logs[i].event === "Liquidation") { 
        const liquidatedDebt = liquidationTx.logs[i].args[0]
        const liquidatedColl = liquidationTx.logs[i].args[1]
        const gasComp = liquidationTx.logs[i].args[2]

        return [ liquidatedDebt, liquidatedColl, gasComp ]
      }
    }

    throw("The transaction logs do not contain a liquidation event")
  }


  static getEmittedLiquidatedDebt(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 0)  // LiquidatedDebt is position 0 in the Liquidation event
  }
    
  static  getEmittedLiquidatedColl(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 1) // LiquidatedColl is position 1 in the Liquidation event
  }

  static getEmittedGasComp(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 2) // GasComp is position 2 in the Liquidation event
  }

  static getLiquidationEventArg(liquidationTx, arg) {
    for (let i = 0; i< liquidationTx.logs.length; i++) {
      if (liquidationTx.logs[i].event === "Liquidation") { 
        return liquidationTx.logs[i].args[arg] 
      }
    }

    throw("The transaction logs do not contain a liquidation event")
  }



  static async getCompositeDebt(contracts, debt) {
    const compositeDebt = contracts.borrowerOperations.getCompositeDebt(debt)
    return compositeDebt
  }
  
  static async getBorrowerOpsListHint(contracts, newColl, newDebt, price) {
    const compositeDebt = await this.getCompositeDebt(contracts, newDebt)
    const newICR = await contracts.hintHelpers.computeCR(newColl, compositeDebt, price)

    const approxfullListHint = await contracts.hintHelpers.getApproxHint(newICR, 50)

    const exactFullListHint  = (await contracts.sortedCDPs.findInsertPosition(newICR, price, approxfullListHint, approxfullListHint))[0]
 
    return exactFullListHint
  }

  static async getEntireCollAndDebt (contracts, account) {
    // console.log(`account: ${account}`)
    const rawColl = (await contracts.cdpManager.CDPs(account))[1]
    const rawDebt = (await contracts.cdpManager.CDPs(account))[0]
    const pendingETHReward = await contracts.cdpManager.getPendingETHReward(account)
    const pendingCLVDebtReward = await contracts.cdpManager.getPendingCLVDebtReward(account)
    const entireColl = rawColl.add(pendingETHReward)
    const entireDebt = rawDebt.add(pendingCLVDebtReward)

    return { entireColl, entireDebt }
  }

  static async getCollAndDebtFromAddColl(contracts,  account, amount) {
    const {entireColl, entireDebt} = await this.getEntireCollAndDebt(contracts, account)
   
    const newColl = entireColl.add(this.toBN(amount))
    const newDebt = entireDebt
    return { newColl, newDebt }
  }

  static async getCollAndDebtFromWithdrawColl(contracts, account, amount) {
    const {entireColl, entireDebt} = await this.getEntireCollAndDebt(contracts, account)
    // console.log(`entireColl  ${entireColl}`)
    // console.log(`entireDebt  ${entireDebt}`)

    const newColl = entireColl.sub(this.toBN(amount))
    const newDebt = entireDebt
    return { newColl, newDebt }
  }

  static async getCollAndDebtFromWithdrawCLV(contracts, account, amount) {
    const {entireColl, entireDebt} = await this.getEntireCollAndDebt(contracts, account)

    const newColl = entireColl
    const newDebt = entireDebt.add(this.toBN(amount))
  
    return { newColl, newDebt }
  }

  static async getCollAndDebtFromRepayCLV(contracts, account, amount) {
    const {entireColl, entireDebt} = await this.getEntireCollAndDebt(contracts, account)

    const newColl = entireColl
    const newDebt = entireDebt.sub(this.toBN(amount))
  
    return { newColl, newDebt }
  }

  static async getCollAndDebtFromAdjustment(contracts, account, ETHChange, CLVChange) {
    const {entireColl, entireDebt} = await this.getEntireCollAndDebt(contracts, account)

    const coll = (await contracts.cdpManager.CDPs(account))[1]
    const debt = (await contracts.cdpManager.CDPs(account))[0]
   
    const newColl = entireColl.add(ETHChange)
    const newDebt = entireDebt.add(CLVChange)
  
    return { newColl, newDebt }
  }
  
  // --- BorrowerOperations gas functions ---

  static async openLoan_allAccounts(accounts, contracts, ETHAmount, CLVAmount) {
    const gasCostList = []
    const price = await contracts.priceFeed.getPrice()
    
    for (const account of accounts) {
      const hint = await this.getBorrowerOpsListHint(contracts, ETHAmount, CLVAmount, price)

      const tx = await contracts.borrowerOperations.openLoan(CLVAmount, hint, { from: account, value: ETHAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openLoan_allAccounts_randomETH(minETH, maxETH, accounts, contracts, CLVAmount) {
    const gasCostList = []
    const price = await contracts.priceFeed.getPrice()
    
    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(minETH, maxETH)
      const hint = await this.getBorrowerOpsListHint(contracts, randCollAmount, CLVAmount, price)

      const tx = await contracts.borrowerOperations.openLoan(CLVAmount, hint, { from: account, value: randCollAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openLoan_allAccounts_randomETH_ProportionalCLV(minETH, maxETH, accounts, contracts, proportion) {
    const gasCostList = []
    const price = await contracts.priceFeed.getPrice()

    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(minETH, maxETH)
      const proportionalCLV = (web3.utils.toBN(proportion)).mul(web3.utils.toBN(randCollAmount))
      const hint = await this.getBorrowerOpsListHint(contracts, randCollAmount, proportionalCLV, price)

      const tx = await contracts.borrowerOperations.openLoan(proportionalCLV, hint, { from: account, value: randCollAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }
  
  static async openLoan_allAccounts_randomETH_randomCLV(minETH, maxETH, accounts, contracts, minCLVProportion, maxCLVProportion, logging=false) {
    const gasCostList = []
    const price = await contracts.priceFeed.getPrice()
    const _1e18 = web3.utils.toBN('1000000000000000000')

    let i = 0
    for (const account of accounts) {

      const randCollAmount = this.randAmountInWei(minETH, maxETH)
      // console.log(`randCollAmount ${randCollAmount }`)
      const randCLVProportion = this.randAmountInWei(minCLVProportion, maxCLVProportion)
      const proportionalCLV = (web3.utils.toBN(randCLVProportion)).mul(web3.utils.toBN(randCollAmount).div(_1e18))

      const hint = await this.getBorrowerOpsListHint(contracts, randCollAmount, proportionalCLV, price)

      const tx = await contracts.borrowerOperations.openLoan(proportionalCLV, hint, { from: account, value: randCollAmount })

      if (logging === true && tx.receipt.status) {
        i++
        const ICR = await contracts.cdpManager.getCurrentICR(account, price)
        // console.log(`${i}. Loan opened. addr: ${this.squeezeAddr(account)} coll: ${randCollAmount} debt: ${proportionalCLV} ICR: ${ICR}`)
      }
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }


  static async openLoan_allAccounts_randomCLV(minCLV, maxCLV, accounts, contracts, ETHAmount) {
    const gasCostList = []
    const price = await contracts.priceFeed.getPrice()

    for (const account of accounts) {
      const randCLVAmount = this.randAmountInWei(minCLV, maxCLV)
      const hint = await this.getBorrowerOpsListHint(contracts, ETHAmount, randCLVAmount, price)

      const tx = await contracts.borrowerOperations.openLoan(randCLVAmount, hint, { from: account, value: ETHAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async closeLoan_allAccounts(accounts, contracts) {
    const gasCostList = []
    const price = await contracts.priceFeed.getPrice()

    for (const account of accounts) {
      const tx = await contracts.borrowerOperations.closeLoan({ from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openLoan_allAccounts_decreasingCLVAmounts(accounts, contracts, ETHAmount, maxCLVAmount) {
    const gasCostList = []
    const price = await contracts.priceFeed.getPrice()

    let i = 0
    for (const account of accounts) {
      const CLVAmount = (maxCLVAmount - i).toString()
      const CLVAmountWei = web3.utils.toWei(CLVAmount, 'ether')
      const hint = await this.getBorrowerOpsListHint(contracts, ETHAmount, CLVAmountWei, price)

      const tx = await contracts.borrowerOperations.openLoan(CLVAmountWei, hint, { from: account, value: ETHAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
      i += 1
    }
    return this.getGasMetrics(gasCostList)
  }

  static async adjustLoan_allAccounts(accounts, contracts, ETHAmount, CLVAmount) {
    const gasCostList = []
    const price = await contracts.priceFeed.getPrice()

    for (const account of accounts) {
      let tx;

      let ETHChangeBN = this.toBN(ETHAmount)
      const CLVChangeBN = this.toBN(CLVAmount)

      const { newColl, newDebt } = await this.getCollAndDebtFromAdjustment(contracts, account, ETHChangeBN, CLVChangeBN)
      const hint = await this.getBorrowerOpsListHint(contracts, newColl, newDebt, price)

      const zero = this.toBN('0')

      if (ETHChangeBN.gt(zero)) {
        tx = await contracts.borrowerOperations.adjustLoan(0, CLVChangeBN, hint, { from: account, value: ETHChangeBN })
      } else if (ETHChangeBN.lt(zero)) {
        ETHChangeBN = ETHChangeBN.neg()
        // console.log(`ETHAmountBN: ${ETHAmountBN}`)
        tx = await contracts.borrowerOperations.adjustLoan(ETHChangeBN, CLVChangeBN, hint, { from: account })
      }

      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async adjustLoan_allAccounts_randomAmount(accounts, contracts, ETHMin, ETHMax, CLVMin, CLVMax) {
    const gasCostList = []
    const price = await contracts.priceFeed.getPrice()

    for (const account of accounts) {
      let tx;

      let ETHAmountBN = this.toBN(this.randAmountInWei(ETHMin, ETHMax))
      let CLVAmountBN = this.toBN(this.randAmountInWei(CLVMin, CLVMax))

      const { newColl, newDebt } = await this.getCollAndDebtFromAdjustment(contracts, account, ETHAmountBN, CLVAmountBN)
      const hint = await this.getBorrowerOpsListHint(contracts, newColl, newDebt, price)

      const zero = this.toBN('0')

      if (ETHAmountBN.gt(zero)) {
        tx = await contracts.borrowerOperations.adjustLoan(0, CLVAmountBN, hint, { from: account, value: ETHAmountBN })
      } else if (ETHAmountBN.lt(zero)) {
        ETHAmountBN = ETHAmountBN.neg()
        tx = await contracts.borrowerOperations.adjustLoan(ETHAmountBN, CLVAmountBN, hint, { from: account })
      }

      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async addColl_allAccounts(accounts, contracts, amount) {
    const price = await contracts.priceFeed.getPrice()

    const gasCostList = []
    for (const account of accounts) {

      const { newColl, newDebt } = await this.getCollAndDebtFromAddColl(contracts, account, amount)
      const hint = await this.getBorrowerOpsListHint(contracts, newColl, newDebt, price)
      
      const tx = await contracts.borrowerOperations.addColl(account, hint, { from: account, value: amount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async addColl_allAccounts_randomAmount(min, max, accounts, contracts) {
    const price = await contracts.priceFeed.getPrice()

    const gasCostList = []
    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(min, max)

      const { newColl, newDebt } = await this.getCollAndDebtFromAddColl(contracts, account, randCollAmount)
      const hint = await this.getBorrowerOpsListHint(contracts, newColl, newDebt, price)

      const tx = await contracts.borrowerOperations.addColl(account, hint, { from: account, value: randCollAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  // 
  static async withdrawColl_allAccounts(accounts, contracts, amount) {
    const price = await contracts.priceFeed.getPrice()

    const gasCostList = []
    for (const account of accounts) {
      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawColl(contracts, account, amount)
      // console.log(`newColl: ${newColl} `)
      // console.log(`newDebt: ${newDebt} `)
      const hint = await this.getBorrowerOpsListHint(contracts, newColl, newDebt, price)

      const tx = await contracts.borrowerOperations.withdrawColl(amount, hint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawColl_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []
    const price = await contracts.priceFeed.getPrice()

    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(min, max)

      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawColl(contracts, account, randCollAmount)
      const hint = await this.getBorrowerOpsListHint(contracts, newColl, newDebt, price)

      const tx = await contracts.borrowerOperations.withdrawColl(randCollAmount, hint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
      // console.log("gasCostlist length is " + gasCostList.length)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawCLV_allAccounts(accounts, contracts, amount) {
    const gasCostList = []
    const price = await contracts.priceFeed.getPrice()

    for (const account of accounts) {
      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawCLV(contracts, account, amount)
      const hint = await this.getBorrowerOpsListHint(contracts, newColl, newDebt, price)

      const tx = await contracts.borrowerOperations.withdrawCLV(amount, hint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawCLV_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []
    const price = await contracts.priceFeed.getPrice()

    for (const account of accounts) {
      const randCLVAmount = this.randAmountInWei(min, max)

      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawCLV(contracts, account, randCLVAmount)
      const hint = await this.getBorrowerOpsListHint(contracts, newColl, newDebt, price)

      const tx = await contracts.borrowerOperations.withdrawCLV(randCLVAmount, hint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async repayCLV_allAccounts(accounts, contracts, amount) {
    const gasCostList = []
    const price = await contracts.priceFeed.getPrice()

    for (const account of accounts) {
      const { newColl, newDebt } = await this.getCollAndDebtFromRepayCLV(contracts, account, amount)
      const hint = await this.getBorrowerOpsListHint(contracts, newColl, newDebt, price)

      const tx = await contracts.borrowerOperations.repayCLV(amount, hint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async repayCLV_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []
    const price = await contracts.priceFeed.getPrice()

    for (const account of accounts) {
      const randCLVAmount = this.randAmountInWei(min, max)

      const { newColl, newDebt } = await this.getCollAndDebtFromRepayCLV(contracts, account, randCLVAmount)
      const hint = await this.getBorrowerOpsListHint(contracts, newColl, newDebt, price)

      const tx = await contracts.borrowerOperations.repayCLV(randCLVAmount, hint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async getCurrentICR_allAccounts(accounts, contracts, functionCaller) {
    const gasCostList = []
    const price = await contracts.priceFeed.getPrice()

    for (const account of accounts) {
      const tx = await functionCaller.cdpManager_getCurrentICR(account, price)
      const gas = this.gasUsed(tx) - 21000
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  // --- Redemption functions ---

  static async redeemCollateral(redeemer, contracts, CLVAmount) {
    const price = await contracts.priceFeed.getPrice()
    const tx = await this.performRedemptionTx(redeemer, price, contracts, CLVAmount)
    const gas = await this.gasUsed(tx)
    return gas
  }

  static async redeemCollateral_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []
    const price = await contracts.priceFeed.getPrice()

    for (const redeemer of accounts) {
      const randCLVAmount = this.randAmountInWei(min, max)

      await this.performRedemptionTx(redeemer, price, contracts, randCLVAmount)
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async performRedemptionTx(redeemer, price, contracts, CLVAmount) {
    const redemptionhint = await contracts.hintHelpers.getRedemptionHints(CLVAmount, price)
    
    const firstRedemptionHint = redemptionhint[0]
    const partialRedemptionNewICR = redemptionhint[1]
  
    const approxPartialRedemptionHint = await contracts.hintHelpers.getApproxHint(partialRedemptionNewICR, 50)
    const exactPartialRedemptionHint = (await contracts.sortedCDPs.findInsertPosition(partialRedemptionNewICR,
      price,
      approxPartialRedemptionHint,
      approxPartialRedemptionHint))[0]

    const tx = await contracts.cdpManager.redeemCollateral(CLVAmount,
      firstRedemptionHint,
      exactPartialRedemptionHint,
      partialRedemptionNewICR,
      { from: redeemer })
    
    return tx
  }

  // --- Composite functions ---

  static async makeCDPsIncreasingICR(accounts, contracts) {
    const price = await contracts.priceFeed.getPrice()

    let amountFinney = 2000

    for (const account of accounts) {
      const coll = web3.utils.toWei(amountFinney.toString(), 'finney')

      await contracts.borrowerOperations.openLoan('200000000000000000000', account, account, { from: account, value: coll })

      amountFinney += 10
    }
  }

  // --- PoolManager gas functions ---

  static async provideToSP_allAccounts(accounts, poolManager, amount) {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await poolManager.provideToSP(amount, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async provideToSP_allAccounts_randomAmount(min, max, accounts, poolManager) {
    const gasCostList = []
    for (const account of accounts) {
      const randomCLVAmount = this.randAmountInWei(min, max)
      const tx = await poolManager.provideToSP(randomCLVAmount, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawFromSP_allAccounts(accounts, poolManager, amount) {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await poolManager.withdrawFromSP(amount, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawFromSP_allAccounts_randomAmount(min, max, accounts, poolManager) {
    const gasCostList = []
    for (const account of accounts) {
      const randomCLVAmount = this.randAmountInWei(min, max)
      const tx = await poolManager.withdrawFromSP(randomCLVAmount, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawFromSPtoCDP_allAccounts(accounts, poolManager) {
    const gasCostList = []
    for (const account of accounts) {

      const tx = await poolManager.withdrawFromSPtoCDP(account, account, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }
}

module.exports = {
  TestHelper: TestHelper,
  MoneyValues: MoneyValues
}