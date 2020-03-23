// TODO - Refactor duplication across tests. Run only minimum number of contracts
const PoolManager = artifacts.require("./PoolManager.sol")
const SortedCDPs = artifacts.require("./SortedCDPs.sol")
const CDPManager = artifacts.require("./CDPManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const CLVToken = artifacts.require("./CLVToken.sol")
const NameRegistry = artifacts.require("./NameRegistry.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")

const testHelpers = require("../utils/testHelpers.js")
const getDifference = testHelpers.getDifference

const deploymentHelpers = require("../utils/deploymentHelpers.js")
const getAddresses = deploymentHelpers.getAddresses
const setNameRegistry = deploymentHelpers.setNameRegistry
const connectContracts = deploymentHelpers.connectContracts
const getAddressesFromNameRegistry = deploymentHelpers.getAddressesFromNameRegistry

/* TODO: Mock CDP creation. Currently, testing functions like getCollRatio() via manual CDP creation. 
 Ideally, we add a mock CDP to the mapping and sortedList, and use it as test data.
 Potentially use Doppleganger Ethereum library for mocks. */

contract('CDPManager', async accounts => {
  const _1_Ether = web3.utils.toWei('1', 'ether')
  const _2_Ether = web3.utils.toWei('2', 'ether')
  const _5_Ether = web3.utils.toWei('5', 'ether')
  const _10_Ether = web3.utils.toWei('10', 'ether')
  const _11_Ether = web3.utils.toWei('11', 'ether')
  const _15_Ether = web3.utils.toWei('15', 'ether')
  const _50_Ether = web3.utils.toWei('50', 'ether')
  const _100_Ether = web3.utils.toWei('50', 'ether')

  const _100e18 = web3.utils.toWei('100', 'ether')
  const _150e18 = web3.utils.toWei('150', 'ether')
  const _180e18 = web3.utils.toWei('180', 'ether')
  const _200e18 = web3.utils.toWei('180', 'ether')

  const [owner, alice, bob, carol, dennis, whale] = accounts;
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

  beforeEach(async () => {
    priceFeed = await PriceFeed.new()
    clvToken = await CLVToken.new()
    poolManager = await PoolManager.new()
    sortedCDPs = await SortedCDPs.new()
    cdpManager = await CDPManager.new()
    nameRegistry = await NameRegistry.new()
    activePool = await ActivePool.new()
    stabilityPool = await StabilityPool.new()
    defaultPool = await DefaultPool.new()
    functionCaller = await FunctionCaller.new()

    DefaultPool.setAsDeployed(defaultPool)
    PriceFeed.setAsDeployed(priceFeed)
    CLVToken.setAsDeployed(clvToken)
    PoolManager.setAsDeployed(poolManager)
    SortedCDPs.setAsDeployed(sortedCDPs)
    CDPManager.setAsDeployed(cdpManager)
    NameRegistry.setAsDeployed(nameRegistry)
    ActivePool.setAsDeployed(activePool)
    StabilityPool.setAsDeployed(stabilityPool)
    FunctionCaller.setAsDeployed(functionCaller)

    contracts = {
      priceFeed,
      clvToken,
      poolManager,
      sortedCDPs,
      cdpManager,
      nameRegistry,
      activePool,
      stabilityPool,
      defaultPool,
      functionCaller
    }

    const contractAddresses = getAddresses(contracts)
    await setNameRegistry(contractAddresses, nameRegistry, { from: owner })
    const registeredAddresses = await getAddressesFromNameRegistry(nameRegistry)

    await connectContracts(contracts, registeredAddresses)
  })

  // --- closeLoan() ---

  it("closeLoan(): reduces a CDP's collateral to zero", async () => {
    await cdpManager.addColl(dennis, dennis, { from: dennis, value: _10_Ether })
    // await cdpManager.withdrawCLV(_100e18, dennis, { from: dennis })

    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })
    await cdpManager.withdrawCLV(_100e18, alice, { from: alice })

    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()
    assert.equal(collBefore, _1_Ether)

    // Alice attempts to close loan
    await cdpManager.closeLoan({ from: alice})

    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()
    assert.equal(collAfter, '0')
    // check withdrawal was successful
  })

  it("closeLoan(): reduces a CDP's debt to zero", async () => {
    await cdpManager.addColl(dennis, dennis, { from: dennis, value: _10_Ether })

    await cdpManager.addColl(alice, alice, { from: alice, value:_1_Ether })
    await cdpManager.withdrawCLV(_100e18, alice, { from: alice })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    assert.equal(debtBefore, _100e18)

    // Alice attempts to close loan
    await cdpManager.closeLoan({ from: alice})

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    assert.equal(debtAfter, '0')
    // check withdrawal was successful
  })

  it("closeLoan(): sets CDP's stake to zero", async () => {
    await cdpManager.addColl(dennis, dennis, { from: dennis, value: _10_Ether })

    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })
    await cdpManager.withdrawCLV(_100e18, alice, { from: alice })

    const stakeBefore = ((await cdpManager.CDPs(alice))[2]).toString()
    assert.equal(stakeBefore, _1_Ether)

    // Alice attempts to close loan
    await cdpManager.closeLoan({ from: alice})

    const stakeAfter = ((await cdpManager.CDPs(alice))[2]).toString()
    assert.equal(stakeAfter, '0')
    // check withdrawal was successful
  })

  it("closeLoan(): closes the CDP", async () => {
    await cdpManager.addColl(dennis, dennis, { from: dennis, value: _10_Ether })
    
    await cdpManager.addColl(alice, alice, { from: alice, value:_1_Ether })
    await cdpManager.withdrawCLV(_100e18, alice, { from: alice })
  
    // Check CDP is active
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const status_Before = alice_CDP_Before[3]
    
    assert.equal(status_Before, 1)
    assert.isTrue(await sortedCDPs.contains(alice))
    
    // Close the loan
    await cdpManager.closeLoan({ from: alice})

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const status_After = alice_CDP_After[3]

    assert.equal(status_After, 2)
    assert.isFalse(await sortedCDPs.contains(alice))
  })

  it("closeLoan(): reduces ActivePool ETH and raw ether by correct amount", async () => {
    await cdpManager.addColl(dennis, dennis, { from: dennis, value: _10_Ether })

    await cdpManager.addColl(alice, alice, { from: alice, value:_1_Ether })
    await cdpManager.withdrawCLV(_100e18, alice,{ from: alice })

    // Check before
    const activePool_ETH_before = await activePool.getETH()
    const activePool_RawEther_before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_before, _11_Ether)
    assert.equal(activePool_RawEther_before, _11_Ether)

     // Close the loan
     await cdpManager.closeLoan({ from: alice})

    // Check after
    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, _10_Ether)
    assert.equal(activePool_RawEther_After, _10_Ether)
  })

  it("closeLoan(): reduces ActivePool debt by correct amount", async () => {
    await cdpManager.addColl(dennis, dennis, { from: dennis, value: _10_Ether })

    await cdpManager.addColl(alice, alice, { from: alice, value:_1_Ether })
    await cdpManager.withdrawCLV(_100e18, alice, { from: alice })

    // Check before
    const activePool_Debt_before = (await activePool.getETH()).toString()
    assert.equal(activePool_Debt_before, _11_Ether)
   
     // Close the loan
     await cdpManager.closeLoan({from: alice})

    // Check after
    const activePool_Debt_After = (await activePool.getCLV()).toString()
    assert.equal(activePool_Debt_After, 0)
  })

  it("closeLoan(): updates the the total stakes", async () => {
    await cdpManager.addColl(dennis, dennis, { from: dennis, value: _10_Ether })
    //  Alice creates initial CDP with 2 ether
    await cdpManager.addColl(alice, alice, {from: alice, value: _1_Ether })
    await cdpManager.addColl(bob, bob, {from: alice, value:  _1_Ether })

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '1000000000000000000')
    assert.equal(totalStakes_Before, '12000000000000000000')

    // Alice closes loan
    await cdpManager.closeLoan({ from: alice })

    // Check stake and total stakes get updated
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_Stake_After = alice_CDP_After[2].toString()
    const totalStakes_After = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, 0)
    assert.equal(totalStakes_After, _11_Ether)
  })
  
  it("closeLoan(): sends the correct amount of ETH to the user", async () => {
    await cdpManager.addColl(dennis, dennis, { from: dennis, value: _10_Ether })
    
    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })
  
    const alice_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))

    const tx = await cdpManager.closeLoan({ from: alice })
    
    const gasUsed = web3.utils.toBN(tx.receipt.gasUsed)
    const gasPrice = web3.utils.toBN(await web3.eth.getGasPrice())
    const gasValueInWei = gasUsed.mul(gasPrice)  
    
    const alice_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(alice))
    
    const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before).add(gasValueInWei)
    
    assert.equal(balanceDiff, _1_Ether)
  })

  it("closeLoan(): subtracts the debt of the closed CDP from the Borrower's CLVToken balance", async () => {
    await cdpManager.addColl(dennis, dennis, { from: dennis, value: _10_Ether })
    
    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })
    await cdpManager.withdrawCLV(_100e18, alice, { from: alice })

    const alice_CLVBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVBalance_Before, _100e18) 

    // close loan
    await cdpManager.closeLoan({ from: alice })

    // check alive CLV balance after

    const alice_CLVBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVBalance_After, 0) 
  })

  it("closeLoan(): applies pending rewards and updates user's L_ETH, L_CLVDebt snapshots", async () => {
    // --- SETUP ---
    // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
    await cdpManager.addColl(alice, alice, { from: alice, value: _15_Ether })
    await cdpManager.addColl(bob, bob, { from: bob, value: _5_Ether })
    await cdpManager.addColl(carol, carol, { from: carol, value: _1_Ether })
    
    // Alice and Bob withdraw 100CLV, Carol withdraws 180CLV
    await cdpManager.withdrawCLV('100000000000000000000', alice, { from: alice })
    await cdpManager.withdrawCLV('100000000000000000000', bob, { from: bob })
    await cdpManager.withdrawCLV('180000000000000000000', carol, { from: carol })
  
    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');
    const price = await priceFeed.getPrice()

    // close Carol's CDP, liquidating her 1 ether and 180CLV. Alice and Bob earn rewards.
    await cdpManager.liquidate(carol, { from: owner });

    // Dennis opens a new CDP with 10 Ether, withdraws CLV and sends 135 CLV to Alice, and 45 CLV to Bob.
  
    await cdpManager.addColl(dennis, dennis, {from: dennis, value: _100_Ether})
    await cdpManager.withdrawCLV(_200e18, dennis, {from: dennis})
    await clvToken.transfer(alice, '135000000000000000000', {from: dennis})
    await clvToken.transfer(bob, '45000000000000000000', {from: dennis})

    // check Alice and Bob's reward snapshots are zero before they alter their CDPs
    alice_rewardSnapshot_Before = await cdpManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
    const alice_CLVDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]
    
    const bob_rewardSnapshot_Before = await cdpManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
    const bob_CLVDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

    assert.equal(alice_ETHrewardSnapshot_Before, 0)
    assert.equal(alice_CLVDebtRewardSnapshot_Before, 0)
    assert.equal(bob_ETHrewardSnapshot_Before, 0)
    assert.equal(bob_CLVDebtRewardSnapshot_Before, 0)
    
    /* Check that system rewards-per-unit-staked are correct. When Carol defaulted, 
    the reward-per-unit-staked due to her CDP liquidation was (1/20) = 0.05 ETH and (180/20) = 9 CLV Debt. */
    const L_ETH = await cdpManager.L_ETH()
    const L_CLVDebt = await cdpManager.L_CLVDebt()
   
    assert.isAtMost(getDifference(L_ETH, '50000000000000000'), 100)
    assert.isAtMost(getDifference(L_CLVDebt, '9000000000000000000'), 100)

    const defaultPool_ETH = await defaultPool.getETH()
    const defaultPool_CLVDebt = await defaultPool.getCLV()
    
    // Carol's liquidated coll (1 ETH) and debt (180 CLV) should have entered the Default Pool
    assert.isAtMost(getDifference(defaultPool_ETH, _1_Ether), 100)
    assert.isAtMost(getDifference(defaultPool_CLVDebt, _180e18), 100)

    /* Close Alice's loan.
    
    Alice, with a stake of 15 ether, should have earned (15 * 1/20)  = 0.75 ETH, and (15 *180/20) = 135 CLV Debt.
    These rewards are applied when she closes her loan. 
    
    Default Pool coll should be (1-0.75) = 0.25 ETH, and DefaultPool debt should be (180-135) = 45 CLV.
    // check L_ETH and L_CLV reduce by Alice's reward */
    await cdpManager.closeLoan({ from: alice })

    const defaultPool_ETH_afterAliceCloses = await defaultPool.getETH()
    const defaultPool_CLVDebt_afterAliceCloses = await defaultPool.getCLV()

    assert.isAtMost(getDifference(defaultPool_ETH_afterAliceCloses, 250000000000000000), 100)
    assert.isAtMost(getDifference(defaultPool_CLVDebt_afterAliceCloses, 45000000000000000000), 100)

    /* Close Bob's loan.

    Bob, with a stake of 5 ether, should have earned (5 * 1/20)  = 0.25 ETH, and (5 *180/20) = 45 CLV.
    DefaultPool coll should reduce by 0.25 ETH to 0, and DefaultPool debt should reduce by 45, to 0. */

    await cdpManager.closeLoan({ from: bob })

    const defaultPool_ETH_afterBobCloses = await defaultPool.getETH()
    const defaultPool_CLVDebt_afterBobCloses = await defaultPool.getCLV()

    assert.isAtMost(getDifference(defaultPool_ETH_afterBobCloses, 0), 100)
    assert.isAtMost(getDifference(defaultPool_CLVDebt_afterBobCloses, 0), 100)
  })

 // --- openLoan() ---

  it("openLoan(): creates a new CDP and assigns the correct collateral and debt amount", async () => {
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    
    const debt_Before = alice_CDP_Before[0]
    const coll_Before = alice_CDP_Before[1]
    const status_Before = alice_CDP_Before[3]

    // check coll and debt before
    assert.equal(debt_Before, 0)
    assert.equal(coll_Before, 0)

    // check non-existent status
    assert.equal(status_Before, 0)  

    await cdpManager.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    
    const debt_After = alice_CDP_After[0].toString()
    const coll_After = alice_CDP_After[1]
    const status_After = alice_CDP_After[3]

    // check coll and debt after
    assert.equal(debt_After, '50000000000000000000')
    assert.equal(coll_After, _1_Ether)

    // check active status
    assert.equal(status_After, 1)  
  })

  it("openLoan(): adds CDP owner to CDPOwners array", async () => {
    const CDPOwnersCount_Before = (await cdpManager.getCDPOwnersCount()).toString();
    assert.equal(CDPOwnersCount_Before, '0')

    await cdpManager.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

    const CDPOwnersCount_After = (await cdpManager.getCDPOwnersCount()).toString();
    assert.equal(CDPOwnersCount_After, '1')
  })

  it("openLoan(): creates a stake and adds it to total stakes", async () => {
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '0')
    assert.equal(totalStakes_Before, '0')

    await cdpManager.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_Stake_After = alice_CDP_After[2].toString()
    const totalStakes_After = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, '1000000000000000000')
    assert.equal(totalStakes_After, '1000000000000000000')
  })

  it("openLoan(): inserts CDP to Sorted CDPs list", async () => {
    // check before
    const aliceCDPInList_Before = await sortedCDPs.contains(alice)
    const listIsEmpty_Before = await sortedCDPs.isEmpty()
    assert.equal(aliceCDPInList_Before, false)
    assert.equal(listIsEmpty_Before, true)

    await cdpManager.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

    // check after
    const aliceCDPInList_After = await sortedCDPs.contains(alice)
    const listIsEmpty_After = await sortedCDPs.isEmpty()
    assert.equal(aliceCDPInList_After, true)
    assert.equal(listIsEmpty_After, false)
  })

  it("openLoan(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
    const activePool_ETH_Before = await activePool.getETH()
    const activePool_RawEther_Before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_Before, 0)
    assert.equal(activePool_RawEther_Before, 0)

    await cdpManager.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, _1_Ether)
    assert.equal(activePool_RawEther_After, _1_Ether)
  })

  it("openLoan(): records up-to-date initial snapshots of L_ETH and L_CLVDebt", async () => {
    // --- SETUP ---
    /* Alice adds 10 ether
    Carol adds 1 ether */
    await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
    // await cdpManager.addColl('100000000000000000000', bob, { from: bob, value: _5_Ether })
    await cdpManager.addColl(carol, carol, { from: carol, value: _1_Ether })
    
    // Alice withdraws 100CLV, Carol withdraws 180CLV
    await cdpManager.withdrawCLV('100000000000000000000', alice, { from: alice })
    await cdpManager.withdrawCLV('180000000000000000000', carol, { from: carol })
  
    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Carol's CDP, liquidating her 1 ether and 180CLV.
    await cdpManager.liquidate(carol, { from: owner });

    /* with total stakes = 10 ether, after liquidation, L_ETH should equal 1/10 ether per-ether-staked,
     and L_CLV should equal 18 CLV per-ether-staked. */

    const L_ETH = await cdpManager.L_ETH()
    const L_CLV = await cdpManager.L_CLVDebt()
   
    assert.isAtMost(getDifference(L_ETH, '100000000000000000'), 100)
    assert.isAtMost(getDifference(L_CLV, '18000000000000000000'), 100)

    // Bob opens loan
    await cdpManager.openLoan('50000000000000000000', bob, { from: bob, value: _1_Ether })

    // check Bob's snapshots of L_ETH and L_CLV equal the respective current values
    const bob_rewardSnapshot = await cdpManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot = bob_rewardSnapshot[0]
    const bob_CLVDebtRewardSnapshot = bob_rewardSnapshot[1]

    assert.isAtMost(getDifference(bob_ETHrewardSnapshot, L_ETH), 100)
    assert.isAtMost(getDifference(bob_CLVDebtRewardSnapshot, L_CLV), 100) 
  })

  it("openLoan(): reverts if user tries to open a new CDP with collateral of value < $20 USD", async () => {
    /* Alice adds 0.0999 ether. At a price of 200 USD per ETH, 
    her collateral value is < $20 USD.  So her tx should revert */
    const coll = '99999999999999999' 
    
    try {
      const txData = await cdpManager.openLoan('50000000000000000000', alice, { from: alice, value: coll })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Dollar value of collateral deposit must equal or exceed the minimum")
    }  
  })

  it("openLoan(): allows a user to open a CDP, then close it, then re-open it", async () => {
    // Open CDP 
    await cdpManager.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

    // Check CDP is active
    const alice_CDP_1 = await cdpManager.CDPs(alice)
    const status_1 = alice_CDP_1[3]
    assert.equal(status_1, 1)
    assert.isTrue(await sortedCDPs.contains(alice))
    
    // Repay and close CDP
    await cdpManager.repayCLV( '50000000000000000000', alice, {from: alice})
    await cdpManager.withdrawColl(_1_Ether, alice, { from: alice})

    // Check CDP is closed
    const alice_CDP_2 = await cdpManager.CDPs(alice)
    const status_2 = alice_CDP_2[3]
    assert.equal(status_2, 2)
    assert.isFalse(await sortedCDPs.contains(alice))

    // Re-open CDP
    await cdpManager.openLoan('25000000000000000000', alice, { from: alice, value: _1_Ether })

    // Check CDP is re-opened
    const alice_CDP_3 = await cdpManager.CDPs(alice)
    const status_3 = alice_CDP_3[3]
    assert.equal(status_3, 1)
    assert.isTrue(await sortedCDPs.contains(alice))
  })

  it("openLoan(): increases the CDP's CLV debt by the correct amount", async () => {
    // check before
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 0)

    await cdpManager.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, '50000000000000000000')
  })

  it("openLoan(): increases CLV debt in ActivePool by correct amount", async () => {
    // check before
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 0)

    await cdpManager.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, '50000000000000000000')
  })

  it("openLoan(): increases user CLVToken balance by correct amount", async () => {
    // check before
    const alice_CLVTokenBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_Before, 0)

    await cdpManager.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

    // check after
    const alice_CLVTokenBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_After, '50000000000000000000')
  })
  
  it('liquidate(): closes a CDP that has ICR < MCR', async () => {
    await cdpManager.addColl(whale, whale, { from: whale, value: _50_Ether })
    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })

    const price = await priceFeed.getPrice()
    const ICR_Before = web3.utils.toHex(await cdpManager.getCurrentICR(alice, price))
    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    assert.equal(ICR_Before, maxBytes32)

    const MCR = (await cdpManager.MCR()).toString()
    assert.equal(MCR.toString(), '1100000000000000000')

    // Alice withdraws 180 CLV, lowering her ICR to 1.11
    await cdpManager.withdrawCLV('180000000000000000000', alice, { from: alice })
    const ICR_AfterWithdrawal = await cdpManager.getCurrentICR(alice, price)
    assert.isAtMost(getDifference(ICR_AfterWithdrawal, '1111111111111111111'), 100)

    // price drops to 1ETH:100CLV, reducing Alice's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close CDP
    await cdpManager.liquidate(alice, { from: owner });

    // check the CDP is successfully closed, and removed from sortedList
    const status = (await cdpManager.CDPs(alice))[3]
    assert.equal(status, 2)  // status enum  2 corresponds to "Closed"
    const alice_CDP_isInSortedList = await sortedCDPs.contains(alice)
    assert.isFalse(alice_CDP_isInSortedList)
  })

  it("liquidate(): decreases ActivePool ETH and CLVDebt by correct amounts", async () => {
    // --- SETUP ---
    await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
    await cdpManager.addColl(bob, bob, { from: bob, value: _1_Ether })
    // Alice withdraws 100CLV, Bob withdraws 180CLV
    await cdpManager.withdrawCLV('100000000000000000000', alice, { from: alice })
    await cdpManager.withdrawCLV('180000000000000000000', bob, { from: bob })

    // --- TEST ---

    // check ActivePool ETH and CLV debt before
    const activePool_ETH_Before = (await activePool.getETH()).toString()
    const activePool_RawEther_Before = (await web3.eth.getBalance(activePool.address)).toString()
    const activePool_CLVDebt_Before = (await activePool.getCLV()).toString()

    assert.equal(activePool_ETH_Before, _11_Ether)
    assert.equal(activePool_RawEther_Before, _11_Ether)
    assert.equal(activePool_CLVDebt_Before, '280000000000000000000')

    // price drops to 1ETH:100CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    /* close Bob's CDP. Should liquidate his 1 ether and 180CLV, 
    leaving 10 ether and 100 CLV debt in the ActivePool. */
    await cdpManager.liquidate(bob, { from: owner });

    // check ActivePool ETH and CLV debt 
    const activePool_ETH_After = (await activePool.getETH()).toString()
    const activePool_RawEther_After = (await web3.eth.getBalance(activePool.address)).toString()
    const activePool_CLVDebt_After = (await activePool.getCLV()).toString()

    assert.equal(activePool_ETH_After, _10_Ether)
    assert.equal(activePool_RawEther_After, _10_Ether)
    assert.equal(activePool_CLVDebt_After, '100000000000000000000')
  })

  it("liquidate(): increases DefaultPool ETH and CLV debt by correct amounts", async () => {
    // --- SETUP ---
    await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
    await cdpManager.addColl(bob, bob, { from: bob, value: _1_Ether })

    await cdpManager.withdrawCLV('1000000000000000000', alice, { from: alice })
    await cdpManager.withdrawCLV('180000000000000000000', bob, { from: bob })

    // --- TEST ---

    // check DefaultPool ETH and CLV debt before
    const defaultPool_ETH_Before = (await defaultPool.getETH())
    const defaultPool_RawEther_Before = (await web3.eth.getBalance(defaultPool.address)).toString()
    const defaultPool_CLVDebt_Before = (await defaultPool.getCLV()).toString()

    assert.equal(defaultPool_ETH_Before, '0')
    assert.equal(defaultPool_RawEther_Before, '0')
    assert.equal(defaultPool_CLVDebt_Before, '0')

    // price drops to 1ETH:100CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Bob's CDP
    await cdpManager.liquidate(bob, { from: owner });

    // check after
    const defaultPool_ETH_After = (await defaultPool.getETH()).toString()
    const defaultPool_RawEther_After = (await web3.eth.getBalance(defaultPool.address)).toString()
    const defaultPool_CLVDebt_After = (await defaultPool.getCLV()).toString()

    assert.equal(defaultPool_ETH_After, _1_Ether)
    assert.equal(defaultPool_RawEther_After, _1_Ether)
    assert.equal(defaultPool_CLVDebt_After, '180000000000000000000')
  })

  it("liquidate(): removes the CDP's stake from the total stakes", async () => {
    // --- SETUP ---
    await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
    await cdpManager.addColl(bob, bob, { from: bob, value: _1_Ether })

    await cdpManager.withdrawCLV('1000000000000000000', alice, { from: alice })
    await cdpManager.withdrawCLV('180000000000000000000', bob, { from: bob })

    // --- TEST ---

    // check totalStakes before
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()
    assert.equal(totalStakes_Before, _11_Ether)

    // price drops to 1ETH:100CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Bob's CDP
    await cdpManager.liquidate(bob, { from: owner });

    // check totalStakes after
    const totalStakes_After = (await cdpManager.totalStakes()).toString()
    assert.equal(totalStakes_After, _10_Ether)
  })

  it("liquidate(): updates the snapshots of total stakes and total collateral", async () => {
    // --- SETUP ---
    await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
    await cdpManager.addColl(bob, bob, { from: bob, value: _1_Ether })

    await cdpManager.withdrawCLV('1000000000000000000', alice, { from: alice })
    await cdpManager.withdrawCLV('180000000000000000000', bob, { from: bob })

    // --- TEST ---

    // check snapshots before 
    const totalStakesSnapshot_Before = (await cdpManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_Before = (await cdpManager.totalCollateralSnapshot()).toString()
    assert.equal(totalStakesSnapshot_Before, '0')
    assert.equal(totalCollateralSnapshot_Before, '0')

    // price drops to 1ETH:100CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Bob's CDP.  His 1 ether and 180 CLV should be added to the DefaultPool.
    await cdpManager.liquidate(bob, { from: owner });

    /* check snapshots after. Total stakes should be equal to the only remaining stake then the system: 
    10 ether, Alice's stake.
     
    Total collateral should be equal to Alice's collateral (10 ether) plus her pending ETH reward (1 ether), earned
    from the liquidation of Bob's CDP */
    const totalStakesSnapshot_After = (await cdpManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot_After = (await cdpManager.totalCollateralSnapshot()).toString()

    assert.equal(totalStakesSnapshot_After, _10_Ether)
    assert.equal(totalCollateralSnapshot_After, _11_Ether)
  })

  it("liquidate(): updates the L_ETH and L_CLVDebt reward-per-unit-staked totals", async () => {
    // --- SETUP ---
    await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
    await cdpManager.addColl(bob, bob, { from: bob, value: _10_Ether })
    await cdpManager.addColl(carol, carol, { from: carol, value: _1_Ether })

    // Carol withdraws 180CLV, lowering her ICR to 1.11
    await cdpManager.withdrawCLV('180000000000000000000', carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carols's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Carol's CDP.  
    await cdpManager.liquidate(carol, { from: owner });

    /* Alice and Bob have the only active stakes. totalStakes in the system is (10 + 10) = 20 ether.
    
    Carol's 1 ether and 180 CLV should be added to the DefaultPool. The system rewards-per-unit-staked should now be:
    
    L_ETH = (1 / 20) = 0.05 ETH
    L_CLVDebt = (180 / 20) = 9 CLV */
    const L_ETH_AfterCarolLiquidated = await cdpManager.L_ETH()
    const L_CLVDebt_AfterCarolLiquidated = await cdpManager.L_CLVDebt()

    assert.isAtMost(getDifference(L_ETH_AfterCarolLiquidated, '50000000000000000'), 100)
    assert.isAtMost(getDifference(L_CLVDebt_AfterCarolLiquidated, '9000000000000000000'), 100)

    // Bob now withdraws 800 CLV, bringing his ICR to 1.11
    await cdpManager.withdrawCLV('800000000000000000000', bob, { from: bob })

    // price drops to 1ETH:50CLV, reducing Bob's ICR below MCR
    await priceFeed.setPrice('50000000000000000000');

    // close Bob's CDP 
    await cdpManager.liquidate(bob, { from: owner });

    /* Alice now has the only active stake. totalStakes in the system is now 10 ether.
   
   Bob's pending collateral reward (10 * 0.05 = 0.5 ETH) and debt reward (10 * 9 = 90 CLV) are applied to his CDP
   before his liquidation.
   His total collateral (10 + 0.5 = 10.5 ETH) and debt (800 + 90 = 890 CLV) are then added to the DefaultPool. 
   
   The system rewards-per-unit-staked should now be:
   
   L_ETH = (1 / 20) + (10.5  / 10) = 1.10 ETH
   L_CLVDebt = (180 / 20) + (890 / 10) = 98 CLV */
    const L_ETH_AfterBobLiquidated = await cdpManager.L_ETH()
    const L_CLVDebt_AfterBobLiquidated = await cdpManager.L_CLVDebt()
    assert.isAtMost(getDifference(L_ETH_AfterBobLiquidated, '1100000000000000000'), 100)
    assert.isAtMost(getDifference(L_CLVDebt_AfterBobLiquidated, '98000000000000000000'), 100)
  })

  it("liquidate(): CDP remains active if withdrawal of its StabilityPool ETH gain brings it above the MCR", async () => {
    // --- SETUP ---
    await cdpManager.addColl(whale, whale, { from: whale, value: _10_Ether })
    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })
    await cdpManager.addColl(bob, bob, { from: bob, value: _1_Ether })
    await cdpManager.addColl(carol, carol, { from: carol, value: _1_Ether })
    await cdpManager.addColl(dennis, dennis, { from: dennis, value: _1_Ether })

    //  Bob and Carol and Dennis withdraw 180 CLV
    await cdpManager.withdrawCLV('180000000000000000000', bob, { from: bob })
    await cdpManager.withdrawCLV('180000000000000000000', carol, { from: carol })
    await cdpManager.withdrawCLV('180000000000000000000', dennis, { from: dennis })

    // --- TEST ---

    // Bob sends 180CLV to the StabilityPool
    await poolManager.provideToSP('180000000000000000000', { from: bob })

    // price drops to 1ETH:100CLV, reducing Bob's ICR and Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    /*  Liquidate Dennis. His CLVDebt (180 CLV) is entirely offset against Bob's StabilityPool deposit (180 CLV). 
    As the only StabilityPool depositor, Bob earns a gain of 1 ETH (the entire liquidated ETH from Dennis' CDP) */
    await cdpManager.liquidate(dennis, { from: owner });

    // log S_ETH and S_CLV
    const S_ETH = await poolManager.S_ETH()
    const S_CLV = await poolManager.S_CLV()

    // console.log("S_ETH is " + S_ETH.toString())
    // console.log("S_CLV is " + S_CLV.toString())

    // Debugging SafeMath overflow:
    //   S_CLV:  1000000000000000000  i.e. 1 CLV per unit staked (correct, bob should have 180 * 1 liquidated)
    /*   S_ETH:     5555555555555556  i.e. 0.0055555.. ETH  per unit staked ( ?? ) 
    ahhhh OK, so because of the rounding up, then when computing actual reward, it's slightly high, 
    and higher than what's in the Pool. */

    /* Now, attempt to liquidate Bob and Carol. Carol should be liquidated, but Bob's StabilityPool ETH gain should be 
    withdrawn to his CDP, bringing his ICR > MCR. Thus, his CDP should remain active */
    await cdpManager.liquidate(bob, { from: owner });
    await cdpManager.liquidate(carol, { from: owner });

    // check Bob's CDP is active, Carol's CDP is closed
    const bob_CDP = await cdpManager.CDPs(bob)
    const carol_CDP = await cdpManager.CDPs(carol)
    const bob_Status = bob_CDP[3]
    const carol_Status = carol_CDP[3]

    assert.equal(bob_Status, 1)     // Status enum 1 is 'active'
    assert.equal(carol_Status, 2)   // Status enum 2 is 'closed'

    //check Bob is in sortedCDPs, and Carol is not
    const bob_isInSortedList = await sortedCDPs.contains(bob)
    const carol_isInSortedList = await sortedCDPs.contains(carol)

    assert.isTrue(bob_isInSortedList)
    assert.isFalse(carol_isInSortedList)
  })

  it("liquidate(): if application of StabilityPool ETH gain would bring it above the MCR, CDP should remain active", async () => {
    // --- SETUP ---
    await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })
    await cdpManager.addColl(bob, bob, { from: bob, value: _1_Ether })
    await cdpManager.addColl(dennis, dennis, { from: dennis, value: _1_Ether })

    //  Bob withdraws 150 CLV
    await cdpManager.withdrawCLV('150000000000000000000', bob, { from: bob })
    // Dennis withdraws 140 CLV
    await cdpManager.withdrawCLV('140000000000000000000', dennis, { from: dennis })

    // --- TEST ---

    // Bob sends 150CLV to the StabilityPool
    await poolManager.provideToSP('150000000000000000000', { from: bob })

    // price drops to 1ETH:100CLV, reducing Bob's ICR, and Dennis's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Alice withdraws 90CLV, resulting in an ICR = 1.111...
    await cdpManager.withdrawCLV('90000000000000000000', alice, { from: alice })

    // check last CDP is bob

    const lastCDP_Before = await sortedCDPs.getLast()
    assert.equal(lastCDP_Before, bob)

    /*  Liquidate Dennis. His CLVDebt (140 CLV) is entirely offset against Bob's StabilityPool deposit (180 CLV). 
    As the only StabilityPool depositor, Bob earns a gain of 1 ETH (the entire liquidated ETH from Dennis' CDP) */
    await cdpManager.liquidate(dennis, { from: owner });

    // check Dennis's CDP is closed
    const dennis_CDP = await cdpManager.CDPs(dennis)
    const dennis_Status = dennis_CDP[3]
    assert.equal(dennis_Status, 2)     // Status enum 2 is 'closed'

    /* Now, attempt to liquidate Bob. Bob's StabilityPool ETH gain would be enough to bring his ICR > MCR.
    
    Thus, his CDP should remain active */
    await cdpManager.liquidate(bob, { from: owner });

    // check Bob's CDP is active
    const bob_CDP = await cdpManager.CDPs(bob)
    const bob_Status = bob_CDP[3]
    assert.equal(bob_Status, 1)     // Status enum 1 is 'active'

    // Bob's ICR should now be: (2 * 100) / 150 = 1.3333...

    //check Bob is in sortedCDPs
    const bob_isInSortedList = await sortedCDPs.contains(bob)
    assert.isTrue(bob_isInSortedList)
  })

  it('liquidateCDPs(): closes every CDP with ICR < MCR', async () => {
    // --- SETUP ---

    // create 3 CDPs
    await cdpManager.addColl(alice, alice, { from: alice, value: _10_Ether })
    await cdpManager.addColl(bob, bob, { from: bob, value: _1_Ether })
    await cdpManager.addColl(carol, carol, { from: carol, value: _1_Ether })

    // alice withdraws only 1 CLV. Bob and Carol each withdraw 180 CLV, lowering their ICR to 1.11
    await cdpManager.withdrawCLV('1000000000000000000', alice, { from: alice })
    await cdpManager.withdrawCLV('180000000000000000000', bob, { from: bob })
    await cdpManager.withdrawCLV('180000000000000000000', carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Bob and Carols's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    await cdpManager.liquidateCDPs(10, { from: owner });

    const alice_CDP_status = (await cdpManager.CDPs(alice))[3]
    const bob_CDP_status = (await cdpManager.CDPs(bob))[3]
    const carol_CDP_status = (await cdpManager.CDPs(carol))[3]

    /* Now, Alice has received 2 ETH and 360 CLV in rewards from liquidations.

    Her ICR, at price 1ETH:200CLV, should be (12 ETH * 200 / 361 CLV) = 664.82%. Thus her CDP should still be active. */

    // check Alice's CDP is still active
    assert.equal(alice_CDP_status, 1)

    // check Bob and Carol's CDP status is closed
    assert.equal(bob_CDP_status, 2)
    assert.equal(carol_CDP_status, 2)

    const alice_CDP_isInSortedList = await sortedCDPs.contains(alice)
    const bob_CDP_isInSortedList = await sortedCDPs.contains(bob)
    const carol_CDP_isInSortedList = await sortedCDPs.contains(carol)

    // check Alice's CDP is still in the sortedList
    assert.isTrue(alice_CDP_isInSortedList)

    // check Bob and Carol's CDPs have been removed from sortedList
    assert.isFalse(bob_CDP_isInSortedList)
    assert.isFalse(carol_CDP_isInSortedList)
  })

  // it('redeemCollateral(): sends CLV to the lowest ICR CDPs, cancelling with correct amount of debt', async () => {
  //   // --- SETUP ---

  //   // create 4 CDPs
  //   await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })
  //   await cdpManager.addColl(bob, bob, { from: bob, value: _1_Ether })
  //   await cdpManager.addColl(carol, carol, { from: carol, value: _1_Ether })
  //   // start Dennis with a high ICR
  //   await cdpManager.addColl(dennis, dennis, { from: dennis, value: _98_Ether })

  //   await cdpManager.withdrawCLV('5000000000000000000', alice, { from: alice }) // alice withdraws 5 CLV
  //   await cdpManager.withdrawCLV('8000000000000000000', bob, { from: bob }) // bob withdraws 8 CLV
  //   await cdpManager.withdrawCLV('10000000000000000000', carol, { from: carol }) // carol withdraws 10 CLV 
  //   await cdpManager.withdrawCLV('150000000000000000000', dennis, { from: dennis }) // dennis withdraws 150 CLV

  //   const dennis_CLVBalance_Before = (await clvToken.balanceOf(dennis)).toString()
  //   assert.equal(dennis_CLVBalance_Before, '150000000000000000000')

  //   // --- TEST --- 

  //   // Dennis redeems 20 CLV
  //   await cdpManager.redeemCollateral('20000000000000000000', dennis, { from: dennis })

  //   const alice_CDP_After = await cdpManager.CDPs(alice)
  //   const bob_CDP_After = await cdpManager.CDPs(bob)
  //   const carol_CDP_After = await cdpManager.CDPs(carol)

  //   const alice_debt_After = alice_CDP_After[0].toString()
  //   const bob_debt_After = bob_CDP_After[0].toString()
  //   const carol_debt_After = carol_CDP_After[0].toString()

  //   /* check that Dennis' redeemed 20 CLV has been cancelled with debt from Bobs's CDP (8) and Carol's CDP (10).
  //   The remaining lot (2) is sent to Alice's CDP, who had the best ICR.
  //   It leaves her with (3) CLV debt. */
  //   assert.equal(alice_debt_After, '3000000000000000000')
  //   assert.equal(bob_debt_After, '0')
  //   assert.equal(carol_debt_After, '0')

  //   const dennis_CLVBalance_After = (await clvToken.balanceOf(dennis)).toString()
  //   assert.equal(dennis_CLVBalance_After, '130000000000000000000')
  // })
})

contract('Reset chain state', async accounts => { })