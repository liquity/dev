const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const { dec, toBN, assertRevert } = th

contract('After the initial lockup period has passed', async accounts => {
  const [
    liquityAG,
    teamMember_1,
    teamMember_2,
    teamMember_3,
    teamMember_4,
    teamMember_5,
    teamMember_6,
    teamMember_7,
    teamMember_8,
    teamMember_9,
    investor_1,
    investor_2,
    investor_3,
    investor_4,
    investor_5,
    investor_6,
    investor_7,
    investor_8,
    investor_9,
    A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R] = accounts;

  const [bountyAddress, xbrlWethLpRewardsAddress, xbrlStblLpRewardsAddress, momentZeroMultisig, sixMonthsMultisig, oneYearMultisig] = accounts.slice(994, 1000)

  const SECONDS_IN_ONE_DAY = timeValues.SECONDS_IN_ONE_DAY
  const SECONDS_IN_ONE_MONTH = timeValues.SECONDS_IN_ONE_MONTH
  const SECONDS_IN_TWO_MONTHS = timeValues.SECONDS_IN_TWO_MONTHS
  const SECONDS_IN_SIX_MONTHS = timeValues.SECONDS_IN_SIX_MONTHS
  const SECONDS_IN_ONE_YEAR = timeValues.SECONDS_IN_ONE_YEAR
  const maxBytes32 = th.maxBytes32

  let STBLContracts
  let coreContracts

  // LCs for team members on vesting schedules
  let LC_T1
  let LC_T2
  let LC_T3
  let LC_T4
  let LC_T5
  let LC_T6
  let LC_T7
  let LC_T8
  let LC_T9

  // LCs for investors
  let LC_I1
  let LC_I2
  let LC_I3
  let LC_I4
  let LC_I5
  let LC_I6
  let LC_I7
  let LC_I8
  let LC_I9

  // 1e24 = 1 million tokens with 18 decimal digits
  const teamMemberInitialEntitlement_1 = dec(1, 24)
  const teamMemberInitialEntitlement_2 = dec(11, 23)
  const teamMemberInitialEntitlement_3 = dec(12, 23)
  const teamMemberInitialEntitlement_4 = dec(13, 23)
  const teamMemberInitialEntitlement_5 = dec(14, 23)
  const teamMemberInitialEntitlement_6 = dec(15, 23)
  const teamMemberInitialEntitlement_7 = dec(16, 23)
  const teamMemberInitialEntitlement_8 = dec(17, 23)
  const teamMemberInitialEntitlement_9 = dec(18, 23)

  const investorInitialEntitlement_1 = dec(18, 23)
  const investorInitialEntitlement_2 = dec(19, 23)
  const investorInitialEntitlement_3 = dec(2, 24)
  const investorInitialEntitlement_4 = dec(21, 23)
  const investorInitialEntitlement_5 = dec(22, 23)
  const investorInitialEntitlement_6 = dec(23, 23)
  const investorInitialEntitlement_7 = dec(24, 23)
  const investorInitialEntitlement_8 = dec(25, 23)
  const investorInitialEntitlement_9 = dec(26, 23)

  const teamMemberMonthlyVesting_1 = dec(1, 18)
  const teamMemberMonthlyVesting_2 = dec(2, 18)
  const teamMemberMonthlyVesting_3 = dec(3, 18)
  const teamMemberMonthlyVesting_4 = dec(4, 18)
  const teamMemberMonthlyVesting_5 = dec(5, 18)
  const teamMemberMonthlyVesting_6 = dec(6, 18)
  const teamMemberMonthlyVesting_7 = dec(7, 18)
  const teamMemberMonthlyVesting_8 = dec(8, 18)
  const teamMemberMonthlyVesting_9 = dec(9, 18)

  const STBLEntitlement_A = dec(1, 24)
  const STBLEntitlement_B = dec(11, 23)
  const STBLEntitlement_C = dec(12, 23)
  const STBLEntitlement_D = dec(13, 23)
  const STBLEntitlement_E = dec(14, 23)

  const STBLEntitlement_F = dec(15, 23)
  const STBLEntitlement_G = dec(16, 23)
  const STBLEntitlement_H = dec(17, 23)
  const STBLEntitlement_I = dec(18, 23)
  const STBLEntitlement_J = dec(19, 23)

  const STBLEntitlement_K = dec(2, 24)
  const STBLEntitlement_L = dec(21, 23)
  const STBLEntitlement_M = dec(22, 23)
  const STBLEntitlement_N = dec(23, 23)
  const STBLEntitlement_O = dec(24, 23)

  let twoMonthsFromSystemDeployment
  let sixMonthsFromSystemDeployment
  let oneYearFromSystemDeployment
  let justOverTwoMonthsFromSystemDeployment
  let justOverSixMonthsFromSystemDeployment
  let twoYearsFromSystemDeployment
  let justOverOneYearFromSystemDeployment
  let _18monthsFromSystemDeployment

  beforeEach(async () => {
    // Deploy all contracts from the first account
    STBLContracts = await deploymentHelper.deploySTBLTesterContractsHardhat(bountyAddress, xbrlWethLpRewardsAddress, xbrlStblLpRewardsAddress, momentZeroMultisig, sixMonthsMultisig, oneYearMultisig)
    coreContracts = await deploymentHelper.deployStabilioCore()

    stblStaking = STBLContracts.stblStaking
    stblToken = STBLContracts.stblToken
    communityIssuance = STBLContracts.communityIssuance
    lockupContractFactory = STBLContracts.lockupContractFactory

    await deploymentHelper.connectSTBLContracts(STBLContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, STBLContracts)
    await deploymentHelper.connectSTBLContractsToCore(STBLContracts, coreContracts)

    twoMonthsFromSystemDeployment = await th.getTimeFromSystemDeployment(stblToken, web3, SECONDS_IN_TWO_MONTHS)
    sixMonthsFromSystemDeployment = await th.getTimeFromSystemDeployment(stblToken, web3, SECONDS_IN_SIX_MONTHS)
    oneYearFromSystemDeployment = await th.getTimeFromSystemDeployment(stblToken, web3, SECONDS_IN_ONE_YEAR)

    justOverTwoMonthsFromSystemDeployment = twoMonthsFromSystemDeployment.add(toBN('1'))
    justOverSixMonthsFromSystemDeployment = sixMonthsFromSystemDeployment.add(toBN('1'))
    justOverOneYearFromSystemDeployment = oneYearFromSystemDeployment.add(toBN('1'))

    const secondsInTwoYears = toBN(timeValues.SECONDS_IN_ONE_YEAR).mul(toBN('2'))
    const secondsIn18Months = toBN(timeValues.SECONDS_IN_ONE_MONTH).mul(toBN('18'))
    twoYearsFromSystemDeployment = await th.getTimeFromSystemDeployment(stblToken, web3, secondsInTwoYears)
    _18monthsFromSystemDeployment = await th.getTimeFromSystemDeployment(stblToken, web3, secondsIn18Months)

    // Deploy 3 LCs for team members on vesting schedules
    const deployedLCtx_T1 = await lockupContractFactory.deployTwoMonthsLockupContract(teamMember_1, twoMonthsFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_T2 = await lockupContractFactory.deployTwoMonthsLockupContract(teamMember_2, twoMonthsFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_T3 = await lockupContractFactory.deployTwoMonthsLockupContract(teamMember_3, twoMonthsFromSystemDeployment, { from: liquityAG })

    const deployedLCtx_T4 = await lockupContractFactory.deploySixMonthsLockupContract(teamMember_4, sixMonthsFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_T5 = await lockupContractFactory.deploySixMonthsLockupContract(teamMember_5, sixMonthsFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_T6 = await lockupContractFactory.deploySixMonthsLockupContract(teamMember_6, sixMonthsFromSystemDeployment, { from: liquityAG })

    const deployedLCtx_T7 = await lockupContractFactory.deployOneYearLockupContract(teamMember_7, oneYearFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_T8 = await lockupContractFactory.deployOneYearLockupContract(teamMember_8, oneYearFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_T9 = await lockupContractFactory.deployOneYearLockupContract(teamMember_9, oneYearFromSystemDeployment, { from: liquityAG })

    const deployedLCtx_I1 = await lockupContractFactory.deployTwoMonthsLockupContract(investor_1, twoMonthsFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_I2 = await lockupContractFactory.deployTwoMonthsLockupContract(investor_2, twoMonthsFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_I3 = await lockupContractFactory.deployTwoMonthsLockupContract(investor_3, twoMonthsFromSystemDeployment, { from: liquityAG })

    const deployedLCtx_I4 = await lockupContractFactory.deploySixMonthsLockupContract(investor_4, sixMonthsFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_I5 = await lockupContractFactory.deploySixMonthsLockupContract(investor_5, sixMonthsFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_I6 = await lockupContractFactory.deploySixMonthsLockupContract(investor_6, sixMonthsFromSystemDeployment, { from: liquityAG })

    const deployedLCtx_I7 = await lockupContractFactory.deployOneYearLockupContract(investor_7, oneYearFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_I8 = await lockupContractFactory.deployOneYearLockupContract(investor_8, oneYearFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_I9 = await lockupContractFactory.deployOneYearLockupContract(investor_9, oneYearFromSystemDeployment, { from: liquityAG })

    // LCs for team members on vesting schedules
    LC_T1 = await th.getLCFromDeploymentTx(deployedLCtx_T1)
    LC_T2 = await th.getLCFromDeploymentTx(deployedLCtx_T2)
    LC_T3 = await th.getLCFromDeploymentTx(deployedLCtx_T3)
    LC_T4 = await th.getLCFromDeploymentTx(deployedLCtx_T4)
    LC_T5 = await th.getLCFromDeploymentTx(deployedLCtx_T5)
    LC_T6 = await th.getLCFromDeploymentTx(deployedLCtx_T6)
    LC_T7 = await th.getLCFromDeploymentTx(deployedLCtx_T7)
    LC_T8 = await th.getLCFromDeploymentTx(deployedLCtx_T8)
    LC_T9 = await th.getLCFromDeploymentTx(deployedLCtx_T9)

    // LCs for investors
    LC_I1 = await th.getLCFromDeploymentTx(deployedLCtx_I1)
    LC_I2 = await th.getLCFromDeploymentTx(deployedLCtx_I2)
    LC_I3 = await th.getLCFromDeploymentTx(deployedLCtx_I3)
    LC_I4 = await th.getLCFromDeploymentTx(deployedLCtx_I4)
    LC_I5 = await th.getLCFromDeploymentTx(deployedLCtx_I5)
    LC_I6 = await th.getLCFromDeploymentTx(deployedLCtx_I6)
    LC_I7 = await th.getLCFromDeploymentTx(deployedLCtx_I7)
    LC_I8 = await th.getLCFromDeploymentTx(deployedLCtx_I8)
    LC_I9 = await th.getLCFromDeploymentTx(deployedLCtx_I9)

    // Multisig transfers initial STBL entitlements to LCs
    await stblToken.transfer(LC_T1.address, teamMemberInitialEntitlement_1, { from: momentZeroMultisig })
    await stblToken.transfer(LC_T2.address, teamMemberInitialEntitlement_2, { from: momentZeroMultisig })
    await stblToken.transfer(LC_T3.address, teamMemberInitialEntitlement_3, { from: momentZeroMultisig })

    await stblToken.transfer(LC_T4.address, teamMemberInitialEntitlement_4, { from: sixMonthsMultisig })
    await stblToken.transfer(LC_T5.address, teamMemberInitialEntitlement_5, { from: sixMonthsMultisig })
    await stblToken.transfer(LC_T6.address, teamMemberInitialEntitlement_6, { from: sixMonthsMultisig })

    await stblToken.transfer(LC_T7.address, teamMemberInitialEntitlement_7, { from: oneYearMultisig })
    await stblToken.transfer(LC_T8.address, teamMemberInitialEntitlement_8, { from: oneYearMultisig })
    await stblToken.transfer(LC_T9.address, teamMemberInitialEntitlement_9, { from: oneYearMultisig })

    await stblToken.transfer(LC_I1.address, investorInitialEntitlement_1, { from: momentZeroMultisig })
    await stblToken.transfer(LC_I2.address, investorInitialEntitlement_2, { from: momentZeroMultisig })
    await stblToken.transfer(LC_I3.address, investorInitialEntitlement_3, { from: momentZeroMultisig })

    await stblToken.transfer(LC_I4.address, investorInitialEntitlement_4, { from: sixMonthsMultisig })
    await stblToken.transfer(LC_I5.address, investorInitialEntitlement_5, { from: sixMonthsMultisig })
    await stblToken.transfer(LC_I6.address, investorInitialEntitlement_6, { from: sixMonthsMultisig })

    await stblToken.transfer(LC_I7.address, investorInitialEntitlement_7, { from: oneYearMultisig })
    await stblToken.transfer(LC_I8.address, investorInitialEntitlement_8, { from: oneYearMultisig })
    await stblToken.transfer(LC_I9.address, investorInitialEntitlement_9, { from: oneYearMultisig })

    const systemDeploymentTime = await stblToken.getDeploymentStartTime()

    // Every thirty days, multisig transfers vesting amounts to team members
    for (i = 0; i < 12; i++) {
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      await stblToken.transfer(LC_T1.address, teamMemberMonthlyVesting_1, { from: momentZeroMultisig })
      await stblToken.transfer(LC_T2.address, teamMemberMonthlyVesting_2, { from: momentZeroMultisig })
      await stblToken.transfer(LC_T3.address, teamMemberMonthlyVesting_3, { from: momentZeroMultisig })

      await stblToken.transfer(LC_T4.address, teamMemberMonthlyVesting_4, { from: sixMonthsMultisig })
      await stblToken.transfer(LC_T5.address, teamMemberMonthlyVesting_5, { from: sixMonthsMultisig })
      await stblToken.transfer(LC_T6.address, teamMemberMonthlyVesting_6, { from: sixMonthsMultisig })

      await stblToken.transfer(LC_T7.address, teamMemberMonthlyVesting_7, { from: oneYearMultisig })
      await stblToken.transfer(LC_T8.address, teamMemberMonthlyVesting_8, { from: oneYearMultisig })
      await stblToken.transfer(LC_T9.address, teamMemberMonthlyVesting_9, { from: oneYearMultisig })
    }

    // After Since only 360 days have passed, fast forward 5 more days, until LCs unlock
    await th.fastForwardTime((SECONDS_IN_ONE_DAY * 5), web3.currentProvider)

    const endTime = toBN(await th.getLatestBlockTimestamp(web3))

    const timePassed = endTime.sub(systemDeploymentTime)
    // Confirm that just over one year has passed -  not more than 1000 seconds 
    assert.isTrue(timePassed.sub(toBN(SECONDS_IN_ONE_YEAR)).lt(toBN('1000')))
    assert.isTrue(timePassed.sub(toBN(SECONDS_IN_ONE_YEAR)).gt(toBN('0')))
  })

  describe('Deploying new LCs', async accounts => {
    it("STBL Deployer can deploy new LCs", async () => {
      // STBL deployer deploys LCs
      const LCDeploymentTx_A = await lockupContractFactory.deployTwoMonthsLockupContract(A, justOverOneYearFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_B = await lockupContractFactory.deployTwoMonthsLockupContract(B, oneYearFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_C = await lockupContractFactory.deployTwoMonthsLockupContract(C, '9595995999999900000023423234', { from: liquityAG })

      const LCDeploymentTx_D = await lockupContractFactory.deploySixMonthsLockupContract(D, justOverOneYearFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_E = await lockupContractFactory.deploySixMonthsLockupContract(E, oneYearFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_F = await lockupContractFactory.deploySixMonthsLockupContract(F, '9595995999999900000023423234', { from: liquityAG })

      const LCDeploymentTx_G = await lockupContractFactory.deployOneYearLockupContract(G, justOverOneYearFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_H = await lockupContractFactory.deployOneYearLockupContract(H, oneYearFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_I = await lockupContractFactory.deployOneYearLockupContract(I, '9595995999999900000023423234', { from: liquityAG })

      assert.isTrue(LCDeploymentTx_A.receipt.status)
      assert.isTrue(LCDeploymentTx_B.receipt.status)
      assert.isTrue(LCDeploymentTx_C.receipt.status)
      assert.isTrue(LCDeploymentTx_D.receipt.status)
      assert.isTrue(LCDeploymentTx_E.receipt.status)
      assert.isTrue(LCDeploymentTx_F.receipt.status)
      assert.isTrue(LCDeploymentTx_G.receipt.status)
      assert.isTrue(LCDeploymentTx_H.receipt.status)
      assert.isTrue(LCDeploymentTx_I.receipt.status)
    })

    it("Anyone can deploy new LCs", async () => {
      // Various EOAs deploy LCs
      const LCDeploymentTx_1 = await lockupContractFactory.deployTwoMonthsLockupContract(A, justOverOneYearFromSystemDeployment, { from: teamMember_1 })
      const LCDeploymentTx_2 = await lockupContractFactory.deployTwoMonthsLockupContract(C, oneYearFromSystemDeployment, { from: investor_2 })
      const LCDeploymentTx_3 = await lockupContractFactory.deployTwoMonthsLockupContract(liquityAG, '9595995999999900000023423234', { from: P })

      const LCDeploymentTx_4 = await lockupContractFactory.deploySixMonthsLockupContract(F , justOverOneYearFromSystemDeployment, { from: teamMember_3 })
      const LCDeploymentTx_5 = await lockupContractFactory.deploySixMonthsLockupContract(G, oneYearFromSystemDeployment, { from: investor_4 })
      const LCDeploymentTx_6 = await lockupContractFactory.deploySixMonthsLockupContract(liquityAG, '9595995999999900000023423234', { from: M })

      const LCDeploymentTx_7 = await lockupContractFactory.deployOneYearLockupContract(H, justOverOneYearFromSystemDeployment, { from: teamMember_5 })
      const LCDeploymentTx_8 = await lockupContractFactory.deployOneYearLockupContract(I, oneYearFromSystemDeployment, { from: investor_6 })
      const LCDeploymentTx_9 = await lockupContractFactory.deployOneYearLockupContract(liquityAG, '9595995999999900000023423234', { from: N })

      assert.isTrue(LCDeploymentTx_1.receipt.status)
      assert.isTrue(LCDeploymentTx_2.receipt.status)
      assert.isTrue(LCDeploymentTx_3.receipt.status)
      assert.isTrue(LCDeploymentTx_4.receipt.status)
      assert.isTrue(LCDeploymentTx_5.receipt.status)
      assert.isTrue(LCDeploymentTx_6.receipt.status)
      assert.isTrue(LCDeploymentTx_7.receipt.status)
      assert.isTrue(LCDeploymentTx_8.receipt.status)
      assert.isTrue(LCDeploymentTx_9.receipt.status)
    })

    it("Anyone can deploy new LCs with unlockTime in the past", async () => {
      await th.fastForwardTime(timeValues.SECONDS_IN_TWO_MONTHS, web3.currentProvider )
      // Various EOAs deploy LCs
      const LCDeploymentTx_1 = await lockupContractFactory.deployTwoMonthsLockupContract(A, justOverTwoMonthsFromSystemDeployment, { from: teamMember_1 })
      const LCDeploymentTx_2 = await lockupContractFactory.deployTwoMonthsLockupContract(B, sixMonthsFromSystemDeployment, { from: E })
      
      const LC_1 = await th.getLCFromDeploymentTx(LCDeploymentTx_1)
      const LC_2 = await th.getLCFromDeploymentTx(LCDeploymentTx_2)

      // Check deployments succeeded
      assert.isTrue(LCDeploymentTx_1.receipt.status)
      assert.isTrue(LCDeploymentTx_2.receipt.status)

      // Check LCs have unlockTimes in the past
      unlockTime_1 = await LC_1.unlockTime()
      unlockTime_2 = await LC_2.unlockTime()

      const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
      assert.isTrue(unlockTime_1.lt(currentTime))
      assert.isTrue(unlockTime_2.lt(currentTime))
    })

    it("Anyone can deploy new LCs with unlockTime in the past", async () => {
      await th.fastForwardTime(timeValues.SECONDS_IN_SIX_MONTHS, web3.currentProvider )
      // Various EOAs deploy LCs
      const LCDeploymentTx_1 = await lockupContractFactory.deploySixMonthsLockupContract(A, justOverSixMonthsFromSystemDeployment, { from: teamMember_1 })
      const LCDeploymentTx_2 = await lockupContractFactory.deploySixMonthsLockupContract(B, oneYearFromSystemDeployment, { from: E })
      const LCDeploymentTx_3 = await lockupContractFactory.deploySixMonthsLockupContract(C, _18monthsFromSystemDeployment, { from: sixMonthsMultisig })
      
      const LC_1 = await th.getLCFromDeploymentTx(LCDeploymentTx_1)
      const LC_2 = await th.getLCFromDeploymentTx(LCDeploymentTx_2)
      const LC_3 = await th.getLCFromDeploymentTx(LCDeploymentTx_3)

      // Check deployments succeeded
      assert.isTrue(LCDeploymentTx_1.receipt.status)
      assert.isTrue(LCDeploymentTx_2.receipt.status)
      assert.isTrue(LCDeploymentTx_3.receipt.status)

      // Check LCs have unlockTimes in the past
      unlockTime_1 = await LC_1.unlockTime()
      unlockTime_2 = await LC_2.unlockTime()
      unlockTime_3 = await LC_3.unlockTime()

      const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
      assert.isTrue(unlockTime_1.lt(currentTime))
      assert.isTrue(unlockTime_2.lt(currentTime))
      assert.isTrue(unlockTime_3.lt(currentTime))
    })

    it("Anyone can deploy new LCs with unlockTime in the past", async () => {
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider )
      // Various EOAs deploy LCs
      const LCDeploymentTx_1 = await lockupContractFactory.deployOneYearLockupContract(A, justOverOneYearFromSystemDeployment, { from: teamMember_1 })
      const LCDeploymentTx_2 = await lockupContractFactory.deployOneYearLockupContract(B, oneYearFromSystemDeployment, { from: E })
      const LCDeploymentTx_3 = await lockupContractFactory.deployOneYearLockupContract(C, _18monthsFromSystemDeployment, { from: oneYearMultisig })
      
      const LC_1 = await th.getLCFromDeploymentTx(LCDeploymentTx_1)
      const LC_2 = await th.getLCFromDeploymentTx(LCDeploymentTx_2)
      const LC_3 = await th.getLCFromDeploymentTx(LCDeploymentTx_3)

      // Check deployments succeeded
      assert.isTrue(LCDeploymentTx_1.receipt.status)
      assert.isTrue(LCDeploymentTx_2.receipt.status)
      assert.isTrue(LCDeploymentTx_3.receipt.status)

      // Check LCs have unlockTimes in the past
      unlockTime_1 = await LC_1.unlockTime()
      unlockTime_2 = await LC_2.unlockTime()
      unlockTime_3 = await LC_3.unlockTime()

      const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
      assert.isTrue(unlockTime_1.lt(currentTime))
      assert.isTrue(unlockTime_2.lt(currentTime))
      assert.isTrue(unlockTime_3.lt(currentTime))
    })

    it("Anyone can deploy new LCs with unlockTime in the future", async () => {
      // Various EOAs deploy LCs
      const LCDeploymentTx_1 = await lockupContractFactory.deployOneYearLockupContract(A, twoYearsFromSystemDeployment, { from: teamMember_1 })
      const LCDeploymentTx_2 = await lockupContractFactory.deployOneYearLockupContract(B, _18monthsFromSystemDeployment, { from: E })
    
      const LC_1 = await th.getLCFromDeploymentTx(LCDeploymentTx_1)
      const LC_2 = await th.getLCFromDeploymentTx(LCDeploymentTx_2)

      // Check deployments succeeded
      assert.isTrue(LCDeploymentTx_1.receipt.status)
      assert.isTrue(LCDeploymentTx_2.receipt.status)

      // Check LCs have unlockTimes in the future
      unlockTime_1 = await LC_1.unlockTime()
      unlockTime_2 = await LC_2.unlockTime()

      const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
      assert.isTrue(unlockTime_1.gt(currentTime))
      assert.isTrue(unlockTime_2.gt(currentTime))
    })
  })

  describe('Beneficiary withdrawal from initial LC', async accounts => {
    it("A beneficiary can withdraw their full entitlement from their LC", async () => {

      // Check STBL balances of investors' LCs are equal to their initial entitlements
      assert.equal(await stblToken.balanceOf(LC_I1.address), investorInitialEntitlement_1)
      assert.equal(await stblToken.balanceOf(LC_I2.address), investorInitialEntitlement_2)
      assert.equal(await stblToken.balanceOf(LC_I3.address), investorInitialEntitlement_3)

      // Check STBL balances of investors' LCs are equal to their initial entitlements
      assert.equal(await stblToken.balanceOf(LC_I4.address), investorInitialEntitlement_4)
      assert.equal(await stblToken.balanceOf(LC_I5.address), investorInitialEntitlement_5)
      assert.equal(await stblToken.balanceOf(LC_I6.address), investorInitialEntitlement_6)

      // Check STBL balances of investors' LCs are equal to their initial entitlements
      assert.equal(await stblToken.balanceOf(LC_I7.address), investorInitialEntitlement_7)
      assert.equal(await stblToken.balanceOf(LC_I8.address), investorInitialEntitlement_8)
      assert.equal(await stblToken.balanceOf(LC_I9.address), investorInitialEntitlement_9)

      // Check STBL balances of investors are 0
      assert.equal(await stblToken.balanceOf(investor_1), '0')
      assert.equal(await stblToken.balanceOf(investor_2), '0')
      assert.equal(await stblToken.balanceOf(investor_3), '0')

      // Check STBL balances of investors are 0
      assert.equal(await stblToken.balanceOf(investor_4), '0')
      assert.equal(await stblToken.balanceOf(investor_5), '0')
      assert.equal(await stblToken.balanceOf(investor_6), '0')

      // Check STBL balances of investors are 0
      assert.equal(await stblToken.balanceOf(investor_7), '0')
      assert.equal(await stblToken.balanceOf(investor_8), '0')
      assert.equal(await stblToken.balanceOf(investor_9), '0')

      // All investors withdraw from their respective LCs
      await LC_I1.withdrawSTBL({ from: investor_1 })
      await LC_I2.withdrawSTBL({ from: investor_2 })
      await LC_I3.withdrawSTBL({ from: investor_3 })
      await LC_I4.withdrawSTBL({ from: investor_4 })
      await LC_I5.withdrawSTBL({ from: investor_5 })
      await LC_I6.withdrawSTBL({ from: investor_6 })
      await LC_I7.withdrawSTBL({ from: investor_7 })
      await LC_I8.withdrawSTBL({ from: investor_8 })
      await LC_I9.withdrawSTBL({ from: investor_9 })

      // Check STBL balances of investors now equal their entitlements
      assert.equal(await stblToken.balanceOf(investor_1), investorInitialEntitlement_1)
      assert.equal(await stblToken.balanceOf(investor_2), investorInitialEntitlement_2)
      assert.equal(await stblToken.balanceOf(investor_3), investorInitialEntitlement_3)
      assert.equal(await stblToken.balanceOf(investor_4), investorInitialEntitlement_4)
      assert.equal(await stblToken.balanceOf(investor_5), investorInitialEntitlement_5)
      assert.equal(await stblToken.balanceOf(investor_6), investorInitialEntitlement_6)
      assert.equal(await stblToken.balanceOf(investor_7), investorInitialEntitlement_7)
      assert.equal(await stblToken.balanceOf(investor_8), investorInitialEntitlement_8)
      assert.equal(await stblToken.balanceOf(investor_9), investorInitialEntitlement_9)

      // Check STBL balances of investors' LCs are now 0
      assert.equal(await stblToken.balanceOf(LC_I1.address), '0')
      assert.equal(await stblToken.balanceOf(LC_I2.address), '0')
      assert.equal(await stblToken.balanceOf(LC_I3.address), '0')
      assert.equal(await stblToken.balanceOf(LC_I4.address), '0')
      assert.equal(await stblToken.balanceOf(LC_I5.address), '0')
      assert.equal(await stblToken.balanceOf(LC_I6.address), '0')
      assert.equal(await stblToken.balanceOf(LC_I7.address), '0')
      assert.equal(await stblToken.balanceOf(LC_I8.address), '0')
      assert.equal(await stblToken.balanceOf(LC_I9.address), '0')
    })

    it("A beneficiary on a vesting schedule can withdraw their total vested amount from their LC", async () => {
      // Get STBL balances of LCs for beneficiaries (team members) on vesting schedules
      const STBLBalanceOfLC_T1_Before = await stblToken.balanceOf(LC_T1.address)
      const STBLBalanceOfLC_T2_Before = await stblToken.balanceOf(LC_T2.address)
      const STBLBalanceOfLC_T3_Before = await stblToken.balanceOf(LC_T3.address)

      // Check STBL balances of vesting beneficiaries' LCs are greater than their initial entitlements
      assert.isTrue(STBLBalanceOfLC_T1_Before.gt(th.toBN(teamMemberInitialEntitlement_1)))
      assert.isTrue(STBLBalanceOfLC_T2_Before.gt(th.toBN(teamMemberInitialEntitlement_2)))
      assert.isTrue(STBLBalanceOfLC_T3_Before.gt(th.toBN(teamMemberInitialEntitlement_3)))

      // Check STBL balances of beneficiaries are 0
      assert.equal(await stblToken.balanceOf(teamMember_1), '0')
      assert.equal(await stblToken.balanceOf(teamMember_2), '0')
      assert.equal(await stblToken.balanceOf(teamMember_3), '0')

      // All beneficiaries withdraw from their respective LCs
      await LC_T1.withdrawSTBL({ from: teamMember_1 })
      await LC_T2.withdrawSTBL({ from: teamMember_2 })
      await LC_T3.withdrawSTBL({ from: teamMember_3 })

      // Check beneficiaries' STBL balances now equal their accumulated vested entitlements
      assert.isTrue((await stblToken.balanceOf(teamMember_1)).eq(STBLBalanceOfLC_T1_Before))
      assert.isTrue((await stblToken.balanceOf(teamMember_2)).eq(STBLBalanceOfLC_T2_Before))
      assert.isTrue((await stblToken.balanceOf(teamMember_3)).eq(STBLBalanceOfLC_T3_Before))

      // Check STBL balances of beneficiaries' LCs are now 0
      assert.equal(await stblToken.balanceOf(LC_T1.address), '0')
      assert.equal(await stblToken.balanceOf(LC_T2.address), '0')
      assert.equal(await stblToken.balanceOf(LC_T3.address), '0')
    })

    it("Beneficiaries can withraw full STBL balance of LC if it has increased since lockup period ended", async () => {
      // Check STBL balances of investors' LCs are equal to their initial entitlements
      assert.equal(await stblToken.balanceOf(LC_I1.address), investorInitialEntitlement_1)
      assert.equal(await stblToken.balanceOf(LC_I2.address), investorInitialEntitlement_2)
      assert.equal(await stblToken.balanceOf(LC_I3.address), investorInitialEntitlement_3)

      // Check STBL balances of investors are 0
      assert.equal(await stblToken.balanceOf(investor_1), '0')
      assert.equal(await stblToken.balanceOf(investor_2), '0')
      assert.equal(await stblToken.balanceOf(investor_3), '0')

      // STBL multisig sends extra STBL to investor LCs
      await stblToken.transfer(LC_I1.address, dec(1, 18), { from: oneYearMultisig })
      await stblToken.transfer(LC_I2.address, dec(2, 18), { from: oneYearMultisig })
      await stblToken.transfer(LC_I3.address, dec(3, 18), { from: oneYearMultisig })

      // 1 month passes
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // STBL multisig again sends extra STBL to investor LCs
      await stblToken.transfer(LC_I1.address, dec(1, 18), { from: oneYearMultisig })
      await stblToken.transfer(LC_I2.address, dec(2, 18), { from: oneYearMultisig })
      await stblToken.transfer(LC_I3.address, dec(3, 18), { from: oneYearMultisig })

      // Get STBL balances of LCs for investors 
      const STBLBalanceOfLC_I1_Before = await stblToken.balanceOf(LC_I1.address)
      const STBLBalanceOfLC_I2_Before = await stblToken.balanceOf(LC_I2.address)
      const STBLBalanceOfLC_I3_Before = await stblToken.balanceOf(LC_I3.address)

      // Check STBL balances of investors' LCs are greater than their initial entitlements
      assert.isTrue(STBLBalanceOfLC_I1_Before.gt(th.toBN(investorInitialEntitlement_1)))
      assert.isTrue(STBLBalanceOfLC_I2_Before.gt(th.toBN(investorInitialEntitlement_2)))
      assert.isTrue(STBLBalanceOfLC_I3_Before.gt(th.toBN(investorInitialEntitlement_3)))

      // All investors withdraw from their respective LCs
      await LC_I1.withdrawSTBL({ from: investor_1 })
      await LC_I2.withdrawSTBL({ from: investor_2 })
      await LC_I3.withdrawSTBL({ from: investor_3 })

      // Check STBL balances of investors now equal their LC balances prior to withdrawal
      assert.isTrue((await stblToken.balanceOf(investor_1)).eq(STBLBalanceOfLC_I1_Before))
      assert.isTrue((await stblToken.balanceOf(investor_2)).eq(STBLBalanceOfLC_I2_Before))
      assert.isTrue((await stblToken.balanceOf(investor_3)).eq(STBLBalanceOfLC_I3_Before))

      // Check STBL balances of investors' LCs are now 0
      assert.equal(await stblToken.balanceOf(LC_I1.address), '0')
      assert.equal(await stblToken.balanceOf(LC_I2.address), '0')
      assert.equal(await stblToken.balanceOf(LC_I3.address), '0')
    })
  })

  describe('Withdrawal attempts from LCs by non-beneficiaries', async accounts => {
    it("STBL Multisig can't withdraw from a LC they deployed through the Factory", async () => {
      try {
        const withdrawalAttempt = await LC_T1.withdrawSTBL({ from: oneYearMultisig })
        assert.isFalse(withdrawalAttempt.receipt.status)
      } catch (error) {
        assert.include(error.message, "LockupContract: caller is not the beneficiary")
      }
    })

    it("STBL Multisig can't withdraw from a LC that someone else deployed", async () => {
      // Account D deploys a new LC via the Factory
      const deployedLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, oneYearFromSystemDeployment, { from: D })
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

      //STBL multisig fund the newly deployed LCs
      await stblToken.transfer(LC_B.address, dec(2, 18), { from: momentZeroMultisig })
      //STBL multisig fund the newly deployed LCs
      await stblToken.transfer(LC_B.address, dec(2, 18), { from: sixMonthsMultisig })
      //STBL multisig fund the newly deployed LCs
      await stblToken.transfer(LC_B.address, dec(2, 18), { from: oneYearMultisig })

      // STBL multisig attempts withdrawal from LC
      try {
        const withdrawalAttempt_B = await LC_B.withdrawSTBL({ from: momentZeroMultisig })
        assert.isFalse(withdrawalAttempt_B.receipt.status)
      } catch (error) {
        assert.include(error.message, "LockupContract: caller is not the beneficiary")
      }

      try {
        const withdrawalAttempt_B = await LC_B.withdrawSTBL({ from: sixMonthsMultisig })
        assert.isFalse(withdrawalAttempt_B.receipt.status)
      } catch (error) {
        assert.include(error.message, "LockupContract: caller is not the beneficiary")
      }

      try {
        const withdrawalAttempt_B = await LC_B.withdrawSTBL({ from: oneYearMultisig })
        assert.isFalse(withdrawalAttempt_B.receipt.status)
      } catch (error) {
        assert.include(error.message, "LockupContract: caller is not the beneficiary")
      }
    })

    it("Non-beneficiaries cannot withdraw from a LC", async () => {
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

      // Several EOAs attempt to withdraw from the LC that has teamMember_2 as beneficiary
      for (account of variousEOAs) {
        try {
          const withdrawalAttempt = await LC_T2.withdrawSTBL({ from: account })
          assert.isFalse(withdrawalAttempt.receipt.status)
        } catch (error) {
          assert.include(error.message, "LockupContract: caller is not the beneficiary")
        }
      }
    })
  })

  describe('Transferring STBL', async accounts => {
    it("STBL multisig can transfer STBL to LCs they deployed", async () => {
      const initialSTBLBalanceOfLC_T1 = await stblToken.balanceOf(LC_T1.address)
      const initialSTBLBalanceOfLC_T2 = await stblToken.balanceOf(LC_T2.address)
      const initialSTBLBalanceOfLC_T3 = await stblToken.balanceOf(LC_T3.address)
      const initialSTBLBalanceOfLC_T4 = await stblToken.balanceOf(LC_T4.address)
      const initialSTBLBalanceOfLC_T5 = await stblToken.balanceOf(LC_T5.address)
      const initialSTBLBalanceOfLC_T6 = await stblToken.balanceOf(LC_T6.address)
      const initialSTBLBalanceOfLC_T7 = await stblToken.balanceOf(LC_T7.address)
      const initialSTBLBalanceOfLC_T8 = await stblToken.balanceOf(LC_T8.address)
      const initialSTBLBalanceOfLC_T9 = await stblToken.balanceOf(LC_T9.address)

      // One month passes
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // STBL multisig transfers vesting amount
      await stblToken.transfer(LC_T1.address, dec(1, 18), { from: momentZeroMultisig })
      await stblToken.transfer(LC_T2.address, dec(1, 18), { from: momentZeroMultisig })
      await stblToken.transfer(LC_T3.address, dec(1, 18), { from: momentZeroMultisig })
      await stblToken.transfer(LC_T4.address, dec(1, 18), { from: sixMonthsMultisig })
      await stblToken.transfer(LC_T5.address, dec(1, 18), { from: sixMonthsMultisig })
      await stblToken.transfer(LC_T6.address, dec(1, 18), { from: sixMonthsMultisig })
      await stblToken.transfer(LC_T7.address, dec(1, 18), { from: oneYearMultisig })
      await stblToken.transfer(LC_T8.address, dec(1, 18), { from: oneYearMultisig })
      await stblToken.transfer(LC_T9.address, dec(1, 18), { from: oneYearMultisig })

      // Get new LC STBL balances
      const STBLBalanceOfLC_T1_1 = await stblToken.balanceOf(LC_T1.address)
      const STBLBalanceOfLC_T2_1 = await stblToken.balanceOf(LC_T2.address)
      const STBLBalanceOfLC_T3_1 = await stblToken.balanceOf(LC_T3.address)
      const STBLBalanceOfLC_T4_1 = await stblToken.balanceOf(LC_T4.address)
      const STBLBalanceOfLC_T5_1 = await stblToken.balanceOf(LC_T5.address)
      const STBLBalanceOfLC_T6_1 = await stblToken.balanceOf(LC_T6.address)
      const STBLBalanceOfLC_T7_1 = await stblToken.balanceOf(LC_T7.address)
      const STBLBalanceOfLC_T8_1 = await stblToken.balanceOf(LC_T8.address)
      const STBLBalanceOfLC_T9_1 = await stblToken.balanceOf(LC_T9.address)

      // // Check team member LC balances have increased 
      assert.isTrue(STBLBalanceOfLC_T1_1.eq(th.toBN(initialSTBLBalanceOfLC_T1).add(th.toBN(dec(1, 18)))))
      assert.isTrue(STBLBalanceOfLC_T2_1.eq(th.toBN(initialSTBLBalanceOfLC_T2).add(th.toBN(dec(1, 18)))))
      assert.isTrue(STBLBalanceOfLC_T3_1.eq(th.toBN(initialSTBLBalanceOfLC_T3).add(th.toBN(dec(1, 18)))))
      assert.isTrue(STBLBalanceOfLC_T4_1.eq(th.toBN(initialSTBLBalanceOfLC_T4).add(th.toBN(dec(1, 18)))))
      assert.isTrue(STBLBalanceOfLC_T5_1.eq(th.toBN(initialSTBLBalanceOfLC_T5).add(th.toBN(dec(1, 18)))))
      assert.isTrue(STBLBalanceOfLC_T6_1.eq(th.toBN(initialSTBLBalanceOfLC_T6).add(th.toBN(dec(1, 18)))))
      assert.isTrue(STBLBalanceOfLC_T7_1.eq(th.toBN(initialSTBLBalanceOfLC_T7).add(th.toBN(dec(1, 18)))))
      assert.isTrue(STBLBalanceOfLC_T8_1.eq(th.toBN(initialSTBLBalanceOfLC_T8).add(th.toBN(dec(1, 18)))))
      assert.isTrue(STBLBalanceOfLC_T9_1.eq(th.toBN(initialSTBLBalanceOfLC_T9).add(th.toBN(dec(1, 18)))))

      // Another month passes
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // STBL multisig transfers vesting amount 
      await stblToken.transfer(LC_T1.address, dec(1, 18), { from: momentZeroMultisig })
      await stblToken.transfer(LC_T2.address, dec(1, 18), { from: momentZeroMultisig })
      await stblToken.transfer(LC_T3.address, dec(1, 18), { from: momentZeroMultisig })

      await stblToken.transfer(LC_T4.address, dec(1, 18), { from: sixMonthsMultisig })
      await stblToken.transfer(LC_T5.address, dec(1, 18), { from: sixMonthsMultisig })
      await stblToken.transfer(LC_T6.address, dec(1, 18), { from: sixMonthsMultisig })

      await stblToken.transfer(LC_T7.address, dec(1, 18), { from: oneYearMultisig })
      await stblToken.transfer(LC_T8.address, dec(1, 18), { from: oneYearMultisig })
      await stblToken.transfer(LC_T9.address, dec(1, 18), { from: oneYearMultisig })

      // Get new LC STBL balances
      const STBLBalanceOfLC_T1_2 = await stblToken.balanceOf(LC_T1.address)
      const STBLBalanceOfLC_T2_2 = await stblToken.balanceOf(LC_T2.address)
      const STBLBalanceOfLC_T3_2 = await stblToken.balanceOf(LC_T3.address)
      const STBLBalanceOfLC_T4_2 = await stblToken.balanceOf(LC_T4.address)
      const STBLBalanceOfLC_T5_2 = await stblToken.balanceOf(LC_T5.address)
      const STBLBalanceOfLC_T6_2 = await stblToken.balanceOf(LC_T6.address)
      const STBLBalanceOfLC_T7_2 = await stblToken.balanceOf(LC_T7.address)
      const STBLBalanceOfLC_T8_2 = await stblToken.balanceOf(LC_T8.address)
      const STBLBalanceOfLC_T9_2 = await stblToken.balanceOf(LC_T9.address)

      // Check team member LC balances have increased again
      assert.isTrue(STBLBalanceOfLC_T1_2.eq(STBLBalanceOfLC_T1_1.add(th.toBN(dec(1, 18)))))
      assert.isTrue(STBLBalanceOfLC_T2_2.eq(STBLBalanceOfLC_T2_1.add(th.toBN(dec(1, 18)))))
      assert.isTrue(STBLBalanceOfLC_T3_2.eq(STBLBalanceOfLC_T3_1.add(th.toBN(dec(1, 18)))))
      assert.isTrue(STBLBalanceOfLC_T4_2.eq(STBLBalanceOfLC_T4_1.add(th.toBN(dec(1, 18)))))
      assert.isTrue(STBLBalanceOfLC_T5_2.eq(STBLBalanceOfLC_T5_1.add(th.toBN(dec(1, 18)))))
      assert.isTrue(STBLBalanceOfLC_T6_2.eq(STBLBalanceOfLC_T6_1.add(th.toBN(dec(1, 18)))))
      assert.isTrue(STBLBalanceOfLC_T7_2.eq(STBLBalanceOfLC_T7_1.add(th.toBN(dec(1, 18)))))
      assert.isTrue(STBLBalanceOfLC_T8_2.eq(STBLBalanceOfLC_T8_1.add(th.toBN(dec(1, 18)))))
      assert.isTrue(STBLBalanceOfLC_T9_2.eq(STBLBalanceOfLC_T9_1.add(th.toBN(dec(1, 18)))))
    })

    it("STBL multisig can transfer tokens to LCs deployed by anyone", async () => {
      // A, B, C each deploy a lockup contract ith themself as beneficiary
      const deployedLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, oneYearFromSystemDeployment, { from: A })
      const deployedLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, justOverOneYearFromSystemDeployment, { from: B })
      const deployedLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, twoYearsFromSystemDeployment, { from: C })

      const LC_A = await th.getLCFromDeploymentTx(deployedLCtx_A)
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)
      const LC_C = await th.getLCFromDeploymentTx(deployedLCtx_C)

      // Check balances of LCs are 0
      assert.equal(await stblToken.balanceOf(LC_A.address), '0')
      assert.equal(await stblToken.balanceOf(LC_B.address), '0')
      assert.equal(await stblToken.balanceOf(LC_C.address), '0')

      // One month passes
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // STBL multisig transfers STBL to LCs deployed by other accounts
      await stblToken.transfer(LC_A.address, dec(1, 24), { from: momentZeroMultisig })
      await stblToken.transfer(LC_B.address, dec(2, 24), { from: sixMonthsMultisig })
      await stblToken.transfer(LC_C.address, dec(3, 24), { from: oneYearMultisig })

      // Check balances of LCs have increased
      assert.equal(await stblToken.balanceOf(LC_A.address), dec(1, 24))
      assert.equal(await stblToken.balanceOf(LC_B.address), dec(2, 24))
      assert.equal(await stblToken.balanceOf(LC_C.address), dec(3, 24))
    })

    it("STBL multisig can transfer STBL directly to any externally owned account", async () => {
      // Check STBL balances of EOAs
      assert.equal(await stblToken.balanceOf(A), '0')
      assert.equal(await stblToken.balanceOf(B), '0')
      assert.equal(await stblToken.balanceOf(C), '0')

      // STBL multisig transfers STBL to EOAs
      const txA = await stblToken.transfer(A, dec(1, 24), { from: momentZeroMultisig })
      const txB = await stblToken.transfer(B, dec(2, 24), { from: sixMonthsMultisig })
      const txC = await stblToken.transfer(C, dec(3, 24), { from: oneYearMultisig })

      // Check new balances have increased by correct amount
      assert.equal(await stblToken.balanceOf(A), dec(1, 24))
      assert.equal(await stblToken.balanceOf(B), dec(2, 24))
      assert.equal(await stblToken.balanceOf(C), dec(3, 24))
    })

    it("Anyone can transfer STBL to LCs deployed by anyone", async () => {
      // Start D, E, F with some STBL
      await stblToken.transfer(D, dec(1, 24), { from: momentZeroMultisig })
      await stblToken.transfer(E, dec(2, 24), { from: sixMonthsMultisig })
      await stblToken.transfer(F, dec(3, 24), { from: oneYearMultisig })

      // H, I, J deploy lockup contracts with A, B, C as beneficiaries, respectively
      const deployedLCtx_A = await lockupContractFactory.deployTwoMonthsLockupContract(A, oneYearFromSystemDeployment, { from: H })
      const deployedLCtx_B = await lockupContractFactory.deploySixMonthsLockupContract(B, justOverOneYearFromSystemDeployment, { from: I })
      const deployedLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, twoYearsFromSystemDeployment, { from: J })

      // Grab contract addresses from deployment tx events
      const LCAddress_A = await th.getLCAddressFromDeploymentTx(deployedLCtx_A)
      const LCAddress_B = await th.getLCAddressFromDeploymentTx(deployedLCtx_B)
      const LCAddress_C = await th.getLCAddressFromDeploymentTx(deployedLCtx_C)

      // Check balances of LCs are 0
      assert.equal(await stblToken.balanceOf(LCAddress_A), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_B), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_C), '0')

      // D, E, F transfer STBL to LCs
      await stblToken.transfer(LCAddress_A, dec(1, 24), { from: D })
      await stblToken.transfer(LCAddress_B, dec(2, 24), { from: E })
      await stblToken.transfer(LCAddress_C, dec(3, 24), { from: F })

      // Check balances of LCs has increased
      assert.equal(await stblToken.balanceOf(LCAddress_A), dec(1, 24))
      assert.equal(await stblToken.balanceOf(LCAddress_B), dec(2, 24))
      assert.equal(await stblToken.balanceOf(LCAddress_C), dec(3, 24))
    })


    it("Anyone can transfer to an EOA", async () => {
      // Start D, E, liquityAG with some STBL
      await stblToken.unprotectedMint(D, dec(1, 24))
      await stblToken.unprotectedMint(E, dec(2, 24))
      await stblToken.unprotectedMint(liquityAG, dec(3, 24))
      await stblToken.unprotectedMint(oneYearMultisig, dec(4, 24))

      // STBL holders transfer to other EOAs
      const STBLtransferTx_1 = await stblToken.transfer(A, dec(1, 18), { from: D })
      const STBLtransferTx_2 = await stblToken.transfer(liquityAG, dec(1, 18), { from: E })
      const STBLtransferTx_3 = await stblToken.transfer(F, dec(1, 18), { from: liquityAG })
      const STBLtransferTx_4 = await stblToken.transfer(G, dec(1, 18), { from: oneYearMultisig })

      assert.isTrue(STBLtransferTx_1.receipt.status)
      assert.isTrue(STBLtransferTx_2.receipt.status)
      assert.isTrue(STBLtransferTx_3.receipt.status)
      assert.isTrue(STBLtransferTx_4.receipt.status)
    })

    it("Anyone can approve any EOA to spend their STBL", async () => {
      // EOAs approve EOAs to spend STBL
      const STBLapproveTx_1 = await stblToken.approve(A, dec(1, 18), { from: momentZeroMultisig })
      const STBLapproveTx_2 = await stblToken.approve(A, dec(1, 18), { from: sixMonthsMultisig })
      const STBLapproveTx_3 = await stblToken.approve(A, dec(1, 18), { from: oneYearMultisig })
      const STBLapproveTx_4 = await stblToken.approve(B, dec(1, 18), { from: G })
      const STBLapproveTx_5 = await stblToken.approve(liquityAG, dec(1, 18), { from: F })
      await assert.isTrue(STBLapproveTx_1.receipt.status)
      await assert.isTrue(STBLapproveTx_2.receipt.status)
      await assert.isTrue(STBLapproveTx_3.receipt.status)
      await assert.isTrue(STBLapproveTx_4.receipt.status)
      await assert.isTrue(STBLapproveTx_5.receipt.status)
    })

    it("Anyone can increaseAllowance for any EOA or Stabilio contract", async () => {
      // Anyone can increaseAllowance of EOAs to spend STBL
      const STBLIncreaseAllowanceTx_1 = await stblToken.increaseAllowance(A, dec(1, 18), { from: momentZeroMultisig })
      const STBLIncreaseAllowanceTx_2 = await stblToken.increaseAllowance(A, dec(1, 18), { from: sixMonthsMultisig })
      const STBLIncreaseAllowanceTx_3 = await stblToken.increaseAllowance(A, dec(1, 18), { from: oneYearMultisig })
      const STBLIncreaseAllowanceTx_4 = await stblToken.increaseAllowance(B, dec(1, 18), { from: G })
      const STBLIncreaseAllowanceTx_5 = await stblToken.increaseAllowance(momentZeroMultisig, dec(1, 18), { from: F })
      const STBLIncreaseAllowanceTx_6 = await stblToken.increaseAllowance(sixMonthsMultisig, dec(1, 18), { from: F })
      const STBLIncreaseAllowanceTx_7 = await stblToken.increaseAllowance(oneYearMultisig, dec(1, 18), { from: F })
      await assert.isTrue(STBLIncreaseAllowanceTx_1.receipt.status)
      await assert.isTrue(STBLIncreaseAllowanceTx_2.receipt.status)
      await assert.isTrue(STBLIncreaseAllowanceTx_3.receipt.status)
      await assert.isTrue(STBLIncreaseAllowanceTx_4.receipt.status)
      await assert.isTrue(STBLIncreaseAllowanceTx_5.receipt.status)
      await assert.isTrue(STBLIncreaseAllowanceTx_6.receipt.status)
      await assert.isTrue(STBLIncreaseAllowanceTx_7.receipt.status)

      // Increase allowance of Stabilio contracts from F
      for (const contract of Object.keys(coreContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }

      // Increase allowance of Stabilio contracts from multisig
      for (const contract of Object.keys(coreContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: momentZeroMultisig })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }

      // Increase allowance of Stabilio contracts from multisig
      for (const contract of Object.keys(coreContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: sixMonthsMultisig })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }

      // Increase allowance of Stabilio contracts from multisig
      for (const contract of Object.keys(coreContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: oneYearMultisig })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }

      // Increase allowance of STBL contracts from F
      for (const contract of Object.keys(STBLContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.increaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }

      // Increase allowance of LQT contracts from multisig
      for (const contract of Object.keys(STBLContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.increaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: momentZeroMultisig })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }

      for (const contract of Object.keys(STBLContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.increaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: sixMonthsMultisig })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }

      for (const contract of Object.keys(STBLContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.increaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: oneYearMultisig })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }
    })

    it("Anyone can decreaseAllowance for any EOA or Stabilio contract", async () => {
      //First, increase allowance of A, B LiqAG and core contracts
      const STBLapproveTx_1 = await stblToken.approve(A, dec(1, 18), { from: momentZeroMultisig })
      const STBLapproveTx_2 = await stblToken.approve(B, dec(1, 18), { from: sixMonthsMultisig })
      const STBLapproveTx_3 = await stblToken.approve(C, dec(1, 18), { from: oneYearMultisig })
      const STBLapproveTx_4 = await stblToken.approve(B, dec(1, 18), { from: G })
      const STBLapproveTx_5 = await stblToken.approve(momentZeroMultisig, dec(1, 18), { from: F })
      const STBLapproveTx_6 = await stblToken.approve(sixMonthsMultisig, dec(1, 18), { from: F })
      const STBLapproveTx_7 = await stblToken.approve(oneYearMultisig, dec(1, 18), { from: F })
      await assert.isTrue(STBLapproveTx_1.receipt.status)
      await assert.isTrue(STBLapproveTx_2.receipt.status)
      await assert.isTrue(STBLapproveTx_3.receipt.status)
      await assert.isTrue(STBLapproveTx_4.receipt.status)
      await assert.isTrue(STBLapproveTx_5.receipt.status)
      await assert.isTrue(STBLapproveTx_6.receipt.status)
      await assert.isTrue(STBLapproveTx_7.receipt.status)

      // --- SETUP ---

      // IncreaseAllowance of core contracts, from F
      for (const contract of Object.keys(coreContracts)) {
        const STBLtransferTx = await stblToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(STBLtransferTx.receipt.status)
      }

      // IncreaseAllowance of core contracts, from multisig
      for (const contract of Object.keys(coreContracts)) {
        const STBLtransferTx = await stblToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: momentZeroMultisig })
        await assert.isTrue(STBLtransferTx.receipt.status)
      }

      // IncreaseAllowance of core contracts, from multisig
      for (const contract of Object.keys(coreContracts)) {
        const STBLtransferTx = await stblToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: sixMonthsMultisig })
        await assert.isTrue(STBLtransferTx.receipt.status)
      }

      // IncreaseAllowance of core contracts, from multisig
      for (const contract of Object.keys(coreContracts)) {
        const STBLtransferTx = await stblToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: oneYearMultisig })
        await assert.isTrue(STBLtransferTx.receipt.status)
      }

      // Increase allowance of STBL contracts from F
      for (const contract of Object.keys(STBLContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.increaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }

      // Increase allowance of STBL contracts from multisig 
      for (const contract of Object.keys(STBLContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.increaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: momentZeroMultisig })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }

      // Increase allowance of STBL contracts from multisig 
      for (const contract of Object.keys(STBLContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.increaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: sixMonthsMultisig })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }

      // Increase allowance of STBL contracts from multisig 
      for (const contract of Object.keys(STBLContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.increaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: oneYearMultisig })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }

      // --- TEST ---

      // Decrease allowance of A, B, multisig
      const STBLDecreaseAllowanceTx_1 = await stblToken.decreaseAllowance(A, dec(1, 18), { from: momentZeroMultisig })
      const STBLDecreaseAllowanceTx_2 = await stblToken.decreaseAllowance(B, dec(1, 18), { from: sixMonthsMultisig })
      const STBLDecreaseAllowanceTx_3 = await stblToken.decreaseAllowance(C, dec(1, 18), { from: oneYearMultisig })
      const STBLDecreaseAllowanceTx_4 = await stblToken.decreaseAllowance(B, dec(1, 18), { from: G })
      const STBLDecreaseAllowanceTx_5 = await stblToken.decreaseAllowance(momentZeroMultisig, dec(1, 18), { from: F })
      const STBLDecreaseAllowanceTx_6 = await stblToken.decreaseAllowance(sixMonthsMultisig, dec(1, 18), { from: F })
      const STBLDecreaseAllowanceTx_7 = await stblToken.decreaseAllowance(oneYearMultisig, dec(1, 18), { from: F })
      await assert.isTrue(STBLDecreaseAllowanceTx_1.receipt.status)
      await assert.isTrue(STBLDecreaseAllowanceTx_2.receipt.status)
      await assert.isTrue(STBLDecreaseAllowanceTx_3.receipt.status)
      await assert.isTrue(STBLDecreaseAllowanceTx_4.receipt.status)
      await assert.isTrue(STBLDecreaseAllowanceTx_5.receipt.status)
      await assert.isTrue(STBLDecreaseAllowanceTx_6.receipt.status)
      await assert.isTrue(STBLDecreaseAllowanceTx_7.receipt.status)

      // Decrease allowance of core contracts, from F
      for (const contract of Object.keys(coreContracts)) {
        const STBLDecreaseAllowanceTx = await stblToken.decreaseAllowance(coreContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(STBLDecreaseAllowanceTx.receipt.status)
      }

      // Decrease allowance of core contracts from multisig
      for (const contract of Object.keys(coreContracts)) {
        const STBLDecreaseAllowanceTx = await stblToken.decreaseAllowance(coreContracts[contract].address, dec(1, 18), { from: momentZeroMultisig })
        await assert.isTrue(STBLDecreaseAllowanceTx.receipt.status)
      }

      // Decrease allowance of core contracts from multisig
      for (const contract of Object.keys(coreContracts)) {
        const STBLDecreaseAllowanceTx = await stblToken.decreaseAllowance(coreContracts[contract].address, dec(1, 18), { from: sixMonthsMultisig })
        await assert.isTrue(STBLDecreaseAllowanceTx.receipt.status)
      }

      // Decrease allowance of core contracts from multisig
      for (const contract of Object.keys(coreContracts)) {
        const STBLDecreaseAllowanceTx = await stblToken.decreaseAllowance(coreContracts[contract].address, dec(1, 18), { from: oneYearMultisig })
        await assert.isTrue(STBLDecreaseAllowanceTx.receipt.status)
      }

      // Decrease allowance of STBL contracts from F
      for (const contract of Object.keys(STBLContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.decreaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }

      // Decrease allowance of STBL contracts from multisig
      for (const contract of Object.keys(STBLContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.decreaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: momentZeroMultisig })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }

      // Decrease allowance of STBL contracts from multisig
      for (const contract of Object.keys(STBLContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.decreaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: sixMonthsMultisig })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }

      // Decrease allowance of STBL contracts from multisig
      for (const contract of Object.keys(STBLContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.decreaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: oneYearMultisig })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }
    })

    it("Anyone can be the sender in a transferFrom() call", async () => {
      // Fund B, C
      await stblToken.unprotectedMint(B, dec(3, 18))
      await stblToken.unprotectedMint(C, dec(3, 18))

      // LiqAG, B, C approve F, G, multisig respectively
      await stblToken.approve(A, dec(1, 18), { from: momentZeroMultisig })
      await stblToken.approve(A, dec(1, 18), { from: B })
      await stblToken.approve(momentZeroMultisig, dec(1, 18), { from: C })
      await stblToken.approve(F, dec(1, 18), { from: sixMonthsMultisig })
      await stblToken.approve(G, dec(2, 18), { from: B })
      await stblToken.approve(sixMonthsMultisig, dec(1, 18), { from: C })
      await stblToken.approve(F, dec(1, 18), { from: oneYearMultisig })
      await stblToken.approve(oneYearMultisig, dec(1, 18), { from: C })

      // Approved addresses transfer from the address they're approved for
      const STBLtransferFromTx_1 = await stblToken.transferFrom(momentZeroMultisig, F, dec(1, 18), { from: A })
      const STBLtransferFromTx_2 = await stblToken.transferFrom(B, momentZeroMultisig, dec(1, 18), { from: A })
      const STBLtransferFromTx_3 = await stblToken.transferFrom(C, A, dec(1, 18), { from: momentZeroMultisig })
      const STBLtransferFromTx_4 = await stblToken.transferFrom(sixMonthsMultisig, F, dec(1, 18), { from: F })
      const STBLtransferFromTx_5 = await stblToken.transferFrom(B, sixMonthsMultisig, dec(1, 18), { from: G })
      const STBLtransferFromTx_6 = await stblToken.transferFrom(C, A, dec(1, 18), { from: sixMonthsMultisig })
      const STBLtransferFromTx_7 = await stblToken.transferFrom(oneYearMultisig, F, dec(1, 18), { from: F })
      const STBLtransferFromTx_8 = await stblToken.transferFrom(B, oneYearMultisig, dec(1, 18), { from: G })
      const STBLtransferFromTx_9 = await stblToken.transferFrom(C, A, dec(1, 18), { from: oneYearMultisig })
      
      await assert.isTrue(STBLtransferFromTx_1.receipt.status)
      await assert.isTrue(STBLtransferFromTx_2.receipt.status)
      await assert.isTrue(STBLtransferFromTx_3.receipt.status)
      await assert.isTrue(STBLtransferFromTx_4.receipt.status)
      await assert.isTrue(STBLtransferFromTx_5.receipt.status)
      await assert.isTrue(STBLtransferFromTx_6.receipt.status)
      await assert.isTrue(STBLtransferFromTx_7.receipt.status)
      await assert.isTrue(STBLtransferFromTx_8.receipt.status)
      await assert.isTrue(STBLtransferFromTx_9.receipt.status)
    })

    it("Anyone can stake their STBL in the staking contract", async () => {
      // Fund F
      await stblToken.unprotectedMint(F, dec(1, 18))

      const STBLStakingTx_1 = await stblStaking.stake(dec(1, 18), { from: F })
      const STBLStakingTx_2 = await stblStaking.stake(dec(1, 18), { from: momentZeroMultisig })
      const STBLStakingTx_3 = await stblStaking.stake(dec(1, 18), { from: sixMonthsMultisig })
      const STBLStakingTx_4 = await stblStaking.stake(dec(1, 18), { from: oneYearMultisig })
      await assert.isTrue(STBLStakingTx_1.receipt.status)
      await assert.isTrue(STBLStakingTx_2.receipt.status)
      await assert.isTrue(STBLStakingTx_3.receipt.status)
      await assert.isTrue(STBLStakingTx_4.receipt.status)
    })
  })

  describe('Withdrawal Attempts on new LCs before unlockTime has passed', async accounts => {
    it("STBL Deployer can't withdraw from a funded LC they deployed for another beneficiary through the Factory, before the unlockTime", async () => {
      const deployedLCtx_B = await lockupContractFactory.deployTwoMonthsLockupContract(B, _18monthsFromSystemDeployment, { from: D })
      const deployedLCtx_C = await lockupContractFactory.deploySixMonthsLockupContract(C, _18monthsFromSystemDeployment, { from: D })
      const deployedLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, _18monthsFromSystemDeployment, { from: D })
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)
      const LC_C = await th.getLCFromDeploymentTx(deployedLCtx_C)
      const LC_D = await th.getLCFromDeploymentTx(deployedLCtx_D)

      // Check currentTime < unlockTime
      const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
      const unlockTimeB = await LC_B.unlockTime()
      const unlockTimeC = await LC_C.unlockTime()
      const unlockTimeD = await LC_D.unlockTime()
      assert.isTrue(currentTime.lt(unlockTimeB))
      assert.isTrue(currentTime.lt(unlockTimeC))
      assert.isTrue(currentTime.lt(unlockTimeD))

      // STBL multisig attempts withdrawal from LC they deployed through the Factory
      try {
        const withdrawalAttempt = await LC_B.withdrawSTBL({ from: momentZeroMultisig })
        assert.isFalse(withdrawalAttempt.receipt.status)
      } catch (error) {
        assert.include(error.message, "LockupContract: caller is not the beneficiary")
      }

      // STBL multisig attempts withdrawal from LC they deployed through the Factory
      try {
        const withdrawalAttempt = await LC_C.withdrawSTBL({ from: sixMonthsMultisig })
        assert.isFalse(withdrawalAttempt.receipt.status)
      } catch (error) {
        assert.include(error.message, "LockupContract: caller is not the beneficiary")
      }

      // STBL multisig attempts withdrawal from LC they deployed through the Factory
      try {
        const withdrawalAttempt = await LC_D.withdrawSTBL({ from: oneYearMultisig })
        assert.isFalse(withdrawalAttempt.receipt.status)
      } catch (error) {
        assert.include(error.message, "LockupContract: caller is not the beneficiary")
      }
    })

    it("STBL Deployer can't withdraw from a funded LC that someone else deployed, before the unlockTime", async () => {
      // Account D deploys a new LC via the Factory
      const deployedLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, _18monthsFromSystemDeployment, { from: D })
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

      //STBL multisig fund the newly deployed LCs
      await stblToken.transfer(LC_B.address, dec(2, 18), { from: oneYearMultisig })

      // Check currentTime < unlockTime
      const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
      const unlockTime = await LC_B.unlockTime()
      assert.isTrue(currentTime.lt(unlockTime))

      // STBL multisig attempts withdrawal from LCs
      try {
        const withdrawalAttempt_B = await LC_B.withdrawSTBL({ from: oneYearMultisig })
        assert.isFalse(withdrawalAttempt_B.receipt.status)
      } catch (error) {
        assert.include(error.message, "LockupContract: caller is not the beneficiary")
      }
    })

    it("Beneficiary can't withdraw from their funded LC, before the unlockTime", async () => {
      // Account D deploys a new LC via the Factory
      const deployedLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, _18monthsFromSystemDeployment, { from: D })
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

      // STBL multisig funds contracts
      await stblToken.transfer(LC_B.address, dec(2, 18), { from: oneYearMultisig })

      // Check currentTime < unlockTime
      const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
      const unlockTime = await LC_B.unlockTime()
      assert.isTrue(currentTime.lt(unlockTime))

      try {
        const beneficiary = await LC_B.beneficiary()
        const withdrawalAttempt = await LC_B.withdrawSTBL({ from: beneficiary })
        assert.isFalse(withdrawalAttempt.receipt.status)
      } catch (error) {
        assert.include(error.message, "LockupContract: The lockup duration must have passed")
      }
    })

    it("No one can withdraw from a beneficiary's funded LC, before the unlockTime", async () => {
      // Account D deploys a new LC via the Factory
      const deployedLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, _18monthsFromSystemDeployment, { from: D })
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

      // STBL multisig funds contracts
      await stblToken.transfer(LC_B.address, dec(2, 18), { from: oneYearMultisig })

      // Check currentTime < unlockTime
      const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
      const unlockTime = await LC_B.unlockTime()
      assert.isTrue(currentTime.lt(unlockTime))

      const variousEOAs = [teamMember_2, oneYearMultisig, investor_1, A, C, D, E]

      // Several EOAs attempt to withdraw from LC deployed by D
      for (account of variousEOAs) {
        try {
          const withdrawalAttempt = await LC_B.withdrawSTBL({ from: account })
          assert.isFalse(withdrawalAttempt.receipt.status)
        } catch (error) {
          assert.include(error.message, "LockupContract: caller is not the beneficiary")
        }
      }
    })
  })

  describe('Withdrawals from new LCs after unlockTime has passed', async accounts => {
    it("STBL Deployer can't withdraw from a funded LC they deployed for another beneficiary through the Factory, after the unlockTime", async () => {
      const deployedLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, _18monthsFromSystemDeployment, { from: D })
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // Check currentTime > unlockTime
      const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
      const unlockTime = await LC_B.unlockTime()
      assert.isTrue(currentTime.gt(unlockTime))

      // STBL multisig attempts withdrawal from LC they deployed through the Factory
      try {
        const withdrawalAttempt = await LC_B.withdrawSTBL({ from: oneYearMultisig })
        assert.isFalse(withdrawalAttempt.receipt.status)
      } catch (error) {
        assert.include(error.message, "LockupContract: caller is not the beneficiary")
      }
    })

    it("STBL multisig can't withdraw from a funded LC when they are not the beneficiary, after the unlockTime", async () => {
      // Account D deploys a new LC via the Factory
      const deployedLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, _18monthsFromSystemDeployment, { from: D })
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

      //STBL multisig fund the newly deployed LC
      await stblToken.transfer(LC_B.address, dec(2, 18), { from: oneYearMultisig })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // Check currentTime > unlockTime
      const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
      const unlockTime = await LC_B.unlockTime()
      assert.isTrue(currentTime.gt(unlockTime))

      // STBL multisig attempts withdrawal from LCs
      try {
        const withdrawalAttempt_B = await LC_B.withdrawSTBL({ from: oneYearMultisig })
        assert.isFalse(withdrawalAttempt_B.receipt.status)
      } catch (error) {
        assert.include(error.message, "LockupContract: caller is not the beneficiary")
      }
    })

    it("Beneficiary can withdraw from their funded LC, after the unlockTime", async () => {
      // Account D deploys a new LC via the Factory
      const deployedLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, _18monthsFromSystemDeployment, { from: D })
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

      // STBL multisig funds contract
      await stblToken.transfer(LC_B.address, dec(2, 18), { from: oneYearMultisig })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // Check currentTime > unlockTime
      const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
      const unlockTime = await LC_B.unlockTime()
      assert.isTrue(currentTime.gt(unlockTime))

      const beneficiary = await LC_B.beneficiary()
      assert.equal(beneficiary, B)

      // Get B's balance before
      const B_balanceBefore = await stblToken.balanceOf(B)
      assert.equal(B_balanceBefore, '0')
      
      const withdrawalAttempt = await LC_B.withdrawSTBL({ from: B })
      assert.isTrue(withdrawalAttempt.receipt.status)

       // Get B's balance after
       const B_balanceAfter = await stblToken.balanceOf(B)
       assert.equal(B_balanceAfter, dec(2, 18))
    })

    it("Non-beneficiaries can't withdraw from a beneficiary's funded LC, after the unlockTime", async () => {
      // Account D deploys a new LC via the Factory
      const deployedLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, _18monthsFromSystemDeployment, { from: D })
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

      // STBL multisig funds contracts
      await stblToken.transfer(LC_B.address, dec(2, 18), { from: oneYearMultisig })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // Check currentTime > unlockTime
      const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
      const unlockTime = await LC_B.unlockTime()
      assert.isTrue(currentTime.gt(unlockTime))

      const variousEOAs = [teamMember_2, liquityAG, investor_1, A, C, D, E]

      // Several EOAs attempt to withdraw from LC deployed by D
      for (account of variousEOAs) {
        try {
          const withdrawalAttempt = await LC_B.withdrawSTBL({ from: account })
          assert.isFalse(withdrawalAttempt.receipt.status)
        } catch (error) {
          assert.include(error.message, "LockupContract: caller is not the beneficiary")
        }
      }
    })
  })
})
