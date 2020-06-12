const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const getDifference = testHelpers.getDifference
const moneyVals = testHelpers.MoneyValues

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

  before(async () => {
    const contracts = await deployLiquity()

    priceFeed = contracts.priceFeed
    clvToken = contracts.clvToken
    poolManager = contracts.poolManager
    sortedCDPs = contracts.sortedCDPs
    cdpManager = contracts.cdpManager
    nameRegistry = contracts.nameRegistry
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    functionCaller = contracts.functionCaller
    borrowerOperations = contracts.borrowerOperations

    const contractAddresses = getAddresses(contracts)
    await connectContracts(contracts, contractAddresses)
  })

  it('sets the correct PriceFeed address in CDPManager', async () => {
    const priceFeedAddress = priceFeed.address

    const recordedPriceFeedAddress = await cdpManager.priceFeedAddress()

    assert.equal(priceFeedAddress, recordedPriceFeedAddress)
  })

  it('sets the correct SortedCDPs address in CDPManager', async () => {
    const sortedCDPsAddress = sortedCDPs.address

    const recordedSortedCDPsAddress = await cdpManager.sortedCDPsAddress()

    assert.equal(sortedCDPsAddress, recordedSortedCDPsAddress)
  })

  it('sets the correct CLVToken address in CDPManager', async () => {
    const clvTokenAddress = clvToken.address

    const recordedClvTokenAddress = await cdpManager.clvTokenAddress()

    assert.equal(clvTokenAddress, recordedClvTokenAddress)
  })

  it('sets the correct PoolManager address in CDPManager', async () => {
    const poolManagerAddress = poolManager.address

    const recordedPoolManagerAddress = await cdpManager.poolManagerAddress()

    assert.equal(poolManagerAddress, recordedPoolManagerAddress)
  })

  it('sets the correct BorrowerOperations address in CDPManager', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await cdpManager.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  // ActivePool in CDPM
  it('sets the correct BorrowerOperations address in CDPManager', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddresss = await cdpManager.activePoolAddress()

    assert.equal(activePoolAddress, recordedActivePoolAddresss)
  })

  // DefaultPool in CDPM
  it('sets the correct BorrowerOperations address in CDPManager', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddresss = await cdpManager.defaultPoolAddress()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddresss)
  })

  // StabilityPool in CDPM
  it('sets the correct BorrowerOperations address in CDPManager', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddresss = await cdpManager.stabilityPoolAddress()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddresss)
  })


  it('sets the correct PriceFeed address  in PoolManager', async () => {
    const priceFeedAddress = priceFeed.address

    const recordedPriceFeedAddress = await poolManager.priceFeedAddress()

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

    const recordedClvTokenAddress = await poolManager.clvAddress()

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

  it('sets the correct StabilityPool address in ActivePool', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await activePool.stabilityPoolAddress()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })

  it('sets the correct PoolManager address in StabilityPool', async () => {
    const poolManagerAddress = poolManager.address

    const recordedPoolManagerAddress = await stabilityPool.poolManagerAddress()
    assert.equal(poolManagerAddress, recordedPoolManagerAddress)
  })

  it('sets the correct DefaultPool address in StabilityPool', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await stabilityPool.defaultPoolAddress()
    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
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

  it('sets the correct StabilityPool address in DefaultPool', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await defaultPool.stabilityPoolAddress()
    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })

  it('sets the correct CDPManager address in SortedCDPs', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedCDPManagerAddress = await sortedCDPs.CDPManagerAddress()
    assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
  })

  //--- BorrowerOperations ---

  // CDPManager in BO
  it('sets the correct CDPManager address in BorrowerOperations', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedCDPManagerAddress = await borrowerOperations.cdpManagerAddress()
    assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
  })
  // setPoolManager in BO
  it('sets the correct PoolManager address in BorrowerOperations', async () => {
    const poolManagerAddress = poolManager.address

    const recordedPoolManagerAddress = await borrowerOperations.poolManagerAddress()
    assert.equal(poolManagerAddress, recordedPoolManagerAddress)
  })

  // setPriceFeed in BO
  it('sets the correct PriceFeed address in BorrowerOperations', async () => {
    const priceFeedAddress = priceFeed.address

    const recordedPriceFeedAddress = await borrowerOperations.priceFeedAddress()
    assert.equal(priceFeedAddress, recordedPriceFeedAddress)
  })

  // setSortedCDPs in BO
  it('sets the correct SortedCDPs address in BorrowerOperations', async () => {
    const sortedCDPsAddress = sortedCDPs.address

    const recordedSortedCDPsAddress = await borrowerOperations.sortedCDPsAddress()
    assert.equal(sortedCDPsAddress, recordedSortedCDPsAddress)
  })

  // setActivePool in BO
  it('sets the correct ActivePool address in BorrowerOperations', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await borrowerOperations.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  // setDefaultPool in BO
  it('sets the correct DefaultPool address in BorrowerOperations', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await borrowerOperations.defaultPoolAddress()
    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })


})

contract('Reset chain state', async accounts => { })