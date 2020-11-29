const OneYearLockupContract = artifacts.require("./OneYearLockupContract.sol")
const CustomDurationLockupContract = artifacts.require("./CustomDurationLockupContract.sol")

const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const assertRevert = th.assertRevert


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
    C,
    D,
    E,
    F
  ] = accounts;

  const SECONDS_IN_ONE_MONTH = timeValues.SECONDS_IN_ONE_MONTH
  const SECONDS_IN_364_DAYS = timeValues.SECONDS_IN_ONE_DAY * 364


  let LQTYContracts
  let coreContracts

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

  beforeEach(async () => {
    // Deploy all contracts from the first account
    coreContracts = await deploymentHelper.deployLiquityCore()
    LQTYContracts = await deploymentHelper.deployLQTYContracts()

    lqtyStaking = LQTYContracts.lqtyStaking
    lqtyToken = LQTYContracts.lqtyToken
    communityIssuance = LQTYContracts.communityIssuance
    lockupContractFactory = LQTYContracts.lockupContractFactory

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, coreContracts)


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

    // LiquityAG transfers initial LQTY entitlements to OYLCs
    await lqtyToken.transfer(OYLC_T1.address, teamMemberInitialEntitlement_1, { from: liquityAG })
    await lqtyToken.transfer(OYLC_T2.address, teamMemberInitialEntitlement_2, { from: liquityAG })
    await lqtyToken.transfer(OYLC_T3.address, teamMemberInitialEntitlement_3, { from: liquityAG })

    await lqtyToken.transfer(OYLC_I1.address, investorInitialEntitlement_1, { from: liquityAG })
    await lqtyToken.transfer(OYLC_I2.address, investorInitialEntitlement_2, { from: liquityAG })
    await lqtyToken.transfer(OYLC_I3.address, investorInitialEntitlement_3, { from: liquityAG })

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
    // LQTY deployer locks the OYLCs they deployed
    await lockupContractFactory.lockOneYearContracts(OYLCsToLock, { from: liquityAG })

    // Fast forward time 364 days, so that still less than 1 year since launch has passed
    await th.fastForwardTime(SECONDS_IN_364_DAYS, web3.currentProvider)
  })

  describe('Transferring LQTY to OYLCs', async accounts => {
    it("LQTY deployer can transfer LQTY (vesting) to one-year lockup contracts they deployed", async () => {
      const initialLQTYBalanceOfOYLC_T1 = await lqtyToken.balanceOf(OYLC_T1.address)
      const initialLQTYBalanceOfOYLC_T2 = await lqtyToken.balanceOf(OYLC_T2.address)
      const initialLQTYBalanceOfOYLC_T3 = await lqtyToken.balanceOf(OYLC_T3.address)

      // Check initial OYLC balances == entitlements
      assert.equal(initialLQTYBalanceOfOYLC_T1, teamMemberInitialEntitlement_1)
      assert.equal(initialLQTYBalanceOfOYLC_T2, teamMemberInitialEntitlement_2)
      assert.equal(initialLQTYBalanceOfOYLC_T3, teamMemberInitialEntitlement_3)

      // One month passes
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // LQTY deployer transfers vesting amount
      await lqtyToken.transfer(OYLC_T1.address, dec(1, 24), { from: liquityAG })
      await lqtyToken.transfer(OYLC_T2.address, dec(1, 24), { from: liquityAG })
      await lqtyToken.transfer(OYLC_T3.address, dec(1, 24), { from: liquityAG })

      // Get new OYLC LQTY balances
      const LQTYBalanceOfOYLC_T1_1 = await lqtyToken.balanceOf(OYLC_T1.address)
      const LQTYBalanceOfOYLC_T2_1 = await lqtyToken.balanceOf(OYLC_T2.address)
      const LQTYBalanceOfOYLC_T3_1 = await lqtyToken.balanceOf(OYLC_T3.address)

      // // Check team member OYLC balances have increased 
      assert.isTrue(LQTYBalanceOfOYLC_T1_1.eq(th.toBN(initialLQTYBalanceOfOYLC_T1).add(th.toBN(dec(1, 24)))))
      assert.isTrue(LQTYBalanceOfOYLC_T2_1.eq(th.toBN(initialLQTYBalanceOfOYLC_T2).add(th.toBN(dec(1, 24)))))
      assert.isTrue(LQTYBalanceOfOYLC_T3_1.eq(th.toBN(initialLQTYBalanceOfOYLC_T3).add(th.toBN(dec(1, 24)))))

      // Another month passes
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // LQTY deployer transfers vesting amount
      await lqtyToken.transfer(OYLC_T1.address, dec(1, 24), { from: liquityAG })
      await lqtyToken.transfer(OYLC_T2.address, dec(1, 24), { from: liquityAG })
      await lqtyToken.transfer(OYLC_T3.address, dec(1, 24), { from: liquityAG })

      // Get new OYLC LQTY balances
      const LQTYBalanceOfOYLC_T1_2 = await lqtyToken.balanceOf(OYLC_T1.address)
      const LQTYBalanceOfOYLC_T2_2 = await lqtyToken.balanceOf(OYLC_T2.address)
      const LQTYBalanceOfOYLC_T3_2 = await lqtyToken.balanceOf(OYLC_T3.address)

      // Check team member OYLC balances have increased again
      assert.isTrue(LQTYBalanceOfOYLC_T1_2.eq(LQTYBalanceOfOYLC_T1_1.add(th.toBN(dec(1, 24)))))
      assert.isTrue(LQTYBalanceOfOYLC_T2_2.eq(LQTYBalanceOfOYLC_T2_1.add(th.toBN(dec(1, 24)))))
      assert.isTrue(LQTYBalanceOfOYLC_T3_2.eq(LQTYBalanceOfOYLC_T3_1.add(th.toBN(dec(1, 24)))))
    })

    it("LQTY deployer can transfer LQTY to one-year lockup contracts deployed by anyone", async () => {
      // A, B, C each deploy a lockup contract ith themself as beneficiary
      const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, dec(1, 24), { from: A })
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(2, 24), { from: B })
      const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, dec(3, 24), { from: C })

      // OYLCs for team members on vesting schedules
      const OYLC_A = await th.getOYLCFromDeploymentTx(deployedOYLCtx_A)
      const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)
      const OYLC_C = await th.getOYLCFromDeploymentTx(deployedOYLCtx_C)

      // Check balances of OYLCs are 0
      assert.equal(await lqtyToken.balanceOf(OYLC_A.address), '0')
      assert.equal(await lqtyToken.balanceOf(OYLC_B.address), '0')
      assert.equal(await lqtyToken.balanceOf(OYLC_C.address), '0')

      // One month passes
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // LQTY deployer transfers LQTY to OYLCs deployed by other accounts
      await lqtyToken.transfer(OYLC_A.address, dec(1, 24), { from: liquityAG })
      await lqtyToken.transfer(OYLC_B.address, dec(2, 24), { from: liquityAG })
      await lqtyToken.transfer(OYLC_C.address, dec(3, 24), { from: liquityAG })

      // Check balances of OYLCs have increased
      assert.equal(await lqtyToken.balanceOf(OYLC_A.address), dec(1, 24))
      assert.equal(await lqtyToken.balanceOf(OYLC_B.address), dec(2, 24))
      assert.equal(await lqtyToken.balanceOf(OYLC_C.address), dec(3, 24))
    })
  })

  describe('Deploying new OYLCs', async accounts => {
    it("LQTY Deployer can deploy OYLCs through the Factory", async () => {
      // LQTY deployer deploys OYLCs
      const OYLCDeploymentTx_A = await lockupContractFactory.deployOneYearLockupContract(A, dec(1, 18), { from: liquityAG })
      const OYLCDeploymentTx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(1, 18), { from: liquityAG })
      const OYLCDeploymentTx_C = await lockupContractFactory.deployOneYearLockupContract(C, '9595995999999900000023423234', { from: liquityAG })

      assert.isTrue(OYLCDeploymentTx_A.receipt.status)
      assert.isTrue(OYLCDeploymentTx_B.receipt.status)
      assert.isTrue(OYLCDeploymentTx_C.receipt.status)
    })

    it("Anyone can deploy OYLCs through the Factory", async () => {
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

    it("LQTY Deployer can deploy OYLCs directly", async () => {
      // LQTY deployer deploys CDLCs
      const OYLC_A = await OneYearLockupContract.new(lqtyToken.address, A, dec(1, 18), { from: liquityAG })
      const OYLC_A_txReceipt = await web3.eth.getTransactionReceipt(OYLC_A.transactionHash)

      const OYLC_B = await OneYearLockupContract.new(lqtyToken.address, B, dec(2, 18), { from: liquityAG })
      const OYLC_B_txReceipt = await web3.eth.getTransactionReceipt(OYLC_B.transactionHash)

      const OYLC_C = await OneYearLockupContract.new(lqtyToken.address, C, dec(3, 18), { from: liquityAG })
      const OYLC_C_txReceipt = await web3.eth.getTransactionReceipt(OYLC_C.transactionHash)

      // Check deployment succeeded
      assert.isTrue(OYLC_A_txReceipt.status)
      assert.isTrue(OYLC_B_txReceipt.status)
      assert.isTrue(OYLC_C_txReceipt.status)
    })

    it("Anyone can deploy OYLCs directly", async () => {
      // Various EOAs deploy OYLCs
      const OYLC_A = await OneYearLockupContract.new(lqtyToken.address, A, dec(1, 18), { from: D })
      const OYLC_A_txReceipt = await web3.eth.getTransactionReceipt(OYLC_A.transactionHash)

      const OYLC_B = await OneYearLockupContract.new(lqtyToken.address, B, dec(2, 18), { from: E })
      const OYLC_B_txReceipt = await web3.eth.getTransactionReceipt(OYLC_B.transactionHash)

      const OYLC_C = await OneYearLockupContract.new(lqtyToken.address, C, dec(3, 18), { from: F })
      const OYLC_C_txReceipt = await web3.eth.getTransactionReceipt(OYLC_C.transactionHash)

      // Check deployment succeeded
      assert.isTrue(OYLC_A_txReceipt.status)
      assert.isTrue(OYLC_B_txReceipt.status)
      assert.isTrue(OYLC_C_txReceipt.status)
    })
  })

  describe('LQTY transfer during first year after LQTY deployment', async accounts => {
    it("LQTY deployer can not transfer LQTY to a OYLC that was not deployed by the Factory", async () => {
      // LQTY deployer deploys OYLC_A
      const OYLC_A = await OneYearLockupContract.new(lqtyToken.address, A, dec(1, 18), { from: liquityAG })

      // Account F deploys OYLC_B
      const OYLC_B = await OneYearLockupContract.new(lqtyToken.address, B, dec(1, 18), { from: F })

      // LQTY deployer attempts LQTY transfer to OYLC_A
      try {
        const LQTYtransferTx_A = await lqtyToken.transfer(OYLC_A.address, dec(1, 18), { from: liquityAG })
        assert.isFalse(LQTYtransferTx_A.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      // LQTY deployer attempts LQTY transfer to OYLC_B
      try {
        const LQTYtransferTx_B = await lqtyToken.transfer(OYLC_B.address, dec(1, 18), { from: liquityAG })
        assert.isFalse(LQTYtransferTx_B.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })

    it("LQTY deployer can not transfer LQTY to a CDLC that they deployed directly", async () => {
      // LQTY deployer deploys CDLC directly
      const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, dec(1, 18), SECONDS_IN_ONE_MONTH, { from: liquityAG })

      // LQTY deployer attempts LQTY transfer to CDLC
      try {
        const LQTYtransferTx = await lqtyToken.transfer(CDLC_A.address, dec(1, 18), { from: liquityAG })
        assert.isFalse(LQTYtransferTx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })

    it("LQTY deployer can not transfer LQTY to a CDLC that someone else deployed directly", async () => {
      // LQTY deployer deploys CDLC directly
      const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, dec(1, 18), SECONDS_IN_ONE_MONTH, { from: D })

      // LQTY deployer attempts LQTY transfer to CDLC
      try {
        const LQTYtransferTx = await lqtyToken.transfer(CDLC_A.address, dec(1, 18), { from: liquityAG })
        assert.isFalse(LQTYtransferTx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })

    // TODO: Tests for approve, transferFrom, increase/decrease allowance
    it("LQTY deployer can not transfer to an EOA or Liquity contract", async () => {
      // Deployer attempts LQTY transfer to EOAs
      const LQTYtransferTxPromise_1 = lqtyToken.transfer(A, dec(1, 18), { from: liquityAG })
      const LQTYtransferTxPromise_2 = lqtyToken.transfer(B, dec(1, 18), { from: liquityAG })
      await assertRevert(LQTYtransferTxPromise_1)
      await assertRevert(LQTYtransferTxPromise_2)

      // Deployer attempts LQTY transfer to core Liquity contracts
      for (const contract of Object.keys(coreContracts)) {
        const LQTYtransferTxPromise = lqtyToken.transfer(coreContracts[contract].address, dec(1, 18), { from: liquityAG })
        await assertRevert(LQTYtransferTxPromise)
      }

      // Deployer attempts LQTY transfer to LQTY contracts (excluding OYLCs)
      for (const contract of Object.keys(LQTYContracts)) {
        const LQTYtransferTxPromise = lqtyToken.transfer(LQTYContracts[contract].address, dec(1, 18), { from: liquityAG })
        await assertRevert(LQTYtransferTxPromise)
      }
    })

    it("LQTY deployer can not approve any EOA or Liquity contract to spend their LQTY", async () => {
      // Deployer attempts to approve EOAs to spend LQTY
      const LQTYtransferTxPromise_1 = lqtyToken.approve(A, dec(1, 18), { from: liquityAG })
      const LQTYtransferTxPromise_2 = lqtyToken.approve(B, dec(1, 18), { from: liquityAG })
      await assertRevert(LQTYtransferTxPromise_1)
      await assertRevert(LQTYtransferTxPromise_2)

      // Deployer attempts to approve Liquity contracts to spend LQTY
      for (const contract of Object.keys(coreContracts)) {
        const LQTYtransferTxPromise = lqtyToken.approve(coreContracts[contract].address, dec(1, 18), { from: liquityAG })
        await assertRevert(LQTYtransferTxPromise)
      }

      // Deployer attempts to approve LQTY contracts to spend LQTY (excluding OYLCs)
      for (const contract of Object.keys(LQTYContracts)) {
        const LQTYtransferTxPromise = lqtyToken.approve(LQTYContracts[contract].address, dec(1, 18), { from: liquityAG })
        await assertRevert(LQTYtransferTxPromise)
      }
    })

    // Increase allowance
    it("LQTY deployer can not increaseAllowance for any EOA or Liquity contract", async () => {
      // Deployer attempts to approve EOAs to spend LQTY
      const LQTYtransferTxPromise_1 = lqtyToken.increaseAllowance(A, dec(1, 18), { from: liquityAG })
      const LQTYtransferTxPromise_2 = lqtyToken.increaseAllowance(B, dec(1, 18), { from: liquityAG })
      await assertRevert(LQTYtransferTxPromise_1)
      await assertRevert(LQTYtransferTxPromise_2)

      // Deployer attempts to approve Liquity contracts to spend LQTY
      for (const contract of Object.keys(coreContracts)) {
        const LQTYtransferTxPromise = lqtyToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: liquityAG })
        await assertRevert(LQTYtransferTxPromise)
      }

      // Deployer attempts to approve LQTY contracts to spend LQTY (excluding OYLCs)
      for (const contract of Object.keys(LQTYContracts)) {
        const LQTYtransferTxPromise = lqtyToken.increaseAllowance(LQTYContracts[contract].address, dec(1, 18), { from: liquityAG })
        await assertRevert(LQTYtransferTxPromise)
      }
    })

    it("LQTY deployer can not stake their LQTY in the staking contract", async () => {
      const LQTYtransferTxPromise_1 = lqtyStaking.stake(dec(1, 18), { from: liquityAG })
      await assertRevert(LQTYtransferTxPromise_1)
    })
  })

  describe('Deploying CDLCs', async accounts => {
    it("No one can deploy CDLCs through the factory", async () => {
      try {
        const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, dec(1, 18), SECONDS_IN_ONE_MONTH, { from: liquityAG })
        assert.isFalse(deployedCDLCtx_A.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      try {
        const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, dec(2, 18), SECONDS_IN_ONE_MONTH, { from: B })
        assert.isFalse(deployedCDLCtx_B.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      try {
        const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, dec(3, 18), SECONDS_IN_ONE_MONTH, { from: F })
        assert.isFalse(deployedCDLCtx_C.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })

    it("Anyone can deploy CDLCs directly", async () => {
      // Various EOAs deploy CDLCs
      const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, dec(1, 18), SECONDS_IN_ONE_MONTH, { from: D })
      const CDLC_A_txReceipt = await web3.eth.getTransactionReceipt(CDLC_A.transactionHash)

      const CDLC_B = await CustomDurationLockupContract.new(lqtyToken.address, B, dec(2, 18), SECONDS_IN_ONE_MONTH, { from: liquityAG })
      const CDLC_B_txReceipt = await web3.eth.getTransactionReceipt(CDLC_B.transactionHash)

      const CDLC_C = await CustomDurationLockupContract.new(lqtyToken.address, C, dec(3, 18), SECONDS_IN_ONE_MONTH, { from: F })
      const CDLC_C_txReceipt = await web3.eth.getTransactionReceipt(CDLC_C.transactionHash)

      // Check deployment succeeded
      assert.isTrue(CDLC_A_txReceipt.status)
      assert.isTrue(CDLC_B_txReceipt.status)
      assert.isTrue(CDLC_C_txReceipt.status)
    })
  })

  describe('Withdrawal Attempts from locked OYLCs', async accounts => {
    it("LQTY Deployer can't withdraw from a locked and funded OYLC they deployed through the Factory", async () => {

      // LQTY deployer attempts withdrawal from OYLC they deployed through the Factory
      try {
        const withdrawalAttempt = await OYLC_T1.withdrawLQTY({ from: liquityAG })
        assert.isFalse(withdrawalAttempt.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })

    it("LQTY Deployer can't withdraw from a locked and funded OYLC that someone else deployed", async () => {
      // Account D deploys a new OYLC via the Factory
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(2, 18), { from: D })
      const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)

      //LQTY deployer fund the newly deployed OYLCs
      await lqtyToken.transfer(OYLC_B.address, dec(2, 18), { from: liquityAG })

      // D locks their deployed OYLC
      await lockupContractFactory.lockOneYearContracts([OYLC_B.address], { from: D })

      // LQTY deployer attempts withdrawal from OYLCs
      try {
        const withdrawalAttempt_B = await OYLC_B.withdrawLQTY({ from: liquityAG })
        assert.isFalse(withdrawalAttempt_B.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })

    it("Beneficiary can't withdraw from their funded and locked OYLC", async () => {
      // Account D deploys a new OYLC via the Factory
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(2, 18), { from: D })
      const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)

      // LQTY deployer funds contracts
      await lqtyToken.transfer(OYLC_B.address, dec(2, 18), { from: liquityAG })

      // D locks their deployed OYLC
      await lockupContractFactory.lockOneYearContracts([OYLC_B.address], { from: D })

      /* Beneficiaries of all OYLCS - team, investor, and newly created OYLCs - 
      attempt to withdraw from their respective funded and locked contracts */
      const OYLCs = [
        OYLC_T1,
        OYLC_T2,
        OYLC_T3,
        OYLC_I1,
        OYLC_I2,
        OYLC_T3,
        OYLC_B
      ]

      for (OYLC of OYLCs) {
        try {
          const beneficiary = await OYLC.beneficiary()
          const withdrawalAttempt = await OYLC.withdrawLQTY({ from: beneficiary })
          assert.isFalse(withdrawalAttempt.receipt.status)
        } catch (error) {
          assert.include(error.message, "revert")
        }
      }
    })

    it("No one can withdraw from a funded and locked OYLC", async () => {
      // Account D deploys a new OYLC via the Factory
      const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(2, 18), { from: D })
      const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)

      // LQTY deployer funds contracts
      await lqtyToken.transfer(OYLC_B.address, dec(2, 18), { from: liquityAG })

      // D locks their deployed OYLC
      await lockupContractFactory.lockOneYearContracts([OYLC_B.address], { from: D })


      const variousEOAs = [teamMember_1, liquityAG, investor_1, A, B, C, D, E]

      // Several EOAs attempt to withdraw from OYLC deployed by D
      for (account of variousEOAs) {
        try {
          const withdrawalAttempt = await OYLC_B.withdrawLQTY({ from: account })
          assert.isFalse(withdrawalAttempt.receipt.status)
        } catch (error) {
          assert.include(error.message, "revert")
        }
      }

      // Several EOAs attempt to withdraw from OYLC_T1 deployed by LQTY deployer
      for (account of variousEOAs) {
        try {
          const withdrawalAttempt = await OYLC_T1.withdrawLQTY({ from: account })
          assert.isFalse(withdrawalAttempt.receipt.status)
        } catch (error) {
          assert.include(error.message, "revert")
        }
      }
    })
  })



})