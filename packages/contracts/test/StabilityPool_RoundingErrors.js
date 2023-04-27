
const deploymentHelpers = require("../utils/truffleDeploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th = testHelpers.TestHelper
const dec = th.dec

contract('Pool Manager: Sum-Product rounding errors', async accounts => {

  const whale = accounts[0]

  let contracts

  let priceFeed
  let oneusdToken
  let stabilityPool
  let troveManager
  let borrowerOperations

  beforeEach(async () => {
    contracts = await deployLiquity()

    priceFeed = contracts.priceFeedTestnet
    oneusdToken = contracts.oneusdToken
    stabilityPool = contracts.stabilityPool
    troveManager = contracts.troveManager
    borrowerOperations = contracts.borrowerOperations

    const contractAddresses = getAddresses(contracts)
    await connectContracts(contracts, contractAddresses)
  })

  // skipped to not slow down CI
  it.skip("Rounding errors: 100 deposits of 1001USD into SP, then 200 liquidations of 491USD", async () => {
    const owner = accounts[0]
    const depositors = accounts.slice(1, 101)
    const defaulters = accounts.slice(101, 301)

    for (let account of depositors) {
      await openTrove({ extra1USDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
      await stabilityPool.provideToSP(dec(100, 18), { from: account })
    }

    // Defaulter opens trove with 200% ICR
    for (let defaulter of defaulters) {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter } })
    }
    const price = await priceFeed.getPrice()

    // price drops by 50%: defaulter ICR falls to 100%
    await priceFeed.setPrice(dec(105, 18));

    // Defaulters liquidated
    for (let defaulter of defaulters) {
      await troveManager.liquidate(defaulter, { from: owner });
    }

    const SP_TotalDeposits = await stabilityPool.getTotal1USDDeposits()
    const SP_ONE = await stabilityPool.getONE()
    const compoundedDeposit = await stabilityPool.getCompounded1USDDeposit(depositors[0])
    const ONE_Gain = await stabilityPool.getCurrentONEGain(depositors[0])

    // Check depostiors receive their share without too much error
    assert.isAtMost(th.getDifference(SP_TotalDeposits.div(th.toBN(depositors.length)), compoundedDeposit), 100000)
    assert.isAtMost(th.getDifference(SP_ONE.div(th.toBN(depositors.length)), ONE_Gain), 100000)
  })
})

contract('Reset chain state', async accounts => { })
