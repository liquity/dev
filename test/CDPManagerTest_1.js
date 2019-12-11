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
  const _98_Ether = web3.utils.toWei('98', 'ether')
  const _100_Ether = web3.utils.toWei('100', 'ether')

  const [owner, alice, bob, carol, dennis] = accounts;
  let priceFeed;
  let clvToken;
  let poolManager;
  let cdpManager;
  let nameRegistry;
  let activePool;
  let stabilityPool;
  let defaultPool;

  beforeEach(async () => {
    priceFeed = await PriceFeed.new()
    clvToken = await CLVToken.new()
    poolManager = await PoolManager.new()
    cdpManager = await CDPManager.new()
    nameRegistry = await NameRegistry.new()
    activePool = await ActivePool.new()
    stabilityPool = await StabilityPool.new()
    defaultPool = await DefaultPool.new()

    const contracts = {
      priceFeed,
      clvToken,
      poolManager,
      cdpManager,
      nameRegistry,
      activePool,
      stabilityPool,
      defaultPool
    }

    const contractAddresses = getAddresses(contracts)
    await setNameRegistry(contractAddresses, nameRegistry, { from: owner })
    const registeredAddresses = await getAddressesFromNameRegistry(nameRegistry)

    await connectContracts(contracts, registeredAddresses)
  })

  it("userCreateCDP(): creates a new CDP for a user", async () => {
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_CDPStatus_Before = alice_CDP_Before[3]   // status is the 4'th property of CDP struct

    // in key->struct mappings, when key not present, corresponding struct has properties initialised to 0x0
    assert.equal(alice_CDPStatus_Before, 0)

    await cdpManager.userCreateCDP({ from: alice })

    const alice_CDP_after = await cdpManager.CDPs(alice)
    const alice_CDPStatus_After = alice_CDP_after[3]

    assert.equal(alice_CDPStatus_After, 1)  // The 2nd element of the status enum is 'newBorn' 
  })

  it("userCreateCDP(): assigns the correct debt, coll, ICR and status to the CDP", async () => {
    const alice_CDP_Before = await cdpManager.CDPs(alice)

    const debt_Before = alice_CDP_Before[0]
    const coll_Before = alice_CDP_Before[1]
    const ICR_Before = alice_CDP_Before[2]
    const status_Before = alice_CDP_Before[3]

    assert.equal(debt_Before, 0)
    assert.equal(coll_Before, 0)
    assert.equal(ICR_Before, 0)
    assert.equal(status_Before, 0)

    await cdpManager.userCreateCDP({ from: alice })

    const alice_CDP_After = await cdpManager.CDPs(alice)

    const debt_After = alice_CDP_After[0]
    const coll_After = alice_CDP_After[1]
    const ICR_After = web3.utils.toHex(alice_CDP_After[2])
    const status_After = alice_CDP_After[3]

    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    assert.equal(debt_After, 0)
    assert.equal(coll_After, 0)
    assert.equal(ICR_After, maxBytes32)
    assert.equal(status_After, 1)
  })

  it("addColl(), non-existent CDP: creates a new CDP and assigns the correct collateral amount", async () => {
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const coll_Before = alice_CDP_Before[1]
    const status_Before = alice_CDP_Before[3]
    // check before
    assert.equal(coll_Before, 0)
    assert.equal(status_Before, 0)  // check non-existent status

    await cdpManager.addColl({ from: alice, value: _1_Ether })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    const status_After = alice_CDP_After[3]

    // check after
    assert.equal(coll_After, _1_Ether)
    assert.equal(status_After, 2)  // check active status
  })

  it("addColl(): Increases the activePool ETH and raw Ether Balance by correct amount", async () => {
    const activePool_ETH_Before = await activePool.getETH()
    const activePool_RawEther_Before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_Before, 0)
    assert.equal(activePool_RawEther_Before, 0)

    await cdpManager.addColl({ from: alice, value: _1_Ether })

    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, _1_Ether)
    assert.equal(activePool_RawEther_After, _1_Ether)
  })

  it("addColl(), non-existent CDP: inserts CDP to sortedList", async () => {
    // check before
    const aliceCDPInList_Before = await cdpManager.sortedCDPsContains(alice)
    const listIsEmpty_Before = await cdpManager.sortedCDPsIsEmpty()
    assert.equal(aliceCDPInList_Before, false)
    assert.equal(listIsEmpty_Before, true)

    await cdpManager.addColl({ from: alice, value: _1_Ether })

    // check after
    const aliceCDPInList_After = await cdpManager.sortedCDPsContains(alice)
    const listIsEmpty_After = await cdpManager.sortedCDPsIsEmpty()
    assert.equal(aliceCDPInList_After, true)
    assert.equal(listIsEmpty_After, false)
  })

  it("addColl(), newBorn CDP: makes CDP active and assigns the correct collateral amount", async () => {
    // alice creates a CDP
    await cdpManager.userCreateCDP({ from: alice })
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const coll_Before = alice_CDP_Before[1]
    const status_Before = alice_CDP_Before[3]

    // check before
    assert.equal(coll_Before, 0)
    assert.equal(status_Before, 1)   // check newBorn status

    await cdpManager.addColl({ from: alice, value: _1_Ether })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    const status_After = alice_CDP_After[3]

    // check after
    assert.equal(coll_After, _1_Ether)
    assert.equal(status_After, 2)  // check active status 
  })

  it("addColl(), newBorn CDP: inserts CDP to sortedList", async () => {
    // create newBorn CDP
    await cdpManager.userCreateCDP({ from: alice })

    // check before
    const aliceCDPInList_Before = await cdpManager.sortedCDPsContains(alice)
    const listIsEmpty_Before = await cdpManager.sortedCDPsIsEmpty()
    assert.equal(aliceCDPInList_Before, false)
    assert.equal(listIsEmpty_Before, true)

    await cdpManager.addColl({ from: alice, value: _1_Ether })

    // check after
    const aliceCDPInList_After = await cdpManager.sortedCDPsContains(alice)
    const listIsEmpty_After = await cdpManager.sortedCDPsIsEmpty()
    assert.equal(aliceCDPInList_After, true)
    assert.equal(listIsEmpty_After, false)
  })

  it("addColl(), active CDP: adds the correct collateral amount to the CDP", async () => {
    // alice creates a CDP and adds first collateral
    await cdpManager.userCreateCDP({ from: alice })
    await cdpManager.addColl({ from: alice, value: _1_Ether })

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    coll_Before = alice_CDP_Before[1]
    const status_Before = alice_CDP_Before[3]

    // check before
    assert.equal(coll_Before, _1_Ether)
    assert.equal(status_Before, 2)   // check active status

    await cdpManager.addColl({ from: alice, value: _1_Ether })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    const status_After = alice_CDP_After[3]

    // check after
    assert.equal(coll_After, _2_Ether)
    assert.equal(status_After, 2)  // check active
  })

  it("addColl(), active CDP: CDP is in sortedList before and after", async () => {
    // alice creates a CDP and adds first collateral
    await cdpManager.userCreateCDP({ from: alice })
    await cdpManager.addColl({ from: alice, value: _1_Ether })

    // check before
    const aliceCDPInList_Before = await cdpManager.sortedCDPsContains(alice)
    const listIsEmpty_Before = await cdpManager.sortedCDPsIsEmpty()
    assert.equal(aliceCDPInList_Before, true)
    assert.equal(listIsEmpty_Before, false)

    await cdpManager.addColl({ from: alice, value: _1_Ether })

    // check after
    const aliceCDPInList_After = await cdpManager.sortedCDPsContains(alice)
    const listIsEmpty_After = await cdpManager.sortedCDPsIsEmpty()
    assert.equal(aliceCDPInList_After, true)
    assert.equal(listIsEmpty_After, false)
  })

  it("withdrawColl(): reduces the CDP's collateral by the correct amount", async () => {
    await cdpManager.addColl({ from: alice, value: _2_Ether })

    // check before
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const coll_Before = alice_CDP_Before[1]
    assert.equal(coll_Before, _2_Ether)

    await cdpManager.withdrawColl(_1_Ether, { from: alice })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    assert.equal(coll_After, _1_Ether)
  })

  // reduces ActivePool ETH and raw Ether
  it("withdrawColl(): reduces ActivePool ETH and raw ether by correct amount", async () => {
    await cdpManager.addColl({ from: alice, value: _2_Ether })

    // check before
    const activePool_ETH_before = await activePool.getETH()
    const activePool_RawEther_before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_before, _2_Ether)
    assert.equal(activePool_RawEther_before, _2_Ether)

    await cdpManager.withdrawColl(_1_Ether, { from: alice })

    // check after
    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, _1_Ether)
    assert.equal(activePool_RawEther_After, _1_Ether)
  })
  // increases Alice's Ether balance
  it("withdrawColl(): increases user's ether balance by correct amount", async () => {
    await cdpManager.addColl({ from: alice, value: _2_Ether })

    const alice_rawEtherBalance_Before = await web3.eth.getBalance(alice)
    assert.equal(alice_rawEtherBalance_Before, _98_Ether)

    await cdpManager.withdrawColl(_1_Ether, { from: alice })

    const alice_rawEtherBalance_After = await web3.eth.getBalance(alice)
    assert.equal(alice_rawEtherBalance_After, _99_Ether)
  })

  it("withdrawCLV(): increases the CDP's CLV debt by the correct amount", async () => {
    await cdpManager.addColl({ from: alice, value: _1_Ether })

    // check before
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 0)

    await cdpManager.withdrawCLV(100, { from: alice })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, 100)
  })

  it("withdrawCLV(): increases CLV debt in ActivePool by correct amount", async () => {
    await cdpManager.addColl({ from: alice, value: _1_Ether })

    // check before
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 0)

    await cdpManager.withdrawCLV(100, { from: alice })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, 100)
  })

  // withdrawCLV: increases CLVToken[user] balance by correct amount

  it("withdrawCLV(): increases user CLVToken balance by correct amount", async () => {
    await cdpManager.addColl({ from: alice, value: _1_Ether })

    // check before
    const alice_CLVTokenBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_Before, 0)

    await cdpManager.withdrawCLV(100, { from: alice })

    // check after
    const alice_CLVTokenBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_After, 100)
  })

  //repayCLV: reduces CLV debt in CDP
  it("repayCLV(): reduces the CDP's CLV debt by the correct amount", async () => {
    await cdpManager.addColl({ from: alice, value: _1_Ether })

    // check before
    await cdpManager.withdrawCLV(100, { from: alice })
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 100)

    await cdpManager.repayCLV(100, { from: alice })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, 0)
  })

  it("repayCLV(): decreases CLV debt in ActivePool by correct amount", async () => {
    await cdpManager.addColl({ from: alice, value: _1_Ether })

    //check before
    await cdpManager.withdrawCLV(100, { from: alice })
    const activePool_CLV_Before = await activePool.getCLV()
    assert.equal(activePool_CLV_Before, 100)

    await cdpManager.repayCLV(100, { from: alice })

    // check after
    activePool_CLV_After = await activePool.getCLV()
    assert.equal(activePool_CLV_After, 0)
  })

  it("repayCLV(): increases user CLVToken balance by correct amount", async () => {
    await cdpManager.addColl({ from: alice, value: _1_Ether })

    // check before
    await cdpManager.withdrawCLV(100, { from: alice })
    const alice_CLVTokenBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_Before, 100)

    await cdpManager.repayCLV(100, { from: alice })

    // check after
    const alice_CLVTokenBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_After, 0)
  })
})


/* TODO: 

1) After fixing math rounding error: more involved tests for SortedList re-ordering by ICR. ICR ratio 
changes with addColl, withdrawColl, withdrawCLV, repayCLV, etc. Can split them up and put them with
individual functions, or give ordering it's own 'describe' block.

2)In security phase: 
-'Negative' tests for all the above functions. 
- Split long tests into shorter, more discrete tests.

*/