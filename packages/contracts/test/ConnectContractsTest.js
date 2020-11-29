const deploymentHelper = require("../utils/deploymentHelpers.js")

contract('Deployment script - Sets correct contract addresses dependencies after deployment', async accounts => {
  const [owner] = accounts;
  let priceFeed
  let clvToken
  let sortedCDPs
  let cdpManager
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations
  let lqtyStaking
  let lqtyToken
  let communityIssuance
  let lockupContractFactory

  before(async () => {
    const coreContracts = await deploymentHelper.deployLiquityCore()
    const LQTYContracts = await deploymentHelper.deployLQTYContracts()

    priceFeed = coreContracts.priceFeed
    clvToken = coreContracts.clvToken
    sortedCDPs = coreContracts.sortedCDPs
    cdpManager = coreContracts.cdpManager
    activePool = coreContracts.activePool
    stabilityPool = coreContracts.stabilityPool
    defaultPool = coreContracts.defaultPool
    functionCaller = coreContracts.functionCaller
    borrowerOperations = coreContracts.borrowerOperations

    lqtyStaking = LQTYContracts.lqtyStaking
    lqtyToken = LQTYContracts.lqtyToken
    communityIssuance = LQTYContracts.communityIssuance
    lockupContractFactory = LQTYContracts.lockupContractFactory

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, coreContracts)
  })

  it('Sets the correct PriceFeed address in TroveManager', async () => {
    const priceFeedAddress = priceFeed.address

    const recordedPriceFeedAddress = await cdpManager.priceFeed()

    assert.equal(priceFeedAddress, recordedPriceFeedAddress)
  })

  it('Sets the correct CLVToken address in TroveManager', async () => {
    const clvTokenAddress = clvToken.address

    const recordedClvTokenAddress = await cdpManager.clvToken()

    assert.equal(clvTokenAddress, recordedClvTokenAddress)
  })

  it('Sets the correct SortedCDPs address in TroveManager', async () => {
    const sortedCDPsAddress = sortedCDPs.address

    const recordedSortedCDPsAddress = await cdpManager.sortedCDPs()

    assert.equal(sortedCDPsAddress, recordedSortedCDPsAddress)
  })

  it('Sets the correct BorrowerOperations address in TroveManager', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await cdpManager.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  // ActivePool in CDPM
  it('Sets the correct ActivePool address in TroveManager', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddresss = await cdpManager.activePool()

    assert.equal(activePoolAddress, recordedActivePoolAddresss)
  })

  // DefaultPool in CDPM
  it('Sets the correct DefaultPool address in TroveManager', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddresss = await cdpManager.defaultPool()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddresss)
  })

  // StabilityPool in CDPM
  it('Sets the correct StabilityPool address in TroveManager', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddresss = await cdpManager.stabilityPool()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddresss)
  })

  // LQTY Staking in CDPM
  it('Sets the correct LQTYStaking address in TroveManager', async () => {
    const lqtyStakingAddress = lqtyStaking.address

    const recordedLQTYStakingAddress = await cdpManager.lqtyStakingAddress()
    assert.equal(lqtyStakingAddress, recordedLQTYStakingAddress)
  })

  // Active Pool

  it('Sets the correct StabilityPool address in ActivePool', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await activePool.stabilityPoolAddress()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })

  it('Sets the correct DefaultPool address in ActivePool', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await activePool.defaultPoolAddress()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  it('Sets the correct BorrowerOperations address in ActivePool', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await activePool.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct TroveManager address in ActivePool', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedTroveManagerAddress = await activePool.cdpManagerAddress()
    assert.equal(cdpManagerAddress, recordedTroveManagerAddress)
  })

  // Stability Pool

  it('Sets the correct ActivePool address in StabilityPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await stabilityPool.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('Sets the correct BorrowerOperations address in StabilityPool', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await stabilityPool.borrowerOperations()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct CLVToken address in StabilityPool', async () => {
    const clvTokenAddress = clvToken.address

    const recordedClvTokenAddress = await stabilityPool.clvToken()

    assert.equal(clvTokenAddress, recordedClvTokenAddress)
  })

  it('Sets the correct TroveManager address in StabilityPool', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedTroveManagerAddress = await stabilityPool.cdpManager()
    assert.equal(cdpManagerAddress, recordedTroveManagerAddress)
  })

  // Default Pool

  it('Sets the correct TroveManager address in DefaultPool', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedTroveManagerAddress = await defaultPool.cdpManagerAddress()
    assert.equal(cdpManagerAddress, recordedTroveManagerAddress)
  })

  it('Sets the correct ActivePool address in DefaultPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await defaultPool.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('Sets the correct TroveManager address in SortedCDPs', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await sortedCDPs.borrowerOperationsAddress()
    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct BorrowerOperations address in SortedCDPs', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedTroveManagerAddress = await sortedCDPs.TroveManagerAddress()
    assert.equal(cdpManagerAddress, recordedTroveManagerAddress)
  })

  //--- BorrowerOperations ---

  // TroveManager in BO
  it('Sets the correct TroveManager address in BorrowerOperations', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedTroveManagerAddress = await borrowerOperations.cdpManager()
    assert.equal(cdpManagerAddress, recordedTroveManagerAddress)
  })

  // setPriceFeed in BO
  it('Sets the correct PriceFeed address in BorrowerOperations', async () => {
    const priceFeedAddress = priceFeed.address

    const recordedPriceFeedAddress = await borrowerOperations.priceFeed()
    assert.equal(priceFeedAddress, recordedPriceFeedAddress)
  })

  // setSortedCDPs in BO
  it('Sets the correct SortedCDPs address in BorrowerOperations', async () => {
    const sortedCDPsAddress = sortedCDPs.address

    const recordedSortedCDPsAddress = await borrowerOperations.sortedCDPs()
    assert.equal(sortedCDPsAddress, recordedSortedCDPsAddress)
  })

  // setActivePool in BO
  it('Sets the correct ActivePool address in BorrowerOperations', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await borrowerOperations.activePool()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  // setDefaultPool in BO
  it('Sets the correct DefaultPool address in BorrowerOperations', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await borrowerOperations.defaultPool()
    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  // LQTY Staking in BO
  it('Sets the correct LQTYStaking address in BorrowerOperations', async () => {
    const lqtyStakingAddress = lqtyStaking.address

    const recordedLQTYStakingAddress = await borrowerOperations.lqtyStakingAddress()
    assert.equal(lqtyStakingAddress, recordedLQTYStakingAddress)
  })


  // --- LQTY Staking ---

  // Sets LQTYToken in LQTYStaking
  it('Sets the correct LQTYToken address in LQTYStaking', async () => {
    const lqtyTokenAddress = lqtyToken.address

    const recordedLQTYTokenAddress = await lqtyStaking.lqtyToken()
    assert.equal(lqtyTokenAddress, recordedLQTYTokenAddress)
  })

  // Sets ActivePool in LQTYStaking
  it('Sets the correct ActivePool address in LQTYStaking', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await lqtyStaking.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  // Sets CLVToken in LQTYStaking
  it('Sets the correct ActivePool address in LQTYStaking', async () => {
    const clvTokenAddress = clvToken.address

    const recordedCLVTokenAddress = await lqtyStaking.clvToken()
    assert.equal(clvTokenAddress, recordedCLVTokenAddress)
  })

  // Sets TroveManager in LQTYStaking
  it('Sets the correct ActivePool address in LQTYStaking', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedTroveManagerAddress = await lqtyStaking.cdpManagerAddress()
    assert.equal(cdpManagerAddress, recordedTroveManagerAddress)
  })

  // Sets BorrowerOperations in LQTYStaking
  it('Sets the correct BorrowerOperations address in LQTYStaking', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await lqtyStaking.borrowerOperationsAddress()
    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  // ---  LQTYToken ---

  // Sets CI in LQTYToken
  it('Sets the correct CommunityIssuance address in LQTYToken', async () => {
    const communityIssuanceAddress = communityIssuance.address

    const recordedcommunityIssuanceAddress = await lqtyToken.communityIssuanceAddress()
    assert.equal(communityIssuanceAddress, recordedcommunityIssuanceAddress)
  })

  // Sets LQTYStaking in LQTYToken
  it('Sets the correct LQTYStaking address in LQTYToken', async () => {
    const lqtyStakingAddress = lqtyStaking.address

    const recordedLQTYStakingAddress =  await lqtyToken.lqtyStakingAddress()
    assert.equal(lqtyStakingAddress, recordedLQTYStakingAddress)
  })

  // Sets LCF in LQTYToken
  it('Sets the correct LockupContractFactory address in LQTYToken', async () => {
    const LCFAddress = lockupContractFactory.address

    const recordedLCFAddress =  await lqtyToken.lockupContractFactory()
    assert.equal(LCFAddress, recordedLCFAddress)
  })

  // --- LCF  ---

  // Sets LQTYToken in LockupContractFactory
  it('Sets the correct LQTYToken address in LockupContractFactory', async () => {
    const lqtyTokenAddress = lqtyToken.address

    const recordedLQTYTokenAddress = await lockupContractFactory.lqtyToken()
    assert.equal(lqtyTokenAddress, recordedLQTYTokenAddress)
  })

  // --- CI ---

  // Sets LQTYToken in CommunityIssuance
  it('Sets the correct LQTYToken address in CommunityIssuance', async () => {
    const lqtyTokenAddress = lqtyToken.address

    const recordedLQTYTokenAddress = await communityIssuance.lqtyToken()
    assert.equal(lqtyTokenAddress, recordedLQTYTokenAddress)
  })

  it('Sets the correct StabilityPool address in CommunityIssuance', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await communityIssuance.stabilityPoolAddress()
    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })
})
