// Buidler-Truffle fixture for deployment to Buidler EVM

const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const PoolManager = artifacts.require("./PoolManager.sol")
const ActivePool = artifacts.require("./ActivePool.sol")
const DefaultPool = artifacts.require("./DefaultPool.sol")
const StabilityPool = artifacts.require("./StabilityPool.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const DeciMath = artifacts.require("./DeciMath.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")

const deploymentHelpers = require("../utils/deploymentHelpers.js")

const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

module.exports = async () => {
  const borrowerOperations = await BorrowerOperations.new()
  const priceFeed = await PriceFeed.new()
  const clvToken = await CLVToken.new()
  const poolManager = await PoolManager.new()
  const sortedCDPs = await SortedCDPs.new()
  const cdpManager = await CDPManager.new()
  const activePool = await ActivePool.new()
  const stabilityPool = await StabilityPool.new()
  const defaultPool = await DefaultPool.new()
  const functionCaller = await FunctionCaller.new()

  BorrowerOperations.setAsDeployed(borrowerOperations)
  PriceFeed.setAsDeployed(priceFeed)
  CLVToken.setAsDeployed(clvToken)
  PoolManager.setAsDeployed(poolManager)
  SortedCDPs.setAsDeployed(sortedCDPs)
  CDPManager.setAsDeployed(cdpManager)
  ActivePool.setAsDeployed(activePool)
  StabilityPool.setAsDeployed(stabilityPool)
  DefaultPool.setAsDeployed(defaultPool)
  FunctionCaller.setAsDeployed(functionCaller)


  const contracts = {
    borrowerOperations,
    priceFeed,
    clvToken,
    poolManager,
    sortedCDPs,
    cdpManager,
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
