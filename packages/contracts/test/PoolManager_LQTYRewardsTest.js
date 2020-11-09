const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const CDPManagerTester = artifacts.require("./CDPManagerTester.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const toBN = th.toBN
const getDifference = th.getDifference

contract('PoolManager - LQTY Rewards', async accounts => {

  const [
    owner,
    whale,
    A, B, C, D, E, F, G, H,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4
  ] = accounts;

  let contracts

  let priceFeed
  let clvToken
  let poolManager
  let cdpManager
  let borrowerOperations
  let communityIssuanceTester

  let communityLQTYSupply

  const ZERO_ADDRESS = th.ZERO_ADDRESS

  describe("LQTY Rewards", async () => {

    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      const GTContracts = await deploymentHelper.deployGTTesterContractsBuidler()
      contracts.cdpManager = await CDPManagerTester.new()
      communityIssuanceTester = GTContracts.communityIssuance

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

      lqtyStaking = GTContracts.lqtyStaking
      growthToken = GTContracts.growthToken
      lockupContractFactory = GTContracts.lockupContractFactory

      await deploymentHelper.connectGTContracts(GTContracts)
      await deploymentHelper.connectCoreContracts(contracts, GTContracts)
      await deploymentHelper.connectGTContractsToCore(GTContracts, contracts)

      // Check community issuance starts with 33.333... million LQTY
      communityLQTYSupply = toBN(await growthToken.balanceOf(communityIssuanceTester.address))
      assert.isAtMost(getDifference(communityLQTYSupply, '33333333333333333333333333'), 1000)
    })

    // Simple case: 3 depositors, equal stake. No liquidations. No front-end.
    it("withdrawFromSP(): Depositors with equal initial deposit withdraw correct LQTY gain. No liquidations. No front end.", async () => {
      // Set the deployment time to now
      await communityIssuanceTester.setDeploymentTime()

      const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
      assert.equal(initialIssuance, 0)

      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(100, 18), B, { from: B, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(100, 18), C, { from: C, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(1, 18), D, { from: D, value: dec(1, 'ether') })

      // Check all LQTY balances are initially 0
      assert.equal(await growthToken.balanceOf(A), 0)
      assert.equal(await growthToken.balanceOf(B), 0)
      assert.equal(await growthToken.balanceOf(C), 0)

      // A, B, C deposit
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: A })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: C })

      // One year passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // D deposits, triggering LQTY gains for A,B,C. Withdraws immediately after
      await poolManager.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: D })
      await poolManager.withdrawFromSP(dec(1, 18), { from: D })

      // Expected gains for each depositor after 1 year (50% total issued).  Each deposit gets 1/3 of issuance.
      const expectedLQTYGain_1yr = communityLQTYSupply.div(toBN('2')).div(toBN('3'))

      // Check LQTY gain
      const A_LQTYGain_1yr = await poolManager.getDepositorLQTYGain(A)
      const B_LQTYGain_1yr = await poolManager.getDepositorLQTYGain(B)
      const C_LQTYGain_1yr = await poolManager.getDepositorLQTYGain(C)

      // Check gains are correct, error tolerance = 1e-6 of a token

      console.log(`expectedLQTYGain_1yr: ${expectedLQTYGain_1yr}`)
      console.log(`A_LQTYGain_1yr: ${A_LQTYGain_1yr}`)
      assert.isAtMost(getDifference(A_LQTYGain_1yr, expectedLQTYGain_1yr), 1000000000000)
      assert.isAtMost(getDifference(B_LQTYGain_1yr, expectedLQTYGain_1yr), 1000000000000)
      assert.isAtMost(getDifference(C_LQTYGain_1yr, expectedLQTYGain_1yr), 1000000000000)

      // Another year passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // D deposits, triggering LQTY gains for A,B,C. Withdraws immediately after
      await poolManager.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: D })
      await poolManager.withdrawFromSP(dec(1, 18), { from: D })

      // Expected gains for each depositor after 2 years (75% total issued).  Each deposit gets 1/3 of issuance.
      const expectedLQTYGain_2yr = communityLQTYSupply.mul(toBN('3')).div(toBN('4')).div(toBN('3'))

      // Check LQTY gain
      const A_LQTYGain_2yr = await poolManager.getDepositorLQTYGain(A)
      const B_LQTYGain_2yr = await poolManager.getDepositorLQTYGain(B)
      const C_LQTYGain_2yr = await poolManager.getDepositorLQTYGain(C)

      // Check gains are correct, error tolerance = 1e-6 of a token
      assert.isAtMost(getDifference(A_LQTYGain_2yr, expectedLQTYGain_2yr), 1000000000000)
      assert.isAtMost(getDifference(B_LQTYGain_2yr, expectedLQTYGain_2yr), 1000000000000)
      assert.isAtMost(getDifference(C_LQTYGain_2yr, expectedLQTYGain_2yr), 1000000000000)

      // Each depositor fully withdraws
      await poolManager.withdrawFromSP(dec(100, 18), { from: A })
      await poolManager.withdrawFromSP(dec(100, 18), { from: B })
      await poolManager.withdrawFromSP(dec(100, 18), { from: C })

      // Check LQTY balances increase by correct amount
      assert.isAtMost(getDifference((await growthToken.balanceOf(A)), expectedLQTYGain_2yr), 1000000000000)
      assert.isAtMost(getDifference((await growthToken.balanceOf(B)), expectedLQTYGain_2yr), 1000000000000)
      assert.isAtMost(getDifference((await growthToken.balanceOf(C)), expectedLQTYGain_2yr), 1000000000000)
    })

    // 3 depositors, varied stake. No liquidations. No front-end.
    it("withdrawFromSP(): Depositors with varying initial deposit withdraw correct LQTY gain. No liquidations. No front end.", async () => {
      // Set the deployment time to now
      await communityIssuanceTester.setDeploymentTime()

      const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
      assert.equal(initialIssuance, 0)

      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(3, 'ether') })
      await borrowerOperations.openLoan(dec(1, 18), D, { from: D, value: dec(1, 'ether') })

      // Check all LQTY balances are initially 0
      assert.equal(await growthToken.balanceOf(A), 0)
      assert.equal(await growthToken.balanceOf(B), 0)
      assert.equal(await growthToken.balanceOf(C), 0)

      // A, B, C deposit
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: A })
      await poolManager.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: B })
      await poolManager.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: C })

      // One year passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // D deposits, triggering LQTY gains for A,B,C. Withdraws immediately after
      await poolManager.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: D })
      await poolManager.withdrawFromSP(dec(1, 18), { from: D })

      // Expected gains for each depositor after 1 year (50% total issued)
      const A_expectedLQTYGain_1yr = communityLQTYSupply
        .div(toBN('2')) // 50% of total issued after 1 year
        .div(toBN('6'))  // A gets 1/6 of the issuance

      const B_expectedLQTYGain_1yr = communityLQTYSupply
        .div(toBN('2')) // 50% of total issued after 1 year
        .div(toBN('3'))  // B gets 2/6 = 1/3 of the issuance

      const C_expectedLQTYGain_1yr = communityLQTYSupply
        .div(toBN('2')) // 50% of total issued after 1 year
        .div(toBN('2'))  // C gets 3/6 = 1/2 of the issuance

      // Check LQTY gain
      const A_LQTYGain_1yr = await poolManager.getDepositorLQTYGain(A)
      const B_LQTYGain_1yr = await poolManager.getDepositorLQTYGain(B)
      const C_LQTYGain_1yr = await poolManager.getDepositorLQTYGain(C)


      console.log(`A_expectedLQTYGain_1yr: ${A_expectedLQTYGain_1yr}`)
      console.log(`A_LQTYGain_1yr: ${A_LQTYGain_1yr}`)
      console.log(`B_expectedLQTYGain_1yr: ${B_expectedLQTYGain_1yr}`)
      console.log(`B_LQTYGain_1yr: ${B_LQTYGain_1yr}`)
      console.log(`C_expectedLQTYGain_1yr: ${C_expectedLQTYGain_1yr}`)
      console.log(`C_LQTYGain_1yr: ${C_LQTYGain_1yr}`)

      // Check gains are correct, error tolerance = 1e-6 of a toke
      assert.isAtMost(getDifference(A_LQTYGain_1yr, A_expectedLQTYGain_1yr), 1000000000000)
      assert.isAtMost(getDifference(B_LQTYGain_1yr, B_expectedLQTYGain_1yr), 1000000000000)
      assert.isAtMost(getDifference(C_LQTYGain_1yr, C_expectedLQTYGain_1yr), 1000000000000)

      // Another year passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // D deposits, triggering LQTY gains for A,B,C. Withdraws immediately after
      await poolManager.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: D })
      await poolManager.withdrawFromSP(dec(1, 18), { from: D })

      // Expected gains for each depositor after 2 years (75% total issued).
      const A_expectedLQTYGain_2yr = communityLQTYSupply
        .mul(toBN('3')).div(toBN('4')) // 75% of total issued after 1 year
        .div(toBN('6'))  // A gets 1/6 of the issuance

      const B_expectedLQTYGain_2yr = communityLQTYSupply
        .mul(toBN('3')).div(toBN('4')) // 75% of total issued after 1 year
        .div(toBN('3'))  // B gets 2/6 = 1/3 of the issuance

      const C_expectedLQTYGain_2yr = communityLQTYSupply
        .mul(toBN('3')).div(toBN('4')) // 75% of total issued after 1 year
        .div(toBN('2'))  // C gets 3/6 = 1/2 of the issuance

      // Check LQTY gain
      const A_LQTYGain_2yr = await poolManager.getDepositorLQTYGain(A)
      const B_LQTYGain_2yr = await poolManager.getDepositorLQTYGain(B)
      const C_LQTYGain_2yr = await poolManager.getDepositorLQTYGain(C)

      console.log(`A_expectedLQTYGain_1yr: ${A_expectedLQTYGain_2yr}`)
      console.log(`A_LQTYGain_1yr: ${A_LQTYGain_2yr}`)
      console.log(`B_expectedLQTYGain_1yr: ${B_expectedLQTYGain_2yr}`)
      console.log(`B_LQTYGain_1yr: ${B_LQTYGain_2yr}`)
      console.log(`C_expectedLQTYGain_1yr: ${C_expectedLQTYGain_2yr}`)
      console.log(`C_LQTYGain_1yr: ${C_LQTYGain_2yr}`)

      // Check gains are correct, error tolerance = 1e-6 of a token
      assert.isAtMost(getDifference(A_LQTYGain_2yr, A_expectedLQTYGain_2yr), 1000000000000)
      assert.isAtMost(getDifference(B_LQTYGain_2yr, B_expectedLQTYGain_2yr), 1000000000000)
      assert.isAtMost(getDifference(C_LQTYGain_2yr, C_expectedLQTYGain_2yr), 1000000000000)

      // Each depositor fully withdraws
      await poolManager.withdrawFromSP(dec(100, 18), { from: A })
      await poolManager.withdrawFromSP(dec(100, 18), { from: B })
      await poolManager.withdrawFromSP(dec(100, 18), { from: C })

      // Check LQTY balances increase by correct amount
      assert.isAtMost(getDifference((await growthToken.balanceOf(A)), A_expectedLQTYGain_2yr), 1000000000000)
      assert.isAtMost(getDifference((await growthToken.balanceOf(B)), B_expectedLQTYGain_2yr), 1000000000000)
      assert.isAtMost(getDifference((await growthToken.balanceOf(C)), C_expectedLQTYGain_2yr), 1000000000000)
    })

    // A, B, C deposit. Varied stake. 1 Liquidation. D joins.
    it("withdrawFromSP(): Depositors with varying initial deposit withdraw correct LQTY gain. No liquidations. No front end.", async () => {
      // Set the deployment time to now
      await communityIssuanceTester.setDeploymentTime()

      const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
      assert.equal(initialIssuance, 0)

      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(3, 'ether') })
      await borrowerOperations.openLoan(dec(400, 18), D, { from: D, value: dec(4, 'ether') })
      await borrowerOperations.openLoan(dec(400, 18), E, { from: E, value: dec(4, 'ether') })

      await borrowerOperations.openLoan(dec(290, 18), defaulter_1, { from: defaulter_1, value: dec(3, 'ether') })

      // Check all LQTY balances are initially 0
      assert.equal(await growthToken.balanceOf(A), 0)
      assert.equal(await growthToken.balanceOf(B), 0)
      assert.equal(await growthToken.balanceOf(C), 0)
      assert.equal(await growthToken.balanceOf(D), 0)

      // A, B, C deposit
      await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: A })
      await poolManager.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: B })
      await poolManager.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: C })

      // Year 1 passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      console.log(`SP size before: ${await stabilityPool.getTotalCLVDeposits()}`)
      assert.equal(await stabilityPool.getTotalCLVDeposits(), dec(600, 18))

      // Price Drops, defaulter1 liquidated. Stability Pool size drops by 50%
      await priceFeed.setPrice(dec(100, 18))
      assert.isFalse(await cdpManager.checkRecoveryMode())
      await cdpManager.liquidate(defaulter_1)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))

      console.log(`SP size after: ${await stabilityPool.getTotalCLVDeposits()}`)
      // Confirm SP dropped from 600 to 300
      assert.isAtMost(getDifference(await stabilityPool.getTotalCLVDeposits(), dec(300, 18)), 1000)

      // Expected gains for each depositor after 1 year (50% total issued)
      const A_expectedLQTYGain_Y1 = communityLQTYSupply
        .div(toBN('2')) // 50% of total issued in Y1
        .div(toBN('6'))  // A got 1/6 of the issuance

      const B_expectedLQTYGain_Y1 = communityLQTYSupply
        .div(toBN('2')) // 50% of total issued in Y1
        .div(toBN('3'))  // B gets 2/6 = 1/3 of the issuance

      const C_expectedLQTYGain_Y1 = communityLQTYSupply
        .div(toBN('2')) // 50% of total issued in Y1
        .div(toBN('2'))  // C gets 3/6 = 1/2 of the issuance

      // Check LQTY gain
      const A_LQTYGain_Y1 = await poolManager.getDepositorLQTYGain(A)
      const B_LQTYGain_Y1 = await poolManager.getDepositorLQTYGain(B)
      const C_LQTYGain_Y1 = await poolManager.getDepositorLQTYGain(C)

      console.log(`A_expectedLQTYGain_Y1: ${A_expectedLQTYGain_Y1}`)
      console.log(`A_LQTYGain_Y1: ${A_LQTYGain_Y1}`)
      console.log(`B_expectedLQTYGain_Y1: ${B_expectedLQTYGain_Y1}`)
      console.log(`B_LQTYGain_Y1: ${B_LQTYGain_Y1}`)
      console.log(`C_expectedLQTYGain_Y1: ${C_expectedLQTYGain_Y1}`)
      console.log(`C_LQTYGain_Y1: ${C_LQTYGain_Y1}`)

      // Check gains are correct, error tolerance = 1e-6 of a toke
      assert.isAtMost(getDifference(A_LQTYGain_Y1, A_expectedLQTYGain_Y1), 1000000000000)
      assert.isAtMost(getDifference(B_LQTYGain_Y1, B_expectedLQTYGain_Y1), 1000000000000)
      assert.isAtMost(getDifference(C_LQTYGain_Y1, C_expectedLQTYGain_Y1), 1000000000000)

      // D deposits 400
      await poolManager.provideToSP(dec(400, 18), ZERO_ADDRESS, { from: D })

      // Year 2 passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // E deposits and withdraws, creating LQTY issuance
      await poolManager.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: E })
      await poolManager.withdrawFromSP(dec(1, 18), { from: E })

      // Expected gains for each depositor during Y2:
      const A_expectedLQTYGain_Y2 = communityLQTYSupply
        .div(toBN('4')) // 25% of total issued in Y2
        .div(toBN('14'))  // A got 50/700 = 1/14 of the issuance

      const B_expectedLQTYGain_Y2 = communityLQTYSupply
        .div(toBN('4')) // 25% of total issued in Y2
        .div(toBN('7'))  // B got 100/700 = 1/7 of the issuance

      const C_expectedLQTYGain_Y2 = communityLQTYSupply
        .div(toBN('4')) // 25% of total issued in Y2
        .mul(toBN('3')).div(toBN('14'))  // C gets 150/700 = 3/14 of the issuance

      const D_expectedLQTYGain_Y2 = communityLQTYSupply
        .div(toBN('4')) // 25% of total issued in Y2
        .mul(toBN('4')).div(toBN('7'))  // D gets 400/700 = 4/7 of the issuance

      // Check LQTY gain
      const A_LQTYGain_AfterY2 = await poolManager.getDepositorLQTYGain(A)
      const B_LQTYGain_AfterY2 = await poolManager.getDepositorLQTYGain(B)
      const C_LQTYGain_AfterY2 = await poolManager.getDepositorLQTYGain(C)
      const D_LQTYGain_AfterY2 = await poolManager.getDepositorLQTYGain(D)

      const A_expectedTotalGain = A_expectedLQTYGain_Y1.add(A_expectedLQTYGain_Y2)
      const B_expectedTotalGain = B_expectedLQTYGain_Y1.add(B_expectedLQTYGain_Y2)
      const C_expectedTotalGain = C_expectedLQTYGain_Y1.add(C_expectedLQTYGain_Y2)
      const D_expectedTotalGain = D_expectedLQTYGain_Y2

      console.log(`A_expectedTotalGain: ${A_expectedTotalGain}`)
      console.log(`A_LQTYGain_AfterY2: ${A_LQTYGain_AfterY2}`)
      console.log(`B_expectedTotalGain: ${B_expectedTotalGain}`)
      console.log(`B_LQTYGain_AfterY2: ${B_LQTYGain_AfterY2}`)
      console.log(`C_expectedTotalGain: ${C_expectedTotalGain}`)
      console.log(`C_LQTYGain_AfterY2: ${C_LQTYGain_AfterY2}`)
      console.log(`D_expectedTotalGain: ${D_expectedTotalGain}`)
      console.log(`D_LQTYGain_AfterY2: ${D_LQTYGain_AfterY2}`)

      // Check gains are correct, error tolerance = 1e-6 of a token
      assert.isAtMost(getDifference(A_LQTYGain_AfterY2, A_expectedTotalGain), 1000000000000)
      assert.isAtMost(getDifference(B_LQTYGain_AfterY2, B_expectedTotalGain), 1000000000000)
      assert.isAtMost(getDifference(C_LQTYGain_AfterY2, C_expectedTotalGain), 1000000000000)
      assert.isAtMost(getDifference(D_LQTYGain_AfterY2, D_expectedTotalGain), 1000000000000)

      // Each depositor fully withdraws
      await poolManager.withdrawFromSP(dec(100, 18), { from: A })
      await poolManager.withdrawFromSP(dec(100, 18), { from: B })
      await poolManager.withdrawFromSP(dec(100, 18), { from: C })
      await poolManager.withdrawFromSP(dec(100, 18), { from: D })

      // Check LQTY balances increase by correct amount
      assert.isAtMost(getDifference((await growthToken.balanceOf(A)), A_expectedTotalGain), 1000000000000)
      assert.isAtMost(getDifference((await growthToken.balanceOf(B)), B_expectedTotalGain), 1000000000000)
      assert.isAtMost(getDifference((await growthToken.balanceOf(C)), C_expectedTotalGain), 1000000000000)
      assert.isAtMost(getDifference((await growthToken.balanceOf(D)), D_expectedTotalGain), 1000000000000)
    })

    //--- Serial full offsets ---

    // A, B deposit 100C
    // L1 cancels 200C
    // B, C deposits 100C
    // L2 cancels 200C
    // E, F deposit 100C
    // L3 cancels 200C
    // G,H deposits 100C
    // L4 cancels 200C

    // Expect all depositors withdraw 0 CLV and 1 ETH

    it("withdrawFromSP(): Depositor withdraws correct compounded deposit after liquidation empties the pool", async () => {
      // Set the deployment time to now
      await communityIssuanceTester.setDeploymentTime()

      const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
      assert.equal(initialIssuance, 0)

      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      const allDepositors = [A, B, C, D, E, F, G, H]
      // 4 Defaulters open loan with 200CLV debt, and 200% ICR
      await borrowerOperations.openLoan(0, defaulter_1, { from: defaulter_1, value: dec(2, 'ether') })
      await borrowerOperations.withdrawCLV(dec(190, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.openLoan(0, defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
      await borrowerOperations.withdrawCLV(dec(190, 18), defaulter_2, { from: defaulter_2 })
      await borrowerOperations.openLoan(0, defaulter_3, { from: defaulter_3, value: dec(2, 'ether') })
      await borrowerOperations.withdrawCLV(dec(190, 18), defaulter_3, { from: defaulter_3 })
      await borrowerOperations.openLoan(0, defaulter_4, { from: defaulter_4, value: dec(2, 'ether') })
      await borrowerOperations.withdrawCLV(dec(190, 18), defaulter_4, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Check all would-be depositors have 0 LQTY balance
      for (depositor of allDepositors) {
        assert.equal(await growthToken.balanceOf(depositor), '0')
      }

      // Alice, Bob each deposit 100 CLV
      const depositors_1 = [A, B]
      for (account of depositors_1) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(100, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 1 liquidated. 200 CLV fully offset with pool.
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis each deposit 100 CLV
      const depositors_2 = [C, D]
      for (account of depositors_2) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(100, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 2 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Erin, Flyn each deposit 100 CLV
      const depositors_3 = [E, F]
      for (account of depositors_3) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(100, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 3 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Graham, Harriet each deposit 100 CLV
      const depositors_4 = [G, H]
      for (account of depositors_4) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(100, 'ether') })
        await poolManager.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 4 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_4, { from: owner });

      // All depositors withdraw from SP
      for (depositor of allDepositors) {
        await poolManager.withdrawFromSP(dec(100, 18), { from: depositor })
      }

      /* Expected fraction of total supply issued per month, for a yearly halving schedule:
      Month 1: 0.055378538087966600
      Month 2: 0.052311755607206100
      Month 3: 0.049414807056864200
      Month 4: 0.046678287282156100

      Each depositor constitutes 50% of the pool from the time they deposit up until the liquidation.
      Therefore, divide monthly issuance by 2 to get per-depositor expected LQTY gain
      */

      const expectedLQTYGain_M1 = communityLQTYSupply.mul(toBN('55378538087966600')).div(toBN(dec(1, 18)))
        .div(th.toBN('2'))
      const expectedLQTYGain_M2 = communityLQTYSupply.mul(toBN('52311755607206100')).div(toBN(dec(1, 18)))
        .div(th.toBN('2'))
      const expectedLQTYGain_M3 = communityLQTYSupply.mul(toBN('49414807056864200')).div(toBN(dec(1, 18)))
        .div(th.toBN('2'))
      const expectedLQTYGain_M4 = communityLQTYSupply.mul(toBN('46678287282156100')).div(toBN(dec(1, 18)))
        .div(th.toBN('2'))

      // Check A, B only earn issuance from month 1. Error tolerance = 1e-3 tokens
      for (depositor of [A, B]) {
        const LQTYBalance = await growthToken.balanceOf(depositor)
        assert.isAtMost(getDifference(LQTYBalance, expectedLQTYGain_M1), 1000000000000000)
      }

      // Check C, D only earn issuance from month 2.  Error tolerance = 1e-3 tokens
      for (depositor of [C, D]) {
        const LQTYBalance = await growthToken.balanceOf(depositor)
        assert.isAtMost(getDifference(LQTYBalance, expectedLQTYGain_M2), 1000000000000000)
      }

      // Check E, F only earn issuance from month 3.  Error tolerance = 1e-3 tokens
      for (depositor of [E, F]) {
        const LQTYBalance = await growthToken.balanceOf(depositor)
        assert.isAtMost(getDifference(LQTYBalance, expectedLQTYGain_M3), 1000000000000000)
      }

      // Check G, H only earn issuance from month 4.  Error tolerance = 1e-3 tokens
      for (depositor of [G, H]) {
        const LQTYBalance = await growthToken.balanceOf(depositor)
        console.log(`LQTYBalance: ${LQTYBalance}`)
        console.log(`expectedLQTYGain_M4: ${expectedLQTYGain_M4}`)
        assert.isAtMost(getDifference(LQTYBalance, expectedLQTYGain_M4), 1000000000000000)
      }

      const finalEpoch = (await poolManager.currentEpoch()).toString()
      assert.equal(finalEpoch, 4)
    })
  })
})

contract('Reset chain state', async accounts => { })
