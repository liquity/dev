const PoolManager = artifacts.require("./PoolManager.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const NameRegistry = artifacts.require("./NameRegistry.sol")

const deploymentHelpers = require("../utils/deploymentHelpers.js")
const getAddresses = deploymentHelpers.getAddresses
const setNameRegistry = deploymentHelpers.setNameRegistry
const connectContracts = deploymentHelpers.connectContracts
const getAddressesFromNameRegistry = deploymentHelpers.getAddressesFromNameRegistry

contract('CLVToken', async accounts => {
  /* mockPool is an EOA, temporarily used to call PoolManager functions.
  TODO: Replace with a mockPool contract, and later complete transactions from EOA -> CDPManager -> PoolManager -> CLVToken.
  */
  const [owner, mockPool, alice, bob, carol] = accounts;
  let priceFeed;
  let clvToken;
  let poolManager;
  let cdpManager;
  let nameRegistry;

  describe('Basic token functions', function () {
    beforeEach(async () => {
      priceFeed = await PriceFeed.new()
      clvToken = await CLVToken.new()
      poolManager = await PoolManager.new()
      cdpManager = await CDPManager.new()
      nameRegistry = await NameRegistry.new()

      contracts = { priceFeed, clvToken, poolManager, cdpManager, nameRegistry }
      contractAddresses = getAddresses(contracts)
      await setNameRegistry(contractAddresses, nameRegistry, { from: owner })
      const registeredAddresses = await getAddressesFromNameRegistry(nameRegistry)

      // TODO: Extract this to helper function and debug connectContracts()
      // connectContracts(contracts, registeredAddresses, {from: owner})
      await contracts.clvToken.setPoolAddress(registeredAddresses.PoolManager)
      await contracts.poolManager.setCDPManagerAddress(registeredAddresses.CDPManager)
      await contracts.poolManager.setCLVToken(registeredAddresses.CLVToken)
      await contracts.poolManager.setPriceFeed(registeredAddresses.PriceFeed)
      await contracts.cdpManager.setCLVToken(registeredAddresses.CLVToken)
      await contracts.cdpManager.setPoolManager(registeredAddresses.PoolManager)
      await contracts.cdpManager.setPriceFeed(registeredAddresses.PriceFeed)

      // add CDPs for three test users
      await cdpManager.mockAddCDP({ from: alice })
      await cdpManager.mockAddCDP({ from: bob })
      await cdpManager.mockAddCDP({ from: carol })
      // Three test users withdraw CLV
      await cdpManager.withdrawCLV(150, { from: alice })
      await cdpManager.withdrawCLV(100, { from: bob })
      await cdpManager.withdrawCLV(50, { from: carol })
    })

    it('balance: gets the balance', async () => {
      const aliceBalance = (await clvToken.balanceOf(alice)).toNumber()
      const bobBalance = (await clvToken.balanceOf(bob)).toNumber()
      const carolBalance = (await clvToken.balanceOf(carol)).toNumber()

      assert.equal(aliceBalance, 150)
      assert.equal(bobBalance, 100)
      assert.equal(carolBalance, 50)
    })

    it('_totalSupply: gets the total supply', async () => {
      const total = (await clvToken._totalSupply()).toNumber()
      assert.equal(total, 300)
    })

    it('setPoolAddress: sets a new pool address', async () => {
      const newPoolAddr = '0x8f0483125FCb9aaAEFA9209D8E9d7b9C8B9Fb90F'
      await clvToken.setPoolAddress(newPoolAddr, { from: owner })
      const poolAddress = await clvToken.poolAddress()
      assert.equal(newPoolAddr, poolAddress)
    })

    it('setName: sets a name', async () => {
      const newName = 'token contract'
      const bytesName = web3.utils.fromUtf8(newName)
      await clvToken.setName(bytesName, { from: owner })
      const name = web3.utils.toUtf8(await clvToken.name())
      assert.equal(newName, name)
    })

    it('mint: issues correct amount of tokens to the given address', async () => {
      await clvToken.setPoolAddress(mockPool, { from: owner })

      aliceBalance_before = await clvToken.balanceOf(alice)
      assert.equal(aliceBalance_before, 150)

      await clvToken.mint(alice, 100, { from: mockPool })

      aliceBalance_after = await clvToken.balanceOf(alice)
      assert.equal(aliceBalance_after, 250)
    })

    it('burn: burns correct amount of tokens from the given address', async () => {
      await clvToken.setPoolAddress(mockPool, { from: owner })

      aliceBalance_before = await clvToken.balanceOf(alice)
      assert.equal(aliceBalance_before, 150)

      await clvToken.burn(alice, 70, { from: mockPool })

      aliceBalance_after = await clvToken.balanceOf(alice)
      assert.equal(aliceBalance_after, 80)
    })

    // TODO: Rewrite this test - it should check the actual poolManager's balance.
    it('sendToPool: sends correct amount of tokens from account to pool', async () => {
      await clvToken.setPoolAddress(mockPool, { from: owner })

      mockPoolBalance_before = await clvToken.balanceOf(mockPool)
      bobBalance_before = await clvToken.balanceOf(bob)
      assert.equal(mockPoolBalance_before, 0)
      assert.equal(bobBalance_before, 100)

      await clvToken.sendToPool(bob, 75, { from: mockPool })

      mockPoolBalance_after = await clvToken.balanceOf(mockPool)
      bobBalance_after = await clvToken.balanceOf(bob)
      assert.equal(mockPoolBalance_after, 75)
      assert.equal(bobBalance_after, 25)
    })

    it('returnFromPool: sends correct amount of tokens from pool to account', async () => {
      await clvToken.setPoolAddress(mockPool, { from: owner })
      await clvToken.mint(mockPool, 100, { from: mockPool })  // mockPool gives itself 100 CLV for testing

      mockPoolBalance_before = await clvToken.balanceOf(mockPool)
      bobBalance_before = await clvToken.balanceOf(bob)
      assert.equal(mockPoolBalance_before, 100)
      assert.equal(bobBalance_before, 100)

      await clvToken.returnFromPool(bob, 75, { from: mockPool })

      mockPoolBalance_after = await clvToken.balanceOf(mockPool)
      bobBalance_after = await clvToken.balanceOf(bob)
      assert.equal(mockPoolBalance_after, 25)
      assert.equal(bobBalance_after, 175)
    })
  })
})