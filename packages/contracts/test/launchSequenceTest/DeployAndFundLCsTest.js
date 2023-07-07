

const LockupContract = artifacts.require("./LockupContract.sol")

const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const { dec, toBN, assertRevert } = th

contract('Deploying and funding One Year Lockup Contracts', async accounts => {
  const [liquityAG, A, B, C, D, E, F, G, H, I, J] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  const SECONDS_IN_ONE_MONTH = timeValues.SECONDS_IN_ONE_MONTH

  let STBLContracts

  // 1e24 = 1 million tokens with 18 decimal digits
  const STBLEntitlement_A = dec(1, 24)
  const STBLEntitlement_B = dec(2, 24)
  const STBLEntitlement_C = dec(3, 24)
  const STBLEntitlement_D = dec(4, 24)
  const STBLEntitlement_E = dec(5, 24)

  let stblStaking
  let stblToken
  let communityIssuance
  let lockupContractFactory

  let oneYearFromSystemDeployment

  beforeEach(async () => {
    // Deploy all contracts from the first account
    STBLContracts = await deploymentHelper.deploySTBLContracts(bountyAddress, lpRewardsAddress, multisig)
    await deploymentHelper.connectSTBLContracts(STBLContracts)

    stblStaking = STBLContracts.stblStaking
    stblToken = STBLContracts.stblToken
    communityIssuance = STBLContracts.communityIssuance
    lockupContractFactory = STBLContracts.lockupContractFactory

    oneYearFromSystemDeployment = await th.getTimeFromSystemDeployment(stblToken, web3, timeValues.SECONDS_IN_ONE_YEAR)
  })

  // --- LCs ---

  describe('Deploying LCs', async accounts => {
    it("STBL Deployer can deploy LCs through the Factory", async () => {
    
      // STBL deployer deploys LCs
      const LCDeploymentTx_A = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_B = await lockupContractFactory.deployLockupContract(B, oneYearFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_C = await lockupContractFactory.deployLockupContract(C, oneYearFromSystemDeployment, { from: liquityAG })

      assert.isTrue(LCDeploymentTx_A.receipt.status)
      assert.isTrue(LCDeploymentTx_B.receipt.status)
      assert.isTrue(LCDeploymentTx_C.receipt.status)
    })

    it("Anyone can deploy LCs through the Factory", async () => {
      // Various EOAs deploy LCs
      const LCDeploymentTx_1 = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: G })
      const LCDeploymentTx_2 = await lockupContractFactory.deployLockupContract(C, oneYearFromSystemDeployment, { from: H })
      const LCDeploymentTx_3 = await lockupContractFactory.deployLockupContract(liquityAG, oneYearFromSystemDeployment, { from: I })
      const LCDeploymentTx_4 = await lockupContractFactory.deployLockupContract(D, oneYearFromSystemDeployment, { from: J })

      assert.isTrue(LCDeploymentTx_1.receipt.status)
      assert.isTrue(LCDeploymentTx_2.receipt.status)
      assert.isTrue(LCDeploymentTx_3.receipt.status)
      assert.isTrue(LCDeploymentTx_4.receipt.status)
    })

    it("STBL Deployer can deploy LCs directly", async () => {
      // STBL deployer deploys LCs
      const LC_A = await LockupContract.new(stblToken.address, A, oneYearFromSystemDeployment, { from: liquityAG })
      const LC_A_txReceipt = await web3.eth.getTransactionReceipt(LC_A.transactionHash)

      const LC_B = await LockupContract.new(stblToken.address, B, oneYearFromSystemDeployment, { from: liquityAG })
      const LC_B_txReceipt = await web3.eth.getTransactionReceipt(LC_B.transactionHash)

      const LC_C = await LockupContract.new(stblToken.address, C, oneYearFromSystemDeployment, { from: liquityAG })
      const LC_C_txReceipt = await web3.eth.getTransactionReceipt(LC_C.transactionHash)

      // Check deployment succeeded
      assert.isTrue(LC_A_txReceipt.status)
      assert.isTrue(LC_B_txReceipt.status)
      assert.isTrue(LC_C_txReceipt.status)
    })

    it("Anyone can deploy LCs directly", async () => {
      // Various EOAs deploy LCs
      const LC_A = await LockupContract.new(stblToken.address, A, oneYearFromSystemDeployment, { from: D })
      const LC_A_txReceipt = await web3.eth.getTransactionReceipt(LC_A.transactionHash)

      const LC_B = await LockupContract.new(stblToken.address, B, oneYearFromSystemDeployment, { from: E })
      const LC_B_txReceipt = await web3.eth.getTransactionReceipt(LC_B.transactionHash)

      const LC_C = await LockupContract.new(stblToken.address, C, oneYearFromSystemDeployment, { from: F })
      const LC_C_txReceipt = await web3.eth.getTransactionReceipt(LC_C.transactionHash)

      // Check deployment succeeded
      assert.isTrue(LC_A_txReceipt.status)
      assert.isTrue(LC_B_txReceipt.status)
      assert.isTrue(LC_C_txReceipt.status)
    })

    it("LC deployment stores the beneficiary's address in the LC", async () => {
      // Deploy 5 LCs
      const deployedLCtx_A = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_C = await lockupContractFactory.deployLockupContract(C, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_D = await lockupContractFactory.deployLockupContract(D, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_E = await lockupContractFactory.deployLockupContract(E, oneYearFromSystemDeployment, { from: liquityAG })

      // Grab contracts from deployment tx events
      const LC_A = await th.getLCFromDeploymentTx(deployedLCtx_A)
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)
      const LC_C = await th.getLCFromDeploymentTx(deployedLCtx_C)
      const LC_D = await th.getLCFromDeploymentTx(deployedLCtx_D)
      const LC_E = await th.getLCFromDeploymentTx(deployedLCtx_E)

      const storedBeneficiaryAddress_A = await LC_A.beneficiary()
      const storedBeneficiaryAddress_B = await LC_B.beneficiary()
      const storedBeneficiaryAddress_C = await LC_C.beneficiary()
      const storedBeneficiaryAddress_D = await LC_D.beneficiary()
      const storedBeneficiaryAddress_E = await LC_E.beneficiary()

      assert.equal(A, storedBeneficiaryAddress_A)
      assert.equal(B, storedBeneficiaryAddress_B)
      assert.equal(C, storedBeneficiaryAddress_C)
      assert.equal(D, storedBeneficiaryAddress_D)
      assert.equal(E, storedBeneficiaryAddress_E)
    })

    it("LC deployment through the Factory registers the LC in the Factory", async () => {
      // Deploy 5 LCs
      const deployedLCtx_A = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_C = await lockupContractFactory.deployLockupContract(C, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_D = await lockupContractFactory.deployLockupContract(D, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_E = await lockupContractFactory.deployLockupContract(E, oneYearFromSystemDeployment, { from: liquityAG })

      // Grab contract addresses from deployment tx events
      const LCAddress_A = await th.getLCAddressFromDeploymentTx(deployedLCtx_A)
      const LCAddress_B = await th.getLCAddressFromDeploymentTx(deployedLCtx_B)
      const LCAddress_C = await th.getLCAddressFromDeploymentTx(deployedLCtx_C)
      const LCAddress_D = await th.getLCAddressFromDeploymentTx(deployedLCtx_D)
      const LCAddress_E = await th.getLCAddressFromDeploymentTx(deployedLCtx_E)

      assert.isTrue(await lockupContractFactory.isRegisteredLockup(LCAddress_A))
      assert.isTrue(await lockupContractFactory.isRegisteredLockup(LCAddress_B))
      assert.isTrue(await lockupContractFactory.isRegisteredLockup(LCAddress_C))
      assert.isTrue(await lockupContractFactory.isRegisteredLockup(LCAddress_D))
      assert.isTrue(await lockupContractFactory.isRegisteredLockup(LCAddress_E))
    })

    it("LC deployment through the Factory records the LC contract address and deployer as a k-v pair in the Factory", async () => {
      // Deploy 5 LCs
      const deployedLCtx_A = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_C = await lockupContractFactory.deployLockupContract(C, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_D = await lockupContractFactory.deployLockupContract(D, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_E = await lockupContractFactory.deployLockupContract(E, oneYearFromSystemDeployment, { from: liquityAG })

      // Grab contract addresses from deployment tx events
      const LCAddress_A = await th.getLCAddressFromDeploymentTx(deployedLCtx_A)
      const LCAddress_B = await th.getLCAddressFromDeploymentTx(deployedLCtx_B)
      const LCAddress_C = await th.getLCAddressFromDeploymentTx(deployedLCtx_C)
      const LCAddress_D = await th.getLCAddressFromDeploymentTx(deployedLCtx_D)
      const LCAddress_E = await th.getLCAddressFromDeploymentTx(deployedLCtx_E)

      assert.equal(liquityAG, await lockupContractFactory.lockupContractToDeployer(LCAddress_A))
      assert.equal(liquityAG, await lockupContractFactory.lockupContractToDeployer(LCAddress_B))
      assert.equal(liquityAG, await lockupContractFactory.lockupContractToDeployer(LCAddress_C))
      assert.equal(liquityAG, await lockupContractFactory.lockupContractToDeployer(LCAddress_D))
      assert.equal(liquityAG, await lockupContractFactory.lockupContractToDeployer(LCAddress_E))
    })

    it("LC deployment through the Factory sets the unlockTime in the LC", async () => {
      // Deploy 3 LCs through factory
      const deployedLCtx_A = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, '230582305895235', { from: B })
      const deployedLCtx_C = await lockupContractFactory.deployLockupContract(C, dec(20, 18), { from: E })

      // Grab contract objects from deployment events
      const LC_A = await th.getLCFromDeploymentTx(deployedLCtx_A)
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)
      const LC_C = await th.getLCFromDeploymentTx(deployedLCtx_C)

      // Grab contract addresses from deployment tx events
      const unlockTime_A = await LC_A.unlockTime()
      const unlockTime_B = await LC_B.unlockTime()
      const unlockTime_C = await LC_C.unlockTime()

      // Check contracts have expected unlockTimes set
      assert.isTrue(unlockTime_A.eq(oneYearFromSystemDeployment))
      assert.isTrue(unlockTime_B.eq(toBN('230582305895235')))
      assert.isTrue(unlockTime_C.eq(toBN(dec(20, 18))))
    })

    it("Direct deployment of LC sets the unlockTime in the LC", async () => {
      // Deploy 3 LCs directly
      const LC_A = await LockupContract.new(stblToken.address, A, oneYearFromSystemDeployment, { from: liquityAG })
      const LC_B = await LockupContract.new(stblToken.address, B, '230582305895235', { from: B })
      const LC_C = await LockupContract.new(stblToken.address, C, dec(20, 18), { from: E })

      // Grab contract addresses from deployment tx events
      const unlockTime_A = await LC_A.unlockTime()
      const unlockTime_B = await LC_B.unlockTime()
      const unlockTime_C = await LC_C.unlockTime()

      // Check contracts have expected unlockTimes set
      assert.isTrue(unlockTime_A.eq(oneYearFromSystemDeployment))
      assert.isTrue(unlockTime_B.eq(toBN('230582305895235')))
      assert.isTrue(unlockTime_C.eq(toBN(dec(20, 18))))
    })

    it("LC deployment through the Factory reverts when the unlockTime is < 1 year from system deployment", async () => {
      const nearlyOneYear = toBN(oneYearFromSystemDeployment).sub(toBN('60'))  // 1 minute short of 1 year
      
      // Deploy 3 LCs through factory
      const LCDeploymentPromise_A = lockupContractFactory.deployLockupContract(A, nearlyOneYear, { from: liquityAG })
      const LCDeploymentPromise_B = lockupContractFactory.deployLockupContract(B, '37', { from: B })
      const LCDeploymentPromise_C = lockupContractFactory.deployLockupContract(C, '43200', { from: E })

      // Confirm contract deployments revert
      await assertRevert(LCDeploymentPromise_A, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(LCDeploymentPromise_B, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(LCDeploymentPromise_C, "LockupContract: unlock time must be at least one year after system deployment")
    })

    it("Direct deployment of LC reverts when the unlockTime is < 1 year from system deployment", async () => {
      const nearlyOneYear = toBN(oneYearFromSystemDeployment).sub(toBN('60'))  // 1 minute short of 1 year
      
      // Deploy 3 LCs directly with unlockTime < 1 year from system deployment
      const LCDeploymentPromise_A = LockupContract.new(stblToken.address, A, nearlyOneYear, { from: liquityAG })
      const LCDeploymentPromise_B = LockupContract.new(stblToken.address, B, '37', { from: B })
      const LCDeploymentPromise_C = LockupContract.new(stblToken.address, C, '43200', { from: E })
     
      // Confirm contract deployments revert
      await assertRevert(LCDeploymentPromise_A, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(LCDeploymentPromise_B, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(LCDeploymentPromise_C, "LockupContract: unlock time must be at least one year after system deployment")
    })

  
  })

  describe('Funding LCs', async accounts => {
    it("STBL transfer from STBL deployer to their deployed LC increases the STBL balance of the LC", async () => {
      // Deploy 5 LCs
      const deployedLCtx_A = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_C = await lockupContractFactory.deployLockupContract(C, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_D = await lockupContractFactory.deployLockupContract(D, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_E = await lockupContractFactory.deployLockupContract(E, oneYearFromSystemDeployment, { from: liquityAG })

      // Grab contract addresses from deployment tx events
      const LCAddress_A = await th.getLCAddressFromDeploymentTx(deployedLCtx_A)
      const LCAddress_B = await th.getLCAddressFromDeploymentTx(deployedLCtx_B)
      const LCAddress_C = await th.getLCAddressFromDeploymentTx(deployedLCtx_C)
      const LCAddress_D = await th.getLCAddressFromDeploymentTx(deployedLCtx_D)
      const LCAddress_E = await th.getLCAddressFromDeploymentTx(deployedLCtx_E)

      assert.equal(await stblToken.balanceOf(LCAddress_A), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_B), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_C), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_D), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_E), '0')

      // Multisig transfers STBL to each LC
      await stblToken.transfer(LCAddress_A, STBLEntitlement_A, { from: multisig })
      await stblToken.transfer(LCAddress_B, STBLEntitlement_B, { from: multisig })
      await stblToken.transfer(LCAddress_C, STBLEntitlement_C, { from: multisig })
      await stblToken.transfer(LCAddress_D, STBLEntitlement_D, { from: multisig })
      await stblToken.transfer(LCAddress_E, STBLEntitlement_E, { from: multisig })

      assert.equal(await stblToken.balanceOf(LCAddress_A), STBLEntitlement_A)
      assert.equal(await stblToken.balanceOf(LCAddress_B), STBLEntitlement_B)
      assert.equal(await stblToken.balanceOf(LCAddress_C), STBLEntitlement_C)
      assert.equal(await stblToken.balanceOf(LCAddress_D), STBLEntitlement_D)
      assert.equal(await stblToken.balanceOf(LCAddress_E), STBLEntitlement_E)
    })

    it("STBL Multisig can transfer STBL to LCs deployed through the factory by anyone", async () => {  
      // Various accts deploy 5 LCs
      const deployedLCtx_A = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: F })
      const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, oneYearFromSystemDeployment, { from: G })
      const deployedLCtx_C = await lockupContractFactory.deployLockupContract(C, oneYearFromSystemDeployment, { from: H })
      const deployedLCtx_D = await lockupContractFactory.deployLockupContract(D, oneYearFromSystemDeployment, { from: I })
      const deployedLCtx_E = await lockupContractFactory.deployLockupContract(E, oneYearFromSystemDeployment, { from: J })

      // Grab contract addresses from deployment tx events
      const LCAddress_A = await th.getLCAddressFromDeploymentTx(deployedLCtx_A)
      const LCAddress_B = await th.getLCAddressFromDeploymentTx(deployedLCtx_B)
      const LCAddress_C = await th.getLCAddressFromDeploymentTx(deployedLCtx_C)
      const LCAddress_D = await th.getLCAddressFromDeploymentTx(deployedLCtx_D)
      const LCAddress_E = await th.getLCAddressFromDeploymentTx(deployedLCtx_E)

      assert.equal(await stblToken.balanceOf(LCAddress_A), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_B), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_C), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_D), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_E), '0')

      // Multisig transfers STBL to each LC
      await stblToken.transfer(LCAddress_A, dec(1, 18), { from: multisig })
      await stblToken.transfer(LCAddress_B, dec(2, 18), { from: multisig })
      await stblToken.transfer(LCAddress_C, dec(3, 18), { from: multisig })
      await stblToken.transfer(LCAddress_D, dec(4, 18), { from: multisig })
      await stblToken.transfer(LCAddress_E, dec(5, 18), { from: multisig })

      assert.equal(await stblToken.balanceOf(LCAddress_A), dec(1, 18))
      assert.equal(await stblToken.balanceOf(LCAddress_B), dec(2, 18))
      assert.equal(await stblToken.balanceOf(LCAddress_C), dec(3, 18))
      assert.equal(await stblToken.balanceOf(LCAddress_D), dec(4, 18))
      assert.equal(await stblToken.balanceOf(LCAddress_E), dec(5, 18))
    })

    // can't transfer STBL to any LCs that were deployed directly
  })

  describe('Withdrawal attempts on funded, inactive LCs immediately after funding', async accounts => {
    it("Beneficiary can't withdraw from their funded LC", async () => {
      // Deploy 3 LCs
      const deployedLCtx_A = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_C = await lockupContractFactory.deployLockupContract(C, oneYearFromSystemDeployment, { from: liquityAG })

      // Grab contract objects from deployment tx events
      const LC_A = await th.getLCFromDeploymentTx(deployedLCtx_A)
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)
      const LC_C = await th.getLCFromDeploymentTx(deployedLCtx_C)

      // Multisig transfers STBL to each LC
      await stblToken.transfer(LC_A.address, STBLEntitlement_A, { from: multisig })
      await stblToken.transfer(LC_B.address, STBLEntitlement_B, { from: multisig })
      await stblToken.transfer(LC_C.address, STBLEntitlement_C, { from: multisig })

      assert.equal(await stblToken.balanceOf(LC_A.address), STBLEntitlement_A)
      assert.equal(await stblToken.balanceOf(LC_B.address), STBLEntitlement_B)
      assert.equal(await stblToken.balanceOf(LC_C.address), STBLEntitlement_C)

      const LCs = [LC_A, LC_B, LC_C]

      // Beneficiary attempts to withdraw
      for (LC of LCs) {
        try {
          const beneficiary = await LC.beneficiary()
          const withdrawalAttemptTx = await LC.withdrawSTBL({ from: beneficiary })
          assert.isFalse(withdrawalAttemptTx.receipt.status)
        } catch (error) {
          assert.include(error.message, "revert")
        }
      }
    })

    it("STBL multisig can't withraw from a LC which it funded", async () => {
      // Deploy 3 LCs
      const deployedLCtx_A = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_C = await lockupContractFactory.deployLockupContract(C, oneYearFromSystemDeployment, { from: liquityAG })

      // Grab contract objects from deployment tx events
      const LC_A = await th.getLCFromDeploymentTx(deployedLCtx_A)
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)
      const LC_C = await th.getLCFromDeploymentTx(deployedLCtx_C)

      // Multisig transfers STBL to each LC
      await stblToken.transfer(LC_A.address, STBLEntitlement_A, { from: multisig })
      await stblToken.transfer(LC_B.address, STBLEntitlement_B, { from: multisig })
      await stblToken.transfer(LC_C.address, STBLEntitlement_C, { from: multisig })

      assert.equal(await stblToken.balanceOf(LC_A.address), STBLEntitlement_A)
      assert.equal(await stblToken.balanceOf(LC_B.address), STBLEntitlement_B)
      assert.equal(await stblToken.balanceOf(LC_C.address), STBLEntitlement_C)

      const LCs = [LC_A, LC_B, LC_C]

      // STBL multisig attempts to withdraw from LCs
      for (LC of LCs) {
        try {
          const withdrawalAttemptTx = await LC.withdrawSTBL({ from: multisig })
          assert.isFalse(withdrawalAttemptTx.receipt.status)
        } catch (error) {
          assert.include(error.message, "revert")
        }
      }
    })

    it("No one can withraw from a LC", async () => {
      // Deploy 3 LCs
      const deployedLCtx_A = await lockupContractFactory.deployLockupContract(A, STBLEntitlement_A, { from: D })

      // Grab contract objects from deployment tx events
      const LC_A = await th.getLCFromDeploymentTx(deployedLCtx_A)

      // LiquityAG transfers STBL to the LC
      await stblToken.transfer(LC_A.address, STBLEntitlement_A, { from: multisig })

      assert.equal(await stblToken.balanceOf(LC_A.address), STBLEntitlement_A)


      // Various EOAs attempt to withdraw from LCs
      try {
        const withdrawalAttemptTx = await LC_A.withdrawSTBL({ from: G })
        assert.isFalse(withdrawalAttemptTx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      try {
        const withdrawalAttemptTx = await LC_A.withdrawSTBL({ from: H })
        assert.isFalse(withdrawalAttemptTx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      try {
        const withdrawalAttemptTx = await LC_A.withdrawSTBL({ from: I })
        assert.isFalse(withdrawalAttemptTx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })
  })
})