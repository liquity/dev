const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const toBN = th.toBN
const getDifference = th.getDifference

contract('StabilityPool - LQTY Rewards', async accounts => {

  const [
    owner,
    whale,
    A, B, C, D, E, F, G, H,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4, defaulter_5, defaulter_6,
    frontEnd_1, frontEnd_2, frontEnd_3
  ] = accounts;

  let contracts

  let priceFeed
  let clvToken
  let stabilityPool
  let sortedCDPs
  let cdpManager
  let borrowerOperations
  let growthToken
  let communityIssuanceTester

  let communityLQTYSupply
  let issuance_M1
  let issuance_M2
  let issuance_M3
  let issuance_M4
  let issuance_M5
  let issuance_M6

  const ZERO_ADDRESS = th.ZERO_ADDRESS

  describe("LQTY Rewards", async () => {

    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore() 
      LQTYContracts = await deploymentHelper.deployLQTYTesterContractsBuidler()
     
      priceFeed = contracts.priceFeed
      clvToken = contracts.clvToken
      stabilityPool = contracts.stabilityPool
      sortedCDPs = contracts.sortedCDPs
      cdpManager = contracts.cdpManager
      stabilityPool = contracts.stabilityPool
      borrowerOperations = contracts.borrowerOperations

      growthToken = LQTYContracts.growthToken
      communityIssuanceTester = LQTYContracts.communityIssuance

      await deploymentHelper.connectLQTYContracts(LQTYContracts)
      await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
      await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

      // Check community issuance starts with 33.333... million LQTY
      communityLQTYSupply = toBN(await growthToken.balanceOf(communityIssuanceTester.address))
      assert.isAtMost(getDifference(communityLQTYSupply, '33333333333333333333333333'), 1000)

      /* Monthly LQTY issuance
  
        Expected fraction of total supply issued per month, for a yearly halving schedule:
    
        Month 1: 0.055378538087966600
        Month 2: 0.052311755607206100
        Month 3: 0.049414807056864200
        Month 4: 0.046678287282156100
        Month 5: 0.044093311972020200
        Month 6: 0.041651488815552900
      */

      issuance_M1 = toBN('55378538087966600').mul(communityLQTYSupply).div(toBN(dec(1, 18)))
      issuance_M2 = toBN('52311755607206100').mul(communityLQTYSupply).div(toBN(dec(1, 18)))
      issuance_M3 = toBN('49414807056864200').mul(communityLQTYSupply).div(toBN(dec(1, 18)))
      issuance_M4 = toBN('46678287282156100').mul(communityLQTYSupply).div(toBN(dec(1, 18)))
      issuance_M5 = toBN('44093311972020200').mul(communityLQTYSupply).div(toBN(dec(1, 18)))
      issuance_M6 = toBN('41651488815552900').mul(communityLQTYSupply).div(toBN(dec(1, 18)))
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
      await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: A })
      await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })
      await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: C })

      // One year passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // D deposits, triggering LQTY gains for A,B,C. Withdraws immediately after
      await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: D })
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: D })

      // Expected gains for each depositor after 1 year (50% total issued).  Each deposit gets 1/3 of issuance.
      const expectedLQTYGain_1yr = communityLQTYSupply.div(toBN('2')).div(toBN('3'))

      // Check LQTY gain
      const A_LQTYGain_1yr = await stabilityPool.getDepositorLQTYGain(A)
      const B_LQTYGain_1yr = await stabilityPool.getDepositorLQTYGain(B)
      const C_LQTYGain_1yr = await stabilityPool.getDepositorLQTYGain(C)

      // Check gains are correct, error tolerance = 1e-6 of a token

      assert.isAtMost(getDifference(A_LQTYGain_1yr, expectedLQTYGain_1yr), 1e12)
      assert.isAtMost(getDifference(B_LQTYGain_1yr, expectedLQTYGain_1yr), 1e12)
      assert.isAtMost(getDifference(C_LQTYGain_1yr, expectedLQTYGain_1yr), 1e12)

      // Another year passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // D deposits, triggering LQTY gains for A,B,C. Withdraws immediately after
      await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: D })
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: D })

      // Expected gains for each depositor after 2 years (75% total issued).  Each deposit gets 1/3 of issuance.
      const expectedLQTYGain_2yr = communityLQTYSupply.mul(toBN('3')).div(toBN('4')).div(toBN('3'))

      // Check LQTY gain
      const A_LQTYGain_2yr = await stabilityPool.getDepositorLQTYGain(A)
      const B_LQTYGain_2yr = await stabilityPool.getDepositorLQTYGain(B)
      const C_LQTYGain_2yr = await stabilityPool.getDepositorLQTYGain(C)

      // Check gains are correct, error tolerance = 1e-6 of a token
      assert.isAtMost(getDifference(A_LQTYGain_2yr, expectedLQTYGain_2yr), 1e12)
      assert.isAtMost(getDifference(B_LQTYGain_2yr, expectedLQTYGain_2yr), 1e12)
      assert.isAtMost(getDifference(C_LQTYGain_2yr, expectedLQTYGain_2yr), 1e12)

      // Each depositor fully withdraws
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: A })
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: C })

      // Check LQTY balances increase by correct amount
      assert.isAtMost(getDifference((await growthToken.balanceOf(A)), expectedLQTYGain_2yr), 1e12)
      assert.isAtMost(getDifference((await growthToken.balanceOf(B)), expectedLQTYGain_2yr), 1e12)
      assert.isAtMost(getDifference((await growthToken.balanceOf(C)), expectedLQTYGain_2yr), 1e12)
    })

    // 3 depositors, varied stake. No liquidations. No front-end.
    it("withdrawFromSP(): Depositors with varying initial deposit withdraw correct LQTY gain. No liquidations. No front end.", async () => {
      // Set the deployment time to now
      await communityIssuanceTester.setDeploymentTime()

      const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
      assert.equal(initialIssuance, 0)

      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(3, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(4, 'ether') })
      await borrowerOperations.openLoan(dec(1, 18), D, { from: D, value: dec(1, 'ether') })

      // Check all LQTY balances are initially 0
      assert.equal(await growthToken.balanceOf(A), 0)
      assert.equal(await growthToken.balanceOf(B), 0)
      assert.equal(await growthToken.balanceOf(C), 0)

      // A, B, C deposit
      await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: A })
      await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: B })
      await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: C })

      // One year passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // D deposits, triggering LQTY gains for A,B,C. Withdraws immediately after
      await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: D })
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: D })

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
      const A_LQTYGain_1yr = await stabilityPool.getDepositorLQTYGain(A)
      const B_LQTYGain_1yr = await stabilityPool.getDepositorLQTYGain(B)
      const C_LQTYGain_1yr = await stabilityPool.getDepositorLQTYGain(C)

      // Check gains are correct, error tolerance = 1e-6 of a toke
      assert.isAtMost(getDifference(A_LQTYGain_1yr, A_expectedLQTYGain_1yr), 1e12)
      assert.isAtMost(getDifference(B_LQTYGain_1yr, B_expectedLQTYGain_1yr), 1e12)
      assert.isAtMost(getDifference(C_LQTYGain_1yr, C_expectedLQTYGain_1yr), 1e12)

      // Another year passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // D deposits, triggering LQTY gains for A,B,C. Withdraws immediately after
      await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: D })
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: D })

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
      const A_LQTYGain_2yr = await stabilityPool.getDepositorLQTYGain(A)
      const B_LQTYGain_2yr = await stabilityPool.getDepositorLQTYGain(B)
      const C_LQTYGain_2yr = await stabilityPool.getDepositorLQTYGain(C)

      // Check gains are correct, error tolerance = 1e-6 of a token
      assert.isAtMost(getDifference(A_LQTYGain_2yr, A_expectedLQTYGain_2yr), 1e12)
      assert.isAtMost(getDifference(B_LQTYGain_2yr, B_expectedLQTYGain_2yr), 1e12)
      assert.isAtMost(getDifference(C_LQTYGain_2yr, C_expectedLQTYGain_2yr), 1e12)

      // Each depositor fully withdraws
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: A })
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: C })

      // Check LQTY balances increase by correct amount
      assert.isAtMost(getDifference((await growthToken.balanceOf(A)), A_expectedLQTYGain_2yr), 1e12)
      assert.isAtMost(getDifference((await growthToken.balanceOf(B)), B_expectedLQTYGain_2yr), 1e12)
      assert.isAtMost(getDifference((await growthToken.balanceOf(C)), C_expectedLQTYGain_2yr), 1e12)
    })

    // A, B, C deposit. Varied stake. 1 Liquidation. D joins.
    it("withdrawFromSP(): Depositors with varying initial deposit withdraw correct LQTY gain. No liquidations. No front end.", async () => {
      // Set the deployment time to now
      await communityIssuanceTester.setDeploymentTime()

      const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
      assert.equal(initialIssuance, 0)

      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(3, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(4, 'ether') })
      await borrowerOperations.openLoan(dec(400, 18), D, { from: D, value: dec(5, 'ether') })
      await borrowerOperations.openLoan(dec(400, 18), E, { from: E, value: dec(6, 'ether') })

      await borrowerOperations.openLoan(dec(290, 18), defaulter_1, { from: defaulter_1, value: dec(3, 'ether') })

      // Check all LQTY balances are initially 0
      assert.equal(await growthToken.balanceOf(A), 0)
      assert.equal(await growthToken.balanceOf(B), 0)
      assert.equal(await growthToken.balanceOf(C), 0)
      assert.equal(await growthToken.balanceOf(D), 0)

      // A, B, C deposit
      await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: A })
      await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: B })
      await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: C })

      // Year 1 passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      assert.equal(await stabilityPool.getTotalCLVDeposits(), dec(600, 18))

      // Price Drops, defaulter1 liquidated. Stability Pool size drops by 50%
      await priceFeed.setPrice(dec(100, 18))
      assert.isFalse(await cdpManager.checkRecoveryMode())
      await cdpManager.liquidate(defaulter_1)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))

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
      const A_LQTYGain_Y1 = await stabilityPool.getDepositorLQTYGain(A)
      const B_LQTYGain_Y1 = await stabilityPool.getDepositorLQTYGain(B)
      const C_LQTYGain_Y1 = await stabilityPool.getDepositorLQTYGain(C)

      // Check gains are correct, error tolerance = 1e-6 of a toke
      assert.isAtMost(getDifference(A_LQTYGain_Y1, A_expectedLQTYGain_Y1), 1e12)
      assert.isAtMost(getDifference(B_LQTYGain_Y1, B_expectedLQTYGain_Y1), 1e12)
      assert.isAtMost(getDifference(C_LQTYGain_Y1, C_expectedLQTYGain_Y1), 1e12)

      // D deposits 400
      await stabilityPool.provideToSP(dec(400, 18), ZERO_ADDRESS, { from: D })

      // Year 2 passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // E deposits and withdraws, creating LQTY issuance
      await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: E })
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: E })

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
      const A_LQTYGain_AfterY2 = await stabilityPool.getDepositorLQTYGain(A)
      const B_LQTYGain_AfterY2 = await stabilityPool.getDepositorLQTYGain(B)
      const C_LQTYGain_AfterY2 = await stabilityPool.getDepositorLQTYGain(C)
      const D_LQTYGain_AfterY2 = await stabilityPool.getDepositorLQTYGain(D)

      const A_expectedTotalGain = A_expectedLQTYGain_Y1.add(A_expectedLQTYGain_Y2)
      const B_expectedTotalGain = B_expectedLQTYGain_Y1.add(B_expectedLQTYGain_Y2)
      const C_expectedTotalGain = C_expectedLQTYGain_Y1.add(C_expectedLQTYGain_Y2)
      const D_expectedTotalGain = D_expectedLQTYGain_Y2

      // Check gains are correct, error tolerance = 1e-6 of a token
      assert.isAtMost(getDifference(A_LQTYGain_AfterY2, A_expectedTotalGain), 1e12)
      assert.isAtMost(getDifference(B_LQTYGain_AfterY2, B_expectedTotalGain), 1e12)
      assert.isAtMost(getDifference(C_LQTYGain_AfterY2, C_expectedTotalGain), 1e12)
      assert.isAtMost(getDifference(D_LQTYGain_AfterY2, D_expectedTotalGain), 1e12)

      // Each depositor fully withdraws
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: A })
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: C })
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: D })

      // Check LQTY balances increase by correct amount
      assert.isAtMost(getDifference((await growthToken.balanceOf(A)), A_expectedTotalGain), 1e12)
      assert.isAtMost(getDifference((await growthToken.balanceOf(B)), B_expectedTotalGain), 1e12)
      assert.isAtMost(getDifference((await growthToken.balanceOf(C)), C_expectedTotalGain), 1e12)
      assert.isAtMost(getDifference((await growthToken.balanceOf(D)), D_expectedTotalGain), 1e12)
    })

    //--- Serial pool-emptying liquidations ---

    /* A, B deposit 100C
    L1 cancels 200C
    B, C deposits 100C
    L2 cancels 200C
    E, F deposit 100C
    L3 cancels 200C
    G,H deposits 100C
    L4 cancels 200C

    Expect all depositors withdraw  1/2 of 1 month's LQTY issuance */
    it('withdrawFromSP(): Depositor withdraws correct LQTY gain after serial pool-emptying liquidations. No front-ends.', async () => {
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

      // A, B each deposit 100 CLV
      const depositors_1 = [A, B]
      for (account of depositors_1) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(100, 'ether') })
        await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 1 liquidated. 200 CLV fully offset with pool.
      await cdpManager.liquidate(defaulter_1, { from: owner });

      // C, D each deposit 100 CLV
      const depositors_2 = [C, D]
      for (account of depositors_2) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(100, 'ether') })
        await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 2 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // Erin, Flyn each deposit 100 CLV
      const depositors_3 = [E, F]
      for (account of depositors_3) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(100, 'ether') })
        await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 3 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_3, { from: owner });

      // Graham, Harriet each deposit 100 CLV
      const depositors_4 = [G, H]
      for (account of depositors_4) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(100, 'ether') })
        await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: account })
      }

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 4 liquidated. 100 CLV offset
      await cdpManager.liquidate(defaulter_4, { from: owner });

      // All depositors withdraw from SP
      for (depositor of allDepositors) {
        await stabilityPool.withdrawFromSP(dec(100, 18), { from: depositor })
      }

      /* Each depositor constitutes 50% of the pool from the time they deposit, up until the liquidation.
      Therefore, divide monthly issuance by 2 to get the expected per-depositor LQTY gain.*/
      const expectedLQTYGain_M1 = issuance_M1.div(th.toBN('2'))
      const expectedLQTYGain_M2 = issuance_M2.div(th.toBN('2'))
      const expectedLQTYGain_M3 = issuance_M3.div(th.toBN('2'))
      const expectedLQTYGain_M4 = issuance_M4.div(th.toBN('2'))

      // Check A, B only earn issuance from month 1. Error tolerance = 1e-3 tokens
      for (depositor of [A, B]) {
        const LQTYBalance = await growthToken.balanceOf(depositor)
        assert.isAtMost(getDifference(LQTYBalance, expectedLQTYGain_M1), 1e15)
      }

      // Check C, D only earn issuance from month 2.  Error tolerance = 1e-3 tokens
      for (depositor of [C, D]) {
        const LQTYBalance = await growthToken.balanceOf(depositor)
        assert.isAtMost(getDifference(LQTYBalance, expectedLQTYGain_M2), 1e15)
      }

      // Check E, F only earn issuance from month 3.  Error tolerance = 1e-3 tokens
      for (depositor of [E, F]) {
        const LQTYBalance = await growthToken.balanceOf(depositor)
        assert.isAtMost(getDifference(LQTYBalance, expectedLQTYGain_M3), 1e15)
      }

      // Check G, H only earn issuance from month 4.  Error tolerance = 1e-3 tokens
      for (depositor of [G, H]) {
        const LQTYBalance = await growthToken.balanceOf(depositor)
        assert.isAtMost(getDifference(LQTYBalance, expectedLQTYGain_M4), 1e15)
      }

      const finalEpoch = (await stabilityPool.currentEpoch()).toString()
      assert.equal(finalEpoch, 4)
    })

    // --- Scale factor changes ---

    /* Serial scale changes

    A make deposit 100 CLV
    1 month passes. L1 brings P to (~1e-10)*P. L1:  99.999999999000000000 CLV, 1 ETH
    B makes deposit 100
    1 month passes. L2 decreases P by(~1e-10)P. L2:  99.999999999000000000 CLV, 1 ETH
    C makes deposit 100
    1 month passes. L3 decreases P by(~1e-10)P. L3:  99.999999999000000000 CLV, 1 ETH
    D makes deposit 100
    1 month passes. L4 decreases P by(~1e-10)P. L4:  99.999999999000000000 CLV, 1 ETH
    E makes deposit 100
    1 month passes. L5 decreases P by(~1e-10)P. L5:  99.999999999000000000 CLV, 1 ETH
    =========
    F makes deposit 100
    1 month passes. L6 empties the Pool. L6:  100 CLV, 1 ETH

    expect A, B, C, D each withdraw ~1 month's worth of LQTY */
    it("withdrawFromSP(): Several deposits of 100 CLV span one scale factor change. Depositors withdraw correct LQTY gains", async () => {
      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      const fiveDefaulters = [defaulter_1, defaulter_2, defaulter_3, defaulter_4, defaulter_5]

      for (const defaulter of fiveDefaulters) {
        // Defaulters 1-6 each withdraw to 99.999999999 debt (including gas comp)
        await borrowerOperations.openLoan(0, defaulter, { from: defaulter, value: dec(1, 'ether') })
        await borrowerOperations.withdrawCLV('89999999999000000000', defaulter, { from: defaulter })
      }

      // Defaulter 6 withdraws to 100 debt (inc. gas comp)
      await borrowerOperations.openLoan(0, defaulter_6, { from: defaulter_6, value: dec(1, 'ether') })
      await borrowerOperations.withdrawCLV(dec(90, 18), defaulter_6, { from: defaulter_6 })

      // Confirm all depositors have 0 LQTY
      for (const depositor of [A, B, C, D, E, F]) {
        assert.equal(await growthToken.balanceOf(depositor), '0')
      }
      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Check scale is 0
      assert.equal(await stabilityPool.currentScale(), '0')

      // A provides to SP
      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(100, 'ether') })
      await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: A })

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txL1 = await cdpManager.liquidate(defaulter_1, { from: owner });
      assert.isFalse(await sortedCDPs.contains(defaulter_1))
      assert.isTrue(txL1.receipt.status)

      // Check scale is 0
      assert.equal(await stabilityPool.currentScale(), '0')

      // B provides to SP
      await borrowerOperations.openLoan(dec(100, 18), B, { from: B, value: dec(100, 'ether') })
      await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 2 liquidated
      const txL2 = await cdpManager.liquidate(defaulter_2, { from: owner });
      assert.isFalse(await sortedCDPs.contains(defaulter_2))
      assert.isTrue(txL2.receipt.status)

      // Check scale is 1
      assert.equal(await stabilityPool.currentScale(), '1')

      // C provides to SP
      await borrowerOperations.openLoan(dec(100, 18), C, { from: C, value: dec(100, 'ether') })
      await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: C })

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 3 liquidated
      const txL3 = await cdpManager.liquidate(defaulter_3, { from: owner });
      assert.isFalse(await sortedCDPs.contains(defaulter_3))
      assert.isTrue(txL3.receipt.status)

      // Check scale is 1
      assert.equal(await stabilityPool.currentScale(), '1')

      // D provides to SP
      await borrowerOperations.openLoan(dec(100, 18), D, { from: D, value: dec(100, 'ether') })
      await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: D })

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 4 liquidated
      const txL4 = await cdpManager.liquidate(defaulter_4, { from: owner });
      assert.isFalse(await sortedCDPs.contains(defaulter_4))
      assert.isTrue(txL4.receipt.status)

      // Check scale is 2
      assert.equal(await stabilityPool.currentScale(), '2')

      // E provides to SP
      await borrowerOperations.openLoan(dec(100, 18), E, { from: E, value: dec(100, 'ether') })
      await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: E })

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 5 liquidated
      const txL5 = await cdpManager.liquidate(defaulter_5, { from: owner });
      assert.isFalse(await sortedCDPs.contains(defaulter_5))
      assert.isTrue(txL5.receipt.status)

      // Check scale is 2
      assert.equal(await stabilityPool.currentScale(), '2')

      // F provides to SP
      await borrowerOperations.openLoan(dec(100, 18), F, { from: F, value: dec(100, 'ether') })
      await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: F })

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 6 liquidated
      const txL6 = await cdpManager.liquidate(defaulter_6, { from: owner });
      assert.isFalse(await sortedCDPs.contains(defaulter_6))
      assert.isTrue(txL6.receipt.status)

      // Check scale is 3
      assert.equal(await stabilityPool.currentScale(), '3')

      /* All depositors withdraw fully from SP.  Withdraw in reverse order, so that the largest remaining
      deposit (F) withdraws first, and does not get extra LQTY gains from the periods between withdrawals */
      for (depositor of [F, E, D, C, B, A]) {
        await stabilityPool.withdrawFromSP(dec(100, 18), { from: depositor })
      }

      const LQTYGain_A = await growthToken.balanceOf(A)
      const LQTYGain_B = await growthToken.balanceOf(B)
      const LQTYGain_C = await growthToken.balanceOf(C)
      const LQTYGain_D = await growthToken.balanceOf(D)
      const LQTYGain_E = await growthToken.balanceOf(E)
      const LQTYGain_F = await growthToken.balanceOf(F)

      /* Expect each deposit to have earned 100% of the LQTY issuance for the month in which it was active, prior
     to the liquidation that mostly depleted it.  Error tolerance = 1e-3 tokens. */
      assert.isAtMost(getDifference(issuance_M1, LQTYGain_A), 1e15)
      assert.isAtMost(getDifference(issuance_M2, LQTYGain_B), 1e15)
      assert.isAtMost(getDifference(issuance_M3, LQTYGain_C), 1e15)
      assert.isAtMost(getDifference(issuance_M4, LQTYGain_D), 1e15)
      assert.isAtMost(getDifference(issuance_M5, LQTYGain_E), 1e15)
      assert.isAtMost(getDifference(issuance_M6, LQTYGain_F), 1e15)
    })

    // --- FrontEnds and kickback rates

    // Simple case: 4 depositors, equal stake. No liquidations.
    it("withdrawFromSP(): Depositors with equal initial deposit withdraw correct LQTY gain. No liquidations. Front ends and kickback rates.", async () => {
      // Register 2 front ends
      const kickbackRate_F1 = toBN(dec(5, 17)) // F1 kicks 50% back to depositor
      const kickbackRate_F2 = toBN(dec(80, 16)) // F2 kicks 80% back to depositor

      await stabilityPool.registerFrontEnd(kickbackRate_F1, { from: frontEnd_1 })
      await stabilityPool.registerFrontEnd(kickbackRate_F2, { from: frontEnd_2 })

      // Set the deployment time to now
      await communityIssuanceTester.setDeploymentTime()

      const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
      assert.equal(initialIssuance, 0)

      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(100, 18), B, { from: B, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(100, 18), C, { from: C, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(100, 18), D, { from: D, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(1, 18), E, { from: E, value: dec(1, 'ether') })

      // Check all LQTY balances are initially 0
      assert.equal(await growthToken.balanceOf(A), 0)
      assert.equal(await growthToken.balanceOf(B), 0)
      assert.equal(await growthToken.balanceOf(C), 0)
      assert.equal(await growthToken.balanceOf(D), 0)
      assert.equal(await growthToken.balanceOf(frontEnd_1), 0)
      assert.equal(await growthToken.balanceOf(frontEnd_2), 0)

      // A, B, C, D deposit
      await stabilityPool.provideToSP(dec(100, 18), frontEnd_1, { from: A })
      await stabilityPool.provideToSP(dec(100, 18), frontEnd_2, { from: B })
      await stabilityPool.provideToSP(dec(100, 18), frontEnd_2, { from: C })
      await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: D })

      // Check initial frontEnd stakes are correct:
      F1_stake = await stabilityPool.frontEndStakes(frontEnd_1)
      F2_stake = await stabilityPool.frontEndStakes(frontEnd_2)

      assert.equal(F1_stake, dec(100, 18))
      assert.equal(F2_stake, dec(200, 18))

      // One year passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // E deposits, triggering LQTY gains for A,B,C,D,F1,F2. Withdraws immediately after
      await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: E })
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: E })

      // Expected issuance for year 1 is 50% of total supply.
      const expectedIssuance_Y1 = communityLQTYSupply.div(toBN('2'))

      // Get actual LQTY gains
      const A_LQTYGain_Y1 = await stabilityPool.getDepositorLQTYGain(A)
      const B_LQTYGain_Y1 = await stabilityPool.getDepositorLQTYGain(B)
      const C_LQTYGain_Y1 = await stabilityPool.getDepositorLQTYGain(C)
      const D_LQTYGain_Y1 = await stabilityPool.getDepositorLQTYGain(D)
      const F1_LQTYGain_Y1 = await stabilityPool.getFrontEndLQTYGain(frontEnd_1)
      const F2_LQTYGain_Y1 = await stabilityPool.getFrontEndLQTYGain(frontEnd_2)

      // Expected depositor and front-end gains
      const A_expectedGain_Y1 = kickbackRate_F1.mul(expectedIssuance_Y1).div(toBN('4')).div(toBN(dec(1, 18)))
      const B_expectedGain_Y1 = kickbackRate_F2.mul(expectedIssuance_Y1).div(toBN('4')).div(toBN(dec(1, 18)))
      const C_expectedGain_Y1 = kickbackRate_F2.mul(expectedIssuance_Y1).div(toBN('4')).div(toBN(dec(1, 18)))
      const D_expectedGain_Y1 = expectedIssuance_Y1.div(toBN('4'))

      const F1_expectedGain_Y1 = toBN(dec(1, 18)).sub(kickbackRate_F1)
        .mul(expectedIssuance_Y1).div(toBN('4')) // F1's share = 100/400 = 1/4
        .div(toBN(dec(1, 18)))

      const F2_expectedGain_Y1 = toBN(dec(1, 18)).sub(kickbackRate_F2)
        .mul(expectedIssuance_Y1).div(toBN('2')) // F2's share = 200/400 = 1/2
        .div(toBN(dec(1, 18)))

      // Check gains are correct, error tolerance = 1e-6 of a token
      assert.isAtMost(getDifference(A_LQTYGain_Y1, A_expectedGain_Y1), 1e12)
      assert.isAtMost(getDifference(B_LQTYGain_Y1, B_expectedGain_Y1), 1e12)
      assert.isAtMost(getDifference(C_LQTYGain_Y1, C_expectedGain_Y1), 1e12)
      assert.isAtMost(getDifference(D_LQTYGain_Y1, D_expectedGain_Y1), 1e12)

      assert.isAtMost(getDifference(F1_LQTYGain_Y1, F1_expectedGain_Y1), 1e12)
      assert.isAtMost(getDifference(F2_LQTYGain_Y1, F2_expectedGain_Y1), 1e12)

      // Another year passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // E deposits, triggering LQTY gains for A,B,CD,F1, F2. Withdraws immediately after
      await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: E })
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: E })

      // Expected gains for each depositor in Y2(25% total issued).  .
      const expectedIssuance_Y2 = communityLQTYSupply.div(toBN('4'))

      const expectedFinalIssuance = expectedIssuance_Y1.add(expectedIssuance_Y2)

      // Expected final gains
      const A_expectedFinalGain = kickbackRate_F1.mul(expectedFinalIssuance).div(toBN('4')).div(toBN(dec(1, 18)))
      const B_expectedFinalGain = kickbackRate_F2.mul(expectedFinalIssuance).div(toBN('4')).div(toBN(dec(1, 18)))
      const C_expectedFinalGain = kickbackRate_F2.mul(expectedFinalIssuance).div(toBN('4')).div(toBN(dec(1, 18)))
      const D_expectedFinalGain = expectedFinalIssuance.div(toBN('4'))

      const F1_expectedFinalGain = th.toBN(dec(1, 18)).sub(kickbackRate_F1)
        .mul(expectedFinalIssuance).div(toBN('4')) // F1's share = 100/400 = 1/4
        .div(toBN(dec(1, 18)))

      const F2_expectedFinalGain = th.toBN(dec(1, 18)).sub(kickbackRate_F2)
        .mul(expectedFinalIssuance).div(toBN('2')) // F2's share = 200/400 = 1/2
        .div(toBN(dec(1, 18)))

      // Each depositor fully withdraws
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: A })
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: C })
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: D })

      // Check LQTY balances increase by correct amount
      assert.isAtMost(getDifference((await growthToken.balanceOf(A)), A_expectedFinalGain), 1e12)
      assert.isAtMost(getDifference((await growthToken.balanceOf(B)), B_expectedFinalGain), 1e12)
      assert.isAtMost(getDifference((await growthToken.balanceOf(C)), C_expectedFinalGain), 1e12)
      assert.isAtMost(getDifference((await growthToken.balanceOf(D)), D_expectedFinalGain), 1e12)
      assert.isAtMost(getDifference((await growthToken.balanceOf(frontEnd_1)), F1_expectedFinalGain), 1e12)
      assert.isAtMost(getDifference((await growthToken.balanceOf(frontEnd_2)), F2_expectedFinalGain), 1e12)
    })

    // A, B, C, D deposit 100,200,300,400.
    // F1: A
    // F2: B, C
    // D makes a naked deposit (no front end)
    // Pool size: 1000
    // 1 month passes. 1st liquidation: 500. All deposits reduced by 500/1000 = 50%.  A:50,   B:100, C:150,   D:200
    // Pool size: 500
    // E deposits 300 via F1                                                          A:50,   B:100, C:150,   D:200, E:300
    // Pool size: 800
    // 1 month passes. 2nd liquidation: 200. All deposits reduced by 200/800 = 25%    A:37.5, B:75,  C:112.5, D:150, E:225
    // Pool size: 600
    // B tops up 400                                                                  A:37.5, B:475, C:112.5, D:150, E:225
    // Pool size: 1000
    // 1 month passes. 3rd liquidation: 100. All deposits reduced by 10%.             A:33.75, B:427.5, C:101.25, D:135, E:202.5
    // Pool size 900
    // C withdraws 100                                                                A:33.75, B:427.5, C:1.25, D:135, E:202.5
    // Pool size 800
    // 1 month passes.
    // All withdraw
    it("withdrawFromSP(): Depositors with varying initial deposit withdraw correct LQTY gain. Front ends and kickback rates", async () => {
      // Register 2 front ends
      const F1_kickbackRate = toBN(dec(5, 17)) // F1 kicks 50% back to depositor
      const F2_kickbackRate = toBN(dec(80, 16)) // F2 kicks 80% back to depositor

      await stabilityPool.registerFrontEnd(F1_kickbackRate, { from: frontEnd_1 })
      await stabilityPool.registerFrontEnd(F2_kickbackRate, { from: frontEnd_2 })

      // Set the deployment time to now
      await communityIssuanceTester.setDeploymentTime()

      const initialIssuance = await communityIssuanceTester.totalLQTYIssued()
      assert.equal(initialIssuance, 0)

      // Whale opens CDP with 100 ETH
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(600, 18), B, { from: B, value: dec(7, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(4, 'ether') })
      await borrowerOperations.openLoan(dec(400, 18), D, { from: D, value: dec(5, 'ether') })

      await borrowerOperations.openLoan(dec(300, 18), E, { from: E, value: dec(4, 'ether') })

      // D1, D2, D3 open loans with total debt 500, 300, 100 respectively (inc. gas comp)
      await borrowerOperations.openLoan(dec(490, 18), defaulter_1, { from: defaulter_1, value: dec(5, 'ether') })
      await borrowerOperations.openLoan(dec(190, 18), defaulter_2, { from: defaulter_2, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(90, 18), defaulter_3, { from: defaulter_3, value: dec(1, 'ether') })

      // Check all LQTY balances are initially 0
      assert.equal(await growthToken.balanceOf(A), 0)
      assert.equal(await growthToken.balanceOf(B), 0)
      assert.equal(await growthToken.balanceOf(C), 0)
      assert.equal(await growthToken.balanceOf(D), 0)
      assert.equal(await growthToken.balanceOf(frontEnd_1), 0)
      assert.equal(await growthToken.balanceOf(frontEnd_2), 0)

      // A, B, C, D deposit
      await stabilityPool.provideToSP(dec(100, 18), frontEnd_1, { from: A })
      await stabilityPool.provideToSP(dec(200, 18), frontEnd_2, { from: B })
      await stabilityPool.provideToSP(dec(300, 18), frontEnd_2, { from: C })
      await stabilityPool.provideToSP(dec(400, 18), ZERO_ADDRESS, { from: D })

      // Price Drops, defaulters become undercollateralized
      await priceFeed.setPrice(dec(100, 18))
      assert.isFalse(await cdpManager.checkRecoveryMode())

      // Check initial frontEnd stakes are correct:
      F1_stake = await stabilityPool.frontEndStakes(frontEnd_1)
      F2_stake = await stabilityPool.frontEndStakes(frontEnd_2)

      assert.equal(F1_stake, dec(100, 18))
      assert.equal(F2_stake, dec(500, 18))

      // Month 1 passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      assert.equal(await stabilityPool.getTotalCLVDeposits(), dec(1000, 18))

      // LIQUIDATION 1
      await cdpManager.liquidate(defaulter_1)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))

      assert.equal(await stabilityPool.getTotalCLVDeposits(), dec(500, 18))

      // --- CHECK GAINS AFTER L1 ---

      // During month 1, deposit sizes are: A:100, B:200, C:300, D:400.  Total: 1000
      // Expected gains for each depositor after month 1 
      const A_share_M1 = issuance_M1.mul(toBN('100')).div(toBN('1000'))
      const A_expectedLQTYGain_M1 = F1_kickbackRate.mul(A_share_M1).div(toBN(dec(1, 18)))

      const B_share_M1 = issuance_M1.mul(toBN('200')).div(toBN('1000'))
      const B_expectedLQTYGain_M1 = F2_kickbackRate.mul(B_share_M1).div(toBN(dec(1, 18)))

      const C_share_M1 = issuance_M1.mul(toBN('300')).div(toBN('1000'))
      const C_expectedLQTYGain_M1 = F2_kickbackRate.mul(C_share_M1).div(toBN(dec(1, 18)))

      const D_share_M1 = issuance_M1.mul(toBN('400')).div(toBN('1000'))
      const D_expectedLQTYGain_M1 = D_share_M1

      // F1's stake = A 
      const F1_expectedLQTYGain_M1 = toBN(dec(1, 18))
        .sub(F1_kickbackRate)
        .mul(A_share_M1)
        .div(toBN(dec(1, 18)))

      // F2's stake = B + C
      const F2_expectedLQTYGain_M1 = toBN(dec(1, 18))
        .sub(F2_kickbackRate)
        .mul(B_share_M1.add(C_share_M1))
        .div(toBN(dec(1, 18)))

      // Check LQTY gain
      const A_LQTYGain_M1 = await stabilityPool.getDepositorLQTYGain(A)
      const B_LQTYGain_M1 = await stabilityPool.getDepositorLQTYGain(B)
      const C_LQTYGain_M1 = await stabilityPool.getDepositorLQTYGain(C)
      const D_LQTYGain_M1 = await stabilityPool.getDepositorLQTYGain(D)
      const F1_LQTYGain_M1 = await stabilityPool.getFrontEndLQTYGain(frontEnd_1)
      const F2_LQTYGain_M1 = await stabilityPool.getFrontEndLQTYGain(frontEnd_2)

      // Check gains are correct, error tolerance = 1e-3 of a token
      assert.isAtMost(getDifference(A_LQTYGain_M1, A_expectedLQTYGain_M1), 1e15)
      assert.isAtMost(getDifference(B_LQTYGain_M1, B_expectedLQTYGain_M1), 1e15)
      assert.isAtMost(getDifference(C_LQTYGain_M1, C_expectedLQTYGain_M1), 1e15)
      assert.isAtMost(getDifference(D_LQTYGain_M1, D_expectedLQTYGain_M1), 1e15)
      assert.isAtMost(getDifference(F1_LQTYGain_M1, F1_expectedLQTYGain_M1), 1e15)
      assert.isAtMost(getDifference(F2_LQTYGain_M1, F2_expectedLQTYGain_M1), 1e15)

      // E deposits 300 via F1
      await stabilityPool.provideToSP(dec(300, 18), frontEnd_1, { from: E })

      assert.equal(await stabilityPool.getTotalCLVDeposits(), dec(800, 18))

      // Month 2 passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // LIQUIDATION 2
      await cdpManager.liquidate(defaulter_2)
      assert.isFalse(await sortedCDPs.contains(defaulter_2))

      assert.equal(await stabilityPool.getTotalCLVDeposits(), dec(600, 18))

      const startTime = await communityIssuanceTester.deploymentTime()
      const currentTime = await th.getLatestBlockTimestamp(web3)
      const timePassed = toBN(currentTime).sub(startTime)

      // --- CHECK GAINS AFTER L2 ---

      // During month 2, deposit sizes:  A:50,   B:100, C:150,  D:200, E:300. Total: 800

      // Expected gains for each depositor after month 2 
      const A_share_M2 = issuance_M2.mul(toBN('50')).div(toBN('800'))
      const A_expectedLQTYGain_M2 = F1_kickbackRate.mul(A_share_M2).div(toBN(dec(1, 18)))

      const B_share_M2 = issuance_M2.mul(toBN('100')).div(toBN('800'))
      const B_expectedLQTYGain_M2 = F2_kickbackRate.mul(B_share_M2).div(toBN(dec(1, 18)))

      const C_share_M2 = issuance_M2.mul(toBN('150')).div(toBN('800'))
      const C_expectedLQTYGain_M2 = F2_kickbackRate.mul(C_share_M2).div(toBN(dec(1, 18)))

      const D_share_M2 = issuance_M2.mul(toBN('200')).div(toBN('800'))
      const D_expectedLQTYGain_M2 = D_share_M2

      const E_share_M2 = issuance_M2.mul(toBN('300')).div(toBN('800'))
      const E_expectedLQTYGain_M2 = F1_kickbackRate.mul(E_share_M2).div(toBN(dec(1, 18)))

      // F1's stake = A + E
      const F1_expectedLQTYGain_M2 = toBN(dec(1, 18))
        .sub(F1_kickbackRate)
        .mul(A_share_M2.add(E_share_M2))
        .div(toBN(dec(1, 18)))

      // F2's stake = B + C
      const F2_expectedLQTYGain_M2 = toBN(dec(1, 18))
        .sub(F2_kickbackRate)
        .mul(B_share_M2.add(C_share_M2))
        .div(toBN(dec(1, 18)))

      // Check LQTY gains after month 2
      const A_LQTYGain_After_M2 = await stabilityPool.getDepositorLQTYGain(A)
      const B_LQTYGain_After_M2 = await stabilityPool.getDepositorLQTYGain(B)
      const C_LQTYGain_After_M2 = await stabilityPool.getDepositorLQTYGain(C)
      const D_LQTYGain_After_M2 = await stabilityPool.getDepositorLQTYGain(D)
      const E_LQTYGain_After_M2 = await stabilityPool.getDepositorLQTYGain(E)
      const F1_LQTYGain_After_M2 = await stabilityPool.getFrontEndLQTYGain(frontEnd_1)
      const F2_LQTYGain_After_M2 = await stabilityPool.getFrontEndLQTYGain(frontEnd_2)

      assert.isAtMost(getDifference(A_LQTYGain_After_M2, A_expectedLQTYGain_M2.add(A_expectedLQTYGain_M1)), 1e15)
      assert.isAtMost(getDifference(B_LQTYGain_After_M2, B_expectedLQTYGain_M2.add(B_expectedLQTYGain_M1)), 1e15)
      assert.isAtMost(getDifference(C_LQTYGain_After_M2, C_expectedLQTYGain_M2.add(C_expectedLQTYGain_M1)), 1e15)
      assert.isAtMost(getDifference(D_LQTYGain_After_M2, D_expectedLQTYGain_M2.add(D_expectedLQTYGain_M1)), 1e15)
      assert.isAtMost(getDifference(E_LQTYGain_After_M2, E_expectedLQTYGain_M2), 1e15)

      // Check F1 balance is his M1 gain (it was paid out when E joined through F1)
      const F1_LQTYBalance_After_M2 = await growthToken.balanceOf(frontEnd_1)
      assert.isAtMost(getDifference(F1_LQTYBalance_After_M2, F1_expectedLQTYGain_M1), 1e15)

      // Check F1's LQTY gain in system after M2: Just their gain due to M2
      assert.isAtMost(getDifference(F1_LQTYGain_After_M2, F1_expectedLQTYGain_M2), 1e15)

      // Check F2 LQTY gain in system after M2: the sum of their gains from M1 + M2
      assert.isAtMost(getDifference(F2_LQTYGain_After_M2, F2_expectedLQTYGain_M2.add(F2_expectedLQTYGain_M1)), 1e15)


      // B tops up 400 via F2
      await stabilityPool.provideToSP(dec(400, 18), frontEnd_2, { from: B })

      assert.equal(await stabilityPool.getTotalCLVDeposits(), dec(1000, 18))

      // Month 3 passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // LIQUIDATION 3
      await cdpManager.liquidate(defaulter_3)
      assert.isFalse(await sortedCDPs.contains(defaulter_3))

      assert.equal(await stabilityPool.getTotalCLVDeposits(), dec(900, 18))

      // --- CHECK GAINS AFTER L3 ---

      // During month 3, deposit sizes: A:37.5, B:475, C:112.5, D:150, E:225, Total: 1000

      // Expected gains for each depositor after month 3 
      const A_share_M3 = issuance_M3.mul(toBN('375')).div(toBN('10000'))  // 37.5/1000
      const A_expectedLQTYGain_M3 = F1_kickbackRate.mul(A_share_M3).div(toBN(dec(1, 18)))

      const B_share_M3 = issuance_M3.mul(toBN('475')).div(toBN('1000'))
      const B_expectedLQTYGain_M3 = F2_kickbackRate.mul(B_share_M3).div(toBN(dec(1, 18)))

      const C_share_M3 = issuance_M3.mul(toBN('1125')).div(toBN('10000'))
      const C_expectedLQTYGain_M3 = F2_kickbackRate.mul(C_share_M3).div(toBN(dec(1, 18)))

      const D_share_M3 = issuance_M3.mul(toBN('150')).div(toBN('1000'))
      const D_expectedLQTYGain_M3 = D_share_M3

      const E_share_M3 = issuance_M3.mul(toBN('225')).div(toBN('1000'))
      const E_expectedLQTYGain_M3 = F1_kickbackRate.mul(E_share_M3).div(toBN(dec(1, 18)))

      // F1's stake = A + E
      const F1_expectedLQTYGain_M3 = toBN(dec(1, 18))
        .sub(F1_kickbackRate)
        .mul(A_share_M3.add(E_share_M3))
        .div(toBN(dec(1, 18)))

      // F2's stake = B + C
      const F2_expectedLQTYGain_M3 = toBN(dec(1, 18))
        .sub(F2_kickbackRate)
        .mul(B_share_M3.add(C_share_M3))
        .div(toBN(dec(1, 18)))

      // Check LQTY gains after month 3
      const A_LQTYGain_After_M3 = await stabilityPool.getDepositorLQTYGain(A)
      const B_LQTYGain_After_M3 = await stabilityPool.getDepositorLQTYGain(B)
      const C_LQTYGain_After_M3 = await stabilityPool.getDepositorLQTYGain(C)
      const D_LQTYGain_After_M3 = await stabilityPool.getDepositorLQTYGain(D)
      const E_LQTYGain_After_M3 = await stabilityPool.getDepositorLQTYGain(E)
      const F1_LQTYGain_After_M3 = await stabilityPool.getFrontEndLQTYGain(frontEnd_1)
      const F2_LQTYGain_After_M3 = await stabilityPool.getFrontEndLQTYGain(frontEnd_2)

      // Expect A, C, D LQTY system gains to equal their gains from (M1 + M2 + M3)
      assert.isAtMost(getDifference(A_LQTYGain_After_M3, A_expectedLQTYGain_M3.add(A_expectedLQTYGain_M2).add(A_expectedLQTYGain_M1)), 1e15)
      assert.isAtMost(getDifference(C_LQTYGain_After_M3, C_expectedLQTYGain_M3.add(C_expectedLQTYGain_M2).add(C_expectedLQTYGain_M1)), 1e15)
      assert.isAtMost(getDifference(D_LQTYGain_After_M3, D_expectedLQTYGain_M3.add(D_expectedLQTYGain_M2).add(D_expectedLQTYGain_M1)), 1e15)

      // Expect E's LQTY system gain to equal their gains from (M2 + M3)
      assert.isAtMost(getDifference(E_LQTYGain_After_M3, E_expectedLQTYGain_M3.add(E_expectedLQTYGain_M2)), 1e15)

      // Expect B LQTY system gains to equal gains just from M3 (his topup paid out his gains from M1 + M2)
      assert.isAtMost(getDifference(B_LQTYGain_After_M3, B_expectedLQTYGain_M3), 1e15)

      // Expect B LQTY balance to equal gains from (M1 + M2)
      const B_LQTYBalance_After_M3 = await await growthToken.balanceOf(B)
      assert.isAtMost(getDifference(B_LQTYBalance_After_M3, B_expectedLQTYGain_M2.add(B_expectedLQTYGain_M1)), 1e15)

      // Expect F1 LQTY system gains to equal their gain from (M2 + M3)
      assert.isAtMost(getDifference(F1_LQTYGain_After_M3, F1_expectedLQTYGain_M3.add(F1_expectedLQTYGain_M2)), 1e15)

      // Expect F1 LQTY balance to equal their M1 gain
      const F1_LQTYBalance_After_M3 = await growthToken.balanceOf(frontEnd_1)
      assert.isAtMost(getDifference(F1_LQTYBalance_After_M3, F1_expectedLQTYGain_M1), 1e15)

      // Expect F2 LQTY system gains to equal their gain from M3
      assert.isAtMost(getDifference(F2_LQTYGain_After_M3, F2_expectedLQTYGain_M3), 1e15)

      // Expect F2 LQTY balance to equal their gain from M1 + M2
      const F2_LQTYBalance_After_M3 = await growthToken.balanceOf(frontEnd_2)
      assert.isAtMost(getDifference(F2_LQTYBalance_After_M3, F2_expectedLQTYGain_M2.add(F2_expectedLQTYGain_M1)), 1e15)

      // Expect deposit C now to be 101.25 CLV
      const C_compoundedCLVDeposit = await stabilityPool.getCompoundedCLVDeposit(C)
      assert.isAtMost(getDifference(C_compoundedCLVDeposit, dec(10125, 16)), 1000)

      // --- C withdraws ---

      assert.equal(await stabilityPool.getTotalCLVDeposits(), dec(900, 18))

      await stabilityPool.withdrawFromSP(dec(100, 18), { from: C })

      assert.equal(await stabilityPool.getTotalCLVDeposits(), dec(800, 18))

      // Month 4 passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // All depositors fully withdraw
      for (depositor of [A, B, C, D, E]) {
        await stabilityPool.withdrawFromSP(dec(1000, 18), { from: depositor })
        const compoundedCLVDeposit = await stabilityPool.getCompoundedCLVDeposit(depositor)
        assert.equal(compoundedCLVDeposit, '0')
      }

      // During month 4, deposit sizes: A:33.75, B:427.5, C:1.25, D:135, E:202.5, Total: 800

      // Expected gains for each depositor after month 4
      const A_share_M4 = issuance_M4.mul(toBN('3375')).div(toBN('80000'))  // 33.75/800
      const A_expectedLQTYGain_M4 = F1_kickbackRate.mul(A_share_M4).div(toBN(dec(1, 18)))

      const B_share_M4 = issuance_M4.mul(toBN('4275')).div(toBN('8000')) // 427.5/800
      const B_expectedLQTYGain_M4 = F2_kickbackRate.mul(B_share_M4).div(toBN(dec(1, 18)))

      const C_share_M4 = issuance_M4.mul(toBN('125')).div(toBN('80000')) // 1.25/800
      const C_expectedLQTYGain_M4 = F2_kickbackRate.mul(C_share_M4).div(toBN(dec(1, 18)))

      const D_share_M4 = issuance_M4.mul(toBN('135')).div(toBN('800'))
      const D_expectedLQTYGain_M4 = D_share_M4

      const E_share_M4 = issuance_M4.mul(toBN('2025')).div(toBN('8000')) // 202.5/800
      const E_expectedLQTYGain_M4 = F1_kickbackRate.mul(E_share_M4).div(toBN(dec(1, 18)))

      // F1's stake = A + E
      const F1_expectedLQTYGain_M4 = toBN(dec(1, 18))
        .sub(F1_kickbackRate)
        .mul(A_share_M4.add(E_share_M4))
        .div(toBN(dec(1, 18)))

      // F2's stake = B + C
      const F2_expectedLQTYGain_M4 = toBN(dec(1, 18))
        .sub(F2_kickbackRate)
        .mul(B_share_M4.add(C_share_M4))
        .div(toBN(dec(1, 18)))

      // Get final LQTY balances
      const A_FinalLQTYBalance = await growthToken.balanceOf(A)
      const B_FinalLQTYBalance = await growthToken.balanceOf(B)
      const C_FinalLQTYBalance = await growthToken.balanceOf(C)
      const D_FinalLQTYBalance = await growthToken.balanceOf(D)
      const E_FinalLQTYBalance = await growthToken.balanceOf(E)
      const F1_FinalLQTYBalance = await growthToken.balanceOf(frontEnd_1)
      const F2_FinalLQTYBalance = await growthToken.balanceOf(frontEnd_2)

      const A_expectedFinalLQTYBalance = A_expectedLQTYGain_M1
        .add(A_expectedLQTYGain_M2)
        .add(A_expectedLQTYGain_M3)
        .add(A_expectedLQTYGain_M4)

      const B_expectedFinalLQTYBalance = B_expectedLQTYGain_M1
        .add(B_expectedLQTYGain_M2)
        .add(B_expectedLQTYGain_M3)
        .add(B_expectedLQTYGain_M4)

      const C_expectedFinalLQTYBalance = C_expectedLQTYGain_M1
        .add(C_expectedLQTYGain_M2)
        .add(C_expectedLQTYGain_M3)
        .add(C_expectedLQTYGain_M4)

      const D_expectedFinalLQTYBalance = D_expectedLQTYGain_M1
        .add(D_expectedLQTYGain_M2)
        .add(D_expectedLQTYGain_M3)
        .add(D_expectedLQTYGain_M4)

      const E_expectedFinalLQTYBalance = E_expectedLQTYGain_M2
        .add(E_expectedLQTYGain_M3)
        .add(E_expectedLQTYGain_M4)

      const F1_expectedFinalLQTYBalance = F1_expectedLQTYGain_M1
        .add(F1_expectedLQTYGain_M2)
        .add(F1_expectedLQTYGain_M3)
        .add(F1_expectedLQTYGain_M4)

      const F2_expectedFinalLQTYBalance = F2_expectedLQTYGain_M1
        .add(F2_expectedLQTYGain_M2)
        .add(F2_expectedLQTYGain_M3)
        .add(F2_expectedLQTYGain_M4)
 
      assert.isAtMost(getDifference(A_FinalLQTYBalance, A_expectedFinalLQTYBalance), 1e15)
      assert.isAtMost(getDifference(B_FinalLQTYBalance, B_expectedFinalLQTYBalance), 1e15)
      assert.isAtMost(getDifference(C_FinalLQTYBalance, C_expectedFinalLQTYBalance), 1e15)
      assert.isAtMost(getDifference(D_FinalLQTYBalance, D_expectedFinalLQTYBalance), 1e15)
      assert.isAtMost(getDifference(E_FinalLQTYBalance, E_expectedFinalLQTYBalance), 1e15)
      assert.isAtMost(getDifference(F1_FinalLQTYBalance, F1_expectedFinalLQTYBalance), 1e15)
      assert.isAtMost(getDifference(F2_FinalLQTYBalance, F2_expectedFinalLQTYBalance), 1e15)
    })
  })
})

contract('Reset chain state', async accounts => { })
