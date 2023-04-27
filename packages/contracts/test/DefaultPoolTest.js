const testHelpers = require("../utils/testHelpers.js")
const DefaultPool = artifacts.require("./DefaultPool.sol")
const NonPayable = artifacts.require('NonPayable.sol')

const th = testHelpers.TestHelper
const dec = th.dec

contract('DefaultPool', async accounts => {
  let defaultPool
  let nonPayable
  let mockActivePool
  let mockTroveManager

  let [owner] = accounts

  beforeEach('Deploy contracts', async () => {
    defaultPool = await DefaultPool.new()
    nonPayable = await NonPayable.new()
    mockTroveManager = await NonPayable.new()
    mockActivePool = await NonPayable.new()
    await defaultPool.setAddresses(mockTroveManager.address, mockActivePool.address)
  })

  it('sendONEToActivePool(): fails if receiver cannot receive ONE', async () => {
    const amount = dec(1, 'ether')

    // start pool with `amount`
    //await web3.eth.sendTransaction({ to: defaultPool.address, from: owner, value: amount })
    const tx = await mockActivePool.forward(defaultPool.address, '0x', { from: owner, value: amount })
    assert.isTrue(tx.receipt.status)

    // try to send ether from pool to non-payable
    //await th.assertRevert(defaultPool.sendONEToActivePool(amount, { from: owner }), 'DefaultPool: sending ONE failed')
    const sendONEData = th.getTransactionData('sendONEToActivePool(uint256)', [web3.utils.toHex(amount)])
    await th.assertRevert(mockTroveManager.forward(defaultPool.address, sendONEData, { from: owner }), 'DefaultPool: sending ONE failed')
  })
})

contract('Reset chain state', async accounts => { })
