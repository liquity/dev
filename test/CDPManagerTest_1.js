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
  const _100_Finney = web3.utils.toWei('100', 'finney')
  const _1_Ether = web3.utils.toWei('1', 'ether')
  const _5_Ether = web3.utils.toWei('5', 'ether')
  const _10_Ether = web3.utils.toWei('10', 'ether')
  const _15_Ether = web3.utils.toWei('15', 'ether')
  const _98_Ether = web3.utils.toWei('98', 'ether')
  const _100_Ether = web3.utils.toWei('100', 'ether')

  const [owner, alice, bob, carol, dennis] = accounts;
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

    const contracts = {
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

  it("userCreateCDP(): adds CDP owner to CDPOwners array", async () => {
    const CDPOwnersCount_Before = (await cdpManager.getCDPOwnersCount()).toString();
    assert.equal(CDPOwnersCount_Before, '0')

    await cdpManager.userCreateCDP({ from: alice })

    const CDPOwnersCount_After = (await cdpManager.getCDPOwnersCount()).toString();
    assert.equal(CDPOwnersCount_After, '1')
  })

  it("userCreateCDP(): assigns the correct debt, coll, ICR and status to the CDP", async () => {
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    const debt_Before = alice_CDP_Before[0]
    const coll_Before = alice_CDP_Before[1]

    const ICR_Before = web3.utils.toHex(await cdpManager.getCurrentICR(alice))
    const status_Before = alice_CDP_Before[3]

    assert.equal(debt_Before, 0)
    assert.equal(coll_Before, 0)
    assert.equal(ICR_Before, maxBytes32)
    assert.equal(status_Before, 0)

    // Alice creates CDP
    await cdpManager.userCreateCDP({ from: alice })

    const alice_CDP_After = await cdpManager.CDPs(alice)

    const debt_After = alice_CDP_After[0]
    const coll_After = alice_CDP_After[1]
    const ICR_After = web3.utils.toHex(await cdpManager.getCurrentICR(alice))
    const status_After = alice_CDP_After[3]

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

    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    const status_After = alice_CDP_After[3]

    // check after
    assert.equal(coll_After, _1_Ether)
    assert.equal(status_After, 2)  // check active status
  })

  it("addColl(), non-existent CDP: adds CDP owner to CDPOwners array", async () => {
    const CDPOwnersCount_Before = (await cdpManager.getCDPOwnersCount()).toString();
    assert.equal(CDPOwnersCount_Before, '0')

    await cdpManager.addColl(alice, alice, {from: alice, value: _1_Ether })

    const CDPOwnersCount_After = (await cdpManager.getCDPOwnersCount()).toString();
    assert.equal(CDPOwnersCount_After, '1')
  })

  it("addColl(), non-existent CDP: creates a stake and adds it to total stakes", async () => {
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '0')
    assert.equal(totalStakes_Before, '0')

    await cdpManager.addColl(alice, alice, {from: alice, value: _1_Ether })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_Stake_After = alice_CDP_After[2].toString()
    const totalStakes_After = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, '1000000000000000000')
    assert.equal(totalStakes_After, '1000000000000000000')
  })

  it("addColl(), non-existent CDP: inserts CDP to sortedList", async () => {
    // check before
    const aliceCDPInList_Before = await cdpManager.sortedCDPsContains(alice)
    const listIsEmpty_Before = await cdpManager.sortedCDPsIsEmpty()
    assert.equal(aliceCDPInList_Before, false)
    assert.equal(listIsEmpty_Before, true)

    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check after
    const aliceCDPInList_After = await cdpManager.sortedCDPsContains(alice)
    const listIsEmpty_After = await cdpManager.sortedCDPsIsEmpty()
    assert.equal(aliceCDPInList_After, true)
    assert.equal(listIsEmpty_After, false)
  })

  it("addColl(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
    const activePool_ETH_Before = await activePool.getETH()
    const activePool_RawEther_Before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_Before, 0)
    assert.equal(activePool_RawEther_Before, 0)

    await cdpManager.addColl(alice,alice, { from: alice, value: _1_Ether })

    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, _1_Ether)
    assert.equal(activePool_RawEther_After, _1_Ether)
  })

  it("addColl(), newBorn CDP: makes CDP active and assigns the correct collateral amount", async () => {
    // alice creates a CDP
    await cdpManager.userCreateCDP({ from: alice })
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const coll_Before = alice_CDP_Before[1]
    const status_Before = alice_CDP_Before[3]

    // check before - 0 coll and newBorn status
    assert.equal(coll_Before, 0)
    assert.equal(status_Before, 1)   

    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    const status_After = alice_CDP_After[3]

    // check after - 0 coll and newBorn status
    assert.equal(coll_After, _1_Ether)
    assert.equal(status_After, 2)  
  })

  it("addColl(), newBorn CDP: inserts CDP to sortedList", async () => {
    // create newBorn CDP
    await cdpManager.userCreateCDP({ from: alice })

    // check before
    const aliceCDPInList_Before = await cdpManager.sortedCDPsContains(alice)
    const listIsEmpty_Before = await cdpManager.sortedCDPsIsEmpty()
    assert.equal(aliceCDPInList_Before, false)
    assert.equal(listIsEmpty_Before, true)

    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check after
    const aliceCDPInList_After = await cdpManager.sortedCDPsContains(alice)
    const listIsEmpty_After = await cdpManager.sortedCDPsIsEmpty()
    assert.equal(aliceCDPInList_After, true)
    assert.equal(listIsEmpty_After, false)
  })

  it("addColl(), active CDP: adds the correct collateral amount to the CDP", async () => {
    // alice creates a CDP and adds first collateral
    await cdpManager.userCreateCDP({ from: alice })
    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    coll_Before = alice_CDP_Before[1]
    const status_Before = alice_CDP_Before[3]

    // check coll and sttus before
    assert.equal(coll_Before, _1_Ether)
    assert.equal(status_Before, 2)   

    // Alice adds second collateral
    await cdpManager.addColl(alice, alice,  { from: alice, value: _1_Ether })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    const status_After = alice_CDP_After[3]

    // check coll increases by correct amount,and status remains
    assert.equal(coll_After, _2_Ether)
    assert.equal(status_After, 2)  
  })

  it("addColl(), active CDP: CDP is in sortedList before and after", async () => {
    // alice creates a CDP and adds first collateral
    await cdpManager.userCreateCDP({ from: alice })
    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check Alice is in list before
    const aliceCDPInList_Before = await cdpManager.sortedCDPsContains(alice)
    const listIsEmpty_Before = await cdpManager.sortedCDPsIsEmpty()
    assert.equal(aliceCDPInList_Before, true)
    assert.equal(listIsEmpty_Before, false)

    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check Alice is still in list after
    const aliceCDPInList_After = await cdpManager.sortedCDPsContains(alice)
    const listIsEmpty_After = await cdpManager.sortedCDPsIsEmpty()
    assert.equal(aliceCDPInList_After, true)
    assert.equal(listIsEmpty_After, false)
  })

  it("addColl(), active CDP: updates the stake and updates the total stakes", async () => {
    //  Alice creates initial CDP with 1 ether
    await cdpManager.addColl(alice, alice, {from: alice, value: _1_Ether })

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '1000000000000000000')
    assert.equal(totalStakes_Before, '1000000000000000000')

    // Alice tops up CDP collateral with 2 ether
    await cdpManager.addColl(alice, alice, {from: alice, value: _2_Ether })

    // Check stake and total stakes get updated
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_Stake_After = alice_CDP_After[2].toString()
    const totalStakes_After = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, '3000000000000000000')
    assert.equal(totalStakes_After, '3000000000000000000')
  })

  it("addColl(), active CDP: applies pending rewards and updates user's L_ETH, L_CLVDebt snapshots", async () => {
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
    await priceFeed.setPrice(100);

    // close Carol's CDP, liquidating her 1 ether and 180CLV.
    await cdpManager.liquidate(carol, { from: owner });

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
    
    // Alice and Bob top up their CDPs
    await cdpManager.addColl(alice, alice, { from: alice, value: _5_Ether })
    await cdpManager.addColl(bob, bob, { from: bob, value: _1_Ether })
    
    /* check that both alice and Bob have had pending rewards applied in addition to their top-ups. When Carol defaulted, 
    the reward-per-unit-staked due to her CDP liquidation was (1/20) ETH and (180/20) CLV Debt.

    Alice, with a stake of 15 ether, should have earned (15 * 1/20)  = 0.75 ETH, and (15 *180/20) = 135 CLV Debt.
    
    After her top-up of 5 ether:
    - Her collateral should be (15 + 0.75 + 5) = 20.75 ETH.
    - Her CLV debt should be (100 + 135) = 235 CLV.

    Bob, with a stake of 5 ether, should have earned (5 * 1/20)  = 0.25 ETH, and (5 *180/20) = 45 CLV.
     
    After his top-up of 1 ether:
    - His collateral should be (5 + 0.25 + 1) = 6.25 ETH.
    - His CLV debt should be (100 + 45) = 145 CLV.   */
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_CLVDebt_After = (alice_CDP_After[0]).toString()
    const alice_Coll_After = alice_CDP_After[1].toString()

    const bob_CDP_After = await cdpManager.CDPs(bob)
    const bob_CLVDebt_After = bob_CDP_After[0].toString()
    const bob_Coll_After = bob_CDP_After[1].toString()

    assert.equal(alice_CLVDebt_After, '235000000000000000000')
    assert.equal(alice_Coll_After, '20750000000000000000')

    assert.equal(bob_CLVDebt_After, '145000000000000000000')
    assert.equal(bob_Coll_After, '6250000000000000000')

    /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be:

    L_ETH(0): 0.05
    L_CLVDebt(0): 9   */
    alice_rewardSnapshot_After = await cdpManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0].toString()
    const alice_CLVDebtRewardSnapshot_After = alice_rewardSnapshot_After[1].toString()
    
    const bob_rewardSnapshot_After = await cdpManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0].toString()
    const bob_CLVDebtRewardSnapshot_After = bob_rewardSnapshot_After[1].toString()

    assert.equal(alice_ETHrewardSnapshot_After, '50000000000000000')
    assert.equal(alice_CLVDebtRewardSnapshot_After, '9000000000000000000')
    assert.equal(bob_ETHrewardSnapshot_After, '50000000000000000')
    assert.equal(bob_CLVDebtRewardSnapshot_After, '9000000000000000000')
  })

  it("addColl(), active CDP: adds the right corrected stake after liquidations have occured", async () => {
    // --- SETUP ---
    // Alice and Bob add 10 ether, Carol adds 1 ether
    await cdpManager.addColl(alice, alice, { from: alice, value: _15_Ether })
    await cdpManager.addColl(bob, bob, { from: bob, value: _5_Ether })
    await cdpManager.addColl(carol, carol, { from: carol, value: _5_Ether })
    
    // Alice and Bob withdraw 100CLV, Carol withdraws 900CLV
    await cdpManager.withdrawCLV('100000000000000000000', alice, { from: alice })
    await cdpManager.withdrawCLV('100000000000000000000', bob, { from: bob })
    await cdpManager.withdrawCLV('900000000000000000000', carol, { from: carol })
  
    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice(100);

    // close Carol's CDP, liquidating her 5 ether and 900CLV.
    await cdpManager.liquidate(carol, { from: owner });

    // dennis opens a CDP with 2 ether
    await cdpManager.addColl(dennis, dennis, { from: dennis, value: _2_Ether })

    /* Check that Dennis's recorded stake is the right corrected stake, less than his collateral. A corrected 
    stake is given by the formula: 
    
    s = totalStakesSnapshot / totalCollateralSnapshot 
    
    where snapshots are the values immediately after the last liquidation.  After Carol's liquidation, 
    the ETH from her CDP has now become the totalPendingETHReward. So:

    totalStakes = (alice_Stake + bob_Stake) = (15 + 5) = 20 ETH.
    totalCollateral = (alice_Collateral + bob_Collateral + totalPendingETHReward) = (15 + 5 + 5)  = 25 ETH.

    Therefore, as Dennis adds 2 ether collateral, his corrected stake should be:  s = 2 * (20 / 25 ) = 1.6 ETH */
    const dennis_CDP = await cdpManager.CDPs(dennis)
    const dennis_Stake = dennis_CDP[2].toString()

    assert.equal(dennis_Stake, '1600000000000000000')

  })

  it("addColl(): reverts if user tries to open a new CDP with collateral of value < $20 USD", async () => {
    /* Alice adds 0.0999 ether. At a price of 200 USD per ETH, 
    her collateral value is < $20 USD.  So her tx should revert */
    const coll = '99999999999999999' 
    
    try {
      const txData = await cdpManager.addColl(alice, alice, { from: alice, value: coll })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Dollar value of collateral deposit must equal or exceed the minimum")
    }  
  })

  it("addColl(): allows a user to top up an active CDP with additional collateral of value < $20 USD", async () => {
    await cdpManager.addColl(alice, alice, { from: alice, value: _100_Finney })

    // Tops up with only one wei
    const txData = await cdpManager.addColl(alice, alice, { from: alice, value: '1' })

    // check top-up was successful
    txStatus = txData.receipt.status
    assert.isTrue(txStatus)
  })

  it("addColl(): allows a user to open a CDP, then close it, then re-open it", async () => {
    // Open CDP 
    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })
    await cdpManager.withdrawCLV( '17500000000000000000', alice, {from: alice})

    // Check CDP is active
    const alice_CDP_1 = await cdpManager.CDPs(alice)
    const status_1 = alice_CDP_1[3]
    assert.equal(status_1, 2)
    assert.isTrue(await cdpManager.sortedCDPsContains(alice))
    
    // Repay and close CDP
    await cdpManager.repayCLV( '17500000000000000000', alice, {from: alice})
    await cdpManager.withdrawColl(_1_Ether, alice, { from: alice})

    // Check CDP is closed
    const alice_CDP_2 = await cdpManager.CDPs(alice)
    const status_2 = alice_CDP_2[3]
    assert.equal(status_2, 3)
    assert.isFalse(await cdpManager.sortedCDPsContains(alice))

    // Re-open CDP
    await cdpManager.addColl(alice, alice, { from: alice, value: _2_Ether })
    await cdpManager.withdrawCLV( '25000000000000000000', alice, {from: alice})

    // Check CDP is re-opened
    const alice_CDP_3 = await cdpManager.CDPs(alice)
    const status_3 = alice_CDP_3[3]
    assert.equal(status_3, 2)
    assert.isTrue(await cdpManager.sortedCDPsContains(alice))
  })

  it("withdrawColl(): reverts if dollar value of remaining collateral in CDP would be < $20 USD", async () => {
    await cdpManager.addColl(alice, alice, { from: alice, value: _100_Finney })

    // Alice attempts to withdraw 1 wei. Check tx reverts
    try {
      const txData =  await cdpManager.withdrawColl('1', alice, { from: alice})
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Remaining collateral must have $USD value >= 20, or be zero")
    }  
  })

  it("withdrawColl(): allows a user to completely withdraw all collateral from their CDP", async () => {
    await cdpManager.addColl(alice, alice, { from: alice, value: _100_Finney })

    // Alice attempts to withdraw all collateral
    const txData =  await cdpManager.withdrawColl(_100_Finney, alice, { from: alice})

    // check withdrawal was successful
    txStatus = txData.receipt.status
    assert.isTrue(txStatus)
  })

  it("withdrawColl(): closes the CDP when the user withdraws all collateral", async () => {
    // Open CDP 
    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })
  
    // Check CDP is active
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const status_Before = alice_CDP_Before[3]
    assert.equal(status_Before, 2)
    assert.isTrue(await cdpManager.sortedCDPsContains(alice))
    
    // Withdraw all the collateral in the CDP
    await cdpManager.withdrawColl(_1_Ether, alice, { from: alice})

    // Check CDP is closed
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const status_After = alice_CDP_After[3]
    assert.equal(status_After, 3)
    assert.isFalse(await cdpManager.sortedCDPsContains(alice))

  })

  it("withdrawColl(): leaves the CDP active when the user withdraws less than all the collateral", async () => {
    // Open CDP 
    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })
  
    // Check CDP is active
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const status_Before = alice_CDP_Before[3]
    assert.equal(status_Before, 2)
    assert.isTrue(await cdpManager.sortedCDPsContains(alice))
    
    // Withdraw some collateral
    await cdpManager.withdrawColl(_100_Finney, alice, { from: alice})

    // Check CDP is still active
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const status_After = alice_CDP_After[3]
    assert.equal(status_After, 2)
    assert.isTrue(await cdpManager.sortedCDPsContains(alice))
  })

  it("withdrawColl(): reduces the CDP's collateral by the correct amount", async () => {
    await cdpManager.addColl(alice, alice, { from: alice, value: _2_Ether })

    // check before -  Alice has 2 ether in CDP 
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const coll_Before = alice_CDP_Before[1]
    assert.equal(coll_Before, _2_Ether)

    // Alice withdraws 1 ether
    await cdpManager.withdrawColl(_1_Ether, alice,  { from: alice })

    // Check 1 ether remaining
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    assert.equal(coll_After, _1_Ether)
  })

  it("withdrawColl(): reduces ActivePool ETH and raw ether by correct amount", async () => {
    await cdpManager.addColl(alice, alice, { from: alice, value: _2_Ether })

    // check before
    const activePool_ETH_before = await activePool.getETH()
    const activePool_RawEther_before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_before, _2_Ether)
    assert.equal(activePool_RawEther_before, _2_Ether)

    await cdpManager.withdrawColl(_1_Ether, alice,  { from: alice })

    // check after
    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, _1_Ether)
    assert.equal(activePool_RawEther_After, _1_Ether)
  })

  it("withdrawColl(): updates the stake and updates the total stakes", async () => {
    //  Alice creates initial CDP with 2 ether
    await cdpManager.addColl(alice, alice, {from: alice, value: _2_Ether })

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '2000000000000000000')
    assert.equal(totalStakes_Before, '2000000000000000000')

    // Alice withdraws 1 ether
    await cdpManager.withdrawColl(_1_Ether, alice, { from: alice })

    // Check stake and total stakes get updated
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_Stake_After = alice_CDP_After[2].toString()
    const totalStakes_After = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, '1000000000000000000')
    assert.equal(totalStakes_After, '1000000000000000000')
  })
  
  it("withdrawColl(): sends the correct amount of ETH to the user", async () => {
    await cdpManager.addColl(alice, alice, { from: alice, value: _2_Ether })
    
    const txData = await cdpManager.withdrawColl(_1_Ether,  alice, { from: alice })
    
    const ETHSentToAlice = txData.logs[0].args[1].toString() 

    assert.equal(ETHSentToAlice, _1_Ether)
  })

  it("withdrawColl(): applies pending rewards and updates user's L_ETH, L_CLVDebt snapshots", async () => {
    // --- SETUP ---
    // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
    await cdpManager.addColl(alice, alice, { from: alice, value: _15_Ether })
    await cdpManager.addColl(bob, bob, { from: bob, value: _5_Ether })
    await cdpManager.addColl(carol, bob, { from: carol, value: _1_Ether })
    
    // Alice and Bob withdraw 100CLV, Carol withdraws 180CLV
    await cdpManager.withdrawCLV('100000000000000000000', alice, { from: alice })
    await cdpManager.withdrawCLV('100000000000000000000', bob, { from: bob })
    await cdpManager.withdrawCLV('180000000000000000000', carol, { from: carol })
  
    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice(100);

    // close Carol's CDP, liquidating her 1 ether and 180CLV.
    await cdpManager.liquidate(carol, { from: owner });

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
    
    // Alice and Bob withdraw from their CDPs
    await cdpManager.withdrawColl( _5_Ether, alice, { from: alice })
    await cdpManager.withdrawColl( _1_Ether, bob, { from: bob })
    
    /* check that both alice and Bob have had pending rewards applied in addition to their top-ups. When Carol defaulted, 
    the reward-per-unit-staked due to her CDP liquidation was (1/20) ETH and (180/20) CLV Debt.

    Alice, with a stake of 15 ether, should have earned (15 * 1/20)  = 0.75 ETH, and (15 *180/20) = 135 CLV Debt.
    
    After her withdrawal of 5 ether:
    - Her collateral should be (15 + 0.75 - 5) = 10.75 ETH.
    - Her CLV debt should be (100 + 135) = 235 CLV.

    Bob, with a stake of 5 ether, should have earned (5 * 1/20)  = 0.25 ETH, and (5 *180/20) = 45 CLV.
     
    After his withdrawal of 1 ether:
    - His collateral should be (5 + 0.25 - 1) = 4.25 ETH.
    - His CLV debt should be (100 + 45) = 145 CLV.   */
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_CLVDebt_After = (alice_CDP_After[0]).toString()
    const alice_Coll_After = alice_CDP_After[1].toString()

    const bob_CDP_After = await cdpManager.CDPs(bob)
    const bob_CLVDebt_After = bob_CDP_After[0].toString()
    const bob_Coll_After = bob_CDP_After[1].toString()

    assert.equal(alice_CLVDebt_After, '235000000000000000000')
    assert.equal(alice_Coll_After, '10750000000000000000')

    assert.equal(bob_CLVDebt_After, '145000000000000000000')
    assert.equal(bob_Coll_After, '4250000000000000000')

    /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be:

    L_ETH(0): 0.05
    L_CLVDebt(0): 9   */
    alice_rewardSnapshot_After = await cdpManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0].toString()
    const alice_CLVDebtRewardSnapshot_After = alice_rewardSnapshot_After[1].toString()
    
    const bob_rewardSnapshot_After = await cdpManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0].toString()
    const bob_CLVDebtRewardSnapshot_After = bob_rewardSnapshot_After[1].toString()

    assert.equal(alice_ETHrewardSnapshot_After, '50000000000000000')
    assert.equal(alice_CLVDebtRewardSnapshot_After, '9000000000000000000')
    assert.equal(bob_ETHrewardSnapshot_After, '50000000000000000')
    assert.equal(bob_CLVDebtRewardSnapshot_After, '9000000000000000000')
  })

  it("withdrawCLV(): increases the CDP's CLV debt by the correct amount", async () => {
    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check before
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 0)

    await cdpManager.withdrawCLV(100, alice, { from: alice })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, 100)
  })

  it("withdrawCLV(): increases CLV debt in ActivePool by correct amount", async () => {
    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check before
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 0)

    await cdpManager.withdrawCLV(100, alice, { from: alice })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, 100)
  })

  it("withdrawCLV(): increases user CLVToken balance by correct amount", async () => {
    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check before
    const alice_CLVTokenBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_Before, 0)

    await cdpManager.withdrawCLV(100, alice, { from: alice })

    // check after
    const alice_CLVTokenBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_After, 100)
  })

  //repayCLV: reduces CLV debt in CDP
  it("repayCLV(): reduces the CDP's CLV debt by the correct amount", async () => {
    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check before
    await cdpManager.withdrawCLV(100, alice, { from: alice })
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 100)

    await cdpManager.repayCLV(100, alice, { from: alice })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, 0)
  })

  it("repayCLV(): decreases CLV debt in ActivePool by correct amount", async () => {
    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })

    //check before
    await cdpManager.withdrawCLV(100, alice, { from: alice })
    const activePool_CLV_Before = await activePool.getCLV()
    assert.equal(activePool_CLV_Before, 100)

    await cdpManager.repayCLV(100, alice, { from: alice })

    // check after
    activePool_CLV_After = await activePool.getCLV()
    assert.equal(activePool_CLV_After, 0)
  })

  it("repayCLV(): increases user CLVToken balance by correct amount", async () => {
    await cdpManager.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check before
    await cdpManager.withdrawCLV(100, alice,  { from: alice })
    const alice_CLVTokenBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_Before, 100)

    await cdpManager.repayCLV(100, alice,  { from: alice })

    // check after
    const alice_CLVTokenBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_After, 0)
  })
})

contract('Reset chain state', async accounts => {})

/* TODO: 

1) Test SortedList re-ordering by ICR. ICR ratio 
changes with addColl, withdrawColl, withdrawCLV, repayCLV, etc. Can split them up and put them with
individual functions, or give ordering it's own 'describe' block.

2)In security phase: 
-'Negative' tests for all the above functions. 
- Split long tests into shorter, more discrete tests.

*/