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

    const contractAddresses = getAddresses(contracts)
    await setNameRegistry(contractAddresses, nameRegistry, { from: owner })
    const registeredAddresses = await getAddressesFromNameRegistry(nameRegistry)

    await connectContracts(contracts, registeredAddresses)
  })


 it('close(): closes a CDP that has ICR < MCR', async () => {
    await cdpManager.addColl({ from: alice, value: _1_Ether })


    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const ICR_Before = await web3.utils.toHex(alice_CDP_Before[2])
    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    assert.equal(ICR_Before, maxBytes32)

    const MCR = (await cdpManager.getMCR()).toString()
    assert.equal(MCR.toString(), '1100000000000000000')

    // Alice withdraws 180 CLV, lowering her ICR to 1.11
    await cdpManager.withdrawCLV('180000000000000000000', { from: alice })
    const alice_CDP_AfterWithdrawal = await cdpManager.CDPs(alice)
    const ICR_AfterWithdrawal = (await alice_CDP_AfterWithdrawal[2]).toString()
    assert.equal(ICR_AfterWithdrawal, '1111111111111111111')

    // price drops to 1ETH:100CLV, reducing Alice's ICR below MCR
    await priceFeed.setPrice(100);

    // close CDP
    await cdpManager.close(alice, { from: owner });

    // check the CDP is successfully closed, and removed from sortedList
    const status = (await cdpManager.CDPs(alice))[3]
    assert.equal(status, 3)  // status enum element 3 corresponds to "Closed"
    const alice_CDP_isInSortedList = await cdpManager.sortedCDPsContains(alice)
    assert.isFalse(alice_CDP_isInSortedList)
  })

  // // closeCDPs:
  it('closeCDPs(): closes every CDP with ICR < MCR', async () => {
    // --- SETUP ---

    // create 3 CDPs
    await cdpManager.addColl({ from: alice, value: _1_Ether })
    await cdpManager.addColl({ from: bob, value: _1_Ether })
    await cdpManager.addColl({ from: carol, value: _1_Ether })

    //alice withdraws only 1 CLV. Bob and Carol each withdraw 180 CLV, lowering their ICR to 1.11
    await cdpManager.withdrawCLV('1000000000000000000', { from: alice })
    await cdpManager.withdrawCLV('180000000000000000000', { from: bob })
    await cdpManager.withdrawCLV('180000000000000000000', { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Bob and Carols's ICR below MCR
    await priceFeed.setPrice(100);

    // Attempt to close all CDPs
    users = [alice, bob, carol]

    users.forEach(async user => {
      try {
        await cdpManager.close(user, { from: owner })
      } catch (err) {
        assert.include(err.message, 'CDP not undercollateralized');
      }
    })

    const alice_CDP_status = (await cdpManager.CDPs(alice))[3]
    const bob_CDP_status = (await cdpManager.CDPs(bob))[3]
    const carol_CDP_status = (await cdpManager.CDPs(carol))[3]

    // check Alice's CDP is still active
    assert.equal(alice_CDP_status, 2)

    // check Bob and Carol's CDP status is closed
    assert.equal(bob_CDP_status, 3)
    assert.equal(carol_CDP_status, 3)

    const alice_CDP_isInSortedList = await cdpManager.sortedCDPsContains(alice)
    const bob_CDP_isInSortedList = await cdpManager.sortedCDPsContains(bob)
    const carol_CDP_isInSortedList = await cdpManager.sortedCDPsContains(carol)

    // check Alice's CDP is still in the sortedList
    assert.isTrue(alice_CDP_isInSortedList)

    // check Bob and Carol's CDPs have been removed from sortedList
    assert.isFalse(bob_CDP_isInSortedList)
    assert.isFalse(carol_CDP_isInSortedList)
  })

  it('obtainDefaultShare(): user receives the correct amount of CLV, CLV debt and collateral', async () => { 
    // --- SETUP ---

    // Start bob with a low TCR
    await cdpManager.addColl({from: bob, value: _1_Ether})
    await cdpManager.withdrawCLV('180000000000000000000', { from: bob })
    await cdpManager.addColl({ from: carol, value: _1_Ether })
    
    // Alice creates CDP, price drops, ICR < MCR
    await cdpManager.addColl({ from: alice, value: _1_Ether })
    await cdpManager.withdrawCLV('180000000000000000000', { from: alice })
    
    const defaultPoolDebt_Before = await poolManager.getClosedDebt();
    const defaultPoolColl_Before = await poolManager.getClosedColl();
    assert.equal(defaultPoolDebt_Before, 0)
    assert.equal(defaultPoolColl_Before, 0)

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Alice's ICR below MCR
    await priceFeed.setPrice(100);
    await cdpManager.close(alice, { from: owner })

    // check Alice's debt and coll get added to Default Pool
    const defaultPoolDebt_After = await poolManager.getClosedDebt();
    const defaultPoolColl_After = await poolManager.getClosedColl();

    assert.equal(defaultPoolDebt_After, '180000000000000000000')
    assert.equal(defaultPoolColl_After, _1_Ether)

    // Attempt to send a share of defaulted debt to carol
    await cdpManager.obtainDefaultShare(carol, '1000000000000000000')

    const carol_CDP_After = await cdpManager.CDPs(carol)
    const carol_debt =  carol_CDP_After[0]

    assert.equal(carol_debt, '1000000000000000000')
  })
  
  it('redeemCollateral(): sends CLV to the lowest ICR CDPs, cancelling with correct amount of debt', async () => {
    // --- SETUP ---

    // create 4 CDPs
    await cdpManager.addColl({ from: alice, value: _1_Ether })
    await cdpManager.addColl({ from: bob, value: _1_Ether })
    await cdpManager.addColl({ from: carol, value: _1_Ether })
    // start Dennis with a high ICR
    await cdpManager.addColl({ from: dennis, value: _98_Ether })
    
    await cdpManager.withdrawCLV('5000000000000000000', { from: alice }) // alice withdraws 5 CLV
    await cdpManager.withdrawCLV('8000000000000000000', { from: bob }) // bob withdraws 8 CLV
    await cdpManager.withdrawCLV('10000000000000000000', { from: carol }) // carol withdraws 10 CLV 
    await cdpManager.withdrawCLV('150000000000000000000', { from: dennis }) // dennis withdraws 150 CLV

    const dennis_CLVBalance_Before = (await clvToken.balanceOf(dennis)).toString()
    assert.equal(dennis_CLVBalance_Before, '150000000000000000000')

    // --- TEST --- 

    // Dennis redeems 20 CLV
    await cdpManager.redeemCollateral('20000000000000000000', {from: dennis})

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const bob_CDP_After = await cdpManager.CDPs(bob)
    const carol_CDP_After = await cdpManager.CDPs(carol)
    const dennis_CDP_After = await cdpManager.CDPs(dennis)
   
    const alice_debt_After = alice_CDP_After[0].toString()
    const bob_debt_After = bob_CDP_After[0].toString()
    const carol_debt_After = carol_CDP_After[0].toString()

    /* check that Dennis' redeemed 20 CLV has been cancelled with debt from Bobs's CDP (8) and Carol's CDP (10).
    The remaining (2) is paid to Alice's CDP, who had the best ICR.
    It leaves her with (3) CLV debt. */
    assert.equal(alice_debt_After, '3000000000000000000')
    assert.equal(bob_debt_After, '0')
    assert.equal(carol_debt_After, '0')

    const dennis_CLVBalance_After = (await clvToken.balanceOf(dennis)).toString()
    assert.equal(dennis_CLVBalance_After, '130000000000000000000')
  })
})