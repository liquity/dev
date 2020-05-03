const getAddresses = (contracts) => {
  return {
    priceFeed: contracts.priceFeed.address,
    clvToken: contracts.clvToken.address,
    poolManager: contracts.poolManager.address,
    sortedCDPs: contracts.sortedCDPs.address,
    cdpManager: contracts.cdpManager.address,
    nameRegistry: contracts.nameRegistry.address,
    stabilityPool: contracts.stabilityPool.address,
    activePool: contracts.activePool.address,
    defaultPool: contracts.defaultPool.address,
    functionCaller: contracts.functionCaller.address
  }
}

const setNameRegistry = async (addresses, nameRegistry) => {
  await nameRegistry.registerContract('PoolManager', addresses.poolManager)
  await nameRegistry.registerContract('PriceFeed', addresses.priceFeed)
  await nameRegistry.registerContract('CLVToken', addresses.clvToken)
  await nameRegistry.registerContract('SortedCDPs', addresses.sortedCDPs)
  await nameRegistry.registerContract('CDPManager', addresses.cdpManager)
  await nameRegistry.registerContract('StabilityPool', addresses.stabilityPool)
  await nameRegistry.registerContract('ActivePool', addresses.activePool)
  await nameRegistry.registerContract('DefaultPool', addresses.defaultPool)
  await nameRegistry.registerContract('FunctionCaller', addresses.functionCaller)
}

const getAddressesFromNameRegistry = async (nameRegistry) => {
  const PoolManager = await nameRegistry.getAddress('PoolManager')
  const CLVToken = await nameRegistry.getAddress('CLVToken')
  const PriceFeed = await nameRegistry.getAddress('PriceFeed')
  const SortedCDPs = await nameRegistry.getAddress('SortedCDPs')
  const CDPManager = await nameRegistry.getAddress('CDPManager')
  const StabilityPool = await nameRegistry.getAddress('StabilityPool')
  const ActivePool = await nameRegistry.getAddress('ActivePool')
  const DefaultPool = await nameRegistry.getAddress('DefaultPool')
  const FunctionCaller = await nameRegistry.getAddress('FunctionCaller')

  return { PoolManager, CLVToken, PriceFeed, SortedCDPs, CDPManager, StabilityPool, ActivePool, DefaultPool, FunctionCaller }
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

  // set CDPManager addr in SortedCDPs
  await contracts.sortedCDPs.setCDPManager(registeredAddresses.CDPManager)

   // set contract addresses in the FunctionCaller 
   await contracts.functionCaller.setCDPManagerAddress(registeredAddresses.CDPManager)
   await contracts.functionCaller.setSortedCDPsAddress(registeredAddresses.SortedCDPs)

   // set CDPManager addr in PriceFeed
   await contracts.priceFeed.setCDPManagerAddress(registeredAddresses.CDPManager)

  // set contracts in the CDP Manager
  await contracts.cdpManager.setCLVToken(registeredAddresses.CLVToken)
  await contracts.cdpManager.setSortedCDPs(registeredAddresses.SortedCDPs)
  await contracts.cdpManager.setPoolManager(registeredAddresses.PoolManager)
  await contracts.cdpManager.setPriceFeed(registeredAddresses.PriceFeed)
  await contracts.cdpManager.setActivePool(registeredAddresses.ActivePool)
  await contracts.cdpManager.setDefaultPool(registeredAddresses.DefaultPool)
  await contracts.cdpManager.setStabilityPool(registeredAddresses.StabilityPool)

  // set PoolManager addr in the Pools
  await contracts.stabilityPool.setPoolManagerAddress(registeredAddresses.PoolManager)
  await contracts.stabilityPool.setActivePoolAddress(registeredAddresses.ActivePool)
  await contracts.stabilityPool.setDefaultPoolAddress(registeredAddresses.DefaultPool)

  await contracts.activePool.setPoolManagerAddress(registeredAddresses.PoolManager)
  await contracts.activePool.setStabilityPoolAddress(registeredAddresses.StabilityPool)
  await contracts.activePool.setDefaultPoolAddress(registeredAddresses.DefaultPool)

  await contracts.defaultPool.setPoolManagerAddress(registeredAddresses.PoolManager)
  await contracts.defaultPool.setStabilityPoolAddress(registeredAddresses.StabilityPool)
  await contracts.defaultPool.setActivePoolAddress(registeredAddresses.ActivePool)
}

module.exports = {
  getAddresses: getAddresses,
  getAddressesFromNameRegistry: getAddressesFromNameRegistry,
  setNameRegistry: setNameRegistry,
  connectContracts: connectContracts
}

