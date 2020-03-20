// TODO - Refactor duplication across tests. Run only minimum number of contracts
const PoolManager = artifacts.require("./PoolManager.sol")
const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const NameRegistry = artifacts.require("./NameRegistry.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")

const testHelpers = require("../utils/testHelpers.js")
const getDifference = testHelpers.getDifference

const deploymentHelpers = require("../utils/deploymentHelpers.js")
const getAddresses = deploymentHelpers.getAddresses
const setNameRegistry = deploymentHelpers.setNameRegistry
const connectContracts = deploymentHelpers.connectContracts
const getAddressesFromNameRegistry = deploymentHelpers.getAddressesFromNameRegistry

contract('PoolManager', async accounts => {
  const _2_Ether = web3.utils.toWei('2', 'ether')
  const _1_Ether = web3.utils.toWei('1', 'ether')
  const _9_Ether = web3.utils.toWei('9', 'ether')
  const _10_Ether = web3.utils.toWei('10', 'ether')

  const [owner, mockCDPManagerAddress, mockPoolManagerAddress, alice] = accounts;
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

  beforeEach(async () => {
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

    contracts = {
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
    await poolManager.setCDPManagerAddress(mockCDPManagerAddress, { from: owner })
  })

  // Getters and setters
  it('cdpManagerAddress(): sets and gets the cdpManager address', async () => {
    const recordedCDPddress = await poolManager.cdpManagerAddress({ from: mockCDPManagerAddress })
    assert.equal(mockCDPManagerAddress, recordedCDPddress)
  })

  it('getTCR(): with 0 ActivePool ETH and 0 ActivePool CLV, returns a TCR of 1', async () => {
    const activePoolETH = await activePool.getETH({ from: mockPoolManagerAddress })
    const activePoolCLV = await activePool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(activePoolETH, 0)
    assert.equal(activePoolCLV, 0)

    const expectedTCR = 1
    const TCR = await poolManager.getTCR()
    assert.equal(expectedTCR, TCR)
  })

  it('getTCR(): with non-zero ActivePool ETH and 0 ActivePool CLV, returns the correct TCR', async () => {
    // setup: add ETH to ActivePool
    await activePool.setPoolManagerAddress(mockPoolManagerAddress)
    await web3.eth.sendTransaction( {to: activePool.address, from: mockPoolManagerAddress, value: _1_Ether })
    const activePoolETH = await activePool.getETH({ from: mockPoolManagerAddress })
    const activePoolCLV = await activePool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(activePoolETH, _1_Ether)
    assert.equal(activePoolCLV, 0)

    //2**256 - 1
    const expectedTCR = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    const TCR = await poolManager.getTCR()
    const hexTCR = web3.utils.toHex(TCR)

    assert.deepEqual(expectedTCR, hexTCR)
  })

  // This test should pass after math rounding errors in contracts are fixed

  it('getTCR: with ActivePool ETH and ActivePool CLV, returns the correct TCR', async () => {
   // setup: add ETH and CLV to ActivePool
    await activePool.setPoolManagerAddress(mockPoolManagerAddress)
    await web3.eth.sendTransaction( {to: activePool.address, from: mockPoolManagerAddress, value: _1_Ether })
    _600_CLV = web3.utils.toWei('3', 'ether')  // assume a price of 1ETH: 200CLV
    await activePool.increaseCLV(_600_CLV, { from: mockPoolManagerAddress })

    // get recorded values from contracts
    const activePoolETH = await activePool.getETH({ from: mockPoolManagerAddress })
    const activePoolCLV = await activePool.getCLV({ from: mockPoolManagerAddress })
    const price = await priceFeed.getPrice()  // use the actual pool manager contract to get the price
    
    const expectedTCR = web3.utils.toBN('66666666666666666666')
    const TCR = (await poolManager.getTCR())
    
    // check expected is within 100 wei of actual
    const diff = Number(expectedTCR.sub(TCR).abs())
    console.log(`diff is ${diff}`)
    assert.isAtMost(diff, 100)
  })

  it('getActiveDebt(): returns the total CLV balance of the ActivePool', async () => {
    const actualActiveDebt = await activePool.getCLV({ from: poolManager.address })
    const returnedActiveDebt = await poolManager.getActiveDebt()
    assert.equal(actualActiveDebt.toNumber(), returnedActiveDebt.toNumber())
  })

  it('getActiveColl(): returns the total ETH balance of the ActivePool', async () => {
    const actualActiveColl = (await activePool.getETH({ from: poolManager.address })).toNumber()
    const returnedActiveColl = (await poolManager.getActiveColl()).toNumber()
    assert.equal(actualActiveColl, returnedActiveColl)
  })

  it('getLiquidatedColl(): returns the total ETH balance of the DefaultPool', async () => {
    const actualActiveColl = (await defaultPool.getETH({ from: poolManager.address })).toNumber()
    const returnedActiveColl = (await poolManager.getLiquidatedColl()).toNumber()
    assert.equal(actualActiveColl, returnedActiveColl)
  })

  it('addColl(): increases the raw ether balance of the ActivePool by the correct amount', async () => {
    const activePool_RawBalance_Before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_RawBalance_Before, 0)

    await poolManager.addColl({ from: mockCDPManagerAddress, value: _1_Ether })

    const activePool_RawBalance_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_RawBalance_After, _1_Ether)
  })

  it('addColl(): increases the recorded ETH balance of the ActivePool by the correct amount', async () => {
    // check ETH record before
    const activePool_ETHBalance_Before = await activePool.getETH({ from: poolManager.address })
    assert.equal(activePool_ETHBalance_Before, 0)

    // send coll, called by cdpManager
    await poolManager.addColl({ from: mockCDPManagerAddress, value: _1_Ether })

    // check EtH record after
    const activePool_ETHBalance_After = await activePool.getETH({ from: poolManager.address })
    assert.equal(activePool_ETHBalance_After, _1_Ether)
  })

  it('withdrawColl(): decreases the raw ether balance of ActivePool', async () => {
    // --- SETUP ---
    // give activePool 2 ether
    const activePool_initialBalance = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_initialBalance, 0)
    await activePool.setPoolManagerAddress(mockPoolManagerAddress, { from: owner })
    await web3.eth.sendTransaction( {to: activePool.address, from: mockPoolManagerAddress, value: _2_Ether })
    // reconnect activePool to the real poolManager
    await activePool.setPoolManagerAddress(poolManager.address, { from: owner })

    // --- TEST ---
    // check raw ether balances before
    const activePool_ETHBalance_BeforeTx = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETHBalance_BeforeTx, _2_Ether)

    //withdrawColl()
    await poolManager.withdrawColl(alice, _1_Ether, { from: mockCDPManagerAddress })

    //  check  raw ether balance after
    const activePool_ETHBalance_AfterTx = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETHBalance_AfterTx, _1_Ether)
  })

  it('withdrawColl(): decreases the recorded ETH balance of the ActivePool by the correct amount', async () => {
    // --- SETUP ---
    // give activePool 2 ether
    const activePool_initialBalance = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_initialBalance, 0)
    // use the mockPool to set the recorded ETH balance
    await activePool.setPoolManagerAddress(mockPoolManagerAddress, { from: owner })
    await web3.eth.sendTransaction( {to: activePool.address, from: mockPoolManagerAddress, value: _2_Ether })
    // reconnect activePool to the real poolManager
    await activePool.setPoolManagerAddress(poolManager.address, { from: owner })

    // --- TEST ---
    // check ETH record before
    const activePool_ETHBalance_BeforeTx = await activePool.getETH({ from: poolManager.address })
    assert.equal(activePool_ETHBalance_BeforeTx, _2_Ether)

    //withdrawColl()
    await poolManager.withdrawColl(alice, _1_Ether, { from: mockCDPManagerAddress })

    // check ETH record after
    const activePool_ETHBalance_AfterTx = await activePool.getETH({ from: poolManager.address })
    assert.equal(activePool_ETHBalance_AfterTx, _1_Ether)
  })

  // TODO - extract impact on user to seperate test
  it('withdrawCLV(): increases the CLV of ActivePool and user CLV balance by the correct amount', async () => {
    // check CLV balances before
    const activePool_CLVBalance_Before = await activePool.getCLV({ from: poolManager.address })
    const alice_CLVBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(activePool_CLVBalance_Before, 0)
    assert.equal(alice_CLVBalance_Before, 0)

    // withdrawCLV()
    await poolManager.withdrawCLV(alice, 100, { from: mockCDPManagerAddress })

    // Check CLV balances after - both should increase.
    // Outstanding CLV is issued to alice, and corresponding CLV debt recorded in activePool
    const activePool_CLVBalance_After = await activePool.getCLV({ from: poolManager.address })
    const alice_CLVBalance_After = await clvToken.balanceOf(alice)

    assert.equal(activePool_CLVBalance_After, 100)
    assert.equal(alice_CLVBalance_After, 100)
  })

  it('repayCLV: decreases the CLV of ActivePool by the correct amount', async () => {
    // --- SETUP ---
    // issue CLV debt to alice and record in activePool
    await poolManager.withdrawCLV(alice, 100, { from: mockCDPManagerAddress })

    const activePool_CLVBalance_Before = await activePool.getCLV({ from: poolManager.address })
    const alice_CLVBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(activePool_CLVBalance_Before, 100)
    assert.equal(alice_CLVBalance_Before, 100)

    // --- TEST ---
    // repayCLV()
    await poolManager.repayCLV(alice, 100, { from: mockCDPManagerAddress })

    // Check repayed CLV is wiped from activePool
    const activePool_CLVBalance_After = await activePool.getCLV({ from: poolManager.address })
    assert.equal(activePool_CLVBalance_After, 0)
  })

  it('repayCLV: decreases the user CLV balance by the correct amount', async () => {
    // --- SETUP ---
    // issue CLV debt to alice and record in activePool
    await poolManager.withdrawCLV(alice, 100, { from: mockCDPManagerAddress })

    const activePool_CLVBalance_Before = await activePool.getCLV({ from: poolManager.address })
    const alice_CLVBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(activePool_CLVBalance_Before, 100)
    assert.equal(alice_CLVBalance_Before, 100)

    // --- TEST ---
    // repayCLV()
    await poolManager.repayCLV(alice, 100, { from: mockCDPManagerAddress })

    // Check repayed CLV is deducted from Alice's balance
    const alice_CLVBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVBalance_After, 0)
  })


  it('liquidate(): decreases the CLV, ETH and raw ether of ActivePool by the correct amount', async () => {
    // --- SETUP ---
    // give activePool 1 ether and 200 CLV.
    await activePool.setPoolManagerAddress(mockPoolManagerAddress, { from: owner })
    await web3.eth.sendTransaction( {to: activePool.address, from: mockPoolManagerAddress, value: _1_Ether })
    await activePool.increaseCLV(200, { from: mockPoolManagerAddress })
    // reconnect activePool to the real poolManager
    await activePool.setPoolManagerAddress(poolManager.address, { from: owner })

    // --- TEST ---
    // activePool CLV, ETH and raw ether before
    const activePool_CLV_Before = await activePool.getCLV({ from: poolManager.address })
    const activePool_ETH_Before = await activePool.getETH({ from: poolManager.address })
    const active_Pool_rawEther_Before = await web3.eth.getBalance(activePool.address)

    assert.equal(activePool_CLV_Before, 200)
    assert.equal(activePool_ETH_Before, _1_Ether)
    assert.equal(active_Pool_rawEther_Before, _1_Ether)

    // liquidate()
    await poolManager.liquidate(200, _1_Ether, { from: mockCDPManagerAddress })

    // check activePool CLV, ETH and raw ether after
    const activePool_CLV_After = await activePool.getCLV({ from: poolManager.address })
    const activePool_ETH_After = await activePool.getETH({ from: poolManager.address })
    const active_Pool_rawEther_After = await web3.eth.getBalance(activePool.address)

    assert.equal(activePool_CLV_After, 0)
    assert.equal(activePool_ETH_After, 0)
    assert.equal(active_Pool_rawEther_After, 0)
  })

  it('liquidate(): increases the CLV, ETH and raw ether of DefaultPool by the correct amount', async () => {
    // --- SETUP ---
    // give activePool 1 ether and 200 CLV.
    await activePool.setPoolManagerAddress(mockPoolManagerAddress, { from: owner })
    await web3.eth.sendTransaction( {to: activePool.address, from: mockPoolManagerAddress, value: _1_Ether })
    await activePool.increaseCLV(200, { from: mockPoolManagerAddress })
    // reconnect activePool to the real poolManager
    await activePool.setPoolManagerAddress(poolManager.address, { from: owner })

    // --- TEST ---
    // check defaultPool CLV, ETH and raw ether before
    const defaultPool_CLV_Before = await defaultPool.getCLV({ from: poolManager.address })
    const defaultPool_ETH_Before = await defaultPool.getETH({ from: poolManager.address })
    const defaultPool_rawEther_Before = await web3.eth.getBalance(defaultPool.address)

    assert.equal(defaultPool_CLV_Before, 0)
    assert.equal(defaultPool_ETH_Before, 0)
    assert.equal(defaultPool_rawEther_Before, 0)

    // liquidate()
    await poolManager.liquidate(200, _1_Ether, { from: mockCDPManagerAddress })

    // check defaultPool CLV, ETH and raw ether after
    const defaultPool_CLV_After = await defaultPool.getCLV({ from: poolManager.address })
    const defaultPool_ETH_After = await defaultPool.getETH({ from: poolManager.address })
    const defaultPool_rawEther_After = await web3.eth.getBalance(defaultPool.address)

    assert.equal(defaultPool_CLV_After, 200)
    assert.equal(defaultPool_ETH_After, _1_Ether)
    assert.equal(defaultPool_rawEther_After, _1_Ether)
  })

  it('applyPendingRewards(): increases the CLV, ETH and raw ether of ActivePool by the correct amount', async () => {
    // --- SETUP ---
    // give defaultPool 1 ether and 200 CLV
    await defaultPool.setPoolManagerAddress(mockPoolManagerAddress, { from: owner })
    await web3.eth.sendTransaction( {to: defaultPool.address, from: mockPoolManagerAddress, value: _1_Ether })
    await defaultPool.increaseCLV(200, { from: mockPoolManagerAddress })

    // reconnect defaultPool to the real poolManager
    await defaultPool.setPoolManagerAddress(poolManager.address, { from: owner })

    // --- TEST ---
    // activePool CLV, ETH and raw ether before
    const activePool_CLV_Before = await activePool.getCLV({ from: poolManager.address })
    const activePool_ETH_Before = await activePool.getETH({ from: poolManager.address })
    const active_Pool_rawEther_Before = await web3.eth.getBalance(activePool.address)

    assert.equal(activePool_CLV_Before, 0)
    assert.equal(activePool_ETH_Before, 0)
    assert.equal(active_Pool_rawEther_Before, 0)

    // applyPendingRewards()
    await poolManager.applyPendingRewards(200, _1_Ether, { from: mockCDPManagerAddress })

    // check activePool CLV, ETH and raw ether after
    const activePool_CLV_After = await activePool.getCLV({ from: poolManager.address })
    const activePool_ETH_After = await activePool.getETH({ from: poolManager.address })
    const active_Pool_rawEther_After = await web3.eth.getBalance(activePool.address)

    assert.equal(activePool_CLV_After, 200)
    assert.equal(activePool_ETH_After, _1_Ether)
    assert.equal(active_Pool_rawEther_After, _1_Ether)
  })

  it('applyPendingRewards(): decreases the CLV, ETH and raw ether of DefaultPool by the correct amount', async () => {
    // --- SETUP ---
    // give defaultPool 1 ether and 200 CLV
    await defaultPool.setPoolManagerAddress(mockPoolManagerAddress, { from: owner })
    await web3.eth.sendTransaction( {to: defaultPool.address, from: mockPoolManagerAddress, value: _1_Ether })
    await defaultPool.increaseCLV(200, { from: mockPoolManagerAddress })
    // reconnect defaultPool to the real poolManager
    await defaultPool.setPoolManagerAddress(poolManager.address, { from: owner })

    // --- TEST ---
    // check defaultPool CLV, ETH and raw ether before
    const defaultPool_CLV_Before = await defaultPool.getCLV({ from: poolManager.address })
    const defaultPool_ETH_Before = await defaultPool.getETH({ from: poolManager.address })
    const defaultPool_rawEther_Before = await web3.eth.getBalance(defaultPool.address)

    assert.equal(defaultPool_CLV_Before, 200)
    assert.equal(defaultPool_ETH_Before, _1_Ether)
    assert.equal(defaultPool_rawEther_Before, _1_Ether)

    // applyPendingRewards()
    await poolManager.applyPendingRewards(200, _1_Ether, { from: mockCDPManagerAddress })

    // check defaultPool CLV, ETH and raw ether after
    const defaultPool_CLV_After = await defaultPool.getCLV({ from: poolManager.address })
    const defaultPool_ETH_After = await defaultPool.getETH({ from: poolManager.address })
    const defaultPool_rawEther_After = await web3.eth.getBalance(defaultPool.address)

    assert.equal(defaultPool_CLV_After, 0)
    assert.equal(defaultPool_ETH_After, 0)
    assert.equal(defaultPool_rawEther_After, 0)
  })

  describe('redeemCollateral()', async () => {
    beforeEach(async () => {
      // --- SETUP --- give activePool 10 ether and 5000 CLV, and give Alice 200 CLV
      await activePool.setPoolManagerAddress(mockPoolManagerAddress, { from: owner })
      await clvToken.setPoolManagerAddress(mockPoolManagerAddress, { from: owner })
      await web3.eth.sendTransaction( {to: activePool.address, from: mockPoolManagerAddress, value: _10_Ether })
      await activePool.increaseCLV(5000, { from: mockPoolManagerAddress })
      // use the mockPool to set alice's CLV Balance
      await clvToken.mint(alice, 200, { from: mockPoolManagerAddress })
      // reconnect activePool and CLVToken to the real poolManager
      await activePool.setPoolManagerAddress(poolManager.address, { from: owner })
      await clvToken.setPoolManagerAddress(poolManager.address, { from: owner })
    })

    it("redeemCollateral(): burns the received CLV from the redeemer's account", async () => {
      // check Alice's CLV balance before
      const alice_CLV_Before = await clvToken.balanceOf(alice)
      assert.equal(alice_CLV_Before, 200)

      //redeemCollateral()
      await poolManager.redeemCollateral(alice, 200, _1_Ether, { from: mockCDPManagerAddress })

      // check Alice's CLV balance before
      alice_CLV_After = await clvToken.balanceOf(alice)
      assert.equal(alice_CLV_After, 0)
    })

    it("redeemCollateral(): transfers correct amount of ether to the redeemer's account", async () => {
      // check Alice's ether balance before
      const alice_EtherBalance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))

      //redeemCollateral()
      await poolManager.redeemCollateral(alice, 200, _1_Ether, { from: mockCDPManagerAddress })

      // check Alice's ether balance after
      const alice_EtherBalance_After = web3.utils.toBN(await web3.eth.getBalance(alice))

      const balanceChange = (alice_EtherBalance_After.sub(alice_EtherBalance_Before)).toString()
      console.log(balanceChange)
      assert.equal(balanceChange, _1_Ether)
    })

    it("redeemCollateral(): decreases the ActivePool ETH and CLV balances by the correct amount", async () => {
      // --- TEST ---
      // check activePool CLV, ETH and raw ether before
      const activePool_CLV_Before = await activePool.getCLV({ from: poolManager.address })
      const activePool_ETH_Before = await activePool.getETH({ from: poolManager.address })
      const active_Pool_rawEther_Before = await web3.eth.getBalance(activePool.address)

      assert.equal(activePool_CLV_Before, 5000)
      assert.equal(activePool_ETH_Before, _10_Ether)
      assert.equal(active_Pool_rawEther_Before, _10_Ether)

      // redeemCollateral()
      await poolManager.redeemCollateral(alice, 200, _1_Ether, { from: mockCDPManagerAddress })

      // check activePool CLV, ETH and raw ether after
      const activePool_CLV_After = await activePool.getCLV({ from: poolManager.address })
      const activePool_ETH_After = await activePool.getETH({ from: poolManager.address })
      const active_Pool_rawEther_After = await web3.eth.getBalance(activePool.address)

      assert.equal(activePool_CLV_After, 4800)
      assert.equal(activePool_ETH_After, _9_Ether)
      assert.equal(active_Pool_rawEther_After, _9_Ether)
    })
  })
})

contract('Reset chain state', async accounts => {})
