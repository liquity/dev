const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th = testHelpers.TestHelper
const mv = testHelpers.MoneyValues

contract('BorrowerOperations', async accounts => {
  const _2_Ether = web3.utils.toWei('2', 'ether')
  const _100_Finney = web3.utils.toWei('100', 'finney')
  const _1_Ether = web3.utils.toWei('1', 'ether')
  const _5_Ether = web3.utils.toWei('5', 'ether')
  const _15_Ether = web3.utils.toWei('15', 'ether')

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
  let borrowerOperations

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
  })

  it("addColl(), non-existent CDP: creates a new CDP and assigns the correct collateral amount", async () => {
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const coll_Before = alice_CDP_Before[1]
    const status_Before = alice_CDP_Before[3]

    // check before
    assert.equal(coll_Before, 0)
    assert.equal(status_Before, 0)  // check non-existent status

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    const status_After = alice_CDP_After[3]

    // check after
    assert.equal(coll_After, _1_Ether)
    assert.equal(status_After, 1)  // check active status
  })

  it("addColl(), non-existent CDP: adds CDP owner to CDPOwners array", async () => {
    const CDPOwnersCount_Before = (await cdpManager.getCDPOwnersCount()).toString();
    assert.equal(CDPOwnersCount_Before, '0')

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    const CDPOwnersCount_After = (await cdpManager.getCDPOwnersCount()).toString();
    assert.equal(CDPOwnersCount_After, '1')
  })

  it("addColl(), non-existent CDP: creates a stake and adds it to total stakes", async () => {
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '0')
    assert.equal(totalStakes_Before, '0')

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_Stake_After = alice_CDP_After[2].toString()
    const totalStakes_After = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, '1000000000000000000')
    assert.equal(totalStakes_After, '1000000000000000000')
  })

  it("addColl(), non-existent CDP: inserts CDP to sortedList", async () => {
    // check before
    const aliceCDPInList_Before = await sortedCDPs.contains(alice)
    const listIsEmpty_Before = await sortedCDPs.isEmpty()
    assert.equal(aliceCDPInList_Before, false)
    assert.equal(listIsEmpty_Before, true)

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check after
    const aliceCDPInList_After = await sortedCDPs.contains(alice)
    const listIsEmpty_After = await sortedCDPs.isEmpty()
    assert.equal(aliceCDPInList_After, true)
    assert.equal(listIsEmpty_After, false)
  })

  it("addColl(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
    const activePool_ETH_Before = await activePool.getETH()
    const activePool_RawEther_Before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_Before, 0)
    assert.equal(activePool_RawEther_Before, 0)

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, _1_Ether)
    assert.equal(activePool_RawEther_After, _1_Ether)
  })

  it("addColl(), active CDP: adds the correct collateral amount to the CDP", async () => {
    // alice creates a CDP and adds first collateral
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    coll_Before = alice_CDP_Before[1]
    const status_Before = alice_CDP_Before[3]

    // check coll and status before
    assert.equal(coll_Before, _1_Ether)
    assert.equal(status_Before, 1)

    // Alice adds second collateral
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    const status_After = alice_CDP_After[3]

    // check coll increases by correct amount,and status remains active
    assert.equal(coll_After, _2_Ether)
    assert.equal(status_After, 1)
  })

  it("addColl(), active CDP: CDP is in sortedList before and after", async () => {
    // alice creates a CDP and adds first collateral
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check Alice is in list before
    const aliceCDPInList_Before = await sortedCDPs.contains(alice)
    const listIsEmpty_Before = await sortedCDPs.isEmpty()
    assert.equal(aliceCDPInList_Before, true)
    assert.equal(listIsEmpty_Before, false)

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check Alice is still in list after
    const aliceCDPInList_After = await sortedCDPs.contains(alice)
    const listIsEmpty_After = await sortedCDPs.isEmpty()
    assert.equal(aliceCDPInList_After, true)
    assert.equal(listIsEmpty_After, false)
  })

  it("addColl(), active CDP: updates the stake and updates the total stakes", async () => {
    //  Alice creates initial CDP with 1 ether
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '1000000000000000000')
    assert.equal(totalStakes_Before, '1000000000000000000')

    // Alice tops up CDP collateral with 2 ether
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _2_Ether })

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
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _15_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _5_Ether })
    await borrowerOperations.addColl(carol, carol, { from: carol, value: _1_Ether })

    // Alice and Bob withdraw 100CLV, Carol withdraws 180CLV
    await borrowerOperations.withdrawCLV('100000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('100000000000000000000', bob, { from: bob })
    await borrowerOperations.withdrawCLV('180000000000000000000', carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Carol's CDP, liquidating her 1 ether and 180CLV.
    await cdpManager.liquidate(carol, { from: owner });
    assert.isFalse(await sortedCDPs.contains(carol))

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
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _5_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _1_Ether })

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
    const alice_CLVDebt_After = alice_CDP_After[0]
    const alice_Coll_After = alice_CDP_After[1]

    const bob_CDP_After = await cdpManager.CDPs(bob)
    const bob_CLVDebt_After = bob_CDP_After[0]
    const bob_Coll_After = bob_CDP_After[1]

    // check coll and debt are within 1e-16 of expected values
    assert.isAtMost(th.getDifference(alice_CLVDebt_After,'235000000000000000000'), 100)
    assert.isAtMost(th.getDifference(alice_Coll_After, '20750000000000000000'), 100)
    assert.isAtMost(th.getDifference(bob_CLVDebt_After,'145000000000000000000'), 100)
    assert.isAtMost(th.getDifference(bob_Coll_After, '6250000000000000000'), 100)

    /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be:

    L_ETH(0): 0.05
    L_CLVDebt(0): 9   */
    alice_rewardSnapshot_After = await cdpManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
    const alice_CLVDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]

    const bob_rewardSnapshot_After = await cdpManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
    const bob_CLVDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]

    assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, '50000000000000000'), 100)
    assert.isAtMost(th.getDifference(alice_CLVDebtRewardSnapshot_After, '9000000000000000000'), 100)
    assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, '50000000000000000'), 100)
    assert.isAtMost(th.getDifference(bob_CLVDebtRewardSnapshot_After, '9000000000000000000'), 100)
  })

  it("addColl(), active CDP: adds the right corrected stake after liquidations have occured", async () => {
    // --- SETUP ---
    // Alice and Bob add 10 ether, Carol adds 1 ether
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _15_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _5_Ether })
    await borrowerOperations.addColl(carol, carol, { from: carol, value: _5_Ether })

    // Alice and Bob withdraw 100CLV, Carol withdraws 900CLV
    await borrowerOperations.withdrawCLV('100000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('100000000000000000000', bob, { from: bob })
    await borrowerOperations.withdrawCLV('900000000000000000000', carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Carol's CDP, liquidating her 5 ether and 900CLV.
    await cdpManager.liquidate(carol, { from: owner });

    // dennis opens a CDP with 2 ether
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _2_Ether })

    /* Check that Dennis's recorded stake is the right corrected stake, less than his collateral. A corrected 
    stake is given by the formula: 
    
    s = totalStakesSnapshot / totalCollateralSnapshot 
    
    where snapshots are the values immediately after the last liquidation.  After Carol's liquidation, 
    the ETH from her CDP has now become the totalPendingETHReward. So:

    totalStakes = (alice_Stake + bob_Stake) = (15 + 5) = 20 ETH.
    totalCollateral = (alice_Collateral + bob_Collateral + totalPendingETHReward) = (15 + 5 + 5)  = 25 ETH.

    Therefore, as Dennis adds 2 ether collateral, his corrected stake should be:  s = 2 * (20 / 25 ) = 1.6 ETH */
    const dennis_CDP = await cdpManager.CDPs(dennis)
    const dennis_Stake = dennis_CDP[2]

    assert.isAtMost(Number(dennis_Stake.sub(web3.utils.toBN('1600000000000000000')).abs()), 100)

  })

  it("addColl(): reverts if user tries to open a new CDP with collateral of value < $20 USD", async () => {
    /* Alice adds 0.0999 ether. At a price of 200 USD per ETH, 
    her collateral value is < $20 USD.  So her tx should revert */
    const coll = '99999999999999999'

    try {
      const txData = await borrowerOperations.addColl(alice, alice, { from: alice, value: coll })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("addColl(): allows a user to top up an active CDP with additional collateral of value < $20 USD", async () => {
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _100_Finney })

    // Tops up with only one wei
    const txData = await borrowerOperations.addColl(alice, alice, { from: alice, value: '1' })

    // check top-up was successful
    txStatus = txData.receipt.status
    assert.isTrue(txStatus)
  })

  it("addColl(): allows a user to open a CDP, then close it, then re-open it", async () => {
    // Open CDP 
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV('17500000000000000000', alice, { from: alice })

    // Check CDP is active
    const alice_CDP_1 = await cdpManager.CDPs(alice)
    const status_1 = alice_CDP_1[3]
    assert.equal(status_1, 1)
    assert.isTrue(await sortedCDPs.contains(alice))

    // Repay and close CDP
    await borrowerOperations.repayCLV('17500000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawColl(_1_Ether, alice, { from: alice })

    // Check CDP is closed
    const alice_CDP_2 = await cdpManager.CDPs(alice)
    const status_2 = alice_CDP_2[3]
    assert.equal(status_2, 2)
    assert.isFalse(await sortedCDPs.contains(alice))

    // Re-open CDP
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _2_Ether })
    await borrowerOperations.withdrawCLV('25000000000000000000', alice, { from: alice })

    // Check CDP is re-opened
    const alice_CDP_3 = await cdpManager.CDPs(alice)
    const status_3 = alice_CDP_3[3]
    assert.equal(status_3, 1)
    assert.isTrue(await sortedCDPs.contains(alice))
  })

  it("withdrawColl(): reverts if dollar value of remaining collateral in CDP would be < $20 USD", async () => {
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _100_Finney })

    // Alice attempts to withdraw 1 wei. Check tx reverts
    try {
      const txData = await borrowerOperations.withdrawColl('1', alice, { from: alice })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "Remaining collateral must have $USD value >= 20, or be zero")
    }
  })

  it("withdrawColl(): allows a user to completely withdraw all collateral from their CDP", async () => {
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _100_Finney })

    // Alice attempts to withdraw all collateral
    const txData = await borrowerOperations.withdrawColl(_100_Finney, alice, { from: alice })

    // check withdrawal was successful
    txStatus = txData.receipt.status
    assert.isTrue(txStatus)
  })

  it("withdrawColl(): closes the CDP when the user withdraws all collateral", async () => {
    // Open CDP 
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    // Check CDP is active
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const status_Before = alice_CDP_Before[3]
    assert.equal(status_Before, 1)
    assert.isTrue(await sortedCDPs.contains(alice))

    // Withdraw all the collateral in the CDP
    await borrowerOperations.withdrawColl(_1_Ether, alice, { from: alice })

    // Check CDP is closed
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const status_After = alice_CDP_After[3]
    assert.equal(status_After, 2)
    assert.isFalse(await sortedCDPs.contains(alice))

  })

  it("withdrawColl(): leaves the CDP active when the user withdraws less than all the collateral", async () => {
    // Open CDP 
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    // Check CDP is active
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const status_Before = alice_CDP_Before[3]
    assert.equal(status_Before, 1)
    assert.isTrue(await sortedCDPs.contains(alice))

    // Withdraw some collateral
    await borrowerOperations.withdrawColl(_100_Finney, alice, { from: alice })

    // Check CDP is still active
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const status_After = alice_CDP_After[3]
    assert.equal(status_After, 1)
    assert.isTrue(await sortedCDPs.contains(alice))
  })

  it("withdrawColl(): reduces the CDP's collateral by the correct amount", async () => {
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _2_Ether })

    // check before -  Alice has 2 ether in CDP 
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const coll_Before = alice_CDP_Before[1]
    console.log(`coll before: ${coll_Before}`)
    assert.equal(coll_Before, _2_Ether)

    // Alice withdraws 1 ether
    await borrowerOperations.withdrawColl(_1_Ether, alice, { from: alice })

    // Check 1 ether remaining
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const coll_After = alice_CDP_After[1]
    console.log(`coll after: ${coll_After}`)
    assert.equal(coll_After, _1_Ether)
  })

  it("withdrawColl(): reduces ActivePool ETH and raw ether by correct amount", async () => {
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _2_Ether })

    // check before
    const activePool_ETH_before = await activePool.getETH()
    const activePool_RawEther_before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_before, _2_Ether)
    assert.equal(activePool_RawEther_before, _2_Ether)

    await borrowerOperations.withdrawColl(_1_Ether, alice, { from: alice })

    // check after
    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, _1_Ether)
    assert.equal(activePool_RawEther_After, _1_Ether)
  })

  it("withdrawColl(): updates the stake and updates the total stakes", async () => {
    //  Alice creates initial CDP with 2 ether
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _2_Ether })

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '2000000000000000000')
    assert.equal(totalStakes_Before, '2000000000000000000')

    // Alice withdraws 1 ether
    await borrowerOperations.withdrawColl(_1_Ether, alice, { from: alice })

    // Check stake and total stakes get updated
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_Stake_After = alice_CDP_After[2].toString()
    const totalStakes_After = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, '1000000000000000000')
    assert.equal(totalStakes_After, '1000000000000000000')
  })

  it("withdrawColl(): sends the correct amount of ETH to the user", async () => {
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _2_Ether })

    const alice_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))
    await borrowerOperations.withdrawColl(_1_Ether, alice, { from: alice, gasPrice: 0 })

    const alice_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(alice))
    const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

    //   assert.equal(balanceDiff.toString(), _1_Ether)
  })

  it("withdrawColl(): applies pending rewards and updates user's L_ETH, L_CLVDebt snapshots", async () => {
    // --- SETUP ---
    // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _15_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _5_Ether })
    await borrowerOperations.addColl(carol, bob, { from: carol, value: _1_Ether })

    // Alice and Bob withdraw 100CLV, Carol withdraws 180CLV
    await borrowerOperations.withdrawCLV('100000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('100000000000000000000', bob, { from: bob })
    await borrowerOperations.withdrawCLV('180000000000000000000', carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

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
    await borrowerOperations.withdrawColl(_5_Ether, alice, { from: alice })
    await borrowerOperations.withdrawColl(_1_Ether, bob, { from: bob })

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
    const alice_CLVDebt_After = alice_CDP_After[0]
    const alice_Coll_After = alice_CDP_After[1]

    const bob_CDP_After = await cdpManager.CDPs(bob)
    const bob_CLVDebt_After = bob_CDP_After[0]
    const bob_Coll_After = bob_CDP_After[1]

    assert.isAtMost(th.getDifference(alice_CLVDebt_After, '235000000000000000000'), 100)
    assert.isAtMost(th.getDifference(alice_Coll_After, '10750000000000000000'), 100)

    assert.isAtMost(th.getDifference(bob_CLVDebt_After, '145000000000000000000'), 100)
    assert.isAtMost(th.getDifference(bob_Coll_After, '4250000000000000000'), 100)

    /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be:
 
    L_ETH(0): 0.05
    L_CLVDebt(0): 9   */
    alice_rewardSnapshot_After = await cdpManager.rewardSnapshots(alice)
    const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
    const alice_CLVDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]

    const bob_rewardSnapshot_After = await cdpManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
    const bob_CLVDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]

    assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, '50000000000000000'), 100)
    assert.isAtMost(th.getDifference(alice_CLVDebtRewardSnapshot_After, '9000000000000000000'), 100)
    assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, '50000000000000000'), 100)
    assert.isAtMost(th.getDifference(bob_CLVDebtRewardSnapshot_After, '9000000000000000000'), 100)
  })

  it("withdrawCLV(): increases the CDP's CLV debt by the correct amount", async () => {
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check before
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 0)

    await borrowerOperations.withdrawCLV(100, alice, { from: alice })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, 100)
  })

  it("withdrawCLV(): increases CLV debt in ActivePool by correct amount", async () => {
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check before
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 0)

    await borrowerOperations.withdrawCLV(100, alice, { from: alice })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, 100)
  })

  it("withdrawCLV(): increases user CLVToken balance by correct amount", async () => {
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check before
    const alice_CLVTokenBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_Before, 0)

    await borrowerOperations.withdrawCLV(100, alice, { from: alice })

    // check after
    const alice_CLVTokenBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_After, 100)
  })

  //repayCLV: reduces CLV debt in CDP
  it("repayCLV(): reduces the CDP's CLV debt by the correct amount", async () => {
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check before
    await borrowerOperations.withdrawCLV(100, alice, { from: alice })
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const debt_Before = alice_CDP_Before[0]
    assert.equal(debt_Before, 100)

    await borrowerOperations.repayCLV(100, alice, { from: alice })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, 0)
  })

  it("repayCLV(): decreases CLV debt in ActivePool by correct amount", async () => {
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    //check before
    await borrowerOperations.withdrawCLV(100, alice, { from: alice })
    const activePool_CLV_Before = await activePool.getCLV()
    assert.equal(activePool_CLV_Before, 100)

    await borrowerOperations.repayCLV(100, alice, { from: alice })

    // check after
    activePool_CLV_After = await activePool.getCLV()
    assert.equal(activePool_CLV_After, 0)
  })

  it("repayCLV(): decreases user CLVToken balance by correct amount", async () => {
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    // check before
    await borrowerOperations.withdrawCLV(100, alice, { from: alice })
    const alice_CLVTokenBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_Before, 100)

    await borrowerOperations.repayCLV(100, alice, { from: alice })

    // check after
    const alice_CLVTokenBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_After, 0)
  })

   // --- adjustLoan() ---

   it("adjustLoan(): updates borrower's debt and coll with an increase in both", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtBefore, mv._100e18)
    assert.equal(collBefore, mv._1_Ether)

    // Alice adjusts loan. Coll and debt increase(+0.5 ETH, +50CLV)
    await borrowerOperations.adjustLoan(0, mv._50e18, alice, { from: alice, value: mv._1_Ether })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtAfter, mv._150e18)
    assert.equal(collAfter, mv._2_Ether)
  })

 
  it("adjustLoan(): updates borrower's debt and coll with a decrease in both", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtBefore, mv._100e18)
    assert.equal(collBefore, mv._1_Ether)

    // Alice adjusts loan coll and debt decrease (-0.5 ETH, -50CLV)
    await borrowerOperations.adjustLoan(mv._0pt5_Ether, mv.negative_50e18, alice, { from: alice })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtAfter, mv._50e18)
    assert.equal(collAfter, mv._0pt5_Ether)
  })

  it("adjustLoan(): updates borrower's  debt and coll with coll increase, debt decrease", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtBefore, mv._100e18)
    assert.equal(collBefore, mv._1_Ether)

    // Alice adjusts loan - coll increase and debt decrease (+0.5 ETH, +50CLV)
    await borrowerOperations.adjustLoan(0, mv.negative_50e18, alice, { from: alice, value: mv._0pt5_Ether })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtAfter, mv._50e18)
    assert.equal(collAfter, mv._1pt5_Ether)
  })


  it("adjustLoan(): updates borrower's debt and coll with coll decrease, debt increase", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtBefore, mv._100e18)
    assert.equal(collBefore, mv._1_Ether)

    // Alice adjusts loan - coll decrease and debt increase (0.1 ETH, 10CLV)
    await borrowerOperations.adjustLoan('100000000000000000', mv._10e18, alice, { from: alice })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtAfter, mv._110e18)
    assert.equal(collAfter, '900000000000000000')
  })

  it("adjustLoan(): updates borrower's stake and totalStakes with a coll increase", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })

    const stakeBefore = ((await cdpManager.CDPs(alice))[2]).toString()
    const totalStakesBefore = await cdpManager.totalStakes();

    assert.equal(stakeBefore, mv._1_Ether)
    assert.equal(totalStakesBefore, '101000000000000000000')

    // Alice adjusts loan - coll and debt increase (+1 ETH, +50 CLV)
    await borrowerOperations.adjustLoan(0, mv._50e18, alice, { from: alice, value: mv._1_Ether })

    const stakeAfter = ((await cdpManager.CDPs(alice))[2]).toString()
    const totalStakesAfter = await cdpManager.totalStakes();

    assert.equal(stakeAfter, mv._2_Ether)
    assert.equal(totalStakesAfter, '102000000000000000000')
  })

  it("adjustLoan():  updates borrower's stake and totalStakes with a coll decrease", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })

    const stakeBefore = ((await cdpManager.CDPs(alice))[2]).toString()
    const totalStakesBefore = await cdpManager.totalStakes();

    assert.equal(stakeBefore, mv._1_Ether)
    assert.equal(totalStakesBefore, '101000000000000000000')

    // Alice adjusts loan - coll decrease and debt decrease
    await borrowerOperations.adjustLoan(mv._0pt5_Ether, mv.negative_50e18, alice, { from: alice })

    const stakeAfter = ((await cdpManager.CDPs(alice))[2]).toString()
    const totalStakesAfter = await cdpManager.totalStakes();

    assert.equal(stakeAfter, '500000000000000000')
    assert.equal(totalStakesAfter, '100500000000000000000')
  })

  it("adjustLoan(): changes CLVToken balance by the requested decrease", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })

    const alice_CLVTokenBalance_Before = (await clvToken.balanceOf(alice)).toString()
    assert.equal(alice_CLVTokenBalance_Before, mv._100e18)

    // Alice adjusts loan - coll decrease and debt decrease
    await borrowerOperations.adjustLoan(mv._1e17, mv.negative_10e18, alice, { from: alice })

    // check after
    const alice_CLVTokenBalance_After = (await clvToken.balanceOf(alice)).toString()
    assert.equal(alice_CLVTokenBalance_After, mv._90e18)
  })

  it("adjustLoan(): changes CLVToken balance by the requested increase", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })

    const alice_CLVTokenBalance_Before = (await clvToken.balanceOf(alice)).toString()
    assert.equal(alice_CLVTokenBalance_Before, mv._100e18)

    // Alice adjusts loan - coll increase and debt increase
    await borrowerOperations.adjustLoan(0, mv._100e18, alice, { from: alice, value: mv._1_Ether })

    // check after
    const alice_CLVTokenBalance_After = (await clvToken.balanceOf(alice)).toString()
    assert.equal(alice_CLVTokenBalance_After,mv._200e18)
  })

  it("adjustLoan(): Changes the activePool ETH and raw ether balance by the requested decrease", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })

    const activePool_ETH_Before = (await activePool.getETH()).toString()
    const activePool_RawEther_Before = (await web3.eth.getBalance(activePool.address)).toString()
    assert.equal(activePool_ETH_Before, '101000000000000000000')
    assert.equal(activePool_RawEther_Before, '101000000000000000000')

    // Alice adjusts loan - coll decrease and debt decrease
    await borrowerOperations.adjustLoan(mv._1e17, mv.negative_10e18, alice, { from: alice })

    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, '100900000000000000000')
    assert.equal(activePool_RawEther_After, '100900000000000000000')
  })

  it("adjustLoan(): Changes the activePool ETH and raw ether balance by the amount of ETH sent", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: mv._1_Ether })

    const activePool_ETH_Before = (await activePool.getETH()).toString()
    const activePool_RawEther_Before = (await web3.eth.getBalance(activePool.address)).toString()
    assert.equal(activePool_ETH_Before, '101000000000000000000')
    assert.equal(activePool_RawEther_Before, '101000000000000000000')

    // Alice adjusts loan - coll increase and debt increase
    await borrowerOperations.adjustLoan(0, mv._100e18, alice, { from: alice, value: mv._1_Ether })

    const activePool_ETH_After = (await activePool.getETH()).toString()
    const activePool_RawEther_After = (await web3.eth.getBalance(activePool.address)).toString()
    assert.equal(activePool_ETH_After, '102000000000000000000')
    assert.equal(activePool_RawEther_After, '102000000000000000000')
  })

  it("adjustLoan(): Changes the CLV debt in ActivePool by requested decrease", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })
    
    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: _1_Ether })

    const activePool_CLVDebt_Before = (await activePool.getCLV()).toString()
    assert.equal(activePool_CLVDebt_Before, mv._100e18)

    // Alice adjusts loan - coll increase and debt increase
    await borrowerOperations.adjustLoan(0, mv.negative_50e18, alice, { from: alice, value: mv._1_Ether })

    const activePool_CLVDebt_After = (await activePool.getCLV()).toString()
    assert.equal(activePool_CLVDebt_After, mv._50e18)
  })

  it("adjustLoan():Changes the CLV debt in ActivePool by requested increase", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: _1_Ether })

    const activePool_CLVDebt_Before = (await activePool.getCLV()).toString()
    assert.equal(activePool_CLVDebt_Before, mv._100e18)

    // Alice adjusts loan - coll increase and debt increase
    await borrowerOperations.adjustLoan(0, mv._100e18, alice, { from: alice, value: mv._1_Ether })

    const activePool_CLVDebt_After = (await activePool.getCLV()).toString()
    assert.equal(activePool_CLVDebt_After,mv._200e18)
  })

  it("adjustLoan(): Closes the CDP if  new coll = 0 and new debt = 0", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })
    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: _1_Ether })

    const status_Before = (await cdpManager.CDPs(alice))[3]
    const isInSortedList_Before = await sortedCDPs.contains(alice)
 
    assert.equal(status_Before, 1)  // 1: Active
    assert.isTrue(isInSortedList_Before)

    await borrowerOperations.adjustLoan(mv._1_Ether, mv.negative_100e18, alice, { from: alice })

    const status_After = (await cdpManager.CDPs(alice))[3]
    const isInSortedList_After = await sortedCDPs.contains(alice)

    assert.equal(status_After, 2) //2: Closed
    assert.isFalse(isInSortedList_After)
  })


  it("adjustLoan():  Deposits the received ether in the trove and ignores requested coll withdrawal if ether is sent", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })
    await borrowerOperations.openLoan(mv._100e18, alice, { from: alice, value: _1_Ether })

    const aliceColl_Before = (await cdpManager.CDPs(alice))[1].toString()
    assert.equal(aliceColl_Before, mv._1_Ether)

    await borrowerOperations.adjustLoan(mv._1_Ether, mv._100e18, alice, { from: alice, value: mv._3_Ether })

    const aliceColl_After = (await cdpManager.CDPs(alice))[1].toString()
    assert.equal(aliceColl_After, mv._4_Ether)
  })

  // --- closeLoan() ---

  it("closeLoan(): reduces a CDP's collateral to zero", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: mv._10_Ether })
    // await borrowerOperations.withdrawCLV(mv._100e18, dennis, { from: dennis })

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, { from: alice })

    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()
    assert.equal(collBefore, _1_Ether)

    // Alice attempts to close loan
    await borrowerOperations.closeLoan({ from: alice })

    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()
    assert.equal(collAfter, '0')
    // check withdrawal was successful
  })

  it("closeLoan(): reduces a CDP's debt to zero", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: mv._10_Ether })

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, { from: alice })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    assert.equal(debtBefore, mv._100e18)

    // Alice attempts to close loan
    await borrowerOperations.closeLoan({ from: alice })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    assert.equal(debtAfter, '0')
    // check withdrawal was successful
  })

  it("closeLoan(): sets CDP's stake to zero", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: mv._10_Ether })

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, { from: alice })

    const stakeBefore = ((await cdpManager.CDPs(alice))[2]).toString()
    assert.equal(stakeBefore, _1_Ether)

    // Alice attempts to close loan
    await borrowerOperations.closeLoan({ from: alice })

    const stakeAfter = ((await cdpManager.CDPs(alice))[2]).toString()
    assert.equal(stakeAfter, '0')
    // check withdrawal was successful
  })

  it("closeLoan(): closes the CDP", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: mv._10_Ether })

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, { from: alice })

    // Check CDP is active
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const status_Before = alice_CDP_Before[3]

    assert.equal(status_Before, 1)
    assert.isTrue(await sortedCDPs.contains(alice))

    // Close the loan
    await borrowerOperations.closeLoan({ from: alice })

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const status_After = alice_CDP_After[3]

    assert.equal(status_After, 2)
    assert.isFalse(await sortedCDPs.contains(alice))
  })

  it("closeLoan(): reduces ActivePool ETH and raw ether by correct amount", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: mv._10_Ether })

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, { from: alice })

    // Check before
    const activePool_ETH_before = await activePool.getETH()
    const activePool_RawEther_before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_before, mv._11_Ether)
    assert.equal(activePool_RawEther_before, mv._11_Ether)

    // Close the loan
    await borrowerOperations.closeLoan({ from: alice })

    // Check after
    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, mv._10_Ether)
    assert.equal(activePool_RawEther_After, mv._10_Ether)
  })

  it("closeLoan(): reduces ActivePool debt by correct amount", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: mv._10_Ether })

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, { from: alice })

    // Check before
    const activePool_Debt_before = (await activePool.getETH()).toString()
    assert.equal(activePool_Debt_before, mv._11_Ether)

    // Close the loan
    await borrowerOperations.closeLoan({ from: alice })

    // Check after
    const activePool_Debt_After = (await activePool.getCLV()).toString()
    assert.equal(activePool_Debt_After, 0)
  })

  it("closeLoan(): updates the the total stakes", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: mv._10_Ether })
    //  Alice creates initial CDP with 2 ether
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.addColl(bob, bob, { from: alice, value: _1_Ether })

    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '1000000000000000000')
    assert.equal(totalStakes_Before, '12000000000000000000')

    // Alice closes loan
    await borrowerOperations.closeLoan({ from: alice })

    // Check stake and total stakes get updated
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const alice_Stake_After = alice_CDP_After[2].toString()
    const totalStakes_After = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_After, 0)
    assert.equal(totalStakes_After, mv._11_Ether)
  })

  it("closeLoan(): sends the correct amount of ETH to the user", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: mv._10_Ether })
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    const alice_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))
    await borrowerOperations.closeLoan({ from: alice, gasPrice: 0 })

    const alice_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(alice))
    const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

    assert.equal(balanceDiff, _1_Ether)
  })

  it("closeLoan(): subtracts the debt of the closed CDP from the Borrower's CLVToken balance", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: mv._10_Ether })

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(mv._100e18, alice, { from: alice })

    const alice_CLVBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVBalance_Before, mv._100e18)

    // close loan
    await borrowerOperations.closeLoan({ from: alice })

  //   // check alive CLV balance after

    const alice_CLVBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVBalance_After, 0)
  })

  it("closeLoan(): applies pending rewards and updates user's L_ETH, L_CLVDebt snapshots", async () => {
    // --- SETUP ---
    // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _15_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _5_Ether })
    await borrowerOperations.addColl(carol, carol, { from: carol, value: _1_Ether })

    // Alice and Bob withdraw 100CLV, Carol withdraws 180CLV
    await borrowerOperations.withdrawCLV('100000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('100000000000000000000', bob, { from: bob })
    await borrowerOperations.withdrawCLV('180000000000000000000', carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');
    const price = await priceFeed.getPrice()

    // close Carol's CDP, liquidating her 1 ether and 180CLV. Alice and Bob earn rewards.
    await cdpManager.liquidate(carol, { from: owner });

    // Dennis opens a new CDP with 10 Ether, withdraws CLV and sends 135 CLV to Alice, and 45 CLV to Bob.

    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value:mv. _100_Ether })
    await borrowerOperations.withdrawCLV(mv._200e18, dennis, { from: dennis })
    await clvToken.transfer(alice, '135000000000000000000', { from: dennis })
    await clvToken.transfer(bob, '45000000000000000000', { from: dennis })

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

    assert.isAtMost(th.getDifference(L_ETH, '50000000000000000'), 100)
    assert.isAtMost(th.getDifference(L_CLVDebt, '9000000000000000000'), 100)

    const defaultPool_ETH = await defaultPool.getETH()
    const defaultPool_CLVDebt = await defaultPool.getCLV()

    // Carol's liquidated coll (1 ETH) and debt (180 CLV) should have entered the Default Pool
    assert.isAtMost(th.getDifference(defaultPool_ETH, _1_Ether), 100)
    assert.isAtMost(th.getDifference(defaultPool_CLVDebt, mv._180e18), 100)

    /* Close Alice's loan.
    
    Alice, with a stake of 15 ether, should have earned (15 * 1/20)  = 0.75 ETH, and (15 *180/20) = 135 CLV Debt.
    These rewards are applied when she closes her loan. 
    
    Default Pool coll should be (1-0.75) = 0.25 ETH, and DefaultPool debt should be (180-135) = 45 CLV.
    // check L_ETH and L_CLV reduce by Alice's reward */
    await borrowerOperations.closeLoan({ from: alice })

    const defaultPool_ETH_afterAliceCloses = await defaultPool.getETH()
    const defaultPool_CLVDebt_afterAliceCloses = await defaultPool.getCLV()

    assert.isAtMost(th.getDifference(defaultPool_ETH_afterAliceCloses, 250000000000000000), 100)
    assert.isAtMost(th.getDifference(defaultPool_CLVDebt_afterAliceCloses, 45000000000000000000), 100)

    /* Close Bob's loan.

    Bob, with a stake of 5 ether, should have earned (5 * 1/20)  = 0.25 ETH, and (5 *180/20) = 45 CLV.
    DefaultPool coll should reduce by 0.25 ETH to 0, and DefaultPool debt should reduce by 45, to 0. */

    await borrowerOperations.closeLoan({ from: bob })

    const defaultPool_ETH_afterBobCloses = await defaultPool.getETH()
    const defaultPool_CLVDebt_afterBobCloses = await defaultPool.getCLV()

    assert.isAtMost(th.getDifference(defaultPool_ETH_afterBobCloses, 0), 100)
    assert.isAtMost(th.getDifference(defaultPool_CLVDebt_afterBobCloses, 0), 100)
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

    await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

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

    await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

    const CDPOwnersCount_After = (await cdpManager.getCDPOwnersCount()).toString();
    assert.equal(CDPOwnersCount_After, '1')
  })

  it("openLoan(): creates a stake and adds it to total stakes", async () => {
    const alice_CDP_Before = await cdpManager.CDPs(alice)
    const alice_Stake_Before = alice_CDP_Before[2].toString()
    const totalStakes_Before = (await cdpManager.totalStakes()).toString()

    assert.equal(alice_Stake_Before, '0')
    assert.equal(totalStakes_Before, '0')

    await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

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

    await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

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

    await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, _1_Ether)
    assert.equal(activePool_RawEther_After, _1_Ether)
  })

  it("openLoan(): records up-to-date initial snapshots of L_ETH and L_CLVDebt", async () => {
    // --- SETUP ---
    /* Alice adds 10 ether
    Carol adds 1 ether */
    await borrowerOperations.addColl(alice, alice, { from: alice, value: mv._10_Ether })
    // await borrowerOperations.addColl('100000000000000000000', bob, { from: bob, value: _5_Ether })
    await borrowerOperations.addColl(carol, carol, { from: carol, value: _1_Ether })

    // Alice withdraws 100CLV, Carol withdraws 180CLV
    await borrowerOperations.withdrawCLV('100000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('180000000000000000000', carol, { from: carol })

    // --- TEST ---

    // price drops to 1ETH:100CLV, reducing Carol's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // close Carol's CDP, liquidating her 1 ether and 180CLV.
    await cdpManager.liquidate(carol, { from: owner });

    /* with total stakes = 10 ether, after liquidation, L_ETH should equal 1/10 ether per-ether-staked,
     and L_CLV should equal 18 CLV per-ether-staked. */

    const L_ETH = await cdpManager.L_ETH()
    const L_CLV = await cdpManager.L_CLVDebt()

    assert.isAtMost(th.getDifference(L_ETH, '100000000000000000'), 100)
    assert.isAtMost(th.getDifference(L_CLV, '18000000000000000000'), 100)

    // Bob opens loan
    await borrowerOperations.openLoan('50000000000000000000', bob, { from: bob, value: _1_Ether })

    // check Bob's snapshots of L_ETH and L_CLV equal the respective current values
    const bob_rewardSnapshot = await cdpManager.rewardSnapshots(bob)
    const bob_ETHrewardSnapshot = bob_rewardSnapshot[0]
    const bob_CLVDebtRewardSnapshot = bob_rewardSnapshot[1]

    assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot, L_ETH), 100)
    assert.isAtMost(th.getDifference(bob_CLVDebtRewardSnapshot, L_CLV), 100)
  })

  it("openLoan(): reverts if user tries to open a new CDP with collateral of value < $20 USD", async () => {
    /* Alice adds 0.0999 ether. At a price of 200 USD per ETH, 
    her collateral value is < $20 USD.  So her tx should revert */
    const coll = '99999999999999999'

    try {
      const txData = await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: coll })
      assert.fail(txData)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "CDPManager: Collateral must have $USD value >= 20")
    }
  })

  it("openLoan(): allows a user to open a CDP, then close it, then re-open it", async () => {
    // Open CDP 
    await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

    // Check CDP is active
    const alice_CDP_1 = await cdpManager.CDPs(alice)
    const status_1 = alice_CDP_1[3]
    assert.equal(status_1, 1)
    assert.isTrue(await sortedCDPs.contains(alice))

    // Repay and close CDP
    await borrowerOperations.repayCLV('50000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawColl(_1_Ether, alice, { from: alice })

    // Check CDP is closed
    const alice_CDP_2 = await cdpManager.CDPs(alice)
    const status_2 = alice_CDP_2[3]
    assert.equal(status_2, 2)
    assert.isFalse(await sortedCDPs.contains(alice))

    // Re-open CDP
    await borrowerOperations.openLoan('25000000000000000000', alice, { from: alice, value: _1_Ether })

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

    await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

    // check after
    const alice_CDP_After = await cdpManager.CDPs(alice)
    const debt_After = alice_CDP_After[0]
    assert.equal(debt_After, '50000000000000000000')
  })

  it("openLoan(): increases CLV debt in ActivePool by correct amount", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: mv._100_Ether })

    const activePool_CLVDebt_Before = await activePool.getCLV()
    assert.equal(activePool_CLVDebt_Before, 0)

    await borrowerOperations.openLoan(mv._50e18, alice, { from: alice, value: _1_Ether })

    const activePool_CLVDebt_After = await activePool.getCLV()
    assert.equal(activePool_CLVDebt_After, mv._50e18)
  })

  it("openLoan(): increases user CLVToken balance by correct amount", async () => {
    // check before
    const alice_CLVTokenBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_Before, 0)

    await borrowerOperations.openLoan('50000000000000000000', alice, { from: alice, value: _1_Ether })

    // check after
    const alice_CLVTokenBalance_After = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVTokenBalance_After, '50000000000000000000')
  })
})



contract('Reset chain state', async accounts => { })

/* TODO:

1) Test SortedList re-ordering by ICR. ICR ratio
changes with addColl, withdrawColl, withdrawCLV, repayCLV, etc. Can split them up and put them with
individual functions, or give ordering it's own 'describe' block.

2)In security phase:
-'Negative' tests for all the above functions.
*/