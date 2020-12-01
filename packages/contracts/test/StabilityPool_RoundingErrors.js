
const deploymentHelpers = require("../utils/truffleDeploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th  = testHelpers.TestHelper
const dec = th.dec

contract('Pool Manager: Sum-Product rounding errors', async accounts => {

  const whale = accounts[0]

  let contracts

  let priceFeed
  let lusdToken
  let stabilityPool
  let troveManager
  let borrowerOperations

  beforeEach(async () => {
    contracts = await deployLiquity()
    
    priceFeed = contracts.priceFeedTestnet
    lusdToken = contracts.lusdToken
    stabilityPool = contracts.stabilityPool
    troveManager = contracts.troveManager
    borrowerOperations = contracts.borrowerOperations

    const contractAddresses = getAddresses(contracts)
    await connectContracts(contracts, contractAddresses)
  })

  // skipped to not slow down CI
  it.skip("Rounding errors: 100 deposits of 100LUSD into SP, then 200 liquidations of 49LUSD", async () => {
    const owner = accounts[0]
    const depositors = accounts.slice(1, 101)
    const defaulters = accounts.slice(101, 301)

    for (let account of depositors) {
      await borrowerOperations.openTrove(dec(100, 18), account, { from: account, value: dec(4, 'ether') })
      await stabilityPool.provideToSP(dec(100, 18), { from: account })
    }

    // Defaulter opens trove with 200% ICR
    for (let defaulter of defaulters) {
      await borrowerOperations.openTrove(dec(39, 18),  defaulter, { from: defaulter, value: dec(49, 16) })
    }
    const price = await priceFeed.getPrice()

    // price drops by 50%: defaulter ICR falls to 100%
    await priceFeed.setPrice(dec(100, 18));

    // Defaulters liquidated
    for (let defaulter of defaulters) {
      await troveManager.liquidate(defaulter, { from: owner });
    }

    const SP_TotalDeposits = await stabilityPool.getTotalLUSDDeposits()
    const SP_ETH = await stabilityPool.getETH()
    const compoundedDeposit = await stabilityPool.getCompoundedLUSDDeposit(depositors[0])
    const ETH_Gain = await stabilityPool.getCurrentETHGain(depositors[0])

    // Check depostiors receive their share without too much error
    assert.isAtMost(th.getDifference(SP_TotalDeposits.div(th.toBN(depositors.length)), compoundedDeposit), 1000)
    assert.isAtMost(th.getDifference(SP_ETH.div(th.toBN(depositors.length)), ETH_Gain), 1000)
  })
})

contract('Reset chain state', async accounts => { })
