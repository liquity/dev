const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const VSTTokenTester = artifacts.require("./VSTTokenTester.sol")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const assertRevert = th.assertRevert
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues


/* NOTE: Some tests involving ETH redemption fees do not test for specific fee values.
 * Some only test that the fees are non-zero when they should occur.
 *
 * Specific ETH gain values will depend on the final fee schedule used, and the final choices for
 * the parameter BETA in the TroveManager, which is still TBD based on economic modelling.
 * 
 */
contract('TroveManager', async accounts => {

  const ZERO_ADDRESS = th.ZERO_ADDRESS
  const [owner, A, B, C, D, E, F] = accounts.slice(0, 7);

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let priceFeed
  let VSTToken
  let sortedTroves
  let troveManager
  let activePool
  let collSurplusPool
  let defaultPool
  let borrowerOperations
  let hintHelpers

  let contracts

  const getOpenTroveVSTAmount = async (totalDebt, asset) => th.getOpenTroveVSTAmount(contracts, totalDebt, asset)

  const getSnapshotsRatio = async (asset) => {
    const ratio = (await troveManager.totalStakesSnapshot(asset))
      .mul(toBN(dec(1, 18)))
      .div((await troveManager.totalCollateralSnapshot(asset)))

    return ratio
  }

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
    VSTToken = contracts.vstToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    defaultPool = contracts.defaultPool
    collSurplusPool = contracts.collSurplusPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    VSTAStaking = VSTAContracts.VSTAStaking
    VSTAToken = VSTAContracts.VSTAToken
    communityIssuance = VSTAContracts.communityIssuance

    await deploymentHelper.connectCoreContracts(contracts, VSTAContracts)
    await deploymentHelper.connectVSTAContractsToCore(VSTAContracts, contracts)
  })

  it("A given trove's stake decline is negligible with adjustments and tiny liquidations", async () => {
    await priceFeed.setPrice(dec(100, 18))

    // Make 1 mega troves A at ~50% total collateral
    await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getOpenTroveVSTAmount(dec(1, 31), ZERO_ADDRESS), ZERO_ADDRESS, ZERO_ADDRESS, { from: A, value: dec(2, 29) })

    // Make 5 large troves B, C, D, E, F at ~10% total collateral
    await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getOpenTroveVSTAmount(dec(2, 30), ZERO_ADDRESS), ZERO_ADDRESS, ZERO_ADDRESS, { from: B, value: dec(4, 28) })
    await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getOpenTroveVSTAmount(dec(2, 30), ZERO_ADDRESS), ZERO_ADDRESS, ZERO_ADDRESS, { from: C, value: dec(4, 28) })
    await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getOpenTroveVSTAmount(dec(2, 30), ZERO_ADDRESS), ZERO_ADDRESS, ZERO_ADDRESS, { from: D, value: dec(4, 28) })
    await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getOpenTroveVSTAmount(dec(2, 30), ZERO_ADDRESS), ZERO_ADDRESS, ZERO_ADDRESS, { from: E, value: dec(4, 28) })
    await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getOpenTroveVSTAmount(dec(2, 30), ZERO_ADDRESS), ZERO_ADDRESS, ZERO_ADDRESS, { from: F, value: dec(4, 28) })

    // Make 10 tiny troves at relatively negligible collateral (~1e-9 of total)
    const tinyTroves = accounts.slice(10, 20)
    for (account of tinyTroves) {
      await borrowerOperations.openTrove(ZERO_ADDRESS, 0, th._100pct, await getOpenTroveVSTAmount(dec(1, 22), ZERO_ADDRESS), ZERO_ADDRESS, ZERO_ADDRESS, { from: account, value: dec(2, 20) })
    }

    // liquidate 1 trove at ~50% total system collateral
    await priceFeed.setPrice(dec(50, 18))
    assert.isTrue(await troveManager.checkRecoveryMode(ZERO_ADDRESS, await priceFeed.getPrice()))
    await troveManager.liquidate(ZERO_ADDRESS, A)

    console.log(`totalStakesSnapshot after L1: ${await troveManager.totalStakesSnapshot(ZERO_ADDRESS)}`)
    console.log(`totalCollateralSnapshot after L1: ${await troveManager.totalCollateralSnapshot(ZERO_ADDRESS)}`)
    console.log(`Snapshots ratio after L1: ${await getSnapshotsRatio(ZERO_ADDRESS)}`)
    console.log(`B pending ETH reward after L1: ${await troveManager.getPendingAssetReward(ZERO_ADDRESS, B)}`)
    console.log(`B stake after L1: ${(await troveManager.Troves(B, ZERO_ADDRESS))[th.TROVE_STAKE_INDEX]}`)

    // adjust trove B 1 wei: apply rewards
    await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, 1, false, ZERO_ADDRESS, ZERO_ADDRESS, { from: B })  // B repays 1 wei
    console.log(`B stake after A1: ${(await troveManager.Troves(B, ZERO_ADDRESS))[th.TROVE_STAKE_INDEX]}`)
    console.log(`Snapshots ratio after A1: ${await getSnapshotsRatio(ZERO_ADDRESS)}`)

    // Loop over tiny troves, and alternately:
    // - Liquidate a tiny trove
    // - Adjust B's collateral by 1 wei
    for (let [idx, trove] of tinyTroves.entries()) {
      await troveManager.liquidate(ZERO_ADDRESS, trove)
      console.log(`B stake after L${idx + 2}: ${(await troveManager.Troves(B, ZERO_ADDRESS))[th.TROVE_STAKE_INDEX]}`)
      console.log(`Snapshots ratio after L${idx + 2}: ${await getSnapshotsRatio(ZERO_ADDRESS)}`)
      await borrowerOperations.adjustTrove(ZERO_ADDRESS, 0, th._100pct, 0, 1, false, ZERO_ADDRESS, ZERO_ADDRESS, { from: B })  // A repays 1 wei
      console.log(`B stake after A${idx + 2}: ${(await troveManager.Troves(B, ZERO_ADDRESS))[th.TROVE_STAKE_INDEX]}`)
    }
  })

  // TODO: stake decline for adjustments with sizable liquidations, for comparison
})
