const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants")
const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")
const NonPayable = artifacts.require('NonPayable.sol')

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const TroveManagerTester = artifacts.require("TroveManagerTester")
const VSTTokenTester = artifacts.require("VSTTokenTester")

contract('CollSurplusPool', async accounts => {
  const [
    owner,
    A, B, C, D, E] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let borrowerOperations
  let priceFeed
  let collSurplusPool

  let contracts

  const getOpenTroveVSTAmount = async (totalDebt, asset) => th.getOpenTroveVSTAmount(contracts, totalDebt, asset)
  const openTrove = async (params) => th.openTrove(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts.vstToken = await VSTTokenTester.new(
      contracts.troveManager.address,
      contracts.stabilityPoolManager.address,
      contracts.borrowerOperations.address,
    )
    const VSTAContracts = await deploymentHelper.deployVSTAContractsHardhat(accounts[0])

    priceFeed = contracts.priceFeedTestnet
    collSurplusPool = contracts.collSurplusPool
    borrowerOperations = contracts.borrowerOperations

    await deploymentHelper.connectCoreContracts(contracts, VSTAContracts)
    await deploymentHelper.connectVSTAContractsToCore(VSTAContracts, contracts)
  })

  it("CollSurplusPool::getETH(): Returns the ETH balance of the CollSurplusPool after redemption", async () => {
    const ETH_1 = await collSurplusPool.getAssetBalance(ZERO_ADDRESS)
    assert.equal(ETH_1, '0')

    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price)

    const { collateral: B_coll, netDebt: B_netDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: B } })
    await openTrove({ extraVSTAmount: B_netDebt, extraParams: { from: A, value: dec(3000, 'ether') } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // At ETH:USD = 100, this redemption should leave 1 ether of coll surplus
    await th.redeemCollateralAndGetTxObject(A, contracts, B_netDebt)

    const ETH_2 = await collSurplusPool.getAssetBalance(ZERO_ADDRESS)
    th.assertIsApproximatelyEqual(ETH_2, B_coll.sub(B_netDebt.mul(mv._1e18BN).div(price)))
  })

  it("CollSurplusPool: claimColl(): Reverts if caller is not Borrower Operations", async () => {
    await th.assertRevert(collSurplusPool.claimColl(ZERO_ADDRESS, A, { from: A }), 'CollSurplusPool: Caller is not Borrower Operations')
  })

  it("CollSurplusPool: claimColl(): Reverts if nothing to claim", async () => {
    await th.assertRevert(borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: A }), 'CollSurplusPool: No collateral available to claim')
  })

  it("CollSurplusPool: claimColl(): Reverts if owner cannot receive ETH surplus", async () => {
    const nonPayable = await NonPayable.new()

    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price)

    // open trove from NonPayable proxy contract
    const B_coll = toBN(dec(60, 18))
    const B_VSTAmount = toBN(dec(3000, 18))
    const B_netDebt = await th.getAmountWithBorrowingFee(contracts, B_VSTAmount)
    const openTroveData = th.getTransactionData('openTrove(address,uint256,uint256,uint256,address,address)', [ZERO_ADDRESS, 0, '0xde0b6b3a7640000', web3.utils.toHex(B_VSTAmount), B, B])
    await nonPayable.forward(borrowerOperations.address, openTroveData, { value: B_coll })
    await openTrove({ extraVSTAmount: B_netDebt, extraParams: { from: A, value: dec(3000, 'ether') } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // At ETH:USD = 100, this redemption should leave 1 ether of coll surplus for B
    await th.redeemCollateralAndGetTxObject(A, contracts, B_netDebt)

    const ETH_2 = await collSurplusPool.getAssetBalance(ZERO_ADDRESS)
    th.assertIsApproximatelyEqual(ETH_2, B_coll.sub(B_netDebt.mul(mv._1e18BN).div(price)))

    const claimCollateralData = th.getTransactionData('claimCollateral(address)', [ZERO_ADDRESS])
    await th.assertRevert(nonPayable.forward(borrowerOperations.address, claimCollateralData), 'CollSurplusPool: sending ETH failed')
  })

  it('CollSurplusPool: reverts trying to send ETH to it', async () => {
    await th.assertRevert(web3.eth.sendTransaction({ from: A, to: collSurplusPool.address, value: 1 }), 'CollSurplusPool: Caller is not Active Pool')
  })

  it('CollSurplusPool: accountSurplus: reverts if caller is not Trove Manager', async () => {
    await th.assertRevert(collSurplusPool.accountSurplus(ZERO_ADDRESS, A, 1), 'CollSurplusPool: Caller is not TroveManager')
  })
})

contract('Reset chain state', async accounts => { })
