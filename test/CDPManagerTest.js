// TODO - Refactor duplication across tests. Run only minimum number of contracts
const PoolManager = artifacts.require("./PoolManager.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const NameRegistry = artifacts.require("./NameRegistry.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")

const deploymentHelpers = require("../utils/deploymentHelpers.js")
const getAddresses = deploymentHelpers.getAddresses
const setNameRegistry = deploymentHelpers.setNameRegistry
const connectContracts = deploymentHelpers.connectContracts
const getAddressesFromNameRegistry = deploymentHelpers.getAddressesFromNameRegistry

/* TODO: Mock CDP creation. Currently, testing functions like getCollRatio() via manual CDP creation. 
 Ideally, we add a mock CDP to the mapping and sortedList, and use it as test data.
 Potentially use Doppleganger Ethereum library for mocks. */

contract('CDPManager', async accounts => {
  const _2_Ether = web3.utils.toWei('2', 'ether')
  const _1_Ether = web3.utils.toWei('1', 'ether')
  const _9_Ether = web3.utils.toWei('9', 'ether')
  const _10_Ether = web3.utils.toWei('10', 'ether')
  const _100_Ether = web3.utils.toWei('100', 'ether')
  const _101_Ether = web3.utils.toWei('101', 'ether')

  const [owner, alice, bob, carol] = accounts;
  let priceFeed;
  let clvToken;
  let poolManager;
  let cdpManager;
  let nameRegistry;
  let activePool;
  let stabilityPool;
  let defaultPool;
  let contractAddresses;

  beforeEach(async () => {
    priceFeed = await PriceFeed.new()
    clvToken = await CLVToken.new()
    poolManager = await PoolManager.new()
    cdpManager = await CDPManager.new()
    nameRegistry = await NameRegistry.new()
    activePool = await ActivePool.new()
    stabilityPool = await StabilityPool.new()
    defaultPool = await DefaultPool.new()

    contracts = {
      priceFeed,
      clvToken,
      poolManager,
      cdpManager,
      nameRegistry,
      activePool,
      stabilityPool,
      defaultPool
    }

    contractAddresses = getAddresses(contracts)
    await setNameRegistry(contractAddresses, nameRegistry, { from: owner })
    registeredAddresses = await getAddressesFromNameRegistry(nameRegistry)

    await connectContracts(contracts, registeredAddresses)
  })

  it("userCreateCDP: creates a new CDP for a user", async () => {
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_CDPStatus_Before = alice_CDP_Before[3]   // status is the 4'th property of CDP struct
    
    // in key->struct mappings, when key not present, corresponding struct has properties initialised to 0x0
    assert.equal(alice_CDPStatus_Before, 0 )  

    await cdpManager.userCreateCDP( {from: alice})

    const alice_CDP_after = await cdpManager.CDPs(alice)
    const alice_CDPStatus_After = alice_CDP_after[3]

    assert.equal(alice_CDPStatus_After, 1 )  // The 2nd element of the status enum is 'newBorn' 
   })

   it("userCreateCDP: assigns the correct debt, coll, ICR and status to the CDP", async () => {
    const alice_CDP_Before = await cdpManager.CDPs(alice) 
    
    const debt_Before  = alice_CDP_Before[0]
    const coll_Before = alice_CDP_Before[1]
    const ICR_Before = alice_CDP_Before[2]
    const status_Before = alice_CDP_Before[3]

    assert.equal(debt_Before, 0)
    assert.equal(coll_Before, 0)
    assert.equal(ICR_Before, 0)
    assert.equal(status_Before, 0)

    await cdpManager.userCreateCDP( {from: alice})

    const alice_CDP_After = await cdpManager.CDPs(alice)

    const debt_After  = alice_CDP_After[0]
    const coll_After = alice_CDP_After[1]
    const ICR_After = web3.utils.toHex(alice_CDP_After[2])
    const status_After = alice_CDP_After[3]
    
    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    
    assert.equal(debt_After, 0)
    assert.equal(coll_After, 0)
    assert.equal(ICR_After, maxBytes32)
    assert.equal(status_After, 1)
  })

  it("addColl(), non-existent CDP: creates a new CDP and assigns the correct collateral", async () => {
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    coll_Before =  alice_CDP_Before[1]
    const status_Before = alice_CDP_Before[3]   
    // check before
    assert.equal(coll_Before, 0)
    assert.equal(status_Before, 0 )  // check non-existent status
    
    await cdpManager.addColl({from: alice, value: _1_Ether})

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    const status_After = alice_CDP_After[3]

    // check after
    assert.equal(coll_After, _1_Ether)
    assert.equal(status_After, 2 )  // check active status
  })

  it("addColl(), newBorn CDP: makes CDP active and assigns the correct collateral", async () => {
    // alice creates a CDP
    await cdpManager.userCreateCDP( {from: alice})
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    coll_Before =  alice_CDP_Before[1]
    const status_Before = alice_CDP_Before[3]  
    
    // check before
    assert.equal(coll_Before, 0)
    assert.equal(status_Before, 1 )   // check newBorn status
    
    await cdpManager.addColl({from: alice, value: _1_Ether})

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    const status_After = alice_CDP_After[3]

    // check after
    assert.equal(coll_After, _1_Ether)
    assert.equal(status_After, 2 )  // check active status 
  })

  it("addColl(), active CDP: makes CDP active and assigns the correct collateral", async () => {
    // alice creates a CDP and adds first collateral
    await cdpManager.userCreateCDP( {from: alice})
    await cdpManager.addColl( {from: alice, value: _1_Ether})

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    coll_Before =  alice_CDP_Before[1]
    const status_Before = alice_CDP_Before[3]  
    
    // check before
    assert.equal(coll_Before, _1_Ether)
    assert.equal(status_Before, 2 )   // check active status
    
    await cdpManager.addColl({from: alice, value: _1_Ether})

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    const status_After = alice_CDP_After[3]

    // check after
    assert.equal(coll_After, _2_Ether)
    assert.equal(status_After, 2 )  // check active
  })
})