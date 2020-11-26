
const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")

const deployLiquity = async () => {
  const priceFeed = await PriceFeed.new()
  const sortedCDPs = await SortedCDPs.new()
  const cdpManager = await CDPManager.new()
  const activePool = await ActivePool.new()
  const stabilityPool = await StabilityPool.new()
  const defaultPool = await DefaultPool.new()
  const functionCaller = await FunctionCaller.new()
  const borrowerOperations = await BorrowerOperations.new()
  const clvToken = await CLVToken.new(
    cdpManager.address,
    stabilityPool.address,
    borrowerOperations.address
  )
  DefaultPool.setAsDeployed(defaultPool)
  PriceFeed.setAsDeployed(priceFeed)
  CLVToken.setAsDeployed(clvToken)
  SortedCDPs.setAsDeployed(sortedCDPs)
  CDPManager.setAsDeployed(cdpManager)
  ActivePool.setAsDeployed(activePool)
  StabilityPool.setAsDeployed(stabilityPool)
  FunctionCaller.setAsDeployed(functionCaller)
  BorrowerOperations.setAsDeployed(borrowerOperations)

  const contracts = {
    priceFeed,
    clvToken,
    sortedCDPs,
    cdpManager,
    activePool,
    stabilityPool,
    defaultPool,
    functionCaller,
    borrowerOperations
  }
  return contracts
}

const getAddresses = (contracts) => {
  return {
    BorrowerOperations: contracts.borrowerOperations.address,
    PriceFeed: contracts.priceFeed.address,
    CLVToken: contracts.clvToken.address,
    SortedCDPs: contracts.sortedCDPs.address,
    CDPManager: contracts.cdpManager.address,
    StabilityPool: contracts.stabilityPool.address,
    ActivePool: contracts.activePool.address,
    DefaultPool: contracts.defaultPool.address,
    FunctionCaller: contracts.functionCaller.address
  }
}

// Connect contracts to their dependencies
const connectContracts = async (contracts, addresses) => {
  // set CDPManager addr in SortedCDPs
  await contracts.sortedCDPs.setCDPManager(addresses.CDPManager)

  // set contract addresses in the FunctionCaller 
  await contracts.functionCaller.setCDPManagerAddress(addresses.CDPManager)
  await contracts.functionCaller.setSortedCDPsAddress(addresses.SortedCDPs)

  // set CDPManager addr in PriceFeed
  await contracts.priceFeed.setCDPManagerAddress(addresses.CDPManager)

  // set contracts in the CDP Manager
  await contracts.cdpManager.setCLVToken(addresses.CLVToken)
  await contracts.cdpManager.setSortedCDPs(addresses.SortedCDPs)
  await contracts.cdpManager.setPriceFeed(addresses.PriceFeed)
  await contracts.cdpManager.setActivePool(addresses.ActivePool)
  await contracts.cdpManager.setDefaultPool(addresses.DefaultPool)
  await contracts.cdpManager.setStabilityPool(addresses.StabilityPool)
  await contracts.cdpManager.setBorrowerOperations(addresses.BorrowerOperations)

  // set contracts in BorrowerOperations 
  await contracts.borrowerOperations.setSortedCDPs(addresses.SortedCDPs)
  await contracts.borrowerOperations.setPriceFeed(addresses.PriceFeed)
  await contracts.borrowerOperations.setActivePool(addresses.ActivePool)
  await contracts.borrowerOperations.setDefaultPool(addresses.DefaultPool)
  await contracts.borrowerOperations.setCDPManager(addresses.CDPManager)

  // set contracts in the Pools
  await contracts.stabilityPool.setActivePoolAddress(addresses.ActivePool)
  await contracts.stabilityPool.setDefaultPoolAddress(addresses.DefaultPool)

  await contracts.activePool.setStabilityPoolAddress(addresses.StabilityPool)
  await contracts.activePool.setDefaultPoolAddress(addresses.DefaultPool)

  await contracts.defaultPool.setStabilityPoolAddress(addresses.StabilityPool)
  await contracts.defaultPool.setActivePoolAddress(addresses.ActivePool)
}

const connectEchidnaProxy = async (echidnaProxy, addresses) => {
  echidnaProxy.setCDPManager(addresses.CDPManager)
  echidnaProxy.setBorrowerOperations(addresses.BorrowerOperations)
}

module.exports = {
  connectEchidnaProxy: connectEchidnaProxy,
  getAddresses: getAddresses,
  deployLiquity: deployLiquity,
  connectContracts: connectContracts
}
