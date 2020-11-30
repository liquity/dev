
const SortedTroves = artifacts.require("./SortedTroves.sol")
const TroveManager = artifacts.require("./TroveManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const LUSDToken = artifacts.require("./LUSDToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")

const deployLiquity = async () => {
  const priceFeed = await PriceFeed.new()
  const sortedTroves = await SortedTroves.new()
  const troveManager = await TroveManager.new()
  const activePool = await ActivePool.new()
  const stabilityPool = await StabilityPool.new()
  const defaultPool = await DefaultPool.new()
  const functionCaller = await FunctionCaller.new()
  const borrowerOperations = await BorrowerOperations.new()
  const lusdToken = await LUSDToken.new(
    troveManager.address,
    stabilityPool.address,
    borrowerOperations.address
  )
  DefaultPool.setAsDeployed(defaultPool)
  PriceFeed.setAsDeployed(priceFeed)
  LUSDToken.setAsDeployed(lusdToken)
  SortedTroves.setAsDeployed(sortedTroves)
  TroveManager.setAsDeployed(troveManager)
  ActivePool.setAsDeployed(activePool)
  StabilityPool.setAsDeployed(stabilityPool)
  FunctionCaller.setAsDeployed(functionCaller)
  BorrowerOperations.setAsDeployed(borrowerOperations)

  const contracts = {
    priceFeed,
    lusdToken,
    sortedTroves,
    troveManager,
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
    LUSDToken: contracts.lusdToken.address,
    SortedTroves: contracts.sortedTroves.address,
    TroveManager: contracts.troveManager.address,
    StabilityPool: contracts.stabilityPool.address,
    ActivePool: contracts.activePool.address,
    DefaultPool: contracts.defaultPool.address,
    FunctionCaller: contracts.functionCaller.address
  }
}

// Connect contracts to their dependencies
const connectContracts = async (contracts, addresses) => {
  // set TroveManager addr in SortedTroves
  await contracts.sortedTroves.setTroveManager(addresses.TroveManager)

  // set contract addresses in the FunctionCaller 
  await contracts.functionCaller.setTroveManagerAddress(addresses.TroveManager)
  await contracts.functionCaller.setSortedTrovesAddress(addresses.SortedTroves)

  // set TroveManager addr in PriceFeed
  await contracts.priceFeed.setTroveManagerAddress(addresses.TroveManager)

  // set contracts in the CDP Manager
  await contracts.troveManager.setLUSDToken(addresses.LUSDToken)
  await contracts.troveManager.setSortedTroves(addresses.SortedTroves)
  await contracts.troveManager.setPriceFeed(addresses.PriceFeed)
  await contracts.troveManager.setActivePool(addresses.ActivePool)
  await contracts.troveManager.setDefaultPool(addresses.DefaultPool)
  await contracts.troveManager.setStabilityPool(addresses.StabilityPool)
  await contracts.troveManager.setBorrowerOperations(addresses.BorrowerOperations)

  // set contracts in BorrowerOperations 
  await contracts.borrowerOperations.setSortedTroves(addresses.SortedTroves)
  await contracts.borrowerOperations.setPriceFeed(addresses.PriceFeed)
  await contracts.borrowerOperations.setActivePool(addresses.ActivePool)
  await contracts.borrowerOperations.setDefaultPool(addresses.DefaultPool)
  await contracts.borrowerOperations.setTroveManager(addresses.TroveManager)

  // set contracts in the Pools
  await contracts.stabilityPool.setActivePoolAddress(addresses.ActivePool)
  await contracts.stabilityPool.setDefaultPoolAddress(addresses.DefaultPool)

  await contracts.activePool.setStabilityPoolAddress(addresses.StabilityPool)
  await contracts.activePool.setDefaultPoolAddress(addresses.DefaultPool)

  await contracts.defaultPool.setStabilityPoolAddress(addresses.StabilityPool)
  await contracts.defaultPool.setActivePoolAddress(addresses.ActivePool)
}

const connectEchidnaProxy = async (echidnaProxy, addresses) => {
  echidnaProxy.setTroveManager(addresses.TroveManager)
  echidnaProxy.setBorrowerOperations(addresses.BorrowerOperations)
}

module.exports = {
  connectEchidnaProxy: connectEchidnaProxy,
  getAddresses: getAddresses,
  deployLiquity: deployLiquity,
  connectContracts: connectContracts
}
