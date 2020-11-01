const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")
const CommunityIssuanceTester = artifacts.require("./CommunityIssuanceTester.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec

contract('Fee arithmetic tests', async accounts => {
  let contracts
  let cdpManagerTester
  let mathTester
  let communityIssuanceTester

  before(async () => {

  })

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    const GTContracts = await deploymentHelper.deployGTTesterContractsBuidler()

    priceFeed = contracts.priceFeed
    clvToken = contracts.clvToken
    poolManager = contracts.poolManager
    sortedCDPs = contracts.sortedCDPs
    cdpManager = contracts.cdpManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    gtStaking = GTContracts.gtStaking
    growthToken = GTContracts.growthToken
    communityIssuanceTester = GTContracts.communityIssuance
    lockupContractFactory = GTContracts.lockupContractFactory

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

  Total issuance year 1: 50%, year 2: 75%, year 3:   0.875, etc   ---*/

  it.only("Cumulative issuance fraction is 0.0000013 after a minute", async () => {
    // Set the deployment time to now
    await communityIssuanceTester.setDeploymentTime()

    console.log(`supply cap: ${await communityIssuanceTester.supplyCap()}`)

    const initialIssuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    assert.equal(initialIssuanceFraction, 0)

    const duration = timeValues.SECONDS_IN_ONE_MINUTE
    // Fast forward time
    await th.fastForwardTime(duration, web3.currentProvider)

    const issuanceFraction = await communityIssuanceTester.getCumulativeIssuanceFraction()
    const expectedIssuanceFraction = '1318772305025'

    const absError = th.toBN(expectedIssuanceFraction).sub(issuanceFraction)
    console.log(
      `time since deployment: ${duration}, 
       issuanceFraction: ${issuanceFraction},  
       expectedIssuanceFraction: ${expectedIssuanceFraction},
       abs. error: ${absError}`
    )

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
    console.log(
      `time since deployment: ${duration}, 
       issuanceFraction: ${issuanceFraction},  
       expectedIssuanceFraction: ${expectedIssuanceFraction},
       abs. error: ${absError}`
    )

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
    console.log(
      `time since deployment: ${duration}, 
       issuanceFraction: ${issuanceFraction},  
       expectedIssuanceFraction: ${expectedIssuanceFraction},
       abs. error: ${absError}`
    )

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
    console.log(
      `time since deployment: ${duration}, 
       issuanceFraction: ${issuanceFraction},  
       expectedIssuanceFraction: ${expectedIssuanceFraction},
       abs. error: ${absError}`
    )

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
    console.log(
      `time since deployment: ${duration}, 
       issuanceFraction: ${issuanceFraction},  
       expectedIssuanceFraction: ${expectedIssuanceFraction},
       abs. error: ${absError}`
    )

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
    console.log(
      `time since deployment: ${duration}, 
       issuanceFraction: ${issuanceFraction},  
       expectedIssuanceFraction: ${expectedIssuanceFraction},
       abs. error: ${absError}`
    )

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
    console.log(
      `time since deployment: ${duration}, 
       issuanceFraction: ${issuanceFraction},  
       expectedIssuanceFraction: ${expectedIssuanceFraction},
       abs. error: ${absError}`
    )

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
    console.log(
      `time since deployment: ${duration}, 
       issuanceFraction: ${issuanceFraction},  
       expectedIssuanceFraction: ${expectedIssuanceFraction},
       abs. error: ${absError}`
    )

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
    console.log(
      `time since deployment: ${duration}, 
       issuanceFraction: ${issuanceFraction},  
       expectedIssuanceFraction: ${expectedIssuanceFraction},
       abs. error: ${absError}`
    )

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
    console.log(
      `time since deployment: ${duration}, 
       issuanceFraction: ${issuanceFraction},  
       expectedIssuanceFraction: ${expectedIssuanceFraction},
       abs. error: ${absError}`
    )

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
    console.log(
      `time since deployment: ${duration}, 
       issuanceFraction: ${issuanceFraction},  
       expectedIssuanceFraction: ${expectedIssuanceFraction},
       abs. error: ${absError}`
    )

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
    console.log(
      `time since deployment: ${duration}, 
       issuanceFraction: ${issuanceFraction},  
       expectedIssuanceFraction: ${expectedIssuanceFraction},
       abs. error: ${absError}`
    )

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
    console.log(
      `time since deployment: ${duration}, 
       issuanceFraction: ${issuanceFraction},  
       expectedIssuanceFraction: ${expectedIssuanceFraction},
       abs. error: ${absError}`
    )

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
    console.log(
      `time since deployment: ${duration}, 
       issuanceFraction: ${issuanceFraction},  
       expectedIssuanceFraction: ${expectedIssuanceFraction},
       abs. error: ${absError}`
    )

    assert.isAtMost(th.getDifference(issuanceFraction, expectedIssuanceFraction), 1000000000)
  })

  // --- Token issuance for yearly halving ---
  // TODO:  PASTE IN CORRECT VALS FROM SHEET, call issueLQTY() in each, and fix first test where block.timestamp
  // probably messing it up

  it.only("Total LQTY tokens issued is 43.96 after a minute", async () => {
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
    console.log(
      `time since deployment: ${duration}, 
       totalLQTYIssued: ${totalLQTYIssued},  
       expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
       abs. error: ${absError}`
    )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 100000000)
  })

  it.only("total LQTY tokens issued is 2637.44 after an hour", async () => {
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
    console.log(
      `time since deployment: ${duration}, 
       totalLQTYIssued: ${totalLQTYIssued},  
       expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
       abs. error: ${absError}`
    )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 100000000)
  })

  it.only("Total LQTY tokens issued is 63241.04 after a day", async () => {
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
    console.log(
      `time since deployment: ${duration}, 
       totalLQTYIssued: ${totalLQTYIssued},  
       expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
       abs. error: ${absError}`
    )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 100000000)
  })
  
  it.only("Total LQTY tokens issued is 440175.62 after a week", async () => {
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
    console.log(
      `time since deployment: ${duration}, 
       totalLQTYIssued: ${totalLQTYIssued},  
       expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
       abs. error: ${absError}`
    )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 100000000)
  })

  it.only("Total LQTY tokens issued is 1845951.27 after a month", async () => {
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
    console.log(
      `time since deployment: ${duration}, 
       totalLQTYIssued: ${totalLQTYIssued},  
       expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
       abs. error: ${absError}`
    )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 100000000)
  })

  it.only("Total LQTY tokens issued is 5236836.69 after 3 months", async () => {
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
    console.log(
      `time since deployment: ${duration}, 
       totalLQTYIssued: ${totalLQTYIssued},  
       expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
       abs. error: ${absError}`
    )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 100000000)
  })

  it.only("Total LQTY tokens issued is 9650939.63 after 6 months", async () => {
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
    const expectedTotalLQTYIssued = '9650939.627392200000000000'

    const absError = th.toBN(expectedTotalLQTYIssued).sub(totalLQTYIssued)
    console.log(
      `time since deployment: ${duration}, 
       totalLQTYIssued: ${totalLQTYIssued},  
       expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
       abs. error: ${absError}`
    )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 100000000)
  })

  it.only("Total LQTY tokens issued is 16666666.67 after a year", async () => {
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
    console.log(
      `time since deployment: ${duration}, 
       totalLQTYIssued: ${totalLQTYIssued},  
       expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
       abs. error: ${absError}`
    )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 100000000)
  })

  it.only("Total LQTY tokens issued is 25000000 after 2 years", async () => {
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
    console.log(
      `time since deployment: ${duration}, 
       totalLQTYIssued: ${totalLQTYIssued},  
       expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
       abs. error: ${absError}`
    )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 100000000)
  })

  it.only("Total LQTY tokens issued is 29166666.666666666666666666 after 3 years", async () => {
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
    console.log(
      `time since deployment: ${duration}, 
       totalLQTYIssued: ${totalLQTYIssued},  
       expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
       abs. error: ${absError}`
    )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 100000000)
  })

  it.only("Total LQTY tokens issued is 31250000 after 4 years", async () => {
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
    console.log(
      `time since deployment: ${duration}, 
       totalLQTYIssued: ${totalLQTYIssued},  
       expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
       abs. error: ${absError}`
    )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 100000000)
  })

  it.only("Total LQTY tokens issued is 33300781.25 after 10 years", async () => {
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
    console.log(
      `time since deployment: ${duration}, 
       totalLQTYIssued: ${totalLQTYIssued},  
       expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
       abs. error: ${absError}`
    )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 100000000)
  })

  it.only("Total LQTY tokens issued is 33333301.54 after 20 years", async () => {
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
    console.log(
      `time since deployment: ${duration}, 
       totalLQTYIssued: ${totalLQTYIssued},  
       expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
       abs. error: ${absError}`
    )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 100000000)
  })

  it.only("Total LQTY tokens issued is 33333333.30 after 30 years", async () => {
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
    console.log(
      `time since deployment: ${duration}, 
       totalLQTYIssued: ${totalLQTYIssued},  
       expectedTotalLQTYIssued: ${expectedTotalLQTYIssued},
       abs. error: ${absError}`
    )

    assert.isAtMost(th.getDifference(totalLQTYIssued, expectedTotalLQTYIssued), 100000000)
  })






  // limits:

  // Error in single LQTY issuance

  // Assumes a "halving" year-on-year issuance schedule.

  // 1 minute in first week


})