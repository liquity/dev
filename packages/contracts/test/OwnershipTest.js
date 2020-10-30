const deploymentHelper = require("../utils/deploymentHelpers.js")
const { TestHelper: th, MoneyValues: mv } = require("../utils/testHelpers.js")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")

contract('All Liquity functions with onlyOwner modifier', async accounts => {

  const [owner, alice, bob] = accounts;
  let priceFeed
  let clvToken
  let poolManager
  let sortedCDPs
  let cdpManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  before(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.borrowerOperations = await BorrowerOperationsTester.new()
    const GTContracts = await deploymentHelper.deployGTContracts()

    priceFeed = contracts.priceFeed
    clvToken = contracts.clvToken
    poolManager = contracts.poolManager
    sortedCDPs = contracts.sortedCDPs
    cdpManager = contracts.cdpManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    gtStaking = GTContracts.gtStaking
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
      await testSetAddresses(cdpManager, 9)
    })
  })

  describe('PoolManager', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(poolManager, 7)
    })
  })

  describe('BorrowerOperations', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(borrowerOperations, 8)
    })
  })

  describe('DefaultPool', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(defaultPool, 3)
    })
  })

  describe('StabilityPool', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(stabilityPool, 3)
    })
  })

  describe('ActivePool', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(activePool, 4)
    })
  })

  describe('CLVToken', async accounts => {
    // setPoolManagerAddress
    it("setPoolManagerAddress(): reverts when called by non-owner", async () => {
      await testSetAddresses(clvToken, 2)
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
      await testSetAddresses(priceFeed, 4)
    })
  })
})

