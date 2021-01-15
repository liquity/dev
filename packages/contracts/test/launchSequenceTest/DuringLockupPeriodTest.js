// const OneYearLockupContract = artifacts.require("./OneYearLockupContract.sol")
// const CustomDurationLockupContract = artifacts.require("./CustomDurationLockupContract.sol")
// const LockupContractFactory = artifacts.require("./LockupContractFactory.sol")
// const deploymentHelper = require("../../utils/deploymentHelpers.js")

// const { TestHelper: th, TimeValues: timeValues } = require("../../utils/testHelpers.js")
// const { dec, toBN, assertRevert, ZERO_ADDRESS } = th

// contract('During the initial lockup period', async accounts => {
//   const [
//     liquityAG,
//     teamMember_1,
//     teamMember_2,
//     teamMember_3,
//     investor_1,
//     investor_2,
//     investor_3,
//     A,
//     B,
//     C,
//     D,
//     E,
//     F,
//     G,
//     H,
//     I
//   ] = accounts;

//   const bountyAddress = accounts[998]
//   const lpRewardsAddress = accounts[999]

//   const SECONDS_IN_ONE_MONTH = timeValues.SECONDS_IN_ONE_MONTH
//   const SECONDS_IN_364_DAYS = timeValues.SECONDS_IN_ONE_DAY * 364

//   let LQTYContracts
//   let coreContracts

//   // OYLCs for team members on vesting schedules
//   let OYLC_T1
//   let OYLC_T2
//   let OYLC_T3

//   // OYLCs for investors
//   let OYLC_I1
//   let OYLC_I2
//   let OYLC_I3

//   // 1e24 = 1 million tokens with 18 decimal digits
//   const teamMemberInitialEntitlement_1 = dec(1, 24)
//   const teamMemberInitialEntitlement_2 = dec(2, 24)
//   const teamMemberInitialEntitlement_3 = dec(3, 24)
//   const investorInitialEntitlement_1 = dec(4, 24)
//   const investorInitialEntitlement_2 = dec(5, 24)
//   const investorInitialEntitlement_3 = dec(6, 24)

//   const LQTYEntitlement_A = dec(1, 24)
//   const LQTYEntitlement_B = dec(2, 24)
//   const LQTYEntitlement_C = dec(3, 24)
//   const LQTYEntitlement_D = dec(4, 24)
//   const LQTYEntitlement_E = dec(5, 24)

//   beforeEach(async () => {
//     // Deploy all contracts from the first account
//     coreContracts = await deploymentHelper.deployLiquityCore()
//     LQTYContracts = await deploymentHelper.deployLQTYTesterContractsHardhat(bountyAddress, lpRewardsAddress)

//     lqtyStaking = LQTYContracts.lqtyStaking
//     lqtyToken = LQTYContracts.lqtyToken
//     communityIssuance = LQTYContracts.communityIssuance
//     lockupContractFactory = LQTYContracts.lockupContractFactory

//     await deploymentHelper.connectLQTYContracts(LQTYContracts)
//     await deploymentHelper.connectCoreContracts(coreContracts, LQTYContracts)
//     await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, coreContracts)


//     // Deploy 3 OYLCs for team members on vesting schedules
//     const deployedOYLCtx_T1 = await lockupContractFactory.deployOneYearLockupContract(teamMember_1, teamMemberInitialEntitlement_1, { from: liquityAG })
//     const deployedOYLCtx_T2 = await lockupContractFactory.deployOneYearLockupContract(teamMember_2, teamMemberInitialEntitlement_2, { from: liquityAG })
//     const deployedOYLCtx_T3 = await lockupContractFactory.deployOneYearLockupContract(teamMember_3, teamMemberInitialEntitlement_3, { from: liquityAG })

//     const deployedOYLCtx_I1 = await lockupContractFactory.deployOneYearLockupContract(investor_1, investorInitialEntitlement_1, { from: liquityAG })
//     const deployedOYLCtx_I2 = await lockupContractFactory.deployOneYearLockupContract(investor_2, investorInitialEntitlement_2, { from: liquityAG })
//     const deployedOYLCtx_I3 = await lockupContractFactory.deployOneYearLockupContract(investor_3, investorInitialEntitlement_3, { from: liquityAG })

//     // OYLCs for team members on vesting schedules
//     OYLC_T1 = await th.getOYLCFromDeploymentTx(deployedOYLCtx_T1)
//     OYLC_T2 = await th.getOYLCFromDeploymentTx(deployedOYLCtx_T2)
//     OYLC_T3 = await th.getOYLCFromDeploymentTx(deployedOYLCtx_T3)

//     // OYLCs for investors
//     OYLC_I1 = await th.getOYLCFromDeploymentTx(deployedOYLCtx_I1)
//     OYLC_I2 = await th.getOYLCFromDeploymentTx(deployedOYLCtx_I2)
//     OYLC_I3 = await th.getOYLCFromDeploymentTx(deployedOYLCtx_I3)

//     // LiquityAG transfers initial LQTY entitlements to OYLCs
//     await lqtyToken.transfer(OYLC_T1.address, teamMemberInitialEntitlement_1, { from: liquityAG })
//     await lqtyToken.transfer(OYLC_T2.address, teamMemberInitialEntitlement_2, { from: liquityAG })
//     await lqtyToken.transfer(OYLC_T3.address, teamMemberInitialEntitlement_3, { from: liquityAG })

//     await lqtyToken.transfer(OYLC_I1.address, investorInitialEntitlement_1, { from: liquityAG })
//     await lqtyToken.transfer(OYLC_I2.address, investorInitialEntitlement_2, { from: liquityAG })
//     await lqtyToken.transfer(OYLC_I3.address, investorInitialEntitlement_3, { from: liquityAG })

//     const OYLCsToLock = [
//       // Team
//       OYLC_T1.address,
//       OYLC_T2.address,
//       OYLC_T3.address,
//       // Investors
//       OYLC_I1.address,
//       OYLC_I2.address,
//       OYLC_I3.address
//     ]
//     // LQTY deployer locks the OYLCs they deployed
//     await lockupContractFactory.lockOneYearContracts(OYLCsToLock, { from: liquityAG })

//     // Fast forward time 364 days, so that still less than 1 year since launch has passed
//     await th.fastForwardTime(SECONDS_IN_364_DAYS, web3.currentProvider)
//   })

//   describe('LQTY transfer during first year after LQTY deployment', async accounts => {
//     // --- Liquity AG transfer restriction, 1st year ---
//     it("LQTY deployer can not transfer LQTY to a OYLC that was deployed directly", async () => {
//       // LQTY deployer deploys OYLC_A
//       const OYLC_A = await OneYearLockupContract.new(lqtyToken.address, A, dec(1, 18), { from: liquityAG })

//       // Account F deploys OYLC_B
//       const OYLC_B = await OneYearLockupContract.new(lqtyToken.address, B, dec(1, 18), { from: F })

//       // LQTY deployer attempts LQTY transfer to OYLC_A
//       try {
//         const LQTYtransferTx_A = await lqtyToken.transfer(OYLC_A.address, dec(1, 18), { from: liquityAG })
//         assert.isFalse(LQTYtransferTx_A.receipt.status)
//       } catch (error) {
//         assert.include(error.message, "revert")
//       }

//       // LQTY deployer attempts LQTY transfer to OYLC_B
//       try {
//         const LQTYtransferTx_B = await lqtyToken.transfer(OYLC_B.address, dec(1, 18), { from: liquityAG })
//         assert.isFalse(LQTYtransferTx_B.receipt.status)
//       } catch (error) {
//         assert.include(error.message, "revert")
//       }
//     })

//     it("LQTY deployer can not transfer LQTY to a CDLC that they deployed directly", async () => {
//       // LQTY deployer deploys CDLC directly
//       const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, dec(1, 18), SECONDS_IN_ONE_MONTH, { from: liquityAG })

//       // LQTY deployer attempts LQTY transfer to CDLC
//       try {
//         const LQTYtransferTx = await lqtyToken.transfer(CDLC_A.address, dec(1, 18), { from: liquityAG })
//         assert.isFalse(LQTYtransferTx.receipt.status)
//       } catch (error) {
//         assert.include(error.message, "revert")
//       }
//     })

//     it("LQTY deployer can not transfer LQTY to a CDLC that someone else deployed directly", async () => {
//       // LQTY deployer deploys CDLC directly
//       const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, dec(1, 18), SECONDS_IN_ONE_MONTH, { from: D })

//       // LQTY deployer attempts LQTY transfer to CDLC
//       try {
//         const LQTYtransferTx = await lqtyToken.transfer(CDLC_A.address, dec(1, 18), { from: liquityAG })
//         assert.isFalse(LQTYtransferTx.receipt.status)
//       } catch (error) {
//         assert.include(error.message, "revert")
//       }
//     })

//     it("LQTY deployer can not transfer to an EOA", async () => {
//       // Deployer attempts LQTY transfer to EOAs
//       const LQTYtransferTxPromise_1 = lqtyToken.transfer(A, dec(1, 18), { from: liquityAG })
//       const LQTYtransferTxPromise_2 = lqtyToken.transfer(B, dec(1, 18), { from: liquityAG })
//       await assertRevert(LQTYtransferTxPromise_1)
//       await assertRevert(LQTYtransferTxPromise_2)

//       // Deployer attempts LQTY transfer to core Liquity contracts
//       for (const contract of Object.keys(coreContracts)) {
//         const LQTYtransferTxPromise = lqtyToken.transfer(coreContracts[contract].address, dec(1, 18), { from: liquityAG })
//         await assertRevert(LQTYtransferTxPromise)
//       }

//       // Deployer attempts LQTY transfer to LQTY contracts (excluding OYLCs)
//       for (const contract of Object.keys(LQTYContracts)) {
//         const LQTYtransferTxPromise = lqtyToken.transfer(LQTYContracts[contract].address, dec(1, 18), { from: liquityAG })
//         await assertRevert(LQTYtransferTxPromise)
//       }
//     })

//     // --- Liquity AG approval restriction, 1st year ---
//     it("LQTY deployer can not approve any EOA or Liquity contract to spend their LQTY", async () => {
//       // Deployer attempts to approve EOAs to spend LQTY
//       const LQTYApproveTxPromise_1 = lqtyToken.approve(A, dec(1, 18), { from: liquityAG })
//       const LQTYApproveTxPromise_2 = lqtyToken.approve(B, dec(1, 18), { from: liquityAG })
//       await assertRevert(LQTYApproveTxPromise_1)
//       await assertRevert(LQTYApproveTxPromise_2)

//       // Deployer attempts to approve Liquity contracts to spend LQTY
//       for (const contract of Object.keys(coreContracts)) {
//         const LQTYApproveTxPromise = lqtyToken.approve(coreContracts[contract].address, dec(1, 18), { from: liquityAG })
//         await assertRevert(LQTYApproveTxPromise)
//       }

//       // Deployer attempts to approve LQTY contracts to spend LQTY (excluding OYLCs)
//       for (const contract of Object.keys(LQTYContracts)) {
//         const LQTYApproveTxPromise = lqtyToken.approve(LQTYContracts[contract].address, dec(1, 18), { from: liquityAG })
//         await assertRevert(LQTYApproveTxPromise)
//       }
//     })

//     // --- Liquity AG increaseAllowance restriction, 1st year ---
//     it("LQTY deployer can not increaseAllowance for any EOA or Liquity contract", async () => {
//       // Deployer attempts to approve EOAs to spend LQTY
//       const LQTYIncreaseAllowanceTxPromise_1 = lqtyToken.increaseAllowance(A, dec(1, 18), { from: liquityAG })
//       const LQTYIncreaseAllowanceTxPromise_2 = lqtyToken.increaseAllowance(B, dec(1, 18), { from: liquityAG })
//       await assertRevert(LQTYIncreaseAllowanceTxPromise_1)
//       await assertRevert(LQTYIncreaseAllowanceTxPromise_2)

//       // Deployer attempts to approve Liquity contracts to spend LQTY
//       for (const contract of Object.keys(coreContracts)) {
//         const LQTYIncreaseAllowanceTxPromise = lqtyToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: liquityAG })
//         await assertRevert(LQTYIncreaseAllowanceTxPromise)
//       }

//       // Deployer attempts to approve LQTY contracts to spend LQTY (excluding OYLCs)
//       for (const contract of Object.keys(LQTYContracts)) {
//         const LQTYIncreaseAllowanceTxPromise = lqtyToken.increaseAllowance(LQTYContracts[contract].address, dec(1, 18), { from: liquityAG })
//         await assertRevert(LQTYIncreaseAllowanceTxPromise)
//       }
//     })

//     // --- Liquity AG decreaseAllowance restriction, 1st year ---
//     it("LQTY deployer can not decreaseAllowance for any EOA or Liquity contract", async () => {
//       // Deployer attempts to decreaseAllowance on EOAs 
//       const LQTYDecreaseAllowanceTxPromise_1 = lqtyToken.decreaseAllowance(A, dec(1, 18), { from: liquityAG })
//       const LQTYDecreaseAllowanceTxPromise_2 = lqtyToken.decreaseAllowance(B, dec(1, 18), { from: liquityAG })
//       await assertRevert(LQTYDecreaseAllowanceTxPromise_1)
//       await assertRevert(LQTYDecreaseAllowanceTxPromise_2)

//       // Deployer attempts to decrease allowance on Liquity contracts
//       for (const contract of Object.keys(coreContracts)) {
//         const LQTYDecreaseAllowanceTxPromise = lqtyToken.decreaseAllowance(coreContracts[contract].address, dec(1, 18), { from: liquityAG })
//         await assertRevert(LQTYDecreaseAllowanceTxPromise)
//       }

//       // Deployer attempts to decrease allowance on LQTY contracts (excluding OYLCs)
//       for (const contract of Object.keys(LQTYContracts)) {
//         const LQTYDecreaseAllowanceTxPromise = lqtyToken.decreaseAllowance(LQTYContracts[contract].address, dec(1, 18), { from: liquityAG })
//         await assertRevert(LQTYDecreaseAllowanceTxPromise)
//       }
//     })

//     // --- Liquity AG transferFrom restriction, 1st year ---
//     it("LQTY deployer can not be the sender in a transferFrom() call", async () => {
//         // EOAs attempt to use liquityAG as sender in a transferFrom()
//         const LQTYtransferFromTxPromise_1 = lqtyToken.transferFrom(liquityAG, A, dec(1, 18), { from: A })
//         const LQTYtransferFromTxPromise_2 = lqtyToken.transferFrom(liquityAG, C, dec(1, 18), { from: B })
//         await assertRevert(LQTYtransferFromTxPromise_1)
//         await assertRevert(LQTYtransferFromTxPromise_2)
//     })

//     //  --- staking, 1st year ---
//     it("LQTY deployer can not stake their LQTY in the staking contract", async () => {
//       const LQTYStakingTxPromise_1 = lqtyStaking.stake(dec(1, 18), { from: liquityAG })
//       await assertRevert(LQTYStakingTxPromise_1)
//     })
  
//     // --- Anyone else ---

//     it("Anyone (other than Liquity AG) can transfer LQTY to OYLCs deployed by anyone through the Factory", async () => {
//       // Start D, E, F with some LQTY
//       await lqtyToken.unprotectedMint(D, dec(1, 24))
//       await lqtyToken.unprotectedMint(E, dec(2, 24))
//       await lqtyToken.unprotectedMint(F, dec(3, 24))

//       // H, I, J deploy lockup contracts with A, B, C as beneficiaries, respectively
//       const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, dec(1, 24), { from: H })
//       const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(2, 24), { from: I })
//       const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, dec(3, 24), { from: liquityAG })

//       // Grab contract addresses from deployment tx events
//       const OYLCAddress_A = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_A)
//       const OYLCAddress_B = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_B)
//       const OYLCAddress_C = await th.getLCAddressFromDeploymentTx(deployedOYLCtx_C)

//       // Check balances of OYLCs are 0
//       assert.equal(await lqtyToken.balanceOf(OYLCAddress_A), '0')
//       assert.equal(await lqtyToken.balanceOf(OYLCAddress_B), '0')
//       assert.equal(await lqtyToken.balanceOf(OYLCAddress_C), '0')

//       // D, E, F transfer LQTY to OYLCs
//       await lqtyToken.transfer(OYLCAddress_A, dec(1, 24), { from: D })
//       await lqtyToken.transfer(OYLCAddress_B, dec(2, 24), { from: E })
//       await lqtyToken.transfer(OYLCAddress_C, dec(3, 24), { from: F })

//       // Check balances of OYLCs has increased
//       assert.equal(await lqtyToken.balanceOf(OYLCAddress_A), dec(1, 24))
//       assert.equal(await lqtyToken.balanceOf(OYLCAddress_B), dec(2, 24))
//       assert.equal(await lqtyToken.balanceOf(OYLCAddress_C), dec(3, 24))
//     })

//     it("Anyone (other than Liquity AG) can transfer LQTY to OYLCs deployed by anyone directly", async () => {
//       // Start D, E, F with some LQTY
//       await lqtyToken.unprotectedMint(D, dec(1, 24))
//       await lqtyToken.unprotectedMint(E, dec(2, 24))
//       await lqtyToken.unprotectedMint(F, dec(3, 24))

//       // H, I, LiqAG deploy lockup contracts with A, B, C as beneficiaries, respectively
//       const OYLC_A = await OneYearLockupContract.new(lqtyToken.address, A, dec(1, 24), { from: H })
//       const OYLC_B = await OneYearLockupContract.new(lqtyToken.address, B, dec(2, 24), { from: I })
//       const OYLC_C = await OneYearLockupContract.new(lqtyToken.address, C, dec(3, 24), { from: liquityAG })

//       // Check balances of OYLCs are 0
//       assert.equal(await lqtyToken.balanceOf(OYLC_A.address), '0')
//       assert.equal(await lqtyToken.balanceOf(OYLC_B.address), '0')
//       assert.equal(await lqtyToken.balanceOf(OYLC_C.address), '0')

//       // D, E, F transfer LQTY to OYLCs
//       await lqtyToken.transfer(OYLC_A.address, dec(1, 24), { from: D })
//       await lqtyToken.transfer(OYLC_B.address, dec(2, 24), { from: E })
//       await lqtyToken.transfer(OYLC_C.address, dec(3, 24), { from: F })

//       // Check balances of OYLCs has increased
//       assert.equal(await lqtyToken.balanceOf(OYLC_A.address), dec(1, 24))
//       assert.equal(await lqtyToken.balanceOf(OYLC_B.address), dec(2, 24))
//       assert.equal(await lqtyToken.balanceOf(OYLC_C.address), dec(3, 24))
//     })

//     it("Anyone (other than liquity AG) can transfer LQTY to CDLCs deployed by anyone directly", async () => {
//       // Start D, E, F with some LQTY
//       await lqtyToken.unprotectedMint(D, dec(1, 24))
//       await lqtyToken.unprotectedMint(E, dec(2, 24))
//       await lqtyToken.unprotectedMint(F, dec(3, 24))

//       // H, I, J deploy lockup contracts with A, B, C as beneficiaries, respectively
//       const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, dec(1, 24), SECONDS_IN_ONE_MONTH, { from: G })
//       const CDLC_B = await CustomDurationLockupContract.new(lqtyToken.address, B, dec(2, 24), SECONDS_IN_ONE_MONTH, { from: H })
//       const CDLC_C = await CustomDurationLockupContract.new(lqtyToken.address, C, dec(3, 24), SECONDS_IN_ONE_MONTH, { from: I })

//       // Check balances of OYLCs are 0
//       assert.equal(await lqtyToken.balanceOf(CDLC_A.address), '0')
//       assert.equal(await lqtyToken.balanceOf(CDLC_B.address), '0')
//       assert.equal(await lqtyToken.balanceOf(CDLC_C.address), '0')

//       // D, E, F transfer LQTY to CDLCs
//       await lqtyToken.transfer(CDLC_A.address, dec(1, 24), { from: D })
//       await lqtyToken.transfer(CDLC_B.address, dec(2, 24), { from: E })
//       await lqtyToken.transfer(CDLC_C.address, dec(3, 24), { from: F })

//       // Check balances of CDLCs has increased
//       assert.equal(await lqtyToken.balanceOf(CDLC_A.address), dec(1, 24))
//       assert.equal(await lqtyToken.balanceOf(CDLC_B.address), dec(2, 24))
//       assert.equal(await lqtyToken.balanceOf(CDLC_C.address), dec(3, 24))
//     })
    
//     it("Anyone (other than liquity AG) can transfer to an EOA", async () => {
//       // Start D, E, F with some LQTY
//       await lqtyToken.unprotectedMint(D, dec(1, 24))
//       await lqtyToken.unprotectedMint(E, dec(2, 24))
//       await lqtyToken.unprotectedMint(F, dec(3, 24))

//       // LQTY holders transfer to other transfer to EOAs
//       const LQTYtransferTx_1 = await lqtyToken.transfer(A, dec(1, 18), { from: D })
//       const LQTYtransferTx_2 = await lqtyToken.transfer(B, dec(1, 18), { from: E })
//       const LQTYtransferTx_3 = await lqtyToken.transfer(liquityAG, dec(1, 18), { from: F })
     
//       assert.isTrue(LQTYtransferTx_1.receipt.status)
//       assert.isTrue(LQTYtransferTx_2.receipt.status)
//       assert.isTrue(LQTYtransferTx_3.receipt.status)
//     })
 
//      it("Anyone (other than liquity AG) can approve any EOA or to spend their LQTY", async () => {
//       // EOAs approve EOAs to spend LQTY
//       const LQTYapproveTx_1 = await lqtyToken.approve(A, dec(1, 18), { from: F })
//       const LQTYapproveTx_2 = await lqtyToken.approve(B, dec(1, 18), { from: G })
//       await assert.isTrue(LQTYapproveTx_1.receipt.status)
//       await assert.isTrue(LQTYapproveTx_2.receipt.status) 
//     })

//     it("Anyone (other than liquity AG) can increaseAllowance for any EOA or Liquity contract", async () => {
//       // Anyone can increaseAllowance of EOAs to spend LQTY
//       const LQTYIncreaseAllowanceTx_1 = await lqtyToken.increaseAllowance(A, dec(1, 18), { from: F })
//       const LQTYIncreaseAllowanceTx_2 = await lqtyToken.increaseAllowance(B, dec(1, 18), { from: G })
//       await assert.isTrue(LQTYIncreaseAllowanceTx_1.receipt.status)
//       await assert.isTrue(LQTYIncreaseAllowanceTx_2.receipt.status)

//       // Increase allowance of core Liquity contracts
//       for (const contract of Object.keys(coreContracts)) {
//         const LQTYIncreaseAllowanceTx = await lqtyToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: F })
//         await assert.isTrue(LQTYIncreaseAllowanceTx.receipt.status)
//       }

//       // Increase allowance of LQTY contracts
//       for (const contract of Object.keys(LQTYContracts)) {
//         const LQTYIncreaseAllowanceTx = await lqtyToken.increaseAllowance(LQTYContracts[contract].address, dec(1, 18), { from: F })
//         await assert.isTrue(LQTYIncreaseAllowanceTx.receipt.status)
//       }
//     })

//     it("Anyone (other than liquity AG) can decreaseAllowance for any EOA or Liquity contract", async () => {
//       //First, increase allowance of A, B and coreContracts and LQTY contracts
//      const LQTYIncreaseAllowanceTx_1 = await lqtyToken.increaseAllowance(A, dec(1, 18), { from: F })
//      const LQTYIncreaseAllowanceTx_2 = await lqtyToken.increaseAllowance(B, dec(1, 18), { from: G })
//      await assert.isTrue(LQTYIncreaseAllowanceTx_1.receipt.status)
//      await assert.isTrue(LQTYIncreaseAllowanceTx_2.receipt.status)

//      for (const contract of Object.keys(coreContracts)) {
//        const LQTYtransferTx = await lqtyToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: F })
//        await assert.isTrue(LQTYtransferTx.receipt.status)
//      }

//      for (const contract of Object.keys(LQTYContracts)) {
//       const LQTYtransferTx = await lqtyToken.increaseAllowance(LQTYContracts[contract].address, dec(1, 18), { from: F })
//       await assert.isTrue(LQTYtransferTx.receipt.status)
//     }

//      // Decrease allowance of A, B
//      const LQTYDecreaseAllowanceTx_1 = await lqtyToken.decreaseAllowance(A, dec(1, 18), { from: F })
//      const LQTYDecreaseAllowanceTx_2 = await lqtyToken.decreaseAllowance(B, dec(1, 18), { from: G })
//      await assert.isTrue(LQTYDecreaseAllowanceTx_1.receipt.status)
//      await assert.isTrue(LQTYDecreaseAllowanceTx_2.receipt.status)

//      // Decrease allowance of core contracts
//      for (const contract of Object.keys(coreContracts)) {
//        const LQTYDecreaseAllowanceTx = await lqtyToken.decreaseAllowance(coreContracts[contract].address, dec(1, 18), { from: F })
//        await assert.isTrue(LQTYDecreaseAllowanceTx.receipt.status)
//      }

//       // Decrease allowance of LQTY contracts
//      for (const contract of Object.keys(LQTYContracts)) {
//       const LQTYDecreaseAllowanceTx = await lqtyToken.decreaseAllowance(LQTYContracts[contract].address, dec(1, 18), { from: F })
//       await assert.isTrue(LQTYDecreaseAllowanceTx.receipt.status)
//     }
//     })

//     it("Anyone (other than liquity AG) can be the sender in a transferFrom() call", async () => {
//         // Fund A, B
//         await lqtyToken.unprotectedMint(A, dec(1, 18))
//         await lqtyToken.unprotectedMint(B, dec(1, 18))

//         // A, B approve F, G
//         await lqtyToken.approve(F, dec(1, 18), { from: A })
//         await lqtyToken.approve(G, dec(1, 18), { from: B })

//         const LQTYtransferFromTx_1 = await lqtyToken.transferFrom(A, F, dec(1, 18), { from: F})
//         const LQTYtransferFromTx_2 = await lqtyToken.transferFrom(B, C, dec(1, 18), { from: G })
//         await assert.isTrue(LQTYtransferFromTx_1.receipt.status)
//         await assert.isTrue(LQTYtransferFromTx_2.receipt.status)
//     })

//     it("Anyone (other than liquity AG) can stake their LQTY in the staking contract", async () => {
//       // Fund F
//       await lqtyToken.unprotectedMint(F, dec(1, 18))

//       const LQTYStakingTx_1 = await lqtyStaking.stake(dec(1, 18), { from: F })
//       await  assert.isTrue(LQTYStakingTx_1.receipt.status)
//     })

//   })
//   // --- LCF ---

//   describe('Lockup Contract Factory negative tests', async accounts => {
//     it("deployOneYearLockupContract(): reverts when LQTY token address is not set", async () => {
//       // Fund F
//       await lqtyToken.unprotectedMint(F, dec(20, 24))

//       // deploy new LCF
//       const LCFNew = await LockupContractFactory.new()

//       // Check LQTYToken address not registered
//       const registeredLQTYTokenAddr = await LCFNew.lqtyToken()
//       assert.equal(registeredLQTYTokenAddr, ZERO_ADDRESS)

//       const tx = LCFNew.deployOneYearLockupContract(A, dec(1, 18), { from: F })
//       await assertRevert(tx)
//     })

//     it("deployCustomDurationLockupContract(): reverts when LQTY token address is not set", async () => {
//       // Fund F
//       await lqtyToken.unprotectedMint(F, dec(20, 24))

//       // deploy new LCF
//       const LCFNew = await LockupContractFactory.new()

//       // Check LQTYToken address not registered
//       const registeredLQTYTokenAddr = await LCFNew.lqtyToken()
//       assert.equal(registeredLQTYTokenAddr, ZERO_ADDRESS)

//       const tx = LCFNew.deployCustomDurationLockupContract(A, dec(1, 18), SECONDS_IN_ONE_MONTH, { from: F })
//       await assertRevert(tx)
//     })

//     // Reverts when lockOYLCs called on non-OYLCs
//     it("lockOneYearContracts(): reverts when address list contains an invalid OYLC", async () => {
//       // Fund F
//       await lqtyToken.unprotectedMint(F, dec(20, 24))

//       // F deploys 3 OYLCs through the factory
//       // LQTY deployer deploys OYLCs
//       const OYLCDeploymentTx_A = await lockupContractFactory.deployOneYearLockupContract(A, dec(1, 18), { from: F })
//       const OYLCDeploymentTx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(1, 19), { from: F })
//       const OYLCDeploymentTx_C = await lockupContractFactory.deployOneYearLockupContract(C, dec(1, 20), { from: F })

//       const directOYLC_D = await OneYearLockupContract.new(lqtyToken.address, D, dec(1, 21), { from: F })

//       const OYLC_A = await th.getOYLCFromDeploymentTx(OYLCDeploymentTx_A)
//       const OYLC_B = await th.getOYLCFromDeploymentTx(OYLCDeploymentTx_B)
//       const OYLC_C = await th.getOYLCFromDeploymentTx(OYLCDeploymentTx_C)

//       // Transfer OYLC entitlements
//       await lqtyToken.transfer(OYLC_A.address, dec(1, 18), {from: F})
//       await lqtyToken.transfer(OYLC_B.address, dec(1, 19),  {from: F})
//       await lqtyToken.transfer(OYLC_C.address, dec(1, 20),  {from: F})
//       await lqtyToken.transfer(directOYLC_D.address, dec(1, 21),  {from: F})

//       const factoryOYLCs = [OYLC_A.address, OYLC_B.address, OYLC_C.address]
//       const factoryOYLCsPlusInvalidOYLC = [OYLC_A.address, OYLC_B.address, OYLC_C.address, directOYLC_D.address]
//       const factoryOYLCsPlusEOA = [OYLC_A.address, OYLC_B.address, E, OYLC_C.address]


//       // Check address lists with invalid OYLC addresses revert
//       const txInvalidOYLC = lockupContractFactory.lockOneYearContracts(factoryOYLCsPlusInvalidOYLC, { from: F })
//       await assertRevert(txInvalidOYLC)

//       const txEOA = lockupContractFactory.lockOneYearContracts(factoryOYLCsPlusEOA, { from: F })
//       await assertRevert(txEOA)

//       const txFactoryOYLCs = await lockupContractFactory.lockOneYearContracts(factoryOYLCs, { from: F })
//       assert.isTrue(txFactoryOYLCs.receipt.status)
//     })

//     // Reverts when lockCDLCs called on non-CDLCs
//     it("lockOneYearContracts(): reverts when address list contains an invalid OYLC", async () => {
//       await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider )
//       // Fund F
//       await lqtyToken.unprotectedMint(F, dec(20, 24))

//       // F deploys 3 OYLCs through the factory
//       // LQTY deployer deploys OYLCs
//       const CDLCDeploymentTx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, dec(1, 18), SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLCDeploymentTx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, dec(1, 19), SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLCDeploymentTx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, dec(1, 20), SECONDS_IN_ONE_MONTH, { from: F })

//       const directCDLC_D = await OneYearLockupContract.new(lqtyToken.address, D, dec(1, 18), { from: F })

//       const CDLC_A = await th.getCDLCFromDeploymentTx(CDLCDeploymentTx_A)
//       const CDLC_B = await th.getCDLCFromDeploymentTx(CDLCDeploymentTx_B)
//       const CDLC_C = await th.getCDLCFromDeploymentTx(CDLCDeploymentTx_C)
      
//       // Transfer OYLC entitlements
//       await lqtyToken.transfer(CDLC_A.address, dec(1, 18), {from: F})
//       await lqtyToken.transfer(CDLC_B.address, dec(1, 19),  {from: F})
//       await lqtyToken.transfer(CDLC_C.address, dec(1, 20),  {from: F})
//       await lqtyToken.transfer(directCDLC_D.address, dec(1, 21),  {from: F})

//       const factoryCDLCs = [CDLC_A.address, CDLC_B.address, CDLC_C.address]
//       const factoryCDLCsPlusInvalidCDLC = [CDLC_A.address, CDLC_B.address, CDLC_C.address, directCDLC_D.address]
//       const factoryCDLCsPlusEOA = [CDLC_A.address, CDLC_B.address, E, CDLC_C.address]

//       const txInvalidCDLC = lockupContractFactory.lockCustomDurationContracts(factoryCDLCsPlusInvalidCDLC, { from: F })
//       await assertRevert(txInvalidCDLC)

//       const txEOA = lockupContractFactory.lockCustomDurationContracts(factoryCDLCsPlusEOA, { from: F })
//       await assertRevert(txEOA)

//       const txFactoryCDLCs = await lockupContractFactory.lockCustomDurationContracts(factoryCDLCs, { from: F })
//       assert.isTrue(txFactoryCDLCs.receipt.status)
//     })

//     //TODO
//     // Reverts when lockCDLCs called on a CDLC they did not deploy

//   })
//   //TODO:
//   // --- OYLCs ---
//   describe('Transferring LQTY to active OYLCs', async accounts => {
//     it("LQTY deployer can transfer LQTY (vesting) to one-year lockup contracts they deployed", async () => {
//       const initialLQTYBalanceOfOYLC_T1 = await lqtyToken.balanceOf(OYLC_T1.address)
//       const initialLQTYBalanceOfOYLC_T2 = await lqtyToken.balanceOf(OYLC_T2.address)
//       const initialLQTYBalanceOfOYLC_T3 = await lqtyToken.balanceOf(OYLC_T3.address)

//       // Check initial OYLC balances == entitlements
//       assert.equal(initialLQTYBalanceOfOYLC_T1, teamMemberInitialEntitlement_1)
//       assert.equal(initialLQTYBalanceOfOYLC_T2, teamMemberInitialEntitlement_2)
//       assert.equal(initialLQTYBalanceOfOYLC_T3, teamMemberInitialEntitlement_3)

//       // One month passes
//       await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

//       // LQTY deployer transfers vesting amount
//       await lqtyToken.transfer(OYLC_T1.address, dec(1, 24), { from: liquityAG })
//       await lqtyToken.transfer(OYLC_T2.address, dec(1, 24), { from: liquityAG })
//       await lqtyToken.transfer(OYLC_T3.address, dec(1, 24), { from: liquityAG })

//       // Get new OYLC LQTY balances
//       const LQTYBalanceOfOYLC_T1_1 = await lqtyToken.balanceOf(OYLC_T1.address)
//       const LQTYBalanceOfOYLC_T2_1 = await lqtyToken.balanceOf(OYLC_T2.address)
//       const LQTYBalanceOfOYLC_T3_1 = await lqtyToken.balanceOf(OYLC_T3.address)

//       // // Check team member OYLC balances have increased 
//       assert.isTrue(LQTYBalanceOfOYLC_T1_1.eq(th.toBN(initialLQTYBalanceOfOYLC_T1).add(th.toBN(dec(1, 24)))))
//       assert.isTrue(LQTYBalanceOfOYLC_T2_1.eq(th.toBN(initialLQTYBalanceOfOYLC_T2).add(th.toBN(dec(1, 24)))))
//       assert.isTrue(LQTYBalanceOfOYLC_T3_1.eq(th.toBN(initialLQTYBalanceOfOYLC_T3).add(th.toBN(dec(1, 24)))))

//       // Another month passes
//       await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

//       // LQTY deployer transfers vesting amount
//       await lqtyToken.transfer(OYLC_T1.address, dec(1, 24), { from: liquityAG })
//       await lqtyToken.transfer(OYLC_T2.address, dec(1, 24), { from: liquityAG })
//       await lqtyToken.transfer(OYLC_T3.address, dec(1, 24), { from: liquityAG })

//       // Get new OYLC LQTY balances
//       const LQTYBalanceOfOYLC_T1_2 = await lqtyToken.balanceOf(OYLC_T1.address)
//       const LQTYBalanceOfOYLC_T2_2 = await lqtyToken.balanceOf(OYLC_T2.address)
//       const LQTYBalanceOfOYLC_T3_2 = await lqtyToken.balanceOf(OYLC_T3.address)

//       // Check team member OYLC balances have increased again
//       assert.isTrue(LQTYBalanceOfOYLC_T1_2.eq(LQTYBalanceOfOYLC_T1_1.add(th.toBN(dec(1, 24)))))
//       assert.isTrue(LQTYBalanceOfOYLC_T2_2.eq(LQTYBalanceOfOYLC_T2_1.add(th.toBN(dec(1, 24)))))
//       assert.isTrue(LQTYBalanceOfOYLC_T3_2.eq(LQTYBalanceOfOYLC_T3_1.add(th.toBN(dec(1, 24)))))
//     })

//     it("LQTY deployer can transfer LQTY to one-year lockup contracts deployed by anyone", async () => {
//       // A, B, C each deploy a lockup contract ith themself as beneficiary
//       const deployedOYLCtx_A = await lockupContractFactory.deployOneYearLockupContract(A, dec(1, 24), { from: A })
//       const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(2, 24), { from: B })
//       const deployedOYLCtx_C = await lockupContractFactory.deployOneYearLockupContract(C, dec(3, 24), { from: C })

//       // OYLCs for team members on vesting schedules
//       const OYLC_A = await th.getOYLCFromDeploymentTx(deployedOYLCtx_A)
//       const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)
//       const OYLC_C = await th.getOYLCFromDeploymentTx(deployedOYLCtx_C)

//       // Check balances of OYLCs are 0
//       assert.equal(await lqtyToken.balanceOf(OYLC_A.address), '0')
//       assert.equal(await lqtyToken.balanceOf(OYLC_B.address), '0')
//       assert.equal(await lqtyToken.balanceOf(OYLC_C.address), '0')

//       // One month passes
//       await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

//       // LQTY deployer transfers LQTY to OYLCs deployed by other accounts
//       await lqtyToken.transfer(OYLC_A.address, dec(1, 24), { from: liquityAG })
//       await lqtyToken.transfer(OYLC_B.address, dec(2, 24), { from: liquityAG })
//       await lqtyToken.transfer(OYLC_C.address, dec(3, 24), { from: liquityAG })

//       // Check balances of OYLCs have increased
//       assert.equal(await lqtyToken.balanceOf(OYLC_A.address), dec(1, 24))
//       assert.equal(await lqtyToken.balanceOf(OYLC_B.address), dec(2, 24))
//       assert.equal(await lqtyToken.balanceOf(OYLC_C.address), dec(3, 24))
//     })
//   })

//   describe('Deploying new OYLCs', async accounts => {
//     it("LQTY Deployer can deploy OYLCs through the Factory", async () => {
//       // LQTY deployer deploys OYLCs
//       const OYLCDeploymentTx_A = await lockupContractFactory.deployOneYearLockupContract(A, dec(1, 18), { from: liquityAG })
//       const OYLCDeploymentTx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(1, 18), { from: liquityAG })
//       const OYLCDeploymentTx_C = await lockupContractFactory.deployOneYearLockupContract(C, '9595995999999900000023423234', { from: liquityAG })

//       assert.isTrue(OYLCDeploymentTx_A.receipt.status)
//       assert.isTrue(OYLCDeploymentTx_B.receipt.status)
//       assert.isTrue(OYLCDeploymentTx_C.receipt.status)
//     })

//     it("Anyone can deploy OYLCs through the Factory", async () => {
//       // Various EOAs deploy CDLCs
//       const OYLCDeploymentTx_1 = await lockupContractFactory.deployOneYearLockupContract(A, dec(1, 18), { from: teamMember_1 })
//       const OYLCDeploymentTx_2 = await lockupContractFactory.deployOneYearLockupContract(C, dec(1, 18), { from: investor_2 })
//       const OYLCDeploymentTx_3 = await lockupContractFactory.deployOneYearLockupContract(liquityAG, '9595995999999900000023423234', { from: A })
//       const OYLCDeploymentTx_4 = await lockupContractFactory.deployOneYearLockupContract(D, '123', { from: B })

//       assert.isTrue(OYLCDeploymentTx_1.receipt.status)
//       assert.isTrue(OYLCDeploymentTx_2.receipt.status)
//       assert.isTrue(OYLCDeploymentTx_3.receipt.status)
//       assert.isTrue(OYLCDeploymentTx_4.receipt.status)
//     })

//     it("LQTY Deployer can deploy OYLCs directly", async () => {
//       // LQTY deployer deploys CDLCs
//       const OYLC_A = await OneYearLockupContract.new(lqtyToken.address, A, dec(1, 18), { from: liquityAG })
//       const OYLC_A_txReceipt = await web3.eth.getTransactionReceipt(OYLC_A.transactionHash)

//       const OYLC_B = await OneYearLockupContract.new(lqtyToken.address, B, dec(2, 18), { from: liquityAG })
//       const OYLC_B_txReceipt = await web3.eth.getTransactionReceipt(OYLC_B.transactionHash)

//       const OYLC_C = await OneYearLockupContract.new(lqtyToken.address, C, dec(3, 18), { from: liquityAG })
//       const OYLC_C_txReceipt = await web3.eth.getTransactionReceipt(OYLC_C.transactionHash)

//       // Check deployment succeeded
//       assert.isTrue(OYLC_A_txReceipt.status)
//       assert.isTrue(OYLC_B_txReceipt.status)
//       assert.isTrue(OYLC_C_txReceipt.status)
//     })

//     it("Anyone can deploy OYLCs directly", async () => {
//       // Various EOAs deploy OYLCs
//       const OYLC_A = await OneYearLockupContract.new(lqtyToken.address, A, dec(1, 18), { from: D })
//       const OYLC_A_txReceipt = await web3.eth.getTransactionReceipt(OYLC_A.transactionHash)

//       const OYLC_B = await OneYearLockupContract.new(lqtyToken.address, B, dec(2, 18), { from: E })
//       const OYLC_B_txReceipt = await web3.eth.getTransactionReceipt(OYLC_B.transactionHash)

//       const OYLC_C = await OneYearLockupContract.new(lqtyToken.address, C, dec(3, 18), { from: F })
//       const OYLC_C_txReceipt = await web3.eth.getTransactionReceipt(OYLC_C.transactionHash)

//       // Check deployment succeeded
//       assert.isTrue(OYLC_A_txReceipt.status)
//       assert.isTrue(OYLC_B_txReceipt.status)
//       assert.isTrue(OYLC_C_txReceipt.status)
//     })
//   })

//   describe('Withdrawal Attempts on active OYLCs before lockup period has passed', async accounts => {
//     it("LQTY Deployer can't withdraw from a locked and funded OYLC they deployed through the Factory", async () => {

//       // LQTY deployer attempts withdrawal from OYLC they deployed through the Factory
//       try {
//         const withdrawalAttempt = await OYLC_T1.withdrawLQTY({ from: liquityAG })
//         assert.isFalse(withdrawalAttempt.receipt.status)
//       } catch (error) {
//         assert.include(error.message, "revert")
//       }
//     })

//     it("LQTY Deployer can't withdraw from a locked and funded OYLC that someone else deployed", async () => {
//       // Account D deploys a new OYLC via the Factory
//       const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(2, 18), { from: D })
//       const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)

//       //LQTY deployer fund the newly deployed OYLCs
//       await lqtyToken.transfer(OYLC_B.address, dec(2, 18), { from: liquityAG })

//       // D locks their deployed OYLC
//       await lockupContractFactory.lockOneYearContracts([OYLC_B.address], { from: D })

//       // LQTY deployer attempts withdrawal from OYLCs
//       try {
//         const withdrawalAttempt_B = await OYLC_B.withdrawLQTY({ from: liquityAG })
//         assert.isFalse(withdrawalAttempt_B.receipt.status)
//       } catch (error) {
//         assert.include(error.message, "revert")
//       }
//     })

//     it("Beneficiary can't withdraw from their funded and locked OYLC", async () => {
//       // Account D deploys a new OYLC via the Factory
//       const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(2, 18), { from: D })
//       const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)

//       // LQTY deployer funds contracts
//       await lqtyToken.transfer(OYLC_B.address, dec(2, 18), { from: liquityAG })

//       // D locks their deployed OYLC
//       await lockupContractFactory.lockOneYearContracts([OYLC_B.address], { from: D })

//       /* Beneficiaries of all OYLCS - team, investor, and newly created OYLCs - 
//       attempt to withdraw from their respective funded and locked contracts */
//       const OYLCs = [
//         OYLC_T1,
//         OYLC_T2,
//         OYLC_T3,
//         OYLC_I1,
//         OYLC_I2,
//         OYLC_T3,
//         OYLC_B
//       ]

//       for (OYLC of OYLCs) {
//         try {
//           const beneficiary = await OYLC.beneficiary()
//           const withdrawalAttempt = await OYLC.withdrawLQTY({ from: beneficiary })
//           assert.isFalse(withdrawalAttempt.receipt.status)
//         } catch (error) {
//           assert.include(error.message, "revert")
//         }
//       }
//     })

//     it("No one can withdraw from a funded and locked OYLC", async () => {
//       // Account D deploys a new OYLC via the Factory
//       const deployedOYLCtx_B = await lockupContractFactory.deployOneYearLockupContract(B, dec(2, 18), { from: D })
//       const OYLC_B = await th.getOYLCFromDeploymentTx(deployedOYLCtx_B)

//       // LQTY deployer funds contracts
//       await lqtyToken.transfer(OYLC_B.address, dec(2, 18), { from: liquityAG })

//       // D locks their deployed OYLC
//       await lockupContractFactory.lockOneYearContracts([OYLC_B.address], { from: D })


//       const variousEOAs = [teamMember_1, liquityAG, investor_1, A, B, C, D, E]

//       // Several EOAs attempt to withdraw from OYLC deployed by D
//       for (account of variousEOAs) {
//         try {
//           const withdrawalAttempt = await OYLC_B.withdrawLQTY({ from: account })
//           assert.isFalse(withdrawalAttempt.receipt.status)
//         } catch (error) {
//           assert.include(error.message, "revert")
//         }
//       }

//       // Several EOAs attempt to withdraw from OYLC_T1 deployed by LQTY deployer
//       for (account of variousEOAs) {
//         try {
//           const withdrawalAttempt = await OYLC_T1.withdrawLQTY({ from: account })
//           assert.isFalse(withdrawalAttempt.receipt.status)
//         } catch (error) {
//           assert.include(error.message, "revert")
//         }
//       }
//     })
//   })

//   // --- CDLCs ---

//   describe('Deploying new CDLCs', async accounts => {
//     it("No one can deploy CDLCs through the factory before one year has passed", async () => {
//       try {
//         const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, dec(1, 18), SECONDS_IN_ONE_MONTH, { from: liquityAG })
//         assert.isFalse(deployedCDLCtx_A.receipt.status)
//       } catch (error) {
//         assert.include(error.message, "revert")
//       }

//       try {
//         const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, dec(2, 18), SECONDS_IN_ONE_MONTH, { from: B })
//         assert.isFalse(deployedCDLCtx_B.receipt.status)
//       } catch (error) {
//         assert.include(error.message, "revert")
//       }

//       try {
//         const deployedCDLCtx_C = await lockupContractFactory.deployCustomDurationLockupContract(C, dec(3, 18), SECONDS_IN_ONE_MONTH, { from: F })
//         assert.isFalse(deployedCDLCtx_C.receipt.status)
//       } catch (error) {
//         assert.include(error.message, "revert")
//       }
//     })

//     it("Anyone can deploy CDLCs directly", async () => {
//       // Various EOAs deploy CDLCs
//       const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, dec(1, 18), SECONDS_IN_ONE_MONTH, { from: D })
//       const CDLC_A_txReceipt = await web3.eth.getTransactionReceipt(CDLC_A.transactionHash)

//       const CDLC_B = await CustomDurationLockupContract.new(lqtyToken.address, B, dec(2, 18), SECONDS_IN_ONE_MONTH, { from: liquityAG })
//       const CDLC_B_txReceipt = await web3.eth.getTransactionReceipt(CDLC_B.transactionHash)

//       const CDLC_C = await CustomDurationLockupContract.new(lqtyToken.address, C, dec(3, 18), SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLC_C_txReceipt = await web3.eth.getTransactionReceipt(CDLC_C.transactionHash)

//       // Check deployment succeeded
//       assert.isTrue(CDLC_A_txReceipt.status)
//       assert.isTrue(CDLC_B_txReceipt.status)
//       assert.isTrue(CDLC_C_txReceipt.status)
//     })
//   })

//   describe('Funding CDLCs', async accounts => {
//     it("LQTY transfer from deployer to their deployed CDLC increases the LQTY balance of the CDLC", async () => {
//       // Fund A, C, E
//       await lqtyToken.unprotectedMint(A, dec(1, 24))
//       await lqtyToken.unprotectedMint(C, dec(2, 24))
//       await lqtyToken.unprotectedMint(E, dec(3, 24))

//       // Deploy3 CDLCs
//       const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, LQTYEntitlement_A, SECONDS_IN_ONE_MONTH, { from: A })
//       const CDLC_B = await CustomDurationLockupContract.new(lqtyToken.address, B, LQTYEntitlement_B, SECONDS_IN_ONE_MONTH, { from: C })
//       const CDLC_C = await CustomDurationLockupContract.new(lqtyToken.address, C, LQTYEntitlement_C, SECONDS_IN_ONE_MONTH, { from: E })

//       // Grab contract addresses
//       const CDLCAddress_A = CDLC_A.address
//       const CDLCAddress_B = CDLC_B.address
//       const CDLCAddress_C = CDLC_C.address

//       assert.equal(await lqtyToken.balanceOf(CDLCAddress_A), '0')
//       assert.equal(await lqtyToken.balanceOf(CDLCAddress_B), '0')
//       assert.equal(await lqtyToken.balanceOf(CDLCAddress_C), '0')

//       // deployer transfers LQTY to the CDLC they deployed
//       await lqtyToken.transfer(CDLCAddress_A, LQTYEntitlement_A, { from: A })
//       await lqtyToken.transfer(CDLCAddress_B, LQTYEntitlement_B, { from: C })
//       await lqtyToken.transfer(CDLCAddress_C, LQTYEntitlement_C, { from: E })

//       assert.equal(await lqtyToken.balanceOf(CDLCAddress_A), LQTYEntitlement_A)
//       assert.equal(await lqtyToken.balanceOf(CDLCAddress_B), LQTYEntitlement_B)
//       assert.equal(await lqtyToken.balanceOf(CDLCAddress_C), LQTYEntitlement_C)
//     })

//     it("Anyone (other than Liquity AG) can transfer LQTY to CDLCs deployed by anyone", async () => {
//       // Fund F
//       await lqtyToken.unprotectedMint(F, dec(10, 24))

//       // Deploy 5 CDLCs
//       const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, LQTYEntitlement_A, SECONDS_IN_ONE_MONTH, { from: G })
//       const CDLC_B = await CustomDurationLockupContract.new(lqtyToken.address, B, LQTYEntitlement_B, SECONDS_IN_ONE_MONTH, { from: H })
//       const CDLC_C = await CustomDurationLockupContract.new(lqtyToken.address, C, LQTYEntitlement_C, SECONDS_IN_ONE_MONTH, { from: I })

//       // Grab contract addresses
//       const CDLCAddress_A = CDLC_A.address
//       const CDLCAddress_B = CDLC_B.address
//       const CDLCAddress_C = CDLC_C.address

//       assert.equal(await lqtyToken.balanceOf(CDLCAddress_A), '0')
//       assert.equal(await lqtyToken.balanceOf(CDLCAddress_B), '0')
//       assert.equal(await lqtyToken.balanceOf(CDLCAddress_C), '0')

//       // F transfers LQTY to each CDLC
//       await lqtyToken.transfer(CDLCAddress_A, dec(1, 18), { from: F })
//       await lqtyToken.transfer(CDLCAddress_B, dec(2, 18), { from: F })
//       await lqtyToken.transfer(CDLCAddress_C, dec(3, 18), { from: F })

//       assert.equal(await lqtyToken.balanceOf(CDLCAddress_A), dec(1, 18))
//       assert.equal(await lqtyToken.balanceOf(CDLCAddress_B), dec(2, 18))
//       assert.equal(await lqtyToken.balanceOf(CDLCAddress_C), dec(3, 18))
//     })
//   })

//   describe('Withdrawal attempts on funded, inactive CDLCs', async accounts => {
//     it("Beneficiary can't withdraw from their funded inactive CDLC", async () => {
//       // Fund F
//       await lqtyToken.unprotectedMint(F, dec(10, 24))

//       // Deploy 3 CDLCs
//       const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, LQTYEntitlement_A, SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLC_B = await CustomDurationLockupContract.new(lqtyToken.address, B, LQTYEntitlement_B, SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLC_C = await CustomDurationLockupContract.new(lqtyToken.address, C, LQTYEntitlement_C, SECONDS_IN_ONE_MONTH, { from: F })

//       // Deployer transfers LQTY to each CDLC
//       await lqtyToken.transfer(CDLC_A.address, LQTYEntitlement_A, { from: F })
//       await lqtyToken.transfer(CDLC_B.address, LQTYEntitlement_B, { from: F })
//       await lqtyToken.transfer(CDLC_C.address, LQTYEntitlement_C, { from: F })

//       assert.equal(await lqtyToken.balanceOf(CDLC_A.address), LQTYEntitlement_A)
//       assert.equal(await lqtyToken.balanceOf(CDLC_B.address), LQTYEntitlement_B)
//       assert.equal(await lqtyToken.balanceOf(CDLC_C.address), LQTYEntitlement_C)

//       assert.isFalse(await CDLC_A.active())
//       assert.isFalse(await CDLC_B.active())
//       assert.isFalse(await CDLC_C.active())

//       const CDLCs = [CDLC_A, CDLC_B, CDLC_C]

//       // Beneficiary attempts to withdraw
//       for (CDLC of CDLCs) {
//         try {
//           const beneficiary = await CDLC.beneficiary()
//           const withdrawalAttemptTx = await CDLC.withdrawLQTY({ from: beneficiary })
//           assert.isFalse(withdrawalAttemptTx.receipt.status)
//         } catch (error) {
//           assert.include(error.message, "revert")
//         }
//       }
//     })

//     it("LQTY deployer can't withraw from an inactive CDLC they funded", async () => {
//       // Fund F
//       await lqtyToken.unprotectedMint(F, dec(10, 24))

//       // Deploy 3 CDLCs
//       const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, LQTYEntitlement_A, SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLC_B = await CustomDurationLockupContract.new(lqtyToken.address, B, LQTYEntitlement_B, SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLC_C = await CustomDurationLockupContract.new(lqtyToken.address, C, LQTYEntitlement_C, SECONDS_IN_ONE_MONTH, { from: F })

//       // LiquityAG transfers LQTY to each CDLC
//       await lqtyToken.transfer(CDLC_A.address, LQTYEntitlement_A, { from: F })
//       await lqtyToken.transfer(CDLC_B.address, LQTYEntitlement_B, { from: F })
//       await lqtyToken.transfer(CDLC_C.address, LQTYEntitlement_C, { from: F })

//       assert.equal(await lqtyToken.balanceOf(CDLC_A.address), LQTYEntitlement_A)
//       assert.equal(await lqtyToken.balanceOf(CDLC_B.address), LQTYEntitlement_B)
//       assert.equal(await lqtyToken.balanceOf(CDLC_C.address), LQTYEntitlement_C)

//       assert.isFalse(await CDLC_A.active())
//       assert.isFalse(await CDLC_B.active())
//       assert.isFalse(await CDLC_C.active())

//       const CDLCs = [CDLC_A, CDLC_B, CDLC_C]

//       // deployer attempts to withdraw from CDLCs
//       for (CDLC of CDLCs) {
//         try {
//           const withdrawalAttemptTx = await CDLC.withdrawLQTY({ from: liquityAG })
//           assert.isFalse(withdrawalAttemptTx.receipt.status)
//         } catch (error) {
//           assert.include(error.message, "revert")
//         }
//       }
//     })

//     it("No one can withraw from an inactive CDLC", async () => {
//       // Fund F
//       await lqtyToken.unprotectedMint(F, dec(10, 24))

//       // Deploy 1 CDLC
//       const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, LQTYEntitlement_A, SECONDS_IN_ONE_MONTH, { from: F })

//       // LiquityAG transfers LQTY to the CDLC
//       await lqtyToken.transfer(CDLC_A.address, LQTYEntitlement_A, { from: F })

//       assert.equal(await lqtyToken.balanceOf(CDLC_A.address), LQTYEntitlement_A)

//       assert.isFalse(await CDLC_A.active())

//       // Various EOAs attempt to withdraw from CDLC
//       try {
//         const withdrawalAttemptTx = await CDLC_A.withdrawLQTY({ from: G })
//         assert.isFalse(withdrawalAttemptTx.receipt.status)
//       } catch (error) {
//         assert.include(error.message, "revert")
//       }

//       try {
//         const withdrawalAttemptTx = await CDLC_A.withdrawLQTY({ from: H })
//         assert.isFalse(withdrawalAttemptTx.receipt.status)
//       } catch (error) {
//         assert.include(error.message, "revert")
//       }

//       try {
//         const withdrawalAttemptTx = await CDLC_A.withdrawLQTY({ from: I })
//         assert.isFalse(withdrawalAttemptTx.receipt.status)
//       } catch (error) {
//         assert.include(error.message, "revert")
//       }
//     })
//   })

//   describe('Locking CDLCs', async accounts => {
//     it("deployer can directly lock all the CDLCs that they deployed", async () => {
//       // Fund F
//       await lqtyToken.unprotectedMint(F, dec(20, 24))

//       // Deploy 3 CDLC
//       const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, LQTYEntitlement_A, SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLC_B = await CustomDurationLockupContract.new(lqtyToken.address, B, LQTYEntitlement_B, SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLC_C = await CustomDurationLockupContract.new(lqtyToken.address, C, LQTYEntitlement_C, SECONDS_IN_ONE_MONTH, { from: F })

//       // Deployer transfers LQTY to each CDLC
//       await lqtyToken.transfer(CDLC_A.address, LQTYEntitlement_A, { from: F })
//       await lqtyToken.transfer(CDLC_B.address, LQTYEntitlement_B, { from: F })
//       await lqtyToken.transfer(CDLC_C.address, LQTYEntitlement_C, { from: F })

//       // Check CDLCs are inactive
//       assert.isFalse(await CDLC_A.active())
//       assert.isFalse(await CDLC_B.active())
//       assert.isFalse(await CDLC_C.active())

//       // LQTY deployer locks the CDLCs they deployed
//       await CDLC_A.lockContract({ from: F })
//       await CDLC_B.lockContract({ from: F })
//       await CDLC_C.lockContract({ from: F })

//       // Check CDLCs are now active (locked)
//       assert.isTrue(await CDLC_A.active())
//       assert.isTrue(await CDLC_B.active())
//       assert.isTrue(await CDLC_C.active())
//     })

//     it("Records the lockup start time on the CDLC", async () => {
//       // Fund F
//       await lqtyToken.unprotectedMint(F, dec(20, 24))

//       // Deploy 3 CDLC
//       const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, LQTYEntitlement_A, SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLC_B = await CustomDurationLockupContract.new(lqtyToken.address, B, LQTYEntitlement_B, SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLC_C = await CustomDurationLockupContract.new(lqtyToken.address, C, LQTYEntitlement_C, SECONDS_IN_ONE_MONTH, { from: F })

//       // LiquityAG transfers LQTY to each CDLC
//       await lqtyToken.transfer(CDLC_A.address, LQTYEntitlement_A, { from: F })
//       await lqtyToken.transfer(CDLC_B.address, LQTYEntitlement_B, { from: F })
//       await lqtyToken.transfer(CDLC_C.address, LQTYEntitlement_C, { from: F })

//       // LQTY deployer locks the CDLCs they deployed

//       const txLockA = await CDLC_A.lockContract({ from: F })
//       const txLockB = await CDLC_B.lockContract({ from: F })
//       const txLockC = await CDLC_C.lockContract({ from: F })

//       const lockupTxTimestamp_A = await th.getTimestampFromTx(txLockA, web3)
//       const lockupTxTimestamp_B = await th.getTimestampFromTx(txLockB, web3)
//       const lockupTxTimestamp_C = await th.getTimestampFromTx(txLockC, web3)

//       // Get recorded lockup start times
//       const lockupStartTime_A = (await CDLC_A.lockupStartTimeInSeconds()).toString()
//       const lockupStartTime_B = (await CDLC_B.lockupStartTimeInSeconds()).toString()
//       const lockupStartTime_C = (await CDLC_C.lockupStartTimeInSeconds()).toString()

//       // Check lockup start times equal the timestamp of the lockup transaction
//       assert.equal(lockupTxTimestamp_A, lockupStartTime_A)
//       assert.equal(lockupTxTimestamp_B, lockupStartTime_B)
//       assert.equal(lockupTxTimestamp_C, lockupStartTime_C)

//       // --- Fast forward time one month ---

//       await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

//       // Deploy 2 more CDLCs, D and E
//       const CDLC_D = await CustomDurationLockupContract.new(lqtyToken.address, D, LQTYEntitlement_D, SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLC_E = await CustomDurationLockupContract.new(lqtyToken.address, E, LQTYEntitlement_E, SECONDS_IN_ONE_MONTH, { from: F })

//       // LiquityAG transfers LQTY to each CDLC
//       await lqtyToken.transfer(CDLC_D.address, LQTYEntitlement_D, { from: F })
//       await lqtyToken.transfer(CDLC_E.address, LQTYEntitlement_E, { from: F })

//       //LiquityAG locks CDLCs D and E
//       const txLockD = await CDLC_D.lockContract({ from: F })
//       const txLockE = await CDLC_E.lockContract({ from: F })

//       const lockupTxTimestamp_D = await th.getTimestampFromTx(txLockD, web3)
//       const lockupTxTimestamp_E = await th.getTimestampFromTx(txLockE, web3)

//       // Get recorded lockup start times
//       const lockupStartTime_D = (await CDLC_D.lockupStartTimeInSeconds()).toString()
//       const lockupStartTime_E = (await CDLC_E.lockupStartTimeInSeconds()).toString()

//       // Check lockup start times of D and E equal the timestamp of the lockup transaction
//       assert.equal(lockupTxTimestamp_D, lockupStartTime_D)
//       assert.equal(lockupTxTimestamp_E, lockupStartTime_E)
//     })

//     it("Locking reverts when caller is not the deployer", async () => {
//       // Fund H, I
//       await lqtyToken.unprotectedMint(H, dec(10, 24))
//       await lqtyToken.unprotectedMint(I, dec(10, 24))

//       // Deploy 2 CDLCs
//       const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, LQTYEntitlement_A, SECONDS_IN_ONE_MONTH, { from: H })
//       const CDLC_B = await CustomDurationLockupContract.new(lqtyToken.address, B, LQTYEntitlement_B, SECONDS_IN_ONE_MONTH, { from: I })

//       // LQTY deployer transfers LQTY to both CDLCs
//       await lqtyToken.transfer(CDLC_A.address, LQTYEntitlement_A, { from: H })
//       await lqtyToken.transfer(CDLC_B.address, LQTYEntitlement_B, { from: I })

//       // Check CDLC is inactive
//       assert.isFalse(await CDLC_A.active())
//       assert.isFalse(await CDLC_B.active())

//       const variousAccounts = [A, B, D, C, D, E, F, G]

//       // Various EOAs try to lock CDLC_A via Factory
//       for (account of variousAccounts) {
//         try {
//           const lockingAttemptTx = await CDLC_A.lockContract({ from: account })
//           assert.isFalse(lockingAttemptTx.receipt.status)
//         } catch (error) {
//           assert.include(error.message, "revert")
//         }
//       }

//       // Various EOAs try to lock CDLC_B via Factory
//       for (account of variousAccounts) {
//         try {
//           const lockingAttemptTx = await CDLC_B.lockContract({ from: account })
//           assert.isFalse(lockingAttemptTx.receipt.status)
//         } catch (error) {
//           assert.include(error.message, "revert")
//         }
//       }
//     })

//     //#2
//     it("Locking reverts when contract is already locked & active", async () => {
//       // Fund F, H
//       await lqtyToken.unprotectedMint(F, dec(10, 24))
//       await lqtyToken.unprotectedMint(H, dec(10, 24))

//       // Deploy 2 CDLCs
//       const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, LQTYEntitlement_A, SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLC_B = await CustomDurationLockupContract.new(lqtyToken.address, B, LQTYEntitlement_B, SECONDS_IN_ONE_MONTH, { from: H })

//       // Deployers transfer LQTY to each CDLC
//       await lqtyToken.transfer(CDLC_A.address, LQTYEntitlement_A, { from: F })
//       await lqtyToken.transfer(CDLC_B.address, LQTYEntitlement_B, { from: H })

//       // Check CDLCs are inactive
//       assert.isFalse(await CDLC_A.active())
//       assert.isFalse(await CDLC_B.active())

//       // Lock contracts by deployers
//       await CDLC_A.lockContract({ from: F })
//       await CDLC_B.lockContract({ from: H })

//       // Check CDLCs are active
//       assert.isTrue(await CDLC_A.active())
//       assert.isTrue(await CDLC_B.active())

//       // Deployers again call lockContract() 
//       const txAPromise = CDLC_A.lockContract({ from: F })
//       const txBPromise = CDLC_B.lockContract({ from: H })

//       await assertRevert(txAPromise)
//       await assertRevert(txBPromise)
//     })

//     //#4
//     it("Locking reverts when contract balance < beneficiary entitlement", async () => {
//       //>> ff time so that LCF can deploy CDLCs 
//       await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

//       // Deploy 2 CDLCs
//       const deployedCDLCtx_A = await lockupContractFactory.deployCustomDurationLockupContract(A, LQTYEntitlement_A, SECONDS_IN_ONE_MONTH, { from: liquityAG })
//       const deployedCDLCtx_B = await lockupContractFactory.deployCustomDurationLockupContract(B, LQTYEntitlement_B, SECONDS_IN_ONE_MONTH, { from: C })

//       // Grab contracts from deployment tx events
//       const CDLC_A = await th.getCDLCFromDeploymentTx(deployedCDLCtx_A)
//       const CDLC_B = await th.getCDLCFromDeploymentTx(deployedCDLCtx_B)

//       // LQTY deployer transfers insufficient LQTY to both CDLCs
//       await lqtyToken.transfer(CDLC_A.address, toBN(LQTYEntitlement_A).sub(toBN('1')), { from: liquityAG })
//       await lqtyToken.transfer(CDLC_B.address, toBN(LQTYEntitlement_B).sub(toBN('1')), { from: liquityAG })

//       // Check CDLCs are inactive
//       assert.isFalse(await CDLC_A.active())
//       assert.isFalse(await CDLC_B.active())

//       // Deployers attempts to locks contracts through factory - expect it fails, insufficient funds
//       const txAPromise = lockupContractFactory.lockCustomDurationContracts([CDLC_A.address], { from: liquityAG })
//       const txBPromise = lockupContractFactory.lockCustomDurationContracts([CDLC_B.address], { from: C })
//       await assertRevert(txAPromise, "LQTY balance of this CDLC must cover the initial entitlement")
//       await assertRevert(txBPromise, "LQTY balance of this CDLC must cover the initial entitlement")
//     })
//   })

//   describe('Withdrawal Attempts on active CDLCs before lockup period has passed', async accounts => {
//     //TODO
//     it("Beneficiary can't withdraw from their funded and locked CDLC", async () => {
//       // Fund F
//       await lqtyToken.unprotectedMint(F, dec(10, 24))

//       // Account D deploys a new OYLC via the Factory
//       const CDLC_B = await CustomDurationLockupContract.new(lqtyToken.address, B, dec(2, 18), SECONDS_IN_ONE_MONTH, { from: F })

//       // deployer funds contracts
//       await lqtyToken.transfer(CDLC_B.address, dec(2, 18), { from: F })

//       // F locks their deployed CDLC
//       await CDLC_B.lockContract({ from: F })

//       try {
//         const beneficiary = await CDLC_B.beneficiary()
//         const withdrawalAttempt = await CDLC_B.withdrawLQTY({ from: beneficiary })
//         assert.isFalse(withdrawalAttempt.receipt.status)
//       } catch (error) {
//         assert.include(error.message, "revert")
//       }
//     })

//     //TODO
//     it("No one can withdraw from a funded and locked CDLC", async () => {
//       // Fund F
//       await lqtyToken.unprotectedMint(F, dec(10, 24))


//       // Account D deploys a new OYLC via the Factory
//       const CDLC_B = await CustomDurationLockupContract.new(lqtyToken.address, B, SECONDS_IN_ONE_MONTH, dec(2, 18), { from: F })

//       // LQTY deployer funds contracts
//       await lqtyToken.transfer(CDLC_B.address, dec(2, 18), { from: F })

//       // D locks their deployed OYLC
//       await CDLC_B.lockContract({ from: F })

//       const variousEOAs = [teamMember_1, liquityAG, investor_1, A, B, C, D, E]

//       // Several EOAs attempt to withdraw from OYLC deployed by D
//       for (account of variousEOAs) {
//         try {
//           const withdrawalAttempt = await CDLC_B.withdrawLQTY({ from: account })
//           assert.isFalse(withdrawalAttempt.receipt.status)
//         } catch (error) {
//           assert.include(error.message, "revert")
//         }
//       }
//     })
//   })

//   describe('Beneficiary withdrawal from CDLCs', async accounts => {
//     //TODO
//     it("After a CDLC lockup period has passed, beneficiary can withdraw their full entitlement from their CDLC", async () => {
//       // Fund F
//       await lqtyToken.unprotectedMint(F, dec(10, 24))

//       const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, dec(1, 24), SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLC_B = await CustomDurationLockupContract.new(lqtyToken.address, B, dec(2, 24), SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLC_C = await CustomDurationLockupContract.new(lqtyToken.address, C, dec(3, 24), SECONDS_IN_ONE_MONTH, { from: F })

//       // LQTY deployer transfers LQTY entitlements to the contracts
//       await lqtyToken.transfer(CDLC_A.address, dec(1, 24), { from: F })
//       await lqtyToken.transfer(CDLC_B.address, dec(2, 24), { from: F })
//       await lqtyToken.transfer(CDLC_C.address, dec(3, 24), { from: F })

//       // Deployer locks the CDLCs they deployed
//       await CDLC_A.lockContract({ from: F })
//       await CDLC_B.lockContract({ from: F })
//       await CDLC_C.lockContract({ from: F })

//       await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

//       // Check A, B, C LQTY balances before
//       assert.equal(await lqtyToken.balanceOf(A), '0')
//       assert.equal(await lqtyToken.balanceOf(B), '0')
//       assert.equal(await lqtyToken.balanceOf(C), '0')

//       // A, B, C withdraw from their CDLCs
//       await CDLC_A.withdrawLQTY({ from: A })
//       await CDLC_B.withdrawLQTY({ from: B })
//       await CDLC_C.withdrawLQTY({ from: C })

//       // Check A, B, C LQTY balances after withdrawal
//       assert.equal(await lqtyToken.balanceOf(A), dec(1, 24))
//       assert.equal(await lqtyToken.balanceOf(B), dec(2, 24))
//       assert.equal(await lqtyToken.balanceOf(C), dec(3, 24))
//     })

//     //TODO
//     it("After a CDLC lockup period has passed, Beneficiary can withdraw full LQTY balance of CDLC when it exceeds their initial entitlement", async () => {
//       // Fund F
//       await lqtyToken.unprotectedMint(F, dec(10, 24))

//       const CDLC_A = await CustomDurationLockupContract.new(lqtyToken.address, A, dec(1, 24), SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLC_B = await CustomDurationLockupContract.new(lqtyToken.address, B, dec(2, 24), SECONDS_IN_ONE_MONTH, { from: F })
//       const CDLC_C = await CustomDurationLockupContract.new(lqtyToken.address, C, dec(3, 24), SECONDS_IN_ONE_MONTH, { from: F })

//       // LQTY deployer transfers LQTY entitlements to the contracts
//       await lqtyToken.transfer(CDLC_A.address, dec(1, 24), { from: F })
//       await lqtyToken.transfer(CDLC_B.address, dec(2, 24), { from: F })
//       await lqtyToken.transfer(CDLC_C.address, dec(3, 24), { from: F })

//       // Deployer locks the CDLCs they deployed
//       await CDLC_A.lockContract({ from: F })
//       await CDLC_B.lockContract({ from: F })
//       await CDLC_C.lockContract({ from: F })

//       await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

//       // Transfer more LQTY, such that CDLC balances exceed their respective entitlements
//       await lqtyToken.transfer(CDLC_A.address, dec(1, 24), { from: F })
//       await lqtyToken.transfer(CDLC_B.address, dec(1, 24), { from: F })
//       await lqtyToken.transfer(CDLC_C.address, dec(1, 24), { from: F })

//       // Check A, B, C LQTY balances before
//       assert.equal(await lqtyToken.balanceOf(A), '0')
//       assert.equal(await lqtyToken.balanceOf(B), '0')
//       assert.equal(await lqtyToken.balanceOf(C), '0')

//       // Confirm CDLC balances before withdrawal
//       assert.equal(await lqtyToken.balanceOf(CDLC_A.address), dec(2, 24))
//       assert.equal(await lqtyToken.balanceOf(CDLC_B.address), dec(3, 24))
//       assert.equal(await lqtyToken.balanceOf(CDLC_C.address), dec(4, 24))

//       // A, B, C withdraw from their CDLCs
//       await CDLC_A.withdrawLQTY({ from: A })
//       await CDLC_B.withdrawLQTY({ from: B })
//       await CDLC_C.withdrawLQTY({ from: C })

//       // Check A, B, C LQTY balances after withdrawal
//       assert.equal(await lqtyToken.balanceOf(A), dec(2, 24))
//       assert.equal(await lqtyToken.balanceOf(B), dec(3, 24))
//       assert.equal(await lqtyToken.balanceOf(C), dec(4, 24))
//     })
//   })
// })