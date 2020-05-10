const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const getDifference = testHelpers.getDifference
const moneyVals = testHelpers.MoneyValues

contract('CLVToken', async accounts => {
  /* mockPool is an EOA, temporarily used to call PoolManager functions.
  TODO: Replace with a mockPool contract, and later complete transactions from EOA -> CDPManager -> PoolManager -> CLVToken.
  */

  const _1_Ether = web3.utils.toWei('1', 'ether')

  const [owner, mockPool, alice, bob, carol] = accounts;
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
      await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
      await borrowerOperations.addColl(bob, bob, { from: bob, value: _1_Ether })
      await borrowerOperations.addColl(carol, carol, { from: carol, value: _1_Ether })

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

    it('setPoolAddress(): sets a new pool address', async () => {
      const newPoolManagerAddr = '0x8f0483125FCb9aaAEFA9209D8E9d7b9C8B9Fb90F'
      await clvToken.setPoolManagerAddress(newPoolManagerAddr, { from: owner })
      const poolManagerAddress = await clvToken.poolManagerAddress()
      assert.equal(newPoolManagerAddr, poolManagerAddress)
    })

    it('mint(): issues correct amount of tokens to the given address', async () => {
      await clvToken.setPoolManagerAddress(mockPool, { from: owner })

      const alice_balanceBefore = await clvToken.balanceOf(alice)
      assert.equal(alice_balanceBefore, 150)

      await clvToken.mint(alice, 100, { from: mockPool })

      const alice_BalanceAfter = await clvToken.balanceOf(alice)
      assert.equal(alice_BalanceAfter, 250)
    })

    it('burn(): burns correct amount of tokens from the given address', async () => {
      await clvToken.setPoolManagerAddress(mockPool, { from: owner })

      const alice_balanceBefore = await clvToken.balanceOf(alice)
      assert.equal(alice_balanceBefore, 150)

      await clvToken.burn(alice, 70, { from: mockPool })

      const alice_BalanceAfter = await clvToken.balanceOf(alice)
      assert.equal(alice_BalanceAfter, 80)
    })

    // TODO: Rewrite this test - it should check the actual poolManager's balance.
    it('sendToPool(): changes balances of Stability pool and user by the correct amounts', async () => {
      await clvToken.setPoolManagerAddress(mockPool, { from: owner })

      const stabilityPool_BalanceBefore = await clvToken.balanceOf(stabilityPool.address)
      const bob_BalanceBefore = await clvToken.balanceOf(bob)
      assert.equal(stabilityPool_BalanceBefore, 0)
      assert.equal(bob_BalanceBefore, 100)

      await clvToken.sendToPool(bob, stabilityPool.address, 75, { from: mockPool })

      const stabilityPool_BalanceAfter = await clvToken.balanceOf(stabilityPool.address)
      const bob_BalanceAfter = await clvToken.balanceOf(bob)
      assert.equal(stabilityPool_BalanceAfter, 75)
      assert.equal(bob_BalanceAfter, 25)
    })

    it('returnFromPool(): changes balances of Stability pool and user by the correct amounts', async () => {
      /// --- SETUP --- give pool 100 CLV
      await clvToken.setPoolManagerAddress(mockPool, { from: owner })
      await clvToken.mint(stabilityPool.address, 100, { from: mockPool })  
      
      /// --- TEST --- 
      const stabilityPool_BalanceBefore = await clvToken.balanceOf(stabilityPool.address)
      const  bob_BalanceBefore = await clvToken.balanceOf(bob)
      assert.equal(stabilityPool_BalanceBefore, 100)
      assert.equal(bob_BalanceBefore, 100)

      await clvToken.returnFromPool(stabilityPool.address, bob, 75, { from: mockPool })

      const stabilityPool_BalanceAfter = await clvToken.balanceOf(stabilityPool.address)
      const bob_BalanceAfter = await clvToken.balanceOf(bob)
      assert.equal(stabilityPool_BalanceAfter, 25)
      assert.equal(bob_BalanceAfter, 175)
    })
  })
})

contract('Reset chain state', async accounts => {})