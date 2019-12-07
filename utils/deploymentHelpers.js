const getAddresses = (contracts) => {
  return {
    priceFeed: contracts.priceFeed.address,
    clvToken: contracts.clvToken.address,
    poolManager: contracts.poolManager.address,
    cdpManager: contracts.cdpManager.address,
    nameRegistry: contracts.nameRegistry.address,
    stabilityPool: contracts.stabilityPool.address,
    activePool: contracts.activePool.address,
    defaultPool: contracts.defaultPool.address,
  }
}

const setNameRegistry = async (addresses, nameRegistry) => {
  await nameRegistry.registerContract('PoolManager', addresses.poolManager)
  await nameRegistry.registerContract('PriceFeed', addresses.priceFeed)
  await nameRegistry.registerContract('CLVToken', addresses.clvToken)
  await nameRegistry.registerContract('CDPManager', addresses.cdpManager)
  await nameRegistry.registerContract('StabilityPool', addresses.stabilityPool)
  await nameRegistry.registerContract('ActivePool', addresses.activePool)
  await nameRegistry.registerContract('DefaultPool', addresses.defaultPool)
}

const getAddressesFromNameRegistry = async (nameRegistry) => {
  const PoolManager = await nameRegistry.getAddress('PoolManager')
  const CLVToken = await nameRegistry.getAddress('CLVToken')
  const PriceFeed = await nameRegistry.getAddress('PriceFeed')
  const CDPManager = await nameRegistry.getAddress('CDPManager')
  const StabilityPool = await nameRegistry.getAddress('StabilityPool')
  const ActivePool = await nameRegistry.getAddress('ActivePool')
  const DefaultPool = await nameRegistry.getAddress('DefaultPool')

  return { PoolManager, CLVToken, PriceFeed, CDPManager, StabilityPool, ActivePool, DefaultPool }
}

// Connect contracts to their dependencies
const connectContracts = async (contracts, registeredAddresses) => {
  await contracts.clvToken.setPoolManagerAddress(registeredAddresses.PoolManager)
 
  await contracts.poolManager.setCDPManagerAddress(registeredAddresses.CDPManager)
  await contracts.poolManager.setCLVToken(registeredAddresses.CLVToken)
  await contracts.poolManager.setPriceFeed(registeredAddresses.PriceFeed)
  // set Pool addrs in the PoolManager
  await contracts.poolManager.setStabilityPool(registeredAddresses.StabilityPool)
  await contracts.poolManager.setActivePool(registeredAddresses.ActivePool)
  await contracts.poolManager.setDefaultPool(registeredAddresses.DefaultPool)

  await contracts.cdpManager.setCLVToken(registeredAddresses.CLVToken)
  await contracts.cdpManager.setPoolManager(registeredAddresses.PoolManager)
  await contracts.cdpManager.setPriceFeed(registeredAddresses.PriceFeed)

  // set PoolManager addr in the Pools
  await contracts.stabilityPool.setPoolManagerAddress(registeredAddresses.PoolManager)
  await contracts.activePool.setPoolManagerAddress(registeredAddresses.PoolManager)
  await contracts.defaultPool.setPoolManagerAddress(registeredAddresses.PoolManager)
}

module.exports = {
  getAddresses: getAddresses,
  getAddressesFromNameRegistry: getAddressesFromNameRegistry,
  setNameRegistry: setNameRegistry,
  connectContracts: connectContracts
}

