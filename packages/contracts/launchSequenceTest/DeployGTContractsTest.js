const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper

contract('GT Contracts deployments', async accounts => {
  const [liquityAG] = accounts;

  let GTContracts
  before(async () => {
    // Deploy all contracts from the first account
    GTContracts = await deploymentHelper.deployGTContracts()

    gtStaking = GTContracts.gtStaking
    growthToken = GTContracts.growthToken
    communityIssuance = GTContracts.communityIssuance
    lockupContractFactory = GTContracts.lockupContractFactory
  })

  describe('LockupContractFactory deployment', async accounts => {
    it.only("stores the deployer's address", async () => {
      const storedDeployerAddress = await lockupContractFactory.factoryDeployer()

      assert.equal(liquityAG, storedDeployerAddress)
    })

    it.only("stores the timestamp for the block in which it was deployed", async () => {
      const storedDeploymentTimestamp = await lockupContractFactory.factoryDeploymentTimestamp()

      const deploymentTxReceipt = await web3.eth.getTransaction(lockupContractFactory.transactionHash)
      const deploymentBlockTimestamp = await th.getTimestampFromTxReceipt(deploymentTxReceipt, web3)

      assert.equal(storedDeploymentTimestamp, deploymentBlockTimestamp)
    })
  })

  describe('CommunityIssuance deployment', async accounts => {
    it.only("stores the deployer's address", async () => {
      const storedDeployerAddress = await communityIssuance.communityIssuanceDeployer()

      assert.equal(liquityAG, storedDeployerAddress)
    })
  })

  describe('GTStaking deployment', async accounts => {
    it.only("stores the deployer's address", async () => {
      const storedDeployerAddress = await gtStaking.stakingContractDeployer()

      assert.equal(liquityAG, storedDeployerAddress)
    })
  })

  describe('GrowthToken deployment', async accounts => {
    it.only("stores the deployer's address", async () => {
      const storedDeployerAddress = await growthToken.growthTokenDeployer()

      assert.equal(liquityAG, storedDeployerAddress)
    })

    it.only("stores the CommunityIssuance address", async () => {
      const storedCIAddress = await growthToken.communityIssuanceAddress()

      assert.equal(communityIssuance.address, storedCIAddress)

    })

    it.only("stores the LockupContractFactory address", async () => {
      const storedLCFAddress = await growthToken.lockupFactoryAddress()

      assert.equal(lockupContractFactory.address, storedLCFAddress)
    })

    it.only("mints the correct GT amount to the deployer's address: (2/3 * 100million)", async () => {
      const deployerGTEntitlement = await growthToken.balanceOf(liquityAG)

      // (2/3 * 100million ), as a uint representation of 18-digit decimal
      const _twentySix_Sixes = "6".repeat(26)

      assert.equal(_twentySix_Sixes, deployerGTEntitlement)
    })

    it.only("mints the correct GT amount to the CommunityIssuance contract address: (1/3 * 100million)", async () => {
      const communityGTEntitlement = await growthToken.balanceOf(communityIssuance.address)

      // (1/3 * 100million ), as a uint representation of 18-digit decimal
      const _twentySix_Threes = "3".repeat(26)

      assert.equal(_twentySix_Threes, communityGTEntitlement)
    })
  })

  describe('Connecting GrowthToken to LCF, CI and GTStaking', async accounts => {
    it.only('sets the correct GrowthToken address in GTStaking', async () => { 
      // Set the GrowthToken address in the LCF, CI and GTStaking
      await deploymentHelper.connectGTContracts(GTContracts)
      
      const growthTokenAddress = growthToken.address

      const recordedGrowthTokenAddress = await gtStaking.growthTokenAddress()
      assert.equal(growthTokenAddress, recordedGrowthTokenAddress)
    })

    it.only('sets the correct GrowthToken address in LockupContractFactory', async () => {
      // Set the GrowthToken address in the LCF, CI and GTStaking
      await deploymentHelper.connectGTContracts(GTContracts)

      const growthTokenAddress = growthToken.address

      const recordedGrowthTokenAddress = await lockupContractFactory.growthTokenAddress()
      assert.equal(growthTokenAddress, recordedGrowthTokenAddress)
    })

    it.only('sets the correct GrowthToken address in LockupContractFactory', async () => {
       // Set the GrowthToken address in the LCF, CI and GTStaking
       await deploymentHelper.connectGTContracts(GTContracts)

      const growthTokenAddress = growthToken.address

      const recordedGrowthTokenAddress = await communityIssuance.growthTokenAddress()
      assert.equal(growthTokenAddress, recordedGrowthTokenAddress)
    })
  })
})