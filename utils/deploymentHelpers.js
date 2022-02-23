const SortedTroves = artifacts.require("./SortedTroves.sol")
const TroveManager = artifacts.require("./TroveManager.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const VSTToken = artifacts.require("./VSTToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const StabilityPoolManager = artifacts.require("./StabilityPoolManager.sol")
const AdminContract = artifacts.require("./AdminContract.sol")
const GasPool = artifacts.require("./GasPool.sol")
const CollSurplusPool = artifacts.require("./CollSurplusPool.sol")
const FunctionCaller = artifacts.require("./TestContracts/FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")
const HintHelpers = artifacts.require("./HintHelpers.sol")
const VestaParameters = artifacts.require("./VestaParameters.sol")
const LockedVSTA = artifacts.require("./LockedVSTA.sol")

const VSTAStaking = artifacts.require("./VSTAStaking.sol")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")

const VSTATokenTester = artifacts.require("./VSTATokenTester.sol")
const CommunityIssuanceTester = artifacts.require("./CommunityIssuanceTester.sol")
const StabilityPoolTester = artifacts.require("./StabilityPoolTester.sol")
const ActivePoolTester = artifacts.require("./ActivePoolTester.sol")
const DefaultPoolTester = artifacts.require("./DefaultPoolTester.sol")
const VestaMathTester = artifacts.require("./VestaMathTester.sol")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const VSTTokenTester = artifacts.require("./VSTTokenTester.sol")
const ERC20Test = artifacts.require("./ERC20Test.sol")

// Proxy scripts
const BorrowerOperationsScript = artifacts.require('BorrowerOperationsScript')
const BorrowerWrappersScript = artifacts.require('BorrowerWrappersScript')
const TroveManagerScript = artifacts.require('TroveManagerScript')
const StabilityPoolScript = artifacts.require('StabilityPoolScript')
const TokenScript = artifacts.require('TokenScript')
const VSTAStakingScript = artifacts.require('VSTAStakingScript')
const { messagePrefix } = require('@ethersproject/hash');
const {
  buildUserProxies,
  BorrowerOperationsProxy,
  BorrowerWrappersProxy,
  TroveManagerProxy,
  StabilityPoolProxy,
  SortedTrovesProxy,
  TokenProxy,
  VSTAStakingProxy
} = require('../utils/proxyHelpers.js')

/* "Liquity core" consists of all contracts in the core Liquity system.

VSTA contracts consist of only those contracts related to the VSTA Token:

-the VSTA token
-the Lockup factory and lockup contracts
-the VSTAStaking contract
-the CommunityIssuance contract 
*/

const testHelpers = require("./testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec

const ZERO_ADDRESS = '0x' + '0'.repeat(40)
const maxBytes32 = '0x' + 'f'.repeat(64)

class DeploymentHelper {

  static async deployLiquityCore() {
    return this.deployLiquityCoreHardhat()
  }

  static async deployLiquityCoreHardhat() {
    const priceFeedTestnet = await PriceFeedTestnet.new()
    const sortedTroves = await SortedTroves.new()
    const troveManager = await TroveManager.new()
    const activePool = await ActivePool.new()
    const stabilityPoolTemplate = await StabilityPool.new()
    const stabilityPoolTemplateV2 = await StabilityPool.new()
    const stabilityPoolManager = await StabilityPoolManager.new()
    const vestaParameters = await VestaParameters.new()
    const gasPool = await GasPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await BorrowerOperations.new()
    const hintHelpers = await HintHelpers.new()
    const vstToken = await VSTToken.new(
      troveManager.address,
      stabilityPoolManager.address,
      borrowerOperations.address,
    )
    const erc20 = await ERC20Test.new()
    const adminContract = await AdminContract.new();


    VSTToken.setAsDeployed(vstToken)
    DefaultPool.setAsDeployed(defaultPool)
    PriceFeedTestnet.setAsDeployed(priceFeedTestnet)
    SortedTroves.setAsDeployed(sortedTroves)
    TroveManager.setAsDeployed(troveManager)
    ActivePool.setAsDeployed(activePool)
    StabilityPool.setAsDeployed(stabilityPoolTemplate)
    StabilityPool.setAsDeployed(stabilityPoolTemplateV2)
    GasPool.setAsDeployed(gasPool)
    CollSurplusPool.setAsDeployed(collSurplusPool)
    FunctionCaller.setAsDeployed(functionCaller)
    BorrowerOperations.setAsDeployed(borrowerOperations)
    HintHelpers.setAsDeployed(hintHelpers)
    VestaParameters.setAsDeployed(vestaParameters);
    ERC20Test.setAsDeployed(erc20);
    AdminContract.setAsDeployed(adminContract);

    await erc20.setDecimals(8);

    const coreContracts = {
      priceFeedTestnet,
      vstToken,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPoolTemplate,
      stabilityPoolTemplateV2,
      stabilityPoolManager,
      vestaParameters,
      gasPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers,
      erc20,
      adminContract
    }
    return coreContracts
  }

  static async deployTesterContractsHardhat() {
    const testerContracts = {}

    // Contract without testers (yet)
    testerContracts.erc20 = await ERC20Test.new();
    testerContracts.priceFeedTestnet = await PriceFeedTestnet.new()
    testerContracts.sortedTroves = await SortedTroves.new()
    // Actual tester contracts
    testerContracts.communityIssuance = await CommunityIssuanceTester.new()
    testerContracts.activePool = await ActivePoolTester.new()
    testerContracts.defaultPool = await DefaultPoolTester.new()
    testerContracts.stabilityPoolTemplate = await StabilityPoolTester.new()
    testerContracts.stabilityPoolManager = await StabilityPoolManager.new()
    testerContracts.vestaParameters = await VestaParameters.new()
    testerContracts.gasPool = await GasPool.new()
    testerContracts.collSurplusPool = await CollSurplusPool.new()
    testerContracts.math = await VestaMathTester.new()
    testerContracts.borrowerOperations = await BorrowerOperationsTester.new()
    testerContracts.troveManager = await TroveManagerTester.new()
    testerContracts.functionCaller = await FunctionCaller.new()
    testerContracts.hintHelpers = await HintHelpers.new()
    testerContracts.vstToken = await VSTTokenTester.new(
      testerContracts.troveManager.address,
      testerContracts.stabilityPoolManager.address,
      testerContracts.borrowerOperations.address
    )
    testerContracts.adminContract = await AdminContract.new();

    return testerContracts
  }

  static async deployVSTAContractsHardhat(treasury) {
    const vstaStaking = await VSTAStaking.new()
    const communityIssuance = await CommunityIssuanceTester.new()
    const lockedVSTA = await LockedVSTA.new();

    VSTAStaking.setAsDeployed(vstaStaking)
    CommunityIssuanceTester.setAsDeployed(communityIssuance)
    LockedVSTA.setAsDeployed(lockedVSTA)

    // Deploy VSTA Token, passing Community Issuance and Factory addresses to the constructor 
    const vstaToken = await VSTATokenTester.new(treasury)
    VSTATokenTester.setAsDeployed(vstaToken)

    const VSTAContracts = {
      vstaStaking,
      communityIssuance,
      vstaToken,
      lockedVSTA
    }
    return VSTAContracts
  }

  static async deployVSTToken(contracts) {
    contracts.vstToken = await VSTTokenTester.new(
      contracts.troveManager.address,
      contracts.stabilityPoolManager.address,
      contracts.borrowerOperations.address,
    )
    return contracts
  }

  static async deployProxyScripts(contracts, VSTAContracts, owner, users) {
    const proxies = await buildUserProxies(users)

    const borrowerWrappersScript = await BorrowerWrappersScript.new(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      VSTAContracts.vstaStaking.address
    )
    contracts.borrowerWrappers = new BorrowerWrappersProxy(owner, proxies, borrowerWrappersScript.address)

    const borrowerOperationsScript = await BorrowerOperationsScript.new(contracts.borrowerOperations.address)
    contracts.borrowerOperations = new BorrowerOperationsProxy(owner, proxies, borrowerOperationsScript.address, contracts.borrowerOperations)

    const troveManagerScript = await TroveManagerScript.new(contracts.troveManager.address)
    contracts.troveManager = new TroveManagerProxy(owner, proxies, troveManagerScript.address, contracts.troveManager)

    const stabilityPoolScript = await StabilityPoolScript.new(contracts.stabilityPoolTemplate.address)
    contracts.stabilityPool = new StabilityPoolProxy(owner, proxies, stabilityPoolScript.address, contracts.stabilityPool)

    contracts.sortedTroves = new SortedTrovesProxy(owner, proxies, contracts.sortedTroves)

    const vstTokenScript = await TokenScript.new(contracts.vstToken.address)
    contracts.vstToken = new TokenProxy(owner, proxies, vstTokenScript.address, contracts.vstToken)

    const vstaTokenScript = await TokenScript.new(VSTAContracts.vstaToken.address)
    VSTAContracts.vstaToken = new TokenProxy(owner, proxies, vstaTokenScript.address, VSTAContracts.vstaToken)

    const vstaStakingScript = await VSTAStakingScript.new(VSTAContracts.vstaStaking.address)
    VSTAContracts.vstaStaking = new VSTAStakingProxy(owner, proxies, vstaStakingScript.address, VSTAContracts.vstaStaking)
  }

  // Connect contracts to their dependencies
  static async connectCoreContracts(contracts, VSTAContracts) {

    // set TroveManager addr in SortedTroves
    await contracts.sortedTroves.setParams(
      contracts.troveManager.address,
      contracts.borrowerOperations.address
    )

    // set contract addresses in the FunctionCaller 
    await contracts.functionCaller.setTroveManagerAddress(contracts.troveManager.address)
    await contracts.functionCaller.setSortedTrovesAddress(contracts.sortedTroves.address)

    await contracts.vestaParameters.setAddresses(
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.priceFeedTestnet.address,
      contracts.adminContract.address
    )

    // set contracts in the Trove Manager
    await contracts.troveManager.setAddresses(
      contracts.borrowerOperations.address,
      contracts.stabilityPoolManager.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.vstToken.address,
      contracts.sortedTroves.address,
      VSTAContracts.vstaStaking.address,
      contracts.vestaParameters.address
    )

    // set contracts in BorrowerOperations 
    await contracts.borrowerOperations.setAddresses(
      contracts.troveManager.address,
      contracts.stabilityPoolManager.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.sortedTroves.address,
      contracts.vstToken.address,
      VSTAContracts.vstaStaking.address,
      contracts.vestaParameters.address
    )

    await contracts.stabilityPoolManager.setAddresses(contracts.adminContract.address)

    await contracts.adminContract.setAddresses(contracts.vestaParameters.address,
      contracts.stabilityPoolManager.address,
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.vstToken.address,
      contracts.sortedTroves.address,
      VSTAContracts.communityIssuance.address
    )

    await contracts.activePool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.stabilityPoolManager.address,
      contracts.defaultPool.address,
      contracts.collSurplusPool.address
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
      contracts.troveManager.address,
      contracts.vestaParameters.address
    )

  }

  static async connectVSTAContractsToCore(VSTAContracts, coreContracts, skipPool = false, liquitySettings = true) {
    const treasurySig = await VSTAContracts.vstaToken.treasury();

    await VSTAContracts.vstaStaking.setAddresses(
      VSTAContracts.vstaToken.address,
      coreContracts.vstToken.address,
      coreContracts.troveManager.address,
      coreContracts.borrowerOperations.address,
      coreContracts.activePool.address,
      treasurySig
    )

    await VSTAContracts.vstaStaking.unpause();

    await VSTAContracts.communityIssuance.setAddresses(
      VSTAContracts.vstaToken.address,
      coreContracts.stabilityPoolManager.address,
      coreContracts.adminContract.address
    )

    await VSTAContracts.lockedVSTA.setAddresses(
      VSTAContracts.vstaToken.address)

    if (skipPool) {
      return;
    }

    if (await coreContracts.adminContract.owner() != treasurySig)
      await coreContracts.adminContract.transferOwnership(treasurySig);

    await VSTAContracts.vstaToken.approve(VSTAContracts.communityIssuance.address, ethers.constants.MaxUint256, { from: treasurySig });

    const supply = dec(32000000, 18);
    const weeklyReward = dec(32000000 / 4, 18);

    await coreContracts.adminContract.addNewCollateral(ZERO_ADDRESS, coreContracts.stabilityPoolTemplate.address, ZERO_ADDRESS, ZERO_ADDRESS, supply, weeklyReward, 0, { from: treasurySig });
    await VSTAContracts.vstaToken.unprotectedMint(treasurySig, supply)
    await coreContracts.adminContract.addNewCollateral(coreContracts.erc20.address, coreContracts.stabilityPoolTemplate.address, ZERO_ADDRESS, ZERO_ADDRESS, supply, weeklyReward, 0, { from: treasurySig });

    if (!liquitySettings)
      return;

    //Set Liquity Configs (since the tests have been designed with it)
    await coreContracts.vestaParameters.setCollateralParameters(
      ZERO_ADDRESS,
      "1100000000000000000",
      "1500000000000000000",
      dec(200, 18),
      dec(1800, 18),
      200,
      50,
      500,
      50
    );

    await coreContracts.vestaParameters.setCollateralParameters(
      coreContracts.erc20.address,
      "1100000000000000000",
      "1500000000000000000",
      dec(200, 18),
      dec(1800, 18),
      200,
      50,
      500,
      50
    )
  }
}
module.exports = DeploymentHelper
