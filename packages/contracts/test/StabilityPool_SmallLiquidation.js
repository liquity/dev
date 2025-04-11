const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const toBN = th.toBN
const getDifference = th.getDifference

const TroveManagerTester = artifacts.require("TroveManagerTester")
const LUSDToken = artifacts.require("LUSDToken")

const GAS_PRICE = 10000000

contract('StabilityPool - Small Liquidation', async accounts => {

  const [
    owner,
    whale,
    A, B, C, D, E, F, G, H,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4, defaulter_5, defaulter_6,
    frontEnd_1, frontEnd_2, frontEnd_3
  ] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let contracts

  let priceFeed
  let lusdToken
  let stabilityPool
  let sortedTroves
  let troveManager
  let borrowerOperations
  let lqtyToken
  let communityIssuanceTester

  let communityLQTYSupply
  let issuance_M1
  let issuance_M2
  let issuance_M3
  let issuance_M4
  let issuance_M5
  let issuance_M6

  const ZERO_ADDRESS = th.ZERO_ADDRESS

  const getOpenTroveLUSDAmount = async (totalDebt) => th.getOpenTroveLUSDAmount(contracts, totalDebt)

  const openTrove = async (params) => th.openTrove(contracts, params)
  describe("Small Liquidation", async () => {

    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      contracts.troveManager = await TroveManagerTester.new()
      contracts.lusdToken = await LUSDToken.new(
        contracts.troveManager.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address
      )
      const LQTYContracts = await deploymentHelper.deployLQTYTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)

      priceFeed = contracts.priceFeedTestnet
      lusdToken = contracts.lusdToken
      stabilityPool = contracts.stabilityPool
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      stabilityPool = contracts.stabilityPool
      borrowerOperations = contracts.borrowerOperations

      lqtyToken = LQTYContracts.lqtyToken
      communityIssuanceTester = LQTYContracts.communityIssuance

      await deploymentHelper.connectLQTYContracts(LQTYContracts)
      await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
      await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

      // Check community issuance starts with 32 million LQTY
      communityLQTYSupply = toBN(await lqtyToken.balanceOf(communityIssuanceTester.address))
      assert.isAtMost(getDifference(communityLQTYSupply, '32000000000000000000000000'), 1000)

      /* Monthly LQTY issuance
  
        Expected fraction of total supply issued per month, for a yearly halving schedule
        (issuance in each month, not cumulative):
    
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

    it("a small liquidation works", async () => {
      
      
      await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: {from: A } })
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: {from: B } })
      await openTrove({ extraLUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: {from: C } })

      // A provides to SP
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: A })

      await th.fastForwardTime(timeValues.MINUTES_IN_ONE_WEEK, web3.currentProvider)

      await priceFeed.fetchPrice();
      let initial_price = await priceFeed.getPrice();
      console.log("initial_price=", initial_price.toString());

      await priceFeed.setPrice(dec(105, 18))

      let currentDeposits = await stabilityPool.getTotalLUSDDeposits() 
      console.log("currentDeposits at start =", currentDeposits.toString());
      await troveManager.liquidate(B, {from: A})
      currentDeposits = await stabilityPool.getTotalLUSDDeposits() 
      console.log("currentDeposits after 1st liq =", currentDeposits.toString());

      let lastLUSDLossError_Offset = await stabilityPool.lastLUSDLossError_Offset()
      console.log("lastLUSDLossError_Offset =", lastLUSDLossError_Offset.toString());

      await priceFeed.setPrice(dec(200, 18))

      currentDeposits = await stabilityPool.getTotalLUSDDeposits() 
      console.log("currentDeposits before withdraw =", currentDeposits.toString());

      await stabilityPool.withdrawFromSP(currentDeposits.sub(toBN(dec(1, 18))).sub(toBN(1)), {'from': A})

      currentDeposits = await stabilityPool.getTotalLUSDDeposits() 
      console.log("currentDeposits after withdraw =", currentDeposits.toString());
      await priceFeed.setPrice(dec(105, 18))
      await troveManager.liquidate(C)
    })

  })
})

contract('Reset chain state', async accounts => { })
