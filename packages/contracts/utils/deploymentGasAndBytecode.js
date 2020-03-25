// Buidler script
const PoolManager = artifacts.require("./PoolManager.sol")
const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const NameRegistry = artifacts.require("./NameRegistry.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const DeciMath = artifacts.require("DeciMath")
const ABDKMath64x64 = artifacts.require("ABDKMath64x64")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const deploymentHelpers = require("./deploymentHelpers.js")

const getAddresses = deploymentHelpers.getAddresses
const setNameRegistry = deploymentHelpers.setNameRegistry
const connectContracts = deploymentHelpers.connectContracts
const getAddressesFromNameRegistry = deploymentHelpers.getAddressesFromNameRegistry


contractABIs = [
    PriceFeed,
    CLVToken, 
    PoolManager,
    SortedCDPs,
    CDPManager, 
    NameRegistry, 
    ActivePool,
    StabilityPool, 
    DefaultPool,
    FunctionCaller 
]

    const getGasFromContractDeployment = async (contractObject, name) => {
        const txHash = contractObject.transactionHash
        // console.log(`tx hash  of ${name} deployment is is: ${txHash}`)
        const receipt = await ethers.provider.getTransactionReceipt(txHash)
        const gas = receipt.gasUsed
        console.log(`Gas cost of ${name} deployment is is: ${gas}`)
        return gas
      }
    
    const getBytecodeSize = (contractABI) => {
            const bytecodeLength = (contractABI.bytecode.length / 2) - 1 
            const deployedBytecodeLength = (contractABI.deployedBytecode.length / 2) - 1 
            console.log(`${contractABI.contractName} bytecode length: ${bytecodeLength}`)
            console.log(`${contractABI.contractName} deployed bytecode length: ${deployedBytecodeLength}`)
            }

async function main() {

    const deciMath = await DeciMath.new()
    const abdkMath = await ABDKMath64x64.new()
    DeciMath.setAsDeployed(deciMath)
    ABDKMath64x64.setAsDeployed(abdkMath)

    const priceFeed = await PriceFeed.new()
    const clvToken = await CLVToken.new()
    const poolManager = await PoolManager.new()
    const sortedCDPs = await SortedCDPs.new()
    const cdpManager = await CDPManager.new()
    const nameRegistry = await NameRegistry.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await StabilityPool.new()
    const defaultPool = await DefaultPool.new()
    const functionCaller = await FunctionCaller.new()

    contracts = {
        priceFeed: priceFeed,
        clvToken: clvToken, 
        poolManager: poolManager,
        sortedCDPs: sortedCDPs,
        cdpManager: cdpManager,
        nameRegistry: nameRegistry,
        activePool: activePool,
        stabilityPool: stabilityPool,
        defaultPool: defaultPool,
        functionCaller: functionCaller
      }

    const contractAddresses = getAddresses(contracts)
    await setNameRegistry(contractAddresses, nameRegistry)
    const registeredAddresses = await getAddressesFromNameRegistry(nameRegistry)
    await connectContracts(contracts, registeredAddresses)

    for (contractName of Object.keys(contracts)) {
        await getGasFromContractDeployment(contracts[contractName], contractName);
    }
    console.log(`\n`)

    for (abi of contractABIs) {
       getBytecodeSize(abi)
    }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });