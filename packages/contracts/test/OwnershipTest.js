const deploymentHelpers = require("../utils/deploymentHelpers.js")
const { TestHelper: th, MoneyValues: mv, assertRevert } = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

contract('All Liquity functions with onlyOwner modifier', async accounts => {

  const [owner, alice, bob] = accounts;
  let priceFeed
  let clvToken
  let poolManager
  let sortedCDPs
  let cdpManager
  let nameRegistry
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations

  before(async () => {
    const contracts = await deployLiquity()

    priceFeed = contracts.priceFeed
    clvToken = contracts.clvToken
    poolManager = contracts.poolManager
    sortedCDPs = contracts.sortedCDPs
    cdpManager = contracts.cdpManager
    nameRegistry = contracts.nameRegistry
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    functionCaller = contracts.functionCaller
    borrowerOperations = contracts.borrowerOperations

    const contractAddresses = getAddresses(contracts)
    //await connectContracts(contracts, contractAddresses)
  })

  const testSetAddresses = async (contract, numberOfAddresses) => {
    const params = Array(numberOfAddresses).fill(bob)
    // Attempt call from alice
    await assertRevert(contract.setAddresses(...params, { from: alice }))

    // Owner can successfully set any address
    const txOwner = await contract.setAddresses(...params, { from: owner })
    assert.isTrue(txOwner.receipt.status)
    // fails if called twice
    await assertRevert(contract.setAddresses(...params, { from: owner }))
  }

  describe('CDPManager', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(cdpManager, 8)
    })
  })

  describe('PoolManager', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(poolManager, 7)
    })
  })

  describe('BorrowerOperations', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(borrowerOperations, 6)
    })
  })

  describe('DefaultPool', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(defaultPool, 2)
    })
  })

  describe('StabilityPool', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(stabilityPool, 3)
    })
  })

  describe('ActivePool', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(activePool, 3)
    })
  })

  describe('CLVToken', async accounts => {
    // setPoolManagerAddress
    it("setPoolManagerAddress(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      await assertRevert(clvToken.setPoolManagerAddress(bob, { from: alice }))

      // Owner can successfully set any address
      const txOwner = await clvToken.setPoolManagerAddress(bob, { from: owner })
      assert.isTrue(txOwner.receipt.status)

      // fails if called twice
      await assertRevert(clvToken.setPoolManagerAddress(bob, { from: owner }))
    })
  })

  describe('SortedCDPs', async accounts => {
    it("setParams(): reverts when called by non-owner", async () => {
      const params = [10000001, bob, bob]
      // Attempt call from alice
      await assertRevert(sortedCDPs.setParams(...params, { from: alice }))

      // Owner can successfully set params
      const txOwner = await sortedCDPs.setParams(...params, { from: owner })
      assert.isTrue(txOwner.receipt.status)

      // fails if called twice
      await assertRevert(sortedCDPs.setParams(...params, { from: owner }))
    })
  })

  describe('PriceFeed', async accounts => {
    it("setAddresses(): reverts when called by non-owner", async () => {
      await testSetAddresses(priceFeed, 4)
    })
  })
})

