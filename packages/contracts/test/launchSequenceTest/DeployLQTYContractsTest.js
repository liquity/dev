const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")
const CommunityIssuance = artifacts.require("./GT/CommunityIssuance.sol")

const th = testHelpers.TestHelper

contract('Deploying the LQTY contracts: LCF, CI, LQTYStaking, and GrowthToken ', async accounts => {
  const [liquityAG] = accounts;

  let GTContracts
  beforeEach(async () => {
    // Deploy all contracts from the first account
    GTContracts = await deploymentHelper.deployGTContracts()
    await deploymentHelper.connectGTContracts(GTContracts)

    lqtyStaking = GTContracts.lqtyStaking
    growthToken = GTContracts.growthToken
    communityIssuance = GTContracts.communityIssuance
    lockupContractFactory = GTContracts.lockupContractFactory
  })

  describe('LockupContractFactory deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await lockupContractFactory.deployer()

      assert.equal(liquityAG, storedDeployerAddress)
    })

    it("Stores the timestamp for the block in which it was deployed", async () => {
      const storedDeploymentTimestamp = await lockupContractFactory.deploymentTime()

      const deploymentTxReceipt = await web3.eth.getTransaction(lockupContractFactory.transactionHash)
      const deploymentBlockTimestamp = await th.getTimestampFromTxReceipt(deploymentTxReceipt, web3)

      assert.equal(storedDeploymentTimestamp, deploymentBlockTimestamp)
    })
  })

  describe('CommunityIssuance deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await communityIssuance.deployer()

      assert.equal(liquityAG, storedDeployerAddress)
    })
  })

  describe('LQTYStaking deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await lqtyStaking.deployer()

      assert.equal(liquityAG, storedDeployerAddress)
    })
  })

  describe('GrowthToken deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await growthToken.deployer()

      assert.equal(liquityAG, storedDeployerAddress)
    })

    it("Stores the CommunityIssuance address", async () => {
      const storedCIAddress = await growthToken.communityIssuanceAddress()

      assert.equal(communityIssuance.address, storedCIAddress)

    })

    it("Stores the LockupContractFactory address", async () => {
      const storedLCFAddress = await growthToken.lockupContractFactory()

      assert.equal(lockupContractFactory.address, storedLCFAddress)
    })

    it("Mints the correct LQTY amount to the deployer's address: (2/3 * 100million)", async () => {
      const deployerGTEntitlement = await growthToken.balanceOf(liquityAG)

      // (2/3 * 100million ), as a uint representation of 18-digit decimal
      const _twentySix_Sixes = "6".repeat(26)

      assert.equal(_twentySix_Sixes, deployerGTEntitlement)
    })

    it("Mints the correct LQTY amount to the CommunityIssuance contract address: (1/3 * 100million)", async () => {
      const communityLQTYEntitlement = await growthToken.balanceOf(communityIssuance.address)

      // (1/3 * 100million ), as a uint representation of 18-digit decimal
      const _twentySix_Threes = "3".repeat(26)

      assert.equal(_twentySix_Threes, communityLQTYEntitlement)
    })
  })

  describe('Community Issuance deployment', async accounts => { 
    it("Stores the deployer's address", async () => {

      const storedDeployerAddress = await communityIssuance.deployer()

      assert.equal(storedDeployerAddress, liquityAG)
    })

    it("Stores the growthToken address", async () => {
      const storedGrowthTokenAddress = await communityIssuance.growthToken()

      assert.equal(storedGrowthTokenAddress, growthToken.address)
    })

    it("Liquity AG can activate it when it's LQTY balance is equal or greater than (1/3) * 100 million ", async () => {
      assert.isFalse(await communityIssuance.active())

      const LQTYBalance = await growthToken.balanceOf(communityIssuance.address)
      assert.equal(LQTYBalance, '33333333333333333333333333')
      await communityIssuance.activateContract( {from: liquityAG});

      const isActive = await communityIssuance.active()
      assert.isTrue(await communityIssuance.active())
    })
  })

  describe('Connecting GrowthToken to LCF, CI and LQTYStaking', async accounts => {
    it('sets the correct GrowthToken address in LQTYStaking', async () => { 
      // Set the GrowthToken address in the LCF, CI and LQTYStaking
      await deploymentHelper.connectGTContracts(GTContracts)
      
      const growthTokenAddress = growthToken.address

      const recordedGrowthTokenAddress = await lqtyStaking.growthToken()
      assert.equal(growthTokenAddress, recordedGrowthTokenAddress)
    })

    it('sets the correct GrowthToken address in LockupContractFactory', async () => {
      const growthTokenAddress = growthToken.address

      const recordedGrowthTokenAddress = await lockupContractFactory.growthToken()
      assert.equal(growthTokenAddress, recordedGrowthTokenAddress)
    })

    it('sets the correct GrowthToken address in CommunityIssuance', async () => {
       // Set the GrowthToken address in the LCF, CI and LQTYStaking
       await deploymentHelper.connectGTContracts(GTContracts)

      const growthTokenAddress = growthToken.address

      const recordedGrowthTokenAddress = await communityIssuance.growthToken()
      assert.equal(growthTokenAddress, recordedGrowthTokenAddress)
    })
  })
})