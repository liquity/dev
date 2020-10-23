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
  let growthToken
  let communityIssuance
  let lockupContractFactory

  before(async () => {
    const coreContracts = await deploymentHelper.deployLiquityCore()
    const GTContracts = await deploymentHelper.deployGTContracts()

    priceFeed = coreContracts.priceFeed
    clvToken = coreContracts.clvToken
    sortedCDPs = coreContracts.sortedCDPs
    cdpManager = coreContracts.cdpManager
    activePool = coreContracts.activePool
    stabilityPool = coreContracts.stabilityPool
    defaultPool = coreContracts.defaultPool
    functionCaller = coreContracts.functionCaller
    borrowerOperations = coreContracts.borrowerOperations

    lqtyStaking = GTContracts.lqtyStaking
    growthToken = GTContracts.growthToken
    communityIssuance = GTContracts.communityIssuance
    lockupContractFactory = GTContracts.lockupContractFactory

    await deploymentHelper.connectGTContracts(GTContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, GTContracts)
    await deploymentHelper.connectGTContractsToCore(GTContracts, coreContracts)
  })

  it('sets the correct PriceFeed address in CDPManager', async () => {
    const priceFeedAddress = priceFeed.address

    const recordedPriceFeedAddress = await cdpManager.priceFeed()

    assert.equal(priceFeedAddress, recordedPriceFeedAddress)
  })

  it('sets the correct CLVToken address in CDPManager', async () => {
    const clvTokenAddress = clvToken.address

    const recordedClvTokenAddress = await cdpManager.CLV()

    assert.equal(clvTokenAddress, recordedClvTokenAddress)
  })

  it('sets the correct SortedCDPs address in CDPManager', async () => {
    const sortedCDPsAddress = sortedCDPs.address

    const recordedSortedCDPsAddress = await cdpManager.sortedCDPs()

    assert.equal(sortedCDPsAddress, recordedSortedCDPsAddress)
  })

  it('sets the correct BorrowerOperations address in CDPManager', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await cdpManager.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  // ActivePool in CDPM
  it('sets the correct ActivePool address in CDPManager', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddresss = await cdpManager.activePool()

    assert.equal(activePoolAddress, recordedActivePoolAddresss)
  })

  // DefaultPool in CDPM
  it('sets the correct DefaultPool address in CDPManager', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddresss = await cdpManager.defaultPool()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddresss)
  })

  // StabilityPool in CDPM
  it('sets the correct StabilityPool address in CDPManager', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddresss = await cdpManager.stabilityPool()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddresss)
  })

  // GT Staking in CDPM
  it('sets the correct LQTYStaking address in CDPManager', async () => {
    const lqtyStakingAddress = lqtyStaking.address

    const recordedLQTYStakingAddress = await cdpManager.lqtyStakingAddress()
    assert.equal(lqtyStakingAddress, recordedLQTYStakingAddress)
  })

  // Active Pool

  it('sets the correct StabilityPool address in ActivePool', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await activePool.stabilityPoolAddress()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })

  it('sets the correct DefaultPool address in ActivePool', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await activePool.defaultPoolAddress()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  it('sets the correct BorrowerOperations address in ActivePool', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await activePool.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('sets the correct CDPManager address in ActivePool', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedCDPManagerAddress = await activePool.cdpManagerAddress()
    assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
  })

  // Stability Pool

  it('sets the correct ActivePool address in StabilityPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await stabilityPool.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('sets the correct BorrowerOperations address in StabilityPool', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await stabilityPool.borrowerOperations()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('sets the correct CLVToken address in StabilityPool', async () => {
    const clvTokenAddress = clvToken.address

    const recordedClvTokenAddress = await stabilityPool.CLV()

    assert.equal(clvTokenAddress, recordedClvTokenAddress)
  })

  it('sets the correct CDPManager address in StabilityPool', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedCDPManagerAddress = await stabilityPool.cdpManager()
    assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
  })

  // Default Pool

  it('sets the correct CDPManager address in DefaultPool', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedCDPManagerAddress = await defaultPool.cdpManagerAddress()
    assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
  })

  it('sets the correct ActivePool address in DefaultPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await defaultPool.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('sets the correct CDPManager address in SortedCDPs', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await sortedCDPs.borrowerOperationsAddress()
    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('sets the correct BorrowerOperations address in SortedCDPs', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedCDPManagerAddress = await sortedCDPs.CDPManagerAddress()
    assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
  })

  //--- BorrowerOperations ---

  // CDPManager in BO
  it('sets the correct CDPManager address in BorrowerOperations', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedCDPManagerAddress = await borrowerOperations.cdpManager()
    assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
  })

  // setPriceFeed in BO
  it('sets the correct PriceFeed address in BorrowerOperations', async () => {
    const priceFeedAddress = priceFeed.address

    const recordedPriceFeedAddress = await borrowerOperations.priceFeed()
    assert.equal(priceFeedAddress, recordedPriceFeedAddress)
  })

  // setSortedCDPs in BO
  it('sets the correct SortedCDPs address in BorrowerOperations', async () => {
    const sortedCDPsAddress = sortedCDPs.address

    const recordedSortedCDPsAddress = await borrowerOperations.sortedCDPs()
    assert.equal(sortedCDPsAddress, recordedSortedCDPsAddress)
  })

  // setActivePool in BO
  it('sets the correct ActivePool address in BorrowerOperations', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await borrowerOperations.activePool()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  // setDefaultPool in BO
  it('sets the correct DefaultPool address in BorrowerOperations', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await borrowerOperations.defaultPool()
    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  // GT Staking in BO
  it('sets the correct LQTYStaking address in BorrowerOperations', async () => {
    const lqtyStakingAddress = lqtyStaking.address

    const recordedLQTYStakingAddress = await borrowerOperations.lqtyStakingAddress()
    assert.equal(lqtyStakingAddress, recordedLQTYStakingAddress)
  })


  // --- LQTY Staking ---

  // sets GrowthToken in LQTYStaking
  it('sets the correct GrowthToken address in LQTYStaking', async () => {
    const growthTokenAddress = growthToken.address

    const recordedGrowthTokenAddress = await lqtyStaking.growthTokenAddress()
    assert.equal(growthTokenAddress, recordedGrowthTokenAddress)
  })

  // sets ActivePool in LQTYStaking
  it('sets the correct ActivePool address in LQTYStaking', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await lqtyStaking.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  // sets CLVToken in LQTYStaking
  it('sets the correct ActivePool address in LQTYStaking', async () => {
    const clvTokenAddress = clvToken.address

    const recordedCLVTokenAddress = await lqtyStaking.clvTokenAddress()
    assert.equal(clvTokenAddress, recordedCLVTokenAddress)
  })

  // sets CDPManager in LQTYStaking
  it('sets the correct ActivePool address in LQTYStaking', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedCDPManagerAddress = await lqtyStaking.cdpManagerAddress()
    assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
  })

  // sets BorrowerOperations in LQTYStaking
  it('sets the correct BorrowerOperations address in LQTYStaking', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await lqtyStaking.borrowerOperationsAddress()
    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  // ---

  // sets GrowthToken in LockupContractFactory
  it('sets the correct GrowthToken address in LockupContractFactory', async () => {
    const growthTokenAddress = growthToken.address

    const recordedGrowthTokenAddress = await lockupContractFactory.growthTokenAddress()
    assert.equal(growthTokenAddress, recordedGrowthTokenAddress)
  })

  // sets GrowthToken in CommunityIssuance
  it('sets the correct GrowthToken address in LockupContractFactory', async () => {
    const growthTokenAddress = growthToken.address

    const recordedGrowthTokenAddress = await communityIssuance.growthTokenAddress()
    assert.equal(growthTokenAddress, recordedGrowthTokenAddress)
  })
})
