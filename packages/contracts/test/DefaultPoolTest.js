const testHelpers = require("../utils/testHelpers.js")
const DefaultPool = artifacts.require("./DefaultPool.sol");
const NonPayable = artifacts.require('NonPayable.sol')

const th = testHelpers.TestHelper
const dec = th.dec

contract('DefaultPool', async accounts => {
  let defaultPool
  let nonPayable

  let [owner] = accounts

  beforeEach('Deploy contracts', async () => {
    defaultPool = await DefaultPool.new()
    nonPayable = await NonPayable.new()
    await defaultPool.setAddresses(owner, nonPayable.address)
  })

  it('sendETHToActivePool(): fails if receiver cannot receive ETH', async () => {
    const amount = dec(1, 'ether')

    await nonPayable.setPayable(true)
    await nonPayable.forward(defaultPool.address, '0x', { value: amount })
    await nonPayable.setPayable(false)

    await th.assertRevert(defaultPool.sendETHToActivePool(amount, { from: owner }), 'DefaultPool: sending ETH failed')
  })
})

contract('Reset chain state', async accounts => { })
