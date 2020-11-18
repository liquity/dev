// Truffle migration script for deployment to Ganache

const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const PoolManager = artifacts.require("./PoolManager.sol")
const ActivePool = artifacts.require("./ActivePool.sol")
const DefaultPool = artifacts.require("./DefaultPool.sol")
const StabilityPool = artifacts.require("./StabilityPool.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")

const deploymentHelpers = require("../utils/truffleDeploymentHelpers.js")

const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

module.exports = function(deployer) {
  deployer.deploy(BorrowerOperations)
  deployer.deploy(PriceFeed)
  deployer.deploy(PoolManager)
  deployer.deploy(SortedCDPs)
  deployer.deploy(CDPManager)
  deployer.deploy(ActivePool)
  deployer.deploy(StabilityPool)
  deployer.deploy(DefaultPool)
  deployer.deploy(CLVToken)
  deployer.deploy(FunctionCaller)

  deployer.then( async () => {
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
  })
}
