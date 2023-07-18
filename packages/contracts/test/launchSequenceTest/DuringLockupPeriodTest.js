const TwoMonthsLockupContract = artifacts.require("./TwoMonthsLockupContract.sol")
const SixMonthsLockupContract = artifacts.require("./SixMonthsLockupContract.sol")
const OneYearLockupContract = artifacts.require("./OneYearLockupContract.sol")
const LockupContractFactory = artifacts.require("./LockupContractFactory.sol")
const deploymentHelper = require("../../utils/deploymentHelpers.js")

const { TestHelper: th, TimeValues: timeValues } = require("../../utils/testHelpers.js")
const { dec, toBN, assertRevert, ZERO_ADDRESS } = th

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
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O
  ] = accounts;

  const [bountyAddress, xbrlWethLpRewardsAddress, stblWethLpRewardsAddress, momentZeroMultisig, sixMonthsMultisig, oneYearMultisig] = accounts.slice(994, 1000)

  const SECONDS_IN_ONE_MONTH = timeValues.SECONDS_IN_ONE_MONTH
  const { SECONDS_IN_TWO_MONTHS, SECONDS_IN_SIX_MONTHS, SECONDS_IN_ONE_YEAR } = timeValues

  const SECONDS_IN_ALMOST_TWO_MONTHS = SECONDS_IN_TWO_MONTHS - 600
  const SECONDS_IN_ALMOST_SIX_MONTHS = SECONDS_IN_SIX_MONTHS - 600
  const SECONDS_IN_ALMOST_ONE_YEAR = SECONDS_IN_ONE_YEAR - 600

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
  const investorInitialEntitlement_1 = dec(19, 23)
  const investorInitialEntitlement_2 = dec(20, 23)
  const investorInitialEntitlement_3 = dec(21, 23)
  const investorInitialEntitlement_4 = dec(22, 23)
  const investorInitialEntitlement_5 = dec(23, 23)
  const investorInitialEntitlement_6 = dec(24, 23)
  const investorInitialEntitlement_7 = dec(25, 23)
  const investorInitialEntitlement_8 = dec(26, 23)
  const investorInitialEntitlement_9 = dec(27, 23)

  let twoMonthsFromSystemDeployment
  let sixMonthsFromSystemDeployment
  let oneYearFromSystemDeployment
  let twoYearsFromSystemDeployment

  beforeEach(async () => {
    // Deploy all contracts from the first account
    coreContracts = await deploymentHelper.deployLiquityCore()
    STBLContracts = await deploymentHelper.deploySTBLTesterContractsHardhat(bountyAddress, xbrlWethLpRewardsAddress, stblWethLpRewardsAddress, momentZeroMultisig, sixMonthsMultisig, oneYearMultisig)

    stblStaking = STBLContracts.stblStaking
    stblToken = STBLContracts.stblToken
    communityIssuance = STBLContracts.communityIssuance
    lockupContractFactory = STBLContracts.lockupContractFactory

    await deploymentHelper.connectSTBLContracts(STBLContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, STBLContracts)
    await deploymentHelper.connectSTBLContractsToCore(STBLContracts, coreContracts)

    twoMonthsFromSystemDeployment = await th.getTimeFromSystemDeployment(stblToken, web3, timeValues.SECONDS_IN_TWO_MONTHS)
    sixMonthsFromSystemDeployment = await th.getTimeFromSystemDeployment(stblToken, web3, timeValues.SECONDS_IN_SIX_MONTHS)
    oneYearFromSystemDeployment = await th.getTimeFromSystemDeployment(stblToken, web3, timeValues.SECONDS_IN_ONE_YEAR)
    const secondsInTwoYears = toBN(timeValues.SECONDS_IN_ONE_YEAR).mul(toBN('2'))
    twoYearsFromSystemDeployment = await th.getTimeFromSystemDeployment(stblToken, web3, secondsInTwoYears)

    // Deploy 3 LCs for team members on vesting schedules
    const deployedLCtx_T1 = await lockupContractFactory.deployTwoMonthsLockupContract(teamMember_1, twoMonthsFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_T2 = await lockupContractFactory.deployTwoMonthsLockupContract(teamMember_2, twoMonthsFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_T3 = await lockupContractFactory.deployTwoMonthsLockupContract(teamMember_3, twoMonthsFromSystemDeployment, { from: liquityAG })
    
    // Deploy 3 LCs for team members on vesting schedules
    const deployedLCtx_T4 = await lockupContractFactory.deploySixMonthsLockupContract(teamMember_1, sixMonthsFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_T5 = await lockupContractFactory.deploySixMonthsLockupContract(teamMember_2, sixMonthsFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_T6 = await lockupContractFactory.deploySixMonthsLockupContract(teamMember_3, sixMonthsFromSystemDeployment, { from: liquityAG })

    // Deploy 3 LCs for team members on vesting schedules
    const deployedLCtx_T7 = await lockupContractFactory.deployOneYearLockupContract(teamMember_1, oneYearFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_T8 = await lockupContractFactory.deployOneYearLockupContract(teamMember_2, oneYearFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_T9 = await lockupContractFactory.deployOneYearLockupContract(teamMember_3, oneYearFromSystemDeployment, { from: liquityAG })

    // Deploy 3 LCs for investors
    const deployedLCtx_I1 = await lockupContractFactory.deployTwoMonthsLockupContract(investor_1, twoMonthsFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_I2 = await lockupContractFactory.deployTwoMonthsLockupContract(investor_2, twoMonthsFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_I3 = await lockupContractFactory.deployTwoMonthsLockupContract(investor_3, twoMonthsFromSystemDeployment, { from: liquityAG })

    // Deploy 3 LCs for investors
    const deployedLCtx_I4 = await lockupContractFactory.deploySixMonthsLockupContract(investor_1, sixMonthsFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_I5 = await lockupContractFactory.deploySixMonthsLockupContract(investor_2, sixMonthsFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_I6 = await lockupContractFactory.deploySixMonthsLockupContract(investor_3, sixMonthsFromSystemDeployment, { from: liquityAG })

    // Deploy 3 LCs for investors
    const deployedLCtx_I7 = await lockupContractFactory.deployOneYearLockupContract(investor_1, oneYearFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_I8 = await lockupContractFactory.deployOneYearLockupContract(investor_2, oneYearFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_I9 = await lockupContractFactory.deployOneYearLockupContract(investor_3, oneYearFromSystemDeployment, { from: liquityAG })

    // LCs for team members on vesting schedules
    LC_T1 = await th.getLCFromDeploymentTx(deployedLCtx_T1)
    LC_T2 = await th.getLCFromDeploymentTx(deployedLCtx_T2)
    LC_T3 = await th.getLCFromDeploymentTx(deployedLCtx_T3)

    // LCs for team members on vesting schedules
    LC_T4 = await th.getLCFromDeploymentTx(deployedLCtx_T4)
    LC_T5 = await th.getLCFromDeploymentTx(deployedLCtx_T5)
    LC_T6 = await th.getLCFromDeploymentTx(deployedLCtx_T6)

    // LCs for team members on vesting schedules
    LC_T7 = await th.getLCFromDeploymentTx(deployedLCtx_T7)
    LC_T8 = await th.getLCFromDeploymentTx(deployedLCtx_T8)
    LC_T9 = await th.getLCFromDeploymentTx(deployedLCtx_T9)

    // LCs for investors
    LC_I1 = await th.getLCFromDeploymentTx(deployedLCtx_I1)
    LC_I2 = await th.getLCFromDeploymentTx(deployedLCtx_I2)
    LC_I3 = await th.getLCFromDeploymentTx(deployedLCtx_I3)

    // LCs for investors
    LC_I4 = await th.getLCFromDeploymentTx(deployedLCtx_I4)
    LC_I5 = await th.getLCFromDeploymentTx(deployedLCtx_I5)
    LC_I6 = await th.getLCFromDeploymentTx(deployedLCtx_I6)

    // LCs for investors
    LC_I7 = await th.getLCFromDeploymentTx(deployedLCtx_I7)
    LC_I8 = await th.getLCFromDeploymentTx(deployedLCtx_I8)
    LC_I9 = await th.getLCFromDeploymentTx(deployedLCtx_I9)

    // Multisig transfers initial STBL entitlements to LCs
    await stblToken.transfer(LC_T1.address, teamMemberInitialEntitlement_1, { from: momentZeroMultisig })
    await stblToken.transfer(LC_T2.address, teamMemberInitialEntitlement_2, { from: momentZeroMultisig })
    await stblToken.transfer(LC_T3.address, teamMemberInitialEntitlement_3, { from: momentZeroMultisig })

    // Multisig transfers initial STBL entitlements to LCs
    await stblToken.transfer(LC_T4.address, teamMemberInitialEntitlement_4, { from: sixMonthsMultisig })
    await stblToken.transfer(LC_T5.address, teamMemberInitialEntitlement_5, { from: sixMonthsMultisig })
    await stblToken.transfer(LC_T6.address, teamMemberInitialEntitlement_6, { from: sixMonthsMultisig })

    // Multisig transfers initial STBL entitlements to LCs
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
  })

  describe('STBL transfer during first year after STBL deployment', async accounts => {
    // --- Liquity AG transfer restriction, 1st year ---
    it("Liquity multisig can not transfer STBL to a LC that was deployed directly", async () => {
      // Liquity multisig deploys LC_A
      const LC_D = await SixMonthsLockupContract.new(stblToken.address, D, sixMonthsFromSystemDeployment, { from: sixMonthsMultisig })

      // Account F deploys LC_B
      const LC_E = await SixMonthsLockupContract.new(stblToken.address, E, sixMonthsFromSystemDeployment, { from: L })

      // STBL deployer deploys LC_C
      const LC_F = await SixMonthsLockupContract.new(stblToken.address, K, sixMonthsFromSystemDeployment, { from: liquityAG })

      // Liquity multisig deploys LC_A
      const LC_G = await OneYearLockupContract.new(stblToken.address, G, oneYearFromSystemDeployment, { from: oneYearMultisig })

      // Account F deploys LC_B
      const LC_H = await OneYearLockupContract.new(stblToken.address, H, oneYearFromSystemDeployment, { from: M })

      // STBL deployer deploys LC_C
      const LC_I = await OneYearLockupContract.new(stblToken.address, O, oneYearFromSystemDeployment, { from: liquityAG })

      // Fast forward almost six months
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      // Liquity multisig attempts STBL transfer to LC_A
      try {
        const STBLtransferTx_D = await stblToken.transfer(LC_D.address, dec(1, 18), { from: sixMonthsMultisig })
        assert.isFalse(STBLtransferTx_D.receipt.status)
      } catch (error) {
        assert.include(error.message, "STBLToken: recipient must be a LockupContract registered in the Factory")
      }

      // Liquity multisig attempts STBL transfer to LC_B
      try {
        const STBLtransferTx_E = await stblToken.transfer(LC_E.address, dec(1, 18), { from: sixMonthsMultisig })
        assert.isFalse(STBLtransferTx_E.receipt.status)
      } catch (error) {
        assert.include(error.message, "STBLToken: recipient must be a LockupContract registered in the Factory")
      }

      try {
        const STBLtransferTx_F = await stblToken.transfer(LC_F.address, dec(1, 18), { from: sixMonthsMultisig })
        assert.isFalse(STBLtransferTx_F.receipt.status)
      } catch (error) {
        assert.include(error.message, "STBLToken: recipient must be a LockupContract registered in the Factory")
      }

      // Fast forward more almost six months (Almost one year in total)
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      // Liquity multisig attempts STBL transfer to LC_A
      try {
        const STBLtransferTx_G = await stblToken.transfer(LC_G.address, dec(1, 18), { from: oneYearMultisig })
        assert.isFalse(STBLtransferTx_G.receipt.status)
      } catch (error) {
        assert.include(error.message, "STBLToken: recipient must be a LockupContract registered in the Factory")
      }

      // Liquity multisig attempts STBL transfer to LC_B
      try {
        const STBLtransferTx_H = await stblToken.transfer(LC_H.address, dec(1, 18), { from: oneYearMultisig })
        assert.isFalse(STBLtransferTx_H.receipt.status)
      } catch (error) {
        assert.include(error.message, "STBLToken: recipient must be a LockupContract registered in the Factory")
      }

      try {
        const STBLtransferTx_I = await stblToken.transfer(LC_I.address, dec(1, 18), { from: oneYearMultisig })
        assert.isFalse(STBLtransferTx_I.receipt.status)
      } catch (error) {
        assert.include(error.message, "STBLToken: recipient must be a LockupContract registered in the Factory")
      }
    })

    it("Liquity multisig can not transfer to an EOA or Liquity system contracts", async () => {
      // Fast forward almost six months
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      // Multisig attempts STBL transfer to EOAs
      const STBLtransferTxPromise_1 = stblToken.transfer(A, dec(1, 18), { from: sixMonthsMultisig })
      const STBLtransferTxPromise_2 = stblToken.transfer(B, dec(1, 18), { from: sixMonthsMultisig })

      await assertRevert(STBLtransferTxPromise_1)
      await assertRevert(STBLtransferTxPromise_2)

      // Multisig attempts STBL transfer to core Liquity contracts
      for (const contract of Object.keys(coreContracts)) {
        const STBLtransferTxPromise = stblToken.transfer(coreContracts[contract].address, dec(1, 18), { from: sixMonthsMultisig })
        await assertRevert(STBLtransferTxPromise, "STBLToken: recipient must be a LockupContract registered in the Factory")
      }

      // Multisig attempts STBL transfer to STBL contracts (excluding LCs)
      for (const contract of Object.keys(STBLContracts)) {
        const STBLtransferTxPromise = stblToken.transfer(STBLContracts[contract].address, dec(1, 18), { from: sixMonthsMultisig })
        await assertRevert(STBLtransferTxPromise, "STBLToken: recipient must be a LockupContract registered in the Factory")
      }

      // Fast forward more almost six months (Almost one year in total)
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      const STBLtransferTxPromise_3 = stblToken.transfer(C, dec(1, 18), { from: oneYearMultisig })
      const STBLtransferTxPromise_4 = stblToken.transfer(D, dec(1, 18), { from: oneYearMultisig })

      await assertRevert(STBLtransferTxPromise_3)
      await assertRevert(STBLtransferTxPromise_4)

      // Multisig attempts STBL transfer to core Liquity contracts
      for (const contract of Object.keys(coreContracts)) {
        const STBLtransferTxPromise = stblToken.transfer(coreContracts[contract].address, dec(1, 18), { from: oneYearMultisig })
        await assertRevert(STBLtransferTxPromise, "STBLToken: recipient must be a LockupContract registered in the Factory")
      }

      // Multisig attempts STBL transfer to STBL contracts (excluding LCs)
      for (const contract of Object.keys(STBLContracts)) {
        const STBLtransferTxPromise = stblToken.transfer(STBLContracts[contract].address, dec(1, 18), { from: oneYearMultisig })
        await assertRevert(STBLtransferTxPromise, "STBLToken: recipient must be a LockupContract registered in the Factory")
      }
    })

    // --- Liquity AG approval restriction, 1st year ---
    it("Liquity multisig can not approve any EOA or Liquity system contract to spend their STBL", async () => {
      // Fast forward almost six months
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      // Multisig attempts to approve EOAs to spend STBL
      const STBLApproveTxPromise_1 = stblToken.approve(A, dec(1, 18), { from: sixMonthsMultisig })
      const STBLApproveTxPromise_2 = stblToken.approve(B, dec(1, 18), { from: sixMonthsMultisig })

      await assertRevert(STBLApproveTxPromise_1, "STBLToken: caller must not be the multisig")
      await assertRevert(STBLApproveTxPromise_2, "STBLToken: caller must not be the multisig")

      // Multisig attempts to approve Liquity contracts to spend STBL
      for (const contract of Object.keys(coreContracts)) {
        const STBLApproveTxPromise = stblToken.approve(coreContracts[contract].address, dec(1, 18), { from: sixMonthsMultisig })
        await assertRevert(STBLApproveTxPromise, "STBLToken: caller must not be the multisig")
      }

      for (const contract of Object.keys(STBLContracts)) {
        const STBLApproveTxPromise = stblToken.approve(STBLContracts[contract].address, dec(1, 18), { from: sixMonthsMultisig })
        await assertRevert(STBLApproveTxPromise, "STBLToken: caller must not be the multisig")
      }

      // Fast forward more almost six months (Almost one year in total)
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      const STBLApproveTxPromise_3 = stblToken.approve(C, dec(1, 18), { from: oneYearMultisig })
      const STBLApproveTxPromise_4 = stblToken.approve(D, dec(1, 18), { from: oneYearMultisig })

      await assertRevert(STBLApproveTxPromise_3, "STBLToken: caller must not be the multisig")
      await assertRevert(STBLApproveTxPromise_4, "STBLToken: caller must not be the multisig")

      // Multisig attempts to approve Liquity contracts to spend STBL
      for (const contract of Object.keys(coreContracts)) {
        const STBLApproveTxPromise = stblToken.approve(coreContracts[contract].address, dec(1, 18), { from: oneYearMultisig })
        await assertRevert(STBLApproveTxPromise, "STBLToken: caller must not be the multisig")
      }

      // Multisig attempts to approve STBL contracts to spend STBL (excluding LCs)
      for (const contract of Object.keys(STBLContracts)) {
        const STBLApproveTxPromise = stblToken.approve(STBLContracts[contract].address, dec(1, 18), { from: oneYearMultisig })
        await assertRevert(STBLApproveTxPromise, "STBLToken: caller must not be the multisig")
      }
    })

    // --- Liquity AG increaseAllowance restriction, 1st year ---
    it("Liquity multisig can not increaseAllowance for any EOA or Liquity contract", async () => {
      // Fast forward almost six months
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      // Multisig attempts to approve EOAs to spend STBL
      const STBLIncreaseAllowanceTxPromise_1 = stblToken.increaseAllowance(A, dec(1, 18), { from: sixMonthsMultisig })
      const STBLIncreaseAllowanceTxPromise_2 = stblToken.increaseAllowance(B, dec(1, 18), { from: sixMonthsMultisig })
      await assertRevert(STBLIncreaseAllowanceTxPromise_1, "STBLToken: caller must not be the multisig")
      await assertRevert(STBLIncreaseAllowanceTxPromise_2, "STBLToken: caller must not be the multisig")

      // Multisig attempts to approve Liquity contracts to spend STBL
      for (const contract of Object.keys(coreContracts)) {
        const STBLIncreaseAllowanceTxPromise = stblToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: sixMonthsMultisig })
        await assertRevert(STBLIncreaseAllowanceTxPromise, "STBLToken: caller must not be the multisig")
      }

      // Multisig attempts to approve STBL contracts to spend STBL (excluding LCs)
      for (const contract of Object.keys(STBLContracts)) {
        const STBLIncreaseAllowanceTxPromise = stblToken.increaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: sixMonthsMultisig })
        await assertRevert(STBLIncreaseAllowanceTxPromise, "STBLToken: caller must not be the multisig")
      }

      // Fast forward more almost six months (Almost one year in total)
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      // Multisig attempts to approve EOAs to spend STBL
      const STBLIncreaseAllowanceTxPromise_3 = stblToken.increaseAllowance(C, dec(1, 18), { from: oneYearMultisig })
      const STBLIncreaseAllowanceTxPromise_4 = stblToken.increaseAllowance(D, dec(1, 18), { from: oneYearMultisig })
      await assertRevert(STBLIncreaseAllowanceTxPromise_3, "STBLToken: caller must not be the multisig")
      await assertRevert(STBLIncreaseAllowanceTxPromise_4, "STBLToken: caller must not be the multisig")

      // Multisig attempts to approve Liquity contracts to spend STBL
      for (const contract of Object.keys(coreContracts)) {
        const STBLIncreaseAllowanceTxPromise = stblToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: oneYearMultisig })
        await assertRevert(STBLIncreaseAllowanceTxPromise, "STBLToken: caller must not be the multisig")
      }

      // Multisig attempts to approve STBL contracts to spend STBL (excluding LCs)
      for (const contract of Object.keys(STBLContracts)) {
        const STBLIncreaseAllowanceTxPromise = stblToken.increaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: oneYearMultisig })
        await assertRevert(STBLIncreaseAllowanceTxPromise, "STBLToken: caller must not be the multisig")
      }
    })

    // --- Liquity AG decreaseAllowance restriction, 1st year ---
    it("Liquity multisig can not decreaseAllowance for any EOA or Liquity contract", async () => {
      // Fast forward almost six months
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      // Multisig attempts to decreaseAllowance on EOAs 
      const STBLDecreaseAllowanceTxPromise_1 = stblToken.decreaseAllowance(A, dec(1, 18), { from: sixMonthsMultisig })
      const STBLDecreaseAllowanceTxPromise_2 = stblToken.decreaseAllowance(B, dec(1, 18), { from: sixMonthsMultisig })
      await assertRevert(STBLDecreaseAllowanceTxPromise_1, "STBLToken: caller must not be the multisig")
      await assertRevert(STBLDecreaseAllowanceTxPromise_2, "STBLToken: caller must not be the multisig")

      // Multisig attempts to decrease allowance on Liquity contracts
      for (const contract of Object.keys(coreContracts)) {
        const STBLDecreaseAllowanceTxPromise = stblToken.decreaseAllowance(coreContracts[contract].address, dec(1, 18), { from: sixMonthsMultisig })
        await assertRevert(STBLDecreaseAllowanceTxPromise, "STBLToken: caller must not be the multisig")
      }

      // Multisig attempts to decrease allowance on STBL contracts (excluding LCs)
      for (const contract of Object.keys(STBLContracts)) {
        const STBLDecreaseAllowanceTxPromise = stblToken.decreaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: sixMonthsMultisig })
        await assertRevert(STBLDecreaseAllowanceTxPromise, "STBLToken: caller must not be the multisig")
      }

      // Fast forward more almost six months (Almost one year in total)
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      // Multisig attempts to decreaseAllowance on EOAs 
      const STBLDecreaseAllowanceTxPromise_3 = stblToken.decreaseAllowance(C, dec(1, 18), { from: oneYearMultisig })
      const STBLDecreaseAllowanceTxPromise_4 = stblToken.decreaseAllowance(D, dec(1, 18), { from: oneYearMultisig })
      await assertRevert(STBLDecreaseAllowanceTxPromise_3, "STBLToken: caller must not be the multisig")
      await assertRevert(STBLDecreaseAllowanceTxPromise_4, "STBLToken: caller must not be the multisig")

      // Multisig attempts to decrease allowance on Liquity contracts
      for (const contract of Object.keys(coreContracts)) {
        const STBLDecreaseAllowanceTxPromise = stblToken.decreaseAllowance(coreContracts[contract].address, dec(1, 18), { from: oneYearMultisig })
        await assertRevert(STBLDecreaseAllowanceTxPromise, "STBLToken: caller must not be the multisig")
      }

      // Multisig attempts to decrease allowance on STBL contracts (excluding LCs)
      for (const contract of Object.keys(STBLContracts)) {
        const STBLDecreaseAllowanceTxPromise = stblToken.decreaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: oneYearMultisig })
        await assertRevert(STBLDecreaseAllowanceTxPromise, "STBLToken: caller must not be the multisig")
      }
    })

    // --- Liquity multisig transferFrom restriction, 1st year ---
    it("Liquity multisig can not be the sender in a transferFrom() call", async () => {
      // Fast forward almost six months
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      // EOAs attempt to use multisig as sender in a transferFrom()
      const STBLtransferFromTxPromise_1 = stblToken.transferFrom(sixMonthsMultisig, A, dec(1, 18), { from: A })
      const STBLtransferFromTxPromise_2 = stblToken.transferFrom(sixMonthsMultisig, C, dec(1, 18), { from: B })
      await assertRevert(STBLtransferFromTxPromise_1, "STBLToken: sender must not be the multisig")
      await assertRevert(STBLtransferFromTxPromise_2, "STBLToken: sender must not be the multisig")

      // Fast forward more almost six months (Almost one year in total)
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      // EOAs attempt to use multisig as sender in a transferFrom()
      const STBLtransferFromTxPromise_3 = stblToken.transferFrom(oneYearMultisig, D, dec(1, 18), { from: D })
      const STBLtransferFromTxPromise_4 = stblToken.transferFrom(oneYearMultisig, F, dec(1, 18), { from: E })
      await assertRevert(STBLtransferFromTxPromise_3, "STBLToken: sender must not be the multisig")
      await assertRevert(STBLtransferFromTxPromise_4, "STBLToken: sender must not be the multisig")
    })

    //  --- staking, 1st year ---
    it("Liquity multisig can not stake their STBL in the staking contract", async () => {
      // Fast forward almost six months
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      const STBLStakingTxPromise_1 = stblStaking.stake(dec(1, 18), { from: sixMonthsMultisig })
      await assertRevert(STBLStakingTxPromise_1, "STBLToken: sender must not be the multisig")

      // Fast forward more almost six months (Almost one year in total)
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      const STBLStakingTxPromise_2 = stblStaking.stake(dec(1, 18), { from: oneYearMultisig })
      await assertRevert(STBLStakingTxPromise_2, "STBLToken: sender must not be the multisig")
    })

    // --- Anyone else ---

    it("Anyone (other than Liquity multisig) can transfer STBL to LCs deployed by anyone through the Factory", async () => {
      // Fast forward almost six months
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      // Start D, E, F with some STBL
      await stblToken.unprotectedMint(D, dec(1, 24))
      await stblToken.unprotectedMint(E, dec(2, 24))
      await stblToken.unprotectedMint(F, dec(3, 24))
      await stblToken.unprotectedMint(G, dec(4, 24))

      // H, I, and Liquity AG deploy lockup contracts with A, B, C as beneficiaries, respectively
      const deployedLCtx_A = await lockupContractFactory.deploySixMonthsLockupContract(A, oneYearFromSystemDeployment, { from: H })
      const deployedLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, oneYearFromSystemDeployment, { from: I })
      const deployedLCtx_C = await lockupContractFactory.deploySixMonthsLockupContract(C, oneYearFromSystemDeployment, { from: sixMonthsMultisig })
      const deployedLCtx_D = await lockupContractFactory.deployOneYearLockupContract(C, oneYearFromSystemDeployment, { from: oneYearMultisig })
      const deployedLCtx_E = await lockupContractFactory.deployTwoMonthsLockupContract(C, oneYearFromSystemDeployment, { from: momentZeroMultisig })

      // Grab contract addresses from deployment tx events
      const LCAddress_A = await th.getLCAddressFromDeploymentTx(deployedLCtx_A)
      const LCAddress_B = await th.getLCAddressFromDeploymentTx(deployedLCtx_B)
      const LCAddress_C = await th.getLCAddressFromDeploymentTx(deployedLCtx_C)
      const LCAddress_D = await th.getLCAddressFromDeploymentTx(deployedLCtx_D)
      const LCAddress_E = await th.getLCAddressFromDeploymentTx(deployedLCtx_E)

      // Check balances of LCs are 0
      assert.equal(await stblToken.balanceOf(LCAddress_A), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_B), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_C), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_D), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_E), '0')

      // D, E, F transfer STBL to LCs
      await stblToken.transfer(LCAddress_A, dec(1, 24), { from: D })
      await stblToken.transfer(LCAddress_B, dec(2, 24), { from: E })
      await stblToken.transfer(LCAddress_C, dec(3, 24), { from: F })
      await stblToken.transfer(LCAddress_D, dec(4, 24), { from: G })
      await stblToken.transfer(LCAddress_E, dec(5, 24), { from: momentZeroMultisig })

      // Check balances of LCs has increased
      assert.equal(await stblToken.balanceOf(LCAddress_A), dec(1, 24))
      assert.equal(await stblToken.balanceOf(LCAddress_B), dec(2, 24))
      assert.equal(await stblToken.balanceOf(LCAddress_C), dec(3, 24))
      assert.equal(await stblToken.balanceOf(LCAddress_D), dec(4, 24))
      assert.equal(await stblToken.balanceOf(LCAddress_E), dec(5, 24))
    })

    it("Anyone (other than Liquity multisig) can transfer STBL to LCs deployed by anyone directly", async () => {
      // Fast forward almost six months
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      // Start D, E, F with some STBL
      await stblToken.unprotectedMint(D, dec(1, 24))
      await stblToken.unprotectedMint(E, dec(2, 24))
      await stblToken.unprotectedMint(F, dec(3, 24))
      await stblToken.unprotectedMint(G, dec(4, 24))
      await stblToken.unprotectedMint(H, dec(5, 24))

      // H, I, LiqAG deploy lockup contracts with A, B, C as beneficiaries, respectively
      const LC_A = await TwoMonthsLockupContract.new(stblToken.address, A, twoMonthsFromSystemDeployment, { from: J })
      const LC_B = await SixMonthsLockupContract.new(stblToken.address, B, sixMonthsFromSystemDeployment, { from: K })
      const LC_C = await OneYearLockupContract.new(stblToken.address, C, oneYearFromSystemDeployment, { from: sixMonthsMultisig })
      const LC_D = await TwoMonthsLockupContract.new(stblToken.address, D, twoMonthsFromSystemDeployment, { from: oneYearMultisig })
      const LC_E = await SixMonthsLockupContract.new(stblToken.address, E, sixMonthsFromSystemDeployment, { from: momentZeroMultisig })
      const LC_F = await OneYearLockupContract.new(stblToken.address, F, oneYearFromSystemDeployment, { from: momentZeroMultisig })
      
      // Check balances of LCs are 0
      assert.equal(await stblToken.balanceOf(LC_A.address), '0')
      assert.equal(await stblToken.balanceOf(LC_B.address), '0')
      assert.equal(await stblToken.balanceOf(LC_C.address), '0')
      assert.equal(await stblToken.balanceOf(LC_D.address), '0')
      assert.equal(await stblToken.balanceOf(LC_E.address), '0')
      assert.equal(await stblToken.balanceOf(LC_F.address), '0')

      // D, E, F transfer STBL to LCs
      await stblToken.transfer(LC_A.address, dec(1, 24), { from: D })
      await stblToken.transfer(LC_B.address, dec(2, 24), { from: E })
      await stblToken.transfer(LC_C.address, dec(3, 24), { from: F })
      await stblToken.transfer(LC_D.address, dec(4, 24), { from: G })
      await stblToken.transfer(LC_E.address, dec(5, 24), { from: H })
      await stblToken.transfer(LC_F.address, dec(5, 24), { from: momentZeroMultisig })

      // Check balances of LCs has increased
      assert.equal(await stblToken.balanceOf(LC_A.address), dec(1, 24))
      assert.equal(await stblToken.balanceOf(LC_B.address), dec(2, 24))
      assert.equal(await stblToken.balanceOf(LC_C.address), dec(3, 24))
      assert.equal(await stblToken.balanceOf(LC_D.address), dec(4, 24))
      assert.equal(await stblToken.balanceOf(LC_E.address), dec(5, 24))
      assert.equal(await stblToken.balanceOf(LC_F.address), dec(5, 24))
    })

    it("Anyone (other than liquity multisig) can transfer to an EOA", async () => {
      // Fast forward almost six months
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      // Start D, E, F with some STBL
      await stblToken.unprotectedMint(D, dec(1, 24))
      await stblToken.unprotectedMint(E, dec(2, 24))
      await stblToken.unprotectedMint(F, dec(3, 24))
      await stblToken.unprotectedMint(G, dec(4, 24))
      await stblToken.unprotectedMint(H, dec(5, 24))

      // STBL holders transfer to other transfer to EOAs
      const STBLtransferTx_1 = await stblToken.transfer(A, dec(1, 18), { from: D })
      const STBLtransferTx_2 = await stblToken.transfer(B, dec(1, 18), { from: E })
      const STBLtransferTx_3 = await stblToken.transfer(momentZeroMultisig, dec(1, 18), { from: F })
      const STBLtransferTx_4 = await stblToken.transfer(sixMonthsMultisig, dec(1, 18), { from: G })
      const STBLtransferTx_5 = await stblToken.transfer(oneYearMultisig, dec(1, 18), { from: H })

      assert.isTrue(STBLtransferTx_1.receipt.status)
      assert.isTrue(STBLtransferTx_2.receipt.status)
      assert.isTrue(STBLtransferTx_3.receipt.status)
      assert.isTrue(STBLtransferTx_4.receipt.status)
      assert.isTrue(STBLtransferTx_5.receipt.status)
    })

    it("Anyone (other than liquity multisig) can approve any EOA or to spend their STBL", async () => {
      // Fast forward almost six months
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)
            
      // EOAs approve EOAs to spend STBL
      const STBLapproveTx_1 = await stblToken.approve(A, dec(1, 18), { from: F })
      const STBLapproveTx_2 = await stblToken.approve(B, dec(1, 18), { from: G })
      await assert.isTrue(STBLapproveTx_1.receipt.status)
      await assert.isTrue(STBLapproveTx_2.receipt.status)
    })

    it("Anyone (other than liquity multisig) can increaseAllowance for any EOA or Liquity contract", async () => {
      // Anyone can increaseAllowance of EOAs to spend STBL
      const STBLIncreaseAllowanceTx_1 = await stblToken.increaseAllowance(A, dec(1, 18), { from: F })
      const STBLIncreaseAllowanceTx_2 = await stblToken.increaseAllowance(B, dec(1, 18), { from: G })
      await assert.isTrue(STBLIncreaseAllowanceTx_1.receipt.status)
      await assert.isTrue(STBLIncreaseAllowanceTx_2.receipt.status)

      // Increase allowance of core Liquity contracts
      for (const contract of Object.keys(coreContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }

      // Increase allowance of STBL contracts
      for (const contract of Object.keys(STBLContracts)) {
        const STBLIncreaseAllowanceTx = await stblToken.increaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(STBLIncreaseAllowanceTx.receipt.status)
      }
    })

    it("Anyone (other than liquity multisig) can decreaseAllowance for any EOA or Liquity contract", async () => {
      //First, increase allowance of A, B and coreContracts and STBL contracts
      const STBLIncreaseAllowanceTx_1 = await stblToken.increaseAllowance(A, dec(1, 18), { from: F })
      const STBLIncreaseAllowanceTx_2 = await stblToken.increaseAllowance(B, dec(1, 18), { from: G })
      await assert.isTrue(STBLIncreaseAllowanceTx_1.receipt.status)
      await assert.isTrue(STBLIncreaseAllowanceTx_2.receipt.status)

      for (const contract of Object.keys(coreContracts)) {
        const STBLtransferTx = await stblToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(STBLtransferTx.receipt.status)
      }

      for (const contract of Object.keys(STBLContracts)) {
        const STBLtransferTx = await stblToken.increaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(STBLtransferTx.receipt.status)
      }

      // Decrease allowance of A, B
      const STBLDecreaseAllowanceTx_1 = await stblToken.decreaseAllowance(A, dec(1, 18), { from: F })
      const STBLDecreaseAllowanceTx_2 = await stblToken.decreaseAllowance(B, dec(1, 18), { from: G })
      await assert.isTrue(STBLDecreaseAllowanceTx_1.receipt.status)
      await assert.isTrue(STBLDecreaseAllowanceTx_2.receipt.status)

      // Decrease allowance of core contracts
      for (const contract of Object.keys(coreContracts)) {
        const STBLDecreaseAllowanceTx = await stblToken.decreaseAllowance(coreContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(STBLDecreaseAllowanceTx.receipt.status)
      }

      // Decrease allowance of STBL contracts
      for (const contract of Object.keys(STBLContracts)) {
        const STBLDecreaseAllowanceTx = await stblToken.decreaseAllowance(STBLContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(STBLDecreaseAllowanceTx.receipt.status)
      }
    })

    it("Anyone (other than liquity multisig) can be the sender in a transferFrom() call", async () => {
      // Fund A, B
      await stblToken.unprotectedMint(A, dec(1, 18))
      await stblToken.unprotectedMint(B, dec(1, 18))

      // A, B approve F, G
      await stblToken.approve(F, dec(1, 18), { from: A })
      await stblToken.approve(G, dec(1, 18), { from: B })

      const STBLtransferFromTx_1 = await stblToken.transferFrom(A, F, dec(1, 18), { from: F })
      const STBLtransferFromTx_2 = await stblToken.transferFrom(B, C, dec(1, 18), { from: G })
      await assert.isTrue(STBLtransferFromTx_1.receipt.status)
      await assert.isTrue(STBLtransferFromTx_2.receipt.status)
    })

    it("Anyone (other than liquity AG) can stake their STBL in the staking contract", async () => {
      // Fund F
      await stblToken.unprotectedMint(F, dec(1, 18))

      const STBLStakingTx_1 = await stblStaking.stake(dec(1, 18), { from: F })
      await assert.isTrue(STBLStakingTx_1.receipt.status)
    })

  })
  // --- LCF ---

  describe('Lockup Contract Factory negative tests', async accounts => {
    it("deployLockupContract(): reverts when STBL token address is not set", async () => {
      // Fund F
      await stblToken.unprotectedMint(F, dec(20, 24))

      // deploy new LCF
      const LCFNew = await LockupContractFactory.new()

      // Check STBLToken address not registered
      const registeredSTBLTokenAddr = await LCFNew.stblTokenAddress()
      assert.equal(registeredSTBLTokenAddr, ZERO_ADDRESS)

      const tx1 = LCFNew.deployTwoMonthsLockupContract(A, oneYearFromSystemDeployment, { from: F })
      await assertRevert(tx1)

      const tx2 = LCFNew.deploySixMonthsLockupContract(A, oneYearFromSystemDeployment, { from: F })
      await assertRevert(tx2)

      const tx3 = LCFNew.deployOneYearLockupContract(A, oneYearFromSystemDeployment, { from: F })
      await assertRevert(tx3)
    })
  })

  // --- LCs ---
  describe('Transferring STBL to LCs', async accounts => {
    it("Liquity multisig can transfer STBL (vesting) to lockup contracts they deployed", async () => {
      // Fast forward almost six months
      await th.fastForwardTime(SECONDS_IN_ALMOST_SIX_MONTHS, web3.currentProvider)

      const initialSTBLBalanceOfLC_T1 = await stblToken.balanceOf(LC_T1.address)
      const initialSTBLBalanceOfLC_T2 = await stblToken.balanceOf(LC_T2.address)
      const initialSTBLBalanceOfLC_T3 = await stblToken.balanceOf(LC_T3.address)
      const initialSTBLBalanceOfLC_T4 = await stblToken.balanceOf(LC_T4.address)
      const initialSTBLBalanceOfLC_T5 = await stblToken.balanceOf(LC_T5.address)
      const initialSTBLBalanceOfLC_T6 = await stblToken.balanceOf(LC_T6.address)
      const initialSTBLBalanceOfLC_T7 = await stblToken.balanceOf(LC_T7.address)
      const initialSTBLBalanceOfLC_T8 = await stblToken.balanceOf(LC_T8.address)
      const initialSTBLBalanceOfLC_T9 = await stblToken.balanceOf(LC_T9.address)

      // Check initial LC balances == entitlements
      assert.equal(initialSTBLBalanceOfLC_T1, teamMemberInitialEntitlement_1)
      assert.equal(initialSTBLBalanceOfLC_T2, teamMemberInitialEntitlement_2)
      assert.equal(initialSTBLBalanceOfLC_T3, teamMemberInitialEntitlement_3)
      // Check initial LC balances == entitlements
      assert.equal(initialSTBLBalanceOfLC_T4, teamMemberInitialEntitlement_4)
      assert.equal(initialSTBLBalanceOfLC_T5, teamMemberInitialEntitlement_5)
      assert.equal(initialSTBLBalanceOfLC_T6, teamMemberInitialEntitlement_6)
      // Check initial LC balances == entitlements
      assert.equal(initialSTBLBalanceOfLC_T7, teamMemberInitialEntitlement_7)
      assert.equal(initialSTBLBalanceOfLC_T8, teamMemberInitialEntitlement_8)
      assert.equal(initialSTBLBalanceOfLC_T9, teamMemberInitialEntitlement_9)

      // One month passes
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Liquity multisig transfers vesting amount
      await stblToken.transfer(LC_T1.address, dec(1, 24), { from: sixMonthsMultisig })
      await stblToken.transfer(LC_T2.address, dec(1, 24), { from: sixMonthsMultisig })
      await stblToken.transfer(LC_T3.address, dec(1, 24), { from: sixMonthsMultisig })

      // Get new LC STBL balances
      const STBLBalanceOfLC_T1_1 = await stblToken.balanceOf(LC_T1.address)
      const STBLBalanceOfLC_T2_1 = await stblToken.balanceOf(LC_T2.address)
      const STBLBalanceOfLC_T3_1 = await stblToken.balanceOf(LC_T3.address)

      // // Check team member LC balances have increased 
      assert.isTrue(STBLBalanceOfLC_T1_1.eq(th.toBN(initialSTBLBalanceOfLC_T1).add(th.toBN(dec(1, 24)))))
      assert.isTrue(STBLBalanceOfLC_T2_1.eq(th.toBN(initialSTBLBalanceOfLC_T2).add(th.toBN(dec(1, 24)))))
      assert.isTrue(STBLBalanceOfLC_T3_1.eq(th.toBN(initialSTBLBalanceOfLC_T3).add(th.toBN(dec(1, 24)))))

      // Another month passes
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Liquity multisig transfers vesting amount
      await stblToken.transfer(LC_T1.address, dec(1, 24), { from: sixMonthsMultisig })
      await stblToken.transfer(LC_T2.address, dec(1, 24), { from: sixMonthsMultisig })
      await stblToken.transfer(LC_T3.address, dec(1, 24), { from: sixMonthsMultisig })

      // Get new LC STBL balances
      const STBLBalanceOfLC_T1_2 = await stblToken.balanceOf(LC_T1.address)
      const STBLBalanceOfLC_T2_2 = await stblToken.balanceOf(LC_T2.address)
      const STBLBalanceOfLC_T3_2 = await stblToken.balanceOf(LC_T3.address)

      // Check team member LC balances have increased again
      assert.isTrue(STBLBalanceOfLC_T1_2.eq(STBLBalanceOfLC_T1_1.add(th.toBN(dec(1, 24)))))
      assert.isTrue(STBLBalanceOfLC_T2_2.eq(STBLBalanceOfLC_T2_1.add(th.toBN(dec(1, 24)))))
      assert.isTrue(STBLBalanceOfLC_T3_2.eq(STBLBalanceOfLC_T3_1.add(th.toBN(dec(1, 24)))))
    })

    it("Liquity multisig can transfer STBL to lockup contracts deployed by anyone", async () => {
      // A, B, C each deploy a lockup contract with themself as beneficiary
      const deployedLCtx_A = await lockupContractFactory.deploySixMonthsLockupContract(A, sixMonthsFromSystemDeployment, { from: A })
      const deployedLCtx_B = await lockupContractFactory.deploySixMonthsLockupContract(B, oneYearFromSystemDeployment, { from: B })
      const deployedLCtx_C = await lockupContractFactory.deploySixMonthsLockupContract(C, twoYearsFromSystemDeployment, { from: C })

      // A, B, C each deploy a lockup contract with themself as beneficiary
      const deployedLCtx_D = await lockupContractFactory.deployOneYearLockupContract(D, oneYearFromSystemDeployment, { from: D })
      const deployedLCtx_E = await lockupContractFactory.deployOneYearLockupContract(E, oneYearFromSystemDeployment, { from: E })
      const deployedLCtx_F = await lockupContractFactory.deployOneYearLockupContract(F, twoYearsFromSystemDeployment, { from: F })

      // LCs for team members on vesting schedules
      const LC_A = await th.getLCFromDeploymentTx(deployedLCtx_A)
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)
      const LC_C = await th.getLCFromDeploymentTx(deployedLCtx_C)
      const LC_D = await th.getLCFromDeploymentTx(deployedLCtx_D)
      const LC_E = await th.getLCFromDeploymentTx(deployedLCtx_E)
      const LC_F = await th.getLCFromDeploymentTx(deployedLCtx_F)

      // Check balances of LCs are 0
      assert.equal(await stblToken.balanceOf(LC_A.address), '0')
      assert.equal(await stblToken.balanceOf(LC_B.address), '0')
      assert.equal(await stblToken.balanceOf(LC_C.address), '0')
      assert.equal(await stblToken.balanceOf(LC_D.address), '0')
      assert.equal(await stblToken.balanceOf(LC_E.address), '0')
      assert.equal(await stblToken.balanceOf(LC_F.address), '0')

      // One month passes
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Liquity multisig transfers STBL to LCs deployed by other accounts
      await stblToken.transfer(LC_A.address, dec(1, 24), { from: sixMonthsMultisig })
      await stblToken.transfer(LC_B.address, dec(2, 24), { from: sixMonthsMultisig })
      await stblToken.transfer(LC_C.address, dec(3, 24), { from: sixMonthsMultisig })
      await stblToken.transfer(LC_D.address, dec(4, 24), { from: oneYearMultisig })
      await stblToken.transfer(LC_E.address, dec(5, 24), { from: oneYearMultisig })
      await stblToken.transfer(LC_F.address, dec(6, 24), { from: oneYearMultisig })

      // Check balances of LCs have increased
      assert.equal(await stblToken.balanceOf(LC_A.address), dec(1, 24))
      assert.equal(await stblToken.balanceOf(LC_B.address), dec(2, 24))
      assert.equal(await stblToken.balanceOf(LC_C.address), dec(3, 24))
      assert.equal(await stblToken.balanceOf(LC_D.address), dec(4, 24))
      assert.equal(await stblToken.balanceOf(LC_E.address), dec(5, 24))
      assert.equal(await stblToken.balanceOf(LC_F.address), dec(6, 24))
    })
  })

  describe('Deploying new LCs', async accounts => {
    it("STBL Deployer can deploy LCs through the Factory", async () => {
      // STBL deployer deploys LCs
      const LCDeploymentTx_A = await lockupContractFactory.deployTwoMonthsLockupContract(A, twoMonthsFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_B = await lockupContractFactory.deployTwoMonthsLockupContract(B, sixMonthsFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_C = await lockupContractFactory.deployTwoMonthsLockupContract(C, '9595995999999900000023423234', { from: liquityAG })
      const LCDeploymentTx_D = await lockupContractFactory.deploySixMonthsLockupContract(A, sixMonthsFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_E = await lockupContractFactory.deploySixMonthsLockupContract(B, oneYearFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_F = await lockupContractFactory.deploySixMonthsLockupContract(C, '9595995999999900000023423234', { from: liquityAG })
      const LCDeploymentTx_G = await lockupContractFactory.deployOneYearLockupContract(A, oneYearFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_H = await lockupContractFactory.deployOneYearLockupContract(B, twoYearsFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_I = await lockupContractFactory.deployOneYearLockupContract(C, '9595995999999900000023423234', { from: liquityAG })

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

    it("Liquity multisig can deploy LCs through the Factory", async () => {
      // STBL deployer deploys LCs
      const LCDeploymentTx_A = await lockupContractFactory.deployTwoMonthsLockupContract(A, twoMonthsFromSystemDeployment, { from: momentZeroMultisig })
      const LCDeploymentTx_B = await lockupContractFactory.deployTwoMonthsLockupContract(B, sixMonthsFromSystemDeployment, { from: momentZeroMultisig })
      const LCDeploymentTx_C = await lockupContractFactory.deployTwoMonthsLockupContract(C, '9595995999999900000023423234', { from: momentZeroMultisig })
      const LCDeploymentTx_D = await lockupContractFactory.deploySixMonthsLockupContract(A, sixMonthsFromSystemDeployment, { from: sixMonthsMultisig })
      const LCDeploymentTx_E = await lockupContractFactory.deploySixMonthsLockupContract(B, oneYearFromSystemDeployment, { from: sixMonthsMultisig })
      const LCDeploymentTx_F = await lockupContractFactory.deploySixMonthsLockupContract(C, '9595995999999900000023423234', { from: sixMonthsMultisig })
      const LCDeploymentTx_G = await lockupContractFactory.deployOneYearLockupContract(A, oneYearFromSystemDeployment, { from: oneYearMultisig })
      const LCDeploymentTx_H = await lockupContractFactory.deployOneYearLockupContract(B, twoYearsFromSystemDeployment, { from: oneYearMultisig })
      const LCDeploymentTx_I = await lockupContractFactory.deployOneYearLockupContract(C, '9595995999999900000023423234', { from: oneYearMultisig })

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

    it("Anyone can deploy LCs through the Factory", async () => {
      // Various EOAs deploy LCs
      const LCDeploymentTx_1 = await lockupContractFactory.deployTwoMonthsLockupContract(A, oneYearFromSystemDeployment, { from: teamMember_1 })
      const LCDeploymentTx_2 = await lockupContractFactory.deployTwoMonthsLockupContract(C, twoYearsFromSystemDeployment, { from: investor_2 })
      const LCDeploymentTx_3 = await lockupContractFactory.deployTwoMonthsLockupContract(liquityAG, '9595995999999900000023423234', { from: A })
      const LCDeploymentTx_4 = await lockupContractFactory.deployTwoMonthsLockupContract(D, twoYearsFromSystemDeployment, { from: B })

      // Various EOAs deploy LCs
      const LCDeploymentTx_5 = await lockupContractFactory.deploySixMonthsLockupContract(A, oneYearFromSystemDeployment, { from: teamMember_1 })
      const LCDeploymentTx_6 = await lockupContractFactory.deploySixMonthsLockupContract(C, twoYearsFromSystemDeployment, { from: investor_2 })
      const LCDeploymentTx_7 = await lockupContractFactory.deploySixMonthsLockupContract(liquityAG, '9595995999999900000023423234', { from: A })
      const LCDeploymentTx_8 = await lockupContractFactory.deploySixMonthsLockupContract(D, twoYearsFromSystemDeployment, { from: B })

      // Various EOAs deploy LCs
      const LCDeploymentTx_9 = await lockupContractFactory.deployOneYearLockupContract(A, oneYearFromSystemDeployment, { from: teamMember_1 })
      const LCDeploymentTx_10 = await lockupContractFactory.deployOneYearLockupContract(C, twoYearsFromSystemDeployment, { from: investor_2 })
      const LCDeploymentTx_11 = await lockupContractFactory.deployOneYearLockupContract(liquityAG, '9595995999999900000023423234', { from: A })
      const LCDeploymentTx_12 = await lockupContractFactory.deployOneYearLockupContract(D, twoYearsFromSystemDeployment, { from: B })

      assert.isTrue(LCDeploymentTx_1.receipt.status)
      assert.isTrue(LCDeploymentTx_2.receipt.status)
      assert.isTrue(LCDeploymentTx_3.receipt.status)
      assert.isTrue(LCDeploymentTx_4.receipt.status)

      assert.isTrue(LCDeploymentTx_5.receipt.status)
      assert.isTrue(LCDeploymentTx_6.receipt.status)
      assert.isTrue(LCDeploymentTx_7.receipt.status)
      assert.isTrue(LCDeploymentTx_8.receipt.status)

      assert.isTrue(LCDeploymentTx_9.receipt.status)
      assert.isTrue(LCDeploymentTx_10.receipt.status)
      assert.isTrue(LCDeploymentTx_11.receipt.status)
      assert.isTrue(LCDeploymentTx_12.receipt.status)
    })

    it("STBL Deployer can deploy LCs directly", async () => {
      // STBL deployer deploys LCs
      const LC_A = await TwoMonthsLockupContract.new(stblToken.address, A, twoMonthsFromSystemDeployment, { from: liquityAG })
      const LC_A_txReceipt = await web3.eth.getTransactionReceipt(LC_A.transactionHash)

      const LC_B = await TwoMonthsLockupContract.new(stblToken.address, B, twoMonthsFromSystemDeployment, { from: liquityAG })
      const LC_B_txReceipt = await web3.eth.getTransactionReceipt(LC_B.transactionHash)

      const LC_C = await TwoMonthsLockupContract.new(stblToken.address, C, twoMonthsFromSystemDeployment, { from: liquityAG })
      const LC_C_txReceipt = await web3.eth.getTransactionReceipt(LC_C.transactionHash)

      // STBL deployer deploys LCs
      const LC_D = await SixMonthsLockupContract.new(stblToken.address, D, sixMonthsFromSystemDeployment, { from: liquityAG })
      const LC_D_txReceipt = await web3.eth.getTransactionReceipt(LC_D.transactionHash)

      const LC_E = await SixMonthsLockupContract.new(stblToken.address, E, sixMonthsFromSystemDeployment, { from: liquityAG })
      const LC_E_txReceipt = await web3.eth.getTransactionReceipt(LC_E.transactionHash)

      const LC_F = await SixMonthsLockupContract.new(stblToken.address, F, sixMonthsFromSystemDeployment, { from: liquityAG })
      const LC_F_txReceipt = await web3.eth.getTransactionReceipt(LC_F.transactionHash)

      // STBL deployer deploys LCs
      const LC_G = await OneYearLockupContract.new(stblToken.address, G, oneYearFromSystemDeployment, { from: liquityAG })
      const LC_G_txReceipt = await web3.eth.getTransactionReceipt(LC_G.transactionHash)

      const LC_H = await OneYearLockupContract.new(stblToken.address, H, oneYearFromSystemDeployment, { from: liquityAG })
      const LC_H_txReceipt = await web3.eth.getTransactionReceipt(LC_H.transactionHash)

      const LC_I = await OneYearLockupContract.new(stblToken.address, I, twoYearsFromSystemDeployment, { from: liquityAG })
      const LC_I_txReceipt = await web3.eth.getTransactionReceipt(LC_I.transactionHash)

      // Check deployment succeeded
      assert.isTrue(LC_A_txReceipt.status)
      assert.isTrue(LC_B_txReceipt.status)
      assert.isTrue(LC_C_txReceipt.status)
      assert.isTrue(LC_D_txReceipt.status)
      assert.isTrue(LC_E_txReceipt.status)
      assert.isTrue(LC_F_txReceipt.status)
      assert.isTrue(LC_G_txReceipt.status)
      assert.isTrue(LC_H_txReceipt.status)
      assert.isTrue(LC_I_txReceipt.status)
    })

    it("Liquity multisig can deploy LCs directly", async () => {
      // STBL multisig deploys LCs
      const LC_A = await TwoMonthsLockupContract.new(stblToken.address, A, twoMonthsFromSystemDeployment, { from: momentZeroMultisig })
      const LC_A_txReceipt = await web3.eth.getTransactionReceipt(LC_A.transactionHash)

      const LC_B = await TwoMonthsLockupContract.new(stblToken.address, B, twoMonthsFromSystemDeployment, { from: momentZeroMultisig })
      const LC_B_txReceipt = await web3.eth.getTransactionReceipt(LC_B.transactionHash)

      const LC_C = await TwoMonthsLockupContract.new(stblToken.address, C, twoMonthsFromSystemDeployment, { from: momentZeroMultisig })
      const LC_C_txReceipt = await web3.eth.getTransactionReceipt(LC_C.transactionHash)

      const LC_D = await SixMonthsLockupContract.new(stblToken.address, D, sixMonthsFromSystemDeployment, { from: sixMonthsMultisig })
      const LC_D_txReceipt = await web3.eth.getTransactionReceipt(LC_D.transactionHash)

      const LC_E = await SixMonthsLockupContract.new(stblToken.address, E, sixMonthsFromSystemDeployment, { from: sixMonthsMultisig })
      const LC_E_txReceipt = await web3.eth.getTransactionReceipt(LC_E.transactionHash)

      const LC_F = await SixMonthsLockupContract.new(stblToken.address, F, sixMonthsFromSystemDeployment, { from: sixMonthsMultisig })
      const LC_F_txReceipt = await web3.eth.getTransactionReceipt(LC_F.transactionHash)

      const LC_G = await OneYearLockupContract.new(stblToken.address, G, oneYearFromSystemDeployment, { from: oneYearMultisig })
      const LC_G_txReceipt = await web3.eth.getTransactionReceipt(LC_G.transactionHash)

      const LC_H = await OneYearLockupContract.new(stblToken.address, H, oneYearFromSystemDeployment, { from: oneYearMultisig })
      const LC_H_txReceipt = await web3.eth.getTransactionReceipt(LC_H.transactionHash)

      const LC_I = await OneYearLockupContract.new(stblToken.address, I, twoYearsFromSystemDeployment, { from: oneYearMultisig })
      const LC_I_txReceipt = await web3.eth.getTransactionReceipt(LC_I.transactionHash)

      // Check deployment succeeded
      assert.isTrue(LC_A_txReceipt.status)
      assert.isTrue(LC_B_txReceipt.status)
      assert.isTrue(LC_C_txReceipt.status)
      assert.isTrue(LC_D_txReceipt.status)
      assert.isTrue(LC_E_txReceipt.status)
      assert.isTrue(LC_F_txReceipt.status)
      assert.isTrue(LC_G_txReceipt.status)
      assert.isTrue(LC_H_txReceipt.status)
      assert.isTrue(LC_I_txReceipt.status)
    })

    it("Anyone can deploy LCs directly", async () => {
     // STBL multisig deploys LCs
     const LC_A = await TwoMonthsLockupContract.new(stblToken.address, A, twoMonthsFromSystemDeployment, { from: J })
     const LC_A_txReceipt = await web3.eth.getTransactionReceipt(LC_A.transactionHash)

     const LC_B = await TwoMonthsLockupContract.new(stblToken.address, B, twoMonthsFromSystemDeployment, { from: K })
     const LC_B_txReceipt = await web3.eth.getTransactionReceipt(LC_B.transactionHash)

     const LC_C = await TwoMonthsLockupContract.new(stblToken.address, C, twoMonthsFromSystemDeployment, { from: L })
     const LC_C_txReceipt = await web3.eth.getTransactionReceipt(LC_C.transactionHash)

     const LC_D = await SixMonthsLockupContract.new(stblToken.address, D, sixMonthsFromSystemDeployment, { from: M })
     const LC_D_txReceipt = await web3.eth.getTransactionReceipt(LC_D.transactionHash)

     const LC_E = await SixMonthsLockupContract.new(stblToken.address, E, sixMonthsFromSystemDeployment, { from: N })
     const LC_E_txReceipt = await web3.eth.getTransactionReceipt(LC_E.transactionHash)

     const LC_F = await SixMonthsLockupContract.new(stblToken.address, F, sixMonthsFromSystemDeployment, { from: O })
     const LC_F_txReceipt = await web3.eth.getTransactionReceipt(LC_F.transactionHash)

     const LC_G = await OneYearLockupContract.new(stblToken.address, G, oneYearFromSystemDeployment, { from: A })
     const LC_G_txReceipt = await web3.eth.getTransactionReceipt(LC_G.transactionHash)

     const LC_H = await OneYearLockupContract.new(stblToken.address, H, oneYearFromSystemDeployment, { from: B })
     const LC_H_txReceipt = await web3.eth.getTransactionReceipt(LC_H.transactionHash)

     const LC_I = await OneYearLockupContract.new(stblToken.address, I, twoYearsFromSystemDeployment, { from: C })
     const LC_I_txReceipt = await web3.eth.getTransactionReceipt(LC_I.transactionHash)

     // Check deployment succeeded
     assert.isTrue(LC_A_txReceipt.status)
     assert.isTrue(LC_B_txReceipt.status)
     assert.isTrue(LC_C_txReceipt.status)
     assert.isTrue(LC_D_txReceipt.status)
     assert.isTrue(LC_E_txReceipt.status)
     assert.isTrue(LC_F_txReceipt.status)
     assert.isTrue(LC_G_txReceipt.status)
     assert.isTrue(LC_H_txReceipt.status)
     assert.isTrue(LC_I_txReceipt.status)
    })

    it("Anyone can deploy LCs with unlockTime = one year from deployment, directly and through factory", async () => {
      // Deploy directly
      const LC_1 = await TwoMonthsLockupContract.new(stblToken.address, A, oneYearFromSystemDeployment, { from: D })
      const LCTxReceipt_1 = await web3.eth.getTransactionReceipt(LC_1.transactionHash)

      const LC_2 = await TwoMonthsLockupContract.new(stblToken.address, B, oneYearFromSystemDeployment, { from: liquityAG })
      const LCTxReceipt_2 = await web3.eth.getTransactionReceipt(LC_2.transactionHash)

      const LC_3 = await TwoMonthsLockupContract.new(stblToken.address, C, oneYearFromSystemDeployment, { from: momentZeroMultisig })
      const LCTxReceipt_3 = await web3.eth.getTransactionReceipt(LC_3.transactionHash)

      const LC_4 = await SixMonthsLockupContract.new(stblToken.address, D, oneYearFromSystemDeployment, { from: K })
      const LCTxReceipt_4 = await web3.eth.getTransactionReceipt(LC_4.transactionHash)

      const LC_5 = await SixMonthsLockupContract.new(stblToken.address, E, oneYearFromSystemDeployment, { from: liquityAG })
      const LCTxReceipt_5 = await web3.eth.getTransactionReceipt(LC_5.transactionHash)

      const LC_6 = await SixMonthsLockupContract.new(stblToken.address, F, oneYearFromSystemDeployment, { from: sixMonthsMultisig })
      const LCTxReceipt_6 = await web3.eth.getTransactionReceipt(LC_6.transactionHash)

      const LC_7 = await OneYearLockupContract.new(stblToken.address, G, oneYearFromSystemDeployment, { from: J })
      const LCTxReceipt_7 = await web3.eth.getTransactionReceipt(LC_7.transactionHash)

      const LC_8 = await OneYearLockupContract.new(stblToken.address, H, oneYearFromSystemDeployment, { from: liquityAG })
      const LCTxReceipt_8 = await web3.eth.getTransactionReceipt(LC_8.transactionHash)

      const LC_9 = await OneYearLockupContract.new(stblToken.address, I, oneYearFromSystemDeployment, { from: oneYearMultisig })
      const LCTxReceipt_9 = await web3.eth.getTransactionReceipt(LC_9.transactionHash)

      // Deploy through factory
      const LCDeploymentTx_10 = await lockupContractFactory.deployTwoMonthsLockupContract(K, oneYearFromSystemDeployment, { from: A })
      const LCDeploymentTx_11 = await lockupContractFactory.deployTwoMonthsLockupContract(L, twoYearsFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_12 = await lockupContractFactory.deployTwoMonthsLockupContract(M, twoYearsFromSystemDeployment, { from: momentZeroMultisig })
      const LCDeploymentTx_13 = await lockupContractFactory.deploySixMonthsLockupContract(N, oneYearFromSystemDeployment, { from: B })
      const LCDeploymentTx_14 = await lockupContractFactory.deploySixMonthsLockupContract(O, twoYearsFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_15 = await lockupContractFactory.deploySixMonthsLockupContract(A, twoYearsFromSystemDeployment, { from: sixMonthsMultisig })
      const LCDeploymentTx_16 = await lockupContractFactory.deployOneYearLockupContract(B, oneYearFromSystemDeployment, { from: C })
      const LCDeploymentTx_17 = await lockupContractFactory.deployOneYearLockupContract(C, twoYearsFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_18 = await lockupContractFactory.deployOneYearLockupContract(D, twoYearsFromSystemDeployment, { from: oneYearMultisig })

      // Check deployments succeeded
      assert.isTrue(LCTxReceipt_1.status)
      assert.isTrue(LCTxReceipt_2.status)
      assert.isTrue(LCTxReceipt_3.status)
      assert.isTrue(LCTxReceipt_4.status)
      assert.isTrue(LCTxReceipt_5.status)
      assert.isTrue(LCTxReceipt_6.status)
      assert.isTrue(LCTxReceipt_7.status)
      assert.isTrue(LCTxReceipt_8.status)
      assert.isTrue(LCTxReceipt_9.status)

      assert.isTrue(LCDeploymentTx_10.receipt.status)
      assert.isTrue(LCDeploymentTx_11.receipt.status)
      assert.isTrue(LCDeploymentTx_12.receipt.status)
      assert.isTrue(LCDeploymentTx_13.receipt.status)
      assert.isTrue(LCDeploymentTx_14.receipt.status)
      assert.isTrue(LCDeploymentTx_15.receipt.status)
      assert.isTrue(LCDeploymentTx_16.receipt.status)
      assert.isTrue(LCDeploymentTx_17.receipt.status)
      assert.isTrue(LCDeploymentTx_18.receipt.status)
    })

    it("Anyone can deploy LCs with unlockTime > one year from deployment, directly and through factory", async () => {
      const justOverOneYear = oneYearFromSystemDeployment.add(toBN('1'))
      const _17YearsFromDeployment = oneYearFromSystemDeployment.add(toBN(timeValues.SECONDS_IN_ONE_YEAR).mul(toBN('2')))
      
      // Deploy directly
      const LC_1 = await OneYearLockupContract.new(stblToken.address, A, twoYearsFromSystemDeployment, { from: D })
      const LCTxReceipt_1 = await web3.eth.getTransactionReceipt(LC_1.transactionHash)

      const LC_2 = await OneYearLockupContract.new(stblToken.address, B, justOverOneYear, { from: oneYearMultisig })
      const LCTxReceipt_2 = await web3.eth.getTransactionReceipt(LC_2.transactionHash)

      const LC_3 = await OneYearLockupContract.new(stblToken.address, E, _17YearsFromDeployment, { from: E })
      const LCTxReceipt_3 = await web3.eth.getTransactionReceipt(LC_3.transactionHash)

      // Deploy through factory
      const LCDeploymentTx_4 = await lockupContractFactory.deployOneYearLockupContract(A, oneYearFromSystemDeployment, { from: E })
      const LCDeploymentTx_5 = await lockupContractFactory.deployOneYearLockupContract(C, twoYearsFromSystemDeployment, { from: oneYearMultisig })
      const LCDeploymentTx_6 = await lockupContractFactory.deployOneYearLockupContract(D, twoYearsFromSystemDeployment, { from: teamMember_2 })

      // Check deployments succeeded
      assert.isTrue(LCTxReceipt_1.status)
      assert.isTrue(LCTxReceipt_2.status)
      assert.isTrue(LCTxReceipt_3.status)
      assert.isTrue(LCDeploymentTx_4.receipt.status)
      assert.isTrue(LCDeploymentTx_5.receipt.status)
      assert.isTrue(LCDeploymentTx_6.receipt.status)
    })

    it("No one can deploy LCs with unlockTime < one year from deployment, directly or through factory", async () => {
      const justUnderTwoMonths = twoMonthsFromSystemDeployment.sub(toBN('1'))
      const justUnderSixMonths = sixMonthsFromSystemDeployment.sub(toBN('1'))
      const justUnderOneYear = oneYearFromSystemDeployment.sub(toBN('1'))
     
      // Attempt to deploy directly
      const directDeploymentTxPromise_1 = TwoMonthsLockupContract.new(stblToken.address, D, justUnderTwoMonths, { from: D })
      const directDeploymentTxPromise_2 = TwoMonthsLockupContract.new(stblToken.address, F, '43200', { from: momentZeroMultisig })
      const directDeploymentTxPromise_3 =  TwoMonthsLockupContract.new(stblToken.address, G, '354534', { from: E })
      const directDeploymentTxPromise_4 = SixMonthsLockupContract.new(stblToken.address, H, justUnderSixMonths, { from: K })
      const directDeploymentTxPromise_5 = SixMonthsLockupContract.new(stblToken.address, I, '43200', { from: sixMonthsMultisig })
      const directDeploymentTxPromise_6 =  SixMonthsLockupContract.new(stblToken.address, J, '354534', { from: L })
      const directDeploymentTxPromise_7 = OneYearLockupContract.new(stblToken.address, K, justUnderOneYear, { from: M })
      const directDeploymentTxPromise_8 = OneYearLockupContract.new(stblToken.address, L, '43200', { from: oneYearMultisig })
      const directDeploymentTxPromise_9 =  OneYearLockupContract.new(stblToken.address, M, '354534', { from: N })
  
      // Attempt to deploy through factory
      const factoryDploymentTxPromise_1 = lockupContractFactory.deployTwoMonthsLockupContract(D, justUnderTwoMonths, { from: E })
      const factoryDploymentTxPromise_2 = lockupContractFactory.deployTwoMonthsLockupContract(E, '43200', { from: momentZeroMultisig })
      const factoryDploymentTxPromise_3 = lockupContractFactory.deployTwoMonthsLockupContract(F, '354534', { from: teamMember_2 })
      const factoryDploymentTxPromise_4 = lockupContractFactory.deploySixMonthsLockupContract(G, justUnderSixMonths, { from: E })
      const factoryDploymentTxPromise_5 = lockupContractFactory.deploySixMonthsLockupContract(H, '43200', { from: sixMonthsMultisig })
      const factoryDploymentTxPromise_6 = lockupContractFactory.deploySixMonthsLockupContract(I, '354534', { from: teamMember_2 })
      const factoryDploymentTxPromise_7 = lockupContractFactory.deployOneYearLockupContract(J, justUnderOneYear, { from: E })
      const factoryDploymentTxPromise_8 = lockupContractFactory.deployOneYearLockupContract(K, '43200', { from: oneYearMultisig })
      const factoryDploymentTxPromise_9 = lockupContractFactory.deployOneYearLockupContract(L, '354534', { from: teamMember_2 })

      // Check deployments reverted
      await assertRevert(directDeploymentTxPromise_1, "TwoMonthsLockupContract: unlock time must be at least two months after system deployment")
      await assertRevert(directDeploymentTxPromise_2, "TwoMonthsLockupContract: unlock time must be at least two months after system deployment")
      await assertRevert(directDeploymentTxPromise_3, "TwoMonthsLockupContract: unlock time must be at least two months after system deployment")
      await assertRevert(directDeploymentTxPromise_4, "SixMonthsLockupContract: unlock time must be at least six months after system deployment")
      await assertRevert(directDeploymentTxPromise_5, "SixMonthsLockupContract: unlock time must be at least six months after system deployment")
      await assertRevert(directDeploymentTxPromise_6, "SixMonthsLockupContract: unlock time must be at least six months after system deployment")
      await assertRevert(directDeploymentTxPromise_7, "OneYearLockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(directDeploymentTxPromise_8, "OneYearLockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(directDeploymentTxPromise_9, "OneYearLockupContract: unlock time must be at least one year after system deployment")

      await assertRevert(factoryDploymentTxPromise_1, "TwoMonthsLockupContract: unlock time must be at least two months after system deployment")
      await assertRevert(factoryDploymentTxPromise_2, "TwoMonthsLockupContract: unlock time must be at least two months after system deployment")
      await assertRevert(factoryDploymentTxPromise_3, "TwoMonthsLockupContract: unlock time must be at least two months after system deployment")
      await assertRevert(factoryDploymentTxPromise_4, "SixMonthsLockupContract: unlock time must be at least six months after system deployment")
      await assertRevert(factoryDploymentTxPromise_5, "SixMonthsLockupContract: unlock time must be at least six months after system deployment")
      await assertRevert(factoryDploymentTxPromise_6, "SixMonthsLockupContract: unlock time must be at least six months after system deployment")
      await assertRevert(factoryDploymentTxPromise_7, "OneYearLockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(factoryDploymentTxPromise_8, "OneYearLockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(factoryDploymentTxPromise_9, "OneYearLockupContract: unlock time must be at least one year after system deployment")
    })


    describe('Withdrawal Attempts on LCs before unlockTime has passed ', async accounts => {
      it("Liquity multisig can't withdraw from a funded LC they deployed for another beneficiary through the Factory before the unlockTime", async () => {

        // Check currentTime < unlockTime
        const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
        const unlockTime = await LC_T1.unlockTime()
        assert.isTrue(currentTime.lt(unlockTime))

        // Liquity multisig attempts withdrawal from LC they deployed through the Factory
        try {
          const withdrawalAttempt = await LC_T1.withdrawSTBL({ from: momentZeroMultisig })
          assert.isFalse(withdrawalAttempt.receipt.status)
        } catch (error) {
          assert.include(error.message, "LockupContract: caller is not the beneficiary")
        }
      })

      it("Liquity multisig can't withdraw from a funded LC that someone else deployed before the unlockTime", async () => {
        // Account D deploys a new LC via the Factory
        const deployedLCtx_B = await lockupContractFactory.deployTwoMonthsLockupContract(B, oneYearFromSystemDeployment, { from: D })
        const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

        //STBL multisig fund the newly deployed LCs
        await stblToken.transfer(LC_B.address, dec(2, 18), { from: momentZeroMultisig })

        // Check currentTime < unlockTime
        const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
        const unlockTime = await LC_B.unlockTime()
        assert.isTrue(currentTime.lt(unlockTime))

        // Liquity multisig attempts withdrawal from LCs
        try {
          const withdrawalAttempt_B = await LC_B.withdrawSTBL({ from: momentZeroMultisig })
          assert.isFalse(withdrawalAttempt_B.receipt.status)
        } catch (error) {
          assert.include(error.message, "LockupContract: caller is not the beneficiary")
        }
      })

      it("Beneficiary can't withdraw from their funded LC before the unlockTime", async () => {
        // Account D deploys a new LC via the Factory
        const deployedLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, oneYearFromSystemDeployment, { from: D })
        const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

        // Liquity multisig funds contracts
        await stblToken.transfer(LC_B.address, dec(2, 18), { from: momentZeroMultisig })

        // Check currentTime < unlockTime
        const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
        const unlockTime = await LC_B.unlockTime()
        assert.isTrue(currentTime.lt(unlockTime))

        /* Beneficiaries of all LCS - team, investor, and newly created LCs - 
        attempt to withdraw from their respective funded contracts */
        const LCs = [
          LC_T1,
          LC_T2,
          LC_T3,
          LC_I1,
          LC_I2,
          LC_T3,
          LC_B
        ]

        for (LC of LCs) {
          try {
            const beneficiary = await LC.beneficiary()
            const withdrawalAttempt = await LC.withdrawSTBL({ from: beneficiary })
            assert.isFalse(withdrawalAttempt.receipt.status)
          } catch (error) {
            assert.include(error.message, "LockupContract: The lockup duration must have passed")
          }
        }
      })

      it("No one can withdraw from a beneficiary's funded LC before the unlockTime", async () => {
        // Account D deploys a new LC via the Factory
        const deployedLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, oneYearFromSystemDeployment, { from: D })
        const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

        // Liquity multisig funds contract
        await stblToken.transfer(LC_B.address, dec(2, 18), { from: momentZeroMultisig })

        // Check currentTime < unlockTime
        const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
        const unlockTime = await LC_B.unlockTime()
        assert.isTrue(currentTime.lt(unlockTime))

        const variousEOAs = [teamMember_2, liquityAG, momentZeroMultisig, investor_1, A, C, D, E]

        // Several EOAs attempt to withdraw from LC deployed by D
        for (account of variousEOAs) {
          try {
            const withdrawalAttempt = await LC_B.withdrawSTBL({ from: account })
            assert.isFalse(withdrawalAttempt.receipt.status)
          } catch (error) {
            assert.include(error.message, "LockupContract: caller is not the beneficiary")
          }
        }

        // Several EOAs attempt to withdraw from LC_T1 deployed by STBL deployer
        for (account of variousEOAs) {
          try {
            const withdrawalAttempt = await LC_T1.withdrawSTBL({ from: account })
            assert.isFalse(withdrawalAttempt.receipt.status)
          } catch (error) {
            assert.include(error.message, "LockupContract: caller is not the beneficiary")
          }
        }
      })
    })
  })
})
