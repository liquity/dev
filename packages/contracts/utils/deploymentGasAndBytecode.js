// Buidler script
const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")

const LQTYStaking = artifacts.require("./GT/LQTYStaking.sol")
const GrowthToken = artifacts.require("./GT/GrowthToken.sol")
const LockupContractFactory = artifacts.require("./GT/LockupContractFactory.sol")
const CommunityIssuance = artifacts.require("./GT/CommunityIssuance.sol")
const HintHelpers = artifacts.require("./HintHelpers.sol")

const CommunityIssuanceTester = artifacts.require("./GT/CommunityIssuanceTester.sol")
const ActivePoolTester = artifacts.require("./ActivePoolTester.sol")
const DefaultPoolTester = artifacts.require("./DefaultPoolTester.sol")
const MathTester = artifacts.require("./MathTester.sol")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const CDPManagerTester = artifacts.require("./CDPManagerTester.sol")
const CLVTokenTester = artifacts.require("./CLVTokenTester.sol")

const dh = require("./deploymentHelpers.js")

const coreContractABIs = [
  BorrowerOperations,
  PriceFeed,
  CLVToken,
  SortedCDPs,
  CDPManager,
  ActivePool,
  StabilityPool,
  DefaultPool,
  FunctionCaller,
  HintHelpers,
]

const GTContractABIs = [
  LQTYStaking,
  GrowthToken,
  LockupContractFactory,
  CommunityIssuance
]

const TesterContractABIs  = [
  CommunityIssuanceTester,
  ActivePoolTester,
  DefaultPoolTester,
  MathTester,
  BorrowerOperationsTester,
  CDPManagerTester,
  CLVTokenTester,
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
  getUSDCostFromGasCost(totalGasCost, 200, 500)
}

const logContractBytecodeLengths = (contractABIs) => {
  console.log(`Contract bytecode lengths:`)
  for (abi of contractABIs) {
    getBytecodeSize(abi)
  }
}

// Run script: log deployment gas costs and bytecode lengths for all contracts
async function main() {
  const coreContracts = await dh.deployLiquityCoreBuidler()
  const GTContracts = await dh.deployGTContractsBuidler()
  const testerContracts = await dh.deployTesterContractsBuidler()

  await dh.connectCoreContracts(coreContracts, GTContracts)
  await dh.connectGTContracts(GTContracts)
  await dh.connectGTContractsToCore(GTContracts, coreContracts)


  console.log(`\n`)
  console.log(`GT CONTRACTS`)
  await logContractDeploymentCosts(GTContracts)
  console.log(`\n`)
  logContractBytecodeLengths(GTContractABIs)
  console.log(`\n`)

  console.log(`CORE CONTRACTS`)
  await logContractDeploymentCosts(coreContracts)
  console.log(`\n`)
  logContractBytecodeLengths(coreContractABIs)
  console.log(`\n`)

  console.log(`TESTER CONTRACTS`)
  await logContractDeploymentCosts(testerContracts)
  console.log(`\n`)
  logContractBytecodeLengths(TesterContractABIs)
  console.log(`\n`)

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });