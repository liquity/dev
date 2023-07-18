const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")


const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const assertRevert = th.assertRevert
const toBN = th.toBN
const dec = th.dec

contract('Deploying the STBL contracts: LCF, CI, STBLStaking, and STBLToken ', async accounts => {
  const [liquityAG, A, B] = accounts;
  const [bountyAddress, xbrlWethLpRewardsAddress, stblWethLpRewardsAddress, momentZeroMultisig, sixMonthsMultisig, oneYearMultisig] = accounts.slice(994, 1000)

  let STBLContracts

  const oneMillion = toBN(1000000)
  const digits = toBN(1e18)
  const thirtyTwo = toBN(32)
  const expectedCISupplyCap = thirtyTwo.mul(oneMillion).mul(digits)

  beforeEach(async () => {
    // Deploy all contracts from the first account
    STBLContracts = await deploymentHelper.deploySTBLContracts(bountyAddress, xbrlWethLpRewardsAddress, stblWethLpRewardsAddress, momentZeroMultisig, sixMonthsMultisig, oneYearMultisig)
    await deploymentHelper.connectSTBLContracts(STBLContracts)

    stblStaking = STBLContracts.stblStaking
    stblToken = STBLContracts.stblToken
    communityIssuance = STBLContracts.communityIssuance
    lockupContractFactory = STBLContracts.lockupContractFactory

    //STBL Staking and CommunityIssuance have not yet had their setters called, so are not yet
    // connected to the rest of the system
  })


  describe('CommunityIssuance deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await communityIssuance.owner()

      assert.equal(liquityAG, storedDeployerAddress)
    })
  })

  describe('STBLStaking deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await stblStaking.owner()

      assert.equal(liquityAG, storedDeployerAddress)
    })
  })

  describe('STBLToken deployment', async accounts => {
    it("Stores the multisig's address", async () => {
      const storedMultisigAddress = await stblToken.momentZeroMultisigAddress()

      assert.equal(momentZeroMultisig, storedMultisigAddress)
    })
    
    it("Stores the multisig's address", async () => {
      const storedMultisigAddress = await stblToken.sixMonthsMultisigAddress()

      assert.equal(sixMonthsMultisig, storedMultisigAddress)
    })

    it("Stores the multisig's address", async () => {
      const storedMultisigAddress = await stblToken.oneYearMultisigAddress()

      assert.equal(oneYearMultisig, storedMultisigAddress)
    })

    it("Stores the CommunityIssuance address", async () => {
      const storedCIAddress = await stblToken.communityIssuanceAddress()

      assert.equal(communityIssuance.address, storedCIAddress)
    })

    it("Stores the LockupContractFactory address", async () => {
      const storedLCFAddress = await stblToken.lockupContractFactory()

      assert.equal(lockupContractFactory.address, storedLCFAddress)
    })

    it("Mints the correct STBL amount to the multisig's address: (15 million)", async () => {
      const multisigSTBLEntitlement = await stblToken.balanceOf(momentZeroMultisig)

      const twentyFourZeros = "0".repeat(24)
      const expectedMultisigEntitlement = "15".concat(twentyFourZeros)
      assert.equal(multisigSTBLEntitlement, expectedMultisigEntitlement)
    })

    it("Mints the correct STBL amount to the multisig's address: (20 million)", async () => {
      const multisigSTBLEntitlement = await stblToken.balanceOf(sixMonthsMultisig)

      const twentyFourZeros = "0".repeat(24)
      const expectedMultisigEntitlement = "20".concat(twentyFourZeros)
      assert.equal(multisigSTBLEntitlement, expectedMultisigEntitlement)
    })

    it("Mints the correct STBL amount to the multisig's address: (29.67 million)", async () => {
      const multisigSTBLEntitlement = await stblToken.balanceOf(oneYearMultisig)

      const twentyFourSixes = "6".repeat(23)
      const expectedMultisigEntitlement = "29".concat(twentyFourSixes).concat("7")
      assert.equal(multisigSTBLEntitlement, expectedMultisigEntitlement)
    })

    it("Mints the correct STBL amount to the CommunityIssuance contract address: 32 million", async () => {
      const communitySTBLEntitlement = await stblToken.balanceOf(communityIssuance.address)
      // 32 million as 18-digit decimal
      const _32Million = dec(32, 24)

      assert.equal(communitySTBLEntitlement, _32Million)
    })

    it("Mints the correct STBL amount to the bountyAddress EOA: 1 million", async () => {
      const bountyAddressBal = await stblToken.balanceOf(bountyAddress)
      // 2 million as 18-digit decimal
      const _1Million = dec(1, 24)

      assert.equal(bountyAddressBal, _1Million)
    })

    it("Mints the correct STBL amount to the XBRL : WETH lpRewardsAddress EOA: 1.33 million", async () => {
      const lpRewardsAddressBal = await stblToken.balanceOf(xbrlWethLpRewardsAddress)
      // 1.3 million as 18-digit decimal
      const _1pt33Million = "1".concat("3".repeat(24))

      assert.equal(lpRewardsAddressBal, _1pt33Million)
    })

    it("Mints the correct STBL amount to the STBL : WETH lpRewardsAddress EOA: 1 million", async () => {
      const lpRewardsAddressBal = await stblToken.balanceOf(stblWethLpRewardsAddress)
      // 1.3 million as 18-digit decimal
      const _1Million = dec(1, 24)

      assert.equal(lpRewardsAddressBal, _1Million)
    })
  })

  describe('Community Issuance deployment', async accounts => {
    it("Stores the deployer's address", async () => {

      const storedDeployerAddress = await communityIssuance.owner()

      assert.equal(storedDeployerAddress, liquityAG)
    })

    it("Has a supply cap of 32 million", async () => {
      const supplyCap = await communityIssuance.STBLSupplyCap()

      assert.isTrue(expectedCISupplyCap.eq(supplyCap))
    })

    it("Liquity AG can set addresses if CI's STBL balance is equal or greater than 32 million", async () => {
      const STBLBalance = await stblToken.balanceOf(communityIssuance.address)
      assert.isTrue(STBLBalance.eq(expectedCISupplyCap))

      // Deploy core contracts, just to get the Stability Pool address
      const coreContracts = await deploymentHelper.deployLiquityCore()

      const tx = await communityIssuance.setAddresses(
        stblToken.address,
        coreContracts.stabilityPool.address,
        { from: liquityAG }
      );
      assert.isTrue(tx.receipt.status)
    })

    it("Liquity AG can't set addresses if CI's STBL balance is < 32 million", async () => {
      const newCI = await CommunityIssuance.new()

      const STBLBalance = await stblToken.balanceOf(newCI.address)
      assert.equal(STBLBalance, '0')

      // Deploy core contracts, just to get the Stability Pool address
      const coreContracts = await deploymentHelper.deployLiquityCore()

      await th.fastForwardTime(timeValues.SECONDS_IN_TWO_MONTHS, web3.currentProvider)
      await stblToken.transfer(newCI.address, '14999999999999999999999999', {from: momentZeroMultisig}) // 1e-18 less than CI expects (15 million)

      try {
        const tx = await newCI.setAddresses(
          stblToken.address,
          coreContracts.stabilityPool.address,
          { from: liquityAG }
        );
      
        // Check it gives the expected error message for a failed Solidity 'assert'
      } catch (err) {
        assert.include(err.message, "reverted with panic code 0x1 (Assertion error)")
      }
    })

    it("Liquity AG can't set addresses if CI's STBL balance is < 32 million ", async () => {
      const newCI = await CommunityIssuance.new()

      const STBLBalance = await stblToken.balanceOf(newCI.address)
      assert.equal(STBLBalance, '0')

      // Deploy core contracts, just to get the Stability Pool address
      const coreContracts = await deploymentHelper.deployLiquityCore()

      await th.fastForwardTime(timeValues.SECONDS_IN_SIX_MONTHS, web3.currentProvider)
      await stblToken.transfer(newCI.address, '19999999999999999999999999', {from: sixMonthsMultisig}) // 1e-18 less than CI expects (20 million)

      try {
        const tx = await newCI.setAddresses(
          stblToken.address,
          coreContracts.stabilityPool.address,
          { from: liquityAG }
        );
      
        // Check it gives the expected error message for a failed Solidity 'assert'
      } catch (err) {
        assert.include(err.message, "reverted with panic code 0x1 (Assertion error)")
      }
    })

    it("Liquity AG can't set addresses if CI's STBL balance is < 32 million ", async () => {
      const newCI = await CommunityIssuance.new()

      const STBLBalance = await stblToken.balanceOf(newCI.address)
      assert.equal(STBLBalance, '0')

      // Deploy core contracts, just to get the Stability Pool address
      const coreContracts = await deploymentHelper.deployLiquityCore()

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await stblToken.transfer(newCI.address, '29666666666666666666666667', {from: oneYearMultisig}) // 1e-18 less than CI expects (29.67 million)

      try {
        const tx = await newCI.setAddresses(
          stblToken.address,
          coreContracts.stabilityPool.address,
          { from: liquityAG }
        );
      
        // Check it gives the expected error message for a failed Solidity 'assert'
      } catch (err) {
        assert.include(err.message, "reverted with panic code 0x1 (Assertion error)")
      }
    })
  })

  describe('Connecting STBLToken to LCF, CI and STBLStaking', async accounts => {
    it('sets the correct STBLToken address in STBLStaking', async () => {
      // Deploy core contracts and set the STBLToken address in the CI and STBLStaking
      const coreContracts = await deploymentHelper.deployLiquityCore()
      await deploymentHelper.connectSTBLContractsToCore(STBLContracts, coreContracts)

      const stblTokenAddress = stblToken.address

      const recordedSTBLTokenAddress = await stblStaking.stblToken()
      assert.equal(stblTokenAddress, recordedSTBLTokenAddress)
    })

    it('sets the correct STBLToken address in LockupContractFactory', async () => {
      const stblTokenAddress = stblToken.address

      const recordedSTBLTokenAddress = await lockupContractFactory.stblTokenAddress()
      assert.equal(stblTokenAddress, recordedSTBLTokenAddress)
    })

    it('sets the correct STBLToken address in CommunityIssuance', async () => {
      // Deploy core contracts and set the STBLToken address in the CI and STBLStaking
      const coreContracts = await deploymentHelper.deployLiquityCore()
      await deploymentHelper.connectSTBLContractsToCore(STBLContracts, coreContracts)

      const stblTokenAddress = stblToken.address

      const recordedSTBLTokenAddress = await communityIssuance.stblToken()
      assert.equal(stblTokenAddress, recordedSTBLTokenAddress)
    })
  })
})
