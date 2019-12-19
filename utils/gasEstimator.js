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
  NameRegistry
}

/* bytecode contains placeholders for library addresses, making it non-hex.
Replace these with dummy addresses, representing deployed libraries.
This allows bytecode to be used for gas estimation.
*/
const replaceLibraryPlaceholders = (bytecode) => {
const dummyDeciMathAddr = 'FB88dE099e13c3ED21F80a7a1E49f8CAEcF10df6'.toLowerCase()
const dummySDLLAddr = 'Aa588d3737B611baFD7bD713445b314BD453a5C8'.toLowerCase()
bytecode = bytecode.replace(/__DeciMath______________________________/g, dummyDeciMathAddr)
bytecode = bytecode.replace(/__SortedDoublyLL________________________/g, dummySDLLAddr)

return bytecode
}
// Functions
const getEstimatedGasForDeployment = async (contractJSON) => {
  const contractABI = contractJSON.abi
  let bytecode = contractJSON.bytecode
  
  const bytecodeWithDummies = replaceLibraryPlaceholders(bytecode)
  const contract = new web3.eth.Contract(contractABI)
  const options = {
    data: bytecodeWithDummies
  }

  const estimatedGas = await contract.deploy(options).estimateGas();
  console.log(`estimate deployment cost for ${contractJSON.contractName} is:`)
  console.log(estimatedGas)
  return estimatedGas
}

const getWeb3Contract = (contractJSON) => {
  return new web3.eth.Contract(contractJSON.abi)
}

const estimateAllContracts = async (contractJSONs) => {
  total = 0
  Object.keys(contractJSONs).forEach(contractJSON => {
    total += getEstimatedGasForDeployment(contractJSON)
  });
  console.log(`total estimated gas usage:${total}`)
  return total
}

// Run script
module.exports = async () => {
  try {
    await estimateAllContracts(allContractJSONs)

    // let CDPManager_gasEstimate = await getEstimatedGasForDeployment(allContractJSONs.CDPManager);
    // console.log(typeof CDPManager_gasEstimate)

    // x = replaceLibraryPlaceholders(x)
    // console.log(x)
  } catch (err) {
    // console.log(err)
  }
}