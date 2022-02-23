const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN

const VSTToken = artifacts.require("VSTToken")
const TroveManagerTester = artifacts.require("TroveManagerTester")
const StabilityPool = artifacts.require('StabilityPool.sol')

contract('Pool Manager: Sum-Product rounding errors', async accounts => {
  const ZERO_ADDRESS = th.ZERO_ADDRESS

  const openTrove = async (params) => th.openTrove(contracts, params)

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)
  const whale = accounts[0]
  let contracts

  let priceFeed
  let stabilityPool
  let stabilityPoolERC20
  let troveManager
  let borrowerOperations
  let erc20

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts.vstToken = await VSTTokenTester.new(
      contracts.troveManager.address,
      contracts.stabilityPoolManager.address,
      contracts.borrowerOperations.address
    )
    const VSTAContracts = await deploymentHelper.deployVSTAContractsHardhat(accounts[0])


    priceFeed = contracts.priceFeedTestnet
    troveManager = contracts.troveManager
    borrowerOperations = contracts.borrowerOperations
    erc20 = contracts.erc20;

    let index = 0;
    for (const acc of accounts) {
      await erc20.mint(acc, await web3.eth.getBalance(acc))
      index++;

      if (index >= 400)
        break;
    }

    await deploymentHelper.connectCoreContracts(contracts, VSTAContracts)
    await deploymentHelper.connectVSTAContractsToCore(VSTAContracts, contracts)

    stabilityPool = await StabilityPool.at(await contracts.stabilityPoolManager.getAssetStabilityPool(ZERO_ADDRESS))
    stabilityPoolERC20 = await StabilityPool.at(await contracts.stabilityPoolManager.getAssetStabilityPool(erc20.address));
  })

  // skipped to not slow down CI
  it.skip("Rounding errors: 100 deposits of 100VST into SP, then 200 liquidations of 49VST", async () => {
    const owner = accounts[0]
    const depositors = accounts.slice(1, 101)
    const defaulters = accounts.slice(101, 301)

    for (let account of depositors) {
      await openTrove({ extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
      await stabilityPool.provideToSP(dec(100, 18), { from: account })

      await openTrove({ asset: erc20.address, extraVSTAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
      await stabilityPoolERC20.provideToSP(dec(100, 18), { from: account })
    }

    // Defaulter opens trove with 200% ICR
    for (let defaulter of defaulters) {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter } })
      await openTrove({ asset: erc20.address, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter } })
    }
    const price = await priceFeed.getPrice()

    // price drops by 50%: defaulter ICR falls to 100%
    await priceFeed.setPrice(dec(105, 18));

    // Defaulters liquidated
    for (let defaulter of defaulters) {
      await troveManager.liquidate(ZERO_ADDRESS, defaulter, { from: owner });
      await troveManager.liquidate(erc20.address, defaulter, { from: owner });
    }

    const SP_TotalDeposits = await stabilityPool.getTotalVSTDeposits()
    const SP_ETH = await stabilityPool.getAssetBalance()
    const compoundedDeposit = await stabilityPool.getCompoundedVSTDeposit(depositors[0])
    const ETH_Gain = await stabilityPool.getDepositorAssetGain(depositors[0])

    // Check depostiors receive their share without too much error
    assert.isAtMost(th.getDifference(SP_TotalDeposits.div(th.toBN(depositors.length)), compoundedDeposit), 100000)
    assert.isAtMost(th.getDifference(SP_ETH.div(th.toBN(depositors.length)), ETH_Gain), 100000)


    const SP_TotalDepositsERC20 = await stabilityPoolERC20.getTotalVSTDeposits()
    const SP_ETHERC20 = await stabilityPoolERC20.getAssetBalance()
    const compoundedDepositERC20 = await stabilityPoolERC20.getCompoundedVSTDeposit(depositors[0])
    const ETH_GainERC20 = await stabilityPoolERC20.getDepositorAssetGain(depositors[0])

    // Check depostiors receive their share without too much error
    assert.isAtMost(th.getDifference(SP_TotalDepositsERC20.div(th.toBN(depositors.length)), compoundedDepositERC20), 100000)
    assert.isAtMost(th.getDifference(SP_ETHERC20.div(th.toBN(depositors.length)), ETH_GainERC20), 100000)
  })
})

contract('Reset chain state', async accounts => { })
