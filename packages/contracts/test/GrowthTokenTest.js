const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper
const dec = th.dec
const timeValues = testHelpers.TimeValues

const ZERO_ADDRESS = th.ZERO_ADDRESS
const assertRevert = th.assertRevert

contract('Growth Token', async accounts => {
  const [owner, A] = accounts

  let contracts
  let growthTokenTester

beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    const LQTYContracts = await deploymentHelper.deployLQTYTesterContractsBuidler()

    lqtyStaking = LQTYContracts.lqtyStaking
    growthTokenTester = LQTYContracts.growthToken
    communityIssuance = LQTYContracts.communityIssuance
    lockupContractFactory = LQTYContracts.lockupContractFactory

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
  })

  it('sendToLQTYStaking: changes balances of LQTYStaking and calling account by the correct amounts', async () => {
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    await growthTokenTester.transfer(A, dec(40, 18), {from: owner})

    // Check caller and LQTYStaking balance before
    const A_BalanceBefore = await growthTokenTester.balanceOf(A)
    assert.equal(A_BalanceBefore, dec(40,  18))
    const lqtyStakingBalanceBefore = await growthTokenTester.balanceOf(lqtyStaking.address)
    assert.equal(lqtyStakingBalanceBefore, '0')

    await growthTokenTester.unprotectedSendToLQTYStaking(A, dec(37, 18))

    // Check caller and LQTYStaking balance before
    const A_BalanceAfter = await growthTokenTester.balanceOf(A)
    assert.equal(A_BalanceAfter, dec(3, 18))
    const lqtyStakingBalanceAfter = await growthTokenTester.balanceOf(lqtyStaking.address)
    assert.equal(lqtyStakingBalanceAfter, dec(37,  18))
  })

  it('transfer(): LQTY token can not be sent to blacklisted addresses', async () => {
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await growthTokenTester.transfer(A, dec(1, 18), {from: owner})
    assert.equal(await growthTokenTester.balanceOf(A), dec(1,  18))

    // Check LQTY tokens can't be sent to blacklisted addresses
    await assertRevert(growthTokenTester.transfer(growthTokenTester.address, dec(1, 18), { from: A }))
    await assertRevert(growthTokenTester.transfer(ZERO_ADDRESS, dec(1, 18), { from: A }))
    await assertRevert(growthTokenTester.transfer(communityIssuance.address, dec(1, 18), { from: A }))
    await assertRevert(growthTokenTester.transfer(lqtyStaking.address, dec(1, 18), { from: A }))
  })
})


