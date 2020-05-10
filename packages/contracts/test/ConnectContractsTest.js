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
  let nameRegistry
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
})

contract('Reset chain state', async accounts => { })