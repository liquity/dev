
const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const CollSurplusPool = artifacts.require("./CollSurplusPool.sol")
const FunctionCaller = artifacts.require("./TestContracts/FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")
const HintHelpers = artifacts.require("./HintHelpers.sol")

const LQTYStaking = artifacts.require("./LQTYStaking.sol")
const GrowthToken = artifacts.require("./GrowthToken.sol")
const LockupContractFactory = artifacts.require("./LockupContractFactory.sol")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")
const GrowthTokenTester = artifacts.require("./GrowthTokenTester.sol")
const CommunityIssuanceTester = artifacts.require("./CommunityIssuanceTester.sol")

const StabilityPoolTester = artifacts.require("./StabilityPoolTester.sol")
const ActivePoolTester = artifacts.require("./ActivePoolTester.sol")
const DefaultPoolTester = artifacts.require("./DefaultPoolTester.sol")
const LiquityMathTester = artifacts.require("./LiquityMathTester.sol")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const CDPManagerTester = artifacts.require("./CDPManagerTester.sol")
const CLVTokenTester = artifacts.require("./CLVTokenTester.sol")

/* "Liquity core" consists of all contracts in the core Liquity system.

LQTY contracts consist of only those contracts related to the LQTY Token:

-the LQTY token
-the Lockup factory and lockup contracts
-the LQTYStaking contract
-the CommunityIssuance contract 
*/

const ZERO_ADDRESS = '0x' + '0'.repeat(40)
const maxBytes32 = '0x' + 'f'.repeat(64)

class DeploymentHelper {

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

  static async deployLQTYContracts() {
    const cmdLineArgs = process.argv
    const frameworkPath = cmdLineArgs[1]
    // console.log(`Framework used:  ${frameworkPath}`)

    if (frameworkPath.includes("buidler")) {
      return this.deployLQTYContractsBuidler()
    } else if (frameworkPath.includes("truffle")) {
      return this.deployLQTYContractsTruffle()
    }
  }

  static async deployLiquityCoreBuidler() {
    const priceFeed = await PriceFeed.new()
    const sortedCDPs = await SortedCDPs.new()
    const cdpManager = await CDPManager.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await StabilityPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await BorrowerOperations.new()
    const hintHelpers = await HintHelpers.new()
    const clvToken = await CLVToken.new(
      cdpManager.address,
      stabilityPool.address,
      borrowerOperations.address
    )
    CLVToken.setAsDeployed(clvToken)
    DefaultPool.setAsDeployed(defaultPool)
    PriceFeed.setAsDeployed(priceFeed)
    SortedCDPs.setAsDeployed(sortedCDPs)
    CDPManager.setAsDeployed(cdpManager)
    ActivePool.setAsDeployed(activePool)
    StabilityPool.setAsDeployed(stabilityPool)
    CollSurplusPool.setAsDeployed(collSurplusPool)
    FunctionCaller.setAsDeployed(functionCaller)
    BorrowerOperations.setAsDeployed(borrowerOperations)
    HintHelpers.setAsDeployed(hintHelpers)

    const coreContracts = {
      priceFeed,
      clvToken,
      sortedCDPs,
      cdpManager,
      activePool,
      stabilityPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers
    }
    return coreContracts
  }

  static async deployTesterContractsBuidler() {
    const testerContracts = {}

    // Contract without testers (yet)
    testerContracts.priceFeed = await PriceFeed.new()
    testerContracts.sortedCDPs = await SortedCDPs.new()

    // Actual tester contracts
    testerContracts.communityIssuance = await CommunityIssuanceTester.new()
    testerContracts.stabilityPool = await StabilityPoolTester.new()
    testerContracts.activePool = await ActivePoolTester.new()
    testerContracts.defaultPool = await DefaultPoolTester.new()
    testerContracts.stabilityPool = await StabilityPoolTester.new()
    testerContracts.collSurplusPool = await CollSurplusPool.new()
    testerContracts.math = await LiquityMathTester.new()
    testerContracts.borrowerOperations = await BorrowerOperationsTester.new()
    testerContracts.cdpManager = await CDPManagerTester.new()
    testerContracts.functionCaller = await FunctionCaller.new()
    testerContracts.hintHelpers = await HintHelpers.new()
    testerContracts.clvToken =  await CLVTokenTester.new(
      testerContracts.cdpManager.address,
      testerContracts.stabilityPool.address,
      testerContracts.borrowerOperations.address
    )
    return testerContracts
  }

  static async deployLQTYContractsBuidler() {
    const lqtyStaking = await LQTYStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuance.new()

    LQTYStaking.setAsDeployed(lqtyStaking)
    LockupContractFactory.setAsDeployed(lockupContractFactory)
    CommunityIssuance.setAsDeployed(communityIssuance)

    // Deploy Growth Token, passing Community Issuance and Factory addresses to the constructor 
    const growthToken = await GrowthToken.new(
      communityIssuance.address, 
      lqtyStaking.address,
      lockupContractFactory.address
    )
    GrowthToken.setAsDeployed(growthToken)

    const LQTYContracts = {
      lqtyStaking,
      lockupContractFactory,
      communityIssuance,
      growthToken
    }
    return LQTYContracts
  }

  static async deployLQTYTesterContractsBuidler() {
    const lqtyStaking = await LQTYStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuanceTester.new()

    LQTYStaking.setAsDeployed(lqtyStaking)
    LockupContractFactory.setAsDeployed(lockupContractFactory)
    CommunityIssuanceTester.setAsDeployed(communityIssuance)

    // Deploy Growth Token, passing Community Issuance and Factory addresses to the constructor 
    const growthToken = await GrowthTokenTester.new(
      communityIssuance.address, 
      lqtyStaking.address,
      lockupContractFactory.address
    )
    GrowthTokenTester.setAsDeployed(growthToken)

    const LQTYContracts = {
      lqtyStaking,
      lockupContractFactory,
      communityIssuance,
      growthToken
    }
    return LQTYContracts
  }

  static async deployLiquityCoreTruffle() {
    const priceFeed = await PriceFeed.new()
    const sortedCDPs = await SortedCDPs.new()
    const cdpManager = await CDPManager.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await StabilityPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await BorrowerOperations.new()
    const hintHelpers = await HintHelpers.new()
    const clvToken = await CLVToken.new(
      cdpManager.address,
      stabilityPool.address,
      borrowerOperations.address
    )
    const coreContracts = {
      priceFeed,
      clvToken,
      sortedCDPs,
      cdpManager,
      activePool,
      stabilityPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers
    }
    return coreContracts
  }

  static async deployLQTYContractsTruffle() {
    const lqtyStaking = await lqtyStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuance.new()

    /* Deploy Growth Token, passing Community Issuance,  LQTYStaking, and Factory addresses 
    to the constructor  */
    const growthToken = await GrowthToken.new(
      communityIssuance.address, 
      lqtyStaking.address,
      lockupContractFactory.address
    )

    const LQTYContracts = {
      lqtyStaking,
      lockupContractFactory,
      communityIssuance,
      growthToken
    }
    return LQTYContracts
  }

  static async deployCLVToken(contracts) {
    contracts.clvToken = await CLVToken.new(
      contracts.cdpManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    return contracts
  }

  // Connect contracts to their dependencies
  static async connectCoreContracts(contracts, LQTYContracts) {

    // set CDPManager addr in SortedCDPs
    await contracts.sortedCDPs.setParams(
      maxBytes32,
      contracts.cdpManager.address,
      contracts.borrowerOperations.address
    )

    // set contract addresses in the FunctionCaller 
    await contracts.functionCaller.setCDPManagerAddress(contracts.cdpManager.address)
    await contracts.functionCaller.setSortedCDPsAddress(contracts.sortedCDPs.address)

    // set contract addresses in PriceFeed
    await contracts.priceFeed.setAddresses(
      contracts.cdpManager.address,
      ZERO_ADDRESS,
      ZERO_ADDRESS
    )

    // set contracts in the CDP Manager
    await contracts.cdpManager.setAddresses(
      contracts.borrowerOperations.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeed.address,
      contracts.clvToken.address,
      contracts.sortedCDPs.address,
      LQTYContracts.lqtyStaking.address
    )

    // set contracts in BorrowerOperations 
    await contracts.borrowerOperations.setAddresses(
      contracts.cdpManager.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeed.address,
      contracts.sortedCDPs.address,
      contracts.clvToken.address,
      LQTYContracts.lqtyStaking.address
    )

    // set contracts in the Pools
    await contracts.stabilityPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.cdpManager.address,
      contracts.activePool.address,
      contracts.clvToken.address,
      contracts.sortedCDPs.address,
      contracts.priceFeed.address,
      LQTYContracts.communityIssuance.address
    )

    await contracts.activePool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.cdpManager.address,
      contracts.stabilityPool.address,
      contracts.defaultPool.address
    )

    await contracts.defaultPool.setAddresses(
      contracts.cdpManager.address,
      contracts.activePool.address,
    )

    await contracts.collSurplusPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.cdpManager.address,
      contracts.activePool.address,
    )

    // set contracts in HintHelpers
    await contracts.hintHelpers.setAddresses(
      contracts.sortedCDPs.address,
      contracts.cdpManager.address
    )
  }

  static async connectLQTYContracts(LQTYContracts) {
    // Set GrowthToken address in LCF
    await LQTYContracts.lockupContractFactory.setGrowthTokenAddress(LQTYContracts.growthToken.address)
  }

  static async connectLQTYContractsToCore(LQTYContracts, coreContracts) {
    await LQTYContracts.lqtyStaking.setAddresses(
      LQTYContracts.growthToken.address,
      coreContracts.clvToken.address,
      coreContracts.cdpManager.address, 
      coreContracts.borrowerOperations.address,
      coreContracts.activePool.address
    )
   
    await LQTYContracts.communityIssuance.setAddresses(
      LQTYContracts.growthToken.address,
      coreContracts.stabilityPool.address
    )
  }
}
module.exports = DeploymentHelper
