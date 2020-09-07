const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper
const mv = testHelpers.MoneyValues

contract('During the initial lockup period', async accounts => {
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
    C] = accounts;

  const ONE_MONTH_IN_SECONDS = 2592000
  const ONE_YEAR_IN_SECONDS = 31536000

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
  })

  describe('Transferring GT to OYLCs', async accounts => {
    it.only("GT deployer can transfer GT (vesting) to one-year lockup contracts they deployed", async () => {
      const initialGTBalanceOfOYLC_T1 = await growthToken.balanceOf(OYLC_T1.address)
      const initialGTBalanceOfOYLC_T2 = await growthToken.balanceOf(OYLC_T2.address)
      const initialGTBalanceOfOYLC_T3 = await growthToken.balanceOf(OYLC_T3.address)

      // Check initial OYLC balances == entitlements
      assert.equal(initialGTBalanceOfOYLC_T1, teamMemberInitialEntitlement_1)
      assert.equal(initialGTBalanceOfOYLC_T2, teamMemberInitialEntitlement_2)
      assert.equal(initialGTBalanceOfOYLC_T3, teamMemberInitialEntitlement_3)

      // One month passes
      await th.fastForwardTime(ONE_MONTH_IN_SECONDS, web3.currentProvider)

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
      await th.fastForwardTime(ONE_MONTH_IN_SECONDS, web3.currentProvider)

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

    it.only("GT deployer can transfer GT to one-year lockup contracts deployed by anyone", async () => {
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
      await th.fastForwardTime(ONE_MONTH_IN_SECONDS, web3.currentProvider)

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
      const OYLCDeploymentTx_2 = await lockupContractFactory.deployOneYearLockupContract(C, mv._1e18,  { from: investor_2 })
      const OYLCDeploymentTx_3 = await lockupContractFactory.deployOneYearLockupContract(liquityAG, '9595995999999900000023423234', { from: A })
      const OYLCDeploymentTx_4 = await lockupContractFactory.deployOneYearLockupContract(D, '123', { from: B })

      assert.isTrue(OYLCDeploymentTx_1.receipt.status)
      assert.isTrue(OYLCDeploymentTx_2.receipt.status)
      assert.isTrue(OYLCDeploymentTx_3.receipt.status)
      assert.isTrue(OYLCDeploymentTx_4.receipt.status)
    })
  })
})