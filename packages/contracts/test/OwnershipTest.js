const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th = testHelpers.TestHelper
const mv = testHelpers.MoneyValues

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
    await connectContracts(contracts, contractAddresses)
  })

  describe('CDPManager', async accounts => {
    it("setBorrowerOperations(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.setBorrowerOperations(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await cdpManager.setBorrowerOperations(bob, { from: owner })
      const txOwner2 = await cdpManager.setBorrowerOperations(borrowerOperations.address, { from: owner })
    })

    // setPoolManager
    it("setPoolManager(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.setPoolManager(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await cdpManager.setPoolManager(bob, { from: owner })
      const txOwner2 = await cdpManager.setPoolManager(poolManager.address, { from: owner })
    })


    // setActivePool
    it("setActivePool(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.setActivePool(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await cdpManager.setActivePool(bob, { from: owner })
      const txOwner2 = await cdpManager.setActivePool(activePool.address, { from: owner })
    })


    // setDefaultPool
    it("setDefaultPool(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.setDefaultPool(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await cdpManager.setDefaultPool(bob, { from: owner })
      const txOwner2 = await cdpManager.setDefaultPool(defaultPool.address, { from: owner })
    })

    // setStabilityPool
    it("setStabilityPool(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.setStabilityPool(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await cdpManager.setStabilityPool(bob, { from: owner })
      const txOwner2 = await cdpManager.setStabilityPool(stabilityPool.address, { from: owner })
    })

    // setPriceFeed
    it("setPriceFeed(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.setPriceFeed(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await cdpManager.setPriceFeed(bob, { from: owner })
      const txOwner2 = await cdpManager.setPriceFeed(priceFeed.address, { from: owner })
    })

    // setCLVToken
    it("setCLVToken(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.setCLVToken(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await cdpManager.setCLVToken(bob, { from: owner })
      const txOwner2 = await cdpManager.setCLVToken(clvToken.address, { from: owner })
    })

    // setSortedCDPs
    it("setSortedCDPs(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.setSortedCDPs(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await cdpManager.setSortedCDPs(bob, { from: owner })
      const txOwner2 = await cdpManager.setSortedCDPs(sortedCDPs.address, { from: owner })
    })
  })

  describe('PoolManager', async accounts => {
    // setBorrowerOperations
    it("setBorrowerOperations(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await poolManager.setBorrowerOperations(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await cdpManager.setSortedCDPs(bob, { from: owner })
      const txOwner2 = await cdpManager.setSortedCDPs(sortedCDPs.address, { from: owner })
    })

    // setCDPManagerAddress
    it("setCDPManagerAddress(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await poolManager.setCDPManagerAddress(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await poolManager.setCDPManagerAddress(bob, { from: owner })
      const txOwner2 = await poolManager.setCDPManagerAddress(cdpManager.address, { from: owner })
    })

    // setPriceFeed
    it("setPriceFeed(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await poolManager.setPriceFeed(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await poolManager.setPriceFeed(bob, { from: owner })
      const txOwner2 = await poolManager.setPriceFeed(priceFeed.address, { from: owner })
    })

    // setCLVToken
    it("setCLVToken(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await poolManager.setCLVToken(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await poolManager.setCLVToken(bob, { from: owner })
      const txOwner2 = await poolManager.setCLVToken(clvToken.address, { from: owner })
    })

    // setStabilityPool
    it("setStabilityPool(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await poolManager.setCLVToken(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await poolManager.setStabilityPool(bob, { from: owner })
      const txOwner2 = await poolManager.setStabilityPool(stabilityPool.address, { from: owner })
    })

    // setActivePool
    it("setActivePool(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await poolManager.setCLVToken(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await poolManager.setActivePool(bob, { from: owner })
      const txOwner2 = await poolManager.setActivePool(activePool.address, { from: owner })
    })

    // setDefaultPool
    it("setActivePool(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await poolManager.setDefaultPool(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await poolManager.setDefaultPool(bob, { from: owner })
      const txOwner2 = await poolManager.setDefaultPool(defaultPool.address, { from: owner })
    })
  })

  describe('BorrowerOperations', async accounts => {
    //     setCDPManager
    it("setCDPManager(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await borrowerOperations.setCDPManager(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await borrowerOperations.setCDPManager(bob, { from: owner })
      const txOwner2 = await borrowerOperations.setCDPManager(cdpManager.address, { from: owner })
    })

    // setPoolManager
    it("setPoolManager(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await borrowerOperations.setPoolManager(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await borrowerOperations.setPoolManager(bob, { from: owner })
      const txOwner2 = await borrowerOperations.setPoolManager(poolManager.address, { from: owner })
    })

    // setPriceFeed
    it("setPriceFeed(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await borrowerOperations.setPriceFeed(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await borrowerOperations.setPriceFeed(bob, { from: owner })
      const txOwner2 = await borrowerOperations.setPriceFeed(priceFeed.address, { from: owner })
    })

    // setSortedCDPs
    it("setPriceFeed(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await borrowerOperations.setSortedCDPs(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await borrowerOperations.setSortedCDPs(bob, { from: owner })
      const txOwner2 = await borrowerOperations.setSortedCDPs(sortedCDPs.address, { from: owner })
    })


    // setActivePool
    it("setActivePool(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await borrowerOperations.setActivePool(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await borrowerOperations.setActivePool(bob, { from: owner })
      const txOwner2 = await borrowerOperations.setActivePool(activePool.address, { from: owner })
    })

    // setDefaultPool
    it("setDefaultPool(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await borrowerOperations.setDefaultPool(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await borrowerOperations.setDefaultPool(bob, { from: owner })
      const txOwner2 = await borrowerOperations.setDefaultPool(defaultPool.address, { from: owner })
    })
  })

  describe('ActivePool', async accounts => {
    //     setPoolManagerAddress
    it("setPoolManagerAddress(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await activePool.setPoolManagerAddress(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await activePool.setPoolManagerAddress(bob, { from: owner })
      const txOwner2 = await activePool.setPoolManagerAddress(poolManager.address, { from: owner })
    })

    // setDefaultPoolAddress
    it("setDefaultPoolAddress(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await activePool.setDefaultPoolAddress(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await activePool.setDefaultPoolAddress(bob, { from: owner })
      const txOwner2 = await activePool.setDefaultPoolAddress(defaultPool.address, { from: owner })
    })


    // setStabilityPoolAddress
    it("setStabilityPoolAddress(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await activePool.setStabilityPoolAddress(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await activePool.setStabilityPoolAddress(bob, { from: owner })
      const txOwner2 = await activePool.setStabilityPoolAddress(stabilityPool.address, { from: owner })
    })
  })

  describe('DefaultPool', async accounts => {
    // setPoolManagerAddress
    it("setPoolManagerAddress(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await defaultPool.setPoolManagerAddress(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await defaultPool.setPoolManagerAddress(bob, { from: owner })
      const txOwner2 = await defaultPool.setPoolManagerAddress(poolManager.address, { from: owner })
    })


    // setActivePoolAddress
    it("setActivePoolAddress(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await defaultPool.setActivePoolAddress(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await defaultPool.setActivePoolAddress(bob, { from: owner })
      const txOwner2 = await defaultPool.setActivePoolAddress(activePool.address, { from: owner })
    })


    // setStabilityPoolAddress
    it("setStabilityPoolAddress(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await defaultPool.setStabilityPoolAddress(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await defaultPool.setStabilityPoolAddress(bob, { from: owner })
      const txOwner2 = await defaultPool.setStabilityPoolAddress(stabilityPool.address, { from: owner })
    })
  })

  describe('StabilityPool', async accounts => {
    // setPoolManagerAddress
    it("setPoolManagerAddress(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await stabilityPool.setPoolManagerAddress(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await stabilityPool.setPoolManagerAddress(bob, { from: owner })
      const txOwner2 = await stabilityPool.setPoolManagerAddress(poolManager.address, { from: owner })
    })

    // setActivePoolAddress
    it("setActivePoolAddress(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await stabilityPool.setActivePoolAddress(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await stabilityPool.setActivePoolAddress(bob, { from: owner })
      const txOwner2 = await stabilityPool.setActivePoolAddress(activePool.address, { from: owner })
    })

    // setDefaultPoolAddress
    it("setDefaultPoolAddress(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await stabilityPool.setDefaultPoolAddress(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await stabilityPool.setDefaultPoolAddress(bob, { from: owner })
      const txOwner2 = await stabilityPool.setDefaultPoolAddress(defaultPool.address, { from: owner })
    })
  })

  describe('CLVToken', async accounts => {
    // setPoolManagerAddress
    it("setPoolManagerAddress(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await clvToken.setPoolManagerAddress(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await clvToken.setPoolManagerAddress(bob, { from: owner })
      const txOwner2 = await clvToken.setPoolManagerAddress(poolManager.address, { from: owner })
    })
  })

  describe('SortedCDPs', async accounts => {
    // setCDPManager
    it("setCDPManager(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await sortedCDPs.setCDPManager(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await sortedCDPs.setCDPManager(bob, { from: owner })
      const txOwner2 = await sortedCDPs.setCDPManager(cdpManager.address, { from: owner })
    })

    // setMaxSize
    it("setMaxSize(): reverts when called by non-owner", async () => {
      // Attempt call from alice
      try {
        txAlice = await sortedCDPs.setMaxSize(10000001, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set a max size
      const txOwner1 = await sortedCDPs.setMaxSize(10000001, { from: owner })
    })
  })

  describe('PriceFeed', async accounts => {
    // setCDPManagerAddress
    it("setCDPManagerAddress(): reverts when called by non-owner", async () => {
      try {
        txAlice = await priceFeed.setCDPManagerAddress(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await priceFeed.setCDPManagerAddress(bob, { from: owner })
      const txOwner2 = await priceFeed.setCDPManagerAddress(cdpManager.address, { from: owner })
    })

    // setPoolManagerAddress
    it("setPoolManagerAddress(): reverts when called by non-owner", async () => {
      try {
        txAlice = await priceFeed.setPoolManagerAddress(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await priceFeed.setPoolManagerAddress(bob, { from: owner })
      const txOwner2 = await priceFeed.setPoolManagerAddress(poolManager.address, { from: owner })
    })

    // setAggregator
    it("setAggregator(): reverts when called by non-owner", async () => {
      try {
        txAlice = await priceFeed.setAggregator(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await priceFeed.setAggregator(bob, { from: owner })
      const txOwner2 = await priceFeed.setAggregator("0x79fEbF6B9F76853EDBcBc913e6aAE8232cFB9De9", { from: owner })
    })

    // setAggregator_Testnet 
    it("setAggregator_Testnet(): reverts when called by non-owner", async () => {
      try {
        txAlice = await priceFeed.setAggregator_Testnet(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await priceFeed.setAggregator_Testnet(bob, { from: owner })
      const txOwner2 = await priceFeed.setAggregator_Testnet("0x8468b2bDCE073A157E560AA4D9CcF6dB1DB98507", { from: owner })
    })
  })
})

