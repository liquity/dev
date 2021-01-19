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
  let lqtyToken
  let stabilityPool

  const [owner, alice, frontEnd_1] = accounts;

  const bountyAddress = accounts[998]
  const lpRewardsAddress = accounts[999]

  before(async () => {

  })

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    const LQTYContracts = await deploymentHelper.deployLQTYTesterContractsHardhat(bountyAddress, lpRewardsAddress)
    contracts.stabilityPool = await StabilityPool.new()
    contracts = await deploymentHelper.deployLUSDToken(contracts)

    stabilityPool = contracts.stabilityPool
    borrowerOperations = contracts.borrowerOperations

    lqtyToken = LQTYContracts.lqtyToken
    communityIssuanceTester = LQTYContracts.communityIssuance

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
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

  // using the result of this to advance time by the desired amount from the deployment time, whether or not some extra time has passed in the meanwhile
  const getDuration = async (expectedDuration) => {
    const deploymentTime = (await communityIssuanceTester.deploymentTime()).toNumber()
    const currentTime = await th.getLatestBlockTimestamp(web3)
    const duration = Math.max(expectedDuration - (currentTime - deploymentTime), 0)

    return duration
  }

  it("Cumulative issuance fraction is 0.0000013 after a minute", async () => {
    // console.log(`supply cap: ${await communityIssuanceTester.LQTYSupplyCap()}`)

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MINUTE)

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
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_HOUR)
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
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_DAY)
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
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_WEEK)
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
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MONTH)
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
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MONTH * 3)
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
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MONTH * 6)
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
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR)
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
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 2)
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
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 3)
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
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 4)
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
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 10)
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
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 20)
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
    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 30)
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

   // Error tolerance: 1e-3, i.e. 1/1000th of a token

  it("Total LQTY tokens issued is 32.97 after a minute", async () => {
    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MINUTE)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '32969307625641000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 1978.08 after an hour", async () => {
    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)


    const duration = await getDuration(timeValues.SECONDS_IN_ONE_HOUR)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '1978081501652350000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 47430.78 after a day", async () => {
    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)


    const duration = await getDuration(timeValues.SECONDS_IN_ONE_DAY)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '47430783711041600000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 330131.72 after a week", async () => {
    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)


    const duration = await getDuration(timeValues.SECONDS_IN_ONE_WEEK)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '330131719515711000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 1384463.45 after a month", async () => {
    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)


    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MONTH)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '1384463452199160000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 3927627.52 after 3 months", async () => {
    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MONTH * 3)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '3927627518800920000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 7238204.72 after 6 months", async () => {
    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MONTH * 6)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '7238204720544150000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 12500000 after a year", async () => {
    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '12500000000000000000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 18750000 after 2 years", async () => {
    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 2)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '18750000000000000000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 21875000 after 3 years", async () => {
    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 3)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '21875000000000000000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 23437500 after 4 years", async () => {
    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 4)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '23437500000000000000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 24975585.98 after 10 years", async () => {
    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 10)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '24975585937500000000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 24999976.16 after 20 years", async () => {
    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 20)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '24999976158142100000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    // console.log(
    //   `time since deployment: ${duration}, 
    //    totalLQTYIssued: ${totalLQTYIssued},  
    //    expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
    //    abs. error: ${absError}`
    // )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 1000000000000000)
  })

  it("Total LQTY tokens issued is 24999999.98 after 30 years", async () => {
    const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
    assert.equal(initialIssuance, 0)

    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 30)
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    // Issue LQTY
    await communityIssuanceTester.unprotectedIssueLQTY()
    const totalLQTYIssued = await communityIssuanceTester.totalLQTYIssued()
    const expectedTotalLQTYIssued = '24999999976716900000000000'

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

  // TODO: Convert to 25mil issuance schedule
  it.skip("Frequent token issuance: issuance event every year, for 30 years", async () => {
    // Register front end with kickback rate = 100%
    await stabilityPool.registerFrontEnd(dec(1, 18), { from: frontEnd_1 })

    // Alice opens trove and deposits to SP
    await borrowerOperations.openTrove(dec(1, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    await stabilityPool.provideToSP(dec(1, 18), frontEnd_1, { from: alice })

    assert.isTrue(await stabilityPool.isEligibleForLQTY(alice))

    const timeBetweenIssuances = timeValues.SECONDS_IN_ONE_YEAR
    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 30)

    await repeatedlyIssueLQTY(stabilityPool, timeBetweenIssuances, duration)

    // Depositor withdraws their deposit and accumulated LQTY
    await stabilityPool.withdrawFromSP(dec(1, 18), { from: alice })

    const LQTYBalance_A = await lqtyToken.balanceOf(alice)
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


    // TODO: Convert to 25mil issuance schedule
  it.skip("Frequent token issuance: issuance event every day, for 30 years", async () => {
    // Register front end with kickback rate = 100%
    await stabilityPool.registerFrontEnd(dec(1, 18), { from: frontEnd_1 })

    // Alice opens trove and deposits to SP
    await borrowerOperations.openTrove(dec(1, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    await stabilityPool.provideToSP(dec(1, 18), frontEnd_1, { from: alice })

    assert.isTrue(await stabilityPool.isEligibleForLQTY(alice))

    const timeBetweenIssuances = timeValues.SECONDS_IN_ONE_DAY
    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR * 30)

    await repeatedlyIssueLQTY(stabilityPool, timeBetweenIssuances, duration)

    // Depositor withdraws their deposit and accumulated LQTY
    await stabilityPool.withdrawFromSP(dec(1, 18), { from: alice })

    const LQTYBalance_A = await lqtyToken.balanceOf(alice)
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

  // TODO: Convert to 25mil issuance schedule
  it.skip("Frequent token issuance: issuance event every minute, for 1 month", async () => {
    // Register front end with kickback rate = 100%
    await stabilityPool.registerFrontEnd(dec(1, 18), { from: frontEnd_1 })

    // Alice opens trove and deposits to SP
    await borrowerOperations.openTrove(dec(1, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    await stabilityPool.provideToSP(dec(1, 18), frontEnd_1, { from: alice })

    assert.isTrue(await stabilityPool.isEligibleForLQTY(alice))

    const timeBetweenIssuances = timeValues.SECONDS_IN_ONE_MINUTE
    const duration = await getDuration(timeValues.SECONDS_IN_ONE_MONTH)

    await repeatedlyIssueLQTY(stabilityPool, timeBetweenIssuances, duration)

    // Depositor withdraws their deposit and accumulated LQTY
    await stabilityPool.withdrawFromSP(dec(1, 18), { from: alice })

    const LQTYBalance_A = await lqtyToken.balanceOf(alice)
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

  // TODO: Convert to 25mil issuance schedule
  it.skip("Frequent token issuance: issuance event every minute, for 1 year", async () => {
    // Register front end with kickback rate = 100%
    await stabilityPool.registerFrontEnd(dec(1, 18), { from: frontEnd_1 })

    // Alice opens trove and deposits to SP
    await borrowerOperations.openTrove(dec(1, 18), alice, alice, { from: alice, value: dec(1, 'ether') })
    await stabilityPool.provideToSP(dec(1, 18), frontEnd_1, { from: alice })

    assert.isTrue(await stabilityPool.isEligibleForLQTY(alice))

    const timeBetweenIssuances = timeValues.SECONDS_IN_ONE_MINUTE
    const duration = await getDuration(timeValues.SECONDS_IN_ONE_YEAR)

    await repeatedlyIssueLQTY(stabilityPool, timeBetweenIssuances, duration)

    // Depositor withdraws their deposit and accumulated LQTY
    await stabilityPool.withdrawFromSP(dec(1, 18), { from: alice })

    const LQTYBalance_A = await lqtyToken.balanceOf(alice)
    const expectedLQTYBalance_A = th.toBN('1845951269598880000000000')
    const diff = expectedLQTYBalance_A.sub(LQTYBalance_A)

    // logLQTYBalanceAndError(LQTYBalance_A, expectedLQTYBalance_A)

    // Check the actual balance differs by no more than 1e18 (i.e. 1 token) from the expected balance
    assert.isTrue(diff.lte(th.toBN(dec(1, 18))))
  })
})
