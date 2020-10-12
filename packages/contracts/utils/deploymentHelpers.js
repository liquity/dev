const PoolManager = artifacts.require("./PoolManager.sol")
const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const FunctionCaller = artifacts.require("./TestContracts/FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")
const HintHelpers = artifacts.require("./HintHelpers.sol")

const ZERO_ADDRESS = '0x' + '0'.repeat(40)

const deployLiquity = async ()=> {
  const cmdLineArgs = process.argv
  const frameworkPath = cmdLineArgs[1]
  // console.log(`Framework used:  ${frameworkPath}`)

  if (frameworkPath.includes("buidler")) {
    return deployLiquityBuidler()
  } else if (frameworkPath.includes("truffle") || frameworkPath.includes("vertigo")) {
    return deployLiquityTruffle()
  }
} 

const deployLiquityBuidler = async () => {
  const priceFeed = await PriceFeed.new()
  const clvToken = await CLVToken.new()
  const poolManager = await PoolManager.new()
  const sortedCDPs = await SortedCDPs.new()
  const cdpManager = await CDPManager.new()
  const activePool = await ActivePool.new()
  const stabilityPool = await StabilityPool.new()
  const defaultPool = await DefaultPool.new()
  const functionCaller = await FunctionCaller.new()
  const borrowerOperations = await BorrowerOperations.new()
  const hintHelpers = await HintHelpers.new()

  DefaultPool.setAsDeployed(defaultPool)
  PriceFeed.setAsDeployed(priceFeed)
  CLVToken.setAsDeployed(clvToken)
  PoolManager.setAsDeployed(poolManager)
  SortedCDPs.setAsDeployed(sortedCDPs)
  CDPManager.setAsDeployed(cdpManager)
  ActivePool.setAsDeployed(activePool)
  StabilityPool.setAsDeployed(stabilityPool)
  FunctionCaller.setAsDeployed(functionCaller)
  BorrowerOperations.setAsDeployed(borrowerOperations)
  HintHelpers.setAsDeployed(hintHelpers)

  const contracts = {
    priceFeed,
    clvToken,
    poolManager,
    sortedCDPs,
    cdpManager,
    activePool,
    stabilityPool,
    defaultPool,
    functionCaller,
    borrowerOperations,
    hintHelpers
  }
  return contracts
}

const deployLiquityTruffle = async () => {
  const priceFeed = await PriceFeed.new()
  const clvToken = await CLVToken.new()
  const poolManager = await PoolManager.new()
  const sortedCDPs = await SortedCDPs.new()
  const cdpManager = await CDPManager.new()
  const activePool = await ActivePool.new()
  const stabilityPool = await StabilityPool.new()
  const defaultPool = await DefaultPool.new()
  const functionCaller = await FunctionCaller.new()
  const borrowerOperations = await BorrowerOperations.new()
  const hintHelpers = await HintHelpers.new()

  const contracts = {
    priceFeed,
    clvToken,
    poolManager,
    sortedCDPs,
    cdpManager,
    activePool,
    stabilityPool,
    defaultPool,
    functionCaller,
    borrowerOperations,
    hintHelpers
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
    StabilityPool: contracts.stabilityPool.address,
    ActivePool: contracts.activePool.address,
    DefaultPool: contracts.defaultPool.address,
    FunctionCaller: contracts.functionCaller.address,
    HintHelpers: contracts.hintHelpers.address
  }
}

// Connect contracts to their dependencies
const connectContracts = async (contracts, addresses) => {
  // set PoolManager address in the CLVToken contract
  await contracts.clvToken.setPoolManagerAddress(addresses.PoolManager)

   // set contracts in the PoolManager
  await contracts.poolManager.setAddresses(
    addresses.BorrowerOperations,
    addresses.CDPManager,
    addresses.PriceFeed,
    addresses.CLVToken,
    addresses.StabilityPool,
    addresses.ActivePool,
    addresses.DefaultPool
  )

  // set CDPManager addr in SortedCDPs
  await contracts.sortedCDPs.setParams(
    1e6,
    addresses.CDPManager,
    addresses.BorrowerOperations
  )

  // set contract addresses in the FunctionCaller 
  await contracts.functionCaller.setCDPManagerAddress(addresses.CDPManager)
  await contracts.functionCaller.setSortedCDPsAddress(addresses.SortedCDPs)

  // set CDPManager addr in PriceFeed
  await contracts.priceFeed.setAddresses(
    addresses.CDPManager,
    addresses.PoolManager,
    ZERO_ADDRESS,
    ZERO_ADDRESS
  )

  // set contracts in the CDP Manager
  await contracts.cdpManager.setAddresses(
    addresses.BorrowerOperations,
    addresses.PoolManager,
    addresses.ActivePool,
    addresses.DefaultPool,
    addresses.StabilityPool,
    addresses.PriceFeed,
    addresses.CLVToken,
    addresses.SortedCDPs
  )

  // set contracts in BorrowerOperations 
  await contracts.borrowerOperations.setAddresses(
    addresses.CDPManager,
    addresses.PoolManager,
    addresses.ActivePool,
    addresses.DefaultPool,
    addresses.PriceFeed,
    addresses.SortedCDPs
  )

  // set contracts in the Pools
  await contracts.stabilityPool.setAddresses(
    addresses.PoolManager,
    addresses.ActivePool,
    addresses.DefaultPool
  )

  await contracts.activePool.setAddresses(
    addresses.PoolManager,
    addresses.CDPManager,
    addresses.DefaultPool,
    addresses.StabilityPool
  )

  await contracts.defaultPool.setAddresses(
    addresses.PoolManager,
    addresses.ActivePool,
    addresses.StabilityPool
  )

  // set contracts in HintHelpers
  await contracts.hintHelpers.setAddresses(
    addresses.PriceFeed,
    addresses.SortedCDPs,
    addresses.CDPManager
  )
}

module.exports = {
  getAddresses: getAddresses,
  deployLiquityBuidler: deployLiquityBuidler,
  deployLiquityTruffle: deployLiquityTruffle,
  deployLiquity: deployLiquity,
  connectContracts: connectContracts,
  ZERO_ADDRESS
}

