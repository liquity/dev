const StabilityPool = artifacts.require("./StabilityPool.sol")
const ActivePool = artifacts.require("./ActivePool.sol")
const DefaultPool = artifacts.require("./DefaultPool.sol")

const testHelpers = require("../utils/testHelpers.js")
const { ZERO_ADDRESS } = require("../utils/deploymentHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec

const _minus_1_Ether = web3.utils.toWei('-1', 'ether')



contract('StabilityPool', async accounts => {
  /* mockPoolManager is an EOA, temporarily used to call PoolManager functions.
  TODO: Replace with a mockPoolManager contract, and later complete transactions from EOA -> CDPManager -> PoolManager -> CLVToken.
  */
  let stabilityPool

  const [owner, mockPoolManagerAddress, alice] = accounts;
  beforeEach(async () => {
    stabilityPool = await StabilityPool.new()
    await stabilityPool.setAddresses(mockPoolManagerAddress, ZERO_ADDRESS, ZERO_ADDRESS)
  })

  it('poolManagerAddress(): gets the poolManager address', async () => {
    const recordedPMAddress = await stabilityPool.poolManagerAddress()
    assert.equal(mockPoolManagerAddress, recordedPMAddress)
  })

  it('getETH(): gets the recorded ETH balance', async () => {
    const recordedETHBalance = await stabilityPool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })

  it('getCLV(): gets the recorded CLV balance', async () => {
    const recordedETHBalance = await stabilityPool.getCLV({ from: mockPoolManagerAddress })
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
    const stabilityPool_initialBalance = web3.utils.toBN(await web3.eth.getBalance(stabilityPool.address))
    assert.equal(stabilityPool_initialBalance, 0)
    await web3.eth.sendTransaction({ from: mockPoolManagerAddress, to: stabilityPool.address, value: dec(2, 'ether') }) // start pool with 2 ether 

    const stabilityPool_BalanceBeforeTx = web3.utils.toBN(await web3.eth.getBalance(stabilityPool.address))
    const alice_Balance_BeforeTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    assert.equal(stabilityPool_BalanceBeforeTx, dec(2, 'ether'))
    
    //send ether from pool to alice
    await stabilityPool.sendETH(alice, dec(1, 'ether'), { from: mockPoolManagerAddress })
    const stabilityPool_BalanceAfterTx = web3.utils.toBN(await web3.eth.getBalance(stabilityPool.address))
    const alice_Balance_AfterTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    const alice_BalanceChange = alice_Balance_AfterTx.sub(alice_Balance_BeforeTx)
    const pool_BalanceChange = stabilityPool_BalanceAfterTx.sub(stabilityPool_BalanceBeforeTx)
    assert.equal(alice_BalanceChange, dec(1, 'ether'))
    assert.equal(pool_BalanceChange, _minus_1_Ether)
  })
})

contract('ActivePool', async accounts => {

  let activePool

  const [owner, mockPoolManagerAddress, alice] = accounts;
  beforeEach(async () => {
    activePool = await ActivePool.new()
    await activePool.setAddresses(mockPoolManagerAddress, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS)
  })

  it('poolManagerAddress(): gets the poolManager address', async () => {
    const recordedPMAddress = await activePool.poolManagerAddress()
    assert.equal(mockPoolManagerAddress, recordedPMAddress)
  })

  it('getETH(): gets the recorded ETH balance', async () => {
    const recordedETHBalance = await activePool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })

  it('getCLVDebt(): gets the recorded CLV balance', async () => {
    const recordedETHBalance = await activePool.getCLVDebt({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })
 
  it('increaseCLV(): increases the recorded CLV balance by the correct amount', async () => {
    const recordedCLV_balanceBefore = await activePool.getCLVDebt({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceBefore, 0)

    await activePool.increaseCLVDebt(100, { from: mockPoolManagerAddress })
    const recordedCLV_balanceAfter = await activePool.getCLVDebt({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceAfter, 100)
  })
  // Decrease
  it('decreaseCLV(): decreases the recorded CLV balance by the correct amount', async () => {
    // start the pool on 100 wei
    await activePool.increaseCLVDebt(100, { from: mockPoolManagerAddress })

    const recordedCLV_balanceBefore = await activePool.getCLVDebt({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceBefore, 100)

    await activePool.decreaseCLVDebt(100, { from: mockPoolManagerAddress })
    const recordedCLV_balanceAfter = await activePool.getCLVDebt({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceAfter, 0)
  })

  // send raw ether
  it('sendETH(): decreases the recorded ETH balance by the correct amount', async () => {
    // setup: give pool 2 ether
    const activePool_initialBalance = web3.utils.toBN(await web3.eth.getBalance(activePool.address))
    assert.equal(activePool_initialBalance, 0)
    await web3.eth.sendTransaction({ from: mockPoolManagerAddress, to: activePool.address, value: dec(2, 'ether') }) // start pool with 2 ether 

    const activePool_BalanceBeforeTx = web3.utils.toBN(await web3.eth.getBalance(activePool.address))
    const alice_Balance_BeforeTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    assert.equal(activePool_BalanceBeforeTx, dec(2, 'ether'))
    
    //send ether from pool to alice
    await activePool.sendETH(alice, dec(1, 'ether'), { from: mockPoolManagerAddress })
    const activePool_BalanceAfterTx = web3.utils.toBN(await web3.eth.getBalance(activePool.address))
    const alice_Balance_AfterTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    const alice_BalanceChange = alice_Balance_AfterTx.sub(alice_Balance_BeforeTx)
    const pool_BalanceChange = activePool_BalanceAfterTx.sub(activePool_BalanceBeforeTx)
    assert.equal(alice_BalanceChange, dec(1, 'ether'))
    assert.equal(pool_BalanceChange, _minus_1_Ether)
  })
})

contract('DefaultPool', async accounts => {
 
  let defaultPool

  const [owner, mockPoolManagerAddress, alice] = accounts;
  beforeEach(async () => {
    defaultPool = await DefaultPool.new()
    await defaultPool.setAddresses(mockPoolManagerAddress, ZERO_ADDRESS, ZERO_ADDRESS)
  })

  it('poolManagerAddress(): gets the poolManager address', async () => {
    const recordedPMAddress = await defaultPool.poolManagerAddress()
    assert.equal(mockPoolManagerAddress, recordedPMAddress)
  })

  it('getETH(): gets the recorded CLV balance', async () => {
    const recordedETHBalance = await defaultPool.getETH({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })

  it('getCLVDebt(): gets the recorded CLV balance', async () => {
    const recordedETHBalance = await defaultPool.getCLVDebt({ from: mockPoolManagerAddress })
    assert.equal(recordedETHBalance, 0)
  })
 
  it('increaseCLV(): increases the recorded CLV balance by the correct amount', async () => {
    const recordedCLV_balanceBefore = await defaultPool.getCLVDebt({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceBefore, 0)

    await defaultPool.increaseCLVDebt(100, { from: mockPoolManagerAddress })
    const recordedCLV_balanceAfter = await defaultPool.getCLVDebt({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceAfter, 100)
  })
  
  it('decreaseCLV(): decreases the recorded CLV balance by the correct amount', async () => {
    // start the pool on 100 wei
    await defaultPool.increaseCLVDebt(100, { from: mockPoolManagerAddress })

    const recordedCLV_balanceBefore = await defaultPool.getCLVDebt({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceBefore, 100)

    await defaultPool.decreaseCLVDebt(100, { from: mockPoolManagerAddress })
    const recordedCLV_balanceAfter = await defaultPool.getCLVDebt({ from: mockPoolManagerAddress })
    assert.equal(recordedCLV_balanceAfter, 0)
  })

  // send raw ether
  it('sendETH(): decreases the recorded ETH balance by the correct amount', async () => {
    // setup: give pool 2 ether
    const defaultPool_initialBalance = web3.utils.toBN(await web3.eth.getBalance(defaultPool.address))
    assert.equal(defaultPool_initialBalance, 0)
    await web3.eth.sendTransaction({ from: mockPoolManagerAddress, to: defaultPool.address, value: dec(2, 'ether') }) // start pool with 2 ether 

    const defaultPool_BalanceBeforeTx = web3.utils.toBN(await web3.eth.getBalance(defaultPool.address))
    const alice_Balance_BeforeTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    assert.equal(defaultPool_BalanceBeforeTx, dec(2, 'ether'))
    
    //send ether from pool to alice
    await defaultPool.sendETH(alice, dec(1, 'ether'), { from: mockPoolManagerAddress })
    const defaultPool_BalanceAfterTx = web3.utils.toBN(await web3.eth.getBalance(defaultPool.address))
    const alice_Balance_AfterTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    const alice_BalanceChange = alice_Balance_AfterTx.sub(alice_Balance_BeforeTx)
    const pool_BalanceChange = defaultPool_BalanceAfterTx.sub(defaultPool_BalanceBeforeTx)
    assert.equal(alice_BalanceChange, dec(1, 'ether'))
    assert.equal(pool_BalanceChange, _minus_1_Ether)
  })
})

contract('Reset chain state', async accounts => {})