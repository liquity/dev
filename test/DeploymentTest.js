const testHelpers = require("../utils/testHelpers.js")
const getDeployedContracts = testHelpers.getDeployedContracts

describe('Set correct contract addresses after deployment', function () {
  contract('CDPManager', async () => {
    it('sets the correct Price Feed address', async () => {
      const deployed = await getDeployedContracts()
      const cdpManager = deployed.cdpManager
      const priceFeedAddress = deployed.priceFeedAddress

      const recordedPriceFeed = await cdpManager.priceFeedAddress()

      assert.equal(priceFeedAddress, recordedPriceFeed)
    })

    it('sets the correct CLVToken address', async () => {
      const deployed = await getDeployedContracts()
      const cdpManager = deployed.cdpManager
      const clvTokenAddress = deployed.clvTokenAddress

      const recordedClvToken = await cdpManager.clvTokenAddress()

      assert.equal(clvTokenAddress, recordedClvToken)
    })

    it('sets the correct PoolManager address', async () => {
      const deployed = await getDeployedContracts()
      const cdpManager = deployed.cdpManager
      const poolManagerAddress = deployed.poolManagerAddress

      const recordedPoolManager = await cdpManager.poolManagerAddress()

      assert.equal(poolManagerAddress, recordedPoolManager)
    })
  })

  contract('PoolManager', async () => {
    it('sets the correct Price Feed address', async () => {
      const deployed = await getDeployedContracts()
      const poolManager = deployed.poolManager
      const priceFeedAddress = deployed.priceFeedAddress

      const recordedPriceFeed = await poolManager.priceFeedAddress()

      assert.equal(priceFeedAddress, recordedPriceFeed)
    })

    it('sets the correct CDP Manager address', async () => {
      const deployed = await getDeployedContracts()
      const poolManager = deployed.poolManager
      const cdpManagerAddress = deployed.cdpManagerAddress

      const recordedCDPManager = await poolManager.cdpManagerAddress()

      assert.equal(cdpManagerAddress, recordedCDPManager)
    })


    it('sets the correct CLVToken address', async () => {
      const deployed = await getDeployedContracts()
      const poolManager = deployed.poolManager
      const clvTokenAddress = deployed.clvTokenAddress

      const recordedClvToken = await poolManager.clvAddress()

      assert.equal(clvTokenAddress, recordedClvToken)
    })
  })

  contract('CLVToken', async () => {
    it('sets the correct Pool Manager address', async () => {
      const deployed = await getDeployedContracts()
      const clvToken = deployed.clvToken
      const poolManagerAddress = deployed.poolManagerAddress

      const recordedPoolManager = await clvToken.poolAddress()

      assert.equal(poolManagerAddress, recordedPoolManager)
    })
  })

  contract('NameRegistry', async () => {
    it('sets the correct Pool Manager address', async () => {
      const deployed = await getDeployedContracts()
      const nameRegistry = deployed.nameRegistry
      const poolManagerAddress = deployed.poolManagerAddress

      const recordedPoolManager = await nameRegistry.getAddress('PoolManager')

      assert.equal(poolManagerAddress, recordedPoolManager)
    })

    it('sets the correct Price Feed address', async () => {
      const deployed = await getDeployedContracts()
      const nameRegistry = deployed.nameRegistry
      const priceFeedAddress = deployed.priceFeedAddress

      const recordedPriceFeed = await nameRegistry.getAddress('PriceFeed')

      assert.equal(priceFeedAddress, recordedPriceFeed)
    })

    it('sets the correct CLVToken address', async () => {
      const deployed = await getDeployedContracts()
      const nameRegistry = deployed.nameRegistry
      const clvTokenAddress = deployed.clvTokenAddress

      const recordedClvToken = await nameRegistry.getAddress('CLVToken')

      assert.equal(clvTokenAddress, recordedClvToken)
    })

    it('sets the correct CDP Manager address', async () => {
      const deployed = await getDeployedContracts()
      const nameRegistry = deployed.nameRegistry
      const cdpManagerAddress = deployed.cdpManagerAddress

      const recordedCDPManager = await nameRegistry.getAddress('CDPManager')

      assert.equal(cdpManagerAddress, recordedCDPManager)
    })
  })
})
