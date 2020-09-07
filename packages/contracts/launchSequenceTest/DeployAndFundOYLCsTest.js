const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper
const mv = testHelpers.MoneyValues

contract('Deploying and funding GT contracts', async accounts => {
  const [liquityAG, A, B, C, D, E, F, G, H, I, J] = accounts;

  const ONE_MONTH_IN_SECONDS = 2592000
  const ONE_YEAR_IN_SECONDS = 31536000

  let GTContracts

  // 1e24 = 1 million tokens with 18 decimal digits
  const GTEntitlement_A = mv._1e24
  const GTEntitlement_B = mv._2e24
  const GTEntitlement_C = mv._3e24
  const GTEntitlement_E = mv._4e24
  const GTEntitlement_D = mv._5e24

  before(async () => {
    // Deploy all contracts from the first account
    GTContracts = await deploymentHelper.deployGTContracts()
    await deploymentHelper.connectGTContracts(GTContracts)

    gtStaking = GTContracts.gtStaking
    growthToken = GTContracts.growthToken
    communityIssuance = GTContracts.communityIssuance
    lockupContractFactory = GTContracts.lockupContractFactory
  })

  describe('Deploying OYLCs', async accounts => {
    it.only("GT Deployer can deploy OYLCs", async () => {
      // GT deployer deploys CDLCs
      const OYLCDeploymentTx_A = await lockupContractFactory.deployOneYearLockupContract(A, mv._1e18, { from: liquityAG })
      const OYLCDeploymentTx_B = await lockupContractFactory.deployOneYearLockupContract(B, mv._1e18, { from: liquityAG })
      const OYLCDeploymentTx_C = await lockupContractFactory.deployOneYearLockupContract(C, '9595995999999900000023423234', { from: liquityAG })

      assert.isTrue(OYLCDeploymentTx_A.receipt.status)
      assert.isTrue(OYLCDeploymentTx_B.receipt.status)
      assert.isTrue(OYLCDeploymentTx_C.receipt.status)
    })

    it.only("Anyone can deploy OYLCs", async () => {
      // Various EOAs deploy CDLCs
      const OYLCDeploymentTx_1 = await lockupContractFactory.deployOneYearLockupContract(A, mv._1e18, { from: teamMember_1 })
      const OYLCDeploymentTx_2 = await lockupContractFactory.deployOneYearLockupContract(C, mv._1e18,  { from: investor_2 })
      const OYLCDeploymentTx_3 = await lockupContractFactory.deployOneYearLockupContract(liquityAG, '9595995999999900000023423234', { from: A })
      const OYLCDeploymentTx_4 = await lockupContractFactory.deployOneYearLockupContract(D, '123', { from: B })

      assert.isTrue(OYLCDeploymentTx_1.receipt.status)
      assert.isTrue(OYLCDeploymentTx_2.receipt.status)
      assert.isTrue(OYLCDeploymentTx_3.receipt.status)
      assert.isTrue(OYLCDeploymentTx_4.receipt.status)
    })

    it.only("OYLC deployed through the Factory stores Factory's address in the OYLC", async () => {
      // Deploy 5 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, GTEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, GTEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, GTEntitlement_C, { from: liquityAG })
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, GTEntitlement_D, { from: liquityAG })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, GTEntitlement_E, { from: liquityAG })

      const OYLC_A = await th.getOYLCFromDeploymentTx(deployedOYLCtx_A)
      const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)
      const OYLC_C = await th.getOYLCFromDeploymentTx(deployedOYLCtx_C)
      const OYLC_D = await th.getOYLCFromDeploymentTx(deployedOYLCtx_D)
      const OYLC_E = await th.getOYLCFromDeploymentTx(deployedOYLCtx_E)

      const storedDeployerAddress_A = await OYLC_A.lockupDeployer()
      const storedDeployerAddress_B = await OYLC_B.lockupDeployer()
      const storedDeployerAddress_C = await OYLC_C.lockupDeployer()
      const storedDeployerAddress_D = await OYLC_D.lockupDeployer()
      const storedDeployerAddress_E = await OYLC_E.lockupDeployer()

      assert.equal(lockupContractFactory.address, storedDeployerAddress_A)
      assert.equal(lockupContractFactory.address, storedDeployerAddress_B)
      assert.equal(lockupContractFactory.address, storedDeployerAddress_C)
      assert.equal(lockupContractFactory.address, storedDeployerAddress_D)
      assert.equal(lockupContractFactory.address, storedDeployerAddress_E)
    })

    it.only("OYLC deployment stores the beneficiary's address in the OYLC", async () => {
      // Deploy 5 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, GTEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, GTEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, GTEntitlement_C, { from: liquityAG })
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, GTEntitlement_D, { from: liquityAG })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, GTEntitlement_E, { from: liquityAG })

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

    it.only("OYLC deployment records the beneficiary's initial entitlement in the OYLC", async () => {
      // Deploy 5 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, GTEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, GTEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, GTEntitlement_C, { from: liquityAG })
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, GTEntitlement_D, { from: liquityAG })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, GTEntitlement_E, { from: liquityAG })

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

      assert.equal(GTEntitlement_A, recordedInitialEntitlement_A)
      assert.equal(GTEntitlement_B, recordedInitialEntitlement_B)
      assert.equal(GTEntitlement_C, recordedInitialEntitlement_C)
      assert.equal(GTEntitlement_D, recordedInitialEntitlement_D)
      assert.equal(GTEntitlement_E, recordedInitialEntitlement_E)
    })

    it.only("OYLC deployment through the Factory registers the OYLC in the Factory", async () => {
      // Deploy 5 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, GTEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, GTEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, GTEntitlement_C, { from: liquityAG })
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, GTEntitlement_D, { from: liquityAG })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, GTEntitlement_E, { from: liquityAG })

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

    it.only("OYLC deployment through the Factory records the OYLC contract address and deployer as a k-v pair in the Factory", async () => {
      // Deploy 5 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, GTEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, GTEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, GTEntitlement_C, { from: liquityAG })
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, GTEntitlement_D, { from: liquityAG })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, GTEntitlement_E, { from: liquityAG })

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
    it.only("GT transfer from GT deployer to their deployed OYLC increases the GT balance of the OYLC", async () => {
      // Deploy 5 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, GTEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, GTEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, GTEntitlement_C, { from: liquityAG })
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, GTEntitlement_D, { from: liquityAG })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, GTEntitlement_E, { from: liquityAG })

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

      // LiquityAG transfers GT to each OYLC
      await growthToken.transfer(OYLCAddress_A, GTEntitlement_A)
      await growthToken.transfer(OYLCAddress_B, GTEntitlement_B)
      await growthToken.transfer(OYLCAddress_C, GTEntitlement_C)
      await growthToken.transfer(OYLCAddress_D, GTEntitlement_D)
      await growthToken.transfer(OYLCAddress_E, GTEntitlement_E)

      assert.equal(await growthToken.balanceOf(OYLCAddress_A), GTEntitlement_A)
      assert.equal(await growthToken.balanceOf(OYLCAddress_B), GTEntitlement_B)
      assert.equal(await growthToken.balanceOf(OYLCAddress_C), GTEntitlement_C)
      assert.equal(await growthToken.balanceOf(OYLCAddress_D), GTEntitlement_D)
      assert.equal(await growthToken.balanceOf(OYLCAddress_E), GTEntitlement_E)
    })

    it.only("GT Deployer can transfer GT to OYLCs deployed by anyone", async () => {  // Deploy 5 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, GTEntitlement_A, { from: F })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, GTEntitlement_B, { from: G })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, GTEntitlement_C, { from: H })
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, GTEntitlement_D, { from: I })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, GTEntitlement_E, { from: J })

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


      await growthToken.transfer(OYLCAddress_A, mv._1e18)
      await growthToken.transfer(OYLCAddress_B, mv._2e18)
      await growthToken.transfer(OYLCAddress_C, mv._3e18)
      await growthToken.transfer(OYLCAddress_D, mv._4e18)
      await growthToken.transfer(OYLCAddress_E, mv._5e18)

      assert.equal(await growthToken.balanceOf(OYLCAddress_A), mv._1e18)
      assert.equal(await growthToken.balanceOf(OYLCAddress_B), mv._2e18)
      assert.equal(await growthToken.balanceOf(OYLCAddress_C), mv._3e18)
      assert.equal(await growthToken.balanceOf(OYLCAddress_D), mv._4e18)
      assert.equal(await growthToken.balanceOf(OYLCAddress_E), mv._5e18)
    })
  })

  describe('Locking OYLCs', async accounts => {
    it.only("GT deployer can lock, via the Factory, all the OYLCs that they deployed", async () => {
      // Deploy 5 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, GTEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, GTEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, GTEntitlement_C, { from: liquityAG })
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, GTEntitlement_D, { from: liquityAG })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, GTEntitlement_E, { from: liquityAG })

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

      // LiquityAG transfers GT to each OYLC
      await growthToken.transfer(OYLCAddress_A, GTEntitlement_A)
      await growthToken.transfer(OYLCAddress_B, GTEntitlement_B)
      await growthToken.transfer(OYLCAddress_C, GTEntitlement_C)
      await growthToken.transfer(OYLCAddress_D, GTEntitlement_D)
      await growthToken.transfer(OYLCAddress_E, GTEntitlement_E)

      // Check OYLCs are inactive
      assert.isFalse(await OYLC_A.active())
      assert.isFalse(await OYLC_B.active())
      assert.isFalse(await OYLC_C.active())
      assert.isFalse(await OYLC_D.active())
      assert.isFalse(await OYLC_E.active())

      // GT deployer locks the OYLCs they deployed
      await lockupContractFactory.lockOneYearContracts(listOfOYLCsToLock, { from: liquityAG })

      // Check OYLCs are now active (locked)
      assert.isTrue(await OYLC_A.active())
      assert.isTrue(await OYLC_B.active())
      assert.isTrue(await OYLC_C.active())
      assert.isTrue(await OYLC_D.active())
      assert.isTrue(await OYLC_E.active())
    })

    it.only("Records the lockup start time on the OYLC", async () => {
      // Deploy 3 OYLCs
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, GTEntitlement_A, { from: liquityAG })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, GTEntitlement_B, { from: liquityAG })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, GTEntitlement_C, { from: liquityAG })

      // Grab contracts from deployment tx events
      const OYLC_A = await th.getOYLCFromDeploymentTx(deployedOYLCtx_A)
      const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)
      const OYLC_C = await th.getOYLCFromDeploymentTx(deployedOYLCtx_C)

      const OYLCAddress_A = OYLC_A.address
      const OYLCAddress_B = OYLC_B.address
      const OYLCAddress_C = OYLC_C.address

      // LiquityAG transfers GT to each OYLC
      await growthToken.transfer(OYLCAddress_A, GTEntitlement_A)
      await growthToken.transfer(OYLCAddress_B, GTEntitlement_B)
      await growthToken.transfer(OYLCAddress_C, GTEntitlement_C)

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

      await th.fastForwardTime(ONE_MONTH_IN_SECONDS, web3.currentProvider)

      // Deploy 2 more OYLCs, D and E
      const deployedOYLCtx_D = await lockupContractFactory.deployOneYearLockupContract(A, GTEntitlement_D, { from: liquityAG })
      const deployedOYLCtx_E = await lockupContractFactory.deployOneYearLockupContract(B, GTEntitlement_E, { from: liquityAG })

      // Grab contracts from deployment tx events
      const OYLC_D = await th.getOYLCFromDeploymentTx(deployedOYLCtx_D)
      const OYLC_E = await th.getOYLCFromDeploymentTx(deployedOYLCtx_E)

      const OYLCAddress_D = OYLC_D.address
      const OYLCAddress_E = OYLC_E.address

      // LiquityAG transfers GT to each OYLC
      await growthToken.transfer(OYLCAddress_D, GTEntitlement_D)
      await growthToken.transfer(OYLCAddress_E, GTEntitlement_E)

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
  })
})