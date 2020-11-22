const deploymentHelper = require("../utils/deploymentHelpers.js")
const { TestHelper: th, MoneyValues: mv } = require("../utils/testHelpers.js")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")

contract('All Liquity functions with onlyOwner modifier', async accounts => {

  const [owner, alice, bob] = accounts;
  let priceFeed
  let clvToken
  let sortedCDPs
  let cdpManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  before(async () => {
    const contracts = await deploymentHelper.deployLiquityCore()
    contracts.borrowerOperations = await BorrowerOperationsTester.new()
    const GTContracts = await deploymentHelper.deployGTContracts()

    priceFeed = contracts.priceFeed
    clvToken = contracts.clvToken
    sortedCDPs = contracts.sortedCDPs
    cdpManager = contracts.cdpManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations

    lqtyStaking = GTContracts.lqtyStaking
    growthToken = GTContracts.growthToken
    communityIssuance = GTContracts.communityIssuance
    lockupContractFactory = GTContracts.lockupContractFactory
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
      await testSetAddresses(cdpManager, 8)
    })
  })

  describe('BorrowerOperations', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(borrowerOperations, 7)
    })
  })

  describe('DefaultPool', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(defaultPool, 2)
    })
  })

  describe('StabilityPool', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(stabilityPool, 5)
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
})

