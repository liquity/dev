const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const getDifference = testHelpers.getDifference
const moneyVals = testHelpers.MoneyValues
const dec = testHelpers.TestHelper.dec

const CLVTokenTester = artifacts.require('CLVTokenTester')
const CLVTokenCaller = artifacts.require('CLVTokenCaller')

contract('CLVToken', async accounts => {
  const [owner, alice, bob, carol] = accounts;
  let clvToken
  let clvTokenCaller
  let stabilityPool

  describe('Basic token functions', async () => {
    beforeEach(async () => {
      const contracts = await deploymentHelper.deployLiquityCore()
      clvToken = await CLVTokenTester.new()
      clvTokenCaller = await CLVTokenCaller.new(clvToken.address)
      await clvToken.setAddresses(
        clvTokenCaller.address,
        clvTokenCaller.address,
        clvTokenCaller.address
      )
      stabilityPool = clvTokenCaller
      
      const LQTYContracts = await deploymentHelper.deployLQTYContracts()
  
      await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
      await deploymentHelper.connectLQTYContracts(LQTYContracts)
      await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

      contracts.clvToken = clvToken
      contracts.stabilityPool = stabilityPool

      // mint some tokens
      await clvTokenCaller.clvMint(alice, 150)
      await clvTokenCaller.clvMint(bob, 100)
      await clvTokenCaller.clvMint(carol, 50)
    })

    it('balanceOf: gets the balance of the account', async () => {
      const aliceBalance = (await clvToken.balanceOf(alice)).toNumber()
      const bobBalance = (await clvToken.balanceOf(bob)).toNumber()
      const carolBalance = (await clvToken.balanceOf(carol)).toNumber()

      assert.equal(aliceBalance, 150)
      assert.equal(bobBalance, 100)
      assert.equal(carolBalance, 50)
    })

    it('_totalSupply(): gets the total supply', async () => {
      const total = (await clvToken._totalSupply()).toString()
      assert.equal(total, '300') // 300
    })

    it('mint(): issues correct amount of tokens to the given address', async () => {
      const alice_balanceBefore = await clvToken.balanceOf(alice)
      assert.equal(alice_balanceBefore, 150)

      await clvTokenCaller.clvMint(alice, 100)

      const alice_BalanceAfter = await clvToken.balanceOf(alice)
      assert.equal(alice_BalanceAfter, 250)
    })

    it('burn(): burns correct amount of tokens from the given address', async () => {
      const alice_balanceBefore = await clvToken.balanceOf(alice)
      assert.equal(alice_balanceBefore, 150)

      await clvTokenCaller.clvBurn(alice, 70)

      const alice_BalanceAfter = await clvToken.balanceOf(alice)
      assert.equal(alice_BalanceAfter, 80)
    })

    // TODO: Rewrite this test - it should check the actual clvTokenCaller's balance.
    it('sendToPool(): changes balances of Stability pool and user by the correct amounts', async () => {
      const stabilityPool_BalanceBefore = await clvToken.balanceOf(stabilityPool.address)
      const bob_BalanceBefore = await clvToken.balanceOf(bob)
      assert.equal(stabilityPool_BalanceBefore, 0)
      assert.equal(bob_BalanceBefore, 100)

      await clvTokenCaller.clvSendToPool(bob, stabilityPool.address, 75)

      const stabilityPool_BalanceAfter = await clvToken.balanceOf(stabilityPool.address)
      const bob_BalanceAfter = await clvToken.balanceOf(bob)
      assert.equal(stabilityPool_BalanceAfter, 75)
      assert.equal(bob_BalanceAfter, 25)
    })

    it('returnFromPool(): changes balances of Stability pool and user by the correct amounts', async () => {
      /// --- SETUP --- give pool 100 CLV
      await clvTokenCaller.clvMint(stabilityPool.address, 100)
      
      /// --- TEST --- 
      const stabilityPool_BalanceBefore = await clvToken.balanceOf(stabilityPool.address)
      const  bob_BalanceBefore = await clvToken.balanceOf(bob)
      assert.equal(stabilityPool_BalanceBefore, 100)
      assert.equal(bob_BalanceBefore, 100)

      await clvTokenCaller.clvReturnFromPool(stabilityPool.address, bob, 75)

      const stabilityPool_BalanceAfter = await clvToken.balanceOf(stabilityPool.address)
      const bob_BalanceAfter = await clvToken.balanceOf(bob)
      assert.equal(stabilityPool_BalanceAfter, 25)
      assert.equal(bob_BalanceAfter, 175)
    })
  })
})

contract('Reset chain state', async accounts => {})
