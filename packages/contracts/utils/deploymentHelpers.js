const PoolManager = artifacts.require("./PoolManager.sol")
const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const NameRegistry = artifacts.require("./NameRegistry.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")

const deployLiquity = async () => {
  const priceFeed = await PriceFeed.new()
  const clvToken = await CLVToken.new()
  const poolManager = await PoolManager.new()
  const sortedCDPs = await SortedCDPs.new()
  const cdpManager = await CDPManager.new()
  const nameRegistry = await NameRegistry.new()
  const activePool = await ActivePool.new()
  const stabilityPool = await StabilityPool.new()
  const defaultPool = await DefaultPool.new()
  const functionCaller = await FunctionCaller.new()
  const borrowerOperations = await BorrowerOperations.new()
  const list2 = await SortedCDPs.new()

  DefaultPool.setAsDeployed(defaultPool)
  PriceFeed.setAsDeployed(priceFeed)
  CLVToken.setAsDeployed(clvToken)
  PoolManager.setAsDeployed(poolManager)
  SortedCDPs.setAsDeployed(sortedCDPs)
  CDPManager.setAsDeployed(cdpManager)
  NameRegistry.setAsDeployed(nameRegistry)
  ActivePool.setAsDeployed(activePool)
  StabilityPool.setAsDeployed(stabilityPool)
  FunctionCaller.setAsDeployed(functionCaller)
  BorrowerOperations.setAsDeployed(borrowerOperations)
  SortedCDPs.setAsDeployed(list2)

  const contracts = {
    priceFeed,
    clvToken,
    poolManager,
    sortedCDPs,
    cdpManager,
    nameRegistry,
    activePool,
    stabilityPool,
    defaultPool,
    functionCaller,
    borrowerOperations,
    list2
  }
  return contracts
}

const getAddresses = (contracts) => {
  return {
    BorrowerOperations: contracts.borrowerOperations.address,
    PriceFeed: contracts.priceFeed.address,
    CLVToken: contracts.clvToken.address,
    PoolManager: contracts.poolManager.address,
    SortedCDPs: contracts.sortedCDPs.address,
    CDPManager: contracts.cdpManager.address,
    NameRegistry: contracts.nameRegistry.address,
    StabilityPool: contracts.stabilityPool.address,
    ActivePool: contracts.activePool.address,
    DefaultPool: contracts.defaultPool.address,
    FunctionCaller: contracts.functionCaller.address,
    List2: contracts.list2.address
  }
}

// Connect contracts to their dependencies
const connectContracts = async (contracts, registeredAddresses) => {
  await contracts.clvToken.setPoolManagerAddress(registeredAddresses.PoolManager)

  await contracts.poolManager.setBorrowerOperations(registeredAddresses.BorrowerOperations)
  await contracts.poolManager.setCDPManagerAddress(registeredAddresses.CDPManager)
  await contracts.poolManager.setCLVToken(registeredAddresses.CLVToken)
  await contracts.poolManager.setPriceFeed(registeredAddresses.PriceFeed)
  // set Pool addrs in the PoolManager
  await contracts.poolManager.setStabilityPool(registeredAddresses.StabilityPool)
  await contracts.poolManager.setActivePool(registeredAddresses.ActivePool)
  await contracts.poolManager.setDefaultPool(registeredAddresses.DefaultPool)

  // set CDPManager addr in SortedCDPs
  await contracts.sortedCDPs.setCDPManager(registeredAddresses.CDPManager)

  // set CDPManager addr in List2
  await contracts.list2.setCDPManager(registeredAddresses.CDPManager)

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
  await contracts.cdpManager.setBorrowerOperations(registeredAddresses.BorrowerOperations)
  await contracts.cdpManager.setList2(registeredAddresses.List2)

  // set contracts in BorrowerOperations 
  await contracts.borrowerOperations.setSortedCDPs(registeredAddresses.SortedCDPs)
  await contracts.borrowerOperations.setPoolManager(registeredAddresses.PoolManager)
  await contracts.borrowerOperations.setPriceFeed(registeredAddresses.PriceFeed)
  await contracts.borrowerOperations.setActivePool(registeredAddresses.ActivePool)
  await contracts.borrowerOperations.setDefaultPool(registeredAddresses.DefaultPool)
  await contracts.borrowerOperations.setCDPManager(registeredAddresses.CDPManager)
  await contracts.borrowerOperations.setList2(registeredAddresses.List2)

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
  deployLiquity: deployLiquity,
  connectContracts: connectContracts
}

