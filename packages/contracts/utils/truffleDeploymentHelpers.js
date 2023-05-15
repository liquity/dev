
const SortedTroves = artifacts.require("./SortedTroves.sol")
const TroveManager = artifacts.require("./TroveManager.sol")
const PriceFeedLocalnet = artifacts.require("./PriceFeedLocalnet.sol")
const ONEUSDToken = artifacts.require("./ONEUSDToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")

const deployLiquity = async () => {
  const priceFeedLocalnet = await PriceFeedLocalnet.new()
  const sortedTroves = await SortedTroves.new()
  const troveManager = await TroveManager.new()
  const activePool = await ActivePool.new()
  const stabilityPool = await StabilityPool.new()
  const defaultPool = await DefaultPool.new()
  const functionCaller = await FunctionCaller.new()
  const borrowerOperations = await BorrowerOperations.new()
  const oneusdToken = await ONEUSDToken.new(
    troveManager.address,
    stabilityPool.address,
    borrowerOperations.address
  )
  DefaultPool.setAsDeployed(defaultPool)
  PriceFeedLocalnet.setAsDeployed(priceFeedLocalnet)
  ONEUSDToken.setAsDeployed(oneusdToken)
  SortedTroves.setAsDeployed(sortedTroves)
  TroveManager.setAsDeployed(troveManager)
  ActivePool.setAsDeployed(activePool)
  StabilityPool.setAsDeployed(stabilityPool)
  FunctionCaller.setAsDeployed(functionCaller)
  BorrowerOperations.setAsDeployed(borrowerOperations)

  const contracts = {
    priceFeedLocalnet,
    oneusdToken,
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
    PriceFeedLocalnet: contracts.priceFeedLocalnet.address,
    ONEUSDToken: contracts.oneusdToken.address,
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
  await contracts.priceFeedLocalnet.setTroveManagerAddress(addresses.TroveManager)

  // set contracts in the Trove Manager
  await contracts.troveManager.setONEUSDToken(addresses.ONEUSDToken)
  await contracts.troveManager.setSortedTroves(addresses.SortedTroves)
  await contracts.troveManager.setPriceFeed(addresses.PriceFeedLocalnet)
  await contracts.troveManager.setActivePool(addresses.ActivePool)
  await contracts.troveManager.setDefaultPool(addresses.DefaultPool)
  await contracts.troveManager.setStabilityPool(addresses.StabilityPool)
  await contracts.troveManager.setBorrowerOperations(addresses.BorrowerOperations)

  // set contracts in BorrowerOperations 
  await contracts.borrowerOperations.setSortedTroves(addresses.SortedTroves)
  await contracts.borrowerOperations.setPriceFeed(addresses.PriceFeedLocalnet)
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
