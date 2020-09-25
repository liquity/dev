const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec

contract('After the initial lockup period has passed', async accounts => {
  const [
    liquityAG,
    teamMember_1,
    teamMember_2,
    teamMember_3,
    investor_1,
    investor_2,
    investor_3,
    A, B, C, D, E, F, G, H, I, J, K] = accounts;

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
  const teamMemberInitialEntitlement_1 = dec(1, 24)
  const teamMemberInitialEntitlement_2 = dec(2, 24)
  const teamMemberInitialEntitlement_3 = dec(3, 24)

  const investorInitialEntitlement_1 = dec(4, 24)
  const investorInitialEntitlement_2 = dec(5, 24)
  const investorInitialEntitlement_3 = dec(6, 24)

  const teamMemberMonthlyVesting_1 = dec(1, 23)
  const teamMemberMonthlyVesting_2 = dec(2, 23)
  const teamMemberMonthlyVesting_3 = dec(3, 23)

  const GTEntitlement_A = dec(1, 24)
  const GTEntitlement_B = dec(2, 24)
  const GTEntitlement_C = dec(3, 24)
  const GTEntitlement_D = dec(4, 24)
  const GTEntitlement_E = dec(5, 24)

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
    it("GT Deployer can deploy OYLCs", async () => {
      // GT deployer deploys CDLCs
      const OYLCDeploymentTx_A = await lockupContractFactory.deployOneYearLockupContract(A, dec(1, 18), { from: liquityAG })
      const OYLCDeploymentTx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(1, 18), { from: liquityAG })
      const OYLCDeploymentTx_C = await lockupContractFactory.deployOneYearLockupContract(C, '9595995999999900000023423234', { from: liquityAG })

      assert.isTrue(OYLCDeploymentTx_A.receipt.status)
      assert.isTrue(OYLCDeploymentTx_B.receipt.status)
      assert.isTrue(OYLCDeploymentTx_C.receipt.status)
    })

    it("Anyone can deploy OYLCs", async () => {
      // Various EOAs deploy CDLCs
      const OYLCDeploymentTx_1 = await lockupContractFactory.deployOneYearLockupContract(A, dec(1, 18), { from: teamMember_1 })
      const OYLCDeploymentTx_2 = await lockupContractFactory.deployOneYearLockupContract(C, dec(1, 18), { from: investor_2 })
      const OYLCDeploymentTx_3 = await lockupContractFactory.deployOneYearLockupContract(liquityAG, '9595995999999900000023423234', { from: A })
      const OYLCDeploymentTx_4 = await lockupContractFactory.deployOneYearLockupContract(D, '123', { from: B })

      assert.isTrue(OYLCDeploymentTx_1.receipt.status)
      assert.isTrue(OYLCDeploymentTx_2.receipt.status)
      assert.isTrue(OYLCDeploymentTx_3.receipt.status)
      assert.isTrue(OYLCDeploymentTx_4.receipt.status)
    })
  })

  describe('Deploying Custom Duration Lockup Contracts (CDLCs)', async accounts => {
    it("GT Deployer can now deploy CDLCs", async () => {
      // GT deployer deploys CDLCs
      const CDLCDeploymentTx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, dec(1, 18), ONE_DAY_IN_SECONDS, { from: liquityAG })
      const CDLCDeploymentTx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, dec(1, 18), THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const CDLCDeploymentTx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, '9595995999999900000023423234', '23403434', { from: liquityAG })

      assert.isTrue(CDLCDeploymentTx_A.receipt.status)
      assert.isTrue(CDLCDeploymentTx_B.receipt.status)
      assert.isTrue(CDLCDeploymentTx_C.receipt.status)
    })

    it("Anyone can deploy CDLCs", async () => {
      // Various EOAs deploy CDLCs
      const CDLCDeploymentTx_1 = await lockupContractFactory.deployCustomDurationLockupContract(A, dec(1, 18), ONE_DAY_IN_SECONDS, { from: teamMember_1 })
      const CDLCDeploymentTx_2 = await lockupContractFactory.deployCustomDurationLockupContract(C, dec(1, 18), THIRTY_DAYS_IN_SECONDS, { from: investor_2 })
      const CDLCDeploymentTx_3 = await lockupContractFactory.deployCustomDurationLockupContract(liquityAG, '9595995999999900000023423234', '23403434', { from: A })
      const CDLCDeploymentTx_4 = await lockupContractFactory.deployCustomDurationLockupContract(D, '123', '23403434', { from: B })

      assert.isTrue(CDLCDeploymentTx_1.receipt.status)
      assert.isTrue(CDLCDeploymentTx_2.receipt.status)
      assert.isTrue(CDLCDeploymentTx_3.receipt.status)
      assert.isTrue(CDLCDeploymentTx_4.receipt.status)
    })

    it("CDLC deployed through the Factory stores Factory's address in the CDLC", async () => {
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

    it("CDLC deployment stores the beneficiary's address in the CDLC", async () => {
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

    it("CDLC deployment records the beneficiary's initial entitlement in the CDLC", async () => {
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

    it("CDLC deployment records the lockup duration in the CDLC", async () => {

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

    it("CDLC deployment through the Factory registers the CDLC in the Factory", async () => {
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

    it("CDLC deployment through the factory records the CDLC contract address and deployer as a k-v pair in the Factory", async () => {
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
    it("A beneficiary can withdraw their full entitlement from their OYLC", async () => {

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

    it("A beneficiary on a vesting schedule can withdraw their total vested amount from their OYLC", async () => {
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

    it("Beneficiaries can withraw full GT balance of OYLC if it has increased since lockup period ended", async () => {
      // Check GT balances of investors' OYLCs are equal to their initial entitlements
      assert.equal(await growthToken.balanceOf(OYLC_I1.address), investorInitialEntitlement_1)
      assert.equal(await growthToken.balanceOf(OYLC_I2.address), investorInitialEntitlement_2)
      assert.equal(await growthToken.balanceOf(OYLC_I3.address), investorInitialEntitlement_3)

      // Check GT balances of investors are 0
      assert.equal(await growthToken.balanceOf(investor_1), '0')
      assert.equal(await growthToken.balanceOf(investor_2), '0')
      assert.equal(await growthToken.balanceOf(investor_3), '0')

      // GT deployer sends extra GT to investor OYLCs
      await growthToken.transfer(OYLC_I1.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(OYLC_I2.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(OYLC_I3.address, dec(1, 24), { from: liquityAG })

      // 1 month passes
      await th.fastForwardTime(THIRTY_DAYS_IN_SECONDS, web3.currentProvider)

      // GT deployer again sends extra GT to investor OYLCs
      await growthToken.transfer(OYLC_I1.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(OYLC_I2.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(OYLC_I3.address, dec(1, 24), { from: liquityAG })

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

  describe('Withdrawal attempts from OYLCs by non-beneficiares', async accounts => {
    it("GT Deployer can't withdraw from a OYLC they deployed through the Factory", async () => {
      // GT deployer attempts withdrawal from OYLC they deployed through the Factory
      try {
        const withdrawalAttempt = await OYLC_T1.withdrawGT({ from: liquityAG })
        assert.isFalse(withdrawalAttempt.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })

    it("GT Deployer can't withdraw from a OYLC that someone else deployed", async () => {
      // Account D deploys a new OYLC via the Factory
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(2, 18), { from: D })
      const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)

      //GT deployer fund the newly deployed OYLCs
      await growthToken.transfer(OYLC_B.address, dec(2, 18), { from: liquityAG })

      // D locks their deployed OYLC
      await lockupContractFactory.lockOneYearContracts([OYLC_B.address], { from: D })

      // One year passes, so that contract can now be withdrawn from
      th.fastForwardTime(ONE_YEAR_IN_SECONDS, web3.currentProvider)

      // GT deployer attempts withdrawal from OYLC
      try {
        const withdrawalAttempt_B = await OYLC_B.withdrawGT({ from: liquityAG })
        assert.isFalse(withdrawalAttempt_B.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })

    it("Non-beneficiaries cannot withdraw from a OYLC", async () => {
      const variousEOAs = [
        teamMember_1,
        teamMember_3,
        liquityAG,
        investor_1,
        investor_2,
        investor_3,
        A,
        B,
        C,
        D,
        E]

      // Several EOAs attempt to withdraw from the OYLC that has teamMember_2 as beneficiary
      for (account of variousEOAs) {
        try {
          const withdrawalAttempt = await OYLC_T2.withdrawGT({ from: account })
          assert.isFalse(withdrawalAttempt.receipt.status)
        } catch (error) {
          assert.include(error.message, "revert")
        }
      }
    })
  })

  describe('Transferring GT', async accounts => {
    it("GT deployer can transfer GT to OYLCs they deployed", async () => {
      const initialGTBalanceOfOYLC_T1 = await growthToken.balanceOf(OYLC_T1.address)
      const initialGTBalanceOfOYLC_T2 = await growthToken.balanceOf(OYLC_T2.address)
      const initialGTBalanceOfOYLC_T3 = await growthToken.balanceOf(OYLC_T3.address)

      // One month passes
      await th.fastForwardTime(THIRTY_DAYS_IN_SECONDS, web3.currentProvider)

      // GT deployer transfers vesting amount
      await growthToken.transfer(OYLC_T1.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(OYLC_T2.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(OYLC_T3.address, dec(1, 24), { from: liquityAG })

      // Get new OYLC GT balances
      const GTBalanceOfOYLC_T1_1 = await growthToken.balanceOf(OYLC_T1.address)
      const GTBalanceOfOYLC_T2_1 = await growthToken.balanceOf(OYLC_T2.address)
      const GTBalanceOfOYLC_T3_1 = await growthToken.balanceOf(OYLC_T3.address)

      // // Check team member OYLC balances have increased 
      assert.isTrue(GTBalanceOfOYLC_T1_1.eq(th.toBN(initialGTBalanceOfOYLC_T1).add(th.toBN(dec(1, 24)))))
      assert.isTrue(GTBalanceOfOYLC_T2_1.eq(th.toBN(initialGTBalanceOfOYLC_T2).add(th.toBN(dec(1, 24)))))
      assert.isTrue(GTBalanceOfOYLC_T3_1.eq(th.toBN(initialGTBalanceOfOYLC_T3).add(th.toBN(dec(1, 24)))))

      // Another month passes
      await th.fastForwardTime(THIRTY_DAYS_IN_SECONDS, web3.currentProvider)

      // GT deployer transfers vesting amount
      await growthToken.transfer(OYLC_T1.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(OYLC_T2.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(OYLC_T3.address, dec(1, 24), { from: liquityAG })

      // Get new OYLC GT balances
      const GTBalanceOfOYLC_T1_2 = await growthToken.balanceOf(OYLC_T1.address)
      const GTBalanceOfOYLC_T2_2 = await growthToken.balanceOf(OYLC_T2.address)
      const GTBalanceOfOYLC_T3_2 = await growthToken.balanceOf(OYLC_T3.address)

      // Check team member OYLC balances have increased again
      assert.isTrue(GTBalanceOfOYLC_T1_2.eq(GTBalanceOfOYLC_T1_1.add(th.toBN(dec(1, 24)))))
      assert.isTrue(GTBalanceOfOYLC_T2_2.eq(GTBalanceOfOYLC_T2_1.add(th.toBN(dec(1, 24)))))
      assert.isTrue(GTBalanceOfOYLC_T3_2.eq(GTBalanceOfOYLC_T3_1.add(th.toBN(dec(1, 24)))))
    })

    it("GT deployer can transfer tokens to OYLCs deployed by anyone", async () => {
      // A, B, C each deploy a lockup contract ith themself as beneficiary
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, dec(1, 24), { from: A })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(2, 24), { from: B })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, dec(3, 24), { from: C })

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
      await growthToken.transfer(OYLC_A.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(OYLC_B.address, dec(2, 24), { from: liquityAG })
      await growthToken.transfer(OYLC_C.address, dec(3, 24), { from: liquityAG })

      // Check balances of OYLCs have increased
      assert.equal(await growthToken.balanceOf(OYLC_A.address), dec(1, 24))
      assert.equal(await growthToken.balanceOf(OYLC_B.address), dec(2, 24))
      assert.equal(await growthToken.balanceOf(OYLC_C.address), dec(3, 24))
    })

    it("GT deployer can transfer GT directly to any externally owned account", async () => {
      // Check GT balances of EOAs
      assert.equal(await growthToken.balanceOf(A), '0')
      assert.equal(await growthToken.balanceOf(B), '0')
      assert.equal(await growthToken.balanceOf(C), '0')

      // GT deployer transfers GT to EOAs
      const txA = await growthToken.transfer(A, dec(1, 24), { from: liquityAG })
      const txB = await growthToken.transfer(B, dec(2, 24), { from: liquityAG })
      const txC = await growthToken.transfer(C, dec(3, 24), { from: liquityAG })

      // Check new balances have increased by correct amount
      assert.equal(await growthToken.balanceOf(A), dec(1, 24))
      assert.equal(await growthToken.balanceOf(B), dec(2, 24))
      assert.equal(await growthToken.balanceOf(C), dec(3, 24))
    })

    it("GT deployer can transfer GT to CDLCs they deployed", async () => {
      // Deploy 5 CDLCs
      const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, GTEntitlement_A, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, GTEntitlement_B, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, GTEntitlement_C, THIRTY_DAYS_IN_SECONDS, { from: liquityAG })

      // Grab contract addresses from deployment tx events
      const CDLCAddress_A = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_A)
      const CDLCAddress_B = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_B)
      const CDLCAddress_C = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_C)

      // Check CDLC balances before
      assert.equal(await growthToken.balanceOf(CDLCAddress_A), '0')
      assert.equal(await growthToken.balanceOf(CDLCAddress_B), '0')
      assert.equal(await growthToken.balanceOf(CDLCAddress_C), '0')

      // GT deployer transfers GT to CDLCs
      await growthToken.transfer(CDLCAddress_A, GTEntitlement_A, { from: liquityAG })
      await growthToken.transfer(CDLCAddress_B, GTEntitlement_B, { from: liquityAG })
      await growthToken.transfer(CDLCAddress_C, GTEntitlement_C, { from: liquityAG })

      // Check CDLC balances after
      assert.equal(await growthToken.balanceOf(CDLCAddress_A), GTEntitlement_A)
      assert.equal(await growthToken.balanceOf(CDLCAddress_B), GTEntitlement_B)
      assert.equal(await growthToken.balanceOf(CDLCAddress_C), GTEntitlement_C)
    })

    it("GT deployer can transfer GT to CDLCs deployed by anyone", async () => {
      // Deploy 5 CDLCs
      const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, GTEntitlement_A, THIRTY_DAYS_IN_SECONDS, { from: D })
      const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, GTEntitlement_B, THIRTY_DAYS_IN_SECONDS, { from: E })
      const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, GTEntitlement_C, THIRTY_DAYS_IN_SECONDS, { from: F })

      // Grab contract addresses from deployment tx events
      const CDLCAddress_A = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_A)
      const CDLCAddress_B = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_B)
      const CDLCAddress_C = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_C)

      // Check CDLC balances before
      assert.equal(await growthToken.balanceOf(CDLCAddress_A), '0')
      assert.equal(await growthToken.balanceOf(CDLCAddress_B), '0')
      assert.equal(await growthToken.balanceOf(CDLCAddress_C), '0')

      // GT deployer transfers GT to CDLCs
      await growthToken.transfer(CDLCAddress_A, GTEntitlement_A, { from: liquityAG })
      await growthToken.transfer(CDLCAddress_B, GTEntitlement_B, { from: liquityAG })
      await growthToken.transfer(CDLCAddress_C, GTEntitlement_C, { from: liquityAG })

      // Check CDLC balances after
      assert.equal(await growthToken.balanceOf(CDLCAddress_A), GTEntitlement_A)
      assert.equal(await growthToken.balanceOf(CDLCAddress_B), GTEntitlement_B)
      assert.equal(await growthToken.balanceOf(CDLCAddress_C), GTEntitlement_C)
    })

    it("Anyone can transfer GT to OYLCs deployed by anyone", async () => {
      // Start D, E, F with some GT
      await growthToken.transfer(D, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(E, dec(2, 24), { from: liquityAG })
      await growthToken.transfer(F, dec(3, 24), { from: liquityAG })

      // H, I, J deploy lockup contracts with A, B, C as beneficiaries, respectively
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, dec(1, 24), { from: H })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(2, 24), { from: I })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, dec(3, 24), { from: J })

      // Grab contract addresses from deployment tx events
      const OYLCAddress_A = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_A)
      const OYLCAddress_B = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_B)
      const OYLCAddress_C = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_C)

      // Check balances of OYLCs are 0
      assert.equal(await growthToken.balanceOf(OYLCAddress_A), '0')
      assert.equal(await growthToken.balanceOf(OYLCAddress_B), '0')
      assert.equal(await growthToken.balanceOf(OYLCAddress_C), '0')

      // D, E, F transfer GT to OYLCs
      await growthToken.transfer(OYLCAddress_A, dec(1, 24), { from: D })
      await growthToken.transfer(OYLCAddress_B, dec(2, 24), { from: E })
      await growthToken.transfer(OYLCAddress_C, dec(3, 24), { from: F })

      // Check balances of OYLCs has increased
      assert.equal(await growthToken.balanceOf(OYLCAddress_A), dec(1, 24))
      assert.equal(await growthToken.balanceOf(OYLCAddress_B), dec(2, 24))
      assert.equal(await growthToken.balanceOf(OYLCAddress_C), dec(3, 24))
    })

    it("Anyone can transfer GT to CDLCs deployed by anyone", async () => {
      // Start D, E, F with some GT
      await growthToken.transfer(D, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(E, dec(2, 24), { from: liquityAG })
      await growthToken.transfer(F, dec(3, 24), { from: liquityAG })

      // H, I, J deploy lockup contracts with A, B, C as beneficiaries, respectively
      const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, dec(1, 24), THIRTY_DAYS_IN_SECONDS, { from: H })
      const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, dec(2, 24), THIRTY_DAYS_IN_SECONDS, { from: I })
      const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, dec(3, 24), THIRTY_DAYS_IN_SECONDS, { from: J })

      // Grab contract addresses from deployment tx events
      const CDLCAddress_A = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_A)
      const CDLCAddress_B = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_B)
      const CDLCAddress_C = await th.getLCAddressFromDeploymentTx(deployedCDLCtx_C)

      // Check balances of OYLCs are 0
      assert.equal(await growthToken.balanceOf(CDLCAddress_A), '0')
      assert.equal(await growthToken.balanceOf(CDLCAddress_B), '0')
      assert.equal(await growthToken.balanceOf(CDLCAddress_C), '0')

      // D, E, F transfer GT to OYLCs
      await growthToken.transfer(CDLCAddress_A, dec(1, 24), { from: D })
      await growthToken.transfer(CDLCAddress_B, dec(2, 24), { from: E })
      await growthToken.transfer(CDLCAddress_C, dec(3, 24), { from: F })

      // Check balances of OYLCs has increased
      assert.equal(await growthToken.balanceOf(CDLCAddress_A), dec(1, 24))
      assert.equal(await growthToken.balanceOf(CDLCAddress_B), dec(2, 24))
      assert.equal(await growthToken.balanceOf(CDLCAddress_C), dec(3, 24))
    })
  })

  describe('Locking CDLCs', async accounts => {
    it("GT deployer can lock CDLCs they deployed through the Factory", async () => {
      const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, dec(1, 24), THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, dec(2, 24), THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, dec(3, 24), THIRTY_DAYS_IN_SECONDS, { from: liquityAG })

      const CDLC_A = await th.getCDLCFromDeploymentTx(deployedCDLCtx_A)
      const CDLC_B = await th.getCDLCFromDeploymentTx(deployedCDLCtx_B)
      const CDLC_C = await th.getCDLCFromDeploymentTx(deployedCDLCtx_C)

      // check CDLCs are unlocked
      assert.isFalse(await CDLC_A.active())
      assert.isFalse(await CDLC_B.active())
      assert.isFalse(await CDLC_C.active())

      // GT deployer transfers GT entitlements to the contracts
      await growthToken.transfer(CDLC_A.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(CDLC_B.address, dec(2, 24), { from: liquityAG })
      await growthToken.transfer(CDLC_C.address, dec(3, 24), { from: liquityAG })

      const CDLCsToLock = [CDLC_A.address, CDLC_B.address, CDLC_C.address]

      // GT deployer locks the CDLCs they deployed
      await lockupContractFactory.lockCustomDurationContracts(CDLCsToLock, { from: liquityAG })

      // check CDLCs are locked
      assert.isTrue(await CDLC_A.active())
      assert.isTrue(await CDLC_B.active())
      assert.isTrue(await CDLC_C.active())
    })

    it("An externally owned account can lock CDLCs they deployed through the Factory", async () => {
      // D, E, F each deploy a CDLC
      const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, dec(1, 24), THIRTY_DAYS_IN_SECONDS, { from: D })
      const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, dec(2, 24), THIRTY_DAYS_IN_SECONDS, { from: E })
      const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, dec(3, 24), THIRTY_DAYS_IN_SECONDS, { from: F })

      const CDLC_A = await th.getCDLCFromDeploymentTx(deployedCDLCtx_A)
      const CDLC_B = await th.getCDLCFromDeploymentTx(deployedCDLCtx_B)
      const CDLC_C = await th.getCDLCFromDeploymentTx(deployedCDLCtx_C)

      // check CDLCs are unlocked
      assert.isFalse(await CDLC_A.active())
      assert.isFalse(await CDLC_B.active())
      assert.isFalse(await CDLC_C.active())

      // GT deployer transfers GT entitlements to the contracts
      await growthToken.transfer(CDLC_A.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(CDLC_B.address, dec(2, 24), { from: liquityAG })
      await growthToken.transfer(CDLC_C.address, dec(3, 24), { from: liquityAG })

      // D, E, F lock their resppective deployed CDLCs, through the Factory
      await lockupContractFactory.lockCustomDurationContracts([CDLC_A.address], { from: D })
      await lockupContractFactory.lockCustomDurationContracts([CDLC_B.address], { from: E })
      await lockupContractFactory.lockCustomDurationContracts([CDLC_C.address], { from: F })

      // check CDLCs are locked
      assert.isTrue(await CDLC_A.active())
      assert.isTrue(await CDLC_B.active())
      assert.isTrue(await CDLC_C.active())
    })
  })

  describe('Beneficiary withdrawal from CDLCs', async accounts => {
    it("After a CDLC lockup period has passed, beneficiary can withdraw their full entitlement from their CDLC", async () => {
      const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, dec(1, 24), THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, dec(2, 24), THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, dec(3, 24), THIRTY_DAYS_IN_SECONDS, { from: liquityAG })

      const CDLC_A = await th.getCDLCFromDeploymentTx(deployedCDLCtx_A)
      const CDLC_B = await th.getCDLCFromDeploymentTx(deployedCDLCtx_B)
      const CDLC_C = await th.getCDLCFromDeploymentTx(deployedCDLCtx_C)

      // GT deployer transfers GT entitlements to the contracts
      await growthToken.transfer(CDLC_A.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(CDLC_B.address, dec(2, 24), { from: liquityAG })
      await growthToken.transfer(CDLC_C.address, dec(3, 24), { from: liquityAG })

      const CDLCsToLock = [CDLC_A.address, CDLC_B.address, CDLC_C.address]

      // GT deployer locks the CDLCs they deployed
      await lockupContractFactory.lockCustomDurationContracts(CDLCsToLock, { from: liquityAG })

      await th.fastForwardTime(THIRTY_DAYS_IN_SECONDS, web3.currentProvider)

      // Check A, B, C GT balances before
      assert.equal(await growthToken.balanceOf(A), '0')
      assert.equal(await growthToken.balanceOf(B), '0')
      assert.equal(await growthToken.balanceOf(C), '0')

      // A, B, C withdraw from their CDLCs
      await CDLC_A.withdrawGT({ from: A })
      await CDLC_B.withdrawGT({ from: B })
      await CDLC_C.withdrawGT({ from: C })

      // Check A, B, C GT balances after withdrawal
      assert.equal(await growthToken.balanceOf(A), dec(1, 24))
      assert.equal(await growthToken.balanceOf(B), dec(2, 24))
      assert.equal(await growthToken.balanceOf(C), dec(3, 24))
    })

    it("After a CDLC lockup period has passed, Beneficiary can withdraw full GT balance of CDLC when it exceeds their initial entitlement", async () => {
      const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, dec(1, 24), THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, dec(2, 24), THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, dec(3, 24), THIRTY_DAYS_IN_SECONDS, { from: liquityAG })

      const CDLC_A = await th.getCDLCFromDeploymentTx(deployedCDLCtx_A)
      const CDLC_B = await th.getCDLCFromDeploymentTx(deployedCDLCtx_B)
      const CDLC_C = await th.getCDLCFromDeploymentTx(deployedCDLCtx_C)

      // GT deployer transfers GT entitlements to the contracts
      await growthToken.transfer(CDLC_A.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(CDLC_B.address, dec(2, 24), { from: liquityAG })
      await growthToken.transfer(CDLC_C.address, dec(3, 24), { from: liquityAG })

      const CDLCsToLock = [CDLC_A.address, CDLC_B.address, CDLC_C.address]

      // GT deployer locks the CDLCs they deployed
      await lockupContractFactory.lockCustomDurationContracts(CDLCsToLock, { from: liquityAG })

      await th.fastForwardTime(THIRTY_DAYS_IN_SECONDS, web3.currentProvider)

      // Transfer more GT, such that CDLC balances exceed their respective entitlements
      await growthToken.transfer(CDLC_A.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(CDLC_B.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(CDLC_C.address, dec(1, 24), { from: liquityAG })

      // Check A, B, C GT balances before
      assert.equal(await growthToken.balanceOf(A), '0')
      assert.equal(await growthToken.balanceOf(B), '0')
      assert.equal(await growthToken.balanceOf(C), '0')

      // Confirm CDLC balances before withdrawal
      assert.equal(await growthToken.balanceOf(CDLC_A.address), dec(2, 24))
      assert.equal(await growthToken.balanceOf(CDLC_B.address), dec(3, 24))
      assert.equal(await growthToken.balanceOf(CDLC_C.address), dec(4, 24))

      // A, B, C withdraw from their CDLCs
      await CDLC_A.withdrawGT({ from: A })
      await CDLC_B.withdrawGT({ from: B })
      await CDLC_C.withdrawGT({ from: C })

      // Check A, B, C GT balances after withdrawal
      assert.equal(await growthToken.balanceOf(A), dec(2, 24))
      assert.equal(await growthToken.balanceOf(B), dec(3, 24))
      assert.equal(await growthToken.balanceOf(C), dec(4, 24))
    })
  })

  describe('Withdrawal attempts from CDLCs by non-beneficiaries', async accounts => {
    it("After a CDLC lockup period has passed, GT deployer can't withdraw from a CDLC they deployed", async () => {
      const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, dec(1, 24), THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, dec(2, 24), THIRTY_DAYS_IN_SECONDS, { from: liquityAG })
      const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, dec(3, 24), THIRTY_DAYS_IN_SECONDS, { from: liquityAG })

      const CDLC_A = await th.getCDLCFromDeploymentTx(deployedCDLCtx_A)
      const CDLC_B = await th.getCDLCFromDeploymentTx(deployedCDLCtx_B)
      const CDLC_C = await th.getCDLCFromDeploymentTx(deployedCDLCtx_C)

      // GT deployer transfers GT entitlements to the contracts
      await growthToken.transfer(CDLC_A.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(CDLC_B.address, dec(2, 24), { from: liquityAG })
      await growthToken.transfer(CDLC_C.address, dec(3, 24), { from: liquityAG })

      const CDLCsToLock = [CDLC_A.address, CDLC_B.address, CDLC_C.address]

      // GT deployer locks the CDLCs they deployed
      await lockupContractFactory.lockCustomDurationContracts(CDLCsToLock, { from: liquityAG })

      await th.fastForwardTime(THIRTY_DAYS_IN_SECONDS, web3.currentProvider)

      const CDLCs = [CDLC_A, CDLC_B, CDLC_C]

      for (CDLC of CDLCs) {
        try {
          const withdrawalAttemptTx = await CDLC.withdrawGT({ from: liquityAG })
          assert.isFalse(withdrawalAttemptTx.receipt.status)
        } catch (error) {
          assert.include(error.message, "revert")
        }
      }
    })

    it("After a CDLC lockup period has passed, GT deployer can't withdraw from a CDLC someone else deployed", async () => {
      const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, dec(1, 24), THIRTY_DAYS_IN_SECONDS, { from: D })
      const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, dec(2, 24), THIRTY_DAYS_IN_SECONDS, { from: E })
      const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, dec(3, 24), THIRTY_DAYS_IN_SECONDS, { from: F })

      const CDLC_A = await th.getCDLCFromDeploymentTx(deployedCDLCtx_A)
      const CDLC_B = await th.getCDLCFromDeploymentTx(deployedCDLCtx_B)
      const CDLC_C = await th.getCDLCFromDeploymentTx(deployedCDLCtx_C)

      // GT deployer transfers GT entitlements to the contracts
      await growthToken.transfer(CDLC_A.address, dec(1, 24), { from: liquityAG })
      await growthToken.transfer(CDLC_B.address, dec(2, 24), { from: liquityAG })
      await growthToken.transfer(CDLC_C.address, dec(3, 24), { from: liquityAG })

      const CDLCsToLock = [CDLC_A.address, CDLC_B.address, CDLC_C.address]

      // Each deployer locks the CDLC they deployed
      await lockupContractFactory.lockCustomDurationContracts([CDLC_A.address], { from: D })
      await lockupContractFactory.lockCustomDurationContracts([CDLC_B.address], { from: E })
      await lockupContractFactory.lockCustomDurationContracts([CDLC_C.address], { from: F })

      await th.fastForwardTime(THIRTY_DAYS_IN_SECONDS, web3.currentProvider)

      const CDLCs = [CDLC_A, CDLC_B, CDLC_C]

      for (CDLC of CDLCs) {
        try {
          const withdrawalAttemptTx = await CDLC.withdrawGT({ from: liquityAG })
          assert.isFalse(withdrawalAttemptTx.receipt.status)
        } catch (error) {
          assert.include(error.message, "revert")
        }
      }
    })

    it("After a CDLC lockup period has passed, any account that is not the beneficiary can not withdraw", async () => {
      const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, dec(1, 24), THIRTY_DAYS_IN_SECONDS, { from: D })
      const CDLC_A = await th.getCDLCFromDeploymentTx(deployedCDLCtx_A)

      // GT deployer transfers GT entitlements to the contract
      await growthToken.transfer(CDLC_A.address, dec(1, 24), { from: liquityAG })

      // GT deployer locks the CDLCs they deployed
      await lockupContractFactory.lockCustomDurationContracts([CDLC_A.address], { from: D })

      await th.fastForwardTime(THIRTY_DAYS_IN_SECONDS, web3.currentProvider)

      const variousAccounts = [
        liquityAG,
        teamMember_1,
        teamMember_2,
        teamMember_3,
        investor_1,
        investor_2,
        investor_3,
        B, C, D, E, F, G, H, I, J, K]

      for (account of variousAccounts) {
        try {
          const withdrawalAttemptTx = await CDLC_A.withdrawGT({ from: account })
          assert.isFalse(withdrawalAttemptTx.receipt.status)
        } catch (error) {
          assert.include(error.message, "revert")
        }
      }
    })


  })

})
