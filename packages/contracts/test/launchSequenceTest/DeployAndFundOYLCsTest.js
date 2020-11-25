const OneYearLockupContract = artifacts.require("./OneYearLockupContract.sol")
const CustomDurationLockupContract = artifacts.require("./CustomDurationLockupContract.sol")

const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec

contract('Deploying and funding One Year Lockup Contracts', async accounts => {
  const [liquityAG, A, B, C, D, E, F, G, H, I, J] = accounts;

  const SECONDS_IN_ONE_MONTH = timeValues.SECONDS_IN_ONE_MONTH

  let LQTYContracts

  // 1e24 = 1 million tokens with 18 decimal digits
  const LQTYEntitlement_A = dec(1, 24)
  const LQTYEntitlement_B = dec(2, 24)
  const LQTYEntitlement_C = dec(3, 24)
  const LQTYEntitlement_D = dec(4, 24)
  const LQTYEntitlement_E = dec(5, 24)

  before(async () => {
    // Deploy all contracts from the first account
    LQTYContracts = await deploymentHelper.deployLQTYContracts()
    await deploymentHelper.connectLQTYContracts(LQTYContracts)

    lqtyStaking = LQTYContracts.lqtyStaking
    growthToken = LQTYContracts.growthToken
    communityIssuance = LQTYContracts.communityIssuance
    lockupContractFactory = LQTYContracts.lockupContractFactory
  })

  describe('Deploying OYLCs', async accounts => {
    it("LQTY Deployer can deploy OYLCs through the Factory", async () => {
      // LQTY deployer deploys CDLCs
      const OYLCDeploymentTx_A = await lockupContractFactory.deployOneYearLockupContract(A, dec(1, 18), { from: liquityAG })
      const OYLCDeploymentTx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(1, 18), { from: liquityAG })
      const OYLCDeploymentTx_C = await lockupContractFactory.deployOneYearLockupContract(C, '9595995999999900000023423234', { from: liquityAG })

      assert.isTrue(OYLCDeploymentTx_A.receipt.status)
      assert.isTrue(OYLCDeploymentTx_B.receipt.status)
      assert.isTrue(OYLCDeploymentTx_C.receipt.status)
    })

    it("Anyone can deploy OYLCs through the Factory", async () => {
      // Various EOAs deploy CDLCs
      const OYLCDeploymentTx_1 = await lockupContractFactory.deployOneYearLockupContract(A, dec(1, 18), { from: G })
      const OYLCDeploymentTx_2 = await lockupContractFactory.deployOneYearLockupContract(C, dec(1, 18), { from: H })
      const OYLCDeploymentTx_3 = await lockupContractFactory.deployOneYearLockupContract(liquityAG, '9595995999999900000023423234', { from: I })
      const OYLCDeploymentTx_4 = await lockupContractFactory.deployOneYearLockupContract(D, '123', { from: J })

      assert.isTrue(OYLCDeploymentTx_1.receipt.status)
      assert.isTrue(OYLCDeploymentTx_2.receipt.status)
      assert.isTrue(OYLCDeploymentTx_3.receipt.status)
      assert.isTrue(OYLCDeploymentTx_4.receipt.status)
    })

    it("LQTY Deployer can deploy OYLCs directly", async () => {
      // LQTY deployer deploys CDLCs
      const OYLC_A = await OneYearLockupContract.new(growthToken.address, A, dec(1, 18), { from: liquityAG })
      const OYLC_A_txReceipt = await web3.eth.getTransactionReceipt(OYLC_A.transactionHash)

      const OYLC_B = await OneYearLockupContract.new(growthToken.address, B, dec(2, 18), { from: liquityAG })
      const OYLC_B_txReceipt = await web3.eth.getTransactionReceipt(OYLC_B.transactionHash)

      const OYLC_C = await OneYearLockupContract.new(growthToken.address, C, dec(3, 18), { from: liquityAG })
      const OYLC_C_txReceipt = await web3.eth.getTransactionReceipt(OYLC_C.transactionHash)

      // Check deployment succeeded
      assert.isTrue(OYLC_A_txReceipt.status)
      assert.isTrue(OYLC_B_txReceipt.status)
      assert.isTrue(OYLC_C_txReceipt.status)
    })

    it("Anyone can deploy OYLCs directly", async () => {
      // Various EOAs deploy OYLCs
      const OYLC_A = await OneYearLockupContract.new(growthToken.address, A, dec(1, 18), { from: D })
      const OYLC_A_txReceipt = await web3.eth.getTransactionReceipt(OYLC_A.transactionHash)

      const OYLC_B = await OneYearLockupContract.new(growthToken.address, B, dec(2, 18), { from: E })
      const OYLC_B_txReceipt = await web3.eth.getTransactionReceipt(OYLC_B.transactionHash)

      const OYLC_C = await OneYearLockupContract.new(growthToken.address, C, dec(3, 18), { from: F })
      const OYLC_C_txReceipt = await web3.eth.getTransactionReceipt(OYLC_C.transactionHash)

      // Check deployment succeeded
      assert.isTrue(OYLC_A_txReceipt.status)
      assert.isTrue(OYLC_B_txReceipt.status)
      assert.isTrue(OYLC_C_txReceipt.status)
    })

    it("OYLC deployed through the Factory stores Factory's address in the OYLC", async () => {
      // Deploy 5 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, LQTYEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, LQTYEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, LQTYEntitlement_C, { from: liquityAG })
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, LQTYEntitlement_D, { from: liquityAG })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, LQTYEntitlement_E, { from: liquityAG })

      const OYLC_A = await th.getOYLCFromDeploymentTx(deployedOYLCtx_A)
      const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)
      const OYLC_C = await th.getOYLCFromDeploymentTx(deployedOYLCtx_C)
      const OYLC_D = await th.getOYLCFromDeploymentTx(deployedOYLCtx_D)
      const OYLC_E = await th.getOYLCFromDeploymentTx(deployedOYLCtx_E)

      const storedDeployerAddress_A = await OYLC_A.deployer()
      const storedDeployerAddress_B = await OYLC_B.deployer()
      const storedDeployerAddress_C = await OYLC_C.deployer()
      const storedDeployerAddress_D = await OYLC_D.deployer()
      const storedDeployerAddress_E = await OYLC_E.deployer()

      assert.equal(lockupContractFactory.address, storedDeployerAddress_A)
      assert.equal(lockupContractFactory.address, storedDeployerAddress_B)
      assert.equal(lockupContractFactory.address, storedDeployerAddress_C)
      assert.equal(lockupContractFactory.address, storedDeployerAddress_D)
      assert.equal(lockupContractFactory.address, storedDeployerAddress_E)
    })

    it("OYLC deployment stores the beneficiary's address in the OYLC", async () => {
      // Deploy 5 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, LQTYEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, LQTYEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, LQTYEntitlement_C, { from: liquityAG })
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, LQTYEntitlement_D, { from: liquityAG })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, LQTYEntitlement_E, { from: liquityAG })

      // Grab contracts from deployment tx events
      const OYLC_A = await th.getOYLCFromDeploymentTx(deployedOYLCtx_A)
      const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)
      const OYLC_C = await th.getOYLCFromDeploymentTx(deployedOYLCtx_C)
      const OYLC_D = await th.getOYLCFromDeploymentTx(deployedOYLCtx_D)
      const OYLC_E = await th.getOYLCFromDeploymentTx(deployedOYLCtx_E)

      const storedBeneficiaryAddress_A = await OYLC_A.beneficiary()
      const storedBeneficiaryAddress_B = await OYLC_B.beneficiary()
      const storedBeneficiaryAddress_C = await OYLC_C.beneficiary()
      const storedBeneficiaryAddress_D = await OYLC_D.beneficiary()
      const storedBeneficiaryAddress_E = await OYLC_E.beneficiary()

      assert.equal(A, storedBeneficiaryAddress_A)
      assert.equal(B, storedBeneficiaryAddress_B)
      assert.equal(C, storedBeneficiaryAddress_C)
      assert.equal(D, storedBeneficiaryAddress_D)
      assert.equal(E, storedBeneficiaryAddress_E)
    })

    it("OYLC deployment records the beneficiary's initial entitlement in the OYLC", async () => {
      // Deploy 5 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, LQTYEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, LQTYEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, LQTYEntitlement_C, { from: liquityAG })
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, LQTYEntitlement_D, { from: liquityAG })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, LQTYEntitlement_E, { from: liquityAG })

      // Grab contracts from deployment tx events
      const OYLC_A = await th.getOYLCFromDeploymentTx(deployedOYLCtx_A)
      const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)
      const OYLC_C = await th.getOYLCFromDeploymentTx(deployedOYLCtx_C)
      const OYLC_D = await th.getOYLCFromDeploymentTx(deployedOYLCtx_D)
      const OYLC_E = await th.getOYLCFromDeploymentTx(deployedOYLCtx_E)

      const recordedInitialEntitlement_A = await OYLC_A.initialEntitlement()
      const recordedInitialEntitlement_B = await OYLC_B.initialEntitlement()
      const recordedInitialEntitlement_C = await OYLC_C.initialEntitlement()
      const recordedInitialEntitlement_D = await OYLC_D.initialEntitlement()
      const recordedInitialEntitlement_E = await OYLC_E.initialEntitlement()

      assert.equal(LQTYEntitlement_A, recordedInitialEntitlement_A)
      assert.equal(LQTYEntitlement_B, recordedInitialEntitlement_B)
      assert.equal(LQTYEntitlement_C, recordedInitialEntitlement_C)
      assert.equal(LQTYEntitlement_D, recordedInitialEntitlement_D)
      assert.equal(LQTYEntitlement_E, recordedInitialEntitlement_E)
    })

    it("OYLC deployment through the Factory registers the OYLC in the Factory", async () => {
      // Deploy 5 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, LQTYEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, LQTYEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, LQTYEntitlement_C, { from: liquityAG })
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, LQTYEntitlement_D, { from: liquityAG })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, LQTYEntitlement_E, { from: liquityAG })

      // Grab contract addresses from deployment tx events
      const OYLCAddress_A = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_A)
      const OYLCAddress_B = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_B)
      const OYLCAddress_C = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_C)
      const OYLCAddress_D = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_D)
      const OYLCAddress_E = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_E)

      assert.isTrue(await lockupContractFactory.isRegisteredOneYearLockup(OYLCAddress_A))
      assert.isTrue(await lockupContractFactory.isRegisteredOneYearLockup(OYLCAddress_B))
      assert.isTrue(await lockupContractFactory.isRegisteredOneYearLockup(OYLCAddress_C))
      assert.isTrue(await lockupContractFactory.isRegisteredOneYearLockup(OYLCAddress_D))
      assert.isTrue(await lockupContractFactory.isRegisteredOneYearLockup(OYLCAddress_E))
    })

    it("OYLC deployment through the Factory records the OYLC contract address and deployer as a k-v pair in the Factory", async () => {
      // Deploy 5 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, LQTYEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, LQTYEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, LQTYEntitlement_C, { from: liquityAG })
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, LQTYEntitlement_D, { from: liquityAG })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, LQTYEntitlement_E, { from: liquityAG })

      // Grab contract addresses from deployment tx events
      const OYLCAddress_A = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_A)
      const OYLCAddress_B = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_B)
      const OYLCAddress_C = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_C)
      const OYLCAddress_D = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_D)
      const OYLCAddress_E = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_E)

      assert.equal(liquityAG, await lockupContractFactory.oneYearLockupContractToDeployer(OYLCAddress_A))
      assert.equal(liquityAG, await lockupContractFactory.oneYearLockupContractToDeployer(OYLCAddress_B))
      assert.equal(liquityAG, await lockupContractFactory.oneYearLockupContractToDeployer(OYLCAddress_C))
      assert.equal(liquityAG, await lockupContractFactory.oneYearLockupContractToDeployer(OYLCAddress_D))
      assert.equal(liquityAG, await lockupContractFactory.oneYearLockupContractToDeployer(OYLCAddress_E))
    })
  })

  describe('Funding OYLCs', async accounts => {
    it("LQTY transfer from LQTY deployer to their deployed OYLC increases the LQTY balance of the OYLC", async () => {
      // Deploy 5 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, LQTYEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, LQTYEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, LQTYEntitlement_C, { from: liquityAG })
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, LQTYEntitlement_D, { from: liquityAG })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, LQTYEntitlement_E, { from: liquityAG })

      // Grab contract addresses from deployment tx events
      const OYLCAddress_A = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_A)
      const OYLCAddress_B = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_B)
      const OYLCAddress_C = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_C)
      const OYLCAddress_D = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_D)
      const OYLCAddress_E = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_E)

      assert.equal(await growthToken.balanceOf(OYLCAddress_A), '0')
      assert.equal(await growthToken.balanceOf(OYLCAddress_B), '0')
      assert.equal(await growthToken.balanceOf(OYLCAddress_C), '0')
      assert.equal(await growthToken.balanceOf(OYLCAddress_D), '0')
      assert.equal(await growthToken.balanceOf(OYLCAddress_E), '0')

      // LiquityAG transfers LQTY to each OYLC
      await growthToken.transfer(OYLCAddress_A, LQTYEntitlement_A, { from: liquityAG })
      await growthToken.transfer(OYLCAddress_B, LQTYEntitlement_B, { from: liquityAG })
      await growthToken.transfer(OYLCAddress_C, LQTYEntitlement_C, { from: liquityAG })
      await growthToken.transfer(OYLCAddress_D, LQTYEntitlement_D, { from: liquityAG })
      await growthToken.transfer(OYLCAddress_E, LQTYEntitlement_E, { from: liquityAG })

      assert.equal(await growthToken.balanceOf(OYLCAddress_A), LQTYEntitlement_A)
      assert.equal(await growthToken.balanceOf(OYLCAddress_B), LQTYEntitlement_B)
      assert.equal(await growthToken.balanceOf(OYLCAddress_C), LQTYEntitlement_C)
      assert.equal(await growthToken.balanceOf(OYLCAddress_D), LQTYEntitlement_D)
      assert.equal(await growthToken.balanceOf(OYLCAddress_E), LQTYEntitlement_E)
    })

    it("LQTY Deployer can transfer LQTY to OYLCs deployed by anyone", async () => {  // Deploy 5 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, LQTYEntitlement_A, { from: F })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, LQTYEntitlement_B, { from: G })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, LQTYEntitlement_C, { from: H })
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, LQTYEntitlement_D, { from: I })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, LQTYEntitlement_E, { from: J })

      // Grab contract addresses from deployment tx events
      const OYLCAddress_A = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_A)
      const OYLCAddress_B = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_B)
      const OYLCAddress_C = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_C)
      const OYLCAddress_D = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_D)
      const OYLCAddress_E = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_E)

      assert.equal(await growthToken.balanceOf(OYLCAddress_A), '0')
      assert.equal(await growthToken.balanceOf(OYLCAddress_B), '0')
      assert.equal(await growthToken.balanceOf(OYLCAddress_C), '0')
      assert.equal(await growthToken.balanceOf(OYLCAddress_D), '0')
      assert.equal(await growthToken.balanceOf(OYLCAddress_E), '0')

      // Liquity AG transfers LQTY to each OYLC
      await growthToken.transfer(OYLCAddress_A, dec(1, 18), { from: liquityAG })
      await growthToken.transfer(OYLCAddress_B, dec(2, 18), { from: liquityAG })
      await growthToken.transfer(OYLCAddress_C, dec(3, 18), { from: liquityAG })
      await growthToken.transfer(OYLCAddress_D, dec(4, 18), { from: liquityAG })
      await growthToken.transfer(OYLCAddress_E, dec(5, 18), { from: liquityAG })

      assert.equal(await growthToken.balanceOf(OYLCAddress_A), dec(1, 18))
      assert.equal(await growthToken.balanceOf(OYLCAddress_B), dec(2, 18))
      assert.equal(await growthToken.balanceOf(OYLCAddress_C), dec(3, 18))
      assert.equal(await growthToken.balanceOf(OYLCAddress_D), dec(4, 18))
      assert.equal(await growthToken.balanceOf(OYLCAddress_E), dec(5, 18))
    })
  })

  describe('Withdrawal attempts on funded, inactive OYLCs', async accounts => {
    it("Beneficiary can't withdraw from their funded inactive OYLC", async () => {
      // Deploy 3 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, LQTYEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, LQTYEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, LQTYEntitlement_C, { from: liquityAG })

      // Grab contract objects from deployment tx events
      const OYLC_A = await th.getOYLCFromDeploymentTx(deployedOYLCtx_A)
      const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)
      const OYLC_C = await th.getOYLCFromDeploymentTx(deployedOYLCtx_C)

      // LiquityAG transfers LQTY to each OYLC
      await growthToken.transfer(OYLC_A.address, LQTYEntitlement_A, { from: liquityAG })
      await growthToken.transfer(OYLC_B.address, LQTYEntitlement_B, { from: liquityAG })
      await growthToken.transfer(OYLC_C.address, LQTYEntitlement_C, { from: liquityAG })

      assert.equal(await growthToken.balanceOf(OYLC_A.address), LQTYEntitlement_A)
      assert.equal(await growthToken.balanceOf(OYLC_B.address), LQTYEntitlement_B)
      assert.equal(await growthToken.balanceOf(OYLC_C.address), LQTYEntitlement_C)

      assert.isFalse(await OYLC_A.active())
      assert.isFalse(await OYLC_B.active())
      assert.isFalse(await OYLC_C.active())

      const OYLCs = [OYLC_A, OYLC_B, OYLC_C]

      // Beneficiary attempts to withdraw
      for (OYLC of OYLCs) {
        try {
          const beneficiary = await OYLC.beneficiary()
          const withdrawalAttemptTx = await OYLC.withdrawLQTY({ from: beneficiary })
          assert.isFalse(withdrawalAttemptTx.receipt.status)
        } catch (error) {
          assert.include(error.message, "revert")
        }
      }
    })

    it("LQTY deployer can't withraw from an inactive OYLC they funded", async () => {
      // Deploy 3 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, LQTYEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, LQTYEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, LQTYEntitlement_C, { from: liquityAG })

      // Grab contract objects from deployment tx events
      const OYLC_A = await th.getOYLCFromDeploymentTx(deployedOYLCtx_A)
      const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)
      const OYLC_C = await th.getOYLCFromDeploymentTx(deployedOYLCtx_C)

      // LiquityAG transfers LQTY to each OYLC
      await growthToken.transfer(OYLC_A.address, LQTYEntitlement_A, { from: liquityAG })
      await growthToken.transfer(OYLC_B.address, LQTYEntitlement_B, { from: liquityAG })
      await growthToken.transfer(OYLC_C.address, LQTYEntitlement_C, { from: liquityAG })

      assert.equal(await growthToken.balanceOf(OYLC_A.address), LQTYEntitlement_A)
      assert.equal(await growthToken.balanceOf(OYLC_B.address), LQTYEntitlement_B)
      assert.equal(await growthToken.balanceOf(OYLC_C.address), LQTYEntitlement_C)

      assert.isFalse(await OYLC_A.active())
      assert.isFalse(await OYLC_B.active())
      assert.isFalse(await OYLC_C.active())

      const OYLCs = [OYLC_A, OYLC_B, OYLC_C]

      // LQTY deployer attempts to withdraw from OYLCs
      for (OYLC of OYLCs) {
        try {
          const withdrawalAttemptTx = await OYLC.withdrawLQTY({ from: liquityAG })
          assert.isFalse(withdrawalAttemptTx.receipt.status)
        } catch (error) {
          assert.include(error.message, "revert")
        }
      }
    })

    it("No one can withraw from an inactive OYLC", async () => {
      // Deploy 3 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, LQTYEntitlement_A, { from: D })

      // Grab contract objects from deployment tx events
      const OYLC_A = await th.getOYLCFromDeploymentTx(deployedOYLCtx_A)

      // LiquityAG transfers LQTY to the OYLC
      await growthToken.transfer(OYLC_A.address, LQTYEntitlement_A, { from: liquityAG })

      assert.equal(await growthToken.balanceOf(OYLC_A.address), LQTYEntitlement_A)

      assert.isFalse(await OYLC_A.active())

      // Various EOAs attempt to withdraw from OYLCs
      try {
        const withdrawalAttemptTx = await OYLC_A.withdrawLQTY({ from: G })
        assert.isFalse(withdrawalAttemptTx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      try {
        const withdrawalAttemptTx = await OYLC_A.withdrawLQTY({ from: H })
        assert.isFalse(withdrawalAttemptTx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      try {
        const withdrawalAttemptTx = await OYLC_A.withdrawLQTY({ from: I })
        assert.isFalse(withdrawalAttemptTx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })
  })

  describe('Locking OYLCs', async accounts => {
    it("LQTY deployer can lock, via the Factory, all the OYLCs that they deployed", async () => {
      // Deploy 5 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, LQTYEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, LQTYEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, LQTYEntitlement_C, { from: liquityAG })
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, LQTYEntitlement_D, { from: liquityAG })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, LQTYEntitlement_E, { from: liquityAG })

      // Grab contracts from deployment tx events
      const OYLC_A = await th.getOYLCFromDeploymentTx(deployedOYLCtx_A)
      const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)
      const OYLC_C = await th.getOYLCFromDeploymentTx(deployedOYLCtx_C)
      const OYLC_D = await th.getOYLCFromDeploymentTx(deployedOYLCtx_D)
      const OYLC_E = await th.getOYLCFromDeploymentTx(deployedOYLCtx_E)

      // Grab contract addresses from deployment tx events
      const OYLCAddress_A = OYLC_A.address
      const OYLCAddress_B = OYLC_B.address
      const OYLCAddress_C = OYLC_C.address
      const OYLCAddress_D = OYLC_D.address
      const OYLCAddress_E = OYLC_E.address

      const listOfOYLCsToLock = [
        OYLCAddress_A,
        OYLCAddress_B,
        OYLCAddress_C,
        OYLCAddress_D,
        OYLCAddress_E
      ]

      // LiquityAG transfers LQTY to each OYLC
      await growthToken.transfer(OYLCAddress_A, LQTYEntitlement_A, { from: liquityAG })
      await growthToken.transfer(OYLCAddress_B, LQTYEntitlement_B, { from: liquityAG })
      await growthToken.transfer(OYLCAddress_C, LQTYEntitlement_C, { from: liquityAG })
      await growthToken.transfer(OYLCAddress_D, LQTYEntitlement_D, { from: liquityAG })
      await growthToken.transfer(OYLCAddress_E, LQTYEntitlement_E, { from: liquityAG })

      // Check OYLCs are inactive
      assert.isFalse(await OYLC_A.active())
      assert.isFalse(await OYLC_B.active())
      assert.isFalse(await OYLC_C.active())
      assert.isFalse(await OYLC_D.active())
      assert.isFalse(await OYLC_E.active())

      // LQTY deployer locks the OYLCs they deployed
      await lockupContractFactory.lockOneYearContracts(listOfOYLCsToLock, { from: liquityAG })

      // Check OYLCs are now active (locked)
      assert.isTrue(await OYLC_A.active())
      assert.isTrue(await OYLC_B.active())
      assert.isTrue(await OYLC_C.active())
      assert.isTrue(await OYLC_D.active())
      assert.isTrue(await OYLC_E.active())
    })

    it("Records the lockup start time on the OYLC", async () => {
      // Deploy 3 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, LQTYEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, LQTYEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, LQTYEntitlement_C, { from: liquityAG })

      // Grab contracts from deployment tx events
      const OYLC_A = await th.getOYLCFromDeploymentTx(deployedOYLCtx_A)
      const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)
      const OYLC_C = await th.getOYLCFromDeploymentTx(deployedOYLCtx_C)

      const OYLCAddress_A = OYLC_A.address
      const OYLCAddress_B = OYLC_B.address
      const OYLCAddress_C = OYLC_C.address

      // LiquityAG transfers LQTY to each OYLC
      await growthToken.transfer(OYLCAddress_A, LQTYEntitlement_A, { from: liquityAG })
      await growthToken.transfer(OYLCAddress_B, LQTYEntitlement_B, { from: liquityAG })
      await growthToken.transfer(OYLCAddress_C, LQTYEntitlement_C, { from: liquityAG })

      // LiquityAG  locks the OYLCs they deployed
      const lockingTx_1 = await lockupContractFactory.lockOneYearContracts([OYLCAddress_A, OYLCAddress_B, OYLCAddress_C], { from: liquityAG })

      const lockupTxTimestamp_1 = await th.getTimestampFromTx(lockingTx_1, web3)

      // Get recorded lockup start times
      const lockupStartTime_A = (await OYLC_A.lockupStartTime()).toString()
      const lockupStartTime_B = (await OYLC_B.lockupStartTime()).toString()
      const lockupStartTime_C = (await OYLC_C.lockupStartTime()).toString()

      // Check lockup start times equal the timestamp of the lockup transaction
      assert.equal(lockupTxTimestamp_1, lockupStartTime_A)
      assert.equal(lockupTxTimestamp_1, lockupStartTime_B)
      assert.equal(lockupTxTimestamp_1, lockupStartTime_C)

      // --- Fast forward time one month ---

      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Deploy 2 more OYLCs, D and E
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, LQTYEntitlement_D, { from: liquityAG })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, LQTYEntitlement_E, { from: liquityAG })

      // Grab contracts from deployment tx events
      const OYLC_D = await th.getOYLCFromDeploymentTx(deployedOYLCtx_D)
      const OYLC_E = await th.getOYLCFromDeploymentTx(deployedOYLCtx_E)

      const OYLCAddress_D = OYLC_D.address
      const OYLCAddress_E = OYLC_E.address

      // LiquityAG transfers LQTY to each OYLC
      await growthToken.transfer(OYLCAddress_D, LQTYEntitlement_D, { from: liquityAG })
      await growthToken.transfer(OYLCAddress_E, LQTYEntitlement_E, { from: liquityAG })

      //LiquityAG locks OYLCs D and E
      const lockingTx_2 = await lockupContractFactory.lockOneYearContracts([OYLCAddress_D, OYLCAddress_E], { from: liquityAG })

      const lockupTxTimestamp_2 = await th.getTimestampFromTx(lockingTx_2, web3)

      // Get recorded lockup start times
      const lockupStartTime_D = (await OYLC_D.lockupStartTime()).toString()
      const lockupStartTime_E = (await OYLC_E.lockupStartTime()).toString()

      // Check lockup start times of D and E equal the timestamp of the lockup transaction
      assert.equal(lockupTxTimestamp_2, lockupStartTime_D)
      assert.equal(lockupTxTimestamp_2, lockupStartTime_E)
    })

    it("Locking reverts if caller is not the deployer", async () => {
      // Deploy 2 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, LQTYEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, LQTYEntitlement_B, { from: C })

      // Grab contracts from deployment tx events
      const OYLC_A = await th.getOYLCFromDeploymentTx(deployedOYLCtx_A)
      const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)

      // LQTY deployer transfers LQTY to both OYLCs
      await growthToken.transfer(OYLC_A.address, LQTYEntitlement_A, { from: liquityAG })

      // Check OYLC is inactive
      assert.isFalse(await OYLC_A.active())

      const variousAccounts = [A, B, D, E, F, G, H, I, J]

      // Various EOAs try to lock OYLC_A via Factory
      for (account of variousAccounts) {
        try {
          const lockingAttemptTx = await lockupContractFactory.lockOneYearContracts([OYLC_A.address], { from: account })
          assert.isFalse(lockingAttemptTx.receipt.status)
        } catch (error) {
          assert.include(error.message, "revert")
        }
      }

       // Various EOAs try to lock OYLC_B via Factory
       for (account of variousAccounts) {
        try {
          const lockingAttemptTx = await lockupContractFactory.lockOneYearContracts([OYLC_B.address], { from: account })
          assert.isFalse(lockingAttemptTx.receipt.status)
        } catch (error) {
          assert.include(error.message, "revert")
        }
      }
    })
  })

  describe('Deploying CDLCs', async accounts => {
    it("No one can deploy CDLCs through the factory", async () => {
      try {
        const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, LQTYEntitlement_A, SECONDS_IN_ONE_MONTH, { from: liquityAG })
        assert.isFalse(deployedCDLCtx_A.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      try {
        const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, LQTYEntitlement_B, SECONDS_IN_ONE_MONTH, { from: B })
        assert.isFalse(deployedCDLCtx_B.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      try {
        const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, LQTYEntitlement_C, SECONDS_IN_ONE_MONTH, { from: G })
        assert.isFalse(deployedCDLCtx_C.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })

    it("Anyone can deploy CDLCs directly", async () => {
      // Various EOAs deploy CDLCs
      const CDLC_A = await CustomDurationLockupContract.new(growthToken.address, A, LQTYEntitlement_A, SECONDS_IN_ONE_MONTH, { from: D })
      const CDLC_A_txReceipt = await web3.eth.getTransactionReceipt(CDLC_A.transactionHash)

      const CDLC_B = await CustomDurationLockupContract.new(growthToken.address, B, LQTYEntitlement_B, SECONDS_IN_ONE_MONTH, { from: E })
      const CDLC_B_txReceipt = await web3.eth.getTransactionReceipt(CDLC_B.transactionHash)

      const CDLC_C = await CustomDurationLockupContract.new(growthToken.address, C, LQTYEntitlement_C, SECONDS_IN_ONE_MONTH, { from: F })
      const CDLC_C_txReceipt = await web3.eth.getTransactionReceipt(CDLC_C.transactionHash)

      // Check deployment succeeded
      assert.isTrue(CDLC_A_txReceipt.status)
      assert.isTrue(CDLC_B_txReceipt.status)
      assert.isTrue(CDLC_C_txReceipt.status)
    })
  })
})