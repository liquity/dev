const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const getDifference = testHelpers.getDifference
const moneyVals = testHelpers.MoneyValues
const dec = testHelpers.TestHelper.dec

const PoolManagerTester = artifacts.require('PoolManagerTester')

contract('CLVToken', async accounts => {
  const [owner, alice, bob, carol] = accounts;
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

  describe('Basic token functions', async () => {
    beforeEach(async () => {
      const contracts = await deployLiquity()
      contracts.poolManager = await PoolManagerTester.new()

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
      
      // add CDPs for three test users
      await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(0, carol, { from: carol, value: dec(1, 'ether') })

      // Three test users withdraw CLV
      await borrowerOperations.withdrawCLV(150, alice, { from: alice }) 
      await borrowerOperations.withdrawCLV(100, alice, { from: bob })
      await borrowerOperations.withdrawCLV(50, alice, { from: carol })
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
      const total = (await clvToken._totalSupply()).toNumber()
      assert.equal(total, 300)
    })

    it('setPoolAddress(): gets pool address', async () => {
      const poolManagerAddress = await clvToken.poolManagerAddress()
      assert.equal(poolManagerAddress, poolManager.address)
    })

    it('mint(): issues correct amount of tokens to the given address', async () => {
      const alice_balanceBefore = await clvToken.balanceOf(alice)
      assert.equal(alice_balanceBefore, 150)

      await poolManager.clvMint(alice, 100)

      const alice_BalanceAfter = await clvToken.balanceOf(alice)
      assert.equal(alice_BalanceAfter, 250)
    })

    it('burn(): burns correct amount of tokens from the given address', async () => {
      const alice_balanceBefore = await clvToken.balanceOf(alice)
      assert.equal(alice_balanceBefore, 150)

      await poolManager.clvBurn(alice, 70)

      const alice_BalanceAfter = await clvToken.balanceOf(alice)
      assert.equal(alice_BalanceAfter, 80)
    })

    // TODO: Rewrite this test - it should check the actual poolManager's balance.
    it('sendToPool(): changes balances of Stability pool and user by the correct amounts', async () => {
      const stabilityPool_BalanceBefore = await clvToken.balanceOf(stabilityPool.address)
      const bob_BalanceBefore = await clvToken.balanceOf(bob)
      assert.equal(stabilityPool_BalanceBefore, 0)
      assert.equal(bob_BalanceBefore, 100)

      await poolManager.clvSendToPool(bob, stabilityPool.address, 75)

      const stabilityPool_BalanceAfter = await clvToken.balanceOf(stabilityPool.address)
      const bob_BalanceAfter = await clvToken.balanceOf(bob)
      assert.equal(stabilityPool_BalanceAfter, 75)
      assert.equal(bob_BalanceAfter, 25)
    })

    it('returnFromPool(): changes balances of Stability pool and user by the correct amounts', async () => {
      /// --- SETUP --- give pool 100 CLV
      await poolManager.clvMint(stabilityPool.address, 100)
      
      /// --- TEST --- 
      const stabilityPool_BalanceBefore = await clvToken.balanceOf(stabilityPool.address)
      const  bob_BalanceBefore = await clvToken.balanceOf(bob)
      assert.equal(stabilityPool_BalanceBefore, 100)
      assert.equal(bob_BalanceBefore, 100)

      await poolManager.clvReturnFromPool(stabilityPool.address, bob, 75)

      const stabilityPool_BalanceAfter = await clvToken.balanceOf(stabilityPool.address)
      const bob_BalanceAfter = await clvToken.balanceOf(bob)
      assert.equal(stabilityPool_BalanceAfter, 25)
      assert.equal(bob_BalanceAfter, 175)
    })
  })
})

contract('Reset chain state', async accounts => {})