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
const CommunityIssuanceTester = artifacts.require("./GT/CommunityIssuanceTester.sol")

/* "Liquity core" consists of all contracts in the core Liquity system.

GT contracts consist of only those contracts related to the Growth Token:the token itself, 
and lockup, staking and community issuance coreContracts. */

class DeploymentHelper {
  static ZERO_ADDRESS = '0x' + '0'.repeat(40)

  static async deployLiquityCore() {
    const cmdLineArgs = process.argv
    const frameworkPath = cmdLineArgs[1]
    // console.log(`Framework used:  ${frameworkPath}`)

    if (frameworkPath.includes("buidler")) {
      return this.deployLiquityCoreBuidler()
    } else if (frameworkPath.includes("truffle")) {
      return this.deployLiquityCoreTruffle()
    }
  }

  static async deployGTContracts(communityIssuance = undefined) {
    const cmdLineArgs = process.argv
    const frameworkPath = cmdLineArgs[1]
    // console.log(`Framework used:  ${frameworkPath}`)

    if (frameworkPath.includes("buidler")) {
      return this.deployGTContractsBuidler()
    } else if (frameworkPath.includes("truffle")) {
      return this.deployGTContractsTruffle()
    }
  }

  static async deployLiquityCoreBuidler() {
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

  static async deployGTContractsBuidler() {
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

  static async deployGTTesterContractsBuidler() {
    const gtStaking = await GTStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuanceTester.new()

    GTStaking.setAsDeployed(gtStaking)
    LockupContractFactory.setAsDeployed(lockupContractFactory)
    CommunityIssuanceTester.setAsDeployed(communityIssuance)

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

  static async deployLiquityCoreTruffle() {
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

  static async deployGTContractsTruffle() {
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

  // Connect contracts to their dependencies
  static async connectCoreContracts(contracts, GTContracts) {

    // set PoolManager address in the CLVToken contract
    await contracts.clvToken.setAddresses(
      contracts.poolManager.address,
      contracts.borrowerOperations.address
    )

    // set contracts in the PoolManager
    await contracts.poolManager.setAddresses(
      contracts.borrowerOperations.address,
      contracts.cdpManager.address,
      contracts.priceFeed.address,
      contracts.clvToken.address,
      contracts.stabilityPool.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      GTContracts.communityIssuance.address
    )

    // set CDPManager addr in SortedCDPs
    await contracts.sortedCDPs.setParams(
      1e6,
      contracts.cdpManager.address,
      contracts.borrowerOperations.address
    )

    // set contract addresses in the FunctionCaller 
    await contracts.functionCaller.setCDPManagerAddress(contracts.cdpManager.address)
    await contracts.functionCaller.setSortedCDPsAddress(contracts.sortedCDPs.address)

    // set contract addresses in PriceFeed
    await contracts.priceFeed.setAddresses(
      contracts.cdpManager.address,
      contracts.poolManager.address,
      this.ZERO_ADDRESS,
      this.ZERO_ADDRESS
    )

    // set contracts in the CDP Manager
    await contracts.cdpManager.setAddresses(
      contracts.borrowerOperations.address,
      contracts.poolManager.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.priceFeed.address,
      contracts.clvToken.address,
      contracts.sortedCDPs.address,
      GTContracts.gtStaking.address
    )

    // set contracts in BorrowerOperations 
    await contracts.borrowerOperations.setAddresses(
      contracts.cdpManager.address,
      contracts.poolManager.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.priceFeed.address,
      contracts.sortedCDPs.address,
      contracts.clvToken.address,
      GTContracts.gtStaking.address
    )

    // set contracts in the Pools
    await contracts.stabilityPool.setAddresses(
      contracts.poolManager.address,
      contracts.activePool.address,
      contracts.defaultPool.address
    )

    await contracts.activePool.setAddresses(
      contracts.poolManager.address,
      contracts.cdpManager.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address
    )

    await contracts.defaultPool.setAddresses(
      contracts.poolManager.address,
      contracts.activePool.address,
      contracts.stabilityPool.address
    )

    // set contracts in HintHelpers
    await contracts.hintHelpers.setAddresses(
      contracts.priceFeed.address,
      contracts.sortedCDPs.address,
      contracts.cdpManager.address
    )
  }

  static async connectGTContracts(GTContracts) {
    // Set GrowthToken address in LCF, GTStaking, and CI
    await GTContracts.gtStaking.setGrowthTokenAddress(GTContracts.growthToken.address)
    await GTContracts.lockupContractFactory.setGrowthTokenAddress(GTContracts.growthToken.address)
    await GTContracts.communityIssuance.setGrowthTokenAddress(GTContracts.growthToken.address)
}

static async connectGTContractsToCore(GTContracts, coreContracts) {
  // Set CDPM and BorrowerOps in GTStaking
  await GTContracts.gtStaking.setCLVTokenAddress(coreContracts.clvToken.address)
  await GTContracts.gtStaking.setCDPManagerAddress(coreContracts.cdpManager.address)
  await GTContracts.gtStaking.setBorrowerOperationsAddress(coreContracts.borrowerOperations.address)
  await GTContracts.communityIssuance.setPoolManagerAddress(coreContracts.poolManager.address)
  await GTContracts.communityIssuance.activateContract();
}

}

module.exports = DeploymentHelper


