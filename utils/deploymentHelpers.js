const getAddresses = (contracts) => {
  return {
    priceFeedAddress: contracts.priceFeed.address,
    clvTokenAddress: contracts.clvToken.address,
    poolManagerAddress: contracts.poolManager.address,
    cdpManagerAddress: contracts.cdpManager.address,
    nameRegistryAddress: contracts.nameRegistry.address }
}

const getAddressesFromNameRegistry = async (nameRegistry) => {
  const PoolManager = await nameRegistry.getAddress('PoolManager')
  const CLVToken = await nameRegistry.getAddress('CLVToken')
  const PriceFeed = await nameRegistry.getAddress('PriceFeed')
  const CDPManager = await nameRegistry.getAddress('CDPManager')

  return { PoolManager, CLVToken, PriceFeed, CDPManager }
}

const setNameRegistry = async (addresses, nameRegistry) => {
  await nameRegistry.registerContract('PoolManager', addresses.poolManagerAddress)
  await nameRegistry.registerContract('PriceFeed', addresses.priceFeedAddress)
  await nameRegistry.registerContract('CLVToken', addresses.clvTokenAddress)
  await nameRegistry.registerContract('CDPManager', addresses.cdpManagerAddress)
}

// Connect contracts to their dependencies
const connectContracts = async (contracts, registeredAddresses) => {
  await contracts.clvToken.setPoolAddress(registeredAddresses.PoolManager)

  await contracts.poolManager.setCDPManagerAddress(registeredAddresses.CDPManager)
  await contracts.poolManager.setCLVToken(registeredAddresses.CLVToken)
  await contracts.poolManager.setPriceFeed(registeredAddresses.PriceFeed)

  await contracts.cdpManager.setCLVToken(registeredAddresses.CLVToken)
  await contracts.cdpManager.setPoolManager(registeredAddresses.PoolManager)
  await contracts.cdpManager.setPriceFeed(registeredAddresses.PriceFeed)
}

module.exports = {
  getAddresses: getAddresses,
  getAddressesFromNameRegistry: getAddressesFromNameRegistry,
  setNameRegistry: setNameRegistry,
  connectContracts: connectContracts
}

