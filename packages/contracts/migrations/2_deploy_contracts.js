// Truffle migration script for deployment to Ganache

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
const EchidnaProxy = artifacts.require("./EchidnaProxy.sol")

const deploymentHelpers = require("../utils/truffleDeploymentHelpers.js")

const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts
const connectEchidnaProxy = deploymentHelpers.connectEchidnaProxy

module.exports = function(deployer) {
  deployer.deploy(DeciMath)
  deployer.deploy(BorrowerOperations)
  deployer.deploy(PriceFeed)
  deployer.deploy(CLVToken)
  deployer.deploy(PoolManager)
  deployer.deploy(SortedCDPs)
  deployer.deploy(CDPManager)
  deployer.link(DeciMath, CDPManager)
  deployer.link(DeciMath, PoolManager)
  deployer.deploy(ActivePool)
  deployer.deploy(StabilityPool)
  deployer.deploy(DefaultPool)
  deployer.deploy(FunctionCaller)
  deployer.deploy(EchidnaProxy)


  deployer.then(async () => {

  const borrowerOperations = await BorrowerOperations.deployed()
  const priceFeed = await PriceFeed.deployed()
  const clvToken = await CLVToken.deployed()
  const poolManager = await PoolManager.deployed()
  const sortedCDPs = await SortedCDPs.deployed()
  const cdpManager = await CDPManager.deployed()
  const activePool = await ActivePool.deployed()
  const stabilityPool = await StabilityPool.deployed()
  const defaultPool = await DefaultPool.deployed()
  const functionCaller = await FunctionCaller.deployed()
  const echidnaProxy = await EchidnaProxy.deployed()

  const liquityContracts = {
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
  const liquityAddresses = getAddresses(liquityContracts)
  console.log('deploy_contracts.js - Deployed contract addresses: \n')
  console.log(liquityAddresses)
  console.log('\n')

  // Connect contracts to each other
  await connectContracts(liquityContracts, liquityAddresses)
  await connectEchidnaProxy(echidnaProxy, liquityAddresses)
})
}
