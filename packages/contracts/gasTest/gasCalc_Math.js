const fs = require('fs')
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const CDPManagerTester = artifacts.require("./CDPManagerTester.sol")
const MathTester = artifacts.require("./MathTester.sol")

const th = testHelpers.TestHelper

const timeValues = testHelpers.TimeValues

/* Script that logs gas costs for Liquity math functions. */
contract('Gas costs for math functions', async accounts => {
  let contracts
  let cdpManagerTester
  let mathTester

  before(async () => {
    cdpManagerTester = await CDPManagerTester.new()
    CDPManagerTester.setAsDeployed(cdpManagerTester)

    mathTester = await MathTester.new()
    MathTester.setAsDeployed(mathTester)
  })

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

    gtStaking = GTContracts.gtStaking
    growthToken = GTContracts.growthToken
    communityIssuance = GTContracts.communityIssuance
    lockupContractFactory = GTContracts.lockupContractFactory

    await deploymentHelper.connectCoreContracts(contracts, GTContracts)
    await deploymentHelper.connectGTContracts(GTContracts)
    await deploymentHelper.connectGTContractsToCore(GTContracts, contracts)
  })

  // performs n runs of exponentiation on a random base
  const exponentiate = async (mathTester, baseMin, baseMax = undefined, exponent, runs) => {
    const gasCostList = []

    for (let i = 0; i < runs; i++) {
      // random number between 0 and 1 if func received a min and max
      const base = baseMax ? th.randDecayFactor(baseMin, baseMax) : baseMin

      const res = await mathTester.callDecPow(base, exponent)
      const tx = await mathTester.callDecPowTx(base, exponent)

      // Ignore results that were 0
      if (res.toString() == '0') { continue; }

      const gasUsed = th.gasUsed(tx) - 21000
      console.log(`run: ${i}. base: ${base}, exp: ${exponent}, res: ${res}, gasUsed: ${gasUsed}`)

      gasCostList.push(gasUsed)
    }

    const gasMetrics = th.getGasMetrics(gasCostList)
    return gasMetrics
  }

  // --- Vary the exponent  ---

  // Multiple calls per test with random bases show that gas costs do not vary according to base 

  it("", async () => {
    const n = 2
    const runs = 10
    const message = `exponentiation: n = ${n}, runs = ${runs}`
    const gasResults = await exponentiate(mathTester, 0.01, 0.9, n, runs)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)
  })

  it("", async () => {
    const n = 5
    const runs = 100
    const message = `exponentiation: n = ${n}, runs = ${runs}`
    const gasResults = await exponentiate(mathTester, 0.1, 0.9, n, runs)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)
  })

  it("", async () => {
    const n = 1000
    const runs = 100
    const message = `exponentiation: n = ${n}, runs = ${runs}`
    const gasResults = await exponentiate(mathTester, 0.1, 0.9, n, runs)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)
  })

  it("", async () => {
    const n = 2592000  // Seconds in 1 month 
    const runs = 100
    const message = `exponentiation: n = ${n}, runs = ${runs}`
    const gasResults = await exponentiate(mathTester, 0.9999999999, 0.999999999999999999, n, runs)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)
  })

  it("", async () => {
    const n = 43200  // Minutes in 1 month 
    const runs = 100
    const message = `exponentiation: n = ${n}, runs = ${runs}`
    const gasResults = await exponentiate(mathTester, 0.9999999999, 0.999999999999999999, n, runs)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)
  })

  // --- Vary exponent, for a given base. ---

  //(choice of base is unimportant as gas costs depend only on the exponent)

  it("", async () => {
    let dataOneMonth = []
    dataOneMonth.push(`exponentiation: exponent in units of seconds, max exponent is 30 years \n`)

    for (let n = 2; n <= timeValues.SECONDS_IN_ONE_MONTH; n += 100) {
      const runs = 1
      const message = `exponentiation: seconds n = ${n}, runs = ${runs}`
      const gasResults = await exponentiate(mathTester, 0.9999999999, 0.999999999999999999, n, runs,)

      th.logGasMetrics(gasResults, message)
      th.logAllGasCosts(gasResults)

      dataOneMonth.push(n + "," + gasResults.medianGas + '\n')
    }

    // console.log(data)

    fs.writeFile('gasTest/outputs/exponentiationCostsOneMonth.csv', dataOneMonth, (err) => {
      if (err) { console.log(err) } else {
        console.log("Gas test data written to gasTest/outputs/exponentiationCostsOneMonth.csv")
      }
    })
  })

  // --- Using the issuance factor (base) that corresponds to 50% issuance in year 1:  0.999998681227695000 ----

  it("", async () => {
    let data50Years = []
    const issuanceFactor = '999998681227695000'

    data50Years.push(`exponentiation: exponent vs gas cost: exponent in units of minutes, max exponent is 30 years \n`)

    
    for (let n = 2; n <= timeValues.MINUTES_IN_ONE_YEAR * 50; n += timeValues.MINUTES_IN_ONE_WEEK) {
      console.log(`n: ${n}`)
      const runs = 1
      const message = `exponentiation: minutes n = ${n}, runs = ${runs}`
      const gasResults = await exponentiate(mathTester, n, runs, issuanceFactor)

      th.logGasMetrics(gasResults, message)
      th.logAllGasCosts(gasResults)

      data50Years.push(n + "," + gasResults.medianGas + '\n')
    }

    fs.writeFile('gasTest/outputs/exponentiationCosts30Years.csv', data50Years, (err) => {
      if (err) { console.log(err) } else {
        console.log("Gas test data written to gasTest/outputs/exponentiationCosts30Years.csv")
      }
    })
  })


})

