const deploymentHelper = require("../../utils/deploymentHelpers.js")
const StabilityPool = artifacts.require('StabilityPool.sol')
const testHelpers = require("../../utils/testHelpers.js")
const th = testHelpers.TestHelper

contract('Deployment script - Sets correct contract addresses dependencies after deployment', async accounts => {
  const [owner] = accounts;
  const ZERO_ADDRESS = th.ZERO_ADDRESS

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let priceFeed
  let vstToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let stabilityPoolManager
  let defaultPool
  let functionCaller
  let borrowerOperations
  let vstaStaking
  let vstaToken
  let communityIssuance
  let vestaParameters

  before(async () => {
    const coreContracts = await deploymentHelper.deployLiquityCore()
    const VSTAContracts = await deploymentHelper.deployVSTAContractsHardhat(accounts[0])

    priceFeed = coreContracts.priceFeedTestnet
    vstToken = coreContracts.vstToken
    sortedTroves = coreContracts.sortedTroves
    troveManager = coreContracts.troveManager
    activePool = coreContracts.activePool
    stabilityPoolManager = coreContracts.stabilityPoolManager
    defaultPool = coreContracts.defaultPool
    functionCaller = coreContracts.functionCaller
    borrowerOperations = coreContracts.borrowerOperations
    vestaParameters = coreContracts.vestaParameters

    vstaStaking = VSTAContracts.vstaStaking
    vstaToken = VSTAContracts.vstaToken
    communityIssuance = VSTAContracts.communityIssuance

    await deploymentHelper.connectCoreContracts(coreContracts, VSTAContracts)
    await deploymentHelper.connectVSTAContractsToCore(VSTAContracts, coreContracts)
    stabilityPool = await StabilityPool.at(await coreContracts.stabilityPoolManager.getAssetStabilityPool(ZERO_ADDRESS))
  })

  it('Check if correct Addresses in Vault Parameters', async () => {
    assert.equal(priceFeed.address, await vestaParameters.priceFeed())
    assert.equal(activePool.address, await vestaParameters.activePool())
    assert.equal(defaultPool.address, await vestaParameters.defaultPool())
  })

  it('Sets the correct vestaParams address in TroveManager', async () => {
    assert.equal(vestaParameters.address, await troveManager.vestaParams());
  })

  it('Sets the correct VSTToken address in TroveManager', async () => {
    const VSTTokenAddress = vstToken.address

    const recordedClvTokenAddress = await troveManager.vstToken()

    assert.equal(VSTTokenAddress, recordedClvTokenAddress)
  })

  it('Sets the correct SortedTroves address in TroveManager', async () => {
    const sortedTrovesAddress = sortedTroves.address

    const recordedSortedTrovesAddress = await troveManager.sortedTroves()

    assert.equal(sortedTrovesAddress, recordedSortedTrovesAddress)
  })

  it('Sets the correct BorrowerOperations address in TroveManager', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await troveManager.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct StabilityPool address in TroveManager', async () => {
    assert.equal(stabilityPoolManager.address, await troveManager.stabilityPoolManager())
  })

  it('Sets the correct VSTAStaking address in TroveManager', async () => {
    const VSTAStakingAddress = vstaStaking.address

    const recordedVSTAStakingAddress = await troveManager.vstaStaking()
    assert.equal(VSTAStakingAddress, recordedVSTAStakingAddress)
  })

  // Active Pool
  it('Sets the correct StabilityPool address in ActivePool', async () => {
    assert.equal(stabilityPoolManager.address, await activePool.stabilityPoolManager())
  })

  it('Sets the correct DefaultPool address in ActivePool', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await activePool.defaultPool()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  it('Sets the correct BorrowerOperations address in ActivePool', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await activePool.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct TroveManager address in ActivePool', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await activePool.troveManagerAddress()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // Stability Pool
  it('Sets the correct BorrowerOperations address in StabilityPool', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await stabilityPool.borrowerOperations()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct VSTToken address in StabilityPool', async () => {
    const VSTTokenAddress = vstToken.address

    const recordedClvTokenAddress = await stabilityPool.vstToken()

    assert.equal(VSTTokenAddress, recordedClvTokenAddress)
  })

  it('Sets the correct TroveManager address in StabilityPool', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await stabilityPool.troveManager()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // Default Pool

  it('Sets the correct TroveManager address in DefaultPool', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await defaultPool.troveManagerAddress()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  it('Sets the correct ActivePool address in DefaultPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await defaultPool.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('Sets the correct TroveManager address in SortedTroves', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await sortedTroves.borrowerOperationsAddress()
    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct BorrowerOperations address in SortedTroves', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await sortedTroves.troveManager()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  //--- BorrowerOperations ---

  it('Sets the correct VestaParameters address in BorrowerOperations', async () => {
    assert.equal(vestaParameters.address, await borrowerOperations.vestaParams())
  })

  // TroveManager in BO
  it('Sets the correct TroveManager address in BorrowerOperations', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await borrowerOperations.troveManager()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // setSortedTroves in BO
  it('Sets the correct SortedTroves address in BorrowerOperations', async () => {
    const sortedTrovesAddress = sortedTroves.address

    const recordedSortedTrovesAddress = await borrowerOperations.sortedTroves()
    assert.equal(sortedTrovesAddress, recordedSortedTrovesAddress)
  })

  // VSTA Staking in BO
  it('Sets the correct VSTAStaking address in BorrowerOperations', async () => {
    const VSTAStakingAddress = vstaStaking.address

    const recordedVSTAStakingAddress = await borrowerOperations.VSTAStakingAddress()
    assert.equal(VSTAStakingAddress, recordedVSTAStakingAddress)
  })


  // --- VSTA Staking ---

  // Sets VSTAToken in VSTAStaking
  it('Sets the correct VSTAToken address in VSTAStaking', async () => {
    const VSTATokenAddress = vstaToken.address

    const recordedVSTATokenAddress = await vstaStaking.vstaToken()
    assert.equal(VSTATokenAddress, recordedVSTATokenAddress)
  })

  // Sets ActivePool in VSTAStaking
  it('Sets the correct ActivePool address in VSTAStaking', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await vstaStaking.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  // Sets VSTToken in VSTAStaking
  it('Sets the correct ActivePool address in VSTAStaking', async () => {
    const VSTTokenAddress = vstToken.address

    const recordedVSTTokenAddress = await vstaStaking.vstToken()
    assert.equal(VSTTokenAddress, recordedVSTTokenAddress)
  })

  // Sets TroveManager in VSTAStaking
  it('Sets the correct ActivePool address in VSTAStaking', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await vstaStaking.troveManagerAddress()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // Sets BorrowerOperations in VSTAStaking
  it('Sets the correct BorrowerOperations address in VSTAStaking', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await vstaStaking.borrowerOperationsAddress()
    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  // ---  VSTAToken ---

  // --- CI ---
  // Sets VSTAToken in CommunityIssuance
  it('Sets the correct VSTAToken address in CommunityIssuance', async () => {
    const VSTATokenAddress = vstaToken.address

    const recordedVSTATokenAddress = await communityIssuance.vstaToken()
    assert.equal(VSTATokenAddress, recordedVSTATokenAddress)
  })

  it('Sets the correct StabilityPool address in CommunityIssuance', async () => {
    assert.equal(stabilityPoolManager.address, await communityIssuance.stabilityPoolManager())
  })
})
