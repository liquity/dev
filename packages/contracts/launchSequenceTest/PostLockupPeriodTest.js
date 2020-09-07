const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper
const mv = testHelpers.MoneyValues

contract('After the initial lockup period has passed', async accounts => {
  const [
    liquityAG,
    teamMember_1,
    teamMember_2,
    teamMember_3,
    investor_1,
    investor_2,
    investor_3,
    A,
    B,
    C,
    D,
    E,] = accounts;

  const ONE_DAY_IN_SECONDS = 86400
  const THIRTY_DAYS_IN_SECONDS = 2592000
  const ONE_YEAR_IN_SECONDS = 31536000
  const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

  let GTContracts

  // OYLCs for team members on vesting schedules
  let OYLC_T1
  let OYLC_T2
  let OYLC_T3

  // OYLCs for investors
  let OYLC_I1
  let OYLC_I2
  let OYLC_I3

  // 1e24 = 1 million tokens with 18 decimal digits
  const teamMemberInitialEntitlement_1 = mv._1e24
  const teamMemberInitialEntitlement_2 = mv._2e24
  const teamMemberInitialEntitlement_3 = mv._3e24

  const investorInitialEntitlement_1 = mv._4e24
  const investorInitialEntitlement_2 = mv._5e24
  const investorInitialEntitlement_3 = mv._6e24

  const teamMemberMonthlyVesting_1 = mv._1e23
  const teamMemberMonthlyVesting_2 = mv._2e23
  const teamMemberMonthlyVesting_3 = mv._3e23

  const GTEntitlement_A = mv._1e24
  const GTEntitlement_B = mv._2e24
  const GTEntitlement_C = mv._3e24
  const GTEntitlement_E = mv._4e24
  const GTEntitlement_D = mv._5e24

  beforeEach(async () => {
    // Deploy all contracts from the first account
    GTContracts = await deploymentHelper.deployGTContracts()
    await deploymentHelper.connectGTContracts(GTContracts)

    gtStaking = GTContracts.gtStaking
    growthToken = GTContracts.growthToken
    communityIssuance = GTContracts.communityIssuance
    lockupContractFactory = GTContracts.lockupContractFactory

    // Deploy 3 OYLCs for team members on vesting schedules
    const deployedOYLCtx_T1 = await lockupContractFactory.deployOneYearLockupContract(teamMember_1, teamMemberInitialEntitlement_1, { from: liquityAG })
    const deployedOYLCtx_T2 = await lockupContractFactory.deployOneYearLockupContract(teamMember_2, teamMemberInitialEntitlement_2, { from: liquityAG })
    const deployedOYLCtx_T3 = await lockupContractFactory.deployOneYearLockupContract(teamMember_3, teamMemberInitialEntitlement_3, { from: liquityAG })

    const deployedOYLCtx_I1 = await lockupContractFactory.deployOneYearLockupContract(investor_1, investorInitialEntitlement_1, { from: liquityAG })
    const deployedOYLCtx_I2 = await lockupContractFactory.deployOneYearLockupContract(investor_2, investorInitialEntitlement_2, { from: liquityAG })
    const deployedOYLCtx_I3 = await lockupContractFactory.deployOneYearLockupContract(investor_3, investorInitialEntitlement_3, { from: liquityAG })

    // OYLCs for team members on vesting schedules
    OYLC_T1 = await th.getOYLCFromDeploymentTx(deployedOYLCtx_T1)
    OYLC_T2 = await th.getOYLCFromDeploymentTx(deployedOYLCtx_T2)
    OYLC_T3 = await th.getOYLCFromDeploymentTx(deployedOYLCtx_T3)

    // OYLCs for investors
    OYLC_I1 = await th.getOYLCFromDeploymentTx(deployedOYLCtx_I1)
    OYLC_I2 = await th.getOYLCFromDeploymentTx(deployedOYLCtx_I2)
    OYLC_I3 = await th.getOYLCFromDeploymentTx(deployedOYLCtx_I3)

    // LiquityAG transfers initial GT entitlements to OYLCs
    await growthToken.transfer(OYLC_T1.address, teamMemberInitialEntitlement_1, { from: liquityAG })
    await growthToken.transfer(OYLC_T2.address, teamMemberInitialEntitlement_2, { from: liquityAG })
    await growthToken.transfer(OYLC_T3.address, teamMemberInitialEntitlement_3, { from: liquityAG })

    await growthToken.transfer(OYLC_I1.address, investorInitialEntitlement_1, { from: liquityAG })
    await growthToken.transfer(OYLC_I2.address, investorInitialEntitlement_2, { from: liquityAG })
    await growthToken.transfer(OYLC_I3.address, investorInitialEntitlement_3, { from: liquityAG })

    const OYLCsToLock = [
      // Team
      OYLC_T1.address,
      OYLC_T2.address,
      OYLC_T3.address,
      // Investors
      OYLC_I1.address,
      OYLC_I2.address,
      OYLC_I3.address
    ]
    // GT deployer locks the OYLCs they deployed
    await lockupContractFactory.lockOneYearContracts(OYLCsToLock, { from: liquityAG })

    const startTime = await th.getLatestBlockTimestamp(web3)

    // Every thirty days, deployer transfers vesting amounts to team members
    for (i = 0; i < 12; i++) {
      await th.fastForwardTime(THIRTY_DAYS_IN_SECONDS, web3.currentProvider)

      await growthToken.transfer(OYLC_T1.address, teamMemberMonthlyVesting_1, { from: liquityAG })
      await growthToken.transfer(OYLC_T2.address, teamMemberMonthlyVesting_2, { from: liquityAG })
      await growthToken.transfer(OYLC_T3.address, teamMemberMonthlyVesting_3, { from: liquityAG })
    }

    // After Since only 360 days have passed, fast forward 5 more days, until OYLCs unlock
    await th.fastForwardTime((ONE_DAY_IN_SECONDS * 5), web3.currentProvider)

    const endTime = await th.getLatestBlockTimestamp(web3)

    const timePassed = endTime - startTime
    // Confirm that just over one year has passed -  not more than 1000 seconds 
    assert.isBelow((timePassed - ONE_YEAR_IN_SECONDS), 1000)
    assert.isAbove((timePassed - ONE_YEAR_IN_SECONDS), 0)
  })

  describe('Deploying new OYLCs', async accounts => {
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
      const OYLCDeploymentTx_2 = await lockupContractFactory.deployOneYearLockupContract(C, mv._1e18, { from: investor_2 })
      const OYLCDeploymentTx_3 = await lockupContractFactory.deployOneYearLockupContract(liquityAG, '9595995999999900000023423234', { from: A })
      const OYLCDeploymentTx_4 = await lockupContractFactory.deployOneYearLockupContract(D, '123', { from: B })

      assert.isTrue(OYLCDeploymentTx_1.receipt.status)
      assert.isTrue(OYLCDeploymentTx_2.receipt.status)
      assert.isTrue(OYLCDeploymentTx_3.receipt.status)
      assert.isTrue(OYLCDeploymentTx_4.receipt.status)
    })
  })

  describe('Deploying Custom Duration Lockup Contracts (CDLCs)', async accounts => {
    it.only("GT Deployer can now deploy CDLCs", async () => {
      // GT deployer deploys CDLCs
      const CDLCDeploymentTx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, mv._1e18, ONE_DAY_IN_SECONDS, { from: liquityAG })
      const CDLCDeploymentTx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, mv._1e18, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const CDLCDeploymentTx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, '9595995999999900000023423234', '23403434', { from: liquityAG })

      assert.isTrue(CDLCDeploymentTx_A.receipt.status)
      assert.isTrue(CDLCDeploymentTx_B.receipt.status)
      assert.isTrue(CDLCDeploymentTx_C.receipt.status)
    })

    it.only("Anyone can deploy CDLCs", async () => {
      // Various EOAs deploy CDLCs
      const CDLCDeploymentTx_1 = await lockupContractFactory.deployCustomDurationLockupContract(A, mv._1e18, ONE_DAY_IN_SECONDS, { from: teamMember_1 })
      const CDLCDeploymentTx_2 = await lockupContractFactory.deployCustomDurationLockupContract(C, mv._1e18, THIRTY_DAYS_IN_SECONDS, { from: investor_2 })
      const CDLCDeploymentTx_3 = await lockupContractFactory.deployCustomDurationLockupContract(liquityAG, '9595995999999900000023423234', '23403434', { from: A })
      const CDLCDeploymentTx_4 = await lockupContractFactory.deployCustomDurationLockupContract(D, '123', '23403434', { from: B })

      assert.isTrue(CDLCDeploymentTx_1.receipt.status)
      assert.isTrue(CDLCDeploymentTx_2.receipt.status)
      assert.isTrue(CDLCDeploymentTx_3.receipt.status)
      assert.isTrue(CDLCDeploymentTx_4.receipt.status)
    })

    it.only("CDLC deployed through the Factory stores Factory's address in the CDLC", async () => {
      // Deploy 5 CDLCs
      const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, GTEntitlement_A, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, GTEntitlement_B, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, GTEntitlement_C, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_D = await lockupContractFactory.deployCustomDurationLockupContract(D, GTEntitlement_D, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_E = await lockupContractFactory.deployCustomDurationLockupContract(E, GTEntitlement_E, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })

      const CDLC_A = await th.getCDLCFromDeploymentTx(deployedCDLCtx_A)
      const CDLC_B = await th.getCDLCFromDeploymentTx(deployedCDLCtx_B)
      const CDLC_C = await th.getCDLCFromDeploymentTx(deployedCDLCtx_C)
      const CDLC_D = await th.getCDLCFromDeploymentTx(deployedCDLCtx_D)
      const CDLC_E = await th.getCDLCFromDeploymentTx(deployedCDLCtx_E)

      const storedDeployerAddress_A = await CDLC_A.lockupDeployer()
      const storedDeployerAddress_B = await CDLC_B.lockupDeployer()
      const storedDeployerAddress_C = await CDLC_C.lockupDeployer()
      const storedDeployerAddress_D = await CDLC_D.lockupDeployer()
      const storedDeployerAddress_E = await CDLC_E.lockupDeployer()

      assert.equal(lockupContractFactory.address, storedDeployerAddress_A)
      assert.equal(lockupContractFactory.address, storedDeployerAddress_B)
      assert.equal(lockupContractFactory.address, storedDeployerAddress_C)
      assert.equal(lockupContractFactory.address, storedDeployerAddress_D)
      assert.equal(lockupContractFactory.address, storedDeployerAddress_E)
    })

    it.only("CDLC deployment stores the beneficiary's address in the CDLC", async () => {
      // Deploy 5 CDLCs
      const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, GTEntitlement_A, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, GTEntitlement_B, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, GTEntitlement_C, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_D = await lockupContractFactory.deployCustomDurationLockupContract(D, GTEntitlement_D, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_E = await lockupContractFactory.deployCustomDurationLockupContract(E, GTEntitlement_E, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })

      // Grab contracts from deployment tx events
      const CDLC_A = await th.getCDLCFromDeploymentTx(deployedCDLCtx_A)
      const CDLC_B = await th.getCDLCFromDeploymentTx(deployedCDLCtx_B)
      const CDLC_C = await th.getCDLCFromDeploymentTx(deployedCDLCtx_C)
      const CDLC_D = await th.getCDLCFromDeploymentTx(deployedCDLCtx_D)
      const CDLC_E = await th.getCDLCFromDeploymentTx(deployedCDLCtx_E)

      const storedBeneficiaryAddress_A = await CDLC_A.beneficiary()
      const storedBeneficiaryAddress_B = await CDLC_B.beneficiary()
      const storedBeneficiaryAddress_C = await CDLC_C.beneficiary()
      const storedBeneficiaryAddress_D = await CDLC_D.beneficiary()
      const storedBeneficiaryAddress_E = await CDLC_E.beneficiary()

      assert.equal(A, storedBeneficiaryAddress_A)
      assert.equal(B, storedBeneficiaryAddress_B)
      assert.equal(C, storedBeneficiaryAddress_C)
      assert.equal(D, storedBeneficiaryAddress_D)
      assert.equal(E, storedBeneficiaryAddress_E)
    })

    it.only("CDLC deployment records the beneficiary's initial entitlement in the CDLC", async () => {
      // Deploy 5 CDLCs
      const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, GTEntitlement_A, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, GTEntitlement_B, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, GTEntitlement_C, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_D = await lockupContractFactory.deployCustomDurationLockupContract(D, GTEntitlement_D, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_E = await lockupContractFactory.deployCustomDurationLockupContract(E, GTEntitlement_E, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })

      // Grab contracts from deployment tx events
      const CDLC_A = await th.getCDLCFromDeploymentTx(deployedCDLCtx_A)
      const CDLC_B = await th.getCDLCFromDeploymentTx(deployedCDLCtx_B)
      const CDLC_C = await th.getCDLCFromDeploymentTx(deployedCDLCtx_C)
      const CDLC_D = await th.getCDLCFromDeploymentTx(deployedCDLCtx_D)
      const CDLC_E = await th.getCDLCFromDeploymentTx(deployedCDLCtx_E)

      const recordedInitialEntitlement_A = await CDLC_A.initialEntitlement()
      const recordedInitialEntitlement_B = await CDLC_B.initialEntitlement()
      const recordedInitialEntitlement_C = await CDLC_C.initialEntitlement()
      const recordedInitialEntitlement_D = await CDLC_D.initialEntitlement()
      const recordedInitialEntitlement_E = await CDLC_E.initialEntitlement()

      assert.equal(GTEntitlement_A, recordedInitialEntitlement_A)
      assert.equal(GTEntitlement_B, recordedInitialEntitlement_B)
      assert.equal(GTEntitlement_C, recordedInitialEntitlement_C)
      assert.equal(GTEntitlement_D, recordedInitialEntitlement_D)
      assert.equal(GTEntitlement_E, recordedInitialEntitlement_E)
    })

    it.only("CDLC deployment records the lockup duration in the CDLC", async () => {

      const lockupDuration_A = THIRTY_DAYS_IN_SECONDS
      const lockupDuration_B = ONE_YEAR_IN_SECONDS
      const lockupDuration_C = '1'
      const lockupDuration_D = '9582095795723094723094823'
      const lockupDuration_E = maxBytes32

      // Deploy 5 CDLCs
      const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, GTEntitlement_A, lockupDuration_A, { from: liquityAG })
      const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, GTEntitlement_B, lockupDuration_B, { from: liquityAG })
      const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, GTEntitlement_C, lockupDuration_C, { from: liquityAG })
      const deployedCDLCtx_D = await lockupContractFactory.deployCustomDurationLockupContract(D, GTEntitlement_D, lockupDuration_D, { from: liquityAG })
      const deployedCDLCtx_E = await lockupContractFactory.deployCustomDurationLockupContract(E, GTEntitlement_E, lockupDuration_E, { from: liquityAG })

      // Grab contracts from deployment tx events
      const CDLC_A = await th.getCDLCFromDeploymentTx(deployedCDLCtx_A)
      const CDLC_B = await th.getCDLCFromDeploymentTx(deployedCDLCtx_B)
      const CDLC_C = await th.getCDLCFromDeploymentTx(deployedCDLCtx_C)
      const CDLC_D = await th.getCDLCFromDeploymentTx(deployedCDLCtx_D)
      const CDLC_E = await th.getCDLCFromDeploymentTx(deployedCDLCtx_E)

      const recordedLockupDuration_A = await CDLC_A.lockupDurationInSeconds()
      const recordedLockupDuration_B = await CDLC_B.lockupDurationInSeconds()
      const recordedLockupDuration_C = await CDLC_C.lockupDurationInSeconds()
      const recordedLockupDuration_D = await CDLC_D.lockupDurationInSeconds()
      const recordedLockupDuration_E = await CDLC_E.lockupDurationInSeconds()

      assert.equal(lockupDuration_A, recordedLockupDuration_A.toString())
      assert.equal(lockupDuration_B, recordedLockupDuration_B.toString())
      assert.equal(lockupDuration_C, recordedLockupDuration_C.toString())
      assert.equal(lockupDuration_D, recordedLockupDuration_D.toString())
      assert.equal(lockupDuration_E, web3.utils.toHex(recordedLockupDuration_E))
    })

    it.only("CDLC deployment through the Factory registers the CDLC in the Factory", async () => {
      // Deploy 5 CDLCs
      const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, GTEntitlement_A, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, GTEntitlement_B, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, GTEntitlement_C, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_D = await lockupContractFactory.deployCustomDurationLockupContract(D, GTEntitlement_D, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_E = await lockupContractFactory.deployCustomDurationLockupContract(E, GTEntitlement_E, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })

      // Grab contract addresses from deployment tx events
      const CDLCAddress_A = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_A)
      const CDLCAddress_B = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_B)
      const CDLCAddress_C = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_C)
      const CDLCAddress_D = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_D)
      const CDLCAddress_E = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_E)

      assert.isTrue(await lockupContractFactory.isRegisteredCustomDurationLockup(CDLCAddress_A))
      assert.isTrue(await lockupContractFactory.isRegisteredCustomDurationLockup(CDLCAddress_B))
      assert.isTrue(await lockupContractFactory.isRegisteredCustomDurationLockup(CDLCAddress_C))
      assert.isTrue(await lockupContractFactory.isRegisteredCustomDurationLockup(CDLCAddress_D))
      assert.isTrue(await lockupContractFactory.isRegisteredCustomDurationLockup(CDLCAddress_E))
    })

    it.only("CDLC deployment through the factory records the CDLC contract address and deployer as a k-v pair in the Factory", async () => {
      // Deploy 5 CDLCs
      const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, GTEntitlement_A, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, GTEntitlement_B, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, GTEntitlement_C, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_D = await lockupContractFactory.deployCustomDurationLockupContract(D, GTEntitlement_D, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_E = await lockupContractFactory.deployCustomDurationLockupContract(E, GTEntitlement_E, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })

      // Grab contract addresses from deployment tx events
      const CDLCAddress_A = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_A)
      const CDLCAddress_B = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_B)
      const CDLCAddress_C = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_C)
      const CDLCAddress_D = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_D)
      const CDLCAddress_E = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_E)

      assert.equal(liquityAG, await lockupContractFactory.customDurationLockupContractToDeployer(CDLCAddress_A))
      assert.equal(liquityAG, await lockupContractFactory.customDurationLockupContractToDeployer(CDLCAddress_B))
      assert.equal(liquityAG, await lockupContractFactory.customDurationLockupContractToDeployer(CDLCAddress_C))
      assert.equal(liquityAG, await lockupContractFactory.customDurationLockupContractToDeployer(CDLCAddress_D))
      assert.equal(liquityAG, await lockupContractFactory.customDurationLockupContractToDeployer(CDLCAddress_E))
    })
  })

  describe('Beneficiary withdrawal from initial OYLC', async accounts => {
    it.only("A beneficiary can withdraw their full entitlement from their OYLC", async () => {

      // Check GT balances of investors' OYLCs are equal to their initial entitlements
      assert.equal(await growthToken.balanceOf(OYLC_I1.address), investorInitialEntitlement_1)
      assert.equal(await growthToken.balanceOf(OYLC_I2.address), investorInitialEntitlement_2)
      assert.equal(await growthToken.balanceOf(OYLC_I3.address), investorInitialEntitlement_3)

      // Check GT balances of investors are 0
      assert.equal(await growthToken.balanceOf(investor_1), '0')
      assert.equal(await growthToken.balanceOf(investor_2), '0')
      assert.equal(await growthToken.balanceOf(investor_3), '0')

      // All investors withdraw from their respective OYLCs
      await OYLC_I1.withdrawGT({ from: investor_1 })
      await OYLC_I2.withdrawGT({ from: investor_2 })
      await OYLC_I3.withdrawGT({ from: investor_3 })

      // Check GT balances of investors now equal their entitlements
      assert.equal(await growthToken.balanceOf(investor_1), investorInitialEntitlement_1)
      assert.equal(await growthToken.balanceOf(investor_2), investorInitialEntitlement_2)
      assert.equal(await growthToken.balanceOf(investor_3), investorInitialEntitlement_3)

      // Check GT balances of investors' OYLCs are now 0
      assert.equal(await growthToken.balanceOf(OYLC_I1.address), '0')
      assert.equal(await growthToken.balanceOf(OYLC_I2.address), '0')
      assert.equal(await growthToken.balanceOf(OYLC_I3.address), '0')
    })

    it.only("A beneficiary on a vesting schedule can withdraw their total vested amount from their OYLC", async () => {
      // Get GT balances of OYLCs for beneficiaries (team members) on vesting schedules
      const GTBalanceOfOYLC_T1_Before = await growthToken.balanceOf(OYLC_T1.address)
      const GTBalanceOfOYLC_T2_Before = await growthToken.balanceOf(OYLC_T2.address)
      const GTBalanceOfOYLC_T3_Before = await growthToken.balanceOf(OYLC_T3.address)

      // Check GT balances of vesting beneficiaries' OYLCs are greater than their initial entitlements
      assert.isTrue(GTBalanceOfOYLC_T1_Before.gt(th.toBN(teamMemberInitialEntitlement_1)))
      assert.isTrue(GTBalanceOfOYLC_T2_Before.gt(th.toBN(teamMemberInitialEntitlement_2)))
      assert.isTrue(GTBalanceOfOYLC_T3_Before.gt(th.toBN(teamMemberInitialEntitlement_3)))

      // Check GT balances of beneficiaries are 0
      assert.equal(await growthToken.balanceOf(teamMember_1), '0')
      assert.equal(await growthToken.balanceOf(teamMember_2), '0')
      assert.equal(await growthToken.balanceOf(teamMember_3), '0')

      // All beneficiaries withdraw from their respective OYLCs
      await OYLC_T1.withdrawGT({ from: teamMember_1 })
      await OYLC_T2.withdrawGT({ from: teamMember_2 })
      await OYLC_T3.withdrawGT({ from: teamMember_3 })

      // Check beneficiaries' GT balances now equal their accumulated vested entitlements
      assert.isTrue((await growthToken.balanceOf(teamMember_1)).eq(GTBalanceOfOYLC_T1_Before))
      assert.isTrue((await growthToken.balanceOf(teamMember_2)).eq(GTBalanceOfOYLC_T2_Before))
      assert.isTrue((await growthToken.balanceOf(teamMember_3)).eq(GTBalanceOfOYLC_T3_Before))

      // Check GT balances of beneficiaries' OYLCs are now 0
      assert.equal(await growthToken.balanceOf(OYLC_T1.address), '0')
      assert.equal(await growthToken.balanceOf(OYLC_T2.address), '0')
      assert.equal(await growthToken.balanceOf(OYLC_T3.address), '0')
    })

    it.only("Beneficiaries can withraw full GT balance of OYLC if it has increased since lockup period ended", async () => {
      // Check GT balances of investors' OYLCs are equal to their initial entitlements
      assert.equal(await growthToken.balanceOf(OYLC_I1.address), investorInitialEntitlement_1)
      assert.equal(await growthToken.balanceOf(OYLC_I2.address), investorInitialEntitlement_2)
      assert.equal(await growthToken.balanceOf(OYLC_I3.address), investorInitialEntitlement_3)

      // Check GT balances of investors are 0
      assert.equal(await growthToken.balanceOf(investor_1), '0')
      assert.equal(await growthToken.balanceOf(investor_2), '0')
      assert.equal(await growthToken.balanceOf(investor_3), '0')

      // GT deployer sends extra GT to investor OYLCs
      await growthToken.transfer(OYLC_I1.address, mv._1e24, { from: liquityAG })
      await growthToken.transfer(OYLC_I2.address, mv._1e24, { from: liquityAG })
      await growthToken.transfer(OYLC_I3.address, mv._1e24, { from: liquityAG })

      // 1 month passes
      await th.fastForwardTime(THIRTY_DAYS_IN_SECONDS, web3.currentProvider)

      // GT deployer again sends extra GT to investor OYLCs
      await growthToken.transfer(OYLC_I1.address, mv._1e24, { from: liquityAG })
      await growthToken.transfer(OYLC_I2.address, mv._1e24, { from: liquityAG })
      await growthToken.transfer(OYLC_I3.address, mv._1e24, { from: liquityAG })

      // Get GT balances of OYLCs for investors 
      const GTBalanceOfOYLC_I1_Before = await growthToken.balanceOf(OYLC_I1.address)
      const GTBalanceOfOYLC_I2_Before = await growthToken.balanceOf(OYLC_I2.address)
      const GTBalanceOfOYLC_I3_Before = await growthToken.balanceOf(OYLC_I3.address)

      // Check GT balances of investors' OYLCs are greater than their initial entitlements
      assert.isTrue(GTBalanceOfOYLC_I1_Before.gt(th.toBN(investorInitialEntitlement_1)))
      assert.isTrue(GTBalanceOfOYLC_I2_Before.gt(th.toBN(investorInitialEntitlement_2)))
      assert.isTrue(GTBalanceOfOYLC_I3_Before.gt(th.toBN(investorInitialEntitlement_3)))

      // All investors withdraw from their respective OYLCs
      await OYLC_I1.withdrawGT({ from: investor_1 })
      await OYLC_I2.withdrawGT({ from: investor_2 })
      await OYLC_I3.withdrawGT({ from: investor_3 })

      // Check GT balances of investors now equal their OYLC balances prior to withdrawal
      assert.isTrue((await growthToken.balanceOf(investor_1)).eq(GTBalanceOfOYLC_I1_Before))
      assert.isTrue((await growthToken.balanceOf(investor_2)).eq(GTBalanceOfOYLC_I2_Before))
      assert.isTrue((await growthToken.balanceOf(investor_3)).eq(GTBalanceOfOYLC_I3_Before))

      // Check GT balances of investors' OYLCs are now 0
      assert.equal(await growthToken.balanceOf(OYLC_I1.address), '0')
      assert.equal(await growthToken.balanceOf(OYLC_I2.address), '0')
      assert.equal(await growthToken.balanceOf(OYLC_I3.address), '0')
    })
  })

  describe('Transferring GT to OYLCs', async accounts => { 
    it.only("GT deployer can transfer GT to one-year lockup contracts they deployed", async () => {
      const initialGTBalanceOfOYLC_T1 = await growthToken.balanceOf(OYLC_T1.address)
      const initialGTBalanceOfOYLC_T2 = await growthToken.balanceOf(OYLC_T2.address)
      const initialGTBalanceOfOYLC_T3 = await growthToken.balanceOf(OYLC_T3.address)

      // One month passes
      await th.fastForwardTime(THIRTY_DAYS_IN_SECONDS, web3.currentProvider)

      // GT deployer transfers vesting amount
      await growthToken.transfer(OYLC_T1.address, mv._1e24, { from: liquityAG })
      await growthToken.transfer(OYLC_T2.address, mv._1e24, { from: liquityAG })
      await growthToken.transfer(OYLC_T3.address, mv._1e24, { from: liquityAG })

      // Get new OYLC GT balances
      const GTBalanceOfOYLC_T1_1 = await growthToken.balanceOf(OYLC_T1.address)
      const GTBalanceOfOYLC_T2_1 = await growthToken.balanceOf(OYLC_T2.address)
      const GTBalanceOfOYLC_T3_1 = await growthToken.balanceOf(OYLC_T3.address)

      // // Check team member OYLC balances have increased 
      assert.isTrue(GTBalanceOfOYLC_T1_1.eq(th.toBN(initialGTBalanceOfOYLC_T1).add(th.toBN(mv._1e24))))
      assert.isTrue(GTBalanceOfOYLC_T2_1.eq(th.toBN(initialGTBalanceOfOYLC_T2).add(th.toBN(mv._1e24))))
      assert.isTrue(GTBalanceOfOYLC_T3_1.eq(th.toBN(initialGTBalanceOfOYLC_T3).add(th.toBN(mv._1e24))))

      // Another month passes
      await th.fastForwardTime(THIRTY_DAYS_IN_SECONDS, web3.currentProvider)

      // GT deployer transfers vesting amount
      await growthToken.transfer(OYLC_T1.address, mv._1e24, { from: liquityAG })
      await growthToken.transfer(OYLC_T2.address, mv._1e24, { from: liquityAG })
      await growthToken.transfer(OYLC_T3.address, mv._1e24, { from: liquityAG })

      // Get new OYLC GT balances
      const GTBalanceOfOYLC_T1_2 = await growthToken.balanceOf(OYLC_T1.address)
      const GTBalanceOfOYLC_T2_2 = await growthToken.balanceOf(OYLC_T2.address)
      const GTBalanceOfOYLC_T3_2 = await growthToken.balanceOf(OYLC_T3.address)

      // Check team member OYLC balances have increased again
      assert.isTrue(GTBalanceOfOYLC_T1_2.eq(GTBalanceOfOYLC_T1_1.add(th.toBN(mv._1e24))))
      assert.isTrue(GTBalanceOfOYLC_T2_2.eq(GTBalanceOfOYLC_T2_1.add(th.toBN(mv._1e24))))
      assert.isTrue(GTBalanceOfOYLC_T3_2.eq(GTBalanceOfOYLC_T3_1.add(th.toBN(mv._1e24))))
    })

    it.only("GT deployer can transfer tokens to one-year lockup contracts deployed by anyone", async () => {
      // A, B, C each deploy a lockup contract ith themself as beneficiary
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, mv._1e24, { from: A })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, mv._2e24, { from: B })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, mv._3e24, { from: C })

      // OYLCs for team members on vesting schedules
      const OYLC_A = await th.getOYLCFromDeploymentTx(deployedOYLCtx_A)
      const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)
      const OYLC_C = await th.getOYLCFromDeploymentTx(deployedOYLCtx_C)

      // Check balances of OYLCs are 0
      assert.equal(await growthToken.balanceOf(OYLC_A.address), '0')
      assert.equal(await growthToken.balanceOf(OYLC_B.address), '0')
      assert.equal(await growthToken.balanceOf(OYLC_C.address), '0')

      // One month passes
      await th.fastForwardTime(THIRTY_DAYS_IN_SECONDS, web3.currentProvider)

      // GT deployer transfers GT to OYLCs deployed by other accounts
      await growthToken.transfer(OYLC_A.address, mv._1e24, { from: liquityAG })
      await growthToken.transfer(OYLC_B.address, mv._2e24, { from: liquityAG })
      await growthToken.transfer(OYLC_C.address, mv._3e24, { from: liquityAG })

      // Check balances of OYLCs have increased
      assert.equal(await growthToken.balanceOf(OYLC_A.address), mv._1e24)
      assert.equal(await growthToken.balanceOf(OYLC_B.address), mv._2e24)
      assert.equal(await growthToken.balanceOf(OYLC_C.address), mv._3e24)
    })
  })
})
