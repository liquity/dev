const SortedTroves = artifacts.require("./SortedTroves.sol")
const TroveManager = artifacts.require("./TroveManager.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const XBRLToken = artifacts.require("./XBRLToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const GasPool = artifacts.require("./GasPool.sol")
const CollSurplusPool = artifacts.require("./CollSurplusPool.sol")
const FunctionCaller = artifacts.require("./TestContracts/FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")
const HintHelpers = artifacts.require("./HintHelpers.sol")

const STBLStaking = artifacts.require("./STBLStaking.sol")
const STBLToken = artifacts.require("./STBLToken.sol")
const LockupContractFactory = artifacts.require("./LockupContractFactory.sol")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")

const XBRLWETHUnipool =  artifacts.require("./XBRLWETHUnipool.sol")
const STBLWETHUnipool =  artifacts.require("./STBLWETHUnipool.sol")

const STBLTokenTester = artifacts.require("./STBLTokenTester.sol")
const CommunityIssuanceTester = artifacts.require("./CommunityIssuanceTester.sol")
const StabilityPoolTester = artifacts.require("./StabilityPoolTester.sol")
const ActivePoolTester = artifacts.require("./ActivePoolTester.sol")
const DefaultPoolTester = artifacts.require("./DefaultPoolTester.sol")
const StabilioMathTester = artifacts.require("./StabilioMathTester.sol")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const XBRLTokenTester = artifacts.require("./XBRLTokenTester.sol")

// Proxy scripts
const BorrowerOperationsScript = artifacts.require('BorrowerOperationsScript')
const BorrowerWrappersScript = artifacts.require('BorrowerWrappersScript')
const TroveManagerScript = artifacts.require('TroveManagerScript')
const StabilityPoolScript = artifacts.require('StabilityPoolScript')
const TokenScript = artifacts.require('TokenScript')
const STBLStakingScript = artifacts.require('STBLStakingScript')
const {
  buildUserProxies,
  BorrowerOperationsProxy,
  BorrowerWrappersProxy,
  TroveManagerProxy,
  StabilityPoolProxy,
  SortedTrovesProxy,
  TokenProxy,
  STBLStakingProxy
} = require('../utils/proxyHelpers.js')

/* "Stabilio core" consists of all contracts in the core Stabilio system.

STBL contracts consist of only those contracts related to the STBL Token:

-the STBL token
-the Lockup factory and lockup contracts
-the STBLStaking contract
-the CommunityIssuance contract 
*/

const ZERO_ADDRESS = '0x' + '0'.repeat(40)
const maxBytes32 = '0x' + 'f'.repeat(64)

class DeploymentHelper {

  static async deployStabilioCore() {
    const cmdLineArgs = process.argv
    const frameworkPath = cmdLineArgs[1]
    // console.log(`Framework used:  ${frameworkPath}`)

    if (frameworkPath.includes("hardhat")) {
      return this.deployStabilioCoreHardhat()
    } else if (frameworkPath.includes("truffle")) {
      return this.deployStabilioCoreTruffle()
    }
  }

  static async deploySTBLContracts(bountyAddress, xbrlWethLpRewardsAddress, stblWethLpRewardsAddress, momentZeroMultisig, sixMonthsMultisig, oneYearMultisig) {
    const cmdLineArgs = process.argv
    const frameworkPath = cmdLineArgs[1]
    // console.log(`Framework used:  ${frameworkPath}`)

    if (frameworkPath.includes("hardhat")) {
      return this.deploySTBLContractsHardhat(bountyAddress, xbrlWethLpRewardsAddress, stblWethLpRewardsAddress, momentZeroMultisig, sixMonthsMultisig, oneYearMultisig)
    } else if (frameworkPath.includes("truffle")) {
      return this.deploySTBLContractsTruffle(bountyAddress, xbrlWethLpRewardsAddress, stblWethLpRewardsAddress, momentZeroMultisig, sixMonthsMultisig, oneYearMultisig)
    }
  }

  static async deployStabilioCoreHardhat() {
    const priceFeedTestnet = await PriceFeedTestnet.new()
    const sortedTroves = await SortedTroves.new()
    const troveManager = await TroveManager.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await StabilityPool.new()
    const gasPool = await GasPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await BorrowerOperations.new()
    const hintHelpers = await HintHelpers.new()
    const xbrlToken = await XBRLToken.new(
      troveManager.address,
      stabilityPool.address,
      borrowerOperations.address
    )
    XBRLToken.setAsDeployed(xbrlToken)
    DefaultPool.setAsDeployed(defaultPool)
    PriceFeedTestnet.setAsDeployed(priceFeedTestnet)
    SortedTroves.setAsDeployed(sortedTroves)
    TroveManager.setAsDeployed(troveManager)
    ActivePool.setAsDeployed(activePool)
    StabilityPool.setAsDeployed(stabilityPool)
    GasPool.setAsDeployed(gasPool)
    CollSurplusPool.setAsDeployed(collSurplusPool)
    FunctionCaller.setAsDeployed(functionCaller)
    BorrowerOperations.setAsDeployed(borrowerOperations)
    HintHelpers.setAsDeployed(hintHelpers)

    const coreContracts = {
      priceFeedTestnet,
      xbrlToken,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers
    }
    return coreContracts
  }

  static async deployTesterContractsHardhat() {
    const testerContracts = {}

    // Contract without testers (yet)
    testerContracts.priceFeedTestnet = await PriceFeedTestnet.new()
    testerContracts.sortedTroves = await SortedTroves.new()
    // Actual tester contracts
    testerContracts.communityIssuance = await CommunityIssuanceTester.new()
    testerContracts.activePool = await ActivePoolTester.new()
    testerContracts.defaultPool = await DefaultPoolTester.new()
    testerContracts.stabilityPool = await StabilityPoolTester.new()
    testerContracts.gasPool = await GasPool.new()
    testerContracts.collSurplusPool = await CollSurplusPool.new()
    testerContracts.math = await StabilioMathTester.new()
    testerContracts.borrowerOperations = await BorrowerOperationsTester.new()
    testerContracts.troveManager = await TroveManagerTester.new()
    testerContracts.functionCaller = await FunctionCaller.new()
    testerContracts.hintHelpers = await HintHelpers.new()
    testerContracts.xbrlToken =  await XBRLTokenTester.new(
      testerContracts.troveManager.address,
      testerContracts.stabilityPool.address,
      testerContracts.borrowerOperations.address
    )
    return testerContracts
  }

  static async deploySTBLContractsHardhat(bountyAddress, xbrlWethLpRewardsAddress, stblWethLpRewardsAddress, momentZeroMultisig, sixMonthsMultisig, oneYearMultisig) {
    const stblStaking = await STBLStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuance.new()

    STBLStaking.setAsDeployed(stblStaking)
    LockupContractFactory.setAsDeployed(lockupContractFactory)
    CommunityIssuance.setAsDeployed(communityIssuance)

    // Deploy STBL Token, passing Community Issuance and Factory addresses to the constructor 
    const stblToken = await STBLToken.new(
      communityIssuance.address, 
      stblStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      xbrlWethLpRewardsAddress,
      stblWethLpRewardsAddress,
      momentZeroMultisig,
      sixMonthsMultisig,
      oneYearMultisig
    )
    STBLToken.setAsDeployed(stblToken)

    const STBLContracts = {
      stblStaking,
      lockupContractFactory,
      communityIssuance,
      stblToken
    }
    return STBLContracts
  }

  static async deploySTBLTesterContractsHardhat(bountyAddress, xbrlWethLpRewardsAddress, stblWethLpRewardsAddress, momentZeroMultisig, sixMonthsMultisig, oneYearMultisig) {
    const stblStaking = await STBLStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuanceTester.new()

    STBLStaking.setAsDeployed(stblStaking)
    LockupContractFactory.setAsDeployed(lockupContractFactory)
    CommunityIssuanceTester.setAsDeployed(communityIssuance)

    // Deploy STBL Token, passing Community Issuance and Factory addresses to the constructor 
    const stblToken = await STBLTokenTester.new(
      communityIssuance.address, 
      stblStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      xbrlWethLpRewardsAddress,
      stblWethLpRewardsAddress,
      momentZeroMultisig, 
      sixMonthsMultisig, 
      oneYearMultisig
    )
    STBLTokenTester.setAsDeployed(stblToken)

    const STBLContracts = {
      stblStaking,
      lockupContractFactory,
      communityIssuance,
      stblToken
    }
    return STBLContracts
  }

  static async deployStabilioCoreTruffle() {
    const priceFeedTestnet = await PriceFeedTestnet.new()
    const sortedTroves = await SortedTroves.new()
    const troveManager = await TroveManager.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await StabilityPool.new()
    const gasPool = await GasPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await BorrowerOperations.new()
    const hintHelpers = await HintHelpers.new()
    const xbrlToken = await XBRLToken.new(
      troveManager.address,
      stabilityPool.address,
      borrowerOperations.address
    )
    const coreContracts = {
      priceFeedTestnet,
      xbrlToken,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers
    }
    return coreContracts
  }

  static async deploySTBLContractsTruffle(bountyAddress, xbrlWethLpRewardsAddress, stblWethLpRewardsAddress, momentZeroMultisig, sixMonthsMultisig, oneYearMultisig) {
    const stblStaking = await stblStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuance.new()

    /* Deploy STBL Token, passing Community Issuance,  STBLStaking, and Factory addresses 
    to the constructor  */
    const stblToken = await STBLToken.new(
      communityIssuance.address, 
      stblStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      xbrlWethLpRewardsAddress, 
      stblWethLpRewardsAddress,
      momentZeroMultisig, 
      sixMonthsMultisig, 
      oneYearMultisig
    )

    const STBLContracts = {
      stblStaking,
      lockupContractFactory,
      communityIssuance,
      stblToken
    }
    return STBLContracts
  }

  static async deployXBRLToken(contracts) {
    contracts.xbrlToken = await XBRLToken.new(
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    return contracts
  }

  static async deployXBRLTokenTester(contracts) {
    contracts.xbrlToken = await XBRLTokenTester.new(
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    return contracts
  }

  static async deployProxyScripts(contracts, STBLContracts, owner, users) {
    const proxies = await buildUserProxies(users)

    const borrowerWrappersScript = await BorrowerWrappersScript.new(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      STBLContracts.stblStaking.address
    )
    contracts.borrowerWrappers = new BorrowerWrappersProxy(owner, proxies, borrowerWrappersScript.address)

    const borrowerOperationsScript = await BorrowerOperationsScript.new(contracts.borrowerOperations.address)
    contracts.borrowerOperations = new BorrowerOperationsProxy(owner, proxies, borrowerOperationsScript.address, contracts.borrowerOperations)

    const troveManagerScript = await TroveManagerScript.new(contracts.troveManager.address)
    contracts.troveManager = new TroveManagerProxy(owner, proxies, troveManagerScript.address, contracts.troveManager)

    const stabilityPoolScript = await StabilityPoolScript.new(contracts.stabilityPool.address)
    contracts.stabilityPool = new StabilityPoolProxy(owner, proxies, stabilityPoolScript.address, contracts.stabilityPool)

    contracts.sortedTroves = new SortedTrovesProxy(owner, proxies, contracts.sortedTroves)

    const xbrlTokenScript = await TokenScript.new(contracts.xbrlToken.address)
    contracts.xbrlToken = new TokenProxy(owner, proxies, xbrlTokenScript.address, contracts.xbrlToken)

    const stblTokenScript = await TokenScript.new(STBLContracts.stblToken.address)
    STBLContracts.stblToken = new TokenProxy(owner, proxies, stblTokenScript.address, STBLContracts.stblToken)

    const stblStakingScript = await STBLStakingScript.new(STBLContracts.stblStaking.address)
    STBLContracts.stblStaking = new STBLStakingProxy(owner, proxies, stblStakingScript.address, STBLContracts.stblStaking)
  }

  // Connect contracts to their dependencies
  static async connectCoreContracts(contracts, STBLContracts) {

    // set TroveManager addr in SortedTroves
    await contracts.sortedTroves.setParams(
      maxBytes32,
      contracts.troveManager.address,
      contracts.borrowerOperations.address
    )

    // set contract addresses in the FunctionCaller 
    await contracts.functionCaller.setTroveManagerAddress(contracts.troveManager.address)
    await contracts.functionCaller.setSortedTrovesAddress(contracts.sortedTroves.address)

    // set contracts in the Trove Manager
    await contracts.troveManager.setAddresses(
      contracts.borrowerOperations.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeedTestnet.address,
      contracts.xbrlToken.address,
      contracts.sortedTroves.address,
      STBLContracts.stblToken.address,
      STBLContracts.stblStaking.address
    )

    // set contracts in BorrowerOperations 
    await contracts.borrowerOperations.setAddresses(
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeedTestnet.address,
      contracts.sortedTroves.address,
      contracts.xbrlToken.address,
      STBLContracts.stblStaking.address
    )

    // set contracts in the Pools
    await contracts.stabilityPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.xbrlToken.address,
      contracts.sortedTroves.address,
      contracts.priceFeedTestnet.address,
      STBLContracts.communityIssuance.address
    )

    await contracts.activePool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.defaultPool.address
    )

    await contracts.defaultPool.setAddresses(
      contracts.troveManager.address,
      contracts.activePool.address,
    )

    await contracts.collSurplusPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
    )

    // set contracts in HintHelpers
    await contracts.hintHelpers.setAddresses(
      contracts.sortedTroves.address,
      contracts.troveManager.address
    )
  }

  static async connectSTBLContracts(STBLContracts) {
    // Set STBLToken address in LCF
    await STBLContracts.lockupContractFactory.setSTBLTokenAddress(STBLContracts.stblToken.address)
  }

  static async connectSTBLContractsToCore(STBLContracts, coreContracts) {
    await STBLContracts.stblStaking.setAddresses(
      STBLContracts.stblToken.address,
      coreContracts.xbrlToken.address,
      coreContracts.troveManager.address, 
      coreContracts.borrowerOperations.address,
      coreContracts.activePool.address
    )
  
    await STBLContracts.communityIssuance.setAddresses(
      STBLContracts.stblToken.address,
      coreContracts.stabilityPool.address
    )
  }

  static async connectUnipool(uniPool, STBLContracts, uniswapPairAddr, duration) {
    await uniPool.setParams(STBLContracts.stblToken.address, uniswapPairAddr, duration)
  }
}
module.exports = DeploymentHelper
