const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const assertRevert = th.assertRevert
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const TroveManagerTester = artifacts.require("./TroveManagerTester")
const VSTTokenTester = artifacts.require("VSTTokenTester")
const StabilityPool = artifacts.require('StabilityPool.sol')


contract('TroveManager - in Recovery Mode', async accounts => {
  const _1_Ether = web3.utils.toWei('1', 'ether')
  const _2_Ether = web3.utils.toWei('2', 'ether')
  const _3_Ether = web3.utils.toWei('3', 'ether')
  const _3pt5_Ether = web3.utils.toWei('3.5', 'ether')
  const _6_Ether = web3.utils.toWei('6', 'ether')
  const _10_Ether = web3.utils.toWei('10', 'ether')
  const _20_Ether = web3.utils.toWei('20', 'ether')
  const _21_Ether = web3.utils.toWei('21', 'ether')
  const _22_Ether = web3.utils.toWei('22', 'ether')
  const _24_Ether = web3.utils.toWei('24', 'ether')
  const _25_Ether = web3.utils.toWei('25', 'ether')
  const _30_Ether = web3.utils.toWei('30', 'ether')

  const ZERO_ADDRESS = th.ZERO_ADDRESS
  const [
    owner,
    alice, bob, carol, dennis, erin, freddy, greta, harry, ida,
    whale, defaulter_1, defaulter_2, defaulter_3, defaulter_4,
    A, B, C, D, E, F, G, H, I] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let priceFeed
  let vstToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let stabilityPoolERC20
  let defaultPool
  let functionCaller
  let borrowerOperations
  let collSurplusPool
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
    activePool = contracts.activePool
    defaultPool = contracts.defaultPool
    functionCaller = contracts.functionCaller
    borrowerOperations = contracts.borrowerOperations
    collSurplusPool = contracts.collSurplusPool
    erc20 = contracts.erc20

    let index = 0;
    for (const acc of accounts) {
      await erc20.mint(acc, await web3.eth.getBalance(acc))
      index++;

      if (index >= 40)
        break;
    }

    await deploymentHelper.connectCoreContracts(contracts, VSTAContracts)
    await deploymentHelper.connectVSTAContractsToCore(VSTAContracts, contracts)
    stabilityPool = await StabilityPool.at(await contracts.stabilityPoolManager.getAssetStabilityPool(ZERO_ADDRESS))
    stabilityPoolERC20 = await StabilityPool.at(await contracts.stabilityPoolManager.getAssetStabilityPool(erc20.address));
  })

  it("checkRecoveryMode(): Returns true if TCR falls below CCR", async () => {
    // --- SETUP ---
    //  Alice and Bob withdraw such that the TCR is ~150%
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    const TCR = (await th.getTCR(contracts)).toString()
    const TCR_Asset = (await th.getTCR(contracts, erc20.address)).toString()
    assert.equal(TCR, dec(15, 17))
    assert.equal(TCR_Asset, dec(15, 17))

    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // --- TEST ---

    // price drops to 1ETH:150VST, reducing TCR below 150%.  setPrice() calls checkTCRAndSetRecoveryMode() internally.
    await priceFeed.setPrice(dec(15, 17))

    // const price = await priceFeed.getPrice()
    // await troveManager.checkTCRAndSetRecoveryMode(price)

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))
  })

  it("checkRecoveryMode(): Returns true if TCR stays less than CCR", async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    const TCR = (await th.getTCR(contracts)).toString()
    const TCR_Asset = (await th.getTCR(contracts, erc20.address)).toString()
    assert.equal(TCR, '1500000000000000000')
    assert.equal(TCR_Asset, '1500000000000000000')

    // --- TEST ---

    // price drops to 1ETH:150VST, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000')

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    await borrowerOperations.addColl(ZERO_ADDRESS, 0, alice, alice, { from: alice, value: '1' })
    await borrowerOperations.addColl(erc20.address, 1, alice, alice, { from: alice })

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))
  })

  it("checkRecoveryMode(): returns false if TCR stays above CCR", async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(450, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(450, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    // --- TEST ---
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    await borrowerOperations.withdrawColl(ZERO_ADDRESS, _1_Ether, alice, alice, { from: alice })
    await borrowerOperations.withdrawColl(erc20.address, _1_Ether, alice, alice, { from: alice })

    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))
  })

  it("checkRecoveryMode(): returns false if TCR rises above CCR", async () => {
    // --- SETUP ---
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    const TCR = (await th.getTCR(contracts)).toString()
    assert.equal(TCR, '1500000000000000000')

    const TCR_Asset = (await th.getTCR(contracts, erc20.address)).toString()
    assert.equal(TCR_Asset, '1500000000000000000')

    // --- TEST ---
    // price drops to 1ETH:150VST, reducing TCR below 150%
    await priceFeed.setPrice('150000000000000000000')

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    await borrowerOperations.addColl(ZERO_ADDRESS, 0, alice, alice, { from: alice, value: A_coll })
    await borrowerOperations.addColl(erc20.address, A_coll, alice, alice, { from: alice })

    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))
  })

  // --- liquidate() with ICR < 100% ---

  it("liquidate(), with ICR < 100%: removes stake and updates totalStakes", async () => {
    // --- SETUP ---
    //  Alice and Bob withdraw such that the TCR is ~150%
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: bob } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: bob } })

    const TCR = (await th.getTCR(contracts)).toString()
    assert.equal(TCR, '1500000000000000000')

    const TCR_Asset = (await th.getTCR(contracts, erc20.address)).toString()
    assert.equal(TCR_Asset, '1500000000000000000')

    const bob_Stake_Before = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STAKE_INDEX]
    const totalStakes_Before = await troveManager.totalStakes(ZERO_ADDRESS)

    const bob_Stake_Before_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_STAKE_INDEX]
    const totalStakes_Before_Asset = await troveManager.totalStakes(erc20.address)

    assert.equal(bob_Stake_Before.toString(), B_coll)
    assert.equal(totalStakes_Before.toString(), A_coll.add(B_coll))

    assert.equal(bob_Stake_Before_Asset.toString(), B_coll_Asset)
    assert.equal(totalStakes_Before_Asset.toString(), A_coll_Asset.add(B_coll_Asset))

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // check Bob's ICR falls to 75%
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price);
    assert.equal(bob_ICR, '750000000000000000')

    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price);
    assert.equal(bob_ICR_Asset, '750000000000000000')

    // Liquidate Bob
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner })
    await troveManager.liquidate(erc20.address, bob, { from: owner })

    const bob_Stake_After = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STAKE_INDEX]
    const totalStakes_After = await troveManager.totalStakes(ZERO_ADDRESS)

    const bob_Stake_After_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_STAKE_INDEX]
    const totalStakes_After_Asset = await troveManager.totalStakes(erc20.address)

    assert.equal(bob_Stake_After, 0)
    assert.equal(totalStakes_After.toString(), A_coll)

    assert.equal(bob_Stake_After_Asset, 0)
    assert.equal(totalStakes_After_Asset.toString(), A_coll_Asset)
  })

  it("liquidate(), with ICR < 100%: updates system snapshots correctly", async () => {
    // --- SETUP ---
    //  Alice, Bob and Dennis withdraw such that their ICRs and the TCR is ~150%
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: dennis } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: bob } })
    const { collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: dennis } })

    const TCR = (await th.getTCR(contracts)).toString()
    assert.equal(TCR, '1500000000000000000')

    const TCR_Asset = (await th.getTCR(contracts, erc20.address)).toString()
    assert.equal(TCR_Asset, '1500000000000000000')

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%, and all Troves below 100% ICR
    await priceFeed.setPrice('100000000000000000000')

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Dennis is liquidated
    await troveManager.liquidate(ZERO_ADDRESS, dennis, { from: owner })
    await troveManager.liquidate(erc20.address, dennis, { from: owner })

    const totalStakesSnaphot_before = (await troveManager.totalStakesSnapshot(ZERO_ADDRESS)).toString()
    const totalCollateralSnapshot_before = (await troveManager.totalCollateralSnapshot(ZERO_ADDRESS)).toString()

    const totalStakesSnaphot_before_Asset = (await troveManager.totalStakesSnapshot(erc20.address)).toString()
    const totalCollateralSnapshot_before_Asset = (await troveManager.totalCollateralSnapshot(erc20.address)).toString()

    assert.equal(totalStakesSnaphot_before, A_coll.add(B_coll))
    assert.equal(totalCollateralSnapshot_before, A_coll.add(B_coll).add(th.applyLiquidationFee(D_coll))) // 6 + 3*0.995

    assert.equal(totalStakesSnaphot_before_Asset, A_coll_Asset.add(B_coll_Asset))
    assert.equal(totalCollateralSnapshot_before_Asset, A_coll_Asset.add(B_coll_Asset).add(th.applyLiquidationFee(D_coll_Asset)))

    const A_reward = th.applyLiquidationFee(D_coll).mul(A_coll).div(A_coll.add(B_coll))
    const B_reward = th.applyLiquidationFee(D_coll).mul(B_coll).div(A_coll.add(B_coll))

    const A_reward_Asset = th.applyLiquidationFee(D_coll_Asset).mul(A_coll_Asset).div(A_coll_Asset.add(B_coll_Asset))
    const B_reward_Asset = th.applyLiquidationFee(D_coll_Asset).mul(B_coll_Asset).div(A_coll_Asset.add(B_coll_Asset))

    // Liquidate Bob
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner })
    await troveManager.liquidate(erc20.address, bob, { from: owner })

    const totalStakesSnaphot_After = (await troveManager.totalStakesSnapshot(ZERO_ADDRESS))
    const totalCollateralSnapshot_After = (await troveManager.totalCollateralSnapshot(ZERO_ADDRESS))

    const totalStakesSnaphot_After_Asset = (await troveManager.totalStakesSnapshot(erc20.address))
    const totalCollateralSnapshot_After_Asset = (await troveManager.totalCollateralSnapshot(erc20.address))

    assert.equal(totalStakesSnaphot_After.toString(), A_coll)
    assert.equal(totalStakesSnaphot_After_Asset.toString(), A_coll_Asset)
    // total collateral should always be 9 minus gas compensations, as all liquidations in this test case are full redistributions
    assert.isAtMost(th.getDifference(totalCollateralSnapshot_After, A_coll.add(A_reward).add(th.applyLiquidationFee(B_coll.add(B_reward)))), 1000) // 3 + 4.5*0.995 + 1.5*0.995^2
    assert.isAtMost(th.getDifference(totalCollateralSnapshot_After_Asset, A_coll_Asset.add(A_reward_Asset).add(th.applyLiquidationFee(B_coll_Asset.add(B_reward_Asset)))), 1000) // 3 + 4.5*0.995 + 1.5*0.995^2
  })

  it("liquidate(), with ICR < 100%: closes the Trove and removes it from the Trove array", async () => {
    // --- SETUP ---
    //  Alice and Bob withdraw such that the TCR is ~150%
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: bob } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: bob } })

    const TCR = (await th.getTCR(contracts)).toString()
    assert.equal(TCR, '1500000000000000000')

    const TCR_Asset = (await th.getTCR(contracts, erc20.address)).toString()
    assert.equal(TCR_Asset, '1500000000000000000')

    const bob_TroveStatus_Before = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_Before = await sortedTroves.contains(ZERO_ADDRESS, bob)

    const bob_TroveStatus_Before_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_Before_Asset = await sortedTroves.contains(erc20.address, bob)

    assert.equal(bob_TroveStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_Before)

    assert.equal(bob_TroveStatus_Before_Asset, 1)
    assert.isTrue(bob_Trove_isInSortedList_Before_Asset)

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // check Bob's ICR falls to 75%
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price);
    assert.equal(bob_ICR, '750000000000000000')

    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price);
    assert.equal(bob_ICR_Asset, '750000000000000000')

    // Liquidate Bob
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner })
    await troveManager.liquidate(erc20.address, bob, { from: owner })

    // check Bob's Trove is successfully closed, and removed from sortedList
    const bob_TroveStatus_After = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_After = await sortedTroves.contains(ZERO_ADDRESS, bob)

    const bob_TroveStatus_After_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_After_Asset = await sortedTroves.contains(erc20.address, bob)

    assert.equal(bob_TroveStatus_After, 3)  // status enum element 3 corresponds to "Closed by liquidation"
    assert.isFalse(bob_Trove_isInSortedList_After)
    assert.equal(bob_TroveStatus_After_Asset, 3)
    assert.isFalse(bob_Trove_isInSortedList_After_Asset)
  })

  it("liquidate(), with ICR < 100%: only redistributes to active Troves - no offset to Stability Pool", async () => {
    // --- SETUP ---
    //  Alice, Bob and Dennis withdraw such that their ICRs and the TCR is ~150%
    const spDeposit = toBN(dec(390, 18))
    await openTrove({ ICR: toBN(dec(150, 16)), extraVSTAmount: spDeposit, extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraVSTAmount: spDeposit, extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: dennis } })

    // Alice deposits to SP
    await stabilityPool.provideToSP(spDeposit, { from: alice })
    await stabilityPoolERC20.provideToSP(spDeposit, { from: alice })

    // check rewards-per-unit-staked before
    assert.equal((await stabilityPool.P()).toString(), '1000000000000000000')
    assert.equal((await stabilityPoolERC20.P()).toString(), '1000000000000000000')

    // const TCR = (await th.getTCR(contracts)).toString()
    // assert.equal(TCR, '1500000000000000000')

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%, and all Troves below 100% ICR
    await priceFeed.setPrice('100000000000000000000')

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // liquidate bob
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner })
    await troveManager.liquidate(erc20.address, bob, { from: owner })

    // check SP rewards-per-unit-staked after liquidation - should be no increase

    assert.equal((await stabilityPool.P()).toString(), '1000000000000000000')
    assert.equal((await stabilityPoolERC20.P()).toString(), '1000000000000000000')
  })

  // --- liquidate() with 100% < ICR < 110%

  it("liquidate(), with 100 < ICR < 110%: removes stake and updates totalStakes", async () => {
    // --- SETUP ---
    //  Bob withdraws up to 2000 VST of debt, bringing his ICR to 210%
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(210, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: bob } })

    const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: bob } })

    let price = await priceFeed.getPrice()
    // Total TCR = 24*200/2050 = 234%
    const TCR = await th.getTCR(contracts)
    assert.isAtMost(th.getDifference(TCR, A_coll.add(B_coll).mul(price).div(A_totalDebt.add(B_totalDebt))), 1000)

    const TCR_Asset = await th.getTCR(contracts, erc20.address)
    assert.isAtMost(th.getDifference(TCR_Asset, A_coll_Asset.add(B_coll_Asset).mul(price).div(A_totalDebt_Asset.add(B_totalDebt_Asset))), 1000)

    const bob_Stake_Before = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STAKE_INDEX]
    const totalStakes_Before = await troveManager.totalStakes(ZERO_ADDRESS)

    const bob_Stake_Before_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_STAKE_INDEX]
    const totalStakes_Before_Asset = await troveManager.totalStakes(erc20.address)

    assert.equal(bob_Stake_Before.toString(), B_coll)
    assert.equal(totalStakes_Before.toString(), A_coll.add(B_coll))

    assert.equal(bob_Stake_Before_Asset.toString(), B_coll_Asset)
    assert.equal(totalStakes_Before_Asset.toString(), A_coll_Asset.add(B_coll_Asset))

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR to 117%
    await priceFeed.setPrice('100000000000000000000')
    price = await priceFeed.getPrice()

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // check Bob's ICR falls to 105%
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price);
    assert.equal(bob_ICR, '1050000000000000000')

    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price);
    assert.equal(bob_ICR_Asset, '1050000000000000000')

    // Liquidate Bob
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner })
    await troveManager.liquidate(erc20.address, bob, { from: owner })

    const bob_Stake_After = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STAKE_INDEX]
    const totalStakes_After = await troveManager.totalStakes(ZERO_ADDRESS)

    const bob_Stake_After_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_STAKE_INDEX]
    const totalStakes_After_Asset = await troveManager.totalStakes(erc20.address)

    assert.equal(bob_Stake_After, 0)
    assert.equal(totalStakes_After.toString(), A_coll)
    assert.equal(bob_Stake_After_Asset, 0)
    assert.equal(totalStakes_After_Asset.toString(), A_coll_Asset)
  })

  it("liquidate(), with 100% < ICR < 110%: updates system snapshots correctly", async () => {
    // --- SETUP ---
    //  Alice and Dennis withdraw such that their ICR is ~150%
    //  Bob withdraws up to 20000 VST of debt, bringing his ICR to 210%
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(210, 16)), extraVSTAmount: dec(20000, 18), extraParams: { from: bob } })
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: dennis } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraVSTAmount: dec(20000, 18), extraParams: { from: bob } })
    const { collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: dennis } })

    const totalStakesSnaphot_1 = (await troveManager.totalStakesSnapshot(ZERO_ADDRESS)).toString()
    const totalCollateralSnapshot_1 = (await troveManager.totalCollateralSnapshot(ZERO_ADDRESS)).toString()

    const totalStakesSnaphot_1_Asset = (await troveManager.totalStakesSnapshot(erc20.address)).toString()
    const totalCollateralSnapshot_1_Asset = (await troveManager.totalCollateralSnapshot(erc20.address)).toString()
    assert.equal(totalStakesSnaphot_1, 0)
    assert.equal(totalCollateralSnapshot_1, 0)
    assert.equal(totalStakesSnaphot_1_Asset, 0)
    assert.equal(totalCollateralSnapshot_1_Asset, 0)

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%, and all Troves below 100% ICR
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Dennis is liquidated
    await troveManager.liquidate(ZERO_ADDRESS, dennis, { from: owner })
    await troveManager.liquidate(erc20.address, dennis, { from: owner })

    const A_reward = th.applyLiquidationFee(D_coll).mul(A_coll).div(A_coll.add(B_coll))
    const B_reward = th.applyLiquidationFee(D_coll).mul(B_coll).div(A_coll.add(B_coll))

    const A_reward_Asset = th.applyLiquidationFee(D_coll_Asset).mul(A_coll_Asset).div(A_coll_Asset.add(B_coll_Asset))
    const B_reward_Asset = th.applyLiquidationFee(D_coll_Asset).mul(B_coll_Asset).div(A_coll_Asset.add(B_coll_Asset))

    /*
    Prior to Dennis liquidation, total stakes and total collateral were each 27 ether. 
  
    Check snapshots. Dennis' liquidated collateral is distributed and remains in the system. His 
    stake is removed, leaving 24+3*0.995 ether total collateral, and 24 ether total stakes. */

    const totalStakesSnaphot_2 = (await troveManager.totalStakesSnapshot(ZERO_ADDRESS)).toString()
    const totalCollateralSnapshot_2 = (await troveManager.totalCollateralSnapshot(ZERO_ADDRESS)).toString()
    const totalStakesSnaphot_2_Asset = (await troveManager.totalStakesSnapshot(erc20.address)).toString()
    const totalCollateralSnapshot_2_Asset = (await troveManager.totalCollateralSnapshot(erc20.address)).toString()

    assert.equal(totalStakesSnaphot_2, A_coll.add(B_coll))
    assert.equal(totalCollateralSnapshot_2, A_coll.add(B_coll).add(th.applyLiquidationFee(D_coll))) // 24 + 3*0.995
    assert.equal(totalStakesSnaphot_2_Asset, A_coll_Asset.add(B_coll_Asset))
    assert.equal(totalCollateralSnapshot_2_Asset, A_coll_Asset.add(B_coll_Asset).add(th.applyLiquidationFee(D_coll_Asset)))

    // check Bob's ICR is now in range 100% < ICR 110%
    const _110percent = web3.utils.toBN('1100000000000000000')
    const _100percent = web3.utils.toBN('1000000000000000000')

    const bob_ICR = (await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price))
    const bob_ICR_Asset = (await troveManager.getCurrentICR(erc20.address, bob, price))

    assert.isTrue(bob_ICR.lt(_110percent))
    assert.isTrue(bob_ICR.gt(_100percent))

    assert.isTrue(bob_ICR_Asset.lt(_110percent))
    assert.isTrue(bob_ICR_Asset.gt(_100percent))

    // Liquidate Bob
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner })
    await troveManager.liquidate(erc20.address, bob, { from: owner })

    /* After Bob's liquidation, Bob's stake (21 ether) should be removed from total stakes, 
    but his collateral should remain in the system (*0.995). */
    const totalStakesSnaphot_3 = (await troveManager.totalStakesSnapshot(ZERO_ADDRESS))
    const totalCollateralSnapshot_3 = (await troveManager.totalCollateralSnapshot(ZERO_ADDRESS))

    const totalStakesSnaphot_3_Asset = (await troveManager.totalStakesSnapshot(erc20.address))
    const totalCollateralSnapshot_3_Asset = (await troveManager.totalCollateralSnapshot(erc20.address))

    assert.equal(totalStakesSnaphot_3.toString(), A_coll)
    assert.equal(totalStakesSnaphot_3_Asset.toString(), A_coll_Asset)
    // total collateral should always be 27 minus gas compensations, as all liquidations in this test case are full redistributions
    assert.isAtMost(th.getDifference(totalCollateralSnapshot_3.toString(), A_coll.add(A_reward).add(th.applyLiquidationFee(B_coll.add(B_reward)))), 1000)
    assert.isAtMost(th.getDifference(totalCollateralSnapshot_3_Asset.toString(), A_coll_Asset.add(A_reward_Asset).add(th.applyLiquidationFee(B_coll_Asset.add(B_reward_Asset)))), 1000)
  })

  it("liquidate(), with 100% < ICR < 110%: closes the Trove and removes it from the Trove array", async () => {
    // --- SETUP ---
    //  Bob withdraws up to 2000 VST of debt, bringing his ICR to 210%
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(210, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: bob } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: bob } })

    const bob_TroveStatus_Before = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_Before = await sortedTroves.contains(ZERO_ADDRESS, bob)

    const bob_TroveStatus_Before_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_Before_Asset = await sortedTroves.contains(erc20.address, bob)

    assert.equal(bob_TroveStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_Before)
    assert.equal(bob_TroveStatus_Before_Asset, 1)
    assert.isTrue(bob_Trove_isInSortedList_Before_Asset)

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // check Bob's ICR has fallen to 105%
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price);
    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price);
    assert.equal(bob_ICR, '1050000000000000000')
    assert.equal(bob_ICR_Asset, '1050000000000000000')

    // Liquidate Bob
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner })
    await troveManager.liquidate(erc20.address, bob, { from: owner })

    // check Bob's Trove is successfully closed, and removed from sortedList
    const bob_TroveStatus_After = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_After = await sortedTroves.contains(ZERO_ADDRESS, bob)
    const bob_TroveStatus_After_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_After_Asset = await sortedTroves.contains(erc20.address, bob)

    assert.equal(bob_TroveStatus_After, 3)  // status enum element 3 corresponds to "Closed by liquidation"
    assert.isFalse(bob_Trove_isInSortedList_After)
    assert.equal(bob_TroveStatus_After_Asset, 3)
    assert.isFalse(bob_Trove_isInSortedList_After_Asset)
  })

  it("liquidate(), with 100% < ICR < 110%: offsets as much debt as possible with the Stability Pool, then redistributes the remainder coll and debt", async () => {
    // --- SETUP ---
    //  Alice and Dennis withdraw such that their ICR is ~150%
    //  Bob withdraws up to 2000 VST of debt, bringing his ICR to 210%
    const spDeposit = toBN(dec(390, 18))
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraVSTAmount: spDeposit, extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(210, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: bob } })
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: dennis } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraVSTAmount: spDeposit, extraParams: { from: alice } })
    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: bob } })
    const { collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(150, 16)), extraParams: { from: dennis } })

    // Alice deposits 390VST to the Stability Pool
    await stabilityPool.provideToSP(spDeposit, { from: alice })
    await stabilityPoolERC20.provideToSP(spDeposit, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // check Bob's ICR has fallen to 105%
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price);
    assert.equal(bob_ICR, '1050000000000000000')

    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price);
    assert.equal(bob_ICR_Asset, '1050000000000000000')

    // check pool VST before liquidation
    const stabilityPoolVST_Before = (await stabilityPool.getTotalVSTDeposits()).toString()
    assert.equal(stabilityPoolVST_Before, '390000000000000000000')

    const stabilityPoolVST_Before_Asset = (await stabilityPoolERC20.getTotalVSTDeposits()).toString()
    assert.equal(stabilityPoolVST_Before_Asset, '390000000000000000000')


    // check Pool reward term before liquidation

    assert.equal((await stabilityPool.P()).toString(), '1000000000000000000')
    assert.equal((await stabilityPoolERC20.P()).toString(), '1000000000000000000')

    /* Now, liquidate Bob. Liquidated coll is 21 ether, and liquidated debt is 2000 VST.
    
    With 390 VST in the StabilityPool, 390 VST should be offset with the pool, leaving 0 in the pool.
  
    Stability Pool rewards for alice should be:
    VSTLoss: 390VST
    AssetGain: (390 / 2000) * 21*0.995 = 4.074525 ether

    After offsetting 390 VST and 4.074525 ether, the remainders - 1610 VST and 16.820475 ether - should be redistributed to all active Troves.
   */
    // Liquidate Bob
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner })
    await troveManager.liquidate(erc20.address, bob, { from: owner })

    const aliceDeposit = await stabilityPool.getCompoundedVSTDeposit(alice)
    const aliceETHGain = await stabilityPool.getDepositorAssetGain(alice)
    const aliceExpectedETHGain = spDeposit.mul(th.applyLiquidationFee(B_coll)).div(B_totalDebt)

    const aliceDeposit_Asset = await stabilityPoolERC20.getCompoundedVSTDeposit(alice)
    const aliceETHGain_Asset = await stabilityPoolERC20.getDepositorAssetGain(alice)
    const aliceExpectedETHGain_Asset = spDeposit.mul(th.applyLiquidationFee(B_coll_Asset)).div(B_totalDebt_Asset)

    assert.equal(aliceDeposit.toString(), 0)
    assert.equal(aliceETHGain.toString(), aliceExpectedETHGain)

    assert.equal(aliceDeposit_Asset.toString(), 0)
    assert.equal(aliceETHGain_Asset.toString(), aliceExpectedETHGain_Asset.div(toBN(10 ** 10)))

    /* Now, check redistribution to active Troves. Remainders of 1610 VST and 16.82 ether are distributed.
    
    Now, only Alice and Dennis have a stake in the system - 3 ether each, thus total stakes is 6 ether.
  
    Rewards-per-unit-staked from the redistribution should be:
  
    L_VSTDebt = 1610 / 6 = 268.333 VST
    L_ETH = 16.820475 /6 =  2.8034125 ether
    */
    const L_VSTDebt = (await troveManager.L_VSTDebts(ZERO_ADDRESS)).toString()
    const L_ETH = (await troveManager.L_ASSETS(ZERO_ADDRESS)).toString()

    const L_VSTDebt_Asset = (await troveManager.L_VSTDebts(erc20.address)).toString()
    const L_ETH_Asset = (await troveManager.L_ASSETS(erc20.address)).toString()

    assert.isAtMost(th.getDifference(L_VSTDebt, B_totalDebt.sub(spDeposit).mul(mv._1e18BN).div(A_coll.add(D_coll))), 100)
    assert.isAtMost(th.getDifference(L_ETH, th.applyLiquidationFee(B_coll.sub(B_coll.mul(spDeposit).div(B_totalDebt)).mul(mv._1e18BN).div(A_coll.add(D_coll)))), 100)

    assert.isAtMost(th.getDifference(L_VSTDebt_Asset, B_totalDebt_Asset.sub(spDeposit).mul(mv._1e18BN).div(A_coll_Asset.add(D_coll_Asset))), 100)
    assert.isAtMost(th.getDifference(L_ETH_Asset, th.applyLiquidationFee(B_coll_Asset.sub(B_coll_Asset.mul(spDeposit).div(B_totalDebt_Asset)).mul(mv._1e18BN).div(A_coll_Asset.add(D_coll_Asset)))), 100)
  })

  // --- liquidate(), applied to trove with ICR > 110% that has the lowest ICR 

  it("liquidate(), with ICR > 110%, trove has lowest ICR, and StabilityPool is empty: does nothing", async () => {
    // --- SETUP ---
    // Alice and Dennis withdraw, resulting in ICRs of 266%. 
    // Bob withdraws, resulting in ICR of 240%. Bob has lowest ICR.
    await openTrove({ ICR: toBN(dec(266, 16)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check Bob's ICR is >110% but still lowest
    const bob_ICR = (await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).toString()
    const alice_ICR = (await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).toString()
    const dennis_ICR = (await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)).toString()

    const bob_ICR_Asset = (await troveManager.getCurrentICR(erc20.address, bob, price)).toString()
    const alice_ICR_Asset = (await troveManager.getCurrentICR(erc20.address, alice, price)).toString()
    const dennis_ICR_Asset = (await troveManager.getCurrentICR(erc20.address, dennis, price)).toString()

    assert.equal(bob_ICR, '1200000000000000000')
    assert.equal(alice_ICR, dec(133, 16))
    assert.equal(dennis_ICR, dec(133, 16))

    assert.equal(bob_ICR_Asset, '1200000000000000000')
    assert.equal(alice_ICR_Asset, dec(133, 16))
    assert.equal(dennis_ICR_Asset, dec(133, 16))

    // console.log(`TCR: ${await th.getTCR(contracts)}`)
    // Try to liquidate Bob
    await assertRevert(troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner }), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidate(erc20.address, bob, { from: owner }), "TroveManager: nothing to liquidate")

    // Check that Pool rewards don't change
    assert.equal((await stabilityPool.P()).toString(), '1000000000000000000')
    assert.equal((await stabilityPoolERC20.P()).toString(), '1000000000000000000')

    // Check that redistribution rewards don't change
    const L_VSTDebt = (await troveManager.L_VSTDebts(ZERO_ADDRESS)).toString()
    const L_ETH = (await troveManager.L_ASSETS(ZERO_ADDRESS)).toString()
    const L_VSTDebt_Asset = (await troveManager.L_VSTDebts(erc20.address)).toString()
    const L_ETH_Asset = (await troveManager.L_ASSETS(erc20.address)).toString()

    assert.equal(L_VSTDebt, '0')
    assert.equal(L_ETH, '0')
    assert.equal(L_VSTDebt_Asset, '0')
    assert.equal(L_ETH_Asset, '0')

    // Check that Bob's Trove and stake remains active with unchanged coll and debt
    const bob_Trove = await troveManager.Troves(bob, ZERO_ADDRESS);
    const bob_Debt = bob_Trove[th.TROVE_DEBT_INDEX].toString()
    const bob_Coll = bob_Trove[th.TROVE_COLL_INDEX].toString()
    const bob_Stake = bob_Trove[th.TROVE_STAKE_INDEX].toString()
    const bob_TroveStatus = bob_Trove[th.TROVE_STATUS_INDEX].toString()
    const bob_isInSortedTrovesList = await sortedTroves.contains(ZERO_ADDRESS, bob)

    const bob_Trove_Asset = await troveManager.Troves(bob, erc20.address);
    const bob_Debt_Asset = bob_Trove_Asset[th.TROVE_DEBT_INDEX].toString()
    const bob_Coll_Asset = bob_Trove_Asset[th.TROVE_COLL_INDEX].toString()
    const bob_Stake_Asset = bob_Trove_Asset[th.TROVE_STAKE_INDEX].toString()
    const bob_TroveStatus_Asset = bob_Trove_Asset[th.TROVE_STATUS_INDEX].toString()
    const bob_isInSortedTrovesList_Asset = await sortedTroves.contains(erc20.address, bob)

    th.assertIsApproximatelyEqual(bob_Debt.toString(), B_totalDebt)
    assert.equal(bob_Coll.toString(), B_coll)
    assert.equal(bob_Stake.toString(), B_coll)
    assert.equal(bob_TroveStatus, '1')
    assert.isTrue(bob_isInSortedTrovesList)

    th.assertIsApproximatelyEqual(bob_Debt_Asset.toString(), B_totalDebt_Asset)
    assert.equal(bob_Coll_Asset.toString(), B_coll_Asset)
    assert.equal(bob_Stake_Asset.toString(), B_coll_Asset)
    assert.equal(bob_TroveStatus_Asset, '1')
    assert.isTrue(bob_isInSortedTrovesList_Asset)
  })

  // --- liquidate(), applied to trove with ICR > 110% that has the lowest ICR, and Stability Pool VST is GREATER THAN liquidated debt ---

  it("liquidate(), with 110% < ICR < TCR, and StabilityPool VST > debt to liquidate: offsets the trove entirely with the pool", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 VST of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 VST of debt, resulting in ICR of 240%. Bob has lowest ICR.
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: B_totalDebt, extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: B_totalDebt, extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    // Alice deposits VST in the Stability Pool
    const spDeposit = B_totalDebt.add(toBN(1))
    await stabilityPool.provideToSP(spDeposit, { from: alice })
    await stabilityPoolERC20.provideToSP(spDeposit, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check Bob's ICR is between 110 and TCR
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    assert.isTrue(bob_ICR.gt(mv._MCR) && bob_ICR.lt(TCR))

    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    assert.isTrue(bob_ICR_Asset.gt(mv._MCR) && bob_ICR_Asset.lt(TCR_Asset))

    // Liquidate Bob
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner })
    await troveManager.liquidate(erc20.address, bob, { from: owner })

    /* Check accrued Stability Pool rewards after. Total Pool deposits was 1490 VST, Alice sole depositor.
    As liquidated debt (250 VST) was completely offset

    Alice's expected compounded deposit: (1490 - 250) = 1240VST
    Alice's expected ETH gain:  Bob's liquidated capped coll (minus gas comp), 2.75*0.995 ether
  
    */
    const aliceExpectedDeposit = await stabilityPool.getCompoundedVSTDeposit(alice)
    const aliceExpectedETHGain = await stabilityPool.getDepositorAssetGain(alice)
    const aliceExpectedDeposit_Asset = await stabilityPoolERC20.getCompoundedVSTDeposit(alice)
    const aliceExpectedETHGain_Asset = await stabilityPoolERC20.getDepositorAssetGain(alice)

    assert.isAtMost(th.getDifference(aliceExpectedDeposit.toString(), spDeposit.sub(B_totalDebt)), 2000)
    assert.isAtMost(th.getDifference(aliceExpectedETHGain, th.applyLiquidationFee(B_totalDebt.mul(th.toBN(dec(11, 17))).div(price))), 3000)

    assert.isAtMost(th.getDifference(aliceExpectedDeposit_Asset.toString(), spDeposit.sub(B_totalDebt_Asset)), 2000)
    assert.isAtMost(th.getDifference(aliceExpectedETHGain_Asset, th.applyLiquidationFee(B_totalDebt_Asset.div(toBN(10 ** 10)).mul(th.toBN(dec(11, 17))).div(price))), 3000)

    // check Bob’s collateral surplus
    const bob_remainingCollateral = B_coll.sub(B_totalDebt.mul(th.toBN(dec(11, 17))).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, bob), bob_remainingCollateral)

    const bob_remainingCollateral_Asset = B_coll_Asset.sub(B_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, bob), bob_remainingCollateral_Asset)
    // can claim collateral
    const bob_balanceBefore = th.toBN(await web3.eth.getBalance(bob))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: bob, gasPrice: 0 })
    const bob_balanceAfter = th.toBN(await web3.eth.getBalance(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter, bob_balanceBefore.add(th.toBN(bob_remainingCollateral)))


    const bob_balanceBefore_Asset = th.toBN(await erc20.balanceOf(bob))
    await borrowerOperations.claimCollateral(erc20.address, { from: bob, gasPrice: 0 })
    const bob_balanceAfter_Asset = th.toBN(await erc20.balanceOf(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter_Asset, bob_balanceBefore_Asset.add(th.toBN(bob_remainingCollateral_Asset).div(toBN(10 ** 10))))
  })

  it("liquidate(), with ICR% = 110 < TCR, and StabilityPool VST > debt to liquidate: offsets the trove entirely with the pool, there’s no collateral surplus", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 VST of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 VST of debt, resulting in ICR of 220%. Bob has lowest ICR.
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(220, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: B_totalDebt, extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: B_totalDebt_Asset, extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    // Alice deposits VST in the Stability Pool
    const spDeposit = B_totalDebt.add(toBN(1))
    await stabilityPool.provideToSP(spDeposit, { from: alice })
    await stabilityPoolERC20.provideToSP(spDeposit, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()
    await th.getTCR(contracts)

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check Bob's ICR = 110
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    assert.isTrue(bob_ICR.eq(mv._MCR))

    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    assert.isTrue(bob_ICR_Asset.eq(mv._MCR))

    // Liquidate Bob
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner })
    await troveManager.liquidate(erc20.address, bob, { from: owner })

    /* Check accrued Stability Pool rewards after. Total Pool deposits was 1490 VST, Alice sole depositor.
    As liquidated debt (250 VST) was completely offset

    Alice's expected compounded deposit: (1490 - 250) = 1240VST
    Alice's expected ETH gain:  Bob's liquidated capped coll (minus gas comp), 2.75*0.995 ether

    */
    const aliceExpectedDeposit = await stabilityPool.getCompoundedVSTDeposit(alice)
    const aliceExpectedETHGain = await stabilityPool.getDepositorAssetGain(alice)

    const aliceExpectedDeposit_Asset = await stabilityPoolERC20.getCompoundedVSTDeposit(alice)
    const aliceExpectedETHGain_Asset = await stabilityPoolERC20.getDepositorAssetGain(alice)

    assert.isAtMost(th.getDifference(aliceExpectedDeposit.toString(), spDeposit.sub(B_totalDebt)), 2000)
    assert.isAtMost(th.getDifference(aliceExpectedETHGain, th.applyLiquidationFee(B_totalDebt.mul(th.toBN(dec(11, 17))).div(price))), 3000)

    assert.isAtMost(th.getDifference(aliceExpectedDeposit_Asset.toString(), spDeposit.sub(B_totalDebt_Asset)), 2000)
    assert.isAtMost(th.getDifference(aliceExpectedETHGain_Asset, th.applyLiquidationFee(B_totalDebt_Asset.div(toBN(10 ** 10)).mul(th.toBN(dec(11, 17))).div(price))), 3000)

    // check Bob’s collateral surplus
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, bob), '0')
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, bob), '0')
  })

  it("liquidate(), with  110% < ICR < TCR, and StabilityPool VST > debt to liquidate: removes stake and updates totalStakes", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 VST of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 VST of debt, resulting in ICR of 240%. Bob has lowest ICR.
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: B_totalDebt, extraParams: { from: alice } })
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: B_totalDebt_Asset, extraParams: { from: alice } })
    const { collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    // Alice deposits VST in the Stability Pool
    await stabilityPool.provideToSP(B_totalDebt.add(toBN(1)), { from: alice })
    await stabilityPoolERC20.provideToSP(B_totalDebt_Asset.add(toBN(1)), { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // check stake and totalStakes before
    const bob_Stake_Before = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STAKE_INDEX]
    const totalStakes_Before = await troveManager.totalStakes(ZERO_ADDRESS)

    const bob_Stake_Before_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_STAKE_INDEX]
    const totalStakes_Before_Asset = await troveManager.totalStakes(erc20.address)

    assert.equal(bob_Stake_Before.toString(), B_coll)
    assert.equal(totalStakes_Before.toString(), A_coll.add(B_coll).add(D_coll))

    assert.equal(bob_Stake_Before_Asset.toString(), B_coll_Asset)
    assert.equal(totalStakes_Before_Asset.toString(), A_coll_Asset.add(B_coll_Asset).add(D_coll_Asset))

    // Check Bob's ICR is between 110 and 150
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    assert.isTrue(bob_ICR.gt(mv._MCR) && bob_ICR.lt(await th.getTCR(contracts)))

    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    assert.isTrue(bob_ICR_Asset.gt(mv._MCR) && bob_ICR_Asset.lt(await th.getTCR(contracts, erc20.address)))

    // Liquidate Bob
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner })
    await troveManager.liquidate(erc20.address, bob, { from: owner })

    // check stake and totalStakes after
    const bob_Stake_After = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STAKE_INDEX]
    const totalStakes_After = await troveManager.totalStakes(ZERO_ADDRESS)

    const bob_Stake_After_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_STAKE_INDEX]
    const totalStakes_After_Asset = await troveManager.totalStakes(erc20.address)

    assert.equal(bob_Stake_After, 0)
    assert.equal(totalStakes_After.toString(), A_coll.add(D_coll))

    assert.equal(bob_Stake_After_Asset, 0)
    assert.equal(totalStakes_After_Asset.toString(), A_coll_Asset.add(D_coll_Asset))

    // check Bob’s collateral surplus
    const bob_remainingCollateral = B_coll.sub(B_totalDebt.mul(th.toBN(dec(11, 17))).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, bob), bob_remainingCollateral)

    const bob_remainingCollateral_Asset = B_coll_Asset.sub(B_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, bob), bob_remainingCollateral_Asset)
    // can claim collateral
    const bob_balanceBefore = th.toBN(await web3.eth.getBalance(bob))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: bob, gasPrice: 0 })
    const bob_balanceAfter = th.toBN(await web3.eth.getBalance(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter, bob_balanceBefore.add(th.toBN(bob_remainingCollateral)))

    const bob_balanceBefore_Asset = th.toBN(await erc20.balanceOf(bob))
    await borrowerOperations.claimCollateral(erc20.address, { from: bob, gasPrice: 0 })
    const bob_balanceAfter_Asset = th.toBN(await erc20.balanceOf(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter_Asset, bob_balanceBefore_Asset.add(th.toBN(bob_remainingCollateral_Asset).div(toBN(10 ** 10))))
  })

  it("liquidate(), with  110% < ICR < TCR, and StabilityPool VST > debt to liquidate: updates system snapshots", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 VST of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 VST of debt, resulting in ICR of 240%. Bob has lowest ICR.
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: B_totalDebt, extraParams: { from: alice } })
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: B_totalDebt_Asset, extraParams: { from: alice } })
    const { collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    // Alice deposits VST in the Stability Pool
    await stabilityPool.provideToSP(B_totalDebt.add(toBN(1)), { from: alice })
    await stabilityPoolERC20.provideToSP(B_totalDebt_Asset.add(toBN(1)), { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // check system snapshots before
    const totalStakesSnaphot_before = (await troveManager.totalStakesSnapshot(ZERO_ADDRESS)).toString()
    const totalCollateralSnapshot_before = (await troveManager.totalCollateralSnapshot(ZERO_ADDRESS)).toString()

    const totalStakesSnaphot_before_Asset = (await troveManager.totalStakesSnapshot(erc20.address)).toString()
    const totalCollateralSnapshot_before_Asset = (await troveManager.totalCollateralSnapshot(erc20.address)).toString()

    assert.equal(totalStakesSnaphot_before, '0')
    assert.equal(totalCollateralSnapshot_before, '0')

    assert.equal(totalStakesSnaphot_before_Asset, '0')
    assert.equal(totalCollateralSnapshot_before_Asset, '0')

    // Check Bob's ICR is between 110 and TCR
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    assert.isTrue(bob_ICR.gt(mv._MCR) && bob_ICR.lt(await th.getTCR(contracts)))

    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    assert.isTrue(bob_ICR_Asset.gt(mv._MCR) && bob_ICR_Asset.lt(await th.getTCR(contracts, erc20.address)))

    // Liquidate Bob
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner })
    await troveManager.liquidate(erc20.address, bob, { from: owner })

    const totalStakesSnaphot_After = (await troveManager.totalStakesSnapshot(ZERO_ADDRESS))
    const totalCollateralSnapshot_After = (await troveManager.totalCollateralSnapshot(ZERO_ADDRESS))

    const totalStakesSnaphot_After_Asset = (await troveManager.totalStakesSnapshot(erc20.address))
    const totalCollateralSnapshot_After_Asset = (await troveManager.totalCollateralSnapshot(erc20.address))

    // totalStakesSnapshot should have reduced to 22 ether - the sum of Alice's coll( 20 ether) and Dennis' coll (2 ether )
    assert.equal(totalStakesSnaphot_After.toString(), A_coll.add(D_coll))
    assert.equal(totalStakesSnaphot_After_Asset.toString(), A_coll_Asset.add(D_coll_Asset))
    // Total collateral should also reduce, since all liquidated coll has been moved to a reward for Stability Pool depositors
    assert.equal(totalCollateralSnapshot_After.toString(), A_coll.add(D_coll))
    assert.equal(totalCollateralSnapshot_After_Asset.toString(), A_coll_Asset.add(D_coll_Asset))
  })

  it("liquidate(), with 110% < ICR < TCR, and StabilityPool VST > debt to liquidate: closes the Trove", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 VST of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 VST of debt, resulting in ICR of 240%. Bob has lowest ICR.
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: B_totalDebt, extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: B_totalDebt_Asset, extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    // Alice deposits VST in the Stability Pool
    await stabilityPool.provideToSP(B_totalDebt.add(toBN(1)), { from: alice })
    await stabilityPoolERC20.provideToSP(B_totalDebt_Asset.add(toBN(1)), { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check Bob's Trove is active
    const bob_TroveStatus_Before = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_Before = await sortedTroves.contains(ZERO_ADDRESS, bob)

    const bob_TroveStatus_Before_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_Before_Asset = await sortedTroves.contains(erc20.address, bob)

    assert.equal(bob_TroveStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_Before)
    assert.equal(bob_TroveStatus_Before_Asset, 1)
    assert.isTrue(bob_Trove_isInSortedList_Before_Asset)

    // Check Bob's ICR is between 110 and TCR
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    assert.isTrue(bob_ICR.gt(mv._MCR) && bob_ICR.lt(await th.getTCR(contracts)))

    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    assert.isTrue(bob_ICR_Asset.gt(mv._MCR) && bob_ICR_Asset.lt(await th.getTCR(contracts, erc20.address)))

    // Liquidate Bob
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner })
    await troveManager.liquidate(erc20.address, bob, { from: owner })

    // Check Bob's Trove is closed after liquidation
    const bob_TroveStatus_After = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_After = await sortedTroves.contains(ZERO_ADDRESS, bob)

    const bob_TroveStatus_After_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_After_Asset = await sortedTroves.contains(erc20.address, bob)

    assert.equal(bob_TroveStatus_After, 3) // status enum element 3 corresponds to "Closed by liquidation"
    assert.isFalse(bob_Trove_isInSortedList_After)
    assert.equal(bob_TroveStatus_After_Asset, 3)
    assert.isFalse(bob_Trove_isInSortedList_After_Asset)

    // check Bob’s collateral surplus
    const bob_remainingCollateral = B_coll.sub(B_totalDebt.mul(th.toBN(dec(11, 17))).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, bob), bob_remainingCollateral)

    const bob_remainingCollateral_Asset = B_coll_Asset.sub(B_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, bob), bob_remainingCollateral_Asset)
    // can claim collateral
    const bob_balanceBefore = th.toBN(await web3.eth.getBalance(bob))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: bob, gasPrice: 0 })
    const bob_balanceAfter = th.toBN(await web3.eth.getBalance(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter, bob_balanceBefore.add(th.toBN(bob_remainingCollateral)))

    const bob_balanceBefore_Asset = th.toBN(await erc20.balanceOf(bob))
    await borrowerOperations.claimCollateral(erc20.address, { from: bob, gasPrice: 0 })
    const bob_balanceAfter_Asset = th.toBN(await erc20.balanceOf(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter_Asset, bob_balanceBefore_Asset.add(th.toBN(bob_remainingCollateral_Asset).div(toBN(10 ** 10))))
  })

  it("liquidate(), with 110% < ICR < TCR, and StabilityPool VST > debt to liquidate: can liquidate troves out of order", async () => {
    // taking out 1000 VST, CR of 200%
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(202, 16)), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(204, 16)), extraParams: { from: carol } })
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: erin } })
    await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: freddy } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(202, 16)), extraParams: { from: bob } })
    const { collateral: C_coll_Asset, totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(204, 16)), extraParams: { from: carol } })
    const { collateral: D_coll_Asset, totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: erin } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: freddy } })

    const totalLiquidatedDebt = A_totalDebt.add(B_totalDebt).add(C_totalDebt).add(D_totalDebt)
    const totalLiquidatedDebt_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset).add(D_totalDebt_Asset)

    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: totalLiquidatedDebt, extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: totalLiquidatedDebt_Asset, extraParams: { from: whale } })
    await stabilityPool.provideToSP(totalLiquidatedDebt, { from: whale })
    await stabilityPoolERC20.provideToSP(totalLiquidatedDebt_Asset, { from: whale })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check troves A-D are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
    const ICR_D = await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
    const ICR_D_Asset = await troveManager.getCurrentICR(erc20.address, dennis, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))
    assert.isTrue(ICR_D.gt(mv._MCR) && ICR_D.lt(TCR))

    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Asset.gt(mv._MCR) && ICR_C_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_D_Asset.gt(mv._MCR) && ICR_D_Asset.lt(TCR_Asset))

    // Troves are ordered by ICR, low to high: A, B, C, D.

    // Liquidate out of ICR order: D, B, C.  Confirm Recovery Mode is active prior to each.
    const liquidationTx_D = await troveManager.liquidate(ZERO_ADDRESS, dennis)
    const liquidationTx_D_Asset = await troveManager.liquidate(erc20.address, dennis)

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    const liquidationTx_B = await troveManager.liquidate(ZERO_ADDRESS, bob)
    const liquidationTx_B_Asset = await troveManager.liquidate(erc20.address, bob)

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    const liquidationTx_C = await troveManager.liquidate(ZERO_ADDRESS, carol)
    const liquidationTx_C_Asset = await troveManager.liquidate(erc20.address, carol)

    // Check transactions all succeeded
    assert.isTrue(liquidationTx_D.receipt.status)
    assert.isTrue(liquidationTx_B.receipt.status)
    assert.isTrue(liquidationTx_C.receipt.status)

    assert.isTrue(liquidationTx_D_Asset.receipt.status)
    assert.isTrue(liquidationTx_B_Asset.receipt.status)
    assert.isTrue(liquidationTx_C_Asset.receipt.status)

    // Confirm troves D, B, C removed
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
    assert.equal((await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '3')
    assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '3')
    assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '3')

    assert.equal((await troveManager.Troves(dennis, erc20.address))[th.TROVE_STATUS_INDEX], '3')
    assert.equal((await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX], '3')
    assert.equal((await troveManager.Troves(carol, erc20.address))[th.TROVE_STATUS_INDEX], '3')

    // check collateral surplus
    const dennis_remainingCollateral = D_coll.sub(D_totalDebt.mul(th.toBN(dec(11, 17))).div(price))
    const bob_remainingCollateral = B_coll.sub(B_totalDebt.mul(th.toBN(dec(11, 17))).div(price))
    const carol_remainingCollateral = C_coll.sub(C_totalDebt.mul(th.toBN(dec(11, 17))).div(price))

    const dennis_remainingCollateral_Asset = D_coll_Asset.sub(D_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))
    const bob_remainingCollateral_Asset = B_coll_Asset.sub(B_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))
    const carol_remainingCollateral_Asset = C_coll_Asset.sub(C_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))

    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, dennis), dennis_remainingCollateral)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, bob), bob_remainingCollateral)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, carol), carol_remainingCollateral)

    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, dennis), dennis_remainingCollateral_Asset)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, bob), bob_remainingCollateral_Asset)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, carol), carol_remainingCollateral_Asset)

    // can claim collateral
    const dennis_balanceBefore = th.toBN(await web3.eth.getBalance(dennis))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: dennis, gasPrice: 0 })
    const dennis_balanceAfter = th.toBN(await web3.eth.getBalance(dennis))
    assert.isTrue(dennis_balanceAfter.eq(dennis_balanceBefore.add(th.toBN(dennis_remainingCollateral))))

    const dennis_balanceBefore_Asset = th.toBN(await erc20.balanceOf(dennis))
    await borrowerOperations.claimCollateral(erc20.address, { from: dennis, gasPrice: 0 })
    const dennis_balanceAfter_Asset = th.toBN(await erc20.balanceOf(dennis))
    assert.isTrue(dennis_balanceAfter_Asset.eq(dennis_balanceBefore_Asset.add(th.toBN(dennis_remainingCollateral_Asset).div(toBN(10 ** 10)))))

    const bob_balanceBefore = th.toBN(await web3.eth.getBalance(bob))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: bob, gasPrice: 0 })
    const bob_balanceAfter = th.toBN(await web3.eth.getBalance(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter, bob_balanceBefore.add(th.toBN(bob_remainingCollateral)))

    const bob_balanceBefore_Asset = th.toBN(await erc20.balanceOf(bob))
    await borrowerOperations.claimCollateral(erc20.address, { from: bob, gasPrice: 0 })
    const bob_balanceAfter_Asset = th.toBN(await erc20.balanceOf(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter_Asset, bob_balanceBefore_Asset.add(th.toBN(bob_remainingCollateral_Asset).div(toBN(10 ** 10))))

    const carol_balanceBefore = th.toBN(await web3.eth.getBalance(carol))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: carol, gasPrice: 0 })
    const carol_balanceAfter = th.toBN(await web3.eth.getBalance(carol))
    th.assertIsApproximatelyEqual(carol_balanceAfter, carol_balanceBefore.add(th.toBN(carol_remainingCollateral)))

    const carol_balanceBefore_Asset = th.toBN(await erc20.balanceOf(carol))
    await borrowerOperations.claimCollateral(erc20.address, { from: carol, gasPrice: 0 })
    const carol_balanceAfter_Asset = th.toBN(await erc20.balanceOf(carol))
    th.assertIsApproximatelyEqual(carol_balanceAfter_Asset, carol_balanceBefore_Asset.add(th.toBN(carol_remainingCollateral_Asset).div(toBN(10 ** 10))))
  })


  /* --- liquidate() applied to trove with ICR > 110% that has the lowest ICR, and Stability Pool 
  VST is LESS THAN the liquidated debt: a non fullfilled liquidation --- */

  it("liquidate(), with ICR > 110%, and StabilityPool VST < liquidated debt: Trove remains active", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 VST of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 VST of debt, resulting in ICR of 240%. Bob has lowest ICR.
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(1500, 18), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(1500, 18), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    // Alice deposits 1490 VST in the Stability Pool
    await stabilityPool.provideToSP('1490000000000000000000', { from: alice })
    await stabilityPoolERC20.provideToSP('1490000000000000000000', { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check Bob's Trove is active
    const bob_TroveStatus_Before = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_Before = await sortedTroves.contains(ZERO_ADDRESS, bob)

    const bob_TroveStatus_Before_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_Before_Asset = await sortedTroves.contains(erc20.address, bob)

    assert.equal(bob_TroveStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_Before)

    assert.equal(bob_TroveStatus_Before_Asset, 1)
    assert.isTrue(bob_Trove_isInSortedList_Before_Asset)

    // Try to liquidate Bob
    await assertRevert(troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner }), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidate(erc20.address, bob, { from: owner }), "TroveManager: nothing to liquidate")

    /* Since the pool only contains 100 VST, and Bob's pre-liquidation debt was 250 VST,
    expect Bob's trove to remain untouched, and remain active after liquidation */

    const bob_TroveStatus_After = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_After = await sortedTroves.contains(ZERO_ADDRESS, bob)

    const bob_TroveStatus_After_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_After_Asset = await sortedTroves.contains(erc20.address, bob)

    assert.equal(bob_TroveStatus_After, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_After)

    assert.equal(bob_TroveStatus_After_Asset, 1)
    assert.isTrue(bob_Trove_isInSortedList_After_Asset)
  })

  it("liquidate(), with ICR > 110%, and StabilityPool VST < liquidated debt: Trove remains in TroveOwners array", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 VST of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 VST of debt, resulting in ICR of 240%. Bob has lowest ICR.
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(1500, 18), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(1500, 18), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    // Alice deposits 100 VST in the Stability Pool
    await stabilityPool.provideToSP(dec(100, 18), { from: alice })
    await stabilityPoolERC20.provideToSP(dec(100, 18), { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check Bob's Trove is active
    const bob_TroveStatus_Before = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_Before = await sortedTroves.contains(ZERO_ADDRESS, bob)

    const bob_TroveStatus_Before_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX]
    const bob_Trove_isInSortedList_Before_Asset = await sortedTroves.contains(erc20.address, bob)

    assert.equal(bob_TroveStatus_Before, 1) // status enum element 1 corresponds to "Active"
    assert.isTrue(bob_Trove_isInSortedList_Before)
    assert.equal(bob_TroveStatus_Before_Asset, 1)
    assert.isTrue(bob_Trove_isInSortedList_Before_Asset)

    // Try to liquidate Bob
    await assertRevert(troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner }), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidate(erc20.address, bob, { from: owner }), "TroveManager: nothing to liquidate")

    /* Since the pool only contains 100 VST, and Bob's pre-liquidation debt was 250 VST,
    expect Bob's trove to only be partially offset, and remain active after liquidation */

    // Check Bob is in Trove owners array
    const arrayLength = (await troveManager.getTroveOwnersCount(ZERO_ADDRESS)).toNumber()
    let addressFound = false;
    let addressIdx = 0;

    for (let i = 0; i < arrayLength; i++) {
      const address = (await troveManager.TroveOwners(ZERO_ADDRESS, i)).toString()
      if (address == bob) {
        addressFound = true
        addressIdx = i
      }
    }

    assert.isTrue(addressFound);

    // Check TroveOwners idx on trove struct == idx of address found in TroveOwners array
    const idxOnStruct = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_ARRAY_INDEX].toString()
    assert.equal(addressIdx.toString(), idxOnStruct)

    const arrayLength_Asset = (await troveManager.getTroveOwnersCount(erc20.address)).toNumber()
    let addressFound_Asset = false;
    let addressIdx_Asset = 0;

    for (let i = 0; i < arrayLength_Asset; i++) {
      const address = (await troveManager.TroveOwners(erc20.address, i)).toString()
      if (address == bob) {
        addressFound_Asset = true
        addressIdx_Asset = i
      }
    }

    assert.isTrue(addressFound_Asset);

    // Check TroveOwners idx on trove struct == idx of address found in TroveOwners array
    const idxOnStruct_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_ARRAY_INDEX].toString()
    assert.equal(addressIdx_Asset.toString(), idxOnStruct_Asset)
  })

  it("liquidate(), with ICR > 110%, and StabilityPool VST < liquidated debt: nothing happens", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 VST of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 VST of debt, resulting in ICR of 240%. Bob has lowest ICR.
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(1500, 18), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    const { collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(1500, 18), extraParams: { from: alice } })
    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    const { collateral: D_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    // Alice deposits 100 VST in the Stability Pool
    await stabilityPool.provideToSP(dec(100, 18), { from: alice })
    await stabilityPoolERC20.provideToSP(dec(100, 18), { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Try to liquidate Bob
    await assertRevert(troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner }), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidate(erc20.address, bob, { from: owner }), "TroveManager: nothing to liquidate")

    /*  Since Bob's debt (250 VST) is larger than all VST in the Stability Pool, Liquidation won’t happen

    After liquidation, totalStakes snapshot should equal Alice's stake (20 ether) + Dennis stake (2 ether) = 22 ether.

    Since there has been no redistribution, the totalCollateral snapshot should equal the totalStakes snapshot: 22 ether.

    Bob's new coll and stake should remain the same, and the updated totalStakes should still equal 25 ether.
    */
    const bob_Trove = await troveManager.Troves(bob, ZERO_ADDRESS)
    const bob_DebtAfter = bob_Trove[th.TROVE_DEBT_INDEX].toString()
    const bob_CollAfter = bob_Trove[th.TROVE_COLL_INDEX].toString()
    const bob_StakeAfter = bob_Trove[th.TROVE_STAKE_INDEX].toString()

    const bob_Trove_Asset = await troveManager.Troves(bob, erc20.address)
    const bob_DebtAfter_Asset = bob_Trove_Asset[th.TROVE_DEBT_INDEX].toString()
    const bob_CollAfter_Asset = bob_Trove_Asset[th.TROVE_COLL_INDEX].toString()
    const bob_StakeAfter_Asset = bob_Trove_Asset[th.TROVE_STAKE_INDEX].toString()

    th.assertIsApproximatelyEqual(bob_DebtAfter, B_totalDebt)
    th.assertIsApproximatelyEqual(bob_DebtAfter_Asset, B_totalDebt_Asset)
    assert.equal(bob_CollAfter.toString(), B_coll)
    assert.equal(bob_StakeAfter.toString(), B_coll)
    assert.equal(bob_CollAfter_Asset.toString(), B_coll_Asset)
    assert.equal(bob_StakeAfter_Asset.toString(), B_coll_Asset)

    const totalStakes_After = (await troveManager.totalStakes(ZERO_ADDRESS)).toString()
    const totalStakes_After_Asset = (await troveManager.totalStakes(erc20.address)).toString()
    assert.equal(totalStakes_After.toString(), A_coll.add(B_coll).add(D_coll))
    assert.equal(totalStakes_After_Asset.toString(), A_coll_Asset.add(B_coll_Asset).add(D_coll_Asset))
  })

  it("liquidate(), with ICR > 110%, and StabilityPool VST < liquidated debt: updates system shapshots", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 VST of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 VST of debt, resulting in ICR of 240%. Bob has lowest ICR.
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(1500, 18), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(1500, 18), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    // Alice deposits 100 VST in the Stability Pool
    await stabilityPool.provideToSP(dec(100, 18), { from: alice })
    await stabilityPoolERC20.provideToSP(dec(100, 18), { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check snapshots before
    const totalStakesSnaphot_Before = (await troveManager.totalStakesSnapshot(ZERO_ADDRESS)).toString()
    const totalCollateralSnapshot_Before = (await troveManager.totalCollateralSnapshot(ZERO_ADDRESS)).toString()

    const totalStakesSnaphot_Before_Asset = (await troveManager.totalStakesSnapshot(erc20.address)).toString()
    const totalCollateralSnapshot_Before_Asset = (await troveManager.totalCollateralSnapshot(erc20.address)).toString()

    assert.equal(totalStakesSnaphot_Before, 0)
    assert.equal(totalCollateralSnapshot_Before, 0)
    assert.equal(totalStakesSnaphot_Before_Asset, 0)
    assert.equal(totalCollateralSnapshot_Before_Asset, 0)

    // Liquidate Bob, it won’t happen as there are no funds in the SP
    await assertRevert(troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner }), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidate(erc20.address, bob, { from: owner }), "TroveManager: nothing to liquidate")

    /* After liquidation, totalStakes snapshot should still equal the total stake: 25 ether

    Since there has been no redistribution, the totalCollateral snapshot should equal the totalStakes snapshot: 25 ether.*/

    const totalStakesSnaphot_After = (await troveManager.totalStakesSnapshot(ZERO_ADDRESS)).toString()
    const totalCollateralSnapshot_After = (await troveManager.totalCollateralSnapshot(ZERO_ADDRESS)).toString()
    const totalStakesSnaphot_After_Asset = (await troveManager.totalStakesSnapshot(erc20.address)).toString()
    const totalCollateralSnapshot_After_Asset = (await troveManager.totalCollateralSnapshot(erc20.address)).toString()

    assert.equal(totalStakesSnaphot_After, totalStakesSnaphot_Before)
    assert.equal(totalCollateralSnapshot_After, totalCollateralSnapshot_Before)
    assert.equal(totalStakesSnaphot_After_Asset, totalStakesSnaphot_Before_Asset)
    assert.equal(totalCollateralSnapshot_After_Asset, totalCollateralSnapshot_Before_Asset)
  })

  it("liquidate(), with ICR > 110%, and StabilityPool VST < liquidated debt: causes correct Pool offset and ETH gain, and doesn't redistribute to active troves", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 VST of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 VST of debt, resulting in ICR of 240%. Bob has lowest ICR.
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(1500, 18), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(1500, 18), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })

    // Alice deposits 100 VST in the Stability Pool
    await stabilityPool.provideToSP(dec(100, 18), { from: alice })
    await stabilityPoolERC20.provideToSP(dec(100, 18), { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Try to liquidate Bob. Shouldn’t happen
    await assertRevert(troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner }), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidate(erc20.address, bob, { from: owner }), "TroveManager: nothing to liquidate")

    // check Stability Pool rewards. Nothing happened, so everything should remain the same

    const aliceExpectedDeposit = await stabilityPool.getCompoundedVSTDeposit(alice)
    const aliceExpectedETHGain = await stabilityPool.getDepositorAssetGain(alice)

    const aliceExpectedDeposit_Asset = await stabilityPoolERC20.getCompoundedVSTDeposit(alice)
    const aliceExpectedETHGain_Asset = await stabilityPoolERC20.getDepositorAssetGain(alice)

    assert.equal(aliceExpectedDeposit.toString(), dec(100, 18))
    assert.equal(aliceExpectedETHGain.toString(), '0')

    assert.equal(aliceExpectedDeposit_Asset.toString(), dec(100, 18))
    assert.equal(aliceExpectedETHGain_Asset.toString(), '0')

    /* For this Recovery Mode test case with ICR > 110%, there should be no redistribution of remainder to active Troves. 
    Redistribution rewards-per-unit-staked should be zero. */

    const L_VSTDebt_After = (await troveManager.L_VSTDebts(ZERO_ADDRESS)).toString()
    const L_ETH_After = (await troveManager.L_ASSETS(ZERO_ADDRESS)).toString()

    const L_VSTDebt_After_Asset = (await troveManager.L_VSTDebts(erc20.address)).toString()
    const L_ETH_After_Asset = (await troveManager.L_ASSETS(erc20.address)).toString()

    assert.equal(L_VSTDebt_After, '0')
    assert.equal(L_ETH_After, '0')
    assert.equal(L_VSTDebt_After_Asset, '0')
    assert.equal(L_ETH_After_Asset, '0')
  })

  it("liquidate(), with ICR > 110%, and StabilityPool VST < liquidated debt: ICR of non liquidated trove does not change", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 VST of debt, and Dennis up to 150, resulting in ICRs of 266%.
    // Bob withdraws up to 250 VST of debt, resulting in ICR of 240%. Bob has lowest ICR.
    // Carol withdraws up to debt of 240 VST, -> ICR of 250%.
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(1500, 18), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(250, 16)), extraVSTAmount: dec(240, 18), extraParams: { from: carol } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(1500, 18), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraVSTAmount: dec(250, 18), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: dec(2000, 18), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(250, 16)), extraVSTAmount: dec(240, 18), extraParams: { from: carol } })

    // Alice deposits 100 VST in the Stability Pool
    await stabilityPool.provideToSP(dec(100, 18), { from: alice })
    await stabilityPoolERC20.provideToSP(dec(100, 18), { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const bob_ICR_Before = (await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).toString()
    const carol_ICR_Before = (await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).toString()

    const bob_ICR_Before_Asset = (await troveManager.getCurrentICR(erc20.address, bob, price)).toString()
    const carol_ICR_Before_Asset = (await troveManager.getCurrentICR(erc20.address, carol, price)).toString()

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    const bob_Coll_Before = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
    const bob_Debt_Before = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]

    const bob_Coll_Before_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
    const bob_Debt_Before_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_DEBT_INDEX]

    // confirm Bob is last trove in list, and has >110% ICR
    assert.equal((await sortedTroves.getLast(ZERO_ADDRESS)).toString(), bob)
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).gt(mv._MCR))

    assert.equal((await sortedTroves.getLast(erc20.address)).toString(), bob)
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, bob, price)).gt(mv._MCR))

    // L1: Try to liquidate Bob. Nothing happens
    await assertRevert(troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner }), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidate(erc20.address, bob, { from: owner }), "TroveManager: nothing to liquidate")

    //Check SP VST has been completely emptied
    assert.equal((await stabilityPool.getTotalVSTDeposits()).toString(), dec(100, 18))
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), dec(100, 18))

    // Check Bob remains active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isTrue(await sortedTroves.contains(erc20.address, bob))

    // Check Bob's collateral and debt remains the same
    const bob_Coll_After = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
    const bob_Debt_After = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]
    const bob_Coll_After_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
    const bob_Debt_After_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_DEBT_INDEX]
    assert.isTrue(bob_Coll_After.eq(bob_Coll_Before))
    assert.isTrue(bob_Debt_After.eq(bob_Debt_Before))
    assert.isTrue(bob_Coll_After_Asset.eq(bob_Coll_Before_Asset))
    assert.isTrue(bob_Debt_After_Asset.eq(bob_Debt_Before_Asset))

    const bob_ICR_After = (await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).toString()
    const bob_ICR_After_Asset = (await troveManager.getCurrentICR(erc20.address, bob, price)).toString()

    // check Bob's ICR has not changed
    assert.equal(bob_ICR_After, bob_ICR_Before)
    assert.equal(bob_ICR_After_Asset, bob_ICR_Before_Asset)


    // to compensate borrowing fees
    await vstToken.transfer(bob, toBN(dec(100, 18)).mul(toBN(2)), { from: alice })

    // Remove Bob from system to test Carol's trove: price rises, Bob closes trove, price drops to 100 again
    await priceFeed.setPrice(dec(200, 18))
    await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: bob })
    await borrowerOperations.closeTrove(erc20.address, { from: bob })
    await priceFeed.setPrice(dec(100, 18))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))

    // Alice provides another 50 VST to pool
    await stabilityPool.provideToSP(dec(50, 18), { from: alice })
    await stabilityPoolERC20.provideToSP(dec(50, 18), { from: alice })

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    const carol_Coll_Before = (await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
    const carol_Debt_Before = (await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]

    const carol_Coll_Before_Asset = (await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX]
    const carol_Debt_Before_Asset = (await troveManager.Troves(carol, erc20.address))[th.TROVE_DEBT_INDEX]

    // Confirm Carol is last trove in list, and has >110% ICR
    assert.equal((await sortedTroves.getLast(ZERO_ADDRESS)), carol)
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).gt(mv._MCR))

    assert.equal((await sortedTroves.getLast(erc20.address)), carol)
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, carol, price)).gt(mv._MCR))

    // L2: Try to liquidate Carol. Nothing happens
    await assertRevert(troveManager.liquidate(ZERO_ADDRESS, carol), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidate(erc20.address, carol), "TroveManager: nothing to liquidate")

    //Check SP VST has been completely emptied
    assert.equal((await stabilityPool.getTotalVSTDeposits()).toString(), dec(150, 18))
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), dec(150, 18))

    // Check Carol's collateral and debt remains the same
    const carol_Coll_After = (await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
    const carol_Debt_After = (await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]
    const carol_Coll_After_Asset = (await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX]
    const carol_Debt_After_Asset = (await troveManager.Troves(carol, erc20.address))[th.TROVE_DEBT_INDEX]

    assert.isTrue(carol_Coll_After.eq(carol_Coll_Before))
    assert.isTrue(carol_Debt_After.eq(carol_Debt_Before))
    assert.isTrue(carol_Coll_After_Asset.eq(carol_Coll_Before_Asset))
    assert.isTrue(carol_Debt_After_Asset.eq(carol_Debt_Before_Asset))

    const carol_ICR_After = (await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).toString()
    const carol_ICR_After_Asset = (await troveManager.getCurrentICR(erc20.address, carol, price)).toString()

    // check Carol's ICR has not changed
    assert.equal(carol_ICR_After, carol_ICR_Before)
    assert.equal(carol_ICR_After_Asset, carol_ICR_Before_Asset)

    //Confirm liquidations have not led to any redistributions to troves
    const L_VSTDebt_After = (await troveManager.L_VSTDebts(ZERO_ADDRESS)).toString()
    const L_ETH_After = (await troveManager.L_ASSETS(ZERO_ADDRESS)).toString()

    const L_VSTDebt_After_Asset = (await troveManager.L_VSTDebts(erc20.address)).toString()
    const L_ETH_After_Asset = (await troveManager.L_ASSETS(erc20.address)).toString()

    assert.equal(L_VSTDebt_After, '0')
    assert.equal(L_ETH_After, '0')
    assert.equal(L_VSTDebt_After_Asset, '0')
    assert.equal(L_ETH_After_Asset, '0')
  })

  it("liquidate() with ICR > 110%, and StabilityPool VST < liquidated debt: total liquidated coll and debt is correct", async () => {
    // Whale provides 50 VST to the SP
    await openTrove({ ICR: toBN(dec(300, 16)), extraVSTAmount: dec(50, 18), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraVSTAmount: dec(50, 18), extraParams: { from: whale } })

    await stabilityPool.provideToSP(dec(50, 18), { from: whale })
    await stabilityPoolERC20.provideToSP(dec(50, 18), { from: whale })

    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(202, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(204, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(208, 16)), extraParams: { from: erin } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(202, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(204, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(208, 16)), extraParams: { from: erin } })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check C is in range 110% < ICR < 150%
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(await th.getTCR(contracts)))
    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(await th.getTCR(contracts, erc20.address)))

    const entireSystemCollBefore = await troveManager.getEntireSystemColl(ZERO_ADDRESS)
    const entireSystemDebtBefore = await troveManager.getEntireSystemDebt(ZERO_ADDRESS)

    const entireSystemCollBefore_Asset = await troveManager.getEntireSystemColl(erc20.address)
    const entireSystemDebtBefore_Asset = await troveManager.getEntireSystemDebt(erc20.address)

    // Try to liquidate Alice
    await assertRevert(troveManager.liquidate(ZERO_ADDRESS, alice), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidate(erc20.address, alice), "TroveManager: nothing to liquidate")

    // Expect system debt and system coll not reduced
    const entireSystemCollAfter = await troveManager.getEntireSystemColl(ZERO_ADDRESS)
    const entireSystemDebtAfter = await troveManager.getEntireSystemDebt(ZERO_ADDRESS)

    const entireSystemCollAfter_Asset = await troveManager.getEntireSystemColl(erc20.address)
    const entireSystemDebtAfter_Asset = await troveManager.getEntireSystemDebt(erc20.address)

    const changeInEntireSystemColl = entireSystemCollBefore.sub(entireSystemCollAfter)
    const changeInEntireSystemDebt = entireSystemDebtBefore.sub(entireSystemDebtAfter)

    const changeInEntireSystemColl_Asset = entireSystemCollBefore_Asset.sub(entireSystemCollAfter_Asset)
    const changeInEntireSystemDebt_Asset = entireSystemDebtBefore_Asset.sub(entireSystemDebtAfter_Asset)

    assert.equal(changeInEntireSystemColl, '0')
    assert.equal(changeInEntireSystemDebt, '0')

    assert.equal(changeInEntireSystemColl_Asset, '0')
    assert.equal(changeInEntireSystemDebt_Asset, '0')
  })

  // --- 

  it("liquidate(): Doesn't liquidate undercollateralized trove if it is the only trove in the system", async () => {
    // Alice creates a single trove with 0.62 ETH and a debt of 62 VST, and provides 10 VST to SP
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await stabilityPool.provideToSP(dec(10, 18), { from: alice })
    await stabilityPoolERC20.provideToSP(dec(10, 18), { from: alice })

    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // Set ETH:USD price to 105
    await priceFeed.setPrice('105000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    const alice_ICR = (await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).toString()
    assert.equal(alice_ICR, '1050000000000000000')

    const alice_ICR_Asset = (await troveManager.getCurrentICR(erc20.address, alice, price)).toString()
    assert.equal(alice_ICR_Asset, '1050000000000000000')

    const activeTrovesCount_Before = await troveManager.getTroveOwnersCount(ZERO_ADDRESS)
    const activeTrovesCount_Before_Asset = await troveManager.getTroveOwnersCount(erc20.address)

    assert.equal(activeTrovesCount_Before, 1)
    assert.equal(activeTrovesCount_Before_Asset, 1)

    // Try to liquidate the trove
    await assertRevert(troveManager.liquidate(ZERO_ADDRESS, alice, { from: owner }), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidate(erc20.address, alice, { from: owner }), "TroveManager: nothing to liquidate")

    // Check Alice's trove has not been removed
    const activeTrovesCount_After = await troveManager.getTroveOwnersCount(ZERO_ADDRESS)
    assert.equal(activeTrovesCount_After, 1)

    const activeTrovesCount_After_Asset = await troveManager.getTroveOwnersCount(erc20.address)
    assert.equal(activeTrovesCount_After_Asset, 1)

    const alice_isInSortedList = await sortedTroves.contains(ZERO_ADDRESS, alice)
    assert.isTrue(alice_isInSortedList)

    const alice_isInSortedList_Asset = await sortedTroves.contains(erc20.address, alice)
    assert.isTrue(alice_isInSortedList_Asset)
  })

  it("liquidate(): Liquidates undercollateralized trove if there are two troves in the system", async () => {
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: alice } })

    // Alice proves 10 VST to SP
    await stabilityPool.provideToSP(dec(10, 18), { from: alice })
    await stabilityPoolERC20.provideToSP(dec(10, 18), { from: alice })

    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // Set ETH:USD price to 105
    await priceFeed.setPrice('105000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    const alice_ICR = (await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).toString()
    assert.equal(alice_ICR, '1050000000000000000')

    const alice_ICR_Asset = (await troveManager.getCurrentICR(erc20.address, alice, price)).toString()
    assert.equal(alice_ICR_Asset, '1050000000000000000')

    const activeTrovesCount_Before = await troveManager.getTroveOwnersCount(ZERO_ADDRESS)
    const activeTrovesCount_Before_Asset = await troveManager.getTroveOwnersCount(erc20.address)

    assert.equal(activeTrovesCount_Before, 2)
    assert.equal(activeTrovesCount_Before_Asset, 2)

    // Liquidate the trove
    await troveManager.liquidate(ZERO_ADDRESS, alice, { from: owner })
    await troveManager.liquidate(erc20.address, alice, { from: owner })

    // Check Alice's trove is removed, and bob remains
    const activeTrovesCount_After = await troveManager.getTroveOwnersCount(ZERO_ADDRESS)
    const activeTrovesCount_After_Asset = await troveManager.getTroveOwnersCount(erc20.address)
    assert.equal(activeTrovesCount_After, 1)
    assert.equal(activeTrovesCount_After_Asset, 1)

    const alice_isInSortedList = await sortedTroves.contains(ZERO_ADDRESS, alice)
    const alice_isInSortedList_Asset = await sortedTroves.contains(erc20.address, alice)
    assert.isFalse(alice_isInSortedList)
    assert.isFalse(alice_isInSortedList_Asset)

    const bob_isInSortedList = await sortedTroves.contains(ZERO_ADDRESS, bob)
    const bob_isInSortedList_Asset = await sortedTroves.contains(erc20.address, bob)
    assert.isTrue(bob_isInSortedList)
    assert.isTrue(bob_isInSortedList_Asset)
  })

  it("liquidate(): does nothing if trove has >= 110% ICR and the Stability Pool is empty", async () => {
    await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(220, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraParams: { from: carol } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraParams: { from: carol } })

    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const TCR_Before = (await th.getTCR(contracts)).toString()
    const listSize_Before = (await sortedTroves.getSize(ZERO_ADDRESS)).toString()

    const TCR_Before_Asset = (await th.getTCR(contracts, erc20.address)).toString()
    const listSize_Before_Asset = (await sortedTroves.getSize(erc20.address)).toString()

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check Bob's ICR > 110%
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    assert.isTrue(bob_ICR.gte(mv._MCR))

    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    assert.isTrue(bob_ICR_Asset.gte(mv._MCR))

    // Confirm SP is empty
    const VSTinSP = (await stabilityPool.getTotalVSTDeposits()).toString()
    assert.equal(VSTinSP, '0')

    const VSTinSP_Asset = (await stabilityPoolERC20.getTotalVSTDeposits()).toString()
    assert.equal(VSTinSP_Asset, '0')

    // Attempt to liquidate bob
    await assertRevert(troveManager.liquidate(ZERO_ADDRESS, bob), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidate(erc20.address, bob), "TroveManager: nothing to liquidate")

    // check A, B, C remain active
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, bob)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, alice)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, carol)))

    assert.isTrue((await sortedTroves.contains(erc20.address, bob)))
    assert.isTrue((await sortedTroves.contains(erc20.address, alice)))
    assert.isTrue((await sortedTroves.contains(erc20.address, carol)))

    const TCR_After = (await th.getTCR(contracts)).toString()
    const listSize_After = (await sortedTroves.getSize(ZERO_ADDRESS)).toString()

    const TCR_After_Asset = (await th.getTCR(contracts, erc20.address)).toString()
    const listSize_After_Asset = (await sortedTroves.getSize(erc20.address)).toString()

    // Check TCR and list size have not changed
    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)

    assert.equal(TCR_Before_Asset, TCR_After_Asset)
    assert.equal(listSize_Before_Asset, listSize_After_Asset)
  })

  it("liquidate(): does nothing if trove ICR >= TCR, and SP covers trove's debt", async () => {
    await openTrove({ ICR: toBN(dec(166, 16)), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(154, 16)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(142, 16)), extraParams: { from: C } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(166, 16)), extraParams: { from: A } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(154, 16)), extraParams: { from: B } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(142, 16)), extraParams: { from: C } })

    // C fills SP with 130 VST
    await stabilityPool.provideToSP(dec(130, 18), { from: C })
    await stabilityPoolERC20.provideToSP(dec(130, 18), { from: C })

    await priceFeed.setPrice(dec(150, 18))
    const price = await priceFeed.getPrice()
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, A, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, B, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, C, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, A, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, B, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, C, price)

    assert.isTrue(ICR_A.gt(TCR))
    assert.isTrue(ICR_A_Asset.gt(TCR_Asset))
    // Try to liquidate A
    await assertRevert(troveManager.liquidate(ZERO_ADDRESS, A), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidate(erc20.address, A), "TroveManager: nothing to liquidate")

    // Check liquidation of A does nothing - trove remains in system
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, A))
    assert.equal(await troveManager.getTroveStatus(ZERO_ADDRESS, A), 1) // Status 1 -> active

    assert.isTrue(await sortedTroves.contains(erc20.address, A))
    assert.equal(await troveManager.getTroveStatus(erc20.address, A), 1)

    // Check C, with ICR < TCR, can be liquidated
    assert.isTrue(ICR_C.lt(TCR))
    assert.isTrue(ICR_C_Asset.lt(TCR_Asset))

    const liqTxC = await troveManager.liquidate(ZERO_ADDRESS, C)
    const liqTxC_Asset = await troveManager.liquidate(erc20.address, C)
    assert.isTrue(liqTxC.receipt.status)
    assert.isTrue(liqTxC_Asset.receipt.status)

    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, C))
    assert.equal(await troveManager.getTroveStatus(ZERO_ADDRESS, C), 3) // Status liquidated

    assert.isFalse(await sortedTroves.contains(erc20.address, C))
    assert.equal(await troveManager.getTroveStatus(erc20.address, C), 3)
  })

  it("liquidate(): reverts if trove is non-existent", async () => {
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(133, 16)), extraParams: { from: bob } })

    await priceFeed.setPrice(dec(100, 18))

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check Carol does not have an existing trove
    assert.equal(await troveManager.getTroveStatus(ZERO_ADDRESS, carol), 0)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

    assert.equal(await troveManager.getTroveStatus(erc20.address, carol), 0)
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    try {
      const txCarol = await troveManager.liquidate(ZERO_ADDRESS, carol)
      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }

    try {
      const txCarol = await troveManager.liquidate(erc20.address, carol)
      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("liquidate(): reverts if trove has been closed", async () => {
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: carol } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(133, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(133, 16)), extraParams: { from: carol } })

    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))

    // Price drops, Carol ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Carol liquidated, and her trove is closed
    const txCarol_L1 = await troveManager.liquidate(ZERO_ADDRESS, carol)
    assert.isTrue(txCarol_L1.receipt.status)

    const txCarol_L1_Asset = await troveManager.liquidate(erc20.address, carol)
    assert.isTrue(txCarol_L1_Asset.receipt.status)

    // Check Carol's trove is closed by liquidation
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.equal(await troveManager.getTroveStatus(ZERO_ADDRESS, carol), 3)

    assert.isFalse(await sortedTroves.contains(erc20.address, carol))
    assert.equal(await troveManager.getTroveStatus(erc20.address, carol), 3)

    try {
      await troveManager.liquidate(ZERO_ADDRESS, carol)
    } catch (err) {
      assert.include(err.message, "revert")
    }

    try {
      await troveManager.liquidate(erc20.address, carol)
    } catch (err) {
      assert.include(err.message, "revert")
    }
  })

  it("liquidate(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(220, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: carol } })

    // Defaulter opens with 60 VST, 0.6 ETH
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_1 } })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    const alice_ICR_Before = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const bob_ICR_Before = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const carol_ICR_Before = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const alice_ICR_Before_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const bob_ICR_Before_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const carol_ICR_Before_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    /* Before liquidation: 
    Alice ICR: = (1 * 100 / 50) = 200%
    Bob ICR: (1 * 100 / 90.5) = 110.5%
    Carol ICR: (1 * 100 / 100 ) =  100%

    Therefore Alice and Bob above the MCR, Carol is below */
    assert.isTrue(alice_ICR_Before.gte(mv._MCR))
    assert.isTrue(bob_ICR_Before.gte(mv._MCR))
    assert.isTrue(carol_ICR_Before.lte(mv._MCR))

    assert.isTrue(alice_ICR_Before_Asset.gte(mv._MCR))
    assert.isTrue(bob_ICR_Before_Asset.gte(mv._MCR))
    assert.isTrue(carol_ICR_Before_Asset.lte(mv._MCR))

    // Liquidate defaulter. 30 VST and 0.3 ETH is distributed uniformly between A, B and C. Each receive 10 VST, 0.1 ETH
    await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
    await troveManager.liquidate(erc20.address, defaulter_1)

    const alice_ICR_After = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const bob_ICR_After = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const carol_ICR_After = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const alice_ICR_After_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const bob_ICR_After_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const carol_ICR_After_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    /* After liquidation: 

    Alice ICR: (1.1 * 100 / 60) = 183.33%
    Bob ICR:(1.1 * 100 / 100.5) =  109.45%
    Carol ICR: (1.1 * 100 ) 100%

    Check Alice is above MCR, Bob below, Carol below. */
    assert.isTrue(alice_ICR_After.gte(mv._MCR))
    assert.isTrue(bob_ICR_After.lte(mv._MCR))
    assert.isTrue(carol_ICR_After.lte(mv._MCR))

    assert.isTrue(alice_ICR_After_Asset.gte(mv._MCR))
    assert.isTrue(bob_ICR_After_Asset.lte(mv._MCR))
    assert.isTrue(carol_ICR_After_Asset.lte(mv._MCR))

    /* Though Bob's true ICR (including pending rewards) is below the MCR, 
    check that Bob's raw coll and debt has not changed, and that his "raw" ICR is above the MCR */
    const bob_Coll = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
    const bob_Debt = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]

    const bob_Coll_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
    const bob_Debt_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_DEBT_INDEX]

    const bob_rawICR = bob_Coll.mul(th.toBN(dec(100, 18))).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    const bob_rawICR_Asset = bob_Coll_Asset.mul(th.toBN(dec(100, 18))).div(bob_Debt_Asset)
    assert.isTrue(bob_rawICR_Asset.gte(mv._MCR))

    //liquidate A, B, C
    await assertRevert(troveManager.liquidate(ZERO_ADDRESS, alice), "TroveManager: nothing to liquidate")
    await troveManager.liquidate(ZERO_ADDRESS, bob)
    await troveManager.liquidate(ZERO_ADDRESS, carol)

    await assertRevert(troveManager.liquidate(erc20.address, alice), "TroveManager: nothing to liquidate")
    await troveManager.liquidate(erc20.address, bob)
    await troveManager.liquidate(erc20.address, carol)

    /*  Since there is 0 VST in the stability Pool, A, with ICR >110%, should stay active.
    Check Alice stays active, Carol gets liquidated, and Bob gets liquidated 
    (because his pending rewards bring his ICR < MCR) */
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

    assert.isTrue(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // check trove statuses - A active (1), B and C liquidated (3)
    assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '1')
    assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')

    assert.equal((await troveManager.Troves(alice, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '1')
    assert.equal((await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(carol, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
  })

  it("liquidate(): does not affect the SP deposit or ETH gain when called on an SP depositor's address that has no trove", async () => {
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    const { collateral: C_coll_Asset, totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    const spDeposit = C_totalDebt.add(toBN(dec(1000, 18)))
    const spDeposit_Asset = C_totalDebt_Asset.add(toBN(dec(1000, 18)))

    await openTrove({ ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit, extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: bob } })

    // Bob sends tokens to Dennis, who has no trove
    await vstToken.transfer(dennis, spDeposit.add(spDeposit_Asset), { from: bob })

    //Dennis provides 200 VST to SP
    await stabilityPool.provideToSP(spDeposit, { from: dennis })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: dennis })

    // Price drop
    await priceFeed.setPrice(dec(105, 18))

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Carol gets liquidated
    await troveManager.liquidate(ZERO_ADDRESS, carol)
    await troveManager.liquidate(erc20.address, carol)

    // Check Dennis' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const dennis_Deposit_Before = (await stabilityPool.getCompoundedVSTDeposit(dennis)).toString()
    const dennis_ETHGain_Before = (await stabilityPool.getDepositorAssetGain(dennis)).toString()
    assert.isAtMost(th.getDifference(dennis_Deposit_Before, spDeposit.sub(C_totalDebt)), 1000)
    assert.isAtMost(th.getDifference(dennis_ETHGain_Before, th.applyLiquidationFee(C_coll)), 1000)

    const dennis_Deposit_Before_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(dennis)).toString()
    const dennis_ETHGain_Before_Asset = (await stabilityPoolERC20.getDepositorAssetGain(dennis)).toString()
    assert.isAtMost(th.getDifference(dennis_Deposit_Before_Asset, spDeposit_Asset.sub(C_totalDebt_Asset)), 1000)
    assert.isAtMost(th.getDifference(dennis_ETHGain_Before_Asset, th.applyLiquidationFee(C_coll_Asset.div(toBN(10 ** 10)))), 1000)

    // Attempt to liquidate Dennis
    try {
      await troveManager.liquidate(ZERO_ADDRESS, dennis)
    } catch (err) {
      assert.include(err.message, "revert")
    }

    try {
      await troveManager.liquidate(erc20.address, dennis)
    } catch (err) {
      assert.include(err.message, "revert")
    }

    // Check Dennis' SP deposit does not change after liquidation attempt
    const dennis_Deposit_After = (await stabilityPool.getCompoundedVSTDeposit(dennis)).toString()
    const dennis_ETHGain_After = (await stabilityPool.getDepositorAssetGain(dennis)).toString()
    assert.equal(dennis_Deposit_Before, dennis_Deposit_After)
    assert.equal(dennis_ETHGain_Before, dennis_ETHGain_After)


    const dennis_Deposit_After_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(dennis)).toString()
    const dennis_ETHGain_After_Asset = (await stabilityPoolERC20.getDepositorAssetGain(dennis)).toString()
    assert.equal(dennis_Deposit_Before_Asset, dennis_Deposit_After_Asset)
    assert.equal(dennis_ETHGain_Before_Asset, dennis_ETHGain_After_Asset)
  })

  it("liquidate(): does not alter the liquidated user's token balance", async () => {
    await openTrove({ ICR: toBN(dec(220, 16)), extraVSTAmount: dec(1000, 18), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraVSTAmount: dec(1000, 18), extraParams: { from: whale } })

    const { VSTAmount: A_VSTAmount } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(300, 18), extraParams: { from: alice } })
    const { VSTAmount: B_VSTAmount } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(200, 18), extraParams: { from: bob } })
    const { VSTAmount: C_VSTAmount } = await openTrove({ ICR: toBN(dec(206, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: carol } })

    const { VSTAmount: A_VSTAmount_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(300, 18), extraParams: { from: alice } })
    const { VSTAmount: B_VSTAmount_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(200, 18), extraParams: { from: bob } })
    const { VSTAmount: C_VSTAmount_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(206, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: carol } })

    await priceFeed.setPrice(dec(105, 18))

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check token balances 
    assert.equal((await vstToken.balanceOf(alice)).toString(), A_VSTAmount.add(A_VSTAmount_Asset))
    assert.equal((await vstToken.balanceOf(bob)).toString(), B_VSTAmount.add(B_VSTAmount_Asset))
    assert.equal((await vstToken.balanceOf(carol)).toString(), C_VSTAmount.add(C_VSTAmount_Asset))

    // Check sortedList size is 4
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '4')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '4')

    // Liquidate A, B and C
    await troveManager.liquidate(ZERO_ADDRESS, alice)
    await troveManager.liquidate(ZERO_ADDRESS, bob)
    await troveManager.liquidate(ZERO_ADDRESS, carol)

    await troveManager.liquidate(erc20.address, alice)
    await troveManager.liquidate(erc20.address, bob)
    await troveManager.liquidate(erc20.address, carol)

    // Confirm A, B, C closed
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

    assert.isFalse(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // Check sortedList size reduced to 1
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '1')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '1')

    // Confirm token balances have not changed
    assert.equal((await vstToken.balanceOf(alice)).toString(), A_VSTAmount.add(A_VSTAmount_Asset))
    assert.equal((await vstToken.balanceOf(bob)).toString(), B_VSTAmount.add(B_VSTAmount_Asset))
    assert.equal((await vstToken.balanceOf(carol)).toString(), C_VSTAmount.add(C_VSTAmount_Asset))
  })

  it("liquidate(), with 110% < ICR < TCR, can claim collateral, re-open, be reedemed and claim again", async () => {
    // --- SETUP ---
    // Alice withdraws up to 1500 VST of debt, resulting in ICRs of 266%.
    // Bob withdraws up to 480 VST of debt, resulting in ICR of 240%. Bob has lowest ICR.
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraVSTAmount: dec(480, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: B_totalDebt, extraParams: { from: alice } })

    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraVSTAmount: dec(480, 18), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: B_totalDebt, extraParams: { from: alice } })

    // Alice deposits VST in the Stability Pool
    await stabilityPool.provideToSP(B_totalDebt, { from: alice })
    await stabilityPoolERC20.provideToSP(B_totalDebt_Asset, { from: alice })

    // --- TEST ---
    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    let price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check Bob's ICR is between 110 and TCR
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    assert.isTrue(bob_ICR.gt(mv._MCR) && bob_ICR.lt(TCR))

    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    assert.isTrue(bob_ICR_Asset.gt(mv._MCR) && bob_ICR_Asset.lt(TCR_Asset))

    // Liquidate Bob
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner })
    await troveManager.liquidate(erc20.address, bob, { from: owner })

    // check Bob’s collateral surplus: 5.76 * 100 - 480 * 1.1
    const bob_remainingCollateral = B_coll.sub(B_totalDebt.mul(th.toBN(dec(11, 17))).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, bob), bob_remainingCollateral)

    const bob_remainingCollateral_Asset = B_coll_Asset.sub(B_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, bob), bob_remainingCollateral_Asset)
    // can claim collateral
    const bob_balanceBefore = th.toBN(await web3.eth.getBalance(bob))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: bob, gasPrice: 0 })
    const bob_balanceAfter = th.toBN(await web3.eth.getBalance(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter, bob_balanceBefore.add(th.toBN(bob_remainingCollateral)))

    const bob_balanceBefore_Asset = th.toBN(await erc20.balanceOf(bob))
    await borrowerOperations.claimCollateral(erc20.address, { from: bob, gasPrice: 0 })
    const bob_balanceAfter_Asset = th.toBN(await erc20.balanceOf(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter_Asset, bob_balanceBefore_Asset.add(th.toBN(bob_remainingCollateral_Asset).div(toBN(10 ** 10))))

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Bob re-opens the trove, price 200, total debt 80 VST, ICR = 120% (lowest one)
    // Dennis redeems 30, so Bob has a surplus of (200 * 0.48 - 30) / 200 = 0.33 ETH
    await priceFeed.setPrice('200000000000000000000')
    const { collateral: B_coll_2, netDebt: B_netDebt_2 } = await openTrove({ ICR: toBN(dec(150, 16)), extraVSTAmount: dec(480, 18), extraParams: { from: bob, value: bob_remainingCollateral } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: B_netDebt_2, extraParams: { from: dennis } })

    const { collateral: B_coll_2_Asset, netDebt: B_netDebt_2_Asset } = await openTrove({ asset: erc20.address, assetSent: bob_remainingCollateral_Asset, ICR: toBN(dec(150, 16)), extraVSTAmount: dec(480, 18), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: B_netDebt_2_Asset, extraParams: { from: dennis } })

    await th.redeemCollateral(dennis, contracts, B_netDebt_2)
    await th.redeemCollateral(dennis, contracts, B_netDebt_2_Asset, erc20.address)

    price = await priceFeed.getPrice()
    const bob_surplus = B_coll_2.sub(B_netDebt_2.mul(mv._1e18BN).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, bob), bob_surplus)

    const bob_surplus_Asset = B_coll_2_Asset.sub(B_netDebt_2_Asset.mul(mv._1e18BN).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, bob), bob_surplus_Asset)

    // can claim collateral
    const bob_balanceBefore_2 = th.toBN(await web3.eth.getBalance(bob))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: bob, gasPrice: 0 })
    const bob_balanceAfter_2 = th.toBN(await web3.eth.getBalance(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter_2, bob_balanceBefore_2.add(th.toBN(bob_surplus)))

    const bob_balanceBefore_2_Asset = th.toBN(await erc20.balanceOf(bob))
    await borrowerOperations.claimCollateral(erc20.address, { from: bob, gasPrice: 0 })
    const bob_balanceAfter_2_Asset = th.toBN(await erc20.balanceOf(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter_2_Asset, bob_balanceBefore_2_Asset.add(th.toBN(bob_surplus_Asset).div(toBN(10 ** 10))))
  })

  it("liquidate(), with 110% < ICR < TCR, can claim collateral, after another claim from a redemption", async () => {
    // --- SETUP ---
    // Bob withdraws up to 90 VST of debt, resulting in ICR of 222%
    const { collateral: B_coll, netDebt: B_netDebt } = await openTrove({ ICR: toBN(dec(222, 16)), extraVSTAmount: dec(90, 18), extraParams: { from: bob } })
    // Dennis withdraws to 150 VST of debt, resulting in ICRs of 266%.
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: B_netDebt, extraParams: { from: dennis } })

    const { collateral: B_coll_Asset, netDebt: B_netDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(222, 16)), extraVSTAmount: dec(90, 18), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: B_netDebt_Asset, extraParams: { from: dennis } })

    // --- TEST ---
    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Dennis redeems 40, so Bob has a surplus of (200 * 1 - 40) / 200 = 0.8 ETH
    await th.redeemCollateral(dennis, contracts, B_netDebt)
    await th.redeemCollateral(dennis, contracts, B_netDebt_Asset, erc20.address)
    let price = await priceFeed.getPrice()

    const bob_surplus = B_coll.sub(B_netDebt.mul(mv._1e18BN).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, bob), bob_surplus)

    const bob_surplus_Asset = B_coll_Asset.sub(B_netDebt_Asset.mul(mv._1e18BN).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, bob), bob_surplus_Asset)

    // can claim collateral
    const bob_balanceBefore = th.toBN(await web3.eth.getBalance(bob))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: bob, gasPrice: 0 })
    const bob_balanceAfter = th.toBN(await web3.eth.getBalance(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter, bob_balanceBefore.add(bob_surplus))

    const bob_balanceBefore_Asset = th.toBN(await erc20.balanceOf(bob))
    await borrowerOperations.claimCollateral(erc20.address, { from: bob, gasPrice: 0 })
    const bob_balanceAfter_Asset = th.toBN(await erc20.balanceOf(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter_Asset, bob_balanceBefore_Asset.add(bob_surplus_Asset.div(toBN(10 ** 10))))

    // Bob re-opens the trove, price 200, total debt 250 VST, ICR = 240% (lowest one)
    const { collateral: B_coll_2, totalDebt: B_totalDebt_2 } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: bob, value: _3_Ether } })
    const { collateral: B_coll_2_Asset, totalDebt: B_totalDebt_2_Asset } = await openTrove({ asset: erc20.address, assetSent: _3_Ether, ICR: toBN(dec(240, 16)), extraParams: { from: bob } })
    // Alice deposits VST in the Stability Pool
    await openTrove({ ICR: toBN(dec(266, 16)), extraVSTAmount: B_totalDebt_2, extraParams: { from: alice } })
    await stabilityPool.provideToSP(B_totalDebt_2, { from: alice })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraVSTAmount: B_totalDebt_2_Asset, extraParams: { from: alice } })
    await stabilityPoolERC20.provideToSP(B_totalDebt_2_Asset, { from: alice })

    // price drops to 1ETH:100VST, reducing TCR below 150%
    await priceFeed.setPrice('100000000000000000000')
    price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check Bob's ICR is between 110 and TCR
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    assert.isTrue(bob_ICR.gt(mv._MCR) && bob_ICR.lt(TCR))

    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    assert.isTrue(bob_ICR_Asset.gt(mv._MCR) && bob_ICR_Asset.lt(TCR_Asset))
    // debt is increased by fee, due to previous redemption
    const bob_debt = await troveManager.getTroveDebt(ZERO_ADDRESS, bob)
    const bob_debt_Asset = await troveManager.getTroveDebt(erc20.address, bob)

    // Liquidate Bob
    await troveManager.liquidate(ZERO_ADDRESS, bob, { from: owner })
    await troveManager.liquidate(erc20.address, bob, { from: owner })

    // check Bob’s collateral surplus
    const bob_remainingCollateral = B_coll_2.sub(B_totalDebt_2.mul(th.toBN(dec(11, 17))).div(price))
    th.assertIsApproximatelyEqual((await collSurplusPool.getCollateral(ZERO_ADDRESS, bob)).toString(), bob_remainingCollateral.toString())

    const bob_remainingCollateral_Asset = B_coll_2_Asset.sub(B_totalDebt_2_Asset.mul(th.toBN(dec(11, 17))).div(price))
    th.assertIsApproximatelyEqual((await collSurplusPool.getCollateral(erc20.address, bob)).toString(), bob_remainingCollateral_Asset.toString())

    // can claim collateral
    const bob_balanceBefore_2 = th.toBN(await web3.eth.getBalance(bob))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: bob, gasPrice: 0 })
    const bob_balanceAfter_2 = th.toBN(await web3.eth.getBalance(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter_2, bob_balanceBefore_2.add(th.toBN(bob_remainingCollateral)))

    const bob_balanceBefore_2_Asset = th.toBN(await erc20.balanceOf(bob))
    await borrowerOperations.claimCollateral(erc20.address, { from: bob, gasPrice: 0 })
    const bob_balanceAfter_2_Asset = th.toBN(await erc20.balanceOf(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter_2_Asset, bob_balanceBefore_2_Asset.add(th.toBN(bob_remainingCollateral_Asset).div(toBN(10 ** 10))))
  })

  // --- liquidateTroves ---

  it("liquidateTroves(): With all ICRs > 110%, Liquidates Troves until system leaves recovery mode", async () => {
    // make 8 Troves accordingly
    // --- SETUP ---

    // Everyone withdraws some VST from their Trove, resulting in different ICRs
    await openTrove({ ICR: toBN(dec(350, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(286, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(273, 16)), extraParams: { from: dennis } })
    const { totalDebt: E_totalDebt } = await openTrove({ ICR: toBN(dec(261, 16)), extraParams: { from: erin } })
    const { totalDebt: F_totalDebt } = await openTrove({ ICR: toBN(dec(250, 16)), extraParams: { from: freddy } })
    const { totalDebt: G_totalDebt } = await openTrove({ ICR: toBN(dec(235, 16)), extraParams: { from: greta } })
    const { totalDebt: H_totalDebt } = await openTrove({ ICR: toBN(dec(222, 16)), extraVSTAmount: dec(5000, 18), extraParams: { from: harry } })
    const liquidationAmount = E_totalDebt.add(F_totalDebt).add(G_totalDebt).add(H_totalDebt)
    await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: liquidationAmount, extraParams: { from: alice } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(350, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(286, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(273, 16)), extraParams: { from: dennis } })
    const { totalDebt: E_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(261, 16)), extraParams: { from: erin } })
    const { totalDebt: F_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(250, 16)), extraParams: { from: freddy } })
    const { totalDebt: G_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(235, 16)), extraParams: { from: greta } })
    const { totalDebt: H_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(222, 16)), extraVSTAmount: dec(5000, 18), extraParams: { from: harry } })
    const liquidationAmount_Asset = E_totalDebt_Asset.add(F_totalDebt_Asset).add(G_totalDebt_Asset).add(H_totalDebt_Asset)
    await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: liquidationAmount, extraParams: { from: alice } })

    // Alice deposits VST to Stability Pool
    await stabilityPool.provideToSP(liquidationAmount, { from: alice })
    await stabilityPoolERC20.provideToSP(liquidationAmount, { from: alice })

    // price drops
    // price drops to 1ETH:90VST, reducing TCR below 150%
    await priceFeed.setPrice('90000000000000000000')
    const price = await priceFeed.getPrice()

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // check TCR < 150%
    const _150percent = web3.utils.toBN('1500000000000000000')
    const TCR_Before = await th.getTCR(contracts)
    assert.isTrue(TCR_Before.lt(_150percent))

    const TCR_Before_Asset = await th.getTCR(contracts, erc20.address)
    assert.isTrue(TCR_Before_Asset.lt(_150percent))

    /* 
   After the price drop and prior to any liquidations, ICR should be:

    Trove         ICR
    Alice       161%
    Bob         158%
    Carol       129%
    Dennis      123%
    Elisa       117%
    Freddy      113%
    Greta       106%
    Harry       100%

    */
    const alice_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const carol_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
    const dennis_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)
    const erin_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)
    const freddy_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, freddy, price)
    const greta_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, greta, price)
    const harry_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, harry, price)
    const TCR = await th.getTCR(contracts)


    const alice_ICR_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const carol_ICR_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
    const dennis_ICR_Asset = await troveManager.getCurrentICR(erc20.address, dennis, price)
    const erin_ICR_Asset = await troveManager.getCurrentICR(erc20.address, erin, price)
    const freddy_ICR_Asset = await troveManager.getCurrentICR(erc20.address, freddy, price)
    const greta_ICR_Asset = await troveManager.getCurrentICR(erc20.address, greta, price)
    const harry_ICR_Asset = await troveManager.getCurrentICR(erc20.address, harry, price)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Alice and Bob should have ICR > TCR
    assert.isTrue(alice_ICR.gt(TCR))
    assert.isTrue(bob_ICR.gt(TCR))
    assert.isTrue(alice_ICR_Asset.gt(TCR_Asset))
    assert.isTrue(bob_ICR_Asset.gt(TCR_Asset))

    // All other Troves should have ICR < TCR
    assert.isTrue(carol_ICR.lt(TCR))
    assert.isTrue(dennis_ICR.lt(TCR))
    assert.isTrue(erin_ICR.lt(TCR))
    assert.isTrue(freddy_ICR.lt(TCR))
    assert.isTrue(greta_ICR.lt(TCR))
    assert.isTrue(harry_ICR.lt(TCR))

    assert.isTrue(carol_ICR_Asset.lt(TCR_Asset))
    assert.isTrue(dennis_ICR_Asset.lt(TCR_Asset))
    assert.isTrue(erin_ICR_Asset.lt(TCR_Asset))
    assert.isTrue(freddy_ICR_Asset.lt(TCR_Asset))
    assert.isTrue(greta_ICR_Asset.lt(TCR_Asset))
    assert.isTrue(harry_ICR_Asset.lt(TCR_Asset))

    /* Liquidations should occur from the lowest ICR Trove upwards, i.e. 
    1) Harry, 2) Greta, 3) Freddy, etc.

      Trove         ICR
    Alice       161%
    Bob         158%
    Carol       129%
    Dennis      123%
    ---- CUTOFF ----
    Elisa       117%
    Freddy      113%
    Greta       106%
    Harry       100%

    If all Troves below the cutoff are liquidated, the TCR of the system rises above the CCR, to 152%.  (see calculations in Google Sheet)

    Thus, after liquidateTroves(), expect all Troves to be liquidated up to the cut-off.  
    
    Only Alice, Bob, Carol and Dennis should remain active - all others should be closed. */

    // call liquidate Troves
    await troveManager.liquidateTroves(ZERO_ADDRESS, 10);
    await troveManager.liquidateTroves(erc20.address, 10);

    // check system is no longer in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // After liquidation, TCR should rise to above 150%. 
    const TCR_After = await th.getTCR(contracts)
    const TCR_After_Asset = await th.getTCR(contracts, erc20.address)
    assert.isTrue(TCR_After.gt(_150percent))
    assert.isTrue(TCR_After_Asset.gt(_150percent))

    // get all Troves
    const alice_Trove = await troveManager.Troves(alice, ZERO_ADDRESS)
    const bob_Trove = await troveManager.Troves(bob, ZERO_ADDRESS)
    const carol_Trove = await troveManager.Troves(carol, ZERO_ADDRESS)
    const dennis_Trove = await troveManager.Troves(dennis, ZERO_ADDRESS)
    const erin_Trove = await troveManager.Troves(erin, ZERO_ADDRESS)
    const freddy_Trove = await troveManager.Troves(freddy, ZERO_ADDRESS)
    const greta_Trove = await troveManager.Troves(greta, ZERO_ADDRESS)
    const harry_Trove = await troveManager.Troves(harry, ZERO_ADDRESS)

    const alice_Trove_Asset = await troveManager.Troves(alice, erc20.address)
    const bob_Trove_Asset = await troveManager.Troves(bob, erc20.address)
    const carol_Trove_Asset = await troveManager.Troves(carol, erc20.address)
    const dennis_Trove_Asset = await troveManager.Troves(dennis, erc20.address)
    const erin_Trove_Asset = await troveManager.Troves(erin, erc20.address)
    const freddy_Trove_Asset = await troveManager.Troves(freddy, erc20.address)
    const greta_Trove_Asset = await troveManager.Troves(greta, erc20.address)
    const harry_Trove_Asset = await troveManager.Troves(harry, erc20.address)

    // check that Alice, Bob, Carol, & Dennis' Troves remain active
    assert.equal(alice_Trove[th.TROVE_STATUS_INDEX], 1)
    assert.equal(bob_Trove[th.TROVE_STATUS_INDEX], 1)
    assert.equal(carol_Trove[th.TROVE_STATUS_INDEX], 1)
    assert.equal(dennis_Trove[th.TROVE_STATUS_INDEX], 1)
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, dennis))

    assert.equal(alice_Trove_Asset[th.TROVE_STATUS_INDEX], 1)
    assert.equal(bob_Trove_Asset[th.TROVE_STATUS_INDEX], 1)
    assert.equal(carol_Trove_Asset[th.TROVE_STATUS_INDEX], 1)
    assert.equal(dennis_Trove_Asset[th.TROVE_STATUS_INDEX], 1)
    assert.isTrue(await sortedTroves.contains(erc20.address, alice))
    assert.isTrue(await sortedTroves.contains(erc20.address, bob))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))
    assert.isTrue(await sortedTroves.contains(erc20.address, dennis))

    // check all other Troves are liquidated
    assert.equal(erin_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(freddy_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(greta_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(harry_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, erin))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, freddy))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, greta))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, harry))

    assert.equal(erin_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(freddy_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(greta_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(harry_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.isFalse(await sortedTroves.contains(erc20.address, erin))
    assert.isFalse(await sortedTroves.contains(erc20.address, freddy))
    assert.isFalse(await sortedTroves.contains(erc20.address, greta))
    assert.isFalse(await sortedTroves.contains(erc20.address, harry))
  })

  it("liquidateTroves(): Liquidates Troves until 1) system has left recovery mode AND 2) it reaches a Trove with ICR >= 110%", async () => {
    // make 6 Troves accordingly
    // --- SETUP ---
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(230, 16)), extraParams: { from: dennis } })
    const { totalDebt: E_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: erin } })
    const { totalDebt: F_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: freddy } })

    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(230, 16)), extraParams: { from: dennis } })
    const { totalDebt: E_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: erin } })
    const { totalDebt: F_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: freddy } })

    const liquidationAmount = B_totalDebt.add(C_totalDebt).add(D_totalDebt).add(E_totalDebt).add(F_totalDebt)
    const liquidationAmount_Asset = B_totalDebt_Asset.add(C_totalDebt_Asset).add(D_totalDebt_Asset).add(E_totalDebt_Asset).add(F_totalDebt_Asset)
    await openTrove({ ICR: toBN(dec(400, 16)), extraVSTAmount: liquidationAmount, extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraVSTAmount: liquidationAmount_Asset, extraParams: { from: alice } })

    // Alice deposits VST to Stability Pool
    await stabilityPool.provideToSP(liquidationAmount, { from: alice })
    await stabilityPoolERC20.provideToSP(liquidationAmount_Asset, { from: alice })

    // price drops to 1ETH:85VST, reducing TCR below 150%
    await priceFeed.setPrice('85000000000000000000')
    const price = await priceFeed.getPrice()

    // check Recovery Mode kicks in

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // check TCR < 150%
    const _150percent = web3.utils.toBN('1500000000000000000')
    const TCR_Before = await th.getTCR(contracts)
    assert.isTrue(TCR_Before.lt(_150percent))

    const TCR_Before_Asset = await th.getTCR(contracts, erc20.address)
    assert.isTrue(TCR_Before_Asset.lt(_150percent))

    /* 
   After the price drop and prior to any liquidations, ICR should be:

    Trove         ICR
    Alice       182%
    Bob         102%
    Carol       102%
    Dennis      102%
    Elisa       102%
    Freddy      102%
    */
    alice_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    carol_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
    dennis_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)
    erin_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)
    freddy_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, freddy, price)

    alice_ICR_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    carol_ICR_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
    dennis_ICR_Asset = await troveManager.getCurrentICR(erc20.address, dennis, price)
    erin_ICR_Asset = await troveManager.getCurrentICR(erc20.address, erin, price)
    freddy_ICR_Asset = await troveManager.getCurrentICR(erc20.address, freddy, price)

    // Alice should have ICR > 150%
    assert.isTrue(alice_ICR.gt(_150percent))
    assert.isTrue(alice_ICR_Asset.gt(_150percent))
    // All other Troves should have ICR < 150%
    assert.isTrue(carol_ICR.lt(_150percent))
    assert.isTrue(dennis_ICR.lt(_150percent))
    assert.isTrue(erin_ICR.lt(_150percent))
    assert.isTrue(freddy_ICR.lt(_150percent))

    assert.isTrue(carol_ICR_Asset.lt(_150percent))
    assert.isTrue(dennis_ICR_Asset.lt(_150percent))
    assert.isTrue(erin_ICR_Asset.lt(_150percent))
    assert.isTrue(freddy_ICR_Asset.lt(_150percent))

    /* Liquidations should occur from the lowest ICR Trove upwards, i.e. 
    1) Freddy, 2) Elisa, 3) Dennis.

    After liquidating Freddy and Elisa, the the TCR of the system rises above the CCR, to 154%.  
   (see calculations in Google Sheet)

    Liquidations continue until all Troves with ICR < MCR have been closed. 
    Only Alice should remain active - all others should be closed. */

    // call liquidate Troves
    await troveManager.liquidateTroves(ZERO_ADDRESS, 6);
    await troveManager.liquidateTroves(erc20.address, 6);

    // check system is no longer in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // After liquidation, TCR should rise to above 150%. 
    const TCR_After = await th.getTCR(contracts)
    assert.isTrue(TCR_After.gt(_150percent))

    const TCR_After_Asset = await th.getTCR(contracts, erc20.address)
    assert.isTrue(TCR_After_Asset.gt(_150percent))

    // get all Troves
    const alice_Trove = await troveManager.Troves(alice, ZERO_ADDRESS)
    const bob_Trove = await troveManager.Troves(bob, ZERO_ADDRESS)
    const carol_Trove = await troveManager.Troves(carol, ZERO_ADDRESS)
    const dennis_Trove = await troveManager.Troves(dennis, ZERO_ADDRESS)
    const erin_Trove = await troveManager.Troves(erin, ZERO_ADDRESS)
    const freddy_Trove = await troveManager.Troves(freddy, ZERO_ADDRESS)

    const alice_Trove_Asset = await troveManager.Troves(alice, erc20.address)
    const bob_Trove_Asset = await troveManager.Troves(bob, erc20.address)
    const carol_Trove_Asset = await troveManager.Troves(carol, erc20.address)
    const dennis_Trove_Asset = await troveManager.Troves(dennis, erc20.address)
    const erin_Trove_Asset = await troveManager.Troves(erin, erc20.address)
    const freddy_Trove_Asset = await troveManager.Troves(freddy, erc20.address)

    // check that Alice's Trove remains active
    assert.equal(alice_Trove[th.TROVE_STATUS_INDEX], 1)
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))

    assert.equal(alice_Trove_Asset[th.TROVE_STATUS_INDEX], 1)
    assert.isTrue(await sortedTroves.contains(erc20.address, alice))

    // check all other Troves are liquidated
    assert.equal(bob_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(carol_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(dennis_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(erin_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(freddy_Trove[th.TROVE_STATUS_INDEX], 3)

    assert.equal(bob_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(carol_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(dennis_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(erin_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(freddy_Trove_Asset[th.TROVE_STATUS_INDEX], 3)

    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, erin))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, freddy))

    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))
    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))
    assert.isFalse(await sortedTroves.contains(erc20.address, erin))
    assert.isFalse(await sortedTroves.contains(erc20.address, freddy))
  })

  it('liquidateTroves(): liquidates only up to the requested number of undercollateralized troves', async () => {
    await openTrove({ ICR: toBN(dec(300, 16)), extraParams: { from: whale, value: dec(300, 'ether') } })
    await openTrove({ asset: erc20.address, assetSent: dec(300, 'ether'), ICR: toBN(dec(300, 16)), extraParams: { from: whale } })

    // --- SETUP --- 
    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively increasing collateral ratio
    await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(212, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(214, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(216, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(218, 16)), extraParams: { from: erin } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(212, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(214, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(216, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(218, 16)), extraParams: { from: erin } })

    await priceFeed.setPrice(dec(100, 18))

    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    assert.isTrue(TCR.lte(web3.utils.toBN(dec(150, 18))))
    assert.isTrue(await th.checkRecoveryMode(contracts))

    assert.isTrue(TCR_Asset.lte(web3.utils.toBN(dec(150, 18))))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // --- TEST --- 

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidateTroves(ZERO_ADDRESS, 3)
    await troveManager.liquidateTroves(erc20.address, 3)

    // Check system still in Recovery Mode after liquidation tx
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    assert.equal(await troveManager.getTroveOwnersCount(ZERO_ADDRESS), '3')
    assert.equal(await troveManager.getTroveOwnersCount(erc20.address), '3')

    // Check Alice, Bob, Carol troves have been closed
    const aliceTroveStatus = (await troveManager.getTroveStatus(ZERO_ADDRESS, alice)).toString()
    const bobTroveStatus = (await troveManager.getTroveStatus(ZERO_ADDRESS, bob)).toString()
    const carolTroveStatus = (await troveManager.getTroveStatus(ZERO_ADDRESS, carol)).toString()

    const aliceTroveStatus_Asset = (await troveManager.getTroveStatus(erc20.address, alice)).toString()
    const bobTroveStatus_Asset = (await troveManager.getTroveStatus(erc20.address, bob)).toString()
    const carolTroveStatus_Asset = (await troveManager.getTroveStatus(erc20.address, carol)).toString()

    assert.equal(aliceTroveStatus, '3')
    assert.equal(bobTroveStatus, '3')
    assert.equal(carolTroveStatus, '3')

    assert.equal(aliceTroveStatus_Asset, '3')
    assert.equal(bobTroveStatus_Asset, '3')
    assert.equal(carolTroveStatus_Asset, '3')

    //  Check Alice, Bob, and Carol's trove are no longer in the sorted list
    const alice_isInSortedList = await sortedTroves.contains(ZERO_ADDRESS, alice)
    const bob_isInSortedList = await sortedTroves.contains(ZERO_ADDRESS, bob)
    const carol_isInSortedList = await sortedTroves.contains(ZERO_ADDRESS, carol)

    const alice_isInSortedList_Asset = await sortedTroves.contains(erc20.address, alice)
    const bob_isInSortedList_Asset = await sortedTroves.contains(erc20.address, bob)
    const carol_isInSortedList_Asset = await sortedTroves.contains(erc20.address, carol)

    assert.isFalse(alice_isInSortedList)
    assert.isFalse(bob_isInSortedList)
    assert.isFalse(carol_isInSortedList)

    assert.isFalse(alice_isInSortedList_Asset)
    assert.isFalse(bob_isInSortedList_Asset)
    assert.isFalse(carol_isInSortedList_Asset)

    // Check Dennis, Erin still have active troves
    const dennisTroveStatus = (await troveManager.getTroveStatus(ZERO_ADDRESS, dennis)).toString()
    const erinTroveStatus = (await troveManager.getTroveStatus(ZERO_ADDRESS, erin)).toString()

    const dennisTroveStatus_Asset = (await troveManager.getTroveStatus(erc20.address, dennis)).toString()
    const erinTroveStatus_Asset = (await troveManager.getTroveStatus(erc20.address, erin)).toString()

    assert.equal(dennisTroveStatus, '1')
    assert.equal(erinTroveStatus, '1')
    assert.equal(dennisTroveStatus_Asset, '1')
    assert.equal(erinTroveStatus_Asset, '1')

    // Check Dennis, Erin still in sorted list
    const dennis_isInSortedList = await sortedTroves.contains(ZERO_ADDRESS, dennis)
    const erin_isInSortedList = await sortedTroves.contains(ZERO_ADDRESS, erin)

    const dennis_isInSortedList_Asset = await sortedTroves.contains(erc20.address, dennis)
    const erin_isInSortedList_Asset = await sortedTroves.contains(erc20.address, erin)

    assert.isTrue(dennis_isInSortedList)
    assert.isTrue(erin_isInSortedList)
    assert.isTrue(dennis_isInSortedList_Asset)
    assert.isTrue(erin_isInSortedList_Asset)
  })

  it("liquidateTroves(): does nothing if n = 0", async () => {
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(200, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(300, 18), extraParams: { from: carol } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(100, 18), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(200, 18), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(300, 18), extraParams: { from: carol } })

    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const TCR_Before = (await th.getTCR(contracts)).toString()
    const TCR_Before_Asset = (await th.getTCR(contracts, erc20.address)).toString()

    // Confirm A, B, C ICRs are below 110%

    const alice_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const carol_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const alice_ICR_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const carol_ICR_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    assert.isTrue(alice_ICR.lte(mv._MCR))
    assert.isTrue(bob_ICR.lte(mv._MCR))
    assert.isTrue(carol_ICR.lte(mv._MCR))

    assert.isTrue(alice_ICR_Asset.lte(mv._MCR))
    assert.isTrue(bob_ICR_Asset.lte(mv._MCR))
    assert.isTrue(carol_ICR_Asset.lte(mv._MCR))

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Liquidation with n = 0
    await assertRevert(troveManager.liquidateTroves(ZERO_ADDRESS, 0), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidateTroves(erc20.address, 0), "TroveManager: nothing to liquidate")

    // Check all troves are still in the system
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))

    assert.isTrue(await sortedTroves.contains(erc20.address, alice))
    assert.isTrue(await sortedTroves.contains(erc20.address, bob))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))

    const TCR_After = (await th.getTCR(contracts)).toString()
    const TCR_After_Asset = (await th.getTCR(contracts, erc20.address)).toString()

    // Check TCR has not changed after liquidation
    assert.equal(TCR_Before, TCR_After)
    assert.equal(TCR_Before_Asset, TCR_After_Asset)
  })

  it('liquidateTroves(): closes every Trove with ICR < MCR, when n > number of undercollateralized troves', async () => {
    // --- SETUP --- 
    await openTrove({ ICR: toBN(dec(300, 16)), extraParams: { from: whale, value: dec(300, 'ether') } })
    await openTrove({ asset: erc20.address, assetSent: dec(300, 'ether'), ICR: toBN(dec(300, 16)), extraParams: { from: whale } })

    // create 5 Troves with varying ICRs
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(300, 18), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(182, 16)), extraParams: { from: erin } })
    await openTrove({ ICR: toBN(dec(111, 16)), extraParams: { from: freddy } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(133, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(300, 18), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(182, 16)), extraParams: { from: erin } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(111, 16)), extraParams: { from: freddy } })

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), { from: whale })
    await stabilityPoolERC20.provideToSP(dec(300, 18), { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100VST, reducing Bob and Carol's ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Confirm troves A-E are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, freddy, price)).lte(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, bob, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, carol, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, erin, price)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, freddy, price)).lte(mv._MCR))

    // Confirm Whale is ICR > 110% 
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, whale, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, whale, price)).gte(mv._MCR))

    // Liquidate 5 troves
    await troveManager.liquidateTroves(ZERO_ADDRESS, 5);
    await troveManager.liquidateTroves(erc20.address, 5);

    // Confirm troves A-E have been removed from the system
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, erin))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, freddy))

    assert.isFalse(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))
    assert.isFalse(await sortedTroves.contains(erc20.address, erin))
    assert.isFalse(await sortedTroves.contains(erc20.address, freddy))

    // Check all troves are now liquidated
    assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(erin, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(freddy, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')

    assert.equal((await troveManager.Troves(alice, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(carol, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(erin, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(freddy, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
  })

  it("liquidateTroves(): a liquidation sequence containing Pool offsets increases the TCR", async () => {
    // Whale provides 500 VST to SP
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(500, 18), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(500, 18), extraParams: { from: whale } })
    await stabilityPool.provideToSP(dec(500, 18), { from: whale })
    await stabilityPoolERC20.provideToSP(dec(500, 18), { from: whale })

    await openTrove({ ICR: toBN(dec(300, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(320, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(340, 16)), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(320, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(340, 16)), extraParams: { from: dennis } })

    await openTrove({ ICR: toBN(dec(198, 16)), extraVSTAmount: dec(101, 18), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(184, 16)), extraVSTAmount: dec(217, 18), extraParams: { from: defaulter_2 } })
    await openTrove({ ICR: toBN(dec(183, 16)), extraVSTAmount: dec(328, 18), extraParams: { from: defaulter_3 } })
    await openTrove({ ICR: toBN(dec(186, 16)), extraVSTAmount: dec(431, 18), extraParams: { from: defaulter_4 } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(198, 16)), extraVSTAmount: dec(101, 18), extraParams: { from: defaulter_1 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(184, 16)), extraVSTAmount: dec(217, 18), extraParams: { from: defaulter_2 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(183, 16)), extraVSTAmount: dec(328, 18), extraParams: { from: defaulter_3 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(186, 16)), extraVSTAmount: dec(431, 18), extraParams: { from: defaulter_4 } })

    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_1)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_2)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_3)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_4)))

    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_1)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_2)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_3)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_4)))


    // Price drops
    await priceFeed.setPrice(dec(110, 18))
    const price = await priceFeed.getPrice()

    assert.isTrue(await th.ICRbetween100and110(defaulter_1, troveManager, price))
    assert.isTrue(await th.ICRbetween100and110(defaulter_2, troveManager, price))
    assert.isTrue(await th.ICRbetween100and110(defaulter_3, troveManager, price))
    assert.isTrue(await th.ICRbetween100and110(defaulter_4, troveManager, price))

    assert.isTrue(await th.ICRbetween100and110(defaulter_1, troveManager, price, erc20.address))
    assert.isTrue(await th.ICRbetween100and110(defaulter_2, troveManager, price, erc20.address))
    assert.isTrue(await th.ICRbetween100and110(defaulter_3, troveManager, price, erc20.address))
    assert.isTrue(await th.ICRbetween100and110(defaulter_4, troveManager, price, erc20.address))

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    const TCR_Before = await th.getTCR(contracts)
    const TCR_Before_Asset = await th.getTCR(contracts, erc20.address)

    // Check Stability Pool has 500 VST
    assert.equal((await stabilityPool.getTotalVSTDeposits()).toString(), dec(500, 18))
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), dec(500, 18))

    await troveManager.liquidateTroves(ZERO_ADDRESS, 8)
    await troveManager.liquidateTroves(erc20.address, 8)

    // assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS,defaulter_1)))
    // assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS,defaulter_2)))
    // assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS,defaulter_3)))
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_4)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_4)))

    // Check Stability Pool has been emptied by the liquidations
    assert.equal((await stabilityPool.getTotalVSTDeposits()).toString(), '0')
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), '0')

    // Check that the liquidation sequence has improved the TCR
    const TCR_After = await th.getTCR(contracts)
    assert.isTrue(TCR_After.gte(TCR_Before))

    const TCR_After_Asset = await th.getTCR(contracts, erc20.address)
    assert.isTrue(TCR_After_Asset.gte(TCR_Before_Asset))
  })

  it("liquidateTroves(): A liquidation sequence of pure redistributions decreases the TCR, due to gas compensation, but up to 0.5%", async () => {
    const { collateral: W_coll, totalDebt: W_totalDebt } = await openTrove({ ICR: toBN(dec(250, 16)), extraVSTAmount: dec(500, 18), extraParams: { from: whale } })

    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(300, 16)), extraParams: { from: alice } })
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: carol } })
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(600, 16)), extraParams: { from: dennis } })

    const { collateral: d1_coll, totalDebt: d1_totalDebt } = await openTrove({ ICR: toBN(dec(198, 16)), extraVSTAmount: dec(101, 18), extraParams: { from: defaulter_1 } })
    const { collateral: d2_coll, totalDebt: d2_totalDebt } = await openTrove({ ICR: toBN(dec(184, 16)), extraVSTAmount: dec(217, 18), extraParams: { from: defaulter_2 } })
    const { collateral: d3_coll, totalDebt: d3_totalDebt } = await openTrove({ ICR: toBN(dec(183, 16)), extraVSTAmount: dec(328, 18), extraParams: { from: defaulter_3 } })
    const { collateral: d4_coll, totalDebt: d4_totalDebt } = await openTrove({ ICR: toBN(dec(166, 16)), extraVSTAmount: dec(431, 18), extraParams: { from: defaulter_4 } })

    const { collateral: W_coll_Asset, totalDebt: W_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(250, 16)), extraVSTAmount: dec(500, 18), extraParams: { from: whale } })
    const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraParams: { from: alice } })
    const { collateral: C_coll_Asset, totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: carol } })
    const { collateral: D_coll_Asset, totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(600, 16)), extraParams: { from: dennis } })
    const { collateral: d1_coll_Asset, totalDebt: d1_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(198, 16)), extraVSTAmount: dec(101, 18), extraParams: { from: defaulter_1 } })
    const { collateral: d2_coll_Asset, totalDebt: d2_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(184, 16)), extraVSTAmount: dec(217, 18), extraParams: { from: defaulter_2 } })
    const { collateral: d3_coll_Asset, totalDebt: d3_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(183, 16)), extraVSTAmount: dec(328, 18), extraParams: { from: defaulter_3 } })
    const { collateral: d4_coll_Asset, totalDebt: d4_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(166, 16)), extraVSTAmount: dec(431, 18), extraParams: { from: defaulter_4 } })

    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_1)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_2)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_3)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, defaulter_4)))

    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_1)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_2)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_3)))
    assert.isTrue((await sortedTroves.contains(erc20.address, defaulter_4)))

    // Price drops
    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price)

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    const TCR_Before = await th.getTCR(contracts)
    const TCR_Before_Asset = await th.getTCR(contracts, erc20.address)
    // (5+1+2+3+1+2+3+4)*100/(410+50+50+50+101+257+328+480)
    const totalCollBefore = W_coll.add(A_coll).add(C_coll).add(D_coll).add(d1_coll).add(d2_coll).add(d3_coll).add(d4_coll)
    const totalDebtBefore = W_totalDebt.add(A_totalDebt).add(C_totalDebt).add(D_totalDebt).add(d1_totalDebt).add(d2_totalDebt).add(d3_totalDebt).add(d4_totalDebt)
    assert.isAtMost(th.getDifference(TCR_Before, totalCollBefore.mul(price).div(totalDebtBefore)), 1000)

    const totalCollBefore_Asset = W_coll_Asset.add(A_coll_Asset).add(C_coll_Asset).add(D_coll_Asset).add(d1_coll_Asset).add(d2_coll_Asset).add(d3_coll_Asset).add(d4_coll_Asset)
    const totalDebtBefore_Asset = W_totalDebt_Asset.add(A_totalDebt_Asset).add(C_totalDebt_Asset).add(D_totalDebt_Asset).add(d1_totalDebt_Asset).add(d2_totalDebt_Asset).add(d3_totalDebt_Asset).add(d4_totalDebt_Asset)
    assert.isAtMost(th.getDifference(TCR_Before_Asset, totalCollBefore_Asset.mul(price).div(totalDebtBefore_Asset)), 1000)

    // Check pool is empty before liquidation
    assert.equal((await stabilityPool.getTotalVSTDeposits()).toString(), '0')
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), '0')

    // Liquidate
    await troveManager.liquidateTroves(ZERO_ADDRESS, 8)
    await troveManager.liquidateTroves(erc20.address, 8)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_1)))
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_2)))
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_3)))
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, defaulter_4)))

    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_1)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_2)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_3)))
    assert.isFalse((await sortedTroves.contains(erc20.address, defaulter_4)))

    // Check that the liquidation sequence has reduced the TCR
    const TCR_After = await th.getTCR(contracts)
    const TCR_After_Asset = await th.getTCR(contracts, erc20.address)
    // ((5+1+2+3)+(1+2+3+4)*0.995)*100/(410+50+50+50+101+257+328+480)
    const totalCollAfter = W_coll.add(A_coll).add(C_coll).add(D_coll).add(th.applyLiquidationFee(d1_coll.add(d2_coll).add(d3_coll).add(d4_coll)))
    const totalDebtAfter = W_totalDebt.add(A_totalDebt).add(C_totalDebt).add(D_totalDebt).add(d1_totalDebt).add(d2_totalDebt).add(d3_totalDebt).add(d4_totalDebt)
    const totalCollAfter_Asset = W_coll_Asset.add(A_coll_Asset).add(C_coll_Asset).add(D_coll_Asset).add(th.applyLiquidationFee(d1_coll_Asset.add(d2_coll_Asset).add(d3_coll_Asset).add(d4_coll_Asset)))
    const totalDebtAfter_Asset = W_totalDebt_Asset.add(A_totalDebt_Asset).add(C_totalDebt_Asset).add(D_totalDebt_Asset).add(d1_totalDebt_Asset).add(d2_totalDebt_Asset).add(d3_totalDebt_Asset).add(d4_totalDebt_Asset)

    assert.isAtMost(th.getDifference(TCR_After, totalCollAfter.mul(price).div(totalDebtAfter)), 1000)
    assert.isTrue(TCR_Before.gte(TCR_After))
    assert.isTrue(TCR_After.gte(TCR_Before.mul(th.toBN(995)).div(th.toBN(1000))))

    assert.isAtMost(th.getDifference(TCR_After_Asset, totalCollAfter_Asset.mul(price).div(totalDebtAfter_Asset)), 1000)
    assert.isTrue(TCR_Before_Asset.gte(TCR_After_Asset))
    assert.isTrue(TCR_After_Asset.gte(TCR_Before_Asset.mul(th.toBN(995)).div(th.toBN(1000))))
  })

  it("liquidateTroves(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(220, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: carol } })

    // Defaulter opens with 60 VST, 0.6 ETH
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_1 } })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    const alice_ICR_Before = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const bob_ICR_Before = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const carol_ICR_Before = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const alice_ICR_Before_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const bob_ICR_Before_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const carol_ICR_Before_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    /* Before liquidation: 
    Alice ICR: = (1 * 100 / 50) = 200%
    Bob ICR: (1 * 100 / 90.5) = 110.5%
    Carol ICR: (1 * 100 / 100 ) =  100%

    Therefore Alice and Bob above the MCR, Carol is below */
    assert.isTrue(alice_ICR_Before.gte(mv._MCR))
    assert.isTrue(bob_ICR_Before.gte(mv._MCR))
    assert.isTrue(carol_ICR_Before.lte(mv._MCR))

    assert.isTrue(alice_ICR_Before_Asset.gte(mv._MCR))
    assert.isTrue(bob_ICR_Before_Asset.gte(mv._MCR))
    assert.isTrue(carol_ICR_Before_Asset.lte(mv._MCR))

    // Liquidate defaulter. 30 VST and 0.3 ETH is distributed uniformly between A, B and C. Each receive 10 VST, 0.1 ETH
    await troveManager.liquidate(ZERO_ADDRESS, defaulter_1)
    await troveManager.liquidate(erc20.address, defaulter_1)

    const alice_ICR_After = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const bob_ICR_After = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const carol_ICR_After = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const alice_ICR_After_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const bob_ICR_After_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const carol_ICR_After_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    /* After liquidation: 

    Alice ICR: (1.1 * 100 / 60) = 183.33%
    Bob ICR:(1.1 * 100 / 100.5) =  109.45%
    Carol ICR: (1.1 * 100 ) 100%

    Check Alice is above MCR, Bob below, Carol below. */
    assert.isTrue(alice_ICR_After.gte(mv._MCR))
    assert.isTrue(bob_ICR_After.lte(mv._MCR))
    assert.isTrue(carol_ICR_After.lte(mv._MCR))

    assert.isTrue(alice_ICR_After_Asset.gte(mv._MCR))
    assert.isTrue(bob_ICR_After_Asset.lte(mv._MCR))
    assert.isTrue(carol_ICR_After_Asset.lte(mv._MCR))

    /* Though Bob's true ICR (including pending rewards) is below the MCR, 
   check that Bob's raw coll and debt has not changed, and that his "raw" ICR is above the MCR */
    const bob_Coll = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
    const bob_Debt = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]

    const bob_Coll_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
    const bob_Debt_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_DEBT_INDEX]

    const bob_rawICR = bob_Coll.mul(th.toBN(dec(100, 18))).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    const bob_rawICR_Asset = bob_Coll_Asset.mul(th.toBN(dec(100, 18))).div(bob_Debt_Asset)
    assert.isTrue(bob_rawICR_Asset.gte(mv._MCR))

    // Liquidate A, B, C
    await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    await troveManager.liquidateTroves(erc20.address, 10)

    /*  Since there is 0 VST in the stability Pool, A, with ICR >110%, should stay active.
   Check Alice stays active, Carol gets liquidated, and Bob gets liquidated 
   (because his pending rewards bring his ICR < MCR) */
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

    assert.isTrue(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // check trove statuses - A active (1),  B and C liquidated (3)
    assert.equal((await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '1')
    assert.equal((await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '3')

    assert.equal((await troveManager.Troves(alice, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '1')
    assert.equal((await troveManager.Troves(bob, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
    assert.equal((await troveManager.Troves(carol, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '3')
  })

  it('liquidateTroves(): does nothing if all troves have ICR > 110% and Stability Pool is empty', async () => {
    await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(250, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(285, 16)), extraParams: { from: carol } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(222, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(250, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(285, 16)), extraParams: { from: carol } })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, alice)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, bob)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, carol)))

    assert.isTrue((await sortedTroves.contains(erc20.address, alice)))
    assert.isTrue((await sortedTroves.contains(erc20.address, bob)))
    assert.isTrue((await sortedTroves.contains(erc20.address, carol)))

    const TCR_Before = (await th.getTCR(contracts)).toString()
    const listSize_Before = (await sortedTroves.getSize(ZERO_ADDRESS)).toString()

    const TCR_Before_Asset = (await th.getTCR(contracts, erc20.address)).toString()
    const listSize_Before_Asset = (await sortedTroves.getSize(erc20.address)).toString()


    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).gte(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, carol, price)).gte(mv._MCR))

    // Confirm 0 VST in Stability Pool
    assert.equal((await stabilityPool.getTotalVSTDeposits()).toString(), '0')
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), '0')

    // Attempt liqudation sequence
    await assertRevert(troveManager.liquidateTroves(ZERO_ADDRESS, 10), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.liquidateTroves(erc20.address, 10), "TroveManager: nothing to liquidate")

    // Check all troves remain active
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, alice)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, bob)))
    assert.isTrue((await sortedTroves.contains(ZERO_ADDRESS, carol)))

    assert.isTrue((await sortedTroves.contains(erc20.address, alice)))
    assert.isTrue((await sortedTroves.contains(erc20.address, bob)))
    assert.isTrue((await sortedTroves.contains(erc20.address, carol)))

    const TCR_After = (await th.getTCR(contracts)).toString()
    const listSize_After = (await sortedTroves.getSize(ZERO_ADDRESS)).toString()

    const TCR_After_Asset = (await th.getTCR(contracts, erc20.address)).toString()
    const listSize_After_Asset = (await sortedTroves.getSize(erc20.address)).toString()

    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
    assert.equal(TCR_Before_Asset, TCR_After_Asset)
    assert.equal(listSize_Before_Asset, listSize_After_Asset)
  })

  it('liquidateTroves(): emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves', async () => {
    // Troves to be absorbed by SP
    const { collateral: F_coll, totalDebt: F_totalDebt } = await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: freddy } })
    const { collateral: G_coll, totalDebt: G_totalDebt } = await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: greta } })

    const { collateral: F_coll_Asset, totalDebt: F_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(222, 16)), extraParams: { from: freddy } })
    const { collateral: G_coll_Asset, totalDebt: G_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(222, 16)), extraParams: { from: greta } })

    // Troves to be spared
    await openTrove({ ICR: toBN(dec(250, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(285, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(308, 16)), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(250, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(285, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(308, 16)), extraParams: { from: dennis } })

    // Whale adds VST to SP
    const spDeposit = F_totalDebt.add(G_totalDebt)
    const spDeposit_Asset = F_totalDebt_Asset.add(G_totalDebt_Asset)
    await openTrove({ ICR: toBN(dec(285, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(285, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Confirm all troves have ICR > MCR
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, freddy, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, greta, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).gte(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, freddy, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, greta, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, carol, price)).gte(mv._MCR))

    // Confirm VST in Stability Pool
    assert.equal((await stabilityPool.getTotalVSTDeposits()).toString(), spDeposit.toString())
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), spDeposit_Asset.toString())

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    const [liquidatedDebt, liquidatedColl] = th.getEmittedLiquidationValues(liquidationTx)

    const liquidationTx_Asset = await troveManager.liquidateTroves(erc20.address, 10)
    const [liquidatedDebt_Asset, liquidatedColl_Asset] = th.getEmittedLiquidationValues(liquidationTx_Asset)

    // Check F and G were liquidated
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, freddy))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, greta))

    assert.isFalse(await sortedTroves.contains(erc20.address, freddy))
    assert.isFalse(await sortedTroves.contains(erc20.address, greta))

    // Check whale and A-D remain active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, dennis))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, whale))

    assert.isTrue(await sortedTroves.contains(erc20.address, alice))
    assert.isTrue(await sortedTroves.contains(erc20.address, bob))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))
    assert.isTrue(await sortedTroves.contains(erc20.address, dennis))
    assert.isTrue(await sortedTroves.contains(erc20.address, whale))

    // Liquidation event emits coll = (F_debt + G_debt)/price*1.1*0.995, and debt = (F_debt + G_debt)
    th.assertIsApproximatelyEqual(liquidatedDebt, F_totalDebt.add(G_totalDebt))
    th.assertIsApproximatelyEqual(liquidatedColl, th.applyLiquidationFee(F_totalDebt.add(G_totalDebt).mul(toBN(dec(11, 17))).div(price)))

    th.assertIsApproximatelyEqual(liquidatedDebt_Asset, F_totalDebt_Asset.add(G_totalDebt_Asset))
    th.assertIsApproximatelyEqual(liquidatedColl_Asset, th.applyLiquidationFee(F_totalDebt_Asset.add(G_totalDebt_Asset).mul(toBN(dec(11, 17))).div(price)))

    // check collateral surplus
    const freddy_remainingCollateral = F_coll.sub(F_totalDebt.mul(th.toBN(dec(11, 17))).div(price))
    const greta_remainingCollateral = G_coll.sub(G_totalDebt.mul(th.toBN(dec(11, 17))).div(price))

    const freddy_remainingCollateral_Asset = F_coll_Asset.sub(F_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))
    const greta_remainingCollateral_Asset = G_coll_Asset.sub(G_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, freddy), freddy_remainingCollateral)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, greta), greta_remainingCollateral)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, freddy), freddy_remainingCollateral_Asset)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, greta), greta_remainingCollateral_Asset)

    // can claim collateral
    const freddy_balanceBefore = th.toBN(await web3.eth.getBalance(freddy))
    const freddy_balanceBefore_Asset = th.toBN(await erc20.balanceOf(freddy))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: freddy, gasPrice: 0 })
    await borrowerOperations.claimCollateral(erc20.address, { from: freddy, gasPrice: 0 })
    const freddy_balanceAfter = th.toBN(await web3.eth.getBalance(freddy))
    const freddy_balanceAfter_Asset = th.toBN(await erc20.balanceOf(freddy))
    th.assertIsApproximatelyEqual(freddy_balanceAfter, freddy_balanceBefore.add(th.toBN(freddy_remainingCollateral)))
    th.assertIsApproximatelyEqual(freddy_balanceAfter_Asset, freddy_balanceBefore_Asset.add(th.toBN(freddy_remainingCollateral_Asset.div(toBN(10 ** 10)))))

    const greta_balanceBefore = th.toBN(await web3.eth.getBalance(greta))
    const greta_balanceBefore_Asset = th.toBN(await erc20.balanceOf(greta))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: greta, gasPrice: 0 })
    await borrowerOperations.claimCollateral(erc20.address, { from: greta, gasPrice: 0 })
    const greta_balanceAfter = th.toBN(await web3.eth.getBalance(greta))
    const greta_balanceAfter_Asset = th.toBN(await erc20.balanceOf(greta))
    th.assertIsApproximatelyEqual(greta_balanceAfter, greta_balanceBefore.add(th.toBN(greta_remainingCollateral)))
    th.assertIsApproximatelyEqual(greta_balanceAfter_Asset, greta_balanceBefore_Asset.add(th.toBN(greta_remainingCollateral_Asset).div(toBN(10 ** 10))))
  })

  it('liquidateTroves():  emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves, including a partial', async () => {
    // Troves to be absorbed by SP
    const { collateral: F_coll, totalDebt: F_totalDebt } = await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: freddy } })
    const { collateral: G_coll, totalDebt: G_totalDebt } = await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: greta } })

    const { collateral: F_coll_Asset, totalDebt: F_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(222, 16)), extraParams: { from: freddy } })
    const { collateral: G_coll_Asset, totalDebt: G_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(222, 16)), extraParams: { from: greta } })

    // Troves to be spared
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(250, 16)), extraParams: { from: alice } })
    const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(250, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(285, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(308, 16)), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(285, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(308, 16)), extraParams: { from: dennis } })

    // Whale adds VST to SP
    const spDeposit = F_totalDebt.add(G_totalDebt).add(A_totalDebt.div(toBN(2)))
    const spDeposit_Asset = F_totalDebt_Asset.add(G_totalDebt_Asset).add(A_totalDebt_Asset.div(toBN(2)))
    await openTrove({ ICR: toBN(dec(285, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(285, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Confirm all troves have ICR > MCR
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, freddy, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, greta, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).gte(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, freddy, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, greta, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, carol, price)).gte(mv._MCR))

    // Confirm VST in Stability Pool
    assert.equal((await stabilityPool.getTotalVSTDeposits()).toString(), spDeposit.toString())
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), spDeposit_Asset.toString())

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    const [liquidatedDebt, liquidatedColl] = th.getEmittedLiquidationValues(liquidationTx)

    const liquidationTx_Asset = await troveManager.liquidateTroves(erc20.address, 10)
    const [liquidatedDebt_Asset, liquidatedColl_Asset] = th.getEmittedLiquidationValues(liquidationTx_Asset)

    // Check F and G were liquidated
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, freddy))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, greta))

    assert.isFalse(await sortedTroves.contains(erc20.address, freddy))
    assert.isFalse(await sortedTroves.contains(erc20.address, greta))

    // Check whale and A-D remain active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, dennis))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, whale))

    assert.isTrue(await sortedTroves.contains(erc20.address, alice))
    assert.isTrue(await sortedTroves.contains(erc20.address, bob))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))
    assert.isTrue(await sortedTroves.contains(erc20.address, dennis))
    assert.isTrue(await sortedTroves.contains(erc20.address, whale))

    // Check A's collateral and debt remain the same
    const entireColl_A = (await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_COLL_INDEX].add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice))
    const entireDebt_A = (await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX].add(await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, alice))

    const entireColl_A_Asset = (await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX].add(await troveManager.getPendingAssetReward(erc20.address, alice))
    const entireDebt_A_Asset = (await troveManager.Troves(alice, erc20.address))[th.TROVE_DEBT_INDEX].add(await troveManager.getPendingVSTDebtReward(erc20.address, alice))

    assert.equal(entireColl_A.toString(), A_coll)
    assert.equal(entireDebt_A.toString(), A_totalDebt)

    assert.equal(entireColl_A_Asset.toString(), A_coll_Asset)
    assert.equal(entireDebt_A_Asset.toString(), A_totalDebt_Asset)

    /* Liquidation event emits:
    coll = (F_debt + G_debt)/price*1.1*0.995
    debt = (F_debt + G_debt) */
    th.assertIsApproximatelyEqual(liquidatedDebt, F_totalDebt.add(G_totalDebt))
    th.assertIsApproximatelyEqual(liquidatedColl, th.applyLiquidationFee(F_totalDebt.add(G_totalDebt).mul(toBN(dec(11, 17))).div(price)))

    th.assertIsApproximatelyEqual(liquidatedDebt_Asset, F_totalDebt_Asset.add(G_totalDebt_Asset))
    th.assertIsApproximatelyEqual(liquidatedColl_Asset, th.applyLiquidationFee(F_totalDebt_Asset.add(G_totalDebt_Asset).mul(toBN(dec(11, 17))).div(price)))

    // check collateral surplus
    const freddy_remainingCollateral = F_coll.sub(F_totalDebt.mul(th.toBN(dec(11, 17))).div(price))
    const greta_remainingCollateral = G_coll.sub(G_totalDebt.mul(th.toBN(dec(11, 17))).div(price))
    const freddy_remainingCollateral_Asset = F_coll_Asset.sub(F_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))
    const greta_remainingCollateral_Asset = G_coll_Asset.sub(G_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))

    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, freddy), freddy_remainingCollateral)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, greta), greta_remainingCollateral)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, freddy), freddy_remainingCollateral_Asset)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, greta), greta_remainingCollateral_Asset)

    // can claim collateral
    const freddy_balanceBefore = th.toBN(await web3.eth.getBalance(freddy))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: freddy, gasPrice: 0 })
    const freddy_balanceAfter = th.toBN(await web3.eth.getBalance(freddy))
    th.assertIsApproximatelyEqual(freddy_balanceAfter, freddy_balanceBefore.add(th.toBN(freddy_remainingCollateral)))

    const freddy_balanceBefore_Asset = th.toBN(await erc20.balanceOf(freddy))
    await borrowerOperations.claimCollateral(erc20.address, { from: freddy, gasPrice: 0 })
    const freddy_balanceAfter_Asset = th.toBN(await erc20.balanceOf(freddy))
    th.assertIsApproximatelyEqual(freddy_balanceAfter_Asset, freddy_balanceBefore_Asset.add(th.toBN(freddy_remainingCollateral_Asset.div(toBN(10 ** 10)))))

    const greta_balanceBefore = th.toBN(await web3.eth.getBalance(greta))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: greta, gasPrice: 0 })
    const greta_balanceAfter = th.toBN(await web3.eth.getBalance(greta))
    th.assertIsApproximatelyEqual(greta_balanceAfter, greta_balanceBefore.add(th.toBN(greta_remainingCollateral)))

    const greta_balanceBefore_Asset = th.toBN(await erc20.balanceOf(greta))
    await borrowerOperations.claimCollateral(erc20.address, { from: greta, gasPrice: 0 })
    const greta_balanceAfter_Asset = th.toBN(await erc20.balanceOf(greta))
    th.assertIsApproximatelyEqual(greta_balanceAfter_Asset, greta_balanceBefore_Asset.add(th.toBN(greta_remainingCollateral_Asset).div(toBN(10 ** 10))))
  })

  it("liquidateTroves(): does not affect the liquidated user's token balances", async () => {
    await openTrove({ ICR: toBN(dec(300, 16)), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraParams: { from: whale } })

    // D, E, F open troves that will fall below MCR when price drops to 100
    const { VSTAmount: VSTAmountD } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: dennis } })
    const { VSTAmount: VSTAmountE } = await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: erin } })
    const { VSTAmount: VSTAmountF } = await openTrove({ ICR: toBN(dec(111, 16)), extraParams: { from: freddy } })

    const { VSTAmount: VSTAmountD_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: dennis } })
    const { VSTAmount: VSTAmountE_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(133, 16)), extraParams: { from: erin } })
    const { VSTAmount: VSTAmountF_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(111, 16)), extraParams: { from: freddy } })

    // Check list size is 4
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '4')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '4')

    // Check token balances before
    assert.equal((await vstToken.balanceOf(dennis)).toString(), VSTAmountD.add(VSTAmountD_Asset))
    assert.equal((await vstToken.balanceOf(erin)).toString(), VSTAmountE.add(VSTAmountE_Asset))
    assert.equal((await vstToken.balanceOf(freddy)).toString(), VSTAmountF.add(VSTAmountF_Asset))

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    //Liquidate sequence
    await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    await troveManager.liquidateTroves(erc20.address, 10)

    // Check Whale remains in the system
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, whale))
    assert.isTrue(await sortedTroves.contains(erc20.address, whale))

    // Check D, E, F have been removed
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, erin))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, freddy))

    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))
    assert.isFalse(await sortedTroves.contains(erc20.address, erin))
    assert.isFalse(await sortedTroves.contains(erc20.address, freddy))

    // Check token balances of users whose troves were liquidated, have not changed
    assert.equal((await vstToken.balanceOf(dennis)).toString(), VSTAmountD.add(VSTAmountD_Asset))
    assert.equal((await vstToken.balanceOf(erin)).toString(), VSTAmountE.add(VSTAmountE_Asset))
    assert.equal((await vstToken.balanceOf(freddy)).toString(), VSTAmountF.add(VSTAmountF_Asset))
  })

  it("liquidateTroves(): Liquidating troves at 100 < ICR < 110 with SP deposits correctly impacts their SP deposit and ETH gain", async () => {
    // Whale provides VST to the SP
    const { VSTAmount: W_VSTAmount } = await openTrove({ ICR: toBN(dec(300, 16)), extraVSTAmount: dec(4000, 18), extraParams: { from: whale } })
    const { VSTAmount: W_VSTAmount_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraVSTAmount: dec(4000, 18), extraParams: { from: whale } })

    await stabilityPool.provideToSP(W_VSTAmount, { from: whale })
    await stabilityPoolERC20.provideToSP(W_VSTAmount_Asset, { from: whale })

    const { VSTAmount: A_VSTAmount, totalDebt: A_totalDebt, collateral: A_coll } = await openTrove({ ICR: toBN(dec(191, 16)), extraVSTAmount: dec(40, 18), extraParams: { from: alice } })
    const { VSTAmount: B_VSTAmount, totalDebt: B_totalDebt, collateral: B_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: dec(240, 18), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt, collateral: C_coll } = await openTrove({ ICR: toBN(dec(209, 16)), extraParams: { from: carol } })

    const { VSTAmount: A_VSTAmount_Asset, totalDebt: A_totalDebt_Asset, collateral: A_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(191, 16)), extraVSTAmount: dec(40, 18), extraParams: { from: alice } })
    const { VSTAmount: B_VSTAmount_Asset, totalDebt: B_totalDebt_Asset, collateral: B_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: dec(240, 18), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset, collateral: C_coll_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(209, 16)), extraParams: { from: carol } })

    // A, B provide to the SP
    await stabilityPool.provideToSP(A_VSTAmount, { from: alice })
    await stabilityPool.provideToSP(B_VSTAmount, { from: bob })
    await stabilityPoolERC20.provideToSP(A_VSTAmount_Asset, { from: alice })
    await stabilityPoolERC20.provideToSP(B_VSTAmount_Asset, { from: bob })

    const totalDeposit = W_VSTAmount.add(A_VSTAmount).add(B_VSTAmount)
    const totalDeposit_Asset = W_VSTAmount_Asset.add(A_VSTAmount_Asset).add(B_VSTAmount_Asset)

    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '4')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '4')

    // Price drops
    await priceFeed.setPrice(dec(105, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check VST in Pool
    assert.equal((await stabilityPool.getTotalVSTDeposits()).toString(), totalDeposit)
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), totalDeposit_Asset)

    // *** Check A, B, C ICRs 100<ICR<110
    const alice_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const carol_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const alice_ICR_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const carol_ICR_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    assert.isTrue(alice_ICR.gte(mv._ICR100) && alice_ICR.lte(mv._MCR))
    assert.isTrue(bob_ICR.gte(mv._ICR100) && bob_ICR.lte(mv._MCR))
    assert.isTrue(carol_ICR.gte(mv._ICR100) && carol_ICR.lte(mv._MCR))

    assert.isTrue(alice_ICR_Asset.gte(mv._ICR100) && alice_ICR_Asset.lte(mv._MCR))
    assert.isTrue(bob_ICR_Asset.gte(mv._ICR100) && bob_ICR_Asset.lte(mv._MCR))
    assert.isTrue(carol_ICR_Asset.gte(mv._ICR100) && carol_ICR_Asset.lte(mv._MCR))

    // Liquidate
    await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    await troveManager.liquidateTroves(erc20.address, 10)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, alice)))
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, bob)))
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, carol)))

    assert.isFalse((await sortedTroves.contains(erc20.address, alice)))
    assert.isFalse((await sortedTroves.contains(erc20.address, bob)))
    assert.isFalse((await sortedTroves.contains(erc20.address, carol)))

    // check system sized reduced to 1 troves
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '1')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '1')

    /* Prior to liquidation, SP deposits were:
    Whale: 400 VST
    Alice:  40 VST
    Bob:   240 VST
    Carol: 0 VST

    Total VST in Pool: 680 VST

    Then, liquidation hits A,B,C: 

    Total liquidated debt = 100 + 300 + 100 = 500 VST
    Total liquidated ETH = 1 + 3 + 1 = 5 ETH

    Whale VST Loss: 500 * (400/680) = 294.12 VST
    Alice VST Loss:  500 *(40/680) = 29.41 VST
    Bob VST Loss: 500 * (240/680) = 176.47 VST

    Whale remaining deposit: (400 - 294.12) = 105.88 VST
    Alice remaining deposit: (40 - 29.41) = 10.59 VST
    Bob remaining deposit: (240 - 176.47) = 63.53 VST

    Whale ETH Gain: 5*0.995 * (400/680) = 2.93 ETH
    Alice ETH Gain: 5*0.995 *(40/680) = 0.293 ETH
    Bob ETH Gain: 5*0.995 * (240/680) = 1.76 ETH

    Total remaining deposits: 180 VST
    Total ETH gain: 5*0.995 ETH */

    // Check remaining VST Deposits and ETH gain, for whale and depositors whose troves were liquidated
    const whale_Deposit_After = (await stabilityPool.getCompoundedVSTDeposit(whale)).toString()
    const alice_Deposit_After = (await stabilityPool.getCompoundedVSTDeposit(alice)).toString()
    const bob_Deposit_After = (await stabilityPool.getCompoundedVSTDeposit(bob)).toString()

    const whale_Deposit_After_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(whale)).toString()
    const alice_Deposit_After_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(alice)).toString()
    const bob_Deposit_After_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(bob)).toString()

    const whale_ETHGain = (await stabilityPool.getDepositorAssetGain(whale)).toString()
    const alice_ETHGain = (await stabilityPool.getDepositorAssetGain(alice)).toString()
    const bob_ETHGain = (await stabilityPool.getDepositorAssetGain(bob)).toString()

    const whale_ETHGain_Asset = (await stabilityPoolERC20.getDepositorAssetGain(whale)).toString()
    const alice_ETHGain_Asset = (await stabilityPoolERC20.getDepositorAssetGain(alice)).toString()
    const bob_ETHGain_Asset = (await stabilityPoolERC20.getDepositorAssetGain(bob)).toString()

    const liquidatedDebt = A_totalDebt.add(B_totalDebt).add(C_totalDebt)
    const liquidatedColl = A_coll.add(B_coll).add(C_coll)
    const liquidatedDebt_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset)
    const liquidatedColl_Asset = A_coll_Asset.add(B_coll_Asset).add(C_coll_Asset)

    assert.isAtMost(th.getDifference(whale_Deposit_After, W_VSTAmount.sub(liquidatedDebt.mul(W_VSTAmount).div(totalDeposit))), 100000)
    assert.isAtMost(th.getDifference(alice_Deposit_After, A_VSTAmount.sub(liquidatedDebt.mul(A_VSTAmount).div(totalDeposit))), 100000)
    assert.isAtMost(th.getDifference(bob_Deposit_After, B_VSTAmount.sub(liquidatedDebt.mul(B_VSTAmount).div(totalDeposit))), 100000)

    assert.isAtMost(th.getDifference(whale_Deposit_After_Asset, W_VSTAmount_Asset.sub(liquidatedDebt_Asset.mul(W_VSTAmount_Asset).div(totalDeposit_Asset))), 100000)
    assert.isAtMost(th.getDifference(alice_Deposit_After_Asset, A_VSTAmount_Asset.sub(liquidatedDebt_Asset.mul(A_VSTAmount_Asset).div(totalDeposit_Asset))), 100000)
    assert.isAtMost(th.getDifference(bob_Deposit_After_Asset, B_VSTAmount_Asset.sub(liquidatedDebt_Asset.mul(B_VSTAmount_Asset).div(totalDeposit_Asset))), 100000)

    assert.isAtMost(th.getDifference(whale_ETHGain, th.applyLiquidationFee(liquidatedColl).mul(W_VSTAmount).div(totalDeposit)), 2000)
    assert.isAtMost(th.getDifference(alice_ETHGain, th.applyLiquidationFee(liquidatedColl).mul(A_VSTAmount).div(totalDeposit)), 2000)
    assert.isAtMost(th.getDifference(bob_ETHGain, th.applyLiquidationFee(liquidatedColl).mul(B_VSTAmount).div(totalDeposit)), 2000)

    assert.isAtMost(th.getDifference(whale_ETHGain_Asset, th.applyLiquidationFee(liquidatedColl_Asset.div(toBN(10 ** 10)).mul(W_VSTAmount_Asset).div(totalDeposit_Asset))), 2000)
    assert.isAtMost(th.getDifference(alice_ETHGain_Asset, th.applyLiquidationFee(liquidatedColl_Asset.div(toBN(10 ** 10)).mul(A_VSTAmount_Asset).div(totalDeposit_Asset))), 2000)
    assert.isAtMost(th.getDifference(bob_ETHGain_Asset, th.applyLiquidationFee(liquidatedColl_Asset.div(toBN(10 ** 10)).mul(B_VSTAmount_Asset).div(totalDeposit_Asset))), 2000)

    // Check total remaining deposits and ETH gain in Stability Pool
    const total_VSTinSP = (await stabilityPool.getTotalVSTDeposits()).toString()
    const total_ETHinSP = (await stabilityPool.getAssetBalance()).toString()

    const total_VSTinSP_Asset = (await stabilityPoolERC20.getTotalVSTDeposits()).toString()
    const total_ETHinSP_Asset = (await stabilityPoolERC20.getAssetBalance()).toString()

    assert.isAtMost(th.getDifference(total_VSTinSP, totalDeposit.sub(liquidatedDebt)), 1000)
    assert.isAtMost(th.getDifference(total_ETHinSP, th.applyLiquidationFee(liquidatedColl)), 1000)

    assert.isAtMost(th.getDifference(total_VSTinSP_Asset, totalDeposit_Asset.sub(liquidatedDebt_Asset)), 1000)
    assert.isAtMost(th.getDifference(total_ETHinSP_Asset, th.applyLiquidationFee(liquidatedColl_Asset)), 1000)
  })

  it("liquidateTroves(): Liquidating troves at ICR <=100% with SP deposits does not alter their deposit or ETH gain", async () => {
    // Whale provides 400 VST to the SP
    await openTrove({ ICR: toBN(dec(300, 16)), extraVSTAmount: dec(400, 18), extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraVSTAmount: dec(400, 18), extraParams: { from: whale } })
    await stabilityPool.provideToSP(dec(400, 18), { from: whale })
    await stabilityPoolERC20.provideToSP(dec(400, 18), { from: whale })

    await openTrove({ ICR: toBN(dec(182, 16)), extraVSTAmount: dec(170, 18), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraVSTAmount: dec(300, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(170, 16)), extraParams: { from: carol } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(182, 16)), extraVSTAmount: dec(170, 18), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(180, 16)), extraVSTAmount: dec(300, 18), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(170, 16)), extraParams: { from: carol } })

    // A, B provide 100, 300 to the SP
    await stabilityPool.provideToSP(dec(100, 18), { from: alice })
    await stabilityPool.provideToSP(dec(300, 18), { from: bob })

    await stabilityPoolERC20.provideToSP(dec(100, 18), { from: alice })
    await stabilityPoolERC20.provideToSP(dec(300, 18), { from: bob })

    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '4')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '4')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check VST and ETH in Pool  before
    const VSTinSP_Before = (await stabilityPool.getTotalVSTDeposits()).toString()
    const ETHinSP_Before = (await stabilityPool.getAssetBalance()).toString()
    const VSTinSP_Before_Asset = (await stabilityPoolERC20.getTotalVSTDeposits()).toString()
    const ETHinSP_Before_Asset = (await stabilityPoolERC20.getAssetBalance()).toString()

    assert.equal(VSTinSP_Before, dec(800, 18))
    assert.equal(ETHinSP_Before, '0')
    assert.equal(VSTinSP_Before_Asset, dec(800, 18))
    assert.equal(ETHinSP_Before_Asset, '0')

    // *** Check A, B, C ICRs < 100
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).lte(mv._ICR100))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).lte(mv._ICR100))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).lte(mv._ICR100))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).lte(mv._ICR100))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, bob, price)).lte(mv._ICR100))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, carol, price)).lte(mv._ICR100))

    // Liquidate
    await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    await troveManager.liquidateTroves(erc20.address, 10)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, alice)))
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, bob)))
    assert.isFalse((await sortedTroves.contains(ZERO_ADDRESS, carol)))

    assert.isFalse((await sortedTroves.contains(erc20.address, alice)))
    assert.isFalse((await sortedTroves.contains(erc20.address, bob)))
    assert.isFalse((await sortedTroves.contains(erc20.address, carol)))

    // check system sized reduced to 1 troves
    assert.equal((await sortedTroves.getSize(ZERO_ADDRESS)).toString(), '1')
    assert.equal((await sortedTroves.getSize(erc20.address)).toString(), '1')

    // Check VST and ETH in Pool after
    const VSTinSP_After = (await stabilityPool.getTotalVSTDeposits()).toString()
    const ETHinSP_After = (await stabilityPool.getAssetBalance()).toString()
    const VSTinSP_After_Asset = (await stabilityPoolERC20.getTotalVSTDeposits()).toString()
    const ETHinSP_After_Asset = (await stabilityPoolERC20.getAssetBalance()).toString()

    assert.equal(VSTinSP_Before, VSTinSP_After)
    assert.equal(ETHinSP_Before, ETHinSP_After)
    assert.equal(VSTinSP_Before_Asset, VSTinSP_After_Asset)
    assert.equal(ETHinSP_Before_Asset, ETHinSP_After_Asset)

    // Check remaining VST Deposits and ETH gain, for whale and depositors whose troves were liquidated
    const whale_Deposit_After = (await stabilityPool.getCompoundedVSTDeposit(whale)).toString()
    const alice_Deposit_After = (await stabilityPool.getCompoundedVSTDeposit(alice)).toString()
    const bob_Deposit_After = (await stabilityPool.getCompoundedVSTDeposit(bob)).toString()

    const whale_ETHGain_After = (await stabilityPool.getDepositorAssetGain(whale)).toString()
    const alice_ETHGain_After = (await stabilityPool.getDepositorAssetGain(alice)).toString()
    const bob_ETHGain_After = (await stabilityPool.getDepositorAssetGain(bob)).toString()

    const whale_Deposit_After_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(whale)).toString()
    const alice_Deposit_After_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(alice)).toString()
    const bob_Deposit_After_Asset = (await stabilityPoolERC20.getCompoundedVSTDeposit(bob)).toString()

    const whale_ETHGain_After_Asset = (await stabilityPoolERC20.getDepositorAssetGain(whale)).toString()
    const alice_ETHGain_After_Asset = (await stabilityPoolERC20.getDepositorAssetGain(alice)).toString()
    const bob_ETHGain_After_Asset = (await stabilityPoolERC20.getDepositorAssetGain(bob)).toString()

    assert.equal(whale_Deposit_After, dec(400, 18))
    assert.equal(alice_Deposit_After, dec(100, 18))
    assert.equal(bob_Deposit_After, dec(300, 18))

    assert.equal(whale_ETHGain_After, '0')
    assert.equal(alice_ETHGain_After, '0')
    assert.equal(bob_ETHGain_After, '0')

    assert.equal(whale_Deposit_After_Asset, dec(400, 18))
    assert.equal(alice_Deposit_After_Asset, dec(100, 18))
    assert.equal(bob_Deposit_After_Asset, dec(300, 18))

    assert.equal(whale_ETHGain_After_Asset, '0')
    assert.equal(alice_ETHGain_After_Asset, '0')
    assert.equal(bob_ETHGain_After_Asset, '0')
  })

  it("liquidateTroves() with a non fullfilled liquidation: non liquidated trove remains active", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(198, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(196, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(198, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: carol } })

    await openTrove({ ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(208, 16)), extraParams: { from: erin } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(208, 16)), extraParams: { from: erin } })

    // Whale provides VST to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(C_totalDebt.div(toBN(2)))
    await openTrove({ ICR: toBN(dec(300, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset.div(toBN(2)))
    await openTrove({ asset: erc20.address, ICR: toBN(dec(300, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check A, B, C, D, E troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Asset.gt(mv._MCR) && ICR_C_Asset.lt(TCR_Asset))

    /* Liquidate troves. Troves are ordered by ICR, from low to high:  A, B, C, D, E.
    With 253 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated. 
    That leaves 50 VST in the Pool to absorb exactly half of Carol's debt (100) */
    await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    await troveManager.liquidateTroves(erc20.address, 10)

    // Check A and B closed
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))

    assert.isFalse(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))

    // Check C remains active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '1') // check Status is active

    assert.isTrue(await sortedTroves.contains(erc20.address, carol))
    assert.equal((await troveManager.Troves(carol, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '1')
  })

  it("liquidateTroves() with a non fullfilled liquidation: non liquidated trove remains in TroveOwners Array", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(211, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(212, 16)), extraParams: { from: carol } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(211, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(212, 16)), extraParams: { from: carol } })

    await openTrove({ ICR: toBN(dec(219, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(221, 16)), extraParams: { from: erin } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(219, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(221, 16)), extraParams: { from: erin } })

    // Whale provides VST to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(C_totalDebt.div(toBN(2)))
    await openTrove({ ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset.div(toBN(2)))
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Asset.gt(mv._MCR) && ICR_C_Asset.lt(TCR_Asset))

    /* Liquidate troves. Troves are ordered by ICR, from low to high:  A, B, C.
    With 253 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated. 
    That leaves 50 VST in the Pool to absorb exactly half of Carol's debt (100) */
    await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    await troveManager.liquidateTroves(erc20.address, 10)

    // Check C is in Trove owners array
    const arrayLength = (await troveManager.getTroveOwnersCount(ZERO_ADDRESS)).toNumber()
    let addressFound = false;
    let addressIdx = 0;

    for (let i = 0; i < arrayLength; i++) {
      const address = (await troveManager.TroveOwners(ZERO_ADDRESS, i)).toString()
      if (address == carol) {
        addressFound = true
        addressIdx = i
      }
    }

    assert.isTrue(addressFound);

    // Check TroveOwners idx on trove struct == idx of address found in TroveOwners array
    const idxOnStruct = (await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_ARRAY_INDEX].toString()
    assert.equal(addressIdx.toString(), idxOnStruct)


    const arrayLength_Asset = (await troveManager.getTroveOwnersCount(erc20.address)).toNumber()
    let addressFound_Asset = false;
    let addressIdx_Asset = 0;

    for (let i = 0; i < arrayLength_Asset; i++) {
      const address_Asset = (await troveManager.TroveOwners(erc20.address, i)).toString()
      if (address_Asset == carol) {
        addressFound_Asset = true
        addressIdx_Asset = i
      }
    }

    assert.isTrue(addressFound_Asset);

    // Check TroveOwners idx on trove struct == idx of address found in TroveOwners array
    const idxOnStruct_Asset = (await troveManager.Troves(carol, erc20.address))[th.TROVE_ARRAY_INDEX].toString()
    assert.equal(addressIdx_Asset.toString(), idxOnStruct_Asset)
  })

  it("liquidateTroves() with a non fullfilled liquidation: still can liquidate further troves after the non-liquidated, emptied pool", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(198, 16)), extraParams: { from: bob } })
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: D_totalDebt, extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(208, 16)), extraParams: { from: erin } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(196, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(198, 16)), extraParams: { from: bob } })
    const { totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: D_totalDebt_Asset, extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(208, 16)), extraParams: { from: erin } })

    // Whale provides VST to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(D_totalDebt)
    await openTrove({ ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(D_totalDebt_Asset)
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts)

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check A, B, C, D, E troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
    const ICR_D = await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)
    const ICR_E = await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
    const ICR_D_Asset = await troveManager.getCurrentICR(erc20.address, dennis, price)
    const ICR_E_Asset = await troveManager.getCurrentICR(erc20.address, erin, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))
    assert.isTrue(ICR_D.gt(mv._MCR) && ICR_D.lt(TCR))
    assert.isTrue(ICR_E.gt(mv._MCR) && ICR_E.lt(TCR))

    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Asset.gt(mv._MCR) && ICR_C_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_D_Asset.gt(mv._MCR) && ICR_D_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_E_Asset.gt(mv._MCR) && ICR_E_Asset.lt(TCR_Asset))

    /* Liquidate troves. Troves are ordered by ICR, from low to high:  A, B, C, D, E.
     With 300 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated.
     That leaves 97 VST in the Pool that won’t be enough to absorb Carol,
     but it will be enough to liquidate Dennis. Afterwards the pool will be empty,
     so Erin won’t liquidated. */
    const tx = await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    console.log('gasUsed: ', tx.receipt.gasUsed)

    const tx_Asset = await troveManager.liquidateTroves(erc20.address, 10)
    console.log('gasUsed Asset: ', tx_Asset.receipt.gasUsed)

    // Check A, B and D are closed
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    console.log(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))

    assert.isFalse(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    console.log(await sortedTroves.contains(erc20.address, carol))
    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))

    // Check whale, C and E stay active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, whale))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, erin))

    assert.isTrue(await sortedTroves.contains(erc20.address, whale))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))
    assert.isTrue(await sortedTroves.contains(erc20.address, erin))
  })

  it("liquidateTroves() with a non fullfilled liquidation: still can liquidate further troves after the non-liquidated, non emptied pool", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(198, 16)), extraParams: { from: bob } })
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: D_totalDebt, extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(208, 16)), extraParams: { from: erin } })


    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(196, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(198, 16)), extraParams: { from: bob } })
    const { totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: D_totalDebt_Asset, extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(208, 16)), extraParams: { from: erin } })

    // Whale provides VST to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(D_totalDebt)
    await openTrove({ ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(D_totalDebt_Asset)
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check A, B, C, D, E troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
    const ICR_D = await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)
    const ICR_E = await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
    const ICR_D_Asset = await troveManager.getCurrentICR(erc20.address, dennis, price)
    const ICR_E_Asset = await troveManager.getCurrentICR(erc20.address, erin, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))
    assert.isTrue(ICR_D.gt(mv._MCR) && ICR_D.lt(TCR))
    assert.isTrue(ICR_E.gt(mv._MCR) && ICR_E.lt(TCR))

    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Asset.gt(mv._MCR) && ICR_C_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_D_Asset.gt(mv._MCR) && ICR_D_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_E_Asset.gt(mv._MCR) && ICR_E_Asset.lt(TCR_Asset))

    /* Liquidate troves. Troves are ordered by ICR, from low to high:  A, B, C, D, E.
     With 301 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated.
     That leaves 97 VST in the Pool that won’t be enough to absorb Carol,
     but it will be enough to liquidate Dennis. Afterwards the pool will be empty,
     so Erin won’t liquidated.
     Note that, compared to the previous test, this one will make 1 more loop iteration,
     so it will consume more gas. */
    const tx = await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    console.log('gasUsed: ', tx.receipt.gasUsed)

    const tx_Asset = await troveManager.liquidateTroves(erc20.address, 10)
    console.log('gasUsed: ', tx_Asset.receipt.gasUsed)

    // Check A, B and D are closed
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))

    assert.isFalse(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))

    // Check whale, C and E stay active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, whale))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, erin))

    assert.isTrue(await sortedTroves.contains(erc20.address, whale))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))
    assert.isTrue(await sortedTroves.contains(erc20.address, erin))
  })

  it("liquidateTroves() with a non fullfilled liquidation: total liquidated coll and debt is correct", async () => {
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(198, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(208, 16)), extraParams: { from: erin } })


    const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(196, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(198, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(208, 16)), extraParams: { from: erin } })

    // Whale provides VST to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(C_totalDebt.div(toBN(2)))
    await openTrove({ ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset.div(toBN(2)))
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Asset.gt(mv._MCR) && ICR_C_Asset.lt(TCR_Asset))

    const entireSystemCollBefore = await troveManager.getEntireSystemColl(ZERO_ADDRESS)
    const entireSystemDebtBefore = await troveManager.getEntireSystemDebt(ZERO_ADDRESS)
    const entireSystemCollBefore_Asset = await troveManager.getEntireSystemColl(erc20.address)
    const entireSystemDebtBefore_Asset = await troveManager.getEntireSystemDebt(erc20.address)

    /* Liquidate troves. Troves are ordered by ICR, from low to high:  A, B, C, D, E.
    With 253 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated. 
    That leaves 50 VST in the Pool that won’t be enough to absorb any other trove */
    await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    await troveManager.liquidateTroves(erc20.address, 10)

    // Expect system debt reduced by 203 VST and system coll 2.3 ETH
    const entireSystemCollAfter = await troveManager.getEntireSystemColl(ZERO_ADDRESS)
    const entireSystemDebtAfter = await troveManager.getEntireSystemDebt(ZERO_ADDRESS)
    const entireSystemCollAfter_Asset = await troveManager.getEntireSystemColl(erc20.address)
    const entireSystemDebtAfter_Asset = await troveManager.getEntireSystemDebt(erc20.address)

    const changeInEntireSystemColl = entireSystemCollBefore.sub(entireSystemCollAfter)
    const changeInEntireSystemDebt = entireSystemDebtBefore.sub(entireSystemDebtAfter)
    const changeInEntireSystemColl_Asset = entireSystemCollBefore_Asset.sub(entireSystemCollAfter_Asset)
    const changeInEntireSystemDebt_Asset = entireSystemDebtBefore_Asset.sub(entireSystemDebtAfter_Asset)

    assert.equal(changeInEntireSystemColl.toString(), A_coll.add(B_coll))
    th.assertIsApproximatelyEqual(changeInEntireSystemDebt.toString(), A_totalDebt.add(B_totalDebt))

    assert.equal(changeInEntireSystemColl_Asset.toString(), A_coll_Asset.add(B_coll_Asset))
    th.assertIsApproximatelyEqual(changeInEntireSystemDebt_Asset.toString(), A_totalDebt_Asset.add(B_totalDebt_Asset))
  })

  it("liquidateTroves() with a non fullfilled liquidation: emits correct liquidation event values", async () => {
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(211, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(212, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(219, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(221, 16)), extraParams: { from: erin } })

    const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(211, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(212, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(219, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(221, 16)), extraParams: { from: erin } })

    // Whale provides VST to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(C_totalDebt.div(toBN(2)))
    await openTrove({ ICR: toBN(dec(240, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset.div(toBN(2)))
    await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Asset.gt(mv._MCR) && ICR_C_Asset.lt(TCR_Asset))

    /* Liquidate troves. Troves are ordered by ICR, from low to high:  A, B, C, D, E.
    With 253 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated. 
    That leaves 50 VST in the Pool which won’t be enough for any other liquidation */
    const liquidationTx = await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    const liquidationTx_Asset = await troveManager.liquidateTroves(erc20.address, 10)

    const [liquidatedDebt, liquidatedColl, collGasComp, VSTGasComp] = th.getEmittedLiquidationValues(liquidationTx)
    const [liquidatedDebt_Asset, liquidatedColl_Asset, collGasComp_Asset, VSTGasComp_Asset] = th.getEmittedLiquidationValues(liquidationTx_Asset)

    th.assertIsApproximatelyEqual(liquidatedDebt, A_totalDebt.add(B_totalDebt))
    const equivalentColl = A_totalDebt.add(B_totalDebt).mul(toBN(dec(11, 17))).div(price)
    th.assertIsApproximatelyEqual(liquidatedColl, th.applyLiquidationFee(equivalentColl))
    th.assertIsApproximatelyEqual(collGasComp, equivalentColl.sub(th.applyLiquidationFee(equivalentColl))) // 0.5% of 283/120*1.1
    assert.equal(VSTGasComp.toString(), dec(400, 18))

    th.assertIsApproximatelyEqual(liquidatedDebt_Asset, A_totalDebt_Asset.add(B_totalDebt_Asset))
    const equivalentColl_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).mul(toBN(dec(11, 17))).div(price)
    th.assertIsApproximatelyEqual(liquidatedColl_Asset, th.applyLiquidationFee(equivalentColl_Asset))
    th.assertIsApproximatelyEqual(collGasComp_Asset, equivalentColl_Asset.sub(th.applyLiquidationFee(equivalentColl_Asset))) // 0.5% of 283/120*1.1
    assert.equal(VSTGasComp_Asset.toString(), dec(400, 18))

    // check collateral surplus
    const alice_remainingCollateral = A_coll.sub(A_totalDebt.mul(th.toBN(dec(11, 17))).div(price))
    const bob_remainingCollateral = B_coll.sub(B_totalDebt.mul(th.toBN(dec(11, 17))).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, alice), alice_remainingCollateral)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, bob), bob_remainingCollateral)

    const alice_remainingCollateral_Asset = A_coll_Asset.sub(A_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))
    const bob_remainingCollateral_Asset = B_coll_Asset.sub(B_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, alice), alice_remainingCollateral_Asset)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, bob), bob_remainingCollateral_Asset)

    // can claim collateral
    const alice_balanceBefore = th.toBN(await web3.eth.getBalance(alice))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: alice, gasPrice: 0 })
    const alice_balanceAfter = th.toBN(await web3.eth.getBalance(alice))
    th.assertIsApproximatelyEqual(alice_balanceAfter, alice_balanceBefore.add(th.toBN(alice_remainingCollateral)))

    const alice_balanceBefore_Asset = th.toBN(await erc20.balanceOf(alice))
    await borrowerOperations.claimCollateral(erc20.address, { from: alice, gasPrice: 0 })
    const alice_balanceAfter_Asset = th.toBN(await erc20.balanceOf(alice))
    th.assertIsApproximatelyEqual(alice_balanceAfter_Asset, alice_balanceBefore_Asset.add(th.toBN(alice_remainingCollateral_Asset.div(toBN(10 ** 10)))))

    const bob_balanceBefore = th.toBN(await web3.eth.getBalance(bob))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: bob, gasPrice: 0 })
    const bob_balanceAfter = th.toBN(await web3.eth.getBalance(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter, bob_balanceBefore.add(th.toBN(bob_remainingCollateral)))

    const bob_balanceBefore_Asset = th.toBN(await erc20.balanceOf(bob))
    await borrowerOperations.claimCollateral(erc20.address, { from: bob, gasPrice: 0 })
    const bob_balanceAfter_Asset = th.toBN(await erc20.balanceOf(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter_Asset, bob_balanceBefore_Asset.add(th.toBN(bob_remainingCollateral_Asset).div(toBN(10 ** 10))))
  })

  it("liquidateTroves() with a non fullfilled liquidation: ICR of non liquidated trove does not change", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(198, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(208, 16)), extraParams: { from: erin } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(196, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(198, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(208, 16)), extraParams: { from: erin } })

    // Whale provides VST to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(C_totalDebt.div(toBN(2)))
    await openTrove({ ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset.div(toBN(2)))
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C_Before = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Before_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C_Before.gt(mv._MCR) && ICR_C_Before.lt(TCR))

    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Before_Asset.gt(mv._MCR) && ICR_C_Before_Asset.lt(TCR_Asset))

    /* Liquidate troves. Troves are ordered by ICR, from low to high:  A, B, C, D, E.
    With 253 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated. 
    That leaves 50 VST in the Pool to absorb exactly half of Carol's debt (100) */
    await troveManager.liquidateTroves(ZERO_ADDRESS, 10)
    await troveManager.liquidateTroves(erc20.address, 10)

    const ICR_C_After = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
    assert.equal(ICR_C_Before.toString(), ICR_C_After)
    const ICR_C_After_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
    assert.equal(ICR_C_Before_Asset.toString(), ICR_C_After_Asset)
  })

  // TODO: LiquidateTroves tests that involve troves with ICR > TCR

  // --- batchLiquidateTroves() ---

  it("batchLiquidateTroves(): Liquidates all troves with ICR < 110%, transitioning Normal -> Recovery Mode", async () => {
    // make 6 Troves accordingly
    // --- SETUP ---
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(230, 16)), extraParams: { from: dennis } })
    const { totalDebt: E_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: erin } })
    const { totalDebt: F_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: freddy } })

    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(230, 16)), extraParams: { from: dennis } })
    const { totalDebt: E_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: erin } })
    const { totalDebt: F_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: freddy } })

    const spDeposit = B_totalDebt.add(C_totalDebt).add(D_totalDebt).add(E_totalDebt).add(F_totalDebt)
    await openTrove({ ICR: toBN(dec(426, 16)), extraVSTAmount: spDeposit, extraParams: { from: alice } })

    const spDeposit_Asset = B_totalDebt_Asset.add(C_totalDebt_Asset).add(D_totalDebt_Asset).add(E_totalDebt_Asset).add(F_totalDebt_Asset)
    await openTrove({ asset: erc20.address, ICR: toBN(dec(426, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: alice } })

    // Alice deposits VST to Stability Pool
    await stabilityPool.provideToSP(spDeposit, { from: alice })
    await stabilityPoolERC20.provideToSP(spDeposit, { from: alice })

    // price drops to 1ETH:85VST, reducing TCR below 150%
    await priceFeed.setPrice('85000000000000000000')
    const price = await priceFeed.getPrice()

    // check Recovery Mode kicks in

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // check TCR < 150%
    const _150percent = web3.utils.toBN('1500000000000000000')
    const TCR_Before = await th.getTCR(contracts)
    assert.isTrue(TCR_Before.lt(_150percent))

    const TCR_Before_Asset = await th.getTCR(contracts, erc20.address)
    assert.isTrue(TCR_Before_Asset.lt(_150percent))

    /* 
    After the price drop and prior to any liquidations, ICR should be:

    Trove         ICR
    Alice       182%
    Bob         102%
    Carol       102%
    Dennis      102%
    Elisa       102%
    Freddy      102%
    */
    alice_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    carol_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
    dennis_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)
    erin_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)
    freddy_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, freddy, price)

    alice_ICR_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    carol_ICR_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
    dennis_ICR_Asset = await troveManager.getCurrentICR(erc20.address, dennis, price)
    erin_ICR_Asset = await troveManager.getCurrentICR(erc20.address, erin, price)
    freddy_ICR_Asset = await troveManager.getCurrentICR(erc20.address, freddy, price)

    // Alice should have ICR > 150%
    assert.isTrue(alice_ICR.gt(_150percent))
    assert.isTrue(alice_ICR_Asset.gt(_150percent))
    // All other Troves should have ICR < 150%
    assert.isTrue(carol_ICR.lt(_150percent))
    assert.isTrue(dennis_ICR.lt(_150percent))
    assert.isTrue(erin_ICR.lt(_150percent))
    assert.isTrue(freddy_ICR.lt(_150percent))

    assert.isTrue(carol_ICR_Asset.lt(_150percent))
    assert.isTrue(dennis_ICR_Asset.lt(_150percent))
    assert.isTrue(erin_ICR_Asset.lt(_150percent))
    assert.isTrue(freddy_ICR_Asset.lt(_150percent))

    /* After liquidating Bob and Carol, the the TCR of the system rises above the CCR, to 154%.  
    (see calculations in Google Sheet)

    Liquidations continue until all Troves with ICR < MCR have been closed. 
    Only Alice should remain active - all others should be closed. */

    // call batchLiquidateTroves
    await troveManager.batchLiquidateTroves(ZERO_ADDRESS, [alice, bob, carol, dennis, erin, freddy]);
    await troveManager.batchLiquidateTroves(erc20.address, [alice, bob, carol, dennis, erin, freddy]);

    // check system is no longer in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // After liquidation, TCR should rise to above 150%. 
    const TCR_After = await th.getTCR(contracts)
    assert.isTrue(TCR_After.gt(_150percent))

    const TCR_After_Asset = await th.getTCR(contracts, erc20.address)
    assert.isTrue(TCR_After_Asset.gt(_150percent))

    // get all Troves
    const alice_Trove = await troveManager.Troves(alice, ZERO_ADDRESS)
    const bob_Trove = await troveManager.Troves(bob, ZERO_ADDRESS)
    const carol_Trove = await troveManager.Troves(carol, ZERO_ADDRESS)
    const dennis_Trove = await troveManager.Troves(dennis, ZERO_ADDRESS)
    const erin_Trove = await troveManager.Troves(erin, ZERO_ADDRESS)
    const freddy_Trove = await troveManager.Troves(freddy, ZERO_ADDRESS)

    const alice_Trove_Asset = await troveManager.Troves(alice, erc20.address)
    const bob_Trove_Asset = await troveManager.Troves(bob, erc20.address)
    const carol_Trove_Asset = await troveManager.Troves(carol, erc20.address)
    const dennis_Trove_Asset = await troveManager.Troves(dennis, erc20.address)
    const erin_Trove_Asset = await troveManager.Troves(erin, erc20.address)
    const freddy_Trove_Asset = await troveManager.Troves(freddy, erc20.address)

    // check that Alice's Trove remains active
    assert.equal(alice_Trove[th.TROVE_STATUS_INDEX], 1)
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))

    assert.equal(alice_Trove_Asset[th.TROVE_STATUS_INDEX], 1)
    assert.isTrue(await sortedTroves.contains(erc20.address, alice))

    // check all other Troves are liquidated
    assert.equal(bob_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(carol_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(dennis_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(erin_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(freddy_Trove[th.TROVE_STATUS_INDEX], 3)

    assert.equal(bob_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(carol_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(dennis_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(erin_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(freddy_Trove_Asset[th.TROVE_STATUS_INDEX], 3)

    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, erin))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, freddy))

    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))
    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))
    assert.isFalse(await sortedTroves.contains(erc20.address, erin))
    assert.isFalse(await sortedTroves.contains(erc20.address, freddy))
  })

  it("batchLiquidateTroves(): Liquidates all troves with ICR < 110%, transitioning Recovery -> Normal Mode", async () => {
    /* This is essentially the same test as before, but changing the order of the batch,
     * now the remaining trove (alice) goes at the end.
     * This way alice will be skipped in a different part of the code, as in the previous test,
     * when attempting alice the system was in Recovery mode, while in this test,
     * when attempting alice the system has gone back to Normal mode
     * (see function `_getTotalFromBatchLiquidate_RecoveryMode`)
     */
    // make 6 Troves accordingly
    // --- SETUP ---

    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(230, 16)), extraParams: { from: dennis } })
    const { totalDebt: E_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: erin } })
    const { totalDebt: F_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: freddy } })

    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(230, 16)), extraParams: { from: dennis } })
    const { totalDebt: E_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: erin } })
    const { totalDebt: F_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: freddy } })

    const spDeposit = B_totalDebt.add(C_totalDebt).add(D_totalDebt).add(E_totalDebt).add(F_totalDebt)
    await openTrove({ ICR: toBN(dec(426, 16)), extraVSTAmount: spDeposit, extraParams: { from: alice } })

    const spDeposit_Asset = B_totalDebt_Asset.add(C_totalDebt_Asset).add(D_totalDebt_Asset).add(E_totalDebt_Asset).add(F_totalDebt_Asset)
    await openTrove({ asset: erc20.address, ICR: toBN(dec(426, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: alice } })

    // Alice deposits VST to Stability Pool
    await stabilityPool.provideToSP(spDeposit, { from: alice })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: alice })

    // price drops to 1ETH:85VST, reducing TCR below 150%
    await priceFeed.setPrice('85000000000000000000')
    const price = await priceFeed.getPrice()

    // check Recovery Mode kicks in

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // check TCR < 150%
    const _150percent = web3.utils.toBN('1500000000000000000')
    const TCR_Before = await th.getTCR(contracts)
    assert.isTrue(TCR_Before.lt(_150percent))

    const TCR_Before_Asset = await th.getTCR(contracts, erc20.address)
    assert.isTrue(TCR_Before_Asset.lt(_150percent))

    /*
    After the price drop and prior to any liquidations, ICR should be:

    Trove         ICR
    Alice       182%
    Bob         102%
    Carol       102%
    Dennis      102%
    Elisa       102%
    Freddy      102%
    */
    const alice_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const carol_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
    const dennis_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)
    const erin_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)
    const freddy_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, freddy, price)

    const alice_ICR_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const carol_ICR_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
    const dennis_ICR_Asset = await troveManager.getCurrentICR(erc20.address, dennis, price)
    const erin_ICR_Asset = await troveManager.getCurrentICR(erc20.address, erin, price)
    const freddy_ICR_Asset = await troveManager.getCurrentICR(erc20.address, freddy, price)

    // Alice should have ICR > 150%
    assert.isTrue(alice_ICR.gt(_150percent))
    assert.isTrue(alice_ICR_Asset.gt(_150percent))
    // All other Troves should have ICR < 150%
    assert.isTrue(carol_ICR.lt(_150percent))
    assert.isTrue(dennis_ICR.lt(_150percent))
    assert.isTrue(erin_ICR.lt(_150percent))
    assert.isTrue(freddy_ICR.lt(_150percent))

    assert.isTrue(carol_ICR_Asset.lt(_150percent))
    assert.isTrue(dennis_ICR_Asset.lt(_150percent))
    assert.isTrue(erin_ICR_Asset.lt(_150percent))
    assert.isTrue(freddy_ICR_Asset.lt(_150percent))

    /* After liquidating Bob and Carol, the the TCR of the system rises above the CCR, to 154%.  
    (see calculations in Google Sheet)

    Liquidations continue until all Troves with ICR < MCR have been closed. 
    Only Alice should remain active - all others should be closed. */

    // call batchLiquidateTroves
    await troveManager.batchLiquidateTroves(ZERO_ADDRESS, [bob, carol, dennis, erin, freddy, alice]);
    await troveManager.batchLiquidateTroves(erc20.address, [bob, carol, dennis, erin, freddy, alice]);

    // check system is no longer in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // After liquidation, TCR should rise to above 150%. 
    const TCR_After = await th.getTCR(contracts)
    assert.isTrue(TCR_After.gt(_150percent))

    const TCR_After_Asset = await th.getTCR(contracts, erc20.address)
    assert.isTrue(TCR_After_Asset.gt(_150percent))

    // get all Troves
    const alice_Trove = await troveManager.Troves(alice, ZERO_ADDRESS)
    const bob_Trove = await troveManager.Troves(bob, ZERO_ADDRESS)
    const carol_Trove = await troveManager.Troves(carol, ZERO_ADDRESS)
    const dennis_Trove = await troveManager.Troves(dennis, ZERO_ADDRESS)
    const erin_Trove = await troveManager.Troves(erin, ZERO_ADDRESS)
    const freddy_Trove = await troveManager.Troves(freddy, ZERO_ADDRESS)

    const alice_Trove_Asset = await troveManager.Troves(alice, erc20.address)
    const bob_Trove_Asset = await troveManager.Troves(bob, erc20.address)
    const carol_Trove_Asset = await troveManager.Troves(carol, erc20.address)
    const dennis_Trove_Asset = await troveManager.Troves(dennis, erc20.address)
    const erin_Trove_Asset = await troveManager.Troves(erin, erc20.address)
    const freddy_Trove_Asset = await troveManager.Troves(freddy, erc20.address)

    // check that Alice's Trove remains active
    assert.equal(alice_Trove[th.TROVE_STATUS_INDEX], 1)
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))

    assert.equal(alice_Trove_Asset[th.TROVE_STATUS_INDEX], 1)
    assert.isTrue(await sortedTroves.contains(erc20.address, alice))

    // check all other Troves are liquidated
    assert.equal(bob_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(carol_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(dennis_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(erin_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(freddy_Trove[th.TROVE_STATUS_INDEX], 3)

    assert.equal(bob_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(carol_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(dennis_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(erin_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(freddy_Trove_Asset[th.TROVE_STATUS_INDEX], 3)

    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, erin))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, freddy))

    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))
    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))
    assert.isFalse(await sortedTroves.contains(erc20.address, erin))
    assert.isFalse(await sortedTroves.contains(erc20.address, freddy))
  })

  it("batchLiquidateTroves(): Liquidates all troves with ICR < 110%, transitioning Normal -> Recovery Mode", async () => {
    // This is again the same test as the before the last one, but now Alice is skipped because she is not active
    // It also skips bob, as he is added twice, for being already liquidated
    // make 6 Troves accordingly
    // --- SETUP ---
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(230, 16)), extraParams: { from: dennis } })
    const { totalDebt: E_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: erin } })
    const { totalDebt: F_totalDebt } = await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: freddy } })

    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(230, 16)), extraParams: { from: dennis } })
    const { totalDebt: E_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: erin } })
    const { totalDebt: F_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(240, 16)), extraParams: { from: freddy } })

    const spDeposit = B_totalDebt.add(C_totalDebt).add(D_totalDebt).add(E_totalDebt).add(F_totalDebt)
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(426, 16)), extraVSTAmount: spDeposit, extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(426, 16)), extraVSTAmount: A_totalDebt, extraParams: { from: whale } })

    const spDeposit_Asset = B_totalDebt_Asset.add(C_totalDebt_Asset).add(D_totalDebt_Asset).add(E_totalDebt_Asset).add(F_totalDebt_Asset)
    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(426, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(426, 16)), extraVSTAmount: A_totalDebt_Asset, extraParams: { from: whale } })

    // Alice deposits VST to Stability Pool
    await stabilityPool.provideToSP(spDeposit, { from: alice })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: alice })

    // to compensate borrowing fee
    await vstToken.transfer(alice, A_totalDebt.add(A_totalDebt_Asset), { from: whale })
    // Alice closes trove
    await borrowerOperations.closeTrove(ZERO_ADDRESS, { from: alice })
    await borrowerOperations.closeTrove(erc20.address, { from: alice })

    // price drops to 1ETH:85VST, reducing TCR below 150%
    await priceFeed.setPrice('85000000000000000000')
    const price = await priceFeed.getPrice()

    // check Recovery Mode kicks in

    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // check TCR < 150%
    const _150percent = web3.utils.toBN('1500000000000000000')
    const TCR_Before = await th.getTCR(contracts)
    assert.isTrue(TCR_Before.lt(_150percent))

    const TCR_Before_Asset = await th.getTCR(contracts, erc20.addres)
    assert.isTrue(TCR_Before_Asset.lt(_150percent))

    /*
    After the price drop and prior to any liquidations, ICR should be:

    Trove         ICR
    Alice       182%
    Bob         102%
    Carol       102%
    Dennis      102%
    Elisa       102%
    Freddy      102%
    */
    alice_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    bob_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    carol_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
    dennis_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)
    erin_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)
    freddy_ICR = await troveManager.getCurrentICR(ZERO_ADDRESS, freddy, price)

    alice_ICR_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    bob_ICR_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    carol_ICR_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
    dennis_ICR_Asset = await troveManager.getCurrentICR(erc20.address, dennis, price)
    erin_ICR_Asset = await troveManager.getCurrentICR(erc20.address, erin, price)
    freddy_ICR_Asset = await troveManager.getCurrentICR(erc20.address, freddy, price)

    // Alice should have ICR > 150%
    assert.isTrue(alice_ICR.gt(_150percent))
    assert.isTrue(alice_ICR_Asset.gt(_150percent))
    // All other Troves should have ICR < 150%
    assert.isTrue(carol_ICR.lt(_150percent))
    assert.isTrue(dennis_ICR.lt(_150percent))
    assert.isTrue(erin_ICR.lt(_150percent))
    assert.isTrue(freddy_ICR.lt(_150percent))

    assert.isTrue(carol_ICR_Asset.lt(_150percent))
    assert.isTrue(dennis_ICR_Asset.lt(_150percent))
    assert.isTrue(erin_ICR_Asset.lt(_150percent))
    assert.isTrue(freddy_ICR_Asset.lt(_150percent))

    /* After liquidating Bob and Carol, the the TCR of the system rises above the CCR, to 154%.
    (see calculations in Google Sheet)

    Liquidations continue until all Troves with ICR < MCR have been closed.
    Only Alice should remain active - all others should be closed. */

    // call batchLiquidateTroves
    await troveManager.batchLiquidateTroves(ZERO_ADDRESS, [alice, bob, bob, carol, dennis, erin, freddy]);
    await troveManager.batchLiquidateTroves(erc20.address, [alice, bob, bob, carol, dennis, erin, freddy]);

    // check system is no longer in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))
    assert.isFalse(await th.checkRecoveryMode(contracts, erc20.address))

    // After liquidation, TCR should rise to above 150%.
    const TCR_After = await th.getTCR(contracts)
    assert.isTrue(TCR_After.gt(_150percent))

    const TCR_After_Asset = await th.getTCR(contracts, erc20.address)
    assert.isTrue(TCR_After_Asset.gt(_150percent))

    // get all Troves
    const alice_Trove = await troveManager.Troves(alice, ZERO_ADDRESS)
    const bob_Trove = await troveManager.Troves(bob, ZERO_ADDRESS)
    const carol_Trove = await troveManager.Troves(carol, ZERO_ADDRESS)
    const dennis_Trove = await troveManager.Troves(dennis, ZERO_ADDRESS)
    const erin_Trove = await troveManager.Troves(erin, ZERO_ADDRESS)
    const freddy_Trove = await troveManager.Troves(freddy, ZERO_ADDRESS)

    const alice_Trove_Asset = await troveManager.Troves(alice, erc20.address)
    const bob_Trove_Asset = await troveManager.Troves(bob, erc20.address)
    const carol_Trove_Asset = await troveManager.Troves(carol, erc20.address)
    const dennis_Trove_Asset = await troveManager.Troves(dennis, erc20.address)
    const erin_Trove_Asset = await troveManager.Troves(erin, erc20.address)
    const freddy_Trove_Asset = await troveManager.Troves(freddy, erc20.address)

    // check that Alice's Trove is closed
    assert.equal(alice_Trove[th.TROVE_STATUS_INDEX], 2)
    assert.equal(alice_Trove_Asset[th.TROVE_STATUS_INDEX], 2)

    // check all other Troves are liquidated
    assert.equal(bob_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(carol_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(dennis_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(erin_Trove[th.TROVE_STATUS_INDEX], 3)
    assert.equal(freddy_Trove[th.TROVE_STATUS_INDEX], 3)

    assert.equal(bob_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(carol_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(dennis_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(erin_Trove_Asset[th.TROVE_STATUS_INDEX], 3)
    assert.equal(freddy_Trove_Asset[th.TROVE_STATUS_INDEX], 3)

    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, erin))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, freddy))

    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))
    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))
    assert.isFalse(await sortedTroves.contains(erc20.address, erin))
    assert.isFalse(await sortedTroves.contains(erc20.address, freddy))
  })

  it("batchLiquidateTroves() with a non fullfilled liquidation: non liquidated trove remains active", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(211, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(212, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(219, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(221, 16)), extraParams: { from: erin } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(211, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(212, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(219, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(221, 16)), extraParams: { from: erin } })

    // Whale provides VST to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(C_totalDebt.div(toBN(2)))
    await openTrove({ ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset.div(toBN(2)))
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Asset.gt(mv._MCR) && ICR_C_Asset.lt(TCR_Asset))

    const trovesToLiquidate = [alice, bob, carol]
    await troveManager.batchLiquidateTroves(ZERO_ADDRESS, trovesToLiquidate)
    await troveManager.batchLiquidateTroves(erc20.address, trovesToLiquidate)

    // Check A and B closed
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))

    assert.isFalse(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))

    // Check C remains active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.equal((await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX].toString(), '1') // check Status is active
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))
    assert.equal((await troveManager.Troves(carol, erc20.address))[th.TROVE_STATUS_INDEX].toString(), '1')
  })

  it("batchLiquidateTroves() with a non fullfilled liquidation: non liquidated trove remains in Trove Owners array", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(211, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(212, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(219, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(221, 16)), extraParams: { from: erin } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(211, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(212, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(219, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(221, 16)), extraParams: { from: erin } })

    // Whale provides VST to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(C_totalDebt.div(toBN(2)))
    const spDeposit_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset.div(toBN(2)))

    await openTrove({ ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Asset.gt(mv._MCR) && ICR_C_Asset.lt(TCR_Asset))

    const trovesToLiquidate = [alice, bob, carol]
    await troveManager.batchLiquidateTroves(ZERO_ADDRESS, trovesToLiquidate)
    await troveManager.batchLiquidateTroves(erc20.address, trovesToLiquidate)

    // Check C is in Trove owners array
    const arrayLength = (await troveManager.getTroveOwnersCount(ZERO_ADDRESS)).toNumber()
    let addressFound = false;
    let addressIdx = 0;

    for (let i = 0; i < arrayLength; i++) {
      const address = (await troveManager.TroveOwners(ZERO_ADDRESS, i)).toString()
      if (address == carol) {
        addressFound = true
        addressIdx = i
      }
    }

    assert.isTrue(addressFound);

    // Check TroveOwners idx on trove struct == idx of address found in TroveOwners array
    const idxOnStruct = (await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_ARRAY_INDEX].toString()
    assert.equal(addressIdx.toString(), idxOnStruct)


    // Check C is in Trove owners array
    const arrayLength_Asset = (await troveManager.getTroveOwnersCount(erc20.address)).toNumber()
    let addressFound_Asset = false;
    let addressIdx_Asset = 0;

    for (let i = 0; i < arrayLength_Asset; i++) {
      const address_Asset = (await troveManager.TroveOwners(erc20.address, i)).toString()
      if (address_Asset == carol) {
        addressFound_Asset = true
        addressIdx_Asset = i
      }
    }

    assert.isTrue(addressFound_Asset);

    // Check TroveOwners idx on trove struct == idx of address found in TroveOwners array
    const idxOnStruct_Asset = (await troveManager.Troves(carol, erc20.address))[th.TROVE_ARRAY_INDEX].toString()
    assert.equal(addressIdx_Asset.toString(), idxOnStruct_Asset)
  })

  it("batchLiquidateTroves() with a non fullfilled liquidation: still can liquidate further troves after the non-liquidated, emptied pool", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(198, 16)), extraParams: { from: bob } })
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: D_totalDebt, extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(208, 16)), extraParams: { from: erin } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(196, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(198, 16)), extraParams: { from: bob } })
    const { totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: D_totalDebt_Asset, extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(208, 16)), extraParams: { from: erin } })

    // Whale provides VST to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(C_totalDebt.div(toBN(2)))
    await openTrove({ ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset.div(toBN(2)))
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check A, B, C, D, E troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
    const ICR_D = await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)
    const ICR_E = await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
    const ICR_D_Asset = await troveManager.getCurrentICR(erc20.address, dennis, price)
    const ICR_E_Asset = await troveManager.getCurrentICR(erc20.address, erin, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))
    assert.isTrue(ICR_D.gt(mv._MCR) && ICR_D.lt(TCR))
    assert.isTrue(ICR_E.gt(mv._MCR) && ICR_E.lt(TCR))

    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Asset.gt(mv._MCR) && ICR_C_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_D_Asset.gt(mv._MCR) && ICR_D_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_E_Asset.gt(mv._MCR) && ICR_E_Asset.lt(TCR_Asset))

    /* With 300 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated.
     That leaves 97 VST in the Pool that won’t be enough to absorb Carol,
     but it will be enough to liquidate Dennis. Afterwards the pool will be empty,
     so Erin won’t liquidated. */
    const trovesToLiquidate = [alice, bob, carol, dennis, erin]
    const tx = await troveManager.batchLiquidateTroves(ZERO_ADDRESS, trovesToLiquidate)
    const tx_Asset = await troveManager.batchLiquidateTroves(erc20.address, trovesToLiquidate)
    console.log('gasUsed: ', tx.receipt.gasUsed)
    console.log('gasUsed: ', tx_Asset.receipt.gasUsed)

    // Check A, B and D are closed
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))

    assert.isFalse(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))

    // Check whale, C, D and E stay active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, whale))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, erin))

    assert.isTrue(await sortedTroves.contains(erc20.address, whale))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))
    assert.isTrue(await sortedTroves.contains(erc20.address, erin))
  })

  it("batchLiquidateTroves() with a non fullfilled liquidation: still can liquidate further troves after the non-liquidated, non emptied pool", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(198, 16)), extraParams: { from: bob } })
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraVSTAmount: D_totalDebt, extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(208, 16)), extraParams: { from: erin } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(196, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(198, 16)), extraParams: { from: bob } })
    const { totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraVSTAmount: D_totalDebt_Asset, extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(208, 16)), extraParams: { from: erin } })

    // Whale provides VST to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(C_totalDebt.div(toBN(2)))
    await openTrove({ ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset.div(toBN(2)))
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check A, B, C, D, E troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
    const ICR_D = await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)
    const ICR_E = await troveManager.getCurrentICR(ZERO_ADDRESS, erin, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
    const ICR_D_Asset = await troveManager.getCurrentICR(erc20.address, dennis, price)
    const ICR_E_Asset = await troveManager.getCurrentICR(erc20.address, erin, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))
    assert.isTrue(ICR_D.gt(mv._MCR) && ICR_D.lt(TCR))
    assert.isTrue(ICR_E.gt(mv._MCR) && ICR_E.lt(TCR))

    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Asset.gt(mv._MCR) && ICR_C_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_D_Asset.gt(mv._MCR) && ICR_D_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_E_Asset.gt(mv._MCR) && ICR_E_Asset.lt(TCR_Asset))

    /* With 301 in the SP, Alice (102 debt) and Bob (101 debt) should be entirely liquidated.
     That leaves 97 VST in the Pool that won’t be enough to absorb Carol,
     but it will be enough to liquidate Dennis. Afterwards the pool will be empty,
     so Erin won’t liquidated.
     Note that, compared to the previous test, this one will make 1 more loop iteration,
     so it will consume more gas. */
    const trovesToLiquidate = [alice, bob, carol, dennis, erin]
    const tx = await troveManager.batchLiquidateTroves(ZERO_ADDRESS, trovesToLiquidate)
    console.log('gasUsed: ', tx.receipt.gasUsed)

    const tx_Asset = await troveManager.batchLiquidateTroves(erc20.address, trovesToLiquidate)
    console.log('gasUsed Asset: ', tx_Asset.receipt.gasUsed)

    // Check A, B and D are closed
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))

    assert.isFalse(await sortedTroves.contains(erc20.address, alice))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))

    // Check whale, C, D and E stay active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, whale))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, erin))

    assert.isTrue(await sortedTroves.contains(erc20.address, whale))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))
    assert.isTrue(await sortedTroves.contains(erc20.address, erin))
  })

  it("batchLiquidateTroves() with a non fullfilled liquidation: total liquidated coll and debt is correct", async () => {
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(198, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(208, 16)), extraParams: { from: erin } })

    const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(196, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(198, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(208, 16)), extraParams: { from: erin } })


    // Whale provides VST to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(C_totalDebt.div(toBN(2)))
    await openTrove({ ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset.div(toBN(2)))
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check A, B, C, D, E troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Asset.gt(mv._MCR) && ICR_C_Asset.lt(TCR_Asset))

    const entireSystemCollBefore = await troveManager.getEntireSystemColl(ZERO_ADDRESS)
    const entireSystemDebtBefore = await troveManager.getEntireSystemDebt(ZERO_ADDRESS)

    const entireSystemCollBefore_Asset = await troveManager.getEntireSystemColl(erc20.address)
    const entireSystemDebtBefore_Asset = await troveManager.getEntireSystemDebt(erc20.address)

    const trovesToLiquidate = [alice, bob, carol]
    await troveManager.batchLiquidateTroves(ZERO_ADDRESS, trovesToLiquidate)
    await troveManager.batchLiquidateTroves(erc20.address, trovesToLiquidate)

    // Expect system debt reduced by 203 VST and system coll by 2 ETH
    const entireSystemCollAfter = await troveManager.getEntireSystemColl(ZERO_ADDRESS)
    const entireSystemDebtAfter = await troveManager.getEntireSystemDebt(ZERO_ADDRESS)

    const changeInEntireSystemColl = entireSystemCollBefore.sub(entireSystemCollAfter)
    const changeInEntireSystemDebt = entireSystemDebtBefore.sub(entireSystemDebtAfter)

    const entireSystemCollAfter_Asset = await troveManager.getEntireSystemColl(erc20.address)
    const entireSystemDebtAfter_Asset = await troveManager.getEntireSystemDebt(erc20.address)

    const changeInEntireSystemColl_Asset = entireSystemCollBefore_Asset.sub(entireSystemCollAfter_Asset)
    const changeInEntireSystemDebt_Asset = entireSystemDebtBefore_Asset.sub(entireSystemDebtAfter_Asset)

    assert.equal(changeInEntireSystemColl.toString(), A_coll.add(B_coll))
    th.assertIsApproximatelyEqual(changeInEntireSystemDebt.toString(), A_totalDebt.add(B_totalDebt))

    assert.equal(changeInEntireSystemColl_Asset.toString(), A_coll_Asset.add(B_coll_Asset))
    th.assertIsApproximatelyEqual(changeInEntireSystemDebt_Asset.toString(), A_totalDebt_Asset.add(B_totalDebt_Asset))
  })

  it("batchLiquidateTroves() with a non fullfilled liquidation: emits correct liquidation event values", async () => {
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(211, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(212, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(219, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(221, 16)), extraParams: { from: erin } })

    const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: alice } })
    const { collateral: B_coll_Asset, totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(211, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(212, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(219, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(221, 16)), extraParams: { from: erin } })

    // Whale provides VST to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(C_totalDebt.div(toBN(2)))
    await openTrove({ ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset.div(toBN(2)))
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Asset.gt(mv._MCR) && ICR_C_Asset.lt(TCR_Asset))

    const trovesToLiquidate = [alice, bob, carol]
    const liquidationTx = await troveManager.batchLiquidateTroves(ZERO_ADDRESS, trovesToLiquidate)
    const liquidationTx_Asset = await troveManager.batchLiquidateTroves(erc20.address, trovesToLiquidate)

    const [liquidatedDebt, liquidatedColl, collGasComp, VSTGasComp] = th.getEmittedLiquidationValues(liquidationTx)
    const [liquidatedDebt_Asset, liquidatedColl_Asset, collGasComp_Asset, VSTGasComp_Asset] = th.getEmittedLiquidationValues(liquidationTx_Asset)

    th.assertIsApproximatelyEqual(liquidatedDebt, A_totalDebt.add(B_totalDebt))
    th.assertIsApproximatelyEqual(liquidatedDebt_Asset, A_totalDebt_Asset.add(B_totalDebt_Asset))

    const equivalentColl = A_totalDebt.add(B_totalDebt).mul(toBN(dec(11, 17))).div(price)
    const equivalentColl_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).mul(toBN(dec(11, 17))).div(price)

    th.assertIsApproximatelyEqual(liquidatedColl, th.applyLiquidationFee(equivalentColl))
    th.assertIsApproximatelyEqual(collGasComp, equivalentColl.sub(th.applyLiquidationFee(equivalentColl))) // 0.5% of 283/120*1.1

    th.assertIsApproximatelyEqual(liquidatedColl_Asset, th.applyLiquidationFee(equivalentColl_Asset))
    th.assertIsApproximatelyEqual(collGasComp_Asset, equivalentColl_Asset.sub(th.applyLiquidationFee(equivalentColl_Asset)))

    assert.equal(VSTGasComp.toString(), dec(400, 18))
    assert.equal(VSTGasComp_Asset.toString(), dec(400, 18))

    // check collateral surplus
    const alice_remainingCollateral = A_coll.sub(A_totalDebt.mul(th.toBN(dec(11, 17))).div(price))
    const bob_remainingCollateral = B_coll.sub(B_totalDebt.mul(th.toBN(dec(11, 17))).div(price))

    const alice_remainingCollateral_Asset = A_coll_Asset.sub(A_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))
    const bob_remainingCollateral_Asset = B_coll_Asset.sub(B_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))

    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, alice), alice_remainingCollateral)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, bob), bob_remainingCollateral)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, alice), alice_remainingCollateral_Asset)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, bob), bob_remainingCollateral_Asset)

    // can claim collateral
    const alice_balanceBefore = th.toBN(await web3.eth.getBalance(alice))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: alice, gasPrice: 0 })
    const alice_balanceAfter = th.toBN(await web3.eth.getBalance(alice))
    th.assertIsApproximatelyEqual(alice_balanceAfter, alice_balanceBefore.add(th.toBN(alice_remainingCollateral)))

    const alice_balanceBefore_Asset = th.toBN(await erc20.balanceOf(alice))
    await borrowerOperations.claimCollateral(erc20.address, { from: alice, gasPrice: 0 })
    const alice_balanceAfter_Asset = th.toBN(await erc20.balanceOf(alice))
    th.assertIsApproximatelyEqual(alice_balanceAfter_Asset, alice_balanceBefore_Asset.add(th.toBN(alice_remainingCollateral_Asset.div(toBN(10 ** 10)))))

    const bob_balanceBefore = th.toBN(await web3.eth.getBalance(bob))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: bob, gasPrice: 0 })
    const bob_balanceAfter = th.toBN(await web3.eth.getBalance(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter, bob_balanceBefore.add(th.toBN(bob_remainingCollateral)))

    const bob_balanceBefore_Asset = th.toBN(await erc20.balanceOf(bob))
    await borrowerOperations.claimCollateral(erc20.address, { from: bob, gasPrice: 0 })
    const bob_balanceAfter_Asset = th.toBN(await erc20.balanceOf(bob))
    th.assertIsApproximatelyEqual(bob_balanceAfter_Asset, bob_balanceBefore_Asset.add(th.toBN(bob_remainingCollateral_Asset).div(toBN(10 ** 10))))
  })

  it("batchLiquidateTroves() with a non fullfilled liquidation: ICR of non liquidated trove does not change", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(211, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(212, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(219, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(221, 16)), extraParams: { from: erin } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(211, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(212, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(210, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(219, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(221, 16)), extraParams: { from: erin } })

    // Whale provides VST to the SP
    const spDeposit = A_totalDebt.add(B_totalDebt).add(C_totalDebt.div(toBN(2)))
    await openTrove({ ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = A_totalDebt_Asset.add(B_totalDebt_Asset).add(C_totalDebt_Asset.div(toBN(2)))
    await openTrove({ asset: erc20.address, ICR: toBN(dec(220, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops 
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check A, B, C troves are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C_Before = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Before_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C_Before.gt(mv._MCR) && ICR_C_Before.lt(TCR))

    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Before_Asset.gt(mv._MCR) && ICR_C_Before_Asset.lt(TCR_Asset))

    const trovesToLiquidate = [alice, bob, carol]
    await troveManager.batchLiquidateTroves(ZERO_ADDRESS, trovesToLiquidate)
    await troveManager.batchLiquidateTroves(erc20.address, trovesToLiquidate)

    const ICR_C_After = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
    assert.equal(ICR_C_Before.toString(), ICR_C_After)

    const ICR_C_After_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
    assert.equal(ICR_C_Before_Asset.toString(), ICR_C_After_Asset)
  })

  it("batchLiquidateTroves(), with 110% < ICR < TCR, and StabilityPool VST > debt to liquidate: can liquidate troves out of order", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(202, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(204, 16)), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(280, 16)), extraVSTAmount: dec(500, 18), extraParams: { from: erin } })
    await openTrove({ ICR: toBN(dec(282, 16)), extraVSTAmount: dec(500, 18), extraParams: { from: freddy } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(202, 16)), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(204, 16)), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(206, 16)), extraParams: { from: dennis } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(280, 16)), extraVSTAmount: dec(500, 18), extraParams: { from: erin } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(282, 16)), extraVSTAmount: dec(500, 18), extraParams: { from: freddy } })

    // Whale provides 1000 VST to the SP
    const spDeposit = A_totalDebt.add(C_totalDebt).add(D_totalDebt)
    await openTrove({ ICR: toBN(dec(219, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = A_totalDebt_Asset.add(C_totalDebt_Asset).add(D_totalDebt_Asset)
    await openTrove({ asset: erc20.address, ICR: toBN(dec(219, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check troves A-D are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)
    const ICR_D = await troveManager.getCurrentICR(ZERO_ADDRESS, dennis, price)
    const TCR = await th.getTCR(contracts)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)
    const ICR_D_Asset = await troveManager.getCurrentICR(erc20.address, dennis, price)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))
    assert.isTrue(ICR_D.gt(mv._MCR) && ICR_D.lt(TCR))


    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Asset.gt(mv._MCR) && ICR_C_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_D_Asset.gt(mv._MCR) && ICR_D_Asset.lt(TCR_Asset))

    // Troves are ordered by ICR, low to high: A, B, C, D.

    // Liquidate out of ICR order: D, B, C. A (lowest ICR) not included.
    const trovesToLiquidate = [dennis, bob, carol]
    const liquidationTx = await troveManager.batchLiquidateTroves(ZERO_ADDRESS, trovesToLiquidate)
    const liquidationTx_Asset = await troveManager.batchLiquidateTroves(erc20.address, trovesToLiquidate)

    // Check transaction succeeded
    assert.isTrue(liquidationTx.receipt.status)
    assert.isTrue(liquidationTx_Asset.receipt.status)

    // Confirm troves D, B, C removed
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, dennis))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, carol))

    assert.isFalse(await sortedTroves.contains(erc20.address, dennis))
    assert.isFalse(await sortedTroves.contains(erc20.address, bob))
    assert.isFalse(await sortedTroves.contains(erc20.address, carol))

    // Confirm troves have status 'liquidated' (Status enum element idx 3)
    assert.equal((await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '3')
    assert.equal((await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '3')
    assert.equal((await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '3')

    assert.equal((await troveManager.Troves(dennis, erc20.address))[th.TROVE_STATUS_INDEX], '3')
    assert.equal((await troveManager.Troves(dennis, erc20.address))[th.TROVE_STATUS_INDEX], '3')
    assert.equal((await troveManager.Troves(dennis, erc20.address))[th.TROVE_STATUS_INDEX], '3')
  })

  it("batchLiquidateTroves(), with 110% < ICR < TCR, and StabilityPool empty: doesn't liquidate any troves", async () => {
    await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: alice } })
    const { totalDebt: bobDebt_Before } = await openTrove({ ICR: toBN(dec(224, 16)), extraParams: { from: bob } })
    const { totalDebt: carolDebt_Before } = await openTrove({ ICR: toBN(dec(226, 16)), extraParams: { from: carol } })
    const { totalDebt: dennisDebt_Before } = await openTrove({ ICR: toBN(dec(228, 16)), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(222, 16)), extraParams: { from: alice } })
    const { totalDebt: bobDebt_Before_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(224, 16)), extraParams: { from: bob } })
    const { totalDebt: carolDebt_Before_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(226, 16)), extraParams: { from: carol } })
    const { totalDebt: dennisDebt_Before_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(228, 16)), extraParams: { from: dennis } })

    const bobColl_Before = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
    const carolColl_Before = (await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
    const dennisColl_Before = (await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]

    const bobColl_Before_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX]
    const carolColl_Before_Asset = (await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX]
    const dennisColl_Before_Asset = (await troveManager.Troves(dennis, erc20.address))[th.TROVE_COLL_INDEX]

    await openTrove({ ICR: toBN(dec(228, 16)), extraParams: { from: erin } })
    await openTrove({ ICR: toBN(dec(230, 16)), extraParams: { from: freddy } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(228, 16)), extraParams: { from: erin } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(230, 16)), extraParams: { from: freddy } })

    // Price drops
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Check Recovery Mode is active
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Check troves A-D are in range 110% < ICR < TCR
    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, alice, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, bob, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, carol, price)

    assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR))
    assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR))
    assert.isTrue(ICR_C.gt(mv._MCR) && ICR_C.lt(TCR))

    assert.isTrue(ICR_A_Asset.gt(mv._MCR) && ICR_A_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_B_Asset.gt(mv._MCR) && ICR_B_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_C_Asset.gt(mv._MCR) && ICR_C_Asset.lt(TCR_Asset))

    // Troves are ordered by ICR, low to high: A, B, C, D. 
    // Liquidate out of ICR order: D, B, C. A (lowest ICR) not included.
    const trovesToLiquidate = [dennis, bob, carol]
    await assertRevert(troveManager.batchLiquidateTroves(ZERO_ADDRESS, trovesToLiquidate), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.batchLiquidateTroves(erc20.address, trovesToLiquidate), "TroveManager: nothing to liquidate")

    // Confirm troves D, B, C remain in system
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, dennis))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))

    assert.isTrue(await sortedTroves.contains(erc20.address, dennis))
    assert.isTrue(await sortedTroves.contains(erc20.address, bob))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))

    // Confirm troves have status 'active' (Status enum element idx 1)
    assert.equal((await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '1')
    assert.equal((await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '1')
    assert.equal((await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_STATUS_INDEX], '1')

    assert.equal((await troveManager.Troves(dennis, erc20.address))[th.TROVE_STATUS_INDEX], '1')
    assert.equal((await troveManager.Troves(dennis, erc20.address))[th.TROVE_STATUS_INDEX], '1')
    assert.equal((await troveManager.Troves(dennis, erc20.address))[th.TROVE_STATUS_INDEX], '1')

    // Confirm D, B, C coll & debt have not changed
    const dennisDebt_After = (await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX].add(await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, dennis))
    const bobDebt_After = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX].add(await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, bob))
    const carolDebt_After = (await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX].add(await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, carol))

    const dennisColl_After = (await troveManager.Troves(dennis, ZERO_ADDRESS))[th.TROVE_COLL_INDEX].add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, dennis))
    const bobColl_After = (await troveManager.Troves(bob, ZERO_ADDRESS))[th.TROVE_COLL_INDEX].add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, bob))
    const carolColl_After = (await troveManager.Troves(carol, ZERO_ADDRESS))[th.TROVE_COLL_INDEX].add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, carol))

    const dennisDebt_After_Asset = (await troveManager.Troves(dennis, erc20.address))[th.TROVE_DEBT_INDEX].add(await troveManager.getPendingVSTDebtReward(erc20.address, dennis))
    const bobDebt_After_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_DEBT_INDEX].add(await troveManager.getPendingVSTDebtReward(erc20.address, bob))
    const carolDebt_After_Asset = (await troveManager.Troves(carol, erc20.address))[th.TROVE_DEBT_INDEX].add(await troveManager.getPendingVSTDebtReward(erc20.address, carol))

    const dennisColl_After_Asset = (await troveManager.Troves(dennis, erc20.address))[th.TROVE_COLL_INDEX].add(await troveManager.getPendingAssetReward(erc20.address, dennis))
    const bobColl_After_Asset = (await troveManager.Troves(bob, erc20.address))[th.TROVE_COLL_INDEX].add(await troveManager.getPendingAssetReward(erc20.address, bob))
    const carolColl_After_Asset = (await troveManager.Troves(carol, erc20.address))[th.TROVE_COLL_INDEX].add(await troveManager.getPendingAssetReward(erc20.address, carol))

    assert.isTrue(dennisColl_After.eq(dennisColl_Before))
    assert.isTrue(bobColl_After.eq(bobColl_Before))
    assert.isTrue(carolColl_After.eq(carolColl_Before))

    assert.isTrue(dennisColl_After_Asset.eq(dennisColl_Before_Asset))
    assert.isTrue(bobColl_After_Asset.eq(bobColl_Before_Asset))
    assert.isTrue(carolColl_After_Asset.eq(carolColl_Before_Asset))

    th.assertIsApproximatelyEqual(th.toBN(dennisDebt_Before).toString(), dennisDebt_After.toString())
    th.assertIsApproximatelyEqual(th.toBN(bobDebt_Before).toString(), bobDebt_After.toString())
    th.assertIsApproximatelyEqual(th.toBN(carolDebt_Before).toString(), carolDebt_After.toString())

    th.assertIsApproximatelyEqual(th.toBN(dennisDebt_Before_Asset).toString(), dennisDebt_After_Asset.toString())
    th.assertIsApproximatelyEqual(th.toBN(bobDebt_Before_Asset).toString(), bobDebt_After_Asset.toString())
    th.assertIsApproximatelyEqual(th.toBN(carolDebt_Before_Asset).toString(), carolDebt_After_Asset.toString())
  })

  it('batchLiquidateTroves(): skips liquidation of troves with ICR > TCR, regardless of Stability Pool size', async () => {
    // Troves that will fall into ICR range 100-MCR
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(194, 16)), extraParams: { from: A } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: B } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(198, 16)), extraParams: { from: C } })

    const { totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(194, 16)), extraParams: { from: A } })
    const { totalDebt: B_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(196, 16)), extraParams: { from: B } })
    const { totalDebt: C_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(198, 16)), extraParams: { from: C } })

    // Troves that will fall into ICR range 110-TCR
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(221, 16)), extraParams: { from: D } })
    await openTrove({ ICR: toBN(dec(223, 16)), extraParams: { from: E } })
    await openTrove({ ICR: toBN(dec(225, 16)), extraParams: { from: F } })

    const { totalDebt: D_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(221, 16)), extraParams: { from: D } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(223, 16)), extraParams: { from: E } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(225, 16)), extraParams: { from: F } })

    // Troves that will fall into ICR range >= TCR
    const { totalDebt: G_totalDebt } = await openTrove({ ICR: toBN(dec(250, 16)), extraParams: { from: G } })
    const { totalDebt: H_totalDebt } = await openTrove({ ICR: toBN(dec(270, 16)), extraParams: { from: H } })
    const { totalDebt: I_totalDebt } = await openTrove({ ICR: toBN(dec(290, 16)), extraParams: { from: I } })

    const { totalDebt: G_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(250, 16)), extraParams: { from: G } })
    const { totalDebt: H_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(270, 16)), extraParams: { from: H } })
    const { totalDebt: I_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(290, 16)), extraParams: { from: I } })

    // Whale adds VST to SP
    const spDeposit = A_totalDebt.add(C_totalDebt).add(D_totalDebt).add(G_totalDebt).add(H_totalDebt).add(I_totalDebt)
    await openTrove({ ICR: toBN(dec(245, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = A_totalDebt_Asset.add(C_totalDebt_Asset).add(D_totalDebt_Asset).add(G_totalDebt_Asset).add(H_totalDebt_Asset).add(I_totalDebt_Asset)
    await openTrove({ asset: erc20.address, ICR: toBN(dec(245, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(110, 18))
    const price = await priceFeed.getPrice()
    const TCR = await th.getTCR(contracts)
    const TCR_Asset = await th.getTCR(contracts, erc20.address)

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    const G_collBefore = (await troveManager.Troves(G, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
    const G_debtBefore = (await troveManager.Troves(G, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]
    const H_collBefore = (await troveManager.Troves(H, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
    const H_debtBefore = (await troveManager.Troves(H, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]
    const I_collBefore = (await troveManager.Troves(I, ZERO_ADDRESS))[th.TROVE_COLL_INDEX]
    const I_debtBefore = (await troveManager.Troves(I, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]

    const G_collBefore_Asset = (await troveManager.Troves(G, erc20.address))[th.TROVE_COLL_INDEX]
    const G_debtBefore_Asset = (await troveManager.Troves(G, erc20.address))[th.TROVE_DEBT_INDEX]
    const H_collBefore_Asset = (await troveManager.Troves(H, erc20.address))[th.TROVE_COLL_INDEX]
    const H_debtBefore_Asset = (await troveManager.Troves(H, erc20.address))[th.TROVE_DEBT_INDEX]
    const I_collBefore_Asset = (await troveManager.Troves(I, erc20.address))[th.TROVE_COLL_INDEX]
    const I_debtBefore_Asset = (await troveManager.Troves(I, erc20.address))[th.TROVE_DEBT_INDEX]

    const ICR_A = await troveManager.getCurrentICR(ZERO_ADDRESS, A, price)
    const ICR_B = await troveManager.getCurrentICR(ZERO_ADDRESS, B, price)
    const ICR_C = await troveManager.getCurrentICR(ZERO_ADDRESS, C, price)
    const ICR_D = await troveManager.getCurrentICR(ZERO_ADDRESS, D, price)
    const ICR_E = await troveManager.getCurrentICR(ZERO_ADDRESS, E, price)
    const ICR_F = await troveManager.getCurrentICR(ZERO_ADDRESS, F, price)
    const ICR_G = await troveManager.getCurrentICR(ZERO_ADDRESS, G, price)
    const ICR_H = await troveManager.getCurrentICR(ZERO_ADDRESS, H, price)
    const ICR_I = await troveManager.getCurrentICR(ZERO_ADDRESS, I, price)

    const ICR_A_Asset = await troveManager.getCurrentICR(erc20.address, A, price)
    const ICR_B_Asset = await troveManager.getCurrentICR(erc20.address, B, price)
    const ICR_C_Asset = await troveManager.getCurrentICR(erc20.address, C, price)
    const ICR_D_Asset = await troveManager.getCurrentICR(erc20.address, D, price)
    const ICR_E_Asset = await troveManager.getCurrentICR(erc20.address, E, price)
    const ICR_F_Asset = await troveManager.getCurrentICR(erc20.address, F, price)
    const ICR_G_Asset = await troveManager.getCurrentICR(erc20.address, G, price)
    const ICR_H_Asset = await troveManager.getCurrentICR(erc20.address, H, price)
    const ICR_I_Asset = await troveManager.getCurrentICR(erc20.address, I, price)

    // Check A-C are in range 100-110
    assert.isTrue(ICR_A.gte(mv._ICR100) && ICR_A.lt(mv._MCR))
    assert.isTrue(ICR_B.gte(mv._ICR100) && ICR_B.lt(mv._MCR))
    assert.isTrue(ICR_C.gte(mv._ICR100) && ICR_C.lt(mv._MCR))

    assert.isTrue(ICR_A_Asset.gte(mv._ICR100) && ICR_A_Asset.lt(mv._MCR))
    assert.isTrue(ICR_B_Asset.gte(mv._ICR100) && ICR_B_Asset.lt(mv._MCR))
    assert.isTrue(ICR_C_Asset.gte(mv._ICR100) && ICR_C_Asset.lt(mv._MCR))

    // Check D-F are in range 110-TCR
    assert.isTrue(ICR_D.gt(mv._MCR) && ICR_D.lt(TCR))
    assert.isTrue(ICR_E.gt(mv._MCR) && ICR_E.lt(TCR))
    assert.isTrue(ICR_F.gt(mv._MCR) && ICR_F.lt(TCR))

    assert.isTrue(ICR_D_Asset.gt(mv._MCR) && ICR_D_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_E_Asset.gt(mv._MCR) && ICR_E_Asset.lt(TCR_Asset))
    assert.isTrue(ICR_F_Asset.gt(mv._MCR) && ICR_F_Asset.lt(TCR_Asset))

    // Check G-I are in range >= TCR
    assert.isTrue(ICR_G.gte(TCR))
    assert.isTrue(ICR_H.gte(TCR))
    assert.isTrue(ICR_I.gte(TCR))

    assert.isTrue(ICR_G_Asset.gte(TCR_Asset))
    assert.isTrue(ICR_H_Asset.gte(TCR_Asset))
    assert.isTrue(ICR_I_Asset.gte(TCR_Asset))

    // Attempt to liquidate only troves with ICR > TCR% 
    await assertRevert(troveManager.batchLiquidateTroves(ZERO_ADDRESS, [G, H, I]), "TroveManager: nothing to liquidate")
    await assertRevert(troveManager.batchLiquidateTroves(erc20.address, [G, H, I]), "TroveManager: nothing to liquidate")

    // Check G, H, I remain in system
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, G))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, H))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, I))

    assert.isTrue(await sortedTroves.contains(erc20.address, G))
    assert.isTrue(await sortedTroves.contains(erc20.address, H))
    assert.isTrue(await sortedTroves.contains(erc20.address, I))

    // Check G, H, I coll and debt have not changed
    assert.equal(G_collBefore.eq(await troveManager.Troves(G, ZERO_ADDRESS))[th.TROVE_COLL_INDEX])
    assert.equal(G_debtBefore.eq(await troveManager.Troves(G, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX])
    assert.equal(H_collBefore.eq(await troveManager.Troves(H, ZERO_ADDRESS))[th.TROVE_COLL_INDEX])
    assert.equal(H_debtBefore.eq(await troveManager.Troves(H, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX])
    assert.equal(I_collBefore.eq(await troveManager.Troves(I, ZERO_ADDRESS))[th.TROVE_COLL_INDEX])
    assert.equal(I_debtBefore.eq(await troveManager.Troves(I, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX])

    assert.equal(G_collBefore_Asset.eq(await troveManager.Troves(G, erc20.address))[th.TROVE_COLL_INDEX])
    assert.equal(G_debtBefore_Asset.eq(await troveManager.Troves(G, erc20.address))[th.TROVE_DEBT_INDEX])
    assert.equal(H_collBefore_Asset.eq(await troveManager.Troves(H, erc20.address))[th.TROVE_COLL_INDEX])
    assert.equal(H_debtBefore_Asset.eq(await troveManager.Troves(H, erc20.address))[th.TROVE_DEBT_INDEX])
    assert.equal(I_collBefore_Asset.eq(await troveManager.Troves(I, erc20.address))[th.TROVE_COLL_INDEX])
    assert.equal(I_debtBefore_Asset.eq(await troveManager.Troves(I, erc20.address))[th.TROVE_DEBT_INDEX])

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Attempt to liquidate a variety of troves with SP covering whole batch.
    // Expect A, C, D to be liquidated, and G, H, I to remain in system
    await troveManager.batchLiquidateTroves(ZERO_ADDRESS, [C, D, G, H, A, I])
    await troveManager.batchLiquidateTroves(erc20.address, [C, D, G, H, A, I])

    // Confirm A, C, D liquidated  
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, C))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, A))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, D))

    assert.isFalse(await sortedTroves.contains(erc20.address, C))
    assert.isFalse(await sortedTroves.contains(erc20.address, A))
    assert.isFalse(await sortedTroves.contains(erc20.address, D))

    // Check G, H, I remain in system
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, G))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, H))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, I))

    assert.isTrue(await sortedTroves.contains(erc20.address, G))
    assert.isTrue(await sortedTroves.contains(erc20.address, H))
    assert.isTrue(await sortedTroves.contains(erc20.address, I))

    // Check coll and debt have not changed
    assert.equal(G_collBefore.eq(await troveManager.Troves(G, ZERO_ADDRESS))[th.TROVE_COLL_INDEX])
    assert.equal(G_debtBefore.eq(await troveManager.Troves(G, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX])
    assert.equal(H_collBefore.eq(await troveManager.Troves(H, ZERO_ADDRESS))[th.TROVE_COLL_INDEX])
    assert.equal(H_debtBefore.eq(await troveManager.Troves(H, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX])
    assert.equal(I_collBefore.eq(await troveManager.Troves(I, ZERO_ADDRESS))[th.TROVE_COLL_INDEX])
    assert.equal(I_debtBefore.eq(await troveManager.Troves(I, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX])

    assert.equal(G_collBefore_Asset.eq(await troveManager.Troves(G, erc20.address))[th.TROVE_COLL_INDEX])
    assert.equal(G_debtBefore_Asset.eq(await troveManager.Troves(G, erc20.address))[th.TROVE_DEBT_INDEX])
    assert.equal(H_collBefore_Asset.eq(await troveManager.Troves(H, erc20.address))[th.TROVE_COLL_INDEX])
    assert.equal(H_debtBefore_Asset.eq(await troveManager.Troves(H, erc20.address))[th.TROVE_DEBT_INDEX])
    assert.equal(I_collBefore_Asset.eq(await troveManager.Troves(I, erc20.address))[th.TROVE_COLL_INDEX])
    assert.equal(I_debtBefore_Asset.eq(await troveManager.Troves(I, erc20.address))[th.TROVE_DEBT_INDEX])

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Whale withdraws entire deposit, and re-deposits 132 VST
    // Increasing the price for a moment to avoid pending liquidations to block withdrawal
    await priceFeed.setPrice(dec(200, 18))
    await stabilityPool.withdrawFromSP(spDeposit, { from: whale })
    await stabilityPoolERC20.withdrawFromSP(spDeposit_Asset, { from: whale })
    await priceFeed.setPrice(dec(110, 18))
    await stabilityPool.provideToSP(B_totalDebt.add(toBN(dec(50, 18))), { from: whale })
    await stabilityPoolERC20.provideToSP(B_totalDebt_Asset.add(toBN(dec(50, 18))), { from: whale })

    // B and E are still in range 110-TCR.
    // Attempt to liquidate B, G, H, I, E.
    // Expected Stability Pool to fully absorb B (92 VST + 10 virtual debt),
    // but not E as there are not enough funds in Stability Pool

    const stabilityBefore = await stabilityPool.getTotalVSTDeposits()
    const dEbtBefore = (await troveManager.Troves(E, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]

    const stabilityBefore_Asset = await stabilityPoolERC20.getTotalVSTDeposits()
    const dEbtBefore_Asset = (await troveManager.Troves(E, erc20.address))[th.TROVE_DEBT_INDEX]

    await troveManager.batchLiquidateTroves(ZERO_ADDRESS, [B, G, H, I, E])
    await troveManager.batchLiquidateTroves(erc20.address, [B, G, H, I, E])

    const dEbtAfter = (await troveManager.Troves(E, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX]
    const stabilityAfter = await stabilityPool.getTotalVSTDeposits()

    const dEbtAfter_Asset = (await troveManager.Troves(E, erc20.address))[th.TROVE_DEBT_INDEX]
    const stabilityAfter_Asset = await stabilityPoolERC20.getTotalVSTDeposits()

    const stabilityDelta = stabilityBefore.sub(stabilityAfter)
    const dEbtDelta = dEbtBefore.sub(dEbtAfter)

    const stabilityDelta_Asset = stabilityBefore_Asset.sub(stabilityAfter_Asset)
    const dEbtDelta_Asset = dEbtBefore_Asset.sub(dEbtAfter_Asset)

    th.assertIsApproximatelyEqual(stabilityDelta, B_totalDebt)
    assert.equal((dEbtDelta.toString()), '0')

    th.assertIsApproximatelyEqual(stabilityDelta_Asset, B_totalDebt_Asset)
    assert.equal((dEbtDelta_Asset.toString()), '0')

    // Confirm B removed and E active 
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, B))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, E))

    assert.isFalse(await sortedTroves.contains(erc20.address, B))
    assert.isTrue(await sortedTroves.contains(erc20.address, E))

    // Check G, H, I remain in system
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, G))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, H))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, I))

    assert.isTrue(await sortedTroves.contains(erc20.address, G))
    assert.isTrue(await sortedTroves.contains(erc20.address, H))
    assert.isTrue(await sortedTroves.contains(erc20.address, I))

    // Check coll and debt have not changed
    assert.equal(G_collBefore.eq(await troveManager.Troves(G, ZERO_ADDRESS))[th.TROVE_COLL_INDEX])
    assert.equal(G_debtBefore.eq(await troveManager.Troves(G, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX])
    assert.equal(H_collBefore.eq(await troveManager.Troves(H, ZERO_ADDRESS))[th.TROVE_COLL_INDEX])
    assert.equal(H_debtBefore.eq(await troveManager.Troves(H, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX])
    assert.equal(I_collBefore.eq(await troveManager.Troves(I, ZERO_ADDRESS))[th.TROVE_COLL_INDEX])
    assert.equal(I_debtBefore.eq(await troveManager.Troves(I, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX])

    assert.equal(G_collBefore_Asset.eq(await troveManager.Troves(G, erc20.address))[th.TROVE_COLL_INDEX])
    assert.equal(G_debtBefore_Asset.eq(await troveManager.Troves(G, erc20.address))[th.TROVE_DEBT_INDEX])
    assert.equal(H_collBefore_Asset.eq(await troveManager.Troves(H, erc20.address))[th.TROVE_COLL_INDEX])
    assert.equal(H_debtBefore_Asset.eq(await troveManager.Troves(H, erc20.address))[th.TROVE_DEBT_INDEX])
    assert.equal(I_collBefore_Asset.eq(await troveManager.Troves(I, erc20.address))[th.TROVE_COLL_INDEX])
    assert.equal(I_debtBefore_Asset.eq(await troveManager.Troves(I, erc20.address))[th.TROVE_DEBT_INDEX])
  })

  it('batchLiquidateTroves(): emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves', async () => {
    // Troves to be absorbed by SP
    const { collateral: F_coll, totalDebt: F_totalDebt } = await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: freddy } })
    const { collateral: G_coll, totalDebt: G_totalDebt } = await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: greta } })

    const { collateral: F_coll_Asset, totalDebt: F_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(222, 16)), extraParams: { from: freddy } })
    const { collateral: G_coll_Asset, totalDebt: G_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(222, 16)), extraParams: { from: greta } })

    // Troves to be spared
    await openTrove({ ICR: toBN(dec(250, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(285, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(308, 16)), extraParams: { from: dennis } })

    await openTrove({ asset: erc20.address, ICR: toBN(dec(250, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(285, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(308, 16)), extraParams: { from: dennis } })

    // Whale adds VST to SP
    const spDeposit = F_totalDebt.add(G_totalDebt)
    await openTrove({ ICR: toBN(dec(285, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = F_totalDebt_Asset.add(G_totalDebt_Asset)
    await openTrove({ asset: erc20.address, ICR: toBN(dec(285, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Confirm all troves have ICR > MCR
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, freddy, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, greta, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).gte(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, freddy, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, greta, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, carol, price)).gte(mv._MCR))

    // Confirm VST in Stability Pool
    assert.equal((await stabilityPool.getTotalVSTDeposits()).toString(), spDeposit.toString())
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), spDeposit_Asset.toString())

    const trovesToLiquidate = [freddy, greta, alice, bob, carol, dennis, whale]

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.batchLiquidateTroves(ZERO_ADDRESS, trovesToLiquidate)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

    const liquidationTx_Asset = await troveManager.batchLiquidateTroves(erc20.address, trovesToLiquidate)
    const [liquidatedDebt_Asset, liquidatedColl_Asset, gasComp_Asset] = th.getEmittedLiquidationValues(liquidationTx_Asset)

    // Check F and G were liquidated
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, freddy))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, greta))

    assert.isFalse(await sortedTroves.contains(erc20.address, freddy))
    assert.isFalse(await sortedTroves.contains(erc20.address, greta))

    // Check whale and A-D remain active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, dennis))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, whale))

    assert.isTrue(await sortedTroves.contains(erc20.address, alice))
    assert.isTrue(await sortedTroves.contains(erc20.address, bob))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))
    assert.isTrue(await sortedTroves.contains(erc20.address, dennis))
    assert.isTrue(await sortedTroves.contains(erc20.address, whale))

    // Liquidation event emits coll = (F_debt + G_debt)/price*1.1*0.995, and debt = (F_debt + G_debt)
    th.assertIsApproximatelyEqual(liquidatedDebt, F_totalDebt.add(G_totalDebt))
    th.assertIsApproximatelyEqual(liquidatedColl, th.applyLiquidationFee(F_totalDebt.add(G_totalDebt).mul(toBN(dec(11, 17))).div(price)))

    th.assertIsApproximatelyEqual(liquidatedDebt_Asset, F_totalDebt_Asset.add(G_totalDebt_Asset))
    th.assertIsApproximatelyEqual(liquidatedColl_Asset, th.applyLiquidationFee(F_totalDebt_Asset.add(G_totalDebt_Asset).mul(toBN(dec(11, 17))).div(price)))

    // check collateral surplus
    const freddy_remainingCollateral = F_coll.sub(F_totalDebt.mul(th.toBN(dec(11, 17))).div(price))
    const greta_remainingCollateral = G_coll.sub(G_totalDebt.mul(th.toBN(dec(11, 17))).div(price))
    const freddy_remainingCollateral_Asset = F_coll_Asset.sub(F_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))
    const greta_remainingCollateral_Asset = G_coll_Asset.sub(G_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))

    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, freddy), freddy_remainingCollateral)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, greta), greta_remainingCollateral)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, freddy), freddy_remainingCollateral_Asset)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, greta), greta_remainingCollateral_Asset)

    // can claim collateral
    const freddy_balanceBefore = th.toBN(await web3.eth.getBalance(freddy))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: freddy, gasPrice: 0 })
    const freddy_balanceAfter = th.toBN(await web3.eth.getBalance(freddy))
    th.assertIsApproximatelyEqual(freddy_balanceAfter, freddy_balanceBefore.add(th.toBN(freddy_remainingCollateral)))

    const freddy_balanceBefore_Asset = th.toBN(await erc20.balanceOf(freddy))
    await borrowerOperations.claimCollateral(erc20.address, { from: freddy, gasPrice: 0 })
    const freddy_balanceAfter_Asset = th.toBN(await erc20.balanceOf(freddy))
    th.assertIsApproximatelyEqual(freddy_balanceAfter_Asset, freddy_balanceBefore_Asset.add(th.toBN(freddy_remainingCollateral_Asset.div(toBN(10 ** 10)))))

    const greta_balanceBefore = th.toBN(await web3.eth.getBalance(greta))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: greta, gasPrice: 0 })
    const greta_balanceAfter = th.toBN(await web3.eth.getBalance(greta))
    th.assertIsApproximatelyEqual(greta_balanceAfter, greta_balanceBefore.add(th.toBN(greta_remainingCollateral)))

    const greta_balanceBefore_Asset = th.toBN(await erc20.balanceOf(greta))
    await borrowerOperations.claimCollateral(erc20.address, { from: greta, gasPrice: 0 })
    const greta_balanceAfter_Asset = th.toBN(await erc20.balanceOf(greta))
    th.assertIsApproximatelyEqual(greta_balanceAfter_Asset, greta_balanceBefore_Asset.add(th.toBN(greta_remainingCollateral_Asset).div(toBN(10 ** 10))))
  })

  it('batchLiquidateTroves(): emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves, including a partial', async () => {
    // Troves to be absorbed by SP
    const { collateral: F_coll, totalDebt: F_totalDebt } = await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: freddy } })
    const { collateral: G_coll, totalDebt: G_totalDebt } = await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: greta } })

    const { collateral: F_coll_Asset, totalDebt: F_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(222, 16)), extraParams: { from: freddy } })
    const { collateral: G_coll_Asset, totalDebt: G_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(222, 16)), extraParams: { from: greta } })

    // Troves to be spared
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(250, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(266, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(285, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(308, 16)), extraParams: { from: dennis } })

    const { collateral: A_coll_Asset, totalDebt: A_totalDebt_Asset } = await openTrove({ asset: erc20.address, ICR: toBN(dec(250, 16)), extraParams: { from: alice } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(266, 16)), extraParams: { from: bob } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(285, 16)), extraParams: { from: carol } })
    await openTrove({ asset: erc20.address, ICR: toBN(dec(308, 16)), extraParams: { from: dennis } })

    // Whale opens trove and adds 220 VST to SP
    const spDeposit = F_totalDebt.add(G_totalDebt).add(A_totalDebt.div(toBN(2)))
    await openTrove({ ICR: toBN(dec(285, 16)), extraVSTAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, { from: whale })

    const spDeposit_Asset = F_totalDebt_Asset.add(G_totalDebt_Asset).add(A_totalDebt_Asset.div(toBN(2)))
    await openTrove({ asset: erc20.address, ICR: toBN(dec(285, 16)), extraVSTAmount: spDeposit_Asset, extraParams: { from: whale } })
    await stabilityPoolERC20.provideToSP(spDeposit_Asset, { from: whale })

    // Price drops, but all troves remain active
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))
    assert.isTrue(await th.checkRecoveryMode(contracts, erc20.address))

    // Confirm all troves have ICR > MCR
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, freddy, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, greta, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ZERO_ADDRESS, carol, price)).gte(mv._MCR))

    assert.isTrue((await troveManager.getCurrentICR(erc20.address, freddy, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, greta, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, alice, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, bob, price)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erc20.address, carol, price)).gte(mv._MCR))

    // Confirm VST in Stability Pool
    assert.equal((await stabilityPool.getTotalVSTDeposits()).toString(), spDeposit.toString())
    assert.equal((await stabilityPoolERC20.getTotalVSTDeposits()).toString(), spDeposit_Asset.toString())

    const trovesToLiquidate = [freddy, greta, alice, bob, carol, dennis, whale]

    // Attempt liqudation sequence
    const liquidationTx = await troveManager.batchLiquidateTroves(ZERO_ADDRESS, trovesToLiquidate)
    const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

    const liquidationTx_Asset = await troveManager.batchLiquidateTroves(erc20.address, trovesToLiquidate)
    const [liquidatedDebt_Asset, liquidatedColl_Asset, gasComp_Asset] = th.getEmittedLiquidationValues(liquidationTx_Asset)

    // Check F and G were liquidated
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, freddy))
    assert.isFalse(await sortedTroves.contains(ZERO_ADDRESS, greta))
    assert.isFalse(await sortedTroves.contains(erc20.address, freddy))
    assert.isFalse(await sortedTroves.contains(erc20.address, greta))

    // Check whale and A-D remain active
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, alice))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, bob))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, carol))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, dennis))
    assert.isTrue(await sortedTroves.contains(ZERO_ADDRESS, whale))

    assert.isTrue(await sortedTroves.contains(erc20.address, alice))
    assert.isTrue(await sortedTroves.contains(erc20.address, bob))
    assert.isTrue(await sortedTroves.contains(erc20.address, carol))
    assert.isTrue(await sortedTroves.contains(erc20.address, dennis))
    assert.isTrue(await sortedTroves.contains(erc20.address, whale))

    // Check A's collateral and debt are the same
    const entireColl_A = (await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_COLL_INDEX].add(await troveManager.getPendingAssetReward(ZERO_ADDRESS, alice))
    const entireDebt_A = (await troveManager.Troves(alice, ZERO_ADDRESS))[th.TROVE_DEBT_INDEX].add(await troveManager.getPendingVSTDebtReward(ZERO_ADDRESS, alice))

    const entireColl_A_Asset = (await troveManager.Troves(alice, erc20.address))[th.TROVE_COLL_INDEX].add(await troveManager.getPendingAssetReward(erc20.address, alice))
    const entireDebt_A_Asset = (await troveManager.Troves(alice, erc20.address))[th.TROVE_DEBT_INDEX].add(await troveManager.getPendingVSTDebtReward(erc20.address, alice))

    assert.equal(entireColl_A.toString(), A_coll)
    assert.equal(entireColl_A_Asset.toString(), A_coll_Asset)
    th.assertIsApproximatelyEqual(entireDebt_A.toString(), A_totalDebt)
    th.assertIsApproximatelyEqual(entireDebt_A_Asset.toString(), A_totalDebt_Asset)

    /* Liquidation event emits:
    coll = (F_debt + G_debt)/price*1.1*0.995
    debt = (F_debt + G_debt) */
    th.assertIsApproximatelyEqual(liquidatedDebt, F_totalDebt.add(G_totalDebt))
    th.assertIsApproximatelyEqual(liquidatedColl, th.applyLiquidationFee(F_totalDebt.add(G_totalDebt).mul(toBN(dec(11, 17))).div(price)))

    th.assertIsApproximatelyEqual(liquidatedDebt_Asset, F_totalDebt_Asset.add(G_totalDebt_Asset))
    th.assertIsApproximatelyEqual(liquidatedColl_Asset, th.applyLiquidationFee(F_totalDebt_Asset.add(G_totalDebt_Asset).mul(toBN(dec(11, 17))).div(price)))

    // check collateral surplus
    const freddy_remainingCollateral = F_coll.sub(F_totalDebt.mul(th.toBN(dec(11, 17))).div(price))
    const greta_remainingCollateral = G_coll.sub(G_totalDebt.mul(th.toBN(dec(11, 17))).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, freddy), freddy_remainingCollateral)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(ZERO_ADDRESS, greta), greta_remainingCollateral)

    const freddy_remainingCollateral_Asset = F_coll_Asset.sub(F_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))
    const greta_remainingCollateral_Asset = G_coll_Asset.sub(G_totalDebt_Asset.mul(th.toBN(dec(11, 17))).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, freddy), freddy_remainingCollateral_Asset)
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(erc20.address, greta), greta_remainingCollateral_Asset)

    // can claim collateral
    const freddy_balanceBefore = th.toBN(await web3.eth.getBalance(freddy))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: freddy, gasPrice: 0 })
    const freddy_balanceAfter = th.toBN(await web3.eth.getBalance(freddy))
    th.assertIsApproximatelyEqual(freddy_balanceAfter, freddy_balanceBefore.add(th.toBN(freddy_remainingCollateral)))

    const freddy_balanceBefore_Asset = th.toBN(await erc20.balanceOf(freddy))
    await borrowerOperations.claimCollateral(erc20.address, { from: freddy, gasPrice: 0 })
    const freddy_balanceAfter_Asset = th.toBN(await erc20.balanceOf(freddy))
    th.assertIsApproximatelyEqual(freddy_balanceAfter_Asset, freddy_balanceBefore_Asset.add(th.toBN(freddy_remainingCollateral_Asset.div(toBN(10 ** 10)))))

    const greta_balanceBefore = th.toBN(await web3.eth.getBalance(greta))
    await borrowerOperations.claimCollateral(ZERO_ADDRESS, { from: greta, gasPrice: 0 })
    const greta_balanceAfter = th.toBN(await web3.eth.getBalance(greta))
    th.assertIsApproximatelyEqual(greta_balanceAfter, greta_balanceBefore.add(th.toBN(greta_remainingCollateral)))

    const greta_balanceBefore_Asset = th.toBN(await erc20.balanceOf(greta))
    await borrowerOperations.claimCollateral(erc20.address, { from: greta, gasPrice: 0 })
    const greta_balanceAfter_Asset = th.toBN(await erc20.balanceOf(greta))
    th.assertIsApproximatelyEqual(greta_balanceAfter_Asset, greta_balanceBefore_Asset.add(th.toBN(greta_remainingCollateral_Asset).div(toBN(10 ** 10))))
  })

})

contract('Reset chain state', async accounts => { })
