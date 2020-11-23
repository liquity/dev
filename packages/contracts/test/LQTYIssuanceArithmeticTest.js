const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")
const StabilityPool = artifacts.require("./StabilityPool.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec


const logLQTYBalanceAndError = (LQTYBalance_A, expectedLQTYBalance_A) => {
  console.log(
    `Expected final balance: ${expectedLQTYBalance_A}, \n
    Actual final balance: ${LQTYBalance_A}, \n
    Abs. error: ${expectedLQTYBalance_A.sub(LQTYBalance_A)}`
  )
}

const repeatedlyIssueLQTY = async (stabilityPool, timeBetweenIssuances, duration) => {
  const startTimestamp = th.toBN(await th.getLatestBlockTimestamp(web3))
  let timePassed = 0

  // while current time < 1 month from deployment, issue LQTY every minute
  while (timePassed < duration) {
    // console.log(`timePassed: ${timePassed}`)
    await th.fastForwardTime(timeBetweenIssuances, web3.currentProvider)
    await stabilityPool._unprotectedTriggerLQTYIssuance()

    const currentTimestamp = th.toBN(await th.getLatestBlockTimestamp(web3))
    timePassed = currentTimestamp.sub(startTimestamp)
  }
}


contract('LQTY community issuance arithmetic tests', async accounts => {
  let contracts
  let borrowerOperations
  let communityIssuanceTester
  let growthToken
  let stabilityPool

  const [owner, alice, frontEnd_1] = accounts;

  before(async () => {

  })

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    const GTContracts = await deploymentHelper.deployGTTesterContractsBuidler()
    contracts.stabilityPool = await StabilityPool.new()
    contracts = await deploymentHelper.deployCLVToken(contracts)

    stabilityPool = contracts.stabilityPool
    borrowerOperations = contracts.borrowerOperations

    growthToken = GTContracts.growthToken
    communityIssuanceTester = GTContracts.communityIssuance

    await deploymentHelper.connectGTContracts(GTContracts)
    await deploymentHelper.connectCoreContracts(contracts, GTContracts)
    await deploymentHelper.connectGTContractsToCore(GTContracts, contracts)
  })

  // Accuracy tests
  it("getCumulativeIssuanceFraction(): fraction doesn't increase if less than a minute has passed", async () => {
    const issuanceFractionBefore = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const blockTimestampBefore = th.toBN(await th.getLatestBlockTimestamp(web3))

    // progress time 10 seconds
    await th.fastForwardTime(10, web3.currentProvider)

    const issuanceFractionAfter = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const blockTimestampAfter = th.toBN(await th.getLatestBlockTimestamp(web3))

    const timestampDiff = blockTimestampAfter.sub(blockTimestampBefore)
    // check blockTimestamp diff < 60s
    assert.isTrue(timestampDiff.lt(th.toBN(60)))

    assert.isTrue(issuanceFractionBefore.eq(issuanceFractionAfter))
  })

  /*--- Issuance tests for "Yearly halving" schedule.

  Total issuance year 1: 50%, year 2: 75%, year 3:   0.875, etc   
  
  Error tolerance: 1e-9
  
  ---*/

  it("Cumulative issuance fraction is 0.0000013 after a minute", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    // console.log(`supply cap: ${await communityIssuanceTester.LQTYSupplyCap()}`)

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = timeValues.SECONDS_IN_ONE_MINUTE
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '1318772305025'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 100000000)
  })

  it("Cumulative issuance fraction is 0.000079 after an hour", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = timeValues.SECONDS_IN_ONE_HOUR
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '79123260066094'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.0019 after a day", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = timeValues.SECONDS_IN_ONE_DAY
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '1897231348441660'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.013 after a week", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = timeValues.SECONDS_IN_ONE_WEEK
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '13205268780628400'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.055 after a month", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = timeValues.SECONDS_IN_ONE_MONTH
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '55378538087966600'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.16 after 3 months", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = timeValues.SECONDS_IN_ONE_MONTH * 3
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '157105100752037000'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.29 after 6 months", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = timeValues.SECONDS_IN_ONE_MONTH * 6
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = 289528188821766000

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.5 after a year", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = timeValues.SECONDS_IN_ONE_YEAR
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = dec(5, 17)

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.75 after 2 years", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = timeValues.SECONDS_IN_ONE_YEAR * 2
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = dec(75, 16)

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.875 after 3 years", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = timeValues.SECONDS_IN_ONE_YEAR * 3
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = dec(875, 15)

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.9375 after 4 years", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = timeValues.SECONDS_IN_ONE_YEAR * 4
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '937500000000000000'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.999 after 10 years", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = timeValues.SECONDS_IN_ONE_YEAR * 10
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '999023437500000000'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.999999 after 20 years", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = timeValues.SECONDS_IN_ONE_YEAR * 20
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '999999046325684000'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  it("Cumulative issuance fraction is 0.999999999 after 30 years", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = timeValues.SECONDS_IN_ONE_YEAR * 30
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '999999999068677000'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    issuanceFraction: ${issuanceFraction},  
    //    expectedIssuanceFraction: ${expectedIssuanceFraction},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  // --- Token issuance for yearly halving ---

  //  Error tolerance: 1e-3, i.e. 1/1000th of a token

  it("Total LQTY tokens issued is 43.96 after a minute", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = timeValues.SECONDS_IN_ONE_MINUTE
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '43959076834188000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("total LQTY tokens issued is 2637.44 after an hour", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)


    const duration = timeValues.SECONDS_IN_ONE_HOUR
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '2637442002203140000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 63241.04 after a day", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)


    const duration = timeValues.SECONDS_IN_ONE_DAY
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '63241044948055500000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 440175.62 after a week", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)


    const duration = timeValues.SECONDS_IN_ONE_WEEK
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '440175626020948000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 1845951.27 after a month", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)


    const duration = timeValues.SECONDS_IN_ONE_MONTH
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '1845951269598890000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 5236836.69 after 3 months", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = timeValues.SECONDS_IN_ONE_MONTH * 3
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '5236836691734560000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000100000000000000000000)
  })

  it("Total LQTY tokens issued is 9650939.63 after 6 months", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = timeValues.SECONDS_IN_ONE_MONTH * 6
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '9650939627392200000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 16666666.67 after a year", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = timeValues.SECONDS_IN_ONE_YEAR
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '16666666666666666666666666'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 25000000 after 2 years", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = timeValues.SECONDS_IN_ONE_YEAR * 2
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '25000000000000000000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 29166666.666666666666666666 after 3 years", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = timeValues.SECONDS_IN_ONE_YEAR * 3
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '29166666666666666666666666'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 31250000 after 4 years", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = timeValues.SECONDS_IN_ONE_YEAR * 4
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '31250000000000000000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 33300781.25 after 10 years", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = timeValues.SECONDS_IN_ONE_YEAR * 10
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '33300781250000000000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 33333301.54 after 20 years", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = timeValues.SECONDS_IN_ONE_YEAR * 20
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '33333301544189400000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 33333333.30 after 30 years", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = timeValues.SECONDS_IN_ONE_YEAR * 30
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '33333333302289200000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  /* ---  
  Accumulated issuance error: how many tokens are lost over a given period, for a given issuance frequency? 
  
  Slow tests are skipped.
  --- */

  it.skip("Frequent token issuance: issuance event every year, for 30 years", async () => {
    // Register front end with kickback rate = 100%
    await stabilityPool.registerFrontEnd(dec(1, 18), { from: frontEnd_1 })

    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()
    // Alice opens loan and deposits to SP
    await borrowerOperations.openLoan(dec(1, 18), alice, { from: alice, value: dec(1, 'ether') })
    await stabilityPool.provideToSP(dec(1, 18), frontEnd_1, { from: alice })

    assert.isTrue(await stabilityPool.isEligibleForLQTY(alice))

    const timeBetweenIssuances = timeValues.SECONDS_IN_ONE_YEAR
    const duration = timeValues.SECONDS_IN_ONE_YEAR * 30

    await repeatedlyIssueLQTY(stabilityPool, timeBetweenIssuances, duration)

    // Depositor withdraws their deposit and accumulated LQTY
    await stabilityPool.withdrawFromSP(dec(1, 18), { from: alice })

    const LQTYBalance_A = await growthToken.balanceOf(alice)
    const expectedLQTYBalance_A = th.toBN('33333333302289200000000000')
    const diff = expectedLQTYBalance_A.sub(LQTYBalance_A)

    // logLQTYBalanceAndError(LQTYBalance_A, expectedLQTYBalance_A)

    // Check the actual balance differs by no more than 1e18 (i.e. 1 token) from the expected balance
    assert.isTrue(diff.lte(th.toBN(dec(1, 18))))
  })
  /*  Results:
  
  Expected final balance: 33333333302289200000000000,
  Actual final balance: 33333333302289247499999999,
  Abs. error: -47499999999 */


  it.skip("Frequent token issuance: issuance event every day, for 30 years", async () => {
    // Register front end with kickback rate = 100%
    await stabilityPool.registerFrontEnd(dec(1, 18), { from: frontEnd_1 })

    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()
    // Alice opens loan and deposits to SP
    await borrowerOperations.openLoan(dec(1, 18), alice, { from: alice, value: dec(1, 'ether') })
    await stabilityPool.provideToSP(dec(1, 18), frontEnd_1, { from: alice })

    assert.isTrue(await stabilityPool.isEligibleForLQTY(alice))

    const timeBetweenIssuances = timeValues.SECONDS_IN_ONE_DAY
    const duration = timeValues.SECONDS_IN_ONE_YEAR * 30

    await repeatedlyIssueLQTY(stabilityPool, timeBetweenIssuances, duration)

    // Depositor withdraws their deposit and accumulated LQTY
    await stabilityPool.withdrawFromSP(dec(1, 18), { from: alice })

    const LQTYBalance_A = await growthToken.balanceOf(alice)
    const expectedLQTYBalance_A = th.toBN('33333333302289200000000000')
    const diff = expectedLQTYBalance_A.sub(LQTYBalance_A)

    // logLQTYBalanceAndError(LQTYBalance_A, expectedLQTYBalance_A)

    // Check the actual balance differs by no more than 1e18 (i.e. 1 token) from the expected balance
    assert.isTrue(diff.lte(th.toBN(dec(1, 18))))
  })
  /* Results:

  Expected final balance: 33333333302289200000000000,
  Actual final balance: 33333333302297188866666666,
  Abs. error: -7988866666666  */

  it.skip("Frequent token issuance: issuance event every minute, for 1 month", async () => {
    // Register front end with kickback rate = 100%
    await stabilityPool.registerFrontEnd(dec(1, 18), { from: frontEnd_1 })

    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()
    // Alice opens loan and deposits to SP
    await borrowerOperations.openLoan(dec(1, 18), alice, { from: alice, value: dec(1, 'ether') })
    await stabilityPool.provideToSP(dec(1, 18), frontEnd_1, { from: alice })

    assert.isTrue(await stabilityPool.isEligibleForLQTY(alice))

    const timeBetweenIssuances = timeValues.SECONDS_IN_ONE_MINUTE
    const duration = timeValues.SECONDS_IN_ONE_MONTH

    await repeatedlyIssueLQTY(stabilityPool, timeBetweenIssuances, duration)

    // Depositor withdraws their deposit and accumulated LQTY
    await stabilityPool.withdrawFromSP(dec(1, 18), { from: alice })

    const LQTYBalance_A = await growthToken.balanceOf(alice)
    const expectedLQTYBalance_A = th.toBN('1845951269598880000000000')
    const diff = expectedLQTYBalance_A.sub(LQTYBalance_A)

    // logLQTYBalanceAndError(LQTYBalance_A, expectedLQTYBalance_A)

    // Check the actual balance differs by no more than 1e18 (i.e. 1 token) from the expected balance
    assert.isTrue(diff.lte(th.toBN(dec(1, 18))))
  })
  /* Results:

  Expected final balance: 1845951269598880000000000,
  Actual final balance: 1845951269564420199999999,
  Abs. error: 34459800000001
  */

  it.skip("Frequent token issuance: issuance event every minute, for 1 year", async () => {
    // Register front end with kickback rate = 100%
    await stabilityPool.registerFrontEnd(dec(1, 18), { from: frontEnd_1 })

    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()
    // Alice opens loan and deposits to SP
    await borrowerOperations.openLoan(dec(1, 18), alice, { from: alice, value: dec(1, 'ether') })
    await stabilityPool.provideToSP(dec(1, 18), frontEnd_1, { from: alice })

    assert.isTrue(await stabilityPool.isEligibleForLQTY(alice))

    const timeBetweenIssuances = timeValues.SECONDS_IN_ONE_MINUTE
    const duration = timeValues.SECONDS_IN_ONE_YEAR

    await repeatedlyIssueLQTY(stabilityPool, timeBetweenIssuances, duration)

    // Depositor withdraws their deposit and accumulated LQTY
    await stabilityPool.withdrawFromSP(dec(1, 18), { from: alice })

    const LQTYBalance_A = await growthToken.balanceOf(alice)
    const expectedLQTYBalance_A = th.toBN('1845951269598880000000000')
    const diff = expectedLQTYBalance_A.sub(LQTYBalance_A)

    // logLQTYBalanceAndError(LQTYBalance_A, expectedLQTYBalance_A)

    // Check the actual balance differs by no more than 1e18 (i.e. 1 token) from the expected balance
    assert.isTrue(diff.lte(th.toBN(dec(1, 18))))
  })
})
