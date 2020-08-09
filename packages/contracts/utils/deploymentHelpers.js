const PoolManager = artifacts.require("./PoolManager.sol")
const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")
const HintHelpers = artifacts.require("./HintHelpers.sol")

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

  const sizeList_18orLess = await SortedCDPs.new()
  const sizeList_19orGreater = await SortedCDPs.new()

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

  SortedCDPs.setAsDeployed(sizeList_18orLess)
  SortedCDPs.setAsDeployed(sizeList_19orGreater)

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

    sizeList_18orLess,
    sizeList_19orGreater
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

  SortedCDPs.setAsDeployed(sizeList_18orLess)
  SortedCDPs.setAsDeployed(sizeList_19orGreater)

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

    sizeList_18orLess,
    sizeList_19orGreater
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
    SizeList_18orLess: contracts.sizeList_18orLess.address,
    SizeList_19orGreater: contracts.sizeList_19orGreater.address
  }
}

// Connect contracts to their dependencies
const connectContracts = async (contracts, addresses) => {
  // set PoolManager address in the CLVToken contract
  await contracts.clvToken.setPoolManagerAddress(addresses.PoolManager)

   // set contracts in the PoolManager
  await contracts.poolManager.setBorrowerOperations(addresses.BorrowerOperations)
  await contracts.poolManager.setCDPManager(addresses.CDPManager)
  await contracts.poolManager.setCLVToken(addresses.CLVToken)
  await contracts.poolManager.setPriceFeed(addresses.PriceFeed)
  await contracts.poolManager.setStabilityPool(addresses.StabilityPool)
  await contracts.poolManager.setActivePool(addresses.ActivePool)
  await contracts.poolManager.setDefaultPool(addresses.DefaultPool)

  // Set CDPManager and Borrower addr in full sorted list
  await contracts.sortedCDPs.setCDPManager(addresses.CDPManager)
  await contracts.sortedCDPs.setBorrowerOperations(addresses.BorrowerOperations)

   // Set CDPManager and Borrower addr in the size range lists
  await contracts.sizeList_18orLess.setCDPManager(addresses.CDPManager)
  await contracts.sizeList_18orLess.setBorrowerOperations(addresses.BorrowerOperations)
  await contracts.sizeList_19orGreater.setCDPManager(addresses.CDPManager)
  await contracts.sizeList_19orGreater.setBorrowerOperations(addresses.BorrowerOperations)


  // set contract addresses in the FunctionCaller 
  await contracts.functionCaller.setCDPManagerAddress(addresses.CDPManager)
  await contracts.functionCaller.setSortedCDPsAddress(addresses.SortedCDPs)

  // set CDPManager addr in PriceFeed
  await contracts.priceFeed.setCDPManagerAddress(addresses.CDPManager)

  // set contracts in the CDP Manager
  await contracts.cdpManager.setSortedCDPs(addresses.SortedCDPs)
  await contracts.cdpManager.setPoolManager(addresses.PoolManager)
  await contracts.cdpManager.setPriceFeed(addresses.PriceFeed)
  await contracts.cdpManager.setCLVToken(addresses.CLVToken)
  await contracts.cdpManager.setActivePool(addresses.ActivePool)
  await contracts.cdpManager.setDefaultPool(addresses.DefaultPool)
  await contracts.cdpManager.setStabilityPool(addresses.StabilityPool)
  await contracts.cdpManager.setBorrowerOperations(addresses.BorrowerOperations)

  await contracts.cdpManager.setSizeList(18, addresses.SizeList_18orLess)
  await contracts.cdpManager.setSizeList(19, addresses.SizeList_19orGreater)

  // set contracts in BorrowerOperations 
  await contracts.borrowerOperations.setSortedCDPs(addresses.SortedCDPs)
  await contracts.borrowerOperations.setPoolManager(addresses.PoolManager)
  await contracts.borrowerOperations.setPriceFeed(addresses.PriceFeed)
  await contracts.borrowerOperations.setActivePool(addresses.ActivePool)
  await contracts.borrowerOperations.setDefaultPool(addresses.DefaultPool)
  await contracts.borrowerOperations.setCDPManager(addresses.CDPManager)

  // set contracts in the Pools
  await contracts.stabilityPool.setPoolManagerAddress(addresses.PoolManager)
  await contracts.stabilityPool.setActivePoolAddress(addresses.ActivePool)
  await contracts.stabilityPool.setDefaultPoolAddress(addresses.DefaultPool)

  await contracts.activePool.setPoolManagerAddress(addresses.PoolManager)
  await contracts.activePool.setCDPManagerAddress(addresses.CDPManager)
  await contracts.activePool.setStabilityPoolAddress(addresses.StabilityPool)
  await contracts.activePool.setDefaultPoolAddress(addresses.DefaultPool)

  await contracts.defaultPool.setPoolManagerAddress(addresses.PoolManager)
  await contracts.defaultPool.setStabilityPoolAddress(addresses.StabilityPool)
  await contracts.defaultPool.setActivePoolAddress(addresses.ActivePool)
}

const deployAndConnectHintHelpers = async (addresses) => {
  const hintHelpers = await HintHelpers.new()
  HintHelpers.setAsDeployed(hintHelpers)

  hintHelpers.setPriceFeed(addresses.PriceFeed)
  hintHelpers.setCDPManager(addresses.CDPManager)
  hintHelpers.setSortedCDPs(addresses.SortedCDPs)

  return hintHelpers
}

module.exports = {
  getAddresses: getAddresses,
  deployLiquityBuidler: deployLiquityBuidler,
  deployLiquityTruffle: deployLiquityTruffle,
  deployLiquity: deployLiquity,
  deployAndConnectHintHelpers: deployAndConnectHintHelpers,
  connectContracts: connectContracts
}

