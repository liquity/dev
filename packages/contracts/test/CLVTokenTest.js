const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const dec = testHelpers.TestHelper.dec
const assertRevert = testHelpers.TestHelper.assertRevert
const ZERO_ADDRESS = testHelpers.TestHelper.ZERO_ADDRESS

const CLVTokenTester = artifacts.require('CLVTokenTester')
const PoolManagerTester = artifacts.require('PoolManagerTester')

contract('CLVToken', async accounts => {
  const [owner, alice, bob, carol] = accounts;

  let clvToken
  let poolManager  
  let cdpManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  describe('Basic token functions', async () => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      contracts.poolManager = await PoolManagerTester.new()
      contracts.clvToken = await CLVTokenTester.new(
        contracts.cdpManager.address,
        contracts.poolManager.address,
        contracts.activePool.address,
        contracts.defaultPool.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address
      )
      clvToken = contracts.clvToken
      poolManager = contracts.poolManager
      cdpManager = contracts.cdpManager
      activePool = contracts.activePool
      stabilityPool = contracts.stabilityPool
      defaultPool = contracts.defaultPool
      borrowerOperations = contracts.borrowerOperations
      hintHelpers = contracts.hintHelpers

      const GTContracts = await deploymentHelper.deployGTContracts()
  
      lqtyStaking = GTContracts.lqtyStaking
      growthToken = GTContracts.growthToken
      communityIssuance = GTContracts.communityIssuance
      lockupContractFactory = GTContracts.lockupContractFactory
  
      await deploymentHelper.connectCoreContracts(contracts, GTContracts)
      await deploymentHelper.connectGTContracts(GTContracts)
      await deploymentHelper.connectGTContractsToCore(GTContracts, contracts)
      
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
      const total = (await clvToken._totalSupply()).toString()
      assert.equal(total, '30000000000000000300') // 300 + 30e18 for gas compensation
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

    it('transfer(): all of these transfers should fail due to inappropriate recipient', async () => {
      await assertRevert(clvToken.transfer(clvToken.address, 1, { from: alice }))
      await assertRevert(clvToken.transfer(ZERO_ADDRESS, 1, { from: alice }))
      await assertRevert(clvToken.transfer(cdpManager.address, 1, { from: alice }))
      await assertRevert(clvToken.transfer(poolManager.address, 1, { from: alice }))
      await assertRevert(clvToken.transfer(activePool.address, 1, { from: alice }))
      await assertRevert(clvToken.transfer(defaultPool.address, 1, { from: alice }))
      await assertRevert(clvToken.transfer(stabilityPool.address, 1, { from: alice }))
      await assertRevert(clvToken.transfer(borrowerOperations.address, 1, { from: alice }))
    })
    it('approve(): all of these approvals should fail due to inappropriate spender', async () => {
      await assertRevert(clvToken.approve(clvToken.address, 1, { from: alice }))
      await assertRevert(clvToken.approve(ZERO_ADDRESS, 1, { from: alice }))
      await assertRevert(clvToken.approve(cdpManager.address, 1, { from: alice }))
      await assertRevert(clvToken.approve(poolManager.address, 1, { from: alice }))
      await assertRevert(clvToken.approve(activePool.address, 1, { from: alice }))
      await assertRevert(clvToken.approve(defaultPool.address, 1, { from: alice }))
      await assertRevert(clvToken.approve(stabilityPool.address, 1, { from: alice }))
      await assertRevert(clvToken.approve(borrowerOperations.address, 1, { from: alice }))
    })
  })
})

contract('Reset chain state', async accounts => {})
