const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const getDifference = th.getDifference
const mv = testHelpers.MoneyValues

const TroveManagerTester = artifacts.require("TroveManagerTester")
const VSTTokenTester = artifacts.require("VSTTokenTester")


contract('TroveManager - Redistribution reward calculations', async accounts => {

  const ZERO_ADDRESS = th.ZERO_ADDRESS

  const [
    owner,
    alice, bob, carol, dennis, erin, freddy, greta, harry, ida,
    A, B, C, D, E,
    whale, defaulter_1, defaulter_2, defaulter_3, defaulter_4] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let priceFeed
  let vstToken
  let sortedTroves
  let troveManager
  let nameRegistry
  let activePool
  let defaultPool
  let functionCaller
  let borrowerOperations
  let erc20

  let contracts

  const getOpenTroveVSTAmount = async (totalDebt, asset) => th.getOpenTroveVSTAmount(contracts, totalDebt, asset)
  const getNetBorrowingAmount = async (debtWithFee, asset) => th.getNetBorrowingAmount(contracts, debtWithFee, asset)
  const openTrove = async (params) => th.openTrove(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts.vstToken = await VSTTokenTester.new(
      contracts.troveManager.address,
      contracts.stabilityPoolManager.address,
      contracts.borrowerOperations.address,
    )
    const VSTAContracts = await deploymentHelper.deployVSTAContractsHardhat(accounts[0])

    priceFeed = contracts.priceFeedTestnet
    vstToken = contracts.vstToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    nameRegistry = contracts.nameRegistry
    activePool = contracts.activePool
    defaultPool = contracts.defaultPool
    functionCaller = contracts.functionCaller
    borrowerOperations = contracts.borrowerOperations
    erc20 = contracts.erc20

    let index = 0;
    for (const acc of accounts) {
      await erc20.mint(acc, await web3.eth.getBalance(acc))
      index++;

      if (index >= 20)
        break;
    }

    await deploymentHelper.connectCoreContracts(contracts, VSTAContracts)
    await deploymentHelper.connectVSTAContractsToCore(VSTAContracts, contracts)
  })

  it("redistribution: A, B Open. B Liquidated. C, D Open. D Liquidated. Distributes correct rewards", async () => {
    // A, B open trove
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: bob } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: bob } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // L1: B liquidated
    const txB = await troveManager.liquidate(ZERO_ADDRESS, bob)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))

    const txB_Asset = await troveManager.liquidate(erc20.address, bob)
    assert.isTrue(txB_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // C, D open troves
    const { collateral: C_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: carol } })
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: dennis } })

    const { collateral: C_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: carol } })
    const { collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: dennis } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // L2: D Liquidated
    const txD = await troveManager.liquidate(ZERO_ADDRESS, dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))


    const txD_Asset = await troveManager.liquidate(erc20.address, dennis)
    assert.isTrue(txD_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))

    // Get entire coll of A and C
    const alice_Coll = ((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)))
      .toString()
    const carol_Coll = ((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol)))
      .toString()

    const alice_Coll_Asset = ((await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, alice)))
      .toString()
    const carol_Coll_Asset = ((await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, carol)))
      .toString()

    /* Expected collateral:
    A: Alice receives 0.995 ETH from L1, and ~3/5*0.995 ETH from L2.
    expect aliceColl = 2 + 0.995 + 2.995/4.995 * 0.995 = 3.5916 ETH

    C: Carol receives ~2/5 ETH from L2
    expect carolColl = 2 + 2/4.995 * 0.995 = 2.398 ETH

    Total coll = 4 + 2 * 0.995 ETH
    */
    const A_collAfterL1 = A_coll.add(th.applyLiquidationFee(B_coll))
    assert.isAtMost(th.getDifference(alice_Coll, A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(A_collAfterL1.add(C_coll)))), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_collAfterL1.add(C_coll)))), 1000)

    const A_collAfterL1_Asset = A_coll_Asset.add(th.applyLiquidationFee(B_coll_Asset))
    assert.isAtMost(th.getDifference(alice_Coll_Asset, A_collAfterL1_Asset.add(A_collAfterL1_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(A_collAfterL1_Asset.add(C_coll_Asset)))), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_Asset, C_coll_Asset.add(C_coll_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(A_collAfterL1_Asset.add(C_coll_Asset)))), 1000)

    const entireSystemColl = (await activePool.getAssetBalance(ZERO_ADDRESS)).add(await defaultPool.getAssetBalance(ZERO_ADDRESS)).toString()
    assert.equal(entireSystemColl, A_coll.add(C_coll).add(th.applyLiquidationFee(B_coll.add(D_coll))))

    const entireSystemColl_Asset = (await activePool.getAssetBalance(erc20.address)).add(await defaultPool.getAssetBalance(erc20.address)).toString()
    assert.equal(entireSystemColl_Asset, A_coll_Asset.add(C_coll_Asset).add(th.applyLiquidationFee(B_coll_Asset.add(D_coll_Asset))))

    // check VST gas compensation
    assert.equal((await vstToken.balanceOf(owner)).toString(), toBN(dec(400, 18)).mul(toBN(2)).toString())
  })

  it("redistribution: A, B, C Open. C Liquidated. D, E, F Open. F Liquidated. Distributes correct rewards", async () => {
    // A, B C open troves
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: bob } })
    const { collateral: C_coll } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: carol } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: bob } })
    const { collateral: C_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: carol } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // L1: C liquidated
    const txC = await troveManager.liquidate(ZERO_ADDRESS, carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

    const txC_Asset = await troveManager.liquidate(erc20.address, carol)
    assert.isTrue(txC_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // D, E, F open troves
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: dennis } })
    const { collateral: E_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: erin } })
    const { collateral: F_coll } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: freddy } })

    const { collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: dennis } })
    const { collateral: E_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: erin } })
    const { collateral: F_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: freddy } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // L2: F Liquidated
    const txF = await troveManager.liquidate(ZERO_ADDRESS, freddy)
    assert.isTrue(txF.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, freddy))

    const txF_Asset = await troveManager.liquidate(erc20.address, freddy)
    assert.isTrue(txF_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, freddy))

    // Get entire coll of A, B, D and E
    const alice_Coll = ((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)))
      .toString()
    const bob_Coll = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)))
      .toString()
    const dennis_Coll = ((await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, dennis)))
      .toString()
    const erin_Coll = ((await troveManager.Troves(erin, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, erin)))
      .toString()


    const alice_Coll_Asset = ((await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, alice)))
      .toString()
    const bob_Coll_Asset = ((await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, bob)))
      .toString()
    const dennis_Coll_Asset = ((await troveManager.Troves(dennis, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, dennis)))
      .toString()
    const erin_Coll_Asset = ((await troveManager.Troves(erin, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, erin)))
      .toString()

    /* Expected collateral:
    A and B receives 1/2 ETH * 0.995 from L1.
    total Coll: 3

    A, B, receive (2.4975)/8.995 * 0.995 ETH from L2.
    
    D, E receive 2/8.995 * 0.995 ETH from L2.

    expect A, B coll  = 2 +  0.4975 + 0.2763  =  ETH
    expect D, E coll  = 2 + 0.2212  =  ETH

    Total coll = 8 (non-liquidated) + 2 * 0.995 (liquidated and redistributed)
    */
    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll)))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll)))
    const totalBeforeL2 = A_collAfterL1.add(B_collAfterL1).add(D_coll).add(E_coll)
    const expected_A = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(F_coll)).div(totalBeforeL2))
    const expected_B = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(F_coll)).div(totalBeforeL2))
    const expected_D = D_coll.add(D_coll.mul(th.applyLiquidationFee(F_coll)).div(totalBeforeL2))
    const expected_E = E_coll.add(E_coll.mul(th.applyLiquidationFee(F_coll)).div(totalBeforeL2))

    const A_collAfterL1_Asset = A_coll_Asset.add(A_coll_Asset.mul(th.applyLiquidationFee(C_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset)))
    const B_collAfterL1_Asset = B_coll_Asset.add(B_coll_Asset.mul(th.applyLiquidationFee(C_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset)))
    const totalBeforeL2_Asset = A_collAfterL1_Asset.add(B_collAfterL1_Asset).add(D_coll_Asset).add(E_coll_Asset)
    const expected_A_Asset = A_collAfterL1_Asset.add(A_collAfterL1_Asset.mul(th.applyLiquidationFee(F_coll_Asset)).div(totalBeforeL2_Asset))
    const expected_B_Asset = B_collAfterL1_Asset.add(B_collAfterL1_Asset.mul(th.applyLiquidationFee(F_coll_Asset)).div(totalBeforeL2_Asset))
    const expected_D_Asset = D_coll_Asset.add(D_coll_Asset.mul(th.applyLiquidationFee(F_coll_Asset)).div(totalBeforeL2_Asset))
    const expected_E_Asset = E_coll_Asset.add(E_coll_Asset.mul(th.applyLiquidationFee(F_coll_Asset)).div(totalBeforeL2_Asset))

    assert.isAtMost(th.getDifference(alice_Coll, expected_A), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, expected_B), 1000)
    assert.isAtMost(th.getDifference(dennis_Coll, expected_D), 1000)
    assert.isAtMost(th.getDifference(erin_Coll, expected_E), 1000)

    assert.isAtMost(th.getDifference(alice_Coll_Asset, expected_A_Asset), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_Asset, expected_B_Asset), 1000)
    assert.isAtMost(th.getDifference(dennis_Coll_Asset, expected_D_Asset), 1000)
    assert.isAtMost(th.getDifference(erin_Coll_Asset, expected_E_Asset), 1000)

    const entireSystemColl = (await activePool.getAssetBalance(ZERO_ADDRESS)).add(await defaultPool.getAssetBalance(ZERO_ADDRESS)).toString()
    const entireSystemColl_Asset = (await activePool.getAssetBalance(erc20.address)).add(await defaultPool.getAssetBalance(erc20.address)).toString()
    assert.equal(entireSystemColl, A_coll.add(B_coll).add(D_coll).add(E_coll).add(th.applyLiquidationFee(C_coll.add(F_coll))))
    assert.equal(entireSystemColl_Asset, A_coll_Asset.add(B_coll_Asset).add(D_coll_Asset).add(E_coll_Asset).add(th.applyLiquidationFee(C_coll_Asset.add(F_coll_Asset))))

    // check VST gas compensation
    assert.equal((await vstToken.balanceOf(owner)).toString(), toBN(dec(400, 18)).mul(toBN(2)).toString())
  })
  ////

  it("redistribution: Sequence of alternate opening/liquidation: final surviving trove has ETH from all previously liquidated troves", async () => {
    // A, B  open troves
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: bob } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: bob } })

    // Price drops to 1 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L1: A liquidated
    const txA = await troveManager.liquidate(ZERO_ADDRESS, alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))

    const txA_Asset = await troveManager.liquidate(erc20.address, alice)
    assert.isTrue(txA_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, alice))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // C, opens trove
    const { collateral: C_coll } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: carol } })
    const { collateral: C_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: carol } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L2: B Liquidated
    const txB = await troveManager.liquidate(ZERO_ADDRESS, bob)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))

    const txB_Asset = await troveManager.liquidate(erc20.address, bob)
    assert.isTrue(txB_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // D opens trove
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: dennis } })
    const { collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: dennis } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L3: C Liquidated
    const txC = await troveManager.liquidate(ZERO_ADDRESS, carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

    const txC_Asset = await troveManager.liquidate(erc20.address, carol)
    assert.isTrue(txC_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // E opens trove
    const { collateral: E_coll } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: erin } })
    const { collateral: E_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: erin } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L4: D Liquidated
    const txD = await troveManager.liquidate(ZERO_ADDRESS, dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))

    const txD_Asset = await troveManager.liquidate(erc20.address, dennis)
    assert.isTrue(txD_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    // F opens trove
    const { collateral: F_coll } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: freddy } })
    const { collateral: F_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: freddy } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(1, 18))

    // L5: E Liquidated
    const txE = await troveManager.liquidate(ZERO_ADDRESS, erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, erin))

    const txE_Asset = await troveManager.liquidate(erc20.address, erin)
    assert.isTrue(txE_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, erin))

    // Get entire coll of A, B, D, E and F
    const alice_Coll = ((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)))
      .toString()
    const bob_Coll = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)))
      .toString()
    const carol_Coll = ((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol)))
      .toString()
    const dennis_Coll = ((await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, dennis)))
      .toString()
    const erin_Coll = ((await troveManager.Troves(erin, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, erin)))
      .toString()


    const alice_Coll_Asset = ((await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, alice)))
      .toString()
    const bob_Coll_Asset = ((await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, bob)))
      .toString()
    const carol_Coll_Asset = ((await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, carol)))
      .toString()
    const dennis_Coll_Asset = ((await troveManager.Troves(dennis, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, dennis)))
      .toString()
    const erin_Coll_Asset = ((await troveManager.Troves(erin, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, erin)))
      .toString()

    const freddy_rawColl = (await troveManager.Troves(freddy, ZERO_ADDRESS))[th.TROVE_COLL_INDEX].toString()
    const freddy_ETHReward = (await troveManager.getPendingAssetReward(ZERO_ADDRESS, freddy)).toString()

    const freddy_rawColl_Asset = (await troveManager.Troves(freddy, erc20.address))[th.TROVE_COLL_INDEX].toString()
    const freddy_ETHReward_Asset = (await troveManager.getPendingAssetReward(erc20.address, freddy)).toString()

    /* Expected collateral:
     A-E should have been liquidated
     trove F should have acquired all ETH in the system: 1 ETH initial coll, and 0.995^5+0.995^4+0.995^3+0.995^2+0.995 from rewards = 5.925 ETH
    */
    assert.isAtMost(th.getDifference(alice_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(dennis_Coll, '0'), 1000)
    assert.isAtMost(th.getDifference(erin_Coll, '0'), 1000)

    assert.isAtMost(th.getDifference(alice_Coll_Asset, '0'), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_Asset, '0'), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_Asset, '0'), 1000)
    assert.isAtMost(th.getDifference(dennis_Coll_Asset, '0'), 1000)
    assert.isAtMost(th.getDifference(erin_Coll_Asset, '0'), 1000)

    assert.isAtMost(th.getDifference(freddy_rawColl, F_coll), 1000)
    assert.isAtMost(th.getDifference(freddy_rawColl_Asset, F_coll_Asset), 1000)

    const gainedETH = th.applyLiquidationFee(
      E_coll.add(th.applyLiquidationFee(
        D_coll.add(th.applyLiquidationFee(
          C_coll.add(th.applyLiquidationFee(
            B_coll.add(th.applyLiquidationFee(A_coll))
          ))
        ))
      ))
    )

    const gainedETH_Asset = th.applyLiquidationFee(
      E_coll_Asset.add(th.applyLiquidationFee(
        D_coll_Asset.add(th.applyLiquidationFee(
          C_coll_Asset.add(th.applyLiquidationFee(
            B_coll_Asset.add(th.applyLiquidationFee(A_coll_Asset))
          ))
        ))
      ))
    )
    assert.isAtMost(th.getDifference(freddy_ETHReward, gainedETH), 1000)
    assert.isAtMost(th.getDifference(freddy_ETHReward_Asset, gainedETH_Asset), 1000)

    const entireSystemColl = (await activePool.getAssetBalance(ZERO_ADDRESS)).add(await defaultPool.getAssetBalance(ZERO_ADDRESS)).toString()
    const entireSystemColl_Asset = (await activePool.getAssetBalance(erc20.address)).add(await defaultPool.getAssetBalance(erc20.address)).toString()
    assert.isAtMost(th.getDifference(entireSystemColl, F_coll.add(gainedETH)), 1000)
    assert.isAtMost(th.getDifference(entireSystemColl_Asset, F_coll_Asset.add(gainedETH_Asset)), 1000)

    // check VST gas compensation
    assert.equal((await vstToken.balanceOf(owner)).toString(), toBN(dec(1000, 18)).mul(toBN(2)).toString())
  })

  // ---Trove adds collateral --- 

  // Test based on scenario in: https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution: A,B,C,D,E open. Liq(A). B adds coll. Liq(C). B and D have correct coll and debt", async () => {
    // A, B, C, D, E open troves
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100000, 18), extraParams: { from: A } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100000, 18), extraParams: { from: B } })
    const { collateral: C_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100000, 18), extraParams: { from: C } })
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(20000, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: D } })
    const { collateral: E_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100000, 18), extraParams: { from: E } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100000, 18), extraParams: { from: A } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100000, 18), extraParams: { from: B } })
    const { collateral: C_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100000, 18), extraParams: { from: C } })
    const { collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(20000, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: D } })
    const { collateral: E_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100000, 18), extraParams: { from: E } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate A
    // console.log(`ICR A: ${await troveManager.getCurrentICR(A, price)}`)
    const txA = await troveManager.liquidate(ZERO_ADDRESS, A)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, A))

    const txA_Asset = await troveManager.liquidate(erc20.address, A)
    assert.isTrue(txA_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, A))

    // Check entireColl for each trove:
    const B_entireColl_1 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const C_entireColl_1 = (await th.getEntireCollAndDebt(contracts, C)).entireColl
    const D_entireColl_1 = (await th.getEntireCollAndDebt(contracts, D)).entireColl
    const E_entireColl_1 = (await th.getEntireCollAndDebt(contracts, E)).entireColl

    const B_entireColl_1_Asset = (await th.getEntireCollAndDebt(contracts, B, erc20.address)).entireColl
    const C_entireColl_1_Asset = (await th.getEntireCollAndDebt(contracts, C, erc20.address)).entireColl
    const D_entireColl_1_Asset = (await th.getEntireCollAndDebt(contracts, D, erc20.address)).entireColl
    const E_entireColl_1_Asset = (await th.getEntireCollAndDebt(contracts, E, erc20.address)).entireColl

    const totalCollAfterL1 = B_coll.add(C_coll).add(D_coll).add(E_coll)
    const B_collAfterL1 = B_coll.add(th.applyLiquidationFee(A_coll).mul(B_coll).div(totalCollAfterL1))
    const C_collAfterL1 = C_coll.add(th.applyLiquidationFee(A_coll).mul(C_coll).div(totalCollAfterL1))
    const D_collAfterL1 = D_coll.add(th.applyLiquidationFee(A_coll).mul(D_coll).div(totalCollAfterL1))
    const E_collAfterL1 = E_coll.add(th.applyLiquidationFee(A_coll).mul(E_coll).div(totalCollAfterL1))

    const totalCollAfterL1_Asset = B_coll_Asset.add(C_coll_Asset).add(D_coll_Asset).add(E_coll_Asset)
    const B_collAfterL1_Asset = B_coll_Asset.add(th.applyLiquidationFee(A_coll_Asset).mul(B_coll_Asset).div(totalCollAfterL1_Asset))
    const C_collAfterL1_Asset = C_coll_Asset.add(th.applyLiquidationFee(A_coll_Asset).mul(C_coll_Asset).div(totalCollAfterL1_Asset))
    const D_collAfterL1_Asset = D_coll_Asset.add(th.applyLiquidationFee(A_coll_Asset).mul(D_coll_Asset).div(totalCollAfterL1_Asset))
    const E_collAfterL1_Asset = E_coll_Asset.add(th.applyLiquidationFee(A_coll_Asset).mul(E_coll_Asset).div(totalCollAfterL1_Asset))

    assert.isAtMost(getDifference(B_entireColl_1, B_collAfterL1), 1e8)
    assert.isAtMost(getDifference(C_entireColl_1, C_collAfterL1), 1e8)
    assert.isAtMost(getDifference(D_entireColl_1, D_collAfterL1), 1e8)
    assert.isAtMost(getDifference(E_entireColl_1, E_collAfterL1), 1e8)

    assert.isAtMost(getDifference(B_entireColl_1_Asset, B_collAfterL1_Asset), 1e8)
    assert.isAtMost(getDifference(C_entireColl_1_Asset, C_collAfterL1_Asset), 1e8)
    assert.isAtMost(getDifference(D_entireColl_1_Asset, D_collAfterL1_Asset), 1e8)
    assert.isAtMost(getDifference(E_entireColl_1_Asset, E_collAfterL1_Asset), 1e8)

    // Bob adds 1 ETH to his trove
    const addedColl1 = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(ZERO_ADDRESS, 0, B, B, { from: B, value: addedColl1 })
    await borrowerOperations.addColl(erc20.address, addedColl1, B, B, { from: B })

    // Liquidate C
    const txC = await troveManager.liquidate(ZERO_ADDRESS, C)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, C))

    const txC_Asset = await troveManager.liquidate(erc20.address, C)
    assert.isTrue(txC_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, C))

    const B_entireColl_2 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const D_entireColl_2 = (await th.getEntireCollAndDebt(contracts, D)).entireColl
    const E_entireColl_2 = (await th.getEntireCollAndDebt(contracts, E)).entireColl

    const B_entireColl_2_Asset = (await th.getEntireCollAndDebt(contracts, B, erc20.address)).entireColl
    const D_entireColl_2_Asset = (await th.getEntireCollAndDebt(contracts, D, erc20.address)).entireColl
    const E_entireColl_2_Asset = (await th.getEntireCollAndDebt(contracts, E, erc20.address)).entireColl

    const totalCollAfterL2 = B_collAfterL1.add(addedColl1).add(D_collAfterL1).add(E_collAfterL1)
    const B_collAfterL2 = B_collAfterL1.add(addedColl1).add(th.applyLiquidationFee(C_collAfterL1).mul(B_collAfterL1.add(addedColl1)).div(totalCollAfterL2))
    const D_collAfterL2 = D_collAfterL1.add(th.applyLiquidationFee(C_collAfterL1).mul(D_collAfterL1).div(totalCollAfterL2))
    const E_collAfterL2 = E_collAfterL1.add(th.applyLiquidationFee(C_collAfterL1).mul(E_collAfterL1).div(totalCollAfterL2))

    const totalCollAfterL2_Asset = B_collAfterL1_Asset.add(addedColl1).add(D_collAfterL1_Asset).add(E_collAfterL1_Asset)
    const B_collAfterL2_Asset = B_collAfterL1_Asset.add(addedColl1).add(th.applyLiquidationFee(C_collAfterL1_Asset).mul(B_collAfterL1_Asset.add(addedColl1)).div(totalCollAfterL2_Asset))
    const D_collAfterL2_Asset = D_collAfterL1_Asset.add(th.applyLiquidationFee(C_collAfterL1_Asset).mul(D_collAfterL1_Asset).div(totalCollAfterL2_Asset))
    const E_collAfterL2_Asset = E_collAfterL1_Asset.add(th.applyLiquidationFee(C_collAfterL1_Asset).mul(E_collAfterL1_Asset).div(totalCollAfterL2_Asset))

    // console.log(`D_entireColl_2: ${D_entireColl_2}`)
    // console.log(`E_entireColl_2: ${E_entireColl_2}`)
    //assert.isAtMost(getDifference(B_entireColl_2, B_collAfterL2), 1e8)
    assert.isAtMost(getDifference(D_entireColl_2, D_collAfterL2), 1e8)
    assert.isAtMost(getDifference(E_entireColl_2, E_collAfterL2), 1e8)
    assert.isAtMost(getDifference(D_entireColl_2_Asset, D_collAfterL2_Asset), 1e8)
    assert.isAtMost(getDifference(E_entireColl_2_Asset, E_collAfterL2_Asset), 1e8)

    // Bob adds 1 ETH to his trove
    const addedColl2 = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(ZERO_ADDRESS, 0, B, B, { from: B, value: addedColl2 })
    await borrowerOperations.addColl(erc20.address, addedColl2, B, B, { from: B })

    // Liquidate E
    const txE = await troveManager.liquidate(ZERO_ADDRESS, E)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, E))

    const txE_Asset = await troveManager.liquidate(erc20.address, E)
    assert.isTrue(txE_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, E))

    const totalCollAfterL3 = B_collAfterL2.add(addedColl2).add(D_collAfterL2)
    const B_collAfterL3 = B_collAfterL2.add(addedColl2).add(th.applyLiquidationFee(E_collAfterL2).mul(B_collAfterL2.add(addedColl2)).div(totalCollAfterL3))
    const D_collAfterL3 = D_collAfterL2.add(th.applyLiquidationFee(E_collAfterL2).mul(D_collAfterL2).div(totalCollAfterL3))

    const totalCollAfterL3_Asset = B_collAfterL2_Asset.add(addedColl2).add(D_collAfterL2_Asset)
    const B_collAfterL3_Asset = B_collAfterL2_Asset.add(addedColl2).add(th.applyLiquidationFee(E_collAfterL2_Asset).mul(B_collAfterL2_Asset.add(addedColl2)).div(totalCollAfterL3_Asset))
    const D_collAfterL3_Asset = D_collAfterL2_Asset.add(th.applyLiquidationFee(E_collAfterL2_Asset).mul(D_collAfterL2_Asset).div(totalCollAfterL3_Asset))

    const B_entireColl_3 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const D_entireColl_3 = (await th.getEntireCollAndDebt(contracts, D)).entireColl
    const B_entireColl_3_Asset = (await th.getEntireCollAndDebt(contracts, B, erc20.address)).entireColl
    const D_entireColl_3_Asset = (await th.getEntireCollAndDebt(contracts, D, erc20.address)).entireColl

    const diff_entireColl_B = getDifference(B_entireColl_3, B_collAfterL3)
    const diff_entireColl_D = getDifference(D_entireColl_3, D_collAfterL3)

    const diff_entireColl_B_Asset = getDifference(B_entireColl_3_Asset, B_collAfterL3_Asset)
    const diff_entireColl_D_Asset = getDifference(D_entireColl_3_Asset, D_collAfterL3_Asset)

    assert.isAtMost(diff_entireColl_B, 1e8)
    assert.isAtMost(diff_entireColl_D, 1e8)
    assert.isAtMost(diff_entireColl_B_Asset, 1e8)
    assert.isAtMost(diff_entireColl_D_Asset, 1e8)
  })

  // Test based on scenario in: https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution: A,B,C,D open. Liq(A). B adds coll. Liq(C). B and D have correct coll and debt", async () => {
    // A, B, C, D, E open troves
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100000, 18), extraParams: { from: A } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100000, 18), extraParams: { from: B } })
    const { collateral: C_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100000, 18), extraParams: { from: C } })
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(20000, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: D } })
    const { collateral: E_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100000, 18), extraParams: { from: E } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100000, 18), extraParams: { from: A } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100000, 18), extraParams: { from: B } })
    const { collateral: C_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100000, 18), extraParams: { from: C } })
    const { collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(20000, 16)), extraVSTAmount: dec(10, 18), extraParams: { from: D } })
    const { collateral: E_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100000, 18), extraParams: { from: E } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Check entireColl for each trove:
    const A_entireColl_0 = (await th.getEntireCollAndDebt(contracts, A)).entireColl
    const B_entireColl_0 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const C_entireColl_0 = (await th.getEntireCollAndDebt(contracts, C)).entireColl
    const D_entireColl_0 = (await th.getEntireCollAndDebt(contracts, D)).entireColl
    const E_entireColl_0 = (await th.getEntireCollAndDebt(contracts, E)).entireColl

    const A_entireColl_0_Asset = (await th.getEntireCollAndDebt(contracts, A, erc20.address)).entireColl
    const B_entireColl_0_Asset = (await th.getEntireCollAndDebt(contracts, B, erc20.address)).entireColl
    const C_entireColl_0_Asset = (await th.getEntireCollAndDebt(contracts, C, erc20.address)).entireColl
    const D_entireColl_0_Asset = (await th.getEntireCollAndDebt(contracts, D, erc20.address)).entireColl
    const E_entireColl_0_Asset = (await th.getEntireCollAndDebt(contracts, E, erc20.address)).entireColl

    // entireSystemColl, excluding A 
    const denominatorColl_1 = (await troveManager.getEntireSystemColl(ZERO_ADDRESS)).sub(A_entireColl_0)
    const denominatorColl_1_Asset = (await troveManager.getEntireSystemColl(erc20.address)).sub(A_entireColl_0_Asset)

    // Liquidate A
    // console.log(`ICR A: ${await troveManager.getCurrentICR(A, price)}`)
    const txA = await troveManager.liquidate(ZERO_ADDRESS, A)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, A))

    const txA_Asset = await troveManager.liquidate(erc20.address, A)
    assert.isTrue(txA_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, A))

    const A_collRedistribution = A_entireColl_0.mul(toBN(995)).div(toBN(1000)) // remove the gas comp
    const A_collRedistribution_Asset = A_entireColl_0_Asset.mul(toBN(995)).div(toBN(1000)) // remove the gas comp

    // console.log(`A_collRedistribution: ${A_collRedistribution}`)
    // Check accumulated ETH gain for each trove
    const B_ETHGain_1 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, B)
    const C_ETHGain_1 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, C)
    const D_ETHGain_1 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, D)
    const E_ETHGain_1 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, E)

    const B_ETHGain_1_Asset = await troveManager.getPendingAssetReward(erc20.address, B)
    const C_ETHGain_1_Asset = await troveManager.getPendingAssetReward(erc20.address, C)
    const D_ETHGain_1_Asset = await troveManager.getPendingAssetReward(erc20.address, D)
    const E_ETHGain_1_Asset = await troveManager.getPendingAssetReward(erc20.address, E)

    // Check gains are what we'd expect from a distribution proportional to each trove's entire coll
    const B_expectedPendingETH_1 = A_collRedistribution.mul(B_entireColl_0).div(denominatorColl_1)
    const C_expectedPendingETH_1 = A_collRedistribution.mul(C_entireColl_0).div(denominatorColl_1)
    const D_expectedPendingETH_1 = A_collRedistribution.mul(D_entireColl_0).div(denominatorColl_1)
    const E_expectedPendingETH_1 = A_collRedistribution.mul(E_entireColl_0).div(denominatorColl_1)

    const B_expectedPendingETH_1_Asset = A_collRedistribution_Asset.mul(B_entireColl_0_Asset).div(denominatorColl_1_Asset)
    const C_expectedPendingETH_1_Asset = A_collRedistribution_Asset.mul(C_entireColl_0_Asset).div(denominatorColl_1_Asset)
    const D_expectedPendingETH_1_Asset = A_collRedistribution_Asset.mul(D_entireColl_0_Asset).div(denominatorColl_1_Asset)
    const E_expectedPendingETH_1_Asset = A_collRedistribution_Asset.mul(E_entireColl_0_Asset).div(denominatorColl_1_Asset)

    assert.isAtMost(getDifference(B_expectedPendingETH_1, B_ETHGain_1), 1e8)
    assert.isAtMost(getDifference(C_expectedPendingETH_1, C_ETHGain_1), 1e8)
    assert.isAtMost(getDifference(D_expectedPendingETH_1, D_ETHGain_1), 1e8)
    assert.isAtMost(getDifference(E_expectedPendingETH_1, E_ETHGain_1), 1e8)

    assert.isAtMost(getDifference(B_expectedPendingETH_1_Asset, B_ETHGain_1_Asset), 1e8)
    assert.isAtMost(getDifference(C_expectedPendingETH_1_Asset, C_ETHGain_1_Asset), 1e8)
    assert.isAtMost(getDifference(D_expectedPendingETH_1_Asset, D_ETHGain_1_Asset), 1e8)
    assert.isAtMost(getDifference(E_expectedPendingETH_1_Asset, E_ETHGain_1_Asset), 1e8)

    // // Bob adds 1 ETH to his trove
    await borrowerOperations.addColl(ZERO_ADDRESS, 0, B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.addColl(erc20.address, dec(1, 'ether'), B, B, { from: B })

    // Check entireColl for each trove
    const B_entireColl_1 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const C_entireColl_1 = (await th.getEntireCollAndDebt(contracts, C)).entireColl
    const D_entireColl_1 = (await th.getEntireCollAndDebt(contracts, D)).entireColl
    const E_entireColl_1 = (await th.getEntireCollAndDebt(contracts, E)).entireColl

    const B_entireColl_1_Asset = (await th.getEntireCollAndDebt(contracts, B, erc20.address)).entireColl
    const C_entireColl_1_Asset = (await th.getEntireCollAndDebt(contracts, C, erc20.address)).entireColl
    const D_entireColl_1_Asset = (await th.getEntireCollAndDebt(contracts, D, erc20.address)).entireColl
    const E_entireColl_1_Asset = (await th.getEntireCollAndDebt(contracts, E, erc20.address)).entireColl

    // entireSystemColl, excluding C
    const denominatorColl_2 = (await troveManager.getEntireSystemColl(ZERO_ADDRESS)).sub(C_entireColl_1)
    const denominatorColl_2_Asset = (await troveManager.getEntireSystemColl(erc20.address)).sub(C_entireColl_1_Asset)

    // Liquidate C
    const txC = await troveManager.liquidate(ZERO_ADDRESS, C)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, C))

    const txC_Asset = await troveManager.liquidate(erc20.address, C)
    assert.isTrue(txC_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, C))

    const C_collRedistribution = C_entireColl_1.mul(toBN(995)).div(toBN(1000)) // remove the gas comp
    const C_collRedistribution_Asset = C_entireColl_1_Asset.mul(toBN(995)).div(toBN(1000)) // remove the gas comp
    // console.log(`C_collRedistribution: ${C_collRedistribution}`)

    const B_ETHGain_2 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, B)
    const D_ETHGain_2 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, D)
    const E_ETHGain_2 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, E)

    const B_ETHGain_2_Asset = await troveManager.getPendingAssetReward(erc20.address, B)
    const D_ETHGain_2_Asset = await troveManager.getPendingAssetReward(erc20.address, D)
    const E_ETHGain_2_Asset = await troveManager.getPendingAssetReward(erc20.address, E)

    // Since B topped up, he has no previous pending ETH gain
    const B_expectedPendingETH_2 = C_collRedistribution.mul(B_entireColl_1).div(denominatorColl_2)
    const B_expectedPendingETH_2_Asset = C_collRedistribution_Asset.mul(B_entireColl_1_Asset).div(denominatorColl_2_Asset)

    // D & E's accumulated pending ETH gain includes their previous gain
    const D_expectedPendingETH_2 = C_collRedistribution.mul(D_entireColl_1).div(denominatorColl_2)
      .add(D_expectedPendingETH_1)

    const D_expectedPendingETH_2_Asset = C_collRedistribution_Asset.mul(D_entireColl_1_Asset).div(denominatorColl_2_Asset)
      .add(D_expectedPendingETH_1_Asset)

    const E_expectedPendingETH_2 = C_collRedistribution.mul(E_entireColl_1).div(denominatorColl_2)
      .add(E_expectedPendingETH_1)

    const E_expectedPendingETH_2_Asset = C_collRedistribution_Asset.mul(E_entireColl_1_Asset).div(denominatorColl_2_Asset)
      .add(E_expectedPendingETH_1_Asset)

    assert.isAtMost(getDifference(B_expectedPendingETH_2, B_ETHGain_2), 1e8)
    assert.isAtMost(getDifference(D_expectedPendingETH_2, D_ETHGain_2), 1e8)
    assert.isAtMost(getDifference(E_expectedPendingETH_2, E_ETHGain_2), 1e8)

    assert.isAtMost(getDifference(B_expectedPendingETH_2_Asset, B_ETHGain_2_Asset), 1e8)
    assert.isAtMost(getDifference(D_expectedPendingETH_2_Asset, D_ETHGain_2_Asset), 1e8)
    assert.isAtMost(getDifference(E_expectedPendingETH_2_Asset, E_ETHGain_2_Asset), 1e8)

    // // Bob adds 1 ETH to his trove
    await borrowerOperations.addColl(ZERO_ADDRESS, 0, B, B, { from: B, value: dec(1, 'ether') })
    await borrowerOperations.addColl(erc20.address, dec(1, 'ether'), B, B, { from: B })

    // Check entireColl for each trove
    const B_entireColl_2 = (await th.getEntireCollAndDebt(contracts, B)).entireColl
    const D_entireColl_2 = (await th.getEntireCollAndDebt(contracts, D)).entireColl
    const E_entireColl_2 = (await th.getEntireCollAndDebt(contracts, E)).entireColl

    const B_entireColl_2_Asset = (await th.getEntireCollAndDebt(contracts, B, erc20.address)).entireColl
    const D_entireColl_2_Asset = (await th.getEntireCollAndDebt(contracts, D, erc20.address)).entireColl
    const E_entireColl_2_Asset = (await th.getEntireCollAndDebt(contracts, E, erc20.address)).entireColl

    // entireSystemColl, excluding E
    const denominatorColl_3 = (await troveManager.getEntireSystemColl(ZERO_ADDRESS)).sub(E_entireColl_2)
    const denominatorColl_3_Asset = (await troveManager.getEntireSystemColl(erc20.address)).sub(E_entireColl_2_Asset)

    // Liquidate E
    const txE = await troveManager.liquidate(ZERO_ADDRESS, E)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, E))

    const txE_Asset = await troveManager.liquidate(erc20.address, E)
    assert.isTrue(txE_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, E))

    const E_collRedistribution = E_entireColl_2.mul(toBN(995)).div(toBN(1000)) // remove the gas comp
    const E_collRedistribution_Asset = E_entireColl_2_Asset.mul(toBN(995)).div(toBN(1000)) // remove the gas comp
    // console.log(`E_collRedistribution: ${E_collRedistribution}`)

    const B_ETHGain_3 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, B)
    const D_ETHGain_3 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, D)

    const B_ETHGain_3_Asset = await troveManager.getPendingAssetReward(erc20.address, B)
    const D_ETHGain_3_Asset = await troveManager.getPendingAssetReward(erc20.address, D)

    // Since B topped up, he has no previous pending ETH gain
    const B_expectedPendingETH_3 = E_collRedistribution.mul(B_entireColl_2).div(denominatorColl_3)
    const B_expectedPendingETH_3_Asset = E_collRedistribution_Asset.mul(B_entireColl_2_Asset).div(denominatorColl_3_Asset)

    // D'S accumulated pending ETH gain includes their previous gain
    const D_expectedPendingETH_3 = E_collRedistribution.mul(D_entireColl_2).div(denominatorColl_3)
      .add(D_expectedPendingETH_2)

    const D_expectedPendingETH_3_Asset = E_collRedistribution_Asset.mul(D_entireColl_2_Asset).div(denominatorColl_3_Asset)
      .add(D_expectedPendingETH_2_Asset)

    assert.isAtMost(getDifference(B_expectedPendingETH_3, B_ETHGain_3), 1e8)
    assert.isAtMost(getDifference(D_expectedPendingETH_3, D_ETHGain_3), 1e8)

    assert.isAtMost(getDifference(B_expectedPendingETH_3_Asset, B_ETHGain_3_Asset), 1e8)
    assert.isAtMost(getDifference(D_expectedPendingETH_3_Asset, D_ETHGain_3_Asset), 1e8)
  })

  it("redistribution: A,B,C Open. Liq(C). B adds coll. Liq(A). B acquires all coll and debt", async () => {
    // A, B, C open troves
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: carol } })

    const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll_Asset, totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: carol } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txC = await troveManager.liquidate(ZERO_ADDRESS, carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

    const txC_Asset = await troveManager.liquidate(erc20.address, carol)
    assert.isTrue(txC_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob adds ETH to his trove
    const addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(ZERO_ADDRESS, 0, bob, bob, { from: bob, value: addedColl })
    await borrowerOperations.addColl(erc20.address, addedColl, bob, bob, { from: bob })

    // Alice withdraws VST
    await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, await getNetBorrowingAmount(A_totalDebt), alice, alice, { from: alice })
    await borrowerOperations.withdrawVST(erc20.address, th._100pct, await getNetBorrowingAmount(A_totalDebt, erc20.address), alice, alice, { from: alice })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Alice
    const txA = await troveManager.liquidate(ZERO_ADDRESS, alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))

    const txA_Asset = await troveManager.liquidate(erc20.address, alice)
    assert.isTrue(txA_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, alice))

    // Expect Bob now holds all Ether and VSTDebt in the system: 2 + 0.4975+0.4975*0.995+0.995 Ether and 110*3 VST (10 each for gas compensation)
    const bob_Coll = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)))
      .toString()

    const bob_VSTDebt = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]
      .add(await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, bob)))
      .toString()

    const bob_Coll_Asset = ((await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, bob)))
      .toString()

    const bob_VSTDebt_Asset = ((await troveManager.Troves(bob, erc20.address))[th.TROVE_DEBT_INDEX]
      .add(await troveManager.getPendingVSTDebtReward(erc20.address, bob)))
      .toString()

    const expected_B_coll = B_coll
      .add(addedColl)
      .add(th.applyLiquidationFee(A_coll))
      .add(th.applyLiquidationFee(C_coll).mul(B_coll).div(A_coll.add(B_coll)))
      .add(th.applyLiquidationFee(th.applyLiquidationFee(C_coll).mul(A_coll).div(A_coll.add(B_coll))))

    const expected_B_coll_Asset = B_coll_Asset
      .add(addedColl)
      .add(th.applyLiquidationFee(A_coll_Asset))
      .add(th.applyLiquidationFee(C_coll_Asset).mul(B_coll_Asset).div(A_coll_Asset.add(B_coll_Asset)))
      .add(th.applyLiquidationFee(th.applyLiquidationFee(C_coll_Asset).mul(A_coll_Asset).div(A_coll_Asset.add(B_coll_Asset))))


    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(bob_VSTDebt, A_totalDebt.mul(toBN(2)).add(B_totalDebt).add(C_totalDebt)), 1000)

    assert.isAtMost(th.getDifference(bob_Coll_Asset, expected_B_coll_Asset), 1000)
    assert.isAtMost(th.getDifference(bob_VSTDebt_Asset, A_totalDebt_Asset.mul(toBN(2)).add(B_totalDebt_Asset).add(C_totalDebt_Asset)), 1000)
  })

  it("redistribution: A,B,C Open. Liq(C). B tops up coll. D Opens. Liq(D). Distributes correct rewards.", async () => {
    // A, B, C open troves
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: carol } })

    const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll_Asset, totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: carol } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txC = await troveManager.liquidate(ZERO_ADDRESS, carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

    const txC_Asset = await troveManager.liquidate(erc20.address, carol)
    assert.isTrue(txC_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob adds ETH to his trove
    const addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(ZERO_ADDRESS, 0, bob, bob, { from: bob, value: addedColl })
    await borrowerOperations.addColl(erc20.address, addedColl, bob, bob, { from: bob })

    // D opens trove
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: dennis } })
    const { collateral: D_coll_Asset, totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: dennis } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate D
    const txA = await troveManager.liquidate(ZERO_ADDRESS, dennis)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))

    const txA_Asset = await troveManager.liquidate(erc20.address, dennis)
    assert.isTrue(txA_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))

    /* Bob rewards:
     L1: 1/2*0.995 ETH, 55 VST
     L2: (2.4975/3.995)*0.995 = 0.622 ETH , 110*(2.4975/3.995)= 68.77 VSTDebt

    coll: 3.1195 ETH
    debt: 233.77 VSTDebt

     Alice rewards:
    L1 1/2*0.995 ETH, 55 VST
    L2 (1.4975/3.995)*0.995 = 0.3730 ETH, 110*(1.4975/3.995) = 41.23 VSTDebt

    coll: 1.8705 ETH
    debt: 146.23 VSTDebt

    totalColl: 4.99 ETH
    totalDebt 380 VST (includes 50 each for gas compensation)
    */
    const bob_Coll = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)))
      .toString()

    const bob_VSTDebt = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]
      .add(await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, bob)))
      .toString()

    const alice_Coll = ((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)))
      .toString()

    const alice_VSTDebt = ((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]
      .add(await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, alice)))
      .toString()

    const bob_Coll_Asset = ((await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, bob)))
      .toString()

    const bob_VSTDebt_Asset = ((await troveManager.Troves(bob, erc20.address))[th.TROVE_DEBT_INDEX]
      .add(await troveManager.getPendingVSTDebtReward(erc20.address, bob)))
      .toString()

    const alice_Coll_Asset = ((await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, alice)))
      .toString()

    const alice_VSTDebt_Asset = ((await troveManager.Troves(alice, erc20.address))[th.TROVE_DEBT_INDEX]
      .add(await troveManager.getPendingVSTDebtReward(erc20.address, alice)))
      .toString()

    const totalCollAfterL1 = A_coll.add(B_coll).add(addedColl).add(th.applyLiquidationFee(C_coll))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll))).add(addedColl)
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(totalCollAfterL1))
    const expected_B_debt = B_totalDebt
      .add(B_coll.mul(C_totalDebt).div(A_coll.add(B_coll)))
      .add(B_collAfterL1.mul(D_totalDebt).div(totalCollAfterL1))

    const totalCollAfterL1_Asset = A_coll_Asset.add(B_coll_Asset).add(addedColl).add(th.applyLiquidationFee(C_coll_Asset))
    const B_collAfterL1_Asset = B_coll_Asset.add(B_coll_Asset.mul(th.applyLiquidationFee(C_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset))).add(addedColl)
    const expected_B_coll_Asset = B_collAfterL1_Asset.add(B_collAfterL1_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(totalCollAfterL1_Asset))
    const expected_B_debt_Asset = B_totalDebt_Asset
      .add(B_coll_Asset.mul(C_totalDebt_Asset).div(A_coll_Asset.add(B_coll_Asset)))
      .add(B_collAfterL1_Asset.mul(D_totalDebt_Asset).div(totalCollAfterL1_Asset))

    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(bob_VSTDebt, expected_B_debt), 10000)

    assert.isAtMost(th.getDifference(bob_Coll_Asset, expected_B_coll_Asset), 1000)
    assert.isAtMost(th.getDifference(bob_VSTDebt_Asset, expected_B_debt_Asset), 10000)

    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll)))
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(totalCollAfterL1))
    const expected_A_debt = A_totalDebt
      .add(A_coll.mul(C_totalDebt).div(A_coll.add(B_coll)))
      .add(A_collAfterL1.mul(D_totalDebt).div(totalCollAfterL1))

    const A_collAfterL1_Asset = A_coll_Asset.add(A_coll_Asset.mul(th.applyLiquidationFee(C_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset)))
    const expected_A_coll_Asset = A_collAfterL1_Asset.add(A_collAfterL1_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(totalCollAfterL1_Asset))
    const expected_A_debt_Asset = A_totalDebt_Asset
      .add(A_coll_Asset.mul(C_totalDebt_Asset).div(A_coll_Asset.add(B_coll_Asset)))
      .add(A_collAfterL1_Asset.mul(D_totalDebt_Asset).div(totalCollAfterL1_Asset))


    assert.isAtMost(th.getDifference(alice_Coll, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(alice_VSTDebt, expected_A_debt), 10000)

    assert.isAtMost(th.getDifference(alice_Coll_Asset, expected_A_coll_Asset), 1000)
    assert.isAtMost(th.getDifference(alice_VSTDebt_Asset, expected_A_debt_Asset), 10000)

    // check VST gas compensation
    assert.equal((await vstToken.balanceOf(owner)).toString(), toBN(dec(400, 18)).mul(toBN(2)).toString())
  })

  it("redistribution: Trove with the majority stake tops up. A,B,C, D open. Liq(D). C tops up. E Enters, Liq(E). Distributes correct rewards", async () => {
    const _998_Ether = toBN('998000000000000000000')
    // A, B, C, D open troves
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll } = await openTrove({ extraVSTAmount: dec(110, 18), extraParams: { from: carol, value: _998_Ether } })
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: dennis, value: dec(1000, 'ether') } })


    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll_Asset } = await openTrove({ asset: erc20.address, assetSent: _998_Ether, extraVSTAmount: dec(110, 18), extraParams: { from: carol } })
    const { collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, assetSent: dec(1000, 'ether'), ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: dennis } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Dennis
    const txD = await troveManager.liquidate(ZERO_ADDRESS, dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))

    const txD_Asset = await troveManager.liquidate(erc20.address, dennis)
    assert.isTrue(txD_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 ETH, bob: 1 ETH, carol: 998 ETH
    const alice_ETHReward_1 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)
    const bob_ETHReward_1 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)
    const carol_ETHReward_1 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol)

    const alice_ETHReward_1_Asset = await troveManager.getPendingAssetReward(erc20.address, alice)
    const bob_ETHReward_1_Asset = await troveManager.getPendingAssetReward(erc20.address, bob)
    const carol_ETHReward_1_Asset = await troveManager.getPendingAssetReward(erc20.address, carol)

    //Expect 1000 + 1000*0.995 ETH in system now
    const entireSystemColl_1 = (await activePool.getAssetBalance(ZERO_ADDRESS)).add(await defaultPool.getAssetBalance(ZERO_ADDRESS)).toString()
    const entireSystemColl_1_Asset = (await activePool.getAssetBalance(erc20.address)).add(await defaultPool.getAssetBalance(erc20.address)).toString()

    assert.equal(entireSystemColl_1, A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)))
    assert.equal(entireSystemColl_1_Asset, A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset).add(th.applyLiquidationFee(D_coll_Asset)))

    const totalColl = A_coll.add(B_coll).add(C_coll)
    const totalColl_Asset = A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset)
    th.assertIsApproximatelyEqual(alice_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(A_coll).div(totalColl))
    th.assertIsApproximatelyEqual(bob_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(B_coll).div(totalColl))
    th.assertIsApproximatelyEqual(carol_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(C_coll).div(totalColl))

    th.assertIsApproximatelyEqual(alice_ETHReward_1_Asset.toString(), th.applyLiquidationFee(D_coll_Asset).mul(A_coll_Asset).div(totalColl_Asset))
    th.assertIsApproximatelyEqual(bob_ETHReward_1_Asset.toString(), th.applyLiquidationFee(D_coll_Asset).mul(B_coll_Asset).div(totalColl_Asset))
    th.assertIsApproximatelyEqual(carol_ETHReward_1_Asset.toString(), th.applyLiquidationFee(D_coll_Asset).mul(C_coll_Asset).div(totalColl_Asset))

    //Carol adds 1 ETH to her trove, brings it to 1992.01 total coll
    const C_addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(ZERO_ADDRESS, 0, carol, carol, { from: carol, value: dec(1, 'ether') })
    await borrowerOperations.addColl(erc20.address, dec(1, 'ether'), carol, carol, { from: carol })

    //Expect 1996 ETH in system now
    const entireSystemColl_2 = (await activePool.getAssetBalance(ZERO_ADDRESS)).add(await defaultPool.getAssetBalance(ZERO_ADDRESS))
    const entireSystemColl_2_Asset = (await activePool.getAssetBalance(erc20.address)).add(await defaultPool.getAssetBalance(erc20.address))
    th.assertIsApproximatelyEqual(entireSystemColl_2, totalColl.add(th.applyLiquidationFee(D_coll)).add(C_addedColl))
    th.assertIsApproximatelyEqual(entireSystemColl_2_Asset, totalColl_Asset.add(th.applyLiquidationFee(D_coll_Asset)).add(C_addedColl))

    // E opens with another 1996 ETH
    const { collateral: E_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: erin, value: entireSystemColl_2 } })
    const { collateral: E_coll_Asset } = await openTrove({ asset: erc20.address, assetSent: entireSystemColl_2, ICR: toBN(dec(200, 16)), extraParams: { from: erin } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txE = await troveManager.liquidate(ZERO_ADDRESS, erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, erin))

    const txE_Asset = await troveManager.liquidate(erc20.address, erin)
    assert.isTrue(txE_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, erin))

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

    const alice_Coll = ((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)))
      .toString()

    const bob_Coll = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)))
      .toString()

    const carol_Coll = ((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol)))
      .toString()


    const alice_Coll_Asset = ((await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, alice)))
      .toString()

    const bob_Coll_Asset = ((await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, bob)))
      .toString()

    const carol_Coll_Asset = ((await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, carol)))
      .toString()

    const totalCollAfterL1 = A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)).add(C_addedColl)
    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll)))
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll)))
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const C_collAfterL1 = C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).add(C_addedColl)
    const expected_C_coll = C_collAfterL1.add(C_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))

    const totalCollAfterL1_Asset = A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset).add(th.applyLiquidationFee(D_coll_Asset)).add(C_addedColl)
    const A_collAfterL1_Asset = A_coll_Asset.add(A_coll_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset)))
    const expected_A_coll_Asset = A_collAfterL1_Asset.add(A_collAfterL1_Asset.mul(th.applyLiquidationFee(E_coll_Asset)).div(totalCollAfterL1_Asset))
    const B_collAfterL1_Asset = B_coll_Asset.add(B_coll_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset)))
    const expected_B_coll_Asset = B_collAfterL1_Asset.add(B_collAfterL1_Asset.mul(th.applyLiquidationFee(E_coll_Asset)).div(totalCollAfterL1_Asset))
    const C_collAfterL1_Asset = C_coll_Asset.add(C_coll_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset))).add(C_addedColl)
    const expected_C_coll_Asset = C_collAfterL1_Asset.add(C_collAfterL1_Asset.mul(th.applyLiquidationFee(E_coll_Asset)).div(totalCollAfterL1_Asset))

    assert.isAtMost(th.getDifference(alice_Coll, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, expected_C_coll), 1000)

    assert.isAtMost(th.getDifference(alice_Coll_Asset, expected_A_coll_Asset), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_Asset, expected_B_coll_Asset), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_Asset, expected_C_coll_Asset), 1000)

    //Expect 3982.02 ETH in system now
    const entireSystemColl_3 = (await activePool.getAssetBalance(ZERO_ADDRESS)).add(await defaultPool.getAssetBalance(ZERO_ADDRESS)).toString()
    const entireSystemColl_3_Asset = (await activePool.getAssetBalance(erc20.address)).add(await defaultPool.getAssetBalance(erc20.address)).toString()
    th.assertIsApproximatelyEqual(entireSystemColl_3, totalCollAfterL1.add(th.applyLiquidationFee(E_coll)))
    th.assertIsApproximatelyEqual(entireSystemColl_3_Asset, totalCollAfterL1_Asset.add(th.applyLiquidationFee(E_coll_Asset)))

    // check VST gas compensation
    th.assertIsApproximatelyEqual((await vstToken.balanceOf(owner)).toString(), toBN(dec(400, 18)).mul(toBN(2)).toString())
  })

  it("redistribution: Trove with the majority stake tops up. A,B,C, D open. Liq(D). A, B, C top up. E Enters, Liq(E). Distributes correct rewards", async () => {
    const _998_Ether = toBN('998000000000000000000')
    // A, B, C open troves
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll } = await openTrove({ extraVSTAmount: dec(110, 18), extraParams: { from: carol, value: _998_Ether } })
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: dennis, value: dec(1000, 'ether') } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll_Asset } = await openTrove({ asset: erc20.address, assetSent: _998_Ether, extraVSTAmount: dec(110, 18), extraParams: { from: carol } })
    const { collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, assetSent: dec(1000, 'ether'), ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: dennis } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Dennis
    const txD = await troveManager.liquidate(ZERO_ADDRESS, dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))

    const txD_Asset = await troveManager.liquidate(erc20.address, dennis)
    assert.isTrue(txD_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 ETH, bob: 1 ETH, carol: 998 ETH (*0.995)
    const alice_ETHReward_1 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)
    const bob_ETHReward_1 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)
    const carol_ETHReward_1 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol)

    const alice_ETHReward_1_Asset = await troveManager.getPendingAssetReward(erc20.address, alice)
    const bob_ETHReward_1_Asset = await troveManager.getPendingAssetReward(erc20.address, bob)
    const carol_ETHReward_1_Asset = await troveManager.getPendingAssetReward(erc20.address, carol)

    //Expect 1995 ETH in system now
    const entireSystemColl_1 = (await activePool.getAssetBalance(ZERO_ADDRESS)).add(await defaultPool.getAssetBalance(ZERO_ADDRESS)).toString()
    const entireSystemColl_1_Asset = (await activePool.getAssetBalance(erc20.address)).add(await defaultPool.getAssetBalance(erc20.address)).toString()
    assert.equal(entireSystemColl_1, A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)))
    assert.equal(entireSystemColl_1_Asset, A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset).add(th.applyLiquidationFee(D_coll_Asset)))

    const totalColl = A_coll.add(B_coll).add(C_coll)
    const totalColl_Asset = A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset)
    th.assertIsApproximatelyEqual(alice_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(A_coll).div(totalColl))
    th.assertIsApproximatelyEqual(bob_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(B_coll).div(totalColl))
    th.assertIsApproximatelyEqual(carol_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(C_coll).div(totalColl))

    th.assertIsApproximatelyEqual(alice_ETHReward_1_Asset.toString(), th.applyLiquidationFee(D_coll_Asset).mul(A_coll_Asset).div(totalColl_Asset))
    th.assertIsApproximatelyEqual(bob_ETHReward_1_Asset.toString(), th.applyLiquidationFee(D_coll_Asset).mul(B_coll_Asset).div(totalColl_Asset))
    th.assertIsApproximatelyEqual(carol_ETHReward_1_Asset.toString(), th.applyLiquidationFee(D_coll_Asset).mul(C_coll_Asset).div(totalColl_Asset))

    /* Alice, Bob, Carol each adds 1 ETH to their troves, 
    bringing them to 2.995, 2.995, 1992.01 total coll each. */

    const addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(ZERO_ADDRESS, 0, alice, alice, { from: alice, value: addedColl })
    await borrowerOperations.addColl(ZERO_ADDRESS, 0, bob, bob, { from: bob, value: addedColl })
    await borrowerOperations.addColl(ZERO_ADDRESS, 0, carol, carol, { from: carol, value: addedColl })

    await borrowerOperations.addColl(erc20.address, addedColl, alice, alice, { from: alice })
    await borrowerOperations.addColl(erc20.address, addedColl, bob, bob, { from: bob })
    await borrowerOperations.addColl(erc20.address, addedColl, carol, carol, { from: carol })

    //Expect 1998 ETH in system now
    const entireSystemColl_2 = (await activePool.getAssetBalance(ZERO_ADDRESS)).add(await defaultPool.getAssetBalance(ZERO_ADDRESS)).toString()
    const entireSystemColl_2_Asset = (await activePool.getAssetBalance(erc20.address)).add(await defaultPool.getAssetBalance(erc20.address)).toString()
    th.assertIsApproximatelyEqual(entireSystemColl_2, totalColl.add(th.applyLiquidationFee(D_coll)).add(addedColl.mul(toBN(3))))
    th.assertIsApproximatelyEqual(entireSystemColl_2_Asset, totalColl_Asset.add(th.applyLiquidationFee(D_coll_Asset)).add(addedColl.mul(toBN(3))))

    // E opens with another 1998 ETH
    const { collateral: E_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: erin, value: entireSystemColl_2 } })
    const { collateral: E_coll_Asset } = await openTrove({ asset: erc20.address, assetSent: entireSystemColl_2, ICR: toBN(dec(200, 16)), extraParams: { from: erin } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txE = await troveManager.liquidate(ZERO_ADDRESS, erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, erin))

    const txE_Asset = await troveManager.liquidate(erc20.address, erin)
    assert.isTrue(txE_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, erin))

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

    const alice_Coll = ((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)))
      .toString()

    const bob_Coll = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)))
      .toString()

    const carol_Coll = ((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol)))
      .toString()

    const alice_Coll_Asset = ((await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, alice)))
      .toString()

    const bob_Coll_Asset = ((await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, bob)))
      .toString()

    const carol_Coll_Asset = ((await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, carol)))
      .toString()

    const totalCollAfterL1 = A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)).add(addedColl.mul(toBN(3)))
    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).add(addedColl)
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).add(addedColl)
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const C_collAfterL1 = C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).add(addedColl)
    const expected_C_coll = C_collAfterL1.add(C_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))

    const totalCollAfterL1_Asset = A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset).add(th.applyLiquidationFee(D_coll_Asset)).add(addedColl.mul(toBN(3)))
    const A_collAfterL1_Asset = A_coll_Asset.add(A_coll_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset))).add(addedColl)
    const expected_A_coll_Asset = A_collAfterL1_Asset.add(A_collAfterL1_Asset.mul(th.applyLiquidationFee(E_coll_Asset)).div(totalCollAfterL1_Asset))
    const B_collAfterL1_Asset = B_coll_Asset.add(B_coll_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset))).add(addedColl)
    const expected_B_coll_Asset = B_collAfterL1_Asset.add(B_collAfterL1_Asset.mul(th.applyLiquidationFee(E_coll_Asset)).div(totalCollAfterL1_Asset))
    const C_collAfterL1_Asset = C_coll_Asset.add(C_coll_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset))).add(addedColl)
    const expected_C_coll_Asset = C_collAfterL1_Asset.add(C_collAfterL1_Asset.mul(th.applyLiquidationFee(E_coll_Asset)).div(totalCollAfterL1_Asset))

    assert.isAtMost(th.getDifference(alice_Coll, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, expected_C_coll), 1000)

    assert.isAtMost(th.getDifference(alice_Coll_Asset, expected_A_coll_Asset), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_Asset, expected_B_coll_Asset), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_Asset, expected_C_coll_Asset), 1000)

    //Expect 3986.01 ETH in system now
    const entireSystemColl_3 = (await activePool.getAssetBalance(ZERO_ADDRESS)).add(await defaultPool.getAssetBalance(ZERO_ADDRESS))
    const entireSystemColl_3_Asset = (await activePool.getAssetBalance(erc20.address)).add(await defaultPool.getAssetBalance(erc20.address))
    th.assertIsApproximatelyEqual(entireSystemColl_3, totalCollAfterL1.add(th.applyLiquidationFee(E_coll)))
    th.assertIsApproximatelyEqual(entireSystemColl_3_Asset, totalCollAfterL1_Asset.add(th.applyLiquidationFee(E_coll_Asset)))

    // check VST gas compensation
    th.assertIsApproximatelyEqual((await vstToken.balanceOf(owner)).toString(), toBN(dec(400, 18)).mul(toBN(2)).toString())
  })

  // --- Trove withdraws collateral ---

  it("redistribution: A,B,C Open. Liq(C). B withdraws coll. Liq(A). B acquires all coll and debt", async () => {
    // A, B, C open troves
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: carol } })

    const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll_Asset, totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: carol } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txC = await troveManager.liquidate(ZERO_ADDRESS, carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

    const txC_Asset = await troveManager.liquidate(erc20.address, carol)
    assert.isTrue(txC_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob withdraws 0.5 ETH from his trove
    const withdrawnColl = toBN(dec(500, 'finney'))
    await borrowerOperations.withdrawColl(ZERO_ADDRESS, withdrawnColl, bob, bob, { from: bob })
    await borrowerOperations.withdrawColl(erc20.address, withdrawnColl, bob, bob, { from: bob })

    // Alice withdraws VST
    await borrowerOperations.withdrawVST(ZERO_ADDRESS, th._100pct, await getNetBorrowingAmount(A_totalDebt), alice, alice, { from: alice })
    await borrowerOperations.withdrawVST(erc20.address, th._100pct, await getNetBorrowingAmount(A_totalDebt, erc20.address), alice, alice, { from: alice })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Alice
    const txA = await troveManager.liquidate(ZERO_ADDRESS, alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))

    const txA_Asset = await troveManager.liquidate(erc20.address, alice)
    assert.isTrue(txA_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, alice))

    // Expect Bob now holds all Ether and VSTDebt in the system: 2.5 Ether and 300 VST
    // 1 + 0.995/2 - 0.5 + 1.4975*0.995
    const bob_Coll = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)))
      .toString()

    const bob_VSTDebt = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]
      .add(await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, bob)))
      .toString()

    const bob_Coll_Asset = ((await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, bob)))
      .toString()

    const bob_VSTDebt_Asset = ((await troveManager.Troves(bob, erc20.address))[th.TROVE_DEBT_INDEX]
      .add(await troveManager.getPendingVSTDebtReward(erc20.address, bob)))
      .toString()

    const expected_B_coll = B_coll
      .sub(withdrawnColl)
      .add(th.applyLiquidationFee(A_coll))
      .add(th.applyLiquidationFee(C_coll).mul(B_coll).div(A_coll.add(B_coll)))
      .add(th.applyLiquidationFee(th.applyLiquidationFee(C_coll).mul(A_coll).div(A_coll.add(B_coll))))

    const expected_B_coll_Asset = B_coll_Asset
      .sub(withdrawnColl)
      .add(th.applyLiquidationFee(A_coll_Asset))
      .add(th.applyLiquidationFee(C_coll_Asset).mul(B_coll_Asset).div(A_coll_Asset.add(B_coll_Asset)))
      .add(th.applyLiquidationFee(th.applyLiquidationFee(C_coll_Asset).mul(A_coll_Asset).div(A_coll_Asset.add(B_coll_Asset))))

    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(bob_VSTDebt, A_totalDebt.mul(toBN(2)).add(B_totalDebt).add(C_totalDebt)), 1000)

    assert.isAtMost(th.getDifference(bob_Coll_Asset, expected_B_coll_Asset), 1000)
    assert.isAtMost(th.getDifference(bob_VSTDebt_Asset, A_totalDebt_Asset.mul(toBN(2)).add(B_totalDebt_Asset).add(C_totalDebt_Asset)), 1000)

    // check VST gas compensation
    assert.equal((await vstToken.balanceOf(owner)).toString(), toBN(dec(400, 18)).mul(toBN(2)).toString())
  })

  it("redistribution: A,B,C Open. Liq(C). B withdraws coll. D Opens. Liq(D). Distributes correct rewards.", async () => {
    // A, B, C open troves
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: carol } })

    const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll_Asset, totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: carol } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Carol
    const txC = await troveManager.liquidate(ZERO_ADDRESS, carol)
    assert.isTrue(txC.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

    const txC_Asset = await troveManager.liquidate(erc20.address, carol)
    assert.isTrue(txC_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    //Bob  withdraws 0.5 ETH from his trove
    const withdrawnColl = toBN(dec(500, 'finney'))
    await borrowerOperations.withdrawColl(ZERO_ADDRESS, withdrawnColl, bob, bob, { from: bob })
    await borrowerOperations.withdrawColl(erc20.address, withdrawnColl, bob, bob, { from: bob })

    // D opens trove
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: dennis } })
    const { collateral: D_coll_Asset, totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: dennis } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate D
    const txA = await troveManager.liquidate(ZERO_ADDRESS, dennis)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))

    const txA_Asset = await troveManager.liquidate(erc20.address, dennis)
    assert.isTrue(txA_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))

    /* Bob rewards:
     L1: 0.4975 ETH, 55 VST
     L2: (0.9975/2.495)*0.995 = 0.3978 ETH , 110*(0.9975/2.495)= 43.98 VSTDebt

    coll: (1 + 0.4975 - 0.5 + 0.3968) = 1.3953 ETH
    debt: (110 + 55 + 43.98 = 208.98 VSTDebt 

     Alice rewards:
    L1 0.4975, 55 VST
    L2 (1.4975/2.495)*0.995 = 0.5972 ETH, 110*(1.4975/2.495) = 66.022 VSTDebt

    coll: (1 + 0.4975 + 0.5972) = 2.0947 ETH
    debt: (50 + 55 + 66.022) = 171.022 VST Debt

    totalColl: 3.49 ETH
    totalDebt 380 VST (Includes 50 in each trove for gas compensation)
    */
    const bob_Coll = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)))
      .toString()

    const bob_VSTDebt = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]
      .add(await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, bob)))
      .toString()

    const alice_Coll = ((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)))
      .toString()

    const alice_VSTDebt = ((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]
      .add(await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, alice)))
      .toString()

    const bob_Coll_Asset = ((await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, bob)))
      .toString()

    const bob_VSTDebt_Asset = ((await troveManager.Troves(bob, erc20.address))[th.TROVE_DEBT_INDEX]
      .add(await troveManager.getPendingVSTDebtReward(erc20.address, bob)))
      .toString()

    const alice_Coll_Asset = ((await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, alice)))
      .toString()

    const alice_VSTDebt_Asset = ((await troveManager.Troves(alice, erc20.address))[th.TROVE_DEBT_INDEX]
      .add(await troveManager.getPendingVSTDebtReward(erc20.address, alice)))
      .toString()

    const totalCollAfterL1 = A_coll.add(B_coll).sub(withdrawnColl).add(th.applyLiquidationFee(C_coll))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll))).sub(withdrawnColl)
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(totalCollAfterL1))
    const expected_B_debt = B_totalDebt
      .add(B_coll.mul(C_totalDebt).div(A_coll.add(B_coll)))
      .add(B_collAfterL1.mul(D_totalDebt).div(totalCollAfterL1))

    const totalCollAfterL1_Asset = A_coll_Asset.add(B_coll_Asset).sub(withdrawnColl).add(th.applyLiquidationFee(C_coll_Asset))
    const B_collAfterL1_Asset = B_coll_Asset.add(B_coll_Asset.mul(th.applyLiquidationFee(C_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset))).sub(withdrawnColl)
    const expected_B_coll_Asset = B_collAfterL1_Asset.add(B_collAfterL1_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(totalCollAfterL1_Asset))
    const expected_B_debt_Asset = B_totalDebt_Asset
      .add(B_coll_Asset.mul(C_totalDebt_Asset).div(A_coll_Asset.add(B_coll_Asset)))
      .add(B_collAfterL1_Asset.mul(D_totalDebt_Asset).div(totalCollAfterL1_Asset))

    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(bob_VSTDebt, expected_B_debt), 10000)

    assert.isAtMost(th.getDifference(bob_Coll_Asset, expected_B_coll_Asset), 1000)
    assert.isAtMost(th.getDifference(bob_VSTDebt_Asset, expected_B_debt_Asset), 10000)

    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(C_coll)).div(A_coll.add(B_coll)))
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(totalCollAfterL1))
    const expected_A_debt = A_totalDebt
      .add(A_coll.mul(C_totalDebt).div(A_coll.add(B_coll)))
      .add(A_collAfterL1.mul(D_totalDebt).div(totalCollAfterL1))

    const A_collAfterL1_Asset = A_coll_Asset.add(A_coll_Asset.mul(th.applyLiquidationFee(C_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset)))
    const expected_A_coll_Asset = A_collAfterL1_Asset.add(A_collAfterL1_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(totalCollAfterL1_Asset))
    const expected_A_debt_Asset = A_totalDebt_Asset
      .add(A_coll_Asset.mul(C_totalDebt_Asset).div(A_coll_Asset.add(B_coll_Asset)))
      .add(A_collAfterL1_Asset.mul(D_totalDebt_Asset).div(totalCollAfterL1_Asset))

    assert.isAtMost(th.getDifference(alice_Coll_Asset, expected_A_coll_Asset), 1000)
    assert.isAtMost(th.getDifference(alice_VSTDebt_Asset, expected_A_debt_Asset), 10000)

    const entireSystemColl = (await activePool.getAssetBalance(ZERO_ADDRESS)).add(await defaultPool.getAssetBalance(ZERO_ADDRESS))
    const entireSystemColl_Asset = (await activePool.getAssetBalance(erc20.address)).add(await defaultPool.getAssetBalance(erc20.address))
    th.assertIsApproximatelyEqual(entireSystemColl, A_coll.add(B_coll).add(th.applyLiquidationFee(C_coll)).sub(withdrawnColl).add(th.applyLiquidationFee(D_coll)))
    th.assertIsApproximatelyEqual(entireSystemColl_Asset, A_coll_Asset.add(B_coll_Asset).add(th.applyLiquidationFee(C_coll_Asset)).sub(withdrawnColl).add(th.applyLiquidationFee(D_coll_Asset)))

    const entireSystemDebt = (await activePool.getVSTDebt(ZERO_ADDRESS)).add(await defaultPool.getVSTDebt(ZERO_ADDRESS))
    const entireSystemDebt_Asset = (await activePool.getVSTDebt(erc20.address)).add(await defaultPool.getVSTDebt(erc20.address))
    th.assertIsApproximatelyEqual(entireSystemDebt, A_totalDebt.add(B_totalDebt).add(C_totalDebt).add(D_totalDebt))
    th.assertIsApproximatelyEqual(entireSystemDebt_Asset, A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset).add(D_totalDebt_Asset))

    // check VST gas compensation
    th.assertIsApproximatelyEqual((await vstToken.balanceOf(owner)).toString(), toBN(dec(400, 18)).mul(toBN(2)).toString())
  })

  it("redistribution: Trove with the majority stake withdraws. A,B,C,D open. Liq(D). C withdraws some coll. E Enters, Liq(E). Distributes correct rewards", async () => {
    const _998_Ether = toBN('998000000000000000000')
    // A, B, C, D open troves
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll } = await openTrove({ extraVSTAmount: dec(110, 18), extraParams: { from: carol, value: _998_Ether } })
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: dennis, value: dec(1000, 'ether') } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll_Asset } = await openTrove({ asset: erc20.address, assetSent: _998_Ether, extraVSTAmount: dec(110, 18), extraParams: { from: carol } })
    const { collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, assetSent: dec(1000, 'ether'), ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: dennis } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Dennis
    const txD = await troveManager.liquidate(ZERO_ADDRESS, dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))

    const txD_Asset = await troveManager.liquidate(erc20.address, dennis)
    assert.isTrue(txD_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 ETH, bob: 1 ETH, carol: 998 ETH (*0.995)
    const alice_ETHReward_1 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)
    const bob_ETHReward_1 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)
    const carol_ETHReward_1 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol)

    const alice_ETHReward_1_Asset = await troveManager.getPendingAssetReward(erc20.address, alice)
    const bob_ETHReward_1_Asset = await troveManager.getPendingAssetReward(erc20.address, bob)
    const carol_ETHReward_1_Asset = await troveManager.getPendingAssetReward(erc20.address, carol)

    //Expect 1995 ETH in system now
    const entireSystemColl_1 = (await activePool.getAssetBalance(ZERO_ADDRESS)).add(await defaultPool.getAssetBalance(ZERO_ADDRESS))
    const entireSystemColl_1_Asset = (await activePool.getAssetBalance(erc20.address)).add(await defaultPool.getAssetBalance(erc20.address))
    th.assertIsApproximatelyEqual(entireSystemColl_1, A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)))
    th.assertIsApproximatelyEqual(entireSystemColl_1_Asset, A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset).add(th.applyLiquidationFee(D_coll_Asset)))

    const totalColl = A_coll.add(B_coll).add(C_coll)
    const totalColl_Asset = A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset)
    th.assertIsApproximatelyEqual(alice_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(A_coll).div(totalColl))
    th.assertIsApproximatelyEqual(bob_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(B_coll).div(totalColl))
    th.assertIsApproximatelyEqual(carol_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(C_coll).div(totalColl))

    th.assertIsApproximatelyEqual(alice_ETHReward_1_Asset.toString(), th.applyLiquidationFee(D_coll_Asset).mul(A_coll_Asset).div(totalColl_Asset))
    th.assertIsApproximatelyEqual(bob_ETHReward_1_Asset.toString(), th.applyLiquidationFee(D_coll_Asset).mul(B_coll_Asset).div(totalColl_Asset))
    th.assertIsApproximatelyEqual(carol_ETHReward_1_Asset.toString(), th.applyLiquidationFee(D_coll_Asset).mul(C_coll_Asset).div(totalColl_Asset))

    //Carol wthdraws 1 ETH from her trove, brings it to 1990.01 total coll
    const C_withdrawnColl = toBN(dec(1, 'ether'))
    await borrowerOperations.withdrawColl(ZERO_ADDRESS, C_withdrawnColl, carol, carol, { from: carol })
    await borrowerOperations.withdrawColl(erc20.address, C_withdrawnColl, carol, carol, { from: carol })

    //Expect 1994 ETH in system now
    const entireSystemColl_2 = (await activePool.getAssetBalance(ZERO_ADDRESS)).add(await defaultPool.getAssetBalance(ZERO_ADDRESS))
    const entireSystemColl_2_Asset = (await activePool.getAssetBalance(erc20.address)).add(await defaultPool.getAssetBalance(erc20.address))
    th.assertIsApproximatelyEqual(entireSystemColl_2, totalColl.add(th.applyLiquidationFee(D_coll)).sub(C_withdrawnColl))
    th.assertIsApproximatelyEqual(entireSystemColl_2_Asset, totalColl_Asset.add(th.applyLiquidationFee(D_coll_Asset)).sub(C_withdrawnColl))

    // E opens with another 1994 ETH
    const { collateral: E_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: erin, value: entireSystemColl_2 } })
    const { collateral: E_coll_Asset } = await openTrove({ asset: erc20.address, assetSent: entireSystemColl_2, ICR: toBN(dec(200, 16)), extraParams: { from: erin } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txE = await troveManager.liquidate(ZERO_ADDRESS, erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, erin))

    const txE_Asset = await troveManager.liquidate(erc20.address, erin)
    assert.isTrue(txE_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, erin))

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

    const alice_Coll = ((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)))
      .toString()

    const bob_Coll = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)))
      .toString()

    const carol_Coll = ((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol)))
      .toString()

    const alice_Coll_Asset = ((await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, alice)))
      .toString()

    const bob_Coll_Asset = ((await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, bob)))
      .toString()

    const carol_Coll_Asset = ((await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, carol)))
      .toString()

    const totalCollAfterL1 = A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)).sub(C_withdrawnColl)
    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll)))
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll)))
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const C_collAfterL1 = C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).sub(C_withdrawnColl)
    const expected_C_coll = C_collAfterL1.add(C_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))

    const totalCollAfterL1_Asset = A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset).add(th.applyLiquidationFee(D_coll_Asset)).sub(C_withdrawnColl)
    const A_collAfterL1_Asset = A_coll_Asset.add(A_coll_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset)))
    const expected_A_coll_Asset = A_collAfterL1_Asset.add(A_collAfterL1_Asset.mul(th.applyLiquidationFee(E_coll_Asset)).div(totalCollAfterL1_Asset))
    const B_collAfterL1_Asset = B_coll_Asset.add(B_coll_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset)))
    const expected_B_coll_Asset = B_collAfterL1_Asset.add(B_collAfterL1_Asset.mul(th.applyLiquidationFee(E_coll_Asset)).div(totalCollAfterL1_Asset))
    const C_collAfterL1_Asset = C_coll_Asset.add(C_coll_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset))).sub(C_withdrawnColl)
    const expected_C_coll_Asset = C_collAfterL1_Asset.add(C_collAfterL1_Asset.mul(th.applyLiquidationFee(E_coll_Asset)).div(totalCollAfterL1_Asset))

    assert.isAtMost(th.getDifference(alice_Coll, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(bob_Coll, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(carol_Coll, expected_C_coll), 1000)

    assert.isAtMost(th.getDifference(alice_Coll_Asset, expected_A_coll_Asset), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_Asset, expected_B_coll_Asset), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_Asset, expected_C_coll_Asset), 1000)

    //Expect 3978.03 ETH in system now
    const entireSystemColl_3 = (await activePool.getAssetBalance(ZERO_ADDRESS)).add(await defaultPool.getAssetBalance(ZERO_ADDRESS))
    const entireSystemColl_3_Asset = (await activePool.getAssetBalance(erc20.address)).add(await defaultPool.getAssetBalance(erc20.address))
    th.assertIsApproximatelyEqual(entireSystemColl_3, totalCollAfterL1.add(th.applyLiquidationFee(E_coll)))
    th.assertIsApproximatelyEqual(entireSystemColl_3_Asset, totalCollAfterL1_Asset.add(th.applyLiquidationFee(E_coll_Asset)))

    // check VST gas compensation
    assert.equal((await vstToken.balanceOf(owner)).toString(), toBN(dec(400, 18)).mul(toBN(2)).toString())
  })

  it("redistribution: Trove with the majority stake withdraws. A,B,C,D open. Liq(D). A, B, C withdraw. E Enters, Liq(E). Distributes correct rewards", async () => {
    const _998_Ether = toBN('998000000000000000000')
    // A, B, C, D open troves
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll } = await openTrove({ extraVSTAmount: dec(110, 18), extraParams: { from: carol, value: _998_Ether } })
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: dennis, value: dec(1000, 'ether') } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: bob } })
    const { collateral: C_coll_Asset } = await openTrove({ asset: erc20.address, assetSent: _998_Ether, extraVSTAmount: dec(110, 18), extraParams: { from: carol } })
    const { collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, assetSent: dec(1000, 'ether'), ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: dennis } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Dennis
    const txD = await troveManager.liquidate(ZERO_ADDRESS, dennis)
    assert.isTrue(txD.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))

    const txD_Asset = await troveManager.liquidate(erc20.address, dennis)
    assert.isTrue(txD_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))

    // Expected rewards:  alice: 1 ETH, bob: 1 ETH, carol: 998 ETH (*0.995)
    const alice_ETHReward_1 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)
    const bob_ETHReward_1 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)
    const carol_ETHReward_1 = await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol)

    const alice_ETHReward_1_Asset = await troveManager.getPendingAssetReward(erc20.address, alice)
    const bob_ETHReward_1_Asset = await troveManager.getPendingAssetReward(erc20.address, bob)
    const carol_ETHReward_1_Asset = await troveManager.getPendingAssetReward(erc20.address, carol)

    //Expect 1995 ETH in system now
    const entireSystemColl_1 = (await activePool.getAssetBalance(ZERO_ADDRESS)).add(await defaultPool.getAssetBalance(ZERO_ADDRESS))
    const entireSystemColl_1_Asset = (await activePool.getAssetBalance(erc20.address)).add(await defaultPool.getAssetBalance(erc20.address))
    th.assertIsApproximatelyEqual(entireSystemColl_1, A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)))
    th.assertIsApproximatelyEqual(entireSystemColl_1_Asset, A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset).add(th.applyLiquidationFee(D_coll_Asset)))

    const totalColl = A_coll.add(B_coll).add(C_coll)
    const totalColl_Asset = A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset)

    th.assertIsApproximatelyEqual(alice_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(A_coll).div(totalColl))
    th.assertIsApproximatelyEqual(bob_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(B_coll).div(totalColl))
    th.assertIsApproximatelyEqual(carol_ETHReward_1.toString(), th.applyLiquidationFee(D_coll).mul(C_coll).div(totalColl))

    th.assertIsApproximatelyEqual(alice_ETHReward_1_Asset.toString(), th.applyLiquidationFee(D_coll_Asset).mul(A_coll_Asset).div(totalColl_Asset))
    th.assertIsApproximatelyEqual(bob_ETHReward_1_Asset.toString(), th.applyLiquidationFee(D_coll_Asset).mul(B_coll_Asset).div(totalColl_Asset))
    th.assertIsApproximatelyEqual(carol_ETHReward_1_Asset.toString(), th.applyLiquidationFee(D_coll_Asset).mul(C_coll_Asset).div(totalColl_Asset))

    /* Alice, Bob, Carol each withdraw 0.5 ETH to their troves, 
    bringing them to 1.495, 1.495, 1990.51 total coll each. */
    const withdrawnColl = toBN(dec(500, 'finney'))
    await borrowerOperations.withdrawColl(ZERO_ADDRESS, withdrawnColl, alice, alice, { from: alice })
    await borrowerOperations.withdrawColl(ZERO_ADDRESS, withdrawnColl, bob, bob, { from: bob })
    await borrowerOperations.withdrawColl(ZERO_ADDRESS, withdrawnColl, carol, carol, { from: carol })

    await borrowerOperations.withdrawColl(erc20.address, withdrawnColl, alice, alice, { from: alice })
    await borrowerOperations.withdrawColl(erc20.address, withdrawnColl, bob, bob, { from: bob })
    await borrowerOperations.withdrawColl(erc20.address, withdrawnColl, carol, carol, { from: carol })

    const alice_Coll_1 = ((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)))
      .toString()

    const bob_Coll_1 = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)))
      .toString()

    const carol_Coll_1 = ((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol)))
      .toString()

    const alice_Coll_1_Asset = ((await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, alice)))
      .toString()

    const bob_Coll_1_Asset = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, bob)))
      .toString()

    const carol_Coll_1_Asset = ((await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, carol)))
      .toString()

    const totalColl_1 = A_coll.add(B_coll).add(C_coll)
    const totalColl_1_Asset = A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset)

    assert.isAtMost(th.getDifference(alice_Coll_1, A_coll.add(th.applyLiquidationFee(D_coll).mul(A_coll).div(totalColl_1)).sub(withdrawnColl)), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_1, B_coll.add(th.applyLiquidationFee(D_coll).mul(B_coll).div(totalColl_1)).sub(withdrawnColl)), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_1, C_coll.add(th.applyLiquidationFee(D_coll).mul(C_coll).div(totalColl_1)).sub(withdrawnColl)), 1000)

    assert.isAtMost(th.getDifference(alice_Coll_1_Asset, A_coll_Asset.add(th.applyLiquidationFee(D_coll_Asset).mul(A_coll_Asset).div(totalColl_1_Asset)).sub(withdrawnColl)), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_1_Asset, B_coll_Asset.add(th.applyLiquidationFee(D_coll_Asset).mul(B_coll_Asset).div(totalColl_1_Asset)).sub(withdrawnColl)), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_1_Asset, C_coll_Asset.add(th.applyLiquidationFee(D_coll_Asset).mul(C_coll_Asset).div(totalColl_1_Asset)).sub(withdrawnColl)), 1000)

    //Expect 1993.5 ETH in system now
    const entireSystemColl_2 = (await activePool.getAssetBalance(ZERO_ADDRESS)).add(await defaultPool.getAssetBalance(ZERO_ADDRESS))
    const entireSystemColl_2_Asset = (await activePool.getAssetBalance(erc20.address)).add(await defaultPool.getAssetBalance(erc20.address))
    th.assertIsApproximatelyEqual(entireSystemColl_2, totalColl.add(th.applyLiquidationFee(D_coll)).sub(withdrawnColl.mul(toBN(3))))
    th.assertIsApproximatelyEqual(entireSystemColl_2_Asset, totalColl_Asset.add(th.applyLiquidationFee(D_coll_Asset)).sub(withdrawnColl.mul(toBN(3))))

    // E opens with another 1993.5 ETH
    const { collateral: E_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: erin, value: entireSystemColl_2 } })
    const { collateral: E_coll_Asset } = await openTrove({ asset: erc20.address, assetSent: entireSystemColl_2, ICR: toBN(dec(200, 16)), extraParams: { from: erin } })

    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Liquidate Erin
    const txE = await troveManager.liquidate(ZERO_ADDRESS, erin)
    assert.isTrue(txE.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, erin))

    const txE_Asset = await troveManager.liquidate(erc20.address, erin)
    assert.isTrue(txE_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, erin))

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

    const alice_Coll_2 = ((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice)))
      .toString()

    const bob_Coll_2 = ((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob)))
      .toString()

    const carol_Coll_2 = ((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol)))
      .toString()

    const alice_Coll_2_Asset = ((await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, alice)))
      .toString()

    const bob_Coll_2_Asset = ((await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, bob)))
      .toString()

    const carol_Coll_2_Asset = ((await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX]
      .add(await troveManager.getPendingAssetReward(erc20.address, carol)))
      .toString()

    const totalCollAfterL1 = A_coll.add(B_coll).add(C_coll).add(th.applyLiquidationFee(D_coll)).sub(withdrawnColl.mul(toBN(3)))
    const A_collAfterL1 = A_coll.add(A_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).sub(withdrawnColl)
    const expected_A_coll = A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const B_collAfterL1 = B_coll.add(B_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).sub(withdrawnColl)
    const expected_B_coll = B_collAfterL1.add(B_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))
    const C_collAfterL1 = C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_coll.add(B_coll).add(C_coll))).sub(withdrawnColl)
    const expected_C_coll = C_collAfterL1.add(C_collAfterL1.mul(th.applyLiquidationFee(E_coll)).div(totalCollAfterL1))

    const totalCollAfterL1_Asset = A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset).add(th.applyLiquidationFee(D_coll_Asset)).sub(withdrawnColl.mul(toBN(3)))
    const A_collAfterL1_Asset = A_coll_Asset.add(A_coll_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset))).sub(withdrawnColl)
    const expected_A_coll_Asset = A_collAfterL1_Asset.add(A_collAfterL1_Asset.mul(th.applyLiquidationFee(E_coll_Asset)).div(totalCollAfterL1_Asset))
    const B_collAfterL1_Asset = B_coll_Asset.add(B_coll_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset))).sub(withdrawnColl)
    const expected_B_coll_Asset = B_collAfterL1_Asset.add(B_collAfterL1_Asset.mul(th.applyLiquidationFee(E_coll_Asset)).div(totalCollAfterL1))
    const C_collAfterL1_Asset = C_coll_Asset.add(C_coll_Asset.mul(th.applyLiquidationFee(D_coll_Asset)).div(A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset))).sub(withdrawnColl)
    const expected_C_coll_Asset = C_collAfterL1_Asset.add(C_collAfterL1_Asset.mul(th.applyLiquidationFee(E_coll_Asset)).div(totalCollAfterL1_Asset))

    assert.isAtMost(th.getDifference(alice_Coll_2, expected_A_coll), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_2, expected_B_coll), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_2, expected_C_coll), 1000)

    assert.isAtMost(th.getDifference(alice_Coll_2_Asset, expected_A_coll_Asset), 1000)
    assert.isAtMost(th.getDifference(bob_Coll_2_Asset, expected_B_coll_Asset), 1000)
    assert.isAtMost(th.getDifference(carol_Coll_2_Asset, expected_C_coll_Asset), 1000)

    //Expect 3977.0325 ETH in system now
    const entireSystemColl_3 = (await activePool.getAssetBalance(ZERO_ADDRESS)).add(await defaultPool.getAssetBalance(ZERO_ADDRESS))
    const entireSystemColl_3_Asset = (await activePool.getAssetBalance(erc20.address)).add(await defaultPool.getAssetBalance(erc20.address))
    th.assertIsApproximatelyEqual(entireSystemColl_3, totalCollAfterL1.add(th.applyLiquidationFee(E_coll)))
    th.assertIsApproximatelyEqual(entireSystemColl_3_Asset, totalCollAfterL1_Asset.add(th.applyLiquidationFee(E_coll_Asset)))

    // check VST gas compensation
    assert.equal((await vstToken.balanceOf(owner)).toString(), toBN(dec(400, 18)).mul(toBN(2)).toString())
  })

  // For calculations of correct values used in test, see scenario 1:
  // https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution, all operations: A,B,C open. Liq(A). D opens. B adds, C withdraws. Liq(B). E & F open. D adds. Liq(F). Distributes correct rewards", async () => {
    // A, B, C open troves
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: alice } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: bob } })
    const { collateral: C_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: carol } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: alice } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: bob } })
    const { collateral: C_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: carol } })

    // Price drops to 1 $/E
    await priceFeed.setPrice(dec(1, 18))

    // Liquidate A
    const txA = await troveManager.liquidate(ZERO_ADDRESS, alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))

    const txA_Asset = await troveManager.liquidate(erc20.address, alice)
    assert.isTrue(txA_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, alice))

    // Check rewards for B and C
    const B_pendingRewardsAfterL1 = th.applyLiquidationFee(A_coll).mul(B_coll).div(B_coll.add(C_coll))
    const C_pendingRewardsAfterL1 = th.applyLiquidationFee(A_coll).mul(C_coll).div(B_coll.add(C_coll))

    const B_pendingRewardsAfterL1_Asset = th.applyLiquidationFee(A_coll_Asset).mul(B_coll_Asset).div(B_coll_Asset.add(C_coll_Asset))
    const C_pendingRewardsAfterL1_Asset = th.applyLiquidationFee(A_coll_Asset).mul(C_coll_Asset).div(B_coll_Asset.add(C_coll_Asset))

    assert.isAtMost(th.getDifference(await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob), B_pendingRewardsAfterL1), 1000000)
    assert.isAtMost(th.getDifference(await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol), C_pendingRewardsAfterL1), 1000000)

    assert.isAtMost(th.getDifference(await troveManager.getPendingAssetReward(erc20.address, bob), B_pendingRewardsAfterL1_Asset), 1000000)
    assert.isAtMost(th.getDifference(await troveManager.getPendingAssetReward(erc20.address, carol), C_pendingRewardsAfterL1_Asset), 1000000)

    const totalStakesSnapshotAfterL1 = B_coll.add(C_coll)
    const totalCollateralSnapshotAfterL1 = totalStakesSnapshotAfterL1.add(th.applyLiquidationFee(A_coll))

    const totalStakesSnapshotAfterL1_Asset = B_coll_Asset.add(C_coll_Asset)
    const totalCollateralSnapshotAfterL1_Asset = totalStakesSnapshotAfterL1_Asset.add(th.applyLiquidationFee(A_coll_Asset))
    th.assertIsApproximatelyEqual(await troveManager.totalStakesSnapshot(ZERO_ADDRESS), totalStakesSnapshotAfterL1)
    th.assertIsApproximatelyEqual(await troveManager.totalCollateralSnapshot(ZERO_ADDRESS), totalCollateralSnapshotAfterL1)
    th.assertIsApproximatelyEqual(await troveManager.totalStakesSnapshot(erc20.address), totalStakesSnapshotAfterL1_Asset)
    th.assertIsApproximatelyEqual(await troveManager.totalCollateralSnapshot(erc20.address), totalCollateralSnapshotAfterL1_Asset)

    // Price rises to 1000
    await priceFeed.setPrice(dec(1000, 18))

    // D opens trove
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: dennis } })
    const { collateral: D_coll_Asset, totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: dennis } })

    //Bob adds 1 ETH to his trove
    const B_addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(ZERO_ADDRESS, 0, bob, bob, { from: bob, value: B_addedColl })
    await borrowerOperations.addColl(erc20.address, B_addedColl, bob, bob, { from: bob })

    //Carol  withdraws 1 ETH from her trove
    const C_withdrawnColl = toBN(dec(1, 'ether'))
    await borrowerOperations.withdrawColl(ZERO_ADDRESS, C_withdrawnColl, carol, carol, { from: carol })
    await borrowerOperations.withdrawColl(erc20.address, C_withdrawnColl, carol, carol, { from: carol })

    const B_collAfterL1 = B_coll.add(B_pendingRewardsAfterL1).add(B_addedColl)
    const C_collAfterL1 = C_coll.add(C_pendingRewardsAfterL1).sub(C_withdrawnColl)

    const B_collAfterL1_Asset = B_coll_Asset.add(B_pendingRewardsAfterL1_Asset).add(B_addedColl)
    const C_collAfterL1_Asset = C_coll_Asset.add(C_pendingRewardsAfterL1_Asset).sub(C_withdrawnColl)

    // Price drops
    await priceFeed.setPrice(dec(1, 18))

    // Liquidate B
    const txB = await troveManager.liquidate(ZERO_ADDRESS, bob)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))

    const txB_Asset = await troveManager.liquidate(erc20.address, bob)
    assert.isTrue(txB_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))

    // Check rewards for C and D
    const C_pendingRewardsAfterL2 = C_collAfterL1.mul(th.applyLiquidationFee(B_collAfterL1)).div(C_collAfterL1.add(D_coll))
    const D_pendingRewardsAfterL2 = D_coll.mul(th.applyLiquidationFee(B_collAfterL1)).div(C_collAfterL1.add(D_coll))

    const C_pendingRewardsAfterL2_Asset = C_collAfterL1_Asset.mul(th.applyLiquidationFee(B_collAfterL1_Asset)).div(C_collAfterL1_Asset.add(D_coll_Asset))
    const D_pendingRewardsAfterL2_Asset = D_coll_Asset.mul(th.applyLiquidationFee(B_collAfterL1_Asset)).div(C_collAfterL1_Asset.add(D_coll_Asset))

    assert.isAtMost(th.getDifference(await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol), C_pendingRewardsAfterL2), 1000000)
    assert.isAtMost(th.getDifference(await troveManager.getPendingAssetReward(ZERO_ADDRESS, dennis), D_pendingRewardsAfterL2), 1000000)

    assert.isAtMost(th.getDifference(await troveManager.getPendingAssetReward(erc20.address, carol), C_pendingRewardsAfterL2_Asset), 1000000)
    assert.isAtMost(th.getDifference(await troveManager.getPendingAssetReward(erc20.address, dennis), D_pendingRewardsAfterL2_Asset), 1000000)

    const totalStakesSnapshotAfterL2 = totalStakesSnapshotAfterL1.add(D_coll.mul(totalStakesSnapshotAfterL1).div(totalCollateralSnapshotAfterL1)).sub(B_coll).sub(C_withdrawnColl.mul(totalStakesSnapshotAfterL1).div(totalCollateralSnapshotAfterL1))
    const defaultedAmountAfterL2 = th.applyLiquidationFee(B_coll.add(B_addedColl).add(B_pendingRewardsAfterL1)).add(C_pendingRewardsAfterL1)
    const totalCollateralSnapshotAfterL2 = C_coll.sub(C_withdrawnColl).add(D_coll).add(defaultedAmountAfterL2)

    const totalStakesSnapshotAfterL2_Asset = totalStakesSnapshotAfterL1_Asset.add(D_coll_Asset.mul(totalStakesSnapshotAfterL1_Asset).div(totalCollateralSnapshotAfterL1_Asset)).sub(B_coll_Asset).sub(C_withdrawnColl.mul(totalStakesSnapshotAfterL1_Asset).div(totalCollateralSnapshotAfterL1_Asset))
    const defaultedAmountAfterL2_Asset = th.applyLiquidationFee(B_coll_Asset.add(B_addedColl).add(B_pendingRewardsAfterL1_Asset)).add(C_pendingRewardsAfterL1_Asset)
    const totalCollateralSnapshotAfterL2_Asset = C_coll.sub(C_withdrawnColl).add(D_coll_Asset).add(defaultedAmountAfterL2_Asset)

    th.assertIsApproximatelyEqual(await troveManager.totalStakesSnapshot(ZERO_ADDRESS), totalStakesSnapshotAfterL2)
    th.assertIsApproximatelyEqual(await troveManager.totalCollateralSnapshot(ZERO_ADDRESS), totalCollateralSnapshotAfterL2)

    th.assertIsApproximatelyEqual(await troveManager.totalStakesSnapshot(erc20.address), totalStakesSnapshotAfterL2_Asset)
    th.assertIsApproximatelyEqual(await troveManager.totalCollateralSnapshot(erc20.address), totalCollateralSnapshotAfterL2_Asset)

    // Price rises to 1000
    await priceFeed.setPrice(dec(1000, 18))

    // E and F open troves
    const { collateral: E_coll, totalDebt: E_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: erin } })
    const { collateral: F_coll, totalDebt: F_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: freddy } })

    const { collateral: E_coll_Asset, totalDebt: E_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: erin } })
    const { collateral: F_coll_Asset, totalDebt: F_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(110, 18), extraParams: { from: freddy } })

    // D tops up
    const D_addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(ZERO_ADDRESS, 0, dennis, dennis, { from: dennis, value: D_addedColl })
    await borrowerOperations.addColl(erc20.address, D_addedColl, dennis, dennis, { from: dennis })

    // Price drops to 1
    await priceFeed.setPrice(dec(1, 18))

    // Liquidate F
    const txF = await troveManager.liquidate(ZERO_ADDRESS, freddy)
    assert.isTrue(txF.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, freddy))

    const txF_Asset = await troveManager.liquidate(erc20.address, freddy)
    assert.isTrue(txF_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, freddy))

    // Grab remaining troves' collateral
    const carol_rawColl = (await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_COLL_INDEX].toString()
    const carol_pendingETHReward = (await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol)).toString()

    const dennis_rawColl = (await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_COLL_INDEX].toString()
    const dennis_pendingETHReward = (await troveManager.getPendingAssetReward(ZERO_ADDRESS, dennis)).toString()

    const erin_rawColl = (await troveManager.Troves(erin, ZERO_ADDRESS))[th.TROVE_COLL_INDEX].toString()
    const erin_pendingETHReward = (await troveManager.getPendingAssetReward(ZERO_ADDRESS, erin)).toString()

    const carol_rawColl_Asset = (await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX].toString()
    const carol_pendingETHReward_Asset = (await troveManager.getPendingAssetReward(erc20.address, carol)).toString()

    const dennis_rawColl_Asset = (await troveManager.Troves(dennis, erc20.address))[th.TROVE_COLL_INDEX].toString()
    const dennis_pendingETHReward_Asset = (await troveManager.getPendingAssetReward(erc20.address, dennis)).toString()

    const erin_rawColl_Asset = (await troveManager.Troves(erin, erc20.address))[th.TROVE_COLL_INDEX].toString()
    const erin_pendingETHReward_Asset = (await troveManager.getPendingAssetReward(erc20.address, erin)).toString()

    // Check raw collateral of C, D, E
    const C_collAfterL2 = C_collAfterL1.add(C_pendingRewardsAfterL2)
    const D_collAfterL2 = D_coll.add(D_pendingRewardsAfterL2).add(D_addedColl)
    const totalCollForL3 = C_collAfterL2.add(D_collAfterL2).add(E_coll)
    const C_collAfterL3 = C_collAfterL2.add(C_collAfterL2.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))
    const D_collAfterL3 = D_collAfterL2.add(D_collAfterL2.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))
    const E_collAfterL3 = E_coll.add(E_coll.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))

    const C_collAfterL2_Asset = C_collAfterL1_Asset.add(C_pendingRewardsAfterL2_Asset)
    const D_collAfterL2_Asset = D_coll_Asset.add(D_pendingRewardsAfterL2_Asset).add(D_addedColl)
    const totalCollForL3_Asset = C_collAfterL2_Asset.add(D_collAfterL2_Asset).add(E_coll_Asset)
    const C_collAfterL3_Asset = C_collAfterL2_Asset.add(C_collAfterL2_Asset.mul(th.applyLiquidationFee(F_coll_Asset)).div(totalCollForL3_Asset))
    const D_collAfterL3_Asset = D_collAfterL2_Asset.add(D_collAfterL2_Asset.mul(th.applyLiquidationFee(F_coll_Asset)).div(totalCollForL3_Asset))
    const E_collAfterL3_Asset = E_coll_Asset.add(E_coll_Asset.mul(th.applyLiquidationFee(F_coll_Asset)).div(totalCollForL3_Asset))

    assert.isAtMost(th.getDifference(carol_rawColl, C_collAfterL1), 1000)
    assert.isAtMost(th.getDifference(dennis_rawColl, D_collAfterL2), 1000000)
    assert.isAtMost(th.getDifference(erin_rawColl, E_coll), 1000)

    assert.isAtMost(th.getDifference(carol_rawColl_Asset, C_collAfterL1_Asset), 1000)
    assert.isAtMost(th.getDifference(dennis_rawColl_Asset, D_collAfterL2_Asset), 1000000)
    assert.isAtMost(th.getDifference(erin_rawColl_Asset, E_coll_Asset), 1000)

    // Check pending ETH rewards of C, D, E
    assert.isAtMost(th.getDifference(carol_pendingETHReward, C_collAfterL3.sub(C_collAfterL1)), 1000000)
    assert.isAtMost(th.getDifference(dennis_pendingETHReward, D_collAfterL3.sub(D_collAfterL2)), 1000000)
    assert.isAtMost(th.getDifference(erin_pendingETHReward, E_collAfterL3.sub(E_coll)), 1000000)

    assert.isAtMost(th.getDifference(carol_pendingETHReward_Asset, C_collAfterL3_Asset.sub(C_collAfterL1_Asset)), 1000000)
    assert.isAtMost(th.getDifference(dennis_pendingETHReward_Asset, D_collAfterL3_Asset.sub(D_collAfterL2_Asset)), 1000000)
    assert.isAtMost(th.getDifference(erin_pendingETHReward_Asset, E_collAfterL3_Asset.sub(E_coll_Asset)), 1000000)

    // Check systemic collateral
    const activeColl = (await activePool.getAssetBalance(ZERO_ADDRESS)).toString()
    const defaultColl = (await defaultPool.getAssetBalance(ZERO_ADDRESS)).toString()

    const activeColl_Asset = (await activePool.getAssetBalance(erc20.address)).toString()
    const defaultColl_Asset = (await defaultPool.getAssetBalance(erc20.address)).toString()

    assert.isAtMost(th.getDifference(activeColl, C_collAfterL1.add(D_collAfterL2.add(E_coll))), 1000000)
    assert.isAtMost(th.getDifference(defaultColl, C_collAfterL3.sub(C_collAfterL1).add(D_collAfterL3.sub(D_collAfterL2)).add(E_collAfterL3.sub(E_coll))), 1000000)
    assert.isAtMost(th.getDifference(activeColl_Asset, C_collAfterL1_Asset.add(D_collAfterL2_Asset.add(E_coll_Asset))), 1000000)
    assert.isAtMost(th.getDifference(defaultColl_Asset, C_collAfterL3_Asset.sub(C_collAfterL1_Asset).add(D_collAfterL3_Asset.sub(D_collAfterL2_Asset)).add(E_collAfterL3_Asset.sub(E_coll_Asset))), 1000000)

    // Check system snapshots
    const totalStakesSnapshotAfterL3 = totalStakesSnapshotAfterL2.add(D_addedColl.add(E_coll).mul(totalStakesSnapshotAfterL2).div(totalCollateralSnapshotAfterL2))
    const totalCollateralSnapshotAfterL3 = C_coll.sub(C_withdrawnColl).add(D_coll).add(D_addedColl).add(E_coll).add(defaultedAmountAfterL2).add(th.applyLiquidationFee(F_coll))
    const totalStakesSnapshot = (await troveManager.totalStakesSnapshot(ZERO_ADDRESS)).toString()
    const totalCollateralSnapshot = (await troveManager.totalCollateralSnapshot(ZERO_ADDRESS)).toString()

    const totalStakesSnapshotAfterL3_Asset = totalStakesSnapshotAfterL2_Asset.add(D_addedColl.add(E_coll_Asset).mul(totalStakesSnapshotAfterL2_Asset).div(totalCollateralSnapshotAfterL2_Asset))
    const totalCollateralSnapshotAfterL3_Asset = C_coll_Asset.sub(C_withdrawnColl).add(D_coll_Asset).add(D_addedColl).add(E_coll_Asset).add(defaultedAmountAfterL2_Asset).add(th.applyLiquidationFee(F_coll_Asset))
    const totalStakesSnapshot_Asset = (await troveManager.totalStakesSnapshot(erc20.address)).toString()
    const totalCollateralSnapshot_Asset = (await troveManager.totalCollateralSnapshot(erc20.address)).toString()

    th.assertIsApproximatelyEqual(totalStakesSnapshot, totalStakesSnapshotAfterL3)
    th.assertIsApproximatelyEqual(totalCollateralSnapshot, totalCollateralSnapshotAfterL3)
    th.assertIsApproximatelyEqual(totalStakesSnapshot_Asset, totalStakesSnapshotAfterL3_Asset)
    th.assertIsApproximatelyEqual(totalCollateralSnapshot_Asset, totalCollateralSnapshotAfterL3_Asset)

    // check VST gas compensation
    assert.equal((await vstToken.balanceOf(owner)).toString(), toBN(dec(600, 18)).mul(toBN(2)).toString())
  })

  // For calculations of correct values used in test, see scenario 2:
  // https://docs.google.com/spreadsheets/d/1F5p3nZy749K5jwO-bwJeTsRoY7ewMfWIQ3QHtokxqzo/edit?usp=sharing
  it("redistribution, all operations: A,B,C open. Liq(A). D opens. B adds, C withdraws. Liq(B). E & F open. D adds. Liq(F). Varying coll. Distributes correct rewards", async () => {
    /* A, B, C open troves.
    A: 450 ETH
    B: 8901 ETH
    C: 23.902 ETH
    */
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(90000, 16)), extraParams: { from: alice, value: toBN('450000000000000000000') } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(1800000, 16)), extraParams: { from: bob, value: toBN('8901000000000000000000') } })
    const { collateral: C_coll } = await openTrove({ ICR: toBN(dec(4600, 16)), extraParams: { from: carol, value: toBN('23902000000000000000') } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, assetSent: toBN('450000000000000000000'), ICR: toBN(dec(90000, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, assetSent: toBN('8901000000000000000000'), ICR: toBN(dec(1800000, 16)), extraParams: { from: bob } })
    const { collateral: C_coll_Asset } = await openTrove({ asset: erc20.address, assetSent: toBN('23902000000000000000'), ICR: toBN(dec(4600, 16)), extraParams: { from: carol } })

    // Price drops 
    await priceFeed.setPrice('1')

    // Liquidate A
    const txA = await troveManager.liquidate(ZERO_ADDRESS, alice)
    assert.isTrue(txA.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))

    const txA_Asset = await troveManager.liquidate(erc20.address, alice)
    assert.isTrue(txA_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, alice))

    // Check rewards for B and C
    const B_pendingRewardsAfterL1 = th.applyLiquidationFee(A_coll).mul(B_coll).div(B_coll.add(C_coll))
    const C_pendingRewardsAfterL1 = th.applyLiquidationFee(A_coll).mul(C_coll).div(B_coll.add(C_coll))

    const B_pendingRewardsAfterL1_Asset = th.applyLiquidationFee(A_coll_Asset).mul(B_coll_Asset).div(B_coll_Asset.add(C_coll_Asset))
    const C_pendingRewardsAfterL1_Asset = th.applyLiquidationFee(A_coll_Asset).mul(C_coll_Asset).div(B_coll_Asset.add(C_coll_Asset))

    assert.isAtMost(th.getDifference(await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob), B_pendingRewardsAfterL1), 1000000)
    assert.isAtMost(th.getDifference(await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol), C_pendingRewardsAfterL1), 1000000)

    assert.isAtMost(th.getDifference(await troveManager.getPendingAssetReward(erc20.address, bob), B_pendingRewardsAfterL1_Asset), 1000000)
    assert.isAtMost(th.getDifference(await troveManager.getPendingAssetReward(erc20.address, carol), C_pendingRewardsAfterL1_Asset), 1000000)

    const totalStakesSnapshotAfterL1 = B_coll.add(C_coll)
    const totalStakesSnapshotAfterL1_Asset = B_coll_Asset.add(C_coll_Asset)
    const totalCollateralSnapshotAfterL1 = totalStakesSnapshotAfterL1.add(th.applyLiquidationFee(A_coll))
    const totalCollateralSnapshotAfterL1_Asset = totalStakesSnapshotAfterL1_Asset.add(th.applyLiquidationFee(A_coll_Asset))
    th.assertIsApproximatelyEqual(await troveManager.totalStakesSnapshot(ZERO_ADDRESS), totalStakesSnapshotAfterL1)
    th.assertIsApproximatelyEqual(await troveManager.totalCollateralSnapshot(ZERO_ADDRESS), totalCollateralSnapshotAfterL1)

    th.assertIsApproximatelyEqual(await troveManager.totalStakesSnapshot(erc20.address), totalStakesSnapshotAfterL1_Asset)
    th.assertIsApproximatelyEqual(await troveManager.totalCollateralSnapshot(erc20.address), totalCollateralSnapshotAfterL1_Asset)

    // Price rises 
    await priceFeed.setPrice(dec(1, 27))

    // D opens trove: 0.035 ETH
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openTrove({ extraVSTAmount: dec(100, 18), extraParams: { from: dennis, value: toBN(dec(35, 15)) } })
    const { collateral: D_coll_Asset, totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, assetSent: toBN(dec(35, 15)), extraVSTAmount: dec(100, 18), extraParams: { from: dennis } })

    // Bob adds 11.33909 ETH to his trove
    const B_addedColl = toBN('11339090000000000000')
    await borrowerOperations.addColl(ZERO_ADDRESS, 0, bob, bob, { from: bob, value: B_addedColl })
    await borrowerOperations.addColl(erc20.address, B_addedColl, bob, bob, { from: bob })

    // Carol withdraws 15 ETH from her trove
    const C_withdrawnColl = toBN(dec(15, 'ether'))
    await borrowerOperations.withdrawColl(ZERO_ADDRESS, C_withdrawnColl, carol, carol, { from: carol })
    await borrowerOperations.withdrawColl(erc20.address, C_withdrawnColl, carol, carol, { from: carol })

    const B_collAfterL1 = B_coll.add(B_pendingRewardsAfterL1).add(B_addedColl)
    const C_collAfterL1 = C_coll.add(C_pendingRewardsAfterL1).sub(C_withdrawnColl)

    const B_collAfterL1_Asset = B_coll_Asset.add(B_pendingRewardsAfterL1_Asset).add(B_addedColl)
    const C_collAfterL1_Asset = C_coll_Asset.add(C_pendingRewardsAfterL1_Asset).sub(C_withdrawnColl)

    // Price drops
    await priceFeed.setPrice('1')

    // Liquidate B
    const txB = await troveManager.liquidate(ZERO_ADDRESS, bob)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))

    const txB_Asset = await troveManager.liquidate(erc20.address, bob)
    assert.isTrue(txB_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))

    // Check rewards for C and D
    const C_pendingRewardsAfterL2 = C_collAfterL1.mul(th.applyLiquidationFee(B_collAfterL1)).div(C_collAfterL1.add(D_coll))
    const D_pendingRewardsAfterL2 = D_coll.mul(th.applyLiquidationFee(B_collAfterL1)).div(C_collAfterL1.add(D_coll))
    const C_collAfterL2 = C_collAfterL1.add(C_pendingRewardsAfterL2)

    const C_pendingRewardsAfterL2_Asset = C_collAfterL1_Asset.mul(th.applyLiquidationFee(B_collAfterL1_Asset)).div(C_collAfterL1_Asset.add(D_coll_Asset))
    const D_pendingRewardsAfterL2_Asset = D_coll_Asset.mul(th.applyLiquidationFee(B_collAfterL1_Asset)).div(C_collAfterL1_Asset.add(D_coll_Asset))
    const C_collAfterL2_Asset = C_collAfterL1_Asset.add(C_pendingRewardsAfterL2_Asset)

    assert.isAtMost(th.getDifference(await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol), C_pendingRewardsAfterL2), 10000000)
    assert.isAtMost(th.getDifference(await troveManager.getPendingAssetReward(ZERO_ADDRESS, dennis), D_pendingRewardsAfterL2), 10000000)

    assert.isAtMost(th.getDifference(await troveManager.getPendingAssetReward(erc20.address, carol), C_pendingRewardsAfterL2_Asset), 10000000)
    assert.isAtMost(th.getDifference(await troveManager.getPendingAssetReward(erc20.address, dennis), D_pendingRewardsAfterL2_Asset), 10000000)

    const totalStakesSnapshotAfterL2 = totalStakesSnapshotAfterL1.add(D_coll.mul(totalStakesSnapshotAfterL1).div(totalCollateralSnapshotAfterL1)).sub(B_coll).sub(C_withdrawnColl.mul(totalStakesSnapshotAfterL1).div(totalCollateralSnapshotAfterL1))
    const defaultedAmountAfterL2 = th.applyLiquidationFee(B_coll.add(B_addedColl).add(B_pendingRewardsAfterL1)).add(C_pendingRewardsAfterL1)
    const totalCollateralSnapshotAfterL2 = C_coll.sub(C_withdrawnColl).add(D_coll).add(defaultedAmountAfterL2)

    const totalStakesSnapshotAfterL2_Asset = totalStakesSnapshotAfterL1_Asset.add(D_coll_Asset.mul(totalStakesSnapshotAfterL1_Asset).div(totalCollateralSnapshotAfterL1_Asset)).sub(B_coll_Asset).sub(C_withdrawnColl.mul(totalStakesSnapshotAfterL1_Asset).div(totalCollateralSnapshotAfterL1_Asset))
    const defaultedAmountAfterL2_Asset = th.applyLiquidationFee(B_coll_Asset.add(B_addedColl).add(B_pendingRewardsAfterL1_Asset)).add(C_pendingRewardsAfterL1_Asset)
    const totalCollateralSnapshotAfterL2_Asset = C_coll_Asset.sub(C_withdrawnColl).add(D_coll_Asset).add(defaultedAmountAfterL2_Asset)

    th.assertIsApproximatelyEqual(await troveManager.totalStakesSnapshot(ZERO_ADDRESS), totalStakesSnapshotAfterL2)
    th.assertIsApproximatelyEqual(await troveManager.totalCollateralSnapshot(ZERO_ADDRESS), totalCollateralSnapshotAfterL2)

    th.assertIsApproximatelyEqual(await troveManager.totalStakesSnapshot(erc20.address), totalStakesSnapshotAfterL2_Asset)
    th.assertIsApproximatelyEqual(await troveManager.totalCollateralSnapshot(erc20.address), totalCollateralSnapshotAfterL2_Asset)

    // Price rises 
    await priceFeed.setPrice(dec(1, 27))

    /* E and F open troves.
    E: 10000 ETH
    F: 0.0007 ETH
    */
    const { collateral: E_coll, totalDebt: E_totalDebt } = await openTrove({ extraVSTAmount: dec(100, 18), extraParams: { from: erin, value: toBN(dec(1, 22)) } })
    const { collateral: F_coll, totalDebt: F_totalDebt } = await openTrove({ extraVSTAmount: dec(100, 18), extraParams: { from: freddy, value: toBN('700000000000000') } })

    const { collateral: E_coll_Asset, totalDebt: E_totalDebt_Asset } = await openTrove({ asset: erc20.address, assetSent: toBN(dec(1, 22)), extraVSTAmount: dec(100, 18), extraParams: { from: erin } })
    const { collateral: F_coll_Asset, totalDebt: F_totalDebt_Asset } = await openTrove({ asset: erc20.address, assetSent: toBN('700000000000000'), extraVSTAmount: dec(100, 18), extraParams: { from: freddy } })

    // D tops up
    const D_addedColl = toBN(dec(1, 'ether'))
    await borrowerOperations.addColl(ZERO_ADDRESS, 0, dennis, dennis, { from: dennis, value: D_addedColl })
    await borrowerOperations.addColl(erc20.address, D_addedColl, dennis, dennis, { from: dennis })

    const D_collAfterL2 = D_coll.add(D_pendingRewardsAfterL2).add(D_addedColl)
    const D_collAfterL2_Asset = D_coll_Asset.add(D_pendingRewardsAfterL2_Asset).add(D_addedColl)

    // Price drops 
    await priceFeed.setPrice('1')

    // Liquidate F
    const txF = await troveManager.liquidate(ZERO_ADDRESS, freddy)
    assert.isTrue(txF.receipt.status)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, freddy))

    const txF_Asset = await troveManager.liquidate(erc20.address, freddy)
    assert.isTrue(txF_Asset.receipt.status)
    assert.isFalse(await sortedTroves.contains(erc20.address, freddy))

    // Grab remaining troves' collateral
    const carol_rawColl = (await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_COLL_INDEX].toString()
    const carol_pendingETHReward = (await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol)).toString()
    const carol_Stake = (await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STAKE_INDEX].toString()

    const dennis_rawColl = (await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_COLL_INDEX].toString()
    const dennis_pendingETHReward = (await troveManager.getPendingAssetReward(ZERO_ADDRESS, dennis)).toString()
    const dennis_Stake = (await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_STAKE_INDEX].toString()

    const erin_rawColl = (await troveManager.Troves(erin, ZERO_ADDRESS))[th.TROVE_COLL_INDEX].toString()
    const erin_pendingETHReward = (await troveManager.getPendingAssetReward(ZERO_ADDRESS, erin)).toString()
    const erin_Stake = (await troveManager.Troves(erin, ZERO_ADDRESS))[th.TROVE_STAKE_INDEX].toString()

    const carol_rawColl_Asset = (await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX].toString()
    const carol_pendingETHReward_Asset = (await troveManager.getPendingAssetReward(erc20.address, carol)).toString()
    const carol_Stake_Asset = (await troveManager.Troves(carol, erc20.address))[th.TROVE_STAKE_INDEX].toString()

    const dennis_rawColl_Asset = (await troveManager.Troves(dennis, erc20.address))[th.TROVE_COLL_INDEX].toString()
    const dennis_pendingETHReward_Asset = (await troveManager.getPendingAssetReward(erc20.address, dennis)).toString()
    const dennis_Stake_Asset = (await troveManager.Troves(dennis, erc20.address))[th.TROVE_STAKE_INDEX].toString()

    const erin_rawColl_Asset = (await troveManager.Troves(erin, erc20.address))[th.TROVE_COLL_INDEX].toString()
    const erin_pendingETHReward_Asset = (await troveManager.getPendingAssetReward(erc20.address, erin)).toString()
    const erin_Stake_Asset = (await troveManager.Troves(erin, erc20.address))[th.TROVE_STAKE_INDEX].toString()

    // Check raw collateral of C, D, E
    const totalCollForL3 = C_collAfterL2.add(D_collAfterL2).add(E_coll)
    const C_collAfterL3 = C_collAfterL2.add(C_collAfterL2.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))
    const D_collAfterL3 = D_collAfterL2.add(D_collAfterL2.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))
    const E_collAfterL3 = E_coll.add(E_coll.mul(th.applyLiquidationFee(F_coll)).div(totalCollForL3))

    const totalCollForL3_Asset = C_collAfterL2_Asset.add(D_collAfterL2_Asset).add(E_coll_Asset)
    const C_collAfterL3_Asset = C_collAfterL2_Asset.add(C_collAfterL2_Asset.mul(th.applyLiquidationFee(F_coll_Asset)).div(totalCollForL3_Asset))
    const D_collAfterL3_Asset = D_collAfterL2_Asset.add(D_collAfterL2_Asset.mul(th.applyLiquidationFee(F_coll_Asset)).div(totalCollForL3_Asset))
    const E_collAfterL3_Asset = E_coll_Asset.add(E_coll_Asset.mul(th.applyLiquidationFee(F_coll_Asset)).div(totalCollForL3_Asset))

    assert.isAtMost(th.getDifference(carol_rawColl, C_collAfterL1), 1000)
    assert.isAtMost(th.getDifference(dennis_rawColl, D_collAfterL2), 1000000)
    assert.isAtMost(th.getDifference(erin_rawColl, E_coll), 1000)

    assert.isAtMost(th.getDifference(carol_rawColl_Asset, C_collAfterL1_Asset), 1000)
    assert.isAtMost(th.getDifference(dennis_rawColl_Asset, D_collAfterL2_Asset), 1000000)
    assert.isAtMost(th.getDifference(erin_rawColl_Asset, E_coll_Asset), 1000)

    // Check pending ETH rewards of C, D, E
    assert.isAtMost(th.getDifference(carol_pendingETHReward, C_collAfterL3.sub(C_collAfterL1)), 1000000)
    assert.isAtMost(th.getDifference(dennis_pendingETHReward, D_collAfterL3.sub(D_collAfterL2)), 1000000)
    assert.isAtMost(th.getDifference(erin_pendingETHReward, E_collAfterL3.sub(E_coll)), 1000000)

    assert.isAtMost(th.getDifference(carol_pendingETHReward_Asset, C_collAfterL3_Asset.sub(C_collAfterL1_Asset)), 1000000)
    assert.isAtMost(th.getDifference(dennis_pendingETHReward_Asset, D_collAfterL3_Asset.sub(D_collAfterL2_Asset)), 1000000)
    assert.isAtMost(th.getDifference(erin_pendingETHReward_Asset, E_collAfterL3_Asset.sub(E_coll_Asset)), 1000000)

    // Check systemic collateral
    const activeColl = (await activePool.getAssetBalance(ZERO_ADDRESS)).toString()
    const defaultColl = (await defaultPool.getAssetBalance(ZERO_ADDRESS)).toString()

    const activeColl_Asset = (await activePool.getAssetBalance(erc20.address)).toString()
    const defaultColl_Asset = (await defaultPool.getAssetBalance(erc20.address)).toString()

    assert.isAtMost(th.getDifference(activeColl, C_collAfterL1.add(D_collAfterL2.add(E_coll))), 1000000)
    assert.isAtMost(th.getDifference(defaultColl, C_collAfterL3.sub(C_collAfterL1).add(D_collAfterL3.sub(D_collAfterL2)).add(E_collAfterL3.sub(E_coll))), 1000000)

    assert.isAtMost(th.getDifference(activeColl_Asset, C_collAfterL1_Asset.add(D_collAfterL2_Asset.add(E_coll_Asset))), 1000000)
    assert.isAtMost(th.getDifference(defaultColl_Asset, C_collAfterL3_Asset.sub(C_collAfterL1_Asset).add(D_collAfterL3_Asset.sub(D_collAfterL2_Asset)).add(E_collAfterL3_Asset.sub(E_coll_Asset))), 1000000)

    // Check system snapshots
    const totalStakesSnapshotAfterL3 = totalStakesSnapshotAfterL2.add(D_addedColl.add(E_coll).mul(totalStakesSnapshotAfterL2).div(totalCollateralSnapshotAfterL2))
    const totalCollateralSnapshotAfterL3 = C_coll.sub(C_withdrawnColl).add(D_coll).add(D_addedColl).add(E_coll).add(defaultedAmountAfterL2).add(th.applyLiquidationFee(F_coll))
    const totalStakesSnapshot = (await troveManager.totalStakesSnapshot(ZERO_ADDRESS)).toString()
    const totalCollateralSnapshot = (await troveManager.totalCollateralSnapshot(ZERO_ADDRESS)).toString()

    const totalStakesSnapshotAfterL3_Asset = totalStakesSnapshotAfterL2_Asset.add(D_addedColl.add(E_coll_Asset).mul(totalStakesSnapshotAfterL2_Asset).div(totalCollateralSnapshotAfterL2_Asset))
    const totalCollateralSnapshotAfterL3_Asset = C_coll_Asset.sub(C_withdrawnColl).add(D_coll_Asset).add(D_addedColl).add(E_coll_Asset).add(defaultedAmountAfterL2_Asset).add(th.applyLiquidationFee(F_coll_Asset))
    const totalStakesSnapshot_Asset = (await troveManager.totalStakesSnapshot(erc20.address)).toString()
    const totalCollateralSnapshot_Asset = (await troveManager.totalCollateralSnapshot(erc20.address)).toString()

    th.assertIsApproximatelyEqual(totalStakesSnapshot, totalStakesSnapshotAfterL3)
    th.assertIsApproximatelyEqual(totalCollateralSnapshot, totalCollateralSnapshotAfterL3)

    th.assertIsApproximatelyEqual(totalStakesSnapshot_Asset, totalStakesSnapshotAfterL3_Asset)
    th.assertIsApproximatelyEqual(totalCollateralSnapshot_Asset, totalCollateralSnapshotAfterL3_Asset)

    // check VST gas compensation
    assert.equal((await vstToken.balanceOf(owner)).toString(), toBN(dec(600, 18)).mul(toBN(2)).toString())
  })
})
