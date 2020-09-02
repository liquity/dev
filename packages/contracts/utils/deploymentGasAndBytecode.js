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

const GTStaking = artifacts.require("./GT/GTStaking.sol")
const GrowthToken = artifacts.require("./GT/GrowthToken.sol")
const LockupContractFactory = artifacts.require("./GT/LockupContractFactory.sol")
const CommunityIssuance = artifacts.require("./GT/CommunityIssuance.sol")

const HintHelpers = artifacts.require("./HintHelpers.sol")
const deploymentHelpers = require("./deploymentHelpers.js")
const testHelpers = require("./testHelpers.js")

const th = testHelpers.TestHelper
const deployLiquityCoreBuidler = deploymentHelpers.deployLiquityCoreBuidler
const deployGTContractsBuidler = deploymentHelpers.deployGTContractsBuidler
const connectCoreContracts = deploymentHelpers.connectCoreContracts
const connectGTContractsToCore = deploymentHelpers.connectGTContractsToCore

const coreContractABIs = [
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
  HintHelpers,
]

const GTContractABIs = [
  GTStaking,
  GrowthToken,
  LockupContractFactory,
  CommunityIssuance
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

const logContractDeploymentCosts = async (contracts) => {
  console.log(`Gas costs for deployments: `)
  let totalGasCost = 0
  for (contractName of Object.keys(contracts)) {
    const gasCost = await getGasFromContractDeployment(contracts[contractName], contractName);
    totalGasCost = totalGasCost + Number(gasCost)
  }
  console.log(`Total deployment gas costs: ${totalGasCost}`)
  getUSDCostFromGasCost(totalGasCost, 300, 400)
}

const logContractBytecodeLengths = (contractABIs) => {
  console.log(`Contract bytecode lengths:`)
  for (abi of contractABIs) {
    getBytecodeSize(abi)
  }
}

async function main() {
  const coreContracts = await deployLiquityCoreBuidler()
  const GTContracts = await deployGTContractsBuidler()

  await connectCoreContracts(coreContracts)
  await connectGTContractsToCore(GTContracts, coreContracts)

  await logContractDeploymentCosts(coreContracts)

  console.log(`\n`)

  await logContractDeploymentCosts(GTContracts)

  console.log(`\n`)

  logContractBytecodeLengths(coreContractABIs)

  console.log(`\n`)

  logContractBytecodeLengths(GTContractABIs)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });