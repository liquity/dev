const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const NonPayable = artifacts.require('NonPayable.sol')

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues


contract('CollSUrplusPool', async accounts => {
  const [
    owner,
    A, B, C, D, E] = accounts;

  let borrowerOperations
  let priceFeed
  let collSurplusPool

  let contracts

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    const LQTYContracts = await deploymentHelper.deployLQTYContracts()

    priceFeed = contracts.priceFeed
    collSurplusPool = contracts.collSurplusPool
    borrowerOperations = contracts.borrowerOperations

    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
  })

  it("CollSurplusPool::getETH(): Returns the ETH balance of the CollSurplusPool after redemption", async () => {
    const ETH_1 = await collSurplusPool.getETH()
    assert.equal(ETH_1, '0')

    await priceFeed.setPrice(dec(100, 18))

    await borrowerOperations.openTrove(dec(100, 18), A, { from: A, value: dec(3000, 'ether') })
    await borrowerOperations.openTrove(dec(50, 18), B, { from: B, value: dec(1, 'ether') })

    // At ETH:USD = 100, this redemption should leave 50% coll surplus for B, i.e. 0.5 ether
    await th.redeemCollateralAndGetTxObject(A, contracts, dec(50, 18))

    const ETH_2 = await collSurplusPool.getETH()
    assert.equal(ETH_2, dec(5, 17))
  })

  it("CollSurplusPool: claimColl(): Reverts if caller is not Borrower Operations", async () => {
    await th.assertRevert(collSurplusPool.claimColl(A, { from: A }), 'CollSurplus: Caller is not Borrower Operations')
  })

  it("CollSurplusPool: claimColl(): Reverts if nothing to claim", async () => {
    await th.assertRevert(borrowerOperations.claimRedeemedCollateral(A), 'CollSurplus: No collateral available to claim')
  })

  it("CollSurplusPool: claimColl(): Reverts if owner cannot receive ETH surplus", async () => {
    const nonPayable = await NonPayable.new()

    await priceFeed.setPrice(dec(100, 18))

    await borrowerOperations.openTrove(dec(100, 18), A, { from: A, value: dec(3000, 'ether') })
    // open trove from NonPayable proxy contract
    const openTroveData = th.getTransactionData('openTrove(uint256,address)', [web3.utils.toHex(dec(50, 18)), B])
    await nonPayable.forward(borrowerOperations.address, openTroveData, { value: dec(1, 'ether') })
    // At ETH:USD = 100, this redemption should leave 50% coll surplus for B, i.e. 0.5 ether
    await th.redeemCollateralAndGetTxObject(A, contracts, dec(50, 18))

    const ETH_2 = await collSurplusPool.getETH()
    assert.equal(ETH_2, dec(5, 17))

    await th.assertRevert(borrowerOperations.claimRedeemedCollateral(B), 'CollSurplus: sending ETH failed')
  })

  it('CollSurplusPool: reverts trying to send ETH to it', async () => {
    await th.assertRevert(web3.eth.sendTransaction({ from: A, to: collSurplusPool.address, value: 1 }), 'CollSurplusPool: Caller is not Active Pool')
  })

  it('CollSurplusPool: accountSurplus: reverts if caller is not CDP Manager', async () => {
    await th.assertRevert(collSurplusPool.accountSurplus(A, 1), 'CollSurplusPool: Caller is not TroveManager')
  })
})

contract('Reset chain state', async accounts => { })
