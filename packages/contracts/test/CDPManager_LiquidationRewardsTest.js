const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const getDifference = th.getDifference
const mv = testHelpers.MoneyValues

contract('TroveManager - Redistribution reward calculations', async accounts => {

  const [
    owner,
    alice, bob, carol, dennis, erin, freddy, greta, harry, ida,
    A, B, C, D, E,
    whale, defaulter_1, defaulter_2, defaulter_3, defaulter_4] = accounts;

  let priceFeed
  let clvToken
  let sortedCDPs
  let troveManager
  let nameRegistry
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations

  let contracts

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    const LQTYContracts = await deploymentHelper.deployLQTYContracts()

    priceFeed = contracts.priceFeed
    clvToken = contracts.clvToken
    sortedCDPs = contracts.sortedCDPs
    troveManager = contracts.troveManager
    nameRegistry = contracts.nameRegistry
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    functionCaller = contracts.functionCaller
    borrowerOperations = contracts.borrowerOperations

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
  })

  it("redistribution: A, B Open. B Liquidated. C, D Open. D Liquidated. Each trove opens with 1 ETH. Distributes correct rewards", async () => {
    // A, B open trove
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode())

    // L1: B liquidated
    const txB = await troveManager.liquidate(bob)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedCDPs.contains(bob))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // C, D open troves
    await borrowerOperations.openLoan(0, carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode())

    // L2: D Liquidated
    const txD = await troveManager.liquidate(dennis)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedCDPs.contains(dennis))

    // Get entire coll of A and C
    const alice_Coll = ((await troveManager.CDPs(alice))[1]
      .add(await troveManager.getPendingETHReward(alice)))
      .toString()
    const carol_Coll = ((await troveManager.CDPs(carol))[1]
      .add(await troveManager.getPendingETHReward(carol)))
      .toString()

    /* Expected collateral:
    A: Alice receives 0.995 ETH from L1, and 2/3*0.995 ETH from L2.
    expect aliceColl = 1 + 0.995 + 1.995/2.995 * 0.995 = 2.6577797 ETH

    C: Carol receives 1/3 ETH from L2
    expect carolColl = 1 + 1/2.995 * 0.995 = 1.33222 ETH

    Total coll = 2 + 2 * 0.995 ETH
    */
    assert.isAtMost(th.getDifference(alice_Coll, '2657779632721202212'), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, '1332220367278798001'), 1000)


    const entireSystemColl = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl, dec(399, 16))

    // check CLV gas compensation
    assert.equal((await clvToken.balanceOf(owner)).toString(), dec(20, 18))
  })

  it("redistribution: A, B, C Open. C Liquidated. D, E, F Open. F Liquidated. Each trove opens with 1 ETH. Distributes correct rewards", async () => {
    // A, B C open troves
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode())

    // L1: C liquidated
    const txC = await troveManager.liquidate(carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedCDPs.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // D, E, F open troves
    await borrowerOperations.openLoan(0, dennis, { from: dennis, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, erin, { from: erin, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), freddy, { from: freddy, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await troveManager.checkRecoveryMode())

    // L2: F Liquidated
    const txF = await troveManager.liquidate(freddy)
    assert.isTrue(txF.receipt.status)
    assert.isFalse(await sortedCDPs.contains(freddy))

    // Get entire coll of A, B, D and E
    const alice_Coll = ((await troveManager.CDPs(alice))[1]
      .add(await troveManager.getPendingETHReward(alice)))
      .toString()
    const bob_Coll = ((await troveManager.CDPs(bob))[1]
      .add(await troveManager.getPendingETHReward(bob)))
      .toString()
    const dennis_Coll = ((await troveManager.CDPs(dennis))[1]
      .add(await troveManager.getPendingETHReward(dennis)))
      .toString()
    const erin_Coll = ((await troveManager.CDPs(erin))[1]
      .add(await troveManager.getPendingETHReward(erin)))
      .toString()

    /* Expected collateral:
    A and B receives 1/2 ETH * 0.995 from L1.
    total Coll: 3

    A, B, receive (1.4975)/4.995 * 0.995 ETH from L2.
    
    D, E receive 1/4.995 * 0.995 ETH from L2.

    expect A, B coll  = 1 +  0.4975 + 0.2983  = 1.7958 ETH
    expect D, E coll  = 1 + 0.199199  = 1.199 ETH

    Total coll = 4 (non-liquidated) + 2 * 0.995 (liquidated and redistributed)
    */
    assert.isAtMost(th.getDifference(alice_Coll, '1795800800800800844'), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, '1795800800800800844'), 1000)
    assert.isAtMost(th.getDifference(dennis_Coll, '1199199199199199178'), 1000)
    assert.isAtMost(th.getDifference(erin_Coll, '1199199199199199178'), 1000)

    const entireSystemColl = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl, dec(599, 16))

    // check CLV gas compensation
    assert.equal((await clvToken.balanceOf(owner)).toString(), dec(20, 18))
  })
  ////

  it("redistribution: Sequence of alternate opening/liquidation: final surviving trove has ETH from all previously liquidated troves", async () => {
    // A, B  open troves
    await borrowerOperations.openLoan(dec(1, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(1, 18), bob, { from: bob, value: dec(1, 'ether') })

    // Price drops to 1 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L1: A liquidated
    const txA = await troveManager.liquidate(alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedCDPs.contains(alice))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // C, opens trove
    await borrowerOperations.openLoan(dec(1, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L2: B Liquidated
    const txB = await troveManager.liquidate(bob)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedCDPs.contains(bob))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // D opens trove
    await borrowerOperations.openLoan(dec(1, 18), dennis, { from: dennis, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L3: C Liquidated
    const txC = await troveManager.liquidate(carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedCDPs.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // E opens trove
    await borrowerOperations.openLoan(dec(1, 18), erin, { from: erin, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L4: D Liquidated
    const txD = await troveManager.liquidate(dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedCDPs.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // F opens trove
    await borrowerOperations.openLoan(dec(1, 18), freddy, { from: freddy, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L5: E Liquidated
    const txE = await troveManager.liquidate(erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedCDPs.contains(erin))

    // Get entire coll of A, B, D, E and F
    const alice_Coll = ((await troveManager.CDPs(alice))[1]
      .add(await troveManager.getPendingETHReward(alice)))
      .toString()
    const bob_Coll = ((await troveManager.CDPs(bob))[1]
      .add(await troveManager.getPendingETHReward(bob)))
      .toString()
    const carol_Coll = ((await troveManager.CDPs(carol))[1]
      .add(await troveManager.getPendingETHReward(carol)))
      .toString()
    const dennis_Coll = ((await troveManager.CDPs(dennis))[1]
      .add(await troveManager.getPendingETHReward(dennis)))
      .toString()
    const erin_Coll = ((await troveManager.CDPs(erin))[1]
      .add(await troveManager.getPendingETHReward(erin)))
      .toString()

    const freddy_rawColl = (await troveManager.CDPs(freddy))[1].toString()
    const freddy_ETHReward = (await troveManager.getPendingETHReward(freddy)).toString()

    /* Expected collateral:
     A-E should have been liquidated
     trove F should have acquired all ETH in the system: 1 ETH initial coll, and 0.995^5+0.995^4+0.995^3+0.995^2+0.995 from rewards = 5.925 ETH
    */
    assert.isAtMost(th.getDifference(alice_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(dennis_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(erin_Coll, '0'), 1000)

    assert.isAtMost(th.getDifference(freddy_rawColl, dec(1, 'ether')), 1000)
    assert.isAtMost(th.getDifference(freddy_ETHReward, '4925498128746874648'), 1000)

    const entireSystemColl = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.isAtMost(th.getDifference(entireSystemColl, '5925498128746874648'), 1000)

    // check CLV gas compensation
    assert.equal((await clvToken.balanceOf(owner)).toString(), dec(50, 18))
  })

  // ---Trove adds collateral --- 

  // Test based on scenario in: https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution: A,B,C, D open. Liq(A). B adds coll. Liq(C). B and D have correct coll and debt", async () => {
    // A, B, C open troves
    await borrowerOperations.openLoan(dec(100000, 18), A, { from: A, value: dec(1000, 'ether') })
    await borrowerOperations.openLoan(dec(100000, 18), B, { from: B, value: dec(1000, 'ether') })
    await borrowerOperations.openLoan(dec(100000, 18), C, { from: C, value: dec(1000, 'ether') })
    await borrowerOperations.openLoan(dec(10, 18), D, { from: D, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(100000, 18), E, { from: E, value: dec(1000, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Liquidate A
    // console.log(`ICR A: ${await troveManager.getCurrentICR(A, price)}`)
    const txA = await troveManager.liquidate(A)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedCDPs.contains(A))

    // Check entireColl for each trove:
    const B_entireColl_1 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const C_entireColl_1 = (await th.getEntireCollAndDebt(contracts, C)).entireColl
    const D_entireColl_1 = (await th.getEntireCollAndDebt(contracts, D)).entireColl
    const E_entireColl_1 = (await th.getEntireCollAndDebt(contracts, E)).entireColl

    assert.isAtMost(getDifference(B_entireColl_1, '1330564784053160000000'), 1e8)
    assert.isAtMost(getDifference(C_entireColl_1, '1330564784053160000000'), 1e8)
    assert.isAtMost(getDifference(D_entireColl_1, '13305647840531600000'), 1e8)
    assert.isAtMost(getDifference(E_entireColl_1, '1330564784053160000000'), 1e8)

    // Bob adds 1 ETH to his trove
    await borrowerOperations.addColl(B, { from: B, value: dec(1, 'ether') })

    // Liquidate C
    const txC = await troveManager.liquidate(C)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedCDPs.contains(C))

    const B_entireColl_2 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const D_entireColl_2 = (await th.getEntireCollAndDebt(contracts, D)).entireColl
    const E_entireColl_2 = (await th.getEntireCollAndDebt(contracts, E)).entireColl

    // console.log(`D_entireColl_2: ${D_entireColl_2}`)
    // console.log(`E_entireColl_2: ${E_entireColl_2}`)
    assert.isAtMost(getDifference(B_entireColl_2, '1990476101655690000000'), 1e8)
    assert.isAtMost(getDifference(D_entireColl_2,   '19889812618059900000'), 1e8)
    assert.isAtMost(getDifference(E_entireColl_2, '1988981261805990000000'), 1e8)

    // Bob adds 1 ETH to his trove
    await borrowerOperations.addColl(B, { from: B, value: dec(1, 'ether') })

    // Liquidate E
    const txE = await troveManager.liquidate(E)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedCDPs.contains(E))

    const B_entireColl_3 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const D_entireColl_3 = (await th.getEntireCollAndDebt(contracts, D)).entireColl

    const diff_entireColl_B = getDifference(B_entireColl_3, '3950942342139840000000')
    const diff_entireColl_D = getDifference(D_entireColl_3,   '39459927630859800000')

    assert.isAtMost(diff_entireColl_B, 1e8)
    assert.isAtMost(diff_entireColl_D, 1e8)
  })

  // Test based on scenario in: https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution: A,B,C,D open. Liq(A). B adds coll. Liq(C). B and D have correct coll and debt", async () => {
    // A, B, C open troves
    await borrowerOperations.openLoan(dec(100000, 18), A, { from: A, value: dec(1000, 'ether') })
    await borrowerOperations.openLoan(dec(100000, 18), B, { from: B, value: dec(1000, 'ether') })
    await borrowerOperations.openLoan(dec(100000, 18), C, { from: C, value: dec(1000, 'ether') })
    await borrowerOperations.openLoan(dec(10, 18), D, { from: D, value: dec(10, 'ether') })
    await borrowerOperations.openLoan(dec(100000, 18), E, { from: E, value: dec(1000, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Check entireColl for each trove:
    const A_entireColl_0 = (await th.getEntireCollAndDebt(contracts, A)).entireColl
    const B_entireColl_0 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const C_entireColl_0 = (await th.getEntireCollAndDebt(contracts, C)).entireColl
    const D_entireColl_0 = (await th.getEntireCollAndDebt(contracts, D)).entireColl
    const E_entireColl_0 = (await th.getEntireCollAndDebt(contracts, E)).entireColl

    // entireSystemColl, excluding A 
    const denominatorColl_1 = (await troveManager.getEntireSystemColl()).sub(A_entireColl_0)

    // Liquidate A
    // console.log(`ICR A: ${await troveManager.getCurrentICR(A, price)}`)
    const txA = await troveManager.liquidate(A)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedCDPs.contains(A))

    const A_collRedistribution = A_entireColl_0.mul(toBN(995)).div(toBN(1000)) // remove the gas comp

    // console.log(`A_collRedistribution: ${A_collRedistribution}`)
    // Check accumulated ETH gain for each trove
    const B_ETHGain_1 = await troveManager.getPendingETHReward(B)
    const C_ETHGain_1 = await troveManager.getPendingETHReward(C)
    const D_ETHGain_1 = await troveManager.getPendingETHReward(D)
    const E_ETHGain_1 = await troveManager.getPendingETHReward(E)

    // Check gains are what we'd expect from a distribution proportional to each trove's entire coll
    const B_expectedPendingETH_1 = A_collRedistribution.mul(B_entireColl_0).div(denominatorColl_1)
    const C_expectedPendingETH_1 = A_collRedistribution.mul(C_entireColl_0).div(denominatorColl_1)
    const D_expectedPendingETH_1 = A_collRedistribution.mul(D_entireColl_0).div(denominatorColl_1)
    const E_expectedPendingETH_1 = A_collRedistribution.mul(E_entireColl_0).div(denominatorColl_1)

    assert.isAtMost(getDifference(B_expectedPendingETH_1, B_ETHGain_1), 1e8)
    assert.isAtMost(getDifference(C_expectedPendingETH_1, C_ETHGain_1), 1e8)
    assert.isAtMost(getDifference(D_expectedPendingETH_1, D_ETHGain_1), 1e8)
    assert.isAtMost(getDifference(E_expectedPendingETH_1, E_ETHGain_1), 1e8)

    // // Bob adds 1 ETH to his trove
    await borrowerOperations.addColl(B, { from: B, value: dec(1, 'ether') })

    // Check entireColl for each trove
    const B_entireColl_1 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const C_entireColl_1 = (await th.getEntireCollAndDebt(contracts, C)).entireColl
    const D_entireColl_1 = (await th.getEntireCollAndDebt(contracts, D)).entireColl
    const E_entireColl_1 = (await th.getEntireCollAndDebt(contracts, E)).entireColl

    // entireSystemColl, excluding C
    const denominatorColl_2 = (await troveManager.getEntireSystemColl()).sub(C_entireColl_1)

    // Liquidate C
    const txC = await troveManager.liquidate(C)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedCDPs.contains(C))

    const C_collRedistribution = C_entireColl_1.mul(toBN(995)).div(toBN(1000)) // remove the gas comp
    // console.log(`C_collRedistribution: ${C_collRedistribution}`)

    const B_ETHGain_2 = await troveManager.getPendingETHReward(B)
    const D_ETHGain_2 = await troveManager.getPendingETHReward(D)
    const E_ETHGain_2 = await troveManager.getPendingETHReward(E)

    // Since B topped up, he has no previous pending ETH gain
    const B_expectedPendingETH_2 = C_collRedistribution.mul(B_entireColl_1).div(denominatorColl_2)

    // D & E's accumulated pending ETH gain includes their previous gain
    const D_expectedPendingETH_2 = C_collRedistribution.mul(D_entireColl_1).div(denominatorColl_2)
      .add(D_expectedPendingETH_1)

    const E_expectedPendingETH_2 = C_collRedistribution.mul(E_entireColl_1).div(denominatorColl_2)
      .add(E_expectedPendingETH_1)

    assert.isAtMost(getDifference(B_expectedPendingETH_2, B_ETHGain_2), 1e8)
    assert.isAtMost(getDifference(D_expectedPendingETH_2, D_ETHGain_2), 1e8)
    assert.isAtMost(getDifference(E_expectedPendingETH_2, E_ETHGain_2), 1e8)

    // // Bob adds 1 ETH to his trove
    await borrowerOperations.addColl(B, { from: B, value: dec(1, 'ether') })

    // Check entireColl for each trove
    const B_entireColl_2 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const D_entireColl_2 = (await th.getEntireCollAndDebt(contracts, D)).entireColl
    const E_entireColl_2 = (await th.getEntireCollAndDebt(contracts, E)).entireColl

    // entireSystemColl, excluding E
    const denominatorColl_3 = (await troveManager.getEntireSystemColl()).sub(E_entireColl_2)

    // Liquidate E
    const txE = await troveManager.liquidate(E)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedCDPs.contains(E))

    const E_collRedistribution = E_entireColl_2.mul(toBN(995)).div(toBN(1000)) // remove the gas comp
    // console.log(`E_collRedistribution: ${E_collRedistribution}`)

    const B_ETHGain_3 = await troveManager.getPendingETHReward(B)
    const D_ETHGain_3 = await troveManager.getPendingETHReward(D)

    // Since B topped up, he has no previous pending ETH gain
    const B_expectedPendingETH_3 = E_collRedistribution.mul(B_entireColl_2).div(denominatorColl_3)

    // D'S accumulated pending ETH gain includes their previous gain
    const D_expectedPendingETH_3 = E_collRedistribution.mul(D_entireColl_2).div(denominatorColl_3)
      .add(D_expectedPendingETH_2)

    assert.isAtMost(getDifference(B_expectedPendingETH_3, B_ETHGain_3), 1e8)
    assert.isAtMost(getDifference(D_expectedPendingETH_3, D_ETHGain_3), 1e8)
  })

  it("redistribution: A,B,C Open. Liq(C). B adds coll. Liq(A). B acquires all coll and debt", async () => {
    // A, B, C open troves
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txC = await troveManager.liquidate(carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedCDPs.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob adds 1 ETH to his trove
    await borrowerOperations.addColl(bob, { from: bob, value: dec(1, 'ether') })

    // Alice withdraws 100 CLV
    await borrowerOperations.withdrawCLV(dec(100, 18), alice, { from: alice })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Alice
    const txA = await troveManager.liquidate(alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedCDPs.contains(alice))

    // Expect Bob now holds all Ether and CLVDebt in the system: 2 + 0.4975+0.4975*0.995+0.995 Ether and 110*3 CLV (10 each for gas compensation)
    const bob_Coll = ((await troveManager.CDPs(bob))[1]
      .add(await troveManager.getPendingETHReward(bob)))
      .toString()

    const bob_CLVDebt = ((await troveManager.CDPs(bob))[0]
      .add(await troveManager.getPendingCLVDebtReward(bob)))
      .toString()

    assert.isAtMost(th.getDifference(bob_Coll, dec(39875125, 11)), 1000)
    assert.isAtMost(th.getDifference(bob_CLVDebt, dec(330, 18)), 1000)
  })

  it("redistribution: A,B,C Open. Liq(C). B tops up coll. D Opens. Liq(D). Distributes correct rewards.", async () => {
    // A, B, C open troves
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txC = await troveManager.liquidate(carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedCDPs.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob adds 1 ETH to his trove
    await borrowerOperations.addColl(bob, { from: bob, value: dec(1, 'ether') })

    // D opens trove
    await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate D
    const txA = await troveManager.liquidate(dennis)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedCDPs.contains(dennis))

    /* Bob rewards:
     L1: 1/2*0.995 ETH, 55 CLV
     L2: (2.4975/3.995)*0.995 = 0.622 ETH , 110*(2.4975/3.995)= 68.77 CLVDebt

    coll: 3.1195 ETH
    debt: 233.77 CLVDebt

     Alice rewards:
    L1 1/2*0.995 ETH, 55 CLV
    L2 (1.4975/3.995)*0.995 = 0.3730 ETH, 110*(1.4975/3.995) = 41.23 CLVDebt

    coll: 1.8705 ETH
    debt: 106.23 CLVDebt

    totalColl: 4.99 ETH
    totalDebt 330 CLV (includes 10 each for gas compensation)
    */
    const bob_Coll = ((await troveManager.CDPs(bob))[1]
      .add(await troveManager.getPendingETHReward(bob)))
      .toString()

    const bob_CLVDebt = ((await troveManager.CDPs(bob))[0]
      .add(await troveManager.getPendingCLVDebtReward(bob)))
      .toString()

    const alice_Coll = ((await troveManager.CDPs(alice))[1]
      .add(await troveManager.getPendingETHReward(alice)))
      .toString()

    const alice_CLVDebt = ((await troveManager.CDPs(alice))[0]
      .add(await troveManager.getPendingCLVDebtReward(alice)))
      .toString()

    assert.isAtMost(th.getDifference(bob_Coll, '3119530663329161512'), 1000)
    assert.isAtMost(th.getDifference(bob_CLVDebt, '233767209011264071710'), 10000)

    assert.isAtMost(th.getDifference(alice_Coll, '1870469336670838700'), 1000)
    assert.isAtMost(th.getDifference(alice_CLVDebt, '106232790988735928295'), 10000)

    // check CLV gas compensation
    assert.equal((await clvToken.balanceOf(owner)).toString(), dec(20, 18))
  })

  it("redistribution: Trove with the majority stake tops up. A,B,C, D open. Liq(D). C tops up. E Enters, Liq(E). Distributes correct rewards", async () => {
    const _998_Ether = '998000000000000000000'
    // A, B, C open troves
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: _998_Ether })
    await borrowerOperations.openLoan(dec(1, 23), dennis, { from: dennis, value: dec(1000, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Dennis
    const txD = await troveManager.liquidate(dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedCDPs.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 ETH, bob: 1 ETH, carol: 998 ETH
    const alice_ETHReward_1 = await troveManager.getPendingETHReward(alice)
    const bob_ETHReward_1 = await troveManager.getPendingETHReward(bob)
    const carol_ETHReward_1 = await troveManager.getPendingETHReward(carol)

    //Expect 1000 + 1000*0.995 ETH in system now
    const entireSystemColl_1 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_1, dec(1995, 'ether'))

    assert.equal(alice_ETHReward_1.toString(), dec(995, 15))
    assert.equal(bob_ETHReward_1.toString(), dec(995, 15))
    assert.equal(carol_ETHReward_1.toString(), dec(99301, 16))

    //Carol adds 1 ETH to her trove, brings it to 1992.01 total coll
    await borrowerOperations.addColl(carol, { from: carol, value: dec(1, 'ether') })

    //Expect 1996 ETH in system now
    const entireSystemColl_2 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_2, '1996000000000000000000')

    // E opens with another 1996 ETH
    await borrowerOperations.openLoan(dec(2, 23), erin, { from: erin, value: '1996000000000000000000' })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txE = await troveManager.liquidate(erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedCDPs.contains(erin))

    /* Expected ETH rewards: 
     Carol = 1992.01/1996 * 1996*0.995 = 1982.05 ETH
     Alice = 1.995/1996 * 1996*0.995 = 1.985025 ETH
     Bob = 1.995/1996 * 1996*0.995 = 1.985025 ETH

    therefore, expected total collateral:

    Carol = 1991.01 + 1991.01 = 3974.06
    Alice = 1.995 + 1.985025 = 3.980025 ETH
    Bob = 1.995 + 1.985025 = 3.980025 ETH

    total = 3982.02 ETH
    */

    const alice_Coll = ((await troveManager.CDPs(alice))[1]
      .add(await troveManager.getPendingETHReward(alice)))
      .toString()

    const bob_Coll = ((await troveManager.CDPs(bob))[1]
      .add(await troveManager.getPendingETHReward(bob)))
      .toString()

    const carol_Coll = ((await troveManager.CDPs(carol))[1]
      .add(await troveManager.getPendingETHReward(carol)))
      .toString()

    assert.isAtMost(th.getDifference(alice_Coll, dec(3980025, 12)), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, dec(3980025, 12)), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, '3974059950000000000000'), 1000)

    //Expect 3982.02 ETH in system now
    const entireSystemColl_3 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_3, '3982020000000000000000')

    // check CLV gas compensation
    assert.equal((await clvToken.balanceOf(owner)).toString(), dec(20, 18))
  })

  it("redistribution: Trove with the majority stake tops up. A,B,C, D open. Liq(D). A, B, C top up. E Enters, Liq(E). Distributes correct rewards", async () => {
    const _998_Ether = '998000000000000000000'
    // A, B, C open troves
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: _998_Ether })
    await borrowerOperations.openLoan(dec(1, 23), dennis, { from: dennis, value: dec(1000, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Dennis
    const txD = await troveManager.liquidate(dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedCDPs.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 ETH, bob: 1 ETH, carol: 998 ETH (*0.995)
    const alice_ETHReward_1 = await troveManager.getPendingETHReward(alice)
    const bob_ETHReward_1 = await troveManager.getPendingETHReward(bob)
    const carol_ETHReward_1 = await troveManager.getPendingETHReward(carol)

    //Expect 1995 ETH in system now
    const entireSystemColl_1 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_1, dec(1995, 'ether'))

    assert.equal(alice_ETHReward_1.toString(), dec(995, 15))
    assert.equal(bob_ETHReward_1.toString(), dec(995, 15))
    assert.equal(carol_ETHReward_1.toString(), dec(99301, 16))

    /* Alice, Bob, Carol each adds 1 ETH to their troves, 
    bringing them to 2.995, 2.995, 1992.01 total coll each. */

    await borrowerOperations.addColl(alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.addColl(bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.addColl(carol, { from: carol, value: dec(1, 'ether') })

    //Expect 1998 ETH in system now
    const entireSystemColl_2 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_2, '1998000000000000000000')

    // E opens with another 1998 ETH
    await borrowerOperations.openLoan(dec(2, 23), erin, { from: erin, value: '1998000000000000000000' })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txE = await troveManager.liquidate(erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedCDPs.contains(erin))

    /* Expected ETH rewards: 
     Carol = 1992.01/1998 * 1998*0.995 = 1982.04995 ETH
     Alice = 2.995/1998 * 1998*0.995 = 2.980025 ETH
     Bob = 2.995/1998 * 1998*0.995 = 2.980025 ETH

    therefore, expected total collateral:

    Carol = 1992.01 + 1982.04995 = 3974.05995
    Alice = 2.995 + 2.980025 = 5.975025 ETH
    Bob = 2.995 + 2.980025 = 5.975025 ETH

    total = 3986.01 ETH
    */

    const alice_Coll = ((await troveManager.CDPs(alice))[1]
      .add(await troveManager.getPendingETHReward(alice)))
      .toString()

    const bob_Coll = ((await troveManager.CDPs(bob))[1]
      .add(await troveManager.getPendingETHReward(bob)))
      .toString()

    const carol_Coll = ((await troveManager.CDPs(carol))[1]
      .add(await troveManager.getPendingETHReward(carol)))
      .toString()

    assert.isAtMost(th.getDifference(alice_Coll, dec(5975025, 12)), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, dec(5975025, 12)), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, '3974059950000000000000'), 1000)

    //Expect 3986.01 ETH in system now
    const entireSystemColl_3 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_3, '3986010000000000000000')

    // check CLV gas compensation
    assert.equal((await clvToken.balanceOf(owner)).toString(), dec(20, 18))
  })

  // --- Trove withdraws collateral ---

  it("redistribution: A,B,C Open. Liq(C). B withdraws coll. Liq(A). B acquires all coll and debt", async () => {
    // A, B, C open troves
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txC = await troveManager.liquidate(carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedCDPs.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob withdraws 0.5 ETH from his trove
    await borrowerOperations.withdrawColl(dec(500, 'finney'), bob, { from: bob })

    // Alice withdraws 100 CLV
    await borrowerOperations.withdrawCLV(dec(100, 18), alice, { from: alice })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Alice
    const txA = await troveManager.liquidate(alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedCDPs.contains(alice))

    // Expect Bob now holds all Ether and CLVDebt in the system: 2.5 Ether and 330 CLV
    // 1 + 0.995/2 - 0.5 + 1.4975*0.995
    const bob_Coll = ((await troveManager.CDPs(bob))[1]
      .add(await troveManager.getPendingETHReward(bob)))
      .toString()

    const bob_CLVDebt = ((await troveManager.CDPs(bob))[0]
      .add(await troveManager.getPendingCLVDebtReward(bob)))
      .toString()

    assert.isAtMost(th.getDifference(bob_Coll, '2487512500000000000'), 1000)
    assert.isAtMost(th.getDifference(bob_CLVDebt, dec(330, 18)), 1000)

    // check CLV gas compensation
    assert.equal((await clvToken.balanceOf(owner)).toString(), dec(20, 18))
  })

  it("redistribution: A,B,C Open. Liq(C). B withdraws coll. D Opens. Liq(D). Distributes correct rewards.", async () => {
    // A, B, C open troves
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txC = await troveManager.liquidate(carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedCDPs.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob  withdraws 0.5 ETH from his trove
    await borrowerOperations.withdrawColl(dec(500, 'finney'), bob, { from: bob })

    // D opens trove
    await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate D
    const txA = await troveManager.liquidate(dennis)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedCDPs.contains(dennis))

    /* Bob rewards:
     L1: 0.4975 ETH, 55 CLV
     L2: (0.9975/2.495)*0.995 = 0.3978 ETH , 110*(0.9975/2.495)= 43.98 CLVDebt

    coll: (1 + 0.4975 - 0.5 + 0.3968) = 1.3953 ETH
    debt: (110 + 55 + 43.98 = 208.98 CLVDebt 

     Alice rewards:
    L1 0.4975, 55 CLV
    L2 (1.4975/2.495)*0.995 = 0.5972 ETH, 110*(1.4975/2.495) = 66.022 CLVDebt

    coll: (1 + 0.4975 + 0.5972) = 2.0947 ETH
    debt: (10 + 55 + 66.022) = 121.022 CLV Debt

    totalColl: 3.49 ETH
    totalDebt 340 CLV (Includes 10 in each trove for gas compensation)
    */
    const bob_Coll = ((await troveManager.CDPs(bob))[1]
      .add(await troveManager.getPendingETHReward(bob)))
      .toString()

    const bob_CLVDebt = ((await troveManager.CDPs(bob))[0]
      .add(await troveManager.getPendingCLVDebtReward(bob)))
      .toString()

    const alice_Coll = ((await troveManager.CDPs(alice))[1]
      .add(await troveManager.getPendingETHReward(alice)))
      .toString()

    const alice_CLVDebt = ((await troveManager.CDPs(alice))[0]
      .add(await troveManager.getPendingCLVDebtReward(alice)))
      .toString()

    assert.isAtMost(th.getDifference(bob_Coll, '1395300601202404955'), 1000)
    assert.isAtMost(th.getDifference(bob_CLVDebt, '208977955911823642050'), 10000)

    assert.isAtMost(th.getDifference(alice_Coll, '2094699398797595257'), 1000)
    assert.isAtMost(th.getDifference(alice_CLVDebt, '131022044088176343730'), 10000)

    const entireSystemColl = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl, '3490000000000000000')
    const entireSystemDebt = (await activePool.getCLVDebt()).add(await defaultPool.getCLVDebt()).toString()
    assert.equal(entireSystemDebt, '340000000000000000000')

    // check CLV gas compensation
    assert.equal((await clvToken.balanceOf(owner)).toString(), dec(20, 18))
  })

  it("redistribution: Trove with the majority stake withdraws. A,B,C,D open. Liq(D). C withdraws some coll. E Enters, Liq(E). Distributes correct rewards", async () => {
    const _998_Ether = '998000000000000000000'
    // A, B, C open troves
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: _998_Ether })
    await borrowerOperations.openLoan(dec(1, 23), dennis, { from: dennis, value: dec(1000, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Dennis
    const txD = await troveManager.liquidate(dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedCDPs.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 ETH, bob: 1 ETH, carol: 998 ETH (*0.995)
    const alice_ETHReward_1 = await troveManager.getPendingETHReward(alice)
    const bob_ETHReward_1 = await troveManager.getPendingETHReward(bob)
    const carol_ETHReward_1 = await troveManager.getPendingETHReward(carol)

    //Expect 1995 ETH in system now
    const entireSystemColl_1 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_1, dec(1995, 'ether'))

    assert.equal(alice_ETHReward_1.toString(), dec(995, 15))
    assert.equal(bob_ETHReward_1.toString(), dec(995, 15))
    assert.equal(carol_ETHReward_1.toString(), dec(99301, 16))

    //Carol wthdraws 1 ETH from her trove, brings it to 1990.01 total coll
    await borrowerOperations.withdrawColl(dec(1, 'ether'), carol, { from: carol })

    //Expect 1994 ETH in system now
    const entireSystemColl_2 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_2, '1994000000000000000000')

    // E opens with another 1994 ETH
    await borrowerOperations.openLoan(dec(2, 23), erin, { from: erin, value: '1994000000000000000000' })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txE = await troveManager.liquidate(erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedCDPs.contains(erin))

    /* Expected ETH rewards: 
     Carol = 1990.01/1994 * 1994*0.995 = 1980.05995 ETH
     Alice = 1.995/1994 * 1994*0.995 = 1.985025 ETH
     Bob = 1.995/1994 * 1994*0.995 = 1.985025 ETH

    therefore, expected total collateral:

    Carol = 1990.01 + 1980.05995 = 3970.06995
    Alice = 1.995 + 1.985025 = 3.980025 ETH
    Bob = 1.995 + 1.985025 = 3.980025 ETH

    total = 3978.03 ETH
    */

    const alice_Coll = ((await troveManager.CDPs(alice))[1]
      .add(await troveManager.getPendingETHReward(alice)))
      .toString()

    const bob_Coll = ((await troveManager.CDPs(bob))[1]
      .add(await troveManager.getPendingETHReward(bob)))
      .toString()

    const carol_Coll = ((await troveManager.CDPs(carol))[1]
      .add(await troveManager.getPendingETHReward(carol)))
      .toString()

    assert.isAtMost(th.getDifference(alice_Coll, dec(3980025, 12)), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, dec(3980025, 12)), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, '3970069950000000000000'), 1000)

    //Expect 3978.03 ETH in system now
    const entireSystemColl_3 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_3, '3978030000000000000000')

    // check CLV gas compensation
    assert.equal((await clvToken.balanceOf(owner)).toString(), dec(20, 18))
  })

  it("redistribution: Trove with the majority stake withdraws. A,B,C,D open. Liq(D). A, B, C withdraw. E Enters, Liq(E). Distributes correct rewards", async () => {
    const _998_Ether = '998000000000000000000'
    // A, B, C open troves
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, carol, { from: carol, value: _998_Ether })
    await borrowerOperations.openLoan(dec(1, 23), dennis, { from: dennis, value: dec(1000, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Dennis
    const txD = await troveManager.liquidate(dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedCDPs.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 ETH, bob: 1 ETH, carol: 998 ETH (*0.995)
    const alice_ETHReward_1 = await troveManager.getPendingETHReward(alice)
    const bob_ETHReward_1 = await troveManager.getPendingETHReward(bob)
    const carol_ETHReward_1 = await troveManager.getPendingETHReward(carol)

    //Expect 1995 ETH in system now
    const entireSystemColl_1 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_1, dec(1995, 'ether'))

    assert.equal(alice_ETHReward_1.toString(), dec(995, 15))
    assert.equal(bob_ETHReward_1.toString(), dec(995, 15))
    assert.equal(carol_ETHReward_1.toString(), dec(99301, 16))

    /* Alice, Bob, Carol each withdraw 0.5 ETH to their troves, 
    bringing them to 1.495, 1.495, 1990.51 total coll each. */
    await borrowerOperations.withdrawColl(dec(500, 'finney'), alice, { from: alice })
    await borrowerOperations.withdrawColl(dec(500, 'finney'), bob, { from: bob })
    await borrowerOperations.withdrawColl(dec(500, 'finney'), carol, { from: carol })

    const alice_Coll_1 = ((await troveManager.CDPs(alice))[1]
      .add(await troveManager.getPendingETHReward(alice)))
      .toString()

    const bob_Coll_1 = ((await troveManager.CDPs(bob))[1]
      .add(await troveManager.getPendingETHReward(bob)))
      .toString()

    const carol_Coll_1 = ((await troveManager.CDPs(carol))[1]
      .add(await troveManager.getPendingETHReward(carol)))
      .toString()

    assert.isAtMost(th.getDifference(alice_Coll_1, '1495000000000000000'), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_1, '1495000000000000000'), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_1, '1990510000000000000000'), 1000)

    //Expect 1993.5 ETH in system now
    const entireSystemColl_2 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_2, '1993500000000000000000')

    // E opens with another 1993.5 ETH
    await borrowerOperations.openLoan(dec(2, 23), erin, { from: erin, value: '1993500000000000000000' })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txE = await troveManager.liquidate(erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedCDPs.contains(erin))

    /* Expected ETH rewards: 
     Carol = 1990.51/1993.5 * 1993.5*0.995 = 1980.55745 ETH
     Alice = 1.495/1993.5 * 1993.5*0.995 = 1.487525 ETH
     Bob = 1.495/1993.5 * 1993.5*0.995 = 1.487525 ETH

    therefore, expected total collateral:

    Carol = 1990.51 + 1980.55745 = 3971.06745
    Alice = 1.495 + 1.487525 = 2.982525 ETH
    Bob = 1.495 + 1.487525 = 2.982525 ETH

    total = 3977.0325 ETH
    */

    const alice_Coll_2 = ((await troveManager.CDPs(alice))[1]
      .add(await troveManager.getPendingETHReward(alice)))
      .toString()

    const bob_Coll_2 = ((await troveManager.CDPs(bob))[1]
      .add(await troveManager.getPendingETHReward(bob)))
      .toString()

    const carol_Coll_2 = ((await troveManager.CDPs(carol))[1]
      .add(await troveManager.getPendingETHReward(carol)))
      .toString()

    assert.isAtMost(th.getDifference(alice_Coll_2, dec(2982525, 12)), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_2, dec(2982525, 12)), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_2, '3971067450000000000000'), 1000)

    //Expect 3977.0325 ETH in system now
    const entireSystemColl_3 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_3, '3977032500000000000000')

    // check CLV gas compensation
    assert.equal((await clvToken.balanceOf(owner)).toString(), dec(20, 18))
  })

  // For calculations of correct values used in test, see scenario 1:
  // https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution, all operations: A,B,C open. Liq(A). D opens. B adds, C withdraws. Liq(B). E & F open. D adds. Liq(F). All 1 ETH operations. Distributes correct rewards", async () => {
    // A, B, C open troves
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops to 1 $/E
    await priceFeed.setPrice(dec(1, 18))

    // Liquidate A
    const txA = await troveManager.liquidate(alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedCDPs.contains(alice))

    // Price rises to 1000
    await priceFeed.setPrice(dec(1000, 18))

    // D opens trove
    await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: dec(1, 'ether') })

    //Bob adds 1 ETH to his trove
    await borrowerOperations.addColl(bob, { from: bob, value: dec(1, 'ether') })

    //Carol  withdraws 1 ETH from her trove
    await borrowerOperations.withdrawColl(dec(1, 'ether'), carol, { from: carol })

    // Price drops
    await priceFeed.setPrice(dec(1, 18))

    // Liquidate B
    const txB = await troveManager.liquidate(bob)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedCDPs.contains(bob))

    // Price rises to 1000
    await priceFeed.setPrice(dec(1000, 18))

    // E and F open troves
    await borrowerOperations.openLoan(dec(100, 18), erin, { from: erin, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), freddy, { from: freddy, value: dec(1, 'ether') })

    // D tops up
    await borrowerOperations.addColl(dennis, { from: dennis, value: dec(1, 'ether') })

    // Price drops to 1
    await priceFeed.setPrice(dec(1, 18))

    // Liquidate F
    const txF = await troveManager.liquidate(freddy)
    assert.isTrue(txF.receipt.status)
    assert.isFalse(await sortedCDPs.contains(freddy))

    // Grab remaining troves' collateral
    const carol_rawColl = (await troveManager.CDPs(carol))[1].toString()
    const carol_pendingETHReward = (await troveManager.getPendingETHReward(carol)).toString()

    const dennis_rawColl = (await troveManager.CDPs(dennis))[1].toString()
    const dennis_pendingETHReward = (await troveManager.getPendingETHReward(dennis)).toString()

    const erin_rawColl = (await troveManager.CDPs(erin))[1].toString()
    const erin_pendingETHReward = (await troveManager.getPendingETHReward(erin)).toString()

    // Check raw collateral of C, D, E
    assert.isAtMost(th.getDifference(carol_rawColl, dec(4975, 14)), 1000)
    assert.isAtMost(th.getDifference(dennis_rawColl, '3659440734557000000'), 1000000)
    assert.isAtMost(th.getDifference(erin_rawColl, dec(1, 'ether')), 1000)

    // Check pending ETH rewards of C, D, E
    assert.isAtMost(th.getDifference(carol_pendingETHReward, '1045622522814000000'), 1000000)
    assert.isAtMost(th.getDifference(dennis_pendingETHReward, '608631161386593000'), 1000000)
    assert.isAtMost(th.getDifference(erin_pendingETHReward, '166318081240000000'), 1000000)

    // Check systemic collateral
    const activeColl = (await activePool.getETH()).toString()
    const defaultColl = (await defaultPool.getETH()).toString()

    assert.isAtMost(th.getDifference(activeColl, '5156940734557600000'), 1000000)
    assert.isAtMost(th.getDifference(defaultColl, '1820571765442400000'), 1000000)

    // Check system snapshots
    const totalStakesSnapshot = (await troveManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot = (await troveManager.totalCollateralSnapshot()).toString()
    assert.isAtMost(th.getDifference(totalStakesSnapshot, '1502195536109430000'), 1000000)
    assert.isAtMost(th.getDifference(totalCollateralSnapshot, '6977512500000000000'), 1000000)

    // check CLV gas compensation
    assert.equal((await clvToken.balanceOf(owner)).toString(), dec(30, 18))
  })

  // For calculations of correct values used in test, see scenario 2:
  // https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution, all operations: A,B,C open. Liq(A). D opens. B adds, C withdraws. Liq(B). E & F open. D adds. Liq(F). Varying coll. Distributes correct rewards", async () => {
    /* A, B, C open troves.
    A: 450 ETH
    B: 8901 ETH
    C: 23.902 ETH
    */
    await borrowerOperations.openLoan(dec(90, 18), alice, { from: alice, value: '450000000000000000000' })
    await borrowerOperations.openLoan(dec(90, 18), bob, { from: bob, value: '8901000000000000000000' })
    await borrowerOperations.openLoan(dec(90, 18), carol, { from: carol, value: '23902000000000000000' })

    // Price drops 
    await priceFeed.setPrice('1')

    // Liquidate A
    const txA = await troveManager.liquidate(alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedCDPs.contains(alice))

    // Check rewards for B and C
    assert.isAtMost(th.getDifference(await troveManager.getPendingETHReward(bob), '446550869690221816199'), 1000000)
    assert.isAtMost(th.getDifference(await troveManager.getPendingETHReward(carol), '1199130309778191572'), 1000000)

    // Price rises 
    await priceFeed.setPrice(dec(1, 27))

    // D opens trove: 0.035 ETH
    await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: '35000000000000000' })

    // Bob adds 11.33909 ETH to his trove
    await borrowerOperations.addColl(bob, { from: bob, value: '11339090000000000000' })

    // Carol withdraws 15 ETH from her trove
    await borrowerOperations.withdrawColl(dec(15, 'ether'), carol, { from: carol })

    // Price drops
    await priceFeed.setPrice('1')

    // Liquidate B
    const txB = await troveManager.liquidate(bob)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedCDPs.contains(bob))

    // Check rewards for C and D
    assert.isAtMost(th.getDifference(await troveManager.getPendingETHReward(carol), '9279940897343843971610'), 10000000)
    assert.isAtMost(th.getDifference(await troveManager.getPendingETHReward(dennis), '32154612547926497256'), 10000000)

    // Price rises 
    await priceFeed.setPrice(dec(1, 27))

    /* E and F open troves.
    E: 10000 ETH
    F: 0.0007 ETH
    */
    await borrowerOperations.openLoan(dec(100, 18), erin, { from: erin, value: dec(1, 22) })
    await borrowerOperations.openLoan(dec(100, 18), freddy, { from: freddy, value: '700000000000000' })

    // D tops up
    await borrowerOperations.addColl(dennis, { from: dennis, value: dec(1, 'ether') })

    // Price drops 
    await priceFeed.setPrice('1')

    // Liquidate F
    const txF = await troveManager.liquidate(freddy)
    assert.isTrue(txF.receipt.status)
    assert.isFalse(await sortedCDPs.contains(freddy))

    // Grab remaining troves' collateral
    const carol_rawColl = (await troveManager.CDPs(carol))[1].toString()
    const carol_pendingETHReward = (await troveManager.getPendingETHReward(carol)).toString()
    const carol_Stake = (await troveManager.CDPs(carol))[2].toString()

    const dennis_rawColl = (await troveManager.CDPs(dennis))[1].toString()
    const dennis_pendingETHReward = (await troveManager.getPendingETHReward(dennis)).toString()
    const dennis_Stake = (await troveManager.CDPs(dennis))[2].toString()

    const erin_rawColl = (await troveManager.CDPs(erin))[1].toString()
    const erin_pendingETHReward = (await troveManager.getPendingETHReward(erin)).toString()
    const erin_Stake = (await troveManager.CDPs(erin))[2].toString()

    // Check raw collateral of C, D, E
    assert.isAtMost(th.getDifference(carol_rawColl, '10101130309778191929'), 1000000)
    assert.isAtMost(th.getDifference(dennis_rawColl, '33189612547926493846'), 1000000)
    assert.isAtMost(th.getDifference(erin_rawColl, dec(1, 22)), 1000000)

    // Check pending ETH rewards of C, D, E
    assert.isAtMost(th.getDifference(carol_pendingETHReward, '9279941232200579179330'), 10000000)
    assert.isAtMost(th.getDifference(dennis_pendingETHReward, '1196309477113'), 1000000)
    assert.isAtMost(th.getDifference(erin_pendingETHReward, '360446954716905'), 1000000)

    // Check systemic collateral
    const activeColl = (await activePool.getETH()).toString()
    const defaultColl = (await defaultPool.getETH()).toString()

    assert.isAtMost(th.getDifference(activeColl, '10043290742857705481600'), 20000000)
    assert.isAtMost(th.getDifference(defaultColl, '9279941593843843293140'), 20000000)

    // Check system snapshots
    const totalStakesSnapshot = (await troveManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot = (await troveManager.totalCollateralSnapshot()).toString()
    assert.isAtMost(th.getDifference(totalStakesSnapshot, '20006587547157500000'), 20000000)
    // TODO: is this acceptable rounding error
    assert.isAtMost(th.getDifference(totalCollateralSnapshot, '19323232338512800000000'), 2000000000000)

    // check CLV gas compensation
    assert.equal((await clvToken.balanceOf(owner)).toString(), dec(30, 18))
  })
})
