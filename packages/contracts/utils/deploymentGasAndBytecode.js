// Buidler script
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
const deploymentHelpers = require("./deploymentHelpers.js")
const testHelpers =  require("./testHelpers.js")

const th = testHelpers.TestHelper
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

contractABIs = [
    BorrowerOperations,
    PriceFeed,
    CLVToken, 
    PoolManager,
    SortedCDPs,
    CDPManager, 
    ActivePool,
    StabilityPool, 
    DefaultPool,
    FunctionCaller,
    HintHelpers
]

    const getGasFromContractDeployment = async (contractObject, name) => {
        const txHash = contractObject.transactionHash
        // console.log(`tx hash  of ${name} deployment is is: ${txHash}`)
        const receipt = await ethers.provider.getTransactionReceipt(txHash)
        const gas = receipt.gasUsed
        console.log(`${name}: ${gas}`)
        return gas
      }
    
    const getBytecodeSize = (contractABI) => {
            const bytecodeLength = (contractABI.bytecode.length / 2) - 1 
            const deployedBytecodeLength = (contractABI.deployedBytecode.length / 2) - 1 
            console.log(`${contractABI.contractName}: ${bytecodeLength}`)
            // console.log(`${contractABI.contractName} deployed bytecode length: ${deployedBytecodeLength}`)
            }
    
    const getUSDCostFromGasCost = (deploymentGasTotal, gasPriceInGwei, ETHPrice) => {
      const dollarCost = (deploymentGasTotal * gasPriceInGwei * ETHPrice) / 1e9
      console.log(`At gas price ${gasPriceInGwei} GWei, and ETH Price $${ETHPrice} per ETH, the total cost of deployment in USD is: $${dollarCost}`)
      }

async function main() {
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
    const hintHelpers = await HintHelpers.new()

    contracts = {
        borrowerOperations: borrowerOperations,
        priceFeed: priceFeed,
        clvToken: clvToken, 
        poolManager: poolManager,
        sortedCDPs: sortedCDPs,
        cdpManager: cdpManager,
        activePool: activePool,
        stabilityPool: stabilityPool,
        defaultPool: defaultPool,
        functionCaller: functionCaller,
        hintHelpers: hintHelpers
      }

    const contractAddresses = getAddresses(contracts)
    await connectContracts(contracts, contractAddresses)

    console.log(`Gas costs for deployments: `)
    let totalGasCost = 0
    for (contractName of Object.keys(contracts)) {
        const gasCost  = await getGasFromContractDeployment(contracts[contractName], contractName);
        totalGasCost = totalGasCost + Number(gasCost)
    }
    console.log(`Total deployment gas costs: ${totalGasCost}`)
    getUSDCostFromGasCost(totalGasCost, 200, 400)
   
    console.log(`\n`)

    console.log(`Contract bytecode lengths:`)
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