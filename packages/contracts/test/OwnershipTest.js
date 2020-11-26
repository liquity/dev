const deploymentHelper = require("../utils/deploymentHelpers.js")
const { TestHelper: th, MoneyValues: mv } = require("../utils/testHelpers.js")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")

contract('All Liquity functions with onlyOwner modifier', async accounts => {

  const [owner, alice, bob] = accounts;
  let contracts
  let priceFeed
  let clvToken
  let sortedCDPs
  let cdpManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  let lqtyStaking
  let communityIssuance
  let growthToken 

  before(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.borrowerOperations = await BorrowerOperationsTester.new()
    contracts = await deploymentHelper.deployCLVToken(contracts)
    const LQTYContracts = await deploymentHelper.deployLQTYContracts()

    priceFeed = contracts.priceFeed
    clvToken = contracts.clvToken
    sortedCDPs = contracts.sortedCDPs
    cdpManager = contracts.cdpManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations

    lqtyStaking = LQTYContracts.lqtyStaking
    communityIssuance = LQTYContracts.communityIssuance
    growthToken = LQTYContracts.growthToken
  })

  const testSetAddresses = async (contract, numberOfAddresses) => {
    const params = Array(numberOfAddresses).fill(bob)
    // Attempt call from alice
    await th.assertRevert(contract.setAddresses(...params, { from: alice }))

    // Owner can successfully set any address
    const txOwner = await contract.setAddresses(...params, { from: owner })
    assert.isTrue(txOwner.receipt.status)
    // fails if called twice
    await th.assertRevert(contract.setAddresses(...params, { from: owner }))
  }

  describe('CDPManager', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(cdpManager, 9)
    })
  })

  describe('BorrowerOperations', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(borrowerOperations, 9)
    })
  })

  describe('DefaultPool', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(defaultPool, 2)
    })
  })

  describe('StabilityPool', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(stabilityPool, 7)
    })
  })

  describe('ActivePool', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(activePool, 4)
    })
  })

  describe('SortedCDPs', async accounts => {
    it("setParams(): reverts when called by non-owner", async () => {
      const params = [10000001, bob, bob]
      // Attempt call from alice
      await th.assertRevert(sortedCDPs.setParams(...params, { from: alice }))

      // Owner can successfully set params
      const txOwner = await sortedCDPs.setParams(...params, { from: owner })
      assert.isTrue(txOwner.receipt.status)

      // fails if called twice
      await th.assertRevert(sortedCDPs.setParams(...params, { from: owner }))
    })
  })

  describe('PriceFeed', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(priceFeed, 3)
    })
  })

  describe('CommunityIssuance', async accounts => {
    it.only("setAddresses(): reverts when called by non-owner", async () => {
      const params = [growthToken.address,stabilityPool.address]
      await th.assertRevert(communityIssuance.setAddresses(...params, { from: alice }))

      // Owner can successfully set any address
      const txOwner = await communityIssuance.setAddresses(...params, { from: owner })

      assert.isTrue(txOwner.receipt.status)
      // fails if called twice
      await th.assertRevert(communityIssuance.setAddresses(...params, { from: owner }))
    })
  })

  describe('LQTYStaking', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(lqtyStaking, 5)
    })
  })
})

