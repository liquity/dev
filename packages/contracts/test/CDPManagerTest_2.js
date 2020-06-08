const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th = testHelpers.TestHelper
const moneyVals = testHelpers.MoneyValues

contract('CDPManager', async accounts => {
  const _1_Ether = web3.utils.toWei('1', 'ether')
  const _2_Ether = web3.utils.toWei('2', 'ether')
  const _5_Ether = web3.utils.toWei('5', 'ether')
  const _10_Ether = web3.utils.toWei('10', 'ether')
  const _11_Ether = web3.utils.toWei('11', 'ether')
  const _15_Ether = web3.utils.toWei('15', 'ether')
  const _50_Ether = web3.utils.toWei('50', 'ether')
  const _100_Ether = web3.utils.toWei('100', 'ether')

  const _100e18 = web3.utils.toWei('100', 'ether')
  const _150e18 = web3.utils.toWei('150', 'ether')
  const _180e18 = web3.utils.toWei('180', 'ether')
  const _200e18 = web3.utils.toWei('200', 'ether')

  const _18_zeros = '000000000000000000'

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

  // --- adjustLoan() ---

  it("adjustLoan(): updates borrower's debt and coll with an increase in both", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

    await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._1_Ether })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtBefore, moneyVals._100e18)
    assert.equal(collBefore, moneyVals._1_Ether)

    // Alice adjusts loan. Coll and debt increase(+0.5 ETH, +50CLV)
    await borrowerOperations.adjustLoan(0, moneyVals._50e18, alice, { from: alice, value: moneyVals._1_Ether })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtAfter, moneyVals._150e18)
    assert.equal(collAfter, moneyVals._2_Ether)
  })

 
  it("adjustLoan(): updates borrower's debt and coll with a decrease in both", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

    await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._1_Ether })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtBefore, moneyVals._100e18)
    assert.equal(collBefore, moneyVals._1_Ether)

    // Alice adjusts loan coll and debt decrease (-0.5 ETH, -50CLV)
    await borrowerOperations.adjustLoan(moneyVals._0pt5_Ether, moneyVals.negative_50e18, alice, { from: alice })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtAfter, moneyVals._50e18)
    assert.equal(collAfter, moneyVals._0pt5_Ether)
  })

  it("adjustLoan(): updates borrower's  debt and coll with coll increase, debt decrease", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

    await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._1_Ether })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtBefore, moneyVals._100e18)
    assert.equal(collBefore, moneyVals._1_Ether)

    // Alice adjusts loan - coll increase and debt decrease (+0.5 ETH, +50CLV)
    await borrowerOperations.adjustLoan(0, moneyVals.negative_50e18, alice, { from: alice, value: moneyVals._0pt5_Ether })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtAfter, moneyVals._50e18)
    assert.equal(collAfter, moneyVals._1pt5_Ether)
  })


  it("adjustLoan(): updates borrower's debt and coll with coll decrease, debt increase", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

    await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._1_Ether })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtBefore, moneyVals._100e18)
    assert.equal(collBefore, moneyVals._1_Ether)

    // Alice adjusts loan - coll decrease and debt increase (0.1 ETH, 10CLV)
    await borrowerOperations.adjustLoan('100000000000000000', moneyVals._10e18, alice, { from: alice })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()

    assert.equal(debtAfter, moneyVals._110e18)
    assert.equal(collAfter, '900000000000000000')
  })

  it("adjustLoan(): updates borrower's stake and totalStakes with a coll increase", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

    await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._1_Ether })

    const stakeBefore = ((await cdpManager.CDPs(alice))[2]).toString()
    const totalStakesBefore = await cdpManager.totalStakes();

    assert.equal(stakeBefore, moneyVals._1_Ether)
    assert.equal(totalStakesBefore, '101000000000000000000')

    // Alice adjusts loan - coll and debt increase (+1 ETH, +50 CLV)
    await borrowerOperations.adjustLoan(0, moneyVals._50e18, alice, { from: alice, value: moneyVals._1_Ether })

    const stakeAfter = ((await cdpManager.CDPs(alice))[2]).toString()
    const totalStakesAfter = await cdpManager.totalStakes();

    assert.equal(stakeAfter, moneyVals._2_Ether)
    assert.equal(totalStakesAfter, '102000000000000000000')
  })

  it("adjustLoan():  updates borrower's stake and totalStakes with a coll decrease", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

    await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._1_Ether })

    const stakeBefore = ((await cdpManager.CDPs(alice))[2]).toString()
    const totalStakesBefore = await cdpManager.totalStakes();

    assert.equal(stakeBefore, moneyVals._1_Ether)
    assert.equal(totalStakesBefore, '101000000000000000000')

    // Alice adjusts loan - coll decrease and debt decrease
    await borrowerOperations.adjustLoan(moneyVals._0pt5_Ether, moneyVals.negative_50e18, alice, { from: alice })

    const stakeAfter = ((await cdpManager.CDPs(alice))[2]).toString()
    const totalStakesAfter = await cdpManager.totalStakes();

    assert.equal(stakeAfter, '500000000000000000')
    assert.equal(totalStakesAfter, '100500000000000000000')
  })

  it("adjustLoan(): changes CLVToken balance by the requested decrease", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

    await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._1_Ether })

    const alice_CLVTokenBalance_Before = (await clvToken.balanceOf(alice)).toString()
    assert.equal(alice_CLVTokenBalance_Before, moneyVals._100e18)

    // Alice adjusts loan - coll decrease and debt decrease
    await borrowerOperations.adjustLoan(moneyVals._1e17, moneyVals.negative_10e18, alice, { from: alice })

    // check after
    const alice_CLVTokenBalance_After = (await clvToken.balanceOf(alice)).toString()
    assert.equal(alice_CLVTokenBalance_After, moneyVals._90e18)
  })

  it("adjustLoan(): changes CLVToken balance by the requested increase", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

    await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._1_Ether })

    const alice_CLVTokenBalance_Before = (await clvToken.balanceOf(alice)).toString()
    assert.equal(alice_CLVTokenBalance_Before, moneyVals._100e18)

    // Alice adjusts loan - coll increase and debt increase
    await borrowerOperations.adjustLoan(0, moneyVals._100e18, alice, { from: alice, value: moneyVals._1_Ether })

    // check after
    const alice_CLVTokenBalance_After = (await clvToken.balanceOf(alice)).toString()
    assert.equal(alice_CLVTokenBalance_After, moneyVals._200e18)
  })

  it("adjustLoan(): Changes the activePool ETH and raw ether balance by the requested decrease", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

    await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._1_Ether })

    const activePool_ETH_Before = (await activePool.getETH()).toString()
    const activePool_RawEther_Before = (await web3.eth.getBalance(activePool.address)).toString()
    assert.equal(activePool_ETH_Before, '101000000000000000000')
    assert.equal(activePool_RawEther_Before, '101000000000000000000')

    // Alice adjusts loan - coll decrease and debt decrease
    await borrowerOperations.adjustLoan(moneyVals._1e17, moneyVals.negative_10e18, alice, { from: alice })

    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, '100900000000000000000')
    assert.equal(activePool_RawEther_After, '100900000000000000000')
  })

  it("adjustLoan(): Changes the activePool ETH and raw ether balance by the amount of ETH sent", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

    await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: moneyVals._1_Ether })

    const activePool_ETH_Before = (await activePool.getETH()).toString()
    const activePool_RawEther_Before = (await web3.eth.getBalance(activePool.address)).toString()
    assert.equal(activePool_ETH_Before, '101000000000000000000')
    assert.equal(activePool_RawEther_Before, '101000000000000000000')

    // Alice adjusts loan - coll increase and debt increase
    await borrowerOperations.adjustLoan(0, moneyVals._100e18, alice, { from: alice, value: moneyVals._1_Ether })

    const activePool_ETH_After = (await activePool.getETH()).toString()
    const activePool_RawEther_After = (await web3.eth.getBalance(activePool.address)).toString()
    assert.equal(activePool_ETH_After, '102000000000000000000')
    assert.equal(activePool_RawEther_After, '102000000000000000000')
  })

  it("adjustLoan(): Changes the CLV debt in ActivePool by requested decrease", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })
    
    await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: _1_Ether })

    const activePool_CLVDebt_Before = (await activePool.getCLV()).toString()
    assert.equal(activePool_CLVDebt_Before, moneyVals._100e18)

    // Alice adjusts loan - coll increase and debt increase
    await borrowerOperations.adjustLoan(0, moneyVals.negative_50e18, alice, { from: alice, value: moneyVals._1_Ether })

    const activePool_CLVDebt_After = (await activePool.getCLV()).toString()
    assert.equal(activePool_CLVDebt_After, moneyVals._50e18)
  })

  it("adjustLoan():Changes the CLV debt in ActivePool by requested increase", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

    await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: _1_Ether })

    const activePool_CLVDebt_Before = (await activePool.getCLV()).toString()
    assert.equal(activePool_CLVDebt_Before, moneyVals._100e18)

    // Alice adjusts loan - coll increase and debt increase
    await borrowerOperations.adjustLoan(0, moneyVals._100e18, alice, { from: alice, value: moneyVals._1_Ether })

    const activePool_CLVDebt_After = (await activePool.getCLV()).toString()
    assert.equal(activePool_CLVDebt_After, moneyVals._200e18)
  })

  it("adjustLoan(): Closes the CDP if  new coll = 0 and new debt = 0", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })
    await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: _1_Ether })

    const status_Before = (await cdpManager.CDPs(alice))[3]
    const isInSortedList_Before = await sortedCDPs.contains(alice)
 
    assert.equal(status_Before, 1)  // 1: Active
    assert.isTrue(isInSortedList_Before)

    await borrowerOperations.adjustLoan(moneyVals._1_Ether, moneyVals.negative_100e18, alice, { from: alice })

    const status_After = (await cdpManager.CDPs(alice))[3]
    const isInSortedList_After = await sortedCDPs.contains(alice)

    assert.equal(status_After, 2) //2: Closed
    assert.isFalse(isInSortedList_After)
  })


  it("adjustLoan():  Deposits the received ether in the trove and ignores requested coll withdrawal if ether is sent", async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })
    await borrowerOperations.openLoan(moneyVals._100e18, alice, { from: alice, value: _1_Ether })

    const aliceColl_Before = (await cdpManager.CDPs(alice))[1].toString()
    assert.equal(aliceColl_Before, moneyVals._1_Ether)

    await borrowerOperations.adjustLoan(moneyVals._1_Ether, moneyVals._100e18, alice, { from: alice, value: moneyVals._3_Ether })

    const aliceColl_After = (await cdpManager.CDPs(alice))[1].toString()
    assert.equal(aliceColl_After, moneyVals._4_Ether)
  })

  // --- closeLoan() ---

  it("closeLoan(): reduces a CDP's collateral to zero", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _10_Ether })
    // await borrowerOperations.withdrawCLV(_100e18, dennis, { from: dennis })

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(_100e18, alice, { from: alice })

    const collBefore = ((await cdpManager.CDPs(alice))[1]).toString()
    assert.equal(collBefore, _1_Ether)

    // Alice attempts to close loan
    await borrowerOperations.closeLoan({ from: alice })

    const collAfter = ((await cdpManager.CDPs(alice))[1]).toString()
    assert.equal(collAfter, '0')
    // check withdrawal was successful
  })

  it("closeLoan(): reduces a CDP's debt to zero", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _10_Ether })

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(_100e18, alice, { from: alice })

    const debtBefore = ((await cdpManager.CDPs(alice))[0]).toString()
    assert.equal(debtBefore, _100e18)

    // Alice attempts to close loan
    await borrowerOperations.closeLoan({ from: alice })

    const debtAfter = ((await cdpManager.CDPs(alice))[0]).toString()
    assert.equal(debtAfter, '0')
    // check withdrawal was successful
  })

  it("closeLoan(): sets CDP's stake to zero", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _10_Ether })

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(_100e18, alice, { from: alice })

    const stakeBefore = ((await cdpManager.CDPs(alice))[2]).toString()
    assert.equal(stakeBefore, _1_Ether)

    // Alice attempts to close loan
    await borrowerOperations.closeLoan({ from: alice })

    const stakeAfter = ((await cdpManager.CDPs(alice))[2]).toString()
    assert.equal(stakeAfter, '0')
    // check withdrawal was successful
  })

  it("closeLoan(): closes the CDP", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _10_Ether })

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(_100e18, alice, { from: alice })

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
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _10_Ether })

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(_100e18, alice, { from: alice })

    // Check before
    const activePool_ETH_before = await activePool.getETH()
    const activePool_RawEther_before = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_before, _11_Ether)
    assert.equal(activePool_RawEther_before, _11_Ether)

    // Close the loan
    await borrowerOperations.closeLoan({ from: alice })

    // Check after
    const activePool_ETH_After = await activePool.getETH()
    const activePool_RawEther_After = await web3.eth.getBalance(activePool.address)
    assert.equal(activePool_ETH_After, _10_Ether)
    assert.equal(activePool_RawEther_After, _10_Ether)
  })

  it("closeLoan(): reduces ActivePool debt by correct amount", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _10_Ether })

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(_100e18, alice, { from: alice })

    // Check before
    const activePool_Debt_before = (await activePool.getETH()).toString()
    assert.equal(activePool_Debt_before, _11_Ether)

    // Close the loan
    await borrowerOperations.closeLoan({ from: alice })

    // Check after
    const activePool_Debt_After = (await activePool.getCLV()).toString()
    assert.equal(activePool_Debt_After, 0)
  })

  it("closeLoan(): updates the the total stakes", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _10_Ether })
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
    assert.equal(totalStakes_After, _11_Ether)
  })

  it("closeLoan(): sends the correct amount of ETH to the user", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _10_Ether })
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    const alice_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))
    await borrowerOperations.closeLoan({ from: alice, gasPrice: 0 })

    const alice_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(alice))
    const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

    assert.equal(balanceDiff, _1_Ether)
  })

  it("closeLoan(): subtracts the debt of the closed CDP from the Borrower's CLVToken balance", async () => {
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _10_Ether })

    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.withdrawCLV(_100e18, alice, { from: alice })

    const alice_CLVBalance_Before = await clvToken.balanceOf(alice)
    assert.equal(alice_CLVBalance_Before, _100e18)

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

    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: _100_Ether })
    await borrowerOperations.withdrawCLV(_200e18, dennis, { from: dennis })
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
    assert.isAtMost(th.getDifference(defaultPool_CLVDebt, _180e18), 100)

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
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _10_Ether })
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
    await borrowerOperations.addColl(whale, whale, { from: whale, value: moneyVals._100_Ether })

    const activePool_CLVDebt_Before = await activePool.getCLV()
    assert.equal(activePool_CLVDebt_Before, 0)

    await borrowerOperations.openLoan(moneyVals._50e18, alice, { from: alice, value: _1_Ether })

    const activePool_CLVDebt_After = await activePool.getCLV()
    assert.equal(activePool_CLVDebt_After, moneyVals._50e18)
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

  it('liquidate(): closes a CDP that has ICR < MCR', async () => {
    await borrowerOperations.addColl(whale, whale, { from: whale, value: _50_Ether })
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _1_Ether })

    const price = await priceFeed.getPrice()
    const ICR_Before = web3.utils.toHex(await cdpManager.getCurrentICR(alice, price))
    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    assert.equal(ICR_Before, maxBytes32)

    const MCR = (await cdpManager.MCR()).toString()
    assert.equal(MCR.toString(), '1100000000000000000')

    // Alice withdraws 180 CLV, lowering her ICR to 1.11
    await borrowerOperations.withdrawCLV('180000000000000000000', alice, { from: alice })
    const ICR_AfterWithdrawal = await cdpManager.getCurrentICR(alice, price)
    assert.isAtMost(th.getDifference(ICR_AfterWithdrawal, '1111111111111111111'), 100)

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
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _1_Ether })
    // Alice withdraws 100CLV, Bob withdraws 180CLV
    await borrowerOperations.withdrawCLV('100000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('180000000000000000000', bob, { from: bob })

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
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _1_Ether })

    await borrowerOperations.withdrawCLV('1000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('180000000000000000000', bob, { from: bob })

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
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _1_Ether })

    await borrowerOperations.withdrawCLV('1000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('180000000000000000000', bob, { from: bob })

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
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _1_Ether })

    await borrowerOperations.withdrawCLV('1000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('180000000000000000000', bob, { from: bob })

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
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _10_Ether })
    await borrowerOperations.addColl(carol, carol, { from: carol, value: _1_Ether })

    // Carol withdraws 180CLV, lowering her ICR to 1.11
    await borrowerOperations.withdrawCLV('180000000000000000000', carol, { from: carol })

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

    assert.isAtMost(th.getDifference(L_ETH_AfterCarolLiquidated, '50000000000000000'), 100)
    assert.isAtMost(th.getDifference(L_CLVDebt_AfterCarolLiquidated, '9000000000000000000'), 100)

    // Bob now withdraws 800 CLV, bringing his ICR to 1.11
    await borrowerOperations.withdrawCLV('800000000000000000000', bob, { from: bob })

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
    assert.isAtMost(th.getDifference(L_ETH_AfterBobLiquidated, '1100000000000000000'), 100)
    assert.isAtMost(th.getDifference(L_CLVDebt_AfterBobLiquidated, '98000000000000000000'), 100)
  })

  it('liquidateCDPs(): closes every CDP with ICR < MCR', async () => {
    // --- SETUP ---

    // create 3 CDPs
    await borrowerOperations.addColl(alice, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: _1_Ether })
    await borrowerOperations.addColl(carol, carol, { from: carol, value: _1_Ether })

    // alice withdraws only 1 CLV. Bob and Carol each withdraw 180 CLV, lowering their ICR to 1.11
    await borrowerOperations.withdrawCLV('1000000000000000000', alice, { from: alice })
    await borrowerOperations.withdrawCLV('180000000000000000000', bob, { from: bob })
    await borrowerOperations.withdrawCLV('180000000000000000000', carol, { from: carol })

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

  it('getRedemptionHints(): gets the address of the first CDP and the final ICR of the last CDP involved in a redemption', async () => {
    // --- SETUP ---
    await borrowerOperations.openLoan('10' + _18_zeros, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.openLoan('20' + _18_zeros, bob, { from: bob, value: _1_Ether })
    await borrowerOperations.openLoan('30' + _18_zeros, carol, { from: carol, value: _1_Ether })
    // Dennis' CDP should be untouched by redemption, because its ICR will be < 110% after the price drop
    await borrowerOperations.openLoan('180' + _18_zeros, dennis, { from: dennis, value: _1_Ether })

    // Drop the price
    const price = '100' + _18_zeros
    await priceFeed.setPrice(price);

    // --- TEST ---
    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await cdpManager.getRedemptionHints('55' + _18_zeros, price)

    assert.equal(firstRedemptionHint, carol)
    assert.equal(partialRedemptionHintICR, '19' + _18_zeros)
  });

  it('redeemCollateral(): cancels the provided CLV with debt from CDPs with the lowest ICRs and sends an equivalent amount of Ether', async () => {
    // --- SETUP ---

    await borrowerOperations.openLoan('5' + _18_zeros, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.openLoan('8' + _18_zeros, bob, { from: bob, value: _1_Ether })
    await borrowerOperations.openLoan('10' + _18_zeros, carol, { from: carol, value: _1_Ether })
    // start Dennis with a high ICR
    await borrowerOperations.openLoan('150' + _18_zeros, dennis, { from: dennis, value: _100_Ether })

    const dennis_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(dennis))

    const dennis_CLVBalance_Before = await clvToken.balanceOf(dennis)
    assert.equal(dennis_CLVBalance_Before, '150' + _18_zeros)

    const price = await priceFeed.getPrice()
    assert.equal(price, '200' + _18_zeros)

    // --- TEST --- 

    // Find hints for redeeming 20 CLV
    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await cdpManager.getRedemptionHints('20' + _18_zeros, price)

    // We don't need to use getApproxHint for this test, since it's not the subject of this
    // test case, and the list is very small, so the correct position is quickly found
    const { 0: partialRedemptionHint } = await sortedCDPs.findInsertPosition(
      partialRedemptionHintICR,
      price,
      dennis,
      dennis
    )

    // Dennis redeems 20 CLV
    // Don't pay for gas, as it makes it easier to calculate the received Ether
    await cdpManager.redeemCollateral(
      '20' + _18_zeros,
      firstRedemptionHint,
      partialRedemptionHint,
      partialRedemptionHintICR,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const alice_CDP_After = await cdpManager.CDPs(alice)
    const bob_CDP_After = await cdpManager.CDPs(bob)
    const carol_CDP_After = await cdpManager.CDPs(carol)

    const alice_debt_After = alice_CDP_After[0].toString()
    const bob_debt_After = bob_CDP_After[0].toString()
    const carol_debt_After = carol_CDP_After[0].toString()

    /* check that Dennis' redeemed 20 CLV has been cancelled with debt from Bobs's CDP (8) and Carol's CDP (10).
    The remaining lot (2) is sent to Alice's CDP, who had the best ICR.
    It leaves her with (3) CLV debt. */
    assert.equal(alice_debt_After, '3' + _18_zeros)
    assert.equal(bob_debt_After, '0')
    assert.equal(carol_debt_After, '0')

    const dennis_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)
    assert.equal(receivedETH, web3.utils.toWei('0.1', 'ether'))

    const dennis_CLVBalance_After = (await clvToken.balanceOf(dennis)).toString()
    assert.equal(dennis_CLVBalance_After, '130' + _18_zeros)
  })

  it('redeemCollateral(): performs a partial redemption if the hint has gotten out-of-date', async () => {
    // --- SETUP ---

    await borrowerOperations.openLoan('5' + _18_zeros, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.openLoan('8' + _18_zeros, bob, { from: bob, value: _1_Ether })
    await borrowerOperations.openLoan('10' + _18_zeros, carol, { from: carol, value: _1_Ether })
    await borrowerOperations.openLoan('150' + _18_zeros, dennis, { from: dennis, value: _100_Ether })

    const dennis_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(dennis))

    const dennis_CLVBalance_Before = await clvToken.balanceOf(dennis)
    assert.equal(dennis_CLVBalance_Before, '150' + _18_zeros)

    const price = await priceFeed.getPrice()
    assert.equal(price, '200' + _18_zeros)

    // --- TEST --- 

    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await cdpManager.getRedemptionHints('20' + _18_zeros, price)

    const { 0: partialRedemptionHint } = await sortedCDPs.findInsertPosition(
      partialRedemptionHintICR,
      price,
      dennis,
      dennis
    )

    // Oops, another transaction gets in the way
    {
      const {
        firstRedemptionHint,
        partialRedemptionHintICR
      } = await cdpManager.getRedemptionHints('1' + _18_zeros, price)

      const { 0: partialRedemptionHint } = await sortedCDPs.findInsertPosition(
        partialRedemptionHintICR,
        price,
        dennis,
        dennis
      )

      // Alice redeems 1 CLV from Carol's CDP
      await cdpManager.redeemCollateral(
        '1' + _18_zeros,
        firstRedemptionHint,
        partialRedemptionHint,
        partialRedemptionHintICR,
        { from: alice }
      )
    }

    // Dennis tries to redeem 20 CLV
    await cdpManager.redeemCollateral(
      '20' + _18_zeros,
      firstRedemptionHint,
      partialRedemptionHint,
      partialRedemptionHintICR,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    // Since Alice already redeemed 1 CLV from Carol's CDP, Dennis was only able to redeem:
    //  - 9 CLV from Carol's
    //  - 8 CLV from Bob's
    // for a total of 17 CLV.

    // Dennis calculated his hint for redeeming 2 CLV from Alice's CDP, but after Alice's transaction
    // got in the way, he would have needed to redeem 3 CLV to fully complete his redemption of 20 CLV.
    // This would have required a different hint, therefore he ended up with a partial redemption.

    const dennis_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)
    assert.equal(receivedETH, web3.utils.toWei('0.085', 'ether'))

    const dennis_CLVBalance_After = (await clvToken.balanceOf(dennis)).toString()
    assert.equal(dennis_CLVBalance_After, '133' + _18_zeros)
  })

  it("redeemCollateral(): can redeem even if there's no active debt", async () => {
    // --- SETUP ---

    await borrowerOperations.openLoan('0', alice, { from: alice, value: _10_Ether })
    await borrowerOperations.openLoan('100' + _18_zeros, bob, { from: bob, value: _1_Ether })

    await clvToken.transfer(carol, '100' + _18_zeros, { from: bob })

    const price = '100' + _18_zeros
    await priceFeed.setPrice(price)

    // Liquidate Bob's CDP
    await cdpManager.liquidateCDPs(1)

    // --- TEST --- 

    const carol_ETHBalance_Before = web3.utils.toBN(await web3.eth.getBalance(carol))

    await cdpManager.redeemCollateral(
      '100' + _18_zeros,
      alice,
      '0x0000000000000000000000000000000000000000',
      0,
      {
        from: carol,
        gasPrice: 0
      }
    )

    const carol_ETHBalance_After = web3.utils.toBN(await web3.eth.getBalance(carol))
    const receivedETH = carol_ETHBalance_After.sub(carol_ETHBalance_Before)
    assert.equal(receivedETH, '1' + _18_zeros)

    const carol_CLVBalance_After = (await clvToken.balanceOf(carol)).toString()
    assert.equal(carol_CLVBalance_After, '0')
  })

  it("redeemCollateral(): doesn't touch CDPs with ICR < 110%", async () => {
    // --- SETUP ---

    await borrowerOperations.openLoan('100' + _18_zeros, alice, { from: alice, value: _10_Ether })
    await borrowerOperations.openLoan('100' + _18_zeros, bob, { from: bob, value: _1_Ether })

    await clvToken.transfer(carol, '100' + _18_zeros, { from: bob })

    // Put Bob's CDP below 110% ICR
    const price = '100' + _18_zeros
    await priceFeed.setPrice(price)

    // --- TEST --- 

    await cdpManager.redeemCollateral(
      '100' + _18_zeros,
      bob,
      '0x0000000000000000000000000000000000000000',
      0,
      { from: carol }
    );

    // Alice's CDP was cleared of debt
    const { debt: alice_Debt_After } = await cdpManager.CDPs(alice)
    assert.equal(alice_Debt_After, '0')

    // Bob's CDP was left untouched
    const { debt: bob_Debt_After } = await cdpManager.CDPs(bob)
    assert.equal(bob_Debt_After, '100' + _18_zeros)
  });

  it("redeemCollateral(): finds the last CDP with ICR == 110% even if there is more than one", async () => {
    // --- SETUP ---

    await borrowerOperations.openLoan('100' + _18_zeros, alice, { from: alice, value: _1_Ether })
    await borrowerOperations.openLoan('100' + _18_zeros, bob, { from: bob, value: _1_Ether })
    await borrowerOperations.openLoan('100' + _18_zeros, carol, { from: carol, value: _1_Ether })
    await borrowerOperations.openLoan('101' + _18_zeros, dennis, { from: dennis, value: _1_Ether })

    await clvToken.transfer(dennis, '100' + _18_zeros, { from: alice })
    await clvToken.transfer(dennis, '100' + _18_zeros, { from: bob })
    await clvToken.transfer(dennis, '100' + _18_zeros, { from: carol })

    // This will put Dennis slightly below 110%, and everyone else exactly at 110%
    const price = '110' + _18_zeros
    await priceFeed.setPrice(price)

    const orderOfCDPs = [];
    let current = await sortedCDPs.getFirst();

    while (current !== '0x0000000000000000000000000000000000000000') {
      orderOfCDPs.push(current);
      current = await sortedCDPs.getNext(current);
    }

    assert.deepEqual(orderOfCDPs, [carol, bob, alice, dennis]);

    // --- TEST --- 

    await cdpManager.redeemCollateral(
      '300' + _18_zeros,
      carol, // try to trick redeemCollateral by passing a hint that doesn't exactly point to the
      // last CDP with ICR == 110% (which would be Alice's)
      '0x0000000000000000000000000000000000000000',
      0,
      { from: dennis }
    );

    const { debt: alice_Debt_After } = await cdpManager.CDPs(alice)
    assert.equal(alice_Debt_After, '0')

    const { debt: bob_Debt_After } = await cdpManager.CDPs(bob)
    assert.equal(bob_Debt_After, '0')

    const { debt: carol_Debt_After } = await cdpManager.CDPs(carol)
    assert.equal(carol_Debt_After, '0')

    const { debt: dennis_Debt_After } = await cdpManager.CDPs(dennis)
    assert.equal(dennis_Debt_After, '101' + _18_zeros)
  });
})

contract('Reset chain state', async accounts => { })