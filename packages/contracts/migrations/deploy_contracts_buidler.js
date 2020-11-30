// Buidler-Truffle fixture for deployment to Buidler EVM

const SortedTroves = artifacts.require("./SortedTroves.sol")
const ActivePool = artifacts.require("./ActivePool.sol")
const DefaultPool = artifacts.require("./DefaultPool.sol")
const StabilityPool = artifacts.require("./StabilityPool.sol")
const TroveManager = artifacts.require("./TroveManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const LUSDToken = artifacts.require("./LUSDToken.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")

const deploymentHelpers = require("../utils/deploymentHelpers.js")

const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

module.exports = async () => {
  const borrowerOperations = await BorrowerOperations.new()
  const priceFeed = await PriceFeed.new()
  const sortedTroves = await SortedTroves.new()
  const troveManager = await TroveManager.new()
  const activePool = await ActivePool.new()
  const stabilityPool = await StabilityPool.new()
  const defaultPool = await DefaultPool.new()
  const functionCaller = await FunctionCaller.new()
  const lusdToken = await LUSDToken.new(
    troveManager.address,
    stabilityPool.address,
    borrowerOperations.address
  )
  BorrowerOperations.setAsDeployed(borrowerOperations)
  PriceFeed.setAsDeployed(priceFeed)
  SortedTroves.setAsDeployed(sortedTroves)
  TroveManager.setAsDeployed(troveManager)
  ActivePool.setAsDeployed(activePool)
  StabilityPool.setAsDeployed(stabilityPool)
  DefaultPool.setAsDeployed(defaultPool)
  FunctionCaller.setAsDeployed(functionCaller)
  LUSDToken.setAsDeployed(lusdToken)

  const contracts = {
    borrowerOperations,
    priceFeed,
    lusdToken,
    sortedTroves,
    troveManager,
    activePool,
    stabilityPool,
    defaultPool,
    functionCaller
  }

  // Grab contract addresses
  const addresses = getAddresses(contracts)
  console.log('deploy_contracts.js - Deployhed contract addresses: \n')
  console.log(addresses)
  console.log('\n')

  // Connect contracts to each other via the NameRegistry records
  await connectContracts(contracts, addresses)
}
