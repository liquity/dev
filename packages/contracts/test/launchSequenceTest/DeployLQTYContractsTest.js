const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")


const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const assertRevert = th.assertRevert
const toBN = th.toBN
const dec = th.dec

contract('Deploying the LQTY contracts: LCF, CI, LQTYStaking, and LQTYToken ', async accounts => {
  const [liquityAG, A, B] = accounts;
  const bountyAddress = accounts[998]
  const lpRewardsAddress = accounts[999]

  let LQTYContracts

  oneHundred = toBN(100)
  oneMillion = toBN(1000000)
  digits = toBN(1e18)
  four = toBN(4)
  const expectedCISupplyCap = oneHundred.mul(oneMillion).mul(digits).div(four)

  beforeEach(async () => {
    // Deploy all contracts from the first account
    LQTYContracts = await deploymentHelper.deployLQTYContracts(bountyAddress, lpRewardsAddress)
    await deploymentHelper.connectLQTYContracts(LQTYContracts)

    lqtyStaking = LQTYContracts.lqtyStaking
    lqtyToken = LQTYContracts.lqtyToken
    communityIssuance = LQTYContracts.communityIssuance
    lockupContractFactory = LQTYContracts.lockupContractFactory

    //LQTY Staking and CommunityIssuance have not yet had their setters called, so are not yet
    // connected to the rest of the system
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
      const storedDeployerAddress = await communityIssuance.owner()

      assert.equal(liquityAG, storedDeployerAddress)
    })
  })

  describe('LQTYStaking deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await lqtyStaking.owner()

      assert.equal(liquityAG, storedDeployerAddress)
    })
  })

  describe('LQTYToken deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await lqtyToken.deployer()

      assert.equal(liquityAG, storedDeployerAddress)
    })

    it("Stores the CommunityIssuance address", async () => {
      const storedCIAddress = await lqtyToken.communityIssuanceAddress()

      assert.equal(communityIssuance.address, storedCIAddress)

    })

    it("Stores the LockupContractFactory address", async () => {
      const storedLCFAddress = await lqtyToken.lockupContractFactory()

      assert.equal(lockupContractFactory.address, storedLCFAddress)
    })

    it("Mints the correct LQTY amount to the deployer's address: (63.66 million)", async () => {
      const deployerLQTYEntitlement = await lqtyToken.balanceOf(liquityAG)

     const twentyThreeSixes = "6".repeat(23)
      const expectedDeployerEntitlement = "63".concat(twentyThreeSixes).concat("7")
      console.log(`${deployerLQTYEntitlement}`)
      assert.equal(deployerLQTYEntitlement, expectedDeployerEntitlement)
    })

    it("Mints the correct LQTY amount to the CommunityIssuance contract address: (1/3 * 100million)", async () => {
      const communityLQTYEntitlement = await lqtyToken.balanceOf(communityIssuance.address)
      // 25 million as 18-digit decimal
      const _25Million = dec(25, 24)

      assert.equal(communityLQTYEntitlement, _25Million)
    })

    it("Mints the correct LQTY amount to the bountyAddress EOA: 3 million", async () => {
      const bountyAddressBal = await lqtyToken.balanceOf(bountyAddress)
      // 3 million as 18-digit decimal
      const _3Million = dec(3, 24)

      assert.equal(bountyAddressBal, _3Million)
    })

    it("Mints the correct LQTY amount to the lpRewardsAddress EOA: 8.33 million", async () => {
      const lpRewardsAddressBal = await lqtyToken.balanceOf(lpRewardsAddress)
      // 3 million as 18-digit decimal
      const _8pt33Million = "8".concat("3".repeat(24))

      assert.equal(lpRewardsAddressBal, _8pt33Million)
    })
  })

  describe('Community Issuance deployment', async accounts => {
    it("Stores the deployer's address", async () => {

      const storedDeployerAddress = await communityIssuance.owner()

      assert.equal(storedDeployerAddress, liquityAG)
    })

    it("Has a supply cap of (1/3) * 100 million", async () => {
      const supplyCap = await communityIssuance.LQTYSupplyCap()

      assert.isTrue(expectedCISupplyCap.eq(supplyCap))
    })

    it("Liquity AG can set addresses if CI's LQTY balance is equal or greater than (1/3) * 100 million ", async () => {
      const LQTYBalance = await lqtyToken.balanceOf(communityIssuance.address)
      assert.isTrue(LQTYBalance.eq(expectedCISupplyCap))

      // Deploy core contracts, just to get the Stability Pool address
      const coreContracts = await deploymentHelper.deployLiquityCore()

      const tx = await communityIssuance.setAddresses(
        lqtyToken.address,
        coreContracts.stabilityPool.address,
        { from: liquityAG }
      );
      assert.isTrue(tx.receipt.status)
    })

    it("Liquity AG can't set addresses if CI's LQTY balance is < (1/3) * 100 million ", async () => {
      const newCI = await CommunityIssuance.new()

      const LQTYBalance = await lqtyToken.balanceOf(newCI.address)
      assert.equal(LQTYBalance, '0')

      // Deploy core contracts, just to get the Stability Pool address
      const coreContracts = await deploymentHelper.deployLiquityCore()

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await lqtyToken.transfer(newCI.address, '33333333333333333333333332') // 1e-18 less than the CI expects

      try {
        const tx = await newCI.setAddresses(
          lqtyToken.address,
          coreContracts.stabilityPool.address,
          { from: liquityAG }
        );
      
        // Check it gives the expected error message for a failed Solidity 'assert'
      } catch (err) {
        assert.include(err.message, "invalid opcode")
      }
    })
  })

  describe('Connecting LQTYToken to LCF, CI and LQTYStaking', async accounts => {
    it('sets the correct LQTYToken address in LQTYStaking', async () => {
      // Deploy core contracts and set the LQTYToken address in the CI and LQTYStaking
      const coreContracts = await deploymentHelper.deployLiquityCore()
      await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, coreContracts)

      const lqtyTokenAddress = lqtyToken.address

      const recordedLQTYTokenAddress = await lqtyStaking.lqtyToken()
      assert.equal(lqtyTokenAddress, recordedLQTYTokenAddress)
    })

    it('sets the correct LQTYToken address in LockupContractFactory', async () => {
      const lqtyTokenAddress = lqtyToken.address

      const recordedLQTYTokenAddress = await lockupContractFactory.lqtyToken()
      assert.equal(lqtyTokenAddress, recordedLQTYTokenAddress)
    })

    it('sets the correct LQTYToken address in CommunityIssuance', async () => {
      // Deploy core contracts and set the LQTYToken address in the CI and LQTYStaking
      const coreContracts = await deploymentHelper.deployLiquityCore()
      await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, coreContracts)

      const lqtyTokenAddress = lqtyToken.address

      const recordedLQTYTokenAddress = await communityIssuance.lqtyToken()
      assert.equal(lqtyTokenAddress, recordedLQTYTokenAddress)
    })
  })
})