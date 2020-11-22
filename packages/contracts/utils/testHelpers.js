const BN = require('bn.js')
const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const OneYearLockupContract = artifacts.require(("./OneYearLockupContract.sol"))
const CustomDurationLockupContract = artifacts.require(("./CustomDurationLockupContract.sol"))
const Destructible = artifacts.require("./TestContracts/Destructible.sol")

const MoneyValues = {
  negative_5e17: "-" + web3.utils.toWei('500', 'finney'),
  negative_1e18: "-" + web3.utils.toWei('1', 'ether'),
  negative_10e18: "-" + web3.utils.toWei('10', 'ether'),
  negative_50e18: "-" + web3.utils.toWei('50', 'ether'),
  negative_100e18: "-" + web3.utils.toWei('100', 'ether'),
  negative_101e18: "-" + web3.utils.toWei('101', 'ether'),
  negative_eth: (amount) => "-" + web3.utils.toWei(amount, 'ether'),

  _zeroBN: web3.utils.toBN('0'),
  _1e18BN: web3.utils.toBN('1000000000000000000'),
  _10e18BN: web3.utils.toBN('10000000000000000000'),
  _100e18BN: web3.utils.toBN('100000000000000000000'),
  _100BN: web3.utils.toBN('100'),
  _110BN: web3.utils.toBN('110'),
  _150BN: web3.utils.toBN('150'),

  _MCR: web3.utils.toBN('1100000000000000000'),
  _ICR100: web3.utils.toBN('1000000000000000000'),
  _CCR: web3.utils.toBN('1500000000000000000'),
}

const TimeValues = {
  SECONDS_IN_ONE_MINUTE:        60,
  SECONDS_IN_ONE_HOUR:          60 * 60,
  SECONDS_IN_ONE_DAY:           60 * 60 * 24,
  SECONDS_IN_ONE_WEEK:          60 * 60 * 24 * 7,
  SECONDS_IN_ONE_MONTH:         60 * 60 * 24 * 30,
  SECONDS_IN_ONE_YEAR:          60 * 60 * 24 * 365,
  MINUTES_IN_ONE_WEEK:          60 *24 * 30,
  MINUTES_IN_ONE_MONTH:         60 *24 * 30,
  MINUTES_IN_ONE_YEAR:          60 * 24 * 365
}

class TestHelper {

  static dec(val, scale) {
    let zerosCount

    if (scale == 'ether') {
      zerosCount = 18
    } else if (scale == 'finney')
      zerosCount = 15
    else {
      zerosCount = scale
    }

    const strVal = val.toString()
    const strZeros = ('0').repeat(zerosCount)

    return strVal.concat(strZeros)
  }

  static squeezeAddr(address) {
    const len = address.length
    return address.slice(0, 6).concat("...").concat(address.slice(len - 4, len))
  }
  static getDifference(x, y) {
    const x_BN = web3.utils.toBN(x)
    const y_BN = web3.utils.toBN(y)

    return Number(x_BN.sub(y_BN).abs())
  }

  static zipToObject(array1, array2) {
    let obj = {}
    array1.forEach((element, idx) => obj[element] = array2[idx])
    return obj
  }

  static getGasMetrics(gasCostList) {
    const minGas = Math.min(...gasCostList)
    const maxGas = Math.max(...gasCostList)

    let sum = 0;
    for (const gas of gasCostList) {
      sum += gas
    }

    if (sum === 0) {
      return {
        gasCostList: gasCostList,
        minGas: undefined,
        maxGas: undefined,
        meanGas: undefined,
        medianGas: undefined
      }
    }
    const meanGas = sum / gasCostList.length

    // median is the middle element (for odd list size) or element adjacent-right of middle (for even list size)
    const sortedGasCostList = [...gasCostList].sort()
    const medianGas = (sortedGasCostList[Math.floor(sortedGasCostList.length / 2)])
    return { gasCostList, minGas, maxGas, meanGas, medianGas }
  }

  static getGasMinMaxAvg(gasCostList) {
    const metrics = th.getGasMetrics(gasCostList)

    const minGas = metrics.minGas
    const maxGas = metrics.maxGas
    const meanGas = metrics.meanGas
    const medianGas = metrics.medianGas

    return { minGas, maxGas, meanGas, medianGas }
  }

  static getEndOfAccount(account) {
    const accountLast2bytes = account.slice((account.length - 4), account.length)
    return accountLast2bytes
  }

  static randDecayFactor(min, max) {
    const amount = Math.random() * (max - min) + min;
    const amountInWei = web3.utils.toWei(amount.toFixed(18), 'ether')
    return amountInWei
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

  static async logActiveAccounts(contracts, n) {
    const count = await contracts.sortedCDPs.getSize()
    const price = await contracts.priceFeed.getPrice()

    n = (typeof n == 'undefined') ? count : n

    let account = await contracts.sortedCDPs.getLast()
    const head = await contracts.sortedCDPs.getFirst()

    console.log(`Total active accounts: ${count}`)
    console.log(`First ${n} accounts, in ascending ICR order:`)

    let i = 0
    while (i < n) {

      const squeezedAddr = this.squeezeAddr(account)
      const coll = (await contracts.cdpManager.CDPs(account))[1]
      const debt = (await contracts.cdpManager.CDPs(account))[0]
      const ICR = await contracts.cdpManager.getCurrentICR(account, price)

      console.log(`Acct: ${squeezedAddr}  coll:${coll}  debt: ${debt}  ICR: ${ICR}`)

      if (account == head) { break; }

      account = await contracts.sortedCDPs.getPrev(account)

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


  static getEmittedRedemptionValues(redemptionTx) {
    for (let i = 0; i < redemptionTx.logs.length; i++) {
      if (redemptionTx.logs[i].event === "Redemption") {

        const CLVAmount = redemptionTx.logs[i].args[0]
        const totalCLVRedeemed = redemptionTx.logs[i].args[1]
        const totalETHDrawn = redemptionTx.logs[i].args[2]
        const ETHFee = redemptionTx.logs[i].args[3]

        return [CLVAmount, totalCLVRedeemed, totalETHDrawn, ETHFee]
      }
    }

    throw ("The transaction logs do not contain a redemption event")
  }

  static getEmittedLiquidationValues(liquidationTx) {
    for (let i = 0; i < liquidationTx.logs.length; i++) {
      if (liquidationTx.logs[i].event === "Liquidation") {
        const liquidatedDebt = liquidationTx.logs[i].args[0]
        const liquidatedColl = liquidationTx.logs[i].args[1]
        const collGasComp = liquidationTx.logs[i].args[2]
        const clvGasComp = liquidationTx.logs[i].args[3]

        return [liquidatedDebt, liquidatedColl, collGasComp, clvGasComp]
      }
    }

    throw ("The transaction logs do not contain a liquidation event")
  }


  static getEmittedLiquidatedDebt(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 0)  // LiquidatedDebt is position 0 in the Liquidation event
  }

  static getEmittedLiquidatedColl(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 1) // LiquidatedColl is position 1 in the Liquidation event
  }

  static getEmittedGasComp(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 2) // GasComp is position 2 in the Liquidation event
  }

  static getLiquidationEventArg(liquidationTx, arg) {
    for (let i = 0; i < liquidationTx.logs.length; i++) {
      if (liquidationTx.logs[i].event === "Liquidation") {
        return liquidationTx.logs[i].args[arg]
      }
    }

    throw ("The transaction logs do not contain a liquidation event")
  }

  static getETHWithdrawnFromEvent(tx) {
    for (let i = 0; i < tx.logs.length; i++) {
      if (tx.logs[i].event === "ETHGainWithdrawn") {
        return (tx.logs[i].args[1]).toString()
      }
    }
    throw ("The transaction logs do not contain an ETHGainWithdrawn event")
  }

  static getLUSDFeeFromLUSDBorrowingEvent(tx) {
    for (let i = 0; i < tx.logs.length; i++) {
      if (tx.logs[i].event === "LUSDBorrowingFeePaid") {
        return (tx.logs[i].args[1]).toString()
      }
    }
    throw ("The transaction logs do not contain an LUSDBorrowingFeePaid event")
  }


  static async getCompositeDebt(contracts, debt) {
    const compositeDebt = contracts.borrowerOperations.getCompositeDebt(debt)
    return compositeDebt
  }

  static async getBorrowerOpsListHint(contracts, newColl, newDebt, price) {
    const compositeDebt = await this.getCompositeDebt(contracts, newDebt)
    const newICR = await contracts.hintHelpers.computeCR(newColl, compositeDebt, price)

    const {
      hintAddress: approxfullListHint,
      latestRandomSeed
    } = await contracts.hintHelpers.getApproxHint(newICR, 50, price, this.latestRandomSeed)
    this.latestRandomSeed = latestRandomSeed

    const exactFullListHint = (await contracts.sortedCDPs.findInsertPosition(newICR, price, approxfullListHint, approxfullListHint))[0]

    return exactFullListHint
  }

  static async getEntireCollAndDebt(contracts, account) {
    // console.log(`account: ${account}`)
    const rawColl = (await contracts.cdpManager.CDPs(account))[1]
    const rawDebt = (await contracts.cdpManager.CDPs(account))[0]
    const pendingETHReward = await contracts.cdpManager.getPendingETHReward(account)
    const pendingCLVDebtReward = await contracts.cdpManager.getPendingCLVDebtReward(account)
    const entireColl = rawColl.add(pendingETHReward)
    const entireDebt = rawDebt.add(pendingCLVDebtReward)

    return { entireColl, entireDebt }
  }

  static async getCollAndDebtFromAddColl(contracts, account, amount) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)

    const newColl = entireColl.add(this.toBN(amount))
    const newDebt = entireDebt
    return { newColl, newDebt }
  }

  static async getCollAndDebtFromWithdrawColl(contracts, account, amount) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)
    // console.log(`entireColl  ${entireColl}`)
    // console.log(`entireDebt  ${entireDebt}`)

    const newColl = entireColl.sub(this.toBN(amount))
    const newDebt = entireDebt
    return { newColl, newDebt }
  }

  static async getCollAndDebtFromWithdrawCLV(contracts, account, amount) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)

    const newColl = entireColl
    const newDebt = entireDebt.add(this.toBN(amount))

    return { newColl, newDebt }
  }

  static async getCollAndDebtFromRepayCLV(contracts, account, amount) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)

    const newColl = entireColl
    const newDebt = entireDebt.sub(this.toBN(amount))

    return { newColl, newDebt }
  }

  static async getCollAndDebtFromAdjustment(contracts, account, ETHChange, CLVChange) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)

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

  static async openLoan_allAccounts_randomETH_randomCLV(minETH, maxETH, accounts, contracts, minCLVProportion, maxCLVProportion, logging = false) {
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
      let CLVChangeBN = this.toBN(CLVAmount)

      const { newColl, newDebt } = await this.getCollAndDebtFromAdjustment(contracts, account, ETHChangeBN, CLVChangeBN)
      const hint = await this.getBorrowerOpsListHint(contracts, newColl, newDebt, price)

      const zero = this.toBN('0')

      let isDebtIncrease = CLVChangeBN.gt(zero)
      CLVChangeBN = CLVChangeBN.abs() 

      if (ETHChangeBN.gt(zero)) {
        tx = await contracts.borrowerOperations.adjustLoan(0, CLVChangeBN, isDebtIncrease, hint, { from: account, value: ETHChangeBN })
      } else if (ETHChangeBN.lt(zero)) {
        ETHChangeBN = ETHChangeBN.neg()
        // console.log(`ETHAmountBN: ${ETHAmountBN}`)
        tx = await contracts.borrowerOperations.adjustLoan(ETHChangeBN, CLVChangeBN, isDebtIncrease, hint, { from: account })
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

      let ETHChangeBN = this.toBN(this.randAmountInWei(ETHMin, ETHMax))
      let CLVChangeBN = this.toBN(this.randAmountInWei(CLVMin, CLVMax))

      const { newColl, newDebt } = await this.getCollAndDebtFromAdjustment(contracts, account, ETHChangeBN, CLVChangeBN)
      const hint = await this.getBorrowerOpsListHint(contracts, newColl, newDebt, price)

      const zero = this.toBN('0')

      let isDebtIncrease = CLVChangeBN.gt(zero)
      CLVChangeBN = CLVChangeBN.abs() 

      if (ETHChangeBN.gt(zero)) {
        tx = await contracts.borrowerOperations.adjustLoan(0, CLVChangeBN, isDebtIncrease, hint, { from: account, value: ETHChangeBN })
      } else if (ETHChangeBN.lt(zero)) {
        ETHChangeBN = ETHChangeBN.neg()
        tx = await contracts.borrowerOperations.adjustLoan(ETHChangeBN, CLVChangeBN, isDebtIncrease, hint, { from: account })
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

  static async redeemCollateralAndGetTxObject(redeemer, contracts, CLVAmount) {
    const price = await contracts.priceFeed.getPrice()
    const tx = await this.performRedemptionTx(redeemer, price, contracts, CLVAmount)
    return tx
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

    const {
      hintAddress: approxPartialRedemptionHint,
      latestRandomSeed
    } = await contracts.hintHelpers.getApproxHint(partialRedemptionNewICR, 50, price, this.latestRandomSeed)
    this.latestRandomSeed = latestRandomSeed

    const exactPartialRedemptionHint = (await contracts.sortedCDPs.findInsertPosition(partialRedemptionNewICR,
      price,
      approxPartialRedemptionHint,
      approxPartialRedemptionHint))[0]

    const tx = await contracts.cdpManager.redeemCollateral(CLVAmount,
      firstRedemptionHint,
      exactPartialRedemptionHint,
      partialRedemptionNewICR,
      0,
      { from: redeemer, gasPrice: 0 },
    )

    return tx
  }

  // --- Composite functions ---

  static async makeCDPsIncreasingICR(accounts, contracts) {
    const price = await contracts.priceFeed.getPrice()

    let amountFinney = 2000

    for (const account of accounts) {
      const coll = web3.utils.toWei(amountFinney.toString(), 'finney')

      await contracts.borrowerOperations.openLoan('200000000000000000000', account, { from: account, value: coll })

      amountFinney += 10
    }
  }

  // --- PoolManager gas functions ---

  static async provideToSP_allAccounts(accounts, poolManager, amount) {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await poolManager.provideToSP(amount, this.ZERO_ADDRESS, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async provideToSP_allAccounts_randomAmount(min, max, accounts, poolManager) {
    const gasCostList = []
    for (const account of accounts) {
      const randomCLVAmount = this.randAmountInWei(min, max)
      const tx = await poolManager.provideToSP(randomCLVAmount, this.ZERO_ADDRESS, { from: account })
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

  static async withdrawETHGainToTrove_allAccounts(accounts, poolManager) {
    const gasCostList = []
    for (const account of accounts) {

      const tx = await poolManager.withdrawETHGainToTrove(account, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  // --- GT & Lockup Contract functions ---

  static getLCAddressFromDeploymentTx(deployedLCTx) {
    return deployedLCTx.logs[0].args[0]
  }

  static async getOYLCFromDeploymentTx(deployedOYLCTx) {
    const deployedOYLCAddress = this.getLCAddressFromDeploymentTx(deployedOYLCTx)  // grab addr of deployed contract from event
    const OYLC = await OneYearLockupContract.at(deployedOYLCAddress)
    return OYLC
  }

  static async getCDLCFromDeploymentTx(deployedCDLCTx) {
    const deployedCDLCAddress = this.getLCAddressFromDeploymentTx(deployedCDLCTx)  // grab addr of deployed contract from event
    const CDLC = await CustomDurationLockupContract.at(deployedCDLCAddress)
    return CDLC
  }

  static async registerFrontEnds(frontEnds, poolManager) {
    for (const frontEnd of frontEnds) {
      await poolManager.registerFrontEnd(this.dec(5, 17), { from: frontEnd })  // default kickback rate of 50%
    }
  }

  // --- Time functions ---

  static async fastForwardTime(seconds, currentWeb3Provider) {
    await currentWeb3Provider.send({
      id: 0,
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [seconds]
    },
      (err) => { if (err) console.log(err) })

    await currentWeb3Provider.send({
      id: 0,
      jsonrpc: '2.0',
      method: 'evm_mine'
    },
      (err) => { if (err) console.log(err) })
  }

  static async getLatestBlockTimestamp(web3Instance) {
    const blockNumber = await web3Instance.eth.getBlockNumber()
    const block = await web3Instance.eth.getBlock(blockNumber)

    return block.timestamp
  }

  static async getTimestampFromTx(tx, web3Instance) {
    return this.getTimestampFromTxReceipt(tx.receipt, web3Instance)
  }

  static async getTimestampFromTxReceipt(txReceipt, web3Instance) {
    const block = await web3Instance.eth.getBlock(txReceipt.blockNumber)
    return block.timestamp
  }

  static secondsToDays(seconds) {
    return Number(seconds) / (60 * 60 * 24)
  }

  static daysToSeconds(days) {
    return Number(days) * (60 * 60 * 24)
  }

  static async assertRevert(txPromise, message = undefined) {
    try {
      const tx = await txPromise

      assert.isFalse(tx.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      if (message) {
        assert.include(err.message, message)
      }
    }
  }

  static async forceSendEth(from, receiver, value) {
    const destructible = await Destructible.new()
    await web3.eth.sendTransaction({ to: destructible.address, from, value })
    await destructible.destruct(receiver)
  }
}

TestHelper.ZERO_ADDRESS = '0x' + '0'.repeat(40)
TestHelper.maxBytes32 = '0x' + 'f'.repeat(64)
TestHelper.latestRandomSeed = 31337

module.exports = {
  TestHelper,
  MoneyValues,
  TimeValues
}
