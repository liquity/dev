const TwoMonthsLockupContract = artifacts.require("./TwoMonthsLockupContract.sol")
const SixMonthsLockupContract = artifacts.require("./SixMonthsLockupContract.sol")
const OneYearLockupContract = artifacts.require("./OneYearLockupContract.sol")

const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const { dec, toBN, assertRevert } = th

contract('Deploying and funding One Year Lockup Contracts', async accounts => {
  const [liquityAG, A, B, C, D, E, F, G, H, I, J, K, L, M, N, O] = accounts;

  const [ bountyAddress, lpRewardsAddress, momentZeroMultisig, sixMonthsMultisig, oneYearMultisig ] = accounts.slice(995, 1000)

  const { SECONDS_IN_ONE_MONTH, SECONDS_IN_TWO_MONTHS, SECONDS_IN_SIX_MONTHS, SECONDS_IN_ONE_YEAR } = timeValues

  let STBLContracts

  // 1e24 = 1 million tokens with 18 decimal digits
  const STBLEntitlement_A = dec(1, 24)
  const STBLEntitlement_B = dec(11, 23)
  const STBLEntitlement_C = dec(12, 23)
  const STBLEntitlement_D = dec(13, 23)
  const STBLEntitlement_E = dec(14, 23)

  // 1e24 = 1 million tokens with 18 decimal digits
  const STBLEntitlement_F = dec(15, 23)
  const STBLEntitlement_G = dec(16, 23)
  const STBLEntitlement_H = dec(17, 23)
  const STBLEntitlement_I = dec(18, 23)
  const STBLEntitlement_J = dec(19, 23)

      // 1e24 = 1 million tokens with 18 decimal digits
  const STBLEntitlement_K = dec(20, 23)
  const STBLEntitlement_L = dec(21, 23)
  const STBLEntitlement_M = dec(22, 23)
  const STBLEntitlement_N = dec(23, 23)
  const STBLEntitlement_O = dec(24, 23)

  let stblStaking
  let stblToken
  let communityIssuance
  let lockupContractFactory

  let twoMonthsFromSystemDeployment
  let sixMonthsFromSystemDeployment
  let oneYearFromSystemDeployment

  beforeEach(async () => {
    // Deploy all contracts from the first account
    STBLContracts = await deploymentHelper.deploySTBLContracts(bountyAddress, lpRewardsAddress, momentZeroMultisig, sixMonthsMultisig, oneYearMultisig)
    await deploymentHelper.connectSTBLContracts(STBLContracts)

    stblStaking = STBLContracts.stblStaking
    stblToken = STBLContracts.stblToken
    communityIssuance = STBLContracts.communityIssuance
    lockupContractFactory = STBLContracts.lockupContractFactory

    twoMonthsFromSystemDeployment = await th.getTimeFromSystemDeployment(stblToken, web3, SECONDS_IN_TWO_MONTHS)
    sixMonthsFromSystemDeployment = await th.getTimeFromSystemDeployment(stblToken, web3, SECONDS_IN_SIX_MONTHS)
    oneYearFromSystemDeployment = await th.getTimeFromSystemDeployment(stblToken, web3, SECONDS_IN_ONE_YEAR)
  })
''
  // --- LCs ---

  describe('Deploying LCs', async accounts => {
    it("STBL Deployer can deploy LCs through the Factory", async () => {
    
      // STBL deployer deploys two months LCs
      const twoMonthsLCDeploymentTx_A = await lockupContractFactory.deployTwoMonthsLockupContract(A, twoMonthsFromSystemDeployment, { from: liquityAG })
      const twoMonthsLCDeploymentTx_B = await lockupContractFactory.deployTwoMonthsLockupContract(B, twoMonthsFromSystemDeployment, { from: liquityAG })
      const twoMonthsLCDeploymentTx_C = await lockupContractFactory.deployTwoMonthsLockupContract(C, twoMonthsFromSystemDeployment, { from: liquityAG })

      // STBL deployer deploys six months LCs
      const sixMonthsLCDeploymentTx_A = await lockupContractFactory.deploySixMonthsLockupContract(A, sixMonthsFromSystemDeployment, { from: liquityAG })
      const sixMonthsLCDeploymentTx_B = await lockupContractFactory.deploySixMonthsLockupContract(B, sixMonthsFromSystemDeployment, { from: liquityAG })
      const sixMonthsLCDeploymentTx_C = await lockupContractFactory.deploySixMonthsLockupContract(C, sixMonthsFromSystemDeployment, { from: liquityAG })

      // STBL deployer deploys one year LCs
      const oneYearLCDeploymentTx_A = await lockupContractFactory.deployOneYearLockupContract(A, oneYearFromSystemDeployment, { from: liquityAG })
      const oneYearLCDeploymentTx_B = await lockupContractFactory.deployOneYearLockupContract(B, oneYearFromSystemDeployment, { from: liquityAG })
      const oneYearLCDeploymentTx_C = await lockupContractFactory.deployOneYearLockupContract(C, oneYearFromSystemDeployment, { from: liquityAG })

      assert.isTrue(twoMonthsLCDeploymentTx_A.receipt.status)
      assert.isTrue(twoMonthsLCDeploymentTx_B.receipt.status)
      assert.isTrue(twoMonthsLCDeploymentTx_C.receipt.status)

      assert.isTrue(sixMonthsLCDeploymentTx_A.receipt.status)
      assert.isTrue(sixMonthsLCDeploymentTx_B.receipt.status)
      assert.isTrue(sixMonthsLCDeploymentTx_C.receipt.status)

      assert.isTrue(oneYearLCDeploymentTx_A.receipt.status)
      assert.isTrue(oneYearLCDeploymentTx_B.receipt.status)
      assert.isTrue(oneYearLCDeploymentTx_C.receipt.status)
    })

    it("Anyone can deploy LCs through the Factory", async () => {
      // Various EOAs deploy LCs

      const twoMonthsLCDeploymentTx_1 = await lockupContractFactory.deployTwoMonthsLockupContract(A, twoMonthsFromSystemDeployment, { from: G })
      const twoMonthsLCDeploymentTx_2 = await lockupContractFactory.deployTwoMonthsLockupContract(C, twoMonthsFromSystemDeployment, { from: H })
      const twoMonthsLCDeploymentTx_3 = await lockupContractFactory.deployTwoMonthsLockupContract(liquityAG, twoMonthsFromSystemDeployment, { from: I })
      const twoMonthsLCDeploymentTx_4 = await lockupContractFactory.deployTwoMonthsLockupContract(D, twoMonthsFromSystemDeployment, { from: J })

      const sixMonthsLCDeploymentTx_1 = await lockupContractFactory.deploySixMonthsLockupContract(A, sixMonthsFromSystemDeployment, { from: G })
      const sixMonthsLCDeploymentTx_2 = await lockupContractFactory.deploySixMonthsLockupContract(C, sixMonthsFromSystemDeployment, { from: H })
      const sixMonthsLCDeploymentTx_3 = await lockupContractFactory.deploySixMonthsLockupContract(liquityAG, sixMonthsFromSystemDeployment, { from: I })
      const sixMonthsLCDeploymentTx_4 = await lockupContractFactory.deploySixMonthsLockupContract(D, sixMonthsFromSystemDeployment, { from: J })

      const oneYearLCDeploymentTx_1 = await lockupContractFactory.deployOneYearLockupContract(A, oneYearFromSystemDeployment, { from: G })
      const oneYearLCDeploymentTx_2 = await lockupContractFactory.deployOneYearLockupContract(C, oneYearFromSystemDeployment, { from: H })
      const oneYearLCDeploymentTx_3 = await lockupContractFactory.deployOneYearLockupContract(liquityAG, oneYearFromSystemDeployment, { from: I })
      const oneYearLCDeploymentTx_4 = await lockupContractFactory.deployOneYearLockupContract(D, oneYearFromSystemDeployment, { from: J })

      assert.isTrue(twoMonthsLCDeploymentTx_1.receipt.status)
      assert.isTrue(twoMonthsLCDeploymentTx_2.receipt.status)
      assert.isTrue(twoMonthsLCDeploymentTx_3.receipt.status)
      assert.isTrue(twoMonthsLCDeploymentTx_4.receipt.status)

      assert.isTrue(sixMonthsLCDeploymentTx_1.receipt.status)
      assert.isTrue(sixMonthsLCDeploymentTx_2.receipt.status)
      assert.isTrue(sixMonthsLCDeploymentTx_3.receipt.status)
      assert.isTrue(sixMonthsLCDeploymentTx_4.receipt.status)

      assert.isTrue(oneYearLCDeploymentTx_1.receipt.status)
      assert.isTrue(oneYearLCDeploymentTx_2.receipt.status)
      assert.isTrue(oneYearLCDeploymentTx_3.receipt.status)
      assert.isTrue(oneYearLCDeploymentTx_4.receipt.status)
    })

    it("STBL Deployer can deploy LCs directly", async () => {
      // STBL deployer deploys LCs
      const twoMonthsLC_A = await TwoMonthsLockupContract.new(stblToken.address, A, twoMonthsFromSystemDeployment, { from: liquityAG })
      const twoMonthsLC_A_txReceipt = await web3.eth.getTransactionReceipt(twoMonthsLC_A.transactionHash)

      const twoMonthsLC_B = await TwoMonthsLockupContract.new(stblToken.address, B, twoMonthsFromSystemDeployment, { from: liquityAG })
      const twoMonthsLC_B_txReceipt = await web3.eth.getTransactionReceipt(twoMonthsLC_B.transactionHash)

      const twoMonthsLC_C = await TwoMonthsLockupContract.new(stblToken.address, C, twoMonthsFromSystemDeployment, { from: liquityAG })
      const twoMonthsLC_C_txReceipt = await web3.eth.getTransactionReceipt(twoMonthsLC_C.transactionHash)

      // STBL deployer deploys LCs
      const sixMonthsLC_A = await SixMonthsLockupContract.new(stblToken.address, A, sixMonthsFromSystemDeployment, { from: liquityAG })
      const sixMonthsLC_A_txReceipt = await web3.eth.getTransactionReceipt(sixMonthsLC_A.transactionHash)

      const sixMonthsLC_B = await SixMonthsLockupContract.new(stblToken.address, B, sixMonthsFromSystemDeployment, { from: liquityAG })
      const sixMonthsLC_B_txReceipt = await web3.eth.getTransactionReceipt(sixMonthsLC_B.transactionHash)

      const sixMonthsLC_C = await SixMonthsLockupContract.new(stblToken.address, C, sixMonthsFromSystemDeployment, { from: liquityAG })
      const sixMonthsLC_C_txReceipt = await web3.eth.getTransactionReceipt(sixMonthsLC_C.transactionHash)

      // STBL deployer deploys LCs
      const oneYearLC_A = await OneYearLockupContract.new(stblToken.address, A, oneYearFromSystemDeployment, { from: liquityAG })
      const oneYearLC_A_txReceipt = await web3.eth.getTransactionReceipt(oneYearLC_A.transactionHash)

      const oneYearLC_B = await OneYearLockupContract.new(stblToken.address, B, oneYearFromSystemDeployment, { from: liquityAG })
      const oneYearLC_B_txReceipt = await web3.eth.getTransactionReceipt(oneYearLC_B.transactionHash)

      const oneYearLC_C = await OneYearLockupContract.new(stblToken.address, C, oneYearFromSystemDeployment, { from: liquityAG })
      const oneYearLC_C_txReceipt = await web3.eth.getTransactionReceipt(oneYearLC_C.transactionHash)

      // Check deployment succeeded
      assert.isTrue(twoMonthsLC_A_txReceipt.status)
      assert.isTrue(twoMonthsLC_B_txReceipt.status)
      assert.isTrue(twoMonthsLC_C_txReceipt.status)

      // Check deployment succeeded
      assert.isTrue(sixMonthsLC_A_txReceipt.status)
      assert.isTrue(sixMonthsLC_B_txReceipt.status)
      assert.isTrue(sixMonthsLC_C_txReceipt.status)

                  // Check deployment succeeded
      assert.isTrue(oneYearLC_A_txReceipt.status)
      assert.isTrue(oneYearLC_B_txReceipt.status)
      assert.isTrue(oneYearLC_C_txReceipt.status)
    })

    it("Anyone can deploy LCs directly", async () => {
      // STBL deployer deploys LCs
      const twoMonthsLC_A = await TwoMonthsLockupContract.new(stblToken.address, A, twoMonthsFromSystemDeployment, { from: D })
      const twoMonthsLC_A_txReceipt = await web3.eth.getTransactionReceipt(twoMonthsLC_A.transactionHash)

      const twoMonthsLC_B = await TwoMonthsLockupContract.new(stblToken.address, B, twoMonthsFromSystemDeployment, { from: E })
      const twoMonthsLC_B_txReceipt = await web3.eth.getTransactionReceipt(twoMonthsLC_B.transactionHash)

      const twoMonthsLC_C = await TwoMonthsLockupContract.new(stblToken.address, C, twoMonthsFromSystemDeployment, { from: F })
      const twoMonthsLC_C_txReceipt = await web3.eth.getTransactionReceipt(twoMonthsLC_C.transactionHash)

      // STBL deployer deploys LCs
      const sixMonthsLC_A = await SixMonthsLockupContract.new(stblToken.address, A, sixMonthsFromSystemDeployment, { from: D })
      const sixMonthsLC_A_txReceipt = await web3.eth.getTransactionReceipt(sixMonthsLC_A.transactionHash)

      const sixMonthsLC_B = await SixMonthsLockupContract.new(stblToken.address, B, sixMonthsFromSystemDeployment, { from: E })
      const sixMonthsLC_B_txReceipt = await web3.eth.getTransactionReceipt(sixMonthsLC_B.transactionHash)

      const sixMonthsLC_C = await SixMonthsLockupContract.new(stblToken.address, C, sixMonthsFromSystemDeployment, { from: F })
      const sixMonthsLC_C_txReceipt = await web3.eth.getTransactionReceipt(sixMonthsLC_C.transactionHash)

      // STBL deployer deploys LCs
      const oneYearLC_A = await OneYearLockupContract.new(stblToken.address, A, oneYearFromSystemDeployment, { from: D })
      const oneYearLC_A_txReceipt = await web3.eth.getTransactionReceipt(oneYearLC_A.transactionHash)

      const oneYearLC_B = await OneYearLockupContract.new(stblToken.address, B, oneYearFromSystemDeployment, { from: E })
      const oneYearLC_B_txReceipt = await web3.eth.getTransactionReceipt(oneYearLC_B.transactionHash)

      const oneYearLC_C = await OneYearLockupContract.new(stblToken.address, C, oneYearFromSystemDeployment, { from: F })
      const oneYearLC_C_txReceipt = await web3.eth.getTransactionReceipt(oneYearLC_C.transactionHash)

      // Check deployment succeeded
      assert.isTrue(twoMonthsLC_A_txReceipt.status)
      assert.isTrue(twoMonthsLC_B_txReceipt.status)
      assert.isTrue(twoMonthsLC_C_txReceipt.status)

      // Check deployment succeeded
      assert.isTrue(sixMonthsLC_A_txReceipt.status)
      assert.isTrue(sixMonthsLC_B_txReceipt.status)
      assert.isTrue(sixMonthsLC_C_txReceipt.status)

      // Check deployment succeeded
      assert.isTrue(oneYearLC_A_txReceipt.status)
      assert.isTrue(oneYearLC_B_txReceipt.status)
      assert.isTrue(oneYearLC_C_txReceipt.status)
    })

    it("LC deployment stores the beneficiary's address in the LC", async () => {
      // Deploy 5 LCs
      const deployedTwoMonthsLCtx_A = await lockupContractFactory.deployTwoMonthsLockupContract(A, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedTwoMonthsLCtx_B = await lockupContractFactory.deployTwoMonthsLockupContract(B, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedTwoMonthsLCtx_C = await lockupContractFactory.deployTwoMonthsLockupContract(C, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedTwoMonthsLCtx_D = await lockupContractFactory.deployTwoMonthsLockupContract(D, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedTwoMonthsLCtx_E = await lockupContractFactory.deployTwoMonthsLockupContract(E, twoMonthsFromSystemDeployment, { from: liquityAG })

      // Deploy 5 LCs
      const deployedSixMonthsLCtx_F = await lockupContractFactory.deploySixMonthsLockupContract(F, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedSixMonthsLCtx_G = await lockupContractFactory.deploySixMonthsLockupContract(G, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedSixMonthsLCtx_H = await lockupContractFactory.deploySixMonthsLockupContract(H, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedSixMonthsLCtx_I = await lockupContractFactory.deploySixMonthsLockupContract(I, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedSixMonthsLCtx_J = await lockupContractFactory.deploySixMonthsLockupContract(J, sixMonthsFromSystemDeployment, { from: liquityAG })

      // Deploy 5 LCs
      const deployedOneYearLCtx_K = await lockupContractFactory.deployOneYearLockupContract(K, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedOneYearLCtx_L = await lockupContractFactory.deployOneYearLockupContract(L, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedOneYearLCtx_M = await lockupContractFactory.deployOneYearLockupContract(M, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedOneYearLCtx_N = await lockupContractFactory.deployOneYearLockupContract(N, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedOneYearLCtx_O = await lockupContractFactory.deployOneYearLockupContract(O, oneYearFromSystemDeployment, { from: liquityAG })

      // Grab contracts from deployment tx events
      const twoMonthsLC_A = await th.getLCFromDeploymentTx(deployedTwoMonthsLCtx_A)
      const twoMonthsLC_B = await th.getLCFromDeploymentTx(deployedTwoMonthsLCtx_B)
      const twoMonthsLC_C = await th.getLCFromDeploymentTx(deployedTwoMonthsLCtx_C)
      const twoMonthsLC_D = await th.getLCFromDeploymentTx(deployedTwoMonthsLCtx_D)
      const twoMonthsLC_E = await th.getLCFromDeploymentTx(deployedTwoMonthsLCtx_E)

      // Grab contracts from deployment tx events
      const sixMonthsLC_F = await th.getLCFromDeploymentTx(deployedSixMonthsLCtx_F)
      const sixMonthsLC_G = await th.getLCFromDeploymentTx(deployedSixMonthsLCtx_G)
      const sixMonthsLC_H = await th.getLCFromDeploymentTx(deployedSixMonthsLCtx_H)
      const sixMonthsLC_I = await th.getLCFromDeploymentTx(deployedSixMonthsLCtx_I)
      const sixMonthsLC_J = await th.getLCFromDeploymentTx(deployedSixMonthsLCtx_J)

      // Grab contracts from deployment tx events
      const oneYearLC_K = await th.getLCFromDeploymentTx(deployedOneYearLCtx_K)
      const oneYearLC_L = await th.getLCFromDeploymentTx(deployedOneYearLCtx_L)
      const oneYearLC_M = await th.getLCFromDeploymentTx(deployedOneYearLCtx_M)
      const oneYearLC_N = await th.getLCFromDeploymentTx(deployedOneYearLCtx_N)
      const oneYearLC_O = await th.getLCFromDeploymentTx(deployedOneYearLCtx_O)

      const twoMonthsStoredBeneficiaryAddress_A = await twoMonthsLC_A.beneficiary()
      const twoMonthsStoredBeneficiaryAddress_B = await twoMonthsLC_B.beneficiary()
      const twoMonthsStoredBeneficiaryAddress_C = await twoMonthsLC_C.beneficiary()
      const twoMonthsStoredBeneficiaryAddress_D = await twoMonthsLC_D.beneficiary()
      const twoMonthsStoredBeneficiaryAddress_E = await twoMonthsLC_E.beneficiary()

      const sixMonthsStoredBeneficiaryAddress_F = await sixMonthsLC_F.beneficiary()
      const sixMonthsStoredBeneficiaryAddress_G = await sixMonthsLC_G.beneficiary()
      const sixMonthsStoredBeneficiaryAddress_H = await sixMonthsLC_H.beneficiary()
      const sixMonthsStoredBeneficiaryAddress_I = await sixMonthsLC_I.beneficiary()
      const sixMonthsStoredBeneficiaryAddress_J = await sixMonthsLC_J.beneficiary()

      const oneYearStoredBeneficiaryAddress_K = await oneYearLC_K.beneficiary()
      const oneYearStoredBeneficiaryAddress_L = await oneYearLC_L.beneficiary()
      const oneYearStoredBeneficiaryAddress_M = await oneYearLC_M.beneficiary()
      const oneYearStoredBeneficiaryAddress_N = await oneYearLC_N.beneficiary()
      const oneYearStoredBeneficiaryAddress_O = await oneYearLC_O.beneficiary()

      assert.equal(A, twoMonthsStoredBeneficiaryAddress_A)
      assert.equal(B, twoMonthsStoredBeneficiaryAddress_B)
      assert.equal(C, twoMonthsStoredBeneficiaryAddress_C)
      assert.equal(D, twoMonthsStoredBeneficiaryAddress_D)
      assert.equal(E, twoMonthsStoredBeneficiaryAddress_E)

      assert.equal(F, sixMonthsStoredBeneficiaryAddress_F)
      assert.equal(G, sixMonthsStoredBeneficiaryAddress_G)
      assert.equal(H, sixMonthsStoredBeneficiaryAddress_H)
      assert.equal(I, sixMonthsStoredBeneficiaryAddress_I)
      assert.equal(J, sixMonthsStoredBeneficiaryAddress_J)

      assert.equal(K, oneYearStoredBeneficiaryAddress_K)
      assert.equal(L, oneYearStoredBeneficiaryAddress_L)
      assert.equal(M, oneYearStoredBeneficiaryAddress_M)
      assert.equal(N, oneYearStoredBeneficiaryAddress_N)
      assert.equal(O, oneYearStoredBeneficiaryAddress_O)
    })

    it("LC deployment through the Factory registers the LC in the Factory", async () => {
      // Deploy 5 LCs
      const deployedLCtx_A = await lockupContractFactory.deployTwoMonthsLockupContract(A, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_B = await lockupContractFactory.deployTwoMonthsLockupContract(B, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_C = await lockupContractFactory.deployTwoMonthsLockupContract(C, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_D = await lockupContractFactory.deployTwoMonthsLockupContract(D, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_E = await lockupContractFactory.deployTwoMonthsLockupContract(E, twoMonthsFromSystemDeployment, { from: liquityAG })

      // Deploy 5 LCs
      const deployedLCtx_F = await lockupContractFactory.deploySixMonthsLockupContract(F, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_G = await lockupContractFactory.deploySixMonthsLockupContract(G, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_H = await lockupContractFactory.deploySixMonthsLockupContract(H, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_I = await lockupContractFactory.deploySixMonthsLockupContract(I, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_J = await lockupContractFactory.deploySixMonthsLockupContract(J, sixMonthsFromSystemDeployment, { from: liquityAG })

      // Deploy 5 LCs
      const deployedLCtx_K = await lockupContractFactory.deployOneYearLockupContract(K, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_L = await lockupContractFactory.deployOneYearLockupContract(L, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_M = await lockupContractFactory.deployOneYearLockupContract(M, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_N = await lockupContractFactory.deployOneYearLockupContract(N, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_O = await lockupContractFactory.deployOneYearLockupContract(O, oneYearFromSystemDeployment, { from: liquityAG })

      // Grab contract addresses from deployment tx events
      const LCAddress_A = await th.getLCAddressFromDeploymentTx(deployedLCtx_A)
      const LCAddress_B = await th.getLCAddressFromDeploymentTx(deployedLCtx_B)
      const LCAddress_C = await th.getLCAddressFromDeploymentTx(deployedLCtx_C)
      const LCAddress_D = await th.getLCAddressFromDeploymentTx(deployedLCtx_D)
      const LCAddress_E = await th.getLCAddressFromDeploymentTx(deployedLCtx_E)

      // Grab contract addresses from deployment tx events
      const LCAddress_F = await th.getLCAddressFromDeploymentTx(deployedLCtx_F)
      const LCAddress_G = await th.getLCAddressFromDeploymentTx(deployedLCtx_G)
      const LCAddress_H = await th.getLCAddressFromDeploymentTx(deployedLCtx_H)
      const LCAddress_I = await th.getLCAddressFromDeploymentTx(deployedLCtx_I)
      const LCAddress_J = await th.getLCAddressFromDeploymentTx(deployedLCtx_J)

      // Grab contract addresses from deployment tx events
      const LCAddress_K = await th.getLCAddressFromDeploymentTx(deployedLCtx_K)
      const LCAddress_L = await th.getLCAddressFromDeploymentTx(deployedLCtx_L)
      const LCAddress_M = await th.getLCAddressFromDeploymentTx(deployedLCtx_M)
      const LCAddress_N = await th.getLCAddressFromDeploymentTx(deployedLCtx_N)
      const LCAddress_O = await th.getLCAddressFromDeploymentTx(deployedLCtx_O)

      assert.isTrue(await lockupContractFactory.isRegisteredTwoMonthsLockup(LCAddress_A))
      assert.isTrue(await lockupContractFactory.isRegisteredTwoMonthsLockup(LCAddress_B))
      assert.isTrue(await lockupContractFactory.isRegisteredTwoMonthsLockup(LCAddress_C))
      assert.isTrue(await lockupContractFactory.isRegisteredTwoMonthsLockup(LCAddress_D))
      assert.isTrue(await lockupContractFactory.isRegisteredTwoMonthsLockup(LCAddress_E))

      assert.isTrue(await lockupContractFactory.isRegisteredSixMonthsLockup(LCAddress_F))
      assert.isTrue(await lockupContractFactory.isRegisteredSixMonthsLockup(LCAddress_G))
      assert.isTrue(await lockupContractFactory.isRegisteredSixMonthsLockup(LCAddress_H))
      assert.isTrue(await lockupContractFactory.isRegisteredSixMonthsLockup(LCAddress_I))
      assert.isTrue(await lockupContractFactory.isRegisteredSixMonthsLockup(LCAddress_J))

      assert.isTrue(await lockupContractFactory.isRegisteredOneYearLockup(LCAddress_K))
      assert.isTrue(await lockupContractFactory.isRegisteredOneYearLockup(LCAddress_L))
      assert.isTrue(await lockupContractFactory.isRegisteredOneYearLockup(LCAddress_M))
      assert.isTrue(await lockupContractFactory.isRegisteredOneYearLockup(LCAddress_N))
      assert.isTrue(await lockupContractFactory.isRegisteredOneYearLockup(LCAddress_O))
    })

    it("LC deployment through the Factory records the LC contract address and deployer as a k-v pair in the Factory", async () => {
      // Deploy 5 LCs
      const deployedLCtx_A = await lockupContractFactory.deployTwoMonthsLockupContract(A, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_B = await lockupContractFactory.deployTwoMonthsLockupContract(B, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_C = await lockupContractFactory.deployTwoMonthsLockupContract(C, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_D = await lockupContractFactory.deployTwoMonthsLockupContract(D, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_E = await lockupContractFactory.deployTwoMonthsLockupContract(E, twoMonthsFromSystemDeployment, { from: liquityAG })

      // Deploy 5 LCs
      const deployedLCtx_F = await lockupContractFactory.deploySixMonthsLockupContract(F, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_G = await lockupContractFactory.deploySixMonthsLockupContract(G, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_H = await lockupContractFactory.deploySixMonthsLockupContract(H, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_I = await lockupContractFactory.deploySixMonthsLockupContract(I, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_J = await lockupContractFactory.deploySixMonthsLockupContract(J, sixMonthsFromSystemDeployment, { from: liquityAG })

      // Deploy 5 LCs
      const deployedLCtx_K = await lockupContractFactory.deployOneYearLockupContract(K, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_L = await lockupContractFactory.deployOneYearLockupContract(L, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_M = await lockupContractFactory.deployOneYearLockupContract(M, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_N = await lockupContractFactory.deployOneYearLockupContract(N, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_O = await lockupContractFactory.deployOneYearLockupContract(O, oneYearFromSystemDeployment, { from: liquityAG })

      // Grab contract addresses from deployment tx events
      const LCAddress_A = await th.getLCAddressFromDeploymentTx(deployedLCtx_A)
      const LCAddress_B = await th.getLCAddressFromDeploymentTx(deployedLCtx_B)
      const LCAddress_C = await th.getLCAddressFromDeploymentTx(deployedLCtx_C)
      const LCAddress_D = await th.getLCAddressFromDeploymentTx(deployedLCtx_D)
      const LCAddress_E = await th.getLCAddressFromDeploymentTx(deployedLCtx_E)

      // Grab contract addresses from deployment tx events
      const LCAddress_F = await th.getLCAddressFromDeploymentTx(deployedLCtx_F)
      const LCAddress_G = await th.getLCAddressFromDeploymentTx(deployedLCtx_G)
      const LCAddress_H = await th.getLCAddressFromDeploymentTx(deployedLCtx_H)
      const LCAddress_I = await th.getLCAddressFromDeploymentTx(deployedLCtx_I)
      const LCAddress_J = await th.getLCAddressFromDeploymentTx(deployedLCtx_J)

      // Grab contract addresses from deployment tx events
      const LCAddress_K = await th.getLCAddressFromDeploymentTx(deployedLCtx_K)
      const LCAddress_L = await th.getLCAddressFromDeploymentTx(deployedLCtx_L)
      const LCAddress_M = await th.getLCAddressFromDeploymentTx(deployedLCtx_M)
      const LCAddress_N = await th.getLCAddressFromDeploymentTx(deployedLCtx_N)
      const LCAddress_O = await th.getLCAddressFromDeploymentTx(deployedLCtx_O)

      assert.equal(liquityAG, await lockupContractFactory.twoMonthsLockupContractToDeployer(LCAddress_A))
      assert.equal(liquityAG, await lockupContractFactory.twoMonthsLockupContractToDeployer(LCAddress_B))
      assert.equal(liquityAG, await lockupContractFactory.twoMonthsLockupContractToDeployer(LCAddress_C))
      assert.equal(liquityAG, await lockupContractFactory.twoMonthsLockupContractToDeployer(LCAddress_D))
      assert.equal(liquityAG, await lockupContractFactory.twoMonthsLockupContractToDeployer(LCAddress_E))

      assert.equal(liquityAG, await lockupContractFactory.sixMonthsLockupContractToDeployer(LCAddress_F))
      assert.equal(liquityAG, await lockupContractFactory.sixMonthsLockupContractToDeployer(LCAddress_G))
      assert.equal(liquityAG, await lockupContractFactory.sixMonthsLockupContractToDeployer(LCAddress_H))
      assert.equal(liquityAG, await lockupContractFactory.sixMonthsLockupContractToDeployer(LCAddress_I))
      assert.equal(liquityAG, await lockupContractFactory.sixMonthsLockupContractToDeployer(LCAddress_J))

      assert.equal(liquityAG, await lockupContractFactory.oneYearLockupContractToDeployer(LCAddress_K))
      assert.equal(liquityAG, await lockupContractFactory.oneYearLockupContractToDeployer(LCAddress_L))
      assert.equal(liquityAG, await lockupContractFactory.oneYearLockupContractToDeployer(LCAddress_M))
      assert.equal(liquityAG, await lockupContractFactory.oneYearLockupContractToDeployer(LCAddress_N))
      assert.equal(liquityAG, await lockupContractFactory.oneYearLockupContractToDeployer(LCAddress_O))
    })

    it("LC deployment through the Factory sets the unlockTime in the LC", async () => {
      // Deploy 3 LCs through factory
      const deployedLCtx_A = await lockupContractFactory.deployTwoMonthsLockupContract(A, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_B = await lockupContractFactory.deployTwoMonthsLockupContract(B, '230582305895235', { from: B })
      const deployedLCtx_C = await lockupContractFactory.deployTwoMonthsLockupContract(C, dec(20, 18), { from: E })

      // Deploy 3 LCs through factory
      const deployedLCtx_D = await lockupContractFactory.deploySixMonthsLockupContract(D, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_E = await lockupContractFactory.deploySixMonthsLockupContract(E, '230582305895235', { from: E })
      const deployedLCtx_F = await lockupContractFactory.deploySixMonthsLockupContract(F, dec(20, 18), { from: F })

      // Deploy 3 LCs through factory
      const deployedLCtx_G = await lockupContractFactory.deployOneYearLockupContract(G, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_H = await lockupContractFactory.deployOneYearLockupContract(H, '230582305895235', { from: H })
      const deployedLCtx_I = await lockupContractFactory.deployOneYearLockupContract(I, dec(20, 18), { from: I })

      // Grab contract objects from deployment events
      const LC_A = await th.getLCFromDeploymentTx(deployedLCtx_A)
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)
      const LC_C = await th.getLCFromDeploymentTx(deployedLCtx_C)

      // Grab contract objects from deployment events
      const LC_D = await th.getLCFromDeploymentTx(deployedLCtx_D)
      const LC_E = await th.getLCFromDeploymentTx(deployedLCtx_E)
      const LC_F = await th.getLCFromDeploymentTx(deployedLCtx_F)

      // Grab contract objects from deployment events
      const LC_G = await th.getLCFromDeploymentTx(deployedLCtx_G)
      const LC_H = await th.getLCFromDeploymentTx(deployedLCtx_H)
      const LC_I = await th.getLCFromDeploymentTx(deployedLCtx_I)

      // Grab contract addresses from deployment tx events
      const unlockTime_A = await LC_A.unlockTime()
      const unlockTime_B = await LC_B.unlockTime()
      const unlockTime_C = await LC_C.unlockTime()

      // Grab contract addresses from deployment tx events
      const unlockTime_D = await LC_D.unlockTime()
      const unlockTime_E = await LC_E.unlockTime()
      const unlockTime_F = await LC_F.unlockTime()

      // Grab contract addresses from deployment tx events
      const unlockTime_G = await LC_G.unlockTime()
      const unlockTime_H = await LC_H.unlockTime()
      const unlockTime_I = await LC_I.unlockTime()

      // Check contracts have expected unlockTimes set
      assert.isTrue(unlockTime_A.eq(twoMonthsFromSystemDeployment))
      assert.isTrue(unlockTime_B.eq(toBN('230582305895235')))
      assert.isTrue(unlockTime_C.eq(toBN(dec(20, 18))))

      // Check contracts have expected unlockTimes set
      assert.isTrue(unlockTime_D.eq(sixMonthsFromSystemDeployment))
      assert.isTrue(unlockTime_E.eq(toBN('230582305895235')))
      assert.isTrue(unlockTime_F.eq(toBN(dec(20, 18))))
      
      // Check contracts have expected unlockTimes set
      assert.isTrue(unlockTime_G.eq(oneYearFromSystemDeployment))
      assert.isTrue(unlockTime_H.eq(toBN('230582305895235')))
      assert.isTrue(unlockTime_I.eq(toBN(dec(20, 18))))
    })

    it("Direct deployment of LC sets the unlockTime in the LC", async () => {
      // Deploy 3 LCs directly
      const LC_A = await TwoMonthsLockupContract.new(stblToken.address, A, twoMonthsFromSystemDeployment, { from: liquityAG })
      const LC_B = await TwoMonthsLockupContract.new(stblToken.address, B, '230582305895235', { from: B })
      const LC_C = await TwoMonthsLockupContract.new(stblToken.address, C, dec(20, 18), { from: E })

      // Deploy 3 LCs directly
      const LC_D = await SixMonthsLockupContract.new(stblToken.address, D, sixMonthsFromSystemDeployment, { from: liquityAG })
      const LC_E = await SixMonthsLockupContract.new(stblToken.address, E, '230582305895235', { from: E })
      const LC_F = await SixMonthsLockupContract.new(stblToken.address, F, dec(20, 18), { from: L })

      // Deploy 3 LCs directly
      const LC_G = await OneYearLockupContract.new(stblToken.address, G, oneYearFromSystemDeployment, { from: liquityAG })
      const LC_H = await OneYearLockupContract.new(stblToken.address, H, '230582305895235', { from: H })
      const LC_I = await OneYearLockupContract.new(stblToken.address, I, dec(20, 18), { from: J })

      // Grab contract addresses from deployment tx events
      const unlockTime_A = await LC_A.unlockTime()
      const unlockTime_B = await LC_B.unlockTime()
      const unlockTime_C = await LC_C.unlockTime()

      // Grab contract addresses from deployment tx events
      const unlockTime_D = await LC_D.unlockTime()
      const unlockTime_E = await LC_E.unlockTime()
      const unlockTime_F = await LC_F.unlockTime()

      // Grab contract addresses from deployment tx events
      const unlockTime_G = await LC_G.unlockTime()
      const unlockTime_H = await LC_H.unlockTime()
      const unlockTime_I = await LC_I.unlockTime()

      // Check contracts have expected unlockTimes set
      assert.isTrue(unlockTime_A.eq(twoMonthsFromSystemDeployment))
      assert.isTrue(unlockTime_B.eq(toBN('230582305895235')))
      assert.isTrue(unlockTime_C.eq(toBN(dec(20, 18))))

      // Check contracts have expected unlockTimes set
      assert.isTrue(unlockTime_D.eq(sixMonthsFromSystemDeployment))
      assert.isTrue(unlockTime_E.eq(toBN('230582305895235')))
      assert.isTrue(unlockTime_F.eq(toBN(dec(20, 18))))

      // Check contracts have expected unlockTimes set
      assert.isTrue(unlockTime_G.eq(oneYearFromSystemDeployment))
      assert.isTrue(unlockTime_H.eq(toBN('230582305895235')))
      assert.isTrue(unlockTime_I.eq(toBN(dec(20, 18))))
    })

    it("LC deployment through the Factory reverts when the unlockTime is < 1 year from system deployment", async () => {
      const nearlyTwoMonths = toBN(twoMonthsFromSystemDeployment).sub(toBN('60'))  // 1 minute short of 2 months
      const nearlySixMonths = toBN(sixMonthsFromSystemDeployment).sub(toBN('60'))  // 1 minute short of 6 months
      const nearlyOneYear = toBN(oneYearFromSystemDeployment).sub(toBN('60'))  // 1 minute short of 1 year
      
      // Deploy 3 LCs through factory
      const LCDeploymentPromise_A = lockupContractFactory.deployTwoMonthsLockupContract(A, nearlyTwoMonths, { from: liquityAG })
      const LCDeploymentPromise_B = lockupContractFactory.deployTwoMonthsLockupContract(B, '37', { from: B })
      const LCDeploymentPromise_C = lockupContractFactory.deployTwoMonthsLockupContract(C, '43200', { from: E })

      // Deploy 3 LCs through factory
      const LCDeploymentPromise_D = lockupContractFactory.deploySixMonthsLockupContract(D, nearlySixMonths, { from: liquityAG })
      const LCDeploymentPromise_E = lockupContractFactory.deploySixMonthsLockupContract(E, '37', { from: E })
      const LCDeploymentPromise_F = lockupContractFactory.deploySixMonthsLockupContract(F, '43200', { from: F })

                  // Deploy 3 LCs through factory
      const LCDeploymentPromise_G = lockupContractFactory.deployOneYearLockupContract(G, nearlyOneYear, { from: liquityAG })
      const LCDeploymentPromise_H = lockupContractFactory.deployOneYearLockupContract(H, '37', { from: H })
      const LCDeploymentPromise_I = lockupContractFactory.deployOneYearLockupContract(I, '43200', { from: I })

      // Confirm contract deployments revert
      await assertRevert(LCDeploymentPromise_A, "LockupContract: unlock time must be at least two months after system deployment")
      await assertRevert(LCDeploymentPromise_B, "LockupContract: unlock time must be at least two months after system deployment")
      await assertRevert(LCDeploymentPromise_C, "LockupContract: unlock time must be at least two months after system deployment")

      // Confirm contract deployments revert
      await assertRevert(LCDeploymentPromise_D, "LockupContract: unlock time must be at least six months after system deployment")
      await assertRevert(LCDeploymentPromise_E, "LockupContract: unlock time must be at least six months after system deployment")
      await assertRevert(LCDeploymentPromise_F, "LockupContract: unlock time must be at least six months after system deployment")

      // Confirm contract deployments revert
      await assertRevert(LCDeploymentPromise_G, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(LCDeploymentPromise_H, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(LCDeploymentPromise_I, "LockupContract: unlock time must be at least one year after system deployment")
    })

    it("Direct deployment of LC reverts when the unlockTime is < 1 year from system deployment", async () => {
      const nearlyTwoMonths = toBN(twoMonthsFromSystemDeployment).sub(toBN('60'))  // 1 minute short of 2 months
      const nearlySixMonths = toBN(sixMonthsFromSystemDeployment).sub(toBN('60'))  // 1 minute short of 6 months
      const nearlyOneYear = toBN(oneYearFromSystemDeployment).sub(toBN('60'))  // 1 minute short of 1 year
      
      // Deploy 3 LCs directly with unlockTime < 1 year from system deployment
      const LCDeploymentPromise_A = TwoMonthsLockupContract.new(stblToken.address, A, nearlyTwoMonths, { from: liquityAG })
      const LCDeploymentPromise_B = TwoMonthsLockupContract.new(stblToken.address, B, '37', { from: B })
      const LCDeploymentPromise_C = TwoMonthsLockupContract.new(stblToken.address, C, '43200', { from: J })
     
      // Deploy 3 LCs directly with unlockTime < 1 year from system deployment
      const LCDeploymentPromise_D = SixMonthsLockupContract.new(stblToken.address, A, nearlySixMonths, { from: liquityAG })
      const LCDeploymentPromise_E = SixMonthsLockupContract.new(stblToken.address, B, '37', { from: E })
      const LCDeploymentPromise_F = SixMonthsLockupContract.new(stblToken.address, C, '43200', { from: K })

                  // Deploy 3 LCs directly with unlockTime < 1 year from system deployment
      const LCDeploymentPromise_G = OneYearLockupContract.new(stblToken.address, A, nearlyOneYear, { from: liquityAG })
      const LCDeploymentPromise_H = OneYearLockupContract.new(stblToken.address, B, '37', { from: H })
      const LCDeploymentPromise_I = OneYearLockupContract.new(stblToken.address, C, '43200', { from: L })

      // Confirm contract deployments revert
      await assertRevert(LCDeploymentPromise_A, "LockupContract: unlock time must be at least two months after system deployment")
      await assertRevert(LCDeploymentPromise_B, "LockupContract: unlock time must be at least two months after system deployment")
      await assertRevert(LCDeploymentPromise_C, "LockupContract: unlock time must be at least two months after system deployment")

      // Confirm contract deployments revert
      await assertRevert(LCDeploymentPromise_D, "LockupContract: unlock time must be at least six months after system deployment")
      await assertRevert(LCDeploymentPromise_E, "LockupContract: unlock time must be at least six months after system deployment")
      await assertRevert(LCDeploymentPromise_F, "LockupContract: unlock time must be at least six months after system deployment")

      // Confirm contract deployments revert
      await assertRevert(LCDeploymentPromise_G, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(LCDeploymentPromise_H, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(LCDeploymentPromise_I, "LockupContract: unlock time must be at least one year after system deployment")
    })

  
  })

  describe('Funding LCs', async accounts => {
    it("STBL transfer from STBL deployer to their deployed LC increases the STBL balance of the LC", async () => {
      // Deploy 5 LCs
      const deployedLCtx_A = await lockupContractFactory.deployTwoMonthsLockupContract(A, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_B = await lockupContractFactory.deployTwoMonthsLockupContract(B, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_C = await lockupContractFactory.deployTwoMonthsLockupContract(C, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_D = await lockupContractFactory.deployTwoMonthsLockupContract(D, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_E = await lockupContractFactory.deployTwoMonthsLockupContract(E, twoMonthsFromSystemDeployment, { from: liquityAG })

      // Deploy 5 LCs
      const deployedLCtx_F = await lockupContractFactory.deploySixMonthsLockupContract(F, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_G = await lockupContractFactory.deploySixMonthsLockupContract(G, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_H = await lockupContractFactory.deploySixMonthsLockupContract(H, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_I = await lockupContractFactory.deploySixMonthsLockupContract(I, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_J = await lockupContractFactory.deploySixMonthsLockupContract(J, sixMonthsFromSystemDeployment, { from: liquityAG })

      // Deploy 5 LCs
      const deployedLCtx_K = await lockupContractFactory.deployOneYearLockupContract(K, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_L = await lockupContractFactory.deployOneYearLockupContract(L, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_M = await lockupContractFactory.deployOneYearLockupContract(M, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_N = await lockupContractFactory.deployOneYearLockupContract(N, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_O = await lockupContractFactory.deployOneYearLockupContract(O, oneYearFromSystemDeployment, { from: liquityAG })      

      // Grab contract addresses from deployment tx events
      const LCAddress_A = await th.getLCAddressFromDeploymentTx(deployedLCtx_A)
      const LCAddress_B = await th.getLCAddressFromDeploymentTx(deployedLCtx_B)
      const LCAddress_C = await th.getLCAddressFromDeploymentTx(deployedLCtx_C)
      const LCAddress_D = await th.getLCAddressFromDeploymentTx(deployedLCtx_D)
      const LCAddress_E = await th.getLCAddressFromDeploymentTx(deployedLCtx_E)

      // Grab contract addresses from deployment tx events
      const LCAddress_F = await th.getLCAddressFromDeploymentTx(deployedLCtx_F)
      const LCAddress_G = await th.getLCAddressFromDeploymentTx(deployedLCtx_G)
      const LCAddress_H = await th.getLCAddressFromDeploymentTx(deployedLCtx_H)
      const LCAddress_I = await th.getLCAddressFromDeploymentTx(deployedLCtx_I)
      const LCAddress_J = await th.getLCAddressFromDeploymentTx(deployedLCtx_J)

      // Grab contract addresses from deployment tx events
      const LCAddress_K = await th.getLCAddressFromDeploymentTx(deployedLCtx_K)
      const LCAddress_L = await th.getLCAddressFromDeploymentTx(deployedLCtx_L)
      const LCAddress_M = await th.getLCAddressFromDeploymentTx(deployedLCtx_M)
      const LCAddress_N = await th.getLCAddressFromDeploymentTx(deployedLCtx_N)
      const LCAddress_O = await th.getLCAddressFromDeploymentTx(deployedLCtx_O)

      assert.equal(await stblToken.balanceOf(LCAddress_A), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_B), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_C), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_D), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_E), '0')

      assert.equal(await stblToken.balanceOf(LCAddress_F), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_G), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_H), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_I), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_J), '0')

      assert.equal(await stblToken.balanceOf(LCAddress_K), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_L), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_M), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_N), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_O), '0')

      // Multisig transfers STBL to each LC
      await stblToken.transfer(LCAddress_A, STBLEntitlement_A, { from: momentZeroMultisig })
      await stblToken.transfer(LCAddress_B, STBLEntitlement_B, { from: momentZeroMultisig })
      await stblToken.transfer(LCAddress_C, STBLEntitlement_C, { from: momentZeroMultisig })
      await stblToken.transfer(LCAddress_D, STBLEntitlement_D, { from: momentZeroMultisig })
      await stblToken.transfer(LCAddress_E, STBLEntitlement_E, { from: momentZeroMultisig })

      // Multisig transfers STBL to each LC
      await stblToken.transfer(LCAddress_F, STBLEntitlement_F, { from: sixMonthsMultisig })
      await stblToken.transfer(LCAddress_G, STBLEntitlement_G, { from: sixMonthsMultisig })
      await stblToken.transfer(LCAddress_H, STBLEntitlement_H, { from: sixMonthsMultisig })
      await stblToken.transfer(LCAddress_I, STBLEntitlement_I, { from: sixMonthsMultisig })
      await stblToken.transfer(LCAddress_J, STBLEntitlement_J, { from: sixMonthsMultisig })

      // Multisig transfers STBL to each LC
      await stblToken.transfer(LCAddress_K, STBLEntitlement_K, { from: oneYearMultisig })
      await stblToken.transfer(LCAddress_L, STBLEntitlement_L, { from: oneYearMultisig })
      await stblToken.transfer(LCAddress_M, STBLEntitlement_M, { from: oneYearMultisig })
      await stblToken.transfer(LCAddress_N, STBLEntitlement_N, { from: oneYearMultisig })
      await stblToken.transfer(LCAddress_O, STBLEntitlement_O, { from: oneYearMultisig })

      assert.equal(await stblToken.balanceOf(LCAddress_A), STBLEntitlement_A)
      assert.equal(await stblToken.balanceOf(LCAddress_B), STBLEntitlement_B)
      assert.equal(await stblToken.balanceOf(LCAddress_C), STBLEntitlement_C)
      assert.equal(await stblToken.balanceOf(LCAddress_D), STBLEntitlement_D)
      assert.equal(await stblToken.balanceOf(LCAddress_E), STBLEntitlement_E)

      assert.equal(await stblToken.balanceOf(LCAddress_F), STBLEntitlement_F)
      assert.equal(await stblToken.balanceOf(LCAddress_G), STBLEntitlement_G)
      assert.equal(await stblToken.balanceOf(LCAddress_H), STBLEntitlement_H)
      assert.equal(await stblToken.balanceOf(LCAddress_I), STBLEntitlement_I)
      assert.equal(await stblToken.balanceOf(LCAddress_J), STBLEntitlement_J)

      assert.equal(await stblToken.balanceOf(LCAddress_K), STBLEntitlement_K)
      assert.equal(await stblToken.balanceOf(LCAddress_L), STBLEntitlement_L)
      assert.equal(await stblToken.balanceOf(LCAddress_M), STBLEntitlement_M)
      assert.equal(await stblToken.balanceOf(LCAddress_N), STBLEntitlement_N)
      assert.equal(await stblToken.balanceOf(LCAddress_O), STBLEntitlement_O)
    })

    it("STBL Multisig can transfer STBL to LCs deployed through the factory by anyone", async () => {
      // Various accts deploy 5 LCs
      const deployedLCtx_A = await lockupContractFactory.deployTwoMonthsLockupContract(A, twoMonthsFromSystemDeployment, { from: F })
      const deployedLCtx_B = await lockupContractFactory.deployTwoMonthsLockupContract(B, twoMonthsFromSystemDeployment, { from: G })
      const deployedLCtx_C = await lockupContractFactory.deployTwoMonthsLockupContract(C, twoMonthsFromSystemDeployment, { from: H })
      const deployedLCtx_D = await lockupContractFactory.deployTwoMonthsLockupContract(D, twoMonthsFromSystemDeployment, { from: I })
      const deployedLCtx_E = await lockupContractFactory.deployTwoMonthsLockupContract(E, twoMonthsFromSystemDeployment, { from: J })

      // Various accts deploy 5 LCs
      const deployedLCtx_F = await lockupContractFactory.deploySixMonthsLockupContract(F, sixMonthsFromSystemDeployment, { from: K })
      const deployedLCtx_G = await lockupContractFactory.deploySixMonthsLockupContract(G, sixMonthsFromSystemDeployment, { from: L })
      const deployedLCtx_H = await lockupContractFactory.deploySixMonthsLockupContract(H, sixMonthsFromSystemDeployment, { from: M })
      const deployedLCtx_I = await lockupContractFactory.deploySixMonthsLockupContract(I, sixMonthsFromSystemDeployment, { from: N })
      const deployedLCtx_J = await lockupContractFactory.deploySixMonthsLockupContract(J, sixMonthsFromSystemDeployment, { from: O })

      // Various accts deploy 5 LCs
      const deployedLCtx_K = await lockupContractFactory.deployOneYearLockupContract(K, oneYearFromSystemDeployment, { from: A })
      const deployedLCtx_L = await lockupContractFactory.deployOneYearLockupContract(L, oneYearFromSystemDeployment, { from: B })
      const deployedLCtx_M = await lockupContractFactory.deployOneYearLockupContract(M, oneYearFromSystemDeployment, { from: C })
      const deployedLCtx_N = await lockupContractFactory.deployOneYearLockupContract(N, oneYearFromSystemDeployment, { from: D })
      const deployedLCtx_O = await lockupContractFactory.deployOneYearLockupContract(O, oneYearFromSystemDeployment, { from: E })    

      // Grab contract addresses from deployment tx events
      const LCAddress_A = await th.getLCAddressFromDeploymentTx(deployedLCtx_A)
      const LCAddress_B = await th.getLCAddressFromDeploymentTx(deployedLCtx_B)
      const LCAddress_C = await th.getLCAddressFromDeploymentTx(deployedLCtx_C)
      const LCAddress_D = await th.getLCAddressFromDeploymentTx(deployedLCtx_D)
      const LCAddress_E = await th.getLCAddressFromDeploymentTx(deployedLCtx_E)

      // Grab contract addresses from deployment tx events
      const LCAddress_F = await th.getLCAddressFromDeploymentTx(deployedLCtx_F)
      const LCAddress_G = await th.getLCAddressFromDeploymentTx(deployedLCtx_G)
      const LCAddress_H = await th.getLCAddressFromDeploymentTx(deployedLCtx_H)
      const LCAddress_I = await th.getLCAddressFromDeploymentTx(deployedLCtx_I)
      const LCAddress_J = await th.getLCAddressFromDeploymentTx(deployedLCtx_J)

      // Grab contract addresses from deployment tx events
      const LCAddress_K = await th.getLCAddressFromDeploymentTx(deployedLCtx_K)
      const LCAddress_L = await th.getLCAddressFromDeploymentTx(deployedLCtx_L)
      const LCAddress_M = await th.getLCAddressFromDeploymentTx(deployedLCtx_M)
      const LCAddress_N = await th.getLCAddressFromDeploymentTx(deployedLCtx_N)
      const LCAddress_O = await th.getLCAddressFromDeploymentTx(deployedLCtx_O)

      assert.equal(await stblToken.balanceOf(LCAddress_A), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_B), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_C), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_D), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_E), '0')

      assert.equal(await stblToken.balanceOf(LCAddress_F), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_G), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_H), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_I), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_J), '0')

      assert.equal(await stblToken.balanceOf(LCAddress_K), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_L), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_M), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_N), '0')
      assert.equal(await stblToken.balanceOf(LCAddress_O), '0')

      // Multisig transfers STBL to each LC
      await stblToken.transfer(LCAddress_A, dec(1, 18), { from: momentZeroMultisig })
      await stblToken.transfer(LCAddress_B, dec(2, 18), { from: momentZeroMultisig })
      await stblToken.transfer(LCAddress_C, dec(3, 18), { from: momentZeroMultisig })
      await stblToken.transfer(LCAddress_D, dec(4, 18), { from: momentZeroMultisig })
      await stblToken.transfer(LCAddress_E, dec(5, 18), { from: momentZeroMultisig })

      // Multisig transfers STBL to each LC
      await stblToken.transfer(LCAddress_F, dec(6, 18), { from: sixMonthsMultisig })
      await stblToken.transfer(LCAddress_G, dec(7, 18), { from: sixMonthsMultisig })
      await stblToken.transfer(LCAddress_H, dec(8, 18), { from: sixMonthsMultisig })
      await stblToken.transfer(LCAddress_I, dec(9, 18), { from: sixMonthsMultisig })
      await stblToken.transfer(LCAddress_J, dec(10, 18), { from: sixMonthsMultisig })

      // Multisig transfers STBL to each LC
      await stblToken.transfer(LCAddress_K, dec(11, 18), { from: oneYearMultisig })
      await stblToken.transfer(LCAddress_L, dec(12, 18), { from: oneYearMultisig })
      await stblToken.transfer(LCAddress_M, dec(13, 18), { from: oneYearMultisig })
      await stblToken.transfer(LCAddress_N, dec(14, 18), { from: oneYearMultisig })
      await stblToken.transfer(LCAddress_O, dec(15, 18), { from: oneYearMultisig })

      assert.equal(await stblToken.balanceOf(LCAddress_A), dec(1, 18))
      assert.equal(await stblToken.balanceOf(LCAddress_B), dec(2, 18))
      assert.equal(await stblToken.balanceOf(LCAddress_C), dec(3, 18))
      assert.equal(await stblToken.balanceOf(LCAddress_D), dec(4, 18))
      assert.equal(await stblToken.balanceOf(LCAddress_E), dec(5, 18))

      assert.equal(await stblToken.balanceOf(LCAddress_F), dec(6, 18))
      assert.equal(await stblToken.balanceOf(LCAddress_G), dec(7, 18))
      assert.equal(await stblToken.balanceOf(LCAddress_H), dec(8, 18))
      assert.equal(await stblToken.balanceOf(LCAddress_I), dec(9, 18))
      assert.equal(await stblToken.balanceOf(LCAddress_J), dec(10, 18))

      assert.equal(await stblToken.balanceOf(LCAddress_K), dec(11, 18))
      assert.equal(await stblToken.balanceOf(LCAddress_L), dec(12, 18))
      assert.equal(await stblToken.balanceOf(LCAddress_M), dec(13, 18))
      assert.equal(await stblToken.balanceOf(LCAddress_N), dec(14, 18))
      assert.equal(await stblToken.balanceOf(LCAddress_O), dec(15, 18))
    })

    // can't transfer STBL to any LCs that were deployed directly
  })

  describe('Withdrawal attempts on funded, inactive LCs immediately after funding', async accounts => {
    it("Beneficiary can't withdraw from their funded LC", async () => {
      // Deploy 3 LCs
      const deployedLCtx_A = await lockupContractFactory.deployTwoMonthsLockupContract(A, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_B = await lockupContractFactory.deployTwoMonthsLockupContract(B, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_C = await lockupContractFactory.deployTwoMonthsLockupContract(C, twoMonthsFromSystemDeployment, { from: liquityAG })

      // Deploy 3 LCs
      const deployedLCtx_D = await lockupContractFactory.deploySixMonthsLockupContract(D, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_E = await lockupContractFactory.deploySixMonthsLockupContract(E, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_F = await lockupContractFactory.deploySixMonthsLockupContract(F, sixMonthsFromSystemDeployment, { from: liquityAG })

      // Deploy 3 LCs
      const deployedLCtx_G = await lockupContractFactory.deployOneYearLockupContract(G, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_H = await lockupContractFactory.deployOneYearLockupContract(H, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_I = await lockupContractFactory.deployOneYearLockupContract(I, oneYearFromSystemDeployment, { from: liquityAG })

      // Grab contract objects from deployment tx events
      const LC_A = await th.getLCFromDeploymentTx(deployedLCtx_A)
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)
      const LC_C = await th.getLCFromDeploymentTx(deployedLCtx_C)

      // Grab contract objects from deployment tx events
      const LC_D = await th.getLCFromDeploymentTx(deployedLCtx_D)
      const LC_E = await th.getLCFromDeploymentTx(deployedLCtx_E)
      const LC_F = await th.getLCFromDeploymentTx(deployedLCtx_F)

      // Grab contract objects from deployment tx events
      const LC_G = await th.getLCFromDeploymentTx(deployedLCtx_G)
      const LC_H = await th.getLCFromDeploymentTx(deployedLCtx_H)
      const LC_I = await th.getLCFromDeploymentTx(deployedLCtx_I)

      // Multisig transfers STBL to each LC
      await stblToken.transfer(LC_A.address, STBLEntitlement_A, { from: momentZeroMultisig })
      await stblToken.transfer(LC_B.address, STBLEntitlement_B, { from: momentZeroMultisig })
      await stblToken.transfer(LC_C.address, STBLEntitlement_C, { from: momentZeroMultisig })

      // Multisig transfers STBL to each LC
      await stblToken.transfer(LC_D.address, STBLEntitlement_D, { from: sixMonthsMultisig })
      await stblToken.transfer(LC_E.address, STBLEntitlement_E, { from: sixMonthsMultisig })
      await stblToken.transfer(LC_F.address, STBLEntitlement_F, { from: sixMonthsMultisig })

      // Multisig transfers STBL to each LC
      await stblToken.transfer(LC_G.address, STBLEntitlement_G, { from: oneYearMultisig })
      await stblToken.transfer(LC_H.address, STBLEntitlement_H, { from: oneYearMultisig })
      await stblToken.transfer(LC_I.address, STBLEntitlement_I, { from: oneYearMultisig })

      assert.equal(await stblToken.balanceOf(LC_A.address), STBLEntitlement_A)
      assert.equal(await stblToken.balanceOf(LC_B.address), STBLEntitlement_B)
      assert.equal(await stblToken.balanceOf(LC_C.address), STBLEntitlement_C)

      assert.equal(await stblToken.balanceOf(LC_D.address), STBLEntitlement_D)
      assert.equal(await stblToken.balanceOf(LC_E.address), STBLEntitlement_E)
      assert.equal(await stblToken.balanceOf(LC_F.address), STBLEntitlement_F)

      assert.equal(await stblToken.balanceOf(LC_G.address), STBLEntitlement_G)
      assert.equal(await stblToken.balanceOf(LC_H.address), STBLEntitlement_H)
      assert.equal(await stblToken.balanceOf(LC_I.address), STBLEntitlement_I)

      const LCs = [LC_A, LC_B, LC_C, LC_D, LC_E, LC_F, LC_G, LC_H, LC_I]

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
      const deployedLCtx_A = await lockupContractFactory.deployTwoMonthsLockupContract(A, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_B = await lockupContractFactory.deployTwoMonthsLockupContract(B, twoMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_C = await lockupContractFactory.deployTwoMonthsLockupContract(C, twoMonthsFromSystemDeployment, { from: liquityAG })

      // Deploy 3 LCs
      const deployedLCtx_D = await lockupContractFactory.deploySixMonthsLockupContract(D, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_E = await lockupContractFactory.deploySixMonthsLockupContract(E, sixMonthsFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_F = await lockupContractFactory.deploySixMonthsLockupContract(F, sixMonthsFromSystemDeployment, { from: liquityAG })

      // Deploy 3 LCs
      const deployedLCtx_G = await lockupContractFactory.deployOneYearLockupContract(G, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_H = await lockupContractFactory.deployOneYearLockupContract(H, oneYearFromSystemDeployment, { from: liquityAG })
      const deployedLCtx_I = await lockupContractFactory.deployOneYearLockupContract(I, oneYearFromSystemDeployment, { from: liquityAG })

      // Grab contract objects from deployment tx events
      const LC_A = await th.getLCFromDeploymentTx(deployedLCtx_A)
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)
      const LC_C = await th.getLCFromDeploymentTx(deployedLCtx_C)

      // Grab contract objects from deployment tx events
      const LC_D = await th.getLCFromDeploymentTx(deployedLCtx_D)
      const LC_E = await th.getLCFromDeploymentTx(deployedLCtx_E)
      const LC_F = await th.getLCFromDeploymentTx(deployedLCtx_F)

      // Grab contract objects from deployment tx events
      const LC_G = await th.getLCFromDeploymentTx(deployedLCtx_G)
      const LC_H = await th.getLCFromDeploymentTx(deployedLCtx_H)
      const LC_I = await th.getLCFromDeploymentTx(deployedLCtx_I)

      // Multisig transfers STBL to each LC
      await stblToken.transfer(LC_A.address, STBLEntitlement_A, { from: momentZeroMultisig })
      await stblToken.transfer(LC_B.address, STBLEntitlement_B, { from: momentZeroMultisig })
      await stblToken.transfer(LC_C.address, STBLEntitlement_C, { from: momentZeroMultisig })

      // Multisig transfers STBL to each LC
      await stblToken.transfer(LC_D.address, STBLEntitlement_D, { from: sixMonthsMultisig })
      await stblToken.transfer(LC_E.address, STBLEntitlement_E, { from: sixMonthsMultisig })
      await stblToken.transfer(LC_F.address, STBLEntitlement_F, { from: sixMonthsMultisig })

      // Multisig transfers STBL to each LC
      await stblToken.transfer(LC_G.address, STBLEntitlement_G, { from: oneYearMultisig })
      await stblToken.transfer(LC_H.address, STBLEntitlement_H, { from: oneYearMultisig })
      await stblToken.transfer(LC_I.address, STBLEntitlement_I, { from: oneYearMultisig })

      assert.equal(await stblToken.balanceOf(LC_A.address), STBLEntitlement_A)
      assert.equal(await stblToken.balanceOf(LC_B.address), STBLEntitlement_B)
      assert.equal(await stblToken.balanceOf(LC_C.address), STBLEntitlement_C)

      assert.equal(await stblToken.balanceOf(LC_D.address), STBLEntitlement_D)
      assert.equal(await stblToken.balanceOf(LC_E.address), STBLEntitlement_E)
      assert.equal(await stblToken.balanceOf(LC_F.address), STBLEntitlement_F)

      assert.equal(await stblToken.balanceOf(LC_G.address), STBLEntitlement_G)
      assert.equal(await stblToken.balanceOf(LC_H.address), STBLEntitlement_H)
      assert.equal(await stblToken.balanceOf(LC_I.address), STBLEntitlement_I)

      const LCs = [LC_A, LC_B, LC_C, LC_D, LC_E, LC_F, LC_G, LC_H, LC_I]

      // STBL multisig attempts to withdraw from LCs
      for (LC of LCs) {
        try {
          const withdrawalAttemptTx = await LC.withdrawSTBL({ from: momentZeroMultisig })
          assert.isFalse(withdrawalAttemptTx.receipt.status)
        } catch (error) {
          assert.include(error.message, "revert")
        }

        try {
          const withdrawalAttemptTx = await LC.withdrawSTBL({ from: sixMonthsMultisig })
          assert.isFalse(withdrawalAttemptTx.receipt.status)
        } catch (error) {
          assert.include(error.message, "revert")
        }

        try {
          const withdrawalAttemptTx = await LC.withdrawSTBL({ from: oneYearMultisig })
          assert.isFalse(withdrawalAttemptTx.receipt.status)
        } catch (error) {
          assert.include(error.message, "revert")
        }
      }
    })

    it("No one can withraw from a LC", async () => {
      // Deploy 3 LCs
      const deployedLCtx_A = await lockupContractFactory.deployTwoMonthsLockupContract(A, twoMonthsFromSystemDeployment, { from: D })
      const deployedLCtx_B = await lockupContractFactory.deploySixMonthsLockupContract(D, sixMonthsFromSystemDeployment, { from: E })
      const deployedLCtx_C = await lockupContractFactory.deployOneYearLockupContract(A, oneYearFromSystemDeployment, { from: F })

      // Grab contract objects from deployment tx events
      const LC_A = await th.getLCFromDeploymentTx(deployedLCtx_A)
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)
      const LC_C = await th.getLCFromDeploymentTx(deployedLCtx_C)

      // LiquityAG transfers STBL to the LC
      await stblToken.transfer(LC_A.address, STBLEntitlement_A, { from: momentZeroMultisig })
      await stblToken.transfer(LC_B.address, STBLEntitlement_B, { from: sixMonthsMultisig })
      await stblToken.transfer(LC_C.address, STBLEntitlement_C, { from: oneYearMultisig })

      assert.equal(await stblToken.balanceOf(LC_A.address), STBLEntitlement_A)
      assert.equal(await stblToken.balanceOf(LC_B.address), STBLEntitlement_B)
      assert.equal(await stblToken.balanceOf(LC_C.address), STBLEntitlement_C)

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

      try {
        const withdrawalAttemptTx = await LC_B.withdrawSTBL({ from: G })
        assert.isFalse(withdrawalAttemptTx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      try {
        const withdrawalAttemptTx = await LC_B.withdrawSTBL({ from: H })
        assert.isFalse(withdrawalAttemptTx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      try {
        const withdrawalAttemptTx = await LC_B.withdrawSTBL({ from: I })
        assert.isFalse(withdrawalAttemptTx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      try {
        const withdrawalAttemptTx = await LC_C.withdrawSTBL({ from: G })
        assert.isFalse(withdrawalAttemptTx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      try {
        const withdrawalAttemptTx = await LC_C.withdrawSTBL({ from: H })
        assert.isFalse(withdrawalAttemptTx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      try {
        const withdrawalAttemptTx = await LC_C.withdrawSTBL({ from: I })
        assert.isFalse(withdrawalAttemptTx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })
  })
})
