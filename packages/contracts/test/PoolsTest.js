const StabilityPool = artifacts.require("./StabilityPool.sol")
const ActivePool = artifacts.require("./ActivePool.sol")
const DefaultPool = artifacts.require("./DefaultPool.sol")

const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec

const ZERO_ADDRESS = th.ZERO_ADDRESS

const _minus_1_Ether = web3.utils.toWei('-1', 'ether')

contract('StabilityPool', async accounts => {
  /* mock* are EOA’s, temporarily used to call protected functions.
  TODO: Replace with mock contracts, and later complete transactions from EOA
  */
  let stabilityPool

  const [owner, mockActivePoolAddress, alice] = accounts;
  beforeEach(async () => {
    stabilityPool = await StabilityPool.new()
    await stabilityPool.setAddresses(ZERO_ADDRESS, ZERO_ADDRESS, mockActivePoolAddress, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS)
  })

  it('getETH(): gets the recorded ETH balance', async () => {
    const recordedETHBalance = await stabilityPool.getETH()
    assert.equal(recordedETHBalance, 0)
  })

  it('getTotalCLVDeposits(): gets the recorded CLV balance', async () => {
    const recordedETHBalance = await stabilityPool.getTotalCLVDeposits()
    assert.equal(recordedETHBalance, 0)
  })
})

contract('ActivePool', async accounts => {

  let activePool

  const [owner, mockBorrowerOperationsAddress, alice] = accounts;
  beforeEach(async () => {
    activePool = await ActivePool.new()
    await activePool.setAddresses(mockBorrowerOperationsAddress, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS)
  })

  it('getETH(): gets the recorded ETH balance', async () => {
    const recordedETHBalance = await activePool.getETH()
    assert.equal(recordedETHBalance, 0)
  })

  it('getCLVDebt(): gets the recorded CLV balance', async () => {
    const recordedETHBalance = await activePool.getCLVDebt()
    assert.equal(recordedETHBalance, 0)
  })
 
  it('increaseCLV(): increases the recorded CLV balance by the correct amount', async () => {
    const recordedCLV_balanceBefore = await activePool.getCLVDebt()
    assert.equal(recordedCLV_balanceBefore, 0)

    await activePool.increaseCLVDebt(100, { from: mockBorrowerOperationsAddress })
    const recordedCLV_balanceAfter = await activePool.getCLVDebt()
    assert.equal(recordedCLV_balanceAfter, 100)
  })
  // Decrease
  it('decreaseCLV(): decreases the recorded CLV balance by the correct amount', async () => {
    // start the pool on 100 wei
    await activePool.increaseCLVDebt(100, { from: mockBorrowerOperationsAddress })

    const recordedCLV_balanceBefore = await activePool.getCLVDebt()
    assert.equal(recordedCLV_balanceBefore, 100)

    await activePool.decreaseCLVDebt(100, { from: mockBorrowerOperationsAddress })
    const recordedCLV_balanceAfter = await activePool.getCLVDebt()
    assert.equal(recordedCLV_balanceAfter, 0)
  })

  // send raw ether
  it('sendETH(): decreases the recorded ETH balance by the correct amount', async () => {
    // setup: give pool 2 ether
    const activePool_initialBalance = web3.utils.toBN(await web3.eth.getBalance(activePool.address))
    assert.equal(activePool_initialBalance, 0)
    await web3.eth.sendTransaction({ from: mockBorrowerOperationsAddress, to: activePool.address, value: dec(2, 'ether') }) // start pool with 2 ether 

    const activePool_BalanceBeforeTx = web3.utils.toBN(await web3.eth.getBalance(activePool.address))
    const alice_Balance_BeforeTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    assert.equal(activePool_BalanceBeforeTx, dec(2, 'ether'))
    
    //send ether from pool to alice
    await activePool.sendETH(alice, dec(1, 'ether'), { from: mockBorrowerOperationsAddress })
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

  const [owner, mockCDPManagerAddress, mockActivePoolAddress, alice] = accounts;
  beforeEach(async () => {
    defaultPool = await DefaultPool.new()
    await defaultPool.setAddresses(mockCDPManagerAddress, mockActivePoolAddress)
  })

  it('getETH(): gets the recorded CLV balance', async () => {
    const recordedETHBalance = await defaultPool.getETH()
    assert.equal(recordedETHBalance, 0)
  })

  it('getCLVDebt(): gets the recorded CLV balance', async () => {
    const recordedETHBalance = await defaultPool.getCLVDebt()
    assert.equal(recordedETHBalance, 0)
  })
 
  it('increaseCLV(): increases the recorded CLV balance by the correct amount', async () => {
    const recordedCLV_balanceBefore = await defaultPool.getCLVDebt()
    assert.equal(recordedCLV_balanceBefore, 0)

    await defaultPool.increaseCLVDebt(100, { from: mockCDPManagerAddress })
    const recordedCLV_balanceAfter = await defaultPool.getCLVDebt()
    assert.equal(recordedCLV_balanceAfter, 100)
  })
  
  it('decreaseCLV(): decreases the recorded CLV balance by the correct amount', async () => {
    // start the pool on 100 wei
    await defaultPool.increaseCLVDebt(100, { from: mockCDPManagerAddress })

    const recordedCLV_balanceBefore = await defaultPool.getCLVDebt()
    assert.equal(recordedCLV_balanceBefore, 100)

    await defaultPool.decreaseCLVDebt(100, { from: mockCDPManagerAddress })
    const recordedCLV_balanceAfter = await defaultPool.getCLVDebt()
    assert.equal(recordedCLV_balanceAfter, 0)
  })

  // send raw ether
  it('sendETH(): decreases the recorded ETH balance by the correct amount', async () => {
    // setup: give pool 2 ether
    const defaultPool_initialBalance = web3.utils.toBN(await web3.eth.getBalance(defaultPool.address))
    assert.equal(defaultPool_initialBalance, 0)
    await web3.eth.sendTransaction({ from: mockActivePoolAddress, to: defaultPool.address, value: dec(2, 'ether') }) // start pool with 2 ether 

    const defaultPool_BalanceBeforeTx = web3.utils.toBN(await web3.eth.getBalance(defaultPool.address))
    const alice_Balance_BeforeTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    assert.equal(defaultPool_BalanceBeforeTx, dec(2, 'ether'))
    
    //send ether from pool to alice
    await defaultPool.sendETH(alice, dec(1, 'ether'), { from: mockCDPManagerAddress })
    const defaultPool_BalanceAfterTx = web3.utils.toBN(await web3.eth.getBalance(defaultPool.address))
    const alice_Balance_AfterTx = web3.utils.toBN(await web3.eth.getBalance(alice))

    const alice_BalanceChange = alice_Balance_AfterTx.sub(alice_Balance_BeforeTx)
    const pool_BalanceChange = defaultPool_BalanceAfterTx.sub(defaultPool_BalanceBeforeTx)
    assert.equal(alice_BalanceChange, dec(1, 'ether'))
    assert.equal(pool_BalanceChange, _minus_1_Ether)
  })
})

contract('Reset chain state', async accounts => {})
