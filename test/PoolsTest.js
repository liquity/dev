const StabilityPool = artifacts.require("./StabilityPool.sol")
const ActivePool = artifacts.require("./StabilityPool.sol")
const DefaultPool = artifacts.require("./StabilityPool.sol")

const _2_Ether = web3.utils.toWei('2', 'ether')
const _1_Ether = web3.utils.toWei('1', 'ether')
const _100_Ether = web3.utils.toWei('100', 'ether')
const _101_ether = web3.utils.toWei('101', 'ether')

contract('StabilityPool', async accounts => {
  /* mockPoolManager is an EOA, temporarily used to call PoolManager functions.
  TODO: Replace with a mockPoolManager contract, and later complete transactions from EOA -> CDPManager -> PoolManager -> CLVToken.
  */
  let stabilityPool

  const [owner, mockPoolManagerAddress, alice] = accounts;
  beforeEach(async () => {
    stabilityPool = await StabilityPool.new()
    await stabilityPool.setPoolManagerAddress(mockPoolManagerAddress)
    recordedPMAddress = await stabilityPool.getPoolManagerAddress()
  })

  it('poolManagerAddress: sets and gets the poolManager address', async () => {
    await stabilityPool.setPoolManagerAddress(mockPoolManagerAddress)
    const recordedPMAddress = await stabilityPool.getPoolManagerAddress()
    assert.equal(mockPoolManagerAddress, recordedPMAddress)
  })

  it('getETH: gets the recorded CLV balance', async () => {
    const recordedETHBalance = await stabilityPool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })

  it('getCLV: gets the recorded CLV balance', async () => {
    const recordedETHBalance = await stabilityPool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })
  // Increase records
  it('increaseETH: increases the recorded ETH balance by the correct amount', async () => {
    const recordedETH_balanceBefore = await stabilityPool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETH_balanceBefore, 0)

    stabilityPool.increaseETH(_1_Ether, { from: mockPoolManagerAddress })
    const recordedETH_balanceAfter = await stabilityPool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETH_balanceAfter, _1_Ether)
  })

  it('increaseCLV: increases the recorded CLV balance by the correct amount', async () => {
    const recordedCLV_balanceBefore = await stabilityPool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceBefore, 0)

    stabilityPool.increaseCLV(100, { from: mockPoolManagerAddress })
    const recordedCLV_balanceAfter = await stabilityPool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceAfter, 100)
  })
  // Decrease
  it('decreaseCLV: decreases the recorded CLV balance by the correct amount', async () => {
    // start the pool on 100 wei
    stabilityPool.increaseCLV(100, { from: mockPoolManagerAddress })

    const recordedCLV_balanceBefore = await stabilityPool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceBefore, 100)

    stabilityPool.decreaseCLV(100, { from: mockPoolManagerAddress })
    const recordedCLV_balanceAfter = await stabilityPool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceAfter, 0)
  })

  // send raw ether
  it('sendETH: decreases the recorded ETH balance by the correct amount', async () => {
    // setup: give pool 2 ether
    stabilityPool_initialBalance = await web3.eth.getBalance(stabilityPool.address)
    assert.equal(stabilityPool_initialBalance, 0)
    await web3.eth.sendTransaction({ from: mockPoolManagerAddress, to: stabilityPool.address, value: _2_Ether }) // start pool with 2 ether 
    await stabilityPool.increaseETH(_2_Ether, { from: mockPoolManagerAddress })

    stabilityPool_BalanceBeforeTx = await web3.eth.getBalance(stabilityPool.address)
    const alice_Balance_BeforeTx = await web3.eth.getBalance(alice)

    assert.equal(stabilityPool_BalanceBeforeTx, _2_Ether)
    assert.equal(alice_Balance_BeforeTx, _100_Ether)

    //send ether from pool to alice
    await stabilityPool.sendETH(alice, _1_Ether, { from: mockPoolManagerAddress })
    stabilityPool_BalanceAfterTx = await web3.eth.getBalance(stabilityPool.address)
    alice_Balance_AfterTx = await web3.eth.getBalance(alice)

    assert.equal(stabilityPool_BalanceAfterTx, _1_Ether)
    assert.equal(alice_Balance_AfterTx, _101_ether)
  })
})

contract('ActivePool', async accounts => {

  let activePool

  const [owner, mockPoolManagerAddress, alice] = accounts;
  beforeEach(async () => {
    activePool = await ActivePool.new()
    await activePool.setPoolManagerAddress(mockPoolManagerAddress)
    recordedPMAddress = await activePool.getPoolManagerAddress()
  })

  it('poolManagerAddress: sets and gets the poolManager address', async () => {
    await activePool.setPoolManagerAddress(mockPoolManagerAddress)
    const recordedPMAddress = await activePool.getPoolManagerAddress()
    assert.equal(mockPoolManagerAddress, recordedPMAddress)
  })

  it('getETH: gets the recorded CLV balance', async () => {
    const recordedETHBalance = await activePool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })

  it('getCLV: gets the recorded CLV balance', async () => {
    const recordedETHBalance = await activePool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })
  // Increase records
  it('increaseETH: increases the recorded ETH balance by the correct amount', async () => {
    const recordedETH_balanceBefore = await activePool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETH_balanceBefore, 0)

    activePool.increaseETH(_1_Ether, { from: mockPoolManagerAddress })
    const recordedETH_balanceAfter = await activePool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETH_balanceAfter, _1_Ether)
  })

  it('increaseCLV: increases the recorded CLV balance by the correct amount', async () => {
    const recordedCLV_balanceBefore = await activePool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceBefore, 0)

    activePool.increaseCLV(100, { from: mockPoolManagerAddress })
    const recordedCLV_balanceAfter = await activePool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceAfter, 100)
  })
  // Decrease
  it('decreaseCLV: decreases the recorded CLV balance by the correct amount', async () => {
    // start the pool on 100 wei
    activePool.increaseCLV(100, { from: mockPoolManagerAddress })

    const recordedCLV_balanceBefore = await activePool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceBefore, 100)

    activePool.decreaseCLV(100, { from: mockPoolManagerAddress })
    const recordedCLV_balanceAfter = await activePool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceAfter, 0)
  })

  // send raw ether
  it('sendETH: decreases the recorded ETH balance by the correct amount', async () => {
    // setup: give pool 2 ether
    activePool_initialBalance = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_initialBalance, 0)
    await web3.eth.sendTransaction({ from: mockPoolManagerAddress, to: activePool.address, value: _2_Ether }) // start pool with 2 ether 
    await activePool.increaseETH(_2_Ether, { from: mockPoolManagerAddress })

    activePool_BalanceBeforeTx = await web3.eth.getBalance(activePool.address)
    const alice_Balance_BeforeTx = await web3.eth.getBalance(alice)

    assert.equal(activePool_BalanceBeforeTx, _2_Ether)
    assert.equal(alice_Balance_BeforeTx, _100_Ether)

    //send ether from pool to alice
    await activePool.sendETH(alice, _1_Ether, { from: mockPoolManagerAddress })
    activePool_BalanceAfterTx = await web3.eth.getBalance(activePool.address)
    alice_Balance_AfterTx = await web3.eth.getBalance(alice)

    assert.equal(activePool_BalanceAfterTx, _1_Ether)
    assert.equal(alice_Balance_AfterTx, _101_ether)
  })
})

contract('DefaultPool', async accounts => {
 
  let defaultPool

  const [owner, mockPoolManagerAddress, alice] = accounts;
  beforeEach(async () => {
    defaultPool = await DefaultPool.new()
    await defaultPool.setPoolManagerAddress(mockPoolManagerAddress)
    recordedPMAddress = await defaultPool.getPoolManagerAddress()
  })

  it('poolManagerAddress: sets and gets the poolManager address', async () => {
    await defaultPool.setPoolManagerAddress(mockPoolManagerAddress)
    const recordedPMAddress = await defaultPool.getPoolManagerAddress()
    assert.equal(mockPoolManagerAddress, recordedPMAddress)
  })

  it('getETH: gets the recorded CLV balance', async () => {
    const recordedETHBalance = await defaultPool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })

  it('getCLV: gets the recorded CLV balance', async () => {
    const recordedETHBalance = await defaultPool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })
  // Increase records
  it('increaseETH: increases the recorded ETH balance by the correct amount', async () => {
    const recordedETH_balanceBefore = await defaultPool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETH_balanceBefore, 0)

    defaultPool.increaseETH(100, { from: mockPoolManagerAddress })
    const recordedETH_balanceAfter = await defaultPool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETH_balanceAfter, 100)
  })

  it('increaseCLV: increases the recorded CLV balance by the correct amount', async () => {
    const recordedCLV_balanceBefore = await defaultPool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceBefore, 0)

    defaultPool.increaseCLV(100, { from: mockPoolManagerAddress })
    const recordedCLV_balanceAfter = await defaultPool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceAfter, 100)
  })
  // Decrease
  it('decreaseCLV: decreases the recorded CLV balance by the correct amount', async () => {
    // start the pool on 100 wei
    defaultPool.increaseCLV(100, { from: mockPoolManagerAddress })

    const recordedCLV_balanceBefore = await defaultPool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceBefore, 100)

    defaultPool.decreaseCLV(100, { from: mockPoolManagerAddress })
    const recordedCLV_balanceAfter = await defaultPool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceAfter, 0)
  })

  // send raw ether
  it('sendETH: decreases the recorded ETH balance by the correct amount', async () => {
    // setup: give pool 2 ether
    defaultPool_initialBalance = await web3.eth.getBalance(defaultPool.address)
    assert.equal(stabilityPool_initialBalance, 0)
    await web3.eth.sendTransaction({ from: mockPoolManagerAddress, to: defaultPool.address, value: _2_Ether }) // start pool with 2 ether 
    await defaultPool.increaseETH(_2_Ether, { from: mockPoolManagerAddress })

    defaultPool_BalanceBeforeTx = await web3.eth.getBalance(defaultPool.address)
    const alice_Balance_BeforeTx = await web3.eth.getBalance(alice)

    assert.equal(defaultPool_BalanceBeforeTx, _2_Ether)
    assert.equal(alice_Balance_BeforeTx, _100_Ether)

    //send ether from pool to alice
    await defaultPool.sendETH(alice, _1_Ether, { from: mockPoolManagerAddress })
    defaultPool_BalanceAfterTx = await web3.eth.getBalance(defaultPool.address)
    alice_Balance_AfterTx = await web3.eth.getBalance(alice)

    assert.equal(defaultPool_BalanceAfterTx, _1_Ether)
    assert.equal(alice_Balance_AfterTx, _101_ether)
  })
})