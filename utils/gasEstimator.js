const SortedDoublyLL = artifacts.require("./SortedDoublyLL.sol")
const PoolManager = artifacts.require("./PoolManager.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const NameRegistry = artifacts.require("./NameRegistry.sol")

//Contract Artifacts
const allContractJSONs = { 
    SortedDoublyLL, 
    PoolManager, 
    ActivePool, 
    DefaultPool, 
    StabilityPool, 
    CDPManager, 
    PriceFeed, 
    CLVToken, 
    NameRegistry }

// Functions
const getEstimatedGasForDeployment = async (contractJSON) => {
const contractJSON = artifacts.require
const contractABI = contractJSON.abi;
const contract = new web3.eth.Contract(contractABI);

const estimatedGas = await contract.deploy(options).estimateGas();
console.log(`estimate deployment cost for ${contractJSON.contractName} is:`)
console.log(estimatedGas)
return estimatedGas
}

const estimateAll = async (contractJSONs) => {
    total = 0
    Object.keys(contractJSONs).forEach( contractJSON => {
        total += getEstimatedGasForDeployment(contractJSON)
     });
    console.log(`total estimated gas usage:${total}`)
    return total
}

// Run script
await estimateAll(allContractJSONs)