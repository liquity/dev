const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants")
const deploymentHelper = require("../../utils/deploymentHelpers.js")
const { TestHelper: th, MoneyValues: mv } = require("../../utils/testHelpers.js")

const GasPool = artifacts.require("./GasPool.sol")
const VestaParameters = artifacts.require("./VestaParameters.sol")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")

contract('All Liquity functions with onlyOwner modifier', async accounts => {

  const [owner, alice, bob] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig, treasury] = accounts.slice(996, 1000)

  let contracts
  let vstToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let stabilityPoolManager
  let defaultPool
  let borrowerOperations

  let vstaStaking
  let communityIssuance
  let vstaToken
  let adminContract

  before(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.borrowerOperations = await BorrowerOperationsTester.new()
    contracts = await deploymentHelper.deployVSTToken(contracts)
    const VSTAContracts = await deploymentHelper.deployVSTAContractsHardhat(accounts[0])

    vstToken = contracts.vstToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPoolTemplate
    stabilityPoolManager = contracts.stabilityPoolManager
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    adminContract = contracts.adminContract

    vstaStaking = VSTAContracts.vstaStaking
    communityIssuance = VSTAContracts.communityIssuance
    vstaToken = VSTAContracts.vstaToken
  })

  const testZeroAddress = async (contract, params, method = 'setAddresses', skip = 1, offset = 0) => {
    await testWrongAddress(contract, params, th.ZERO_ADDRESS, method, skip, offset, 'Account cannot be zero address')
  }
  const testNonContractAddress = async (contract, params, method = 'setAddresses', skip = 1, offset = 0) => {
    await testWrongAddress(contract, params, bob, method, skip, 'Account code size cannot be zero')
  }
  const testWrongAddress = async (contract, params, address, method, skip, offset, message) => {
    for (let i = skip; i < params.length - offset; i++) {
      const newParams = [...params]
      newParams[i] = address
      await th.assertRevert(contract[method](...newParams, { from: owner }), message)
    }
  }

  const testSetAddresses = async (contract, numberOfAddresses, useVaultParams) => {
    const dumbContract = await GasPool.new()
    const params = Array(numberOfAddresses).fill(dumbContract.address)

    const v = await VestaParameters.new();
    await v.sanitizeParameters(params[0]);

    if (useVaultParams) {
      params[params.length - 2] = communityIssuance.address;
      params[params.length - 1] = v.address;
    }

    // Attempt to use zero address
    await testZeroAddress(contract, params)
    // Attempt to use non contract
    await testNonContractAddress(contract, params)

    // Owner can successfully set any address
    const txOwner = await contract.setAddresses(...params, { from: owner })
    assert.isTrue(txOwner.receipt.status)
    // fails if called twice
    await th.assertRevert(contract.setAddresses(...params, { from: owner }))
  }

  describe('TroveManager', async accounts => {
    it("setAddresses(): reverts when called by non-owner, with wrong addresses, or twice", async () => {
      await testSetAddresses(troveManager, 8, true)
    })
  })

  describe('BorrowerOperations', async accounts => {
    it("setAddresses(): reverts when called by non-owner, with wrong addresses, or twice", async () => {
      await testSetAddresses(borrowerOperations, 8, true)
    })
  })

  describe('DefaultPool', async accounts => {
    it("setAddresses(): reverts when called by non-owner, with wrong addresses, or twice", async () => {
      await testSetAddresses(defaultPool, 2)
    })
  })

  describe('StabilityPool', async accounts => {
    it("setAddresses(): reverts when called by non-owner, with wrong addresses, or twice", async () => {
      await testSetAddresses(stabilityPool, 7, true)
    })
  })

  describe('ActivePool', async accounts => {
    it("setAddresses(): reverts when called by non-owner, with wrong addresses, or twice", async () => {
      await testSetAddresses(activePool, 5)
    })
  })

  describe('SortedTroves', async accounts => {
    it("setParams(): reverts when called by non-owner, with wrong addresses, or twice", async () => {
      const dumbContract = await GasPool.new()
      const params = [dumbContract.address, dumbContract.address]

      // Attempt to use zero address
      await testZeroAddress(sortedTroves, params, 'setParams', 1)
      // Attempt to use non contract
      await testNonContractAddress(sortedTroves, params, 'setParams', 1)

      // Owner can successfully set params
      const txOwner = await sortedTroves.setParams(...params, { from: owner })
      assert.isTrue(txOwner.receipt.status)

      // fails if called twice
      await th.assertRevert(sortedTroves.setParams(...params, { from: owner }))
    })
  })

  describe('CommunityIssuance', async accounts => {
    it("setAddresses(): reverts when called by non-owner, with wrong addresses, or twice", async () => {
      const params = [vstaToken.address, stabilityPoolManager.address, adminContract.address]

      // Attempt to use zero address
      await testZeroAddress(communityIssuance, params)
      // Attempt to use non contract
      await testNonContractAddress(communityIssuance, params)

      // Owner can successfully set any address
      const txOwner = await communityIssuance.setAddresses(...params, { from: owner })

      assert.isTrue(txOwner.receipt.status)
      // fails if called twice
      await th.assertRevert(communityIssuance.setAddresses(...params, { from: owner }))
    })
  })

  describe('VSTAStaking', async accounts => {
    it("setAddresses(): reverts when called by non-owner, with wrong addresses, or twice", async () => {
      await testSetAddresses(vstaStaking, 6)
    })
  })
})

