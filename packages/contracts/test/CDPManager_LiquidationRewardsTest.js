const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec
const mv = testHelpers.MoneyValues

contract('CDPManager - Redistribution reward calculations', async accounts => {

  const [
    owner,
    alice, bob, carol, dennis, erin, freddy, greta, harry, ida,
    whale, defaulter_1, defaulter_2, defaulter_3, defaulter_4] = accounts;

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
    const contracts = await deploymentHelper.deployLiquityCore()
    const GTContracts = await deploymentHelper.deployGTContracts()

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

    await deploymentHelper.connectGTContracts(GTContracts)
    await deploymentHelper.connectCoreContracts(contracts, GTContracts.gtStaking.address)
    await deploymentHelper.connectGTContractsToCore(GTContracts, contracts)
  })

  it("redistribution: A, B Open. B Liquidated. C, D Open. D Liquidated. Each trove opens with 1 ETH. Distributes correct rewards", async () => {
    // A, B open trove
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })

    // Price drops t0 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // L1: B liquidated
    const txB = await cdpManager.liquidate(bob)
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
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // L2: D Liquidated
    const txD = await cdpManager.liquidate(dennis)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedCDPs.contains(dennis))

    // Get entire coll of A and C
    const alice_Coll = ((await cdpManager.CDPs(alice))[1]
      .add(await cdpManager.getPendingETHReward(alice)))
      .toString()
    const carol_Coll = ((await cdpManager.CDPs(carol))[1]
      .add(await cdpManager.getPendingETHReward(carol)))
      .toString()

    /* Expected collateral:
    A: Alice receives 1 ETH from L1, and 2/3 ETH from L2.
    expect aliceColl = 1 + 1 + 0.66 = 2.66 ETH

    C: Carol receives 1/3 ETH from L2
    expect carolColl = 1+ 0.33 = 1.33 ETH

    Total coll = 4 ETH
    */
    assert.isAtMost(th.getDifference(alice_Coll, '2666666666666666666'), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, '1333333333333333333'), 1000)


    const entireSystemColl = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl, dec(4, 'ether'))
  })

  it("redistribution: A, B, C Open. C Liquidated. D, E, F Open. F Liquidated. Each trove opens with 1 ETH. Distributes correct rewards", async () => {
    // A, B C open troves
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // L1: C liquidated
    const txC = await cdpManager.liquidate(carol)
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
    assert.isFalse(await cdpManager.checkRecoveryMode())

    // L2: F Liquidated
    const txF = await cdpManager.liquidate(freddy)
    assert.isTrue(txF.receipt.status)
    assert.isFalse(await sortedCDPs.contains(freddy))

    // Get entire coll of A, B, D and E
    const alice_Coll = ((await cdpManager.CDPs(alice))[1]
      .add(await cdpManager.getPendingETHReward(alice)))
      .toString()
    const bob_Coll = ((await cdpManager.CDPs(bob))[1]
      .add(await cdpManager.getPendingETHReward(bob)))
      .toString()
    const dennis_Coll = ((await cdpManager.CDPs(dennis))[1]
      .add(await cdpManager.getPendingETHReward(dennis)))
      .toString()
    const erin_Coll = ((await cdpManager.CDPs(erin))[1]
      .add(await cdpManager.getPendingETHReward(erin)))
      .toString()

    /* Expected collateral:
    A and B receives 1/2 ETH from L1.
    total Coll: 3

    A, B, receive (1.5)/5 ETH from L2.
    
    D, E receive 1/5 ETH from L2.

    expect A, B coll  = 1 +  0.5 + 0.3  = 1.8 ETH
    expect D, E coll  = 1 + 0.2  = 1.2 ETH

    Total coll = (1.8 * 2) + (1.2 *2) = 3.6 + 2.4 = 6
    */
    assert.isAtMost(th.getDifference(alice_Coll, '1800000000000000000'), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, '1800000000000000000'), 1000)
    assert.isAtMost(th.getDifference(dennis_Coll, '1200000000000000000'), 1000)
    assert.isAtMost(th.getDifference(erin_Coll, '1200000000000000000'), 1000)

    const entireSystemColl = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl, dec(6, 'ether'))
  })
  ////

  it("redistribution: Sequence of alternate opening/liquidation: final surviving trove has ETH from all previously liquidated troves", async () => {
    // A, B  open troves
    await borrowerOperations.openLoan(dec(1, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(1, 18), bob, { from: bob, value: dec(1, 'ether') })

    // Price drops to 1 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L1: A liquidated
    const txA = await cdpManager.liquidate(alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedCDPs.contains(alice))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // C, opens trove
    await borrowerOperations.openLoan(dec(1, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L2: B Liquidated
    const txB = await cdpManager.liquidate(bob)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedCDPs.contains(bob))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // D opens trove
    await borrowerOperations.openLoan(dec(1, 18), dennis, { from: dennis, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L3: C Liquidated
    const txC = await cdpManager.liquidate(carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedCDPs.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // E opens trove
    await borrowerOperations.openLoan(dec(1, 18), erin, { from: erin, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L4: D Liquidated
    const txD = await cdpManager.liquidate(dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedCDPs.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // F opens trove
    await borrowerOperations.openLoan(dec(1, 18), freddy, { from: freddy, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L5: E Liquidated
    const txE = await cdpManager.liquidate(erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedCDPs.contains(erin))

    // Get entire coll of A, B, D, E and F
    const alice_Coll = ((await cdpManager.CDPs(alice))[1]
      .add(await cdpManager.getPendingETHReward(alice)))
      .toString()
    const bob_Coll = ((await cdpManager.CDPs(bob))[1]
      .add(await cdpManager.getPendingETHReward(bob)))
      .toString()
    const carol_Coll = ((await cdpManager.CDPs(carol))[1]
      .add(await cdpManager.getPendingETHReward(carol)))
      .toString()
    const dennis_Coll = ((await cdpManager.CDPs(dennis))[1]
      .add(await cdpManager.getPendingETHReward(dennis)))
      .toString()
    const erin_Coll = ((await cdpManager.CDPs(erin))[1]
      .add(await cdpManager.getPendingETHReward(erin)))
      .toString()

    const freddy_rawColl = (await cdpManager.CDPs(freddy))[1].toString()
    const freddy_ETHReward = (await cdpManager.getPendingETHReward(freddy)).toString()

    /* Expected collateral:
     A-E should have been liquidated
     trove F should have acquired all ETH in the system: 1 ETH initial coll, and 5 ETH from rewards = 6 ETH
    */
    assert.isAtMost(th.getDifference(alice_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(dennis_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(erin_Coll, '0'), 1000)

    assert.isAtMost(th.getDifference(freddy_rawColl, dec(1, 'ether')), 1000)
    assert.isAtMost(th.getDifference(freddy_ETHReward, dec(5, 'ether')), 1000)

    const entireSystemColl = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl, dec(6, 'ether'))
  })

  // ---Trove adds collateral --- 

  it("redistribution: A,B,C Open. Liq(C). B adds coll. Liq(A). B acquires all coll and debt", async () => {
    // A, B, C open troves
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txC = await cdpManager.liquidate(carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedCDPs.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob adds 1 ETH to his trove
    await borrowerOperations.addColl(bob, bob, { from: bob, value: dec(1, 'ether') })

    // Alice withdraws 100 CLV
    await borrowerOperations.withdrawCLV(dec(100, 18), alice, { from: alice })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Alice
    const txA = await cdpManager.liquidate(alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedCDPs.contains(alice))

    // Expect Bob now holds all Ether and CLVDebt in the system: 4 Ether and 300 CLV
    const bob_Coll = ((await cdpManager.CDPs(bob))[1]
      .add(await cdpManager.getPendingETHReward(bob)))
      .toString()

    const bob_CLVDebt = ((await cdpManager.CDPs(bob))[0]
      .add(await cdpManager.getPendingCLVDebtReward(bob)))
      .toString()

    assert.isAtMost(th.getDifference(bob_Coll, dec(4, 'ether')), 1000)
    assert.isAtMost(th.getDifference(bob_CLVDebt, dec(300, 18)), 1000)
  })

  it("redistribution: A,B,C Open. Liq(C). B tops up coll. D Opens. Liq(D). Distributes correct rewards.", async () => {
    // A, B, C open troves
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txC = await cdpManager.liquidate(carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedCDPs.contains(carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob adds 1 ETH to his trove
    await borrowerOperations.addColl(bob, bob, { from: bob, value: dec(1, 'ether') })

    // D opens trove
    await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate D
    const txA = await cdpManager.liquidate(dennis)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedCDPs.contains(dennis))

    /* Bob rewards:
     L1: 1/2 ETH, 50 CLV
     L2: (2.5/4) = 0.625 ETH , 100*(2.5/4)= 62.5 CLVDebt

    coll: 3.125 ETH
    debt: 212.5 CLVDebt

     Alice rewards:
    L1 1/2 ETH, 50 CLV
    L2 (1.5/4) = 0.375 ETH, 100*(1.5/4) = 37.5 CLVDebt

    coll: 0.875 ETH
    debt: 87.5 CLVDebt

    totalColl: 5 ETH
    totalDebt 300 CLV
    */
    const bob_Coll = ((await cdpManager.CDPs(bob))[1]
      .add(await cdpManager.getPendingETHReward(bob)))
      .toString()

    const bob_CLVDebt = ((await cdpManager.CDPs(bob))[0]
      .add(await cdpManager.getPendingCLVDebtReward(bob)))
      .toString()

    const alice_Coll = ((await cdpManager.CDPs(alice))[1]
      .add(await cdpManager.getPendingETHReward(alice)))
      .toString()

    const alice_CLVDebt = ((await cdpManager.CDPs(alice))[0]
      .add(await cdpManager.getPendingCLVDebtReward(alice)))
      .toString()

    assert.isAtMost(th.getDifference(bob_Coll, '3125000000000000000'), 1000)
    assert.isAtMost(th.getDifference(bob_CLVDebt, '212500000000000000000'), 1000)

    assert.isAtMost(th.getDifference(alice_Coll, '1875000000000000000'), 1000)
    assert.isAtMost(th.getDifference(alice_CLVDebt, '87500000000000000000'), 1000)
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
    const txD = await cdpManager.liquidate(dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedCDPs.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 ETH, bob: 1 ETH, carol: 998 ETH
    alice_ETHReward_1 = await cdpManager.getPendingETHReward(alice)
    bob_ETHReward_1 = await cdpManager.getPendingETHReward(bob)
    carol_ETHReward_1 = await cdpManager.getPendingETHReward(carol)

    //Expect 2000 ETH in system now
    const entireSystemColl_1 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_1, dec(2000, 'ether'))

    assert.equal(alice_ETHReward_1.toString(), dec(1, 'ether'))
    assert.equal(bob_ETHReward_1.toString(), dec(1, 'ether'))
    assert.equal(carol_ETHReward_1.toString(), _998_Ether)

    //Carol adds 1 ETH to her trove, brings it to 1997 total coll
    await borrowerOperations.addColl(carol, carol, { from: carol, value: dec(1, 'ether') })

    //Expect 2001 ETH in system now
    const entireSystemColl_2 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_2, '2001000000000000000000')

    // E opens with another 2001 ETH
    await borrowerOperations.openLoan(dec(2, 23), erin, { from: erin, value: '2001000000000000000000' })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txE = await cdpManager.liquidate(erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedCDPs.contains(erin))

    /* Expected ETH rewards: 
     Carol (1997/2001) * 2001 = 1997 ETH
     Alice = 2/2001 * 2001 = 2 ETH
     Bob = 2/2001 * 2001 = 2 ETH

    therefore, expected total collateral:

    Carol = 1997 + 1997 = 3994
    Alice = 2 + 2 = 4 ETH
    Bob = 2 + 2 = 4 ETH

    total = 4002 ETH
    */

    const alice_Coll = ((await cdpManager.CDPs(alice))[1]
      .add(await cdpManager.getPendingETHReward(alice)))
      .toString()

    const bob_Coll = ((await cdpManager.CDPs(bob))[1]
      .add(await cdpManager.getPendingETHReward(bob)))
      .toString()

    const carol_Coll = ((await cdpManager.CDPs(carol))[1]
      .add(await cdpManager.getPendingETHReward(carol)))
      .toString()

    assert.isAtMost(th.getDifference(alice_Coll, dec(4, 'ether')), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, dec(4, 'ether')), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, '3994000000000000000000'), 1000)

    //Expect 4002 ETH in system now
    const entireSystemColl_3 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_3, '4002000000000000000000')

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
    const txD = await cdpManager.liquidate(dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedCDPs.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 ETH, bob: 1 ETH, carol: 998 ETH
    alice_ETHReward_1 = await cdpManager.getPendingETHReward(alice)
    bob_ETHReward_1 = await cdpManager.getPendingETHReward(bob)
    carol_ETHReward_1 = await cdpManager.getPendingETHReward(carol)

    //Expect 2000 ETH in system now
    const entireSystemColl_1 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_1, dec(2000, 'ether'))

    assert.equal(alice_ETHReward_1.toString(), dec(1, 'ether'))
    assert.equal(bob_ETHReward_1.toString(), dec(1, 'ether'))
    assert.equal(carol_ETHReward_1.toString(), _998_Ether)

    /* Alice, Bob, Carol each adds 1 ETH to their troves, 
    bringing them to 3,3, 1997 total coll each. */

    await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.addColl(bob, bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.addColl(carol, carol, { from: carol, value: dec(1, 'ether') })

    //Expect 2003 ETH in system now
    const entireSystemColl_2 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_2, '2003000000000000000000')

    // E opens with another 2003 ETH
    await borrowerOperations.openLoan(dec(2, 23), erin, { from: erin, value: '2003000000000000000000' })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txE = await cdpManager.liquidate(erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedCDPs.contains(erin))

    /* Expected ETH rewards: 
     Carol (1997/2003) * 2003 = 1997 ETH
     Alice = 3/2003 * 2003 = 3 ETH
     Bob = 3/2003 * 2003 = 3 ETH

    therefore, expected total collateral:

    Carol = 1997 + 1997 = 3994
    Alice = 3+ 3 = 6 ETH
    Bob = 3 + 3 = 6 ETH

    total = 4006 ETH
    */

    const alice_Coll = ((await cdpManager.CDPs(alice))[1]
      .add(await cdpManager.getPendingETHReward(alice)))
      .toString()

    const bob_Coll = ((await cdpManager.CDPs(bob))[1]
      .add(await cdpManager.getPendingETHReward(bob)))
      .toString()

    const carol_Coll = ((await cdpManager.CDPs(carol))[1]
      .add(await cdpManager.getPendingETHReward(carol)))
      .toString()

    assert.isAtMost(th.getDifference(alice_Coll, dec(6, 'ether')), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, dec(6, 'ether')), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, '3994000000000000000000'), 1000)

    //Expect 4004 ETH in system now
    const entireSystemColl_3 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_3, '4006000000000000000000')
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
    const txC = await cdpManager.liquidate(carol)
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
    const txA = await cdpManager.liquidate(alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedCDPs.contains(alice))

    // Expect Bob now holds all Ether and CLVDebt in the system: 2.5 Ether and 300 CLV
    const bob_Coll = ((await cdpManager.CDPs(bob))[1]
      .add(await cdpManager.getPendingETHReward(bob)))
      .toString()

    const bob_CLVDebt = ((await cdpManager.CDPs(bob))[0]
      .add(await cdpManager.getPendingCLVDebtReward(bob)))
      .toString()

    assert.isAtMost(th.getDifference(bob_Coll, '2500000000000000000'), 1000)
    assert.isAtMost(th.getDifference(bob_CLVDebt, dec(300, 18)), 1000)
  })

  it("redistribution: A,B,C Open. Liq(C). B withdraws coll. D Opens. Liq(D). Distributes correct rewards.", async () => {
    // A, B, C open troves
    await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txC = await cdpManager.liquidate(carol)
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
    const txA = await cdpManager.liquidate(dennis)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedCDPs.contains(dennis))

    /* Bob rewards:
     L1: 0.5 ETH, 50 CLV
     L2: (1/2.5) = 0.4 ETH , 100*(1/2.5)= 40 CLVDebt

    coll: (1 + 0.5 - 0.5 0.4) = 1.4 ETH
    debt: (100 + 50 + 40 = 190 CLVDebt 

     Alice rewards:
    L1 0.5 ETH, 50 CLV
    L2 (1.5/2.5) = 0.6 ETH, 100*(1.5/.25) = 60 CLVDebt

    coll: (1 + 0.5 + 0.6) = 2.1 ETH
    debt: (50 + 60) = 110 CLV Debt

    totalColl: 3.5 ETH
    totalDebt 300 CLV
    */
    const bob_Coll = ((await cdpManager.CDPs(bob))[1]
      .add(await cdpManager.getPendingETHReward(bob)))
      .toString()

    const bob_CLVDebt = ((await cdpManager.CDPs(bob))[0]
      .add(await cdpManager.getPendingCLVDebtReward(bob)))
      .toString()

    const alice_Coll = ((await cdpManager.CDPs(alice))[1]
      .add(await cdpManager.getPendingETHReward(alice)))
      .toString()

    const alice_CLVDebt = ((await cdpManager.CDPs(alice))[0]
      .add(await cdpManager.getPendingCLVDebtReward(alice)))
      .toString()

    assert.isAtMost(th.getDifference(bob_Coll, '1400000000000000000'), 1000)
    assert.isAtMost(th.getDifference(bob_CLVDebt, '190000000000000000000'), 1000)

    assert.isAtMost(th.getDifference(alice_Coll, '2100000000000000000'), 1000)
    assert.isAtMost(th.getDifference(alice_CLVDebt, '110000000000000000000'), 1000)
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
    const txD = await cdpManager.liquidate(dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedCDPs.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 ETH, bob: 1 ETH, carol: 998 ETH
    alice_ETHReward_1 = await cdpManager.getPendingETHReward(alice)
    bob_ETHReward_1 = await cdpManager.getPendingETHReward(bob)
    carol_ETHReward_1 = await cdpManager.getPendingETHReward(carol)

    //Expect 2000 ETH in system now
    const entireSystemColl_1 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_1, dec(2000, 'ether'))

    assert.equal(alice_ETHReward_1.toString(), dec(1, 'ether'))
    assert.equal(bob_ETHReward_1.toString(), dec(1, 'ether'))
    assert.equal(carol_ETHReward_1.toString(), _998_Ether)

    //Carol wthdraws 1 ETH from her trove, brings it to 1995 total coll
    await borrowerOperations.withdrawColl(dec(1, 'ether'), carol, { from: carol })

    //Expect 1999 ETH in system now
    const entireSystemColl_2 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_2, '1999000000000000000000')

    // E opens with another 1999 ETH
    await borrowerOperations.openLoan(dec(2, 23), erin, { from: erin, value: '1999000000000000000000' })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txE = await cdpManager.liquidate(erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedCDPs.contains(erin))

    /* Expected ETH rewards: 
     Carol (1995/1999) * 1999 = 1995 ETH
     Alice = 2/1999 * 1999 = 2 ETH
     Bob = 2/1999 * 1999 = 2 ETH

    therefore, expected total collateral:

    Carol = 1995 + 1995 = 3990
    Alice = 2 + 2 = 4 ETH
    Bob = 2 + 2 = 4 ETH

    total = 3998 ETH
    */

    const alice_Coll = ((await cdpManager.CDPs(alice))[1]
      .add(await cdpManager.getPendingETHReward(alice)))
      .toString()

    const bob_Coll = ((await cdpManager.CDPs(bob))[1]
      .add(await cdpManager.getPendingETHReward(bob)))
      .toString()

    const carol_Coll = ((await cdpManager.CDPs(carol))[1]
      .add(await cdpManager.getPendingETHReward(carol)))
      .toString()

    assert.isAtMost(th.getDifference(alice_Coll, dec(4, 'ether')), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, dec(4, 'ether')), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, '3990000000000000000000'), 1000)

    //Expect 4002 ETH in system now
    const entireSystemColl_3 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_3, '3998000000000000000000')
  })

 // For calculations of correct values used in test, see scenario 1:
 // https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
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
    const txD = await cdpManager.liquidate(dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedCDPs.contains(dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 ETH, bob: 1 ETH, carol: 998 ETH
    alice_ETHReward_1 = await cdpManager.getPendingETHReward(alice)
    bob_ETHReward_1 = await cdpManager.getPendingETHReward(bob)
    carol_ETHReward_1 = await cdpManager.getPendingETHReward(carol)

    //Expect 2000 ETH in system now
    const entireSystemColl_1 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_1, dec(2000, 'ether'))

    assert.equal(alice_ETHReward_1.toString(), dec(1, 'ether'))
    assert.equal(bob_ETHReward_1.toString(), dec(1, 'ether'))
    assert.equal(carol_ETHReward_1.toString(), _998_Ether)

    /* Alice, Bob, Carol each withdraw 0.5 ETH to their troves, 
    bringing them to 1.5, 1.5, 1995.5 total coll each. */
    await borrowerOperations.withdrawColl(dec(500, 'finney'), alice, { from: alice })
    await borrowerOperations.withdrawColl(dec(500, 'finney'), bob, { from: bob })
    await borrowerOperations.withdrawColl(dec(500, 'finney'), carol, { from: carol })

    const alice_Coll_1 = ((await cdpManager.CDPs(alice))[1]
      .add(await cdpManager.getPendingETHReward(alice)))
      .toString()

    const bob_Coll_1 = ((await cdpManager.CDPs(bob))[1]
      .add(await cdpManager.getPendingETHReward(bob)))
      .toString()

    const carol_Coll_1 = ((await cdpManager.CDPs(carol))[1]
      .add(await cdpManager.getPendingETHReward(carol)))
      .toString()

    assert.isAtMost(th.getDifference(alice_Coll_1, '1500000000000000000'), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_1, '1500000000000000000'), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_1, '1995500000000000000000'), 1000)

    //Expect 1998.5 ETH in system now
    const entireSystemColl_2 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_2, '1998500000000000000000')

    // E opens with another 1998.5 ETH
    await borrowerOperations.openLoan(dec(2, 23), erin, { from: erin, value: '1998500000000000000000' })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txE = await cdpManager.liquidate(erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedCDPs.contains(erin))

    /* Expected ETH rewards: 
     Carol (1995.5/1998.5) * 1998.5 = 1995.5 ETH
     Alice = 1.5/1998.5 * 1998.5 = 1.5 ETH
     Bob = 1.5/1998.5 * 1998.5 = 1.5 ETH

    therefore, expected total collateral:

    Carol = 1995.5 + 1995.5 = 3997
    Alice = 1.5+ 1.5= 3 ETH
    Bob = 1.5 + 1.5 = 3 ETH

    total = 4003 ETH
    */

    const alice_Coll_2 = ((await cdpManager.CDPs(alice))[1]
      .add(await cdpManager.getPendingETHReward(alice)))
      .toString()

    const bob_Coll_2 = ((await cdpManager.CDPs(bob))[1]
      .add(await cdpManager.getPendingETHReward(bob)))
      .toString()

    const carol_Coll_2 = ((await cdpManager.CDPs(carol))[1]
      .add(await cdpManager.getPendingETHReward(carol)))
      .toString()

    assert.isAtMost(th.getDifference(alice_Coll_2, dec(3, 'ether')), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_2, dec(3, 'ether')), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_2, '3991000000000000000000'), 1000)

    //Expect 3997 ETH in system now
    const entireSystemColl_3 = (await activePool.getETH()).add(await defaultPool.getETH()).toString()
    assert.equal(entireSystemColl_3, '3997000000000000000000')
  })

    // For calculations of correct values used in test, see scenario 2:
 // https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution, all operations: A,B,C open. Liq(A). D opens. B adds, C withdraws. Liq(B). E & F open. D adds. Liq(F). All 1 ETH operations. Distributes correct rewards", async () => {
    // A, B, C open troves
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(1, 'ether') })

    // Price drops to 1 $/E
    await priceFeed.setPrice(dec(1, 18))

    // Liquidate A
    const txA = await cdpManager.liquidate(alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedCDPs.contains(alice))

    // Price rises to 1000
    await priceFeed.setPrice(dec(1000, 18))

    // D opens trove
    await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: dec(1, 'ether') })

    //Bob adds 1 ETH to his trove
    await borrowerOperations.addColl(bob, bob, { from: bob, value: dec(1, 'ether') })

    //Carol  withdraws 1 ETH from her trove
    await borrowerOperations.withdrawColl(dec(1, 'ether'), carol, { from: carol })

    // Price drops
    await priceFeed.setPrice(dec(1, 18))

    // Liquidate B
    const txB = await cdpManager.liquidate(bob)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedCDPs.contains(bob))

    // Price rises to 1000
    await priceFeed.setPrice(dec(1000, 18))

    // E and F open troves
    await borrowerOperations.openLoan(dec(100, 18), erin, { from: erin, value: dec(1, 'ether') })
    await borrowerOperations.openLoan(dec(100, 18), freddy, { from: freddy, value: dec(1, 'ether') })

    // D tops up
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: dec(1, 'ether') })

    // Price drops to 1
    await priceFeed.setPrice(dec(1, 18))

    // Liquidate F
    const txF = await cdpManager.liquidate(freddy)
    assert.isTrue(txF.receipt.status)
    assert.isFalse(await sortedCDPs.contains(freddy))

    // Grab remaining troves' collateral
    const carol_rawColl = (await cdpManager.CDPs(carol))[1].toString()
    const carol_pendingETHReward = (await cdpManager.getPendingETHReward(carol)).toString()

    const dennis_rawColl = (await cdpManager.CDPs(dennis))[1].toString()
    const dennis_pendingETHReward = (await cdpManager.getPendingETHReward(dennis)).toString()

    const erin_rawColl = (await cdpManager.CDPs(erin))[1].toString()
    const erin_pendingETHReward = (await cdpManager.getPendingETHReward(erin)).toString()

    // Check raw collateral of C, D, E
    assert.isAtMost(th.getDifference(carol_rawColl, dec(500, 'finney')), 1000)
    assert.isAtMost(th.getDifference(dennis_rawColl,'3666666666666666666' ), 1000)
    assert.isAtMost(th.getDifference(erin_rawColl, dec(1, 'ether')), 1000)

    // Check pending ETH rewards of C, D, E
    assert.isAtMost(th.getDifference(carol_pendingETHReward, '1055555555555555555'), 1000)
    assert.isAtMost(th.getDifference(dennis_pendingETHReward, '611111111111111111'), 1000)
    assert.isAtMost(th.getDifference(erin_pendingETHReward, '166666666666666666'), 1000)

    // Check systemic collateral
    const activeColl = (await activePool.getETH()).toString()
    const defaultColl = (await defaultPool.getETH()).toString()

    assert.isAtMost(th.getDifference(activeColl, '5166666666666666666'), 1000)
    assert.isAtMost(th.getDifference(defaultColl, '1833333333333333333'), 1000)

    // Check system snapshots
    const totalStakesSnapshot = (await cdpManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot = (await cdpManager.totalCollateralSnapshot()).toString()
    assert.isAtMost(th.getDifference(totalStakesSnapshot, '1500000000000000000'), 1000)
    assert.isAtMost(th.getDifference(totalCollateralSnapshot, dec(7, 'ether')), 1000)
  })

  it("redistribution, all operations: A,B,C open. Liq(A). D opens. B adds, C withdraws. Liq(B). E & F open. D adds. Liq(F). Varying coll. Distributes correct rewards", async () => {
    /* A, B, C open troves.
    A: 450 ETH
    B: 8901 ETH
    C: 23.902 ETH
    */
    await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: '450000000000000000000' })
    await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: '8901000000000000000000' })
    await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: '23902000000000000000' })

    // Price drops 
    await priceFeed.setPrice('1')

    // Liquidate A
    const txA = await cdpManager.liquidate(alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedCDPs.contains(alice))

    // Check rewards for B and C
    assert.isAtMost(th.getDifference(await cdpManager.getPendingETHReward(bob), '448794843909771000000'), 1000000)
    assert.isAtMost(th.getDifference(await cdpManager.getPendingETHReward(carol), '1205156090229340000'), 1000000)

    // Price rises 
    await priceFeed.setPrice(dec(1, 27))

    // D opens trove: 0.035 ETH
    await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: '35000000000000000' })
   
    // Bob adds 11.33909 ETH to his trove
    await borrowerOperations.addColl(bob, bob, { from: bob, value: '11339090000000000000' })

    // Carol withdraws 15 ETH from her trove
    await borrowerOperations.withdrawColl(dec(15, 'ether'), carol, { from: carol })

    // Price drops
    await priceFeed.setPrice('1')

    // Liquidate B
    const txB = await cdpManager.liquidate(bob)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedCDPs.contains(bob))

    // Check rewards for C and D
    assert.isAtMost(th.getDifference(await cdpManager.getPendingETHReward(carol), '9328829196655480000000'), 10000000)
    assert.isAtMost(th.getDifference(await cdpManager.getPendingETHReward(dennis), '32304737254288600000'), 10000000)

    // Price rises 
    await priceFeed.setPrice(dec(1, 27))

    /* E and F open troves.
    E: 10000 ETH
    F: 0.0007 ETH
    */
    await borrowerOperations.openLoan(dec(100, 18), erin, { from: erin, value: dec(1, 22) })
    await borrowerOperations.openLoan(dec(100, 18), freddy, { from: freddy, value: '700000000000000' })

    // D tops up
    await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: dec(1, 'ether') })

    // Price drops 
    await priceFeed.setPrice('1')

    // Liquidate F
    const txF = await cdpManager.liquidate(freddy)
    assert.isTrue(txF.receipt.status)
    assert.isFalse(await sortedCDPs.contains(freddy))

    // Grab remaining troves' collateral
    const carol_rawColl = (await cdpManager.CDPs(carol))[1].toString()
    const carol_pendingETHReward = (await cdpManager.getPendingETHReward(carol)).toString()
    const carol_Stake = (await cdpManager.CDPs(carol))[2].toString()

    const dennis_rawColl = (await cdpManager.CDPs(dennis))[1].toString()
    const dennis_pendingETHReward = (await cdpManager.getPendingETHReward(dennis)).toString()
    const dennis_Stake = (await cdpManager.CDPs(dennis))[2].toString()

    const erin_rawColl = (await cdpManager.CDPs(erin))[1].toString()
    const erin_pendingETHReward = (await cdpManager.getPendingETHReward(erin)).toString()
    const erin_Stake = (await cdpManager.CDPs(erin))[2].toString()
    
    // Check raw collateral of C, D, E
    assert.isAtMost(th.getDifference(carol_rawColl, '10107156090229300000'), 1000000)
    assert.isAtMost(th.getDifference(dennis_rawColl,'33339737254288600000' ), 1000000)
    assert.isAtMost(th.getDifference(erin_rawColl, dec(1, 22)), 1000000)
   
    // Check pending ETH rewards of C, D, E
    assert.isAtMost(th.getDifference(carol_pendingETHReward,'9328829534109660000000' ), 10000000)

    assert.isAtMost(th.getDifference(dennis_pendingETHReward, '1204701810442'), 1000000)
    assert.isAtMost(th.getDifference(erin_pendingETHReward, '361341123132837'), 1000000)

    // Check systemic collateral
    const activeColl = (await activePool.getETH()).toString()
    const defaultColl = (await defaultPool.getETH()).toString()

    assert.isAtMost(th.getDifference(activeColl, '10043446893344500000000'), 20000000)
    assert.isAtMost(th.getDifference(defaultColl, '9328829896655480000000'), 20000000)

    // Check system snapshots
    const totalStakesSnapshot = (await cdpManager.totalStakesSnapshot()).toString()
    const totalCollateralSnapshot = (await cdpManager.totalCollateralSnapshot()).toString()
    assert.isAtMost(th.getDifference(totalStakesSnapshot, '19959466399854000000'), 20000000)
    assert.isAtMost(th.getDifference(totalCollateralSnapshot, '19372276790000000000000'), 20000000)
  })
})