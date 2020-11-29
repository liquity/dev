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
    growthToken = LQTYContracts.growthToken
    communityIssuance = LQTYContracts.communityIssuance
    lockupContractFactory = LQTYContracts.lockupContractFactory

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, coreContracts)
  })

  it('Sets the correct PriceFeed address in CDPManager', async () => {
    const priceFeedAddress = priceFeed.address

    const recordedPriceFeedAddress = await cdpManager.priceFeed()

    assert.equal(priceFeedAddress, recordedPriceFeedAddress)
  })

  it('Sets the correct CLVToken address in CDPManager', async () => {
    const clvTokenAddress = clvToken.address

    const recordedClvTokenAddress = await cdpManager.clvToken()

    assert.equal(clvTokenAddress, recordedClvTokenAddress)
  })

  it('Sets the correct SortedCDPs address in CDPManager', async () => {
    const sortedCDPsAddress = sortedCDPs.address

    const recordedSortedCDPsAddress = await cdpManager.sortedCDPs()

    assert.equal(sortedCDPsAddress, recordedSortedCDPsAddress)
  })

  it('Sets the correct BorrowerOperations address in CDPManager', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await cdpManager.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  // ActivePool in CDPM
  it('Sets the correct ActivePool address in CDPManager', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddresss = await cdpManager.activePool()

    assert.equal(activePoolAddress, recordedActivePoolAddresss)
  })

  // DefaultPool in CDPM
  it('Sets the correct DefaultPool address in CDPManager', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddresss = await cdpManager.defaultPool()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddresss)
  })

  // StabilityPool in CDPM
  it('Sets the correct StabilityPool address in CDPManager', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddresss = await cdpManager.stabilityPool()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddresss)
  })

  // LQTY Staking in CDPM
  it('Sets the correct LQTYStaking address in CDPManager', async () => {
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

  it('Sets the correct CDPManager address in ActivePool', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedCDPManagerAddress = await activePool.cdpManagerAddress()
    assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
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

  it('Sets the correct CDPManager address in StabilityPool', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedCDPManagerAddress = await stabilityPool.cdpManager()
    assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
  })

  // Default Pool

  it('Sets the correct CDPManager address in DefaultPool', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedCDPManagerAddress = await defaultPool.cdpManagerAddress()
    assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
  })

  it('Sets the correct ActivePool address in DefaultPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await defaultPool.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('Sets the correct CDPManager address in SortedCDPs', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await sortedCDPs.borrowerOperationsAddress()
    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct BorrowerOperations address in SortedCDPs', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedCDPManagerAddress = await sortedCDPs.CDPManagerAddress()
    assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
  })

  //--- BorrowerOperations ---

  // CDPManager in BO
  it('Sets the correct CDPManager address in BorrowerOperations', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedCDPManagerAddress = await borrowerOperations.cdpManager()
    assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
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
    const growthTokenAddress = growthToken.address

    const recordedLQTYTokenAddress = await lqtyStaking.growthToken()
    assert.equal(growthTokenAddress, recordedLQTYTokenAddress)
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

  // Sets CDPManager in LQTYStaking
  it('Sets the correct ActivePool address in LQTYStaking', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedCDPManagerAddress = await lqtyStaking.cdpManagerAddress()
    assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
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

    const recordedcommunityIssuanceAddress = await growthToken.communityIssuanceAddress()
    assert.equal(communityIssuanceAddress, recordedcommunityIssuanceAddress)
  })

  // Sets LQTYStaking in LQTYToken
  it('Sets the correct LQTYStaking address in LQTYToken', async () => {
    const lqtyStakingAddress = lqtyStaking.address

    const recordedLQTYStakingAddress =  await growthToken.lqtyStakingAddress()
    assert.equal(lqtyStakingAddress, recordedLQTYStakingAddress)
  })

  // Sets LCF in LQTYToken
  it('Sets the correct LockupContractFactory address in LQTYToken', async () => {
    const LCFAddress = lockupContractFactory.address

    const recordedLCFAddress =  await growthToken.lockupContractFactory()
    assert.equal(LCFAddress, recordedLCFAddress)
  })

  // --- LCF  ---

  // Sets LQTYToken in LockupContractFactory
  it('Sets the correct LQTYToken address in LockupContractFactory', async () => {
    const growthTokenAddress = growthToken.address

    const recordedLQTYTokenAddress = await lockupContractFactory.growthToken()
    assert.equal(growthTokenAddress, recordedLQTYTokenAddress)
  })

  // --- CI ---

  // Sets LQTYToken in CommunityIssuance
  it('Sets the correct LQTYToken address in CommunityIssuance', async () => {
    const growthTokenAddress = growthToken.address

    const recordedLQTYTokenAddress = await communityIssuance.growthToken()
    assert.equal(growthTokenAddress, recordedLQTYTokenAddress)
  })

  it('Sets the correct StabilityPool address in CommunityIssuance', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await communityIssuance.stabilityPoolAddress()
    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })
})
