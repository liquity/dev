const PoolManager = artifacts.require("./PoolManager.sol")
const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const FunctionCaller = artifacts.require("./TestContracts/FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")
const HintHelpers = artifacts.require("./HintHelpers.sol")
const GTStaking = artifacts.require("./GT/GTStaking.sol")
const GrowthToken = artifacts.require("./GT/GrowthToken.sol")
const LockupContractFactory = artifacts.require("./GT/LockupContractFactory.sol")
const CommunityIssuance = artifacts.require("./GT/CommunityIssuance.sol")

/* "Liquity core" consists of all contracts in the core Liquity system.

GT contracts consist of only those contracts related to the Growth Token:the token itself, 
and lockup, staking and community issuance coreContracts. */

const deployLiquityCore = async () => {
  const cmdLineArgs = process.argv
  const frameworkPath = cmdLineArgs[1]
  // console.log(`Framework used:  ${frameworkPath}`)

  if (frameworkPath.includes("buidler")) {
    return deployLiquityBuidler()
  } else if (frameworkPath.includes("truffle") || frameworkPath.includes("vertigo")) {
    return deployLiquityTruffle()
  }
} 

const deployLiquityCoreBuidler = async () => {
  const priceFeed = await PriceFeed.new()
  const clvToken = await CLVToken.new()
  const poolManager = await PoolManager.new()
  const sortedCDPs = await SortedCDPs.new()
  const cdpManager = await CDPManager.new()
  const activePool = await ActivePool.new()
  const stabilityPool = await StabilityPool.new()
  const defaultPool = await DefaultPool.new()
  const functionCaller = await FunctionCaller.new()
  const borrowerOperations = await BorrowerOperations.new()
  const hintHelpers = await HintHelpers.new()

  DefaultPool.setAsDeployed(defaultPool)
  PriceFeed.setAsDeployed(priceFeed)
  CLVToken.setAsDeployed(clvToken)
  PoolManager.setAsDeployed(poolManager)
  SortedCDPs.setAsDeployed(sortedCDPs)
  CDPManager.setAsDeployed(cdpManager)
  ActivePool.setAsDeployed(activePool)
  StabilityPool.setAsDeployed(stabilityPool)
  FunctionCaller.setAsDeployed(functionCaller)
  BorrowerOperations.setAsDeployed(borrowerOperations)
  HintHelpers.setAsDeployed(hintHelpers)

  const coreContracts = {
    priceFeed,
    clvToken,
    poolManager,
    sortedCDPs,
    cdpManager,
    activePool,
    stabilityPool,
    defaultPool,
    functionCaller,
    borrowerOperations,
    hintHelpers
  }
  return coreContracts
}

const deployGTContractsBuidler = async () => {
  const gtStaking = await GTStaking.new()
  const lockupContractFactory = await LockupContractFactory.new()
  const communityIssuance = await CommunityIssuance.new()

  GTStaking.setAsDeployed(gtStaking)
  LockupContractFactory.setAsDeployed(lockupContractFactory)
  CommunityIssuance.setAsDeployed(communityIssuance)

  // Deploy Growth Token, passing Community Issuance and Factory addresses to the constructor 
  const growthToken = await GrowthToken.new(communityIssuance.address, lockupContractFactory.address)
  GrowthToken.setAsDeployed(growthToken)

  const GTContracts = {
    gtStaking,
    lockupContractFactory,
    communityIssuance,
    growthToken
  }

  return GTContracts
}

const deployLiquityCoreTruffle = async () => {
  const priceFeed = await PriceFeed.new()
  const clvToken = await CLVToken.new()
  const poolManager = await PoolManager.new()
  const sortedCDPs = await SortedCDPs.new()
  const cdpManager = await CDPManager.new()
  const activePool = await ActivePool.new()
  const stabilityPool = await StabilityPool.new()
  const defaultPool = await DefaultPool.new()
  const functionCaller = await FunctionCaller.new()
  const borrowerOperations = await BorrowerOperations.new()
  const hintHelpers = await HintHelpers.new()

  const coreContracts = {
    priceFeed,
    clvToken,
    poolManager,
    sortedCDPs,
    cdpManager,
    activePool,
    stabilityPool,
    defaultPool,
    functionCaller,
    borrowerOperations,
    hintHelpers
  }

  return coreContracts
}

const deployGTContractsTruffle = async () => {
  const gtStaking = await GTStaking.new()
  const lockupContractFactory = await LockupContractFactory.new()
  const communityIssuance = await CommunityIssuance.new()

  // Deploy Growth Token, passing Community Issuance and Factory addresses to the constructor 
  const growthToken = await GrowthToken.new(communityIssuance.address, lockupContractFactory.address)

  const GTContracts = {
    gtStaking,
    lockupContractFactory,
    communityIssuance,
    growthToken
  }

  return GTContracts
}

// Connect core contracts to their dependencies
const connectCoreContracts = async (coreContracts) => {
  // set PoolManager address in the CLVToken contract
  await coreContracts.clvToken.setPoolManagerAddress(coreContracts.poolManager.address)

   // set contracts in the PoolManager
  await coreContracts.poolManager.setBorrowerOperations(coreContracts.borrowerOperations.address)
  await coreContracts.poolManager.setCDPManager(coreContracts.cdpManager.address)
  await coreContracts.poolManager.setCLVToken(coreContracts.clvToken.address)
  await coreContracts.poolManager.setPriceFeed(coreContracts.clvToken.address)
  await coreContracts.poolManager.setStabilityPool( coreContracts.stabilityPool.address)
  await coreContracts.poolManager.setActivePool(coreContracts.activePool.address)
  await coreContracts.poolManager.setDefaultPool(coreContracts.defaultPool.address)

  // set CDPManager addr in SortedCDPs
  await coreContracts.sortedCDPs.setCDPManager(coreContracts.cdpManager.address)
  await coreContracts.sortedCDPs.setBorrowerOperations(coreContracts.borrowerOperations.address)

  // set contract addresses in the FunctionCaller 
  await coreContracts.functionCaller.setCDPManagerAddress(coreContracts.cdpManager.address)
  await coreContracts.functionCaller.setSortedCDPsAddress(coreContracts.sortedCDPs.address)

  // set CDPManager addr in PriceFeed
  await coreContracts.priceFeed.setCDPManagerAddress(coreContracts.cdpManager.address)

  // set contracts in the CDP Manager
  await coreContracts.cdpManager.setSortedCDPs(coreContracts.sortedCDPs.address)
  await coreContracts.cdpManager.setPoolManager(coreContracts.poolManager.address)
  await coreContracts.cdpManager.setPriceFeed(coreContracts.clvToken.address)
  await coreContracts.cdpManager.setCLVToken(coreContracts.clvToken.address)
  await coreContracts.cdpManager.setActivePool(coreContracts.activePool.address)
  await coreContracts.cdpManager.setDefaultPool(coreContracts.defaultPool.address)
  await coreContracts.cdpManager.setStabilityPool( coreContracts.stabilityPool.address)
  await coreContracts.cdpManager.setBorrowerOperations(coreContracts.borrowerOperations.address)

  // set contracts in BorrowerOperations 
  await coreContracts.borrowerOperations.setSortedCDPs(coreContracts.sortedCDPs.address)
  await coreContracts.borrowerOperations.setPoolManager(coreContracts.poolManager.address)
  await coreContracts.borrowerOperations.setPriceFeed(coreContracts.clvToken.address)
  await coreContracts.borrowerOperations.setActivePool(coreContracts.activePool.address)
  await coreContracts.borrowerOperations.setDefaultPool(coreContracts.defaultPool.address)
  await coreContracts.borrowerOperations.setCDPManager(coreContracts.cdpManager.address)

  // set contracts in the Pools
  await coreContracts.stabilityPool.setPoolManagerAddress(coreContracts.poolManager.address)
  await coreContracts.stabilityPool.setActivePoolAddress(coreContracts.activePool.address)
  await coreContracts.stabilityPool.setDefaultPoolAddress(coreContracts.defaultPool.address)

  await coreContracts.activePool.setPoolManagerAddress(coreContracts.poolManager.address)
  await coreContracts.activePool.setCDPManagerAddress(coreContracts.cdpManager.address)
  await coreContracts.activePool.setStabilityPoolAddress( coreContracts.stabilityPool.address)
  await coreContracts.activePool.setDefaultPoolAddress(coreContracts.defaultPool.address)

  await coreContracts.defaultPool.setPoolManagerAddress(coreContracts.poolManager.address)
  await coreContracts.defaultPool.setStabilityPoolAddress( coreContracts.stabilityPool.address)
  await coreContracts.defaultPool.setActivePoolAddress(coreContracts.activePool.address)

  // set contracts in HintHelpers
  await coreContracts.hintHelpers.setPriceFeed(coreContracts.clvToken.address)
  await coreContracts.hintHelpers.setCDPManager(coreContracts.cdpManager.address)
  await coreContracts.hintHelpers.setSortedCDPs(coreContracts.sortedCDPs.address)
}

const connectGTContractsToCore = async (GTContracts, coreContracts) => {
  // Set CDPM and BorrowerOps in GTStaking
  await GTContracts.gtStaking.setCLVTokenAddress(coreContracts.clvToken.address)
  await GTContracts.gtStaking.setCDPManagerAddress(coreContracts.cdpManager.address)
  await GTContracts.gtStaking.setBorrowerOperationsAddress(coreContracts.borrowerOperations.address)

  // Set GTStaking in BorrowerOps and CDPM
  await coreContracts.borrowerOperations.setGTStaking(GTContracts.gtStaking.address)
  await coreContracts.cdpManager.setGTStaking(GTContracts.gtStaking.address)
}

module.exports = {
  deployLiquityCoreBuidler: deployLiquityCoreBuidler,
  deployLiquityCoreTruffle: deployLiquityCoreTruffle,
  deployGTContractsBuidler: deployGTContractsBuidler,
  deployGTContractsTruffle: deployGTContractsTruffle,
  deployCoreLiquity: deployLiquityCore,
  connectCoreContracts: connectCoreContracts,
  connectGTContractsToCore: connectGTContractsToCore
}

