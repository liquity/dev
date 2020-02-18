const StabilityPool = artifacts.require("./StabilityPool.sol")
const ActivePool = artifacts.require("./StabilityPool.sol")
const DefaultPool = artifacts.require("./StabilityPool.sol")

const _2_Ether = web3.utils.toWei('2', 'ether')
const _1_Ether = web3.utils.toWei('1', 'ether')
const _minus_1_Ether = web3.utils.toWei('-1', 'ether')
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
  })

  it('poolManagerAddress(): sets and gets the poolManager address', async () => {
    await stabilityPool.setPoolManagerAddress(mockPoolManagerAddress)
    const recordedPMAddress = await stabilityPool.poolManagerAddress()
    assert.equal(mockPoolManagerAddress, recordedPMAddress)
  })

  it('getETH(): gets the recorded CLV balance', async () => {
    const recordedETHBalance = await stabilityPool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })

  it('getCLV(): gets the recorded CLV balance', async () => {
    const recordedETHBalance = await stabilityPool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })
  
  it('increaseCLV(): increases the recorded CLV balance by the correct amount', async () => {
    const recordedCLV_balanceBefore = await stabilityPool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceBefore, 0)

    await stabilityPool.increaseCLV(100, { from: mockPoolManagerAddress })
    const recordedCLV_balanceAfter = await stabilityPool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceAfter, 100)
  })
  // Decrease
  it('decreaseCLV(): decreases the recorded CLV balance by the correct amount', async () => {
    // start the pool on 100 wei
    await stabilityPool.increaseCLV(100, { from: mockPoolManagerAddress })

    const recordedCLV_balanceBefore = await stabilityPool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceBefore, 100)

    await stabilityPool.decreaseCLV(100, { from: mockPoolManagerAddress })
    const recordedCLV_balanceAfter = await stabilityPool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceAfter, 0)
  })

  // send raw ether
  it('sendETH(): decreases the recorded ETH balance by the correct amount', async () => {
    // setup: give pool 2 ether
    stabilityPool_initialBalance = web3.utils.toBN(await web3.eth.getBalance(stabilityPool.address))
    assert.equal(stabilityPool_initialBalance, 0)
    await web3.eth.sendTransaction({ from: mockPoolManagerAddress, to: stabilityPool.address, value: _2_Ether }) // start pool with 2 ether 

    stabilityPool_BalanceBeforeTx = web3.utils.toBN(await web3.eth.getBalance(stabilityPool.address))
    const alice_Balance_BeforeTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    assert.equal(stabilityPool_BalanceBeforeTx, _2_Ether)
    
    //send ether from pool to alice
    await stabilityPool.sendETH(alice, _1_Ether, { from: mockPoolManagerAddress })
    stabilityPool_BalanceAfterTx = web3.utils.toBN(await web3.eth.getBalance(stabilityPool.address))
    alice_Balance_AfterTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    const alice_BalanceChange = alice_Balance_AfterTx.sub(alice_Balance_BeforeTx)
    const pool_BalanceChange = stabilityPool_BalanceAfterTx.sub(stabilityPool_BalanceBeforeTx)
    assert.equal(alice_BalanceChange, _1_Ether)
    assert.equal(pool_BalanceChange, _minus_1_Ether)
  })
})

contract('ActivePool', async accounts => {

  let activePool

  const [owner, mockPoolManagerAddress, alice] = accounts;
  beforeEach(async () => {
    activePool = await ActivePool.new()
    await activePool.setPoolManagerAddress(mockPoolManagerAddress)
    recordedPMAddress = await activePool.poolManagerAddress()
  })

  it('poolManagerAddress(): sets and gets the poolManager address', async () => {
    await activePool.setPoolManagerAddress(mockPoolManagerAddress)
    const recordedPMAddress = await activePool.poolManagerAddress()
    assert.equal(mockPoolManagerAddress, recordedPMAddress)
  })

  it('getETH(): gets the recorded CLV balance', async () => {
    const recordedETHBalance = await activePool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })

  it('getCLV(): gets the recorded CLV balance', async () => {
    const recordedETHBalance = await activePool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })
 
  it('increaseCLV(): increases the recorded CLV balance by the correct amount', async () => {
    const recordedCLV_balanceBefore = await activePool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceBefore, 0)

    await activePool.increaseCLV(100, { from: mockPoolManagerAddress })
    const recordedCLV_balanceAfter = await activePool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceAfter, 100)
  })
  // Decrease
  it('decreaseCLV(): decreases the recorded CLV balance by the correct amount', async () => {
    // start the pool on 100 wei
    await activePool.increaseCLV(100, { from: mockPoolManagerAddress })

    const recordedCLV_balanceBefore = await activePool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceBefore, 100)

    await activePool.decreaseCLV(100, { from: mockPoolManagerAddress })
    const recordedCLV_balanceAfter = await activePool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceAfter, 0)
  })

  // send raw ether
  it('sendETH(): decreases the recorded ETH balance by the correct amount', async () => {
    // setup: give pool 2 ether
    activePool_initialBalance = web3.utils.toBN(await web3.eth.getBalance(activePool.address))
    assert.equal(activePool_initialBalance, 0)
    await web3.eth.sendTransaction({ from: mockPoolManagerAddress, to: activePool.address, value: _2_Ether }) // start pool with 2 ether 

    activePool_BalanceBeforeTx = web3.utils.toBN(await web3.eth.getBalance(activePool.address))
    const alice_Balance_BeforeTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    assert.equal(activePool_BalanceBeforeTx, _2_Ether)
    
    //send ether from pool to alice
    await activePool.sendETH(alice, _1_Ether, { from: mockPoolManagerAddress })
    activePool_BalanceAfterTx = web3.utils.toBN(await web3.eth.getBalance(activePool.address))
    alice_Balance_AfterTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    const alice_BalanceChange = alice_Balance_AfterTx.sub(alice_Balance_BeforeTx)
    const pool_BalanceChange = activePool_BalanceAfterTx.sub(activePool_BalanceBeforeTx)
    assert.equal(alice_BalanceChange, _1_Ether)
    assert.equal(pool_BalanceChange, _minus_1_Ether)
  })
})

contract('DefaultPool', async accounts => {
 
  let defaultPool

  const [owner, mockPoolManagerAddress, alice] = accounts;
  beforeEach(async () => {
    defaultPool = await DefaultPool.new()
    await defaultPool.setPoolManagerAddress(mockPoolManagerAddress)
    recordedPMAddress = await defaultPool.poolManagerAddress()
  })

  it('poolManagerAddress(): sets and gets the poolManager address', async () => {
    await defaultPool.setPoolManagerAddress(mockPoolManagerAddress)
    const recordedPMAddress = await defaultPool.poolManagerAddress()
    assert.equal(mockPoolManagerAddress, recordedPMAddress)
  })

  it('getETH(): gets the recorded CLV balance', async () => {
    const recordedETHBalance = await defaultPool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })

  it('getCLV(): gets the recorded CLV balance', async () => {
    const recordedETHBalance = await defaultPool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })
 
  it('increaseCLV(): increases the recorded CLV balance by the correct amount', async () => {
    const recordedCLV_balanceBefore = await defaultPool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceBefore, 0)

    await defaultPool.increaseCLV(100, { from: mockPoolManagerAddress })
    const recordedCLV_balanceAfter = await defaultPool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceAfter, 100)
  })
  
  it('decreaseCLV(): decreases the recorded CLV balance by the correct amount', async () => {
    // start the pool on 100 wei
    await defaultPool.increaseCLV(100, { from: mockPoolManagerAddress })

    const recordedCLV_balanceBefore = await defaultPool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceBefore, 100)

    await defaultPool.decreaseCLV(100, { from: mockPoolManagerAddress })
    const recordedCLV_balanceAfter = await defaultPool.getCLV({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceAfter, 0)
  })

  // send raw ether
  it('sendETH(): decreases the recorded ETH balance by the correct amount', async () => {
    // setup: give pool 2 ether
    defaultPool_initialBalance = web3.utils.toBN(await web3.eth.getBalance(defaultPool.address))
    assert.equal(defaultPool_initialBalance, 0)
    await web3.eth.sendTransaction({ from: mockPoolManagerAddress, to: defaultPool.address, value: _2_Ether }) // start pool with 2 ether 

    defaultPool_BalanceBeforeTx = web3.utils.toBN(await web3.eth.getBalance(defaultPool.address))
    const alice_Balance_BeforeTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    assert.equal(defaultPool_BalanceBeforeTx, _2_Ether)
    
    //send ether from pool to alice
    await defaultPool.sendETH(alice, _1_Ether, { from: mockPoolManagerAddress })
    defaultPool_BalanceAfterTx = web3.utils.toBN(await web3.eth.getBalance(defaultPool.address))
    alice_Balance_AfterTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    const alice_BalanceChange = alice_Balance_AfterTx.sub(alice_Balance_BeforeTx)
    const pool_BalanceChange = defaultPool_BalanceAfterTx.sub(defaultPool_BalanceBeforeTx)
    assert.equal(alice_BalanceChange, _1_Ether)
    assert.equal(pool_BalanceChange, _minus_1_Ether)
  })
})

contract('Reset chain state', async accounts => {})