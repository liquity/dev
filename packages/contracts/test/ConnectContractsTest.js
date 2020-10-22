const deploymentHelper = require("../utils/deploymentHelpers.js")

contract('Deployment script - Sets correct contract addresses dependencies after deployment', async accounts => {
  const [owner] = accounts;
  let priceFeed
  let clvToken
  let poolManager
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
    poolManager = coreContracts.poolManager
    sortedCDPs = coreContracts.sortedCDPs
    cdpManager = coreContracts.cdpManager
    nameRegistry = coreContracts.nameRegistry
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

  it('sets the correct CLVToken address in PoolManager', async () => {
    const clvTokenAddress = clvToken.address

    const recordedClvTokenAddress = await cdpManager.clvToken()

    assert.equal(clvTokenAddress, recordedClvTokenAddress)
  })

  it('sets the correct SortedCDPs address in CDPManager', async () => {
    const sortedCDPsAddress = sortedCDPs.address

    const recordedSortedCDPsAddress = await cdpManager.sortedCDPs()

    assert.equal(sortedCDPsAddress, recordedSortedCDPsAddress)
  })

  it('sets the correct PoolManager address in CDPManager', async () => {
    const poolManagerAddress = poolManager.address

    const recordedPoolManagerAddress = await cdpManager.poolManager()

    assert.equal(poolManagerAddress, recordedPoolManagerAddress)
  })

  it('sets the correct BorrowerOperations address in CDPManager', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await cdpManager.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('sets the correct ActivePool address in CDPManager', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddresss = await cdpManager.activePool()

    assert.equal(activePoolAddress, recordedActivePoolAddresss)
  })


  it('sets the correct DefaultPool address in CDPManager', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddresss = await cdpManager.defaultPool()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddresss)
  })


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

  it('sets the correct PriceFeed address  in PoolManager', async () => {
    const priceFeedAddress = priceFeed.address

    const recordedPriceFeedAddress = await poolManager.priceFeed()

    assert.equal(priceFeedAddress, recordedPriceFeedAddress)
  })

  it('sets the correct CDPManager address in PoolManager', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedCDPManagerAddress = await poolManager.cdpManagerAddress()

    assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
  })

  it('sets the correct BorrowerOperations address in PoolManager', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await poolManager.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('sets the correct CLVToken address in PoolManager', async () => {
    const clvTokenAddress = clvToken.address

    const recordedClvTokenAddress = await poolManager.CLV()

    assert.equal(clvTokenAddress, recordedClvTokenAddress)
  })

  it('sets the correct ActivePool address in PoolManager', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await poolManager.activePoolAddress()

    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('sets the correct StabilityPool address in PoolManager', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await poolManager.stabilityPoolAddress()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })

  it('sets the correct DefaultPool address in PoolManager', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await poolManager.defaultPoolAddress()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  it('sets the correct PoolManager address in CLVToken', async () => {
    const poolManagerAddress = poolManager.address

    const recordedPoolManagerAddress = await clvToken.poolManagerAddress()

    assert.equal(poolManagerAddress, recordedPoolManagerAddress)
  })

  it('sets the correct PoolManager address in ActivePool', async () => {
    const poolManagerAddress = poolManager.address

    const recordedPoolManagerAddress = await activePool.poolManagerAddress()

    assert.equal(poolManagerAddress, recordedPoolManagerAddress)
  })

  it('sets the correct DefaultPool address in ActivePool', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await activePool.defaultPoolAddress()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  it('sets the correct PoolManager address in StabilityPool', async () => {
    const poolManagerAddress = poolManager.address

    const recordedPoolManagerAddress = await stabilityPool.poolManagerAddress()
    assert.equal(poolManagerAddress, recordedPoolManagerAddress)
  })

  it('sets the correct ActivePool address in StabilityPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await stabilityPool.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('sets the correct PoolManager address in DefaultPool', async () => {
    const poolManagerAddress = poolManager.address

    const recordedPoolManagerAddress = await defaultPool.poolManagerAddress()
    assert.equal(poolManagerAddress, recordedPoolManagerAddress)
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
  // setPoolManager in BO
  it('sets the correct PoolManager address in BorrowerOperations', async () => {
    const poolManagerAddress = poolManager.address

    const recordedPoolManagerAddress = await borrowerOperations.poolManager()
    assert.equal(poolManagerAddress, recordedPoolManagerAddress)
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
