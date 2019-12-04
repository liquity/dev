const SortedDoublyLL = artifacts.require("./SortedDoublyLL.sol")
const PoolManager = artifacts.require("./PoolManager.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const NameRegistry = artifacts.require("./NameRegistry.sol")
const deploymentHelpers = require("../utils/deploymentHelpers.js")

const getAddresses = deploymentHelpers.getAddresses
const setNameRegistry = deploymentHelpers.setNameRegistry
const connectContracts = deploymentHelpers.connectContracts
const getAddressesFromNameRegistry = deploymentHelpers.getAddressesFromNameRegistry


module.exports =  function(deployer) {
    // Deploy contract bytecode to blockchain
    deployer.deploy(SortedDoublyLL)
    deployer.link(SortedDoublyLL, CDPManager)
    deployer.deploy(NameRegistry)
    deployer.deploy(PriceFeed)
    deployer.deploy(CLVToken)
    deployer.deploy(PoolManager)
    deployer.deploy(CDPManager)

  deployer.then (async () => {
   // Grab contract representations
    const priceFeed = await PriceFeed.deployed()
    const clvToken = await CLVToken.deployed()
    const poolManager = await PoolManager.deployed()
    const cdpManager = await CDPManager.deployed()
    const nameRegistry = await NameRegistry.deployed()

    const contracts = { priceFeed, clvToken, poolManager, cdpManager, nameRegistry }

    // Grab contract addresses
    const addresses = getAddresses(contracts)

    // Register contracts in the nameRegistry
    await setNameRegistry(addresses, nameRegistry);

    // Get addresses from NameRegistry 
    const registeredAddresses = await getAddressesFromNameRegistry(nameRegistry)
    console.log('deploy_contracts.js - Contract addresses stored in NameRegistry: \n')
    console.log(registeredAddresses)

    // Connect contracts to each other via the NameRegistry records
    await connectContracts(contracts, registeredAddresses)
  })
}



