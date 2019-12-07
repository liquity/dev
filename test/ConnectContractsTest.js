const testHelpers = require("../utils/testHelpers.js")
const getDeployedContracts = testHelpers.getDeployedContracts

describe('Set correct contract addresses dependencies for after deployment', function () {
  contract('CDPManager', async () => {
    it('sets the correct PriceFeed address', async () => {
      const deployed = await getDeployedContracts()
      const cdpManager = deployed.cdpManager
      const priceFeedAddress = deployed.priceFeedAddress

      const recordedPriceFeedAddress = await cdpManager.priceFeedAddress()

      assert.equal(priceFeedAddress, recordedPriceFeedAddress)
    })

    it('sets the correct CLVToken address', async () => {
      const deployed = await getDeployedContracts()
      const cdpManager = deployed.cdpManager
      const clvTokenAddress = deployed.clvTokenAddress

      const recordedClvTokenAddress = await cdpManager.clvTokenAddress()

      assert.equal(clvTokenAddress, recordedClvTokenAddress)
    })

    it('sets the correct PoolManager address', async () => {
      const deployed = await getDeployedContracts()
      const cdpManager = deployed.cdpManager
      const poolManagerAddress = deployed.poolManagerAddress

      const recordedPoolManagerAddress = await cdpManager.poolManagerAddress()

      assert.equal(poolManagerAddress, recordedPoolManagerAddress)
    })
  })

  contract('PoolManager', async () => {
    it('sets the correct PriceFeed address', async () => {
      const deployed = await getDeployedContracts()
      const poolManager = deployed.poolManager
      const priceFeedAddress = deployed.priceFeedAddress

      const recordedPriceFeedAddress = await poolManager.priceFeedAddress()

      assert.equal(priceFeedAddress, recordedPriceFeedAddress)
    })

    it('sets the correct CDPManager address', async () => {
      const deployed = await getDeployedContracts()
      const poolManager = deployed.poolManager
      const cdpManagerAddress = deployed.cdpManagerAddress

      const recordedCDPManagerAddress = await poolManager.cdpManagerAddress()

      assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
    })


    it('sets the correct CLVToken address', async () => {
      const deployed = await getDeployedContracts()
      const poolManager = deployed.poolManager
      const clvTokenAddress = deployed.clvTokenAddress

      const recordedClvTokenAddress = await poolManager.clvAddress()

      assert.equal(clvTokenAddress, recordedClvTokenAddress)
    })

    it('sets the correct ActivePool address', async () => {
      const deployed = await getDeployedContracts()
      const poolManager = deployed.poolManager
      const activePoolAddress = deployed.activePoolAddress

      const recordedActivePoolAddress = await poolManager.activePoolAddress()

      assert.equal(activePoolAddress, recordedActivePoolAddress)
    })

    it('sets the correct StabilityPool address', async () => {
      const deployed = await getDeployedContracts()
      const poolManager = deployed.poolManager
      const stabilityPoolAddress = deployed.stabilityPoolAddress

      const recordedStabilityPoolAddress = await poolManager.stabilityPoolAddress()

      assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
    })
  
    it('sets the correct StabilityPool address', async () => {
      const deployed = await getDeployedContracts()
      const poolManager = deployed.poolManager
      const defaultPoolAddress = deployed.defaultPoolAddress

      const recordedDefaultPoolAddress = await poolManager.defaultPoolAddress()

      assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
    })
  })

  contract('CLVToken', async () => {
    it('sets the correct PoolManager address', async () => {
      const deployed = await getDeployedContracts()
      const clvToken = deployed.clvToken
      const poolManagerAddress = deployed.poolManagerAddress

      const recordedPoolManagerAddress = await clvToken.poolManagerAddress()

      assert.equal(poolManagerAddress, recordedPoolManagerAddress)
    })
  })

  contract('NameRegistry', async () => {
    it('sets the correct PoolManager address', async () => {
      const deployed = await getDeployedContracts()
      const nameRegistry = deployed.nameRegistry
      const poolManagerAddress = deployed.poolManagerAddress

      const recordedPoolManagerAddress = await nameRegistry.getAddress('PoolManager')

      assert.equal(poolManagerAddress, recordedPoolManagerAddress)
    })

    it('sets the correct PriceFeed address', async () => {
      const deployed = await getDeployedContracts()
      const nameRegistry = deployed.nameRegistry
      const priceFeedAddress = deployed.priceFeedAddress

      const recordedPriceFeedAddress = await nameRegistry.getAddress('PriceFeed')

      assert.equal(priceFeedAddress, recordedPriceFeedAddress)
    })

    it('sets the correct CLVToken address', async () => {
      const deployed = await getDeployedContracts()
      const nameRegistry = deployed.nameRegistry
      const clvTokenAddress = deployed.clvTokenAddress

      const recordedClvTokenAddress = await nameRegistry.getAddress('CLVToken')

      assert.equal(clvTokenAddress, recordedClvTokenAddress)
    })

    it('sets the correct CDPManager address', async () => {
      const deployed = await getDeployedContracts()
      const nameRegistry = deployed.nameRegistry
      const cdpManagerAddress = deployed.cdpManagerAddress

      const recordedCDPManagerAddress = await nameRegistry.getAddress('CDPManager')

      assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
    })
  })

  contract('ActivePool', async () => {
    it('sets the correct PoolManager address', async () => {
      const deployed = await getDeployedContracts()
      const activePool = deployed.activePool
      const poolManagerAddress = deployed.poolManagerAddress

      const recordedPoolManagerAddress = await activePool.getPoolManagerAddress()
      assert.equal(poolManagerAddress, recordedPoolManagerAddress)
    })
  })

  contract('StabilityPool', async () => {
    it('sets the correct PoolManager address', async () => {
      const deployed = await getDeployedContracts()
      const stabilityPool = deployed.stabilityPool
      const poolManagerAddress = deployed.poolManagerAddress

      const recordedPoolManagerAddress = await stabilityPool.getPoolManagerAddress()
      assert.equal(poolManagerAddress, recordedPoolManagerAddress)
    })
  })

  contract('DefaultPool', async () => {
    it('sets the correct PoolManager address', async () => {
      const deployed = await getDeployedContracts()
      const defaultPool = deployed.defaultPool
      const poolManagerAddress = deployed.poolManagerAddress

      const recordedPoolManagerAddress = await defaultPool.getPoolManagerAddress()
      assert.equal(poolManagerAddress, recordedPoolManagerAddress)
    })
  })
})
