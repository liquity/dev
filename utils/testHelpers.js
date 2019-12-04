// TODO: Refactor duplication with deploymentHelpers.js 

const PoolManager = artifacts.require("./PoolManager.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const NameRegistry = artifacts.require("./NameRegistry.sol")

const getDeployedContracts = async () => {
  // get deployed contract representations
  const priceFeed = await PriceFeed.deployed()
  const clvToken = await CLVToken.deployed()
  const poolManager = await PoolManager.deployed()
  const cdpManager = await CDPManager.deployed()
  const nameRegistry = await NameRegistry.deployed()

  // get contract addresses
  const poolManagerAddress = poolManager.address
  const clvTokenAddress = clvToken.address
  const priceFeedAddress = priceFeed.address
  let cdpManagerAddress = cdpManager.address
  const nameRegistryAddress = nameRegistry.address

  return {
    cdpManager,
    priceFeed,
    clvToken,
    poolManager,
    cdpManager,
    nameRegistry,
    poolManagerAddress,
    clvTokenAddress,
    priceFeedAddress,
    cdpManagerAddress,
    nameRegistryAddress
  }
}

module.exports = {
  getDeployedContracts: getDeployedContracts
}