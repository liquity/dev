const PoolManager = artifacts.require("./PoolManager.sol")
const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const NameRegistry = artifacts.require("./NameRegistry.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const DeciMath = artifacts.require("DeciMath")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")

const deploymentHelpers = require("../utils/deploymentHelpers.js")
const getAddresses = deploymentHelpers.getAddresses
const setNameRegistry = deploymentHelpers.setNameRegistry
const connectContracts = deploymentHelpers.connectContracts
const getAddressesFromNameRegistry = deploymentHelpers.getAddressesFromNameRegistry

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

  before(async () => {
    const deciMath = await DeciMath.new()
    DeciMath.setAsDeployed(deciMath)
    CDPManager.link(deciMath)
    PoolManager.link(deciMath)

    priceFeed = await PriceFeed.new()
    clvToken = await CLVToken.new()
    poolManager = await PoolManager.new()
    sortedCDPs = await SortedCDPs.new()
    cdpManager = await CDPManager.new()
    nameRegistry = await NameRegistry.new()
    activePool = await ActivePool.new()
    stabilityPool = await StabilityPool.new()
    defaultPool = await DefaultPool.new()
    functionCaller = await FunctionCaller.new()

    DefaultPool.setAsDeployed(defaultPool)
    PriceFeed.setAsDeployed(priceFeed)
    CLVToken.setAsDeployed(clvToken)
    PoolManager.setAsDeployed(poolManager)
    SortedCDPs.setAsDeployed(sortedCDPs)
    CDPManager.setAsDeployed(cdpManager)
    NameRegistry.setAsDeployed(nameRegistry)
    ActivePool.setAsDeployed(activePool)
    StabilityPool.setAsDeployed(stabilityPool)
    FunctionCaller.setAsDeployed(functionCaller)

    const contracts = {
      priceFeed,
      clvToken,
      poolManager,
      sortedCDPs,
      cdpManager,
      nameRegistry,
      activePool,
      stabilityPool,
      defaultPool,
      functionCaller
    }

    const contractAddresses = getAddresses(contracts)
    await setNameRegistry(contractAddresses, nameRegistry, { from: owner })
    const registeredAddresses = await getAddressesFromNameRegistry(nameRegistry)
    await connectContracts(contracts, registeredAddresses)
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

  it('sets the correct PoolManager address in NameRegistry', async () => {
    const poolManagerAddress = poolManager.address

    const recordedPoolManagerAddress = await nameRegistry.getAddress('PoolManager')

    assert.equal(poolManagerAddress, recordedPoolManagerAddress)
  })

  it('sets the correct PriceFeed address in NameRegistry', async () => {
    const priceFeedAddress = priceFeed.address

    const recordedPriceFeedAddress = await nameRegistry.getAddress('PriceFeed')

    assert.equal(priceFeedAddress, recordedPriceFeedAddress)
  })

  it('sets the correct CLVToken address in NameRegistry', async () => {
    const clvTokenAddress = clvToken.address

    const recordedClvTokenAddress = await nameRegistry.getAddress('CLVToken')

    assert.equal(clvTokenAddress, recordedClvTokenAddress)
  })

  it('sets the correct CDPManager address in NameRegistry', async () => {
    const cdpManagerAddress = cdpManager.address

    const recordedCDPManagerAddress = await nameRegistry.getAddress('CDPManager')

    assert.equal(cdpManagerAddress, recordedCDPManagerAddress)
  })

  it('sets the correct ActivePool address in NameRegistry', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await nameRegistry.getAddress('ActivePool')

    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('sets the correct StabilityPool address in NameRegistry', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await nameRegistry.getAddress('StabilityPool')

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })

  it('sets the correct DefaultPool address in NameRegistry', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await nameRegistry.getAddress('DefaultPool')

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  it('sets the correct PoolManager address in ActivePool', async () => {
    const poolManagerAddress = poolManager.address

    const recordedPoolManagerAddress = await activePool.getPoolManagerAddress()

    assert.equal(poolManagerAddress, recordedPoolManagerAddress)
  })

  it('sets the correct DefaultPool address in ActivePool', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await activePool.getDefaultPoolAddress()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  it('sets the correct StabilityPool address in ActivePool', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await activePool.getStabilityPoolAddress()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })

  it('sets the correct PoolManager address in StabilityPool', async () => {
    const poolManagerAddress = poolManager.address

    const recordedPoolManagerAddress = await stabilityPool.getPoolManagerAddress()
    assert.equal(poolManagerAddress, recordedPoolManagerAddress)
  })

  it('sets the correct DefaultPool address in StabilityPool', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await stabilityPool.getDefaultPoolAddress()
    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  it('sets the correct ActivePool address in StabilityPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await stabilityPool.getActivePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('sets the correct PoolManager address in DefaultPool', async () => {
    const poolManagerAddress = poolManager.address

    const recordedPoolManagerAddress = await defaultPool.getPoolManagerAddress()
    assert.equal(poolManagerAddress, recordedPoolManagerAddress)
  })

  it('sets the correct ActivePool address in DefaultPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await defaultPool.getActivePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('sets the correct StabilityPool address in DefaultPool', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await defaultPool.getStabilityPoolAddress()
    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })
})

contract('Reset chain state', async accounts => { })