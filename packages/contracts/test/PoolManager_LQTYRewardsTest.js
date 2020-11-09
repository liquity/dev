const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const CDPManagerTester = artifacts.require("./CDPManagerTester.sol")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN

contract('PoolManager - LQTY Rewards', async accounts => {

  const [owner,
    defaulter_1,
    defaulter_2,
    defaulter_3,
    defaulter_4,
    defaulter_5,
    defaulter_6,
    whale,
    whale_2,
    alice,
    bob,
    carol,
    dennis,
    erin,
    flyn,
    graham,
    harriet
  ] = accounts;

  let contracts

  let priceFeed
  let clvToken
  let poolManager
  let cdpManager
  let borrowerOperations

  let gasPriceInWei

  const ZERO_ADDRESS = th.ZERO_ADDRESS

  describe("LQTY Rewards", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
    })

    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      const GTContracts = await deploymentHelper.deployGTContracts()
      contracts.cdpManager = await CDPManagerTester.new()

      priceFeed = contracts.priceFeed
      clvToken = contracts.clvToken
      poolManager = contracts.poolManager
      sortedCDPs = contracts.sortedCDPs
      cdpManager = contracts.cdpManager
      activePool = contracts.activePool
      stabilityPool = contracts.stabilityPool
      defaultPool = contracts.defaultPool
      borrowerOperations = contracts.borrowerOperations
      hintHelpers = contracts.hintHelpers

      lqtyStaking = GTContracts.lqtyStaking
      growthToken = GTContracts.growthToken
      communityIssuance = GTContracts.communityIssuance
      lockupContractFactory = GTContracts.lockupContractFactory

      await deploymentHelper.connectGTContracts(GTContracts)
      await deploymentHelper.connectCoreContracts(contracts, GTContracts)
      await deploymentHelper.connectGTContractsToCore(GTContracts, contracts)
    })


  })
})

contract('Reset chain state', async accounts => { })
